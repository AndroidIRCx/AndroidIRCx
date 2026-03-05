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
    const { result } = renderHook(() => useAppInitialization());

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
});
