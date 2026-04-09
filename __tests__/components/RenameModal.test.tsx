/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for RenameModal component - Wave 5
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RenameModal } from '../../src/components/RenameModal';

const mockStyles = {
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    borderRadius: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  modalButton: { padding: 12, marginLeft: 8 },
  modalButtonCancel: { backgroundColor: '#ccc' },
  modalButtonJoin: { backgroundColor: '#007AFF' },
  modalButtonText: { color: '#000' },
  modalButtonTextPrimary: { color: '#fff' },
};

describe('RenameModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    value: '',
    onChangeValue: jest.fn(),
    onRename: jest.fn(),
    styles: mockStyles,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when visible', () => {
    const { getByText } = render(<RenameModal {...defaultProps} />);
    expect(getByText('Rename Server Tab')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByText } = render(
      <RenameModal {...defaultProps} visible={false} />,
    );
    expect(queryByText('Rename Server Tab')).toBeNull();
  });

  it('should call onClose when Cancel is pressed', () => {
    const { getByText } = render(<RenameModal {...defaultProps} />);
    fireEvent.press(getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should call onClose and onRename when Rename is pressed', () => {
    const { getByText } = render(<RenameModal {...defaultProps} />);
    fireEvent.press(getByText('Rename'));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onRename).toHaveBeenCalled();
  });

  it('should call onChangeValue when text is entered', () => {
    const { getByPlaceholderText } = render(<RenameModal {...defaultProps} />);
    const input = getByPlaceholderText('Enter new name');
    fireEvent.changeText(input, 'New Server Name');
    expect(defaultProps.onChangeValue).toHaveBeenCalledWith('New Server Name');
  });

  it('should display current value in input', () => {
    const { getByDisplayValue } = render(
      <RenameModal {...defaultProps} value="Current Name" />,
    );
    expect(getByDisplayValue('Current Name')).toBeTruthy();
  });

  it('should have autoCapitalize set to none', () => {
    const { getByPlaceholderText } = render(<RenameModal {...defaultProps} />);
    const input = getByPlaceholderText('Enter new name');
    expect(input.props.autoCapitalize).toBe('none');
  });

  it('should have autoCorrect set to false', () => {
    const { getByPlaceholderText } = render(<RenameModal {...defaultProps} />);
    const input = getByPlaceholderText('Enter new name');
    expect(input.props.autoCorrect).toBe(false);
  });
});
