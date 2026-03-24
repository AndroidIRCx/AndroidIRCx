/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * MediaCacheService - Cache downloaded media locally
 *
 * Features:
 * - Store downloaded/decrypted media in cache directory
 * - LRU (Least Recently Used) cache strategy
 * - Automatic cleanup when cache limit reached
 * - Cache size tracking and reporting
 *
 * Storage location: RNFS.CachesDirectoryPath/media/
 */

import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_DIR = `${RNFS.CachesDirectoryPath}/media`;
const CACHE_METADATA_KEY = '@MediaCache:metadata';
const DEFAULT_MAX_CACHE_SIZE = 250 * 1024 * 1024; // 250MB

interface CacheEntry {
  mediaId: string;
  fileName: string;
  filePath: string;
  size: number;
  mimeType?: string;
  cachedAt: number;      // Timestamp
  lastAccessedAt: number; // For LRU
}

interface CacheMetadata {
  entries: CacheEntry[];
  totalSize: number;
}

/**
 * MediaCacheService - Manage local media cache
 */
class MediaCacheService {
  private maxCacheSize: number = DEFAULT_MAX_CACHE_SIZE;
  private metadata: CacheMetadata = { entries: [], totalSize: 0 };
  private initialized: boolean = false;

  /**
   * Initialize cache (create directory, load metadata)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create cache directory if it doesn't exist
      const dirExists = await RNFS.exists(CACHE_DIR);
      if (!dirExists) {
        await RNFS.mkdir(CACHE_DIR);
        console.log('[MediaCacheService] Cache directory created');
      }

      // Load metadata from storage
      const storedMetadata = await AsyncStorage.getItem(CACHE_METADATA_KEY);
      if (storedMetadata) {
        this.metadata = JSON.parse(storedMetadata);
        console.log('[MediaCacheService] Loaded metadata:', {
          entries: this.metadata.entries.length,
          totalSize: this.metadata.totalSize,
        });
      }

      // Verify cached files still exist, remove stale entries
      await this.verifyCache();

      this.initialized = true;
      console.log('[MediaCacheService] Initialized');
    } catch (error) {
      console.error('[MediaCacheService] Initialization error:', error);
    }
  }

  /**
   * Cache a media file
   * @param mediaId - UUID of media
   * @param sourceUri - URI of file to cache
   * @param mimeType - MIME type of media
   */
  async cacheMedia(
    mediaId: string,
    sourceUri: string,
    mimeType?: string
  ): Promise<{ success: boolean; cachedPath?: string; error?: string }> {
    try {
      await this.initialize();

      // Check if already cached
      const existing = this.metadata.entries.find(e => e.mediaId === mediaId);
      if (existing) {
        // Update last accessed time
        existing.lastAccessedAt = Date.now();
        await this.saveMetadata();
        return { success: true, cachedPath: existing.filePath };
      }

      // Get source file info
      const sourceInfo = await RNFS.stat(sourceUri);
      if (!sourceInfo.isFile()) {
        return { success: false, error: 'Source is not a file' };
      }

      // Check if we need to free up space
      await this.ensureSpace(sourceInfo.size);

      // Determine file extension from MIME type
      const extension = this.getExtensionFromMimeType(mimeType);
      const fileName = `${mediaId}${extension}`;
      const targetPath = `${CACHE_DIR}/${fileName}`;

      // Copy file to cache
      await RNFS.copyFile(sourceUri, targetPath);

      // Add to metadata
      const entry: CacheEntry = {
        mediaId,
        fileName,
        filePath: targetPath,
        size: sourceInfo.size,
        mimeType,
        cachedAt: Date.now(),
        lastAccessedAt: Date.now(),
      };

      this.metadata.entries.push(entry);
      this.metadata.totalSize += sourceInfo.size;

      await this.saveMetadata();

      console.log('[MediaCacheService] Media cached:', {
        mediaId,
        size: sourceInfo.size,
        totalSize: this.metadata.totalSize,
      });

      return { success: true, cachedPath: targetPath };
    } catch (error: any) {
      console.error('[MediaCacheService] Cache error:', error);
      return {
        success: false,
        error: error.message || 'Failed to cache media',
      };
    }
  }

  /**
   * Get cached media file path
   * @param mediaId - UUID of media
   * @returns File path if cached, null otherwise
   */
  async getCachedMedia(mediaId: string): Promise<string | null> {
    try {
      await this.initialize();

      const entry = this.metadata.entries.find(e => e.mediaId === mediaId);
      if (!entry) {
        return null;
      }

      // Verify file still exists
      const exists = await RNFS.exists(entry.filePath);
      if (!exists) {
        // Remove stale entry
        await this.removeCacheEntry(mediaId);
        return null;
      }

      // Update last accessed time (LRU)
      entry.lastAccessedAt = Date.now();
      await this.saveMetadata();

      return entry.filePath;
    } catch (error) {
      console.error('[MediaCacheService] Get cached media error:', error);
      return null;
    }
  }

  /**
   * Check if media is cached
   */
  async isCached(mediaId: string): Promise<boolean> {
    const path = await this.getCachedMedia(mediaId);
    return path !== null;
  }

