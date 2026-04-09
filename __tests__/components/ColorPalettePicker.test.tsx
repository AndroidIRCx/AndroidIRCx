import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ColorPalettePicker } from '../../src/components/ColorPalettePicker';

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

const colors = {
  text: '#fff',
  textSecondary: '#aaa',
  primary: '#08f',
  surface: '#111',
  border: '#222',
  background: '#000',
};

describe('ColorPalettePicker', () => {
  it('inserts selected foreground color in mirc mode', () => {
    const onInsert = jest.fn();

    const { getByText, UNSAFE_getAllByType } = render(
      <ColorPalettePicker colors={colors} onInsert={onInsert} />,
    );

    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[4]);
    fireEvent.press(getByText('Insert'));

    const inserted = onInsert.mock.calls[0][0] as string;
    expect(inserted.endsWith('00')).toBe(true);
  });

  it('auto-inserts when background is chosen', () => {
    const onInsert = jest.fn();

    const { getByText, UNSAFE_getAllByType } = render(
      <ColorPalettePicker colors={colors} onInsert={onInsert} autoInsertOnBg />,
    );

    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[4]);
    fireEvent.press(getByText('BG'));

    const touchablesAfter = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchablesAfter[5]);

    expect(onInsert).toHaveBeenCalled();
    const inserted = onInsert.mock.calls[0][0] as string;
    expect(inserted.includes(',')).toBe(true);
  });

  it('supports single target hex mode and clear callback', () => {
    const onInsert = jest.fn();
    const onClear = jest.fn();

    const { getByText, UNSAFE_getAllByType } = render(
      <ColorPalettePicker
        colors={colors}
        onInsert={onInsert}
        outputMode="hex"
        targetMode="single"
        onClear={onClear}
      />,
    );

    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[2]);
    fireEvent.press(getByText('Insert'));

    expect(onInsert).toHaveBeenCalledWith(expect.stringMatching(/^#/));

    fireEvent.press(getByText('Clear'));
    expect(onClear).toHaveBeenCalled();
  });

  it('switches between standard and extended tabs', () => {
    const { getByText } = render(
      <ColorPalettePicker colors={colors} onInsert={jest.fn()} />,
    );

    fireEvent.press(getByText('Extended'));
    fireEvent.press(getByText('Standard'));

    expect(getByText('FG')).toBeTruthy();
    expect(getByText('BG')).toBeTruthy();
  });
});
