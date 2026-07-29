/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockStorage = new Map<string, string>();

jest.unmock('../../src/services/AdRewardService');

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) =>
      mockStorage.has(key) ? mockStorage.get(key)! : null,
    ),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

const mockRewardedAd = {
  addAdEventListener: jest.fn(() => jest.fn()),
  load: jest.fn(),
  show: jest.fn(async () => undefined),
};

jest.mock('react-native-google-mobile-ads', () => ({
  AdEventType: { ERROR: 'error' },
  RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned' },
  TestIds: { REWARDED: 'test-rewarded' },
  RewardedAd: {
    createForAdRequest: jest.fn(() => mockRewardedAd),
  },
}));

jest.mock('../../src/services/ConsentService', () => ({
  consentService: {
    canShowPersonalizedAds: jest.fn(() => false),
    getConsentStatusText: jest.fn(() => 'Accepted'),
  },
}));

jest.mock('../../src/services/BannerAdService', () => ({
  bannerAdService: {},
}));

const mockHasUnlimitedScripting = jest.fn(() => false);
jest.mock('../../src/services/InAppPurchaseService', () => ({
  inAppPurchaseService: {
    hasUnlimitedScripting: () => mockHasUnlimitedScripting(),
  },
}));

import { adRewardService } from '../../src/services/AdRewardService';
import {
  AdEventType,
  RewardedAdEventType,
  RewardedAd,
} from 'react-native-google-mobile-ads';

