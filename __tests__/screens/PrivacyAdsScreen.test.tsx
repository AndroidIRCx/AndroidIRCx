/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert, Linking } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PrivacyAdsScreen } from '../../src/screens/PrivacyAdsScreen';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    colors: {
      background: '#fff',
      border: '#ddd',
      text: '#111',
      textSecondary: '#666',
      primary: '#09f',
      surface: '#f5f5f5',
      cardBackground: '#fafafa',
      success: '#0a0',
      warning: '#fa0',
      info: '#08c',
      error: '#f44',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => {
    if (!params) {
      return key;
    }
    return Object.entries(params).reduce(
      (result, [paramKey, value]) =>
        result.replace(`{${paramKey}}`, String(value)),
      key,
    );
  },
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return function MockIcon(props: any) {
    return React.createElement(Text, props, props.name);
  };
});

jest.mock('react-native-google-mobile-ads', () => ({
  AdsConsentStatus: {
    UNKNOWN: 'UNKNOWN',
    REQUIRED: 'REQUIRED',
    NOT_REQUIRED: 'NOT_REQUIRED',
    OBTAINED: 'OBTAINED',
  },
}));

jest.mock('../../src/services/ConsentService', () => ({
  consentService: {
    getConsentStatus: jest.fn(),
    getConsentInfo: jest.fn(),
    addListener: jest.fn(),
    showConsentForm: jest.fn(),
    resetConsent: jest.fn(),
    acceptConsentManually: jest.fn(),
    getPrivacyPolicyUrl: jest.fn(),
    getConsentStatusText: jest.fn(),
    isManuallyAccepted: jest.fn(),
  },
}));

jest.mock('../../src/services/AdRewardService', () => ({
  adRewardService: {
    getAdStatus: jest.fn(),
    addListener: jest.fn(),
    showRewardedAd: jest.fn(),
    manualLoadAd: jest.fn(),
  },
}));

jest.mock('../../src/services/InAppPurchaseService', () => ({
  inAppPurchaseService: {
    hasNoAds: jest.fn(),
    hasUnlimitedScripting: jest.fn(),
    isSupporter: jest.fn(),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn(),
    onSettingChange: jest.fn(),
  },
}));

const { consentService } = require('../../src/services/ConsentService');
const { adRewardService } = require('../../src/services/AdRewardService');
const {
  inAppPurchaseService,
} = require('../../src/services/InAppPurchaseService');
const { settingsService } = require('../../src/services/SettingsService');

