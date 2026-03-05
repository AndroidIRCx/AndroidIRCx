/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AppearanceSection } from '../../../src/components/settings/sections/AppearanceSection';
import { ConnectionNetworkSection } from '../../../src/components/settings/sections/ConnectionNetworkSection';

const mockCapturedItems = new Map<string, any>();
const mockSettingsGet = jest.fn(async (_k: string, d: any) => d);
const mockSettingsSet = jest.fn(async () => undefined);
const mockSettingsOnChange = jest.fn(() => jest.fn());
const mockSetAppLanguage = jest.fn(async () => undefined);
const mockUpdateLayoutConfig = jest.fn(async () => undefined);
const mockSetQuickConnect = jest.fn(async () => undefined);

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
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
        React.createElement(Text, null, item.title || item.id)
      );
    },
  };
});

jest.mock('../../../src/hooks/useSettingsAppearance', () => ({
  useSettingsAppearance: () => ({
    currentTheme: { id: 'dark', name: 'Dark' },
    availableThemes: [{ id: 'dark', name: 'Dark', isCustom: false }],
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
    },
    appLanguage: 'en',
    refreshThemes: jest.fn(),
    setAppLanguage: (...args: any[]) => mockSetAppLanguage(...args),
    updateLayoutConfig: (...args: any[]) => mockUpdateLayoutConfig(...args),
  }),
}));

jest.mock('../../../src/hooks/useSettingsConnection', () => ({
  useSettingsConnection: () => ({
    networks: [{ id: 'net', name: 'Net' }],
    autoReconnectConfig: { enabled: false },
    rateLimitConfig: { enabled: false, messagesPerSecond: 2, burstLimit: 5 },
    floodProtectionConfig: { enabled: false, maxMessages: 5, timeWindow: 5 },
    lagMonitoringConfig: { enabled: false, checkInterval: 30, warningThreshold: 3000 },
    connectionStats: null,
    refreshNetworks: jest.fn(),
    updateAutoReconnectConfig: jest.fn(async () => undefined),
    updateRateLimitConfig: jest.fn(async () => undefined),
    updateFloodProtectionConfig: jest.fn(async () => undefined),
    updateLagMonitoringConfig: jest.fn(async () => undefined),
  }),
}));

jest.mock('../../../src/hooks/useSettingsSecurity', () => ({
  useSettingsSecurity: () => ({
    quickConnectNetworkId: '',
    setQuickConnectNetworkId: (...args: any[]) => mockSetQuickConnect(...args),
  }),
}));

jest.mock('../../../src/services/SettingsService', () => ({
  NEW_FEATURE_DEFAULTS: {
    dccAcceptExts: ['zip'],
    dccRejectExts: ['exe'],
    dccDontSendExts: ['bat'],
  },
  settingsService: {
    getSetting: (...args: any[]) => mockSettingsGet(...args),
    setSetting: (...args: any[]) => mockSettingsSet(...args),
    onSettingChange: (...args: any[]) => mockSettingsOnChange(...args),
  },
}));

jest.mock('../../../src/services/ThemeService', () => ({
  themeService: {
    setTheme: jest.fn(async () => undefined),
    exportCurrentTheme: jest.fn(() => '{}'),
    importTheme: jest.fn(async () => ({ success: true })),
    deleteCustomTheme: jest.fn(async () => undefined),
  },
}));

jest.mock('../../../src/services/LayoutService', () => ({
  layoutService: {
    setUserListSizePx: jest.fn(async () => undefined),
    setUserListNickFontSizePx: jest.fn(async () => undefined),
    setConfig: jest.fn(async () => undefined),
    setFontSize: jest.fn(async () => undefined),
    setFontSizeValue: jest.fn(async () => undefined),
    setTabPosition: jest.fn(async () => undefined),
    setUserListPosition: jest.fn(async () => undefined),
    setViewMode: jest.fn(async () => undefined),
    setMessageSpacing: jest.fn(async () => undefined),
    setMessagePadding: jest.fn(async () => undefined),
    setNavigationBarOffset: jest.fn(async () => undefined),
  },
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(async () => []),
  types: { json: 'application/json', allFiles: '*/*' },
  isErrorWithCode: jest.fn(() => false),
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
}));

