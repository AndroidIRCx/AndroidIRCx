import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import KickBanModal from '../../src/components/KickBanModal';

const mockGenerateBanMask = jest.fn();
const mockGetPredefinedReasons = jest.fn();
const mockGetSetting = jest.fn();

jest.mock('../../src/services/BanService', () => ({
  BAN_MASK_TYPES: [
    { id: 0, description: 'nick!*@*' },
    { id: 2, description: '*!*@host' },
  ],
  banService: {
    generateBanMask: (...args: unknown[]) => mockGenerateBanMask(...args),
    getPredefinedReasons: (...args: unknown[]) =>
      mockGetPredefinedReasons(...args),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  NEW_FEATURE_DEFAULTS: { defaultBanType: 2 },
  settingsService: {
    getSetting: (...args: unknown[]) => mockGetSetting(...args),
  },
}));

// Render each Picker.Item as a pressable Text so tests can drive
// onValueChange by pressing the item's label.
jest.mock('@react-native-picker/picker', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');
  const Picker = ({ onValueChange, children }: any) =>
    ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.Children.map(children, (child: any) =>
        child
          ? ReactModule.createElement(
              Text,
              { onPress: () => onValueChange(child.props.value) },
              child.props.label,
            )
          : null,
      ),
    );
  Picker.Item = ({ label }: any) =>
    ReactModule.createElement(Text, null, label);
  return { Picker };
});

const colors = {
  background: '#111',
  text: '#fff',
  accent: '#08f',
  border: '#333',
  inputBackground: '#222',
};

