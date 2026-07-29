/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useMessageSending hook - Wave 4
 */

import { renderHook, act, cleanup } from '@testing-library/react-native';

// Mock tab store
const mockTabStore = {
  tabs: [],
};

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: Object.assign(
    jest.fn(selector => selector(mockTabStore)),
    { getState: jest.fn(() => mockTabStore) },
  ),
}));

// Mock dependencies
jest.mock('../../src/services/ScriptingService', () => ({
  scriptingService: {
    processOutgoingCommand: jest.fn().mockImplementation(cmd => cmd),
  },
}));

jest.mock('../../src/services/DCCChatService', () => ({
  dccChatService: {
    initiateChat: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn(),
  },
}));

jest.mock('../../src/services/DCCFileService', () => ({
  dccFileService: {
    sendFile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/OfflineQueueService', () => ({
  offlineQueueService: {
    addMessage: jest.fn(),
  },
}));

jest.mock('../../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    isEncryptedForNetwork: jest.fn().mockResolvedValue(false),
    encryptForNetwork: jest.fn().mockResolvedValue({ encrypted: 'data' }),
  },
}));

jest.mock('../../src/services/ChannelEncryptionService', () => ({
  channelEncryptionService: {
    hasChannelKey: jest.fn().mockResolvedValue(false),
    encryptMessage: jest.fn().mockResolvedValue({ encrypted: 'data' }),
  },
}));

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    saveMessage: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn().mockImplementation((key, defaultValue) => {
      const settings: Record<string, any> = {
        decorEnabled: false,
        decorUseColors: true,
        decorBold: false,
        decorUnderline: false,
        decorTextStyleId: '',
        decorColorStyleId: '',
        decorAdornmentId: '',
      };
      return Promise.resolve(settings[key] ?? defaultValue);
    }),
  },
  DEFAULT_PART_MESSAGE: 'Leaving',
}));

jest.mock('../../src/utils/DecorationFormatter', () => ({
  applyDecoration: jest.fn().mockImplementation(text => text),
}));

import { useMessageSending } from '../../src/hooks/useMessageSending';
import { scriptingService } from '../../src/services/ScriptingService';
import { dccChatService } from '../../src/services/DCCChatService';
import { dccFileService } from '../../src/services/DCCFileService';
import { offlineQueueService } from '../../src/services/OfflineQueueService';
import { encryptedDMService } from '../../src/services/EncryptedDMService';
import { channelEncryptionService } from '../../src/services/ChannelEncryptionService';
import { messageHistoryService } from '../../src/services/MessageHistoryService';
import { settingsService } from '../../src/services/SettingsService';
import { applyDecoration } from '../../src/utils/DecorationFormatter';
import { setPendingReply } from '../../src/services/PendingReplyStore';

