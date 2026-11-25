import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { MessageReactionsComponent } from '../../src/components/MessageReactions';

const mockGetReactions = jest.fn();
const mockOnReactionsChange = jest.fn();
const mockToggleNetworkReaction = jest.fn();
const mockHasUserReacted = jest.fn();

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surfaceVariant: '#111',
      border: '#222',
      primary: '#08f',
      textSecondary: '#666',
    },
  }),
}));

jest.mock('../../src/services/MessageReactionsService', () => ({
  reactionKey: (network: string, msgid: string) => `${network}|${msgid}`,
  messageReactionsService: {
    getReactions: (...args: unknown[]) => mockGetReactions(...args),
    onReactionsChange: (...args: unknown[]) => mockOnReactionsChange(...args),
    toggleNetworkReaction: (...args: unknown[]) =>
      mockToggleNetworkReaction(...args),
    hasUserReacted: (...args: unknown[]) => mockHasUserReacted(...args),
  },
}));

describe('MessageReactionsComponent', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockToggleNetworkReaction.mockResolvedValue(true);
    mockOnReactionsChange.mockImplementation(() => () => {});
  });

  it('returns null when no reactions exist', async () => {
    mockGetReactions.mockReturnValue({ reactions: [] });

    const { toJSON } = await render(
      <MessageReactionsComponent network="net" msgid="m1" target="#c" />,
    );
    expect(toJSON()).toBeNull();
  });

  it('shows nothing for a message without a msgid', async () => {
    mockGetReactions.mockReturnValue({
      reactions: [{ emoji: '👍', count: 1 }],
    });
    const { toJSON } = await render(
      <MessageReactionsComponent network="net" target="#c" />,
    );
    expect(toJSON()).toBeNull();
    expect(mockGetReactions).not.toHaveBeenCalled();
  });

  it('reads reactions by network and msgid and toggles them on the network', async () => {
    mockGetReactions.mockReturnValue({
      reactions: [{ emoji: '👍', count: 2 }],
    });
    mockHasUserReacted.mockReturnValue(true);

    const onReactionPress = jest.fn();
    const { getByText } = await render(
      <MessageReactionsComponent
        network="net"
        msgid="m1"
        target="#c"
        currentUserNick="alice"
        onReactionPress={onReactionPress}
      />,
    );
    expect(mockGetReactions).toHaveBeenCalledWith('net|m1');

    await act(async () => {
      await fireEvent.press(getByText('👍'));
    });

    expect(mockToggleNetworkReaction).toHaveBeenCalledWith(
      'net',
      '#c',
      'm1',
      '👍',
      'alice',
    );
    expect(onReactionPress).toHaveBeenCalledWith('👍');
    expect(getByText('2')).toBeTruthy();
  });

  it('does not toggle when current user is missing', async () => {
    mockGetReactions.mockReturnValue({
      reactions: [{ emoji: '🔥', count: 1 }],
    });

    const { getByText } = await render(
      <MessageReactionsComponent network="net" msgid="m2" target="#c" />,
    );

    await act(async () => {
      await fireEvent.press(getByText('🔥'));
    });

    expect(mockToggleNetworkReaction).not.toHaveBeenCalled();
  });

  it('updates reactions when service emits message-specific changes', async () => {
    mockGetReactions.mockReturnValue({
      reactions: [{ emoji: '❤️', count: 1 }],
    });

    let listener: ((msgId: string, reactions: any) => void) | undefined;
    mockOnReactionsChange.mockImplementation((cb: any) => {
      listener = cb;
      return () => {};
    });

    const { getByText, queryByText } = await render(
      <MessageReactionsComponent
        network="net"
        msgid="m3"
        target="#c"
        currentUserNick="bob"
      />,
    );

    expect(getByText('❤️')).toBeTruthy();

    await act(() => {
      listener?.('net|other', { reactions: [{ emoji: '🙃', count: 1 }] });
      listener?.('net|m3', { reactions: [{ emoji: '🎉', count: 4 }] });
    });

    expect(getByText('🎉')).toBeTruthy();
    expect(queryByText('❤️')).toBeNull();
    expect(queryByText('🙃')).toBeNull();
  });
});
