/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleCAP,
  capCommandHandlers,
} from '../../../../src/services/irc/commands/CapCommandHandlers';

describe('CapCommandHandlers', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      handleCAPCommand: jest.fn(),
    };
  });

  describe('capCommandHandlers map', () => {
    it('registers CAP handler', () => {
      expect(capCommandHandlers.has('CAP')).toBe(true);
    });

    it('has exactly one entry', () => {
      expect(capCommandHandlers.size).toBe(1);
    });

    it('maps CAP to handleCAP function', () => {
      expect(capCommandHandlers.get('CAP')).toBe(handleCAP);
    });
  });

  describe('handleCAP', () => {
    it('calls handleCAPCommand with params', () => {
      const params = ['* LS', 'multi-prefix sasl'];
      handleCAP(ctx, 'server', params, Date.now());

      expect(ctx.handleCAPCommand).toHaveBeenCalledWith(params);
    });

    it('calls handleCAPCommand with empty params', () => {
      handleCAP(ctx, '', [], Date.now());

      expect(ctx.handleCAPCommand).toHaveBeenCalledWith([]);
    });

    it('calls handleCAPCommand with ACK params', () => {
      const params = ['* ACK', 'sasl'];
      handleCAP(ctx, 'server', params, Date.now());

      expect(ctx.handleCAPCommand).toHaveBeenCalledWith(params);
    });

    it('calls handleCAPCommand with END params', () => {
      const params = ['* END'];
      handleCAP(ctx, 'server', params, Date.now());

      expect(ctx.handleCAPCommand).toHaveBeenCalledWith(params);
    });

    it('does not call any other context method', () => {
      const extraCtx = {
        handleCAPCommand: jest.fn(),
        addMessage: jest.fn(),
        emit: jest.fn(),
      };
      handleCAP(extraCtx, 'server', ['LS'], Date.now());

      expect(extraCtx.addMessage).not.toHaveBeenCalled();
      expect(extraCtx.emit).not.toHaveBeenCalled();
    });
  });
});
