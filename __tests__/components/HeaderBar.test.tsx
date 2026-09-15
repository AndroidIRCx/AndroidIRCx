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
    expect(getByText('Ping: 25.4 ms')).toBeTruthy();
  });

  it('shows connect hint and calls connect when disconnected', async () => {
    const { getByText } = await render(
      <HeaderBar {...baseProps} isConnected={false} />,
    );

    await fireEvent.press(getByText('Libera'));

    expect(getByText('Tap to connect')).toBeTruthy();
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
});
