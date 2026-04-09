/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for SettingSwitch component - Wave 5
 */

import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingSwitch } from '../../../src/components/settings/SettingSwitch';

jest.mock('react-native-vector-icons/FontAwesome5', () => 'Icon');

describe('SettingSwitch', () => {
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
  };

  const baseItem = {
    type: 'switch' as const,
    key: 'test-switch',
    title: 'Test Switch',
    value: false,
  };

  it('should render switch with title', () => {
    const { getByText } = render(
      <SettingSwitch
        item={baseItem}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onValueChange={jest.fn()}
      />,
    );

    expect(getByText('Test Switch')).toBeTruthy();
  });

  it('should render switch with description', () => {
    const item = {
      ...baseItem,
      description: 'This is a test description',
    };

    const { getByText } = render(
      <SettingSwitch
        item={item}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onValueChange={jest.fn()}
      />,
    );

    expect(getByText('Test Switch')).toBeTruthy();
    expect(getByText('This is a test description')).toBeTruthy();
  });

  it('should render with icon', () => {
    const item = {
      ...baseItem,
      value: true,
    };

    const { root } = render(
      <SettingSwitch
        item={item}
        icon={{ name: 'bell', solid: true }}
        colors={mockColors}
        styles={mockStyles}
        onValueChange={jest.fn()}
      />,
    );

    expect(root).toBeTruthy();
  });

  it('should call onValueChange when switch is toggled', () => {
    const mockOnValueChange = jest.fn();
    const item = {
      ...baseItem,
      value: false,
    };

    const { getByRole } = render(
      <SettingSwitch
        item={item}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onValueChange={mockOnValueChange}
      />,
    );

    const switchElement = getByRole('switch');
    fireEvent(switchElement, 'valueChange', true);

    expect(mockOnValueChange).toHaveBeenCalledWith(true);
  });

  it('should render disabled state', () => {
    const item = {
      ...baseItem,
      disabled: true,
      value: true,
    };

    const { getByRole, getByText } = render(
      <SettingSwitch
        item={item}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onValueChange={jest.fn()}
      />,
    );

    expect(getByText('Test Switch')).toBeTruthy();
    const switchElement = getByRole('switch');
    expect(switchElement.props.disabled).toBe(true);
  });

  it('should render with descriptionNode instead of description', () => {
    const item = {
      ...baseItem,
      descriptionNode: <Text testID="custom-node">Custom Node</Text>,
    };

    const { getByTestId } = render(
      <SettingSwitch
        item={item}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onValueChange={jest.fn()}
      />,
    );

    expect(getByTestId('custom-node')).toBeTruthy();
  });

  it('should render with numeric description', () => {
    const item = {
      ...baseItem,
      description: 42,
    };

    const { getByText } = render(
      <SettingSwitch
        item={item}
        icon={undefined}
        colors={mockColors}
        styles={mockStyles}
        onValueChange={jest.fn()}
      />,
    );

    expect(getByText('42')).toBeTruthy();
  });
});
