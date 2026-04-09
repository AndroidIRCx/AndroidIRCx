/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useRawSettings hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useRawSettings } from '../../src/hooks/useRawSettings';

// Mock services
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    setSetting: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/IRCService', () => ({
  getDefaultRawCategoryVisibility: jest.fn().mockReturnValue({
    connection: true,
    messaging: true,
    channel: true,
    user: true,
    server: true,
  }),
}));

// Mock UI Store
const mockSetShowRawCommands = jest.fn();
const mockSetRawCategoryVisibility = jest.fn();

const mockUIStore = {
  setShowRawCommands: mockSetShowRawCommands,
  rawCategoryVisibility: {},
  setRawCategoryVisibility: mockSetRawCategoryVisibility,
};

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: Object.assign(
    jest.fn(selector => selector(mockUIStore)),
    { getState: jest.fn(() => mockUIStore) },
  ),
}));

import { settingsService } from '../../src/services/SettingsService';
import { getDefaultRawCategoryVisibility } from '../../src/services/IRCService';

describe('useRawSettings', () => {
  const mockSetShowEncryptionIndicators = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUIStore.rawCategoryVisibility = {};
  });

  it('should return all setting functions', () => {
    const { result } = renderHook(() =>
      useRawSettings({
        setShowEncryptionIndicators: mockSetShowEncryptionIndicators,
      }),
    );

    expect(result.current.persistentSetShowRawCommands).toBeDefined();
    expect(result.current.persistentSetRawCategoryVisibility).toBeDefined();
    expect(result.current.persistentSetShowEncryptionIndicators).toBeDefined();
  });

  it('should persist show raw commands setting', async () => {
    const { result } = renderHook(() =>
      useRawSettings({
        setShowEncryptionIndicators: mockSetShowEncryptionIndicators,
      }),
    );

    await act(async () => {
      await result.current.persistentSetShowRawCommands(true);
    });

    expect(mockSetShowRawCommands).toHaveBeenCalledWith(true);
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'showRawCommands',
      true,
    );
  });

  it('should not persist raw category visibility when raw commands are disabled', async () => {
    const { result } = renderHook(() =>
      useRawSettings({
        setShowEncryptionIndicators: mockSetShowEncryptionIndicators,
      }),
    );

    await act(async () => {
      await result.current.persistentSetShowRawCommands(false);
    });

    expect(mockSetShowRawCommands).toHaveBeenCalledWith(false);
    expect(mockSetRawCategoryVisibility).not.toHaveBeenCalled();
    expect(settingsService.setSetting).toHaveBeenCalledTimes(1);
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'showRawCommands',
      false,
    );
  });

  it('should normalize current store raw visibility when enabling raw commands', async () => {
    mockUIStore.rawCategoryVisibility = {
      connection: false,
      server: false,
    };
    const defaults = (getDefaultRawCategoryVisibility as jest.Mock).mock
      .results[0]?.value || {
      connection: true,
      messaging: true,
      channel: true,
      user: true,
      server: true,
    };

    const { result } = renderHook(() =>
      useRawSettings({
        setShowEncryptionIndicators: mockSetShowEncryptionIndicators,
      }),
    );

    await act(async () => {
      await result.current.persistentSetShowRawCommands(true);
    });

    expect(mockSetRawCategoryVisibility).toHaveBeenCalledWith({
      ...defaults,
      connection: false,
      server: false,
    });
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'rawCategoryVisibility',
      expect.objectContaining({
        connection: false,
        server: false,
        messaging: true,
      }),
    );
  });

  it('should normalize and persist raw category visibility', async () => {
    const { result } = renderHook(() =>
      useRawSettings({
        setShowEncryptionIndicators: mockSetShowEncryptionIndicators,
      }),
    );

    const visibility = { connection: false, messaging: true };

    await act(async () => {
      await result.current.persistentSetRawCategoryVisibility(visibility);
    });

    expect(mockSetRawCategoryVisibility).toHaveBeenCalled();
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'rawCategoryVisibility',
      expect.any(Object),
    );
  });

  it('should persist show encryption indicators setting', async () => {
    const { result } = renderHook(() =>
      useRawSettings({
        setShowEncryptionIndicators: mockSetShowEncryptionIndicators,
      }),
    );

    await act(async () => {
      await result.current.persistentSetShowEncryptionIndicators(true);
    });

    expect(mockSetShowEncryptionIndicators).toHaveBeenCalledWith(true);
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'showEncryptionIndicators',
      true,
    );
  });

  it('should normalize partial visibility settings', async () => {
    const { result } = renderHook(() =>
      useRawSettings({
        setShowEncryptionIndicators: mockSetShowEncryptionIndicators,
      }),
    );

    // Set with partial visibility
    await act(async () => {
      await result.current.persistentSetRawCategoryVisibility({
        connection: false,
      });
    });

    // Should merge with defaults
    const normalizedArg = mockSetRawCategoryVisibility.mock.calls[0][0];
    expect(normalizedArg).toHaveProperty('connection', false);
    expect(normalizedArg).toHaveProperty('messaging'); // from defaults
    expect(normalizedArg).toHaveProperty('channel'); // from defaults
  });
});
