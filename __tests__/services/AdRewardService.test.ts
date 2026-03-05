/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockStorage = new Map<string, string>();

jest.unmock('../../src/services/AdRewardService');

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => (mockStorage.has(key) ? mockStorage.get(key)! : null)),
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
  });

  afterEach(() => {
    (adRewardService as any).stopUsageTracking();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('returns manualLoadAd status branches', async () => {
    (adRewardService as any).adsDisabled = true;
    await expect(adRewardService.manualLoadAd()).resolves.toEqual(expect.objectContaining({ success: false }));

    (adRewardService as any).adsDisabled = false;
    (adRewardService as any).cooldownEndTime = Date.now() + 5000;
    const cooldown = await adRewardService.manualLoadAd();
    expect(cooldown.success).toBe(false);
    expect(cooldown.messageParams?.seconds).toBeGreaterThan(0);

    (adRewardService as any).cooldownEndTime = 0;
    (adRewardService as any).adLoaded = true;
    await expect(adRewardService.manualLoadAd()).resolves.toEqual(expect.objectContaining({ success: true }));

    (adRewardService as any).adLoaded = false;
    (adRewardService as any).adLoading = true;
    await expect(adRewardService.manualLoadAd()).resolves.toEqual(expect.objectContaining({ success: false }));

    (adRewardService as any).adLoading = false;
    const loadSpy = jest.spyOn(adRewardService as any, 'loadAd').mockImplementation(() => undefined);
    await expect(adRewardService.manualLoadAd()).resolves.toEqual(expect.objectContaining({ success: true }));
    expect(loadSpy).toHaveBeenCalled();
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
});
