/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useMessageBatching hook - Wave 4
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useMessageBatching } from '../../src/hooks/useMessageBatching';

// Mock dependencies
jest.mock('../../src/services/PerformanceService', () => ({
  performanceService: {
    getConfig: jest.fn().mockReturnValue({
      enableMessageCleanup: true,
      cleanupThreshold: 500,
      messageLimit: 300,
    }),
  },
}));

jest.mock('../../src/services/SoundService', () => ({
  soundService: {
    playSound: jest.fn(),
  },
}));

jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    saveMessage: jest.fn().mockResolvedValue(undefined),
    loadMessages: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/services/BouncerService', () => ({
  bouncerService: {
    getConfig: jest.fn().mockReturnValue({
      loadScrollbackOnJoin: false,
      scrollbackLines: 50,
    }),
  },
}));

jest.mock('../../src/utils/tabUtils', () => ({
  serverTabId: jest.fn().mockImplementation(id => `server-${id}`),
  noticeTabId: jest.fn().mockImplementation(id => `notices-${id}`),
  notificationsTabId: jest.fn().mockImplementation(id => `notifications-${id}`),
  makeServerTab: jest.fn().mockImplementation(id => ({
    id: `server-${id}`,
    name: id,
    type: 'server',
    networkId: id,
    messages: [],
  })),
  sortTabsGrouped: jest.fn().mockImplementation(tabs => tabs),
}));

import { messageHistoryService } from '../../src/services/MessageHistoryService';

