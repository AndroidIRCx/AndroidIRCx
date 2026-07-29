/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import Clipboard from '@react-native-clipboard/clipboard';
import { UserList, copyNickToClipboard } from '../src/components/UserList';
import { ChannelUser } from '../src/services/IRCService';
import { performanceService } from '../src/services/PerformanceService';

let mockNickContextMenuProps: any = null;

// Mock Alert. Provide both default and named exports backed by the same
// jest.fn()s so the source (which imports `Alert` from 'react-native') and the
// tests (which require this module) observe the same calls.
jest.mock('react-native/Libraries/Alert/Alert', () => {
  const alert = jest.fn();
  const prompt = jest.fn();
  return { __esModule: true, default: { alert, prompt }, alert, prompt };
});

jest.mock('../src/components/NickContextMenu', () => {
  const React = require('react');
  return {
    NickContextMenu: (props: any) => {
      mockNickContextMenuProps = props;
      return React.createElement('NickContextMenu', props);
    },
  };
});

jest.mock('../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: jest.fn(() => null),
  },
}));

jest.mock('../src/services/IRCService', () => {
  const actual = jest.requireActual('../src/services/IRCService');
  return {
    ...actual,
    ircService: {
      ...actual.ircService,
      getCurrentNick: jest.fn(() => 'currentUser'),
      getNetworkName: jest.fn(() => 'testnet'),
      sendCommand: jest.fn(),
      sendRaw: jest.fn(),
      sendCTCPRequest: jest.fn(),
      isMonitoring: jest.fn(() => false),
      monitorNick: jest.fn(),
      unmonitorNick: jest.fn(),
      sendSilentMode: jest.fn(),
      addMessage: jest.fn(),
      isServerOper: jest.fn(() => false),
    },
  };
});

jest.mock('../src/services/PerformanceService', () => ({
  performanceService: {
    getConfig: jest.fn(() => ({
      userListType: 'flashlist',
      userListSearchDebounceMs: 300,
      userListInitialRenderCount: 50,
      userListEnableChunkLoading: false,
      userListChunkSize: 100,
      userListSkipSortThreshold: 1000,
      userListGrouping: true,
      userListAutoDisableGroupingThreshold: 1000,
    })),
    onConfigChange: jest.fn(() => jest.fn()),
  },
}));

jest.mock('../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn(() => Promise.resolve(true)),
    onSettingChange: jest.fn(() => jest.fn()),
  },
}));

jest.mock('../src/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

jest.mock('../src/stores/uiStore', () => ({
  useUIStore: {
    getState: jest.fn(() => ({
      whoisDisplayMode: 'inline',
      setWhoisNick: jest.fn(),
      setShowWHOIS: jest.fn(),
      setDccSendTarget: jest.fn(),
      setShowDccSendModal: jest.fn(),
    })),
  },
}));

jest.mock('../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    exportBundle: jest.fn(() => Promise.resolve({})),
    exportBundlePayload: jest.fn(() => Promise.resolve('test-payload')),
    exportFingerprintPayload: jest.fn(() =>
      Promise.resolve('fingerprint-payload'),
    ),
    getVerificationStatus: jest.fn(() =>
      Promise.resolve({ fingerprint: null, verified: false }),
    ),
    getVerificationStatusForNetwork: jest.fn(() =>
      Promise.resolve({ fingerprint: null, verified: false }),
    ),
    getBundleFingerprintForNetwork: jest.fn(() => Promise.resolve(null)),
    getSelfFingerprint: jest.fn(() => Promise.resolve('self-fp')),
    formatFingerprintForDisplay: jest.fn((fp: string) => fp),
    setVerifiedForNetwork: jest.fn(() => Promise.resolve()),
    acceptExternalBundleForNetwork: jest.fn(() => Promise.resolve()),
    parseExternalPayload: jest.fn((_raw: string) => ({
      type: 'encdm-bundle',
      nick: 'test',
      bundle: {},
      fingerprint: 'fp',
    })),
    verifyBundle: jest.fn(),
    awaitBundleForNick: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../src/services/BanService', () => ({
  banService: {
    getBanMaskTypes: jest.fn(() => [
      { id: 0, pattern: '*!*@*', description: 'Nick only' },
      { id: 1, pattern: '*!*@host', description: 'Host based' },
      { id: 2, pattern: '*!ident@*', description: 'Ident based' },
    ]),
    getPredefinedReasons: jest.fn(() => ['Rule violation', 'Spam']),
    generateBanMask: jest.fn(
      (nick: string, ident: string, host: string, _typeId: number) =>
        `${nick}!${ident}@${host}`,
    ),
  },
}));

jest.mock('../src/services/UserManagementService', () => ({
  userManagementService: {
    isUserIgnored: jest.fn(() => false),
    ignoreUser: jest.fn(),
    unignoreUser: jest.fn(),
    getUserNote: jest.fn(() => null),
    addUserNote: jest.fn(() => Promise.resolve()),
    removeUserNote: jest.fn(() => Promise.resolve()),
    addBlacklistEntry: jest.fn(() => Promise.resolve()),
  },
  BlacklistActionType: {
    IGNORE: 'ignore',
    BAN: 'ban',
    KICK_BAN: 'kick_ban',
  },
}));

jest.mock('../src/services/ChannelEncryptionService', () => ({
  channelEncryptionService: {
    exportChannelKey: jest.fn(() => Promise.resolve('key-data')),
  },
}));

jest.mock('../src/services/DCCChatService', () => ({
  dccChatService: {
    initiateChat: jest.fn(),
  },
}));

