/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useAppLock hook - Wave 4
 */

import { renderHook, act, cleanup } from '@testing-library/react-native';
import { AppState } from 'react-native';

// Mock service dependencies
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest
      .fn()
      .mockImplementation((key, defaultValue) => Promise.resolve(defaultValue)),
    setSetting: jest.fn().mockResolvedValue(undefined),
    onSettingChange: jest.fn().mockReturnValue(jest.fn()),
  },
}));

jest.mock('../../src/services/BiometricAuthService', () => ({
  biometricAuthService: {
    isAvailable: jest.fn().mockReturnValue(true),
    hasEnrolledBiometrics: jest.fn().mockResolvedValue(true),
    authenticate: jest.fn().mockResolvedValue({ success: true }),
    enableLock: jest.fn().mockResolvedValue(true),
    disableLock: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    getSecret: jest.fn().mockResolvedValue(null),
    setSecret: jest.fn().mockResolvedValue(undefined),
  },
}));

// Import mocked services
import { settingsService } from '../../src/services/SettingsService';
import { biometricAuthService } from '../../src/services/BiometricAuthService';
import { secureStorageService } from '../../src/services/SecureStorageService';

// Mock Zustand store - SIMPLIFIED APPROACH
const mockStore = {
  appLockEnabled: false,
  appLockOnBackground: true,
  appLockOnLaunch: true,
  appLocked: false,
  appLockUseBiometric: false,
  appLockAutoBiometricPrompt: false,
  appLockUsePin: false,
  appUnlockModalVisible: false,
  appPinEntry: '',
  setAppLocked: jest.fn(),
  setAppUnlockModalVisible: jest.fn(),
  setAppLockEnabled: jest.fn(),
  setAppLockUseBiometric: jest.fn(),
  setAppLockAutoBiometricPrompt: jest.fn(),
  setAppLockUsePin: jest.fn(),
  setAppLockOnLaunch: jest.fn(),
  setAppLockOnBackground: jest.fn(),
  setAppPinEntry: jest.fn(),
  setAppPinError: jest.fn(),
};

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: Object.assign(
    jest.fn(selector => selector(mockStore)),
    { getState: jest.fn(() => mockStore) },
  ),
}));

// Import the hook after mocks are set up
import { useAppLock } from '../../src/hooks/useAppLock';

