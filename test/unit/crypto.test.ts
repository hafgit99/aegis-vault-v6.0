import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptData, encryptData } from '../../src/lib/backupCrypto';
import { invoke } from '@tauri-apps/api/core';
import {
  CLIPBOARD_CLEAR_FAILED_EVENT,
  CLIPBOARD_SENSITIVE_FLAG_FAILED_EVENT,
  writeClipboardSecret,
} from '../../src/lib/clipboard';
import { validateMasterPasswordPolicy } from '../../src/lib/passwordPolicy';
import { VaultCryptoService } from '../../src/lib/vault/VaultCryptoService';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

beforeEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
  delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

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
    expect(encrypted.kdf).toMatchObject({ algorithm: 'argon2id', memorySize: 65536 });
    await expect(decryptData(encrypted.data, encrypted.salt, encrypted.iv, 'correct horse battery staple', encrypted.kdf))
      .resolves.toBe('{"secret":"value"}');
  });

  it('rejects incorrect backup passwords', async () => {
    localStorage.setItem('aegis_language', 'en');
    const encrypted = await encryptData('classified', 'right-password');

    await expect(decryptData(encrypted.data, encrypted.salt, encrypted.iv, 'wrong-password', encrypted.kdf))
      .rejects.toThrow('Password is incorrect or the backup file is corrupted.');
  });

  it('decrypts legacy PBKDF2 backup payloads when KDF metadata is absent', async () => {
    const password = 'legacy-backup-password';
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    const key = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode('legacy backup')
    );
    const toHex = (bytes: Uint8Array | ArrayBuffer) => Array.from(new Uint8Array(bytes))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    await expect(decryptData(toHex(ciphertext), toHex(salt), toHex(iv), password, undefined, { allowLegacyPBKDF2: true }))
      .resolves.toBe('legacy backup');
  });

  it('rejects legacy PBKDF2 backup payloads until explicitly allowed', async () => {
    localStorage.setItem('aegis_language', 'en');

    await expect(decryptData('00', '00'.repeat(16), '00'.repeat(12), 'legacy-password', {
      algorithm: 'pbkdf2-sha256',
      iterations: 100000,
      hashLength: 32,
    })).rejects.toThrow('Password is incorrect or the backup file is corrupted.');
  });

  it('returns localized encryption errors when encryption fails', async () => {
    localStorage.setItem('aegis_language', 'en');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window.crypto.subtle, 'encrypt').mockRejectedValue(new Error('crypto unavailable'));

    await expect(encryptData('classified', 'backup-password'))
      .rejects.toThrow('Encryption failed.');
  });
});

describe('clipboard security', () => {
  it('clears copied secrets after the safety delay', async () => {
    vi.useFakeTimers();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    await writeClipboardSecret('TemporarySecret123!');
    expect(writeText).toHaveBeenCalledWith('TemporarySecret123!');

    await vi.advanceTimersByTimeAsync(30_000);
    expect(writeText).toHaveBeenCalledWith('');
    vi.useRealTimers();
  });

  it('uses desktop sensitive clipboard flags when Tauri is available', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    vi.mocked(invoke).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    await writeClipboardSecret('SensitiveSecret123!');

    expect(invoke).toHaveBeenCalledWith('write_sensitive_clipboard', { value: 'SensitiveSecret123!' });
    expect(writeText).not.toHaveBeenCalledWith('SensitiveSecret123!');
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('falls back and emits an event when desktop sensitive clipboard flags fail', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    vi.mocked(invoke).mockRejectedValueOnce(new Error('native clipboard unavailable'));
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const onFailure = vi.fn();
    window.addEventListener(CLIPBOARD_SENSITIVE_FLAG_FAILED_EVENT, onFailure);

    await writeClipboardSecret('SensitiveSecret123!');

    expect(writeText).toHaveBeenCalledWith('SensitiveSecret123!');
    expect(onFailure).toHaveBeenCalledTimes(1);

    window.removeEventListener(CLIPBOARD_SENSITIVE_FLAG_FAILED_EVENT, onFailure);
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('emits a user-visible failure event when clipboard auto-clear fails', async () => {
    vi.useFakeTimers();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('clipboard denied'));
    const onFailure = vi.fn();
    window.addEventListener(CLIPBOARD_CLEAR_FAILED_EVENT, onFailure);

    await writeClipboardSecret('TemporarySecret123!');
    await vi.advanceTimersByTimeAsync(30_000);

    expect(writeText).toHaveBeenCalledWith('');
    expect(onFailure).toHaveBeenCalledTimes(1);

    window.removeEventListener(CLIPBOARD_CLEAR_FAILED_EVENT, onFailure);
    vi.useRealTimers();
  });
});

describe('master password policy', () => {
  it('requires length and all major character classes', () => {
    expect(validateMasterPasswordPolicy('Short1!').failures).toContain('minLength');
    expect(validateMasterPasswordPolicy('lowercasepassword1!').failures).toContain('uppercase');
    expect(validateMasterPasswordPolicy('UPPERCASEPASSWORD1!').failures).toContain('lowercase');
    expect(validateMasterPasswordPolicy('NoNumbersHere!').failures).toContain('number');
    expect(validateMasterPasswordPolicy('NoSymbolsHere123').failures).toContain('symbol');
    expect(validateMasterPasswordPolicy('ValidMaster123!').valid).toBe(true);
  });
});

describe('vault crypto service', () => {
  it('scores password strength predictably', () => {
    expect(VaultCryptoService.calculateStrength('')).toBe(0);
    expect(VaultCryptoService.calculateStrength('short')).toBeLessThan(50);
    expect(VaultCryptoService.calculateStrength('Longer-Password-123')).toBeGreaterThanOrEqual(75);
  });

  it('scores password strength at length and character-class boundaries', () => {
    expect(VaultCryptoService.calculateStrength('12345678')).toBeLessThan(50);
    expect(VaultCryptoService.calculateStrength('123456789')).toBeLessThan(50);
    expect(VaultCryptoService.calculateStrength('123456789012')).toBeLessThan(50);
    expect(VaultCryptoService.calculateStrength('1234567890123')).toBeLessThan(50);
    expect(VaultCryptoService.calculateStrength('abcdefghi')).toBeLessThan(50);
    expect(VaultCryptoService.calculateStrength('ABCDEFGHI')).toBeLessThan(50);
    expect(VaultCryptoService.calculateStrength('abcdefghi!')).toBeLessThanOrEqual(50);
    expect(VaultCryptoService.calculateStrength('Aa1!Aa1!')).toBeLessThan(75);
    expect(VaultCryptoService.calculateStrength('correct horse battery staple')).toBeGreaterThanOrEqual(75);
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

  it('fails closed when cryptographic random generation is unavailable', () => {
    const getRandomValues = vi.spyOn(window.crypto, 'getRandomValues');
    getRandomValues.mockImplementation(() => {
      throw new Error('rng unavailable');
    });

    expect(() => VaultCryptoService.generateSecurePassword()).toThrow('rng unavailable');
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

  it('ignores legacy ChaCha20 settings and continues to use audited AES-GCM', async () => {
    localStorage.setItem('aegis_cipher_suite', 'CHACHA20-POLY1305');
    const key = await createAesKey();
    const rawKey = new Uint8Array(32).fill(7);

    const encrypted = await VaultCryptoService.encryptTextField(key, 'stream secret', rawKey);

    expect(encrypted.encrypted).not.toContain('stream secret');
    await expect(VaultCryptoService.decryptTextField(key, encrypted.encrypted, encrypted.iv, rawKey))
      .resolves.toBe('stream secret');
  });
});
