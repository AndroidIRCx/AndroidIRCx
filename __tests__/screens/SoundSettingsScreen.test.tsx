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

jest.mock('../../src/i18n/localization', () => ({
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

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    useSoundSettings.mockReturnValue(baseHookState);
    pick.mockResolvedValue([
      { uri: 'file:///tmp/custom.mp3', fileCopyUri: 'file:///tmp/copied.mp3' },
    ]);
  });

  it('renders loading state', async () => {
    useSoundSettings.mockReturnValue({
      ...baseHookState,
      isLoading: true,
    });

    const { UNSAFE_getByType } = await render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    expect(
      UNSAFE_getByType(require('react-native').ActivityIndicator),
    ).toBeTruthy();
  });

  it('renders settings and handles top-level toggles', async () => {
    const { findByText, getAllByRole } = await render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    expect(await findByText('Sound Settings')).toBeTruthy();
    await fireEvent(getAllByRole('switch')[0], 'valueChange', false);
    await fireEvent.press(await findByText('Mock Slider'));
    await fireEvent(getAllByRole('switch')[1], 'valueChange', false);
    await fireEvent(getAllByRole('switch')[2], 'valueChange', true);

    expect(baseHookState.setEnabled).toHaveBeenCalledWith(false);
    expect(baseHookState.setMasterVolume).toHaveBeenCalledWith(0.7);
    expect(baseHookState.setPlayInForeground).toHaveBeenCalledWith(false);
    expect(baseHookState.setPlayInBackground).toHaveBeenCalledWith(true);
  });

  it('changes scheme, previews event sound and toggles category event', async () => {
    const { findByText, getAllByRole, getAllByText } = await render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    await fireEvent.press(await findByText('Quiet'));
    expect(baseHookState.setActiveScheme).toHaveBeenCalledWith('quiet');

    await fireEvent.press(await findByText('Other'));
    await fireEvent(getAllByRole('switch')[4], 'valueChange', false);
    await fireEvent.press(getAllByText('play')[1].parent as any);

    expect(baseHookState.setEventEnabled).toHaveBeenCalledWith('join', false);
    expect(baseHookState.previewSound).toHaveBeenCalled();
  });

  it('picks custom sound and confirms usage', async () => {
    const { findByText, getAllByText } = await render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    await fireEvent.press(await findByText('Other'));
    await fireEvent.press(getAllByText('folder-open')[1].parent as any);

    await waitFor(async () => {
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
    const { findByText, getAllByText } = await render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    await fireEvent.press(await findByText('Other'));
    await fireEvent.press(getAllByText('undo')[0].parent as any);

    let buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    buttons?.[1]?.onPress?.();
    expect(baseHookState.resetEventToDefault).toHaveBeenCalledWith('join');

    await fireEvent.press(await findByText('Reset All to Defaults'));
    buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2];
    buttons?.[1]?.onPress?.();
    expect(baseHookState.resetAllToDefaults).toHaveBeenCalled();
  });

  it('handles file picker error when picking custom sound fails', async () => {
    pick.mockRejectedValue(new Error('boom'));

    const { findByText, getAllByText } = await render(
      <SoundSettingsScreen visible onClose={jest.fn()} />,
    );

    await fireEvent.press(await findByText('Other'));
    await fireEvent.press(getAllByText('folder-open')[1].parent as any);

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to select sound file.',
      );
    });
  });

  describe('custom sounds a script can play by name', () => {
    const withCustomSounds = (overrides: Record<string, unknown> = {}) => {
      const addCustomSound = jest.fn(async () => undefined);
      const renameCustomSound = jest.fn(async () => undefined);
      const removeCustomSound = jest.fn(async () => undefined);
      useSoundSettings.mockReturnValue({
        ...baseHookState,
        customSounds: [{ id: 'c1', name: 'Airhorn', uri: '/tmp/airhorn.mp3' }],
        addCustomSound,
        renameCustomSound,
        removeCustomSound,
        ...overrides,
      });
      return { addCustomSound, renameCustomSound, removeCustomSound };
    };

    it('lists them, and previews one', async () => {
      withCustomSounds();
      const { findByText, getAllByText } = await render(
        <SoundSettingsScreen visible onClose={jest.fn()} />,
      );

      expect(await findByText('Airhorn')).toBeTruthy();
      // The custom-sound list comes after the per-event rows, which have
      // play icons of their own.
      await fireEvent.press(getAllByText('play').at(-1)!);
      expect(baseHookState.previewCustomSound).toHaveBeenCalledWith(
        '/tmp/airhorn.mp3',
      );
    });

    it('names a newly picked file and adds it', async () => {
      const { addCustomSound } = withCustomSounds();
      const RNFS = require('react-native-fs');
      const { getByText, getByPlaceholderText, findByText } = await render(
        <SoundSettingsScreen visible onClose={jest.fn()} />,
      );

      await fireEvent.press(getByText('Add custom sound'));
      expect(await findByText('Name This Sound')).toBeTruthy();

      await fireEvent.changeText(
        getByPlaceholderText('Sound name'),
        'Doorbell',
      );
      await fireEvent.press(getByText('Save'));

      await waitFor(() =>
        expect(addCustomSound).toHaveBeenCalledWith(
          'Doorbell',
          '/tmp/copied.mp3',
        ),
      );
      // The picker's own copy is removed once the sound has been stored.
      await waitFor(() => expect(RNFS.unlink).toHaveBeenCalled());
    });

    it('will not save an empty name', async () => {
      const { addCustomSound } = withCustomSounds();
      const { getByText, findByText } = await render(
        <SoundSettingsScreen visible onClose={jest.fn()} />,
      );

      await fireEvent.press(getByText('Add custom sound'));
      await findByText('Name This Sound');
      await fireEvent.press(getByText('Save'));

      expect(addCustomSound).not.toHaveBeenCalled();
    });

    it('reports a save that fails and keeps the dialog open', async () => {
      withCustomSounds({
        addCustomSound: jest.fn(async () => {
          throw new Error('That name is taken.');
        }),
      });
      const { getByText, getByPlaceholderText, findByText } = await render(
        <SoundSettingsScreen visible onClose={jest.fn()} />,
      );

      await fireEvent.press(getByText('Add custom sound'));
      await findByText('Name This Sound');
      await fireEvent.changeText(
        getByPlaceholderText('Sound name'),
        'Doorbell',
      );
      await fireEvent.press(getByText('Save'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'That name is taken.',
        ),
      );
      expect(await findByText('Name This Sound')).toBeTruthy();
    });

    it('renames an existing sound', async () => {
      const { renameCustomSound } = withCustomSounds();
      const { findByText, getByText, getByPlaceholderText } = await render(
        <SoundSettingsScreen visible onClose={jest.fn()} />,
      );

      await fireEvent.press(await findByText('Airhorn'));
      expect(await findByText('Rename Sound')).toBeTruthy();
      await fireEvent.changeText(getByPlaceholderText('Sound name'), 'Klaxon');
      await fireEvent.press(getByText('Save'));

      await waitFor(() =>
        expect(renameCustomSound).toHaveBeenCalledWith('c1', 'Klaxon'),
      );
    });

    it('cleans up the picked copy when the naming dialog is cancelled', async () => {
      withCustomSounds();
      const RNFS = require('react-native-fs');
      const { getByText, findByText, queryByText } = await render(
        <SoundSettingsScreen visible onClose={jest.fn()} />,
      );

      await fireEvent.press(getByText('Add custom sound'));
      await findByText('Name This Sound');
      await fireEvent.press(getByText('Cancel'));

      await waitFor(() => expect(RNFS.unlink).toHaveBeenCalled());
      await waitFor(() => expect(queryByText('Name This Sound')).toBeNull());
    });

    it('asks before deleting one, and deletes on yes', async () => {
      const { removeCustomSound } = withCustomSounds();
      const { findByText, getAllByText } = await render(
        <SoundSettingsScreen visible onClose={jest.fn()} />,
      );
      await findByText('Airhorn');

      await fireEvent.press(getAllByText('trash').at(-1)!);

      const buttons = (Alert.alert as jest.Mock).mock.calls.at(
        -1,
      )?.[2] as any[];
      await buttons.find(button => button.style === 'destructive').onPress();
      expect(removeCustomSound).toHaveBeenCalledWith('c1');
    });

    it('says so when picking a file fails for a reason other than cancelling', async () => {
      withCustomSounds();
      pick.mockRejectedValueOnce(new Error('no storage permission'));
      const { getByText } = await render(
        <SoundSettingsScreen visible onClose={jest.fn()} />,
      );

      await fireEvent.press(getByText('Add custom sound'));

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to select sound file.',
        ),
      );
    });

    it('stays quiet when the user simply cancelled the picker', async () => {
      withCustomSounds();
      const picker = require('@react-native-documents/picker');
      picker.isErrorWithCode.mockReturnValue(true);
      pick.mockRejectedValueOnce({ code: 'OPERATION_CANCELED' });
      const { getByText } = await render(
        <SoundSettingsScreen visible onClose={jest.fn()} />,
      );

      await fireEvent.press(getByText('Add custom sound'));

      await waitFor(() => expect(pick).toHaveBeenCalled());
      expect(Alert.alert).not.toHaveBeenCalled();
      picker.isErrorWithCode.mockReturnValue(false);
    });

    it('opens no dialog when the picker returns nothing usable', async () => {
      withCustomSounds();
      pick.mockResolvedValueOnce([{}]);
      const { getByText, queryByText } = await render(
        <SoundSettingsScreen visible onClose={jest.fn()} />,
      );

      await fireEvent.press(getByText('Add custom sound'));

      await waitFor(() => expect(pick).toHaveBeenCalled());
      expect(queryByText('Name This Sound')).toBeNull();
    });
  });
});
