/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { DisplayUISection } from '../../../src/components/settings/sections/DisplayUISection';
import { CommandsSection } from '../../../src/components/settings/sections/CommandsSection';

const mockCapturedItems = new Map<string, any>();
const mockSetSetting = jest.fn(async () => undefined);
const mockGetSetting = jest.fn(async (_k: string, d: any) => d);
const mockUpdateLayoutConfig = jest.fn(async () => undefined);
const mockSetMessageSpacing = jest.fn(async () => undefined);
const mockSetMessagePadding = jest.fn(async () => undefined);
const mockSetNavigationBarOffset = jest.fn(async () => undefined);
const mockSetTimestampDisplay = jest.fn(async () => undefined);
const mockSetMessageGroupingEnabled = jest.fn(async () => undefined);
const mockSetMessageTextAlign = jest.fn(async () => undefined);
const mockSetMessageTextDirection = jest.fn(async () => undefined);
const mockSetTimestampFormat = jest.fn(async () => undefined);

const mockGetAliases = jest.fn(() => []);
const mockGetCustomCommands = jest.fn(() => []);
const mockGetHistory = jest.fn(() => []);
const mockAddAlias = jest.fn(async () => undefined);
const mockAddCustomCommand = jest.fn(async () => undefined);
const mockRemoveAlias = jest.fn(async () => undefined);
const mockRemoveCustomCommand = jest.fn(async () => undefined);
const mockDeleteHistoryEntry = jest.fn(async () => undefined);
const mockClearHistory = jest.fn(async () => undefined);
const mockSetSwipeBehavior = jest.fn();
const mockSetWhoisDisplayMode = jest.fn();

jest.mock('../../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../../src/components/settings/SettingItem', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    SettingItem: ({ item, onPress }: any) => {
      mockCapturedItems.set(item.id, item);
      return React.createElement(
        TouchableOpacity,
        {
          testID: `setting-${item.id}`,
          onPress: () => {
            item.onPress?.();
            if (item.type === 'switch') item.onValueChange?.(!item.value);
            if (item.type === 'input') item.onValueChange?.('7');
            if (item.type === 'submenu') onPress?.(item.id);
          },
        },
        React.createElement(Text, null, item.title || item.id)
      );
    },
  };
});

jest.mock('../../../src/hooks/useSettingsAppearance', () => ({
  useSettingsAppearance: () => ({
    layoutConfig: {
      showTimestamps: true,
      messageGroupingEnabled: true,
      messageTextAlign: 'left',
      messageTextDirection: 'auto',
      timestampDisplay: 'always',
      timestampFormat: '24h',
    },
    updateLayoutConfig: (...args: any[]) => mockUpdateLayoutConfig(...args),
  }),
}));

jest.mock('../../../src/services/LayoutService', () => ({
  layoutService: {
    setMessageSpacing: (...args: any[]) => mockSetMessageSpacing(...args),
    setMessagePadding: (...args: any[]) => mockSetMessagePadding(...args),
    setNavigationBarOffset: (...args: any[]) => mockSetNavigationBarOffset(...args),
    setTimestampDisplay: (...args: any[]) => mockSetTimestampDisplay(...args),
    setMessageGroupingEnabled: (...args: any[]) => mockSetMessageGroupingEnabled(...args),
    setMessageTextAlign: (...args: any[]) => mockSetMessageTextAlign(...args),
    setMessageTextDirection: (...args: any[]) => mockSetMessageTextDirection(...args),
    setTimestampFormat: (...args: any[]) => mockSetTimestampFormat(...args),
  },
}));

jest.mock('../../../src/services/SettingsService', () => ({
  NEW_FEATURE_DEFAULTS: {
    channelListScrollSwitchTabs: false,
    channelListScrollSwitchTabsInverse: false,
  },
  settingsService: {
    getSetting: (...args: any[]) => mockGetSetting(...args),
    setSetting: (...args: any[]) => mockSetSetting(...args),
  },
}));

