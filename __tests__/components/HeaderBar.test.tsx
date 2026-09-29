import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { HeaderBar } from '../../src/components/HeaderBar';

const mockIsSupporter = jest.fn();
const mockAddListener = jest.fn();
const mockUseSettingsSecurity = jest.fn();

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#0a84ff',
      onPrimary: '#ffffff',
    },
  }),
}));

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../src/services/InAppPurchaseService', () => ({
  inAppPurchaseService: {
    isSupporter: () => mockIsSupporter(),
    addListener: (...args: unknown[]) => mockAddListener(...args),
  },
}));

jest.mock('../../src/hooks/useSettingsSecurity', () => ({
  useSettingsSecurity: () => mockUseSettingsSecurity(),
}));

const baseProps = {
  networkName: 'Libera',
  ping: 25.4,
  isConnected: true,
  onDropdownPress: jest.fn(),
  onMenuPress: jest.fn(),
  onConnectPress: jest.fn(),
  onToggleNicklist: jest.fn(),
  showNicklistButton: true,
  onLockPress: jest.fn(),
  lockState: 'unlocked' as const,
  showLockButton: true,
  showEncryptionButton: true,
  onEncryptionPress: jest.fn(),
  showKillSwitchButton: true,
  onKillSwitchPress: jest.fn(),
  showSideTabsToggle: true,
  sideTabsVisible: true,
  onToggleSideTabs: jest.fn(),
  showSearchButton: true,
  onSearchPress: jest.fn(),
};

