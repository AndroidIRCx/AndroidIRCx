/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert, Linking } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { FirstRunSetupScreen } from '../../src/screens/FirstRunSetupScreen';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      surface: '#111',
      border: '#333',
      text: '#fff',
      textSecondary: '#bbb',
      primary: '#4caf50',
      buttonPrimary: '#4caf50',
      buttonPrimaryText: '#fff',
      buttonSecondary: '#222',
      buttonSecondaryText: '#fff',
      success: '#4caf50',
      warning: '#ff9800',
      inputBackground: '#222',
    },
  }),
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ name }: any) => <Text>{name}</Text>;
});

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => {
    if (!params) {
      return key;
    }
    return Object.entries(params).reduce(
      (result, [paramKey, value]) => result.replace(`{${paramKey}}`, String(value)),
      key
    );
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getNetwork: jest.fn(),
    updateNetwork: jest.fn(),
    createDefaultNetwork: jest.fn(),
    addNetwork: jest.fn(),
    setFirstRunCompleted: jest.fn(),
  },
}));

jest.mock('../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: {
    add: jest.fn(),
  },
}));

jest.mock('../../src/services/ConsentService', () => ({
  consentService: {
    showConsentFormIfRequired: jest.fn(),
    getPrivacyPolicyUrl: jest.fn(() => 'https://example.com/privacy'),
    acceptConsentManually: jest.fn(),
  },
}));

const { settingsService } = require('../../src/services/SettingsService');
const { identityProfilesService } = require('../../src/services/IdentityProfilesService');
const { consentService } = require('../../src/services/ConsentService');

