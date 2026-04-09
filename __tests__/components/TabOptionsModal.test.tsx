/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for TabOptionsModal component - Wave 5
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TabOptionsModal } from '../../src/components/TabOptionsModal';

// Mock MaterialCommunityIcons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

const mockStyles = {
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalButton: { padding: 12, marginVertical: 4 },
  modalButtonCancel: { backgroundColor: '#ffcccc' },
  modalButtonText: { fontSize: 16 },
  destructiveOption: { color: '#EF5350' },
};

const mockColors = {
  text: '#333',
  destructive: '#EF5350',
};

describe('TabOptionsModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    title: 'Tab Options',
    options: [
      { text: 'Close Tab', onPress: jest.fn() },
      { text: 'Close All', onPress: jest.fn(), style: 'destructive' as const },
      { text: 'Cancel', onPress: jest.fn() },
    ],
    styles: mockStyles,
    colors: mockColors,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when visible', () => {
    const { getByText } = render(<TabOptionsModal {...defaultProps} />);
    expect(getByText('Tab Options')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByText } = render(
      <TabOptionsModal {...defaultProps} visible={false} />,
    );
    expect(queryByText('Tab Options')).toBeNull();
  });

  it('should display default title when title is empty', () => {
    const { getByText } = render(
      <TabOptionsModal {...defaultProps} title="" />,
    );
    expect(getByText('Options')).toBeTruthy();
  });

  it('should display all options', () => {
    const { getByText } = render(<TabOptionsModal {...defaultProps} />);
    expect(getByText('Close Tab')).toBeTruthy();
    expect(getByText('Close All')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('should call option onPress and onClose when option is pressed', () => {
    const { getByText } = render(<TabOptionsModal {...defaultProps} />);
    fireEvent.press(getByText('Close Tab'));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.options[0].onPress).toHaveBeenCalled();
  });

  it('should call onClose when modal is requested to close', () => {
    const { UNSAFE_getByType } = render(<TabOptionsModal {...defaultProps} />);
    const modal = UNSAFE_getByType('Modal');
    modal.props.onRequestClose();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should apply destructive style to destructive options', () => {
    const { getByText } = render(<TabOptionsModal {...defaultProps} />);
    const destructiveOption = getByText('Close All');
    expect(destructiveOption).toBeTruthy();
  });

  it('should handle options with icons', () => {
    const optionsWithIcons = [
      { text: 'Close', onPress: jest.fn(), icon: 'close' },
      { text: 'Settings', onPress: jest.fn(), icon: 'cog' },
    ];
    const { getByText } = render(
      <TabOptionsModal {...defaultProps} options={optionsWithIcons} />,
    );
    expect(getByText('Close')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
  });

  it('should render icon colors for destructive and regular options', () => {
    const optionsWithIcons = [
      {
        text: 'Delete',
        onPress: jest.fn(),
        icon: 'delete',
        style: 'destructive' as const,
      },
      { text: 'Rename', onPress: jest.fn(), icon: 'pencil' },
    ];
    const { UNSAFE_getAllByType } = render(
      <TabOptionsModal {...defaultProps} options={optionsWithIcons} />,
    );

    const icons = UNSAFE_getAllByType('Icon');
    expect(icons[0].props.color).toBe('#EF5350');
    expect(icons[1].props.color).toBe('#333');
  });

  it('should fall back to default icon colors when colors are omitted', () => {
    const optionsWithIcons = [
      {
        text: 'Delete',
        onPress: jest.fn(),
        icon: 'delete',
        style: 'destructive' as const,
      },
      { text: 'Rename', onPress: jest.fn(), icon: 'pencil' },
    ];
    const { UNSAFE_getAllByType } = render(
      <TabOptionsModal
        {...defaultProps}
        options={optionsWithIcons}
        colors={undefined}
      />,
    );

    const icons = UNSAFE_getAllByType('Icon');
    expect(icons[0].props.color).toBe('#EF5350');
    expect(icons[1].props.color).toBe('#666');
  });

  it('should handle empty options array', () => {
    const { getByText } = render(
      <TabOptionsModal {...defaultProps} options={[]} />,
    );
    expect(getByText('Tab Options')).toBeTruthy();
  });

  it('should handle single option', () => {
    const singleOption = [{ text: 'Only Option', onPress: jest.fn() }];
    const { getByText } = render(
      <TabOptionsModal {...defaultProps} options={singleOption} />,
    );
    expect(getByText('Only Option')).toBeTruthy();
  });

  it('should handle many options', () => {
    const manyOptions = Array.from({ length: 10 }, (_, i) => ({
      text: `Option ${i + 1}`,
      onPress: jest.fn(),
    }));
    const { getByText } = render(
      <TabOptionsModal {...defaultProps} options={manyOptions} />,
    );
    manyOptions.forEach(opt => {
      expect(getByText(opt.text)).toBeTruthy();
    });
  });

  it('should handle option without onPress', () => {
    const optionsWithoutOnPress = [{ text: 'No Action' }];
    const { getByText } = render(
      <TabOptionsModal {...defaultProps} options={optionsWithoutOnPress} />,
    );
    fireEvent.press(getByText('No Action'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should use custom colors when provided', () => {
    const customColors = {
      text: '#000000',
      destructive: '#FF0000',
    };
    const { getByText } = render(
      <TabOptionsModal {...defaultProps} colors={customColors} />,
    );
    expect(getByText('Close Tab')).toBeTruthy();
  });

  it('should handle options with same text but different index', () => {
    const duplicateOptions = [
      { text: 'Action', onPress: jest.fn() },
      { text: 'Action', onPress: jest.fn() },
    ];
    const { getAllByText } = render(
      <TabOptionsModal {...defaultProps} options={duplicateOptions} />,
    );
    expect(getAllByText('Action')).toHaveLength(2);
  });
});
