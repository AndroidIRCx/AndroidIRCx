/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NativeModules, Platform } from 'react-native';

/**
 * Play Integrity API response structure
 * This matches the response format from Google Play Integrity API
 */
export interface PlayIntegrityReport {
  requestDetails: {
    requestPackageName: string;
    timestampMillis: string;
    nonce: string;
  };
  appIntegrity: {
    appRecognitionVerdict:
      | 'PLAY_RECOGNIZED'
      | 'UNRECOGNIZED_VERSION'
      | 'UNEVALUATED';
    packageName: string;
    certificateSha256Digest: string[];
    versionCode: string;
  };
  deviceIntegrity: {
    deviceRecognitionVerdict: Array<
      | 'MEETS_BASIC_INTEGRITY'
      | 'MEETS_DEVICE_INTEGRITY'
      | 'MEETS_STRONG_INTEGRITY'
    >;
    recentDeviceActivity?: {
      deviceActivityLevel: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
    };
    deviceAttributes?: {
      sdkVersion: number;
    };
  };
  accountDetails: {
    appLicensingVerdict: 'LICENSED' | 'UNLICENSED' | 'UNEVALUATED';
  };
  environmentDetails: {
    playProtectVerdict: 'NO_ISSUES' | 'HAS_ISSUES' | 'UNEVALUATED';
    appAccessRiskVerdict?: {
      appsDetected: Array<
        | 'KNOWN_INSTALLED'
        | 'UNKNOWN_INSTALLED'
        | 'UNKNOWN_CAPTURING'
        | 'UNKNOWN_MANIPULATING'
      >;
    };
  };
}

/**
 * Play Integrity token response
 */
export interface PlayIntegrityToken {
  token: string;
  error?: string;
}

/**
 * Service for interacting with Google Play Integrity API
 *
 * Note: To get a detailed integrity report like the one shown, you need to:
 * 1. Get an integrity token using requestIntegrityToken()
 * 2. Send the token to your backend server
 * 3. Your backend server verifies the token with Google Play Integrity API
 * 4. Google Play Integrity API returns the detailed report
 *
 * The detailed report cannot be obtained directly on the client side for security reasons.
 */
class PlayIntegrityService {
  private isAvailable: boolean = false;

  /**
   * Check if Play Integrity API is available on this device
   */
  public async checkAvailability(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      // Check if native module is available
      // This will be implemented as a native module
      this.isAvailable = true;
      return true;
    } catch (error) {
      console.warn('Play Integrity API not available:', error);
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Request an integrity token from Play Integrity API
   *
   * @param nonce Optional nonce for request verification (base64 encoded)
   * @returns Integrity token that can be verified on backend
   */
  public async requestIntegrityToken(
    nonce?: string,
  ): Promise<PlayIntegrityToken> {
    if (Platform.OS !== 'android') {
      return {
        token: '',
        error: 'Play Integrity API is only available on Android',
      };
    }

    if (!this.isAvailable) {
      const available = await this.checkAvailability();
      if (!available) {
        return {
          token: '',
          error: 'Play Integrity API is not available on this device',
        };
      }
    }

    try {
      // Generate nonce if not provided
      const requestNonce = nonce || this.generateNonce();

      // Call native module to get integrity token
      const { PlayIntegrityModule } = NativeModules;

      if (!PlayIntegrityModule) {
        return {
          token: '',
          error:
            'Play Integrity native module not found. Make sure PlayIntegrityPackage is registered.',
        };
      }

      try {
        const result =
          await PlayIntegrityModule.requestIntegrityToken(requestNonce);
        // Native module returns { token: "..." } format
        const token = result?.token || '';
        if (!token) {
          return {
            token: '',
            error: 'Empty token received from Play Integrity API',
          };
        }
        return { token };
      } catch (error: any) {
        return {
          token: '',
          error: error?.message || 'Failed to get integrity token',
        };
      }
    } catch (error: any) {
      console.error('Failed to request Play Integrity token:', error);
      return {
        token: '',
        error: error?.message || 'Unknown error requesting integrity token',
      };
    }
  }

  /**
   * Generate a random nonce for integrity token request
   */
  private generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Verify integrity token on backend and get detailed report
   *
   * This method sends the token to your backend server, which then
   * verifies it with Google Play Integrity API and returns the detailed report.
   *
   * @param token Integrity token from requestIntegrityToken()
   * @param backendUrl Your backend endpoint that verifies the token
   * @returns Detailed integrity report
   */
  public async getIntegrityReport(
    token: string,
    backendUrl: string,
  ): Promise<PlayIntegrityReport | null> {
    if (!token) {
      console.error('No integrity token provided');
      return null;
    }

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error(`Backend verification failed: ${response.status}`);
      }

      const responseData = await response.json();
      // Backend can return report directly or wrapped in { success: true, report: {...} }
      const report: PlayIntegrityReport = responseData.report || responseData;
      return report;
    } catch (error: any) {
      console.error('Failed to get integrity report from backend:', error);
      return null;
    }
  }

  /**
   * Get a simplified integrity status (client-side only)
   * This uses Firebase App Check token if available
   *
   * Note: This is a simplified check. For detailed report with all verdicts,
   * use getIntegrityReport() with backend verification.
   */
  public async getSimpleIntegrityStatus(): Promise<{
    isPlayRecognized: boolean;
    meetsBasicIntegrity: boolean;
    meetsDeviceIntegrity: boolean;
    meetsStrongIntegrity: boolean;
    isLicensed: boolean;
    hasToken: boolean;
  } | null> {
    // This is a simplified check using Firebase App Check
    // For detailed report, use getIntegrityReport() with backend verification
    try {
      const appCheck = require('@react-native-firebase/app-check').default();

      // Try to get App Check token
      const token = await appCheck.getToken();

      // If we can get App Check token, it means Play Integrity is working
      // But we can't get detailed verdicts without backend verification
      return {
        isPlayRecognized: !!token, // Assumed if token exists
        meetsBasicIntegrity: !!token,
        meetsDeviceIntegrity: !!token,
        meetsStrongIntegrity: !!token,
        isLicensed: !!token,
        hasToken: !!token,
      };
    } catch (error) {
      console.warn('Could not get simple integrity status:', error);
      return {
        isPlayRecognized: false,
        meetsBasicIntegrity: false,
        meetsDeviceIntegrity: false,
        meetsStrongIntegrity: false,
        isLicensed: false,
        hasToken: false,
      };
    }
  }
}

export const playIntegrityService = new PlayIntegrityService();
