/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockCreateConnection = jest.fn();
const mockCreateServer = jest.fn();

jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: {
    createConnection: (...args: any[]) => mockCreateConnection(...args),
    createServer: (...args: any[]) => mockCreateServer(...args),
  },
  createConnection: (...args: any[]) => mockCreateConnection(...args),
  createServer: (...args: any[]) => mockCreateServer(...args),
}));

const mockGetSetting = jest.fn(async (key: string, def: any) => def);
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: any[]) => mockGetSetting(...args),
  },
}));

const mockFs = {
  DocumentDirectoryPath: '/documents',
  CachesDirectoryPath: '/cache',
  exists: jest.fn(async () => true),
  stat: jest.fn(async () => ({ size: 0 })),
  appendFile: jest.fn(async () => undefined),
  read: jest.fn(async () => Buffer.from('x').toString('base64')),
  readDir: jest.fn(async () => []),
  unlink: jest.fn(async () => undefined),
};
jest.mock('react-native-fs', () => mockFs);

import { dccFileService } from '../../src/services/DCCFileService';

class FakeSocket {
  handlers: Record<string, Function> = {};
  write = jest.fn();
  destroy = jest.fn();
  on(event: string, cb: Function) {
    this.handlers[event] = cb;
    return this;
  }
  emit(event: string, ...args: any[]) {
    this.handlers[event]?.(...args);
  }
}

class FakeServer {
  private connHandler: Function;
  private listenCb: Function | null = null;
  close = jest.fn();
  constructor(connHandler: Function) {
    this.connHandler = connHandler;
  }
  listen(_opts: any, cb: Function) {
    this.listenCb = cb;
    cb();
  }
  address() {
    return { address: '0.0.0.0', port: 6000 };
  }
  async connectClient(socket: FakeSocket) {
    await this.connHandler(socket);
  }
}

