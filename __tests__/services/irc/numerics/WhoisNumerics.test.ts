/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle301,
  handle305,
  handle306,
  handle307,
  handle308,
  handle309,
  handle310,
  handle311,
  handle312,
  handle313,
  handle314,
  handle317,
  handle318,
  handle319,
  handle320,
  handle330,
  handle335,
  handle338,
  handle369,
  handle378,
  handle379,
  handle302,
  handle303,
  handle304,
  handle316,
  handle671,
  whoisHandlers,
} from '../../../../src/services/irc/numerics/WhoisNumerics';

jest.mock('../../../../src/i18n/localization', () => ({
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

jest.mock('../../../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: jest.fn(() => ({ whoisDisplayMode: 'active' })),
  },
}));

describe('WhoisNumerics', () => {
  let ctx: any;
  let updateWHOIS: jest.Mock;

  beforeEach(() => {
    updateWHOIS = jest.fn();
    ctx = {
      addMessage: jest.fn(),
      addRawMessage: jest.fn(),
      getCurrentNick: jest.fn(() => 'CurrentNick'),
      getNetworkName: jest.fn(() => 'TestNet'),
      getUserManagementService: jest.fn(() => ({ updateWHOIS })),
    };
  });

  it('registers WHOIS handlers', () => {
    expect(whoisHandlers.get(301)).toBe(handle301);
    expect(whoisHandlers.get(313)).toBe(handle313);
    expect(whoisHandlers.get(671)).toBe(handle671);
  });

  it('formats away and local-user status numerics', () => {
    handle301(ctx, 'server', ['nick', 'Alice', ':gone fishing'], 800);
    handle305(ctx, 'server', ['nick', ':back'], 801);
    handle306(ctx, 'server', ['nick', ':away now'], 802);
    handle302(ctx, 'server', ['nick', ':Alice=+user@host'], 803);
    handle303(ctx, 'server', ['nick', ':Alice Bob'], 804);
    handle304(ctx, 'server', ['nick', ':plain text'], 805);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: '*** Alice is away: gone fishing',
        rawCategory: 'server',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** back' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: '*** away now' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ text: '*** USERHOST: Alice=+user@host' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ text: '*** Users online: Alice Bob' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ text: '*** plain text' }),
    );
  });

  it('updates WHOIS cache for capability-like identity numerics', () => {
    handle307(
      ctx,
      'server',
      ['nick', 'Alice', ':identified for this nick'],
      806,
    );
    handle308(ctx, 'server', ['nick', 'Alice', ':is an admin'], 807);
    handle309(ctx, 'server', ['nick', 'Alice', ':is a services admin'], 808);
    handle310(ctx, 'server', ['nick', 'Alice', ':available for help'], 809);
    handle320(ctx, 'server', ['nick', 'Alice', ':is special'], 810);
    handle335(ctx, 'server', ['nick', 'Alice', ':is a bot'], 811);
    handle378(ctx, 'server', ['nick', 'Alice', ':gateway/user@host'], 812);
    handle379(ctx, 'server', ['nick', 'Alice', ':+iwx'], 813);
    handle671(
      ctx,
      'server',
      ['nick', 'Alice', ':is using a secure connection'],
      814,
    );

    expect(updateWHOIS).toHaveBeenNthCalledWith(
      1,
      { nick: 'Alice', isRegistered: true },
      'TestNet',
    );
    expect(updateWHOIS).toHaveBeenNthCalledWith(
      2,
      { nick: 'Alice', isAdmin: true },
      'TestNet',
    );
    expect(updateWHOIS).toHaveBeenNthCalledWith(
      3,
      { nick: 'Alice', isServicesAdmin: true },
      'TestNet',
    );
    expect(updateWHOIS).toHaveBeenNthCalledWith(
      4,
      { nick: 'Alice', isHelpOp: true },
      'TestNet',
    );
    expect(updateWHOIS).toHaveBeenNthCalledWith(
      5,
      { nick: 'Alice', specialStatus: 'is special' },
      'TestNet',
    );
    expect(updateWHOIS).toHaveBeenNthCalledWith(
      6,
      { nick: 'Alice', isBot: true },
      'TestNet',
    );
    expect(updateWHOIS).toHaveBeenNthCalledWith(
      7,
      { nick: 'Alice', connectingFrom: 'gateway/user@host' },
      'TestNet',
    );
    expect(updateWHOIS).toHaveBeenNthCalledWith(
      8,
      { nick: 'Alice', modes: '+iwx' },
      'TestNet',
    );
    expect(updateWHOIS).toHaveBeenNthCalledWith(
      9,
      {
        nick: 'Alice',
        secure: true,
        secureMessage: 'is using a secure connection',
      },
      'TestNet',
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: '*** Alice identified for this nick',
        whoisActiveTab: true,
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      9,
      expect.objectContaining({
        text: '*** Alice is using a secure connection',
      }),
    );
  });

  it('formats WHOIS user, server, channels, and summary numerics', () => {
    handle311(
      ctx,
      'server',
      ['nick', 'Alice', 'user', 'host', '*', ':Real Name'],
      815,
    );
    handle312(
      ctx,
      'server',
      ['nick', 'Alice', 'irc.example.org', ':Example IRC'],
      816,
    );
    handle317(ctx, 'server', ['nick', 'Alice', '3661', '1700000000'], 817);
    handle318(ctx, 'server', ['nick', 'Alice'], 818);
    handle319(ctx, 'server', ['nick', 'Alice', ':#chat @#ops'], 819);
    handle330(ctx, 'server', ['nick', 'Alice', 'alice_account'], 820);
    handle338(ctx, 'server', ['nick', 'Alice', 'cloak.example'], 821);
    handle316(ctx, 'server', ['nick', 'Alice', ':is a channel operator'], 822);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** Alice is user@host * Real Name' }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: '*** Alice using irc.example.org Example IRC',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        text: expect.stringContaining(
          '*** Alice has been idle 1 hours, 1 minutes, signed on ',
        ),
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        text: '*** End of WHOIS for Alice',
        whoisData: { nick: 'Alice' },
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        text: '*** Alice is on channels: #chat @#ops',
        whoisData: { nick: 'Alice', channels: ['#chat', '@#ops'] },
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        text: '*** Alice is logged in as alice_account',
        rawCategory: 'user',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      7,
      expect.objectContaining({
        text: '*** Alice is actually using host cloak.example',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      8,
      expect.objectContaining({ text: '*** Alice is a channel operator' }),
    );
  });

  it('adds oper shortcut notice when WHOIS operator matches current nick', () => {
    handle313(
      ctx,
      'server',
      ['nick', 'CurrentNick', ':is an IRC operator'],
      823,
    );

    expect(updateWHOIS).toHaveBeenCalledWith(
      { nick: 'CurrentNick', isOper: true },
      'TestNet',
    );
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '*** CurrentNick is an IRC operator',
        rawCategory: 'user',
      }),
    );
    expect(ctx.addRawMessage).toHaveBeenCalledWith(
      '*** You are now an IRC operator. Quick aliases: /oper /kill /gline /rehash /locops /wallops',
      'user',
    );
  });

  it('formats WHOWAS numerics', () => {
    handle314(
      ctx,
      'server',
      ['nick', 'Alice', 'user', 'old.host', '*', ':Old Real'],
      824,
    );
    handle369(ctx, 'server', ['nick', 'Alice'], 825);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: '*** Alice was user@old.host * Old Real',
      }),
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: '*** End of WHOWAS for Alice' }),
    );
  });

  /**
   * Every handler here reads its text out of `params` with a fallback, and the
   * ones that touch the WHOIS cache guard the service being absent. A server
   * that sends a numeric with nothing after it is ordinary — several send a
   * bare 305/306 — so the fallbacks are the normal path, not an edge case.
   */
  describe('numerics that arrive with nothing after them', () => {
    const ALL: Array<[string, any]> = [
      ['301', handle301],
      ['302', handle302],
      ['303', handle303],
      ['304', handle304],
      ['305', handle305],
      ['306', handle306],
      ['307', handle307],
      ['308', handle308],
      ['309', handle309],
      ['310', handle310],
      ['311', handle311],
      ['312', handle312],
      ['313', handle313],
      ['314', handle314],
      ['316', handle316],
      ['317', handle317],
      ['318', handle318],
      ['319', handle319],
      ['320', handle320],
      ['330', handle330],
      ['335', handle335],
      ['338', handle338],
      ['369', handle369],
      ['378', handle378],
      ['379', handle379],
      ['671', handle671],
    ];

    it.each(ALL)('%s says something sensible with no parameters', (_n, fn) => {
      fn(ctx, 'server', [], 900);

      expect(ctx.addMessage).toHaveBeenCalled();
      const message = ctx.addMessage.mock.calls.at(-1)[0];
      expect(typeof message.text).toBe('string');
      // A missing value must not reach the user as "undefined".
      expect(message.text).not.toMatch(/undefined|\[object/);
    });

    it.each(ALL)('%s copes with no user management service', (_n, fn) => {
      ctx.getUserManagementService = jest.fn(() => undefined);

      expect(() => fn(ctx, 'server', ['me', 'Alice'], 901)).not.toThrow();
      expect(ctx.addMessage).toHaveBeenCalled();
    });

    it.each(ALL)('%s copes with a service that cannot cache', (_n, fn) => {
      // An older service object with no updateWHOIS on it: the guard is two
      // conditions, and only one of them was ever exercised.
      ctx.getUserManagementService = jest.fn(() => ({}));

      expect(() => fn(ctx, 'server', ['me', 'Alice'], 902)).not.toThrow();
      expect(updateWHOIS).not.toHaveBeenCalled();
    });
  });

  describe('where a WHOIS reply is shown', () => {
    it('routes to the active tab or to the server tab, as configured', () => {
      const { useUIStore } = require('../../../../src/stores/uiStore');

      handle311(ctx, 'server', ['me', 'Alice', 'ali', 'host', '*', ':Real'], 1);
      expect(ctx.addMessage.mock.calls.at(-1)[0].whoisActiveTab).toBe(true);

      useUIStore.getState.mockReturnValue({ whoisDisplayMode: 'server' });
      handle311(ctx, 'server', ['me', 'Alice', 'ali', 'host', '*', ':Real'], 2);
      expect(ctx.addMessage.mock.calls.at(-1)[0].whoisActiveTab).toBe(false);

      useUIStore.getState.mockReturnValue({ whoisDisplayMode: 'active' });
    });
  });

  describe('idle time, in the units a person reads', () => {
    const idleTextOf = () => ctx.addMessage.mock.calls.at(-1)[0].text;

    it('counts hours and minutes past an hour', () => {
      handle317(ctx, 'server', ['me', 'Alice', '7325', '1700000000'], 1);
      expect(idleTextOf()).toContain('2 hours, 2 minutes');
    });

    it('counts minutes under an hour', () => {
      handle317(ctx, 'server', ['me', 'Alice', '300', '1700000000'], 2);
      expect(idleTextOf()).toContain('5 minutes');
    });

    it('counts seconds under a minute', () => {
      handle317(ctx, 'server', ['me', 'Alice', '42', '1700000000'], 3);
      expect(idleTextOf()).toContain('42 seconds');
    });

    it('says the signon time is unknown rather than showing the epoch', () => {
      handle317(ctx, 'server', ['me', 'Alice', '5', '0'], 4);
      expect(idleTextOf()).toContain('unknown');
    });
  });
});
