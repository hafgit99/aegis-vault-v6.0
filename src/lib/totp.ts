import { generateRandomBytes, toBufferSource } from './crypto-types';

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface TotpConfig {
  secret: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
  timestamp?: number;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(length = 20): string {
  const random = generateRandomBytes(length);
  return Array.from(random, (byte) => BASE32_ALPHABET[byte % BASE32_ALPHABET.length]).join('');
}

export function normalizeTotpSecret(secret: string): string {
  return secret.replace(/\s+/g, '').replace(/=+$/g, '').toUpperCase();
}

export function decodeBase32(secret: string): Uint8Array {
  const normalized = normalizeTotpSecret(secret);
  if (!normalized) {
    throw new Error('TOTP secret cannot be empty.');
  }

  let bits = '';
  for (const char of normalized) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error('TOTP secret must be valid Base32.');
    }
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

function counterToBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let value = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

export function getTotpRemainingSeconds(period = 30, timestamp = Date.now()): number {
  const safePeriod = period > 0 ? period : 30;
  const elapsed = Math.floor(timestamp / 1000) % safePeriod;
  return safePeriod - elapsed;
}

export async function generateTOTP({
  secret,
  algorithm = 'SHA-1',
  digits = 6,
  period = 30,
  timestamp = Date.now(),
}: TotpConfig): Promise<string> {
  if (digits < 6 || digits > 8 || !Number.isInteger(digits)) {
    throw new Error('TOTP digits must be 6, 7, or 8.');
  }
  if (period <= 0 || !Number.isInteger(period)) {
    throw new Error('TOTP period must be a positive integer.');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    toBufferSource(decodeBase32(secret)),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  );
  const counter = Math.floor(timestamp / 1000 / period);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, toBufferSource(counterToBytes(counter))));
  const offset = signature[signature.length - 1] & 0x0f;
  const binary = ((signature[offset] & 0x7f) << 24)
    | ((signature[offset + 1] & 0xff) << 16)
    | ((signature[offset + 2] & 0xff) << 8)
    | (signature[offset + 3] & 0xff);
  const otp = binary % (10 ** digits);
  return otp.toString().padStart(digits, '0');
}