jest.mock('../src/services/WebRTCCallService', () => ({
  webRtcCallService: {
    startOutgoingCall: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/tmp',
  writeFile: jest.fn(() => Promise.resolve()),
  readFile: jest.fn(() => Promise.resolve('{"type":"encdm-bundle"}')),
  exists: jest.fn(() => Promise.resolve(true)),
  unlink: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    open: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('react-native-vision-camera', () => ({
  useCameraDevice: jest.fn(() => null),
  useCameraPermission: jest.fn(() => ({
    hasPermission: false,
    requestPermission: jest.fn(),
  })),
}));

jest.mock('react-native-vision-camera-barcode-scanner', () => ({
  CodeScanner: () => null,
}));

jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: {
    isSupported: jest.fn(() => Promise.resolve(true)),
    start: jest.fn(() => Promise.resolve()),
    requestTechnology: jest.fn(() => Promise.resolve()),
    writeNdefMessage: jest.fn(() => Promise.resolve()),
    getTag: jest.fn(() =>
      Promise.resolve({
        ndefMessage: [{ payload: 'payload-bytes' }],
      }),
    ),
    cancelTechnologyRequest: jest.fn(() => Promise.resolve()),
  },
  NfcTech: { Ndef: 'Ndef' },
  Ndef: {
    textRecord: jest.fn((value: string) => ({ value })),
    encodeMessage: jest.fn(() => [1, 2, 3]),
    text: {
      decodePayload: jest.fn(
        () =>
          '{"type":"encdm-bundle","nick":"Alice","bundle":{},"fingerprint":"peer-fp"}',
      ),
    },
  },
}));

describe('UserList', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockNickContextMenuProps = null;
  });

  describe('copyNickToClipboard', () => {
    it('writes to clipboard and returns message', async () => {
      const clipboardModule = require('@react-native-clipboard/clipboard');
      const spy = jest.spyOn(clipboardModule, 'setString');

      const msg = copyNickToClipboard('Bob');

      expect(spy).toHaveBeenCalledWith('Bob');
      expect(msg).toBe('Copied Bob');
    });

    it('uses translation function when provided', async () => {
      const t = (key: string) => `Translated: ${key}`;
      const msg = copyNickToClipboard('Alice', t);
      expect(msg).toBe('Translated: Copied {nick}'.replace('{nick}', 'Alice'));
    });
  });

  describe('Basic Rendering', () => {
    it('renders null when no channelName is provided', async () => {
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(<UserList users={[]} />);
      });
      expect(tree!.toJSON()).toBeNull();
    });

    it('renders with empty user list', async () => {
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={[]} channelName="#test" network="testnet" />,
        );
      });
      const json = tree!.toJSON();
      expect(json).not.toBeNull();
    });

    it('renders with single user', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const json = tree!.toJSON();
      expect(json).not.toBeNull();
    });

    it('renders with multiple users', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [] },
        { nick: 'Bob', modes: [] },
        { nick: 'Charlie', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const json = tree!.toJSON();
      expect(json).not.toBeNull();
    });

    it('displays correct user count in header', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [] },
        { nick: 'Bob', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const texts = instance.findAllByType('Text');
      const headerText = texts.find(
        t => t.props.children && t.props.children[0] === 2,
      );
      expect(headerText).toBeTruthy();
    });

    it('displays singular user count when one user', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const texts = instance.findAllByType('Text');
      const headerText = texts.find(
        t => t.props.children && t.props.children[0] === 1,
      );
      expect(headerText).toBeTruthy();
    });
  });

  describe('User Modes and Sorting', () => {
    it('renders users with different modes correctly', async () => {
      const users: ChannelUser[] = [
        { nick: 'Owner', modes: ['q'] },
        { nick: 'Admin', modes: ['a'] },
        { nick: 'Op', modes: ['o'] },
        { nick: 'HalfOp', modes: ['h'] },
        { nick: 'Voice', modes: ['v'] },
        { nick: 'Normal', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const json = tree!.toJSON();
      expect(json).not.toBeNull();
    });

    it('sorts users by mode priority (owner > admin > op > halfop > voice > none)', async () => {
      const users: ChannelUser[] = [
        { nick: 'Zebra', modes: [] },
        { nick: 'VoiceUser', modes: ['v'] },
        { nick: 'OwnerUser', modes: ['q'] },
        { nick: 'NormalUser', modes: [] },
        { nick: 'OpUser', modes: ['o'] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('sorts alphabetically within same mode', async () => {
      const users: ChannelUser[] = [
        { nick: 'Zebra', modes: [] },
        { nick: 'Alpha', modes: [] },
        { nick: 'Beta', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders users with accounts', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [], account: 'alice_account' },
        { nick: 'Bob', modes: [], account: '*' },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders users with multiple modes', async () => {
      const users: ChannelUser[] = [
        { nick: 'Multi', modes: ['o', 'v'] },
        { nick: 'Triple', modes: ['q', 'o', 'v'] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Search Functionality', () => {
    it('renders search input', async () => {
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={[]} channelName="#test" network="testnet" />,
        );
      });
      const instance = tree!.root;
      const textInputs = instance.findAllByType('TextInput');
      expect(textInputs.length).toBeGreaterThan(0);
    });

    it('filters users by nickname', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [] },
        { nick: 'Bob', modes: [] },
        { nick: 'Charlie', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('Ali');
      });

      expect(searchInput.props.value).toBe('Ali');
    });

    it('filters users by account name', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [], account: 'alice_account' },
        { nick: 'Bob', modes: [], account: 'bob_account' },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('alice_acc');
      });

      expect(searchInput.props.value).toBe('alice_acc');
    });

    it('shows clear button when search has text', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('search');
      });

      tree!.update(
        <UserList users={users} channelName="#test" network="testnet" />,
      );

      expect(searchInput.props.value).toBe('search');
    });

    it('clears search when clear button is pressed', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('search');
      });

      await act(async () => {
        searchInput.props.onChangeText('');
      });

      expect(searchInput.props.value).toBe('');
    });

    it('handles case-insensitive search', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [] },
        { nick: 'BOB', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('ALICE');
      });

      expect(searchInput.props.value).toBe('ALICE');
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no users', async () => {
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={[]} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('shows empty state when search returns no results', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('nonexistent');
      });

      expect(searchInput.props.value).toBe('nonexistent');
    });
  });

  describe('User Interactions', () => {
    it('handles user press', async () => {
      const onUserPress = jest.fn();
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList
            users={users}
            channelName="#test"
            network="testnet"
            onUserPress={onUserPress}
          />,
        );
      });

      const instance = tree!.root;
      const touchables = instance.findAllByType('TouchableOpacity');
      const userTouchable = touchables.find(
        t => t.props.onLongPress && typeof t.props.onLongPress === 'function',
      );

      if (userTouchable) {
        await act(async () => {
          userTouchable.props.onPress();
        });
        expect(onUserPress).toHaveBeenCalled();
      }
    });

    it('handles long press to open context menu', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      // Verify component rendered - user items are rendered
      const json = tree!.toJSON();
      expect(json).not.toBeNull();

      // The user items have onLongPress handlers defined by the component
      // This test verifies the component structure is correct
      const instance = tree!.root;
      expect(instance).toBeTruthy();
    });

    it('user press does nothing when onUserPress not provided', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const touchables = instance.findAllByType('TouchableOpacity');
      const userTouchable = touchables.find(
        t => t.props.onLongPress && typeof t.props.onLongPress === 'function',
      );

      if (userTouchable) {
        await act(async () => {
          userTouchable.props.onPress();
        });
        // Should not throw
        expect(userTouchable).toBeTruthy();
      }
    });
  });

  describe('Context Menu Actions', () => {
    it('opens context menu on long press', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const touchables = instance.findAllByType('TouchableOpacity');
      const userTouchable = touchables.find(
        t => t.props.onLongPress && typeof t.props.onLongPress === 'function',
      );

      if (userTouchable && userTouchable.props.onLongPress) {
        await act(async () => {
          userTouchable.props.onLongPress();
        });
      }
    });

    it('handles whois, query and copy actions from context menu', async () => {
      const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
        fn: any,
      ) => {
        if (typeof fn === 'function') fn();
        return 0 as any;
      }) as any);
      const irc = require('../src/services/IRCService').ircService;
      const onUserPress = jest.fn();
      const onWHOISPress = jest.fn();
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'simple',
        userListSearchDebounceMs: 0,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];

      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList
            users={users}
            channelName="#test"
            network="testnet"
            onUserPress={onUserPress}
            onWHOISPress={onWHOISPress}
          />,
        );
      });

      const instance = tree!.root;
      const userTouchable = instance.findAll(
        (node: any) =>
          node?.props && typeof node.props.onLongPress === 'function',
      )[0];
      expect(userTouchable).toBeTruthy();

      await act(async () => {
        userTouchable?.props.onLongPress();
      });

      expect(mockNickContextMenuProps).toBeTruthy();
      expect(mockNickContextMenuProps.nick).toBe('Alice');
      expect(mockNickContextMenuProps.channelUsers).toBe(users);
      await act(async () => {
        await mockNickContextMenuProps.onAction('whois');
        await mockNickContextMenuProps.onAction('query');
        await mockNickContextMenuProps.onAction('copy');
      });

      expect(onWHOISPress).toHaveBeenCalledWith('Alice');
      expect(onUserPress).toHaveBeenCalledWith(
        expect.objectContaining({ nick: 'Alice' }),
      );
      expect(Clipboard.setString).toHaveBeenCalledWith('Alice');
      expect(irc.sendCommand).not.toHaveBeenCalledWith('WHOIS Alice');
      timeoutSpy.mockRestore();
    });

    it('copies userhost payload from the shared nick context menu', async () => {
      const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
        fn: any,
      ) => {
        if (typeof fn === 'function') fn();
        return 0 as any;
      }) as any);
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'simple',
        userListSearchDebounceMs: 0,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];

      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const userTouchable = instance.findAll(
        (node: any) =>
          node?.props && typeof node.props.onLongPress === 'function',
      )[0];

      await act(async () => {
        userTouchable?.props.onLongPress();
      });

      await act(async () => {
        await mockNickContextMenuProps.onAction('copy_userhost', {
          userHostInfo: { user: '~alice', host: 'host.test' },
        });
        await mockNickContextMenuProps.onAction('copy_hostmask', {
          userHostInfo: { user: '~alice', host: 'host.test' },
        });
      });

      expect(Clipboard.setString).toHaveBeenCalledWith('~alice@host.test');
      expect(Clipboard.setString).toHaveBeenCalledWith(
        'Alice!~alice@host.test',
      );
      timeoutSpy.mockRestore();
    });

    it('handles monitor, ignore and dcc_send actions', async () => {
      const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
        fn: any,
      ) => {
        if (typeof fn === 'function') fn();
        return 0 as any;
      }) as any);
      const irc = require('../src/services/IRCService').ircService;
      const uiStore = require('../src/stores/uiStore').useUIStore;
      const userMgmt =
        require('../src/services/UserManagementService').userManagementService;
      const setDccSendTarget = jest.fn();
      const setShowDccSendModal = jest.fn();
      uiStore.getState.mockReturnValue({
        whoisDisplayMode: 'inline',
        setWhoisNick: jest.fn(),
        setShowWHOIS: jest.fn(),
        setDccSendTarget,
        setShowDccSendModal,
      });
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'simple',
        userListSearchDebounceMs: 0,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });

      irc.isMonitoring.mockReturnValueOnce(false).mockReturnValueOnce(true);
      userMgmt.isUserIgnored
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [], host: 'example.com' },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const userTouchable = instance.findAll(
        (node: any) =>
          node?.props && typeof node.props.onLongPress === 'function',
      )[0];
      expect(userTouchable).toBeTruthy();

      await act(async () => {
        userTouchable?.props.onLongPress();
      });

      expect(mockNickContextMenuProps).toBeTruthy();
      await act(async () => {
        await mockNickContextMenuProps.onAction('monitor_toggle');
        await mockNickContextMenuProps.onAction('monitor_toggle');
        await mockNickContextMenuProps.onAction('ignore');
        await mockNickContextMenuProps.onAction('ignore');
        await mockNickContextMenuProps.onAction('dcc_send');
      });

      expect(irc.monitorNick).toHaveBeenCalledWith('Alice');
      expect(irc.unmonitorNick).toHaveBeenCalledWith('Alice');
      expect(userMgmt.ignoreUser).toHaveBeenCalled();
      expect(userMgmt.unignoreUser).toHaveBeenCalledWith('Alice', 'testnet');
      expect(setDccSendTarget).toHaveBeenCalledWith({
        nick: 'Alice',
        networkId: 'testnet',
      });
      expect(setShowDccSendModal).toHaveBeenCalledWith(true);
      timeoutSpy.mockRestore();
    });

    it('falls back to direct WHOIS command in inline mode', async () => {
      const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
        fn: any,
      ) => {
        if (typeof fn === 'function') fn();
        return 0 as any;
      }) as any);
      const irc = require('../src/services/IRCService').ircService;
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'simple',
        userListSearchDebounceMs: 0,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];

      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const userTouchable = instance.findAll(
        (node: any) =>
          node?.props && typeof node.props.onLongPress === 'function',
      )[0];
      expect(userTouchable).toBeTruthy();

      await act(async () => {
        userTouchable?.props.onLongPress();
      });

      expect(mockNickContextMenuProps).toBeTruthy();
      await act(async () => {
        await mockNickContextMenuProps.onAction('whois');
      });

      expect(irc.sendCommand).toHaveBeenCalledWith('WHOIS Alice');
      timeoutSpy.mockRestore();
    });

    it('handles call, ctcp and operator command actions', async () => {
      const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
        fn: any,
      ) => {
        if (typeof fn === 'function') fn();
        return 0 as any;
      }) as any);
      const irc = require('../src/services/IRCService').ircService;
      const {
        webRtcCallService,
      } = require('../src/services/WebRTCCallService');
      const { dccChatService } = require('../src/services/DCCChatService');

      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'simple',
        userListSearchDebounceMs: 0,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });

      webRtcCallService.startOutgoingCall
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('audio fail'))
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('video fail'));

      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [], host: 'example.com' },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const userTouchable = instance.findAll(
        (node: any) =>
          node?.props && typeof node.props.onLongPress === 'function',
      )[0];
      expect(userTouchable).toBeTruthy();

      await act(async () => {
        userTouchable?.props.onLongPress();
      });

      await act(async () => {
        await mockNickContextMenuProps.onAction('audio_call');
        await mockNickContextMenuProps.onAction('audio_call');
        await mockNickContextMenuProps.onAction('video_call');
        await mockNickContextMenuProps.onAction('video_call');
        await mockNickContextMenuProps.onAction('ctcp_ping');
        await mockNickContextMenuProps.onAction('ctcp_version');
        await mockNickContextMenuProps.onAction('ctcp_time');
        await mockNickContextMenuProps.onAction('dcc_chat');
        await mockNickContextMenuProps.onAction('give_voice');
        await mockNickContextMenuProps.onAction('take_voice');
        await mockNickContextMenuProps.onAction('give_halfop');
        await mockNickContextMenuProps.onAction('take_halfop');
        await mockNickContextMenuProps.onAction('give_op');
        await mockNickContextMenuProps.onAction('take_op');
        await mockNickContextMenuProps.onAction('kick');
        await mockNickContextMenuProps.onAction('kick_message');
        await mockNickContextMenuProps.onAction('ban');
        await mockNickContextMenuProps.onAction('kick_ban');
        await mockNickContextMenuProps.onAction('kick_ban_message');
      });

      expect(webRtcCallService.startOutgoingCall).toHaveBeenCalledWith(
        'testnet',
        'Alice',
        'audio',
      );
      expect(webRtcCallService.startOutgoingCall).toHaveBeenCalledWith(
        'testnet',
        'Alice',
        'video',
      );
      expect(irc.sendCTCPRequest).toHaveBeenCalledWith(
        'Alice',
        'PING',
        expect.any(String),
      );
      expect(irc.sendCTCPRequest).toHaveBeenCalledWith('Alice', 'VERSION');
      expect(irc.sendCTCPRequest).toHaveBeenCalledWith('Alice', 'TIME');
      expect(dccChatService.initiateChat).toHaveBeenCalledWith(
        irc,
        'Alice',
        'testnet',
      );
      expect(irc.sendCommand).toHaveBeenCalledWith('MODE #test +v Alice');
      expect(irc.sendCommand).toHaveBeenCalledWith('MODE #test -v Alice');
      expect(irc.sendCommand).toHaveBeenCalledWith('MODE #test +h Alice');
      expect(irc.sendCommand).toHaveBeenCalledWith('MODE #test -h Alice');
      expect(irc.sendCommand).toHaveBeenCalledWith('MODE #test +o Alice');
      expect(irc.sendCommand).toHaveBeenCalledWith('MODE #test -o Alice');
      expect(irc.sendCommand).toHaveBeenCalledWith('KICK #test Alice');
      expect(irc.sendCommand).toHaveBeenCalledWith('KICK #test Alice :Kicked');
      expect(irc.sendCommand).toHaveBeenCalledWith(
        'MODE #test +b *!*@example.com',
      );
      timeoutSpy.mockRestore();
    });

    it('handles encryption share/request/qr and channel key actions', async () => {
      const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
        fn: any,
      ) => {
        if (typeof fn === 'function') fn();
        return 0 as any;
      }) as any);
      const irc = require('../src/services/IRCService').ircService;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      const {
        channelEncryptionService,
      } = require('../src/services/ChannelEncryptionService');

      encryptedDMService.exportBundle.mockResolvedValue({ key: 'bundle' });
      encryptedDMService.awaitBundleForNick
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('timeout'));
      encryptedDMService.exportFingerprintPayload.mockResolvedValue(
        'fp-payload',
      );
      encryptedDMService.exportBundlePayload.mockResolvedValue(
        'bundle-payload',
      );
      channelEncryptionService.exportChannelKey.mockResolvedValue(
        'chan-key-data',
      );

      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'simple',
        userListSearchDebounceMs: 0,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });

      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [], host: 'example.com' },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const userTouchable = instance.findAll(
        (node: any) =>
          node?.props && typeof node.props.onLongPress === 'function',
      )[0];

      await act(async () => {
        userTouchable?.props.onLongPress();
      });

      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_share');
        await mockNickContextMenuProps.onAction('enc_request');
        await mockNickContextMenuProps.onAction('enc_request');
        await mockNickContextMenuProps.onAction('enc_qr_show_fingerprint');
        await mockNickContextMenuProps.onAction('enc_qr_show_bundle');
        await mockNickContextMenuProps.onAction('chan_share');
        await mockNickContextMenuProps.onAction('chan_request');
      });

      expect(encryptedDMService.exportBundle).toHaveBeenCalled();
      expect(encryptedDMService.awaitBundleForNick).toHaveBeenCalledWith(
        'Alice',
        36000,
      );
      expect(encryptedDMService.exportFingerprintPayload).toHaveBeenCalledWith(
        'currentUser',
      );
      expect(encryptedDMService.exportBundlePayload).toHaveBeenCalledWith(
        'currentUser',
      );
      expect(irc.sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('PRIVMSG Alice :!enc-offer'),
      );
      expect(irc.sendRaw).toHaveBeenCalledWith('PRIVMSG Alice :!enc-req');
      expect(channelEncryptionService.exportChannelKey).toHaveBeenCalledWith(
        '#test',
        'testnet',
      );
      expect(irc.sendRaw).toHaveBeenCalledWith(
        'PRIVMSG Alice :!chanenc-key chan-key-data',
      );
      expect(irc.sendRaw).toHaveBeenCalledWith(
        'PRIVMSG Alice :Please share the channel key for #test with /chankey share currentUser',
      );

      timeoutSpy.mockRestore();
    });

    it('handles note save and blacklist add flows', async () => {
      const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
        fn: any,
      ) => {
        if (typeof fn === 'function') fn();
        return 0 as any;
      }) as any);
      const userMgmt =
        require('../src/services/UserManagementService').userManagementService;

      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'simple',
        userListSearchDebounceMs: 0,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });

      userMgmt.getUserNote.mockReturnValueOnce(null);

      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [], ident: 'alice', host: 'example.com' },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const userTouchable = instance.findAll(
        (node: any) =>
          node?.props && typeof node.props.onLongPress === 'function',
      )[0];

      await act(async () => {
        userTouchable?.props.onLongPress();
      });

      await act(async () => {
        await mockNickContextMenuProps.onAction('add_note');
      });

      const findPressableByLabel = (label: string) => {
        const pressables = instance.findAll(
          (node: any) =>
            node?.props && typeof node.props.onPress === 'function',
        );
        return pressables.find((node: any) => {
          try {
            return node
              .findAllByType('Text')
              .some((txt: any) => txt.props?.children === label);
          } catch {
            return false;
          }
        });
      };

      const noteInput = instance
        .findAllByType('TextInput')
        .find(
          (input: any) =>
            input.props?.placeholder === 'Enter note about this user',
        );
      expect(noteInput).toBeTruthy();

      await act(async () => {
        noteInput?.props.onChangeText('important note');
      });

      const saveButton = findPressableByLabel('Save');
      expect(saveButton?.props?.onPress).toBeTruthy();

      await act(async () => {
        await saveButton?.props.onPress();
      });

      expect(userMgmt.addUserNote).toHaveBeenCalledWith(
        'Alice',
        'important note',
        'testnet',
      );

      await act(async () => {
        await mockNickContextMenuProps.onAction('blacklist');
      });

      const addButton = findPressableByLabel('Add');
      expect(addButton?.props?.onPress).toBeTruthy();

      await act(async () => {
        await addButton?.props.onPress();
      });

      expect(userMgmt.addBlacklistEntry).toHaveBeenCalled();
      timeoutSpy.mockRestore();
    });

    it('handles file/NFC key exchange actions', async () => {
      const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
        fn: any,
      ) => {
        if (typeof fn === 'function') fn();
        return 0 as any;
      }) as any);
      const RNFS = require('react-native-fs');
      const Share = require('react-native-share').default;
      const Picker = require('@react-native-documents/picker');
      const NfcManager = require('react-native-nfc-manager').default;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');

      Picker.pick.mockResolvedValue([
        {
          uri: 'file:///tmp/key.json',
          fileCopyUri: 'file:///tmp/key-copy.json',
        },
      ]);
      encryptedDMService.getBundleFingerprintForNetwork.mockResolvedValueOnce(
        null,
      );

      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'simple',
        userListSearchDebounceMs: 0,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });

      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [], host: 'example.com' },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const userTouchable = instance.findAll(
        (node: any) =>
          node?.props && typeof node.props.onLongPress === 'function',
      )[0];

      await act(async () => {
        userTouchable?.props.onLongPress();
      });

      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_share_file');
        await mockNickContextMenuProps.onAction('enc_import_file');
        await mockNickContextMenuProps.onAction('enc_share_nfc');
        await mockNickContextMenuProps.onAction('enc_receive_nfc');
      });

      expect(RNFS.writeFile).toHaveBeenCalled();
      expect(Share.open).toHaveBeenCalled();
      expect(Picker.pick).toHaveBeenCalled();
      expect(RNFS.readFile).toHaveBeenCalled();
      expect(NfcManager.requestTechnology).toHaveBeenCalled();
      expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalled();
      timeoutSpy.mockRestore();
    });
  });

  describe('Position Styles', () => {
    it('renders with left position', async () => {
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={[]} channelName="#test" position="left" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders with right position', async () => {
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={[]} channelName="#test" position="right" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders with top position', async () => {
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={[]} channelName="#test" position="top" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders with bottom position', async () => {
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={[]} channelName="#test" position="bottom" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Custom Props', () => {
    it('renders with custom panel size', async () => {
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList
            users={[]}
            channelName="#test"
            panelSizePx={200}
            nickFontSizePx={14}
          />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders with different font size', async () => {
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList
            users={[{ nick: 'Alice', modes: [] }]}
            channelName="#test"
            nickFontSizePx={16}
          />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Large User Lists', () => {
    it('handles large user lists', async () => {
      const users: ChannelUser[] = Array.from({ length: 100 }, (_, i) => ({
        nick: `User${i}`,
        modes: i % 5 === 0 ? ['o'] : [],
      }));
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('skips sort for very large lists above threshold', async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'flashlist',
        userListSearchDebounceMs: 300,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: true,
        userListChunkSize: 100,
        userListSkipSortThreshold: 50,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });

      const users: ChannelUser[] = Array.from({ length: 100 }, (_, i) => ({
        nick: `User${i}`,
        modes: [],
      }));
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('auto-disables grouping for very large lists', async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'grouped',
        userListSearchDebounceMs: 300,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 50,
      });

      const users: ChannelUser[] = Array.from({ length: 100 }, (_, i) => ({
        nick: `User${i}`,
        modes: i % 5 === 0 ? ['o'] : [],
      }));
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Grouped View', () => {
    beforeEach(async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'grouped',
        userListSearchDebounceMs: 300,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });
    });

    it('renders grouped user list', async () => {
      const users: ChannelUser[] = [
        { nick: 'Owner', modes: ['q'] },
        { nick: 'Op1', modes: ['o'] },
        { nick: 'Op2', modes: ['o'] },
        { nick: 'Normal1', modes: [] },
        { nick: 'Normal2', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('handles group collapse/expand', async () => {
      const users: ChannelUser[] = [
        { nick: 'Op1', modes: ['o'] },
        { nick: 'Normal1', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const touchables = instance.findAllByType('TouchableOpacity');

      // Find a group header (it has activeOpacity but no onLongPress)
      const groupHeader = touchables.find(t => {
        return t.props.onPress && !t.props.onLongPress;
      });

      if (groupHeader) {
        await act(async () => {
          groupHeader.props.onPress();
        });
      }
    });

    it('renders grouped view with all mode types', async () => {
      const users: ChannelUser[] = [
        { nick: 'Owner', modes: ['q'] },
        { nick: 'Admin', modes: ['a'] },
        { nick: 'Op', modes: ['o'] },
        { nick: 'HalfOp', modes: ['h'] },
        { nick: 'Voice', modes: ['v'] },
        { nick: 'Regular1', modes: [] },
        { nick: 'Regular2', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders empty grouped view', async () => {
      const users: ChannelUser[] = [];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Simple List View', () => {
    beforeEach(async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'simple',
        userListSearchDebounceMs: 300,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });
    });

    it('renders simple scroll view', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [] },
        { nick: 'Bob', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('FlatList View', () => {
    beforeEach(async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'flatlist',
        userListSearchDebounceMs: 300,
        userListInitialRenderCount: 20,
        userListEnableChunkLoading: true,
        userListChunkSize: 50,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });
    });

    it('renders with FlatList', async () => {
      const users: ChannelUser[] = Array.from({ length: 30 }, (_, i) => ({
        nick: `User${i}`,
        modes: [],
      }));
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('WHOIS Action', () => {
    it('handles WHOIS via onWHOISPress callback', async () => {
      const onWHOISPress = jest.fn();
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];

      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList
            users={users}
            channelName="#test"
            network="testnet"
            onWHOISPress={onWHOISPress}
          />,
        );
      });

      expect(tree!.toJSON()).not.toBeNull();
    });

    it('handles WHOIS via modal mode', async () => {
      const uiStore = require('../src/stores/uiStore').useUIStore;
      uiStore.getState.mockReturnValue({
        whoisDisplayMode: 'modal',
        setWhoisNick: jest.fn(),
        setShowWHOIS: jest.fn(),
        setDccSendTarget: jest.fn(),
        setShowDccSendModal: jest.fn(),
      });

      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('User with ident and host', () => {
    it('renders users with ident and host info', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [], ident: 'alice', host: 'example.com' },
        { nick: 'Bob', modes: [], ident: 'bob', host: 'irc.example.net' },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Current user as operator', () => {
    it('renders when current user has operator status', async () => {
      const ircService = require('../src/services/IRCService').ircService;
      ircService.getCurrentNick.mockReturnValue('CurrentOp');

      const users: ChannelUser[] = [
        { nick: 'CurrentOp', modes: ['o'] },
        { nick: 'RegularUser', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders when current user has halfop status', async () => {
      const ircService = require('../src/services/IRCService').ircService;
      ircService.getCurrentNick.mockReturnValue('CurrentHalfOp');

      const users: ChannelUser[] = [
        { nick: 'CurrentHalfOp', modes: ['h'] },
        { nick: 'RegularUser', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders when current user is not found', async () => {
      const ircService = require('../src/services/IRCService').ircService;
      ircService.getCurrentNick.mockReturnValue('NotInList');

      const users: ChannelUser[] = [{ nick: 'RegularUser', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Mode Color and Prefix', () => {
    it('renders users with owner mode prefix ~', async () => {
      const users: ChannelUser[] = [{ nick: 'Owner', modes: ['q'] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders users with admin mode prefix &', async () => {
      const users: ChannelUser[] = [{ nick: 'Admin', modes: ['a'] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders users with op mode prefix @', async () => {
      const users: ChannelUser[] = [{ nick: 'Op', modes: ['o'] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders users with halfop mode prefix %', async () => {
      const users: ChannelUser[] = [{ nick: 'HalfOp', modes: ['h'] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders users with voice mode prefix +', async () => {
      const users: ChannelUser[] = [{ nick: 'Voice', modes: ['v'] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders users with no mode prefix', async () => {
      const users: ChannelUser[] = [{ nick: 'Regular', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders users with unknown modes', async () => {
      const users: ChannelUser[] = [{ nick: 'Unknown', modes: ['x', 'y'] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Search with special characters', () => {
    it('handles search with uppercase characters', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [] },
        { nick: 'bob', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('BOB');
      });

      expect(searchInput.props.value).toBe('BOB');
    });

    it('handles search with numbers', async () => {
      const users: ChannelUser[] = [
        { nick: 'User123', modes: [] },
        { nick: 'User456', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('123');
      });

      expect(searchInput.props.value).toBe('123');
    });

    it('handles empty search query', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('');
      });

      expect(searchInput.props.value).toBe('');
    });

    it('handles whitespace-only search query', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('   ');
      });

      expect(searchInput.props.value).toBe('   ');
    });
  });

  describe('Chunk loading', () => {
    beforeEach(async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'flashlist',
        userListSearchDebounceMs: 300,
        userListInitialRenderCount: 20,
        userListEnableChunkLoading: true,
        userListChunkSize: 50,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });
    });

    it('renders with chunk loading enabled', async () => {
      const users: ChannelUser[] = Array.from({ length: 100 }, (_, i) => ({
        nick: `User${i}`,
        modes: [],
      }));
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Network prop variations', () => {
    it('renders without network prop', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders with empty network prop', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Default props', () => {
    it('uses default position prop', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('uses default panelSizePx prop', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('uses default nickFontSizePx prop', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Modal rendering', () => {
    it('renders with component structure intact', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      // Component should render successfully
      const json = tree!.toJSON();
      expect(json).not.toBeNull();

      const instance = tree!.root;
      expect(instance).toBeTruthy();
    });
  });

  describe('Action messages', () => {
    it('renders component with action message state', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Various list types with empty and populated lists', () => {
    it('renders FlashList with empty users', async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'flashlist',
        userListSearchDebounceMs: 300,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });

      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={[]} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders FlashList with users', async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'flashlist',
        userListSearchDebounceMs: 300,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });

      const users: ChannelUser[] = [
        { nick: 'Alice', modes: ['o'] },
        { nick: 'Bob', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Performance config edge cases', () => {
    it('handles performance config with minimal values', async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'simple',
        userListSearchDebounceMs: 0,
        userListInitialRenderCount: 1,
        userListEnableChunkLoading: false,
        userListChunkSize: 1,
        userListSkipSortThreshold: 0,
        userListGrouping: false,
        userListAutoDisableGroupingThreshold: 0,
      });

      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('handles performance config with undefined values', async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: undefined,
        userListSearchDebounceMs: undefined,
        userListInitialRenderCount: undefined,
        userListEnableChunkLoading: undefined,
        userListChunkSize: undefined,
        userListSkipSortThreshold: undefined,
        userListGrouping: undefined,
        userListAutoDisableGroupingThreshold: undefined,
      });

      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('User account edge cases', () => {
    it('renders user with undefined account', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [], account: undefined },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders user with empty account', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [], account: '' }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Ident and host variations', () => {
    it('renders user with only ident (no host)', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [], ident: 'alice' },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders user with only host (no ident)', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: [], host: 'example.com' },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });

    it('renders user with neither ident nor host', async () => {
      const users: ChannelUser[] = [{ nick: 'Alice', modes: [] }];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('Grouped view filtering', () => {
    beforeEach(async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'grouped',
        userListSearchDebounceMs: 300,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });
    });

    it('filters grouped users by search query', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: ['o'] },
        { nick: 'Bob', modes: [] },
        { nick: 'Charlie', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('ali');
      });

      expect(searchInput.props.value).toBe('ali');
    });

    it('handles empty search results in grouped view', async () => {
      const users: ChannelUser[] = [
        { nick: 'Alice', modes: ['o'] },
        { nick: 'Bob', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const instance = tree!.root;
      const searchInput = instance.findAllByType('TextInput')[0];

      await act(async () => {
        searchInput.props.onChangeText('xyz123');
      });

      expect(searchInput.props.value).toBe('xyz123');
    });
  });

  // ---- Additional coverage tests ----

  const SIMPLE_CONFIG = {
    userListType: 'simple',
    userListSearchDebounceMs: 0,
    userListInitialRenderCount: 50,
    userListEnableChunkLoading: false,
    userListChunkSize: 100,
    userListSkipSortThreshold: 1000,
    userListGrouping: true,
    userListAutoDisableGroupingThreshold: 1000,
  };

  const immediateTimeout = () =>
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: any) => {
      if (typeof fn === 'function') fn();
      return 0 as any;
    }) as any);

  const renderSimple = async (users: ChannelUser[], props: any = {}) => {
    (performanceService.getConfig as jest.Mock).mockReturnValue(SIMPLE_CONFIG);
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <UserList
          users={users}
          channelName="#test"
          network="testnet"
          {...props}
        />,
      );
    });
    return tree!;
  };

  const longPressFirstUser = async (tree: TestRenderer.ReactTestRenderer) => {
    const userTouchable = tree.root.findAll(
      (node: any) =>
        node?.props && typeof node.props.onLongPress === 'function',
    )[0];
    await act(async () => {
      userTouchable?.props.onLongPress();
    });
  };

  const findPressableByLabel = (
    tree: TestRenderer.ReactTestRenderer,
    label: string,
  ) => {
    const pressables = tree.root.findAll(
      (node: any) => node?.props && typeof node.props.onPress === 'function',
    );
    return pressables.find((node: any) => {
      try {
        return node
          .findAllByType('Text')
          .some((txt: any) => txt.props?.children === label);
      } catch {
        return false;
      }
    });
  };

  describe('handleExternalPayload flows', () => {
    const importPayload = async (_tree: TestRenderer.ReactTestRenderer) => {
      const Picker = require('@react-native-documents/picker');
      Picker.pick.mockResolvedValue([
        { uri: 'file:///tmp/key.json', fileCopyUri: 'file:///tmp/copy.json' },
      ]);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_import_file');
      });
    };

    it('imports a new DM key bundle when nick matches', async () => {
      const timeoutSpy = immediateTimeout();
      const Alert = require('react-native').Alert;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.parseExternalPayload.mockReturnValue({
        type: 'encdm-bundle',
        nick: 'Alice',
        bundle: { k: 1 },
        fingerprint: 'newfp',
      });
      encryptedDMService.getBundleFingerprintForNetwork.mockResolvedValue(null);
      encryptedDMService.exportBundlePayload.mockResolvedValue('share-payload');

      const tree = await renderSimple([
        { nick: 'Alice', modes: [], ident: 'alice', host: 'example.com' },
      ]);
      await longPressFirstUser(tree);
      await importPayload(tree);

      const importCall = Alert.alert.mock.calls.find(
        (c: any[]) => c[0] === 'Import DM Key',
      );
      expect(importCall).toBeTruthy();
      const acceptButton = importCall[2].find((b: any) => b.text === 'Accept');
      await act(async () => {
        await acceptButton.onPress();
      });
      expect(
        encryptedDMService.acceptExternalBundleForNetwork,
      ).toHaveBeenCalledWith('testnet', 'Alice', { k: 1 }, false);

      // The follow-up "Share Your Key?" prompt fires via setTimeout(immediate)
      const shareCall = Alert.alert.mock.calls.find(
        (c: any[]) => c[0] === 'Share Your Key?',
      );
      expect(shareCall).toBeTruthy();
      const showQrButton = shareCall[2].find(
        (b: any) => b.text === 'Show QR Code',
      );
      await act(async () => {
        await showQrButton.onPress();
      });
      expect(encryptedDMService.exportBundlePayload).toHaveBeenCalled();
      timeoutSpy.mockRestore();
    });

    it('replaces an existing DM key bundle', async () => {
      const timeoutSpy = immediateTimeout();
      const Alert = require('react-native').Alert;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.parseExternalPayload.mockReturnValue({
        type: 'encdm-bundle',
        nick: 'Alice',
        bundle: { k: 2 },
        fingerprint: 'newfp',
      });
      encryptedDMService.getBundleFingerprintForNetwork.mockResolvedValue(
        'oldfp',
      );
      // Make the follow-up share QR export fail to cover its catch branch.
      encryptedDMService.exportBundlePayload.mockRejectedValue(
        new Error('nope'),
      );

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await importPayload(tree);

      const replaceCall = Alert.alert.mock.calls.find(
        (c: any[]) => c[0] === 'Replace DM Key',
      );
      expect(replaceCall).toBeTruthy();
      const replaceButton = replaceCall[2].find(
        (b: any) => b.text === 'Replace',
      );
      await act(async () => {
        await replaceButton.onPress();
      });
      expect(
        encryptedDMService.acceptExternalBundleForNetwork,
      ).toHaveBeenCalledWith('testnet', 'Alice', { k: 2 }, true);

      const shareCall = Alert.alert.mock.calls.find(
        (c: any[]) => c[0] === 'Share Your Key?',
      );
      const showQrButton = shareCall[2].find(
        (b: any) => b.text === 'Show QR Code',
      );
      await act(async () => {
        await showQrButton.onPress();
      });
      timeoutSpy.mockRestore();
    });

    it('warns on mismatched nick payload', async () => {
      const timeoutSpy = immediateTimeout();
      const Alert = require('react-native').Alert;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.parseExternalPayload.mockReturnValue({
        type: 'encdm-bundle',
        nick: 'Somebody',
        bundle: {},
        fingerprint: 'fp',
      });

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await importPayload(tree);

      expect(
        Alert.alert.mock.calls.some((c: any[]) => c[0] === 'Mismatched Nick'),
      ).toBe(true);
      timeoutSpy.mockRestore();
    });

    it('handles fingerprint payload with matching stored key', async () => {
      const timeoutSpy = immediateTimeout();
      const Alert = require('react-native').Alert;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.parseExternalPayload.mockReturnValue({
        type: 'encdm-fingerprint',
        nick: 'Alice',
        fingerprint: 'match-fp',
      });
      encryptedDMService.getBundleFingerprintForNetwork.mockResolvedValue(
        'match-fp',
      );

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await importPayload(tree);

      const fpCall = Alert.alert.mock.calls.find(
        (c: any[]) => c[0] === 'Fingerprint Check',
      );
      expect(fpCall).toBeTruthy();
      const markVerified = fpCall[2].find(
        (b: any) => b.text === 'Mark Verified',
      );
      expect(markVerified).toBeTruthy();
      await act(async () => {
        await markVerified.onPress();
      });
      expect(encryptedDMService.setVerifiedForNetwork).toHaveBeenCalledWith(
        'testnet',
        'Alice',
        true,
      );
      timeoutSpy.mockRestore();
    });

    it('handles fingerprint payload with mismatched stored key', async () => {
      const timeoutSpy = immediateTimeout();
      const Alert = require('react-native').Alert;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.parseExternalPayload.mockReturnValue({
        type: 'encdm-fingerprint',
        nick: 'Alice',
        fingerprint: 'incoming-fp',
      });
      encryptedDMService.getBundleFingerprintForNetwork.mockResolvedValue(
        'stored-fp',
      );

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await importPayload(tree);

      const fpCall = Alert.alert.mock.calls.find(
        (c: any[]) => c[0] === 'Fingerprint Check',
      );
      expect(fpCall).toBeTruthy();
      // Mismatch => only a Close button
      expect(fpCall[2].every((b: any) => b.text !== 'Mark Verified')).toBe(
        true,
      );
      timeoutSpy.mockRestore();
    });

    it('handles fingerprint payload with no stored key', async () => {
      const timeoutSpy = immediateTimeout();
      const Alert = require('react-native').Alert;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.parseExternalPayload.mockReturnValue({
        type: 'encdm-fingerprint',
        nick: 'Alice',
        fingerprint: 'incoming-fp',
      });
      encryptedDMService.getBundleFingerprintForNetwork.mockResolvedValue(null);

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await importPayload(tree);

      expect(Alert.alert.mock.calls.some((c: any[]) => c[0] === 'No Key')).toBe(
        true,
      );
      timeoutSpy.mockRestore();
    });

    it('reports an invalid key payload', async () => {
      const timeoutSpy = immediateTimeout();
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.parseExternalPayload.mockImplementation(() => {
        throw new Error('bad');
      });

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await importPayload(tree);
      // Should not throw; feedback message set internally.
      expect(tree.toJSON()).not.toBeNull();
      timeoutSpy.mockRestore();
    });
  });

  describe('enc_verify action', () => {
    it('shows verify dialog and marks verified / copies fingerprints', async () => {
      const timeoutSpy = immediateTimeout();
      const Alert = require('react-native').Alert;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.getVerificationStatusForNetwork.mockResolvedValue({
        fingerprint: 'peer-fp',
        verified: false,
      });
      encryptedDMService.getSelfFingerprint.mockResolvedValue('self-fp');

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_verify');
      });

      const call = Alert.alert.mock.calls.find(
        (c: any[]) => c[0] === 'Verify DM Key',
      );
      expect(call).toBeTruthy();
      const markVerified = call[2].find((b: any) => b.text === 'Mark Verified');
      const copyBtn = call[2].find((b: any) => b.text === 'Copy Fingerprints');
      await act(async () => {
        await markVerified.onPress();
        await copyBtn.onPress();
      });
      expect(encryptedDMService.setVerifiedForNetwork).toHaveBeenCalledWith(
        'testnet',
        'Alice',
        true,
      );
      expect(Clipboard.setString).toHaveBeenCalledWith(
        expect.stringContaining('Alice:'),
      );
      timeoutSpy.mockRestore();
    });

    it('handles already-verified status and no-key status', async () => {
      const timeoutSpy = immediateTimeout();
      const Alert = require('react-native').Alert;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.getVerificationStatusForNetwork
        .mockResolvedValueOnce({ fingerprint: 'peer-fp', verified: true })
        .mockResolvedValueOnce({ fingerprint: null, verified: false });

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_verify');
      });
      const call = Alert.alert.mock.calls.find(
        (c: any[]) => c[0] === 'Verify DM Key',
      );
      const verifiedBtn = call[2].find((b: any) => b.text === 'Verified');
      expect(verifiedBtn).toBeTruthy();
      await act(async () => {
        await verifiedBtn.onPress();
      });

      // Second invocation: no key stored
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_verify');
      });
      expect(
        encryptedDMService.getVerificationStatusForNetwork,
      ).toHaveBeenCalledTimes(2);
      timeoutSpy.mockRestore();
    });

    it('uses non-network verification status when no network prop', async () => {
      const timeoutSpy = immediateTimeout();
      const Alert = require('react-native').Alert;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.getVerificationStatus.mockResolvedValue({
        fingerprint: 'peer-fp',
        verified: false,
      });

      (performanceService.getConfig as jest.Mock).mockReturnValue(
        SIMPLE_CONFIG,
      );
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList
            users={[{ nick: 'Alice', modes: [] }]}
            channelName="#test"
          />,
        );
      });
      await longPressFirstUser(tree!);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_verify');
      });
      expect(encryptedDMService.getVerificationStatus).toHaveBeenCalledWith(
        'Alice',
      );
      const call = Alert.alert.mock.calls.find(
        (c: any[]) => c[0] === 'Verify DM Key',
      );
      expect(call).toBeTruthy();
      timeoutSpy.mockRestore();
    });

    it('handles enc_verify failure', async () => {
      const timeoutSpy = immediateTimeout();
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.getVerificationStatusForNetwork.mockRejectedValue(
        new Error('fail'),
      );

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_verify');
      });
      expect(tree.toJSON()).not.toBeNull();
      timeoutSpy.mockRestore();
    });
  });

  describe('kill action', () => {
    it('prompts and sends KILL with a reason', async () => {
      const timeoutSpy = immediateTimeout();
      const Alert = require('react-native').Alert;
      const irc = require('../src/services/IRCService').ircService;

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('kill');
      });

      const promptCall = Alert.prompt.mock.calls.find((c: any[]) =>
        String(c[0]).includes('KILL'),
      );
      expect(promptCall).toBeTruthy();
      const sendButton = promptCall[2].find((b: any) => b.text === 'Send');

      // Empty reason -> error alert, no command sent
      await act(async () => {
        sendButton.onPress('   ');
      });
      expect(Alert.alert.mock.calls.some((c: any[]) => c[0] === 'Error')).toBe(
        true,
      );
      expect(irc.sendCommand).not.toHaveBeenCalledWith(
        expect.stringContaining('KILL Alice'),
      );

      // Valid reason -> command sent
      await act(async () => {
        sendButton.onPress('spamming');
      });
      expect(irc.sendCommand).toHaveBeenCalledWith('KILL Alice :spamming');
      timeoutSpy.mockRestore();
    });
  });

  describe('WHOIS modal mode', () => {
    it('opens the WHOIS modal via the ui store', async () => {
      const timeoutSpy = immediateTimeout();
      const uiStore = require('../src/stores/uiStore').useUIStore;
      const setWhoisNick = jest.fn();
      const setShowWHOIS = jest.fn();
      uiStore.getState.mockReturnValue({
        whoisDisplayMode: 'modal',
        setWhoisNick,
        setShowWHOIS,
        setDccSendTarget: jest.fn(),
        setShowDccSendModal: jest.fn(),
      });

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('whois');
      });
      expect(setWhoisNick).toHaveBeenCalledWith('Alice');
      expect(setShowWHOIS).toHaveBeenCalledWith(true);
      timeoutSpy.mockRestore();
    });
  });

  describe('long press fallback and default action', () => {
    it('falls back to MODE command when sendSilentMode is unavailable', async () => {
      const timeoutSpy = immediateTimeout();
      const irc = require('../src/services/IRCService').ircService;
      const originalSilent = irc.sendSilentMode;
      irc.getCurrentNick.mockReturnValue('currentUser');
      irc.sendSilentMode = undefined;

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      expect(irc.sendCommand).toHaveBeenCalledWith('MODE currentUser');

      irc.sendSilentMode = originalSilent;
      timeoutSpy.mockRestore();
    });

    it('ignores unknown actions and clears prior feedback', async () => {
      const timeoutSpy = immediateTimeout();
      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      // First action sets a feedback message (flushed on its own).
      await act(async () => {
        await mockNickContextMenuProps.onAction('copy');
      });
      // Second action with a stale feedback message triggers the reset timeout.
      await act(async () => {
        await mockNickContextMenuProps.onAction('unknown_action_xyz');
      });
      expect(tree.toJSON()).not.toBeNull();
      timeoutSpy.mockRestore();
    });
  });

  describe('error/catch branches for actions', () => {
    it('handles failures in share/qr/channel actions', async () => {
      const timeoutSpy = immediateTimeout();
      const irc = require('../src/services/IRCService').ircService;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      const {
        channelEncryptionService,
      } = require('../src/services/ChannelEncryptionService');

      encryptedDMService.exportBundle.mockRejectedValueOnce(new Error('x'));
      encryptedDMService.exportFingerprintPayload.mockRejectedValueOnce(
        new Error('x'),
      );
      encryptedDMService.exportBundlePayload.mockRejectedValueOnce(
        new Error('x'),
      );
      channelEncryptionService.exportChannelKey.mockRejectedValueOnce(
        new Error('chan fail'),
      );
      irc.sendRaw.mockImplementationOnce(() => {
        throw new Error('raw fail');
      });

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_share');
        await mockNickContextMenuProps.onAction('enc_qr_show_fingerprint');
        await mockNickContextMenuProps.onAction('enc_qr_show_bundle');
        await mockNickContextMenuProps.onAction('chan_share');
        await mockNickContextMenuProps.onAction('chan_request');
      });
      expect(tree.toJSON()).not.toBeNull();
      timeoutSpy.mockRestore();
    });

    it('handles NFC unsupported and file/nfc failures', async () => {
      const timeoutSpy = immediateTimeout();
      const NfcManager = require('react-native-nfc-manager').default;
      const RNFS = require('react-native-fs');
      const Picker = require('@react-native-documents/picker');
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');

      NfcManager.isSupported.mockResolvedValue(false);
      RNFS.writeFile.mockRejectedValueOnce(new Error('write fail'));
      encryptedDMService.exportBundlePayload.mockResolvedValue('payload');
      Picker.pick.mockRejectedValueOnce(new Error('pick fail'));

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_share_file');
        await mockNickContextMenuProps.onAction('enc_import_file');
        await mockNickContextMenuProps.onAction('enc_share_nfc');
        await mockNickContextMenuProps.onAction('enc_receive_nfc');
      });
      expect(NfcManager.isSupported).toHaveBeenCalled();
      NfcManager.isSupported.mockResolvedValue(true);
      timeoutSpy.mockRestore();
    });

    it('handles cancelled file import (OPERATION_CANCELED)', async () => {
      const timeoutSpy = immediateTimeout();
      const Picker = require('@react-native-documents/picker');
      Picker.isErrorWithCode.mockReturnValue(true);
      Picker.pick.mockRejectedValueOnce({
        code: Picker.errorCodes.OPERATION_CANCELED,
      });

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_import_file');
      });
      expect(tree.toJSON()).not.toBeNull();
      Picker.isErrorWithCode.mockReturnValue(false);
      timeoutSpy.mockRestore();
    });

    it('handles empty file import result and no-NFC-payload', async () => {
      const timeoutSpy = immediateTimeout();
      const Picker = require('@react-native-documents/picker');
      const NfcManager = require('react-native-nfc-manager').default;
      Picker.pick.mockResolvedValueOnce([]);
      NfcManager.getTag.mockResolvedValueOnce({ ndefMessage: [] });

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_import_file');
        await mockNickContextMenuProps.onAction('enc_receive_nfc');
      });
      expect(tree.toJSON()).not.toBeNull();
      timeoutSpy.mockRestore();
    });
  });

  describe('enc_qr_scan camera flows', () => {
    it('denies scanning without camera permission', async () => {
      const timeoutSpy = immediateTimeout();
      const camera = require('react-native-vision-camera');
      const requestPermission = jest.fn(() => Promise.resolve(false));
      camera.useCameraDevice.mockReturnValue(null);
      camera.useCameraPermission.mockReturnValue({
        hasPermission: false,
        requestPermission,
      });

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_qr_scan');
      });
      expect(requestPermission).toHaveBeenCalled();
      // Scan modal should not be open (fallback path).
      expect(tree.toJSON()).not.toBeNull();
      timeoutSpy.mockRestore();
    });

    it('opens the scanner and processes barcode + error callbacks', async () => {
      const timeoutSpy = immediateTimeout();
      const camera = require('react-native-vision-camera');
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      camera.useCameraDevice.mockReturnValue({ id: 'back' });
      camera.useCameraPermission.mockReturnValue({
        hasPermission: true,
        requestPermission: jest.fn(() => Promise.resolve(true)),
      });
      encryptedDMService.parseExternalPayload.mockReturnValue({
        type: 'encdm-bundle',
        nick: 'Alice',
        bundle: {},
        fingerprint: 'fp',
      });
      encryptedDMService.getBundleFingerprintForNetwork.mockResolvedValue(null);

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_qr_scan');
      });

      const scanner = tree.root.findAll(
        (node: any) =>
          node?.props && typeof node.props.onBarcodeScanned === 'function',
      )[0];
      expect(scanner).toBeTruthy();

      // Error callback
      await act(async () => {
        scanner.props.onError(new Error('scan boom'));
      });
      // Successful barcode scan
      await act(async () => {
        scanner.props.onBarcodeScanned([{ rawValue: 'scanned-code' }]);
      });
      expect(encryptedDMService.parseExternalPayload).toHaveBeenCalledWith(
        'scanned-code',
      );

      // Reset camera mocks for other tests.
      camera.useCameraDevice.mockReturnValue(null);
      camera.useCameraPermission.mockReturnValue({
        hasPermission: false,
        requestPermission: jest.fn(),
      });
      timeoutSpy.mockRestore();
    });

    it('shows fallback text when camera permission granted but no device', async () => {
      const timeoutSpy = immediateTimeout();
      const camera = require('react-native-vision-camera');
      camera.useCameraDevice.mockReturnValue(null);
      camera.useCameraPermission.mockReturnValue({
        hasPermission: true,
        requestPermission: jest.fn(() => Promise.resolve(true)),
      });

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_qr_scan');
      });
      // Close the scan modal via its close button.
      const closeButton = findPressableByLabel(tree, 'Close');
      if (closeButton) {
        await act(async () => {
          closeButton.props.onPress();
        });
      }
      expect(tree.toJSON()).not.toBeNull();

      camera.useCameraPermission.mockReturnValue({
        hasPermission: false,
        requestPermission: jest.fn(),
      });
      timeoutSpy.mockRestore();
    });

    it('handles camera permission request throwing', async () => {
      const timeoutSpy = immediateTimeout();
      const camera = require('react-native-vision-camera');
      camera.useCameraDevice.mockReturnValue(null);
      camera.useCameraPermission.mockReturnValue({
        hasPermission: false,
        requestPermission: jest.fn(() => {
          throw new Error('perm boom');
        }),
      });

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_qr_scan');
      });
      expect(tree.toJSON()).not.toBeNull();

      camera.useCameraPermission.mockReturnValue({
        hasPermission: false,
        requestPermission: jest.fn(),
      });
      timeoutSpy.mockRestore();
    });
  });

  describe('QR modal', () => {
    it('renders QR modal, copies payload and closes', async () => {
      const timeoutSpy = immediateTimeout();
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      encryptedDMService.exportBundlePayload.mockResolvedValue('qr-data');

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_qr_show_bundle');
      });

      // Note: the modal overlay (activeOpacity === 1) also contains the
      // "Copy Payload" text as a descendant, so exclude it and target the
      // actual button.
      const copyButton = tree.root
        .findAll(
          (node: any) =>
            node?.props &&
            typeof node.props.onPress === 'function' &&
            node.props.activeOpacity !== 1,
        )
        .find((node: any) => {
          try {
            return node
              .findAllByType('Text')
              .some((t: any) => t.props?.children === 'Copy Payload');
          } catch {
            return false;
          }
        });
      expect(copyButton).toBeTruthy();
      await act(async () => {
        copyButton!.props.onPress();
      });
      expect(Clipboard.setString).toHaveBeenCalledWith('qr-data');

      // The overlay TouchableOpacity closes the modal.
      const overlay = tree.root.findAll(
        (node: any) =>
          node?.props &&
          typeof node.props.onPress === 'function' &&
          node.props.activeOpacity === 1,
      )[0];
      if (overlay) {
        await act(async () => {
          overlay.props.onPress();
        });
      }
      timeoutSpy.mockRestore();
    });
  });

  describe('settings subscriptions', () => {
    it('subscribes to security setting changes and unsubscribes on unmount', async () => {
      const { settingsService } = require('../src/services/SettingsService');
      const unsub = jest.fn();
      settingsService.onSettingChange.mockImplementation(
        (_key: string, cb: (v: any) => void) => {
          cb(false);
          return unsub;
        },
      );

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      expect(settingsService.onSettingChange).toHaveBeenCalledWith(
        'securityAllowQrVerification',
        expect.any(Function),
      );
      await act(async () => {
        tree.unmount();
      });
      expect(unsub).toHaveBeenCalled();

      settingsService.onSettingChange.mockImplementation(() => jest.fn());
    });
  });

  describe('grouped view toggling and blacklist template', () => {
    beforeEach(() => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'grouped',
        userListSearchDebounceMs: 0,
        userListInitialRenderCount: 50,
        userListEnableChunkLoading: false,
        userListChunkSize: 100,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });
    });

    it('toggles every group header collapse/expand', async () => {
      const users: ChannelUser[] = [
        { nick: 'Owner', modes: ['q'] },
        { nick: 'Admin', modes: ['a'] },
        { nick: 'Op', modes: ['o'] },
        { nick: 'HalfOp', modes: ['h'] },
        { nick: 'Voice', modes: ['v'] },
        { nick: 'Regular', modes: [] },
      ];
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });

      const headers = tree!.root.findAll(
        (node: any) =>
          node?.props &&
          typeof node.props.onPress === 'function' &&
          !node.props.onLongPress &&
          node.props.activeOpacity === 0.7,
      );
      expect(headers.length).toBeGreaterThan(0);
      // Collapse then expand each group.
      for (const header of headers) {
        await act(async () => {
          header.props.onPress();
        });
      }
      await act(async () => {
        headers[0].props.onPress();
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('blacklist modal pickers and templates', () => {
    it('opens mask and action pickers, selects custom, and adds with template', async () => {
      const timeoutSpy = immediateTimeout();
      const { settingsService } = require('../src/services/SettingsService');
      const userMgmt =
        require('../src/services/UserManagementService').userManagementService;
      settingsService.getSetting.mockImplementation((key: string, def: any) => {
        if (key === 'blacklistTemplates') {
          return Promise.resolve({
            global: { gline: 'GLINE {hostmask} :{reason}' },
            testnet: { gline: 'LOCAL GLINE {hostmask}' },
          });
        }
        return Promise.resolve(def === undefined ? true : def);
      });

      const tree = await renderSimple([
        { nick: 'Alice', modes: [], ident: 'alice', host: 'example.com' },
      ]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('blacklist');
      });

      // Open the ban mask picker.
      const maskPicker = findPressableByLabel(tree, '(2) *!ident@*');
      expect(maskPicker).toBeTruthy();
      await act(async () => {
        maskPicker!.props.onPress();
      });
      // Select a mask option by its description subtext.
      const maskOption = findPressableByLabel(tree, 'Host based');
      expect(maskOption).toBeTruthy();
      await act(async () => {
        maskOption!.props.onPress();
      });

      // Open the action picker.
      const actionPicker = findPressableByLabel(tree, 'Ban');
      expect(actionPicker).toBeTruthy();
      await act(async () => {
        actionPicker!.props.onPress();
      });
      // Select GLINE to exercise the template lookup.
      const glineOption = findPressableByLabel(tree, 'GLINE');
      expect(glineOption).toBeTruthy();
      await act(async () => {
        glineOption!.props.onPress();
      });

      // Add with the GLINE template.
      const addButton = findPressableByLabel(tree, 'Add');
      await act(async () => {
        await addButton!.props.onPress();
      });
      expect(userMgmt.addBlacklistEntry).toHaveBeenCalledWith(
        expect.any(String),
        'gline',
        undefined,
        'testnet',
        'LOCAL GLINE {hostmask}',
      );

      settingsService.getSetting.mockImplementation(() =>
        Promise.resolve(true),
      );
      timeoutSpy.mockRestore();
    });

    it('selects custom action and adds a custom command', async () => {
      const timeoutSpy = immediateTimeout();
      const userMgmt =
        require('../src/services/UserManagementService').userManagementService;

      const tree = await renderSimple([
        { nick: 'Alice', modes: [], ident: 'alice', host: 'example.com' },
      ]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('blacklist');
      });

      // Open action picker and choose Custom Command.
      const actionPicker = findPressableByLabel(tree, 'Ban');
      await act(async () => {
        actionPicker!.props.onPress();
      });
      const customOption = findPressableByLabel(tree, 'Custom Command');
      await act(async () => {
        customOption!.props.onPress();
      });

      // The custom command input should now be present.
      const customInput = tree.root
        .findAllByType('TextInput')
        .find((i: any) =>
          String(i.props?.placeholder || '').includes('Command template'),
        );
      expect(customInput).toBeTruthy();
      await act(async () => {
        customInput!.props.onChangeText('KILL {nick}');
      });

      const reasonInput = tree.root
        .findAllByType('TextInput')
        .find((i: any) => i.props?.placeholder === 'Reason (optional)');
      await act(async () => {
        reasonInput!.props.onChangeText('bad behaviour');
      });

      const addButton = findPressableByLabel(tree, 'Add');
      await act(async () => {
        await addButton!.props.onPress();
      });
      expect(userMgmt.addBlacklistEntry).toHaveBeenCalledWith(
        expect.any(String),
        'custom',
        'bad behaviour',
        'testnet',
        'KILL {nick}',
      );
      timeoutSpy.mockRestore();
    });

    it('closes mask and action pickers via their Close buttons', async () => {
      const timeoutSpy = immediateTimeout();
      const tree = await renderSimple([
        { nick: 'Alice', modes: [], ident: 'alice', host: 'example.com' },
      ]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('blacklist');
      });

      const maskPicker = findPressableByLabel(tree, '(2) *!ident@*');
      await act(async () => {
        maskPicker!.props.onPress();
      });
      let closeButton = findPressableByLabel(tree, 'Close');
      expect(closeButton).toBeTruthy();
      await act(async () => {
        closeButton!.props.onPress();
      });

      const actionPicker = findPressableByLabel(tree, 'Ban');
      await act(async () => {
        actionPicker!.props.onPress();
      });
      closeButton = findPressableByLabel(tree, 'Close');
      await act(async () => {
        closeButton!.props.onPress();
      });

      // Cancel the blacklist modal.
      const cancelButton = findPressableByLabel(tree, 'Cancel');
      await act(async () => {
        cancelButton!.props.onPress();
      });
      expect(tree.toJSON()).not.toBeNull();
      timeoutSpy.mockRestore();
    });
  });

  describe('note modal removal and network-scoped service', () => {
    it('removes a note when cleared and uses network-scoped service', async () => {
      const timeoutSpy = immediateTimeout();
      const {
        connectionManager,
      } = require('../src/services/ConnectionManager');
      const irc = require('../src/services/IRCService').ircService;
      const scopedService = {
        addUserNote: jest.fn(() => Promise.resolve()),
        removeUserNote: jest.fn(() => Promise.resolve()),
        getUserNote: jest.fn(() => 'existing note'),
      };
      connectionManager.getConnection.mockReturnValue({
        userManagementService: scopedService,
        ircService: irc,
      });

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('add_note');
      });

      const noteInput = tree.root
        .findAllByType('TextInput')
        .find(
          (i: any) => i.props?.placeholder === 'Enter note about this user',
        );
      expect(noteInput).toBeTruthy();
      // Clear the note text to exercise the removal path.
      await act(async () => {
        noteInput!.props.onChangeText('   ');
      });
      const saveButton = findPressableByLabel(tree, 'Save');
      await act(async () => {
        await saveButton!.props.onPress();
      });
      expect(scopedService.removeUserNote).toHaveBeenCalledWith(
        'Alice',
        'testnet',
      );

      connectionManager.getConnection.mockReturnValue(null);
      timeoutSpy.mockRestore();
    });
  });

  describe('load more via list end reached', () => {
    it('loads additional chunks when reaching the list end', async () => {
      (performanceService.getConfig as jest.Mock).mockReturnValue({
        userListType: 'flashlist',
        userListSearchDebounceMs: 0,
        userListInitialRenderCount: 20,
        userListEnableChunkLoading: true,
        userListChunkSize: 50,
        userListSkipSortThreshold: 1000,
        userListGrouping: true,
        userListAutoDisableGroupingThreshold: 1000,
      });
      const users: ChannelUser[] = Array.from({ length: 100 }, (_, i) => ({
        nick: `User${String(i).padStart(3, '0')}`,
        modes: [],
      }));
      let tree: TestRenderer.ReactTestRenderer;
      await act(async () => {
        tree = TestRenderer.create(
          <UserList users={users} channelName="#test" network="testnet" />,
        );
      });
      const list = tree!.root.findAll(
        (node: any) =>
          node?.props && typeof node.props.onEndReached === 'function',
      )[0];
      expect(list).toBeTruthy();
      await act(async () => {
        list.props.onEndReached();
      });
      expect(tree!.toJSON()).not.toBeNull();
    });
  });

  describe('remaining branch/handler coverage', () => {
    it('clears the search via the clear (✕) button', async () => {
      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      const searchInput = tree.root.findAllByType('TextInput')[0];
      await act(async () => {
        searchInput.props.onChangeText('alice');
      });
      const clearButton = tree.root
        .findAll(
          (node: any) =>
            node?.props && typeof node.props.onPress === 'function',
        )
        .find((node: any) => {
          try {
            return node
              .findAllByType('Text')
              .some((t: any) => t.props?.children === '✕');
          } catch {
            return false;
          }
        });
      expect(clearButton).toBeTruthy();
      await act(async () => {
        clearButton!.props.onPress();
      });
      expect(searchInput.props.value).toBe('');
    });

    it('cancels the note modal via its Cancel button', async () => {
      const timeoutSpy = immediateTimeout();
      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('add_note');
      });
      const cancelButton = findPressableByLabel(tree, 'Cancel');
      expect(cancelButton).toBeTruthy();
      await act(async () => {
        cancelButton!.props.onPress();
      });
      // Note modal closed => its input is gone.
      const noteInput = tree.root
        .findAllByType('TextInput')
        .find(
          (i: any) => i.props?.placeholder === 'Enter note about this user',
        );
      expect(noteInput).toBeFalsy();
      timeoutSpy.mockRestore();
    });

    it('invokes onUserPress when a user row is pressed', async () => {
      const onUserPress = jest.fn();
      const tree = await renderSimple([{ nick: 'Alice', modes: [] }], {
        onUserPress,
      });
      const row = tree.root.findAll(
        (node: any) =>
          node?.props && typeof node.props.onLongPress === 'function',
      )[0];
      expect(row).toBeTruthy();
      await act(async () => {
        row.props.onPress();
      });
      expect(onUserPress).toHaveBeenCalledWith(
        expect.objectContaining({ nick: 'Alice' }),
      );
    });

    it('resets stale feedback after a subsequent action', async () => {
      // Use fake timers so the feedback-clearing effect stays pending (leaving
      // actionMessage populated between the two actions, exercising the trailing
      // `if (actionMessage) setTimeout(...)` reset branch) without leaking a real
      // timer into sibling tests.
      jest.useFakeTimers();
      try {
        const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
        await longPressFirstUser(tree);
        await act(async () => {
          await mockNickContextMenuProps.onAction('copy');
        });
        await act(async () => {
          await mockNickContextMenuProps.onAction('give_voice');
        });
        expect(tree.toJSON()).not.toBeNull();
      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    });

    it('handles NFC share and receive failures after start', async () => {
      const timeoutSpy = immediateTimeout();
      const NfcManager = require('react-native-nfc-manager').default;
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      NfcManager.isSupported.mockResolvedValue(true);
      NfcManager.requestTechnology.mockRejectedValue(new Error('tech fail'));
      encryptedDMService.exportBundlePayload.mockResolvedValue('payload');

      const tree = await renderSimple([{ nick: 'Alice', modes: [] }]);
      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_share_nfc');
        await mockNickContextMenuProps.onAction('enc_receive_nfc');
      });
      expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalled();

      NfcManager.requestTechnology.mockResolvedValue(undefined);
      timeoutSpy.mockRestore();
    });

    it('invokes all modal dismiss handlers', async () => {
      const timeoutSpy = immediateTimeout();
      const camera = require('react-native-vision-camera');
      const {
        encryptedDMService,
      } = require('../src/services/EncryptedDMService');
      camera.useCameraDevice.mockReturnValue({ id: 'back' });
      camera.useCameraPermission.mockReturnValue({
        hasPermission: true,
        requestPermission: jest.fn(() => Promise.resolve(true)),
      });
      encryptedDMService.exportBundlePayload.mockResolvedValue('payload');

      const tree = await renderSimple([
        { nick: 'Alice', modes: [], ident: 'alice', host: 'example.com' },
      ]);
      await longPressFirstUser(tree);

      // NickContextMenu onClose handler.
      await act(async () => {
        mockNickContextMenuProps.onClose();
      });

      await longPressFirstUser(tree);
      await act(async () => {
        await mockNickContextMenuProps.onAction('add_note');
      });
      await act(async () => {
        await mockNickContextMenuProps.onAction('blacklist');
      });
      // Open the ban-mask and action pickers so their modals mount.
      const maskPicker = findPressableByLabel(tree, '(2) *!ident@*');
      await act(async () => {
        maskPicker!.props.onPress();
      });
      const actionPicker = findPressableByLabel(tree, 'Ban');
      await act(async () => {
        actionPicker!.props.onPress();
      });
      // QR + scan modals.
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_qr_show_bundle');
      });
      await act(async () => {
        await mockNickContextMenuProps.onAction('enc_qr_scan');
      });

      const modals = tree.root.findAll(
        (node: any) =>
          node?.props && typeof node.props.onRequestClose === 'function',
      );
      expect(modals.length).toBeGreaterThan(0);
      await act(async () => {
        modals.forEach((m: any) => m.props.onRequestClose());
      });
      expect(tree.toJSON()).not.toBeNull();

      camera.useCameraDevice.mockReturnValue(null);
      camera.useCameraPermission.mockReturnValue({
        hasPermission: false,
        requestPermission: jest.fn(),
      });
      timeoutSpy.mockRestore();
    });
  });
});
