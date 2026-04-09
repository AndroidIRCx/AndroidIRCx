/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useKeyboardShortcuts hook
 */

import { renderHook } from '@testing-library/react-hooks';
import { useKeyboardShortcuts } from '../../src/hooks/useKeyboardShortcuts';

const mockRegisterShortcut = jest.fn();
const mockUnregisterShortcut = jest.fn();
const mockConfirmAndActivate = jest.fn();
const mockSetShowChannelModal = jest.fn();
const mockSetShowSettings = jest.fn();

let mockActiveTabId = 'channel::TestNetwork::#general';

jest.mock('../../src/services/KeyboardShortcutService', () => ({
  keyboardShortcutService: {
    registerShortcut: (...args: any[]) => mockRegisterShortcut(...args),
    unregisterShortcut: (...args: any[]) => mockUnregisterShortcut(...args),
  },
}));

jest.mock('../../src/services/KillSwitchService', () => ({
  killSwitchService: {
    confirmAndActivate: (...args: any[]) => mockConfirmAndActivate(...args),
  },
}));

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: () => ({
      activeTabId: mockActiveTabId,
    }),
  },
}));

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: () => ({
      setShowChannelModal: mockSetShowChannelModal,
      setShowSettings: mockSetShowSettings,
    }),
  },
}));

describe('useKeyboardShortcuts', () => {
  const tabs = [
    { id: 'server::TestNetwork', name: 'TestNetwork', type: 'server' as const },
    {
      id: 'channel::TestNetwork::#general',
      name: '#general',
      type: 'channel' as const,
    },
    {
      id: 'channel::TestNetwork::#random',
      name: '#random',
      type: 'channel' as const,
    },
  ];
  const tabsRef = { current: tabs };
  const mockSetActiveTabId = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveTabId = 'channel::TestNetwork::#general';
  });

  it('should register all 5 shortcuts on mount', () => {
    renderHook(() =>
      useKeyboardShortcuts({ tabsRef, setActiveTabId: mockSetActiveTabId }),
    );

    expect(mockRegisterShortcut).toHaveBeenCalledTimes(5);
    expect(mockRegisterShortcut).toHaveBeenCalledWith(
      'Ctrl+Tab',
      expect.any(Function),
    );
    expect(mockRegisterShortcut).toHaveBeenCalledWith(
      'Ctrl+Shift+Tab',
      expect.any(Function),
    );
    expect(mockRegisterShortcut).toHaveBeenCalledWith(
      'Ctrl+N',
      expect.any(Function),
    );
    expect(mockRegisterShortcut).toHaveBeenCalledWith(
      'Ctrl+S',
      expect.any(Function),
    );
    expect(mockRegisterShortcut).toHaveBeenCalledWith(
      'Ctrl+Shift+K',
      expect.any(Function),
    );
  });

  it('should unregister all shortcuts on unmount', () => {
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ tabsRef, setActiveTabId: mockSetActiveTabId }),
    );

    unmount();

    expect(mockUnregisterShortcut).toHaveBeenCalledTimes(5);
  });

  it('should switch to next tab on Ctrl+Tab', () => {
    renderHook(() =>
      useKeyboardShortcuts({ tabsRef, setActiveTabId: mockSetActiveTabId }),
    );

    const nextTabCallback = mockRegisterShortcut.mock.calls.find(
      call => call[0] === 'Ctrl+Tab',
    )?.[1];

    nextTabCallback();

    // Active tab is #general (index 1), next should be #random (index 2)
    expect(mockSetActiveTabId).toHaveBeenCalledWith(
      'channel::TestNetwork::#random',
    );
  });

  it('should wrap around to first tab on Ctrl+Tab at end', () => {
    mockActiveTabId = 'channel::TestNetwork::#random';

    renderHook(() =>
      useKeyboardShortcuts({ tabsRef, setActiveTabId: mockSetActiveTabId }),
    );

    const nextTabCallback = mockRegisterShortcut.mock.calls.find(
      call => call[0] === 'Ctrl+Tab',
    )?.[1];

    nextTabCallback();

    expect(mockSetActiveTabId).toHaveBeenCalledWith('server::TestNetwork');
  });

  it('should switch to previous tab on Ctrl+Shift+Tab', () => {
    renderHook(() =>
      useKeyboardShortcuts({ tabsRef, setActiveTabId: mockSetActiveTabId }),
    );

    const prevTabCallback = mockRegisterShortcut.mock.calls.find(
      call => call[0] === 'Ctrl+Shift+Tab',
    )?.[1];

    prevTabCallback();

    // Active tab is #general (index 1), prev should be server (index 0)
    expect(mockSetActiveTabId).toHaveBeenCalledWith('server::TestNetwork');
  });

  it('should open channel modal on Ctrl+N', () => {
    renderHook(() =>
      useKeyboardShortcuts({ tabsRef, setActiveTabId: mockSetActiveTabId }),
    );

    const openAddCallback = mockRegisterShortcut.mock.calls.find(
      call => call[0] === 'Ctrl+N',
    )?.[1];

    openAddCallback();

    expect(mockSetShowChannelModal).toHaveBeenCalledWith(true);
  });

  it('should open settings on Ctrl+S', () => {
    renderHook(() =>
      useKeyboardShortcuts({ tabsRef, setActiveTabId: mockSetActiveTabId }),
    );

    const openSettingsCallback = mockRegisterShortcut.mock.calls.find(
      call => call[0] === 'Ctrl+S',
    )?.[1];

    openSettingsCallback();

    expect(mockSetShowSettings).toHaveBeenCalledWith(true);
  });

  it('should activate kill switch on Ctrl+Shift+K', () => {
    renderHook(() =>
      useKeyboardShortcuts({ tabsRef, setActiveTabId: mockSetActiveTabId }),
    );

    const killSwitchCallback = mockRegisterShortcut.mock.calls.find(
      call => call[0] === 'Ctrl+Shift+K',
    )?.[1];

    killSwitchCallback();

    expect(mockConfirmAndActivate).toHaveBeenCalled();
  });
});
