/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DccTransfersMinimizedIndicator } from '../../src/components/DccTransfersMinimizedIndicator';

describe('DccTransfersMinimizedIndicator', () => {
  const mockColors = {
    surface: '#1a1a1a',
    text: '#ffffff',
    primary: '#0066cc',
    textSecondary: '#888888',
  };

  const createMockTransfer = (overrides: Partial<any> = {}): any => ({
    offer: {
      filename: 'test-file.zip',
      size: 1000000,
      ...overrides.offer,
    },
    status: 'downloading',
    bytesReceived: 500000,
    ...overrides,
  });

  const defaultProps = {
    visible: true,
    transfers: [createMockTransfer()],
    onPress: jest.fn(),
    colors: mockColors,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when not visible', () => {
    const { UNSAFE_root } = render(
      <DccTransfersMinimizedIndicator {...defaultProps} visible={false} />,
    );
    expect(UNSAFE_root.children).toHaveLength(0);
  });

  it('should return null when no active transfers', () => {
    const { UNSAFE_root } = render(
      <DccTransfersMinimizedIndicator {...defaultProps} transfers={[]} />,
    );
    expect(UNSAFE_root.children).toHaveLength(0);
  });

  it('should return null when all transfers are completed', () => {
    const completedTransfer = createMockTransfer({ status: 'completed' });
    const { UNSAFE_root } = render(
      <DccTransfersMinimizedIndicator
        {...defaultProps}
        transfers={[completedTransfer]}
      />,
    );
    expect(UNSAFE_root.children).toHaveLength(0);
  });

  it('should render when there are downloading transfers', () => {
    const { getByText } = render(
      <DccTransfersMinimizedIndicator {...defaultProps} />,
    );
    expect(getByText('test-file.zip')).toBeTruthy();
  });

  it('should render when there are sending transfers', () => {
    const sendingTransfer = createMockTransfer({ status: 'sending' });
    const { getByText } = render(
      <DccTransfersMinimizedIndicator
        {...defaultProps}
        transfers={[sendingTransfer]}
      />,
    );
    expect(getByText('test-file.zip')).toBeTruthy();
  });

  it('should display transfer count', () => {
    const { getByText } = render(
      <DccTransfersMinimizedIndicator {...defaultProps} />,
    );
    expect(getByText(/transfer/)).toBeTruthy();
  });

  it('should display multiple transfers text', () => {
    const transfers = [
      createMockTransfer({ offer: { filename: 'file1.zip', size: 1000000 } }),
      createMockTransfer({ offer: { filename: 'file2.zip', size: 1000000 } }),
    ];
    const { getByText } = render(
      <DccTransfersMinimizedIndicator
        {...defaultProps}
        transfers={transfers}
      />,
    );
    expect(getByText(/2 transfers/)).toBeTruthy();
  });

  it('should show first filename with count for multiple transfers', () => {
    const transfers = [
      createMockTransfer({
        offer: { filename: 'first-file.zip', size: 1000000 },
      }),
      createMockTransfer({
        offer: { filename: 'second-file.zip', size: 1000000 },
      }),
      createMockTransfer({
        offer: { filename: 'third-file.zip', size: 1000000 },
      }),
    ];
    const { getByText } = render(
      <DccTransfersMinimizedIndicator
        {...defaultProps}
        transfers={transfers}
      />,
    );
    expect(getByText('first-file.zip (+2 more)')).toBeTruthy();
  });

  it('should render download icon', () => {
    const { getByText } = render(
      <DccTransfersMinimizedIndicator {...defaultProps} />,
    );
    expect(getByText('📥')).toBeTruthy();
  });

  it('should render progress bar', () => {
    const { UNSAFE_getAllByType } = render(
      <DccTransfersMinimizedIndicator {...defaultProps} />,
    );
    const views = UNSAFE_getAllByType('View');
    // Should have multiple views including progress bar
    expect(views.length).toBeGreaterThan(1);
  });

  it('should filter out failed transfers', () => {
    const transfers = [createMockTransfer({ status: 'failed' })];
    const { UNSAFE_root } = render(
      <DccTransfersMinimizedIndicator
        {...defaultProps}
        transfers={transfers}
      />,
    );
    expect(UNSAFE_root.children).toHaveLength(0);
  });

  it('should filter out rejected transfers', () => {
    const transfers = [createMockTransfer({ status: 'rejected' })];
    const { UNSAFE_root } = render(
      <DccTransfersMinimizedIndicator
        {...defaultProps}
        transfers={transfers}
      />,
    );
    expect(UNSAFE_root.children).toHaveLength(0);
  });

  it('should show only active transfers in count', () => {
    const transfers = [
      createMockTransfer({
        status: 'downloading',
        offer: { filename: 'active.zip', size: 1000000 },
      }),
      createMockTransfer({ status: 'completed' }),
      createMockTransfer({ status: 'failed' }),
    ];
    const { getByText } = render(
      <DccTransfersMinimizedIndicator
        {...defaultProps}
        transfers={transfers}
      />,
    );
    // Only 1 downloading transfer should be shown
    expect(getByText(/1 transfer/)).toBeTruthy();
  });

  it('should handle zero bytes received', () => {
    const transfer = createMockTransfer({
      bytesReceived: 0,
      offer: { filename: 'test.zip', size: 1000000 },
    });
    const { getByText } = render(
      <DccTransfersMinimizedIndicator
        {...defaultProps}
        transfers={[transfer]}
      />,
    );
    expect(getByText('1 transfer - 0%')).toBeTruthy();
  });

  it('should handle undefined size gracefully', () => {
    const transfer = createMockTransfer({
      offer: { filename: 'no-size.txt', size: undefined },
    });
    const { getByText } = render(
      <DccTransfersMinimizedIndicator
        {...defaultProps}
        transfers={[transfer]}
      />,
    );
    // With undefined size, percentage should be 0%
    expect(getByText('1 transfer - 0%')).toBeTruthy();
  });

  it('should call onPress and render computed progress width', () => {
    const onPress = jest.fn();
    const transfers = [
      createMockTransfer({
        offer: { filename: 'big.zip' },
        size: 200,
        bytesReceived: 50,
      }),
      createMockTransfer({
        offer: { filename: 'small.zip' },
        size: 200,
        bytesReceived: 50,
      }),
    ];

    const { getByText, UNSAFE_root } = render(
      <DccTransfersMinimizedIndicator
        {...defaultProps}
        transfers={transfers}
        onPress={onPress}
      />,
    );

    fireEvent.press(getByText('big.zip (+1 more)'));
    expect(onPress).toHaveBeenCalled();

    const widthNode = UNSAFE_root.find(node =>
      node.props?.style?.some?.((style: any) => style?.width === '25%'),
    );
    expect(widthNode).toBeTruthy();
  });
});
