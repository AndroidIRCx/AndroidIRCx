/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Comprehensive tests for AppearanceSection component
 */

import React from 'react';
import { Alert, Platform } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { AppearanceSection } from '../../../src/components/settings/sections/AppearanceSection';

const mockCapturedItems = new Map<string, any>();
const mockSettingsSet = jest.fn(async () => undefined);
const mockSettingsGet = jest.fn(async (_k: string, d: any) => d);
const mockSettingsOnChange = jest.fn(() => jest.fn());
const mockUpdateLayoutConfig = jest.fn(async () => undefined);
const mockSetAppLanguage = jest.fn(async () => undefined);
const mockRefreshThemes = jest.fn();
const mockLayoutSetUserListSizePx = jest.fn(async () => undefined);
const mockLayoutSetUserListNickFontSizePx = jest.fn(async () => undefined);
const mockLayoutSetConfig = jest.fn(async () => undefined);
const mockLayoutSetFontSize = jest.fn(async () => undefined);
const mockLayoutSetFontSizeValue = jest.fn(async () => undefined);
const mockLayoutSetTabPosition = jest.fn(async () => undefined);
const mockLayoutSetUserListPosition = jest.fn(async () => undefined);
const mockLayoutSetViewMode = jest.fn(async () => undefined);
const mockLayoutSetMessageSpacing = jest.fn(async () => undefined);
const mockLayoutSetMessagePadding = jest.fn(async () => undefined);
const mockLayoutSetNavigationBarOffset = jest.fn(async () => undefined);
const mockThemeSetTheme = jest.fn(async () => undefined);
const mockThemeExportCurrentTheme = jest.fn(() => '{}');
const mockThemeImportTheme = jest.fn(async () => ({ success: true }));
const mockThemeDeleteCustomTheme = jest.fn(async () => undefined);
const mockPick = jest.fn(async () => []);
const mockRNFSWriteFile = jest.fn(async () => undefined);
const mockRNFSReadFile = jest.fn(async () => '{}');
const mockRNFSUnlink = jest.fn(async () => undefined);

// Mock modules
jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: any) => {
    if (params?.name) return `${key} (${params.name})`;
    if (params?.path) return `${key} at ${params.path}`;
    return key;
  },
  applyTransifexLocale: jest.fn(async () => undefined),
}));

jest.mock('../../../src/components/settings/SettingItem', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    SettingItem: ({ item, onPress }: any) => {
      mockCapturedItems.set(item.id, item);
      return React.createElement(
        TouchableOpacity,
        {
          testID: `setting-${item.id}`,
          onPress: () => {
            item.onPress?.();
            if (item.type === 'switch') item.onValueChange?.(!item.value);
            if (item.type === 'input') item.onValueChange?.('42');
            if (item.type === 'submenu') onPress?.(item.id);
          },
        },
        React.createElement(Text, null, item.title || item.id),
      );
    },
  };
});

// Track hook return values for dynamic modification
let mockAvailableThemes = [
  { id: 'dark', name: 'Dark', isCustom: false },
  { id: 'light', name: 'Light', isCustom: false },
  { id: 'custom_ocean', name: 'Ocean', isCustom: true },
];

jest.mock('../../../src/hooks/useSettingsAppearance', () => ({
  useSettingsAppearance: () => ({
    currentTheme: { id: 'dark', name: 'Dark' },
    availableThemes: mockAvailableThemes,
    layoutConfig: {
      userListPosition: 'left',
      userListSizePx: 150,
      userListNickFontSizePx: 13,
      viewMode: 'comfortable',
      fontSize: 'medium',
      fontSizeValues: { small: 12, medium: 14, large: 16, custom: 18 },
      messageSpacing: 8,
      messagePadding: 8,
      navigationBarOffset: 0,
      tabPosition: 'top',
    },
    appLanguage: 'en',
    refreshThemes: mockRefreshThemes,
    setAppLanguage: (...args: any[]) => mockSetAppLanguage(...args),
    updateLayoutConfig: (...args: any[]) => mockUpdateLayoutConfig(...args),
  }),
}));

jest.mock('../../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: any[]) => mockSettingsGet(...args),
    setSetting: (...args: any[]) => mockSettingsSet(...args),
    onSettingChange: (...args: any[]) => mockSettingsOnChange(...args),
  },
}));

jest.mock('../../../src/services/ThemeService', () => ({
  themeService: {
    setTheme: (...args: any[]) => mockThemeSetTheme(...args),
    exportCurrentTheme: () => mockThemeExportCurrentTheme(),
    importTheme: (...args: any[]) => mockThemeImportTheme(...args),
    deleteCustomTheme: (...args: any[]) => mockThemeDeleteCustomTheme(...args),
  },
}));

