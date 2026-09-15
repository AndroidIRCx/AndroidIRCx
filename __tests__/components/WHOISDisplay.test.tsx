import React from 'react';
import { Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
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

jest.mock('../../src/i18n/localization', () => ({
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

  beforeEach(async () => {
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

  it('does not render when hidden', async () => {
    const { toJSON } = await render(
      <WHOISDisplay visible={false} nick="alice" onClose={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('loads and renders whois details with channel press', async () => {
    const onChannelPress = jest.fn();

    const { getByText, getAllByText } = await render(
      <WHOISDisplay
        visible
        nick="alice"
        network="net-1"
        onClose={jest.fn()}
        onChannelPress={onChannelPress}
      />,
    );

    await waitFor(async () => {
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
    await fireEvent.press(
      (pressableChannelText as any).parent ?? pressableChannelText,
    );
    expect(onChannelPress).toHaveBeenCalledWith('#chat');
  });

  it('handles ignore and unignore actions', async () => {
    mockUserService.isUserIgnored.mockReturnValue(true);

    const { getByText, rerender } = await render(
      <WHOISDisplay visible nick="alice" onClose={jest.fn()} />,
    );

    await waitFor(() => expect(getByText('Unignore User')).toBeTruthy());

    await act(async () => {
      await fireEvent.press(getByText('Unignore User'));
    });
    expect(mockUserService.unignoreUser).toHaveBeenCalledWith(
      'alice',
      undefined,
    );

    mockUserService.isUserIgnored.mockReturnValue(false);
    await rerender(<WHOISDisplay visible nick="alice" onClose={jest.fn()} />);

    await fireEvent.press(getByText('Ignore User'));
    const ignoreAction = (Alert.alert as jest.Mock).mock.calls.find(
      c => c[0] === 'Ignore User',
    )?.[2]?.[1];
    await act(async () => {
      await ignoreAction.onPress();
    });
    expect(mockUserService.ignoreUser).toHaveBeenCalled();
  });

  it('renders extended WHOIS fields and copies details', async () => {
    mockUserService.requestWHOIS.mockResolvedValue({
      nick: 'alice',
      realname: 'Alice Doe',
      username: 'alice',
      hostname: 'example.com',
      account: 'alice',
      modes: '+iwx',
      connectingFrom: 'gateway.example',
      server: 'irc.example',
      serverInfo: 'Example IRCd',
      away: true,
      awayMessage: 'Out for lunch',
      secure: true,
      secureMessage: 'TLSv1.3',
      idle: 360,
      signon: new Date('2026-01-02T03:04:05Z').getTime(),
      channels: ['~&#ops', '%#voice'],
      isOper: true,
      isAdmin: true,
      isServicesAdmin: true,
      isHelpOp: true,
      isRegistered: true,
      isBot: true,
      specialStatus: 'network helper',
    });

    const { getByText, getAllByText } = await render(
      <WHOISDisplay visible nick="alice" onClose={jest.fn()} />,
    );

    await waitFor(async () => {
      expect(getByText('+iwx')).toBeTruthy();
      expect(getByText('gateway.example')).toBeTruthy();
      expect(getByText('Example IRCd')).toBeTruthy();
      expect(getByText('Out for lunch')).toBeTruthy();
      expect(getByText('TLSv1.3')).toBeTruthy();
      expect(getByText('network helper')).toBeTruthy();
      expect(getAllByText('Yes').length).toBeGreaterThanOrEqual(6);
    });

    await fireEvent.press(getByText('Copy WHOIS Details'));
    expect(Clipboard.setString).toHaveBeenCalledWith(
      expect.stringContaining('WHOIS: alice'),
    );
    expect(Clipboard.setString).toHaveBeenCalledWith(
      expect.stringContaining('Modes: +iwx'),
    );
    expect(Alert.alert).toHaveBeenCalledWith('Copied');
  });

  it('saves and removes notes and aliases', async () => {
    mockUserService.getUserNote.mockReturnValue('');
    mockUserService.getUserAlias.mockReturnValue('');

    const { getByText, getByPlaceholderText, getAllByText } = await render(
      <WHOISDisplay visible nick="alice" onClose={jest.fn()} />,
    );

    await waitFor(() => expect(getByText('Add Note')).toBeTruthy());

    await fireEvent.press(getByText('Add Note'));
    await fireEvent.changeText(
      getByPlaceholderText('Enter note about this user'),
      '  trusted  ',
    );
    await act(async () => {
      await fireEvent.press(getAllByText('Save')[0]);
    });
    expect(mockUserService.addUserNote).toHaveBeenCalledWith(
      'alice',
      'trusted',
      undefined,
    );

    await fireEvent.press(getByText('Edit Note'));
    await fireEvent.changeText(
      getByPlaceholderText('Enter note about this user'),
      '   ',
    );
    await act(async () => {
      await fireEvent.press(getAllByText('Save')[0]);
    });
    expect(mockUserService.removeUserNote).toHaveBeenCalledWith(
      'alice',
      undefined,
    );

    await fireEvent.press(getByText('Add Alias'));
    await fireEvent.changeText(
      getByPlaceholderText('Enter alias for this user'),
      '  ally  ',
    );
    await act(async () => {
      await fireEvent.press(getAllByText('Save')[0]);
    });
    expect(mockUserService.addUserAlias).toHaveBeenCalledWith(
      'alice',
      'ally',
      undefined,
    );

    await fireEvent.press(getByText('Edit Alias'));
    await fireEvent.changeText(
      getByPlaceholderText('Enter alias for this user'),
      '   ',
    );
    await act(async () => {
      await fireEvent.press(getAllByText('Save')[0]);
    });
    expect(mockUserService.removeUserAlias).toHaveBeenCalledWith(
      'alice',
      undefined,
    );
  });

  it('handles disconnected WHOIS and WHOWAS safeguards', async () => {
    const disconnectedIrc = {
      getConnectionStatus: jest.fn(() => false),
      isRegistered: jest.fn(() => false),
      getCurrentNick: jest.fn(() => 'me'),
      sendCommand: jest.fn(),
    };
    mockGetActiveConnection.mockReturnValue({
      ircService: disconnectedIrc,
      userManagementService: mockUserService,
    });

    const { getByText } = await render(
      <WHOISDisplay visible nick="alice" onClose={jest.fn()} />,
    );

    await waitFor(async () => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'WHOIS Error',
        'Not connected or not registered yet.',
      );
    });

    await fireEvent.press(getByText('WHOWAS (History)'));
    expect(disconnectedIrc.sendCommand).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Not connected to server.',
    );
  });
});
