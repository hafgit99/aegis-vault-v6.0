/**
 * SQLiteOPFS — sql.js (SQLite-WASM) + OPFS persistence layer.
 * 
 * Architecture:
 * 1. InMemory SQLite db using sql.js
 * 2. Persistent storage as .sqlite file on browser's OPFS (Origin Private File System)
 * 3. Saves to OPFS after every write operation
 */
import initSqlJs, { type Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export type SQLitePasswordRow = Record<string, any> & {
  id: string;
  title: string;
  updated_at?: string;
  deleted_at?: string | null;
  favorite?: number | boolean;
};

type SQLiteColumnInfoRow = [number, string, string, number, unknown, number];

const normalizeSQLiteBoolean = (value: unknown): boolean =>
  value === true || value === 1 || value === '1';

// ─────────────────────────────────────────────────────────────────
// OPFS Helpers
// ─────────────────────────────────────────────────────────────────

/** Is OPFS available in current browser? */
export function isOPFSAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.storage &&
    'getDirectory' in navigator.storage
  );
}

/** Read file from OPFS (returns null if not found) */
async function readOPFSFile(filename: string): Promise<Uint8Array | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null; 
  }
}

/** Write file to OPFS */
async function writeOPFSFile(filename: string, data: Uint8Array): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([Uint8Array.from(data)]));
  await writable.close();
}

/** Delete file from OPFS */
export async function deleteOPFSFile(filename: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(filename);
  } catch {
    // Already deleted
  }
}

/** Delete all OPFS files (for reset / factory settings) */
export async function clearAllOPFSFiles(): Promise<void> {
  if (!isOPFSAvailable()) return;
  try {
    const root = await navigator.storage.getDirectory();
    // @ts-expect-error entries async iterator is not modeled on all TS lib versions
    for await (const [name] of root.entries()) {
      if (name.endsWith('.sqlite')) {
        await root.removeEntry(name);
        console.log(`[OPFS] Deleted: ${name}`);
      }
    }
  } catch (error) {
    console.warn('[OPFS] Top-level clear error:', error);
  }
}

// ─────────────────────────────────────────────────────────────────
// SQL Schema definition
// ─────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS passwords (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled',
  encrypted_title TEXT,
  title_iv TEXT,
  username TEXT DEFAULT '',
  encrypted_username TEXT,
  username_iv TEXT,
  encrypted_password TEXT,
  iv TEXT,
  category TEXT DEFAULT 'General',
  encrypted_category TEXT,
  category_iv TEXT,
  website TEXT DEFAULT '',
  encrypted_website TEXT,
  website_iv TEXT,
  encrypted_tags TEXT,
  tags_iv TEXT,
  search_index TEXT DEFAULT '[]',
  updated_at TEXT,
  strength TEXT DEFAULT 'GOOD',
  tags TEXT DEFAULT '[]',
  pwned_count INTEGER DEFAULT 0,
  favorite INTEGER DEFAULT 0,
  attachments TEXT DEFAULT '[]',
  deleted_at TEXT,
  totp_secret TEXT,
  totp_iv TEXT,
  totp_issuer TEXT,
  totp_algorithm TEXT,
  totp_digits INTEGER,
  totp_period INTEGER,
  encrypted_notes TEXT,
  notes_iv TEXT,
  encrypted_passkey_meta TEXT,
  passkey_meta_iv TEXT,
  encrypted_card_details TEXT,
  card_details_iv TEXT,
  encrypted_identity_details TEXT,
  identity_details_iv TEXT,
  encrypted_alias_details TEXT,
  alias_details_iv TEXT,
  encrypted_history TEXT,
  history_iv TEXT
);

CREATE TABLE IF NOT EXISTS vault_metadata (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  entry_id TEXT,
  iv BLOB,
  encrypted_data BLOB
);

