/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { VideoPlayer } from '../../src/components/VideoPlayer';

// Mock i18n transifex
jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: any) => {
    if (params) {
      return key.replace('{error}', params.error || '');
    }
    return key;
  },
}));

// Mock useTheme
jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#0066cc',
      surfaceVariant: '#2a2a2a',
      error: '#ff4444',
      surface: '#1a1a1a',
      text: '#ffffff',
    },
  }),
}));

// Mock react-native-video
const mockEnterPictureInPicture = jest.fn();

jest.mock('react-native-video', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  return forwardRef((props: any, ref: any) => {
    useImperativeHandle(ref, () => ({
      enterPictureInPicture: mockEnterPictureInPicture,
    }));

    return (
      <video-test data-props={JSON.stringify(props)}>
        Video Component
      </video-test>
    );
  });
});

describe('VideoPlayer', () => {
  const defaultProps = {
    url: 'https://example.com/video.mp4',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render video container', () => {
    const { UNSAFE_root } = render(<VideoPlayer {...defaultProps} />);
    expect(UNSAFE_root).toBeTruthy();
  });

  it('should render Video component with correct source', () => {
    const { UNSAFE_getByType } = render(<VideoPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('video-test');
    const props = JSON.parse(video.props['data-props']);
    expect(props.source.uri).toBe('https://example.com/video.mp4');
  });

  it('should render loading indicator initially', () => {
    const { UNSAFE_getByType } = render(<VideoPlayer {...defaultProps} />);
    const activityIndicator = UNSAFE_getByType('ActivityIndicator');
    expect(activityIndicator).toBeTruthy();
  });

  it('should pass controls prop to Video', () => {
    const { UNSAFE_getByType } = render(<VideoPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('video-test');
    const props = JSON.parse(video.props['data-props']);
    expect(props.controls).toBe(true);
  });

  it('should initialize with paused state', () => {
    const { UNSAFE_getByType } = render(<VideoPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('video-test');
    const props = JSON.parse(video.props['data-props']);
    expect(props.paused).toBe(true);
  });

  it('should render play button', () => {
    const { getByText } = render(<VideoPlayer {...defaultProps} />);
    expect(getByText('Play')).toBeTruthy();
  });

  it('should toggle play/pause when button pressed', () => {
    const { getByText, UNSAFE_getByType } = render(
      <VideoPlayer {...defaultProps} />,
    );
    const playButton = getByText('Play');

    fireEvent.press(playButton);

    // After press, should show Pause
    expect(getByText('Pause')).toBeTruthy();

    // Video should have paused=false
    const video = UNSAFE_getByType('video-test');
    const props = JSON.parse(video.props['data-props']);
    expect(props.paused).toBe(false);
  });

  it('should toggle back to play when pressed again', () => {
    const { getByText } = render(<VideoPlayer {...defaultProps} />);
    const playButton = getByText('Play');

    fireEvent.press(playButton);
    const pauseButton = getByText('Pause');
    fireEvent.press(pauseButton);

    expect(getByText('Play')).toBeTruthy();
  });

  it('should pass resizeMode prop', () => {
    const { UNSAFE_getByType } = render(<VideoPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('video-test');
    const props = JSON.parse(video.props['data-props']);
    expect(props.resizeMode).toBe('contain');
  });

  it('should have playInBackground prop', () => {
    const { UNSAFE_getByType } = render(<VideoPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('video-test');
    const props = JSON.parse(video.props['data-props']);
    expect(props.playInBackground).toBeDefined();
  });

  it('should have playWhenInactive prop', () => {
    const { UNSAFE_getByType } = render(<VideoPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('video-test');
    const props = JSON.parse(video.props['data-props']);
    expect(props.playWhenInactive).toBeDefined();
  });

  it('should have enterPictureInPictureOnLeave prop', () => {
    const { UNSAFE_getByType } = render(<VideoPlayer {...defaultProps} />);
    const video = UNSAFE_getByType('video-test');
    const props = JSON.parse(video.props['data-props']);
    expect(props.enterPictureInPictureOnLeave).toBeDefined();
  });

  it('should render with different URL', () => {
    const { UNSAFE_getByType } = render(
      <VideoPlayer url="https://example.com/another-video.mp4" />,
    );
    const video = UNSAFE_getByType('video-test');
    const props = JSON.parse(video.props['data-props']);
    expect(props.source.uri).toBe('https://example.com/another-video.mp4');
  });

  it('should clear loading after video loads', () => {
    const { UNSAFE_getByType, UNSAFE_root } = render(
      <VideoPlayer {...defaultProps} />,
    );
    const video = UNSAFE_getByType('video-test');

    act(() => {
      fireEvent(video, 'load');
    });

    expect(UNSAFE_root.findAllByType('ActivityIndicator')).toHaveLength(0);
  });

  it('should show translated error when video load fails', () => {
    const { UNSAFE_getByType, getByText } = render(
      <VideoPlayer {...defaultProps} />,
    );
    const video = UNSAFE_getByType('video-test');

    act(() => {
      fireEvent(video, 'error', { error: { errorString: 'codec failed' } });
    });

    expect(getByText('Video error: codec failed')).toBeTruthy();
  });

  it('should fall back to default translated error and trigger PiP', () => {
    const { UNSAFE_getByType, getByText } = render(
      <VideoPlayer {...defaultProps} />,
    );
    const video = UNSAFE_getByType('video-test');

    act(() => {
      fireEvent(video, 'error', {});
    });

    expect(getByText('Video error: Failed to load video')).toBeTruthy();

    const { getByText: getFreshByText } = render(
      <VideoPlayer {...defaultProps} />,
    );
    fireEvent.press(getFreshByText('PiP'));
    expect(mockEnterPictureInPicture).toHaveBeenCalled();
  });
});
