import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { IRCv3InfoScreen } from '../../src/screens/IRCv3InfoScreen';
import { connectionManager } from '../../src/services/ConnectionManager';

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000000',
      surface: '#111111',
      text: '#ffffff',
      textSecondary: '#cccccc',
      primary: '#33aaff',
      border: '#333333',
      success: '#00ff00',
      warning: '#ffaa00',
      error: '#ff0000',
      card: '#111111',
    },
  }),
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => 'Icon');

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: jest.fn(),
    getActiveConnection: jest.fn(),
  },
}));

const mockConnectionManager = connectionManager as jest.Mocked<
  Pick<typeof connectionManager, 'getConnection' | 'getActiveConnection'>
>;

const makeIrcService = (overrides = {}) => ({
  getNetworkName: jest.fn(() => 'Libera'),
  getConnectionStatus: jest.fn(() => true),
  getAvailableCapabilities: jest.fn(() => [
    'draft/reply',
    'typing',
    'account-notify',
    'sasl',
    'multi-prefix',
  ]),
  getEnabledCapabilities: jest.fn(() => ['draft/reply', 'typing', 'sasl']),
  getCapabilityValues: jest.fn(() => ({ typing: 'client' })),
  getISupportValues: jest.fn(() => ({ CHANTYPES: '#&', NETWORK: 'Libera' })),
  ...overrides,
});

describe('IRCv3InfoScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('renders nothing when hidden', async () => {
    const { toJSON } = await render(
      <IRCv3InfoScreen visible={false} onClose={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('shows disconnected state when no IRC service is available', async () => {
    mockConnectionManager.getActiveConnection.mockReturnValue(undefined as any);

    const { getByText } = await render(
      <IRCv3InfoScreen visible onClose={jest.fn()} />,
    );

    await waitFor(async () => {
      expect(getByText('Not Connected')).toBeTruthy();
      expect(
        getByText(
          'Connect to an IRC network to view IRCv3 capabilities and server features.',
        ),
      ).toBeTruthy();
    });
  });

  it('renders capability diagnostics for a selected network and closes', async () => {
    const onClose = jest.fn();
    const ircService = makeIrcService();
    mockConnectionManager.getConnection.mockReturnValue({
      networkId: 'libera',
      ircService,
    } as any);

    const { getByText, getAllByText } = await render(
      <IRCv3InfoScreen visible networkId="libera" onClose={onClose} />,
    );

    await waitFor(async () => {
      expect(getAllByText('Libera').length).toBeGreaterThan(0);
      expect(getByText('IRCv3 Features')).toBeTruthy();
      expect(getByText('typing = client')).toBeTruthy();
      expect(getByText('account-notify')).toBeTruthy();
      expect(getAllByText('draft/reply').length).toBeGreaterThan(0);
      expect(getByText('CHANTYPES')).toBeTruthy();
      expect(getByText('Refresh Data')).toBeTruthy();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
