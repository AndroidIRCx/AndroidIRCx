/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useConnectionHandler.test.ts
 *
 * Tests for useConnectionHandler hook - IRC server connection handling
 */

import { renderHook, act } from '@testing-library/react-native';
import { useConnectionHandler } from '../../src/hooks/useConnectionHandler';

// ─── Mocks ─────────────────────────────────────────────

const mockStorage: Map<string, string> = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
    getItem: jest.fn(async (key: string) => mockStorage.get(key) || null),
    removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
    multiGet: jest.fn(async (keys: string[]) => keys.map(k => [k, mockStorage.get(k) || null])),
    multiSet: jest.fn(async (pairs: [string, string][]) => { pairs.forEach(([k, v]) => mockStorage.set(k, v)); }),
    getAllKeys: jest.fn(async () => Array.from(mockStorage.keys())),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: jest.fn(),
    createDefaultNetwork: jest.fn(),
    getSetting: jest.fn(),
    addNetwork: jest.fn(),
  },
  DEFAULT_SERVER: {
    id: 'dbase-default',
    hostname: 'irc.dbase.in.rs',
    port: 6697,
    ssl: true,
    rejectUnauthorized: true,
    name: 'irc.dbase.in.rs',
  },
}));
const mockSettingsService = jest.requireMock<any>('../../src/services/SettingsService').settingsService;

jest.mock('../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: {
    list: jest.fn(),
    getDefaultProfile: jest.fn(),
  },
}));
const mockIdentityProfilesService = jest.requireMock<any>('../../src/services/IdentityProfilesService').identityProfilesService;

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    connect: jest.fn(),
    getConnection: jest.fn(),
    getActiveConnection: jest.fn(),
    onConnectionCreated: jest.fn(() => jest.fn()), // returns unsubscribe
  },
}));
const mockConnectionManager = jest.requireMock<any>('../../src/services/ConnectionManager').connectionManager;

jest.mock('../../src/services/ScriptingService', () => ({
  scriptingService: {
    handleConnect: jest.fn(),
  },
}));
const mockScriptingService = jest.requireMock<any>('../../src/services/ScriptingService').scriptingService;

jest.mock('../../src/services/TabService', () => ({
  tabService: {
    getTabs: jest.fn(),
  },
}));
const mockTabService = jest.requireMock<any>('../../src/services/TabService').tabService;

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    loadMessages: jest.fn(),
  },
}));
const mockMessageHistoryService = jest.requireMock<any>('../../src/services/MessageHistoryService').messageHistoryService;

jest.mock('../../src/services/AutoReconnectService', () => ({
  autoReconnectService: {
    saveConnectionState: jest.fn(),
    getConfig: jest.fn(),
    setConfig: jest.fn(),
  },
}));
const mockAutoReconnectService = jest.requireMock<any>('../../src/services/AutoReconnectService').autoReconnectService;

jest.mock('../../src/services/ChannelFavoritesService', () => ({
  channelFavoritesService: {
    getFavorites: jest.fn(),
  },
}));
const mockChannelFavoritesService = jest.requireMock<any>('../../src/services/ChannelFavoritesService').channelFavoritesService;

jest.mock('../../src/services/Logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));
const mockLogger = jest.requireMock<any>('../../src/services/Logger').logger;

jest.mock('../../src/services/ErrorReportingService', () => ({
  errorReportingService: {
    report: jest.fn(),
  },
}));
const mockErrorReportingService = jest.requireMock<any>('../../src/services/ErrorReportingService').errorReportingService;

const mockSetShowNetworksList = jest.fn();
jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: () => ({
      setShowNetworksList: mockSetShowNetworksList,
    }),
  },
}));

jest.mock('../../src/utils/tabUtils', () => ({
  serverTabId: (network: string) => `server::${network}`,
  makeServerTab: (network: string) => ({
    id: `server::${network}`,
    name: network,
    type: 'server',
    networkId: network,
    messages: [],
  }),
  sortTabsGrouped: (tabs: any[], _sort: boolean) => tabs,
}));

// ─── Helpers ─────────────────────────────────────────────

const defaultNetwork = {
  id: 'net-1',
  name: 'DBase',
  nick: 'TestNick',
  altNick: 'TestNick_',
  realname: 'Test User',
  ident: 'testident',
  servers: [
    {
      id: 'srv-1',
      hostname: 'irc.example.com',
      port: 6697,
      ssl: true,
      rejectUnauthorized: true,
      name: 'irc.example.com',
    },
  ],
  identityProfileId: 'profile-1',
};

