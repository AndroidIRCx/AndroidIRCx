/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert, Modal, PermissionsAndroid, Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MediaUploadModal } from '../../src/components/MediaUploadModal';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: jest.fn().mockReturnValue({
    colors: {
      surface: '#111',
      text: '#fff',
      messageBackground: '#333',
      border: '#555',
      accent: '#0f0',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: jest.fn().mockReturnValue((k: string) => k),
}));

jest.mock('../../src/services/MediaPickerService', () => ({
  mediaPickerService: {
    pickImage: jest.fn(),
    pickVideo: jest.fn(),
    pickFile: jest.fn(),
    getFileInfo: jest.fn(),
  },
}));

const mockVoiceRecorderControl = { mode: 'complete' as 'complete' | 'idle' };
const mockCameraScreenControl = { autoTake: true };
const mockVideoRecorderControl = { autoRecord: true };

jest.mock('../../src/components/VoiceRecorder', () => ({
  VoiceRecorder: ({ onRecordingComplete, onCancel }: any) => {
    const React = require('react');
    const { TouchableOpacity, Text } = require('react-native');
    React.useEffect(() => {
      if (mockVoiceRecorderControl.mode === 'complete') {
        onRecordingComplete('/tmp/voice.m4a', 9);
      }
    }, [onRecordingComplete]);
    return (
      <TouchableOpacity testID="voice-cancel" onPress={onCancel}>
        <Text>VoiceCancel</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../../src/components/CameraScreen', () => ({
  CameraScreen: ({ visible, onPhotoTaken, onClose }: any) => {
    const React = require('react');
    const { TouchableOpacity, Text } = require('react-native');
    React.useEffect(() => {
      if (visible && mockCameraScreenControl.autoTake) onPhotoTaken('/tmp/cam.jpg');
    }, [visible, onPhotoTaken]);
    if (!visible) return null;
    return (
      <TouchableOpacity testID="camera-close" onPress={onClose}>
        <Text>CameraClose</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../../src/components/VideoRecorderScreen', () => ({
  VideoRecorderScreen: ({ visible, onVideoRecorded, onClose }: any) => {
    const React = require('react');
    const { TouchableOpacity, Text } = require('react-native');
    React.useEffect(() => {
      if (visible && mockVideoRecorderControl.autoRecord) onVideoRecorded('/tmp/video.mp4', 6);
    }, [visible, onVideoRecorded]);
    if (!visible) return null;
    return (
      <TouchableOpacity testID="video-close" onPress={onClose}>
        <Text>VideoClose</Text>
      </TouchableOpacity>
    );
  },
}));

import { mediaPickerService } from '../../src/services/MediaPickerService';

const mockPicker = mediaPickerService as unknown as {
  pickImage: jest.Mock;
  pickVideo: jest.Mock;
  pickFile: jest.Mock;
  getFileInfo: jest.Mock;
};

describe('MediaUploadModal', () => {
  const baseProps = {
    visible: true,
    onClose: jest.fn(),
    onMediaSelected: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockVoiceRecorderControl.mode = 'complete';
    mockCameraScreenControl.autoTake = true;
    mockVideoRecorderControl.autoRecord = true;
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true as any);
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED as any);
    mockPicker.pickImage.mockResolvedValue({
      success: true,
      uri: '/tmp/a.jpg',
      type: 'image',
      mimeType: 'image/jpeg',
    });
    mockPicker.pickVideo.mockResolvedValue({
      success: true,
      uri: '/tmp/b.mp4',
      type: 'video',
      mimeType: 'video/mp4',
    });
    mockPicker.pickFile.mockResolvedValue({
      success: true,
      uri: '/tmp/c.bin',
      type: 'file',
      mimeType: 'application/octet-stream',
    });
    mockPicker.getFileInfo.mockResolvedValue({ size: 1234 });
  });

  it('renders modal title and actions', () => {
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    expect(getByText('Select Media Source')).toBeTruthy();
    expect(getByText('Photo Library')).toBeTruthy();
    expect(getByText('Video Library')).toBeTruthy();
  });

  it('handles successful photo library selection', async () => {
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Photo Library'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, uri: '/tmp/a.jpg' })
      );
      expect(baseProps.onClose).toHaveBeenCalled();
    });
  });

  it('handles successful file picker selection', async () => {
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('File Picker'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, uri: '/tmp/c.bin' })
      );
    });
  });

  it('shows alert for media picker error', async () => {
    mockPicker.pickVideo.mockResolvedValueOnce({
      success: false,
      error: 'Video failed',
    });

    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Video Library'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Video failed');
    });
  });

  it('does not alert on user cancelled', async () => {
    mockPicker.pickFile.mockResolvedValueOnce({
      success: false,
      error: 'User cancelled',
    });

    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('File Picker'));

    await waitFor(() => {
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  it('opens voice recorder and returns voice result', async () => {
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Voice Message'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          type: 'voice',
          mimeType: 'audio/m4a',
        })
      );
    });
  });

  it('opens camera flow and sends photo with file info', async () => {
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Take Photo'));

    await waitFor(() => {
      expect(mockPicker.getFileInfo).toHaveBeenCalledWith('/tmp/cam.jpg');
      expect(baseProps.onMediaSelected).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'image', size: 1234 })
      );
    });
  });

  it('falls back when camera getFileInfo fails', async () => {
    mockPicker.getFileInfo.mockRejectedValueOnce(new Error('stat fail'));
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Take Photo'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, type: 'image', uri: '/tmp/cam.jpg' })
      );
    });
  });

  it('opens video recorder flow and sends video', async () => {
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Record Video'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'video', duration: 6 })
      );
    });
  });

  it('falls back when video recorder getFileInfo fails', async () => {
    mockPicker.getFileInfo.mockRejectedValueOnce(new Error('video stat fail'));
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Record Video'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, type: 'video', uri: '/tmp/video.mp4', duration: 6 })
      );
    });
  });

  it('handles denied microphone permission for voice recorder', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValueOnce(false);
    (PermissionsAndroid.request as jest.Mock).mockResolvedValueOnce('denied');

    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Voice Message'));

    await waitFor(() => {
      expect(PermissionsAndroid.request).toHaveBeenCalled();
      expect(baseProps.onMediaSelected).not.toHaveBeenCalled();
    });
  });

  it('does nothing when camera permission is denied for photo', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValueOnce(false);
    (PermissionsAndroid.request as jest.Mock).mockResolvedValueOnce('denied');
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Take Photo'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).not.toHaveBeenCalled();
    });
  });

  it('calls onClose when cancel is pressed', () => {
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Cancel'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('handles thrown picker exception in action handler', async () => {
    mockPicker.pickImage.mockRejectedValueOnce(new Error('pick exploded'));
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Photo Library'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'pick exploded');
    });
  });

  it('does not notify when picker returns success without uri', async () => {
    mockPicker.pickFile.mockResolvedValueOnce({ success: true, uri: undefined } as any);
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('File Picker'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).not.toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  it('handles camera permission check exception', async () => {
    (PermissionsAndroid.check as jest.Mock).mockRejectedValueOnce(new Error('perm check failed'));
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Take Photo'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).not.toHaveBeenCalled();
    });
  });

  it('does nothing when record video camera permission is denied', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValueOnce(false);
    (PermissionsAndroid.request as jest.Mock).mockResolvedValueOnce('denied');
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Record Video'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).not.toHaveBeenCalled();
    });
  });

  it('does nothing when record video mic permission is denied', async () => {
    (PermissionsAndroid.check as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    (PermissionsAndroid.request as jest.Mock).mockResolvedValueOnce('denied');
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Record Video'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).not.toHaveBeenCalled();
    });
  });

  it('handles record video permission exception', async () => {
    (PermissionsAndroid.check as jest.Mock).mockRejectedValueOnce(new Error('video perm fail'));
    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Record Video'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).not.toHaveBeenCalled();
    });
  });

  it('shows alert when voice permission request throws', async () => {
    (PermissionsAndroid.check as jest.Mock).mockResolvedValueOnce(false);
    (PermissionsAndroid.request as jest.Mock).mockRejectedValueOnce(new Error('mic perm fail'));

    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Voice Message'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to request microphone permission. Please check app settings.'
      );
    });
  });

  it('skips permission flow on ios and proceeds', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });

    const { getByText } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Take Photo'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'image', uri: '/tmp/cam.jpg' })
      );
    });
    expect(PermissionsAndroid.check).not.toHaveBeenCalled();
  });

  it('handles voice recorder cancel callback path', async () => {
    mockVoiceRecorderControl.mode = 'idle';
    const { getByText, getByTestId } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Voice Message'));
    await waitFor(() => {
      expect(getByTestId('voice-cancel')).toBeTruthy();
    });
    fireEvent.press(getByTestId('voice-cancel'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).not.toHaveBeenCalled();
    });
  });

  it('handles onRequestClose for nested voice modal', async () => {
    mockVoiceRecorderControl.mode = 'idle';
    const { getByText, UNSAFE_getAllByType } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Voice Message'));
    const modals = UNSAFE_getAllByType(Modal);
    fireEvent(modals[1], 'requestClose');

    await waitFor(() => {
      expect(baseProps.onMediaSelected).not.toHaveBeenCalled();
    });
  });

  it('handles camera screen close callback path', async () => {
    mockCameraScreenControl.autoTake = false;
    const { getByText, getByTestId } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Take Photo'));
    await waitFor(() => {
      expect(getByTestId('camera-close')).toBeTruthy();
    });
    fireEvent.press(getByTestId('camera-close'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).not.toHaveBeenCalled();
    });
  });

  it('handles video screen close callback path', async () => {
    mockVideoRecorderControl.autoRecord = false;
    const { getByText, getByTestId } = render(<MediaUploadModal {...baseProps} />);
    fireEvent.press(getByText('Record Video'));
    await waitFor(() => {
      expect(getByTestId('video-close')).toBeTruthy();
    });
    fireEvent.press(getByTestId('video-close'));

    await waitFor(() => {
      expect(baseProps.onMediaSelected).not.toHaveBeenCalled();
    });
  });
});
