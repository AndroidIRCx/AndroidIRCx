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
    addEventListener: jest.fn((_event: string, listener: (event: { url: string }) => void) => {
      mockUrlListener = listener;
      return { remove: jest.fn() };
    }),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn(() => []),
  },
}));

jest.mock('../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: {
    list: jest.fn(() => Promise.resolve([{ id: 'default', nick: 'AndroidIRCX' }])),
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
    Object.keys(params).forEach((k) => {
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
      })
    );

    await new Promise((r) => setTimeout(r, 0));

    expect(Linking.getInitialURL).toHaveBeenCalled();
    expect(handleConnect).toHaveBeenCalledWith(expect.objectContaining({ name: 'TestNet' }), 'srv-1');
  });

  it('queues URL while locked and processes it after unlock', async () => {
    mockInitialUrl = 'ircs://irc.test.net:6697';

    const { rerender } = renderHook(
      (props: any) => useDeepLinkHandler(props),
      {
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
      }
    );

    await new Promise((r) => setTimeout(r, 0));
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
    await new Promise((r) => setTimeout(r, 0));

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
      })
    );

    await new Promise((r) => setTimeout(r, 0));

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
      })
    );

    await new Promise((r) => setTimeout(r, 0));

    expect(safeAlert).toHaveBeenCalledWith(
      'Invalid IRC URL',
      expect.stringContaining('bad format'),
      expect.any(Array)
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
      })
    );

    await act(async () => {
      mockUrlListener?.({ url: 'ircs://irc.test.net:6697' });
      await new Promise((r) => setTimeout(r, 0));
      mockUrlListener?.({ url: 'ircs://irc.test.net:6697' });
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(handleConnect).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'deeplink',
      expect.stringContaining('Ignoring duplicate URL')
    );
    nowSpy.mockRestore();
  });
});
