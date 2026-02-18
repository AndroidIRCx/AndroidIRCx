/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('../src/services/IRCService', () => {
  return {
    IRCService: jest.fn(() => ({
      networkId: '',
      isConnected: false,
      connect: jest.fn().mockResolvedValue(undefined),
      addRawMessage: jest.fn(),
      setNetworkId: jest.fn(),
      setUserManagementService: jest.fn(),
      setNotifyService: jest.fn(),
      on: jest.fn(() => () => {}),
      onConnectionChange: jest.fn(() => () => {}),
      onMessage: jest.fn(() => () => {}),
      sendRaw: jest.fn(),
      getConnectionStatus: jest.fn(() => false),
      disconnect: jest.fn(),
      isSaslAvailable: jest.fn(() => false),
      isSaslAuthenticating: jest.fn(() => false),
      isSaslExternal: jest.fn(() => false),
      isSaslPlain: jest.fn(() => false),
      getSaslAccount: jest.fn(() => undefined),
      getCurrentNick: jest.fn(() => 'testnick'),
    })),
  };
});

const serviceStub = (name: string) =>
  jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    setIRCService: jest.fn(),
    log: jest.fn(),
    name,
  }));

jest.mock('../src/services/ChannelManagementService', () => ({
  ChannelManagementService: serviceStub('ChannelManagementService'),
}));
jest.mock('../src/services/ChannelListService', () => ({
  ChannelListService: serviceStub('ChannelListService'),
}));
jest.mock('../src/services/AutoRejoinService', () => ({
  AutoRejoinService: serviceStub('AutoRejoinService'),
}));
jest.mock('../src/services/AutoVoiceService', () => ({
  AutoVoiceService: serviceStub('AutoVoiceService'),
}));
jest.mock('../src/services/ConnectionQualityService', () => ({
  ConnectionQualityService: serviceStub('ConnectionQualityService'),
}));
jest.mock('../src/services/BouncerService', () => ({
  BouncerService: serviceStub('BouncerService'),
}));
jest.mock('../src/services/STSService', () => ({
  STSService: serviceStub('STSService'),
}));
jest.mock('../src/services/CommandService', () => ({
  CommandService: serviceStub('CommandService'),
}));

jest.mock('../src/services/AutoAuthService', () => ({
  createAutoAuthService: jest.fn(() => ({
    authenticate: jest.fn().mockResolvedValue({ success: true, method: 'nickserv' }),
    isAuthenticated: jest.fn(() => false),
    getStatus: jest.fn(() => ({ attempted: false, completed: false, method: 'nickserv' })),
    updateSaslStatus: jest.fn(),
    reset: jest.fn(),
    destroy: jest.fn(),
  })),
  AutoAuthService: jest.fn(),
}));

jest.mock('../src/services/ServiceDetectionService', () => ({
  serviceDetectionService: {
    initializeNetwork: jest.fn(),
    cleanupNetwork: jest.fn(),
    onDetection: jest.fn(() => () => {}),
    processISupport: jest.fn(),
    processNetworkName: jest.fn(),
    getDetectionResult: jest.fn(() => undefined),
    getServiceConfig: jest.fn(() => undefined),
  },
  ServiceDetectionService: jest.fn(),
}));

jest.mock('../src/services/ServiceCommandProvider', () => ({
  serviceCommandProvider: {
    clearCache: jest.fn(),
  },
}));

jest.mock('../src/services/AutoReconnectService', () => ({
  autoReconnectService: {
    registerConnection: jest.fn(),
    unregisterConnection: jest.fn(),
  },
}));

jest.mock('../src/services/IRCForegroundService', () => ({
  ircForegroundService: {
    isServiceRunning: jest.fn(() => false),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    updateNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

import { IRCNetworkConfig } from '../src/services/SettingsService';

let connectionManager: any;
let UserManagementServiceRef: any;

describe('ConnectionManager', () => {
  const baseNetwork: IRCNetworkConfig = {
    id: 'net',
    name: 'net',
    nick: 'n',
    realname: 'r',
    servers: [{ id: 'srv', hostname: 'irc.test', port: 6667, ssl: false }],
  };

  afterEach(() => {
    if (connectionManager) {
      connectionManager.connections.clear();
      connectionManager.activeConnectionId = null;
    }
    jest.restoreAllMocks();
    jest.resetModules();
  });

  beforeEach(() => {
    jest.isolateModules(() => {
      const { UserManagementService } = require('../src/services/UserManagementService');
      UserManagementServiceRef = UserManagementService;
      jest.spyOn(UserManagementServiceRef.prototype, 'initialize').mockResolvedValue();
      jest.spyOn(UserManagementServiceRef.prototype as any, 'loadFromStorage').mockResolvedValue(undefined);

      const mod = require('../src/services/ConnectionManager');
      connectionManager = mod.connectionManager;
    });
  });

  it('creates a connection and sets active id', async () => {
    const config = { host: 'irc.test', port: 6667, nick: 'n' } as any;
    const id = await connectionManager.connect('net', baseNetwork, config);
    expect(id).toBe('net');
    expect(connectionManager.getActiveNetworkId()).toBe('net');
  });

  it('reuses network id if existing is disconnected', async () => {
    const config = { host: 'irc.test', port: 6667, nick: 'n' } as any;
    const id = await connectionManager.connect('net', baseNetwork, config);
    const ctx = (connectionManager as any).connections.get(id) as any;
    ctx.ircService.disconnect();
    const reused = await connectionManager.connect('net', baseNetwork, config);
    expect(reused).toBe('net');
  });

  it('returns new id when active connection already exists', async () => {
    const config = { host: 'irc.test', port: 6667, nick: 'n' } as any;
    await connectionManager.connect('net', baseNetwork, config);
    const ctx = (connectionManager as any).connections.get('net') as any;
    ctx.ircService.getConnectionStatus.mockReturnValue(true);
    const second = await connectionManager.connect('net', baseNetwork, config);
    expect(second).toContain('(1)');
  });

  it('disconnects all connections', async () => {
    const config = { host: 'irc.test', port: 6667, nick: 'n' } as any;
    await connectionManager.connect('net', baseNetwork, config);
    connectionManager.disconnectAll();
    expect(connectionManager.getActiveNetworkId()).toBe(null);
  });

  it('initializes user management service per connection', async () => {
    const config = { host: 'irc.test', port: 6667, nick: 'n' } as any;
    await connectionManager.connect('net', baseNetwork, config);
    const ctx = (connectionManager as any).connections.get('net') as any;
    expect(ctx.userManagementService).toBeInstanceOf(UserManagementServiceRef);
    expect(typeof ctx.ircService.connect).toBe('function');
  });
});
