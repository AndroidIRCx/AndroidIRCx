/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useAppLockActions hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useAppLockActions } from '../../src/hooks/useAppLockActions';

describe('useAppLockActions', () => {
  const mockSafeAlert = jest.fn();
  const mockAttemptBiometricUnlock = jest.fn();
  const mockSetAppLocked = jest.fn();
  const mockSetAppUnlockModalVisible = jest.fn();
  const mockT = jest.fn((key: string) => key);

  const defaultProps = {
    appLockEnabled: true,
    appLockUseBiometric: false,
    appLocked: false,
    attemptBiometricUnlock: mockAttemptBiometricUnlock,
    safeAlert: mockSafeAlert,
    t: mockT,
    setAppLocked: mockSetAppLocked,
    setAppUnlockModalVisible: mockSetAppUnlockModalVisible,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return handleLockButtonPress function', () => {
    const { result } = renderHook(() => useAppLockActions(defaultProps));

    expect(result.current.handleLockButtonPress).toBeDefined();
    expect(typeof result.current.handleLockButtonPress).toBe('function');
  });

  it('should show alert when app lock is disabled', () => {
    const { result } = renderHook(() =>
      useAppLockActions({ ...defaultProps, appLockEnabled: false }),
    );

    act(() => {
      result.current.handleLockButtonPress();
    });

    expect(mockSafeAlert).toHaveBeenCalledWith(
      'App lock disabled',
      'Enable app lock first.',
    );
    expect(mockSetAppLocked).not.toHaveBeenCalled();
  });

  it('should lock app when unlocked', () => {
    const { result } = renderHook(() =>
      useAppLockActions({ ...defaultProps, appLocked: false }),
    );

    act(() => {
      result.current.handleLockButtonPress();
    });

    expect(mockSetAppLocked).toHaveBeenCalledWith(true);
    expect(mockSetAppUnlockModalVisible).toHaveBeenCalledWith(true);
  });

  it('should trigger biometric unlock when locked and biometric is enabled', () => {
    const { result } = renderHook(() =>
      useAppLockActions({
        ...defaultProps,
        appLocked: true,
        appLockUseBiometric: true,
      }),
    );

    act(() => {
      result.current.handleLockButtonPress();
    });

    expect(mockAttemptBiometricUnlock).toHaveBeenCalledWith(true);
    expect(mockSetAppUnlockModalVisible).not.toHaveBeenCalled();
  });

  it('should show unlock modal when locked and biometric is disabled', () => {
    const { result } = renderHook(() =>
      useAppLockActions({
        ...defaultProps,
        appLocked: true,
        appLockUseBiometric: false,
      }),
    );

    act(() => {
      result.current.handleLockButtonPress();
    });

    expect(mockSetAppUnlockModalVisible).toHaveBeenCalledWith(true);
    expect(mockAttemptBiometricUnlock).not.toHaveBeenCalled();
  });

  it('should use t function for translations', () => {
    const { result } = renderHook(() =>
      useAppLockActions({ ...defaultProps, appLockEnabled: false }),
    );

    act(() => {
      result.current.handleLockButtonPress();
    });

    expect(mockT).toHaveBeenCalledWith('App lock disabled', expect.any(Object));
    expect(mockT).toHaveBeenCalledWith(
      'Enable app lock first.',
      expect.any(Object),
    );
  });
});