describe('PrivacyAdsScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    consentService.getConsentStatus.mockReturnValue('OBTAINED');
    consentService.getConsentInfo.mockResolvedValue({
      status: 'OBTAINED',
      isConsentFormAvailable: true,
      canRequestAds: true,
      privacyOptionsRequired: false,
    });
    consentService.addListener.mockReturnValue(jest.fn());
    consentService.showConsentForm.mockResolvedValue(undefined);
    consentService.resetConsent.mockResolvedValue(undefined);
    consentService.acceptConsentManually.mockResolvedValue(undefined);
    consentService.getPrivacyPolicyUrl.mockReturnValue(
      'https://androidircx.com/privacy',
    );
    consentService.getConsentStatusText.mockReturnValue('Consent Granted');
    consentService.isManuallyAccepted.mockReturnValue(false);

    adRewardService.getAdStatus.mockReturnValue({
      ready: true,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Primary',
    });
    adRewardService.addListener.mockReturnValue(jest.fn());
    adRewardService.showRewardedAd.mockResolvedValue(true);
    adRewardService.manualLoadAd.mockResolvedValue({
      success: true,
      messageKey: 'Loading Ad...',
      messageParams: {},
    });

    inAppPurchaseService.hasNoAds.mockReturnValue(false);
    inAppPurchaseService.hasUnlimitedScripting.mockReturnValue(false);
    inAppPurchaseService.isSupporter.mockReturnValue(false);

    settingsService.getSetting.mockResolvedValue(false);
    settingsService.onSettingChange.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders nothing when hidden', () => {
    const { queryByText } = render(
      <PrivacyAdsScreen visible={false} onClose={jest.fn()} />,
    );

    expect(queryByText('Privacy & Ads')).toBeNull();
  });

  it('renders current status and watch ad action', async () => {
    const { findByText } = render(
      <PrivacyAdsScreen visible onClose={jest.fn()} />,
    );

    expect(await findByText('Privacy & Ads')).toBeTruthy();
    expect(await findByText('Consent Granted')).toBeTruthy();
    expect(
      await findByText('Watch Ad (+60 min Scripting & No-Ads)'),
    ).toBeTruthy();
  });

  it('shows rewarded ad success flow', async () => {
    const { findByText } = render(
      <PrivacyAdsScreen visible onClose={jest.fn()} />,
    );

    fireEvent.press(await findByText('Watch Ad (+60 min Scripting & No-Ads)'));

    await waitFor(() => {
      expect(adRewardService.showRewardedAd).toHaveBeenCalledTimes(1);
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Thank You!',
      'You earned scripting time!',
    );
  });

  it('falls back to manual ad load when ad is not ready', async () => {
    adRewardService.getAdStatus.mockReturnValue({
      ready: false,
      loading: false,
      cooldown: false,
      cooldownSeconds: 0,
      adUnitType: 'Fallback',
    });

    const { findByText } = render(
      <PrivacyAdsScreen visible onClose={jest.fn()} />,
    );
    fireEvent.press(await findByText('Request Ad'));

    await waitFor(() => {
      expect(adRewardService.manualLoadAd).toHaveBeenCalledTimes(1);
    });
    expect(Alert.alert).toHaveBeenCalledWith('Loading Ad', 'Loading Ad...');
    expect(await findByText('Using fallback ad unit')).toBeTruthy();
  });

  it('reviews consent successfully', async () => {
    const { findByText } = render(
      <PrivacyAdsScreen visible onClose={jest.fn()} />,
    );

    fireEvent.press(await findByText('Change Privacy Settings'));

    await waitFor(() => {
      expect(consentService.showConsentForm).toHaveBeenCalledTimes(1);
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Privacy Settings Updated',
      'Your privacy preferences have been saved.',
    );
  });

  it('opens reset flow for manual consent mode and accepts again', async () => {
    consentService.showConsentForm.mockRejectedValueOnce(
      new Error('MANUAL_CONSENT_ONLY'),
    );
    consentService.isManuallyAccepted.mockReturnValue(true);

    const { findByText } = render(
      <PrivacyAdsScreen visible onClose={jest.fn()} />,
    );
    fireEvent.press(await findByText('Change Privacy Settings'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled();
    });

    const changeDialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Change Privacy Settings',
    );
    expect(changeDialog).toBeTruthy();

    act(() => {
      changeDialog[2][1].onPress();
    });

    const resetDialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Reset Privacy Settings',
    );
    expect(resetDialog).toBeTruthy();

    await act(async () => {
      await resetDialog[2][1].onPress();
    });

    const agreementDialog = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Privacy Agreement',
    );
    expect(agreementDialog).toBeTruthy();

    await act(async () => {
      await agreementDialog[2][1].onPress();
    });

    await waitFor(() => {
      expect(consentService.resetConsent).toHaveBeenCalledTimes(1);
      expect(consentService.acceptConsentManually).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        'Privacy terms accepted. Your settings have been updated.',
      );
    });
  });

  it('opens privacy policy and handles close button', async () => {
    const onClose = jest.fn();
    const { findByText, findAllByText } = render(
      <PrivacyAdsScreen visible onClose={onClose} />,
    );

    fireEvent.press(await findByText('Read Privacy Policy'));
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://androidircx.com/privacy',
      );
    });

    fireEvent.press((await findAllByText('Close'))[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
