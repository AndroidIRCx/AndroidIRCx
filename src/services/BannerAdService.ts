import AsyncStorage from '@react-native-async-storage/async-storage';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { logger } from './Logger';
import { consentService } from './ConsentService';
import { inAppPurchaseService } from './InAppPurchaseService';

const AD_FREE_TIME_KEY = '@AndroidIRCX:adFreeTime';
const HOUR_IN_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// Production mode - using real ad unit
const USE_TEST_ADS = false; // Set to true for testing with Google's test ads

// Banner Ad Unit ID
const BANNER_AD_UNIT_ID = USE_TEST_ADS
  ? TestIds.BANNER
  : 'ca-app-pub-5116758828202889/6365382117';

// Timing constants
const BANNER_SHOW_DURATION = 2 * 60 * 1000; // Show banner for 2 minutes
const BANNER_HIDE_DURATION = 1 * 60 * 1000; // Hide for 1 minute

interface AdFreeTimeData {
  remainingMs: number;
  lastUpdated: number;
}

type BannerStateListener = (visible: boolean) => void;

class BannerAdService {
  private adFreeMs: number = 0;
  private lastUpdated: number = Date.now();
  private bannerVisible: boolean = false;
  private showHideInterval: NodeJS.Timeout | null = null;
  private hideTimer: NodeJS.Timeout | null = null;
  private usageInterval: NodeJS.Timeout | null = null;
  private listeners: Set<BannerStateListener> = new Set();
  private initialized: boolean = false;

  async initialize() {
    if (this.initialized) {
      logger.info('banner-ad', 'BannerAdService already initialized');
      return;
    }

    logger.info('banner-ad', 'Starting BannerAdService initialization...');
    await this.load();
    this.initialized = true;
    logger.info('banner-ad', `BannerAdService initialized. Ad-free time: ${this.formatTime(this.adFreeMs)}`);
  }

  private async load() {
    try {
      const raw = await AsyncStorage.getItem(AD_FREE_TIME_KEY);

      if (raw) {
        const data: AdFreeTimeData = JSON.parse(raw);
        this.adFreeMs = Math.max(0, data.remainingMs);
        this.lastUpdated = data.lastUpdated;
      } else {
        // No data exists - fresh install
        this.adFreeMs = 0;
        this.lastUpdated = Date.now();
      }

      logger.info('banner-ad', `Loaded ad-free time: ${this.formatTime(this.adFreeMs)}`);
    } catch (error) {
      logger.error('banner-ad', `Failed to load ad-free time: ${String(error)}`);
      this.adFreeMs = 0;
      this.lastUpdated = Date.now();
    }
  }

