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

  async authenticate(promptTitle: string, scope?: string): Promise<boolean> {
    if (!Keychain?.getGenericPassword) return false;
    const service = this.getService(scope);
    const options: any = {
      authenticationPrompt: { title: promptTitle },
    };
    if (Keychain.AUTHENTICATION_TYPE?.BIOMETRICS) {
      options.authenticationType = Keychain.AUTHENTICATION_TYPE.BIOMETRICS;
    }
    if (service) {
      options.service = service;
    }
    try {
      const result = await Keychain.getGenericPassword(options);
      return Boolean(result);
    } catch {
      return false;
    }
  }
}

export const biometricAuthService = new BiometricAuthService();
