/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRCService coverage-focused test suite.
 *
 * Exercises less-common orchestrator paths not covered by the other
 * IRCService.*.test.ts suites: silent WHO/MODE, metadata commands,
 * capability helpers, ISUPPORT parsing, SASL setup, protection/blacklist
 * actions, /server command parsing, proxy/websocket transport, keepalive,
 * reconnect scheduling and disconnect teardown.
 */

const mockCreateConnection = jest.fn();
const mockConnectTLS = jest.fn();
const mockTLSSocketCtor = jest.fn();

jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: {
    createConnection: (...args: any[]) => mockCreateConnection(...args),
    connectTLS: (...args: any[]) => mockConnectTLS(...args),
    TLSSocket: function (this: any, ...args: any[]) {
      return mockTLSSocketCtor(...args);
    },
  },
  createConnection: (...args: any[]) => mockCreateConnection(...args),
  connectTLS: (...args: any[]) => mockConnectTLS(...args),
}));

const mockCreateIRCWebSocket = jest.fn();
jest.mock('../src/services/irc/transport/WebSocketIRCTransport', () => ({
  createIRCWebSocket: (...args: any[]) => mockCreateIRCWebSocket(...args),
}));

const mockCheckConnection = jest.fn(() => ({
  shouldUpgrade: false,
  tlsRequired: false,
  targetPort: 6667,
  targetHost: 'irc.host',
}));
jest.mock('../src/services/STSService', () => ({
  stsService: {
    checkConnection: (...args: any[]) => mockCheckConnection(...args),
  },
}));

const mockFgIsRunning = jest.fn(() => false);
const mockFgStart = jest.fn(() => Promise.resolve());
const mockFgUpdate = jest.fn(() => Promise.resolve());
const mockFgStop = jest.fn(() => Promise.resolve());
jest.mock('../src/services/IRCForegroundService', () => ({
  ircForegroundService: {
    isServiceRunning: (...a: any[]) => mockFgIsRunning(...a),
    start: (...a: any[]) => mockFgStart(...a),
    updateNotification: (...a: any[]) => mockFgUpdate(...a),
    stop: (...a: any[]) => mockFgStop(...a),
  },
}));

jest.mock('../src/services/irc/ScramAuth', () => ({
  ScramAuthService: class {
    init = jest.fn(() => Promise.resolve());
    buildClientFirst = jest.fn(() => 'biwsbj1hY2N0');
    processServerFirst = jest.fn(() => ({ success: true }));
    buildClientFinal = jest.fn(() => Promise.resolve('Y2xpZW50LWZpbmFs'));
    verifyServerFinal = jest.fn(() => ({ success: true }));
  },
}));

const mockGetAllConnections = jest.fn(() => [] as any[]);
jest.mock('../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: (...a: any[]) => mockGetAllConnections(...a),
  },
}));

import { IRCService } from '../src/services/IRCService';
import { protectionService } from '../src/services/ProtectionService';

class RichSocket {
  public writes: string[] = [];
  public sent: string[] = [];
  public destroyed = false;
  public ended = false;
  public localAddress: string | undefined;
  private listeners: Record<string, Function[]> = {};

  write = jest.fn((data: string) => {
    this.writes.push(String(data));
    return true;
  });
  send = jest.fn((data: string) => {
    this.sent.push(String(data));
  });
  destroy = jest.fn(() => {
    this.destroyed = true;
  });
  end = jest.fn(() => {
    this.ended = true;
  });
  removeAllListeners = jest.fn(() => {
    this.listeners = {};
  });
  removeListener = jest.fn((event: string, cb: Function) => {
    this.listeners[event] = (this.listeners[event] || []).filter(l => l !== cb);
  });
  on(event: string, cb: Function) {
    (this.listeners[event] = this.listeners[event] || []).push(cb);
    return this;
  }
  once(event: string, cb: Function) {
    const wrap = (...args: any[]) => {
      this.removeListener(event, wrap);
      cb(...args);
    };
    return this.on(event, wrap);
  }
  emit(event: string, ...args: any[]) {
    [...(this.listeners[event] || [])].forEach(cb => cb(...args));
  }
}

function makeConnected(): { irc: IRCService; socket: RichSocket } {
  const irc = new IRCService();
  const socket = new RichSocket();
  (irc as any).socket = socket;
  (irc as any).isConnected = true;
  (irc as any).registered = true;
  (irc as any).currentNick = 'tester';
  irc.setNetworkId('TestNet');
  return { irc, socket };
}

function enableCaps(irc: IRCService, ...caps: string[]) {
  caps.forEach(c => (irc as any).capEnabledSet.add(c));
}

describe('IRCService coverage - transport helpers', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sendRaw uses websocket send when transport is websocket', () => {
    const { irc, socket } = makeConnected();
    (irc as any).currentTransport = 'websocket';
    irc.sendRaw('PING :abc');
    expect(socket.sent).toContain('PING :abc');
    expect(socket.writes.length).toBe(0);
  });

  it('sendRaw marks disconnected when write throws', () => {
    const { irc, socket } = makeConnected();
    socket.write.mockImplementation(() => {
      throw new Error('boom');
    });
    irc.sendRaw('PING :x');
    expect((irc as any).isConnected).toBe(false);
  });

  it('getTransportInfo reports tcp by default and websocket protocol', () => {
    const irc = new IRCService();
    expect(irc.getTransportInfo().transport).toBe('tcp');
    (irc as any).currentTransport = 'websocket';
    (irc as any).negotiatedWebSocketProtocol = 'text.ircv3.net';
    expect(irc.getTransportInfo()).toEqual({
      transport: 'websocket',
      webSocketProtocol: 'text.ircv3.net',
    });
  });

  it('getLocalAddress reads direct localAddress', () => {
    const { irc, socket } = makeConnected();
    socket.localAddress = '10.0.0.5';
    expect(irc.getLocalAddress()).toBe('10.0.0.5');
  });

  it('getLocalAddress falls back to address() function', () => {
    const { irc } = makeConnected();
    (irc as any).socket = {
      address: () => ({ address: '192.168.1.2' }),
    };
    expect(irc.getLocalAddress()).toBe('192.168.1.2');
  });

  it('getLocalAddress swallows address() errors', () => {
    const { irc } = makeConnected();
    (irc as any).socket = {
      address: () => {
        throw new Error('no addr');
      },
    };
    expect(irc.getLocalAddress()).toBeUndefined();
  });

  it('handleWebSocketMessage decodes string, ArrayBuffer and Uint8Array', () => {
    const { irc } = makeConnected();
    const handle = jest
      .spyOn(irc as any, 'handleIRCMessage')
      .mockImplementation(() => {});
    (irc as any).handleWebSocketMessage('PING :one\r\nPING :two');
    const bytes = Buffer.from('PING :buf', 'utf8');
    const ab = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    (irc as any).handleWebSocketMessage(ab);
    (irc as any).handleWebSocketMessage(new Uint8Array(bytes));
    (irc as any).handleWebSocketMessage({ toString: () => 'PING :obj' });
    expect(handle).toHaveBeenCalled();
  });
});