jest.mock('../../../src/services/IRCService', () => ({
  RAW_MESSAGE_CATEGORIES: [{ id: 'join', label: 'Join' }, { id: 'notice', label: 'Notice' }],
  getDefaultRawCategoryVisibility: () => ({ join: true, notice: true }),
}));

jest.mock('../../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: () => ({
      setSwipeBehavior: (...args: any[]) => mockSetSwipeBehavior(...args),
      setWhoisDisplayMode: (...args: any[]) => mockSetWhoisDisplayMode(...args),
    }),
  },
}));

jest.mock('../../../src/services/CommandService', () => ({
  commandService: {
    getAliases: (...args: any[]) => mockGetAliases(...args),
    getCustomCommands: (...args: any[]) => mockGetCustomCommands(...args),
    getHistory: (...args: any[]) => mockGetHistory(...args),
    addAlias: (...args: any[]) => mockAddAlias(...args),
    removeAlias: (...args: any[]) => mockRemoveAlias(...args),
    addCustomCommand: (...args: any[]) => mockAddCustomCommand(...args),
    removeCustomCommand: (...args: any[]) => mockRemoveCustomCommand(...args),
    deleteHistoryEntry: (...args: any[]) => mockDeleteHistoryEntry(...args),
    clearHistory: (...args: any[]) => mockClearHistory(...args),
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
  input: {},
  disabledInput: {},
  submenuOverlay: {},
  submenuContainer: {},
  submenuHeader: {},
  submenuTitle: {},
  submenuItem: {},
  submenuItemContent: {},
  submenuItemText: {},
  submenuItemDescription: {},
  submenuInput: {},
  closeButtonText: {},
};

describe('DisplayUI + Commands sections', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('DisplayUISection renders and updates settings', async () => {
    render(
      <DisplayUISection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        showRawCommands={false}
        rawCategoryVisibility={{ join: true, notice: false } as any}
      />
    );
    await waitFor(() => expect(mockCapturedItems.has('display-tab-sort')).toBe(true));

    await mockCapturedItems.get('display-tab-sort').onValueChange(false);
    await mockCapturedItems.get('display-confirm-links').onValueChange(false);
    expect(mockSetSetting).toHaveBeenCalledWith('tabSortAlphabetical', false);
    expect(mockSetSetting).toHaveBeenCalledWith('confirmBeforeOpeningLinks', false);
  });

  it('DisplayUISection forwards raw/encryption/typing and submenu callbacks', async () => {
    const onShowRawCommandsChange = jest.fn();
    const onRawCategoryVisibilityChange = jest.fn();
    const onShowEncryptionIndicatorsChange = jest.fn();
    const onShowTypingIndicatorsChange = jest.fn();

    render(
      <DisplayUISection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        showRawCommands={false}
        rawCategoryVisibility={{ join: true, notice: false } as any}
        onShowRawCommandsChange={onShowRawCommandsChange}
        onRawCategoryVisibilityChange={onRawCategoryVisibilityChange}
        showEncryptionIndicators={true}
        onShowEncryptionIndicatorsChange={onShowEncryptionIndicatorsChange}
        showTypingIndicators={true}
        onShowTypingIndicatorsChange={onShowTypingIndicatorsChange}
      />
    );

    await waitFor(() => expect(mockCapturedItems.has('display-raw')).toBe(true));

    mockCapturedItems.get('display-raw').onValueChange(true);
    expect(onShowRawCommandsChange).toHaveBeenCalledWith(true);
    expect(onRawCategoryVisibilityChange).toHaveBeenCalled();

    await mockCapturedItems.get('display-encryption-icons').onValueChange(false);
    await mockCapturedItems.get('display-typing-indicators').onValueChange(false);
    expect(mockSetSetting).toHaveBeenCalledWith('showEncryptionIndicators', false);
    expect(mockSetSetting).toHaveBeenCalledWith('showTypingIndicators', false);
    expect(onShowEncryptionIndicatorsChange).toHaveBeenCalledWith(false);
    expect(onShowTypingIndicatorsChange).toHaveBeenCalledWith(false);

    await mockCapturedItems
      .get('display-swipe-behavior')
      .submenuItems.find((x: any) => x.id === 'swipe-switch-tabs')
      .onPress();
    expect(mockSetSetting).toHaveBeenCalledWith('swipeBehavior', 'switch-tabs');
    expect(mockSetSwipeBehavior).toHaveBeenCalledWith('switch-tabs');

    await mockCapturedItems
      .get('display-whois')
      .submenuItems.find((x: any) => x.id === 'whois-modal')
      .onPress();
    expect(mockSetSetting).toHaveBeenCalledWith('whoisDisplayMode', 'modal');
    expect(mockSetWhoisDisplayMode).toHaveBeenCalledWith('modal');

    await mockCapturedItems
      .get('display-notices')
      .submenuItems.find((x: any) => x.id === 'notice-private')
      .onPress();
    expect(mockSetSetting).toHaveBeenCalledWith('noticeTarget', 'private');

    await mockCapturedItems
      .get('display-notices')
      .submenuItems.find((x: any) => x.id === 'notice-active')
      .onPress();
    expect(mockSetSetting).toHaveBeenCalledWith('noticeTarget', 'active');

    await mockCapturedItems
      .get('display-notices')
      .submenuItems.find((x: any) => x.id === 'notice-server')
      .onPress();
    expect(mockSetSetting).toHaveBeenCalledWith('noticeTarget', 'server');

    await mockCapturedItems
      .get('display-notices')
      .submenuItems.find((x: any) => x.id === 'notice-tab')
      .onPress();
    expect(mockSetSetting).toHaveBeenCalledWith('noticeTarget', 'notice');

    await mockCapturedItems
      .get('display-whois')
      .submenuItems.find((x: any) => x.id === 'whois-active')
      .onPress();
    expect(mockSetSetting).toHaveBeenCalledWith('whoisDisplayMode', 'active');
    expect(mockSetWhoisDisplayMode).toHaveBeenCalledWith('active');

    await mockCapturedItems
      .get('display-whois')
      .submenuItems.find((x: any) => x.id === 'whois-status')
      .onPress();
    expect(mockSetSetting).toHaveBeenCalledWith('whoisDisplayMode', 'status');
    expect(mockSetWhoisDisplayMode).toHaveBeenCalledWith('status');
  });

  it('DisplayUISection handles alignment, direction, timestamp, keyboard and banner options', async () => {
    render(
      <DisplayUISection
        colors={colors}
        styles={styles as any}
        settingIcons={{}}
        showRawCommands={true}
        rawCategoryVisibility={{ join: true, notice: false } as any}
      />
    );
    await waitFor(() => expect(mockCapturedItems.has('display-banner-position')).toBe(true));

    await mockCapturedItems
      .get('message-text-align')
      .submenuItems.find((x: any) => x.id === 'align-center')
      .onPress();
    await mockCapturedItems
      .get('message-text-align')
      .submenuItems.find((x: any) => x.id === 'align-right')
      .onPress();
    await mockCapturedItems
      .get('message-text-align')
      .submenuItems.find((x: any) => x.id === 'align-justify')
      .onPress();
    expect(mockSetMessageTextAlign).toHaveBeenCalledWith('center');
    expect(mockSetMessageTextAlign).toHaveBeenCalledWith('right');
    expect(mockSetMessageTextAlign).toHaveBeenCalledWith('justify');

    await mockCapturedItems
      .get('message-text-direction')
      .submenuItems.find((x: any) => x.id === 'direction-ltr')
      .onPress();
    await mockCapturedItems
      .get('message-text-direction')
      .submenuItems.find((x: any) => x.id === 'direction-rtl')
      .onPress();
    expect(mockSetMessageTextDirection).toHaveBeenCalledWith('ltr');
    expect(mockSetMessageTextDirection).toHaveBeenCalledWith('rtl');

    await mockCapturedItems
      .get('layout-timestamp-display')
      .submenuItems.find((x: any) => x.id === 'timestamp-never')
      .onPress();
    await mockCapturedItems
      .get('layout-timestamp-display')
      .submenuItems.find((x: any) => x.id === 'timestamp-always')
      .onPress();
    expect(mockSetTimestampDisplay).toHaveBeenCalledWith('never');
    expect(mockSetTimestampDisplay).toHaveBeenCalledWith('always');

    await mockCapturedItems
      .get('layout-timestamp-format')
      .submenuItems.find((x: any) => x.id === 'format-12h')
      .onPress();
    await mockCapturedItems
      .get('layout-timestamp-format')
      .submenuItems.find((x: any) => x.id === 'format-24h')
      .onPress();
    expect(mockSetTimestampFormat).toHaveBeenCalledWith('12h');
    expect(mockSetTimestampFormat).toHaveBeenCalledWith('24h');

    await mockCapturedItems.get('display-send-button').onValueChange(false);
    await mockCapturedItems
      .get('display-enter-key-behavior')
      .submenuItems.find((x: any) => x.id === 'enter-send')
      .onPress();
    await mockCapturedItems
      .get('display-enter-key-behavior')
      .submenuItems.find((x: any) => x.id === 'enter-newline')
      .onPress();
    await mockCapturedItems.get('display-color-picker-button').onValueChange(false);
    expect(mockSetSetting).toHaveBeenCalledWith('showSendButton', false);
    expect(mockSetSetting).toHaveBeenCalledWith('enterKeyBehavior', 'send');
    expect(mockSetSetting).toHaveBeenCalledWith('enterKeyBehavior', 'newline');
    expect(mockSetSetting).toHaveBeenCalledWith('showColorPickerButton', false);

    await mockCapturedItems
      .get('display-banner-position')
      .submenuItems.find((x: any) => x.id === 'banner-pos-input-below')
      .onPress();
    await mockCapturedItems
      .get('display-banner-position')
      .submenuItems.find((x: any) => x.id === 'banner-pos-tabs-above')
      .onPress();
    await mockCapturedItems
      .get('display-banner-position')
      .submenuItems.find((x: any) => x.id === 'banner-pos-tabs-below')
      .onPress();
    expect(mockSetSetting).toHaveBeenCalledWith('bannerPosition', 'input_below');
    expect(mockSetSetting).toHaveBeenCalledWith('bannerPosition', 'tabs_above');
    expect(mockSetSetting).toHaveBeenCalledWith('bannerPosition', 'tabs_below');

    await mockCapturedItems.get('display-keyboard-avoiding').onValueChange(false);
    await mockCapturedItems
      .get('display-keyboard-behavior-ios')
      .submenuItems.find((x: any) => x.id === 'keyboard-behavior-ios-position')
      .onPress();
    await mockCapturedItems
      .get('display-keyboard-behavior-android')
      .submenuItems.find((x: any) => x.id === 'keyboard-behavior-android-translate-with-padding')
      .onPress();
    await mockCapturedItems.get('display-keyboard-offset').onValueChange('42px');
    await mockCapturedItems.get('display-android-bottom-safe-area').onValueChange(false);
    expect(mockSetSetting).toHaveBeenCalledWith('keyboardAvoidingEnabled', false);
    expect(mockSetSetting).toHaveBeenCalledWith('keyboardBehaviorIOS', 'position');
    expect(mockSetSetting).toHaveBeenCalledWith('keyboardBehaviorAndroid', 'translate-with-padding');
    expect(mockSetSetting).toHaveBeenCalledWith('keyboardVerticalOffset', 42);
    expect(mockSetSetting).toHaveBeenCalledWith('useAndroidBottomSafeArea', false);
  });

  it('CommandsSection renders and handles alias add validation path', async () => {
    render(<CommandsSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('commands-aliases')).toBe(true));

    const getAliasSubmenu = () => mockCapturedItems.get('commands-aliases');

    getAliasSubmenu().submenuItems.find((x: any) => x.id === 'alias-name-input').onValueChange('j');
    await waitFor(() => {
      const nameValue = getAliasSubmenu().submenuItems.find((x: any) => x.id === 'alias-name-input')?.value;
      expect(nameValue).toBe('j');
    });

    getAliasSubmenu().submenuItems.find((x: any) => x.id === 'alias-command-input').onValueChange('/join #test');
    await waitFor(() => {
      const commandValue = getAliasSubmenu().submenuItems.find((x: any) => x.id === 'alias-command-input')?.value;
      expect(commandValue).toBe('/join #test');
    });

    await getAliasSubmenu().submenuItems.find((x: any) => x.id === 'alias-add').onPress();
    expect(mockAddAlias).toHaveBeenCalledWith(
      expect.objectContaining({ alias: 'j', command: '/join #test' })
    );
  });

  it('CommandsSection validates alias input and custom command parameter extraction', async () => {
    render(<CommandsSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('commands-aliases')).toBe(true));

    const aliasSubmenu = mockCapturedItems.get('commands-aliases');
    await aliasSubmenu.submenuItems.find((x: any) => x.id === 'alias-add').onPress();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Alias name and command are required');

    const customSubmenu = mockCapturedItems.get('commands-custom');
    customSubmenu.submenuItems.find((x: any) => x.id === 'custom-name-input').onValueChange('greet');
    customSubmenu.submenuItems
      .find((x: any) => x.id === 'custom-command-input')
      .onValueChange('/msg {channel} hello {param1} {param1}');

    await waitFor(() => {
      expect(
        mockCapturedItems
          .get('commands-custom')
          .submenuItems.find((x: any) => x.id === 'custom-name-input')?.value
      ).toBe('greet');
    });

    await mockCapturedItems
      .get('commands-custom')
      .submenuItems.find((x: any) => x.id === 'cmd-add')
      .onPress();

    expect(mockAddCustomCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'greet',
        command: '/msg {channel} hello {param1} {param1}',
        parameters: ['channel', 'param1'],
      })
    );
  });

  it('CommandsSection handles history clear/delete and alias/custom delete actions', async () => {
    mockGetHistory.mockReturnValue([
      { id: 'h1', command: '/join #a', timestamp: Date.now(), channel: '#a' },
    ]);
    mockGetAliases.mockReturnValue([
      { alias: 'j', command: '/join {channel}', description: 'join fast' },
    ]);
    mockGetCustomCommands.mockReturnValue([
      { name: 'wave', command: '/msg {channel} hi', description: 'wave', parameters: ['channel'] },
    ]);

    render(<CommandsSection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('commands-history')).toBe(true));

    const historyMenu = mockCapturedItems.get('commands-history');
    historyMenu.submenuItems.find((x: any) => x.id === 'history-h1').onPress();
    let args = (Alert.alert as jest.Mock).mock.calls.pop();
    let deleteButton = args?.[2]?.find((b: any) => String(b.text).includes('Delete'));
    await deleteButton?.onPress?.();
    expect(mockDeleteHistoryEntry).toHaveBeenCalledWith('h1');

    historyMenu.submenuItems.find((x: any) => x.id === 'history-clear').onPress();
    args = (Alert.alert as jest.Mock).mock.calls.pop();
    const deleteAll = args?.[2]?.find((b: any) => String(b.text).includes('Delete All'));
    await deleteAll?.onPress?.();
    expect(mockClearHistory).toHaveBeenCalled();

    const aliasMenu = mockCapturedItems.get('commands-aliases');
    aliasMenu.submenuItems.find((x: any) => x.id === 'alias-j').onPress();
    args = (Alert.alert as jest.Mock).mock.calls.pop();
    deleteButton = args?.[2]?.find((b: any) => String(b.text).includes('Delete'));
    await deleteButton?.onPress?.();
    expect(mockRemoveAlias).toHaveBeenCalledWith('j');

    const customMenu = mockCapturedItems.get('commands-custom');
    customMenu.submenuItems.find((x: any) => x.id === 'cmd-wave').onPress();
    args = (Alert.alert as jest.Mock).mock.calls.pop();
    deleteButton = args?.[2]?.find((b: any) => String(b.text).includes('Delete'));
    await deleteButton?.onPress?.();
    expect(mockRemoveCustomCommand).toHaveBeenCalledWith('wave');
  });
});
