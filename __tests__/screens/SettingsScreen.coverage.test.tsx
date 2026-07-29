/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Additional coverage tests for SettingsScreen focusing on ZNC IAP flows,
 * settings loading branches, the development/debug section, migration edge
 * cases and notification-permission handling. These live in a separate file
 * from the integration suite to keep the heavy render suite isolated.
 */

import {
  render,
  fireEvent,
  waitFor,
  configure,
} from '@testing-library/react-native';
import * as settingsHelpers from '../../src/utils/settingsHelpers';
import { Alert } from 'react-native';

// This is a heavy render suite: as mounted trees accumulate across tests the
// default 1000ms async-utility timeout starts to flake, so give waitFor/findBy
// plenty of headroom (the jest testTimeout is 30000ms).
configure({ asyncUtilTimeout: 20000 });

const mockCapturedSettingItems = new Map<string, any>();

jest.mock('../../src/utils/settingsHelpers');
jest.mock('../../src/components/settings/SettingItem', () => {
  const { TouchableOpacity, Text, View } = require('react-native');
  return {
    SettingItem: ({ item, onPress }: any) => {
      mockCapturedSettingItems.set(item.id, item);
      return (
        <View>
          <TouchableOpacity
            testID={`setting-item-${item.id}`}
            onPress={() => onPress?.(item.id)}
          >
            <Text>{item.title || item.id}</Text>
          </TouchableOpacity>
        </View>
      );
    },
  };
});
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn((_key: string, defaultValue: any) =>
      Promise.resolve(defaultValue),
    ),
    setSetting: jest.fn().mockResolvedValue(undefined),
    getAllSettings: jest.fn().mockResolvedValue({}),
    getNetwork: jest.fn().mockResolvedValue(null),
    getAllNetworks: jest.fn().mockResolvedValue([]),
    saveNetwork: jest.fn().mockResolvedValue(undefined),
    deleteNetwork: jest.fn().mockResolvedValue(undefined),
    loadNetworks: jest.fn().mockResolvedValue([]),
    createDefaultNetwork: jest
      .fn()
      .mockResolvedValue({ id: 'DBase', name: 'DBase', servers: [] }),
    updateServerInNetwork: jest.fn().mockResolvedValue(undefined),
    addServerToNetwork: jest.fn().mockResolvedValue(undefined),
    updateNetwork: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnValue(jest.fn()),
    off: jest.fn(),
    onSettingChange: jest.fn().mockReturnValue(jest.fn()),
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
    getStats: jest
      .fn()
      .mockResolvedValue({ totalMessages: 0, totalBytes: 0, perNetwork: {} }),
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
    getCurrentTheme: jest
      .fn()
      .mockReturnValue({ id: 'light', name: 'Light', colors: {} }),
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
    getStorageStats: jest
      .fn()
      .mockResolvedValue({ totalMessages: 0, totalBytes: 0 }),
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
  const { View, Text, TouchableOpacity } = require('react-native');
  const make = (name: string) => (_props: any) => (
    <View>
      <Text>{name}</Text>
    </View>
  );
  return {
    ScriptingAdsSection: make('ScriptingAdsSection'),
    SecurityQuickConnectSection: make('SecurityQuickConnectSection'),
    SecuritySection: (props: any) => (
      <View>
        <TouchableOpacity
          testID="sec-open-migration"
          onPress={() => props.onShowMigrationDialog?.()}
        >
          <Text>Open Migration</Text>
        </TouchableOpacity>
      </View>
    ),
    PrivacyLegalSection: make('PrivacyLegalSection'),
    AboutSection: make('AboutSection'),
    HelpSection: make('HelpSection'),
    AppearanceSection: make('AppearanceSection'),
    DisplayUISection: make('DisplayUISection'),
    MessageHistorySection: make('MessageHistorySection'),
    NotificationsSection: make('NotificationsSection'),
    ConnectionNetworkSection: make('ConnectionNetworkSection'),
    BackgroundBatterySection: make('BackgroundBatterySection'),
    HighlightingSection: make('HighlightingSection'),
    UsersServicesSection: make('UsersServicesSection'),
    CommandsSection: make('CommandsSection'),
    MediaSection: make('MediaSection'),
    AwaySection: make('AwaySection'),
    ProtectionSection: make('ProtectionSection'),
    WritingSection: make('WritingSection'),
  };
});
const passthroughScreen =
  (name: string) =>
  ({ visible, onClose }: any) => {
    const { Text } = require('react-native');
    return visible ? (
      <>
        <Text>{name}Mock</Text>
        <Text onPress={() => onClose?.()}>{name}Close</Text>
      </>
    ) : null;
  };
