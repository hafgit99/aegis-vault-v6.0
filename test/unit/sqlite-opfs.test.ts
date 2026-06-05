import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlMock = vi.hoisted(() => {
  const dbInstances: any[] = [];
  const stmtInstances: any[] = [];
  const tableInfoResults: any[] = [];

  const createStatement = (rows: Record<string, unknown>[] = []) => {
    let index = -1;
    const stmt = {
      bind: vi.fn(),
      run: vi.fn(),
      step: vi.fn(() => {
        index += 1;
        return index < rows.length;
      }),
      getAsObject: vi.fn(() => rows[index]),
      free: vi.fn(),
    };
    stmtInstances.push(stmt);
    return stmt;
  };

  const Database = vi.fn().mockImplementation(function (_data?: Uint8Array) {
    const db = {
      rows: [] as Record<string, unknown>[],
      metadataResult: [] as any[],
      attachmentResult: [{ iv: new Uint8Array([1, 2]), encrypted_data: new Uint8Array([3, 4]) }] as any[],
      tableInfoResult: tableInfoResults.shift() ?? [{ values: [] }],
      run: vi.fn(),
      exec: vi.fn((sql: string) => {
        if (sql === 'PRAGMA table_info(passwords)') return db.tableInfoResult;
        if (sql.includes('vault_metadata')) return db.metadataResult;
        return [];
      }),
      prepare: vi.fn((sql: string) => {
        if (sql.includes('SELECT * FROM passwords WHERE id = ?')) return createStatement(db.rows.slice(0, 1).map(row => ({ ...row })));
        if (sql.includes('SELECT * FROM passwords')) return createStatement(db.rows.map(row => ({ ...row })));
        if (sql.includes('SELECT data FROM vault_metadata')) {
          const rows = db.metadataResult.flatMap((result: any) =>
            (result.values || []).map((value: unknown[]) => ({ data: value[0] }))
          );
          return createStatement(rows);
        }
        if (sql.includes('SELECT iv, encrypted_data FROM attachments')) return createStatement(db.attachmentResult);
        return createStatement();
      }),
      export: vi.fn(() => new Uint8Array([1, 2, 3])),
      close: vi.fn(),
    };
    dbInstances.push(db);
    return db;
  });

  return {
    Database,
    dbInstances,
    stmtInstances,
    tableInfoResults,
    initSqlJs: vi.fn(async () => ({ Database })),
  };
});

vi.mock('sql.js', () => ({
  default: sqlMock.initSqlJs,
}));

vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({
  default: 'sql-wasm.mock.wasm',
}));

import {
  SQLiteOPFS,
  clearAllOPFSFiles,
  deleteOPFSFile,
  isOPFSAvailable,
} from '../../src/lib/SQLiteOPFS';

const installOPFSMock = () => {
  const writable = {
    write: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  const fileHandle = {
    getFile: vi.fn(async () => ({
      arrayBuffer: vi.fn(async () => new Uint8Array([9, 8, 7]).buffer),
    })),
    createWritable: vi.fn(async () => writable),
  };
  const root = {
    getFileHandle: vi.fn(async () => fileHandle),
    removeEntry: vi.fn(async () => undefined),
    async *entries() {
      yield ['aegis_vault.sqlite'];
      yield ['notes.txt'];
      yield ['backup.sqlite'];
    },
  };

  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: {
      getDirectory: vi.fn(async () => root),
    },
  });

  return { root, fileHandle, writable };
};

