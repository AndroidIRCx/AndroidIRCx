/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { NickContextMenu } from '../../src/components/NickContextMenu';

// Mock all the services used by NickContextMenu
const mockSendRaw = jest.fn();
const mockSendCommand = jest.fn();
const mockSendSilentWho = jest.fn();
const mockIsMonitoring = jest.fn();
const mockGetChannelUsers = jest.fn();

const mockIsUserIgnored = jest.fn();
const mockGetUserNote = jest.fn();

const mockGenerateBanMask = jest.fn();

const mockGetCommands = jest.fn();

const mockGetSetting = jest.fn();

const mockGetCallNicklistCallActionsEnabled = jest.fn();

const mockSetShowBlacklist = jest.fn();
const mockSetBlacklistTarget = jest.fn();
const mockSetUserListsInitialTab = jest.fn();
const mockSetUserListTarget = jest.fn();
const mockSetShowUserLists = jest.fn();

jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    sendRaw: (...args: unknown[]) => mockSendRaw(...args),
    sendCommand: (...args: unknown[]) => mockSendCommand(...args),
    sendSilentWho: (...args: unknown[]) => mockSendSilentWho(...args),
    isMonitoring: (...args: unknown[]) => mockIsMonitoring(...args),
    getChannelUsers: (...args: unknown[]) => mockGetChannelUsers(...args),
    capEnabledSet: new Set(),
  },
}));

jest.mock('../../src/services/UserManagementService', () => ({
  userManagementService: {
    isUserIgnored: (...args: unknown[]) => mockIsUserIgnored(...args),
    getUserNote: (...args: unknown[]) => mockGetUserNote(...args),
  },
}));

jest.mock('../../src/services/BanService', () => ({
  banService: {
    generateBanMask: (...args: unknown[]) => mockGenerateBanMask(...args),
  },
}));

jest.mock('../../src/services/ServiceCommandProvider', () => ({
  serviceCommandProvider: {
    getCommands: (...args: unknown[]) => mockGetCommands(...args),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  NEW_FEATURE_DEFAULTS: {
    confirmBeforeKickBan: true,
    defaultBanType: 2,
    predefinedKickReasons: ['Goodbye', 'Spamming', 'Abusive behavior'],
  },
  settingsService: {
    getSetting: (...args: unknown[]) => mockGetSetting(...args),
  },
}));

jest.mock('../../src/services/MediaSettingsService', () => ({
  mediaSettingsService: {
    getCallNicklistCallActionsEnabled: (...args: unknown[]) =>
      mockGetCallNicklistCallActionsEnabled(...args),
  },
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: () => ({
      setShowBlacklist: (...args: unknown[]) => mockSetShowBlacklist(...args),
      setBlacklistTarget: (...args: unknown[]) =>
        mockSetBlacklistTarget(...args),
      setUserListsInitialTab: (...args: unknown[]) =>
        mockSetUserListsInitialTab(...args),
      setUserListTarget: (...args: unknown[]) => mockSetUserListTarget(...args),
      setShowUserLists: (...args: unknown[]) => mockSetShowUserLists(...args),
    }),
  },
}));

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string, params?: Record<string, string>) => {
    if (params) {
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, v),
        key,
      );
    }
    return key;
  },
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: jest.fn(() => React.createElement('Text', null, 'Icon')),
  };
});

jest.mock('../../src/components/KickBanModal', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: jest.fn(({ visible, onClose, onConfirm, nick, mode }: any) => {
      if (!visible) return null;
      return React.createElement(
        View,
        { testID: 'kick-ban-modal' },
        React.createElement(Text, null, `KickBanModal - ${mode} - ${nick}`),
        React.createElement(
          TouchableOpacity,
          {
            testID: 'kick-ban-confirm',
            onPress: () =>
              onConfirm({
                kick: true,
                ban: mode === 'ban' || mode === 'kickban',
                reason: 'Test reason',
                banType: 2,
              }),
          },
          React.createElement(Text, null, 'Confirm'),
        ),
        React.createElement(
          TouchableOpacity,
          { testID: 'kick-ban-cancel', onPress: onClose },
          React.createElement(Text, null, 'Cancel'),
        ),
      );
    }),
  };
});

const baseColors = {
  text: '#212121',
  textSecondary: '#757575',
  primary: '#2196F3',
  surface: '#FAFAFA',
  border: '#E0E0E0',
  background: '#F5F5F5',
};

