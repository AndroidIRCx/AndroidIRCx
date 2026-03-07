/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for AutoReconnectService - Wave 2 coverage target
 */

// Mock must be at the top, before imports
jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    onConnectionChange: jest.fn().mockReturnValue(jest.fn()),
    onMessage: jest.fn().mockReturnValue(jest.fn()),
    on: jest.fn().mockReturnValue(jest.fn()),
    getNetworkName: jest.fn().mockReturnValue('freenode'),
    getCurrentNick: jest.fn().mockReturnValue('TestUser'),
    connect: jest.fn().mockResolvedValue(undefined),
  },
  IRCService: jest.fn().mockImplementation(() => ({
    onConnectionChange: jest.fn().mockReturnValue(jest.fn()),
    onMessage: jest.fn().mockReturnValue(jest.fn()),
    on: jest.fn().mockReturnValue(jest.fn()),
    getNetworkName: jest.fn().mockReturnValue('freenode'),
    getCurrentNick: jest.fn().mockReturnValue('TestUser'),
    connect: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    connect: jest.fn().mockResolvedValue('freenode'),
    setActiveConnection: jest.fn(),
    getConnection: jest.fn(),
  },
}));

jest.mock('../../src/services/BouncerService', () => ({
  bouncerService: {
    getBouncerInfo: jest.fn().mockReturnValue({ playbackSupported: false }),
    requestPlayback: jest.fn(),
  },
}));

jest.mock('../../src/services/ChannelFavoritesService', () => ({
  channelFavoritesService: {
    getFavorites: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: jest.fn().mockResolvedValue([]),
    getSetting: jest.fn().mockResolvedValue(true),
  },
  NEW_FEATURE_DEFAULTS: {
    autoJoinFavorites: true,
  },
}));

import { autoReconnectService, AutoReconnectConfig } from '../../src/services/AutoReconnectService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectionManager } from '../../src/services/ConnectionManager';
import { settingsService } from '../../src/services/SettingsService';
import { bouncerService } from '../../src/services/BouncerService';
import { channelFavoritesService } from '../../src/services/ChannelFavoritesService';
import { ircService } from '../../src/services/IRCService';

