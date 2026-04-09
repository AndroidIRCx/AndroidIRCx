/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageCache } from '../src/services/StorageCache';

describe('StorageCache', () => {
  let cache: StorageCache;

  beforeEach(() => {
    cache = new StorageCache(10); // Small cache size for testing
    jest.clearAllMocks();
    (AsyncStorage as any).__reset();
  });

  afterEach(async () => {
    await cache.clear(true);
  });

  describe('getItem', () => {
    it('should return null for non-existent key', async () => {
      const result = await cache.getItem('nonexistent');
      expect(result).toBeNull();
    });

    it('should load item from AsyncStorage and cache it', async () => {
      await AsyncStorage.setItem('test-key', JSON.stringify({ foo: 'bar' }));

      const result = await cache.getItem('test-key');
      expect(result).toEqual({ foo: 'bar' });

      // Should be cached now
      expect(cache.has('test-key')).toBe(true);
    });

    it('should return cached item on second read', async () => {
      await AsyncStorage.setItem('test-key', JSON.stringify('value'));

      // Setup spy before first call
      const getItemSpy = jest.spyOn(AsyncStorage, 'getItem');

      // First read - from storage
      await cache.getItem('test-key');
      expect(getItemSpy).toHaveBeenCalledTimes(1);

      // Second read - from cache (AsyncStorage.getItem should not be called again)
      const result = await cache.getItem('test-key');

      expect(result).toBe('value');
      expect(getItemSpy).toHaveBeenCalledTimes(1); // Still just 1 call
    });

    it('should expire cached items after TTL', async () => {
      await AsyncStorage.setItem('test-key', JSON.stringify('value'));

      // Load with 100ms TTL
      await cache.getItem('test-key', { ttl: 100 });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should reload from storage
      const getItemSpy = jest.spyOn(AsyncStorage, 'getItem');
      await cache.getItem('test-key', { ttl: 100 });

      expect(getItemSpy).toHaveBeenCalledWith('test-key');
    });
  });

  describe('setItem', () => {
    it('should set item in cache immediately', async () => {
      await cache.setItem('test-key', 'value');

      // Should be in cache before AsyncStorage write
      expect(cache.has('test-key')).toBe(true);
    });

    it('should batch write to AsyncStorage after debounce', async () => {
      await cache.setItem('key1', 'value1');
      await cache.setItem('key2', 'value2');

      // AsyncStorage should not be called yet (debounced)
      expect(AsyncStorage.multiSet).not.toHaveBeenCalled();

      // Flush writes
      await cache.flush();

      // Now AsyncStorage should have been written
      expect(AsyncStorage.multiSet).toHaveBeenCalledWith([
        ['key1', JSON.stringify('value1')],
        ['key2', JSON.stringify('value2')],
      ]);
    });
  });

  describe('getBatch', () => {
    it('should load multiple keys efficiently', async () => {
      await AsyncStorage.multiSet([
        ['key1', JSON.stringify('value1')],
        ['key2', JSON.stringify('value2')],
        ['key3', JSON.stringify('value3')],
      ]);

      const result = await cache.getBatch(['key1', 'key2', 'key3']);

      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });

      // Should use multiGet
      expect(AsyncStorage.multiGet).toHaveBeenCalledWith([
        'key1',
        'key2',
        'key3',
      ]);
    });

    it('should return cached items without storage access', async () => {
      // Pre-populate cache
      await cache.setItem('key1', 'cached1');
      await cache.setItem('key2', 'cached2');
      await cache.flush();

      jest.clearAllMocks();

      const result = await cache.getBatch(['key1', 'key2']);

      expect(result).toEqual({
        key1: 'cached1',
        key2: 'cached2',
      });

      // Should not access AsyncStorage
      expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
    });

    it('should handle mix of cached and uncached keys', async () => {
      // One key in cache
      await cache.setItem('key1', 'cached1');
      await cache.flush();

      // One key in storage only
      await AsyncStorage.setItem('key2', JSON.stringify('stored2'));

      jest.clearAllMocks();

      const result = await cache.getBatch(['key1', 'key2']);

      expect(result).toEqual({
        key1: 'cached1',
        key2: 'stored2',
      });

      // Should only load uncached key
      expect(AsyncStorage.multiGet).toHaveBeenCalledWith(['key2']);
    });
  });

  describe('setBatch', () => {
    it('should batch write multiple items', async () => {
      await cache.setBatch([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 'value3' },
      ]);

      // All should be in cache
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);

      // Flush to storage
      await cache.flush();

      expect(AsyncStorage.multiSet).toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('should remove from cache and storage', async () => {
      await cache.setItem('test-key', 'value');
      await cache.flush();

      await cache.removeItem('test-key');

      expect(cache.has('test-key')).toBe(false);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('test-key');
    });
  });

  describe('removeBatch', () => {
    it('should remove multiple items', async () => {
      await cache.setBatch([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ]);

      await cache.removeBatch(['key1', 'key2']);

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect((AsyncStorage as any).removeMany).toHaveBeenCalledWith([
        'key1',
        'key2',
      ]);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used items when cache is full', async () => {
      // Fill cache to max (10 items)
      for (let i = 0; i < 10; i++) {
        await cache.setItem(`key${i}`, `value${i}`);
      }

      expect(cache.has('key0')).toBe(true);

      // Add 11th item - should evict key0 (oldest)
      await cache.setItem('key10', 'value10');

      expect(cache.has('key0')).toBe(false);
      expect(cache.has('key10')).toBe(true);
    });

    it('should update LRU on access', async () => {
      // Fill cache
      for (let i = 0; i < 10; i++) {
        await cache.setItem(`key${i}`, `value${i}`);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 2));
      }

      // Access key0 to make it recently used (updates timestamp)
      await cache.getItem('key0');
      await new Promise(resolve => setTimeout(resolve, 5));

      // Add new item - should evict oldest (likely key1)
      await cache.setItem('key10', 'value10');

      // key0 should still be there (was accessed recently)
      // key10 should be there (just added)
      // One of the middle keys should be gone
      expect(cache.has('key0')).toBe(true);
      expect(cache.has('key10')).toBe(true);
      expect(cache.getStats().size).toBe(10); // Cache should be at max size
    });
  });

  describe('lazyLoad', () => {
    it('should return cached data immediately', () => {
      cache.setItem('test-key', 'cached-value');

      const result = cache.lazyLoad('test-key', jest.fn());

      expect(result).toBe('cached-value');
    });

    it('should return null and load in background for uncached data', async () => {
      await AsyncStorage.setItem('test-key', JSON.stringify('stored-value'));

      const callback = jest.fn();
      const result = cache.lazyLoad('test-key', callback);

      expect(result).toBeNull();

      // Wait for async load
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith('stored-value');
    });
  });

  describe('progressiveLoad', () => {
    it('should load key groups in order', async () => {
      // Setup storage
      await AsyncStorage.multiSet([
        ['critical1', JSON.stringify('value1')],
        ['critical2', JSON.stringify('value2')],
        ['normal1', JSON.stringify('value3')],
        ['normal2', JSON.stringify('value4')],
      ]);

      const onGroupLoaded = jest.fn();

      await cache.progressiveLoad(
        [
          ['critical1', 'critical2'], // Group 0 (high priority)
          ['normal1', 'normal2'], // Group 1 (normal priority)
        ],
        onGroupLoaded,
      );

      // Should call callback for each group in order
      expect(onGroupLoaded).toHaveBeenCalledTimes(2);
      expect(onGroupLoaded).toHaveBeenNthCalledWith(1, 0, {
        critical1: 'value1',
        critical2: 'value2',
      });
      expect(onGroupLoaded).toHaveBeenNthCalledWith(2, 1, {
        normal1: 'value3',
        normal2: 'value4',
      });
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await cache.setItem('key1', 'value1');
      await cache.setItem('key2', 'value2');

      // Access key1 twice
      await cache.getItem('key1');
      await cache.getItem('key1');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0].key).toBe('key1');
      expect(stats.entries[0].hits).toBe(2);
    });
  });

  describe('prefetch', () => {
    it('should warm up cache with specified keys', async () => {
      await AsyncStorage.multiSet([
        ['key1', JSON.stringify('value1')],
        ['key2', JSON.stringify('value2')],
      ]);

      await cache.prefetch(['key1', 'key2']);

      // Both should be in cache
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear cache without clearing storage', async () => {
      await cache.setItem('test-key', 'value');
      await cache.flush();

      await cache.clear(false);

      expect(cache.has('test-key')).toBe(false);
      expect(AsyncStorage.clear).not.toHaveBeenCalled();
    });

    it('should clear both cache and storage when requested', async () => {
      await cache.setItem('test-key', 'value');
      await cache.flush();

      await cache.clear(true);

      expect(cache.has('test-key')).toBe(false);
      expect(AsyncStorage.clear).toHaveBeenCalled();
    });
  });
});
