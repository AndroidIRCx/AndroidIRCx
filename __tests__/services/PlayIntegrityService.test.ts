/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for PlayIntegrityService
 * Tests the service logic without full React Native environment
 */

// Create mock module - must be defined before jest.mock
const mockRequestIntegrityToken = jest.fn();
const mockIsAvailable = jest.fn();
const mockAppCheckGetToken = jest.fn();
const mockAppCheckFactory = jest.fn(() => ({
  getToken: mockAppCheckGetToken,
}));

// Mock react-native without requireActual to avoid TurboModule issues
jest.mock('react-native', () => {
  // Create fresh mock module for each test
  return {
    NativeModules: {
      get PlayIntegrityModule() {
        return {
          requestIntegrityToken: mockRequestIntegrityToken,
          isAvailable: mockIsAvailable,
        };
      },
    },
    Platform: {
      OS: 'android',
      select: jest.fn((obj: any) => obj.android),
    },
  };
});

jest.mock(
  '@react-native-firebase/app-check',
  () => ({
    default: mockAppCheckFactory,
  }),
  { virtual: true },
);

// Mock crypto for nonce generation
const mockCryptoGetRandomValues = jest.fn((array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
});

global.crypto = {
  getRandomValues: mockCryptoGetRandomValues,
} as any;

// Mock fetch for backend calls
global.fetch = jest.fn();

// Mock btoa for base64 encoding
global.btoa = jest.fn((str: string) => {
  return Buffer.from(str, 'binary').toString('base64');
});

// Import after mocks
import { playIntegrityService } from '../../src/services/PlayIntegrityService';

