import { beforeEach, describe, expect, it, vi } from 'vitest';

const argon2Mock = vi.hoisted(() => ({
  deriveHex: vi.fn(async ({ password, salt }: { password: string; salt: Uint8Array }) => (
    `argon:${password}:${Array.from(salt).join('-')}`
  )),
  deriveBinary: vi.fn(async () => new Uint8Array(32).fill(7)),
}));

vi.mock('../../src/lib/Argon2WorkerService', () => ({
  Argon2WorkerService: argon2Mock,
}));

import { VaultAuthService, StoredCredential } from '../../src/lib/vault/VaultAuthService';

describe('VaultAuthService', () => {
  beforeEach(() => {
    argon2Mock.deriveHex.mockClear();
    argon2Mock.deriveBinary.mockClear();
  });

  it('calibrates Argon2 parameters from browser hardware hints', () => {
    Object.defineProperty(navigator, 'deviceMemory', {
      configurable: true,
      value: 2,
    });
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 8,
    });

    expect(VaultAuthService.calibrateArgon2Params()).toEqual({
      iterations: 3,
      memorySize: 46080,
      parallelism: 2,
      hashLength: 32,
    });
  });

  it('compares hashes without accepting unequal values', () => {
    expect(VaultAuthService.timingSafeEqual('abc123', 'abc123')).toBe(true);
    expect(VaultAuthService.timingSafeEqual('abc123', 'abc124')).toBe(false);
    expect(VaultAuthService.timingSafeEqual('abc123', 'abc1234')).toBe(false);
  });

  it('creates and verifies Argon2 credentials', async () => {
    const params = { iterations: 4, memorySize: 65536, parallelism: 1, hashLength: 32 };
    const credential = await VaultAuthService.createAuthCredential('master-password', params);

    expect(credential.scheme).toBe('argon2id-v1');
    expect(credential.argon2).toEqual(params);
    await expect(VaultAuthService.verifyPassword('master-password', credential, params)).resolves.toBe(true);
    await expect(VaultAuthService.verifyPassword('wrong-password', credential, params)).resolves.toBe(false);
  });

  it('verifies legacy PBKDF2 credentials', async () => {
    const salt = new Uint8Array([1, 2, 3, 4]);
    const verificationHash = await VaultAuthService.hashPasswordPBKDF2('legacy-password', salt, 1000);
    const credential: StoredCredential = {
      scheme: 'pbkdf2-sha256',
      verificationHash,
      salt: btoa(String.fromCharCode(...salt)),
      iterations: 1000,
    };
    const params = { iterations: 4, memorySize: 65536, parallelism: 1, hashLength: 32 };

    await expect(VaultAuthService.verifyPassword('legacy-password', credential, params)).resolves.toBe(true);
    await expect(VaultAuthService.verifyPassword('bad-password', credential, params)).resolves.toBe(false);
  });

  it('derives an AES master key and preserves supplied salt', async () => {
    const salt = btoa(String.fromCharCode(...new Uint8Array(16).fill(3)));
    const params = { iterations: 4, memorySize: 65536, parallelism: 1, hashLength: 32 };

    const result = await VaultAuthService.deriveMasterKey({
      password: 'master-password',
      secretKey: 'secret-key',
      saltB64: salt,
      params,
    });

    expect(result.saltB64).toBe(salt);
    expect(result.sensitiveMaterial).toHaveLength(32);
    expect(result.aesKey.type).toBe('secret');
    expect(argon2Mock.deriveBinary).toHaveBeenCalledWith(expect.objectContaining({
      password: 'master-password',
      salt: expect.any(Uint8Array),
      hashLength: 32,
    }));
  });

  it('uses stored random HKDF salt for v3 keys while keeping legacy zero-salt compatibility explicit', async () => {
    const salt = btoa(String.fromCharCode(...new Uint8Array(16).fill(3)));
    const params = { iterations: 4, memorySize: 65536, parallelism: 1, hashLength: 32 };

    const fresh = await VaultAuthService.deriveMasterKey({
      password: 'master-password',
      secretKey: 'secret-key',
      saltB64: salt,
      params,
    });
    const zeroHkdfSalt = btoa(String.fromCharCode(...new Uint8Array(32)));

    expect(fresh.hkdfSaltB64).toBeTruthy();
    expect(fresh.hkdfSaltB64).not.toBe(zeroHkdfSalt);

    const restored = await VaultAuthService.deriveMasterKey({
      password: 'master-password',
      secretKey: 'secret-key',
      saltB64: salt,
      hkdfSaltB64: fresh.hkdfSaltB64,
      params,
    });
    expect(restored.hkdfSaltB64).toBe(fresh.hkdfSaltB64);

    const legacy = await VaultAuthService.deriveMasterKey({
      password: 'master-password',
      secretKey: 'secret-key',
      saltB64: salt,
      params,
      allowLegacyZeroHkdfSalt: true,
    });
    expect(legacy.hkdfSaltB64).toBeUndefined();
  });
});
