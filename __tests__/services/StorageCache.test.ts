/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for StorageCache service
 */

import { storageCache, StorageCache } from '../../src/services/StorageCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('StorageCache', () => {
  beforeEach(async () => {
    await storageCache.clear(true);
    jest.clearAllMocks();
  });

  describe('getItem', () => {
    it('should return null for non-existent key', async () => {
      const result = await storageCache.getItem('non-existent');
      expect(result).toBeNull();
    });

    it('should store and retrieve string value', async () => {
      await storageCache.setItem('key1', 'value1');
      const result = await storageCache.getItem('key1');
      expect(result).toBe('value1');
    });

    it('should store and retrieve object value', async () => {
      const obj = { name: 'test', value: 123 };
      await storageCache.setItem('key2', obj);
      const result = await storageCache.getItem('key2');
      expect(result).toEqual(obj);
    });

    it('should return cached value without hitting AsyncStorage', async () => {
      await storageCache.setItem('key3', 'cached');
      const getItemSpy = jest.spyOn(AsyncStorage, 'getItem');
      
      const result = await storageCache.getItem('key3');
      
      expect(result).toBe('cached');
      expect(getItemSpy).not.toHaveBeenCalled();
    });

    it('should handle expired cache entries with TTL', async () => {
      await storageCache.setItem('key4', 'value4');
      
      // Get with very short TTL
      const result = await storageCache.getItem('key4', { ttl: 1 });
      expect(result).toBe('value4');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should return null after expiration
      const expired = await storageCache.getItem('key4', { ttl: 1 });
      expect(expired).toBeNull();
    });

    it('should handle zero TTL (no expiration)', async () => {
      await storageCache.setItem('key5', 'value5');
      const result = await storageCache.getItem('key5', { ttl: 0 });
      expect(result).toBe('value5');
    });

    it('should handle invalid JSON in storage gracefully', async () => {
      await AsyncStorage.setItem('bad-json', 'not valid json');
      const result = await storageCache.getItem('bad-json');
      expect(result).toBeNull();
    });
  });

  describe('setItem', () => {
    it('should update cache immediately', async () => {
      await storageCache.setItem('key1', 'value1');
      expect(storageCache.has('key1')).toBe(true);
    });

    it('should queue write to AsyncStorage', async () => {
      const multiSetSpy = jest.spyOn(AsyncStorage, 'multiSet');
      await storageCache.setItem('key1', 'value1');
      
      // Write is debounced, so it shouldn't happen immediately
      expect(multiSetSpy).not.toHaveBeenCalled();
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      expect(multiSetSpy).toHaveBeenCalled();
    });

    it('should handle complex objects', async () => {
      const complex = { 
        nested: { array: [1, 2, 3] }, 
        date: new Date().toISOString(),
        nullValue: null
      };
      await storageCache.setItem('complex', complex);
      const result = await storageCache.getItem('complex');
      expect(result).toEqual(complex);
    });
  });

  describe('removeItem', () => {
    it('should remove item from cache and storage', async () => {
      await storageCache.setItem('key1', 'value1');
      await storageCache.removeItem('key1');
      
      expect(storageCache.has('key1')).toBe(false);
      
      const fromStorage = await AsyncStorage.getItem('key1');
      expect(fromStorage).toBeNull();
    });

    it('should handle removing non-existent key', async () => {
      await expect(storageCache.removeItem('non-existent')).resolves.not.toThrow();
    });
  });

  describe('invalidate', () => {
    it('should remove only in-memory cache entry and keep AsyncStorage value', async () => {
      await storageCache.setItem('invalidate-key', 'value1');
      await storageCache.flush();

      expect(storageCache.has('invalidate-key')).toBe(true);
      storageCache.invalidate('invalidate-key');
      expect(storageCache.has('invalidate-key')).toBe(false);

      const fromStorage = await AsyncStorage.getItem('invalidate-key');
      expect(fromStorage).toBe(JSON.stringify('value1'));
    });
  });

  describe('getBatch', () => {
    it('should retrieve multiple items', async () => {
      await storageCache.setItem('a', 'value-a');
      await storageCache.setItem('b', 'value-b');
      await storageCache.setItem('c', 'value-c');
      
      const results = await storageCache.getBatch(['a', 'b', 'c', 'd']);
      
      expect(results).toEqual({
        a: 'value-a',
        b: 'value-b',
        c: 'value-c',
        d: null,
      });
    });

    it('should use multiGet for batch operations', async () => {
      const multiGetSpy = jest.spyOn(AsyncStorage, 'multiGet');
      await storageCache.getBatch(['a', 'b']);
      expect(multiGetSpy).toHaveBeenCalledWith(['a', 'b']);
    });

    it('should handle invalid JSON in batch gracefully', async () => {
      await AsyncStorage.setItem('valid', JSON.stringify({ data: true }));
      await AsyncStorage.setItem('invalid', 'not json');
      
      const results = await storageCache.getBatch(['valid', 'invalid']);
      
      expect(results.valid).toEqual({ data: true });
      expect(results.invalid).toBeNull();
    });
  });

  describe('setBatch', () => {
    it('should set multiple items', async () => {
      await storageCache.setBatch([
        { key: 'batch1', value: 'val1' },
        { key: 'batch2', value: 'val2' },
      ]);
      
      expect(storageCache.has('batch1')).toBe(true);
      expect(storageCache.has('batch2')).toBe(true);
    });
  });

  describe('removeBatch', () => {
    it('should remove multiple items', async () => {
      await storageCache.setItem('r1', 'v1');
      await storageCache.setItem('r2', 'v2');
      
      await storageCache.removeBatch(['r1', 'r2']);
      
      expect(storageCache.has('r1')).toBe(false);
      expect(storageCache.has('r2')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear cache without clearing storage', async () => {
      await storageCache.setItem('key1', 'value1');
      await storageCache.clear(false);
      
      expect(storageCache.has('key1')).toBe(false);
    });

    it('should clear cache and storage when specified', async () => {
      await storageCache.setItem('key1', 'value1');
      await storageCache.flush();
      
      await storageCache.clear(true);
      
      const fromStorage = await AsyncStorage.getItem('key1');
      expect(fromStorage).toBeNull();
    });
  });

  describe('lazyLoad', () => {
    it('should return cached data immediately', async () => {
      await storageCache.setItem('lazy1', 'immediate');
      
      const callback = jest.fn();
      const result = storageCache.lazyLoad('lazy1', callback);
      
      expect(result).toBe('immediate');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should return null and load in background', (done) => {
      AsyncStorage.setItem('bg-key', JSON.stringify('background-value'));
      
      const callback = jest.fn((data) => {
        expect(data).toBe('background-value');
        done();
      });
      
      const result = storageCache.lazyLoad('bg-key', callback);
      expect(result).toBeNull();
    });
  });

  describe('progressiveLoad', () => {
    it('should load groups in order', async () => {
      await storageCache.setItem('g1a', 'v1a');
      await storageCache.setItem('g2a', 'v2a');
      
      const onGroupLoaded = jest.fn();
      
      const results = await storageCache.progressiveLoad(
        [['g1a'], ['g2a']],
        onGroupLoaded
      );
      
      expect(results).toEqual({ g1a: 'v1a', g2a: 'v2a' });
      expect(onGroupLoaded).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await storageCache.setItem('stat1', 'v1');
      await storageCache.setItem('stat2', 'v2');
      await storageCache.getItem('stat1');
      await storageCache.getItem('stat1');
      
      const stats = storageCache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(100);
      expect(stats.entries).toHaveLength(2);
      
      // stat1 should have higher hits
      const stat1 = stats.entries.find(e => e.key === 'stat1');
      expect(stat1?.hits).toBe(2);
    });
  });

  describe('prefetch', () => {
    it('should warm up cache with specified keys', async () => {
      await AsyncStorage.setItem('prefetch1', JSON.stringify('p1'));
      await AsyncStorage.setItem('prefetch2', JSON.stringify('p2'));
      
      expect(storageCache.has('prefetch1')).toBe(false);
      
      await storageCache.prefetch(['prefetch1', 'prefetch2']);
      
      expect(storageCache.has('prefetch1')).toBe(true);
      expect(storageCache.has('prefetch2')).toBe(true);
    });
  });

  describe('has', () => {
    it('should return true for cached items', async () => {
      await storageCache.setItem('exists', 'value');
      expect(storageCache.has('exists')).toBe(true);
      expect(storageCache.has('missing')).toBe(false);
    });
  });

  describe('flush', () => {
    it('should immediately write pending changes', async () => {
      const multiSetSpy = jest.spyOn(AsyncStorage, 'multiSet');
      
      await storageCache.setItem('flush1', 'v1');
      await storageCache.flush();
      
      expect(multiSetSpy).toHaveBeenCalled();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest items when cache is full', async () => {
      const cache = new StorageCache(3);
      
      await cache.setItem('a', '1');
      await new Promise(r => setTimeout(r, 10));
      await cache.setItem('b', '2');
      await new Promise(r => setTimeout(r, 10));
      await cache.setItem('c', '3');
      await new Promise(r => setTimeout(r, 10));
      
      // Access 'a' to make it recently used
      await cache.getItem('a');
      await new Promise(r => setTimeout(r, 10));
      
      // Add new item, should evict 'b' (oldest)
      await cache.setItem('d', '4');
      
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false); // Evicted
      expect(cache.has('c')).toBe(true);
      expect(cache.has('d')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string values', async () => {
      await storageCache.setItem('empty', '');
      const result = await storageCache.getItem('empty');
      expect(result).toBe('');
    });

    it('should handle null values', async () => {
      await storageCache.setItem('null-val', null);
      const result = await storageCache.getItem('null-val');
      expect(result).toBeNull();
    });

    it('should handle special characters in keys', async () => {
      const key = 'key:with:colons/slashes.dots';
      await storageCache.setItem(key, 'special');
      const result = await storageCache.getItem(key);
      expect(result).toBe('special');
    });

    it('should update hit count correctly', async () => {
      await storageCache.setItem('hits', 'value');
      
      await storageCache.getItem('hits');
      await storageCache.getItem('hits');
      await storageCache.getItem('hits');
      
      const stats = storageCache.getStats();
      const entry = stats.entries.find(e => e.key === 'hits');
      expect(entry?.hits).toBe(3);
    });
  });
});