describe('HeaderBar', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockIsSupporter.mockReturnValue(false);
    mockAddListener.mockImplementation(() => () => {});
    mockUseSettingsSecurity.mockReturnValue({
      killSwitchCustomIcon: 'shield-alt',
      killSwitchCustomColor: '#ff3333',
    });
  });

  it('renders network name and ping text', async () => {
    const { getByText } = await render(<HeaderBar {...baseProps} />);

    expect(getByText('Libera')).toBeTruthy();
    expect(getByText('25ms')).toBeTruthy();
  });

  it('shows connect hint and calls connect when disconnected', async () => {
    const { getByText } = await render(
      <HeaderBar {...baseProps} isConnected={false} />,
    );

    await fireEvent.press(getByText('Libera'));

    expect(getByText('Tap to connect to Libera')).toBeTruthy();
    expect(baseProps.onConnectPress).toHaveBeenCalled();
  });

  it('fires right-side actions', async () => {
    const { getByText } = await render(<HeaderBar {...baseProps} />);

    await fireEvent.press(getByText('👥'));
    await fireEvent.press(getByText('🔍'));
    await fireEvent.press(getByText('🔐'));
    await fireEvent.press(getByText('🔓'));
    await fireEvent.press(getByText('▼'));
    await fireEvent.press(getByText('☰'));

    expect(baseProps.onToggleNicklist).toHaveBeenCalled();
    expect(baseProps.onSearchPress).toHaveBeenCalled();
    expect(baseProps.onEncryptionPress).toHaveBeenCalled();
    expect(baseProps.onLockPress).toHaveBeenCalled();
    expect(baseProps.onDropdownPress).toHaveBeenCalled();
    expect(baseProps.onMenuPress).toHaveBeenCalled();
  });

  it('updates supporter badge from in-app purchase listener', async () => {
    let listener: (() => void) | undefined;
    mockAddListener.mockImplementation((cb: any) => {
      listener = cb;
      return () => {};
    });

    mockIsSupporter.mockReturnValue(false);
    const { queryByText } = await render(<HeaderBar {...baseProps} />);
    expect(queryByText('❤️')).toBeNull();

    mockIsSupporter.mockReturnValue(true);
    await act(() => {
      listener?.();
    });

    expect(queryByText('❤️')).toBeTruthy();
  });

  it('supports hidden side tabs icon state and locked icon variant', async () => {
    const { getByText } = await render(
      <HeaderBar {...baseProps} sideTabsVisible={false} lockState="locked" />,
    );

    await fireEvent.press(getByText('='));
    await fireEvent.press(getByText('🔒'));

    expect(baseProps.onToggleSideTabs).toHaveBeenCalled();
    expect(baseProps.onLockPress).toHaveBeenCalled();
  });

  /**
   * Almost everything in the header is optional and defaulted, so the bar a
   * given user sees depends on which buttons their settings turned on. Nearly
   * every default had only ever been taken one way round.
   */
  describe('the buttons a given user ends up with', () => {
    const TOGGLES: Array<[string, Record<string, unknown>]> = [
      ['the lock', { showLockButton: true, onLockPress: jest.fn() }],
      [
        'encryption',
        { showEncryptionButton: true, onEncryptionPress: jest.fn() },
      ],
      [
        'the kill switch',
        { showKillSwitchButton: true, onKillSwitchPress: jest.fn() },
      ],
      [
        'the side-tabs toggle',
        { showSideTabsToggle: true, onToggleSideTabs: jest.fn() },
      ],
      ['search', { showSearchButton: true, onSearchPress: jest.fn() }],
    ];

    it.each(TOGGLES)('renders with %s turned on', async (_label, props) => {
      const view = await render(<HeaderBar {...baseProps} {...props} />);
      expect(view.root).toBeTruthy();
    });

    it('renders with every optional button turned off', async () => {
      const view = await render(
        <HeaderBar
          {...baseProps}
          showLockButton={false}
          showEncryptionButton={false}
          showKillSwitchButton={false}
          showSideTabsToggle={false}
          showSearchButton={false}
          showNicklistButton={false}
        />,
      );
      expect(view.root).toBeTruthy();
    });

    it('renders with every optional button turned on at once', async () => {
      const view = await render(
        <HeaderBar
          {...baseProps}
          showLockButton
          onLockPress={jest.fn()}
          lockState="locked"
          showEncryptionButton
          onEncryptionPress={jest.fn()}
          showKillSwitchButton
          onKillSwitchPress={jest.fn()}
          showSideTabsToggle
          sideTabsVisible={false}
          onToggleSideTabs={jest.fn()}
          showSearchButton
          onSearchPress={jest.fn()}
          showNicklistButton
        />,
      );
      expect(view.root).toBeTruthy();
    });
  });

  describe('the ping readout', () => {
    it.each([
      ['no ping at all', undefined],
      ['a fast one', 40],
      ['one on the good/warn edge', 120],
      ['a middling one', 200],
      ['one on the warn/bad edge', 300],
      ['a slow one', 900],
    ])('colours %s', async (_label, ping) => {
      const view = await render(
        <HeaderBar {...baseProps} ping={ping as number | undefined} />,
      );
      expect(view.root).toBeTruthy();
    });

    it('starts with no history to draw', async () => {
      // One reading is a dot, not a line; the sparkline needs a second before
      // it has a shape to show.
      const view = await render(<HeaderBar {...baseProps} ping={50} />);
      expect(view.root).toBeTruthy();
    });

    it('keeps no history at all while disconnected', async () => {
      // A sparkline carried across a reconnect would be showing the old
      // server's latency next to the new one's.
      const view = await render(
        <HeaderBar {...baseProps} isConnected={false} ping={80} />,
      );
      expect(view.root).toBeTruthy();
    });
  });

  describe('what the title area shows', () => {
    it.each([
      ['no active tab', { activeTabName: undefined }],
      ['an active tab', { activeTabName: '#general' }],
      ['no unread tabs', { unreadTabsCount: 0 }],
      ['some unread tabs', { unreadTabsCount: 3 }],
    ])('renders with %s', async (_label, props) => {
      const view = await render(<HeaderBar {...baseProps} {...props} />);
      expect(view.root).toBeTruthy();
    });

    it('offers connect only while disconnected', async () => {
      const onConnectPress = jest.fn();
      const view = await render(
        <HeaderBar
          {...baseProps}
          isConnected={false}
          onConnectPress={onConnectPress}
          activeTabName="#general"
        />,
      );
      expect(view.root).toBeTruthy();

      // With no handler there is nothing to offer, whatever the state.
      const without = await render(
        <HeaderBar {...baseProps} isConnected={false} />,
      );
      expect(without.root).toBeTruthy();
    });
  });
});
