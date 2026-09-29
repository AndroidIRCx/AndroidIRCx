/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { TextInput } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('../../src/i18n/localization', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('react-native-vector-icons/FontAwesome5', () => {
  const { Text } = require('react-native');
  return ({ name }: { name: string }) => <Text>{name}</Text>;
});

import { PasswordInput } from '../../src/components/PasswordInput';

describe('PasswordInput', () => {
  it('starts hidden', async () => {
    const { UNSAFE_getByType, getByText } = await render(
      <PasswordInput value="hunter2" onChangeText={jest.fn()} />,
    );

    expect(UNSAFE_getByType(TextInput).props.secureTextEntry).toBe(true);
    expect(getByText('eye')).toBeTruthy();
  });

  it('reveals on a tap and hides again on the next one', async () => {
    const { UNSAFE_getByType, getByText, getByLabelText } = await render(
      <PasswordInput value="hunter2" onChangeText={jest.fn()} />,
    );

    await fireEvent.press(getByLabelText('Show password'));
    expect(UNSAFE_getByType(TextInput).props.secureTextEntry).toBe(false);
    expect(getByText('eye-slash')).toBeTruthy();

    await fireEvent.press(getByLabelText('Hide password'));
    expect(UNSAFE_getByType(TextInput).props.secureTextEntry).toBe(true);
    expect(getByText('eye')).toBeTruthy();
  });

  it('remembers nothing beyond the one field being looked at', async () => {
    const { getAllByLabelText, getByTestId } = await render(
      <>
        <PasswordInput value="a" onChangeText={jest.fn()} testID="first" />
        <PasswordInput value="b" onChangeText={jest.fn()} testID="second" />
      </>,
    );

    await fireEvent.press(getAllByLabelText('Show password')[0]);

    // Revealing one field says nothing about any other, on this screen or the
    // next: the state lives in the component and nowhere else.
    expect(getByTestId('first').props.secureTextEntry).toBe(false);
    expect(getByTestId('second').props.secureTextEntry).toBe(true);
  });

  it('passes typing straight through, once', async () => {
    const onChangeText = jest.fn();
    const { UNSAFE_getByType } = await render(
      <PasswordInput value="" onChangeText={onChangeText} />,
    );

    await fireEvent.changeText(UNSAFE_getByType(TextInput), 'sekrit');

    expect(onChangeText).toHaveBeenCalledTimes(1);
    expect(onChangeText).toHaveBeenCalledWith('sekrit');
  });

  it('forwards the props a caller sets', async () => {
    const { UNSAFE_getByType } = await render(
      <PasswordInput
        value="x"
        onChangeText={jest.fn()}
        placeholder="SASL password"
        testID="sasl-password"
        maxLength={64}
      />,
    );

    const input = UNSAFE_getByType(TextInput);
    expect(input.props.placeholder).toBe('SASL password');
    expect(input.props.testID).toBe('sasl-password');
    expect(input.props.maxLength).toBe(64);
  });

  it('turns off autocorrect and capitalisation, since a password is neither', async () => {
    const { UNSAFE_getByType } = await render(
      <PasswordInput value="x" onChangeText={jest.fn()} />,
    );

    const input = UNSAFE_getByType(TextInput);
    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.autoCorrect).toBe(false);
  });

  it('lets a caller override those', async () => {
    const { UNSAFE_getByType } = await render(
      <PasswordInput
        value="x"
        onChangeText={jest.fn()}
        autoCapitalize="words"
        autoCorrect
      />,
    );

    const input = UNSAFE_getByType(TextInput);
    expect(input.props.autoCapitalize).toBe('words');
    expect(input.props.autoCorrect).toBe(true);
  });

  it('cannot be revealed while the field is disabled', async () => {
    const { UNSAFE_getByType, getByLabelText } = await render(
      <PasswordInput value="x" onChangeText={jest.fn()} editable={false} />,
    );

    await fireEvent.press(getByLabelText('Show password'));

    expect(UNSAFE_getByType(TextInput).props.secureTextEntry).toBe(true);
  });
});
