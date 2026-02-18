/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ConnectionManager - Wave 2 coverage target
 */

import { ConnectionManager, ConnectionContext } from '../../src/services/ConnectionManager';

// Mock all dependencies
const mockIRCService = {
  on: jest.fn().mockReturnValue(jest.fn()),
  onMessage: jest.fn().mockReturnValue(jest.fn()),
  onConnectionChange: jest.fn().mockReturnValue(jest.fn()),
  getNetworkName: jest.fn().mockReturnValue('freenode'),
  getCurrentNick: jest.fn().mockReturnValue('TestUser'),
  getConnectionStatus: jest.fn().mockReturnValue(true),
  addRawMessage: jest.fn(),
  sendRaw: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  setNetworkId: jest.fn(),
  setUserManagementService: jest.fn(),
  setNotifyService: jest.fn(),
  isSaslAvailable: jest.fn().mockReturnValue(false),
};

const mockAutoReconnectService = {
  registerConnection: jest.fn(),
  unregisterConnection: jest.fn(),
};

const mockServiceDetectionService = {
  initializeNetwork: jest.fn(),
  onDetection: jest.fn().mockReturnValue(jest.fn()),
  processISupport: jest.fn(),
  processNetworkName: jest.fn(),
  cleanupNetwork: jest.fn(),
};

const mockServiceCommandProvider = {
  clearCache: jest.fn(),
};

const mockIRCForegroundService = {
  isServiceRunning: jest.fn().mockReturnValue(false),
  updateNotification: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
};

const mockIdentityProfilesService = {
  get: jest.fn().mockResolvedValue(null),
};

const mockSettingsService = {
  loadNetworks: jest.fn().mockResolvedValue([]),
  getNetwork: jest.fn().mockResolvedValue(null),
  addServerToNetwork: jest.fn().mockResolvedValue(undefined),
  saveNetworks: jest.fn().mockResolvedValue(undefined),
  getSetting: jest.fn().mockResolvedValue(null),
};

const mockAutoAuthService = {
  initialize: jest.fn(),
  destroy: jest.fn(),
  updateSaslStatus: jest.fn(),
  isAuthenticated: jest.fn().mockReturnValue(false),
  authenticate: jest.fn().mockResolvedValue({ success: false }),
};

jest.mock('../../src/services/IRCService', () => ({
  IRCService: jest.fn().mockImplementation(() => mockIRCService),
  ircService: mockIRCService,
}));

jest.mock('../../src/services/AutoReconnectService', () => ({
  autoReconnectService: mockAutoReconnectService,
}));

jest.mock('../../src/services/ServiceDetectionService', () => ({
  serviceDetectionService: mockServiceDetectionService,
}));

jest.mock('../../src/services/ServiceCommandProvider', () => ({
  serviceCommandProvider: mockServiceCommandProvider,
}));

jest.mock('../../src/services/IRCForegroundService', () => ({
  ircForegroundService: mockIRCForegroundService,
}));

jest.mock('../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: mockIdentityProfilesService,
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: mockSettingsService,
  NEW_FEATURE_DEFAULTS: {},
}));

jest.mock('../../src/services/AutoAuthService', () => ({
  createAutoAuthService: jest.fn().mockReturnValue(mockAutoAuthService),
  AutoAuthService: jest.fn(),
}));

// Mock other services
jest.mock('../../src/services/ChannelManagementService', () => ({
  ChannelManagementService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
  })),
}));

jest.mock('../../src/services/UserManagementService', () => ({
  UserManagementService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    setIRCService: jest.fn(),
  })),
}));

jest.mock('../../src/services/ChannelListService', () => ({
  ChannelListService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
  })),
}));

jest.mock('../../src/services/AutoRejoinService', () => ({
  AutoRejoinService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    destroy: jest.fn(),
  })),
}));

jest.mock('../../src/services/AutoVoiceService', () => ({
  AutoVoiceService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
  })),
}));

jest.mock('../../src/services/ConnectionQualityService', () => ({
  ConnectionQualityService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    setIRCService: jest.fn(),
  })),
}));

