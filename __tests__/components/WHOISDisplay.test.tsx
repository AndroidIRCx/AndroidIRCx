import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { WHOISDisplay } from '../../src/components/WHOISDisplay';

const mockGetConnection = jest.fn();
const mockGetActiveConnection = jest.fn();
const mockGetActivity = jest.fn();

jest.mock('../../src/services/UserManagementService', () => ({
  userManagementService: {
    getWHOIS: jest.fn(),
    requestWHOIS: jest.fn(),
    getUserNote: jest.fn(),
    getUserAlias: jest.fn(),
    addUserNote: jest.fn(),
    removeUserNote: jest.fn(),
    addUserAlias: jest.fn(),
    removeUserAlias: jest.fn(),
    ignoreUser: jest.fn(),
    unignoreUser: jest.fn(),
    isUserIgnored: jest.fn(),
  },
}));

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: (...args: unknown[]) => mockGetConnection(...args),
    getActiveConnection: (...args: unknown[]) =>
      mockGetActiveConnection(...args),
  },
}));

jest.mock('../../src/services/IRCService', () => ({
  ircService: {
    getConnectionStatus: jest.fn(() => true),
    isRegistered: jest.fn(() => true),
    getCurrentNick: jest.fn(() => 'me'),
    sendCommand: jest.fn(),
  },
}));

jest.mock('../../src/services/UserActivityService', () => ({
  userActivityService: {
    getActivity: (...args: unknown[]) => mockGetActivity(...args),
  },
}));

jest.mock('../../src/utils/IRCFormatter', () => ({
  formatIRCTextAsComponent: (txt: string) => txt,
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, any>) => {
    if (!params) return key;
    return key
      .replace('{nick}', String(params.nick ?? ''))
      .replace('{minutes}', String(params.minutes ?? ''))
      .replace('{time}', String(params.time ?? ''))
      .replace('{action}', String(params.action ?? ''))
      .replace('{channel}', String(params.channel ?? ''));
  },
}));

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      surfaceVariant: '#222',
      border: '#333',
      text: '#fff',
      textSecondary: '#aaa',
      primary: '#08f',
      accent: '#0ff',
      secondary: '#f0f',
      primaryDark: '#00f',
      info: '#0af',
      success: '#0f0',
      warning: '#ff0',
      danger: '#f00',
    },
  }),
}));

describe('WHOISDisplay', () => {
  const mockUserService = require('../../src/services/UserManagementService')
    .userManagementService as {
    getWHOIS: jest.Mock;
    requestWHOIS: jest.Mock;
    getUserNote: jest.Mock;
    getUserAlias: jest.Mock;
    addUserNote: jest.Mock;
    removeUserNote: jest.Mock;
    addUserAlias: jest.Mock;
    removeUserAlias: jest.Mock;
    ignoreUser: jest.Mock;
    unignoreUser: jest.Mock;
    isUserIgnored: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    mockUserService.getWHOIS.mockReturnValue(undefined);
    mockUserService.requestWHOIS.mockResolvedValue({
      nick: 'alice',
      realname: 'Alice Doe',
      username: 'alice',
      hostname: 'example.com',
      account: 'alice',
      channels: ['@#chat', '+#help'],
      server: 'irc.example',
      idle: 120,
      signon: Date.now() - 10000,
      secure: true,
      secureMessage: 'Secure',
    });
    mockUserService.getUserNote.mockReturnValue('known user');
    mockUserService.getUserAlias.mockReturnValue('ali');
    mockUserService.isUserIgnored.mockReturnValue(false);
    mockGetActivity.mockReturnValue({
      lastAction: 'message',
      channel: '#chat',
      lastSeenAt: Date.now(),
      text: 'hello',
    });

    const irc = {
      getConnectionStatus: jest.fn(() => true),
      isRegistered: jest.fn(() => true),
      getCurrentNick: jest.fn(() => 'me'),
      sendCommand: jest.fn(),
    };
    mockGetConnection.mockReturnValue({
      ircService: irc,
      userManagementService: mockUserService,
    });
    mockGetActiveConnection.mockReturnValue({
      ircService: irc,
      userManagementService: mockUserService,
    });
  });

  it('does not render when hidden', () => {
    const { toJSON } = render(
      <WHOISDisplay visible={false} nick="alice" onClose={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('loads and renders whois details with channel press', async () => {
    const onChannelPress = jest.fn();

    const { getByText, getAllByText } = render(
      <WHOISDisplay
        visible
        nick="alice"
        network="net-1"
        onClose={jest.fn()}
        onChannelPress={onChannelPress}
      />,
    );

    await waitFor(() => {
      expect(getByText('Alice Doe')).toBeTruthy();
      expect(getByText('alice@example.com')).toBeTruthy();
      expect(getByText('known user')).toBeTruthy();
      expect(getByText('ali')).toBeTruthy();
    });

    const channelNodes = getAllByText(/#chat/);
    const pressableChannelText =
      channelNodes.find(
        (node: any) => typeof node?.parent?.props?.onPress === 'function',
      ) || channelNodes[0];
    fireEvent.press(
      (pressableChannelText as any).parent ?? pressableChannelText,
    );
    expect(onChannelPress).toHaveBeenCalledWith('#chat');
  });

  it('handles ignore and unignore actions', async () => {
    mockUserService.isUserIgnored.mockReturnValue(true);

    const { getByText, rerender } = render(
      <WHOISDisplay visible nick="alice" onClose={jest.fn()} />,
    );

    await waitFor(() => expect(getByText('Unignore User')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Unignore User'));
    });
    expect(mockUserService.unignoreUser).toHaveBeenCalledWith(
      'alice',
      undefined,
    );

    mockUserService.isUserIgnored.mockReturnValue(false);
    rerender(<WHOISDisplay visible nick="alice" onClose={jest.fn()} />);

    fireEvent.press(getByText('Ignore User'));
    const ignoreAction = (Alert.alert as jest.Mock).mock.calls.find(
      c => c[0] === 'Ignore User',
    )?.[2]?.[1];
    await act(async () => {
      await ignoreAction.onPress();
    });
    expect(mockUserService.ignoreUser).toHaveBeenCalled();
  });
});
