/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for BanService - Wave 6
 */

import { banService, BAN_MASK_TYPES } from '../../src/services/BanService';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
}));

const DEFAULT_REASONS = [
  { id: 'spam', text: 'Spamming', isDefault: true },
  { id: 'flood', text: 'Flooding', isDefault: true },
  { id: 'abuse', text: 'Abusive behavior', isDefault: true },
];

describe('BanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    // Reset service state
    (banService as any).predefinedReasons = [...DEFAULT_REASONS];
    (banService as any).defaultBanType = 2;
    (banService as any).initialized = false;
    (banService as any).initPromise = null;
  });

  describe('Ban Mask Generation', () => {
    const testNick = 'John';
    const testUser = 'john';
    const testHost = '192.168.1.100';

    it('should generate ban mask type 0 (*!user@host)', () => {
      const mask = banService.generateBanMask(testNick, testUser, testHost, 0);
      expect(mask).toBe('*!john@192.168.1.100');
    });

    it('should generate ban mask type 1 (*!*user@host)', () => {
      const mask = banService.generateBanMask(testNick, testUser, testHost, 1);
      expect(mask).toBe('*!*john@192.168.1.100');
    });

    it('should generate ban mask type 2 (*!*@host)', () => {
      const mask = banService.generateBanMask(testNick, testUser, testHost, 2);
      expect(mask).toBe('*!*@192.168.1.100');
    });

    it('should generate ban mask type 3 (*!*user@*.domain)', () => {
      const mask = banService.generateBanMask(
        testNick,
        testUser,
        'irc.example.com',
        3,
      );
      expect(mask).toBe('*!*john@*.example.com');
    });

    it('should generate ban mask type 4 (*!*@*.domain)', () => {
      const mask = banService.generateBanMask(
        testNick,
        testUser,
        'irc.example.com',
        4,
      );
      expect(mask).toBe('*!*@*.example.com');
    });

    it('should generate ban mask type 5 (nick!user@host)', () => {
      const mask = banService.generateBanMask(testNick, testUser, testHost, 5);
      expect(mask).toBe('John!john@192.168.1.100');
    });

    it('should generate ban mask type 6 (nick!*user@host)', () => {
      const mask = banService.generateBanMask(testNick, testUser, testHost, 6);
      expect(mask).toBe('John!*john@192.168.1.100');
    });

    it('should generate ban mask type 7 (nick!*@host)', () => {
      const mask = banService.generateBanMask(testNick, testUser, testHost, 7);
      expect(mask).toBe('John!*@192.168.1.100');
    });

    it('should generate ban mask type 10 (nick!*@*)', () => {
      const mask = banService.generateBanMask(testNick, testUser, testHost, 10);
      expect(mask).toBe('John!*@*');
    });

    it('should generate ban mask type 11 (*!ident@*)', () => {
      const mask = banService.generateBanMask(testNick, testUser, testHost, 11);
      expect(mask).toBe('*!john@*');
    });

    it('should handle invalid ban type gracefully', () => {
      const mask = banService.generateBanMask(testNick, testUser, testHost, 99);
      expect(mask).toBe('*!*@192.168.1.100'); // defaults to type 2
    });

    it('should strip ~ from username', () => {
      const mask = banService.generateBanMask(testNick, '~john', testHost, 0);
      expect(mask).toBe('*!john@192.168.1.100');
    });

    it('should process IP addresses with wildcard for types 3,4,8,9', () => {
      const mask3 = banService.generateBanMask(
        testNick,
        testUser,
        '192.168.1.100',
        3,
      );
      expect(mask3).toBe('*!*john@192.168.1.*');

      const mask4 = banService.generateBanMask(
        testNick,
        testUser,
        '192.168.1.100',
        4,
      );
      expect(mask4).toBe('*!*@192.168.1.*');
    });
  });

  describe('Ban Mask Types', () => {
    it('should export all ban mask types', () => {
      expect(BAN_MASK_TYPES).toHaveLength(12);
      expect(BAN_MASK_TYPES[0].pattern).toBe('*!user@host');
      expect(BAN_MASK_TYPES[11].pattern).toBe('*!ident@*');
    });

    it('should get ban mask types', () => {
      const types = banService.getBanMaskTypes();
      expect(types).toEqual(BAN_MASK_TYPES);
    });
  });

  describe('Default Ban Type', () => {
    it('should have default ban type 2', () => {
      expect(banService.getDefaultBanType()).toBe(2);
    });

    it('should set default ban type', () => {
      banService.setDefaultBanType(5);
      expect(banService.getDefaultBanType()).toBe(5);
    });

    it('should not set invalid ban types', () => {
      banService.setDefaultBanType(5);
      banService.setDefaultBanType(-1);
      expect(banService.getDefaultBanType()).toBe(5);

      banService.setDefaultBanType(99);
      expect(banService.getDefaultBanType()).toBe(5);
    });
  });

  describe('Predefined Reasons', () => {
    it('should get default predefined reasons', () => {
      const reasons = banService.getPredefinedReasons();
      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons[0].id).toBeDefined();
    });

    it('should return a copy of reasons', () => {
      const reasons1 = banService.getPredefinedReasons();
      const reasons2 = banService.getPredefinedReasons();
      expect(reasons1).toEqual(reasons2);
      expect(reasons1).not.toBe(reasons2);
    });
  });

  describe('Initialize', () => {
    it('should initialize and load stored reasons', async () => {
      const customReasons = [{ id: 'custom', text: 'Custom reason' }];
      mockStorage['@AndroidIRCX:banReasons'] = JSON.stringify(customReasons);

      await banService.initialize();
      const reasons = banService.getPredefinedReasons();

      expect(reasons).toEqual(customReasons);
    });

    it('should handle initialization race condition', async () => {
      const init1 = banService.initialize();
      const init2 = banService.initialize();
      await Promise.all([init1, init2]);

      expect(await init1).toBeUndefined();
      expect(await init2).toBeUndefined();
    });

    it('should handle storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { getItem } = require('@react-native-async-storage/async-storage');
      getItem.mockRejectedValueOnce(new Error('Storage error'));

      await banService.initialize();
      const reasons = banService.getPredefinedReasons();

      expect(reasons.length).toBeGreaterThan(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should skip loading if stored reasons are empty array', async () => {
      mockStorage['@AndroidIRCX:banReasons'] = JSON.stringify([]);

      await banService.initialize();
      const reasons = banService.getPredefinedReasons();

      expect(reasons.length).toBeGreaterThan(0);
    });
  });

  describe('Modify Reasons', () => {
    beforeEach(async () => {
      await banService.initialize();
    });

    it('should set predefined reasons', async () => {
      const newReasons = [{ id: 'test', text: 'Test reason' }];
      await banService.setPredefinedReasons(newReasons);

      expect(banService.getPredefinedReasons()).toEqual(newReasons);
    });

    it('should add predefined reason', async () => {
      const newReason = { id: 'new', text: 'New reason' };
      await banService.addPredefinedReason(newReason);

      const reasons = banService.getPredefinedReasons();
      expect(reasons).toContainEqual(newReason);
    });

    it('should remove predefined reason', async () => {
      await banService.removePredefinedReason('spam');

      const reasons = banService.getPredefinedReasons();
      expect(reasons.find(r => r.id === 'spam')).toBeUndefined();
    });

    it('should reset to default reasons', async () => {
      await banService.setPredefinedReasons([{ id: 'custom', text: 'Custom' }]);
      await banService.resetToDefaultReasons();

      const reasons = banService.getPredefinedReasons();
      expect(reasons.length).toBeGreaterThan(1);
      expect(reasons.find(r => r.id === 'spam')).toBeDefined();
    });

    it('should save to storage when modifying reasons', async () => {
      const { setItem } = require('@react-native-async-storage/async-storage');

      await banService.addPredefinedReason({ id: 'test', text: 'Test' });

      expect(setItem).toHaveBeenCalledWith(
        '@AndroidIRCX:banReasons',
        expect.any(String),
      );
    });

    it('should handle storage errors when saving', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const { setItem } = require('@react-native-async-storage/async-storage');
      setItem.mockRejectedValueOnce(new Error('Save error'));

      await banService.addPredefinedReason({ id: 'test', text: 'Test' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
