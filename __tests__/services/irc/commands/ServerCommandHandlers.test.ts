/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleERROR,
  handleWALLOPS,
  handleREGISTER,
  serverCommandHandlers,
} from '../../../../src/services/irc/commands/ServerCommandHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('ServerCommandHandlers', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
      addRawMessage: jest.fn(),
      emit: jest.fn(),
      handleServerError: jest.fn(),
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
      getNetworkName: jest.fn().mockReturnValue('TestNetwork'),
      extractMaskFromNotice: jest.fn().mockReturnValue(null),
      getUserManagementService: jest.fn().mockReturnValue({
        findMatchingBlacklistEntry: jest.fn().mockReturnValue(null),
      }),
      runBlacklistAction: jest.fn(),
    };
  });

  describe('serverCommandHandlers map', () => {
    it('registers ERROR handler', () => {
      expect(serverCommandHandlers.has('ERROR')).toBe(true);
    });

    it('registers WALLOPS handler', () => {
      expect(serverCommandHandlers.has('WALLOPS')).toBe(true);
    });

    it('registers REGISTER handler', () => {
      expect(serverCommandHandlers.has('REGISTER')).toBe(true);
    });
  });

  describe('handleERROR', () => {
    it('adds error message with params text', () => {
      const ts = Date.now();
      handleERROR(ctx, '', ['Closing', 'Link'], ts);

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text: 'Closing Link' }),
      );
    });

    it('uses fallback text when params empty', () => {
      const ts = Date.now();
      handleERROR(ctx, '', [], ts);

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Connection closed by server' }),
      );
    });

    it('calls addRawMessage with server error text', () => {
      handleERROR(ctx, '', ['Banned'], Date.now());

      expect(ctx.addRawMessage).toHaveBeenCalledWith(
        expect.stringContaining('Banned'),
        'server',
      );
    });

    it('calls handleServerError with error text', () => {
      handleERROR(ctx, '', ['Flood'], Date.now());

      expect(ctx.handleServerError).toHaveBeenCalledWith('Flood');
    });

    it('includes timestamp in message', () => {
      const ts = 1234567890;
      handleERROR(ctx, '', ['test'], ts);

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ timestamp: ts }),
      );
    });
  });

  describe('handleWALLOPS', () => {
    it('adds notice message with wallops text', () => {
      const ts = Date.now();
      handleWALLOPS(ctx, 'oper!oper@server', ['Global notice'], ts);

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice', from: 'oper', isRaw: true }),
      );
    });

    it('uses empty string when no params', () => {
      handleWALLOPS(ctx, 'oper!oper@host', [], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice', text: '' }),
      );
    });

    it('checks blacklist when mask is found in wallops text', () => {
      ctx.extractMaskFromNotice = jest.fn().mockReturnValue({
        nick: 'badnick',
        username: 'baduser',
        hostname: 'bad.host',
      });
      const blacklistEntry = { action: 'kick' };
      ctx.getUserManagementService = jest.fn().mockReturnValue({
        findMatchingBlacklistEntry: jest.fn().mockReturnValue(blacklistEntry),
      });

      handleWALLOPS(
        ctx,
        'oper!oper@server',
        ['badnick!baduser@bad.host did something'],
        Date.now(),
      );

      expect(ctx.runBlacklistAction).toHaveBeenCalledWith(
        blacklistEntry,
        expect.objectContaining({ nick: 'badnick', network: 'TestNetwork' }),
      );
    });

    it('does not run blacklist action when no mask found', () => {
      ctx.extractMaskFromNotice = jest.fn().mockReturnValue(null);

      handleWALLOPS(
        ctx,
        'oper!oper@server',
        ['Just a wallops message'],
        Date.now(),
      );

      expect(ctx.runBlacklistAction).not.toHaveBeenCalled();
    });

    it('does not run blacklist action when entry not found', () => {
      ctx.extractMaskFromNotice = jest.fn().mockReturnValue({
        nick: 'somenick',
        username: 'someuser',
        hostname: 'some.host',
      });
      ctx.getUserManagementService = jest.fn().mockReturnValue({
        findMatchingBlacklistEntry: jest.fn().mockReturnValue(null),
      });

      handleWALLOPS(ctx, 'oper!oper@server', ['test wallops'], Date.now());

      expect(ctx.runBlacklistAction).not.toHaveBeenCalled();
    });

    it('extracts nick from prefix', () => {
      ctx.extractNick = jest.fn().mockReturnValue('extracted_nick');
      handleWALLOPS(ctx, 'extracted_nick!user@host', ['msg'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'extracted_nick' }),
      );
    });

    it('sets rawCategory to server', () => {
      handleWALLOPS(ctx, 'oper!oper@host', ['test'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ rawCategory: 'server' }),
      );
    });
  });

  describe('handleREGISTER', () => {
    it('handles SUCCESS subcommand', () => {
      const ts = Date.now();
      handleREGISTER(ctx, '', ['SUCCESS', 'testaccount', 'Welcome!'], ts);

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'raw',
          isRaw: true,
          rawCategory: 'server',
        }),
      );
      expect(ctx.emit).toHaveBeenCalledWith(
        'account-registered',
        'testaccount',
        'Welcome!',
      );
    });

    it('handles VERIFICATION_REQUIRED subcommand', () => {
      const ts = Date.now();
      handleREGISTER(
        ctx,
        '',
        ['VERIFICATION_REQUIRED', 'myaccount', 'Check email'],
        ts,
      );

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'raw', isRaw: true }),
      );
      expect(ctx.emit).toHaveBeenCalledWith(
        'account-verification-required',
        'myaccount',
        'Check email',
      );
    });

    it('handles unknown subcommand with raw message', () => {
      handleREGISTER(ctx, '', ['UNKNOWN', 'data'], Date.now());

      expect(ctx.addRawMessage).toHaveBeenCalled();
      expect(ctx.emit).not.toHaveBeenCalled();
    });

    it('handles empty params', () => {
      handleREGISTER(ctx, '', [], Date.now());

      expect(ctx.addRawMessage).toHaveBeenCalled();
    });

    it('uses success case insensitively (uppercase)', () => {
      handleREGISTER(ctx, '', ['success', 'acc', 'msg'], Date.now());

      // 'success'.toUpperCase() === 'SUCCESS'
      expect(ctx.emit).toHaveBeenCalledWith('account-registered', 'acc', 'msg');
    });

    it('joins multi-word message correctly', () => {
      handleREGISTER(
        ctx,
        '',
        ['SUCCESS', 'acc', 'Your', 'account', 'is', 'created'],
        Date.now(),
      );

      expect(ctx.emit).toHaveBeenCalledWith(
        'account-registered',
        'acc',
        'Your account is created',
      );
    });
  });
});
