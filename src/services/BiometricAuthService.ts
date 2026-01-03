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
        return { 
          success: false, 
          errorKey: 'Authentication cancelled or credentials not found',
          errorMessage: 'Biometric authentication was cancelled or failed. Please try again.'
        };
      }

      return { success: Boolean(result) };
    } catch (error) {
      console.error('[BiometricAuthService] Auth exception:', error);
      return {
        success: false,
        errorKey: 'Authentication failed',
        errorMessage: error instanceof Error ? error.message : undefined
      };
    }
  }
}

export const biometricAuthService = new BiometricAuthService();
