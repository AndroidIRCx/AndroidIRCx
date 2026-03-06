/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
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
const mockUpdateRateLimitConfig = jest.fn(async () => undefined);
const mockUpdateFloodProtectionConfig = jest.fn(async () => undefined);
const mockUpdateLagMonitoringConfig = jest.fn(async () => undefined);
const mockAutoRejoinSetEnabled = jest.fn();
const mockAutoVoiceSetConfig = jest.fn();
const mockAutoReconnectSetConfig = jest.fn(async () => undefined);
const mockAutoReconnectGetConfig = jest.fn(() => ({
  enabled: false,
  maxAttempts: 10,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  rejoinChannels: true,
  smartReconnect: true,
  minReconnectInterval: 5000,
}));
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
    updateRateLimitConfig: (...args: any[]) => mockUpdateRateLimitConfig(...args),
    updateFloodProtectionConfig: (...args: any[]) => mockUpdateFloodProtectionConfig(...args),
    updateLagMonitoringConfig: (...args: any[]) => mockUpdateLagMonitoringConfig(...args),
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
    setUserListSizePx: (...args: any[]) => mockLayoutSetUserListSizePx(...args),
    setUserListNickFontSizePx: (...args: any[]) => mockLayoutSetUserListNickFontSizePx(...args),
    setConfig: (...args: any[]) => mockLayoutSetConfig(...args),
    setFontSize: (...args: any[]) => mockLayoutSetFontSize(...args),
    setFontSizeValue: (...args: any[]) => mockLayoutSetFontSizeValue(...args),
    setTabPosition: (...args: any[]) => mockLayoutSetTabPosition(...args),
    setUserListPosition: (...args: any[]) => mockLayoutSetUserListPosition(...args),
    setViewMode: (...args: any[]) => mockLayoutSetViewMode(...args),
    setMessageSpacing: (...args: any[]) => mockLayoutSetMessageSpacing(...args),
    setMessagePadding: (...args: any[]) => mockLayoutSetMessagePadding(...args),
    setNavigationBarOffset: (...args: any[]) => mockLayoutSetNavigationBarOffset(...args),
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
    getConfig: (...args: any[]) => mockAutoReconnectGetConfig(...args),
    setConfig: (...args: any[]) => mockAutoReconnectSetConfig(...args),
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
    setEnabled: (...args: any[]) => mockAutoRejoinSetEnabled(...args),
  },
}));

