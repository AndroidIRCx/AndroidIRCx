/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback } from 'react';
import type { RawMessageCategory } from '../services/IRCService';
import { getDefaultRawCategoryVisibility } from '../services/IRCService';
import { settingsService } from '../services/SettingsService';
import { useUIStore } from '../stores/uiStore';

interface UseRawSettingsParams {
  setShowEncryptionIndicators: (value: boolean) => void;
}

export const useRawSettings = (params: UseRawSettingsParams) => {
  const { setShowEncryptionIndicators } = params;

  const normalizeRawCategoryVisibility = useCallback(
    (visibility?: Record<RawMessageCategory, boolean>) => ({
      ...getDefaultRawCategoryVisibility(),
      ...(visibility || {}),
    }),
    [],
  );

  const persistentSetShowRawCommands = useCallback(
    async (value: boolean) => {
      const store = useUIStore.getState();
      store.setShowRawCommands(value);
      await settingsService.setSetting('showRawCommands', value);
      if (value) {
        const currentRawCategoryVisibility = store.rawCategoryVisibility;
        const normalized = normalizeRawCategoryVisibility(
          currentRawCategoryVisibility,
        );
        store.setRawCategoryVisibility(normalized);
        await settingsService.setSetting('rawCategoryVisibility', normalized);
      }
    },
    [normalizeRawCategoryVisibility],
  );

  const persistentSetRawCategoryVisibility = useCallback(
    async (value: Record<RawMessageCategory, boolean>) => {
      const normalized = normalizeRawCategoryVisibility(value);
      const store = useUIStore.getState();
      store.setRawCategoryVisibility(normalized);
      await settingsService.setSetting('rawCategoryVisibility', normalized);
    },
    [normalizeRawCategoryVisibility],
  );

  const persistentSetShowEncryptionIndicators = useCallback(
    async (value: boolean) => {
      setShowEncryptionIndicators(value);
      await settingsService.setSetting('showEncryptionIndicators', value);
    },
    [setShowEncryptionIndicators],
  );

  return {
    persistentSetShowRawCommands,
    persistentSetRawCategoryVisibility,
    persistentSetShowEncryptionIndicators,
  };
};
