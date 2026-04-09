/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { fireEvent, render } from '@testing-library/react-native';
import { MessageFormatEditorScreen } from '../../src/screens/MessageFormatEditorScreen';

const mockColors = {
  background: '#000',
  surface: '#111',
  surfaceVariant: '#222',
  border: '#444',
  text: '#fff',
  textSecondary: '#bbb',
  primary: '#4caf50',
  onPrimary: '#fff',
};

const buildFormats = () => ({
  message: [
    { type: 'token', value: 'time', style: {} },
    { type: 'text', value: ' hello ', style: {} },
  ],
  messageMention: [{ type: 'token', value: 'message', style: {} }],
  action: [{ type: 'token', value: 'message', style: {} }],
  actionMention: [{ type: 'token', value: 'message', style: {} }],
  notice: [{ type: 'token', value: 'message', style: {} }],
  join: [{ type: 'token', value: 'message', style: {} }],
  part: [{ type: 'token', value: 'message', style: {} }],
  quit: [{ type: 'token', value: 'message', style: {} }],
  kick: [{ type: 'token', value: 'message', style: {} }],
  nick: [{ type: 'token', value: 'message', style: {} }],
  invite: [{ type: 'token', value: 'message', style: {} }],
  monitor: [{ type: 'token', value: 'message', style: {} }],
  mode: [{ type: 'token', value: 'message', style: {} }],
  topic: [{ type: 'token', value: 'message', style: {} }],
  raw: [{ type: 'token', value: 'message', style: {} }],
  error: [{ type: 'token', value: 'message', style: {} }],
  ctcp: [{ type: 'token', value: 'message', style: {} }],
  event: [{ type: 'token', value: 'message', style: {} }],
});

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('../../src/utils/MessageFormatDefaults', () => ({
  AVAILABLE_MESSAGE_FORMAT_TOKENS: [
    { value: 'time' },
    { value: 'message' },
    { value: 'nick' },
  ],
  getDefaultMessageFormats: jest.fn(() => buildFormats()),
}));

jest.mock('../../src/components/ColorPalettePicker', () => ({
  ColorPalettePicker: ({ onInsert, onClear }: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return (
      <>
        <Text onPress={() => onInsert('#123456')}>Apply Palette Color</Text>
        <Text onPress={onClear}>Clear Palette Color</Text>
      </>
    );
  },
}));

describe('MessageFormatEditorScreen', () => {
  it('renders nothing useful when hidden', () => {
    const { queryByText } = render(
      <MessageFormatEditorScreen
        visible={false}
        colors={mockColors as any}
        initialFormats={buildFormats() as any}
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(queryByText('Message Format')).toBeNull();
  });

  it('adds a text part and saves formats', async () => {
    const onSave = jest.fn();
    const { findAllByText, findByPlaceholderText, findByText } = render(
      <MessageFormatEditorScreen
        visible
        colors={mockColors as any}
        initialFormats={buildFormats() as any}
        onSave={onSave}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.press((await findAllByText('+'))[0]);
    fireEvent.press(await findByText('Text'));
    fireEvent.changeText(await findByPlaceholderText('Text'), 'custom');
    fireEvent.press(await findByText('Apply'));
    fireEvent.press(await findByText('Save'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.arrayContaining([
          expect.objectContaining({ type: 'text', value: 'custom' }),
        ]),
      }),
    );
  });

  it('edits a part, applies color and reorders parts', async () => {
    const onSave = jest.fn();
    const { findByText, getAllByText } = render(
      <MessageFormatEditorScreen
        visible
        colors={mockColors as any}
        initialFormats={buildFormats() as any}
        onSave={onSave}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.press(getAllByText('{time}')[0]);
    fireEvent.press(await findByText('B'));
    fireEvent.press(await findByText('Text color'));
    fireEvent.press(await findByText('Apply Palette Color'));
    fireEvent.press(await findByText('Move Right'));
    fireEvent.press(await findByText('Apply'));
    fireEvent.press(await findByText('Save'));

    const saved = onSave.mock.calls[0][0];
    expect(saved.message[1]).toEqual(
      expect.objectContaining({
        type: 'token',
        value: 'time',
        style: expect.objectContaining({
          bold: true,
          color: '#123456',
        }),
      }),
    );
  });

  it('deletes an existing part and supports custom color clearing', async () => {
    const onSave = jest.fn();
    const { findByDisplayValue, findByText, getAllByText } = render(
      <MessageFormatEditorScreen
        visible
        colors={mockColors as any}
        initialFormats={buildFormats() as any}
        onSave={onSave}
        onCancel={jest.fn()}
      />,
    );

    fireEvent.press(getAllByText(' hello ')[1]);
    fireEvent.press(await findByText('Background'));
    fireEvent.press(await findByText('Custom'));
    fireEvent.changeText(await findByDisplayValue('#FFFFFF'), '#abcdef');
    fireEvent.press(await findByText('Clear'));
    fireEvent.press(await findByText('Delete'));
    fireEvent.press(await findByText('Save'));

    const saved = onSave.mock.calls[0][0];
    expect(saved.message).toHaveLength(1);
  });
});
