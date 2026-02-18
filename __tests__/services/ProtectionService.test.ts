/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ProtectionService
 */

import { protectionService } from '../../src/services/ProtectionService';
import type { IRCMessage } from '../../src/services/IRCService';

describe('ProtectionService', () => {
  beforeEach(() => {
    // Reset the service state before each test
    // @ts-ignore - accessing private properties for testing
    protectionService.floodBuckets.clear();
    // @ts-ignore
    protectionService.netFloodBuckets.clear();
    // Clear protected callback
    protectionService.setProtectedCheckCallback(null as any);
  });

  describe('Basic functionality', () => {
    it('exports singleton', () => {
      expect(protectionService).toBeDefined();
      expect(typeof protectionService).toBe('object');
    });

    it('should initialize without errors', async () => {
      await expect(protectionService.initialize()).resolves.not.toThrow();
    });
  });

  describe('setProtectedCheckCallback', () => {
    it('should set the protected check callback', () => {
      const callback = jest.fn().mockReturnValue(false);
      protectionService.setProtectedCheckCallback(callback);
      
      // The callback should be stored (we'll verify it works via evaluateIncomingMessage)
      expect(callback).not.toHaveBeenCalled(); // Not called yet
    });
  });

  describe('Protected user bypass', () => {
    it('should return null decision for protected users', () => {
      const callback = jest.fn().mockReturnValue(true); // User is protected
      protectionService.setProtectedCheckCallback(callback);

      const message: IRCMessage = {
        type: 'message',
        from: 'protecteduser',
        text: 'spam message with http://link.com',
        channel: '#test',
        network: 'TestNetwork',
        timestamp: Date.now(),
      };

      const decision = protectionService.evaluateIncomingMessage(message, {
        isActiveTab: true,
        isChannel: true,
      });

      expect(decision).toBeNull();
      expect(callback).toHaveBeenCalledWith('protecteduser', undefined, undefined, 'TestNetwork');
    });

    it('should return decision for non-protected users', () => {
      const callback = jest.fn().mockReturnValue(false); // User is NOT protected
      protectionService.setProtectedCheckCallback(callback);

      // Temporarily enable spam checking
      // @ts-ignore
      const originalKeywords = protectionService.settings.spamPmKeywords;
      // @ts-ignore
      const originalChannelEnabled = protectionService.settings.spamChannelEnabled;
      // @ts-ignore
      protectionService.settings.spamPmKeywords = ['*http*'];
      // @ts-ignore
      protectionService.settings.spamChannelEnabled = true;

      const message: IRCMessage = {
        type: 'message',
        from: 'regularuser',
        text: 'check out http://spam.com',
        channel: '#test',
        network: 'TestNetwork',
        timestamp: Date.now(),
      };

      const decision = protectionService.evaluateIncomingMessage(message, {
        isActiveTab: true,
        isChannel: true,
      });

      expect(decision).not.toBeNull();
      expect(decision?.block).toBe(true);
      
      // Restore
      // @ts-ignore
      protectionService.settings.spamPmKeywords = originalKeywords;
      // @ts-ignore
      protectionService.settings.spamChannelEnabled = originalChannelEnabled;
    });

    it('should check protection with username and hostname', () => {
      const callback = jest.fn().mockReturnValue(true);
      protectionService.setProtectedCheckCallback(callback);

      const message: IRCMessage = {
        type: 'message',
        from: 'protecteduser',
        username: 'protected',
        hostname: 'trusted.com',
        text: 'test message',
        channel: '#test',
        network: 'TestNetwork',
        timestamp: Date.now(),
      };

      protectionService.evaluateIncomingMessage(message);

      expect(callback).toHaveBeenCalledWith('protecteduser', 'protected', 'trusted.com', 'TestNetwork');
    });

    it('should still evaluate when no callback is set', () => {
      // No callback set
      protectionService.setProtectedCheckCallback(null as any);

      const message: IRCMessage = {
        type: 'message',
        from: 'anyuser',
        text: 'normal message',
        channel: '#test',
        network: 'TestNetwork',
        timestamp: Date.now(),
      };

      // Should not throw
      const decision = protectionService.evaluateIncomingMessage(message);
      // Decision depends on settings, but should not error
      expect(decision === null || typeof decision === 'object').toBe(true);
    });
  });

  describe('shouldBlockMessage', () => {
    it('should return false for protected users', () => {
      const callback = jest.fn().mockReturnValue(true);
      protectionService.setProtectedCheckCallback(callback);

      const message: IRCMessage = {
        type: 'message',
        from: 'protecteduser',
        text: 'spam with http://link.com',
        channel: '#test',
        network: 'TestNetwork',
        timestamp: Date.now(),
      };

      const shouldBlock = protectionService.shouldBlockMessage(message, {
        isActiveTab: true,
        isChannel: true,
      });

      expect(shouldBlock).toBe(false);
    });

    it('should evaluate normally for non-protected users', () => {
      const callback = jest.fn().mockReturnValue(false);
      protectionService.setProtectedCheckCallback(callback);

      const message: IRCMessage = {
        type: 'message',
        from: 'regularuser',
        text: 'normal message',
        channel: '#test',
        network: 'TestNetwork',
        timestamp: Date.now(),
      };

      const shouldBlock = protectionService.shouldBlockMessage(message, {
        isActiveTab: true,
        isChannel: true,
      });

      expect(typeof shouldBlock).toBe('boolean');
    });
  });

  describe('Flood protection', () => {
    it('should track flood buckets', () => {
      const callback = jest.fn().mockReturnValue(false);
      protectionService.setProtectedCheckCallback(callback);

      // Enable text flood protection
      // @ts-ignore
      const originalTextFlood = protectionService.settings.protTextFlood;
      // @ts-ignore
      protectionService.settings.protTextFlood = true;

      const message: IRCMessage = {
        type: 'message',
        from: 'flooduser',
        text: 'message',
        channel: '#test',
        network: 'TestNetwork',
        timestamp: Date.now(),
      };

      // First few messages should not be blocked
      for (let i = 0; i < 5; i++) {
        const decision = protectionService.evaluateIncomingMessage(message);
        // First 5 messages should pass
        expect(decision?.block || false).toBe(false);
      }

      // Restore
      // @ts-ignore
      protectionService.settings.protTextFlood = originalTextFlood;
    });

    it('should skip flood tracking for protected users', () => {
      const callback = jest.fn().mockReturnValue(true); // User is protected
      protectionService.setProtectedCheckCallback(callback);

      // Enable text flood protection
      // @ts-ignore
      const originalTextFlood = protectionService.settings.protTextFlood;
      // @ts-ignore
      protectionService.settings.protTextFlood = true;

      const message: IRCMessage = {
        type: 'message',
        from: 'protectedflooduser',
        text: 'message',
        channel: '#test',
        network: 'TestNetwork',
        timestamp: Date.now(),
      };

      // Send many messages - none should be blocked due to protection
      for (let i = 0; i < 10; i++) {
        const decision = protectionService.evaluateIncomingMessage(message);
        expect(decision).toBeNull();
      }

      // Restore
      // @ts-ignore
      protectionService.settings.protTextFlood = originalTextFlood;
    });
  });

  describe('getActionConfig', () => {
    it('should return action configuration', () => {
      const config = protectionService.getActionConfig();
      expect(config).toHaveProperty('protEnforceSilence');
      expect(config).toHaveProperty('protIrcopAction');
      expect(config).toHaveProperty('protIrcopReason');
      expect(config).toHaveProperty('protIrcopDuration');
    });
  });

  describe('getAntiDeopConfig', () => {
    it('should return anti-deop configuration', () => {
      const config = protectionService.getAntiDeopConfig();
      expect(config).toHaveProperty('protAntiDeopEnabled');
      expect(config).toHaveProperty('protAntiDeopUseChanserv');
    });
  });
});
