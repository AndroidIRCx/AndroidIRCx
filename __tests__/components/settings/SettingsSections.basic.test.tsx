/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AboutSection } from '../../../src/components/settings/sections/AboutSection';
import { AdvancedSection } from '../../../src/components/settings/sections/AdvancedSection';
import { PremiumSection } from '../../../src/components/settings/sections/PremiumSection';
import { PrivacyLegalSection } from '../../../src/components/settings/sections/PrivacyLegalSection';
import { MessageHistorySection } from '../../../src/components/settings/sections/MessageHistorySection';
import { BackgroundBatterySection } from '../../../src/components/settings/sections/BackgroundBatterySection';
import { ScriptingAdsSection } from '../../../src/components/settings/sections/ScriptingAdsSection';
import { HelpSection } from '../../../src/components/settings/sections/HelpSection';

const mockCapturedItems = new Map<string, any>();
const mockSetSetting = jest.fn(async () => undefined);
const mockGetSetting = jest.fn(async (_key: string, def: any) => def);
const mockSetBackgroundEnabled = jest.fn(async () => undefined);
const mockHandleBatteryOptimization = jest.fn(async () => undefined);
const mockIsIgnoringBatteryOptimizations = jest.fn(async () => false);
const mockSetWatchAdButtonEnabledForPremium = jest.fn(async () => undefined);
const mockHandleWatchAd = jest.fn();
const mockUIStore = {
  setShowHelpConnection: jest.fn(),
  setShowHelpCommands: jest.fn(),
  setShowHelpEncryption: jest.fn(),
  setShowHelpMedia: jest.fn(),
  setShowHelpChannelManagement: jest.fn(),
  setShowHelpTroubleshooting: jest.fn(),
};

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, any>) => {
    if (params?.count !== undefined) return `${key}`.replace('{count}', String(params.count));
    return key;
  },
}));

jest.mock('../../../src/components/settings/SettingItem', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    SettingItem: ({ item, renderCustom }: any) => {
      mockCapturedItems.set(item.id, item);
      if (item.type === 'custom' && renderCustom) {
        return React.createElement(React.Fragment, null, renderCustom(item));
      }
      return React.createElement(
        TouchableOpacity,
        { testID: `setting-${item.id}`, onPress: item.onPress || (() => item.onValueChange?.(!item.value)) },
        React.createElement(Text, null, item.title || item.id)
      );
    },
  };
});

jest.mock('../../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: any[]) => mockGetSetting(...args),
    setSetting: (...args: any[]) => mockSetSetting(...args),
  },
  DEFAULT_PART_MESSAGE: 'Leaving',
  DEFAULT_QUIT_MESSAGE: 'Quit',
  DEFAULT_CTCP_VERSION_MESSAGE: 'AndroidIRCX',
}));

jest.mock('../../../src/hooks/useSettingsNotifications', () => ({
  useSettingsNotifications: () => ({
    backgroundEnabled: true,
    batteryOptEnabledStatus: true,
    setBackgroundEnabled: (...args: any[]) => mockSetBackgroundEnabled(...args),
    handleBatteryOptimization: (...args: any[]) => mockHandleBatteryOptimization(...args),
  }),
}));

jest.mock('../../../src/services/BackgroundService', () => ({
  backgroundService: {
    isIgnoringBatteryOptimizations: (...args: any[]) => mockIsIgnoringBatteryOptimizations(...args),
  },
}));

jest.mock('../../../src/hooks/useSettingsPremium', () => ({
  useSettingsPremium: () => ({
    hasNoAds: false,
    hasScriptingPro: false,
    isSupporter: false,
    watchAdButtonEnabledForPremium: false,
    showWatchAdButton: true,
    adReady: true,
    adLoading: false,
    adCooldown: false,
    cooldownSeconds: 0,
    showingAd: false,
    setWatchAdButtonEnabledForPremium: (...args: any[]) => mockSetWatchAdButtonEnabledForPremium(...args),
    handleWatchAd: (...args: any[]) => mockHandleWatchAd(...args),
  }),
}));

jest.mock('../../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#111',
      textSecondary: '#666',
      primary: '#0af',
      surface: '#fff',
      border: '#ddd',
      background: '#000',
    },
  }),
}));

