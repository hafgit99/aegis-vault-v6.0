import { Argon2WorkerService } from '../Argon2WorkerService';
import { bufferToHex, toBufferSource } from '../crypto-types';

export interface StoredCredential {
  scheme: 'argon2id-v1' | 'pbkdf2-sha256';
  verificationHash: string;
  salt: string;
  iterations?: number;
  argon2?: {
    iterations: number;
    memorySize: number;
    parallelism: number;
    hashLength: number;
  };
}

export class VaultAuthService {
  static calibrateArgon2Params(): NonNullable<StoredCredential['argon2']> {
    const defaultParams: NonNullable<StoredCredential['argon2']> = {
      iterations: 4,
      memorySize: 131072,
      parallelism: 1,
      hashLength: 32,
    };

    try {
      const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }) : null;
      const deviceMemory = Number(nav?.deviceMemory || 0);
      const cores = Number(nav?.hardwareConcurrency || 0);

      let memorySize = defaultParams.memorySize;
      let iterations = defaultParams.iterations;
      let parallelism = defaultParams.parallelism;

      if (Number.isFinite(deviceMemory) && deviceMemory > 0) {
        if (deviceMemory <= 2) {
          memorySize = 46080;
          iterations = 3;
        } else if (deviceMemory <= 4) {
          memorySize = 65536;
          iterations = 4;
        } else if (deviceMemory >= 8) {
          memorySize = 131072;
          iterations = 4;
        }
      }

      if (Number.isFinite(cores) && cores >= 8) {
        parallelism = 2;
      }

      return {
        iterations,
        memorySize,
        parallelism,
        hashLength: 32,
      };
    } catch {
      return defaultParams;
    }
  }

  static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const encoder = new TextEncoder();
    const bufA = encoder.encode(a);
    const bufB = encoder.encode(b);
    let result = 0;
    for (let i = 0; i < bufA.length; i++) {
      result |= bufA[i] ^ bufB[i];
    }
    return result === 0;
  }

  static async hashPasswordPBKDF2(
    password: string,
    salt: Uint8Array,
    iterations: number = 100000
  ): Promise<string> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      toBufferSource(enc.encode(password)),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const hash = await window.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: toBufferSource(salt), iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    );

    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  }

  static async hashPasswordArgon2(
    password: string,
    salt: Uint8Array,
    params: NonNullable<StoredCredential['argon2']>
  ): Promise<string> {
    return Argon2WorkerService.deriveHex({
      password,
      salt,
      parallelism: params.parallelism,
      iterations: params.iterations,
      memorySize: params.memorySize,
      hashLength: params.hashLength,
    });
  }

  static async createAuthCredential(
    password: string,
    params: NonNullable<StoredCredential['argon2']>
  ): Promise<StoredCredential> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const verificationHash = await this.hashPasswordArgon2(password, salt, params);

    return {
      scheme: 'argon2id-v1',
      verificationHash,
      salt: btoa(String.fromCharCode(...salt)),
      argon2: { ...params },
    };
  }

  static async verifyPassword(
    password: string,
    stored: StoredCredential,
    fallbackParams: NonNullable<StoredCredential['argon2']>
  ): Promise<boolean> {
    const salt = Uint8Array.from(atob(stored.salt), (c) => c.charCodeAt(0));

    if (stored.scheme === 'argon2id-v1') {
      const computedHash = await this.hashPasswordArgon2(
        password,
        salt,
        stored.argon2 || fallbackParams
      );
      return this.timingSafeEqual(computedHash, stored.verificationHash);
    }

    const computedHash = await this.hashPasswordPBKDF2(password, salt, stored.iterations || 100000);
    return this.timingSafeEqual(computedHash, stored.verificationHash);
  }

  static async deriveMasterKey(args: {
    password: string;
    secretKey: string;
    saltB64?: string;
    params: NonNullable<StoredCredential['argon2']>;
    version?: number;
  }): Promise<{ saltB64: string; aesKey: CryptoKey; sensitiveMaterial: Uint8Array }> {
    const { password, secretKey, saltB64, params, version = 3 } = args;
    let salt: Uint8Array;

    if (saltB64) {
      salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    } else {
      salt = window.crypto.getRandomValues(new Uint8Array(16));
    }

    let sensitiveMaterial: Uint8Array;

    if (version >= 3) {
      const ikm = await Argon2WorkerService.deriveBinary({
        password,
        salt,
        parallelism: params.parallelism,
        iterations: params.iterations,
        memorySize: params.memorySize,
        hashLength: params.hashLength,
      });

      const info = new TextEncoder().encode(`aegis-vault-v5:${secretKey}`);
      try {
        const keyMaterial = await window.crypto.subtle.importKey(
          'raw',
          toBufferSource(ikm),
          'HKDF',
          false,
          ['deriveBits']
        );

        const derivedBits = await window.crypto.subtle.deriveBits(
          { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info },
          keyMaterial,
          256
        );
        sensitiveMaterial = new Uint8Array(derivedBits);
      } finally {
        ikm.fill(0);
        info.fill(0);
      }
    } else {
      const combinedMaterial = `${password}:${secretKey}`;
      sensitiveMaterial = await Argon2WorkerService.deriveBinary({
        password: combinedMaterial,
        salt,
        parallelism: params.parallelism,
        iterations: params.iterations,
        memorySize: params.memorySize,
        hashLength: params.hashLength,
      });
    }

    const keyBuf = new ArrayBuffer(sensitiveMaterial.byteLength);
    new Uint8Array(keyBuf).set(sensitiveMaterial);

    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      keyBuf,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return {
      saltB64: btoa(String.fromCharCode(...salt)),
      aesKey,
      sensitiveMaterial,
    };
  }
}
