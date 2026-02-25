/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useUIState hook
 */

import { renderHook } from '@testing-library/react-hooks';
import { useUIState } from '../../src/hooks/useUIState';

// Mock all Zustand stores
const mockConnectionState = {
  isConnected: true,
  networkName: 'TestNetwork',
  activeConnectionId: 'conn-1',
  primaryNetworkId: 'net-1',
  ping: 42,
};

const mockTabState = {
  tabs: [{ id: 'server::TestNetwork', name: 'TestNetwork', type: 'server' }],
  activeTabId: 'server::TestNetwork',
};

const mockUIState = {
  showFirstRunSetup: false,
  isCheckingFirstRun: false,
  showRawCommands: false,
  rawCategoryVisibility: {},
  showTypingIndicators: true,
  hideJoinMessages: false,
  hidePartMessages: false,
  hideQuitMessages: false,
  hideIrcServiceListenerMessages: true,
  appLockEnabled: false,
  appLockUseBiometric: false,
  appLockAutoBiometricPrompt: false,
  appLockUsePin: false,
  appLockOnLaunch: false,
  appLockOnBackground: false,
  appLocked: false,
  appUnlockModalVisible: false,
  appPinEntry: '',
  appPinError: '',
  bannerVisible: false,
  scriptingTimeMs: 0,
  adFreeTimeMs: 0,
  showChannelModal: false,
  channelName: '',
  showNetworksList: false,
  showSettings: false,
  showPurchaseScreen: false,
  showIgnoreList: false,
  showBlacklist: false,
  showWHOIS: false,
  whoisNick: '',
  showQueryEncryptionMenu: false,
  showChannelList: false,
  showUserList: false,
  showChannelSettings: false,
  channelSettingsTarget: '',
  channelSettingsNetwork: '',
  showOptionsMenu: false,
  showRenameModal: false,
  renameTargetTabId: '',
  renameValue: '',
  showTabOptionsModal: false,
  tabOptionsTitle: '',
  tabOptions: [],
  showChannelNoteModal: false,
  channelNoteTarget: '',
  channelNoteValue: '',
  showChannelLogModal: false,
  channelLogEntries: [],
  prefillMessage: '',
  showDccTransfers: false,
  dccTransfersMinimized: false,
  showDccSendModal: false,
  dccSendTarget: '',
  dccSendPath: '',
  showHelpConnection: false,
  showHelpCommands: false,
  showHelpEncryption: false,
  showHelpMedia: false,
  showHelpChannelManagement: false,
  showHelpTroubleshooting: false,
};

const mockMessageState = {
  typingUsers: {},
};

jest.mock('../../src/stores/connectionStore', () => ({
  useConnectionStore: (selector: any) => selector(mockConnectionState),
}));

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: (selector: any) => selector(mockTabState),
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: (selector: any) => selector(mockUIState),
}));

jest.mock('../../src/stores/messageStore', () => ({
  useMessageStore: (selector: any) => selector(mockMessageState),
}));

