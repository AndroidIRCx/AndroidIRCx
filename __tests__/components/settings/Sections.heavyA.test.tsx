/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
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
  ColorPickerModal: ({ visible, onInsert, onClose }: any) => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return React.createElement(
      View,
      { testID: 'mock-color-picker' },
      React.createElement(Text, null, 'Mock Color Picker'),
      React.createElement(
        TouchableOpacity,
        { testID: 'mock-color-insert', onPress: () => onInsert?.('\u000304') },
        React.createElement(Text, null, 'Insert Color')
      ),
      React.createElement(
        TouchableOpacity,
        { testID: 'mock-color-close', onPress: onClose },
        React.createElement(Text, null, 'Close Color')
      ),
    );
  },
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
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
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

  it('AwaySection updates core system and options values', async () => {
    const { getByText } = render(
      <AwaySection colors={colors} styles={styles as any} settingIcons={{}} onClose={jest.fn()} />
    );
    await waitFor(() => expect(mockCapturedItems.has('away-nick-pattern')).toBe(true));

    await mockCapturedItems.get('away-nick-pattern').onValueChange('<me>_away');
    await mockCapturedItems.get('away-disable-sounds').onValueChange(true);
    await mockCapturedItems.get('away-auto-answer').onValueChange(true);
    expect(mockSetSetting).toHaveBeenCalledWith('awayNickPattern', '<me>_away');
    expect(mockSetSetting).toHaveBeenCalledWith('awayDisableSounds', true);
    expect(mockSetSetting).toHaveBeenCalledWith('awayAutoAnswerEnabled', true);

    fireEvent.press(getByText('Options'));
    await waitFor(() => expect(mockCapturedItems.has('away-auto-answer-message')).toBe(true));

    await mockCapturedItems.get('away-auto-answer-message').onValueChange('BRB');
    await mockCapturedItems.get('away-announce-every').onValueChange('15');
    await mockCapturedItems.get('auto-away-minutes').onValueChange('7');
    await mockCapturedItems.get('minimize-to-tray').onValueChange(true);

    expect(mockSetSetting).toHaveBeenCalledWith('awayAutoAnswerMessage', 'BRB');
    expect(mockSetSetting).toHaveBeenCalledWith('awayAnnounceEveryMin', 15);
    expect(mockSetSetting).toHaveBeenCalledWith('autoAwayMinutes', 7);
    expect(mockSetSetting).toHaveBeenCalledWith('minimizeToTray', true);
  });

  it('AwaySection opens away presets entrypoint and persists related fields', async () => {
    const { getByText } = render(
      <AwaySection colors={colors} styles={styles as any} settingIcons={{}} onClose={jest.fn()} />
    );
    await waitFor(() => expect(mockCapturedItems.has('away-presets')).toBe(true));

    fireEvent.press(getByText('Away presets'));

    await mockCapturedItems.get('away-default-reason').onValueChange('Lunch break');
    fireEvent.press(getByText('Options'));
    await waitFor(() => expect(mockCapturedItems.has('auto-away-reason')).toBe(true));
    await mockCapturedItems.get('auto-away-reason').onValueChange('Lunch break');
    await mockCapturedItems.get('away-now').onPress();
    expect(mockSetSetting).toHaveBeenCalledWith('awayDefaultReason', 'Lunch break');
    expect(mockSetSetting).toHaveBeenCalledWith('autoAwayReason', 'Lunch break');
    expect(mockAwaySet).toHaveBeenCalled();
  });

  it('AwaySection opens auto-answer presets entrypoint and updates auto-answer fields', async () => {
    const { getByText } = render(
      <AwaySection colors={colors} styles={styles as any} settingIcons={{}} onClose={jest.fn()} />
    );
    await waitFor(() => expect(mockCapturedItems.has('away-auto-answer-presets')).toBe(false));

    fireEvent.press(getByText('Options'));
    await waitFor(() => expect(mockCapturedItems.has('away-auto-answer-presets')).toBe(true));

    fireEvent.press(getByText('Auto-answer presets'));

    await mockCapturedItems.get('away-auto-answer-message').onValueChange('AFK updated');
    await mockCapturedItems.get('away-announce-only').onValueChange('#chat');
    await mockCapturedItems.get('away-announce-exclude').onValueChange('#offtopic');
    expect(mockSetSetting).toHaveBeenCalledWith('awayAutoAnswerMessage', 'AFK updated');
    expect(mockSetSetting).toHaveBeenCalledWith('awayAnnounceOnlyOn', '#chat');
    expect(mockSetSetting).toHaveBeenCalledWith('awayAnnounceExcludeOn', '#offtopic');
  });

  it('AwaySection manages away presets modal add/select/edit/remove flow', async () => {
    const { getByText, getByPlaceholderText } = render(
      <AwaySection colors={colors} styles={styles as any} settingIcons={{}} onClose={jest.fn()} />
    );
    await waitFor(() => expect(mockCapturedItems.has('away-presets')).toBe(true));

    fireEvent.press(getByText('Away presets'));
    await waitFor(() => expect(getByPlaceholderText('Add preset')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Add preset'), 'Lunch break');
    fireEvent.press(getByText('Add'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('awayPresets', ['Lunch break']);
    });

    fireEvent.press(getByText('Use'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('awaySelectedPreset', 'Lunch break');
    });

    fireEvent.press(getByText('Edit'));
    fireEvent.changeText(getByPlaceholderText('Add preset'), 'Lunch break 2');
    fireEvent.press(getByText('Save'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('awayPresets', ['Lunch break 2']);
    });

    fireEvent.press(getByText('Remove'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('awayPresets', []);
    });
  });

  it('AwaySection manages auto-answer presets modal add/edit/remove flow', async () => {
    const { getByText, getByPlaceholderText } = render(
      <AwaySection colors={colors} styles={styles as any} settingIcons={{}} onClose={jest.fn()} />
    );

    fireEvent.press(getByText('Options'));
    await waitFor(() => expect(mockCapturedItems.has('away-auto-answer-presets')).toBe(true));

    fireEvent.press(getByText('Auto-answer presets'));
    await waitFor(() => expect(getByPlaceholderText('Add message')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Add message'), 'AFK for 5m');
    fireEvent.press(getByText('Add'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('awayAutoAnswerMessages', ['AFK for 5m']);
    });

    fireEvent.press(getByText('Edit'));
    fireEvent.changeText(getByPlaceholderText('Add message'), 'AFK for 10m');
    fireEvent.press(getByText('Save'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('awayAutoAnswerMessages', ['AFK for 10m']);
    });

    fireEvent.press(getByText('Remove'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('awayAutoAnswerMessages', []);
    });
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

  it('ProtectionSection covers keyword, spam mode, ircop, and ban reason modal flows', async () => {
    const { getByText, getByPlaceholderText } = render(
      <ProtectionSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
    await waitFor(() => expect(mockCapturedItems.has('spam-pm-keywords')).toBe(true));

    fireEvent.press(getByText('Spam keywords list'));
    await waitFor(() => expect(getByPlaceholderText('Add keyword or wildcard')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Add keyword or wildcard'), 'spam*');
    fireEvent.press(getByText('Add'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('spamPmKeywords', expect.arrayContaining(['spam*']));
    });

    fireEvent.press(getByText('Anti-spam on private messages'));
    fireEvent.press(getByText('Always'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('spamPmMode', 'always');
    });

    fireEvent.press(getByText('Close'));
    fireEvent.press(getByText('Flood / DOS'));
    fireEvent.press(getByText('IRCop auto action'));
    fireEvent.press(getByText('GLINE'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('protIrcopAction', 'gline');
    });

    fireEvent.press(getByText('Information about protections'));
    expect(getByText('Protections')).toBeTruthy();
    fireEvent.press(getByText('Close'));

    fireEvent.press(getByText('Predefined Kick/Ban Reasons'));
    await waitFor(() => expect(getByPlaceholderText('Add new reason...')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Add new reason...'), 'Flooding');
    fireEvent.press(getByText('Add'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('predefinedKickReasons', expect.arrayContaining(['Flooding']));
    });
  });

  it('ProtectionSection handles spam-log delete confirm and flood/ban-type toggles', async () => {
    const { getByText } = render(<ProtectionSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('spam-log-delete')).toBe(true));

    fireEvent.press(getByText('Delete SPAM.log'));
    await waitFor(() => expect(getByText('Are you sure you want to clear the spam log?')).toBeTruthy());
    fireEvent.press(getByText('Delete'));
    await waitFor(() => expect(mockClearSpamLog).toHaveBeenCalled());
    expect(getByText('SPAM.log')).toBeTruthy();

    fireEvent.press(getByText('Flood / DOS'));
    await waitFor(() => expect(mockCapturedItems.has('prot-ctcp-flood')).toBe(true));
    await mockCapturedItems.get('prot-ctcp-flood').onValueChange(true);
    await mockCapturedItems.get('prot-text-flood').onValueChange(true);
    await mockCapturedItems.get('prot-dcc-flood').onValueChange(true);
    await mockCapturedItems.get('prot-query-flood').onValueChange(true);
    await mockCapturedItems.get('prot-dos-attacks').onValueChange(true);
    await mockCapturedItems.get('prot-anti-deop-enabled').onValueChange(true);
    await mockCapturedItems.get('prot-anti-deop-chanserv').onValueChange(true);
    await mockCapturedItems.get('prot-exclude-tokens').onValueChange('CTCP SOUND');
    await mockCapturedItems.get('prot-enforce-silence').onValueChange(true);
    await mockCapturedItems.get('prot-block-tsunamis').onValueChange(true);
    await mockCapturedItems.get('prot-text-flood-net').onValueChange(true);
    await mockCapturedItems.get('prot-ircop-reason').onValueChange('Auto reason');
    await mockCapturedItems.get('prot-ircop-duration').onValueChange('2h');
    await mockCapturedItems.get('show_ban_mask_preview').onValueChange(false);
    await mockCapturedItems.get('confirm_before_kickban').onValueChange(false);
    expect(mockSetSetting).toHaveBeenCalledWith('protCtcpFlood', true);
    expect(mockSetSetting).toHaveBeenCalledWith('protTextFlood', true);
    expect(mockSetSetting).toHaveBeenCalledWith('protDccFlood', true);
    expect(mockSetSetting).toHaveBeenCalledWith('protQueryFlood', true);
    expect(mockSetSetting).toHaveBeenCalledWith('protDosAttacks', true);
    expect(mockSetSetting).toHaveBeenCalledWith('protAntiDeopEnabled', true);
    expect(mockSetSetting).toHaveBeenCalledWith('protAntiDeopUseChanserv', true);
    expect(mockSetSetting).toHaveBeenCalledWith('protExcludeTokens', 'CTCP SOUND');
    expect(mockSetSetting).toHaveBeenCalledWith('protEnforceSilence', true);
    expect(mockSetSetting).toHaveBeenCalledWith('protBlockTsunamis', true);
    expect(mockSetSetting).toHaveBeenCalledWith('protTextFloodNet', true);
    expect(mockSetSetting).toHaveBeenCalledWith('protIrcopReason', 'Auto reason');
    expect(mockSetSetting).toHaveBeenCalledWith('protIrcopDuration', '2h');
    expect(mockSetSetting).toHaveBeenCalledWith('showBanMaskPreview', false);
    expect(mockSetSetting).toHaveBeenCalledWith('confirmBeforeKickBan', false);

    fireEvent.press(getByText('Default Ban Type'));
    await waitFor(() => expect(getByText('10 - nick!*@*')).toBeTruthy());
    fireEvent.press(getByText('10 - nick!*@*'));
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('defaultBanType', 10));
  });

  it('ProtectionSection edits/removes keywords and reasons, supports reset defaults', async () => {
    const { getByText, getAllByText, getByPlaceholderText, getByTestId } = render(
      <ProtectionSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
    await waitFor(() => expect(mockCapturedItems.has('spam-pm-keywords')).toBe(true));

    fireEvent.press(getByText('Spam keywords list'));
    await waitFor(() => expect(getByPlaceholderText('Add keyword or wildcard')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Add keyword or wildcard'), 'bad*');
    fireEvent.press(getByText('Add'));
    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith('spamPmKeywords', expect.arrayContaining(['bad*']))
    );
    fireEvent.press(getAllByText('Edit')[getAllByText('Edit').length - 1]);
    fireEvent.press(getByText('Colors'));
    await waitFor(() => expect(getByTestId('mock-color-picker')).toBeTruthy());
    fireEvent.press(getByTestId('mock-color-insert'));
    fireEvent.press(getByText('Save'));
    fireEvent.press(getAllByText('Remove')[getAllByText('Remove').length - 1]);
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('spamPmKeywords', ['xxx', 'buy now']));
    fireEvent.press(getByText('Close'));

    fireEvent.press(getByText('Flood / DOS'));
    fireEvent.press(getByText('Predefined Kick/Ban Reasons'));
    await waitFor(() => expect(getByPlaceholderText('Add new reason...')).toBeTruthy());
    fireEvent.press(getByText('Edit'));
    fireEvent.changeText(getByPlaceholderText('Add new reason...'), 'Flood edited');
    fireEvent.press(getByText('Save'));
    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith('predefinedKickReasons', expect.arrayContaining(['Flood edited']))
    );
    fireEvent.press(getByText('Remove'));
    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith('predefinedKickReasons', expect.not.arrayContaining(['Flood edited']))
    );
    fireEvent.press(getByText('Reset to Defaults'));
    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith('predefinedKickReasons', ['Flood'])
    );
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

  it('WritingSection manages decoration and nick style modals', async () => {
    const { getByText, getByPlaceholderText, getAllByText } = render(
      <WritingSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
    await waitFor(() => expect(mockCapturedItems.has('decor-manage-styles')).toBe(true));

    fireEvent.press(getByText('Styles list'));
    await waitFor(() => expect(getByText('Add style')).toBeTruthy());
    fireEvent.press(getByText('Add style'));
    fireEvent.changeText(getByPlaceholderText('Use <text>'), '<text> style');
    fireEvent.press(getByText('Save'));
    await waitFor(() => {
      expect(mockSetSetting).toHaveBeenCalledWith('decorStyles', ['<text> style']);
    });
    fireEvent.press(getAllByText('Close')[0]);

    fireEvent.press(getByText('Nick Completion'));
    await waitFor(() => expect(mockCapturedItems.has('nick-complete-styles')).toBe(true));
    expect(mockCapturedItems.has('nick-complete-style')).toBe(true);
  });

  it('WritingSection handles no-styles alerts and style select/clear flows', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText, getByPlaceholderText } = render(
      <WritingSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
    await waitFor(() => expect(mockCapturedItems.has('decor-text-style')).toBe(true));

    fireEvent.press(getByText('Decoration style'));
    expect(alertSpy).toHaveBeenCalled();

    fireEvent.press(getByText('Styles list'));
    fireEvent.press(getByText('Add style'));
    fireEvent.changeText(getByPlaceholderText('Use <text>'), '<text>!!!');
    fireEvent.press(getByText('Save'));
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('decorStyles', ['<text>!!!']));
    fireEvent.press(getByText('Close'));

    fireEvent.press(getByText('Decoration style'));
    await waitFor(() => expect(getByText('Text!!!')).toBeTruthy());
    fireEvent.press(getByText('Text!!!'));
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('decorTextStyleId', '<text>!!!'));
    fireEvent.press(getByText('Decoration style'));
    fireEvent.press(getByText('Clear'));
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('decorTextStyleId', ''));
  });

  it('WritingSection handles nick style add/select/edit/remove and editor color insert', async () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(
      <WritingSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
    fireEvent.press(getByText('Nick Completion'));
    await waitFor(() => expect(mockCapturedItems.has('nick-complete-style')).toBe(true));

    fireEvent.press(getByText('Active style'));
    expect(Alert.alert).toHaveBeenCalled();

    fireEvent.press(getByText('Nick completion styles'));
    fireEvent.press(getByText('Add style'));
    await waitFor(() => expect(getByPlaceholderText('Use <nick>')).toBeTruthy());
    fireEvent.changeText(getByPlaceholderText('Use <nick>'), '<nick>:');
    fireEvent.press(getByText('Colors'));
    await waitFor(() => expect(getByTestId('mock-color-picker')).toBeTruthy());
    fireEvent.press(getByTestId('mock-color-insert'));
    fireEvent.press(getByText('Save'));
    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith('nickCompleteStyles', expect.arrayContaining(['<nick>:\u000304']))
    );
    fireEvent.press(getByText('Close'));

    fireEvent.press(getByText('Active style'));
    await waitFor(() => expect(getByText(/Nick:/)).toBeTruthy());
    fireEvent.press(getByText(/Nick:/));
    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('nickCompleteStyleId', '<nick>:\u000304'));

    fireEvent.press(getByText('Nick completion styles'));
    fireEvent.press(getByText('Edit'));
    fireEvent.changeText(getByPlaceholderText('Use <nick>'), '<nick>->');
    fireEvent.press(getByText('Save'));
    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith('nickCompleteStyles', expect.arrayContaining(['<nick>->']))
    );
    fireEvent.press(getByText('Remove'));
    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith('nickCompleteStyles', [])
    );
  });
});
