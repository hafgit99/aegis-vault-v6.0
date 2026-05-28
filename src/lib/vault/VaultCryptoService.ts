import {
  hexToBuffer,
  isLikelyHex,
  bufferToHex,
  toBufferSource,
  generateRandomBytes,
  generateRandomString,
} from '../crypto-types';

export class VaultCryptoService {
  static calculateStrength(password: string): number {
    if (!password) return 0;
    let score = 0;
    if (password.length > 8) score += 20;
    if (password.length > 12) score += 20;
    if (/[a-z]/.test(password)) score += 15;
    if (/[A-Z]/.test(password)) score += 15;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^a-zA-Z0-9]/.test(password)) score += 15;
    return Math.min(score, 100);
  }

  static async encryptTextField(
    aesKey: CryptoKey | null,
    value: string,
    _rawKey?: Uint8Array | null
  ): Promise<{ encrypted: string; iv: string }> {
    if (!aesKey) throw new Error('Vault key unavailable');

    const iv = generateRandomBytes(12);
    const plainBytes = new TextEncoder().encode(value || '');
    const cipher = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toBufferSource(iv) },
      aesKey,
      toBufferSource(plainBytes)
    );

    return {
      encrypted: bufferToHex(cipher),
      iv: bufferToHex(iv),
    };
  }

  static async decryptTextField(
    aesKey: CryptoKey | null,
    encrypted?: string,
    iv?: string,
    _rawKey?: Uint8Array | null
  ): Promise<string | null> {
    if (!encrypted || !iv) return null;

    try {
      const cipherArray = isLikelyHex(encrypted)
        ? hexToBuffer(encrypted)
        : Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
      const ivArray = isLikelyHex(iv)
        ? hexToBuffer(iv)
        : Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

      if (!aesKey) return null;

      const plain = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toBufferSource(ivArray) },
        aesKey,
        toBufferSource(cipherArray)
      );
      return new TextDecoder().decode(plain);
    } catch (error) {
      console.error('DECRYPTION REAL ERROR:', error);
      return null;
    }
  }

  static async encryptJSON<T>(
    aesKey: CryptoKey | null,
    data: T,
    rawKey?: Uint8Array | null
  ): Promise<{ encrypted: string; iv: string } | null> {
    if (!data) return null;
    const str = JSON.stringify(data);
    return this.encryptTextField(aesKey, str, rawKey);
  }

  static async decryptJSON<T>(
    aesKey: CryptoKey | null,
    encrypted?: string,
    iv?: string,
    rawKey?: Uint8Array | null
  ): Promise<T | null> {
    if (!encrypted || !iv) return null;
    const str = await this.decryptTextField(aesKey, encrypted, iv, rawKey);
    if (!str) return null;
    try {
      return JSON.parse(str) as T;
    } catch {
      return null;
    }
  }

  static generateSecurePassword(): string {
    const length = Number(localStorage.getItem('aegis_gen_length') || 16);
    const uppercase = localStorage.getItem('aegis_gen_uppercase') !== 'false';
    const lowercase = localStorage.getItem('aegis_gen_lowercase') !== 'false';
    const numbers = localStorage.getItem('aegis_gen_numbers') !== 'false';
    const symbols = localStorage.getItem('aegis_gen_symbols') !== 'false';

    let charset = "";
    if (uppercase) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (lowercase) charset += "abcdefghijklmnopqrstuvwxyz";
    if (numbers) charset += "0123456789";
    if (symbols) charset += "!@#$%^&*()_+~`|}{[]:;?><,./-=";

    if (charset === "") {
      charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    }

    return generateRandomString(length, charset);
  }
}
