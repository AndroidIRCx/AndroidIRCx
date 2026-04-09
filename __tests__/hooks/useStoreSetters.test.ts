/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useStoreSetters.test.ts
 *
 * Tests for useStoreSetters hook
 */

import { renderHook, act } from '@testing-library/react-native';
import { useStoreSetters } from '../../src/hooks/useStoreSetters';
import { useConnectionStore } from '../../src/stores/connectionStore';
import { useTabStore } from '../../src/stores/tabStore';
import { useUIStore } from '../../src/stores/uiStore';
import { useMessageStore } from '../../src/stores/messageStore';
import { ChannelTab } from '../../src/types';
import { RawMessageCategory } from '../../src/services/IRCService';

// Mock AsyncStorage
const mockStorage: Map<string, string> = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    getItem: jest.fn(async (key: string) => {
      return mockStorage.get(key) || null;
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

describe('useStoreSetters', () => {
  beforeEach(() => {
    mockStorage.clear();
    // Reset all stores
    act(() => {
      useConnectionStore.getState().reset();
      useTabStore.getState().reset();
      useUIStore.getState().reset();
      useMessageStore.getState().reset();
    });
  });

  describe('connection store setters', () => {
    it('should set active tab id', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setActiveTabId('tab-123');
      });

      expect(useTabStore.getState().activeTabId).toBe('tab-123');
    });

    it('should set isConnected', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setIsConnected(true);
      });

      expect(useConnectionStore.getState().isConnected).toBe(true);
    });

    it('should set networkName', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setNetworkName('Freenode');
      });

      expect(useConnectionStore.getState().networkName).toBe('Freenode');
    });

    it('should set primaryNetworkId', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setPrimaryNetworkId('net-1');
      });

      expect(useConnectionStore.getState().primaryNetworkId).toBe('net-1');
    });

    it('should set activeConnectionId', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setActiveConnectionId('conn-1');
      });

      expect(useConnectionStore.getState().activeConnectionId).toBe('conn-1');
    });

    it('should set ping', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setPing(42);
      });

      expect(useConnectionStore.getState().ping).toBe(42);
    });

    it('should set tabs with array', () => {
      const { result } = renderHook(() => useStoreSetters());
      const tabs: ChannelTab[] = [
        {
          id: 'tab1',
          networkId: 'net1',
          channel: '#general',
          label: 'General',
          messages: [],
          hasActivity: false,
        },
        {
          id: 'tab2',
          networkId: 'net1',
          channel: '#random',
          label: 'Random',
          messages: [],
          hasActivity: false,
        },
      ];

      act(() => {
        result.current.setTabs(tabs);
      });

      expect(useTabStore.getState().tabs).toHaveLength(2);
    });

    it('should set tabs with function updater', () => {
      const { result } = renderHook(() => useStoreSetters());
      const initialTabs: ChannelTab[] = [
        {
          id: 'tab1',
          networkId: 'net1',
          channel: '#general',
          label: 'General',
          messages: [],
          hasActivity: false,
        },
      ];

      act(() => {
        result.current.setTabs(initialTabs);
      });

      act(() => {
        result.current.setTabs(prev => [
          ...prev,
          {
            id: 'tab2',
            networkId: 'net1',
            channel: '#random',
            label: 'Random',
            messages: [],
            hasActivity: false,
          },
        ]);
      });

      expect(useTabStore.getState().tabs).toHaveLength(2);
    });

    it('should not update tabs if reference is same', () => {
      const { result } = renderHook(() => useStoreSetters());
      const tabs: ChannelTab[] = [
        {
          id: 'tab1',
          networkId: 'net1',
          channel: '#general',
          label: 'General',
          messages: [],
          hasActivity: false,
        },
      ];

      act(() => {
        result.current.setTabs(tabs);
      });

      const currentTabs = useTabStore.getState().tabs;

      act(() => {
        result.current.setTabs(currentTabs);
      });

      // Should be the same reference
      expect(useTabStore.getState().tabs).toBe(currentTabs);
    });
  });

  describe('UI store setters - first run', () => {
    it('should set showFirstRunSetup', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setShowFirstRunSetup(true);
      });

      expect(useUIStore.getState().showFirstRunSetup).toBe(true);
    });

    it('should set isCheckingFirstRun', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setIsCheckingFirstRun(false);
      });

      expect(useUIStore.getState().isCheckingFirstRun).toBe(false);
    });
  });

  describe('UI store setters - message display', () => {
    it('should set showRawCommands', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setShowRawCommands(false);
      });

      expect(useUIStore.getState().showRawCommands).toBe(false);
    });

    it('should set rawCategoryVisibility', () => {
      const { result } = renderHook(() => useStoreSetters());
      const visibility: Record<RawMessageCategory, boolean> = {
        connection: true,
        channel: false,
        user: true,
        server: false,
        error: true,
        other: false,
      };

      act(() => {
        result.current.setRawCategoryVisibility(visibility);
      });

      expect(useUIStore.getState().rawCategoryVisibility).toEqual(visibility);
    });

    it('should set showTypingIndicators', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setShowTypingIndicators(false);
      });

      expect(useUIStore.getState().showTypingIndicators).toBe(false);
    });

    it('should set hideJoinMessages', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setHideJoinMessages(true);
      });

      expect(useUIStore.getState().hideJoinMessages).toBe(true);
    });

    it('should set hidePartMessages', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setHidePartMessages(true);
      });

      expect(useUIStore.getState().hidePartMessages).toBe(true);
    });

    it('should set hideQuitMessages', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setHideQuitMessages(true);
      });

      expect(useUIStore.getState().hideQuitMessages).toBe(true);
    });

    it('should set hideIrcServiceListenerMessages', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setHideIrcServiceListenerMessages(false);
      });

      expect(useUIStore.getState().hideIrcServiceListenerMessages).toBe(false);
    });
  });

  describe('message store setters', () => {
    it('should set typing user', () => {
      const { result } = renderHook(() => useStoreSetters());
      const status = { status: 'active' as const, timestamp: Date.now() };

      act(() => {
        result.current.setTypingUser('net1', '#channel', 'nick1', status);
      });

      const typingUsers = useMessageStore.getState().typingUsers;
      expect(typingUsers.has('net1')).toBe(true);
    });

    it('should remove typing user', () => {
      const { result } = renderHook(() => useStoreSetters());
      const status = { status: 'active' as const, timestamp: Date.now() };

      act(() => {
        result.current.setTypingUser('net1', '#channel', 'nick1', status);
        result.current.removeTypingUser('net1', '#channel', 'nick1');
      });

      expect(useMessageStore.getState().typingUsers.has('net1')).toBe(false);
    });

    it('should clear typing for target', () => {
      const { result } = renderHook(() => useStoreSetters());
      const status = { status: 'active' as const, timestamp: Date.now() };

      act(() => {
        result.current.setTypingUser('net1', '#channel', 'nick1', status);
        result.current.clearTypingForTarget('net1', '#channel');
      });

      expect(useMessageStore.getState().typingUsers.has('net1')).toBe(false);
    });

    it('should cleanup stale typing', () => {
      const { result } = renderHook(() => useStoreSetters());
      const oldStatus = {
        status: 'active' as const,
        timestamp: Date.now() - 20000,
      };

      act(() => {
        result.current.setTypingUser('net1', '#channel', 'nick1', oldStatus);
        result.current.cleanupStaleTyping();
      });

      expect(useMessageStore.getState().typingUsers.has('net1')).toBe(false);
    });
  });

  describe('app lock setters', () => {
    it('should set appLockEnabled', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setAppLockEnabled(true);
      });

      expect(useUIStore.getState().appLockEnabled).toBe(true);
    });

    it('should set appLockUseBiometric', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setAppLockUseBiometric(true);
      });

      expect(useUIStore.getState().appLockUseBiometric).toBe(true);
    });

    it('should set appLockUsePin', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setAppLockUsePin(true);
      });

      expect(useUIStore.getState().appLockUsePin).toBe(true);
    });

    it('should set appLockOnLaunch', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setAppLockOnLaunch(false);
      });

      expect(useUIStore.getState().appLockOnLaunch).toBe(false);
    });

    it('should set appLockOnBackground', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setAppLockOnBackground(false);
      });

      expect(useUIStore.getState().appLockOnBackground).toBe(false);
    });

    it('should set appLocked', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setAppLocked(true);
      });

      expect(useUIStore.getState().appLocked).toBe(true);
    });

    it('should set appUnlockModalVisible', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setAppUnlockModalVisible(true);
      });

      expect(useUIStore.getState().appUnlockModalVisible).toBe(true);
    });

    it('should set appPinEntry', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setAppPinEntry('1234');
      });

      expect(useUIStore.getState().appPinEntry).toBe('1234');
    });

    it('should set appPinError', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setAppPinError('Invalid PIN');
      });

      expect(useUIStore.getState().appPinError).toBe('Invalid PIN');
    });
  });

  describe('banner/ad setters', () => {
    it('should set bannerVisible', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setBannerVisible(true);
      });

      expect(useUIStore.getState().bannerVisible).toBe(true);
    });

    it('should set scriptingTimeMs', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setScriptingTimeMs(5000);
      });

      expect(useUIStore.getState().scriptingTimeMs).toBe(5000);
    });

    it('should set adFreeTimeMs', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setAdFreeTimeMs(10000);
      });

      expect(useUIStore.getState().adFreeTimeMs).toBe(10000);
    });
  });

  describe('modal setters', () => {
    it('should set channelName', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setChannelName('#general');
      });

      expect(useUIStore.getState().channelName).toBe('#general');
    });

    it('should set channelNoteValue', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setChannelNoteValue('This is a note');
      });

      expect(useUIStore.getState().channelNoteValue).toBe('This is a note');
    });

    it('should set renameValue', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setRenameValue('New Name');
      });

      expect(useUIStore.getState().renameValue).toBe('New Name');
    });

    it('should set dccSendPath', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setDccSendPath('/path/to/file.txt');
      });

      expect(useUIStore.getState().dccSendPath).toBe('/path/to/file.txt');
    });

    it('should set showOptionsMenu', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setShowOptionsMenu(true);
      });

      expect(useUIStore.getState().showOptionsMenu).toBe(true);
    });

    it('should set showSettings', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setShowSettings(true);
      });

      expect(useUIStore.getState().showSettings).toBe(true);
    });
  });

  describe('help screen setters', () => {
    it('should set showHelpConnection', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setShowHelpConnection(true);
      });

      expect(useUIStore.getState().showHelpConnection).toBe(true);
    });

    it('should set showHelpCommands', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setShowHelpCommands(true);
      });

      expect(useUIStore.getState().showHelpCommands).toBe(true);
    });

    it('should set showHelpEncryption', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setShowHelpEncryption(true);
      });

      expect(useUIStore.getState().showHelpEncryption).toBe(true);
    });

    it('should set showHelpMedia', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setShowHelpMedia(true);
      });

      expect(useUIStore.getState().showHelpMedia).toBe(true);
    });

    it('should set showHelpChannelManagement', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setShowHelpChannelManagement(true);
      });

      expect(useUIStore.getState().showHelpChannelManagement).toBe(true);
    });

    it('should set showHelpTroubleshooting', () => {
      const { result } = renderHook(() => useStoreSetters());

      act(() => {
        result.current.setShowHelpTroubleshooting(true);
      });

      expect(useUIStore.getState().showHelpTroubleshooting).toBe(true);
    });
  });

  describe('setter stability', () => {
    it('should return stable references across re-renders', () => {
      const { result, rerender } = renderHook(() => useStoreSetters());

      const firstRenderSetters = result.current;
      rerender();
      const secondRenderSetters = result.current;

      // All setters should be the same reference (wrapped in useCallback with empty deps)
      expect(secondRenderSetters.setIsConnected).toBe(
        firstRenderSetters.setIsConnected,
      );
      expect(secondRenderSetters.setNetworkName).toBe(
        firstRenderSetters.setNetworkName,
      );
      expect(secondRenderSetters.setTabs).toBe(firstRenderSetters.setTabs);
      expect(secondRenderSetters.setShowSettings).toBe(
        firstRenderSetters.setShowSettings,
      );
      expect(secondRenderSetters.setAppLocked).toBe(
        firstRenderSetters.setAppLocked,
      );
    });
  });
});
