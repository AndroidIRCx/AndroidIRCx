/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect } from 'react';
import { dccFileService } from '../services/DCCFileService';
import { settingsService } from '../services/SettingsService';

/**
 * Hook to configure DCC port range from settings
 */
export function useDccConfig() {
  useEffect(() => {
    const loadDcc = async () => {
      const range = await settingsService.getSetting('dccPortRange', {
        min: 5000,
        max: 6000,
      });
      if (range?.min && range?.max) {
        dccFileService.setPortRange(range.min, range.max);
      }
    };
    loadDcc();
  }, []);
}
