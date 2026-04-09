/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useServerTabNameSync hook
 */

import { renderHook } from '@testing-library/react-hooks';
import { useServerTabNameSync } from '../../src/hooks/useServerTabNameSync';
import { useTabStore } from '../../src/stores/tabStore';

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: jest.fn(),
  },
}));

describe('useServerTabNameSync', () => {
  const mockUpdateTab = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTabStore.getState as jest.Mock).mockReturnValue({
      tabs: [],
      updateTab: mockUpdateTab,
    });
  });

  it('should not throw when networkName is empty', () => {
    expect(() => {
      renderHook(() => useServerTabNameSync({ networkName: '' }));
    }).not.toThrow();
  });

  it('should not throw when networkName is "Not connected"', () => {
    expect(() => {
      renderHook(() => useServerTabNameSync({ networkName: 'Not connected' }));
    }).not.toThrow();
  });

  it('should not throw with valid network name', () => {
    expect(() => {
      renderHook(() => useServerTabNameSync({ networkName: 'freenode' }));
    }).not.toThrow();
  });

  it('should handle network name changes', () => {
    const { rerender } = renderHook(
      ({ networkName }) => useServerTabNameSync({ networkName }),
      { initialProps: { networkName: 'freenode' } },
    );

    // Should not throw on rerender with same value
    expect(() => {
      rerender({ networkName: 'freenode' });
    }).not.toThrow();

    // Should not throw on rerender with different value
    expect(() => {
      rerender({ networkName: 'dalnet' });
    }).not.toThrow();
  });

  it('should handle transition from empty to valid network', () => {
    const { rerender } = renderHook(
      ({ networkName }) => useServerTabNameSync({ networkName }),
      { initialProps: { networkName: '' } },
    );

    expect(() => {
      rerender({ networkName: 'freenode' });
    }).not.toThrow();
  });

  it('should handle transition from valid to empty network', () => {
    const { rerender } = renderHook(
      ({ networkName }) => useServerTabNameSync({ networkName }),
      { initialProps: { networkName: 'freenode' } },
    );

    expect(() => {
      rerender({ networkName: '' });
    }).not.toThrow();
  });

  it('should update only matching server tabs whose names differ', () => {
    (useTabStore.getState as jest.Mock).mockReturnValue({
      tabs: [
        { id: '1', type: 'server', networkId: 'dalnet', name: 'Old Name' },
        { id: '2', type: 'server', networkId: 'dalnet', name: 'dalnet' },
        { id: '3', type: 'channel', networkId: 'dalnet', name: '#chat' },
        { id: '4', type: 'server', networkId: 'othernet', name: 'Other' },
      ],
      updateTab: mockUpdateTab,
    });

    const { rerender } = renderHook(
      ({ networkName }) => useServerTabNameSync({ networkName }),
      { initialProps: { networkName: 'freenode' } },
    );

    rerender({ networkName: 'dalnet' });

    expect(mockUpdateTab).toHaveBeenCalledTimes(1);
    expect(mockUpdateTab).toHaveBeenCalledWith('1', { name: 'dalnet' });
  });

  it('should not update tabs when names already match', () => {
    (useTabStore.getState as jest.Mock).mockReturnValue({
      tabs: [{ id: '1', type: 'server', networkId: 'dalnet', name: 'dalnet' }],
      updateTab: mockUpdateTab,
    });

    const { rerender } = renderHook(
      ({ networkName }) => useServerTabNameSync({ networkName }),
      { initialProps: { networkName: 'freenode' } },
    );

    rerender({ networkName: 'dalnet' });

    expect(mockUpdateTab).not.toHaveBeenCalled();
  });

  it('should not touch store when rerendered with the same network name', () => {
    const { rerender } = renderHook(
      ({ networkName }) => useServerTabNameSync({ networkName }),
      { initialProps: { networkName: 'dalnet' } },
    );

    rerender({ networkName: 'dalnet' });

    expect(useTabStore.getState).not.toHaveBeenCalled();
    expect(mockUpdateTab).not.toHaveBeenCalled();
  });

  it('should ignore Not connected during updates', () => {
    const { rerender } = renderHook(
      ({ networkName }) => useServerTabNameSync({ networkName }),
      { initialProps: { networkName: 'freenode' } },
    );

    rerender({ networkName: 'Not connected' });

    expect(useTabStore.getState).not.toHaveBeenCalled();
    expect(mockUpdateTab).not.toHaveBeenCalled();
  });
});
