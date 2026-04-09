/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for JoinChannelModal component - Wave 5
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { JoinChannelModal } from '../../src/components/JoinChannelModal';

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

describe('JoinChannelModal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    channelName: '',
    onChangeChannelName: jest.fn(),
    onJoin: jest.fn(),
    onCancel: jest.fn(),
    styles: mockStyles,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when visible', () => {
    const { getByText } = render(<JoinChannelModal {...defaultProps} />);
    expect(getByText('Join Channel')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByText } = render(
      <JoinChannelModal {...defaultProps} visible={false} />,
    );
    expect(queryByText('Join Channel')).toBeNull();
  });

  it('should call onCancel when Cancel is pressed', () => {
    const { getByText } = render(<JoinChannelModal {...defaultProps} />);
    fireEvent.press(getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('should call onJoin when Join is pressed with valid channel name', () => {
    const { getByText } = render(
      <JoinChannelModal {...defaultProps} channelName="#test" />,
    );
    fireEvent.press(getByText('Join'));
    expect(defaultProps.onJoin).toHaveBeenCalledWith('#test');
  });

  it('should trim channel name when joining', () => {
    const { getByText } = render(
      <JoinChannelModal {...defaultProps} channelName="  #test  " />,
    );
    fireEvent.press(getByText('Join'));
    expect(defaultProps.onJoin).toHaveBeenCalledWith('#test');
  });

  it('should not call onJoin when channel name is empty', () => {
    const { getByText } = render(
      <JoinChannelModal {...defaultProps} channelName="" />,
    );
    fireEvent.press(getByText('Join'));
    expect(defaultProps.onJoin).not.toHaveBeenCalled();
  });

  it('should not call onJoin when channel name is only whitespace', () => {
    const { getByText } = render(
      <JoinChannelModal {...defaultProps} channelName="   " />,
    );
    fireEvent.press(getByText('Join'));
    expect(defaultProps.onJoin).not.toHaveBeenCalled();
  });

  it('should call onChangeChannelName when text is entered', () => {
    const { getByPlaceholderText } = render(
      <JoinChannelModal {...defaultProps} />,
    );
    const input = getByPlaceholderText('Enter channel name (e.g., #android)');
    fireEvent.changeText(input, '#newchannel');
    expect(defaultProps.onChangeChannelName).toHaveBeenCalledWith(
      '#newchannel',
    );
  });

  it('should display current channel name in input', () => {
    const { getByDisplayValue } = render(
      <JoinChannelModal {...defaultProps} channelName="#current" />,
    );
    expect(getByDisplayValue('#current')).toBeTruthy();
  });

  it('should have autoCapitalize set to none', () => {
    const { getByPlaceholderText } = render(
      <JoinChannelModal {...defaultProps} />,
    );
    const input = getByPlaceholderText('Enter channel name (e.g., #android)');
    expect(input.props.autoCapitalize).toBe('none');
  });

  it('should have autoCorrect set to false', () => {
    const { getByPlaceholderText } = render(
      <JoinChannelModal {...defaultProps} />,
    );
    const input = getByPlaceholderText('Enter channel name (e.g., #android)');
    expect(input.props.autoCorrect).toBe(false);
  });

  it('should call onJoin when submit is pressed on input', () => {
    const { getByPlaceholderText } = render(
      <JoinChannelModal {...defaultProps} channelName="#test" />,
    );
    const input = getByPlaceholderText('Enter channel name (e.g., #android)');
    fireEvent(input, 'submitEditing');
    expect(defaultProps.onJoin).toHaveBeenCalledWith('#test');
  });

  it('should not call onJoin on submit when channel name is whitespace only', () => {
    const { getByPlaceholderText } = render(
      <JoinChannelModal {...defaultProps} channelName="   " />,
    );
    const input = getByPlaceholderText('Enter channel name (e.g., #android)');
    fireEvent(input, 'submitEditing');
    expect(defaultProps.onJoin).not.toHaveBeenCalled();
  });

  it('should disable Join button until trimmed channel name exists', () => {
    const { UNSAFE_root, rerender } = render(
      <JoinChannelModal {...defaultProps} channelName="   " />,
    );

    const getDisabledButtons = () =>
      UNSAFE_root.findAll(node => typeof node.props?.disabled !== 'undefined');

    expect(getDisabledButtons()[0].props.disabled).toBe(true);

    rerender(<JoinChannelModal {...defaultProps} channelName="#android" />);
    expect(getDisabledButtons()[0].props.disabled).toBe(false);
  });

  it('should not call onJoin when Join is pressed with empty channel name', () => {
    const { getByText } = render(
      <JoinChannelModal {...defaultProps} channelName="" />,
    );
    fireEvent.press(getByText('Join'));
    expect(defaultProps.onJoin).not.toHaveBeenCalled();
  });

  it('should call onJoin when Join is pressed with valid channel name', () => {
    const { getByText } = render(
      <JoinChannelModal {...defaultProps} channelName="#test" />,
    );
    fireEvent.press(getByText('Join'));
    expect(defaultProps.onJoin).toHaveBeenCalledWith('#test');
  });

  it('should call onClose when modal is requested to close', () => {
    const { UNSAFE_getByType } = render(<JoinChannelModal {...defaultProps} />);
    const modal = UNSAFE_getByType('Modal');
    modal.props.onRequestClose();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
