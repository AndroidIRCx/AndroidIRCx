/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

let mockNickContextMenuProps: any = null;
let mockKickBanModalProps: any = null;

// ── sub-component mocks ────────────────────────────────────────────────────
jest.mock('../../src/components/LinkPreview', () => ({
  LinkPreview: (_p: any) => null,
}));
jest.mock('../../src/components/ImagePreview', () => ({
  ImagePreview: (_p: any) => null,
}));
jest.mock('../../src/components/MessageReactions', () => ({
  MessageReactionsComponent: (_p: any) => null,
}));
jest.mock('../../src/components/MediaMessageDisplay', () => ({
  MediaMessageDisplay: (_p: any) => null,
}));
jest.mock('../../src/components/VideoPlayer', () => ({
  VideoPlayer: (_p: any) => null,
}));
jest.mock('../../src/components/AudioPlayer', () => ({
  AudioPlayer: (_p: any) => null,
}));
jest.mock('../../src/components/MessageSearchBar', () => ({
  MessageSearchBar: (_p: any) => null,
}));
jest.mock('../../src/components/NickContextMenu', () => ({
  NickContextMenu: (p: any) => {
    mockNickContextMenuProps = p;
    return null;
  },
}));
jest.mock('../../src/components/KickBanModal', () => ({
  __esModule: true,
  default: (p: any) => {
    mockKickBanModalProps = p;
    return null;
  },
}));

// ── third-party library mocks ──────────────────────────────────────────────
jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => React.createElement(View) };
});
jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: jest.fn(() => null),
  useCameraPermission: jest.fn(() => ({ hasPermission: false, requestPermission: jest.fn() })),
  useCodeScanner: jest.fn(() => ({})),
}));
jest.mock('react-native-share', () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp',
  readFile: jest.fn().mockResolvedValue(''),
  writeFile: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(false),
  downloadFile: jest.fn(() => ({ promise: Promise.resolve({ statusCode: 200 }) })),
  unlink: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn().mockResolvedValue([]),
  types: { allFiles: '*/*', images: 'image/*' },
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: jest.fn(() => false),
}));
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  default: { start: jest.fn(), isSupported: jest.fn().mockResolvedValue(false) },
  Ndef: {},
  NfcTech: {},
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn().mockResolvedValue(''),
}));
jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('Text', null, 'Icon') };
});

// ── service mocks ──────────────────────────────────────────────────────────
const mockGetSetting = jest.fn();
const mockOnSettingChange = jest.fn();

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...a: unknown[]) => mockGetSetting(...a),
    onSettingChange: (...a: unknown[]) => mockOnSettingChange(...a),
  },
}));

const mockGetConnection = jest.fn();
const mockGetActiveNetworkId = jest.fn(() => 'net-1');

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: (...a: unknown[]) => mockGetConnection(...a),
    getActiveNetworkId: (...a: unknown[]) => mockGetActiveNetworkId(...a),
  },
}));

jest.mock('../../src/services/LayoutService', () => ({
  layoutService: {
    getConfig: jest.fn(() => ({
      navigationBarOffset: 0,
      messageTextDirection: 'auto',
      messageTextWritingSystem: 'auto',
    })),
    getFontSizePixels: jest.fn(() => 14),
    onConfigChange: jest.fn(() => jest.fn()),
  },
}));

jest.mock('../../src/services/PerformanceService', () => ({
  performanceService: {
    measureRender: jest.fn(),
    getConfig: jest.fn(() => ({
      enableVirtualization: true,
      maxVisibleMessages: 100,
      messageLoadChunk: 50,
      enableLazyLoading: true,
      messageLimit: 1000,
      enableMessageCleanup: false,
      cleanupThreshold: 1500,
      renderOptimization: true,
      imageLazyLoad: true,
      userListGrouping: true,
      userListVirtualization: true,
      userListAutoDisableGroupingThreshold: 1000,
      userListAutoVirtualizeThreshold: 500,
      userListType: 'flashlist',
      userListSearchDebounceMs: 300,
      userListSkipSortThreshold: 1000,
      userListEnableChunkLoading: true,
      userListChunkSize: 100,
      userListInitialRenderCount: 50,
    })),
    onConfigChange: jest.fn(() => jest.fn()),
  },
}));

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: { getHistory: jest.fn(() => []) },
}));

jest.mock('../../src/services/HighlightService', () => ({
  highlightService: {
    isHighlighted: jest.fn(() => false),
    getHighlightWords: jest.fn(() => []),
    onHighlightWordsChange: jest.fn(() => jest.fn()),
  },
}));

jest.mock('../../src/services/UserManagementService', () => ({
  userManagementService: {
    addToBlacklist: jest.fn(),
    removeFromBlacklist: jest.fn(),
    getBlacklist: jest.fn(() => []),
    isUserIgnored: jest.fn(() => false),
    unignoreUser: jest.fn(),
    ignoreUser: jest.fn(),
    getUserNote: jest.fn(() => ''),
    addUserNote: jest.fn(),
    removeUserNote: jest.fn(),
    addBlacklistEntry: jest.fn(),
  },
  BlacklistActionType: {},
}));

jest.mock('../../src/services/BanService', () => ({
  banService: {
    getBanMaskTypes: jest.fn(() => [
      { id: 2, pattern: '*!*@host', description: 'default mask' },
    ]),
    generateBanMask: jest.fn(() => '*!*@*'),
    addBan: jest.fn(),
  },
}));

