/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleACCOUNT,
  handleAWAY,
  handleCHGHOST,
  handleSETNAME,
  handleTAGMSG,
  userStateCommandHandlers,
} from '../../../../src/services/irc/commands/UserStateCommandHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('UserStateCommandHandlers', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
      addRawMessage: jest.fn(),
      emit: jest.fn(),
      logRaw: jest.fn(),
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
      decodeIfBase64Like: jest.fn((s: string) => s),
    };
  });

  describe('userStateCommandHandlers map', () => {
    it('registers all user state handlers', () => {
      ['ACCOUNT', 'AWAY', 'CHGHOST', 'SETNAME', 'TAGMSG'].forEach(cmd => {
        expect(userStateCommandHandlers.has(cmd)).toBe(true);
      });
    });
  });

  describe('handleACCOUNT', () => {
    it('adds logout message when accountName is *', () => {
      handleACCOUNT(ctx, 'nick!user@host', ['*'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'raw',
          isRaw: true,
          rawCategory: 'user',
        }),
      );
      expect(ctx.emit).toHaveBeenCalledWith('account', 'nick', '*');
    });

    it('adds login message when accountName is provided', () => {
      handleACCOUNT(ctx, 'nick!user@host', ['myaccount'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'raw', isRaw: true }),
      );
      expect(ctx.emit).toHaveBeenCalledWith('account', 'nick', 'myaccount');
    });

    it('emits account event with nick and account name', () => {
      handleACCOUNT(ctx, 'nick!user@host', ['accountname'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('account', 'nick', 'accountname');
    });

    it('handles empty params with fallback', () => {
      handleACCOUNT(ctx, 'nick!user@host', [], Date.now());
      expect(ctx.addMessage).toHaveBeenCalled();
      expect(ctx.emit).toHaveBeenCalledWith('account', 'nick', '');
    });
  });

  describe('handleAWAY', () => {
    it('adds away message when message is provided', () => {
      handleAWAY(ctx, 'nick!user@host', ['Be', 'right', 'back'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'raw',
          isRaw: true,
          rawCategory: 'user',
        }),
      );
    });

    it('adds back message when away message is empty', () => {
      handleAWAY(ctx, 'nick!user@host', [], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'raw', isRaw: true }),
      );
    });

    it('includes timestamp in message', () => {
      const ts = 1234567890;
      handleAWAY(ctx, 'nick!user@host', ['away'], ts);
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ timestamp: ts }),
      );
    });
  });

  describe('handleCHGHOST', () => {
    it('adds chghost raw message', () => {
      handleCHGHOST(
        ctx,
        'nick!user@host',
        ['newuser', 'newhost.example.com'],
        Date.now(),
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'raw',
          isRaw: true,
          rawCategory: 'server',
        }),
      );
    });

    it('emits chghost event with nick and new host', () => {
      handleCHGHOST(
        ctx,
        'nick!user@host',
        ['newuser', 'newhost.example.com'],
        Date.now(),
      );
      expect(ctx.emit).toHaveBeenCalledWith(
        'chghost',
        'nick',
        'newhost.example.com',
      );
    });

    it('handles empty new host', () => {
      handleCHGHOST(ctx, 'nick!user@host', ['newuser'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('chghost', 'nick', '');
    });
  });

  describe('handleSETNAME', () => {
    it('adds setname raw message', () => {
      handleSETNAME(ctx, 'nick!user@host', ['New Real Name'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'raw', isRaw: true }),
      );
    });

    it('emits setname event', () => {
      handleSETNAME(ctx, 'nick!user@host', ['My Name'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('setname', 'nick', 'My Name');
    });

    it('calls decodeIfBase64Like on the realname', () => {
      handleSETNAME(ctx, 'nick!user@host', ['base64string'], Date.now());
      expect(ctx.decodeIfBase64Like).toHaveBeenCalledWith('base64string');
    });
  });

  describe('handleTAGMSG', () => {
    it('logs reaction tag', () => {
      handleTAGMSG(ctx, 'nick!user@host', ['#channel'], Date.now(), {
        reactTag: 'msgid123;👍',
      });
      expect(ctx.emit).toHaveBeenCalledWith(
        'reaction-received',
        '#channel',
        'msgid123',
        '👍',
        'nick',
      );
      expect(ctx.logRaw).toHaveBeenCalled();
    });

    it('logs typing tag', () => {
      handleTAGMSG(ctx, 'nick!user@host', ['#channel'], Date.now(), {
        typingTag: 'active',
      });
      expect(ctx.emit).toHaveBeenCalledWith(
        'typing-indicator',
        '#channel',
        'nick',
        'active',
      );
      expect(ctx.logRaw).toHaveBeenCalled();
    });

    it('adds raw message with tag summary when tags present', () => {
      handleTAGMSG(ctx, 'nick!user@host', ['#channel'], Date.now(), {
        reactTag: 'id;👍',
      });
      expect(ctx.addRawMessage).toHaveBeenCalled();
    });

    it('adds raw message without tags when no meta', () => {
      handleTAGMSG(ctx, 'nick!user@host', ['#channel'], Date.now(), {});
      expect(ctx.addRawMessage).toHaveBeenCalled();
    });

    it('handles both react and typing tags', () => {
      handleTAGMSG(ctx, 'nick!user@host', ['#channel'], Date.now(), {
        reactTag: 'id;❤️',
        typingTag: 'done',
      });
      expect(ctx.emit).toHaveBeenCalledWith(
        'reaction-received',
        '#channel',
        'id',
        '❤️',
        'nick',
      );
      expect(ctx.emit).toHaveBeenCalledWith(
        'typing-indicator',
        '#channel',
        'nick',
        'done',
      );
    });

    it('handles undefined meta', () => {
      handleTAGMSG(ctx, 'nick!user@host', ['#channel'], Date.now(), undefined);
      expect(ctx.addRawMessage).toHaveBeenCalled();
    });
  });
});