jest.mock('../../../src/services/LayoutService', () => ({
  layoutService: {
    setUserListSizePx: (...args: any[]) => mockLayoutSetUserListSizePx(...args),
    setUserListNickFontSizePx: (...args: any[]) =>
      mockLayoutSetUserListNickFontSizePx(...args),
    setConfig: (...args: any[]) => mockLayoutSetConfig(...args),
    setFontSize: (...args: any[]) => mockLayoutSetFontSize(...args),
    setFontSizeValue: (...args: any[]) => mockLayoutSetFontSizeValue(...args),
    setTabPosition: (...args: any[]) => mockLayoutSetTabPosition(...args),
    setUserListPosition: (...args: any[]) =>
      mockLayoutSetUserListPosition(...args),
    setViewMode: (...args: any[]) => mockLayoutSetViewMode(...args),
    setMessageSpacing: (...args: any[]) => mockLayoutSetMessageSpacing(...args),
    setMessagePadding: (...args: any[]) => mockLayoutSetMessagePadding(...args),
    setNavigationBarOffset: (...args: any[]) =>
      mockLayoutSetNavigationBarOffset(...args),
  },
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: (...args: any[]) => mockPick(...args),
  types: { json: 'application/json', allFiles: '*/*' },
  isErrorWithCode: jest.fn(() => false),
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
}));

jest.mock('react-native-fs', () => ({
  DownloadDirectoryPath: '/downloads',
  DocumentDirectoryPath: '/docs',
  writeFile: (...args: any[]) => mockRNFSWriteFile(...args),
  readFile: (...args: any[]) => mockRNFSReadFile(...args),
  unlink: (...args: any[]) => mockRNFSUnlink(...args),
}));

jest.mock('../../../src/i18n/config', () => ({
  SUPPORTED_LOCALES: ['en', 'sr', 'de', 'fr'],
}));

const colors = {
  text: '#111',
  textSecondary: '#666',
  textDisabled: '#777',
  primary: '#0af',
  surface: '#fff',
  border: '#ddd',
  background: '#000',
};

const styles = {
  settingItem: {},
  settingContent: {},
  settingTitleRow: {},
  settingTitle: {},
  settingDescription: {},
  disabledItem: {},
  disabledText: {},
  chevron: {},
  input: {},
  disabledInput: {},
};

