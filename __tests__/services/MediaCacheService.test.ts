/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const storage: Record<string, string | null> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((k: string) => Promise.resolve(storage[k] ?? null)),
  setItem: jest.fn((k: string, v: string) => {
    storage[k] = v;
    return Promise.resolve();
  }),
}));

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/mock/cache',
  exists: jest.fn(),
  mkdir: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn(),
  copyFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readDir: jest.fn().mockResolvedValue([]),
}));

import RNFS from 'react-native-fs';
import { mediaCacheService } from '../../src/services/MediaCacheService';

const mockRNFS = RNFS as unknown as {
  exists: jest.Mock;
  mkdir: jest.Mock;
  stat: jest.Mock;
  copyFile: jest.Mock;
  unlink: jest.Mock;
  readDir: jest.Mock;
};

describe('MediaCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(storage).forEach((k) => delete storage[k]);
    (mediaCacheService as any).initialized = false;
    (mediaCacheService as any).metadata = { entries: [], totalSize: 0 };
    (mediaCacheService as any).maxCacheSize = 250 * 1024 * 1024;
    mockRNFS.exists.mockResolvedValue(true);
    mockRNFS.stat.mockResolvedValue({
      size: 100,
      isFile: () => true,
    });
  });

  it('initializes and creates cache dir when missing', async () => {
    mockRNFS.exists.mockResolvedValueOnce(false).mockResolvedValue(true);
    await mediaCacheService.initialize();
    expect(mockRNFS.mkdir).toHaveBeenCalledWith('/mock/cache/media');
  });

  it('caches media file successfully', async () => {
    const result = await mediaCacheService.cacheMedia('mid-1', '/tmp/a.jpg', 'image/jpeg');

    expect(result.success).toBe(true);
    expect(result.cachedPath).toContain('/mock/cache/media/mid-1.jpg');
    expect(mockRNFS.copyFile).toHaveBeenCalled();
  });

  it('returns error when source is not a file', async () => {
    mockRNFS.stat.mockResolvedValueOnce({
      size: 100,
      isFile: () => false,
    });
    const result = await mediaCacheService.cacheMedia('bad-1', '/tmp/dir', 'image/jpeg');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Source is not a file');
  });

  it('returns existing cached path when same media is cached again', async () => {
    await mediaCacheService.cacheMedia('mid-2', '/tmp/a.jpg', 'image/jpeg');
    const second = await mediaCacheService.cacheMedia('mid-2', '/tmp/b.jpg', 'image/png');

    expect(second.success).toBe(true);
    expect(second.cachedPath).toContain('mid-2.jpg');
    expect(mockRNFS.copyFile).toHaveBeenCalledTimes(1);
  });

  it('returns null for missing cached media', async () => {
    const path = await mediaCacheService.getCachedMedia('missing');
    expect(path).toBeNull();
  });

  it('removes stale cached entry when file no longer exists', async () => {
    await mediaCacheService.cacheMedia('mid-stale', '/tmp/a.jpg', 'image/jpeg');
    mockRNFS.exists.mockImplementation(async (p: string) => !String(p).includes('mid-stale'));

    const path = await mediaCacheService.getCachedMedia('mid-stale');
    expect(path).toBeNull();
  });

  it('removes specific cache entry', async () => {
    await mediaCacheService.cacheMedia('mid-3', '/tmp/a.jpg', 'image/jpeg');
    await mediaCacheService.removeCacheEntry('mid-3');

    const path = await mediaCacheService.getCachedMedia('mid-3');
    expect(path).toBeNull();
  });

  it('clears all cache entries', async () => {
    await mediaCacheService.cacheMedia('mid-4', '/tmp/a.jpg', 'image/jpeg');
    await mediaCacheService.cacheMedia('mid-5', '/tmp/b.jpg', 'image/jpeg');

    const result = await mediaCacheService.clearCache();
    expect(result.clearedCount).toBeGreaterThanOrEqual(1);
  });

  it('clears only older entries when maxAgeMs is provided', async () => {
    await mediaCacheService.cacheMedia('old-a', '/tmp/a.jpg', 'image/jpeg');
    await mediaCacheService.cacheMedia('old-b', '/tmp/b.jpg', 'image/jpeg');
    (mediaCacheService as any).metadata.entries[0].cachedAt = Date.now() - 10_000;
    (mediaCacheService as any).metadata.entries[1].cachedAt = Date.now();

    const result = await mediaCacheService.clearCache(1000);
    expect(result.clearedCount).toBe(1);
  });

  it('reports cache stats', async () => {
    await mediaCacheService.cacheMedia('mid-6', '/tmp/a.jpg', 'image/jpeg');
    const stats = await mediaCacheService.getCacheStats();

    expect(stats.entryCount).toBe(1);
    expect(stats.totalSize).toBeGreaterThan(0);
    expect(stats.maxSize).toBe(250 * 1024 * 1024);
  });

  it('supports setMaxCacheSize', () => {
    mediaCacheService.setMaxCacheSize(1024);
    expect((mediaCacheService as any).maxCacheSize).toBe(1024);
  });

  it('evicts older entries when required space exceeds max', async () => {
    mediaCacheService.setMaxCacheSize(150);
    mockRNFS.stat.mockResolvedValue({ size: 100, isFile: () => true });

    await mediaCacheService.cacheMedia('old-1', '/tmp/1.jpg', 'image/jpeg');
    await mediaCacheService.cacheMedia('old-2', '/tmp/2.jpg', 'image/jpeg');

    const stats = await mediaCacheService.getCacheStats();
    expect(stats.entryCount).toBeLessThanOrEqual(2);
    expect(stats.totalSize).toBeLessThanOrEqual(200);
  });

  it('recognizes isCached helper', async () => {
    await mediaCacheService.cacheMedia('mid-7', '/tmp/a.jpg', 'image/jpeg');
    expect(await mediaCacheService.isCached('mid-7')).toBe(true);
    expect(await mediaCacheService.isCached('mid-none')).toBe(false);
  });
});
