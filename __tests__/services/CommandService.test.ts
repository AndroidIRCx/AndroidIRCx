/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CommandService } from '../../src/services/CommandService';
const AsyncStorage = require('@react-native-async-storage/async-storage');

const mockExtractFingerprintFromPem = jest.fn();
const mockFormatFingerprint = jest.fn();

jest.mock('../../src/services/CertificateManagerService', () => ({
  certificateManager: {
    extractFingerprintFromPem: (...args: unknown[]) =>
      mockExtractFingerprintFromPem(...args),
    formatFingerprint: (...args: unknown[]) => mockFormatFingerprint(...args),
  },
}));

describe('CommandService', () => {
  let service: CommandService;
  let sendRaw: jest.Mock;
  let getCurrentNick: jest.Mock;
  let localMessage: jest.Mock;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    AsyncStorage.__reset?.();

    service = new CommandService();
    sendRaw = jest.fn();
    getCurrentNick = jest.fn().mockReturnValue('TestNick');
    localMessage = jest.fn();

    service.setIRCService({ sendRaw, getCurrentNick } as any);
    service.setLocalMessageHandler(localMessage);
    await service.initialize();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns plain text as-is when input is not a command', async () => {
    const result = await service.processCommand('hello world', '#chan');
    expect(result).toBe('hello world');
  });

  it('processes /quote by sending raw command', async () => {
    const result = await service.processCommand(
      '/quote MODE #chan +m',
      '#chan',
    );

    expect(result).toBeNull();
    expect(sendRaw).toHaveBeenCalledWith('MODE #chan +m');
  });

  it('resolves default alias /j to /join', async () => {
    const result = await service.processCommand('/j #android', '#android');
    expect(result).toBe('/join #android');
  });

  it('executes custom /quote command with placeholder replacement', async () => {
    await service.addCustomCommand({
      name: 'opme',
      command: '/quote MODE {channel} +o {nick}',
      parameters: ['target'],
    });

    const result = await service.processCommand('/opme', '#android');

    expect(result).toBeNull();
    expect(sendRaw).toHaveBeenCalledWith('MODE #android +o TestNick');
  });

  it('handles /certfp without configured certificate', async () => {
    const result = await service.processCommand('/certfp');

    expect(result).toBeNull();
    expect(localMessage).toHaveBeenCalledWith(
      expect.stringContaining('No certificate configured'),
    );
  });

  it('handles /certfp with certificate and prints formatted fingerprint', async () => {
    mockExtractFingerprintFromPem.mockReturnValue('abc123');
    mockFormatFingerprint.mockReturnValue('AA:BB:CC');
    service.setCurrentNetworkCert('-----BEGIN CERTIFICATE-----TEST');

    const result = await service.processCommand('/certfp');

    expect(result).toBeNull();
    expect(mockExtractFingerprintFromPem).toHaveBeenCalled();
    expect(mockFormatFingerprint).toHaveBeenCalled();
    expect(localMessage).toHaveBeenCalledWith(
      expect.stringContaining('AA:BB:CC'),
    );
  });

  it('handles /certadd and sends fingerprint to default NickServ', async () => {
    mockExtractFingerprintFromPem.mockReturnValue('abc123');
    mockFormatFingerprint.mockReturnValue('AA:BB:CC');
    service.setCurrentNetworkCert('-----BEGIN CERTIFICATE-----TEST');

    const result = await service.processCommand('/certadd');

    expect(result).toBeNull();
    expect(sendRaw).toHaveBeenCalledWith('PRIVMSG NickServ :CERT ADD AA:BB:CC');
    expect(localMessage).toHaveBeenCalledWith(
      expect.stringContaining('sent to NickServ'),
    );
  });

  it('handles /hop by PART then delayed JOIN', async () => {
    const result = await service.processCommand(
      '/hop #android testing',
      '#ignored',
    );

    expect(result).toBeNull();
    expect(sendRaw).toHaveBeenNthCalledWith(1, 'PART #android :testing');

    jest.advanceTimersByTime(250);
    expect(sendRaw).toHaveBeenNthCalledWith(2, 'JOIN #android');
  });

  it('handles /ban with switches, kick and timed unban', async () => {
    const result = await service.processCommand(
      '/ban -ku #android badUser 2 flood',
      '#android',
    );

    expect(result).toBeNull();
    expect(sendRaw).toHaveBeenCalledWith('MODE #android +b *!*@badUser');
    expect(sendRaw).toHaveBeenCalledWith('KICK #android badUser :flood');

    jest.advanceTimersByTime(300000);
    expect(sendRaw).toHaveBeenCalledWith('MODE #android -b *!*@badUser');
  });

  it('saves, deletes and clears command history', async () => {
    await service.processCommand('/quote PING');
    await service.processCommand('/quote VERSION');

    const history = service.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].id).toBeTruthy();

    await service.deleteHistoryEntry(history[0].id);
    expect(service.getHistory()).toHaveLength(1);

    await service.clearHistory();
    expect(service.getHistory()).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      '@AndroidIRCX:commandHistory',
    );
  });

  it('normalizes legacy history entries without ids during initialize', async () => {
    AsyncStorage.__reset?.();
    AsyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === '@AndroidIRCX:commandHistory') {
        return JSON.stringify([{ command: '/quote PING', timestamp: 123 }]);
      }
      return null;
    });

    const anotherService = new CommandService();
    anotherService.setIRCService({ sendRaw, getCurrentNick } as any);
    await anotherService.initialize();

    const history = anotherService.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBeTruthy();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@AndroidIRCX:commandHistory',
      expect.any(String),
    );
  });
});
