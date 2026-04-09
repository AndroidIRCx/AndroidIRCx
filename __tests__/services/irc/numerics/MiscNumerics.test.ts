/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle276,
  handle325,
  handle328,
  handle340,
  handle342,
  handle345,
  handle350,
  handle354,
  handle385,
  handle396,
  handle408,
  handle417,
  handle493,
  miscHandlers,
} from '../../../../src/services/irc/numerics/MiscNumerics';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string, params?: Record<string, unknown>) => {
      let result = key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          result = result.replace(`{${name}}`, String(value));
        }
      }
      return result;
    },
  },
}));

describe('MiscNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
    };
  });

  it('registers misc handlers', () => {
    expect(miscHandlers.get(276)).toBe(handle276);
    expect(miscHandlers.get(493)).toBe(handle493);
  });

  it('formats representative raw server numerics', () => {
    handle276(ctx, 'server', ['nick', 'alice', ':has client certificate'], 700);
    handle325(ctx, 'server', ['nick', '#ops', 'alice'], 701);
    handle328(
      ctx,
      'server',
      ['nick', '#chat', ':https://example.org/chat'],
      702,
    );
    handle340(ctx, 'server', ['nick', ':alice=+user@host'], 703);
    handle342(ctx, 'server', ['nick', 'alice'], 704);
    handle345(ctx, 'server', ['nick'], 705);
    handle350(
      ctx,
      'server',
      ['nick', 'alice', ':is connected via gateway'],
      706,
    );
    handle354(ctx, 'server', ['nick', '42', 'alice', 'user', 'host'], 707);
    handle385(ctx, 'server', ['nick'], 708);
    handle396(
      ctx,
      'server',
      ['nick', 'hidden.example', ':is now your hidden host'],
      709,
    );

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: '*** alice has client certificate',
        rawCategory: 'server',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: '*** alice is the unique operator of #ops',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        text: '*** #chat URL: https://example.org/chat',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ text: '*** UserIP: alice=+user@host' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ text: '*** alice: Summoning user to IRC' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ text: '*** End of channel reop list' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      7,
      expect.objectContaining({ text: '*** alice is connected via gateway' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      8,
      expect.objectContaining({ text: '*** WHO: 42 alice user host' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      9,
      expect.objectContaining({
        text: '*** You are no longer an IRC operator',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      10,
      expect.objectContaining({
        text: '*** hidden.example is now your hidden host',
      }),
    );
  });

  it('formats representative error numerics', () => {
    handle408(ctx, 'server', ['nick', 'chanserv', ':No such service'], 710);
    handle417(ctx, 'server', ['nick'], 711);
    handle493(ctx, 'server', ['nick'], 712);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(1, {
      type: 'error',
      text: '*** chanserv: No such service',
      timestamp: 710,
      isRaw: true,
      rawCategory: 'server',
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(2, {
      type: 'error',
      text: '*** Input line was too long',
      timestamp: 711,
      isRaw: true,
      rawCategory: 'server',
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(3, {
      type: 'error',
      text: '*** Feature not available',
      timestamp: 712,
      isRaw: true,
      rawCategory: 'server',
    });
  });
});