jest.mock('../../src/screens/ScriptingScreen', () => ({
  ScriptingScreen: passthroughScreen('Scripting'),
}));
jest.mock('../../src/screens/ScriptingHelpScreen', () => ({
  ScriptingHelpScreen: passthroughScreen('ScriptingHelp'),
}));
jest.mock('../../src/screens/KeyManagementScreen', () => ({
  KeyManagementScreen: passthroughScreen('KeyManagement'),
}));
jest.mock('../../src/screens/FirstRunSetupScreen', () => ({
  FirstRunSetupScreen: () => {
    const { Text } = require('react-native');
    return <Text>FirstRunSetupScreenMock</Text>;
  },
}));
jest.mock('../../src/screens/ConnectionProfilesScreen', () => ({
  ConnectionProfilesScreen: passthroughScreen('ConnectionProfiles'),
}));
jest.mock('../../src/screens/ThemeEditorScreen', () => ({
  ThemeEditorScreen: passthroughScreen('ThemeEditor'),
}));
jest.mock('../../src/screens/AboutScreen', () => ({
  AboutScreen: passthroughScreen('About'),
}));
jest.mock('../../src/screens/CreditsScreen', () => ({
  CreditsScreen: passthroughScreen('Credits'),
}));
jest.mock('../../src/screens/PrivacyAdsScreen', () => ({
  PrivacyAdsScreen: passthroughScreen('PrivacyAds'),
}));
jest.mock('../../src/screens/DataPrivacyScreen', () => ({
  DataPrivacyScreen: passthroughScreen('DataPrivacy'),
}));
jest.mock('../../src/screens/MessageHistoryViewerScreen', () => ({
  MessageHistoryViewerScreen: passthroughScreen('MessageHistoryViewer'),
}));
jest.mock('../../src/screens/ZncSubscriptionScreen', () => ({
  ZncSubscriptionScreen: passthroughScreen('ZncSubscription'),
}));
jest.mock('../../src/screens/PrivacyRelayScreen', () => ({
  PrivacyRelayScreen: passthroughScreen('PrivacyRelay'),
}));
jest.mock('../../src/screens/BackupScreen', () => ({
  BackupScreen: passthroughScreen('BackupScreen'),
}));
jest.mock('../../src/hooks/useIapConnectionLease', () => ({
  useIapConnectionLease: () => ({
    ensureIapConnection: jest.fn().mockResolvedValue(undefined),
    releaseIapConnection: jest.fn(),
  }),
}));
jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: jest.fn(() => ({
      setShowSettings: jest.fn(),
      setShowNetworksList: jest.fn(),
    })),
  },
}));

const { SettingsScreen } = jest.requireActual(
  '../../src/screens/SettingsScreen',
);

const settingsServiceMock = require('../../src/services/SettingsService')
  .settingsService as {
  getSetting: jest.Mock;
  setSetting: jest.Mock;
  loadNetworks: jest.Mock;
  createDefaultNetwork: jest.Mock;
  updateServerInNetwork: jest.Mock;
  addServerToNetwork: jest.Mock;
  updateNetwork: jest.Mock;
};
const notificationServiceMock =
  require('../../src/services/NotificationService').notificationService;
const performanceServiceMock =
  require('../../src/services/PerformanceService').performanceService;
const subscriptionServiceMock =
  require('../../src/services/SubscriptionService').subscriptionService;
