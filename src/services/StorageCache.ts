/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * StorageCache.ts
 *
 * High-performance caching layer for AsyncStorage with:
 * - LRU (Least Recently Used) in-memory cache
 * - Batch read/write operations
 * - Lazy loading support
 * - Progressive loading (structure first, content later)
 * - TTL (Time To Live) for cache entries
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (0 = no expiration)
  maxSize?: number; // Maximum cache entries
  lazy?: boolean; // Enable lazy loading
}

export interface BatchReadResult<T> {
  [key: string]: T | null;
}

class StorageCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_MAX_SIZE = 100;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private maxSize: number;
  private pendingWrites: Map<string, any> = new Map();
  private writeTimer: NodeJS.Timeout | null = null;
  private readonly WRITE_DEBOUNCE_MS = 2000; // Batch writes every 2 seconds

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Get item from cache or AsyncStorage
   */
  async getItem<T = string>(
    key: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    const { ttl = this.DEFAULT_TTL } = options;

    // Check cache first
    const cached = this.cache.get(key);
    if (cached) {
      // Check if expired
      if (ttl > 0 && Date.now() - cached.timestamp > ttl) {
        this.cache.delete(key);
      } else {
        // Update hit count and return cached data
        cached.hits++;
        cached.timestamp = Date.now(); // Update LRU timestamp
        return cached.data as T;
      }
    }

    // Not in cache or expired - load from storage
    try {
      const value = await AsyncStorage.getItem(key);
      if (value !== null) {
        const parsed = JSON.parse(value) as T;
        this.setCache(key, parsed);
        return parsed;
      }
      return null;
    } catch (error) {
      console.error(`StorageCache: Error loading key "${key}":`, error);
      return null;
    }
  }

  /**
   * Batch read multiple keys efficiently
   * Uses AsyncStorage.multiGet for better performance
   */
  async getBatch<T = any>(
    keys: string[],
    options: CacheOptions = {}
  ): Promise<BatchReadResult<T>> {
    const result: BatchReadResult<T> = {};
    const keysToLoad: string[] = [];
    const { ttl = this.DEFAULT_TTL } = options;

    // Check cache for each key
    keys.forEach(key => {
      const cached = this.cache.get(key);
      if (cached && (ttl === 0 || Date.now() - cached.timestamp <= ttl)) {
        cached.hits++;
        cached.timestamp = Date.now();
        result[key] = cached.data as T;
      } else {
        keysToLoad.push(key);
      }
    });

    // Load remaining keys from storage in batch
    if (keysToLoad.length > 0) {
      try {
        const values = await AsyncStorage.multiGet(keysToLoad);
        values.forEach(([key, value]) => {
          if (value !== null) {
            try {
              const parsed = JSON.parse(value) as T;
              this.setCache(key, parsed);
              result[key] = parsed;
            } catch (parseError) {
              console.error(`StorageCache: Parse error for key "${key}":`, parseError);
              result[key] = null;
            }
          } else {
            result[key] = null;
          }
        });
      } catch (error) {
        console.error('StorageCache: Batch read error:', error);
      }
    }

    return result;
  }

  /**
   * Set item in cache and AsyncStorage (debounced)
   */
  async setItem<T = any>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    // Update cache immediately
    this.setCache(key, value);

    // Queue write operation (debounced)
    this.pendingWrites.set(key, value);
    this.scheduleBatchWrite();
  }

  /**
   * Batch write multiple keys efficiently
   */
  async setBatch<T = any>(items: { key: string; value: T }[]): Promise<void> {
    // Update cache immediately
    items.forEach(({ key, value }) => {
      this.setCache(key, value);
      this.pendingWrites.set(key, value);
    });

    // Schedule batch write
    this.scheduleBatchWrite();
  }

  /**
   * Remove item from cache and storage
   */
  async removeItem(key: string): Promise<void> {
    this.cache.delete(key);
    this.pendingWrites.delete(key);
    await AsyncStorage.removeItem(key);
  }

  /**
   * Remove a key from in-memory cache and pending writes without touching AsyncStorage.
   * Useful when external code writes directly to AsyncStorage and we need to avoid stale cache/pending overwrite.
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.pendingWrites.delete(key);
  }

  /**
   * Remove multiple items
   */
  async removeBatch(keys: string[]): Promise<void> {
    keys.forEach(key => {
      this.cache.delete(key);
      this.pendingWrites.delete(key);
    });
    await AsyncStorage.multiRemove(keys);
  }

  /**
   * Clear all cache and optionally storage
   */
  async clear(clearStorage: boolean = false): Promise<void> {
    this.cache.clear();
    this.pendingWrites.clear();
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    if (clearStorage) {
      await AsyncStorage.clear();
    }
  }

  /**
   * Lazy load data - returns immediately with cached data or null,
   * loads in background and calls callback when ready
   */
  lazyLoad<T = any>(
    key: string,
    callback: (data: T | null) => void,
    options: CacheOptions = {}
  ): T | null {
    // Return cached data immediately if available
    const cached = this.cache.get(key);
    if (cached) {
      const { ttl = this.DEFAULT_TTL } = options;
      if (ttl === 0 || Date.now() - cached.timestamp <= ttl) {
        cached.hits++;
        cached.timestamp = Date.now();
        return cached.data as T;
      }
    }

    // Load in background
    this.getItem<T>(key, options).then(data => {
      callback(data);
    });

    return null;
  }

  /**
   * Progressive load - loads keys in order of priority
   * Useful for app startup: load critical data first, then rest
   */
  async progressiveLoad<T = any>(
    keyGroups: string[][],
    onGroupLoaded?: (groupIndex: number, data: BatchReadResult<T>) => void
  ): Promise<BatchReadResult<T>> {
    const allResults: BatchReadResult<T> = {};

    for (let i = 0; i < keyGroups.length; i++) {
      const group = keyGroups[i];
      const groupResults = await this.getBatch<T>(group);
      Object.assign(allResults, groupResults);

      if (onGroupLoaded) {
        onGroupLoaded(i, groupResults);
      }
    }

    return allResults;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; hits: number; age: number }>;
  } {
    const entries: Array<{ key: string; hits: number; age: number }> = [];
    let totalHits = 0;

    this.cache.forEach((entry, key) => {
      totalHits += entry.hits;
      entries.push({
        key,
        hits: entry.hits,
        age: Date.now() - entry.timestamp,
      });
    });

    // Sort by hits (most accessed first)
    entries.sort((a, b) => b.hits - a.hits);

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalHits / Math.max(1, this.cache.size),
      entries,
    };
  }

  /**
   * Prefetch keys to warm up cache
   */
  async prefetch(keys: string[]): Promise<void> {
    await this.getBatch(keys);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Flush pending writes immediately
   */
  async flush(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    await this.executeBatchWrite();
  }

  /**
   * PRIVATE: Set cache entry with LRU eviction
   */
  private setCache<T>(key: string, value: T): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const lruKey = this.findLRUKey();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * PRIVATE: Find least recently used key for eviction
   */
  private findLRUKey(): string | null {
    let lruKey: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        lruKey = key;
      }
    });

    return lruKey;
  }

  /**
   * PRIVATE: Schedule batch write operation
   */
  private scheduleBatchWrite(): void {
    if (this.writeTimer) {
      return; // Already scheduled
    }

    this.writeTimer = setTimeout(() => {
      this.executeBatchWrite();
    }, this.WRITE_DEBOUNCE_MS);
  }

  /**
   * PRIVATE: Execute pending writes in batch
   */
  private async executeBatchWrite(): Promise<void> {
    this.writeTimer = null;

    if (this.pendingWrites.size === 0) {
      return;
    }

    try {
      const pairs: [string, string][] = [];
      this.pendingWrites.forEach((value, key) => {
        pairs.push([key, JSON.stringify(value)]);
      });

      await AsyncStorage.multiSet(pairs);
      this.pendingWrites.clear();
    } catch (error) {
      console.error('StorageCache: Batch write error:', error);
    }
  }
}

// Export singleton instance
export const storageCache = new StorageCache(100);

// Export class for testing
export { StorageCache };
