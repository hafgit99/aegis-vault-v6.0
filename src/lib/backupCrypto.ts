// Web Crypto API helper containing Argon2id + AES-GCM 256-bit encryption
// for highly secure password-manager level backups.
import { localizedMessage } from '../i18n/localizedMessages';
import { Argon2WorkerService } from './Argon2WorkerService';
import { bufferToHex, generateRandomBytes, hexToBuffer, toBufferSource } from './crypto-types';
import { createSecurityError } from './securityErrors';

const BACKUP_ARGON2 = {
  algorithm: 'argon2id',
  version: 1,
  iterations: 3,
  memorySize: 64 * 1024,
  parallelism: 1,
  hashLength: 32,
} as const;

export type BackupKdfMetadata =
  | (typeof BACKUP_ARGON2)
  | { algorithm: 'pbkdf2-sha256'; iterations: number; hashLength: 32 };

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    'raw',
    toBufferSource(rawKey),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function deriveArgon2Key(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const rawKey = await Argon2WorkerService.deriveBinary({
    password,
    salt,
    iterations: BACKUP_ARGON2.iterations,
    memorySize: BACKUP_ARGON2.memorySize,
    parallelism: BACKUP_ARGON2.parallelism,
    hashLength: BACKUP_ARGON2.hashLength,
  });
  return importAesKey(rawKey);
}

async function derivePBKDF2Key(password: string, salt: Uint8Array, iterations = 100000): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toBufferSource(salt),
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(plaintext: string, password: string): Promise<{ data: string; salt: string; iv: string; kdf: BackupKdfMetadata }> {
  try {
    const salt = generateRandomBytes(16);
    const iv = generateRandomBytes(12);
    const key = await deriveArgon2Key(password, salt);
    const enc = new TextEncoder();
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toBufferSource(iv) },
      key,
      toBufferSource(enc.encode(plaintext))
    );

    const ciphertextArray = new Uint8Array(ciphertextBuffer);

    return {
      data: bufferToHex(ciphertextArray),
      salt: bufferToHex(salt),
      iv: bufferToHex(iv),
      kdf: BACKUP_ARGON2,
    };
  } catch (err) {
    throw createSecurityError('BACKUP_ENCRYPTION_FAILED', localizedMessage('encryptionFailed'), err);
  }
}

export async function decryptData(
  ciphertextHex: string,
  saltHex: string,
  ivHex: string,
  password: string,
  kdf?: BackupKdfMetadata,
  options: { allowLegacyPBKDF2?: boolean } = {}
): Promise<string> {
  try {
    const salt = hexToBuffer(saltHex);
    const iv = hexToBuffer(ivHex);
    const ciphertext = hexToBuffer(ciphertextHex);
    if (kdf?.algorithm === 'pbkdf2-sha256' && !options.allowLegacyPBKDF2) {
      throw createSecurityError('BACKUP_DECRYPTION_FAILED', localizedMessage('decryptionFailed'));
    }

    const key = kdf?.algorithm === 'pbkdf2-sha256'
      ? await derivePBKDF2Key(password, salt, kdf.iterations)
      : await deriveArgon2Key(password, salt);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toBufferSource(iv) },
      key,
      toBufferSource(ciphertext)
    );
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    if (!kdf) {
      if (!options.allowLegacyPBKDF2) {
        throw createSecurityError('BACKUP_DECRYPTION_FAILED', localizedMessage('decryptionFailed'), err);
      }
      try {
        return await decryptData(ciphertextHex, saltHex, ivHex, password, {
          algorithm: 'pbkdf2-sha256',
          iterations: 100000,
          hashLength: 32,
        }, options);
      } catch {}
    }
    throw createSecurityError('BACKUP_DECRYPTION_FAILED', localizedMessage('decryptionFailed'), err);
  }
}
