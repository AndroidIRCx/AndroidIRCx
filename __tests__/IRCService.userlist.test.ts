/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * User-list updates are coalesced: a busy channel's JOIN/PART/QUIT/MODE
 * stream reaches listeners as one list per flush, not one per event.
 */

jest.mock('../src/services/IRCForegroundService', () => ({
  ircForegroundService: {
    start: jest.fn(),
    stop: jest.fn(),
    updateNotification: jest.fn(),
    isServiceRunning: jest.fn(() => false),
  },
}));

import { IRCService } from '../src/services/IRCService';

describe('IRCService user-list coalescing', () => {
  let irc: IRCService;
  let emits: Array<{ channel: string; count: number }>;

  const feed = (line: string) => (irc as any).handleIRCMessage(line);

  const joinBigChannel = (size: number) => {
    const names = Array.from({ length: size }, (_, i) => `user${i}`);
    for (let i = 0; i < names.length; i += 300) {
      feed(`:srv 353 tester = #big :${names.slice(i, i + 300).join(' ')}`);
    }
    feed(':srv 366 tester #big :End of /NAMES list.');
  };

  beforeEach(() => {
    jest.useFakeTimers();
    irc = new IRCService();
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
    (irc as any).socket = { write: jest.fn() };
    emits = [];
    irc.onUserListChange((channel, users) =>
      emits.push({ channel, count: users.length }),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends the NAMES list at once, then one list per burst of changes', () => {
    joinBigChannel(2000);
    expect(emits).toEqual([{ channel: '#big', count: 2000 }]);

    for (let i = 0; i < 50; i++) {
      feed(`:new${i}!u@h JOIN #big`);
      feed(`:user${i}!u@h PART #big :bye`);
    }
    feed(':user100!u@h QUIT :gone');
    expect(emits).toHaveLength(1);

    jest.advanceTimersByTime(150);
    expect(emits).toEqual([
      { channel: '#big', count: 2000 },
      { channel: '#big', count: 1999 },
    ]);
  });

  it('does not touch the user list for modes that are not user prefixes', () => {
    joinBigChannel(10);
    (irc as any).handleChannelModeChange('#big', ['+b', '*!*@spam']);
    (irc as any).handleChannelModeChange('#big', ['+l', '50']);
    jest.advanceTimersByTime(200);
    expect(emits).toHaveLength(1);

    (irc as any).handleChannelModeChange('#big', ['+o', 'user1']);
    jest.advanceTimersByTime(150);
    expect(emits).toHaveLength(2);
  });

  it('flushes several dirty channels together and can be flushed early', () => {
    joinBigChannel(5);
    feed(':srv 353 tester = #small :a b');
    feed(':srv 366 tester #small :End of /NAMES list.');
    emits = [];

    feed(':x!u@h JOIN #big');
    feed(':y!u@h JOIN #small');
    irc.flushUserListUpdates();
    expect(emits.map(e => e.channel).sort()).toEqual(['#big', '#small']);

    jest.advanceTimersByTime(500);
    expect(emits).toHaveLength(2);
  });

  it('looks up one user by nick, case-insensitively', () => {
    joinBigChannel(3);
    feed(':srv MODE #big +o user1');
    expect(irc.getChannelUser('#big', 'USER1')?.modes).toEqual(['o']);
    expect(irc.getChannelUser('#big', 'nobody')).toBeUndefined();
    expect(irc.getChannelUser('#none', 'user1')).toBeUndefined();
  });

  it('drops pending changes when the connection is torn down', () => {
    joinBigChannel(5);
    feed(':x!u@h JOIN #big');
    (irc as any).cleanupConnectionTimers();
    jest.advanceTimersByTime(500);
    expect(emits).toHaveLength(1);
  });
});
