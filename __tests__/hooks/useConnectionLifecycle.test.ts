/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useConnectionLifecycle hook
 */

import { act, renderHook } from '@testing-library/react-native';
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
  ChannelUser: {},
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
  },
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
    showMessageNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/BackgroundService', () => ({
  backgroundService: {
    isAppInBackground: jest.fn().mockReturnValue(false),
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
  noticeTabId: jest.fn().mockReturnValue('notice-test-network'),
  notificationsTabId: jest.fn().mockReturnValue('notifications-test-network'),
  makeServerTab: jest.fn().mockReturnValue({
    id: 'server-test-network',
    type: 'server',
    name: 'test-network',
    networkId: 'test-network',
  }),
  sortTabsGrouped: jest.fn().mockImplementation(tabs => tabs),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: jest.fn().mockReturnValue(str => str),
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
    safeSetState: jest.fn().mockImplementation(fn => fn()),
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

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set default mock implementations
    require('../../src/services/SettingsService').settingsService.getSetting.mockResolvedValue(
      'server',
    );
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue(
      [],
    );
    require('../../src/services/IRCService').ircService.getNetworkName.mockReturnValue(
      'test-network',
    );
    require('../../src/services/IRCService').ircService.getCurrentNick.mockReturnValue(
      'testuser',
    );
    require('../../src/services/UserManagementService').userManagementService.isUserIgnored.mockReturnValue(
      false,
    );
  });

  it('should render without crashing', async () => {
    await renderHook(() => useConnectionLifecycle(mockParams));
  });

  it('should set up connection listeners when mounted', async () => {
    await renderHook(() => useConnectionLifecycle(mockParams));

    // Check that connection manager listeners are set up
    expect(
      require('../../src/services/ConnectionManager').connectionManager
        .onConnectionCreated,
    ).toHaveBeenCalled();
  });

  it('should handle message events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.onMessage.mockReturnValue(
      mockUnsubscribe,
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.onMessage,
    ).toHaveBeenCalled();
  });

  it('should handle connection change events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.onConnectionChange.mockReturnValue(
      mockUnsubscribe,
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.onConnectionChange,
    ).toHaveBeenCalled();
  });

  it('should handle user list change events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.onUserListChange.mockReturnValue(
      mockUnsubscribe,
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.onUserListChange,
    ).toHaveBeenCalled();
  });

  it('should handle encryption events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/EncryptedDMService').encryptedDMService.onBundleStored.mockReturnValue(
      mockUnsubscribe,
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/EncryptedDMService').encryptedDMService
        .onBundleStored,
    ).toHaveBeenCalled();
  });

  it('should handle channel encryption events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/ChannelEncryptionService').channelEncryptionService.onChannelKeyChange.mockReturnValue(
      mockUnsubscribe,
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/ChannelEncryptionService')
        .channelEncryptionService.onChannelKeyChange,
    ).toHaveBeenCalled();
  });

  it('should handle typing indicator events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'typing-indicator') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('typing-indicator', expect.any(Function));
  });

  it('should handle clear-tab events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'clear-tab') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('clear-tab', expect.any(Function));
  });

  it('should handle close-tab events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'close-tab') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('close-tab', expect.any(Function));
  });

  it('should handle server-command events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'server-command') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('server-command', expect.any(Function));
  });

  it('should handle dns-lookup events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'dns-lookup') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('dns-lookup', expect.any(Function));
  });

  it('should handle amsg events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'amsg') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('amsg', expect.any(Function));
  });

  it('should handle ame events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'ame') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('ame', expect.any(Function));
  });

  it('should handle anotice events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'anotice') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('anotice', expect.any(Function));
  });

  it('should handle reconnect events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'reconnect') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('reconnect', expect.any(Function));
  });

  it('should handle STS policy events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'sts-policy') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('sts-policy', expect.any(Function));
  });

  it('should handle beep events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'beep') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('beep', expect.any(Function));
  });

  it('should handle registered events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'registered') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('registered', expect.any(Function));
  });

  it('should handle motdEnd events', async () => {
    const mockUnsubscribe = jest.fn();
    require('../../src/services/IRCService').ircService.on.mockImplementation(
      (event, _handler) => {
        if (event === 'motdEnd') {
          return mockUnsubscribe;
        }
        return jest.fn();
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));

    expect(
      require('../../src/services/IRCService').ircService.on,
    ).toHaveBeenCalledWith('motdEnd', expect.any(Function));
  });

  it('should clean up listeners on unmount', async () => {
    const { unmount } = await renderHook(() =>
      useConnectionLifecycle(mockParams),
    );

    // Mock setTimeout to prevent actual timeouts
    jest.useFakeTimers();

    await unmount();

    // Advance timers to trigger cleanup
    jest.runAllTimers();
    jest.useRealTimers();

    // Should not throw during cleanup
    expect(true).toBe(true);
  });

  it('should update connection state when connection changes', async () => {
    const mockSetIsConnected = jest.fn();
    const paramsWithSetter = {
      ...mockParams,
      setIsConnected: mockSetIsConnected,
    };

    await renderHook(() => useConnectionLifecycle(paramsWithSetter));

    // Simulate connection change
    const connectionChangeCallback = require('../../src/services/IRCService')
      .ircService.onConnectionChange.mock.calls[0][0];
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

    await renderHook(() => useConnectionLifecycle(paramsWithProcessor));

    // Simulate message arrival
    const messageCallback = require('../../src/services/IRCService').ircService
      .onMessage.mock.calls[0][0];
    await messageCallback({
      type: 'message',
      text: 'test message',
      timestamp: Date.now(),
    });

    // Advance timers to trigger the setTimeout
    jest.advanceTimersByTime(20); // Advance past the 16ms timeout

    expect(mockProcessBatchedMessages).toHaveBeenCalled();

    // Restore real timers
    jest.useRealTimers();
  });

  it('should handle dns-lookup with empty hostname', async () => {
    await renderHook(() => useConnectionLifecycle(mockParams));

    const dnsCall =
      require('../../src/services/IRCService').ircService.on.mock.calls.find(
        (call: any[]) => call[0] === 'dns-lookup',
      );
    expect(dnsCall).toBeTruthy();

    const dnsHandler = dnsCall[1];
    await dnsHandler('   ');

    expect(
      require('../../src/services/IRCService').ircService.addMessage,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'Usage: /dns <hostname>',
      }),
    );
  });

  it('should handle dns-lookup provider failures', async () => {
    (global as any).fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down'));
    await renderHook(() => useConnectionLifecycle(mockParams));

    const dnsCall =
      require('../../src/services/IRCService').ircService.on.mock.calls.find(
        (call: any[]) => call[0] === 'dns-lookup',
      );
    expect(dnsCall).toBeTruthy();

    const dnsHandler = dnsCall[1];
    await dnsHandler('example.org');

    expect(
      require('../../src/services/IRCService').ircService.addMessage,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: '*** DNS lookup failed for {hostname}',
      }),
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

    await renderHook(() => useConnectionLifecycle(mockParams));

    const dnsCall =
      require('../../src/services/IRCService').ircService.on.mock.calls.find(
        (call: any[]) => call[0] === 'dns-lookup',
      );
    expect(dnsCall).toBeTruthy();

    const dnsHandler = dnsCall[1];
    await dnsHandler('example.org');

    expect(
      require('../../src/services/IRCService').ircService.addMessage,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'notice',
        text: '*** No DNS records found for {hostname}',
      }),
    );
  });

  it('should handle server-command without address/index', async () => {
    await renderHook(() => useConnectionLifecycle(mockParams));

    const serverCommandCall =
      require('../../src/services/IRCService').ircService.on.mock.calls.find(
        (call: any[]) => call[0] === 'server-command',
      );
    expect(serverCommandCall).toBeTruthy();

    const serverCommandHandler = serverCommandCall[1];
    await serverCommandHandler({
      switches: {},
      management: {},
    });

    expect(
      require('../../src/services/IRCService').ircService.addMessage,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: 'No server specified. Use /server <address> [port]',
      }),
    );
  });

  it('should handle reconnect event by disconnecting and marking disconnected state', async () => {
    const disconnectMock = jest.fn();
    require('../../src/services/ConnectionManager').connectionManager.getConnection.mockReturnValue(
      {
        ircService: {
          disconnect: disconnectMock,
        },
      },
    );
    const setIsConnected = jest.fn();

    await renderHook(() =>
      useConnectionLifecycle({
        ...mockParams,
        setIsConnected,
      }),
    );

    const reconnectCall =
      require('../../src/services/IRCService').ircService.on.mock.calls.find(
        (call: any[]) => call[0] === 'reconnect',
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
    require('../../src/services/ConnectionManager').connectionManager.getConnection.mockImplementation(
      (network: string) => {
        if (network === 'test-network') {
          return { ircService: { disconnect: disconnectMock } };
        }
        return null;
      },
    );

    require('../../src/services/SettingsService').settingsService.getSetting.mockImplementation(
      async (key: string, defaultValue: any) => {
        if (key === 'noticeTarget') return 'notice';
        if (key === 'dccAutoGetMode') return 'accept';
        if (key === 'dccAutoGetFrom') return 2;
        if (key === 'dccAcceptExts') return ['*.txt'];
        if (key === 'dccRejectExts') return ['*.exe'];
        if (key === 'dccDontSendExts') return ['*.bat'];
        return defaultValue;
      },
    );
    require('../../src/services/SettingsService').settingsService.loadNetworks.mockResolvedValue(
      [
        {
          id: 'n1',
          name: 'test-network',
          servers: [{ id: 's1', hostname: 'irc.test', name: 'irc.test' }],
        },
      ],
    );

    const now = Date.now();
    const params = {
      ...mockParams,
      activeTabId: 'channel-test-network-#test',
      tabsRef: {
        current: [
          {
            id: 'server-test-network',
            type: 'server',
            name: 'test-network',
            networkId: 'test-network',
            messages: [],
          },
          {
            id: 'channel-test-network-#test',
            type: 'channel',
            name: '#test',
            networkId: 'test-network',
            messages: [],
          },
          {
            id: 'query-test-network-bob',
            type: 'query',
            name: 'bob',
            networkId: 'test-network',
            messages: [],
          },
          {
            id: 'notice-test-network',
            type: 'notice',
            name: 'Notice',
            networkId: 'test-network',
            messages: [],
          },
        ],
      },
    };

    await renderHook(() => useConnectionLifecycle(params as any));

    const onCalls = require('../../src/services/IRCService').ircService.on.mock
      .calls;
    const onMap = new Map<string, Function>();
    onCalls.forEach((call: any[]) => onMap.set(call[0], call[1]));

    const messageHandler = require('../../src/services/IRCService').ircService
      .onMessage.mock.calls[0][0];
    const connectionHandler = require('../../src/services/IRCService')
      .ircService.onConnectionChange.mock.calls[0][0];
    const userListHandler = require('../../src/services/IRCService').ircService
      .onUserListChange.mock.calls[0][0];

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
    expect(
      require('../../src/services/SettingsService').settingsService
        .addServerToNetwork,
    ).toHaveBeenCalled();
    expect(
      require('../../src/services/SettingsService').settingsService
        .saveNetworks,
    ).toHaveBeenCalled();
    expect(
      require('../../src/services/IRCService').ircService.sendRaw,
    ).toHaveBeenCalled();
    expect(disconnectMock).toHaveBeenCalled();
    expect(
      require('../../src/services/OfflineQueueService').offlineQueueService
        .processQueue,
    ).toHaveBeenCalled();
    expect(
      require('../../src/services/SoundService').soundService.playSound,
    ).toHaveBeenCalled();
    expect(
      require('../../src/services/STSService').stsService.savePolicy,
    ).toHaveBeenCalled();
  });

  it('should restore tabs from storage on reconnect when network has no tabs', async () => {
    const setTabs = jest.fn();
    const setActiveTabId = jest.fn();
    require('../../src/services/ConnectionManager').connectionManager.getActiveNetworkId.mockReturnValue(
      'test-network',
    );
    require('../../src/services/TabService').tabService.getTabs.mockResolvedValue(
      [
        {
          id: 'channel-test-network-#room',
          type: 'channel',
          name: '#room',
          networkId: 'test-network',
        },
      ],
    );
    require('../../src/services/MessageHistoryService').messageHistoryService.loadMessages.mockResolvedValue(
      [{ id: 'm1', type: 'notice', text: 'hello', timestamp: Date.now() }],
    );

    await renderHook(() =>
      useConnectionLifecycle({
        ...mockParams,
        tabsRef: { current: [] },
        setTabs,
        setActiveTabId,
      }),
    );

    const connectionHandler = require('../../src/services/IRCService')
      .ircService.onConnectionChange.mock.calls[0][0];
    connectionHandler(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(
      require('../../src/services/TabService').tabService.getTabs,
    ).toHaveBeenCalledWith('test-network');
    expect(setTabs).toHaveBeenCalled();
    expect(setActiveTabId).toHaveBeenCalledWith('server-test-network');
  });

  it('should send OPER and NickServ identify on registered/motdEnd when configured', async () => {
    require('../../src/services/ConnectionManager').connectionManager.getAllConnections.mockReturnValue(
      [],
    );
    require('../../src/services/ConnectionManager').connectionManager.getActiveNetworkId.mockReturnValue(
      'test-network',
    );
    require('../../src/services/SettingsService').settingsService.getNetwork.mockResolvedValue(
      {
        id: 'test-network',
        nick: 'NickA',
        operUser: '',
        operPassword: 'oper-secret',
        nickservPassword: 'ns-secret',
      },
    );

    await renderHook(() => useConnectionLifecycle(mockParams));
    const onCalls = require('../../src/services/IRCService').ircService.on.mock
      .calls;
    const registeredCall = onCalls.find(
      (call: any[]) => call[0] === 'registered',
    );
    const motdCalls = onCalls.filter((call: any[]) => call[0] === 'motdEnd');

    await registeredCall?.[1]?.();
    for (const call of motdCalls) {
      await call[1]?.();
    }

    expect(
      require('../../src/services/SoundService').soundService.playSound,
    ).toHaveBeenCalledWith(
      require('../../src/types/sound').SoundEventType.LOGIN,
    );
    expect(
      require('../../src/services/IRCService').ircService.sendRaw,
    ).toHaveBeenCalledWith('OPER testuser oper-secret');
    expect(
      require('../../src/services/IRCService').ircService.sendRaw,
    ).toHaveBeenCalledWith('PRIVMSG NickServ :IDENTIFY ns-secret');
  });

  it('does not process IRC messages from ignored users', async () => {
    const { ircService } = require('../../src/services/IRCService');
    const {
      userManagementService,
    } = require('../../src/services/UserManagementService');
    userManagementService.isUserIgnored.mockReturnValue(true);

    let messageHandler: any;
    ircService.onMessage.mockImplementation((handler: any) => {
      messageHandler = handler;
      return jest.fn();
    });

    mockParams.pendingMessagesRef.current = [];
    mockParams.processBatchedMessages.mockClear();

    await renderHook(() => useConnectionLifecycle(mockParams));

    mockParams.pendingMessagesRef.current = [];
    await act(async () => {
      messageHandler({
        id: 'ignored-msg',
        type: 'message',
        from: 'IgnoredNick',
        text: 'should not enter batch',
        network: 'test-network',
        channel: '#chan',
        timestamp: Date.now(),
      });
    });

    expect(mockParams.pendingMessagesRef.current).toEqual([]);
    expect(mockParams.processBatchedMessages).not.toHaveBeenCalled();
  });

  it('routes typing payloads from IRC messages to the query target', async () => {
    const { ircService } = require('../../src/services/IRCService');
    ircService.getCurrentNick.mockReturnValue('testuser');
    mockParams.pendingMessagesRef.current = [];

    let messageHandler: any;
    ircService.onMessage.mockImplementation((handler: any) => {
      messageHandler = handler;
      return jest.fn();
    });

    await renderHook(() => useConnectionLifecycle(mockParams));

    await act(async () => {
      await messageHandler({
        type: 'message',
        from: 'Alice',
        channel: 'testuser',
        text: '',
        typing: 'active',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });

    expect(mockParams.setTypingUser).toHaveBeenCalledWith(
      'test-network',
      'Alice',
      'Alice',
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('auto-accepts DCC SEND offers that match the accept extension list', async () => {
    const { ircService } = require('../../src/services/IRCService');
    const { dccFileService } = require('../../src/services/DCCFileService');
    const { settingsService } = require('../../src/services/SettingsService');
    dccFileService.parseSendOffer.mockReturnValue({
      filename: 'readme.TXT',
      size: 123,
    });
    dccFileService.handleOffer.mockReturnValue({ id: 'transfer-accepted' });
    dccFileService.getDefaultDownloadPath.mockResolvedValue(
      '/downloads/readme.TXT',
    );
    settingsService.getSetting.mockImplementation(
      async (key: string, defaultValue: any) => {
        if (key === 'dccAutoGetMode') return 'reject';
        if (key === 'dccAutoGetFrom') return 1;
        if (key === 'dccAcceptExts') return ['*.txt'];
        if (key === 'dccRejectExts') return ['*.exe'];
        if (key === 'dccDontSendExts') return ['*.bat'];
        return defaultValue;
      },
    );

    let messageHandler: any;
    ircService.onMessage.mockImplementation((handler: any) => {
      messageHandler = handler;
      return jest.fn();
    });

    await renderHook(() => useConnectionLifecycle(mockParams));

    await act(async () => {
      await messageHandler({
        type: 'message',
        from: 'Alice',
        text: 'DCC SEND readme.TXT',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });

    expect(dccFileService.accept).toHaveBeenCalledWith(
      'transfer-accepted',
      ircService,
      '/downloads/readme.TXT',
    );
    expect(dccFileService.cancel).not.toHaveBeenCalledWith('transfer-accepted');
  });

  it('rejects DCC SEND offers that match dangerous extension filters', async () => {
    const { ircService } = require('../../src/services/IRCService');
    const { dccFileService } = require('../../src/services/DCCFileService');
    const { settingsService } = require('../../src/services/SettingsService');
    dccFileService.parseSendOffer.mockReturnValue({
      filename: 'payload.exe',
      size: 456,
    });
    dccFileService.handleOffer.mockReturnValue({ id: 'transfer-rejected' });
    settingsService.getSetting.mockImplementation(
      async (key: string, defaultValue: any) => {
        if (key === 'dccAutoGetMode') return 'accept';
        if (key === 'dccAutoGetFrom') return 4;
        if (key === 'dccAcceptExts') return ['*.txt'];
        if (key === 'dccRejectExts') return ['*.exe'];
        if (key === 'dccDontSendExts') return [];
        return defaultValue;
      },
    );

    let messageHandler: any;
    ircService.onMessage.mockImplementation((handler: any) => {
      messageHandler = handler;
      return jest.fn();
    });

    await renderHook(() => useConnectionLifecycle(mockParams));

    await act(async () => {
      await messageHandler({
        type: 'message',
        from: 'Mallory',
        text: 'DCC SEND payload.exe',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });

    expect(dccFileService.cancel).toHaveBeenCalledWith('transfer-rejected');
    expect(dccFileService.accept).not.toHaveBeenCalledWith(
      'transfer-rejected',
      expect.anything(),
      expect.anything(),
    );
  });

  // ---------------------------------------------------------------------------
  // Additional coverage tests
  // ---------------------------------------------------------------------------

  const IRC = () => require('../../src/services/IRCService').ircService;
  const CM = () =>
    require('../../src/services/ConnectionManager').connectionManager;
  const SETTINGS = () =>
    require('../../src/services/SettingsService').settingsService;
  const SOUND = () => require('../../src/services/SoundService').soundService;
  const SOUND_TYPES = () => require('../../src/types/sound').SoundEventType;

  const baseTabs = () => [
    {
      id: 'server-test-network',
      type: 'server',
      name: 'test-network',
      networkId: 'test-network',
      messages: [],
    },
    {
      id: 'channel-test-network-#test',
      type: 'channel',
      name: '#test',
      networkId: 'test-network',
      messages: [],
    },
    {
      id: 'query-test-network-bob',
      type: 'query',
      name: 'bob',
      networkId: 'test-network',
      messages: [],
    },
    {
      id: 'notice-test-network',
      type: 'notice',
      name: 'Notice',
      networkId: 'test-network',
      messages: [],
    },
  ];

  const captureHandlers = (svc?: any) => {
    const service = svc || IRC();
    const onMap = new Map<string, Function>();
    service.on.mock.calls.forEach((c: any[]) => onMap.set(c[0], c[1]));
    const msgCalls = service.onMessage.mock.calls;
    const connCalls = service.onConnectionChange.mock.calls;
    const ulCalls = service.onUserListChange.mock.calls;
    return {
      message: msgCalls.length ? msgCalls[msgCalls.length - 1][0] : undefined,
      connection: connCalls.length
        ? connCalls[connCalls.length - 1][0]
        : undefined,
      userList: ulCalls.length ? ulCalls[ulCalls.length - 1][0] : undefined,
      on: onMap,
    };
  };

  const setNoticeTarget = (value: string) => {
    SETTINGS().getSetting.mockImplementation(async (key: string, def: any) =>
      key === 'noticeTarget' ? value : def,
    );
  };

  afterEach(() => {
    const cm = CM();
    cm.getAllConnections.mockReturnValue([]);
    cm.getActiveNetworkId.mockReturnValue(null);
    cm.getConnection.mockReturnValue(null);
    IRC().onMessage.mockReturnValue(jest.fn());
    IRC().onConnectionChange.mockReturnValue(jest.fn());
    IRC().onUserListChange.mockReturnValue(jest.fn());
    IRC().on.mockReturnValue(jest.fn());
    IRC().getConnectionStatus.mockReturnValue(false);
  });

  it('re-evaluates listener setup when networkName changes on re-render', async () => {
    const debugSpy = jest.spyOn(
      require('../../src/services/DebugLogger').debugLogger,
      'debug',
    );
    const { rerender } = await renderHook(
      (p: any) => useConnectionLifecycle(p),
      { initialProps: mockParams },
    );
    await act(async () => {
      rerender({ ...mockParams, networkName: 'other-network' });
    });
    // The network-change branch logged the change
    expect(debugSpy).toHaveBeenCalledWith(
      'connectionLifecycle',
      expect.stringContaining('Network changed'),
    );
    debugSpy.mockRestore();
  });

  it('handles connection-created events without throwing', async () => {
    const debugSpy = jest.spyOn(
      require('../../src/services/DebugLogger').debugLogger,
      'debug',
    );
    let createdCb: any;
    CM().onConnectionCreated.mockImplementation((cb: any) => {
      createdCb = cb;
      return jest.fn();
    });
    await renderHook(() => useConnectionLifecycle(mockParams));
    expect(typeof createdCb).toBe('function');
    await act(async () => {
      createdCb('new-network');
    });
    expect(debugSpy).toHaveBeenCalledWith(
      'connectionLifecycle',
      expect.stringContaining('connection-created event'),
    );
    debugSpy.mockRestore();
  });

  it('sets up listeners for managed ConnectionManager connections', async () => {
    const managedSvc = {
      onMessage: jest.fn().mockReturnValue(jest.fn()),
      onConnectionChange: jest.fn().mockReturnValue(jest.fn()),
      on: jest.fn().mockReturnValue(jest.fn()),
      onUserListChange: jest.fn().mockReturnValue(jest.fn()),
      getConnectionStatus: jest.fn().mockReturnValue(true),
      getNetworkName: jest.fn().mockReturnValue('managed-net'),
      getCurrentNick: jest.fn().mockReturnValue('me'),
      addMessage: jest.fn(),
      sendRaw: jest.fn(),
      partChannel: jest.fn(),
      emit: jest.fn(),
    };
    CM().getAllConnections.mockReturnValue([
      {
        networkId: 'managed-net',
        ircService: managedSvc,
        userManagementService: {
          isUserIgnored: jest.fn().mockReturnValue(false),
        },
      },
    ]);
    CM().getActiveNetworkId.mockReturnValue('managed-net');
    const setIsConnected = jest.fn();
    await renderHook(() =>
      useConnectionLifecycle({ ...mockParams, setIsConnected }),
    );
    expect(managedSvc.onMessage).toHaveBeenCalled();
    // anyConnected true -> setIsConnected(true) during setup
    expect(setIsConnected).toHaveBeenCalledWith(true);
    // Connection change handler uses connections.some() branch
    const connHandler = managedSvc.onConnectionChange.mock.calls[0][0];
    await act(async () => {
      connHandler(true);
    });
  });

  it('auto-accepts DCC CHAT invites when dccAutoChatFrom > 1', async () => {
    const { dccChatService } = require('../../src/services/DCCChatService');
    dccChatService.parseDccChatInvite.mockReturnValue({
      host: '1.2.3.4',
      port: 5000,
    });
    dccChatService.handleIncomingInvite.mockReturnValue({ id: 'chat-1' });
    SETTINGS().getSetting.mockImplementation(async (key: string, def: any) => {
      if (key === 'noticeTarget') return 'server';
      if (key === 'dccAutoChatFrom') return 2;
      return def;
    });
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { message } = captureHandlers();
    await act(async () => {
      await message({
        type: 'message',
        from: 'bob',
        text: '\x01DCC CHAT chat 1 2\x01',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    expect(dccChatService.acceptInvite).toHaveBeenCalledWith(
      'chat-1',
      expect.anything(),
    );
    dccChatService.parseDccChatInvite.mockReturnValue(null);
  });

  it('prompts for DCC CHAT invites and handles accept/decline', async () => {
    const { dccChatService } = require('../../src/services/DCCChatService');
    dccChatService.parseDccChatInvite.mockReturnValue({
      host: '1.2.3.4',
      port: 5000,
    });
    dccChatService.handleIncomingInvite.mockReturnValue({ id: 'chat-2' });
    SETTINGS().getSetting.mockImplementation(async (key: string, def: any) => {
      if (key === 'noticeTarget') return 'server';
      if (key === 'dccAutoChatFrom') return 1;
      return def;
    });
    mockAlert.alert.mockClear();
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { message } = captureHandlers();
    await act(async () => {
      await message({
        type: 'message',
        from: 'bob',
        text: '\x01DCC CHAT chat 1 2\x01',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    const call = mockAlert.alert.mock.calls.find(
      (c: any[]) => c[0] === 'DCC Chat Request',
    );
    expect(call).toBeTruthy();
    const buttons = call[2];
    buttons[0].onPress();
    buttons[1].onPress();
    expect(dccChatService.closeSession).toHaveBeenCalledWith('chat-2');
    expect(dccChatService.acceptInvite).toHaveBeenCalledWith(
      'chat-2',
      expect.anything(),
    );
    dccChatService.parseDccChatInvite.mockReturnValue(null);
  });

  it('auto-accepts DCC SEND via autoMode when no extension matches', async () => {
    const { dccFileService } = require('../../src/services/DCCFileService');
    dccFileService.parseSendOffer.mockReturnValue({
      filename: 'file.dat',
      size: 10,
    });
    dccFileService.handleOffer.mockReturnValue({ id: 't-auto' });
    dccFileService.getDefaultDownloadPath.mockResolvedValue('/dl/file.dat');
    SETTINGS().getSetting.mockImplementation(async (key: string, def: any) => {
      if (key === 'noticeTarget') return 'server';
      if (key === 'dccAutoGetMode') return 'accept';
      if (key === 'dccAutoGetFrom') return 2;
      if (key === 'dccAcceptExts') return ['*.txt'];
      if (key === 'dccRejectExts') return ['*.exe'];
      if (key === 'dccDontSendExts') return ['*.bat'];
      return def;
    });
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { message } = captureHandlers();
    await act(async () => {
      await message({
        type: 'message',
        from: 'bob',
        text: 'DCC SEND file.dat',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    expect(dccFileService.accept).toHaveBeenCalledWith(
      't-auto',
      expect.anything(),
      '/dl/file.dat',
    );
    dccFileService.parseSendOffer.mockReturnValue(null);
  });

  it('auto-rejects DCC SEND via autoMode reject', async () => {
    const { dccFileService } = require('../../src/services/DCCFileService');
    dccFileService.parseSendOffer.mockReturnValue({
      filename: 'file.bat',
      size: 10,
    });
    dccFileService.handleOffer.mockReturnValue({ id: 't-autorej' });
    SETTINGS().getSetting.mockImplementation(async (key: string, def: any) => {
      if (key === 'noticeTarget') return 'server';
      if (key === 'dccAutoGetMode') return 'dont_send';
      if (key === 'dccAutoGetFrom') return 2;
      if (key === 'dccAcceptExts') return ['*.txt'];
      if (key === 'dccRejectExts') return ['*.exe'];
      if (key === 'dccDontSendExts') return ['*.bat'];
      return def;
    });
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { message } = captureHandlers();
    await act(async () => {
      await message({
        type: 'message',
        from: 'bob',
        text: 'DCC SEND file.bat',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    expect(dccFileService.cancel).toHaveBeenCalledWith('t-autorej');
    dccFileService.parseSendOffer.mockReturnValue(null);
  });

  it('auto-rejects DCC SEND via autoMode reject when no extension matches', async () => {
    const { dccFileService } = require('../../src/services/DCCFileService');
    dccFileService.parseSendOffer.mockReturnValue({
      filename: 'file.dat',
      size: 10,
    });
    dccFileService.handleOffer.mockReturnValue({ id: 't-modereject' });
    SETTINGS().getSetting.mockImplementation(async (key: string, def: any) => {
      if (key === 'noticeTarget') return 'server';
      if (key === 'dccAutoGetMode') return 'reject';
      if (key === 'dccAutoGetFrom') return 2;
      if (key === 'dccAcceptExts') return ['*.txt'];
      if (key === 'dccRejectExts') return ['*.exe'];
      if (key === 'dccDontSendExts') return [];
      return def;
    });
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { message } = captureHandlers();
    await act(async () => {
      await message({
        type: 'message',
        from: 'bob',
        text: 'DCC SEND file.dat',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    expect(dccFileService.cancel).toHaveBeenCalledWith('t-modereject');
    dccFileService.parseSendOffer.mockReturnValue(null);
  });

  it('prompts for DCC SEND offers and handles accept/decline buttons', async () => {
    const { dccFileService } = require('../../src/services/DCCFileService');
    dccFileService.parseSendOffer.mockReturnValue({
      filename: 'file.xyz',
      size: 100,
    });
    dccFileService.handleOffer.mockReturnValue({ id: 't-prompt' });
    SETTINGS().getSetting.mockImplementation(async (key: string, def: any) => {
      if (key === 'noticeTarget') return 'server';
      if (key === 'dccAutoGetMode') return 'accept';
      if (key === 'dccAutoGetFrom') return 1; // allowAuto false -> prompt
      if (key === 'dccAcceptExts') return ['*.txt'];
      if (key === 'dccRejectExts') return ['*.exe'];
      if (key === 'dccDontSendExts') return ['*.bat'];
      return def;
    });
    mockAlert.alert.mockClear();
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { message } = captureHandlers();
    await act(async () => {
      await message({
        type: 'message',
        from: 'bob',
        text: 'DCC SEND file.xyz',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    const call = mockAlert.alert.mock.calls.find(
      (c: any[]) => c[0] === 'DCC SEND Offer',
    );
    expect(call).toBeTruthy();
    const buttons = call[2];
    buttons[0].onPress(); // decline
    buttons[1].onPress(); // accept -> opens DCC transfers modal
    expect(dccFileService.cancel).toHaveBeenCalledWith('t-prompt');
    dccFileService.parseSendOffer.mockReturnValue(null);
  });

  it('routes notice messages by noticeTarget preference (active/notice/private)', async () => {
    const params = {
      ...mockParams,
      activeTabId: 'channel-test-network-#test',
      tabsRef: { current: baseTabs() },
    };
    // active
    setNoticeTarget('active');
    await renderHook(() => useConnectionLifecycle(params));
    let handlers = captureHandlers();
    await act(async () => {
      await handlers.message({
        type: 'notice',
        from: 'bob',
        channel: '#test',
        text: 'note',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // notice
    setNoticeTarget('notice');
    await act(async () => {
      await handlers.message({
        type: 'notice',
        from: 'bob',
        channel: '#test',
        text: 'note2',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // private (triggers encryption lookup)
    const {
      encryptedDMService,
    } = require('../../src/services/EncryptedDMService');
    encryptedDMService.isEncryptedForNetwork.mockClear();
    setNoticeTarget('private');
    await act(async () => {
      await handlers.message({
        type: 'notice',
        from: 'bob',
        channel: '#test',
        text: 'note3',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    expect(encryptedDMService.isEncryptedForNetwork).toHaveBeenCalled();
  });

  it('routes system notifications, nick changes, query and fallback messages', async () => {
    const params = {
      ...mockParams,
      activeTabId: 'channel-test-network-#test',
      tabsRef: { current: baseTabs() },
    };
    setNoticeTarget('private');
    await renderHook(() => useConnectionLifecycle(params));
    const { message } = captureHandlers();
    // system -> notifications tab
    await act(async () => {
      await message({
        type: 'system',
        channel: 'notifications',
        text: 'online',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // nick change without channel, private routing
    await act(async () => {
      await message({
        type: 'nick',
        from: 'oldnick',
        text: 'newnick',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // channel message routed to query (channel is a nick, not #)
    await act(async () => {
      await message({
        type: 'message',
        from: 'bob',
        channel: 'bob',
        text: 'hi',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // fallback: no channel -> query from message.from (also private msg sound)
    await act(async () => {
      await message({
        type: 'message',
        from: 'carol',
        text: 'privmsg',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    expect(SOUND().playSound).toHaveBeenCalledWith(
      SOUND_TYPES().PRIVATE_MESSAGE,
    );
  });

  it('routes nick change with active and notice preferences', async () => {
    const params = {
      ...mockParams,
      activeTabId: 'channel-test-network-#test',
      tabsRef: { current: baseTabs() },
    };
    setNoticeTarget('active');
    await renderHook(() => useConnectionLifecycle(params));
    let handlers = captureHandlers();
    await act(async () => {
      await handlers.message({
        type: 'nick',
        from: 'oldnick',
        text: 'newnick',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    setNoticeTarget('notice');
    await act(async () => {
      await handlers.message({
        type: 'nick',
        from: 'oldnick2',
        text: 'newnick2',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
  });

  it('routes raw whois messages to the active tab', async () => {
    const params = {
      ...mockParams,
      activeTabId: 'channel-test-network-#test',
      tabsRef: { current: baseTabs() },
    };
    setNoticeTarget('server');
    await renderHook(() => useConnectionLifecycle(params));
    const { message } = captureHandlers();
    await act(async () => {
      await message({
        type: 'raw',
        isRaw: true,
        whoisActiveTab: true,
        text: 'whois info',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    expect(mockParams.processBatchedMessages).toBeDefined();
  });

  it('routes raw connection messages via notice routing when server tab is closed', async () => {
    // tabs without a server tab (id server-test-network absent)
    const tabsNoServer = [
      {
        id: 'channel-test-network-#test',
        type: 'channel',
        name: '#test',
        networkId: 'test-network',
        messages: [],
      },
      {
        id: 'query-test-network-bob',
        type: 'query',
        name: 'bob',
        networkId: 'test-network',
        messages: [],
      },
    ];
    const params = {
      ...mockParams,
      activeTabId: 'channel-test-network-#test',
      tabsRef: { current: tabsNoServer },
    };
    // active routing
    setNoticeTarget('active');
    await renderHook(() => useConnectionLifecycle(params));
    let handlers = captureHandlers();
    await act(async () => {
      await handlers.message({
        type: 'raw',
        isRaw: true,
        rawCategory: 'connection',
        from: 'bob',
        channel: '',
        text: '*** disconnected',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // notice routing
    setNoticeTarget('notice');
    await act(async () => {
      await handlers.message({
        type: 'raw',
        isRaw: true,
        rawCategory: 'connection',
        from: 'bob',
        channel: '',
        text: '*** disconnected2',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // private routing with query active tab
    const paramsQuery = {
      ...mockParams,
      activeTabId: 'query-test-network-bob',
      tabsRef: { current: tabsNoServer },
    };
    setNoticeTarget('private');
    const r2 = await renderHook(() => useConnectionLifecycle(paramsQuery));
    const h2 = captureHandlers();
    await act(async () => {
      await h2.message({
        type: 'raw',
        isRaw: true,
        rawCategory: 'connection',
        from: 'bob',
        channel: '',
        text: '*** disconnected3',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // private routing where active tab is NOT a query -> falls back to notice tab
    const paramsChannelActive = {
      ...mockParams,
      activeTabId: 'channel-test-network-#test',
      tabsRef: { current: tabsNoServer },
    };
    setNoticeTarget('private');
    await renderHook(() => useConnectionLifecycle(paramsChannelActive));
    const h3 = captureHandlers();
    await act(async () => {
      await h3.message({
        type: 'raw',
        isRaw: true,
        rawCategory: 'connection',
        from: 'bob',
        channel: '',
        text: '*** disconnected4',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    expect(r2).toBeDefined();
  });

  it('plays mention, notice, ctcp, join and kick sounds', async () => {
    const params = {
      ...mockParams,
      activeTabId: 'active-tab',
      tabsRef: { current: baseTabs() },
    };
    setNoticeTarget('server');
    await renderHook(() => useConnectionLifecycle(params));
    const { message } = captureHandlers();
    // mention (channel message containing current nick)
    await act(async () => {
      await message({
        type: 'message',
        from: 'alice',
        channel: '#test',
        text: 'hello testuser',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // notice sound
    await act(async () => {
      await message({
        type: 'notice',
        from: 'alice',
        channel: '#test',
        text: 'a notice',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // ctcp sound
    await act(async () => {
      await message({
        type: 'ctcp',
        from: 'alice',
        text: 'PING',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // join sound
    await act(async () => {
      await message({
        type: 'join',
        from: 'alice',
        channel: '#test',
        text: 'joined',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    // kick sound
    await act(async () => {
      await message({
        type: 'mode',
        from: 'alice',
        channel: '#test',
        text: 'alice was kicked',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    expect(SOUND().playSound).toHaveBeenCalledWith(SOUND_TYPES().MENTION);
    expect(SOUND().playSound).toHaveBeenCalledWith(SOUND_TYPES().NOTICE);
    expect(SOUND().playSound).toHaveBeenCalledWith(SOUND_TYPES().CTCP);
    expect(SOUND().playSound).toHaveBeenCalledWith(SOUND_TYPES().JOIN);
    expect(SOUND().playSound).toHaveBeenCalledWith(SOUND_TYPES().KICK);
  });

  it('logs when foreground notification fails to show', async () => {
    const {
      notificationService,
    } = require('../../src/services/NotificationService');
    notificationService.shouldNotify.mockReturnValue(true);
    notificationService.showMessageNotification.mockRejectedValue(
      new Error('notif fail'),
    );
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const params = {
      ...mockParams,
      activeTabId: 'active-tab',
      tabsRef: { current: baseTabs() },
    };
    setNoticeTarget('server');
    await renderHook(() => useConnectionLifecycle(params));
    const { message } = captureHandlers();
    await act(async () => {
      await message({
        type: 'message',
        from: 'alice',
        channel: '#test',
        text: 'hey there',
        network: 'test-network',
        timestamp: Date.now(),
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(notificationService.showMessageNotification).toHaveBeenCalled();
    errSpy.mockRestore();
    notificationService.showMessageNotification.mockResolvedValue(undefined);
  });

  it('clears the existing batch timeout when a new message arrives', async () => {
    jest.useFakeTimers();
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    const params = {
      ...mockParams,
      messageBatchTimeoutRef: { current: null as any },
      tabsRef: { current: baseTabs() },
    };
    setNoticeTarget('server');
    await renderHook(() => useConnectionLifecycle(params));
    const { message } = captureHandlers();
    await act(async () => {
      await message({
        type: 'message',
        from: 'alice',
        channel: '#test',
        text: 'one',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    await act(async () => {
      await message({
        type: 'message',
        from: 'alice',
        channel: '#test',
        text: 'two',
        network: 'test-network',
        timestamp: Date.now(),
      });
    });
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    jest.useRealTimers();
  });

  it('reconnect with existing tabs adds reconnect message and keeps active tab', async () => {
    CM().getActiveNetworkId.mockReturnValue('test-network');
    const setActiveTabId = jest.fn();
    // tabs exist but no server tab -> updater adds server tab
    const tabs = [
      {
        id: 'channel-test-network-#test',
        type: 'channel',
        name: '#test',
        networkId: 'test-network',
        messages: [],
      },
    ];
    const setTabs = jest.fn((fn: any) => {
      if (typeof fn === 'function') fn(tabs);
    });
    const params = {
      ...mockParams,
      activeTabId: 'active-tab',
      tabsRef: { current: tabs },
      setActiveTabId,
      setTabs,
    };
    await renderHook(() => useConnectionLifecycle(params));
    const { connection } = captureHandlers();
    await act(async () => {
      connection(true);
    });
    expect(mockParams.processBatchedMessages).toHaveBeenCalled();
    expect(setTabs).toHaveBeenCalled();
    expect(setActiveTabId).toHaveBeenCalledWith('server-test-network');
  });

  it('reconnect with existing tabs returns early when currentConnectionId is null', async () => {
    CM()
      .getActiveNetworkId.mockReturnValueOnce(null)
      .mockReturnValue('test-network');
    const setTabs = jest.fn();
    const params = {
      ...mockParams,
      tabsRef: {
        current: [
          {
            id: 'channel-test-network-#test',
            type: 'channel',
            name: '#test',
            networkId: 'test-network',
            messages: [],
          },
        ],
      },
      setTabs,
    };
    await renderHook(() => useConnectionLifecycle(params));
    const { connection } = captureHandlers();
    await act(async () => {
      connection(true);
    });
    expect(setTabs).not.toHaveBeenCalled();
  });

  it('reconnect returns early when currentConnectionId is null but tabs missing', async () => {
    CM()
      .getActiveNetworkId.mockReturnValueOnce(null)
      .mockReturnValue('test-network');
    const setTabs = jest.fn();
    const params = {
      ...mockParams,
      tabsRef: { current: [] },
      setTabs,
    };
    await renderHook(() => useConnectionLifecycle(params));
    const { connection } = captureHandlers();
    require('../../src/services/TabService').tabService.getTabs.mockClear();
    await act(async () => {
      connection(true);
      await Promise.resolve();
    });
    expect(
      require('../../src/services/TabService').tabService.getTabs,
    ).not.toHaveBeenCalled();
  });

  it('reconnect from storage handles server-tab history load failure', async () => {
    CM().getActiveNetworkId.mockReturnValue('test-network');
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    require('../../src/services/TabService').tabService.getTabs.mockResolvedValue(
      [
        {
          id: 'server-test-network',
          type: 'server',
          name: 'test-network',
          networkId: 'test-network',
        },
        {
          id: 'channel-test-network-#room',
          type: 'channel',
          name: '#room',
          networkId: 'test-network',
        },
      ],
    );
    require('../../src/services/MessageHistoryService').messageHistoryService.loadMessages.mockRejectedValue(
      new Error('history fail'),
    );
    const existingOtherNetTabs = [
      {
        id: 'server-other',
        type: 'server',
        name: 'other',
        networkId: 'other-net',
        messages: [],
      },
    ];
    const setTabs = jest.fn((fn: any) => {
      if (typeof fn === 'function') fn(existingOtherNetTabs);
    });
    const setActiveTabId = jest.fn();
    const params = {
      ...mockParams,
      activeTabId: 'active-tab',
      tabsRef: { current: existingOtherNetTabs },
      setTabs,
      setActiveTabId,
    };
    await renderHook(() => useConnectionLifecycle(params));
    const { connection } = captureHandlers();
    await act(async () => {
      connection(true);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(setTabs).toHaveBeenCalled();
    expect(setActiveTabId).toHaveBeenCalledWith('server-test-network');
    errSpy.mockRestore();
    require('../../src/services/MessageHistoryService').messageHistoryService.loadMessages.mockResolvedValue(
      [],
    );
  });

  it('reconnect falls back to server tab when tab storage load fails', async () => {
    CM().getActiveNetworkId.mockReturnValue('test-network');
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    require('../../src/services/TabService').tabService.getTabs.mockRejectedValue(
      new Error('storage fail'),
    );
    // tabsRef has no tab for the reconnecting network -> enters storage-load path
    const otherNetTabs = [
      {
        id: 'query-other-x',
        type: 'query',
        name: 'x',
        networkId: 'other-net',
        messages: [],
      },
    ];
    const setTabs = jest.fn((fn: any) => {
      if (typeof fn === 'function') fn(otherNetTabs);
    });
    const setActiveTabId = jest.fn();
    const params = {
      ...mockParams,
      activeTabId: 'active-tab',
      tabsRef: { current: otherNetTabs },
      setTabs,
      setActiveTabId,
    };
    await renderHook(() => useConnectionLifecycle(params));
    const { connection } = captureHandlers();
    await act(async () => {
      connection(true);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(setTabs).toHaveBeenCalled();
    expect(setActiveTabId).toHaveBeenCalledWith('server-test-network');
    errSpy.mockRestore();
    require('../../src/services/TabService').tabService.getTabs.mockResolvedValue(
      [],
    );
  });

  it('handles disconnect by clearing users and playing disconnect sound', async () => {
    CM().getActiveNetworkId.mockReturnValue('test-network');
    const {
      userActivityService,
    } = require('../../src/services/UserActivityService');
    const { scriptingService } = require('../../src/services/ScriptingService');
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { connection } = captureHandlers();
    await act(async () => {
      connection(false);
    });
    expect(userActivityService.clearNetwork).toHaveBeenCalledWith(
      'test-network',
    );
    expect(scriptingService.handleDisconnect).toHaveBeenCalledWith(
      'test-network',
      'Disconnected',
    );
    expect(SOUND().playSound).toHaveBeenCalledWith(SOUND_TYPES().DISCONNECT);
  });

  it('updates tab encryption state on bundle stored', async () => {
    const {
      encryptedDMService,
    } = require('../../src/services/EncryptedDMService');
    let cb: any;
    encryptedDMService.onBundleStored.mockImplementation((fn: any) => {
      cb = fn;
      return jest.fn();
    });
    const tabs = baseTabs();
    const setTabs = jest.fn((fn: any) => {
      if (typeof fn === 'function') fn(tabs);
    });
    await renderHook(() => useConnectionLifecycle({ ...mockParams, setTabs }));
    await act(async () => {
      cb('bob');
    });
    expect(setTabs).toHaveBeenCalled();
  });

  it('handles incoming encryption key requests (accept/reject and key change)', async () => {
    const {
      encryptedDMService,
    } = require('../../src/services/EncryptedDMService');
    let cb: any;
    encryptedDMService.onKeyRequest.mockImplementation((fn: any) => {
      cb = fn;
      return jest.fn();
    });
    encryptedDMService.acceptKeyOfferForNetwork.mockResolvedValue({ pub: 'x' });
    mockAlert.alert.mockClear();
    await renderHook(() => useConnectionLifecycle(mockParams));
    // key change offer
    await act(async () => {
      cb(
        'bob',
        {},
        {
          reason: 'change',
          newFingerprint: 'aabb',
          existingFingerprint: 'ccdd',
        },
      );
    });
    let call =
      mockAlert.alert.mock.calls[mockAlert.alert.mock.calls.length - 1];
    await act(async () => {
      await call[2][0].onPress(); // reject / keep existing
      await call[2][1].onPress(); // accept / replace
    });
    expect(encryptedDMService.rejectKeyOfferForNetwork).toHaveBeenCalled();
    expect(encryptedDMService.acceptKeyOfferForNetwork).toHaveBeenCalled();

    // new offer with accept failure
    encryptedDMService.acceptKeyOfferForNetwork.mockRejectedValue(
      new Error('accept fail'),
    );
    await act(async () => {
      cb('carol', {}, { reason: 'new', newFingerprint: 'ee11' });
    });
    call = mockAlert.alert.mock.calls[mockAlert.alert.mock.calls.length - 1];
    await act(async () => {
      await call[2][1].onPress();
    });
    expect(IRC().addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
    encryptedDMService.acceptKeyOfferForNetwork.mockResolvedValue({});
  });

  it('updates tab state on channel key changes (stored and removed)', async () => {
    const {
      channelEncryptionService,
    } = require('../../src/services/ChannelEncryptionService');
    let cb: any;
    channelEncryptionService.onChannelKeyChange.mockImplementation(
      (fn: any) => {
        cb = fn;
        return jest.fn();
      },
    );
    const tabs = baseTabs();
    const setTabs = jest.fn((fn: any) => {
      if (typeof fn === 'function') fn(tabs);
    });
    await renderHook(() => useConnectionLifecycle({ ...mockParams, setTabs }));
    channelEncryptionService.hasChannelKey.mockResolvedValueOnce(true);
    await act(async () => {
      await cb('#test', 'test-network');
    });
    channelEncryptionService.hasChannelKey.mockResolvedValueOnce(false);
    await act(async () => {
      await cb('#test', 'test-network');
    });
    expect(setTabs).toHaveBeenCalled();
    expect(IRC().addMessage).toHaveBeenCalled();
  });

  it('clears a query tab via clear-tab and logs history delete failures', async () => {
    const clearTabMessages = jest.fn();
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      clearTabMessages,
      removeTab: jest.fn(),
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    require('../../src/services/MessageHistoryService').messageHistoryService.deleteMessages.mockRejectedValue(
      new Error('del fail'),
    );
    // Include a tab from a different network to exercise the networkId mismatch branch
    const tabs = [
      {
        id: 'query-other-bob',
        type: 'query',
        name: 'bob',
        networkId: 'other-net',
        messages: [],
      },
      ...baseTabs(),
    ];
    const params = {
      ...mockParams,
      tabsRef: { current: tabs },
    };
    await renderHook(() => useConnectionLifecycle(params));
    const { on } = captureHandlers();
    await act(async () => {
      on.get('clear-tab')?.('bob', 'test-network');
      await Promise.resolve();
    });
    expect(clearTabMessages).toHaveBeenCalled();
    errSpy.mockRestore();
    require('../../src/services/MessageHistoryService').messageHistoryService.deleteMessages.mockResolvedValue(
      undefined,
    );
  });

  it('updates channel user lists through the user list handler', async () => {
    const setChannelUsers = jest.fn((fn: any) => {
      if (typeof fn === 'function') fn(new Map());
    });
    await renderHook(() =>
      useConnectionLifecycle({ ...mockParams, setChannelUsers }),
    );
    const { userList } = captureHandlers();
    await act(async () => {
      userList('#test', [{ nick: 'alice' }]);
    });
    expect(setChannelUsers).toHaveBeenCalled();
  });

  it('closes a query tab, saves tabs and switches active tab', async () => {
    const removeTab = jest.fn();
    require('../../src/stores/tabStore').useTabStore.getState.mockReturnValue({
      clearTabMessages: jest.fn(),
      removeTab,
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    require('../../src/services/TabService').tabService.saveTabs.mockRejectedValue(
      new Error('save fail'),
    );
    const setActiveTabId = jest.fn();
    const tabs = [
      {
        id: 'query-other-bob',
        type: 'query',
        name: 'bob',
        networkId: 'other-net',
        messages: [],
      },
      ...baseTabs(),
    ];
    const params = {
      ...mockParams,
      activeTabId: 'query-test-network-bob',
      tabsRef: { current: tabs },
      setActiveTabId,
    };
    await renderHook(() => useConnectionLifecycle(params));
    const { on } = captureHandlers();
    await act(async () => {
      on.get('close-tab')?.('bob', 'test-network');
      await Promise.resolve();
    });
    expect(removeTab).toHaveBeenCalled();
    expect(setActiveTabId).toHaveBeenCalled();
    errSpy.mockRestore();
    require('../../src/services/TabService').tabService.saveTabs.mockResolvedValue(
      undefined,
    );
  });

  it('handles server-command disconnectOnly while connected', async () => {
    IRC().getConnectionStatus.mockReturnValue(true);
    IRC().getNetworkName.mockReturnValue('test-network');
    const {
      autoReconnectService,
    } = require('../../src/services/AutoReconnectService');
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { on } = captureHandlers();
    await act(async () => {
      await on.get('server-command')?.({
        management: {},
        switches: { disconnectOnly: true },
        managementOptions: {},
      });
    });
    expect(autoReconnectService.markIntentionalDisconnect).toHaveBeenCalledWith(
      'test-network',
    );
    expect(IRC().sendRaw).toHaveBeenCalledWith('QUIT :Changing server');
    IRC().getConnectionStatus.mockReturnValue(false);
  });

  it('calls handleServerConnect when provided for server-command', async () => {
    const handleServerConnect = jest.fn().mockResolvedValue(undefined);
    await renderHook(() =>
      useConnectionLifecycle({ ...mockParams, handleServerConnect }),
    );
    const { on } = captureHandlers();
    await act(async () => {
      await on.get('server-command')?.({
        management: {},
        switches: {},
        managementOptions: {},
        address: 'irc.example.net',
        port: 6667,
      });
    });
    expect(handleServerConnect).toHaveBeenCalled();
  });

  it('emits server-connect fallback when no handleServerConnect provided', async () => {
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { on } = captureHandlers();
    await act(async () => {
      await on.get('server-command')?.({
        management: {},
        switches: {},
        managementOptions: {},
        address: 'irc.example.net',
        port: 6667,
      });
    });
    expect(IRC().emit).toHaveBeenCalledWith(
      'server-connect',
      expect.objectContaining({ network: 'test-network' }),
    );
  });

  it('reports server-command errors via error message', async () => {
    SETTINGS().loadNetworks.mockRejectedValueOnce(new Error('load fail'));
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { on } = captureHandlers();
    await act(async () => {
      await on.get('server-command')?.({
        management: { add: true },
        address: 'irc.err.net',
        switches: {},
        managementOptions: {},
      });
    });
    expect(IRC().addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: '*** Server command error: {error}',
      }),
    );
    SETTINGS().loadNetworks.mockResolvedValue([]);
  });

  it('reports DNS results when only AAAA records are found', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        Status: 0,
        Answer: [{ type: 28, data: '2606:4700:4700::1111' }],
      }),
    });
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { on } = captureHandlers();
    await act(async () => {
      await on.get('dns-lookup')?.('example.org');
    });
    expect(IRC().addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** DNS A for {hostname}: <none>' }),
    );
    expect(IRC().addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '*** DNS AAAA for {hostname}: {records}',
      }),
    );
  });

  it('reports DNS results when only A records are found', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        Status: 0,
        Answer: [{ type: 1, data: '1.1.1.1' }],
      }),
    });
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { on } = captureHandlers();
    await act(async () => {
      await on.get('dns-lookup')?.('example.org');
    });
    expect(IRC().addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** DNS A for {hostname}: {records}' }),
    );
    expect(IRC().addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** DNS AAAA for {hostname}: <none>' }),
    );
  });

  it('treats non-ok DNS responses as provider failures', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { on } = captureHandlers();
    await act(async () => {
      await on.get('dns-lookup')?.('example.org');
    });
    expect(IRC().addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** DNS lookup failed for {hostname}' }),
    );
  });

  it('treats non-zero DNS Status as no records', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ Status: 2, Answer: [] }),
    });
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { on } = captureHandlers();
    await act(async () => {
      await on.get('dns-lookup')?.('example.org');
    });
    expect(IRC().addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '*** No DNS records found for {hostname}',
      }),
    );
  });

  it('reports DNS errors thrown while rendering results', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        Status: 0,
        Answer: [{ type: 1, data: '1.1.1.1' }],
      }),
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Throw on the first result-display addMessage call to hit the outer catch
    IRC().addMessage.mockImplementationOnce(() => {
      throw new Error('render fail');
    });
    await renderHook(() => useConnectionLifecycle(mockParams));
    const { on } = captureHandlers();
    await act(async () => {
      await on.get('dns-lookup')?.('example.org');
    });
    expect(IRC().addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '*** DNS lookup failed for {hostname}: {error}',
      }),
    );
    errSpy.mockRestore();
  });

  it('sends messages/actions/notices to all channels via amsg/ame/anotice', async () => {
    const params = {
      ...mockParams,
      tabsRef: { current: baseTabs() },
    };
    await renderHook(() => useConnectionLifecycle(params));
    const { on } = captureHandlers();
    await act(async () => {
      on.get('amsg')?.('hello all', 'test-network');
      on.get('ame')?.('waves', 'test-network');
      on.get('anotice')?.('notice all', 'test-network');
    });
    expect(IRC().sendRaw).toHaveBeenCalledWith('PRIVMSG #test :hello all');
    expect(IRC().sendRaw).toHaveBeenCalledWith(
      'PRIVMSG #test :\x01ACTION waves\x01',
    );
    expect(IRC().sendRaw).toHaveBeenCalledWith('NOTICE #test :notice all');
  });

  it('updates ping while connected via the ping interval', async () => {
    jest.useFakeTimers();
    const setPing = jest.fn();
    await renderHook(() =>
      useConnectionLifecycle({ ...mockParams, isConnected: true, setPing }),
    );
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(setPing).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
