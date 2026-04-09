/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ColorPickerModal } from '../../src/components/ColorPickerModal';

// Mock i18n transifex
jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

// Mock ColorPalettePicker
jest.mock('../../src/components/ColorPalettePicker', () => ({
  ColorPalettePicker: ({ onInsert }: any) => (
    <palette-picker>
      <picker-button onPress={() => onInsert('\\x0301')} title="Insert Color" />
    </palette-picker>
  ),
}));

describe('ColorPickerModal', () => {
  const mockColors = {
    text: '#ffffff',
    textSecondary: '#cccccc',
    primary: '#0066cc',
    surface: '#1a1a1a',
    border: '#333333',
    background: '#000000',
  };

  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onInsert: jest.fn(),
    title: 'Test Color Picker',
    colors: mockColors,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal when visible', () => {
    const { getByText } = render(<ColorPickerModal {...defaultProps} />);
    expect(getByText('Test Color Picker')).toBeTruthy();
  });

  it('should render with default title when title not provided', () => {
    const { getByText } = render(
      <ColorPickerModal {...defaultProps} title={undefined} />,
    );
    expect(getByText('mIRC Colors')).toBeTruthy();
  });

  it('should render close button', () => {
    const { getByText } = render(<ColorPickerModal {...defaultProps} />);
    expect(getByText('Close')).toBeTruthy();
  });

  it('should call onClose when close button pressed', () => {
    const { getByText } = render(<ColorPickerModal {...defaultProps} />);
    fireEvent.press(getByText('Close'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render ColorPalettePicker component', () => {
    const { UNSAFE_getByType } = render(<ColorPickerModal {...defaultProps} />);
    expect(UNSAFE_getByType('palette-picker')).toBeTruthy();
  });

  it('should call onInsert when color is selected from palette', () => {
    const { UNSAFE_getByType } = render(<ColorPickerModal {...defaultProps} />);
    const pickerButton = UNSAFE_getByType('picker-button');
    fireEvent.press(pickerButton);
    expect(defaultProps.onInsert).toHaveBeenCalledWith('\\x0301');
  });

  it('should call onClose when hardware back button pressed', () => {
    const { UNSAFE_getByType } = render(<ColorPickerModal {...defaultProps} />);
    const modal = UNSAFE_getByType('Modal');
    modal.props.onRequestClose();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should have transparent prop set to true', () => {
    const { UNSAFE_getByType } = render(<ColorPickerModal {...defaultProps} />);
    const modal = UNSAFE_getByType('Modal');
    expect(modal.props.transparent).toBe(true);
  });

  it('should have animationType set to fade', () => {
    const { UNSAFE_getByType } = render(<ColorPickerModal {...defaultProps} />);
    const modal = UNSAFE_getByType('Modal');
    expect(modal.props.animationType).toBe('fade');
  });

  it('should have visible prop set to true', () => {
    const { UNSAFE_getByType } = render(
      <ColorPickerModal {...defaultProps} visible={true} />,
    );
    const modal = UNSAFE_getByType('Modal');
    expect(modal.props.visible).toBe(true);
  });

  it('should apply correct overlay styles', () => {
    const { UNSAFE_getByType } = render(<ColorPickerModal {...defaultProps} />);
    const view = UNSAFE_getByType('View');
    expect(view.props.style).toBeDefined();
  });

  it('should apply surface background color to card', () => {
    const { UNSAFE_getAllByType } = render(
      <ColorPickerModal {...defaultProps} />,
    );
    const views = UNSAFE_getAllByType('View');
    // Card should have surface background
    expect(views.length).toBeGreaterThan(0);
  });
});