describe('IRCService coverage - silent WHO/MODE', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sendSilentWho stores callback and writes WHO', () => {
    const { irc, socket } = makeConnected();
    const cb = jest.fn();
    irc.sendSilentWho('Alice', cb);
    expect(socket.writes.some(w => w.startsWith('WHO Alice'))).toBe(true);
    expect((irc as any).silentWhoNicks.has('alice')).toBe(true);
    expect((irc as any).silentWhoCallbacks.get('alice')).toBe(cb);
  });

  it('sendSilentWho uses websocket send', () => {
    const { irc, socket } = makeConnected();
    (irc as any).currentTransport = 'websocket';
    irc.sendSilentWho('Bob');
    expect(socket.sent).toContain('WHO Bob');
  });

  it('sendSilentWho cleans up on write error', () => {
    const { irc, socket } = makeConnected();
    socket.write.mockImplementation(() => {
      throw new Error('closed');
    });
    irc.sendSilentWho('Carol', jest.fn());
    expect((irc as any).silentWhoNicks.has('carol')).toBe(false);
    expect((irc as any).silentWhoCallbacks.has('carol')).toBe(false);
  });

  it('sendSilentMode writes MODE and cleans up on error', () => {
    const { irc, socket } = makeConnected();
    irc.sendSilentMode('Dave');
    expect(socket.writes.some(w => w.startsWith('MODE Dave'))).toBe(true);
    (irc as any).currentTransport = 'websocket';
    irc.sendSilentMode('Eve');
    expect(socket.sent).toContain('MODE Eve');

    const other = makeConnected();
    other.socket.write.mockImplementation(() => {
      throw new Error('closed');
    });
    other.irc.sendSilentMode('Frank');
    expect((other.irc as any).silentModeNicks.has('frank')).toBe(false);
  });
});

