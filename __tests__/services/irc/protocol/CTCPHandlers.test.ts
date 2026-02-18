/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for CTCPHandlers - Wave 3 coverage target
 */

import {
  parseCTCP,
  encodeCTCP,
  handleCTCPRequest,
  CTCPContext,
} from '../../../../src/services/irc/protocol/CTCPHandlers';

jest.mock('../../../../src/config/appVersion', () => ({
  APP_VERSION: '1.7.0',
}));

describe('CTCPHandlers', () => {
  describe('parseCTCP', () => {
    it('should return isCTCP false for non-CTCP message', () => {
      const result = parseCTCP('Hello world');
      expect(result.isCTCP).toBe(false);
    });

    it('should return isCTCP false for empty message', () => {
      const result = parseCTCP('');
      expect(result.isCTCP).toBe(false);
    });

    it('should return isCTCP false for message without end delimiter', () => {
      const result = parseCTCP('\x01VERSION');
      expect(result.isCTCP).toBe(false);
    });

    it('should parse CTCP command without args', () => {
      const result = parseCTCP('\x01VERSION\x01');
      expect(result.isCTCP).toBe(true);
      expect(result.command).toBe('VERSION');
      expect(result.args).toBeUndefined();
    });

    it('should parse CTCP command with args', () => {
      const result = parseCTCP('\x01PING 12345\x01');
      expect(result.isCTCP).toBe(true);
      expect(result.command).toBe('PING');
      expect(result.args).toBe('12345');
    });

    it('should convert command to uppercase', () => {
      const result = parseCTCP('\x01version\x01');
      expect(result.command).toBe('VERSION');
    });

    it('should handle multiple spaces in args', () => {
      const result = parseCTCP('\x01DCC SEND file.txt 192.168.1.1 1234 5678\x01');
      expect(result.command).toBe('DCC');
      expect(result.args).toBe('SEND file.txt 192.168.1.1 1234 5678');
    });
  });

  describe('encodeCTCP', () => {
    it('should encode command without args', () => {
      const result = encodeCTCP('VERSION');
      expect(result).toBe('\x01VERSION\x01');
    });

    it('should encode command with args', () => {
      const result = encodeCTCP('PING', '12345');
      expect(result).toBe('\x01PING 12345\x01');
    });

    it('should handle empty args', () => {
      const result = encodeCTCP('ACTION', '');
      // Empty string is falsy, so no space is added
      expect(result).toBe('\x01ACTION\x01');
    });
  });

  describe('handleCTCPRequest', () => {
    const createMockContext = (): CTCPContext => ({
      sendRaw: jest.fn(),
      addMessage: jest.fn(),
      logRaw: jest.fn(),
      getCurrentNick: jest.fn().mockReturnValue('TestUser'),
      getRealname: jest.fn().mockReturnValue('Test Realname'),
      isConnected: jest.fn().mockReturnValue(true),
      getCtcpVersionMessage: jest.fn().mockResolvedValue('https://github.com/AndroidIRCX'),
    });

    it('should handle VERSION request', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'VERSION');

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('NOTICE OtherUser :\x01VERSION')
      );
      expect(ctx.sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('AndroidIRCX')
      );
    });

    it('should handle VERSION request with empty custom message', async () => {
      const ctx = createMockContext();
      ctx.getCtcpVersionMessage = jest.fn().mockResolvedValue('');
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'VERSION');

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        'NOTICE OtherUser :\x01VERSION AndroidIRCX 1.7.0\x01'
      );
    });

    it('should handle VERSION request with custom message', async () => {
      const ctx = createMockContext();
      ctx.getCtcpVersionMessage = jest.fn().mockResolvedValue('My Custom Build');
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'VERSION');

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        'NOTICE OtherUser :\x01VERSION AndroidIRCX 1.7.0 My Custom Build\x01'
      );
    });

    it('should handle TIME request', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'TIME');

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        expect.stringMatching(/NOTICE OtherUser :\x01TIME .+\x01/)
      );
    });

    it('should handle PING request with args', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'PING', '12345');

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        'NOTICE OtherUser :\x01PING 12345\x01'
      );
    });

    it('should handle PING request without args', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'PING');

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        expect.stringMatching(/NOTICE OtherUser :\x01PING \d+\x01/)
      );
    });

    it('should handle ACTION request (no response)', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'ACTION', 'dances');

      expect(ctx.sendRaw).not.toHaveBeenCalled();
    });

    it('should handle DCC request', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'DCC', 'SEND file.txt 192.168.1.1 1234');

      expect(ctx.addMessage).toHaveBeenCalledWith({
        type: 'ctcp',
        from: 'OtherUser',
        text: '\x01DCC SEND file.txt 192.168.1.1 1234\x01',
        channel: '#general',
        timestamp: expect.any(Number),
      });
    });

    it('should handle SLOTS request', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'SLOTS', '1/2');

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ctcp',
        text: '\x01SLOTS 1/2\x01',
      }));
    });

    it('should handle XDCC request', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'XDCC', 'SEND #1');

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ctcp',
        text: '\x01XDCC SEND #1\x01',
      }));
    });

    it('should handle CLIENTINFO request', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'CLIENTINFO');

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        'NOTICE OtherUser :\x01CLIENTINFO ACTION DCC PING TIME VERSION CLIENTINFO USERINFO SOURCE FINGER\x01'
      );
    });

    it('should handle USERINFO request', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'USERINFO');

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        'NOTICE OtherUser :\x01USERINFO Test Realname\x01'
      );
    });

    it('should handle SOURCE request', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'SOURCE');

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        'NOTICE OtherUser :\x01SOURCE https://github.com/AndroidIRCX\x01'
      );
    });

    it('should handle FINGER request', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'FINGER');

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        'NOTICE OtherUser :\x01FINGER TestUser - AndroidIRCX\x01'
      );
    });

    it('should handle unknown CTCP command', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'UNKNOWN', 'args');

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ctcp',
        text: '\x01UNKNOWN args\x01',
      }));
      expect(ctx.logRaw).toHaveBeenCalled();
    });

    it('should not send response when not connected', async () => {
      const ctx = createMockContext();
      ctx.isConnected.mockReturnValue(false);
      
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'VERSION');

      expect(ctx.sendRaw).not.toHaveBeenCalled();
    });

    it('should handle TDCC request', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'TDCC', 'args');

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ctcp',
        text: '\x01TDCC args\x01',
      }));
    });

    it('should handle RDCC request', async () => {
      const ctx = createMockContext();
      await handleCTCPRequest(ctx, 'OtherUser', '#general', 'RDCC', 'args');

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ctcp',
        text: '\x01RDCC args\x01',
      }));
    });
  });
});