jest.mock('../../../src/services/AutoVoiceService', () => ({
  autoVoiceService: {
    getConfig: jest.fn(() => ({ enabled: false, allUsers: false, operators: false, ircops: false })),
    setConfig: (...args: any[]) => mockAutoVoiceSetConfig(...args),
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
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
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

  it('AppearanceSection updates additional UI/layout settings', async () => {
    render(
      <AppearanceSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        onShowThemeEditor={jest.fn()}
        languageLabels={{ en: 'English', sr: 'Serbian' }}
      />
    );
    await waitFor(() => expect(mockCapturedItems.has('message-area-search-button')).toBe(true));

    await mockCapturedItems.get('message-area-search-button').onValueChange(true);
    await mockCapturedItems.get('layout-navigation-bar-offset').onValueChange('24');
    await mockCapturedItems.get('layout-message-spacing').onValueChange('12');
    await mockCapturedItems.get('layout-message-padding').onValueChange('10');
    await mockCapturedItems.get('layout-nicklist-tongue-enabled').onValueChange(false);
    await mockCapturedItems.get('layout-nicklist-tongue-size').onValueChange('60');

    expect(mockSettingsSet).toHaveBeenCalledWith('showMessageAreaSearchButton', true);
    expect(mockSettingsSet).toHaveBeenCalledWith('nicklistTongueEnabled', false);
    expect(mockSettingsSet).toHaveBeenCalledWith('nicklistTongueSizePx', 60);
    expect(mockUpdateLayoutConfig).toHaveBeenCalled();
  });

  it('AppearanceSection handles tab position, user list position, view mode and font submenu actions', async () => {
    render(
      <AppearanceSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        onShowThemeEditor={jest.fn()}
        languageLabels={{ en: 'English', sr: 'Serbian' }}
      />
    );
    await waitFor(() => expect(mockCapturedItems.has('layout-tab-position')).toBe(true));

    await mockCapturedItems
      .get('layout-tab-position')
      .submenuItems.find((x: any) => x.id === 'layout-tab-position-left')
      .onPress();
    expect(mockLayoutSetTabPosition).toHaveBeenCalledWith('left');

    mockCapturedItems.get('layout-userlist-position').onPress();
    const userListAlert = (Alert.alert as jest.Mock).mock.calls.find((c: any[]) =>
      String(c[0]).includes('User List Position')
    );
    const rightBtn = userListAlert?.[2]?.find((b: any) => b.text === 'Right');
    await rightBtn?.onPress?.();
    expect(mockLayoutSetUserListPosition).toHaveBeenCalledWith('right');

    mockCapturedItems.get('layout-view-mode').onPress();
    const viewModeAlert = (Alert.alert as jest.Mock).mock.calls.find((c: any[]) =>
      String(c[0]).includes('View Mode')
    );
    const compactBtn = viewModeAlert?.[2]?.find((b: any) => b.text === 'Compact');
    await compactBtn?.onPress?.();
    expect(mockLayoutSetViewMode).toHaveBeenCalledWith('compact');

    await mockCapturedItems
      .get('layout-font-size')
      .submenuItems.find((x: any) => x.id === 'font-size-large')
      .onPress();
    expect(mockLayoutSetFontSize).toHaveBeenCalledWith('large');
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

  it('ConnectionNetworkSection handles primary network callbacks and nested quality settings', async () => {
    const onShowFirstRunSetup = jest.fn();
    const onShowNetworksList = jest.fn();
    const onShowConnectionProfiles = jest.fn();

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net"
        onShowFirstRunSetup={onShowFirstRunSetup}
        onShowNetworksList={onShowNetworksList}
        onShowConnectionProfiles={onShowConnectionProfiles}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('setup-wizard')).toBe(true));

    mockCapturedItems.get('setup-wizard').onPress();
    mockCapturedItems.get('choose-network').onPress();
    mockCapturedItems.get('identity-profiles').onPress();
    expect(onShowFirstRunSetup).toHaveBeenCalled();
    expect(onShowNetworksList).toHaveBeenCalled();
    expect(onShowConnectionProfiles).toHaveBeenCalled();

    await mockCapturedItems.get('channel-auto-join-favorites').onValueChange(false);
    expect(mockSettingsSet).toHaveBeenCalledWith('autoJoinFavorites', false);

    mockCapturedItems.get('channel-auto-rejoin').onValueChange(true);
    expect(mockAutoRejoinSetEnabled).toHaveBeenCalledWith('net', true);

    await mockCapturedItems
      .get('connection-quality')
      .submenuItems.find((x: any) => x.id === 'quality-rate-limit')
      .submenuItems.find((x: any) => x.id === 'rate-limit-enabled')
      .onValueChange(true);
    expect(mockUpdateRateLimitConfig).toHaveBeenCalledWith({ enabled: true });

    await mockCapturedItems
      .get('connection-quality')
      .submenuItems.find((x: any) => x.id === 'quality-flood-protection')
      .submenuItems.find((x: any) => x.id === 'flood-protection-enabled')
      .onValueChange(true);
    expect(mockUpdateFloodProtectionConfig).toHaveBeenCalledWith({ enabled: true });

    await mockCapturedItems
      .get('connection-quality')
      .submenuItems.find((x: any) => x.id === 'quality-lag-monitoring')
      .submenuItems.find((x: any) => x.id === 'lag-monitoring-enabled')
      .onValueChange(true);
    expect(mockUpdateLagMonitoringConfig).toHaveBeenCalledWith({ enabled: true });
  });

  it('ConnectionNetworkSection covers proxy and DCC warning branches', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net"
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-global-proxy')).toBe(true));

    await mockCapturedItems
      .get('connection-global-proxy')
      .submenuItems.find((x: any) => x.id === 'proxy-enable')
      .onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'globalProxy',
      expect.objectContaining({ enabled: true, type: 'socks5' })
    );

    await mockCapturedItems
      .get('connection-dcc')
      .submenuItems.find((x: any) => x.id === 'dcc-block-private-ip')
      .onValueChange(false);
    expect(Alert.alert).toHaveBeenCalled();

    const dccAlertArgs = (Alert.alert as jest.Mock).mock.calls.find((call: any[]) =>
      String(call[0]).includes('Security Warning')
    );
    expect(dccAlertArgs).toBeTruthy();
    const buttons = dccAlertArgs?.[2] || [];
    const disableButton = buttons.find((b: any) => String(b?.text).includes('Disable Protection'));
    await disableButton?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccBlockPrivateIp', false);
  });
});
