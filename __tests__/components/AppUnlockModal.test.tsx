/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AppUnlockModal } from '../../src/components/AppUnlockModal';

// Mock vector icons
jest.mock('react-native-vector-icons/FontAwesome5', () => {
  return ({ name, size, color }: any) => (
    <icon name={name} size={size} color={color} />
  );
});

// Mock useSettingsSecurity
jest.mock('../../src/hooks/useSettingsSecurity', () => ({
  useSettingsSecurity: () => ({
    killSwitchCustomName: 'Emergency Clear',
    killSwitchCustomIcon: 'trash',
    killSwitchCustomColor: '#ff0000',
  }),
}));

describe('AppUnlockModal', () => {
  const mockStyles = {
    lockOverlay: { flex: 1 },
    modalContent: { padding: 20 },
    modalTitle: { fontSize: 20 },
    modalInput: { borderWidth: 1 },
    modalButtons: { flexDirection: 'row' },
    modalButton: { padding: 10 },
    modalButtonJoin: { backgroundColor: '#007AFF' },
    modalButtonText: { color: '#000' },
    modalButtonTextPrimary: { color: '#fff' },
    optionText: { fontSize: 14 },
    killSwitchButton: { borderWidth: 1, padding: 10 },
    killSwitchText: { fontSize: 14 },
  };

  const mockColors = {
    error: '#ff0000',
  };

  const defaultProps = {
    visible: true,
    useBiometric: true,
    usePin: true,
    pinEntry: '',
    pinError: '',
    onChangePinEntry: jest.fn(),
    onClearPinError: jest.fn(),
    onBiometricUnlock: jest.fn(),
    onPinUnlock: jest.fn(),
    onKillSwitch: jest.fn(),
    colors: mockColors,
    styles: mockStyles,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when visible', () => {
    const { getByText } = render(<AppUnlockModal {...defaultProps} />);
    expect(getByText('App Locked')).toBeTruthy();
  });

  it('should render PIN input when usePin is true', () => {
    const { UNSAFE_getByType } = render(<AppUnlockModal {...defaultProps} />);
    const textInput = UNSAFE_getByType('TextInput');
    expect(textInput).toBeTruthy();
    expect(textInput.props.placeholder).toBe('Enter PIN');
  });

  it('should not render PIN input when usePin is false', () => {
    const { UNSAFE_root } = render(
      <AppUnlockModal {...defaultProps} usePin={false} />,
    );
    const textInputs = UNSAFE_root.findAllByType('TextInput');
    expect(textInputs.length).toBe(0);
  });

  it('should render biometric button when useBiometric is true', () => {
    const { getByText } = render(<AppUnlockModal {...defaultProps} />);
    expect(getByText('Use Biometrics')).toBeTruthy();
  });

  it('should not render biometric button when useBiometric is false', () => {
    const { queryByText } = render(
      <AppUnlockModal {...defaultProps} useBiometric={false} />,
    );
    expect(queryByText('Use Biometrics')).toBeNull();
  });

  it('should render unlock button when usePin is true', () => {
    const { getByText } = render(<AppUnlockModal {...defaultProps} />);
    expect(getByText('Unlock')).toBeTruthy();
  });

  it('should call onBiometricUnlock when biometric button pressed', () => {
    const { getByText } = render(<AppUnlockModal {...defaultProps} />);
    fireEvent.press(getByText('Use Biometrics'));
    expect(defaultProps.onBiometricUnlock).toHaveBeenCalledWith(true);
  });

  it('should clear pin error before biometric retry', () => {
    const { getByText } = render(
      <AppUnlockModal {...defaultProps} pinError="Try again" />,
    );
    fireEvent.press(getByText('Use Biometrics'));
    expect(defaultProps.onClearPinError).toHaveBeenCalled();
    expect(defaultProps.onBiometricUnlock).toHaveBeenCalledWith(true);
  });

  it('should call onPinUnlock when unlock button pressed', () => {
    const { getByText } = render(<AppUnlockModal {...defaultProps} />);
    fireEvent.press(getByText('Unlock'));
    expect(defaultProps.onPinUnlock).toHaveBeenCalled();
  });

  it('should call onChangePinEntry when PIN is entered', () => {
    const { UNSAFE_getByType } = render(<AppUnlockModal {...defaultProps} />);
    const textInput = UNSAFE_getByType('TextInput');
    fireEvent.changeText(textInput, '1234');
    expect(defaultProps.onChangePinEntry).toHaveBeenCalledWith('1234');
  });

  it('should sanitize PIN input to only allow numbers', () => {
    const { UNSAFE_getByType } = render(<AppUnlockModal {...defaultProps} />);
    const textInput = UNSAFE_getByType('TextInput');
    fireEvent.changeText(textInput, '12ab34');
    expect(defaultProps.onChangePinEntry).toHaveBeenCalledWith('1234');
  });

  it('should show PIN error message when pinError is provided', () => {
    const { getByText } = render(
      <AppUnlockModal {...defaultProps} pinError="Invalid PIN" />,
    );
    expect(getByText('Invalid PIN')).toBeTruthy();
  });

  it('should call onClearPinError when PIN input changes', () => {
    const { UNSAFE_getByType } = render(
      <AppUnlockModal {...defaultProps} pinError="Invalid PIN" />,
    );
    const textInput = UNSAFE_getByType('TextInput');
    fireEvent.changeText(textInput, '1234');
    expect(defaultProps.onClearPinError).toHaveBeenCalled();
  });

  it('should render kill switch button when onKillSwitch is provided', () => {
    const { getByText } = render(<AppUnlockModal {...defaultProps} />);
    expect(getByText('Emergency Clear')).toBeTruthy();
  });

  it('should not render kill switch button when onKillSwitch is not provided', () => {
    const { queryByText } = render(
      <AppUnlockModal {...defaultProps} onKillSwitch={undefined} />,
    );
    expect(queryByText('Emergency Clear')).toBeNull();
  });

  it('should call onKillSwitch when kill switch button pressed', () => {
    const { getByText } = render(<AppUnlockModal {...defaultProps} />);
    fireEvent.press(getByText('Emergency Clear'));
    expect(defaultProps.onKillSwitch).toHaveBeenCalled();
  });

  it('should have secureTextEntry on PIN input', () => {
    const { UNSAFE_getByType } = render(<AppUnlockModal {...defaultProps} />);
    const textInput = UNSAFE_getByType('TextInput');
    expect(textInput.props.secureTextEntry).toBe(true);
  });

  it('should have numeric keyboard type on PIN input', () => {
    const { UNSAFE_getByType } = render(<AppUnlockModal {...defaultProps} />);
    const textInput = UNSAFE_getByType('TextInput');
    expect(textInput.props.keyboardType).toBe('numeric');
  });

  it('should display correct kill switch icon', () => {
    const { UNSAFE_getByType } = render(<AppUnlockModal {...defaultProps} />);
    const icon = UNSAFE_getByType('icon');
    expect(icon.props.name).toBe('trash');
    expect(icon.props.color).toBe('#ff0000');
  });
});
