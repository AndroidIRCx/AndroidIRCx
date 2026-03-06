import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { VideoRecorderScreen } from '../../src/components/VideoRecorderScreen';

const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();

let mockCameraPermission = true;
let mockMicPermission = true;
let mockDevice: any = { id: 'back' };
const mockRequestCameraPermission = jest.fn();
const mockRequestMicPermission = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  return {
    Camera: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        startRecording: (...args: unknown[]) => mockStartRecording(...args),
        stopRecording: (...args: unknown[]) => mockStopRecording(...args),
      }));
      return React.createElement('Camera', props, props.children);
    }),
    useCameraDevice: () => mockDevice,
    useCameraPermission: () => ({
      hasPermission: mockCameraPermission,
      requestPermission: mockRequestCameraPermission,
    }),
    useMicrophonePermission: () => ({
      hasPermission: mockMicPermission,
      requestPermission: mockRequestMicPermission,
    }),
  };
});

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      text: '#fff',
      textSecondary: '#aaa',
      accent: '#08f',
      border: '#333',
      error: '#f33',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

describe('VideoRecorderScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    mockCameraPermission = true;
    mockMicPermission = true;
    mockDevice = { id: 'back' };
    mockRequestCameraPermission.mockResolvedValue(true);
    mockRequestMicPermission.mockResolvedValue(true);
    mockReadFile.mockResolvedValue('base64video');
    mockWriteFile.mockResolvedValue(undefined);
    mockStopRecording.mockResolvedValue(undefined);

    mockStartRecording.mockImplementation(async (opts: any) => {
      await opts.onRecordingFinished({ path: '/tmp/rec.mp4' });
    });
  });

  it('shows permission screen when camera/mic permission missing', async () => {
    mockCameraPermission = false;
    mockMicPermission = false;
    mockRequestCameraPermission.mockResolvedValue(false);
    mockRequestMicPermission.mockResolvedValue(false);

    const { getByText } = render(
      <VideoRecorderScreen visible onClose={jest.fn()} onVideoRecorded={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(getByText('Grant Permissions'));
    });

    expect(mockRequestCameraPermission).toHaveBeenCalled();
    expect(mockRequestMicPermission).toHaveBeenCalled();
  });

  it('records video and reports saved file', async () => {
    const onVideoRecorded = jest.fn();
    const onClose = jest.fn();

    const { UNSAFE_getAllByType } = render(
      <VideoRecorderScreen visible onClose={onClose} onVideoRecorded={onVideoRecorded} />
    );

    const buttons = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
    const recordButton = buttons[1];

    await act(async () => {
      fireEvent.press(recordButton);
    });

    expect(mockStartRecording).toHaveBeenCalled();
    expect(mockReadFile).toHaveBeenCalledWith('/tmp/rec.mp4', 'base64');
    expect(mockWriteFile).toHaveBeenCalled();
    expect(onVideoRecorded).toHaveBeenCalledWith(expect.stringContaining('/cache/video_'), expect.any(Number));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders null when hidden', () => {
    const { toJSON } = render(
      <VideoRecorderScreen visible={false} onClose={jest.fn()} onVideoRecorded={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });

  it('shows camera unavailable state when no device is found', () => {
    const onClose = jest.fn();
    mockDevice = null;

    const { getByText } = render(
      <VideoRecorderScreen visible onClose={onClose} onVideoRecorded={jest.fn()} />
    );

    expect(getByText('Camera not available')).toBeTruthy();
    fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error banner when start recording fails', async () => {
    mockStartRecording.mockRejectedValue(new Error('start failed'));

    const { UNSAFE_getAllByType, getByText } = render(
      <VideoRecorderScreen visible onClose={jest.fn()} onVideoRecorded={jest.fn()} />
    );

    const buttons = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
    const recordButton = buttons[1];

    await act(async () => {
      fireEvent.press(recordButton);
    });

    expect(getByText('start failed')).toBeTruthy();
  });
});
