import { describe, expect, it, vi } from 'vitest';
import { decryptData, encryptData } from '../../src/lib/backupCrypto';
import { VaultCryptoService } from '../../src/lib/vault/VaultCryptoService';

async function createAesKey() {
  return window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

describe('backup crypto', () => {
  it('encrypts and decrypts backup payloads', async () => {
    const encrypted = await encryptData('{"secret":"value"}', 'correct horse battery staple');

    expect(encrypted.data).not.toContain('secret');
    await expect(decryptData(encrypted.data, encrypted.salt, encrypted.iv, 'correct horse battery staple'))
      .resolves.toBe('{"secret":"value"}');
  });

  it('rejects incorrect backup passwords', async () => {
    localStorage.setItem('aegis_language', 'en');
    const encrypted = await encryptData('classified', 'right-password');

    await expect(decryptData(encrypted.data, encrypted.salt, encrypted.iv, 'wrong-password'))
      .rejects.toThrow('Password is incorrect or the backup file is corrupted.');
  });

  it('returns localized encryption errors when encryption fails', async () => {
    localStorage.setItem('aegis_language', 'en');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window.crypto.subtle, 'encrypt').mockRejectedValue(new Error('crypto unavailable'));

    await expect(encryptData('classified', 'backup-password'))
      .rejects.toThrow('Encryption failed.');
  });
});

