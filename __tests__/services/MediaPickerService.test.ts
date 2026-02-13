/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  PermissionsAndroid: {
    PERMISSIONS: {
      CAMERA: 'android.permission.CAMERA',
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
    check: jest.fn(),
  },
}));

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/mock/cache',
  copyFile: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
  downloadFile: jest.fn(() => ({ promise: Promise.resolve({ statusCode: 200 }) })),
  stat: jest.fn(),
}));

jest.mock('react-native-vision-camera', () => ({
  Camera: {
    requestCameraPermission: jest.fn(),
    requestMicrophonePermission: jest.fn(),
    getAvailableCameraDevices: jest.fn(),
  },
  useCameraDevice: jest.fn(),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  isCancel: jest.fn(),
  types: {
    images: 'image/*',
    video: 'video/*',
    allFiles: '*/*',
  },
}));

import RNFS from 'react-native-fs';
import { Camera } from 'react-native-vision-camera';
import { PermissionsAndroid } from 'react-native';
import { pick, isCancel } from '@react-native-documents/picker';
import { mediaPickerService } from '../../src/services/MediaPickerService';

const mockRNFS = RNFS as unknown as {
  copyFile: jest.Mock;
  readFile: jest.Mock;
  writeFile: jest.Mock;
  downloadFile: jest.Mock;
  stat: jest.Mock;
};

const mockCamera = Camera as unknown as {
  requestCameraPermission: jest.Mock;
  requestMicrophonePermission: jest.Mock;
  getAvailableCameraDevices: jest.Mock;
};

const mockPermissions = PermissionsAndroid as unknown as {
  check: jest.Mock;
};

const mockPick = pick as unknown as jest.Mock;
const mockIsCancel = isCancel as unknown as jest.Mock;