describe('useMessageSending', () => {
  const mockSetTabs = jest.fn();
  const mockSafeAlert = jest.fn();
  const mockT = jest.fn((key: string) => key);
  const mockSendMessage = jest.fn();
  const mockSendCommand = jest.fn();
  const mockSendRaw = jest.fn();
  const mockSendCTCPRequest = jest.fn();
  const mockAddMessage = jest.fn();
  const mockProcessCommand = jest
    .fn()
    .mockImplementation(cmd => Promise.resolve(cmd));

  const createMockParams = (overrides = {}) => ({
    isConnected: true,
    activeTabId: 'tab-1',
    getActiveIRCService: jest.fn().mockReturnValue({
      sendMessage: mockSendMessage,
      sendCommand: mockSendCommand,
      sendRaw: mockSendRaw,
      sendCTCPRequest: mockSendCTCPRequest,
      addMessage: mockAddMessage,
      getNetworkName: jest.fn().mockReturnValue('freenode'),
    }),
    getActiveCommandService: jest.fn().mockReturnValue({
      processCommand: mockProcessCommand,
    }),
    setTabs: mockSetTabs,
    safeAlert: mockSafeAlert,
    t: mockT,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTabStore.tabs = [];
    (scriptingService.processOutgoingCommand as jest.Mock).mockImplementation(
      (cmd: string) => cmd,
    );
    (settingsService.getSetting as jest.Mock).mockImplementation(
      (key: string, defaultValue: any) => {
        const settings: Record<string, any> = {
          decorEnabled: false,
          decorUseColors: true,
          decorBold: false,
          decorUnderline: false,
          decorTextStyleId: '',
          decorColorStyleId: '',
          decorAdornmentId: '',
        };
        return Promise.resolve(settings[key] ?? defaultValue);
      },
    );
  });

  afterEach(async () => {
    cleanup();
  });

  it('should return handleSendMessage function', async () => {
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    expect(result.current.handleSendMessage).toBeDefined();
    expect(typeof result.current.handleSendMessage).toBe('function');
  });

  it('should not send message when no valid tab exists', async () => {
    mockTabStore.tabs = [];

    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );

    await act(async () => {
      await result.current.handleSendMessage('Hello');
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should send message to channel tab', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: false,
      },
    ];

    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );

    await act(async () => {
      await result.current.handleSendMessage('Hello everyone!');
    });

    expect(mockSendMessage).toHaveBeenCalledWith('#test', 'Hello everyone!');
  });

  it('should send command to server tab', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Freenode',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];

    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );

    await act(async () => {
      await result.current.handleSendMessage('/join #test');
    });

    expect(mockSendMessage).toHaveBeenCalled();
  });

  it('should show alert when not connected for server commands', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Freenode',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];

    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ isConnected: false })),
    );

    await act(async () => {
      await result.current.handleSendMessage('/join #test');
    });

    expect(mockSafeAlert).toHaveBeenCalledWith(
      'Not Connected',
      'Please connect to a server first',
    );
  });

  it('should process CTCP command', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'OtherUser',
        type: 'query',
        networkId: 'freenode',
        messages: [],
      },
    ];

    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );

    await act(async () => {
      await result.current.handleSendMessage('/ctcp OtherUser VERSION');
    });

    expect(mockSendCTCPRequest).toHaveBeenCalledWith(
      'OtherUser',
      'VERSION',
      undefined,
    );
  });

  it('should process DCC chat command', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Freenode',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];

    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );

    await act(async () => {
      await result.current.handleSendMessage('/dcc chat OtherUser');
    });

    expect(dccChatService.initiateChat).toHaveBeenCalled();
  });

  it('should queue message when offline', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
      },
    ];

    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ isConnected: false })),
    );

    await act(async () => {
      await result.current.handleSendMessage('Hello offline');
    });

    expect(offlineQueueService.addMessage).toHaveBeenCalledWith(
      'freenode',
      '#test',
      'Hello offline',
    );
  });

  it('should handle script cancellation', async () => {
    (scriptingService.processOutgoingCommand as jest.Mock).mockReturnValue(
      null,
    );
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
      },
    ];

    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );

    await act(async () => {
      await result.current.handleSendMessage('test message');
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should stop when command service handles slash command internally', async () => {
    mockProcessCommand.mockResolvedValueOnce(null);
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('/quote RAW');
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockSendRaw).not.toHaveBeenCalled();
  });

  it('should report ctcp usage error without target', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Server',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('/ctcp');
    });
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  it('should show alert for ctcp when disconnected', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'OtherUser',
        type: 'query',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ isConnected: false })),
    );
    await act(async () => {
      await result.current.handleSendMessage('/ctcp VERSION');
    });
    expect(mockSafeAlert).toHaveBeenCalledWith(
      'Not Connected',
      'Please connect to a server first',
    );
  });

  it('should process xdcc command', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'BotNick',
        type: 'query',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('/xdcc send');
    });
    expect(mockSendRaw).toHaveBeenCalledWith('PRIVMSG BotNick :XDCC SEND');
  });

  it('should process dcc send with quoted path and custom port', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Server',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage(
        '/dcc send Alice "C:\\\\tmp\\\\file.bin" 9000',
      );
    });
    expect(dccFileService.sendFile).toHaveBeenCalledWith(
      expect.any(Object),
      'Alice',
      'freenode',
      'C:\\\\tmp\\\\file.bin',
      9000,
    );
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notice' }),
    );
  });

  it('should handle dcc send failure', async () => {
    (dccFileService.sendFile as jest.Mock).mockRejectedValueOnce(
      new Error('disk'),
    );
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Server',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('/dcc send Alice /tmp/file.bin');
    });
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  it('should send message in dcc tab and persist it', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Alice',
        type: 'dcc',
        networkId: 'freenode',
        messages: [],
        dccSessionId: 'sess-1',
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('hello dcc');
    });
    expect(dccChatService.sendMessage).toHaveBeenCalledWith(
      'sess-1',
      'hello dcc',
    );
    expect(mockSetTabs).toHaveBeenCalled();
    expect(messageHistoryService.saveMessage).toHaveBeenCalled();
  });

  it('should send encrypted private message when key exists', async () => {
    (
      encryptedDMService.isEncryptedForNetwork as jest.Mock
    ).mockResolvedValueOnce(true);
    (encryptedDMService.encryptForNetwork as jest.Mock).mockResolvedValueOnce({
      c: '1',
    });
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Alice',
        type: 'query',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: true,
        isEncrypted: true,
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('secret');
    });
    expect(mockSendRaw).toHaveBeenCalledWith(
      expect.stringContaining('PRIVMSG Alice :!enc-msg '),
    );
    expect(mockSetTabs).toHaveBeenCalled();
  });

  it('should fall back to plaintext for query when encryption toggle is incomplete', async () => {
    (
      encryptedDMService.isEncryptedForNetwork as jest.Mock
    ).mockResolvedValueOnce(false);
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Alice',
        type: 'query',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: true,
        isEncrypted: false,
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('secret');
    });
    expect(mockSendMessage).toHaveBeenCalledWith('Alice', 'secret');
    expect(mockSendRaw).not.toHaveBeenCalledWith(
      expect.stringContaining('!enc-msg'),
    );
  });

  it('should add error when encrypted private send throws', async () => {
    (
      encryptedDMService.isEncryptedForNetwork as jest.Mock
    ).mockResolvedValueOnce(true);
    (encryptedDMService.encryptForNetwork as jest.Mock).mockRejectedValueOnce(
      new Error('encrypt fail'),
    );
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Alice',
        type: 'query',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: true,
        isEncrypted: true,
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('secret');
    });
    expect(mockSetTabs).toHaveBeenCalled();
  });

  it('should send encrypted channel message when channel key exists', async () => {
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValueOnce(
      true,
    );
    (
      channelEncryptionService.encryptMessage as jest.Mock
    ).mockResolvedValueOnce({ c: 'x' });
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#room',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: true,
        isEncrypted: true,
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('chan secret');
    });
    expect(mockSendRaw).toHaveBeenCalledWith(
      expect.stringContaining('PRIVMSG #room :!chanenc-msg '),
    );
  });

  it('should add channel encryption error when no key exists', async () => {
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValueOnce(
      false,
    );
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#room',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: true,
        isEncrypted: true,
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('chan secret');
    });
    expect(mockSetTabs).toHaveBeenCalled();
  });

  it('should apply decorations when enabled', async () => {
    (settingsService.getSetting as jest.Mock).mockImplementation(
      (key: string, defaultValue: any) => {
        if (key === 'decorEnabled') return Promise.resolve(true);
        return Promise.resolve(defaultValue);
      },
    );
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: false,
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('decor me');
    });
    expect(applyDecoration).toHaveBeenCalled();
  });

  // setTabs mock that actually runs the state updater so the inline
  // prev.map(...) callbacks are exercised for coverage.
  const runningSetTabs = (prev: any[]) =>
    jest.fn((updater: any) =>
      typeof updater === 'function' ? updater(prev) : updater,
    );

  it('falls back to server tab and sends a plain command via sendCommand', async () => {
    mockTabStore.tabs = [
      {
        id: 'other',
        name: 'Freenode',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ activeTabId: 'missing' })),
    );
    await act(async () => {
      await result.current.handleSendMessage('hello world');
    });
    // Covers server-tab non-slash branch -> sendCommand and the
    // active-tab fallback lookup by type === 'server'.
    expect(mockSendCommand).toHaveBeenCalledWith('hello world');
  });

  it('reports xdcc usage error when no target is available', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Server',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('/xdcc');
    });
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  it('shows alert for xdcc when disconnected on a query tab', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'BotNick',
        type: 'query',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ isConnected: false })),
    );
    await act(async () => {
      await result.current.handleSendMessage('/xdcc send');
    });
    expect(mockSafeAlert).toHaveBeenCalledWith(
      'Not Connected',
      'Please connect to a server first',
    );
    expect(mockSendRaw).not.toHaveBeenCalled();
  });

  it('shows alert for dcc when disconnected', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Server',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ isConnected: false })),
    );
    await act(async () => {
      await result.current.handleSendMessage('/dcc chat Alice');
    });
    expect(mockSafeAlert).toHaveBeenCalledWith(
      'Not Connected',
      'Please connect to a server first',
    );
    expect(dccChatService.initiateChat).not.toHaveBeenCalled();
  });

  it('reports dcc usage error with too few arguments', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Server',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('/dcc');
    });
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  it('reports dcc chat usage error without nick', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Server',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('/dcc chat');
    });
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
    expect(dccChatService.initiateChat).not.toHaveBeenCalled();
  });

  it('reports dcc send usage error when path is missing', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Server',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('/dcc send Alice');
    });
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
    expect(dccFileService.sendFile).not.toHaveBeenCalled();
  });

  it('processes dcc send with an unquoted path and trailing port', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Server',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage(
        '/dcc send Alice /tmp/file.bin 8000',
      );
    });
    expect(dccFileService.sendFile).toHaveBeenCalledWith(
      expect.any(Object),
      'Alice',
      'freenode',
      '/tmp/file.bin',
      8000,
    );
  });

  it('reports dcc usage error for an unknown subcommand', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Server',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('/dcc bogus Alice');
    });
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  it('returns silently for a dcc tab without a session id', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Alice',
        type: 'dcc',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('hello');
    });
    expect(dccChatService.sendMessage).not.toHaveBeenCalled();
    expect(mockSetTabs).not.toHaveBeenCalled();
  });

  it('queues offline message and appends a pending message to tabs', async () => {
    const activeTab = {
      id: 'tab-1',
      name: '#test',
      type: 'channel',
      networkId: 'freenode',
      messages: [],
    };
    mockTabStore.tabs = [activeTab];
    const setTabs = runningSetTabs([activeTab, { id: 'other', messages: [] }]);
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ isConnected: false, setTabs })),
    );
    await act(async () => {
      await result.current.handleSendMessage('queued msg');
    });
    expect(offlineQueueService.addMessage).toHaveBeenCalledWith(
      'freenode',
      '#test',
      'queued msg',
    );
    expect(setTabs).toHaveBeenCalled();
    expect(messageHistoryService.saveMessage).toHaveBeenCalled();
  });

  it('appends the encrypted DM message and saves history on success', async () => {
    (
      encryptedDMService.isEncryptedForNetwork as jest.Mock
    ).mockResolvedValueOnce(true);
    (encryptedDMService.encryptForNetwork as jest.Mock).mockResolvedValueOnce({
      c: '1',
    });
    const activeTab = {
      id: 'tab-1',
      name: 'Alice',
      type: 'query',
      networkId: 'freenode',
      messages: [],
      sendEncrypted: true,
      isEncrypted: true,
    };
    mockTabStore.tabs = [activeTab];
    const setTabs = runningSetTabs([activeTab, { id: 'other', messages: [] }]);
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ setTabs })),
    );
    await act(async () => {
      await result.current.handleSendMessage('secret');
    });
    expect(mockSendRaw).toHaveBeenCalledWith(
      expect.stringContaining('PRIVMSG Alice :!enc-msg '),
    );
    expect(setTabs).toHaveBeenCalled();
    expect(messageHistoryService.saveMessage).toHaveBeenCalled();
  });

  it('appends an error message when encrypted DM send throws (running updater)', async () => {
    (
      encryptedDMService.isEncryptedForNetwork as jest.Mock
    ).mockResolvedValueOnce(true);
    (encryptedDMService.encryptForNetwork as jest.Mock).mockRejectedValueOnce(
      new Error('boom'),
    );
    const activeTab = {
      id: 'tab-1',
      name: 'Alice',
      type: 'query',
      networkId: 'freenode',
      messages: [],
      sendEncrypted: true,
      isEncrypted: true,
    };
    mockTabStore.tabs = [activeTab];
    const setTabs = runningSetTabs([activeTab, { id: 'other', messages: [] }]);
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ setTabs })),
    );
    await act(async () => {
      await result.current.handleSendMessage('secret');
    });
    expect(setTabs).toHaveBeenCalled();
    expect(messageHistoryService.saveMessage).toHaveBeenCalled();
  });

  it('appends the encrypted channel message and saves history on success', async () => {
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValueOnce(
      true,
    );
    (
      channelEncryptionService.encryptMessage as jest.Mock
    ).mockResolvedValueOnce({ c: 'x' });
    const activeTab = {
      id: 'tab-1',
      name: '#room',
      type: 'channel',
      networkId: 'freenode',
      messages: [],
      sendEncrypted: true,
      isEncrypted: true,
    };
    mockTabStore.tabs = [activeTab];
    const setTabs = runningSetTabs([activeTab, { id: 'other', messages: [] }]);
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ setTabs })),
    );
    await act(async () => {
      await result.current.handleSendMessage('chan secret');
    });
    expect(mockSendRaw).toHaveBeenCalledWith(
      expect.stringContaining('PRIVMSG #room :!chanenc-msg '),
    );
    expect(setTabs).toHaveBeenCalled();
    expect(messageHistoryService.saveMessage).toHaveBeenCalled();
  });

  it('appends an error message when encrypted channel send throws', async () => {
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValueOnce(
      true,
    );
    (
      channelEncryptionService.encryptMessage as jest.Mock
    ).mockRejectedValueOnce(new Error('chan boom'));
    const activeTab = {
      id: 'tab-1',
      name: '#room',
      type: 'channel',
      networkId: 'freenode',
      messages: [],
      sendEncrypted: true,
      isEncrypted: true,
    };
    mockTabStore.tabs = [activeTab];
    const setTabs = runningSetTabs([activeTab, { id: 'other', messages: [] }]);
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ setTabs })),
    );
    await act(async () => {
      await result.current.handleSendMessage('chan secret');
    });
    expect(mockSendRaw).not.toHaveBeenCalledWith(
      expect.stringContaining('!chanenc-msg'),
    );
    expect(setTabs).toHaveBeenCalled();
    expect(messageHistoryService.saveMessage).toHaveBeenCalled();
  });

  it('appends an error when channel encryption has no key (running updater)', async () => {
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValueOnce(
      false,
    );
    const activeTab = {
      id: 'tab-1',
      name: '#room',
      type: 'channel',
      networkId: 'freenode',
      messages: [],
      sendEncrypted: true,
      isEncrypted: true,
    };
    mockTabStore.tabs = [activeTab];
    const setTabs = runningSetTabs([activeTab, { id: 'other', messages: [] }]);
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ setTabs })),
    );
    await act(async () => {
      await result.current.handleSendMessage('chan secret');
    });
    expect(setTabs).toHaveBeenCalled();
    expect(messageHistoryService.saveMessage).toHaveBeenCalled();
  });

  it('sends with reply tags when a pending reply is present', async () => {
    const mockSendMessageWithTags = jest.fn();
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
      },
    ];
    setPendingReply({ msgid: 'abc123', target: '#test', nick: 'Bob' });
    const { result } = await renderHook(() =>
      useMessageSending(
        createMockParams({
          getActiveIRCService: jest.fn().mockReturnValue({
            sendMessage: mockSendMessage,
            sendMessageWithTags: mockSendMessageWithTags,
            addMessage: mockAddMessage,
            getNetworkName: jest.fn().mockReturnValue('freenode'),
          }),
        }),
      ),
    );
    await act(async () => {
      await result.current.handleSendMessage('reply body');
    });
    expect(mockSendMessageWithTags).toHaveBeenCalledWith(
      '#test',
      'reply body',
      {
        replyTo: 'abc123',
      },
    );
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('reports dcc send usage error for an empty quoted path', async () => {
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Server',
        type: 'server',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('/dcc send Alice "" 9000');
    });
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
    expect(dccFileService.sendFile).not.toHaveBeenCalled();
  });

  it('appends dcc-tab message via updater and logs when history save fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (messageHistoryService.saveMessage as jest.Mock).mockRejectedValueOnce(
      new Error('db'),
    );
    const activeTab = {
      id: 'tab-1',
      name: 'Alice',
      type: 'dcc',
      networkId: 'freenode',
      messages: [],
      dccSessionId: 'sess-1',
    };
    mockTabStore.tabs = [activeTab];
    const setTabs = runningSetTabs([activeTab, { id: 'other', messages: [] }]);
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ setTabs })),
    );
    await act(async () => {
      await result.current.handleSendMessage('hello dcc');
      await new Promise(r => setImmediate(r));
    });
    expect(dccChatService.sendMessage).toHaveBeenCalledWith(
      'sess-1',
      'hello dcc',
    );
    expect(setTabs).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs when saving an offline pending message fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (messageHistoryService.saveMessage as jest.Mock).mockRejectedValueOnce(
      new Error('db'),
    );
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams({ isConnected: false })),
    );
    await act(async () => {
      await result.current.handleSendMessage('queued');
      await new Promise(r => setImmediate(r));
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs when saving an encrypted DM to history fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (
      encryptedDMService.isEncryptedForNetwork as jest.Mock
    ).mockResolvedValueOnce(true);
    (encryptedDMService.encryptForNetwork as jest.Mock).mockResolvedValueOnce({
      c: '1',
    });
    (messageHistoryService.saveMessage as jest.Mock).mockRejectedValueOnce(
      new Error('db'),
    );
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Alice',
        type: 'query',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: true,
        isEncrypted: true,
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('secret');
      await new Promise(r => setImmediate(r));
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs when saving an encrypted DM error message to history fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (
      encryptedDMService.isEncryptedForNetwork as jest.Mock
    ).mockResolvedValueOnce(true);
    (encryptedDMService.encryptForNetwork as jest.Mock).mockRejectedValueOnce(
      new Error('boom'),
    );
    (messageHistoryService.saveMessage as jest.Mock).mockRejectedValueOnce(
      new Error('db'),
    );
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: 'Alice',
        type: 'query',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: true,
        isEncrypted: true,
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('secret');
      await new Promise(r => setImmediate(r));
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs when saving an encrypted channel message to history fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValueOnce(
      true,
    );
    (
      channelEncryptionService.encryptMessage as jest.Mock
    ).mockResolvedValueOnce({ c: 'x' });
    (messageHistoryService.saveMessage as jest.Mock).mockRejectedValueOnce(
      new Error('db'),
    );
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#room',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: true,
        isEncrypted: true,
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('chan secret');
      await new Promise(r => setImmediate(r));
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs when saving a channel encryption error message to history fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValueOnce(
      true,
    );
    (
      channelEncryptionService.encryptMessage as jest.Mock
    ).mockRejectedValueOnce(new Error('chan boom'));
    (messageHistoryService.saveMessage as jest.Mock).mockRejectedValueOnce(
      new Error('db'),
    );
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#room',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: true,
        isEncrypted: true,
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('chan secret');
      await new Promise(r => setImmediate(r));
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs when saving a channel no-key error message to history fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValueOnce(
      false,
    );
    (messageHistoryService.saveMessage as jest.Mock).mockRejectedValueOnce(
      new Error('db'),
    );
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#room',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
        sendEncrypted: true,
        isEncrypted: true,
      },
    ];
    const { result } = await renderHook(() =>
      useMessageSending(createMockParams()),
    );
    await act(async () => {
      await result.current.handleSendMessage('chan secret');
      await new Promise(r => setImmediate(r));
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
