import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import Clipboard from '@react-native-clipboard/clipboard';
import { UserList, copyNickToClipboard } from '../src/components/UserList';
import { ChannelUser } from '../src/services/IRCService';

jest.mock('../src/services/ConnectionManager', () => ({
  connectionManager: {
    getConnection: jest.fn(() => null),
  },
}));

jest.mock('../src/services/IRCService', () => {
  const actual = jest.requireActual('../src/services/IRCService');
  return {
    ...actual,
    ircService: {
      ...actual.ircService,
      getCurrentNick: jest.fn(() => 'currentUser'),
      getNetworkName: jest.fn(() => 'testnet'),
      sendCommand: jest.fn(),
      sendRaw: jest.fn(),
      sendCTCPRequest: jest.fn(),
    },
  };
});

describe('UserList context menu copy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the copy nickname action after long-pressing a user', async () => {
    const user: ChannelUser = { nick: 'Alice', modes: [] };
    let tree: TestRenderer.ReactTestRenderer;

    const hasTextChild = (node: TestRenderer.ReactTestInstance, text: string): boolean => {
      if (node.props && typeof node.props.children === 'string' && node.props.children === text) {
        return true;
      }
      const children = node.props?.children;
      if (Array.isArray(children)) {
        return children.some(
          (child: any) => typeof child === 'string' ? child === text : child?.props && hasTextChild(child, text)
        );
      }
      if (children && children.props) {
        return hasTextChild(children, text);
      }
      return false;
    };

    await act(async () => {
      tree = TestRenderer.create(
        <UserList users={[user]} channelName="#test" network="net" />
      );
    });

    const userItem = tree!.root.find(
      node => typeof node.props.onLongPress === 'function' && hasTextChild(node, 'Alice')
    );

    await act(async () => {
      userItem.props.onLongPress();
    });

    await act(async () => {});

    const copyButton = tree!.root.find(
      node => typeof node.props.onPress === 'function' && hasTextChild(node, 'Copy Nickname')
    );

    expect(copyButton).toBeTruthy();
  });

  it('copyNickToClipboard writes to clipboard and returns message', () => {
    const clipboardModule = require('@react-native-clipboard/clipboard');
    const spy = jest.spyOn(clipboardModule, 'setString');

    const msg = copyNickToClipboard('Bob');

    expect(spy).toHaveBeenCalledWith('Bob');
    expect(msg).toBe('Copied Bob');
  });
});
