/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ChannelNoteModal component - Wave 5
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ChannelNoteModal } from '../../src/components/ChannelNoteModal';

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

describe('ChannelNoteModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    channelName: '#test',
    value: '',
    onChangeValue: jest.fn(),
    onSave: jest.fn(),
    styles: mockStyles,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when visible', () => {
    const { getByText } = render(<ChannelNoteModal {...defaultProps} />);
    expect(getByText('Channel Note (#test)')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByText } = render(
      <ChannelNoteModal {...defaultProps} visible={false} />,
    );
    expect(queryByText('Channel Note (#test)')).toBeNull();
  });

  it('should display channel name in title', () => {
    const { getByText } = render(
      <ChannelNoteModal {...defaultProps} channelName="#android" />,
    );
    expect(getByText('Channel Note (#android)')).toBeTruthy();
  });

  it('should call onClose when Cancel is pressed', () => {
    const { getByText } = render(<ChannelNoteModal {...defaultProps} />);
    fireEvent.press(getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should call onClose and onSave when Save is pressed', () => {
    const { getByText } = render(<ChannelNoteModal {...defaultProps} />);
    fireEvent.press(getByText('Save'));
    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  it('should call onChangeValue when text is entered', () => {
    const { getByPlaceholderText } = render(
      <ChannelNoteModal {...defaultProps} />,
    );
    const input = getByPlaceholderText('Enter a note for this channel');
    fireEvent.changeText(input, 'This is a test note');
    expect(defaultProps.onChangeValue).toHaveBeenCalledWith(
      'This is a test note',
    );
  });

  it('should display current value in input', () => {
    const { getByDisplayValue } = render(
      <ChannelNoteModal {...defaultProps} value="Current note" />,
    );
    expect(getByDisplayValue('Current note')).toBeTruthy();
  });

  it('should have multiline input', () => {
    const { getByPlaceholderText } = render(
      <ChannelNoteModal {...defaultProps} />,
    );
    const input = getByPlaceholderText('Enter a note for this channel');
    expect(input.props.multiline).toBe(true);
  });

  it('should call onClose when modal is requested to close', () => {
    const { UNSAFE_getByType } = render(<ChannelNoteModal {...defaultProps} />);
    const modal = UNSAFE_getByType('Modal');
    modal.props.onRequestClose();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should handle empty note', () => {
    const { getByText, getByPlaceholderText } = render(
      <ChannelNoteModal {...defaultProps} value="" />,
    );
    expect(getByPlaceholderText('Enter a note for this channel')).toBeTruthy();
    fireEvent.press(getByText('Save'));
    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  it('should handle long notes', () => {
    const longNote = 'A'.repeat(1000);
    const { getByDisplayValue } = render(
      <ChannelNoteModal {...defaultProps} value={longNote} />,
    );
    expect(getByDisplayValue(longNote)).toBeTruthy();
  });

  it('should handle special characters in note', () => {
    const specialNote = 'Note with émojis 🎉 and special chars: <>&"\'';
    const { getByDisplayValue } = render(
      <ChannelNoteModal {...defaultProps} value={specialNote} />,
    );
    expect(getByDisplayValue(specialNote)).toBeTruthy();
  });
});
