/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for StandardCommandHandlers - Wave 3 coverage target
 */

import { standardCommandHandlers, handleFAIL, handleWARN, handleNOTE, handlePONG, handleINVITE } from '../../../../src/services/irc/commands/StandardCommandHandlers';
import type { CommandHandlerContext } from '../../../../src/services/irc/commandTypes';

describe('StandardCommandHandlers', () => {
  const createMockContext = (): Partial<CommandHandlerContext> => ({
    addMessage: jest.fn(),
    addRawMessage: jest.fn(),
    emit: jest.fn(),
    logRaw: jest.fn(),
    getNetworkName: jest.fn().mockReturnValue('freenode'),
    getCurrentNick: jest.fn().mockReturnValue('TestUser'),
    sendRaw: jest.fn(),
    extractNick: jest.fn().mockReturnValue('OtherUser'),
  });

  let ctx: CommandHandlerContext;

  beforeEach(() => {
    ctx = createMockContext() as CommandHandlerContext;
  });

  describe('standardCommandHandlers Map', () => {
    it('should have FAIL handler registered', () => {
      expect(standardCommandHandlers.has('FAIL')).toBe(true);
    });

    it('should have WARN handler registered', () => {
      expect(standardCommandHandlers.has('WARN')).toBe(true);
    });

    it('should have NOTE handler registered', () => {
      expect(standardCommandHandlers.has('NOTE')).toBe(true);
    });

    it('should have PONG handler registered', () => {
      expect(standardCommandHandlers.has('PONG')).toBe(true);
    });

    it('should have INVITE handler registered', () => {
      expect(standardCommandHandlers.has('INVITE')).toBe(true);
    });
  });

  describe('handleFAIL', () => {
    it('should handle FAIL message', () => {
      handleFAIL(ctx, '', ['COMMAND', 'CODE', 'description'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('FAIL'),
      }));
      expect(ctx.emit).toHaveBeenCalledWith('fail', 'COMMAND', 'CODE', '', 'description');
    });

    it('should handle FAIL with context', () => {
      handleFAIL(ctx, '', ['COMMAND', 'CODE', 'context', 'description'], Date.now());

      expect(ctx.emit).toHaveBeenCalledWith('fail', 'COMMAND', 'CODE', 'context', 'description');
    });

    it('should handle FAIL with empty params using UNKNOWN fallback', () => {
      handleFAIL(ctx, '', [], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });

    it('should handle FAIL with multi-word context', () => {
      handleFAIL(ctx, '', ['CMD', 'CODE', 'ctx1', 'ctx2', 'description'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('fail', 'CMD', 'CODE', 'ctx1 ctx2', 'description');
    });
  });

  describe('handleWARN', () => {
    it('should handle WARN message', () => {
      handleWARN(ctx, '', ['COMMAND', 'CODE', 'description'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'raw',
        text: expect.stringContaining('WARN'),
      }));
      expect(ctx.emit).toHaveBeenCalledWith('warn', 'COMMAND', 'CODE', '', 'description');
    });

    it('should handle WARN with context', () => {
      handleWARN(ctx, '', ['CMD', 'CODE', 'ctx', 'description'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('warn', 'CMD', 'CODE', 'ctx', 'description');
    });

    it('should emit warn with raw message category', () => {
      handleWARN(ctx, '', ['CMD', 'CODE', 'msg'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ isRaw: true, rawCategory: 'server' })
      );
    });
  });

  describe('handleNOTE', () => {
    it('should handle NOTE message', () => {
      handleNOTE(ctx, '', ['COMMAND', 'CODE', 'description'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'raw',
        text: expect.stringContaining('NOTE'),
      }));
      expect(ctx.emit).toHaveBeenCalledWith('note', 'COMMAND', 'CODE', '', 'description');
    });

    it('should handle NOTE with context', () => {
      handleNOTE(ctx, '', ['CMD', 'CODE', 'ctx', 'description'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('note', 'CMD', 'CODE', 'ctx', 'description');
    });
  });

  describe('handlePONG', () => {
    it('should emit pong event with timestamp', () => {
      const timestamp = Date.now();
      handlePONG(ctx, 'server.irc.com', ['server.irc.com', timestamp.toString()], timestamp);

      expect(ctx.emit).toHaveBeenCalledWith('pong', timestamp);
    });

    it('should handle PONG without timestamp param', () => {
      handlePONG(ctx, 'server.irc.com', ['server.irc.com'], Date.now());

      expect(ctx.emit).not.toHaveBeenCalled();
    });

    it('should handle PONG with non-numeric token', () => {
      handlePONG(ctx, 'server.irc.com', ['server.irc.com', 'non-numeric-token'], Date.now());

      expect(ctx.emit).not.toHaveBeenCalled();
    });

    it('should handle PONG with empty second param', () => {
      handlePONG(ctx, 'server.irc.com', ['server.irc.com', ''], Date.now());

      expect(ctx.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleINVITE', () => {
    it('should handle incoming INVITE', () => {
      handleINVITE(ctx, 'OtherUser!user@host.com', ['TestUser', '#secret-channel'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'invite',
        from: 'OtherUser',
        channel: '#secret-channel',
      }));
    });

    it('should include username and hostname', () => {
      handleINVITE(ctx, 'Nick!theuser@thehost.com', ['Me', '#channel'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'theuser', hostname: 'thehost.com' })
      );
    });

    it('should include INVITE command metadata', () => {
      handleINVITE(ctx, 'Nick!user@host', ['Me', '#channel'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'INVITE', target: '#channel' })
      );
    });

    it('should handle empty channel', () => {
      handleINVITE(ctx, 'Nick!user@host', ['Me'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'invite', channel: '' })
      );
    });
  });
});
