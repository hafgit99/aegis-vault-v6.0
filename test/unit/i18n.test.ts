import { describe, expect, it } from 'vitest';
import tr from '../../src/i18n/locales/tr.json';
import en from '../../src/i18n/locales/en.json';
import zhCN from '../../src/i18n/locales/zh-CN.json';
import { getRuntimeLanguage, localizedMessage } from '../../src/i18n/localizedMessages';

const flattenKeys = (value: unknown, prefix = ''): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(child, nextPrefix);
  });
};

describe('i18n locale resources', () => {
  it('keeps tr, en, and zh-CN locale key sets aligned', () => {
    const trKeys = flattenKeys(tr).sort();
    const enKeys = flattenKeys(en).sort();
    const zhKeys = flattenKeys(zhCN).sort();

    expect(enKeys).toEqual(trKeys);
    expect(zhKeys).toEqual(trKeys);
  });

  it('returns runtime messages for the selected language', () => {
    localStorage.setItem('aegis_language', 'en');
    expect(localizedMessage('dbLocked')).toBe('Database is not unlocked');

    localStorage.setItem('aegis_language', 'zh-CN');
    expect(localizedMessage('encryptionFailed')).toBe('加密失败。');

    localStorage.setItem('aegis_language', 'tr');
    expect(localizedMessage('invalidMasterPassword')).toBe('Hatalı Master Şifre!');
  });

  it('prefers stored runtime language over browser language', () => {
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'tr-TR',
    });

    localStorage.setItem('aegis_language', 'en');
    expect(getRuntimeLanguage()).toBe('en');

    localStorage.setItem('aegis_language', 'zh-CN');
    expect(getRuntimeLanguage()).toBe('zh-CN');
  });

  it('falls back from browser language when no supported language is stored', () => {
    localStorage.setItem('aegis_language', 'unsupported');

    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'zh-Hans-CN',
    });
    expect(getRuntimeLanguage()).toBe('zh-CN');

    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'en-US',
    });
    expect(getRuntimeLanguage()).toBe('en');

    Object.defineProperty(navigator, 'language', {
      configurable: true,
      value: 'de-DE',
    });
    expect(getRuntimeLanguage()).toBe('tr');
  });
});