describe('SQLiteOPFS', () => {
  beforeEach(() => {
    vi.useRealTimers();
    sqlMock.dbInstances.length = 0;
    sqlMock.stmtInstances.length = 0;
    sqlMock.tableInfoResults.length = 0;
    sqlMock.Database.mockClear();
    sqlMock.initSqlJs.mockClear();
    installOPFSMock();
  });

  it('detects OPFS availability and clears sqlite files only', async () => {
    const { root } = installOPFSMock();

    expect(isOPFSAvailable()).toBe(true);
    await deleteOPFSFile('aegis_vault.sqlite');
    await clearAllOPFSFiles();

    expect(root.removeEntry).toHaveBeenCalledWith('aegis_vault.sqlite');
    expect(root.removeEntry).toHaveBeenCalledWith('backup.sqlite');
    expect(root.removeEntry).not.toHaveBeenCalledWith('notes.txt');
  });

  it('reports unavailable OPFS and no-ops clear when storage APIs are missing', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: undefined,
    });

    expect(isOPFSAvailable()).toBe(false);
    await expect(clearAllOPFSFiles()).resolves.toBeUndefined();

    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {},
    });

    expect(isOPFSAvailable()).toBe(false);
  });

  it('swallows OPFS delete and clear failures', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const root = {
      removeEntry: vi.fn(async () => {
        throw new Error('locked');
      }),
      async *entries() {
        throw new Error('entries failed');
      },
    };
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        getDirectory: vi.fn(async () => root),
      },
    });

    await expect(deleteOPFSFile('aegis_vault.sqlite')).resolves.toBeUndefined();
    await expect(clearAllOPFSFiles()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('[OPFS] Top-level clear error:', expect.any(Error));
    warn.mockRestore();
  });

  it('opens a database, applies schema migrations, and persists immediately', async () => {
    const { root, writable } = installOPFSMock();
    const db = new SQLiteOPFS('unit_vault');

    await db.open();
    const sqlite = sqlMock.dbInstances[0];
    const schemaSql = sqlite.run.mock.calls[0][0] as string;

    expect(sqlMock.initSqlJs).toHaveBeenCalledWith({ locateFile: expect.any(Function) });
    expect(root.getFileHandle).toHaveBeenCalledWith('unit_vault.sqlite');
    expect(root.getFileHandle).toHaveBeenCalledWith('unit_vault.sqlite', { create: true });
    expect(sqlite.run).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS passwords'));
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS vault_metadata');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS attachments');
    expect(schemaSql).toContain('CREATE INDEX IF NOT EXISTS idx_passwords_category');
    expect(schemaSql).toContain('encrypted_passkey_meta TEXT');
    expect(schemaSql).toContain('encrypted_card_details TEXT');
    expect(schemaSql).toContain('encrypted_identity_details TEXT');
    expect(schemaSql).toContain('encrypted_alias_details TEXT');
    expect(schemaSql).toContain('encrypted_history TEXT');
    expect(sqlite.run).toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE passwords ADD COLUMN encrypted_title TEXT'));
    expect(sqlite.run).toHaveBeenCalledWith('PRAGMA journal_mode = WAL;');
    expect(sqlite.export).toHaveBeenCalled();
    expect(writable.write).toHaveBeenCalledWith(expect.any(Blob));
    const persistedBlob = (writable.write.mock.calls as unknown as [[Blob]])[0][0];
    await expect(persistedBlob.arrayBuffer()).resolves.toEqual(new Uint8Array([1, 2, 3]).buffer);
    expect(db.isOpen).toBe(true);
  });

  it('loads existing OPFS database bytes when present', async () => {
    installOPFSMock();
    const db = new SQLiteOPFS('existing_vault');

    await db.open();

    expect(sqlMock.Database).toHaveBeenCalledWith(new Uint8Array([9, 8, 7]));
  });

  it('creates a new database when OPFS has no usable existing data', async () => {
    const { fileHandle } = installOPFSMock();
    fileHandle.getFile.mockResolvedValueOnce({
      arrayBuffer: vi.fn(async () => new Uint8Array([]).buffer),
    });
    const db = new SQLiteOPFS('empty_vault');

    await db.open();

    expect(sqlMock.Database).toHaveBeenCalledWith();
  });

  it('creates a new database when reading the OPFS file fails', async () => {
    const { root } = installOPFSMock();
    root.getFileHandle.mockRejectedValueOnce(new Error('missing'));
    const db = new SQLiteOPFS('missing_vault');

    await db.open();

    expect(sqlMock.Database).toHaveBeenCalledWith();
    expect(root.getFileHandle).toHaveBeenCalledWith('missing_vault.sqlite', { create: true });
  });

  it('adds the complete expected migration column set for older databases', async () => {
    const db = new SQLiteOPFS('legacy_vault');

    await db.open();
    const sqlite = sqlMock.dbInstances[0];
    const alterStatements = sqlite.run.mock.calls
      .map(([sql]: [string]) => sql)
      .filter((sql: string) => sql.startsWith('ALTER TABLE passwords ADD COLUMN'));

    expect(alterStatements).toEqual([
      'ALTER TABLE passwords ADD COLUMN encrypted_title TEXT',
      'ALTER TABLE passwords ADD COLUMN title_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN encrypted_username TEXT',
      'ALTER TABLE passwords ADD COLUMN username_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN encrypted_website TEXT',
      'ALTER TABLE passwords ADD COLUMN website_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN encrypted_category TEXT',
      'ALTER TABLE passwords ADD COLUMN category_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN encrypted_tags TEXT',
      'ALTER TABLE passwords ADD COLUMN tags_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN search_index TEXT',
      'ALTER TABLE passwords ADD COLUMN deleted_at TEXT',
      'ALTER TABLE passwords ADD COLUMN totp_secret TEXT',
      'ALTER TABLE passwords ADD COLUMN totp_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN totp_issuer TEXT',
      'ALTER TABLE passwords ADD COLUMN totp_algorithm TEXT',
      'ALTER TABLE passwords ADD COLUMN totp_digits INTEGER',
      'ALTER TABLE passwords ADD COLUMN totp_period INTEGER',
      'ALTER TABLE passwords ADD COLUMN encrypted_notes TEXT',
      'ALTER TABLE passwords ADD COLUMN notes_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN encrypted_passkey_meta TEXT',
      'ALTER TABLE passwords ADD COLUMN passkey_meta_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN encrypted_card_details TEXT',
      'ALTER TABLE passwords ADD COLUMN card_details_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN encrypted_identity_details TEXT',
      'ALTER TABLE passwords ADD COLUMN identity_details_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN encrypted_alias_details TEXT',
      'ALTER TABLE passwords ADD COLUMN alias_details_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN encrypted_history TEXT',
      'ALTER TABLE passwords ADD COLUMN history_iv TEXT',
      'ALTER TABLE passwords ADD COLUMN favorite INTEGER DEFAULT 0',
    ]);
  });

  it('skips migrations for columns already present in existing databases', async () => {
    sqlMock.tableInfoResults.push([{
      values: [
        [0, 'encrypted_title', 'TEXT', 0, null, 0],
        [1, 'title_iv', 'TEXT', 0, null, 0],
        [2, 'favorite', 'INTEGER', 0, 0, 0],
      ],
    }]);
    const migrated = new SQLiteOPFS('unit_vault');
    await migrated.open();
    const migratedSqlite = sqlMock.dbInstances[0];

    expect(migratedSqlite.run).not.toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN encrypted_title'));
    expect(migratedSqlite.run).not.toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN title_iv'));
    expect(migratedSqlite.run).not.toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN favorite'));
    expect(migratedSqlite.run).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN encrypted_username'));
  });

  it('writes password rows and parses JSON columns on reads', async () => {
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];
    sqlite.rows = [
      {
        id: '1',
        title: "Ada's Login",
        tags: '["work"]',
        attachments: '[{"id":"file-1"}]',
        search_index: 'not-json',
        deleted_at: '2026-05-01T00:00:00.000Z',
        favorite: '1',
      },
    ];

    db.putPassword({
      id: "row'1",
      title: "Ada's Login",
      tags: ['work'],
      attachments: [{ id: 'file-1' }],
      favorite: true,
      deletedAt: '2026-05-01T00:00:00.000Z',
    });
    const insertStmt = sqlMock.stmtInstances.at(-1);
    const rows = db.getAllPasswords();
    const row = db.getPassword('1');

    expect(sqlite.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO passwords'));
    expect(insertStmt?.bind).toHaveBeenCalledWith(expect.arrayContaining(["row'1", "Ada's Login"]));
    expect(insertStmt?.run).toHaveBeenCalled();
    expect(insertStmt?.free).toHaveBeenCalled();
    expect(rows[0]).toEqual(expect.objectContaining({
      id: '1',
      tags: ['work'],
      attachments: [{ id: 'file-1' }],
      search_index: [],
      deletedAt: '2026-05-01T00:00:00.000Z',
      favorite: true,
    }));
    expect(row?.favorite).toBe(true);
    expect(sqlMock.stmtInstances.at(-1)?.bind).toHaveBeenCalledWith(['1']);
  });

  it('parses valid password JSON fields and normalizes false favorites', async () => {
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];
    sqlite.rows = [
      {
        id: '2',
        title: 'Reader',
        tags: '["personal","finance"]',
        attachments: '[{"id":"receipt"}]',
        search_index: '["reader","finance"]',
        favorite: 0,
      },
    ];

    const [row] = db.getAllPasswords();
    const selected = db.getPassword('2');

    expect(row.tags).toEqual(['personal', 'finance']);
    expect(row.attachments).toEqual([{ id: 'receipt' }]);
    expect(row.search_index).toEqual(['reader', 'finance']);
    expect(row.favorite).toBe(false);
    expect(selected?.search_index).toEqual(['reader', 'finance']);
  });

  it('normalizes boolean favorites and fallback JSON values from password reads', async () => {
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];
    sqlite.rows = [
      {
        id: '3',
        title: 'Boolean Favorite',
        tags: undefined,
        attachments: undefined,
        search_index: undefined,
        favorite: true,
      },
    ];

    const [row] = db.getAllPasswords();
    const selected = db.getPassword('3');

    expect(row.tags).toEqual([]);
    expect(row.attachments).toEqual([]);
    expect(row.search_index).toEqual([]);
    expect(row.favorite).toBe(true);
    expect(selected?.tags).toEqual([]);
    expect(selected?.attachments).toEqual([]);
    expect(selected?.search_index).toEqual([]);
    expect(selected?.favorite).toBe(true);
  });

  it('falls back safely when tag and attachment JSON columns are malformed', async () => {
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];
    sqlite.rows = [
      {
        id: 'malformed-json',
        title: 'Malformed JSON',
        tags: 'not-json',
        attachments: '{broken',
        search_index: '[]',
      },
    ];

    const [row] = db.getAllPasswords();
    const selected = db.getPassword('malformed-json');

    expect(row.tags).toEqual([]);
    expect(row.attachments).toEqual([]);
    expect(selected?.tags).toEqual([]);
    expect(selected?.attachments).toEqual([]);
  });

  it('writes every password persistence field in the expected order', async () => {
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];
    sqlite.run.mockClear();

    db.putPassword({
      id: 'full',
      title: 'Full Entry',
      encrypted_title: 'et',
      title_iv: 'tiv',
      username: 'ada',
      encrypted_username: 'eu',
      username_iv: 'uiv',
      encrypted_password: 'ep',
      iv: 'piv',
      category: 'Finance',
      encrypted_category: 'ec',
      category_iv: 'civ',
      website: 'https://example.test',
      encrypted_website: 'ew',
      website_iv: 'wiv',
      encrypted_tags: 'egt',
      tags_iv: 'gtiv',
      search_index: ['full', 'entry'],
      updated_at: '2026-05-24T00:00:00.000Z',
      strength: 'STRONG',
      tags: ['finance'],
      pwned_count: 2,
      favorite: true,
      attachments: [{ id: 'a1' }],
      deleted_at: '2026-05-25T00:00:00.000Z',
      totp_secret: 'secret',
      totp_iv: 'totpiv',
      totp_issuer: 'issuer',
      totp_algorithm: 'SHA1',
      totp_digits: 6,
      totp_period: 30,
      encrypted_notes: 'notes',
      notes_iv: 'niv',
      encrypted_passkey_meta: 'passkey',
      passkey_meta_iv: 'pkiv',
      encrypted_card_details: 'card',
      card_details_iv: 'cardiv',
      encrypted_identity_details: 'identity',
      identity_details_iv: 'identityiv',
      encrypted_alias_details: 'alias',
      alias_details_iv: 'aliasiv',
      encrypted_history: 'history',
      history_iv: 'historyiv',
    });

    const sql = sqlite.prepare.mock.calls.at(-1)?.[0] as string;
    const values = sqlMock.stmtInstances.at(-1)?.bind.mock.calls[0][0] as unknown[];
    expect(sql).toContain('(id, title, encrypted_title, title_iv, username, encrypted_username, username_iv');
    expect(sql).toContain('VALUES (?, ?, ?, ?, ?, ?, ?');
    expect(values).toEqual([
      'full', 'Full Entry', 'et', 'tiv', 'ada', 'eu', 'uiv',
      'ep', 'piv', 'Finance', 'ec', 'civ',
      'https://example.test', 'ew', 'wiv', 'egt', 'gtiv',
      '["full","entry"]', '2026-05-24T00:00:00.000Z', 'STRONG',
      '["finance"]', 2, 1, '[{"id":"a1"}]',
      '2026-05-25T00:00:00.000Z', 'secret', 'totpiv', 'issuer', 'SHA1', 6, 30,
      'notes', 'niv', 'passkey', 'pkiv', 'card', 'cardiv',
      'identity', 'identityiv', 'alias', 'aliasiv', 'history', 'historyiv',
    ]);
    expect(sqlMock.stmtInstances.at(-1)?.run).toHaveBeenCalled();
    expect(sqlMock.stmtInstances.at(-1)?.free).toHaveBeenCalled();
  });

  it('uses stable defaults with prepared password writes and deletes', async () => {
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];

    db.putPassword({ id: "id'1" });
    const insertStmt = sqlMock.stmtInstances.at(-1);
    db.deletePassword("id'1");
    const deleteStmt = sqlMock.stmtInstances.at(-1);

    expect(insertStmt?.bind).toHaveBeenCalledWith(expect.arrayContaining(["id'1", 'Untitled', 'General', 'GOOD']));
    expect(sqlite.prepare).toHaveBeenCalledWith('DELETE FROM passwords WHERE id = ?');
    expect(deleteStmt?.bind).toHaveBeenCalledWith(["id'1"]);
    expect(deleteStmt?.run).toHaveBeenCalled();
    expect(deleteStmt?.free).toHaveBeenCalled();
  });

  it('returns safe values and throws write errors before open', () => {
    const db = new SQLiteOPFS('closed_vault');

    expect(db.getAllPasswords()).toEqual([]);
    expect(db.getPassword('missing')).toBeNull();
    expect(db.getMetadata('missing')).toBeNull();
    expect(db.getAttachment('missing')).toBeNull();
    expect(() => db.putPassword({ id: '1' })).toThrow('Database not open');
    expect(() => db.deletePassword('1')).toThrow('Database not open');
    expect(() => db.clearPasswords()).toThrow('Database not open');
    expect(() => db.putMetadata('x', {})).toThrow('Database not open');
    expect(() => db.putAttachment('a', 'b', new Uint8Array(), new ArrayBuffer(0))).toThrow('Database not open');
    expect(() => db.deleteAttachment('a')).toThrow('Database not open');
    expect(() => db.deleteMetadata('x')).not.toThrow();
  });

  it('stores, reads, and deletes metadata', async () => {
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];
    sqlite.metadataResult = [{ values: [[JSON.stringify({ salt: 'abc' })]] }];

    db.putMetadata('main_salt', { salt: 'abc' });
    expect(db.getMetadata<{ salt: string }>('main_salt')).toEqual({ salt: 'abc' });
    db.deleteMetadata('main_salt');

    expect(sqlite.prepare).toHaveBeenCalledWith('INSERT OR REPLACE INTO vault_metadata (id, data) VALUES (?, ?)');
    expect(sqlite.prepare).toHaveBeenCalledWith('SELECT data FROM vault_metadata WHERE id = ? LIMIT 1');
    expect(sqlite.prepare).toHaveBeenCalledWith('DELETE FROM vault_metadata WHERE id = ?');
    expect(sqlMock.stmtInstances.some(stmt => stmt.bind.mock.calls.some((call: unknown[][]) => call[0]?.[0] === 'main_salt'))).toBe(true);
  });

  it('handles missing, null, malformed, and quoted metadata values', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];

    sqlite.metadataResult = [];
    expect(db.getMetadata('missing')).toBeNull();

    sqlite.metadataResult = [{ values: [[null]] }];
    expect(db.getMetadata('nullish')).toBeNull();

    sqlite.metadataResult = [{ values: [['not-json']] }];
    expect(db.getMetadata("bad'id")).toBeNull();
    db.putMetadata("quoted'id", null);
    db.deleteMetadata("quoted'id");

    expect(error).toHaveBeenCalledWith('[SQLiteOPFS] Metadata parse error:', expect.any(Error));
    expect(sqlMock.stmtInstances.some(stmt => stmt.bind.mock.calls.some((call: unknown[][]) => call[0]?.[0] === "quoted'id"))).toBe(true);
    error.mockRestore();
  });

  it('stores and retrieves attachments through prepared statements', async () => {
    const db = new SQLiteOPFS('unit_vault');
    await db.open();

    db.putAttachment('att-1', 'entry-1', new Uint8Array([1, 2]), new Uint8Array([3, 4]).buffer);
    const attachment = db.getAttachment('att-1');
    db.deleteAttachment('att-1');

    expect(sqlMock.stmtInstances.find(stmt => stmt.run.mock.calls.length > 0)?.run)
      .toHaveBeenCalledWith(['att-1', 'entry-1', new Uint8Array([1, 2]), new Uint8Array([3, 4])]);
    expect(attachment).toEqual({
      iv: new Uint8Array([1, 2]),
      encrypted_data: new Uint8Array([3, 4]),
    });
  });

  it('returns null for missing attachments and escapes attachment deletes', async () => {
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];
    sqlite.attachmentResult = [];

    expect(db.getAttachment("missing'id")).toBeNull();
    db.deleteAttachment("missing'id");

    expect(sqlMock.stmtInstances.at(-1)?.bind).toHaveBeenCalledWith(["missing'id"]);
    expect(sqlMock.stmtInstances.at(-1)?.run).toHaveBeenCalled();
    expect(sqlMock.stmtInstances.at(-1)?.free).toHaveBeenCalled();
    expect(sqlite.prepare).toHaveBeenCalledWith('DELETE FROM attachments WHERE id = ?');
  });

  it('debounces scheduled writes and skips flushes when clean', async () => {
    vi.useFakeTimers();
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];
    sqlite.export.mockClear();

    await db.flushToOPFS();
    expect(sqlite.export).not.toHaveBeenCalled();

    db.putMetadata('one', { value: 1 });
    db.putMetadata('two', { value: 2 });
    expect(sqlite.export).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(499);
    expect(sqlite.export).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(sqlite.export).toHaveBeenCalledTimes(1);
  });

  it('does not persist when no database is open', async () => {
    const db = new SQLiteOPFS('closed_vault');

    await expect(db.persistToOPFS()).resolves.toBeUndefined();
    await expect(db.flushToOPFS()).resolves.toBeUndefined();

    expect(sqlMock.dbInstances).toHaveLength(0);
  });

  it('flushes dirty writes during close before releasing the database', async () => {
    vi.useFakeTimers();
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];
    sqlite.export.mockClear();

    db.deleteMetadata('session');
    await db.close();

    expect(sqlite.export).toHaveBeenCalledTimes(1);
    expect(sqlite.close).toHaveBeenCalled();
    expect(db.isOpen).toBe(false);
  });

  it('flushes scheduled writes, wipes all tables, and closes the db', async () => {
    vi.useFakeTimers();
    const { root } = installOPFSMock();
    const db = new SQLiteOPFS('unit_vault');
    await db.open();
    const sqlite = sqlMock.dbInstances[0];

    db.clearPasswords();
    await db.flushToOPFS();
    await db.wipeAll();
    await db.close();

    expect(sqlite.run).toHaveBeenCalledWith('DELETE FROM passwords');
    expect(sqlite.run).toHaveBeenCalledWith('DELETE FROM vault_metadata');
    expect(sqlite.run).toHaveBeenCalledWith('DELETE FROM attachments');
    expect(root.removeEntry).toHaveBeenCalledWith('unit_vault.sqlite');
    expect(sqlite.close).toHaveBeenCalled();
    expect(db.isOpen).toBe(false);
  });

  it('wipes persisted OPFS file even when database was never opened', async () => {
    const { root } = installOPFSMock();
    const db = new SQLiteOPFS('closed_vault');

    await db.wipeAll();
    await expect(db.close()).resolves.toBeUndefined();

    expect(root.removeEntry).toHaveBeenCalledWith('closed_vault.sqlite');
    expect(db.isOpen).toBe(false);
  });
});
