/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ConnectionManager - Wave 2 coverage target
 */

import { ConnectionManager } from '../../src/services/ConnectionManager';

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
  sendMessage: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn(),
  setNetworkId: jest.fn(),
  setWhoisUseDoubleNick: jest.fn(),
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
    setNetwork: jest.fn(),
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
    const {
      connectionManager: cm,
    } = require('../../src/services/ConnectionManager');
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

      await connectionManager.connect(
        'test-network',
        networkConfig,
        connectionConfig,
      );

      expect(callback).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('connect', () => {
    const mockNetworkConfig = {
      id: 'test-network',
      name: 'TestNetwork',
      nick: 'TestNick',
      servers: [
        {
          hostname: 'irc.test.com',
          port: 6667,
          ssl: false,
          rejectUnauthorized: true,
        },
      ],
    };
    const mockConnectionConfig = {
      host: 'irc.test.com',
      port: 6667,
      useTLS: false,
    };

    it('should create a new connection', async () => {
      const id = await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should create unique ID for duplicate connections', async () => {
      mockIRCService.getConnectionStatus.mockReturnValue(true);

      const id1 = await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );
      const id2 = await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );

      expect(id1).not.toBe(id2);
      expect(id2).toMatch(/test-network \(\d+\)/);
    });

    it('should reuse disconnected connection slot', async () => {
      mockIRCService.getConnectionStatus.mockReturnValue(false);

      const id = await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );
      expect(id).toBe('test-network');
    });

    it('should warn about insecure TLS configuration', async () => {
      const insecureConfig = {
        ...mockNetworkConfig,
        servers: [
          {
            hostname: 'irc.test.com',
            port: 6667,
            ssl: true,
            rejectUnauthorized: false,
          },
        ],
      };

      await connectionManager.connect(
        'test-network',
        insecureConfig,
        mockConnectionConfig,
      );

      expect(mockIRCService.addRawMessage).toHaveBeenCalledWith(
        expect.stringContaining('TLS certificate verification is disabled'),
        'connection',
      );
    });

    it('should set up NickServ IDENTIFY when password is provided', async () => {
      const configWithPassword = {
        ...mockNetworkConfig,
        nickservPassword: 'secret123',
      };

      await connectionManager.connect(
        'test-network',
        configWithPassword,
        mockConnectionConfig,
      );

      expect(mockIRCService.on).toHaveBeenCalledWith(
        'motdEnd',
        expect.any(Function),
      );
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

      await connectionManager.connect(
        'test-network',
        configWithProfile,
        mockConnectionConfig,
      );

      expect(mockIRCService.on).toHaveBeenCalledWith(
        'motdEnd',
        expect.any(Function),
      );
    });

    it('should normalize /quote and /raw in identity profile on-connect commands', async () => {
      const configWithProfile = {
        ...mockNetworkConfig,
        identityProfileId: 'profile-1',
      };

      mockIdentityProfilesService.get.mockResolvedValue({
        onConnectCommands: [
          '/quote PASS testpass',
          '/raw WHOIS Nick Nick',
          'PRIVMSG NickServ :IDENTIFY x',
        ],
      });

      await connectionManager.connect(
        'test-network',
        configWithProfile,
        mockConnectionConfig,
      );

      const motdEndHandler = mockIRCService.on.mock.calls.find(
        (call: [string, Function]) => call[0] === 'motdEnd',
      )?.[1];
      expect(typeof motdEndHandler).toBe('function');

      await motdEndHandler?.();

      expect(mockIRCService.sendRaw).toHaveBeenCalledWith('PASS testpass');
      expect(mockIRCService.sendRaw).toHaveBeenCalledWith('WHOIS Nick Nick');
      expect(mockIRCService.sendRaw).toHaveBeenCalledWith(
        'PRIVMSG NickServ :IDENTIFY x',
      );
    });

    it('should route slash commands from identity profile through sendMessage parser', async () => {
      const configWithProfile = {
        ...mockNetworkConfig,
        identityProfileId: 'profile-1',
      };

      mockIdentityProfilesService.get.mockResolvedValue({
        nick: 'ProfileNick',
        onConnectCommands: ['/whois AndroidIRcxBridge', '/join #AndroidIRCx'],
      });

      await connectionManager.connect(
        'test-network',
        configWithProfile,
        mockConnectionConfig,
      );

      const motdEndHandler = mockIRCService.on.mock.calls.find(
        (call: [string, Function]) => call[0] === 'motdEnd',
      )?.[1];
      expect(typeof motdEndHandler).toBe('function');

      await motdEndHandler?.();

      expect(mockIRCService.sendMessage).toHaveBeenCalledWith(
        'TestUser',
        '/whois AndroidIRcxBridge',
      );
      expect(mockIRCService.sendMessage).toHaveBeenCalledWith(
        'TestUser',
        '/join #AndroidIRCx',
      );
    });

    it('should register with AutoReconnectService', async () => {
      await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );

      expect(mockAutoReconnectService.registerConnection).toHaveBeenCalled();
    });

    it('should set the new connection as active', async () => {
      await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );

      expect(connectionManager.getActiveNetworkId()).toBe('test-network');
    });
  });

  describe('disconnect', () => {
    it('should clean up resources when disconnecting', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [
          {
            hostname: 'irc.test.com',
            port: 6667,
            ssl: false,
            rejectUnauthorized: true,
          },
        ],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );
      connectionManager.disconnect('test-network');

      expect(
        mockAutoReconnectService.unregisterConnection,
      ).toHaveBeenCalledWith('test-network');
      expect(mockIRCService.disconnect).toHaveBeenCalled();
      expect(mockServiceDetectionService.cleanupNetwork).toHaveBeenCalledWith(
        'test-network',
      );
      expect(mockServiceCommandProvider.clearCache).toHaveBeenCalledWith(
        'test-network',
      );
    });

    it('should handle non-existent network gracefully', () => {
      expect(() => connectionManager.disconnect('non-existent')).not.toThrow();
    });

    it('should update active connection when disconnecting active', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [
          {
            hostname: 'irc.test.com',
            port: 6667,
            ssl: false,
            rejectUnauthorized: true,
          },
        ],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );
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
        servers: [
          {
            hostname: 'irc.test.com',
            port: 6667,
            ssl: false,
            rejectUnauthorized: true,
          },
        ],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );
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
        servers: [
          {
            hostname: 'irc.test.com',
            port: 6667,
            ssl: false,
            rejectUnauthorized: true,
          },
        ],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );
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
        servers: [
          {
            hostname: 'irc.test.com',
            port: 6667,
            ssl: false,
            rejectUnauthorized: true,
          },
        ],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect(
        'network-1',
        mockNetworkConfig,
        mockConnectionConfig,
      );
      await connectionManager.connect(
        'network-2',
        mockNetworkConfig,
        mockConnectionConfig,
      );

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
        servers: [
          {
            hostname: 'irc.test.com',
            port: 6667,
            ssl: false,
            rejectUnauthorized: true,
          },
        ],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect(
        'network-1',
        mockNetworkConfig,
        mockConnectionConfig,
      );
      await connectionManager.connect(
        'network-2',
        mockNetworkConfig,
        mockConnectionConfig,
      );

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
        servers: [
          {
            hostname: 'irc.test.com',
            port: 6667,
            ssl: false,
            rejectUnauthorized: true,
          },
        ],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );
      expect(connectionManager.hasConnection('test-network')).toBe(true);
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all connections', async () => {
      const mockNetworkConfig = {
        id: 'test-network',
        name: 'TestNetwork',
        nick: 'TestNick',
        servers: [
          {
            hostname: 'irc.test.com',
            port: 6667,
            ssl: false,
            rejectUnauthorized: true,
          },
        ],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect(
        'network-1',
        mockNetworkConfig,
        mockConnectionConfig,
      );
      await connectionManager.connect(
        'network-2',
        mockNetworkConfig,
        mockConnectionConfig,
      );

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
        servers: [
          {
            hostname: 'irc.test.com',
            port: 6667,
            ssl: false,
            rejectUnauthorized: true,
          },
        ],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect(
        'network-1',
        mockNetworkConfig,
        mockConnectionConfig,
      );

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
        servers: [
          {
            hostname: 'irc.test.com',
            port: 6667,
            ssl: false,
            rejectUnauthorized: true,
          },
        ],
      };
      const mockConnectionConfig = {
        host: 'irc.test.com',
        port: 6667,
        useTLS: false,
      };

      await connectionManager.connect(
        'test-network',
        mockNetworkConfig,
        mockConnectionConfig,
      );
      expect(connectionManager.getActiveNetworkId()).toBe('test-network');
    });
  });

  describe('additional coverage', () => {
    const baseNetworkConfig = {
      id: 'test-network',
      name: 'TestNetwork',
      nick: 'TestNick',
      servers: [
        {
          hostname: 'irc.test.com',
          port: 6667,
          ssl: false,
          rejectUnauthorized: true,
        },
      ],
    };
    const baseConnectionConfig = {
      host: 'irc.test.com',
      port: 6667,
      useTLS: false,
    };

    const flush = () => new Promise(res => setImmediate(res));

    const findHandler = (event: string): Function | undefined => {
      const call = mockIRCService.on.mock.calls.find(
        (c: [string, Function]) => c[0] === event,
      );
      return call?.[1];
    };

    const findLastHandler = (event: string): Function | undefined => {
      const calls = mockIRCService.on.mock.calls.filter(
        (c: [string, Function]) => c[0] === event,
      );
      return calls.length ? calls[calls.length - 1][1] : undefined;
    };

    afterEach(() => {
      // Restore shared mock defaults that some tests mutate.
      mockIRCService.getConnectionStatus.mockReturnValue(true);
      mockIRCForegroundService.isServiceRunning.mockReturnValue(false);
      mockIRCService.sendRaw.mockImplementation(() => {});
      mockIRCService.on.mockReturnValue(jest.fn());
      mockIRCService.getCurrentNick.mockReturnValue('TestUser');
      mockAutoAuthService.isAuthenticated.mockReturnValue(false);
      mockAutoAuthService.authenticate.mockResolvedValue({ success: false });
    });

    it('logs errors thrown by connection-created callbacks', async () => {
      const errSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      connectionManager.onConnectionCreated(() => {
        throw new Error('callback boom');
      });

      await connectionManager.connect(
        'test-network',
        baseNetworkConfig,
        baseConnectionConfig,
      );

      expect(errSpy).toHaveBeenCalledWith(
        'ConnectionManager: Error in connection-created callback:',
        expect.any(Error),
      );
      errSpy.mockRestore();
    });

    describe('updateForegroundConnectionSummary', () => {
      it('stops the foreground service when no active connections remain', async () => {
        mockIRCForegroundService.isServiceRunning.mockReturnValue(true);
        mockIRCService.getConnectionStatus.mockReturnValue(false);

        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        expect(mockIRCForegroundService.stop).toHaveBeenCalled();
      });

      it('logs an error when stopping the foreground service fails', async () => {
        const errSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        mockIRCForegroundService.isServiceRunning.mockReturnValue(true);
        mockIRCService.getConnectionStatus.mockReturnValue(false);
        mockIRCForegroundService.stop.mockRejectedValueOnce(
          new Error('stop failed'),
        );

        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        await flush();

        expect(errSpy).toHaveBeenCalledWith(
          'ConnectionManager: Failed to stop foreground service:',
          expect.any(Error),
        );
        errSpy.mockRestore();
      });

      it('updates the notification for a single active connection', async () => {
        mockIRCForegroundService.isServiceRunning.mockReturnValue(true);
        mockIRCService.getConnectionStatus.mockReturnValue(true);

        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        expect(mockIRCForegroundService.updateNotification).toHaveBeenCalledWith(
          'IRC Connected',
          expect.stringContaining('Connected to test-network'),
        );
      });

      it('logs an error when updating the notification fails', async () => {
        const errSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        mockIRCForegroundService.isServiceRunning.mockReturnValue(true);
        mockIRCService.getConnectionStatus.mockReturnValue(true);
        mockIRCForegroundService.updateNotification.mockRejectedValueOnce(
          new Error('notify failed'),
        );

        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        await flush();

        expect(errSpy).toHaveBeenCalledWith(
          'ConnectionManager: Failed to update foreground notification:',
          expect.any(Error),
        );
        errSpy.mockRestore();
      });

      it('summarizes multiple active connections with a truncated suffix', async () => {
        mockIRCForegroundService.isServiceRunning.mockReturnValue(true);
        mockIRCService.getConnectionStatus.mockReturnValue(true);

        await connectionManager.connect(
          'net-1',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        await connectionManager.connect(
          'net-2',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        await connectionManager.connect(
          'net-3',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        await connectionManager.connect(
          'net-4',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        // Last call summarizes 4 connections -> "+1" overflow suffix.
        const lastCall =
          mockIRCForegroundService.updateNotification.mock.calls[
            mockIRCForegroundService.updateNotification.mock.calls.length - 1
          ];
        expect(lastCall[0]).toBe('IRC Connected');
        expect(lastCall[1]).toContain('Connected to 4 servers');
        expect(lastCall[1]).toContain('+1');
      });
    });

    describe('connect duplicate handling', () => {
      it('increments the suffix past existing numbered ids', async () => {
        mockIRCService.getConnectionStatus.mockReturnValue(true);

        const id1 = await connectionManager.connect(
          'dup-net',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        const id2 = await connectionManager.connect(
          'dup-net',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        const id3 = await connectionManager.connect(
          'dup-net',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        expect(id1).toBe('dup-net');
        expect(id2).toBe('dup-net (1)');
        expect(id3).toBe('dup-net (2)');
      });

      it('reuses a slot occupied by an inactive connection', async () => {
        mockIRCService.getConnectionStatus.mockReturnValue(true);
        await connectionManager.connect(
          'reuse-net',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        // Simulate the existing connection now being inactive.
        mockIRCService.getConnectionStatus.mockReturnValue(false);
        const id = await connectionManager.connect(
          'reuse-net',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        expect(id).toBe('reuse-net');
        expect(mockIRCService.disconnect).toHaveBeenCalled();
      });
    });

    describe('motdEnd NickServ IDENTIFY handler', () => {
      it('sends NickServ IDENTIFY on motdEnd', async () => {
        await connectionManager.connect(
          'test-network',
          { ...baseNetworkConfig, nickservPassword: 'secret123' },
          baseConnectionConfig,
        );

        const handler = findHandler('motdEnd');
        expect(typeof handler).toBe('function');
        await handler?.();

        expect(mockIRCService.sendRaw).toHaveBeenCalledWith(
          'PRIVMSG NickServ :IDENTIFY secret123',
        );
        expect(mockIRCService.addRawMessage).toHaveBeenCalledWith(
          expect.stringContaining('Sending NickServ IDENTIFY'),
          'auth',
        );
      });

      it('logs an error when NickServ IDENTIFY send fails', async () => {
        const errSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        await connectionManager.connect(
          'test-network',
          { ...baseNetworkConfig, nickservPassword: 'secret123' },
          baseConnectionConfig,
        );

        mockIRCService.sendRaw.mockImplementationOnce(() => {
          throw new Error('send failed');
        });
        const handler = findHandler('motdEnd');
        await handler?.();

        expect(errSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to send NickServ IDENTIFY'),
          expect.any(Error),
        );
        errSpy.mockRestore();
      });
    });

    describe('identity profile on-connect handler', () => {
      it('runs OPER from the profile when network config has none', async () => {
        mockIdentityProfilesService.get.mockResolvedValueOnce({
          nick: 'ProfileNick',
          operUser: 'operName',
          operPassword: 'operPass',
          onConnectCommands: [],
        });

        await connectionManager.connect(
          'test-network',
          { ...baseNetworkConfig, identityProfileId: 'profile-1' },
          baseConnectionConfig,
        );

        const handler = findLastHandler('motdEnd');
        await handler?.();
        await flush();

        expect(mockIRCService.sendRaw).toHaveBeenCalledWith(
          'OPER operName operPass',
        );
      });

      it('returns early when the profile is missing', async () => {
        mockIdentityProfilesService.get.mockResolvedValueOnce(null);

        await connectionManager.connect(
          'test-network',
          { ...baseNetworkConfig, identityProfileId: 'missing' },
          baseConnectionConfig,
        );

        const handler = findLastHandler('motdEnd');
        await handler?.();
        await flush();

        // No commands executed for a missing profile.
        expect(mockIRCService.addRawMessage).not.toHaveBeenCalledWith(
          expect.stringContaining('on-connect command(s) from identity profile'),
          'connection',
        );
      });

      it('falls back through the OPER user and command-target chains', async () => {
        mockIRCService.getCurrentNick.mockReturnValue(undefined);
        mockIdentityProfilesService.get.mockResolvedValueOnce({
          operPassword: 'operPass',
          onConnectCommands: ['hello world'],
        });

        const finalId = await connectionManager.connect(
          'fallback-net',
          { ...baseNetworkConfig, nick: undefined, identityProfileId: 'p' },
          baseConnectionConfig,
        );

        const handler = findLastHandler('motdEnd');
        await handler?.();
        await flush();

        // operUser bottoms out at undefined (no user anywhere in the chain).
        expect(mockIRCService.sendRaw).toHaveBeenCalledWith(
          'OPER undefined operPass',
        );
        // command target bottoms out at finalId.
        expect(mockIRCService.sendRaw).toHaveBeenCalledWith('hello world');
        expect(finalId).toBe('fallback-net');
      });

      it('handles a profile with no on-connect commands', async () => {
        mockIdentityProfilesService.get.mockResolvedValueOnce({
          nick: 'ProfileNick',
        });

        await connectionManager.connect(
          'test-network',
          { ...baseNetworkConfig, identityProfileId: 'p-empty' },
          baseConnectionConfig,
        );

        const handler = findLastHandler('motdEnd');
        await handler?.();
        await flush();

        expect(mockIRCService.addRawMessage).not.toHaveBeenCalledWith(
          expect.stringContaining('on-connect command(s) from identity profile'),
          'connection',
        );
      });

      it('logs an error when loading the identity profile fails', async () => {
        const errSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        mockIdentityProfilesService.get.mockRejectedValueOnce(
          new Error('load failed'),
        );

        await connectionManager.connect(
          'test-network',
          { ...baseNetworkConfig, identityProfileId: 'profile-err' },
          baseConnectionConfig,
        );

        const handler = findLastHandler('motdEnd');
        await handler?.();
        await flush();

        expect(errSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to run identity on-connect commands'),
          expect.any(Error),
        );
        errSpy.mockRestore();
      });
    });

    describe('service detection handler', () => {
      const getDetectionHandler = (): Function =>
        mockServiceDetectionService.onDetection.mock.calls[0][0];

      it('auto-detects undernet double-nick and auto-authenticates on success', async () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockAutoAuthService.isAuthenticated.mockReturnValue(false);
        mockAutoAuthService.authenticate.mockResolvedValueOnce({
          success: true,
          method: 'SASL',
        });

        const finalId = await connectionManager.connect(
          'detect-net',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        const handler = getDetectionHandler();
        handler(finalId, { serviceType: 'undernet', confidence: 0.9 });
        await flush();

        expect(mockIRCService.setWhoisUseDoubleNick).toHaveBeenCalledWith(true);
        expect(mockAutoAuthService.authenticate).toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Auto-authenticated using SASL'),
        );
        logSpy.mockRestore();
      });

      it('logs when auto-auth reports it was not attempted', async () => {
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockAutoAuthService.isAuthenticated.mockReturnValue(false);
        mockAutoAuthService.authenticate.mockResolvedValueOnce({
          success: false,
          error: 'no credentials',
        });

        const finalId = await connectionManager.connect(
          'detect-net',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        const handler = getDetectionHandler();
        handler(finalId, { serviceType: 'atheme', confidence: 0.5 });
        await flush();

        expect(mockIRCService.setWhoisUseDoubleNick).toHaveBeenCalledWith(false);
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Auto-auth not attempted: no credentials'),
        );
        logSpy.mockRestore();
      });

      it('logs errors thrown by auto-auth during detection', async () => {
        const errSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        mockAutoAuthService.isAuthenticated.mockReturnValue(false);
        mockAutoAuthService.authenticate.mockRejectedValueOnce(
          new Error('auth boom'),
        );

        const finalId = await connectionManager.connect(
          'detect-net',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        const handler = getDetectionHandler();
        handler(finalId, { serviceType: 'atheme', confidence: 0.5 });
        await flush();

        expect(errSpy).toHaveBeenCalledWith(
          'ConnectionManager: Auto-auth error:',
          expect.any(Error),
        );
        errSpy.mockRestore();
      });

      it('ignores detection events for other networks', async () => {
        const finalId = await connectionManager.connect(
          'detect-net',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        mockIRCService.setWhoisUseDoubleNick.mockClear();
        mockAutoAuthService.authenticate.mockClear();

        const handler = getDetectionHandler();
        handler('some-other-network', {
          serviceType: 'undernet',
          confidence: 0.9,
        });
        await flush();

        expect(mockIRCService.setWhoisUseDoubleNick).not.toHaveBeenCalled();
        expect(mockAutoAuthService.authenticate).not.toHaveBeenCalled();
        expect(finalId).toBe('detect-net');
      });

      it('skips double-nick detection and auth when already handled', async () => {
        mockAutoAuthService.isAuthenticated.mockReturnValue(true);

        const finalId = await connectionManager.connect(
          'detect-net',
          { ...baseNetworkConfig, whoisUseDoubleNick: true },
          baseConnectionConfig,
        );
        mockIRCService.setWhoisUseDoubleNick.mockClear();

        const handler = getDetectionHandler();
        handler(finalId, { serviceType: 'undernet', confidence: 0.9 });
        await flush();

        // manual double-nick set -> detection must not override it.
        expect(mockIRCService.setWhoisUseDoubleNick).not.toHaveBeenCalled();
        // already authenticated -> no auth attempt.
        expect(mockAutoAuthService.authenticate).not.toHaveBeenCalled();
      });
    });

    describe('rawMessage / welcome / SASL handlers', () => {
      it('parses ISUPPORT tokens and NETWORK name on 005', async () => {
        const finalId = await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        const handler = findHandler('rawMessage');
        expect(typeof handler).toBe('function');
        handler?.({
          prefix: '',
          command: '005',
          params: ['nick', 'CHANTYPES=#', 'NETWORK=Undernet', ':are supported'],
        });

        expect(
          mockServiceDetectionService.processISupport,
        ).toHaveBeenCalledWith(finalId, ['CHANTYPES=#', 'NETWORK=Undernet']);
        expect(
          mockServiceDetectionService.processNetworkName,
        ).toHaveBeenCalledWith(finalId, 'Undernet');
      });

      it('ignores non-005 raw messages', async () => {
        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        mockServiceDetectionService.processISupport.mockClear();

        const handler = findHandler('rawMessage');
        handler?.({ prefix: '', command: 'PRIVMSG', params: ['#chan', 'hi'] });

        expect(
          mockServiceDetectionService.processISupport,
        ).not.toHaveBeenCalled();
      });

      it('processes the network name from the welcome event', async () => {
        const finalId = await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        mockServiceDetectionService.processNetworkName.mockClear();

        const handler = findHandler('welcome');
        handler?.({ networkName: 'WelcomeNet' });
        expect(
          mockServiceDetectionService.processNetworkName,
        ).toHaveBeenCalledWith(finalId, 'WelcomeNet');

        // Missing network name -> no processing.
        mockServiceDetectionService.processNetworkName.mockClear();
        handler?.({});
        expect(
          mockServiceDetectionService.processNetworkName,
        ).not.toHaveBeenCalled();
      });

      it('updates SASL status on sasl-success', async () => {
        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        const handler = findHandler('sasl-success');
        handler?.();

        expect(mockAutoAuthService.updateSaslStatus).toHaveBeenCalledWith(
          false,
          true,
        );
      });

      it('triggers fallback auth on sasl-fail when not authenticated', async () => {
        mockAutoAuthService.isAuthenticated.mockReturnValue(false);
        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        mockAutoAuthService.authenticate.mockClear();

        const handler = findHandler('sasl-fail');
        handler?.();

        expect(mockAutoAuthService.authenticate).toHaveBeenCalled();
      });

      it('logs fallback auth errors on sasl-fail', async () => {
        const errSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        mockAutoAuthService.isAuthenticated.mockReturnValue(false);
        mockAutoAuthService.authenticate.mockRejectedValueOnce(
          new Error('fallback boom'),
        );

        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );

        const handler = findHandler('sasl-fail');
        handler?.();
        await flush();

        expect(errSpy).toHaveBeenCalledWith(
          'ConnectionManager: Fallback auth error:',
          expect.any(Error),
        );
        errSpy.mockRestore();
      });

      it('does not trigger fallback auth on sasl-fail when already authenticated', async () => {
        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        mockAutoAuthService.isAuthenticated.mockReturnValue(true);
        mockAutoAuthService.authenticate.mockClear();

        const handler = findHandler('sasl-fail');
        handler?.();

        expect(mockAutoAuthService.authenticate).not.toHaveBeenCalled();
      });
    });

    describe('disconnect error handling', () => {
      it('logs errors thrown while destroying autoRejoinService', async () => {
        const errSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        const ctx = connectionManager.getConnection('test-network');
        (ctx?.autoRejoinService.destroy as jest.Mock).mockImplementationOnce(
          () => {
            throw new Error('destroy boom');
          },
        );

        connectionManager.disconnect('test-network');

        expect(errSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error destroying autoRejoinService'),
          expect.any(Error),
        );
        errSpy.mockRestore();
      });

      it('logs errors thrown by cleanup functions', async () => {
        const errSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        const ctx = connectionManager.getConnection('test-network');
        ctx?.cleanupFunctions.push(() => {
          throw new Error('cleanup boom');
        });

        connectionManager.disconnect('test-network');

        expect(errSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error during cleanup'),
          expect.any(Error),
        );
        errSpy.mockRestore();
      });

      it('logs errors thrown by the service-detection cleanup', async () => {
        const errSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        const ctx = connectionManager.getConnection('test-network');
        if (ctx) {
          ctx.serviceDetectionCleanup = () => {
            throw new Error('detection cleanup boom');
          };
        }

        connectionManager.disconnect('test-network');

        expect(errSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error cleaning up service detection'),
          expect.any(Error),
        );
        errSpy.mockRestore();
      });

      it('logs errors thrown while destroying the auto-auth service', async () => {
        const errSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        await connectionManager.connect(
          'test-network',
          baseNetworkConfig,
          baseConnectionConfig,
        );
        mockAutoAuthService.destroy.mockImplementationOnce(() => {
          throw new Error('auth destroy boom');
        });

        connectionManager.disconnect('test-network');

        expect(errSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error cleaning up auto-auth'),
          expect.any(Error),
        );
        errSpy.mockRestore();
      });
    });
  });
});