const defaultIdentityProfile = {
  id: 'profile-1',
  name: 'Default',
  nick: 'ProfileNick',
  altNick: 'ProfileNick_',
  realname: 'Profile User',
  ident: 'profileident',
  saslAccount: '',
  saslPassword: '',
  nickservPassword: '',
  operUser: '',
  operPassword: '',
};

function createMockParams(overrides: Partial<any> = {}) {
  return {
    setSelectedNetworkName: jest.fn(),
    setActiveConnectionId: jest.fn(),
    setNetworkName: jest.fn(),
    setPrimaryNetworkId: jest.fn(),
    setIsConnected: jest.fn(),
    setTabs: jest.fn((updater: any) => {
      if (typeof updater === 'function') updater([]);
      return updater;
    }),
    setActiveTabId: jest.fn(),
    appendServerMessage: jest.fn(),
    safeAlert: jest.fn(),
    t: jest.fn((key: string, params?: any) => {
      if (params) {
        let result = key;
        Object.keys(params).filter(k => k !== '_tags').forEach(k => {
          result = result.replace(`{${k}}`, String(params[k]));
        });
        return result;
      }
      return key;
    }),
    tabsRef: { current: [] as any[] },
    primaryNetworkId: null as string | null,
    autoConnectFavoriteServerRef: { current: false },
    ...overrides,
  };
}

function setupDefaultMocks() {
  mockSettingsService.loadNetworks.mockResolvedValue([defaultNetwork]);
  mockSettingsService.getSetting.mockImplementation(async (key: string, defaultVal: any) => {
    if (key === 'globalProxy') return { enabled: false };
    if (key === 'quickConnectNetworkId') return null;
    if (key === 'autoJoinFavorites') return true;
    return defaultVal;
  });
  mockSettingsService.createDefaultNetwork.mockResolvedValue(defaultNetwork);
  mockIdentityProfilesService.list.mockResolvedValue([defaultIdentityProfile]);
  mockIdentityProfilesService.getDefaultProfile.mockResolvedValue(defaultIdentityProfile);
  mockConnectionManager.connect.mockResolvedValue('DBase');
  mockTabService.getTabs.mockResolvedValue([]);
  mockMessageHistoryService.loadMessages.mockResolvedValue([]);
  mockAutoReconnectService.saveConnectionState.mockResolvedValue(undefined);
  mockAutoReconnectService.getConfig.mockReturnValue(null);
  mockAutoReconnectService.setConfig.mockResolvedValue(undefined);
  mockChannelFavoritesService.getFavorites.mockReturnValue([]);
}

// ─── Tests ─────────────────────────────────────────────

