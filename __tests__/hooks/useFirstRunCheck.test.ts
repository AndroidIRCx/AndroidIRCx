/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useFirstRunCheck.test.ts
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useFirstRunCheck } from '../../src/hooks/useFirstRunCheck';

const mockStorage: Map<string, string> = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    getItem: jest.fn(async (key: string) => mockStorage.get(key) || null),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    isFirstRun: jest.fn(),
  },
}));
const mockSettingsService = jest.requireMock<any>(
  '../../src/services/SettingsService',
).settingsService;

describe('useFirstRunCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
  });

  it('should show first run setup when isFirstRun returns true', async () => {
    mockSettingsService.isFirstRun.mockResolvedValue(true);
    const setShowFirstRunSetup = jest.fn();
    const setIsCheckingFirstRun = jest.fn();

    renderHook(() =>
      useFirstRunCheck({ setShowFirstRunSetup, setIsCheckingFirstRun }),
    );

    await waitFor(() => {
      expect(setShowFirstRunSetup).toHaveBeenCalledWith(true);
      expect(setIsCheckingFirstRun).toHaveBeenCalledWith(false);
    });
  });

  it('should NOT show first run setup when isFirstRun returns false', async () => {
    mockSettingsService.isFirstRun.mockResolvedValue(false);
    const setShowFirstRunSetup = jest.fn();
    const setIsCheckingFirstRun = jest.fn();

    renderHook(() =>
      useFirstRunCheck({ setShowFirstRunSetup, setIsCheckingFirstRun }),
    );

    await waitFor(() => {
      expect(setShowFirstRunSetup).toHaveBeenCalledWith(false);
      expect(setIsCheckingFirstRun).toHaveBeenCalledWith(false);
    });
  });

  it('should handle errors gracefully', async () => {
    mockSettingsService.isFirstRun.mockRejectedValue(
      new Error('Storage error'),
    );
    const setShowFirstRunSetup = jest.fn();
    const setIsCheckingFirstRun = jest.fn();

    renderHook(() =>
      useFirstRunCheck({ setShowFirstRunSetup, setIsCheckingFirstRun }),
    );

    await waitFor(() => {
      expect(setIsCheckingFirstRun).toHaveBeenCalledWith(false);
    });

    // Should NOT call setShowFirstRunSetup on error
    expect(setShowFirstRunSetup).not.toHaveBeenCalled();
  });
});
