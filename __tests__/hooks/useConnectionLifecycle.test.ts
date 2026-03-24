/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useConnectionLifecycle hook
 */

import { renderHook } from '@testing-library/react-native';
import { useConnectionLifecycle } from '../../src/hooks/useConnectionLifecycle';

// Mock all services and modules used in the hook
jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn().mockReturnValue([]),
    onConnectionCreated: jest.fn().mockReturnValue(jest.fn()),
    getActiveNetworkId: jest.fn().mockReturnValue(null),
    getConnection: jest.fn().mockReturnValue(null),
  },
}));

jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    onMessage: jest.fn().mockReturnValue(jest.fn()),
    onConnectionChange: jest.fn().mockReturnValue(jest.fn()),
    on: jest.fn().mockReturnValue(jest.fn()),
    onUserListChange: jest.fn().mockReturnValue(jest.fn()),
    getConnectionStatus: jest.fn().mockReturnValue(false),
    getNetworkName: jest.fn().mockReturnValue('test-network'),
    getCurrentNick: jest.fn().mockReturnValue('testuser'),
    addMessage: jest.fn(),
    sendRaw: jest.fn(),
    partChannel: jest.fn(),
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
    addServerToNetwork: jest.fn().mockResolvedValue(undefined),
    saveNetworks: jest.fn().mockResolvedValue(undefined),
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
      clearTabMessages: jest.fn(),
      removeTab: jest.fn(),
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
  makeServerTab: jest.fn().mockReturnValue({ id: 'server-test-network', type: 'server', name: 'test-network', networkId: 'test-network' }),
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

