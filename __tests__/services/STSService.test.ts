/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for STSService - Wave 7
 */

import { stsService } from '../../src/services/STSService';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
}));

describe('STSService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    // Reset service state
    (stsService as any).policies = new Map();
    (stsService as any).loaded = false;
  });

  describe('Parse Cap Value', () => {
    it('should parse valid STS cap value', () => {
      const result = stsService.parseCapValue('duration=31536000,port=6697');

      expect(result).toEqual({
        duration: '31536000',
        port: '6697',
      });
    });

    it('should parse STS with preload', () => {
      const result = stsService.parseCapValue(
        'duration=31536000,port=6697,preload',
      );

      expect(result).toEqual({
        duration: '31536000',
        port: '6697',
        preload: 'true',
      });
    });

    it('should parse duration only', () => {
      const result = stsService.parseCapValue('duration=86400');

      expect(result).toEqual({
        duration: '86400',
      });
    });

    it('should return null for missing duration', () => {
      const result = stsService.parseCapValue('port=6697');

      expect(result).toBeNull();
    });

    it('should handle whitespace', () => {
      const result = stsService.parseCapValue(
        'duration = 31536000 , port = 6697',
      );

      expect(result).toEqual({
        duration: '31536000',
        port: '6697',
      });
    });

    it('should return null for empty string', () => {
      const result = stsService.parseCapValue('');

      expect(result).toBeNull();
    });
  });

  describe('Save Policy', () => {
    it('should save a new policy', () => {
      const result = stsService.savePolicy(
        'irc.example.com',
        'duration=31536000,port=6697',
      );

      expect(result).toBe(true);
      const policy = stsService.getPolicy('irc.example.com');
      expect(policy).toBeDefined();
      expect(policy?.duration).toBe(31536000);
      expect(policy?.port).toBe(6697);
      expect(policy?.hostname).toBe('irc.example.com');
    });

    it('should save policy without port', () => {
      stsService.savePolicy('irc.example.com', 'duration=86400');

      const policy = stsService.getPolicy('irc.example.com');
      expect(policy?.port).toBeNull();
    });

    it('should save policy with preload', () => {
      stsService.savePolicy('irc.example.com', 'duration=31536000,preload');

      const policy = stsService.getPolicy('irc.example.com');
      expect(policy?.preload).toBe(true);
    });

    it('should calculate expiration', () => {
      const before = Date.now();
      stsService.savePolicy('irc.example.com', 'duration=3600');
      const after = Date.now();

      const policy = stsService.getPolicy('irc.example.com');
      expect(policy?.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
      expect(policy?.expiresAt).toBeLessThanOrEqual(after + 3600 * 1000);
    });

    it('should return false for invalid cap value', () => {
      const result = stsService.savePolicy('irc.example.com', 'invalid');

      expect(result).toBe(false);
    });

    it('should remove policy when duration is 0', () => {
      stsService.savePolicy('irc.example.com', 'duration=3600');
      const result = stsService.savePolicy('irc.example.com', 'duration=0');

      expect(result).toBe(true);
      expect(stsService.getPolicy('irc.example.com')).toBeUndefined();
    });

    it('should return false for invalid duration', () => {
      const result = stsService.savePolicy('irc.example.com', 'duration=-1');

      expect(result).toBe(false);
    });

    it('should return false for invalid port', () => {
      const result = stsService.savePolicy(
        'irc.example.com',
        'duration=3600,port=abc',
      );

      expect(result).toBe(false);
    });

    it('should return false for out of range port', () => {
      expect(
        stsService.savePolicy('irc.example.com', 'duration=3600,port=0'),
      ).toBe(false);
      expect(
        stsService.savePolicy('irc.example.com', 'duration=3600,port=70000'),
      ).toBe(false);
    });

    it('should store hostname in lowercase', () => {
      stsService.savePolicy('IRC.EXAMPLE.COM', 'duration=3600');

      const policy = stsService.getPolicy('irc.example.com');
      expect(policy).toBeDefined();
    });
  });

  describe('Get Policy', () => {
    it('should return undefined for non-existent policy', () => {
      expect(stsService.getPolicy('nonexistent.com')).toBeUndefined();
    });

    it('should return policy for existing host', () => {
      stsService.savePolicy('irc.example.com', 'duration=3600');

      const policy = stsService.getPolicy('irc.example.com');
      expect(policy).toBeDefined();
    });

    it('should be case insensitive', () => {
      stsService.savePolicy('irc.example.com', 'duration=3600');

      expect(stsService.getPolicy('IRC.EXAMPLE.COM')).toBeDefined();
    });

    it('should return undefined and delete expired policy', () => {
      // Create a policy that expires immediately
      stsService.savePolicy('irc.example.com', 'duration=1');
      const storedPolicy = (stsService as any).policies.get('irc.example.com');
      storedPolicy.expiresAt = Date.now() - 1;

      // Policy should be expired
      expect(stsService.getPolicy('irc.example.com')).toBeUndefined();
    });
  });

  describe('Check Connection', () => {
    it('should allow connection without policy', () => {
      const result = stsService.checkConnection('new.example.com', 6667, false);

      expect(result.shouldUpgrade).toBe(false);
      expect(result.tlsRequired).toBe(false);
    });

    it('should require upgrade when TLS not used but policy exists', () => {
      stsService.savePolicy('irc.example.com', 'duration=3600,port=6697');

      const result = stsService.checkConnection('irc.example.com', 6667, false);

      expect(result.shouldUpgrade).toBe(true);
      expect(result.tlsRequired).toBe(true);
      expect(result.targetPort).toBe(6697);
    });

    it('should not require upgrade when already using TLS', () => {
      stsService.savePolicy('irc.example.com', 'duration=3600');

      const result = stsService.checkConnection('irc.example.com', 6697, true);

      expect(result.shouldUpgrade).toBe(false);
      expect(result.tlsRequired).toBe(true);
    });

    it('should require port change when TLS on wrong port', () => {
      stsService.savePolicy('irc.example.com', 'duration=3600,port=6697');

      const result = stsService.checkConnection('irc.example.com', 9999, true);

      expect(result.shouldUpgrade).toBe(true);
      expect(result.targetPort).toBe(6697);
    });

    it('should use default port when policy has no port', () => {
      stsService.savePolicy('irc.example.com', 'duration=3600');

      const result = stsService.checkConnection('irc.example.com', 6667, false);

      expect(result.targetPort).toBe(6697);
    });
  });

  describe('Remove Policy', () => {
    it('should remove existing policy', () => {
      stsService.savePolicy('irc.example.com', 'duration=3600');

      const result = stsService.removePolicy('irc.example.com');

      expect(result).toBe(true);
      expect(stsService.getPolicy('irc.example.com')).toBeUndefined();
    });

    it('should return false for non-existent policy', () => {
      const result = stsService.removePolicy('nonexistent.com');

      expect(result).toBe(false);
    });

    it('should be case insensitive', () => {
      stsService.savePolicy('irc.example.com', 'duration=3600');

      stsService.removePolicy('IRC.EXAMPLE.COM');

      expect(stsService.getPolicy('irc.example.com')).toBeUndefined();
    });
  });

  describe('Get All Policies', () => {
    it('should return empty array when no policies', () => {
      const policies = stsService.getAllPolicies();

      expect(policies).toEqual([]);
    });

    it('should return all active policies', () => {
      stsService.savePolicy('irc1.example.com', 'duration=3600');
      stsService.savePolicy('irc2.example.com', 'duration=7200');

      const policies = stsService.getAllPolicies();

      expect(policies).toHaveLength(2);
    });

    it('should not include expired policies', () => {
      stsService.savePolicy('irc.example.com', 'duration=3600');

      const policies = stsService.getAllPolicies();
      expect(policies).toHaveLength(1);
    });
  });

  describe('Clear All Policies', () => {
    it('should clear internal policies map', async () => {
      // Add policies directly to the internal map
      (stsService as any).policies.set('irc1.example.com', {
        hostname: 'irc1.example.com',
        duration: 3600,
      });
      (stsService as any).policies.set('irc2.example.com', {
        hostname: 'irc2.example.com',
        duration: 7200,
      });

      expect((stsService as any).policies.size).toBe(2);

      await stsService.clearAllPolicies();

      // After clearing, there should be no policies
      expect((stsService as any).policies.size).toBe(0);
    });
  });

  describe('Storage', () => {
    it('should save policies to storage', async () => {
      stsService.savePolicy('irc.example.com', 'duration=3600');

      await new Promise(resolve => setTimeout(resolve, 50));

      const { setItem } = require('@react-native-async-storage/async-storage');
      expect(setItem).toHaveBeenCalledWith('STS_POLICIES', expect.any(String));
    });

    it('should load policies from storage', async () => {
      mockStorage['STS_POLICIES'] = JSON.stringify({
        'irc.example.com': {
          hostname: 'irc.example.com',
          port: 6697,
          duration: 3600,
          expiresAt: Date.now() + 3600000,
          preload: false,
        },
      });

      // Create new service instance to trigger load
      const { STSService } = require('../../src/services/STSService');
      const newService = new STSService();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(newService.getPolicy('irc.example.com')).toBeDefined();
    });

    it('should prune expired policies on load', async () => {
      mockStorage['STS_POLICIES'] = JSON.stringify({
        'expired.example.com': {
          hostname: 'expired.example.com',
          port: 6697,
          duration: 1,
          expiresAt: Date.now() - 1000, // Already expired
          preload: false,
        },
      });

      const { STSService } = require('../../src/services/STSService');
      const newService = new STSService();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(newService.getPolicy('expired.example.com')).toBeUndefined();
    });
  });
});