describe('AdRewardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockStorage.clear();

    (adRewardService as any).rewardedAd = mockRewardedAd;
    (adRewardService as any).adLoaded = false;
    (adRewardService as any).adLoading = false;
    (adRewardService as any).cooldownEndTime = 0;
    (adRewardService as any).adsDisabled = false;
    (adRewardService as any).remainingMs = 5 * 60 * 1000;
    (adRewardService as any).usageInterval = null;
    (adRewardService as any).initialized = false;
    (adRewardService as any).initialLoadTimeoutId = null;
    (adRewardService as any).adEventUnsubscribers = [];
    (adRewardService as any).currentAdUnitIndex = 0;
    (adRewardService as any).retryCount = 0;
    (adRewardService as any).consecutiveFailures = 0;
    (adRewardService as any).lastError = null;
  });

  afterEach(() => {
    (adRewardService as any).stopUsageTracking();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('returns manualLoadAd status branches', async () => {
    (adRewardService as any).adsDisabled = true;
    await expect(adRewardService.manualLoadAd()).resolves.toEqual(
      expect.objectContaining({ success: false }),
    );

    (adRewardService as any).adsDisabled = false;
    (adRewardService as any).cooldownEndTime = Date.now() + 5000;
    const cooldown = await adRewardService.manualLoadAd();
    expect(cooldown.success).toBe(false);
    expect(cooldown.messageParams?.seconds).toBeGreaterThan(0);

    (adRewardService as any).cooldownEndTime = 0;
    (adRewardService as any).adLoaded = true;
    await expect(adRewardService.manualLoadAd()).resolves.toEqual(
      expect.objectContaining({ success: true }),
    );

    (adRewardService as any).adLoaded = false;
    (adRewardService as any).adLoading = true;
    await expect(adRewardService.manualLoadAd()).resolves.toEqual(
      expect.objectContaining({ success: false }),
    );

    (adRewardService as any).adLoading = false;
    const loadSpy = jest
      .spyOn(adRewardService as any, 'loadAd')
      .mockImplementation(() => undefined);
    await expect(adRewardService.manualLoadAd()).resolves.toEqual(
      expect.objectContaining({ success: true }),
    );
    expect(loadSpy).toHaveBeenCalled();
    loadSpy.mockRestore();
  });

  it('shows rewarded ad and handles not-ready/error paths', async () => {
    (adRewardService as any).rewardedAd = null;
    await expect(adRewardService.showRewardedAd()).resolves.toBe(false);

    (adRewardService as any).rewardedAd = mockRewardedAd;
    (adRewardService as any).adLoaded = true;
    await expect(adRewardService.showRewardedAd()).resolves.toBe(true);
    expect(mockRewardedAd.show).toHaveBeenCalled();

    mockRewardedAd.show.mockRejectedValueOnce(new Error('show fail'));
    (adRewardService as any).adLoaded = true;
    await expect(adRewardService.showRewardedAd()).resolves.toBe(false);
  });

  it('reports ad status and time with unlimited scripting toggle', () => {
    (adRewardService as any).adLoaded = true;
    (adRewardService as any).adLoading = false;

    const status = adRewardService.getAdStatus();
    expect(status.ready).toBe(true);
    expect(status.loading).toBe(false);

    mockHasUnlimitedScripting.mockReturnValue(false);
    expect(adRewardService.getRemainingTime()).toBe(5 * 60 * 1000);

    mockHasUnlimitedScripting.mockReturnValue(true);
    expect(adRewardService.getRemainingTimeFormatted()).toBe('∞ Unlimited');
    expect(adRewardService.hasAvailableTime()).toBe(true);
  });

  it('tracks usage time and supports listener unsubscribe', () => {
    mockHasUnlimitedScripting.mockReturnValue(false);
    (adRewardService as any).remainingMs = 2000;

    const listener = jest.fn();
    const off = adRewardService.addListener(listener);

    adRewardService.startUsageTracking();
    jest.advanceTimersByTime(1100);

    expect(adRewardService.isTracking()).toBe(true);
    expect(listener).toHaveBeenCalled();
    expect((adRewardService as any).remainingMs).toBeLessThan(2000);

    off();
    const calledBefore = listener.mock.calls.length;
    jest.advanceTimersByTime(1100);
    expect(listener.mock.calls.length).toBe(calledBefore);

    adRewardService.stopUsageTracking();
    expect(adRewardService.isTracking()).toBe(false);
  });

  it('initializes, grants initial/version bonuses and starts first ad load timer', async () => {
    const handlers: Record<string, Function> = {};
    mockRewardedAd.addAdEventListener.mockImplementation(
      (type: string, cb: Function) => {
        handlers[type] = cb;
        return jest.fn();
      },
    );

    await adRewardService.initialize();
    expect((adRewardService as any).initialized).toBe(true);
    expect((adRewardService as any).remainingMs).toBeGreaterThan(0);

    jest.advanceTimersByTime(2001);
    expect(mockRewardedAd.load).toHaveBeenCalled();

    handlers[RewardedAdEventType.LOADED]?.();
    expect((adRewardService as any).adLoaded).toBe(true);
    handlers[RewardedAdEventType.EARNED_REWARD]?.({
      amount: 60,
      type: 'minutes',
    });
    jest.advanceTimersByTime(2001);
    expect(mockRewardedAd.load).toHaveBeenCalledTimes(2);
  });

  it('loadAd handles timeout and ad error path', () => {
    (adRewardService as any).adLoaded = false;
    (adRewardService as any).adLoading = false;
    (adRewardService as any).rewardedAd = mockRewardedAd;
    (adRewardService as any).loadAd();
    jest.advanceTimersByTime(45001);
    expect((adRewardService as any).adLoading).toBe(false);

    const handlers: Record<string, Function> = {};
    mockRewardedAd.addAdEventListener.mockImplementation(
      (type: string, cb: Function) => {
        handlers[type] = cb;
        return jest.fn();
      },
    );
    (adRewardService as any).setupRewardedAd();
    handlers[AdEventType.ERROR]?.({ code: 'x', message: 'm' });
    expect((adRewardService as any).adLoading).toBe(false);
    expect((adRewardService as any).adLoaded).toBe(false);
  });

  it('handleLoadError covers null-activity, internal-error and fallback/cooldown branches', () => {
    const setupSpy = jest
      .spyOn(adRewardService as any, 'setupRewardedAd')
      .mockImplementation(() => undefined);
    const loadSpy = jest
      .spyOn(adRewardService as any, 'loadAd')
      .mockImplementation(() => undefined);

    (adRewardService as any).adsDisabled = false;
    (adRewardService as any).consecutiveFailures = 0;
    (adRewardService as any).maxRetries = 2;
    (adRewardService as any).retryCount = 0;
    (adRewardService as any).currentAdUnitIndex = 0;

    (adRewardService as any).lastError = {
      code: 'googleMobileAds/null-activity',
      message: 'na',
    };
    (adRewardService as any).handleLoadError();
    jest.advanceTimersByTime(5001);
    expect(loadSpy).toHaveBeenCalled();

    (adRewardService as any).lastError = {
      code: 'googleMobileAds/internal-error',
      message: 'ie',
    };
    (adRewardService as any).handleLoadError();
    expect((adRewardService as any).isInCooldown()).toBe(true);
    jest.advanceTimersByTime(120001);
    expect(loadSpy).toHaveBeenCalled();

    (adRewardService as any).lastError = { code: 'other', message: 'e' };
    (adRewardService as any).retryCount = 1;
    (adRewardService as any).currentAdUnitIndex = 0;
    (adRewardService as any).handleLoadError();
    expect(setupSpy).toHaveBeenCalled();

    (adRewardService as any).retryCount = 1;
    (adRewardService as any).currentAdUnitIndex = 1;
    (adRewardService as any).consecutiveFailures = 9;
    (adRewardService as any).handleLoadError();
    expect((adRewardService as any).adsDisabled).toBe(true);

    setupSpy.mockRestore();
    loadSpy.mockRestore();
  });

  it('supports debug/admin helpers and listener error guard', async () => {
    const badListener = jest.fn(() => {
      throw new Error('listener');
    });
    adRewardService.addListener(badListener);
    (adRewardService as any).notifyListeners();
    expect(badListener).toHaveBeenCalled();

    await adRewardService.grantTime(1);
    expect((adRewardService as any).remainingMs).toBeGreaterThan(0);
    await adRewardService.resetTime();
    expect((adRewardService as any).remainingMs).toBe(0);

    await adRewardService.simulateFreshInstall();
    expect((adRewardService as any).remainingMs).toBeGreaterThan(0);
  });

  it('setupRewardedAd handles createForAdRequest failure and cleanup listeners', () => {
    const unsubscribeA = jest.fn();
    const unsubscribeB = jest.fn();
    (adRewardService as any).adEventUnsubscribers = [
      unsubscribeA,
      unsubscribeB,
    ];
    (adRewardService as any).initialLoadTimeoutId = setTimeout(
      () => undefined,
      1000,
    );

    const createSpy = jest
      .spyOn(RewardedAd, 'createForAdRequest')
      .mockImplementationOnce(() => {
        throw new Error('create fail');
      });

    expect(() => (adRewardService as any).setupRewardedAd()).not.toThrow();
    expect(unsubscribeA).toHaveBeenCalled();
    expect(unsubscribeB).toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it('returns early when already initialized', async () => {
    (adRewardService as any).initialized = true;
    const loadSpy = jest
      .spyOn(adRewardService as any, 'load')
      .mockResolvedValue(undefined);
    await adRewardService.initialize();
    expect(loadSpy).not.toHaveBeenCalled();
    loadSpy.mockRestore();
  });

  it('grants safety bonus during initialize when stored time is zero', async () => {
    const { APP_VERSION } = require('../../src/config/appVersion');
    mockStorage.set(
      '@AndroidIRCX:scriptingTime',
      JSON.stringify({ remainingMs: 0, lastUpdated: Date.now() }),
    );
    mockStorage.set('@AndroidIRCX:initialBonusGranted', 'true');
    mockStorage.set('@AndroidIRCX:versionBonusApplied', APP_VERSION);
    (adRewardService as any).initialized = false;

    const setupSpy = jest
      .spyOn(adRewardService as any, 'setupRewardedAd')
      .mockImplementation(() => undefined);

    await adRewardService.initialize();

    // Safety bonus is 30 minutes because remaining time was 0
    expect((adRewardService as any).remainingMs).toBe(30 * 60 * 1000);
    setupSpy.mockRestore();
  });

  it('load() recovers with 1 hour on parse/read error', async () => {
    // Invalid JSON forces JSON.parse to throw inside the try block
    mockStorage.set('@AndroidIRCX:scriptingTime', 'not-valid-json{');
    mockStorage.set('@AndroidIRCX:initialBonusGranted', 'true');
    (adRewardService as any).remainingMs = 0;

    await (adRewardService as any).load();

    expect((adRewardService as any).remainingMs).toBe(60 * 60 * 1000);
  });

  it('applyVersionBonus swallows storage errors', async () => {
    const AsyncStorageMock = require('@react-native-async-storage/async-storage').default;
    AsyncStorageMock.getItem.mockRejectedValueOnce(new Error('read fail'));
    await expect(
      (adRewardService as any).applyVersionBonus(),
    ).resolves.toBeUndefined();
  });

  it('save swallows storage errors', async () => {
    const AsyncStorageMock = require('@react-native-async-storage/async-storage').default;
    AsyncStorageMock.setItem.mockRejectedValueOnce(new Error('write fail'));
    await expect((adRewardService as any).save()).resolves.toBeUndefined();
  });

  it('clears an existing load timeout when an ad error fires', () => {
    const handlers: Record<string, Function> = {};
    mockRewardedAd.addAdEventListener.mockImplementation(
      (type: string, cb: Function) => {
        handlers[type] = cb;
        return jest.fn();
      },
    );
    const handleSpy = jest
      .spyOn(adRewardService as any, 'handleLoadError')
      .mockImplementation(() => undefined);
    (RewardedAd.createForAdRequest as jest.Mock).mockReturnValue(mockRewardedAd);

    (adRewardService as any).setupRewardedAd();
    (adRewardService as any).loadTimeoutId = setTimeout(() => undefined, 1000);

    handlers[AdEventType.ERROR]?.({ code: 'boom', message: 'oops' });

    expect((adRewardService as any).loadTimeoutId).toBeNull();
    expect(handleSpy).toHaveBeenCalled();
    handleSpy.mockRestore();
  });

  it('cleans up a pending initial load timeout and schedules a fresh one', () => {
    mockRewardedAd.addAdEventListener.mockImplementation(() => jest.fn());
    (RewardedAd.createForAdRequest as jest.Mock).mockReturnValue(mockRewardedAd);
    const previous = setTimeout(() => undefined, 10000);
    (adRewardService as any).initialLoadTimeoutId = previous;

    (adRewardService as any).setupRewardedAd();

    // cleanupAdListeners() clears the old timeout, then a fresh one is scheduled
    expect((adRewardService as any).initialLoadTimeoutId).not.toBe(previous);
    expect((adRewardService as any).initialLoadTimeoutId).not.toBeNull();
  });

  it('loadAd handles load() throwing synchronously', () => {
    (adRewardService as any).adLoaded = false;
    (adRewardService as any).adLoading = false;
    (adRewardService as any).rewardedAd = mockRewardedAd;
    (adRewardService as any).loadTimeoutId = setTimeout(() => undefined, 1000);

    const handleSpy = jest
      .spyOn(adRewardService as any, 'handleLoadError')
      .mockImplementation(() => undefined);
    mockRewardedAd.load.mockImplementationOnce(() => {
      throw new Error('load fail');
    });

    (adRewardService as any).loadAd();

    expect((adRewardService as any).adLoading).toBe(false);
    expect((adRewardService as any).loadTimeoutId).toBeNull();
    expect(handleSpy).toHaveBeenCalled();
    handleSpy.mockRestore();
  });

  it('handleLoadError cools down and retries when all ad units fail', () => {
    const setupSpy = jest
      .spyOn(adRewardService as any, 'setupRewardedAd')
      .mockImplementation(() => undefined);

    (adRewardService as any).adsDisabled = false;
    (adRewardService as any).consecutiveFailures = 0;
    (adRewardService as any).maxRetries = 1;
    (adRewardService as any).retryCount = 0;
    (adRewardService as any).currentAdUnitIndex = 1; // last (fallback) unit
    (adRewardService as any).lastError = { code: 'other', message: 'e' };

    (adRewardService as any).handleLoadError();
    expect((adRewardService as any).isInCooldown()).toBe(true);

    jest.advanceTimersByTime(60001);
    expect(setupSpy).toHaveBeenCalled();
    expect((adRewardService as any).currentAdUnitIndex).toBe(0);
    expect((adRewardService as any).cooldownEndTime).toBe(0);
    setupSpy.mockRestore();
  });

  it('handleLoadError cooldown callback aborts when failures pile up', () => {
    const setupSpy = jest
      .spyOn(adRewardService as any, 'setupRewardedAd')
      .mockImplementation(() => undefined);

    (adRewardService as any).adsDisabled = false;
    (adRewardService as any).consecutiveFailures = 0;
    (adRewardService as any).maxRetries = 1;
    (adRewardService as any).retryCount = 0;
    (adRewardService as any).currentAdUnitIndex = 1;
    (adRewardService as any).lastError = { code: 'other', message: 'e' };

    (adRewardService as any).handleLoadError();
    // Simulate hitting the hard failure ceiling before the cooldown elapses
    (adRewardService as any).consecutiveFailures = 10;

    jest.advanceTimersByTime(60001);
    // Callback returned early, so no fresh setup happened
    expect(setupSpy).not.toHaveBeenCalled();
    setupSpy.mockRestore();
  });

  it('showRewardedAd timer bails out when ad already consumed', async () => {
    (adRewardService as any).rewardedAd = mockRewardedAd;
    (adRewardService as any).adLoaded = true;
    const loadSpy = jest
      .spyOn(adRewardService as any, 'loadAd')
      .mockImplementation(() => undefined);

    await expect(adRewardService.showRewardedAd()).resolves.toBe(true);

    // Ad got consumed elsewhere before the 5s timer fires
    (adRewardService as any).adLoaded = false;
    jest.advanceTimersByTime(5001);
    expect(loadSpy).not.toHaveBeenCalled();
    loadSpy.mockRestore();
  });

  it('exposes ready/loading/cooldown getters', () => {
    (adRewardService as any).adLoaded = true;
    (adRewardService as any).adLoading = true;
    expect(adRewardService.isAdReady()).toBe(true);
    expect(adRewardService.isAdLoading()).toBe(true);

    (adRewardService as any).cooldownEndTime = Date.now() + 5000;
    expect(adRewardService.getCooldownRemaining()).toBeGreaterThan(0);
  });

  it('returns unlimited-scripting values from time getters', () => {
    mockHasUnlimitedScripting.mockReturnValue(true);
    expect(adRewardService.getRemainingTime()).toBe(999 * 60 * 60 * 1000);
  });

  it('formats remaining time and reports availability without unlimited scripting', () => {
    mockHasUnlimitedScripting.mockReturnValue(false);
    (adRewardService as any).remainingMs = 2 * 60 * 1000; // 2 minutes

    expect(adRewardService.getRemainingTimeFormatted()).toBe('2m 0s');
    expect(adRewardService.hasAvailableTime()).toBe(true);

    (adRewardService as any).remainingMs = 0;
    expect(adRewardService.hasAvailableTime()).toBe(false);
  });

  it('formats remaining time with hours', () => {
    mockHasUnlimitedScripting.mockReturnValue(false);
    (adRewardService as any).remainingMs = 60 * 60 * 1000 + 5 * 60 * 1000;
    expect(adRewardService.getRemainingTimeFormatted()).toBe('1h 5m');
  });

  it('startUsageTracking enables no-ads mode without countdown for unlimited users', () => {
    mockHasUnlimitedScripting.mockReturnValue(true);
    (adRewardService as any).usageInterval = null;
    (adRewardService as any).remainingMs = 1000;

    adRewardService.startUsageTracking();
    expect(adRewardService.isTracking()).toBe(true);

    jest.advanceTimersByTime(2000);
    // Dummy interval is a no-op: time is not decremented
    expect((adRewardService as any).remainingMs).toBe(1000);
    mockHasUnlimitedScripting.mockReturnValue(false);
  });

  it('stops tracking when user upgrades to unlimited mid-session', () => {
    mockHasUnlimitedScripting.mockReturnValue(false);
    (adRewardService as any).usageInterval = null;
    (adRewardService as any).remainingMs = 5000;

    adRewardService.startUsageTracking();
    expect(adRewardService.isTracking()).toBe(true);

    mockHasUnlimitedScripting.mockReturnValue(true);
    jest.advanceTimersByTime(1001);
    expect(adRewardService.isTracking()).toBe(false);
    mockHasUnlimitedScripting.mockReturnValue(false);
  });

  it('stops tracking when remaining time is exhausted', () => {
    mockHasUnlimitedScripting.mockReturnValue(false);
    (adRewardService as any).usageInterval = null;
    (adRewardService as any).remainingMs = 0;

    adRewardService.startUsageTracking();
    expect(adRewardService.isTracking()).toBe(true);

    jest.advanceTimersByTime(1001);
    expect(adRewardService.isTracking()).toBe(false);
  });

  it('covers fallback ad-unit, personalized-ads and default-reward branches', () => {
    const { consentService } = require('../../src/services/ConsentService');
    consentService.canShowPersonalizedAds.mockReturnValue(true);
    (RewardedAd.createForAdRequest as jest.Mock).mockReturnValue(mockRewardedAd);

    const handlers: Record<string, Function> = {};
    mockRewardedAd.addAdEventListener.mockImplementation(
      (type: string, cb: Function) => {
        handlers[type] = cb;
        return jest.fn();
      },
    );
    const loadSpy = jest
      .spyOn(adRewardService as any, 'loadAd')
      .mockImplementation(() => undefined);
    const handleSpy = jest
      .spyOn(adRewardService as any, 'handleLoadError')
      .mockImplementation(() => undefined);

    // Use the fallback ad unit so 'Fallback' placement branches are hit
    (adRewardService as any).currentAdUnitIndex = 1;
    (adRewardService as any).setupRewardedAd();

    // LOADED handler on the fallback unit
    handlers[RewardedAdEventType.LOADED]?.();
    expect((adRewardService as any).adLoaded).toBe(true);

    // EARNED_REWARD with a falsy amount falls back to the default 60 minutes
    const before = (adRewardService as any).remainingMs;
    handlers[RewardedAdEventType.EARNED_REWARD]?.({ amount: 0, type: 'coins' });
    expect((adRewardService as any).remainingMs).toBe(before + 60 * 60 * 1000);

    // ERROR with no code/message exercises the ?? fallbacks
    handlers[AdEventType.ERROR]?.({});
    expect((adRewardService as any).lastError.code).toBe('unknown');

    // getAdStatus reports the fallback unit type
    expect(adRewardService.getAdStatus().adUnitType).toBe('Fallback');

    consentService.canShowPersonalizedAds.mockReturnValue(false);
    loadSpy.mockRestore();
    handleSpy.mockRestore();
  });
});
