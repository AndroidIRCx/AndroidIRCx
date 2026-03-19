/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect } from 'react';
import { initializeAppCheck } from '@react-native-firebase/app-check';
import { getApp } from '@react-native-firebase/app';
import { ReactNativeFirebaseAppCheckProvider } from '@react-native-firebase/app-check';
import MobileAds from 'react-native-google-mobile-ads';
import RNBootSplash from 'react-native-bootsplash';
import { consentService } from '../services/ConsentService';
import { settingsService } from '../services/SettingsService';
import { adRewardService } from '../services/AdRewardService';
import { inAppPurchaseService } from '../services/InAppPurchaseService';
import { bannerAdService } from '../services/BannerAdService';
import { errorReportingService } from '../services/ErrorReportingService';
import { soundService } from '../services/SoundService';
import { privacyRelayService } from '../services/PrivacyRelayService';
import { debugLogger } from '../services/DebugLogger';

// ErrorUtils is available globally in React Native
declare const ErrorUtils: {
  getGlobalHandler: () => ((error: Error, isFatal?: boolean) => void) | null;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

/**
 * Hook to handle app initialization including Firebase App Check,
 * consent management, AdMob, and error reporting
 */
export function useAppInitialization() {
  useEffect(() => {
    // Initialize Firebase App Check using modular API
    // 
    // Play Integrity Requirements (for production):
    // 1. App must be uploaded/published to Google Play Console
    // 2. SHA-256 certificate fingerprint must be registered in Google Play Console
    //    (Go to: Play Console > Your App > Setup > App Integrity > App signing)
    // 3. Play Integrity API must be enabled in Google Play Console
    //    (Go to: Play Console > Your App > Setup > App Integrity)
    // 4. App must be signed with the correct signing key
    // 5. Package name must match: com.androidircx
    //
    // Debug mode uses debug provider (no Play Integrity required)
    const initAppCheck = async () => {
      try {
        debugLogger.debug('appInitialization', 'Initializing Firebase App Check');
        const app = getApp();
        debugLogger.debug('appInitialization', 'Firebase app instance obtained');
        
        const rnfbProvider = new ReactNativeFirebaseAppCheckProvider();
        debugLogger.debug('appInitialization', 'ReactNativeFirebaseAppCheckProvider created');
        
        const providerConfig = {
          android: {
            provider: __DEV__ ? 'debug' : 'playIntegrity',
          },
          apple: {
            provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
          },
          web: {
            provider: 'reCaptchaV3',
            siteKey: 'none',
          },
        };
        
        debugLogger.debug('appInitialization', 'Configuring App Check provider', providerConfig);
        rnfbProvider.configure(providerConfig);
        debugLogger.debug('appInitialization', 'App Check provider configured');
        
        debugLogger.debug('appInitialization', 'Initializing App Check');
        await initializeAppCheck(app, {
          provider: rnfbProvider,
          isTokenAutoRefreshEnabled: true,
        });
        debugLogger.debug('appInitialization', 'App Check initialized successfully');
      } catch (error: any) {
        console.error('❌ App Check initialization failed:', error);
        console.error('Error details:', {
          message: error?.message,
          code: error?.code,
          stack: error?.stack,
        });
        // Don't throw - App Check is not critical for app functionality
        // Play Integrity might fail if:
        // 1. App not published/uploaded to Google Play Console
        // 2. SHA-256 certificate fingerprint not registered
        // 3. Play Integrity API not enabled in Google Play Console
        // 4. App not signed with the correct key
      }
    };
    initAppCheck();

    const initPrivacyRelay = async () => {
      try {
        await privacyRelayService.initialize();
        debugLogger.debug('appInitialization', 'PrivacyRelayService initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize PrivacyRelayService:', error);
      }
    };
    initPrivacyRelay();

    // Initialize consent management and AdMob
    const initAdsWithConsent = async () => {
      try {
        // Step 1: Initialize UMP SDK for consent (GDPR/CCPA compliance)
        debugLogger.debug('appInitialization', 'Initializing consent management');
        await consentService.initialize(__DEV__); // Enable debug mode in development
        debugLogger.debug('appInitialization', 'Consent service initialized');

        // Step 2: Show consent form if required (first launch in EEA/UK)
        // Skip showing consent form on first run - it will be shown in FirstRunSetupScreen
        const isFirstRun = await settingsService.isFirstRun();
        if (!isFirstRun) {
          await consentService.showConsentFormIfRequired();
        } else {
          debugLogger.debug('appInitialization', 'Skipping consent form on first run');
        }

        // Step 3: Initialize AdMob after consent is handled
        debugLogger.debug('appInitialization', 'Starting AdMob initialization');
        const adapterStatuses = await MobileAds().initialize();
        debugLogger.debug('appInitialization', 'AdMob initialized successfully', adapterStatuses);

        // Check if adapters are ready
        const allReady = adapterStatuses.every((adapter: any) => adapter.state === 1);
        if (!allReady) {
          console.warn('⚠️ WARNING: Not all ad adapters are ready!');
          console.warn('This could be due to:');
          console.warn('1. Network connectivity issues');
          console.warn('2. AdMob account/app approval pending');
          console.warn('3. Some mediation adapters not configured');
          console.warn('4. Running in emulator/test environment');
          debugLogger.warn('appInitialization', 'Not all AdMob adapters are ready');
        } else {
          debugLogger.debug('appInitialization', 'All AdMob adapters ready');
        }

        // Step 4: Initialize AdRewardService after consent & AdMob are ready
        debugLogger.debug('appInitialization', 'Initializing AdRewardService');
        await adRewardService.initialize();
        debugLogger.debug('appInitialization', 'AdRewardService initialized successfully');

        // Step 5: Initialize InAppPurchaseService
        debugLogger.debug('appInitialization', 'Initializing InAppPurchaseService');
        await inAppPurchaseService.initialize();
        debugLogger.debug('appInitialization', 'InAppPurchaseService initialized successfully');

        // Step 6: Initialize BannerAdService
        debugLogger.debug('appInitialization', 'Initializing BannerAdService');
        await bannerAdService.initialize();
        debugLogger.debug('appInitialization', 'BannerAdService initialized successfully');

        // Step 7: Initialize SoundService
        debugLogger.debug('appInitialization', 'Initializing SoundService');
        await soundService.initialize();
        debugLogger.debug('appInitialization', 'SoundService initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize ads with consent:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
      }
    };

    initAdsWithConsent();

    errorReportingService.initialize();
    if (typeof ErrorUtils !== 'undefined') {
      const originalHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        console.error('Global error handler:', error, 'isFatal:', isFatal);
        console.error('Error stack:', error.stack);
        errorReportingService.report(error, { fatal: isFatal !== false, source: 'globalErrorHandler' });
        // Try to hide bootsplash even on fatal error
        if (isFatal) {
          RNBootSplash.hide({ fade: false }).catch(() => { });
        }
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });

      return () => {
        if (typeof ErrorUtils !== 'undefined' && originalHandler) {
          ErrorUtils.setGlobalHandler(originalHandler);
        }
      };
    }
  }, []);
}