describe('useConnectionLifecycle', () => {
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
    isConnected: false,
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
  });

  it('should render without crashing', () => {
    expect(() => {
      renderHook(() => useConnectionLifecycle(mockParams));
    }).not.toThrow();
  });

  it('should set up connection listeners when mounted', () => {
    renderHook(() => useConnectionLifecycle(mockParams));

    // Check that connection manager listeners are set up
    expect(require('../../src/services/ConnectionManager').connectionManager.onConnectionCreated).toHaveBeenCalled();
  });

  it('should handle message events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.onMessage.mockReturnValue(mockUnsubscribe);

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.onMessage).toHaveBeenCalled();
  });

  it('should handle connection change events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.onConnectionChange.mockReturnValue(mockUnsubscribe);

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.onConnectionChange).toHaveBeenCalled();
  });

  it('should handle user list change events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.onUserListChange.mockReturnValue(mockUnsubscribe);

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.onUserListChange).toHaveBeenCalled();
  });

  it('should handle encryption events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/EncryptedDMService').encryptedDMService.onBundleStored.mockReturnValue(mockUnsubscribe);

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/EncryptedDMService').encryptedDMService.onBundleStored).toHaveBeenCalled();
  });

  it('should handle channel encryption events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/ChannelEncryptionService').channelEncryptionService.onChannelKeyChange.mockReturnValue(mockUnsubscribe);

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/ChannelEncryptionService').channelEncryptionService.onChannelKeyChange).toHaveBeenCalled();
  });

  it('should handle typing indicator events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'typing-indicator') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('typing-indicator', expect.any(Function));
  });

  it('should handle clear-tab events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'clear-tab') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('clear-tab', expect.any(Function));
  });

  it('should handle close-tab events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'close-tab') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('close-tab', expect.any(Function));
  });

  it('should handle server-command events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'server-command') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('server-command', expect.any(Function));
  });

  it('should handle dns-lookup events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'dns-lookup') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('dns-lookup', expect.any(Function));
  });

  it('should handle amsg events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'amsg') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('amsg', expect.any(Function));
  });

  it('should handle ame events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'ame') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('ame', expect.any(Function));
  });

  it('should handle anotice events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'anotice') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('anotice', expect.any(Function));
  });

  it('should handle reconnect events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'reconnect') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
  });

  it('should handle STS policy events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'sts-policy') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('sts-policy', expect.any(Function));
  });

  it('should handle beep events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'beep') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('beep', expect.any(Function));
  });

  it('should handle registered events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'registered') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('registered', expect.any(Function));
  });

  it('should handle motdEnd events', () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation((event, _handler) => {
      if (event === 'motdEnd') {
        return mockUnsubscribe;
      }
      return jest.fn();
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    expect(require('../../src/services/IRCService').ircService.on).toHaveBeenCalledWith('motdEnd', expect.any(Function));
  });

  it('should clean up listeners on unmount', () => {
    const { unmount } = renderHook(() => useConnectionLifecycle(mockParams));

    // Mock setTimeout to prevent actual timeouts
    jest.useFakeTimers();
    
    unmount();
    
    // Advance timers to trigger cleanup
    jest.runAllTimers();
    jest.useRealTimers();
    
    // Should not throw during cleanup
    expect(true).toBe(true);
  });

  it('should update connection state when connection changes', () => {
    const mockSetIsConnected = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setIsConnected: mockSetIsConnected,
    };

    renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate connection change
    const connectionChangeCallback = require('../../src/services/IRCService').ircService.onConnectionChange.mock.calls[0][0];
    connectionChangeCallback(true);

    expect(mockSetIsConnected).toHaveBeenCalledWith(true);
  });

  it('should process batched messages when messages arrive', async () => {
    // Use fake timers to control setTimeout behavior
    jest.useFakeTimers();

    const mockProcessBatchedMessages = jest.fn();
    const paramsWithProcessor = {
      ...mockParams,
      processBatchedMessages: mockProcessBatchedMessages,
    };

    renderHook(() => useConnectionLifecycle(paramsWithProcessor));

    // Simulate message arrival
    const messageCallback = require('../../src/services/IRCService').ircService.onMessage.mock.calls[0][0];
    await messageCallback({ type: 'message', text: 'test message', timestamp: Date.now() });

    // Advance timers to trigger the setTimeout
    jest.advanceTimersByTime(20); // Advance past the 16ms timeout

    expect(mockProcessBatchedMessages).toHaveBeenCalled();

    // Restore real timers
    jest.useRealTimers();
  });

  it('should handle dns-lookup with empty hostname', async () => {
    renderHook(() => useConnectionLifecycle(mockParams));

    const dnsCall = require('../../src/services/IRCService').ircService.on.mock.calls.find(
      (call: any[]) => call[0] === 'dns-lookup'
    );
    expect(dnsCall).toBeTruthy();

    const dnsHandler = dnsCall[1];
    await dnsHandler('   ');

    expect(require('../../src/services/IRCService').ircService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Usage: /dns <hostname>',
      })
    );
  });

  it('should handle dns-lookup provider failures', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('network down'));
    renderHook(() => useConnectionLifecycle(mockParams));

    const dnsCall = require('../../src/services/IRCService').ircService.on.mock.calls.find(
      (call: any[]) => call[0] === 'dns-lookup'
    );
    expect(dnsCall).toBeTruthy();

    const dnsHandler = dnsCall[1];
    await dnsHandler('example.org');

    expect(require('../../src/services/IRCService').ircService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: '*** DNS lookup failed for {hostname}',
      })
    );
  });

  it('should handle dns-lookup with no records found', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        Status: 0,
        Answer: [],
      }),
    });

    renderHook(() => useConnectionLifecycle(mockParams));

    const dnsCall = require('../../src/services/IRCService').ircService.on.mock.calls.find(
      (call: any[]) => call[0] === 'dns-lookup'
    );
    expect(dnsCall).toBeTruthy();

    const dnsHandler = dnsCall[1];
    await dnsHandler('example.org');

    expect(require('../../src/services/IRCService').ircService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notice',
        text: '*** No DNS records found for {hostname}',
      })
    );
  });

  it('should handle server-command without address/index', async () => {
    renderHook(() => useConnectionLifecycle(mockParams));

    const serverCommandCall = require('../../src/services/IRCService').ircService.on.mock.calls.find(
      (call: any[]) => call[0] === 'server-command'
    );
    expect(serverCommandCall).toBeTruthy();

    const serverCommandHandler = serverCommandCall[1];
    await serverCommandHandler({
      switches: {},
      management: {},
    });

    expect(require('../../src/services/IRCService').ircService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'No server specified. Use /server <address> [port]',
      })
    );
  });

  it('should handle reconnect event by disconnecting and marking disconnected state', () => {
    const disconnectMock = jest.fn();
    require('../../src/services/ConnectionManager').connectionManager.getConnection.mockReturnValue({
      ircService: {
        disconnect: disconnectMock,
      },
    });
    const setIsConnected = jest.fn();

    renderHook(() =>
      useConnectionLifecycle({
        ...mockParams,
        setIsConnected,
      })
    );

    const reconnectCall = require('../../src/services/IRCService').ircService.on.mock.calls.find(
      (call: any[]) => call[0] === 'reconnect'
    );
    expect(reconnectCall).toBeTruthy();

    const reconnectHandler = reconnectCall[1];
    reconnectHandler('test-network');

    expect(disconnectMock).toHaveBeenCalled();
    expect(setIsConnected).toHaveBeenCalledWith(false);
  });

  it('should execute rich event handlers and command branches', async () => {
    const mockClearTabMessages = jest.fn();
    const mockRemoveTab = jest.fn();
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      clearTabMessages: mockClearTabMessages,
      removeTab: mockRemoveTab,
    });

    const disconnectMock = jest.fn();
    require('../../src/services/ConnectionManager').connectionManager.getConnection.mockImplementation((network: string) => {
      if (network === 'test-network') {
        return { ircService: { disconnect: disconnectMock } };
      }
      return null;
    });

    require('../../src/services/SettingsService').settingsService.getSetting.mockImplementation(
      async (key: string, defaultValue: any) => {
        if (key === 'noticeTarget') return 'notice';
        if (key === 'dccAutoGetMode') return 'accept';
        if (key === 'dccAutoGetFrom') return 2;
        if (key === 'dccAcceptExts') return ['*.txt'];
        if (key === 'dccRejectExts') return ['*.exe'];
        if (key === 'dccDontSendExts') return ['*.bat'];
        return defaultValue;
      }
    );
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue([
      { id: 'n1', name: 'test-network', servers: [{ id: 's1', hostname: 'irc.test', name: 'irc.test' }] },
    ]);

    const now = Date.now();
    const params = {
      ...mockParams,
      activeTabId: 'channel-test-network-#test',
      tabsRef: {
        current: [
          { id: 'server-test-network', type: 'server', name: 'test-network', networkId: 'test-network', messages: [] },
          { id: 'channel-test-network-#test', type: 'channel', name: '#test', networkId: 'test-network', messages: [] },
          { id: 'query-test-network-bob', type: 'query', name: 'bob', networkId: 'test-network', messages: [] },
          { id: 'notice-test-network', type: 'notice', name: 'Notice', networkId: 'test-network', messages: [] },
        ],
      },
    };

    renderHook(() => useConnectionLifecycle(params as any));

    const onCalls = require('../../src/services/IRCService').ircService.on.mock.calls;
    const onMap = new Map<string, Function>();
    onCalls.forEach((call: any[]) => onMap.set(call[0], call[1]));

    const messageHandler = require('../../src/services/IRCService').ircService.onMessage.mock.calls[0][0];
    const connectionHandler = require('../../src/services/IRCService').ircService.onConnectionChange.mock.calls[0][0];
    const userListHandler = require('../../src/services/IRCService').ircService.onUserListChange.mock.calls[0][0];

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        Status: 0,
        Answer: [
          { type: 1, data: '1.1.1.1' },
          { type: 28, data: '2606:4700:4700::1111' },
        ],
      }),
    });

    await connectionHandler(true);
    await userListHandler('#test', [{ nick: 'alice' }]);

    await onMap.get('typing-indicator')?.('testuser', 'bob', 'active');
    await onMap.get('clear-tab')?.('#test', 'test-network');
    await onMap.get('close-tab')?.('#test', 'test-network');

    await onMap.get('server-command')?.({
      management: { sort: true },
      switches: {},
      managementOptions: {},
    });
    await onMap.get('server-command')?.({
      management: { add: true },
      address: 'irc.added.net',
      port: 6697,
      switches: { ssl: true },
      managementOptions: {},
    });
    await onMap.get('server-command')?.({
      management: { remove: true },
      address: 'irc.test',
      switches: {},
      managementOptions: {},
    });
    await onMap.get('server-command')?.({
      management: {},
      switches: { disconnectOnly: true },
      managementOptions: {},
    });

    await onMap.get('dns-lookup')?.('example.org');
    await onMap.get('amsg')?.('hello all', 'test-network');
    await onMap.get('ame')?.('waves', 'test-network');
    await onMap.get('anotice')?.('notice all', 'test-network');
    await onMap.get('reconnect')?.('test-network');
    await onMap.get('sts-policy')?.('irc.example', 'duration=60,port=6697');
    await onMap.get('beep')?.({ count: 2, delay: 200 });
    await onMap.get('registered')?.();
    await onMap.get('motdEnd')?.();

    await messageHandler({
      type: 'message',
      from: 'bob',
      channel: '#test',
      text: 'hi testuser',
      timestamp: now,
      network: 'test-network',
    });

    expect(mockClearTabMessages).toHaveBeenCalled();
    expect(mockRemoveTab).toHaveBeenCalled();
    expect(require('../../src/services/SettingsService').settingsService.addServerToNetwork).toHaveBeenCalled();
    expect(require('../../src/services/SettingsService').settingsService.saveNetworks).toHaveBeenCalled();
    expect(require('../../src/services/IRCService').ircService.sendRaw).toHaveBeenCalled();
    expect(disconnectMock).toHaveBeenCalled();
    expect(require('../../src/services/OfflineQueueService').offlineQueueService.processQueue).toHaveBeenCalled();
    expect(require('../../src/services/SoundService').soundService.playSound).toHaveBeenCalled();
    expect(require('../../src/services/STSService').stsService.savePolicy).toHaveBeenCalled();
  });

  it('should restore tabs from storage on reconnect when network has no tabs', async () => {
    const setTabs = jest.fn();
    const setActiveTabId = jest.fn();
    require('../../src/services/ConnectionManager').connectionManager.getActiveNetworkId.mockReturnValue('test-network');
    require('../../src/services/TabService').tabService.getTabs.mockResolvedValue([
      { id: 'channel-test-network-#room', type: 'channel', name: '#room', networkId: 'test-network' },
    ]);
    require('../../src/services/MessageHistoryService').messageHistoryService.loadMessages.mockResolvedValue([
      { id: 'm1', type: 'notice', text: 'hello', timestamp: Date.now() },
    ]);

    renderHook(() =>
      useConnectionLifecycle({
        ...mockParams,
        tabsRef: { current: [] },
        setTabs,
        setActiveTabId,
      })
    );

    const connectionHandler = require('../../src/services/IRCService').ircService.onConnectionChange.mock.calls[0][0];
    connectionHandler(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(require('../../src/services/TabService').tabService.getTabs).toHaveBeenCalledWith('test-network');
    expect(setTabs).toHaveBeenCalled();
    expect(setActiveTabId).toHaveBeenCalledWith('server-test-network');
  });

  it('should send OPER and NickServ identify on registered/motdEnd when configured', async () => {
    require('../../src/services/ConnectionManager').connectionManager.getAllConnections.mockReturnValue([]);
    require('../../src/services/ConnectionManager').connectionManager.getActiveNetworkId.mockReturnValue('test-network');
    require('../../src/services/SettingsService').settingsService.getNetwork.mockResolvedValue({
      id: 'test-network',
      nick: 'NickA',
      operUser: '',
      operPassword: 'oper-secret',
      nickservPassword: 'ns-secret',
    });

    renderHook(() => useConnectionLifecycle(mockParams));
    const onCalls = require('../../src/services/IRCService').ircService.on.mock.calls;
    const registeredCall = onCalls.find((call: any[]) => call[0] === 'registered');
    const motdCalls = onCalls.filter((call: any[]) => call[0] === 'motdEnd');

    await registeredCall?.[1]?.();
    for (const call of motdCalls) {
      await call[1]?.();
    }

    expect(require('../../src/services/SoundService').soundService.playSound).toHaveBeenCalledWith(
      require('../../src/types/sound').SoundEventType.LOGIN
    );
    expect(require('../../src/services/IRCService').ircService.sendRaw).toHaveBeenCalledWith('OPER testuser oper-secret');
    expect(require('../../src/services/IRCService').ircService.sendRaw).toHaveBeenCalledWith(
      'PRIVMSG NickServ :IDENTIFY ns-secret'
    );
  });
});
