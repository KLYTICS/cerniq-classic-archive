'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Locale, TranslationKeys } from './types';
import { en } from './locales/en';
import { es } from './locales/es';

const translations: Record<Locale, TranslationKeys> = { en, es };

const STORAGE_KEY = 'cerniq_locale';

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch { /* SSR or storage blocked */ }
  const nav = navigator.language || '';
  return nav.startsWith('es') ? 'es' : 'en';
}

function getNestedValue(obj: any, path: string): string {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null) return path;
    current = current[key];
  }
  return typeof current === 'string' ? current : path;
}

interface TranslationContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  ta: (key: string) => string[];
}

const TranslationContext = createContext<TranslationContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
  ta: () => [],
});

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch { /* storage blocked */ }
  }, []);

  const t = useCallback(
    (key: string): string => getNestedValue(translations[locale], key),
    [locale],
  );

  const ta = useCallback(
    (key: string): string[] => {
      const keys = key.split('.');
      let current: any = translations[locale];
      for (const k of keys) {
        if (current == null) return [];
        current = current[k];
      }
      return Array.isArray(current) ? current : [];
    },
    [locale],
  );

  return (
    <TranslationContext.Provider value={{ locale, setLocale, t, ta }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  return useContext(TranslationContext);
}
