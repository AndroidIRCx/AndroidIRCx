/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useAppInitialization hook
 */

import { renderHook } from '@testing-library/react-native';
import { useAppInitialization } from '../../src/hooks/useAppInitialization';

// Mock all the services and modules used in the hook
jest.mock('@react-native-firebase/app-check', () => ({
  initializeAppCheck: jest.fn(),
  ReactNativeFirebaseAppCheckProvider: jest.fn().mockImplementation(() => ({
    configure: jest.fn(),
  })),
}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(),
}));

jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    initialize: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/ConsentService', () => ({
  consentService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    showConsentFormIfRequired: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    isFirstRun: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../src/services/AdRewardService', () => ({
  adRewardService: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/InAppPurchaseService', () => ({
  inAppPurchaseService: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/BannerAdService', () => ({
  bannerAdService: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/ErrorReportingService', () => ({
  errorReportingService: {
    initialize: jest.fn(),
    report: jest.fn(),
  },
}));

jest.mock('../../src/services/SoundService', () => ({
  soundService: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/PrivacyRelayService', () => ({
  privacyRelayService: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock React Native's ErrorUtils
const mockGlobalErrorHandler = jest.fn();
const mockOriginalHandler = jest.fn();

global.ErrorUtils = {
  getGlobalHandler: jest.fn(() => mockOriginalHandler),
  setGlobalHandler: jest.fn((handler) => {
    mockGlobalErrorHandler.mockImplementation(handler);
  }),
};

describe('useAppInitialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks to default behavior
    require('../../src/services/SettingsService').settingsService.isFirstRun.mockResolvedValue(true);
  });

  it('should render without crashing', () => {
    expect(() => {
      renderHook(() => useAppInitialization());
    }).not.toThrow();
  });

  it('should initialize all services on mount', async () => {
    renderHook(() => useAppInitialization());

    // Wait for useEffect to run
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check that all initialization functions are called
    expect(require('../../src/services/ConsentService').consentService.initialize).toHaveBeenCalledWith(expect.any(Boolean));
    expect(require('../../src/services/AdRewardService').adRewardService.initialize).toHaveBeenCalled();
    expect(require('../../src/services/InAppPurchaseService').inAppPurchaseService.initialize).toHaveBeenCalled();
    expect(require('../../src/services/BannerAdService').bannerAdService.initialize).toHaveBeenCalled();
    expect(require('../../src/services/ErrorReportingService').errorReportingService.initialize).toHaveBeenCalled();
    expect(require('../../src/services/SoundService').soundService.initialize).toHaveBeenCalled();
    expect(require('../../src/services/PrivacyRelayService').privacyRelayService.initialize).toHaveBeenCalled();
  });

  it('should handle consent form based on first run status', async () => {
    // Mock first run as false to trigger consent form
    require('../../src/services/SettingsService').settingsService.isFirstRun.mockResolvedValue(false);

    renderHook(() => useAppInitialization());

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(require('../../src/services/ConsentService').consentService.showConsentFormIfRequired).toHaveBeenCalled();
  });

  it('should skip consent form on first run', async () => {
    // Mock first run as true (default)
    require('../../src/services/SettingsService').settingsService.isFirstRun.mockResolvedValue(true);

    renderHook(() => useAppInitialization());

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(require('../../src/services/ConsentService').consentService.showConsentFormIfRequired).not.toHaveBeenCalled();
  });

  it('should set global error handler', async () => {
    renderHook(() => useAppInitialization());

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(global.ErrorUtils.setGlobalHandler).toHaveBeenCalled();
  });

  it('should restore original global error handler on unmount', async () => {
    const { unmount } = renderHook(() => useAppInitialization());

    await new Promise(resolve => setTimeout(resolve, 0));
    unmount();

    expect(global.ErrorUtils.setGlobalHandler).toHaveBeenLastCalledWith(mockOriginalHandler);
  });

  it('should report and hide bootsplash for fatal global errors', async () => {
    renderHook(() => useAppInitialization());
    await new Promise(resolve => setTimeout(resolve, 0));

    const error = new Error('fatal test');
    mockGlobalErrorHandler(error, true);

    expect(require('../../src/services/ErrorReportingService').errorReportingService.report).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ fatal: true, source: 'globalErrorHandler' })
    );
    expect(require('react-native-bootsplash').hide).toHaveBeenCalledWith({ fade: false });
    expect(mockOriginalHandler).toHaveBeenCalledWith(error, true);
  });

  it('should report non-fatal errors without hiding bootsplash', async () => {
    renderHook(() => useAppInitialization());
    await new Promise(resolve => setTimeout(resolve, 0));

    const error = new Error('non fatal test');
    mockGlobalErrorHandler(error, false);

    expect(require('../../src/services/ErrorReportingService').errorReportingService.report).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ fatal: false, source: 'globalErrorHandler' })
    );
    expect(require('react-native-bootsplash').hide).not.toHaveBeenCalled();
    expect(mockOriginalHandler).toHaveBeenCalledWith(error, false);
  });

  it('should handle errors during initialization gracefully', async () => {
    // Mock an error during consent initialization
    require('../../src/services/ConsentService').consentService.initialize.mockRejectedValueOnce(new Error('Consent init failed'));

    expect(() => {
      renderHook(() => useAppInitialization());
    }).not.toThrow();
  });

  it('should initialize Firebase App Check', async () => {
    renderHook(() => useAppInitialization());

    await new Promise(resolve => setTimeout(resolve, 0));

    // Check that Firebase app is retrieved and App Check is initialized
    expect(require('@react-native-firebase/app').getApp).toHaveBeenCalled();
    expect(require('@react-native-firebase/app-check').initializeAppCheck).toHaveBeenCalled();
  });

  it('should skip global error handler setup when ErrorUtils is unavailable', async () => {
    const originalErrorUtils = (global as any).ErrorUtils;
    delete (global as any).ErrorUtils;

    expect(() => {
      renderHook(() => useAppInitialization());
    }).not.toThrow();

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(require('../../src/services/ErrorReportingService').errorReportingService.initialize).toHaveBeenCalled();

    (global as any).ErrorUtils = originalErrorUtils;
  });

  it('should handle App Check initialization failure gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    require('@react-native-firebase/app-check').initializeAppCheck.mockRejectedValueOnce(
      new Error('app-check failed')
    );

    expect(() => {
      renderHook(() => useAppInitialization());
    }).not.toThrow();

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith('❌ App Check initialization failed:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should handle PrivacyRelay initialization failures gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    require('../../src/services/PrivacyRelayService').privacyRelayService.initialize.mockRejectedValueOnce(
      new Error('relay init failed')
    );

    expect(() => {
      renderHook(() => useAppInitialization());
    }).not.toThrow();

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ Failed to initialize PrivacyRelayService:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  it('should warn when not all ad adapters are ready', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    require('react-native-google-mobile-ads').default.mockReturnValue({
      initialize: jest.fn().mockResolvedValue([{ state: 0 }]),
    });

    renderHook(() => useAppInitialization());
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️ WARNING: Not all ad adapters are ready!');
    expect(consoleWarnSpy).toHaveBeenCalledWith('This could be due to:');
    consoleWarnSpy.mockRestore();
  });
});
