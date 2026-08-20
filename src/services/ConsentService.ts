/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  AdsConsentStatus,
} from 'react-native-google-mobile-ads';
import { logger } from './Logger';

const STORAGE_KEY = '@AndroidIRCX:consentShown';
const CONSENT_STATUS_KEY = '@AndroidIRCX:consentStatus';
const MANUAL_CONSENT_KEY = '@AndroidIRCX:manualConsent';
const PRIVACY_POLICY_URL = 'https://androidircx.com/privacy';

type ConsentStatusListener = (status: AdsConsentStatus) => void;

class ConsentService {
  private consentStatus: AdsConsentStatus = AdsConsentStatus.UNKNOWN;
  private listeners: Set<ConsentStatusListener> = new Set();
  private initialized: boolean = false;
  private manuallyAccepted: boolean = false;
  // Whether UMP requires a persistent "privacy options" entry point for this
  // user. Google requires it for BOTH the GDPR/EEA message and the US-states
  // (CCPA/CPRA...) message, so it drives the single "Privacy options" button.
  private privacyOptionsRequired: boolean = false;

  /**
   * Initialize consent management
   * Must be called before initializing AdMob
   */
  async initialize(debugMode: boolean = false): Promise<void> {
    if (this.initialized) {
      logger.info('consent', 'ConsentService already initialized');
      return;
    }

    try {
      logger.info('consent', 'Starting UMP SDK initialization...');

      // Load previously saved consent status
      await this.loadSavedConsentStatus();

      // Configure consent request (enable debug mode for testing if needed)
      const consentInfo = await AdsConsent.requestInfoUpdate({
        debugGeography: debugMode
          ? AdsConsentDebugGeography.EEA
          : AdsConsentDebugGeography.DISABLED,
        testDeviceIdentifiers: debugMode ? ['TEST-DEVICE-HASHED-ID'] : [],
        tagForUnderAgeOfConsent: false,
      });

      logger.info(
        'consent',
        `Consent info updated. UMP Status: ${consentInfo.status}, Manual: ${this.manuallyAccepted}`,
      );

      // Use saved manual consent if available, otherwise use UMP status
      if (!this.manuallyAccepted) {
        this.consentStatus = consentInfo.status;
      }

      // Track whether the persistent privacy-options entry point is required
      // (EEA/UK/CH GDPR message OR a US-states message configured in AdMob).
      this.privacyOptionsRequired =
        consentInfo.privacyOptionsRequirementStatus ===
        AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;

      this.notifyListeners();

      // Check if consent form is available and required
      if (
        consentInfo.isConsentFormAvailable &&
        consentInfo.status === AdsConsentStatus.REQUIRED
      ) {
        logger.info('consent', 'Consent required - will show form');
        // Form will be shown by showConsentFormIfRequired()
      } else {
        logger.info(
          'consent',
          `Consent not required. Status: ${consentInfo.status}`,
        );
      }

      this.initialized = true;
    } catch (error) {
      logger.error('consent', `Failed to initialize consent: ${String(error)}`);
      // Load from saved status if UMP fails
      await this.loadSavedConsentStatus();
      this.initialized = true;
    }
  }

  /**
   * Load saved consent status from AsyncStorage
   */
  private async loadSavedConsentStatus(): Promise<void> {
    try {
      const [savedStatus, manualConsent] = await Promise.all([
        AsyncStorage.getItem(CONSENT_STATUS_KEY),
        AsyncStorage.getItem(MANUAL_CONSENT_KEY),
      ]);

      if (manualConsent === 'true') {
        this.manuallyAccepted = true;
        this.consentStatus = AdsConsentStatus.NOT_REQUIRED;
        logger.info('consent', 'Loaded manual consent acceptance');
      } else if (savedStatus) {
        this.consentStatus = parseInt(
          savedStatus,
          10,
        ) as unknown as AdsConsentStatus;
        logger.info(
          'consent',
          `Loaded saved consent status: ${this.consentStatus}`,
        );
      }
    } catch (error) {
      logger.error('consent', `Failed to load saved consent: ${String(error)}`);
    }
  }

