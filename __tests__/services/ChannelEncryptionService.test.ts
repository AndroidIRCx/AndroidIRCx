/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ChannelEncryptionService - Wave 2 coverage target
 */

import { channelEncryptionService } from '../../src/services/ChannelEncryptionService';
import { secureStorageService } from '../../src/services/SecureStorageService';

// Mock libsodium
jest.mock('react-native-libsodium', () => ({
  __esModule: true,
  default: {
    ready: Promise.resolve(),
    randombytes_buf: jest.fn().mockReturnValue(new Uint8Array(32)),
    crypto_aead_xchacha20poly1305_ietf_encrypt: jest
      .fn()
      .mockReturnValue(new Uint8Array([1, 2, 3])),
    crypto_aead_xchacha20poly1305_ietf_decrypt: jest
      .fn()
      .mockReturnValue(new Uint8Array([72, 101, 108, 108, 111])),
    crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: 24,
    to_base64: jest.fn().mockReturnValue('bW9ja2tleQ=='),
    from_base64: jest.fn().mockReturnValue(new Uint8Array(32)),
  },
}));

jest.mock('../../src/services/SecureStorageService', () => ({
  secureStorageService: {
    setSecret: jest.fn().mockResolvedValue(undefined),
    getSecret: jest.fn().mockResolvedValue(null),
    removeSecret: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('ChannelEncryptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset key listeners
    (channelEncryptionService as any).keyListeners = [];
  });

  describe('generateChannelKey', () => {
    it('should generate a new channel key', async () => {
      const key = await channelEncryptionService.generateChannelKey(
        '#general',
        'freenode',
      );

      expect(key.v).toBe(1);
      expect(key.channel).toBe('#general');
      expect(key.network).toBe('freenode');
      expect(key.key).toBeDefined();
      expect(key.createdAt).toBeGreaterThan(0);
    });

    it('should canonicalize network name', async () => {
      const key = await channelEncryptionService.generateChannelKey(
        '#general',
        'freenode (2)',
      );

      expect(key.network).toBe('freenode');
    });

    it('should store the generated key', async () => {
      await channelEncryptionService.generateChannelKey('#general', 'freenode');

      expect(secureStorageService.setSecret).toHaveBeenCalled();
    });

    it('should notify listeners', async () => {
      const listener = jest.fn();
      channelEncryptionService.onChannelKeyChange(listener);

      await channelEncryptionService.generateChannelKey('#general', 'freenode');

      expect(listener).toHaveBeenCalledWith('#general', 'freenode');
    });
  });

  describe('storeChannelKey / getChannelKey', () => {
    it('should store and retrieve channel key', async () => {
      const channelKey = {
        v: 1 as const,
        channel: '#general',
        network: 'freenode',
        key: 'testkey123',
        createdAt: Date.now(),
      };

      await channelEncryptionService.storeChannelKey(channelKey);

      (secureStorageService.getSecret as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(channelKey),
      );
      const retrieved = await channelEncryptionService.getChannelKey(
        '#general',
        'freenode',
      );

      expect(retrieved).toMatchObject({
        channel: '#general',
        network: 'freenode',
      });
    });

    it('should return null for non-existent key', async () => {
      const result = await channelEncryptionService.getChannelKey(
        '#nonexistent',
        'freenode',
      );
      expect(result).toBeNull();
    });

    it('should notify listeners when storing', async () => {
      const listener = jest.fn();
      channelEncryptionService.onChannelKeyChange(listener);

      const channelKey = {
        v: 1 as const,
        channel: '#general',
        network: 'freenode',
        key: 'testkey123',
        createdAt: Date.now(),
      };
      await channelEncryptionService.storeChannelKey(channelKey);

      expect(listener).toHaveBeenCalledWith('#general', 'freenode');
    });
  });

  describe('hasChannelKey', () => {
    it('should return true if key exists', async () => {
      const channelKey = {
        v: 1 as const,
        channel: '#general',
        network: 'freenode',
        key: 'testkey123',
        createdAt: Date.now(),
      };
      (secureStorageService.getSecret as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(channelKey),
      );

      const result = await channelEncryptionService.hasChannelKey(
        '#general',
        'freenode',
      );

      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      const result = await channelEncryptionService.hasChannelKey(
        '#nonexistent',
        'freenode',
      );
      expect(result).toBe(false);
    });
  });

  describe('removeChannelKey', () => {
    it('should remove channel key', async () => {
      await channelEncryptionService.removeChannelKey('#general', 'freenode');

      expect(secureStorageService.removeSecret).toHaveBeenCalled();
    });

    it('should notify listeners', async () => {
      const listener = jest.fn();
      channelEncryptionService.onChannelKeyChange(listener);

      await channelEncryptionService.removeChannelKey('#general', 'freenode');

      expect(listener).toHaveBeenCalledWith('#general', 'freenode');
    });
  });

  describe('exportChannelKey', () => {
    it('should export channel key as JSON', async () => {
      const channelKey = {
        v: 1 as const,
        channel: '#general',
        network: 'freenode',
        key: 'testkey123',
        createdAt: Date.now(),
      };
      (secureStorageService.getSecret as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(channelKey),
      );

      const exported = await channelEncryptionService.exportChannelKey(
        '#general',
        'freenode',
      );

      expect(JSON.parse(exported)).toMatchObject({
        channel: '#general',
        network: 'freenode',
      });
    });

    it('should throw if no key exists', async () => {
      (secureStorageService.getSecret as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        channelEncryptionService.exportChannelKey('#general', 'freenode'),
      ).rejects.toThrow('no channel key');
    });
  });

  describe('importChannelKey', () => {
    it('should import channel key from JSON', async () => {
      const keyData = JSON.stringify({
        v: 1,
        channel: '#general',
        network: 'freenode',
        key: 'testkey123',
        createdAt: Date.now(),
      });

      const imported = await channelEncryptionService.importChannelKey(keyData);

      expect(imported.channel).toBe('#general');
      expect(secureStorageService.setSecret).toHaveBeenCalled();
    });

    it('should allow network override', async () => {
      const keyData = JSON.stringify({
        v: 1,
        channel: '#general',
        network: 'sender-network',
        key: 'testkey123',
        createdAt: Date.now(),
      });

      const imported = await channelEncryptionService.importChannelKey(
        keyData,
        'my-network',
      );

      expect(imported.network).toBe('my-network');
    });

    it('should throw for invalid version', async () => {
      const keyData = JSON.stringify({
        v: 2,
        channel: '#general',
        network: 'freenode',
        key: 'testkey123',
      });

      await expect(
        channelEncryptionService.importChannelKey(keyData),
      ).rejects.toThrow('invalid version');
    });
  });

  describe('onChannelKeyChange', () => {
    it('should register listener and return cleanup function', () => {
      const listener = jest.fn();
      const cleanup = channelEncryptionService.onChannelKeyChange(listener);

      expect(typeof cleanup).toBe('function');
      expect((channelEncryptionService as any).keyListeners).toContain(
        listener,
      );

      cleanup();
      expect((channelEncryptionService as any).keyListeners).not.toContain(
        listener,
      );
    });

    it('should notify all listeners when key changes', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      channelEncryptionService.onChannelKeyChange(listener1);
      channelEncryptionService.onChannelKeyChange(listener2);

      await channelEncryptionService.generateChannelKey('#general', 'freenode');

      expect(listener1).toHaveBeenCalledWith('#general', 'freenode');
      expect(listener2).toHaveBeenCalledWith('#general', 'freenode');
    });
  });

  describe('canonicalizeNetwork', () => {
    it('should remove numbered suffix from network name', async () => {
      // First generate a key with canonical name
      await channelEncryptionService.generateChannelKey('#general', 'freenode');

      // Then mock the storage to return it when looking up with suffix
      const channelKey = {
        v: 1,
        channel: '#general',
        network: 'freenode',
        key: 'testkey123',
        createdAt: Date.now(),
      };
      (secureStorageService.getSecret as jest.Mock).mockImplementation(
        (key: string) => {
          if (key.includes('freenode:')) {
            return Promise.resolve(JSON.stringify(channelKey));
          }
          return Promise.resolve(null);
        },
      );

      // Should find key regardless of numbered suffix
      const result = await channelEncryptionService.getChannelKey(
        '#general',
        'freenode (3)',
      );

      expect(result).toMatchObject({ network: 'freenode' });
    });

    it('should handle empty network name', async () => {
      const channelKey = {
        v: 1,
        channel: '#general',
        network: '',
        key: 'testkey123',
        createdAt: Date.now(),
      };
      (secureStorageService.getSecret as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(channelKey),
      );

      const result = await channelEncryptionService.getChannelKey(
        '#general',
        '',
      );

      expect(result?.network).toBe('');
    });
  });
});
