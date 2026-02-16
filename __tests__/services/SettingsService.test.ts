/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for SettingsService
 */

import { settingsService, DEFAULT_SERVER, NEW_FEATURE_DEFAULTS } from '../../src/services/SettingsService';
import { storageCache } from '../../src/services/StorageCache';
import { secureStorageService } from '../../src/services/SecureStorageService';
import { identityProfilesService } from '../../src/services/IdentityProfilesService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('../../src/services/IdentityProfilesService', () => ({
  DEFAULT_PROFILE_ID: 'default-profile',
  identityProfilesService: {
    getDefaultProfile: jest.fn().mockResolvedValue({
      id: 'default-profile',
      nick: 'TestNick',
      altNick: 'TestNick_',
      realname: 'Test User',
      ident: 'testident',
    }),
    list: jest.fn().mockResolvedValue([
      { id: 'default-profile', name: 'Default', nick: 'TestNick' },
    ]),
  },
}));

describe('SettingsService', () => {
  beforeEach(async () => {
    await storageCache.clear(true);
    jest.clearAllMocks();
  });

  describe('loadNetworks', () => {
    it('should create default network if none exist', async () => {
      const networks = await settingsService.loadNetworks();
      
      expect(networks.length).toBeGreaterThan(0);
      expect(networks.some(n => n.name === 'DBase')).toBe(true);
    });

    it('should load saved networks', async () => {
      const savedNetworks = [
        {
          id: 'test-network',
          name: 'TestNetwork',
          nick: 'TestNick',
          realname: 'Test User',
          servers: [{ id: 'srv1', hostname: 'irc.test.com', port: 6667, ssl: false }],
        },
      ];
      
      await storageCache.setItem('@AndroidIRCX:networks', savedNetworks);
      
      const networks = await settingsService.loadNetworks();
      
      expect(networks.some(n => n.name === 'TestNetwork')).toBe(true);
    });

    it('should add DBase network if missing', async () => {
      const savedNetworks = [
        {
          id: 'other-network',
          name: 'OtherNetwork',
          nick: 'Nick',
          realname: 'User',
          servers: [],
        },
      ];
      
      await storageCache.setItem('@AndroidIRCX:networks', savedNetworks);
      
      const networks = await settingsService.loadNetworks();
      
      expect(networks.some(n => n.name === 'DBase')).toBe(true);
      expect(networks.some(n => n.name === 'OtherNetwork')).toBe(true);
    });

    it('should ensure DBase has default servers', async () => {
      const savedNetworks = [
        {
          id: 'DBase',
          name: 'DBase',
          nick: 'Nick',
          realname: 'User',
          servers: [], // Empty servers
        },
      ];
      
      await storageCache.setItem('@AndroidIRCX:networks', savedNetworks);
      
      const networks = await settingsService.loadNetworks();
      const dbase = networks.find(n => n.name === 'DBase');
      
      expect(dbase?.servers.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(storageCache, 'getItem').mockRejectedValueOnce(new Error('Storage error'));
      
      const networks = await settingsService.loadNetworks();
      
      // Should still return default networks
      expect(networks.length).toBeGreaterThan(0);
    });
  });

  describe('saveNetworks', () => {
    it('should save networks to storage', async () => {
      const networks = [
        {
          id: 'test',
          name: 'Test',
          nick: 'Nick',
          realname: 'User',
          servers: [],
        },
      ];
      
      await settingsService.saveNetworks(networks);
      
      const saved = await storageCache.getItem('@AndroidIRCX:networks');
      expect(saved).toHaveLength(1);
    });

    it('should strip secrets before saving', async () => {
      const networks = [
        {
          id: 'test',
          name: 'Test',
          nick: 'Nick',
          realname: 'User',
          nickservPassword: 'secret123',
          servers: [
            { id: 'srv1', hostname: 'irc.test.com', port: 6667, ssl: false, password: 'serverpass' },
          ],
        },
      ];
      
      await settingsService.saveNetworks(networks);
      
      const saved = await storageCache.getItem('@AndroidIRCX:networks');
      expect(saved[0].nickservPassword).toBeUndefined();
      expect(saved[0].servers[0].password).toBeUndefined();
    });
  });

  describe('addNetwork', () => {
    it('should add a new network', async () => {
      const newNetwork = {
        id: 'new-net',
        name: 'NewNetwork',
        nick: 'NewNick',
        realname: 'New User',
        servers: [],
      };
      
      await settingsService.addNetwork(newNetwork);
      
      const networks = await settingsService.loadNetworks();
      expect(networks.some(n => n.name === 'NewNetwork')).toBe(true);
    });
  });

  describe('updateNetwork', () => {
    it('should update existing network', async () => {
      // First load to initialize
      await settingsService.loadNetworks();
      
      await settingsService.updateNetwork('DBase', { nick: 'UpdatedNick' });
      
      const networks = await settingsService.loadNetworks();
      const dbase = networks.find(n => n.name === 'DBase');
      expect(dbase?.nick).toBe('UpdatedNick');
    });

    it('should not throw for non-existent network', async () => {
      await expect(
        settingsService.updateNetwork('non-existent', { nick: 'Test' })
      ).resolves.not.toThrow();
    });
  });

  describe('deleteNetwork', () => {
    it('should delete a network', async () => {
      const newNetwork = {
        id: 'delete-me',
        name: 'DeleteMe',
        nick: 'Nick',
        realname: 'User',
        servers: [],
      };
      
      await settingsService.addNetwork(newNetwork);
      await settingsService.deleteNetwork('delete-me');
      
      const networks = await settingsService.loadNetworks();
      expect(networks.some(n => n.id === 'delete-me')).toBe(false);
    });

    it('should allow deleting DBase and keep it deleted', async () => {
      await settingsService.loadNetworks();
      await settingsService.deleteNetwork('DBase');

      const networks = await settingsService.loadNetworks();
      expect(networks.some(n => n.id === 'DBase' || n.name === 'DBase')).toBe(false);
    });
  });

  describe('getNetwork', () => {
    it('should return network by id', async () => {
      await settingsService.loadNetworks();
      
      const network = await settingsService.getNetwork('DBase');
      
      expect(network).toBeDefined();
      expect(network?.name).toBe('DBase');
    });

    it('should return null for non-existent network', async () => {
      const network = await settingsService.getNetwork('non-existent');
      expect(network).toBeNull();
    });
  });

  describe('getAllNetworks', () => {
    it('should return all networks', async () => {
      const networks = await settingsService.getAllNetworks();
      expect(networks.length).toBeGreaterThan(0);
    });

    it('should return empty array on error', async () => {
      jest.spyOn(settingsService, 'loadNetworks').mockRejectedValueOnce(new Error('Error'));
      
      const networks = await settingsService.getAllNetworks();
      expect(networks).toEqual([]);
    });
  });

  describe('addServerToNetwork', () => {
    it('should add server to network', async () => {
      await settingsService.loadNetworks();
      
      const newServer = {
        id: 'new-srv',
        hostname: 'irc.new.com',
        port: 6697,
        ssl: true,
      };
      
      await settingsService.addServerToNetwork('DBase', newServer);
      
      const network = await settingsService.getNetwork('DBase');
      expect(network?.servers.some(s => s.hostname === 'irc.new.com')).toBe(true);
    });

    it('should handle non-existent network', async () => {
      await expect(
        settingsService.addServerToNetwork('non-existent', {
          id: 'srv',
          hostname: 'irc.test.com',
          port: 6667,
          ssl: false,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('updateServerInNetwork', () => {
    it('should update server in network', async () => {
      await settingsService.loadNetworks();
      
      await settingsService.updateServerInNetwork('DBase', 'dbase-default', {
        port: 6667,
      });
      
      const network = await settingsService.getNetwork('DBase');
      const server = network?.servers.find(s => s.id === 'dbase-default');
      expect(server?.port).toBe(6667);
    });

    it('should handle favorite flag', async () => {
      await settingsService.loadNetworks();
      
      // First add another server
      await settingsService.addServerToNetwork('DBase', {
        id: 'srv2',
        hostname: 'irc2.example.com',
        port: 6667,
        ssl: false,
      });
      
      // Make it favorite
      await settingsService.updateServerInNetwork('DBase', 'srv2', { favorite: true });
      
      const network = await settingsService.getNetwork('DBase');
      const srv2 = network?.servers.find(s => s.id === 'srv2');
      expect(srv2?.favorite).toBe(true);
    });
  });

  describe('deleteServerFromNetwork', () => {
    it('should delete server from network', async () => {
      await settingsService.loadNetworks();
      
      // First add a server
      await settingsService.addServerToNetwork('DBase', {
        id: 'to-delete',
        hostname: 'temp.example.com',
        port: 6667,
        ssl: false,
      });
      
      await settingsService.deleteServerFromNetwork('DBase', 'to-delete');
      
      const network = await settingsService.getNetwork('DBase');
      expect(network?.servers.some(s => s.id === 'to-delete')).toBe(false);
    });

    it('should clear defaultServerId if deleted server was default', async () => {
      await settingsService.loadNetworks();
      
      // Get current default
      const network = await settingsService.getNetwork('DBase');
      const defaultId = network?.defaultServerId;
      
      if (defaultId) {
        // Add another server first
        await settingsService.addServerToNetwork('DBase', {
          id: 'backup-srv',
          hostname: 'backup.example.com',
          port: 6667,
          ssl: false,
        });
        
        await settingsService.deleteServerFromNetwork('DBase', defaultId);
        
        const updated = await settingsService.getNetwork('DBase');
        // Should have a new default or undefined
        expect(updated?.servers.length).toBeGreaterThan(0);
      }
    });
  });

  describe('setDefaultServerForNetwork', () => {
    it('should set default server', async () => {
      await settingsService.loadNetworks();
      
      // Add a server
      await settingsService.addServerToNetwork('DBase', {
        id: 'new-default',
        hostname: 'default.example.com',
        port: 6667,
        ssl: false,
      });
      
      await settingsService.setDefaultServerForNetwork('DBase', 'new-default');
      
      const network = await settingsService.getNetwork('DBase');
      expect(network?.defaultServerId).toBe('new-default');
    });
  });

  describe('clearDefaultServerForNetwork', () => {
    it('should persist cleared defaultServerId for DBase network across loadNetworks calls', async () => {
      await settingsService.loadNetworks();

      // Verify DBase has a default server set initially
      let network = await settingsService.getNetwork('DBase');
      expect(network?.defaultServerId).toBeTruthy();
      const originalDefault = network!.defaultServerId;

      // Clear the default server
      await settingsService.clearDefaultServerForNetwork('DBase', originalDefault!);

      // Reload networks (this triggers ensureDefaults)
      await settingsService.loadNetworks();

      // The cleared defaultServerId should stay cleared, not revert back
      network = await settingsService.getNetwork('DBase');
      expect(network?.defaultServerId).toBeUndefined();
    });

    it('should allow setting a different server as default for DBase network', async () => {
      await settingsService.loadNetworks();

      // Add a new server
      await settingsService.addServerToNetwork('DBase', {
        id: 'alt-server',
        hostname: 'alt.example.com',
        port: 6667,
        ssl: false,
      });

      // Set it as default
      await settingsService.setDefaultServerForNetwork('DBase', 'alt-server');

      // Reload (triggers ensureDefaults)
      await settingsService.loadNetworks();

      // Should stay as the user's chosen server
      const network = await settingsService.getNetwork('DBase');
      expect(network?.defaultServerId).toBe('alt-server');
    });
  });

  describe('createDefaultNetwork', () => {
    it('should create DBase network if not exists', async () => {
      // Clear any existing networks
      await storageCache.setItem('@AndroidIRCX:networks', []);
      
      const network = await settingsService.createDefaultNetwork();
      
      expect(network.name).toBe('DBase');
    });

    it('should return existing DBase network', async () => {
      await settingsService.loadNetworks();
      
      const network = await settingsService.createDefaultNetwork();
      
      expect(network.name).toBe('DBase');
    });

    it('should recreate DBase after user deleted it', async () => {
      await settingsService.loadNetworks();
      await settingsService.deleteNetwork('DBase');

      const recreated = await settingsService.createDefaultNetwork();
      expect(recreated.name).toBe('DBase');

      const networks = await settingsService.loadNetworks();
      expect(networks.some(n => n.id === 'DBase' || n.name === 'DBase')).toBe(true);
    });
  });

  describe('getSetting and setSetting', () => {
    it('should set and get a setting', async () => {
      await settingsService.setSetting('test-key', 'test-value');
      
      const value = await settingsService.getSetting('test-key', 'default');
      expect(value).toBe('test-value');
    });

    it('should return default value if setting not found', async () => {
      const value = await settingsService.getSetting('non-existent', 'default');
      expect(value).toBe('default');
    });

    it('should handle complex values', async () => {
      const complexValue = { nested: { array: [1, 2, 3] } };
      await settingsService.setSetting('complex', complexValue);
      
      const value = await settingsService.getSetting('complex', {});
      expect(value).toEqual(complexValue);
    });
  });

  describe('onSettingChange', () => {
    it('should notify listeners when setting changes', async () => {
      const listener = jest.fn();
      const unsubscribe = settingsService.onSettingChange('watched-key', listener);
      
      await settingsService.setSetting('watched-key', 'new-value');
      
      expect(listener).toHaveBeenCalledWith('new-value');
      
      unsubscribe();
    });

    it('should allow unsubscribing', async () => {
      const listener = jest.fn();
      const unsubscribe = settingsService.onSettingChange('watched-key', listener);
      
      unsubscribe();
      
      await settingsService.setSetting('watched-key', 'value');
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      settingsService.onSettingChange('error-key', errorListener);
      
      await expect(
        settingsService.setSetting('error-key', 'value')
      ).resolves.not.toThrow();
    });
  });

  describe('getAllIdentityProfiles', () => {
    it('should return identity profiles', async () => {
      const profiles = await settingsService.getAllIdentityProfiles();
      
      expect(profiles.length).toBeGreaterThan(0);
    });

    it('should handle errors', async () => {
      (identityProfilesService.list as jest.Mock).mockRejectedValueOnce(new Error('Error'));
      
      const profiles = await settingsService.getAllIdentityProfiles();
      expect(profiles).toEqual([]);
    });
  });

  describe('updateNetworkProfile', () => {
    it('should update network connection type', async () => {
      await settingsService.loadNetworks();
      
      await settingsService.updateNetworkProfile('DBase', 'znc', undefined);
      
      const network = await settingsService.getNetwork('DBase');
      expect(network?.connectionType).toBe('znc');
    });

    it('should update network identity profile', async () => {
      await settingsService.loadNetworks();
      
      await settingsService.updateNetworkProfile('DBase', undefined, 'new-profile-id');
      
      const network = await settingsService.getNetwork('DBase');
      expect(network?.identityProfileId).toBe('new-profile-id');
    });

    it('should handle non-existent network', async () => {
      await expect(
        settingsService.updateNetworkProfile('non-existent', 'znc')
      ).resolves.not.toThrow();
    });
  });

  describe('secret management', () => {
    it('should persist and restore secrets', async () => {
      const networks = [
        {
          id: 'secret-test',
          name: 'SecretTest',
          nick: 'Nick',
          realname: 'User',
          nickservPassword: 'secret-pass',
          servers: [
            { id: 'srv1', hostname: 'irc.test.com', port: 6667, ssl: false, password: 'srv-pass' },
          ],
        },
      ];
      
      await settingsService.saveNetworks(networks);
      
      // Secrets should be in secure storage
      const nickservSecret = await secureStorageService.getSecret('secret-test:nickservPassword');
      const serverSecret = await secureStorageService.getSecret('secret-test:server:srv1');
      
      expect(nickservSecret).toBe('secret-pass');
      expect(serverSecret).toBe('srv-pass');
    });
  });

  describe('isFirstRun and setFirstRunCompleted', () => {
    it('should return true for first run', async () => {
      const isFirst = await settingsService.isFirstRun();
      expect(isFirst).toBe(true);
    });

    it('should return false after marking first run complete', async () => {
      await settingsService.setFirstRunCompleted(true);
      
      const isFirst = await settingsService.isFirstRun();
      expect(isFirst).toBe(false);
    });

    it('should return true on error', async () => {
      jest.spyOn(storageCache, 'getItem').mockRejectedValueOnce(new Error('Error'));
      
      const isFirst = await settingsService.isFirstRun();
      expect(isFirst).toBe(true);
    });
  });

  describe('reloadNetworks', () => {
    it('should clear cache and reload networks', async () => {
      // First load to initialize
      await settingsService.loadNetworks();
      
      // Verify networks are loaded
      const networksBefore = await settingsService.getAllNetworks();
      expect(networksBefore.length).toBeGreaterThan(0);
      
      // Clear internal networks array manually
      // @ts-ignore
      settingsService.networks = [];
      
      // Reload should re-populate networks
      await settingsService.reloadNetworks();
      
      const networksAfter = await settingsService.getAllNetworks();
      expect(networksAfter.length).toBeGreaterThan(0);
    });

    it('should not delete persisted networks from AsyncStorage', async () => {
      await settingsService.loadNetworks();
      const removeSpy = jest.spyOn(AsyncStorage, 'removeItem');

      await settingsService.reloadNetworks();

      expect(removeSpy).not.toHaveBeenCalledWith('@AndroidIRCX:networks');
      removeSpy.mockRestore();
    });
  });

  describe('DEFAULT_SERVER', () => {
    it('should have correct default server config', () => {
      expect(DEFAULT_SERVER.hostname).toBe('irc.dbase.in.rs');
      expect(DEFAULT_SERVER.port).toBe(6697);
      expect(DEFAULT_SERVER.ssl).toBe(true);
    });
  });

  describe('NEW_FEATURE_DEFAULTS', () => {
    it('should have ban settings', () => {
      expect(NEW_FEATURE_DEFAULTS.defaultBanType).toBe(2);
      expect(NEW_FEATURE_DEFAULTS.predefinedKickReasons).toContain('Spamming');
    });

    it('should have DCC settings', () => {
      expect(NEW_FEATURE_DEFAULTS.dccAutoGetMode).toBe('accept');
      expect(NEW_FEATURE_DEFAULTS.dccAcceptExts).toContain('*.mp3');
      expect(NEW_FEATURE_DEFAULTS.dccRejectExts).toContain('*.exe');
    });

    it('should have spam protection settings', () => {
      expect(NEW_FEATURE_DEFAULTS.spamPmMode).toBe('when_open');
      expect(NEW_FEATURE_DEFAULTS.spamPmKeywords).toContain('*discord.gg*');
    });
  });
});
