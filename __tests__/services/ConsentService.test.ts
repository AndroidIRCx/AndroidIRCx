/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ConsentService
 */

import { consentService } from '../../src/services/ConsentService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';
import { logger } from '../../src/services/Logger';

// Mock logger to avoid noise
jest.mock('../../src/services/Logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ConsentService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();

    // Reset service state
    // @ts-ignore - accessing private property
    consentService.initialized = false;
    // @ts-ignore
    consentService.consentStatus = AdsConsentStatus.UNKNOWN;
    // @ts-ignore
    consentService.manuallyAccepted = false;
    // @ts-ignore
    consentService.listeners = new Set();
  });

  describe('initialize', () => {
    it('should initialize consent service', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.NOT_REQUIRED,
        isConsentFormAvailable: false,
        canRequestAds: true,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      expect(mockRequestInfoUpdate).toHaveBeenCalled();
      expect(consentService.getConsentStatus()).toBe(
        AdsConsentStatus.NOT_REQUIRED,
      );
    });

    it('should not initialize twice', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.NOT_REQUIRED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);
      await consentService.initialize(false);

      // Should only be called once
      expect(mockRequestInfoUpdate).toHaveBeenCalledTimes(1);
    });

    it('should handle debug mode', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.NOT_REQUIRED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(true);

      expect(mockRequestInfoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          debugGeography: expect.any(Number),
          testDeviceIdentifiers: ['TEST-DEVICE-HASHED-ID'],
        }),
      );
    });

    it('should handle initialization errors gracefully', async () => {
      const mockRequestInfoUpdate = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await expect(consentService.initialize(false)).resolves.not.toThrow();
    });

    it('should use manual consent if previously accepted', async () => {
      await AsyncStorage.setItem('@AndroidIRCX:manualConsent', 'true');

      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.REQUIRED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      expect(consentService.isManuallyAccepted()).toBe(true);
      expect(consentService.getConsentStatus()).toBe(
        AdsConsentStatus.NOT_REQUIRED,
      );
    });

    it('should use UMP status when not manually accepted', async () => {
      // Even if saved status exists, UMP status takes precedence unless manually accepted
      await AsyncStorage.setItem(
        '@AndroidIRCX:consentStatus',
        String(AdsConsentStatus.OBTAINED),
      );

      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.NOT_REQUIRED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      // UMP status is used when not manually accepted
      expect(consentService.getConsentStatus()).toBe(
        AdsConsentStatus.NOT_REQUIRED,
      );
    });

    it('should log when consent is required and form is available', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.REQUIRED,
        isConsentFormAvailable: true,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      expect(logger.info).toHaveBeenCalledWith(
        'consent',
        'Consent required - will show form',
      );
    });

    it('should keep loaded saved status when UMP init fails', async () => {
      await AsyncStorage.setItem(
        '@AndroidIRCX:consentStatus',
        String(AdsConsentStatus.REQUIRED),
      );

      const mockRequestInfoUpdate = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));
      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      expect(consentService.getConsentStatus()).toBe(AdsConsentStatus.REQUIRED);
    });

    it('should log when loading saved consent fails', async () => {
      jest
        .spyOn(AsyncStorage, 'getItem')
        .mockRejectedValueOnce(new Error('load failed'));
      const mockRequestInfoUpdate = jest
        .fn()
        .mockRejectedValue(new Error('ump failed'));
      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      expect(logger.error).toHaveBeenCalledWith(
        'consent',
        expect.stringContaining('Failed to load saved consent:'),
      );
    });
  });

  describe('acceptConsentManually', () => {
    it('should accept consent manually', async () => {
      await consentService.acceptConsentManually();

      expect(consentService.isManuallyAccepted()).toBe(true);
      expect(consentService.getConsentStatus()).toBe(
        AdsConsentStatus.NOT_REQUIRED,
      );
    });

    it('should save manual consent to storage', async () => {
      await consentService.acceptConsentManually();

      const saved = await AsyncStorage.getItem('@AndroidIRCX:manualConsent');
      expect(saved).toBe('true');
    });

    it('should notify listeners on manual accept', async () => {
      const listener = jest.fn();
      consentService.addListener(listener);

      await consentService.acceptConsentManually();

      expect(listener).toHaveBeenCalledWith(AdsConsentStatus.NOT_REQUIRED);
    });

    it('should throw if saving manual consent fails', async () => {
      jest
        .spyOn(AsyncStorage, 'setItem')
        .mockRejectedValueOnce(new Error('save failed'));

      await expect(consentService.acceptConsentManually()).rejects.toThrow(
        'save failed',
      );
    });

    it('should log when saving consent status fails internally', async () => {
      jest
        .spyOn(AsyncStorage, 'setItem')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('status save failed'))
        .mockResolvedValueOnce(undefined);

      await consentService.acceptConsentManually();

      expect(logger.error).toHaveBeenCalledWith(
        'consent',
        expect.stringContaining('Failed to save consent:'),
      );
      expect(consentService.isManuallyAccepted()).toBe(true);
      expect(consentService.getConsentStatus()).toBe(
        AdsConsentStatus.NOT_REQUIRED,
      );
    });
  });

  describe('showConsentFormIfRequired', () => {
    it('should show form if required', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.REQUIRED,
        isConsentFormAvailable: true,
      });

      const mockShowForm = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.OBTAINED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;
      (AdsConsent.showForm as jest.Mock) = mockShowForm;

      const result = await consentService.showConsentFormIfRequired();

      expect(result).toBe(true);
      expect(mockShowForm).toHaveBeenCalled();
      expect(consentService.getConsentStatus()).toBe(AdsConsentStatus.OBTAINED);
    });

    it('should not show form if not required', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.NOT_REQUIRED,
        isConsentFormAvailable: true,
      });

      const mockShowForm = jest.fn();

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;
      (AdsConsent.showForm as jest.Mock) = mockShowForm;

      const result = await consentService.showConsentFormIfRequired();

      expect(result).toBe(false);
      expect(mockShowForm).not.toHaveBeenCalled();
    });

    it('should handle form not available', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.REQUIRED,
        isConsentFormAvailable: false,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      const result = await consentService.showConsentFormIfRequired();

      expect(result).toBe(false);
    });

    it('should handle form errors', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.REQUIRED,
        isConsentFormAvailable: true,
      });

      const mockShowForm = jest.fn().mockRejectedValue(new Error('Form error'));

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;
      (AdsConsent.showForm as jest.Mock) = mockShowForm;

      const result = await consentService.showConsentFormIfRequired();

      expect(result).toBe(false);
    });

    it('should clear manual consent after required form is completed', async () => {
      // @ts-ignore
      consentService.manuallyAccepted = true;

      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.REQUIRED,
        isConsentFormAvailable: true,
      });
      const mockShowForm = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.OBTAINED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;
      (AdsConsent.showForm as jest.Mock) = mockShowForm;

      await consentService.showConsentFormIfRequired();

      expect(consentService.isManuallyAccepted()).toBe(false);
    });
  });

  describe('showConsentForm', () => {
    it('should show consent form for settings', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.NOT_REQUIRED,
        isConsentFormAvailable: true,
      });

      const mockShowForm = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.OBTAINED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;
      (AdsConsent.showForm as jest.Mock) = mockShowForm;

      await consentService.showConsentForm();

      expect(mockShowForm).toHaveBeenCalled();
    });

    it('should throw MANUAL_CONSENT_ONLY if manually accepted', async () => {
      await consentService.acceptConsentManually();

      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        isConsentFormAvailable: true,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await expect(consentService.showConsentForm()).rejects.toThrow(
        'MANUAL_CONSENT_ONLY',
      );
    });

    it('should throw MANUAL_CONSENT_ONLY if form not available', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        isConsentFormAvailable: false,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await expect(consentService.showConsentForm()).rejects.toThrow(
        'MANUAL_CONSENT_ONLY',
      );
    });

    it('should handle "No available form" error', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        isConsentFormAvailable: true,
      });

      const mockShowForm = jest
        .fn()
        .mockRejectedValue(new Error('No available form can be built'));

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;
      (AdsConsent.showForm as jest.Mock) = mockShowForm;

      await expect(consentService.showConsentForm()).rejects.toThrow(
        'MANUAL_CONSENT_ONLY',
      );
    });

    it('should rethrow other form errors', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        isConsentFormAvailable: true,
      });
      const mockShowForm = jest
        .fn()
        .mockRejectedValue(new Error('Unexpected form failure'));

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;
      (AdsConsent.showForm as jest.Mock) = mockShowForm;

      await expect(consentService.showConsentForm()).rejects.toThrow(
        'Unexpected form failure',
      );
    });
  });

  describe('resetConsent', () => {
    it('should reset consent state', async () => {
      await consentService.acceptConsentManually();

      const mockReset = jest.fn().mockResolvedValue(undefined);
      (AdsConsent.reset as jest.Mock) = mockReset;

      await consentService.resetConsent();

      expect(consentService.getConsentStatus()).toBe(AdsConsentStatus.UNKNOWN);
      expect(consentService.isManuallyAccepted()).toBe(false);
      expect(mockReset).toHaveBeenCalled();
    });

    it('should clear stored consent data', async () => {
      await AsyncStorage.setItem('@AndroidIRCX:consentShown', 'true');
      await AsyncStorage.setItem('@AndroidIRCX:consentStatus', '3');
      await AsyncStorage.setItem('@AndroidIRCX:manualConsent', 'true');

      const mockReset = jest.fn().mockResolvedValue(undefined);
      (AdsConsent.reset as jest.Mock) = mockReset;

      await consentService.resetConsent();

      const shown = await AsyncStorage.getItem('@AndroidIRCX:consentShown');
      const status = await AsyncStorage.getItem('@AndroidIRCX:consentStatus');
      const manual = await AsyncStorage.getItem('@AndroidIRCX:manualConsent');

      expect(shown).toBeNull();
      expect(status).toBeNull();
      expect(manual).toBeNull();
    });

    it('should notify listeners on reset', async () => {
      const listener = jest.fn();
      consentService.addListener(listener);

      const mockReset = jest.fn().mockResolvedValue(undefined);
      (AdsConsent.reset as jest.Mock) = mockReset;

      await consentService.resetConsent();

      expect(listener).toHaveBeenCalledWith(AdsConsentStatus.UNKNOWN);
    });

    it('should handle reset errors', async () => {
      const mockReset = jest.fn().mockRejectedValue(new Error('Reset error'));
      (AdsConsent.reset as jest.Mock) = mockReset;

      await expect(consentService.resetConsent()).rejects.toThrow(
        'Reset error',
      );
    });
  });

  describe('getConsentStatus', () => {
    it('should return current consent status', async () => {
      await consentService.acceptConsentManually();

      expect(consentService.getConsentStatus()).toBe(
        AdsConsentStatus.NOT_REQUIRED,
      );
    });
  });

  describe('canShowPersonalizedAds', () => {
    it('should return true when consent is obtained', async () => {
      await AsyncStorage.setItem(
        '@AndroidIRCX:consentStatus',
        String(AdsConsentStatus.OBTAINED),
      );

      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.OBTAINED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      expect(consentService.canShowPersonalizedAds()).toBe(true);
    });

    it('should return false when consent is not obtained', async () => {
      await AsyncStorage.setItem(
        '@AndroidIRCX:consentStatus',
        String(AdsConsentStatus.REQUIRED),
      );

      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.REQUIRED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      expect(consentService.canShowPersonalizedAds()).toBe(false);
    });
  });

  describe('isConsentRequired', () => {
    it('should return true when status is REQUIRED', async () => {
      await AsyncStorage.setItem(
        '@AndroidIRCX:consentStatus',
        String(AdsConsentStatus.REQUIRED),
      );

      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.REQUIRED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      expect(consentService.isConsentRequired()).toBe(true);
    });

    it('should return false when status is not REQUIRED', async () => {
      await consentService.acceptConsentManually();

      expect(consentService.isConsentRequired()).toBe(false);
    });
  });

  describe('getPrivacyPolicyUrl', () => {
    it('should return privacy policy URL', () => {
      const url = consentService.getPrivacyPolicyUrl();

      expect(url).toBe('https://androidircx.com/privacy');
    });
  });

  describe('getConsentStatusText', () => {
    it('should return text for manual acceptance', async () => {
      await consentService.acceptConsentManually();

      const text = consentService.getConsentStatusText();

      expect(text).toContain('Accepted');
    });

    it('should return text for obtained status', async () => {
      await AsyncStorage.setItem(
        '@AndroidIRCX:consentStatus',
        String(AdsConsentStatus.OBTAINED),
      );

      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.OBTAINED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      const text = consentService.getConsentStatusText();

      expect(text).toContain('Consented');
    });

    it('should return text for not required status', async () => {
      await AsyncStorage.setItem(
        '@AndroidIRCX:consentStatus',
        String(AdsConsentStatus.NOT_REQUIRED),
      );

      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.NOT_REQUIRED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      const text = consentService.getConsentStatusText();

      expect(text).toContain('Not required');
    });

    it('should return text for required status', async () => {
      await AsyncStorage.setItem(
        '@AndroidIRCX:consentStatus',
        String(AdsConsentStatus.REQUIRED),
      );

      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.REQUIRED,
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      await consentService.initialize(false);

      const text = consentService.getConsentStatusText();

      expect(text).toContain('required');
    });

    it('should return text for unknown status', async () => {
      const text = consentService.getConsentStatusText();

      expect(text).toContain('Unknown');
    });
  });

  describe('isManuallyAccepted', () => {
    it('should return true after manual acceptance', async () => {
      expect(consentService.isManuallyAccepted()).toBe(false);

      await consentService.acceptConsentManually();

      expect(consentService.isManuallyAccepted()).toBe(true);
    });
  });

  describe('addListener', () => {
    it('should add and remove listener', async () => {
      const listener = jest.fn();

      const unsubscribe = consentService.addListener(listener);

      // Trigger notification
      await consentService.acceptConsentManually();
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Reset consent status
      const mockReset = jest.fn().mockResolvedValue(undefined);
      (AdsConsent.reset as jest.Mock) = mockReset;
      await consentService.resetConsent();

      // Listener should NOT be called again after unsubscribe
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', async () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });

      consentService.addListener(errorListener);

      // Should not throw
      await expect(
        consentService.acceptConsentManually(),
      ).resolves.not.toThrow();
    });

    it('should allow unsubscribe to be called more than once', async () => {
      const listener = jest.fn();
      const unsubscribe = consentService.addListener(listener);

      unsubscribe();
      unsubscribe();

      await consentService.acceptConsentManually();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getConsentInfo', () => {
    it('should return consent info', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.OBTAINED,
        isConsentFormAvailable: true,
        canRequestAds: true,
        privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      const info = await consentService.getConsentInfo();

      expect(info.status).toBe(AdsConsentStatus.OBTAINED);
      expect(info.isConsentFormAvailable).toBe(true);
      expect(info.canRequestAds).toBe(true);
      expect(info.privacyOptionsRequired).toBe(false);
    });

    it('should handle errors and return fallback', async () => {
      const mockRequestInfoUpdate = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      const info = await consentService.getConsentInfo();

      expect(info.canRequestAds).toBe(true); // Fallback
      expect(info.isConsentFormAvailable).toBe(false);
    });

    it('should indicate privacy options required when status is REQUIRED', async () => {
      const mockRequestInfoUpdate = jest.fn().mockResolvedValue({
        status: AdsConsentStatus.OBTAINED,
        privacyOptionsRequirementStatus: 'REQUIRED',
      });

      (AdsConsent.requestInfoUpdate as jest.Mock) = mockRequestInfoUpdate;

      const info = await consentService.getConsentInfo();

      expect(info.privacyOptionsRequired).toBe(true);
    });
  });
});
