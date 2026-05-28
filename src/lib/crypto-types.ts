/**
 * Crypto Type Safety and Hex Conversion Utilities
 */

export function ensureArrayBuffer(data: Uint8Array): ArrayBuffer {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('Expected Uint8Array');
  }
  const isShared = typeof SharedArrayBuffer !== 'undefined' && data.buffer instanceof SharedArrayBuffer;
  if (data.buffer instanceof ArrayBuffer && !isShared) {
    return data.buffer;
  }
  const safeCopy = new Uint8Array(data.length);
  safeCopy.set(data);
  return safeCopy.buffer as ArrayBuffer;
}

export function toBufferSource(data: Uint8Array | ArrayBuffer | BufferSource): BufferSource {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (data instanceof Uint8Array) {
    return ensureArrayBuffer(data);
  }
  return data as BufferSource;
}

export function generateRandomBytes(length: number): Uint8Array {
  if (length <= 0 || !Number.isInteger(length)) {
    throw new RangeError(`Length must be positive integer, got ${length}`);
  }
  return crypto.getRandomValues(new Uint8Array(length));
}

export function generateRandomString(length: number, charset: string): string {
  if (length <= 0 || !Number.isInteger(length)) {
    throw new RangeError(`Length must be positive integer, got ${length}`);
  }
  if (!charset) {
    throw new RangeError('Charset must not be empty');
  }

  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  let value = '';
  for (let i = 0; i < length; i++) {
    value += charset[randomValues[i] % charset.length];
  }
  return value;
}

export function bufferToHex(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = ArrayBuffer.isView(buffer)
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : new Uint8Array(buffer);

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function bufferToBase64Url(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = ArrayBuffer.isView(buffer)
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : new Uint8Array(buffer);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function hexToBuffer(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new SyntaxError('Hex string must have even length');
  }
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new SyntaxError('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function isLikelyHex(str: string): boolean {
  if (typeof str !== 'string') return false;
  if (str.length % 2 !== 0) return false;
  return /^[0-9a-fA-F]+$/.test(str);
}
