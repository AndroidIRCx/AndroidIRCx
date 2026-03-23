/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle609,
  handle610,
  handle619,
  handle660,
  handle661,
  handle667,
  handle674,
  handle710,
  handle712,
  handle720,
  handle723,
  handle729,
  handle742,
  handle764,
  handle915,
  handle972,
  extendedHandlers,
} from '../../../../src/services/irc/numerics/ExtendedNumerics';

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

describe('ExtendedNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
    };
  });

  it('registers representative extended numeric handlers', () => {
    expect(extendedHandlers.get(609)).toBe(handle609);
    expect(extendedHandlers.get(667)).toBe(handle667);
    expect(extendedHandlers.get(729)).toBe(handle729);
    expect(extendedHandlers.get(972)).toBe(handle972);
  });

  it('formats watch and WHOWAS related numerics', () => {
    handle609(ctx, 'server', ['nick', 'oldNick', 'newNick', 'user', 'host'], 500);
    handle610(ctx, 'server', ['nick', 'alice', ':seen yesterday'], 501);
    handle619(ctx, 'server', ['nick', 'alice', ':End of WHOWAS'], 502);
    extendedHandlers.get(611)?.(ctx, 'server', ['nick', ':service info'], 503);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** oldNick changed nick to newNick (user@host)', rawCategory: 'user' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** WHOWAS alice: seen yesterday' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** alice: End of WHOWAS' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ text: '*** [611] service info', rawCategory: 'server' })
    );
  });

  it('formats online state, knock, motd, and mode numerics', () => {
    handle660(ctx, 'server', ['nick', 'alice', ':is now online'], 504);
    handle661(ctx, 'server', ['nick', 'alice', ':is now offline'], 505);
    handle710(ctx, 'server', ['nick', '#chat', ':has knocked'], 506);
    handle720(ctx, 'server', ['nick', ':Operator MOTD'], 507);
    handle729(ctx, 'server', ['nick', '#chat', '+nt'], 508);
    extendedHandlers.get(700)?.(ctx, 'server', ['nick', ':generic extended'], 509);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** alice is now online' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** alice is now offline' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** #chat: has knocked' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ text: '*** Operator MOTD' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ text: '*** #chat modes: +nt' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ text: '*** [700] generic extended' })
    );
  });

  it('formats representative extended errors', () => {
    handle667(ctx, 'server', ['nick'], 510);
    handle674(ctx, 'server', ['nick'], 511);
    handle712(ctx, 'server', ['nick'], 512);
    handle723(ctx, 'server', ['nick'], 513);
    handle742(ctx, 'server', ['nick'], 514);
    handle764(ctx, 'server', ['nick'], 515);
    handle915(ctx, 'server', ['nick'], 516);
    handle972(ctx, 'server', ['nick'], 517);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(1, {
      type: 'error',
      text: '[667] Target change too fast',
      timestamp: 510,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(2, {
      type: 'error',
      text: '[674] Cannot set modes',
      timestamp: 511,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(3, {
      type: 'error',
      text: '[712] Too many knocks',
      timestamp: 512,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(4, {
      type: 'error',
      text: '[723] Insufficient privileges',
      timestamp: 513,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(5, {
      type: 'error',
      text: '[742] Mode lock restricted',
      timestamp: 514,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(6, {
      type: 'error',
      text: '[764] Metadata limit reached',
      timestamp: 515,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(7, {
      type: 'error',
      text: '[915] Access denied',
      timestamp: 516,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(8, {
      type: 'error',
      text: '[972] Cannot execute command',
      timestamp: 517,
    });
  });
});
