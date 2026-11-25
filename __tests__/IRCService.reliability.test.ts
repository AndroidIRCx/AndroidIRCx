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
    (wrapper as any).original = cb;
    return this.on(event, wrapper);
  }

  removeListener(event: string, cb: Function) {
    const arr = this.listeners.get(event) || [];
    this.listeners.set(
      event,
      arr.filter(item => item !== cb && (item as any).original !== cb),
    );
    return this;
  }

  removeAllListeners() {
    this.listeners.clear();
  }

  listenerCount(event: string) {
    return (this.listeners.get(event) || []).length;
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
const mockCheckConnection = jest.fn();

jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: {
    createConnection: (...args: any[]) => mockCreateConnection(...args),
    connectTLS: (...args: any[]) => mockConnectTLS(...args),
  },
  TLSSocket: function () {
    return new MockSocket();
  },
}));

jest.mock('../src/services/STSService', () => ({
  stsService: {
    checkConnection: (...args: any[]) => mockCheckConnection(...args),
  },
}));

jest.mock('../src/services/IRCForegroundService', () => ({
  ircForegroundService: {
    isServiceRunning: jest.fn(() => false),
    start: jest.fn(() => Promise.resolve()),
    updateNotification: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
  },
}));

import { IRCService, IRCMessage } from '../src/services/IRCService';

const base = {
  host: 'irc.example',
  port: 6667,
  nick: 'tester',
  username: 'tester',
  realname: 'Tester',
};

