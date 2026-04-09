/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ChannelEncryptionSettingsService - 100% coverage target
 */

import { channelEncryptionSettingsService } from '../../src/services/ChannelEncryptionSettingsService';

// Mock AsyncStorage
const mockStorage: Map<string, string> = new Map();
const mockGetAllKeys: string[] = [];

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
    if (!mockGetAllKeys.includes(key)) {
      mockGetAllKeys.push(key);
    }
  }),
  getItem: jest.fn(async (key: string) => {
    return mockStorage.get(key) || null;
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStorage.delete(key);
    const index = mockGetAllKeys.indexOf(key);
    if (index > -1) {
      mockGetAllKeys.splice(index, 1);
    }
  }),
  getAllKeys: jest.fn(async () => {
    return [...mockGetAllKeys];
  }),
}));

describe('ChannelEncryptionSettingsService', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockGetAllKeys.length = 0;
    // Clear listeners
    (channelEncryptionSettingsService as any).listeners = [];
    jest.clearAllMocks();
  });

  describe('getAlwaysEncrypt', () => {
    it('should return false when no setting exists', async () => {
      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(false);
    });

    it('should return the stored setting value', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        true,
      );
      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(true);
    });

    it('should return false when stored value is false', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        false,
      );
      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(false);
    });

    it('should handle storage errors gracefully', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(false);
    });

    it('should canonicalize network name (remove port)', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode (6697)',
        true,
      );
      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(true);
    });

    it('should handle empty network', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        '',
        true,
      );
      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        '',
      );
      expect(result).toBe(true);
    });

    it('should be case insensitive', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#GENERAL',
        'FREENODE',
        true,
      );
      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(true);
    });
  });

  describe('setAlwaysEncrypt', () => {
    it('should set the encryption setting', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        true,
      );

      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(true);
    });

    it('should notify listeners when setting changes', async () => {
      const listener = jest.fn();
      channelEncryptionSettingsService.onAlwaysEncryptChange(listener);

      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        true,
      );

      expect(listener).toHaveBeenCalledWith('#general', 'freenode', true);
    });

    it('should notify multiple listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      channelEncryptionSettingsService.onAlwaysEncryptChange(listener1);
      channelEncryptionSettingsService.onAlwaysEncryptChange(listener2);

      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        true,
      );

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should handle storage errors and throw', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        channelEncryptionSettingsService.setAlwaysEncrypt(
          '#general',
          'freenode',
          true,
        ),
      ).rejects.toThrow('Storage error');
    });
  });

  describe('removeAlwaysEncrypt', () => {
    it('should remove the encryption setting', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        true,
      );
      await channelEncryptionSettingsService.removeAlwaysEncrypt(
        '#general',
        'freenode',
      );

      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(false);
    });

    it('should notify listeners with false value', async () => {
      const listener = jest.fn();
      channelEncryptionSettingsService.onAlwaysEncryptChange(listener);

      await channelEncryptionSettingsService.removeAlwaysEncrypt(
        '#general',
        'freenode',
      );

      expect(listener).toHaveBeenCalledWith('#general', 'freenode', false);
    });

    it('should handle storage errors and throw', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.removeItem.mockRejectedValueOnce(new Error('Storage error'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        channelEncryptionSettingsService.removeAlwaysEncrypt(
          '#general',
          'freenode',
        ),
      ).rejects.toThrow('Storage error');
    });
  });

  describe('toggleAlwaysEncrypt', () => {
    it('should toggle from false to true', async () => {
      const result = await channelEncryptionSettingsService.toggleAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(true);

      const stored = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(stored).toBe(true);
    });

    it('should toggle from true to false', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        true,
      );
      const result = await channelEncryptionSettingsService.toggleAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(false);
    });

    it('should return the new value', async () => {
      const newValue =
        await channelEncryptionSettingsService.toggleAlwaysEncrypt(
          '#general',
          'freenode',
        );
      expect(typeof newValue).toBe('boolean');
    });
  });

  describe('onAlwaysEncryptChange', () => {
    it('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe =
        channelEncryptionSettingsService.onAlwaysEncryptChange(listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe listener', async () => {
      const listener = jest.fn();
      const unsubscribe =
        channelEncryptionSettingsService.onAlwaysEncryptChange(listener);

      unsubscribe();

      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        true,
      );

      expect(listener).not.toHaveBeenCalled();
    });

    it('should only unsubscribe the specific listener', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const unsubscribe1 =
        channelEncryptionSettingsService.onAlwaysEncryptChange(listener1);
      channelEncryptionSettingsService.onAlwaysEncryptChange(listener2);

      unsubscribe1();

      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        true,
      );

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('getAllAlwaysEncryptChannels', () => {
    it('should return empty array when no channels set', async () => {
      const result =
        await channelEncryptionSettingsService.getAllAlwaysEncryptChannels();
      expect(result).toEqual([]);
    });

    it('should return channels with alwaysEncrypt enabled', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        true,
      );
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#random',
        'libera',
        true,
      );

      const result =
        await channelEncryptionSettingsService.getAllAlwaysEncryptChannels();

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        channel: '#general',
        network: 'freenode',
      });
      expect(result).toContainEqual({ channel: '#random', network: 'libera' });
    });

    it('should not return channels with alwaysEncrypt disabled', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        true,
      );
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#secret',
        'freenode',
        false,
      );

      const result =
        await channelEncryptionSettingsService.getAllAlwaysEncryptChannels();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ channel: '#general', network: 'freenode' });
    });

    it('should handle storage errors gracefully', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getAllKeys.mockRejectedValueOnce(new Error('Storage error'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const result =
        await channelEncryptionSettingsService.getAllAlwaysEncryptChannels();
      expect(result).toEqual([]);
    });

    it('should ignore malformed keys', async () => {
      // Manually add a malformed key
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem(
        'encstg:alwaysenc:malformed-key',
        JSON.stringify({ alwaysEncrypt: true }),
      );

      const result =
        await channelEncryptionSettingsService.getAllAlwaysEncryptChannels();
      expect(result).toHaveLength(0);
    });

    it('should handle invalid JSON in storage', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem(
        'encstg:alwaysenc:freenode:#general',
        'invalid json',
      );

      const result =
        await channelEncryptionSettingsService.getAllAlwaysEncryptChannels();
      expect(result).toHaveLength(0);
    });
  });

  describe('canonicalizeNetwork', () => {
    it('should remove port suffix from network name', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'irc.freenode.net (6667)',
        true,
      );
      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'irc.freenode.net',
      );
      expect(result).toBe(true);
    });

    it('should handle network without port', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        'freenode',
        true,
      );
      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(true);
    });

    it('should handle empty network', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        '',
        true,
      );
      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        '',
      );
      expect(result).toBe(true);
    });

    it('should handle whitespace in network name', async () => {
      await channelEncryptionSettingsService.setAlwaysEncrypt(
        '#general',
        '  freenode  ',
        true,
      );
      const result = await channelEncryptionSettingsService.getAlwaysEncrypt(
        '#general',
        'freenode',
      );
      expect(result).toBe(true);
    });
  });
});