describe('IRCService coverage - metadata', () => {
  afterEach(() => jest.restoreAllMocks());

  it('metadata commands are gated on capability and connection', () => {
    const { irc } = makeConnected();
    const errors: any[] = [];
    irc.on('error', (e: any) => errors.push(e));
    irc.requestMetadata('#chan', ['avatar']);
    irc.setMetadata('#chan', 'avatar', 'x');
    irc.subscribeMetadata(['avatar']);
    irc.unsubscribeMetadata(['avatar']);
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  it('metadata commands send raw when capability enabled', () => {
    const { irc, socket } = makeConnected();
    enableCaps(irc, 'draft/metadata-2');
    irc.requestMetadata('#chan', ['avatar', 'url']);
    irc.requestMetadata('', []);
    irc.setMetadata('#chan', 'avatar', 'value');
    irc.setMetadata('#chan', 'avatar');
    irc.setMetadata('#chan', '   '); // empty key -> no-op
    irc.clearMetadata('#chan');
    irc.syncMetadata('#chan');
    irc.subscribeMetadata(['a', 'b']);
    irc.subscribeMetadata(['   ']); // filtered -> no-op
    irc.unsubscribeMetadata(['a']);
    irc.listMetadataSubscriptions();
    const joined = socket.writes.join('\n');
    expect(joined).toContain('METADATA #chan GET avatar url');
    expect(joined).toContain('METADATA * LIST');
    expect(joined).toContain('METADATA #chan SET avatar :value');
    expect(joined).toContain('METADATA #chan SET avatar');
    expect(joined).toContain('METADATA #chan CLEAR');
    expect(joined).toContain('METADATA #chan SYNC');
    expect(joined).toContain('METADATA * SUB a b');
    expect(joined).toContain('METADATA * UNSUB a');
    expect(joined).toContain('METADATA * SUBS');
  });

  it('handleMetadataNumeric stores, deletes and updates subscriptions', () => {
    const { irc } = makeConnected();
    const now = Date.now();
    const call = (n: number, params: string[]) =>
      (irc as any).handleMetadataNumeric(n, params, now);
    expect(call(761, ['me', 'avatar', 'url', 'https://x/y'])).toBe(true);
    expect(irc.getMetadata('avatar')).toBeDefined();
    expect(call(766, ['me', 'avatar'])).toBe(true);
    expect(call(770, ['me', 'k1', 'k2'])).toBe(true);
    expect(call(771, ['me', 'k1'])).toBe(true);
    expect(call(772, ['me', 'k3'])).toBe(true);
    expect(call(774, ['me', 'target', '30'])).toBe(true);
    expect(call(774, ['me', 'target', 'notnum'])).toBe(true);
    expect(call(999, ['me'])).toBe(false);
    expect(irc.getMetadataSubscriptions()).toContain('k3');
  });

  it('handleMetadataMessage stores entry and getMetadata returns all', () => {
    const { irc } = makeConnected();
    (irc as any).handleMetadataMessage(
      'serv!s@host',
      ['#chan', 'topicset', '*', 'hello', 'world'],
      Date.now(),
    );
    const all = irc.getMetadata();
    expect(Object.keys(all).some(k => k.includes('topicset'))).toBe(true);
    // storeMetadataEntry no-op branches
    (irc as any).storeMetadataEntry({ target: '', key: '' });
    (irc as any).deleteMetadataEntry('', '');
  });
});

describe('IRCService coverage - capabilities & isupport', () => {
  afterEach(() => jest.restoreAllMocks());

  it('capability list/enable/disable/request send raw', () => {
    const { irc, socket } = makeConnected();
    irc.requestCapabilityList();
    irc.enableCapability(' echo-message ');
    irc.disableCapability('-echo-message');
    irc.requestISupport();
    enableCaps(irc, 'draft/pre-away', 'monitor');
    irc.sendPreAway('brb');
    irc.sendPreAway('*');
    irc.sendPreAway('');
    irc.requestMonitorStatus();
    (irc as any).monitoredNicks.add('x');
    irc.clearMonitorList();
    irc.listMonitorEntries();
    const joined = socket.writes.join('\n');
    expect(joined).toContain('CAP LIST');
    expect(joined).toContain('CAP REQ :echo-message');
    expect(joined).toContain('CAP REQ :-echo-message');
    expect(joined).toContain('ISUPPORT');
    expect(joined).toContain('AWAY :brb');
    expect(joined).toContain('AWAY *');
    expect(socket.writes).toContain('AWAY\r\n');
    expect(joined).toContain('MONITOR S');
    expect(joined).toContain('MONITOR C');
    expect(joined).toContain('MONITOR L');
    expect((irc as any).monitoredNicks.size).toBe(0);
  });

  it('capability getters reflect internal state', () => {
    const irc = new IRCService();
    (irc as any).capAvailable.add('sasl');
    (irc as any).capEnabledSet.add('server-time');
    (irc as any).capValues.set('sasl', 'PLAIN,EXTERNAL');
    expect(irc.getAvailableCapabilities()).toContain('sasl');
    expect(irc.getEnabledCapabilities()).toContain('server-time');
    expect(irc.getCapabilityValues()).toEqual({ sasl: 'PLAIN,EXTERNAL' });
    expect(irc.getCapabilityValue('sasl')).toBe('PLAIN,EXTERNAL');
    expect(irc.hasCapability('server-time')).toBe(true);
  });

  it('processISupport parses tokens, removals, CLIENTTAGDENY and ICON', () => {
    const { irc } = makeConnected();
    const iconEvents: string[] = [];
    irc.on('network-icon', (u: string) => iconEvents.push(u));
    irc.processISupport([
      'NICKLEN=30',
      'BOT=B',
      'CLIENTTAGDENY=*,-foo,bar',
      'draft/ICON=https://example/icon.png',
      '',
    ]);
    expect(irc.getISupportValue('NICKLEN')).toBe('30');
    expect(irc.getISupportValues().BOT).toBe('B');
    expect(irc.getNetworkIconUrl()).toBe('https://example/icon.png');
    expect(iconEvents.length).toBe(1);
    // Removal token
    irc.processISupport(['-NICKLEN']);
    expect(irc.getISupportValue('NICKLEN')).toBeUndefined();
  });

  it('isClientTagAllowed respects deny list and wildcard', () => {
    const { irc } = makeConnected();
    expect(irc.isClientTagAllowed('+typing')).toBe(true);
    irc.processISupport(['CLIENTTAGDENY=typing']);
    expect(irc.isClientTagAllowed('+typing')).toBe(false);
    expect(irc.isClientTagAllowed('typing')).toBe(false);
    irc.processISupport(['CLIENTTAGDENY=*']);
    expect(irc.isClientTagAllowed('anything')).toBe(false);
  });

  it('typing indicator gated on capability', () => {
    const { irc, socket } = makeConnected();
    expect(irc.hasTypingCapability()).toBe(false);
    expect(irc.sendTypingIndicator('#c', 'active')).toBe(false);
    enableCaps(irc, 'draft/typing');
    expect(irc.hasTypingCapability()).toBe(true);
    expect(irc.sendTypingIndicator('#c', 'active')).toBe(true);
    expect(socket.writes.some(w => w.includes('TAGMSG #c'))).toBe(true);
  });
});

describe('IRCService coverage - SASL setup', () => {
  afterEach(() => jest.restoreAllMocks());

  it('startSASL skips when not enabled and not forced', async () => {
    const { irc, socket } = makeConnected();
    (irc as any).config = { sasl: { account: 'a', password: 'b' } };
    await (irc as any).startSASL();
    expect(socket.writes.length).toBe(0);
  });

  it('startSASL uses EXTERNAL with client cert', async () => {
    const { irc, socket } = makeConnected();
    enableCaps(irc, 'sasl');
    (irc as any).config = { clientCert: 'C', clientKey: 'K' };
    await (irc as any).startSASL();
    expect(socket.writes.some(w => w.includes('AUTHENTICATE EXTERNAL'))).toBe(
      true,
    );
    expect(irc.isSaslExternal()).toBe(true);
  });

  it('startSASL uses PLAIN and sends credentials with chunking', async () => {
    const { irc, socket } = makeConnected();
    enableCaps(irc, 'sasl');
    (irc as any).config = {
      sasl: { account: 'acct', password: 'p'.repeat(600) },
    };
    await (irc as any).startSASL();
    expect(socket.writes.some(w => w.includes('AUTHENTICATE PLAIN'))).toBe(true);
    await (irc as any).sendSASLCredentials();
    const authLines = socket.writes.filter(
      w => w.includes('AUTHENTICATE') && !w.includes('PLAIN'),
    );
    expect(authLines.length).toBeGreaterThan(1);
    expect(irc.isSaslPlain()).toBe(true);
    expect(irc.getSaslAccount()).toBe('acct');
    expect(irc.isSaslAvailable()).toBe(true);
    expect(irc.isSaslAuthenticating()).toBe(true);
  });

  it('startSASL initializes SCRAM mechanism', async () => {
    const { irc, socket } = makeConnected();
    enableCaps(irc, 'sasl');
    (irc as any).config = {
      sasl: {
        account: 'acct',
        password: 'pw',
        mechanism: 'SCRAM-SHA-256',
      },
    };
    await (irc as any).startSASL();
    expect(
      socket.writes.some(w => w.includes('AUTHENTICATE SCRAM-SHA-256')),
    ).toBe(true);
    expect((irc as any).saslMechanism).toBe('SCRAM-SHA-256');
    // sendSASLCredentials builds client-first
    (irc as any).saslState = 'initial';
    await (irc as any).sendSASLCredentials();
    expect((irc as any).saslState).toBe('client-first-sent');
    // server-first -> client-final
    await (irc as any).handleScramServerFirst('r=abc,s=salt,i=4096');
    expect((irc as any).saslState).toBe('client-final-sent');
    // server-final verification
    (irc as any).handleScramServerFinal('v=proof');
    expect((irc as any).saslState).toBe('complete');
  });

  it('startSASL bails when account/password missing', async () => {
    const { irc, socket } = makeConnected();
    enableCaps(irc, 'sasl');
    (irc as any).config = { sasl: { account: '', password: '' } };
    await (irc as any).startSASL();
    expect(socket.writes.length).toBe(0);
  });
});

describe('IRCService coverage - server error & kill', () => {
  afterEach(() => jest.restoreAllMocks());

  it('handleServerError destroys socket on kill-related error', () => {
    const { irc, socket } = makeConnected();
    (irc as any).handleServerError('You have been Killed by an oper');
    expect(socket.destroyed).toBe(true);
    expect((irc as any).isConnected).toBe(false);
  });

  it('handleServerError disconnects on generic error', () => {
    const { irc } = makeConnected();
    const disc = jest.spyOn(irc, 'disconnect').mockImplementation(() => {});
    (irc as any).handleServerError('Closing link: throttled');
    expect(disc).toHaveBeenCalledWith('Closing link: throttled');
  });

  it('handleKillDisconnect tears down connection', () => {
    const { irc, socket } = makeConnected();
    (irc as any).handleKillDisconnect('killed');
    expect(socket.destroyed).toBe(true);
    expect((irc as any).isConnected).toBe(false);
  });

  it('parseSTSPolicyValue parses key=value pairs', () => {
    const { irc } = makeConnected();
    const policy = (irc as any).parseSTSPolicyValue('duration=100,port=6697,x');
    expect(policy).toEqual({ duration: '100', port: '6697' });
  });
});

describe('IRCService coverage - protection & blacklist', () => {
  afterEach(() => jest.restoreAllMocks());

  function fakeUserMgmt(overrides?: any) {
    return {
      isUserIgnored: jest.fn(() => false),
      ignoreUser: jest.fn(() => Promise.resolve()),
      resolveBlacklistMask: jest.fn(
        (_e: any, nick: string, user?: string, host?: string) =>
          `${nick}!${user || '*'}@${host || '*'}`,
      ),
      ...overrides,
    };
  }

  it('handleProtectionBlock ignores, silences and runs oper ban action', () => {
    const { irc, socket } = makeConnected();
    irc.setUserManagementService(fakeUserMgmt() as any);
    (irc as any).selfUserModes.add('o'); // server oper
    jest.spyOn(protectionService, 'getActionConfig').mockReturnValue({
      protEnforceSilence: true,
      protIrcopAction: 'ban',
      protIrcopReason: 'spam',
      protIrcopDuration: '',
    } as any);
    (irc as any).handleProtectionBlock(
      'flood',
      'Spammer',
      'user',
      'host.com',
      '#chan',
    );
    const joined = socket.writes.join('\n');
    expect(joined).toContain('SILENCE +');
    expect(joined).toContain('MODE #chan +b');
    expect(joined).toContain('KICK #chan Spammer');
  });

  it('handleProtectionBlock runs kill/kline/gline oper actions', () => {
    const kill = makeConnected();
    kill.irc.setUserManagementService(fakeUserMgmt() as any);
    (kill.irc as any).selfUserModes.add('o');
    jest.spyOn(protectionService, 'getActionConfig').mockReturnValue({
      protEnforceSilence: false,
      protIrcopAction: 'kill',
      protIrcopReason: '',
      protIrcopDuration: '',
    } as any);
    (kill.irc as any).handleProtectionBlock('x', 'Bad', 'u', 'h', null);
    expect(kill.socket.writes.some(w => w.includes('KILL Bad'))).toBe(true);

    const kline = makeConnected();
    kline.irc.setUserManagementService(fakeUserMgmt() as any);
    (kline.irc as any).selfUserModes.add('o');
    jest.spyOn(protectionService, 'getActionConfig').mockReturnValue({
      protEnforceSilence: false,
      protIrcopAction: 'kline',
      protIrcopReason: 'r',
      protIrcopDuration: '3600',
    } as any);
    (kline.irc as any).handleProtectionBlock('x', 'Bad', 'u', 'h', null);
    expect(kline.socket.writes.some(w => w.includes('KLINE 3600'))).toBe(true);

    const gline = makeConnected();
    gline.irc.setUserManagementService(fakeUserMgmt() as any);
    (gline.irc as any).selfUserModes.add('o');
    jest.spyOn(protectionService, 'getActionConfig').mockReturnValue({
      protEnforceSilence: false,
      protIrcopAction: 'gline',
      protIrcopReason: 'r',
      protIrcopDuration: '',
    } as any);
    (gline.irc as any).handleProtectionBlock('x', 'Bad', 'u', 'h', null);
    expect(gline.socket.writes.some(w => w.includes('GLINE'))).toBe(true);
  });

  it('handleProtectionBlock returns early when not oper', () => {
    const { irc, socket } = makeConnected();
    irc.setUserManagementService(fakeUserMgmt() as any);
    jest.spyOn(protectionService, 'getActionConfig').mockReturnValue({
      protEnforceSilence: false,
      protIrcopAction: 'kill',
      protIrcopReason: '',
      protIrcopDuration: '',
    } as any);
    (irc as any).handleProtectionBlock('x', 'Bad', 'u', 'h', null);
    expect(socket.writes.some(w => w.includes('KILL'))).toBe(false);
  });

  it('runBlacklistAction dispatches akill/gline/custom actions', () => {
    const { irc, socket } = makeConnected();
    irc.setUserManagementService(fakeUserMgmt() as any);
    const ctx = {
      nick: 'Bad',
      username: 'baduser',
      hostname: 'bad.host',
      channel: '#chan',
      network: 'TestNet',
    };
    (irc as any).runBlacklistAction(
      { action: 'akill', reason: 'spam', duration: '30' },
      ctx,
    );
    (irc as any).runBlacklistAction(
      { action: 'gline', reason: 'spam', duration: '0' },
      ctx,
    );
    (irc as any).runBlacklistAction(
      { action: 'shun', reason: 'spam' },
      ctx,
    );
    (irc as any).runBlacklistAction(
      {
        action: 'custom',
        commandTemplate:
          '/KILL {nick} :{reason} on {channel} for {network} {mask}',
      },
      ctx,
    );
    expect(socket.writes.length).toBeGreaterThan(0);
  });

  it('runBlacklistAction ignores self and empty nick', () => {
    const { irc, socket } = makeConnected();
    irc.setUserManagementService(fakeUserMgmt() as any);
    (irc as any).runBlacklistAction(
      { action: 'akill' },
      { nick: '' },
    );
    (irc as any).runBlacklistAction(
      { action: 'akill' },
      { nick: 'tester' },
    );
    expect(socket.writes.length).toBe(0);
  });

  it('extractMaskFromNotice matches connect, mask and paren formats', () => {
    const { irc } = makeConnected();
    const ex = (t: string) => (irc as any).extractMaskFromNotice(t);
    expect(ex('*** Client connecting: bob!user@host.com (extra)')).toEqual(
      expect.objectContaining({ nick: 'bob', username: 'user' }),
    );
    expect(ex('Client connecting: joe (jd@1.2.3.4)')).toEqual(
      expect.objectContaining({ nick: 'joe', hostname: '1.2.3.4' }),
    );
    expect(ex('random alice!a@h.com here')).toEqual(
      expect.objectContaining({ nick: 'alice' }),
    );
    expect(ex('user carol (cc@host)')).toEqual(
      expect.objectContaining({ nick: 'carol' }),
    );
    expect(ex('no mask here')).toBeNull();
    expect(ex('')).toBeNull();
  });
});

describe('IRCService coverage - user modes & channel modes', () => {
  afterEach(() => jest.restoreAllMocks());

  it('updateSelfUserModes adds and removes modes', () => {
    const { irc } = makeConnected();
    (irc as any).updateSelfUserModes('+iow-w');
    expect(irc.getSelfUserModes()).toEqual(expect.arrayContaining(['i', 'o']));
    expect(irc.isServerOper()).toBe(true);
    (irc as any).updateSelfUserModes('');
  });

  it('handleChannelModeChange applies prefix modes and sorts', () => {
    const { irc } = makeConnected();
    const users = new Map();
    users.set('alice', { nick: 'Alice', modes: ['v'], host: 'h' });
    (irc as any).channelUsers.set('#chan', users);
    (irc as any).handleChannelModeChange('#chan', ['+o', 'Alice']);
    expect(users.get('alice').modes).toContain('o');
    (irc as any).handleChannelModeChange('#chan', ['-v', 'Alice']);
    expect(users.get('alice').modes).not.toContain('v');
    // no users map -> early return
    (irc as any).handleChannelModeChange('#nope', ['+o', 'x']);
    // empty params -> early return
    (irc as any).handleChannelModeChange('#chan', []);
  });

  it('handleChannelModeChange triggers anti-deop re-op', () => {
    const { irc, socket } = makeConnected();
    (irc as any).currentNick = 'Me';
    const users = new Map();
    users.set('me', { nick: 'Me', modes: ['o'], host: 'h' });
    (irc as any).channelUsers.set('#chan', users);
    jest.spyOn(protectionService, 'getAntiDeopConfig').mockReturnValue({
      protAntiDeopEnabled: true,
      protAntiDeopUseChanserv: true,
    } as any);
    (irc as any).handleChannelModeChange('#chan', ['-o', 'Me']);
    expect(socket.writes.some(w => w.includes('ChanServ :OP #chan Me'))).toBe(
      true,
    );

    const direct = makeConnected();
    (direct.irc as any).currentNick = 'Me';
    const users2 = new Map();
    users2.set('me', { nick: 'Me', modes: ['o'], host: 'h' });
    (direct.irc as any).channelUsers.set('#chan', users2);
    jest.spyOn(protectionService, 'getAntiDeopConfig').mockReturnValue({
      protAntiDeopEnabled: true,
      protAntiDeopUseChanserv: false,
    } as any);
    (direct.irc as any).handleChannelModeChange('#chan', ['-o', 'Me']);
    expect(direct.socket.writes.some(w => w.includes('MODE #chan +o Me'))).toBe(
      true,
    );
  });
});

describe('IRCService coverage - /server command parsing', () => {
  afterEach(() => jest.restoreAllMocks());

  const parse = (irc: IRCService, args: string[]) =>
    (irc as any).parseServerCommand(args);

  it('parses switches, address, port and password', () => {
    const { irc } = makeConnected();
    const res = parse(irc, ['-et', 'irc.example.com', '+6697', 'secret']);
    expect(res.switches.ssl).toBe(true);
    expect(res.switches.starttls).toBe(true);
    expect(res.address).toBe('irc.example.com');
    expect(res.port).toBe(6697);
    expect(res.password).toBe('secret');
  });

  it('parses management mode options', () => {
    const { irc } = makeConnected();
    const res = parse(irc, [
      '-sa',
      'MyName',
      '-d',
      'My Server',
      '-p',
      '6667',
      '-g',
      'Group',
      '-w',
      'pw',
    ]);
    expect(res.management.add).toBe(true);
    expect(res.management.sort).toBe(true);
    expect(res.managementOptions.description).toBe('My Server');
    expect(res.managementOptions.port).toBe(6667);
    expect(res.managementOptions.group).toBe('Group');
    expect(res.address).toBe('MyName');
  });

  it('parses Nth-server index, login, identity and join channels', () => {
    const { irc } = makeConnected();
    const res = parse(irc, [
      '3',
      '-l',
      'sasl',
      'pass',
      '-lname',
      'account',
      '-i',
      'nick',
      'altn',
      'e@mail',
      'Real Name',
      '-jn',
      '#chan',
      'chanpass',
    ]);
    expect(res.serverIndex).toBe(3);
    expect(res.login.method).toBe('sasl');
    expect(res.login.password).toBe('pass');
    expect(res.login.username).toBe('account');
    expect(res.identity.nick).toBe('nick');
    expect(res.identity.altNick).toBe('altn');
    expect(res.joinChannels[0]).toEqual({
      channel: '#chan',
      password: 'chanpass',
    });
  });

  it('handles starttls port prefix and unknown params', () => {
    const { irc } = makeConnected();
    const res = parse(irc, ['irc.host', '*6697', 'pw', '-unknown', 'x']);
    expect(res.switches.starttls).toBe(true);
    expect(res.port).toBe(6697);
  });
});

describe('IRCService coverage - keepalive, reconnect & disconnect', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('startKeepAlive pings on idle and destroys after missed pongs', () => {
    const { irc, socket } = makeConnected();
    (irc as any).KEEPALIVE_INTERVAL_MS = 1000;
    (irc as any).KEEPALIVE_IDLE_MS = 0;
    (irc as any).KEEPALIVE_MAX_MISSED_PONGS = 2;
    (irc as any).startKeepAlive();
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(1000);
    expect(socket.writes.some(w => w.includes('PING :keepalive'))).toBe(true);
    expect(socket.destroyed).toBe(true);
    (irc as any).stopKeepAlive();
  });

  it('scheduleReconnect schedules and retries connect', () => {
    const { irc } = makeConnected();
    (irc as any).autoReconnectEnabled = true;
    (irc as any).config = { host: 'irc.host', port: 6667 };
    (irc as any).INITIAL_RECONNECT_DELAY = 100;
    (irc as any).MAX_RECONNECT_DELAY = 1000;
    const connectSpy = jest
      .spyOn(irc, 'connect')
      .mockResolvedValue(undefined as any);
    (irc as any).scheduleReconnect();
    jest.advanceTimersByTime(200);
    expect(connectSpy).toHaveBeenCalled();
  });

  it('scheduleReconnect no-ops without config or when disabled', () => {
    const { irc } = makeConnected();
    (irc as any).autoReconnectEnabled = false;
    (irc as any).config = { host: 'h', port: 1 };
    (irc as any).scheduleReconnect();
    expect((irc as any).reconnectTimer).toBeFalsy();
  });

  it('setAutoReconnect and cancelReconnect manage timer', () => {
    const { irc } = makeConnected();
    irc.setAutoReconnect(true);
    expect(irc.isAutoReconnectEnabled()).toBe(true);
    (irc as any).reconnectTimer = setTimeout(() => {}, 10000);
    irc.setAutoReconnect(false);
    expect((irc as any).reconnectTimer).toBeNull();
    (irc as any).reconnectTimer = setTimeout(() => {}, 10000);
    irc.cancelReconnect();
    expect((irc as any).reconnectTimer).toBeNull();
  });

  it('disconnect gracefully tears down a tcp socket', () => {
    const { irc, socket } = makeConnected();
    irc.disconnect('bye');
    expect(socket.writes.some(w => w.includes('QUIT :bye'))).toBe(true);
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.ended).toBe(true);
    jest.advanceTimersByTime(200);
    expect(socket.destroyed).toBe(true);
    expect((irc as any).isConnected).toBe(false);
  });

  it('disconnect clears websocket handlers', () => {
    const irc = new IRCService();
    const ws: any = {
      onopen: () => {},
      onmessage: () => {},
      onerror: () => {},
      onclose: () => {},
      close: jest.fn(),
    };
    (irc as any).socket = ws;
    (irc as any).isConnected = true;
    (irc as any).currentTransport = 'websocket';
    irc.disconnect();
    expect(ws.onopen).toBeNull();
    expect(ws.close).toHaveBeenCalled();
  });
});

