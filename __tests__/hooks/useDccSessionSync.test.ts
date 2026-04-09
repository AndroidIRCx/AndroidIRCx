/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useDccSessionSync hook
 */

import { renderHook } from '@testing-library/react-hooks';
import { useDccSessionSync } from '../../src/hooks/useDccSessionSync';

let sessionCallback: ((session: any) => void) | null = null;
let messageCallback:
  | ((sessionId: string, message: any, session: any) => void)
  | null = null;
const mockUnsubSession = jest.fn();
const mockUnsubMsg = jest.fn();

jest.mock('../../src/services/DCCChatService', () => ({
  dccChatService: {
    onSessionUpdate: jest.fn((cb: any) => {
      sessionCallback = cb;
      return mockUnsubSession;
    }),
    onMessage: jest.fn((cb: any) => {
      messageCallback = cb;
      return mockUnsubMsg;
    }),
  },
}));

const mockTabs: any[] = [];
const mockSetTabs = jest.fn();
const mockSetActiveTabId = jest.fn();
const mockSetNetworkName = jest.fn();

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: () => ({
      tabs: mockTabs,
      setTabs: mockSetTabs,
      setActiveTabId: mockSetActiveTabId,
    }),
  },
}));

jest.mock('../../src/stores/connectionStore', () => ({
  useConnectionStore: {
    getState: () => ({
      setNetworkName: mockSetNetworkName,
    }),
  },
}));

jest.mock('../../src/utils/tabUtils', () => ({
  sortTabsGrouped: jest.fn((tabs: any[]) => tabs),
}));

describe('useDccSessionSync', () => {
  const isMountedRef = { current: true };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionCallback = null;
    messageCallback = null;
    mockTabs.length = 0;
    isMountedRef.current = true;
  });

  it('should subscribe to session updates and messages on mount', () => {
    const { dccChatService } = require('../../src/services/DCCChatService');

    renderHook(() =>
      useDccSessionSync({ isMountedRef, tabSortAlphabetical: false }),
    );

    expect(dccChatService.onSessionUpdate).toHaveBeenCalledWith(
      expect.any(Function),
    );
    expect(dccChatService.onMessage).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() =>
      useDccSessionSync({ isMountedRef, tabSortAlphabetical: false }),
    );

    unmount();

    expect(mockUnsubSession).toHaveBeenCalled();
    expect(mockUnsubMsg).toHaveBeenCalled();
  });

  it('should create a new DCC tab when session connects and tab does not exist', () => {
    renderHook(() =>
      useDccSessionSync({ isMountedRef, tabSortAlphabetical: false }),
    );

    sessionCallback!({
      id: 'sess1',
      status: 'connected',
      networkId: 'TestNet',
      peerNick: 'Alice',
      messages: [{ text: 'hello' }],
    });

    expect(mockSetTabs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dcc::TestNet::Alice',
          name: 'DCC: Alice',
          type: 'dcc',
          networkId: 'TestNet',
          dccSessionId: 'sess1',
        }),
      ]),
    );
    expect(mockSetActiveTabId).toHaveBeenCalledWith('dcc::TestNet::Alice');
    expect(mockSetNetworkName).toHaveBeenCalledWith('TestNet');
  });

  it('should update existing DCC tab when session connects and tab exists', () => {
    mockTabs.push({
      id: 'dcc::TestNet::Alice',
      name: 'DCC: Alice',
      type: 'dcc',
      networkId: 'TestNet',
      messages: [],
      dccSessionId: 'old-sess',
    });

    renderHook(() =>
      useDccSessionSync({ isMountedRef, tabSortAlphabetical: false }),
    );

    sessionCallback!({
      id: 'sess2',
      status: 'connected',
      networkId: 'TestNet',
      peerNick: 'Alice',
      messages: [{ text: 'reconnected' }],
    });

    expect(mockSetTabs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dcc::TestNet::Alice',
          messages: [{ text: 'reconnected' }],
          dccSessionId: 'sess2',
        }),
      ]),
    );
  });

  it('should not update tabs if component is unmounted', () => {
    isMountedRef.current = false;

    renderHook(() =>
      useDccSessionSync({ isMountedRef, tabSortAlphabetical: false }),
    );

    sessionCallback!({
      id: 'sess1',
      status: 'connected',
      networkId: 'TestNet',
      peerNick: 'Alice',
      messages: [],
    });

    expect(mockSetTabs).not.toHaveBeenCalled();
  });

  it('should ignore closed/failed sessions (keep tab for history)', () => {
    renderHook(() =>
      useDccSessionSync({ isMountedRef, tabSortAlphabetical: false }),
    );

    sessionCallback!({
      id: 'sess1',
      status: 'closed',
      networkId: 'TestNet',
      peerNick: 'Alice',
      messages: [],
    });

    expect(mockSetTabs).not.toHaveBeenCalled();
    expect(mockSetActiveTabId).not.toHaveBeenCalled();
  });

  it('should append message to existing DCC tab on onMessage', () => {
    mockTabs.push({
      id: 'dcc::TestNet::Bob',
      name: 'DCC: Bob',
      type: 'dcc',
      messages: [{ text: 'first' }],
    });

    renderHook(() =>
      useDccSessionSync({ isMountedRef, tabSortAlphabetical: false }),
    );

    messageCallback!(
      'sess1',
      { text: 'second' },
      {
        networkId: 'TestNet',
        peerNick: 'Bob',
      },
    );

    expect(mockSetTabs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'dcc::TestNet::Bob',
          messages: [{ text: 'first' }, { text: 'second' }],
        }),
      ]),
    );
  });

  it('should not append message if component is unmounted', () => {
    isMountedRef.current = false;

    renderHook(() =>
      useDccSessionSync({ isMountedRef, tabSortAlphabetical: false }),
    );

    messageCallback!(
      'sess1',
      { text: 'msg' },
      {
        networkId: 'TestNet',
        peerNick: 'Bob',
      },
    );

    expect(mockSetTabs).not.toHaveBeenCalled();
  });

  it('should use sortTabsGrouped when creating new tab', () => {
    const { sortTabsGrouped } = require('../../src/utils/tabUtils');

    renderHook(() =>
      useDccSessionSync({ isMountedRef, tabSortAlphabetical: true }),
    );

    sessionCallback!({
      id: 'sess1',
      status: 'connected',
      networkId: 'Net1',
      peerNick: 'Charlie',
      messages: [],
    });

    expect(sortTabsGrouped).toHaveBeenCalledWith(expect.any(Array), true);
  });
});
