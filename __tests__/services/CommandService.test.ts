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

  it('loads persisted aliases and custom commands during initialize', async () => {
    AsyncStorage.__reset?.();
    AsyncStorage.getItem.mockImplementation(async (key: string) => {
      if (key === '@AndroidIRCX:commandAliases') {
        return JSON.stringify([{ alias: 'foo', command: '/foo' }]);
      }
      if (key === '@AndroidIRCX:customCommands') {
        return JSON.stringify([{ name: 'bar', command: '/bar' }]);
      }
      return null;
    });

    const s = new CommandService();
    s.setIRCService({ sendRaw, getCurrentNick } as any);
    await s.initialize();

    expect(s.getAlias('foo')).toEqual(
      expect.objectContaining({ command: '/foo' }),
    );
    expect(s.getCustomCommand('bar')).toEqual(
      expect.objectContaining({ command: '/bar' }),
    );
  });

  it('survives storage read errors during initialize', async () => {
    AsyncStorage.__reset?.();
    AsyncStorage.getItem.mockImplementation(async () => {
      throw new Error('storage down');
    });

    const s = new CommandService();
    s.setIRCService({ sendRaw, getCurrentNick } as any);
    await expect(s.initialize()).resolves.toBeUndefined();

    // Default aliases still get installed
    expect(s.getAlias('j')).toBeTruthy();
  });

  it('shows usage message when /hop has no channel', async () => {
    const result = await service.processCommand('/hop');
    expect(result).toBeNull();
    expect(localMessage).toHaveBeenCalledWith(
      expect.stringContaining('Usage: /hop'),
    );
  });

  it('/hop uses the current channel when first arg is a reason', async () => {
    const result = await service.processCommand('/hop leaving now', '#cur');
    expect(result).toBeNull();
    expect(sendRaw).toHaveBeenNthCalledWith(1, 'PART #cur :leaving now');

    jest.advanceTimersByTime(250);
    expect(sendRaw).toHaveBeenNthCalledWith(2, 'JOIN #cur');
  });

  it('returns the command unchanged when an alias resolves to itself', async () => {
    await service.addAlias({ alias: 'self', command: '/self' });
    const result = await service.processCommand('/self');
    expect(result).toBe('/self');
  });

  it('aborts cyclic alias expansion (A -> B -> A) instead of overflowing the stack', async () => {
    await service.addAlias({ alias: 'a', command: '/b' });
    await service.addAlias({ alias: 'b', command: '/a' });

    const result = await service.processCommand('/a');

    expect(result).toBeNull();
    expect(localMessage).toHaveBeenCalledWith(
      expect.stringContaining('Alias loop detected'),
    );
  });

  it('aborts an alias chain that exceeds the maximum expansion depth', async () => {
    // Chain a0 -> a1 -> ... -> a30, longer than MAX_ALIAS_DEPTH (20).
    for (let i = 0; i < 30; i++) {
      await service.addAlias({ alias: `a${i}`, command: `/a${i + 1}` });
    }

    const result = await service.processCommand('/a0');

    expect(result).toBeNull();
    expect(localMessage).toHaveBeenCalledWith(
      expect.stringContaining('Alias loop detected'),
    );
  });

  it('executes a non-quote custom command with placeholder substitution', async () => {
    await service.addCustomCommand({
      name: 'greet',
      command: '/me greets {param} in {channel} as {nick}',
      parameters: ['param'],
    });

    const result = await service.processCommand('/greet World', '#room');
    expect(result).toBe('/me greets World in #room as TestNick');
  });

  it('resolves alias templates: channel, nick, param, and rest placeholders', async () => {
    // {channel} taken from the current channel
    expect(await service.processCommand('/zncplay', '#c1')).toBe(
      '/znc playbuffer #c1',
    );
    // {channel} taken from args when no current channel
    expect(await service.processCommand('/zncplay #foo')).toBe(
      '/znc playbuffer #foo',
    );
    // {channel} resolves empty when neither current channel nor args exist
    expect(await service.processCommand('/zncplay')).toBe('/znc playbuffer');
    // {nick} taken from args when provided
    expect(await service.processCommand('/oper bob secret')).toBe(
      '/oper bob secret',
    );
    // {nick} falls back to the current nick, {password} resolves empty
    expect(await service.processCommand('/nsghost')).toBe(
      '/msg NickServ GHOST TestNick',
    );

    // {paramN} indexed placeholders
    await service.addAlias({ alias: 'pp', command: '/foo {param2} {param1}' });
    expect(await service.processCommand('/pp aa bb')).toBe('/foo bb aa aa bb');

    // Generic placeholders: first consumes one arg, last joins the rest
    await service.addAlias({ alias: 'xy', command: '/dest {a} {b}' });
    expect(await service.processCommand('/xy 1 2 3')).toBe('/dest 1 2 3');
  });

  it('normalizes legacy history on read and honors the limit argument', () => {
    (service as any).commandHistory = [{ command: '/legacy', timestamp: 1 }];

    const history = service.getHistory(1);
    expect(history).toHaveLength(1);
    expect(history[0].id).toBeTruthy();
  });

  it('trims history to MAX_HISTORY entries', async () => {
    for (let i = 0; i < 105; i++) {
      await service.processCommand('/quote CMD' + i);
    }
    expect(service.getHistory().length).toBe(100);
  });

  it('manages aliases and custom commands (add/get/list/remove)', async () => {
    await service.addAlias({ alias: 'xx', command: '/xxx', description: 'd' });
    expect(service.getAlias('xx')).toEqual(
      expect.objectContaining({ command: '/xxx' }),
    );
    expect(service.getAliases().some(a => a.alias === 'xx')).toBe(true);
    await service.removeAlias('xx');
    expect(service.getAlias('xx')).toBeUndefined();

    await service.addCustomCommand({ name: 'cc', command: '/cc' });
    expect(service.getCustomCommand('cc')).toEqual(
      expect.objectContaining({ command: '/cc' }),
    );
    expect(service.getCustomCommands().some(c => c.name === 'cc')).toBe(true);
    await service.removeCustomCommand('cc');
    expect(service.getCustomCommand('cc')).toBeUndefined();
  });

  it('swallows storage write errors when saving aliases/commands/history', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('x'));
    await expect(
      service.addAlias({ alias: 'z', command: '/zzz' }),
    ).resolves.toBeUndefined();

    AsyncStorage.setItem.mockRejectedValueOnce(new Error('x'));
    await expect(
      service.addCustomCommand({ name: 'cx', command: '/cx' }),
    ).resolves.toBeUndefined();

    AsyncStorage.setItem.mockRejectedValueOnce(new Error('x'));
    await expect(service.processCommand('/quote PING')).resolves.toBeNull();
  });

  it('handles invalid certificate fingerprint for /certfp', async () => {
    service.setCurrentNetworkCert('-----BEGIN CERTIFICATE-----TEST');
    mockExtractFingerprintFromPem.mockReturnValue(null);

    const result = await service.processCommand('/certfp');
    expect(result).toBeNull();
    expect(localMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to extract'),
    );
  });

  it('handles /certadd without a configured certificate', async () => {
    const result = await service.processCommand('/certadd');
    expect(result).toBeNull();
    expect(localMessage).toHaveBeenCalledWith(
      expect.stringContaining('No certificate configured'),
    );
  });

  it('handles invalid fingerprint for /certadd', async () => {
    service.setCurrentNetworkCert('-----BEGIN CERTIFICATE-----TEST');
    mockExtractFingerprintFromPem.mockReturnValue(null);

    const result = await service.processCommand('/certadd Atheme');
    expect(result).toBeNull();
    expect(localMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send'),
    );
  });

  it('shows an error for /ban without a channel', async () => {
    const result = await service.processCommand('/ban badUser');
    expect(result).toBeNull();
    expect(localMessage).toHaveBeenCalledWith(
      expect.stringContaining('No channel specified'),
    );
  });

  it('applies /ban except, invite, and quiet switches', async () => {
    await service.processCommand(
      '/ban -rbeiq #chan target 2 reason here',
      '#chan',
    );

    expect(sendRaw).toHaveBeenCalledWith('MODE #chan +b *!*@target');
    expect(sendRaw).toHaveBeenCalledWith('MODE #chan +e *!*@target');
    expect(sendRaw).toHaveBeenCalledWith('MODE #chan +I *!*@target');
    expect(sendRaw).toHaveBeenCalledWith('MODE #chan +q *!*@target');
  });
});
