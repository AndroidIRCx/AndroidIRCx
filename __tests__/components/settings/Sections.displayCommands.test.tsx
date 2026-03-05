/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
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

const mockGetAliases = jest.fn(() => []);
const mockGetCustomCommands = jest.fn(() => []);
const mockGetHistory = jest.fn(() => []);
const mockAddAlias = jest.fn(async () => undefined);

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
      setSwipeBehavior: jest.fn(),
    }),
  },
}));

jest.mock('../../../src/services/CommandService', () => ({
  commandService: {
    getAliases: (...args: any[]) => mockGetAliases(...args),
    getCustomCommands: (...args: any[]) => mockGetCustomCommands(...args),
    getHistory: (...args: any[]) => mockGetHistory(...args),
    addAlias: (...args: any[]) => mockAddAlias(...args),
    removeAlias: jest.fn(async () => undefined),
    addCustomCommand: jest.fn(async () => undefined),
    removeCustomCommand: jest.fn(async () => undefined),
    deleteHistoryEntry: jest.fn(async () => undefined),
    clearHistory: jest.fn(async () => undefined),
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
});
