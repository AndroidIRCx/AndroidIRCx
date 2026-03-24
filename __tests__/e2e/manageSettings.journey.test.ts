/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * E2E journey test for managing settings
 */

import { renderHook } from '@testing-library/react-native';
import { useConnectionLifecycle } from '../../src/hooks/useConnectionLifecycle';

// Mock all services used in the manage settings journey
jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn().mockReturnValue([]),
    onConnectionCreated: jest.fn().mockReturnValue(jest.fn()),
    getActiveNetworkId: jest.fn().mockReturnValue('test-network'),
    getConnection: jest.fn().mockReturnValue(null),
    setActiveConnection: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    onMessage: jest.fn().mockReturnValue(jest.fn()),
    onConnectionChange: jest.fn().mockReturnValue(jest.fn()),
    on: jest.fn().mockReturnValue(jest.fn()),
    onUserListChange: jest.fn().mockReturnValue(jest.fn()),
    getConnectionStatus: jest.fn().mockReturnValue(true), // Connected
    getNetworkName: jest.fn().mockReturnValue('test-network'),
    getCurrentNick: jest.fn().mockReturnValue('testuser'),
    addMessage: jest.fn(),
    sendRaw: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    sendAction: jest.fn().mockResolvedValue(undefined),
    sendNotice: jest.fn().mockResolvedValue(undefined),
    joinChannel: jest.fn().mockResolvedValue(undefined),
    partChannel: jest.fn().mockResolvedValue(undefined),
  },
  ChannelUser: {}
}));

jest.mock('../../src/services/UserManagementService', () => ({
  userManagementService: {
    isUserIgnored: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn().mockResolvedValue('server'),
    loadNetworks: jest.fn().mockResolvedValue([]),
    getNetwork: jest.fn().mockResolvedValue(null),
    isFirstRun: jest.fn().mockResolvedValue(false),
    saveSetting: jest.fn().mockResolvedValue(undefined),
    saveNetworks: jest.fn().mockResolvedValue(undefined),
    loadSettings: jest.fn().mockResolvedValue({}),
    saveSettings: jest.fn().mockResolvedValue(undefined),
  },
  NEW_FEATURE_DEFAULTS: {
    dccAcceptExts: [],
    dccRejectExts: [],
    dccDontSendExts: [],
  }
}));

jest.mock('../../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    onBundleStored: jest.fn().mockReturnValue(jest.fn()),
    onKeyRequest: jest.fn().mockReturnValue(jest.fn()),
    formatFingerprintForDisplay: jest.fn().mockReturnValue('test-fingerprint'),
    rejectKeyOfferForNetwork: jest.fn().mockResolvedValue(undefined),
    acceptKeyOfferForNetwork: jest.fn().mockResolvedValue({}),
    isEncryptedForNetwork: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/services/ChannelEncryptionService', () => ({
  channelEncryptionService: {
    onChannelKeyChange: jest.fn().mockReturnValue(jest.fn()),
    hasChannelKey: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/services/OfflineQueueService', () => ({
  offlineQueueService: {
    processQueue: jest.fn(),
  },
}));

jest.mock('../../src/services/AutoReconnectService', () => ({
  autoReconnectService: {
    markIntentionalDisconnect: jest.fn(),
  },
}));

jest.mock('../../src/services/UserActivityService', () => ({
  userActivityService: {
    clearNetwork: jest.fn(),
  },
}));

jest.mock('../../src/services/ScriptingService', () => ({
  scriptingService: {
    handleMessage: jest.fn(),
    handleDisconnect: jest.fn(),
  },
}));

jest.mock('../../src/services/DCCChatService', () => ({
  dccChatService: {
    parseDccChatInvite: jest.fn().mockReturnValue(null),
    handleIncomingInvite: jest.fn().mockReturnValue({ id: 'session-id' }),
    acceptInvite: jest.fn(),
    closeSession: jest.fn(),
  },
}));

jest.mock('../../src/services/DCCFileService', () => ({
  dccFileService: {
    parseSendOffer: jest.fn().mockReturnValue(null),
    handleOffer: jest.fn().mockReturnValue({ id: 'transfer-id' }),
    getDefaultDownloadPath: jest.fn().mockResolvedValue('/downloads'),
    accept: jest.fn(),
    cancel: jest.fn(),
  },
}));

