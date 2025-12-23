import AsyncStorage from '@react-native-async-storage/async-storage';

// Optional dependency: react-native-keychain. Code guards in case it's missing.
let Keychain: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Keychain = require('react-native-keychain');
} catch (e) {
  // Optional; fallback to AsyncStorage with warning.
}

const FALLBACK_PREFIX = '@AndroidIRCX:secure:';

class SecureStorageService {
  private isKeychainAvailable(): boolean {
    return Boolean(Keychain && Keychain.setInternetCredentials);
  }

  async setSecret(key: string, value?: string | null): Promise<void> {
    if (value === undefined || value === null || value === '') {
      await this.removeSecret(key);
      return;
    }

    if (this.isKeychainAvailable()) {
      // Use internet credentials to support multiple entries
      await Keychain.setInternetCredentials(key, 'androidircx', value);
    } else {
      console.warn('SecureStorage: Keychain unavailable, falling back to AsyncStorage (less secure)');
      await AsyncStorage.setItem(`${FALLBACK_PREFIX}${key}`, value);
    }
  }

  async getSecret(key: string): Promise<string | null> {
    if (this.isKeychainAvailable()) {
      const creds = await Keychain.getInternetCredentials(key);
      return creds?.password || null;
    }
    const fallback = await AsyncStorage.getItem(`${FALLBACK_PREFIX}${key}`);
    return fallback;
  }

  async removeSecret(key: string): Promise<void> {
    if (this.isKeychainAvailable()) {
      try {
        await Keychain.resetInternetCredentials(key);
      } catch (e) {
        // ignore
      }
    }
    await AsyncStorage.removeItem(`${FALLBACK_PREFIX}${key}`);
  }
}

export const secureStorageService = new SecureStorageService();
