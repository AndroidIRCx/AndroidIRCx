/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
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
  const biometricAttemptInProgressRef = useRef(false);
  const backgroundTimeRef = useRef<number>(0); // Track when app went to background
  const lockScreenFreezeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Zustand selectors - only subscribe to what we need
  const appLockEnabled = useUIStore(state => state.appLockEnabled);
  const appLockOnBackground = useUIStore(state => state.appLockOnBackground);
  const appLockOnLaunch = useUIStore(state => state.appLockOnLaunch);
  const appLocked = useUIStore(state => state.appLocked);
  const appLockUseBiometric = useUIStore(state => state.appLockUseBiometric);
  const appLockAutoBiometricPrompt = useUIStore(state => state.appLockAutoBiometricPrompt);

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
    const autoBiometricPrompt = await settingsService.getSetting('appLockAutoBiometricPrompt', false);
    const storedPin = await secureStorageService.getSecret(APP_PIN_STORAGE_KEY);
    const pinEnabled = usePin && Boolean(storedPin);

    if (!isMountedRef.current) return;

    const store = useUIStore.getState();
    store.setAppLockEnabled(enabled && (useBiometric || pinEnabled));
    store.setAppLockUseBiometric(useBiometric);
    store.setAppLockUsePin(pinEnabled);
    store.setAppLockOnLaunch(lockOnLaunch);
    store.setAppLockOnBackground(lockOnBackground);
    store.setAppLockAutoBiometricPrompt(autoBiometricPrompt);

    // Auto-lock on launch if enabled
    if (enabled && lockOnLaunch) {
      store.setAppLocked(true);
      store.setAppUnlockModalVisible(true);
    }
  }, []);

  /**
   * Migrate old biometric credentials from default service to 'app' scope
   * Returns true if migration was successful
   */
  const migrateOldBiometricCredentials = useCallback(async () => {
    console.log('[useAppLock] Attempting to migrate old biometric credentials...');
    try {
      // Try to authenticate with default service (old credentials location)
      const oldResult = await biometricAuthService.authenticate(
        'Migrate Biometric Credentials',
        'Authenticate to update your biometric lock',
        undefined // No scope = default service (where old credentials are stored)
      );

      if (oldResult.success) {
        console.log('[useAppLock] Found old credentials, migrating to new location...');
        // Old credentials exist and user authenticated successfully
        // Now store them in the correct location with 'app' scope
        const migrated = await biometricAuthService.enableLock('app');

        if (migrated) {
          console.log('[useAppLock] Migration successful!');
          // Clean up old credentials from default service
          await biometricAuthService.disableLock(undefined);
          return true;
        } else {
          console.warn('[useAppLock] Migration failed - could not store credentials in new location');
          return false;
        }
      } else {
        console.log('[useAppLock] No old credentials found or authentication failed');
        return false;
      }
    } catch (error) {
      console.error('[useAppLock] Migration error:', error);
      return false;
    }
  }, []);

  /**
   * Attempt biometric authentication to unlock app
   */
  const attemptBiometricUnlock = useCallback(async (isManualRetry = false) => {
    const store = useUIStore.getState();
    if (!store.appLockUseBiometric) {
      // If biometric is not enabled, show PIN modal instead
      store.setAppUnlockModalVisible(true);
      return false;
    }

    // Prevent multiple simultaneous attempts
    if (biometricAttemptInProgressRef.current) {
      console.log('[useAppLock] Biometric attempt already in progress, skipping');
      return false;
    }

    // Check if biometric is available
    if (!biometricAuthService.isAvailable()) {
      if (isMountedRef.current) {
        store.setAppPinError('Biometric authentication is not available on this device.');
      }
      return false;
    }

    // If this is a manual retry after a failure, add a delay to allow the native API to reset
    // Native biometric prompts need time to fully dismiss before a new one can be shown
    if (isManualRetry) {
      console.log('[useAppLock] Manual retry - waiting for native API to reset...');
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    biometricAttemptInProgressRef.current = true;

    // Clear any previous errors before attempting
    if (isMountedRef.current) {
      store.setAppPinError('');
    }

    try {
      console.log('[useAppLock] Attempting biometric authentication with app scope...');
      const result = await biometricAuthService.authenticate(
        'Unlock AndroidIRCX',
        'Authenticate to unlock the app',
        'app'
      );

      // Always reset the in-progress flag, regardless of success/failure
      biometricAttemptInProgressRef.current = false;

      if (result.success && isMountedRef.current) {
        console.log('[useAppLock] Biometric authentication successful');
        store.setAppLocked(false);
        store.setAppUnlockModalVisible(false);
        store.setAppPinEntry('');
        store.setAppPinError('');
        return true;
      } else {
        // Authentication failed or was cancelled
        console.log('[useAppLock] Biometric authentication failed or cancelled:', result.errorKey);

        // RECOVERY MECHANISM: If credentials not found, try to migrate old credentials
        if (result.errorKey === 'Authentication cancelled or credentials not found') {
          console.log('[useAppLock] Credentials not found in app scope, attempting migration...');
          const migrated = await migrateOldBiometricCredentials();

          if (migrated && isMountedRef.current) {
            // Migration successful! Now retry authentication with correct credentials
            console.log('[useAppLock] Migration successful, retrying authentication...');
            biometricAttemptInProgressRef.current = true;

            const retryResult = await biometricAuthService.authenticate(
              'Unlock AndroidIRCX',
              'Authenticate to unlock the app',
              'app'
            );

            biometricAttemptInProgressRef.current = false;

            if (retryResult.success && isMountedRef.current) {
              console.log('[useAppLock] Retry after migration successful!');
              store.setAppLocked(false);
              store.setAppUnlockModalVisible(false);
              store.setAppPinEntry('');
              store.setAppPinError('');
              return true;
            }
          } else {
            // Migration failed or no old credentials found
            console.warn('[useAppLock] Migration failed or no old credentials found');
            if (isMountedRef.current) {
              // Provide helpful error message with recovery options
              store.setAppPinError(
                'Biometric credentials not found. Please disable and re-enable biometric lock in Settings > Security.'
              );
            }
            return false;
          }
        }

        // Don't hide the modal - allow user to retry
        if (isMountedRef.current) {
          // Show user-friendly error message
          if (result.errorMessage) {
            store.setAppPinError(result.errorMessage);
          } else if (result.errorKey === 'Authentication cancelled or credentials not found') {
            // User cancelled - don't show error, just allow retry
            // The prompt will appear again when they press the button
            store.setAppPinError('');
          } else {
            store.setAppPinError('Biometric authentication failed. Please try again.');
          }
        }
        return false;
      }
    } catch (error) {
      // Always reset the in-progress flag, even on exception
      biometricAttemptInProgressRef.current = false;
      // Handle unexpected errors
      console.error('[useAppLock] Biometric unlock error:', error);
      if (isMountedRef.current) {
        const errorMsg = error instanceof Error ? error.message : 'Biometric authentication failed';
        store.setAppPinError(errorMsg + ' Please try again.');
      }
      return false;
    }
  }, [migrateOldBiometricCredentials]);

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
    const unsubAutoBioPrompt = settingsService.onSettingChange('appLockAutoBiometricPrompt', (v) => {
      useUIStore.getState().setAppLockAutoBiometricPrompt(Boolean(v));
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
      unsubAutoBioPrompt();
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

      // Track when app goes to background
      if (prevState === 'active' && nextState !== 'active') {
        backgroundTimeRef.current = Date.now();
        console.log('[useAppLock] App went to background, recording time');

        // Lock when going to background
        if (currentStore.appLockOnBackground) {
          currentStore.setAppLocked(true);
          currentStore.setAppUnlockModalVisible(true);
        }
      }

      // Handle app coming to foreground
      if (prevState !== 'active' && nextState === 'active') {
        const timeInBackground = Date.now() - backgroundTimeRef.current;
        const wasLongBackground = timeInBackground > 60000; // More than 1 minute

        console.log(`[useAppLock] App came to foreground after ${Math.round(timeInBackground / 1000)}s in background`);

        // CRITICAL FIX: Reset biometric state if app was in background for a long time
        // This prevents the lock screen from freezing due to stuck biometric attempts
        if (wasLongBackground) {
          console.log('[useAppLock] Long background detected - resetting biometric state');
          biometricAttemptInProgressRef.current = false;

          // Clear any error messages
          currentStore.setAppPinError('');

          // If lock screen is showing, set up a safety timeout to detect freeze
          if (currentStore.appLocked && currentStore.appUnlockModalVisible) {
            console.log('[useAppLock] Lock screen active after long background - setting up freeze detection');

            // Clear any existing timeout
            if (lockScreenFreezeTimeoutRef.current) {
              clearTimeout(lockScreenFreezeTimeoutRef.current);
            }

            // Set up a 30-second timeout to detect if lock screen is frozen
            lockScreenFreezeTimeoutRef.current = setTimeout(() => {
              console.warn('[useAppLock] Lock screen freeze detected! Force resetting...');
              const emergencyStore = useUIStore.getState();

              // Force reset all lock-related state
              biometricAttemptInProgressRef.current = false;

              // Hide and re-show modal to force refresh
              emergencyStore.setAppUnlockModalVisible(false);
              setTimeout(() => {
                emergencyStore.setAppUnlockModalVisible(true);
                emergencyStore.setAppPinError('Lock screen refreshed. Please try again.');
              }, 100);
            }, 30000); // 30 seconds
          }
        }

        // Lock when coming to foreground
        if (currentStore.appLockOnLaunch) {
          currentStore.setAppLocked(true);
          currentStore.setAppUnlockModalVisible(true);
        }
      }
    });

    return () => {
      subscription.remove();
      // Clean up timeout on unmount
      if (lockScreenFreezeTimeoutRef.current) {
        clearTimeout(lockScreenFreezeTimeoutRef.current);
      }
    };
  }, [appLockEnabled, appLockOnBackground, appLockOnLaunch]);

  // Effect: Clean up state when unlocked and optionally auto-trigger biometric prompt
  useEffect(() => {
    if (!appLocked) {
      // Reset flags when app is unlocked
      biometricAttemptInProgressRef.current = false;

      // Clear freeze detection timeout when unlocked
      if (lockScreenFreezeTimeoutRef.current) {
        clearTimeout(lockScreenFreezeTimeoutRef.current);
        lockScreenFreezeTimeoutRef.current = null;
      }
      return;
    }

    if (appLockUseBiometric && appLockAutoBiometricPrompt && !biometricAttemptInProgressRef.current) {
      // Auto-prompt is optional and user-controlled from Security settings.
      void attemptBiometricUnlock(false);
    }
  }, [appLocked, appLockUseBiometric, appLockAutoBiometricPrompt, attemptBiometricUnlock]);

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
