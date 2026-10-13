/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Bouncer replay detection: lines carrying an old server-time are marked
 * isPlayback, measured against the live phone/server clock offset.
 */

jest.mock('../src/services/IRCForegroundService', () => ({
  ircForegroundService: {
    start: jest.fn(),
    stop: jest.fn(),
    updateNotification: jest.fn(),
    isServiceRunning: jest.fn(() => false),
  },
}));

import { IRCService, IRCMessage } from '../src/services/IRCService';

const iso = (ms: number) => new Date(ms).toISOString();

describe('IRCService replay detection', () => {
  let irc: IRCService;
  let messages: IRCMessage[];

  const feed = (line: string) => (irc as any).handleIRCMessage(line);
  const lastChat = () =>
    [...messages].reverse().find(m => m.type === 'message');

  beforeEach(() => {
    irc = new IRCService();
    (irc as any).serverTime = true;
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
    (irc as any).socket = { write: jest.fn() };
    messages = [];
    irc.onMessage(m => messages.push(m));
  });

  it('marks a line far older than live as playback, a live line not', () => {
    feed(`@time=${iso(Date.now())} :srv PONG srv :keepalive`);
    feed(
      `@time=${iso(Date.now() - 2 * 3600_000)} :bob!u@h PRIVMSG #chan :old news`,
    );
    expect(lastChat()?.isPlayback).toBe(true);

    feed(`@time=${iso(Date.now())} :bob!u@h PRIVMSG #chan :fresh`);
    expect(lastChat()?.isPlayback).toBeFalsy();
  });

  it('copes with a phone clock that is ten minutes off', () => {
    const skew = 10 * 60_000; // server clock is ten minutes behind the phone
    feed(`@time=${iso(Date.now() - skew)} :srv PONG srv :keepalive`);
    feed(`@time=${iso(Date.now() - skew)} :bob!u@h PRIVMSG #chan :live`);
    expect(lastChat()?.isPlayback).toBeFalsy();

    feed(
      `@time=${iso(Date.now() - skew - 3600_000)} :bob!u@h PRIVMSG #chan :replayed`,
    );
    expect(lastChat()?.isPlayback).toBe(true);
  });

  it('learns the live offset from any line, and a PONG resets it', () => {
    // First tagged line sets the reference; a later, more live one lowers it.
    feed(`@time=${iso(Date.now() - 5 * 60_000)} :bob!u@h PRIVMSG #c :a`);
    feed(`@time=${iso(Date.now())} :bob!u@h PRIVMSG #c :b`);
    expect((irc as any).isReplayedTimestamp(Date.now() - 5 * 60_000)).toBe(
      true,
    );
    // The phone clock jumps an hour ahead; the next PONG re-anchors live time.
    feed(`@time=${iso(Date.now() - 3600_000)} :srv PONG srv :keepalive`);
    expect((irc as any).isReplayedTimestamp(Date.now() - 3600_000)).toBe(false);
  });

  it('never marks anything without server-time or before any tagged line', () => {
    expect((irc as any).isReplayedTimestamp(0)).toBe(false);
    (irc as any).serverTime = false;
    feed(`@time=${iso(Date.now())} :srv PONG srv :x`);
    expect((irc as any).isReplayedTimestamp(0)).toBe(false);
  });

  it('skips flood protection for replayed lines only', () => {
    feed(`@time=${iso(Date.now())} :srv PONG srv :keepalive`);
    const protection =
      require('../src/services/ProtectionService').protectionService;
    const spy = jest.spyOn(protection, 'evaluateIncomingMessage');
    for (let i = 0; i < 30; i++) {
      feed(
        `@time=${iso(Date.now() - 3600_000 + i)} :flood!u@h PRIVMSG #chan :line ${i}`,
      );
    }
    expect(spy).not.toHaveBeenCalled();
    feed(`@time=${iso(Date.now())} :flood!u@h PRIVMSG #chan :live`);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