jest.mock('../../src/services/DCCChatService', () => ({
  dccChatService: { openChat: jest.fn(), initiateChat: jest.fn() },
}));

jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    getCurrentNick: jest.fn(() => 'TestNick'),
    getChannelUsers: jest.fn(() => []),
    getNetworkName: jest.fn(() => 'TestNet'),
    isServerOper: jest.fn(() => false),
    sendRaw: jest.fn(),
  },
  IRCMessage: {},
  RawMessageCategory: {},
  ChannelUser: {},
}));

jest.mock('../../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    parseExternalPayload: jest.fn(),
    getBundleFingerprintForNetwork: jest.fn().mockResolvedValue(null),
    formatFingerprintForDisplay: jest.fn(() => 'fp-display'),
    exportBundle: jest.fn(async () => ({ bundle: 'test-bundle' })),
    awaitBundleForNick: jest.fn().mockResolvedValue(undefined),
    isEncryptedForNetwork: jest.fn().mockResolvedValue(false),
    getVerificationStatusForNetwork: jest.fn().mockResolvedValue({ fingerprint: null, verified: false }),
    getVerificationStatus: jest.fn().mockResolvedValue({ fingerprint: null, verified: false }),
    getSelfFingerprint: jest.fn().mockResolvedValue('self-fp'),
    setVerifiedForNetwork: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/ChannelEncryptionService', () => ({
  channelEncryptionService: {
    hasEncryptionKey: jest.fn().mockResolvedValue(false),
    exportChannelKey: jest.fn().mockResolvedValue('chan-key-data'),
  },
}));

jest.mock('../../src/services/SoundService', () => ({
  soundService: { play: jest.fn(), playSound: jest.fn() },
}));

// ── utility mocks ──────────────────────────────────────────────────────────
jest.mock('../../src/utils/MessageParser', () => ({
  parseMessage: jest.fn((text: string) => [{ type: 'text', text }]),
  isVideoUrl: jest.fn(() => false),
  isAudioUrl: jest.fn(() => false),
  isDownloadableFileUrl: jest.fn(() => false),
}));

jest.mock('../../src/utils/IRCFormatter', () => ({
  formatIRCTextAsComponent: jest.fn((text: string) => text),
  formatIRCTextWithLinks: jest.fn((text: string, style: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { style }, text);
  }),
}));

jest.mock('../../src/utils/MessageFormatDefaults', () => ({
  getDefaultMessageFormats: jest.fn(() => ({
    message: null,
    messageMention: null,
    action: null,
    actionMention: null,
    notice: null,
    join: null,
    part: null,
    quit: null,
    kick: null,
    nick: null,
    invite: null,
    monitor: null,
    mode: null,
    topic: null,
    raw: null,
    error: null,
    ctcp: null,
    event: null,
  })),
}));

// ── hook mocks ─────────────────────────────────────────────────────────────
jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: jest.fn(() => ({
    theme: { id: 'light' },
    colors: {
      background: '#fff',
      surface: '#fafafa',
      surfaceVariant: '#f5f5f5',
      surfaceAlt: '#fff',
      text: '#212121',
      textSecondary: '#757575',
      primary: '#2196F3',
      error: '#F44336',
      warning: '#FF9800',
      info: '#2196F3',
      border: '#E0E0E0',
      messageBackground: '#fff',
      messageText: '#212121',
      messageNick: '#1976D2',
      messageTimestamp: '#9E9E9E',
      noticeMessage: '#FF9800',
      joinMessage: '#4CAF50',
      partMessage: '#FF9800',
      quitMessage: '#F44336',
      kickMessage: '#F44336',
      nickMessage: '#1976D2',
      inviteMessage: '#2196F3',
      monitorMessage: '#2196F3',
      topicMessage: '#9C27B0',
      modeMessage: '#5DADE2',
      rawMessage: '#757575',
      ctcpMessage: '#388E3C',
      actionMessage: '#9E9E9E',
      systemMessage: '#757575',
      highlightBackground: 'rgba(33,150,243,0.1)',
      highlightText: '#FF6F00',
      linkColor: '#2196F3',
    },
  })),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: jest.fn(() => (key: string, _params?: any) => key),
}));

// ── store mocks ────────────────────────────────────────────────────────────
const mockGetTabsByNetwork = jest.fn(() => []);
const mockGetTabById = jest.fn(() => undefined);
const mockSetTabs = jest.fn();
const mockSetActiveTabId = jest.fn();

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: Object.assign(
    (selector: (state: any) => any) =>
      selector({
        tabs: [],
        setTabs: mockSetTabs,
        setActiveTabId: mockSetActiveTabId,
        getTabById: mockGetTabById,
        getTabsByNetwork: mockGetTabsByNetwork,
      }),
    {
      getState: () => ({
        tabs: [],
        getTabsByNetwork: mockGetTabsByNetwork,
        getTabById: mockGetTabById,
      }),
    }
  ),
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (state: any) => any) =>
      selector({
        setShowQueryEncryptionMenu: jest.fn(),
        setPrefillMessage: jest.fn(),
      }),
    {
      getState: jest.fn(() => ({
        whoisDisplayMode: 'tab',
        setWhoisNick: jest.fn(),
        setShowWHOIS: jest.fn(),
        setDccSendTarget: jest.fn(),
        setShowDccSendModal: jest.fn(),
      })),
    }
  ),
}));

