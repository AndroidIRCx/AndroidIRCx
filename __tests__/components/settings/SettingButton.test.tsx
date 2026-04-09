/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for SettingButton component - Wave 5
 */

import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingButton } from '../../../src/components/settings/SettingButton';

jest.mock('react-native-vector-icons/FontAwesome5', () => 'Icon');

describe('SettingButton', () => {
  const mockColors = {
    primary: '#007AFF',
    textSecondary: '#666666',
  };

  const mockStyles = {
    settingItem: { padding: 16 },
    settingContent: { flex: 1 },
    settingTitleRow: { flexDirection: 'row', alignItems: 'center' },
    settingTitle: { fontSize: 16 },
    settingDescription: { fontSize: 14, color: '#666' },
    disabledItem: { opacity: 0.5 },
    disabledText: { color: '#999' },
    chevron: { fontSize: 18 },
  };

  const baseItem = {
    type: 'button' as const,
    key: 'test-button',
    title: 'Test Button',
  };

  it('should render button with title', () => {
    const { getByText } = render(
      <SettingButton
        item={baseItem}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onPress={jest.fn()}
      />,
    );

    expect(getByText('Test Button')).toBeTruthy();
  });

  it('should render chevron', () => {
    const { getByText } = render(
      <SettingButton
        item={baseItem}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onPress={jest.fn()}
      />,
    );

    expect(getByText('›')).toBeTruthy();
  });

  it('should render button with description', () => {
    const item = {
      ...baseItem,
      description: 'This is a test description',
    };

    const { getByText } = render(
      <SettingButton
        item={item}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onPress={jest.fn()}
      />,
    );

    expect(getByText('Test Button')).toBeTruthy();
    expect(getByText('This is a test description')).toBeTruthy();
  });

  it('should render with icon', () => {
    const { root } = render(
      <SettingButton
        item={baseItem}
        icon={{ name: 'cog', solid: true }}
        colors={mockColors}
        styles={mockStyles}
        onPress={jest.fn()}
      />,
    );

    expect(root).toBeTruthy();
  });

  it('should call onPress when button is pressed', () => {
    const mockOnPress = jest.fn();

    const { getByText } = render(
      <SettingButton
        item={baseItem}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onPress={mockOnPress}
      />,
    );

    fireEvent.press(
      getByText('Test Button').parent?.parent || getByText('Test Button'),
    );

    expect(mockOnPress).toHaveBeenCalled();
  });

  it('should render disabled state', () => {
    const item = {
      ...baseItem,
      disabled: true,
    };

    const { getByText } = render(
      <SettingButton
        item={item}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onPress={jest.fn()}
      />,
    );

    expect(getByText('Test Button')).toBeTruthy();
  });

  it('should render with descriptionNode', () => {
    const item = {
      ...baseItem,
      descriptionNode: <Text testID="custom-node">Custom Node</Text>,
    };

    const { getByTestId } = render(
      <SettingButton
        item={item}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onPress={jest.fn()}
      />,
    );

    expect(getByTestId('custom-node')).toBeTruthy();
  });

  it('should render with numeric description', () => {
    const item = {
      ...baseItem,
      description: 123,
    };

    const { getByText } = render(
      <SettingButton
        item={item}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onPress={jest.fn()}
      />,
    );

    expect(getByText('123')).toBeTruthy();
  });
});
