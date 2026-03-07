/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ProtectionService
 */

import { protectionService } from '../../src/services/ProtectionService';
import type { IRCMessage } from '../../src/services/IRCService';

const mockExists = jest.fn();
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();
const mockAppendFile = jest.fn();
const mockUnlink = jest.fn();

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/mock-docs',
    exists: (...args: unknown[]) => mockExists(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    appendFile: (...args: unknown[]) => mockAppendFile(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
  },
}));

describe('ProtectionService', () => {
  beforeEach(() => {
    // Reset the service state before each test
    // @ts-ignore - accessing private properties for testing
    protectionService.floodBuckets.clear();
    // @ts-ignore
    protectionService.netFloodBuckets.clear();
    // Clear protected callback
    protectionService.setProtectedCheckCallback(null as any);
    mockExists.mockReset();
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockAppendFile.mockReset();
    mockUnlink.mockReset();
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

  describe('additional decision branches and helpers', () => {
    const buildMessage = (overrides: Partial<IRCMessage> = {}): IRCMessage => ({
      type: 'message',
      from: 'user1',
      text: 'hello world',
      channel: '#room',
      network: 'TestNetwork',
      timestamp: Date.now(),
      ...overrides,
    });

    it('covers quit/text/exclude-token and pm spam mode branches', () => {
      // @ts-ignore
      protectionService.settings.spamNoSpamOnQuits = true;
      expect(protectionService.evaluateIncomingMessage(buildMessage({ type: 'quit' }))).toBeNull();

      // @ts-ignore
      protectionService.settings.spamNoSpamOnQuits = false;
      expect(protectionService.evaluateIncomingMessage(buildMessage({ text: '' }))).toBeNull();

      // @ts-ignore
      protectionService.settings.protExcludeTokens = 'trusted, allow';
      expect(
        protectionService.evaluateIncomingMessage(buildMessage({ text: 'this has TRUSTED token' }))
      ).toBeNull();

      // @ts-ignore
      protectionService.settings.protExcludeTokens = '';
      // @ts-ignore
      protectionService.settings.spamPmMode = 'when_open';
      // @ts-ignore
      protectionService.settings.spamPmKeywords = ['*spam*'];
      const pm = buildMessage({ channel: 'user1', text: 'spam link' });
      expect(protectionService.shouldBlockMessage(pm, { isQueryOpen: false, isActiveTab: false })).toBe(false);
      expect(protectionService.shouldBlockMessage(pm, { isQueryOpen: true })).toBe(true);
    });

    it('covers tsunami, ctcp, dcc, dos and net flood branches', () => {
      // @ts-ignore
      protectionService.settings.protBlockTsunamis = true;
      const tsunamiText = 'A'.repeat(260);
      expect(protectionService.shouldBlockMessage(buildMessage({ text: tsunamiText }))).toBe(true);

      // @ts-ignore
      protectionService.settings.protBlockTsunamis = false;
      // @ts-ignore
      protectionService.settings.protCtcpFlood = true;
      // @ts-ignore
      protectionService.settings.protDccFlood = true;
      // @ts-ignore
      protectionService.settings.protDosAttacks = true;

      const ctcp = buildMessage({ text: '\x01VERSION\x01', channel: 'user1' });
      for (let i = 0; i < 4; i++) {
        const decision = protectionService.evaluateIncomingMessage(ctcp, { isCtcp: true });
        if (i === 3) expect(decision?.block).toBe(true);
      }

      const dcc = buildMessage({ text: 'DCC SEND file', channel: 'user1', from: 'user-dcc' });
      for (let i = 0; i < 3; i++) {
        const decision = protectionService.evaluateIncomingMessage(dcc);
        if (i === 2) expect(decision?.block).toBe(true);
      }

      expect(protectionService.evaluateIncomingMessage(buildMessage({ text: 'x'.repeat(900), from: 'dos-user' }))?.block).toBe(true);

      // @ts-ignore
      protectionService.settings.protTextFloodNet = true;
      const netFloodMsg = buildMessage({ from: 'u-net', channel: '#netflood' });
      let blocked = false;
      for (let i = 0; i < 19; i++) {
        const decision = protectionService.evaluateIncomingMessage(netFloodMsg, { isChannel: true });
        blocked = blocked || !!decision;
      }
      expect(blocked).toBe(true);
    });

    it('covers spam log read/clear/write append branches', async () => {
      mockExists.mockResolvedValueOnce(false);
      await expect(protectionService.getSpamLog()).resolves.toBe('');

      mockExists.mockResolvedValueOnce(true);
      mockReadFile.mockResolvedValueOnce('log-content');
      await expect(protectionService.getSpamLog()).resolves.toBe('log-content');

      mockExists.mockResolvedValueOnce(true);
      await protectionService.clearSpamLog();
      expect(mockUnlink).toHaveBeenCalled();

      // Trigger logSpam through evaluateIncomingMessage
      // @ts-ignore
      protectionService.settings.spamLoggingEnabled = true;
      // @ts-ignore
      protectionService.settings.spamChannelEnabled = true;
      // @ts-ignore
      protectionService.settings.spamPmKeywords = ['*http*'];

      mockExists.mockResolvedValueOnce(false);
      protectionService.evaluateIncomingMessage(buildMessage({ text: 'http://x', from: 'log-user' }));
      await Promise.resolve();
      expect(mockWriteFile).toHaveBeenCalled();

      mockExists.mockResolvedValueOnce(true);
      protectionService.evaluateIncomingMessage(buildMessage({ text: 'http://y', from: 'log-user-2' }));
      await Promise.resolve();
      expect(mockAppendFile).toHaveBeenCalled();
    });
  });
});
