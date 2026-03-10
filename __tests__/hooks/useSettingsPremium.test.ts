/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useSettingsPremium hook
 */

// Undo global mocks from jest.setup.ts
jest.unmock('../../src/hooks/useSettingsPremium');
jest.unmock('../../src/services/AdRewardService');

import { renderHook, act } from '@testing-library/react-hooks';
import { Alert } from 'react-native';
import { useSettingsPremium } from '../../src/hooks/useSettingsPremium';

let purchaseListener: (() => void) | null = null;

jest.mock('../../src/services/InAppPurchaseService', () => ({
  inAppPurchaseService: {
    hasNoAds: jest.fn(() => false),
    hasUnlimitedScripting: jest.fn(() => false),
    isSupporter: jest.fn(() => false),
    addListener: jest.fn((cb: any) => {
      purchaseListener = cb;
      return jest.fn(() => { purchaseListener = null; });
    }),
  },
}));

jest.mock('../../src/services/AdRewardService', () => ({
  adRewardService: {
    getAdStatus: jest.fn(() => ({
      ready: false,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    })),
    showRewardedAd: jest.fn().mockResolvedValue(true),
    manualLoadAd: jest.fn().mockResolvedValue({ success: true, messageKey: 'Loading...' }),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn().mockResolvedValue(false),
    setSetting: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

import { inAppPurchaseService } from '../../src/services/InAppPurchaseService';
import { adRewardService } from '../../src/services/AdRewardService';
import { settingsService } from '../../src/services/SettingsService';

const flushMicrotasks = () => act(async () => {});

describe('useSettingsPremium', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    purchaseListener = null;
    (inAppPurchaseService.hasNoAds as jest.Mock).mockReturnValue(false);
    (inAppPurchaseService.hasUnlimitedScripting as jest.Mock).mockReturnValue(false);
    (inAppPurchaseService.isSupporter as jest.Mock).mockReturnValue(false);
    (adRewardService.getAdStatus as jest.Mock).mockReturnValue({
      ready: false,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    });
    (adRewardService.showRewardedAd as jest.Mock).mockResolvedValue(true);
    (adRewardService.manualLoadAd as jest.Mock).mockResolvedValue({ success: true, messageKey: 'Loading...' });
    (settingsService.getSetting as jest.Mock).mockResolvedValue(false);
    (settingsService.setSetting as jest.Mock).mockResolvedValue(undefined);
  });

  it('should return initial premium status', async () => {
    const { result } = renderHook(() => useSettingsPremium());

    await flushMicrotasks();

    expect(result.current.hasNoAds).toBe(false);
    expect(result.current.hasScriptingPro).toBe(false);
    expect(result.current.isSupporter).toBe(false);
  });

  it('should return initial ad status', async () => {
    const { result } = renderHook(() => useSettingsPremium());

    await flushMicrotasks();

    expect(result.current.adReady).toBe(false);
    expect(result.current.adLoading).toBe(false);
    expect(result.current.adCooldown).toBe(false);
    expect(result.current.cooldownSeconds).toBe(0);
    expect(result.current.adUnitType).toBe('Primary');
    expect(result.current.showingAd).toBe(false);
  });

  it('should show watch ad button for non-premium users', async () => {
    const { result } = renderHook(() => useSettingsPremium());

    await flushMicrotasks();

    expect(result.current.showWatchAdButton).toBe(true);
  });

  it('should update premium status when purchase listener fires', async () => {
    const { result } = renderHook(() => useSettingsPremium());

    await flushMicrotasks();

    (inAppPurchaseService.hasNoAds as jest.Mock).mockReturnValue(true);

    act(() => {
      if (purchaseListener) purchaseListener();
    });

    expect(result.current.hasNoAds).toBe(true);
  });

  it('should hide watch ad button for premium users', async () => {
    (inAppPurchaseService.hasNoAds as jest.Mock).mockReturnValue(true);

    const { result } = renderHook(() => useSettingsPremium());

    await flushMicrotasks();

    expect(result.current.showWatchAdButton).toBe(false);
  });

  it('should poll ad status with interval', async () => {
    jest.useFakeTimers();

    renderHook(() => useSettingsPremium());

    const initialCalls = (adRewardService.getAdStatus as jest.Mock).mock.calls.length;

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect((adRewardService.getAdStatus as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(
      initialCalls + 3
    );

    jest.useRealTimers();
  });

  it('should show rewarded ad on handleWatchAd when ready', async () => {
    (adRewardService.getAdStatus as jest.Mock).mockReturnValue({
      ready: true,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    });

    jest.useFakeTimers();

    const { result } = renderHook(() => useSettingsPremium());

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    jest.useRealTimers();

    await act(async () => {
      await result.current.handleWatchAd();
    });

    expect(adRewardService.showRewardedAd).toHaveBeenCalled();
  });

  it('should try to manually load ad when not ready', async () => {
    const { result } = renderHook(() => useSettingsPremium());

    await flushMicrotasks();

    await act(async () => {
      await result.current.handleWatchAd();
    });

    expect(adRewardService.manualLoadAd).toHaveBeenCalled();
  });

  it('should set watchAdButtonEnabledForPremium', async () => {
    const { result } = renderHook(() => useSettingsPremium());

    await flushMicrotasks();

    await act(async () => {
      await result.current.setWatchAdButtonEnabledForPremium(true);
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith('watchAdButtonEnabledForPremium', true);
    expect(result.current.watchAdButtonEnabledForPremium).toBe(true);
  });

  it('should clean up purchase listener on unmount', async () => {
    const { unmount } = renderHook(() => useSettingsPremium());

    await flushMicrotasks();

    unmount();

    expect(purchaseListener).toBeNull();
  });

  it('should show failure alert when rewarded ad does not display', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    (adRewardService.getAdStatus as jest.Mock).mockReturnValue({
      ready: true,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    });
    (adRewardService.showRewardedAd as jest.Mock).mockResolvedValue(false);

    jest.useFakeTimers();
    const { result } = renderHook(() => useSettingsPremium());
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    jest.useRealTimers();

    await act(async () => {
      await result.current.handleWatchAd();
    });

    expect(alertSpy).toHaveBeenCalledWith('Ad Failed', 'Could not show the ad. Please try again.');
    alertSpy.mockRestore();
  });

  it('should show error alert when rewarded ad throws', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    (adRewardService.getAdStatus as jest.Mock).mockReturnValue({
      ready: true,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    });
    (adRewardService.showRewardedAd as jest.Mock).mockRejectedValue(new Error('boom'));

    jest.useFakeTimers();
    const { result } = renderHook(() => useSettingsPremium());
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    jest.useRealTimers();

    await act(async () => {
      await result.current.handleWatchAd();
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', 'boom');
    alertSpy.mockRestore();
  });
});
