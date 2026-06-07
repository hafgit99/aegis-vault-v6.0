import { describe, expect, it, vi } from 'vitest';
import {
  bufferToHex,
  bufferToBase64Url,
  ensureArrayBuffer,
  generateRandomBytes,
  generateRandomString,
  hexToBuffer,
  isLikelyHex,
  toBufferSource,
} from '../../src/lib/crypto-types';

describe('crypto type utilities', () => {
  it('converts Uint8Array values into safe ArrayBuffers', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const buffer = ensureArrayBuffer(bytes);

    expect(buffer).not.toBe(bytes.buffer);
    expect(new Uint8Array(buffer)).toEqual(bytes);
    const source = toBufferSource(bytes);
    expect(source).not.toBe(bytes.buffer);
    expect(new Uint8Array(source as ArrayBuffer)).toEqual(bytes);
    expect(toBufferSource(buffer)).toBe(buffer);
  });

  it('validates random byte lengths', () => {
    expect(generateRandomBytes(8)).toHaveLength(8);
    expect(() => generateRandomBytes(0)).toThrow(RangeError);
    expect(() => generateRandomBytes(1.5)).toThrow(RangeError);
  });

  it('generates bounded random strings and rejects invalid random string inputs', () => {
    const value = generateRandomString(12, 'ABC');

    expect(value).toHaveLength(12);
    expect(value).toMatch(/^[ABC]+$/);
    expect(() => generateRandomString(0, 'ABC')).toThrow(RangeError);
    expect(() => generateRandomString(2.5, 'ABC')).toThrow(RangeError);
    expect(() => generateRandomString(8, '')).toThrow(RangeError);
  });

  it('uses rejection sampling for random strings to avoid modulo bias', () => {
    const getRandomValues = vi.spyOn(crypto, 'getRandomValues');
    getRandomValues.mockImplementation((array) => {
      const values = array as Uint32Array;
      values[0] = 0xffffffff;
      values[1] = 0;
      return array;
    });

    expect(generateRandomString(1, 'ABC')).toBe('A');

    getRandomValues.mockRestore();
  });

  it('round-trips hex and rejects invalid input', () => {
    const bytes = new Uint8Array([0, 15, 16, 255]);

    expect(bufferToHex(bytes)).toBe('000f10ff');
    expect(hexToBuffer('000f10ff')).toEqual(bytes);
    expect(isLikelyHex('000f10ff')).toBe(true);
    expect(isLikelyHex('xyz')).toBe(false);
    expect(isLikelyHex('abc')).toBe(false);
    expect(() => hexToBuffer('abc')).toThrow(SyntaxError);
    expect(() => hexToBuffer('zz')).toThrow(SyntaxError);
  });

  it('converts buffers to base64url without padding', () => {
    expect(bufferToBase64Url(new Uint8Array([1, 2, 3, 4]))).toBe('AQIDBA');
  });

  it('rejects non-Uint8Array values for array buffer conversion', () => {
    expect(() => ensureArrayBuffer('not-bytes' as unknown as Uint8Array)).toThrow(TypeError);
  });

  it('passes non-Uint8Array buffer sources through unchanged', () => {
    const view = new DataView(new ArrayBuffer(4));

    expect(toBufferSource(view)).toBe(view);
  });
});