describe('KickBanModal', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockGenerateBanMask.mockReturnValue('*!*@example.com');
    mockGetPredefinedReasons.mockReturnValue([
      { id: 'spam', text: 'Spamming' },
      { id: 'abuse', text: 'Abusive behavior' },
    ]);
    mockGetSetting.mockResolvedValue(2);
  });

  it('shows validation error when reason is empty', async () => {
    const { getByText } = await render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        nick="baduser"
        mode="kickban"
        userHost="ident@example.com"
        colors={colors}
      />,
    );

    await act(async () => {
      await fireEvent.press(getByText('Confirm'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter a reason for the action.',
    );
  });

  it('uses quick reason and confirms kick/ban payload', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { getByText } = await render(
      <KickBanModal
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        nick="baduser"
        mode="kickban"
        userHost="ident@example.com"
        colors={colors}
      />,
    );

    await fireEvent.press(getByText('Spamming'));

    await act(async () => {
      await fireEvent.press(getByText('Confirm'));
    });

    expect(onConfirm).toHaveBeenCalledWith({
      reason: 'Spamming',
      banType: 2,
      kick: true,
      ban: true,
      unbanAfterSeconds: undefined,
    });
    expect(onClose).toHaveBeenCalled();
    expect(getByText('*!*@example.com')).toBeTruthy();
  });

  it('validates timed unban value', async () => {
    const { getByText, getByPlaceholderText, getByRole } = await render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        nick="baduser"
        mode="ban"
        userHost="ident@example.com"
        colors={colors}
      />,
    );

    await fireEvent.changeText(
      getByPlaceholderText('Enter reason...'),
      'reason',
    );
    await fireEvent(getByRole('switch'), 'valueChange', true);

    await fireEvent.changeText(getByPlaceholderText('Time'), '0');
    await act(async () => {
      await fireEvent.press(getByText('Confirm'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter a valid time value.',
    );
  });

  it('confirms with a seconds-based unban timer', async () => {
    const onConfirm = jest.fn();
    const { getByText, getByPlaceholderText, getByRole } = await render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
        nick="baduser"
        mode="ban"
        userHost="ident@example.com"
        colors={colors}
      />,
    );

    await fireEvent.changeText(getByPlaceholderText('Enter reason...'), 'spam');
    await fireEvent(getByRole('switch'), 'valueChange', true);
    await fireEvent.changeText(getByPlaceholderText('Time'), '30');

    await act(async () => {
      await fireEvent.press(getByText('Confirm'));
    });

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ unbanAfterSeconds: 30 }),
    );
  });

  it('confirms with a minutes-based unban timer', async () => {
    const onConfirm = jest.fn();
    const { getByText, getByPlaceholderText, getByRole } = await render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
        nick="baduser"
        mode="ban"
        userHost="ident@example.com"
        colors={colors}
      />,
    );

    await fireEvent.changeText(getByPlaceholderText('Enter reason...'), 'spam');
    await fireEvent(getByRole('switch'), 'valueChange', true);
    await fireEvent.changeText(getByPlaceholderText('Time'), '2');
    await fireEvent.press(getByText('minutes'));

    await act(async () => {
      await fireEvent.press(getByText('Confirm'));
    });

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ unbanAfterSeconds: 120 }),
    );
  });

  it('confirms with an hours-based unban timer', async () => {
    const onConfirm = jest.fn();
    const { getByText, getByPlaceholderText, getByRole } = await render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
        nick="baduser"
        mode="ban"
        userHost="ident@example.com"
        colors={colors}
      />,
    );

    await fireEvent.changeText(getByPlaceholderText('Enter reason...'), 'spam');
    await fireEvent(getByRole('switch'), 'valueChange', true);
    await fireEvent.changeText(getByPlaceholderText('Time'), '1');
    await fireEvent.press(getByText('hours'));

    await act(async () => {
      await fireEvent.press(getByText('Confirm'));
    });

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ unbanAfterSeconds: 3600 }),
    );
  });

  it('changes the ban type through the picker', async () => {
    const onConfirm = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
        nick="baduser"
        mode="ban"
        userHost="ident@example.com"
        colors={colors}
      />,
    );

    await fireEvent.changeText(getByPlaceholderText('Enter reason...'), 'spam');
    // Select the "0 - nick!*@*" ban type item exposed by the mocked Picker.
    await fireEvent.press(getByText('0 - nick!*@*'));

    await act(async () => {
      await fireEvent.press(getByText('Confirm'));
    });

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ banType: 0 }),
    );
  });

  it('shows a fetching message and no preview when userHost is absent', async () => {
    const { getByText, queryByText } = await render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        nick="baduser"
        mode="kick"
        colors={colors}
      />,
    );

    expect(getByText('Fetching user info...')).toBeTruthy();
    expect(getByText('Kick: baduser')).toBeTruthy();
    // No user/host means no ban mask preview is generated.
    expect(mockGenerateBanMask).not.toHaveBeenCalled();
    expect(queryByText('*!*@example.com')).toBeNull();
  });

  it('renders the ban-only title and confirms a ban-only payload', async () => {
    const onConfirm = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
        nick="baduser"
        mode="ban"
        userHost="ident@example.com"
        colors={colors}
      />,
    );

    expect(getByText('Ban: baduser')).toBeTruthy();
    await fireEvent.changeText(getByPlaceholderText('Enter reason...'), 'spam');

    await act(async () => {
      await fireEvent.press(getByText('Confirm'));
    });

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ kick: false, ban: true }),
    );
  });

  it('renders the kick title and confirms a kick-only payload', async () => {
    const onConfirm = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={onConfirm}
        nick="baduser"
        mode="kick"
        userHost="ident@example.com"
        colors={colors}
      />,
    );

    expect(getByText('Kick: baduser')).toBeTruthy();
    await fireEvent.changeText(getByPlaceholderText('Enter reason...'), 'spam');

    await act(async () => {
      await fireEvent.press(getByText('Confirm'));
    });

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ kick: true, ban: false }),
    );
  });

  it('resets the form when the modal is closed', async () => {
    const {
      getByPlaceholderText,
      getByRole,
      queryByPlaceholderText,
      rerender,
    } = await render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        nick="baduser"
        mode="ban"
        userHost="ident@example.com"
        colors={colors}
      />,
    );

    await fireEvent.changeText(getByPlaceholderText('Enter reason...'), 'spam');
    await fireEvent(getByRole('switch'), 'valueChange', true);
    // Timer input is visible while the toggle is on.
    expect(getByPlaceholderText('Time')).toBeTruthy();

    // Closing the modal triggers the reset effect.
    await act(async () => {
      rerender(
        <KickBanModal
          visible={false}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          nick="baduser"
          mode="ban"
          userHost="ident@example.com"
          colors={colors}
        />,
      );
    });

    // Reopen and confirm the reason/timer were cleared.
    await act(async () => {
      rerender(
        <KickBanModal
          visible
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          nick="baduser"
          mode="ban"
          userHost="ident@example.com"
          colors={colors}
        />,
      );
    });

    expect(getByPlaceholderText('Enter reason...').props.value).toBe('');
    expect(queryByPlaceholderText('Time')).toBeNull();
  });
});
