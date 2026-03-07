/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

class MockSocket {
  public writes: string[] = [];
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, cb: Function) {
    const arr = this.listeners.get(event) || [];
    arr.push(cb);
    this.listeners.set(event, arr);
    return this;
  }

  once(event: string, cb: Function) {
    const wrapper = (...args: any[]) => {
      this.removeListener(event, wrapper);
      cb(...args);
    };
    return this.on(event, wrapper);
  }

  removeListener(event: string, cb: Function) {
    const arr = this.listeners.get(event) || [];
    this.listeners.set(
      event,
      arr.filter(item => item !== cb),
    );
    return this;
  }

  removeAllListeners() {
    this.listeners.clear();
  }

  write(data: string | Buffer) {
    this.writes.push(String(data));
  }

  end() {}

  destroy() {}

  emit(event: string, ...args: any[]) {
    const arr = [...(this.listeners.get(event) || [])];
    arr.forEach(cb => cb(...args));
  }
}

const mockCreateConnection = jest.fn();
const mockConnectTLS = jest.fn();
const mockTLSSocketCtor = jest.fn();
const mockCheckConnection = jest.fn();

jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: {
    createConnection: (...args: any[]) => mockCreateConnection(...args),
    connectTLS: (...args: any[]) => mockConnectTLS(...args),
  },
  TLSSocket: function (...args: any[]) {
    return mockTLSSocketCtor(...args);
  },
}));

jest.mock('../src/services/STSService', () => ({
  stsService: {
    checkConnection: (...args: any[]) => mockCheckConnection(...args),
  },
}));

import { IRCService } from '../src/services/IRCService';
import { settingsService } from '../src/services/SettingsService';
import { protectionService } from '../src/services/ProtectionService';

