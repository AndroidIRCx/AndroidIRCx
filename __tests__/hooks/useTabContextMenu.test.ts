/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useTabContextMenu hook - Wave 4
 */

import { renderHook, act, cleanup } from '@testing-library/react-native';

// Mock dependencies
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: jest.fn(),
    disconnect: jest.fn(),
    getActiveNetworkId: jest.fn().mockReturnValue('freenode'),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: jest.fn().mockResolvedValue([]),
    getSetting: jest
      .fn()
      .mockImplementation((_key: string, defaultValue: any) =>
        Promise.resolve(defaultValue),
      ),
  },
  DEFAULT_PART_MESSAGE: 'Leaving',
}));

jest.mock('../../src/services/TabService', () => ({
  tabService: {
    saveTabs: jest.fn().mockResolvedValue(undefined),
    removeTab: jest.fn(),
  },
}));

jest.mock('../../src/services/ChannelNotesService', () => ({
  channelNotesService: {
    isBookmarked: jest.fn().mockResolvedValue(false),
    setBookmarked: jest.fn().mockResolvedValue(undefined),
    getNote: jest.fn().mockResolvedValue(''),
    getLog: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/services/ChannelFavoritesService', () => ({
  channelFavoritesService: {
    isFavorite: jest.fn().mockResolvedValue(false),
    addFavorite: jest.fn().mockResolvedValue(undefined),
    removeFavorite: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/ChannelEncryptionService', () => ({
  channelEncryptionService: {
    hasChannelKey: jest.fn().mockResolvedValue(false),
    generateChannelKey: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/ChannelEncryptionSettingsService', () => ({
  channelEncryptionSettingsService: {
    getAlwaysEncrypt: jest.fn().mockResolvedValue(false),
    toggleAlwaysEncrypt: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    isEncryptedForNetwork: jest.fn().mockResolvedValue(false),
    exportBundle: jest.fn().mockResolvedValue({ key: 'test' }),
  },
}));

jest.mock('../../src/services/DCCChatService', () => ({
  dccChatService: {
    initiateChat: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/ServiceCommandProvider', () => ({
  serviceCommandProvider: {
    getServiceCommands: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../src/services/CertificateManagerService', () => ({
  certificateManager: {
    extractFingerprintFromPem: jest.fn().mockReturnValue('fingerprint'),
    formatFingerprint: jest.fn().mockReturnValue('formatted-fingerprint'),
  },
}));

// Mock UI Store
const mockUIStore = {
  setShowTabOptionsModal: jest.fn(),
  setTabOptions: jest.fn(),
  setTabOptionsTitle: jest.fn(),
  setShowChannelList: jest.fn(),
  setShowNetworksList: jest.fn(),
  setRenameTargetTabId: jest.fn(),
  setRenameValue: jest.fn(),
  setShowRenameModal: jest.fn(),
  setWhoisNick: jest.fn(),
  setShowWHOIS: jest.fn(),
  setDccSendTarget: jest.fn(),
  setShowDccSendModal: jest.fn(),
  setShowBlacklist: jest.fn(),
  setBlacklistTarget: jest.fn(),
  setChannelSettingsTarget: jest.fn(),
  setChannelSettingsNetwork: jest.fn(),
  setShowChannelSettings: jest.fn(),
  setChannelNoteTarget: jest.fn(),
  setChannelNoteValue: jest.fn(),
  setShowChannelNoteModal: jest.fn(),
  setChannelLogEntries: jest.fn(),
  setShowChannelLogModal: jest.fn(),
};

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: Object.assign(
    jest.fn(selector => selector(mockUIStore)),
    { getState: jest.fn(() => mockUIStore) },
  ),
}));

import { useTabContextMenu } from '../../src/hooks/useTabContextMenu';
import { connectionManager } from '../../src/services/ConnectionManager';
import { settingsService } from '../../src/services/SettingsService';
import { channelNotesService } from '../../src/services/ChannelNotesService';
import { channelFavoritesService } from '../../src/services/ChannelFavoritesService';
import Clipboard from '@react-native-clipboard/clipboard';
import { Alert } from 'react-native';

describe('useTabContextMenu', () => {
  const mockSetTabs = jest.fn();
  const mockSetActiveTabId = jest.fn();
  const mockSetNetworkName = jest.fn();
  const mockSetActiveConnectionId = jest.fn();
  const mockHandleConnect = jest.fn().mockResolvedValue(undefined);
  const mockCloseAllChannelsAndQueries = jest.fn().mockResolvedValue(undefined);
  const mockGetNetworkConfigForId = jest.fn().mockResolvedValue(null);
  const mockGetActiveIRCService = jest.fn().mockReturnValue({
    getCurrentNick: jest.fn().mockReturnValue('TestNick'),
    sendCommand: jest.fn(),
    sendMessage: jest.fn(),
    sendRaw: jest.fn(),
    addMessage: jest.fn(),
  });
  const mockGetActiveUserManagementService = jest.fn().mockReturnValue({
    ignoreUser: jest.fn().mockResolvedValue(undefined),
  });
  const mockSafeAlert = jest.fn();
  const mockT = jest.fn((key: string) => key);

  const defaultParams = {
    activeTabId: 'tab-1',
    getNetworkConfigForId: mockGetNetworkConfigForId,
    getActiveIRCService: mockGetActiveIRCService,
    getActiveUserManagementService: mockGetActiveUserManagementService,
    handleConnect: mockHandleConnect,
    closeAllChannelsAndQueries: mockCloseAllChannelsAndQueries,
    normalizeNetworkId: (id: string) => id,
    primaryNetworkId: 'freenode',
    safeAlert: mockSafeAlert,
    t: mockT,
    setTabs: mockSetTabs,
    setActiveTabId: mockSetActiveTabId,
    setNetworkName: mockSetNetworkName,
    setActiveConnectionId: mockSetActiveConnectionId,
    tabSortAlphabetical: false,
    ircService: mockGetActiveIRCService(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset UI store mocks
    Object.values(mockUIStore).forEach((fn: any) => fn.mockClear?.());

    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('TestNick'),
        sendCommand: jest.fn(),
        sendMessage: jest.fn(),
        sendRaw: jest.fn(),
        sendSilentMode: jest.fn(),
        addMessage: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(false),
      },
    });
  });

  afterEach(async () => {
    cleanup();
  });

  it('should return handleTabLongPress function', async () => {
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    expect(result.current.handleTabLongPress).toBeDefined();
    expect(typeof result.current.handleTabLongPress).toBe('function');
  });

  it('should handle server tab long press for connected server', async () => {
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));

    const serverTab = {
      id: 'server-freenode',
      name: 'Freenode',
      type: 'server' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
    };

    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });

    expect(connectionManager.getConnection).toHaveBeenCalledWith('freenode');
  });

  it('should handle server tab long press for disconnected server', async () => {
    (connectionManager.getConnection as jest.Mock).mockReturnValue(null);

    const { result } = await renderHook(() => useTabContextMenu(defaultParams));

    const serverTab = {
      id: 'server-freenode',
      name: 'Freenode',
      type: 'server' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
    };

    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });

    expect(mockT).toHaveBeenCalledWith('Connect {network}', {
      network: 'freenode',
    });
  });

  it('should handle channel tab long press', async () => {
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));

    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };

    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });

    expect(channelNotesService.isBookmarked).toHaveBeenCalledWith(
      'freenode',
      '#test',
    );
    expect(channelFavoritesService.isFavorite).toHaveBeenCalledWith(
      'freenode',
      '#test',
    );
  });

  it('should handle query tab long press', async () => {
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));

    const queryTab = {
      id: 'query-1',
      name: 'OtherUser',
      type: 'query' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };

    await act(async () => {
      await result.current.handleTabLongPress(queryTab);
    });

    expect(mockT).toHaveBeenCalledWith('Close Query');
  });

  it('should handle channel with encryption enabled', async () => {
    const {
      channelEncryptionService,
    } = require('../../src/services/ChannelEncryptionService');
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValue(
      true,
    );

    const { result } = await renderHook(() => useTabContextMenu(defaultParams));

    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: true,
    };

    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });

    expect(mockT).toHaveBeenCalledWith('Send Plaintext (Unlock)');
  });

  it('should handle oper commands for server oper', async () => {
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('OperNick'),
        sendCommand: jest.fn(),
        sendSilentMode: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(true),
      },
    });

    const { result } = await renderHook(() => useTabContextMenu(defaultParams));

    const serverTab = {
      id: 'server-freenode',
      name: 'Freenode',
      type: 'server' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
    };

    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });

    expect(mockT).toHaveBeenCalledWith('IRCop Commands');
  });

  it('executes server disconnected connect action and shows missing network alert', async () => {
    (connectionManager.getConnection as jest.Mock).mockReturnValue(null);
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const serverTab = {
      id: 'server-freenode',
      name: 'Freenode',
      type: 'server' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
    };

    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    const options = (mockUIStore.setTabOptions as jest.Mock).mock.calls.slice(
      -1,
    )[0][0];
    const connectOption = options.find((o: any) =>
      String(o.text).includes('Connect {network}'),
    );
    expect(connectOption).toBeDefined();

    await act(async () => {
      await connectOption.onPress();
    });
    expect(mockSafeAlert).toHaveBeenCalled();
  });

  it('executes server connected actions: disconnect, browse channels, close all', async () => {
    const disconnectMock = jest.fn();
    (connectionManager.disconnect as jest.Mock) = disconnectMock as any;
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const serverTab = {
      id: 'server-freenode',
      name: 'Freenode',
      type: 'server' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
    };

    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    const options = (mockUIStore.setTabOptions as jest.Mock).mock.calls.slice(
      -1,
    )[0][0];
    await act(async () => {
      await options
        .find((o: any) => String(o.text).includes('Disconnect'))
        .onPress();
      await options
        .find((o: any) => String(o.text).includes('Browse Channels'))
        .onPress();
      await options
        .find((o: any) => String(o.text).includes('Close All Channels + PVTS'))
        .onPress();
    });
    expect(connectionManager.disconnect).toHaveBeenCalledWith('freenode');
    expect(mockUIStore.setShowChannelList).toHaveBeenCalledWith(true);
    expect(mockCloseAllChannelsAndQueries).toHaveBeenCalledWith('freenode');
  });

  it('executes channel options: leave, bookmark toggle, note and log modals', async () => {
    const activeIRC = {
      partChannel: jest.fn(),
      addMessage: jest.fn(),
      sendCommand: jest.fn(),
      sendRaw: jest.fn(),
    };
    const { result } = await renderHook(() =>
      useTabContextMenu({
        ...defaultParams,
        getActiveIRCService: jest.fn().mockReturnValue(activeIRC),
      }),
    );
    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    (channelNotesService.getLog as jest.Mock).mockResolvedValue([
      { timestamp: 2 },
      { timestamp: 1 },
    ]);

    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    const options = (mockUIStore.setTabOptions as jest.Mock).mock.calls.slice(
      -1,
    )[0][0];
    const byText = (label: string) =>
      options.find((o: any) => String(o.text).includes(label));

    await act(async () => {
      await byText('Leave Channel').onPress();
      await byText('Bookmark Channel').onPress();
      await byText('Edit Channel Note').onPress();
      await byText('View Activity Log').onPress();
    });

    expect(activeIRC.partChannel).toHaveBeenCalled();
    expect(channelNotesService.setBookmarked).toHaveBeenCalled();
    expect(mockUIStore.setShowChannelNoteModal).toHaveBeenCalledWith(true);
    expect(mockUIStore.setShowChannelLogModal).toHaveBeenCalledWith(true);
  });

  it('executes query options: whois, dcc, ignore and blacklist', async () => {
    const ignoreUser = jest.fn().mockResolvedValue(undefined);
    const { dccChatService } = require('../../src/services/DCCChatService');
    const { result } = await renderHook(() =>
      useTabContextMenu({
        ...defaultParams,
        getActiveUserManagementService: jest
          .fn()
          .mockReturnValue({ ignoreUser }),
      }),
    );
    const queryTab = {
      id: 'query-1',
      name: 'OtherUser',
      type: 'query' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };

    await act(async () => {
      await result.current.handleTabLongPress(queryTab);
    });
    const options = (mockUIStore.setTabOptions as jest.Mock).mock.calls.slice(
      -1,
    )[0][0];
    const byText = (label: string) =>
      options.find((o: any) => String(o.text).includes(label));

    await act(async () => {
      byText('WHOIS').onPress();
      byText('Start DCC Chat').onPress();
      byText('Offer DCC Send').onPress();
      await byText('Ignore User').onPress();
      byText('Blacklist').onPress();
    });

    expect(mockUIStore.setShowWHOIS).toHaveBeenCalledWith(true);
    expect(dccChatService.initiateChat).toHaveBeenCalled();
    expect(mockUIStore.setShowDccSendModal).toHaveBeenCalledWith(true);
    expect(ignoreUser).toHaveBeenCalledWith('OtherUser', undefined, 'freenode');
    expect(mockUIStore.setShowBlacklist).toHaveBeenCalledWith(true);
  });

  it('handles certificate actions on server tab (view/share)', async () => {
    const sendRaw = jest.fn();
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('TestNick'),
        sendCommand: jest.fn(),
        sendSilentMode: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(false),
        sendRaw,
      },
    });
    mockGetNetworkConfigForId.mockResolvedValueOnce({ clientCert: 'PEM_CERT' });

    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const serverTab = {
      id: 'server-freenode',
      name: 'Freenode',
      type: 'server' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
    };

    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });

    const options = (mockUIStore.setTabOptions as jest.Mock).mock.calls.slice(
      -1,
    )[0][0];
    const view = options.find((o: any) =>
      String(o.text).includes('View Certificate Fingerprint'),
    );
    const share = options.find((o: any) =>
      String(o.text).includes('Share Cert with NickServ'),
    );

    await act(async () => {
      await view.onPress();
    });
    const viewAlertButtons =
      mockSafeAlert.mock.calls.find((c: any[]) =>
        String(c[0]).includes('Certificate Fingerprint'),
      )?.[2] || [];
    viewAlertButtons[0]?.onPress?.();
    viewAlertButtons[1]?.onPress?.();
    expect(Clipboard.setString).toHaveBeenCalled();

    await act(async () => {
      await share.onPress();
    });
    expect(sendRaw).toHaveBeenCalledWith(
      expect.stringContaining('PRIVMSG NickServ :CERT ADD'),
    );
  });

  it('connects server tab when disconnected and saved config exists', async () => {
    (connectionManager.getConnection as jest.Mock).mockReturnValue(null);
    mockGetNetworkConfigForId.mockResolvedValueOnce({
      id: 'freenode',
      name: 'freenode',
    });
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const serverTab = {
      id: 'server-freenode',
      name: 'Freenode',
      type: 'server' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
    };

    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    const options = (mockUIStore.setTabOptions as jest.Mock).mock.calls.slice(
      -1,
    )[0][0];
    const connectOption = options.find((o: any) =>
      String(o.text).includes('Connect {network}'),
    );
    await act(async () => {
      await connectOption.onPress();
    });
    expect(mockHandleConnect).toHaveBeenCalled();
  });

  it('closes server tab when no favorite/default server exists', async () => {
    (settingsService.loadNetworks as jest.Mock).mockResolvedValueOnce([
      { id: 'freenode', name: 'freenode', servers: [] },
    ]);
    const { tabService } = require('../../src/services/TabService');
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const serverTab = {
      id: 'server-freenode',
      name: 'Freenode',
      type: 'server' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
    };

    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    const options = (mockUIStore.setTabOptions as jest.Mock).mock.calls.slice(
      -1,
    )[0][0];
    const closeServer = options.find((o: any) =>
      String(o.text).includes('Close Server Tab'),
    );
    await act(async () => {
      await closeServer.onPress();
    });
    expect(tabService.saveTabs).toHaveBeenCalledWith('freenode', []);
    expect(mockSetTabs).toHaveBeenCalled();
  });

  it('opens IRCop menu and executes STATS/REHASH command flows', async () => {
    const sendCommand = jest.fn();
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('OperNick'),
        sendCommand,
        sendSilentMode: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(true),
      },
    });
    (Alert as any).prompt = jest.fn(
      (_title: string, _msg: string, buttons: any[]) =>
        buttons[1]?.onPress?.('u'),
    );

    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const serverTab = {
      id: 'server-freenode',
      name: 'Freenode',
      type: 'server' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
    };

    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    const rootOptions = (
      mockUIStore.setTabOptions as jest.Mock
    ).mock.calls.slice(-1)[0][0];
    await act(async () => {
      rootOptions
        .find((o: any) => String(o.text).includes('IRCop Commands'))
        .onPress();
    });
    const operOptions = (
      mockUIStore.setTabOptions as jest.Mock
    ).mock.calls.slice(-1)[0][0];
    operOptions.find((o: any) => o.text === 'STATS').onPress();
    operOptions.find((o: any) => o.text === 'REHASH').onPress();
    const rehashButtons =
      mockSafeAlert.mock.calls.find((c: any[]) => c[0] === 'REHASH')?.[2] || [];
    rehashButtons[1]?.onPress?.();
    expect(sendCommand).toHaveBeenCalledWith('STATS u');
    expect(sendCommand).toHaveBeenCalledWith('REHASH');
  });

  it('handles query close/share/request/encryption toggles and whowas', async () => {
    const activeIRC = {
      sendRaw: jest.fn(),
      addMessage: jest.fn(),
      sendCommand: jest.fn(),
    };
    const connIrc = {
      getConnectionStatus: jest.fn().mockReturnValue(true),
      getCurrentNick: jest.fn().mockReturnValue('TestNick'),
      sendCommand: jest.fn(),
      sendRaw: jest.fn(),
      sendSilentMode: jest.fn(),
      addMessage: jest.fn(),
      isServerOper: jest.fn().mockReturnValue(false),
    };
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: connIrc,
    });
    const {
      encryptedDMService,
    } = require('../../src/services/EncryptedDMService');
    const {
      channelEncryptionSettingsService,
    } = require('../../src/services/ChannelEncryptionSettingsService');
    const { tabService } = require('../../src/services/TabService');
    (settingsService.getSetting as jest.Mock).mockImplementation(
      (key: string, defaultValue: any) => {
        if (key === 'closePrivateMessage') return Promise.resolve(true);
        if (key === 'ircServices') return Promise.resolve(['nickserv']);
        if (key === 'closePrivateMessageText') return Promise.resolve('Bye');
        return Promise.resolve(defaultValue);
      },
    );
    encryptedDMService.exportBundle.mockRejectedValueOnce(new Error('no key'));
    encryptedDMService.isEncryptedForNetwork
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    channelEncryptionSettingsService.getAlwaysEncrypt.mockResolvedValue(false);

    const { result } = await renderHook(() =>
      useTabContextMenu({
        ...defaultParams,
        getActiveIRCService: jest.fn().mockReturnValue(activeIRC),
      }),
    );
    const queryTab = {
      id: 'query-1',
      name: 'OtherUser',
      type: 'query' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };

    await act(async () => {
      await result.current.handleTabLongPress(queryTab);
    });
    const options = (mockUIStore.setTabOptions as jest.Mock).mock.calls.slice(
      -1,
    )[0][0];
    const byText = (label: string) =>
      options.find((o: any) => String(o.text).includes(label));

    await act(async () => {
      await byText('Close Query').onPress();
      await byText('Share DM Key').onPress();
      byText('Request DM Key').onPress();
      await byText('Send Encrypted (Lock)').onPress();
      await byText('WHOWAS').onPress();
    });

    expect(tabService.removeTab).toHaveBeenCalledWith('freenode', 'query-1');
    expect(activeIRC.sendRaw).toHaveBeenCalledWith('PRIVMSG OtherUser :Bye');
    expect(connIrc.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
    expect(connIrc.sendRaw).toHaveBeenCalledWith('PRIVMSG OtherUser :!enc-req');
    expect(connIrc.sendCommand).toHaveBeenCalledWith('WHOWAS OtherUser');
  });

  it('handles channel encryption toggle/prompt and favorites add-remove', async () => {
    const activeIRC = {
      partChannel: jest.fn(),
      addMessage: jest.fn(),
      sendCommand: jest.fn(),
      sendMessage: jest.fn(),
      sendRaw: jest.fn(),
    };
    const connIrc = {
      getConnectionStatus: jest.fn().mockReturnValue(true),
      getCurrentNick: jest.fn().mockReturnValue('TestNick'),
      sendCommand: jest.fn(),
      sendMessage: jest.fn(),
      sendRaw: jest.fn(),
      sendSilentMode: jest.fn(),
      addMessage: jest.fn(),
      isServerOper: jest.fn().mockReturnValue(false),
    };
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: connIrc,
    });
    const {
      channelEncryptionService,
    } = require('../../src/services/ChannelEncryptionService');
    const {
      channelEncryptionSettingsService,
    } = require('../../src/services/ChannelEncryptionSettingsService');
    const {
      serviceCommandProvider,
    } = require('../../src/services/ServiceCommandProvider');
    (Alert as any).alert = jest.fn();
    (Alert as any).prompt = jest.fn(
      (_title: string, _msg: string, buttons: any[]) =>
        buttons[1]?.onPress?.('Alice'),
    );
    channelEncryptionSettingsService.getAlwaysEncrypt.mockResolvedValue(false);
    channelEncryptionSettingsService.toggleAlwaysEncrypt.mockResolvedValue(
      true,
    );
    channelEncryptionService.hasChannelKey
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    serviceCommandProvider.getServiceCommands.mockReturnValue([
      { service: 'ChanServ' },
    ]);

    const { result } = await renderHook(() =>
      useTabContextMenu({
        ...defaultParams,
        getActiveIRCService: jest.fn().mockReturnValue(activeIRC),
      }),
    );
    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };

    (channelFavoritesService.isFavorite as jest.Mock).mockResolvedValueOnce(
      false,
    );
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    let options = (mockUIStore.setTabOptions as jest.Mock).mock.calls.slice(
      -1,
    )[0][0];
    const byText = (label: string) =>
      options.find((o: any) => String(o.text).includes(label));

    await act(async () => {
      await byText('Always Encrypt').onPress();
      byText('Request Encryption Key').onPress();
      await byText('Add to Favorites').onPress();
      byText('IRC Services').onPress();
    });
    expect((Alert as any).alert).toHaveBeenCalled();
    expect(connIrc.sendMessage).toHaveBeenCalledWith(
      '#test',
      '/chankey request Alice',
    );
    expect(channelFavoritesService.addFavorite).toHaveBeenCalledWith(
      'freenode',
      '#test',
    );

    const serviceOptions = (
      mockUIStore.setTabOptions as jest.Mock
    ).mock.calls.slice(-1)[0][0];
    serviceOptions.find((o: any) => String(o.text).includes('INFO')).onPress();
    expect(connIrc.sendRaw).toHaveBeenCalledWith(
      'PRIVMSG ChanServ :INFO #test',
    );

    (channelFavoritesService.isFavorite as jest.Mock).mockResolvedValueOnce(
      true,
    );
    channelEncryptionService.hasChannelKey.mockReset();
    channelEncryptionService.hasChannelKey.mockResolvedValue(true);
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    options = (mockUIStore.setTabOptions as jest.Mock).mock.calls.slice(
      -1,
    )[0][0];
    expect(
      options.some((o: any) => String(o.text).includes('Share Encryption Key')),
    ).toBe(true);
    await act(async () => {
      await options
        .find((o: any) => String(o.text).includes('Share Encryption Key'))
        .onPress();
      await options
        .find((o: any) => String(o.text).includes('Remove from Favorites'))
        .onPress();
    });
    expect(connIrc.sendMessage).toHaveBeenCalledWith(
      '#test',
      '/chankey share Alice',
    );
    expect(channelFavoritesService.removeFavorite).toHaveBeenCalledWith(
      'freenode',
      '#test',
    );
  });

  it('ignores stale async tab menu builds when the user long-presses another tab', async () => {
    let resolveFirstConfig: (value: any) => void = () => {};
    mockGetNetworkConfigForId
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirstConfig = resolve;
          }),
      )
      .mockResolvedValueOnce(null);

    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const firstTab = {
      id: 'server-freenode',
      name: 'Freenode',
      type: 'server' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
    };
    const secondTab = {
      id: 'server-oftc',
      name: 'OFTC',
      type: 'server' as const,
      networkId: 'oftc',
      messages: [],
      unreadCount: 0,
    };

    await act(() => {
      result.current.handleTabLongPress(firstTab);
    });
    await act(async () => {
      await result.current.handleTabLongPress(secondTab);
    });
    const callsAfterSecond = (mockUIStore.setTabOptionsTitle as jest.Mock).mock
      .calls.length;

    await act(async () => {
      resolveFirstConfig({ id: 'freenode', name: 'Freenode' });
      await Promise.resolve();
    });

    expect(
      (mockUIStore.setTabOptionsTitle as jest.Mock).mock.calls.length,
    ).toBe(callsAfterSecond);
    expect(mockUIStore.setTabOptionsTitle).toHaveBeenLastCalledWith(
      'Server: oftc',
    );
  });

  // Helper: grab the latest options array passed to the modal.
  const latestOptions = () =>
    (mockUIStore.setTabOptions as jest.Mock).mock.calls.slice(-1)[0][0];
  const findByText = (options: any[], label: string) =>
    options.find((o: any) => String(o.text).includes(label));

  const serverTab = {
    id: 'server::freenode',
    name: 'Freenode',
    type: 'server' as const,
    networkId: 'freenode',
    messages: [],
    unreadCount: 0,
  };

  it('cancels the initial loading modal via its Cancel action', async () => {
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    // First setTabOptions call is the "Loading..." placeholder menu.
    const loadingOptions = (mockUIStore.setTabOptions as jest.Mock).mock
      .calls[0][0];
    const cancel = findByText(loadingOptions, 'Cancel');
    cancel.onPress();
    expect(mockUIStore.setShowTabOptionsModal).toHaveBeenCalledWith(false);
  });

  it('falls back to sendCommand MODE when sendSilentMode is unavailable', async () => {
    const sendCommand = jest.fn();
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('TestNick'),
        sendCommand,
        // no sendSilentMode
        isServerOper: jest.fn().mockReturnValue(false),
      },
    });
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    expect(sendCommand).toHaveBeenCalledWith('MODE TestNick');
  });

  it('shows an error alert when certificate fingerprint extraction fails', async () => {
    const {
      certificateManager,
    } = require('../../src/services/CertificateManagerService');
    (certificateManager.extractFingerprintFromPem as jest.Mock)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null);
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('TestNick'),
        sendCommand: jest.fn(),
        sendSilentMode: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(false),
        sendRaw: jest.fn(),
      },
    });
    mockGetNetworkConfigForId.mockResolvedValueOnce({ clientCert: 'PEM' });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    const options = latestOptions();
    await act(async () => {
      await findByText(options, 'View Certificate Fingerprint').onPress();
      await findByText(options, 'Share Cert with NickServ').onPress();
    });
    expect(mockSafeAlert).toHaveBeenCalledWith(
      'Error',
      'Failed to extract certificate fingerprint',
    );
    expect(mockSafeAlert).toHaveBeenCalledWith(
      'Error',
      'Failed to send certificate fingerprint',
    );
    errorSpy.mockRestore();
  });

  it('alerts when sharing a cert while the connection is missing', async () => {
    const {
      certificateManager,
    } = require('../../src/services/CertificateManagerService');
    (certificateManager.extractFingerprintFromPem as jest.Mock).mockReturnValue(
      'fp',
    );
    // Connected while building (first call), null when the share action runs.
    (connectionManager.getConnection as jest.Mock)
      .mockReturnValueOnce({
        ircService: {
          getConnectionStatus: jest.fn().mockReturnValue(true),
          getCurrentNick: jest.fn().mockReturnValue('TestNick'),
          sendCommand: jest.fn(),
          sendSilentMode: jest.fn(),
          isServerOper: jest.fn().mockReturnValue(false),
          sendRaw: jest.fn(),
        },
      })
      .mockReturnValue(null);
    mockGetNetworkConfigForId.mockResolvedValueOnce({ clientCert: 'PEM' });
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    const options = latestOptions();
    await act(async () => {
      await findByText(options, 'Share Cert with NickServ').onPress();
    });
    expect(mockSafeAlert).toHaveBeenCalledWith(
      'Error',
      'Not connected to IRC server',
    );
  });

  it('executes remaining server-tab actions (connect another, rename)', async () => {
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    const options = latestOptions();
    await act(async () => {
      findByText(options, 'Connect Another Network').onPress();
      findByText(options, 'Rename Server Tab').onPress();
    });
    expect(mockUIStore.setShowNetworksList).toHaveBeenCalledWith(true);
    expect(mockUIStore.setRenameTargetTabId).toHaveBeenCalledWith(
      'server::freenode',
    );
    expect(mockUIStore.setShowRenameModal).toHaveBeenCalledWith(true);
  });

  it('runs all IRCop menu commands and destructive confirmations', async () => {
    const sendCommand = jest.fn();
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('OperNick'),
        sendCommand,
        sendSilentMode: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(true),
      },
    });
    (Alert as any).prompt = jest.fn(
      (_title: string, _msg: string, buttons: any[]) =>
        buttons[1]?.onPress?.('msg'),
    );
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    await act(async () => {
      findByText(latestOptions(), 'IRCop Commands').onPress();
    });
    const operOptions = latestOptions();
    const click = (text: string) =>
      operOptions.find((o: any) => o.text === text).onPress();
    await act(async () => {
      click('ADMIN');
      click('INFO');
      click('VERSION');
      click('TIME');
      click('MOTD');
      click('LUSERS');
      click('LINKS');
      click('TRACE');
      click('DIE');
      click('RESTART');
      click('WALLOP');
    });
    // Destructive confirmations go through safeAlert; run their confirm button.
    ['DIE', 'RESTART'].forEach(cmd => {
      const buttons =
        mockSafeAlert.mock.calls.find((c: any[]) => c[0] === cmd)?.[2] || [];
      buttons[1]?.onPress?.();
    });
    expect(sendCommand).toHaveBeenCalledWith('ADMIN');
    expect(sendCommand).toHaveBeenCalledWith('LINKS');
    expect(sendCommand).toHaveBeenCalledWith('TRACE');
    expect(sendCommand).toHaveBeenCalledWith('DIE');
    expect(sendCommand).toHaveBeenCalledWith('RESTART');
    expect(sendCommand).toHaveBeenCalledWith('WALLOP :msg');
  });

  it('closes the server tab and updates active tab via the running updater', async () => {
    (settingsService.loadNetworks as jest.Mock).mockResolvedValueOnce([
      { id: 'freenode', name: 'freenode', servers: [] },
    ]);
    const runningSetTabs = jest.fn((updater: any) =>
      typeof updater === 'function'
        ? updater([
            {
              id: 'server::freenode',
              name: 'freenode',
              type: 'server',
              networkId: 'freenode',
            },
            {
              id: 'server::oftc',
              name: 'oftc',
              type: 'server',
              networkId: 'oftc',
            },
          ])
        : updater,
    );
    const { result } = await renderHook(() =>
      useTabContextMenu({
        ...defaultParams,
        activeTabId: 'server::freenode',
        primaryNetworkId: 'oftc',
        setTabs: runningSetTabs,
      }),
    );
    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    const closeServer = findByText(latestOptions(), 'Close Server Tab');
    await act(async () => {
      await closeServer.onPress();
    });
    expect(runningSetTabs).toHaveBeenCalled();
    // Fallback should pick the primary network's server tab.
    expect(mockSetActiveTabId).toHaveBeenCalledWith('server::oftc');
    expect(mockSetNetworkName).toHaveBeenCalledWith('oftc');
  });

  it('still builds the channel menu when the bookmark lookup rejects', async () => {
    (channelNotesService.isBookmarked as jest.Mock).mockRejectedValueOnce(
      new Error('io'),
    );
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    expect(mockUIStore.setTabOptionsTitle).toHaveBeenLastCalledWith(
      'Channel: {name}',
    );
  });

  it('switches to the server tab when leaving the active channel', async () => {
    const activeIRC = {
      partChannel: jest.fn(),
      addMessage: jest.fn(),
      sendCommand: jest.fn(),
      sendRaw: jest.fn(),
    };
    const { result } = await renderHook(() =>
      useTabContextMenu({
        ...defaultParams,
        activeTabId: 'channel-1',
        getActiveIRCService: jest.fn().mockReturnValue(activeIRC),
      }),
    );
    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Leave Channel').onPress();
    });
    expect(activeIRC.partChannel).toHaveBeenCalled();
    expect(mockSetActiveTabId).toHaveBeenCalledWith('server::freenode');
  });

  it('handles the channel encryption toggle with and without a key', async () => {
    const {
      channelEncryptionService,
    } = require('../../src/services/ChannelEncryptionService');
    const addMessage = jest.fn();
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('TestNick'),
        sendCommand: jest.fn(),
        sendSilentMode: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(false),
        addMessage,
        sendRaw: jest.fn(),
        sendMessage: jest.fn(),
      },
    });
    // No key: build call + toggle call both return false.
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValue(
      false,
    );
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Send Encrypted (Lock)').onPress();
    });
    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );

    // With key: toggling enables encryption and posts a notice.
    addMessage.mockClear();
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValue(
      true,
    );
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Send Encrypted (Lock)').onPress();
    });
    expect(mockSetTabs).toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notice' }),
    );
  });

  it('handles the query Always Encrypt toggle warning', async () => {
    const {
      channelEncryptionSettingsService,
    } = require('../../src/services/ChannelEncryptionSettingsService');
    const {
      encryptedDMService,
    } = require('../../src/services/EncryptedDMService');
    channelEncryptionSettingsService.getAlwaysEncrypt.mockResolvedValue(false);
    channelEncryptionSettingsService.toggleAlwaysEncrypt.mockResolvedValue(
      true,
    );
    // Clear any leftover one-time queued values from prior tests.
    encryptedDMService.isEncryptedForNetwork.mockReset();
    encryptedDMService.isEncryptedForNetwork.mockResolvedValue(false);
    (Alert as any).alert = jest.fn();
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const queryTab = {
      id: 'query-1',
      name: 'OtherUser',
      type: 'query' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    await act(async () => {
      await result.current.handleTabLongPress(queryTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Always Encrypt').onPress();
    });
    expect((Alert as any).alert).toHaveBeenCalledWith(
      'No Encryption Bundle',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('switches to server tab when closing the active query', async () => {
    const activeIRC = {
      sendRaw: jest.fn(),
      addMessage: jest.fn(),
      sendCommand: jest.fn(),
    };
    const { result } = await renderHook(() =>
      useTabContextMenu({
        ...defaultParams,
        activeTabId: 'query-1',
        getActiveIRCService: jest.fn().mockReturnValue(activeIRC),
      }),
    );
    const queryTab = {
      id: 'query-1',
      name: 'OtherUser',
      type: 'query' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    await act(async () => {
      await result.current.handleTabLongPress(queryTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Close Query').onPress();
    });
    expect(mockSetActiveTabId).toHaveBeenCalledWith('server::freenode');
  });

  it('shares the DM key successfully', async () => {
    const {
      encryptedDMService,
    } = require('../../src/services/EncryptedDMService');
    encryptedDMService.exportBundle.mockResolvedValueOnce({ pub: 'k' });
    const connIrc = {
      getConnectionStatus: jest.fn().mockReturnValue(true),
      getCurrentNick: jest.fn().mockReturnValue('TestNick'),
      sendCommand: jest.fn(),
      sendSilentMode: jest.fn(),
      isServerOper: jest.fn().mockReturnValue(false),
      sendRaw: jest.fn(),
      addMessage: jest.fn(),
    };
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: connIrc,
    });
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const queryTab = {
      id: 'query-1',
      name: 'OtherUser',
      type: 'query' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    await act(async () => {
      await result.current.handleTabLongPress(queryTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Share DM Key').onPress();
    });
    expect(connIrc.sendRaw).toHaveBeenCalledWith(
      expect.stringContaining('PRIVMSG OtherUser :!enc-offer '),
    );
    expect(connIrc.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'system' }),
    );
  });

  it('toggles a query from encrypted back to plaintext', async () => {
    const connIrc = {
      getConnectionStatus: jest.fn().mockReturnValue(true),
      getCurrentNick: jest.fn().mockReturnValue('TestNick'),
      sendCommand: jest.fn(),
      sendSilentMode: jest.fn(),
      isServerOper: jest.fn().mockReturnValue(false),
      sendRaw: jest.fn(),
      addMessage: jest.fn(),
    };
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: connIrc,
    });
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const queryTab = {
      id: 'query-1',
      name: 'OtherUser',
      type: 'query' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: true,
    };
    await act(async () => {
      await result.current.handleTabLongPress(queryTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Send Plaintext (Unlock)').onPress();
    });
    expect(mockSetTabs).toHaveBeenCalled();
    expect(connIrc.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notice' }),
    );
  });

  it('generates a channel key (success and failure)', async () => {
    const {
      channelEncryptionService,
    } = require('../../src/services/ChannelEncryptionService');
    const addMessage = jest.fn();
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('TestNick'),
        sendCommand: jest.fn(),
        sendSilentMode: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(false),
        addMessage,
        sendRaw: jest.fn(),
        sendMessage: jest.fn(),
      },
    });
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    channelEncryptionService.generateChannelKey.mockResolvedValueOnce(
      undefined,
    );
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Generate Channel Key').onPress();
    });
    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notice' }),
    );

    addMessage.mockClear();
    channelEncryptionService.generateChannelKey.mockRejectedValueOnce(
      new Error('nope'),
    );
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Generate Channel Key').onPress();
    });
    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  it('opens channel settings and blacklist targets', async () => {
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    await act(async () => {
      findByText(latestOptions(), 'Channel Settings').onPress();
      findByText(latestOptions(), 'Blacklist').onPress();
    });
    expect(mockUIStore.setChannelSettingsTarget).toHaveBeenCalledWith('#test');
    expect(mockUIStore.setShowChannelSettings).toHaveBeenCalledWith(true);
    expect(mockUIStore.setBlacklistTarget).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'channel' }),
    );
  });

  it('runs all ChanServ service submenu commands', async () => {
    const {
      serviceCommandProvider,
    } = require('../../src/services/ServiceCommandProvider');
    serviceCommandProvider.getServiceCommands.mockReturnValue([
      { service: 'ChanServ' },
    ]);
    const sendRaw = jest.fn();
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('TestNick'),
        sendCommand: jest.fn(),
        sendSilentMode: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(false),
        addMessage: jest.fn(),
        sendMessage: jest.fn(),
        sendRaw,
      },
    });
    (Alert as any).prompt = jest.fn(
      (_title: string, _msg: string, buttons: any[]) =>
        buttons[1]?.onPress?.('target'),
    );
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    await act(async () => {
      findByText(latestOptions(), 'IRC Services').onPress();
    });
    const svcOptions = latestOptions();
    const click = (label: string) =>
      svcOptions.find((o: any) => String(o.text).includes(label)).onPress();
    await act(async () => {
      click('OP (Give Op)');
      click('DEOP');
      click('VOICE (Give Voice)');
      click('DEVOICE');
      click('KICK');
      click('BAN (Ban User)');
      click('UNBAN');
      click('TOPIC');
      click('INFO');
      click('AKICK');
    });
    expect(sendRaw).toHaveBeenCalledWith('PRIVMSG ChanServ :OP #test');
    expect(sendRaw).toHaveBeenCalledWith('PRIVMSG ChanServ :DEOP #test');
    expect(sendRaw).toHaveBeenCalledWith('PRIVMSG ChanServ :VOICE #test');
    expect(sendRaw).toHaveBeenCalledWith('PRIVMSG ChanServ :DEVOICE #test');
    expect(sendRaw).toHaveBeenCalledWith('PRIVMSG ChanServ :KICK #test target');
    expect(sendRaw).toHaveBeenCalledWith('PRIVMSG ChanServ :BAN #test target');
    expect(sendRaw).toHaveBeenCalledWith(
      'PRIVMSG ChanServ :UNBAN #test target',
    );
    expect(sendRaw).toHaveBeenCalledWith(
      'PRIVMSG ChanServ :TOPIC #test target',
    );
    expect(sendRaw).toHaveBeenCalledWith('PRIVMSG ChanServ :INFO #test');
    expect(sendRaw).toHaveBeenCalledWith('PRIVMSG ChanServ :AKICK #test LIST');
  });

  it('runs the final Cancel action of a channel menu', async () => {
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    const options = latestOptions();
    const cancel = options
      .filter((o: any) => o.style === 'cancel')
      .slice(-1)[0];
    cancel.onPress();
    expect(mockUIStore.setShowTabOptionsModal).toHaveBeenCalledWith(false);
  });

  it('closes the server tab and falls back to the first server when primary is gone', async () => {
    (settingsService.loadNetworks as jest.Mock).mockResolvedValueOnce([
      { id: 'freenode', name: 'freenode', servers: [] },
    ]);
    const runningSetTabs = jest.fn((updater: any) =>
      typeof updater === 'function'
        ? updater([
            {
              id: 'server::freenode',
              name: 'freenode',
              type: 'server',
              networkId: 'freenode',
            },
            {
              id: 'server::oftc',
              name: 'oftc',
              type: 'server',
              networkId: 'oftc',
            },
          ])
        : updater,
    );
    const { result } = await renderHook(() =>
      useTabContextMenu({
        ...defaultParams,
        activeTabId: 'server::freenode',
        primaryNetworkId: 'freenode', // primary server is the one being removed
        setTabs: runningSetTabs,
      }),
    );
    await act(async () => {
      await result.current.handleTabLongPress(serverTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Close Server Tab').onPress();
    });
    // Primary server tab is gone -> falls back to the first remaining server.
    expect(mockSetActiveTabId).toHaveBeenCalledWith('server::oftc');
  });

  it('applies the channel encryption toggle through the state updater', async () => {
    const {
      channelEncryptionService,
    } = require('../../src/services/ChannelEncryptionService');
    (channelEncryptionService.hasChannelKey as jest.Mock).mockResolvedValue(
      true,
    );
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('TestNick'),
        sendCommand: jest.fn(),
        sendSilentMode: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(false),
        addMessage: jest.fn(),
        sendRaw: jest.fn(),
        sendMessage: jest.fn(),
      },
    });
    const channelTab = {
      id: 'channel-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    const runningSetTabs = jest.fn((updater: any) =>
      typeof updater === 'function'
        ? updater([channelTab, { id: 'other', sendEncrypted: false }])
        : updater,
    );
    const { result } = await renderHook(() =>
      useTabContextMenu({ ...defaultParams, setTabs: runningSetTabs }),
    );
    await act(async () => {
      await result.current.handleTabLongPress(channelTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Send Encrypted (Lock)').onPress();
    });
    const updated = runningSetTabs.mock.results.slice(-1)[0].value;
    expect(updated.find((t: any) => t.id === 'channel-1').sendEncrypted).toBe(
      true,
    );
  });

  it('applies the query encryption toggle through the state updater', async () => {
    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('TestNick'),
        sendCommand: jest.fn(),
        sendSilentMode: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(false),
        addMessage: jest.fn(),
        sendRaw: jest.fn(),
      },
    });
    const queryTab = {
      id: 'query-1',
      name: 'OtherUser',
      type: 'query' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: true,
    };
    const runningSetTabs = jest.fn((updater: any) =>
      typeof updater === 'function'
        ? updater([queryTab, { id: 'other', sendEncrypted: true }])
        : updater,
    );
    const { result } = await renderHook(() =>
      useTabContextMenu({ ...defaultParams, setTabs: runningSetTabs }),
    );
    await act(async () => {
      await result.current.handleTabLongPress(queryTab);
    });
    await act(async () => {
      await findByText(latestOptions(), 'Send Plaintext (Unlock)').onPress();
    });
    const updated = runningSetTabs.mock.results.slice(-1)[0].value;
    expect(updated.find((t: any) => t.id === 'query-1').sendEncrypted).toBe(
      false,
    );
  });

  it('shows the fallback options menu when building the menu throws', async () => {
    const {
      channelEncryptionSettingsService,
    } = require('../../src/services/ChannelEncryptionSettingsService');
    (
      channelEncryptionSettingsService.getAlwaysEncrypt as jest.Mock
    ).mockRejectedValueOnce(new Error('boom'));
    const { result } = await renderHook(() => useTabContextMenu(defaultParams));
    const queryTab = {
      id: 'query-1',
      name: 'OtherUser',
      type: 'query' as const,
      networkId: 'freenode',
      messages: [],
      unreadCount: 0,
      sendEncrypted: false,
    };
    await act(async () => {
      await result.current.handleTabLongPress(queryTab);
    });
    expect(mockUIStore.setTabOptionsTitle).toHaveBeenLastCalledWith('Options');
    const options = latestOptions();
    const close = findByText(options, 'Close');
    close.onPress();
    expect(mockUIStore.setShowTabOptionsModal).toHaveBeenCalledWith(false);
  });
});