describe('MediaPickerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRNFS.stat.mockResolvedValue({
      size: 1234,
      isFile: () => true,
      name: 'file.jpg',
      mtime: new Date(),
    });
    mockRNFS.copyFile.mockResolvedValue(undefined);
    mockRNFS.readFile.mockResolvedValue('QUJD');
    mockPermissions.check.mockResolvedValue(true);
    mockCamera.requestCameraPermission.mockResolvedValue('granted');
    mockCamera.requestMicrophonePermission.mockResolvedValue('granted');
    mockCamera.getAvailableCameraDevices.mockResolvedValue([{ id: 'back' }]);
  });

  it('picks image and normalizes file uri', async () => {
    mockPick.mockResolvedValueOnce({
      uri: '/tmp/picture.jpg',
      name: 'picture.jpg',
      type: 'image/jpeg',
      size: 22,
    });

    const result = await mediaPickerService.pickImage();

    expect(result.success).toBe(true);
    expect(result.uri).toBe('file:///tmp/picture.jpg');
    expect(result.type).toBe('image');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('handles content uri fallback path via read/write', async () => {
    mockPick.mockResolvedValueOnce({
      uri: 'content://media/123',
      name: 'from-content.png',
      type: 'image/png',
      size: 55,
    });
    mockRNFS.copyFile.mockRejectedValueOnce(new Error('copy failed'));

    const result = await mediaPickerService.pickImage();

    expect(mockRNFS.copyFile).toHaveBeenCalled();
    expect(mockRNFS.readFile).toHaveBeenCalledWith('content://media/123', 'base64');
    expect(mockRNFS.writeFile).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.uri).toContain('file:///mock/cache/from-content.png');
  });

  it('returns cancelled for picker cancellation message', async () => {
    mockPick.mockRejectedValueOnce(new Error('User cancelled'));

    const result = await mediaPickerService.pickVideo();

    expect(result).toEqual({ success: false, error: 'User cancelled' });
  });

  it('returns permission-denied for capturePhoto when camera denied', async () => {
    mockPermissions.check.mockResolvedValueOnce(false);
    mockCamera.requestCameraPermission.mockResolvedValueOnce('denied');

    const result = await mediaPickerService.capturePhoto();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Camera permission denied');
  });

  it('returns not implemented message for recordVideo when permissions granted', async () => {
    const result = await mediaPickerService.recordVideo();

    expect(result.success).toBe(false);
    expect(result.error).toContain('not yet implemented');
  });

  it('returns permission-denied for recordVoice when mic denied', async () => {
    mockPermissions.check.mockResolvedValueOnce(false);
    mockCamera.requestMicrophonePermission.mockResolvedValueOnce('denied');

    const result = await mediaPickerService.recordVoice();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Microphone permission denied');
  });

  it('reports camera availability', async () => {
    expect(await mediaPickerService.isCameraAvailable()).toBe(true);
    mockCamera.getAvailableCameraDevices.mockResolvedValueOnce([]);
    expect(await mediaPickerService.isCameraAvailable()).toBe(false);
  });

  it('returns file info for file:// uri', async () => {
    const info = await mediaPickerService.getFileInfo('file:///tmp/file.bin');
    expect(info.isFile).toBe(true);
    expect(info.size).toBe(1234);
  });

  it('validates file size limits', async () => {
    jest.spyOn(mediaPickerService, 'getFileInfo').mockResolvedValueOnce({
      size: 80 * 1024 * 1024,
      isFile: true,
      name: 'big.mp4',
    });

    const result = await mediaPickerService.validateFile('/tmp/big.mp4');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('File too large');
  });

  it('returns invalid when not a file', async () => {
    jest.spyOn(mediaPickerService, 'getFileInfo').mockResolvedValueOnce({
      size: 100,
      isFile: false,
      name: 'x',
    });

    const result = await mediaPickerService.validateFile('/tmp/x');
    expect(result).toEqual({ valid: false, error: 'Not a file' });
  });

  it('returns error when no image file is selected', async () => {
    mockPick.mockResolvedValueOnce([]);
    const result = await mediaPickerService.pickImage();
    expect(result).toEqual({ success: false, error: 'No file selected' });
  });

  it('returns cancelled via isCancel branch on pickImage', async () => {
    mockPick.mockRejectedValueOnce({ code: 'DOCUMENT_PICKER_CANCELED' });
    mockIsCancel.mockReturnValueOnce(true);

    const result = await mediaPickerService.pickImage();

    expect(result).toEqual({ success: false, error: 'User cancelled' });
  });

  it('returns cancelled via cancel message branch on pickImage', async () => {
    mockPick.mockRejectedValueOnce(new Error('User cancelled picker flow'));
    mockIsCancel.mockReturnValueOnce(false);
    const result = await mediaPickerService.pickImage();
    expect(result).toEqual({ success: false, error: 'User cancelled' });
  });

  it('handles pickImage cancel-check failure safely', async () => {
    mockPick.mockRejectedValueOnce({ code: 'strange' });
    mockIsCancel.mockImplementationOnce(() => {
      throw new Error('isCancel crash');
    });

    const result = await mediaPickerService.pickImage();
    expect(result.success).toBe(false);
    expect(result.error).toBe('[object Object]');
  });

  it('uses picker size fallback when getFileInfo fails on pickImage', async () => {
    mockPick.mockResolvedValueOnce({
      uri: '/tmp/pic2.jpg',
      name: 'pic2.jpg',
      type: 'image/jpeg',
      size: 99,
    });
    jest.spyOn(mediaPickerService, 'getFileInfo').mockRejectedValueOnce(new Error('info fail'));

    const result = await mediaPickerService.pickImage();
    expect(result.success).toBe(true);
    expect(result.size).toBe(99);
  });

  it('returns error when content uri fallbacks fail on pickImage', async () => {
    mockPick.mockResolvedValueOnce({
      uri: 'content://media/fail',
      name: 'x.png',
      type: 'image/png',
      size: 5,
    });
    mockRNFS.copyFile.mockRejectedValueOnce(new Error('copy failed'));
    mockRNFS.readFile.mockRejectedValueOnce(new Error('read failed'));
    mockRNFS.downloadFile.mockReturnValueOnce({ promise: Promise.resolve({ statusCode: 500 }) });

    const result = await mediaPickerService.pickImage();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Download failed');
  });

  it('returns no file selected on pickVideo when picker returns null', async () => {
    mockPick.mockResolvedValueOnce(null);
    const result = await mediaPickerService.pickVideo();
    expect(result).toEqual({ success: false, error: 'No file selected' });
  });

  it('picks video and normalizes uri when stat fails fallback uses picker size', async () => {
    mockPick.mockResolvedValueOnce({
      uri: '/tmp/video.mp4',
      name: 'video.mp4',
      type: 'video/mp4',
      size: 777,
    });
    jest.spyOn(mediaPickerService, 'getFileInfo').mockRejectedValueOnce(new Error('stat failed'));

    const result = await mediaPickerService.pickVideo();

    expect(result.success).toBe(true);
    expect(result.uri).toBe('file:///tmp/video.mp4');
    expect(result.size).toBe(777);
    expect(result.type).toBe('video');
  });

  it('returns cancelled via isCancel branch on pickVideo', async () => {
    mockPick.mockRejectedValueOnce({ code: 'cancel' });
    mockIsCancel.mockReturnValueOnce(true);
    const result = await mediaPickerService.pickVideo();
    expect(result).toEqual({ success: false, error: 'User cancelled' });
  });

  it('handles pickVideo cancel-check failure safely', async () => {
    mockPick.mockRejectedValueOnce({ code: 'strange-video' });
    mockIsCancel.mockImplementationOnce(() => {
      throw new Error('video isCancel crash');
    });

    const result = await mediaPickerService.pickVideo();
    expect(result.success).toBe(false);
    expect(result.error).toBe('[object Object]');
  });

  it('returns no file selected on pickFile when picker returns empty array', async () => {
    mockPick.mockResolvedValueOnce([]);
    const result = await mediaPickerService.pickFile();
    expect(result).toEqual({ success: false, error: 'No file selected' });
  });

  it('picks generic file and detects gif media type from extension', async () => {
    mockPick.mockResolvedValueOnce({
      uri: '/tmp/anim.GIF',
      name: 'anim.GIF',
      type: 'application/octet-stream',
      size: 11,
    });

    const result = await mediaPickerService.pickFile();

    expect(result.success).toBe(true);
    expect(result.type).toBe('gif');
    expect(result.uri).toBe('file:///tmp/anim.GIF');
  });

  it('returns cancelled via isCancel branch on pickFile', async () => {
    mockPick.mockRejectedValueOnce({ any: 'value' });
    mockIsCancel.mockReturnValueOnce(true);

    const result = await mediaPickerService.pickFile();

    expect(result).toEqual({ success: false, error: 'User cancelled' });
  });

  it('returns cancelled via cancel message branch on pickFile', async () => {
    mockPick.mockRejectedValueOnce(new Error('cancel action'));
    mockIsCancel.mockReturnValueOnce(false);
    const result = await mediaPickerService.pickFile();
    expect(result).toEqual({ success: false, error: 'User cancelled' });
  });

  it('handles pickFile cancel-check failure safely', async () => {
    mockPick.mockRejectedValueOnce({ code: 'strange-file' });
    mockIsCancel.mockImplementationOnce(() => {
      throw new Error('file isCancel crash');
    });

    const result = await mediaPickerService.pickFile();
    expect(result.success).toBe(false);
    expect(result.error).toBe('[object Object]');
  });

  it('uses picker fallback info when getFileInfo fails on pickFile', async () => {
    mockPick.mockResolvedValueOnce({
      uri: '/tmp/doc.txt',
      name: 'doc.txt',
      type: 'text/plain',
      size: 123,
    });
    jest.spyOn(mediaPickerService, 'getFileInfo').mockRejectedValueOnce(new Error('info fail'));

    const result = await mediaPickerService.pickFile();
    expect(result.success).toBe(true);
    expect(result.size).toBe(123);
  });

  it('returns not implemented capture message when camera permission is granted', async () => {
    const result = await mediaPickerService.capturePhoto();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Camera capture should be handled by CameraScreen');
  });

  it('returns camera denied for recordVideo when camera permission is denied', async () => {
    mockPermissions.check.mockResolvedValueOnce(false);
    mockCamera.requestCameraPermission.mockResolvedValueOnce('denied');
    const result = await mediaPickerService.recordVideo();
    expect(result).toEqual({ success: false, error: 'Camera permission denied' });
  });

  it('returns mic denied for recordVideo when camera is granted but mic is denied', async () => {
    mockPermissions.check.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockCamera.requestMicrophonePermission.mockResolvedValueOnce('denied');

    const result = await mediaPickerService.recordVideo();
    expect(result).toEqual({ success: false, error: 'Microphone permission denied' });
  });

  it('returns not implemented for recordVoice when mic permission granted', async () => {
    const result = await mediaPickerService.recordVoice();
    expect(result.success).toBe(false);
    expect(result.error).toContain('not yet implemented');
  });

  it('returns false when camera lookup throws', async () => {
    mockCamera.getAvailableCameraDevices.mockRejectedValueOnce(new Error('camera unavailable'));
    await expect(mediaPickerService.isCameraAvailable()).resolves.toBe(false);
  });

  it('returns basic info for content uri stat failure', async () => {
    mockRNFS.stat.mockRejectedValueOnce(new Error('cannot stat content'));
    const info = await mediaPickerService.getFileInfo('content://file/abc');
    expect(info).toEqual({ size: 0, isFile: true, name: 'unknown' });
  });

  it('returns content uri stat values when available', async () => {
    mockRNFS.stat.mockResolvedValueOnce({
      size: 4321,
      isFile: () => true,
      name: 'content.jpg',
      mtime: new Date('2025-01-01'),
    });
    const info = await mediaPickerService.getFileInfo('content://file/ok');
    expect(info.size).toBe(4321);
    expect(info.name).toBe('content.jpg');
  });

  it('retries with original uri when normalized file uri stat fails', async () => {
    mockRNFS.stat
      .mockRejectedValueOnce(new Error('normalized fail'))
      .mockResolvedValueOnce({
        size: 55,
        isFile: () => true,
        name: 'orig.bin',
        mtime: new Date(),
      });

    const info = await mediaPickerService.getFileInfo('file:///tmp/original.bin');

    expect(info.size).toBe(55);
    expect(info.isFile).toBe(true);
  });

  it('returns default unknown info when stat and retry both fail', async () => {
    mockRNFS.stat.mockRejectedValue(new Error('no access'));
    const info = await mediaPickerService.getFileInfo('file:///tmp/fail.bin');
    expect(info).toEqual({ size: 0, isFile: false, name: 'unknown' });
  });

  it('returns invalid for empty file in validateFile', async () => {
    jest.spyOn(mediaPickerService, 'getFileInfo').mockResolvedValueOnce({
      size: 0,
      isFile: true,
      name: 'empty.bin',
    });
    const result = await mediaPickerService.validateFile('/tmp/empty.bin');
    expect(result).toEqual({ valid: false, error: 'File is empty' });
  });

  it('returns cannot access file when validateFile throws', async () => {
    jest.spyOn(mediaPickerService, 'getFileInfo').mockRejectedValueOnce(new Error('broken'));
    const result = await mediaPickerService.validateFile('/tmp/bad.bin');
    expect(result).toEqual({ valid: false, error: 'Cannot access file' });
  });

  it('covers private mime/extension helpers', () => {
    const svc = mediaPickerService as any;
    expect(svc.getFileExtension('image/jpeg')).toBe('jpg');
    expect(svc.getFileExtension('application/x-unknown')).toBe('bin');
    expect(svc.determineMediaType('image/gif', 'x.gif')).toBe('gif');
    expect(svc.determineMediaType('video/mp4', 'x.bin')).toBe('video');
    expect(svc.determineMediaType('audio/wav', 'x.bin')).toBe('voice');
    expect(svc.determineMediaType('', 'x.jpg')).toBe('image');
    expect(svc.determineMediaType('', 'x.unknown')).toBe('file');
  });

  it('handles content uri fallback path for pickVideo', async () => {
    mockPick.mockResolvedValueOnce({
      uri: 'content://video/1',
      name: 'clip.mp4',
      type: 'video/mp4',
      size: 42,
    });
    mockRNFS.copyFile.mockRejectedValueOnce(new Error('copy fail'));
    mockRNFS.readFile.mockResolvedValueOnce('QUJD');

    const result = await mediaPickerService.pickVideo();

    expect(result.success).toBe(true);
    expect(result.uri).toContain('file:///mock/cache/clip.mp4');
  });

  it('returns error when content uri fallback chain fails for pickVideo', async () => {
    mockPick.mockResolvedValueOnce({
      uri: 'content://video/2',
      name: 'clip.mp4',
      type: 'video/mp4',
    });
    mockRNFS.copyFile.mockRejectedValueOnce(new Error('copy fail'));
    mockRNFS.readFile.mockRejectedValueOnce(new Error('read fail'));
    mockRNFS.downloadFile.mockReturnValueOnce({ promise: Promise.resolve({ statusCode: 500 }) });

    const result = await mediaPickerService.pickVideo();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Download failed');
  });

  it('handles content uri fallback path for pickFile', async () => {
    mockPick.mockResolvedValueOnce({
      uri: 'content://file/1',
      name: 'doc.pdf',
      type: 'application/pdf',
      size: 42,
    });
    mockRNFS.copyFile.mockRejectedValueOnce(new Error('copy fail'));
    mockRNFS.readFile.mockResolvedValueOnce('QUJD');

    const result = await mediaPickerService.pickFile();

    expect(result.success).toBe(true);
    expect(result.uri).toContain('file:///mock/cache/doc.pdf');
  });

  it('returns error when content uri fallback chain fails for pickFile', async () => {
    mockPick.mockResolvedValueOnce({
      uri: 'content://file/2',
      name: 'doc.pdf',
      type: 'application/pdf',
    });
    mockRNFS.copyFile.mockRejectedValueOnce(new Error('copy fail'));
    mockRNFS.readFile.mockRejectedValueOnce(new Error('read fail'));
    mockRNFS.downloadFile.mockReturnValueOnce({ promise: Promise.resolve({ statusCode: 500 }) });

    const result = await mediaPickerService.pickFile();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Download failed');
  });

  it('returns failed capture message when internal permission method throws', async () => {
    jest.spyOn(mediaPickerService as any, 'requestCameraPermission').mockRejectedValueOnce(new Error('perm crash'));
    const result = await mediaPickerService.capturePhoto();
    expect(result).toEqual({ success: false, error: 'perm crash' });
  });

  it('returns failed record video message when internal permission method throws', async () => {
    jest.spyOn(mediaPickerService as any, 'requestCameraPermission').mockRejectedValueOnce(new Error('video crash'));
    const result = await mediaPickerService.recordVideo();
    expect(result).toEqual({ success: false, error: 'video crash' });
  });

  it('returns failed record voice message when internal permission method throws', async () => {
    jest
      .spyOn(mediaPickerService as any, 'requestMicrophonePermission')
      .mockRejectedValueOnce(new Error('voice crash'));
    const result = await mediaPickerService.recordVoice();
    expect(result).toEqual({ success: false, error: 'voice crash' });
  });

  it('covers iOS permission helper branches', async () => {
    const { Platform } = require('react-native');
    Platform.OS = 'ios';
    const svc = mediaPickerService as any;
    await expect(svc.requestCameraPermission()).resolves.toBe(true);
    await expect(svc.requestMicrophonePermission()).resolves.toBe(true);
    Platform.OS = 'android';
  });

  it('returns false from private camera permission helper on check error', async () => {
    mockPermissions.check.mockRejectedValueOnce(new Error('camera check fail'));
    await expect((mediaPickerService as any).requestCameraPermission()).resolves.toBe(false);
  });

  it('returns false from private microphone permission helper on check error', async () => {
    mockPermissions.check.mockRejectedValueOnce(new Error('mic check fail'));
    await expect((mediaPickerService as any).requestMicrophonePermission()).resolves.toBe(false);
  });

  it('returns valid true for acceptable file in validateFile', async () => {
    jest.spyOn(mediaPickerService, 'getFileInfo').mockResolvedValueOnce({
      size: 2048,
      isFile: true,
      name: 'ok.bin',
    });
    await expect(mediaPickerService.validateFile('/tmp/ok.bin')).resolves.toEqual({ valid: true });
  });

  it('covers additional extension media-type branches', () => {
    const svc = mediaPickerService as any;
    expect(svc.determineMediaType('', 'movie.webm')).toBe('video');
    expect(svc.determineMediaType('', 'voice.mp3')).toBe('voice');
  });
});

describe('MediaPickerService without DocumentPicker', () => {
  it('returns not available errors when picker module is missing', async () => {
    jest.resetModules();
    jest.doMock('@react-native-documents/picker', () => {
      throw new Error('module missing');
    });

    const mod = require('../../src/services/MediaPickerService');
    const svc = mod.mediaPickerService;

    await expect(svc.pickImage()).resolves.toEqual(
      expect.objectContaining({ success: false, error: expect.stringContaining('Document picker is not available') })
    );
    await expect(svc.pickVideo()).resolves.toEqual(
      expect.objectContaining({ success: false, error: expect.stringContaining('Document picker is not available') })
    );
    await expect(svc.pickFile()).resolves.toEqual(
      expect.objectContaining({ success: false, error: expect.stringContaining('Document picker is not available') })
    );
  });
});