describe('DCCFileService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (dccFileService as any).transfers = new Map();
    (dccFileService as any).sockets = new Map();
    (dccFileService as any).sendServers = new Map();
    (dccFileService as any).listeners = [];
    (dccFileService as any).defaultPortRange = { min: 5000, max: 65535 };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('parses valid DCC SEND offers and private helper conversions', () => {
    const parsed = dccFileService.parseSendOffer(
      '\x01DCC SEND "file.txt" 2130706433 5000 12\x01',
    );
    expect(parsed).toEqual(
      expect.objectContaining({
        filename: 'file.txt',
        host: '127.0.0.1',
        port: 5000,
        size: 12,
      }),
    );
    expect(
      dccFileService.parseSendOffer('\x01DCC SEND nope x y z\x01'),
    ).toBeNull();
    expect(dccFileService.parseSendOffer(undefined as any)).toBeNull();
    expect((dccFileService as any).intToIp('bad')).toBe('bad');
    expect((dccFileService as any).ipToInt('1.2.3.4')).toBeGreaterThan(0);
    expect((dccFileService as any).ipToInt('bad')).toBeNull();
    expect((dccFileService as any).sanitizeFilename('a:b?c')).toBe('a_b_c');
  });

  it('handles offer, listeners, list, port range and cancel lifecycle', () => {
    const updates: any[] = [];
    const off = dccFileService.onTransferUpdate(t => updates.push(t.status));
    dccFileService.setPortRange(3000, 4000);

    const transfer = dccFileService.handleOffer('nick', 'net1', {
      filename: 'a.txt',
      host: '8.8.8.8',
      port: 5001,
      size: 10,
    });
    expect(dccFileService.list().some(t => t.id === transfer.id)).toBe(true);
    expect(updates).toContain('pending');

    const sock = new FakeSocket();
    const server = new FakeServer(jest.fn());
    (dccFileService as any).sockets.set(transfer.id, sock);
    (dccFileService as any).sendServers.set(transfer.id, server);
    transfer.direction = 'outgoing';
    transfer.filePath = '/cache/x.tmp';
    (dccFileService as any).transfers.set(transfer.id, transfer);

    dccFileService.cancel(transfer.id);
    expect(sock.destroy).toHaveBeenCalled();
    expect(server.close).toHaveBeenCalled();
    expect(dccFileService.list().find(t => t.id === transfer.id)?.status).toBe(
      'cancelled',
    );
    off();
  });

  it('blocks private/local ip in accept when protection enabled', async () => {
    mockGetSetting.mockImplementation(async (key: string, def: any) =>
      key === 'dccBlockPrivateIp' ? true : def,
    );
    const transfer = dccFileService.handleOffer('nick', 'net1', {
      filename: 'a.txt',
      host: '127.0.0.1',
      port: 5001,
      size: 10,
    });
    await dccFileService.accept(
      transfer.id,
      { sendRaw: jest.fn() } as any,
      '/documents/a.txt',
    );
    expect(dccFileService.list().find(t => t.id === transfer.id)?.status).toBe(
      'failed',
    );
  });

  it('accepts transfer, appends chunks, sends ACK, handles error and close', async () => {
    mockGetSetting.mockImplementation(async (_key: string, def: any) => def);
    mockFs.stat.mockResolvedValueOnce({ size: 0 });

    const sock = new FakeSocket();
    mockCreateConnection.mockImplementation((_opts: any, cb: Function) => {
      cb();
      return sock;
    });

    const transfer = dccFileService.handleOffer('nick', 'net1', {
      filename: 'a.txt',
      host: '8.8.8.8',
      port: 5001,
      size: 5,
    });
    const irc = { sendRaw: jest.fn() } as any;
    await dccFileService.accept(transfer.id, irc, '/documents/a.txt');

    sock.emit('data', Buffer.from('abc'));
    await Promise.resolve();
    const state1 = dccFileService.list().find(t => t.id === transfer.id)!;
    expect(state1.bytesReceived).toBe(3);
    expect(sock.write).toHaveBeenCalled();
    expect(mockFs.appendFile).toHaveBeenCalled();

    sock.emit('error', new Error('boom'));
    const failed = dccFileService.list().find(t => t.id === transfer.id)!;
    expect(failed.status).toBe('failed');

    failed.status = 'downloading';
    (dccFileService as any).transfers.set(transfer.id, failed);
    sock.emit('close', false);
    expect(dccFileService.list().find(t => t.id === transfer.id)?.status).toBe(
      'completed',
    );
  });

  it('requests resume when partial file exists', async () => {
    mockGetSetting.mockImplementation(async (_key: string, def: any) => def);
    mockFs.stat.mockResolvedValueOnce({ size: 3 });
    const sock = new FakeSocket();
    mockCreateConnection.mockImplementation((_opts: any, cb: Function) => {
      cb();
      return sock;
    });

    const transfer = dccFileService.handleOffer('nick', 'net1', {
      filename: 'a.txt',
      host: '8.8.8.8',
      port: 5001,
      size: 10,
    });
    const irc = { sendRaw: jest.fn() } as any;
    await dccFileService.accept(transfer.id, irc, '/documents/a.txt');
    expect(irc.sendRaw).toHaveBeenCalledWith(
      expect.stringContaining('DCC RESUME'),
    );
  });

  it('builds default download path and sendFile input validation errors', async () => {
    mockGetSetting.mockImplementation(async (key: string, def: any) =>
      key === 'dccDownloadFolder' ? '/downloads' : def,
    );
    expect(await dccFileService.getDefaultDownloadPath('bad:name?.txt')).toBe(
      '/downloads/bad_name_.txt',
    );

    const irc = { sendRaw: jest.fn() } as any;
    await expect(
      dccFileService.sendFile(irc, 'nick', 'net1', ''),
    ).rejects.toThrow('No file path provided');

    mockFs.exists.mockResolvedValueOnce(false);
    await expect(
      dccFileService.sendFile(irc, 'nick', 'net1', '/tmp/missing.txt'),
    ).rejects.toThrow('File not found');

    mockFs.exists.mockImplementationOnce(async () => {
      throw new Error('exists failed');
    });
    await expect(
      dccFileService.sendFile(irc, 'nick', 'net1', '/tmp/a.txt'),
    ).rejects.toThrow('Cannot check file');

    mockFs.exists.mockResolvedValueOnce(true);
    mockFs.stat.mockImplementationOnce(async () => {
      throw new Error('stat failed');
    });
    await expect(
      dccFileService.sendFile(irc, 'nick', 'net1', '/tmp/a.txt'),
    ).rejects.toThrow('Cannot read file info');
  });

  it('sends file through server socket and emits ctcp offer', async () => {
    jest.useRealTimers();
    mockFs.exists.mockResolvedValue(true);
    mockFs.stat.mockResolvedValue({ size: 1 });
    mockFs.read.mockResolvedValue(Buffer.from('Z').toString('base64'));
    mockGetSetting.mockImplementation(async (key: string, def: any) => {
      if (key === 'dccHostOverride') return '';
      if (key === 'dccSendMaxKbps') return 0;
      return def;
    });

    let createdServer: FakeServer | null = null;
    mockCreateServer.mockImplementation((handler: Function) => {
      createdServer = new FakeServer(handler);
      return createdServer;
    });

    const irc = {
      sendRaw: jest.fn(),
      getLocalAddress: jest.fn(() => '192.168.1.10'),
    } as any;
    const transfer = await dccFileService.sendFile(
      irc,
      'nick',
      'net1',
      '/cache/file.txt',
      6000,
    );
    expect(transfer.status).toBe('sending');
    expect(irc.sendRaw).toHaveBeenCalledWith(
      expect.stringContaining('DCC SEND'),
    );

    const client = new FakeSocket();
    await createdServer!.connectClient(client);
    await new Promise(res => setTimeout(res, 5));
    const done = dccFileService.list().find(t => t.id === transfer.id)!;
    expect(done.status).toBe('completed');
    expect(client.destroy).toHaveBeenCalled();
    expect(createdServer!.close).toHaveBeenCalled();
  });

  it('handles sendFile content uri and send stream errors', async () => {
    jest.useRealTimers();
    const irc = {
      sendRaw: jest.fn(),
      getLocalAddress: jest.fn(() => '10.0.0.2'),
    } as any;
    await expect(
      dccFileService.sendFile(irc, 'nick', 'net1', 'content://file'),
    ).rejects.toThrow('Invalid file path');

    mockFs.exists.mockResolvedValue(true);
    mockFs.stat.mockResolvedValue({ size: 1 });
    mockFs.read.mockRejectedValue(new Error('read failed'));
    mockGetSetting.mockImplementation(async (key: string, def: any) => {
      if (key === 'dccHostOverride') return 'bad host';
      if (key === 'dccSendMaxKbps') return 10;
      return def;
    });
    let createdServer: FakeServer | null = null;
    mockCreateServer.mockImplementation((handler: Function) => {
      createdServer = new FakeServer(handler);
      return createdServer;
    });

    const transfer = await dccFileService.sendFile(
      irc,
      'nick',
      'net1',
      '/documents/f.txt',
      6001,
    );
    const client = new FakeSocket();
    await createdServer!.connectClient(client);
    await new Promise(res => setTimeout(res, 5));
    const failed = dccFileService.list().find(t => t.id === transfer.id)!;
    expect(failed.status).toBe('failed');
    expect(failed.error).toContain('read failed');
  });

  it('applies bandwidth delay branch when dccSendMaxKbps is configured', async () => {
    jest.useRealTimers();
    mockFs.exists.mockResolvedValue(true);
    mockFs.stat.mockResolvedValue({ size: 1 });
    mockFs.read.mockResolvedValue(Buffer.from('Z').toString('base64'));
    mockGetSetting.mockImplementation(async (key: string, def: any) => {
      if (key === 'dccHostOverride') return '';
      if (key === 'dccSendMaxKbps') return 8;
      return def;
    });

    let createdServer: FakeServer | null = null;
    mockCreateServer.mockImplementation((handler: Function) => {
      createdServer = new FakeServer(handler);
      return createdServer;
    });

    const irc = {
      sendRaw: jest.fn(),
      getLocalAddress: jest.fn(() => '10.0.0.2'),
    } as any;
    const transfer = await dccFileService.sendFile(
      irc,
      'nick',
      'net1',
      '/documents/f-delay.txt',
      6002,
    );
    const client = new FakeSocket();
    await createdServer!.connectClient(client);
    await new Promise(res => setTimeout(res, 5));
    expect(dccFileService.list().find(t => t.id === transfer.id)?.status).toBe(
      'completed',
    );
  });

  it('cleans cached files only for app directories', async () => {
    mockFs.exists.mockResolvedValue(true);
    await (dccFileService as any).cleanupCachedFile('/cache/x.tmp');
    expect(mockFs.unlink).toHaveBeenCalledWith('/cache/x.tmp');

    mockFs.unlink.mockClear();
    await (dccFileService as any).cleanupCachedFile(
      '/sdcard/Download/user.txt',
    );
    expect(mockFs.unlink).not.toHaveBeenCalled();

    mockFs.exists.mockRejectedValueOnce(new Error('exists failed'));
    await (dccFileService as any).cleanupCachedFile('/cache/y.tmp');
  });
});
