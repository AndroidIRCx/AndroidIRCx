import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { MessageReactionsComponent } from '../../src/components/MessageReactions';

const mockGetReactions = jest.fn();
const mockOnReactionsChange = jest.fn();
const mockToggleReaction = jest.fn();
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
  messageReactionsService: {
    getReactions: (...args: unknown[]) => mockGetReactions(...args),
    onReactionsChange: (...args: unknown[]) => mockOnReactionsChange(...args),
    toggleReaction: (...args: unknown[]) => mockToggleReaction(...args),
    hasUserReacted: (...args: unknown[]) => mockHasUserReacted(...args),
  },
}));

describe('MessageReactionsComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToggleReaction.mockResolvedValue(undefined);
    mockOnReactionsChange.mockImplementation(() => () => {});
  });

  it('returns null when no reactions exist', () => {
    mockGetReactions.mockReturnValue({ reactions: [] });

    const { toJSON } = render(<MessageReactionsComponent messageId="m1" />);
    expect(toJSON()).toBeNull();
  });

  it('renders reactions and toggles with callback for current user', async () => {
    mockGetReactions.mockReturnValue({
      reactions: [{ emoji: '👍', count: 2 }],
    });
    mockHasUserReacted.mockReturnValue(true);

    const onReactionPress = jest.fn();
    const { getByText } = render(
      <MessageReactionsComponent
        messageId="m1"
        currentUserNick="alice"
        onReactionPress={onReactionPress}
      />,
    );

    await act(async () => {
      fireEvent.press(getByText('👍'));
    });

    expect(mockToggleReaction).toHaveBeenCalledWith('m1', '👍', 'alice');
    expect(onReactionPress).toHaveBeenCalledWith('👍');
    expect(getByText('2')).toBeTruthy();
  });

  it('does not toggle when current user is missing', async () => {
    mockGetReactions.mockReturnValue({
      reactions: [{ emoji: '🔥', count: 1 }],
    });

    const { getByText } = render(<MessageReactionsComponent messageId="m2" />);

    await act(async () => {
      fireEvent.press(getByText('🔥'));
    });

    expect(mockToggleReaction).not.toHaveBeenCalled();
  });

  it('updates reactions when service emits message-specific changes', () => {
    mockGetReactions.mockReturnValue({
      reactions: [{ emoji: '❤️', count: 1 }],
    });

    let listener: ((msgId: string, reactions: any) => void) | undefined;
    mockOnReactionsChange.mockImplementation((cb: any) => {
      listener = cb;
      return () => {};
    });

    const { getByText, queryByText } = render(
      <MessageReactionsComponent messageId="m3" currentUserNick="bob" />,
    );

    expect(getByText('❤️')).toBeTruthy();

    act(() => {
      listener?.('m3', { reactions: [{ emoji: '🎉', count: 4 }] });
    });

    expect(getByText('🎉')).toBeTruthy();
    expect(queryByText('❤️')).toBeNull();
  });
});
