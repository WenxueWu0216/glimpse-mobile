import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { Language } from '../state/settingsStore';
import { en } from './en';
import { zh } from './zh';

export function deviceLanguage(): Language {
  try {
    return getLocales()[0]?.languageCode === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
