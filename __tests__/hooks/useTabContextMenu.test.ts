/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useTabContextMenu hook - Wave 4
 */

import { renderHook, act, cleanup } from '@testing-library/react-hooks';

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

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset UI store mocks
    Object.values(mockUIStore).forEach((fn: any) => fn.mockClear?.());

    (connectionManager.getConnection as jest.Mock).mockReturnValue({
      ircService: {
        getConnectionStatus: jest.fn().mockReturnValue(true),
        getCurrentNick: jest.fn().mockReturnValue('TestNick'),
        sendCommand: jest.fn(),
        sendRaw: jest.fn(),
        sendSilentMode: jest.fn(),
        addMessage: jest.fn(),
        isServerOper: jest.fn().mockReturnValue(false),
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should return handleTabLongPress function', () => {
    const { result } = renderHook(() => useTabContextMenu(defaultParams));
    expect(result.current.handleTabLongPress).toBeDefined();
    expect(typeof result.current.handleTabLongPress).toBe('function');
  });

  it('should handle server tab long press for connected server', async () => {
    const { result } = renderHook(() => useTabContextMenu(defaultParams));

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

    const { result } = renderHook(() => useTabContextMenu(defaultParams));

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
    const { result } = renderHook(() => useTabContextMenu(defaultParams));

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
    const { result } = renderHook(() => useTabContextMenu(defaultParams));

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

    const { result } = renderHook(() => useTabContextMenu(defaultParams));

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

    const { result } = renderHook(() => useTabContextMenu(defaultParams));

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
    const { result } = renderHook(() => useTabContextMenu(defaultParams));
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
    const { result } = renderHook(() => useTabContextMenu(defaultParams));
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
    const { result } = renderHook(() =>
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
    const { result } = renderHook(() =>
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

    const { result } = renderHook(() => useTabContextMenu(defaultParams));
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
    const { result } = renderHook(() => useTabContextMenu(defaultParams));
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
    const { result } = renderHook(() => useTabContextMenu(defaultParams));
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

    const { result } = renderHook(() => useTabContextMenu(defaultParams));
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

    const { result } = renderHook(() =>
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
      sendRaw: jest.fn(),
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

    const { result } = renderHook(() =>
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
    expect(connIrc.sendCommand).toHaveBeenCalledWith('/chankey request Alice');
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
    expect(connIrc.sendCommand).toHaveBeenCalledWith('/chankey share Alice');
    expect(channelFavoritesService.removeFavorite).toHaveBeenCalledWith(
      'freenode',
      '#test',
    );
  });
});
