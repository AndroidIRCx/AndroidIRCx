/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/mock/cache',
  exists: jest.fn(),
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  downloadFile: jest.fn(),
  stopDownload: jest.fn(),
  stat: jest.fn(),
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

jest.mock('../../src/services/PlayIntegrityRequestSecurity', () => ({
  createPlayIntegrityRequestSecurity: jest.fn().mockResolvedValue({}),
  withPlayIntegrityHeaders: jest.fn(),
}));

import RNFS from 'react-native-fs';
import { mediaDownloadService } from '../../src/services/MediaDownloadService';
import { mediaEncryptionService } from '../../src/services/MediaEncryptionService';
import { mediaCacheService } from '../../src/services/MediaCacheService';
import { withPlayIntegrityHeaders } from '../../src/services/PlayIntegrityRequestSecurity';

const mockWithPlayIntegrityHeaders =
  withPlayIntegrityHeaders as unknown as jest.Mock;

const mockRNFS = RNFS as unknown as {
  exists: jest.Mock;
  mkdir: jest.Mock;
  writeFile: jest.Mock;
  downloadFile: jest.Mock;
  stopDownload: jest.Mock;
  stat: jest.Mock;
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
    mockCache.cacheMedia.mockResolvedValue({
      success: true,
      cachedPath: '/mock/cache/final.jpg',
    });
    mockCache.isCached.mockResolvedValue(false);
    mockEncryption.decryptMediaFile.mockResolvedValue({
      success: true,
      decryptedUri: '/mock/cache/decrypted.jpg',
      mimeType: 'image/jpeg',
    });

    mockWithPlayIntegrityHeaders.mockReturnValue({});

    (global as any).fetch = jest.fn();
    mockRNFS.downloadFile.mockImplementation(options => {
      options.begin?.({ statusCode: 200, contentLength: 3 });
      options.progress?.({ bytesWritten: 3, contentLength: 3 });
      return {
        jobId: 123,
        promise: Promise.resolve({ statusCode: 200, bytesWritten: 3 }),
      };
    });
    mockRNFS.stat.mockResolvedValue({ size: 3 });
  });

  it('returns cached file when media is already cached', async () => {
    mockCache.getCachedMedia.mockResolvedValue('/mock/cache/cached.png');

    const result = await mediaDownloadService.downloadMedia(
      'media-1',
      'net',
      'channel::net::#test',
    );

    expect(result).toEqual({ success: true, uri: '/mock/cache/cached.png' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns error when tabId is missing', async () => {
    const result = await mediaDownloadService.downloadMedia(
      'media-1',
      'net',
      '',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No tabId provided');
  });

  it('downloads, decrypts, caches and reports progress', async () => {
    const onProgress = jest.fn();

    const result = await mediaDownloadService.downloadMedia(
      'media-2',
      'net',
      'channel::net::#test',
      onProgress,
    );

    expect(mockRNFS.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUrl: 'https://www.androidircx.com/api/media/download/media-2',
        toFile: '/mock/cache/temp_media/encrypted_media-2',
      }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockRNFS.writeFile).not.toHaveBeenCalled();
    expect(mockEncryption.decryptMediaFile).toHaveBeenCalledWith(
      '/mock/cache/temp_media/encrypted_media-2',
      'net',
      'channel::net::#test',
      'media-2',
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
    mockRNFS.downloadFile.mockReturnValueOnce({
      jobId: 124,
      promise: Promise.resolve({ statusCode: 404, bytesWritten: 0 }),
    });
    mockRNFS.exists.mockResolvedValue(true);

    const result = await mediaDownloadService.downloadMedia(
      'media-3',
      'net',
      'channel::net::#test',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP 404');
    expect(mockRNFS.unlink).toHaveBeenCalledWith(
      '/mock/cache/temp_media/encrypted_media-3',
    );
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
      3,
    );

    expect(result).toEqual({ success: true, uri: '/ok' });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('returns immediate retry error when tabId is missing', async () => {
    const result = await mediaDownloadService.downloadMediaWithRetry(
      'media-5',
      'net',
      '',
      3,
    );

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

    expect(mockRNFS.unlink).toHaveBeenCalledWith(
      '/mock/cache/temp_media/a.bin',
    );
    expect(mockRNFS.unlink).toHaveBeenCalledWith(
      '/mock/cache/temp_media/b.bin',
    );
  });

  it('builds correct download URL', () => {
    expect(mediaDownloadService.getDownloadUrl('media-xyz')).toBe(
      'https://www.androidircx.com/api/media/download/media-xyz',
    );
  });

  describe('initialize', () => {
    it('creates temp directory when it does not exist', async () => {
      mockRNFS.exists.mockResolvedValue(false);

      await mediaDownloadService.initialize();

      expect(mockRNFS.mkdir).toHaveBeenCalledWith('/mock/cache/temp_media');
    });

    it('does not create temp directory when it already exists', async () => {
      mockRNFS.exists.mockResolvedValue(true);

      await mediaDownloadService.initialize();

      expect(mockRNFS.mkdir).not.toHaveBeenCalled();
    });

    it('swallows initialize errors', async () => {
      mockRNFS.exists.mockRejectedValue(new Error('fs boom'));

      await expect(mediaDownloadService.initialize()).resolves.toBeUndefined();
    });
  });

  describe('parseContentLength branches', () => {
    it('handles string, non-numeric and undefined content lengths in begin/progress', async () => {
      const onProgress = jest.fn();
      mockRNFS.downloadFile.mockImplementation(options => {
        // begin with undefined content length -> parseContentLength returns null
        options.begin?.({ statusCode: 200, contentLength: undefined });
        // progress with string numeric content length -> Number() branch
        options.progress?.({ bytesWritten: 5, contentLength: '10' });
        // progress with non-numeric string -> Number.isFinite false -> null
        options.progress?.({ bytesWritten: 5, contentLength: 'not-a-number' });
        // progress with negative string -> >= 0 branch false -> null
        options.progress?.({ bytesWritten: 5, contentLength: '-3' });
        return {
          jobId: 999,
          promise: Promise.resolve({ statusCode: 200, bytesWritten: 5 }),
        };
      });

      const result = await mediaDownloadService.downloadMedia(
        'media-cl',
        'net',
        'channel::net::#test',
        onProgress,
      );

      expect(result.success).toBe(true);
      // begin with unknown length reports 0
      expect(onProgress).toHaveBeenCalledWith({
        bytesWritten: 0,
        contentLength: 0,
        percentage: 0,
      });
      // string "10" parsed to 10 -> 50%
      expect(onProgress).toHaveBeenCalledWith({
        bytesWritten: 5,
        contentLength: 10,
        percentage: 50,
      });
      // non-numeric string -> contentLength 0, percentage 0
      expect(onProgress).toHaveBeenCalledWith({
        bytesWritten: 5,
        contentLength: 0,
        percentage: 0,
      });
    });
  });

  describe('size limit enforcement', () => {
    it('rejects when begin reports a content length that is too large', async () => {
      mockRNFS.downloadFile.mockImplementation(options => {
        // Invoke begin asynchronously so `download.jobId` is assigned,
        // mirroring how the native module fires callbacks.
        const promise = Promise.resolve().then(() => {
          options.begin?.({
            statusCode: 200,
            contentLength: 100 * 1024 * 1024,
          });
          return { statusCode: 200, bytesWritten: 0 };
        });
        return { jobId: 200, promise };
      });

      const result = await mediaDownloadService.downloadMedia(
        'media-big1',
        'net',
        'channel::net::#test',
      );

      expect(mockRNFS.stopDownload).toHaveBeenCalledWith(200);
      expect(result.success).toBe(false);
      expect(result.error).toContain('too large to download safely');
    });

    it('rejects when progress bytesWritten exceeds the max size', async () => {
      mockRNFS.downloadFile.mockImplementation(options => {
        const promise = Promise.resolve().then(() => {
          options.begin?.({ statusCode: 200, contentLength: 10 });
          options.progress?.({
            bytesWritten: 100 * 1024 * 1024,
            contentLength: 10,
          });
          return { statusCode: 200, bytesWritten: 0 };
        });
        return { jobId: 201, promise };
      });

      const result = await mediaDownloadService.downloadMedia(
        'media-big2',
        'net',
        'channel::net::#test',
      );

      expect(mockRNFS.stopDownload).toHaveBeenCalledWith(201);
      expect(result.success).toBe(false);
      expect(result.error).toContain('too large to download safely');
    });

    it('rejects when downloaded file on disk is too large to decrypt', async () => {
      mockRNFS.stat.mockResolvedValue({ size: 100 * 1024 * 1024 });

      const result = await mediaDownloadService.downloadMedia(
        'media-big3',
        'net',
        'channel::net::#test',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large to decrypt safely');
    });
  });

  it('passes Play Integrity headers to downloadFile when present', async () => {
    mockWithPlayIntegrityHeaders.mockReturnValue({ 'X-Integrity': 'token' });

    await mediaDownloadService.downloadMedia(
      'media-headers',
      'net',
      'channel::net::#test',
    );

    expect(mockRNFS.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Integrity': 'token' },
      }),
    );
  });

  it('omits headers when no Play Integrity headers are present', async () => {
    mockWithPlayIntegrityHeaders.mockReturnValue({});

    await mediaDownloadService.downloadMedia(
      'media-noheaders',
      'net',
      'channel::net::#test',
    );

    expect(mockRNFS.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: undefined,
      }),
    );
  });

  it('treats an unparseable downloaded file size as zero', async () => {
    mockRNFS.stat.mockResolvedValue({ size: undefined });

    const result = await mediaDownloadService.downloadMedia(
      'media-nostat',
      'net',
      'channel::net::#test',
    );

    expect(result.success).toBe(true);
  });

  it('skips unlink in the error path when temp file does not exist', async () => {
    mockEncryption.decryptMediaFile.mockResolvedValue({
      success: false,
      error: 'decrypt boom',
    });
    // exists() is used both by initialize and the error-path cleanup.
    mockRNFS.exists.mockResolvedValue(false);

    const result = await mediaDownloadService.downloadMedia(
      'media-noexist',
      'net',
      'channel::net::#test',
    );

    expect(result.success).toBe(false);
    expect(mockRNFS.unlink).not.toHaveBeenCalled();
  });

  it('uses default error message when thrown error has no message', async () => {
    mockEncryption.decryptMediaFile.mockRejectedValue({});

    const result = await mediaDownloadService.downloadMedia(
      'media-nomsg',
      'net',
      'channel::net::#test',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to download/decrypt media');
  });

  it('reuses an in-flight download for the same mediaId', async () => {
    const inflight = Promise.resolve({ success: true, uri: '/inflight' });
    (mediaDownloadService as any).downloadCache.set('media-inflight', inflight);

    const result = await mediaDownloadService.downloadMedia(
      'media-inflight',
      'net',
      'channel::net::#test',
    );

    expect(result).toEqual({ success: true, uri: '/inflight' });
    expect(mockRNFS.downloadFile).not.toHaveBeenCalled();
  });

  it('handles errors thrown before download starts (outer catch)', async () => {
    mockCache.getCachedMedia.mockRejectedValue(new Error('cache lookup boom'));

    const result = await mediaDownloadService.downloadMedia(
      'media-outer',
      'net',
      'channel::net::#test',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('cache lookup boom');
  });

  it('falls back to generic message when thrown error has no message', async () => {
    mockCache.getCachedMedia.mockRejectedValue({});

    const result = await mediaDownloadService.downloadMedia(
      'media-outer2',
      'net',
      'channel::net::#test',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to download media');
  });

  it('throws when tabId is missing inside _downloadAndDecrypt', async () => {
    const result = await (mediaDownloadService as any)._downloadAndDecrypt(
      'media-notab',
      'net',
      '',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No tabId provided');
  });

  it('returns failure when decryption fails', async () => {
    mockEncryption.decryptMediaFile.mockResolvedValue({
      success: false,
      error: 'decrypt boom',
    });

    const result = await mediaDownloadService.downloadMedia(
      'media-dec',
      'net',
      'channel::net::#test',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('decrypt boom');
  });

  it('uses default decryption error message when none provided', async () => {
    mockEncryption.decryptMediaFile.mockResolvedValue({
      success: false,
    });

    const result = await mediaDownloadService.downloadMedia(
      'media-dec2',
      'net',
      'channel::net::#test',
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Decryption failed');
  });

  it('still succeeds when caching fails, returning decrypted uri', async () => {
    mockCache.cacheMedia.mockResolvedValue({
      success: false,
      error: 'cache write failed',
    });

    const result = await mediaDownloadService.downloadMedia(
      'media-nocache',
      'net',
      'channel::net::#test',
    );

    expect(result).toEqual({
      success: true,
      uri: '/mock/cache/decrypted.jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('ignores cleanup errors after a successful download', async () => {
    mockRNFS.unlink.mockRejectedValue(new Error('unlink boom'));

    const result = await mediaDownloadService.downloadMedia(
      'media-cleanup',
      'net',
      'channel::net::#test',
    );

    expect(result.success).toBe(true);
  });

  describe('downloadMediaWithRetry', () => {
    let setTimeoutSpy: jest.SpyInstance;

    beforeEach(() => {
      setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((cb: any) => {
          cb();
          return 0 as any;
        });
    });

    afterEach(() => {
      setTimeoutSpy.mockRestore();
    });

    it('returns last error after exhausting all retries', async () => {
      const spy = jest
        .spyOn(mediaDownloadService, 'downloadMedia')
        .mockResolvedValue({ success: false, error: 'always-fail' });

      const result = await mediaDownloadService.downloadMediaWithRetry(
        'media-retry',
        'net',
        'channel::net::#test',
        3,
      );

      expect(result).toEqual({ success: false, error: 'always-fail' });
      expect(spy).toHaveBeenCalledTimes(3);
      spy.mockRestore();
    });

    it('defaults to 3 retries when maxRetries is omitted', async () => {
      const spy = jest
        .spyOn(mediaDownloadService, 'downloadMedia')
        .mockResolvedValue({ success: false, error: 'nope' });

      const result = await mediaDownloadService.downloadMediaWithRetry(
        'media-default',
        'net',
        'channel::net::#test',
      );

      expect(result.success).toBe(false);
      expect(spy).toHaveBeenCalledTimes(3);
      spy.mockRestore();
    });

    it('returns generic failure when no error was captured', async () => {
      const spy = jest
        .spyOn(mediaDownloadService, 'downloadMedia')
        .mockResolvedValue({ success: false });

      const result = await mediaDownloadService.downloadMediaWithRetry(
        'media-retry2',
        'net',
        'channel::net::#test',
        1,
      );

      expect(result).toEqual({
        success: false,
        error: 'Download failed after retries',
      });
      spy.mockRestore();
    });
  });

  describe('isMediaAvailable', () => {
    it('returns true when cached', async () => {
      mockCache.isCached.mockResolvedValue(true);
      await expect(
        mediaDownloadService.isMediaAvailable('media-a'),
      ).resolves.toBe(true);
    });

    it('returns true when not cached (assumed downloadable)', async () => {
      mockCache.isCached.mockResolvedValue(false);
      await expect(
        mediaDownloadService.isMediaAvailable('media-b'),
      ).resolves.toBe(true);
    });

    it('returns false when the availability check throws', async () => {
      mockCache.isCached.mockRejectedValue(new Error('check boom'));
      await expect(
        mediaDownloadService.isMediaAvailable('media-c'),
      ).resolves.toBe(false);
    });
  });

  describe('cleanupTempFiles', () => {
    it('continues cleanup when one file fails to delete', async () => {
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.readDir.mockResolvedValue([
        { path: '/mock/cache/temp_media/a.bin' },
        { path: '/mock/cache/temp_media/b.bin' },
      ]);
      mockRNFS.unlink
        .mockRejectedValueOnce(new Error('locked'))
        .mockResolvedValueOnce(undefined);

      await mediaDownloadService.cleanupTempFiles();

      expect(mockRNFS.unlink).toHaveBeenCalledTimes(2);
    });

    it('does nothing when temp directory does not exist', async () => {
      mockRNFS.exists.mockResolvedValue(false);

      await mediaDownloadService.cleanupTempFiles();

      expect(mockRNFS.readDir).not.toHaveBeenCalled();
    });

    it('swallows errors from readDir', async () => {
      mockRNFS.exists.mockResolvedValue(true);
      mockRNFS.readDir.mockRejectedValue(new Error('readdir boom'));

      await expect(
        mediaDownloadService.cleanupTempFiles(),
      ).resolves.toBeUndefined();
    });
  });
});
