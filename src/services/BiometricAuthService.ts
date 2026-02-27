/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Optional dependency: react-native-keychain. Code guards in case it's missing.
let Keychain: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Keychain = require('react-native-keychain');
} catch (e) {
  // Optional; biometric locking will be unavailable.
}

class BiometricAuthService {
  private getService(scope?: string): string | undefined {
    return scope ? `androidircx:${scope}` : undefined;
  }

  isAvailable(): boolean {
    return Boolean(Keychain && (Keychain.getSupportedBiometryType || Keychain.getGenericPassword));
  }

  /**
   * Returns true only when OS-level biometric enrollment is present.
   * This is stricter than `isAvailable()` which only checks API/module presence.
   */
  async hasEnrolledBiometrics(): Promise<boolean> {
    if (!Keychain?.getSupportedBiometryType) return false;
    try {
      const biometryType = await Keychain.getSupportedBiometryType();
      return Boolean(biometryType);
    } catch {
      return false;
    }
  }

  async getBiometryType(): Promise<string | null> {
    if (!Keychain?.getSupportedBiometryType) return null;
    try {
      return await Keychain.getSupportedBiometryType();
    } catch {
      return null;
    }
  }

  async enableLock(scope?: string): Promise<boolean> {
    if (!Keychain?.setGenericPassword) return false;
    const service = this.getService(scope);
    const options: any = {};
    if (Keychain.ACCESS_CONTROL?.BIOMETRY_CURRENT_SET) {
      options.accessControl = Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET;
    }
    if (Keychain.ACCESSIBLE?.WHEN_UNLOCKED_THIS_DEVICE_ONLY) {
      options.accessible = Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY;
    }
    if (service) {
      options.service = service;
    }
    try {
      await Keychain.setGenericPassword('androidircx', 'unlock', options);
      return true;
    } catch (e) {
      console.warn('BiometricAuthService: enable failed', e);
      return false;
    }
  }

  async disableLock(scope?: string): Promise<void> {
    if (!Keychain?.resetGenericPassword) return;
    const service = this.getService(scope);
    try {
      await Keychain.resetGenericPassword(service ? { service } : undefined);
    } catch (e) {
      // ignore
    }
  }

  async authenticate(
    promptTitle: string,
    promptDescription?: string,
    scope?: string
  ): Promise<{ success: boolean; errorKey?: string; errorMessage?: string }> {
    if (!Keychain?.getGenericPassword) {
      return { success: false, errorKey: 'Biometric authentication not available' };
    }
    const service = this.getService(scope);
    console.log('[BiometricAuthService] Authenticating with scope:', scope, 'service:', service);

    const options: any = {
      authenticationPrompt: {
        title: promptTitle,
        subtitle: promptDescription || '',
      },
    };
    if (Keychain.AUTHENTICATION_TYPE?.DEVICE_PASSCODE_OR_BIOMETRICS) {
      // Allow both biometrics AND device PIN/passcode
      options.authenticationType = Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS;
      console.log('[BiometricAuthService] Using DEVICE_PASSCODE_OR_BIOMETRICS');
    } else if (Keychain.AUTHENTICATION_TYPE?.BIOMETRICS) {
      options.authenticationType = Keychain.AUTHENTICATION_TYPE.BIOMETRICS;
      console.log('[BiometricAuthService] Using BIOMETRICS only');
    }
    if (service) {
      options.service = service;
    }
    try {
      console.log('[BiometricAuthService] Calling getGenericPassword');
      const result = await Keychain.getGenericPassword(options);
      console.log('[BiometricAuthService] getGenericPassword result:', result);

      if (result === false) {
        // result === false can mean:
        // 1. User cancelled the biometric prompt
        // 2. No credentials were stored in this service
        // We return a generic errorKey that the caller can use to trigger migration/recovery
        return {
          success: false,
          errorKey: 'Authentication cancelled or credentials not found',
          errorMessage: undefined // Don't set message here - let caller decide based on context
        };
      }

      return { success: Boolean(result) };
    } catch (error) {
      console.error('[BiometricAuthService] Auth exception:', error);
      // Handle specific error types
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check if error indicates user cancellation
      if (errorMsg.includes('cancel') || errorMsg.includes('Cancel')) {
        return {
          success: false,
          errorKey: 'User cancelled',
          errorMessage: undefined // User knows they cancelled, no need for error message
        };
      }

      // Generic authentication failure
      return {
        success: false,
        errorKey: 'Authentication failed',
        errorMessage: errorMsg
      };
    }
  }
}

export const biometricAuthService = new BiometricAuthService();
