/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: any[]) => mockGetItem(...args),
  setItem: (...args: any[]) => mockSetItem(...args),
}));

jest.mock('../../src/i18n/transifex', () => ({
  tx: {
    t: jest.fn((key: string, params?: Record<string, any>) => {
      if (!params) return key;
      return key
        .replace('{type}', params.type || '')
        .replace('{hint}', params.hint || '');
    }),
  },
}));

import { BouncerService } from '../../src/services/BouncerService';

describe('BouncerService', () => {
  const makeIrcService = () => {
    const handlers: Record<string, any[]> = {};
    return {
      onConnectionChange: jest.fn((cb: any) => {
        handlers.connection = handlers.connection || [];
        handlers.connection.push(cb);
      }),
      onMessage: jest.fn((cb: any) => {
        handlers.message = handlers.message || [];
        handlers.message.push(cb);
      }),
      on: jest.fn((event: string, cb: any) => {
        handlers[event] = handlers[event] || [];
        handlers[event].push(cb);
      }),
      sendRaw: jest.fn(),
      addRawMessage: jest.fn(),
      handlers,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads config on initialize and binds IRC listeners', async () => {
    const irc = makeIrcService();
    mockGetItem.mockResolvedValueOnce(
      JSON.stringify({ type: 'znc', playbackTimeout: 1234 }),
    );
    const service = new BouncerService(irc as any);

    await service.initialize();

    expect(service.getConfig().type).toBe('znc');
    expect(service.getConfig().playbackTimeout).toBe(1234);
    expect(irc.onConnectionChange).toHaveBeenCalled();
    expect(irc.onMessage).toHaveBeenCalled();
    expect(irc.on).toHaveBeenCalledWith('capabilities', expect.any(Function));
  });

  it('updates capabilities and auto-detects bouncer type', () => {
    const service = new BouncerService(makeIrcService() as any);

    service.updateCapabilities(['znc.in/playback']);
    expect(service.getBouncerInfo().type).toBe('znc');
    expect(service.getBouncerInfo().playbackSupported).toBe(true);

    service.updateCapabilities(['draft/chathistory']);
    expect(service.getBouncerInfo().type).toBe('unknown');

    service.updateCapabilities(['soju.im/bouncer-networks']);
    expect(service.getBouncerInfo().type).toBe('bnc');
  });

  it('saves config updates', async () => {
    const service = new BouncerService(makeIrcService() as any);

    await service.setConfig({ enabled: false, skipOldPlayback: true });

    expect(mockSetItem).toHaveBeenCalled();
    expect(service.getConfig().enabled).toBe(false);
    expect(service.getConfig().skipOldPlayback).toBe(true);
  });

  it('requests and clears playback only when playback handling is enabled', async () => {
    const irc = makeIrcService();
    const service = new BouncerService(irc as any);
    await service.setConfig({
      enabled: true,
      handlePlayback: true,
      type: 'znc',
    });
    (service as any).bouncerInfo.type = 'znc';
    (service as any).bouncerInfo.playbackSupported = true;

    service.requestPlayback('#a');
    service.clearPlayback('#a');
    expect(irc.sendRaw).toHaveBeenCalledWith('PRIVMSG *playback :play #a');
    expect(irc.sendRaw).toHaveBeenCalledWith('PRIVMSG *playback :clear #a');

    await service.setConfig({ enabled: false });
    service.requestPlayback('#b');
    expect(irc.sendRaw).toHaveBeenCalledTimes(2);
  });

  it('marks playback messages and exits playback after timeout', async () => {
    const service = new BouncerService(makeIrcService() as any);
    await service.setConfig({
      enabled: true,
      handlePlayback: true,
      type: 'znc',
      playbackTimeout: 1000,
    });
    (service as any).bouncerInfo.type = 'znc';
    (service as any).bouncerInfo.playbackSupported = true;
    (service as any).playbackStartTime = Date.now();

    const stateChanges: boolean[] = [];
    service.onPlaybackChange(on => stateChanges.push(on));

    (service as any).handleMessage({
      type: 'message',
      text: 'old',
      timestamp: Date.now() - 4000,
      channel: '#a',
    });

    expect(service.isInPlaybackMode()).toBe(true);
    expect(stateChanges).toContain(true);

    jest.advanceTimersByTime(1000);
    expect(service.isInPlaybackMode()).toBe(false);
    expect(stateChanges).toContain(false);
  });

  it('ignores batch-tagged messages for playback detection', async () => {
    const service = new BouncerService(makeIrcService() as any);
    await service.setConfig({
      enabled: true,
      handlePlayback: true,
      type: 'znc',
    });
    (service as any).bouncerInfo.type = 'znc';
    (service as any).bouncerInfo.playbackSupported = true;

    (service as any).handleMessage({
      type: 'message',
      text: 'history',
      timestamp: Date.now() - 2000,
      batchTag: 'batch-1',
    });

    expect(service.isInPlaybackMode()).toBe(false);
    expect(service.getPlaybackStats().messageCount).toBe(0);
  });

  it('detects bouncer after connect and emits connection hint message', async () => {
    const irc = makeIrcService();
    const service = new BouncerService(irc as any);
    await service.initialize();
    (service as any).bouncerInfo.capabilities = ['znc.in/playback'];

    const connCb = irc.handlers.connection[0];
    connCb(true);
    jest.advanceTimersByTime(2000);

    expect(service.getBouncerInfo().type).toBe('znc');
    expect(irc.addRawMessage).toHaveBeenCalled();
  });
});