describe('vault crypto service', () => {
  it('scores password strength predictably', () => {
    expect(VaultCryptoService.calculateStrength('')).toBe(0);
    expect(VaultCryptoService.calculateStrength('short')).toBeLessThan(50);
    expect(VaultCryptoService.calculateStrength('Longer-Password-123')).toBe(100);
  });

  it('scores password strength at length and character-class boundaries', () => {
    expect(VaultCryptoService.calculateStrength('12345678')).toBe(15);
    expect(VaultCryptoService.calculateStrength('123456789')).toBe(35);
    expect(VaultCryptoService.calculateStrength('123456789012')).toBe(35);
    expect(VaultCryptoService.calculateStrength('1234567890123')).toBe(55);
    expect(VaultCryptoService.calculateStrength('abcdefghi')).toBe(35);
    expect(VaultCryptoService.calculateStrength('ABCDEFGHI')).toBe(35);
    expect(VaultCryptoService.calculateStrength('abcdefghi!')).toBe(50);
    expect(VaultCryptoService.calculateStrength('Aa1!Aa1!')).toBe(60);
    expect(VaultCryptoService.calculateStrength('Aa1!Aa1!Z')).toBe(80);
  });

  it('generates passwords using persisted generator settings', () => {
    localStorage.setItem('aegis_gen_length', '24');
    localStorage.setItem('aegis_gen_symbols', 'false');

    const password = VaultCryptoService.generateSecurePassword();

    expect(password).toHaveLength(24);
    expect(password).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('falls back to a default generator charset when all persisted character groups are disabled', () => {
    localStorage.setItem('aegis_gen_length', '12');
    localStorage.setItem('aegis_gen_uppercase', 'false');
    localStorage.setItem('aegis_gen_lowercase', 'false');
    localStorage.setItem('aegis_gen_numbers', 'false');
    localStorage.setItem('aegis_gen_symbols', 'false');

    const password = VaultCryptoService.generateSecurePassword();

    expect(password).toHaveLength(12);
    expect(password).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('honors individual password generator character group settings', () => {
    localStorage.setItem('aegis_gen_length', '18');
    localStorage.setItem('aegis_gen_uppercase', 'false');
    localStorage.setItem('aegis_gen_numbers', 'false');
    localStorage.setItem('aegis_gen_symbols', 'false');

    expect(VaultCryptoService.generateSecurePassword()).toMatch(/^[a-z]{18}$/);

    localStorage.setItem('aegis_gen_uppercase', 'false');
    localStorage.setItem('aegis_gen_lowercase', 'false');
    localStorage.setItem('aegis_gen_numbers', 'true');
    localStorage.setItem('aegis_gen_symbols', 'false');

    expect(VaultCryptoService.generateSecurePassword()).toMatch(/^[0-9]{18}$/);
  });

  it('uses the Math.random fallback when crypto random generation fails', () => {
    const getRandomValues = vi.spyOn(window.crypto, 'getRandomValues');
    getRandomValues.mockImplementation(() => {
      throw new Error('rng unavailable');
    });
    const mathRandom = vi.spyOn(Math, 'random').mockReturnValue(0);

    const password = VaultCryptoService.generateSecurePassword();

    expect(password).toBe('a'.repeat(16));
    expect(mathRandom).toHaveBeenCalled();
  });

  it('encrypts and decrypts AES-GCM text fields', async () => {
    const key = await createAesKey();
    const encrypted = await VaultCryptoService.encryptTextField(key, 'vault secret');

    expect(encrypted.encrypted).not.toContain('vault secret');
    expect(encrypted.iv).toHaveLength(24);
    await expect(VaultCryptoService.decryptTextField(key, encrypted.encrypted, encrypted.iv))
      .resolves.toBe('vault secret');
  });

  it('decrypts legacy base64 AES-GCM field payloads', async () => {
    const key = await createAesKey();
    const iv = new Uint8Array(12).fill(3);
    const plainBytes = new TextEncoder().encode('legacy payload');
    const cipher = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plainBytes
    );
    const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

    await expect(VaultCryptoService.decryptTextField(
      key,
      toBase64(new Uint8Array(cipher)),
      toBase64(iv),
    )).resolves.toBe('legacy payload');
  });

  it('encrypts empty text fields as decryptable empty strings', async () => {
    const key = await createAesKey();
    const encrypted = await VaultCryptoService.encryptTextField(key, '');

    await expect(VaultCryptoService.decryptTextField(key, encrypted.encrypted, encrypted.iv))
      .resolves.toBe('');
  });

  it('returns null or rejects when AES field material is unavailable or invalid', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(VaultCryptoService.encryptTextField(null, 'secret'))
      .rejects.toThrow('Vault key unavailable');
    await expect(VaultCryptoService.decryptTextField(null, 'abcd', 'abcd')).resolves.toBeNull();
    await expect(VaultCryptoService.decryptTextField(await createAesKey(), 'not-base64!', 'still-not-base64!'))
      .resolves.toBeNull();
  });

  it('encrypts and decrypts JSON payloads and rejects invalid JSON', async () => {
    const key = await createAesKey();
    const encrypted = await VaultCryptoService.encryptJSON(key, {
      number: '4111111111111111',
      label: 'Work card',
    });

    expect(encrypted).not.toBeNull();
    await expect(VaultCryptoService.decryptJSON(key, encrypted!.encrypted, encrypted!.iv))
      .resolves.toEqual({ number: '4111111111111111', label: 'Work card' });
    await expect(VaultCryptoService.encryptJSON(key, null)).resolves.toBeNull();

    const textOnly = await VaultCryptoService.encryptTextField(key, 'plain text');
    await expect(VaultCryptoService.decryptJSON(key, textOnly.encrypted, textOnly.iv)).resolves.toBeNull();
    await expect(VaultCryptoService.decryptJSON(key)).resolves.toBeNull();
  });

  it('encrypts and authenticates ChaCha20 text fields with a raw key', async () => {
    localStorage.setItem('aegis_cipher_suite', 'CHACHA20-POLY1305');
    const rawKey = new Uint8Array(32).fill(7);

    const encrypted = await VaultCryptoService.encryptTextField(null, 'stream secret', rawKey);

    expect(encrypted.encrypted).not.toContain('stream secret');
    await expect(VaultCryptoService.decryptTextField(null, encrypted.encrypted, encrypted.iv, rawKey))
      .resolves.toBe('stream secret');
  });

  it('encrypts and decrypts ChaCha20 payloads that span multiple blocks', async () => {
    localStorage.setItem('aegis_cipher_suite', 'CHACHA20-POLY1305');
    const rawKey = new Uint8Array(32).fill(11);
    const longText = 'vault-block-'.repeat(12);

    const encrypted = await VaultCryptoService.encryptTextField(null, longText, rawKey);

    expect(encrypted.iv).toHaveLength(24);
    await expect(VaultCryptoService.decryptTextField(null, encrypted.encrypted, encrypted.iv, rawKey))
      .resolves.toBe(longText);
  });

  it('rejects tampered or undersized ChaCha20 payloads', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('aegis_cipher_suite', 'CHACHA20-POLY1305');
    const rawKey = new Uint8Array(32).fill(9);
    const encrypted = await VaultCryptoService.encryptTextField(null, 'integrity checked', rawKey);
    const tampered = `${encrypted.encrypted.slice(0, -2)}00`;

    await expect(VaultCryptoService.decryptTextField(null, tampered, encrypted.iv, rawKey)).resolves.toBeNull();
    await expect(VaultCryptoService.decryptTextField(null, 'abcd', encrypted.iv, rawKey)).resolves.toBeNull();
  });
});
