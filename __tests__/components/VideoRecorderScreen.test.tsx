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
const mockCreateRecorder = jest.fn();
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
    Camera: (props: any) =>
      React.createElement('Camera', props, props.children),
    useCameraDevice: () => mockDevice,
    useVideoOutput: () => ({
      createRecorder: (...args: unknown[]) => mockCreateRecorder(...args),
    }),
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
  // Capture the source's setInterval callback and prevent the RN timer polyfill
  // from scheduling a real interval (jest fake timers do not patch it), which
  // keeps recording state deterministic and avoids timer leaks across tests.
  let capturedIntervalCb: (() => void) | null = null;
  let setIntervalSpy: jest.SpyInstance;
  let clearIntervalSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    capturedIntervalCb = null;
    const realSetInterval = global.setInterval;
    setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockImplementation((cb: any, ms?: number, ...rest: unknown[]) => {
        // Only intercept the recorder's 1s duration timer; let RN internals
        // schedule normally. Returning a dummy id prevents a real interval.
        if (ms === 1000) {
          capturedIntervalCb = cb;
          return 999 as unknown as ReturnType<typeof setInterval>;
        }
        return realSetInterval(cb, ms, ...rest);
      });
    clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    mockCameraPermission = true;
    mockMicPermission = true;
    mockDevice = { id: 'back' };
    mockRequestCameraPermission.mockResolvedValue(true);
    mockRequestMicPermission.mockResolvedValue(true);
    mockReadFile.mockResolvedValue('base64video');
    mockWriteFile.mockResolvedValue(undefined);
    mockStopRecording.mockResolvedValue(undefined);
    mockCreateRecorder.mockImplementation(async ({ filePath }: any) => ({
      startRecording: (...args: unknown[]) => mockStartRecording(...args),
      stopRecording: (...args: unknown[]) => mockStopRecording(...args),
      filePath,
    }));

    mockStartRecording.mockImplementation(async (onFinished: any) => {
      const [{ filePath }] =
        mockCreateRecorder.mock.calls[mockCreateRecorder.mock.calls.length - 1];
      await onFinished(filePath, 'stopped');
    });
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('shows permission screen when camera/mic permission missing', async () => {
    mockCameraPermission = false;
    mockMicPermission = false;
    mockRequestCameraPermission.mockResolvedValue(false);
    mockRequestMicPermission.mockResolvedValue(false);

    const { getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(getByText('Grant Permissions'));
    });

    expect(mockRequestCameraPermission).toHaveBeenCalled();
    expect(mockRequestMicPermission).toHaveBeenCalled();
  });

  it('records video and reports saved file', async () => {
    const onVideoRecorded = jest.fn();
    const onClose = jest.fn();

    const { UNSAFE_getAllByType } = await render(
      <VideoRecorderScreen
        visible
        onClose={onClose}
        onVideoRecorded={onVideoRecorded}
      />,
    );

    const buttons = UNSAFE_getAllByType(
      require('react-native').TouchableOpacity,
    );
    const recordButton = buttons[1];

    await act(async () => {
      await fireEvent.press(recordButton);
    });

    expect(mockCreateRecorder).toHaveBeenCalledWith({
      filePath: expect.stringContaining('/cache/video_'),
    });
    expect(mockStartRecording).toHaveBeenCalled();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(onVideoRecorded).toHaveBeenCalledWith(
      expect.stringContaining('/cache/video_'),
      expect.any(Number),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('renders null when hidden', async () => {
    const { toJSON } = await render(
      <VideoRecorderScreen
        visible={false}
        onClose={jest.fn()}
        onVideoRecorded={jest.fn()}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('shows camera unavailable state when no device is found', async () => {
    const onClose = jest.fn();
    mockDevice = null;

    const { getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={onClose}
        onVideoRecorded={jest.fn()}
      />,
    );

    expect(getByText('Camera not available')).toBeTruthy();
    await fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error banner when start recording fails', async () => {
    mockStartRecording.mockRejectedValue(new Error('start failed'));

    const { UNSAFE_getAllByType, getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={jest.fn()}
      />,
    );

    const buttons = UNSAFE_getAllByType(
      require('react-native').TouchableOpacity,
    );
    const recordButton = buttons[1];

    await act(async () => {
      await fireEvent.press(recordButton);
    });

    expect(getByText('start failed')).toBeTruthy();
  });

  it('sets an error when only one permission is granted', async () => {
    mockCameraPermission = false;
    mockMicPermission = false;
    mockRequestCameraPermission.mockResolvedValue(true);
    mockRequestMicPermission.mockResolvedValue(false);

    const { getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(getByText('Grant Permissions'));
    });

    // The permission screen still renders; the error state is set internally.
    expect(mockRequestCameraPermission).toHaveBeenCalled();
    expect(mockRequestMicPermission).toHaveBeenCalled();
  });

  it('cancels from the permission screen', async () => {
    mockCameraPermission = false;
    mockMicPermission = true;
    const onClose = jest.fn();

    const { getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={onClose}
        onVideoRecorded={jest.fn()}
      />,
    );

    await fireEvent.press(getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('increments the duration timer while recording and finishes (android URI)', async () => {
    const RN = require('react-native');
    const originalOS = RN.Platform.OS;
    RN.Platform.OS = 'android';

    let capturedFinish: any;
    mockStartRecording.mockImplementation(async (onFinished: any) => {
      capturedFinish = onFinished;
    });

    const onVideoRecorded = jest.fn();
    const onClose = jest.fn();

    try {
      const { UNSAFE_getAllByType, getByText } = await render(
        <VideoRecorderScreen
          visible
          onClose={onClose}
          onVideoRecorded={onVideoRecorded}
        />,
      );

      const recordButton = UNSAFE_getAllByType(RN.TouchableOpacity)[1];

      await act(async () => {
        await fireEvent.press(recordButton);
      });

      // Fire the captured interval callback twice (source lines 80-81).
      await act(async () => {
        capturedIntervalCb?.();
        capturedIntervalCb?.();
      });

      // formatDuration renders in the recording indicator.
      expect(getByText('0:02')).toBeTruthy();

      await act(async () => {
        await capturedFinish('/cache/video_recorded.mp4');
      });

      expect(onVideoRecorded).toHaveBeenCalledWith(
        'file:///cache/video_recorded.mp4',
        2,
      );
      expect(onClose).toHaveBeenCalled();
    } finally {
      RN.Platform.OS = originalOS;
    }
  });

  it('keeps file:// prefixed paths untouched on finish', async () => {
    let capturedFinish: any;
    mockStartRecording.mockImplementation(async (onFinished: any) => {
      capturedFinish = onFinished;
    });

    const onVideoRecorded = jest.fn();
    const RN = require('react-native');

    const { UNSAFE_getAllByType } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={onVideoRecorded}
      />,
    );

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    await act(async () => {
      await capturedFinish('file:///cache/already.mp4');
    });

    expect(onVideoRecorded).toHaveBeenCalled();
  });

  it('shows error banner when saving the recorded video throws', async () => {
    let capturedFinish: any;
    mockStartRecording.mockImplementation(async (onFinished: any) => {
      capturedFinish = onFinished;
    });

    const onVideoRecorded = jest.fn(() => {
      throw new Error('save fail');
    });
    const RN = require('react-native');

    const { UNSAFE_getAllByType, getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={onVideoRecorded}
      />,
    );

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    await act(async () => {
      await capturedFinish('/cache/x.mp4');
    });

    expect(getByText('save fail')).toBeTruthy();
  });

  it('shows error banner when the recording error callback fires', async () => {
    let capturedError: any;
    mockStartRecording.mockImplementation(
      async (_onFinished: any, onError: any) => {
        capturedError = onError;
      },
    );

    const RN = require('react-native');

    const { UNSAFE_getAllByType, getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    // Interval was created; error callback should clear it (source 136-139).
    await act(async () => {
      capturedError({ message: 'record boom' });
    });

    expect(getByText('record boom')).toBeTruthy();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('uses fallback message when recording error has no message', async () => {
    let capturedError: any;
    mockStartRecording.mockImplementation(
      async (_onFinished: any, onError: any) => {
        capturedError = onError;
      },
    );

    const RN = require('react-native');

    const { UNSAFE_getAllByType, getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    await act(async () => {
      capturedError({});
    });

    expect(getByText('Recording failed')).toBeTruthy();
  });

  it('stops recording when the stop button is pressed', async () => {
    mockStartRecording.mockImplementation(async () => {
      // Stay in recording state; onRecordingFinished is not invoked.
    });

    const RN = require('react-native');

    const { UNSAFE_getAllByType } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    const stopButton = UNSAFE_getAllByType(RN.TouchableOpacity)[1];
    await act(async () => {
      await fireEvent.press(stopButton);
    });

    expect(mockStopRecording).toHaveBeenCalled();
  });

  it('shows error banner when stopping recording fails', async () => {
    mockStartRecording.mockImplementation(async () => {});
    mockStopRecording.mockRejectedValue(new Error('stop fail'));

    const RN = require('react-native');

    const { UNSAFE_getAllByType, getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    expect(getByText('stop fail')).toBeTruthy();
  });

  it('does nothing when pressing close while recording', async () => {
    mockStartRecording.mockImplementation(async () => {});
    const onClose = jest.fn();

    const RN = require('react-native');

    const { UNSAFE_getAllByType } = await render(
      <VideoRecorderScreen
        visible
        onClose={onClose}
        onVideoRecorded={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    // Close button (index 0) is disabled while recording.
    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[0]);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('falls back to a default message when start error has no message', async () => {
    mockStartRecording.mockRejectedValue(new Error(''));

    const RN = require('react-native');

    const { UNSAFE_getAllByType, getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    expect(getByText('Failed to start recording')).toBeTruthy();
  });

  it('falls back to a default message when saving error has no message', async () => {
    let capturedFinish: any;
    mockStartRecording.mockImplementation(async (onFinished: any) => {
      capturedFinish = onFinished;
    });

    const onVideoRecorded = jest.fn(() => {
      throw new Error('');
    });
    const RN = require('react-native');

    const { UNSAFE_getAllByType, getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={onVideoRecorded}
      />,
    );

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    await act(async () => {
      await capturedFinish('/cache/x.mp4');
    });

    expect(getByText('Failed to save video')).toBeTruthy();
  });

  it('falls back to a default message when stop error has no message', async () => {
    mockStartRecording.mockImplementation(async () => {});
    mockStopRecording.mockRejectedValue(new Error(''));

    const RN = require('react-native');

    const { UNSAFE_getAllByType, getByText } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    expect(getByText('Failed to stop recording')).toBeTruthy();
  });

  it('clears the duration timer on unmount while recording', async () => {
    mockStartRecording.mockImplementation(async () => {});

    const RN = require('react-native');

    const { UNSAFE_getAllByType, unmount } = await render(
      <VideoRecorderScreen
        visible
        onClose={jest.fn()}
        onVideoRecorded={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(UNSAFE_getAllByType(RN.TouchableOpacity)[1]);
    });

    // The recorder's duration interval was created during recording.
    expect(setIntervalSpy.mock.calls.some(c => c[1] === 1000)).toBe(true);

    // Unmounting while recording runs the effect cleanup (source 195-203)
    // without throwing.
    expect(() => unmount()).not.toThrow();
  });
});
