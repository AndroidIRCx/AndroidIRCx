/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleQUIT,
  quitCommandHandlers,
} from '../../../../src/services/irc/commands/QuitCommandHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('QuitCommandHandlers', () => {
  let ctx: any;
  let channelUsers: Map<string, Map<string, any>>;

  beforeEach(() => {
    channelUsers = new Map();
    ctx = {
      addMessage: jest.fn(),
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
      getAllChannelUsers: jest.fn().mockReturnValue(channelUsers),
      updateChannelUserList: jest.fn(),
    };
  });

  describe('quitCommandHandlers map', () => {
    it('registers QUIT', () => {
      expect(quitCommandHandlers.has('QUIT')).toBe(true);
    });
  });

  describe('handleQUIT', () => {
    it('adds quit message to each channel user was in', () => {
      const userMap = new Map([['quitter', { nick: 'Quitter' }]]);
      channelUsers.set('#general', userMap);
      channelUsers.set('#random', new Map([['quitter', {}]]));

      handleQUIT(ctx, 'Quitter!user@host', ['Goodbye!'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledTimes(2);
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'quit', channel: '#general', from: 'Quitter' })
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'quit', channel: '#random' })
      );
    });

    it('removes user from channel user maps', () => {
      const userMap = new Map([['quitter', { nick: 'Quitter' }]]);
      channelUsers.set('#general', userMap);

      handleQUIT(ctx, 'Quitter!user@host', ['bye'], Date.now());

      expect(userMap.has('quitter')).toBe(false);
    });

    it('updates channel user list for each channel', () => {
      channelUsers.set('#general', new Map([['quitter', {}]]));
      channelUsers.set('#test', new Map([['quitter', {}]]));

      handleQUIT(ctx, 'Quitter!user@host', [], Date.now());

      expect(ctx.updateChannelUserList).toHaveBeenCalledWith('#general');
      expect(ctx.updateChannelUserList).toHaveBeenCalledWith('#test');
    });

    it('adds single quit message when user not in any channel', () => {
      handleQUIT(ctx, 'Quitter!user@host', ['Goodbye!'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledTimes(1);
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'quit', from: 'Quitter', reason: 'Goodbye!' })
      );
    });

    it('sets reason to undefined when no quit message', () => {
      handleQUIT(ctx, 'Quitter!user@host', [], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ reason: undefined })
      );
    });

    it('includes username and hostname from prefix', () => {
      handleQUIT(ctx, 'Quitter!theuser@host.example.com', ['bye'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'theuser',
          hostname: 'host.example.com',
        })
      );
    });

    it('includes timestamp in message', () => {
      const ts = 1234567890;
      handleQUIT(ctx, 'Quitter!user@host', ['bye'], ts);

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ timestamp: ts })
      );
    });

    it('uses nick as-is (case-sensitive from prefix)', () => {
      handleQUIT(ctx, 'MyNick!user@host', ['bye'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'MyNick' })
      );
    });

    it('uses lowercase nick key for channel user lookup', () => {
      const userMap = new Map([['mynick', { nick: 'MyNick' }]]);
      channelUsers.set('#general', userMap);

      handleQUIT(ctx, 'MyNick!user@host', ['bye'], Date.now());

      expect(userMap.has('mynick')).toBe(false);
    });

    it('adds QUIT command metadata', () => {
      handleQUIT(ctx, 'Quitter!user@host', ['bye'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'QUIT' })
      );
    });

    it('handles prefix without username/hostname parts', () => {
      handleQUIT(ctx, 'server.net', ['Server restart'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalled();
    });
  });
});
