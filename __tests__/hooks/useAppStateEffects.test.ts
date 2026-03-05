/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useAppStateEffects hook
 */

import { renderHook } from '@testing-library/react-hooks';
import { Alert, AppState } from 'react-native';
import { useAppStateEffects } from '../../src/hooks/useAppStateEffects';

// Mock services
jest.mock('../../src/services/TabService', () => ({
  tabService: {
    getTabs: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/services/MessageHistoryBatching', () => ({
  messageHistoryBatching: {
    flushSync: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/NotificationService', () => ({
  notificationService: {
    refreshPermissionStatus: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock stores
const mockTabs: any[] = [];
const mockLoadTabsFromStorage = jest.fn();

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: Object.assign(
    jest.fn((selector) => selector({ tabs: mockTabs, loadTabsFromStorage: mockLoadTabsFromStorage })),
    { getState: jest.fn(() => ({ tabs: mockTabs, loadTabsFromStorage: mockLoadTabsFromStorage })) }
  ),
}));

jest.mock('../../src/stores/connectionStore', () => ({
  useConnectionStore: Object.assign(
    jest.fn((selector) => selector({ activeConnectionId: 'freenode', primaryNetworkId: 'freenode' })),
    { getState: jest.fn(() => ({ activeConnectionId: 'freenode', primaryNetworkId: 'freenode' })) }
  ),
}));

import { messageHistoryBatching } from '../../src/services/MessageHistoryBatching';
import { notificationService } from '../../src/services/NotificationService';
import { tabService } from '../../src/services/TabService';

describe('useAppStateEffects', () => {
  const mockSetTabs = jest.fn();
  const mockAppStateRef = { current: 'active' };
  const mockPendingAlertRef = { current: null as any };

  const defaultProps = {
    appStateRef: mockAppStateRef,
    pendingAlertRef: mockPendingAlertRef,
    activeConnectionId: 'freenode',
    primaryNetworkId: 'freenode',
    setTabs: mockSetTabs,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTabs.length = 0;
    mockAppStateRef.current = 'active';
    mockPendingAlertRef.current = null;
  });

  it('should subscribe to AppState changes on mount', () => {
    const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener');

    renderHook(() => useAppStateEffects(defaultProps));

    expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should unsubscribe on unmount', () => {
    const mockRemove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: mockRemove });

    const { unmount } = renderHook(() => useAppStateEffects(defaultProps));

    unmount();

    expect(mockRemove).toHaveBeenCalled();
  });

  it('should flush message history when going to background', () => {
    let stateChangeHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler: any) => {
      stateChangeHandler = handler;
      return { remove: jest.fn() };
    });

    renderHook(() => useAppStateEffects(defaultProps));

    // Simulate background state change
    stateChangeHandler!('background');

    expect(messageHistoryBatching.flushSync).toHaveBeenCalled();
  });

  it('should flush message history when going to inactive', () => {
    let stateChangeHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler: any) => {
      stateChangeHandler = handler;
      return { remove: jest.fn() };
    });

    renderHook(() => useAppStateEffects(defaultProps));

    stateChangeHandler!('inactive');

    expect(messageHistoryBatching.flushSync).toHaveBeenCalled();
  });

  it('should refresh notification permissions when becoming active', () => {
    let stateChangeHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler: any) => {
      stateChangeHandler = handler;
      return { remove: jest.fn() };
    });

    renderHook(() => useAppStateEffects(defaultProps));

    stateChangeHandler!('active');

    expect(notificationService.refreshPermissionStatus).toHaveBeenCalled();
  });

  it('should update appStateRef on state change', () => {
    let stateChangeHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler: any) => {
      stateChangeHandler = handler;
      return { remove: jest.fn() };
    });

    renderHook(() => useAppStateEffects(defaultProps));

    stateChangeHandler!('background');

    expect(mockAppStateRef.current).toBe('background');
  });

  it('should show pending alert when becoming active', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    let stateChangeHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler: any) => {
      stateChangeHandler = handler;
      return { remove: jest.fn() };
    });

    mockPendingAlertRef.current = {
      title: 'Test Alert',
      message: 'Test Message',
      buttons: [{ text: 'OK' }],
    };

    renderHook(() => useAppStateEffects(defaultProps));

    stateChangeHandler!('active');

    expect(alertSpy).toHaveBeenCalledWith('Test Alert', 'Test Message', [{ text: 'OK' }]);
    expect(mockPendingAlertRef.current).toBeNull();
    alertSpy.mockRestore();
  });

  it('should reload tabs from storage when app becomes active and tabs are empty', async () => {
    const useTabStore = require('../../src/stores/tabStore').useTabStore as jest.Mock;
    useTabStore.getState.mockReturnValue({
      tabs: [],
      loadTabsFromStorage: mockLoadTabsFromStorage,
    });
    const useConnectionStore = require('../../src/stores/connectionStore').useConnectionStore as jest.Mock;
    useConnectionStore.getState.mockReturnValue({
      activeConnectionId: 'freenode',
      primaryNetworkId: 'freenode',
    });
    (tabService.getTabs as jest.Mock).mockResolvedValueOnce([{ id: 'server-freenode' }]);

    let stateChangeHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler: any) => {
      stateChangeHandler = handler;
      return { remove: jest.fn() };
    });

    renderHook(() => useAppStateEffects(defaultProps));
    await stateChangeHandler!('active');

    expect(tabService.getTabs).toHaveBeenCalledWith('freenode');
    expect(mockLoadTabsFromStorage).toHaveBeenCalledWith('freenode');
  });

  it('should not reload tabs from storage when tabs already exist', async () => {
    const useTabStore = require('../../src/stores/tabStore').useTabStore as jest.Mock;
    useTabStore.getState.mockReturnValue({
      tabs: [{ id: 'existing-tab' }],
      loadTabsFromStorage: mockLoadTabsFromStorage,
    });

    let stateChangeHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler: any) => {
      stateChangeHandler = handler;
      return { remove: jest.fn() };
    });

    renderHook(() => useAppStateEffects(defaultProps));
    await stateChangeHandler!('active');

    expect(tabService.getTabs).not.toHaveBeenCalled();
    expect(mockLoadTabsFromStorage).not.toHaveBeenCalled();
  });

  it('should log when flushSync fails on background', async () => {
    (messageHistoryBatching.flushSync as jest.Mock).mockRejectedValueOnce(new Error('flush failed'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    let stateChangeHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler: any) => {
      stateChangeHandler = handler;
      return { remove: jest.fn() };
    });

    renderHook(() => useAppStateEffects(defaultProps));
    stateChangeHandler!('background');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error flushing message history on background:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  it('should log when notification refresh fails on active', async () => {
    (notificationService.refreshPermissionStatus as jest.Mock).mockRejectedValueOnce(new Error('notif failed'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    let stateChangeHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler: any) => {
      stateChangeHandler = handler;
      return { remove: jest.fn() };
    });

    renderHook(() => useAppStateEffects(defaultProps));
    await stateChangeHandler!('active');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error refreshing notification permission status:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
