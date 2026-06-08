import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultEntry } from '../../src/types';

const sqliteMock = vi.hoisted(() => {
  const instances: any[] = [];
  const SQLiteOPFS = vi.fn().mockImplementation(function () {
    const db = {
      open: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      flushToOPFS: vi.fn(async () => undefined),
      wipeAll: vi.fn(async () => undefined),
      getMetadata: vi.fn(),
      putMetadata: vi.fn(),
      getAllPasswords: vi.fn(() => []),
      putPassword: vi.fn(),
      deletePassword: vi.fn(),
    };
    instances.push(db);
    return db;
  });
  return { SQLiteOPFS, instances };
});

const authMock = vi.hoisted(() => ({
  calibrateArgon2Params: vi.fn(() => ({ iterations: 4, memorySize: 65536, parallelism: 1, hashLength: 32 })),
  deriveMasterKey: vi.fn(async () => ({
    aesKey: { type: 'secret' },
    sensitiveMaterial: new Uint8Array(32).fill(9),
  })),
  createAuthCredential: vi.fn(async () => ({
    scheme: 'argon2id-v1',
    verificationHash: 'hash',
    salt: 'salt',
    argon2: { iterations: 4, memorySize: 65536, parallelism: 1, hashLength: 32 },
  })),
  verifyPassword: vi.fn(async () => true),
}));

const cryptoMock = vi.hoisted(() => ({
  encryptTextField: vi.fn(async (_key, value: string) => ({ encrypted: `enc:${value}`, iv: `iv:${value}` })),
  decryptTextField: vi.fn(async (_key, value: string) => `dec:${value}`),
  encryptJSON: vi.fn(async (_key, value: unknown) => ({ encrypted: `json:${JSON.stringify(value)}`, iv: 'json-iv' })),
  decryptJSON: vi.fn(async (_key, value: string) => ({ decodedFrom: value })),
}));

vi.mock('../../src/lib/SQLiteOPFS', () => ({
  SQLiteOPFS: sqliteMock.SQLiteOPFS,
}));

vi.mock('../../src/lib/vault/VaultAuthService', () => ({
  VaultAuthService: authMock,
}));

vi.mock('../../src/lib/vault/VaultCryptoService', () => ({
  VaultCryptoService: cryptoMock,
}));

import { VaultService } from '../../src/lib/vaultService';

