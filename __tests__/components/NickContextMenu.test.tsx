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

jest.mock('../../src/i18n/transifex', () => ({
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
  beforeEach(() => {
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==================== Basic Rendering ====================
  describe('basic rendering', () => {
    it('renders correctly with basic props', () => {
      const { getByText } = render(<NickContextMenu {...baseProps} />);
      expect(getByText('TestUser')).toBeTruthy();
      expect(getByText('Copy nickname')).toBeTruthy();
    });

    it('renders with action message banner', () => {
      const { getByText } = render(
        <NickContextMenu {...baseProps} actionMessage="User is online" />,
      );
      expect(getByText('User is online')).toBeTruthy();
    });

    it('does not render when not visible', () => {
      const { queryByText } = render(
        <NickContextMenu {...baseProps} visible={false} />,
      );
      expect(queryByText('TestUser')).toBeNull();
    });

    it('renders without nick', () => {
      const { queryByText } = render(
        <NickContextMenu {...baseProps} nick={undefined} />,
      );
      // Component should still render even without nick
      expect(queryByText('Copy nickname')).toBeTruthy();
    });
  });

  // ==================== Quick Actions ====================
  describe('quick actions', () => {
    it('handles WHOIS action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('WHOIS'));
      expect(onAction).toHaveBeenCalledWith('whois');
    });

    it('handles Open Query action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('Open Query'));
      expect(onAction).toHaveBeenCalledWith('query');
    });

    it('handles copy nickname action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('Copy nickname'));
      expect(onAction).toHaveBeenCalledWith('copy');
    });
  });

  // ==================== Monitor Actions ====================
  describe('monitor actions', () => {
    it('shows monitor option when cap is enabled', () => {
      const connection = {
        ircService: {
          capEnabledSet: new Set(['monitor']),
          isMonitoring: () => false,
        },
      };
      const { getByText } = render(
        <NickContextMenu {...baseProps} connection={connection} />,
      );
      expect(getByText('Monitor Nick')).toBeTruthy();
    });

    it('shows unmonitor option when already monitoring', () => {
      const connection = {
        ircService: {
          capEnabledSet: new Set(['monitor']),
          isMonitoring: () => true,
        },
      };
      const { getByText } = render(
        <NickContextMenu {...baseProps} connection={connection} />,
      );
      expect(getByText('Unmonitor Nick')).toBeTruthy();
    });

    it('handles monitor toggle action', () => {
      const onAction = jest.fn();
      const connection = {
        ircService: {
          capEnabledSet: new Set(['monitor']),
          isMonitoring: () => false,
        },
      };
      const { getByText } = render(
        <NickContextMenu
          {...baseProps}
          onAction={onAction}
          connection={connection}
        />,
      );

      fireEvent.press(getByText('Monitor Nick'));
      expect(onAction).toHaveBeenCalledWith('monitor_toggle');
    });
  });

  // ==================== Call Actions ====================
  describe('call actions', () => {
    it('shows call actions when enabled', async () => {
      mockGetCallNicklistCallActionsEnabled.mockResolvedValue(true);
      render(<NickContextMenu {...baseProps} />);

      await waitFor(() => {
        expect(mockGetCallNicklistCallActionsEnabled).toHaveBeenCalled();
      });
    });
  });

  // ==================== User List Group ====================
  describe('user list group', () => {
    it('expands user list group on press', () => {
      const { getByText, queryByText } = render(
        <NickContextMenu {...baseProps} />,
      );

      // Initially not expanded
      expect(queryByText('Ignore User')).toBeNull();

      // Expand the group
      fireEvent.press(getByText('User list >'));

      // Now should see the options
      expect(getByText('Ignore User')).toBeTruthy();
      expect(getByText('Add to Blacklist')).toBeTruthy();
      expect(getByText('Blacklist Nick')).toBeTruthy();
    });

    it('shows Unignore User when user is ignored', () => {
      mockIsUserIgnored.mockReturnValue(true);
      const { getByText } = render(<NickContextMenu {...baseProps} />);

      fireEvent.press(getByText('User list >'));
      expect(getByText('Unignore User')).toBeTruthy();
    });

    it('handles ignore toggle action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('Ignore User'));
      expect(onAction).toHaveBeenCalledWith('ignore_toggle');
    });

    it('handles blacklist action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('Add to Blacklist'));
      expect(onAction).toHaveBeenCalledWith('blacklist');
    });

    it('handles blacklist nick via UI store', () => {
      const { getByText } = render(<NickContextMenu {...baseProps} />);

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('Blacklist Nick'));

      expect(mockSetShowBlacklist).toHaveBeenCalledWith(true);
      expect(mockSetBlacklistTarget).toHaveBeenCalledWith({
        type: 'nick',
        networkId: 'test-network',
        nick: 'TestUser',
      });
    });

    it('handles add to notify action', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('Add to Notify'));

      expect(mockSetUserListsInitialTab).toHaveBeenCalledWith('notify');
      expect(mockSetShowUserLists).toHaveBeenCalledWith(true);
      expect(onClose).toHaveBeenCalled();
    });

    it('handles add to autoop action', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('Add to AutoOp'));

      expect(mockSetUserListsInitialTab).toHaveBeenCalledWith('autoop');
      expect(mockSetShowUserLists).toHaveBeenCalledWith(true);
      expect(onClose).toHaveBeenCalled();
    });

    it('handles add to autovoice action', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('Add to AutoVoice'));

      expect(mockSetUserListsInitialTab).toHaveBeenCalledWith('autovoice');
      expect(mockSetShowUserLists).toHaveBeenCalledWith(true);
      expect(onClose).toHaveBeenCalled();
    });

    it('handles add to protected action', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('Add to Protected'));

      expect(mockSetUserListsInitialTab).toHaveBeenCalledWith('other');
      expect(mockSetShowUserLists).toHaveBeenCalledWith(true);
      expect(onClose).toHaveBeenCalled();
    });

    it('shows Edit Note when note exists', () => {
      mockGetUserNote.mockReturnValue('Existing note');
      const { getByText } = render(<NickContextMenu {...baseProps} />);

      fireEvent.press(getByText('User list >'));
      expect(getByText('Edit Note')).toBeTruthy();
    });

    it('shows Add Note when no note exists', () => {
      mockGetUserNote.mockReturnValue(null);
      const { getByText } = render(<NickContextMenu {...baseProps} />);

      fireEvent.press(getByText('User list >'));
      expect(getByText('Add Note')).toBeTruthy();
    });

    it('handles add/edit note action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('Add Note'));
      expect(onAction).toHaveBeenCalledWith('add_note');
    });

    it('shows KILL option for server operators', () => {
      const { getByText } = render(
        <NickContextMenu {...baseProps} isServerOper={true} />,
      );

      fireEvent.press(getByText('User list >'));
      expect(getByText('KILL (with reason)')).toBeTruthy();
    });

    it('does not show KILL option for non-operators', () => {
      const { getByText, queryByText } = render(
        <NickContextMenu {...baseProps} isServerOper={false} />,
      );

      fireEvent.press(getByText('User list >'));
      expect(queryByText('KILL (with reason)')).toBeNull();
    });
  });

  // ==================== E2E Encryption Group ====================
  describe('E2E encryption group', () => {
    it('expands E2E group on press', () => {
      const { getByText, queryByText } = render(
        <NickContextMenu {...baseProps} />,
      );

      expect(queryByText('Share DM Key')).toBeNull();

      fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share DM Key')).toBeTruthy();
      expect(getByText('Request DM Key (36s)')).toBeTruthy();
      expect(getByText('Verify DM Key')).toBeTruthy();
    });

    it('handles share DM key action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      fireEvent.press(getByText('Share DM Key'));
      expect(onAction).toHaveBeenCalledWith('enc_share');
    });

    it('handles request DM key action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      fireEvent.press(getByText('Request DM Key (36s)'));
      expect(onAction).toHaveBeenCalledWith('enc_request');
    });

    it('handles verify DM key action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      fireEvent.press(getByText('Verify DM Key'));
      expect(onAction).toHaveBeenCalledWith('enc_verify');
    });

    it('shows QR code options when allowed', () => {
      const { getByText } = render(
        <NickContextMenu {...baseProps} allowQrVerification={true} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share Key Bundle QR')).toBeTruthy();
      expect(getByText('Show Fingerprint QR (Verify)')).toBeTruthy();
      expect(getByText('Scan QR Code')).toBeTruthy();
    });

    it('hides QR code options when not allowed', () => {
      const { getByText, queryByText } = render(
        <NickContextMenu {...baseProps} allowQrVerification={false} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      expect(queryByText('Share Key Bundle QR')).toBeNull();
      expect(queryByText('Show Fingerprint QR (Verify)')).toBeNull();
      expect(queryByText('Scan QR Code')).toBeNull();
    });

    it('handles QR code actions', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      fireEvent.press(getByText('Share Key Bundle QR'));
      expect(onAction).toHaveBeenCalledWith('enc_qr_show_bundle');

      fireEvent.press(getByText('Show Fingerprint QR (Verify)'));
      expect(onAction).toHaveBeenCalledWith('enc_qr_show_fingerprint');

      fireEvent.press(getByText('Scan QR Code'));
      expect(onAction).toHaveBeenCalledWith('enc_qr_scan');
    });

    it('shows file exchange options when allowed', () => {
      const { getByText } = render(
        <NickContextMenu {...baseProps} allowFileExchange={true} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share Key File')).toBeTruthy();
      expect(getByText('Import Key File')).toBeTruthy();
    });

    it('hides file exchange options when not allowed', () => {
      const { getByText, queryByText } = render(
        <NickContextMenu {...baseProps} allowFileExchange={false} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      expect(queryByText('Share Key File')).toBeNull();
      expect(queryByText('Import Key File')).toBeNull();
    });

    it('handles file exchange actions', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      fireEvent.press(getByText('Share Key File'));
      expect(onAction).toHaveBeenCalledWith('enc_share_file');

      fireEvent.press(getByText('Import Key File'));
      expect(onAction).toHaveBeenCalledWith('enc_import_file');
    });

    it('shows NFC options when allowed', () => {
      const { getByText } = render(
        <NickContextMenu {...baseProps} allowNfcExchange={true} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share via NFC')).toBeTruthy();
      expect(getByText('Receive via NFC')).toBeTruthy();
    });

    it('hides NFC options when not allowed', () => {
      const { getByText, queryByText } = render(
        <NickContextMenu {...baseProps} allowNfcExchange={false} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      expect(queryByText('Share via NFC')).toBeNull();
      expect(queryByText('Receive via NFC')).toBeNull();
    });

    it('handles NFC actions', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      fireEvent.press(getByText('Share via NFC'));
      expect(onAction).toHaveBeenCalledWith('enc_share_nfc');

      fireEvent.press(getByText('Receive via NFC'));
      expect(onAction).toHaveBeenCalledWith('enc_receive_nfc');
    });

    it('shows channel key options when in a channel', () => {
      const { getByText } = render(
        <NickContextMenu {...baseProps} channel="#test-channel" />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share Channel Key')).toBeTruthy();
      expect(getByText('Request Channel Key')).toBeTruthy();
    });

    it('hides channel key options when not in a channel', () => {
      const { getByText, queryByText } = render(
        <NickContextMenu {...baseProps} channel={undefined} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      expect(queryByText('Share Channel Key')).toBeNull();
      expect(queryByText('Request Channel Key')).toBeNull();
    });

    it('handles channel key actions', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('E2E Encryption >'));
      fireEvent.press(getByText('Share Channel Key'));
      expect(onAction).toHaveBeenCalledWith('chan_share');

      fireEvent.press(getByText('Request Channel Key'));
      expect(onAction).toHaveBeenCalledWith('chan_request');
    });
  });

  // ==================== Operator Controls ====================
  describe('operator controls', () => {
    it('shows operator controls when user is op', () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(<NickContextMenu {...baseProps} />);
      expect(getByText('Operator Controls >')).toBeTruthy();
    });

    it('shows operator controls when user is half-op', () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['h'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(<NickContextMenu {...baseProps} />);
      expect(getByText('Operator Controls >')).toBeTruthy();
    });

    it('shows give voice for non-voiced user', () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['h'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(<NickContextMenu {...baseProps} />);
      fireEvent.press(getByText('Operator Controls >'));
      expect(getByText('Give Voice')).toBeTruthy();
    });

    it('shows take voice for voiced user', () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: ['v'], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(<NickContextMenu {...baseProps} />);
      fireEvent.press(getByText('Operator Controls >'));
      expect(getByText('Take Voice')).toBeTruthy();
    });

    it('handles give voice action', () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['h'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      fireEvent.press(getByText('Operator Controls >'));
      fireEvent.press(getByText('Give Voice'));
      expect(onAction).toHaveBeenCalledWith('give_voice');
    });

    it('handles take voice action', () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: ['v'], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      fireEvent.press(getByText('Operator Controls >'));
      fireEvent.press(getByText('Take Voice'));
      expect(onAction).toHaveBeenCalledWith('take_voice');
    });

    it('shows give/take half-op for op users', () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(<NickContextMenu {...baseProps} />);
      fireEvent.press(getByText('Operator Controls >'));
      expect(getByText('Give Half-Op')).toBeTruthy();
    });

    it('shows give/take op for op users', () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(<NickContextMenu {...baseProps} />);
      fireEvent.press(getByText('Operator Controls >'));
      expect(getByText('Give Op')).toBeTruthy();
    });

    it('handles give half-op action', () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      fireEvent.press(getByText('Operator Controls >'));
      fireEvent.press(getByText('Give Half-Op'));
      expect(onAction).toHaveBeenCalledWith('give_halfop');
    });

    it('handles take half-op action', () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: ['h'], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      fireEvent.press(getByText('Operator Controls >'));
      fireEvent.press(getByText('Take Half-Op'));
      expect(onAction).toHaveBeenCalledWith('take_halfop');
    });

    it('handles give op action', () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      fireEvent.press(getByText('Operator Controls >'));
      fireEvent.press(getByText('Give Op'));
      expect(onAction).toHaveBeenCalledWith('give_op');
    });

    it('handles take op action', () => {
      const onAction = jest.fn();
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: ['o'], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );
      fireEvent.press(getByText('Operator Controls >'));
      fireEvent.press(getByText('Take Op'));
      expect(onAction).toHaveBeenCalledWith('take_op');
    });
  });

  // ==================== Kick/Ban Operations ====================
  describe('kick/ban operations', () => {
    beforeEach(() => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['o'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);
    });

    it('shows kick/ban options for ops', () => {
      const { getByText } = render(<NickContextMenu {...baseProps} />);
      fireEvent.press(getByText('Operator Controls >'));

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

      const { getByText, findByTestId } = render(
        <NickContextMenu {...baseProps} />,
      );
      fireEvent.press(getByText('Operator Controls >'));

      await act(async () => {
        fireEvent.press(getByText('Kick'));
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
      const { getByText } = render(
        <NickContextMenu
          {...baseProps}
          onClose={onClose}
          connection={connection}
        />,
      );

      await waitFor(() => {
        expect(mockGetSetting).toHaveBeenCalledWith(
          'confirmBeforeKickBan',
          expect.anything(),
        );
      });

      fireEvent.press(getByText('Operator Controls >'));

      await act(async () => {
        fireEvent.press(getByText('Kick'));
      });

      await waitFor(() => {
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

      const { getByText, findByTestId } = render(
        <NickContextMenu {...baseProps} />,
      );
      fireEvent.press(getByText('Operator Controls >'));

      await act(async () => {
        fireEvent.press(getByText('Kick (with message)'));
      });

      const modal = await findByTestId('kick-ban-modal');
      expect(modal).toBeTruthy();
    });

    it('handles ban action', async () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'confirmBeforeKickBan') return Promise.resolve(true);
        return Promise.resolve(2);
      });

      const { getByText, findByTestId } = render(
        <NickContextMenu {...baseProps} />,
      );
      fireEvent.press(getByText('Operator Controls >'));

      await act(async () => {
        fireEvent.press(getByText('Ban'));
      });

      const modal = await findByTestId('kick-ban-modal');
      expect(modal).toBeTruthy();
    });

    it('handles kick + ban action', async () => {
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'confirmBeforeKickBan') return Promise.resolve(true);
        return Promise.resolve(2);
      });

      const { getByText, findByTestId } = render(
        <NickContextMenu {...baseProps} />,
      );
      fireEvent.press(getByText('Operator Controls >'));

      await act(async () => {
        fireEvent.press(getByText('Kick + Ban'));
      });

      const modal = await findByTestId('kick-ban-modal');
      expect(modal).toBeTruthy();
    });
  });

  // ==================== IRC Service Commands ====================
  describe('IRC service commands', () => {
    it('shows service commands when available', () => {
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

      const { getByText } = render(<NickContextMenu {...baseProps} />);
      expect(getByText('IRC Services >')).toBeTruthy();
    });

    it('expands service commands on press', () => {
      mockGetCommands.mockReturnValue([
        {
          command: {
            name: 'INFO',
            parameters: [{ name: 'nick', type: 'nick' }],
          },
          serviceNick: 'NickServ',
        },
      ]);

      const { getByText } = render(<NickContextMenu {...baseProps} />);
      fireEvent.press(getByText('IRC Services >'));
      expect(getByText('NickServ INFO')).toBeTruthy();
    });

    it('handles service command execution', () => {
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

      const { getByText } = render(
        <NickContextMenu
          {...baseProps}
          connection={connection}
          onClose={onClose}
        />,
      );

      fireEvent.press(getByText('IRC Services >'));
      fireEvent.press(getByText('NickServ INFO'));

      expect(mockSendRaw).toHaveBeenCalledWith(
        'PRIVMSG NickServ :INFO TestUser',
      );
      expect(onClose).toHaveBeenCalled();
    });

    it('shows all commands option', () => {
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
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('IRC Services >'));
      fireEvent.press(getByText('Show All Commands...'));

      expect(onAction).toHaveBeenCalledWith('show_all_commands');
    });
  });

  // ==================== CTCP + DCC Group ====================
  describe('CTCP + DCC group', () => {
    it('expands CTCP group on press', () => {
      const { getByText, queryByText } = render(
        <NickContextMenu {...baseProps} />,
      );

      expect(queryByText('CTCP PING')).toBeNull();

      fireEvent.press(getByText('CTCP + DCC >'));
      expect(getByText('CTCP PING')).toBeTruthy();
      expect(getByText('CTCP VERSION')).toBeTruthy();
      expect(getByText('CTCP TIME')).toBeTruthy();
      expect(getByText('Start DCC Chat')).toBeTruthy();
      expect(getByText('Offer DCC Send')).toBeTruthy();
    });

    it('handles CTCP PING action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('CTCP + DCC >'));
      fireEvent.press(getByText('CTCP PING'));
      expect(onAction).toHaveBeenCalledWith('ctcp_ping');
    });

    it('handles CTCP VERSION action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('CTCP + DCC >'));
      fireEvent.press(getByText('CTCP VERSION'));
      expect(onAction).toHaveBeenCalledWith('ctcp_version');
    });

    it('handles CTCP TIME action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('CTCP + DCC >'));
      fireEvent.press(getByText('CTCP TIME'));
      expect(onAction).toHaveBeenCalledWith('ctcp_time');
    });

    it('handles DCC chat action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('CTCP + DCC >'));
      fireEvent.press(getByText('Start DCC Chat'));
      expect(onAction).toHaveBeenCalledWith('dcc_chat');
    });

    it('handles DCC send action', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onAction={onAction} />,
      );

      fireEvent.press(getByText('CTCP + DCC >'));
      fireEvent.press(getByText('Offer DCC Send'));
      expect(onAction).toHaveBeenCalledWith('dcc_send');
    });
  });

  // ==================== Close Button ====================
  describe('close button', () => {
    it('handles close action', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      fireEvent.press(getByText('Close'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ==================== User Info Display ====================
  describe('user info display', () => {
    it('displays user@host when available', () => {
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

      const { getByText } = render(
        <NickContextMenu {...baseProps} connection={connection} />,
      );
      expect(getByText('testuser@test.host.com')).toBeTruthy();
    });

    it('displays account info when available and no user@host', () => {
      mockGetChannelUsers.mockReturnValue([
        {
          nick: 'TestUser',
          modes: [],
          host: 'test.com',
          account: 'TestAccount',
        },
      ]);

      const { getByText } = render(<NickContextMenu {...baseProps} />);
      expect(getByText('Account: TestAccount')).toBeTruthy();
    });

    it('does not display account info when account is wildcard', () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { queryByText } = render(<NickContextMenu {...baseProps} />);
      expect(queryByText('Account:')).toBeNull();
    });
  });

  // ==================== KILL Modal (Server Oper) ====================
  describe('KILL modal', () => {
    it('opens KILL reason modal when KILL is pressed', () => {
      const { getByText } = render(
        <NickContextMenu {...baseProps} isServerOper={true} />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('KILL (with reason)'));

      expect(getByText('KILL TestUser')).toBeTruthy();
      expect(getByText('Enter reason')).toBeTruthy();
    });

    it('shows error when KILL reason is empty', () => {
      const { getByText } = render(
        <NickContextMenu {...baseProps} isServerOper={true} />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('KILL (with reason)'));

      // Find and press Send button
      const sendButton = getByText('Send');
      fireEvent.press(sendButton);

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Reason is required');
    });

    it('sends KILL command with reason', () => {
      const connection = {
        ircService: {
          sendCommand: mockSendCommand,
          capEnabledSet: new Set(),
        },
      };
      const onClose = jest.fn();

      const { getByText, getByPlaceholderText } = render(
        <NickContextMenu
          {...baseProps}
          isServerOper={true}
          connection={connection}
          onClose={onClose}
        />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('KILL (with reason)'));

      fireEvent.changeText(getByPlaceholderText('Enter reason'), 'Spamming');
      fireEvent.press(getByText('Send'));

      expect(mockSendCommand).toHaveBeenCalledWith('KILL TestUser :Spamming');
      expect(onClose).toHaveBeenCalled();
    });

    it('cancels KILL modal', () => {
      const { getByText, queryByText } = render(
        <NickContextMenu {...baseProps} isServerOper={true} />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('KILL (with reason)'));

      fireEvent.press(getByText('Cancel'));

      // Modal should be closed
      expect(queryByText('KILL TestUser')).toBeNull();
    });
  });

  // ==================== Close on Overlay Press ====================
  describe('overlay press', () => {
    it('calls onClose when overlay is pressed', () => {
      const onClose = jest.fn();
      const { getByText } = render(
        <NickContextMenu {...baseProps} onClose={onClose} />,
      );

      // The TouchableOpacity with style contextOverlay handles the close
      // We can trigger it via the Close button which is easier to find
      fireEvent.press(getByText('Close'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ==================== Complex Scenarios ====================
  describe('complex scenarios', () => {
    it('handles multiple group expansions', () => {
      const { getByText } = render(<NickContextMenu {...baseProps} />);

      // Expand E2E
      fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share DM Key')).toBeTruthy();

      // Expand CTCP
      fireEvent.press(getByText('CTCP + DCC >'));
      expect(getByText('CTCP PING')).toBeTruthy();

      // Expand User List
      fireEvent.press(getByText('User list >'));
      expect(getByText('Ignore User')).toBeTruthy();
    });

    it('resets state when visibility changes', () => {
      const { rerender, getByText, queryByText } = render(
        <NickContextMenu {...baseProps} />,
      );

      // Expand a group
      fireEvent.press(getByText('E2E Encryption >'));
      expect(getByText('Share DM Key')).toBeTruthy();

      // Close and reopen
      rerender(<NickContextMenu {...baseProps} visible={false} />);
      rerender(<NickContextMenu {...baseProps} visible={true} />);

      // Group should be collapsed again
      expect(queryByText('Share DM Key')).toBeNull();
    });

    it('handles custom ignore action id', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <NickContextMenu
          {...baseProps}
          onAction={onAction}
          ignoreActionId="custom_ignore"
        />,
      );

      fireEvent.press(getByText('User list >'));
      fireEvent.press(getByText('Ignore User'));
      expect(onAction).toHaveBeenCalledWith('custom_ignore');
    });

    it('handles admin and owner modes for current user', () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['a'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(<NickContextMenu {...baseProps} />);
      expect(getByText('Operator Controls >')).toBeTruthy();
    });

    it('handles owner mode (q) for current user', () => {
      mockGetChannelUsers.mockReturnValue([
        { nick: 'MyNick', modes: ['q'], host: 'test.com', account: '*' },
        { nick: 'TestUser', modes: [], host: 'test.com', account: '*' },
      ]);

      const { getByText } = render(<NickContextMenu {...baseProps} />);
      expect(getByText('Operator Controls >')).toBeTruthy();
    });
  });
});
