/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useFirstRunSetup.test.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useFirstRunSetup } from '../../src/hooks/useFirstRunSetup';

const mockStorage: Map<string, string> = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
    getItem: jest.fn(async (key: string) => mockStorage.get(key) || null),
    removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: jest.fn(),
  },
}));
const mockSetShowNetworksList = jest.fn();
jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: jest.fn(() => ({
      setShowNetworksList: mockSetShowNetworksList,
    })),
  },
}));
const mockSettingsService = jest.requireMock<any>('../../src/services/SettingsService').settingsService;

describe('useFirstRunSetup', () => {
  const mockSetShowFirstRunSetup = jest.fn();
  const mockHandleConnect = jest.fn(async () => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    mockSetShowNetworksList.mockReset();
  });

  it('should return handleFirstRunSetupComplete function', () => {
    const { result } = renderHook(() => useFirstRunSetup({
      setShowFirstRunSetup: mockSetShowFirstRunSetup,
      handleConnect: mockHandleConnect,
    }));

    expect(typeof result.current.handleFirstRunSetupComplete).toBe('function');
  });

  it('should hide first run setup and connect on completion', async () => {
    const savedNetwork = { id: 'net-1', name: 'DBase', nick: 'Nick', realname: 'User', servers: [] };
    mockSettingsService.loadNetworks.mockResolvedValue([savedNetwork]);

    const { result } = renderHook(() => useFirstRunSetup({
      setShowFirstRunSetup: mockSetShowFirstRunSetup,
      handleConnect: mockHandleConnect,
    }));

    await act(async () => {
      await result.current.handleFirstRunSetupComplete(savedNetwork);
    });

    expect(mockSetShowFirstRunSetup).toHaveBeenCalledWith(false);
    expect(mockHandleConnect).toHaveBeenCalledWith(savedNetwork);
  });

  it('should not connect when network is not found after reload', async () => {
    mockSettingsService.loadNetworks.mockResolvedValue([]);

    const { result } = renderHook(() => useFirstRunSetup({
      setShowFirstRunSetup: mockSetShowFirstRunSetup,
      handleConnect: mockHandleConnect,
    }));

    await act(async () => {
      await result.current.handleFirstRunSetupComplete({
        id: 'net-1',
        name: 'NonExistent',
        nick: 'Nick',
        realname: 'User',
        servers: [],
      } as any);
    });

    expect(mockSetShowFirstRunSetup).toHaveBeenCalledWith(false);
    expect(mockHandleConnect).not.toHaveBeenCalled();
  });

  it('should open Choose Network when setup finishes without a selected network', async () => {
    const { result } = renderHook(() => useFirstRunSetup({
      setShowFirstRunSetup: mockSetShowFirstRunSetup,
      handleConnect: mockHandleConnect,
    }));

    await act(async () => {
      await result.current.handleFirstRunSetupComplete(null);
    });

    expect(mockSetShowFirstRunSetup).toHaveBeenCalledWith(false);
    expect(mockSetShowNetworksList).toHaveBeenCalledWith(true);
    expect(mockHandleConnect).not.toHaveBeenCalled();
  });

  it('should return stable handleFirstRunSetupComplete reference', () => {
    const { result, rerender } = renderHook(() => useFirstRunSetup({
      setShowFirstRunSetup: mockSetShowFirstRunSetup,
      handleConnect: mockHandleConnect,
    }));

    const first = result.current.handleFirstRunSetupComplete;
    rerender();
    expect(result.current.handleFirstRunSetupComplete).toBe(first);
  });
});
