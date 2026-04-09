/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleKICK,
  kickCommandHandlers,
} from '../../../../src/services/irc/commands/KickCommandHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('KickCommandHandlers', () => {
  let ctx: any;
  let usersMap: Map<string, any>;

  beforeEach(() => {
    usersMap = new Map([['target', { nick: 'target' }]]);
    ctx = {
      addMessage: jest.fn(),
      emit: jest.fn(),
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
      getCurrentNick: jest.fn().mockReturnValue('MyNick'),
      getChannelUsers: jest.fn().mockReturnValue(usersMap),
      updateChannelUserList: jest.fn(),
    };
  });

  describe('kickCommandHandlers map', () => {
    it('registers KICK', () => {
      expect(kickCommandHandlers.has('KICK')).toBe(true);
    });
  });

  describe('handleKICK', () => {
    it('adds kick message', () => {
      handleKICK(
        ctx,
        'oper!oper@host',
        ['#general', 'target', 'Flooding'],
        Date.now(),
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'kick',
          channel: '#general',
          from: 'oper',
        }),
      );
    });

    it('emits kick event when current user is kicked', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('target');
      handleKICK(
        ctx,
        'oper!oper@host',
        ['#general', 'target', 'Reason'],
        Date.now(),
      );
      expect(ctx.emit).toHaveBeenCalledWith('kick', '#general');
    });

    it('does not emit kick event when other user is kicked', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('MyNick');
      handleKICK(
        ctx,
        'oper!oper@host',
        ['#general', 'othernick', 'Reason'],
        Date.now(),
      );
      expect(ctx.emit).not.toHaveBeenCalled();
    });

    it('removes kicked user from channel users map', () => {
      handleKICK(
        ctx,
        'oper!oper@host',
        ['#general', 'target', 'bye'],
        Date.now(),
      );
      expect(usersMap.has('target')).toBe(false);
      expect(ctx.updateChannelUserList).toHaveBeenCalledWith('#general');
    });

    it('handles null users map gracefully', () => {
      ctx.getChannelUsers = jest.fn().mockReturnValue(null);
      expect(() => {
        handleKICK(
          ctx,
          'oper!oper@host',
          ['#general', 'target', 'bye'],
          Date.now(),
        );
      }).not.toThrow();
    });

    it('includes reason when provided', () => {
      handleKICK(
        ctx,
        'oper!oper@host',
        ['#general', 'target', 'Flooding'],
        Date.now(),
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Flooding' }),
      );
    });

    it('sets reason to undefined when no reason given', () => {
      handleKICK(ctx, 'oper!oper@host', ['#general', 'target', ''], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ reason: undefined }),
      );
    });

    it('includes target and command metadata', () => {
      handleKICK(
        ctx,
        'oper!oper@host',
        ['#general', 'target', 'bye'],
        Date.now(),
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ target: 'target', command: 'KICK' }),
      );
    });

    it('does not remove user when no channel given', () => {
      handleKICK(ctx, 'oper!oper@host', ['', 'target', 'reason'], Date.now());
      expect(ctx.getChannelUsers).not.toHaveBeenCalled();
    });

    it('uses case-insensitive key for deletion', () => {
      usersMap.set('target', { nick: 'Target' });
      handleKICK(
        ctx,
        'oper!oper@host',
        ['#general', 'Target', 'bye'],
        Date.now(),
      );
      expect(usersMap.has('target')).toBe(false);
    });
  });
});