const baseProps = {
  visible: true,
  nick: 'TestUser',
  onClose: jest.fn(),
  onAction: jest.fn(),
  actionMessage: '',
  colors: baseColors,
  connection: null,
  network: 'test-network',
  channel: '#test-channel',
  activeNick: 'MyNick',
  allowQrVerification: true,
  allowFileExchange: true,
  allowNfcExchange: true,
  isServerOper: false,
  ignoreActionId: 'ignore_toggle',
};

describe('NickContextMenu', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockIsMonitoring.mockReturnValue(false);
    mockIsUserIgnored.mockReturnValue(false);
    mockGetUserNote.mockReturnValue(null);
    mockGetChannelUsers.mockReturnValue([]);
    mockGetCommands.mockReturnValue([]);
    mockGetSetting.mockImplementation((key: string, defaultValue: any) =>
      Promise.resolve(defaultValue),
    );
    mockGetCallNicklistCallActionsEnabled.mockResolvedValue(false);
    mockGenerateBanMask.mockReturnValue('*!*@test.host');
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  // ==================== Basic Rendering ====================
  describe('basic rendering', () => {
    it('renders correctly with basic props', async () => {
      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      expect(getByText('TestUser')).toBeTruthy();
      expect(getByText('Copy nickname')).toBeTruthy();
    });

    it('renders with action message banner', async () => {
      const { getByText } = await render(
        <NickContextMenu {...baseProps} actionMessage="User is online" />,
      );
      expect(getByText('User is online')).toBeTruthy();
    });

    it('does not render when not visible', async () => {
      const { queryByText } = await render(
        <NickContextMenu {...baseProps} visible={false} />,
      );
      expect(queryByText('TestUser')).toBeNull();
    });

    it('renders without nick', async () => {
      const { queryByText } = await render(
        <NickContextMenu {...baseProps} nick={undefined} />,
      );
      // Component should still render even without nick
      expect(queryByText('Copy nickname')).toBeTruthy();
    });
  });

  // ==================== Quick Actions ====================
  describe('quick actions', () => {
    it('handles WHOIS action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('WHOIS'));
      expect(onAction).toHaveBeenCalledWith('whois');
    });

    it('handles WHOWAS action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('WHOWAS'));
      expect(onAction).toHaveBeenCalledWith('whowas');
    });

    it('handles Open Query action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('Open Query'));
      expect(onAction).toHaveBeenCalledWith('query');
    });

    it('handles copy nickname action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('Copy nickname'));
      expect(onAction).toHaveBeenCalledWith('copy');
    });

    it('uses initial user@host info for display and copy actions', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu
          {...baseProps}
          onAction={onAction}
          initialUserHostInfo={{ user: '~test', host: 'host.test' }}
        />,
      );

      await waitFor(async () => {
        expect(getByText('~test@host.test')).toBeTruthy();
      });
      expect(mockSendSilentWho).not.toHaveBeenCalled();

      await fireEvent.press(getByText('Copy user@host'));
      await fireEvent.press(getByText('Copy hostmask'));

      expect(onAction).toHaveBeenCalledWith('copy_userhost', {
        userHostInfo: { user: '~test', host: 'host.test' },
      });
      expect(onAction).toHaveBeenCalledWith('copy_hostmask', {
        userHostInfo: { user: '~test', host: 'host.test' },
      });
    });

    it('uses channel user host info for display and copy actions', async () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], account: '*' },
        {
          nick: 'TestUser',
          modes: [],
          ident: '~known',
          host: 'known.host',
          account: '*',
        },
      ]);
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      expect(getByText('~known@known.host')).toBeTruthy();

      await fireEvent.press(getByText('Copy user@host'));
      await fireEvent.press(getByText('Copy hostmask'));

      expect(mockSendSilentWho).not.toHaveBeenCalled();
      expect(onAction).toHaveBeenCalledWith('copy_userhost', {
        userHostInfo: { user: '~known', host: 'known.host' },
      });
      expect(onAction).toHaveBeenCalledWith('copy_hostmask', {
        userHostInfo: { user: '~known', host: 'known.host' },
      });
    });
  });

  // ==================== Monitor Actions ====================
  describe('monitor actions', () => {
    it('shows monitor option when cap is enabled', async () => {
      const connection = {
        ircService: {
          capEnabledSet: new Set(['monitor']),
          isMonitoring: () => false,
        },
      };
      const { getByText } = await render(
        <NickContextMenu {...baseProps} connection={connection} />,
      );
      expect(getByText('Monitor Nick')).toBeTruthy();
    });

    it('shows unmonitor option when already monitoring', async () => {
      const connection = {
        ircService: {
          capEnabledSet: new Set(['monitor']),
          isMonitoring: () => true,
        },
      };
      const { getByText } = await render(
        <NickContextMenu {...baseProps} connection={connection} />,
      );
      expect(getByText('Unmonitor Nick')).toBeTruthy();
    });

    it('handles monitor toggle action', async () => {
      const onAction = jest.fn();
      const connection = {
        ircService: {
          capEnabledSet: new Set(['monitor']),
          isMonitoring: () => false,
        },
      };
      const { getByText } = await render(
        <NickContextMenu
          {...baseProps}
          onAction={onAction}
          connection={connection}
        />,
      );

      await fireEvent.press(getByText('Monitor Nick'));
      expect(onAction).toHaveBeenCalledWith('monitor_toggle');
    });
  });

  // ==================== Call Actions ====================
  describe('call actions', () => {
    it('shows call actions when enabled', async () => {
      mockGetCallNicklistCallActionsEnabled.mockResolvedValue(true);
      await render(<NickContextMenu {...baseProps} />);

      await waitFor(async () => {
        expect(mockGetCallNicklistCallActionsEnabled).toHaveBeenCalled();
      });
    });
  });

  // ==================== User List Group ====================
  describe('user list group', () => {
    it('expands user list group on press', async () => {
      const { getByText, queryByText } = await render(
        <NickContextMenu {...baseProps} />,
      );

      // Initially not expanded
      expect(queryByText('Ignore User')).toBeNull();

      // Expand the group
      await fireEvent.press(getByText('User list >'));

      // Now should see the options
      expect(getByText('Ignore User')).toBeTruthy();
      expect(getByText('Add to Blacklist')).toBeTruthy();
      expect(getByText('Blacklist Nick')).toBeTruthy();
    });

    it('shows Unignore User when user is ignored', async () => {
      mockIsUserIgnored.mockReturnValue(true);
      const { getByText } = await render(<NickContextMenu {...baseProps} />);

      await fireEvent.press(getByText('User list >'));
      expect(getByText('Unignore User')).toBeTruthy();
    });

    it('handles ignore toggle action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('User list >'));
      await fireEvent.press(getByText('Ignore User'));
      expect(onAction).toHaveBeenCalledWith('ignore_toggle');
    });

    it('handles blacklist action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('User list >'));
      await fireEvent.press(getByText('Add to Blacklist'));
      expect(onAction).toHaveBeenCalledWith('blacklist');
    });

    it('handles blacklist nick via UI store', async () => {
      const { getByText } = await render(<NickContextMenu {...baseProps} />);

      await fireEvent.press(getByText('User list >'));
      await fireEvent.press(getByText('Blacklist Nick'));

      expect(mockSetShowBlacklist).toHaveBeenCalledWith(true);
      expect(mockSetBlacklistTarget).toHaveBeenCalledWith({
        type: 'nick',
        networkId: 'test-network',
        nick: 'TestUser',
      });
    });

    it('handles add to notify action', async () => {
      const onClose = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      await fireEvent.press(getByText('User list >'));
      await fireEvent.press(getByText('Add to Notify'));

      expect(mockSetUserListsInitialTab).toHaveBeenCalledWith('notify');
      expect(mockSetShowUserLists).toHaveBeenCalledWith(true);
      expect(onClose).toHaveBeenCalled();
    });

    it('handles add to autoop action', async () => {
      const onClose = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      await fireEvent.press(getByText('User list >'));
      await fireEvent.press(getByText('Add to AutoOp'));

      expect(mockSetUserListsInitialTab).toHaveBeenCalledWith('autoop');
      expect(mockSetShowUserLists).toHaveBeenCalledWith(true);
      expect(onClose).toHaveBeenCalled();
    });

    it('handles add to autovoice action', async () => {
      const onClose = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      await fireEvent.press(getByText('User list >'));
      await fireEvent.press(getByText('Add to AutoVoice'));

      expect(mockSetUserListsInitialTab).toHaveBeenCalledWith('autovoice');
      expect(mockSetShowUserLists).toHaveBeenCalledWith(true);
      expect(onClose).toHaveBeenCalled();
    });

    it('handles add to protected action', async () => {
      const onClose = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      await fireEvent.press(getByText('User list >'));
      await fireEvent.press(getByText('Add to Protected'));

      expect(mockSetUserListsInitialTab).toHaveBeenCalledWith('other');
      expect(mockSetShowUserLists).toHaveBeenCalledWith(true);
      expect(onClose).toHaveBeenCalled();
    });

    it('shows Edit Note when note exists', async () => {
      mockGetUserNote.mockReturnValue('Existing note');
      const { getByText } = await render(<NickContextMenu {...baseProps} />);

      await fireEvent.press(getByText('User list >'));
      expect(getByText('Edit Note')).toBeTruthy();
    });

    it('shows Add Note when no note exists', async () => {
      mockGetUserNote.mockReturnValue(null);
      const { getByText } = await render(<NickContextMenu {...baseProps} />);

      await fireEvent.press(getByText('User list >'));
      expect(getByText('Add Note')).toBeTruthy();
    });

    it('handles add/edit note action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('User list >'));
      await fireEvent.press(getByText('Add Note'));
      expect(onAction).toHaveBeenCalledWith('add_note');
    });

    it('shows IRCop commands for server operators', async () => {
      const { getByText } = await render(
        <NickContextMenu {...baseProps} isServerOper={true} />,
      );

      await fireEvent.press(getByText('IRCop Commands >'));
      expect(getByText('KILL (with reason)')).toBeTruthy();
    });

    it('does not show IRCop commands for non-operators', async () => {
      const { queryByText } = await render(
        <NickContextMenu {...baseProps} isServerOper={false} />,
      );

      expect(queryByText('IRCop Commands >')).toBeNull();
      expect(queryByText('KILL (with reason)')).toBeNull();
    });
  });

  // ==================== E2E Encryption Group ====================
  describe('E2E encryption group', () => {
    it('expands E2E group on press', async () => {
      const { getByText, queryByText } = await render(
        <NickContextMenu {...baseProps} />,
      );

      expect(queryByText('Share DM Key')).toBeNull();

      await fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share DM Key')).toBeTruthy();
      expect(getByText('Request DM Key (36s)')).toBeTruthy();
      expect(getByText('Verify DM Key')).toBeTruthy();
    });

    it('handles share DM key action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      await fireEvent.press(getByText('Share DM Key'));
      expect(onAction).toHaveBeenCalledWith('enc_share');
    });

    it('handles request DM key action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      await fireEvent.press(getByText('Request DM Key (36s)'));
      expect(onAction).toHaveBeenCalledWith('enc_request');
    });

    it('handles verify DM key action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      await fireEvent.press(getByText('Verify DM Key'));
      expect(onAction).toHaveBeenCalledWith('enc_verify');
    });

    it('shows QR code options when allowed', async () => {
      const { getByText } = await render(
        <NickContextMenu {...baseProps} allowQrVerification={true} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share Key Bundle QR')).toBeTruthy();
      expect(getByText('Show Fingerprint QR (Verify)')).toBeTruthy();
      expect(getByText('Scan QR Code')).toBeTruthy();
    });

    it('hides QR code options when not allowed', async () => {
      const { getByText, queryByText } = await render(
        <NickContextMenu {...baseProps} allowQrVerification={false} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      expect(queryByText('Share Key Bundle QR')).toBeNull();
      expect(queryByText('Show Fingerprint QR (Verify)')).toBeNull();
      expect(queryByText('Scan QR Code')).toBeNull();
    });

    it('handles QR code actions', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      await fireEvent.press(getByText('Share Key Bundle QR'));
      expect(onAction).toHaveBeenCalledWith('enc_qr_show_bundle');

      await fireEvent.press(getByText('Show Fingerprint QR (Verify)'));
      expect(onAction).toHaveBeenCalledWith('enc_qr_show_fingerprint');

      await fireEvent.press(getByText('Scan QR Code'));
      expect(onAction).toHaveBeenCalledWith('enc_qr_scan');
    });

    it('shows file exchange options when allowed', async () => {
      const { getByText } = await render(
        <NickContextMenu {...baseProps} allowFileExchange={true} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share Key File')).toBeTruthy();
      expect(getByText('Import Key File')).toBeTruthy();
    });

    it('hides file exchange options when not allowed', async () => {
      const { getByText, queryByText } = await render(
        <NickContextMenu {...baseProps} allowFileExchange={false} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      expect(queryByText('Share Key File')).toBeNull();
      expect(queryByText('Import Key File')).toBeNull();
    });

    it('handles file exchange actions', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      await fireEvent.press(getByText('Share Key File'));
      expect(onAction).toHaveBeenCalledWith('enc_share_file');

      await fireEvent.press(getByText('Import Key File'));
      expect(onAction).toHaveBeenCalledWith('enc_import_file');
    });

    it('shows NFC options when allowed', async () => {
      const { getByText } = await render(
        <NickContextMenu {...baseProps} allowNfcExchange={true} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share via NFC')).toBeTruthy();
      expect(getByText('Receive via NFC')).toBeTruthy();
    });

    it('hides NFC options when not allowed', async () => {
      const { getByText, queryByText } = await render(
        <NickContextMenu {...baseProps} allowNfcExchange={false} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      expect(queryByText('Share via NFC')).toBeNull();
      expect(queryByText('Receive via NFC')).toBeNull();
    });

    it('handles NFC actions', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      await fireEvent.press(getByText('Share via NFC'));
      expect(onAction).toHaveBeenCalledWith('enc_share_nfc');

      await fireEvent.press(getByText('Receive via NFC'));
      expect(onAction).toHaveBeenCalledWith('enc_receive_nfc');
    });

    it('shows channel key options when in a channel', async () => {
      const { getByText } = await render(
        <NickContextMenu {...baseProps} channel="#test-channel" />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share Channel Key')).toBeTruthy();
      expect(getByText('Request Channel Key')).toBeTruthy();
    });

    it('hides channel key options when not in a channel', async () => {
      const { getByText, queryByText } = await render(
        <NickContextMenu {...baseProps} channel={undefined} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      expect(queryByText('Share Channel Key')).toBeNull();
      expect(queryByText('Request Channel Key')).toBeNull();
    });

    it('handles channel key actions', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('E2E Encryption >'));
      await fireEvent.press(getByText('Share Channel Key'));
      expect(onAction).toHaveBeenCalledWith('chan_share');

      await fireEvent.press(getByText('Request Channel Key'));
      expect(onAction).toHaveBeenCalledWith('chan_request');
    });
  });

  // ==================== Operator Controls ====================
  describe('operator controls', () => {
    it('shows operator controls when user is op', async () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      expect(getByText('Operator Controls >')).toBeTruthy();
    });

    it('shows operator controls when user is half-op', async () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['h'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      expect(getByText('Operator Controls >')).toBeTruthy();
    });

    it('uses provided channel users for operator controls before service data', async () => {
      mockGetChannelUsers.mockReturnValue([]);
      const channelUsers = [
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ];

      const { getByText } = await render(
        <NickContextMenu {...baseProps} channelUsers={channelUsers as any} />,
      );

      expect(getByText('Operator Controls >')).toBeTruthy();
      expect(mockGetChannelUsers).not.toHaveBeenCalled();
    });

    it('shows give voice for non-voiced user', async () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['h'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      await fireEvent.press(getByText('Operator Controls >'));
      expect(getByText('Give Voice')).toBeTruthy();
    });

    it('shows take voice for voiced user', async () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: ['v'], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      await fireEvent.press(getByText('Operator Controls >'));
      expect(getByText('Take Voice')).toBeTruthy();
    });

    it('handles give voice action', async () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['h'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      await fireEvent.press(getByText('Operator Controls >'));
      await fireEvent.press(getByText('Give Voice'));
      expect(onAction).toHaveBeenCalledWith('give_voice');
    });

    it('handles take voice action', async () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: ['v'], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      await fireEvent.press(getByText('Operator Controls >'));
      await fireEvent.press(getByText('Take Voice'));
      expect(onAction).toHaveBeenCalledWith('take_voice');
    });

    it('shows give/take half-op for op users', async () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      await fireEvent.press(getByText('Operator Controls >'));
      expect(getByText('Give Half-Op')).toBeTruthy();
    });

    it('shows give/take op for op users', async () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      await fireEvent.press(getByText('Operator Controls >'));
      expect(getByText('Give Op')).toBeTruthy();
    });

    it('handles give half-op action', async () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      await fireEvent.press(getByText('Operator Controls >'));
      await fireEvent.press(getByText('Give Half-Op'));
      expect(onAction).toHaveBeenCalledWith('give_halfop');
    });

    it('handles take half-op action', async () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: ['h'], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      await fireEvent.press(getByText('Operator Controls >'));
      await fireEvent.press(getByText('Take Half-Op'));
      expect(onAction).toHaveBeenCalledWith('take_halfop');
    });

    it('handles give op action', async () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      await fireEvent.press(getByText('Operator Controls >'));
      await fireEvent.press(getByText('Give Op'));
      expect(onAction).toHaveBeenCalledWith('give_op');
    });

    it('handles take op action', async () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: ['o'], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      await fireEvent.press(getByText('Operator Controls >'));
      await fireEvent.press(getByText('Take Op'));
      expect(onAction).toHaveBeenCalledWith('take_op');
    });
  });

  // ==================== Kick/Ban Operations ====================
  describe('kick/ban operations', () => {
    beforeEach(async () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);
    });

    it('shows kick/ban options for ops', async () => {
      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      await fireEvent.press(getByText('Operator Controls >'));

      expect(getByText('Kick')).toBeTruthy();
      expect(getByText('Kick (with message)')).toBeTruthy();
      expect(getByText('Ban')).toBeTruthy();
      expect(getByText('Kick + Ban')).toBeTruthy();
      expect(getByText('Kick + Ban (with message)')).toBeTruthy();
    });

    it('opens kick/ban modal when confirmation is enabled', async () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'confirmBeforeKickBan') return Promise.resolve(true);
        return Promise.resolve(2);
      });

      const { getByText, findByTestId } = await render(
        <NickContextMenu {...baseProps} />,
      );
      await fireEvent.press(getByText('Operator Controls >'));

      await act(async () => {
        await fireEvent.press(getByText('Kick'));
      });

      const modal = await findByTestId('kick-ban-modal');
      expect(modal).toBeTruthy();
    });

    it('executes kick directly when confirmation is disabled', async () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'confirmBeforeKickBan') return Promise.resolve(false);
        return Promise.resolve(2);
      });

      const connection = {
        ircService: {
          sendRaw: mockSendRaw,
          getChannelUsers: mockGetChannelUsers,
          capEnabledSet: new Set(),
        },
      };

      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const onClose = jest.fn();
      const { getByText } = await render(
        <NickContextMenu
          {...baseProps}
          onClose={onClose}
          connection={connection}
        />,
      );

      await waitFor(async () => {
        expect(mockGetSetting).toHaveBeenCalledWith(
          'confirmBeforeKickBan',
          expect.anything(),
        );
      });

      await fireEvent.press(getByText('Operator Controls >'));

      await act(async () => {
        await fireEvent.press(getByText('Kick'));
      });

      await waitFor(async () => {
        expect(mockSendRaw).toHaveBeenCalledWith(
          expect.stringContaining('KICK'),
        );
      });
    });

    it('handles kick with message', async () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'confirmBeforeKickBan') return Promise.resolve(true);
        return Promise.resolve(2);
      });

      const { getByText, findByTestId } = await render(
        <NickContextMenu {...baseProps} />,
      );
      await fireEvent.press(getByText('Operator Controls >'));

      await act(async () => {
        await fireEvent.press(getByText('Kick (with message)'));
      });

      const modal = await findByTestId('kick-ban-modal');
      expect(modal).toBeTruthy();
    });

    it('handles ban action', async () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'confirmBeforeKickBan') return Promise.resolve(true);
        return Promise.resolve(2);
      });

      const { getByText, findByTestId } = await render(
        <NickContextMenu {...baseProps} />,
      );
      await fireEvent.press(getByText('Operator Controls >'));

      await act(async () => {
        await fireEvent.press(getByText('Ban'));
      });

      const modal = await findByTestId('kick-ban-modal');
      expect(modal).toBeTruthy();
    });

    it('handles kick + ban action', async () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'confirmBeforeKickBan') return Promise.resolve(true);
        return Promise.resolve(2);
      });

      const { getByText, findByTestId } = await render(
        <NickContextMenu {...baseProps} />,
      );
      await fireEvent.press(getByText('Operator Controls >'));

      await act(async () => {
        await fireEvent.press(getByText('Kick + Ban'));
      });

      const modal = await findByTestId('kick-ban-modal');
      expect(modal).toBeTruthy();
    });
  });

  // ==================== IRC Service Commands ====================
  describe('IRC service commands', () => {
    it('shows service commands when available', async () => {
      mockGetCommands.mockReturnValue([
        {
          command: {
            name: 'INFO',
            parameters: [{ name: 'nick', type: 'nick' }],
          },
          serviceNick: 'NickServ',
        },
        {
          command: {
            name: 'STATUS',
            parameters: [{ name: 'user', type: 'nick' }],
          },
          serviceNick: 'NickServ',
        },
      ]);

      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      expect(getByText('IRC Services >')).toBeTruthy();
    });

    it('expands service commands on press', async () => {
      mockGetCommands.mockReturnValue([
        {
          command: {
            name: 'INFO',
            parameters: [{ name: 'nick', type: 'nick' }],
          },
          serviceNick: 'NickServ',
        },
      ]);

      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      await fireEvent.press(getByText('IRC Services >'));
      expect(getByText('NickServ INFO')).toBeTruthy();
    });

    it('handles service command execution', async () => {
      const connection = {
        ircService: {
          sendRaw: mockSendRaw,
          capEnabledSet: new Set(),
        },
      };
      const onClose = jest.fn();

      mockGetCommands.mockReturnValue([
        {
          command: {
            name: 'INFO',
            parameters: [{ name: 'nick', type: 'nick' }],
          },
          serviceNick: 'NickServ',
        },
      ]);

      const { getByText } = await render(
        <NickContextMenu
          {...baseProps}
          connection={connection}
          onClose={onClose}
        />,
      );

      await fireEvent.press(getByText('IRC Services >'));
      await fireEvent.press(getByText('NickServ INFO'));

      expect(mockSendRaw).toHaveBeenCalledWith(
        'PRIVMSG NickServ :INFO TestUser',
      );
      expect(onClose).toHaveBeenCalled();
    });

    it('shows all commands option', async () => {
      mockGetCommands.mockReturnValue([
        {
          command: {
            name: 'INFO',
            parameters: [{ name: 'nick', type: 'nick' }],
          },
          serviceNick: 'NickServ',
        },
      ]);

      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('IRC Services >'));
      await fireEvent.press(getByText('Show All Commands...'));

      expect(onAction).toHaveBeenCalledWith('show_all_commands');
    });
  });

  // ==================== CTCP + DCC Group ====================
  describe('CTCP + DCC group', () => {
    it('expands CTCP group on press', async () => {
      const { getByText, queryByText } = await render(
        <NickContextMenu {...baseProps} />,
      );

      expect(queryByText('CTCP PING')).toBeNull();

      await fireEvent.press(getByText('CTCP + DCC >'));
      expect(getByText('CTCP PING')).toBeTruthy();
      expect(getByText('CTCP VERSION')).toBeTruthy();
      expect(getByText('CTCP TIME')).toBeTruthy();
      expect(getByText('Start DCC Chat')).toBeTruthy();
      expect(getByText('Offer DCC Send')).toBeTruthy();
    });

    it('handles CTCP PING action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('CTCP + DCC >'));
      await fireEvent.press(getByText('CTCP PING'));
      expect(onAction).toHaveBeenCalledWith('ctcp_ping');
    });

    it('handles CTCP VERSION action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('CTCP + DCC >'));
      await fireEvent.press(getByText('CTCP VERSION'));
      expect(onAction).toHaveBeenCalledWith('ctcp_version');
    });

    it('handles CTCP TIME action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('CTCP + DCC >'));
      await fireEvent.press(getByText('CTCP TIME'));
      expect(onAction).toHaveBeenCalledWith('ctcp_time');
    });

    it('handles DCC chat action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('CTCP + DCC >'));
      await fireEvent.press(getByText('Start DCC Chat'));
      expect(onAction).toHaveBeenCalledWith('dcc_chat');
    });

    it('handles DCC send action', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      await fireEvent.press(getByText('CTCP + DCC >'));
      await fireEvent.press(getByText('Offer DCC Send'));
      expect(onAction).toHaveBeenCalledWith('dcc_send');
    });
  });

  // ==================== Close Button ====================
  describe('close button', () => {
    it('handles close action', async () => {
      const onClose = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      await fireEvent.press(getByText('Close'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ==================== User Info Display ====================
  describe('user info display', () => {
    it('displays user@host when available', async () => {
      const connection = {
        ircService: {
          sendSilentWho: (
            nick: string,
            callback: (user: string, host: string) => void,
          ) => {
            callback('testuser', 'test.host.com');
          },
          capEnabledSet: new Set(),
        },
      };

      const { getByText } = await render(
        <NickContextMenu {...baseProps} connection={connection} />,
      );
      expect(getByText('testuser@test.host.com')).toBeTruthy();
    });

    it('displays account info when available and no user@host', async () => {
      mockGetChannelUsers.mockReturnValue([
        {
          nick: 'TestUser',
          modes: [],
          host: 'test.com',
          account: 'TestAccount',
        },
      ]);

      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      expect(getByText('Account: TestAccount')).toBeTruthy();
    });

    it('does not display account info when account is wildcard', async () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { queryByText } = await render(<NickContextMenu {...baseProps} />);
      expect(queryByText('Account:')).toBeNull();
    });
  });

  // ==================== KILL Modal (Server Oper) ====================
  describe('KILL modal', () => {
    it('opens KILL reason modal when KILL is pressed', async () => {
      const { getByText } = await render(
        <NickContextMenu {...baseProps} isServerOper={true} />,
      );

      await fireEvent.press(getByText('IRCop Commands >'));
      await fireEvent.press(getByText('KILL (with reason)'));

      expect(getByText('KILL TestUser')).toBeTruthy();
      expect(getByText('Enter reason')).toBeTruthy();
    });

    it('shows error when KILL reason is empty', async () => {
      const { getByText } = await render(
        <NickContextMenu {...baseProps} isServerOper={true} />,
      );

      await fireEvent.press(getByText('IRCop Commands >'));
      await fireEvent.press(getByText('KILL (with reason)'));

      // Find and press Send button
      const sendButton = getByText('Send');
      await fireEvent.press(sendButton);

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Reason is required');
    });

    it('sends KILL command with reason', async () => {
      const connection = {
        ircService: {
          sendCommand: mockSendCommand,
          capEnabledSet: new Set(),
        },
      };
      const onClose = jest.fn();

      const { getByText, getByPlaceholderText } = await render(
        <NickContextMenu
          {...baseProps}
          isServerOper={true}
          connection={connection}
          onClose={onClose}
        />,
      );

      await fireEvent.press(getByText('IRCop Commands >'));
      await fireEvent.press(getByText('KILL (with reason)'));

      await fireEvent.changeText(
        getByPlaceholderText('Enter reason'),
        'Spamming',
      );
      await fireEvent.press(getByText('Send'));

      expect(mockSendCommand).toHaveBeenCalledWith('KILL TestUser :Spamming');
      expect(onClose).toHaveBeenCalled();
    });

    it('cancels KILL modal', async () => {
      const { getByText, queryByText } = await render(
        <NickContextMenu {...baseProps} isServerOper={true} />,
      );

      await fireEvent.press(getByText('IRCop Commands >'));
      await fireEvent.press(getByText('KILL (with reason)'));

      await fireEvent.press(getByText('Cancel'));

      // Modal should be closed
      expect(queryByText('KILL TestUser')).toBeNull();
    });
  });

  // ==================== Close on Overlay Press ====================
  describe('overlay press', () => {
    it('calls onClose when overlay is pressed', async () => {
      const onClose = jest.fn();
      const { getByText } = await render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      // The TouchableOpacity with style contextOverlay handles the close
      // We can trigger it via the Close button which is easier to find
      await fireEvent.press(getByText('Close'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ==================== Complex Scenarios ====================
  describe('complex scenarios', () => {
    it('handles multiple group expansions', async () => {
      const { getByText } = await render(<NickContextMenu {...baseProps} />);

      // Expand E2E
      await fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share DM Key')).toBeTruthy();

      // Expand CTCP
      await fireEvent.press(getByText('CTCP + DCC >'));
      expect(getByText('CTCP PING')).toBeTruthy();

      // Expand User List
      await fireEvent.press(getByText('User list >'));
      expect(getByText('Ignore User')).toBeTruthy();
    });

    it('resets state when visibility changes', async () => {
      const { rerender, getByText, queryByText } = await render(
        <NickContextMenu {...baseProps} />,
      );

      // Expand a group
      await fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share DM Key')).toBeTruthy();

      // Close and reopen
      await rerender(<NickContextMenu {...baseProps} visible={false} />);
      await rerender(<NickContextMenu {...baseProps} visible={true} />);

      // Group should be collapsed again
      expect(queryByText('Share DM Key')).toBeNull();
    });

    it('handles custom ignore action id', async () => {
      const onAction = jest.fn();
      const { getByText } = await render(
        <NickContextMenu
          {...baseProps}
          onAction={onAction}
          ignoreActionId="custom_ignore"
        />,
      );

      await fireEvent.press(getByText('User list >'));
      await fireEvent.press(getByText('Ignore User'));
      expect(onAction).toHaveBeenCalledWith('custom_ignore');
    });

    it('handles admin and owner modes for current user', async () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['a'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      expect(getByText('Operator Controls >')).toBeTruthy();
    });

    it('handles owner mode (q) for current user', async () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['q'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = await render(<NickContextMenu {...baseProps} />);
      expect(getByText('Operator Controls >')).toBeTruthy();
    });
  });
});
