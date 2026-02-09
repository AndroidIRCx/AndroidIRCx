/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { tx } from '../i18n/transifex';
import { identityProfilesService } from './IdentityProfilesService';
import { settingsService } from './SettingsService';

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
  '@AndroidIRCX:secure:',  // SecureStorage fallback keys
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
  return SENSITIVE_KEY_PATTERNS.some(pattern => keyLower.includes(pattern.toLowerCase()));
}

export interface BackupPayload {
  version: number;
  createdAt: string;
  data: Record<string, string | null>;
}

class DataBackupService {
  /**
   * Export all AsyncStorage data into a single JSON string.
   */
  async exportAll(): Promise<string> {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await AsyncStorage.multiGet(keys);
    const payload: BackupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: {},
    };
    entries.forEach(([key, value]) => {
      payload.data[key] = value;
    });
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
      if (key.startsWith('MESSAGES_')) return false;

      // Exclude channel logs
      if (key === 'channelLogs' || key.startsWith('channelLogs:')) return false;

      // Exclude any other log-related keys
      if (key.includes('log') && !key.includes('login')) return false;

      // Include everything else (networks, settings, profiles, etc.)
      return true;
    });

    const entries = await AsyncStorage.multiGet(filteredKeys);
    const payload: BackupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: {},
    };
    entries.forEach(([key, value]) => {
      payload.data[key] = value;
    });
    return JSON.stringify(payload);
  }

  /**
   * Import data from a JSON string produced by exportAll.
   * Existing keys will be overwritten.
   */
  async importAll(json: string): Promise<void> {
    const parsed: BackupPayload = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !parsed.data) {
      throw new Error(t('Invalid backup format'));
    }
    const pairs = Object.entries(parsed.data).map(([key, value]) => [key, value] as [string, string | null]);
    await AsyncStorage.multiSet(pairs);
    
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
    const entries = await AsyncStorage.multiGet(keys);
    const totalBytes = entries.reduce((sum, [, value]) => sum + (value ? value.length : 0), 0);
    return { keyCount: keys.length, totalBytes };
  }

  /**
   * Get all storage keys.
   */
  async getAllKeys(): Promise<string[]> {
    return await AsyncStorage.getAllKeys();
  }

  /**
   * Check if the backup data contains sensitive keys that should be warned about.
   */
  checkForSensitiveData(keys: string[]): { hasSensitive: boolean; sensitiveKeys: string[] } {
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
      sodium.crypto_pwhash_ALG_DEFAULT
    );

    // Generate a random nonce
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

    // Encrypt the data (avoid TextEncoder to keep RN compatibility)
    const plaintext = sodium.from_string(json);
    const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, key);

    // Combine salt + nonce + ciphertext and encode as base64
    const combined = new Uint8Array(salt.length + nonce.length + ciphertext.length);
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
  async decryptBackup(encryptedJson: string, password: string): Promise<string> {
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
      sodium.crypto_pwhash_SALTBYTES + sodium.crypto_secretbox_NONCEBYTES
    );
    const ciphertext = combined.slice(
      sodium.crypto_pwhash_SALTBYTES + sodium.crypto_secretbox_NONCEBYTES
    );

    // Derive the key from password
    const key = sodium.crypto_pwhash(
      sodium.crypto_secretbox_KEYBYTES,
      password,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_DEFAULT
    );

    // Decrypt
    const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    if (!plaintext) {
      throw new Error(t('Decryption failed - wrong password or corrupted data'));
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
    const entries = await AsyncStorage.multiGet(keys);
    const payload: BackupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: {},
    };
    entries.forEach(([key, value]) => {
      payload.data[key] = value;
    });
    return JSON.stringify(payload);
  }
}

export const dataBackupService = new DataBackupService();
