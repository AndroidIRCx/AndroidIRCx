/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

describe('BiometricAuthService', () => {
  const loadService = (appState = 'active', platform: 'android' | 'ios' = 'android', keychainOverrides: Record<string, any> = {}) => {
    jest.resetModules();

    jest.doMock('react-native', () => ({
      AppState: {
        currentState: appState,
      },
      Platform: {
        OS: platform,
      },
    }));

    jest.doMock('react-native-keychain', () => ({
      getSupportedBiometryType: jest.fn().mockResolvedValue('Fingerprint'),
      getGenericPassword: jest.fn().mockResolvedValue({ username: 'androidircx', password: 'unlock' }),
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

    let biometricAuthService: any;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      biometricAuthService = require('../../src/services/BiometricAuthService').biometricAuthService;
    });

    return biometricAuthService;
  };

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('exports the service', () => {
    const biometricAuthService = loadService();
    expect(biometricAuthService).toBeDefined();
  });

  it('returns authentication unavailable when app is not active', async () => {
    const biometricAuthService = loadService('background');

    const result = await biometricAuthService.authenticate('Unlock');

    expect(result).toEqual({
      success: false,
      errorKey: 'Authentication unavailable',
      errorMessage: 'Biometric prompt is only available while the app is active.',
    });
  });

  it('maps current activity errors to a retryable failure', async () => {
    const biometricAuthService = loadService('active', 'android', {
      getGenericPassword: jest.fn().mockRejectedValue(new Error('Not assigned current activity')),
    });

    const result = await biometricAuthService.authenticate('Unlock');

    expect(result).toEqual({
      success: false,
      errorKey: 'Authentication unavailable',
      errorMessage: 'Biometric prompt is not ready yet. Please try again.',
    });
  });

  it('returns success when keychain authentication succeeds', async () => {
    const biometricAuthService = loadService();

    const result = await biometricAuthService.authenticate('Unlock', 'Authenticate now', 'app');

    expect(result).toEqual({ success: true });
  });

  it('returns cancelled when keychain reports cancellation', async () => {
    const biometricAuthService = loadService('active', 'ios', {
      getGenericPassword: jest.fn().mockRejectedValue(new Error('User cancel')),
    });

    const result = await biometricAuthService.authenticate('Unlock');

    expect(result).toEqual({
      success: false,
      errorKey: 'User cancelled',
      errorMessage: undefined,
    });
  });
});
