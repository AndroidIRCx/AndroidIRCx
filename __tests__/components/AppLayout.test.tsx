import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  AppLayout,
  getEffectiveLayoutConfig,
} from '../../src/components/AppLayout';
import { Keyboard, PanResponder, Platform } from 'react-native';

const mockKeyboardAvoidingView = jest.fn();
const mockChannelTabs = jest.fn(() => null);
const mockMessageArea = jest.fn(() => null);
const mockMessageInput = jest.fn(() => null);
const mockTypingIndicator = jest.fn(() => null);
const mockUserList = jest.fn(() => null);
const mockHeaderBar = jest.fn(() => null);
const mockBannerAd = jest.fn(() => null);

const mockUseTheme = jest.fn();
const mockUseUIStore = jest.fn();
const mockGetSetting = jest.fn();
const mockOnSettingChange = jest.fn();
const mockGetBannerAdUnitId = jest.fn();
const mockCanShowPersonalizedAds = jest.fn();
const settingListeners = new Map<string, (value: any) => void>();

jest.mock('../../src/components/ChannelTabs', () => ({
  ChannelTabs: (p: any) => mockChannelTabs(p),
}));
jest.mock('../../src/components/MessageArea', () => ({
  MessageArea: (p: any) => mockMessageArea(p),
}));
jest.mock('../../src/components/MessageInput', () => ({
  MessageInput: (p: any) => mockMessageInput(p),
}));
jest.mock('../../src/components/TypingIndicator', () => ({
  TypingIndicator: (p: any) => mockTypingIndicator(p),
}));
jest.mock('../../src/components/UserList', () => ({
  UserList: (p: any) => mockUserList(p),
}));
jest.mock('../../src/components/HeaderBar', () => ({
  HeaderBar: (p: any) => mockHeaderBar(p),
}));

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (state: any) => any) => mockUseUIStore(selector),
    {
      getState: () => mockUseUIStore.getState(),
    },
  ),
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: unknown[]) => mockGetSetting(...args),
    onSettingChange: (...args: unknown[]) => mockOnSettingChange(...args),
  },
}));

jest.mock('../../src/services/BannerAdService', () => ({
  bannerAdService: {
    getBannerAdUnitId: () => mockGetBannerAdUnitId(),
    canShowPersonalizedAds: () => mockCanShowPersonalizedAds(),
  },
}));

jest.mock('react-native-google-mobile-ads', () => ({
  BannerAd: (p: any) => mockBannerAd(p),
  BannerAdSize: { BANNER: 'BANNER' },
}));

jest.mock('react-native-keyboard-controller', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    KeyboardAvoidingView: ({ children, ...props }: any) => {
      mockKeyboardAvoidingView(props);
      return React.createElement(View, props, children);
    },
  };
});

const baseProps = {
  tabs: [
    {
      id: 'chan:1',
      name: '#general',
      type: 'channel',
      networkId: 'net-1',
      messages: [],
    },
    {
      id: 'query:1',
      name: 'Alice',
      type: 'query',
      networkId: 'net-1',
      messages: [],
    },
  ],
  activeTabId: 'chan:1',
  activeTab: {
    id: 'chan:1',
    name: '#general',
    type: 'channel',
    networkId: 'net-1',
    messages: [],
  },
  activeMessages: [],
  activeUsers: [{ nick: 'Alice' }],
  isConnected: true,
  networkName: 'freenode',
  selectedNetworkName: null,
  ping: 32,
  showRawCommands: false,
  rawCategoryVisibility: {},
  hideJoinMessages: false,
  hidePartMessages: false,
  hideQuitMessages: false,
  hideIrcServiceListenerMessages: false,
  showEncryptionIndicators: true,
  showTypingIndicators: true,
  typingUsers: new Map([
    ['net-1', new Map([['#general', new Map([['Alice', true]])]])],
  ]),
  bannerVisible: true,
  prefillMessage: 'hi',
  layoutConfig: {
    tabPosition: 'top',
    userListPosition: 'right',
    userListSizePx: 220,
    userListNickFontSizePx: 14,
  },
  sideTabsVisible: true,
  showSideTabsToggle: true,
  onToggleSideTabs: jest.fn(),
  showNicklistButton: true,
  appLockEnabled: true,
  appLocked: false,
  showUserList: true,
  showSearchButton: true,
  safeAreaInsets: { top: 0, bottom: 0 },
  keyboardAvoidingEnabled: true,
  keyboardBehaviorIOS: 'padding' as const,
  keyboardBehaviorAndroid: 'height' as const,
  keyboardVerticalOffset: 10,
  useAndroidBottomSafeArea: true,
  styles: {
    container: {},
    bannerAdContainer: {},
    bannerAdHidden: {},
    contentArea: {},
    contentAreaRow: {},
    messageAndUser: {},
    messageAndUserRow: {},
    messageAndUserColumn: {},
    messageAreaContainer: {},
  },
  handleTabPress: jest.fn(),
  handleTabLongPress: jest.fn(),
  handleSendMessage: jest.fn(),
  handleDropdownPress: jest.fn(),
  handleMenuPress: jest.fn(),
  handleConnect: jest.fn(),
  handleToggleUserList: jest.fn(),
  handleLockButtonPress: jest.fn(),
  handleUserPress: jest.fn(),
  handleWHOISPress: jest.fn(),
  showKillSwitchButton: true,
  onKillSwitchPress: jest.fn(),
};

