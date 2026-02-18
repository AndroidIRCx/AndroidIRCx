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
  serverTabId: jest.fn().mockImplementation((id) => `server-${id}`),
  noticeTabId: jest.fn().mockImplementation((id) => `notices-${id}`),
  notificationsTabId: jest.fn().mockImplementation((id) => `notifications-${id}`),
  makeServerTab: jest.fn().mockImplementation((id) => ({
    id: `server-${id}`,
    name: id,
    type: 'server',
    networkId: id,
    messages: [],
  })),
  sortTabsGrouped: jest.fn().mockImplementation((tabs) => tabs),
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
      })
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
      })
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
      })
    );

    act(() => {
      result.current.processBatchedMessages();
    });

    expect(mockSetTabs).toHaveBeenCalled();
    const setTabsCall = mockSetTabs.mock.calls[0][0];
    const newState = setTabsCall([]);
    expect(newState.length).toBeGreaterThan(0);
    // Check that channel tab exists (server tab is also created)
    const channelTab = newState.find((t: any) => t.id === 'channel-freenode-#test');
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
      })
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
});
