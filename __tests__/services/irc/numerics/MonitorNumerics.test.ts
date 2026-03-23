/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle600,
  handle601,
  handle602,
  handle603,
  handle604,
  handle605,
  handle606,
  handle607,
  handle608,
  handle730,
  handle731,
  handle732,
  handle733,
  handle734,
  monitorHandlers,
} from '../../../../src/services/irc/numerics/MonitorNumerics';

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

describe('MonitorNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
    };
  });

  it('registers monitor handlers', () => {
    expect(monitorHandlers.get(600)).toBe(handle600);
    expect(monitorHandlers.get(734)).toBe(handle734);
  });

  it('formats user online and offline status numerics', () => {
    handle600(ctx, 'server', ['nick', 'alice', 'user', 'host', '*', ':logged online'], 600);
    handle601(ctx, 'server', ['nick', 'alice', 'user', 'host', '*', ':logged offline'], 601);
    handle604(ctx, 'server', ['nick', 'alice', 'user', 'host', '*', ':is online'], 604);
    handle605(ctx, 'server', ['nick', 'alice', 'user', 'host', '*', ':is offline'], 605);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** alice (user@host) logged online', rawCategory: 'user' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** alice (user@host) logged offline', rawCategory: 'user' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** alice (user@host) is online', rawCategory: 'user' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ text: '*** alice (user@host) is offline', rawCategory: 'user' })
    );
  });

  it('formats watch-list numerics', () => {
    handle602(ctx, 'server', ['nick', 'alice'], 602);
    handle603(ctx, 'server', ['nick', 'alice'], 603);
    handle606(ctx, 'server', ['nick', 'alice', ':watch details'], 606);
    handle607(ctx, 'server', ['nick'], 607);
    handle608(ctx, 'server', ['nick'], 608);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** alice added to watch list', rawCategory: 'server' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** alice removed from watch list', rawCategory: 'server' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** Watch: alice watch details' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ text: '*** End of WATCH list' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ text: '*** Watch list cleared' })
    );
  });

  it('formats monitor list numerics', () => {
    handle730(ctx, 'server', ['nick', ':alice bob'], 730);
    handle731(ctx, 'server', ['nick', ':carol'], 731);
    handle732(ctx, 'server', ['nick', ':alice,bob,carol'], 732);
    handle733(ctx, 'server', ['nick'], 733);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** Now online: alice bob' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** Now offline: carol' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** MONITOR list: alice,bob,carol' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ text: '*** End of MONITOR list' })
    );
  });

  it('formats monitor list full errors', () => {
    handle734(ctx, 'server', ['nick', '100', 'alice,bob'], 734);

    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'error',
      text: 'Monitor list is full (limit: 100, tried: alice,bob)',
      timestamp: 734,
    });
  });
});
