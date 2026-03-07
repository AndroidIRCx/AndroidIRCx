/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handlePART,
  partCommandHandlers,
} from '../../../../src/services/irc/commands/PartCommandHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('PartCommandHandlers', () => {
  let ctx: any;
  let usersMap: Map<string, any>;

  beforeEach(() => {
    usersMap = new Map([['parting', { nick: 'Parting' }]]);
    ctx = {
      addMessage: jest.fn(),
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
      getCurrentNick: jest.fn().mockReturnValue('MyNick'),
      getChannelUsers: jest.fn().mockReturnValue(usersMap),
      updateChannelUserList: jest.fn(),
      emitPart: jest.fn(),
    };
  });

  describe('partCommandHandlers map', () => {
    it('registers PART', () => {
      expect(partCommandHandlers.has('PART')).toBe(true);
    });
  });

  describe('handlePART', () => {
    it('adds part message for other user', () => {
      handlePART(ctx, 'Parting!user@host', ['#general', 'Goodbye'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'part', channel: '#general', from: 'Parting' })
      );
    });

    it('removes parted user from channel users', () => {
      handlePART(ctx, 'Parting!user@host', ['#general', 'bye'], Date.now());
      expect(usersMap.has('parting')).toBe(false);
      expect(ctx.updateChannelUserList).toHaveBeenCalledWith('#general');
    });

    it('adds notice message when current user parts', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('Parting');
      ctx.extractNick = jest.fn().mockReturnValue('Parting');
      handlePART(ctx, 'Parting!user@host', ['#general', 'bye'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice', channel: undefined })
      );
    });

    it('emits part event when current user parts', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('Parting');
      ctx.extractNick = jest.fn().mockReturnValue('Parting');
      handlePART(ctx, 'Parting!user@host', ['#general', 'bye'], Date.now());
      expect(ctx.emitPart).toHaveBeenCalledWith('#general', 'Parting');
    });

    it('does not emit part when other user parts', () => {
      handlePART(ctx, 'Parting!user@host', ['#general', 'bye'], Date.now());
      expect(ctx.emitPart).not.toHaveBeenCalled();
    });

    it('handles null users map gracefully', () => {
      ctx.getChannelUsers = jest.fn().mockReturnValue(null);
      expect(() => {
        handlePART(ctx, 'Parting!user@host', ['#general'], Date.now());
      }).not.toThrow();
    });

    it('includes reason when provided', () => {
      handlePART(ctx, 'Parting!user@host', ['#general', 'Leaving for good'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Leaving for good' })
      );
    });

    it('sets reason to undefined when no message', () => {
      handlePART(ctx, 'Parting!user@host', ['#general', ''], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ reason: undefined })
      );
    });

    it('includes username and hostname from prefix', () => {
      handlePART(ctx, 'Parting!user123@example.host', ['#general'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'user123', hostname: 'example.host' })
      );
    });

    it('includes PART command metadata', () => {
      handlePART(ctx, 'Parting!user@host', ['#general'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'PART', target: '#general' })
      );
    });

    it('does not remove user when no channel', () => {
      handlePART(ctx, 'Parting!user@host', ['', 'bye'], Date.now());
      expect(ctx.getChannelUsers).not.toHaveBeenCalled();
    });
  });
});
