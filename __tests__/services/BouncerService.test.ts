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

jest.mock('../../src/i18n/localization', () => ({
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

  it('logs an error when loading config fails', async () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const irc = makeIrcService();
    mockGetItem.mockRejectedValueOnce(new Error('storage boom'));
    const service = new BouncerService(irc as any);

    await service.initialize();

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to load bouncer config:',
      expect.any(Error),
    );
    // Defaults remain intact after a failed load
    expect(service.getConfig().type).toBe('auto');
    errorSpy.mockRestore();
  });

  it('routes messages and capabilities through bound IRC listeners', async () => {
    const irc = makeIrcService();
    mockGetItem.mockResolvedValueOnce(null);
    const service = new BouncerService(irc as any);
    await service.initialize();

    // capabilities listener -> updateCapabilities (line 96)
    irc.handlers.capabilities[0](['znc.in/playback']);
    expect(service.getBouncerInfo().type).toBe('znc');
    expect(service.getBouncerInfo().playbackSupported).toBe(true);

    // message listener -> handleMessage when playback handling is active (lines 89-90)
    (service as any).playbackStartTime = Date.now();
    irc.handlers.message[0]({
      type: 'message',
      text: 'old',
      timestamp: Date.now() - 4000,
      channel: '#a',
    });
    expect(service.isInPlaybackMode()).toBe(true);
  });

  it('does not handle messages via listener when playback is unsupported', async () => {
    const irc = makeIrcService();
    mockGetItem.mockResolvedValueOnce(null);
    const service = new BouncerService(irc as any);
    await service.initialize();

    // shouldHandlePlayback() is false (type still unknown), so handleMessage is skipped
    (service as any).playbackStartTime = Date.now();
    irc.handlers.message[0]({
      type: 'message',
      text: 'old',
      timestamp: Date.now() - 4000,
      channel: '#a',
    });
    expect(service.isInPlaybackMode()).toBe(false);
  });

  it('resets state and bouncer info on disconnect', async () => {
    const irc = makeIrcService();
    mockGetItem.mockResolvedValueOnce(null);
    const service = new BouncerService(irc as any);
    await service.initialize();

    // Get into playback so a playback timer exists (covers timer clear in resetPlaybackState)
    await service.setConfig({ enabled: true, handlePlayback: true });
    (service as any).bouncerInfo.type = 'znc';
    (service as any).bouncerInfo.playbackSupported = true;
    (service as any).playbackStartTime = Date.now();
    (service as any).handleMessage({
      type: 'message',
      text: 'old',
      timestamp: Date.now() - 4000,
      channel: '#a',
    });
    expect(service.isInPlaybackMode()).toBe(true);
    expect((service as any).playbackTimer).not.toBeNull();

    // Disconnect handler (lines 83, 112-113, 344-345)
    const connCb = irc.handlers.connection[0];
    connCb(false);

    expect(service.isInPlaybackMode()).toBe(false);
    expect(service.getBouncerInfo().type).toBe('unknown');
    expect(service.getBouncerInfo().playbackSupported).toBe(false);
    expect((service as any).playbackTimer).toBeNull();
  });

  it('detects a generic bouncer via capability hints', async () => {
    const irc = makeIrcService();
    const service = new BouncerService(irc as any);
    await service.initialize();
    (service as any).bouncerInfo.capabilities = ['some/bouncer-feature'];

    irc.handlers.connection[0](true);
    jest.advanceTimersByTime(2000);

    expect(service.getBouncerInfo().type).toBe('bnc');
    expect(service.getBouncerInfo().playbackSupported).toBe(false);
    expect(irc.addRawMessage).toHaveBeenCalled();
  });

  it('leaves bouncer type unknown when no signal is present', async () => {
    const irc = makeIrcService();
    const service = new BouncerService(irc as any);
    await service.initialize();
    (service as any).bouncerInfo.capabilities = ['sasl', 'multi-prefix'];

    irc.handlers.connection[0](true);
    jest.advanceTimersByTime(2000);

    expect(service.getBouncerInfo().type).toBe('unknown');
    expect(service.getBouncerInfo().playbackSupported).toBe(false);
    expect(irc.addRawMessage).not.toHaveBeenCalled();
  });

  it('uses the configured type when detection is not auto', async () => {
    const irc = makeIrcService();
    const service = new BouncerService(irc as any);
    await service.initialize();
    await service.setConfig({ type: 'bnc' });

    irc.handlers.connection[0](true);
    jest.advanceTimersByTime(2000);

    expect(service.getBouncerInfo().type).toBe('bnc');
    expect(irc.addRawMessage).toHaveBeenCalled();
  });

  it('skips playback messages older than the configured age limit', async () => {
    const service = new BouncerService(makeIrcService() as any);
    await service.setConfig({
      enabled: true,
      handlePlayback: true,
      type: 'znc',
      skipOldPlayback: true,
      playbackAgeLimit: 1,
      markPlaybackMessages: true,
    });
    (service as any).bouncerInfo.type = 'znc';
    (service as any).bouncerInfo.playbackSupported = true;
    (service as any).playbackStartTime = Date.now();

    const oldMessage: any = {
      type: 'message',
      text: 'ancient',
      timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours old, limit is 1
      channel: '#a',
    };
    (service as any).handleMessage(oldMessage);

    // Message entered playback but was skipped before being marked
    expect(service.isInPlaybackMode()).toBe(true);
    expect(oldMessage.isPlayback).toBeUndefined();
    expect(oldMessage.playbackIndicator).toBeUndefined();
  });

  it('falls back to current playback flag when timing window is closed', async () => {
    const service = new BouncerService(makeIrcService() as any);
    await service.setConfig({
      enabled: true,
      handlePlayback: true,
      type: 'znc',
      playbackTimeout: 1000,
    });
    (service as any).bouncerInfo.type = 'znc';
    (service as any).bouncerInfo.playbackSupported = true;
    // Connection is far older than playbackTimeout * 2 -> first branch is false (line 276)
    (service as any).playbackStartTime = Date.now() - 100000;

    (service as any).handleMessage({
      type: 'message',
      text: 'recent',
      timestamp: Date.now() - 500,
      channel: '#a',
    });

    // Not in playback and window closed -> treated as non-playback
    expect(service.isInPlaybackMode()).toBe(false);
  });

  it('requests and clears playback for all channels', async () => {
    const irc = makeIrcService();
    const service = new BouncerService(irc as any);
    await service.setConfig({
      enabled: true,
      handlePlayback: true,
      type: 'znc',
    });
    (service as any).bouncerInfo.type = 'znc';
    (service as any).bouncerInfo.playbackSupported = true;

    service.requestPlayback();
    service.clearPlayback();

    expect(irc.sendRaw).toHaveBeenCalledWith('PRIVMSG *playback :play *');
    expect(irc.sendRaw).toHaveBeenCalledWith('PRIVMSG *playback :clear *');
  });

  it('warns and does nothing when clearing playback while unsupported', () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const irc = makeIrcService();
    const service = new BouncerService(irc as any);

    service.clearPlayback('#a');

    expect(warnSpy).toHaveBeenCalledWith(
      'BouncerService: Playback not supported',
    );
    expect(irc.sendRaw).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('unsubscribes a playback listener via the returned function', () => {
    const service = new BouncerService(makeIrcService() as any);
    const calls: boolean[] = [];
    const unsubscribe = service.onPlaybackChange(on => calls.push(on));

    unsubscribe();

    (service as any).notifyPlaybackListeners(true);
    expect(calls).toEqual([]);
  });

  it('isolates errors thrown by playback listeners', () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const service = new BouncerService(makeIrcService() as any);
    const good: boolean[] = [];
    service.onPlaybackChange(() => {
      throw new Error('listener boom');
    });
    service.onPlaybackChange(on => good.push(on));

    (service as any).notifyPlaybackListeners(true);

    expect(errorSpy).toHaveBeenCalledWith(
      'Error in playback listener:',
      expect.any(Error),
    );
    expect(good).toEqual([true]);
    errorSpy.mockRestore();
  });

  it('logs an error when saving config fails', async () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockSetItem.mockRejectedValueOnce(new Error('write boom'));
    const service = new BouncerService(makeIrcService() as any);

    await service.setConfig({ enabled: false });

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to save bouncer config:',
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});
