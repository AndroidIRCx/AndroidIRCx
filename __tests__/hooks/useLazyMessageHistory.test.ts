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

  beforeEach(async () => {
    jest.clearAllMocks();
    appStateChangeListener = null;
    mockStoreState = { tabs: [], setTabs: jest.fn() };
    useTabStore.mockImplementation((selector: any) => selector(mockStoreState));
    useTabStore.getState.mockImplementation(() => mockStoreState);
    loadMessages.mockResolvedValue([]);
  });

  it('renders', async () => {
    await renderHook(() => useLazyMessageHistory({ activeTabId: null }));
  });

  it('does not load without active tab', async () => {
    await renderHook(() => useLazyMessageHistory({ activeTabId: null }));
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

    await renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
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

    await renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
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

    await renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
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

    await renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
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

    await renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
    await new Promise(r => setTimeout(r, 0));

    // Simulate background -> active
    appStateChangeListener?.('background');
    appStateChangeListener?.('active');
    await new Promise(r => setTimeout(r, 0));

    expect(requestIdleCallback as unknown as jest.Mock).toHaveBeenCalled();
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

    await renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
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

    await renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
    await new Promise(r => setTimeout(r, 0));

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('uses server history key for server tabs', async () => {
    const setTabs = jest.fn((next: any) => {
      mockStoreState.tabs =
        typeof next === 'function' ? next(mockStoreState.tabs) : next;
    });
    mockStoreState = {
      tabs: [
        {
          id: 'server-net',
          type: 'server',
          name: 'Libera',
          networkId: 'net',
          messages: [],
        },
      ],
      setTabs,
    };
    useTabStore.mockImplementation((selector: any) => selector(mockStoreState));
    useTabStore.getState.mockImplementation(() => mockStoreState);
    loadMessages.mockResolvedValueOnce([
      { id: 'server-history', text: 'connected', timestamp: 10 },
    ]);

    await renderHook(() =>
      useLazyMessageHistory({ activeTabId: 'server-net' }),
    );
    await new Promise(r => setTimeout(r, 0));

    expect(loadMessages).toHaveBeenCalledWith('net', 'server');
    expect(mockStoreState.tabs[0].messages[0].id).toBe('server-history');
  });

  it('skips update if tab is removed while history load is in flight', async () => {
    let resolveHistory: (messages: any[]) => void = () => {};
    const historyPromise = new Promise<any[]>(resolve => {
      resolveHistory = resolve;
    });
    const setTabs = jest.fn((next: any) => {
      mockStoreState.tabs =
        typeof next === 'function' ? next(mockStoreState.tabs) : next;
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
    loadMessages.mockReturnValueOnce(historyPromise);

    await renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
    mockStoreState.tabs = [];
    resolveHistory([{ id: 'late', text: 'late', timestamp: 11 }]);
    await new Promise(r => setTimeout(r, 0));

    expect(setTabs).not.toHaveBeenCalled();
  });

  it('does not overwrite messages that arrive while history load is in flight', async () => {
    let resolveHistory: (messages: any[]) => void = () => {};
    const historyPromise = new Promise<any[]>(resolve => {
      resolveHistory = resolve;
    });
    const setTabs = jest.fn((next: any) => {
      mockStoreState.tabs =
        typeof next === 'function' ? next(mockStoreState.tabs) : next;
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
    loadMessages.mockReturnValueOnce(historyPromise);

    await renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
    mockStoreState.tabs = [
      { ...mockStoreState.tabs[0], messages: [{ id: 'live', text: 'live' }] },
    ];
    resolveHistory([{ id: 'old-history', text: 'old', timestamp: 12 }]);
    await new Promise(r => setTimeout(r, 0));

    expect(setTabs).not.toHaveBeenCalled();
    expect(mockStoreState.tabs[0].messages[0].id).toBe('live');
  });

  it('force reloads empty active tab after foreground transition', async () => {
    const setTabs = jest.fn((next: any) => {
      mockStoreState.tabs =
        typeof next === 'function' ? next(mockStoreState.tabs) : next;
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
    loadMessages.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await renderHook(() => useLazyMessageHistory({ activeTabId: 't1' }));
    await new Promise(r => setTimeout(r, 300));
    setTabs.mockClear();
    loadMessages.mockResolvedValueOnce([
      { id: 'from-force', text: 'force', timestamp: 13 },
    ]);

    appStateChangeListener?.('background');
    appStateChangeListener?.('active');
    await new Promise(r => setTimeout(r, 0));

    expect(loadMessages).toHaveBeenLastCalledWith('net', '#a');
    expect(setTabs).toHaveBeenCalled();
    expect(mockStoreState.tabs[0].messages[0].id).toBe('from-force');
  });

  it('skips foreground force reload when there is no active tab after interactions', async () => {
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
    (requestIdleCallback as unknown as jest.Mock).mockImplementationOnce(
      (cb: any) => cb(),
    );

    const { rerender } = await renderHook(
      ({ activeTabId }) => useLazyMessageHistory({ activeTabId }),
      { initialProps: { activeTabId: 't1' as string | null } },
    );
    await new Promise(r => setTimeout(r, 0));
    loadMessages.mockClear();

    appStateChangeListener?.('background');
    await rerender({ activeTabId: null });
    appStateChangeListener?.('active');
    await new Promise(r => setTimeout(r, 0));

    expect(loadMessages).not.toHaveBeenCalled();
  });
});
