import { describe, expect, it } from 'vitest';
import {
  bufferToHex,
  ensureArrayBuffer,
  generateRandomBytes,
  hexToBuffer,
  isLikelyHex,
  toBufferSource,
} from '../../src/lib/crypto-types';

describe('crypto type utilities', () => {
  it('converts Uint8Array values into safe ArrayBuffers', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const buffer = ensureArrayBuffer(bytes);

    expect(buffer).toBe(bytes.buffer);
    expect(toBufferSource(bytes)).toBe(bytes.buffer);
    expect(toBufferSource(buffer)).toBe(buffer);
  });

  it('validates random byte lengths', () => {
    expect(generateRandomBytes(8)).toHaveLength(8);
    expect(() => generateRandomBytes(0)).toThrow(RangeError);
    expect(() => generateRandomBytes(1.5)).toThrow(RangeError);
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

  it('rejects non-Uint8Array values for array buffer conversion', () => {
    expect(() => ensureArrayBuffer('not-bytes' as unknown as Uint8Array)).toThrow(TypeError);
  });
});
