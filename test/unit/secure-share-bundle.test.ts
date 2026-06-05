import { describe, expect, it } from 'vitest';
import { encryptData } from '../../src/lib/backupCrypto';
import { createSecureShareBundle, openSecureShareBundle, openSecureShareBundleWithReport } from '../../src/lib/secureShareBundle';
import { VaultEntry } from '../../src/types';

const entry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: overrides.id ?? 'entry-1',
  title: overrides.title ?? 'GitHub',
  subtitle: overrides.subtitle ?? 'octo@example.com',
  username: overrides.username ?? 'octo@example.com',
  password: overrides.password ?? 'StrongPassword123!',
  url: overrides.url ?? 'https://github.com',
  notes: overrides.notes ?? 'private note',
  strength: overrides.strength ?? 'EXCELLENT',
  themeColor: overrides.themeColor ?? 'tertiary',
  type: overrides.type ?? 'login',
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('secure share bundle', () => {
  it('creates a sealed offline transfer bundle and opens it with the bundle password', async () => {
    const bundle = await createSecureShareBundle(
      [entry({ title: 'Bank Login', password: 'VaultSecret123!' })],
      'bundle-password',
    );

    expect(bundle).toMatchObject({
      app: 'AegisVault',
      kind: 'secure-share-bundle',
      encrypted: true,
      version: '1.1',
      itemCount: 1,
      manifest: expect.objectContaining({
        checksumAlgorithm: 'sha-256',
        checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
        itemCount: 1,
      }),
      kdf: expect.objectContaining({ algorithm: 'argon2id' }),
    });
    expect(bundle.data).not.toContain('Bank Login');
    expect(bundle.data).not.toContain('VaultSecret123!');

    await expect(openSecureShareBundle(bundle, 'bundle-password')).resolves.toEqual([
      expect.objectContaining({
        title: 'Bank Login',
        password: 'VaultSecret123!',
        isDeleted: false,
      }),
    ]);
  });

  it('verifies v1.1 integrity manifests and keeps v1.0 legacy bundles readable', async () => {
    const bundle = await createSecureShareBundle([entry({ title: 'Shared Login' })], 'bundle-password');

    await expect(openSecureShareBundleWithReport(bundle, 'bundle-password')).resolves.toMatchObject({
      manifestChecksum: bundle.manifest?.checksum,
      manifestVerified: true,
      entries: [expect.objectContaining({ title: 'Shared Login' })],
    });

    await expect(openSecureShareBundle({
      ...bundle,
      manifest: { ...bundle.manifest!, checksum: 'b'.repeat(64) },
    }, 'bundle-password')).rejects.toThrow('integrity manifest does not match payload');

    const legacyBundle = { ...bundle, version: '1.0' as const, manifest: undefined };
    await expect(openSecureShareBundleWithReport(legacyBundle, 'bundle-password')).resolves.toMatchObject({
      manifestVerified: false,
      entries: [expect.objectContaining({ title: 'Shared Login' })],
    });
  });

  it('filters deleted records and rejects empty secure share bundles', async () => {
    const bundle = await createSecureShareBundle([
      entry({ id: 'active', title: 'Active Login' }),
      entry({ id: 'deleted', title: 'Deleted Login', isDeleted: true, deletedAt: '2026-01-01T00:00:00.000Z' }),
    ], 'bundle-password');

    expect(bundle.itemCount).toBe(1);
    await expect(openSecureShareBundle(bundle, 'bundle-password')).resolves.toEqual([
      expect.objectContaining({ id: 'active', title: 'Active Login' }),
    ]);

    await expect(createSecureShareBundle([
      entry({ isDeleted: true }),
    ], 'bundle-password')).rejects.toThrow('at least one active entry');
  });

  it('rejects wrong passwords, unsupported bundles, and expired bundles', async () => {
    const bundle = await createSecureShareBundle(
      [entry()],
      'bundle-password',
      '2000-01-01T00:00:00.000Z',
    );
    const activeBundle = await createSecureShareBundle([entry()], 'bundle-password');

    await expect(openSecureShareBundle(bundle, 'bundle-password')).rejects.toThrow('expired');
    await expect(openSecureShareBundle(activeBundle, 'wrong-password'))
      .rejects.toThrow(/Password is incorrect|Parola yanlış/);
    await expect(openSecureShareBundle({ ...bundle, kind: 'unknown' as any }, 'bundle-password'))
      .rejects.toThrow('Unsupported secure share bundle.');
  });

  it('rejects malformed metadata and payload count tampering', async () => {
    const bundle = await createSecureShareBundle([entry()], 'bundle-password');

    await expect(openSecureShareBundle({ ...bundle, version: '9.0' as any }, 'bundle-password'))
      .rejects.toThrow('Unsupported secure share bundle.');
    await expect(openSecureShareBundle({ ...bundle, createdAt: 'not-a-date' }, 'bundle-password'))
      .rejects.toThrow('metadata is invalid');
    await expect(openSecureShareBundle({
      ...bundle,
      expiresAt: 'not-a-date',
      manifest: { ...bundle.manifest!, expiresAt: 'not-a-date' },
    }, 'bundle-password'))
      .rejects.toThrow('expiry is invalid');
    await expect(openSecureShareBundle({ ...bundle, itemCount: 0 }, 'bundle-password'))
      .rejects.toThrow('metadata is invalid');
    await expect(openSecureShareBundle({
      ...bundle,
      itemCount: 2,
      manifest: { ...bundle.manifest!, itemCount: 2 },
    }, 'bundle-password'))
      .rejects.toThrow('item count does not match');
  });

  it('rejects malformed v1.1 manifest metadata before decrypting the payload', async () => {
    const bundle = await createSecureShareBundle(
      [entry()],
      'bundle-password',
      '2099-01-01T00:00:00.000Z',
    );

    await expect(openSecureShareBundle({ ...bundle, manifest: undefined }, 'bundle-password'))
      .rejects.toThrow('metadata is invalid');
    await expect(openSecureShareBundle({
      ...bundle,
      manifest: { ...bundle.manifest!, version: '1.0' as any },
    }, 'bundle-password')).rejects.toThrow('metadata is invalid');
    await expect(openSecureShareBundle({
      ...bundle,
      manifest: { ...bundle.manifest!, checksumAlgorithm: 'sha1' as any },
    }, 'bundle-password')).rejects.toThrow('metadata is invalid');
    await expect(openSecureShareBundle({
      ...bundle,
      manifest: { ...bundle.manifest!, checksum: `${bundle.manifest!.checksum}00` },
    }, 'bundle-password')).rejects.toThrow('metadata is invalid');
    await expect(openSecureShareBundle({
      ...bundle,
      manifest: { ...bundle.manifest!, checksum: bundle.manifest!.checksum.slice(1) },
    }, 'bundle-password')).rejects.toThrow('metadata is invalid');
    await expect(openSecureShareBundle({
      ...bundle,
      manifest: { ...bundle.manifest!, checksum: `z${bundle.manifest!.checksum.slice(1)}` },
    }, 'bundle-password')).rejects.toThrow('metadata is invalid');
    await expect(openSecureShareBundle({
      ...bundle,
      manifest: { ...bundle.manifest!, itemCount: bundle.itemCount + 1 },
    }, 'bundle-password')).rejects.toThrow('metadata is invalid');
    await expect(openSecureShareBundle({
      ...bundle,
      manifest: { ...bundle.manifest!, createdAt: '2099-01-01T00:00:00.000Z' },
    }, 'bundle-password')).rejects.toThrow('metadata is invalid');
    await expect(openSecureShareBundle({
      ...bundle,
      manifest: { ...bundle.manifest!, expiresAt: undefined },
    }, 'bundle-password')).rejects.toThrow('metadata is invalid');
  });

  it('rejects legacy bundles with invalid decrypted payload shapes', async () => {
    const bundle = await createSecureShareBundle([entry()], 'bundle-password');
    const sealed = await encryptData(JSON.stringify({ records: [entry()] }), 'bundle-password');
    const malformedLegacyBundle = {
      ...bundle,
      version: '1.0' as const,
      manifest: undefined,
      data: sealed.data,
      salt: sealed.salt,
      iv: sealed.iv,
      kdf: sealed.kdf,
    };

    await expect(openSecureShareBundle(malformedLegacyBundle, 'bundle-password'))
      .rejects.toThrow('payload is invalid');
  });
});
