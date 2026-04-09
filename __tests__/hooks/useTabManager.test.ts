/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useTabManager hook - Wave 4
 */

import { renderHook, act, cleanup } from '@testing-library/react-hooks';

// Mock dependencies
jest.mock('../../src/utils/MessageBatcher', () => ({
  messageBatcher: {
    addMessage: jest.fn(),
    addMessages: jest.fn(),
    setFlushCallback: jest.fn(),
    flush: jest.fn(),
  },
}));

// Mock PerformanceService
jest.mock('../../src/services/PerformanceService', () => ({
  performanceService: {
    getConfig: jest.fn().mockReturnValue({
      enableMessageCleanup: true,
      cleanupThreshold: 200,
      messageLimit: 100,
    }),
  },
}));

// Create mock store
const mockStore = {
  tabs: [],
  activeTabId: '',
  setTabs: jest.fn(),
  setActiveTabId: jest.fn(),
  addTab: jest.fn(),
  removeTab: jest.fn(),
  removeTabs: jest.fn(),
  updateTab: jest.fn(),
  updateTabs: jest.fn(),
  addMessageToTab: jest.fn(),
  setTabActivity: jest.fn(),
  clearTabMessages: jest.fn(),
  addTabs: jest.fn(),
  getTabById: jest.fn(),
  getTabsByNetwork: jest.fn().mockReturnValue([]),
  getActiveTab: jest.fn().mockReturnValue(null),
  hasTab: jest.fn().mockReturnValue(false),
  saveTabsToStorage: jest.fn().mockResolvedValue(undefined),
  loadTabsFromStorage: jest.fn().mockResolvedValue(undefined),
};

// Mock Zustand store
jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: Object.assign(
    jest.fn(selector => selector(mockStore)),
    { getState: jest.fn(() => mockStore) },
  ),
}));

// Import after mocks
import { useTabManager } from '../../src/hooks/useTabManager';
import { messageBatcher } from '../../src/utils/MessageBatcher';
import { performanceService } from '../../src/services/PerformanceService';

