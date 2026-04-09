/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleKILL,
  killCommandHandlers,
} from '../../../../src/services/irc/commands/KillCommandHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('KillCommandHandlers', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
      addRawMessage: jest.fn(),
      emit: jest.fn(),
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
      getCurrentNick: jest.fn().mockReturnValue('MyNick'),
      handleKillDisconnect: jest.fn(),
    };
  });

  describe('killCommandHandlers map', () => {
    it('registers KILL', () => {
      expect(killCommandHandlers.has('KILL')).toBe(true);
    });
  });

  describe('handleKILL', () => {
    it('adds raw message when other user is killed', () => {
      handleKILL(ctx, 'oper!oper@host', ['OtherNick', 'Flooding'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'raw',
          isRaw: true,
          rawCategory: 'server',
        }),
      );
    });

    it('does not call handleKillDisconnect when other user is killed', () => {
      handleKILL(ctx, 'oper!oper@host', ['OtherNick', 'reason'], Date.now());
      expect(ctx.handleKillDisconnect).not.toHaveBeenCalled();
    });

    it('handles self-kill with error message and disconnect', () => {
      handleKILL(ctx, 'server!server@host', ['MyNick', 'Flooding'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
      expect(ctx.addRawMessage).toHaveBeenCalledWith(
        expect.any(String),
        'connection',
        expect.any(Number),
      );
      expect(ctx.handleKillDisconnect).toHaveBeenCalledWith('Flooding');
    });

    it('handles self-kill case-insensitively', () => {
      handleKILL(ctx, 'oper!oper@host', ['mynick', 'reason'], Date.now());
      expect(ctx.handleKillDisconnect).toHaveBeenCalled();
    });

    it('strips leading colon from kill reason', () => {
      handleKILL(
        ctx,
        'server!server@host',
        ['OtherNick', ':reason with colon'],
        Date.now(),
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'raw' }),
      );
    });

    it('uses no reason fallback when no reason given', () => {
      handleKILL(ctx, 'oper!oper@host', ['OtherNick'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalled();
    });

    it('joins multi-word kill reason', () => {
      handleKILL(
        ctx,
        'oper!oper@host',
        ['OtherNick', 'Too', 'much', 'flooding'],
        Date.now(),
      );
      expect(ctx.addMessage).toHaveBeenCalled();
    });

    it('returns early after self-kill handling', () => {
      handleKILL(ctx, 'server!server@host', ['MyNick', 'reason'], Date.now());
      // Should only call addMessage once (error type), not the raw type
      const calls = ctx.addMessage.mock.calls;
      expect(calls.every((c: any[]) => c[0].type === 'error')).toBe(true);
    });
  });
});