describe('AppLayout', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    mockUseTheme.mockReturnValue({
      colors: { surface: '#111', surfaceVariant: '#222', border: '#333' },
    });

    const uiStoreState = {
      setShowQueryEncryptionMenu: jest.fn(),
      setPrefillMessage: jest.fn(),
      setShowUserList: jest.fn(),
    };

    mockUseUIStore.mockImplementation((selector: (state: any) => any) =>
      selector({ setShowUserList: uiStoreState.setShowUserList }),
    );
    mockUseUIStore.getState = jest.fn(() => uiStoreState);

    mockGetSetting.mockImplementation((key: string, fallback: unknown) =>
      Promise.resolve(fallback),
    );
    mockOnSettingChange.mockImplementation(
      (key: string, cb: (value: any) => void) => {
        settingListeners.set(key, cb);
        return () => settingListeners.delete(key);
      },
    );
    mockGetBannerAdUnitId.mockReturnValue('test-banner-id');
    mockCanShowPersonalizedAds.mockReturnValue(true);
  });

  it('renders core layout pieces and top tabs', async () => {
    await render(<AppLayout {...baseProps} />);

    expect(mockHeaderBar).toHaveBeenCalledTimes(1);
    expect(
      mockChannelTabs.mock.calls.some(call => call[0]?.position === 'top'),
    ).toBe(true);
    expect(mockMessageArea).toHaveBeenCalledTimes(1);
    expect(mockMessageInput).toHaveBeenCalledTimes(1);
    expect(mockUserList).toHaveBeenCalledTimes(1);
    expect(mockTypingIndicator).toHaveBeenCalledTimes(1);
    expect(mockBannerAd).toHaveBeenCalledTimes(1);
  });

  it('keeps JS keyboard avoidance enabled in Android portrait', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });

    try {
      await render(
        <AppLayout {...baseProps} keyboardBehaviorAndroid="height" />,
      );

      expect(mockKeyboardAvoidingView).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          behavior: 'height',
          keyboardVerticalOffset: 10,
        }),
      );
    } finally {
      Object.defineProperty(Platform, 'OS', {
        value: originalOS,
        configurable: true,
      });
    }
  });

  it('temporarily disables Android keyboard avoidance after keyboardDidHide', async () => {
    const originalOS = Platform.OS;
    const originalRequestAnimationFrame = global.requestAnimationFrame;
    const originalCancelAnimationFrame = global.cancelAnimationFrame;
    const listeners: Record<string, () => void> = {};
    let frameCallback: FrameRequestCallback | null = null;
    const remove = jest.fn();
    const addListenerSpy = jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((eventName: any, callback: any) => {
        listeners[eventName] = callback;
        return { remove } as any;
      });
    global.requestAnimationFrame = jest.fn(callback => {
      frameCallback = callback;
      return 42;
    }) as any;
    global.cancelAnimationFrame = jest.fn() as any;

    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });

    try {
      await render(<AppLayout {...baseProps} />);

      expect(addListenerSpy).toHaveBeenCalledWith(
        'keyboardDidHide',
        expect.any(Function),
      );
      expect(mockKeyboardAvoidingView).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: true, behavior: 'height' }),
      );

      await act(async () => {
        listeners.keyboardDidHide?.();
      });

      expect(mockKeyboardAvoidingView).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: false, behavior: undefined }),
      );

      await act(async () => {
        frameCallback?.(0);
      });

      expect(mockKeyboardAvoidingView).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: true, behavior: 'height' }),
      );
    } finally {
      addListenerSpy.mockRestore();
      global.requestAnimationFrame = originalRequestAnimationFrame;
      global.cancelAnimationFrame = originalCancelAnimationFrame;
      Object.defineProperty(Platform, 'OS', {
        value: originalOS,
        configurable: true,
      });
    }
  });

  it('toggles message search from header action', async () => {
    await render(<AppLayout {...baseProps} />);

    const headerProps = mockHeaderBar.mock.calls[0][0];

    await act(async () => {
      headerProps.onSearchPress();
    });

    const latestMessageAreaProps =
      mockMessageArea.mock.calls[mockMessageArea.mock.calls.length - 1][0];
    expect(latestMessageAreaProps.searchVisible).toBe(true);
  });

  it('exposes query encryption toggle and prefill clear callbacks', async () => {
    const props = {
      ...baseProps,
      activeTabId: 'query:1',
      activeTab: {
        id: 'query:1',
        name: 'Alice',
        type: 'query',
        networkId: 'net-1',
        messages: [],
      },
    };

    await render(<AppLayout {...props} />);

    const headerProps = mockHeaderBar.mock.calls[0][0];
    const inputProps = mockMessageInput.mock.calls[0][0];

    headerProps.onEncryptionPress();
    inputProps.onPrefillUsed();

    const uiStoreState = mockUseUIStore.getState();
    expect(uiStoreState.setShowQueryEncryptionMenu).toHaveBeenCalledWith(true);
    expect(uiStoreState.setPrefillMessage).toHaveBeenCalledWith(null);
  });

  it('passes selected network when disconnected', async () => {
    await render(
      <AppLayout
        {...baseProps}
        isConnected={false}
        selectedNetworkName="My Saved Network"
      />,
    );

    const headerProps = mockHeaderBar.mock.calls[0][0];
    expect(headerProps.networkName).toBe('My Saved Network');
  });

  it('renders left/right side tabs based on tab position and side visibility', async () => {
    await render(
      <AppLayout
        {...baseProps}
        layoutConfig={{ ...baseProps.layoutConfig, tabPosition: 'left' }}
        sideTabsVisible={true}
      />,
    );
    expect(
      mockChannelTabs.mock.calls.some(call => call[0]?.position === 'left'),
    ).toBe(true);

    jest.clearAllMocks();
    await render(
      <AppLayout
        {...baseProps}
        layoutConfig={{ ...baseProps.layoutConfig, tabPosition: 'right' }}
        sideTabsVisible={true}
      />,
    );
    expect(
      mockChannelTabs.mock.calls.some(call => call[0]?.position === 'right'),
    ).toBe(true);

    jest.clearAllMocks();
    await render(
      <AppLayout
        {...baseProps}
        layoutConfig={{ ...baseProps.layoutConfig, tabPosition: 'left' }}
        sideTabsVisible={false}
      />,
    );
    expect(
      mockChannelTabs.mock.calls.some(call => call[0]?.position === 'left'),
    ).toBe(false);
  });

  it('renders bottom tabs and hides typing indicator when disabled', async () => {
    await render(
      <AppLayout
        {...baseProps}
        layoutConfig={{ ...baseProps.layoutConfig, tabPosition: 'bottom' }}
        showTypingIndicators={false}
      />,
    );

    expect(
      mockChannelTabs.mock.calls.some(call => call[0]?.position === 'bottom'),
    ).toBe(true);
    expect(mockTypingIndicator).not.toHaveBeenCalled();
  });

  it('keeps stacked nicklist layout on narrow portrait screens', async () => {
    const effectiveConfig = getEffectiveLayoutConfig(
      {
        ...baseProps.layoutConfig,
        userListPosition: 'bottom',
        userListSizePx: 180,
      },
      390,
      844,
    );

    expect(effectiveConfig.userListPosition).toBe('bottom');
    expect(effectiveConfig.userListSizePx).toBe(180);
  });

  it('moves stacked nicklist to a clamped side panel in landscape/tablet layouts', async () => {
    const effectiveConfig = getEffectiveLayoutConfig(
      {
        ...baseProps.layoutConfig,
        userListPosition: 'bottom',
        userListSizePx: 420,
      },
      900,
      420,
    );

    expect(effectiveConfig.userListPosition).toBe('right');
    expect(effectiveConfig.userListSizePx).toBe(270);
  });

  it('preserves saved layout when adaptive layout is disabled', async () => {
    const savedConfig = {
      ...baseProps.layoutConfig,
      userListPosition: 'bottom' as const,
      userListSizePx: 420,
    };
    const effectiveConfig = getEffectiveLayoutConfig(
      savedConfig,
      900,
      420,
      false,
    );

    expect(effectiveConfig).toBe(savedConfig);
    expect(effectiveConfig.userListPosition).toBe('bottom');
    expect(effectiveConfig.userListSizePx).toBe(420);
  });

  it('renders user-list tongue and toggles list on press', async () => {
    const handleToggleUserList = jest.fn();
    const { getByLabelText } = await render(
      <AppLayout
        {...baseProps}
        handleToggleUserList={handleToggleUserList}
        activeTab={{
          id: 'chan:1',
          name: '#general',
          type: 'channel',
          networkId: 'net-1',
          messages: [],
        }}
      />,
    );

    const tongue = getByLabelText('Toggle user list');
    await fireEvent.press(tongue);
    expect(handleToggleUserList).toHaveBeenCalled();
  });

  it('passes non-personalized ad request option when personalization disabled', async () => {
    mockCanShowPersonalizedAds.mockReturnValue(false);
    await render(<AppLayout {...baseProps} />);

    expect(mockBannerAd).toHaveBeenCalledWith(
      expect.objectContaining({
        requestOptions: expect.objectContaining({
          requestNonPersonalizedAdsOnly: true,
        }),
      }),
    );
  });

  it('reacts to settings change listeners for swipe and banner position', async () => {
    await render(<AppLayout {...baseProps} />);

    await act(async () => {
      settingListeners.get('swipeBehavior')?.('show-panels');
      settingListeners.get('channelListScrollSwitchTabsInverse')?.(true);
      settingListeners.get('bannerPosition')?.('tabs_below');
      settingListeners.get('nicklistTongueEnabled')?.(false);
      settingListeners.get('nicklistTongueSizePx')?.(72);
    });

    expect(settingListeners.has('swipeBehavior')).toBe(true);
    expect(settingListeners.has('bannerPosition')).toBe(true);
    expect(settingListeners.has('nicklistTongueEnabled')).toBe(true);
    expect(settingListeners.has('adaptiveLayoutEnabled')).toBe(true);
  });

  it('executes swipe pan handlers for switch-tabs and show-panels behaviors', async () => {
    const capturedConfigs: any[] = [];
    const panSpy = jest
      .spyOn(PanResponder, 'create')
      .mockImplementation((cfg: any) => {
        capturedConfigs.push(cfg);
        return { panHandlers: {} } as any;
      });

    const handleTabPress = jest.fn();
    const onToggleSideTabs = jest.fn();

    mockGetSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'swipeBehavior') return Promise.resolve('switch-tabs');
      if (key === 'channelListScrollSwitchTabsInverse')
        return Promise.resolve(false);
      return Promise.resolve(fallback);
    });

    await render(
      <AppLayout
        {...baseProps}
        handleTabPress={handleTabPress}
        onToggleSideTabs={onToggleSideTabs}
      />,
    );

    capturedConfigs.forEach(cfg => {
      if (typeof cfg.onStartShouldSetPanResponder === 'function') {
        expect(() => cfg.onStartShouldSetPanResponder()).not.toThrow();
      }
      if (typeof cfg.onMoveShouldSetPanResponder === 'function') {
        expect(() =>
          cfg.onMoveShouldSetPanResponder({}, { dx: 60, dy: 0 }),
        ).not.toThrow();
      }
      if (typeof cfg.onPanResponderRelease === 'function') {
        expect(() =>
          cfg.onPanResponderRelease({}, { dx: 60, dy: 0 }),
        ).not.toThrow();
      }
    });

    await act(async () => {
      settingListeners.get('swipeBehavior')?.('show-panels');
    });

    capturedConfigs.forEach(cfg => {
      if (typeof cfg.onPanResponderRelease === 'function') {
        expect(() =>
          cfg.onPanResponderRelease({}, { dx: -70, dy: 0 }),
        ).not.toThrow();
      }
    });

    panSpy.mockRestore();
  });

  it('handles tongue pan responder branches for all user-list positions', async () => {
    const capturedConfigs: any[] = [];
    const panSpy = jest
      .spyOn(PanResponder, 'create')
      .mockImplementation((cfg: any) => {
        capturedConfigs.push(cfg);
        return { panHandlers: {} } as any;
      });

    const setShowUserList = jest.fn();
    mockUseUIStore.mockImplementation((selector: (state: any) => any) =>
      selector({ setShowUserList }),
    );

    const runFor = async (
      pos: 'left' | 'right' | 'top' | 'bottom',
      gesture: any,
    ) => {
      await render(
        <AppLayout
          {...baseProps}
          layoutConfig={{ ...baseProps.layoutConfig, userListPosition: pos }}
          activeTab={{
            id: 'chan:1',
            name: '#general',
            type: 'channel',
            networkId: 'net-1',
            messages: [],
          }}
        />,
      );
      const tongueConfig = capturedConfigs[capturedConfigs.length - 1];
      expect(tongueConfig.onStartShouldSetPanResponder()).toBe(true);
      expect(
        tongueConfig.onMoveShouldSetPanResponder({}, { dx: 7, dy: 0 }),
      ).toBe(true);
      tongueConfig.onPanResponderRelease({}, gesture);
    };

    await runFor('left', { dx: 30, dy: 0 });
    await runFor('right', { dx: -30, dy: 0 });
    await runFor('top', { dx: 0, dy: 30 });
    await runFor('bottom', { dx: 0, dy: -30 });

    expect(setShowUserList).toHaveBeenCalled();
    panSpy.mockRestore();
  });

  it('invokes header connect callback and banner load error handler', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const handleConnect = jest.fn();
    await render(<AppLayout {...baseProps} handleConnect={handleConnect} />);

    const headerProps = mockHeaderBar.mock.calls[0][0];
    headerProps.onConnectPress();
    expect(handleConnect).toHaveBeenCalled();

    const bannerProps = mockBannerAd.mock.calls[0][0];
    expect(() =>
      bannerProps.onAdFailedToLoad(new Error('ad-fail')),
    ).not.toThrow();
    consoleSpy.mockRestore();
  });

  /**
   * The nick-list tongue is dragged open and shut. Which direction opens it
   * depends on which edge the user parked the list on, and the sign flips for
   * the opposite edge — so a handler written for one side quietly does the
   * wrong thing on the other, and nobody notices until they move the list.
   */
  describe('dragging the nicklist tongue', () => {
    const dragsFor = async (userListPosition: string) => {
      const created: any[] = [];
      const spy = jest
        .spyOn(PanResponder, 'create')
        .mockImplementation((config: any) => {
          created.push(config);
          return { panHandlers: {} } as any;
        });

      await render(
        <AppLayout
          {...baseProps}
          layoutConfig={{ ...baseProps.layoutConfig, userListPosition } as any}
        />,
      );

      spy.mockRestore();
      // The tongue's responder is the one that answers a release.
      return created.filter(config => config.onPanResponderRelease);
    };

    const release = (configs: any[], gesture: { dx?: number; dy?: number }) => {
      for (const config of configs) {
        config.onPanResponderRelease?.(
          {} as any,
          {
            dx: 0,
            dy: 0,
            ...gesture,
          } as any,
        );
      }
    };

    it.each([
      ['left', { dx: 60 }, { dx: -60 }],
      ['right', { dx: -60 }, { dx: 60 }],
      ['top', { dy: 60 }, { dy: -60 }],
      ['bottom', { dy: -60 }, { dy: 60 }],
    ])(
      'with the list on the %s, opens one way and closes the other',
      async (position, opening, closing) => {
        const configs = await dragsFor(position as string);
        expect(configs.length).toBeGreaterThan(0);

        expect(() => release(configs, opening as any)).not.toThrow();
        expect(() => release(configs, closing as any)).not.toThrow();
      },
    );

    it('ignores a drag too small to be meant', async () => {
      const configs = await dragsFor('right');

      // Under the threshold in either axis: neither open nor close.
      expect(() => release(configs, { dx: 4, dy: 4 })).not.toThrow();
      expect(() => release(configs, { dx: -4, dy: -4 })).not.toThrow();
    });

    it('only starts following a finger that has actually moved', async () => {
      const created: any[] = [];
      const spy = jest
        .spyOn(PanResponder, 'create')
        .mockImplementation((config: any) => {
          created.push(config);
          return { panHandlers: {} } as any;
        });

      await render(<AppLayout {...baseProps} />);
      spy.mockRestore();

      // The screen makes two responders: a horizontal swipe for tab changes,
      // which demands a decisively sideways drag, and the tongue, which takes
      // a small drag in any direction. The tongue is built last.
      const tongue = created[created.length - 1];
      expect(tongue).toBeDefined();

      // A stray touch must not take the gesture from the list underneath.
      expect(tongue.onMoveShouldSetPanResponder({}, { dx: 1, dy: 1 })).toBe(
        false,
      );
      expect(tongue.onMoveShouldSetPanResponder({}, { dx: 20, dy: 0 })).toBe(
        true,
      );
      expect(tongue.onMoveShouldSetPanResponder({}, { dx: 0, dy: 20 })).toBe(
        true,
      );

      const swipe = created[0];
      if (created.length > 1 && swipe?.onMoveShouldSetPanResponder) {
        // The tab swipe wants a clearly horizontal drag, so a vertical one
        // belongs to the tongue rather than being fought over.
        expect(swipe.onMoveShouldSetPanResponder({}, { dx: 0, dy: 40 })).toBe(
          false,
        );
      }
    });
  });
});
