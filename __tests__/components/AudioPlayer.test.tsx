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

jest.mock('../../src/i18n/transifex', () => ({
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { UNSAFE_root } = render(<AudioPlayer {...defaultProps} />);
    expect(UNSAFE_root).toBeDefined();
  });

  it('should display Play button initially', () => {
    const { getByText } = render(<AudioPlayer {...defaultProps} />);
    expect(getByText('Play')).toBeTruthy();
  });

  it('should toggle between Play and Pause when button is pressed', () => {
    const { getByText } = render(<AudioPlayer {...defaultProps} />);
    const button = getByText('Play');
    
    fireEvent.press(button);
    expect(getByText('Pause')).toBeTruthy();
    
    fireEvent.press(getByText('Pause'));
    expect(getByText('Play')).toBeTruthy();
  });

  it('should render with different URLs', () => {
    const urls = [
      'https://example.com/song.mp3',
      'file:///local/audio.wav',
      'http://stream.example.com/radio.ogg',
    ];
    
    urls.forEach(url => {
      const { UNSAFE_root } = render(<AudioPlayer url={url} />);
      expect(UNSAFE_root).toBeDefined();
    });
  });

  it('should show loading indicator initially', () => {
    const { UNSAFE_getByType } = render(<AudioPlayer {...defaultProps} />);
    // ActivityIndicator should be present while loading
    const activityIndicator = UNSAFE_getByType('ActivityIndicator');
    expect(activityIndicator).toBeTruthy();
  });

  it('should render Video component with correct source', () => {
    const { UNSAFE_getByType } = render(<AudioPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('Video');
    expect(video).toBeTruthy();
    expect(video.props.source.uri).toBe(defaultProps.url);
  });

  it('should have controls enabled on Video', () => {
    const { UNSAFE_getByType } = render(<AudioPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('Video');
    expect(video.props.controls).toBe(true);
  });

  it('should be paused initially', () => {
    const { UNSAFE_getByType } = render(<AudioPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('Video');
    expect(video.props.paused).toBe(true);
  });

  it('should handle onLoad callback', () => {
    const { UNSAFE_getByType, UNSAFE_root } = render(<AudioPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('Video');

    act(() => {
      video.props.onLoad();
    });
    expect(UNSAFE_root.findAllByType('ActivityIndicator')).toHaveLength(0);
  });

  it('should show translated error message when playback fails with error string', () => {
    const { UNSAFE_getByType, getByText, UNSAFE_root } = render(<AudioPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('Video');

    act(() => {
      fireEvent(video, 'error', { error: { errorString: 'network failed' } });
    });

    expect(getByText('Audio error: network failed')).toBeTruthy();
    expect(UNSAFE_root.findAllByType('Video')).toHaveLength(0);
  });

  it('should use fallback translated error when playback fails without error string', () => {
    const { UNSAFE_getByType, getByText } = render(<AudioPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('Video');

    act(() => {
      fireEvent(video, 'error', {});
    });

    expect(getByText('Audio error: Failed to load audio')).toBeTruthy();
  });
});
