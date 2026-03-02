/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for PerformanceService - Wave 6
 */

import { performanceService, PerformanceConfig } from '../../src/services/PerformanceService';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
}));

describe('PerformanceService', () => {
  const defaultConfig = {
    enableVirtualization: true,
    maxVisibleMessages: 100,
    messageLoadChunk: 50,
    enableLazyLoading: true,
    messageLimit: 1000,
    enableMessageCleanup: false,
    cleanupThreshold: 1500,
    renderOptimization: true,
    imageLazyLoad: true,
    userListGrouping: true,
    userListVirtualization: true,
    userListAutoDisableGroupingThreshold: 1000,
    userListAutoVirtualizeThreshold: 500,
    userListType: 'flashlist',
    userListSearchDebounceMs: 300,
    userListSkipSortThreshold: 1000,
    userListEnableChunkLoading: true,
    userListChunkSize: 100,
    userListInitialRenderCount: 50,
  } satisfies PerformanceConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    // Reset service state
    (performanceService as any).config = { ...defaultConfig };
    (performanceService as any).listeners = [];
  });

  describe('Initialization', () => {
    it('should initialize with default config', async () => {
      await performanceService.initialize();
      const config = performanceService.getConfig();
      expect(config.enableVirtualization).toBe(true);
      expect(config.maxVisibleMessages).toBe(100);
      expect(config.messageLoadChunk).toBe(50);
    });

    it('should load stored config on initialize', async () => {
      mockStorage['@AndroidIRCX:performanceConfig'] = JSON.stringify({
        maxVisibleMessages: 200,
        enableVirtualization: false,
        userListType: 'flatlist',
        userListSearchDebounceMs: 150,
      });

      await performanceService.initialize();
      const config = performanceService.getConfig();
      expect(config.maxVisibleMessages).toBe(200);
      expect(config.enableVirtualization).toBe(false);
      expect(config.userListType).toBe('flatlist');
      expect(config.userListSearchDebounceMs).toBe(150);
    });

    it('should handle storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { getItem } = require('@react-native-async-storage/async-storage');
      getItem.mockRejectedValueOnce(new Error('Storage error'));

      await performanceService.initialize();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Config Getters', () => {
    beforeEach(async () => {
      await performanceService.initialize();
    });

    it('should get max visible messages', () => {
      expect(performanceService.getMaxVisibleMessages()).toBe(100);
    });

    it('should get message load chunk', () => {
      expect(performanceService.getMessageLoadChunk()).toBe(50);
    });

    it('should check if virtualization is enabled', () => {
      expect(performanceService.isVirtualizationEnabled()).toBe(true);
    });

    it('should check if lazy loading is enabled', () => {
      expect(performanceService.isLazyLoadingEnabled()).toBe(true);
    });

    it('should check if render optimization is enabled', () => {
      expect(performanceService.isRenderOptimizationEnabled()).toBe(true);
    });

    it('should check if image lazy load is enabled', () => {
      expect(performanceService.isImageLazyLoadEnabled()).toBe(true);
    });

    it('should get message limit', () => {
      expect(performanceService.getMessageLimit()).toBe(1000);
    });

    it('should check if message cleanup is enabled', () => {
      expect(performanceService.isMessageCleanupEnabled()).toBe(false);
    });

    it('should get cleanup threshold', () => {
      expect(performanceService.getCleanupThreshold()).toBe(1500);
    });

    it('should get user list type', () => {
      expect(performanceService.getUserListType()).toBe('flashlist');
    });

    it('should get user list search debounce', () => {
      expect(performanceService.getUserListSearchDebounceMs()).toBe(300);
    });

    it('should get user list skip sort threshold', () => {
      expect(performanceService.getUserListSkipSortThreshold()).toBe(1000);
    });
  });

  describe('Config Updates', () => {
    beforeEach(async () => {
      await performanceService.initialize();
    });

    it('should update config values', async () => {
      await performanceService.setConfig({ maxVisibleMessages: 150 });
      expect(performanceService.getMaxVisibleMessages()).toBe(150);
    });

    it('should merge partial updates', async () => {
      await performanceService.setConfig({
        maxVisibleMessages: 150,
        enableVirtualization: false,
        userListType: 'simple',
      });
      const config = performanceService.getConfig();
      expect(config.maxVisibleMessages).toBe(150);
      expect(config.enableVirtualization).toBe(false);
      expect(config.userListType).toBe('simple');
      expect(config.messageLoadChunk).toBe(50); // unchanged
      expect(config.userListSearchDebounceMs).toBe(300); // unchanged
    });

    it('should save config to storage', async () => {
      const { setItem } = require('@react-native-async-storage/async-storage');
      await performanceService.setConfig({ maxVisibleMessages: 200 });
      expect(setItem).toHaveBeenCalledWith(
        '@AndroidIRCX:performanceConfig',
        expect.stringContaining('200')
      );
    });

    it('should notify listeners on config change', async () => {
      const listener = jest.fn();
      performanceService.onConfigChange(listener);

      await performanceService.setConfig({ maxVisibleMessages: 300 });

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        maxVisibleMessages: 300,
      }));
    });

    it('should handle storage errors on save', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { setItem } = require('@react-native-async-storage/async-storage');
      setItem.mockRejectedValueOnce(new Error('Save error'));

      await performanceService.setConfig({ maxVisibleMessages: 150 });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Listeners', () => {
    it('should return unsubscribe function', async () => {
      await performanceService.initialize();
      const listener = jest.fn();
      const unsubscribe = performanceService.onConfigChange(listener);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();

      await performanceService.setConfig({ maxVisibleMessages: 400 });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      await performanceService.initialize();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();

      performanceService.onConfigChange(errorListener);
      performanceService.onConfigChange(goodListener);

      await performanceService.setConfig({ maxVisibleMessages: 500 });

      expect(errorListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Config Immutability', () => {
    it('should return a copy of config, not the original', async () => {
      await performanceService.initialize();
      const config1 = performanceService.getConfig();
      const config2 = performanceService.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });

    it('should not allow external mutation of config', async () => {
      await performanceService.initialize();
      const config = performanceService.getConfig();
      config.maxVisibleMessages = 999;

      expect(performanceService.getMaxVisibleMessages()).toBe(100);
    });
  });
});