describe('AutoReconnectService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (AsyncStorage as any).__reset && (AsyncStorage as any).__reset();
    // Reset service state
    (autoReconnectService as any).config = new Map();
    (autoReconnectService as any).connectionStates = new Map();
    (autoReconnectService as any).reconnectTimers = new Map();
    (autoReconnectService as any).isReconnecting = new Map();
    (autoReconnectService as any).lastReconnectTime = new Map();
    (autoReconnectService as any).intentionalDisconnects = new Map();
    (autoReconnectService as any).connectionListeners = new Map();
    (autoReconnectService as any).messageListeners = new Map();
    (autoReconnectService as any).intentionalDisconnectListeners = new Map();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('setConfig / getConfig', () => {
    it('should set and get config for a network', async () => {
      const config: AutoReconnectConfig = {
        enabled: true,
        maxAttempts: 10,
        initialDelay: 1000,
      };

      await autoReconnectService.setConfig('freenode', config);
      const retrieved = autoReconnectService.getConfig('freenode');

      expect(retrieved).toEqual(config);
    });

    it('should return undefined for unset network', () => {
      expect(autoReconnectService.getConfig('non-existent')).toBeUndefined();
    });

    it('should persist config to storage', async () => {
      const setItemSpy = jest.spyOn(AsyncStorage, 'setItem');
      
      await autoReconnectService.setConfig('freenode', { enabled: true });

      expect(setItemSpy).toHaveBeenCalledWith(
        '@AndroidIRCX:autoReconnectConfigs',
        expect.any(String)
      );
    });
  });

  describe('setEnabled / isEnabled', () => {
    it('should enable auto-reconnect', async () => {
      await autoReconnectService.setEnabled('freenode', true);
      expect(autoReconnectService.isEnabled('freenode')).toBe(true);
    });

    it('should disable auto-reconnect', async () => {
      await autoReconnectService.setEnabled('freenode', true);
      await autoReconnectService.setEnabled('freenode', false);
      expect(autoReconnectService.isEnabled('freenode')).toBe(false);
    });

    it('should return false for unset network', () => {
      expect(autoReconnectService.isEnabled('non-existent')).toBe(false);
    });

    it('should create default config when enabling', async () => {
      await autoReconnectService.setEnabled('newnetwork', true);
      const config = autoReconnectService.getConfig('newnetwork');
      expect(config?.enabled).toBe(true);
      expect(config?.maxAttempts).toBeDefined();
    });
  });

  describe('saveConnectionState / getConnectionState', () => {
    it('should save and retrieve connection state', async () => {
      const config = { host: 'irc.test.com', port: 6667 } as any;
      const channels = ['#general', '#help'];

      await autoReconnectService.saveConnectionState('freenode', config, channels);
      const state = autoReconnectService.getConnectionState('freenode');

      expect(state).toBeDefined();
      expect(state?.network).toBe('freenode');
      expect(state?.channels).toEqual(channels);
      expect(state?.config).toEqual(config);
    });

    it('should persist state to storage', async () => {
      const setItemSpy = jest.spyOn(AsyncStorage, 'setItem');
      
      await autoReconnectService.saveConnectionState('freenode', {} as any, []);

      expect(setItemSpy).toHaveBeenCalledWith(
        '@AndroidIRCX:connectionStates',
        expect.any(String)
      );
    });
  });

  describe('addChannelToState', () => {
    it('should add channel to connection state', async () => {
      await autoReconnectService.saveConnectionState('freenode', {} as any, []);
      autoReconnectService.addChannelToState('freenode', '#general');
      
      const state = autoReconnectService.getConnectionState('freenode');
      expect(state?.channels).toContain('#general');
    });

    it('should not add duplicate channels', async () => {
      await autoReconnectService.saveConnectionState('freenode', {} as any, []);
      autoReconnectService.addChannelToState('freenode', '#general');
      autoReconnectService.addChannelToState('freenode', '#general');
      
      const state = autoReconnectService.getConnectionState('freenode');
      expect(state?.channels).toHaveLength(1);
    });

    it('should handle non-existent network gracefully', () => {
      expect(() => autoReconnectService.addChannelToState('non-existent', '#general')).not.toThrow();
    });
  });

  describe('removeChannelFromState', () => {
    it('should remove channel from connection state', async () => {
      await autoReconnectService.saveConnectionState('freenode', {} as any, ['#general', '#help']);
      autoReconnectService.removeChannelFromState('freenode', '#general');
      
      const state = autoReconnectService.getConnectionState('freenode');
      expect(state?.channels).not.toContain('#general');
      expect(state?.channels).toContain('#help');
    });

    it('should handle non-existent network gracefully', () => {
      expect(() => autoReconnectService.removeChannelFromState('non-existent', '#general')).not.toThrow();
    });
  });

  describe('clearConnectionState', () => {
    it('should clear connection state for a network', async () => {
      await autoReconnectService.saveConnectionState('freenode', {} as any, ['#general']);
      await autoReconnectService.clearConnectionState('freenode');
      
      expect(autoReconnectService.getConnectionState('freenode')).toBeUndefined();
    });
  });

  describe('markIntentionalDisconnect', () => {
    it('should mark disconnect as intentional', () => {
      autoReconnectService.markIntentionalDisconnect('freenode');
      // The flag should prevent auto-reconnect
      expect((autoReconnectService as any).intentionalDisconnects.has('freenode')).toBe(true);
    });

    it('should cancel pending reconnect', async () => {
      await autoReconnectService.setConfig('freenode', { enabled: true });
      await autoReconnectService.saveConnectionState('freenode', {} as any, ['#general']);
      
      autoReconnectService.markIntentionalDisconnect('freenode');
      
      expect((autoReconnectService as any).intentionalDisconnects.has('freenode')).toBe(true);
    });
  });

  describe('clearIntentionalDisconnect', () => {
    it('should clear intentional disconnect flag', () => {
      autoReconnectService.markIntentionalDisconnect('freenode');
      (autoReconnectService as any).clearIntentionalDisconnect('freenode');
      
      expect((autoReconnectService as any).intentionalDisconnects.has('freenode')).toBe(false);
    });
  });

  describe('cancelReconnect', () => {
    it('should cancel pending reconnect timer', async () => {
      await autoReconnectService.setConfig('freenode', { enabled: true });
      await autoReconnectService.saveConnectionState('freenode', {} as any, ['#general']);
      
      // Start reconnect
      (autoReconnectService as any).isReconnecting.set('freenode', true);
      const timer = setTimeout(() => {}, 10000);
      (autoReconnectService as any).reconnectTimers.set('freenode', timer);
      
      autoReconnectService.cancelReconnect('freenode');
      
      expect((autoReconnectService as any).isReconnecting.get('freenode')).toBe(false);
      expect((autoReconnectService as any).reconnectTimers.has('freenode')).toBe(false);
    });
  });

  describe('registerConnection', () => {
    it('should register listeners for a specific connection', () => {
      const mockInstance = {
        onConnectionChange: jest.fn().mockReturnValue(jest.fn()),
        onMessage: jest.fn().mockReturnValue(jest.fn()),
        on: jest.fn().mockReturnValue(jest.fn()),
        getCurrentNick: jest.fn().mockReturnValue('TestUser'),
      };

      autoReconnectService.registerConnection('freenode', mockInstance as any);

      expect(mockInstance.onConnectionChange).toHaveBeenCalled();
      expect(mockInstance.onMessage).toHaveBeenCalled();
    });

    it('should clean up existing listeners before registering new ones', () => {
      const mockInstance = {
        onConnectionChange: jest.fn().mockReturnValue(jest.fn()),
        onMessage: jest.fn().mockReturnValue(jest.fn()),
        on: jest.fn().mockReturnValue(jest.fn()),
        getCurrentNick: jest.fn().mockReturnValue('TestUser'),
      };

      autoReconnectService.registerConnection('freenode', mockInstance as any);
      autoReconnectService.registerConnection('freenode', mockInstance as any);

      expect(mockInstance.onConnectionChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('unregisterConnection', () => {
    it('should unregister all listeners for a connection', () => {
      const cleanupMock = jest.fn();
      const mockInstance = {
        onConnectionChange: jest.fn().mockReturnValue(cleanupMock),
        onMessage: jest.fn().mockReturnValue(cleanupMock),
        on: jest.fn().mockReturnValue(cleanupMock),
        getCurrentNick: jest.fn().mockReturnValue('TestUser'),
      };

      autoReconnectService.registerConnection('freenode', mockInstance as any);
      autoReconnectService.unregisterConnection('freenode');

      expect(cleanupMock).toHaveBeenCalled();
    });

    it('should handle unregistering non-existent connection gracefully', () => {
      expect(() => autoReconnectService.unregisterConnection('non-existent')).not.toThrow();
    });
  });

  describe('handleDisconnected', () => {
    it('should not reconnect if disconnect was intentional', async () => {
      await autoReconnectService.setConfig('freenode', { enabled: true });
      await autoReconnectService.saveConnectionState('freenode', {} as any, ['#general']);
      
      autoReconnectService.markIntentionalDisconnect('freenode');
      
      // Simulate disconnect
      await (autoReconnectService as any).handleDisconnected('freenode');

      expect((autoReconnectService as any).isReconnecting.get('freenode')).toBeFalsy();
    });

    it('should not reconnect if already reconnecting', async () => {
      await autoReconnectService.setConfig('freenode', { enabled: true });
      await autoReconnectService.saveConnectionState('freenode', {} as any, ['#general']);
      
      (autoReconnectService as any).isReconnecting.set('freenode', true);
      
      await (autoReconnectService as any).handleDisconnected('freenode');
      
      // Should not start another reconnect
      expect((autoReconnectService as any).reconnectTimers.has('freenode')).toBe(false);
    });

    it('should not reconnect if auto-reconnect is disabled', async () => {
      await autoReconnectService.setConfig('freenode', { enabled: false });
      await autoReconnectService.saveConnectionState('freenode', {} as any, ['#general']);
      
      await (autoReconnectService as any).handleDisconnected('freenode');
      
      expect((autoReconnectService as any).isReconnecting.get('freenode')).toBeFalsy();
    });

    it('should not reconnect if max attempts reached', async () => {
      await autoReconnectService.setConfig('freenode', { enabled: true, maxAttempts: 3 });
      await autoReconnectService.saveConnectionState('freenode', {} as any, ['#general']);
      
      const state = autoReconnectService.getConnectionState('freenode');
      if (state) {
        state.reconnectAttempts = 3;
      }
      
      await (autoReconnectService as any).handleDisconnected('freenode');
      
      expect((autoReconnectService as any).isReconnecting.get('freenode')).toBeFalsy();
    });

    it('should use smart reconnect to avoid flood', async () => {
      await autoReconnectService.setConfig('freenode', { 
        enabled: true, 
        smartReconnect: true, 
        minReconnectInterval: 5000 
      });
      await autoReconnectService.saveConnectionState('freenode', {} as any, ['#general']);
      
      // Set last reconnect time to now
      (autoReconnectService as any).lastReconnectTime.set('freenode', Date.now());
      
      await (autoReconnectService as any).handleDisconnected('freenode');
      
      // Should wait before reconnecting
      expect((autoReconnectService as any).isReconnecting.get('freenode')).toBe(true);
    });
  });

  describe('initialize and reconnect internals', () => {
    it('initializes from storage and registers singleton listeners', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
        if (key === '@AndroidIRCX:connectionStates') {
          return JSON.stringify({
            freenode: {
              network: 'freenode',
              config: { host: 'irc.test' },
              channels: ['#a'],
              reconnectAttempts: 1,
            },
          });
        }
        if (key === '@AndroidIRCX:autoReconnectConfigs') {
          return JSON.stringify({
            freenode: { enabled: true, maxAttempts: 3 },
          });
        }
        return null;
      });

      await autoReconnectService.initialize();
      expect(autoReconnectService.getConnectionState('freenode')).toBeDefined();
      expect(autoReconnectService.getConfig('freenode')?.enabled).toBe(true);
      expect((ircService.onConnectionChange as jest.Mock)).toHaveBeenCalled();
      expect((ircService.onMessage as jest.Mock)).toHaveBeenCalled();
      expect((ircService.on as jest.Mock)).toHaveBeenCalledWith('intentional-quit', expect.any(Function));
    });

    it('handles initialize storage parse errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('{bad').mockResolvedValueOnce('{bad');
      await expect(autoReconnectService.initialize()).resolves.toBeUndefined();
    });

    it('resolveNetworkConfig matches exact and normalized ids', async () => {
      (settingsService.loadNetworks as jest.Mock).mockResolvedValue([
        { id: 'freenode', name: 'Freenode' },
        { id: 'libera', name: 'Libera Chat' },
      ]);
      const exact = await (autoReconnectService as any).resolveNetworkConfig('freenode');
      const normalized = await (autoReconnectService as any).resolveNetworkConfig('libera (2)');
      expect(exact?.id).toBe('freenode');
      expect(normalized?.id).toBe('libera');
    });

    it('attemptReconnect handles missing config/state and fallback singleton path', async () => {
      (autoReconnectService as any).isReconnecting.set('missing', true);
      (autoReconnectService as any).attemptReconnect('missing');
      expect((autoReconnectService as any).isReconnecting.get('missing')).toBe(false);

      await autoReconnectService.setConfig('freenode', {
        enabled: true,
        initialDelay: 1,
        maxDelay: 10,
        backoffMultiplier: 2,
      });
      await autoReconnectService.saveConnectionState('freenode', { host: 'x' } as any, ['#a']);
      (autoReconnectService as any).attemptReconnect('freenode');
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      expect((ircService.connect as jest.Mock)).toHaveBeenCalled();
    });

    it('attemptReconnect uses ConnectionManager when networkConfig exists', async () => {
      await autoReconnectService.setConfig('net1', { enabled: true, initialDelay: 1 });
      await autoReconnectService.saveConnectionState('net1', { host: 'x' } as any, [], { id: 'net1', name: 'Net1' } as any);

      (autoReconnectService as any).attemptReconnect('net1');
      jest.runOnlyPendingTimers();
      await Promise.resolve();

      expect((connectionManager.connect as jest.Mock)).toHaveBeenCalledWith(
        'net1',
        expect.objectContaining({ id: 'net1' }),
        expect.any(Object),
      );
      expect((connectionManager.setActiveConnection as jest.Mock)).toHaveBeenCalledWith('freenode');
    });

    it('rejoins via playback or join list branches on successful handleConnected', async () => {
      await autoReconnectService.setConfig('freenode', { enabled: true, rejoinChannels: true });
      await autoReconnectService.saveConnectionState(
        'freenode',
        { host: 'x' } as any,
        ['#a', '#b'],
        { id: 'freenode', name: 'Freenode', autoJoinChannels: ['#a', '#z'] } as any,
      );

      (bouncerService.getBouncerInfo as jest.Mock).mockReturnValueOnce({ playbackSupported: true });
      (autoReconnectService as any).handleConnected('freenode');
      jest.advanceTimersByTime(1001);
      await Promise.resolve();
      expect((bouncerService.requestPlayback as jest.Mock)).toHaveBeenCalled();

      const joinChannel = jest.fn();
      (connectionManager.getConnection as jest.Mock).mockReturnValue({ ircService: { joinChannel } });
      (settingsService.getSetting as jest.Mock).mockResolvedValueOnce(true);
      (channelFavoritesService.getFavorites as jest.Mock).mockReturnValue([{ name: '#fav', key: 'k' }]);
      await (autoReconnectService as any).rejoinChannels('freenode', ['#a', '#b']);
      jest.runOnlyPendingTimers();
      expect(joinChannel).toHaveBeenCalledWith('#fav', 'k');
      expect(joinChannel).toHaveBeenCalledWith('#a', undefined);
      expect(joinChannel).toHaveBeenCalledWith('#z', undefined);
    });
  });
});