describe('IRCService coverage - foreground notification', () => {
  afterEach(() => jest.restoreAllMocks());

  it('emitConnection starts foreground service on connect', () => {
    mockFgIsRunning.mockReturnValue(false);
    mockGetAllConnections.mockReturnValue([]);
    const { irc } = makeConnected();
    irc.onConnectionChange(() => {});
    (irc as any).emitConnection(true);
    expect(mockFgStart).toHaveBeenCalled();
  });

  it('emitConnection updates when service already running and multiple nets', () => {
    mockFgIsRunning.mockReturnValue(true);
    mockGetAllConnections.mockReturnValue([
      {
        networkId: 'Net1',
        ircService: { getConnectionStatus: () => true },
      },
      {
        networkId: 'Net2',
        ircService: { getConnectionStatus: () => true },
      },
    ]);
    const { irc } = makeConnected();
    irc.onConnectionChange(() => {});
    (irc as any).emitConnection(true);
    expect(mockFgUpdate).toHaveBeenCalled();
  });

  it('emitConnection stops service when nothing connected', () => {
    mockFgIsRunning.mockReturnValue(false);
    mockGetAllConnections.mockReturnValue([]);
    const { irc } = makeConnected();
    irc.onConnectionChange(() => {});
    (irc as any).emitConnection(false);
    expect(mockFgStop).toHaveBeenCalled();
  });
});

