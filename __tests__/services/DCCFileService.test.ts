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

import { dccFileService } from '../../src/services/DCCFileService';

describe('DCCFileService', () => {
  const RNFS = require('react-native-fs');

  beforeEach(() => {
    jest.clearAllMocks();
    (RNFS as any).exists = jest.fn(async () => true);
    (RNFS as any).stat = jest.fn(async () => ({ size: 0 }));
    (RNFS as any).appendFile = jest.fn(async () => undefined);
    (RNFS as any).read = jest.fn(async () => Buffer.from('x').toString('base64'));
    (RNFS as any).readDir = jest.fn(async () => []);
    (RNFS as any).unlink = jest.fn(async () => undefined);
  });

  it('parses valid DCC SEND offer and rejects invalid text', () => {
    const parsed = dccFileService.parseSendOffer('\x01DCC SEND "file.txt" 2130706433 5000 12\x01');
    expect(parsed).toBeTruthy();
    expect(parsed?.filename).toBe('file.txt');
    expect(parsed?.host).toBe('127.0.0.1');
    expect(parsed?.port).toBe(5000);

    expect(dccFileService.parseSendOffer('hello')).toBeNull();
  });

  it('handles offer, list and cancel lifecycle', () => {
    const transfer = dccFileService.handleOffer('nick', 'net1', {
      filename: 'a.txt',
      host: '8.8.8.8',
      port: 5001,
      size: 10,
    });

    expect(dccFileService.list().some(t => t.id === transfer.id)).toBe(true);

    dccFileService.cancel(transfer.id);
    const cancelled = dccFileService.list().find(t => t.id === transfer.id);
    expect(cancelled?.status).toBe('cancelled');
  });

  it('blocks private/local IP transfer when protection is enabled', async () => {
    mockGetSetting.mockImplementation(async (key: string, def: any) => {
      if (key === 'dccBlockPrivateIp') return true;
      return def;
    });

    const transfer = dccFileService.handleOffer('nick', 'net1', {
      filename: 'a.txt',
      host: '127.0.0.1',
      port: 5001,
      size: 10,
    });

    const irc = { sendRaw: jest.fn() } as any;
    await dccFileService.accept(transfer.id, irc, '/mock/documents/a.txt');

    const failed = dccFileService.list().find(t => t.id === transfer.id);
    expect(failed?.status).toBe('failed');
    expect(String(failed?.error)).toContain('Connection blocked');
  });

  it('returns sanitized default download path', async () => {
    mockGetSetting.mockImplementation(async (key: string, def: any) => {
      if (key === 'dccDownloadFolder') return '/downloads';
      return def;
    });

    const path = await dccFileService.getDefaultDownloadPath('bad:name?.txt');
    expect(path).toBe('/downloads/bad_name_.txt');
  });

  it('validates sendFile input path before transfer start', async () => {
    const irc = { sendRaw: jest.fn() } as any;
    await expect(dccFileService.sendFile(irc, 'nick', 'net1', '')).rejects.toThrow('No file path provided');

    (RNFS as any).exists.mockResolvedValue(false);
    await expect(dccFileService.sendFile(irc, 'nick', 'net1', '/tmp/missing.txt')).rejects.toThrow('File not found');
  });
});
