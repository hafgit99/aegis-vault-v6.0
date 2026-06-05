const TURKISH_COMMON_WORDS = [
  'aegisvault',
  'admin',
  'ankara',
  'aslan',
  'ataturk',
  'ayse',
  'bahar',
  'besiktas',
  'cimbom',
  'deniz',
  'fenerbahce',
  'galatasaray',
  'istanbul',
  'izmir',
  'kara',
  'kartal',
  'kemal',
  'mehmet',
  'mustafa',
  'parola',
  'sifre',
  'trabzonspor',
  'turkiye',
  'yildiz',
];

const TURKISH_SEASONAL_WORDS = [
  'ocak',
  'subat',
  'mart',
  'nisan',
  'mayis',
  'haziran',
  'temmuz',
  'agustos',
  'eylul',
  'ekim',
  'kasim',
  'aralik',
  'ramazan',
  'bayram',
  'cumhuriyet',
];

const TURKISH_COMMON_COMBINATIONS = [
  'sifre123',
  'sifre1234',
  'parola123',
  'turkiye1923',
  'ataturk1881',
  'galatasaray1905',
  'fenerbahce1907',
  'besiktas1903',
  'trabzonspor1967',
  'istanbul34',
  'ankara06',
  'izmir35',
];

const TURKISH_KEYBOARD_PATTERNS = [
  'asdf',
  'asdfg',
  'asdfgh',
  'asdfghj',
  'qwer',
  'qwerty',
  'qwertyu',
  'zxcv',
  'zxcvb',
  'zxcvbn',
  '1234',
  '12345',
  '123456',
  '1234567',
  '12345678',
  '0987',
  '09876',
  '098765',
];

const TURKISH_LEET_REPLACEMENTS: Record<string, string> = {
  '@': 'a',
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '$': 's',
};

export const TURKISH_PASSWORD_USER_INPUTS = [
  ...TURKISH_COMMON_WORDS,
  ...TURKISH_SEASONAL_WORDS,
  ...TURKISH_COMMON_COMBINATIONS,
  ...TURKISH_KEYBOARD_PATTERNS,
];

export type LocalePasswordRisk = 'turkish_dictionary' | 'turkish_keyboard_pattern';

export interface LocalePasswordAssessment {
  risks: LocalePasswordRisk[];
  suggestions: string[];
  maxZxcvbnScore?: number;
}

export function getTurkishPasswordUserInputs(password: string): string[] {
  const normalized = normalizePasswordToken(password);
  const dynamicTokens = normalized
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 4 && part.length <= 32);

  return Array.from(new Set([
    ...TURKISH_PASSWORD_USER_INPUTS,
    ...dynamicTokens,
  ]));
}

export function assessTurkishPasswordPatterns(password: string): LocalePasswordAssessment {
  const normalized = normalizePasswordToken(password);
  const leetNormalized = normalizeLeetPasswordToken(password);
  const risks: LocalePasswordRisk[] = [];
  const suggestions: string[] = [];

  const hasDictionaryWord = [...TURKISH_COMMON_WORDS, ...TURKISH_SEASONAL_WORDS, ...TURKISH_COMMON_COMBINATIONS]
    .some((word) => normalized.includes(word) || leetNormalized.includes(word));
  if (hasDictionaryWord) {
    risks.push('turkish_dictionary');
    suggestions.push('Avoid Turkish names, teams, cities, months, and national dates in passwords.');
  }

  const hasKeyboardPattern = TURKISH_KEYBOARD_PATTERNS.some((pattern) => normalized.includes(pattern));
  if (hasKeyboardPattern) {
    risks.push('turkish_keyboard_pattern');
    suggestions.push('Avoid local keyboard walks such as asdfgh, qwerty, zxcvbn, and simple number runs.');
  }

  if (!risks.length) {
    return { risks, suggestions };
  }

  const hasCommonSuffix = /(?:19|20)\d{2}|(?:0[1-9]|[1-7][0-9])|(?:123|1234|1903|1905|1907|1923|1881|1967)/.test(normalized);
  const maxZxcvbnScore = hasKeyboardPattern ? 1 : hasCommonSuffix ? 2 : 3;

  return {
    risks,
    suggestions,
    maxZxcvbnScore,
  };
}

function normalizePasswordToken(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[ç]/g, 'c')
    .replace(/[ğ]/g, 'g')
    .replace(/[ı]/g, 'i')
    .replace(/[ö]/g, 'o')
    .replace(/[ş]/g, 's')
    .replace(/[ü]/g, 'u');
}

function normalizeLeetPasswordToken(value: string): string {
  return normalizePasswordToken(value)
    .replace(/[@013457$]/g, (character) => TURKISH_LEET_REPLACEMENTS[character] || character);
}
