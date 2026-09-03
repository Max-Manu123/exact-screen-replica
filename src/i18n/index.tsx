import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import en from "./en.json";
import pt from "./pt.json";

export type Language = "en" | "pt";

const dictionaries: Record<Language, unknown> = { en, pt };

const STORAGE_KEY = "gameforge.language";

function resolve(dict: unknown, path: string): string | undefined {
  let current: unknown = dict;
  for (const part of path.split(".")) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

interface I18nValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  // Read the stored preference after hydration to avoid SSR mismatches.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "pt") setLanguageState(stored);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => {
      const raw = resolve(dictionaries[language], key) ?? resolve(dictionaries.en, key) ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
        vars[name] === undefined ? `{${name}}` : String(vars[name]),
      );
    },
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