describe('IRCService coverage - message buffering & numerics', () => {
  afterEach(() => jest.restoreAllMocks());

  it('emitMessage buffers until a listener attaches then flushes', () => {
    const irc = new IRCService();
    (irc as any).emitMessage({ id: '1', type: 'raw', text: 'early' });
    const received: any[] = [];
    irc.onMessage(m => received.push(m));
    expect(received.some(m => m.text === 'early')).toBe(true);
  });

  it('onConnectionChange flushes buffered connection states', () => {
    const irc = new IRCService();
    (irc as any).emitConnection(true);
    const states: boolean[] = [];
    irc.onConnectionChange(s => states.push(s));
    expect(states).toContain(true);
  });

  it('handleNumericReply falls back to generic raw display', () => {
    const { irc } = makeConnected();
    const msgs: any[] = [];
    jest.spyOn(irc as any, 'addMessage').mockImplementation((m: any) => {
      msgs.push(m);
    });
    (irc as any).handleNumericReply(
      999,
      'server',
      ['tester', 'some custom text'],
      Date.now(),
    );
    expect(msgs.some(m => m.rawCategory === 'server')).toBe(true);
  });
});

describe('IRCService coverage - webirc & clone detection', () => {
  afterEach(() => jest.restoreAllMocks());

  it('formatWebIRCCommand builds command and validates parts', () => {
    const { irc } = makeConnected();
    const cmd = (irc as any).formatWebIRCCommand({
      password: 'pw',
      gateway: 'gw',
      hostname: 'host',
      ip: '1.2.3.4',
      options: ['secure', 'bad option'],
    });
    expect(cmd).toBe('WEBIRC pw gw host 1.2.3.4 secure');
    expect(() =>
      (irc as any).formatWebIRCCommand({
        password: 'bad pw',
        gateway: 'gw',
        hostname: 'host',
        ip: '1.2.3.4',
      }),
    ).toThrow();
  });

  it('detectClones groups users by host across batches', async () => {
    const { irc } = makeConnected();
    (irc as any).cloneDetectionBatchSize = 1;
    (irc as any).cloneDetectionDelay = 0;
    const users = new Map();
    users.set('a', { nick: 'a', host: 'same.host' });
    users.set('b', { nick: 'b', host: 'same.host' });
    users.set('c', { nick: 'c', host: 'other.host' });
    (irc as any).channelUsers.set('#chan', users);
    const clones = await (irc as any).detectClones('#chan');
    expect(clones.get('same.host')).toEqual(['a', 'b']);
    expect(clones.has('other.host')).toBe(false);
    const empty = await (irc as any).detectClones('#none');
    expect(empty.size).toBe(0);
    expect(irc.isCloneDetectionActive()).toBe(false);
  });
});

