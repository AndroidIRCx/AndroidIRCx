/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useUserManagementNetworkSync hook
 */

import { renderHook } from '@testing-library/react-hooks';
import { useUserManagementNetworkSync } from '../../src/hooks/useUserManagementNetworkSync';

// Mock UserManagementService
const mockSetNetwork = jest.fn();
const mockGetActiveUserManagementService = jest.fn().mockReturnValue({
  setNetwork: mockSetNetwork,
});

describe('useUserManagementNetworkSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set network when valid network name is provided', () => {
    renderHook(() =>
      useUserManagementNetworkSync({
        networkName: 'freenode',
        getActiveUserManagementService: mockGetActiveUserManagementService,
      }),
    );

    expect(mockGetActiveUserManagementService).toHaveBeenCalled();
    expect(mockSetNetwork).toHaveBeenCalledWith('freenode');
  });

  it('should not set network when networkName is empty', () => {
    renderHook(() =>
      useUserManagementNetworkSync({
        networkName: '',
        getActiveUserManagementService: mockGetActiveUserManagementService,
      }),
    );

    expect(mockSetNetwork).not.toHaveBeenCalled();
  });

  it('should not set network when networkName is "Not connected"', () => {
    renderHook(() =>
      useUserManagementNetworkSync({
        networkName: 'Not connected',
        getActiveUserManagementService: mockGetActiveUserManagementService,
      }),
    );

    expect(mockSetNetwork).not.toHaveBeenCalled();
  });

  it('should update network when networkName changes', () => {
    const { rerender } = renderHook(
      ({ networkName }) =>
        useUserManagementNetworkSync({
          networkName,
          getActiveUserManagementService: mockGetActiveUserManagementService,
        }),
      { initialProps: { networkName: 'freenode' } },
    );

    expect(mockSetNetwork).toHaveBeenCalledWith('freenode');

    rerender({ networkName: 'dalnet' });

    expect(mockSetNetwork).toHaveBeenCalledWith('dalnet');
  });

  it('should not call setNetwork when getActiveUserManagementService is not available', () => {
    renderHook(() =>
      useUserManagementNetworkSync({
        networkName: 'freenode',
        getActiveUserManagementService: () => null as any,
      }),
    );

    // Should not throw and should handle gracefully
    expect(mockSetNetwork).not.toHaveBeenCalled();
  });
});
