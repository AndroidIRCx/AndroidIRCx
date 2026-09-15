import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OptionsMenu } from '../../src/components/OptionsMenu';

const mockUseUIStoreGetState = jest.fn();
const mockDisconnect = jest.fn();
const mockGetActiveNetworkId = jest.fn();
const mockSortTabsGrouped = jest.fn();

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string, params?: Record<string, string>) => {
    if (key === 'Disconnect {network}' && params?.network)
      return `Disconnect ${params.network}`;
    return key;
  },
}));

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: { text: '#fff', surface: '#111', border: '#222', error: '#f33' },
  }),
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: () => mockUseUIStoreGetState(),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    disconnect: (...args: unknown[]) => mockDisconnect(...args),
    getActiveNetworkId: (...args: unknown[]) => mockGetActiveNetworkId(...args),
  },
}));

jest.mock('../../src/utils/tabUtils', () => ({
  sortTabsGrouped: (...args: unknown[]) => mockSortTabsGrouped(...args),
}));

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  isConnected: true,
  networkName: 'Libera',
  focusedNetworkId: 'net-1',
  showRawCommands: false,
  setTabs: jest.fn(),
  tabSortAlphabetical: false,
  handleConnect: jest.fn(),
  handleExit: jest.fn(),
  persistentSetShowRawCommands: jest.fn(),
  setActiveConnectionId: jest.fn(),
  styles: {
    optionText: { color: '#fff' },
    destructiveOption: { color: '#f33' },
    optionsMenu: { backgroundColor: '#000' },
    optionItem: {},
  },
};

describe('OptionsMenu', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSortTabsGrouped.mockImplementation(tabs => tabs);
    mockGetActiveNetworkId.mockReturnValue('net-2');
    mockUseUIStoreGetState.mockReturnValue({
      setShowChannelModal: jest.fn(),
      setShowNetworksList: jest.fn(),
      setShowChannelList: jest.fn(),
      setShowDccTransfers: jest.fn(),
    });
  });

  it('handles connected actions', async () => {
    const ui = mockUseUIStoreGetState();
    const { getByText } = await render(<OptionsMenu {...baseProps} />);

    await fireEvent.press(getByText('Join Channel'));
    await fireEvent.press(getByText('Disconnect Libera'));
    await fireEvent.press(getByText('Connect Another Network'));
    await fireEvent.press(getByText('Browse Channels'));
    await fireEvent.press(getByText('DCC Transfers'));
    await fireEvent.press(getByText('Show RAW'));
    await fireEvent.press(getByText('Exit'));

    expect(ui.setShowChannelModal).toHaveBeenCalledWith(true);
    expect(mockDisconnect).toHaveBeenCalledWith('net-1');
    expect(baseProps.setActiveConnectionId).toHaveBeenCalledWith('net-2');
    expect(ui.setShowNetworksList).toHaveBeenCalledWith(true);
    expect(ui.setShowChannelList).toHaveBeenCalledWith(true);
    expect(ui.setShowDccTransfers).toHaveBeenCalledWith(true);
    expect(baseProps.persistentSetShowRawCommands).toHaveBeenCalledWith(true);
    expect(baseProps.handleExit).toHaveBeenCalled();
  });

  it('handles disconnected actions', async () => {
    const { getByText } = await render(
      <OptionsMenu {...baseProps} isConnected={false} />,
    );

    await fireEvent.press(getByText('Connect to Default'));
    await fireEvent.press(getByText('Choose Network'));

    expect(baseProps.handleConnect).toHaveBeenCalled();
    expect(mockUseUIStoreGetState().setShowNetworksList).toHaveBeenCalledWith(
      true,
    );
  });

  it('applies close-all filters via setTabs updater', async () => {
    const setTabs = jest.fn();
    const { getByText } = await render(
      <OptionsMenu {...baseProps} setTabs={setTabs} />,
    );

    await fireEvent.press(getByText('Close All Channels'));
    await fireEvent.press(getByText('Close All Privates'));

    const updaterChannels = setTabs.mock.calls[0][0];
    const updaterPrivates = setTabs.mock.calls[1][0];

    const prev = [
      { id: 'a', networkId: 'net-1', type: 'channel' },
      { id: 'b', networkId: 'net-1', type: 'query' },
      { id: 'c', networkId: 'net-2', type: 'channel' },
    ] as any;

    const resChannels = updaterChannels(prev);
    const resPrivates = updaterPrivates(prev);

    expect(resChannels).toEqual([
      { id: 'b', networkId: 'net-1', type: 'query' },
      { id: 'c', networkId: 'net-2', type: 'channel' },
    ]);
    expect(resPrivates).toEqual([
      { id: 'a', networkId: 'net-1', type: 'channel' },
      { id: 'c', networkId: 'net-2', type: 'channel' },
    ]);
  });
});