describe('IRCService reliability', () => {
  let irc: IRCService;
  let messages: IRCMessage[];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    irc = new IRCService();
    messages = [];
    irc.onMessage(m => messages.push(m));
    mockCheckConnection.mockReturnValue({
      shouldUpgrade: false,
      tlsRequired: false,
      targetPort: 6667,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('errors before the socket connects', () => {
    it('reports a refused connection at once instead of a timeout', async () => {
      const socket = new MockSocket();
      mockCreateConnection.mockReturnValue(socket);
      const promise = irc.connect({ ...base, tls: false });
      socket.emit('error', {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });
      await expect(promise).rejects.toThrow('Connection refused');
      expect(messages.some(m => m.text.includes('ECONNREFUSED'))).toBe(true);
      jest.advanceTimersByTime(20000);
      expect(messages.some(m => m.text.includes('Connection timeout'))).toBe(
        false,
      );
    });

    it('reports a TLS certificate failure with its real message', async () => {
      const socket = new MockSocket();
      mockConnectTLS.mockReturnValue(socket);
      const promise = irc.connect({ ...base, port: 6697, tls: true });
      socket.emit('error', {
        message: 'Trust anchor for certification path not found.',
      });
      await expect(promise).rejects.toThrow('Trust anchor');
      expect(
        messages.some(m => m.type === 'error' && m.text.includes('NO_CODE')),
      ).toBe(true);
    });

    it('hands errors to the normal handler once the socket is open', async () => {
      const socket = new MockSocket();
      mockCreateConnection.mockImplementation((_opts: any, cb: Function) => {
        setTimeout(() => cb(), 0);
        return socket;
      });
      const promise = irc.connect({ ...base, tls: false });
      jest.advanceTimersByTime(1);
      await expect(promise).resolves.toBeUndefined();
      // Only the core handler is left.
      expect(socket.listenerCount('error')).toBe(1);
      const before = messages.length;
      socket.emit('error', { message: 'something odd' });
      expect((irc as any).isConnected).toBe(true);
      expect(messages.length).toBeGreaterThan(before);
      irc.disconnect();
    });

    it('ignores an early error from a socket it no longer uses', async () => {
      const socket = new MockSocket();
      mockCreateConnection.mockReturnValue(socket);
      const promise = irc.connect({ ...base, tls: false });
      (irc as any).socket = new MockSocket();
      socket.emit('error', { message: 'late' });
      expect(messages.some(m => m.text.includes('late'))).toBe(false);
      jest.advanceTimersByTime(10001);
      await expect(promise).rejects.toThrow('Connection timeout');
    });
  });

  describe('proxy and Tor', () => {
    const proxyConnect = async (
      proxy: any,
      host = 'irc.example',
      tunnel: () => Promise<any> = () => Promise.resolve(Buffer.alloc(0)),
    ) => {
      const socket = new MockSocket();
      mockCreateConnection.mockImplementation((_opts: any, cb: Function) => {
        Promise.resolve().then(() => cb());
        return socket;
      });
      const spy = jest
        .spyOn(irc as any, 'establishProxyTunnel')
        .mockImplementation(tunnel as any);
      const promise = irc.connect({ ...base, host, tls: false, proxy });
      return { socket, spy, promise };
    };

    it('gives Tor and .onion hosts much longer timeouts', async () => {
      const tor = await proxyConnect(
        { enabled: true, type: 'tor' },
        'example.onion',
        () => new Promise(() => {}),
      );
      await Promise.resolve();
      expect(tor.spy.mock.calls[0][2]).toBe(45000);
      jest.advanceTimersByTime(30000);
      expect(messages.some(m => m.text.includes('timeout'))).toBe(false);
      jest.advanceTimersByTime(31000);
      await expect(tor.promise).rejects.toThrow('Connection timeout');
    });

    it('gives other proxies a middle timeout and direct links the old one', async () => {
      const http = await proxyConnect(
        { enabled: true, type: 'http', host: 'p', port: 8080 },
        'irc.example',
        () => new Promise(() => {}),
      );
      await Promise.resolve();
      expect(http.spy.mock.calls[0][2]).toBe(15000);
      jest.advanceTimersByTime(20001);
      await expect(http.promise).rejects.toThrow('Connection timeout');

      mockCreateConnection.mockReturnValue(new MockSocket());
      const direct = irc.connect({ ...base, tls: false });
      jest.advanceTimersByTime(10001);
      await expect(direct).rejects.toThrow('Connection timeout');
    });

    it('feeds IRC bytes that came with the proxy reply to the parser', async () => {
      const handle = jest.spyOn(irc as any, 'handleIRCMessage');
      const { promise } = await proxyConnect(
        { enabled: true, type: 'socks5', host: '127.0.0.1', port: 1080 },
        'irc.example',
        () => Promise.resolve(Buffer.from(':srv NOTICE * :*** Looking up\r\n')),
      );
      await Promise.resolve();
      await Promise.resolve();
      await promise;
      expect(handle).toHaveBeenCalledWith(':srv NOTICE * :*** Looking up');
      irc.disconnect();
    });

    it('reads only the missing part of a SOCKS5 reply and returns the rest', async () => {
      const socket = new MockSocket();
      (irc as any).socket = socket;
      const read = jest.spyOn(irc as any, 'readFromSocketUntil');
      read
        .mockResolvedValueOnce(Buffer.from([0x05, 0x00]))
        // IPv6 reply: 4 + 16 + 2 = 22 bytes, first only 5 of them.
        .mockResolvedValueOnce(Buffer.from([0x05, 0x00, 0x00, 0x04, 0x20]))
        .mockResolvedValueOnce(
          Buffer.concat([Buffer.alloc(17, 0x20), Buffer.from('PING :x\r\n')]),
        );
      const leftover = await (irc as any).establishSocks5Tunnel(
        { type: 'socks5', host: '127.0.0.1', port: 1080 },
        { host: 'irc.example', port: 6667 },
        7000,
      );
      const predicate = read.mock.calls[2][1] as (b: Buffer) => boolean;
      expect(predicate(Buffer.alloc(16))).toBe(false);
      expect(predicate(Buffer.alloc(17))).toBe(true);
      expect(read.mock.calls[2][2]).toBe(7000);
      expect(leftover.toString()).toBe('PING :x\r\n');
    });

    it('accepts only a 200 status from an HTTP proxy and keeps the body', async () => {
      const socket = new MockSocket();
      (irc as any).socket = socket;
      const read = jest.spyOn(irc as any, 'readFromSocketUntil');
      read.mockResolvedValueOnce(
        Buffer.from('HTTP/1.1 407 Need auth, not 200\r\n\r\n'),
      );
      await expect(
        (irc as any).establishHttpTunnel(
          { type: 'http', host: 'p', port: 8080 },
          { host: 'irc.example', port: 6667 },
        ),
      ).rejects.toThrow('HTTP proxy CONNECT failed');

      read.mockResolvedValueOnce(
        Buffer.from('HTTP/1.0 200 OK\r\nX: y\r\n\r\n:srv NOTICE * :hi\r\n'),
      );
      const leftover = await (irc as any).establishHttpTunnel(
        { type: 'http', host: 'p', port: 8080 },
        { host: 'irc.example', port: 6667 },
      );
      expect(leftover.toString()).toBe(':srv NOTICE * :hi\r\n');
    });
  });

  describe('joinChannel', () => {
    let socket: MockSocket;
    const joins = () => socket.writes.map(w => w.replace(/\r\n$/, ''));

    beforeEach(() => {
      socket = new MockSocket();
      (irc as any).socket = socket;
      (irc as any).isConnected = true;
    });

    it("keeps names that already start with one of the server's channel types", () => {
      irc.joinChannel('&local');
      irc.joinChannel('#chan');
      irc.joinChannel('plain');
      (irc as any).isupportValues.set('CHANTYPES', '#!');
      irc.joinChannel('!abc');
      irc.joinChannel('&now-not-a-type');
      expect(joins()).toEqual([
        'JOIN &local',
        'JOIN #chan',
        'JOIN #plain',
        'JOIN !abc',
        'JOIN #&now-not-a-type',
      ]);
    });

    it('leaves JOIN 0 alone and prefixes each name of a list', () => {
      irc.joinChannel('0');
      irc.joinChannel('a,#b,&c');
      expect(joins()).toEqual(['JOIN 0', 'JOIN #a,#b,&c']);
    });

    it('remembers the key of a single channel for rejoining', () => {
      irc.joinChannel('Secret', 'pw');
      irc.joinChannel('#a,#b', 'k1,k2');
      expect(irc.getChannelKey('#SECRET')).toBe('pw');
      expect(irc.getChannelKey('#a')).toBeUndefined();
      expect(joins()).toEqual(['JOIN #Secret pw', 'JOIN #a,#b k1,k2']);
    });

    it('sends nothing while disconnected', () => {
      (irc as any).isConnected = false;
      irc.joinChannel('#x');
      expect(joins()).toEqual([]);
    });
  });

  it('reports the port it upgraded from in sts-upgrade', () => {
    mockCheckConnection.mockReturnValue({
      shouldUpgrade: true,
      targetPort: 6697,
      reason: 'policy',
    });
    mockConnectTLS.mockReturnValue(new MockSocket());
    const events: any[] = [];
    irc.on('sts-upgrade', (event: any) => events.push(event));
    irc.connect({ ...base, port: 6667, tls: false }).catch(() => {});
    expect(events[0]).toEqual(
      expect.objectContaining({ originalPort: 6667, newPort: 6697 }),
    );
    irc.disconnect();
  });

  it('drops an unfinished inbound line that grows past 64 KB', () => {
    (irc as any).inboundBuffer = Buffer.alloc(70 * 1024, 0x41);
    (irc as any).processBuffer();
    expect((irc as any).inboundBuffer.length).toBe(0);

    (irc as any).inboundBuffer = Buffer.alloc(9000, 0x41);
    (irc as any).processBuffer();
    expect((irc as any).inboundBuffer.length).toBe(9000);
  });
});
