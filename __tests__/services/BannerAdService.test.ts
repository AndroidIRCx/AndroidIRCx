/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockHasNoAds = jest.fn(() => false);
const mockCanShowPersonalizedAds = jest.fn(() => true);

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: any[]) => mockGetItem(...args),
  setItem: (...args: any[]) => mockSetItem(...args),
}));

jest.mock('react-native-google-mobile-ads', () => ({
  BannerAd: 'BannerAd',
  BannerAdSize: {
    BANNER: 'BANNER',
  },
  TestIds: {
    BANNER: 'test-banner',
  },
}));

jest.mock('../../src/services/Logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../src/services/ConsentService', () => ({
  consentService: {
    canShowPersonalizedAds: (...args: any[]) => mockCanShowPersonalizedAds(...args),
  },
}));

jest.mock('../../src/services/InAppPurchaseService', () => ({
  inAppPurchaseService: {
    hasNoAds: (...args: any[]) => mockHasNoAds(...args),
  },
}));

import { bannerAdService } from '../../src/services/BannerAdService';

describe('BannerAdService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (bannerAdService as any).adFreeMs = 0;
    (bannerAdService as any).lastUpdated = Date.now();
    (bannerAdService as any).bannerVisible = false;
    (bannerAdService as any).showHideInterval = null;
    (bannerAdService as any).hideTimer = null;
    (bannerAdService as any).usageInterval = null;
    (bannerAdService as any).listeners = new Set();
    (bannerAdService as any).initialized = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes and loads persisted ad-free time', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ remainingMs: 60000, lastUpdated: 1234 }));

    await bannerAdService.initialize();

    expect(bannerAdService.getAdFreeTime()).toBe(60000);
    expect((bannerAdService as any).initialized).toBe(true);
  });

  it('starts show/hide cycle and toggles banner visibility', () => {
    const events: boolean[] = [];
    bannerAdService.addListener((visible) => events.push(visible));

    bannerAdService.startShowHideCycle();
    expect(bannerAdService.isBannerVisible()).toBe(true);

    jest.advanceTimersByTime(2 * 60 * 1000);
    expect(bannerAdService.isBannerVisible()).toBe(false);

    jest.advanceTimersByTime(1 * 60 * 1000);
    expect(bannerAdService.isBannerVisible()).toBe(true);
    expect(events).toEqual([true, false, true]);
  });

  it('stops show/hide cycle and hides banner', () => {
    bannerAdService.setBannerVisible(true);
    bannerAdService.startShowHideCycle();
    bannerAdService.stopShowHideCycle();

    expect(bannerAdService.isBannerVisible()).toBe(false);
    expect((bannerAdService as any).showHideInterval).toBeNull();
    expect((bannerAdService as any).hideTimer).toBeNull();
  });

  it('adds and resets ad-free time with persistence', async () => {
    await bannerAdService.addAdFreeTime(5000);
    expect(bannerAdService.getAdFreeTime()).toBe(5000);

    await bannerAdService.resetAdFreeTime();
    expect(bannerAdService.getAdFreeTime()).toBe(0);
    expect(mockSetItem).toHaveBeenCalled();
  });

  it('tracks ad-free time countdown while tracking is enabled', async () => {
    await bannerAdService.addAdFreeTime(3000);

    bannerAdService.startAdFreeTimeTracking();
    expect(bannerAdService.isTrackingAdFreeTime()).toBe(true);

    jest.advanceTimersByTime(2000);
    expect(bannerAdService.getAdFreeTime()).toBeLessThan(3000);

    bannerAdService.stopAdFreeTimeTracking();
    expect(bannerAdService.isTrackingAdFreeTime()).toBe(false);
  });

  it('uses premium and tracking state for shouldShowAds', () => {
    mockHasNoAds.mockReturnValueOnce(true);
    expect(bannerAdService.shouldShowAds(false)).toBe(false);

    mockHasNoAds.mockReturnValue(false);
    expect(bannerAdService.shouldShowAds(true)).toBe(false);
    expect(bannerAdService.shouldShowAds(false)).toBe(true);
  });

  it('proxies personalized ads permission and admin helpers', async () => {
    mockCanShowPersonalizedAds.mockReturnValueOnce(false);
    expect(bannerAdService.canShowPersonalizedAds()).toBe(false);

    await bannerAdService.grantAdFreeTime(1);
    expect(bannerAdService.hasAdFreeTime()).toBe(true);
    expect(bannerAdService.getBannerAdSize()).toBe('BANNER');
    expect(typeof bannerAdService.getBannerAdUnitId()).toBe('string');
  });
});
