/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AdvancedSection } from '../../../src/components/settings/sections/AdvancedSection';
import { HelpSection } from '../../../src/components/settings/sections/HelpSection';
import { MessageHistorySection } from '../../../src/components/settings/sections/MessageHistorySection';
import { UsersServicesSection } from '../../../src/components/settings/sections/UsersServicesSection';

const mockCapturedItems = new Map<string, any>();
const mockSettingsGet = jest.fn(async (_k: string, d: any) => d);
const mockSettingsSet = jest.fn(async () => undefined);
const mockGetUserNotes = jest.fn(() => []);
const mockGetUserAliases = jest.fn(() => []);
const mockRemoveUserNote = jest.fn(async () => undefined);
const mockRemoveUserAlias = jest.fn(async () => undefined);

const mockSetShowHelpConnection = jest.fn();
const mockSetShowHelpCommands = jest.fn();
const mockSetShowHelpEncryption = jest.fn();
const mockSetShowHelpMedia = jest.fn();
const mockSetShowHelpChannelManagement = jest.fn();
const mockSetShowHelpTroubleshooting = jest.fn();

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
            if (item.type === 'input') item.onValueChange?.('updated');
            if (item.type === 'submenu') onPress?.(item.id);
          },
        },
        React.createElement(Text, null, item.title || item.id)
      );
    },
  };
});

jest.mock('../../../src/services/SettingsService', () => ({
  DEFAULT_PART_MESSAGE: 'Leaving',
  DEFAULT_QUIT_MESSAGE: 'Quit',
  DEFAULT_CTCP_VERSION_MESSAGE: 'AndroidIRCX',
  settingsService: {
    getSetting: (...args: any[]) => mockSettingsGet(...args),
    setSetting: (...args: any[]) => mockSettingsSet(...args),
  },
}));

