/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert, AppState, Switch, TextInput } from 'react-native';
import {
  render,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react-native';
import { ConnectionNetworkSection } from '../../../src/components/settings/sections/ConnectionNetworkSection';
import { pick, isErrorWithCode } from '@react-native-documents/picker';

const mockCapturedItems = new Map<string, any>();
const mockSettingsGet = jest.fn(async (_k: string, d: any) => d);
const mockSettingsSet = jest.fn(async () => undefined);
const mockSettingsLoadNetworks = jest.fn(async () => [
  { id: 'net1', name: 'Libera.Chat' },
  { id: 'net2', name: 'OFTC' },
]);
const mockUpdateNetwork = jest.fn(async () => undefined);
const mockSetQuickConnect = jest.fn(async () => undefined);
const mockUpdateRateLimitConfig = jest.fn(async () => undefined);
const mockUpdateFloodProtectionConfig = jest.fn(async () => undefined);
const mockUpdateLagMonitoringConfig = jest.fn(async () => undefined);
const mockRefreshNetworks = jest.fn();
const mockHookUpdateAutoReconnectConfig = jest.fn(async () => undefined);
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
const mockConnectionStatsGet = jest.fn(() => ({
  connectionStartTime: Date.now() - 65000,
  messagesSent: 12,
  messagesReceived: 34,
  bytesSent: 2048,
  bytesReceived: 4096,
  currentLag: 123,
  averagePing: 110,
  minPing: 40,
  maxPing: 260,
  lagStatus: 'good',
}));
const mockConnectionGet = jest.fn(() => null as any);
const mockServiceDetectionGet = jest.fn(() => null as any);
const mockBiometricIsAvailable = jest.fn(async () => true);
const mockBiometricEnableLock = jest.fn(async () => true);
const mockBiometricDisableLock = jest.fn(async () => undefined);
const mockBiometricAuthenticate = jest.fn(async () => ({ success: true }));
const mockSecureStorageGetSecret = jest.fn(async () => null);
const mockSecureStorageSetSecret = jest.fn(async () => undefined);
const mockSecureStorageRemoveSecret = jest.fn(async () => undefined);
const mockChannelFavoritesGetAll = jest.fn(() => new Map());
const mockChannelFavoritesRemove = jest.fn(async () => undefined);
const mockChannelFavoritesMove = jest.fn(async () => undefined);
const mockIdentityProfilesList = jest.fn(async () => []);
const mockSetShowIRCv3Info = jest.fn();
const mockHookNetworks = [
  { id: 'net1', name: 'Libera.Chat' },
  { id: 'net2', name: 'OFTC' },
];

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, any>) => {
    if (params?.count !== undefined)
      return `${key}`.replace('{count}', String(params.count));
    if (params?.mode !== undefined)
      return `${key}`.replace('{mode}', String(params.mode));
    if (params?.network !== undefined)
      return `${key}`.replace('{network}', String(params.network));
    return key;
  },
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

jest.mock('../../../src/hooks/useSettingsConnection', () => ({
  useSettingsConnection: () => ({
    networks: mockHookNetworks,
    autoReconnectConfig: { enabled: false },
    rateLimitConfig: { enabled: false, messagesPerSecond: 2, burstLimit: 5 },
    floodProtectionConfig: { enabled: false, maxMessages: 5, timeWindow: 5 },
    lagMonitoringConfig: {
      enabled: false,
      checkInterval: 30,
      warningThreshold: 3000,
    },
    connectionStats: null,
    refreshNetworks: mockRefreshNetworks,
    updateAutoReconnectConfig: mockHookUpdateAutoReconnectConfig,
    updateRateLimitConfig: (...args: any[]) =>
      mockUpdateRateLimitConfig(...args),
    updateFloodProtectionConfig: (...args: any[]) =>
      mockUpdateFloodProtectionConfig(...args),
    updateLagMonitoringConfig: (...args: any[]) =>
      mockUpdateLagMonitoringConfig(...args),
  }),
}));

jest.mock('../../../src/hooks/useSettingsSecurity', () => ({
  useSettingsSecurity: () => ({
    quickConnectNetworkId: 'net1',
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
    loadNetworks: (...args: any[]) => mockSettingsLoadNetworks(...args),
    onSettingChange: jest.fn(() => jest.fn()),
    updateNetwork: (...args: any[]) => mockUpdateNetwork(...args),
  },
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
    getStatistics: (...args: any[]) => mockConnectionStatsGet(...args),
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
    getConfig: jest.fn(() => ({
      enabled: false,
      forAll: false,
      forOperators: false,
      forIRCOps: false,
    })),
    setConfig: (...args: any[]) => mockAutoVoiceSetConfig(...args),
  },
}));

jest.mock('../../../src/services/ChannelFavoritesService', () => ({
  channelFavoritesService: {
    getAllFavorites: (...args: any[]) => mockChannelFavoritesGetAll(...args),
    removeFavorite: (...args: any[]) => mockChannelFavoritesRemove(...args),
    moveFavorite: (...args: any[]) => mockChannelFavoritesMove(...args),
  },
}));

jest.mock('../../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: {
    list: (...args: any[]) => mockIdentityProfilesList(...args),
  },
}));

jest.mock('../../../src/services/BiometricAuthService', () => ({
  biometricAuthService: {
    isAvailable: (...args: any[]) => mockBiometricIsAvailable(...args),
    enableLock: (...args: any[]) => mockBiometricEnableLock(...args),
    disableLock: (...args: any[]) => mockBiometricDisableLock(...args),
    authenticate: (...args: any[]) => mockBiometricAuthenticate(...args),
  },
}));

jest.mock('../../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    getSecret: (...args: any[]) => mockSecureStorageGetSecret(...args),
    setSecret: (...args: any[]) => mockSecureStorageSetSecret(...args),
    removeSecret: (...args: any[]) => mockSecureStorageRemoveSecret(...args),
  },
}));

jest.mock('../../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: (...args: any[]) => mockConnectionGet(...args),
  },
}));

jest.mock('../../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: () => ({
      setShowIRCv3Info: (...args: any[]) => mockSetShowIRCv3Info(...args),
    }),
  },
}));

