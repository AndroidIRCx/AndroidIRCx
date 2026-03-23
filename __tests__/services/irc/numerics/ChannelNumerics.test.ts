/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle321,
  handle322,
  handle323,
  handle329,
  handle341,
  handle346,
  handle347,
  handle348,
  handle349,
  handle364,
  handle365,
  handle367,
  handle368,
  channelHandlers,
} from '../../../../src/services/irc/numerics/ChannelNumerics';

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

describe('ChannelNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
    };
  });

  it('registers channel handlers', () => {
    expect(channelHandlers.get(321)).toBe(handle321);
    expect(channelHandlers.get(341)).toBe(handle341);
    expect(channelHandlers.get(368)).toBe(handle368);
  });

  it('formats channel list and channel management numerics', () => {
    handle321(ctx, 'server', ['nick'], 700);
    handle322(ctx, 'server', ['nick', '#chat', '42', ':General'], 701);
    handle323(ctx, 'server', ['nick'], 702);
    handle341(ctx, 'server', ['nick', 'Alice', '#chat'], 703);
    handle346(ctx, 'server', ['nick', '#chat', 'mask!*@*'], 704);
    handle347(ctx, 'server', ['nick', '#chat'], 705);
    handle348(ctx, 'server', ['nick', '#chat', 'except!*@*'], 706);
    handle349(ctx, 'server', ['nick', '#chat'], 707);
    handle368(ctx, 'server', ['nick', '#chat'], 708);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** Channel list:', rawCategory: 'server' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** #chat (42 users): General' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** End of channel list' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ text: '*** You have invited Alice to #chat', rawCategory: 'channel' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ text: '*** #chat invite list: mask!*@*' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ text: '*** End of #chat invite list' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      7,
      expect.objectContaining({ text: '*** #chat exception list: except!*@*' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      8,
      expect.objectContaining({ text: '*** End of #chat exception list' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      9,
      expect.objectContaining({ text: '*** End of #chat ban list' })
    );
  });

  it('formats creation time, links, and ban list metadata', () => {
    handle329(ctx, 'server', ['nick', '#chat', '1700000000'], 709);
    handle364(ctx, 'server', ['nick', '*', 'irc.example.org', ':hub server'], 710);
    handle365(ctx, 'server', ['nick', '*'], 711);
    handle367(ctx, 'server', ['nick', '#chat', '*!*@bad.host', 'Oper', '1700000000'], 712);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: expect.stringContaining('*** #chat was created on '), rawCategory: 'channel' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** Link: irc.example.org (hub server)', rawCategory: 'server' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** End of LINKS (*)' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        text: expect.stringContaining('*** #chat ban: *!*@bad.host (set by Oper on '),
        rawCategory: 'channel',
      })
    );
  });
});
