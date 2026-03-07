import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AppLayout } from '../../src/components/AppLayout';
import { PanResponder } from 'react-native';

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

jest.mock('../../src/components/ChannelTabs', () => ({ ChannelTabs: (p: any) => mockChannelTabs(p) }));
jest.mock('../../src/components/MessageArea', () => ({ MessageArea: (p: any) => mockMessageArea(p) }));
jest.mock('../../src/components/MessageInput', () => ({ MessageInput: (p: any) => mockMessageInput(p) }));
jest.mock('../../src/components/TypingIndicator', () => ({ TypingIndicator: (p: any) => mockTypingIndicator(p) }));
jest.mock('../../src/components/UserList', () => ({ UserList: (p: any) => mockUserList(p) }));
jest.mock('../../src/components/HeaderBar', () => ({ HeaderBar: (p: any) => mockHeaderBar(p) }));

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (state: any) => any) => mockUseUIStore(selector),
    {
      getState: () => mockUseUIStore.getState(),
    }
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
    KeyboardAvoidingView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

const baseProps = {
  tabs: [
    { id: 'chan:1', name: '#general', type: 'channel', networkId: 'net-1', messages: [] },
    { id: 'query:1', name: 'Alice', type: 'query', networkId: 'net-1', messages: [] },
  ],
  activeTabId: 'chan:1',
  activeTab: { id: 'chan:1', name: '#general', type: 'channel', networkId: 'net-1', messages: [] },
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
  typingUsers: new Map([['net-1', new Map([['#general', new Map([['Alice', true]])]])]]),
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
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTheme.mockReturnValue({ colors: { surface: '#111', surfaceVariant: '#222', border: '#333' } });

    const uiStoreState = {
      setShowQueryEncryptionMenu: jest.fn(),
      setPrefillMessage: jest.fn(),
      setShowUserList: jest.fn(),
    };

    mockUseUIStore.mockImplementation((selector: (state: any) => any) =>
      selector({ setShowUserList: uiStoreState.setShowUserList })
    );
    mockUseUIStore.getState = jest.fn(() => uiStoreState);

    mockGetSetting.mockImplementation((key: string, fallback: unknown) => Promise.resolve(fallback));
    mockOnSettingChange.mockImplementation((key: string, cb: (value: any) => void) => {
      settingListeners.set(key, cb);
      return () => settingListeners.delete(key);
    });
    mockGetBannerAdUnitId.mockReturnValue('test-banner-id');
    mockCanShowPersonalizedAds.mockReturnValue(true);
  });

  it('renders core layout pieces and top tabs', () => {
    render(<AppLayout {...baseProps} />);

    expect(mockHeaderBar).toHaveBeenCalledTimes(1);
    expect(
      mockChannelTabs.mock.calls.some(call => call[0]?.position === 'top')
    ).toBe(true);
    expect(mockMessageArea).toHaveBeenCalledTimes(1);
    expect(mockMessageInput).toHaveBeenCalledTimes(1);
    expect(mockUserList).toHaveBeenCalledTimes(1);
    expect(mockTypingIndicator).toHaveBeenCalledTimes(1);
    expect(mockBannerAd).toHaveBeenCalledTimes(1);
  });

  it('toggles message search from header action', async () => {
    render(<AppLayout {...baseProps} />);

    const headerProps = mockHeaderBar.mock.calls[0][0];

    await act(async () => {
      headerProps.onSearchPress();
    });

    const latestMessageAreaProps = mockMessageArea.mock.calls[mockMessageArea.mock.calls.length - 1][0];
    expect(latestMessageAreaProps.searchVisible).toBe(true);
  });

  it('exposes query encryption toggle and prefill clear callbacks', () => {
    const props = {
      ...baseProps,
      activeTabId: 'query:1',
      activeTab: { id: 'query:1', name: 'Alice', type: 'query', networkId: 'net-1', messages: [] },
    };

    render(<AppLayout {...props} />);

    const headerProps = mockHeaderBar.mock.calls[0][0];
    const inputProps = mockMessageInput.mock.calls[0][0];

    headerProps.onEncryptionPress();
    inputProps.onPrefillUsed();

    const uiStoreState = mockUseUIStore.getState();
    expect(uiStoreState.setShowQueryEncryptionMenu).toHaveBeenCalledWith(true);
    expect(uiStoreState.setPrefillMessage).toHaveBeenCalledWith(null);
  });

  it('passes selected network when disconnected', () => {
    render(
      <AppLayout
        {...baseProps}
        isConnected={false}
        selectedNetworkName="My Saved Network"
      />
    );

    const headerProps = mockHeaderBar.mock.calls[0][0];
    expect(headerProps.networkName).toBe('My Saved Network');
  });

  it('renders left/right side tabs based on tab position and side visibility', () => {
    render(
      <AppLayout
        {...baseProps}
        layoutConfig={{ ...baseProps.layoutConfig, tabPosition: 'left' }}
        sideTabsVisible={true}
      />
    );
    expect(mockChannelTabs.mock.calls.some(call => call[0]?.position === 'left')).toBe(true);

    jest.clearAllMocks();
    render(
      <AppLayout
        {...baseProps}
        layoutConfig={{ ...baseProps.layoutConfig, tabPosition: 'right' }}
        sideTabsVisible={true}
      />
    );
    expect(mockChannelTabs.mock.calls.some(call => call[0]?.position === 'right')).toBe(true);

    jest.clearAllMocks();
    render(
      <AppLayout
        {...baseProps}
        layoutConfig={{ ...baseProps.layoutConfig, tabPosition: 'left' }}
        sideTabsVisible={false}
      />
    );
    expect(mockChannelTabs.mock.calls.some(call => call[0]?.position === 'left')).toBe(false);
  });

  it('renders bottom tabs and hides typing indicator when disabled', () => {
    render(
      <AppLayout
        {...baseProps}
        layoutConfig={{ ...baseProps.layoutConfig, tabPosition: 'bottom' }}
        showTypingIndicators={false}
      />
    );

    expect(mockChannelTabs.mock.calls.some(call => call[0]?.position === 'bottom')).toBe(true);
    expect(mockTypingIndicator).not.toHaveBeenCalled();
  });

  it('renders user-list tongue and toggles list on press', () => {
    const handleToggleUserList = jest.fn();
    const { getByLabelText } = render(
      <AppLayout
        {...baseProps}
        handleToggleUserList={handleToggleUserList}
        activeTab={{ id: 'chan:1', name: '#general', type: 'channel', networkId: 'net-1', messages: [] }}
      />
    );

    const tongue = getByLabelText('Toggle user list');
    fireEvent.press(tongue);
    expect(handleToggleUserList).toHaveBeenCalled();
  });

  it('passes non-personalized ad request option when personalization disabled', () => {
    mockCanShowPersonalizedAds.mockReturnValue(false);
    render(<AppLayout {...baseProps} />);

    expect(mockBannerAd).toHaveBeenCalledWith(
      expect.objectContaining({
        requestOptions: expect.objectContaining({
          requestNonPersonalizedAdsOnly: true,
        }),
      })
    );
  });

  it('reacts to settings change listeners for swipe and banner position', async () => {
    render(<AppLayout {...baseProps} />);

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
      if (key === 'channelListScrollSwitchTabsInverse') return Promise.resolve(false);
      return Promise.resolve(fallback);
    });

    render(
      <AppLayout
        {...baseProps}
        handleTabPress={handleTabPress}
        onToggleSideTabs={onToggleSideTabs}
      />
    );

    capturedConfigs.forEach((cfg) => {
      if (typeof cfg.onStartShouldSetPanResponder === 'function') {
        expect(() => cfg.onStartShouldSetPanResponder()).not.toThrow();
      }
      if (typeof cfg.onMoveShouldSetPanResponder === 'function') {
        expect(() => cfg.onMoveShouldSetPanResponder({}, { dx: 60, dy: 0 })).not.toThrow();
      }
      if (typeof cfg.onPanResponderRelease === 'function') {
        expect(() => cfg.onPanResponderRelease({}, { dx: 60, dy: 0 })).not.toThrow();
      }
    });

    await act(async () => {
      settingListeners.get('swipeBehavior')?.('show-panels');
    });

    capturedConfigs.forEach((cfg) => {
      if (typeof cfg.onPanResponderRelease === 'function') {
        expect(() => cfg.onPanResponderRelease({}, { dx: -70, dy: 0 })).not.toThrow();
      }
    });

    panSpy.mockRestore();
  });

  it('handles tongue pan responder branches for all user-list positions', () => {
    const capturedConfigs: any[] = [];
    const panSpy = jest
      .spyOn(PanResponder, 'create')
      .mockImplementation((cfg: any) => {
        capturedConfigs.push(cfg);
        return { panHandlers: {} } as any;
      });

    const setShowUserList = jest.fn();
    mockUseUIStore.mockImplementation((selector: (state: any) => any) =>
      selector({ setShowUserList })
    );

    const runFor = (pos: 'left' | 'right' | 'top' | 'bottom', gesture: any) => {
      render(
        <AppLayout
          {...baseProps}
          layoutConfig={{ ...baseProps.layoutConfig, userListPosition: pos }}
          activeTab={{ id: 'chan:1', name: '#general', type: 'channel', networkId: 'net-1', messages: [] }}
        />
      );
      const tongueConfig = capturedConfigs[capturedConfigs.length - 1];
      expect(tongueConfig.onStartShouldSetPanResponder()).toBe(true);
      expect(tongueConfig.onMoveShouldSetPanResponder({}, { dx: 7, dy: 0 })).toBe(true);
      tongueConfig.onPanResponderRelease({}, gesture);
    };

    runFor('left', { dx: 30, dy: 0 });
    runFor('right', { dx: -30, dy: 0 });
    runFor('top', { dx: 0, dy: 30 });
    runFor('bottom', { dx: 0, dy: -30 });

    expect(setShowUserList).toHaveBeenCalled();
    panSpy.mockRestore();
  });

  it('invokes header connect callback and banner load error handler', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const handleConnect = jest.fn();
    render(<AppLayout {...baseProps} handleConnect={handleConnect} />);

    const headerProps = mockHeaderBar.mock.calls[0][0];
    headerProps.onConnectPress();
    expect(handleConnect).toHaveBeenCalled();

    const bannerProps = mockBannerAd.mock.calls[0][0];
    expect(() => bannerProps.onAdFailedToLoad(new Error('ad-fail'))).not.toThrow();
    consoleSpy.mockRestore();
  });
});
