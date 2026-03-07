/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleNICK,
  nickCommandHandlers,
} from '../../../../src/services/irc/commands/NickCommandHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('NickCommandHandlers', () => {
  let ctx: any;
  let channelUsers: Map<string, Map<string, any>>;

  beforeEach(() => {
    channelUsers = new Map();
    ctx = {
      addMessage: jest.fn(),
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
      getCurrentNick: jest.fn().mockReturnValue('MyNick'),
      setCurrentNick: jest.fn(),
      getAllChannelUsers: jest.fn().mockReturnValue(channelUsers),
      updateChannelUserList: jest.fn(),
    };
  });

  describe('nickCommandHandlers map', () => {
    it('registers NICK', () => {
      expect(nickCommandHandlers.has('NICK')).toBe(true);
    });
  });

  describe('handleNICK', () => {
    it('updates current nick when self changes nick', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('OldNick');
      ctx.extractNick = jest.fn().mockReturnValue('OldNick');
      handleNICK(ctx, 'OldNick!user@host', ['NewNick'], Date.now());
      expect(ctx.setCurrentNick).toHaveBeenCalledWith('NewNick');
    });

    it('does not update current nick when other user changes nick', () => {
      handleNICK(ctx, 'OtherUser!user@host', ['NewNick'], Date.now());
      expect(ctx.setCurrentNick).not.toHaveBeenCalled();
    });

    it('adds nick message to each affected channel', () => {
      const userMap1 = new Map([['oldnick', { nick: 'OldNick', modes: [] }]]);
      const userMap2 = new Map([['oldnick', { nick: 'OldNick', modes: [] }]]);
      channelUsers.set('#general', userMap1);
      channelUsers.set('#random', userMap2);

      ctx.extractNick = jest.fn().mockReturnValue('OldNick');
      handleNICK(ctx, 'OldNick!user@host', ['NewNick'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledTimes(2);
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'nick', channel: '#general', from: 'OldNick', newNick: 'NewNick' })
      );
    });

    it('renames user in channel user maps', () => {
      const oldUser = { nick: 'OldNick', modes: [] };
      const userMap = new Map([['oldnick', oldUser]]);
      channelUsers.set('#general', userMap);

      ctx.extractNick = jest.fn().mockReturnValue('OldNick');
      handleNICK(ctx, 'OldNick!user@host', ['NewNick'], Date.now());

      expect(userMap.has('oldnick')).toBe(false);
      expect(userMap.has('newnick')).toBe(true);
      expect(oldUser.nick).toBe('NewNick');
    });

    it('updates channel user list for each affected channel', () => {
      channelUsers.set('#general', new Map([['oldnick', { nick: 'OldNick' }]]));

      ctx.extractNick = jest.fn().mockReturnValue('OldNick');
      handleNICK(ctx, 'OldNick!user@host', ['NewNick'], Date.now());

      expect(ctx.updateChannelUserList).toHaveBeenCalledWith('#general');
    });

    it('adds single nick message when user not in any channel', () => {
      handleNICK(ctx, 'OtherUser!user@host', ['NewNick'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledTimes(1);
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'nick', from: 'OtherUser', oldNick: 'OtherUser', newNick: 'NewNick' })
      );
    });

    it('does not process channel updates when oldNick or newNick is empty', () => {
      ctx.extractNick = jest.fn().mockReturnValue('');
      handleNICK(ctx, '', ['NewNick'], Date.now());
      expect(ctx.getAllChannelUsers).not.toHaveBeenCalled();
    });

    it('does not process channel updates when newNick is empty', () => {
      ctx.extractNick = jest.fn().mockReturnValue('OldNick');
      handleNICK(ctx, 'OldNick!user@host', [''], Date.now());
      // getAllChannelUsers should not be iterated when newNick is empty
      const calls = ctx.updateChannelUserList.mock.calls.length;
      expect(calls).toBe(0);
    });

    it('includes timestamp in message', () => {
      const ts = 9876543210;
      handleNICK(ctx, 'OtherUser!user@host', ['NewNick'], ts);
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ timestamp: ts })
      );
    });
  });
});
