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
    getPredefinedReasons: (...args: unknown[]) => mockGetPredefinedReasons(...args),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  NEW_FEATURE_DEFAULTS: { defaultBanType: 2 },
  settingsService: {
    getSetting: (...args: unknown[]) => mockGetSetting(...args),
  },
}));

const colors = {
  background: '#111',
  text: '#fff',
  accent: '#08f',
  border: '#333',
  inputBackground: '#222',
};

describe('KickBanModal', () => {
  beforeEach(() => {
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
    const { getByText } = render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        nick="baduser"
        mode="kickban"
        userHost="ident@example.com"
        colors={colors}
      />
    );

    await act(async () => {
      fireEvent.press(getByText('Confirm'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a reason for the action.');
  });

  it('uses quick reason and confirms kick/ban payload', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { getByText } = render(
      <KickBanModal
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        nick="baduser"
        mode="kickban"
        userHost="ident@example.com"
        colors={colors}
      />
    );

    fireEvent.press(getByText('Spamming'));

    await act(async () => {
      fireEvent.press(getByText('Confirm'));
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
    const { getByText, getByPlaceholderText, getByRole } = render(
      <KickBanModal
        visible
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        nick="baduser"
        mode="ban"
        userHost="ident@example.com"
        colors={colors}
      />
    );

    fireEvent.changeText(getByPlaceholderText('Enter reason...'), 'reason');
    fireEvent(getByRole('switch'), 'valueChange', true);

    fireEvent.changeText(getByPlaceholderText('Time'), '0');
    await act(async () => {
      fireEvent.press(getByText('Confirm'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid time value.');
  });
});