jest.mock('../../../src/services/ServiceDetectionService', () => ({
  serviceDetectionService: {
    getDetectionResult: (...args: any[]) => mockServiceDetectionGet(...args),
  },
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(async () => []),
  pickDirectory: jest.fn(async () => null),
  types: { allFiles: '*/*', json: 'application/json' },
  isErrorWithCode: jest.fn(() => false),
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
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

describe('ConnectionNetworkSection', () => {
  beforeEach(async () => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    // Reset mock implementations
    mockSettingsGet.mockImplementation(async (_k: string, d: any) => d);
    mockSettingsLoadNetworks.mockImplementation(async () => [
      { id: 'net1', name: 'Libera.Chat' },
      { id: 'net2', name: 'OFTC' },
    ]);
    const pickerModule = require('@react-native-documents/picker');
    (pick as jest.Mock).mockResolvedValue([]);
    pickerModule.pickDirectory.mockResolvedValue(null);
    (isErrorWithCode as jest.Mock).mockReturnValue(false);
    mockUpdateRateLimitConfig.mockResolvedValue(undefined);
    mockUpdateFloodProtectionConfig.mockResolvedValue(undefined);
    mockUpdateLagMonitoringConfig.mockResolvedValue(undefined);
    mockBiometricIsAvailable.mockResolvedValue(true);
    mockBiometricEnableLock.mockResolvedValue(true);
    mockBiometricAuthenticate.mockResolvedValue({ success: true });
    mockSecureStorageGetSecret.mockResolvedValue(null);
    mockChannelFavoritesGetAll.mockReturnValue(new Map());
    mockIdentityProfilesList.mockResolvedValue([]);
    mockConnectionGet.mockReturnValue(null);
    mockServiceDetectionGet.mockReturnValue(null);
    mockSetShowIRCv3Info.mockClear();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it('renders all main settings items', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(async () => {
      expect(mockCapturedItems.has('setup-wizard')).toBe(true);
      expect(mockCapturedItems.has('choose-network')).toBe(true);
      expect(mockCapturedItems.has('quick-connect-network')).toBe(true);
      expect(mockCapturedItems.has('connection-auto-connect-favorite')).toBe(
        true,
      );
      expect(mockCapturedItems.has('connection-auto-reconnect')).toBe(true);
      expect(mockCapturedItems.has('connection-quality')).toBe(true);
      expect(mockCapturedItems.has('connection-ircv3-diagnostics')).toBe(true);
      expect(mockCapturedItems.has('identity-profiles')).toBe(true);
      expect(mockCapturedItems.has('connection-global-proxy')).toBe(true);
      expect(mockCapturedItems.has('channel-favorites')).toBe(true);
      expect(mockCapturedItems.has('channel-auto-join-favorites')).toBe(true);
      expect(mockCapturedItems.has('channel-auto-rejoin')).toBe(true);
      expect(mockCapturedItems.has('channel-auto-voice')).toBe(true);
      expect(mockCapturedItems.has('connection-dcc')).toBe(true);
    });
  });

  it('opens IRCv3 diagnostics for the active network', async () => {
    mockConnectionGet.mockReturnValue({
      ircService: {
        getAvailableCapabilities: jest.fn(() => [
          'server-time',
          'message-tags',
        ]),
        getEnabledCapabilities: jest.fn(() => ['server-time']),
        getCapabilityValues: jest.fn(() => ({ sasl: 'PLAIN' })),
        getISupportValues: jest.fn(() => ({
          NETWORK: 'ExampleNet',
          CHATHISTORY: true,
        })),
        getTransportInfo: jest.fn(() => ({
          transport: 'websocket',
          webSocketProtocol: 'text.ircv3.net',
        })),
      },
    });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-ircv3-diagnostics')).toBe(true),
    );

    mockCapturedItems.get('connection-ircv3-diagnostics').onPress();

    expect(mockConnectionGet).toHaveBeenCalledWith('net1');
    expect(mockSetShowIRCv3Info).toHaveBeenCalledWith(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('triggers callback props correctly', async () => {
    const onShowFirstRunSetup = jest.fn();
    const onShowNetworksList = jest.fn();
    const onShowConnectionProfiles = jest.fn();

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
        onShowFirstRunSetup={onShowFirstRunSetup}
        onShowNetworksList={onShowNetworksList}
        onShowConnectionProfiles={onShowConnectionProfiles}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('setup-wizard')).toBe(true),
    );

    mockCapturedItems.get('setup-wizard').onPress();
    expect(onShowFirstRunSetup).toHaveBeenCalled();

    mockCapturedItems.get('choose-network').onPress();
    expect(onShowNetworksList).toHaveBeenCalled();

    mockCapturedItems.get('identity-profiles').onPress();
    expect(onShowConnectionProfiles).toHaveBeenCalled();
  });

  it('handles auto-connect favorite server toggle', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-auto-connect-favorite')).toBe(
        true,
      ),
    );

    await mockCapturedItems
      .get('connection-auto-connect-favorite')
      .onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'autoConnectFavoriteServer',
      true,
    );
  });

  it('handles auto-reconnect configuration', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-auto-reconnect')).toBe(true),
    );

    const autoReconnect = mockCapturedItems.get('connection-auto-reconnect');

    // Enable auto-reconnect
    await autoReconnect.submenuItems
      .find((x: any) => x.id === 'auto-reconnect-enabled')
      .onValueChange(true);
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();

    // Toggle rejoin channels
    await autoReconnect.submenuItems
      .find((x: any) => x.id === 'auto-reconnect-rejoin')
      .onValueChange(true);
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();

    // Toggle smart reconnect
    await autoReconnect.submenuItems
      .find((x: any) => x.id === 'auto-reconnect-smart')
      .onValueChange(true);
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();

    // Update max attempts
    await autoReconnect.submenuItems
      .find((x: any) => x.id === 'auto-reconnect-max-attempts')
      .onValueChange('15');
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();

    // Update initial delay
    await autoReconnect.submenuItems
      .find((x: any) => x.id === 'auto-reconnect-initial-delay')
      .onValueChange('2000');
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();

    // Update max delay
    await autoReconnect.submenuItems
      .find((x: any) => x.id === 'auto-reconnect-max-delay')
      .onValueChange('90000');
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();
  });

  it('handles rate limiting configuration', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-quality')).toBe(true),
    );

    const quality = mockCapturedItems.get('connection-quality');
    const rateLimit = quality.submenuItems.find(
      (x: any) => x.id === 'quality-rate-limit',
    );

    // Enable rate limiting
    await rateLimit.submenuItems
      .find((x: any) => x.id === 'rate-limit-enabled')
      .onValueChange(true);
    expect(mockUpdateRateLimitConfig).toHaveBeenCalledWith({ enabled: true });

    // Update messages per second
    await rateLimit.submenuItems
      .find((x: any) => x.id === 'rate-limit-msg-per-sec')
      .onValueChange('5');
    expect(mockUpdateRateLimitConfig).toHaveBeenCalledWith({
      messagesPerSecond: 5,
    });

    // Update burst limit
    await rateLimit.submenuItems
      .find((x: any) => x.id === 'rate-limit-burst')
      .onValueChange('10');
    expect(mockUpdateRateLimitConfig).toHaveBeenCalledWith({ burstLimit: 10 });
  });

  it('handles flood protection configuration', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-quality')).toBe(true),
    );

    const quality = mockCapturedItems.get('connection-quality');
    const floodProtection = quality.submenuItems.find(
      (x: any) => x.id === 'quality-flood-protection',
    );

    // Enable flood protection
    await floodProtection.submenuItems
      .find((x: any) => x.id === 'flood-protection-enabled')
      .onValueChange(true);
    expect(mockUpdateFloodProtectionConfig).toHaveBeenCalledWith({
      enabled: true,
    });

    // Update max messages per window
    await floodProtection.submenuItems
      .find((x: any) => x.id === 'flood-protection-max-msgs')
      .onValueChange('20');
    expect(mockUpdateFloodProtectionConfig).toHaveBeenCalledWith({
      maxMessagesPerWindow: 20,
    });

    // Update window size
    await floodProtection.submenuItems
      .find((x: any) => x.id === 'flood-protection-window')
      .onValueChange('15000');
    expect(mockUpdateFloodProtectionConfig).toHaveBeenCalledWith({
      windowSize: 15000,
    });
  });

  it('handles lag monitoring configuration', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-quality')).toBe(true),
    );

    const quality = mockCapturedItems.get('connection-quality');
    const lagMonitoring = quality.submenuItems.find(
      (x: any) => x.id === 'quality-lag-monitoring',
    );

    // Enable lag monitoring
    await lagMonitoring.submenuItems
      .find((x: any) => x.id === 'lag-monitoring-enabled')
      .onValueChange(true);
    expect(mockUpdateLagMonitoringConfig).toHaveBeenCalledWith({
      enabled: true,
    });

    // Change lag check method to CTCP
    lagMonitoring.submenuItems
      .find((x: any) => x.id === 'lag-monitoring-method')
      .onPress();
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const methodAlert = alertCalls.find((c: any[]) =>
      String(c[0]).includes('Lag Check Method'),
    );
    const ctcpBtn = methodAlert?.[2]?.find((b: any) => b.text === 'CTCP Ping');
    await ctcpBtn?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('lagCheckMethod', 'ctcp');

    // Update ping interval
    await lagMonitoring.submenuItems
      .find((x: any) => x.id === 'lag-monitoring-interval')
      .onValueChange('45000');
    expect(mockUpdateLagMonitoringConfig).toHaveBeenCalledWith({
      pingInterval: 45000,
    });

    // Update warning threshold
    await lagMonitoring.submenuItems
      .find((x: any) => x.id === 'lag-monitoring-warning')
      .onValueChange('2000');
    expect(mockUpdateLagMonitoringConfig).toHaveBeenCalledWith({
      warningThreshold: 2000,
    });
  });

  it('displays connection statistics', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-quality')).toBe(true),
    );

    const quality = mockCapturedItems.get('connection-quality');
    quality.submenuItems
      .find((x: any) => x.id === 'quality-statistics')
      .onPress();

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const statsAlert = alertCalls.find((c: any[]) =>
      String(c[0]).includes('Connection Statistics'),
    );
    expect(statsAlert).toBeTruthy();
  });

  it('handles global proxy configuration', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-global-proxy')).toBe(true),
    );

    const proxy = mockCapturedItems.get('connection-global-proxy');

    // Enable proxy
    await proxy.submenuItems
      .find((x: any) => x.id === 'proxy-enable')
      .onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'globalProxy',
      expect.objectContaining({ enabled: true }),
    );

    // Change proxy type
    proxy.submenuItems.find((x: any) => x.id === 'proxy-type').onPress();

    // Update proxy host
    await proxy.submenuItems
      .find((x: any) => x.id === 'proxy-host')
      .onValueChange('proxy.example.com');
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'globalProxy',
      expect.objectContaining({ host: 'proxy.example.com' }),
    );

    // Update proxy port
    await proxy.submenuItems
      .find((x: any) => x.id === 'proxy-port')
      .onValueChange('1080');
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'globalProxy',
      expect.objectContaining({ port: 1080 }),
    );

    // Update proxy username
    await proxy.submenuItems
      .find((x: any) => x.id === 'proxy-username')
      .onValueChange('alice');
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'globalProxy',
      expect.objectContaining({ username: 'alice' }),
    );

    // Update proxy password
    await proxy.submenuItems
      .find((x: any) => x.id === 'proxy-password')
      .onValueChange('secret');
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'globalProxy',
      expect.objectContaining({ password: 'secret' }),
    );
  });

  it('handles auto-rejoin on kick toggle', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('channel-auto-rejoin')).toBe(true),
    );

    await mockCapturedItems.get('channel-auto-rejoin').onValueChange(true);
    expect(mockAutoRejoinSetEnabled).toHaveBeenCalledWith('net1', true);
  });

  it('handles auto-voice configuration', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('channel-auto-voice')).toBe(true),
    );

    const autoVoice = mockCapturedItems.get('channel-auto-voice');

    // Enable auto-voice
    await autoVoice.submenuItems
      .find((x: any) => x.id === 'auto-voice-enabled')
      .onValueChange(true);
    expect(mockAutoVoiceSetConfig).toHaveBeenCalled();

    // Enable for all users
    await autoVoice.submenuItems
      .find((x: any) => x.id === 'auto-voice-all')
      .onValueChange(true);
    expect(mockAutoVoiceSetConfig).toHaveBeenCalled();

    // Enable for operators
    await autoVoice.submenuItems
      .find((x: any) => x.id === 'auto-voice-operators')
      .onValueChange(true);
    expect(mockAutoVoiceSetConfig).toHaveBeenCalled();

    // Enable for IRC ops
    await autoVoice.submenuItems
      .find((x: any) => x.id === 'auto-voice-ircops')
      .onValueChange(true);
    expect(mockAutoVoiceSetConfig).toHaveBeenCalled();
  });

  it('handles DCC configuration', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');

    // Change auto-get mode to reject
    dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-get-mode').onPress();
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const modeAlert = alertCalls.find((c: any[]) =>
      String(c[0]).includes('Auto-Get Mode'),
    );
    const rejectBtn = modeAlert?.[2]?.find((b: any) =>
      String(b.text).includes('Reject'),
    );
    await rejectBtn?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoGetMode', 'reject');

    // Update min port
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-min-port')
      .onValueChange('5100');
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'dccPortRange',
      expect.objectContaining({ min: 5100 }),
    );

    // Update max port
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-max-port')
      .onValueChange('6200');
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'dccPortRange',
      expect.objectContaining({ max: 6200 }),
    );

    // Update host override
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-host-override')
      .onValueChange('1.2.3.4');
    expect(mockSettingsSet).toHaveBeenCalledWith('dccHostOverride', '1.2.3.4');

    // Toggle various DCC switches
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-auto-open-viewer')
      .onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccServeViewerAuto', true);

    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-close-queries')
      .onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccCloseQueriesOnChat', true);

    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-request-on-fail')
      .onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccRequestOnFail', true);

    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-allow-by-ip')
      .onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAllowByIp', true);

    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-passive')
      .onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccPassive', true);

    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-reply-queue')
      .onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccReplyQueueCommands', true);

    // Update send max kbps
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-send-max-kbps')
      .onValueChange('500');
    expect(mockSettingsSet).toHaveBeenCalledWith('dccSendMaxKbps', 500);

    // Update cancel above kbps
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-cancel-above-kbps')
      .onValueChange('1000');
    expect(mockSettingsSet).toHaveBeenCalledWith('dccCancelAboveKbps', 1000);
  });

  it('handles DCC block private IP security warning', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');

    // Try to disable block private IP
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-block-private-ip')
      .onValueChange(false);

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const warningAlert = alertCalls.find((c: any[]) =>
      String(c[0]).includes('Security Warning'),
    );
    expect(warningAlert).toBeTruthy();

    const disableBtn = warningAlert?.[2]?.find((b: any) =>
      String(b.text).includes('Disable Protection'),
    );
    await disableBtn?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccBlockPrivateIp', false);
  });

  it('handles DCC file filter buttons', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');
    const fileFilters = dcc.submenuItems.find(
      (x: any) => x.id === 'dcc-file-filters',
    );

    // Open accept exts
    fileFilters.submenuItems
      .find((x: any) => x.id === 'dcc-accept-exts')
      .onPress();

    // Open reject exts
    fileFilters.submenuItems
      .find((x: any) => x.id === 'dcc-reject-exts')
      .onPress();

    // Open dont-send exts
    fileFilters.submenuItems
      .find((x: any) => x.id === 'dcc-dont-send-exts')
      .onPress();
  });

  it('handles DCC auto accept from level selection', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');

    // Test auto chat from
    dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-chat-from').onPress();
    let alertCalls = (Alert.alert as jest.Mock).mock.calls;
    let levelAlert = alertCalls.find((c: any[]) =>
      String(c[0]).includes('Auto Accept Chat'),
    );
    let levelBtn = levelAlert?.[2]?.find((b: any) =>
      String(b.text).includes('2 - Friends'),
    );
    await levelBtn?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoChatFrom', 2);

    // Test auto get from
    dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-get-from').onPress();
    alertCalls = (Alert.alert as jest.Mock).mock.calls;
    levelAlert = alertCalls.find((c: any[]) =>
      String(c[0]).includes('Auto Accept Gets'),
    );
    levelBtn = levelAlert?.[2]?.find((b: any) =>
      String(b.text).includes('3 - Ops'),
    );
    await levelBtn?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoGetFrom', 3);
  });

  it('handles auto-join favorites toggle', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('channel-auto-join-favorites')).toBe(true),
    );

    await mockCapturedItems
      .get('channel-auto-join-favorites')
      .onValueChange(false);
    expect(mockSettingsSet).toHaveBeenCalledWith('autoJoinFavorites', false);
  });

  it('handles channel favorites with items', async () => {
    const favoritesMap = new Map([
      [
        'net1',
        [
          { name: '#general', autoJoin: true, key: '' },
          { name: '#random', autoJoin: false, key: 'secret' },
        ],
      ],
      ['net2', [{ name: '#help', autoJoin: true, key: '' }]],
    ]);
    mockChannelFavoritesGetAll.mockReturnValue(favoritesMap);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('channel-favorites')).toBe(true),
    );

    const favorites = mockCapturedItems.get('channel-favorites');
    expect(favorites.description).toContain('3');

    // Check submenu items are created for each favorite
    const favItems = favorites.submenuItems.filter((x: any) =>
      x.id.startsWith('favorite-'),
    );
    expect(favItems.length).toBe(3);
  });

  it('handles channel favorite move operation', async () => {
    const favoritesMap = new Map([
      ['net1', [{ name: '#general', autoJoin: true, key: '' }]],
    ]);
    mockChannelFavoritesGetAll.mockReturnValue(favoritesMap);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('channel-favorites')).toBe(true),
    );

    const favorites = mockCapturedItems.get('channel-favorites');
    const favItem = favorites.submenuItems.find(
      (x: any) => x.id === 'favorite-net1-#general',
    );

    // Find move button
    const moveBtn = favItem.submenuItems.find((x: any) =>
      x.id.includes('favorite-move-'),
    );
    if (moveBtn) {
      await moveBtn.onPress();
      expect(mockChannelFavoritesMove).toHaveBeenCalled();
    }
  });

  it('handles channel favorite delete with confirmation', async () => {
    const favoritesMap = new Map([
      ['net1', [{ name: '#general', autoJoin: true, key: '' }]],
    ]);
    mockChannelFavoritesGetAll.mockReturnValue(favoritesMap);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('channel-favorites')).toBe(true),
    );

    const favorites = mockCapturedItems.get('channel-favorites');
    const favItem = favorites.submenuItems.find(
      (x: any) => x.id === 'favorite-net1-#general',
    );

    // Find delete button
    const deleteBtn = favItem.submenuItems.find((x: any) =>
      x.id.includes('favorite-delete-'),
    );
    deleteBtn.onPress();

    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const deleteAlert = alertCalls.find((c: any[]) =>
      String(c[0]).includes('Delete Favorite'),
    );
    expect(deleteAlert).toBeTruthy();

    const confirmBtn = deleteAlert?.[2]?.find(
      (b: any) => String(b.style) === 'destructive',
    );
    await confirmBtn?.onPress?.();
    expect(mockChannelFavoritesRemove).toHaveBeenCalled();
  });

  it('handles WHOIS auto-detect toggle', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-whois-auto-detect')).toBe(true),
    );

    await mockCapturedItems
      .get('connection-whois-auto-detect')
      .onValueChange(false);
    expect(mockUpdateNetwork).toHaveBeenCalled();
  });

  it('handles WHOIS double nick toggle with connection sync', async () => {
    const setWhoisUseDoubleNick = jest.fn();
    mockConnectionGet.mockReturnValue({
      ircService: { setWhoisUseDoubleNick },
    });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-whois-double-nick')).toBe(true),
    );

    await mockCapturedItems
      .get('connection-whois-double-nick')
      .onValueChange(true);
    expect(mockUpdateNetwork).toHaveBeenCalled();
    expect(setWhoisUseDoubleNick).toHaveBeenCalledWith(true);
  });

  it('handles WHOIS with Undernet detection', async () => {
    const setWhoisUseDoubleNick = jest.fn();
    mockConnectionGet.mockReturnValue({
      ircService: { setWhoisUseDoubleNick },
    });
    mockServiceDetectionGet.mockReturnValue({ serviceType: 'undernet' });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-whois-auto-detect')).toBe(true),
    );

    // Enable auto-detect when Undernet is detected
    await mockCapturedItems
      .get('connection-whois-auto-detect')
      .onValueChange(true);
    expect(mockUpdateNetwork).toHaveBeenCalled();
  });

  it('handles biometric lock toggle when available', async () => {
    mockBiometricIsAvailable.mockResolvedValue(true);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(async () => {
      expect(mockCapturedItems.has('connection-biometric-lock')).toBe(true);
      expect(mockCapturedItems.get('connection-biometric-lock').disabled).toBe(
        false,
      );
    });

    await mockCapturedItems
      .get('connection-biometric-lock')
      .onValueChange(true);
    expect(mockBiometricEnableLock).toHaveBeenCalled();
    expect(mockSettingsSet).toHaveBeenCalledWith('biometricPasswordLock', true);
  });

  it('shows alert when biometric not available', async () => {
    mockBiometricIsAvailable.mockResolvedValue(false);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-biometric-lock')).toBe(true),
    );

    await mockCapturedItems
      .get('connection-biometric-lock')
      .onValueChange(true);
    expect(Alert.alert).toHaveBeenCalledWith(
      expect.stringContaining('Biometrics unavailable'),
      expect.any(String),
    );
  });

  it('handles biometric lock disable', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'biometricPasswordLock') return true;
      return def;
    });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(async () => {
      expect(mockCapturedItems.has('connection-biometric-lock')).toBe(true);
      expect(mockCapturedItems.get('connection-biometric-lock').disabled).toBe(
        false,
      );
    });

    await mockCapturedItems
      .get('connection-biometric-lock')
      .onValueChange(false);
    expect(mockBiometricDisableLock).toHaveBeenCalled();
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'biometricPasswordLock',
      false,
    );
  });

  it('handles DCC download folder picker failure', async () => {
    (pick as jest.Mock).mockRejectedValue(new Error('Picker failed'));
    (isErrorWithCode as jest.Mock).mockReturnValue(false);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-download-folder')
      .onPress();

    // Should show error alert for general errors
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('handles DCC download folder picker cancellation', async () => {
    const cancelError = { code: 'OPERATION_CANCELED', message: 'Canceled' };
    (isErrorWithCode as jest.Mock).mockImplementation(
      (err: any) => err?.code === 'OPERATION_CANCELED',
    );
    (pick as jest.Mock).mockRejectedValue(cancelError);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-download-folder')
      .onPress();

    // Should not show error alert for cancellation - just return silently
    // The cancel error should not trigger the failed alert
  });

  it('stores a selected DCC download directory from the native folder picker', async () => {
    const pickerModule = require('@react-native-documents/picker');
    pickerModule.pickDirectory.mockResolvedValue({
      uri: 'file:///storage/emulated/0/Download%20Files',
    });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-download-folder')
      .onPress();

    expect(mockSettingsSet).toHaveBeenCalledWith(
      'dccDownloadFolder',
      '/storage/emulated/0/Download Files',
    );
    expect(pick).not.toHaveBeenCalled();
  });

  it('falls back to a picked file URI when the folder picker is unavailable', async () => {
    const pickerModule = require('@react-native-documents/picker');
    pickerModule.pickDirectory.mockResolvedValue(null);
    (pick as jest.Mock).mockResolvedValue({
      fileCopyUri: 'file:///storage/emulated/0/Downloads/example.txt',
    });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-download-folder')
      .onPress();

    expect(mockSettingsSet).toHaveBeenCalledWith(
      'dccDownloadFolder',
      '/storage/emulated/0/Downloads',
    );
  });

  it('warns when the fallback file picker cannot resolve a folder', async () => {
    const pickerModule = require('@react-native-documents/picker');
    pickerModule.pickDirectory.mockResolvedValue(null);
    (pick as jest.Mock).mockResolvedValue({ uri: 'single-file' });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-download-folder')
      .onPress();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Download Folder',
      'Unable to resolve a folder from the selected file.',
    );
    expect(mockSettingsSet).not.toHaveBeenCalledWith(
      'dccDownloadFolder',
      expect.any(String),
    );
  });

  it('handles invalid numeric inputs gracefully', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-auto-reconnect')).toBe(true),
    );

    const autoReconnect = mockCapturedItems.get('connection-auto-reconnect');

    // Enable first
    await autoReconnect.submenuItems
      .find((x: any) => x.id === 'auto-reconnect-enabled')
      .onValueChange(true);

    // Try invalid inputs
    await autoReconnect.submenuItems
      .find((x: any) => x.id === 'auto-reconnect-max-attempts')
      .onValueChange('abc');
    await autoReconnect.submenuItems
      .find((x: any) => x.id === 'auto-reconnect-initial-delay')
      .onValueChange('');

    // Should still be called with parsed values
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();
  });

  it('handles quick connect network selection', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('quick-connect-network')).toBe(true),
    );

    // Open the quick connect modal
    mockCapturedItems.get('quick-connect-network').onPress();
  });

  it('handles empty channel favorites state', async () => {
    mockChannelFavoritesGetAll.mockReturnValue(new Map());

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('channel-favorites')).toBe(true),
    );

    const favorites = mockCapturedItems.get('channel-favorites');
    const emptyItem = favorites.submenuItems.find(
      (x: any) => x.id === 'favorites-empty',
    );
    expect(emptyItem).toBeTruthy();
    expect(emptyItem.disabled).toBe(true);
  });

  it('handles identity profiles count display', async () => {
    mockIdentityProfilesList.mockResolvedValue([
      { id: '1', name: 'Profile 1' },
      { id: '2', name: 'Profile 2' },
    ]);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('identity-profiles')).toBe(true),
    );

    const profiles = mockCapturedItems.get('identity-profiles');
    expect(profiles.description).toContain('2');
  });

  it('handles rate limiting input validation', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-quality')).toBe(true),
    );

    const quality = mockCapturedItems.get('connection-quality');
    const rateLimit = quality.submenuItems.find(
      (x: any) => x.id === 'quality-rate-limit',
    );

    // Enable rate limiting first
    await rateLimit.submenuItems
      .find((x: any) => x.id === 'rate-limit-enabled')
      .onValueChange(true);

    // Test with invalid values
    await rateLimit.submenuItems
      .find((x: any) => x.id === 'rate-limit-msg-per-sec')
      .onValueChange('0');
    await rateLimit.submenuItems
      .find((x: any) => x.id === 'rate-limit-msg-per-sec')
      .onValueChange('-5');
    await rateLimit.submenuItems
      .find((x: any) => x.id === 'rate-limit-msg-per-sec')
      .onValueChange('abc');

    // Should not update with invalid values
    expect(mockUpdateRateLimitConfig).not.toHaveBeenCalledWith({
      messagesPerSecond: 0,
    });
    expect(mockUpdateRateLimitConfig).not.toHaveBeenCalledWith({
      messagesPerSecond: -5,
    });
  });

  it('handles flood protection input validation', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-quality')).toBe(true),
    );

    const quality = mockCapturedItems.get('connection-quality');
    const floodProtection = quality.submenuItems.find(
      (x: any) => x.id === 'quality-flood-protection',
    );

    // Enable flood protection first
    await floodProtection.submenuItems
      .find((x: any) => x.id === 'flood-protection-enabled')
      .onValueChange(true);

    // Test with invalid values
    await floodProtection.submenuItems
      .find((x: any) => x.id === 'flood-protection-max-msgs')
      .onValueChange('0');
    await floodProtection.submenuItems
      .find((x: any) => x.id === 'flood-protection-window')
      .onValueChange('invalid');

    // Should not update with invalid values
    expect(mockUpdateFloodProtectionConfig).not.toHaveBeenCalledWith({
      maxMessagesPerWindow: 0,
    });
  });

  it('handles lag monitoring input validation', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-quality')).toBe(true),
    );

    const quality = mockCapturedItems.get('connection-quality');
    const lagMonitoring = quality.submenuItems.find(
      (x: any) => x.id === 'quality-lag-monitoring',
    );

    // Enable lag monitoring first
    await lagMonitoring.submenuItems
      .find((x: any) => x.id === 'lag-monitoring-enabled')
      .onValueChange(true);

    // Test with invalid values
    await lagMonitoring.submenuItems
      .find((x: any) => x.id === 'lag-monitoring-interval')
      .onValueChange('-1');
    await lagMonitoring.submenuItems
      .find((x: any) => x.id === 'lag-monitoring-warning')
      .onValueChange('0');

    // Should not update with invalid values
    expect(mockUpdateLagMonitoringConfig).not.toHaveBeenCalledWith({
      pingInterval: -1,
    });
    expect(mockUpdateLagMonitoringConfig).not.toHaveBeenCalledWith({
      warningThreshold: 0,
    });
  });

  it('shows an IRCv3 diagnostics safety alert when no connection is active', async () => {
    mockConnectionGet.mockReturnValue(null);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-ircv3-diagnostics')).toBe(true),
    );
    mockCapturedItems.get('connection-ircv3-diagnostics').onPress();
    expect(Alert.alert).toHaveBeenCalledWith(
      'IRCv3 Diagnostics',
      'No active IRC connection for this network.',
      [{ text: 'OK' }],
    );
    expect(mockSetShowIRCv3Info).not.toHaveBeenCalled();
  });

  it('shows IRCv3 diagnostics safety alert when no network is selected', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-ircv3-diagnostics')).toBe(true),
    );
    mockCapturedItems.get('connection-ircv3-diagnostics').onPress();
    expect(Alert.alert).toHaveBeenCalledWith(
      'IRCv3 Diagnostics',
      'Select or connect a network before opening IRCv3 diagnostics.',
      [{ text: 'OK' }],
    );
  });

  it('loads existing global proxy settings into the proxy submenu', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'globalProxy')
        return {
          enabled: true,
          type: 'http',
          host: 'proxy.internal',
          port: 8080,
          username: 'u',
          password: 'p',
        };
      return def;
    });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(
        mockCapturedItems.get('connection-global-proxy')?.description,
      ).toContain('proxy.internal'),
    );
  });

  it('re-locks passwords when the app returns to the foreground', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'biometricPasswordLock') return true;
      return def;
    });
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-biometric-lock')).toBe(true),
    );

    const addCalls = (AppState.addEventListener as jest.Mock).mock.calls;
    const appStateHandler = addCalls[addCalls.length - 1][1];

    await act(async () => {
      await appStateHandler('background');
    });
    await act(async () => {
      await appStateHandler('active');
    });

    // Password lock is active, so the unlock item should be present
    await waitFor(() =>
      expect(mockCapturedItems.has('connection-unlock-passwords')).toBe(true),
    );
  });

  it('handles quick connect network load failure gracefully', async () => {
    mockSettingsLoadNetworks.mockRejectedValue(new Error('load fail'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('quick-connect-network')).toBe(true),
    );

    await act(async () => {
      await mockCapturedItems.get('quick-connect-network').onPress();
    });

    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('warns when the folder picker returns nothing usable', async () => {
    const pickerModule = require('@react-native-documents/picker');
    pickerModule.pickDirectory.mockResolvedValue(null);
    (pick as jest.Mock).mockResolvedValue({});

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-download-folder')
      .onPress();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Download Folder',
      'Folder picker is not supported on this device.',
    );
  });

  it('cycles through DCC auto-get mode, chat-from and get-from options', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');

    // Auto-get mode: press Accept and Don't send
    dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-get-mode').onPress();
    let call = (Alert.alert as jest.Mock).mock.calls.find((c: any[]) =>
      String(c[0]).includes('Auto-Get Mode'),
    );
    await call?.[2]
      ?.find((b: any) => b.text === 'Accept')
      ?.onPress?.();
    await call?.[2]
      ?.find((b: any) => String(b.text).includes("Don't send"))
      ?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoGetMode', 'accept');
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoGetMode', 'dont_send');

    // Auto chat from: 1, 3, 4
    dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-chat-from').onPress();
    call = (Alert.alert as jest.Mock).mock.calls.find((c: any[]) =>
      String(c[0]).includes('Auto Accept Chat'),
    );
    await call?.[2]
      ?.find((b: any) => String(b.text).includes('1 - Always'))
      ?.onPress?.();
    await call?.[2]?.find((b: any) => String(b.text).includes('3 - Ops'))?.onPress?.();
    await call?.[2]
      ?.find((b: any) => String(b.text).includes('4 - Auto Op'))
      ?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoChatFrom', 1);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoChatFrom', 3);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoChatFrom', 4);

    // Auto get from: 1, 2, 4
    dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-get-from').onPress();
    call = (Alert.alert as jest.Mock).mock.calls.find((c: any[]) =>
      String(c[0]).includes('Auto Accept Gets'),
    );
    await call?.[2]
      ?.find((b: any) => String(b.text).includes('1 - Always'))
      ?.onPress?.();
    await call?.[2]
      ?.find((b: any) => String(b.text).includes('2 - Friends'))
      ?.onPress?.();
    await call?.[2]
      ?.find((b: any) => String(b.text).includes('4 - Auto Op'))
      ?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoGetFrom', 1);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoGetFrom', 2);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoGetFrom', 4);
  });

  it('computes non-default DCC labels from loaded settings', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'dccAutoGetMode') return 'dont_send';
      if (key === 'dccAutoChatFrom') return 2;
      if (key === 'dccAutoGetFrom') return 3;
      return def;
    });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );
    const dcc = mockCapturedItems.get('connection-dcc');
    const chat = dcc.submenuItems.find(
      (x: any) => x.id === 'dcc-auto-chat-from',
    );
    const get = dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-get-from');
    expect(chat.description).toContain('2 - Friends');
    expect(get.description).toContain('3 - Ops');
  });

  it('enables DCC block private IP protection without warning', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );

    const dcc = mockCapturedItems.get('connection-dcc');
    await dcc.submenuItems
      .find((x: any) => x.id === 'dcc-block-private-ip')
      .onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccBlockPrivateIp', true);
  });

  it('selects the server ping lag check method', async () => {
    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-quality')).toBe(true),
    );

    const quality = mockCapturedItems.get('connection-quality');
    const lag = quality.submenuItems.find(
      (x: any) => x.id === 'quality-lag-monitoring',
    );
    lag.submenuItems.find((x: any) => x.id === 'lag-monitoring-method').onPress();
    const call = (Alert.alert as jest.Mock).mock.calls.find((c: any[]) =>
      String(c[0]).includes('Lag Check Method'),
    );
    await call?.[2]
      ?.find((b: any) => b.text === 'Server Ping')
      ?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('lagCheckMethod', 'server');
  });

  it('uses the default auto-voice config when none exists', async () => {
    const autoVoice = require('../../../src/services/AutoVoiceService')
      .autoVoiceService;
    autoVoice.getConfig.mockReturnValueOnce(null).mockReturnValueOnce(null);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('channel-auto-voice')).toBe(true),
    );

    const av = mockCapturedItems.get('channel-auto-voice');
    av.submenuItems
      .find((x: any) => x.id === 'auto-voice-enabled')
      .onValueChange(true);
    expect(mockAutoVoiceSetConfig).toHaveBeenCalled();
  });

  it('syncs WHOIS auto-detect off with an active connection', async () => {
    const setWhoisUseDoubleNick = jest.fn();
    mockConnectionGet.mockReturnValue({
      ircService: { setWhoisUseDoubleNick },
    });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-whois-auto-detect')).toBe(true),
    );

    await mockCapturedItems
      .get('connection-whois-auto-detect')
      .onValueChange(false);
    expect(mockUpdateNetwork).toHaveBeenCalled();
    expect(setWhoisUseDoubleNick).toHaveBeenCalled();
  });

  it('shows an alert when enabling biometric lock fails', async () => {
    mockBiometricIsAvailable.mockResolvedValue(true);
    mockBiometricEnableLock.mockResolvedValue(false);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-biometric-lock')).toBe(true),
    );

    await mockCapturedItems
      .get('connection-biometric-lock')
      .onValueChange(true);
    expect(Alert.alert).toHaveBeenCalledWith(
      expect.stringContaining('Biometric setup failed'),
      expect.any(String),
    );
  });

  it('unlocks passwords via biometric authentication', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'biometricPasswordLock') return true;
      return def;
    });
    mockBiometricIsAvailable.mockResolvedValue(true);
    mockBiometricAuthenticate.mockResolvedValue({ success: true });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-unlock-passwords')).toBe(true),
    );

    await act(async () => {
      await mockCapturedItems.get('connection-unlock-passwords').onPress();
    });
    expect(mockBiometricAuthenticate).toHaveBeenCalled();
  });

  it('shows an alert when biometric unlock fails and there is no PIN fallback', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'biometricPasswordLock') return true;
      return def;
    });
    mockBiometricIsAvailable.mockResolvedValue(true);
    mockBiometricAuthenticate.mockResolvedValue({
      success: false,
      errorMessage: 'bad finger',
    });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-unlock-passwords')).toBe(true),
    );

    await act(async () => {
      await mockCapturedItems.get('connection-unlock-passwords').onPress();
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Authentication failed',
      'bad finger',
    );
  });

  it('shows an alert when biometric is enabled but unavailable at unlock', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'biometricPasswordLock') return true;
      return def;
    });
    mockBiometricIsAvailable.mockResolvedValue(false);

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-unlock-passwords')).toBe(true),
    );

    await act(async () => {
      await mockCapturedItems.get('connection-unlock-passwords').onPress();
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Biometrics unavailable',
      expect.any(String),
    );
  });

  it('renders the connection quality modal and navigates nested rate limiting', async () => {
    const { getByTestId, getByText, UNSAFE_getAllByType } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() => getByTestId('setting-connection-quality'));
    fireEvent.press(getByTestId('setting-connection-quality'));

    await waitFor(() => expect(getByText('Rate Limiting')).toBeTruthy());
    fireEvent.press(getByText('Rate Limiting'));

    await waitFor(() =>
      expect(getByText('Enable Rate Limiting')).toBeTruthy(),
    );

    const switches = UNSAFE_getAllByType(Switch);
    await act(async () => {
      fireEvent(switches[0], 'valueChange', true);
    });
    const inputs = UNSAFE_getAllByType(TextInput);
    await act(async () => {
      fireEvent.changeText(inputs[0], '9');
    });

    // Navigate back out of the nested submenu
    fireEvent.press(getByText('←'));
    await waitFor(() =>
      expect(getByText('Connection Statistics')).toBeTruthy(),
    );

    fireEvent.press(getByText('Connection Statistics'));
    expect(
      (Alert.alert as jest.Mock).mock.calls.some((c: any[]) =>
        String(c[0]).includes('Connection Statistics'),
      ),
    ).toBe(true);
  });

  it('renders the proxy submenu and picks a proxy type from the modal', async () => {
    const { getByTestId, getByText, getByPlaceholderText } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() => getByTestId('setting-connection-global-proxy'));
    fireEvent.press(getByTestId('setting-connection-global-proxy'));

    await waitFor(() => expect(getByText('Proxy Type')).toBeTruthy());

    // Successful modal input change (covers the refresh-on-success path)
    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('proxy.example.com'),
        'ok.example.com',
      );
    });
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'globalProxy',
      expect.objectContaining({ host: 'ok.example.com' }),
    );

    fireEvent.press(getByText('Proxy Type'));

    await waitFor(() => expect(getByText('SOCKS4')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('SOCKS4'));
    });
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'globalProxy',
      expect.objectContaining({ type: 'socks4' }),
    );
  });

  it('renders the quick connect modal and selects a network', async () => {
    const { getByTestId, getByText } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() => getByTestId('setting-quick-connect-network'));
    await act(async () => {
      fireEvent.press(getByTestId('setting-quick-connect-network'));
    });

    await waitFor(() => expect(getByText('Use Default')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('OFTC'));
    });
    expect(mockSetQuickConnect).toHaveBeenCalledWith('net2');
  });

  it('renders the quick connect modal and resets to default', async () => {
    const { getByTestId, getByText } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() => getByTestId('setting-quick-connect-network'));
    await act(async () => {
      fireEvent.press(getByTestId('setting-quick-connect-network'));
    });

    await waitFor(() => expect(getByText('Use Default')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Use Default'));
    });
    expect(mockSetQuickConnect).toHaveBeenCalledWith(null);
  });

  it('adds and removes a DCC reject-list extension via the modal', async () => {
    const { getByTestId, getByText, getByPlaceholderText } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() => getByTestId('setting-connection-dcc'));
    fireEvent.press(getByTestId('setting-connection-dcc'));

    await waitFor(() => expect(getByText('File type filters')).toBeTruthy());
    fireEvent.press(getByText('File type filters'));

    await waitFor(() => expect(getByText('Reject list')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Reject list'));
    });

    await waitFor(() => expect(getByText('Add')).toBeTruthy());
    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('Add extension (e.g. *.zip)'),
        '*.foo',
      );
    });
    await act(async () => {
      fireEvent.press(getByText('Add'));
    });
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'dccRejectExts',
      expect.arrayContaining(['*.foo']),
    );

    // Remove the default 'exe' entry
    await act(async () => {
      fireEvent.press(getByText('exe'));
    });
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'dccRejectExts',
      expect.not.arrayContaining(['exe']),
    );
  });

  it('adds a DCC accept-list and dont-send-list extension via the modal', async () => {
    const openList = async (utils: any, listTitle: string) => {
      fireEvent.press(utils.getByTestId('setting-connection-dcc'));
      await waitFor(() =>
        expect(utils.getByText('File type filters')).toBeTruthy(),
      );
      fireEvent.press(utils.getByText('File type filters'));
      await waitFor(() => expect(utils.getByText(listTitle)).toBeTruthy());
      await act(async () => {
        fireEvent.press(utils.getByText(listTitle));
      });
      await waitFor(() => expect(utils.getByText('Add')).toBeTruthy());
    };

    const utils = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );
    await waitFor(() => utils.getByTestId('setting-connection-dcc'));

    await openList(utils, 'Accept list');
    await act(async () => {
      fireEvent.changeText(
        utils.getByPlaceholderText('Add extension (e.g. *.zip)'),
        '*.zip2',
      );
    });
    await act(async () => {
      fireEvent.press(utils.getByText('Add'));
    });
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'dccAcceptExts',
      expect.arrayContaining(['*.zip2']),
    );

    // Close the ext modal, reopen for the don't-send list
    await act(async () => {
      fireEvent.press(utils.getAllByText('Close')[0]);
    });
    await openList(utils, "Don't send list");
    await act(async () => {
      fireEvent.changeText(
        utils.getByPlaceholderText('Add extension (e.g. *.zip)'),
        '*.bat2',
      );
    });
    await act(async () => {
      fireEvent.press(utils.getByText('Add'));
    });
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'dccDontSendExts',
      expect.arrayContaining(['*.bat2']),
    );
  });

  it('sets up a PIN lock and then unlocks with it', async () => {
    const { getByTestId, getByText, getByPlaceholderText } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() => getByTestId('setting-connection-pin-lock'));

    // Enable PIN lock -> opens the PIN setup modal
    await act(async () => {
      mockCapturedItems.get('connection-pin-lock').onValueChange(true);
    });

    await waitFor(() => expect(getByPlaceholderText('Enter PIN')).toBeTruthy());
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Enter PIN'), '1234');
    });
    await act(async () => {
      fireEvent.press(getByText('Submit'));
    });

    await waitFor(() =>
      expect(getByPlaceholderText('Re-enter PIN')).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Re-enter PIN'), '1234');
    });
    await act(async () => {
      fireEvent.press(getByText('Confirm'));
    });

    expect(mockSecureStorageSetSecret).toHaveBeenCalled();
    expect(mockSettingsSet).toHaveBeenCalledWith('pinPasswordLock', true);

    // Now unlock using the stored PIN
    mockSecureStorageGetSecret.mockResolvedValue('1234');
    await waitFor(() =>
      expect(mockCapturedItems.has('connection-unlock-passwords')).toBe(true),
    );
    // Do not await: onPress resolves only once the PIN modal is submitted below
    await act(async () => {
      mockCapturedItems.get('connection-unlock-passwords').onPress();
    });

    await waitFor(() => expect(getByPlaceholderText('Enter PIN')).toBeTruthy());
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Enter PIN'), '1234');
    });
    await act(async () => {
      fireEvent.press(getByText('Submit'));
    });
    expect(mockSecureStorageGetSecret).toHaveBeenCalled();
  });

  it('validates PIN setup length and confirmation mismatch', async () => {
    const { getByTestId, getByText, getByPlaceholderText } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() => getByTestId('setting-connection-pin-lock'));
    await act(async () => {
      mockCapturedItems.get('connection-pin-lock').onValueChange(true);
    });

    await waitFor(() => expect(getByPlaceholderText('Enter PIN')).toBeTruthy());
    // Too short
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Enter PIN'), '12');
    });
    await act(async () => {
      fireEvent.press(getByText('Submit'));
    });
    expect(getByText('PIN must be at least 4 digits.')).toBeTruthy();

    // Valid setup, then mismatched confirmation
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Enter PIN'), '4321');
    });
    await act(async () => {
      fireEvent.press(getByText('Submit'));
    });
    await waitFor(() =>
      expect(getByPlaceholderText('Re-enter PIN')).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Re-enter PIN'), '9999');
    });
    await act(async () => {
      fireEvent.press(getByText('Confirm'));
    });
    expect(getByText('PINs do not match.')).toBeTruthy();
  });

  it('reports when no PIN is set during unlock', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'pinPasswordLock') return true;
      return def;
    });
    mockSecureStorageGetSecret.mockResolvedValue(null);

    const { getByText, getByPlaceholderText } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-unlock-passwords')).toBe(true),
    );
    // Do not await: onPress resolves only once the PIN modal is submitted below
    await act(async () => {
      mockCapturedItems.get('connection-unlock-passwords').onPress();
    });

    await waitFor(() => expect(getByPlaceholderText('Enter PIN')).toBeTruthy());
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Enter PIN'), '1234');
    });
    await act(async () => {
      fireEvent.press(getByText('Submit'));
    });
    expect(getByText('No PIN is set.')).toBeTruthy();
  });

  it('disables PIN lock and unlocks passwords when toggled off', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'pinPasswordLock') return true;
      return def;
    });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-pin-lock')).toBe(true),
    );

    await act(async () => {
      await mockCapturedItems.get('connection-pin-lock').onValueChange(false);
    });
    expect(mockSecureStorageRemoveSecret).toHaveBeenCalled();
    expect(mockSettingsSet).toHaveBeenCalledWith('pinPasswordLock', false);
  });

  it('rejects an incorrect PIN during unlock', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'pinPasswordLock') return true;
      return def;
    });
    mockSecureStorageGetSecret.mockResolvedValue('1111');

    const { getByText, getByPlaceholderText } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-unlock-passwords')).toBe(true),
    );
    await act(async () => {
      mockCapturedItems.get('connection-unlock-passwords').onPress();
    });

    await waitFor(() => expect(getByPlaceholderText('Enter PIN')).toBeTruthy());
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Enter PIN'), '2222');
    });
    await act(async () => {
      fireEvent.press(getByText('Submit'));
    });
    expect(getByText('Incorrect PIN.')).toBeTruthy();
  });

  it('falls back from biometric to PIN unlock when both are enabled', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'biometricPasswordLock') return true;
      if (key === 'pinPasswordLock') return true;
      return def;
    });
    mockBiometricIsAvailable.mockResolvedValue(true);
    mockBiometricAuthenticate.mockResolvedValue({ success: false });

    const { getByPlaceholderText } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-unlock-passwords')).toBe(true),
    );
    await act(async () => {
      mockCapturedItems.get('connection-unlock-passwords').onPress();
    });

    // Biometric failed but PIN is enabled, so the PIN modal should appear
    await waitFor(() => expect(getByPlaceholderText('Enter PIN')).toBeTruthy());
    expect(mockBiometricAuthenticate).toHaveBeenCalled();
  });

  it('computes the remaining DCC label branches', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'dccAutoGetMode') return 'reject';
      if (key === 'dccAutoChatFrom') return 3;
      if (key === 'dccAutoGetFrom') return 4;
      return def;
    });

    await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() =>
      expect(mockCapturedItems.has('connection-dcc')).toBe(true),
    );
    const dcc = mockCapturedItems.get('connection-dcc');
    expect(
      dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-chat-from')
        .description,
    ).toContain('3 - Ops');
    expect(
      dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-get-from')
        .description,
    ).toContain('4 - Auto Op');
    expect(
      dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-get-mode')
        .description,
    ).toContain('Reject');
  });

  it('logs errors thrown by submenu switch and input handlers', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUpdateRateLimitConfig.mockRejectedValue(new Error('boom'));

    const {
      getByTestId,
      getByText,
      getByPlaceholderText,
      UNSAFE_getAllByType,
    } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() => getByTestId('setting-connection-quality'));
    fireEvent.press(getByTestId('setting-connection-quality'));
    await waitFor(() => expect(getByText('Rate Limiting')).toBeTruthy());
    fireEvent.press(getByText('Rate Limiting'));
    await waitFor(() =>
      expect(getByText('Enable Rate Limiting')).toBeTruthy(),
    );

    const switches = UNSAFE_getAllByType(Switch);
    await act(async () => {
      fireEvent(switches[0], 'valueChange', true);
    });

    expect(errSpy).toHaveBeenCalledWith(
      'Error updating setting:',
      expect.any(Error),
    );

    // Also exercise the input handler catch path via a proxy field
    mockSettingsSet.mockRejectedValueOnce(new Error('write fail'));
    fireEvent.press(getByTestId('setting-connection-global-proxy'));
    await waitFor(() =>
      expect(getByPlaceholderText('proxy.example.com')).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('proxy.example.com'),
        'bad.host',
      );
    });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('dismisses the quick connect modal via its Close control', async () => {
    const { getByTestId, getByText, queryByText } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() => getByTestId('setting-quick-connect-network'));
    await act(async () => {
      fireEvent.press(getByTestId('setting-quick-connect-network'));
    });
    await waitFor(() => expect(getByText('Use Default')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Close'));
    });
    await waitFor(() => expect(queryByText('Use Default')).toBeNull());
  });

  it('dismisses the proxy type modal via its Close control', async () => {
    const { getByTestId, getByText, queryByText } = await render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />,
    );

    await waitFor(() => getByTestId('setting-connection-global-proxy'));
    fireEvent.press(getByTestId('setting-connection-global-proxy'));
    await waitFor(() => expect(getByText('Proxy Type')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('Proxy Type'));
    });
    await waitFor(() => expect(getByText('SOCKS4')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Close'));
    });
    await waitFor(() => expect(queryByText('SOCKS4')).toBeNull());
  });

  it('cancels the PIN setup modal', async () => {
    const { getByTestId, getByText, getByPlaceholderText, queryByText } =
      await render(
        <ConnectionNetworkSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
        />,
      );

    await waitFor(() => getByTestId('setting-connection-pin-lock'));
    await act(async () => {
      mockCapturedItems.get('connection-pin-lock').onValueChange(true);
    });
    await waitFor(() => expect(getByPlaceholderText('Enter PIN')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Cancel'));
    });
    await waitFor(() =>
      expect(queryByText('Set PIN')).toBeNull(),
    );
  });
});
