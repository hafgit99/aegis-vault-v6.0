import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DICEWARE_DEFAULT_SEPARATOR,
  calculateDicewareEntropyBits,
  generateDicewarePassphrase,
  generateUnbiasedRandomIndex,
  getDicewareWordlist,
} from '../../src/lib/diceware';

describe('diceware passphrase generator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads 7776-entry English and Turkish Diceware wordlists', () => {
    expect(getDicewareWordlist('en', 'full')).toHaveLength(7776);
    expect(getDicewareWordlist('tr', 'full')).toHaveLength(7776);
  });

  it('filters clean lists for readable passphrases while keeping high entropy', () => {
    const englishClean = getDicewareWordlist('en', 'clean');
    const turkishClean = getDicewareWordlist('tr', 'clean');

    expect(englishClean.length).toBeGreaterThan(7000);
    expect(turkishClean.length).toBeGreaterThan(5000);
    expect(turkishClean).not.toContain('1234');
    expect(turkishClean).not.toContain('parola');
    expect(turkishClean.every((word) => /^[\p{L}]+$/u.test(word))).toBe(true);
  });

  it('generates a six-word clean EFF English passphrase with expected entropy', () => {
    const getRandomValues = vi.spyOn(crypto, 'getRandomValues');
    let value = 0;
    getRandomValues.mockImplementation((array) => {
      (array as Uint32Array)[0] = value++;
      return array;
    });

    const passphrase = generateDicewarePassphrase({
      language: 'en',
      wordCount: 6,
      wordlistMode: 'clean',
      separator: DICEWARE_DEFAULT_SEPARATOR,
    });

    expect(passphrase.words).toEqual(['abacus', 'abdomen', 'abdominal', 'abide', 'abiding', 'ability']);
    expect(passphrase.value).toBe('abacus-abdomen-abdominal-abide-abiding-ability');
    expect(passphrase.entropyBits).toBeGreaterThan(76);
    expect(passphrase.wordlistSize).toBe(getDicewareWordlist('en', 'clean').length);
    expect(passphrase.wordlistMode).toBe('clean');
  });

  it('uses rejection sampling for unbiased word indexes', () => {
    const getRandomValues = vi.spyOn(crypto, 'getRandomValues');
    let call = 0;
    getRandomValues.mockImplementation((array) => {
      (array as Uint32Array)[0] = call++ === 0 ? 0xffffffff : 5;
      return array;
    });

    expect(generateUnbiasedRandomIndex(7776)).toBe(5);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it('validates entropy inputs and word count bounds', () => {
    expect(calculateDicewareEntropyBits(5, 7776)).toBeCloseTo(64.62, 1);
    expect(() => calculateDicewareEntropyBits(0, 7776)).toThrow(RangeError);
    expect(() => calculateDicewareEntropyBits(6, 1)).toThrow(RangeError);
    expect(() => generateDicewarePassphrase({ language: 'en', wordCount: 4 })).toThrow(RangeError);
    expect(() => generateDicewarePassphrase({ language: 'en', wordCount: 9 })).toThrow(RangeError);
  });
});
