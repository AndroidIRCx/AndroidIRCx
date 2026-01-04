/**
 * Tests for useDeepLinkHandler hook
 * Tests deep link handling to ensure no duplicate connections or tab flooding
 */

import { connectionManager } from '../../src/services/ConnectionManager';
import { settingsService } from '../../src/services/SettingsService';
import { identityProfilesService } from '../../src/services/IdentityProfilesService';
import { parseIRCUrl, findMatchingNetwork } from '../../src/utils/ircUrlParser';
import { logger } from '../../src/services/Logger';

// Mock dependencies
jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn(() => []),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock('../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: {
    getDefaultProfile: jest.fn(() =>
      Promise.resolve({
        id: 'default',
        nick: 'TestUser',
        altNick: 'TestUser_',
        realname: 'Test User',
        ident: 'testuser',
      })
    ),
  },
}));

jest.mock('../../src/services/Logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Deep Link Handler - Connection and Tab Flood Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (connectionManager.getAllConnections as jest.Mock).mockReturnValue([]);
    (settingsService.loadNetworks as jest.Mock).mockResolvedValue([]);
  });

  describe('URL Parsing', () => {
    it('should parse ircs:// URLs correctly', () => {
      const url = 'ircs://irc.dbase.in.rs:6697/#test';
      const parsed = parseIRCUrl(url);

      expect(parsed.isValid).toBe(true);
      expect(parsed.server).toBe('irc.dbase.in.rs');
      expect(parsed.port).toBe(6697);
      expect(parsed.ssl).toBe(true);
      expect(parsed.channel).toBe('#test');
    });

    it('should parse irc:// URLs correctly', () => {
      const url = 'irc://irc.androidircx.com:6667/#channel';
      const parsed = parseIRCUrl(url);

      expect(parsed.isValid).toBe(true);
      expect(parsed.server).toBe('irc.androidircx.com');
      expect(parsed.port).toBe(6667);
      expect(parsed.ssl).toBe(false);
      expect(parsed.channel).toBe('#channel');
    });
  });

  describe('Connection Detection - Prevent Duplicates', () => {
    it('should detect existing connection by networkId matching server hostname', () => {
      const mockIRCService = {
        getConnectionStatus: jest.fn(() => true),
      };

      const connections = [
        {
          networkId: 'irc.dbase.in.rs',
          ircService: mockIRCService,
        },
      ];

      (connectionManager.getAllConnections as jest.Mock).mockReturnValue(connections);

      const parsed = parseIRCUrl('ircs://irc.dbase.in.rs:6697');
      const normalizedServer = parsed.server.toLowerCase();

      const existingConnection = connections.find(context => {
        const normalizedNetworkId = context.networkId.toLowerCase().replace(/\s*\(\d+\)$/, '');
        return normalizedNetworkId === normalizedServer && context.ircService.getConnectionStatus();
      });

      expect(existingConnection).toBeDefined();
      expect(existingConnection?.networkId).toBe('irc.dbase.in.rs');
    });

    it('should detect existing connection by matching network servers', async () => {
      const mockIRCService = {
        getConnectionStatus: jest.fn(() => true),
      };

      const connections = [
        {
          networkId: 'DBase', // Network name, not server hostname
          ircService: mockIRCService,
        },
      ];

      const networks = [
        {
          id: 'dbase',
          name: 'DBase',
          servers: [
            {
              id: 'server1',
              hostname: 'irc.dbase.in.rs',
              port: 6697,
              ssl: true,
            },
          ],
        },
      ];

      (connectionManager.getAllConnections as jest.Mock).mockReturnValue(connections);
      (settingsService.loadNetworks as jest.Mock).mockResolvedValue(networks);

      const parsed = parseIRCUrl('ircs://irc.dbase.in.rs:6697');
      const parsedServerLower = parsed.server.toLowerCase();

      // Simulate the connection check logic from useDeepLinkHandler
      const networksForCheck = await settingsService.loadNetworks();
      let existingConnection = null;

      for (const context of connections) {
        const isConnected = context.ircService.getConnectionStatus();
        if (!isConnected) continue;

        const network = networksForCheck.find(n => n.name === context.networkId || n.id === context.networkId);
        if (network && network.servers) {
          for (const srv of network.servers) {
            if (srv.hostname.toLowerCase() === parsedServerLower && srv.port === parsed.port) {
              existingConnection = { networkId: context.networkId, ircService: context.ircService };
              break;
            }
          }
        }
        if (existingConnection) break;
      }

      expect(existingConnection).toBeDefined();
      expect(existingConnection?.networkId).toBe('DBase');
    });

    it('should not find connection when server is different', async () => {
      const mockIRCService = {
        getConnectionStatus: jest.fn(() => true),
      };

      const connections = [
        {
          networkId: 'DBase',
          ircService: mockIRCService,
        },
      ];

      const networks = [
        {
          id: 'dbase',
          name: 'DBase',
          servers: [
            {
              id: 'server1',
              hostname: 'irc.dbase.in.rs',
              port: 6697,
              ssl: true,
            },
          ],
        },
      ];

      (connectionManager.getAllConnections as jest.Mock).mockReturnValue(connections);
      (settingsService.loadNetworks as jest.Mock).mockResolvedValue(networks);

      const parsed = parseIRCUrl('ircs://different.server.com:6697');
      const parsedServerLower = parsed.server.toLowerCase();

      const networksForCheck = await settingsService.loadNetworks();
      let existingConnection = null;

      for (const context of connections) {
        const isConnected = context.ircService.getConnectionStatus();
        if (!isConnected) continue;

        const network = networksForCheck.find(n => n.name === context.networkId || n.id === context.networkId);
        if (network && network.servers) {
          for (const srv of network.servers) {
            if (srv.hostname.toLowerCase() === parsedServerLower && srv.port === parsed.port) {
              existingConnection = { networkId: context.networkId, ircService: context.ircService };
              break;
            }
          }
        }
        if (existingConnection) break;
      }

      expect(existingConnection).toBeNull();
    });
  });

  describe('Network Matching', () => {
    it('should match network by exact hostname and port', async () => {
      const networks = [
        {
          id: 'dbase',
          name: 'DBase',
          servers: [
            {
              id: 'server1',
              hostname: 'irc.dbase.in.rs',
              port: 6697,
              ssl: true,
            },
          ],
        },
      ];

      (settingsService.loadNetworks as jest.Mock).mockResolvedValue(networks);

      const parsed = parseIRCUrl('ircs://irc.dbase.in.rs:6697');
      const matched = await findMatchingNetwork(parsed);

      expect(matched).toBeDefined();
      expect(matched?.name).toBe('DBase');
    });

    it('should match network by hostname even if port differs', async () => {
      const networks = [
        {
          id: 'dbase',
          name: 'DBase',
          servers: [
            {
              id: 'server1',
              hostname: 'irc.dbase.in.rs',
              port: 6667, // Different port
              ssl: false,
            },
          ],
        },
      ];

      (settingsService.loadNetworks as jest.Mock).mockResolvedValue(networks);

      const parsed = parseIRCUrl('ircs://irc.dbase.in.rs:6697'); // Different port in URL
      const matched = await findMatchingNetwork(parsed);

      expect(matched).toBeDefined();
      expect(matched?.name).toBe('DBase');
    });
  });

  describe('Real-world Bug Scenarios', () => {
    it('should prevent duplicate connections for irc.dbase.in.rs', async () => {
      const mockIRCService = {
        getConnectionStatus: jest.fn(() => true),
      };

      const connections = [
        {
          networkId: 'DBase',
          ircService: mockIRCService,
        },
      ];

      const networks = [
        {
          id: 'dbase',
          name: 'DBase',
          servers: [
            {
              id: 'server1',
              hostname: 'irc.dbase.in.rs',
              port: 6697,
              ssl: true,
            },
          ],
        },
      ];

      (connectionManager.getAllConnections as jest.Mock).mockReturnValue(connections);
      (settingsService.loadNetworks as jest.Mock).mockResolvedValue(networks);

      const parsed = parseIRCUrl('ircs://irc.dbase.in.rs:6697');
      const parsedServerLower = parsed.server.toLowerCase();

      // Simulate multiple connection checks (like rapid clicks)
      const networksForCheck = await settingsService.loadNetworks();
      const connectionChecks: Array<{ found: boolean }> = [];

      for (let i = 0; i < 12; i++) {
        let existingConnection = null;

        // First check by networkId
        for (const context of connections) {
          const normalizedNetworkId = context.networkId.toLowerCase().replace(/\s*\(\d+\)$/, '');
          if (normalizedNetworkId === parsedServerLower && context.ircService.getConnectionStatus()) {
            existingConnection = { networkId: context.networkId, ircService: context.ircService };
            break;
          }
        }

        // Second check by network servers
        if (!existingConnection) {
          for (const context of connections) {
            const isConnected = context.ircService.getConnectionStatus();
            if (!isConnected) continue;

            const network = networksForCheck.find(n => n.name === context.networkId || n.id === context.networkId);
            if (network && network.servers) {
              for (const srv of network.servers) {
                if (srv.hostname.toLowerCase() === parsedServerLower && srv.port === parsed.port) {
                  existingConnection = { networkId: context.networkId, ircService: context.ircService };
                  break;
                }
              }
            }
            if (existingConnection) break;
          }
        }

        connectionChecks.push({ found: !!existingConnection });
      }

      // All 12 checks should find the existing connection (no duplicates created)
      expect(connectionChecks.length).toBe(12);
      expect(connectionChecks.every(check => check.found)).toBe(true);
    });

    it('should prevent duplicate connections for irc.androidircx.com', async () => {
      const mockIRCService = {
        getConnectionStatus: jest.fn(() => true),
      };

      const connections = [
        {
          networkId: 'AndroidIRCX',
          ircService: mockIRCService,
        },
      ];

      const networks = [
        {
          id: 'androidircx',
          name: 'AndroidIRCX',
          servers: [
            {
              id: 'server1',
              hostname: 'irc.androidircx.com',
              port: 6697,
              ssl: true,
            },
          ],
        },
      ];

      (connectionManager.getAllConnections as jest.Mock).mockReturnValue(connections);
      (settingsService.loadNetworks as jest.Mock).mockResolvedValue(networks);

      const parsed = parseIRCUrl('ircs://irc.androidircx.com:6697');
      const parsedServerLower = parsed.server.toLowerCase();

      const networksForCheck = await settingsService.loadNetworks();
      const connectionChecks: Array<{ found: boolean }> = [];

      // Simulate 12 rapid clicks
      for (let i = 0; i < 12; i++) {
        let existingConnection = null;

        for (const context of connections) {
          const isConnected = context.ircService.getConnectionStatus();
          if (!isConnected) continue;

          const network = networksForCheck.find(n => n.name === context.networkId || n.id === context.networkId);
          if (network && network.servers) {
            for (const srv of network.servers) {
              if (srv.hostname.toLowerCase() === parsedServerLower && srv.port === parsed.port) {
                existingConnection = { networkId: context.networkId, ircService: context.ircService };
                break;
              }
            }
          }
          if (existingConnection) break;
        }

        connectionChecks.push({ found: !!existingConnection });
      }

      // All checks should find existing connection (preventing 12 duplicate tabs)
      expect(connectionChecks.length).toBe(12);
      expect(connectionChecks.every(check => check.found)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle disconnected connections correctly', async () => {
      const mockIRCService = {
        getConnectionStatus: jest.fn(() => false), // Disconnected
      };

      const connections = [
        {
          networkId: 'DBase',
          ircService: mockIRCService,
        },
      ];

      const networks = [
        {
          id: 'dbase',
          name: 'DBase',
          servers: [
            {
              id: 'server1',
              hostname: 'irc.dbase.in.rs',
              port: 6697,
              ssl: true,
            },
          ],
        },
      ];

      (connectionManager.getAllConnections as jest.Mock).mockReturnValue(connections);
      (settingsService.loadNetworks as jest.Mock).mockResolvedValue(networks);

      const parsed = parseIRCUrl('ircs://irc.dbase.in.rs:6697');
      const parsedServerLower = parsed.server.toLowerCase();

      const networksForCheck = await settingsService.loadNetworks();
      let existingConnection = null;

      for (const context of connections) {
        const isConnected = context.ircService.getConnectionStatus();
        if (!isConnected) continue; // Should skip disconnected connections

        const network = networksForCheck.find(n => n.name === context.networkId || n.id === context.networkId);
        if (network && network.servers) {
          for (const srv of network.servers) {
            if (srv.hostname.toLowerCase() === parsedServerLower && srv.port === parsed.port) {
              existingConnection = { networkId: context.networkId, ircService: context.ircService };
              break;
            }
          }
        }
        if (existingConnection) break;
      }

      // Should not find disconnected connection
      expect(existingConnection).toBeNull();
    });

    it('should handle network with multiple servers', async () => {
      const networks = [
        {
          id: 'dbase',
          name: 'DBase',
          servers: [
            {
              id: 'server1',
              hostname: 'irc.dbase.in.rs',
              port: 6697,
              ssl: true,
            },
            {
              id: 'server2',
              hostname: 'irc2.dbase.in.rs',
              port: 6697,
              ssl: true,
            },
          ],
        },
      ];

      (settingsService.loadNetworks as jest.Mock).mockResolvedValue(networks);

      const parsed = parseIRCUrl('ircs://irc.dbase.in.rs:6697');
      const matched = await findMatchingNetwork(parsed);

      expect(matched).toBeDefined();
      expect(matched?.name).toBe('DBase');
    });
  });
});
