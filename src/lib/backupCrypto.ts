// Web Crypto API helper containing standard PBKDF2 + AES-GCM 256-bit encryption
// for highly secure password-manager level backups.
import { localizedMessage } from '../i18n/localizedMessages';

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
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
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(plaintext: string, password: string): Promise<{ data: string; salt: string; iv: string }> {
  try {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const enc = new TextEncoder();
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      enc.encode(plaintext)
    );

    const ciphertextArray = new Uint8Array(ciphertextBuffer);
    
    // Convert array to hex string
    const bufToHex = (arr: Uint8Array) => Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return {
      data: bufToHex(ciphertextArray),
      salt: bufToHex(salt),
      iv: bufToHex(iv)
    };
  } catch (err) {
    console.error("Encryption failed:", err);
    throw new Error(localizedMessage('encryptionFailed'));
  }
}

export async function decryptData(ciphertextHex: string, saltHex: string, ivHex: string, password: string): Promise<string> {
  try {
    const hexToBuf = (hex: string) => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    };

    const salt = hexToBuf(saltHex);
    const iv = hexToBuf(ivHex);
    const ciphertext = hexToBuf(ciphertextHex);

    const key = await deriveKey(password, salt);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.error("Decryption failed:", err);
    throw new Error(localizedMessage('decryptionFailed'));
  }
}
