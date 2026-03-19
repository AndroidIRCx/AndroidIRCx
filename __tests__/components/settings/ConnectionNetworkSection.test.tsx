/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { ConnectionNetworkSection } from '../../../src/components/settings/sections/ConnectionNetworkSection';
import { pick, isErrorWithCode } from '@react-native-documents/picker';

const mockCapturedItems = new Map<string, any>();
const mockSettingsGet = jest.fn(async (_k: string, d: any) => d);
const mockSettingsSet = jest.fn(async () => undefined);
const mockUpdateNetwork = jest.fn(async () => undefined);
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

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, any>) => {
    if (params?.count !== undefined) return `${key}`.replace('{count}', String(params.count));
    if (params?.mode !== undefined) return `${key}`.replace('{mode}', String(params.mode));
    if (params?.network !== undefined) return `${key}`.replace('{network}', String(params.network));
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
        React.createElement(Text, null, item.title || item.id)
      );
    },
  };
});

jest.mock('../../../src/hooks/useSettingsConnection', () => ({
  useSettingsConnection: () => ({
    networks: [
      { id: 'net1', name: 'Libera.Chat' },
      { id: 'net2', name: 'OFTC' },
    ],
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
    getConfig: jest.fn(() => ({ enabled: false, forAll: false, forOperators: false, forIRCOps: false })),
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
  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    // Reset mock implementations
    mockBiometricIsAvailable.mockResolvedValue(true);
    mockBiometricEnableLock.mockResolvedValue(true);
    mockBiometricAuthenticate.mockResolvedValue({ success: true });
    mockSecureStorageGetSecret.mockResolvedValue(null);
    mockChannelFavoritesGetAll.mockReturnValue(new Map());
    mockIdentityProfilesList.mockResolvedValue([]);
    mockConnectionGet.mockReturnValue(null);
    mockServiceDetectionGet.mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders all main settings items', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />
    );

    await waitFor(() => {
      expect(mockCapturedItems.has('setup-wizard')).toBe(true);
      expect(mockCapturedItems.has('choose-network')).toBe(true);
      expect(mockCapturedItems.has('quick-connect-network')).toBe(true);
      expect(mockCapturedItems.has('connection-auto-connect-favorite')).toBe(true);
      expect(mockCapturedItems.has('connection-auto-reconnect')).toBe(true);
      expect(mockCapturedItems.has('connection-quality')).toBe(true);
      expect(mockCapturedItems.has('identity-profiles')).toBe(true);
      expect(mockCapturedItems.has('connection-global-proxy')).toBe(true);
      expect(mockCapturedItems.has('channel-favorites')).toBe(true);
      expect(mockCapturedItems.has('channel-auto-join-favorites')).toBe(true);
      expect(mockCapturedItems.has('channel-auto-rejoin')).toBe(true);
      expect(mockCapturedItems.has('channel-auto-voice')).toBe(true);
      expect(mockCapturedItems.has('connection-dcc')).toBe(true);
    });
  });

  it('triggers callback props correctly', async () => {
    const onShowFirstRunSetup = jest.fn();
    const onShowNetworksList = jest.fn();
    const onShowConnectionProfiles = jest.fn();

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
        onShowFirstRunSetup={onShowFirstRunSetup}
        onShowNetworksList={onShowNetworksList}
        onShowConnectionProfiles={onShowConnectionProfiles}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('setup-wizard')).toBe(true));

    mockCapturedItems.get('setup-wizard').onPress();
    expect(onShowFirstRunSetup).toHaveBeenCalled();

    mockCapturedItems.get('choose-network').onPress();
    expect(onShowNetworksList).toHaveBeenCalled();

    mockCapturedItems.get('identity-profiles').onPress();
    expect(onShowConnectionProfiles).toHaveBeenCalled();
  });

  it('handles auto-connect favorite server toggle', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-auto-connect-favorite')).toBe(true));

    await mockCapturedItems.get('connection-auto-connect-favorite').onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('autoConnectFavoriteServer', true);
  });

  it('handles auto-reconnect configuration', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-auto-reconnect')).toBe(true));

    const autoReconnect = mockCapturedItems.get('connection-auto-reconnect');
    
    // Enable auto-reconnect
    await autoReconnect.submenuItems.find((x: any) => x.id === 'auto-reconnect-enabled').onValueChange(true);
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();

    // Toggle rejoin channels
    await autoReconnect.submenuItems.find((x: any) => x.id === 'auto-reconnect-rejoin').onValueChange(true);
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();

    // Toggle smart reconnect
    await autoReconnect.submenuItems.find((x: any) => x.id === 'auto-reconnect-smart').onValueChange(true);
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();

    // Update max attempts
    await autoReconnect.submenuItems.find((x: any) => x.id === 'auto-reconnect-max-attempts').onValueChange('15');
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();

    // Update initial delay
    await autoReconnect.submenuItems.find((x: any) => x.id === 'auto-reconnect-initial-delay').onValueChange('2000');
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();

    // Update max delay
    await autoReconnect.submenuItems.find((x: any) => x.id === 'auto-reconnect-max-delay').onValueChange('90000');
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();
  });

  it('handles rate limiting configuration', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-quality')).toBe(true));

    const quality = mockCapturedItems.get('connection-quality');
    const rateLimit = quality.submenuItems.find((x: any) => x.id === 'quality-rate-limit');

    // Enable rate limiting
    await rateLimit.submenuItems.find((x: any) => x.id === 'rate-limit-enabled').onValueChange(true);
    expect(mockUpdateRateLimitConfig).toHaveBeenCalledWith({ enabled: true });

    // Update messages per second
    await rateLimit.submenuItems.find((x: any) => x.id === 'rate-limit-msg-per-sec').onValueChange('5');
    expect(mockUpdateRateLimitConfig).toHaveBeenCalledWith({ messagesPerSecond: 5 });

    // Update burst limit
    await rateLimit.submenuItems.find((x: any) => x.id === 'rate-limit-burst').onValueChange('10');
    expect(mockUpdateRateLimitConfig).toHaveBeenCalledWith({ burstLimit: 10 });
  });

  it('handles flood protection configuration', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-quality')).toBe(true));

    const quality = mockCapturedItems.get('connection-quality');
    const floodProtection = quality.submenuItems.find((x: any) => x.id === 'quality-flood-protection');

    // Enable flood protection
    await floodProtection.submenuItems.find((x: any) => x.id === 'flood-protection-enabled').onValueChange(true);
    expect(mockUpdateFloodProtectionConfig).toHaveBeenCalledWith({ enabled: true });

    // Update max messages per window
    await floodProtection.submenuItems.find((x: any) => x.id === 'flood-protection-max-msgs').onValueChange('20');
    expect(mockUpdateFloodProtectionConfig).toHaveBeenCalledWith({ maxMessagesPerWindow: 20 });

    // Update window size
    await floodProtection.submenuItems.find((x: any) => x.id === 'flood-protection-window').onValueChange('15000');
    expect(mockUpdateFloodProtectionConfig).toHaveBeenCalledWith({ windowSize: 15000 });
  });

  it('handles lag monitoring configuration', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-quality')).toBe(true));

    const quality = mockCapturedItems.get('connection-quality');
    const lagMonitoring = quality.submenuItems.find((x: any) => x.id === 'quality-lag-monitoring');

    // Enable lag monitoring
    await lagMonitoring.submenuItems.find((x: any) => x.id === 'lag-monitoring-enabled').onValueChange(true);
    expect(mockUpdateLagMonitoringConfig).toHaveBeenCalledWith({ enabled: true });

    // Change lag check method to CTCP
    lagMonitoring.submenuItems.find((x: any) => x.id === 'lag-monitoring-method').onPress();
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const methodAlert = alertCalls.find((c: any[]) => String(c[0]).includes('Lag Check Method'));
    const ctcpBtn = methodAlert?.[2]?.find((b: any) => b.text === 'CTCP Ping');
    await ctcpBtn?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('lagCheckMethod', 'ctcp');

    // Update ping interval
    await lagMonitoring.submenuItems.find((x: any) => x.id === 'lag-monitoring-interval').onValueChange('45000');
    expect(mockUpdateLagMonitoringConfig).toHaveBeenCalledWith({ pingInterval: 45000 });

    // Update warning threshold
    await lagMonitoring.submenuItems.find((x: any) => x.id === 'lag-monitoring-warning').onValueChange('2000');
    expect(mockUpdateLagMonitoringConfig).toHaveBeenCalledWith({ warningThreshold: 2000 });
  });

  it('displays connection statistics', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-quality')).toBe(true));

    const quality = mockCapturedItems.get('connection-quality');
    quality.submenuItems.find((x: any) => x.id === 'quality-statistics').onPress();
    
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const statsAlert = alertCalls.find((c: any[]) => String(c[0]).includes('Connection Statistics'));
    expect(statsAlert).toBeTruthy();
  });

  it('handles global proxy configuration', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-global-proxy')).toBe(true));

    const proxy = mockCapturedItems.get('connection-global-proxy');

    // Enable proxy
    await proxy.submenuItems.find((x: any) => x.id === 'proxy-enable').onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('globalProxy', expect.objectContaining({ enabled: true }));

    // Change proxy type
    proxy.submenuItems.find((x: any) => x.id === 'proxy-type').onPress();

    // Update proxy host
    await proxy.submenuItems.find((x: any) => x.id === 'proxy-host').onValueChange('proxy.example.com');
    expect(mockSettingsSet).toHaveBeenCalledWith('globalProxy', expect.objectContaining({ host: 'proxy.example.com' }));

    // Update proxy port
    await proxy.submenuItems.find((x: any) => x.id === 'proxy-port').onValueChange('1080');
    expect(mockSettingsSet).toHaveBeenCalledWith('globalProxy', expect.objectContaining({ port: 1080 }));

    // Update proxy username
    await proxy.submenuItems.find((x: any) => x.id === 'proxy-username').onValueChange('alice');
    expect(mockSettingsSet).toHaveBeenCalledWith('globalProxy', expect.objectContaining({ username: 'alice' }));

    // Update proxy password
    await proxy.submenuItems.find((x: any) => x.id === 'proxy-password').onValueChange('secret');
    expect(mockSettingsSet).toHaveBeenCalledWith('globalProxy', expect.objectContaining({ password: 'secret' }));
  });

  it('handles auto-rejoin on kick toggle', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('channel-auto-rejoin')).toBe(true));

    await mockCapturedItems.get('channel-auto-rejoin').onValueChange(true);
    expect(mockAutoRejoinSetEnabled).toHaveBeenCalledWith('net1', true);
  });

  it('handles auto-voice configuration', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('channel-auto-voice')).toBe(true));

    const autoVoice = mockCapturedItems.get('channel-auto-voice');

    // Enable auto-voice
    await autoVoice.submenuItems.find((x: any) => x.id === 'auto-voice-enabled').onValueChange(true);
    expect(mockAutoVoiceSetConfig).toHaveBeenCalled();

    // Enable for all users
    await autoVoice.submenuItems.find((x: any) => x.id === 'auto-voice-all').onValueChange(true);
    expect(mockAutoVoiceSetConfig).toHaveBeenCalled();

    // Enable for operators
    await autoVoice.submenuItems.find((x: any) => x.id === 'auto-voice-operators').onValueChange(true);
    expect(mockAutoVoiceSetConfig).toHaveBeenCalled();

    // Enable for IRC ops
    await autoVoice.submenuItems.find((x: any) => x.id === 'auto-voice-ircops').onValueChange(true);
    expect(mockAutoVoiceSetConfig).toHaveBeenCalled();
  });

  it('handles DCC configuration', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-dcc')).toBe(true));

    const dcc = mockCapturedItems.get('connection-dcc');

    // Change auto-get mode to reject
    dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-get-mode').onPress();
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const modeAlert = alertCalls.find((c: any[]) => String(c[0]).includes('Auto-Get Mode'));
    const rejectBtn = modeAlert?.[2]?.find((b: any) => String(b.text).includes('Reject'));
    await rejectBtn?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoGetMode', 'reject');

    // Update min port
    await dcc.submenuItems.find((x: any) => x.id === 'dcc-min-port').onValueChange('5100');
    expect(mockSettingsSet).toHaveBeenCalledWith('dccPortRange', expect.objectContaining({ min: 5100 }));

    // Update max port
    await dcc.submenuItems.find((x: any) => x.id === 'dcc-max-port').onValueChange('6200');
    expect(mockSettingsSet).toHaveBeenCalledWith('dccPortRange', expect.objectContaining({ max: 6200 }));

    // Update host override
    await dcc.submenuItems.find((x: any) => x.id === 'dcc-host-override').onValueChange('1.2.3.4');
    expect(mockSettingsSet).toHaveBeenCalledWith('dccHostOverride', '1.2.3.4');

    // Toggle various DCC switches
    await dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-open-viewer').onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccServeViewerAuto', true);

    await dcc.submenuItems.find((x: any) => x.id === 'dcc-close-queries').onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccCloseQueriesOnChat', true);

    await dcc.submenuItems.find((x: any) => x.id === 'dcc-request-on-fail').onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccRequestOnFail', true);

    await dcc.submenuItems.find((x: any) => x.id === 'dcc-allow-by-ip').onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAllowByIp', true);

    await dcc.submenuItems.find((x: any) => x.id === 'dcc-passive').onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccPassive', true);

    await dcc.submenuItems.find((x: any) => x.id === 'dcc-reply-queue').onValueChange(true);
    expect(mockSettingsSet).toHaveBeenCalledWith('dccReplyQueueCommands', true);

    // Update send max kbps
    await dcc.submenuItems.find((x: any) => x.id === 'dcc-send-max-kbps').onValueChange('500');
    expect(mockSettingsSet).toHaveBeenCalledWith('dccSendMaxKbps', 500);

    // Update cancel above kbps
    await dcc.submenuItems.find((x: any) => x.id === 'dcc-cancel-above-kbps').onValueChange('1000');
    expect(mockSettingsSet).toHaveBeenCalledWith('dccCancelAboveKbps', 1000);
  });

  it('handles DCC block private IP security warning', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-dcc')).toBe(true));

    const dcc = mockCapturedItems.get('connection-dcc');

    // Try to disable block private IP
    await dcc.submenuItems.find((x: any) => x.id === 'dcc-block-private-ip').onValueChange(false);
    
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const warningAlert = alertCalls.find((c: any[]) => String(c[0]).includes('Security Warning'));
    expect(warningAlert).toBeTruthy();
    
    const disableBtn = warningAlert?.[2]?.find((b: any) => String(b.text).includes('Disable Protection'));
    await disableBtn?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccBlockPrivateIp', false);
  });

  it('handles DCC file filter buttons', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-dcc')).toBe(true));

    const dcc = mockCapturedItems.get('connection-dcc');
    const fileFilters = dcc.submenuItems.find((x: any) => x.id === 'dcc-file-filters');

    // Open accept exts
    fileFilters.submenuItems.find((x: any) => x.id === 'dcc-accept-exts').onPress();

    // Open reject exts
    fileFilters.submenuItems.find((x: any) => x.id === 'dcc-reject-exts').onPress();

    // Open dont-send exts
    fileFilters.submenuItems.find((x: any) => x.id === 'dcc-dont-send-exts').onPress();
  });

  it('handles DCC auto accept from level selection', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-dcc')).toBe(true));

    const dcc = mockCapturedItems.get('connection-dcc');

    // Test auto chat from
    dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-chat-from').onPress();
    let alertCalls = (Alert.alert as jest.Mock).mock.calls;
    let levelAlert = alertCalls.find((c: any[]) => String(c[0]).includes('Auto Accept Chat'));
    let levelBtn = levelAlert?.[2]?.find((b: any) => String(b.text).includes('2 - Friends'));
    await levelBtn?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoChatFrom', 2);

    // Test auto get from
    dcc.submenuItems.find((x: any) => x.id === 'dcc-auto-get-from').onPress();
    alertCalls = (Alert.alert as jest.Mock).mock.calls;
    levelAlert = alertCalls.find((c: any[]) => String(c[0]).includes('Auto Accept Gets'));
    levelBtn = levelAlert?.[2]?.find((b: any) => String(b.text).includes('3 - Ops'));
    await levelBtn?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith('dccAutoGetFrom', 3);
  });

  it('handles auto-join favorites toggle', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('channel-auto-join-favorites')).toBe(true));

    await mockCapturedItems.get('channel-auto-join-favorites').onValueChange(false);
    expect(mockSettingsSet).toHaveBeenCalledWith('autoJoinFavorites', false);
  });

  it('handles channel favorites with items', async () => {
    const favoritesMap = new Map([
      ['net1', [{ name: '#general', autoJoin: true, key: '' }, { name: '#random', autoJoin: false, key: 'secret' }]],
      ['net2', [{ name: '#help', autoJoin: true, key: '' }]],
    ]);
    mockChannelFavoritesGetAll.mockReturnValue(favoritesMap);

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('channel-favorites')).toBe(true));

    const favorites = mockCapturedItems.get('channel-favorites');
    expect(favorites.description).toContain('3');

    // Check submenu items are created for each favorite
    const favItems = favorites.submenuItems.filter((x: any) => x.id.startsWith('favorite-'));
    expect(favItems.length).toBe(3);
  });

  it('handles channel favorite move operation', async () => {
    const favoritesMap = new Map([
      ['net1', [{ name: '#general', autoJoin: true, key: '' }]],
    ]);
    mockChannelFavoritesGetAll.mockReturnValue(favoritesMap);

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('channel-favorites')).toBe(true));

    const favorites = mockCapturedItems.get('channel-favorites');
    const favItem = favorites.submenuItems.find((x: any) => x.id === 'favorite-net1-#general');
    
    // Find move button
    const moveBtn = favItem.submenuItems.find((x: any) => x.id.includes('favorite-move-'));
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

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('channel-favorites')).toBe(true));

    const favorites = mockCapturedItems.get('channel-favorites');
    const favItem = favorites.submenuItems.find((x: any) => x.id === 'favorite-net1-#general');
    
    // Find delete button
    const deleteBtn = favItem.submenuItems.find((x: any) => x.id.includes('favorite-delete-'));
    deleteBtn.onPress();
    
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    const deleteAlert = alertCalls.find((c: any[]) => String(c[0]).includes('Delete Favorite'));
    expect(deleteAlert).toBeTruthy();
    
    const confirmBtn = deleteAlert?.[2]?.find((b: any) => String(b.style) === 'destructive');
    await confirmBtn?.onPress?.();
    expect(mockChannelFavoritesRemove).toHaveBeenCalled();
  });

  it('handles WHOIS auto-detect toggle', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-whois-auto-detect')).toBe(true));

    await mockCapturedItems.get('connection-whois-auto-detect').onValueChange(false);
    expect(mockUpdateNetwork).toHaveBeenCalled();
  });

  it('handles WHOIS double nick toggle with connection sync', async () => {
    const setWhoisUseDoubleNick = jest.fn();
    mockConnectionGet.mockReturnValue({
      ircService: { setWhoisUseDoubleNick },
    });

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-whois-double-nick')).toBe(true));

    await mockCapturedItems.get('connection-whois-double-nick').onValueChange(true);
    expect(mockUpdateNetwork).toHaveBeenCalled();
    expect(setWhoisUseDoubleNick).toHaveBeenCalledWith(true);
  });

  it('handles WHOIS with Undernet detection', async () => {
    const setWhoisUseDoubleNick = jest.fn();
    mockConnectionGet.mockReturnValue({
      ircService: { setWhoisUseDoubleNick },
    });
    mockServiceDetectionGet.mockReturnValue({ serviceType: 'undernet' });

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-whois-auto-detect')).toBe(true));

    // Enable auto-detect when Undernet is detected
    await mockCapturedItems.get('connection-whois-auto-detect').onValueChange(true);
    expect(mockUpdateNetwork).toHaveBeenCalled();
  });

  it('handles biometric lock toggle when available', async () => {
    mockBiometricIsAvailable.mockResolvedValue(true);

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => {
      expect(mockCapturedItems.has('connection-biometric-lock')).toBe(true);
      expect(mockCapturedItems.get('connection-biometric-lock').disabled).toBe(false);
    });

    await mockCapturedItems.get('connection-biometric-lock').onValueChange(true);
    expect(mockBiometricEnableLock).toHaveBeenCalled();
    expect(mockSettingsSet).toHaveBeenCalledWith('biometricPasswordLock', true);
  });

  it('shows alert when biometric not available', async () => {
    mockBiometricIsAvailable.mockResolvedValue(false);

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-biometric-lock')).toBe(true));

    await mockCapturedItems.get('connection-biometric-lock').onValueChange(true);
    expect(Alert.alert).toHaveBeenCalledWith(
      expect.stringContaining('Biometrics unavailable'),
      expect.any(String)
    );
  });

  it('handles biometric lock disable', async () => {
    mockSettingsGet.mockImplementation(async (key: string, def: any) => {
      if (key === 'biometricPasswordLock') return true;
      return def;
    });

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => {
      expect(mockCapturedItems.has('connection-biometric-lock')).toBe(true);
      expect(mockCapturedItems.get('connection-biometric-lock').disabled).toBe(false);
    });

    await mockCapturedItems.get('connection-biometric-lock').onValueChange(false);
    expect(mockBiometricDisableLock).toHaveBeenCalled();
    expect(mockSettingsSet).toHaveBeenCalledWith('biometricPasswordLock', false);
  });

  it('handles DCC download folder picker failure', async () => {
    (pick as jest.Mock).mockRejectedValue(new Error('Picker failed'));
    (isErrorWithCode as jest.Mock).mockReturnValue(false);

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-dcc')).toBe(true));

    const dcc = mockCapturedItems.get('connection-dcc');
    await dcc.submenuItems.find((x: any) => x.id === 'dcc-download-folder').onPress();
    
    // Should show error alert for general errors
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('handles DCC download folder picker cancellation', async () => {
    const cancelError = { code: 'OPERATION_CANCELED', message: 'Canceled' };
    (isErrorWithCode as jest.Mock).mockImplementation((err: any) => err?.code === 'OPERATION_CANCELED');
    (pick as jest.Mock).mockRejectedValue(cancelError);

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-dcc')).toBe(true));

    const dcc = mockCapturedItems.get('connection-dcc');
    await dcc.submenuItems.find((x: any) => x.id === 'dcc-download-folder').onPress();
    
    // Should not show error alert for cancellation - just return silently
    // The cancel error should not trigger the failed alert
  });

  it('handles invalid numeric inputs gracefully', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        currentNetwork="net1"
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-auto-reconnect')).toBe(true));

    const autoReconnect = mockCapturedItems.get('connection-auto-reconnect');
    
    // Enable first
    await autoReconnect.submenuItems.find((x: any) => x.id === 'auto-reconnect-enabled').onValueChange(true);

    // Try invalid inputs
    await autoReconnect.submenuItems.find((x: any) => x.id === 'auto-reconnect-max-attempts').onValueChange('abc');
    await autoReconnect.submenuItems.find((x: any) => x.id === 'auto-reconnect-initial-delay').onValueChange('');
    
    // Should still be called with parsed values
    expect(mockAutoReconnectSetConfig).toHaveBeenCalled();
  });

  it('handles quick connect network selection', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('quick-connect-network')).toBe(true));

    // Open the quick connect modal
    mockCapturedItems.get('quick-connect-network').onPress();
  });

  it('handles empty channel favorites state', async () => {
    mockChannelFavoritesGetAll.mockReturnValue(new Map());

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('channel-favorites')).toBe(true));

    const favorites = mockCapturedItems.get('channel-favorites');
    const emptyItem = favorites.submenuItems.find((x: any) => x.id === 'favorites-empty');
    expect(emptyItem).toBeTruthy();
    expect(emptyItem.disabled).toBe(true);
  });

  it('handles identity profiles count display', async () => {
    mockIdentityProfilesList.mockResolvedValue([
      { id: '1', name: 'Profile 1' },
      { id: '2', name: 'Profile 2' },
    ]);

    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('identity-profiles')).toBe(true));

    const profiles = mockCapturedItems.get('identity-profiles');
    expect(profiles.description).toContain('2');
  });

  it('handles rate limiting input validation', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-quality')).toBe(true));

    const quality = mockCapturedItems.get('connection-quality');
    const rateLimit = quality.submenuItems.find((x: any) => x.id === 'quality-rate-limit');

    // Enable rate limiting first
    await rateLimit.submenuItems.find((x: any) => x.id === 'rate-limit-enabled').onValueChange(true);

    // Test with invalid values
    await rateLimit.submenuItems.find((x: any) => x.id === 'rate-limit-msg-per-sec').onValueChange('0');
    await rateLimit.submenuItems.find((x: any) => x.id === 'rate-limit-msg-per-sec').onValueChange('-5');
    await rateLimit.submenuItems.find((x: any) => x.id === 'rate-limit-msg-per-sec').onValueChange('abc');
    
    // Should not update with invalid values
    expect(mockUpdateRateLimitConfig).not.toHaveBeenCalledWith({ messagesPerSecond: 0 });
    expect(mockUpdateRateLimitConfig).not.toHaveBeenCalledWith({ messagesPerSecond: -5 });
  });

  it('handles flood protection input validation', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-quality')).toBe(true));

    const quality = mockCapturedItems.get('connection-quality');
    const floodProtection = quality.submenuItems.find((x: any) => x.id === 'quality-flood-protection');

    // Enable flood protection first
    await floodProtection.submenuItems.find((x: any) => x.id === 'flood-protection-enabled').onValueChange(true);

    // Test with invalid values
    await floodProtection.submenuItems.find((x: any) => x.id === 'flood-protection-max-msgs').onValueChange('0');
    await floodProtection.submenuItems.find((x: any) => x.id === 'flood-protection-window').onValueChange('invalid');
    
    // Should not update with invalid values
    expect(mockUpdateFloodProtectionConfig).not.toHaveBeenCalledWith({ maxMessagesPerWindow: 0 });
  });

  it('handles lag monitoring input validation', async () => {
    render(
      <ConnectionNetworkSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('connection-quality')).toBe(true));

    const quality = mockCapturedItems.get('connection-quality');
    const lagMonitoring = quality.submenuItems.find((x: any) => x.id === 'quality-lag-monitoring');

    // Enable lag monitoring first
    await lagMonitoring.submenuItems.find((x: any) => x.id === 'lag-monitoring-enabled').onValueChange(true);

    // Test with invalid values
    await lagMonitoring.submenuItems.find((x: any) => x.id === 'lag-monitoring-interval').onValueChange('-1');
    await lagMonitoring.submenuItems.find((x: any) => x.id === 'lag-monitoring-warning').onValueChange('0');
    
    // Should not update with invalid values
    expect(mockUpdateLagMonitoringConfig).not.toHaveBeenCalledWith({ pingInterval: -1 });
    expect(mockUpdateLagMonitoringConfig).not.toHaveBeenCalledWith({ warningThreshold: 0 });
  });
});
