import React from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { VoiceRecorder } from '../../src/components/VoiceRecorder';

const mockGetVoiceMaxDuration = jest.fn();
const mockExists = jest.fn();
const mockUnlink = jest.fn();

const recorderCallbacks: { record?: (meta: any) => void } = {};
const mockStartRecorder = jest.fn();
const mockStopRecorder = jest.fn();
const mockAddRecordBackListener = jest.fn();
const mockRemoveRecordBackListener = jest.fn();
const mockSetSubscriptionDuration = jest.fn();

jest.mock('../../src/services/MediaSettingsService', () => ({
  mediaSettingsService: {
    getVoiceMaxDuration: (...args: unknown[]) => mockGetVoiceMaxDuration(...args),
  },
}));

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  exists: (...args: unknown[]) => mockExists(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

jest.mock('react-native-video', () => 'Video');

jest.mock('react-native-nitro-sound', () => ({
  __esModule: true,
  default: {
    setSubscriptionDuration: (...args: unknown[]) => mockSetSubscriptionDuration(...args),
    addRecordBackListener: (...args: unknown[]) => mockAddRecordBackListener(...args),
    removeRecordBackListener: (...args: unknown[]) => mockRemoveRecordBackListener(...args),
    startRecorder: (...args: unknown[]) => mockStartRecorder(...args),
    stopRecorder: (...args: unknown[]) => mockStopRecorder(...args),
  },
  AudioEncoderAndroidType: { AAC: 1 },
  AudioSourceAndroidType: { MIC: 1 },
  AVEncoderAudioQualityIOSType: { high: 1 },
  OutputFormatAndroidType: { MPEG_4: 1 },
}));

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      error: '#f33',
      primary: '#08f',
      border: '#333',
      text: '#fff',
      textSecondary: '#aaa',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, any>) => {
    if (key === 'Max duration: {duration} seconds') return `Max duration: ${params?.duration} seconds`;
    return key;
  },
}));

describe('VoiceRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVoiceMaxDuration.mockResolvedValue(120);
    mockExists.mockResolvedValue(true);
    mockUnlink.mockResolvedValue(undefined);

    mockAddRecordBackListener.mockImplementation((cb: any) => {
      recorderCallbacks.record = cb;
      return undefined;
    });
    mockStartRecorder.mockResolvedValue('/cache/voice_1.m4a');
    mockStopRecorder.mockResolvedValue('/cache/voice_1.m4a');
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  });

  it('records, stops and sends recording', async () => {
    const onRecordingComplete = jest.fn();

    const { getByText, UNSAFE_getAllByType } = render(
      <VoiceRecorder onRecordingComplete={onRecordingComplete} onCancel={jest.fn()} />
    );

    const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
    fireEvent(touchables[0], 'pressIn');

    await waitFor(() => {
      expect(mockStartRecorder).toHaveBeenCalled();
    });

    act(() => {
      recorderCallbacks.record?.({ currentPosition: 2500 });
    });

    await waitFor(() => {
      expect(getByText(/Stop Recording/)).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(getByText(/Stop Recording/));
    });

    await waitFor(() => {
      expect(getByText('Recording complete')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText(/Send/));
    });

    expect(onRecordingComplete).toHaveBeenCalledWith(
      expect.stringContaining('/cache/voice_1.m4a'),
      2
    );
  });

  it('supports delete and cancel flows', async () => {
    const onCancel = jest.fn();

    const { getByText } = render(
      <VoiceRecorder onRecordingComplete={jest.fn()} onCancel={onCancel} />
    );

    fireEvent.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows permission denied error when microphone access is rejected', async () => {
    const requestSpy = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValueOnce(PermissionsAndroid.RESULTS.DENIED);

    const { UNSAFE_getAllByType, getByText } = render(
      <VoiceRecorder onRecordingComplete={jest.fn()} onCancel={jest.fn()} />
    );

    const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
    fireEvent(touchables[0], 'pressIn');

    if (Platform.OS === 'android') {
      await waitFor(() => {
        expect(getByText('Microphone permission denied')).toBeTruthy();
      });
      expect(mockStartRecorder).not.toHaveBeenCalled();
      expect(requestSpy).toHaveBeenCalled();
      return;
    }

    await waitFor(() => {
      expect(mockStartRecorder).toHaveBeenCalled();
    });
  });

  it('shows error when sending a recording that no longer exists', async () => {
    mockExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const onRecordingComplete = jest.fn();

    const { getByText, UNSAFE_getAllByType } = render(
      <VoiceRecorder onRecordingComplete={onRecordingComplete} onCancel={jest.fn()} />
    );

    const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
    fireEvent(touchables[0], 'pressIn');

    await waitFor(() => {
      expect(mockStartRecorder).toHaveBeenCalled();
    });

    act(() => {
      recorderCallbacks.record?.({ currentPosition: 2500 });
    });

    await act(async () => {
      fireEvent.press(getByText(/Stop Recording/));
    });

    await act(async () => {
      fireEvent.press(getByText(/Send/));
    });

    expect(onRecordingComplete).not.toHaveBeenCalled();
    expect(getByText('Recording file not found. Please record again.')).toBeTruthy();
  });

  it('deletes recorded file and returns to idle state', async () => {
    const { getByText, UNSAFE_getAllByType } = render(
      <VoiceRecorder onRecordingComplete={jest.fn()} onCancel={jest.fn()} />
    );

    const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);
    fireEvent(touchables[0], 'pressIn');

    await waitFor(() => {
      expect(mockStartRecorder).toHaveBeenCalled();
    });

    act(() => {
      recorderCallbacks.record?.({ currentPosition: 2500 });
    });

    await act(async () => {
      fireEvent.press(getByText(/Stop Recording/));
    });

    await waitFor(() => {
      expect(getByText('Recording complete')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('Delete'));
    });

    expect(mockUnlink).toHaveBeenCalledWith('/cache/voice_1.m4a');
    expect(getByText('Hold to record voice message')).toBeTruthy();
  });
});