jest.mock('react-native-fs', () => ({
  DownloadDirectoryPath: '/downloads',
  DocumentDirectoryPath: '/docs',
  writeFile: jest.fn(async () => undefined),
  readFile: jest.fn(async () => '{}'),
  unlink: jest.fn(async () => undefined),
}));

jest.mock('../../../src/i18n/config', () => ({
  SUPPORTED_LOCALES: ['en', 'sr'],
}));

jest.mock('../../../src/services/AutoReconnectService', () => ({
  autoReconnectService: {
    isEnabled: jest.fn(() => false),
    getConfig: jest.fn(() => ({ enabled: false })),
    setConfig: jest.fn(async () => undefined),
  },
}));

jest.mock('../../../src/services/ConnectionQualityService', () => ({
  connectionQualityService: {
    getStatistics: jest.fn(() => null),
  },
}));

jest.mock('../../../src/services/AutoRejoinService', () => ({
  autoRejoinService: {
    isEnabled: jest.fn(() => false),
    setEnabled: jest.fn(),
  },
}));

jest.mock('../../../src/services/AutoVoiceService', () => ({
  autoVoiceService: {
    getConfig: jest.fn(() => ({ enabled: false, allUsers: false, operators: false, ircops: false })),
    setConfig: jest.fn(),
  },
}));

jest.mock('../../../src/services/ChannelFavoritesService', () => ({
  channelFavoritesService: {
    getAllFavorites: jest.fn(() => new Map()),
    removeFavorite: jest.fn(async () => undefined),
    moveFavorite: jest.fn(async () => undefined),
  },
}));

jest.mock('../../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: {
    list: jest.fn(async () => []),
  },
}));

jest.mock('../../../src/services/BiometricAuthService', () => ({
  biometricAuthService: {
    isAvailable: jest.fn(async () => false),
    enableLock: jest.fn(async () => true),
    disableLock: jest.fn(async () => undefined),
    authenticate: jest.fn(async () => ({ success: true })),
  },
}));

jest.mock('../../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    getSecret: jest.fn(async () => null),
    setSecret: jest.fn(async () => undefined),
    removeSecret: jest.fn(async () => undefined),
  },
}));

jest.mock('../../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: jest.fn(() => null),
  },
}));

jest.mock('../../../src/services/ServiceDetectionService', () => ({
  serviceDetectionService: {
    getDetectionResult: jest.fn(() => null),
  },
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
  submenuOverlay: {},
  submenuContainer: {},
  submenuHeader: {},
  submenuTitle: {},
  submenuItem: {},
  submenuItemContent: {},
  submenuItemText: {},
  submenuItemDescription: {},
  submenuInput: {},
  closeButtonText: {},
};

describe('Heavy sections B', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
  });

  it('AppearanceSection renders and applies one setting callback', async () => {
    render(
      <AppearanceSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        onShowThemeEditor={jest.fn()}
        languageLabels={{ en: 'English', sr: 'Serbian' }}
      />
    );
    await waitFor(() => expect(mockCapturedItems.has('header-search-button')).toBe(true));
    await mockCapturedItems.get('header-search-button').onValueChange(false);
    expect(mockSettingsSet).toHaveBeenCalledWith('showHeaderSearchButton', false);
  });

  it('ConnectionNetworkSection renders and updates a key setting callback', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net"
        onShowFirstRunSetup={jest.fn()}
      />
    );
    await waitFor(() => expect(mockCapturedItems.has('connection-auto-connect-favorite')).toBe(true));
    await mockCapturedItems.get('connection-auto-connect-favorite').onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('autoConnectFavoriteServer', true);
  });
});