jest.mock('../../../src/stores/uiStore', () => ({
  useUIStore: () => mockUIStore,
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => 'Icon');

const colors = {
  text: '#111',
  textSecondary: '#666',
  primary: '#0af',
  surface: '#fff',
  border: '#ddd',
  background: '#000',
};

const styles = {
  settingItem: {},
  settingContent: {},
  settingTitleRow: {},
  settingTitle: {},
  settingDescription: {},
  disabledItem: {},
  disabledText: {},
  chevron: {},
  watchAdButton: {},
  watchAdButtonDisabled: {},
  watchAdButtonText: {},
};

describe('Settings Sections Basic', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
  });

  it('AboutSection renders items and triggers callbacks', () => {
    const onShowAbout = jest.fn();
    const onShowCredits = jest.fn();
    const { getByTestId } = render(
      <AboutSection colors={colors} styles={styles as any} settingIcons={{}} onShowAbout={onShowAbout} onShowCredits={onShowCredits} />
    );
    fireEvent.press(getByTestId('setting-about-app'));
    fireEvent.press(getByTestId('setting-credits'));
    expect(onShowAbout).toHaveBeenCalled();
    expect(onShowCredits).toHaveBeenCalled();
  });

  it('AdvancedSection returns null while empty', () => {
    const { toJSON } = render(<AdvancedSection colors={colors} styles={styles as any} settingIcons={{}} />);
    expect(toJSON()).toBeNull();
  });

  it('Premium and Privacy sections trigger actions', () => {
    const onShowPurchaseScreen = jest.fn();
    const onShowDataPrivacy = jest.fn();
    const onShowPrivacyAds = jest.fn();
    const { getByTestId } = render(
      <>
        <PremiumSection colors={colors} styles={styles as any} settingIcons={{}} onShowPurchaseScreen={onShowPurchaseScreen} />
        <PrivacyLegalSection
          colors={colors}
          styles={styles as any}
          settingIcons={{}}
          onShowDataPrivacy={onShowDataPrivacy}
          onShowPrivacyAds={onShowPrivacyAds}
        />
      </>
    );
    fireEvent.press(getByTestId('setting-premium-upgrade'));
    fireEvent.press(getByTestId('setting-my-data-privacy'));
    fireEvent.press(getByTestId('setting-privacy-ads'));
    expect(onShowPurchaseScreen).toHaveBeenCalled();
    expect(onShowDataPrivacy).toHaveBeenCalled();
    expect(onShowPrivacyAds).toHaveBeenCalled();
  });

  it('MessageHistorySection saves input/switch updates', async () => {
    render(<MessageHistorySection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('messages-hide-join')).toBe(true));

    await mockCapturedItems.get('messages-hide-join').onValueChange(true);
    await mockCapturedItems.get('messages-part').onValueChange('bye');

    expect(mockSetSetting).toHaveBeenCalledWith('hideJoinMessages', true);
    expect(mockSetSetting).toHaveBeenCalledWith('partMessage', 'bye');
  });

  it('BackgroundBatterySection toggles and refreshes battery status', async () => {
    jest.useFakeTimers();
    render(<BackgroundBatterySection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('background-battery-settings')).toBe(true));

    await mockCapturedItems.get('background-keep-alive').onValueChange(false);
    await mockCapturedItems.get('background-battery-settings').onPress();
    jest.advanceTimersByTime(1000);

    expect(mockSetBackgroundEnabled).toHaveBeenCalledWith(false);
    expect(mockHandleBatteryOptimization).toHaveBeenCalled();
    expect(mockIsIgnoringBatteryOptimizations).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('ScriptingAdsSection exposes watch-ad flow', async () => {
    const onShowScripting = jest.fn();
    const onShowScriptingHelp = jest.fn();
    const { getByText } = render(
      <ScriptingAdsSection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        onShowScripting={onShowScripting}
        onShowScriptingHelp={onShowScriptingHelp}
      />
    );

    await mockCapturedItems.get('watch-ad-button-premium').onValueChange(true);
    fireEvent.press(getByText('Watch Ad (+60 min Scripting & No-Ads)'));

    expect(mockSetWatchAdButtonEnabledForPremium).toHaveBeenCalledWith(true);
    expect(mockHandleWatchAd).toHaveBeenCalled();
  });

  it('HelpSection opens correct help dialogs', () => {
    const { getByLabelText } = render(<HelpSection />);

    fireEvent.press(getByLabelText('Troubleshooting Guide'));
    fireEvent.press(getByLabelText('IRC Connection Guide'));
    fireEvent.press(getByLabelText('Commands Reference'));

    expect(mockUIStore.setShowHelpTroubleshooting).toHaveBeenCalledWith(true);
    expect(mockUIStore.setShowHelpConnection).toHaveBeenCalledWith(true);
    expect(mockUIStore.setShowHelpCommands).toHaveBeenCalledWith(true);
  });
});
