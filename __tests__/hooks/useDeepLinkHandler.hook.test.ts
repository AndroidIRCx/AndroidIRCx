/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { renderHook, act } from '@testing-library/react-native';
import { useDeepLinkHandler } from '../../src/hooks/useDeepLinkHandler';

let mockInitialUrl: string | null = null;
let mockUrlListener: ((event: { url: string }) => void) | null = null;

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    getInitialURL: jest.fn(() => Promise.resolve(mockInitialUrl)),
    addEventListener: jest.fn(
      (_event: string, listener: (event: { url: string }) => void) => {
        mockUrlListener = listener;
        return { remove: jest.fn() };
      },
    ),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn(() => []),
  },
}));

jest.mock('../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: {
    list: jest.fn(() =>
      Promise.resolve([{ id: 'default', nick: 'AndroidIRCX' }]),
    ),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock('../../src/services/Logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../src/utils/ircUrlParser', () => ({
  parseIRCUrl: jest.fn(),
  findMatchingNetwork: jest.fn(() => Promise.resolve(null)),
  createTempNetworkFromUrl: jest.fn(() => ({
    id: 'temp-1',
    name: 'temp-network',
    nick: 'AndroidIRCX',
    altNick: 'AndroidIRCX_',
    realname: 'AndroidIRCX User',
    ident: 'androidircx',
    servers: [
      {
        id: 'srv-temp',
        hostname: 'irc.test.net',
        port: 6697,
        ssl: true,
        rejectUnauthorized: true,
      },
    ],
  })),
  getUrlDisplayName: jest.fn(() => 'irc.test.net:6697'),
}));

import { Linking } from 'react-native';
import { connectionManager } from '../../src/services/ConnectionManager';
import { settingsService } from '../../src/services/SettingsService';
import { parseIRCUrl, findMatchingNetwork } from '../../src/utils/ircUrlParser';
import { logger } from '../../src/services/Logger';

const mockParseIRCUrl = parseIRCUrl as jest.Mock;
const mockFindMatchingNetwork = findMatchingNetwork as jest.Mock;

const makeParsed = (overrides: Record<string, any> = {}) => ({
  isValid: true,
  server: 'irc.test.net',
  port: 6697,
  ssl: true,
  channel: null,
  channelKey: undefined,
  nick: undefined,
  password: undefined,
  altNick: undefined,
  realname: undefined,
  ident: undefined,
  ...overrides,
});

describe('useDeepLinkHandler hook', () => {
  const handleConnect = jest.fn(() => Promise.resolve());
  const handleJoinChannel = jest.fn();
  const safeAlert = jest.fn();
  const t = jest.fn((key: string, params?: any) => {
    if (!params) return key;
    let result = key;
    Object.keys(params).forEach(k => {
      result = result.replace(`{${k}}`, String(params[k]));
    });
    return result;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockInitialUrl = null;
    mockUrlListener = null;
    mockParseIRCUrl.mockReturnValue(makeParsed());
    mockFindMatchingNetwork.mockResolvedValue({
      id: 'net-1',
      name: 'TestNet',
      nick: 'Nick',
      altNick: 'Nick_',
      realname: 'User',
      ident: 'ident',
      servers: [
        {
          id: 'srv-1',
          hostname: 'irc.test.net',
          port: 6697,
          ssl: true,
          rejectUnauthorized: true,
        },
      ],
      autoJoinChannels: [],
    });
    (connectionManager.getAllConnections as jest.Mock).mockReturnValue([]);
    (settingsService.loadNetworks as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('processes initial URL and connects using matched network', async () => {
    mockInitialUrl = 'ircs://irc.test.net:6697';

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );

    await new Promise(r => setTimeout(r, 0));

    expect(Linking.getInitialURL).toHaveBeenCalled();
    expect(handleConnect).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TestNet' }),
      'srv-1',
    );
  });

  it('queues URL while locked and processes it after unlock', async () => {
    mockInitialUrl = 'ircs://irc.test.net:6697';

    const { rerender } = renderHook((props: any) => useDeepLinkHandler(props), {
      initialProps: {
        handleConnect,
        handleJoinChannel,
        isAppLocked: true,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      },
    });

    await new Promise(r => setTimeout(r, 0));
    expect(handleConnect).not.toHaveBeenCalled();

    rerender({
      handleConnect,
      handleJoinChannel,
      isAppLocked: false,
      isFirstRunComplete: true,
      activeConnectionId: null,
      tabs: [],
      safeAlert,
      t,
    });
    await new Promise(r => setTimeout(r, 0));

    expect(handleConnect).toHaveBeenCalled();
  });

  it('reuses existing connection and joins channel without reconnect', async () => {
    mockInitialUrl = 'ircs://irc.test.net:6697/#chan';
    mockParseIRCUrl.mockReturnValue(makeParsed({ channel: '#chan' }));
    (connectionManager.getAllConnections as jest.Mock).mockReturnValue([
      {
        networkId: 'irc.test.net',
        ircService: { getConnectionStatus: jest.fn(() => true) },
      },
    ]);

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: 'irc.test.net',
        tabs: [],
        safeAlert,
        t,
      }),
    );

    await new Promise(r => setTimeout(r, 0));

    expect(handleJoinChannel).toHaveBeenCalledWith('#chan', undefined);
    expect(handleConnect).not.toHaveBeenCalled();
  });

  it('shows alert for invalid IRC URL', async () => {
    mockInitialUrl = 'not-an-irc-url';
    mockParseIRCUrl.mockReturnValue({ isValid: false, error: 'bad format' });

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );

    await new Promise(r => setTimeout(r, 0));

    expect(safeAlert).toHaveBeenCalledWith(
      'Invalid IRC URL',
      expect.stringContaining('bad format'),
      expect.any(Array),
    );
  });

  it('ignores duplicate URL events received within 2 seconds', async () => {
    mockInitialUrl = null;
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1500);

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );

    await act(async () => {
      mockUrlListener?.({ url: 'ircs://irc.test.net:6697' });
      await new Promise(r => setTimeout(r, 0));
      mockUrlListener?.({ url: 'ircs://irc.test.net:6697' });
      await new Promise(r => setTimeout(r, 0));
    });

    expect(handleConnect).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'deeplink',
      expect.stringContaining('Ignoring duplicate URL'),
    );
    nowSpy.mockRestore();
  });

  it('shows security warning for URL with password and continues on confirmation', async () => {
    mockInitialUrl = 'ircs://nick:pass@irc.test.net:6697';
    mockParseIRCUrl.mockReturnValue(makeParsed({ password: 'pass' }));

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );
    await new Promise(r => setTimeout(r, 0));

    const warningButtons = safeAlert.mock.calls[0][2];
    await act(async () => {
      await warningButtons[1].onPress();
      await new Promise(r => setTimeout(r, 0));
    });

    expect(safeAlert).toHaveBeenCalledWith(
      'Security Warning',
      expect.stringContaining('plain text'),
      expect.any(Array),
    );
    expect(handleConnect).toHaveBeenCalled();
  });

  it('shows already connected alert when connected and no channel requested', async () => {
    mockInitialUrl = 'ircs://irc.test.net:6697';
    (connectionManager.getAllConnections as jest.Mock).mockReturnValue([
      {
        networkId: 'irc.test.net',
        ircService: { getConnectionStatus: jest.fn(() => true) },
      },
    ]);

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: 'irc.test.net',
        tabs: [
          {
            id: 's1',
            name: 'Server',
            type: 'server',
            networkId: 'irc.test.net',
            messages: [],
          },
        ],
        safeAlert,
        t,
      }),
    );
    await new Promise(r => setTimeout(r, 0));

    expect(safeAlert).toHaveBeenCalledWith(
      'Already Connected',
      expect.stringContaining('Already connected'),
      expect.any(Array),
    );
    expect(handleConnect).not.toHaveBeenCalled();
  });

  it('finds existing connected session via saved network server mapping and joins channel', async () => {
    mockInitialUrl = 'ircs://irc.test.net:6697/#mapped';
    mockParseIRCUrl.mockReturnValue(makeParsed({ channel: '#mapped' }));
    (connectionManager.getAllConnections as jest.Mock).mockReturnValue([
      {
        networkId: 'DBase',
        ircService: { getConnectionStatus: jest.fn(() => true) },
      },
    ]);
    (settingsService.loadNetworks as jest.Mock).mockResolvedValue([
      {
        id: 'dbase-id',
        name: 'DBase',
        servers: [{ id: 'srv-dbase', hostname: 'irc.test.net', port: 6697 }],
      },
    ]);

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [
          {
            id: 's1',
            name: 'Server',
            type: 'server',
            networkId: 'DBase',
            messages: [],
          },
        ],
        safeAlert,
        t,
      }),
    );
    await new Promise(r => setTimeout(r, 0));

    expect(handleJoinChannel).toHaveBeenCalledWith('#mapped', undefined);
    expect(handleConnect).not.toHaveBeenCalled();
  });

  it('shows temporary network confirmation and connects on confirm', async () => {
    mockInitialUrl = 'ircs://new.server.net:6697/#chan';
    mockFindMatchingNetwork.mockResolvedValue(null);
    mockParseIRCUrl.mockReturnValue(
      makeParsed({ server: 'new.server.net', channel: '#chan' }),
    );

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );
    await new Promise(r => setTimeout(r, 0));

    const buttons = safeAlert.mock.calls.find(
      c => c[0] === 'Connect to IRC Server',
    )?.[2];
    expect(buttons).toBeDefined();
    await act(async () => {
      await buttons[1].onPress();
      await new Promise(r => setTimeout(r, 0));
    });

    expect(handleConnect).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'temp-network' }),
      'srv-temp',
    );
  });

  it('temp network confirm schedules keyed join after delayed connect', async () => {
    jest.useFakeTimers();
    mockInitialUrl = 'ircs://new.server.net:6697/#chan';
    mockFindMatchingNetwork.mockResolvedValue(null);
    mockParseIRCUrl.mockReturnValue(
      makeParsed({
        server: 'new.server.net',
        channel: '#chan',
        channelKey: 'tempKey',
      }),
    );

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const buttons = safeAlert.mock.calls.find(
      c => c[0] === 'Connect to IRC Server',
    )?.[2];
    await act(async () => {
      await buttons[1].onPress();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(handleConnect).toHaveBeenCalled();
    expect(handleJoinChannel).toHaveBeenCalledWith('#chan', 'tempKey');
  });

  it('joins channel without reconnect when duplicate connection appears during race-check', async () => {
    mockInitialUrl = 'ircs://irc.test.net:6697/#race';
    mockParseIRCUrl.mockReturnValue(makeParsed({ channel: '#race' }));
    (connectionManager.getAllConnections as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          networkId: 'RaceNet',
          ircService: { getConnectionStatus: jest.fn(() => true) },
        },
      ]);
    (settingsService.loadNetworks as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'race-id',
          name: 'RaceNet',
          servers: [{ id: 'srv-race', hostname: 'irc.test.net', port: 6697 }],
        },
      ]);

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );
    await new Promise(r => setTimeout(r, 0));

    expect(handleJoinChannel).toHaveBeenCalledWith('#race', undefined);
    expect(handleConnect).not.toHaveBeenCalled();
  });

  it('joins keyed channel after delayed connect for saved network', async () => {
    jest.useFakeTimers();
    mockInitialUrl = 'ircs://irc.test.net:6697/#chan';
    mockParseIRCUrl.mockReturnValue(
      makeParsed({ channel: '#chan', channelKey: 'k123' }),
    );

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(handleConnect).toHaveBeenCalled();
    expect(handleJoinChannel).toHaveBeenCalledWith('#chan', 'k123');
  });

  it('logs temp network connect errors from confirmation flow', async () => {
    mockInitialUrl = 'ircs://new.server.net:6697/#chan';
    mockFindMatchingNetwork.mockResolvedValue(null);
    mockParseIRCUrl.mockReturnValue(
      makeParsed({
        server: 'new.server.net',
        channel: '#chan',
        channelKey: 'key',
      }),
    );
    handleConnect.mockRejectedValueOnce(new Error('temp connect fail'));

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );
    await new Promise(r => setTimeout(r, 0));

    const buttons = safeAlert.mock.calls.find(
      c => c[0] === 'Connect to IRC Server',
    )?.[2];
    await act(async () => {
      await buttons[1].onPress();
      await new Promise(r => setTimeout(r, 0));
    });

    expect(logger.error).toHaveBeenCalledWith(
      'deeplink',
      expect.stringContaining('Connection failed: temp connect fail'),
    );
  });

  it('logs saved network connect errors', async () => {
    mockInitialUrl = 'ircs://irc.test.net:6697';
    handleConnect.mockRejectedValueOnce(new Error('saved connect fail'));

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );
    await new Promise(r => setTimeout(r, 0));

    expect(logger.error).toHaveBeenCalledWith(
      'deeplink',
      expect.stringContaining('Connection failed: saved connect fail'),
    );
  });

  it('queues incoming URL when another URL is already being processed', async () => {
    mockInitialUrl = null;
    let resolveConnect: (() => void) | null = null;
    handleConnect.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveConnect = resolve;
        }),
    );

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );

    await act(async () => {
      mockUrlListener?.({ url: 'ircs://irc.test.net:6697' });
      mockUrlListener?.({ url: 'ircs://irc.other.net:6697' });
      await Promise.resolve();
    });

    expect(logger.info).toHaveBeenCalledWith(
      'deeplink',
      'Already processing a URL, queuing',
    );
    resolveConnect?.();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('clears pending keyed-channel timeout on unmount', async () => {
    jest.useFakeTimers();
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    mockInitialUrl = 'ircs://irc.test.net:6697/#chan';
    mockParseIRCUrl.mockReturnValue(
      makeParsed({ channel: '#chan', channelKey: 'cleanup' }),
    );

    const { unmount } = renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('logs and alerts when deep link processing throws', async () => {
    mockInitialUrl = 'ircs://irc.test.net:6697';
    (settingsService.loadNetworks as jest.Mock).mockRejectedValueOnce(
      new Error('load failed'),
    );

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );
    await new Promise(r => setTimeout(r, 0));

    expect(logger.error).toHaveBeenCalledWith(
      'deeplink',
      expect.stringContaining('Error processing deep link'),
    );
    expect(safeAlert).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('load failed'),
      expect.any(Array),
    );
  });

  it('logs initial URL retrieval errors', async () => {
    (Linking.getInitialURL as jest.Mock).mockRejectedValueOnce(
      new Error('initial fail'),
    );
    mockInitialUrl = null;

    renderHook(() =>
      useDeepLinkHandler({
        handleConnect,
        handleJoinChannel,
        isAppLocked: false,
        isFirstRunComplete: true,
        activeConnectionId: null,
        tabs: [],
        safeAlert,
        t,
      }),
    );
    await new Promise(r => setTimeout(r, 0));

    expect(logger.error).toHaveBeenCalledWith(
      'deeplink',
      expect.stringContaining('Error getting initial URL'),
    );
  });
});
