/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCService, IRCConnectionConfig, IRCMessage } from '../src/services/IRCService';
import { DEFAULT_PART_MESSAGE, DEFAULT_QUIT_MESSAGE, settingsService } from '../src/services/SettingsService';
import { FakeSocket } from '../test-support/FakeSocket';

jest.mock('react-native-tcp-socket', () => {
  const { FakeSocket } = jest.requireActual('../test-support/FakeSocket');
  const socket = new FakeSocket();
  const api: any = {
    createConnection: jest.fn((opts: any, cb: any) => {
      api.lastOpts = opts;
      cb && cb();
      return socket;
    }),
    lastOpts: null,
    __socket: socket,
  };
  return { ...api, default: api };
});

jest.mock('../src/services/SettingsService', () => {
  const actual = jest.requireActual('../src/services/SettingsService');
  return {
    ...actual,
    settingsService: {
      ...actual.settingsService,
      getSetting: jest.fn((key: string, defaultVal: any) => defaultVal),
    },
  };
});

describe('IRCService connectivity & basic flow', () => {
  let irc: IRCService;
  let socket: FakeSocket;

  const connectConfig: IRCConnectionConfig = {
    host: 'irc.test',
    port: 6667,
    tls: false,
    nick: 'tester',
    realname: 'Tester',
    username: 'tester',
    networkId: 'TestNet',
    servers: [{ id: 'srv', hostname: 'irc.test', port: 6667, ssl: false }],
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    irc = new IRCService();
    socket = new FakeSocket();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).config = connectConfig;
    (irc as any).networkId = 'TestNet';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses default marketing text for part/quit when none provided', () => {
    irc.partChannel('#chan');
    irc.disconnect();
    irc.sendMessage('#chan', '/quit');

    expect(socket.writes.some(w => w.includes(`PART #chan :${DEFAULT_PART_MESSAGE}`))).toBe(true);
    expect(socket.writes.some(w => w.includes(`QUIT :${DEFAULT_QUIT_MESSAGE}`))).toBe(true);
  });

  it('updates user list on JOIN/PART/QUIT and emits messages with hide flags off', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    // Pretend connected
    (irc as any).networkId = 'TestNet';
    (irc as any).isConnected = true;

    (irc as any).handleIRCMessage(':alice!user@host JOIN #room');
    (irc as any).handleIRCMessage(':bob!user@host JOIN #room');
    (irc as any).handleIRCMessage(':alice!user@host PART #room :bye');
    (irc as any).handleIRCMessage(':bob!user@host QUIT :lost link');

    const part = messages.find(m => m.type === 'part');
    const quit = messages.find(m => m.type === 'quit');

    expect(part?.text).toContain('left #room');
    expect(part?.text).toContain('bye');
    expect(quit?.text).toContain('bob');
  });

  it('handles CAP LS/ACK/NAK negotiation', () => {
    (irc as any).config = { ...connectConfig, sasl: { account: 'acc', password: 'pw' } };
    (irc as any).capNegotiating = true;
    (irc as any)._sendRegistration = jest.fn();

    (irc as any).handleCAPCommand(['LS', 'server-time sasl multi-prefix message-tags']);
    expect((irc as any).capAvailable.has('server-time')).toBe(true);
    expect(socket.writes.find(w => w.startsWith('CAP REQ :'))).toBeTruthy();

    (irc as any).handleCAPCommand(['ACK', 'server-time sasl']);
    jest.runAllTimers();
    expect((irc as any).capEnabledSet.has('sasl')).toBe(true);
    expect(socket.writes.find(w => w.startsWith('AUTHENTICATE PLAIN'))).toBeTruthy();

    // Once SASL auth begins, a subsequent ACK without SASL should end CAP
    (irc as any).capNegotiating = true;
    (irc as any).saslAuthenticating = true;
    (irc as any).handleCAPCommand(['ACK', 'multi-prefix']);
    jest.runAllTimers();
    expect(socket.writes.find(w => w.startsWith('CAP END'))).toBeTruthy();
    expect((irc as any)._sendRegistration).toHaveBeenCalled();
  });

  it('parses IRCv3 server-time tags on messages', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));
    (irc as any).serverTime = true;
    (irc as any).currentNick = 'tester';
    const timestampIso = '2024-01-02T03:04:05.678Z';

    (irc as any).handleIRCMessage(`@time=${timestampIso} :alice!user@host PRIVMSG #room :hello world`);

    const msg = messages.find(m => m.type === 'message');
    expect(msg?.text).toBe('hello world');
    expect(msg?.timestamp).toBe(new Date(timestampIso).getTime());
  });
});