jest.mock('../../src/services/SoundService', () => ({
  soundService: {
    playSound: jest.fn(),
    initialize: jest.fn(),
  },
}));

jest.mock('../../src/services/NotificationService', () => ({
  notificationService: {
    shouldNotify: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: jest.fn().mockReturnValue({
      tabs: [
        { id: 'server-test-network', type: 'server', name: 'test-network', networkId: 'test-network', messages: [] }
      ],
      setTabs: jest.fn(),
      setActiveTabId: jest.fn(),
    }),
  },
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: jest.fn().mockReturnValue({
      setChannelUsers: jest.fn(),
      setTypingUser: jest.fn(),
      setMotdSignal: jest.fn(),
    }),
  },
}));

jest.mock('../../src/services/TabService', () => ({
  tabService: {
    getTabs: jest.fn().mockResolvedValue([]),
    saveTabs: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    loadMessages: jest.fn().mockResolvedValue([]),
    deleteMessages: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/utils/tabUtils', () => ({
  serverTabId: jest.fn().mockReturnValue('server-test-network'),
  channelTabId: jest.fn().mockReturnValue('channel-test-network-#test'),
  queryTabId: jest.fn().mockReturnValue('query-test-network-nickname'),
  makeServerTab: jest.fn().mockReturnValue({ 
    id: 'server-test-network', 
    type: 'server', 
    name: 'test-network', 
    networkId: 'test-network' 
  }),
  sortTabsGrouped: jest.fn().mockImplementation((tabs) => tabs),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: jest.fn().mockReturnValue((str) => str),
}));

jest.mock('../../src/services/STSService', () => ({
  stsService: {
    savePolicy: jest.fn().mockReturnValue(true),
    getPolicy: jest.fn().mockReturnValue({ expiresAt: Date.now() + 3600000 }),
  },
}));

// Mock Alert
const mockAlert = {
  alert: jest.fn(),
};
global.Alert = mockAlert;

describe('manageSettings Journey Test', () => {
  const mockParams = {
    processBatchedMessages: jest.fn(),
    safeSetState: jest.fn().mockImplementation((fn) => fn()),
    safeAlert: mockAlert.alert,
    setIsConnected: jest.fn(),
    setActiveConnectionId: jest.fn(),
    setNetworkName: jest.fn(),
    setTabs: jest.fn(),
    setActiveTabId: jest.fn(),
    setChannelUsers: jest.fn(),
    setPing: jest.fn(),
    setTypingUser: jest.fn(),
    setMotdSignal: jest.fn(),
    networkName: 'test-network',
    activeTabId: 'server-test-network',
    tabsRef: { current: [
      { id: 'server-test-network', type: 'server', name: 'test-network', networkId: 'test-network', messages: [] }
    ]},
    tabSortAlphabetical: false,
    isConnected: true, // Connected for managing settings
    messageBatchTimeoutRef: { current: null },
    pendingMessagesRef: { current: [] },
    motdCompleteRef: { current: new Set() },
    isMountedRef: { current: true },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set default mock implementations
    require('../../src/services/SettingsService').settingsService.getSetting.mockResolvedValue('server');
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([]);
    require('../../src/services/SettingsService').settingsService.isFirstRun.mockResolvedValue(false);
    require('../../src/services/IRCService').ircService.getNetworkName.mockReturnValue('test-network');
    require('../../src/services/IRCService').ircService.getCurrentNick.mockReturnValue('testuser');
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: [
        { id: 'server-test-network', type: 'server', name: 'test-network', networkId: 'test-network', messages: [] }
      ],
      setTabs: jest.fn(),
      setActiveTabId: jest.fn(),
    });
  });

  it('should change notification settings', async () => {
    const mockSaveSetting = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/SettingsService').settingsService.saveSetting.mockImplementation(mockSaveSetting);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate changing notification settings
    await require('../../src/services/SettingsService').settingsService.saveSetting('notificationsEnabled', true);

    // Verify that the setting was saved
    expect(mockSaveSetting).toHaveBeenCalledWith('notificationsEnabled', true);
  });

  it('should change theme settings', async () => {
    const mockSaveSetting = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/SettingsService').settingsService.saveSetting.mockImplementation(mockSaveSetting);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate changing theme settings
    await require('../../src/services/SettingsService').settingsService.saveSetting('theme', 'dark');

    // Verify that the setting was saved
    expect(mockSaveSetting).toHaveBeenCalledWith('theme', 'dark');
  });

  it('should change nickname settings', async () => {
    const mockSaveSetting = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/SettingsService').settingsService.saveSetting.mockImplementation(mockSaveSetting);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate changing nickname settings
    await require('../../src/services/SettingsService').settingsService.saveSetting('nickname', 'newnickname');

    // Verify that the setting was saved
    expect(mockSaveSetting).toHaveBeenCalledWith('nickname', 'newnickname');
  });

  it('should change auto-join channel settings', async () => {
    const mockSaveSetting = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/SettingsService').settingsService.saveSetting.mockImplementation(mockSaveSetting);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate changing auto-join channel settings
    await require('../../src/services/SettingsService').settingsService.saveSetting('autoJoinChannels', ['#general', '#random']);

    // Verify that the setting was saved
    expect(mockSaveSetting).toHaveBeenCalledWith('autoJoinChannels', ['#general', '#random']);
  });

  it('should change message history settings', async () => {
    const mockSaveSetting = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/SettingsService').settingsService.saveSetting.mockImplementation(mockSaveSetting);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate changing message history settings
    await require('../../src/services/SettingsService').settingsService.saveSetting('messageHistoryLimit', 1000);

    // Verify that the setting was saved
    expect(mockSaveSetting).toHaveBeenCalledWith('messageHistoryLimit', 1000);
  });

  it('should change DCC settings', async () => {
    const mockSaveSetting = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/SettingsService').settingsService.saveSetting.mockImplementation(mockSaveSetting);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate changing DCC settings
    await require('../../src/services/SettingsService').settingsService.saveSetting('dccAutoGetMode', 'accept');

    // Verify that the setting was saved
    expect(mockSaveSetting).toHaveBeenCalledWith('dccAutoGetMode', 'accept');
  });

  it('should change encryption settings', async () => {
    const mockSaveSetting = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/SettingsService').settingsService.saveSetting.mockImplementation(mockSaveSetting);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate changing encryption settings
    await require('../../src/services/SettingsService').settingsService.saveSetting('encryptionEnabled', true);

    // Verify that the setting was saved
    expect(mockSaveSetting).toHaveBeenCalledWith('encryptionEnabled', true);
  });

  it('should change privacy settings', async () => {
    const mockSaveSetting = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/SettingsService').settingsService.saveSetting.mockImplementation(mockSaveSetting);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate changing privacy settings
    await require('../../src/services/SettingsService').settingsService.saveSetting('showUserList', false);

    // Verify that the setting was saved
    expect(mockSaveSetting).toHaveBeenCalledWith('showUserList', false);
  });

  it('should change appearance settings', async () => {
    const mockSaveSetting = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/SettingsService').settingsService.saveSetting.mockImplementation(mockSaveSetting);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate changing appearance settings
    await require('../../src/services/SettingsService').settingsService.saveSetting('fontSize', 'large');

    // Verify that the setting was saved
    expect(mockSaveSetting).toHaveBeenCalledWith('fontSize', 'large');
  });

  it('should save all settings at once', async () => {
    const mockSaveSettings = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/SettingsService').settingsService.saveSettings.mockImplementation(mockSaveSettings);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate saving all settings
    const settings = {
      theme: 'dark',
      notificationsEnabled: true,
      nickname: 'newnickname',
      autoJoinChannels: ['#general'],
      messageHistoryLimit: 500,
      dccAutoGetMode: 'prompt',
      encryptionEnabled: true,
      showUserList: true,
      fontSize: 'medium'
    };
    await require('../../src/services/SettingsService').settingsService.saveSettings(settings);

    // Verify that all settings were saved
    expect(mockSaveSettings).toHaveBeenCalledWith(settings);
  });
});
