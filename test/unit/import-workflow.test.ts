import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptData } from '../../src/lib/backupCrypto';
import { parseVaultImportFile } from '../../src/lib/importWorkflow';
import { openSecureShareBundleWithReport } from '../../src/lib/secureShareBundle';
import type { ImporterLabels } from '../../src/lib/importer';
import type { VaultEntry } from '../../src/types';

vi.mock('../../src/lib/backupCrypto', () => ({
  decryptData: vi.fn(),
}));

vi.mock('../../src/lib/secureShareBundle', () => ({
  openSecureShareBundleWithReport: vi.fn(),
}));

const labels: ImporterLabels = {
  accessLogin: 'Access Login',
  login: 'Login',
  creditCard: 'Credit Card',
  secureNote: 'Secure Note',
  cryptoWalletKey: 'Crypto Wallet Key',
  passkey: 'Passkey',
  identity: 'Identity',
  idCard: 'ID Card',
  untitledImport: 'Untitled Import',
  loginTitle: 'Login',
  recordTitle: 'Record',
  international: 'International',
  notSpecified: 'Not specified',
  onePasswordRecord: '1Password Record',
};

const messages = {
  encryptedExpected: 'encrypted expected',
  secureShareExpected: 'secure share expected',
  importPasswordRequired: 'password required',
  legacyKdfConfirm: 'legacy confirm',
  legacyKdfRejected: 'legacy rejected',
  fileIsEncrypted: 'file is encrypted',
};

const file = (body: unknown, name = 'import.json') => new File(
  [typeof body === 'string' ? body : JSON.stringify(body)],
  name,
  { type: name.endsWith('.csv') ? 'text/csv' : 'application/json' }
);

