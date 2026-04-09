/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useThemeWithSettings hook
 */

// Undo global mock from jest.setup.ts
jest.unmock('../../src/services/ThemeService');

import { renderHook, act } from '@testing-library/react-hooks';
import { useThemeWithSettings } from '../../src/hooks/useThemeWithSettings';

const mockTheme = {
  id: 'dark',
  name: 'Dark',
  colors: { primary: '#000', background: '#111', text: '#fff' },
};

let themeChangeCallback: ((theme: any) => void) | null = null;

jest.mock('../../src/services/ThemeService', () => ({
  themeService: {
    getCurrentTheme: jest.fn(() => mockTheme),
    setTheme: jest.fn().mockResolvedValue(null),
    onThemeChange: jest.fn((cb: any) => {
      themeChangeCallback = cb;
      return jest.fn(() => {
        themeChangeCallback = null;
      });
    }),
    hasRecommendedSettings: jest.fn(() => false),
    getRecommendedSettings: jest.fn(() => undefined),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    setSetting: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/LayoutService', () => ({
  LayoutType: {},
}));

import { themeService } from '../../src/services/ThemeService';
import { settingsService } from '../../src/services/SettingsService';

describe('useThemeWithSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    themeChangeCallback = null;
  });

  it('should return current theme and colors', () => {
    const { result } = renderHook(() => useThemeWithSettings());

    expect(result.current.theme).toEqual(mockTheme);
    expect(result.current.colors).toEqual(mockTheme.colors);
  });

  it('should return hasRecommendedSettings and recommendedSettings', () => {
    const { result } = renderHook(() => useThemeWithSettings());

    expect(result.current.hasRecommendedSettings).toBe(false);
    expect(result.current.recommendedSettings).toBeUndefined();
  });

  it('should subscribe to theme changes', () => {
    renderHook(() => useThemeWithSettings());

    expect(themeService.onThemeChange).toHaveBeenCalled();
  });

  it('should update theme when listener fires', () => {
    const { result } = renderHook(() => useThemeWithSettings());

    const newTheme = {
      id: 'light',
      name: 'Light',
      colors: { primary: '#fff', background: '#eee', text: '#000' },
    };

    act(() => {
      if (themeChangeCallback) {
        themeChangeCallback(newTheme);
      }
    });

    expect(result.current.theme).toEqual(newTheme);
    expect(result.current.colors).toEqual(newTheme.colors);
  });

  it('should set theme without applying settings', async () => {
    const { result } = renderHook(() => useThemeWithSettings());

    await act(async () => {
      await result.current.setTheme('light');
    });

    expect(themeService.setTheme).toHaveBeenCalledWith('light');
    expect(settingsService.setSetting).not.toHaveBeenCalled();
  });

  it('should set theme and apply recommended settings when requested', async () => {
    const recommendedSettings = {
      tabPosition: 'bottom',
      fontSize: 'medium',
      showTimestamps: true,
    };

    (themeService.setTheme as jest.Mock).mockResolvedValue(recommendedSettings);

    const { result } = renderHook(() => useThemeWithSettings());

    await act(async () => {
      await result.current.setTheme('light', true);
    });

    expect(themeService.setTheme).toHaveBeenCalledWith('light');
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'tabPosition',
      'bottom',
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'layoutType',
      'default',
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'showTimestamps',
      true,
    );
  });

  it('should not apply settings when applySettings is true but no recommended settings', async () => {
    (themeService.setTheme as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useThemeWithSettings());

    await act(async () => {
      await result.current.setTheme('dark', true);
    });

    expect(settingsService.setSetting).not.toHaveBeenCalled();
  });

  it('should apply banner position normalization', async () => {
    const recommendedSettings = {
      bannerPosition: 'above_header',
    };

    (themeService.setTheme as jest.Mock).mockResolvedValue(recommendedSettings);

    const { result } = renderHook(() => useThemeWithSettings());

    await act(async () => {
      await result.current.setTheme('custom', true);
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'bannerPosition',
      'tabs_above',
    );
  });

  it('should normalize below_header to tabs_below', async () => {
    const recommendedSettings = { bannerPosition: 'below_header' };
    (themeService.setTheme as jest.Mock).mockResolvedValue(recommendedSettings);

    const { result } = renderHook(() => useThemeWithSettings());

    await act(async () => {
      await result.current.setTheme('custom', true);
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'bannerPosition',
      'tabs_below',
    );
  });

  it('should normalize bottom to input_below', async () => {
    const recommendedSettings = { bannerPosition: 'bottom' };
    (themeService.setTheme as jest.Mock).mockResolvedValue(recommendedSettings);

    const { result } = renderHook(() => useThemeWithSettings());

    await act(async () => {
      await result.current.setTheme('custom', true);
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'bannerPosition',
      'input_below',
    );
  });

  it('should pass through already-normalized banner positions', async () => {
    const recommendedSettings = { bannerPosition: 'input_above' };
    (themeService.setTheme as jest.Mock).mockResolvedValue(recommendedSettings);

    const { result } = renderHook(() => useThemeWithSettings());

    await act(async () => {
      await result.current.setTheme('custom', true);
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'bannerPosition',
      'input_above',
    );
  });

  it('should apply fontSize mapping', async () => {
    const testCases = [
      { fontSize: 'small', expected: 'compact' },
      { fontSize: 'medium', expected: 'default' },
      { fontSize: 'large', expected: 'relaxed' },
      { fontSize: 'xlarge', expected: 'custom' },
    ];

    for (const { fontSize, expected } of testCases) {
      jest.clearAllMocks();
      (themeService.setTheme as jest.Mock).mockResolvedValue({ fontSize });

      const { result } = renderHook(() => useThemeWithSettings());

      await act(async () => {
        await result.current.setTheme('theme-id', true);
      });

      expect(settingsService.setSetting).toHaveBeenCalledWith(
        'layoutType',
        expected,
      );
    }
  });

  it('should apply all setting types', async () => {
    const recommendedSettings = {
      tabPosition: 'top',
      userListSize: 120,
      userListNickFontSize: 14,
      nickListTongueSize: 8,
      messageSpacing: 4,
      messagePadding: 8,
      navigationBarOffset: 10,
      noticeRouting: 'server',
      groupMessages: true,
      messageTextAlignment: 'left',
      messageTextDirection: 'ltr',
      timestampDisplay: 'inline',
      timestampFormat: 'HH:mm',
      keyboardBehavior: 'auto',
    };

    (themeService.setTheme as jest.Mock).mockResolvedValue(recommendedSettings);

    const { result } = renderHook(() => useThemeWithSettings());

    await act(async () => {
      await result.current.setTheme('full-theme', true);
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'tabPosition',
      'top',
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'userListSize',
      120,
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'userListNickFontSize',
      14,
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'nickListTongueSize',
      8,
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'messageSpacing',
      4,
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'messagePadding',
      8,
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'navigationBarOffset',
      10,
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'noticeRouting',
      'server',
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'groupMessages',
      true,
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'messageTextAlignment',
      'left',
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'messageTextDirection',
      'ltr',
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'timestampDisplay',
      'inline',
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'timestampFormat',
      'HH:mm',
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'keyboardBehavior',
      'auto',
    );
  });

  it('should clean up theme listener on unmount', () => {
    const { unmount } = renderHook(() => useThemeWithSettings());

    unmount();

    const unsubscribeFn = (themeService.onThemeChange as jest.Mock).mock
      .results[0]?.value;
    expect(unsubscribeFn).toHaveBeenCalled();
  });
});
