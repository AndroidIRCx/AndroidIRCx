/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useTypingCleanup.test.ts
 */

import { renderHook, act } from '@testing-library/react-native';
import { useTypingCleanup } from '../../src/hooks/useTypingCleanup';
import { useMessageStore } from '../../src/stores/messageStore';

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

describe('useTypingCleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    act(() => {
      useMessageStore.getState().reset();
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should set up cleanup interval on mount', () => {
    const spy = jest.spyOn(useMessageStore.getState(), 'cleanupStaleTyping');
    renderHook(() => useTypingCleanup());

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(spy).toHaveBeenCalledWith(5000);
    spy.mockRestore();
  });

  it('should call cleanup every 2 seconds', () => {
    const spy = jest.spyOn(useMessageStore.getState(), 'cleanupStaleTyping');
    renderHook(() => useTypingCleanup());

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(spy).toHaveBeenCalledTimes(3); // 2s, 4s, 6s
    spy.mockRestore();
  });

  it('should clear interval on unmount', () => {
    const spy = jest.spyOn(useMessageStore.getState(), 'cleanupStaleTyping');
    const { unmount } = renderHook(() => useTypingCleanup());

    unmount();

    const callsBefore = spy.mock.calls.length;
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(spy.mock.calls.length).toBe(callsBefore);
    spy.mockRestore();
  });
});
