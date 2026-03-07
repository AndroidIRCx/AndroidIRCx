/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleMARKREAD,
  handleREDACT,
  readMarkerCommandHandlers,
} from '../../../../src/services/irc/commands/ReadMarkerCommandHandlers';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('ReadMarkerCommandHandlers', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
      emit: jest.fn(),
      logRaw: jest.fn(),
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
    };
  });

  describe('readMarkerCommandHandlers map', () => {
    it('registers MARKREAD', () => {
      expect(readMarkerCommandHandlers.has('MARKREAD')).toBe(true);
    });

    it('registers REDACT', () => {
      expect(readMarkerCommandHandlers.has('REDACT')).toBe(true);
    });
  });

  describe('handleMARKREAD', () => {
    it('emits read-marker-received event with target and nick', () => {
      handleMARKREAD(ctx, 'nick!user@host', ['#channel', 'timestamp=1234567890'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('read-marker-received', '#channel', 'nick', 1234567890);
    });

    it('uses Date.now() when no timestamp param provided', () => {
      const before = Date.now();
      handleMARKREAD(ctx, 'nick!user@host', ['#channel', ''], Date.now());
      const after = Date.now();
      const emitCall = ctx.emit.mock.calls[0];
      const usedTimestamp = emitCall[3];
      expect(usedTimestamp).toBeGreaterThanOrEqual(before);
      expect(usedTimestamp).toBeLessThanOrEqual(after);
    });

    it('uses Date.now() when no params provided', () => {
      handleMARKREAD(ctx, 'nick!user@host', [], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('read-marker-received', '', 'nick', expect.any(Number));
    });

    it('logs raw message', () => {
      handleMARKREAD(ctx, 'nick!user@host', ['#channel', 'timestamp=999'], Date.now());
      expect(ctx.logRaw).toHaveBeenCalled();
    });

    it('parses timestamp from tsParam correctly', () => {
      handleMARKREAD(ctx, 'nick!user@host', ['#channel', 'timestamp=1700000000'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('read-marker-received', '#channel', 'nick', 1700000000);
    });
  });

  describe('handleREDACT', () => {
    it('emits message-redacted event', () => {
      handleREDACT(ctx, 'nick!user@host', ['#channel', 'msg-id-123'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('message-redacted', '#channel', 'msg-id-123', 'nick');
    });

    it('adds raw message about deletion', () => {
      handleREDACT(ctx, 'nick!user@host', ['#channel', 'msg-id-123'], Date.now());
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'raw',
          channel: '#channel',
          isRaw: true,
          rawCategory: 'user',
        })
      );
    });

    it('logs raw message', () => {
      handleREDACT(ctx, 'nick!user@host', ['#channel', 'msg-id-123'], Date.now());
      expect(ctx.logRaw).toHaveBeenCalled();
    });

    it('extracts nick from prefix', () => {
      ctx.extractNick = jest.fn().mockReturnValue('redactor');
      handleREDACT(ctx, 'redactor!user@host', ['#channel', 'msg123'], Date.now());
      expect(ctx.emit).toHaveBeenCalledWith('message-redacted', '#channel', 'msg123', 'redactor');
    });

    it('handles empty params', () => {
      handleREDACT(ctx, 'nick!user@host', [], Date.now());
      expect(ctx.addMessage).toHaveBeenCalled();
      expect(ctx.emit).toHaveBeenCalledWith('message-redacted', '', '', 'nick');
    });
  });
});