describe('AppearanceSection', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    Platform.OS = 'ios';
    // Reset themes
    mockAvailableThemes = [
      { id: 'dark', name: 'Dark', isCustom: false },
      { id: 'light', name: 'Light', isCustom: false },
      { id: 'custom_ocean', name: 'Ocean', isCustom: true },
    ];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders all main setting items', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{
            en: 'English',
            sr: 'Serbian',
            de: 'German',
            fr: 'French',
          }}
        />,
      );

      await waitFor(() => {
        expect(mockCapturedItems.has('display-theme')).toBe(true);
        expect(mockCapturedItems.has('app-language')).toBe(true);
        expect(mockCapturedItems.has('layout-tab-position')).toBe(true);
        expect(mockCapturedItems.has('layout-userlist-position')).toBe(true);
        expect(mockCapturedItems.has('layout-userlist-size')).toBe(true);
        expect(mockCapturedItems.has('layout-userlist-nick-font-size')).toBe(
          true,
        );
        expect(mockCapturedItems.has('layout-view-mode')).toBe(true);
        expect(mockCapturedItems.has('layout-font-size')).toBe(true);
        expect(mockCapturedItems.has('header-search-button')).toBe(true);
        expect(mockCapturedItems.has('message-area-search-button')).toBe(true);
        expect(mockCapturedItems.has('layout-message-spacing')).toBe(true);
        expect(mockCapturedItems.has('layout-message-padding')).toBe(true);
        expect(mockCapturedItems.has('layout-navigation-bar-offset')).toBe(
          true,
        );
        expect(mockCapturedItems.has('layout-userlist-reset-defaults')).toBe(
          true,
        );
        expect(mockCapturedItems.has('layout-nicklist-tongue-enabled')).toBe(
          true,
        );
        expect(mockCapturedItems.has('layout-nicklist-tongue-size')).toBe(true);
      });
    });
  });

  describe('Theme Selection', () => {
    it('handles theme selection without recommended settings', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      // Select dark theme (no recommended settings)
      await mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-dark')
        .onPress();

      expect(mockThemeSetTheme).toHaveBeenCalledWith('dark');
      expect(mockRefreshThemes).toHaveBeenCalled();
    });

    it('handles theme selection with recommended settings - Theme Only option', async () => {
      // Add theme with recommended settings
      const themeWithSettings = {
        id: 'custom_special',
        name: 'Special',
        isCustom: true,
        recommendedSettings: {
          fontSize: 'large',
          tabPosition: 'bottom',
        },
      };
      mockAvailableThemes = [...mockAvailableThemes, themeWithSettings];

      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      const themeItem = mockCapturedItems.get('display-theme');
      const specialThemeButton = themeItem.submenuItems.find(
        (x: any) => x.id === 'theme-custom_special',
      );

      expect(specialThemeButton).toBeTruthy();
      await specialThemeButton.onPress();

      // Should show alert with options
      expect(Alert.alert).toHaveBeenCalledWith(
        expect.stringContaining('Apply Theme Settings'),
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.stringContaining('Theme Only'),
          }),
          expect.objectContaining({
            text: expect.stringContaining('Apply All'),
          }),
        ]),
      );

      // Click "Theme Only"
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const themeAlert = alertCalls.find((c: any[]) =>
        String(c[0]).includes('Apply Theme Settings'),
      );
      const themeOnlyBtn = themeAlert?.[2]?.find((b: any) =>
        String(b.text).includes('Theme Only'),
      );
      await themeOnlyBtn?.onPress?.();

      expect(mockThemeSetTheme).toHaveBeenCalledWith('custom_special');
    });

    it('handles theme selection with recommended settings - Apply All option', async () => {
      // Add theme with recommended settings
      const themeWithSettings = {
        id: 'custom_special',
        name: 'Special',
        isCustom: true,
        recommendedSettings: {
          fontSize: 'large',
          tabPosition: 'bottom',
          userListSize: 200,
          messageSpacing: 10,
        },
      };
      mockAvailableThemes = [...mockAvailableThemes, themeWithSettings];

      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      const themeItem = mockCapturedItems.get('display-theme');
      const specialThemeButton = themeItem.submenuItems.find(
        (x: any) => x.id === 'theme-custom_special',
      );

      expect(specialThemeButton).toBeTruthy();
      await specialThemeButton.onPress();

      // Click "Apply All"
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const themeAlert = alertCalls.find((c: any[]) =>
        String(c[0]).includes('Apply Theme Settings'),
      );
      const applyAllBtn = themeAlert?.[2]?.find((b: any) =>
        String(b.text).includes('Apply All'),
      );
      await applyAllBtn?.onPress?.();

      expect(mockThemeSetTheme).toHaveBeenCalledWith('custom_special');
      expect(mockLayoutSetFontSize).toHaveBeenCalledWith('large');
      expect(mockLayoutSetTabPosition).toHaveBeenCalledWith('bottom');
      expect(mockLayoutSetUserListSizePx).toHaveBeenCalledWith(200);
    });

    it('handles create new theme button', async () => {
      const onShowThemeEditor = jest.fn();
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={onShowThemeEditor}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      await mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-new')
        .onPress();

      expect(onShowThemeEditor).toHaveBeenCalledWith(undefined);
    });

    it('handles edit custom theme button', async () => {
      const onShowThemeEditor = jest.fn();
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={onShowThemeEditor}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      await mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-edit-custom_ocean')
        .onPress();

      expect(onShowThemeEditor).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'custom_ocean', name: 'Ocean' }),
      );
    });

    it('handles delete custom theme with cancel', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-delete-custom_ocean')
        .onPress();

      expect(Alert.alert).toHaveBeenCalledWith(
        expect.stringContaining('Delete Theme'),
        expect.stringContaining('Ocean'),
        expect.arrayContaining([
          expect.objectContaining({ style: 'cancel' }),
          expect.objectContaining({ style: 'destructive' }),
        ]),
      );

      // Click Cancel
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const deleteAlert = alertCalls.find((c: any[]) =>
        String(c[0]).includes('Delete Theme'),
      );
      const cancelBtn = deleteAlert?.[2]?.find(
        (b: any) => b.style === 'cancel',
      );
      await cancelBtn?.onPress?.();

      expect(mockThemeDeleteCustomTheme).not.toHaveBeenCalled();
    });

    it('handles delete custom theme with confirm', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-delete-custom_ocean')
        .onPress();

      // Click Delete
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const deleteAlert = alertCalls.find((c: any[]) =>
        String(c[0]).includes('Delete Theme'),
      );
      const deleteBtn = deleteAlert?.[2]?.find(
        (b: any) => b.style === 'destructive',
      );
      await deleteBtn?.onPress?.();

      expect(mockThemeDeleteCustomTheme).toHaveBeenCalledWith('custom_ocean');
      expect(mockRefreshThemes).toHaveBeenCalled();
    });
  });

  describe('Theme Export/Import', () => {
    it('handles theme export successfully', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      await mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-export')
        .onPress();

      await waitFor(() => {
        expect(mockThemeExportCurrentTheme).toHaveBeenCalled();
        expect(mockRNFSWriteFile).toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining('Theme Exported'),
          expect.anything(),
          expect.anything(),
        );
      });
    });

    it('handles theme export failure', async () => {
      mockThemeExportCurrentTheme.mockReturnValueOnce(null);

      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      await mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-export')
        .onPress();

      expect(Alert.alert).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        expect.anything(),
      );
    });

    it('handles theme export on Android', async () => {
      Platform.OS = 'android';

      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      await mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-export')
        .onPress();

      expect(mockRNFSWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('/downloads/'),
        expect.anything(),
        'utf8',
      );
    });

    it('handles theme import successfully with use now', async () => {
      const importedTheme = { id: 'imported', name: 'Imported Theme' };
      mockPick.mockResolvedValueOnce([{ uri: 'file:///path/to/theme.json' }]);
      mockRNFSReadFile.mockResolvedValueOnce('{"name": "Imported Theme"}');
      mockThemeImportTheme.mockResolvedValueOnce({
        success: true,
        theme: importedTheme,
      });

      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      await mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-import')
        .onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining('Theme Imported'),
          expect.stringContaining('Imported Theme'),
          expect.anything(),
        );
      });

      // Click "Use Now"
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const importAlert = alertCalls.find((c: any[]) =>
        String(c[0]).includes('Theme Imported'),
      );
      const useNowBtn = importAlert?.[2]?.find((b: any) =>
        String(b.text).includes('Use Now'),
      );
      await useNowBtn?.onPress?.();

      expect(mockThemeSetTheme).toHaveBeenCalledWith('imported');
    });

    it('handles theme import with later option', async () => {
      const importedTheme = { id: 'imported', name: 'Imported Theme' };
      mockPick.mockResolvedValueOnce([{ uri: 'file:///path/to/theme.json' }]);
      mockRNFSReadFile.mockResolvedValueOnce('{"name": "Imported Theme"}');
      mockThemeImportTheme.mockResolvedValueOnce({
        success: true,
        theme: importedTheme,
      });

      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      await mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-import')
        .onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining('Theme Imported'),
          expect.anything(),
          expect.anything(),
        );
      });

      // Click "Later"
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const importAlert = alertCalls.find((c: any[]) =>
        String(c[0]).includes('Theme Imported'),
      );
      const laterBtn = importAlert?.[2]?.find((b: any) => b.style === 'cancel');
      await laterBtn?.onPress?.();

      expect(mockThemeSetTheme).not.toHaveBeenCalled();
    });

    it('handles theme import failure', async () => {
      mockPick.mockResolvedValueOnce([{ uri: 'file:///path/to/theme.json' }]);
      mockRNFSReadFile.mockResolvedValueOnce('invalid json');
      mockThemeImportTheme.mockResolvedValueOnce({
        success: false,
        error: 'Invalid theme format',
      });

      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      await mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-import')
        .onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining('Import Failed'),
          expect.stringContaining('Invalid theme format'),
        );
      });
    });

    it('handles theme import cancellation', async () => {
      const {
        isErrorWithCode,
        errorCodes,
      } = require('@react-native-documents/picker');
      isErrorWithCode.mockReturnValueOnce(true);
      mockPick.mockRejectedValueOnce({ code: errorCodes.OPERATION_CANCELED });

      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      await mockCapturedItems
        .get('display-theme')
        .submenuItems.find((x: any) => x.id === 'theme-import')
        .onPress();

      // Should not show any alert for cancellation
      const errorAlerts = (Alert.alert as jest.Mock).mock.calls.filter(
        (c: any[]) => String(c[0]).includes('Error'),
      );
      expect(errorAlerts).toHaveLength(0);
    });
  });

  describe('Language Selection', () => {
    it('handles system language selection', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{
            en: 'English',
            sr: 'Serbian',
            de: 'German',
            fr: 'French',
          }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('app-language')).toBe(true),
      );

      await mockCapturedItems
        .get('app-language')
        .submenuItems.find((x: any) => x.id === 'language-system')
        .onPress();

      expect(mockSetAppLanguage).toHaveBeenCalledWith('system');
    });

    it('handles specific language selection', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{
            en: 'English',
            sr: 'Serbian',
            de: 'German',
            fr: 'French',
          }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('app-language')).toBe(true),
      );

      await mockCapturedItems
        .get('app-language')
        .submenuItems.find((x: any) => x.id === 'language-de')
        .onPress();

      expect(mockSetAppLanguage).toHaveBeenCalledWith('de');

      await mockCapturedItems
        .get('app-language')
        .submenuItems.find((x: any) => x.id === 'language-fr')
        .onPress();

      expect(mockSetAppLanguage).toHaveBeenCalledWith('fr');
    });
  });

  describe('Tab Position', () => {
    it('handles all tab position options', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-tab-position')).toBe(true),
      );

      const positions = ['top', 'bottom', 'left', 'right'];
      for (const position of positions) {
        await mockCapturedItems
          .get('layout-tab-position')
          .submenuItems.find(
            (x: any) => x.id === `layout-tab-position-${position}`,
          )
          .onPress();

        expect(mockLayoutSetTabPosition).toHaveBeenCalledWith(position);
      }
    });
  });

  describe('User List Position', () => {
    it('handles all user list position options', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-userlist-position')).toBe(true),
      );

      mockCapturedItems.get('layout-userlist-position').onPress();

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const positionAlert = alertCalls.find((c: any[]) =>
        String(c[0]).includes('User List Position'),
      );
      expect(positionAlert).toBeTruthy();

      const positions = ['Left', 'Right', 'Top', 'Bottom'];
      for (const position of positions) {
        const btn = positionAlert?.[2]?.find((b: any) => b.text === position);
        await btn?.onPress?.();
        expect(mockLayoutSetUserListPosition).toHaveBeenCalledWith(
          position.toLowerCase(),
        );
      }
    });
  });

  describe('User List Size Input', () => {
    it('handles valid user list size input', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-userlist-size')).toBe(true),
      );

      const inputItem = mockCapturedItems.get('layout-userlist-size');

      // Valid input
      await inputItem.onValueChange('200');
      expect(mockLayoutSetUserListSizePx).toHaveBeenCalledWith(200);
    });

    it('handles invalid user list size input - not a number', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-userlist-size')).toBe(true),
      );

      const inputItem = mockCapturedItems.get('layout-userlist-size');

      // Invalid input - not a number - should set error state
      await inputItem.onValueChange('abc');
      // The error is tracked in component state and won't be reflected on the item object
      // We verify that the service was not called with invalid value
      expect(mockLayoutSetUserListSizePx).not.toHaveBeenCalled();
    });

    it('handles invalid user list size input - zero or negative', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-userlist-size')).toBe(true),
      );

      const inputItem = mockCapturedItems.get('layout-userlist-size');

      // Invalid input - zero
      await inputItem.onValueChange('0');
      expect(mockLayoutSetUserListSizePx).not.toHaveBeenCalledWith(0);

      // Invalid input - negative
      await inputItem.onValueChange('-10');
      expect(mockLayoutSetUserListSizePx).not.toHaveBeenCalledWith(-10);
    });

    it('handles empty user list size input', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-userlist-size')).toBe(true),
      );

      const inputItem = mockCapturedItems.get('layout-userlist-size');

      // Empty input - should not error and should not call service
      await inputItem.onValueChange('');
      // Empty value just clears the error state, no service call
    });
  });

  describe('User List Nick Font Size Input', () => {
    it('handles valid nick font size input', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-userlist-nick-font-size')).toBe(
          true,
        ),
      );

      const inputItem = mockCapturedItems.get('layout-userlist-nick-font-size');

      await inputItem.onValueChange('16');
      expect(mockLayoutSetUserListNickFontSizePx).toHaveBeenCalledWith(16);
    });

    it('handles invalid nick font size input', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-userlist-nick-font-size')).toBe(
          true,
        ),
      );

      const inputItem = mockCapturedItems.get('layout-userlist-nick-font-size');

      // Invalid inputs
      await inputItem.onValueChange('invalid');
      await inputItem.onValueChange('0');

      expect(mockLayoutSetUserListNickFontSizePx).not.toHaveBeenCalledWith(NaN);
      expect(mockLayoutSetUserListNickFontSizePx).not.toHaveBeenCalledWith(0);
    });
  });

  describe('Reset User List Defaults', () => {
    it('resets user list settings to defaults', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-userlist-reset-defaults')).toBe(
          true,
        ),
      );

      await mockCapturedItems.get('layout-userlist-reset-defaults').onPress();

      expect(mockLayoutSetUserListSizePx).toHaveBeenCalledWith(150);
      expect(mockLayoutSetUserListNickFontSizePx).toHaveBeenCalledWith(13);
      expect(mockUpdateLayoutConfig).toHaveBeenCalled();
    });
  });

  describe('Nicklist Tongue Settings', () => {
    it('handles tongue enabled toggle', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-nicklist-tongue-enabled')).toBe(
          true,
        ),
      );

      const switchItem = mockCapturedItems.get(
        'layout-nicklist-tongue-enabled',
      );
      await switchItem.onValueChange(false);

      expect(mockSettingsSet).toHaveBeenCalledWith(
        'nicklistTongueEnabled',
        false,
      );
    });

    it('handles tongue size input', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-nicklist-tongue-size')).toBe(true),
      );

      const inputItem = mockCapturedItems.get('layout-nicklist-tongue-size');

      // Valid input
      await inputItem.onValueChange('64');
      expect(mockSettingsSet).toHaveBeenCalledWith('nicklistTongueSizePx', 64);
    });

    it('handles invalid tongue size input', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-nicklist-tongue-size')).toBe(true),
      );

      const inputItem = mockCapturedItems.get('layout-nicklist-tongue-size');

      // Invalid inputs
      await inputItem.onValueChange('invalid');
      await inputItem.onValueChange('0');
      await inputItem.onValueChange('-5');

      expect(mockSettingsSet).not.toHaveBeenCalledWith(
        'nicklistTongueSizePx',
        NaN,
      );
      expect(mockSettingsSet).not.toHaveBeenCalledWith(
        'nicklistTongueSizePx',
        0,
      );
      expect(mockSettingsSet).not.toHaveBeenCalledWith(
        'nicklistTongueSizePx',
        -5,
      );
    });

    it('handles empty tongue size input', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-nicklist-tongue-size')).toBe(true),
      );

      const inputItem = mockCapturedItems.get('layout-nicklist-tongue-size');

      // Empty input - should not error
      await inputItem.onValueChange('');
    });
  });

  describe('View Mode', () => {
    it('handles all view mode options', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-view-mode')).toBe(true),
      );

      mockCapturedItems.get('layout-view-mode').onPress();

      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const viewModeAlert = alertCalls.find((c: any[]) =>
        String(c[0]).includes('View Mode'),
      );
      expect(viewModeAlert).toBeTruthy();

      const modes = ['Compact', 'Comfortable', 'Spacious'];
      for (const mode of modes) {
        const btn = viewModeAlert?.[2]?.find((b: any) => b.text === mode);
        await btn?.onPress?.();
        expect(mockLayoutSetViewMode).toHaveBeenCalledWith(mode.toLowerCase());
      }
    });
  });

  describe('Font Size Settings', () => {
    it('handles all font size preset options', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-font-size')).toBe(true),
      );

      const presets = [
        { id: 'font-size-small', value: 'small' },
        { id: 'font-size-medium', value: 'medium' },
        { id: 'font-size-large', value: 'large' },
        { id: 'font-size-custom', value: 'custom' },
      ];

      for (const preset of presets) {
        await mockCapturedItems
          .get('layout-font-size')
          .submenuItems.find((x: any) => x.id === preset.id)
          .onPress();

        expect(mockLayoutSetFontSize).toHaveBeenCalledWith(preset.value);
      }
    });

    it('handles font size value inputs', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-font-size')).toBe(true),
      );

      const sizeInputs = [
        { id: 'font-size-value-small', key: 'small', value: '10' },
        { id: 'font-size-value-medium', key: 'medium', value: '14' },
        { id: 'font-size-value-large', key: 'large', value: '18' },
        { id: 'font-size-value-custom', key: 'custom', value: '20' },
      ];

      for (const input of sizeInputs) {
        await mockCapturedItems
          .get('layout-font-size')
          .submenuItems.find((x: any) => x.id === input.id)
          .onValueChange(input.value);

        expect(mockLayoutSetFontSizeValue).toHaveBeenCalledWith(
          input.key,
          parseInt(input.value, 10),
        );
      }
    });

    it('handles invalid font size value inputs', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-font-size')).toBe(true),
      );

      // Invalid input should not call setFontSizeValue
      await mockCapturedItems
        .get('layout-font-size')
        .submenuItems.find((x: any) => x.id === 'font-size-value-medium')
        .onValueChange('invalid');

      expect(mockLayoutSetFontSizeValue).not.toHaveBeenCalledWith(
        'medium',
        NaN,
      );
    });
  });

  describe('Search Button Settings', () => {
    it('handles header search button toggle', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('header-search-button')).toBe(true),
      );

      const switchItem = mockCapturedItems.get('header-search-button');
      await switchItem.onValueChange(false);

      expect(mockSettingsSet).toHaveBeenCalledWith(
        'showHeaderSearchButton',
        false,
      );
    });

    it('handles message area search button toggle', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('message-area-search-button')).toBe(true),
      );

      const switchItem = mockCapturedItems.get('message-area-search-button');
      await switchItem.onValueChange(true);

      expect(mockSettingsSet).toHaveBeenCalledWith(
        'showMessageAreaSearchButton',
        true,
      );
    });
  });

  describe('Message Spacing and Padding', () => {
    it('handles message spacing input', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-message-spacing')).toBe(true),
      );

      const inputItem = mockCapturedItems.get('layout-message-spacing');

      // Valid input within range (0-20)
      await inputItem.onValueChange('12');
      expect(mockLayoutSetMessageSpacing).toHaveBeenCalledWith(12);
    });

    it('handles message spacing out of range', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-message-spacing')).toBe(true),
      );

      const inputItem = mockCapturedItems.get('layout-message-spacing');

      // Out of range values should not be applied
      await inputItem.onValueChange('25');
      await inputItem.onValueChange('-5');

      expect(mockLayoutSetMessageSpacing).not.toHaveBeenCalledWith(25);
      expect(mockLayoutSetMessageSpacing).not.toHaveBeenCalledWith(-5);
    });

    it('handles message padding input', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-message-padding')).toBe(true),
      );

      const inputItem = mockCapturedItems.get('layout-message-padding');

      // Valid input within range (0-20)
      await inputItem.onValueChange('12');
      expect(mockLayoutSetMessagePadding).toHaveBeenCalledWith(12);
    });

    it('handles invalid message padding input', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-message-padding')).toBe(true),
      );

      const inputItem = mockCapturedItems.get('layout-message-padding');

      // Invalid inputs should not be applied
      await inputItem.onValueChange('invalid');
      await inputItem.onValueChange('30');

      expect(mockLayoutSetMessagePadding).not.toHaveBeenCalledWith(NaN);
      expect(mockLayoutSetMessagePadding).not.toHaveBeenCalledWith(30);
    });
  });

  describe('Navigation Bar Offset', () => {
    it('handles navigation bar offset input', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-navigation-bar-offset')).toBe(
          true,
        ),
      );

      const inputItem = mockCapturedItems.get('layout-navigation-bar-offset');

      // Valid input within range (0-100)
      await inputItem.onValueChange('48');
      expect(mockLayoutSetNavigationBarOffset).toHaveBeenCalledWith(48);
    });

    it('handles navigation bar offset out of range', async () => {
      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('layout-navigation-bar-offset')).toBe(
          true,
        ),
      );

      const inputItem = mockCapturedItems.get('layout-navigation-bar-offset');

      // Out of range values should not be applied
      await inputItem.onValueChange('150');
      await inputItem.onValueChange('-10');

      expect(mockLayoutSetNavigationBarOffset).not.toHaveBeenCalledWith(150);
      expect(mockLayoutSetNavigationBarOffset).not.toHaveBeenCalledWith(-10);
    });
  });

  describe('Apply Theme Settings - Comprehensive', () => {
    it('applies all theme recommended settings correctly', async () => {
      // Create a theme with all possible recommended settings
      const comprehensiveTheme = {
        id: 'comprehensive',
        name: 'Comprehensive',
        isCustom: true,
        recommendedSettings: {
          fontSize: 'xlarge',
          userListSize: 180,
          userListNickFontSize: 15,
          nickListTongueSize: 64,
          messageSpacing: 6,
          messagePadding: 10,
          navigationBarOffset: 24,
          tabPosition: 'bottom',
          noticeRouting: 'active',
          showTimestamps: true,
          groupMessages: true,
          messageTextAlignment: 'left',
          messageTextDirection: 'ltr',
          timestampDisplay: 'all',
          timestampFormat: '24h',
          bannerPosition: 'below_header',
          keyboardBehavior: 'persistent',
        },
      };
      mockAvailableThemes = [comprehensiveTheme];

      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      const themeItem = mockCapturedItems.get('display-theme');
      const themeButton = themeItem.submenuItems.find(
        (x: any) => x.id === 'theme-comprehensive',
      );

      expect(themeButton).toBeTruthy();
      await themeButton.onPress();

      // Click "Apply All"
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const themeAlert = alertCalls.find((c: any[]) =>
        String(c[0]).includes('Apply Theme Settings'),
      );
      const applyAllBtn = themeAlert?.[2]?.find((b: any) =>
        String(b.text).includes('Apply All'),
      );
      await applyAllBtn?.onPress?.();

      // Verify all settings were applied
      expect(mockLayoutSetUserListSizePx).toHaveBeenCalledWith(180);
      expect(mockLayoutSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({ userListNickFontSizePx: 15 }),
      );
      expect(mockSettingsSet).toHaveBeenCalledWith('nicklistTongueSizePx', 64);
      expect(mockLayoutSetFontSize).toHaveBeenCalledWith('custom'); // xlarge maps to custom
      expect(mockLayoutSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({ messageSpacing: 6 }),
      );
      expect(mockLayoutSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({ messagePadding: 10 }),
      );
      expect(mockLayoutSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({ navigationBarOffset: 24 }),
      );
      expect(mockLayoutSetTabPosition).toHaveBeenCalledWith('bottom');
      expect(mockSettingsSet).toHaveBeenCalledWith('noticeRouting', 'active');
      expect(mockSettingsSet).toHaveBeenCalledWith('showTimestamps', true);
      expect(mockLayoutSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({ messageGroupingEnabled: true }),
      );
      expect(mockLayoutSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({ messageTextAlign: 'left' }),
      );
      expect(mockLayoutSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({ messageTextDirection: 'ltr' }),
      );
      expect(mockLayoutSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({ timestampDisplay: 'all' }),
      );
      expect(mockLayoutSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({ timestampFormat: '24h' }),
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(
        'bannerPosition',
        'tabs_below',
      ); // below_header maps to tabs_below
      expect(mockSettingsSet).toHaveBeenCalledWith(
        'keyboardBehavior',
        'persistent',
      );
    });

    it('handles banner position variations in theme settings', async () => {
      const bannerTestCases = [
        { input: 'above_header', expected: 'tabs_above' },
        { input: 'below_header', expected: 'tabs_below' },
        { input: 'bottom', expected: 'input_below' },
        { input: 'input_above', expected: 'input_above' },
        { input: 'tabs_above', expected: 'tabs_above' },
      ];

      for (const testCase of bannerTestCases) {
        jest.clearAllMocks();
        mockCapturedItems.clear();

        const themeWithBanner = {
          id: `banner_${testCase.input}`,
          name: 'Banner Test',
          isCustom: true,
          recommendedSettings: {
            bannerPosition: testCase.input,
          },
        };
        mockAvailableThemes = [themeWithBanner];

        render(
          <AppearanceSection
            colors={colors}
            styles={styles as any}
            settingIcons={{}}
            onShowThemeEditor={jest.fn()}
            languageLabels={{ en: 'English' }}
          />,
        );

        await waitFor(() =>
          expect(mockCapturedItems.has('display-theme')).toBe(true),
        );

        const themeItem = mockCapturedItems.get('display-theme');
        const bannerButton = themeItem.submenuItems.find(
          (x: any) => x.id === `theme-banner_${testCase.input}`,
        );

        expect(bannerButton).toBeTruthy();
        await bannerButton.onPress();

        // Click "Apply All"
        const alertCalls = (Alert.alert as jest.Mock).mock.calls;
        const themeAlert = alertCalls.find((c: any[]) =>
          String(c[0]).includes('Apply Theme Settings'),
        );
        const applyAllBtn = themeAlert?.[2]?.find((b: any) =>
          String(b.text).includes('Apply All'),
        );
        await applyAllBtn?.onPress?.();

        expect(mockSettingsSet).toHaveBeenCalledWith(
          'bannerPosition',
          testCase.expected,
        );
      }
    });

    it('handles unknown banner position by not setting it', async () => {
      const themeWithUnknownBanner = {
        id: 'banner_unknown_position',
        name: 'Unknown Banner Test',
        isCustom: true,
        recommendedSettings: {
          bannerPosition: 'unknown_position',
        },
      };
      mockAvailableThemes = [themeWithUnknownBanner];

      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      const themeItem = mockCapturedItems.get('display-theme');
      const themeButton = themeItem.submenuItems.find(
        (x: any) => x.id === 'theme-banner_unknown_position',
      );

      expect(themeButton).toBeTruthy();
      await themeButton.onPress();

      // Click "Apply All"
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const themeAlert = alertCalls.find((c: any[]) =>
        String(c[0]).includes('Apply Theme Settings'),
      );
      const applyAllBtn = themeAlert?.[2]?.find((b: any) =>
        String(b.text).includes('Apply All'),
      );
      await applyAllBtn?.onPress?.();

      // bannerPosition should not be set for unknown values
      const bannerCalls = mockSettingsSet.mock.calls.filter(
        (call: any[]) => call[0] === 'bannerPosition',
      );
      expect(bannerCalls).toHaveLength(0);
    });

    it('handles timestamp display hover mapping', async () => {
      const themeWithHoverTimestamp = {
        id: 'hover_timestamp',
        name: 'Hover Timestamp Test',
        isCustom: true,
        recommendedSettings: {
          timestampDisplay: 'hover',
        },
      };
      mockAvailableThemes = [themeWithHoverTimestamp];

      render(
        <AppearanceSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowThemeEditor={jest.fn()}
          languageLabels={{ en: 'English' }}
        />,
      );

      await waitFor(() =>
        expect(mockCapturedItems.has('display-theme')).toBe(true),
      );

      const themeItem = mockCapturedItems.get('display-theme');
      const themeButton = themeItem.submenuItems.find(
        (x: any) => x.id === 'theme-hover_timestamp',
      );

      expect(themeButton).toBeTruthy();
      await themeButton.onPress();

      // Click "Apply All"
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const themeAlert = alertCalls.find((c: any[]) =>
        String(c[0]).includes('Apply Theme Settings'),
      );
      const applyAllBtn = themeAlert?.[2]?.find((b: any) =>
        String(b.text).includes('Apply All'),
      );
      await applyAllBtn?.onPress?.();

      // 'hover' should be mapped to 'grouped'
      expect(mockLayoutSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({ timestampDisplay: 'grouped' }),
      );
    });
  });
});
