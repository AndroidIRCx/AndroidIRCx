/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { tx } from '../i18n/transifex';
import { identityProfilesService } from './IdentityProfilesService';
import { settingsService } from './SettingsService';
import { storageCache } from './StorageCache';
import { secureStorageService } from './SecureStorageService';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

// Lazy-load sodium to avoid startup delays
let sodiumInstance: any = null;
async function getSodium() {
  if (!sodiumInstance) {
    const sodium = require('react-native-libsodium');
    await sodium.ready;
    sodiumInstance = sodium;
  }
  return sodiumInstance;
}

// Keys that may contain sensitive data (passwords, tokens, etc.)
const SENSITIVE_KEY_PATTERNS = [
  '@AndroidIRCX:secure:', // SecureStorage fallback keys
  'password',
  'token',
  'sasl',
  'znc',
];

/**
 * Check if a key might contain sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const keyLower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some(pattern =>
    keyLower.includes(pattern.toLowerCase()),
  );
}

export interface BackupPayload {
  version: number;
  createdAt: string;
  data: Record<string, string | null>;
  secureData?: Record<string, string | null>;
}

const SECURE_EXPORT_PREFIX = '@AndroidIRCX:secure:';

function isSecureExportKey(key: string): boolean {
  return key.startsWith(SECURE_EXPORT_PREFIX);
}

function toSecureExportKey(secretKey: string): string {
  return `${SECURE_EXPORT_PREFIX}${secretKey}`;
}

function fromSecureExportKey(exportKey: string): string {
  return exportKey.substring(SECURE_EXPORT_PREFIX.length);
}

function hasNetworkSelection(keys: string[] | undefined): boolean {
  if (!keys) return false;
  return keys.some(
    key => key.includes('@AndroidIRCX:networks') || key.includes('NETWORKS'),
  );
}

function isNetworkSecureSecret(secretKey: string): boolean {
  const secret = secretKey.toLowerCase();
  return (
    secret.includes(':server:') ||
    secret.endsWith(':saslpassword') ||
    secret.endsWith(':nickservpassword') ||
    secret.endsWith(':operpassword') ||
    secret.endsWith(':proxypassword') ||
    secret.endsWith(':clientcert') ||
    secret.endsWith(':clientkey')
  );
}

function isMessageHistoryKey(key: string): boolean {
  return key.startsWith('MESSAGES_') || key.startsWith('@AndroidIRCX:history:');
}

function isLogKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  if (key === 'channelLogs' || key.startsWith('channelLogs:')) {
    return true;
  }
  return lowerKey.includes('log') && !lowerKey.includes('login');
}

class DataBackupService {
  private readonly STORAGE_BATCH_SIZE = 100;

  private getStorageCompat() {
    return AsyncStorage as typeof AsyncStorage & {
      multiGet?: (keys: string[]) => Promise<Array<[string, string | null]>>;
      multiSet?: (pairs: Array<[string, string]>) => Promise<void>;
      multiRemove?: (keys: string[]) => Promise<void>;
      getMany?: (keys: string[]) => Promise<Record<string, string | null>>;
      setMany?: (entries: Record<string, string>) => Promise<void>;
      removeMany?: (keys: string[]) => Promise<void>;
    };
  }

  private async yieldToEventLoop(): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  private async multiGetInChunks(
    keys: string[],
  ): Promise<Array<[string, string | null]>> {
    if (keys.length === 0) return [];
    const storage = this.getStorageCompat();
    const allEntries: Array<[string, string | null]> = [];
    for (let i = 0; i < keys.length; i += this.STORAGE_BATCH_SIZE) {
      const chunk = keys.slice(i, i + this.STORAGE_BATCH_SIZE);
      if (typeof storage.multiGet === 'function') {
        const entries = await storage.multiGet(chunk);
        allEntries.push(...entries);
      } else if (typeof storage.getMany === 'function') {
        const entriesMap = await storage.getMany(chunk);
        allEntries.push(
          ...chunk.map(
            key => [key, entriesMap[key] ?? null] as [string, string | null],
          ),
        );
      } else {
        throw new Error('AsyncStorage batch read API is unavailable');
      }
      await this.yieldToEventLoop();
    }
    return allEntries;
  }

  private async multiSetInChunks(
    pairs: Array<[string, string]>,
  ): Promise<void> {
    const storage = this.getStorageCompat();
    for (let i = 0; i < pairs.length; i += this.STORAGE_BATCH_SIZE) {
      const chunk = pairs.slice(i, i + this.STORAGE_BATCH_SIZE);
      if (typeof storage.multiSet === 'function') {
        await storage.multiSet(chunk);
      } else if (typeof storage.setMany === 'function') {
        await storage.setMany(Object.fromEntries(chunk));
      } else {
        throw new Error('AsyncStorage batch write API is unavailable');
      }
      await this.yieldToEventLoop();
    }
  }

  private async multiRemoveInChunks(keys: string[]): Promise<void> {
    const storage = this.getStorageCompat();
    for (let i = 0; i < keys.length; i += this.STORAGE_BATCH_SIZE) {
      const chunk = keys.slice(i, i + this.STORAGE_BATCH_SIZE);
      if (typeof storage.multiRemove === 'function') {
        await storage.multiRemove(chunk);
      } else if (typeof storage.removeMany === 'function') {
        await storage.removeMany(chunk);
      } else {
        throw new Error('AsyncStorage batch remove API is unavailable');
      }
      await this.yieldToEventLoop();
    }
  }

  private async getSecureExportEntries(
    keys?: string[],
  ): Promise<Array<[string, string | null]>> {
    const allSecretKeys = await secureStorageService.getAllSecretKeys();
    const explicitSecureSelections = keys
      ? keys.filter(isSecureExportKey).map(fromSecureExportKey)
      : allSecretKeys;
    const networkDerivedSelections = hasNetworkSelection(keys)
      ? allSecretKeys.filter(isNetworkSecureSecret)
      : [];
    const selectedSecretKeys = Array.from(
      new Set([...explicitSecureSelections, ...networkDerivedSelections]),
    );

    if (selectedSecretKeys.length === 0) {
      return [];
    }

    const values = await Promise.all(
      selectedSecretKeys.map(async secretKey => {
        const value = await secureStorageService.getSecret(secretKey);
        return [toSecureExportKey(secretKey), value] as [string, string | null];
      }),
    );

    return values;
  }

  private buildPayload(
    asyncEntries: ReadonlyArray<readonly [string, string | null]>,
    secureEntries: ReadonlyArray<readonly [string, string | null]>,
  ): BackupPayload {
    const payload: BackupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: {},
    };

    asyncEntries.forEach(([key, value]) => {
      payload.data[key] = value;
    });

    if (secureEntries.length > 0) {
      payload.secureData = {};
      secureEntries.forEach(([key, value]) => {
        payload.secureData![key] = value;
      });
    }

    return payload;
  }

  /**
   * Export all AsyncStorage data into a single JSON string.
   */
  async exportAll(): Promise<string> {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await this.multiGetInChunks(keys);
    const secureEntries = await this.getSecureExportEntries();
    const payload = this.buildPayload(entries, secureEntries);
    return JSON.stringify(payload);
  }

  /**
   * Export only settings and configuration (excludes logs and message history).
   */
  async exportSettings(): Promise<string> {
    const keys = await AsyncStorage.getAllKeys();

    // Filter out logs and message history
    const filteredKeys = keys.filter(key => {
      // Exclude message history
      if (isMessageHistoryKey(key)) return false;

      // Exclude channel logs
      if (key === 'channelLogs' || key.startsWith('channelLogs:')) return false;

      // Exclude any other log-related keys
      if (isLogKey(key)) return false;

      // Include everything else (networks, settings, profiles, etc.)
      return true;
    });

    const entries = await this.multiGetInChunks(filteredKeys);
    const secureEntries = await this.getSecureExportEntries();
    const payload = this.buildPayload(entries, secureEntries);
    return JSON.stringify(payload);
  }

  /**
   * Import data from a JSON string produced by exportAll.
   * Existing keys will be overwritten.
   */
  async importAll(json: string): Promise<void> {
    const parsed: BackupPayload = JSON.parse(json);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.data ||
      typeof parsed.data !== 'object' ||
      Array.isArray(parsed.data)
    ) {
      throw new Error(t('Invalid backup format'));
    }

    if (parsed.secureData !== undefined) {
      if (
        parsed.secureData === null ||
        typeof parsed.secureData !== 'object' ||
        Array.isArray(parsed.secureData)
      ) {
        throw new Error(t('Invalid backup format'));
      }
    }

    // Prevent stale cache/pending writes from overwriting freshly restored values.
    await storageCache.clear(false);

    const entries = Object.entries(parsed.data);
    const setPairs = entries
      .filter(([, value]) => value !== null)
      .map(([key, value]) => [key, value as string] as [string, string]);
    const removeKeys = entries
      .filter(([, value]) => value === null)
      .map(([key]) => key);

    if (setPairs.length > 0) {
      await this.multiSetInChunks(setPairs);
    }
    if (removeKeys.length > 0) {
      await this.multiRemoveInChunks(removeKeys);
    }

    const securePairs = Object.entries(parsed.secureData || {});
    if (securePairs.length > 0) {
      await Promise.all(
        securePairs.map(async ([key, value]) => {
          if (!isSecureExportKey(key)) return;
          const secretKey = fromSecureExportKey(key);
          if (value === null || value === undefined || value === '') {
            await secureStorageService.removeSecret(secretKey);
          } else {
            await secureStorageService.setSecret(secretKey, value);
          }
        }),
      );
    }

    // Re-initialize services to reload restored data
    try {
      await Promise.all([
        identityProfilesService.reload(),
        settingsService.reloadNetworks(),
      ]);
    } catch (error) {
      console.error('Error reloading services after restore:', error);
      // Don't throw - data is restored, services will reload on next access
    }
  }

  /**
   * Quick storage stats (key count and approximate size).
   */
  async getStorageStats(): Promise<{ keyCount: number; totalBytes: number }> {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await this.multiGetInChunks(keys);
    const secureEntries = await this.getSecureExportEntries();
    const totalBytes =
      entries.reduce((sum, [, value]) => sum + (value ? value.length : 0), 0) +
      secureEntries.reduce(
        (sum, [, value]) => sum + (value ? value.length : 0),
        0,
      );
    return { keyCount: keys.length + secureEntries.length, totalBytes };
  }

  /**
   * Get all storage keys.
   */
  async getAllKeys(): Promise<string[]> {
    const keys = await AsyncStorage.getAllKeys();
    const secureKeys = (await secureStorageService.getAllSecretKeys()).map(
      toSecureExportKey,
    );
    return [...keys, ...secureKeys];
  }

  /**
   * Check if the backup data contains sensitive keys that should be warned about.
   */
  checkForSensitiveData(keys: string[]): {
    hasSensitive: boolean;
    sensitiveKeys: string[];
  } {
    const sensitiveKeys = keys.filter(isSensitiveKey);
    return {
      hasSensitive: sensitiveKeys.length > 0,
      sensitiveKeys,
    };
  }

  /**
   * Encrypt backup data with a password using libsodium.
   * Returns a base64-encoded encrypted payload with salt and nonce.
   */
  async encryptBackup(json: string, password: string): Promise<string> {
    const sodium = await getSodium();

    // Generate a random salt for key derivation
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

    // Derive a key from the password
    const key = sodium.crypto_pwhash(
      sodium.crypto_secretbox_KEYBYTES,
      password,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_DEFAULT,
    );

    // Generate a random nonce
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

    // Encrypt the data (avoid TextEncoder to keep RN compatibility)
    const plaintext = sodium.from_string(json);
    const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, key);

    // Combine salt + nonce + ciphertext and encode as base64
    const combined = new Uint8Array(
      salt.length + nonce.length + ciphertext.length,
    );
    combined.set(salt, 0);
    combined.set(nonce, salt.length);
    combined.set(ciphertext, salt.length + nonce.length);

    // Create encrypted payload
    const encryptedPayload = {
      version: 1,
      encrypted: true,
      data: sodium.to_base64(combined),
    };

    return JSON.stringify(encryptedPayload);
  }

  /**
   * Decrypt backup data with a password.
   * Returns the decrypted JSON string or throws on failure.
   */
  async decryptBackup(
    encryptedJson: string,
    password: string,
  ): Promise<string> {
    const sodium = await getSodium();

    const parsed = JSON.parse(encryptedJson);
    if (!parsed.encrypted || !parsed.data) {
      throw new Error(t('Not an encrypted backup'));
    }

    // Decode the combined data
    const combined = sodium.from_base64(parsed.data);

    // Extract salt, nonce, and ciphertext
    const salt = combined.slice(0, sodium.crypto_pwhash_SALTBYTES);
    const nonce = combined.slice(
      sodium.crypto_pwhash_SALTBYTES,
      sodium.crypto_pwhash_SALTBYTES + sodium.crypto_secretbox_NONCEBYTES,
    );
    const ciphertext = combined.slice(
      sodium.crypto_pwhash_SALTBYTES + sodium.crypto_secretbox_NONCEBYTES,
    );

    // Derive the key from password
    const key = sodium.crypto_pwhash(
      sodium.crypto_secretbox_KEYBYTES,
      password,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_DEFAULT,
    );

    // Decrypt
    const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    if (!plaintext) {
      throw new Error(
        t('Decryption failed - wrong password or corrupted data'),
      );
    }

    return sodium.to_string(plaintext);
  }

  /**
   * Check if a backup string is encrypted.
   */
  isEncryptedBackup(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      return parsed.encrypted === true && typeof parsed.data === 'string';
    } catch {
      return false;
    }
  }

  /**
   * Export only specific keys.
   */
  async exportKeys(keys: string[]): Promise<string> {
    const asyncKeys = keys.filter(key => !isSecureExportKey(key));
    const entries = await this.multiGetInChunks(asyncKeys);
    const secureEntries = await this.getSecureExportEntries(keys);
    const payload = this.buildPayload(entries, secureEntries);
    return JSON.stringify(payload);
  }
}

export const dataBackupService = new DataBackupService();
