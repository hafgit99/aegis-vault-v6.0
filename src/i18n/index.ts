import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from './locales/tr.json';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

export const supportedLanguages = [
  { code: 'tr', labelKey: 'app.language.turkish' },
  { code: 'en', labelKey: 'app.language.english' },
  { code: 'zh-CN', labelKey: 'app.language.chineseSimplified' }
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number]['code'];

const storageKey = 'aegis_language';

const getInitialLanguage = (): SupportedLanguage => {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'tr' || stored === 'en' || stored === 'zh-CN') return stored;

    const browserLanguage = navigator.language;
    if (browserLanguage.startsWith('zh')) return 'zh-CN';
    if (browserLanguage.startsWith('en')) return 'en';
  } catch (e) {}

  return 'tr';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
      'zh-CN': { translation: zhCN }
    },
    lng: getInitialLanguage(),
    fallbackLng: 'tr',
    interpolation: {
      escapeValue: false
    },
    returnNull: false
  });

i18n.on('languageChanged', (language) => {
  try {
    if (language === 'tr' || language === 'en' || language === 'zh-CN') {
      localStorage.setItem(storageKey, language);
      document.documentElement.lang = language;
    }
  } catch (e) {}
});

document.documentElement.lang = i18n.language;

export default i18n;
