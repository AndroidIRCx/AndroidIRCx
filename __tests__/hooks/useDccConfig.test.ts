/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useDccConfig.test.ts
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useDccConfig } from '../../src/hooks/useDccConfig';

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

jest.mock('../../src/services/DCCFileService', () => ({
  dccFileService: {
    setPortRange: jest.fn(),
  },
}));
const mockDccFileService = jest.requireMock<any>(
  '../../src/services/DCCFileService',
).dccFileService;

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn(),
  },
}));
const mockSettingsService = jest.requireMock<any>(
  '../../src/services/SettingsService',
).settingsService;

describe('useDccConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
  });

  it('should load and apply DCC port range from settings', async () => {
    mockSettingsService.getSetting.mockResolvedValue({ min: 5000, max: 6000 });

    renderHook(() => useDccConfig());

    await waitFor(() => {
      expect(mockSettingsService.getSetting).toHaveBeenCalledWith(
        'dccPortRange',
        { min: 5000, max: 6000 },
      );
      expect(mockDccFileService.setPortRange).toHaveBeenCalledWith(5000, 6000);
    });
  });

  it('should apply custom port range', async () => {
    mockSettingsService.getSetting.mockResolvedValue({
      min: 10000,
      max: 20000,
    });

    renderHook(() => useDccConfig());

    await waitFor(() => {
      expect(mockDccFileService.setPortRange).toHaveBeenCalledWith(
        10000,
        20000,
      );
    });
  });

  it('should not set port range when config is invalid (no min)', async () => {
    mockSettingsService.getSetting.mockResolvedValue({ min: 0, max: 6000 });

    renderHook(() => useDccConfig());

    await waitFor(() => {
      expect(mockSettingsService.getSetting).toHaveBeenCalled();
    });

    expect(mockDccFileService.setPortRange).not.toHaveBeenCalled();
  });

  it('should not set port range when config is null', async () => {
    mockSettingsService.getSetting.mockResolvedValue(null);

    renderHook(() => useDccConfig());

    await waitFor(() => {
      expect(mockSettingsService.getSetting).toHaveBeenCalled();
    });

    expect(mockDccFileService.setPortRange).not.toHaveBeenCalled();
  });
});
