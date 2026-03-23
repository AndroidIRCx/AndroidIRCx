/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle001,
  handle002,
  handle004,
  handle005,
  handle008,
  handle010,
  handle042,
  registrationHandlers,
} from '../../../../src/services/irc/numerics/RegistrationNumerics';

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

describe('RegistrationNumerics', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      addMessage: jest.fn(),
      emit: jest.fn(),
      getCurrentNick: jest.fn(() => 'CurrentNick'),
      isSilentModeNick: jest.fn(() => false),
      logRaw: jest.fn(),
      sendCommand: jest.fn(),
      setCurrentNick: jest.fn(),
      setRegistered: jest.fn(),
    };
  });

  it('registers registration handlers', () => {
    expect(registrationHandlers.get(1)).toBe(handle001);
    expect(registrationHandlers.get(5)).toBe(handle005);
    expect(registrationHandlers.get(42)).toBe(handle042);
  });

  it('handles welcome registration and requests user mode for current nick', () => {
    handle001(ctx, 'server', ['NewNick'], 100);

    expect(ctx.setRegistered).toHaveBeenCalledWith(true);
    expect(ctx.setCurrentNick).toHaveBeenCalledWith('NewNick');
    expect(ctx.sendCommand).toHaveBeenCalledWith('MODE CurrentNick');
    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'raw',
      text: '*** Welcome to the NewNick Network',
      timestamp: 100,
      isRaw: true,
      rawCategory: 'server',
    });
    expect(ctx.emit).toHaveBeenCalledWith('registered');
  });

  it('skips nick and mode update when welcome numeric has no nick', () => {
    ctx.getCurrentNick.mockReturnValueOnce('');

    handle001(ctx, 'server', [], 101);

    expect(ctx.setCurrentNick).not.toHaveBeenCalled();
    expect(ctx.sendCommand).not.toHaveBeenCalled();
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: '*** Welcome to the IRC Network' })
    );
  });

  it('formats host and server info numerics', () => {
    handle002(ctx, 'server', ['nick', ':Your host is irc.example.org'], 102);
    handle004(ctx, 'server', ['nick', 'irc.example.org', '1.0', 'iwso', 'mnt'], 103);
    handle010(ctx, 'server', ['nick', 'irc2.example.org', '6697', ':Try this instead'], 104);
    handle042(ctx, 'server', ['nick', ':UID123'], 105);

    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ text: '*** Your host is irc.example.org' })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        text: '*** Server: irc.example.org | Version: 1.0 | User modes: iwso | Channel modes: mnt',
      })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        text: '*** Server redirect: irc2.example.org:6697 - Try this instead',
      })
    );
    expect(ctx.addMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ text: '*** Your unique ID: UID123' })
    );
  });

  it('formats ISUPPORT features and logs parsed capability tokens', () => {
    handle005(
      ctx,
      'server',
      ['nick', 'CHANTYPES=#&', 'PREFIX=(ov)@+', 'NAMESX', ':are supported by this server'],
      106
    );

    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '*** Server supports: CHANTYPES=#& PREFIX=(ov)@+ NAMESX',
      })
    );
    expect(ctx.logRaw).toHaveBeenNthCalledWith(1, 'IRCService: Server capability CHANTYPES=#&');
    expect(ctx.logRaw).toHaveBeenNthCalledWith(2, 'IRCService: Server capability PREFIX=(ov)@+');
    expect(ctx.logRaw).toHaveBeenNthCalledWith(3, 'IRCService: Server capability NAMESX');
  });

  it('suppresses snomask output for silent mode nicks', () => {
    ctx.getCurrentNick.mockReturnValueOnce('CurrentNick');
    ctx.isSilentModeNick.mockReturnValueOnce(true);

    handle008(ctx, 'server', ['nick', '+s', ':server notices'], 107);

    expect(ctx.addMessage).not.toHaveBeenCalled();
  });

  it('formats snomask output when mode request is not silent', () => {
    handle008(ctx, 'server', ['nick', '+s', ':server notices'], 108);

    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'raw',
      text: '*** [8] +s server notices',
      timestamp: 108,
      isRaw: true,
      rawCategory: 'server',
    });
  });
});
