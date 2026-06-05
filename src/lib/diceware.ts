import { EFF_ENGLISH_WORDS } from './diceware/effEnglishWordlist';
import { TURKISH_DICEWARE_WORDS } from './diceware/turkishWordlist';

export type DicewareLanguage = 'en' | 'tr';
export type DicewareWordlistMode = 'clean' | 'full';

export interface DicewareOptions {
  language: DicewareLanguage;
  wordCount: number;
  wordlistMode?: DicewareWordlistMode;
  separator?: string;
}

export interface DicewarePassphrase {
  value: string;
  words: string[];
  entropyBits: number;
  wordlistSize: number;
  language: DicewareLanguage;
  wordlistMode: DicewareWordlistMode;
}

const WORDLISTS: Record<DicewareLanguage, readonly string[]> = {
  en: EFF_ENGLISH_WORDS,
  tr: TURKISH_DICEWARE_WORDS,
};

export const DICEWARE_MIN_WORDS = 5;
export const DICEWARE_MAX_WORDS = 8;
export const DICEWARE_DEFAULT_WORDS = 6;
export const DICEWARE_DEFAULT_SEPARATOR = '-';
export const DICEWARE_DEFAULT_WORDLIST_MODE: DicewareWordlistMode = 'clean';

const PREDICTABLE_WORDS = new Set([
  'admin',
  'login',
  'password',
  'parola',
  'sifre',
  'qwerty',
]);

const CLEAN_WORDLISTS: Record<DicewareLanguage, readonly string[]> = {
  en: buildCleanWordlist(EFF_ENGLISH_WORDS),
  tr: buildCleanWordlist(TURKISH_DICEWARE_WORDS),
};

function buildCleanWordlist(wordlist: readonly string[]): readonly string[] {
  return wordlist.filter((word) => {
    const normalized = word.trim().toLocaleLowerCase('tr-TR');
    if (normalized.length < 4) return false;
    if (!/^[\p{L}]+$/u.test(normalized)) return false;
    if (/^(.)\1+$/u.test(normalized)) return false;
    if (PREDICTABLE_WORDS.has(normalized)) return false;
    return true;
  });
}

function assertDicewareOptions(options: DicewareOptions): void {
  if (!Number.isInteger(options.wordCount) || options.wordCount < DICEWARE_MIN_WORDS || options.wordCount > DICEWARE_MAX_WORDS) {
    throw new RangeError(`Diceware word count must be an integer between ${DICEWARE_MIN_WORDS} and ${DICEWARE_MAX_WORDS}`);
  }
  if (!WORDLISTS[options.language]) {
    throw new RangeError(`Unsupported Diceware language: ${options.language}`);
  }
}

export function getDicewareWordlist(language: DicewareLanguage, mode: DicewareWordlistMode = DICEWARE_DEFAULT_WORDLIST_MODE): readonly string[] {
  const wordlist = mode === 'full' ? WORDLISTS[language] : CLEAN_WORDLISTS[language];
  if (!wordlist) {
    throw new RangeError(`Unsupported Diceware language: ${language}`);
  }
  if (wordlist.length <= 1) {
    throw new RangeError(`Diceware wordlist is too small for language: ${language}`);
  }
  return wordlist;
}

export function calculateDicewareEntropyBits(wordCount: number, wordlistSize: number): number {
  if (!Number.isInteger(wordCount) || wordCount <= 0) {
    throw new RangeError('Word count must be a positive integer');
  }
  if (!Number.isInteger(wordlistSize) || wordlistSize <= 1) {
    throw new RangeError('Wordlist size must be greater than one');
  }
  return wordCount * Math.log2(wordlistSize);
}

export function generateUnbiasedRandomIndex(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 1) {
    throw new RangeError('Max exclusive value must be an integer greater than one');
  }

  const randomRange = 0x100000000;
  const maxUnbiasedValue = Math.floor(randomRange / maxExclusive) * maxExclusive;
  const randomValues = new Uint32Array(1);

  do {
    crypto.getRandomValues(randomValues);
  } while (randomValues[0] >= maxUnbiasedValue);

  return randomValues[0] % maxExclusive;
}

export function generateDicewarePassphrase(options: DicewareOptions): DicewarePassphrase {
  assertDicewareOptions(options);

  const wordlistMode = options.wordlistMode ?? DICEWARE_DEFAULT_WORDLIST_MODE;
  const wordlist = getDicewareWordlist(options.language, wordlistMode);
  const separator = options.separator ?? DICEWARE_DEFAULT_SEPARATOR;
  const words = Array.from({ length: options.wordCount }, () => wordlist[generateUnbiasedRandomIndex(wordlist.length)]);

  return {
    value: words.join(separator),
    words,
    entropyBits: calculateDicewareEntropyBits(options.wordCount, wordlist.length),
    wordlistSize: wordlist.length,
    language: options.language,
    wordlistMode,
  };
}
