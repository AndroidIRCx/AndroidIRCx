/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle401,
  handle409,
  handle433,
  handle441,
  handle443,
  handle465,
  handle470,
  errorHandlers,
} from '../../../../src/services/irc/numerics/ErrorNumerics';

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

describe('ErrorNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
      addRawMessage: jest.fn(),
      disconnect: jest.fn(),
      getAltNick: jest.fn(() => 'AltNick'),
      getCurrentNick: jest.fn(() => 'CurrentNick'),
      getNickChangeAttempts: jest.fn(() => 0),
      getWhowasAt: jest.fn(() => 0),
      getWhowasTarget: jest.fn(() => null),
      incrementNickChangeAttempts: jest.fn(),
      logRaw: jest.fn(),
      sendRaw: jest.fn(),
      setCurrentNick: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers error handlers', () => {
    expect(errorHandlers.get(401)).toBe(handle401);
    expect(errorHandlers.get(433)).toBe(handle433);
    expect(errorHandlers.get(470)).toBe(handle470);
    expect(errorHandlers.get(484)).toBe(handle465);
  });

  it('adds WHOWAS hint for recent ERR_NOSUCHNICK lookups', () => {
    jest.spyOn(Date, 'now').mockReturnValue(5000);
    ctx.getWhowasTarget.mockReturnValue('alice');
    ctx.getWhowasAt.mockReturnValue(1000);

    handle401(ctx, 'server', ['nick', 'alice', ':No such nick/channel'], 200);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(1, {
      type: 'error',
      text: 'alice: No such nick/channel',
      timestamp: 200,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(2, {
      type: 'notice',
      text: '*** WHOWAS has no history for alice. If they are online, try /whois {nick}.',
      timestamp: 200,
    });
  });

  it('formats simple and multi-target channel errors', () => {
    handle409(ctx, 'server', ['nick', ':No origin specified'], 201);
    handle441(
      ctx,
      'server',
      ['nick', 'alice', '#chat', ':They are not here'],
      202,
    );
    handle443(
      ctx,
      'server',
      ['nick', 'alice', '#chat', ':already joined'],
      203,
    );

    expect(ctx.addMessage).toHaveBeenNthCalledWith(1, {
      type: 'error',
      text: 'No origin specified',
      timestamp: 201,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(2, {
      type: 'error',
      text: 'alice #chat: They are not here',
      timestamp: 202,
    });
    expect(ctx.addMessage).toHaveBeenNthCalledWith(3, {
      type: 'error',
      text: 'alice #chat: already joined',
      timestamp: 203,
    });
  });

  it('tries alternative nick when nickname is in use and attempts remain', () => {
    handle433(
      ctx,
      'server',
      ['nick', 'TakenNick', ':Nickname is already in use'],
      204,
    );

    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'error',
      text: 'Nickname is already in use: TakenNick',
      timestamp: 204,
    });
    expect(ctx.incrementNickChangeAttempts).toHaveBeenCalled();
    expect(ctx.logRaw).toHaveBeenCalledWith(
      'IRCService: Trying altnick: AltNick',
    );
    expect(ctx.sendRaw).toHaveBeenCalledWith('NICK AltNick');
    expect(ctx.setCurrentNick).toHaveBeenCalledWith('AltNick');
    expect(ctx.addRawMessage).toHaveBeenCalledWith(
      '*** Trying alternative nickname: AltNick',
      'auth',
    );
  });

  it('falls back to randomized nick when no alt nick is available', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.123);
    ctx.getAltNick.mockReturnValue(null);

    handle433(ctx, 'server', ['nick'], 205);

    expect(ctx.logRaw).toHaveBeenCalledWith(
      'IRCService: Trying fallback nick: CurrentNick123',
    );
    expect(ctx.sendRaw).toHaveBeenCalledWith('NICK CurrentNick123');
    expect(ctx.setCurrentNick).toHaveBeenCalledWith('CurrentNick123');
    expect(ctx.addRawMessage).toHaveBeenCalledWith(
      '*** Trying fallback nickname: CurrentNick123',
      'auth',
    );
  });

  it('disconnects and logs connection-blocked errors', () => {
    handle465(ctx, 'server', ['nick', ':Banned from this server'], 206);

    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'error',
      text: ':Banned from this server',
      timestamp: 206,
    });
    expect(ctx.addRawMessage).toHaveBeenCalledWith(
      '*** Connection blocked: :Banned from this server',
      'connection',
    );
    expect(ctx.disconnect).toHaveBeenCalledWith(':Banned from this server');
  });

  it('formats channel forwarding notices', () => {
    handle470(ctx, 'server', ['nick', '#from', '#to', ':Forwarded'], 207);

    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'notice',
      text: '#from -> #to: Forwarded',
      timestamp: 207,
      isRaw: true,
      rawCategory: 'server',
    });
  });
});