jest.mock('../../src/services/BouncerService', () => ({
  BouncerService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
  })),
}));

jest.mock('../../src/services/STSService', () => ({
  STSService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../src/services/CommandService', () => ({
  CommandService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    setIRCService: jest.fn(),
  })),
}));

jest.mock('../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string, params?: Record<string, unknown>) => {
      let result = key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, String(v));
        });
      }
      return result;
    },
  },
}));

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get fresh instance
    const { connectionManager: cm } = require('../../src/services/ConnectionManager');
    connectionManager = cm;
    // Clear any existing connections
    connectionManager.disconnectAll();
  });

  describe('onConnectionCreated', () => {
    it('should register callback and return cleanup function', () => {
      const callback = jest.fn();
      const cleanup = connectionManager.onConnectionCreated(callback);
      
      expect(typeof cleanup).toBe('function');
      
      // Cleanup should remove the callback
      cleanup();
    });

    it('should emit connection-created events to registered callbacks', async () => {
      const callback = jest.fn();
      connectionManager.onConnectionCreated(callback);

      const networkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false }],
      };
      const connectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect('test-network', networkConfig, connectionConfig);

      expect(callback).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('connect', () => {
    const mockNetworkConfig = {
      id: 'test-network',
      name: 'TestNetwork',
      nick: 'TestNick',
      servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false, rejectUnauthorized: true }],
    };
    const mockConnectionConfig = {
      host: 'irc.test.com',
      port: 6667,
      useTLS: false,
    };

    it('should create a new connection', async () => {
      const id = await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should create unique ID for duplicate connections', async () => {
      mockIRCService.getConnectionStatus.mockReturnValue(true);
      
      const id1 = await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      const id2 = await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      
      expect(id1).not.toBe(id2);
      expect(id2).toMatch(/test-network \(\d+\)/);
    });

    it('should reuse disconnected connection slot', async () => {
      mockIRCService.getConnectionStatus.mockReturnValue(false);
      
      const id = await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      expect(id).toBe('test-network');
    });

    it('should warn about insecure TLS configuration', async () => {
      const insecureConfig = {
        ...mockNetworkConfig,
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: true, rejectUnauthorized: false }],
      };
      
      await connectionManager.connect('test-network', insecureConfig, mockConnectionConfig);
      
      expect(mockIRCService.addRawMessage).toHaveBeenCalledWith(
        expect.stringContaining('TLS certificate verification is disabled'),
        'connection'
      );
    });

    it('should set up NickServ IDENTIFY when password is provided', async () => {
      const configWithPassword = {
        ...mockNetworkConfig,
        nickservPassword: 'secret123',
      };
      
      await connectionManager.connect('test-network', configWithPassword, mockConnectionConfig);
      
      expect(mockIRCService.on).toHaveBeenCalledWith('motdEnd', expect.any(Function));
    });

    it('should set up identity profile commands', async () => {
      const configWithProfile = {
        ...mockNetworkConfig,
        identityProfileId: 'profile-1',
      };
      
      mockIdentityProfilesService.get.mockResolvedValue({
        operPassword: 'operPass',
        operUser: 'operUser',
        onConnectCommands: ['/msg NickServ identify pass'],
      });
      
      await connectionManager.connect('test-network', configWithProfile, mockConnectionConfig);
      
      expect(mockIRCService.on).toHaveBeenCalledWith('motdEnd', expect.any(Function));
    });

    it('should register with AutoReconnectService', async () => {
      await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      
      expect(mockAutoReconnectService.registerConnection).toHaveBeenCalled();
    });

    it('should set the new connection as active', async () => {
      await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      
      expect(connectionManager.getActiveNetworkId()).toBe('test-network');
    });
  });

  describe('disconnect', () => {
    it('should clean up resources when disconnecting', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false, rejectUnauthorized: true }],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      connectionManager.disconnect('test-network');
      
      expect(mockAutoReconnectService.unregisterConnection).toHaveBeenCalledWith('test-network');
      expect(mockIRCService.disconnect).toHaveBeenCalled();
      expect(mockServiceDetectionService.cleanupNetwork).toHaveBeenCalledWith('test-network');
      expect(mockServiceCommandProvider.clearCache).toHaveBeenCalledWith('test-network');
    });

    it('should handle non-existent network gracefully', () => {
      expect(() => connectionManager.disconnect('non-existent')).not.toThrow();
    });

    it('should update active connection when disconnecting active', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false, rejectUnauthorized: true }],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      expect(connectionManager.getActiveNetworkId()).toBe('test-network');
      
      connectionManager.disconnect('test-network');
      expect(connectionManager.getActiveNetworkId()).toBeNull();
    });
  });

  describe('getConnection', () => {
    it('should return undefined for non-existent network', () => {
      expect(connectionManager.getConnection('non-existent')).toBeUndefined();
    });

    it('should return connection context for existing network', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false, rejectUnauthorized: true }],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      const context = connectionManager.getConnection('test-network');
      
      expect(context).toBeDefined();
      expect(context?.networkId).toBe('test-network');
    });
  });

  describe('getActiveConnection', () => {
    it('should return undefined when no active connection', () => {
      expect(connectionManager.getActiveConnection()).toBeUndefined();
    });

    it('should return active connection context', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false, rejectUnauthorized: true }],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      const active = connectionManager.getActiveConnection();
      
      expect(active).toBeDefined();
      expect(active?.networkId).toBe('test-network');
    });
  });

  describe('setActiveConnection', () => {
    it('should set active connection for existing network', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false, rejectUnauthorized: true }],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect('network-1', mockNetworkConfig, mockConnectionConfig);
      await connectionManager.connect('network-2', mockNetworkConfig, mockConnectionConfig);
      
      connectionManager.setActiveConnection('network-2');
      expect(connectionManager.getActiveNetworkId()).toBe('network-2');
    });

    it('should not set active connection for non-existent network', () => {
      connectionManager.setActiveConnection('non-existent');
      expect(connectionManager.getActiveNetworkId()).toBeNull();
    });
  });

  describe('getAllConnections', () => {
    it('should return empty array when no connections', () => {
      expect(connectionManager.getAllConnections()).toEqual([]);
    });

    it('should return all connections', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false, rejectUnauthorized: true }],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect('network-1', mockNetworkConfig, mockConnectionConfig);
      await connectionManager.connect('network-2', mockNetworkConfig, mockConnectionConfig);
      
      const connections = connectionManager.getAllConnections();
      expect(connections).toHaveLength(2);
    });
  });

  describe('hasConnection', () => {
    it('should return false for non-existent network', () => {
      expect(connectionManager.hasConnection('non-existent')).toBe(false);
    });

    it('should return true for existing network', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false, rejectUnauthorized: true }],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      expect(connectionManager.hasConnection('test-network')).toBe(true);
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all connections', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false, rejectUnauthorized: true }],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect('network-1', mockNetworkConfig, mockConnectionConfig);
      await connectionManager.connect('network-2', mockNetworkConfig, mockConnectionConfig);
      
      expect(connectionManager.getAllConnections()).toHaveLength(2);
      
      connectionManager.disconnectAll('Test disconnect');
      
      expect(connectionManager.getAllConnections()).toHaveLength(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all connections and reset state', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false, rejectUnauthorized: true }],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect('network-1', mockNetworkConfig, mockConnectionConfig);
      
      connectionManager.clearAll();
      
      expect(connectionManager.getAllConnections()).toHaveLength(0);
      expect(connectionManager.getActiveNetworkId()).toBeNull();
    });
  });

  describe('getActiveNetworkId', () => {
    it('should return null when no active connection', () => {
      expect(connectionManager.getActiveNetworkId()).toBeNull();
    });

    it('should return active network ID', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [{ hostname: 'irc.test.com', port: 6667, ssl: false, rejectUnauthorized: true }],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect('test-network', mockNetworkConfig, mockConnectionConfig);
      expect(connectionManager.getActiveNetworkId()).toBe('test-network');
    });
  });
});