  /**
   * Remove specific media from cache
   */
  async removeCacheEntry(mediaId: string): Promise<void> {
    try {
      await this.initialize();

      const entry = this.metadata.entries.find(e => e.mediaId === mediaId);
      if (!entry) {
        return;
      }

      // Delete file
      const exists = await RNFS.exists(entry.filePath);
      if (exists) {
        await RNFS.unlink(entry.filePath);
      }

      // Remove from metadata
      this.metadata.entries = this.metadata.entries.filter(e => e.mediaId !== mediaId);
      this.metadata.totalSize -= entry.size;

      await this.saveMetadata();

      console.log('[MediaCacheService] Cache entry removed:', mediaId);
    } catch (error) {
      console.error('[MediaCacheService] Remove cache entry error:', error);
    }
  }

  /**
   * Clear entire cache
   * @param maxAgeMs - Optional: Only clear entries older than this (milliseconds)
   */
  async clearCache(maxAgeMs?: number): Promise<{ clearedCount: number; freedSpace: number }> {
    try {
      await this.initialize();

      const now = Date.now();
      let clearedCount = 0;
      let freedSpace = 0;

      // Determine which entries to remove
      const entriesToKeep: CacheEntry[] = [];
      const entriesToRemove: CacheEntry[] = [];

      for (const entry of this.metadata.entries) {
        if (maxAgeMs) {
          // Remove if older than maxAge
          if (now - entry.cachedAt > maxAgeMs) {
            entriesToRemove.push(entry);
          } else {
            entriesToKeep.push(entry);
          }
        } else {
          // Remove all
          entriesToRemove.push(entry);
        }
      }

      // Delete files
      for (const entry of entriesToRemove) {
        try {
          const exists = await RNFS.exists(entry.filePath);
          if (exists) {
            await RNFS.unlink(entry.filePath);
          }
          clearedCount++;
          freedSpace += entry.size;
        } catch {
          console.error('[MediaCacheService] Failed to delete file:', entry.filePath);
        }
      }

      // Update metadata
      this.metadata.entries = entriesToKeep;
      this.metadata.totalSize -= freedSpace;

      await this.saveMetadata();

      console.log('[MediaCacheService] Cache cleared:', {
        clearedCount,
        freedSpace,
        remaining: this.metadata.entries.length,
      });

      return { clearedCount, freedSpace };
    } catch (error) {
      console.error('[MediaCacheService] Clear cache error:', error);
      return { clearedCount: 0, freedSpace: 0 };
    }
  }

  /**
   * Get current cache size in bytes
   */
  async getCacheSize(): Promise<number> {
    await this.initialize();
    return this.metadata.totalSize;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    entryCount: number;
    totalSize: number;
    maxSize: number;
    usagePercentage: number;
  }> {
    await this.initialize();

    return {
      entryCount: this.metadata.entries.length,
      totalSize: this.metadata.totalSize,
      maxSize: this.maxCacheSize,
      usagePercentage: (this.metadata.totalSize / this.maxCacheSize) * 100,
    };
  }

  /**
   * Set maximum cache size
   */
  setMaxCacheSize(sizeInBytes: number): void {
    this.maxCacheSize = sizeInBytes;
    console.log('[MediaCacheService] Max cache size updated:', sizeInBytes);
  }

  /**
   * Ensure enough space is available in cache (LRU eviction)
   */
  private async ensureSpace(requiredBytes: number): Promise<void> {
    // Check if we have enough space
    const availableSpace = this.maxCacheSize - this.metadata.totalSize;
    if (availableSpace >= requiredBytes) {
      return;
    }

    console.log('[MediaCacheService] Freeing space:', {
      required: requiredBytes,
      available: availableSpace,
    });

    // Sort entries by last accessed time (LRU - oldest first)
    const sorted = [...this.metadata.entries].sort(
      (a, b) => a.lastAccessedAt - b.lastAccessedAt
    );

    // Remove oldest entries until we have enough space
    let freedSpace = 0;
    for (const entry of sorted) {
      if (availableSpace + freedSpace >= requiredBytes) {
        break;
      }

      await this.removeCacheEntry(entry.mediaId);
      freedSpace += entry.size;
    }

    console.log('[MediaCacheService] Freed space:', freedSpace);
  }

  /**
   * Verify cached files still exist, remove stale entries
   */
  private async verifyCache(): Promise<void> {
    const validEntries: CacheEntry[] = [];
    let removedSize = 0;

    for (const entry of this.metadata.entries) {
      const exists = await RNFS.exists(entry.filePath);
      if (exists) {
        validEntries.push(entry);
      } else {
        console.log('[MediaCacheService] Stale entry removed:', entry.mediaId);
        removedSize += entry.size;
      }
    }

    if (validEntries.length !== this.metadata.entries.length) {
      this.metadata.entries = validEntries;
      this.metadata.totalSize -= removedSize;
      await this.saveMetadata();
    }
  }

  /**
   * Save metadata to AsyncStorage
   */
  private async saveMetadata(): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(this.metadata));
    } catch (error) {
      console.error('[MediaCacheService] Save metadata error:', error);
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType?: string): string {
    if (!mimeType) return '.bin';

    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
    };

    return mimeMap[mimeType.toLowerCase()] || '.bin';
  }
}

// Export singleton instance
export const mediaCacheService = new MediaCacheService();
