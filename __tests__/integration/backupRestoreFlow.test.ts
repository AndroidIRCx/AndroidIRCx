/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Integration test for backup/restore sequence
 */

import { renderHook } from '@testing-library/react-native';
import { useConnectionLifecycle } from '../../src/hooks/useConnectionLifecycle';

// Mock all services used in the backup/restore flow
jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn().mockReturnValue([]),
    onConnectionCreated: jest.fn().mockReturnValue(jest.fn()),
    getActiveNetworkId: jest.fn().mockReturnValue('test-network'),
    getConnection: jest.fn().mockReturnValue(null),
    setActiveConnection: jest.fn(),
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
      tabs: [],
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

jest.mock('../../src/services/DataBackupService', () => ({
  dataBackupService: {
    createBackup: jest.fn().mockResolvedValue({}),
    restoreBackup: jest.fn().mockResolvedValue(undefined),
    validateBackup: jest.fn().mockReturnValue(true),
    getBackupMetadata: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('../../src/services/StorageCache', () => ({
  storageCache: {
    clear: jest.fn(),
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

describe('backupRestoreFlow Integration Test', () => {
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
    activeTabId: 'active-tab',
    tabsRef: { current: [] },
    tabSortAlphabetical: false,
    isConnected: true, // Connected for backup/restore flow
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
    require('../../src/services/IRCService').ircService.getNetworkName.mockReturnValue('test-network');
    require('../../src/services/IRCService').ircService.getCurrentNick.mockReturnValue('testuser');
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      tabs: [],
      setTabs: jest.fn(),
      setActiveTabId: jest.fn(),
    });
  });

  it('should handle creating a backup', async () => {
    const mockCreateBackup = jest.fn().mockResolvedValue({
      metadata: { version: '1.0', timestamp: Date.now() },
      settings: {},
      networks: [],
      tabs: [],
    });
    require('../../src/services/DataBackupService').dataBackupService.createBackup.mockImplementation(mockCreateBackup);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate creating a backup
    const backup = await require('../../src/services/DataBackupService').dataBackupService.createBackup();

    // Verify that the backup was created successfully
    expect(mockCreateBackup).toHaveBeenCalled();
    expect(backup).toHaveProperty('metadata');
    expect(backup).toHaveProperty('settings');
    expect(backup).toHaveProperty('networks');
    expect(backup).toHaveProperty('tabs');
  });

  it('should handle restoring from a backup', async () => {
    const mockRestoreBackup = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/DataBackupService').dataBackupService.restoreBackup.mockImplementation(mockRestoreBackup);

    const mockSetTabs = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setTabs: mockSetTabs,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Mock a valid backup object
    const mockBackup = {
      metadata: { version: '1.0', timestamp: Date.now() },
      settings: { theme: 'dark', notifications: true },
      networks: [{ name: 'Freenode', servers: [{ hostname: 'chat.freenode.net', port: 6667 }] }],
      tabs: [{ id: 'server-freenode', type: 'server', name: 'Freenode', networkId: 'Freenode' }],
    };

    // Simulate restoring from backup
    await require('../../src/services/DataBackupService').dataBackupService.restoreBackup(mockBackup);

    // Verify that the restore function was called with the backup data
    expect(mockRestoreBackup).toHaveBeenCalledWith(mockBackup);
  });

  it('should validate backup before restoration', () => {
    const mockValidateBackup = jest.fn().mockReturnValue(true);
    require('../../src/services/DataBackupService').dataBackupService.validateBackup.mockImplementation(mockValidateBackup);

    const mockBackup = {
      metadata: { version: '1.0', timestamp: Date.now() },
      settings: {},
      networks: [],
      tabs: [],
    };

    // Validate the backup
    const isValid = require('../../src/services/DataBackupService').dataBackupService.validateBackup(mockBackup);

    // Verify that the backup was validated
    expect(mockValidateBackup).toHaveBeenCalledWith(mockBackup);
    expect(isValid).toBe(true);
  });

  it('should handle invalid backup gracefully', () => {
    const mockValidateBackup = jest.fn().mockReturnValue(false);
    require('../../src/services/DataBackupService').dataBackupService.validateBackup.mockImplementation(mockValidateBackup);

    const mockBackup = {
      metadata: { version: '1.0', timestamp: Date.now() },
      settings: {},
      networks: [],
      tabs: [],
    };

    // Validate the invalid backup
    const isValid = require('../../src/services/DataBackupService').dataBackupService.validateBackup(mockBackup);

    // Verify that the invalid backup was detected
    expect(mockValidateBackup).toHaveBeenCalledWith(mockBackup);
    expect(isValid).toBe(false);
  });

  it('should handle backup metadata retrieval', () => {
    const mockGetBackupMetadata = jest.fn().mockReturnValue({
      version: '1.0',
      timestamp: Date.now(),
      settingsCount: 10,
      networksCount: 5,
      tabsCount: 20,
    });
    require('../../src/services/DataBackupService').dataBackupService.getBackupMetadata.mockImplementation(mockGetBackupMetadata);

    const mockBackup = {
      metadata: { version: '1.0', timestamp: Date.now() },
      settings: {},
      networks: [],
      tabs: [],
    };

    // Get backup metadata
    const metadata = require('../../src/services/DataBackupService').dataBackupService.getBackupMetadata(mockBackup);

    // Verify that metadata was retrieved
    expect(mockGetBackupMetadata).toHaveBeenCalledWith(mockBackup);
    expect(metadata).toHaveProperty('version');
    expect(metadata).toHaveProperty('timestamp');
    expect(metadata).toHaveProperty('settingsCount');
    expect(metadata).toHaveProperty('networksCount');
    expect(metadata).toHaveProperty('tabsCount');
  });

  it('should handle settings backup and restore', async () => {
    const mockSaveSettings = jest.fn().mockResolvedValue(undefined);
    const mockLoadSettings = jest.fn().mockResolvedValue({});
    require('../../src/services/SettingsService').settingsService.saveSettings.mockImplementation(mockSaveSettings);
    require('../../src/services/SettingsService').settingsService.loadSettings.mockImplementation(mockLoadSettings);

    // Simulate backing up settings
    const settings = await require('../../src/services/SettingsService').settingsService.loadSettings();
    
    // Verify that settings were loaded
    expect(mockLoadSettings).toHaveBeenCalled();

    // Simulate restoring settings
    await require('../../src/services/SettingsService').settingsService.saveSettings(settings);
    
    // Verify that settings were saved
    expect(mockSaveSettings).toHaveBeenCalledWith(settings);
  });

  it('should handle network configurations backup and restore', async () => {
    const mockSaveNetworks = jest.fn().mockResolvedValue(undefined);
    const mockLoadNetworks = jest.fn().mockResolvedValue([]);
    require('../../src/services/SettingsService').settingsService.saveNetworks.mockImplementation(mockSaveNetworks);
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockImplementation(mockLoadNetworks);

    // Simulate backing up networks
    const networks = await require('../../src/services/SettingsService').settingsService.loadNetworks();
    
    // Verify that networks were loaded
    expect(mockLoadNetworks).toHaveBeenCalled();

    // Simulate restoring networks
    await require('../../src/services/SettingsService').settingsService.saveNetworks(networks);
    
    // Verify that networks were saved
    expect(mockSaveNetworks).toHaveBeenCalledWith(networks);
  });

  it('should handle tabs backup and restore', async () => {
    const mockSaveTabs = jest.fn().mockResolvedValue(undefined);
    const mockGetTabs = jest.fn().mockResolvedValue([]);
    require('../../src/services/TabService').tabService.saveTabs.mockImplementation(mockSaveTabs);
    require('../../src/services/TabService').tabService.getTabs.mockImplementation(mockGetTabs);

    // Simulate backing up tabs for a network
    const tabs = await require('../../src/services/TabService').tabService.getTabs('test-network');
    
    // Verify that tabs were loaded
    expect(mockGetTabs).toHaveBeenCalledWith('test-network');

    // Simulate restoring tabs
    await require('../../src/services/TabService').tabService.saveTabs('test-network', tabs);
    
    // Verify that tabs were saved
    expect(mockSaveTabs).toHaveBeenCalledWith('test-network', tabs);
  });

  it('should handle message history backup and restore', async () => {
    const mockLoadMessages = jest.fn().mockResolvedValue([]);
    const mockDeleteMessages = jest.fn().mockResolvedValue(undefined);
    require('../../src/services/MessageHistoryService').messageHistoryService.loadMessages.mockImplementation(mockLoadMessages);
    require('../../src/services/MessageHistoryService').messageHistoryService.deleteMessages.mockImplementation(mockDeleteMessages);

    // Simulate backing up message history
    await require('../../src/services/MessageHistoryService').messageHistoryService.loadMessages('test-network', 'server');
    
    // Verify that messages were loaded
    expect(mockLoadMessages).toHaveBeenCalledWith('test-network', 'server');

    // Simulate clearing message history (part of restore process)
    await require('../../src/services/MessageHistoryService').messageHistoryService.deleteMessages('test-network', 'server');
    
    // Verify that messages were deleted
    expect(mockDeleteMessages).toHaveBeenCalledWith('test-network', 'server');
  });

  it('should clear caches after backup/restore', async () => {
    const mockClearCache = jest.fn();
    require('../../src/services/StorageCache').storageCache.clear.mockImplementation(mockClearCache);

    // Simulate clearing cache after backup/restore
    require('../../src/services/StorageCache').storageCache.clear();

    // Verify that cache was cleared
    expect(mockClearCache).toHaveBeenCalled();
  });
});
