/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useCallback, useSyncExternalStore } from 'react';
import * as RNLocalize from 'react-native-localize';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';
import { bundledTranslations } from './translations';

type TranslationParams = Record<string, unknown>;
type TranslationMap = Record<string, string>;
type Listener = () => void;

let currentLocale = DEFAULT_LOCALE;
const listeners = new Set<Listener>();
const normalizedTranslations = new Map<string, TranslationMap>();

const localizeLocale = (locale: string): string =>
  locale === 'sr@Cyrl' ? 'sr-Cyrl' : locale;

export const normalizeLocale = (locale?: string): string => {
  const rawLocale = (locale || DEFAULT_LOCALE).replace(/_/g, '-');
  const lowerLocale = rawLocale.toLowerCase();

  if (SUPPORTED_LOCALES.includes(rawLocale)) {
    return rawLocale;
  }

  if (lowerLocale === 'sr@cyrl' || lowerLocale.startsWith('sr-cyrl')) {
    return SUPPORTED_LOCALES.includes('sr@Cyrl') ? 'sr@Cyrl' : 'sr';
  }

  const baseLocale = lowerLocale.split('-')[0];
  const supportedLocale = SUPPORTED_LOCALES.find(
    candidate => candidate.toLowerCase() === baseLocale,
  );

  return supportedLocale || DEFAULT_LOCALE;
};

const getSettingsService = async () =>
  (await import('../services/SettingsService')).settingsService;

const normalizeTranslations = (
  translations: Record<string, unknown>,
): TranslationMap => {
  const normalized: TranslationMap = {};
  Object.entries(translations).forEach(([key, value]) => {
    if (typeof value === 'string') {
      normalized[key] = value;
      return;
    }
    if (value && typeof value === 'object' && 'string' in value) {
      const entry = value as { string?: unknown };
      if (typeof entry.string === 'string') {
        normalized[key] = entry.string;
      }
    }
  });
  return normalized;
};

const getTranslations = (locale: string): TranslationMap => {
  const normalizedLocale = normalizeLocale(locale);
  const cached = normalizedTranslations.get(normalizedLocale);
  if (cached) {
    return cached;
  }

  const rawTranslations = bundledTranslations[normalizedLocale] || {};
  const normalized = normalizeTranslations(rawTranslations);
  normalizedTranslations.set(normalizedLocale, normalized);
  return normalized;
};

const resolveLocale = (preferred?: string): string => {
  if (preferred && preferred !== 'system') {
    return normalizeLocale(preferred);
  }

  const best = RNLocalize.findBestLanguageTag(
    SUPPORTED_LOCALES.map(localizeLocale),
  );
  return normalizeLocale(best?.languageTag || DEFAULT_LOCALE);
};

const notifyLocaleChanged = () => {
  listeners.forEach(listener => listener());
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getLocaleSnapshot = () => currentLocale;

const interpolate = (message: string, params?: TranslationParams): string => {
  if (!params) {
    return message;
  }

  return message.replace(/\{([^{}]+)\}/g, (match, key: string) => {
    if (key.startsWith('_')) {
      return match;
    }
    const value = params[key];
    return value === undefined || value === null ? match : String(value);
  });
};

const translateForLocale = (
  locale: string,
  key: string,
  params?: TranslationParams,
): string => {
  const localeTranslations = getTranslations(locale);
  const defaultTranslations = getTranslations(DEFAULT_LOCALE);
  const message = localeTranslations[key] || defaultTranslations[key] || key;
  return interpolate(message, params);
};

const translate = (key: string, params?: TranslationParams): string =>
  translateForLocale(currentLocale, key, params);

export const tx = {
  t: translate,
  translate,
  getCurrentLocale: () => currentLocale,
};

export const useT = () => {
  const locale = useSyncExternalStore(subscribe, getLocaleSnapshot);

  return useCallback(
    (key: string, params?: TranslationParams) =>
      translateForLocale(locale, key, params),
    [locale],
  );
};

export const applyLocale = async (preferred?: string): Promise<void> => {
  const locale = resolveLocale(preferred);
  if (locale === currentLocale) {
    return;
  }
  currentLocale = locale;
  notifyLocaleChanged();
};

export const initLocalization = async (): Promise<void> => {
  const settingsService = await getSettingsService();
  const preferredLocale = await settingsService.getSetting(
    'appLanguage',
    'system',
  );
  await applyLocale(preferredLocale);
};

export const listenToLocaleChanges = (): (() => void) => {
  const handler = () => {
    getSettingsService()
      .then(settingsService =>
        settingsService.getSetting('appLanguage', 'system').then(preferred => {
          if (preferred && preferred !== 'system') {
            return;
          }
          return applyLocale('system');
        }),
      )
      .catch(() => {});
  };

  const addListener =
    (
      RNLocalize as {
        addEventListener?: (event: string, cb: () => void) => void;
      }
    ).addEventListener ??
    (RNLocalize as { addListener?: (event: string, cb: () => void) => void })
      .addListener;
  const removeListener =
    (
      RNLocalize as {
        removeEventListener?: (event: string, cb: () => void) => void;
      }
    ).removeEventListener ??
    (RNLocalize as { removeListener?: (event: string, cb: () => void) => void })
      .removeListener;

  if (!addListener || !removeListener) {
    return () => {};
  }

  addListener('change', handler);
  return () => removeListener('change', handler);
};

export const LocalizationProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => <>{children}</>;