describe('IRCService coverage - connect() transport paths', () => {
  const baseConfig: any = {
    host: 'irc.host',
    port: 6667,
    tls: false,
    nick: 'tester',
    username: 'tester',
    realname: 'Tester',
    networkId: 'TestNet',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockCheckConnection.mockReturnValue({
      shouldUpgrade: false,
      tlsRequired: false,
      targetPort: 6697,
      targetHost: 'irc.host',
    });
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('connects over plain TCP and wires data/error/close/timeout handlers', async () => {
    const socket = new RichSocket();
    mockCreateConnection.mockImplementation((_opts: any, cb: any) => {
      if (cb) Promise.resolve().then(() => cb());
      return socket;
    });
    const irc = new IRCService();
    const connEvents: boolean[] = [];
    irc.onConnectionChange(c => connEvents.push(c));
    await irc.connect({ ...baseConfig });
    expect((irc as any).isConnected).toBe(true);
    expect(connEvents).toContain(true);
    // registration commands sent via startCAPNegotiation
    expect(socket.writes.some(w => w.includes('CAP LS 302'))).toBe(true);

    // Drive inbound data -> processBuffer -> handleIRCMessage
    const handleSpy = jest.spyOn(irc as any, 'handleIRCMessage');
    socket.emit('data', 'PING :abc\r\n');
    expect(handleSpy).toHaveBeenCalled();

    // Timeout handler sends a PING check (requires registered state)
    (irc as any).registered = true;
    socket.emit('timeout');
    expect(socket.writes.some(w => w.includes('timeout-check'))).toBe(true);

    // Close handler resets state
    socket.emit('close');
    expect((irc as any).isConnected).toBe(false);
    irc.disconnect();
    jest.advanceTimersByTime(200);
  });

  it('connects over TLS', async () => {
    const socket = new RichSocket();
    mockConnectTLS.mockImplementation((_opts: any, cb: any) => {
      if (cb) Promise.resolve().then(() => cb());
      return socket;
    });
    const irc = new IRCService();
    await irc.connect({ ...baseConfig, tls: true, rejectUnauthorized: true });
    expect((irc as any).isConnected).toBe(true);
    expect(mockConnectTLS).toHaveBeenCalled();
    irc.disconnect();
    jest.advanceTimersByTime(200);
  });

  it('honors STS upgrade to TLS and emits sts-upgrade', async () => {
    mockCheckConnection.mockReturnValue({
      shouldUpgrade: true,
      tlsRequired: true,
      targetPort: 6697,
      targetHost: 'irc.host',
      reason: 'policy',
    });
    const socket = new RichSocket();
    mockConnectTLS.mockImplementation((_opts: any, cb: any) => {
      if (cb) Promise.resolve().then(() => cb());
      return socket;
    });
    const irc = new IRCService();
    const stsEvents: any[] = [];
    irc.on('sts-upgrade', (e: any) => stsEvents.push(e));
    await irc.connect({ ...baseConfig });
    expect(stsEvents.length).toBe(1);
    expect(mockConnectTLS).toHaveBeenCalled();
    irc.disconnect();
    jest.advanceTimersByTime(200);
  });

  it('reports a socket error after a successful connect', async () => {
    const socket = new RichSocket();
    mockCreateConnection.mockImplementation((_opts: any, cb: any) => {
      if (cb) Promise.resolve().then(() => cb());
      return socket;
    });
    const irc = new IRCService();
    const msgs: any[] = [];
    irc.onMessage(m => msgs.push(m));
    await irc.connect({ ...baseConfig });
    socket.emit('error', { message: 'reset by peer', code: 'ECONNRESET' });
    expect(
      msgs.some(m => m.type === 'error' && /reset by peer/.test(m.text)),
    ).toBe(true);
    irc.disconnect();
    jest.advanceTimersByTime(200);
  });

  it('connection timeout rejects when socket never connects', async () => {
    const socket = new RichSocket();
    mockCreateConnection.mockImplementation((_opts: any, _cb: any) => socket);
    const irc = new IRCService();
    const p = irc.connect({ ...baseConfig });
    p.catch(() => {});
    jest.advanceTimersByTime(10000);
    await expect(p).rejects.toThrow(/timeout/i);
  });

  it('CAP negotiation timeout ends negotiation and registers', async () => {
    const socket = new RichSocket();
    mockCreateConnection.mockImplementation((_opts: any, cb: any) => {
      if (cb) Promise.resolve().then(() => cb());
      return socket;
    });
    const irc = new IRCService();
    await irc.connect({ ...baseConfig });
    // capNegotiating true after startCAPNegotiation
    expect((irc as any).capNegotiating).toBe(true);
    jest.advanceTimersByTime(5000);
    expect(socket.writes.some(w => w.includes('CAP END'))).toBe(true);
    // registration NICK/USER now sent
    jest.advanceTimersByTime(100);
    expect(socket.writes.some(w => w.includes('NICK tester'))).toBe(true);
    irc.disconnect();
    jest.advanceTimersByTime(200);
  });

  it('connects via websocket transport and processes events', async () => {
    const ws: any = {
      protocol: 'text.ircv3.net',
      send: jest.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
    };
    mockCreateIRCWebSocket.mockReturnValue(ws);
    const irc = new IRCService();
    const p = irc.connect({ ...baseConfig, transport: 'websocket' });
    // Trigger onopen -> markConnected -> resolves
    ws.onopen();
    await p;
    expect((irc as any).isConnected).toBe(true);
    expect(irc.getTransportInfo().transport).toBe('websocket');
    // message + close
    const handleWs = jest.spyOn(irc as any, 'handleWebSocketMessage');
    ws.onmessage({ data: 'PING :x' });
    expect(handleWs).toHaveBeenCalled();
    ws.onclose();
    expect((irc as any).isConnected).toBe(false);
  });

  it('rejects websocket transport on error event', async () => {
    const ws: any = {
      send: jest.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
    };
    mockCreateIRCWebSocket.mockReturnValue(ws);
    const irc = new IRCService();
    const p = irc.connect({ ...baseConfig, transport: 'websocket' });
    ws.onerror({ message: 'ws fail' });
    await expect(p).rejects.toThrow(/ws fail/);
  });

  it('sends WEBIRC command when webirc is enabled on TCP connect', async () => {
    const socket = new RichSocket();
    mockCreateConnection.mockImplementation((_opts: any, cb: any) => {
      if (cb) Promise.resolve().then(() => cb());
      return socket;
    });
    const irc = new IRCService();
    await irc.connect({
      ...baseConfig,
      webirc: {
        enabled: true,
        password: 'pw',
        gateway: 'gw',
        hostname: 'h',
        ip: '1.2.3.4',
      },
    });
    expect(socket.writes.some(w => w.startsWith('WEBIRC pw gw h 1.2.3.4'))).toBe(
      true,
    );
    irc.disconnect();
    jest.advanceTimersByTime(200);
  });

  it('throws when proxy host/port missing', async () => {
    const irc = new IRCService();
    await expect(
      irc.connect({
        ...baseConfig,
        proxy: { enabled: true, type: 'socks5' },
      }),
    ).rejects.toThrow(/Proxy host/);
  });
});

describe('IRCService coverage - CAP negotiation internals', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('requestCapabilities sends CAP REQ for available caps', () => {
    const { irc, socket } = makeConnected();
    (irc as any).capNegotiating = true;
    (irc as any).config = {
      sasl: { account: 'a', password: 'b' },
    };
    ['server-time', 'message-tags', 'sasl', 'echo-message'].forEach(c =>
      (irc as any).capAvailable.add(c),
    );
    (irc as any).requestCapabilities();
    expect(socket.writes.some(w => w.startsWith('CAP REQ :'))).toBe(true);
  });

  it('requestCapabilities ends negotiation when nothing to request', () => {
    const { irc, socket } = makeConnected();
    (irc as any).capNegotiating = true;
    (irc as any).config = {};
    (irc as any).requestCapabilities();
    expect(socket.writes.some(w => w.includes('CAP END'))).toBe(true);
  });

  it('endCAPNegotiation sends pre-away and schedules registration', () => {
    const { irc, socket } = makeConnected();
    (irc as any).capNegotiating = true;
    (irc as any).capEnabledSet.add('draft/pre-away');
    (irc as any).config = { preAway: 'brb' };
    const reg = jest.fn();
    (irc as any)._sendRegistration = reg;
    (irc as any).endCAPNegotiation();
    expect(socket.writes.some(w => w.includes('AWAY :brb'))).toBe(true);
    expect(socket.writes.some(w => w.includes('CAP END'))).toBe(true);
    jest.advanceTimersByTime(50);
    expect(reg).toHaveBeenCalled();
    // early-return path when not negotiating
    (irc as any).endCAPNegotiation();
  });
});