  private async save() {
    try {
      const data: AdFreeTimeData = {
        remainingMs: this.adFreeMs,
        lastUpdated: this.lastUpdated,
      };
      await AsyncStorage.setItem(AD_FREE_TIME_KEY, JSON.stringify(data));
      logger.info('banner-ad', `Saved ad-free time: ${this.formatTime(this.adFreeMs)}`);
    } catch (error) {
      logger.error('banner-ad', `Failed to save ad-free time: ${String(error)}`);
    }
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

  /**
   * Start the show/hide cycle for the banner ad
   * This should be called when ads should be showing (scripting time is OFF/not tracking)
   */
  startShowHideCycle() {
    if (this.showHideInterval) {
      logger.info('banner-ad', 'Show/hide cycle already running');
      return;
    }

    logger.info('banner-ad', 'Starting banner ad show/hide cycle (show 2min, hide 1min)');

    // Mark the cycle as running
    this.showHideInterval = {} as NodeJS.Timeout; // Placeholder to indicate cycle is active

    // Show the banner immediately
    this.bannerVisible = true;
    this.notifyListeners();

    // Schedule the first hide after BANNER_SHOW_DURATION
    this.scheduleNextToggle(BANNER_SHOW_DURATION, false);
  }

  /**
   * Schedule the next banner toggle (show or hide)
   */
  private scheduleNextToggle(delay: number, showNext: boolean) {
    this.hideTimer = setTimeout(() => {
      this.bannerVisible = showNext;
      this.notifyListeners();
      logger.info('banner-ad', this.bannerVisible ? 'Banner shown' : 'Banner hidden');

      // Schedule the opposite action
      const nextDelay = showNext ? BANNER_SHOW_DURATION : BANNER_HIDE_DURATION;
      this.scheduleNextToggle(nextDelay, !showNext);
    }, delay);
  }

  /**
   * Stop the show/hide cycle and hide the banner
   */
  stopShowHideCycle() {
    // Clear any pending toggle timer
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    // Reset the interval flag
    this.showHideInterval = null;

    // Hide the banner if it's visible
    if (this.bannerVisible) {
      this.bannerVisible = false;
      this.notifyListeners();
      logger.info('banner-ad', 'Stopped banner ad show/hide cycle and hid banner');
    } else {
      logger.info('banner-ad', 'Stopped banner ad show/hide cycle');
    }
  }

  /**
   * Check if the banner should be showing based on premium status and scripting time tracking status
   * @param isScriptingTimeTracking - Whether scripting time is actively counting down (ON/tracking)
   * @returns true if ads should be shown, false otherwise
   */
  shouldShowAds(isScriptingTimeTracking: boolean): boolean {
    // Never show ads if user has purchased ad removal (no ads, pro, supporter)
    if (inAppPurchaseService.hasNoAds()) {
      return false;
    }

    // Show ads when scripting time is NOT actively tracking (OFF)
    // Hide ads when scripting time IS actively tracking (ON)
    return !isScriptingTimeTracking;
  }

  /**
   * Get the current banner visibility state
   */
  isBannerVisible(): boolean {
    return this.bannerVisible;
  }

  /**
   * Manually set the banner visibility state
   */
  setBannerVisible(visible: boolean) {
    if (this.bannerVisible !== visible) {
      this.bannerVisible = visible;
      this.notifyListeners();
      logger.info('banner-ad', `Banner ${visible ? 'shown' : 'hidden'} manually`);
    }
  }

  /**
   * Get the ad-free time remaining
   */
  getAdFreeTime(): number {
    return this.adFreeMs;
  }

  /**
   * Get the ad-free time remaining formatted
   */
  getAdFreeTimeFormatted(): string {
    return this.formatTime(this.adFreeMs);
  }

  /**
   * Check if user has ad-free time
   */
  hasAdFreeTime(): boolean {
    return this.adFreeMs > 0;
  }

  /**
   * Add ad-free time (called when user watches rewarded ad)
   */
  async addAdFreeTime(ms: number) {
    this.adFreeMs += ms;
    this.lastUpdated = Date.now();
    await this.save();
    this.notifyListeners();
    logger.info('banner-ad', `Added ${this.formatTime(ms)}. Total ad-free time: ${this.formatTime(this.adFreeMs)}`);
  }

  /**
   * Start tracking ad-free time usage (countdown)
   */
  startAdFreeTimeTracking() {
    if (this.usageInterval) return; // Already tracking

    // Reset the reference point so we only count active usage time going forward
    this.lastUpdated = Date.now();

    this.usageInterval = setInterval(() => {
      if (this.adFreeMs <= 0) {
        this.stopAdFreeTimeTracking();
        return;
      }

      const now = Date.now();
      const elapsed = now - this.lastUpdated;
      this.adFreeMs = Math.max(0, this.adFreeMs - elapsed);
      this.lastUpdated = now;

      // Save every 10 seconds to avoid excessive writes
      if (Math.floor(this.adFreeMs / 1000) % 10 === 0) {
        this.save();
      }

      this.notifyListeners();
    }, 1000); // Update every second

    logger.info('banner-ad', 'Started ad-free time tracking');
  }

  /**
   * Stop tracking ad-free time usage
   */
  stopAdFreeTimeTracking() {
    if (this.usageInterval) {
      clearInterval(this.usageInterval);
      this.usageInterval = null;
      this.save();
      logger.info('banner-ad', 'Stopped ad-free time tracking');
    }
  }

  /**
   * Check if ad-free time is being tracked
   */
  isTrackingAdFreeTime(): boolean {
    return this.usageInterval !== null;
  }

  /**
   * Get the banner ad unit ID
   */
  getBannerAdUnitId(): string {
    return BANNER_AD_UNIT_ID;
  }

  /**
   * Get the banner ad size
   */
  getBannerAdSize(): BannerAdSize {
    return BannerAdSize.BANNER; // Standard 320x50 banner
  }

  /**
   * Check if personalized ads can be shown
   */
  canShowPersonalizedAds(): boolean {
    return consentService.canShowPersonalizedAds();
  }

  // Listener management
  addListener(listener: BannerStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.bannerVisible);
      } catch (error) {
        logger.error('banner-ad', `Listener error: ${String(error)}`);
      }
    });
  }

  // Admin/debug methods
  async grantAdFreeTime(hours: number) {
    await this.addAdFreeTime(hours * HOUR_IN_MS);
  }

  async resetAdFreeTime() {
    this.adFreeMs = 0;
    this.lastUpdated = Date.now();
    await this.save();
    this.notifyListeners();
    logger.info('banner-ad', 'Reset ad-free time to 0');
  }
}

export const bannerAdService = new BannerAdService();
