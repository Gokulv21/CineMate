import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ja from './locales/ja.json';
import ta from './locales/ta.json';

const STORAGE_KEY = 'together_language';
const savedLanguage = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const initialLanguage = savedLanguage || (navigator.language.startsWith('ja') ? 'ja' : navigator.language.startsWith('ta') ? 'ta' : 'en');

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ja: { translation: ja },
      ta: { translation: ta },
    },
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export const changeLanguage = (lang: string) => {
  i18n.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (err) {
    console.error('Failed to save language in localStorage', err);
  }
};

export default i18n;