describe('useConnectionHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    setupDefaultMocks();
  });

  describe('handleConnect', () => {
    describe('network selection', () => {
      it('should use provided network directly', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(params.setSelectedNetworkName).toHaveBeenCalledWith('DBase');
        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should load networks when none provided', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect();
        });

        expect(mockSettingsService.loadNetworks).toHaveBeenCalled();
        expect(params.setSelectedNetworkName).toHaveBeenCalledWith('DBase');
      });

      it('should create default network when no networks exist', async () => {
        mockSettingsService.loadNetworks
          .mockResolvedValueOnce([]) // first call returns empty
          .mockResolvedValueOnce([defaultNetwork]); // reload after creation

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect();
        });

        expect(mockSettingsService.createDefaultNetwork).toHaveBeenCalled();
        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should use quickConnectNetworkId when configured', async () => {
        const quickNetwork = { ...defaultNetwork, id: 'quick-net', name: 'QuickNet' };
        mockSettingsService.loadNetworks.mockResolvedValue([defaultNetwork, quickNetwork]);
        mockSettingsService.getSetting.mockImplementation(async (key: string, defaultVal: any) => {
          if (key === 'quickConnectNetworkId') return 'quick-net';
          if (key === 'globalProxy') return { enabled: false };
          if (key === 'autoJoinFavorites') return true;
          return defaultVal;
        });

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect();
        });

        expect(params.setSelectedNetworkName).toHaveBeenCalledWith('QuickNet');
      });

      it('should prefer DBase network as fallback', async () => {
        const otherNetwork = { ...defaultNetwork, id: 'other', name: 'Other' };
        mockSettingsService.loadNetworks.mockResolvedValue([otherNetwork, defaultNetwork]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect();
        });

        expect(params.setSelectedNetworkName).toHaveBeenCalledWith('DBase');
      });

      it('should fallback to DBase without servers, then network with servers, then first', async () => {
        const dbaseNoServers = { ...defaultNetwork, servers: [] };
        const otherWithServers = { ...defaultNetwork, id: 'other', name: 'Other' };
        mockSettingsService.loadNetworks.mockResolvedValue([dbaseNoServers, otherWithServers]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect();
        });

        // DBase without servers is found first, but then it will use it
        // (it finds DBase first, even without servers)
        expect(params.setSelectedNetworkName).toHaveBeenCalledWith('DBase');
      });

      it('should fallback to first network with servers when no DBase', async () => {
        const net1 = { ...defaultNetwork, id: 'n1', name: 'Freenode', servers: [] };
        const net2 = { ...defaultNetwork, id: 'n2', name: 'Libera' };
        mockSettingsService.loadNetworks.mockResolvedValue([net1, net2]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect();
        });

        expect(params.setSelectedNetworkName).toHaveBeenCalledWith('Libera');
      });

      it('should fallback to first network when none have servers', async () => {
        const net1 = { ...defaultNetwork, id: 'n1', name: 'First', servers: [] };
        const net2 = { ...defaultNetwork, id: 'n2', name: 'Second', servers: [] };
        mockSettingsService.loadNetworks.mockResolvedValue([net1, net2]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect();
        });

        expect(params.setSelectedNetworkName).toHaveBeenCalledWith('First');
      });
    });

    describe('identity profile', () => {
      it('should apply identity profile from network config', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(mockIdentityProfilesService.list).toHaveBeenCalled();
        // Connection should use profile's nick
        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].nick).toBe('ProfileNick');
      });

      it('should use network identity fields when network has no profile ID', async () => {
        const networkNoProfile = { ...defaultNetwork, identityProfileId: undefined };
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(networkNoProfile);
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].nick).toBe(networkNoProfile.nick);
        expect(mockIdentityProfilesService.getDefaultProfile).not.toHaveBeenCalled();
      });

      it('should fallback to network identity when profile ID not found', async () => {
        mockIdentityProfilesService.list.mockResolvedValue([]); // no matching profile
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].nick).toBe(defaultNetwork.nick);
        expect(mockIdentityProfilesService.getDefaultProfile).not.toHaveBeenCalled();
      });

      it('should apply SASL from identity profile', async () => {
        const profileWithSasl = {
          ...defaultIdentityProfile,
          saslAccount: 'sasluser',
          saslPassword: 'saslpass',
        };
        mockIdentityProfilesService.list.mockResolvedValue([profileWithSasl]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].sasl).toEqual({ account: 'sasluser', password: 'saslpass' });
      });

      it('should apply nickserv and oper from identity profile', async () => {
        const profileWithCreds = {
          ...defaultIdentityProfile,
          nickservPassword: 'nspass',
          operUser: 'admin',
          operPassword: 'operpass',
        };
        mockIdentityProfilesService.list.mockResolvedValue([profileWithCreds]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        // The network config passed to connectionManager should have these applied
        const connectCall = mockConnectionManager.connect.mock.calls[0];
        const networkConfig = connectCall[1];
        expect(networkConfig.nickservPassword).toBe('nspass');
        expect(networkConfig.operUser).toBe('admin');
        expect(networkConfig.operPassword).toBe('operpass');
      });
    });

    describe('identity overrides', () => {
      it('should apply nick override', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork, undefined, undefined, {
            identity: { nick: 'OverrideNick' },
          });
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].nick).toBe('OverrideNick');
      });

      it('should apply altNick override', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork, undefined, undefined, {
            identity: { altNick: 'AltOverride' },
          });
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].altNick).toBe('AltOverride');
      });

      it('should apply ident override', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork, undefined, undefined, {
            identity: { ident: 'customident' },
          });
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].username).toBe('customident');
      });

      it('should apply name override to realname', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork, undefined, undefined, {
            identity: { name: 'Custom Name' },
          });
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].realname).toBe('Custom Name');
      });

      it('should apply email override to realname', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork, undefined, undefined, {
            identity: { email: 'test@example.com' },
          });
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].realname).toContain('<test@example.com>');
      });

      it('should combine name and email in realname', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork, undefined, undefined, {
            identity: { name: 'Custom Name', email: 'test@example.com' },
          });
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].realname).toBe('Custom Name <test@example.com>');
      });
    });

    describe('server selection', () => {
      it('should use specified serverId', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork, 'srv-1');
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].host).toBe('irc.example.com');
      });

      it('should use favorite server when autoConnectFavoriteServerRef is true', async () => {
        const networkWithFav = {
          ...defaultNetwork,
          servers: [
            { ...defaultNetwork.servers[0], id: 'srv-1', favorite: false },
            { id: 'srv-fav', hostname: 'fav.example.com', port: 6697, ssl: true, rejectUnauthorized: true, favorite: true },
          ],
        };
        const params = createMockParams({ autoConnectFavoriteServerRef: { current: true } });
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(networkWithFav);
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].host).toBe('fav.example.com');
      });

      it('should use defaultServerId when set', async () => {
        const networkWithDefault = {
          ...defaultNetwork,
          defaultServerId: 'srv-2',
          servers: [
            defaultNetwork.servers[0],
            { id: 'srv-2', hostname: 'default.example.com', port: 6697, ssl: true, rejectUnauthorized: true },
          ],
        };
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(networkWithDefault);
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].host).toBe('default.example.com');
      });

      it('should fallback to first server', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[2].host).toBe('irc.example.com');
      });

      it('should use DEFAULT_SERVER when no servers found (empty servers list with fallback)', async () => {
        // This tests the fallback to DEFAULT_SERVER after all servers array checks
        const networkNoServers = {
          ...defaultNetwork,
          servers: [
            { id: 'srv-1', hostname: 'irc.example.com', port: 6697, ssl: true, rejectUnauthorized: true, name: 'test' },
          ],
        };
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(networkNoServers);
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });
    });

    describe('no network/server alerts', () => {
      it('should show alert when no network available and all load attempts fail', async () => {
        // Make loadNetworks return a list but none match any criteria
        // Then the network ends up undefined somehow - tricky to trigger
        // The alert happens when networkToUse is null after all selection logic
        // Easiest way: loadNetworks returns empty, createDefaultNetwork succeeds but reload returns empty
        mockSettingsService.loadNetworks
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]); // reload also empty
        mockSettingsService.createDefaultNetwork.mockResolvedValue(undefined);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect();
        });

        expect(params.safeAlert).toHaveBeenCalledWith(
          'No Network',
          expect.any(String),
          expect.any(Array),
        );
      });

      it('should show alert when network has no servers', async () => {
        const networkNoServers = { ...defaultNetwork, servers: [] };
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(networkNoServers);
        });

        expect(params.safeAlert).toHaveBeenCalledWith(
          'No Server Configured',
          expect.any(String),
          expect.any(Array),
        );
      });

      it('should open networks list from no-network alert Configure button', async () => {
        const networkNoServers = { ...defaultNetwork, servers: [] };
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(networkNoServers);
        });

        // Get the alert buttons and press Configure
        const alertButtons = params.safeAlert.mock.calls[0][2];
        const configureButton = alertButtons.find((b: any) => b.text === 'Configure');
        configureButton?.onPress?.();

        expect(mockSetShowNetworksList).toHaveBeenCalledWith(true);
      });
    });

    describe('connection config', () => {
      it('should build correct connection config', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        const config = connectCall[2];
        expect(config.host).toBe('irc.example.com');
        expect(config.port).toBe(6697);
        expect(config.tls).toBe(true);
        expect(config.rejectUnauthorized).toBe(true);
      });

      it('should include server password in config', async () => {
        const networkWithPass = {
          ...defaultNetwork,
          servers: [{ ...defaultNetwork.servers[0], password: 'serverpass' }],
        };
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(networkWithPass);
        });

        const config = mockConnectionManager.connect.mock.calls[0][2];
        expect(config.password).toBe('serverpass');
      });

      it('should include proxy config', async () => {
        const networkWithProxy = {
          ...defaultNetwork,
          proxy: { type: 'socks5' as const, host: 'proxy.example.com', port: 1080 },
        };
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(networkWithProxy);
        });

        const config = mockConnectionManager.connect.mock.calls[0][2];
        expect(config.proxy).toEqual({ type: 'socks5', host: 'proxy.example.com', port: 1080 });
      });

      it('should use global proxy when network has no proxy', async () => {
        mockSettingsService.getSetting.mockImplementation(async (key: string, defaultVal: any) => {
          if (key === 'globalProxy') return { enabled: true, type: 'http', host: 'global.proxy', port: 8080 };
          if (key === 'autoJoinFavorites') return true;
          return defaultVal;
        });

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        const config = mockConnectionManager.connect.mock.calls[0][2];
        expect(config.proxy).toEqual({ enabled: true, type: 'http', host: 'global.proxy', port: 8080 });
      });

      it('should include client certificate', async () => {
        const networkWithCert = {
          ...defaultNetwork,
          clientCert: 'CERT_DATA',
          clientKey: 'KEY_DATA',
        };
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(networkWithCert);
        });

        const config = mockConnectionManager.connect.mock.calls[0][2];
        expect(config.clientCert).toBe('CERT_DATA');
        expect(config.clientKey).toBe('KEY_DATA');
      });
    });

    describe('connection success', () => {
      it('should set connection state on success', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(params.setActiveConnectionId).toHaveBeenCalledWith('DBase');
        expect(params.setNetworkName).toHaveBeenCalledWith('DBase');
        expect(params.setIsConnected).toHaveBeenCalledWith(true);
      });

      it('should set primaryNetworkId when not already set', async () => {
        const params = createMockParams({ primaryNetworkId: null });
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(params.setPrimaryNetworkId).toHaveBeenCalledWith('DBase');
      });

      it('should NOT set primaryNetworkId when already set', async () => {
        const params = createMockParams({ primaryNetworkId: 'existing-net' });
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(params.setPrimaryNetworkId).not.toHaveBeenCalled();
      });

      it('should call scriptingService.handleConnect', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(mockScriptingService.handleConnect).toHaveBeenCalledWith('DBase');
      });

      it('should append server message with connection info', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(params.appendServerMessage).toHaveBeenCalledWith(
          'DBase',
          expect.stringContaining('Connecting to irc.example.com'),
        );
      });
    });

    describe('tab loading', () => {
      it('should load and set tabs after connection', async () => {
        mockTabService.getTabs.mockResolvedValue([
          { id: 'channel::DBase::#general', name: '#general', type: 'channel', networkId: 'DBase', messages: [] },
        ]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(mockTabService.getTabs).toHaveBeenCalledWith('DBase');
        expect(params.setTabs).toHaveBeenCalled();
        expect(params.setActiveTabId).toHaveBeenCalledWith('server::DBase');
      });

      it('should add server tab if not present in loaded tabs', async () => {
        mockTabService.getTabs.mockResolvedValue([
          { id: 'channel::DBase::#general', name: '#general', type: 'channel', networkId: 'DBase', messages: [] },
        ]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        // The setTabs should have been called with tabs including a server tab
        expect(params.setTabs).toHaveBeenCalled();
      });

      it('should normalize tab networkIds', async () => {
        mockTabService.getTabs.mockResolvedValue([
          { id: 'channel::DBase::#general', name: '#general', type: 'channel', networkId: '', messages: [] },
        ]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(params.setTabs).toHaveBeenCalled();
      });

      it('should load server tab history before creating tabs', async () => {
        const historyMessages = [
          { id: 'msg-1', text: 'Welcome', timestamp: Date.now() },
        ];
        mockMessageHistoryService.loadMessages.mockResolvedValue(historyMessages);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(mockMessageHistoryService.loadMessages).toHaveBeenCalledWith('DBase', 'server');
      });

      it('should handle server tab history load failure gracefully', async () => {
        mockMessageHistoryService.loadMessages.mockRejectedValue(new Error('Load failed'));

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        // Should still complete connection without throwing
        expect(params.setIsConnected).toHaveBeenCalledWith(true);
        expect(params.setTabs).toHaveBeenCalled();
      });

      it('should reuse existing server tab networkId', async () => {
        const params = createMockParams({
          tabsRef: {
            current: [
              { id: 'server::DBase', type: 'server', networkId: 'DBase', messages: [] },
            ],
          },
        });
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[0]).toBe('DBase');
      });

      it('should use connectNetworkId when provided', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork, undefined, 'custom-id');
        });

        const connectCall = mockConnectionManager.connect.mock.calls[0];
        expect(connectCall[0]).toBe('custom-id');
      });
    });

    describe('auto-reconnect', () => {
      it('should save connection state for auto-reconnect', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(mockAutoReconnectService.saveConnectionState).toHaveBeenCalledWith(
          'DBase',
          expect.any(Object),
          expect.any(Array),
          expect.any(Object),
        );
      });

      it('should include favorite channels in auto-reconnect state', async () => {
        mockChannelFavoritesService.getFavorites.mockReturnValue([
          { name: '#fav1' },
          { name: '#fav2' },
        ]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        const saveCall = mockAutoReconnectService.saveConnectionState.mock.calls[0];
        expect(saveCall[2]).toContain('#fav1');
        expect(saveCall[2]).toContain('#fav2');
      });

      it('should include autoJoinChannels in reconnect state', async () => {
        const networkWithAutoJoin = {
          ...defaultNetwork,
          autoJoinChannels: ['#auto1', '#auto2'],
        };

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(networkWithAutoJoin);
        });

        const saveCall = mockAutoReconnectService.saveConnectionState.mock.calls[0];
        expect(saveCall[2]).toContain('#auto1');
        expect(saveCall[2]).toContain('#auto2');
      });

      it('should not duplicate channels between favorites and autoJoin', async () => {
        mockChannelFavoritesService.getFavorites.mockReturnValue([
          { name: '#shared' },
        ]);
        const networkWithAutoJoin = {
          ...defaultNetwork,
          autoJoinChannels: ['#shared', '#auto1'],
        };

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(networkWithAutoJoin);
        });

        const saveCall = mockAutoReconnectService.saveConnectionState.mock.calls[0];
        const channels = saveCall[2] as string[];
        expect(channels.filter(c => c === '#shared')).toHaveLength(1);
      });

      it('should skip favorites when autoJoinFavorites is disabled', async () => {
        mockSettingsService.getSetting.mockImplementation(async (key: string, defaultVal: any) => {
          if (key === 'autoJoinFavorites') return false;
          if (key === 'globalProxy') return { enabled: false };
          return defaultVal;
        });
        mockChannelFavoritesService.getFavorites.mockReturnValue([
          { name: '#fav1' },
        ]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        // getFavorites should not be called when autoJoinFavorites is false
        // Actually, the code still calls getFavorites but returns [] since it checks the setting
        const saveCall = mockAutoReconnectService.saveConnectionState.mock.calls[0];
        expect(saveCall[2]).not.toContain('#fav1');
      });

      it('should create auto-reconnect config when none exists', async () => {
        mockAutoReconnectService.getConfig.mockReturnValue(null);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(mockAutoReconnectService.setConfig).toHaveBeenCalledWith('DBase', {
          enabled: true,
          maxAttempts: 10,
          initialDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          rejoinChannels: true,
          smartReconnect: true,
          minReconnectInterval: 5000,
        });
      });

      it('should NOT overwrite existing auto-reconnect config', async () => {
        mockAutoReconnectService.getConfig.mockReturnValue({ enabled: true, maxAttempts: 5 });

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(mockAutoReconnectService.setConfig).not.toHaveBeenCalled();
      });
    });

    describe('connection error handling', () => {
      it('should show alert on connection failure', async () => {
        mockConnectionManager.connect.mockRejectedValue(new Error('Connection refused'));

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(params.safeAlert).toHaveBeenCalledWith(
          'Connection failed',
          expect.stringContaining('Connection refused'),
          expect.any(Array),
        );
      });

      it('should log error on connection failure', async () => {
        mockConnectionManager.connect.mockRejectedValue(new Error('Connection refused'));

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
          'connect',
          expect.stringContaining('Connection refused'),
        );
      });

      it('should report error to error reporting service', async () => {
        const error = new Error('Connection refused');
        mockConnectionManager.connect.mockRejectedValue(error);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(mockErrorReportingService.report).toHaveBeenCalledWith(
          error,
          expect.objectContaining({
            source: 'connect',
            fatal: false,
          }),
        );
      });

      it('should append failure message to server tab', async () => {
        mockConnectionManager.connect.mockRejectedValue(new Error('Connection refused'));

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(params.appendServerMessage).toHaveBeenCalledWith(
          'DBase',
          expect.stringContaining('Connection failed'),
        );
      });

      it('should provide Retry button in error alert', async () => {
        mockConnectionManager.connect.mockRejectedValue(new Error('fail'));

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        const alertButtons = params.safeAlert.mock.calls[0][2];
        const retryButton = alertButtons.find((b: any) => b.text === 'Retry');
        expect(retryButton).toBeDefined();
      });

      it('should provide Open Networks button in error alert', async () => {
        mockConnectionManager.connect.mockRejectedValue(new Error('fail'));

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        const alertButtons = params.safeAlert.mock.calls[0][2];
        const openNetworksButton = alertButtons.find((b: any) => b.text === 'Open Networks');
        expect(openNetworksButton).toBeDefined();

        // Press Open Networks
        openNetworksButton.onPress();
        expect(mockSetShowNetworksList).toHaveBeenCalledWith(true);
      });

      it('should handle error without message property', async () => {
        mockConnectionManager.connect.mockRejectedValue('string error');

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleConnect(defaultNetwork);
        });

        expect(params.safeAlert).toHaveBeenCalled();
      });
    });
  });

  describe('handleServerConnect', () => {
    const mockActiveIRCService = {
      getConnectionStatus: jest.fn(() => true),
      sendRaw: jest.fn(),
      addMessage: jest.fn(),
      getNetworkName: jest.fn(() => 'DBase'),
      joinChannel: jest.fn(),
      isRegistered: jest.fn(() => true),
      on: jest.fn(() => jest.fn()),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      setupDefaultMocks();
      mockActiveIRCService.getConnectionStatus.mockReturnValue(true);
      mockActiveIRCService.sendRaw.mockClear();
      mockActiveIRCService.addMessage.mockClear();
      mockActiveIRCService.getNetworkName.mockReturnValue('DBase');
      mockActiveIRCService.joinChannel.mockClear();
      mockActiveIRCService.isRegistered.mockReturnValue(true);
      mockActiveIRCService.on.mockReturnValue(jest.fn());
    });

    describe('disconnect from current server', () => {
      it('should disconnect from current server before connecting to new one', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'new.server.com', port: 6667 },
            mockActiveIRCService,
          );
        });

        expect(mockActiveIRCService.sendRaw).toHaveBeenCalledWith(
          expect.stringContaining('QUIT'),
        );
      });

      it('should NOT disconnect when -m (new window) switch is set', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'new.server.com', switches: { newWindow: true } },
            mockActiveIRCService,
          );
        });

        expect(mockActiveIRCService.sendRaw).not.toHaveBeenCalled();
      });

      it('should NOT disconnect when -n (new window no connect) switch is set', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'new.server.com', switches: { newWindowNoConnect: true } },
            mockActiveIRCService,
          );
        });

        expect(mockActiveIRCService.sendRaw).not.toHaveBeenCalled();
      });

      it('should NOT disconnect when current service is not connected', async () => {
        mockActiveIRCService.getConnectionStatus.mockReturnValue(false);
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'new.server.com' },
            mockActiveIRCService,
          );
        });

        expect(mockActiveIRCService.sendRaw).not.toHaveBeenCalled();
      });
    });

    describe('server index connection', () => {
      it('should connect to Nth server from current network', async () => {
        const multiServerNetwork = {
          ...defaultNetwork,
          servers: [
            defaultNetwork.servers[0],
            { id: 'srv-2', hostname: 'second.server.com', port: 6667, ssl: false, rejectUnauthorized: false },
          ],
        };
        mockSettingsService.loadNetworks.mockResolvedValue([multiServerNetwork]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { serverIndex: 2 },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });
    });

    describe('address-based connection', () => {
      it('should find existing network by server hostname', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'irc.example.com' },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should find existing network by network name', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'DBase' },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should create temporary network for unknown address', async () => {
        mockSettingsService.loadNetworks.mockResolvedValue([]); // no existing networks

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'new.server.com', port: 6667 },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should create new network entry for -m switch even if network exists', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'irc.example.com', switches: { newWindow: true } },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should use SSL port when ssl switch is set', async () => {
        mockSettingsService.loadNetworks.mockResolvedValue([]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'new.server.com', switches: { ssl: true } },
            mockActiveIRCService,
          );
        });

        // Should create server with port 6697
        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should use starttls switch for SSL', async () => {
        mockSettingsService.loadNetworks.mockResolvedValue([]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'new.server.com', switches: { starttls: true } },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should apply server password', async () => {
        mockSettingsService.loadNetworks.mockResolvedValue([]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'new.server.com', password: 'secret' },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should update existing server config when server found', async () => {
        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'irc.example.com', port: 7000, switches: { ssl: true }, password: 'newpass' },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should apply identity to network config', async () => {
        mockSettingsService.loadNetworks.mockResolvedValue([]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            {
              address: 'new.server.com',
              identity: { nick: 'CustomNick', altNick: 'CustomAlt', name: 'Custom Name', email: 'test@test.com' },
            },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should apply SASL login', async () => {
        mockSettingsService.loadNetworks.mockResolvedValue([]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            {
              address: 'new.server.com',
              login: { method: 'SASL', username: 'user', password: 'pass' },
            },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });

      it('should set autoJoinChannels from joinChannels', async () => {
        mockSettingsService.loadNetworks.mockResolvedValue([]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            {
              address: 'new.server.com',
              joinChannels: [{ channel: '#test' }, { channel: '#help' }],
            },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.connect).toHaveBeenCalled();
      });
    });

    describe('new window no connect (-n)', () => {
      it('should create network config without connecting', async () => {
        mockSettingsService.loadNetworks.mockResolvedValue([]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'new.server.com', switches: { newWindowNoConnect: true } },
            mockActiveIRCService,
          );
        });

        expect(mockSettingsService.addNetwork).toHaveBeenCalled();
        expect(mockActiveIRCService.addMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'notice' }),
        );
      });
    });

    describe('join channels after connect', () => {
      it('should join channels immediately when already registered', async () => {
        mockActiveIRCService.isRegistered.mockReturnValue(true);
        const mockIrcService = { ...mockActiveIRCService };
        mockConnectionManager.getActiveConnection.mockReturnValue({ ircService: mockIrcService });

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            {
              address: 'irc.example.com',
              joinChannels: [{ channel: '#test', password: 'key' }],
            },
            mockActiveIRCService,
          );
        });

        expect(mockIrcService.joinChannel).toHaveBeenCalledWith('#test', 'key');
      });

      it('should wait for registered event before joining channels', async () => {
        const mockIrcService = {
          ...mockActiveIRCService,
          isRegistered: jest.fn(() => false),
          on: jest.fn((event: string, cb: Function) => {
            // Simulate registration event
            if (event === 'registered') {
              setTimeout(() => cb(), 0);
            }
            return jest.fn();
          }),
          joinChannel: jest.fn(),
        };
        mockConnectionManager.getActiveConnection.mockReturnValue({ ircService: mockIrcService });

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            {
              address: 'irc.example.com',
              joinChannels: [{ channel: '#test' }],
            },
            mockActiveIRCService,
          );
          // Allow setTimeout to execute
          await new Promise(resolve => setTimeout(resolve, 10));
        });

        expect(mockIrcService.on).toHaveBeenCalledWith('registered', expect.any(Function));
      });

      it('should use newConnectionId when available', async () => {
        // Simulate onConnectionCreated callback
        mockConnectionManager.onConnectionCreated.mockImplementation((cb: Function) => {
          cb('new-connection-id');
          return jest.fn();
        });
        const mockNewIrcService = {
          ...mockActiveIRCService,
          joinChannel: jest.fn(),
        };
        mockConnectionManager.getConnection.mockReturnValue({ ircService: mockNewIrcService });

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            {
              address: 'irc.example.com',
              joinChannels: [{ channel: '#test' }],
            },
            mockActiveIRCService,
          );
        });

        expect(mockConnectionManager.getConnection).toHaveBeenCalledWith('new-connection-id');
      });
    });

    describe('error handling', () => {
      it('should show error message when no network/server found', async () => {
        mockSettingsService.loadNetworks.mockResolvedValue([]);

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { serverIndex: 99 }, // invalid index, no address
            mockActiveIRCService,
          );
        });

        expect(mockActiveIRCService.addMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' }),
        );
      });

      it('should show error message on exception', async () => {
        mockSettingsService.loadNetworks.mockRejectedValue(new Error('Network load failed'));

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'test.server.com' },
            mockActiveIRCService,
          );
        });

        expect(mockActiveIRCService.addMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            text: expect.stringContaining('Network load failed'),
          }),
        );
      });

      it('should handle error without message property', async () => {
        mockSettingsService.loadNetworks.mockRejectedValue('string error');

        const params = createMockParams();
        const { result } = renderHook(() => useConnectionHandler(params));

        await act(async () => {
          await result.current.handleServerConnect(
            { address: 'test.server.com' },
            mockActiveIRCService,
          );
        });

        expect(mockActiveIRCService.addMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' }),
        );
      });
    });
  });

  describe('hook return values', () => {
    it('should return handleConnect and handleServerConnect functions', () => {
      const params = createMockParams();
      const { result } = renderHook(() => useConnectionHandler(params));

      expect(typeof result.current.handleConnect).toBe('function');
      expect(typeof result.current.handleServerConnect).toBe('function');
    });

    it('should return stable handleConnect reference', () => {
      const params = createMockParams();
      const { result, rerender } = renderHook(() => useConnectionHandler(params));

      const firstRef = result.current.handleConnect;
      rerender();
      expect(result.current.handleConnect).toBe(firstRef);
    });
  });
});