CREATE INDEX IF NOT EXISTS idx_passwords_category ON passwords(category);
CREATE INDEX IF NOT EXISTS idx_passwords_title ON passwords(title);
`;

// ─────────────────────────────────────────────────────────────────
// SQLiteOPFS Class
// ─────────────────────────────────────────────────────────────────

export class SQLiteOPFS {
  private db: Database | null = null;
  private dbFilename: string;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private isDirty = false;

  constructor(dbName: string = 'aegis_vault') {
    this.dbFilename = `${dbName}.sqlite`;
  }

  /** Open Database — loads from OPFS or creates new */
  async open(): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: () => sqlWasmUrl,
    });

    // Try loading existing file from OPFS
    const existingData = await readOPFSFile(this.dbFilename);

    if (existingData && existingData.length > 0) {
      this.db = new SQL.Database(existingData);
      console.log(`[SQLiteOPFS] Loaded db from OPFS: ${this.dbFilename} (${existingData.length} bytes)`);
    } else {
      this.db = new SQL.Database();
      console.log(`[SQLiteOPFS] Created new database: ${this.dbFilename}`);
    }

    // Apply schema
    this.db.run(SCHEMA_SQL);

    // Schema migrations for missing columns
    const tableInfo = this.db.exec('PRAGMA table_info(passwords)');
    const existingCols =
      tableInfo.length > 0
        ? (tableInfo[0].values as SQLiteColumnInfoRow[]).map((row) => row[1])
        : [];
    
    const requiredCols: [string, string][] = [
      ['encrypted_title', 'TEXT'],
      ['title_iv', 'TEXT'],
      ['encrypted_username', 'TEXT'],
      ['username_iv', 'TEXT'],
      ['encrypted_website', 'TEXT'],
      ['website_iv', 'TEXT'],
      ['encrypted_category', 'TEXT'],
      ['category_iv', 'TEXT'],
      ['encrypted_tags', 'TEXT'],
      ['tags_iv', 'TEXT'],
      ['search_index', 'TEXT'],
      ['deleted_at', 'TEXT'],
      ['totp_secret', 'TEXT'],
      ['totp_iv', 'TEXT'],
      ['totp_issuer', 'TEXT'],
      ['totp_algorithm', 'TEXT'],
      ['totp_digits', 'INTEGER'],
      ['totp_period', 'INTEGER'],
      ['encrypted_notes', 'TEXT'],
      ['notes_iv', 'TEXT'],
      ['encrypted_passkey_meta', 'TEXT'],
      ['passkey_meta_iv', 'TEXT'],
      ['encrypted_card_details', 'TEXT'],
      ['card_details_iv', 'TEXT'],
      ['encrypted_identity_details', 'TEXT'],
      ['identity_details_iv', 'TEXT'],
      ['encrypted_alias_details', 'TEXT'],
      ['alias_details_iv', 'TEXT'],
      ['encrypted_history', 'TEXT'],
      ['history_iv', 'TEXT'],
      ['favorite', 'INTEGER DEFAULT 0'],
    ];

    for (const [col, type] of requiredCols) {
      if (!existingCols.includes(col)) {
        console.warn(`[SQLiteOPFS] Migration: Adding missing column "${col}" to passwords table`);
        this.db.run(`ALTER TABLE passwords ADD COLUMN ${col} ${type}`);
      }
    }

    this.db.run('PRAGMA journal_mode = WAL;');

    // Persist immediately on open
    await this.persistToOPFS();
  }

  /** Write database back to OPFS */
  async persistToOPFS(): Promise<void> {
    if (!this.db) return;
    const data = this.db.export();
    const uint8 = new Uint8Array(data);
    await writeOPFSFile(this.dbFilename, uint8);
    this.isDirty = false;
  }

  /** Debounced persist for quick consecutive writes */
  schedulePersist(): void {
    this.isDirty = true;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.persistToOPFS().catch(console.error);
    }, 500);
  }

  /** Force immediate write to OPFS */
  async flushToOPFS(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.isDirty) {
      await this.persistToOPFS();
    }
  }

  // ─── CRUD Passwords ───

  private sqlVal(v: unknown): string {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  }

  putPassword(entry: Record<string, any>): void {
    if (!this.db) throw new Error('Database not open');

    const tags = JSON.stringify(entry.tags || []);
    const attachments = JSON.stringify(entry.attachments || []);

    const columns = [
      'id', 'title', 'encrypted_title', 'title_iv', 'username', 'encrypted_username', 'username_iv',
      'encrypted_password', 'iv', 'category', 'encrypted_category', 'category_iv', 'website',
      'encrypted_website', 'website_iv', 'encrypted_tags', 'tags_iv', 'search_index', 'updated_at',
      'strength', 'tags', 'pwned_count', 'favorite', 'attachments', 'deleted_at', 'totp_secret',
      'totp_iv', 'totp_issuer', 'totp_algorithm', 'totp_digits', 'totp_period', 'encrypted_notes',
      'notes_iv', 'encrypted_passkey_meta', 'passkey_meta_iv', 'encrypted_card_details',
      'card_details_iv', 'encrypted_identity_details', 'identity_details_iv', 'encrypted_alias_details',
      'alias_details_iv', 'encrypted_history', 'history_iv',
    ];
    const values = [
      entry.id,
      entry.title || 'Untitled',
      entry.encrypted_title || null,
      entry.title_iv || null,
      entry.username || '',
      entry.encrypted_username || null,
      entry.username_iv || null,
      entry.encrypted_password || null,
      entry.iv || null,
      entry.category || 'General',
      entry.encrypted_category || null,
      entry.category_iv || null,
      entry.website || '',
      entry.encrypted_website || null,
      entry.website_iv || null,
      entry.encrypted_tags || null,
      entry.tags_iv || null,
      JSON.stringify(entry.search_index || []),
      entry.updated_at || new Date().toISOString(),
      entry.strength || 'GOOD',
      tags,
      entry.pwned_count || 0,
      entry.favorite ? 1 : 0,
      attachments,
      entry.deletedAt || entry.deleted_at || null,
      entry.totp_secret || null,
      entry.totp_iv || null,
      entry.totp_issuer || null,
      entry.totp_algorithm || null,
      entry.totp_digits || null,
      entry.totp_period || null,
      entry.encrypted_notes || null,
      entry.notes_iv || null,
      entry.encrypted_passkey_meta || null,
      entry.passkey_meta_iv || null,
      entry.encrypted_card_details || null,
      entry.card_details_iv || null,
      entry.encrypted_identity_details || null,
      entry.identity_details_iv || null,
      entry.encrypted_alias_details || null,
      entry.alias_details_iv || null,
      entry.encrypted_history || null,
      entry.history_iv || null,
    ];
    const stmt = this.db.prepare(`INSERT OR REPLACE INTO passwords (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
    try {
      stmt.bind(values);
      stmt.run();
    } finally {
      stmt.free();
    }
    this.schedulePersist();
  }

  getAllPasswords(): SQLitePasswordRow[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM passwords');
    const results: SQLitePasswordRow[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as SQLitePasswordRow;
      // Parse JSON columns
      try {
        row.tags = JSON.parse(String(row.tags || '[]'));
      } catch {
        row.tags = [];
      }
      try {
        row.attachments = JSON.parse(String(row.attachments || '[]'));
      } catch {
        row.attachments = [];
      }
      try {
        row.search_index = JSON.parse(String(row.search_index || '[]'));
      } catch {
        row.search_index = [];
      }
      if (row.deleted_at) row.deletedAt = row.deleted_at;
      row.favorite = normalizeSQLiteBoolean(row.favorite);
      results.push(row);
    }
    stmt.free();
    return results;
  }

  getPassword(id: string): SQLitePasswordRow | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT * FROM passwords WHERE id = ?');
    stmt.bind([id]);
    let result: SQLitePasswordRow | null = null;
    if (stmt.step()) {
      result = stmt.getAsObject() as SQLitePasswordRow;
      try {
        result.tags = JSON.parse(String(result.tags || '[]'));
      } catch {
        result.tags = [];
      }
      try {
        result.attachments = JSON.parse(String(result.attachments || '[]'));
      } catch {
        result.attachments = [];
      }
      try {
        result.search_index = JSON.parse(String(result.search_index || '[]'));
      } catch {
        result.search_index = [];
      }
      if (result.deleted_at) result.deletedAt = result.deleted_at;
      result.favorite = normalizeSQLiteBoolean(result.favorite);
    }
    stmt.free();
    return result;
  }

  deletePassword(id: string): void {
    if (!this.db) throw new Error('Database not open');
    this.db.run(`DELETE FROM passwords WHERE id = ${this.sqlVal(id)}`);
    this.schedulePersist();
  }

  clearPasswords(): void {
    if (!this.db) throw new Error('Database not open');
    this.db.run('DELETE FROM passwords');
    this.schedulePersist();
  }

  // ─── CRUD Metadata ───

  putMetadata<T>(id: string, data: T): void {
    if (!this.db) throw new Error('Database not open');
    const val = data === null ? null : JSON.stringify(data);
    this.db.run(
      `INSERT OR REPLACE INTO vault_metadata (id, data) VALUES (${this.sqlVal(id)}, ${this.sqlVal(val)})`
    );
    this.schedulePersist();
  }

  getMetadata<T = Record<string, unknown>>(id: string): T | null {
    if (!this.db) return null;
    const sql = `SELECT data FROM vault_metadata WHERE id = ${this.sqlVal(id)}`;
    const resultArr = this.db.exec(sql);
    if (resultArr.length > 0 && resultArr[0].values.length > 0) {
      try {
        const val = resultArr[0].values[0][0];
        return val ? (JSON.parse(val as string) as T) : null;
      } catch (error) {
        console.error('[SQLiteOPFS] Metadata parse error:', error);
        return null;
      }
    }
    return null;
  }

  deleteMetadata(id: string): void {
    if (!this.db) return;
    this.db.run(`DELETE FROM vault_metadata WHERE id = ${this.sqlVal(id)}`);
    this.schedulePersist();
  }

  // ─── CRUD Attachments ───

  putAttachment(id: string, entryId: string, iv: Uint8Array, encryptedData: ArrayBuffer): void {
    if (!this.db) throw new Error('Database not open');
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO attachments (id, entry_id, iv, encrypted_data) VALUES (?, ?, ?, ?)'
    );
    stmt.run([id, entryId, iv, new Uint8Array(encryptedData)]);
    stmt.free();
    this.schedulePersist();
  }

  getAttachment(id: string): { iv: Uint8Array; encrypted_data: Uint8Array } | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT iv, encrypted_data FROM attachments WHERE id = ?');
    stmt.bind([id]);
    let result: { iv: Uint8Array; encrypted_data: Uint8Array } | null = null;
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      result = {
        iv: new Uint8Array(row.iv as ArrayLike<number>),
        encrypted_data: new Uint8Array(row.encrypted_data as ArrayLike<number>),
      };
    }
    stmt.free();
    return result;
  }

  deleteAttachment(id: string): void {
    if (!this.db) throw new Error('Database not open');
    this.db.run(`DELETE FROM attachments WHERE id = ${this.sqlVal(id)}`);
    this.schedulePersist();
  }

  // ─── Lifecycle / Cleanup ───

  async wipeAll(): Promise<void> {
    if (this.db) {
      this.db.run('DELETE FROM passwords');
      this.db.run('DELETE FROM vault_metadata');
      this.db.run('DELETE FROM attachments');
      await this.persistToOPFS();
    }
    await deleteOPFSFile(this.dbFilename);
  }

  async close(): Promise<void> {
    await this.flushToOPFS();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  get isOpen(): boolean {
    return this.db !== null;
  }
}
