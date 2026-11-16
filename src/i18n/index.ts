import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";

/**
 * All visible text comes from translation keys. To add German later:
 * 1. Copy en.ts to de.ts and translate the values.
 * 2. Register it below under resources.de and add it to LANGUAGES.
 */
export const LANGUAGES = [{ code: "en", name: "English", locale: "en-US" }];

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function localeFor(lang: string): string {
  return LANGUAGES.find((l) => l.code === lang)?.locale ?? "en-US";
}

export default i18n;
