/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for AudioPlayer component - Wave 5
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AudioPlayer } from '../../src/components/AudioPlayer';

// Mock react-native-video
jest.mock('react-native-video', () => 'Video');

// Mock hooks
jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: jest.fn().mockReturnValue({
    colors: {
      surfaceVariant: '#2C2C2C',
      surface: '#1E1E1E',
      text: '#FFFFFF',
      primary: '#2196F3',
      error: '#B91C1C',
    },
  }),
}));

jest.mock('../../src/i18n/localization', () => ({
  useT: jest.fn().mockReturnValue((key: string, params?: any) => {
    if (params) {
      return key.replace(/{(\w+)}/g, (match, p1) => params[p1] || match);
    }
    return key;
  }),
}));

describe('AudioPlayer', () => {
  const defaultProps = {
    url: 'https://example.com/audio.mp3',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('should render without crashing', async () => {
    const { UNSAFE_root } = await render(<AudioPlayer {...defaultProps} />);
    expect(UNSAFE_root).toBeDefined();
  });

  it('should display Play button initially', async () => {
    const { getByText } = await render(<AudioPlayer {...defaultProps} />);
    expect(getByText('Play')).toBeTruthy();
  });

  it('should toggle between Play and Pause when button is pressed', async () => {
    const { getByText } = await render(<AudioPlayer {...defaultProps} />);
    const button = getByText('Play');

    await fireEvent.press(button);
    expect(getByText('Pause')).toBeTruthy();

    await fireEvent.press(getByText('Pause'));
    expect(getByText('Play')).toBeTruthy();
  });

  it('should render with different URLs', async () => {
    const urls = [
      'https://example.com/song.mp3',
      'file:///local/audio.wav',
      'http://stream.example.com/radio.ogg',
    ];

    for (const url of urls) {
      const { UNSAFE_root } = await render(<AudioPlayer url={url} />);
      expect(UNSAFE_root).toBeDefined();
    }
  });

  it('should not mount native Video before playback is requested', async () => {
    const { UNSAFE_root } = await render(<AudioPlayer {...defaultProps} />);
    expect(UNSAFE_root.findAllByType('Video')).toHaveLength(0);
    expect(UNSAFE_root.findAllByType('ActivityIndicator')).toHaveLength(0);
  });

  it('should render Video component with correct source after Play', async () => {
    const { UNSAFE_getByType, getByText } = await render(
      <AudioPlayer {...defaultProps} />,
    );

    await fireEvent.press(getByText('Play'));

    const video = UNSAFE_getByType('Video');
    expect(video).toBeTruthy();
    expect(video.props.source.uri).toBe(defaultProps.url);
  });

  it('should show loading indicator while starting playback', async () => {
    const { UNSAFE_getByType, getByText } = await render(
      <AudioPlayer {...defaultProps} />,
    );

    await fireEvent.press(getByText('Play'));

    const activityIndicator = UNSAFE_getByType('ActivityIndicator');
    expect(activityIndicator).toBeTruthy();
  });

  it('should have controls enabled on Video', async () => {
    const { UNSAFE_getByType, getByText } = await render(
      <AudioPlayer {...defaultProps} />,
    );

    await fireEvent.press(getByText('Play'));

    const video = UNSAFE_getByType('Video');
    expect(video.props.controls).toBe(true);
  });

  it('should start unpaused after Play is pressed', async () => {
    const { UNSAFE_getByType, getByText } = await render(
      <AudioPlayer {...defaultProps} />,
    );

    await fireEvent.press(getByText('Play'));

    const video = UNSAFE_getByType('Video');
    expect(video.props.paused).toBe(false);
  });

  it('should handle onLoad callback', async () => {
    const { UNSAFE_getByType, UNSAFE_root, getByText } = await render(
      <AudioPlayer {...defaultProps} />,
    );

    await fireEvent.press(getByText('Play'));

    const video = UNSAFE_getByType('Video');

    await act(() => {
      video.props.onLoad();
    });
    expect(UNSAFE_root.findAllByType('ActivityIndicator')).toHaveLength(0);
  });

  it('should show translated error message when playback fails with error string', async () => {
    const { UNSAFE_getByType, getByText, UNSAFE_root } = await render(
      <AudioPlayer {...defaultProps} />,
    );

    await fireEvent.press(getByText('Play'));

    const video = UNSAFE_getByType('Video');

    await act(async () => {
      await fireEvent(video, 'error', {
        error: { errorString: 'network failed' },
      });
    });

    expect(getByText('Audio error: network failed')).toBeTruthy();
    expect(UNSAFE_root.findAllByType('Video')).toHaveLength(0);
  });

  it('should use fallback translated error when playback fails without error string', async () => {
    const { UNSAFE_getByType, getByText } = await render(
      <AudioPlayer {...defaultProps} />,
    );

    await fireEvent.press(getByText('Play'));

    const video = UNSAFE_getByType('Video');

    await act(async () => {
      await fireEvent(video, 'error', {});
    });

    expect(getByText('Audio error: Failed to load audio')).toBeTruthy();
  });

  it('should reject unsupported audio sources before mounting Video', async () => {
    const { getByText, UNSAFE_root } = await render(
      <AudioPlayer url="ftp://example.com/audio.mp3" />,
    );

    expect(getByText('Audio error: Unsupported audio source')).toBeTruthy();
    expect(getByText('Unavailable')).toBeTruthy();
    expect(UNSAFE_root.findAllByType('Video')).toHaveLength(0);
  });
});
