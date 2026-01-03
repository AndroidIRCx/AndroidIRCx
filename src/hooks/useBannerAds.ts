/**
 * useBannerAds Hook
 *
 * Manages banner ad display and lifecycle:
 * - Syncs scripting time and ad-free time from services to UI store
 * - Controls show/hide cycle based on premium status and time remaining
 * - Handles ad-free time tracking
 */

import { useEffect, useState } from 'react';
import { useUIStore } from '../stores/uiStore';
import { adRewardService } from '../services/AdRewardService';
import { bannerAdService } from '../services/BannerAdService';
import { inAppPurchaseService } from '../services/InAppPurchaseService';

export function useBannerAds() {
  const scriptingTimeMs = useUIStore(state => state.scriptingTimeMs);
  const [isScriptingTracking, setIsScriptingTracking] = useState(false);
  const [hasNoAds, setHasNoAds] = useState(false);

  // Effect: Poll for scripting time tracking status changes
  useEffect(() => {
    // Check immediately
    setIsScriptingTracking(adRewardService.isTracking());
    setHasNoAds(inAppPurchaseService.hasNoAds());

    // Poll every second to detect tracking status changes
    const interval = setInterval(() => {
      setIsScriptingTracking(adRewardService.isTracking());
      setHasNoAds(inAppPurchaseService.hasNoAds());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Effect: Listen to purchase changes
  useEffect(() => {
    const unsubscribePurchases = inAppPurchaseService.addListener(() => {
      setHasNoAds(inAppPurchaseService.hasNoAds());
    });

    return () => {
      unsubscribePurchases();
    };
  }, []);

  // Effect: Initialize and listen to ad service changes
  useEffect(() => {
    const store = useUIStore.getState();

    // Initialize scripting time from service
    store.setScriptingTimeMs(adRewardService.getRemainingTime());

    // Listen to AdRewardService for scripting time changes
    const unsubscribeScripting = adRewardService.addListener((remainingMs) => {
      useUIStore.getState().setScriptingTimeMs(remainingMs);
    });

    // Listen to BannerAdService for banner visibility changes
    const unsubscribeBanner = bannerAdService.addListener((visible) => {
      useUIStore.getState().setBannerVisible(visible);
    });

    return () => {
      unsubscribeScripting();
      unsubscribeBanner();
    };
  }, []);

  // Effect: Control banner ad visibility based on premium status and scripting time tracking status
  useEffect(() => {
    // Never show ads if user has purchased ad removal (no ads, pro, supporter)
    if (hasNoAds) {
      bannerAdService.stopShowHideCycle();
      bannerAdService.setBannerVisible(false);
      return;
    }

    // Banner ads show when scripting time is NOT actively tracking (OFF)
    // Banner ads hide when scripting time IS actively tracking (ON)
    if (isScriptingTracking) {
      // Scripting time is ON (tracking) - hide banner ads
      bannerAdService.stopShowHideCycle();
      bannerAdService.setBannerVisible(false);
    } else {
      // Scripting time is OFF (not tracking) - show banner ads ALWAYS (no cycling)
      bannerAdService.stopShowHideCycle(); // Stop any cycling
      bannerAdService.setBannerVisible(true); // Show always
    }
  }, [isScriptingTracking, hasNoAds]); // Depend on tracking status AND premium status
}
