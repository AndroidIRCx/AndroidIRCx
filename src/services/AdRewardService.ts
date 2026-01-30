/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdEventType, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { logger } from './Logger';
import { consentService } from './ConsentService';
import { bannerAdService } from './BannerAdService';
import { inAppPurchaseService } from './InAppPurchaseService';

import { APP_VERSION } from '../config/appVersion';

const STORAGE_KEY = '@AndroidIRCX:scriptingTime';
const INITIAL_BONUS_KEY = '@AndroidIRCX:initialBonusGranted';
const VERSION_BONUS_KEY = '@AndroidIRCX:versionBonusApplied';
const VERSION_BONUS_MINUTES = 60; // 30 minutes per new app version
const HOUR_IN_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// Production mode - using real ad units
const USE_TEST_ADS = false; // Set to true for testing with Google's test ads

// Rewarded Ad Unit IDs - Primary and fallback for better fill rate
const REWARDED_AD_UNIT_IDS = USE_TEST_ADS
  ? [TestIds.REWARDED, TestIds.REWARDED] // Test IDs
  : [
      'ca-app-pub-5116758828202889/1851669452', // Primary
      'ca-app-pub-5116758828202889/5746488912', // Fallback
    ];

interface ScriptingTimeData {
  remainingMs: number;
  lastUpdated: number;
}

type TimeChangeListener = (remainingMs: number) => void;

class AdRewardService {
  private remainingMs: number = 0;
  private lastUpdated: number = Date.now();
  private usageInterval: NodeJS.Timeout | null = null;
  private rewardedAd: RewardedAd | null = null;
  private adLoaded: boolean = false;
  private adLoading: boolean = false;
  private listeners: Set<TimeChangeListener> = new Set();
  private initialized: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private cooldownEndTime: number = 0;
  private loadAttemptTime: number = 0;
  private loadTimeoutId: NodeJS.Timeout | null = null;
  private currentAdUnitIndex: number = 0; // Track which ad unit we're using
  private consecutiveFailures: number = 0; // Track total failures
  private adsDisabled: boolean = false; // Disable ads after too many failures
  private appVersion: string = APP_VERSION; // Automatically pulled from app.json
  private lastError: { code: string; message: string } | null = null; // Track last error for special handling

  async initialize() {
    if (this.initialized) {
      logger.info('ad-reward', 'AdRewardService already initialized');
      return;
    }

    logger.info('ad-reward', 'Starting AdRewardService initialization...');
    await this.load();
    await this.applyVersionBonus();
    // Safety net: if time is still zero, grant a small buffer so scripts can run
    if (this.remainingMs <= 0) {
      const safetyMs = 30 * 60 * 1000; // 30 minutes
      this.remainingMs = safetyMs;
      this.lastUpdated = Date.now();
      await this.save();
      logger.info('ad-reward', 'Granted safety bonus of 30m because remaining time was 0');
    }
    this.setupRewardedAd();
    this.initialized = true;
    logger.info('ad-reward', `AdRewardService initialized. Current time: ${this.formatTime(this.remainingMs)}`);
  }

  private async load() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const initialBonusGranted = await AsyncStorage.getItem(INITIAL_BONUS_KEY);

      if (raw) {
        const data: ScriptingTimeData = JSON.parse(raw);
        this.remainingMs = Math.max(0, data.remainingMs);
        this.lastUpdated = data.lastUpdated;
      } else {
        // No data exists - fresh install
        this.remainingMs = 0;
        this.lastUpdated = Date.now();
      }

      // Grant initial 1 hour bonus if not already granted
      if (!initialBonusGranted) {
        logger.info('ad-reward', 'Granting 1 hour initial bonus - Google needs time to load first ad');
        this.remainingMs += HOUR_IN_MS;
        this.lastUpdated = Date.now();
        await AsyncStorage.setItem(INITIAL_BONUS_KEY, 'true');
        await this.save();
        logger.info('ad-reward', 'Initial bonus granted: 1 hour');
      }

