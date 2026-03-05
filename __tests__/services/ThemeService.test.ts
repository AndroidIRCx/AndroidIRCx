/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockStorage = new Map<string, string>();

jest.unmock('../../src/services/ThemeService');

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => (mockStorage.has(key) ? mockStorage.get(key)! : null)),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
  },
}));

jest.mock('../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        key,
      );
    },
  },
}));

import { DARK_THEME } from '../../src/themes/DarkTheme';
import { themeService } from '../../src/services/ThemeService';

describe('ThemeService', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
    (themeService as any).currentTheme = DARK_THEME;
    (themeService as any).customThemes = [];
    (themeService as any).listeners = [];
  });

  it('sets built-in theme and notifies listeners', async () => {
    const listener = jest.fn();
    const unsubscribe = themeService.onThemeChange(listener);

    await themeService.setTheme('light');

    expect(themeService.getCurrentTheme().id).toBe('light');
    expect(themeService.getColor('background')).toBe(themeService.getCurrentTheme().colors.background);
    expect(listener).toHaveBeenCalled();
    expect(mockStorage.get('@AndroidIRCX:currentTheme')).toBe('light');

    unsubscribe();
  });

  it('creates, updates and deletes custom theme', async () => {
    const custom = await themeService.createCustomTheme('My Theme', 'light');
    expect(custom.isCustom).toBe(true);
    expect(themeService.getCustomThemes().length).toBe(1);

    const updated = await themeService.updateCustomTheme(custom.id, {
      name: 'My Theme 2',
      colors: { background: '#ffffff' } as any,
    });
    expect(updated).toBe(true);
    expect(themeService.getCustomThemes()[0].name).toBe('My Theme 2');

    await themeService.setTheme(custom.id);
    const removed = await themeService.deleteCustomTheme(custom.id);
    expect(removed).toBe(true);
    expect(themeService.getCurrentTheme().id).toBe('dark');
  });

  it('exports/imports themes and validates import format', async () => {
    const exported = themeService.exportTheme('dark');
    expect(exported).toBeTruthy();
    const parsed = JSON.parse(exported as string);
    expect(parsed.version).toBe(1);
    expect(parsed.theme.name).toBeTruthy();

    const imported = await themeService.importTheme(JSON.stringify({
      theme: {
        name: 'Imported Theme',
        colors: {
          background: '#000000',
          surface: '#111111',
          text: '#ffffff',
          primary: '#00ff00',
          messageText: '#ffffff',
        },
      },
    }));
    expect(imported.success).toBe(true);
    expect(imported.theme?.isCustom).toBe(true);

    const missing = await themeService.importTheme(JSON.stringify({ theme: { name: 'Bad', colors: { background: '#000' } } }));
    expect(missing.success).toBe(false);
    expect(missing.error).toContain('missing required color');

    const badJson = await themeService.importTheme('{nope');
    expect(badJson.success).toBe(false);
    expect(badJson.error).toContain('Invalid JSON format');
  });

  it('initializes from stored custom theme id', async () => {
    const customTheme = {
      id: 'custom_x',
      name: 'Stored Custom',
      isCustom: true,
      colors: {
        ...DARK_THEME.colors,
        background: '#ffffff',
      },
    };

    mockStorage.set('@AndroidIRCX:currentTheme', 'custom_x');
    mockStorage.set('@AndroidIRCX:customThemes', JSON.stringify([customTheme]));

    await themeService.initialize();

    expect(themeService.getCurrentTheme().id).toBe('custom_x');
    expect(themeService.getColors().background).toBe('#ffffff');
    expect(themeService.getAvailableThemes().some((t) => t.id === 'custom_x')).toBe(true);
  });
});
