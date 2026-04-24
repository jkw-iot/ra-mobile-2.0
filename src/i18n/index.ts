// ══════════════════════════════════════════════════════════════
// i18next setup — same four languages as the web app.
//
// Language resolution order:
//   1. `roomalyzer_language` in storage (user preference)
//   2. Device locale from expo-localization (first match)
//   3. Fallback to Danish ('da')
// ══════════════════════════════════════════════════════════════
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import { storage, StorageKeys } from '@/lib/storage';

import da from './locales/da.json';
import en from './locales/en.json';
import de from './locales/de.json';
import sv from './locales/sv.json';

export const SUPPORTED_LANGUAGES = ['da', 'en', 'de', 'sv'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function detectLanguage(): SupportedLanguage {
  const stored = storage.getString(StorageKeys.LANGUAGE);
  if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
    return stored as SupportedLanguage;
  }
  for (const loc of getLocales()) {
    const code = (loc.languageCode ?? '').toLowerCase();
    if ((SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
      return code as SupportedLanguage;
    }
  }
  return 'da';
}

export function setLanguage(lang: SupportedLanguage): void {
  storage.set(StorageKeys.LANGUAGE, lang);
  void i18n.changeLanguage(lang);
}

i18n
  .use(initReactI18next)
  .init({
    resources: { da: { translation: da }, en: { translation: en }, de: { translation: de }, sv: { translation: sv } },
    lng: detectLanguage(),
    fallbackLng: 'da',
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    compatibilityJSON: 'v4',
  });

export default i18n;
