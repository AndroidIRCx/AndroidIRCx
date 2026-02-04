/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Hook za upravljanje temom sa primenom preporučenih podešavanja
 */

import { useState, useEffect, useCallback } from 'react';
import { themeService, Theme, ThemeColors, ThemeRecommendedSettings } from '../services/ThemeService';
import { settingsService } from '../services/SettingsService';
import { LayoutType } from '../services/LayoutService';

interface UseThemeWithSettingsReturn {
  theme: Theme;
  colors: ThemeColors;
  /** 
   * Menja temu i opciono primenjuje preporučena podešavanja
   * @param themeId - ID nove teme
   * @param applySettings - Da li primeniti preporučena podešavanja (default: false)
   * @returns Promise koji se rešava kada je tema promenjena
   */
  setTheme: (themeId: string, applySettings?: boolean) => Promise<void>;
  /** Proverava da li trenutna tema ima preporučena podešavanja */
  hasRecommendedSettings: boolean;
  /** Vraća preporučena podešavanja za trenutnu temu */
  recommendedSettings: ThemeRecommendedSettings | undefined;
}

/**
 * Mapira preporučena podešavanja teme na SettingsService ključeve
 */
async function applyThemeSettings(settings: ThemeRecommendedSettings): Promise<void> {
  const promises: Promise<void>[] = [];
  const normalizedBannerPosition = (() => {
    const pos = settings.bannerPosition;
    if (!pos) return undefined;
    switch (pos) {
      case 'above_header':
        return 'tabs_above';
      case 'below_header':
        return 'tabs_below';
      case 'bottom':
        return 'input_below';
      case 'input_above':
      case 'input_below':
      case 'tabs_above':
      case 'tabs_below':
        return pos;
      default:
        return undefined;
    }
  })();

  // Appearance settings
  if (settings.tabPosition !== undefined) {
    promises.push(settingsService.setSetting('tabPosition', settings.tabPosition));
  }
  if (settings.userListSize !== undefined) {
    promises.push(settingsService.setSetting('userListSize', settings.userListSize));
  }
  if (settings.userListNickFontSize !== undefined) {
    promises.push(settingsService.setSetting('userListNickFontSize', settings.userListNickFontSize));
  }
  if (settings.nickListTongueSize !== undefined) {
    promises.push(settingsService.setSetting('nickListTongueSize', settings.nickListTongueSize));
  }
  if (settings.fontSize !== undefined) {
    // Mapiraj font size na LayoutType
    const layoutMapping: Record<string, LayoutType> = {
      'small': 'compact',
      'medium': 'default',
      'large': 'relaxed',
      'xlarge': 'custom',
    };
    promises.push(settingsService.setSetting('layoutType', layoutMapping[settings.fontSize] || 'default'));
  }
  if (settings.messageSpacing !== undefined) {
    promises.push(settingsService.setSetting('messageSpacing', settings.messageSpacing));
  }
  if (settings.messagePadding !== undefined) {
    promises.push(settingsService.setSetting('messagePadding', settings.messagePadding));
  }
  if (settings.navigationBarOffset !== undefined) {
    promises.push(settingsService.setSetting('navigationBarOffset', settings.navigationBarOffset));
  }

  // Display & UI settings
  if (settings.noticeRouting !== undefined) {
    promises.push(settingsService.setSetting('noticeRouting', settings.noticeRouting));
  }
  if (settings.showTimestamps !== undefined) {
    promises.push(settingsService.setSetting('showTimestamps', settings.showTimestamps));
  }
  if (settings.groupMessages !== undefined) {
    promises.push(settingsService.setSetting('groupMessages', settings.groupMessages));
  }
  if (settings.messageTextAlignment !== undefined) {
    promises.push(settingsService.setSetting('messageTextAlignment', settings.messageTextAlignment));
  }
  if (settings.messageTextDirection !== undefined) {
    promises.push(settingsService.setSetting('messageTextDirection', settings.messageTextDirection));
  }
  if (settings.timestampDisplay !== undefined) {
    promises.push(settingsService.setSetting('timestampDisplay', settings.timestampDisplay));
  }
  if (settings.timestampFormat !== undefined) {
    promises.push(settingsService.setSetting('timestampFormat', settings.timestampFormat));
  }
  if (normalizedBannerPosition !== undefined) {
    promises.push(settingsService.setSetting('bannerPosition', normalizedBannerPosition));
  }
  if (settings.keyboardBehavior !== undefined) {
    promises.push(settingsService.setSetting('keyboardBehavior', settings.keyboardBehavior));
  }

  await Promise.all(promises);
}

export function useThemeWithSettings(): UseThemeWithSettingsReturn {
  const [theme, setThemeState] = useState<Theme>(themeService.getCurrentTheme());

  useEffect(() => {
    const unsubscribe = themeService.onThemeChange(newTheme => {
      setThemeState(newTheme);
    });

    return unsubscribe;
  }, []);

  const setTheme = useCallback(async (themeId: string, applySettings: boolean = false): Promise<void> => {
    const recommendedSettings = await themeService.setTheme(themeId);
    
    // Ako je traženo, primeni preporučena podešavanja
    if (applySettings && recommendedSettings) {
      await applyThemeSettings(recommendedSettings);
    }
  }, []);

  return {
    theme,
    colors: theme.colors,
    setTheme,
    hasRecommendedSettings: themeService.hasRecommendedSettings(),
    recommendedSettings: themeService.getRecommendedSettings(),
  };
}
