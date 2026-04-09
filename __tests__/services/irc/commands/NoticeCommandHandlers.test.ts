/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleNOTICE,
  noticeCommandHandlers,
} from '../../../../src/services/irc/commands/NoticeCommandHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

jest.mock('../../../../src/services/ProtectionService', () => ({
  protectionService: {
    evaluateIncomingMessage: jest.fn().mockReturnValue(null),
  },
}));

import { protectionService } from '../../../../src/services/ProtectionService';

describe('NoticeCommandHandlers', () => {
  let ctx: any;
  let mockIsUserIgnored: jest.Mock;
  let mockFindMatchingBlacklistEntry: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the protection service mock implementation each test
    (protectionService.evaluateIncomingMessage as jest.Mock).mockReturnValue(
      null,
    );
    mockIsUserIgnored = jest.fn().mockReturnValue(false);
    mockFindMatchingBlacklistEntry = jest.fn().mockReturnValue(null);

    ctx = {
      addMessage: jest.fn(),
      emit: jest.fn(),
      logRaw: jest.fn(),
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
      getCurrentNick: jest.fn().mockReturnValue('MyNick'),
      getNetworkName: jest.fn().mockReturnValue('TestNet'),
      parseCTCP: jest.fn().mockReturnValue({ isCTCP: false }),
      getProtectionTabContext: jest
        .fn()
        .mockReturnValue({ isActiveTab: true, isQueryOpen: false }),
      handleProtectionBlock: jest.fn(),
      extractMaskFromNotice: jest.fn().mockReturnValue(null),
      runBlacklistAction: jest.fn(),
      getUserManagementService: jest.fn().mockReturnValue({
        isUserIgnored: mockIsUserIgnored,
        findMatchingBlacklistEntry: mockFindMatchingBlacklistEntry,
      }),
    };
  });

  describe('noticeCommandHandlers map', () => {
    it('registers NOTICE', () => {
      expect(noticeCommandHandlers.has('NOTICE')).toBe(true);
    });
  });

  describe('handleNOTICE', () => {
    it('adds notice message for regular server notice', () => {
      handleNOTICE(
        ctx,
        'server.net',
        ['MyNick', 'Welcome to the server!'],
        Date.now(),
        {},
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notice',
          text: 'Welcome to the server!',
        }),
        undefined,
      );
    });

    it('ignores message when user is on ignore list', () => {
      mockIsUserIgnored.mockReturnValue(true);
      handleNOTICE(
        ctx,
        'bad!baduser@bad.host',
        ['MyNick', 'spam'],
        Date.now(),
        {},
      );
      expect(ctx.addMessage).not.toHaveBeenCalled();
    });

    it('does not check ignore for server-only prefix (no !)', () => {
      handleNOTICE(
        ctx,
        'server.net',
        ['MyNick', 'Server notice'],
        Date.now(),
        {},
      );
      expect(mockIsUserIgnored).not.toHaveBeenCalled();
    });

    it('handles CTCP PING response', () => {
      const sentTime = Date.now() - 100;
      ctx.parseCTCP = jest.fn().mockReturnValue({
        isCTCP: true,
        command: 'PING',
        args: String(sentTime),
      });
      handleNOTICE(
        ctx,
        'user!u@host',
        ['MyNick', `\x01PING ${sentTime}\x01`],
        Date.now(),
        {},
      );
      expect(ctx.emit).toHaveBeenCalledWith('pong', sentTime);
      expect(ctx.logRaw).toHaveBeenCalled();
    });

    it('handles generic CTCP response with args', () => {
      ctx.parseCTCP = jest.fn().mockReturnValue({
        isCTCP: true,
        command: 'VERSION',
        args: 'IRCClient 1.0',
      });
      handleNOTICE(
        ctx,
        'user!u@host',
        ['MyNick', '\x01VERSION IRCClient 1.0\x01'],
        Date.now(),
        {},
      );
      expect(ctx.addMessage).toHaveBeenCalled();
    });

    it('handles generic CTCP response without args', () => {
      ctx.parseCTCP = jest.fn().mockReturnValue({
        isCTCP: true,
        command: 'TIME',
        args: null,
      });
      handleNOTICE(
        ctx,
        'user!u@host',
        ['MyNick', '\x01TIME\x01'],
        Date.now(),
        {},
      );
      expect(ctx.addMessage).toHaveBeenCalled();
    });

    it('blocks message when protection returns decision', () => {
      (protectionService.evaluateIncomingMessage as jest.Mock).mockReturnValue({
        kind: 'flood',
      });
      handleNOTICE(ctx, 'user!u@host', ['MyNick', 'flooding'], Date.now(), {});
      expect(ctx.handleProtectionBlock).toHaveBeenCalledWith(
        'flood',
        'user',
        'u',
        'host',
        null,
      );
      expect(ctx.addMessage).not.toHaveBeenCalled();
    });

    it('handles channel notice', () => {
      handleNOTICE(
        ctx,
        'user!u@host',
        ['#channel', 'Channel notice'],
        Date.now(),
        {},
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice', channel: '#channel' }),
        undefined,
      );
    });

    it('runs blacklist check for user with ! prefix', () => {
      const blacklistEntry = { action: 'kick' };
      mockFindMatchingBlacklistEntry.mockReturnValue(blacklistEntry);
      handleNOTICE(
        ctx,
        'badnick!baduser@bad.host',
        ['#channel', 'bad notice'],
        Date.now(),
        {},
      );
      expect(ctx.runBlacklistAction).toHaveBeenCalledWith(
        blacklistEntry,
        expect.objectContaining({ nick: 'badnick' }),
      );
    });

    it('checks mask from notice for server prefix', () => {
      const extracted = { nick: 'nick', username: 'user', hostname: 'host' };
      ctx.extractMaskFromNotice = jest.fn().mockReturnValue(extracted);
      const blacklistEntry = { action: 'ignore' };
      mockFindMatchingBlacklistEntry.mockReturnValue(blacklistEntry);
      handleNOTICE(
        ctx,
        'server.net',
        ['MyNick', 'nick!user@host joined'],
        Date.now(),
        {},
      );
      expect(ctx.runBlacklistAction).toHaveBeenCalled();
    });

    it('passes batchTag to addMessage', () => {
      handleNOTICE(ctx, 'server.net', ['MyNick', 'test'], Date.now(), {
        batchTag: 'batch123',
      });
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
        'batch123',
      );
    });

    it('includes meta fields in message', () => {
      const meta = { accountTag: 'myaccount', msgidTag: 'msg123' };
      handleNOTICE(ctx, 'user!u@host', ['MyNick', 'test'], Date.now(), meta);
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'myaccount', msgid: 'msg123' }),
        undefined,
      );
    });

    it('handles protection block for channel notice', () => {
      (protectionService.evaluateIncomingMessage as jest.Mock).mockReturnValue({
        kind: 'spam',
      });
      handleNOTICE(
        ctx,
        'user!u@host',
        ['#channel', 'spam notice'],
        Date.now(),
        {},
      );
      expect(ctx.handleProtectionBlock).toHaveBeenCalledWith(
        'spam',
        'user',
        'u',
        'host',
        '#channel',
      );
    });
  });
});
