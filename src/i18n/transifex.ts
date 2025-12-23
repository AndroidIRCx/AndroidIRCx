import { tx, SourceErrorPolicy, SourceStringPolicy, normalizeLocale } from '@transifex/native';
import { TXProvider, useT } from '@transifex/react';
import * as RNLocalize from 'react-native-localize';

import { bundledTranslations } from './translations';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, TRANSIFEX_CDS_HOST, TRANSIFEX_NATIVE_TOKEN } from './config';
import { settingsService } from '../services/SettingsService';

const resolveLocale = (preferred?: string): string => {
  if (preferred && preferred !== 'system') {
    return normalizeLocale(preferred);
  }
  const best = RNLocalize.findBestLanguageTag(SUPPORTED_LOCALES);
  return normalizeLocale(best?.languageTag || DEFAULT_LOCALE);
};

const preloadBundledTranslations = () => {
  Object.entries(bundledTranslations).forEach(([locale, translations]) => {
    if (translations && Object.keys(translations).length > 0) {
      tx.cache.update(locale, translations);
    }
  });
};

export const initTransifex = async (): Promise<void> => {
  if (!TRANSIFEX_NATIVE_TOKEN) {
    console.warn('Transifex Native token missing; translations will use source strings.');
    return;
  }

  tx.init({
    token: TRANSIFEX_NATIVE_TOKEN,
    cdsHost: TRANSIFEX_CDS_HOST,
    missingPolicy: new SourceStringPolicy(),
    errorPolicy: new SourceErrorPolicy(),
  });

  preloadBundledTranslations();
  const preferredLocale = await settingsService.getSetting('appLanguage', 'system');
  await applyTransifexLocale(preferredLocale);
};

export const applyTransifexLocale = async (preferred?: string): Promise<void> => {
  if (!TRANSIFEX_NATIVE_TOKEN) {
    return;
  }
  const locale = resolveLocale(preferred);
  await tx.setCurrentLocale(locale);
  await tx.fetchTranslations(locale, { refresh: true });
};

export const listenToLocaleChanges = (): (() => void) => {
  const handler = () => {
    settingsService
      .getSetting('appLanguage', 'system')
      .then(preferred => {
        if (preferred && preferred !== 'system') {
          return;
        }
        return applyTransifexLocale('system');
      })
      .catch(() => {});
  };

  const addListener =
    (RNLocalize as { addEventListener?: (event: string, cb: () => void) => void })
      .addEventListener ??
    (RNLocalize as { addListener?: (event: string, cb: () => void) => void }).addListener;
  const removeListener =
    (RNLocalize as { removeEventListener?: (event: string, cb: () => void) => void })
      .removeEventListener ??
    (RNLocalize as { removeListener?: (event: string, cb: () => void) => void }).removeListener;

  if (!addListener || !removeListener) {
    return () => {};
  }

  addListener('change', handler);
  return () => removeListener('change', handler);
};

export { TXProvider, useT, tx };
