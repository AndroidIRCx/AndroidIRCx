/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle219,
  handle221,
  handle242,
  handle250,
  handle261,
  handle262,
  handle263,
  handle364,
  handle365,
  handle392,
  handle393,
  handle394,
  handle395,
  statsHandlers,
} from '../../../../src/services/irc/numerics/StatsNumerics';

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

describe('StatsNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
      getCurrentNick: jest.fn(() => 'CurrentNick'),
      isSilentModeNick: jest.fn(() => false),
      removeSilentModeNick: jest.fn(),
      updateSelfUserModes: jest.fn(),
    };
  });

  it('registers stats handlers', () => {
    expect(statsHandlers.get(211)).toBeDefined();
    expect(statsHandlers.get(219)).toBe(handle219);
    expect(statsHandlers.get(221)).toBe(handle221);
    expect(statsHandlers.get(365)).toBe(handle365);
  });

  it('formats representative stats and links numerics', () => {
    statsHandlers.get(211)?.(ctx, 'server', ['nick', ':stats line'], 300);
    handle219(ctx, 'server', ['nick', 'l', ':End of STATS report'], 301);
    handle242(ctx, 'server', ['nick', ':Server Up 2 days'], 302);
    handle250(ctx, 'server', ['nick', ':Highest connection count 42'], 303);
    handle261(ctx, 'server', ['nick', ':trace details'], 304);
    handle262(ctx, 'server', ['nick', ':End of TRACE'], 305);
    handle263(ctx, 'server', ['nick', 'WHO', ':Please wait'], 306);
    handle364(
      ctx,
      'server',
      ['nick', '*.example', 'irc.example.org', ':0 server info'],
      307,
    );
    handle365(ctx, 'server', ['nick', '*.example', ':End of LINKS'], 308);
    handle392(ctx, 'server', ['nick', ':Users start'], 309);
    handle393(ctx, 'server', ['nick', ':alice tty1'], 310);
    handle394(ctx, 'server', ['nick', ':End of users'], 311);
    handle395(ctx, 'server', ['nick', ':Nobody logged in'], 312);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: '*** [211] stats line',
        rawCategory: 'server',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** l: End of STATS report' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** Server Up 2 days' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ text: '*** Highest connection count 42' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ text: '*** Trace Log: trace details' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ text: '*** End of TRACE' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(7, {
      type: 'error',
      text: '*** WHO: Please wait',
      timestamp: 306,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      8,
      expect.objectContaining({
        text: '*** *.example -> irc.example.org 0 server info',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      9,
      expect.objectContaining({ text: '*** *.example: End of LINKS' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      10,
      expect.objectContaining({ text: '*** Users start' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      11,
      expect.objectContaining({ text: '*** alice tty1' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      12,
      expect.objectContaining({ text: '*** End of users' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      13,
      expect.objectContaining({ text: '*** Nobody logged in' }),
    );
  });

  it('updates user modes and suppresses silent mode output', () => {
    ctx.isSilentModeNick.mockReturnValue(true);

    handle221(ctx, 'server', ['nick', '+iw'], 313);

    expect(ctx.updateSelfUserModes).toHaveBeenCalledWith('+iw');
    expect(ctx.removeSilentModeNick).toHaveBeenCalledWith('currentnick');
    expect(ctx.addMessage).not.toHaveBeenCalled();
  });

  it('shows user modes when mode lookup is not silent', () => {
    handle221(ctx, 'server', ['nick', '+o'], 314);

    expect(ctx.updateSelfUserModes).toHaveBeenCalledWith('+o');
    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'raw',
      text: '*** User modes: +o',
      timestamp: 314,
      isRaw: true,
      rawCategory: 'server',
    });
  });
});
