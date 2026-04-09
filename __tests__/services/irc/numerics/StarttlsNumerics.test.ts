/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle670,
  handle691,
  starttlsHandlers,
} from '../../../../src/services/irc/numerics/StarttlsNumerics';

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

describe('StarttlsNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
    };
  });

  it('registers STARTTLS handlers including extended numerics', () => {
    expect(starttlsHandlers.get(670)).toBe(handle670);
    expect(starttlsHandlers.get(691)).toBe(handle691);
    expect(starttlsHandlers.has(690)).toBe(true);
    expect(starttlsHandlers.has(699)).toBe(true);
  });

  it('formats a successful STARTTLS response from server params', () => {
    handle670(ctx, 'server', ['nick', ':STARTTLS negotiation successful'], 200);

    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'raw',
      text: '*** STARTTLS negotiation successful',
      timestamp: 200,
      isRaw: true,
      rawCategory: 'server',
    });
  });

  it('uses the fallback success message when server text is missing', () => {
    handle670(ctx, 'server', ['nick'], 201);

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** STARTTLS successful' }),
    );
  });

  it('formats a failed STARTTLS response', () => {
    handle691(ctx, 'server', ['nick', ':TLS unavailable'], 202);

    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'error',
      text: 'TLS unavailable',
      timestamp: 202,
    });
  });

  it('uses the fallback failure message when server text is missing', () => {
    handle691(ctx, 'server', ['nick'], 203);

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'STARTTLS failed' }),
    );
  });

  it('formats extended tls numerics through the registry', () => {
    const handler690 = starttlsHandlers.get(690);
    const handler699 = starttlsHandlers.get(699);

    handler690?.(ctx, 'server', ['nick', ':TLS capability advertised'], 204);
    handler699?.(ctx, 'server', ['nick'], 205);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: '*** [690] TLS capability advertised',
        rawCategory: 'server',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: '*** [699] ',
        rawCategory: 'server',
      }),
    );
  });
});
