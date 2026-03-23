/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle900,
  handle901,
  handle902,
  handle903,
  handle904,
  handle905,
  handle906,
  handle907,
  handle908,
  saslHandlers,
} from '../../../../src/services/irc/numerics/SaslNumerics';

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

describe('SaslNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
      emit: jest.fn(),
      setSaslAuthenticating: jest.fn(),
      endCAPNegotiation: jest.fn(),
    };
  });

  it('registers SASL numeric handlers', () => {
    expect(saslHandlers.get(900)).toBe(handle900);
    expect(saslHandlers.get(903)).toBe(handle903);
    expect(saslHandlers.get(908)).toBe(handle908);
  });

  it('formats logged-in responses for 900', () => {
    handle900(ctx, 'server', ['nick', 'account-info', 'alice', ':Welcome back'], 300);

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'raw',
        text: '*** Welcome back',
        rawCategory: 'auth',
      })
    );
  });

  it('falls back to the account message when 900 has no trailing text', () => {
    handle900(ctx, 'server', ['nick', 'account-info', 'alice'], 301);

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** You are now logged in as alice' })
    );
  });

  it('handles 901 logout responses', () => {
    handle901(ctx, 'server', ['nick', 'account', ':Signed out'], 302);

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** Signed out', rawCategory: 'auth' })
    );
  });

  it('handles 902 nick locked errors', () => {
    handle902(ctx, 'server', ['nick', ':Nick is locked'], 303);

    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'error',
      text: 'Nick is locked',
      timestamp: 303,
    });
  });

  it('handles successful SASL auth for 903', () => {
    handle903(ctx, 'server', ['nick'], 304);

    expect(ctx.setSaslAuthenticating).toHaveBeenCalledWith(false);
    expect(ctx.emit).toHaveBeenCalledWith('sasl-success');
    expect(ctx.endCAPNegotiation).toHaveBeenCalled();
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** SASL authentication successful' })
    );
  });

  it('handles failed SASL auth for 904', () => {
    handle904(ctx, 'server', ['nick'], 305);

    expect(ctx.setSaslAuthenticating).toHaveBeenCalledWith(false);
    expect(ctx.emit).toHaveBeenCalledWith('sasl-fail');
    expect(ctx.endCAPNegotiation).toHaveBeenCalled();
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', text: 'SASL authentication failed' })
    );
  });

  it('uses explicit server text for 905 and 907', () => {
    handle905(ctx, 'server', ['nick', ':Payload too large'], 306);
    handle907(ctx, 'server', ['nick', ':Already authenticated'], 307);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(1, {
      type: 'error',
      text: 'Payload too large',
      timestamp: 306,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(2, {
      type: 'error',
      text: 'Already authenticated',
      timestamp: 307,
    });
  });

  it('handles aborted SASL auth for 906 and ends CAP negotiation', () => {
    handle906(ctx, 'server', ['nick'], 308);

    expect(ctx.setSaslAuthenticating).toHaveBeenCalledWith(false);
    expect(ctx.endCAPNegotiation).toHaveBeenCalled();
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'SASL authentication aborted' })
    );
  });

  it('formats available SASL mechanisms for 908', () => {
    handle908(ctx, 'server', ['nick', 'PLAIN,EXTERNAL', ':available on this server'], 309);

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'raw',
        text: '*** PLAIN,EXTERNAL available on this server',
        rawCategory: 'auth',
      })
    );
  });
});