describe('useTabManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    mockStore.tabs = [];
    mockStore.activeTabId = '';
    mockStore.hasTab.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  it('should return tab management functions', () => {
    const { result } = renderHook(() => useTabManager());

    expect(result.current.tabs).toBeDefined();
    expect(result.current.activeTabId).toBeDefined();
    expect(result.current.openTab).toBeDefined();
    expect(result.current.closeTab).toBeDefined();
    expect(result.current.addMessage).toBeDefined();
    expect(result.current.switchToTab).toBeDefined();
  });

  it('should add a new tab', () => {
    mockStore.hasTab.mockReturnValue(false);

    const { result } = renderHook(() => useTabManager());

    const newTab = {
      id: 'tab-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
    };

    act(() => {
      result.current.openTab(newTab);
    });

    expect(mockStore.addTab).toHaveBeenCalledWith(newTab);
    expect(mockStore.setActiveTabId).toHaveBeenCalledWith('tab-1');
  });

  it('should switch to existing tab instead of adding duplicate', () => {
    mockStore.hasTab.mockReturnValue(true);

    const { result } = renderHook(() => useTabManager());

    const existingTab = {
      id: 'tab-1',
      name: '#test',
      type: 'channel' as const,
      networkId: 'freenode',
      messages: [],
    };

    act(() => {
      result.current.openTab(existingTab);
    });

    expect(mockStore.addTab).not.toHaveBeenCalled();
    expect(mockStore.setActiveTabId).toHaveBeenCalledWith('tab-1');
  });

  it('should add message using batcher', () => {
    const { result } = renderHook(() => useTabManager());

    const message = {
      id: 'msg-1',
      type: 'message',
      text: 'Hello',
      timestamp: Date.now(),
    };

    act(() => {
      result.current.addMessage('tab-1', message as any);
    });

    expect(messageBatcher.addMessage).toHaveBeenCalledWith('tab-1', message);
  });

  it('should switch to tab and clear activity', () => {
    mockStore.hasTab.mockReturnValue(true);

    const { result } = renderHook(() => useTabManager());

    act(() => {
      result.current.switchToTab('tab-1');
    });

    expect(mockStore.setActiveTabId).toHaveBeenCalledWith('tab-1');
    expect(mockStore.setTabActivity).toHaveBeenCalledWith('tab-1', false);
  });

  it('should not switch to non-existent tab', () => {
    mockStore.hasTab.mockReturnValue(false);

    const { result } = renderHook(() => useTabManager());

    act(() => {
      result.current.switchToTab('non-existent');
    });

    expect(mockStore.setActiveTabId).not.toHaveBeenCalled();
  });

  it('should close all network tabs', () => {
    const networkTabs = [
      { id: 'tab-1', name: '#test', type: 'channel', networkId: 'freenode' },
      { id: 'tab-2', name: 'OtherUser', type: 'query', networkId: 'freenode' },
      {
        id: 'server-freenode',
        name: 'Freenode',
        type: 'server',
        networkId: 'freenode',
      },
    ];
    mockStore.getTabsByNetwork.mockReturnValue(networkTabs);

    const { result } = renderHook(() => useTabManager());

    act(() => {
      result.current.closeNetworkTabs('freenode');
    });

    expect(mockStore.removeTabs).toHaveBeenCalledWith([
      'tab-1',
      'tab-2',
      'server-freenode',
    ]);
  });

  it('should close network tabs excluding server', () => {
    const networkTabs = [
      { id: 'tab-1', name: '#test', type: 'channel', networkId: 'freenode' },
      { id: 'tab-2', name: 'OtherUser', type: 'query', networkId: 'freenode' },
      {
        id: 'server-freenode',
        name: 'Freenode',
        type: 'server',
        networkId: 'freenode',
      },
    ];
    mockStore.getTabsByNetwork.mockReturnValue(networkTabs);

    const { result } = renderHook(() => useTabManager());

    act(() => {
      result.current.closeNetworkTabs('freenode', true);
    });

    expect(mockStore.removeTabs).toHaveBeenCalledWith(['tab-1', 'tab-2']);
  });

  // ============================================================================
  // Tab Creation Scenarios
  // ============================================================================

  describe('tab creation', () => {
    it('should create server tab', () => {
      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.createServerTab('freenode');
      });

      expect(mockStore.addTab).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'server::freenode',
          name: 'freenode',
          type: 'server',
          networkId: 'freenode',
          messages: [],
        }),
      );
    });

    it('should return created server tab', () => {
      const { result } = renderHook(() => useTabManager());

      let serverTab;
      act(() => {
        serverTab = result.current.createServerTab('freenode');
      });

      expect(serverTab).toEqual(
        expect.objectContaining({
          id: 'server::freenode',
          name: 'freenode',
          type: 'server',
        }),
      );
    });

    it('should get existing server tab', () => {
      const existingServerTab = {
        id: 'server::freenode',
        name: 'Freenode',
        type: 'server',
        networkId: 'freenode',
      };
      mockStore.tabs = [existingServerTab];

      const { result } = renderHook(() => useTabManager());

      const serverTab = result.current.getServerTab('freenode');

      expect(serverTab).toEqual(existingServerTab);
    });

    it('should return undefined when no server tab exists', () => {
      mockStore.tabs = [];

      const { result } = renderHook(() => useTabManager());

      const serverTab = result.current.getServerTab('freenode');

      expect(serverTab).toBeUndefined();
    });

    it('should ensure server tab creates new tab if not exists', () => {
      mockStore.tabs = [];

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.ensureServerTab('freenode');
      });

      expect(mockStore.addTab).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'server::freenode',
          type: 'server',
        }),
      );
    });

    it('should ensure server tab returns existing tab if already exists', () => {
      const existingServerTab = {
        id: 'server::freenode',
        name: 'Freenode',
        type: 'server',
        networkId: 'freenode',
      };
      mockStore.tabs = [existingServerTab];

      const { result } = renderHook(() => useTabManager());

      let serverTab;
      act(() => {
        serverTab = result.current.ensureServerTab('freenode');
      });

      expect(mockStore.addTab).not.toHaveBeenCalled();
      expect(serverTab).toEqual(existingServerTab);
    });

    it('should create channel tab', () => {
      mockStore.hasTab.mockReturnValue(false);
      const { result } = renderHook(() => useTabManager());

      const channelTab = {
        id: 'freenode::#general',
        name: '#general',
        type: 'channel' as const,
        networkId: 'freenode',
        messages: [],
      };

      act(() => {
        result.current.openTab(channelTab);
      });

      expect(mockStore.addTab).toHaveBeenCalledWith(channelTab);
    });

    it('should create query tab', () => {
      mockStore.hasTab.mockReturnValue(false);
      const { result } = renderHook(() => useTabManager());

      const queryTab = {
        id: 'freenode::User123',
        name: 'User123',
        type: 'query' as const,
        networkId: 'freenode',
        messages: [],
      };

      act(() => {
        result.current.openTab(queryTab);
      });

      expect(mockStore.addTab).toHaveBeenCalledWith(queryTab);
    });

    it('should create DCC tab', () => {
      mockStore.hasTab.mockReturnValue(false);
      const { result } = renderHook(() => useTabManager());

      const dccTab = {
        id: 'dcc::session-123',
        name: 'DCC Chat',
        type: 'dcc' as const,
        networkId: 'freenode',
        dccSessionId: 'session-123',
        messages: [],
      };

      act(() => {
        result.current.openTab(dccTab);
      });

      expect(mockStore.addTab).toHaveBeenCalledWith(dccTab);
    });

    it('should create notice tab', () => {
      mockStore.hasTab.mockReturnValue(false);
      const { result } = renderHook(() => useTabManager());

      const noticeTab = {
        id: 'freenode:: notices',
        name: 'Notices',
        type: 'notice' as const,
        networkId: 'freenode',
        messages: [],
      };

      act(() => {
        result.current.openTab(noticeTab);
      });

      expect(mockStore.addTab).toHaveBeenCalledWith(noticeTab);
    });
  });

  // ============================================================================
  // Tab Switching
  // ============================================================================

  describe('tab switching', () => {
    it('should switch to tab and clear activity', () => {
      mockStore.hasTab.mockReturnValue(true);

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.switchToTab('tab-1');
      });

      expect(mockStore.setActiveTabId).toHaveBeenCalledWith('tab-1');
      expect(mockStore.setTabActivity).toHaveBeenCalledWith('tab-1', false);
    });

    it('should not switch to non-existent tab', () => {
      mockStore.hasTab.mockReturnValue(false);

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.switchToTab('non-existent');
      });

      expect(mockStore.setActiveTabId).not.toHaveBeenCalled();
    });

    it('should open tab without switching when switchToTab is false', () => {
      mockStore.hasTab.mockReturnValue(false);

      const { result } = renderHook(() => useTabManager());

      const newTab = {
        id: 'tab-1',
        name: '#test',
        type: 'channel' as const,
        networkId: 'freenode',
        messages: [],
      };

      act(() => {
        result.current.openTab(newTab, false);
      });

      expect(mockStore.addTab).toHaveBeenCalledWith(newTab);
      expect(mockStore.setActiveTabId).not.toHaveBeenCalled();
    });

    it('should return tab id when opening tab', () => {
      mockStore.hasTab.mockReturnValue(false);

      const { result } = renderHook(() => useTabManager());

      const newTab = {
        id: 'tab-1',
        name: '#test',
        type: 'channel' as const,
        networkId: 'freenode',
        messages: [],
      };

      let returnedId;
      act(() => {
        returnedId = result.current.openTab(newTab);
      });

      expect(returnedId).toBe('tab-1');
    });
  });

  // ============================================================================
  // Tab Closing
  // ============================================================================

  describe('tab closing', () => {
    it('should close a tab', () => {
      const tabToClose = {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
      };
      mockStore.getTabById.mockReturnValue(tabToClose);
      mockStore.activeTabId = 'tab-2';

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.closeTab('tab-1');
      });

      expect(mockStore.removeTab).toHaveBeenCalledWith('tab-1');
    });

    it('should not close non-existent tab', () => {
      mockStore.getTabById.mockReturnValue(undefined);

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.closeTab('non-existent');
      });

      expect(mockStore.removeTab).not.toHaveBeenCalled();
    });

    it('should switch to server tab when closing active tab', () => {
      const tabToClose = {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
      };
      const serverTab = {
        id: 'server-freenode',
        name: 'Freenode',
        type: 'server',
        networkId: 'freenode',
      };
      mockStore.getTabById.mockReturnValue(tabToClose);
      mockStore.tabs = [tabToClose, serverTab];
      mockStore.activeTabId = 'tab-1';

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.closeTab('tab-1');
      });

      expect(mockStore.removeTab).toHaveBeenCalledWith('tab-1');
      expect(mockStore.setActiveTabId).toHaveBeenCalledWith('server-freenode');
    });

    it('should switch to first tab when closing active tab and no server tab', () => {
      const tabToClose = {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
      };
      const otherTab = {
        id: 'tab-2',
        name: '#other',
        type: 'channel',
        networkId: 'freenode',
      };
      mockStore.getTabById.mockReturnValue(tabToClose);
      mockStore.tabs = [tabToClose, otherTab];
      mockStore.activeTabId = 'tab-1';

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.closeTab('tab-1');
      });

      expect(mockStore.setActiveTabId).toHaveBeenCalledWith('tab-2');
    });

    it('should clear active tab when closing last tab', () => {
      const tabToClose = {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
      };
      mockStore.getTabById.mockReturnValue(tabToClose);
      mockStore.tabs = [tabToClose];
      mockStore.activeTabId = 'tab-1';

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.closeTab('tab-1');
      });

      expect(mockStore.setActiveTabId).toHaveBeenCalledWith('');
    });

    it('should not switch tabs when closing non-active tab', () => {
      const tabToClose = {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
      };
      mockStore.getTabById.mockReturnValue(tabToClose);
      mockStore.tabs = [
        tabToClose,
        { id: 'tab-2', name: '#other', type: 'channel', networkId: 'freenode' },
      ];
      mockStore.activeTabId = 'tab-2';

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.closeTab('tab-1');
      });

      expect(mockStore.setActiveTabId).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Network Tab Closing
  // ============================================================================

  describe('network tab closing', () => {
    it('should switch to remaining tab when closing active network tabs', () => {
      const networkTabs = [
        { id: 'tab-1', name: '#test', type: 'channel', networkId: 'freenode' },
        { id: 'tab-2', name: '#other', type: 'channel', networkId: 'freenode' },
      ];
      mockStore.getTabsByNetwork.mockReturnValue(networkTabs);
      mockStore.tabs = [
        ...networkTabs,
        {
          id: 'tab-other',
          name: '#different',
          type: 'channel',
          networkId: 'othernet',
        },
      ];
      mockStore.activeTabId = 'tab-1';

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.closeNetworkTabs('freenode');
      });

      expect(mockStore.removeTabs).toHaveBeenCalledWith(['tab-1', 'tab-2']);
      expect(mockStore.setActiveTabId).toHaveBeenCalledWith('tab-other');
    });

    it('should clear active tab when closing all tabs', () => {
      const networkTabs = [
        { id: 'tab-1', name: '#test', type: 'channel', networkId: 'freenode' },
      ];
      mockStore.getTabsByNetwork.mockReturnValue(networkTabs);
      mockStore.tabs = networkTabs;
      mockStore.activeTabId = 'tab-1';

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.closeNetworkTabs('freenode');
      });

      expect(mockStore.setActiveTabId).toHaveBeenCalledWith('');
    });
  });

  // ============================================================================
  // Tab Persistence
  // ============================================================================

  describe('tab persistence', () => {
    it('should load tabs from storage', async () => {
      const { result } = renderHook(() => useTabManager());

      await act(async () => {
        await result.current.loadTabs('freenode');
      });

      expect(mockStore.loadTabsFromStorage).toHaveBeenCalledWith('freenode');
    });

    it('should save tabs to storage', async () => {
      const { result } = renderHook(() => useTabManager());

      await act(async () => {
        await result.current.saveTabs('freenode');
      });

      expect(mockStore.saveTabsToStorage).toHaveBeenCalledWith('freenode');
    });
  });

  // ============================================================================
  // Message Handling
  // ============================================================================

  describe('message handling', () => {
    it('should add single message using batcher', () => {
      const { result } = renderHook(() => useTabManager());

      const message = {
        id: 'msg-1',
        type: 'message',
        text: 'Hello',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.addMessage('tab-1', message as any);
      });

      expect(messageBatcher.addMessage).toHaveBeenCalledWith('tab-1', message);
    });

    it('should add multiple messages using batcher', () => {
      const { result } = renderHook(() => useTabManager());

      const messages = [
        { id: 'msg-1', type: 'message', text: 'Hello', timestamp: Date.now() },
        { id: 'msg-2', type: 'message', text: 'World', timestamp: Date.now() },
      ];

      act(() => {
        result.current.addMessages('tab-1', messages as any);
      });

      expect(messageBatcher.addMessages).toHaveBeenCalledWith(
        'tab-1',
        messages,
      );
    });
  });

  // ============================================================================
  // Tab Activity
  // ============================================================================

  describe('tab activity', () => {
    it('should mark tab as having activity', () => {
      mockStore.activeTabId = 'tab-2';

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.markTabActivity('tab-1');
      });

      expect(mockStore.setTabActivity).toHaveBeenCalledWith('tab-1', true);
    });

    it('should not mark activity for active tab', () => {
      mockStore.activeTabId = 'tab-1';

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.markTabActivity('tab-1');
      });

      expect(mockStore.setTabActivity).not.toHaveBeenCalled();
    });

    it('should clear tab messages', () => {
      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.clearTabMessages('tab-1');
      });

      expect(mockStore.clearTabMessages).toHaveBeenCalledWith('tab-1');
    });
  });

  // ============================================================================
  // Tab Encryption
  // ============================================================================

  describe('tab encryption', () => {
    it('should set tab encryption status', () => {
      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.setTabEncryption('tab-1', true);
      });

      expect(mockStore.updateTab).toHaveBeenCalledWith('tab-1', {
        isEncrypted: true,
      });
    });

    it('should unset tab encryption status', () => {
      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.setTabEncryption('tab-1', false);
      });

      expect(mockStore.updateTab).toHaveBeenCalledWith('tab-1', {
        isEncrypted: false,
      });
    });
  });

  // ============================================================================
  // Tab Queries
  // ============================================================================

  describe('tab queries', () => {
    it('should get tab by id', () => {
      const tab = {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
      };
      mockStore.getTabById.mockReturnValue(tab);

      const { result } = renderHook(() => useTabManager());

      const foundTab = result.current.getTabById('tab-1');

      expect(mockStore.getTabById).toHaveBeenCalledWith('tab-1');
      expect(foundTab).toEqual(tab);
    });

    it('should get tabs by network', () => {
      const networkTabs = [
        { id: 'tab-1', name: '#test', type: 'channel', networkId: 'freenode' },
        {
          id: 'tab-2',
          name: '#general',
          type: 'channel',
          networkId: 'freenode',
        },
      ];
      mockStore.getTabsByNetwork.mockReturnValue(networkTabs);

      const { result } = renderHook(() => useTabManager());

      const tabs = result.current.getTabsByNetwork('freenode');

      expect(mockStore.getTabsByNetwork).toHaveBeenCalledWith('freenode');
      expect(tabs).toEqual(networkTabs);
    });

    it('should check if tab exists', () => {
      mockStore.hasTab.mockReturnValue(true);

      const { result } = renderHook(() => useTabManager());

      const exists = result.current.hasTab('tab-1');

      expect(mockStore.hasTab).toHaveBeenCalledWith('tab-1');
      expect(exists).toBe(true);
    });

    it('should check if tab does not exist', () => {
      mockStore.hasTab.mockReturnValue(false);

      const { result } = renderHook(() => useTabManager());

      const exists = result.current.hasTab('non-existent');

      expect(exists).toBe(false);
    });

    it('should compute active tab from state', () => {
      mockStore.tabs = [
        { id: 'tab-1', name: '#test', type: 'channel', networkId: 'freenode' },
        { id: 'tab-2', name: '#other', type: 'channel', networkId: 'freenode' },
      ];
      mockStore.activeTabId = 'tab-1';

      const { result } = renderHook(() => useTabManager());

      // activeTab is computed from tabs and activeTabId
      expect(result.current.activeTab).toEqual(
        expect.objectContaining({ id: 'tab-1' }),
      );
    });

    it('should return undefined when no active tab matches', () => {
      mockStore.tabs = [
        { id: 'tab-1', name: '#test', type: 'channel', networkId: 'freenode' },
      ];
      mockStore.activeTabId = 'non-existent';

      const { result } = renderHook(() => useTabManager());

      expect(result.current.activeTab).toBeUndefined();
    });
  });

  // ============================================================================
  // Message Batcher Integration (useEffect)
  // ============================================================================

  describe('message batcher integration', () => {
    it('should set up message batcher flush callback', () => {
      renderHook(() => useTabManager());

      expect(messageBatcher.setFlushCallback).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('should flush batcher on unmount', () => {
      const { unmount } = renderHook(() => useTabManager());

      act(() => {
        unmount();
      });

      expect(messageBatcher.flush).toHaveBeenCalled();
    });

    it('should update tabs with batched messages on flush', () => {
      const tab = { id: 'tab-1', messages: [] };
      mockStore.getTabById.mockReturnValue(tab);
      mockStore.activeTabId = 'tab-2';

      renderHook(() => useTabManager());

      const flushCallback = (messageBatcher.setFlushCallback as jest.Mock).mock
        .calls[0][0];

      const updates = new Map([['tab-1', [{ id: 'msg-1', text: 'Hello' }]]]);

      act(() => {
        flushCallback(updates);
      });

      expect(mockStore.updateTabs).toHaveBeenCalled();
    });

    it('should mark activity for non-active tab on message flush', () => {
      const tab = { id: 'tab-1', messages: [] };
      mockStore.getTabById.mockReturnValue(tab);
      mockStore.activeTabId = 'tab-2';

      renderHook(() => useTabManager());

      const flushCallback = (messageBatcher.setFlushCallback as jest.Mock).mock
        .calls[0][0];

      const updates = new Map([['tab-1', [{ id: 'msg-1', text: 'Hello' }]]]);

      act(() => {
        flushCallback(updates);
      });

      const updateCalls = (mockStore.updateTabs as jest.Mock).mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('should not mark activity for active tab on message flush', () => {
      const tab = { id: 'tab-1', messages: [] };
      mockStore.getTabById.mockReturnValue(tab);
      mockStore.activeTabId = 'tab-1';

      renderHook(() => useTabManager());

      const flushCallback = (messageBatcher.setFlushCallback as jest.Mock).mock
        .calls[0][0];

      const updates = new Map([['tab-1', [{ id: 'msg-1', text: 'Hello' }]]]);

      act(() => {
        flushCallback(updates);
      });

      // Should only update messages, not activity
      const updateCalls = (mockStore.updateTabs as jest.Mock).mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('should cleanup messages when exceeding threshold', () => {
      const existingMessages = Array(150)
        .fill(null)
        .map((_, i) => ({ id: `msg-${i}` }));
      const tab = { id: 'tab-1', messages: existingMessages };
      mockStore.getTabById.mockReturnValue(tab);
      mockStore.activeTabId = 'tab-1';

      (performanceService.getConfig as jest.Mock).mockReturnValue({
        enableMessageCleanup: true,
        cleanupThreshold: 200,
        messageLimit: 100,
      });

      renderHook(() => useTabManager());

      const flushCallback = (messageBatcher.setFlushCallback as jest.Mock).mock
        .calls[0][0];

      // Add 100 more messages, bringing total to 250 (over threshold)
      const newMessages = Array(100)
        .fill(null)
        .map((_, i) => ({ id: `new-msg-${i}` }));
      const updates = new Map([['tab-1', newMessages]]);

      act(() => {
        flushCallback(updates);
      });

      expect(mockStore.updateTabs).toHaveBeenCalled();
    });

    it('should not cleanup messages when cleanup is disabled', () => {
      const existingMessages = Array(150)
        .fill(null)
        .map((_, i) => ({ id: `msg-${i}` }));
      const tab = { id: 'tab-1', messages: existingMessages };
      mockStore.getTabById.mockReturnValue(tab);

      (performanceService.getConfig as jest.Mock).mockReturnValue({
        enableMessageCleanup: false,
        cleanupThreshold: 200,
        messageLimit: 100,
      });

      renderHook(() => useTabManager());

      const flushCallback = (messageBatcher.setFlushCallback as jest.Mock).mock
        .calls[0][0];

      const newMessages = Array(100)
        .fill(null)
        .map((_, i) => ({ id: `new-msg-${i}` }));
      const updates = new Map([['tab-1', newMessages]]);

      act(() => {
        flushCallback(updates);
      });

      expect(mockStore.updateTabs).toHaveBeenCalled();
    });

    it('should handle messages for non-existent tab', () => {
      mockStore.getTabById.mockReturnValue(undefined);

      renderHook(() => useTabManager());

      const flushCallback = (messageBatcher.setFlushCallback as jest.Mock).mock
        .calls[0][0];

      const updates = new Map([
        ['non-existent', [{ id: 'msg-1', text: 'Hello' }]],
      ]);

      act(() => {
        flushCallback(updates);
      });

      // Should not throw or update anything
      expect(mockStore.updateTabs).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle closing tab that is not in tabs array', () => {
      const tabToClose = {
        id: 'tab-1',
        name: '#test',
        type: 'channel',
        networkId: 'freenode',
      };
      mockStore.getTabById.mockReturnValue(tabToClose);
      mockStore.tabs = [
        { id: 'tab-2', name: '#other', type: 'channel', networkId: 'freenode' },
      ];
      mockStore.activeTabId = 'tab-1';

      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.closeTab('tab-1');
      });

      // Should still remove the tab and switch to remaining tab
      expect(mockStore.removeTab).toHaveBeenCalledWith('tab-1');
    });

    it('should handle opening tab with same id but different properties', () => {
      mockStore.hasTab.mockReturnValue(true);

      const { result } = renderHook(() => useTabManager());

      const existingTab = {
        id: 'tab-1',
        name: '#updated',
        type: 'channel' as const,
        networkId: 'freenode',
        messages: [{ id: 'msg-1', text: 'Existing' }],
      };

      act(() => {
        result.current.openTab(existingTab);
      });

      // Should not add duplicate, just switch to it
      expect(mockStore.addTab).not.toHaveBeenCalled();
      expect(mockStore.setActiveTabId).toHaveBeenCalledWith('tab-1');
    });

    it('should handle rapid tab operations', () => {
      mockStore.hasTab.mockReturnValue(false);

      const { result } = renderHook(() => useTabManager());

      const tab1 = {
        id: 'tab-1',
        name: '#test1',
        type: 'channel' as const,
        networkId: 'freenode',
        messages: [],
      };
      const tab2 = {
        id: 'tab-2',
        name: '#test2',
        type: 'channel' as const,
        networkId: 'freenode',
        messages: [],
      };
      const tab3 = {
        id: 'tab-3',
        name: '#test3',
        type: 'channel' as const,
        networkId: 'freenode',
        messages: [],
      };

      act(() => {
        result.current.openTab(tab1);
        result.current.openTab(tab2);
        result.current.openTab(tab3);
      });

      expect(mockStore.addTab).toHaveBeenCalledTimes(3);
      expect(mockStore.setActiveTabId).toHaveBeenLastCalledWith('tab-3');
    });

    it('should handle empty network id for server tab', () => {
      const { result } = renderHook(() => useTabManager());

      act(() => {
        result.current.createServerTab('');
      });

      expect(mockStore.addTab).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'server::',
          name: '',
          type: 'server',
        }),
      );
    });

    it('should handle multiple networks in getServerTab', () => {
      mockStore.tabs = [
        {
          id: 'server::freenode',
          name: 'Freenode',
          type: 'server',
          networkId: 'freenode',
        },
        {
          id: 'server::dalnet',
          name: 'DalNet',
          type: 'server',
          networkId: 'dalnet',
        },
      ];

      const { result } = renderHook(() => useTabManager());

      const freenodeServer = result.current.getServerTab('freenode');
      const dalnetServer = result.current.getServerTab('dalnet');

      expect(freenodeServer?.networkId).toBe('freenode');
      expect(dalnetServer?.networkId).toBe('dalnet');
    });
  });
});