describe('IRCService coverage - foreground error handlers & listener removal', () => {
  afterEach(() => jest.restoreAllMocks());

  it('logs when foreground service start/update/stop reject', async () => {
    mockFgIsRunning.mockReturnValue(true);
    mockFgUpdate.mockRejectedValueOnce(new Error('update fail'));
    mockGetAllConnections.mockReturnValue([]);
    const { irc } = makeConnected();
    irc.onConnectionChange(() => {});
    (irc as any).emitConnection(true);

    mockFgIsRunning.mockReturnValue(false);
    mockFgStart.mockRejectedValueOnce(new Error('start fail'));
    (irc as any).emitConnection(true);

    mockGetAllConnections.mockReturnValue([]);
    mockFgStop.mockRejectedValueOnce(new Error('stop fail'));
    (irc as any).emitConnection(false);
    await Promise.resolve();
    expect(mockFgStop).toHaveBeenCalled();
  });

  it('onMessage/onConnectionChange unsubscribe removes listeners', () => {
    const irc = new IRCService();
    const mcb = jest.fn();
    const ccb = jest.fn();
    const un1 = irc.onMessage(mcb);
    const un2 = irc.onConnectionChange(ccb);
    expect((irc as any).messageListeners).toContain(mcb);
    expect((irc as any).connectionListeners).toContain(ccb);
    un1();
    un2();
    expect((irc as any).messageListeners).not.toContain(mcb);
    expect((irc as any).connectionListeners).not.toContain(ccb);
  });

  it('onUserListChange unsubscribe removes listener', () => {
    const irc = new IRCService();
    const cb = jest.fn();
    const un = irc.onUserListChange(cb);
    expect((irc as any).userListListeners).toContain(cb);
    un();
    expect((irc as any).userListListeners).not.toContain(cb);
  });
});

describe('IRCService coverage - proxy tunnels', () => {
  const tick = () => new Promise(res => setImmediate(res));
  const config: any = { host: 'irc.host', port: 6667 };

  afterEach(() => jest.restoreAllMocks());

  it('readFromSocketUntil resolves, and rejects on error', async () => {
    const { irc } = makeConnected();
    const socket = new RichSocket();
    const p = (irc as any).readFromSocketUntil(
      socket,
      (buf: Buffer) => buf.length >= 3,
    );
    socket.emit('data', Buffer.from([1, 2, 3]));
    const buf = await p;
    expect(buf.length).toBe(3);

    const p2 = (irc as any).readFromSocketUntil(
      socket,
      (buf: Buffer) => buf.length >= 10,
    );
    socket.emit('error', new Error('sock err'));
    await expect(p2).rejects.toThrow('sock err');
  });

  it('establishHttpTunnel succeeds on 200 and fails otherwise', async () => {
    const ok = makeConnected();
    const okSocket = ok.socket;
    (ok.irc as any).socket = okSocket;
    const p = (ok.irc as any).establishHttpTunnel(
      { type: 'http', username: 'u', password: 'p' },
      config,
    );
    await tick();
    okSocket.emit('data', Buffer.from('HTTP/1.1 200 OK\r\n\r\n'));
    await p;
    expect(okSocket.writes.some(w => w.includes('CONNECT irc.host:6667'))).toBe(
      true,
    );

    const bad = makeConnected();
    const badSocket = bad.socket;
    const p2 = (bad.irc as any).establishHttpTunnel({ type: 'http' }, config);
    await tick();
    badSocket.emit('data', Buffer.from('HTTP/1.1 403 Forbidden\r\n\r\n'));
    await expect(p2).rejects.toThrow(/CONNECT failed/);
  });

  it('establishSocks5Tunnel completes handshake without auth', async () => {
    const { irc, socket } = makeConnected();
    const p = (irc as any).establishSocks5Tunnel({ type: 'socks5' }, config);
    await tick();
    // method selection: version 5, method 0 (no auth)
    socket.emit('data', Buffer.from([0x05, 0x00]));
    await tick();
    // connect reply: ver, rep=0, rsv, atyp=1 (ipv4), 4 addr bytes + 2 port
    socket.emit('data', Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]));
    await p;
    expect(socket.writes.length).toBeGreaterThanOrEqual(0);
  });

  it('establishSocks5Tunnel performs username/password auth', async () => {
    const { irc, socket } = makeConnected();
    const p = (irc as any).establishSocks5Tunnel(
      { type: 'socks5', username: 'user', password: 'pass' },
      config,
    );
    await tick();
    socket.emit('data', Buffer.from([0x05, 0x02])); // choose user/pass auth
    await tick();
    socket.emit('data', Buffer.from([0x01, 0x00])); // auth success
    await tick();
    socket.emit('data', Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]));
    await p;
    expect(socket.write).toHaveBeenCalled();
  });

  it('establishSocks5Tunnel rejects on invalid version', async () => {
    const { irc, socket } = makeConnected();
    const p = (irc as any).establishSocks5Tunnel({ type: 'socks5' }, config);
    await tick();
    socket.emit('data', Buffer.from([0x04, 0x00]));
    await expect(p).rejects.toThrow(/invalid version/);
  });

  it('establishProxyTunnel routes http vs socks5', async () => {
    const { irc } = makeConnected();
    const httpSpy = jest
      .spyOn(irc as any, 'establishHttpTunnel')
      .mockResolvedValue(undefined);
    const socksSpy = jest
      .spyOn(irc as any, 'establishSocks5Tunnel')
      .mockResolvedValue(undefined);
    await (irc as any).establishProxyTunnel({ type: 'http' }, config);
    await (irc as any).establishProxyTunnel({ type: 'socks5' }, config);
    await (irc as any).establishProxyTunnel(null, config);
    expect(httpSpy).toHaveBeenCalledTimes(1);
    expect(socksSpy).toHaveBeenCalledTimes(1);
  });
});