describe('useAppLock', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (settingsService.getSetting as jest.Mock).mockImplementation(
      (_key, defaultValue) => Promise.resolve(defaultValue),
    );
    (settingsService.setSetting as jest.Mock).mockResolvedValue(undefined);
    (settingsService.onSettingChange as jest.Mock).mockReturnValue(jest.fn());
    (biometricAuthService.isAvailable as jest.Mock).mockReturnValue(true);
    (biometricAuthService.hasEnrolledBiometrics as jest.Mock).mockResolvedValue(
      true,
    );
    (biometricAuthService.authenticate as jest.Mock).mockResolvedValue({
      success: true,
    });
    (biometricAuthService.enableLock as jest.Mock).mockResolvedValue(true);
    (biometricAuthService.disableLock as jest.Mock).mockResolvedValue(true);
    (secureStorageService.getSecret as jest.Mock).mockResolvedValue(null);
    (secureStorageService.setSecret as jest.Mock).mockResolvedValue(undefined);
    // Reset mock store state
    Object.keys(mockStore).forEach(key => {
      if (typeof mockStore[key] === 'boolean') {
        mockStore[key] = false;
      } else if (typeof mockStore[key] === 'string') {
        mockStore[key] = '';
      } else if (typeof mockStore[key] === 'function') {
        mockStore[key].mockClear?.();
      }
    });
    // Set defaults
    mockStore.appLockOnBackground = true;
    mockStore.appLockOnLaunch = true;
  });

  afterEach(async () => {
    jest.useRealTimers();
    cleanup();
    // Restore module-level spies (e.g. AppState.addEventListener) so the
    // jest.setup.ts default mock is in place for the next test's spyOn call.
    jest.restoreAllMocks();
  });

  it('should return attemptBiometricUnlock and handleAppPinUnlock functions', async () => {
    const { result } = await renderHook(() => useAppLock());

    expect(result.current.attemptBiometricUnlock).toBeDefined();
    expect(result.current.handleAppPinUnlock).toBeDefined();
    expect(typeof result.current.attemptBiometricUnlock).toBe('function');
    expect(typeof result.current.handleAppPinUnlock).toBe('function');
  });

  it('should load app lock settings on mount', async () => {
    await renderHook(() => useAppLock());

    // Wait for async useEffect
    await act(async () => {
      await Promise.resolve();
    });

    // Should query settings
    expect(settingsService.getSetting).toHaveBeenCalledWith(
      'appLockEnabled',
      false,
    );
    expect(settingsService.getSetting).toHaveBeenCalledWith(
      'appLockUseBiometric',
      false,
    );
    expect(settingsService.getSetting).toHaveBeenCalledWith(
      'appLockAutoBiometricPrompt',
      false,
    );
    expect(settingsService.getSetting).toHaveBeenCalledWith(
      'appLockUsePin',
      false,
    );
  });

  it('should handle PIN unlock successfully', async () => {
    mockStore.appPinEntry = '1234';
    (secureStorageService.getSecret as jest.Mock).mockResolvedValue('1234');

    const { result } = await renderHook(() => useAppLock());

    await act(async () => {
      await result.current.handleAppPinUnlock();
    });

    expect(secureStorageService.getSecret).toHaveBeenCalledWith(
      '@AndroidIRCX:app-lock-pin',
    );
    expect(mockStore.setAppLocked).toHaveBeenCalledWith(false);
    expect(mockStore.setAppUnlockModalVisible).toHaveBeenCalledWith(false);
    expect(mockStore.setAppPinEntry).toHaveBeenCalledWith('');
  });

  it('should handle incorrect PIN', async () => {
    mockStore.appPinEntry = 'wrong';
    (secureStorageService.getSecret as jest.Mock).mockResolvedValue('1234');

    const { result } = await renderHook(() => useAppLock());

    await act(async () => {
      await result.current.handleAppPinUnlock();
    });

    expect(mockStore.setAppPinError).toHaveBeenCalledWith('Incorrect PIN.');
  });

  it('should handle missing PIN', async () => {
    mockStore.appPinEntry = '1234';
    (secureStorageService.getSecret as jest.Mock).mockResolvedValue(null);

    const { result } = await renderHook(() => useAppLock());

    await act(async () => {
      await result.current.handleAppPinUnlock();
    });

    expect(mockStore.setAppPinError).toHaveBeenCalledWith('No PIN set.');
  });

  it('should show PIN modal when biometric is not enabled', async () => {
    mockStore.appLockUseBiometric = false;

    const { result } = await renderHook(() => useAppLock());

    let unlockResult;
    await act(async () => {
      unlockResult = await result.current.attemptBiometricUnlock();
    });

    expect(unlockResult).toBe(false);
    expect(mockStore.setAppUnlockModalVisible).toHaveBeenCalledWith(true);
  });

  it('should handle biometric not available', async () => {
    mockStore.appLockUseBiometric = true;
    (biometricAuthService.isAvailable as jest.Mock).mockReturnValue(false);

    const { result } = await renderHook(() => useAppLock());

    let unlockResult;
    await act(async () => {
      unlockResult = await result.current.attemptBiometricUnlock();
    });

    expect(unlockResult).toBe(false);
    expect(mockStore.setAppPinError).toHaveBeenCalledWith(
      'Biometric authentication is not available on this device.',
    );
  });

  it('should subscribe to setting changes', async () => {
    await renderHook(() => useAppLock());

    // Wait for useEffect to run
    await act(async () => {
      await Promise.resolve();
    });

    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'appLockEnabled',
      expect.any(Function),
    );
    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'appLockUseBiometric',
      expect.any(Function),
    );
    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'appLockAutoBiometricPrompt',
      expect.any(Function),
    );
    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'appLockUsePin',
      expect.any(Function),
    );
    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'appLockOnLaunch',
      expect.any(Function),
    );
    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'appLockOnBackground',
      expect.any(Function),
    );
    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'appLockNow',
      expect.any(Function),
    );
  });

  // ==================== NEW TESTS FOR IMPROVED COVERAGE ====================

  describe('Biometric Edge Cases', () => {
    it('should prevent multiple simultaneous biometric attempts', async () => {
      // Use real timers so the deferred biometric authenticate promise can
      // resolve naturally — fake timers + React 19 act don't interleave the
      // simultaneous-call promise chain reliably.
      jest.useRealTimers();
      mockStore.appLockUseBiometric = true;
      (biometricAuthService.isAvailable as jest.Mock).mockReturnValue(true);
      (biometricAuthService.authenticate as jest.Mock).mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(() => resolve({ success: true }), 10),
          ),
      );

      const { result } = await renderHook(() => useAppLock());

      let secondResult: boolean | undefined;

      await act(async () => {
        const promise1 = result.current.attemptBiometricUnlock();
        // Yield once so the first call passes its in-progress check and
        // sets the flag before the second call starts.
        await Promise.resolve();
        const promise2 = result.current.attemptBiometricUnlock().then(r => {
          secondResult = r;
        });
        await Promise.all([promise1, promise2]);
      });

      // Second attempt should be rejected due to in-progress flag
      expect(secondResult).toBe(false);
    });

    it('should handle no enrolled biometrics - disables biometric', async () => {
      mockStore.appLockUseBiometric = true;
      (biometricAuthService.isAvailable as jest.Mock).mockReturnValue(true);
      (
        biometricAuthService.hasEnrolledBiometrics as jest.Mock
      ).mockResolvedValue(false);

      const { result } = await renderHook(() => useAppLock());

      await act(async () => {
        await result.current.attemptBiometricUnlock();
      });

      expect(settingsService.setSetting).toHaveBeenCalledWith(
        'appLockUseBiometric',
        false,
      );
      expect(biometricAuthService.disableLock).toHaveBeenCalledWith('app');
      expect(mockStore.setAppLockUseBiometric).toHaveBeenCalledWith(false);
      expect(mockStore.setAppPinError).toHaveBeenCalledWith(
        'No biometric credential is enrolled on this device. Use PIN unlock.',
      );
    });
  });

  describe('App State Changes', () => {
    it('should lock app when going to background', async () => {
      mockStore.appLockEnabled = true;
      mockStore.appLockOnBackground = true;

      let appStateCallback: ((state: string) => void) | undefined;
      jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation((event: any, callback: any) => {
          appStateCallback = callback;
          return { remove: jest.fn() };
        });

      await renderHook(() => useAppLock());

      await act(async () => {
        await Promise.resolve();
      });

      // Trigger background state
      await act(async () => {
        appStateCallback?.('background');
        await Promise.resolve();
      });

      expect(mockStore.setAppLocked).toHaveBeenCalledWith(true);
      expect(mockStore.setAppUnlockModalVisible).toHaveBeenCalledWith(true);
    });

    it('should not lock app when background locking is disabled', async () => {
      mockStore.appLockEnabled = true;
      mockStore.appLockOnBackground = false;

      let appStateCallback: ((state: string) => void) | undefined;
      jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation((event: any, callback: any) => {
          appStateCallback = callback;
          return { remove: jest.fn() };
        });

      await renderHook(() => useAppLock());

      await act(async () => {
        await Promise.resolve();
      });

      mockStore.setAppLocked.mockClear();
      mockStore.setAppUnlockModalVisible.mockClear();

      // Trigger background state
      await act(async () => {
        appStateCallback?.('background');
        await Promise.resolve();
      });

      expect(mockStore.setAppLocked).not.toHaveBeenCalled();
    });

    it('should lock app when coming to foreground with lockOnLaunch', async () => {
      mockStore.appLockEnabled = true;
      mockStore.appLockOnLaunch = true;

      let appStateCallback: ((state: string) => void) | undefined;
      jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation((event: any, callback: any) => {
          appStateCallback = callback;
          return { remove: jest.fn() };
        });

      await renderHook(() => useAppLock());

      await act(async () => {
        await Promise.resolve();
      });

      // First go to background
      await act(async () => {
        appStateCallback?.('background');
        await Promise.resolve();
      });

      mockStore.setAppLocked.mockClear();

      // Then come back to foreground
      await act(async () => {
        appStateCallback?.('active');
        await Promise.resolve();
      });

      expect(mockStore.setAppLocked).toHaveBeenCalledWith(true);
      expect(mockStore.setAppUnlockModalVisible).toHaveBeenCalledWith(true);
    });

    it('should auto-prompt biometrics on foreground when already locked from background', async () => {
      mockStore.appLockEnabled = true;
      mockStore.appLockOnBackground = true;
      mockStore.appLockOnLaunch = false;
      mockStore.appLockUseBiometric = true;
      mockStore.appLockAutoBiometricPrompt = true;

      const originalCurrentState = (AppState as any).currentState;
      Object.defineProperty(AppState, 'currentState', {
        configurable: true,
        value: 'active',
      });
      try {
        let appStateCallback: ((state: string) => void) | undefined;
        jest
          .spyOn(AppState, 'addEventListener')
          .mockImplementation((event: any, callback: any) => {
            appStateCallback = callback;
            return { remove: jest.fn() };
          });

        await renderHook(() => useAppLock());

        await act(async () => {
          await Promise.resolve();
        });

        // App goes to background and becomes locked there.
        await act(async () => {
          appStateCallback?.('background');
          await Promise.resolve();
        });
        expect(mockStore.setAppLocked).toHaveBeenCalledWith(true);
        mockStore.appLocked = true;

        (biometricAuthService.authenticate as jest.Mock).mockClear();

        // Foreground transition should trigger automatic biometric prompt.
        await act(async () => {
          appStateCallback?.('active');
          await Promise.resolve();
          await Promise.resolve();
        });

        expect(biometricAuthService.authenticate).toHaveBeenCalledWith(
          'Unlock AndroidIRCX',
          'Authenticate to unlock the app',
          'app',
        );
      } finally {
        Object.defineProperty(AppState, 'currentState', {
          configurable: true,
          value: originalCurrentState,
        });
      }
    });

    it('should unsubscribe on unmount', async () => {
      mockStore.appLockEnabled = true;
      const mockRemove = jest.fn();

      jest
        .spyOn(AppState, 'addEventListener')
        .mockReturnValue({ remove: mockRemove });

      const { unmount } = await renderHook(() => useAppLock());

      await act(async () => {
        await Promise.resolve();
      });

      await unmount();

      expect(mockRemove).toHaveBeenCalled();
    });

    it('should refresh a long-background lock screen after freeze timeout', async () => {
      mockStore.appLockEnabled = true;
      mockStore.appLockOnBackground = true;
      mockStore.appLockOnLaunch = false;
      mockStore.appLocked = true;
      mockStore.appUnlockModalVisible = true;

      let now = 1000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      let appStateCallback: ((state: string) => void) | undefined;
      jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation((event: any, callback: any) => {
          appStateCallback = callback;
          return { remove: jest.fn() };
        });

      await renderHook(() => useAppLock());
      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        appStateCallback?.('background');
      });
      now += 61000;
      mockStore.setAppUnlockModalVisible.mockClear();

      await act(async () => {
        appStateCallback?.('active');
      });
      expect(mockStore.setAppPinError).toHaveBeenCalledWith('');

      await act(async () => {
        jest.advanceTimersByTime(30000);
      });
      expect(mockStore.setAppUnlockModalVisible).toHaveBeenCalledWith(false);

      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      expect(mockStore.setAppUnlockModalVisible).toHaveBeenCalledWith(true);
      expect(mockStore.setAppPinError).toHaveBeenCalledWith(
        'Lock screen refreshed. Please try again.',
      );
    });
  });

  describe('Settings and biometric migration branches', () => {
    it('should disable restored biometric lock when no biometrics are enrolled', async () => {
      (settingsService.getSetting as jest.Mock).mockImplementation(
        (key, defaultValue) =>
          Promise.resolve(
            key === 'appLockEnabled' || key === 'appLockUseBiometric'
              ? true
              : defaultValue,
          ),
      );
      (
        biometricAuthService.hasEnrolledBiometrics as jest.Mock
      ).mockResolvedValue(false);

      await renderHook(() => useAppLock());
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(settingsService.setSetting).toHaveBeenCalledWith(
        'appLockUseBiometric',
        false,
      );
      expect(biometricAuthService.disableLock).toHaveBeenCalledWith('app');
      expect(settingsService.setSetting).toHaveBeenCalledWith(
        'appLockEnabled',
        false,
      );
      expect(mockStore.setAppLockEnabled).toHaveBeenCalledWith(false);
    });

    it('should enable PIN-based lock from stored settings and lock on launch', async () => {
      (settingsService.getSetting as jest.Mock).mockImplementation(
        (key, defaultValue) => {
          const values: Record<string, any> = {
            appLockEnabled: true,
            appLockUsePin: true,
            appLockOnLaunch: true,
          };
          return Promise.resolve(key in values ? values[key] : defaultValue);
        },
      );
      (secureStorageService.getSecret as jest.Mock).mockResolvedValue('1234');

      await renderHook(() => useAppLock());
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockStore.setAppLockEnabled).toHaveBeenCalledWith(true);
      expect(mockStore.setAppLockUsePin).toHaveBeenCalledWith(true);
      expect(mockStore.setAppLocked).toHaveBeenCalledWith(true);
      expect(mockStore.setAppUnlockModalVisible).toHaveBeenCalledWith(true);
    });

    it('should apply setting change callbacks and ignore lock-now while disabled', async () => {
      const callbacks: Record<string, (value?: any) => void> = {};
      (settingsService.onSettingChange as jest.Mock).mockImplementation(
        (key, cb) => {
          callbacks[key] = cb;
          return jest.fn();
        },
      );

      await renderHook(() => useAppLock());
      await act(async () => {
        await Promise.resolve();
      });

      callbacks.appLockEnabled(true);
      callbacks.appLockUseBiometric(true);
      callbacks.appLockUsePin(true);
      callbacks.appLockAutoBiometricPrompt(true);
      callbacks.appLockOnLaunch(false);
      callbacks.appLockOnBackground(false);

      expect(mockStore.setAppLockEnabled).toHaveBeenCalledWith(true);
      expect(mockStore.setAppLockUseBiometric).toHaveBeenCalledWith(true);
      expect(mockStore.setAppLockUsePin).toHaveBeenCalledWith(true);
      expect(mockStore.setAppLockAutoBiometricPrompt).toHaveBeenCalledWith(
        true,
      );
      expect(mockStore.setAppLockOnLaunch).toHaveBeenCalledWith(false);
      expect(mockStore.setAppLockOnBackground).toHaveBeenCalledWith(false);

      mockStore.setAppLocked.mockClear();
      mockStore.appLockEnabled = false;
      callbacks.appLockNow();
      expect(mockStore.setAppLocked).not.toHaveBeenCalled();

      mockStore.appLockEnabled = true;
      callbacks.appLockNow();
      expect(mockStore.setAppLocked).toHaveBeenCalledWith(true);
      expect(mockStore.setAppUnlockModalVisible).toHaveBeenCalledWith(true);
    });

    it('should retry biometric unlock after successful migration', async () => {
      Object.defineProperty(AppState, 'currentState', {
        configurable: true,
        value: 'active',
      });
      mockStore.appLockUseBiometric = true;
      (biometricAuthService.authenticate as jest.Mock)
        .mockResolvedValueOnce({
          success: false,
          errorKey: 'Authentication cancelled or credentials not found',
        })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });
      (biometricAuthService.enableLock as jest.Mock).mockResolvedValue(true);

      const { result } = await renderHook(() => useAppLock());

      let unlockResult: boolean | undefined;
      await act(async () => {
        unlockResult = await result.current.attemptBiometricUnlock();
      });

      expect(unlockResult).toBe(true);
      expect(biometricAuthService.enableLock).toHaveBeenCalledWith('app');
      expect(biometricAuthService.disableLock).toHaveBeenCalledWith(undefined);
      expect(mockStore.setAppLocked).toHaveBeenCalledWith(false);
      expect(mockStore.setAppUnlockModalVisible).toHaveBeenCalledWith(false);
    });

    it('should surface migration failure and generic biometric errors', async () => {
      Object.defineProperty(AppState, 'currentState', {
        configurable: true,
        value: 'active',
      });
      mockStore.appLockUseBiometric = true;
      (biometricAuthService.authenticate as jest.Mock)
        .mockResolvedValueOnce({
          success: false,
          errorKey: 'Authentication cancelled or credentials not found',
        })
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({ success: false, errorKey: 'Other failure' });

      const { result } = await renderHook(() => useAppLock());

      await act(async () => {
        await result.current.attemptBiometricUnlock();
      });
      expect(mockStore.setAppPinError).toHaveBeenCalledWith(
        'Biometric credentials not found. Please disable and re-enable biometric lock in Settings > Security.',
      );

      // Automatic prompts fire at most once per lock episode (window-leak
      // guard), so a second attempt in the same episode is a manual retry —
      // exactly what the "Use Biometrics" button does (isManualRetry = true).
      // Manual retries wait 800ms for the native prompt to reset before firing.
      mockStore.setAppPinError.mockClear();
      await act(async () => {
        const promise = result.current.attemptBiometricUnlock(true);
        await Promise.resolve();
        jest.advanceTimersByTime(800);
        await promise;
      });
      expect(mockStore.setAppPinError).toHaveBeenCalledWith(
        'Biometric authentication failed. Please try again.',
      );
    });
  });
});
