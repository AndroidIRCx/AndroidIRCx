/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

describe('BiometricAuthService', () => {
  const loadService = (
    appState = 'active',
    platform: 'android' | 'ios' = 'android',
    keychainOverrides: Record<string, any> = {},
    mockMissingKeychain = false,
  ) => {
    jest.resetModules();

    jest.doMock('react-native', () => ({
      AppState: {
        currentState: appState,
      },
      Platform: {
        OS: platform,
      },
    }));

    if (mockMissingKeychain) {
      jest.doMock('react-native-keychain', () => {
        throw new Error('missing');
      });
    } else {
      jest.doMock('react-native-keychain', () => ({
        getSupportedBiometryType: jest.fn().mockResolvedValue('Fingerprint'),
        getGenericPassword: jest
          .fn()
          .mockResolvedValue({ username: 'androidircx', password: 'unlock' }),
        setGenericPassword: jest.fn().mockResolvedValue(true),
        resetGenericPassword: jest.fn().mockResolvedValue(true),
        ACCESS_CONTROL: {
          BIOMETRY_CURRENT_SET: 'biometry',
        },
        ACCESSIBLE: {
          WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
        },
        AUTHENTICATION_TYPE: {
          DEVICE_PASSCODE_OR_BIOMETRICS: 'device-or-bio',
          BIOMETRICS: 'bio',
        },
        ...keychainOverrides,
      }));
    }

    let biometricAuthService: any;
    jest.isolateModules(() => {
      biometricAuthService =
        require('../../src/services/BiometricAuthService').biometricAuthService;
    });

    return biometricAuthService;
  };

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('exports service instance', () => {
    const biometricAuthService = loadService('active', 'ios');
    expect(biometricAuthService).toBeDefined();
  });

  it('reports unavailable when keychain module is missing', () => {
    const biometricAuthService = loadService('active', 'android', {}, true);
    expect(biometricAuthService.isAvailable()).toBe(false);
  });

  it('checks enrolled biometrics and biometry type', async () => {
    const biometricAuthService = loadService();
    expect(await biometricAuthService.hasEnrolledBiometrics()).toBe(true);
    expect(await biometricAuthService.getBiometryType()).toBe('Fingerprint');
  });

  it('returns false for enrolled biometrics when keychain throws', async () => {
    const biometricAuthService = loadService('active', 'android', {
      getSupportedBiometryType: jest
        .fn()
        .mockRejectedValue(new Error('failed')),
    });

    expect(await biometricAuthService.hasEnrolledBiometrics()).toBe(false);
    expect(await biometricAuthService.getBiometryType()).toBeNull();
  });

  it('enables and disables lock with scoped service', async () => {
    const setGenericPassword = jest.fn().mockResolvedValue(true);
    const resetGenericPassword = jest.fn().mockResolvedValue(true);
    const biometricAuthService = loadService('active', 'android', {
      setGenericPassword,
      resetGenericPassword,
    });

    expect(await biometricAuthService.enableLock('chat')).toBe(true);
    await biometricAuthService.disableLock('chat');

    expect(setGenericPassword).toHaveBeenCalledWith(
      'androidircx',
      'unlock',
      expect.objectContaining({ service: 'androidircx:chat' }),
    );
    expect(resetGenericPassword).toHaveBeenCalledWith({
      service: 'androidircx:chat',
    });
  });

  it('returns unavailable when app is not active before prompt', async () => {
    const biometricAuthService = loadService('background');
    const result = await biometricAuthService.authenticate('Unlock');

    expect(result).toEqual({
      success: false,
      errorKey: 'Authentication unavailable',
      errorMessage:
        'Biometric prompt is only available while the app is active.',
    });
  });

  it('returns generic cancellation-or-missing when keychain returns false', async () => {
    const biometricAuthService = loadService('active', 'ios', {
      getGenericPassword: jest.fn().mockResolvedValue(false),
    });

    const result = await biometricAuthService.authenticate('Unlock');
    expect(result).toEqual({
      success: false,
      errorKey: 'Authentication cancelled or credentials not found',
      errorMessage: undefined,
    });
  });

  it('maps cancellation and current-activity errors', async () => {
    const cancelled = loadService('active', 'ios', {
      getGenericPassword: jest.fn().mockRejectedValue(new Error('User cancel')),
    });
    const currentActivity = loadService('active', 'android', {
      getGenericPassword: jest
        .fn()
        .mockRejectedValue(new Error('Not assigned current activity')),
    });

    await expect(cancelled.authenticate('Unlock')).resolves.toEqual({
      success: false,
      errorKey: 'User cancelled',
      errorMessage: undefined,
    });
    await expect(currentActivity.authenticate('Unlock')).resolves.toEqual({
      success: false,
      errorKey: 'Authentication unavailable',
      errorMessage: 'Biometric prompt is not ready yet. Please try again.',
    });
  });

  it('returns success for valid authentication and maps generic failure', async () => {
    const ok = loadService('active', 'ios');
    const fail = loadService('active', 'ios', {
      getGenericPassword: jest
        .fn()
        .mockRejectedValue(new Error('Bio hardware error')),
    });

    await expect(ok.authenticate('Unlock', 'Now', 'app')).resolves.toEqual({
      success: true,
    });
    await expect(fail.authenticate('Unlock')).resolves.toEqual({
      success: false,
      errorKey: 'Authentication failed',
      errorMessage: 'Bio hardware error',
    });
  });
});
