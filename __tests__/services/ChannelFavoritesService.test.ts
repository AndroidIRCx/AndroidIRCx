/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ChannelFavoritesService - Wave 6
 */

import { channelFavoritesService } from '../../src/services/ChannelFavoritesService';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
}));

describe('ChannelFavoritesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    // Reset service state
    (channelFavoritesService as any).favorites = new Map();
    (channelFavoritesService as any).listeners = [];
  });

  describe('Initialization', () => {
    it('should initialize with empty favorites', async () => {
      await channelFavoritesService.initialize();
      expect(channelFavoritesService.getAllFavorites().size).toBe(0);
    });

    it('should load stored favorites on initialize', async () => {
      const storedFavorites = {
        freenode: [
          { name: '#general', network: 'freenode', autoJoin: true, addedAt: Date.now() },
        ],
      };
      mockStorage['@AndroidIRCX:channelFavorites'] = JSON.stringify(storedFavorites);

      await channelFavoritesService.initialize();
      const favorites = channelFavoritesService.getFavorites('freenode');

      expect(favorites).toHaveLength(1);
      expect(favorites[0].name).toBe('#general');
    });

    it('should handle storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { getItem } = require('@react-native-async-storage/async-storage');
      getItem.mockRejectedValueOnce(new Error('Storage error'));

      await channelFavoritesService.initialize();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Add Favorite', () => {
    it('should add a new favorite', async () => {
      await channelFavoritesService.addFavorite('freenode', '#general', 'key123', true);

      const favorites = channelFavoritesService.getFavorites('freenode');
      expect(favorites).toHaveLength(1);
      expect(favorites[0].name).toBe('#general');
      expect(favorites[0].key).toBe('key123');
      expect(favorites[0].autoJoin).toBe(true);
      expect(favorites[0].addedAt).toBeDefined();
    });

    it('should update existing favorite', async () => {
      await channelFavoritesService.addFavorite('freenode', '#general', 'oldKey', false);
      await channelFavoritesService.addFavorite('freenode', '#general', 'newKey', true);

      const favorites = channelFavoritesService.getFavorites('freenode');
      expect(favorites).toHaveLength(1);
      expect(favorites[0].key).toBe('newKey');
      expect(favorites[0].autoJoin).toBe(true);
    });

    it('should save to storage when adding', async () => {
      const { setItem } = require('@react-native-async-storage/async-storage');
      await channelFavoritesService.addFavorite('freenode', '#test');

      expect(setItem).toHaveBeenCalledWith(
        '@AndroidIRCX:channelFavorites',
        expect.any(String)
      );
    });

    it('should notify listeners when adding favorite', async () => {
      const listener = jest.fn();
      channelFavoritesService.onFavoritesChange(listener);

      await channelFavoritesService.addFavorite('freenode', '#general');

      expect(listener).toHaveBeenCalledWith('freenode', expect.any(Array));
    });

    it('should log save errors but keep favorite in memory', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { setItem } = require('@react-native-async-storage/async-storage');
      setItem.mockRejectedValueOnce(new Error('Save failed'));

      await channelFavoritesService.addFavorite('freenode', '#general');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save channel favorites:',
        expect.any(Error)
      );
      expect(channelFavoritesService.isFavorite('freenode', '#general')).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  describe('Remove Favorite', () => {
    beforeEach(async () => {
      await channelFavoritesService.addFavorite('freenode', '#general');
      await channelFavoritesService.addFavorite('freenode', '#random');
    });

    it('should remove a favorite', async () => {
      await channelFavoritesService.removeFavorite('freenode', '#general');

      const favorites = channelFavoritesService.getFavorites('freenode');
      expect(favorites).toHaveLength(1);
      expect(favorites[0].name).toBe('#random');
    });

    it('should delete network when last favorite removed', async () => {
      await channelFavoritesService.removeFavorite('freenode', '#general');
      await channelFavoritesService.removeFavorite('freenode', '#random');

      const allFavorites = channelFavoritesService.getAllFavorites();
      expect(allFavorites.has('freenode')).toBe(false);
    });

    it('should notify listeners when removing', async () => {
      const listener = jest.fn();
      channelFavoritesService.onFavoritesChange(listener);

      await channelFavoritesService.removeFavorite('freenode', '#general');

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Move Favorite', () => {
    beforeEach(async () => {
      await channelFavoritesService.addFavorite('freenode', '#general', 'key123', true);
    });

    it('should move favorite to another network', async () => {
      await channelFavoritesService.moveFavorite('freenode', '#general', 'dalnet');

      expect(channelFavoritesService.isFavorite('freenode', '#general')).toBe(false);
      expect(channelFavoritesService.isFavorite('dalnet', '#general')).toBe(true);
    });

    it('should preserve key and autoJoin when moving', async () => {
      await channelFavoritesService.moveFavorite('freenode', '#general', 'dalnet');

      const moved = channelFavoritesService.getFavorites('dalnet')[0];
      expect(moved.key).toBe('key123');
      expect(moved.autoJoin).toBe(true);
    });

    it('should not move if source equals target', async () => {
      const listener = jest.fn();
      channelFavoritesService.onFavoritesChange(listener);

      await channelFavoritesService.moveFavorite('freenode', '#general', 'freenode');

      // Listener should not be called for same network
      const callsForFreenode = listener.mock.calls.filter(c => c[0] === 'freenode');
      expect(callsForFreenode.length).toBe(0);
    });

    it('should update existing target favorite', async () => {
      await channelFavoritesService.addFavorite('dalnet', '#general', 'oldKey', false);
      await channelFavoritesService.moveFavorite('freenode', '#general', 'dalnet');

      const favorites = channelFavoritesService.getFavorites('dalnet');
      expect(favorites).toHaveLength(1);
      expect(favorites[0].key).toBe('key123');
      expect(favorites[0].autoJoin).toBe(true);
    });

    it('should notify both networks when moving', async () => {
      const listener = jest.fn();
      channelFavoritesService.onFavoritesChange(listener);

      await channelFavoritesService.moveFavorite('freenode', '#general', 'dalnet');

      const sourceCalls = listener.mock.calls.filter(c => c[0] === 'freenode');
      const targetCalls = listener.mock.calls.filter(c => c[0] === 'dalnet');
      expect(sourceCalls.length).toBeGreaterThan(0);
      expect(targetCalls.length).toBeGreaterThan(0);
    });

    it('should do nothing when source favorite does not exist', async () => {
      const listener = jest.fn();
      channelFavoritesService.onFavoritesChange(listener);

      await channelFavoritesService.moveFavorite('freenode', '#missing', 'dalnet');

      expect(channelFavoritesService.getFavorites('freenode')).toHaveLength(1);
      expect(channelFavoritesService.getFavorites('dalnet')).toEqual([]);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Check Favorite', () => {
    it('should return true for favorited channel', async () => {
      await channelFavoritesService.addFavorite('freenode', '#general');
      expect(channelFavoritesService.isFavorite('freenode', '#general')).toBe(true);
    });

    it('should return false for non-favorited channel', () => {
      expect(channelFavoritesService.isFavorite('freenode', '#random')).toBe(false);
    });

    it('should return false for non-existent network', () => {
      expect(channelFavoritesService.isFavorite('nonexistent', '#general')).toBe(false);
    });
  });

  describe('Get Favorites', () => {
    beforeEach(async () => {
      await channelFavoritesService.addFavorite('freenode', '#general');
      await channelFavoritesService.addFavorite('freenode', '#random');
      await channelFavoritesService.addFavorite('dalnet', '#test');
    });

    it('should get favorites for specific network', () => {
      const freenodeFavs = channelFavoritesService.getFavorites('freenode');
      expect(freenodeFavs).toHaveLength(2);
    });

    it('should return empty array for non-existent network', () => {
      const favorites = channelFavoritesService.getFavorites('nonexistent');
      expect(favorites).toEqual([]);
    });

    it('should return copy of favorites array', () => {
      const favorites1 = channelFavoritesService.getFavorites('freenode');
      const favorites2 = channelFavoritesService.getFavorites('freenode');
      expect(favorites1).toEqual(favorites2);
      expect(favorites1).not.toBe(favorites2);
    });

    it('should get all favorites', () => {
      const allFavorites = channelFavoritesService.getAllFavorites();
      expect(allFavorites.size).toBe(2);
      expect(allFavorites.get('freenode')).toHaveLength(2);
      expect(allFavorites.get('dalnet')).toHaveLength(1);
    });

    it('should return copy of all favorites map', () => {
      const all1 = channelFavoritesService.getAllFavorites();
      const all2 = channelFavoritesService.getAllFavorites();
      expect(all1).not.toBe(all2);
    });
  });

  describe('Auto Join', () => {
    beforeEach(async () => {
      await channelFavoritesService.addFavorite('freenode', '#general', undefined, false);
      await channelFavoritesService.addFavorite('freenode', '#random', undefined, true);
    });

    it('should get auto-join channels', () => {
      const autoJoin = channelFavoritesService.getAutoJoinChannels('freenode');
      expect(autoJoin).toHaveLength(1);
      expect(autoJoin[0].name).toBe('#random');
    });

    it('should set auto-join for a favorite', async () => {
      await channelFavoritesService.setAutoJoin('freenode', '#general', true);

      const autoJoin = channelFavoritesService.getAutoJoinChannels('freenode');
      expect(autoJoin).toHaveLength(2);
    });

    it('should not change auto-join for non-existent favorite', async () => {
      await channelFavoritesService.setAutoJoin('freenode', '#nonexistent', true);

      const autoJoin = channelFavoritesService.getAutoJoinChannels('freenode');
      expect(autoJoin).toHaveLength(1);
    });

    it('should notify listeners when changing auto-join', async () => {
      const listener = jest.fn();
      channelFavoritesService.onFavoritesChange(listener);

      await channelFavoritesService.setAutoJoin('freenode', '#general', true);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Update Key', () => {
    beforeEach(async () => {
      await channelFavoritesService.addFavorite('freenode', '#general', 'oldKey');
    });

    it('should update favorite key', async () => {
      await channelFavoritesService.updateFavoriteKey('freenode', '#general', 'newKey');

      const favorite = channelFavoritesService.getFavorites('freenode')[0];
      expect(favorite.key).toBe('newKey');
    });

    it('should remove key when undefined', async () => {
      await channelFavoritesService.updateFavoriteKey('freenode', '#general', undefined);

      const favorite = channelFavoritesService.getFavorites('freenode')[0];
      expect(favorite.key).toBeUndefined();
    });

    it('should not change non-existent favorite', async () => {
      await channelFavoritesService.updateFavoriteKey('freenode', '#nonexistent', 'key');

      const favorites = channelFavoritesService.getFavorites('freenode');
      expect(favorites[0].key).toBe('oldKey');
    });

    it('should save to storage when updating key', async () => {
      const { setItem } = require('@react-native-async-storage/async-storage');
      await channelFavoritesService.updateFavoriteKey('freenode', '#general', 'newKey');

      expect(setItem).toHaveBeenCalled();
    });
  });

  describe('Listeners', () => {
    it('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = channelFavoritesService.onFavoritesChange(listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe listener', async () => {
      const listener = jest.fn();
      const unsubscribe = channelFavoritesService.onFavoritesChange(listener);

      unsubscribe();
      await channelFavoritesService.addFavorite('freenode', '#general');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      channelFavoritesService.onFavoritesChange(listener1);
      channelFavoritesService.onFavoritesChange(listener2);

      await channelFavoritesService.addFavorite('freenode', '#general');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should allow unsubscribe to be called more than once', async () => {
      const listener = jest.fn();
      const unsubscribe = channelFavoritesService.onFavoritesChange(listener);

      unsubscribe();
      unsubscribe();
      await channelFavoritesService.addFavorite('freenode', '#general');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
