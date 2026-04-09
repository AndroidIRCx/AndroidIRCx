/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SoundSettingsScreen } from '../../src/screens/SoundSettingsScreen';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      surface: '#111',
      cardBackground: '#111',
      border: '#333',
      text: '#fff',
      textSecondary: '#bbb',
      primary: '#4caf50',
      primaryLight: '#80e27e',
      error: '#f44336',
      warning: '#ff9800',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('@react-native-community/slider', () => {
  const { Text } = require('react-native');
  return ({ onSlidingComplete }: any) => (
    <Text onPress={() => onSlidingComplete(0.7)}>Mock Slider</Text>
  );
});

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const { Text } = require('react-native');
  return ({ name }: any) => <Text>{name}</Text>;
});

jest.mock('../../src/types/sound', () => ({
  SOUND_EVENT_LABELS: {
    message: 'Message',
    join: 'Join',
  },
  SOUND_EVENT_CATEGORIES: {
    Messages: ['message'],
    Other: ['join'],
  },
  DEFAULT_SOUNDS: {
    message: 'ding',
    join: 'pop',
  },
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  isErrorWithCode: jest.fn(() => false),
  errorCodes: {
    OPERATION_CANCELED: 'OPERATION_CANCELED',
  },
}));

jest.mock('react-native-fs', () => ({
  exists: jest.fn().mockResolvedValue(true),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/hooks/useSoundSettings', () => ({
  useSoundSettings: jest.fn(),
}));

const { pick } = require('@react-native-documents/picker');
const { useSoundSettings } = require('../../src/hooks/useSoundSettings');

describe('SoundSettingsScreen', () => {
  const baseHookState = {
    settings: {
      enabled: true,
      masterVolume: 0.5,
      playInForeground: true,
      playInBackground: false,
    },
    schemes: [
      { id: 'default', name: 'Default', description: 'Default scheme' },
      { id: 'quiet', name: 'Quiet', description: 'Quiet scheme' },
    ],
    activeScheme: { id: 'default', name: 'Default' },
    isLoading: false,
    setEnabled: jest.fn(),
    setMasterVolume: jest.fn(),
    setPlayInForeground: jest.fn(),
    setPlayInBackground: jest.fn(),
    setActiveScheme: jest.fn(),
    setEventEnabled: jest.fn(),
    setCustomSound: jest.fn(),
    resetEventToDefault: jest.fn(),
    getEventConfig: jest.fn((eventType: string) => ({
      enabled: true,
      useCustom: eventType === 'join',
      customUri: eventType === 'join' ? '/tmp/join.mp3' : undefined,
    })),
    previewSound: jest.fn(),
    previewCustomSound: jest.fn().mockResolvedValue(undefined),
    stopSound: jest.fn().mockResolvedValue(undefined),
    resetAllToDefaults: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    useSoundSettings.mockReturnValue(baseHookState);
    pick.mockResolvedValue([
      { uri: 'file:///tmp/custom.mp3', fileCopyUri: 'file:///tmp/copied.mp3' },
    ]);
  });

  it('renders loading state', () => {
    useSoundSettings.mockReturnValue({
      ...baseHookState,
      isLoading: true,
    });

    const { UNSAFE_getByType } = render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    expect(
      UNSAFE_getByType(require('react-native').ActivityIndicator),
    ).toBeTruthy();
  });

  it('renders settings and handles top-level toggles', async () => {
    const { findByText, getAllByRole } = render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    expect(await findByText('Sound Settings')).toBeTruthy();
    fireEvent(getAllByRole('switch')[0], 'valueChange', false);
    fireEvent.press(await findByText('Mock Slider'));
    fireEvent(getAllByRole('switch')[1], 'valueChange', false);
    fireEvent(getAllByRole('switch')[2], 'valueChange', true);

    expect(baseHookState.setEnabled).toHaveBeenCalledWith(false);
    expect(baseHookState.setMasterVolume).toHaveBeenCalledWith(0.7);
    expect(baseHookState.setPlayInForeground).toHaveBeenCalledWith(false);
    expect(baseHookState.setPlayInBackground).toHaveBeenCalledWith(true);
  });

  it('changes scheme, previews event sound and toggles category event', async () => {
    const { findByText, getAllByRole, getAllByText } = render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    fireEvent.press(await findByText('Quiet'));
    expect(baseHookState.setActiveScheme).toHaveBeenCalledWith('quiet');

    fireEvent.press(await findByText('Other'));
    fireEvent(getAllByRole('switch')[4], 'valueChange', false);
    fireEvent.press(getAllByText('play')[1].parent as any);

    expect(baseHookState.setEventEnabled).toHaveBeenCalledWith('join', false);
    expect(baseHookState.previewSound).toHaveBeenCalled();
  });

  it('picks custom sound and confirms usage', async () => {
    const { findByText, getAllByText } = render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    fireEvent.press(await findByText('Other'));
    fireEvent.press(getAllByText('folder-open')[1].parent as any);

    await waitFor(() => {
      expect(baseHookState.previewCustomSound).toHaveBeenCalledWith(
        'file:///tmp/copied.mp3',
      );
    });

    const confirmButtons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    await confirmButtons?.[1]?.onPress?.();

    expect(baseHookState.setCustomSound).toHaveBeenCalledWith(
      'join',
      '/tmp/copied.mp3',
    );
    expect(baseHookState.stopSound).toHaveBeenCalled();
  });

  it('resets individual and all sounds through confirmation alerts', async () => {
    const { findByText, getAllByText } = render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    fireEvent.press(await findByText('Other'));
    fireEvent.press(getAllByText('undo')[0].parent as any);

    let buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    buttons?.[1]?.onPress?.();
    expect(baseHookState.resetEventToDefault).toHaveBeenCalledWith('join');

    fireEvent.press(await findByText('Reset All to Defaults'));
    buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    buttons?.[1]?.onPress?.();
    expect(baseHookState.resetAllToDefaults).toHaveBeenCalled();
  });

  it('handles file picker error when picking custom sound fails', async () => {
    pick.mockRejectedValue(new Error('boom'));

    const { findByText, getAllByText } = render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    fireEvent.press(await findByText('Other'));
    fireEvent.press(getAllByText('folder-open')[1].parent as any);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to select sound file.',
      );
    });
  });
});