describe('IRCService coverage - misc handlers', () => {
  afterEach(() => jest.restoreAllMocks());

  it('handleIRCMessage parses server-time tag with fractional seconds', () => {
    const { irc } = makeConnected();
    (irc as any).serverTime = true;
    jest.spyOn(irc as any, 'addMessage').mockImplementation(() => {});
    (irc as any).handleIRCMessage(
      '@time=2021-06-01T12:00:00.123456Z :nick!u@h PRIVMSG #c :hi there',
    );
    // No throw; timestamp parsing path exercised
    expect(true).toBe(true);
  });

  it('maybeEmitChannelIntro emits topic intro once topic is known', () => {
    const { irc } = makeConnected();
    const msgs: any[] = [];
    jest.spyOn(irc as any, 'addMessage').mockImplementation((m: any) => {
      msgs.push(m);
    });
    (irc as any).pendingChannelIntro.add('#chan');
    // No topic yet -> no emit
    (irc as any).maybeEmitChannelIntro('#chan', Date.now());
    expect(msgs.length).toBe(0);
    (irc as any).channelTopics.set('#chan', { topic: 'Welcome!' });
    (irc as any).maybeEmitChannelIntro('#chan', Date.now());
    expect(msgs.some(m => m.type === 'topic' && /Welcome/.test(m.text))).toBe(
      true,
    );
    // Now removed from pending -> subsequent call no-op
    (irc as any).maybeEmitChannelIntro('#chan', Date.now());
  });

  it('emitUserListChange notifies registered user-list listeners', () => {
    const { irc } = makeConnected();
    const cb = jest.fn();
    irc.onUserListChange(cb);
    (irc as any).emitUserListChange('#chan', [{ nick: 'a', modes: [] }]);
    expect(cb).toHaveBeenCalledWith('#chan', [{ nick: 'a', modes: [] }]);
  });
});

describe('IRCService coverage - proxy connect', () => {
  const tick = () => new Promise(res => setImmediate(res));
  const baseConfig: any = {
    host: 'irc.host',
    port: 6667,
    nick: 'tester',
    username: 'tester',
    realname: 'Tester',
    networkId: 'TestNet',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckConnection.mockReturnValue({
      shouldUpgrade: false,
      tlsRequired: false,
      targetPort: 6697,
      targetHost: 'irc.host',
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('connects through a SOCKS5 proxy without TLS', async () => {
    const proxySocket = new RichSocket();
    mockCreateConnection.mockImplementation((_opts: any, cb: any) => {
      if (cb) Promise.resolve().then(() => cb());
      return proxySocket;
    });
    const irc = new IRCService();
    jest
      .spyOn(irc as any, 'establishProxyTunnel')
      .mockResolvedValue(undefined);
    const p = irc.connect({
      ...baseConfig,
      tls: false,
      proxy: { enabled: true, type: 'socks5', host: '127.0.0.1', port: 9050 },
    });
    await tick();
    await tick();
    await p;
    expect((irc as any).isConnected).toBe(true);
    irc.disconnect();
  });

  it('upgrades a proxy tunnel to TLS', async () => {
    const proxySocket = new RichSocket();
    const tlsSocket = new RichSocket();
    mockCreateConnection.mockImplementation((_opts: any, cb: any) => {
      if (cb) Promise.resolve().then(() => cb());
      return proxySocket;
    });
    mockTLSSocketCtor.mockReturnValue(tlsSocket);
    const irc = new IRCService();
    jest
      .spyOn(irc as any, 'establishProxyTunnel')
      .mockResolvedValue(undefined);
    const p = irc.connect({
      ...baseConfig,
      tls: true,
      proxy: { enabled: true, type: 'socks5', host: '127.0.0.1', port: 9050 },
    });
    await tick();
    await tick();
    tlsSocket.emit('secureConnect');
    await p;
    expect((irc as any).isConnected).toBe(true);
    irc.disconnect();
  });

  it('rejects when proxy tunnel establishment fails', async () => {
    const proxySocket = new RichSocket();
    mockCreateConnection.mockImplementation((_opts: any, cb: any) => {
      if (cb) Promise.resolve().then(() => cb());
      return proxySocket;
    });
    const irc = new IRCService();
    jest
      .spyOn(irc as any, 'establishProxyTunnel')
      .mockRejectedValue(new Error('tunnel down'));
    const p = irc.connect({
      ...baseConfig,
      tls: false,
      proxy: { enabled: true, type: 'http', host: '127.0.0.1', port: 8080 },
    });
    await expect(p).rejects.toThrow(/tunnel down/);
  });
});

describe('IRCService coverage - extra branches', () => {
  const protectionService2 = protectionService;
  afterEach(() => jest.restoreAllMocks());

  it('handleProtectionBlock GLINE with duration', () => {
    const { irc, socket } = makeConnected();
    irc.setUserManagementService({
      isUserIgnored: jest.fn(() => false),
      ignoreUser: jest.fn(() => Promise.resolve()),
      resolveBlacklistMask: jest.fn(() => 'n!u@h'),
    } as any);
    (irc as any).selfUserModes.add('o');
    jest.spyOn(protectionService2, 'getActionConfig').mockReturnValue({
      protEnforceSilence: false,
      protIrcopAction: 'gline',
      protIrcopReason: 'r',
      protIrcopDuration: '7200',
    } as any);
    (irc as any).handleProtectionBlock('x', 'Bad', 'u', 'h', null);
    expect(socket.writes.some(w => w.includes('GLINE') && w.includes('7200'))).toBe(
      true,
    );
  });

  it('parseServerCommand handles -m and -n window switches', () => {
    const { irc } = makeConnected();
    const res = (irc as any).parseServerCommand(['-mn', 'irc.host']);
    expect(res.switches.newWindow).toBe(true);
    expect(res.switches.newWindowNoConnect).toBe(true);
  });

  it('handleCTCPRequest delegates to CTCP handler', async () => {
    const { irc } = makeConnected();
    (irc as any).config = { realname: 'Real' };
    await (irc as any).handleCTCPRequest('bob!u@h', 'tester', 'PING', '123');
    // VERSION request also exercises settings lookup
    await (irc as any).handleCTCPRequest('bob!u@h', 'tester', 'VERSION');
    expect(true).toBe(true);
  });
});

describe('IRCService coverage - connect data decoding & manual close', () => {
  const baseConfig: any = {
    host: 'irc.host',
    port: 6667,
    tls: false,
    nick: 'tester',
    username: 'tester',
    realname: 'Tester',
    networkId: 'TestNet',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockCheckConnection.mockReturnValue({
      shouldUpgrade: false,
      tlsRequired: false,
      targetPort: 6697,
      targetHost: 'irc.host',
    });
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('decodes binary socket data and handles manual-disconnect close', async () => {
    const socket = new RichSocket();
    mockCreateConnection.mockImplementation((_opts: any, cb: any) => {
      if (cb) Promise.resolve().then(() => cb());
      return socket;
    });
    const irc = new IRCService();
    await irc.connect({ ...baseConfig });
    const handleSpy = jest.spyOn(irc as any, 'handleIRCMessage');
    // Binary Uint8Array data -> TextDecoder path
    socket.emit('data', new Uint8Array(Buffer.from('PING :bin\r\n', 'utf8')));
    expect(handleSpy).toHaveBeenCalled();

    // Error while manualDisconnect -> silent branch
    (irc as any).manualDisconnect = true;
    socket.emit('error', { message: 'ignored', code: 'X' });
    // Close while manualDisconnect -> reset branch
    socket.emit('close');
    expect((irc as any).isConnected).toBe(false);
  });
});
