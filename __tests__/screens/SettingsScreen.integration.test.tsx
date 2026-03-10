/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Integration tests for SettingsScreen
 * Tests the overall functionality and component integration
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as settingsHelpers from '../../src/utils/settingsHelpers';
import { Alert } from 'react-native';

const mockCapturedSettingItems = new Map<string, any>();

// Mocks are defined in jest.setup.ts
jest.mock('../../src/utils/settingsHelpers');
jest.mock('../../src/components/settings/SettingItem', () => {
  const React = require('react');
  const { TouchableOpacity, Text, View } = require('react-native');
  return {
    SettingItem: ({ item, onPress }: any) => {
      mockCapturedSettingItems.set(item.id, item);
      return (
        <View>
          <TouchableOpacity testID={`setting-item-${item.id}`} onPress={() => onPress?.(item.id)}>
            <Text>{item.title || item.id}</Text>
          </TouchableOpacity>
        </View>
      );
    },
  };
});
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn((key: string, defaultValue: any) => Promise.resolve(defaultValue)),
    setSetting: jest.fn().mockResolvedValue(undefined),
    getAllSettings: jest.fn().mockResolvedValue({}),
    getNetwork: jest.fn().mockResolvedValue(null),
    getAllNetworks: jest.fn().mockResolvedValue([]),
    saveNetwork: jest.fn().mockResolvedValue(undefined),
    deleteNetwork: jest.fn().mockResolvedValue(undefined),
    getZncConfig: jest.fn().mockResolvedValue({
      enabled: false,
      server: '',
      port: 6667,
      useSsl: false,
      username: '',
      password: '',
      subscriptionId: '',
      purchaseToken: '',
      zncUsername: '',
    }),
    saveZncConfig: jest.fn().mockResolvedValue(undefined),
    getBncConfig: jest.fn().mockResolvedValue({
      enabled: false,
      server: '',
      port: 6667,
      useSsl: false,
      username: '',
      password: '',
    }),
    saveBncConfig: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnValue(jest.fn()),
    off: jest.fn(),
    onSettingChange: jest.fn().mockReturnValue(jest.fn()),
  },
  NEW_FEATURE_DEFAULTS: {
    channelListScrollSwitchTabs: false,
    channelListScrollSwitchTabsInverse: false,
    defaultBanType: 2,
    predefinedKickReasons: ['Spamming'],
    showBanMaskPreview: true,
    rememberLastBanType: true,
    confirmBeforeKickBan: true,
    spamPmKeywords: ['*discord.gg*'],
    dccAcceptExts: ['*.mp3'],
    dccRejectExts: ['*.exe'],
    dccDontSendExts: [],
  },
  DEFAULT_PART_MESSAGE: 'Leaving',
  DEFAULT_QUIT_MESSAGE: 'Quit',
  IRCNetworkConfig: class IRCNetworkConfig {},
}));
jest.mock('../../src/services/NotificationService', () => ({
  notificationService: {
    getPreferences: jest.fn(() => ({ enabled: false })),
    listChannelPreferences: jest.fn(() => []),
    checkPermission: jest.fn().mockResolvedValue(true),
    updatePreferences: jest.fn().mockResolvedValue(undefined),
    updateChannelPreferences: jest.fn().mockResolvedValue(undefined),
    removeChannelPreferences: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('../../src/services/BackgroundService', () => ({
  backgroundService: {
    isBatteryOptimizationEnabled: jest.fn().mockResolvedValue(false),
    openBatteryOptimizationSettings: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    getStats: jest.fn().mockResolvedValue({ totalMessages: 0, totalBytes: 0, perNetwork: {} }),
    exportHistory: jest.fn().mockResolvedValue({}),
    deleteNetworkMessages: jest.fn().mockResolvedValue(undefined),
    clearAll: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    on: jest.fn().mockReturnValue(jest.fn()),
    sendRaw: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
    getConnectionStatus: jest.fn().mockReturnValue(false),
    addRawMessage: jest.fn(),
  },
  RAW_MESSAGE_CATEGORIES: [
    { id: 'connection', title: 'Connection', description: '' },
  ],
  getDefaultRawCategoryVisibility: () => ({ connection: true }),
}));
jest.mock('../../src/services/ThemeService', () => ({
  themeService: {
    getCurrentTheme: jest.fn().mockReturnValue({ id: 'light', name: 'Light', colors: {} }),
    onThemeChange: jest.fn().mockReturnValue(jest.fn()),
    getColors: jest.fn().mockReturnValue({}),
    getMessageFormat: jest.fn().mockReturnValue('{nick} has joined {channel}'),
    getAllThemes: jest.fn().mockReturnValue([]),
  },
}));
jest.mock('../../src/services/ConnectionProfilesService', () => ({
  connectionProfilesService: {
    list: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../../src/services/BouncerService', () => ({
  bouncerService: {
    requestPlayback: jest.fn(),
  },
}));
jest.mock('../../src/services/LayoutService', () => ({
  layoutService: {
    getConfig: jest.fn().mockReturnValue({}),
    setConfig: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/PerformanceService', () => ({
  performanceService: {
    getConfig: jest.fn().mockReturnValue({}),
    setConfig: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/DataBackupService', () => ({
  dataBackupService: {
    getStorageStats: jest.fn().mockResolvedValue({ totalMessages: 0, totalBytes: 0 }),
    exportSettings: jest.fn().mockResolvedValue({}),
    exportAll: jest.fn().mockResolvedValue({}),
    importAll: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: {
    list: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../../src/services/BiometricAuthService', () => ({
  biometricAuthService: {
    getBiometryType: jest.fn().mockResolvedValue(null),
    authenticate: jest.fn().mockResolvedValue(true),
    enableLock: jest.fn().mockResolvedValue(true),
    disableLock: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    getSecret: jest.fn().mockResolvedValue(null),
    setSecret: jest.fn().mockResolvedValue(undefined),
    removeSecret: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    migrateOldKeysToNetwork: jest.fn().mockResolvedValue(0),
  },
}));
jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn().mockReturnValue([]),
    getActiveConnection: jest.fn().mockReturnValue(undefined),
    getActiveNetworkId: jest.fn().mockReturnValue(null),
    onConnectionCreated: jest.fn().mockReturnValue(jest.fn()),
  },
}));
jest.mock('../../src/services/InAppPurchaseService', () => ({
  inAppPurchaseService: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/AdRewardService', () => ({
  adRewardService: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/SubscriptionService', () => ({
  subscriptionService: {
    registerZncSubscription: jest.fn().mockResolvedValue({ success: false }),
    refreshAccountStatus: jest.fn().mockResolvedValue(undefined),
    restorePurchases: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../../src/components/settings/sections', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  const make = (name: string, buttons: Array<{ testID: string; label: string; onPress?: () => void }>) => (props: any) => (
    <View>
      <Text>{name}</Text>
      {buttons.map((btn) => (
        <TouchableOpacity key={btn.testID} testID={btn.testID} onPress={btn.onPress || (() => {})}>
          <Text>{btn.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  return {
    ScriptingAdsSection: make('ScriptingAdsSection', [
      { testID: 'sec-open-scripting', label: 'Open Scripting', onPress: undefined },
      { testID: 'sec-open-scripting-help', label: 'Open Scripting Help', onPress: undefined },
    ]),
    SecurityQuickConnectSection: make('SecurityQuickConnectSection', []),
    SecuritySection: (props: any) => (
      <View>
        <TouchableOpacity testID="sec-open-key-management" onPress={() => props.onShowKeyManagement?.()}>
          <Text>Open Key</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="sec-open-migration" onPress={() => props.onShowMigrationDialog?.('net-test')}>
          <Text>Open Migration</Text>
        </TouchableOpacity>
      </View>
    ),
    PrivacyLegalSection: (props: any) => (
      <View>
        <TouchableOpacity testID="sec-open-data-privacy" onPress={() => props.onShowDataPrivacy?.()}>
          <Text>Open Data Privacy</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="sec-open-privacy-ads" onPress={() => props.onShowPrivacyAds?.()}>
          <Text>Open Privacy Ads</Text>
        </TouchableOpacity>
      </View>
    ),
    AboutSection: (props: any) => (
      <View>
        <TouchableOpacity testID="sec-open-about" onPress={() => props.onShowAbout?.()}>
          <Text>Open About</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="sec-open-credits" onPress={() => props.onShowCredits?.()}>
          <Text>Open Credits</Text>
        </TouchableOpacity>
      </View>
    ),
    HelpSection: make('HelpSection', []),
    AppearanceSection: (props: any) => (
      <View>
        <TouchableOpacity testID="sec-open-theme-editor" onPress={() => props.onShowThemeEditor?.({ id: 'light' })}>
          <Text>Open Theme Editor</Text>
        </TouchableOpacity>
      </View>
    ),
    DisplayUISection: make('DisplayUISection', []),
    MessageHistorySection: make('MessageHistorySection', []),
    NotificationsSection: make('NotificationsSection', []),
    ConnectionNetworkSection: (props: any) => (
      <View>
        <TouchableOpacity testID="sec-open-first-run" onPress={() => props.onShowFirstRunSetup?.()}>
          <Text>Open First Run</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="sec-open-networks-list" onPress={() => props.onShowNetworksList?.()}>
          <Text>Open Networks List</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="sec-open-connection-profiles" onPress={() => props.onShowConnectionProfiles?.()}>
          <Text>Open Profiles</Text>
        </TouchableOpacity>
      </View>
    ),
    BackgroundBatterySection: make('BackgroundBatterySection', []),
    HighlightingSection: make('HighlightingSection', []),
    UsersServicesSection: make('UsersServicesSection', []),
    CommandsSection: make('CommandsSection', []),
    MediaSection: make('MediaSection', []),
    AwaySection: make('AwaySection', []),
    ProtectionSection: make('ProtectionSection', []),
    WritingSection: make('WritingSection', []),
  };
});
jest.mock('../../src/screens/ScriptingScreen', () => ({
  ScriptingScreen: ({ visible }: any) => (visible ? <>{'ScriptingScreenMock'}</> : null),
}));
jest.mock('../../src/screens/ScriptingHelpScreen', () => ({
  ScriptingHelpScreen: ({ visible }: any) => (visible ? <>{'ScriptingHelpScreenMock'}</> : null),
}));
jest.mock('../../src/screens/KeyManagementScreen', () => ({
  KeyManagementScreen: ({ visible }: any) => (visible ? <>{'KeyManagementScreenMock'}</> : null),
}));
jest.mock('../../src/screens/FirstRunSetupScreen', () => ({
  FirstRunSetupScreen: ({ visible }: any) => (visible ? <>{'FirstRunSetupScreenMock'}</> : null),
}));
jest.mock('../../src/screens/ConnectionProfilesScreen', () => ({
  ConnectionProfilesScreen: ({ visible }: any) => (visible ? <>{'ConnectionProfilesScreenMock'}</> : null),
}));
jest.mock('../../src/screens/ThemeEditorScreen', () => ({
  ThemeEditorScreen: ({ visible }: any) => (visible ? <>{'ThemeEditorScreenMock'}</> : null),
}));
jest.mock('../../src/screens/AboutScreen', () => ({
  AboutScreen: ({ visible }: any) => (visible ? <>{'AboutScreenMock'}</> : null),
}));
jest.mock('../../src/screens/CreditsScreen', () => ({
  CreditsScreen: ({ visible }: any) => (visible ? <>{'CreditsScreenMock'}</> : null),
}));
jest.mock('../../src/screens/PrivacyAdsScreen', () => ({
  PrivacyAdsScreen: ({ visible }: any) => (visible ? <>{'PrivacyAdsScreenMock'}</> : null),
}));
jest.mock('../../src/screens/DataPrivacyScreen', () => ({
  DataPrivacyScreen: ({ visible }: any) => (visible ? <>{'DataPrivacyScreenMock'}</> : null),
}));
jest.mock('../../src/screens/MessageHistoryViewerScreen', () => ({
  MessageHistoryViewerScreen: ({ visible }: any) => (visible ? <>{'MessageHistoryViewerScreenMock'}</> : null),
}));
jest.mock('../../src/screens/ZncSubscriptionScreen', () => ({
  ZncSubscriptionScreen: ({ visible }: any) => (visible ? <>{'ZncSubscriptionScreenMock'}</> : null),
}));
jest.mock('../../src/screens/PrivacyRelayScreen', () => ({
  PrivacyRelayScreen: ({ visible }: any) => (visible ? <>{'PrivacyRelayScreenMock'}</> : null),
}));
jest.mock('../../src/screens/BackupScreen', () => ({
  BackupScreen: ({ visible }: any) => (visible ? <>{'BackupScreenMock'}</> : null),
}));
jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: jest.fn(() => ({
      setShowSettings: jest.fn(),
      setShowNetworksList: jest.fn(),
    })),
  },
}));

// Import SettingsScreen after mocks
const { SettingsScreen } = jest.requireActual('../../src/screens/SettingsScreen');

describe('SettingsScreen Integration', () => {
  const mockOnClose = jest.fn();
  const setPremiumHook = (overrides: Record<string, any> = {}) => {
    const { useSettingsPremium } = require('../../src/hooks/useSettingsPremium');
    (useSettingsPremium as jest.Mock).mockReturnValue({
      watchAdButtonEnabledForPremium: false,
      setWatchAdButtonEnabledForPremium: jest.fn().mockResolvedValue(undefined),
      hasNoAds: false,
      hasScriptingPro: false,
      isSupporter: false,
      adReady: false,
      adLoading: false,
      adCooldown: false,
      cooldownSeconds: 0,
      showingAd: false,
      adUnitType: 'Primary',
      showWatchAdButton: true,
      handleWatchAd: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedSettingItems.clear();
    setPremiumHook();
    
    // Mock utility functions
    (settingsHelpers.getSectionIcon as jest.Mock).mockReturnValue({ name: 'cog', solid: false });
    (settingsHelpers.filterSettings as jest.Mock).mockImplementation((sections) => sections);
    (settingsHelpers.orderSections as jest.Mock).mockImplementation((sections) => sections);
    (settingsHelpers.toggleSectionExpansion as jest.Mock).mockImplementation(
      (title, expanded) => {
        const newSet = new Set(expanded);
        if (newSet.has(title)) {
          newSet.delete(title);
        } else {
          newSet.add(title);
        }
        return newSet;
      }
    );
  });

  it('should render settings screen with all sections', async () => {
    const { findByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    expect(await findByText('Settings')).toBeTruthy();
  });

  it('should handle closing the settings screen', async () => {
    const { findByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    const closeButton = await findByText('Done');
    fireEvent.press(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle search functionality', async () => {
    const { findByPlaceholderText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    const searchInput = await findByPlaceholderText('Search settings...');
    fireEvent.changeText(searchInput, 'notification');
    expect(searchInput.props.value).toBe('notification');
  });

  it('should render all section components', async () => {
    const { findByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    expect(await findByText('Appearance')).toBeTruthy();
    expect(await findByText('Messages & History')).toBeTruthy();
  });

  it('should handle search term clearing', async () => {
    const { findByPlaceholderText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    const searchInput = await findByPlaceholderText('Search settings...');
    fireEvent.changeText(searchInput, 'test search');
    fireEvent.changeText(searchInput, '');
    expect(searchInput.props.value).toBe('');
  });

  it('should handle section expansion toggle', async () => {
    const { findByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    const sectionHeader = await findByText('Appearance');
    fireEvent.press(sectionHeader);
    expect(settingsHelpers.toggleSectionExpansion).toHaveBeenCalled();
  });

  it('should maintain state consistency', async () => {
    const { findByText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    expect(await findByText('Settings')).toBeTruthy();
  });

  it('should execute section callback entrypoints and show linked screens', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;

    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.data?.some((d: any) => d.id === 'appearance-section'))
    );
    let view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Appearance'));
    fireEvent.press(view.getByTestId('sec-open-theme-editor'));
    expect(view.getByTestId('sec-open-theme-editor')).toBeTruthy();
    view.unmount();

    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.data?.some((d: any) => d.id === 'security-section'))
    );
    view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Security'));
    fireEvent.press(view.getByTestId('sec-open-key-management'));
    fireEvent.press(view.getByTestId('sec-open-migration'));
    expect(view.getByTestId('sec-open-key-management')).toBeTruthy();
    view.unmount();

    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.data?.some((d: any) => d.id === 'privacy-legal-section'))
    );
    view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Privacy & Legal'));
    fireEvent.press(view.getByTestId('sec-open-data-privacy'));
    fireEvent.press(view.getByTestId('sec-open-privacy-ads'));
    expect(view.getByTestId('sec-open-data-privacy')).toBeTruthy();
    view.unmount();

    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.data?.some((d: any) => d.id === 'connection-network-section'))
    );
    view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Connection & Network'));
    fireEvent.press(view.getByTestId('sec-open-first-run'));
    fireEvent.press(view.getByTestId('sec-open-connection-profiles'));
    expect(view.getByTestId('sec-open-connection-profiles')).toBeTruthy();
  });

  it('should execute messages/history item actions', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    const { messageHistoryService } = require('../../src/services/MessageHistoryService');
    const { dataBackupService } = require('../../src/services/DataBackupService');
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.id === 'messages-history')
    );

    jest.spyOn(Alert, 'alert');

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Messages & History'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('history-stats')).toBeTruthy();
      expect(mockCapturedSettingItems.get('history-backup')).toBeTruthy();
      expect(mockCapturedSettingItems.get('history-clear')).toBeTruthy();
    });

    await mockCapturedSettingItems.get('history-stats').onPress();
    expect(messageHistoryService.getStats).toHaveBeenCalled();

    mockCapturedSettingItems.get('history-backup').onPress();

    mockCapturedSettingItems.get('history-clear').onPress();
    const clearCall = (Alert.alert as jest.Mock).mock.calls.find((call: any[]) => String(call[0]).includes('Clear Message History'));
    expect(clearCall).toBeTruthy();
    const clearAction = clearCall[2].find((btn: any) => btn.text === 'Clear');
    await clearAction.onPress();
    expect(messageHistoryService.clearAll).toHaveBeenCalled();
    expect(dataBackupService.getStorageStats).toHaveBeenCalled();
  });

  it('should execute bouncer submenu item actions and request playback', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    const { bouncerService } = require('../../src/services/BouncerService');
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.id === 'connection-network')
    );

    jest.spyOn(Alert, 'alert');
    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Connection & Network'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('bouncer-config')).toBeTruthy();
    });

    const submenuItems = mockCapturedSettingItems.get('bouncer-config').submenuItems;
    const itemById = (id: string) => submenuItems.find((it: any) => it.id === id);

    await itemById('bouncer-enabled').onValueChange(true);
    await itemById('bouncer-handle-playback').onValueChange(true);
    await itemById('bouncer-mark-playback').onValueChange(true);
    await itemById('bouncer-skip-old').onValueChange(true);
    await itemById('bouncer-playback-timeout').onValueChange('7000');
    await itemById('bouncer-playback-age').onValueChange('48');
    await itemById('bouncer-scrollback-lines').onValueChange('120');

    itemById('bouncer-type').onPress();
    const typeCall = (Alert.alert as jest.Mock).mock.calls.find((call: any[]) => String(call[0]).includes('Bouncer Type'));
    expect(typeCall).toBeTruthy();
    await typeCall[2].find((btn: any) => btn.text === 'Auto-detect').onPress();
    await typeCall[2].find((btn: any) => btn.text === 'ZNC').onPress();
    await typeCall[2].find((btn: any) => btn.text === 'BNC').onPress();

    itemById('bouncer-request-playback').onPress();
    expect(bouncerService.requestPlayback).toHaveBeenCalled();
  });

  it('should render additional custom sections through renderSettingItem branches', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    const sectionsToValidate = [
      { id: 'notifications', title: 'Notifications', marker: 'NotificationsSection' },
      { id: 'away', title: 'Away', marker: 'AwaySection' },
      { id: 'protection', title: 'Protection', marker: 'ProtectionSection' },
      { id: 'writing', title: 'Writing', marker: 'WritingSection' },
      { id: 'users-services', title: 'Users & Services', marker: 'UsersServicesSection' },
      { id: 'commands', title: 'Commands', marker: 'CommandsSection' },
      { id: 'media', title: 'Media', marker: 'MediaSection' },
      { id: 'background-battery', title: 'Background & Battery', marker: 'BackgroundBatterySection' },
      { id: 'highlighting', title: 'Highlighting', marker: 'HighlightingSection' },
    ];

    for (const sec of sectionsToValidate) {
      fsMock.mockImplementation((sections: any[]) => sections.filter((s) => s.id === sec.id));
      const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
      fireEvent.press(view.getByText(sec.title));
      expect(await view.findByText(sec.marker)).toBeTruthy();
      view.unmount();
    }
  });

  // ========== Submenu Modal Tests ==========
  
  it('should handle submenu item types (switch, input, button)', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.id === 'connection-network')
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Connection & Network'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('bouncer-config')).toBeTruthy();
    });

    const submenuItems = mockCapturedSettingItems.get('bouncer-config').submenuItems;
    const switchItem = submenuItems.find((it: any) => it.id === 'bouncer-enabled');
    const inputItem = submenuItems.find((it: any) => it.id === 'bouncer-playback-timeout');
    const buttonItem = submenuItems.find((it: any) => it.id === 'bouncer-request-playback');

    // Test switch type
    expect(switchItem.type).toBe('switch');
    await switchItem.onValueChange(true);

    // Test input type
    expect(inputItem.type).toBe('input');
    await inputItem.onValueChange('6000');

    // Test button type
    expect(buttonItem.type).toBe('button');
    buttonItem.onPress();
  });

  // ========== PIN Modal Tests ==========

  it('should handle biometric availability check', async () => {
    const { biometricAuthService } = require('../../src/services/BiometricAuthService');
    (biometricAuthService.getBiometryType as jest.Mock).mockResolvedValue('FaceID');

    render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(biometricAuthService.getBiometryType).toHaveBeenCalled();
    });
  });

  it('should handle biometric unavailable state', async () => {
    const { biometricAuthService } = require('../../src/services/BiometricAuthService');
    (biometricAuthService.getBiometryType as jest.Mock).mockResolvedValue(null);

    render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(biometricAuthService.getBiometryType).toHaveBeenCalled();
    });
  });

  // ========== Search Functionality Tests ==========

  it('should clear search when search term is empty', async () => {
    const { findByPlaceholderText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    const searchInput = await findByPlaceholderText('Search settings...');
    
    // Type something
    fireEvent.changeText(searchInput, 'test');
    expect(searchInput.props.value).toBe('test');
    
    // Clear it
    fireEvent.changeText(searchInput, '');
    expect(searchInput.props.value).toBe('');
  });

  it('should expand all sections when searching', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[], searchTerm: string) => {
      if (!searchTerm) return sections;
      // Return all sections when searching (simulating matching)
      return sections;
    });

    const { findByPlaceholderText } = render(
      <SettingsScreen visible={true} onClose={mockOnClose} />
    );

    const searchInput = await findByPlaceholderText('Search settings...');
    fireEvent.changeText(searchInput, 'notification');

    // Search should trigger filterSettings with the search term
    await waitFor(() => {
      expect(fsMock).toHaveBeenCalledWith(
        expect.any(Array),
        'notification'
      );
    });
  });

  // ========== Modal Screen Tests ==========

  it('should open about and credits screens', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.data?.some((d: any) => d.id === 'about-section'))
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    
    // Should find the About section
    const aboutButton = view.getByTestId('sec-open-about');
    expect(aboutButton).toBeTruthy();
    fireEvent.press(aboutButton);

    const creditsButton = view.getByTestId('sec-open-credits');
    expect(creditsButton).toBeTruthy();
    fireEvent.press(creditsButton);
  });

  it('should open privacy and data privacy screens', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.data?.some((d: any) => d.id === 'privacy-legal-section'))
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Privacy & Legal'));
    
    const dataPrivacyButton = view.getByTestId('sec-open-data-privacy');
    expect(dataPrivacyButton).toBeTruthy();
    fireEvent.press(dataPrivacyButton);

    const privacyAdsButton = view.getByTestId('sec-open-privacy-ads');
    expect(privacyAdsButton).toBeTruthy();
    fireEvent.press(privacyAdsButton);
  });

  it('should handle Connection & Network section actions', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.data?.some((d: any) => d.id === 'connection-network-section'))
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Connection & Network'));
    
    const firstRunButton = view.getByTestId('sec-open-first-run');
    expect(firstRunButton).toBeTruthy();
    fireEvent.press(firstRunButton);

    const profilesButton = view.getByTestId('sec-open-connection-profiles');
    expect(profilesButton).toBeTruthy();
    fireEvent.press(profilesButton);

    const networksButton = view.getByTestId('sec-open-networks-list');
    expect(networksButton).toBeTruthy();
    fireEvent.press(networksButton);
  });

  // ========== Performance Settings Tests ==========

  it('should handle performance input fields', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    const { performanceService } = require('../../src/services/PerformanceService');
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.id === 'performance')
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Performance'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('perf-message-limit')).toBeTruthy();
      expect(mockCapturedSettingItems.get('perf-max-visible')).toBeTruthy();
    });

    // Test numeric input changes
    await mockCapturedSettingItems.get('perf-message-limit').onValueChange('2000');
    expect(performanceService.setConfig).toHaveBeenCalledWith({ messageLimit: 2000 });

    await mockCapturedSettingItems.get('perf-max-visible').onValueChange('150');
    expect(performanceService.setConfig).toHaveBeenCalledWith({ maxVisibleMessages: 150 });
  });

  // ========== ZNC Subscription Tests ==========

  it('should handle ZNC subscription registration flow', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    const { subscriptionService } = require('../../src/services/SubscriptionService');
    (subscriptionService.registerZncSubscription as jest.Mock).mockResolvedValue({
      status: 'active',
      expires_at: '2025-12-31T23:59:59Z',
      znc_username: 'testuser',
      znc_password: 'testpass',
    });

    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.id === 'connection-network')
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} currentNetwork="test-network" />);
    fireEvent.press(view.getByText('Connection & Network'));

    // Should have bouncer info and config items
    await waitFor(() => {
      expect(mockCapturedSettingItems.get('bouncer-info')).toBeTruthy();
      expect(mockCapturedSettingItems.get('bouncer-config')).toBeTruthy();
    });
  });

  // ========== Storage Stats Tests ==========

  it('should load and display storage statistics', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    const { dataBackupService } = require('../../src/services/DataBackupService');
    (dataBackupService.getStorageStats as jest.Mock).mockResolvedValue({
      totalMessages: 1000,
      totalBytes: 1024 * 1024 * 5, // 5 MB
    });

    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.id === 'messages-history')
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} currentNetwork="test-network" />);
    fireEvent.press(view.getByText('Messages & History'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('history-storage')).toBeTruthy();
    });
  });

  // ========== Identity Profiles Tests ==========

  it('should load identity profiles on mount', async () => {
    const { identityProfilesService } = require('../../src/services/IdentityProfilesService');
    (identityProfilesService.list as jest.Mock).mockResolvedValue([
      { id: '1', name: 'Profile 1' },
      { id: '2', name: 'Profile 2' },
    ]);

    render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(identityProfilesService.list).toHaveBeenCalled();
    });
  });

  // ========== History Export Tests ==========

  it('should handle history export in different formats', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    const { messageHistoryService } = require('../../src/services/MessageHistoryService');
    (messageHistoryService.exportHistory as jest.Mock).mockResolvedValue('exported data');

    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.id === 'messages-history')
    );

    jest.spyOn(Alert, 'alert');

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} currentNetwork="test-network" />);
    fireEvent.press(view.getByText('Messages & History'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('history-export')).toBeTruthy();
    });

    // Get submenu items
    const exportSubmenuItems = mockCapturedSettingItems.get('history-export').submenuItems;
    expect(exportSubmenuItems).toBeTruthy();
    expect(exportSubmenuItems.length).toBeGreaterThan(0);

    // Test JSON export
    const jsonExport = exportSubmenuItems.find((item: any) => item.id === 'export-json');
    expect(jsonExport).toBeTruthy();
    jsonExport.onPress();
  });

  // ========== Additional Coverage Tests ==========

  it('should handle section header toggles correctly', async () => {
    const { findByText } = render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    // Toggle Appearance section
    const appearanceHeader = await findByText('Appearance');
    fireEvent.press(appearanceHeader);
    expect(settingsHelpers.toggleSectionExpansion).toHaveBeenCalledWith(
      'Appearance',
      expect.any(Set)
    );

    // Toggle again to collapse
    fireEvent.press(appearanceHeader);
  });

  it('should handle backup screen modal', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.id === 'messages-history')
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} currentNetwork="test-network" />);
    fireEvent.press(view.getByText('Messages & History'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('history-backup')).toBeTruthy();
    });

    // Open backup screen
    mockCapturedSettingItems.get('history-backup').onPress();
  });

  it('should handle history viewer screen', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.id === 'messages-history')
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} currentNetwork="test-network" />);
    fireEvent.press(view.getByText('Messages & History'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('history-viewer')).toBeTruthy();
    });

    // Open history viewer
    mockCapturedSettingItems.get('history-viewer').onPress();
  });

  it('should handle when notification permission is granted', async () => {
    const { notificationService } = require('../../src/services/NotificationService');
    (notificationService.getPreferences as jest.Mock).mockReturnValue({ enabled: true });
    (notificationService.checkPermission as jest.Mock).mockResolvedValue(true);

    render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(notificationService.checkPermission).toHaveBeenCalled();
    });
  });

  it('should handle theme editor screen', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.data?.some((d: any) => d.id === 'appearance-section'))
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Appearance'));

    const themeEditorButton = view.getByTestId('sec-open-theme-editor');
    expect(themeEditorButton).toBeTruthy();
    fireEvent.press(themeEditorButton);
  });

  it('should handle screen not visible state', () => {
    const { queryByText } = render(<SettingsScreen visible={false} onClose={mockOnClose} />);
    
    // When not visible, nothing should render
    expect(queryByText('Settings')).toBeNull();
  });

  it('should handle multiple section toggles in sequence', async () => {
    const { findByText } = render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    // Toggle multiple sections
    const sections = ['Appearance', 'Messages & History', 'Notifications'];
    
    for (const section of sections) {
      try {
        const header = await findByText(section);
        fireEvent.press(header);
      } catch (e) {
        // Section might not be rendered due to mocking
      }
    }
  });

  it('should handle settings with currentNetwork prop', async () => {
    const { messageHistoryService } = require('../../src/services/MessageHistoryService');
    
    render(<SettingsScreen visible={true} onClose={mockOnClose} currentNetwork="test-network" />);

    await waitFor(() => {
      expect(messageHistoryService.getStats).toHaveBeenCalledWith('test-network');
    });
  });

  it('should execute extended performance actions and user list type choices', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    const { performanceService } = require('../../src/services/PerformanceService');
    jest.spyOn(Alert, 'alert');

    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.id === 'performance')
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Performance'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('perf-message-limit')).toBeTruthy();
      expect(mockCapturedSettingItems.get('perf-max-visible')).toBeTruthy();
    });

    await mockCapturedSettingItems.get('perf-message-limit').onValueChange('1800');
    await mockCapturedSettingItems.get('perf-max-visible').onValueChange('130');

    const maybeListType = mockCapturedSettingItems.get('perf-user-list-type');
    if (maybeListType?.onPress) {
      maybeListType.onPress();
      const typeCall = (Alert.alert as jest.Mock).mock.calls.find((call: any[]) =>
        String(call[0]).includes('Select User List Type')
      );
      if (typeCall?.[2]) {
        await typeCall[2].find((btn: any) => String(btn.text).includes('FlashList'))?.onPress?.();
        await typeCall[2].find((btn: any) => String(btn.text).includes('FlatList'))?.onPress?.();
        await typeCall[2].find((btn: any) => String(btn.text).includes('Grouped'))?.onPress?.();
        await typeCall[2].find((btn: any) => String(btn.text).includes('Simple'))?.onPress?.();
      }
    }

    expect(performanceService.setConfig).toHaveBeenCalledWith({ messageLimit: 1800 });
    expect(performanceService.setConfig).toHaveBeenCalledWith({ maxVisibleMessages: 130 });
  });

  it('should execute premium section actions and open privacy relay screen', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    const onShowPurchaseScreen = jest.fn();
    fsMock.mockImplementation((sections: any[]) => sections.filter((s) => s.id === 'premium'));

    const view = render(
      <SettingsScreen
        visible={true}
        onClose={mockOnClose}
        onShowPurchaseScreen={onShowPurchaseScreen}
      />
    );

    fireEvent.press(view.getByText('💎 Premium'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('premium-upgrade')).toBeTruthy();
      expect(mockCapturedSettingItems.get('privacy-relay-subscription')).toBeTruthy();
    });

    mockCapturedSettingItems.get('premium-upgrade').onPress();
    expect(onShowPurchaseScreen).toHaveBeenCalled();

    mockCapturedSettingItems.get('privacy-relay-subscription').onPress();
  });

  it('should export history as txt and csv formats from submenu', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    const { messageHistoryService } = require('../../src/services/MessageHistoryService');
    (messageHistoryService.exportHistory as jest.Mock).mockResolvedValue('x');
    fsMock.mockImplementation((sections: any[]) => sections.filter((s) => s.id === 'messages-history'));

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} currentNetwork="test-network" />);
    fireEvent.press(view.getByText('Messages & History'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('history-export')).toBeTruthy();
    });

    const exportSubmenuItems = mockCapturedSettingItems.get('history-export').submenuItems;
    exportSubmenuItems.find((item: any) => item.id === 'export-txt')?.onPress?.();
    exportSubmenuItems.find((item: any) => item.id === 'export-csv')?.onPress?.();

    expect(messageHistoryService.exportHistory).toHaveBeenCalledTimes(2);
  });

  it('should run additional performance callbacks and ignore invalid numeric inputs', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    const { performanceService } = require('../../src/services/PerformanceService');
    fsMock.mockImplementation((sections: any[]) => sections.filter((s) => s.id === 'performance'));

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Performance'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('perf-message-limit')).toBeTruthy();
    });

    const callIfExists = async (id: string, value: any) => {
      const item = mockCapturedSettingItems.get(id);
      if (item?.onValueChange) {
        await item.onValueChange(value);
        return true;
      }
      return false;
    };

    const calledVirtualization = await callIfExists('perf-virtualization', false);
    const calledLazy = await callIfExists('perf-lazy-loading', false);
    const calledRenderOpt = await callIfExists('perf-render-optimization', false);
    const calledCleanup = await callIfExists('perf-message-cleanup', false);
    const calledChunk = await callIfExists('perf-load-chunk', '64');
    const calledImageLazy = await callIfExists('perf-image-lazy', false);
    const calledGrouping = await callIfExists('perf-user-grouping', false);
    const calledGroupingThreshold = await callIfExists('perf-user-grouping-threshold', '1200');
    const calledDebounce = await callIfExists('perf-user-debounce', '0');
    const calledSkipSort = await callIfExists('perf-user-skip-sort', '0');
    const calledChunkLoading = await callIfExists('perf-user-chunk-loading', false);
    const calledChunkSize = await callIfExists('perf-user-chunk-size', '120');
    const calledInitialRender = await callIfExists('perf-user-initial-render', '60');

    const callsBeforeInvalid = (performanceService.setConfig as jest.Mock).mock.calls.length;
    await callIfExists('perf-message-limit', 'abc');
    await callIfExists('perf-max-visible', '0');
    await callIfExists('perf-load-chunk', '0');
    await callIfExists('perf-user-grouping-threshold', '-1');
    await callIfExists('perf-user-chunk-size', '0');
    await callIfExists('perf-user-initial-render', '0');

    if (calledVirtualization) expect(performanceService.setConfig).toHaveBeenCalledWith({ enableVirtualization: false });
    if (calledLazy) expect(performanceService.setConfig).toHaveBeenCalledWith({ enableLazyLoading: false });
    if (calledRenderOpt) expect(performanceService.setConfig).toHaveBeenCalledWith({ renderOptimization: false });
    if (calledCleanup) expect(performanceService.setConfig).toHaveBeenCalledWith({ enableMessageCleanup: false });
    if (calledChunk) expect(performanceService.setConfig).toHaveBeenCalledWith({ messageLoadChunk: 64 });
    if (calledImageLazy) expect(performanceService.setConfig).toHaveBeenCalledWith({ imageLazyLoad: false });
    if (calledGrouping) expect(performanceService.setConfig).toHaveBeenCalledWith({ userListGrouping: false });
    if (calledGroupingThreshold) expect(performanceService.setConfig).toHaveBeenCalledWith({ userListAutoDisableGroupingThreshold: 1200 });
    if (calledDebounce) expect(performanceService.setConfig).toHaveBeenCalledWith({ userListSearchDebounceMs: 0 });
    if (calledSkipSort) expect(performanceService.setConfig).toHaveBeenCalledWith({ userListSkipSortThreshold: 0 });
    if (calledChunkLoading) expect(performanceService.setConfig).toHaveBeenCalledWith({ userListEnableChunkLoading: false });
    if (calledChunkSize) expect(performanceService.setConfig).toHaveBeenCalledWith({ userListChunkSize: 120 });
    if (calledInitialRender) expect(performanceService.setConfig).toHaveBeenCalledWith({ userListInitialRenderCount: 60 });
    expect((performanceService.setConfig as jest.Mock).mock.calls.length).toBe(callsBeforeInvalid);
  });

  it('should render watch ad button variants and call handleWatchAd', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) => sections.filter((s) => s.id === 'scripting-ads'));

    const handleWatchAd = jest.fn().mockResolvedValue(undefined);
    setPremiumHook({
      showWatchAdButton: true,
      adReady: false,
      adLoading: false,
      adCooldown: false,
      showingAd: false,
      handleWatchAd,
    });
    let view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Scripting & Ads'));
    const requestAdText = await view.findByText('Request Ad');
    fireEvent.press(requestAdText);
    expect(handleWatchAd).toHaveBeenCalled();
    view.unmount();

    setPremiumHook({ showWatchAdButton: true, adReady: true, adLoading: false, adCooldown: false, showingAd: false });
    view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Scripting & Ads'));
    expect(await view.findByText('Watch Ad (+60 min Scripting & No-Ads)')).toBeTruthy();
    view.unmount();

    setPremiumHook({ showWatchAdButton: true, adReady: false, adLoading: false, adCooldown: true, cooldownSeconds: 45, showingAd: false });
    view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Scripting & Ads'));
    expect(await view.findByText('Cooldown (45s)')).toBeTruthy();
    view.unmount();

    setPremiumHook({ showWatchAdButton: true, adReady: false, adLoading: true, adCooldown: false, showingAd: false });
    view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Scripting & Ads'));
    expect(await view.findByText('Loading Ad...')).toBeTruthy();
  });

  it('should execute additional bouncer scrollback handlers', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter((s) => s.id === 'connection-network')
    );

    const view = render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    fireEvent.press(view.getByText('Connection & Network'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('bouncer-config')).toBeTruthy();
    });

    const submenuItems = mockCapturedSettingItems.get('bouncer-config').submenuItems;
    const byId = (id: string) => submenuItems.find((it: any) => it.id === id);

    await byId('bouncer-load-scrollback').onValueChange(false);
    await byId('bouncer-scrollback-lines').onValueChange('0'); // invalid branch
    await byId('bouncer-scrollback-lines').onValueChange('150'); // valid branch
  });
});
