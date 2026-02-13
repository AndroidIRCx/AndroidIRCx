/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/mock/cache',
  exists: jest.fn(),
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readDir: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/services/MediaEncryptionService', () => ({
  mediaEncryptionService: {
    decryptMediaFile: jest.fn(),
  },
}));

jest.mock('../../src/services/MediaCacheService', () => ({
  mediaCacheService: {
    getCachedMedia: jest.fn(),
    cacheMedia: jest.fn(),
    isCached: jest.fn(),
  },
}));

import RNFS from 'react-native-fs';
import { mediaDownloadService } from '../../src/services/MediaDownloadService';
import { mediaEncryptionService } from '../../src/services/MediaEncryptionService';
import { mediaCacheService } from '../../src/services/MediaCacheService';

const mockRNFS = RNFS as unknown as {
  exists: jest.Mock;
  mkdir: jest.Mock;
  writeFile: jest.Mock;
  unlink: jest.Mock;
  readDir: jest.Mock;
};

const mockEncryption = mediaEncryptionService as unknown as {
  decryptMediaFile: jest.Mock;
};

const mockCache = mediaCacheService as unknown as {
  getCachedMedia: jest.Mock;
  cacheMedia: jest.Mock;
  isCached: jest.Mock;
};

describe('MediaDownloadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mediaDownloadService as any).downloadCache = new Map();
    mockRNFS.exists.mockResolvedValue(true);
    mockCache.getCachedMedia.mockResolvedValue(null);
    mockCache.cacheMedia.mockResolvedValue({ success: true, cachedPath: '/mock/cache/final.jpg' });
    mockCache.isCached.mockResolvedValue(false);
    mockEncryption.decryptMediaFile.mockResolvedValue({
      success: true,
      decryptedUri: '/mock/cache/decrypted.jpg',
      mimeType: 'image/jpeg',
    });

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue({ size: 3 }),
    });

    (global as any).FileReader = class {
      public result: string | null = null;
      public onloadend: null | (() => void) = null;
      public onerror: null | (() => void) = null;
      readAsDataURL() {
        this.result = 'data:application/octet-stream;base64,QUJD';
        this.onloadend?.();
      }
    };
  });

  it('returns cached file when media is already cached', async () => {
    mockCache.getCachedMedia.mockResolvedValue('/mock/cache/cached.png');

    const result = await mediaDownloadService.downloadMedia(
      'media-1',
      'net',
      'channel::net::#test'
    );

    expect(result).toEqual({ success: true, uri: '/mock/cache/cached.png' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns error when tabId is missing', async () => {
    const result = await mediaDownloadService.downloadMedia('media-1', 'net', '');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No tabId provided');
  });

  it('downloads, decrypts, caches and reports progress', async () => {
    const onProgress = jest.fn();

    const result = await mediaDownloadService.downloadMedia(
      'media-2',
      'net',
      'channel::net::#test',
      onProgress
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.androidircx.com/api/media/download/media-2'
    );
    expect(mockRNFS.writeFile).toHaveBeenCalled();
    expect(mockEncryption.decryptMediaFile).toHaveBeenCalledWith(
      '/mock/cache/temp_media/encrypted_media-2',
      'net',
      'channel::net::#test',
      'media-2'
    );
    expect(mockCache.cacheMedia).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith({
      bytesWritten: 3,
      contentLength: 3,
      percentage: 100,
    });
    expect(result).toEqual({
      success: true,
      uri: '/mock/cache/final.jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('handles fetch failure and cleans up temp file', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 });
    mockRNFS.exists.mockResolvedValue(true);

    const result = await mediaDownloadService.downloadMedia(
      'media-3',
      'net',
      'channel::net::#test'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP 404');
    expect(mockRNFS.unlink).toHaveBeenCalledWith('/mock/cache/temp_media/encrypted_media-3');
  });

  it('retries and succeeds on later attempt', async () => {
    const spy = jest
      .spyOn(mediaDownloadService, 'downloadMedia')
      .mockResolvedValueOnce({ success: false, error: 'first-fail' })
      .mockResolvedValueOnce({ success: true, uri: '/ok' });

    const result = await mediaDownloadService.downloadMediaWithRetry(
      'media-4',
      'net',
      'channel::net::#test',
      3
    );

    expect(result).toEqual({ success: true, uri: '/ok' });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('returns immediate retry error when tabId is missing', async () => {
    const result = await mediaDownloadService.downloadMediaWithRetry('media-5', 'net', '', 3);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No tabId provided');
  });

  it('cleans up temp files in temp directory', async () => {
    mockRNFS.exists.mockResolvedValue(true);
    mockRNFS.readDir.mockResolvedValue([
      { path: '/mock/cache/temp_media/a.bin' },
      { path: '/mock/cache/temp_media/b.bin' },
    ]);

    await mediaDownloadService.cleanupTempFiles();

    expect(mockRNFS.unlink).toHaveBeenCalledWith('/mock/cache/temp_media/a.bin');
    expect(mockRNFS.unlink).toHaveBeenCalledWith('/mock/cache/temp_media/b.bin');
  });

  it('builds correct download URL', () => {
    expect(mediaDownloadService.getDownloadUrl('media-xyz')).toBe(
      'https://www.androidircx.com/api/media/download/media-xyz'
    );
  });
});