describe('PlayIntegrityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestIntegrityToken.mockClear();
    mockIsAvailable.mockClear();
    mockAppCheckFactory.mockClear();
    mockAppCheckGetToken.mockClear();
    mockCryptoGetRandomValues.mockClear();
    (global.fetch as jest.Mock).mockClear();
    const RN = require('react-native');
    RN.Platform.OS = 'android';
    (playIntegrityService as any).isAvailable = false;
  });

  describe('checkAvailability', () => {
    it('should return true on Android when module is available', async () => {
      const result = await playIntegrityService.checkAvailability();
      expect(result).toBe(true);
    });

    it('should return false on non-Android platforms', async () => {
      const RN = require('react-native');
      RN.Platform.OS = 'ios';

      const result = await playIntegrityService.checkAvailability();

      expect(result).toBe(false);
    });
  });

  describe('requestIntegrityToken', () => {
    it('should return Android-only error on iOS', async () => {
      const RN = require('react-native');
      RN.Platform.OS = 'ios';

      const result = await playIntegrityService.requestIntegrityToken();

      expect(result).toEqual({
        token: '',
        error: 'Play Integrity API is only available on Android',
      });
      expect(mockRequestIntegrityToken).not.toHaveBeenCalled();
    });

    it('should request integrity token successfully', async () => {
      const mockToken = 'test_integrity_token_12345';
      mockRequestIntegrityToken.mockResolvedValue({
        token: mockToken,
      });

      const result = await playIntegrityService.requestIntegrityToken();

      expect(result.token).toBe(mockToken);
      expect(result.error).toBeUndefined();
      expect(mockRequestIntegrityToken).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when requesting token', async () => {
      const errorMessage = 'Play Integrity API unavailable';
      mockRequestIntegrityToken.mockRejectedValue(new Error(errorMessage));

      const result = await playIntegrityService.requestIntegrityToken();

      expect(result.token).toBe('');
      expect(result.error).toBe(errorMessage);
      expect(mockRequestIntegrityToken).toHaveBeenCalledTimes(1);
    });

    it('should use fallback error when rejection has no message', async () => {
      mockRequestIntegrityToken.mockRejectedValue(undefined);

      const result = await playIntegrityService.requestIntegrityToken();

      expect(result).toEqual({
        token: '',
        error: 'Failed to get integrity token',
      });
    });

    it('should generate nonce if not provided', async () => {
      const mockToken = 'test_token';
      mockRequestIntegrityToken.mockResolvedValue({
        token: mockToken,
      });

      await playIntegrityService.requestIntegrityToken();

      expect(mockRequestIntegrityToken).toHaveBeenCalledTimes(1);
      const callArgs = mockRequestIntegrityToken.mock.calls[0];
      expect(callArgs.length).toBeGreaterThan(0);
      expect(callArgs[0]).toBeDefined();
      expect(typeof callArgs[0]).toBe('string');
      expect(callArgs[0].length).toBeGreaterThan(0);
    });

    it('should use provided nonce', async () => {
      const mockToken = 'test_token';
      const customNonce = 'custom_nonce_base64_string_here';
      mockRequestIntegrityToken.mockResolvedValue({
        token: mockToken,
      });

      const result =
        await playIntegrityService.requestIntegrityToken(customNonce);

      expect(result.token).toBe(mockToken);
      expect(result.error).toBeUndefined();
      expect(mockRequestIntegrityToken).toHaveBeenCalledTimes(1);
      const callArgs = mockRequestIntegrityToken.mock.calls[0];
      expect(callArgs[0]).toBe(customNonce);
    });

    it('should return error if module not found', async () => {
      // Get reference to NativeModules
      const RN = require('react-native');
      const originalModule = RN.NativeModules.PlayIntegrityModule;

      // Remove the module
      delete RN.NativeModules.PlayIntegrityModule;

      const result = await playIntegrityService.requestIntegrityToken();

      expect(result.token).toBe('');
      expect(result.error).toContain('not found');

      // Restore module
      RN.NativeModules.PlayIntegrityModule = originalModule;
    });

    it('should return error if token is empty', async () => {
      mockRequestIntegrityToken.mockResolvedValue({
        token: '',
      });

      const result = await playIntegrityService.requestIntegrityToken();

      expect(result.token).toBe('');
      expect(result.error).toContain('Empty token');
    });

    it('should return unavailable error when availability check fails', async () => {
      jest
        .spyOn(playIntegrityService, 'checkAvailability')
        .mockResolvedValueOnce(false);

      const result = await playIntegrityService.requestIntegrityToken();

      expect(result).toEqual({
        token: '',
        error: 'Play Integrity API is not available on this device',
      });
      expect(mockRequestIntegrityToken).not.toHaveBeenCalled();
    });

    it('should handle unexpected nonce generation errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const originalGetRandomValues = global.crypto.getRandomValues;
      global.crypto.getRandomValues = jest.fn(() => {
        throw new Error('Random failure');
      }) as any;

      try {
        const result = await playIntegrityService.requestIntegrityToken();

        expect(result).toEqual({
          token: '',
          error: 'Random failure',
        });
      } finally {
        global.crypto.getRandomValues = originalGetRandomValues;
        consoleSpy.mockRestore();
      }
    });
  });

  describe('getIntegrityReport', () => {
    const mockReport = {
      requestDetails: {
        requestPackageName: 'com.androidircx',
        timestampMillis: '1617893780',
        nonce: 'test_nonce',
      },
      appIntegrity: {
        appRecognitionVerdict: 'PLAY_RECOGNIZED',
        packageName: 'com.androidircx',
        certificateSha256Digest: ['abc123'],
        versionCode: '56',
      },
      deviceIntegrity: {
        deviceRecognitionVerdict: [
          'MEETS_BASIC_INTEGRITY',
          'MEETS_DEVICE_INTEGRITY',
        ],
      },
      accountDetails: {
        appLicensingVerdict: 'LICENSED',
      },
      environmentDetails: {
        playProtectVerdict: 'NO_ISSUES',
      },
    };

    it('should fetch integrity report from backend', async () => {
      const mockToken = 'test_token';
      const backendUrl = 'https://api.example.com/verify-integrity';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          report: mockReport,
        }),
      });

      const result = await playIntegrityService.getIntegrityReport(
        mockToken,
        backendUrl,
      );

      expect(result).not.toBeNull();
      expect(result).toBeDefined();
      if (result) {
        expect(result.appIntegrity).toBeDefined();
        expect(result.appIntegrity?.appRecognitionVerdict).toBe(
          'PLAY_RECOGNIZED',
        );
        expect(result.deviceIntegrity).toBeDefined();
        expect(result.deviceIntegrity?.deviceRecognitionVerdict).toContain(
          'MEETS_BASIC_INTEGRITY',
        );
      }
      expect(global.fetch).toHaveBeenCalledWith(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: mockToken }),
      });
    });

    it('should handle backend response with report directly', async () => {
      const mockToken = 'test_token';
      const backendUrl = 'https://api.example.com/verify-integrity';

      // Backend returns report directly (not wrapped)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockReport,
      });

      const result = await playIntegrityService.getIntegrityReport(
        mockToken,
        backendUrl,
      );

      expect(result).not.toBeNull();
      expect(result?.appIntegrity?.appRecognitionVerdict).toBe(
        'PLAY_RECOGNIZED',
      );
    });

    it('should handle backend errors', async () => {
      const mockToken = 'test_token';
      const backendUrl = 'https://api.example.com/verify-integrity';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
      });

      const result = await playIntegrityService.getIntegrityReport(
        mockToken,
        backendUrl,
      );

      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      const mockToken = 'test_token';
      const backendUrl = 'https://api.example.com/verify-integrity';

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await playIntegrityService.getIntegrityReport(
        mockToken,
        backendUrl,
      );

      expect(result).toBeNull();
    });

    it('should return null for empty token', async () => {
      const result = await playIntegrityService.getIntegrityReport(
        '',
        'https://api.example.com',
      );

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getSimpleIntegrityStatus', () => {
    it('should return positive flags when App Check token exists', async () => {
      mockAppCheckGetToken.mockResolvedValueOnce('app-check-token');

      const result = await playIntegrityService.getSimpleIntegrityStatus();

      expect(mockAppCheckFactory).toHaveBeenCalledTimes(1);
      expect(mockAppCheckGetToken).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        isPlayRecognized: true,
        meetsBasicIntegrity: true,
        meetsDeviceIntegrity: true,
        meetsStrongIntegrity: true,
        isLicensed: true,
        hasToken: true,
      });
    });

    it('should return false flags when App Check token is empty', async () => {
      mockAppCheckGetToken.mockResolvedValueOnce('');

      const result = await playIntegrityService.getSimpleIntegrityStatus();

      expect(result).toEqual({
        isPlayRecognized: false,
        meetsBasicIntegrity: false,
        meetsDeviceIntegrity: false,
        meetsStrongIntegrity: false,
        isLicensed: false,
        hasToken: false,
      });
    });

    it('should return false flags when App Check throws', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockAppCheckFactory.mockImplementationOnce(() => {
        throw new Error('App Check unavailable');
      });

      try {
        const result = await playIntegrityService.getSimpleIntegrityStatus();

        expect(result).toEqual({
          isPlayRecognized: false,
          meetsBasicIntegrity: false,
          meetsDeviceIntegrity: false,
          meetsStrongIntegrity: false,
          isLicensed: false,
          hasToken: false,
        });
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