describe('useMessageBatching', () => {
  const mockSetTabs = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return processBatchedMessages function', () => {
    const { result } = renderHook(() =>
      useMessageBatching({
        pendingMessagesRef: { current: [] },
        messageBatchTimeoutRef: { current: null },
        activeTabId: 'tab-1',
        tabSortAlphabetical: false,
        setTabs: mockSetTabs,
      }),
    );

    expect(result.current.processBatchedMessages).toBeDefined();
    expect(typeof result.current.processBatchedMessages).toBe('function');
  });

  it('should process empty batch without error', () => {
    const { result } = renderHook(() =>
      useMessageBatching({
        pendingMessagesRef: { current: [] },
        messageBatchTimeoutRef: { current: null },
        activeTabId: 'tab-1',
        tabSortAlphabetical: false,
        setTabs: mockSetTabs,
      }),
    );

    act(() => {
      result.current.processBatchedMessages();
    });

    expect(mockSetTabs).not.toHaveBeenCalled();
  });

  it('should create new tab for message', () => {
    const pendingMessagesRef = {
      current: [
        {
          message: {
            id: 'msg-1',
            type: 'message',
            text: 'Hello',
            timestamp: Date.now(),
            channel: '#test',
          },
          context: {
            targetTabId: 'channel-freenode-#test',
            targetTabType: 'channel',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: true,
          },
        },
      ],
    };

    const { result } = renderHook(() =>
      useMessageBatching({
        pendingMessagesRef,
        messageBatchTimeoutRef: { current: null },
        activeTabId: 'tab-1',
        tabSortAlphabetical: false,
        setTabs: mockSetTabs,
      }),
    );

    act(() => {
      result.current.processBatchedMessages();
    });

    expect(mockSetTabs).toHaveBeenCalled();
    const setTabsCall = mockSetTabs.mock.calls[0][0];
    const newState = setTabsCall([]);
    expect(newState.length).toBeGreaterThan(0);
    // Check that channel tab exists (server tab is also created)
    const channelTab = newState.find(
      (t: any) => t.id === 'channel-freenode-#test',
    );
    expect(channelTab).toBeDefined();
    expect(channelTab?.messages.length).toBe(1);
  });

  it('should add message to existing tab', () => {
    const existingTab = {
      id: 'channel-freenode-#test',
      name: '#test',
      type: 'channel',
      networkId: 'freenode',
      messages: [],
      hasActivity: false,
    };

    const pendingMessagesRef = {
      current: [
        {
          message: {
            id: 'msg-1',
            type: 'message',
            text: 'Hello',
            timestamp: Date.now(),
            channel: '#test',
          },
          context: {
            targetTabId: 'channel-freenode-#test',
            targetTabType: 'channel',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: true,
          },
        },
      ],
    };

    const { result } = renderHook(() =>
      useMessageBatching({
        pendingMessagesRef,
        messageBatchTimeoutRef: { current: null },
        activeTabId: 'tab-1',
        tabSortAlphabetical: false,
        setTabs: mockSetTabs,
      }),
    );

    act(() => {
      result.current.processBatchedMessages();
    });

    expect(mockSetTabs).toHaveBeenCalled();
    const setTabsCall = mockSetTabs.mock.calls[0][0];
    const newState = setTabsCall([existingTab]);
    expect(newState[0].messages.length).toBe(1);
    expect(newState[0].messages[0].text).toBe('Hello');
  });

  it('should keep legitimate repeated remote messages with same text', () => {
    const existingTab = {
      id: 'channel-freenode-#test',
      name: '#test',
      type: 'channel',
      networkId: 'freenode',
      messages: [
        {
          id: 'msg-old',
          type: 'message',
          from: 'alice',
          text: 'ok',
          timestamp: 1000,
          channel: '#test',
        },
      ],
      hasActivity: false,
    };

    const pendingMessagesRef = {
      current: [
        {
          message: {
            id: 'msg-new',
            type: 'message',
            from: 'alice',
            text: 'ok',
            timestamp: 3000,
            channel: '#test',
          },
          context: {
            targetTabId: 'channel-freenode-#test',
            targetTabType: 'channel',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: true,
          },
        },
      ],
    };

    const { result } = renderHook(() =>
      useMessageBatching({
        pendingMessagesRef,
        messageBatchTimeoutRef: { current: null },
        activeTabId: 'tab-1',
        tabSortAlphabetical: false,
        setTabs: mockSetTabs,
      }),
    );

    act(() => {
      result.current.processBatchedMessages();
    });

    const setTabsCall = mockSetTabs.mock.calls[0][0];
    const newState = setTabsCall([existingTab]);
    expect(newState[0].messages.length).toBe(2);
  });

  it('should dedupe local echo and server echo copies', () => {
    const existingTab = {
      id: 'query-freenode-bob',
      name: 'bob',
      type: 'query',
      networkId: 'freenode',
      messages: [
        {
          id: 'local-echo',
          type: 'message',
          from: 'tester',
          text: 'hello',
          timestamp: 1000,
          channel: 'bob',
          status: 'sent',
        },
      ],
      hasActivity: false,
    };

    const pendingMessagesRef = {
      current: [
        {
          message: {
            id: 'server-echo',
            type: 'message',
            from: 'tester',
            text: 'hello',
            timestamp: 3000,
            channel: 'bob',
          },
          context: {
            targetTabId: 'query-freenode-bob',
            targetTabType: 'query',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: true,
          },
        },
      ],
    };

    const { result } = renderHook(() =>
      useMessageBatching({
        pendingMessagesRef,
        messageBatchTimeoutRef: { current: null },
        activeTabId: 'tab-1',
        tabSortAlphabetical: false,
        setTabs: mockSetTabs,
      }),
    );

    act(() => {
      result.current.processBatchedMessages();
    });

    const setTabsCall = mockSetTabs.mock.calls[0][0];
    const newState = setTabsCall([existingTab]);
    expect(newState[0].messages.length).toBe(1);
  });

  it('should create notices and notifications tabs when targeted', () => {
    const pendingMessagesRef = {
      current: [
        {
          message: {
            id: 'notice-1',
            type: 'notice',
            text: 'notice text',
            timestamp: Date.now(),
            channel: '*',
          },
          context: {
            targetTabId: 'notices-freenode',
            targetTabType: 'channel',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: true,
          },
        },
        {
          message: {
            id: 'notif-1',
            type: 'notice',
            text: 'notif text',
            timestamp: Date.now(),
            channel: '*',
          },
          context: {
            targetTabId: 'notifications-freenode',
            targetTabType: 'channel',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: true,
          },
        },
      ],
    };

    const { result } = renderHook(() =>
      useMessageBatching({
        pendingMessagesRef,
        messageBatchTimeoutRef: { current: null },
        activeTabId: 'tab-1',
        tabSortAlphabetical: false,
        setTabs: mockSetTabs,
      }),
    );

    act(() => {
      result.current.processBatchedMessages();
    });

    const setTabsCall = mockSetTabs.mock.calls[0][0];
    const newState = setTabsCall([]);
    expect(newState.some((t: any) => t.id === 'notices-freenode')).toBe(true);
    expect(newState.some((t: any) => t.id === 'notifications-freenode')).toBe(
      true,
    );
  });

  it('should dedupe messages by msgid when both have msgid', () => {
    const existingTab = {
      id: 'channel-freenode-#test',
      name: '#test',
      type: 'channel',
      networkId: 'freenode',
      messages: [
        {
          id: 'msg-old',
          msgid: 'abc-1',
          type: 'message',
          from: 'alice',
          text: 'Hello',
          timestamp: 1000,
        },
      ],
      hasActivity: false,
    };

    const pendingMessagesRef = {
      current: [
        {
          message: {
            id: 'msg-new',
            msgid: 'abc-1',
            type: 'message',
            from: 'alice',
            text: 'Hello again',
            timestamp: 2000,
            channel: '#test',
          },
          context: {
            targetTabId: 'channel-freenode-#test',
            targetTabType: 'channel',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: true,
          },
        },
      ],
    };

    const { result } = renderHook(() =>
      useMessageBatching({
        pendingMessagesRef,
        messageBatchTimeoutRef: { current: null },
        activeTabId: 'tab-1',
        tabSortAlphabetical: false,
        setTabs: mockSetTabs,
      }),
    );

    act(() => {
      result.current.processBatchedMessages();
    });

    const setTabsCall = mockSetTabs.mock.calls[0][0];
    const newState = setTabsCall([existingTab]);
    expect(newState[0].messages.length).toBe(1);
  });

  it('should persist only eligible messages (not raw/playback/invalid network)', () => {
    const existingTab = {
      id: 'channel-freenode-#test',
      name: '#test',
      type: 'channel',
      networkId: 'freenode',
      messages: [],
      hasActivity: false,
    };

    const pendingMessagesRef = {
      current: [
        {
          message: {
            id: 'ok-1',
            type: 'message',
            text: 'persist me',
            timestamp: Date.now(),
            channel: '#test',
          },
          context: {
            targetTabId: 'channel-freenode-#test',
            targetTabType: 'channel',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: true,
          },
        },
        {
          message: {
            id: 'raw-1',
            type: 'raw',
            text: 'do not persist',
            isRaw: true,
            timestamp: Date.now(),
            channel: '#test',
          },
          context: {
            targetTabId: 'channel-freenode-#test',
            targetTabType: 'channel',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: true,
          },
        },
        {
          message: {
            id: 'playback-1',
            type: 'message',
            text: 'playback',
            isPlayback: true,
            timestamp: Date.now(),
            channel: '#test',
          },
          context: {
            targetTabId: 'channel-freenode-#test',
            targetTabType: 'channel',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: true,
          },
        },
        {
          message: {
            id: 'invalid-net',
            type: 'message',
            text: 'invalid network',
            timestamp: Date.now(),
            channel: '#test',
          },
          context: {
            targetTabId: 'channel-freenode-#test',
            targetTabType: 'channel',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: false,
          },
        },
      ],
    };

    let state: any[] = [existingTab];
    const setTabsWithState = jest.fn((updater: any) => {
      if (typeof updater === 'function') {
        state = updater(state);
      } else {
        state = updater;
      }
    });

    const { result } = renderHook(() =>
      useMessageBatching({
        pendingMessagesRef,
        messageBatchTimeoutRef: { current: null },
        activeTabId: 'tab-1',
        tabSortAlphabetical: false,
        setTabs: setTabsWithState,
      }),
    );

    act(() => {
      result.current.processBatchedMessages();
    });

    expect(state[0].messages.length).toBe(4);
    expect(messageHistoryService.saveMessage).toHaveBeenCalledTimes(1);
    expect(messageHistoryService.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ok-1' }),
      'freenode',
    );
  });

  it('should enforce performance cleanup limit when threshold is exceeded', () => {
    const perf =
      require('../../src/services/PerformanceService').performanceService;
    perf.getConfig.mockReturnValueOnce({
      enableMessageCleanup: true,
      cleanupThreshold: 2,
      messageLimit: 2,
    });

    const existingTab = {
      id: 'channel-freenode-#test',
      name: '#test',
      type: 'channel',
      networkId: 'freenode',
      messages: [
        { id: 'm1', type: 'message', text: '1', timestamp: 1 },
        { id: 'm2', type: 'message', text: '2', timestamp: 2 },
      ],
      hasActivity: false,
    };

    const pendingMessagesRef = {
      current: [
        {
          message: {
            id: 'm3',
            type: 'message',
            text: '3',
            timestamp: 3,
            channel: '#test',
          },
          context: {
            targetTabId: 'channel-freenode-#test',
            targetTabType: 'channel',
            messageNetwork: 'freenode',
            newTabIsEncrypted: false,
            hasValidNetwork: true,
          },
        },
      ],
    };

    const { result } = renderHook(() =>
      useMessageBatching({
        pendingMessagesRef,
        messageBatchTimeoutRef: { current: null },
        activeTabId: 'tab-1',
        tabSortAlphabetical: false,
        setTabs: mockSetTabs,
      }),
    );

    act(() => {
      result.current.processBatchedMessages();
    });

    const setTabsCall = mockSetTabs.mock.calls[0][0];
    const newState = setTabsCall([existingTab]);
    expect(newState[0].messages.length).toBe(2);
    expect(newState[0].messages[1].id).toBe('m3');
  });
});
