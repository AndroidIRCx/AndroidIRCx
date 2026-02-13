/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  NativeModules: {
    HttpPost: {
      postRequest: jest.fn(),
    },
    HttpPut: {
      putFile: jest.fn(),
    },
  },
}));

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/mock/cache',
  stat: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

import RNFS from 'react-native-fs';
import { NativeModules } from 'react-native';
import { mediaUploadService } from '../../src/services/MediaUploadService';

const mockRNFS = RNFS as unknown as {
  stat: jest.Mock;
  readFile: jest.Mock;
  writeFile: jest.Mock;
  unlink: jest.Mock;
};

const mockHttpPost = NativeModules.HttpPost as { postRequest: jest.Mock };
const mockHttpPut = NativeModules.HttpPut as { putFile: jest.Mock };

describe('MediaUploadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mediaUploadService as any).activeUploads = new Map();
    (mediaUploadService as any).retryCount = 1;
    mockRNFS.stat.mockResolvedValue({
      size: 1000,
      isFile: () => true,
    });
    mockRNFS.readFile.mockResolvedValue('QUJD');
    mockHttpPost.postRequest.mockResolvedValue(
      JSON.stringify({
        id: 'media-1',
        status: 'pending',
        upload_token: 'token-123',
        expires: Math.floor(Date.now() / 1000) + 300,
      })
    );
    mockHttpPut.putFile.mockResolvedValue(
      JSON.stringify({ size: 1000, sha256: 'abc123', status: 'ready' })
    );
  });

  it('requests upload token successfully', async () => {
    const token = await mediaUploadService.requestUploadToken('image', 'image/png');

    expect(token.id).toBe('media-1');
    expect(token.status).toBe('pending');
    expect(mockHttpPost.postRequest).toHaveBeenCalled();
  });

  it('rejects html response when requesting token', async () => {
    mockHttpPost.postRequest.mockResolvedValueOnce('<html>error</html>');

    await expect(mediaUploadService.requestUploadToken('file')).rejects.toThrow(
      'Received HTML response instead of JSON'
    );
  });

  it('fails validateFile when target is not a file', async () => {
    mockRNFS.stat.mockResolvedValueOnce({ size: 100, isFile: () => false });

    const result = await mediaUploadService.validateFile('/mock/a');
    expect(result).toEqual({ valid: false, error: 'Not a file' });
  });

  it('fails validateFile for empty file', async () => {
    mockRNFS.stat.mockResolvedValueOnce({ size: 0, isFile: () => true });

    const result = await mediaUploadService.validateFile('/mock/a');
    expect(result).toEqual({ valid: false, error: 'File is empty' });
  });

  it('returns file too large from uploadMedia', async () => {
    mockRNFS.stat.mockResolvedValueOnce({
      size: 60 * 1024 * 1024,
      isFile: () => true,
    });

    const result = await mediaUploadService.uploadMedia('/mock/large.bin', 'file');

    expect(result.success).toBe(false);
    expect(result.error).toContain('File too large');
  });

  it('returns invalid upload status when token status is not pending', async () => {
    jest
      .spyOn(mediaUploadService, 'requestUploadToken')
      .mockResolvedValueOnce({
        id: 'media-2',
        status: 'ready',
        upload_token: 'tok',
        expires: Math.floor(Date.now() / 1000) + 60,
      });

    const result = await mediaUploadService.uploadMedia('/mock/file', 'image');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid upload status: ready');
  });

  it('returns upload result with irc tag when upload succeeds', async () => {
    jest.spyOn(mediaUploadService, 'requestUploadToken').mockResolvedValueOnce({
      id: 'media-42',
      status: 'pending',
      upload_token: 'tok',
      expires: Math.floor(Date.now() / 1000) + 60,
    });
    jest.spyOn(mediaUploadService, 'uploadFile').mockResolvedValueOnce({
      size: 987,
      sha256: 'hash42',
      status: 'ready',
    });

    const result = await mediaUploadService.uploadMedia('/mock/file', 'image', 'image/jpeg');

    expect(result).toEqual({
      success: true,
      mediaId: 'media-42',
      size: 987,
      sha256: 'hash42',
      status: 'ready',
      ircTag: '!enc-media [media-42]',
    });
  });

  it('does not retry permanent errors', async () => {
    jest
      .spyOn(mediaUploadService, 'requestUploadToken')
      .mockRejectedValueOnce(new Error('Upload token expired'));

    const result = await mediaUploadService.uploadMedia('/mock/file', 'image');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Upload token expired');
  });

  it('tracks active uploads map helpers', () => {
    (mediaUploadService as any).activeUploads.set('m1', true);

    expect(mediaUploadService.isUploading('m1')).toBe(true);
    expect(mediaUploadService.getActiveUploadsCount()).toBe(1);

    mediaUploadService.cancelUpload('m1');
    expect(mediaUploadService.isUploading('m1')).toBe(false);
  });

  it('fails uploadFile if token is expired', async () => {
    await expect(
      mediaUploadService.uploadFile(
        '/mock/file',
        'media-expired',
        'token',
        Math.floor(Date.now() / 1000) - 1
      )
    ).rejects.toThrow('Upload token expired');
  });

  it('uploads file directly and emits progress callback', async () => {
    const onProgress = jest.fn();

    const result = await mediaUploadService.uploadFile(
      '/mock/file',
      'media-live',
      'token-live',
      Math.floor(Date.now() / 1000) + 300,
      onProgress
    );

    expect(mockRNFS.readFile).toHaveBeenCalledWith('/mock/file', 'utf8');
    expect(mockRNFS.writeFile).toHaveBeenCalled();
    expect(mockHttpPut.putFile).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ bytesUploaded: 0, percentage: 0 })
    );
    expect(result).toEqual({ size: 1000, sha256: 'abc123', status: 'ready' });
  });

  it('validateFile returns too-large error', async () => {
    mockRNFS.stat.mockResolvedValueOnce({
      size: 51 * 1024 * 1024,
      isFile: () => true,
    });
    const result = await mediaUploadService.validateFile('/mock/too-big');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('File too large');
  });

  it('validateFile handles missing file access errors', async () => {
    mockRNFS.stat.mockRejectedValueOnce(new Error('missing'));
    const result = await mediaUploadService.validateFile('/mock/missing');
    expect(result).toEqual({
      valid: false,
      error: 'File does not exist or cannot be accessed',
    });
  });

  it('returns final retry error when attempts exhausted', async () => {
    (mediaUploadService as any).retryCount = 2;
    jest.spyOn(mediaUploadService, 'requestUploadToken').mockRejectedValue(new Error('network down'));

    const result = await mediaUploadService.uploadMedia('/mock/file', 'image');
    expect(result.success).toBe(false);
    expect(result.error).toContain('network down');
  });
});
