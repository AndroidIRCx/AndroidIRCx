/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockStorage = new Map<string, string>();

jest.unmock('../../src/services/ThemeService');

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) =>
      mockStorage.has(key) ? mockStorage.get(key)! : null,
    ),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
  },
}));

jest.mock('../../src/i18n/localization', () => ({
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_THEME } from '../../src/themes/DarkTheme';
import { LIGHT_THEME } from '../../src/themes/LightTheme';
import { IRCAP_THEME } from '../../src/themes/IRcapTheme';
import { BUILT_IN_THEMES } from '../../src/themes';
import { themeService } from '../../src/services/ThemeService';
import { contrastRatio } from '../../src/themes/palette';

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
    expect(themeService.getColor('background')).toBe(
      themeService.getCurrentTheme().colors.background,
    );
    expect(listener).toHaveBeenCalled();
    expect(mockStorage.get('@AndroidIRCX:currentTheme')).toBe('light');

    unsubscribe();
  });

  it.each(BUILT_IN_THEMES.map(theme => [theme.name, theme.id]))(
    'normalizes readable UI text for %s',
    async (_name, themeId) => {
      await themeService.setTheme(themeId);
      const colors = themeService.getColors();
      const normalPairs = [
        ['text', 'background'],
        ['inputText', 'inputBackground'],
        ['buttonPrimaryText', 'buttonPrimary'],
        ['buttonSecondaryText', 'buttonSecondary'],
        ['tabActiveText', 'tabActive'],
        ['modalText', 'modalBackground'],
        ['userListText', 'userListBackground'],
      ] as const;
      const mutedPairs = [
        ['textSecondary', 'background'],
        ['textDisabled', 'background'],
        ['inputPlaceholder', 'inputBackground'],
        ['buttonDisabledText', 'buttonDisabled'],
        ['tabInactiveText', 'tabInactive'],
      ] as const;

      for (const [fg, bg] of normalPairs) {
        expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(
          4.5,
        );
      }
      for (const [fg, bg] of mutedPairs) {
        expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(3);
      }
    },
  );

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

    const imported = await themeService.importTheme(
      JSON.stringify({
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
      }),
    );
    expect(imported.success).toBe(true);
    expect(imported.theme?.isCustom).toBe(true);

    const missing = await themeService.importTheme(
      JSON.stringify({
        theme: { name: 'Bad', colors: { background: '#000' } },
      }),
    );
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
    expect(
      themeService.getAvailableThemes().some(t => t.id === 'custom_x'),
    ).toBe(true);
  });

  it('picks base theme from background luminance and invalid values', () => {
    const getBase = (colors: any) =>
      (themeService as any).getBaseThemeForColors(colors);

    // No background -> defaults to dark
    expect(getBase(undefined).id).toBe('dark');
    expect(getBase({}).id).toBe('dark');

    // Background not starting with '#' -> dark
    expect(getBase({ background: 'white' }).id).toBe('dark');

    // Invalid hex length (not 4 or 7) -> dark
    expect(getBase({ background: '#12345' }).id).toBe('dark');

    // Bright colors -> light theme (including 3-digit shorthand)
    expect(getBase({ background: '#ffffff' }).id).toBe('light');
    expect(getBase({ background: '#fff' }).id).toBe('light');

    // Dark colors -> dark theme
    expect(getBase({ background: '#000000' }).id).toBe('dark');
  });

  it('initializes from stored built-in dark theme id', async () => {
    mockStorage.set('@AndroidIRCX:currentTheme', 'dark');
    await themeService.initialize();
    expect(themeService.getCurrentTheme().id).toBe('dark');
    expect(themeService.getCurrentTheme().isCustom).toBe(false);
  });

  it('initializes from stored built-in light theme id', async () => {
    mockStorage.set('@AndroidIRCX:currentTheme', 'light');
    await themeService.initialize();
    expect(themeService.getCurrentTheme().id).toBe('light');
  });

  it('initializes from stored built-in ircap theme id', async () => {
    mockStorage.set('@AndroidIRCX:currentTheme', 'ircap');
    await themeService.initialize();
    expect(themeService.getCurrentTheme().id).toBe('ircap');
  });

  it('handles initialize failure gracefully', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error('storage blew up'),
    );
    await expect(themeService.initialize()).resolves.toBeUndefined();
    // Falls back to the default dark theme without throwing
    expect(themeService.getCurrentTheme().id).toBe('dark');
  });

  it('handles corrupt custom themes storage without throwing', async () => {
    mockStorage.set('@AndroidIRCX:currentTheme', 'dark');
    mockStorage.set('@AndroidIRCX:customThemes', '{not valid json');
    await themeService.initialize();
    expect(themeService.getCustomThemes()).toEqual([]);
    expect(themeService.getCurrentTheme().id).toBe('dark');
  });

  it('handles saveCustomThemes failure gracefully', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('write failed'),
    );
    const custom = await themeService.createCustomTheme('Persist Fail', 'dark');
    // Theme still added in-memory even though persistence failed
    expect(themeService.getCustomThemes().some(t => t.id === custom.id)).toBe(
      true,
    );
  });

  it('exposes recommended settings for themes that provide them', async () => {
    await themeService.setTheme('ircap');
    expect(themeService.getCurrentTheme().id).toBe('ircap');
    expect(themeService.hasRecommendedSettings()).toBe(true);
    expect(themeService.getRecommendedSettings()).toEqual(
      IRCAP_THEME.recommendedSettings,
    );

    await themeService.setTheme('dark');
    expect(themeService.hasRecommendedSettings()).toBe(false);
    expect(themeService.getRecommendedSettings()).toBeUndefined();
  });

  it('falls back to dark theme when setting an unknown theme id', async () => {
    const result = await themeService.setTheme('does-not-exist');
    expect(themeService.getCurrentTheme().id).toBe('dark');
    expect(result).toBeUndefined();
  });

  it('handles setTheme persistence failure gracefully', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('write failed'),
    );
    await themeService.setTheme('light');
    // Theme is still switched in-memory despite the save failing
    expect(themeService.getCurrentTheme().id).toBe('light');
  });

  it('returns the built-in themes including the originals', () => {
    const ids = themeService.getBuiltInThemes().map(t => t.id);
    // Originals stay first, in order.
    expect(ids.slice(0, 3)).toEqual(['dark', 'light', 'ircap']);
    // The expanded gallery is present and ids are unique.
    expect(ids).toEqual(
      expect.arrayContaining(['dracula', 'matrix', 'solarized-light']),
    );
    expect(ids.length).toBeGreaterThanOrEqual(20);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns false when updating a non-existent custom theme', async () => {
    const result = await themeService.updateCustomTheme('missing', {
      name: 'x',
    });
    expect(result).toBe(false);
  });

  it('updates message formats and syncs the active custom theme', async () => {
    const custom = await themeService.createCustomTheme('Formats', 'dark');
    await themeService.setTheme(custom.id);

    const updated = await themeService.updateCustomTheme(custom.id, {
      messageFormats: {
        ...DARK_THEME.messageFormats!,
        message: [{ type: 'text', value: 'CHANGED' }],
      } as any,
    });

    expect(updated).toBe(true);
    expect(
      themeService.getCurrentTheme().messageFormats?.message?.[0]?.value,
    ).toBe('CHANGED');
  });

  it('returns false when deleting a non-existent custom theme', async () => {
    const result = await themeService.deleteCustomTheme('missing');
    expect(result).toBe(false);
  });

  it('exports each built-in theme and returns null for unknown ids', () => {
    for (const id of ['dark', 'light', 'ircap']) {
      const exported = themeService.exportTheme(id);
      expect(exported).toBeTruthy();
      expect(JSON.parse(exported as string).theme.name).toBeTruthy();
    }
    expect(themeService.exportTheme('nope')).toBeNull();
  });

  it('exports a custom theme by id', async () => {
    const custom = await themeService.createCustomTheme('Exportable', 'dark');
    const exported = themeService.exportTheme(custom.id);
    expect(exported).toBeTruthy();
    expect(JSON.parse(exported as string).theme.name).toBe('Exportable');
  });

  it('rejects import when the theme object is missing', async () => {
    const result = await themeService.importTheme(JSON.stringify({}));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid theme file format');
  });

  it('renames imported theme when a name collision exists', async () => {
    const payload = JSON.stringify({
      theme: {
        name: 'Duplicate Name',
        colors: {
          background: '#000000',
          surface: '#111111',
          text: '#ffffff',
          primary: '#00ff00',
          messageText: '#ffffff',
        },
      },
    });

    const first = await themeService.importTheme(payload);
    const second = await themeService.importTheme(payload);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(first.theme?.name).toBe('Duplicate Name');
    expect(second.theme?.name).not.toBe('Duplicate Name');
    expect(second.theme?.name).toContain('Duplicate Name');
  });

  it('exports the current theme', async () => {
    await themeService.setTheme('light');
    const exported = themeService.exportCurrentTheme();
    expect(exported).toBeTruthy();
    expect(JSON.parse(exported).theme.name).toBe(LIGHT_THEME.name);
  });
});
