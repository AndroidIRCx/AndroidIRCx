/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useLayoutConfig.test.ts
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useLayoutConfig } from '../../src/hooks/useLayoutConfig';

const mockStorage: Map<string, string> = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
    getItem: jest.fn(async (key: string) => mockStorage.get(key) || null),
    removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
  },
}));

let configChangeCallback: Function | null = null;
const defaultConfig = {
  tabPosition: 'top',
  userListPosition: 'right',
  showUserList: true,
};

jest.mock('../../src/services/LayoutService', () => ({
  layoutService: {
    getConfig: jest.fn(() => ({
      tabPosition: 'top',
      userListPosition: 'right',
      showUserList: true,
    })),
    initialize: jest.fn(async () => {}),
    onConfigChange: jest.fn((cb: Function) => {
      configChangeCallback = cb;
      return () => { configChangeCallback = null; };
    }),
  },
}));
const mockLayoutService = jest.requireMock<any>('../../src/services/LayoutService').layoutService;

describe('useLayoutConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    configChangeCallback = null;
    mockLayoutService.getConfig.mockReturnValue(defaultConfig);
    mockLayoutService.initialize.mockResolvedValue(undefined);
    mockLayoutService.onConfigChange.mockImplementation((cb: Function) => {
      configChangeCallback = cb;
      return () => { configChangeCallback = null; };
    });
  });

  it('should return initial config', () => {
    const { result } = renderHook(() => useLayoutConfig());
    expect(result.current).toEqual(defaultConfig);
  });

  it('should initialize layout service on mount', async () => {
    renderHook(() => useLayoutConfig());

    await waitFor(() => {
      expect(mockLayoutService.initialize).toHaveBeenCalled();
    });
  });

  it('should subscribe to config changes', () => {
    renderHook(() => useLayoutConfig());
    expect(mockLayoutService.onConfigChange).toHaveBeenCalled();
  });

  it('should update config when onConfigChange fires', async () => {
    const { result } = renderHook(() => useLayoutConfig());

    const newConfig = { tabPosition: 'bottom', userListPosition: 'left', showUserList: false };

    await act(async () => {
      configChangeCallback?.(newConfig);
    });

    expect(result.current).toEqual(newConfig);
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useLayoutConfig());

    expect(configChangeCallback).toBeTruthy();
    unmount();
    // The unsubscribe function should have been called, clearing the callback
  });

  it('should update config after initialization', async () => {
    const updatedConfig = { ...defaultConfig, tabPosition: 'left' };
    mockLayoutService.getConfig
      .mockReturnValueOnce(defaultConfig) // initial
      .mockReturnValueOnce(updatedConfig); // after init

    const { result } = renderHook(() => useLayoutConfig());

    await waitFor(() => {
      expect(result.current).toEqual(updatedConfig);
    });
  });

  it('should not overwrite a config change received before initialization finishes', async () => {
    let resolveInit!: () => void;
    mockLayoutService.initialize.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveInit = resolve;
        })
    );

    const afterChangeConfig = {
      tabPosition: 'bottom',
      userListPosition: 'left',
      showUserList: false,
    };

    const { result } = renderHook(() => useLayoutConfig());

    await act(async () => {
      configChangeCallback?.(afterChangeConfig);
    });

    await act(async () => {
      resolveInit();
    });

    expect(result.current).toEqual(afterChangeConfig);
  });

  it('should not update state after unmount when initialization resolves late', async () => {
    let resolveInit!: () => void;
    const afterInitConfig = { ...defaultConfig, tabPosition: 'right' };
    mockLayoutService.initialize.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveInit = resolve;
        })
    );
    mockLayoutService.getConfig
      .mockReturnValueOnce(defaultConfig)
      .mockReturnValue(afterInitConfig);

    const { result, unmount } = renderHook(() => useLayoutConfig());

    unmount();

    await act(async () => {
      resolveInit();
    });

    expect(result.current).toEqual(defaultConfig);
  });

  it('should ignore config change callbacks after unmount', async () => {
    const { result, unmount } = renderHook(() => useLayoutConfig());
    const initialConfig = result.current;

    unmount();

    await act(async () => {
      configChangeCallback?.({
        tabPosition: 'bottom',
        userListPosition: 'left',
        showUserList: false,
      });
    });

    expect(result.current).toEqual(initialConfig);
  });
});
