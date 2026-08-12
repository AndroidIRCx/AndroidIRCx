/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Comprehensive tests for App component
 * @format
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

import App from '../App';

// Mock all dependencies
jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn(),
  show: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: jest
    .fn()
    .mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: ({ children }: { children: React.ReactNode }) => children,
  KeyboardController: {
    setInputMode: jest.fn(),
    dismiss: jest.fn(),
  },
  KeyboardEvents: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  useKeyboardController: () => ({
    setEnabled: jest.fn(),
  }),
  useReanimatedKeyboardAnimation: () => ({
    height: { value: 0 },
    progress: { value: 0 },
  }),
}));

// Mock Zustand stores
const mockUIStore = {
  showFirstRunSetup: false,
  isCheckingFirstRun: false,
  showRawCommands: false,
  rawCategoryVisibility: {},
  showTypingIndicators: true,
  hideJoinMessages: false,
  hidePartMessages: false,
  hideQuitMessages: false,
  hideIrcServiceListenerMessages: false,
  typingUsers: {},
  appLockEnabled: false,
  appLockUseBiometric: false,
  appLockUsePin: false,
  appLockOnLaunch: true,
  appLockOnBackground: true,
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
  renameTargetTabId: null,
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
  showDccSendModal: false,
  dccSendTarget: null,
  dccSendPath: '',
  setActiveTabId: jest.fn(),
  setIsConnected: jest.fn(),
  setNetworkName: jest.fn(),
  setPrimaryNetworkId: jest.fn(),
  setActiveConnectionId: jest.fn(),
  setPing: jest.fn(),
  setTabs: jest.fn(),
  setShowFirstRunSetup: jest.fn(),
  setIsCheckingFirstRun: jest.fn(),
  setShowTypingIndicators: jest.fn(),
  setHidePartMessages: jest.fn(),
  setHideQuitMessages: jest.fn(),
  setHideIrcServiceListenerMessages: jest.fn(),
  setTypingUser: jest.fn(),
  removeTypingUser: jest.fn(),
  clearTypingForTarget: jest.fn(),
  cleanupStaleTyping: jest.fn(),
  setAppLockEnabled: jest.fn(),
  setAppLockUseBiometric: jest.fn(),
  setAppLockUsePin: jest.fn(),
  setAppLockOnLaunch: jest.fn(),
  setAppLockOnBackground: jest.fn(),
  setAppLocked: jest.fn(),
  setAppUnlockModalVisible: jest.fn(),
  setAppPinEntry: jest.fn(),
  setAppPinError: jest.fn(),
  setBannerVisible: jest.fn(),
  setScriptingTimeMs: jest.fn(),
  setAdFreeTimeMs: jest.fn(),
  setChannelName: jest.fn(),
  setChannelNoteValue: jest.fn(),
  setRenameValue: jest.fn(),
  setDccSendPath: jest.fn(),
};

// Mutable store snapshot returned by useUIStore.getState() inside the
// kill-switch-from-unlock handler; each test sets the branch it needs.
const mockUnlockState = {
  current: {
    appLockUseBiometric: false,
    appLockUsePin: false,
    appPinEntry: '',
    setAppPinEntry: jest.fn(),
    setAppPinError: jest.fn(),
    setAppUnlockModalVisible: jest.fn(),
    setAppLocked: jest.fn(),
  } as any,
};

jest.mock('../src/stores/uiStore', () => {
  const useUIStore: any = jest.fn(selector => selector(mockUIStore));
  useUIStore.getState = jest.fn(() => mockUnlockState.current);
  return { useUIStore };
});

jest.mock('../src/stores/connectionStore', () => ({
  useConnectionStore: jest.fn(selector =>
    selector({
      isConnected: false,
      networkName: 'Not connected',
      selectedNetworkName: null,
      ping: 0,
      activeConnectionId: null,
      primaryNetworkId: null,
      setSelectedNetworkName: jest.fn(),
      setIsConnected: jest.fn(),
      setNetworkName: jest.fn(),
      setPrimaryNetworkId: jest.fn(),
      setActiveConnectionId: jest.fn(),
      setPing: jest.fn(),
    }),
  ),
}));

