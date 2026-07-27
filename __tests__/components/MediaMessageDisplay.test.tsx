/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MediaMessageDisplay } from '../../src/components/MediaMessageDisplay';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: jest.fn().mockReturnValue({
    colors: {
      surfaceVariant: '#222',
      accent: '#0f0',
      text: '#fff',
      textSecondary: '#aaa',
      error: '#f00',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: jest.fn().mockReturnValue((key: string, params?: any) => {
    if (key === 'Downloading... {progress}%') {
      return `Downloading... ${params?.progress}%`;
    }
    return key;
  }),
}));

jest.mock('react-native-video', () => 'Video');

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    open: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native-fs', () => ({
  exists: jest.fn(),
}));

jest.mock('../../src/services/MediaSettingsService', () => ({
  mediaSettingsService: {
    shouldShowEncryptionIndicator: jest.fn(),
  },
}));

jest.mock('../../src/services/MediaDownloadService', () => ({
  mediaDownloadService: {
    downloadMediaWithRetry: jest.fn(),
  },
}));

jest.mock('../../src/components/ImagePreview', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    ImagePreview: ({ url }: { url: string }) =>
      React.createElement(Text, null, `ImagePreview:${url}`),
  };
});

import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { mediaSettingsService } from '../../src/services/MediaSettingsService';
import { mediaDownloadService } from '../../src/services/MediaDownloadService';

const mockShare = Share as unknown as { open: jest.Mock };
const mockRNFS = RNFS as unknown as { exists: jest.Mock };
const mockSettings = mediaSettingsService as unknown as {
  shouldShowEncryptionIndicator: jest.Mock;
};
const mockDownload = mediaDownloadService as unknown as {
  downloadMediaWithRetry: jest.Mock;
};

describe('MediaMessageDisplay', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSettings.shouldShowEncryptionIndicator.mockResolvedValue(true);
    mockRNFS.exists.mockResolvedValue(true);
  });

  it('loads and renders encrypted image media with caption', async () => {
    mockDownload.downloadMediaWithRetry.mockResolvedValueOnce({
      success: true,
      uri: '/tmp/a.jpg',
      mimeType: 'image/jpeg',
    });

    const { getByText } = await render(
      <MediaMessageDisplay
        mediaId="id-1"
        network="net"
        tabId="channel::net::#chan"
        caption="hello cap"
      />,
    );

    await waitFor(async () => {
      expect(getByText('Encrypted')).toBeTruthy();
      expect(getByText('hello cap')).toBeTruthy();
      expect(mockDownload.downloadMediaWithRetry).toHaveBeenCalledWith(
        'id-1',
        'net',
        'channel::net::#chan',
        3,
        expect.any(Function),
      );
    });
  });

  it('shows insufficient context error when tabId is missing', async () => {
    const { getByText } = await render(
      <MediaMessageDisplay mediaId="id-2" network="net" tabId="" />,
    );

    await waitFor(async () => {
      expect(
        getByText(
          'Cannot decrypt media: insufficient context. This may happen if the message is viewed outside its original channel or if encryption keys are not available.',
        ),
      ).toBeTruthy();
    });
  });

  it('retries after download error and then succeeds', async () => {
    mockDownload.downloadMediaWithRetry
      .mockResolvedValueOnce({ success: false, error: 'Temporary fail' })
      .mockResolvedValueOnce({
        success: true,
        uri: '/tmp/retry.mp4',
        mimeType: 'video/mp4',
      });

    const { getByText } = await render(
      <MediaMessageDisplay
        mediaId="id-3"
        network="net"
        tabId="channel::net::#chan"
      />,
    );

    await waitFor(async () => {
      expect(getByText('Temporary fail')).toBeTruthy();
    });

    await fireEvent.press(getByText('Retry'));

    await waitFor(async () => {
      expect(mockDownload.downloadMediaWithRetry).toHaveBeenCalledTimes(2);
      expect(getByText('Encrypted')).toBeTruthy();
    });
  });

  it('opens file with share when media type is generic file', async () => {
    mockDownload.downloadMediaWithRetry.mockResolvedValueOnce({
      success: true,
      uri: '/tmp/file.bin',
      mimeType: 'application/octet-stream',
    });

    const { UNSAFE_getByType, getByText } = await render(
      <MediaMessageDisplay
        mediaId="id-4"
        network="net"
        tabId="channel::net::#chan"
      />,
    );

    await waitFor(async () => {
      expect(getByText('Tap to open')).toBeTruthy();
    });

    await fireEvent.press(UNSAFE_getByType(TouchableOpacity));

    await waitFor(async () => {
      expect(mockShare.open).toHaveBeenCalledWith({
        url: 'file:///tmp/file.bin',
        type: 'application/octet-stream',
      });
    });
  });

  it('renders encrypted audio without mounting native playback automatically', async () => {
    mockDownload.downloadMediaWithRetry.mockResolvedValueOnce({
      success: true,
      uri: '/tmp/song.mp3',
      mimeType: 'audio/mpeg',
    });

    const { getByText, UNSAFE_root } = await render(
      <MediaMessageDisplay
        mediaId="id-audio"
        network="net"
        tabId="channel::net::#chan"
      />,
    );

    await waitFor(async () => {
      expect(getByText('Audio Message')).toBeTruthy();
      expect(getByText('Play')).toBeTruthy();
    });

    expect(UNSAFE_root.findAllByType('Video')).toHaveLength(0);

    await fireEvent.press(getByText('Play'));

    await waitFor(async () => {
      expect(UNSAFE_root.findAllByType('Video')).toHaveLength(1);
    });
  });

  it('loads media only once despite translation-function churn (guards the reload loop)', async () => {
    const { useT } = require('../../src/i18n/transifex');
    // Simulate @transifex/react handing back a NEW `t` reference on every
    // render (e.g. after the TRANSLATIONS_FETCHED event). That churns the
    // loadMedia useCallback identity and re-runs the load effect. The load
    // guard must keep the download from re-firing — the fragility that could
    // otherwise trip "Maximum update depth exceeded".
    (useT as jest.Mock).mockImplementation(() => (key: string) => key);

    mockDownload.downloadMediaWithRetry.mockResolvedValue({
      success: true,
      uri: '/tmp/loop.jpg',
      mimeType: 'image/jpeg',
    });

    const { rerender } = await render(
      <MediaMessageDisplay
        mediaId="id-loop"
        network="net"
        tabId="channel::net::#chan"
      />,
    );

    await waitFor(async () => {
      expect(mockDownload.downloadMediaWithRetry).toHaveBeenCalledTimes(1);
    });

    // Re-render (new `t` each time) with the same mediaId/retry: no reload.
    rerender(
      <MediaMessageDisplay
        mediaId="id-loop"
        network="net"
        tabId="channel::net::#chan"
        caption="x"
      />,
    );
    rerender(
      <MediaMessageDisplay
        mediaId="id-loop"
        network="net"
        tabId="channel::net::#chan"
        caption="y"
      />,
    );

    await waitFor(async () => {
      expect(mockDownload.downloadMediaWithRetry).toHaveBeenCalledTimes(1);
    });

    // Restore the stable translation mock for any later tests.
    (useT as jest.Mock).mockReturnValue((key: string, params?: any) =>
      key === 'Downloading... {progress}%'
        ? `Downloading... ${params?.progress}%`
        : key,
    );
  });
});
