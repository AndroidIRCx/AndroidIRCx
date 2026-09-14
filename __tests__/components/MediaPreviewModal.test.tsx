/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MediaPreviewModal } from '../../src/components/MediaPreviewModal';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: jest.fn().mockReturnValue({
    colors: {
      surface: '#111',
      border: '#222',
      text: '#fff',
      textSecondary: '#aaa',
      messageBackground: '#333',
      inputBackground: '#444',
      error: '#f00',
      accent: '#0f0',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: jest.fn().mockReturnValue((key: string, params?: any) => {
    if (params) {
      return key.replace(/{(\w+)}/g, (match, p1) => params[p1] || match);
    }
    return key;
  }),
}));

jest.mock('react-native-video', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return ({ onError, testID }: any) => (
    <TouchableOpacity
      testID={testID || 'video-mock'}
      onPress={() => onError?.({ nativeEvent: { error: 'video-error' } })}
    >
      <Text>VideoMock</Text>
    </TouchableOpacity>
  );
});

jest.mock('../../src/services/MediaEncryptionService', () => ({
  mediaEncryptionService: {
    hasEncryptionKey: jest.fn(),
    encryptMediaFile: jest.fn(),
  },
}));

jest.mock('../../src/services/MediaUploadService', () => ({
  mediaUploadService: {
    requestUploadToken: jest.fn(),
    uploadFile: jest.fn(),
  },
}));

jest.mock('../../src/services/MediaSettingsService', () => ({
  mediaSettingsService: {
    shouldShowEncryptionIndicator: jest.fn(),
  },
}));

jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
}));

import RNFS from 'react-native-fs';
import { mediaEncryptionService } from '../../src/services/MediaEncryptionService';
import { mediaUploadService } from '../../src/services/MediaUploadService';
import { mediaSettingsService } from '../../src/services/MediaSettingsService';

const mockRNFS = RNFS as unknown as { exists: jest.Mock };
const mockEnc = mediaEncryptionService as unknown as {
  hasEncryptionKey: jest.Mock;
  encryptMediaFile: jest.Mock;
};
const mockUpload = mediaUploadService as unknown as {
  requestUploadToken: jest.Mock;
  uploadFile: jest.Mock;
};
const mockSettings = mediaSettingsService as unknown as {
  shouldShowEncryptionIndicator: jest.Mock;
};

