/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useMessageSending hook - Wave 4
 */

import { renderHook, act, cleanup } from '@testing-library/react-hooks';

// Mock tab store
const mockTabStore = {
  tabs: [],
};

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: Object.assign(
    jest.fn((selector) => selector(mockTabStore)),
    { getState: jest.fn(() => mockTabStore) }
  ),
}));

// Mock dependencies
jest.mock('../../src/services/ScriptingService', () => ({
  scriptingService: {
    processOutgoingCommand: jest.fn().mockImplementation((cmd) => cmd),
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
  applyDecoration: jest.fn().mockImplementation((text) => text),
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

describe('useMessageSending', () => {
  const mockSetTabs = jest.fn();
  const mockSafeAlert = jest.fn();
  const mockT = jest.fn((key: string) => key);
  const mockSendMessage = jest.fn();
  const mockSendCommand = jest.fn();
  const mockSendRaw = jest.fn();
  const mockSendCTCPRequest = jest.fn();
  const mockAddMessage = jest.fn();
  const mockProcessCommand = jest.fn().mockImplementation((cmd) => Promise.resolve(cmd));

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

  beforeEach(() => {
    jest.clearAllMocks();
    mockTabStore.tabs = [];
    (scriptingService.processOutgoingCommand as jest.Mock).mockImplementation((cmd: string) => cmd);
    (settingsService.getSetting as jest.Mock).mockImplementation((key: string, defaultValue: any) => {
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
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should return handleSendMessage function', () => {
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    expect(result.current.handleSendMessage).toBeDefined();
    expect(typeof result.current.handleSendMessage).toBe('function');
  });

  it('should not send message when no valid tab exists', async () => {
    mockTabStore.tabs = [];

    const { result } = renderHook(() => useMessageSending(createMockParams()));

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

    const { result } = renderHook(() => useMessageSending(createMockParams()));

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

    const { result } = renderHook(() => useMessageSending(createMockParams()));

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

    const { result } = renderHook(() => useMessageSending(createMockParams({ isConnected: false })));

    await act(async () => {
      await result.current.handleSendMessage('/join #test');
    });

    expect(mockSafeAlert).toHaveBeenCalledWith(
      'Not Connected',
      'Please connect to a server first'
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

    const { result } = renderHook(() => useMessageSending(createMockParams()));

    await act(async () => {
      await result.current.handleSendMessage('/ctcp OtherUser VERSION');
    });

    expect(mockSendCTCPRequest).toHaveBeenCalledWith('OtherUser', 'VERSION', undefined);
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

    const { result } = renderHook(() => useMessageSending(createMockParams()));

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

    const { result } = renderHook(() => useMessageSending(createMockParams({ isConnected: false })));

    await act(async () => {
      await result.current.handleSendMessage('Hello offline');
    });

    expect(offlineQueueService.addMessage).toHaveBeenCalledWith('freenode', '#test', 'Hello offline');
  });

  it('should handle script cancellation', async () => {
    (scriptingService.processOutgoingCommand as jest.Mock).mockReturnValue(null);
    mockTabStore.tabs = [
      {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
        messages: [],
      },
    ];

    const { result } = renderHook(() => useMessageSending(createMockParams()));

    await act(async () => {
      await result.current.handleSendMessage('test message');
    });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should stop when command service handles slash command internally', async () => {
    mockProcessCommand.mockResolvedValueOnce(null);
    mockTabStore.tabs = [
      { id: 'tab-1', name: '#test', type: 'channel', networkId: 'freenode', messages: [] },
    ];
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('/quote RAW');
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockSendRaw).not.toHaveBeenCalled();
  });

  it('should report ctcp usage error without target', async () => {
    mockTabStore.tabs = [
      { id: 'tab-1', name: 'Server', type: 'server', networkId: 'freenode', messages: [] },
    ];
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('/ctcp');
    });
    expect(mockAddMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('should show alert for ctcp when disconnected', async () => {
    mockTabStore.tabs = [
      { id: 'tab-1', name: 'OtherUser', type: 'query', networkId: 'freenode', messages: [] },
    ];
    const { result } = renderHook(() => useMessageSending(createMockParams({ isConnected: false })));
    await act(async () => {
      await result.current.handleSendMessage('/ctcp VERSION');
    });
    expect(mockSafeAlert).toHaveBeenCalledWith('Not Connected', 'Please connect to a server first');
  });

  it('should process xdcc command', async () => {
    mockTabStore.tabs = [
      { id: 'tab-1', name: 'BotNick', type: 'query', networkId: 'freenode', messages: [] },
    ];
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('/xdcc send');
    });
    expect(mockSendRaw).toHaveBeenCalledWith('PRIVMSG BotNick :XDCC SEND');
  });

  it('should process dcc send with quoted path and custom port', async () => {
    mockTabStore.tabs = [
      { id: 'tab-1', name: 'Server', type: 'server', networkId: 'freenode', messages: [] },
    ];
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('/dcc send Alice "C:\\\\tmp\\\\file.bin" 9000');
    });
    expect(dccFileService.sendFile).toHaveBeenCalledWith(expect.any(Object), 'Alice', 'freenode', 'C:\\\\tmp\\\\file.bin', 9000);
    expect(mockAddMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'notice' }));
  });

  it('should handle dcc send failure', async () => {
    (dccFileService.sendFile as jest.Mock).mockRejectedValueOnce(new Error('disk'));
    mockTabStore.tabs = [
      { id: 'tab-1', name: 'Server', type: 'server', networkId: 'freenode', messages: [] },
    ];
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('/dcc send Alice /tmp/file.bin');
    });
    expect(mockAddMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('should send message in dcc tab and persist it', async () => {
    mockTabStore.tabs = [
      { id: 'tab-1', name: 'Alice', type: 'dcc', networkId: 'freenode', messages: [], dccSessionId: 'sess-1' },
    ];
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('hello dcc');
    });
    expect(dccChatService.sendMessage).toHaveBeenCalledWith('sess-1', 'hello dcc');
    expect(mockSetTabs).toHaveBeenCalled();
    expect(messageHistoryService.saveMessage).toHaveBeenCalled();
  });

  it('should send encrypted private message when key exists', async () => {
    (encryptedDMService.isEncryptedForNetwork as jest.Mock).mockResolvedValueOnce(true);
    (encryptedDMService.encryptForNetwork as jest.Mock).mockResolvedValueOnce({ c: '1' });
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
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('secret');
    });
    expect(mockSendRaw).toHaveBeenCalledWith(expect.stringContaining('PRIVMSG Alice :!enc-msg '));
    expect(mockSetTabs).toHaveBeenCalled();
  });

  it('should fall back to plaintext for query when encryption toggle is incomplete', async () => {
    (encryptedDMService.isEncryptedForNetwork as jest.Mock).mockResolvedValueOnce(false);
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
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('secret');
    });
    expect(mockSendMessage).toHaveBeenCalledWith('Alice', 'secret');
    expect(mockSendRaw).not.toHaveBeenCalledWith(expect.stringContaining('!enc-msg'));
  });

  it('should add error when encrypted private send throws', async () => {
    (encryptedDMService.isEncryptedForNetwork as jest.Mock).mockResolvedValueOnce(true);
    (encryptedDMService.encryptForNetwork as jest.Mock).mockRejectedValueOnce(new Error('encrypt fail'));
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
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('secret');
    });
    expect(mockSetTabs).toHaveBeenCalled();
  });

  it('should send encrypted channel message when channel key exists', async () => {
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValueOnce(true);
    (channelEncryptionService.encryptMessage as jest.Mock).mockResolvedValueOnce({ c: 'x' });
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
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('chan secret');
    });
    expect(mockSendRaw).toHaveBeenCalledWith(expect.stringContaining('PRIVMSG #room :!chanenc-msg '));
  });

  it('should add channel encryption error when no key exists', async () => {
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValueOnce(false);
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
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('chan secret');
    });
    expect(mockSetTabs).toHaveBeenCalled();
  });

  it('should apply decorations when enabled', async () => {
    (settingsService.getSetting as jest.Mock).mockImplementation((key: string, defaultValue: any) => {
      if (key === 'decorEnabled') return Promise.resolve(true);
      return Promise.resolve(defaultValue);
    });
    mockTabStore.tabs = [
      { id: 'tab-1', name: '#test', type: 'channel', networkId: 'freenode', messages: [], sendEncrypted: false },
    ];
    const { result } = renderHook(() => useMessageSending(createMockParams()));
    await act(async () => {
      await result.current.handleSendMessage('decor me');
    });
    expect(applyDecoration).toHaveBeenCalled();
  });
});