describe('FirstRunSetupScreen', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    identityProfilesService.add.mockResolvedValue({ id: 'profile-1' });
    settingsService.getNetwork.mockResolvedValue({
      id: 'DBase',
      name: 'DBase',
      servers: [{ id: 'srv1', hostname: 'irc.dbase.in.rs', port: 6697, ssl: true }],
      nick: 'OldNick',
      ident: 'oldident',
      realname: 'Old Realname',
      altNick: 'OldAlt',
    });
    settingsService.updateNetwork.mockResolvedValue(undefined);
    settingsService.createDefaultNetwork.mockResolvedValue(undefined);
    settingsService.addNetwork.mockResolvedValue(undefined);
    settingsService.setFirstRunCompleted.mockResolvedValue(undefined);
    consentService.showConsentFormIfRequired.mockResolvedValue(true);
    consentService.acceptConsentManually.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders welcome step and advances through privacy to identity', async () => {
    const { findByText } = render(
      <FirstRunSetupScreen onComplete={jest.fn()} onSkip={jest.fn()} />
    );

    expect(await findByText('Welcome to AndroidIRCX')).toBeTruthy();
    fireEvent.press(await findByText('Next'));
    expect(await findByText('Privacy & Ads')).toBeTruthy();
    fireEvent.press(await findByText('Accept Privacy Terms & Continue'));

    await waitFor(() => {
      expect(consentService.showConsentFormIfRequired).toHaveBeenCalled();
    });

    fireEvent.press(await findByText('Next'));
    expect(await findByText('Set Up Your Identity')).toBeTruthy();
  });

  it('shows validation when required identity fields are missing', async () => {
    const { findByDisplayValue, findByText } = render(
      <FirstRunSetupScreen onComplete={jest.fn()} onSkip={jest.fn()} />
    );

    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Accept Privacy Terms & Continue'));
    fireEvent.press(await findByText('Next'));

    fireEvent.changeText(await findByDisplayValue('AndroidIRCX'), '');
    fireEvent.press(await findByText('Next'));
    expect(Alert.alert).toHaveBeenCalledWith('Required', 'Please enter a nickname');
  });

  it('shows validation when real name is missing', async () => {
    const { findByDisplayValue, findByText } = render(
      <FirstRunSetupScreen onComplete={jest.fn()} onSkip={jest.fn()} />
    );

    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Accept Privacy Terms & Continue'));
    fireEvent.press(await findByText('Next'));

    fireEvent.changeText(await findByDisplayValue('AndroidIRCX User'), '   ');
    fireEvent.press(await findByText('Next'));

    expect(Alert.alert).toHaveBeenCalledWith('Required', 'Please enter your real name');
  });

  it('completes recommended setup and connects now', async () => {
    const onComplete = jest.fn();
    const { findByDisplayValue, findByText } = render(
      <FirstRunSetupScreen onComplete={onComplete} onSkip={jest.fn()} />
    );

    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Accept Privacy Terms & Continue'));
    fireEvent.press(await findByText('Next'));

    fireEvent.changeText(await findByDisplayValue('AndroidIRCX'), 'Majstor');
    fireEvent.changeText(await findByDisplayValue('AndroidIRCX User'), 'Velimir');
    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Complete Setup'));

    await waitFor(() => {
      expect(identityProfilesService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Majstor Profile',
          nick: 'Majstor',
          realname: 'Velimir',
        })
      );
      expect(settingsService.updateNetwork).toHaveBeenCalledWith(
        'DBase',
        expect.objectContaining({
          nick: 'Majstor',
          realname: 'Velimir',
          identityProfileId: 'profile-1',
        })
      );
    });

    expect(await findByText("You're all set!")).toBeTruthy();
    fireEvent.press(await findByText('Connect Now'));

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'DBase',
      })
    );
  });

  it('completes custom network setup and supports connect later', async () => {
    const onSkip = jest.fn();
    const { findByDisplayValue, findByPlaceholderText, findByText } = render(
      <FirstRunSetupScreen onComplete={jest.fn()} onSkip={onSkip} />
    );

    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Accept Privacy Terms & Continue'));
    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Next'));

    fireEvent.press(await findByText('Custom Server'));
    fireEvent.changeText(await findByDisplayValue('6697'), '7000');
    fireEvent.changeText(await findByPlaceholderText('libera'), 'libera');
    fireEvent.changeText(await findByPlaceholderText('irc.libera.chat'), 'irc.libera.chat');
    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('#DBase'));
    fireEvent.press(await findByText('Complete Setup'));

    await waitFor(() => {
      expect(settingsService.addNetwork).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'libera',
          servers: [
            expect.objectContaining({
              hostname: 'irc.libera.chat',
              port: 7000,
            }),
          ],
          autoJoinChannels: ['#DBase'],
        })
      );
    });

    fireEvent.press(await findByText('Connect Later'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('shows validation when custom network fields are missing', async () => {
    const { findByText } = render(
      <FirstRunSetupScreen onComplete={jest.fn()} onSkip={jest.fn()} />
    );

    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Accept Privacy Terms & Continue'));
    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Custom Server'));
    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Complete Setup'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Required', 'Please enter network name and server');
    });
  });

  it('allows finishing setup without selecting DBase or a custom server', async () => {
    const onComplete = jest.fn();
    const { findByText } = render(
      <FirstRunSetupScreen onComplete={onComplete} onSkip={jest.fn()} />
    );

    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Accept Privacy Terms & Continue'));
    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Next'));

    fireEvent.press(await findByText('Choose Another Server Later'));
    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Complete Setup'));

    await waitFor(() => {
      expect(settingsService.setFirstRunCompleted).toHaveBeenCalledWith(true);
    });

    expect(await findByText('Open Choose Network')).toBeTruthy();
    fireEvent.press(await findByText('Open Choose Network'));
    expect(onComplete).toHaveBeenCalledWith(null);
  });

  it('falls back to default channels and creates DBase when missing', async () => {
    settingsService.getNetwork
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'DBase',
        name: 'DBase',
        servers: [{ id: 'srv1', hostname: 'irc.dbase.in.rs', port: 6697, ssl: true }],
      });

    const onComplete = jest.fn();
    const { findByDisplayValue, findByText } = render(
      <FirstRunSetupScreen onComplete={onComplete} onSkip={jest.fn()} />
    );

    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Accept Privacy Terms & Continue'));
    fireEvent.press(await findByText('Next'));
    fireEvent.changeText(await findByDisplayValue('AndroidIRCX'), 'FallbackNick');
    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Next'));
    fireEvent.changeText(await findByDisplayValue('#DBase, #AndroidIRCX'), 'not-a-channel, also-bad');
    fireEvent.press(await findByText('Complete Setup'));

    await waitFor(() => {
      expect(settingsService.createDefaultNetwork).toHaveBeenCalled();
      expect(settingsService.updateNetwork).toHaveBeenCalledWith(
        'DBase',
        expect.objectContaining({
          autoJoinChannels: ['#DBase', '#AndroidIRCX'],
        }),
      );
    });

    fireEvent.press(await findByText('Connect Now'));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 'DBase' }));
  });

  it('shows manual privacy agreement and accepts consent when no form is required', async () => {
    consentService.showConsentFormIfRequired.mockResolvedValue(false);

    const { findByText } = render(
      <FirstRunSetupScreen onComplete={jest.fn()} onSkip={jest.fn()} />
    );

    fireEvent.press(await findByText('Next'));
    await act(async () => {
      fireEvent.press(await findByText('Accept Privacy Terms & Continue'));
    });

    await waitFor(() => {
      expect((Alert.alert as jest.Mock).mock.calls.some(call => call[0] === 'Privacy Agreement')).toBe(true);
    });

    const privacyAgreementCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Privacy Agreement'
    );
    expect(privacyAgreementCall).toBeTruthy();
    const alertButtons = privacyAgreementCall?.[2];
    await act(async () => {
      await alertButtons?.[1]?.onPress?.();
    });

    await waitFor(() => {
      expect(consentService.acceptConsentManually).toHaveBeenCalledTimes(1);
    });
  });

  it('opens privacy policy links and surfaces open failures', async () => {
    consentService.showConsentFormIfRequired.mockResolvedValue(false);

    const { findByText } = render(
      <FirstRunSetupScreen onComplete={jest.fn()} onSkip={jest.fn()} />
    );

    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('📄 Read Full Privacy Policy'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/privacy');

    await act(async () => {
      fireEvent.press(await findByText('Accept Privacy Terms & Continue'));
    });

    const privacyAgreementCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Privacy Agreement'
    );
    expect(privacyAgreementCall).toBeTruthy();

    (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('no browser'));
    await act(async () => {
      await privacyAgreementCall?.[2]?.[0]?.onPress?.();
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to open privacy policy.');
  });

  it('allows navigating back and skipping from welcome', async () => {
    const onSkip = jest.fn();
    const { findByText } = render(
      <FirstRunSetupScreen onComplete={jest.fn()} onSkip={onSkip} />
    );

    fireEvent.press(await findByText('Skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);

    fireEvent.press(await findByText('Next'));
    expect(await findByText('Privacy & Ads')).toBeTruthy();
    fireEvent.press(await findByText('Back'));
    expect(await findByText('Welcome to AndroidIRCX')).toBeTruthy();
  });

  it('handles consent and save failures gracefully', async () => {
    consentService.showConsentFormIfRequired.mockRejectedValueOnce(new Error('ump failed'));

    const { findByText } = render(
      <FirstRunSetupScreen onComplete={jest.fn()} onSkip={jest.fn()} />
    );

    fireEvent.press(await findByText('Next'));
    await act(async () => {
      fireEvent.press(await findByText('Accept Privacy Terms & Continue'));
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Consent error:', expect.any(Error));
    });

    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Next'));
    fireEvent.press(await findByText('Next'));

    identityProfilesService.add.mockRejectedValueOnce(new Error('save failed'));
    fireEvent.press(await findByText('Complete Setup'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to save network configuration');
      expect(consoleErrorSpy).toHaveBeenCalledWith('FirstRunSetup save error:', expect.any(Error));
    });
  });

  it('shows consent save failure from manual accept path', async () => {
    consentService.showConsentFormIfRequired.mockResolvedValue(false);
    consentService.acceptConsentManually.mockRejectedValueOnce(new Error('save consent failed'));

    const { findByText } = render(
      <FirstRunSetupScreen onComplete={jest.fn()} onSkip={jest.fn()} />
    );

    fireEvent.press(await findByText('Next'));
    await act(async () => {
      fireEvent.press(await findByText('Accept Privacy Terms & Continue'));
    });

    const privacyAgreementCall = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Privacy Agreement'
    );

    await act(async () => {
      await privacyAgreementCall?.[2]?.[1]?.onPress?.();
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to save consent. Please try again.');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save consent:', expect.any(Error));
  });
});