      logger.info('ad-reward', `Loaded scripting time: ${this.formatTime(this.remainingMs)}`);
    } catch (error) {
      logger.error('ad-reward', `Failed to load scripting time: ${String(error)}`);
      this.remainingMs = HOUR_IN_MS; // Grant 1 hour on error too
      this.lastUpdated = Date.now();
    }
  }

  private async applyVersionBonus() {
    try {
      const lastVersion = await AsyncStorage.getItem(VERSION_BONUS_KEY);
      if (lastVersion !== this.appVersion) {
        const bonusMs = VERSION_BONUS_MINUTES * 60 * 1000;
        this.remainingMs += bonusMs;
        this.lastUpdated = Date.now();
        await AsyncStorage.setItem(VERSION_BONUS_KEY, this.appVersion);
        await this.save();
        logger.info('ad-reward', `Granted version bonus (${VERSION_BONUS_MINUTES}m) for app version ${this.appVersion}`);
      }
    } catch (error) {
      logger.error('ad-reward', `Failed to apply version bonus: ${String(error)}`);
    }
  }

  private async save() {
    try {
      const data: ScriptingTimeData = {
        remainingMs: this.remainingMs,
        lastUpdated: this.lastUpdated,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      logger.info('ad-reward', `Saved scripting time: ${this.formatTime(this.remainingMs)}`);
    } catch (error) {
      logger.error('ad-reward', `Failed to save scripting time: ${String(error)}`);
    }
  }

  private setupRewardedAd() {
    try {
      const adUnitId = REWARDED_AD_UNIT_IDS[this.currentAdUnitIndex];
      const adType = this.currentAdUnitIndex === 0 ? 'Primary' : 'Fallback';
      const mode = USE_TEST_ADS ? '🧪 TEST ADS' : '🚀 PRODUCTION ADS';

      // Check consent status to determine if we can show personalized ads
      const canShowPersonalizedAds = consentService.canShowPersonalizedAds();
      const consentStatus = consentService.getConsentStatusText();

      logger.info('ad-reward', `Creating rewarded ad with unit ID: ${adUnitId} (${adType})`);
      logger.info('ad-reward', `Mode: ${mode}`);
      logger.info('ad-reward', `Consent status: ${consentStatus}`);
      logger.info('ad-reward', `Personalized ads: ${canShowPersonalizedAds ? 'Yes' : 'No (non-personalized)'}`);
      console.log(`📺 Ad Unit ID: ${adUnitId} (${adType})`);
      console.log(`🔧 Mode: ${mode}`);
      console.log(`🔐 Consent: ${consentStatus}`);
      console.log(`🎯 Personalized ads: ${canShowPersonalizedAds ? 'Yes' : 'No'}`);

      this.rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: !canShowPersonalizedAds,
      });

      // Load the ad
      this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        // Clear timeout on successful load
        if (this.loadTimeoutId) {
          clearTimeout(this.loadTimeoutId);
          this.loadTimeoutId = null;
        }

        const adType = this.currentAdUnitIndex === 0 ? 'Primary' : 'Fallback';
        this.adLoaded = true;
        this.adLoading = false;
        this.retryCount = 0; // Reset retry count on success
        this.consecutiveFailures = 0; // Reset failure count on success
        this.adsDisabled = false; // Re-enable ads on success
        const timeTaken = Date.now() - this.loadAttemptTime;
        logger.info('ad-reward', `✅ Rewarded ad loaded successfully in ${timeTaken}ms (${adType})`);
        console.log(`✅ AD LOADED! (${adType} ad unit) Ready to show. Time taken: ${timeTaken}ms`);
        this.notifyListeners();
      });

      this.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async (reward) => {
        logger.info('ad-reward', `User earned reward: ${reward.amount} ${reward.type}`);
        console.log(`🎁 Reward earned: ${reward.amount} ${reward.type}`);
        // Use the reward amount from AdMob (configured as 60 = 60 minutes)
        const rewardMinutes = reward.amount || 60;
        const rewardMs = rewardMinutes * 60 * 1000; // Convert minutes to milliseconds

        // Grant scripting time only (banner ads controlled by scripting time tracking, not ad-free time)
        this.addTime(rewardMs);

        logger.info('ad-reward', `Granted ${rewardMinutes}m of scripting time`);
        console.log(`✅ Granted ${rewardMinutes}m of scripting time`);

        // Ad will be consumed after showing, prepare next one
        this.adLoaded = false;
        this.retryCount = 0; // Reset retry count for next ad
        console.log('🔄 Ad consumed, will load next ad...');

        // Load next ad after a short delay
        setTimeout(() => {
          logger.info('ad-reward', 'Loading next ad after reward...');
          this.loadAd();
        }, 2000);
      });

      this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error) => {
        if (this.loadTimeoutId) {
          clearTimeout(this.loadTimeoutId);
          this.loadTimeoutId = null;
        }

        const adType = this.currentAdUnitIndex === 0 ? 'Primary' : 'Fallback';
        this.adLoading = false;
        this.adLoaded = false;
        const code = (error as any)?.code ?? 'unknown';
        const message = (error as any)?.message ?? String(error);
        
        // Store error for handleLoadError to check
        this.lastError = { code, message };
        
        logger.error('ad-reward', `Rewarded ad error (${adType}): ${code} - ${message}`);
        console.error(`Rewarded ad error (${adType}): ${code} - ${message}`);
        this.handleLoadError();
      });

      // Delay ad loading until Activity is ready (fixes null-activity error)
      // Wait for app to be fully mounted and Activity to be available
      setTimeout(() => {
        console.log('🔄 Attempting to load first ad (after Activity ready)...');
        this.loadAd();
      }, 2000); // 2 second delay to ensure Activity is ready
    } catch (error) {
      logger.error('ad-reward', `Failed to setup rewarded ad: ${String(error)}`);
      console.error('❌ SETUP ERROR:', error);
    }
  }

  private loadAd() {
    console.log('🔍 loadAd() called - Checking conditions...');
    console.log('  - rewardedAd exists:', !!this.rewardedAd);
    console.log('  - adLoaded:', this.adLoaded);
    console.log('  - adLoading:', this.adLoading);

    if (this.rewardedAd && !this.adLoaded && !this.adLoading) {
      this.adLoading = true;
      this.loadAttemptTime = Date.now();
      logger.info('ad-reward', `🔄 Loading rewarded ad (attempt ${this.retryCount + 1}/${this.maxRetries})...`);
      console.log(`🔄 Loading ad... Attempt ${this.retryCount + 1}/${this.maxRetries}`);

      // Clear any existing timeout
      if (this.loadTimeoutId) {
        clearTimeout(this.loadTimeoutId);
      }

      try {
        this.rewardedAd.load();
        console.log('✅ Ad load() method called successfully');

        // Set a timeout to detect if ad loading fails (45 seconds)
        this.loadTimeoutId = setTimeout(() => {
          if (this.adLoading && !this.adLoaded) {
            console.error('⏱️ Ad loading timeout (45s) - treating as error');
            logger.error('ad-reward', 'Ad loading timeout - no response from Google after 45 seconds');
            this.adLoading = false;
            this.loadTimeoutId = null;
            this.handleLoadError();
          }
        }, 45000);
      } catch (error) {
        console.error('❌ Error calling load():', error);
        logger.error('ad-reward', `Error calling load(): ${String(error)}`);
        this.adLoading = false;
        if (this.loadTimeoutId) {
          clearTimeout(this.loadTimeoutId);
          this.loadTimeoutId = null;
        }
        this.handleLoadError();
      }
      this.notifyListeners();
    } else {
      console.log('⚠️ loadAd() conditions not met, skipping load');
    }
  }

  private handleLoadError() {
    // Don't retry if error is null-activity (Activity not ready yet)
    const lastError = this.lastError;
    if (lastError?.code === 'googleMobileAds/null-activity') {
      console.log('⏸️ Ad loading paused - Activity not ready yet. Will retry when Activity is available.');
      // Don't increment retry count for null-activity errors
      // Just wait and retry later when Activity is ready
      setTimeout(() => {
        console.log('🔄 Retrying ad load after Activity ready delay...');
        this.loadAd();
      }, 5000); // Wait 5 seconds before retrying
      return;
    }
    
    console.log(`❌ handleLoadError() called. Retry count: ${this.retryCount + 1}/${this.maxRetries}`);
    this.retryCount++;
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= 10) {
      this.adsDisabled = true;
      this.adLoading = false;
      this.cooldownEndTime = 0;
      logger.error('ad-reward', '🛑 Ads disabled after 10 consecutive failures. Likely network or Google Play Services issue.');
      console.error('🛑 Ads disabled after persistent failures. App works fine without them.');
      console.error('💡 To fix: Check internet connection or update Google Play Services');
      this.notifyListeners();
      return; // Stop trying
    }

    if (this.retryCount >= this.maxRetries) {
      // Max retries reached - try fallback ad unit if available
      if (this.currentAdUnitIndex < REWARDED_AD_UNIT_IDS.length - 1) {
        // Switch to fallback ad unit
        this.currentAdUnitIndex++;
        this.retryCount = 0; // Reset retry count for new ad unit
        logger.info('ad-reward', `⚠️ Primary ad failed. Switching to fallback ad unit...`);
        console.log(`⚠️ Primary ad failed after ${this.maxRetries} attempts. Switching to fallback ad unit...`);

        // Recreate rewarded ad with fallback unit
        this.setupRewardedAd();
      } else {
        // All ad units failed - enter cooldown and reset to primary
        this.cooldownEndTime = Date.now() + 60000; // 60 seconds cooldown
        logger.info('ad-reward', `⏸️ All ad units failed. Cooldown for 60 seconds.`);
        console.log(`⏸️ All ad units failed. Cooling down for 60 seconds...`);
        this.notifyListeners();

        // Auto-retry after cooldown with primary ad unit
        setTimeout(() => {
          if (this.consecutiveFailures >= 10) {
            logger.info('ad-reward', '🛑 Too many failures, not retrying ads');
            console.log('🛑 Too many failures, not retrying ads');
            return; // Don't retry if too many failures
          }

          this.retryCount = 0;
          this.cooldownEndTime = 0;
          this.currentAdUnitIndex = 0; // Reset to primary ad unit
          logger.info('ad-reward', '🔄 Cooldown ended, retrying ads...');
          console.log('🔄 Cooldown ended, retrying ads...');

          // Only retry if SDK might be working now
          this.setupRewardedAd();
        }, 60000);
      }
    } else {
      // Retry after short delay
      logger.info('ad-reward', `🔄 Retrying ad load in 3 seconds (${this.retryCount}/${this.maxRetries})...`);
      console.log(`🔄 Retrying ad load in 3 seconds... (attempt ${this.retryCount + 1}/${this.maxRetries})`);
      setTimeout(() => this.loadAd(), 3000); // Wait 3 seconds before retry
    }
  }

  async manualLoadAd(): Promise<{ success: boolean; messageKey: string; messageParams?: Record<string, unknown> }> {
    // Check if ads are disabled due to too many failures
    if (this.adsDisabled) {
      return {
        success: false,
        messageKey: 'Ads unavailable. Please check your internet connection or update Google Play Services.'
      };
    }

    // Check if in cooldown
    if (this.cooldownEndTime > Date.now()) {
      const remainingCooldown = Math.ceil((this.cooldownEndTime - Date.now()) / 1000);
      return {
        success: false,
        messageKey: 'Please wait {seconds} seconds before trying again.',
        messageParams: { seconds: remainingCooldown }
      };
    }

    // Check if already loaded
    if (this.adLoaded) {
      return {
        success: true,
        messageKey: 'Ad is ready! Click again to watch.'
      };
    }

    // Check if already loading
    if (this.adLoading) {
      return {
        success: false,
        messageKey: 'Ad is loading, please wait...'
      };
    }

    // Try to load
    this.loadAd();
    return {
      success: true,
      messageKey: 'Requesting ad from Google...'
    };
  }

  async showRewardedAd(): Promise<boolean> {
    if (!this.rewardedAd || !this.adLoaded) {
      logger.info('ad-reward', 'Rewarded ad not ready yet');
      console.log('⚠️ Rewarded ad not ready yet');
      return false;
    }

    try {
      console.log('📺 Showing rewarded ad...');
      await this.rewardedAd.show();

      // Mark ad as consumed (will be set false again in EARNED_REWARD if user completes it)
      // But if user closes early, we still need to load a new ad
      setTimeout(() => {
        if (!this.adLoaded) {
          // Ad was already marked as not loaded (user earned reward or closed)
          return;
        }
        // User closed ad without earning reward
        console.log('⚠️ Ad closed without reward, loading next ad...');
        this.adLoaded = false;
        this.retryCount = 0;
        this.loadAd();
      }, 5000); // Wait 5 seconds to see if reward was earned

      return true;
    } catch (error) {
      logger.error('ad-reward', `Failed to show rewarded ad: ${String(error)}`);
      console.error('❌ Failed to show ad:', error);
      return false;
    }
  }

  isAdReady(): boolean {
    return this.adLoaded;
  }

  isAdLoading(): boolean {
    return this.adLoading;
  }

  isInCooldown(): boolean {
    return this.cooldownEndTime > Date.now();
  }

  getCooldownRemaining(): number {
    if (!this.isInCooldown()) return 0;
    return Math.ceil((this.cooldownEndTime - Date.now()) / 1000);
  }

  getAdStatus(): { ready: boolean; loading: boolean; cooldown: boolean; cooldownSeconds: number; retryCount: number; currentAdUnit: string; adUnitType: string } {
    const adUnitId = REWARDED_AD_UNIT_IDS[this.currentAdUnitIndex];
    const adType = this.currentAdUnitIndex === 0 ? 'Primary' : 'Fallback';

    return {
      ready: this.adLoaded,
      loading: this.adLoading,
      cooldown: this.isInCooldown(),
      cooldownSeconds: this.getCooldownRemaining(),
      retryCount: this.retryCount,
      currentAdUnit: adUnitId,
      adUnitType: adType
    };
  }

  getRemainingTime(): number {
    // If user has unlimited scripting, return a very large number (999 hours)
    if (inAppPurchaseService.hasUnlimitedScripting()) {
      return 999 * HOUR_IN_MS;
    }
    return this.remainingMs;
  }

  getRemainingTimeFormatted(): string {
    // If user has unlimited scripting, return "Unlimited"
    if (inAppPurchaseService.hasUnlimitedScripting()) {
      return '∞ Unlimited';
    }
    return this.formatTime(this.remainingMs);
  }

  hasAvailableTime(): boolean {
    // Always true if user has unlimited scripting
    if (inAppPurchaseService.hasUnlimitedScripting()) {
      return true;
    }
    return this.remainingMs > 0;
  }

  private formatTime(ms: number): string {
    const hours = Math.floor(ms / HOUR_IN_MS);
    const minutes = Math.floor((ms % HOUR_IN_MS) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private async addTime(ms: number) {
    this.remainingMs += ms;
    this.lastUpdated = Date.now();
    await this.save();
    this.notifyListeners();
    logger.info('ad-reward', `Added ${this.formatTime(ms)}. Total: ${this.formatTime(this.remainingMs)}`);
  }

  startUsageTracking() {
    if (this.usageInterval) return; // Already tracking

    // If user has unlimited scripting, set a marker interval so isTracking() returns true
    // but don't actually track usage (no countdown)
    if (inAppPurchaseService.hasUnlimitedScripting()) {
      logger.info('ad-reward', 'User has unlimited scripting, enabling no-ads mode without tracking');
      // Set a dummy interval so isTracking() returns true
      this.usageInterval = setInterval(() => {
        // No-op: just keep the interval alive for isTracking() to return true
      }, 1000);
      this.notifyListeners();
      return;
    }

    // Reset the reference point so we only count active usage time going forward
    this.lastUpdated = Date.now();

    this.usageInterval = setInterval(() => {
      // Check again if user purchased unlimited scripting during tracking
      if (inAppPurchaseService.hasUnlimitedScripting()) {
        this.stopUsageTracking();
        return;
      }

      if (this.remainingMs <= 0) {
        this.stopUsageTracking();
        return;
      }

      const now = Date.now();
      const elapsed = now - this.lastUpdated;
      this.remainingMs = Math.max(0, this.remainingMs - elapsed);
      this.lastUpdated = now;

      // Save every 10 seconds to avoid excessive writes
      if (Math.floor(this.remainingMs / 1000) % 10 === 0) {
        this.save();
      }

      this.notifyListeners();
    }, 1000); // Update every second

    logger.info('ad-reward', 'Started usage tracking');
  }

  stopUsageTracking() {
    if (this.usageInterval) {
      clearInterval(this.usageInterval);
      this.usageInterval = null;
      this.save();
      logger.info('ad-reward', 'Stopped usage tracking');
    }
  }

  isTracking(): boolean {
    return this.usageInterval !== null;
  }

  // Listener management
  addListener(listener: TimeChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.remainingMs);
      } catch (error) {
        logger.error('ad-reward', `Listener error: ${String(error)}`);
      }
    });
  }

  // Admin/debug methods
  async grantTime(hours: number) {
    await this.addTime(hours * HOUR_IN_MS);
  }

  async resetTime() {
    this.remainingMs = 0;
    this.lastUpdated = Date.now();
    await this.save();
    this.notifyListeners();
    logger.info('ad-reward', 'Reset scripting time to 0');
  }

  async simulateFreshInstall() {
    // Clear storage to simulate first install
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(INITIAL_BONUS_KEY);
    this.remainingMs = 0;
    this.lastUpdated = Date.now();
    logger.info('ad-reward', 'Cleared storage - simulating fresh install');
    // Reload to trigger first install logic
    await this.load();
    this.notifyListeners();
  }
}

export const adRewardService = new AdRewardService();
