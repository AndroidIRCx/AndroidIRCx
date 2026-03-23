/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle200,
  handle201,
  handle202,
  handle203,
  handle204,
  handle205,
  handle206,
  handle207,
  handle208,
  handle209,
  handle210,
  traceHandlers,
} from '../../../../src/services/irc/numerics/TraceNumerics';

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

describe('TraceNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
    };
  });

  it('registers trace handlers', () => {
    expect(traceHandlers.get(200)).toBe(handle200);
    expect(traceHandlers.get(205)).toBe(handle205);
    expect(traceHandlers.get(210)).toBe(handle210);
  });

  it('formats trace numerics across all labels', () => {
    handle200(ctx, 'server', ['nick', ':link info'], 400);
    handle201(ctx, 'server', ['nick', ':connecting'], 401);
    handle202(ctx, 'server', ['nick', ':handshake'], 402);
    handle203(ctx, 'server', ['nick', ':unknown'], 403);
    handle204(ctx, 'server', ['nick', ':oper'], 404);
    handle205(ctx, 'server', ['nick', ':user'], 405);
    handle206(ctx, 'server', ['nick', ':server'], 406);
    handle207(ctx, 'server', ['nick', ':service'], 407);
    handle208(ctx, 'server', ['nick', ':new type'], 408);
    handle209(ctx, 'server', ['nick', ':class'], 409);
    handle210(ctx, 'server', ['nick', ':reconnect'], 410);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** Trace: link info', rawCategory: 'server' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** Trace: Connecting - connecting' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** Trace: Handshake - handshake' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ text: '*** Trace: Unknown - unknown' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ text: '*** Trace: Operator - oper' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ text: '*** Trace: User - user' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      7,
      expect.objectContaining({ text: '*** Trace: Server - server' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      8,
      expect.objectContaining({ text: '*** Trace: Service - service' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      9,
      expect.objectContaining({ text: '*** Trace: new type' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      10,
      expect.objectContaining({ text: '*** Trace: Class - class' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      11,
      expect.objectContaining({ text: '*** Trace: reconnect' })
    );
  });
});
