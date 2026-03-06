import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { MessageSearchBar } from '../../src/components/MessageSearchBar';

jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      border: '#222',
      textSecondary: '#666',
      background: '#000',
      text: '#fff',
      primary: '#08f',
      buttonPrimaryText: '#fff',
    },
  }),
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: Record<string, string>) => {
    if (key === '{count} result(s) found' && params?.count) {
      return `${params.count} result(s) found`;
    }
    return key;
  },
}));

describe('MessageSearchBar', () => {
  it('does not render when hidden', () => {
    const { toJSON } = render(
      <MessageSearchBar visible={false} onClose={jest.fn()} onSearch={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });

  it('calls onSearch on text change and shows count text', () => {
    const onSearch = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <MessageSearchBar visible onClose={jest.fn()} onSearch={onSearch} resultCount={3} />
    );

    const input = getByPlaceholderText('Search messages...');
    fireEvent.changeText(input, 'hello');

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        searchTerm: 'hello',
        messageTypes: expect.objectContaining({ message: true, join: false }),
      })
    );
    expect(getByText('3 result(s) found')).toBeTruthy();
  });

  it('supports filter toggle and message type changes', () => {
    const onSearch = jest.fn();
    const { UNSAFE_getAllByType, getByText } = render(
      <MessageSearchBar visible onClose={jest.fn()} onSearch={onSearch} />
    );

    const buttonsBefore = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(buttonsBefore[0]);

    expect(getByText('Message Types:')).toBeTruthy();
    fireEvent.press(getByText('join'));

    expect(onSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        messageTypes: expect.objectContaining({ join: true }),
      })
    );
  });

  it('handles clear and close actions', () => {
    const onClose = jest.fn();
    const onSearch = jest.fn();
    const { getByPlaceholderText, UNSAFE_getAllByType } = render(
      <MessageSearchBar visible onClose={onClose} onSearch={onSearch} resultCount={0} />
    );

    const input = getByPlaceholderText('Search messages...');
    fireEvent.changeText(input, 'abc');

    const buttonsWithClear = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(buttonsWithClear[0]);
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ searchTerm: '' }));

    const buttonsAfterClear = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(buttonsAfterClear[buttonsAfterClear.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });
});
