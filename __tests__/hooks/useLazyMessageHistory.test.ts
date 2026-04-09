/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { renderHook } from '@testing-library/react-native';
import { useLazyMessageHistory } from '../../src/hooks/useLazyMessageHistory';

let appStateChangeListener: ((state: string) => void) | null = null;

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(
      (event: string, listener: (state: string) => void) => {
        if (event === 'change') {
          appStateChangeListener = listener;
        }
        return { remove: jest.fn() };
      },
    ),
  },
  InteractionManager: {
    runAfterInteractions: jest.fn(cb => cb()),
  },
}));

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    loadMessages: jest.fn().mockResolvedValue([]),
  },
}));

let mockStoreState: any = { tabs: [], setTabs: jest.fn() };

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: Object.assign(
    jest.fn((selector: any) => selector(mockStoreState)),
    { getState: jest.fn(() => mockStoreState) },
  ),
}));

describe('useLazyMessageHistory', () => {
  const useTabStore = require('../../src/stores/tabStore')
    .useTabStore as jest.Mock;
  const loadMessages = require('../../src/services/MessageHistoryService')
    .messageHistoryService.loadMessages as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    appStateChangeListener = null;
    mockStoreState = { tabs: [], setTabs: jest.fn() };
    useTabStore.mockImplementation((selector: any) => selector(mockStoreState));
    useTabStore.getState.mockImplementation(() => mockStoreState);
    loadMessages.mockResolvedValue([]);
  });

  it('renders', () => {
    expect(() =>
      renderHook(() => useLazyMessageHistory({ activeTabId: null })),
    ).not.toThrow();
  });

  it('does not load without active tab', () => {
    renderHook(() => useLazyMessageHistory({ activeTabId: null }));
    expect(loadMessages).not.toHaveBeenCalled();
  });

  it('loads history for active channel tab', async () => {
    const setTabs = jest.fn((next: any) => {
      if (typeof next === 'function') {
        mockStoreState.tabs = next(mockStoreState.tabs);
      } else {
        mockStoreState.tabs = next;
      }
    });
    mockStoreState = {
      tabs: [
        {
          id: 't1',
          type: 'channel',
          name: '#a',
          networkId: 'net',
          messages: [],
        },
      ],
      setTabs,
    };
    useTabStore.mockImplementation((selector: any) => selector(mockStoreState));
    useTabStore.getState.mockImplementation(() => mockStoreState);
    loadMessages.mockResolvedValueOnce([
      { id: 'h1', text: 'history', timestamp: 1 },
    ]);

    renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
    await new Promise(r => setTimeout(r, 0));

    expect(loadMessages).toHaveBeenCalledWith('net', '#a');
    expect(setTabs).toHaveBeenCalled();
    expect(mockStoreState.tabs[0].messages.length).toBe(1);
    expect(mockStoreState.tabs[0].messages[0].id).toBe('h1');
  });

  it('skips invalid network', async () => {
    mockStoreState = {
      tabs: [
        {
          id: 't1',
          type: 'server',
          name: 'Not connected',
          networkId: 'Not connected',
          messages: [],
        },
      ],
      setTabs: jest.fn(),
    };
    useTabStore.mockImplementation((selector: any) => selector(mockStoreState));
    useTabStore.getState.mockImplementation(() => mockStoreState);

    renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
    await new Promise(r => setTimeout(r, 0));

    expect(loadMessages).not.toHaveBeenCalled();
  });

  it('does not overwrite existing messages', async () => {
    const setTabs = jest.fn();
    mockStoreState = {
      tabs: [
        {
          id: 't1',
          type: 'channel',
          name: '#a',
          networkId: 'net',
          messages: [{ id: 'm1' }],
        },
      ],
      setTabs,
    };
    useTabStore.mockImplementation((selector: any) => selector(mockStoreState));
    useTabStore.getState.mockImplementation(() => mockStoreState);

    renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
    await new Promise(r => setTimeout(r, 0));

    expect(setTabs).not.toHaveBeenCalled();
  });

  it('retries history load once when first load returns empty', async () => {
    const setTabs = jest.fn((next: any) => {
      if (typeof next === 'function') {
        mockStoreState.tabs = next(mockStoreState.tabs);
      } else {
        mockStoreState.tabs = next;
      }
    });
    mockStoreState = {
      tabs: [
        {
          id: 't1',
          type: 'channel',
          name: '#a',
          networkId: 'net',
          messages: [],
        },
      ],
      setTabs,
    };
    useTabStore.mockImplementation((selector: any) => selector(mockStoreState));
    useTabStore.getState.mockImplementation(() => mockStoreState);
    loadMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'h2', text: 'retry-history', timestamp: 2 },
      ]);

    renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
    await new Promise(r => setTimeout(r, 300));

    expect(loadMessages.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(loadMessages.mock.calls[0]).toEqual(['net', '#a']);
    expect(loadMessages.mock.calls[1]).toEqual(['net', '#a']);
  });

  it('reloads active tab history when returning from background with empty tab', async () => {
    const setTabs = jest.fn((next: any) => {
      if (typeof next === 'function') {
        mockStoreState.tabs = next(mockStoreState.tabs);
      } else {
        mockStoreState.tabs = next;
      }
    });
    mockStoreState = {
      tabs: [
        {
          id: 't1',
          type: 'channel',
          name: '#a',
          networkId: 'net',
          messages: [],
        },
      ],
      setTabs,
    };
    useTabStore.mockImplementation((selector: any) => selector(mockStoreState));
    useTabStore.getState.mockImplementation(() => mockStoreState);
    loadMessages.mockResolvedValue([
      { id: 'h3', text: 'from-bg', timestamp: 3 },
    ]);

    renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
    await new Promise(r => setTimeout(r, 0));

    // Simulate background -> active
    appStateChangeListener?.('background');
    appStateChangeListener?.('active');
    await new Promise(r => setTimeout(r, 0));

    expect(
      require('react-native').InteractionManager.runAfterInteractions,
    ).toHaveBeenCalled();
    expect(loadMessages).toHaveBeenCalled();
    expect(setTabs).toHaveBeenCalled();
  });

  it('skips foreground reload when active tab already has messages', async () => {
    const setTabs = jest.fn();
    mockStoreState = {
      tabs: [
        {
          id: 't1',
          type: 'channel',
          name: '#a',
          networkId: 'net',
          messages: [{ id: 'm1' }],
        },
      ],
      setTabs,
    };
    useTabStore.mockImplementation((selector: any) => selector(mockStoreState));
    useTabStore.getState.mockImplementation(() => mockStoreState);

    renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
    await new Promise(r => setTimeout(r, 0));
    loadMessages.mockClear();

    appStateChangeListener?.('background');
    appStateChangeListener?.('active');
    await new Promise(r => setTimeout(r, 0));

    expect(loadMessages).not.toHaveBeenCalled();
    expect(setTabs).not.toHaveBeenCalled();
  });

  it('handles load errors without crashing', async () => {
    const setTabs = jest.fn();
    mockStoreState = {
      tabs: [
        {
          id: 't1',
          type: 'channel',
          name: '#a',
          networkId: 'net',
          messages: [],
        },
      ],
      setTabs,
    };
    useTabStore.mockImplementation((selector: any) => selector(mockStoreState));
    useTabStore.getState.mockImplementation(() => mockStoreState);
    loadMessages.mockRejectedValueOnce(new Error('load failed'));
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() =>
      renderHook(() => useLazyMessageHistory({ activeTabId: 't1' })),
    ).not.toThrow();
    await new Promise(r => setTimeout(r, 0));

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
