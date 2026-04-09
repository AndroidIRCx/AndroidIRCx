/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useSettingsAppearance hook
 */

// Undo global mocks from jest.setup.ts
jest.unmock('../../src/hooks/useSettingsAppearance');
jest.unmock('../../src/services/ThemeService');

import { renderHook, act } from '@testing-library/react-hooks';
import { useSettingsAppearance } from '../../src/hooks/useSettingsAppearance';

const mockTheme = { id: 'dark', name: 'Dark', colors: { primary: '#000' } };
const mockThemes = [
  mockTheme,
  { id: 'light', name: 'Light', colors: { primary: '#fff' } },
];
let themeChangeCallback: ((theme: any) => void) | null = null;

jest.mock('../../src/services/ThemeService', () => ({
  themeService: {
    getCurrentTheme: jest.fn(() => mockTheme),
    getAvailableThemes: jest.fn(() => mockThemes),
    onThemeChange: jest.fn((cb: any) => {
      themeChangeCallback = cb;
      return jest.fn(() => {
        themeChangeCallback = null;
      });
    }),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn().mockResolvedValue('system'),
    setSetting: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockLayoutConfig = { viewMode: 'default', fontSize: 'medium' };

jest.mock('../../src/services/LayoutService', () => ({
  layoutService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getConfig: jest.fn(() => mockLayoutConfig),
    setConfig: jest.fn().mockResolvedValue(undefined),
  },
  ViewMode: { Default: 'default' },
  FontSize: { Medium: 'medium' },
}));

jest.mock('../../src/i18n/config', () => ({
  SUPPORTED_LOCALES: ['en', 'sr', 'de'],
}));

import { settingsService } from '../../src/services/SettingsService';
import { layoutService } from '../../src/services/LayoutService';

const flushPromises = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });

describe('useSettingsAppearance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    themeChangeCallback = null;
  });

  it('should return initial theme state', () => {
    const { result } = renderHook(() => useSettingsAppearance());

    expect(result.current.currentTheme).toEqual(mockTheme);
    expect(result.current.availableThemes).toEqual(mockThemes);
    expect(result.current.showThemeEditor).toBe(false);
    expect(result.current.editingTheme).toBeUndefined();
  });

  it('should return initial language as system', () => {
    const { result } = renderHook(() => useSettingsAppearance());

    expect(result.current.appLanguage).toBe('system');
  });

  it('should load settings on mount', async () => {
    renderHook(() => useSettingsAppearance());

    await flushPromises();

    expect(settingsService.getSetting).toHaveBeenCalledWith(
      'appLanguage',
      'system',
    );
    expect(layoutService.initialize).toHaveBeenCalled();
  });

  it('should load layout config on mount', async () => {
    const { result } = renderHook(() => useSettingsAppearance());

    await flushPromises();

    expect(result.current.layoutConfig).toEqual(mockLayoutConfig);
  });

  it('should update theme when themeService emits change', () => {
    const { result } = renderHook(() => useSettingsAppearance());

    const newTheme = {
      id: 'light',
      name: 'Light',
      colors: { primary: '#fff' },
    };

    act(() => {
      if (themeChangeCallback) {
        themeChangeCallback(newTheme);
      }
    });

    expect(result.current.currentTheme).toEqual(newTheme);
  });

  it('should set showThemeEditor', () => {
    const { result } = renderHook(() => useSettingsAppearance());

    act(() => {
      result.current.setShowThemeEditor(true);
    });

    expect(result.current.showThemeEditor).toBe(true);
  });

  it('should set editingTheme', () => {
    const { result } = renderHook(() => useSettingsAppearance());

    act(() => {
      result.current.setEditingTheme(mockTheme as any);
    });

    expect(result.current.editingTheme).toEqual(mockTheme);
  });

  it('should refresh themes', () => {
    const { themeService } = require('../../src/services/ThemeService');
    const { result } = renderHook(() => useSettingsAppearance());

    // Clear initial calls from render
    themeService.getCurrentTheme.mockClear();
    themeService.getAvailableThemes.mockClear();

    act(() => {
      result.current.refreshThemes();
    });

    expect(themeService.getCurrentTheme).toHaveBeenCalled();
    expect(themeService.getAvailableThemes).toHaveBeenCalled();
  });

  it('should set app language', async () => {
    const { result } = renderHook(() => useSettingsAppearance());

    await act(async () => {
      await result.current.setAppLanguage('sr');
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'appLanguage',
      'sr',
    );
    expect(result.current.appLanguage).toBe('sr');
  });

  it('should update layout config', async () => {
    const { result } = renderHook(() => useSettingsAppearance());

    await flushPromises();

    await act(async () => {
      await result.current.updateLayoutConfig({ viewMode: 'compact' as any });
    });

    expect(layoutService.setConfig).toHaveBeenCalledWith({
      viewMode: 'compact',
    });
    expect(layoutService.getConfig).toHaveBeenCalled();
  });

  it('should clean up theme listener on unmount', () => {
    const { unmount } = renderHook(() => useSettingsAppearance());

    unmount();

    // themeChangeCallback should be nulled out by the cleanup fn
    expect(themeChangeCallback).toBeNull();
  });
});