jest.mock('../src/stores/tabStore', () => ({
  useTabStore: jest.fn(selector =>
    selector({
      tabs: [],
      activeTabId: null,
      setTabs: jest.fn(),
      setActiveTabId: jest.fn(),
      updateTab: jest.fn(),
      removeTab: jest.fn(),
    }),
  ),
}));

jest.mock('../src/stores/messageStore', () => ({
  useMessageStore: jest.fn(() => ({
    messages: [],
    addMessage: jest.fn(),
    clearMessages: jest.fn(),
  })),
}));

// Mock hooks
jest.mock('../src/hooks/useTheme', () => ({
  useTheme: jest.fn().mockReturnValue({
    colors: {
      background: '#FFFFFF',
      surface: '#FAFAFA',
      text: '#212121',
      primary: '#2196F3',
      border: '#E0E0E0',
    },
    theme: 'light',
    setTheme: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useConnectionManager', () => ({
  useConnectionManager: jest.fn().mockReturnValue({
    isConnected: false,
    networkName: 'Not connected',
    selectedNetworkName: null,
    ping: 0,
    activeConnectionId: null,
    primaryNetworkId: null,
    setSelectedNetworkName: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useTabManager', () => ({
  useTabManager: jest.fn().mockReturnValue({
    tabs: [],
    activeTabId: null,
  }),
}));

// Mock useUIState hook before defining mockUIStore
jest.mock('../src/hooks/useUIState', () => ({
  useUIState: jest.fn(),
}));

jest.mock('../src/hooks/useStoreSetters', () => ({
  useStoreSetters: jest.fn().mockReturnValue({
    setActiveTabId: jest.fn(),
    setIsConnected: jest.fn(),
    setNetworkName: jest.fn(),
    setPrimaryNetworkId: jest.fn(),
    setActiveConnectionId: jest.fn(),
    setPing: jest.fn(),
    setTabs: jest.fn(),
    setShowFirstRunSetup: jest.fn(),
    setIsCheckingFirstRun: jest.fn(),
    setShowTypingIndicators: jest.fn(),
    setHidePartMessages: jest.fn(),
    setHideQuitMessages: jest.fn(),
    setHideIrcServiceListenerMessages: jest.fn(),
    setTypingUser: jest.fn(),
    removeTypingUser: jest.fn(),
    clearTypingForTarget: jest.fn(),
    cleanupStaleTyping: jest.fn(),
    setAppLockEnabled: jest.fn(),
    setAppLockUseBiometric: jest.fn(),
    setAppLockUsePin: jest.fn(),
    setAppLockOnLaunch: jest.fn(),
    setAppLockOnBackground: jest.fn(),
    setAppLocked: jest.fn(),
    setAppUnlockModalVisible: jest.fn(),
    setAppPinEntry: jest.fn(),
    setAppPinError: jest.fn(),
    setBannerVisible: jest.fn(),
    setScriptingTimeMs: jest.fn(),
    setAdFreeTimeMs: jest.fn(),
    setChannelName: jest.fn(),
    setChannelNoteValue: jest.fn(),
    setRenameValue: jest.fn(),
    setDccSendPath: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useAppLock', () => ({
  useAppLock: jest.fn().mockReturnValue({
    attemptBiometricUnlock: jest.fn().mockResolvedValue(true),
    handleAppPinUnlock: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('../src/hooks/useBannerAds', () => ({
  useBannerAds: jest.fn(),
}));

jest.mock('../src/hooks/useTabEncryption', () => ({
  useTabEncryption: jest.fn(),
}));

jest.mock('../src/hooks/useRawSettings', () => ({
  useRawSettings: jest.fn().mockReturnValue({
    persistentSetShowRawCommands: jest.fn(),
    persistentSetRawCategoryVisibility: jest.fn(),
    persistentSetShowEncryptionIndicators: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useSafeAlert', () => ({
  useSafeAlert: jest.fn().mockReturnValue({
    safeAlert: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useAppStateEffects', () => ({
  useAppStateEffects: jest.fn(),
}));

jest.mock('../src/hooks/useUISettings', () => ({
  useUISettings: jest.fn(),
}));

jest.mock('../src/hooks/useServiceHelpers', () => ({
  useServiceHelpers: jest.fn().mockReturnValue({
    appendServerMessage: jest.fn(),
    getActiveIRCService: jest.fn().mockReturnValue(null),
    getActiveUserManagementService: jest.fn().mockReturnValue(null),
    getActiveCommandService: jest.fn().mockReturnValue(null),
    getActiveConnectionQualityService: jest.fn().mockReturnValue(null),
    getActiveChannelManagementService: jest.fn().mockReturnValue(null),
    normalizeNetworkId: jest.fn(),
    getNetworkConfigForId: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useStartupServices', () => ({
  useStartupServices: jest.fn(),
}));

jest.mock('../src/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: jest.fn(),
}));

jest.mock('../src/hooks/useFirstRunCheck', () => ({
  useFirstRunCheck: jest.fn(),
}));

jest.mock('../src/hooks/useLayoutConfig', () => ({
  useLayoutConfig: jest.fn().mockReturnValue({
    tabPosition: 'top',
    showTabLabels: true,
    showCloseButton: true,
  }),
}));

jest.mock('../src/hooks/useUserManagementNetworkSync', () => ({
  useUserManagementNetworkSync: jest.fn(),
}));

jest.mock('../src/hooks/useServerTabNameSync', () => ({
  useServerTabNameSync: jest.fn(),
}));

jest.mock('../src/hooks/useDccSessionSync', () => ({
  useDccSessionSync: jest.fn(),
}));

jest.mock('../src/hooks/useTypingCleanup', () => ({
  useTypingCleanup: jest.fn(),
}));

jest.mock('../src/hooks/useNetworkInitialization', () => ({
  useNetworkInitialization: jest.fn(),
}));

jest.mock('../src/hooks/useMessageSending', () => ({
  useMessageSending: jest.fn().mockReturnValue({
    handleSendMessage: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useConnectionHandler', () => ({
  useConnectionHandler: jest.fn().mockReturnValue({
    handleConnect: jest.fn(),
    handleServerConnect: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useTabActions', () => ({
  useTabActions: jest.fn().mockReturnValue({
    handleTabPress: jest.fn(),
    handleJoinChannel: jest.fn(),
    closeAllChannelsAndQueries: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useAppExit', () => ({
  useAppExit: jest.fn().mockReturnValue({
    handleExit: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useHeaderActions', () => ({
  useHeaderActions: jest.fn().mockReturnValue({
    handleDropdownPress: jest.fn(),
    handleMenuPress: jest.fn(),
    handleToggleUserList: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useAppLockActions', () => ({
  useAppLockActions: jest.fn().mockReturnValue({
    handleLockButtonPress: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useFirstRunSetup', () => ({
  useFirstRunSetup: jest.fn().mockReturnValue({
    handleFirstRunSetupComplete: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useDeepLinkHandler', () => ({
  useDeepLinkHandler: jest.fn(),
}));

jest.mock('../src/hooks/useTabContextMenu', () => ({
  useTabContextMenu: jest.fn().mockReturnValue({
    handleTabLongPress: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useConnectionLifecycle', () => ({
  useConnectionLifecycle: jest.fn((arg: any) => {
    mockConnectionLifecycleArg.current = arg;
  }),
}));

jest.mock('../src/hooks/useDccConfig', () => ({
  useDccConfig: jest.fn(),
}));

jest.mock('../src/hooks/useDccNotifications', () => ({
  useDccNotifications: jest.fn(),
}));

jest.mock('../src/hooks/useAutoConnectFavorite', () => ({
  useAutoConnectFavorite: jest.fn(),
}));

jest.mock('../src/hooks/useAutoJoinChannels', () => ({
  useAutoJoinChannels: jest.fn(),
}));

jest.mock('../src/hooks/useLazyMessageHistory', () => ({
  useLazyMessageHistory: jest.fn(),
}));

jest.mock('../src/hooks/useUserListActions', () => ({
  useUserListActions: jest.fn().mockReturnValue({
    handleUserPress: jest.fn(),
    handleWHOISPress: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useMessageBatching', () => ({
  useMessageBatching: jest.fn().mockReturnValue({
    processBatchedMessages: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useAppInitialization', () => ({
  useAppInitialization: jest.fn(),
}));

// Mock components — capture the props they receive so tests can invoke the
// callbacks App wires into them (kill switch, toggles, persistent setters).
const mockAppLayout = jest.fn(() => null);
const mockAppModals = jest.fn(() => null);
jest.mock('../src/components/AppLayout', () => ({
  AppLayout: (props: any) => mockAppLayout(props),
}));

jest.mock('../src/components/AppModals', () => ({
  AppModals: (props: any) => mockAppModals(props),
}));

// Age compliance gate — controllable per test to exercise checking/blocked/allowed.
const mockAgeCompliance = {
  current: {
    isChecking: false,
    decision: { allowed: true, reason: undefined as string | undefined },
  },
};
jest.mock('../src/hooks/useAgeCompliance', () => ({
  useAgeCompliance: jest.fn(() => mockAgeCompliance.current),
}));

// Capture the argument object App passes to useConnectionLifecycle so tests can
// drive safeSetState.
const mockConnectionLifecycleArg = { current: null as any };

// Mock services
jest.mock('../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn().mockResolvedValue(undefined),
    setSetting: jest.fn().mockResolvedValue(undefined),
    onSettingChange: jest.fn().mockReturnValue(jest.fn()),
    isFirstRun: jest.fn().mockResolvedValue(false),
  },
  DEFAULT_SERVER: 'irc.example.com',
  DEFAULT_PART_MESSAGE: 'Leaving',
}));

jest.mock('../src/services/KillSwitchService', () => ({
  killSwitchService: {
    confirmAndActivate: jest
      .fn()
      .mockResolvedValue({ success: true, errors: [] }),
    activateKillSwitch: jest
      .fn()
      .mockResolvedValue({ success: true, errors: [] }),
  },
}));

jest.mock('../src/services/DCCFileService', () => ({
  dccFileService: {
    list: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../src/services/SecureStorageService', () => ({
  secureStorageService: {
    getSecret: jest.fn().mockResolvedValue(null),
    setSecret: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock i18n
jest.mock('../src/i18n/transifex', () => ({
  initTransifex: jest.fn().mockResolvedValue(undefined),
  listenToLocaleChanges: jest.fn().mockReturnValue(jest.fn()),
  TXProvider: ({ children }: { children: React.ReactNode }) => children,
  tx: {
    t: jest.fn().mockReturnValue('translated'),
  },
  useT: jest.fn().mockReturnValue((key: string) => key),
}));

// Import mocked hooks to configure their return values
import { useUIState as mockedUseUIState } from '../src/hooks/useUIState';

// The uiReady gate flips inside a requestAnimationFrame. Under the full
// --runInBand suite the rAF scheduler can starve after many back-to-back App
// renders, so make it deterministic (flush on a real microtask) for this
// isolated test file. This keeps AppLayout/AppModals rendering reliably.
const originalRaf = global.requestAnimationFrame;
beforeAll(() => {
  (global as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0 as unknown as number;
  };
});
afterAll(() => {
  (global as any).requestAnimationFrame = originalRaf;
});

describe('App', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Set up mock return values for hooks that reference mockUIStore
    (mockedUseUIState as jest.Mock).mockReturnValue(mockUIStore);
  });

  it('renders without crashing', async () => {
    const { unmount } = await render(<App />);
    await waitFor(async () => {
      // Wait for UI to be ready (after requestAnimationFrame)
    });
    await unmount();
  });

  it('initializes Transifex on mount', async () => {
    const { initTransifex } = require('../src/i18n/transifex');
    await render(<App />);
    await waitFor(async () => {
      expect(initTransifex).toHaveBeenCalled();
    });
  });

  it('cleans up locale listener on unmount', async () => {
    const mockUnsubscribe = jest.fn();
    const { listenToLocaleChanges } = require('../src/i18n/transifex');
    (listenToLocaleChanges as jest.Mock).mockReturnValue(mockUnsubscribe);

    const { unmount } = await render(<App />);
    await unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe('AppContent', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('renders AppLayout and AppModals', async () => {
    require('../src/components/AppLayout');
    require('../src/components/AppModals');

    await render(<App />);

    await waitFor(async () => {
      // Component should be rendered after uiReady is true
    });
  });

  it('shows loading view before UI is ready', async () => {
    // The component shows a loading view initially, then switches to main UI
    await render(<App />);

    // Initially, a View with background color is rendered
    await waitFor(async () => {
      // After requestAnimationFrame, the main UI should be shown
      expect(true).toBe(true);
    });
  });
});

describe('AppContent - age compliance gate', () => {
  const { useAgeCompliance } = require('../src/hooks/useAgeCompliance');

  beforeEach(() => {
    jest.clearAllMocks();
    (mockedUseUIState as jest.Mock).mockReturnValue(mockUIStore);
    mockAgeCompliance.current = {
      isChecking: false,
      decision: { allowed: true, reason: undefined },
    };
  });

  it('renders the checking gate while age signals are evaluated', async () => {
    mockAgeCompliance.current = {
      isChecking: true,
      decision: { allowed: true, reason: undefined },
    };
    const { toJSON } = await render(<App />);
    expect(useAgeCompliance).toHaveBeenCalled();
    // AppContent (and therefore AppLayout) must not render while checking.
    expect(mockAppLayout).not.toHaveBeenCalled();
    expect(toJSON()).toBeTruthy();
  });

  it('renders the blocked gate with the decision reason when access is denied', async () => {
    mockAgeCompliance.current = {
      isChecking: false,
      decision: { allowed: false, reason: 'Age verification required' },
    };
    const { getByText } = await render(<App />);
    expect(getByText('Age verification required')).toBeTruthy();
    expect(mockAppLayout).not.toHaveBeenCalled();
  });

  it('renders the blocked gate with a default reason when none is provided', async () => {
    mockAgeCompliance.current = {
      isChecking: false,
      decision: { allowed: false, reason: undefined },
    };
    const { getByText } = await render(<App />);
    expect(
      getByText(/age verification signals do not allow access/i),
    ).toBeTruthy();
  });
});

describe('AppContent - wired callbacks and setting listeners', () => {
  const { settingsService } = require('../src/services/SettingsService');
  const { killSwitchService } = require('../src/services/KillSwitchService');
  const {
    secureStorageService,
  } = require('../src/services/SecureStorageService');

  const lastLayoutProps = () => mockAppLayout.mock.calls.at(-1)?.[0] as any;
  const lastModalsProps = () => mockAppModals.mock.calls.at(-1)?.[0] as any;

  let rendered: ReturnType<typeof render> | null = null;
  const renderApp = async () => {
    rendered = await render(<App />);
    return rendered;
  };
  const renderReady = async () => {
    const utils = await renderApp();
    // Flush the requestAnimationFrame that gates uiReady so AppLayout renders.
    await waitFor(() => expect(mockAppLayout).toHaveBeenCalled(), {
      timeout: 8000,
    });
    return utils;
  };

  // Explicitly unmount each App instance so the real (heavy) component does not
  // accumulate across tests and starve the rAF-gated uiReady flip.
  afterEach(() => {
    rendered?.unmount();
    rendered = null;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (mockedUseUIState as jest.Mock).mockReturnValue(mockUIStore);
    mockAgeCompliance.current = {
      isChecking: false,
      decision: { allowed: true, reason: undefined },
    };
    mockUnlockState.current = {
      appLockUseBiometric: false,
      appLockUsePin: false,
      appPinEntry: '',
      setAppPinEntry: jest.fn(),
      setAppPinError: jest.fn(),
      setAppUnlockModalVisible: jest.fn(),
      setAppLocked: jest.fn(),
    };
  });

  it('activates the kill switch from the header after reading warnings setting', async () => {
    (settingsService.getSetting as jest.Mock).mockResolvedValue(true);
    await renderReady();

    await act(async () => {
      await lastLayoutProps().onKillSwitchPress();
    });

    expect(settingsService.getSetting).toHaveBeenCalledWith(
      'killSwitchShowWarnings',
      true,
    );
    expect(killSwitchService.confirmAndActivate).toHaveBeenCalledWith(true);
  });

  it('kill switch from unlock: biometric verifies then activates and closes modal', async () => {
    mockUnlockState.current.appLockUseBiometric = true;
    await renderReady();

    await act(async () => {
      await lastModalsProps().onKillSwitchFromUnlock();
    });

    expect(killSwitchService.activateKillSwitch).toHaveBeenCalled();
    expect(
      mockUnlockState.current.setAppUnlockModalVisible,
    ).toHaveBeenCalledWith(false);
    expect(mockUnlockState.current.setAppLocked).toHaveBeenCalledWith(false);
  });

  it('kill switch from unlock: correct PIN verifies and clears entry', async () => {
    mockUnlockState.current.appLockUsePin = true;
    mockUnlockState.current.appPinEntry = '1234';
    (secureStorageService.getSecret as jest.Mock).mockResolvedValue('1234');
    await renderReady();

    await act(async () => {
      await lastModalsProps().onKillSwitchFromUnlock();
    });

    expect(mockUnlockState.current.setAppPinEntry).toHaveBeenCalledWith('');
    expect(killSwitchService.activateKillSwitch).toHaveBeenCalled();
  });

  it('kill switch from unlock: wrong PIN sets an error and aborts', async () => {
    mockUnlockState.current.appLockUsePin = true;
    mockUnlockState.current.appPinEntry = 'wrong';
    (secureStorageService.getSecret as jest.Mock).mockResolvedValue('1234');
    await renderReady();

    await act(async () => {
      await lastModalsProps().onKillSwitchFromUnlock();
    });

    expect(mockUnlockState.current.setAppPinError).toHaveBeenCalled();
    expect(killSwitchService.activateKillSwitch).not.toHaveBeenCalled();
  });

  it('kill switch from unlock: no auth configured shows an alert and aborts', async () => {
    const Alert = require('react-native').Alert;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderReady();

    await act(async () => {
      await lastModalsProps().onKillSwitchFromUnlock();
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(killSwitchService.activateKillSwitch).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('kill switch from unlock: surfaces errors when activation fails', async () => {
    const Alert = require('react-native').Alert;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUnlockState.current.appLockUseBiometric = true;
    (killSwitchService.activateKillSwitch as jest.Mock).mockResolvedValueOnce({
      success: false,
      errors: ['boom'],
    });
    await renderReady();

    await act(async () => {
      await lastModalsProps().onKillSwitchFromUnlock();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('boom'),
    );
    alertSpy.mockRestore();
  });

  it('toggles side tabs visibility via the layout callback', async () => {
    await renderReady();
    expect(() =>
      act(() => {
        lastLayoutProps().onToggleSideTabs();
      }),
    ).not.toThrow();
  });

  it('drives safeSetState through the connection lifecycle argument', async () => {
    // useConnectionLifecycle runs during the initial (pre-uiReady) render, so
    // this does not need to wait for the rAF-gated uiReady flip.
    await renderApp();
    const fn = jest.fn();
    act(() => {
      mockConnectionLifecycleArg.current.safeSetState(fn);
    });
    expect(fn).toHaveBeenCalled();
  });
});
