/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  tx,
  SourceErrorPolicy,
  SourceStringPolicy,
  normalizeLocale,
} from '@transifex/native';
import { TXProvider, useT } from '@transifex/react';
import * as RNLocalize from 'react-native-localize';

import { bundledTranslations } from './translations';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  TRANSIFEX_CDS_HOST,
  TRANSIFEX_NATIVE_TOKEN,
} from './config';

const txWithT = tx as typeof tx & {
  t?: (key: string, params?: Record<string, unknown>) => string;
};
if (typeof txWithT.t !== 'function') {
  txWithT.t = tx.translate.bind(tx);
}

const getSettingsService = async () =>
  (await import('../services/SettingsService')).settingsService;

const resolveLocale = (preferred?: string): string => {
  if (preferred && preferred !== 'system') {
    return normalizeLocale(preferred);
  }
  const best = RNLocalize.findBestLanguageTag(SUPPORTED_LOCALES);
  return normalizeLocale(best?.languageTag || DEFAULT_LOCALE);
};

const normalizeTranslations = (
  translations: Record<string, unknown>,
): Record<string, string> => {
  const normalized: Record<string, string> = {};
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

const preloadBundledTranslations = () => {
  Object.entries(bundledTranslations).forEach(([locale, translations]) => {
    if (!translations || Object.keys(translations).length === 0) {
      return;
    }
    const normalized = normalizeTranslations(
      translations as Record<string, unknown>,
    );
    if (Object.keys(normalized).length > 0) {
      tx.cache.update(locale, normalized);
    }
  });
};

export const initTransifex = async (): Promise<void> => {
  if (!TRANSIFEX_NATIVE_TOKEN) {
    console.warn(
      'Transifex Native token missing; translations will use source strings.',
    );
  }

  tx.init({
    token: TRANSIFEX_NATIVE_TOKEN,
    cdsHost: TRANSIFEX_CDS_HOST,
    missingPolicy: new SourceStringPolicy(),
    errorPolicy: new SourceErrorPolicy(),
  });

  preloadBundledTranslations();
  const settingsService = await getSettingsService();
  const preferredLocale = await settingsService.getSetting(
    'appLanguage',
    'system',
  );
  await applyTransifexLocale(preferredLocale);
};

export const applyTransifexLocale = async (
  preferred?: string,
): Promise<void> => {
  const locale = resolveLocale(preferred);
  await tx.setCurrentLocale(locale);
  if (!TRANSIFEX_NATIVE_TOKEN) {
    return;
  }
  const bundled = bundledTranslations[locale];
  if (bundled && Object.keys(bundled).length > 0) {
    return;
  }
  try {
    await tx.fetchTranslations(locale, { refresh: true });
  } catch (error) {
    console.warn('Transifex translation fetch failed:', error);
  }
};

export const listenToLocaleChanges = (): (() => void) => {
  const handler = () => {
    getSettingsService()
      .then(settingsService =>
        settingsService.getSetting('appLanguage', 'system').then(preferred => {
          if (preferred && preferred !== 'system') {
            return;
          }
          return applyTransifexLocale('system');
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

export { TXProvider, useT, txWithT as tx };