const entry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: 'entry-1',
  title: 'GitHub',
  subtitle: 'octo',
  username: 'octo',
  password: 'secret',
  strength: 'EXCELLENT',
  themeColor: 'primary',
  type: 'login',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('parseVaultImportFile', () => {
  beforeEach(() => {
    vi.mocked(decryptData).mockReset();
    vi.mocked(openSecureShareBundleWithReport).mockReset();
  });

  it('decrypts modern encrypted Aegis backups without legacy confirmation', async () => {
    const parsedEntry = entry();
    vi.mocked(decryptData).mockResolvedValue(JSON.stringify([parsedEntry]));
    const confirmLegacyKdf = vi.fn();
    const onReport = vi.fn();

    const result = await parseVaultImportFile({
      file: file({
        encrypted: true,
        data: 'ciphertext',
        salt: 'salt',
        iv: 'iv',
        kdf: { algorithm: 'argon2id' },
      }),
      source: 'aegis_encrypted',
      password: ' restore-key ',
      importerLabels: labels,
      messages,
      confirmLegacyKdf,
      onReport,
    });

    expect(confirmLegacyKdf).not.toHaveBeenCalled();
    expect(onReport).toHaveBeenCalledWith(expect.objectContaining({
      encrypted: true,
      kdfAlgorithm: 'argon2id',
      legacyKdf: false,
      secureShare: false,
    }));
    expect(decryptData).toHaveBeenCalledWith('ciphertext', 'salt', 'iv', 'restore-key', { algorithm: 'argon2id' }, {
      allowLegacyPBKDF2: false,
    });
    expect(result).toEqual([parsedEntry]);
  });

  it('requires explicit approval for legacy PBKDF2 encrypted backups', async () => {
    const confirmLegacyKdf = vi.fn(() => false);

    await expect(parseVaultImportFile({
      file: file({
        encrypted: true,
        data: 'ciphertext',
        salt: 'salt',
        iv: 'iv',
      }),
      source: 'aegis_encrypted',
      password: 'restore-key',
      importerLabels: labels,
      messages,
      confirmLegacyKdf,
    })).rejects.toThrow('legacy rejected');

    expect(confirmLegacyKdf).toHaveBeenCalledWith('legacy confirm');
    expect(decryptData).not.toHaveBeenCalled();
  });

  it('imports legacy PBKDF2 encrypted backups only after explicit approval', async () => {
    const parsedEntry = entry({ id: 'legacy-entry' });
    vi.mocked(decryptData).mockResolvedValue(JSON.stringify([parsedEntry]));
    const confirmLegacyKdf = vi.fn(() => true);
    const onReport = vi.fn();

    const result = await parseVaultImportFile({
      file: file({
        encrypted: true,
        data: 'legacy-ciphertext',
        salt: 'legacy-salt',
        iv: 'legacy-iv',
        kdf: { algorithm: 'pbkdf2-sha256' },
      }, 'legacy-backup.json'),
      source: 'aegis_encrypted',
      password: ' legacy-key ',
      importerLabels: labels,
      messages,
      confirmLegacyKdf,
      onReport,
    });

    expect(confirmLegacyKdf).toHaveBeenCalledWith('legacy confirm');
    expect(onReport).toHaveBeenCalledWith({
      source: 'aegis_encrypted',
      fileName: 'legacy-backup.json',
      fileSizeKb: expect.stringMatching(/^\d+\.\d$/),
      encrypted: true,
      kdfAlgorithm: 'pbkdf2-sha256',
      legacyKdf: true,
      secureShare: false,
    });
    expect(decryptData).toHaveBeenCalledWith(
      'legacy-ciphertext',
      'legacy-salt',
      'legacy-iv',
      'legacy-key',
      { algorithm: 'pbkdf2-sha256' },
      { allowLegacyPBKDF2: true },
    );
    expect(result).toEqual([parsedEntry]);
  });

  it('opens secure share bundles only through the secure share reader', async () => {
    const sharedEntries = [entry({ id: 'shared-1', title: 'Shared' })];
    vi.mocked(openSecureShareBundleWithReport).mockResolvedValue({
      entries: sharedEntries,
      manifestChecksum: 'a'.repeat(64),
      manifestVerified: true,
    });
    const onReport = vi.fn();
    const bundle = {
      encrypted: true,
      kind: 'secure-share-bundle',
      version: '1.1',
      createdAt: '2026-05-01T00:00:00.000Z',
      kdf: { algorithm: 'argon2id' },
      itemCount: 1,
      expiresAt: '2026-06-01T00:00:00.000Z',
      data: 'bundle-data',
    };

    const result = await parseVaultImportFile({
      file: file(bundle),
      source: 'secure_share',
      password: 'share-key',
      importerLabels: labels,
      messages,
      onReport,
    });

    expect(openSecureShareBundleWithReport).toHaveBeenCalledWith(bundle, 'share-key');
    expect(onReport).toHaveBeenCalledWith(expect.objectContaining({
      source: 'secure_share',
      fileName: 'import.json',
      fileSizeKb: expect.stringMatching(/^\d+\.\d$/),
      encrypted: true,
      kdfAlgorithm: 'argon2id',
      legacyKdf: false,
      secureShare: true,
      secureShareItemCount: 1,
      secureShareExpiresAt: '2026-06-01T00:00:00.000Z',
      secureShareCreatedAt: '2026-05-01T00:00:00.000Z',
      secureShareVersion: '1.1',
      secureShareManifestChecksum: 'a'.repeat(64),
      secureShareManifestVerified: true,
    }));
    expect(decryptData).not.toHaveBeenCalled();
    expect(result).toEqual(sharedEntries);
  });

  it('rejects invalid encrypted, secure-share, password, and plain-file combinations', async () => {
    await expect(parseVaultImportFile({
      file: file({ encrypted: false, vault: [] }),
      source: 'aegis_encrypted',
      password: 'restore-key',
      importerLabels: labels,
      messages,
    })).rejects.toThrow('encrypted expected');

    await expect(parseVaultImportFile({
      file: file({ encrypted: false, data: 'ciphertext' }),
      source: 'aegis_encrypted',
      password: 'restore-key',
      importerLabels: labels,
      messages,
    })).rejects.toThrow('encrypted expected');

    await expect(parseVaultImportFile({
      file: file({ encrypted: true }),
      source: 'aegis_encrypted',
      password: 'restore-key',
      importerLabels: labels,
      messages,
    })).rejects.toThrow('encrypted expected');

    await expect(parseVaultImportFile({
      file: file({ encrypted: true, kind: 'aegis-backup', data: 'ciphertext' }),
      source: 'secure_share',
      password: 'share-key',
      importerLabels: labels,
      messages,
    })).rejects.toThrow('secure share expected');

    await expect(parseVaultImportFile({
      file: file({ encrypted: true, data: 'ciphertext' }),
      source: 'aegis_encrypted',
      password: '   ',
      importerLabels: labels,
      messages,
    })).rejects.toThrow('password required');

    await expect(parseVaultImportFile({
      file: file({ encrypted: true, data: 'ciphertext' }),
      source: 'aegis_plain',
      password: '',
      importerLabels: labels,
      messages,
    })).rejects.toThrow('file is encrypted');
  });

  it('parses plain Aegis vault arrays and wrapped vault payloads with parse evidence', async () => {
    const arrayReport = vi.fn();
    await expect(parseVaultImportFile({
      file: file([entry({ id: 'array-entry' })], 'plain-array.json'),
      source: 'aegis_plain',
      password: '',
      importerLabels: labels,
      messages,
      onReport: arrayReport,
    })).resolves.toEqual([expect.objectContaining({ id: 'array-entry' })]);
    expect(arrayReport).toHaveBeenCalledWith({
      source: 'aegis_plain',
      fileName: 'plain-array.json',
      fileSizeKb: expect.stringMatching(/^\d+\.\d$/),
      encrypted: false,
      legacyKdf: false,
      secureShare: false,
    });

    const wrappedReport = vi.fn();
    await expect(parseVaultImportFile({
      file: file({ encrypted: false, vault: [entry({ id: 'wrapped-entry' })] }, 'plain-wrapped.json'),
      source: 'aegis_plain',
      password: '',
      importerLabels: labels,
      messages,
      onReport: wrappedReport,
    })).resolves.toEqual([expect.objectContaining({ id: 'wrapped-entry' })]);
    expect(wrappedReport).toHaveBeenCalledWith(expect.objectContaining({
      source: 'aegis_plain',
      fileName: 'plain-wrapped.json',
      encrypted: false,
      legacyKdf: false,
      secureShare: false,
    }));
  });

  it('routes Bitwarden JSON, CSV fallbacks, KeePass, and generic CSV through compatible parsers', async () => {
    const bitwardenJson = await parseVaultImportFile({
      file: file({
        items: [{
          type: 1,
          name: 'GitHub',
          login: { username: 'octo', password: 'secret', uris: [{ uri: 'https://github.com' }] },
        }],
      }, 'bitwarden.json'),
      source: 'bitwarden',
      password: '',
      importerLabels: labels,
      messages,
    });

    const csvFallback = await parseVaultImportFile({
      file: file('name,username,password\nMail,ada,secret', 'bitwarden.csv'),
      source: 'bitwarden',
      password: '',
      importerLabels: labels,
      messages,
    });

    const keepass = await parseVaultImportFile({
      file: file('Group,Title,Username,Password,URL,Notes\nGeneral,Bank,ada,secret,https://bank.example,', 'keepass.csv'),
      source: 'keepass',
      password: '',
      importerLabels: labels,
      messages,
    });

    const generic = await parseVaultImportFile({
      file: file('title,username,password\nGeneric,ada,secret', 'generic.csv'),
      source: 'generic_csv',
      password: '',
      importerLabels: labels,
      messages,
    });

    expect(bitwardenJson[0]).toMatchObject({ title: 'GitHub', username: 'octo' });
    expect(csvFallback[0]).toMatchObject({ title: 'Mail', username: 'ada' });
    expect(keepass[0]).toMatchObject({ title: 'Bank', username: 'ada' });
    expect(generic[0]).toMatchObject({ title: 'Generic', username: 'ada' });
  });
});