  /**
   * Save consent status to AsyncStorage
   */
  private async saveConsentStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        CONSENT_STATUS_KEY,
        String(this.consentStatus),
      );
      if (this.manuallyAccepted) {
        await AsyncStorage.setItem(MANUAL_CONSENT_KEY, 'true');
      }
      logger.info('consent', `Saved consent status: ${this.consentStatus}`);
    } catch (error) {
      logger.error('consent', `Failed to save consent: ${String(error)}`);
    }
  }

  /**
   * Manually accept consent (for non-EEA users via Alert)
   */
  async acceptConsentManually(): Promise<void> {
    try {
      logger.info('consent', 'Manual consent accepted');
      this.manuallyAccepted = true;
      this.consentStatus = AdsConsentStatus.NOT_REQUIRED;
      await AsyncStorage.setItem(MANUAL_CONSENT_KEY, 'true');
      await this.saveConsentStatus();
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      this.notifyListeners();
    } catch (error) {
      logger.error(
        'consent',
        `Failed to save manual consent: ${String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Show consent form if required
   * Call this after initialize() and before loading ads
   */
  async showConsentFormIfRequired(): Promise<boolean> {
    try {
      const consentInfo = await AdsConsent.requestInfoUpdate();

      if (
        consentInfo.isConsentFormAvailable &&
        consentInfo.status === AdsConsentStatus.REQUIRED
      ) {
        logger.info('consent', 'Showing consent form...');

        const formResult = await AdsConsent.showForm();
        this.consentStatus = formResult.status;
        this.manuallyAccepted = false;

        logger.info(
          'consent',
          `Consent form completed. Status: ${formResult.status}`,
        );

        // Mark that we've shown the form and save status
        await AsyncStorage.setItem(STORAGE_KEY, 'true');
        await AsyncStorage.removeItem(MANUAL_CONSENT_KEY);
        await this.saveConsentStatus();

        this.notifyListeners();
        return true;
      }

      logger.info('consent', 'Consent form not required');
      return false;
    } catch (error) {
      logger.error('consent', `Failed to show consent form: ${String(error)}`);
      return false;
    }
  }

  /**
   * Show consent form to allow users to change their consent
   * Use this for settings page
   */
  async showConsentForm(): Promise<void> {
    try {
      logger.info('consent', 'Showing consent form for settings...');

      // Always request updated consent info first
      const consentInfo = await AdsConsent.requestInfoUpdate();

      logger.info(
        'consent',
        `Consent info: formAvailable=${consentInfo.isConsentFormAvailable}, manuallyAccepted=${this.manuallyAccepted}`,
      );

      // If user manually accepted (non-EEA/UK), only allow reset
      if (this.manuallyAccepted) {
        logger.info('consent', 'User manually accepted - only reset available');
        throw new Error('MANUAL_CONSENT_ONLY');
      }

      // If form is not available, user is not in regulated region
      if (!consentInfo.isConsentFormAvailable) {
        logger.info(
          'consent',
          'Consent form not available - user not in regulated region',
        );
        throw new Error('MANUAL_CONSENT_ONLY');
      }

      const formResult = await AdsConsent.showForm();
      this.consentStatus = formResult.status;
      this.manuallyAccepted = false;

      logger.info(
        'consent',
        `Consent updated. New status: ${formResult.status}`,
      );
      await AsyncStorage.removeItem(MANUAL_CONSENT_KEY);
      await this.saveConsentStatus();
      this.notifyListeners();
    } catch (error) {
      const errorMsg = String(error);

      // Handle "No available form" error - treat as manual consent only
      if (errorMsg.includes('No available form can be built')) {
        logger.info(
          'consent',
          'No consent form available - treating as manual consent',
        );
        throw new Error('MANUAL_CONSENT_ONLY');
      }

      logger.error('consent', `Failed to show consent form: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Show the UMP "privacy options" form — the persistent entry point Google
   * requires whenever a message is active. It serves BOTH the GDPR/EEA/UK/CH
   * consent message AND the US-states (CCPA/CPRA...) message; UMP shows the
   * right one for the user's region based on what is configured in the AdMob
   * console. Use this for the Settings "Privacy options" button.
   */
  async showPrivacyOptionsForm(): Promise<void> {
    try {
      logger.info('consent', 'Showing privacy options form...');
      const formResult = await AdsConsent.showPrivacyOptionsForm();
      this.consentStatus = formResult.status;
      this.manuallyAccepted = false;
      this.privacyOptionsRequired =
        formResult.privacyOptionsRequirementStatus ===
        AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
      await AsyncStorage.removeItem(MANUAL_CONSENT_KEY);
      await this.saveConsentStatus();
      this.notifyListeners();
      logger.info(
        'consent',
        `Privacy options updated. New status: ${formResult.status}`,
      );
    } catch (error) {
      logger.error(
        'consent',
        `Failed to show privacy options form: ${String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Whether the persistent privacy-options entry point must be shown to this
   * user (true in the EEA/UK/CH and in US states with an active message).
   */
  isPrivacyOptionsRequired(): boolean {
    return this.privacyOptionsRequired;
  }

  /**
   * Reset consent for testing purposes
   * This will cause the consent form to show again
   */
  async resetConsent(): Promise<void> {
    try {
      logger.info('consent', 'Resetting consent...');
      await AdsConsent.reset();
      await AsyncStorage.removeMany([
        STORAGE_KEY,
        CONSENT_STATUS_KEY,
        MANUAL_CONSENT_KEY,
      ]);
      this.consentStatus = AdsConsentStatus.UNKNOWN;
      this.manuallyAccepted = false;
      this.privacyOptionsRequired = false;
      this.notifyListeners();
      logger.info('consent', 'Consent reset complete');
    } catch (error) {
      logger.error('consent', `Failed to reset consent: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Get current consent status
   */
  getConsentStatus(): AdsConsentStatus {
    return this.consentStatus;
  }

  /**
   * Check if user has consented to personalized ads
   */
  canShowPersonalizedAds(): boolean {
    return this.consentStatus === AdsConsentStatus.OBTAINED;
  }

  /**
   * Check if consent is required (user hasn't made a choice yet)
   */
  isConsentRequired(): boolean {
    return this.consentStatus === AdsConsentStatus.REQUIRED;
  }

  /**
   * Get privacy policy URL
   */
  getPrivacyPolicyUrl(): string {
    return PRIVACY_POLICY_URL;
  }

  /**
   * Get user-friendly status text
   */
  getConsentStatusText(): string {
    if (this.manuallyAccepted) {
      return 'Accepted - Privacy terms agreed';
    }

    switch (this.consentStatus) {
      case AdsConsentStatus.OBTAINED:
        return 'Consented to personalized ads';
      case AdsConsentStatus.NOT_REQUIRED:
        return 'Not required (outside EEA/UK)';
      case AdsConsentStatus.REQUIRED:
        return 'Consent required';
      case AdsConsentStatus.UNKNOWN:
      default:
        return 'Unknown - will use non-personalized ads';
    }
  }

  /**
   * Check if user has manually accepted consent
   */
  isManuallyAccepted(): boolean {
    return this.manuallyAccepted;
  }

  /**
   * Add listener for consent status changes
   */
  addListener(listener: ConsentStatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.consentStatus);
      } catch (error) {
        logger.error('consent', `Listener error: ${String(error)}`);
      }
    });
  }

  /**
   * Get detailed consent information
   */
  async getConsentInfo(): Promise<{
    status: AdsConsentStatus;
    isConsentFormAvailable: boolean;
    canRequestAds: boolean;
    privacyOptionsRequired: boolean;
  }> {
    try {
      const info = await AdsConsent.requestInfoUpdate();
      return {
        status: info.status,
        isConsentFormAvailable: info.isConsentFormAvailable,
        canRequestAds: info.canRequestAds,
        privacyOptionsRequired:
          info.privacyOptionsRequirementStatus === 'REQUIRED',
      };
    } catch (error) {
      logger.error('consent', `Failed to get consent info: ${String(error)}`);
      return {
        status: this.consentStatus,
        isConsentFormAvailable: false,
        canRequestAds: true, // Fallback to non-personalized ads
        privacyOptionsRequired: false,
      };
    }
  }
}

export const consentService = new ConsentService();