const encryptedDMServiceMock =
  require('../../src/services/EncryptedDMService').encryptedDMService;
const connectionManagerMock =
  require('../../src/services/ConnectionManager').connectionManager;
const messageHistoryServiceMock =
  require('../../src/services/MessageHistoryService').messageHistoryService;
const RNIap = require('react-native-iap');

describe('SettingsScreen coverage', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedSettingItems.clear();

    settingsServiceMock.getSetting.mockImplementation(
      (_key: string, defaultValue: any) => Promise.resolve(defaultValue),
    );
    settingsServiceMock.loadNetworks.mockResolvedValue([]);
    settingsServiceMock.createDefaultNetwork.mockResolvedValue({
      id: 'DBase',
      name: 'DBase',
      servers: [],
    });

    (settingsHelpers.getSectionIcon as jest.Mock).mockReturnValue({
      name: 'cog',
      solid: false,
    });
    (settingsHelpers.filterSettings as jest.Mock).mockImplementation(
      sections => sections,
    );
    (settingsHelpers.orderSections as jest.Mock).mockImplementation(
      sections => sections,
    );
    (settingsHelpers.toggleSectionExpansion as jest.Mock).mockImplementation(
      (title, expanded) => {
        const next = new Set(expanded);
        if (next.has(title)) next.delete(title);
        else next.add(title);
        return next;
      },
    );

    // Reset IAP mock behaviour between tests
    RNIap.fetchProducts.mockResolvedValue([]);
    RNIap.purchaseUpdatedListener.mockReturnValue({ remove: jest.fn() });
    RNIap.purchaseErrorListener.mockReturnValue({ remove: jest.fn() });
    RNIap.finishTransaction.mockResolvedValue(undefined);
  });

  const getPurchaseCallback = () =>
    (RNIap.purchaseUpdatedListener as jest.Mock).mock.calls[0][0];
  const getErrorCallback = () =>
    (RNIap.purchaseErrorListener as jest.Mock).mock.calls[0][0];

  // ================= ZNC subscription product loading =================

  it('loads ZNC subscription product with Android offer details', async () => {
    RNIap.fetchProducts.mockResolvedValue([
      {
        id: 'znc',
        type: 'subs',
        displayPrice: '$5.00',
        subscriptionOfferDetailsAndroid: [
          { basePlanId: 'other-plan', offerToken: 'tokA' },
          { basePlanId: 'znc-user', offerToken: 'tokB' },
        ],
      },
    ]);

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(RNIap.fetchProducts).toHaveBeenCalledWith({
        skus: ['znc'],
        type: 'subs',
      });
    });
  });

  it('handles ZNC product missing from fetch results', async () => {
    RNIap.fetchProducts.mockResolvedValue([
      { id: 'something-else', type: 'subs' },
    ]);

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(RNIap.fetchProducts).toHaveBeenCalled();
    });
  });

  it('handles ZNC product fetch failure gracefully', async () => {
    RNIap.fetchProducts.mockRejectedValue(new Error('network down'));

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(RNIap.fetchProducts).toHaveBeenCalled();
    });
  });

  // ================= Purchase listener flows =================

  it('registers ZNC subscription and adds server on successful purchase', async () => {
    jest.spyOn(Alert, 'alert');
    settingsServiceMock.loadNetworks.mockResolvedValue([
      { id: 'DBase', name: 'DBase', servers: [] },
    ]);
    subscriptionServiceMock.registerZncSubscription.mockResolvedValue({
      status: 'active',
      expiresAt: '2030-01-01T00:00:00Z',
      zncUsername: 'zuser',
      zncPassword: 'zpass',
      provisioningStatus: 'ready',
    });

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(RNIap.purchaseUpdatedListener).toHaveBeenCalled();
    });

    await getPurchaseCallback()({
      productId: 'znc',
      purchaseToken: 'purchase-token-123',
    });

    expect(RNIap.finishTransaction).toHaveBeenCalled();
    expect(
      subscriptionServiceMock.registerZncSubscription,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseToken: 'purchase-token-123' }),
    );
    expect(settingsServiceMock.addServerToNetwork).toHaveBeenCalled();
    expect(
      (Alert.alert as jest.Mock).mock.calls.some(c =>
        String(c[0]).includes('ZNC Ready'),
      ),
    ).toBe(true);
  });

  it('updates existing ZNC server and creates default network when DBase missing', async () => {
    jest.spyOn(Alert, 'alert');
    settingsServiceMock.loadNetworks.mockResolvedValue([]); // no DBase -> createDefaultNetwork
    settingsServiceMock.createDefaultNetwork.mockResolvedValue({
      id: 'DBase',
      name: 'DBase',
      servers: [{ id: 'znc-subscription' }], // existing server -> update branch
    });
    subscriptionServiceMock.registerZncSubscription.mockResolvedValue({
      status: 'grace',
      expiresAt: '2030-01-01T00:00:00Z',
      zncUsername: 'zuser',
      zncPassword: 'zpass',
      provisioningStatus: 'ready',
    });

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(RNIap.purchaseUpdatedListener).toHaveBeenCalled();
    });

    await getPurchaseCallback()({
      productId: 'znc',
      purchaseToken: 'tok-abc',
    });

    expect(settingsServiceMock.createDefaultNetwork).toHaveBeenCalled();
    expect(settingsServiceMock.updateServerInNetwork).toHaveBeenCalled();
  });

  it('shows subscription-updated alert for non-active status', async () => {
    jest.spyOn(Alert, 'alert');
    subscriptionServiceMock.registerZncSubscription.mockResolvedValue({
      status: 'pending',
      expiresAt: null,
      zncUsername: '',
      zncPassword: '',
      provisioningStatus: 'processing',
    });

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(RNIap.purchaseUpdatedListener).toHaveBeenCalled();
    });

    await getPurchaseCallback()({
      productId: 'znc',
      purchaseToken: 'tok-pending',
    });

    expect(
      (Alert.alert as jest.Mock).mock.calls.some(c =>
        String(c[0]).includes('Subscription Updated'),
      ),
    ).toBe(true);
    expect(settingsServiceMock.addServerToNetwork).not.toHaveBeenCalled();
  });

  it('alerts on subscription registration error', async () => {
    jest.spyOn(Alert, 'alert');
    subscriptionServiceMock.registerZncSubscription.mockRejectedValue(
      new Error('server rejected'),
    );

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(RNIap.purchaseUpdatedListener).toHaveBeenCalled();
    });

    await getPurchaseCallback()({
      productId: 'znc',
      purchaseToken: 'tok-err',
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Subscription Error',
      'server rejected',
    );
  });

  it('surfaces applyZncServerToDBase failures as a subscription error', async () => {
    jest.spyOn(Alert, 'alert');
    settingsServiceMock.loadNetworks.mockResolvedValue([
      { id: 'DBase', name: 'DBase', servers: [] },
    ]);
    settingsServiceMock.updateNetwork.mockRejectedValueOnce(
      new Error('disk full'),
    );
    subscriptionServiceMock.registerZncSubscription.mockResolvedValue({
      status: 'active',
      expiresAt: '2030-01-01T00:00:00Z',
      zncUsername: 'zuser',
      zncPassword: 'zpass',
      provisioningStatus: 'ready',
    });

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(RNIap.purchaseUpdatedListener).toHaveBeenCalled();
    });

    await getPurchaseCallback()({
      productId: 'znc',
      purchaseToken: 'tok-applyfail',
    });

    expect(Alert.alert).toHaveBeenCalledWith('Subscription Error', 'disk full');
  });

  it('ignores purchases for other products', async () => {
    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(RNIap.purchaseUpdatedListener).toHaveBeenCalled();
    });

    await getPurchaseCallback()({
      productId: 'not-znc',
      purchaseToken: 'x',
    });

    expect(
      subscriptionServiceMock.registerZncSubscription,
    ).not.toHaveBeenCalled();
  });

  it('alerts when purchase token is missing', async () => {
    jest.spyOn(Alert, 'alert');
    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(RNIap.purchaseUpdatedListener).toHaveBeenCalled();
    });

    await getPurchaseCallback()({ productId: 'znc' });

    expect(
      (Alert.alert as jest.Mock).mock.calls.some(c =>
        String(c[0]).includes('Purchase Error'),
      ),
    ).toBe(true);
    expect(
      subscriptionServiceMock.registerZncSubscription,
    ).not.toHaveBeenCalled();
  });

  it('uses transactionReceipt when purchaseToken absent but present', async () => {
    settingsServiceMock.loadNetworks.mockResolvedValue([
      { id: 'DBase', name: 'DBase', servers: [] },
    ]);
    subscriptionServiceMock.registerZncSubscription.mockResolvedValue({
      status: 'active',
      zncUsername: 'zuser',
      zncPassword: 'zpass',
      provisioningStatus: 'ready',
    });

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(RNIap.purchaseUpdatedListener).toHaveBeenCalled();
    });

    await getPurchaseCallback()({
      productId: 'znc',
      transactionReceipt: 'receipt-xyz',
    });

    expect(
      subscriptionServiceMock.registerZncSubscription,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseToken: 'receipt-xyz' }),
    );
  });

  it('handles finishTransaction failure but still registers', async () => {
    RNIap.finishTransaction.mockRejectedValue(new Error('finish failed'));
    settingsServiceMock.loadNetworks.mockResolvedValue([
      { id: 'DBase', name: 'DBase', servers: [] },
    ]);
    subscriptionServiceMock.registerZncSubscription.mockResolvedValue({
      status: 'pending',
      provisioningStatus: 'processing',
    });

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(RNIap.purchaseUpdatedListener).toHaveBeenCalled();
    });

    await getPurchaseCallback()({
      productId: 'znc',
      purchaseToken: 'tok-finfail',
    });

    expect(subscriptionServiceMock.registerZncSubscription).toHaveBeenCalled();
  });

  // ================= Purchase error listener =================

  it('alerts on purchase error that is not user cancellation', async () => {
    jest.spyOn(Alert, 'alert');
    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(RNIap.purchaseErrorListener).toHaveBeenCalled();
    });

    getErrorCallback()({
      productId: 'znc',
      code: 'E_UNKNOWN',
      message: 'boom',
    });

    expect(Alert.alert).toHaveBeenCalledWith('Purchase Failed', 'boom');
  });

  it('does not alert when purchase is cancelled by user', async () => {
    jest.spyOn(Alert, 'alert');
    (Alert.alert as jest.Mock).mockClear();
    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(RNIap.purchaseErrorListener).toHaveBeenCalled();
    });

    getErrorCallback()({ productId: 'znc', code: 'E_USER_CANCELLED' });

    expect(
      (Alert.alert as jest.Mock).mock.calls.some(c =>
        String(c[0]).includes('Purchase Failed'),
      ),
    ).toBe(false);
  });

  it('ignores purchase errors from other products', async () => {
    jest.spyOn(Alert, 'alert');
    (Alert.alert as jest.Mock).mockClear();
    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);
    await waitFor(() => {
      expect(RNIap.purchaseErrorListener).toHaveBeenCalled();
    });

    getErrorCallback()({ productId: 'other', code: 'E_UNKNOWN' });

    expect(
      (Alert.alert as jest.Mock).mock.calls.some(c =>
        String(c[0]).includes('Purchase Failed'),
      ),
    ).toBe(false);
  });

  // ================= loadSettings branches =================

  it('loads a global proxy configuration with populated values', async () => {
    settingsServiceMock.getSetting.mockImplementation(
      (key: string, defaultValue: any) => {
        if (key === 'globalProxy') {
          return Promise.resolve({
            enabled: true,
            type: 'http',
            host: 'proxy.example.com',
            port: 8080,
            username: 'u',
            password: 'p',
          });
        }
        return Promise.resolve(defaultValue);
      },
    );

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(settingsServiceMock.getSetting).toHaveBeenCalledWith(
        'globalProxy',
        expect.anything(),
      );
    });
  });

  it('normalises ZNC subscription config with empty subscription id', async () => {
    settingsServiceMock.getSetting.mockImplementation(
      (key: string, defaultValue: any) => {
        if (key === 'zncSubscriptionConfig') {
          return Promise.resolve({
            purchaseToken: 'stored-token',
            subscriptionId: '',
            zncUsername: 'storeduser',
          });
        }
        return Promise.resolve(defaultValue);
      },
    );

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(settingsServiceMock.setSetting).toHaveBeenCalledWith(
        'zncSubscriptionConfig',
        expect.objectContaining({ subscriptionId: 'znc' }),
      );
    });
  });

  // ================= Notification permission =================

  it('disables notifications when permission was revoked', async () => {
    jest.spyOn(Alert, 'alert');
    const updateNotificationPrefs = jest.fn().mockResolvedValue(undefined);
    const {
      useSettingsNotifications,
    } = require('../../src/hooks/useSettingsNotifications');
    (useSettingsNotifications as jest.Mock).mockReturnValue({
      notificationEnabled: true,
      setNotificationEnabled: jest.fn(),
      refreshNotificationPrefs: jest.fn(),
      updateNotificationPrefs,
    });
    (notificationServiceMock.getPreferences as jest.Mock).mockReturnValue({
      enabled: true,
    });
    (notificationServiceMock.checkPermission as jest.Mock).mockResolvedValue(
      false,
    );

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(notificationServiceMock.updatePreferences).toHaveBeenCalledWith({
        enabled: false,
      });
    });
    expect(updateNotificationPrefs).toHaveBeenCalledWith({ enabled: false });
    expect(
      (Alert.alert as jest.Mock).mock.calls.some(c =>
        String(c[0]).includes('Permission Required'),
      ),
    ).toBe(true);
  });

  // ================= Development / debug section =================

  it('toggles console logging and debug category items', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter(s => s.id === 'development'),
    );
    (performanceServiceMock.getConfig as jest.Mock).mockReturnValue({
      debugLoggingEnabled: true,
      debugLogCategories: { appState: false },
    });

    const view = await render(
      <SettingsScreen visible={true} onClose={mockOnClose} />,
    );
    await fireEvent.press(view.getByText('Development'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('console-logging')).toBeTruthy();
    });

    // Toggle console logging off -> disables debug logging as a side effect
    await mockCapturedSettingItems.get('console-logging').onValueChange(false);
    expect(performanceServiceMock.setConfig).toHaveBeenCalledWith({
      debugLoggingEnabled: false,
    });

    // Master debug-logging switch
    const masterToggle = mockCapturedSettingItems.get(
      'debug-category-logging-enabled',
    );
    expect(masterToggle).toBeTruthy();
    await masterToggle.onValueChange(true);
    expect(performanceServiceMock.setConfig).toHaveBeenCalledWith({
      debugLoggingEnabled: true,
    });

    // A per-category switch
    const categoryToggle = mockCapturedSettingItems.get(
      'debug-category-appState',
    );
    expect(categoryToggle).toBeTruthy();
    await categoryToggle.onValueChange(true);
    expect(performanceServiceMock.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        debugLogCategories: expect.objectContaining({ appState: true }),
      }),
    );
  });

  it('toggles console logging on without disabling debug logging', async () => {
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter(s => s.id === 'development'),
    );

    const view = await render(
      <SettingsScreen visible={true} onClose={mockOnClose} />,
    );
    await fireEvent.press(view.getByText('Development'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('console-logging')).toBeTruthy();
    });

    await mockCapturedSettingItems.get('console-logging').onValueChange(true);
    // debugLoggingEnabled defaults to falsy so the cleanup branch is skipped
    expect(performanceServiceMock.setConfig).not.toHaveBeenCalledWith({
      debugLoggingEnabled: false,
    });
  });

  // ================= Migration dialog edge cases =================

  it('reports when there are no old keys to migrate', async () => {
    jest.spyOn(Alert, 'alert');
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter(s => s.id === 'security'),
    );
    (connectionManagerMock.getAllConnections as jest.Mock).mockReturnValue([
      { networkId: 'net-a' },
    ]);
    (
      encryptedDMServiceMock.migrateOldKeysToNetwork as jest.Mock
    ).mockResolvedValue(0);

    const view = await render(
      <SettingsScreen
        visible={true}
        onClose={mockOnClose}
        currentNetwork="net-a"
      />,
    );
    await fireEvent.press(view.getByText('Security'));
    await fireEvent.press(view.getByTestId('sec-open-migration'));

    expect(await view.findByText('Migrate Old Keys')).toBeTruthy();
    await fireEvent.press(view.getByText('Migrate'));

    await waitFor(() => {
      expect(
        encryptedDMServiceMock.migrateOldKeysToNetwork,
      ).toHaveBeenCalledWith('net-a');
    });
    expect(
      (Alert.alert as jest.Mock).mock.calls.some(c =>
        String(c[1]).includes('No old keys found'),
      ),
    ).toBe(true);
  });

  // ================= History export error handling =================

  it('alerts when history export fails', async () => {
    jest.spyOn(Alert, 'alert');
    const fsMock = settingsHelpers.filterSettings as jest.Mock;
    fsMock.mockImplementation((sections: any[]) =>
      sections.filter(s => s.id === 'messages-history'),
    );
    (messageHistoryServiceMock.exportHistory as jest.Mock).mockRejectedValue(
      new Error('export boom'),
    );

    const view = await render(
      <SettingsScreen
        visible={true}
        onClose={mockOnClose}
        currentNetwork="net-a"
      />,
    );
    await fireEvent.press(view.getByText('Messages & History'));

    await waitFor(() => {
      expect(mockCapturedSettingItems.get('history-export')).toBeTruthy();
    });

    const submenu = mockCapturedSettingItems.get('history-export').submenuItems;
    await submenu.find((it: any) => it.id === 'export-json').onPress();

    expect(Alert.alert).toHaveBeenCalledWith('Export Error', 'export boom');
  });

  // ================= Android-specific IAP paths =================

  describe('on Android', () => {
    const { Platform } = require('react-native');
    let originalOS: string;

    beforeEach(() => {
      originalOS = Platform.OS;
      Platform.OS = 'android';
    });

    afterEach(() => {
      Platform.OS = originalOS;
    });

    it('resolves the Android subscription offer token and flushes pending purchases', async () => {
      RNIap.fetchProducts.mockResolvedValue([
        {
          id: 'znc',
          type: 'subs',
          displayPrice: '$5.00',
          subscriptionOfferDetailsAndroid: [
            { basePlanId: 'other-plan', offerToken: 'tokA' },
            { basePlanId: 'znc-user', offerToken: 'tokB' },
          ],
        },
      ]);

      await render(<SettingsScreen visible={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(RNIap.fetchProducts).toHaveBeenCalled();
      });
      expect(
        RNIap.flushFailedPurchasesCachedAsPendingAndroid,
      ).toHaveBeenCalled();
    });

    it('falls back to the first offer when no base plan matches', async () => {
      RNIap.fetchProducts.mockResolvedValue([
        {
          id: 'znc',
          type: 'subs',
          displayPrice: '$5.00',
          subscriptionOfferDetailsAndroid: [
            { basePlanId: 'unmatched', offerToken: 'tokOnly' },
          ],
        },
      ]);

      await render(<SettingsScreen visible={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(RNIap.fetchProducts).toHaveBeenCalled();
      });
    });
  });

  // ================= Missing / empty global proxy =================

  it('handles a missing global proxy configuration', async () => {
    settingsServiceMock.getSetting.mockImplementation(
      (key: string, defaultValue: any) => {
        if (key === 'globalProxy') return Promise.resolve(null);
        return Promise.resolve(defaultValue);
      },
    );

    await render(<SettingsScreen visible={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(settingsServiceMock.getSetting).toHaveBeenCalledWith(
        'globalProxy',
        expect.anything(),
      );
    });
  });
});
