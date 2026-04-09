/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useUserListActions hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useUserListActions } from '../../src/hooks/useUserListActions';

// Mock services
jest.mock('../../src/services/EncryptedDMService', () => ({
  encryptedDMService: {
    isEncryptedForNetwork: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/services/SoundService', () => ({
  soundService: {
    playSound: jest.fn(),
  },
}));

// Mock UI Store
const mockSetWhoisNick = jest.fn();
const mockSetShowWHOIS = jest.fn();

const mockUIStore = {
  setWhoisNick: mockSetWhoisNick,
  setShowWHOIS: mockSetShowWHOIS,
};

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: Object.assign(
    jest.fn(selector => selector(mockUIStore)),
    { getState: jest.fn(() => mockUIStore) },
  ),
}));

import { encryptedDMService } from '../../src/services/EncryptedDMService';
import { soundService } from '../../src/services/SoundService';

describe('useUserListActions', () => {
  const mockSetTabs = jest.fn();
  const mockSetActiveTabId = jest.fn();

  const defaultProps = {
    tabs: [],
    activeTab: {
      id: 'server-freenode',
      name: 'freenode',
      type: 'server',
      networkId: 'freenode',
    } as any,
    tabSortAlphabetical: false,
    setTabs: mockSetTabs,
    setActiveTabId: mockSetActiveTabId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return action handlers', () => {
    const { result } = renderHook(() => useUserListActions(defaultProps));

    expect(result.current.handleUserPress).toBeDefined();
    expect(result.current.handleWHOISPress).toBeDefined();
    expect(typeof result.current.handleUserPress).toBe('function');
    expect(typeof result.current.handleWHOISPress).toBe('function');
  });

  it('should switch to existing query tab on user press', async () => {
    const existingTabs = [
      {
        id: 'query::freenode::John',
        name: 'John',
        type: 'query',
        networkId: 'freenode',
      },
    ];

    const { result } = renderHook(() =>
      useUserListActions({ ...defaultProps, tabs: existingTabs }),
    );

    await act(async () => {
      await result.current.handleUserPress({ nick: 'John' });
    });

    expect(mockSetActiveTabId).toHaveBeenCalledWith('query::freenode::John');
    expect(mockSetTabs).not.toHaveBeenCalled(); // No new tab created
  });

  it('should create new query tab when user press and tab does not exist', async () => {
    const { result } = renderHook(() => useUserListActions(defaultProps));

    await act(async () => {
      await result.current.handleUserPress({ nick: 'NewUser' });
    });

    expect(encryptedDMService.isEncryptedForNetwork).toHaveBeenCalledWith(
      'freenode',
      'NewUser',
    );
    expect(mockSetTabs).toHaveBeenCalled();
    expect(soundService.playSound).toHaveBeenCalled();
    expect(mockSetActiveTabId).toHaveBeenCalled();
  });

  it('should check encryption status for new query', async () => {
    (encryptedDMService.isEncryptedForNetwork as jest.Mock).mockResolvedValue(
      true,
    );

    const { result } = renderHook(() => useUserListActions(defaultProps));

    await act(async () => {
      await result.current.handleUserPress({ nick: 'SecureUser' });
    });

    expect(encryptedDMService.isEncryptedForNetwork).toHaveBeenCalledWith(
      'freenode',
      'SecureUser',
    );

    // Check that setTabs was called with encrypted tab
    const setTabsCall = mockSetTabs.mock.calls[0][0];
    const newTabs = setTabsCall([]);
    const queryTab = newTabs.find((t: any) => t.name === 'SecureUser');
    expect(queryTab).toBeDefined();
    expect(queryTab.isEncrypted).toBe(true);
  });

  it('should handle WHOIS press', () => {
    const { result } = renderHook(() => useUserListActions(defaultProps));

    act(() => {
      result.current.handleWHOISPress('John');
    });

    expect(mockSetWhoisNick).toHaveBeenCalledWith('John');
    expect(mockSetShowWHOIS).toHaveBeenCalledWith(true);
  });

  it('should use correct network ID from active tab', async () => {
    const customProps = {
      ...defaultProps,
      activeTab: {
        id: 'server-dalnet',
        name: 'dalnet',
        type: 'server',
        networkId: 'dalnet',
      } as any,
    };

    const { result } = renderHook(() => useUserListActions(customProps));

    await act(async () => {
      await result.current.handleUserPress({ nick: 'TestUser' });
    });

    expect(encryptedDMService.isEncryptedForNetwork).toHaveBeenCalledWith(
      'dalnet',
      'TestUser',
    );
  });
});
