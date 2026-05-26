import {
  hexToBuffer,
  isLikelyHex,
  bufferToHex,
  toBufferSource,
  generateRandomBytes,
} from '../crypto-types';

class ChaCha20 {
  static rotate(v: number, n: number): number {
    return (v << n) | (v >>> (32 - n));
  }

  static quarterRound(x: Uint32Array, a: number, b: number, c: number, d: number) {
    x[a] = (x[a] + x[b]) | 0; x[d] ^= x[a]; x[d] = ChaCha20.rotate(x[d], 16);
    x[c] = (x[c] + x[d]) | 0; x[b] ^= x[c]; x[b] = ChaCha20.rotate(x[b], 12);
    x[a] = (x[a] + x[b]) | 0; x[d] ^= x[a]; x[d] = ChaCha20.rotate(x[d], 8);
    x[c] = (x[c] + x[d]) | 0; x[b] ^= x[c]; x[b] = ChaCha20.rotate(x[b], 7);
  }

  static chacha20Block(out: Uint8Array, outOffset: number, key: Uint32Array, counter: number, nonce: Uint32Array) {
    const x = new Uint32Array(16);
    x[0] = 0x61707865;
    x[1] = 0x3320646e;
    x[2] = 0x79622d32;
    x[3] = 0x6b206574;
    for (let i = 0; i < 8; i++) x[4 + i] = key[i];
    x[12] = counter;
    x[13] = nonce[0];
    x[14] = nonce[1];
    x[15] = nonce[2];

    const mix = new Uint32Array(x);
    for (let i = 0; i < 10; i++) {
      // Column rounds
      ChaCha20.quarterRound(mix, 0, 4, 8, 12);
      ChaCha20.quarterRound(mix, 1, 5, 9, 13);
      ChaCha20.quarterRound(mix, 2, 6, 10, 14);
      ChaCha20.quarterRound(mix, 3, 7, 11, 15);
      // Diagonal rounds
      ChaCha20.quarterRound(mix, 0, 5, 10, 15);
      ChaCha20.quarterRound(mix, 1, 6, 11, 12);
      ChaCha20.quarterRound(mix, 2, 7, 8, 13);
      ChaCha20.quarterRound(mix, 3, 4, 9, 14);
    }

    for (let i = 0; i < 16; i++) {
      const val = (x[i] + mix[i]) | 0;
      out[outOffset + i * 4] = val & 0xff;
      out[outOffset + i * 4 + 1] = (val >>> 8) & 0xff;
      out[outOffset + i * 4 + 2] = (val >>> 16) & 0xff;
      out[outOffset + i * 4 + 3] = (val >>> 24) & 0xff;
    }
  }

  static encrypt(keyBytes: Uint8Array, nonceBytes: Uint8Array, plaintext: Uint8Array): Uint8Array {
    const key = new Uint32Array(8);
    for (let i = 0; i < 8; i++) {
      key[i] = keyBytes[i * 4] | (keyBytes[i * 4 + 1] << 8) | (keyBytes[i * 4 + 2] << 16) | (keyBytes[i * 4 + 3] << 24);
    }
    const nonce = new Uint32Array(3);
    for (let i = 0; i < 3; i++) {
      nonce[i] = nonceBytes[i * 4] | (nonceBytes[i * 4 + 1] << 8) | (nonceBytes[i * 4 + 2] << 16) | (nonceBytes[i * 4 + 3] << 24);
    }

    const ciphertext = new Uint8Array(plaintext.length);
    const block = new Uint8Array(64);
    let counter = 1;
    let offset = 0;
    
    while (offset < plaintext.length) {
      ChaCha20.chacha20Block(block, 0, key, counter++, nonce);
      const limit = Math.min(64, plaintext.length - offset);
      for (let i = 0; i < limit; i++) {
        ciphertext[offset + i] = plaintext[offset + i] ^ block[i];
      }
      offset += limit;
    }
    return ciphertext;
  }
}

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
    rawKey?: Uint8Array | null
  ): Promise<{ encrypted: string; iv: string }> {
    const isChaCha = localStorage.getItem('aegis_cipher_suite') === 'CHACHA20-POLY1305';
    
    if (isChaCha && rawKey) {
      // Generate Nonce
      const nonce = generateRandomBytes(12);
      const plainBytes = new TextEncoder().encode(value || '');
      
      // Encrypt plaintext using ChaCha20
      const ciphertext = ChaCha20.encrypt(rawKey, nonce, plainBytes);

      // Compute HMAC-SHA256 MAC over Nonce || Ciphertext for authentication
      const hmacKey = await window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const dataToSign = new Uint8Array(nonce.length + ciphertext.length);
      dataToSign.set(nonce);
      dataToSign.set(ciphertext, nonce.length);

      const mac = await window.crypto.subtle.sign(
        'HMAC',
        hmacKey,
        dataToSign
      );
      const macBytes = new Uint8Array(mac);

      // Combine Ciphertext + MAC as a single hex payload
      const payload = new Uint8Array(ciphertext.length + macBytes.length);
      payload.set(ciphertext);
      payload.set(macBytes, ciphertext.length);

      return {
        encrypted: bufferToHex(payload),
        iv: bufferToHex(nonce)
      };
    }

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
    rawKey?: Uint8Array | null
  ): Promise<string | null> {
    if (!encrypted || !iv) return null;

    try {
      const isChaCha = localStorage.getItem('aegis_cipher_suite') === 'CHACHA20-POLY1305';

      const cipherArray = isLikelyHex(encrypted)
        ? hexToBuffer(encrypted)
        : Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
      const ivArray = isLikelyHex(iv)
        ? hexToBuffer(iv)
        : Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

      if (isChaCha && rawKey) {
        if (cipherArray.length < 32) return null;

        const ciphertextBytes = cipherArray.slice(0, cipherArray.length - 32);
        const macBytes = cipherArray.slice(cipherArray.length - 32);

        // Verify HMAC
        const hmacKey = await window.crypto.subtle.importKey(
          'raw',
          rawKey,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['verify']
        );

        const dataToSign = new Uint8Array(ivArray.length + ciphertextBytes.length);
        dataToSign.set(ivArray);
        dataToSign.set(ciphertextBytes, ivArray.length);

        const isValidMac = await window.crypto.subtle.verify(
          'HMAC',
          hmacKey,
          macBytes,
          dataToSign
        );

        if (!isValidMac) {
          console.error('[AegisVault Cryptography] MAC verification failed! Integrity check failed.');
          return null;
        }

        // Decrypt
        const plainBytes = ChaCha20.encrypt(rawKey, ivArray, ciphertextBytes);
        return new TextDecoder().decode(plainBytes);
      }

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
    try {
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
        charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; // Fallback
      }

      const randomValues = new Uint32Array(length);
      window.crypto.getRandomValues(randomValues);

      let generated = "";
      for (let i = 0; i < length; i++) {
        generated += charset[randomValues[i] % charset.length];
      }
      return generated;
    } catch (e) {
      // Math.random fallback
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
      let gen = "";
      for (let i = 0; i < 16; i++) {
        gen += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return gen;
    }
  }
}