jest.mock('../../../src/services/UserManagementService', () => ({
  userManagementService: {
    getUserNotes: (...args: any[]) => mockGetUserNotes(...args),
    getUserAliases: (...args: any[]) => mockGetUserAliases(...args),
    removeUserNote: (...args: any[]) => mockRemoveUserNote(...args),
    removeUserAlias: (...args: any[]) => mockRemoveUserAlias(...args),
  },
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
  useUIStore: () => ({
    setShowHelpConnection: (...args: any[]) => mockSetShowHelpConnection(...args),
    setShowHelpCommands: (...args: any[]) => mockSetShowHelpCommands(...args),
    setShowHelpEncryption: (...args: any[]) => mockSetShowHelpEncryption(...args),
    setShowHelpMedia: (...args: any[]) => mockSetShowHelpMedia(...args),
    setShowHelpChannelManagement: (...args: any[]) => mockSetShowHelpChannelManagement(...args),
    setShowHelpTroubleshooting: (...args: any[]) => mockSetShowHelpTroubleshooting(...args),
  }),
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => 'Icon');

const colors = {
  text: '#111',
  textSecondary: '#666',
  textDisabled: '#777',
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
};

describe('Sections misc', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('AdvancedSection renders null when empty', () => {
    const { queryByTestId } = render(
      <AdvancedSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
    expect(queryByTestId('setting-any')).toBeNull();
  });

  it('HelpSection triggers all help entrypoint callbacks', () => {
    const { getByText } = render(<HelpSection />);
    fireEvent.press(getByText('Troubleshooting Guide'));
    fireEvent.press(getByText('IRC Connection Guide'));
    fireEvent.press(getByText('Commands Reference'));
    fireEvent.press(getByText('Encryption Guide'));
    fireEvent.press(getByText('Media Sharing Guide'));
    fireEvent.press(getByText('Channel Management'));

    expect(mockSetShowHelpTroubleshooting).toHaveBeenCalledWith(true);
    expect(mockSetShowHelpConnection).toHaveBeenCalledWith(true);
    expect(mockSetShowHelpCommands).toHaveBeenCalledWith(true);
    expect(mockSetShowHelpEncryption).toHaveBeenCalledWith(true);
    expect(mockSetShowHelpMedia).toHaveBeenCalledWith(true);
    expect(mockSetShowHelpChannelManagement).toHaveBeenCalledWith(true);
  });

  it('MessageHistorySection persists input/switch updates', async () => {
    render(<MessageHistorySection colors={colors} styles={styles as any} settingIcons={{}} />);
    await waitFor(() => expect(mockCapturedItems.has('messages-part')).toBe(true));

    await mockCapturedItems.get('messages-part').onValueChange('Parting');
    await mockCapturedItems.get('messages-quit').onValueChange('Bye');
    await mockCapturedItems.get('messages-hide-join').onValueChange(true);
    await mockCapturedItems.get('messages-hide-part').onValueChange(true);
    await mockCapturedItems.get('messages-hide-quit').onValueChange(true);
    await mockCapturedItems.get('messages-hide-irc-listener').onValueChange(false);
    await mockCapturedItems.get('messages-close-private-enabled').onValueChange(true);
    await mockCapturedItems.get('messages-close-private-text').onValueChange('Window closed');
    await mockCapturedItems.get('messages-ctcp-version').onValueChange('v2');

    expect(mockSettingsSet).toHaveBeenCalledWith('partMessage', 'Parting');
    expect(mockSettingsSet).toHaveBeenCalledWith('quitMessage', 'Bye');
    expect(mockSettingsSet).toHaveBeenCalledWith('hideJoinMessages', true);
    expect(mockSettingsSet).toHaveBeenCalledWith('hidePartMessages', true);
    expect(mockSettingsSet).toHaveBeenCalledWith('hideQuitMessages', true);
    expect(mockSettingsSet).toHaveBeenCalledWith('hideIrcServiceListenerMessages', false);
    expect(mockSettingsSet).toHaveBeenCalledWith('closePrivateMessage', true);
    expect(mockSettingsSet).toHaveBeenCalledWith('closePrivateMessageText', 'Window closed');
    expect(mockSettingsSet).toHaveBeenCalledWith('ctcpVersionMessage', 'v2');
  });

  it('UsersServicesSection handles remove service and note/alias delete actions', async () => {
    mockGetUserNotes.mockReturnValue([
      { nick: 'alice', network: 'net', note: 'known user' },
    ]);
    mockGetUserAliases.mockReturnValue([
      { nick: 'alice', network: 'net', alias: 'ali' },
    ]);

    const { getByText } = render(
      <UsersServicesSection colors={colors} styles={styles as any} settingIcons={{}} currentNetwork="net" />
    );
    await waitFor(() => expect(mockCapturedItems.has('irc-service-nickserv')).toBe(true));

    mockCapturedItems.get('irc-service-nickserv').onPress();
    const removeSvcButtons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] || [];
    await removeSvcButtons.find((b: any) => b.text === 'Remove')?.onPress?.();
    expect(mockSettingsSet).toHaveBeenCalledWith(
      'ircServices',
      expect.not.arrayContaining(['nickserv'])
    );

    await mockCapturedItems
      .get('user-notes')
      .submenuItems.find((x: any) => x.id.startsWith('user-note-'))
      .onPress();
    const removeNoteButtons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] || [];
    await removeNoteButtons.find((b: any) => b.text === 'Delete')?.onPress?.();
    expect(mockRemoveUserNote).toHaveBeenCalledWith('alice', 'net');

    await mockCapturedItems
      .get('user-aliases')
      .submenuItems.find((x: any) => x.id.startsWith('user-alias-'))
      .onPress();
    const removeAliasButtons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] || [];
    await removeAliasButtons.find((b: any) => b.text === 'Delete')?.onPress?.();
    expect(mockRemoveUserAlias).toHaveBeenCalledWith('alice', 'net');

    fireEvent.press(getByText('Blacklist'));
    expect(Alert.alert).toHaveBeenCalled();
  });
});

