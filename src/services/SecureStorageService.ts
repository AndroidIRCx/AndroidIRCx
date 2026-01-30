/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
const KEY_INDEX = '@AndroidIRCX:keychain_index';

class SecureStorageService {
  private _fallbackWarningShown = false;
  private _usingFallback = false;

  private isKeychainAvailable(): boolean {
    return Boolean(Keychain && Keychain.setInternetCredentials);
  }

  /**
   * Check if secure storage is using hardware-backed Keychain.
   * Returns true if Keychain is available, false if falling back to AsyncStorage.
   */
  isUsingSecureKeychain(): boolean {
    return this.isKeychainAvailable();
  }

  /**
   * Check if we're using the less secure AsyncStorage fallback.
   * This should be shown as a warning to users in security-sensitive contexts.
   */
  isUsingFallbackStorage(): boolean {
    return !this.isKeychainAvailable();
  }

  /**
   * Get security status information for display in UI.
   */
  getSecurityStatus(): {
    isSecure: boolean;
    storageType: 'keychain' | 'asyncstorage';
    warning: string | null;
  } {
    const isSecure = this.isKeychainAvailable();
    return {
      isSecure,
      storageType: isSecure ? 'keychain' : 'asyncstorage',
      warning: isSecure
        ? null
        : 'Secure storage (Keychain) is not available. Passwords and tokens are stored in AsyncStorage which is less secure. On a compromised device or in backups, this data could be accessible.',
    };
  }

  // Maintain an index of keys stored in Keychain (since Keychain can't list keys)
  private async addToIndex(key: string): Promise<void> {
    const indexJson = await AsyncStorage.getItem(KEY_INDEX);
    const index = indexJson ? JSON.parse(indexJson) : [];
    if (!index.includes(key)) {
      index.push(key);
      await AsyncStorage.setItem(KEY_INDEX, JSON.stringify(index));
    }
  }

  private async removeFromIndex(key: string): Promise<void> {
    const indexJson = await AsyncStorage.getItem(KEY_INDEX);
    const index = indexJson ? JSON.parse(indexJson) : [];
    const newIndex = index.filter((k: string) => k !== key);
    await AsyncStorage.setItem(KEY_INDEX, JSON.stringify(newIndex));
  }

  async setSecret(key: string, value?: string | null): Promise<void> {
    if (value === undefined || value === null || value === '') {
      await this.removeSecret(key);
      return;
    }

    if (this.isKeychainAvailable()) {
      // Use internet credentials to support multiple entries
      await Keychain.setInternetCredentials(key, 'androidircx', value);
      // Add to index for listing
      await this.addToIndex(key);
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
        // Remove from index
        await this.removeFromIndex(key);
      } catch (e) {
        // ignore
      }
    }
    await AsyncStorage.removeItem(`${FALLBACK_PREFIX}${key}`);
  }

  async getAllSecretKeys(): Promise<string[]> {
    if (this.isKeychainAvailable()) {
      // Read keys from index (Keychain can't list keys)
      const indexJson = await AsyncStorage.getItem(KEY_INDEX);
      return indexJson ? JSON.parse(indexJson) : [];
    }
    const keys = await AsyncStorage.getAllKeys();
    return keys
      .filter(key => key.startsWith(FALLBACK_PREFIX))
      .map(key => key.substring(FALLBACK_PREFIX.length));
  }
}

export const secureStorageService = new SecureStorageService();