describe('IRCService low-level branches', () => {
  let irc: IRCService;
  let socket: MockSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    socket = new MockSocket();
    irc = new IRCService();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).registered = true;
    (irc as any).currentNick = 'tester';
    (irc as any).config = { host: 'irc.example', port: 6667, nick: 'tester', username: 'tester', realname: 'Tester' };
    mockCheckConnection.mockReturnValue({
      shouldUpgrade: false,
      tlsRequired: false,
      targetPort: 6667,
      targetHost: 'irc.example',
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('extracts masks from notice variants', () => {
    expect((irc as any).extractMaskFromNotice('*** Client connecting: alice!user@example.org')).toEqual({
      nick: 'alice',
      username: 'user',
      hostname: 'example.org',
    });
    expect((irc as any).extractMaskFromNotice('Client connecting: bob (ident@host.test)')).toEqual({
      nick: 'bob',
      username: 'ident',
      hostname: 'host.test',
    });
    expect((irc as any).extractMaskFromNotice('noop')).toBeNull();
  });

  it('runs blacklist actions and command template replacements', async () => {
    const ignoreUser = jest.fn(() => Promise.resolve());
    const resolveBlacklistMask = jest.fn(() => '*!*@*');
    (irc as any)._userManagementService = {
      ignoreUser,
      resolveBlacklistMask,
      isUserIgnored: jest.fn(() => false),
    };
    const sendCommandSpy = jest.spyOn(irc, 'sendCommand');

    const ctx = { nick: 'alice', username: 'u', hostname: 'h.example', channel: '#chan', network: 'net1' };
    (irc as any).runBlacklistAction({ action: 'ignore', reason: 'r1', duration: '60' }, ctx);
    (irc as any).runBlacklistAction({ action: 'ban', reason: 'r2' }, ctx);
    (irc as any).runBlacklistAction({ action: 'kick_ban', reason: 'r3' }, ctx);
    (irc as any).runBlacklistAction({ action: 'kill', reason: 'r4' }, ctx);
    (irc as any).runBlacklistAction({ action: 'os_kill', reason: 'r5' }, ctx);
    (irc as any).runBlacklistAction({ action: 'akill', reason: 'r6', duration: '90' }, ctx);
    (irc as any).runBlacklistAction({ action: 'gline', reason: 'r7', duration: '120' }, ctx);
    (irc as any).runBlacklistAction({ action: 'shun', reason: 'r8', duration: '20' }, ctx);
    (irc as any).runBlacklistAction({ action: 'custom', commandTemplate: '/MODE {channel} +b {mask}' }, ctx);
    (irc as any).runBlacklistAction(
      { action: 'akill', commandTemplate: '/PRIVMSG OperServ :AKILL ADD +{duration} {usermask} {reason}', duration: '120', reason: 'templ' },
      ctx,
    );
    (irc as any).runBlacklistAction({ action: 'ban', reason: 'skip' }, { ...ctx, channel: 'not-channel' });
    (irc as any).runBlacklistAction({ action: 'ignore' }, { ...ctx, nick: 'tester' });

    expect(ignoreUser).toHaveBeenCalled();
    expect(resolveBlacklistMask).toHaveBeenCalled();
    expect(sendCommandSpy).toHaveBeenCalled();
  });

  it('pings and destroys stale socket via keepalive', () => {
    const sendRawSpy = jest.spyOn(irc, 'sendRaw');
    const destroySpy = jest.spyOn(socket, 'destroy');

    (irc as any).startKeepAlive();
    (irc as any).lastInboundActivityAt = Date.now() - 500000;
    jest.advanceTimersByTime(180001);

    expect(sendRawSpy).toHaveBeenCalled();
    expect(destroySpy).toHaveBeenCalled();
    (irc as any).stopKeepAlive();
  });

  it('reads from socket until predicate and times out', async () => {
    const promise = (irc as any).readFromSocketUntil(socket, (buf: Buffer) => buf.includes(Buffer.from('OK')), 1000);
    socket.emit('data', Buffer.from('HELLO '));
    socket.emit('data', Buffer.from('OK'));
    await expect(promise).resolves.toBeInstanceOf(Buffer);

    const timeoutPromise = (irc as any).readFromSocketUntil(socket, () => false, 5);
    jest.advanceTimersByTime(10);
    await expect(timeoutPromise).rejects.toThrow('Proxy read timeout');
  });

  it('establishes and rejects HTTP proxy tunnels', async () => {
    (irc as any).socket = socket;
    const readSpy = jest.spyOn(irc as any, 'readFromSocketUntil');
    readSpy.mockResolvedValueOnce(Buffer.from('HTTP/1.1 200 Connection established\r\n\r\n'));
    await expect(
      (irc as any).establishHttpTunnel({ type: 'http', host: '127.0.0.1', port: 8080 }, { host: 'irc.example', port: 6697 }),
    ).resolves.toBeUndefined();

    readSpy.mockResolvedValueOnce(Buffer.from('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n'));
    await expect(
      (irc as any).establishHttpTunnel({ type: 'http', host: '127.0.0.1', port: 8080 }, { host: 'irc.example', port: 6697 }),
    ).rejects.toThrow('HTTP proxy CONNECT failed');
  });

  it('establishes SOCKS5 tunnel and handles invalid responses', async () => {
    (irc as any).socket = socket;
    const readSpy = jest.spyOn(irc as any, 'readFromSocketUntil');
    readSpy
      .mockResolvedValueOnce(Buffer.from([0x05, 0x00]))
      .mockResolvedValueOnce(Buffer.from([0x05, 0x00, 0x00, 0x03, 0x03, 0x61, 0x62, 0x63, 0x1a, 0x2b]));
    await expect(
      (irc as any).establishSocks5Tunnel({ type: 'socks5', host: '127.0.0.1', port: 9050 }, { host: 'irc.example', port: 6697 }),
    ).resolves.toBeUndefined();

    readSpy.mockReset();
    readSpy.mockResolvedValueOnce(Buffer.from([0x04, 0x00]));
    await expect(
      (irc as any).establishSocks5Tunnel({ type: 'socks5', host: '127.0.0.1', port: 9050 }, { host: 'irc.example', port: 6697 }),
    ).rejects.toThrow('invalid version');
  });

  it('processes buffer with normal and empty lines', () => {
    const handleSpy = jest.spyOn(irc as any, 'handleIRCMessage');
    const wireSpy = jest.spyOn(irc as any, 'addWireMessage');
    (irc as any).buffer = 'PING :a\r\n\r\nNOTICE x :y\r\npartial';
    (irc as any).processBuffer();
    expect(handleSpy).toHaveBeenCalledTimes(2);
    expect(wireSpy).toHaveBeenCalled();
    expect((irc as any).buffer).toBe('partial');
  });

  it('handles low-level IRC parsing branches', () => {
    const numericSpy = jest.spyOn(irc as any, 'handleNumericReply');
    const labeledSpy = jest.spyOn(irc as any, 'handleLabeledResponse');
    (irc as any).serverTime = true;
    (irc as any).seenMessageIds = new Set(['dup-1']);

    (irc as any).handleIRCMessage('@msgid=dup-1 :a!u@h PRIVMSG #c :one');
    (irc as any).handleIRCMessage(':s PING :abc');
    expect(socket.writes.some(w => w.includes('PONG :abc'))).toBe(true);

    (irc as any).keepAliveMissedPongs = 2;
    (irc as any).handleIRCMessage(':s PONG :abc');
    expect((irc as any).keepAliveMissedPongs).toBe(0);

    (irc as any).handleIRCMessage(':s 005 tester CHANTYPES=# :supported');
    expect(numericSpy).toHaveBeenCalled();

    (irc as any).handleIRCMessage('@label=l1 :s NOTICE tester :hi');
    expect(labeledSpy).toHaveBeenCalled();
  });

  it('drives CAP and SASL helper branches', async () => {
    const sendRawSpy = jest.spyOn(irc, 'sendRaw');
    (irc as any).capAvailable = new Set(['server-time', 'sasl', 'typing']);
    (irc as any).config = { sasl: { account: 'acc', password: 'pass' } };
    (irc as any).requestCapabilities();
    expect(sendRawSpy).toHaveBeenCalledWith(expect.stringContaining('CAP REQ'));

    (irc as any).capAvailable = new Set();
    (irc as any).capNegotiating = true;
    (irc as any)._sendRegistration = jest.fn();
    (irc as any).requestCapabilities();
    expect(sendRawSpy).toHaveBeenCalledWith('CAP END');

    (irc as any).capEnabledSet = new Set(['sasl']);
    (irc as any).config = { sasl: { account: 'acc', password: 'p' } };
    await (irc as any).startSASL();
    expect(sendRawSpy).toHaveBeenCalledWith('AUTHENTICATE PLAIN');

    (irc as any).saslAuthenticating = true;
    (irc as any).sendSASLCredentials();
    expect(sendRawSpy).toHaveBeenCalledWith(expect.stringContaining('AUTHENTICATE '));

    (irc as any).scramAuthService = {
      processServerFirst: jest.fn(() => ({ success: false, error: 'bad' })),
      buildClientFinal: jest.fn(),
      verifyServerFinal: jest.fn(() => ({ success: true })),
    };
    (irc as any).saslAuthenticating = true;
    (irc as any).config = { sasl: { account: 'acc', password: 'p' } };
    await (irc as any).handleScramServerFirst('bad');
    (irc as any).handleScramServerFinal('ok');
  });

  it('handles server errors and KILL disconnect path', () => {
    const emitConnSpy = jest.spyOn(irc as any, 'emitConnection');
    const destroySpy = jest.spyOn(socket, 'destroy');
    (irc as any).socket = socket;
    (irc as any).isConnected = true;

    (irc as any).handleServerError('You are KILLed');
    expect(destroySpy).toHaveBeenCalled();
    expect(emitConnSpy).toHaveBeenCalledWith(false);

    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).disconnect = jest.fn();
    (irc as any).handleServerError('Generic error');
    expect((irc as any).disconnect).toHaveBeenCalled();

    (irc as any).socket = socket;
    (irc as any).handleKillDisconnect('reason');
    expect(emitConnSpy).toHaveBeenCalledWith(false);
  });

  it('covers parsing and role/count helpers', () => {
    expect((irc as any).parseSTSPolicyValue('duration=100,port=6697')).toEqual({ duration: '100', port: '6697' });
    expect((irc as any).extractNick('alice!u@h')).toBe('alice');
    expect((irc as any).extractNick('alice')).toBe('alice');
    expect((irc as any).parseUserWithPrefixes('@%alice')).toEqual({
      nick: 'alice',
      modes: ['o', 'h'],
      account: undefined,
      host: undefined,
      ident: undefined,
    });

    (irc as any).userhostInNames = true;
    expect((irc as any).parseUserWithPrefixes('+bob!ident@host')).toEqual({
      nick: 'bob',
      modes: ['v'],
      account: undefined,
      host: 'host',
      ident: 'ident',
    });

    expect((irc as any).buildRoleLine('op', 2, 10)).toContain('(20.0%)');
    (irc as any).channelUsers.set('#x', new Map([
      ['a', { nick: 'a', modes: ['o'] }],
      ['b', { nick: 'b', modes: ['v'] }],
    ]));
    const counts = (irc as any).getChannelUserCounts('#x');
    expect(counts.total).toBe(2);
    expect(counts.ops).toBe(1);
    expect(counts.voice).toBe(1);
  });

  it('covers protection block actions and anti-deop mode restore', async () => {
    (irc as any)._userManagementService = {
      isUserIgnored: jest.fn(() => false),
      ignoreUser: jest.fn(() => Promise.resolve()),
      resolveBlacklistMask: jest.fn(() => '*!*@host'),
    };
    jest.spyOn(protectionService, 'getActionConfig').mockReturnValue({
      protEnforceSilence: true,
      protIrcopAction: 'kline',
      protIrcopReason: 'Reason',
      protIrcopDuration: '3600',
    } as any);
    (irc as any).selfUserModes = new Set(['o']);
    const sendCommandSpy = jest.spyOn(irc, 'sendCommand');
    const sendRawSpy = jest.spyOn(irc, 'sendRaw');
    (irc as any).handleProtectionBlock('flood', 'alice', 'u', 'h.example', '#chan');
    expect(sendRawSpy).toHaveBeenCalledWith(expect.stringContaining('SILENCE +'));
    expect(sendCommandSpy).toHaveBeenCalledWith(expect.stringContaining('KLINE'));

    jest.spyOn(protectionService, 'getAntiDeopConfig').mockReturnValue({
      protAntiDeopEnabled: true,
      protAntiDeopUseChanserv: true,
    } as any);
    (irc as any).channelUsers.set('#chan', new Map([['tester', { nick: 'tester', modes: ['o'] }]]));
    (irc as any).handleChannelModeChange('#chan', ['-o', 'tester']);
    expect(sendRawSpy).toHaveBeenCalledWith('PRIVMSG ChanServ :OP #chan tester');
  });

  it('covers connect plain/tls branches and timeout behavior', async () => {
    const plainSocket = new MockSocket();
    mockCreateConnection.mockImplementation((opts: any, cb: Function) => {
      cb();
      setTimeout(() => plainSocket.emit('connect'), 0);
      return plainSocket;
    });

    const connectPromise = irc.connect({
      host: 'irc.example',
      port: 6667,
      nick: 'tester',
      username: 'tester',
      realname: 'Tester',
      tls: false,
    });
    jest.advanceTimersByTime(1);
    await expect(connectPromise).resolves.toBeUndefined();
    plainSocket.emit('timeout');
    plainSocket.emit('close');

    const tlsSocket = new MockSocket();
    mockConnectTLS.mockImplementation((opts: any, cb: Function) => {
      cb();
      setTimeout(() => tlsSocket.emit('connect'), 0);
      return tlsSocket;
    });
    const tlsPromise = irc.connect({
      host: 'irc.example',
      port: 6697,
      nick: 'tester',
      username: 'tester',
      realname: 'Tester',
      tls: true,
    });
    jest.advanceTimersByTime(1);
    await expect(tlsPromise).resolves.toBeUndefined();
    tlsSocket.emit('error', { message: 'oops', code: 'EPIPE' });
  });

  it('covers getBatchLabelManager real initializer and wrappers', () => {
    const sendRawSpy = jest.spyOn(irc, 'sendRaw');
    (irc as any).capEnabledSet.add('labeled-response');
    const label = irc.sendRawWithLabel('PING :a');
    expect(typeof label).toBe('string');
    (irc as any).handleLabeledResponse(label, { ok: true });
    (irc as any).cleanupLabels();
    expect(sendRawSpy).toHaveBeenCalled();
  });

  it('covers single-line multiline branch and command fallback', () => {
    const sendRawSpy = jest.spyOn(irc, 'sendRaw');
    (irc as any).capEnabledSet.add('draft/multiline');
    irc.sendMultilineMessage('#room', 'single line');
    expect(sendRawSpy).toHaveBeenCalledWith('PRIVMSG #room :single line');

    (irc as any).sendMessageHandlers = { handle: jest.fn(() => false) };
    const sendCommandSpy = jest.spyOn(irc, 'sendCommand');
    irc.sendMessage('#room', '/UNKNOWN arg');
    expect(sendCommandSpy).toHaveBeenCalledWith('UNKNOWN arg');
  });

  it('covers message/connection backlog trimming', () => {
    for (let i = 0; i < 130; i++) {
      (irc as any).emitMessage({ id: `${i}`, type: 'raw', text: `x${i}`, timestamp: Date.now() });
    }
    expect((irc as any).pendingMessages.length).toBe(100);

    for (let i = 0; i < 30; i++) {
      (irc as any).emitConnection(Boolean(i % 2));
    }
    expect((irc as any).pendingConnectionStates.length).toBe(20);
  });

  it('uses ctcp handler context getter for ctcp version setting', async () => {
    jest.spyOn(settingsService, 'getSetting').mockResolvedValue('Custom CTCP');
    await (irc as any).handleCTCPRequest('alice', 'tester', 'VERSION');
    expect(settingsService.getSetting).toHaveBeenCalled();
  });

  it('covers parseServerCommand management and full option parsing', () => {
    const management = (irc as any).parseServerCommand(['-sar', 'irc.example', '-d', 'Desc', '-p', '6697', '-g', 'grp', '-w', 'pass']);
    expect(management.management.sort).toBe(true);
    expect(management.management.add).toBe(true);
    expect(management.management.remove).toBe(true);
    expect(management.managementOptions.description).toBe('Desc');
    expect(management.managementOptions.port).toBe(6697);
    expect(management.managementOptions.group).toBe('grp');
    expect(management.managementOptions.password).toBe('pass');
    expect(management.address).toBe('irc.example');

    const parsed = (irc as any).parseServerCommand([
      '-emt',
      '2',
      '*7000',
      'serverpass',
      '-l',
      'SCRAM',
      'saslpass',
      '-lname',
      'acc',
      '-i',
      'nick',
      'altnick',
      'mail@example.com',
      'Real Name',
      '-jn',
      '#chan',
      'key123',
      '-j',
      '#plain',
      'ignored-extra',
    ]);
    expect(parsed.switches.ssl).toBe(true);
    expect(parsed.switches.newWindow).toBe(true);
    expect(parsed.switches.starttls).toBe(true);
    expect(parsed.serverIndex).toBe(2);
    expect(parsed.port).toBe(7000);
    expect(parsed.password).toBe('serverpass');
    expect(parsed.login.method).toBe('SCRAM');
    expect(parsed.login.password).toBe('saslpass');
    expect(parsed.login.username).toBe('acc');
    expect(parsed.identity.nick).toBe('nick');
    expect(parsed.identity.altNick).toBe('altnick');
    expect(parsed.identity.email).toBe('mail@example.com');
    expect(parsed.identity.name).toBe('Real Name');
    expect(parsed.joinChannels).toEqual([
      { channel: '#chan', password: 'key123' },
      { channel: '#plain', password: 'ignored-extra' },
    ]);
  });

  it('covers sendRaw write failure and silent who/mode failure cleanup', () => {
    const logSpy = jest.spyOn(irc as any, 'logRaw');
    const throwSocket = {
      write: jest.fn(() => {
        throw new Error('write failed');
      }),
      removeAllListeners: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
    };
    (irc as any).socket = throwSocket;

    irc.sendRaw('PRIVMSG #x :y');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unable to send message'));
    expect(irc.getConnectionStatus()).toBe(false);

    (irc as any).isConnected = true;
    const cb = jest.fn();
    irc.sendSilentWho('Alice', cb);
    expect((irc as any).silentWhoNicks.has('alice')).toBe(false);
    expect((irc as any).silentWhoCallbacks.has('alice')).toBe(false);

    irc.sendSilentMode('Bob');
    expect((irc as any).silentModeNicks.has('bob')).toBe(false);
  });

  it('covers detectClones empty and clone grouping paths', async () => {
    await expect(irc.detectClones('#missing')).resolves.toEqual(new Map());

    (irc as any).channelUsers.set(
      '#c',
      new Map([
        ['a', { nick: 'a', modes: [], host: 'h1' }],
        ['b', { nick: 'b', modes: [], host: 'h1' }],
        ['c', { nick: 'c', modes: [], host: 'h2' }],
      ]),
    );
    (irc as any).cloneDetectionBatchSize = 100;
    const clones = await irc.detectClones('#c');
    expect(clones.get('h1')).toEqual(['a', 'b']);
    expect(clones.has('h2')).toBe(false);
  });

  it('covers clone status and auto reconnect toggles', () => {
    (irc as any).cloneDetectionActive = true;
    expect(irc.isCloneDetectionActive()).toBe(true);

    const clearSpy = jest.spyOn(global, 'clearTimeout');
    (irc as any).reconnectTimer = setTimeout(() => {}, 1000);
    (irc as any).reconnectAttempts = 3;
    irc.setAutoReconnect(false);
    expect(irc.isAutoReconnectEnabled()).toBe(false);
    expect((irc as any).reconnectAttempts).toBe(0);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('covers requestChannelUsers and channel/user service accessors', () => {
    const sendRawSpy = jest.spyOn(irc, 'sendRaw');
    irc.requestChannelUsers('#room');
    expect(sendRawSpy).toHaveBeenCalledWith('NAMES #room');

    (irc as any).isConnected = false;
    irc.requestChannelUsers('#room');
    expect(sendRawSpy).toHaveBeenCalledTimes(1);

    expect(irc.getChannels()).toEqual(expect.any(Array));
    irc.setNetworkId('Net42');
    expect(irc.getNetworkName()).toBe('Net42');
    irc.setWhoisUseDoubleNick(true);
    expect(irc.getWhoisUseDoubleNick()).toBe(true);

    const mockSvc = { setIRCService: jest.fn() } as any;
    irc.setNotifyService(mockSvc);
    expect(mockSvc.setIRCService).toHaveBeenCalledWith(irc);
    expect(irc.getNotifyService()).toBe(mockSvc);
  });

  it('covers getLocalAddress variants and disconnect destroy error', () => {
    (irc as any).socket = { localAddress: '10.0.0.5' };
    expect(irc.getLocalAddress()).toBe('10.0.0.5');

    (irc as any).socket = { address: () => ({ address: '127.0.0.1' }) };
    expect(irc.getLocalAddress()).toBe('127.0.0.1');

    (irc as any).socket = {
      address: () => {
        throw new Error('no address');
      },
    };
    expect(irc.getLocalAddress()).toBeUndefined();

    const logSpy = jest.spyOn(irc as any, 'logRaw');
    const badSocket = {
      write: jest.fn(),
      removeAllListeners: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(() => {
        throw new Error('destroy failed');
      }),
    };
    (irc as any).socket = badSocket;
    (irc as any).isConnected = true;
    irc.disconnect('bye');
    jest.advanceTimersByTime(120);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Socket destroy error'));
  });
});