describe('MediaPreviewModal', () => {
  const baseProps = {
    visible: true,
    onClose: jest.fn(),
    mediaResult: {
      success: true,
      uri: '/tmp/image.jpg',
      type: 'image' as const,
      mimeType: 'image/jpeg',
      fileName: 'image.jpg',
      size: 1024,
    },
    network: 'net',
    tabId: 'channel::net::#chan',
    onSendComplete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    mockRNFS.exists.mockResolvedValue(true);
    mockEnc.hasEncryptionKey.mockResolvedValue(true);
    mockSettings.shouldShowEncryptionIndicator.mockResolvedValue(true);
    mockUpload.requestUploadToken.mockResolvedValue({
      id: 'media-123',
      upload_token: 'tok',
      expires: Math.floor(Date.now() / 1000) + 300,
      status: 'pending',
    });
    mockEnc.encryptMediaFile.mockResolvedValue({
      success: true,
      encryptedUri: '/tmp/encrypted.bin',
    });
    mockUpload.uploadFile.mockImplementation(
      async (_a, _b, _c, _d, onProgress) => {
        onProgress?.({ bytesUploaded: 50, totalBytes: 100, percentage: 50 });
        return { size: 1, sha256: 'x', status: 'ready' };
      },
    );
  });

  it('renders encryption indicator when enabled', async () => {
    const { getByText } = await render(<MediaPreviewModal {...baseProps} />);

    await waitFor(async () => {
      expect(getByText('Encrypted')).toBeTruthy();
    });
  });

  it('sends media and emits !enc-media tag with caption', async () => {
    const { getByText, getByPlaceholderText } = await render(
      <MediaPreviewModal {...baseProps} />,
    );

    await fireEvent.changeText(
      getByPlaceholderText('Add a caption...'),
      'caption test',
    );
    await fireEvent.press(getByText('Send'));

    await waitFor(async () => {
      expect(mockUpload.requestUploadToken).toHaveBeenCalledWith(
        'image',
        'image/jpeg',
      );
      expect(mockEnc.encryptMediaFile).toHaveBeenCalledWith(
        '/tmp/image.jpg',
        'net',
        'channel::net::#chan',
        'media-123',
      );
      expect(baseProps.onSendComplete).toHaveBeenCalledWith(
        '!enc-media [media-123]',
        'caption test',
      );
      expect(baseProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows error when encryption fails', async () => {
    mockEnc.encryptMediaFile.mockResolvedValueOnce({
      success: false,
      error: 'Encrypt boom',
    });

    const { getByText } = await render(<MediaPreviewModal {...baseProps} />);
    await fireEvent.press(getByText('Send'));

    await waitFor(async () => {
      expect(getByText('Encrypt boom')).toBeTruthy();
    });
  });

  it('returns null when mediaResult is null', async () => {
    const { queryByText } = await render(
      <MediaPreviewModal {...baseProps} mediaResult={null} />,
    );
    expect(queryByText('Preview Media')).toBeNull();
  });

  it('hides encryption indicator when disabled in settings', async () => {
    mockSettings.shouldShowEncryptionIndicator.mockResolvedValueOnce(false);
    const { queryByText } = await render(<MediaPreviewModal {...baseProps} />);
    await waitFor(async () => {
      expect(queryByText('Encrypted')).toBeNull();
    });
  });

  it('hides encryption indicator when no key', async () => {
    mockEnc.hasEncryptionKey.mockResolvedValueOnce(false);
    const { queryByText } = await render(<MediaPreviewModal {...baseProps} />);
    await waitFor(async () => {
      expect(queryByText('Encrypted')).toBeNull();
    });
  });

  it('shows validation error when send is pressed with missing uri', async () => {
    const { getByText } = await render(
      <MediaPreviewModal
        {...baseProps}
        mediaResult={{ ...baseProps.mediaResult, uri: undefined } as any}
      />,
    );
    await fireEvent.press(getByText('Send'));
    await waitFor(async () => {
      expect(getByText('No media selected')).toBeTruthy();
    });
  });

  it('shows file missing error when file cannot be found', async () => {
    mockRNFS.exists.mockResolvedValue(false);
    const { getByText } = await render(<MediaPreviewModal {...baseProps} />);
    await fireEvent.press(getByText('Send'));
    await waitFor(async () => {
      expect(
        getByText('File does not exist. Please select the file again.'),
      ).toBeTruthy();
    });
  });

  it('falls back to original uri when normalized path does not exist', async () => {
    mockRNFS.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { getByText } = await render(<MediaPreviewModal {...baseProps} />);
    await fireEvent.press(getByText('Send'));
    await waitFor(async () => {
      expect(mockEnc.encryptMediaFile).toHaveBeenCalledWith(
        '/tmp/image.jpg',
        'net',
        'channel::net::#chan',
        'media-123',
      );
    });
  });

  it('shows upload failed when upload status is not ready', async () => {
    mockUpload.uploadFile.mockResolvedValueOnce({ status: 'pending' });
    const { getByText } = await render(<MediaPreviewModal {...baseProps} />);
    await fireEvent.press(getByText('Send'));
    await waitFor(async () => {
      expect(getByText('Upload failed (pending)')).toBeTruthy();
    });
  });

  it('shows token request error message', async () => {
    mockUpload.requestUploadToken.mockRejectedValueOnce(
      new Error('token down'),
    );
    const { getByText } = await render(<MediaPreviewModal {...baseProps} />);
    await fireEvent.press(getByText('Send'));
    await waitFor(async () => {
      expect(getByText('token down')).toBeTruthy();
    });
  });

  it('renders video preview and handles preview error', async () => {
    const { getByText, getByTestId } = await render(
      <MediaPreviewModal
        {...baseProps}
        mediaResult={{
          ...baseProps.mediaResult,
          type: 'video',
          mimeType: 'video/mp4',
        }}
      />,
    );
    await fireEvent.press(getByTestId('video-mock'));
    await waitFor(async () => {
      expect(getByText('Failed to load video preview')).toBeTruthy();
    });
  });

  it('renders audio preview and handles preview error', async () => {
    const { getByText, getByTestId } = await render(
      <MediaPreviewModal
        {...baseProps}
        mediaResult={{
          ...baseProps.mediaResult,
          type: 'voice',
          mimeType: 'audio/m4a',
        }}
      />,
    );
    expect(getByText('Audio File')).toBeTruthy();
    expect(() => getByTestId('video-mock')).toThrow();
    await fireEvent.press(getByText('Play'));
    await fireEvent.press(getByTestId('video-mock'));
    await waitFor(async () => {
      expect(getByText('Audio error: video-error')).toBeTruthy();
    });
  });

  it('renders generic file preview and file label fallback', async () => {
    const { getByText } = await render(
      <MediaPreviewModal
        {...baseProps}
        mediaResult={{
          ...baseProps.mediaResult,
          type: 'file',
          mimeType: 'application/octet-stream',
          fileName: undefined,
        }}
      />,
    );
    expect(getByText('File')).toBeTruthy();
  });

  it('handles image preview error callback', async () => {
    const { getByText, UNSAFE_getByType } = await render(
      <MediaPreviewModal {...baseProps} />,
    );
    const image = UNSAFE_getByType(require('react-native').Image);
    await fireEvent(image, 'error', { nativeEvent: { error: 'bad image' } });
    await waitFor(async () => {
      expect(getByText('Failed to load image preview')).toBeTruthy();
    });
  });

  it('renders size in bytes/kb/mb and extra metadata', async () => {
    const { getByText, rerender } = await render(
      <MediaPreviewModal
        {...baseProps}
        mediaResult={{
          ...baseProps.mediaResult,
          size: 512,
          duration: 2.4,
          width: 100,
          height: 200,
        }}
      />,
    );
    expect(getByText('Size: 512 bytes')).toBeTruthy();
    expect(getByText('Duration: 2s')).toBeTruthy();
    expect(getByText('Dimensions: 100 × 200')).toBeTruthy();

    await rerender(
      <MediaPreviewModal
        {...baseProps}
        mediaResult={{ ...baseProps.mediaResult, size: 2048 }}
      />,
    );
    expect(getByText('Size: 2 KB')).toBeTruthy();

    await rerender(
      <MediaPreviewModal
        {...baseProps}
        mediaResult={{ ...baseProps.mediaResult, size: 2 * 1024 * 1024 }}
      />,
    );
    expect(getByText('Size: 2.00 MB')).toBeTruthy();
  });

  it('resets transient state when modal becomes hidden', async () => {
    mockUpload.requestUploadToken.mockRejectedValueOnce(
      new Error('temp error'),
    );
    const { getByText, queryByText, rerender } = await render(
      <MediaPreviewModal {...baseProps} />,
    );
    await fireEvent.press(getByText('Send'));

    await waitFor(async () => {
      expect(getByText('temp error')).toBeTruthy();
    });

    await rerender(<MediaPreviewModal {...baseProps} visible={false} />);
    await waitFor(async () => {
      expect(queryByText('temp error')).toBeNull();
    });
  });

  it('covers ios file uri normalization branch in send flow', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const { getByText } = await render(
      <MediaPreviewModal
        {...baseProps}
        mediaResult={{ ...baseProps.mediaResult, uri: '/tmp/ios-image.jpg' }}
      />,
    );
    await fireEvent.press(getByText('Send'));

    await waitFor(async () => {
      expect(mockEnc.encryptMediaFile).toHaveBeenCalledWith(
        '/tmp/ios-image.jpg',
        'net',
        'channel::net::#chan',
        'media-123',
      );
    });
  });

  it('covers file:// preview uri branch', async () => {
    const { getByText } = await render(
      <MediaPreviewModal
        {...baseProps}
        mediaResult={{ ...baseProps.mediaResult, uri: 'file:///tmp/image.jpg' }}
      />,
    );
    expect(getByText('Preview Media')).toBeTruthy();
  });
});
