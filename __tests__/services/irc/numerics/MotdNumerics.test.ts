/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle372,
  handle375,
  handle376,
  handle422,
  motdHandlers,
} from '../../../../src/services/irc/numerics/MotdNumerics';

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

describe('MotdNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
      emit: jest.fn(),
    };
  });

  it('registers MOTD numeric handlers', () => {
    expect(motdHandlers.get(372)).toBe(handle372);
    expect(motdHandlers.get(375)).toBe(handle375);
    expect(motdHandlers.get(376)).toBe(handle376);
    expect(motdHandlers.get(422)).toBe(handle422);
  });

  it('formats a MOTD line for 372', () => {
    handle372(ctx, 'server', ['nick', 'Welcome to the network'], 100);

    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'raw',
      text: '*** Welcome to the network',
      timestamp: 100,
      isRaw: true,
      rawCategory: 'server',
    });
  });

  it('formats the MOTD header for 375', () => {
    handle375(ctx, 'server', ['nick', 'irc.example.org'], 101);

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '*** - irc.example.org Message of the Day -',
        rawCategory: 'server',
      }),
    );
  });

  it('emits motdEnd for 376', () => {
    handle376(ctx, 'server', ['nick'], 102);

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** End of /MOTD command.' }),
    );
    expect(ctx.emit).toHaveBeenCalledWith('motdEnd');
  });

  it('emits motdEnd for 422 when no motd exists', () => {
    handle422(ctx, 'server', ['nick'], 103);

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** No Message of the Day.' }),
    );
    expect(ctx.emit).toHaveBeenCalledWith('motdEnd');
  });
});
