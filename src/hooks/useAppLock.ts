/**
 * useAppLock Hook
 *
 * Manages app lock functionality including:
 * - PIN and biometric authentication
 * - App state transitions (background/foreground)
 * - Settings synchronization
 * - Auto-lock on launch/background
 */

import { useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useUIStore } from '../stores/uiStore';
import { settingsService } from '../services/SettingsService';
import { biometricAuthService } from '../services/BiometricAuthService';
import { secureStorageService } from '../services/SecureStorageService';

const APP_PIN_STORAGE_KEY = '@AndroidIRCX:app-lock-pin';

export function useAppLock() {
  const appStateRef = useRef(AppState.currentState);
  const isMountedRef = useRef(true);

  // Zustand selectors - only subscribe to what we need
  const appLockEnabled = useUIStore(state => state.appLockEnabled);
  const appLockOnBackground = useUIStore(state => state.appLockOnBackground);
  const appLockOnLaunch = useUIStore(state => state.appLockOnLaunch);
  const appLocked = useUIStore(state => state.appLocked);
  const appLockUseBiometric = useUIStore(state => state.appLockUseBiometric);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Load app lock settings from storage and sync to UI store
   */
  const loadAppLockSettings = useCallback(async () => {
    const enabled = await settingsService.getSetting('appLockEnabled', false);
    const useBiometric = await settingsService.getSetting('appLockUseBiometric', false);
    const usePin = await settingsService.getSetting('appLockUsePin', false);
    const lockOnLaunch = await settingsService.getSetting('appLockOnLaunch', true);
    const lockOnBackground = await settingsService.getSetting('appLockOnBackground', true);
    const storedPin = await secureStorageService.getSecret(APP_PIN_STORAGE_KEY);
    const pinEnabled = usePin && Boolean(storedPin);

    if (!isMountedRef.current) return;

    const store = useUIStore.getState();
    store.setAppLockEnabled(enabled && (useBiometric || pinEnabled));
    store.setAppLockUseBiometric(useBiometric);
    store.setAppLockUsePin(pinEnabled);
    store.setAppLockOnLaunch(lockOnLaunch);
    store.setAppLockOnBackground(lockOnBackground);

    // Auto-lock on launch if enabled
    if (enabled && lockOnLaunch) {
      store.setAppLocked(true);
      store.setAppUnlockModalVisible(true);
    }
  }, []);

  /**
   * Attempt biometric authentication to unlock app
   */
  const attemptBiometricUnlock = useCallback(async () => {
    const store = useUIStore.getState();
    if (!store.appLockUseBiometric) {
      // If biometric is not enabled, show PIN modal instead
      store.setAppUnlockModalVisible(true);
      return false;
    }

    // Check if biometric is available
    if (!biometricAuthService.isAvailable()) {
      if (isMountedRef.current) {
        store.setAppPinError('Biometric authentication is not available on this device.');
      }
      return false;
    }

    try {
      const result = await biometricAuthService.authenticate(
        'Unlock AndroidIRCX',
        'Authenticate to unlock the app',
        'app'
      );

      if (result.success && isMountedRef.current) {
        store.setAppLocked(false);
        store.setAppUnlockModalVisible(false);
        store.setAppPinEntry('');
        store.setAppPinError('');
        return true;
      } else {
        // Authentication failed or was cancelled
        // Don't hide the modal - allow user to retry
        if (isMountedRef.current) {
          // Show user-friendly error message
          if (result.errorMessage) {
            store.setAppPinError(result.errorMessage);
          } else if (result.errorKey === 'Authentication cancelled or credentials not found') {
            // User cancelled - don't show error, just allow retry
            store.setAppPinError('');
          } else {
            store.setAppPinError('Biometric authentication failed. Please try again.');
          }
        }
        return false;
      }
    } catch (error) {
      // Handle unexpected errors
      console.error('[useAppLock] Biometric unlock error:', error);
      if (isMountedRef.current) {
        const errorMsg = error instanceof Error ? error.message : 'Biometric authentication failed';
        store.setAppPinError(errorMsg + ' Please try again.');
      }
      return false;
    }
  }, []);

  /**
   * Verify PIN and unlock app if correct
   */
  const handleAppPinUnlock = useCallback(async () => {
    const store = useUIStore.getState();
    const stored = await secureStorageService.getSecret(APP_PIN_STORAGE_KEY);

    if (!stored) {
      store.setAppPinError('No PIN set.');
      return;
    }

    if (store.appPinEntry.trim() === stored) {
      if (isMountedRef.current) {
        store.setAppLocked(false);
        store.setAppUnlockModalVisible(false);
        store.setAppPinEntry('');
        store.setAppPinError('');
      }
      return;
    }

    store.setAppPinError('Incorrect PIN.');
  }, []);

  // Effect: Load settings and subscribe to changes
  useEffect(() => {
    loadAppLockSettings();

    const unsubEnabled = settingsService.onSettingChange('appLockEnabled', (v) => {
      useUIStore.getState().setAppLockEnabled(Boolean(v));
    });
    const unsubBio = settingsService.onSettingChange('appLockUseBiometric', (v) => {
      useUIStore.getState().setAppLockUseBiometric(Boolean(v));
    });
    const unsubPin = settingsService.onSettingChange('appLockUsePin', (v) => {
      useUIStore.getState().setAppLockUsePin(Boolean(v));
    });
    const unsubLaunch = settingsService.onSettingChange('appLockOnLaunch', (v) => {
      useUIStore.getState().setAppLockOnLaunch(Boolean(v));
    });
    const unsubBackground = settingsService.onSettingChange('appLockOnBackground', (v) => {
      useUIStore.getState().setAppLockOnBackground(Boolean(v));
    });
    const unsubLockNow = settingsService.onSettingChange('appLockNow', () => {
      const currentStore = useUIStore.getState();
      if (!currentStore.appLockEnabled) return;
      currentStore.setAppLocked(true);
      currentStore.setAppUnlockModalVisible(true);
    });

    return () => {
      unsubEnabled();
      unsubBio();
      unsubPin();
      unsubLaunch();
      unsubBackground();
      unsubLockNow();
    };
  }, [loadAppLockSettings]);

  // Effect: Handle app state changes (background/foreground)
  useEffect(() => {
    const store = useUIStore.getState();

    if (!store.appLockEnabled) {
      store.setAppLocked(false);
      store.setAppUnlockModalVisible(false);
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      const currentStore = useUIStore.getState();
      if (!currentStore.appLockEnabled) return;

      // Lock when going to background
      if (currentStore.appLockOnBackground && prevState === 'active' && nextState !== 'active') {
        currentStore.setAppLocked(true);
        currentStore.setAppUnlockModalVisible(true);
      }

      // Lock when coming to foreground
      if (currentStore.appLockOnLaunch && prevState !== 'active' && nextState === 'active') {
        currentStore.setAppLocked(true);
        currentStore.setAppUnlockModalVisible(true);
      }
    });

    return () => subscription.remove();
  }, [appLockEnabled, appLockOnBackground, appLockOnLaunch]);

  // Effect: Auto-trigger biometric unlock when locked (only once when app becomes locked)
  useEffect(() => {
    if (!appLocked) return;
    if (!appLockUseBiometric) return;
    
    // Only auto-trigger if modal is visible (user hasn't manually interacted yet)
    const store = useUIStore.getState();
    if (store.appUnlockModalVisible) {
      // Small delay to ensure modal is rendered before triggering biometric prompt
      const timeoutId = setTimeout(() => {
        attemptBiometricUnlock();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [appLocked, appLockUseBiometric, attemptBiometricUnlock]);

  // Effect: Lock on launch if enabled
  useEffect(() => {
    const store = useUIStore.getState();
    if (store.appLockEnabled && store.appLockOnLaunch) {
      store.setAppLocked(true);
      store.setAppUnlockModalVisible(true);
    }
  }, [appLockEnabled, appLockOnLaunch]);

  return {
    attemptBiometricUnlock,
    handleAppPinUnlock,
  };
}
