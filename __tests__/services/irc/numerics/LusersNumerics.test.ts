/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle251,
  handle252,
  handle253,
  handle254,
  handle255,
  handle256,
  handle257,
  handle258,
  handle259,
  handle265,
  handle266,
  lusersHandlers,
} from '../../../../src/services/irc/numerics/LusersNumerics';

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

describe('LusersNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
    };
  });

  it('registers lusers handlers', () => {
    expect(lusersHandlers.get(251)).toBe(handle251);
    expect(lusersHandlers.get(266)).toBe(handle266);
  });

  it('formats generic lusers messages', () => {
    handle251(ctx, 'server', ['nick', ':There are 10 users'], 500);
    handle255(ctx, 'server', ['nick', ':I have 2 clients and 1 server'], 501);
    handle256(ctx, 'server', ['nick'], 502);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** There are 10 users' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** I have 2 clients and 1 server' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** Administrative info' }),
    );
  });

  it('formats count-based numerics', () => {
    handle252(ctx, 'server', ['nick', '3'], 503);
    handle253(ctx, 'server', ['nick', '4'], 504);
    handle254(ctx, 'server', ['nick', '12'], 505);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** 3 operator(s) online' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** 4 unknown connection(s)' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** 12 channels formed' }),
    );
  });

  it('formats admin detail numerics', () => {
    handle257(ctx, 'server', ['nick', ':Admin location 1'], 506);
    handle258(ctx, 'server', ['nick', ':Admin location 2'], 507);
    handle259(ctx, 'server', ['nick', ':admin@example.org'], 508);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** Admin location 1' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** Admin location 2' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** admin@example.org' }),
    );
  });

  it('formats local and global user summaries', () => {
    handle265(ctx, 'server', ['nick', '25', '100'], 509);
    handle266(ctx, 'server', ['nick', '250', '1000'], 510);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** Current local users 25, max 100' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: '*** Current global users 250, max 1000',
      }),
    );
  });
});