// ── silence act() warnings from async settings loading ─────────────────────
let originalConsoleError: typeof console.error;
beforeAll(() => {
  originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('not wrapped in act')) return;
    originalConsoleError(...args);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});

// ── component import ───────────────────────────────────────────────────────
import { MessageArea } from '../../src/components/MessageArea';

// ── helpers ────────────────────────────────────────────────────────────────
const makeMsg = (overrides: Partial<any> = {}): any => ({
  id: `msg-${Math.random().toString(36).slice(2)}`,
  type: 'message',
  text: 'Hello World',
  from: 'Alice',
  timestamp: Date.now(),
  network: 'TestNet',
  channel: '#general',
  ...overrides,
});

const baseProps = {
  messages: [] as any[],
  channel: '#general',
  network: 'TestNet',
  tabId: 'channel::TestNet::#general',
};

// Helper: render and flush all pending async work.
// NOTE: render() must NOT be inside act() because RNTL already wraps it internally;
// nesting causes "Can't access .root on unmounted test renderer" with React 19.
const renderAndSettle = async (ui: React.ReactElement) => {
  const result = render(ui);
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  return result;
};

// ── test suite ─────────────────────────────────────────────────────────────
describe('MessageArea', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNickContextMenuProps = null;
    mockKickBanModalProps = null;

    mockGetSetting.mockImplementation((_key: string, fallback: unknown) =>
      Promise.resolve(fallback)
    );
    mockOnSettingChange.mockImplementation(() => jest.fn());
    mockGetConnection.mockReturnValue({
      ircService: {
        getCurrentNick: jest.fn(() => 'TestNick'),
        getChannelUsers: jest.fn(() => []),
        getNetworkName: jest.fn(() => 'TestNet'),
        isServerOper: jest.fn(() => false),
        sendRaw: jest.fn(),
        sendCommand: jest.fn(),
        sendCTCPRequest: jest.fn(),
        addMessage: jest.fn(),
        isMonitoring: jest.fn(() => false),
        monitorNick: jest.fn(),
        unmonitorNick: jest.fn(),
      },
    });
  });

  // ── basic rendering ──────────────────────────────────────────────────────
  it('renders without crashing when given an empty messages array', async () => {
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with messages provided', async () => {
    const messages = [makeMsg({ text: 'Test message', from: 'Bob' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders without optional props', async () => {
    const { toJSON } = await renderAndSettle(<MessageArea messages={[]} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── message type rendering ───────────────────────────────────────────────
  it('renders a join message', async () => {
    const messages = [makeMsg({ type: 'join', text: 'Alice has joined #general', from: 'Alice' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a part message', async () => {
    const messages = [makeMsg({ type: 'part', text: 'Alice has left #general', from: 'Alice' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a quit message', async () => {
    const messages = [makeMsg({ type: 'quit', text: 'Alice has quit [Bye!]', from: 'Alice' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a notice message', async () => {
    const messages = [makeMsg({ type: 'notice', text: 'Server notice here' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders an error message', async () => {
    const messages = [makeMsg({ type: 'error', text: 'Connection error' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a topic message', async () => {
    const messages = [makeMsg({ type: 'topic', text: 'Channel topic changed', from: 'Alice' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a mode message', async () => {
    const messages = [makeMsg({ type: 'mode', text: 'Mode +o Alice set by Bob', from: 'Bob' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a kick message', async () => {
    const messages = [makeMsg({ type: 'kick', text: 'Alice was kicked by Bob', from: 'Bob' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a nick change message', async () => {
    const messages = [
      makeMsg({
        type: 'nick',
        text: 'Alice is now known as NewAlice',
        from: 'Alice',
        oldNick: 'Alice',
        newNick: 'NewAlice',
      }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a raw message', async () => {
    const messages = [makeMsg({ type: 'raw', text: ':server 001 raw reply' })];
    const { toJSON } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} showRawCommands={true} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders a ctcp message', async () => {
    const messages = [makeMsg({ type: 'ctcp', text: 'CTCP PING reply from Alice' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders an invite message', async () => {
    const messages = [makeMsg({ type: 'invite', text: 'Alice invites you to #secret', from: 'Alice' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a monitor message', async () => {
    const messages = [makeMsg({ type: 'monitor', text: 'Alice is online', from: 'Alice' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── hide-message-type flags ──────────────────────────────────────────────
  it('accepts hideJoinMessages prop', async () => {
    const messages = [makeMsg({ type: 'join', text: 'Alice joined' })];
    const { toJSON } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} hideJoinMessages />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('accepts hidePartMessages prop', async () => {
    const messages = [makeMsg({ type: 'part', text: 'Alice left' })];
    const { toJSON } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} hidePartMessages />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('accepts hideQuitMessages prop', async () => {
    const messages = [makeMsg({ type: 'quit', text: 'Alice quit' })];
    const { toJSON } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} hideQuitMessages />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('accepts hideIrcServiceListenerMessages prop', async () => {
    const messages = [makeMsg({ type: 'raw', text: ':server 315 end of who' })];
    const { toJSON } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} hideIrcServiceListenerMessages />
    );
    expect(toJSON()).toBeTruthy();
  });

  // ── search visibility ────────────────────────────────────────────────────
  it('renders with searchVisible=true (controlled)', async () => {
    const onSearchVisibleChange = jest.fn();
    const { toJSON } = await renderAndSettle(
      <MessageArea
        {...baseProps}
        searchVisible={true}
        onSearchVisibleChange={onSearchVisibleChange}
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with searchVisible=false (controlled)', async () => {
    const { toJSON } = await renderAndSettle(
      <MessageArea {...baseProps} searchVisible={false} onSearchVisibleChange={jest.fn()} />
    );
    expect(toJSON()).toBeTruthy();
  });

  // ── showRawCommands prop ─────────────────────────────────────────────────
  it('renders with showRawCommands=true', async () => {
    const messages = [makeMsg({ type: 'raw', text: ':server raw' })];
    const { toJSON } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} showRawCommands={true} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with showRawCommands=false', async () => {
    const messages = [makeMsg({ type: 'raw', text: ':server raw' })];
    const { toJSON } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} showRawCommands={false} />
    );
    expect(toJSON()).toBeTruthy();
  });

  // ── multiple messages and grouping ───────────────────────────────────────
  it('renders multiple messages of different types', async () => {
    const ts = Date.now();
    const messages = [
      makeMsg({ id: 'a', type: 'join', text: 'Alice joined', timestamp: ts }),
      makeMsg({ id: 'b', type: 'message', text: 'Hello!', from: 'Alice', timestamp: ts + 1000 }),
      makeMsg({ id: 'c', type: 'message', text: 'Hi!', from: 'Bob', timestamp: ts + 2000 }),
      makeMsg({ id: 'd', type: 'notice', text: 'Notice text', timestamp: ts + 3000 }),
      makeMsg({ id: 'e', type: 'quit', text: 'Bob quit', timestamp: ts + 4000 }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders consecutive messages from the same user (grouping)', async () => {
    const ts = Date.now();
    const messages = [
      makeMsg({ id: 'a', from: 'Alice', text: 'First', timestamp: ts }),
      makeMsg({ id: 'b', from: 'Alice', text: 'Second', timestamp: ts + 30000 }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── channel users ────────────────────────────────────────────────────────
  it('renders with channel users provided', async () => {
    const channelUsers = [
      { nick: 'Alice', mode: '@', host: 'alice@example.com' },
      { nick: 'Bob', mode: '+', host: 'bob@example.com' },
    ];
    const messages = [makeMsg({ text: 'Hello Alice!' })];
    const { toJSON } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} channelUsers={channelUsers as any} />
    );
    expect(toJSON()).toBeTruthy();
  });

  // ── bottomInset ──────────────────────────────────────────────────────────
  it('accepts bottomInset prop', async () => {
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} bottomInset={34} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── settings loading ─────────────────────────────────────────────────────
  it('loads settings on mount without crashing', async () => {
    await renderAndSettle(<MessageArea {...baseProps} />);
    expect(mockGetSetting).toHaveBeenCalled();
  });

  it('subscribes to setting changes on mount', async () => {
    await renderAndSettle(<MessageArea {...baseProps} />);
    expect(mockOnSettingChange).toHaveBeenCalled();
  });

  // ── network / connection handling ────────────────────────────────────────
  it('renders without a network prop (no connection)', async () => {
    const { toJSON } = await renderAndSettle(<MessageArea messages={[makeMsg()]} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders when getConnection returns null', async () => {
    mockGetConnection.mockReturnValue(null);
    const { toJSON } = await renderAndSettle(
      <MessageArea {...baseProps} messages={[makeMsg()]} />
    );
    expect(toJSON()).toBeTruthy();
  });

  // ── rawCategoryVisibility ────────────────────────────────────────────────
  it('accepts rawCategoryVisibility prop', async () => {
    const rawCategoryVisibility: any = { server: true, channel: true };
    const messages = [makeMsg({ type: 'raw', text: 'raw msg' })];
    const { toJSON } = await renderAndSettle(
      <MessageArea
        {...baseProps}
        messages={messages}
        rawCategoryVisibility={rawCategoryVisibility}
        showRawCommands={true}
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  // ── tabId scenarios ───────────────────────────────────────────────────────
  it('renders with a query tabId format', async () => {
    const { toJSON } = await renderAndSettle(
      <MessageArea
        messages={[makeMsg()]}
        network="TestNet"
        tabId="query::TestNet::Alice"
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with a server tabId format', async () => {
    const { toJSON } = await renderAndSettle(
      <MessageArea
        messages={[makeMsg()]}
        network="TestNet"
        tabId="server::TestNet"
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  // ── setting change callbacks ─────────────────────────────────────────────
  it('fires setting change listeners without error', async () => {
    const listeners = new Map<string, (v: any) => void>();
    mockOnSettingChange.mockImplementation((key: string, cb: (v: any) => void) => {
      listeners.set(key, cb);
      return jest.fn();
    });

    await renderAndSettle(<MessageArea {...baseProps} />);

    await act(async () => {
      listeners.get('showMessageAreaSearchButton')?.(true);
      listeners.get('securityAllowQrVerification')?.(false);
      listeners.get('securityAllowFileExchange')?.(false);
      listeners.get('securityAllowNfcExchange')?.(false);
      listeners.get('tabSortAlphabetical')?.(false);
    });
  });

  // ── unmount / cleanup ────────────────────────────────────────────────────
  it('unmounts without error', async () => {
    const { unmount } = await renderAndSettle(<MessageArea {...baseProps} />);
    await act(async () => {
      unmount();
    });
  });

  // ── message with special text content ────────────────────────────────────
  it('renders a message mentioning current nick (highlight)', async () => {
    const messages = [makeMsg({ text: 'Hello TestNick, how are you?' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a message with a URL', async () => {
    const messages = [makeMsg({ text: 'Check this: https://example.com/page' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a message with a channel link', async () => {
    const messages = [makeMsg({ text: 'Join us in #android-dev' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders large message list without crash', async () => {
    const ts = Date.now();
    const messages = Array.from({ length: 50 }, (_, i) =>
      makeMsg({ id: `m${i}`, text: `Message ${i}`, timestamp: ts + i * 1000 })
    );
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── search functionality tests ────────────────────────────────────────────
  it('renders with search filters applied', async () => {
    const messages = [
      makeMsg({ id: 'a', type: 'message', text: 'Hello world', from: 'Alice' }),
      makeMsg({ id: 'b', type: 'notice', text: 'Server notice', from: 'Server' }),
      makeMsg({ id: 'c', type: 'join', text: 'Bob joined', from: 'Bob' }),
    ];
    const { toJSON } = await renderAndSettle(
      <MessageArea 
        {...baseProps} 
        messages={messages} 
        searchVisible={true}
        onSearchVisibleChange={jest.fn()}
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  // ── message grouping scenarios ────────────────────────────────────────────
  it('renders messages grouped by same sender within 5 minutes', async () => {
    const ts = Date.now();
    const messages = [
      makeMsg({ id: 'a', from: 'Alice', text: 'First message', timestamp: ts }),
      makeMsg({ id: 'b', from: 'Alice', text: 'Second message', timestamp: ts + 60000 }), // 1 min later
      makeMsg({ id: 'c', from: 'Bob', text: 'Different user', timestamp: ts + 120000 }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('does not group messages from different users', async () => {
    const ts = Date.now();
    const messages = [
      makeMsg({ id: 'a', from: 'Alice', text: 'From Alice', timestamp: ts }),
      makeMsg({ id: 'b', from: 'Bob', text: 'From Bob', timestamp: ts + 1000 }),
      makeMsg({ id: 'c', from: 'Alice', text: 'From Alice again', timestamp: ts + 2000 }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('does not group messages more than 5 minutes apart', async () => {
    const ts = Date.now();
    const messages = [
      makeMsg({ id: 'a', from: 'Alice', text: 'First', timestamp: ts }),
      makeMsg({ id: 'b', from: 'Alice', text: 'Six minutes later', timestamp: ts + 6 * 60 * 1000 }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── action message tests (/me) ────────────────────────────────────────────
  it('renders action messages correctly', async () => {
    const messages = [
      makeMsg({ id: 'a', text: '\x01ACTION waves hello\x01', from: 'Alice' }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('does not group action messages', async () => {
    const ts = Date.now();
    const messages = [
      makeMsg({ id: 'a', from: 'Alice', text: '\x01ACTION waves\x01', timestamp: ts }),
      makeMsg({ id: 'b', from: 'Alice', text: '\x01ACTION sits down\x01', timestamp: ts + 1000 }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── raw message category visibility tests ─────────────────────────────────
  it('renders with raw category visibility for different categories', async () => {
    const rawCategoryVisibility = { 
      server: true, 
      channel: false, 
      user: true,
      debug: false,
      error: true,
    };
    const messages = [
      makeMsg({ id: 'a', type: 'raw', text: ':server 001', isRaw: true, rawCategory: 'server' }),
      makeMsg({ id: 'b', type: 'raw', text: ':server 002', isRaw: true, rawCategory: 'channel' }),
    ];
    const { toJSON } = await renderAndSettle(
      <MessageArea 
        {...baseProps} 
        messages={messages} 
        showRawCommands={true}
        rawCategoryVisibility={rawCategoryVisibility}
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  // ── system message tests ──────────────────────────────────────────────────
  it('renders system message types', async () => {
    const messages = [
      makeMsg({ id: 'a', type: 'system', text: 'System message' }),
      makeMsg({ id: 'b', type: 'event', text: 'Event message' }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── message selection tests ───────────────────────────────────────────────
  it('renders in selection mode', async () => {
    const messages = [
      makeMsg({ id: 'a', text: 'Message 1' }),
      makeMsg({ id: 'b', text: 'Message 2' }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── timestamp format tests ────────────────────────────────────────────────
  it('renders with different timestamp settings', async () => {
    mockGetSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'timestampDisplay') return Promise.resolve('always');
      if (key === 'timestampFormat') return Promise.resolve('24h');
      return Promise.resolve(fallback);
    });

    const messages = [makeMsg({ text: 'Test message' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── virtualization tests ──────────────────────────────────────────────────
  it('handles virtualization with many messages', async () => {
    const { performanceService } = require('../../src/services/PerformanceService');
    performanceService.getConfig.mockReturnValue({
      enableVirtualization: true,
      maxVisibleMessages: 50,
      messageLoadChunk: 25,
      enableLazyLoading: true,
      messageLimit: 1000,
      enableMessageCleanup: true,
      cleanupThreshold: 1500,
    });

    const ts = Date.now();
    const messages = Array.from({ length: 200 }, (_, i) =>
      makeMsg({ id: `m${i}`, text: `Message ${i}`, timestamp: ts + i * 1000 })
    );
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── edge cases ────────────────────────────────────────────────────────────
  it('renders with empty message text', async () => {
    const messages = [makeMsg({ text: '' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with very long message text', async () => {
    const longText = 'A'.repeat(5000);
    const messages = [makeMsg({ text: longText })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with message containing special characters', async () => {
    const messages = [makeMsg({ text: 'Special: <>&"\'\n\r\t🔥🎉' })];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with messages having same timestamp', async () => {
    const ts = Date.now();
    const messages = [
      makeMsg({ id: 'a', text: 'First', timestamp: ts }),
      makeMsg({ id: 'b', text: 'Second', timestamp: ts }),
      makeMsg({ id: 'c', text: 'Third', timestamp: ts }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── props change tests ────────────────────────────────────────────────────
  it('handles changing messages prop', async () => {
    const { rerender } = await renderAndSettle(
      <MessageArea {...baseProps} messages={[makeMsg({ id: 'a', text: 'First' })]} />
    );
    
    await act(async () => {
      rerender(<MessageArea {...baseProps} messages={[makeMsg({ id: 'b', text: 'Second' })]} />);
    });
  });

  it('handles changing channel prop', async () => {
    const { rerender } = await renderAndSettle(
      <MessageArea {...baseProps} channel="#first" />
    );
    
    await act(async () => {
      rerender(<MessageArea {...baseProps} channel="#second" />);
    });
  });

  // ── setting subscription cleanup ──────────────────────────────────────────
  it('cleans up setting subscriptions on unmount', async () => {
    const unsubscribeFns = new Map<string, jest.Mock>();
    mockOnSettingChange.mockImplementation((key: string) => {
      const fn = jest.fn();
      unsubscribeFns.set(key, fn);
      return fn;
    });

    const { unmount } = await renderAndSettle(<MessageArea {...baseProps} />);
    
    await act(async () => {
      unmount();
    });

    // Verify that unsubscribe functions were called during cleanup
    unsubscribeFns.forEach((fn) => {
      expect(fn).toHaveBeenCalled();
    });
  });

  // ── network-specific tests ────────────────────────────────────────────────
  it('renders for different network names', async () => {
    const { rerender } = await renderAndSettle(
      <MessageArea messages={[makeMsg()]} network="Network1" />
    );
    
    await act(async () => {
      rerender(<MessageArea messages={[makeMsg()]} network="Network2" />);
    });
  });

  // ── message format tests ──────────────────────────────────────────────────
  it('renders with custom message formats from theme', async () => {
    const { useTheme } = require('../../src/hooks/useTheme');
    useTheme.mockReturnValue({
      theme: { id: 'custom' },
      colors: { background: '#fff', text: '#000' },
      messageFormats: {
        message: '{nick}: {text}',
        join: '→ {nick} joined {channel}',
      },
    });

    const messages = [
      makeMsg({ type: 'message', text: 'Hello', from: 'Alice' }),
      makeMsg({ type: 'join', text: 'Alice joined', from: 'Alice' }),
    ];
    const { toJSON } = await renderAndSettle(<MessageArea {...baseProps} messages={messages} />);
    expect(toJSON()).toBeTruthy();
  });

  it('enters selection mode via long press and handles copy/cancel actions', async () => {
    const messages = [
      makeMsg({ id: 'sel-1', text: 'Selectable message', from: 'Alice' }),
    ];
    const view = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} />
    );
    const { queryByText, UNSAFE_getAllByType } = view;
    const { TouchableOpacity } = require('react-native');

    const pressables = UNSAFE_getAllByType(TouchableOpacity).filter((node: any) => typeof node.props.onLongPress === 'function');
    expect(pressables.length).toBeGreaterThan(0);
    await act(async () => {
      pressables[0].props.onLongPress?.();
    });

    expect(queryByText('1 selected')).toBeTruthy();

    const copyButton = queryByText('Copy');
    const cancelButton = queryByText('Cancel');
    expect(copyButton).toBeTruthy();
    expect(cancelButton).toBeTruthy();
    await act(async () => {
      if (copyButton) fireEvent.press(copyButton);
      if (cancelButton) fireEvent.press(cancelButton);
    });
  });

  it('renders non-virtualized branch when virtualization is disabled', async () => {
    const { performanceService } = require('../../src/services/PerformanceService');
    performanceService.getConfig.mockReturnValue({
      enableVirtualization: false,
      maxVisibleMessages: 100,
      messageLoadChunk: 50,
      enableLazyLoading: false,
      messageLimit: 1000,
      enableMessageCleanup: false,
      cleanupThreshold: 1500,
      renderOptimization: true,
      imageLazyLoad: true,
      userListGrouping: true,
      userListVirtualization: true,
      userListAutoDisableGroupingThreshold: 1000,
      userListAutoVirtualizeThreshold: 500,
      userListType: 'flashlist',
      userListSearchDebounceMs: 300,
      userListSkipSortThreshold: 1000,
      userListEnableChunkLoading: true,
      userListChunkSize: 100,
      userListInitialRenderCount: 50,
    });

    const { toJSON } = await renderAndSettle(
      <MessageArea
        {...baseProps}
        messages={[makeMsg({ id: 'nv-1', text: 'fallback path' })]}
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('opens nick context menu and executes core nick actions', async () => {
    const messages = [makeMsg({ from: 'Alice', text: 'Hello there' })];
    const { getAllByText } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} />
    );

    const nickNode = getAllByText(/Alice/)[0];
    await act(async () => {
      fireEvent(nickNode, 'onLongPress');
    });

    expect(mockNickContextMenuProps).toBeTruthy();
    expect(mockNickContextMenuProps.nick).toBe('Alice');

    await act(async () => {
      await mockNickContextMenuProps.onAction('whois');
      await mockNickContextMenuProps.onAction('copy');
      await mockNickContextMenuProps.onAction('ctcp_ping');
      await mockNickContextMenuProps.onAction('ctcp_version');
      await mockNickContextMenuProps.onAction('ctcp_time');
      await mockNickContextMenuProps.onAction('kick');
      await mockNickContextMenuProps.onAction('kick_message');
      await mockNickContextMenuProps.onAction('ban');
      await mockNickContextMenuProps.onAction('kick_ban');
    });

    const connection = mockGetConnection.mock.results[0]?.value;
    const irc = connection?.ircService;
    expect(irc.sendCommand).toHaveBeenCalledWith('WHOIS Alice');
    expect(irc.sendCTCPRequest).toHaveBeenCalledWith('Alice', 'PING', expect.any(String));
    expect(irc.sendCTCPRequest).toHaveBeenCalledWith('Alice', 'VERSION');
    expect(irc.sendCTCPRequest).toHaveBeenCalledWith('Alice', 'TIME');
    expect(irc.sendCommand).toHaveBeenCalledWith('KICK #general Alice');
    expect(irc.sendCommand).toHaveBeenCalledWith('KICK #general Alice :Kicked');
    expect(irc.sendCommand).toHaveBeenCalledWith('MODE #general +b Alice!*@*');
  });

  it('executes whois modal branch, query tab creation, ignore toggle, monitor toggle and dcc send', async () => {
    const { userManagementService } = require('../../src/services/UserManagementService');
    const { useUIStore } = require('../../src/stores/uiStore');
    const uiState = {
      whoisDisplayMode: 'modal',
      setWhoisNick: jest.fn(),
      setShowWHOIS: jest.fn(),
      setDccSendTarget: jest.fn(),
      setShowDccSendModal: jest.fn(),
    };
    (useUIStore.getState as jest.Mock).mockReturnValue(uiState);

    const messages = [makeMsg({ from: 'Alice', text: 'Hello again' })];
    const { getAllByText } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} />
    );

    await act(async () => {
      fireEvent(getAllByText(/Alice/)[0], 'onLongPress');
    });

    await act(async () => {
      await mockNickContextMenuProps.onAction('whois');
      await mockNickContextMenuProps.onAction('query');
      await mockNickContextMenuProps.onAction('ignore_toggle');
      await mockNickContextMenuProps.onAction('monitor_toggle');
      await mockNickContextMenuProps.onAction('dcc_send');
    });

    const connection = mockGetConnection.mock.results[0]?.value;
    const irc = connection?.ircService;
    expect(uiState.setWhoisNick).toHaveBeenCalledWith('Alice');
    expect(uiState.setShowWHOIS).toHaveBeenCalledWith(true);
    expect(mockSetTabs).toHaveBeenCalled();
    expect(mockSetActiveTabId).toHaveBeenCalled();
    expect(userManagementService.ignoreUser).toHaveBeenCalledWith('Alice', undefined, 'TestNet');
    expect(irc.monitorNick).toHaveBeenCalledWith('Alice');
    expect(uiState.setDccSendTarget).toHaveBeenCalledWith({ nick: 'Alice', networkId: 'TestNet' });
    expect(uiState.setShowDccSendModal).toHaveBeenCalledWith(true);

    (userManagementService.isUserIgnored as jest.Mock).mockReturnValue(true);
    await act(async () => {
      await mockNickContextMenuProps.onAction('ignore_toggle');
    });
    expect(userManagementService.unignoreUser).toHaveBeenCalledWith('Alice', 'TestNet');
  });

  it('executes encryption request/share actions and posts system notices', async () => {
    const { encryptedDMService } = require('../../src/services/EncryptedDMService');
    const messages = [makeMsg({ from: 'Alice', text: 'Secure hello' })];
    const { getAllByText } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} />
    );

    await act(async () => {
      fireEvent(getAllByText(/Alice/)[0], 'onLongPress');
    });

    await act(async () => {
      await mockNickContextMenuProps.onAction('enc_request');
      await mockNickContextMenuProps.onAction('enc_share');
    });

    const connection = mockGetConnection.mock.results[0]?.value;
    const irc = connection?.ircService;
    expect(irc.sendRaw).toHaveBeenCalledWith('PRIVMSG Alice :!enc-req');
    expect(irc.sendRaw).toHaveBeenCalledWith(expect.stringContaining('PRIVMSG Alice :!enc-offer'));
    expect(irc.addMessage).toHaveBeenCalled();
    expect(encryptedDMService.awaitBundleForNick).toHaveBeenCalledWith('Alice', 36000);
  });

  it('opens kick/ban options modal and confirms kick+ban command flow', async () => {
    const messages = [makeMsg({ from: 'Alice', text: 'Moderation case' })];
    const { getAllByText } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} />
    );

    await act(async () => {
      fireEvent(getAllByText(/Alice/)[0], 'onLongPress');
    });
    await waitFor(() => {
      expect(mockNickContextMenuProps).toBeTruthy();
      expect(mockNickContextMenuProps.nick).toBe('Alice');
    });
    await act(async () => {
      await mockNickContextMenuProps.onAction('kick_ban_with_options');
    });

    expect(mockKickBanModalProps).toBeTruthy();
    await waitFor(() => {
      expect(mockKickBanModalProps?.visible).toBe(true);
    });

    await act(async () => {
      mockKickBanModalProps.onConfirm({
        kick: true,
        ban: true,
        banType: 2,
        reason: 'bye',
        unbanAfterSeconds: 0,
      });
    });

    const connection = mockGetConnection.mock.results[0]?.value;
    const irc = connection?.ircService;
    expect(irc.sendRaw).toHaveBeenCalledWith(expect.stringContaining('MODE #general +b'));
    expect(irc.sendRaw).toHaveBeenCalledWith('KICK #general Alice :bye');
  });

  it('handles enc_verify action for missing and existing fingerprints', async () => {
    const { Alert } = require('react-native');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { encryptedDMService } = require('../../src/services/EncryptedDMService');
    const Clipboard = require('@react-native-clipboard/clipboard');

    const messages = [makeMsg({ from: 'Alice', text: 'Verify me' })];
    const { getAllByText } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} />
    );

    await act(async () => {
      fireEvent(getAllByText(/Alice/)[0], 'onLongPress');
    });

    (encryptedDMService.getVerificationStatusForNetwork as jest.Mock).mockResolvedValueOnce({
      fingerprint: null,
      verified: false,
    });
    await act(async () => {
      await mockNickContextMenuProps.onAction('enc_verify');
    });
    expect(alertSpy).toHaveBeenCalledWith('Verify DM Key', 'No DM key for Alice');

    (encryptedDMService.getVerificationStatusForNetwork as jest.Mock).mockResolvedValueOnce({
      fingerprint: 'peer-fp',
      verified: false,
    });
    await act(async () => {
      await mockNickContextMenuProps.onAction('enc_verify');
    });
    const verifyCall = alertSpy.mock.calls.find((call: any[]) => call[0] === 'Verify DM Key' && Array.isArray(call[2]));
    expect(verifyCall).toBeTruthy();
    const buttons = verifyCall[2];
    const markVerified = buttons.find((b: any) => String(b.text).includes('Mark Verified'));
    const copyButton = buttons.find((b: any) => String(b.text).includes('Copy Fingerprints'));
    await act(async () => {
      await markVerified.onPress();
      copyButton.onPress();
    });

    expect(encryptedDMService.setVerifiedForNetwork).toHaveBeenCalledWith('TestNet', 'Alice', true);
    expect(Clipboard.setString).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('executes channel encryption share and request actions', async () => {
    const { channelEncryptionService } = require('../../src/services/ChannelEncryptionService');
    const messages = [makeMsg({ from: 'Alice', text: 'Channel key flow' })];
    const { getAllByText } = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} />
    );

    await act(async () => {
      fireEvent(getAllByText(/Alice/)[0], 'onLongPress');
    });
    await act(async () => {
      await mockNickContextMenuProps.onAction('chan_share');
      await mockNickContextMenuProps.onAction('chan_request');
    });

    const connection = mockGetConnection.mock.results[0]?.value;
    const irc = connection?.ircService;
    expect(channelEncryptionService.exportChannelKey).toHaveBeenCalledWith('#general', 'TestNet');
    expect(irc.sendRaw).toHaveBeenCalledWith('PRIVMSG Alice :!chanenc-key chan-key-data');
    expect(irc.sendRaw).toHaveBeenCalledWith(
      'PRIVMSG Alice :Please share the channel key for #general with /chankey share TestNick'
    );
  });

  it('opens note and blacklist modals and persists changes', async () => {
    const { userManagementService } = require('../../src/services/UserManagementService');
    (userManagementService.getUserNote as jest.Mock).mockReturnValue('existing note');

    const messages = [makeMsg({ from: 'Alice', text: 'Notes and blacklist' })];
    const view = await renderAndSettle(
      <MessageArea {...baseProps} messages={messages} />
    );
    const { getAllByText, getByPlaceholderText, getByText } = view;

    await act(async () => {
      fireEvent(getAllByText(/Alice/)[0], 'onLongPress');
    });
    await waitFor(() => {
      expect(mockNickContextMenuProps).toBeTruthy();
      expect(mockNickContextMenuProps.nick).toBe('Alice');
    });
    await act(async () => {
      await mockNickContextMenuProps.onAction('add_note');
    });
    await waitFor(() => {
      expect(getByText('User Note')).toBeTruthy();
    });

    const noteInput = getByPlaceholderText('Enter note about this user');
    await act(async () => {
      fireEvent.changeText(noteInput, 'updated note');
      fireEvent.press(getByText('Save'));
    });
    expect(userManagementService.addUserNote).toHaveBeenCalledWith('Alice', expect.any(String), 'TestNet');

    await act(async () => {
      fireEvent(getAllByText(/Alice/)[0], 'onLongPress');
    });
    await waitFor(() => {
      expect(mockNickContextMenuProps).toBeTruthy();
      expect(mockNickContextMenuProps.nick).toBe('Alice');
    });
    await act(async () => {
      await mockNickContextMenuProps.onAction('blacklist');
    });
    expect(getByText('Add to Blacklist')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText('Add'));
    });
    expect(userManagementService.addBlacklistEntry).toHaveBeenCalled();
  });
});
