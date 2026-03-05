/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AwaySection } from '../../../src/components/settings/sections/AwaySection';
import { ProtectionSection } from '../../../src/components/settings/sections/ProtectionSection';
import { WritingSection } from '../../../src/components/settings/sections/WritingSection';

const mockCapturedItems = new Map<string, any>();
const mockGetSetting = jest.fn(async (_key: string, def: any) => def);
const mockSetSetting = jest.fn(async () => undefined);
const mockAwaySet = jest.fn();
const mockAwayClear = jest.fn();
const mockGetSpamLog = jest.fn(async () => 'spam log');
const mockClearSpamLog = jest.fn(async () => undefined);

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../../src/components/settings/SettingItem', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    SettingItem: ({ item }: any) => {
      mockCapturedItems.set(item.id, item);
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
  NEW_FEATURE_DEFAULTS: {
    spamPmKeywords: ['xxx', 'buy now'],
    defaultBanType: 2,
    predefinedKickReasons: ['Flood'],
    showBanMaskPreview: true,
    rememberLastBanType: false,
    confirmBeforeKickBan: true,
  },
}));

jest.mock('../../../src/services/AwayService', () => ({
  awayService: {
    setAway: (...args: any[]) => mockAwaySet(...args),
    clearAway: (...args: any[]) => mockAwayClear(...args),
  },
}));

jest.mock('../../../src/services/ProtectionService', () => ({
  protectionService: {
    getSpamLog: (...args: any[]) => mockGetSpamLog(...args),
    clearSpamLog: (...args: any[]) => mockClearSpamLog(...args),
  },
}));

jest.mock('../../../src/utils/IRCFormatter', () => ({
  formatIRCTextAsComponent: (text: string) => text,
  stripIRCFormatting: (text: string) => text,
}));

jest.mock('../../../src/utils/EncodingUtils', () => ({
  repairMojibake: (text: string) => text,
}));

jest.mock('../../../src/components/ColorPickerModal', () => ({
  ColorPickerModal: () => null,
}));

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
};

describe('Heavy sections A', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
  });

  it('AwaySection triggers away now/back actions and options tab updates', async () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <AwaySection colors={colors} styles={styles as any} settingIcons={{}} onClose={onClose} />
    );
    await waitFor(() => expect(mockCapturedItems.has('away-now')).toBe(true));

    mockCapturedItems.get('away-now').onPress();
    mockCapturedItems.get('away-back').onPress();
    expect(mockAwaySet).toHaveBeenCalled();
    expect(mockAwayClear).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.press(getByText('Options'));
    await waitFor(() => expect(mockCapturedItems.has('auto-away-enabled')).toBe(true));
    await mockCapturedItems.get('auto-away-enabled').onValueChange(true);
    expect(mockSetSetting).toHaveBeenCalledWith('autoAwayEnabled', true);
  });

  it('ProtectionSection updates spam/protection settings and spam log action', async () => {
    render(<ProtectionSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('spam-logging')).toBe(true));

    await mockCapturedItems.get('spam-logging').onValueChange(true);
    await mockCapturedItems.get('spam-channel-enabled').onValueChange(true);
    await mockCapturedItems.get('spam-log-check').onPress();

    expect(mockSetSetting).toHaveBeenCalledWith('spamLoggingEnabled', true);
    expect(mockSetSetting).toHaveBeenCalledWith('spamChannelEnabled', true);
    expect(mockGetSpamLog).toHaveBeenCalled();
  });

  it('WritingSection handles decoration and nick completion updates', async () => {
    const { getByText } = render(<WritingSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('decor-enabled')).toBe(true));

    await mockCapturedItems.get('decor-enabled').onValueChange(true);
    await mockCapturedItems.get('decor-bold').onValueChange(true);
    expect(mockSetSetting).toHaveBeenCalledWith('decorEnabled', true);
    expect(mockSetSetting).toHaveBeenCalledWith('decorBold', true);

    fireEvent.press(getByText('Nick Completion'));
    await waitFor(() => expect(mockCapturedItems.has('nick-complete-enabled')).toBe(true));
    await mockCapturedItems.get('nick-complete-enabled').onValueChange(true);
    expect(mockSetSetting).toHaveBeenCalledWith('nickCompleteEnabled', true);
  });
});
