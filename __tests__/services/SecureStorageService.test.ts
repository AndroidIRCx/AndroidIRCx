/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for SecureStorageService
 *
 * Note: These tests focus on the AsyncStorage fallback mode since
 * Keychain is optional and may not be available in test environment
 */

// Mock react-native-keychain to be unavailable (force AsyncStorage fallback)
jest.mock('react-native-keychain', () => null);

import { secureStorageService } from '../../src/services/SecureStorageService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('SecureStorageService', () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset();
  });

  describe('setSecret', () => {
    it('should store secret in AsyncStorage as fallback', async () => {
      await secureStorageService.setSecret('test-key', 'secret-value');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@AndroidIRCX:secure:test-key',
        'secret-value',
      );
    });

    it('should retrieve secret from AsyncStorage fallback', async () => {
      await AsyncStorage.setItem(
        '@AndroidIRCX:secure:test-key',
        'secret-value',
      );

      const result = await secureStorageService.getSecret('test-key');

      expect(result).toBe('secret-value');
    });

    it('should return null for non-existent fallback secret', async () => {
      const result = await secureStorageService.getSecret('non-existent');

      expect(result).toBeNull();
    });

    it('should remove fallback secret from AsyncStorage', async () => {
      await AsyncStorage.setItem('@AndroidIRCX:secure:test-key', 'value');

      await secureStorageService.removeSecret('test-key');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@AndroidIRCX:secure:test-key',
      );
    });

    it('should list all fallback secret keys', async () => {
      await AsyncStorage.setItem('@AndroidIRCX:secure:key1', 'value1');
      await AsyncStorage.setItem('@AndroidIRCX:secure:key2', 'value2');
      await AsyncStorage.setItem('@AndroidIRCX:other', 'value3');

      const keys = await secureStorageService.getAllSecretKeys();

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).not.toContain('other');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in keys', async () => {
      await secureStorageService.setSecret('key:with:colons', 'value');
      await secureStorageService.setSecret('key-with-dashes', 'value');
      await secureStorageService.setSecret('key_with_underscores', 'value');

      const keys = await secureStorageService.getAllSecretKeys();

      expect(keys).toContain('key:with:colons');
      expect(keys).toContain('key-with-dashes');
      expect(keys).toContain('key_with_underscores');
    });

    it('should handle special characters in values', async () => {
      const specialValue =
        'value with "quotes" and \'apostrophes\' & symbols <>';
      await secureStorageService.setSecret('test-key', specialValue);

      const result = await secureStorageService.getSecret('test-key');
      expect(result).toBe(specialValue);
    });

    it('should handle very long values', async () => {
      const longValue = 'a'.repeat(10000);
      await secureStorageService.setSecret('test-key', longValue);

      const result = await secureStorageService.getSecret('test-key');
      expect(result).toBe(longValue);
    });

    it('should handle Unicode characters', async () => {
      const unicodeValue = '测试 🔒 パスワード';
      await secureStorageService.setSecret('test-key', unicodeValue);

      const result = await secureStorageService.getSecret('test-key');
      expect(result).toBe(unicodeValue);
    });

    it('should handle rapid concurrent operations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(secureStorageService.setSecret(`key${i}`, `value${i}`));
      }

      await Promise.all(promises);

      const keys = await secureStorageService.getAllSecretKeys();
      expect(keys.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle setting then immediately getting', async () => {
      await secureStorageService.setSecret('test-key', 'test-value');

      const result = await secureStorageService.getSecret('test-key');
      expect(result).toBe('test-value');
    });

    it('should handle removing non-existent secret', async () => {
      await expect(
        secureStorageService.removeSecret('non-existent'),
      ).resolves.not.toThrow();
    });

    it('should handle updating existing secret', async () => {
      await secureStorageService.setSecret('test-key', 'old-value');
      await secureStorageService.setSecret('test-key', 'new-value');

      const keys = await secureStorageService.getAllSecretKeys();
      const count = keys.filter(k => k === 'test-key').length;
      expect(count).toBe(1);
    });
  });

  describe('index management', () => {
    it('should maintain index integrity after multiple operations', async () => {
      await secureStorageService.setSecret('key1', 'value1');
      await secureStorageService.setSecret('key2', 'value2');
      await secureStorageService.removeSecret('key1');
      await secureStorageService.setSecret('key3', 'value3');

      const keys = await secureStorageService.getAllSecretKeys();

      expect(keys).not.toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should handle missing index gracefully', async () => {
      // Don't create index first
      const keys = await secureStorageService.getAllSecretKeys();
      expect(keys).toEqual([]);
    });
  });
});