describe('useUIState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return connection state', () => {
    const { result } = renderHook(() => useUIState());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.networkName).toBe('TestNetwork');
    expect(result.current.activeConnectionId).toBe('conn-1');
    expect(result.current.primaryNetworkId).toBe('net-1');
    expect(result.current.ping).toBe(42);
  });

  it('should return tab state', () => {
    const { result } = renderHook(() => useUIState());

    expect(result.current.tabs).toEqual(mockTabState.tabs);
    expect(result.current.activeTabId).toBe('server::TestNetwork');
  });

  it('should return UI visibility state', () => {
    const { result } = renderHook(() => useUIState());

    expect(result.current.showFirstRunSetup).toBe(false);
    expect(result.current.isCheckingFirstRun).toBe(false);
    expect(result.current.showRawCommands).toBe(false);
    expect(result.current.showTypingIndicators).toBe(true);
    expect(result.current.hideJoinMessages).toBe(false);
    expect(result.current.hidePartMessages).toBe(false);
    expect(result.current.hideQuitMessages).toBe(false);
    expect(result.current.hideIrcServiceListenerMessages).toBe(true);
  });

  it('should return message state', () => {
    const { result } = renderHook(() => useUIState());

    expect(result.current.typingUsers).toEqual({});
  });

  it('should return app lock state', () => {
    const { result } = renderHook(() => useUIState());

    expect(result.current.appLockEnabled).toBe(false);
    expect(result.current.appLockUseBiometric).toBe(false);
    expect(result.current.appLockAutoBiometricPrompt).toBe(false);
    expect(result.current.appLockUsePin).toBe(false);
    expect(result.current.appLockOnLaunch).toBe(false);
    expect(result.current.appLockOnBackground).toBe(false);
    expect(result.current.appLocked).toBe(false);
    expect(result.current.appUnlockModalVisible).toBe(false);
    expect(result.current.appPinEntry).toBe('');
    expect(result.current.appPinError).toBe('');
  });

  it('should return banner/ad state', () => {
    const { result } = renderHook(() => useUIState());

    expect(result.current.bannerVisible).toBe(false);
    expect(result.current.scriptingTimeMs).toBe(0);
    expect(result.current.adFreeTimeMs).toBe(0);
  });

  it('should return modal states', () => {
    const { result } = renderHook(() => useUIState());

    expect(result.current.showChannelModal).toBe(false);
    expect(result.current.channelName).toBe('');
    expect(result.current.showNetworksList).toBe(false);
    expect(result.current.showSettings).toBe(false);
    expect(result.current.showPurchaseScreen).toBe(false);
    expect(result.current.showIgnoreList).toBe(false);
    expect(result.current.showBlacklist).toBe(false);
    expect(result.current.showWHOIS).toBe(false);
    expect(result.current.whoisNick).toBe('');
    expect(result.current.showQueryEncryptionMenu).toBe(false);
    expect(result.current.showChannelList).toBe(false);
    expect(result.current.showUserList).toBe(false);
    expect(result.current.showChannelSettings).toBe(false);
    expect(result.current.showOptionsMenu).toBe(false);
  });

  it('should return rename modal state', () => {
    const { result } = renderHook(() => useUIState());

    expect(result.current.showRenameModal).toBe(false);
    expect(result.current.renameTargetTabId).toBe('');
    expect(result.current.renameValue).toBe('');
  });

  it('should return DCC state', () => {
    const { result } = renderHook(() => useUIState());

    expect(result.current.showDccTransfers).toBe(false);
    expect(result.current.dccTransfersMinimized).toBe(false);
    expect(result.current.showDccSendModal).toBe(false);
    expect(result.current.dccSendTarget).toBe('');
    expect(result.current.dccSendPath).toBe('');
  });

  it('should return help modal states', () => {
    const { result } = renderHook(() => useUIState());

    expect(result.current.showHelpConnection).toBe(false);
    expect(result.current.showHelpCommands).toBe(false);
    expect(result.current.showHelpEncryption).toBe(false);
    expect(result.current.showHelpMedia).toBe(false);
    expect(result.current.showHelpChannelManagement).toBe(false);
    expect(result.current.showHelpTroubleshooting).toBe(false);
  });

  it('should reflect updated connection state', () => {
    mockConnectionState.isConnected = false;
    mockConnectionState.networkName = 'OtherNetwork';
    mockConnectionState.ping = 100;

    const { result } = renderHook(() => useUIState());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.networkName).toBe('OtherNetwork');
    expect(result.current.ping).toBe(100);

    // Restore
    mockConnectionState.isConnected = true;
    mockConnectionState.networkName = 'TestNetwork';
    mockConnectionState.ping = 42;
  });

  it('should reflect updated UI state', () => {
    mockUIState.showSettings = true;
    mockUIState.appLocked = true;

    const { result } = renderHook(() => useUIState());

    expect(result.current.showSettings).toBe(true);
    expect(result.current.appLocked).toBe(true);

    // Restore
    mockUIState.showSettings = false;
    mockUIState.appLocked = false;
  });
});