const entry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: overrides.id ?? 'entry-1',
  title: overrides.title ?? 'GitHub',
  subtitle: overrides.subtitle ?? 'octo',
  username: overrides.username ?? 'octo',
  password: overrides.password ?? 'Secret123!',
  notes: overrides.notes ?? 'offline note',
  strength: overrides.strength ?? 'GOOD',
  themeColor: overrides.themeColor ?? 'secondary',
  type: overrides.type ?? 'login',
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('VaultService', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    sqliteMock.instances.length = 0;
    sqliteMock.SQLiteOPFS.mockClear();
    Object.values(authMock).forEach((mock) => mock.mockClear());
    Object.values(cryptoMock).forEach((mock) => mock.mockClear());
  });

  it('sets up a new vault and persists auth metadata', async () => {
    const service = new VaultService();

    await service.initDb('master-password', 'secret-key', true);
    const db = sqliteMock.instances[0];

    expect(sqliteMock.SQLiteOPFS).toHaveBeenCalledWith('aegis_vault');
    expect(db.open).toHaveBeenCalled();
    expect(authMock.deriveMasterKey).toHaveBeenCalledWith(expect.objectContaining({
      password: 'master-password',
      secretKey: 'secret-key',
    }));
    expect(db.putMetadata).toHaveBeenCalledWith('main_salt', expect.objectContaining({ id: 'main_salt' }));
    expect(db.putMetadata).toHaveBeenCalledWith('auth_credential', expect.objectContaining({ id: 'auth_credential' }));
    expect(db.flushToOPFS).toHaveBeenCalled();
    expect(service.isUnlocked()).toBe(true);
  });

  it('unlocks an existing vault only after verifying credentials', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    db.getMetadata.mockImplementation((key: string) => {
      if (key === 'main_salt') return { salt: 'stored-salt' };
      if (key === 'auth_credential') return { credential: { scheme: 'argon2id-v1', verificationHash: 'hash', salt: 'salt' } };
      return undefined;
    });
    sqliteMock.instances.length = 0;
    sqliteMock.SQLiteOPFS.mockImplementationOnce(function () {
      return db;
    });

    await service.initDb('master-password', 'secret-key', false);

    expect(authMock.verifyPassword).toHaveBeenCalled();
    expect(service.isConnected).toBe(true);
  });

  it('locks and rethrows when unlock metadata is missing', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    db.getMetadata.mockReturnValue(undefined);
    sqliteMock.instances.length = 0;
    sqliteMock.SQLiteOPFS.mockImplementationOnce(function () {
      return db;
    });

    await expect(service.initDb('master-password', 'secret-key', false)).rejects.toThrow();
    expect(db.close).toHaveBeenCalled();
    expect(service.isUnlocked()).toBe(false);
  });

  it('locks and rethrows when unlock password verification fails', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    db.getMetadata.mockImplementation((key: string) => {
      if (key === 'main_salt') return { salt: 'stored-salt' };
      if (key === 'auth_credential') return { credential: { scheme: 'argon2id-v1', verificationHash: 'hash', salt: 'salt' } };
      return undefined;
    });
    authMock.verifyPassword.mockResolvedValueOnce(false);
    sqliteMock.instances.length = 0;
    sqliteMock.SQLiteOPFS.mockImplementationOnce(function () {
      return db;
    });

    await expect(service.initDb('wrong-password', 'secret-key', false)).rejects.toThrow();

    expect(authMock.deriveMasterKey).toHaveBeenCalledWith(expect.objectContaining({
      password: 'wrong-password',
      saltB64: 'stored-salt',
    }));
    expect(db.close).toHaveBeenCalled();
    expect(service.isConnected).toBe(false);
    expect(service.isUnlocked()).toBe(false);
  });

  it('returns no entries when locked or missing a SQLite connection', async () => {
    const service = new VaultService();

    await expect(service.getPasswords()).resolves.toEqual([]);

    service.sqliteDb = sqliteMock.SQLiteOPFS();
    await expect(service.getPasswords()).resolves.toEqual([]);

    service.sqliteDb = null;
    (service as any).aesKey = { type: 'secret' } as CryptoKey;
    await expect(service.getPasswords()).resolves.toEqual([]);
  });

  it('maps decrypted SQLite rows into vault entries', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    (cryptoMock.decryptJSON as any)
      .mockResolvedValueOnce({
        cardholder: 'Ada Lovelace',
        cardNumber: '4111111111111111',
        expiryDate: '12/30',
        cvv: '123',
      })
      .mockResolvedValueOnce({
        idFullName: 'Grace Hopper',
        idNumber: 'ID-1',
        idSerial: 'SER-1',
        idExpiry: '2030-01-01',
        idNationality: 'US',
        idGender: 'female',
        idBirthDate: '1906-12-09',
      })
      .mockResolvedValueOnce({
        passkeyDomain: 'github.com',
        passkeyUser: 'octo@example.com',
        passkeyCredentialId: 'cred-1',
        passkeyPublicKey: 'public-key',
        passkeyAAGUID: 'aaguid-1',
      });
    (cryptoMock.decryptTextField as any)
      .mockResolvedValueOnce('dec:title-cipher')
      .mockResolvedValueOnce('dec:username-cipher')
      .mockResolvedValueOnce('dec:website-cipher')
      .mockResolvedValueOnce('dec:category-cipher')
      .mockResolvedValueOnce('dec:password-cipher')
      .mockResolvedValueOnce('dec:notes-cipher')
      .mockResolvedValueOnce('JBSWY3DPEHPK3PXP');
    db.getAllPasswords.mockReturnValue([
      {
        id: 'row-1',
        title: 'dec:title-cipher',
        username: 'dec:username-cipher',
        encrypted_title: 'title-cipher',
        title_iv: 'title-iv',
        encrypted_username: 'username-cipher',
        username_iv: 'username-iv',
        encrypted_website: 'website-cipher',
        website_iv: 'website-iv',
        encrypted_category: 'category-cipher',
        category_iv: 'category-iv',
        encrypted_password: 'password-cipher',
        iv: 'password-iv',
        encrypted_notes: 'notes-cipher',
        notes_iv: 'notes-iv',
        totp_secret: 'totp-cipher',
        totp_iv: 'totp-iv',
        totp_issuer: 'GitHub',
        totp_algorithm: 'SHA-1',
        totp_digits: 6,
        totp_period: 30,
        encrypted_card_details: 'card-cipher',
        card_details_iv: 'card-iv',
        encrypted_identity_details: 'identity-cipher',
        identity_details_iv: 'identity-iv',
        encrypted_passkey_meta: 'passkey-cipher',
        passkey_meta_iv: 'passkey-iv',
        website: 'https://github.com',
        strength: 'EXCELLENT',
        category: 'login',
        favorite: 1,
        attachments: [{ id: 'file-1', name: 'kit.pdf', size: 100, type: 'application/pdf' }],
      },
    ]);
    service.sqliteDb = db;
    (service as any).aesKey = { type: 'secret' } as CryptoKey;
    (service as any).rawKey = new Uint8Array(32);

    const entries = await service.getPasswords();

    expect(entries).toEqual([
      expect.objectContaining({
        id: 'row-1',
        title: 'dec:title-cipher',
        username: 'dec:username-cipher',
        password: 'dec:password-cipher',
        notes: 'dec:notes-cipher',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        totpIssuer: 'GitHub',
        totpAlgorithm: 'SHA-1',
        totpDigits: 6,
        totpPeriod: 30,
        url: 'dec:website-cipher',
        type: 'login',
        themeColor: 'primary',
        favorite: true,
        attachment: expect.objectContaining({ id: 'file-1' }),
        cardholder: 'Ada Lovelace',
        cardNumber: '4111111111111111',
        expiryDate: '12/30',
        cvv: '123',
        idFullName: 'Grace Hopper',
        idNumber: 'ID-1',
        idSerial: 'SER-1',
        idExpiry: '2030-01-01',
        idNationality: 'US',
        idGender: 'female',
        idBirthDate: '1906-12-09',
        passkeyDomain: 'github.com',
        passkeyUser: 'octo@example.com',
        passkeyCredentialId: 'cred-1',
        passkeyPublicKey: 'public-key',
        passkeyAAGUID: 'aaguid-1',
      }),
    ]);
  });

  it('maps rows with partial encrypted material to safe fallback fields', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    db.getAllPasswords.mockReturnValue([
      {
        id: 42,
        title: 'Partial',
        encrypted_password: 'password-without-iv',
        encrypted_notes: '',
        notes_iv: 'notes-iv',
        encrypted_card_details: 'card-without-iv',
        encrypted_identity_details: '',
        identity_details_iv: 'identity-iv',
        encrypted_passkey_meta: 'passkey-without-iv',
        website: '',
        strength: 'IMMUTABLE',
        category: '',
        favorite: 0,
        attachments: [],
        updated_at: '2026-05-23T00:00:00.000Z',
        deletedAt: '2026-05-24T00:00:00.000Z',
      },
    ]);
    service.sqliteDb = db;
    (service as any).aesKey = { type: 'secret' } as CryptoKey;

    const entries = await service.getPasswords();

    expect(cryptoMock.decryptTextField).not.toHaveBeenCalled();
    expect(cryptoMock.decryptJSON).not.toHaveBeenCalled();
    expect(entries).toEqual([
      expect.objectContaining({
        id: '42',
        title: 'Partial',
        subtitle: '',
        username: '',
        password: undefined,
        notes: undefined,
        url: '',
        strength: 'IMMUTABLE',
        themeColor: 'tertiary',
        type: 'login',
        createdAt: '2026-05-23T00:00:00.000Z',
        deletedAt: '2026-05-24T00:00:00.000Z',
        isDeleted: true,
        attachment: undefined,
        favorite: false,
      }),
    ]);
  });

  it('skips rows that fail during decryption without aborting the full list', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    cryptoMock.decryptTextField
      .mockRejectedValueOnce(new Error('bad row'))
      .mockResolvedValueOnce('dec:ok-cipher');
    db.getAllPasswords.mockReturnValue([
      {
        id: 'bad',
        title: 'Bad',
        encrypted_password: 'bad-cipher',
        iv: 'bad-iv',
      },
      {
        id: 'ok',
        title: 'Ok',
        encrypted_password: 'ok-cipher',
        iv: 'ok-iv',
        strength: 'GOOD',
        category: 'login',
      },
    ]);
    service.sqliteDb = db;
    (service as any).aesKey = { type: 'secret' } as CryptoKey;

    const entries = await service.getPasswords();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: 'ok', password: 'dec:ok-cipher' });
    expect(console.error).toHaveBeenCalledWith('Failed to decrypt row bad:', expect.any(Error));
  });

  it('encrypts and saves card entries with immutable strength', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    service.sqliteDb = db;
    (service as any).aesKey = { type: 'secret' } as CryptoKey;
    (service as any).rawKey = new Uint8Array(32);

    await service.savePassword(entry({
      type: 'card',
      cardholder: 'Ada Lovelace',
      cardNumber: '4111 1111 1111 1111',
      expiryDate: '12/30',
      cvv: '123',
      attachment: { id: 'file-1', name: 'statement.pdf', size: 2048, type: 'application/pdf' },
    }));

    expect(cryptoMock.encryptJSON).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      cardholder: 'Ada Lovelace',
      cardNumber: '4111 1111 1111 1111',
    }), expect.any(Uint8Array));
    expect(db.putPassword).toHaveBeenCalledWith(expect.objectContaining({
      id: 'entry-1',
      category: 'encrypted',
      encrypted_category: 'enc:card',
      strength: 'IMMUTABLE',
      encrypted_card_details: expect.stringContaining('json:'),
      attachments: [expect.objectContaining({ id: 'file-1' })],
    }));
    expect(db.flushToOPFS).toHaveBeenCalled();
  });

  it('persists login row details, calculated strength, and optional flush control', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    service.sqliteDb = db;
    (service as any).aesKey = { type: 'secret' } as CryptoKey;
    (service as any).rawKey = new Uint8Array(32);

    await service.savePassword(entry({
      id: 'login-good',
      title: 'Short Login',
      username: 'short-user',
      password: 'short-pass',
      notes: '',
      url: 'https://short.example',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      totpIssuer: 'GitHub',
      totpAlgorithm: 'SHA-1',
      totpDigits: 6,
      totpPeriod: 30,
      favorite: true,
      deletedAt: '2026-05-01T00:00:00.000Z',
    }), false);

    expect(db.putPassword).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'login-good',
      title: '[encrypted]',
      username: '',
      category: 'encrypted',
      website: '',
      encrypted_title: 'enc:Short Login',
      title_iv: 'iv:Short Login',
      encrypted_username: 'enc:short-user',
      username_iv: 'iv:short-user',
      encrypted_category: 'enc:login',
      category_iv: 'iv:login',
      encrypted_website: 'enc:https://short.example',
      website_iv: 'iv:https://short.example',
      strength: 'GOOD',
      favorite: 1,
      tags: [],
      pwned_count: 0,
      deleted_at: '2026-05-01T00:00:00.000Z',
      deletedAt: '2026-05-01T00:00:00.000Z',
      encrypted_password: 'enc:short-pass',
      iv: 'iv:short-pass',
      encrypted_notes: null,
      notes_iv: null,
      totp_secret: 'enc:JBSWY3DPEHPK3PXP',
      totp_iv: 'iv:JBSWY3DPEHPK3PXP',
      totp_issuer: 'GitHub',
      totp_algorithm: 'SHA-1',
      totp_digits: 6,
      totp_period: 30,
      encrypted_card_details: null,
      card_details_iv: null,
      encrypted_identity_details: null,
      identity_details_iv: null,
      encrypted_passkey_meta: null,
      passkey_meta_iv: null,
    }));
    expect(db.flushToOPFS).not.toHaveBeenCalled();

    await service.savePassword(entry({
      id: 'login-excellent',
      password: 'ThirteenChars!',
      notes: undefined,
      url: undefined,
      favorite: false,
      deletedAt: undefined,
    }));
    expect(db.putPassword).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'login-excellent',
      strength: 'EXCELLENT',
      favorite: 0,
      website: '',
      deleted_at: null,
      deletedAt: null,
    }));

    await service.savePassword(entry({
      id: 'login-immutable',
      password: 'VeryLongPassword123!',
    }));
    expect(db.putPassword).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'login-immutable',
      strength: 'IMMUTABLE',
    }));
    expect(db.flushToOPFS).toHaveBeenCalledTimes(2);
  });

  it('calculates login strength from trimmed password boundary lengths', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    service.sqliteDb = db;
    (service as any).aesKey = { type: 'secret' } as CryptoKey;

    await service.savePassword(entry({ id: 'len-12', password: '123456789012' }), false);
    expect(db.putPassword).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'len-12',
      strength: 'GOOD',
    }));

    await service.savePassword(entry({ id: 'len-13', password: '1234567890123' }), false);
    expect(db.putPassword).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'len-13',
      strength: 'EXCELLENT',
    }));

    await service.savePassword(entry({ id: 'len-16', password: '1234567890123456' }), false);
    expect(db.putPassword).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'len-16',
      strength: 'EXCELLENT',
    }));

    await service.savePassword(entry({ id: 'len-17', password: '12345678901234567' }), false);
    expect(db.putPassword).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'len-17',
      strength: 'IMMUTABLE',
    }));

    await service.savePassword(entry({ id: 'trimmed', password: '  1234567890123  ' }), false);
    expect(db.putPassword).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'trimmed',
      strength: 'EXCELLENT',
    }));
  });

  it('encrypts identity, passkey, and note-specific save payloads', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    service.sqliteDb = db;
    (service as any).aesKey = { type: 'secret' } as CryptoKey;
    (service as any).rawKey = new Uint8Array(32);

    await service.savePassword(entry({
      id: 'identity-1',
      type: 'identity',
      username: '',
      password: '',
      notes: '',
      idFullName: 'Ada Lovelace',
      idNumber: '123456789',
      idSerial: 'AB123',
      idExpiry: '01.01.2030',
      idNationality: 'TR',
      idGender: 'female',
      idBirthDate: '1815-12-10',
    }));

    expect(cryptoMock.encryptJSON).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      idFullName: 'Ada Lovelace',
      idNumber: '123456789',
      idSerial: 'AB123',
      idExpiry: '01.01.2030',
      idNationality: 'TR',
      idGender: 'female',
      idBirthDate: '1815-12-10',
    }), expect.any(Uint8Array));
    expect(db.putPassword).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'identity-1',
      username: '',
      encrypted_username: 'enc:Ada Lovelace',
      category: 'encrypted',
      encrypted_category: 'enc:identity',
      website: '',
      strength: 'IMMUTABLE',
      encrypted_identity_details: expect.stringContaining('json:'),
      identity_details_iv: 'json-iv',
      encrypted_password: null,
    }));

    await service.savePassword(entry({
      id: 'passkey-1',
      type: 'passkey',
      username: '',
      password: '',
      notes: '',
      passkeyDomain: 'github.com',
      passkeyUser: 'octo@example.com',
      passkeyCredentialId: 'cred-123',
      passkeyPublicKey: 'public-key',
      passkeyAAGUID: 'aaguid-123',
    }));

    expect(cryptoMock.encryptJSON).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      passkeyDomain: 'github.com',
      passkeyUser: 'octo@example.com',
      passkeyCredentialId: 'cred-123',
      passkeyPublicKey: 'public-key',
      passkeyAAGUID: 'aaguid-123',
    }), expect.any(Uint8Array));
    expect(db.putPassword).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'passkey-1',
      username: '',
      encrypted_username: 'enc:octo@example.com',
      category: 'encrypted',
      encrypted_category: 'enc:passkey',
      website: '',
      encrypted_website: 'enc:github.com',
      strength: 'IMMUTABLE',
      encrypted_passkey_meta: expect.stringContaining('json:'),
      passkey_meta_iv: 'json-iv',
    }));

    await service.savePassword(entry({
      id: 'note-1',
      type: 'note',
      username: '',
      password: '',
      notes: 'sealed note',
    }));

    expect(db.putPassword).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'note-1',
      category: 'encrypted',
      encrypted_category: 'enc:note',
      strength: 'IMMUTABLE',
      encrypted_notes: 'enc:sealed note',
      notes_iv: 'iv:sealed note',
      encrypted_identity_details: null,
      encrypted_passkey_meta: null,
      encrypted_card_details: null,
    }));
  });

  it('rejects saves while locked and supports delete, wipe, and lock lifecycle', async () => {
    const service = new VaultService();
    await expect(service.savePassword(entry())).rejects.toThrow();

    const db = sqliteMock.SQLiteOPFS();
    service.sqliteDb = db;

    await service.deletePassword('entry-1');
    expect(db.deletePassword).toHaveBeenCalledWith('entry-1');
    expect(db.flushToOPFS).toHaveBeenCalled();

    await service.wipeAllData();
    expect(db.wipeAll).toHaveBeenCalled();
    expect(db.close).toHaveBeenCalled();
    expect(service.isConnected).toBe(false);
  });

  it('zeroes derived raw key material and clears active secret state on lock', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    const rawKey = new Uint8Array(32).fill(7);
    service.sqliteDb = db;
    (service as any).aesKey = { type: 'secret' } as CryptoKey;
    (service as any).rawKey = rawKey;
    const secretBytes = new TextEncoder().encode('A3-SECRET-KEY');
    (service as any).activeSecretKeyBytes = secretBytes;
    service.isConnected = true;

    await service.lock();

    expect([...rawKey]).toEqual(new Array(32).fill(0));
    expect((service as any).aesKey).toBeNull();
    expect((service as any).rawKey).toBeNull();
    expect([...secretBytes]).toEqual(new Array(secretBytes.length).fill(0));
    expect((service as any).activeSecretKeyBytes).toBeNull();
    expect(db.close).toHaveBeenCalled();
    expect(service.isConnected).toBe(false);
  });

  it('ignores delete requests when there is no SQLite connection', async () => {
    const service = new VaultService();

    await expect(service.deletePassword('missing')).resolves.toBeUndefined();
  });

  it('changes the master password and persists re-key metadata', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    const oldKey = { type: 'old-secret' } as unknown as CryptoKey;
    const oldRawKey = new Uint8Array(32).fill(1);
    const newKey = { type: 'new-secret' } as unknown as CryptoKey;
    const newRawKey = new Uint8Array(32).fill(2);
    service.sqliteDb = db;
    (service as any).aesKey = oldKey;
    (service as any).rawKey = oldRawKey;
    sessionStorage.setItem('aegis_session_secret_key', 'A3-SECRET-KEY');
    db.getMetadata.mockReturnValue({ credential: { scheme: 'argon2id-v1', verificationHash: 'hash', salt: 'salt' } });
    vi.spyOn(service, 'getPasswords').mockResolvedValue([entry({ id: 'rekeyed-entry' })]);
    authMock.deriveMasterKey.mockResolvedValueOnce({
      aesKey: newKey,
      sensitiveMaterial: newRawKey,
    });

    await service.changeMasterPassword('old-password', 'new-password');

    expect(authMock.verifyPassword).toHaveBeenCalledWith(
      'old-password',
      expect.objectContaining({ verificationHash: 'hash' }),
      expect.anything(),
    );
    expect(authMock.deriveMasterKey).toHaveBeenCalledWith(expect.objectContaining({
      password: 'new-password',
    }));
    expect(db.putPassword).toHaveBeenCalledWith(expect.objectContaining({ id: 'rekeyed-entry' }));
    expect(db.putMetadata).toHaveBeenCalledWith('main_salt', expect.objectContaining({ id: 'main_salt' }));
    expect(db.putMetadata).toHaveBeenCalledWith('auth_credential', expect.objectContaining({ id: 'auth_credential' }));
    expect(db.flushToOPFS).toHaveBeenCalled();
    expect(localStorage.getItem('aegis_master_password')).toBeNull();
    expect((service as any).aesKey).toBe(newKey);
    expect((service as any).rawKey).toBe(newRawKey);
  });

  it('rejects master password changes while locked or with invalid auth state', async () => {
    const locked = new VaultService();
    await expect(locked.changeMasterPassword('old-password', 'new-password')).rejects.toThrow();

    const missingAuth = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    missingAuth.sqliteDb = db;
    (missingAuth as any).aesKey = { type: 'secret' } as CryptoKey;
    db.getMetadata.mockReturnValue(undefined);
    await expect(missingAuth.changeMasterPassword('old-password', 'new-password')).rejects.toThrow();

    const invalidOldPassword = new VaultService();
    const invalidDb = sqliteMock.SQLiteOPFS();
    invalidOldPassword.sqliteDb = invalidDb;
    (invalidOldPassword as any).aesKey = { type: 'secret' } as CryptoKey;
    invalidDb.getMetadata.mockReturnValue({ credential: { scheme: 'argon2id-v1', verificationHash: 'hash', salt: 'salt' } });
    authMock.verifyPassword.mockResolvedValueOnce(false);
    await expect(invalidOldPassword.changeMasterPassword('old-password', 'new-password')).rejects.toThrow();
  });

  it('rolls back in-memory keys when master password re-encryption fails', async () => {
    const service = new VaultService();
    const db = sqliteMock.SQLiteOPFS();
    const oldKey = { type: 'old-secret' } as unknown as CryptoKey;
    const oldRawKey = new Uint8Array(32).fill(1);
    service.sqliteDb = db;
    (service as any).aesKey = oldKey;
    (service as any).rawKey = oldRawKey;
    sessionStorage.setItem('aegis_session_secret_key', 'A3-SECRET-KEY');
    db.getMetadata.mockReturnValue({ credential: { scheme: 'argon2id-v1', verificationHash: 'hash', salt: 'salt' } });
    vi.spyOn(service, 'getPasswords').mockResolvedValue([entry({ id: 'entry-that-fails' })]);
    db.putPassword.mockImplementationOnce(() => {
      throw new Error('write failed');
    });

    await expect(service.changeMasterPassword('old-password', 'new-password')).rejects.toThrow('write failed');

    expect((service as any).aesKey).toBe(oldKey);
    expect((service as any).rawKey).toBe(oldRawKey);
  });
});

