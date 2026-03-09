/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useAppLock hook - Wave 4
 */

import { renderHook, act, cleanup } from '@testing-library/react-hooks';
import { AppState } from 'react-native';

// Mock service dependencies
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn().mockImplementation((key, defaultValue) => Promise.resolve(defaultValue)),
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
    jest.fn((selector) => selector(mockStore)),
    { getState: jest.fn(() => mockStore) }
  ),
}));

// Import the hook after mocks are set up
import { useAppLock } from '../../src/hooks/useAppLock';

describe('useAppLock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
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

  afterEach(() => {
    jest.useRealTimers();
    cleanup();
  });

  it('should return attemptBiometricUnlock and handleAppPinUnlock functions', () => {
    const { result } = renderHook(() => useAppLock());
    
    expect(result.current.attemptBiometricUnlock).toBeDefined();
    expect(result.current.handleAppPinUnlock).toBeDefined();
    expect(typeof result.current.attemptBiometricUnlock).toBe('function');
    expect(typeof result.current.handleAppPinUnlock).toBe('function');
  });

  it('should load app lock settings on mount', async () => {
    renderHook(() => useAppLock());
    
    // Wait for async useEffect
    await act(async () => {
      await Promise.resolve();
    });

    // Should query settings
    expect(settingsService.getSetting).toHaveBeenCalledWith('appLockEnabled', false);
    expect(settingsService.getSetting).toHaveBeenCalledWith('appLockUseBiometric', false);
    expect(settingsService.getSetting).toHaveBeenCalledWith('appLockAutoBiometricPrompt', false);
    expect(settingsService.getSetting).toHaveBeenCalledWith('appLockUsePin', false);
  });

  it('should handle PIN unlock successfully', async () => {
    mockStore.appPinEntry = '1234';
    (secureStorageService.getSecret as jest.Mock).mockResolvedValue('1234');

    const { result } = renderHook(() => useAppLock());

    await act(async () => {
      await result.current.handleAppPinUnlock();
    });

    expect(secureStorageService.getSecret).toHaveBeenCalledWith('@AndroidIRCX:app-lock-pin');
    expect(mockStore.setAppLocked).toHaveBeenCalledWith(false);
    expect(mockStore.setAppUnlockModalVisible).toHaveBeenCalledWith(false);
    expect(mockStore.setAppPinEntry).toHaveBeenCalledWith('');
  });

  it('should handle incorrect PIN', async () => {
    mockStore.appPinEntry = 'wrong';
    (secureStorageService.getSecret as jest.Mock).mockResolvedValue('1234');

    const { result } = renderHook(() => useAppLock());

    await act(async () => {
      await result.current.handleAppPinUnlock();
    });

    expect(mockStore.setAppPinError).toHaveBeenCalledWith('Incorrect PIN.');
  });

  it('should handle missing PIN', async () => {
    mockStore.appPinEntry = '1234';
    (secureStorageService.getSecret as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useAppLock());

    await act(async () => {
      await result.current.handleAppPinUnlock();
    });

    expect(mockStore.setAppPinError).toHaveBeenCalledWith('No PIN set.');
  });

  it('should show PIN modal when biometric is not enabled', async () => {
    mockStore.appLockUseBiometric = false;

    const { result } = renderHook(() => useAppLock());

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

    const { result } = renderHook(() => useAppLock());

    let unlockResult;
    await act(async () => {
      unlockResult = await result.current.attemptBiometricUnlock();
    });

    expect(unlockResult).toBe(false);
    expect(mockStore.setAppPinError).toHaveBeenCalledWith(
      'Biometric authentication is not available on this device.'
    );
  });

  it('should subscribe to setting changes', async () => {
    renderHook(() => useAppLock());

    // Wait for useEffect to run
    await act(async () => {
      await Promise.resolve();
    });

    expect(settingsService.onSettingChange).toHaveBeenCalledWith('appLockEnabled', expect.any(Function));
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('appLockUseBiometric', expect.any(Function));
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('appLockAutoBiometricPrompt', expect.any(Function));
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('appLockUsePin', expect.any(Function));
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('appLockOnLaunch', expect.any(Function));
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('appLockOnBackground', expect.any(Function));
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('appLockNow', expect.any(Function));
  });

  // ==================== NEW TESTS FOR IMPROVED COVERAGE ====================

  describe('Biometric Edge Cases', () => {
    it('should prevent multiple simultaneous biometric attempts', async () => {
      mockStore.appLockUseBiometric = true;
      (biometricAuthService.isAvailable as jest.Mock).mockReturnValue(true);
      (biometricAuthService.authenticate as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      const { result } = renderHook(() => useAppLock());

      // Start first attempt
      let firstResult: boolean | undefined;
      let secondResult: boolean | undefined;

      await act(async () => {
        // Fire both attempts simultaneously
        const promise1 = result.current.attemptBiometricUnlock().then(r => { firstResult = r; });
        const promise2 = result.current.attemptBiometricUnlock().then(r => { secondResult = r; });
        
        jest.advanceTimersByTime(100);
        await Promise.all([promise1, promise2]);
      });

      // Second attempt should be rejected due to in-progress flag
      expect(secondResult).toBe(false);
    });

    it('should handle no enrolled biometrics - disables biometric', async () => {
      mockStore.appLockUseBiometric = true;
      (biometricAuthService.isAvailable as jest.Mock).mockReturnValue(true);
      (biometricAuthService.hasEnrolledBiometrics as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useAppLock());

      await act(async () => {
        await result.current.attemptBiometricUnlock();
      });

      expect(settingsService.setSetting).toHaveBeenCalledWith('appLockUseBiometric', false);
      expect(biometricAuthService.disableLock).toHaveBeenCalledWith('app');
      expect(mockStore.setAppLockUseBiometric).toHaveBeenCalledWith(false);
      expect(mockStore.setAppPinError).toHaveBeenCalledWith(
        'No biometric credential is enrolled on this device. Use PIN unlock.'
      );
    });

  });

  describe('App State Changes', () => {
    it('should lock app when going to background', async () => {
      mockStore.appLockEnabled = true;
      mockStore.appLockOnBackground = true;

      let appStateCallback: ((state: string) => void) | undefined;
      jest.spyOn(AppState, 'addEventListener').mockImplementation((event: any, callback: any) => {
        appStateCallback = callback;
        return { remove: jest.fn() };
      });

      renderHook(() => useAppLock());

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
      jest.spyOn(AppState, 'addEventListener').mockImplementation((event: any, callback: any) => {
        appStateCallback = callback;
        return { remove: jest.fn() };
      });

      renderHook(() => useAppLock());

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
      jest.spyOn(AppState, 'addEventListener').mockImplementation((event: any, callback: any) => {
        appStateCallback = callback;
        return { remove: jest.fn() };
      });

      renderHook(() => useAppLock());

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

    it('should unsubscribe on unmount', async () => {
      mockStore.appLockEnabled = true;
      const mockRemove = jest.fn();

      jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: mockRemove });

      const { unmount } = renderHook(() => useAppLock());

      await act(async () => {
        await Promise.resolve();
      });

      unmount();

      expect(mockRemove).toHaveBeenCalled();
    });
  });
});
