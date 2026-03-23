/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle351,
  handle371,
  handle374,
  handle381,
  handle382,
  handle383,
  handle391,
  versionInfoHandlers,
} from '../../../../src/services/irc/numerics/VersionInfoNumerics';

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

describe('VersionInfoNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
      updateSelfUserModes: jest.fn(),
    };
  });

  it('registers version/info handlers', () => {
    expect(versionInfoHandlers.get(351)).toBe(handle351);
    expect(versionInfoHandlers.get(381)).toBe(handle381);
    expect(versionInfoHandlers.get(391)).toBe(handle391);
  });

  it('formats version info for 351', () => {
    handle351(ctx, 'server', ['nick', 'ircd-1.0', 'irc.example.org', ':build info'], 400);

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '*** Version: ircd-1.0 on irc.example.org build info',
        rawCategory: 'server',
      })
    );
  });

  it('formats info lines and end markers', () => {
    handle371(ctx, 'server', ['nick', ':some info'], 401);
    handle374(ctx, 'server', ['nick'], 402);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** some info' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** End of INFO' })
    );
  });

  it('updates self modes for oper status on 381', () => {
    handle381(ctx, 'server', ['nick'], 403);

    expect(ctx.updateSelfUserModes).toHaveBeenCalledWith('+o');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** You are now an IRC operator' })
    );
  });

  it('formats rehash, service, and time numerics', () => {
    handle382(ctx, 'server', ['nick', 'ircd.conf', ':Reloading config'], 404);
    handle383(ctx, 'server', ['nick', ':You are service'], 405);
    handle391(ctx, 'server', ['nick', 'irc.example.org', ':2026-03-23T12:00:00Z'], 406);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** ircd.conf: Reloading config' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** You are service' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** Time on irc.example.org: 2026-03-23T12:00:00Z' })
    );
  });
});
