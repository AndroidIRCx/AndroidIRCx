/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * uiStore.test.ts
 *
 * Tests for uiStore - UI state management
 */

import { act } from '@testing-library/react-native';
import { useUIStore } from '../../src/stores/uiStore';
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

describe('uiStore', () => {
  beforeEach(() => {
    mockStorage.clear();
    act(() => {
      useUIStore.getState().reset();
    });
  });

  describe('initial state', () => {
    it('should have correct initial first run state', () => {
      expect(useUIStore.getState().showFirstRunSetup).toBe(false);
      expect(useUIStore.getState().isCheckingFirstRun).toBe(true);
    });

    it('should have correct initial app lock state', () => {
      const state = useUIStore.getState();
      expect(state.appLockEnabled).toBe(false);
      expect(state.appLockUseBiometric).toBe(false);
      expect(state.appLockAutoBiometricPrompt).toBe(false);
      expect(state.appLockUsePin).toBe(false);
      expect(state.appLockOnLaunch).toBe(true);
      expect(state.appLockOnBackground).toBe(true);
      expect(state.appLocked).toBe(false);
      expect(state.appUnlockModalVisible).toBe(false);
      expect(state.appPinEntry).toBe('');
      expect(state.appPinError).toBe('');
    });

    it('should have correct initial banner state', () => {
      expect(useUIStore.getState().bannerVisible).toBe(false);
      expect(useUIStore.getState().scriptingTimeMs).toBe(0);
      expect(useUIStore.getState().adFreeTimeMs).toBe(0);
    });

    it('should have correct initial message display state', () => {
      const state = useUIStore.getState();
      expect(state.showRawCommands).toBe(true);
      expect(state.rawCategoryVisibility).toEqual({});
      expect(state.showTypingIndicators).toBe(true);
      expect(state.hideJoinMessages).toBe(false);
      expect(state.hidePartMessages).toBe(false);
      expect(state.hideQuitMessages).toBe(false);
      expect(state.hideIrcServiceListenerMessages).toBe(true);
    });

    it('should have correct initial modal states', () => {
      const state = useUIStore.getState();
      expect(state.showChannelModal).toBe(false);
      expect(state.showNetworksList).toBe(false);
      expect(state.showSettings).toBe(false);
      expect(state.showPurchaseScreen).toBe(false);
      expect(state.showIgnoreList).toBe(false);
      expect(state.showBlacklist).toBe(false);
      expect(state.showWHOIS).toBe(false);
      expect(state.showQueryEncryptionMenu).toBe(false);
      expect(state.showChannelList).toBe(false);
      expect(state.showUserList).toBe(false);
      expect(state.showChannelSettings).toBe(false);
      expect(state.showOptionsMenu).toBe(false);
      expect(state.showRenameModal).toBe(false);
      expect(state.showTabOptionsModal).toBe(false);
      expect(state.showChannelNoteModal).toBe(false);
      expect(state.showChannelLogModal).toBe(false);
      expect(state.showDccTransfers).toBe(false);
      expect(state.showDccSendModal).toBe(false);
    });

    it('should have correct initial help screen states', () => {
      const state = useUIStore.getState();
      expect(state.showHelpConnection).toBe(false);
      expect(state.showHelpCommands).toBe(false);
      expect(state.showHelpEncryption).toBe(false);
      expect(state.showHelpMedia).toBe(false);
      expect(state.showHelpChannelManagement).toBe(false);
      expect(state.showHelpTroubleshooting).toBe(false);
    });

    it('should have empty initial strings', () => {
      const state = useUIStore.getState();
      expect(state.channelName).toBe('');
      expect(state.whoisNick).toBe('');
      expect(state.renameValue).toBe('');
      expect(state.tabOptionsTitle).toBe('');
      expect(state.dccSendPath).toBe('');
      expect(state.appPinEntry).toBe('');
      expect(state.appPinError).toBe('');
    });

    it('should have empty initial arrays', () => {
      const state = useUIStore.getState();
      expect(state.tabOptions).toEqual([]);
      expect(state.channelLogEntries).toEqual([]);
    });

    it('should have null initial targets', () => {
      const state = useUIStore.getState();
      expect(state.channelSettingsTarget).toBeNull();
      expect(state.channelSettingsNetwork).toBeNull();
      expect(state.renameTargetTabId).toBeNull();
      expect(state.channelNoteTarget).toBeNull();
      expect(state.dccSendTarget).toBeNull();
      expect(state.blacklistTarget).toBeNull();
      expect(state.prefillMessage).toBeNull();
    });
  });

  describe('first run actions', () => {
    it('should set showFirstRunSetup', () => {
      act(() => {
        useUIStore.getState().setShowFirstRunSetup(true);
      });
      expect(useUIStore.getState().showFirstRunSetup).toBe(true);
    });

    it('should set isCheckingFirstRun', () => {
      act(() => {
        useUIStore.getState().setIsCheckingFirstRun(false);
      });
      expect(useUIStore.getState().isCheckingFirstRun).toBe(false);
    });
  });

  describe('app lock actions', () => {
    it('should set appLockEnabled', () => {
      act(() => {
        useUIStore.getState().setAppLockEnabled(true);
      });
      expect(useUIStore.getState().appLockEnabled).toBe(true);
    });

    it('should set appLockUseBiometric', () => {
      act(() => {
        useUIStore.getState().setAppLockUseBiometric(true);
      });
      expect(useUIStore.getState().appLockUseBiometric).toBe(true);
    });

    it('should set appLockAutoBiometricPrompt', () => {
      act(() => {
        useUIStore.getState().setAppLockAutoBiometricPrompt(true);
      });
      expect(useUIStore.getState().appLockAutoBiometricPrompt).toBe(true);
    });

    it('should set appLockUsePin', () => {
      act(() => {
        useUIStore.getState().setAppLockUsePin(true);
      });
      expect(useUIStore.getState().appLockUsePin).toBe(true);
    });

    it('should set appLockOnLaunch', () => {
      act(() => {
        useUIStore.getState().setAppLockOnLaunch(false);
      });
      expect(useUIStore.getState().appLockOnLaunch).toBe(false);
    });

    it('should set appLockOnBackground', () => {
      act(() => {
        useUIStore.getState().setAppLockOnBackground(false);
      });
      expect(useUIStore.getState().appLockOnBackground).toBe(false);
    });

    it('should set appLocked', () => {
      act(() => {
        useUIStore.getState().setAppLocked(true);
      });
      expect(useUIStore.getState().appLocked).toBe(true);
    });

    it('should set appUnlockModalVisible', () => {
      act(() => {
        useUIStore.getState().setAppUnlockModalVisible(true);
      });
      expect(useUIStore.getState().appUnlockModalVisible).toBe(true);
    });

    it('should set appPinEntry', () => {
      act(() => {
        useUIStore.getState().setAppPinEntry('1234');
      });
      expect(useUIStore.getState().appPinEntry).toBe('1234');
    });

    it('should set appPinError', () => {
      act(() => {
        useUIStore.getState().setAppPinError('Invalid PIN');
      });
      expect(useUIStore.getState().appPinError).toBe('Invalid PIN');
    });
  });

  describe('banner actions', () => {
    it('should set bannerVisible', () => {
      act(() => {
        useUIStore.getState().setBannerVisible(true);
      });
      expect(useUIStore.getState().bannerVisible).toBe(true);
    });

    it('should set scriptingTimeMs', () => {
      act(() => {
        useUIStore.getState().setScriptingTimeMs(5000);
      });
      expect(useUIStore.getState().scriptingTimeMs).toBe(5000);
    });

    it('should set adFreeTimeMs', () => {
      act(() => {
        useUIStore.getState().setAdFreeTimeMs(10000);
      });
      expect(useUIStore.getState().adFreeTimeMs).toBe(10000);
    });

    it('should increment scripting time', () => {
      act(() => {
        useUIStore.getState().setScriptingTimeMs(1000);
        useUIStore.getState().incrementScriptingTime(500);
      });
      expect(useUIStore.getState().scriptingTimeMs).toBe(1500);
    });

    it('should increment ad free time', () => {
      act(() => {
        useUIStore.getState().setAdFreeTimeMs(2000);
        useUIStore.getState().incrementAdFreeTime(1000);
      });
      expect(useUIStore.getState().adFreeTimeMs).toBe(3000);
    });

    it('should decrement scripting time', () => {
      act(() => {
        useUIStore.getState().setScriptingTimeMs(1000);
        useUIStore.getState().decrementScriptingTime(300);
      });
      expect(useUIStore.getState().scriptingTimeMs).toBe(700);
    });

    it('should not decrement scripting time below zero', () => {
      act(() => {
        useUIStore.getState().setScriptingTimeMs(100);
        useUIStore.getState().decrementScriptingTime(500);
      });
      expect(useUIStore.getState().scriptingTimeMs).toBe(0);
    });

    it('should decrement ad free time', () => {
      act(() => {
        useUIStore.getState().setAdFreeTimeMs(2000);
        useUIStore.getState().decrementAdFreeTime(800);
      });
      expect(useUIStore.getState().adFreeTimeMs).toBe(1200);
    });

    it('should not decrement ad free time below zero', () => {
      act(() => {
        useUIStore.getState().setAdFreeTimeMs(100);
        useUIStore.getState().decrementAdFreeTime(500);
      });
      expect(useUIStore.getState().adFreeTimeMs).toBe(0);
    });
  });

  describe('message display actions', () => {
    it('should set showRawCommands', () => {
      act(() => {
        useUIStore.getState().setShowRawCommands(false);
      });
      expect(useUIStore.getState().showRawCommands).toBe(false);
    });

    it('should set rawCategoryVisibility', () => {
      const visibility: Record<RawMessageCategory, boolean> = {
        connection: true,
        channel: false,
        user: true,
        server: false,
        error: true,
        other: false,
      };
      act(() => {
        useUIStore.getState().setRawCategoryVisibility(visibility);
      });
      expect(useUIStore.getState().rawCategoryVisibility).toEqual(visibility);
    });

    it('should toggle raw category', () => {
      act(() => {
        useUIStore.getState().toggleRawCategory('connection' as RawMessageCategory);
      });
      expect(useUIStore.getState().rawCategoryVisibility.connection).toBe(true);

      act(() => {
        useUIStore.getState().toggleRawCategory('connection' as RawMessageCategory);
      });
      expect(useUIStore.getState().rawCategoryVisibility.connection).toBe(false);
    });

    it('should toggle multiple categories independently', () => {
      act(() => {
        useUIStore.getState().toggleRawCategory('connection' as RawMessageCategory);
        useUIStore.getState().toggleRawCategory('channel' as RawMessageCategory);
      });
      const state = useUIStore.getState().rawCategoryVisibility;
      expect(state.connection).toBe(true);
      expect(state.channel).toBe(true);
    });

    it('should preserve existing categories when toggling', () => {
      act(() => {
        useUIStore.getState().toggleRawCategory('connection' as RawMessageCategory);
      });
      
      act(() => {
        useUIStore.getState().toggleRawCategory('channel' as RawMessageCategory);
      });

      expect(useUIStore.getState().rawCategoryVisibility.connection).toBe(true);
    });

    it('should set showTypingIndicators', () => {
      act(() => {
        useUIStore.getState().setShowTypingIndicators(false);
      });
      expect(useUIStore.getState().showTypingIndicators).toBe(false);
    });

    it('should set hideJoinMessages', () => {
      act(() => {
        useUIStore.getState().setHideJoinMessages(true);
      });
      expect(useUIStore.getState().hideJoinMessages).toBe(true);
    });

    it('should set hidePartMessages', () => {
      act(() => {
        useUIStore.getState().setHidePartMessages(true);
      });
      expect(useUIStore.getState().hidePartMessages).toBe(true);
    });

    it('should set hideQuitMessages', () => {
      act(() => {
        useUIStore.getState().setHideQuitMessages(true);
      });
      expect(useUIStore.getState().hideQuitMessages).toBe(true);
    });

    it('should set hideIrcServiceListenerMessages', () => {
      act(() => {
        useUIStore.getState().setHideIrcServiceListenerMessages(false);
      });
      expect(useUIStore.getState().hideIrcServiceListenerMessages).toBe(false);
    });
  });

  describe('modal actions - basic', () => {
    it('should set showChannelModal', () => {
      act(() => {
        useUIStore.getState().setShowChannelModal(true);
      });
      expect(useUIStore.getState().showChannelModal).toBe(true);
    });

    it('should set channelName', () => {
      act(() => {
        useUIStore.getState().setChannelName('#general');
      });
      expect(useUIStore.getState().channelName).toBe('#general');
    });

    it('should set showNetworksList', () => {
      act(() => {
        useUIStore.getState().setShowNetworksList(true);
      });
      expect(useUIStore.getState().showNetworksList).toBe(true);
    });

    it('should set showSettings', () => {
      act(() => {
        useUIStore.getState().setShowSettings(true);
      });
      expect(useUIStore.getState().showSettings).toBe(true);
    });

    it('should set showPurchaseScreen', () => {
      act(() => {
        useUIStore.getState().setShowPurchaseScreen(true);
      });
      expect(useUIStore.getState().showPurchaseScreen).toBe(true);
    });

    it('should set showIgnoreList', () => {
      act(() => {
        useUIStore.getState().setShowIgnoreList(true);
      });
      expect(useUIStore.getState().showIgnoreList).toBe(true);
    });

    it('should set showBlacklist', () => {
      act(() => {
        useUIStore.getState().setShowBlacklist(true);
      });
      expect(useUIStore.getState().showBlacklist).toBe(true);
    });

    it('should set showWHOIS', () => {
      act(() => {
        useUIStore.getState().setShowWHOIS(true);
      });
      expect(useUIStore.getState().showWHOIS).toBe(true);
    });

    it('should set whoisNick', () => {
      act(() => {
        useUIStore.getState().setWhoisNick('nickname');
      });
      expect(useUIStore.getState().whoisNick).toBe('nickname');
    });

    it('should set showQueryEncryptionMenu', () => {
      act(() => {
        useUIStore.getState().setShowQueryEncryptionMenu(true);
      });
      expect(useUIStore.getState().showQueryEncryptionMenu).toBe(true);
    });

    it('should set showChannelList', () => {
      act(() => {
        useUIStore.getState().setShowChannelList(true);
      });
      expect(useUIStore.getState().showChannelList).toBe(true);
    });

    it('should set showUserList', () => {
      act(() => {
        useUIStore.getState().setShowUserList(true);
      });
      expect(useUIStore.getState().showUserList).toBe(true);
    });

    it('should set showChannelSettings', () => {
      act(() => {
        useUIStore.getState().setShowChannelSettings(true);
      });
      expect(useUIStore.getState().showChannelSettings).toBe(true);
    });

    it('should set channelSettingsTarget', () => {
      act(() => {
        useUIStore.getState().setChannelSettingsTarget('#general');
      });
      expect(useUIStore.getState().channelSettingsTarget).toBe('#general');
    });

    it('should set channelSettingsNetwork', () => {
      act(() => {
        useUIStore.getState().setChannelSettingsNetwork('freenode');
      });
      expect(useUIStore.getState().channelSettingsNetwork).toBe('freenode');
    });

    it('should set showOptionsMenu', () => {
      act(() => {
        useUIStore.getState().setShowOptionsMenu(true);
      });
      expect(useUIStore.getState().showOptionsMenu).toBe(true);
    });

    it('should set showRenameModal', () => {
      act(() => {
        useUIStore.getState().setShowRenameModal(true);
      });
      expect(useUIStore.getState().showRenameModal).toBe(true);
    });

    it('should set renameTargetTabId', () => {
      act(() => {
        useUIStore.getState().setRenameTargetTabId('tab-123');
      });
      expect(useUIStore.getState().renameTargetTabId).toBe('tab-123');
    });

    it('should set renameValue', () => {
      act(() => {
        useUIStore.getState().setRenameValue('New Name');
      });
      expect(useUIStore.getState().renameValue).toBe('New Name');
    });

    it('should set showTabOptionsModal', () => {
      act(() => {
        useUIStore.getState().setShowTabOptionsModal(true);
      });
      expect(useUIStore.getState().showTabOptionsModal).toBe(true);
    });

    it('should set tabOptionsTitle', () => {
      act(() => {
        useUIStore.getState().setTabOptionsTitle('Tab Options');
      });
      expect(useUIStore.getState().tabOptionsTitle).toBe('Tab Options');
    });

    it('should set tabOptions', () => {
      const options = [
        { text: 'Option 1', onPress: jest.fn() },
        { text: 'Option 2', onPress: jest.fn(), style: 'destructive' as const },
      ];
      act(() => {
        useUIStore.getState().setTabOptions(options);
      });
      expect(useUIStore.getState().tabOptions).toHaveLength(2);
    });
  });

  describe('channel note actions', () => {
    it('should set showChannelNoteModal', () => {
      act(() => {
        useUIStore.getState().setShowChannelNoteModal(true);
      });
      expect(useUIStore.getState().showChannelNoteModal).toBe(true);
    });

    it('should set channelNoteTarget', () => {
      const target = { networkId: 'net1', channel: '#general' };
      act(() => {
        useUIStore.getState().setChannelNoteTarget(target);
      });
      expect(useUIStore.getState().channelNoteTarget).toEqual(target);
    });

    it('should set channelNoteValue', () => {
      act(() => {
        useUIStore.getState().setChannelNoteValue('This is a note');
      });
      expect(useUIStore.getState().channelNoteValue).toBe('This is a note');
    });
  });

  describe('channel log actions', () => {
    it('should set showChannelLogModal', () => {
      act(() => {
        useUIStore.getState().setShowChannelLogModal(true);
      });
      expect(useUIStore.getState().showChannelLogModal).toBe(true);
    });

    it('should set channelLogEntries', () => {
      const entries = [
        { id: '1', type: 'join' as const, nick: 'user1', timestamp: Date.now(), message: 'joined' },
        { id: '2', type: 'part' as const, nick: 'user2', timestamp: Date.now(), message: 'left' },
      ];
      act(() => {
        useUIStore.getState().setChannelLogEntries(entries);
      });
      expect(useUIStore.getState().channelLogEntries).toEqual(entries);
    });
  });

  describe('prefill message actions', () => {
    it('should set prefillMessage', () => {
      act(() => {
        useUIStore.getState().setPrefillMessage('/msg nick hello');
      });
      expect(useUIStore.getState().prefillMessage).toBe('/msg nick hello');
    });

    it('should clear prefillMessage with null', () => {
      act(() => {
        useUIStore.getState().setPrefillMessage('test');
        useUIStore.getState().setPrefillMessage(null);
      });
      expect(useUIStore.getState().prefillMessage).toBeNull();
    });
  });

  describe('DCC actions', () => {
    it('should set showDccTransfers', () => {
      act(() => {
        useUIStore.getState().setShowDccTransfers(true);
      });
      expect(useUIStore.getState().showDccTransfers).toBe(true);
    });

    it('should set dccTransfersMinimized', () => {
      act(() => {
        useUIStore.getState().setDccTransfersMinimized(true);
      });
      expect(useUIStore.getState().dccTransfersMinimized).toBe(true);
    });

    it('should set showDccSendModal', () => {
      act(() => {
        useUIStore.getState().setShowDccSendModal(true);
      });
      expect(useUIStore.getState().showDccSendModal).toBe(true);
    });

    it('should set dccSendTarget', () => {
      const target = { nick: 'user1', networkId: 'net1' };
      act(() => {
        useUIStore.getState().setDccSendTarget(target);
      });
      expect(useUIStore.getState().dccSendTarget).toEqual(target);
    });

    it('should set dccSendPath', () => {
      act(() => {
        useUIStore.getState().setDccSendPath('/path/to/file.txt');
      });
      expect(useUIStore.getState().dccSendPath).toBe('/path/to/file.txt');
    });
  });

  describe('blacklist actions', () => {
    it('should set blacklistTarget for channel', () => {
      const target = { type: 'channel' as const, networkId: 'net1', channel: '#spam' };
      act(() => {
        useUIStore.getState().setBlacklistTarget(target);
      });
      expect(useUIStore.getState().blacklistTarget).toEqual(target);
    });

    it('should set blacklistTarget for query', () => {
      const target = { type: 'query' as const, networkId: 'net1', nick: 'spammer' };
      act(() => {
        useUIStore.getState().setBlacklistTarget(target);
      });
      expect(useUIStore.getState().blacklistTarget).toEqual(target);
    });

    it('should set blacklistTarget for nick', () => {
      const target = { type: 'nick' as const, networkId: 'net1', nick: 'baduser' };
      act(() => {
        useUIStore.getState().setBlacklistTarget(target);
      });
      expect(useUIStore.getState().blacklistTarget).toEqual(target);
    });

    it('should clear blacklistTarget', () => {
      act(() => {
        useUIStore.getState().setBlacklistTarget({ type: 'nick', networkId: 'net1', nick: 'user' });
        useUIStore.getState().setBlacklistTarget(null);
      });
      expect(useUIStore.getState().blacklistTarget).toBeNull();
    });
  });

  describe('help screen actions', () => {
    it('should set showHelpConnection', () => {
      act(() => {
        useUIStore.getState().setShowHelpConnection(true);
      });
      expect(useUIStore.getState().showHelpConnection).toBe(true);
    });

    it('should set showHelpCommands', () => {
      act(() => {
        useUIStore.getState().setShowHelpCommands(true);
      });
      expect(useUIStore.getState().showHelpCommands).toBe(true);
    });

    it('should set showHelpEncryption', () => {
      act(() => {
        useUIStore.getState().setShowHelpEncryption(true);
      });
      expect(useUIStore.getState().showHelpEncryption).toBe(true);
    });

    it('should set showHelpMedia', () => {
      act(() => {
        useUIStore.getState().setShowHelpMedia(true);
      });
      expect(useUIStore.getState().showHelpMedia).toBe(true);
    });

    it('should set showHelpChannelManagement', () => {
      act(() => {
        useUIStore.getState().setShowHelpChannelManagement(true);
      });
      expect(useUIStore.getState().showHelpChannelManagement).toBe(true);
    });

    it('should set showHelpTroubleshooting', () => {
      act(() => {
        useUIStore.getState().setShowHelpTroubleshooting(true);
      });
      expect(useUIStore.getState().showHelpTroubleshooting).toBe(true);
    });
  });

  describe('updateUIState', () => {
    it('should update multiple state values at once', () => {
      act(() => {
        useUIStore.getState().updateUIState({
          showSettings: true,
          channelName: '#test',
          appLocked: true,
        });
      });

      const state = useUIStore.getState();
      expect(state.showSettings).toBe(true);
      expect(state.channelName).toBe('#test');
      expect(state.appLocked).toBe(true);
    });

    it('should merge with existing state', () => {
      act(() => {
        useUIStore.getState().setAppPinEntry('1234');
        useUIStore.getState().updateUIState({ showSettings: true });
      });

      const state = useUIStore.getState();
      expect(state.showSettings).toBe(true);
      expect(state.appPinEntry).toBe('1234');
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      act(() => {
        useUIStore.getState().setShowSettings(true);
        useUIStore.getState().setAppLocked(true);
        useUIStore.getState().setChannelName('#test');
        useUIStore.getState().setScriptingTimeMs(5000);
        useUIStore.getState().reset();
      });

      const state = useUIStore.getState();
      expect(state.showSettings).toBe(false);
      expect(state.appLocked).toBe(false);
      expect(state.channelName).toBe('');
      expect(state.scriptingTimeMs).toBe(0);
    });

    it('should reset all modal states', () => {
      act(() => {
        useUIStore.getState().setShowChannelModal(true);
        useUIStore.getState().setShowNetworksList(true);
        useUIStore.getState().setShowSettings(true);
        useUIStore.getState().reset();
      });

      const state = useUIStore.getState();
      expect(state.showChannelModal).toBe(false);
      expect(state.showNetworksList).toBe(false);
      expect(state.showSettings).toBe(false);
    });
  });

  describe('resetModalStates', () => {
    it('should reset only modal states to false', () => {
      act(() => {
        useUIStore.getState().setShowChannelModal(true);
        useUIStore.getState().setShowSettings(true);
        useUIStore.getState().setAppLocked(true);
        useUIStore.getState().setScriptingTimeMs(5000);
        
        // @ts-ignore - resetModalStates exists but isn't in type
        useUIStore.getState().resetModalStates();
      });

      const state = useUIStore.getState();
      expect(state.showChannelModal).toBe(false);
      expect(state.showSettings).toBe(false);
      // Non-modal states should remain unchanged
      expect(state.appLocked).toBe(true);
      expect(state.scriptingTimeMs).toBe(5000);
    });

    it('should reset blacklistTarget to null', () => {
      act(() => {
        useUIStore.getState().setBlacklistTarget({ type: 'nick', networkId: 'net1', nick: 'user' });
        // @ts-ignore
        useUIStore.getState().resetModalStates();
      });

      expect(useUIStore.getState().blacklistTarget).toBeNull();
    });

    it('should reset all help screens', () => {
      act(() => {
        useUIStore.getState().setShowHelpConnection(true);
        useUIStore.getState().setShowHelpCommands(true);
        useUIStore.getState().setShowHelpEncryption(true);
        // @ts-ignore
        useUIStore.getState().resetModalStates();
      });

      const state = useUIStore.getState();
      expect(state.showHelpConnection).toBe(false);
      expect(state.showHelpCommands).toBe(false);
      expect(state.showHelpEncryption).toBe(false);
    });

    it('should reset DCC modal states', () => {
      act(() => {
        useUIStore.getState().setShowDccTransfers(true);
        useUIStore.getState().setDccTransfersMinimized(true);
        useUIStore.getState().setShowDccSendModal(true);
        // @ts-ignore
        useUIStore.getState().resetModalStates();
      });

      const state = useUIStore.getState();
      expect(state.showDccTransfers).toBe(false);
      expect(state.dccTransfersMinimized).toBe(false);
      expect(state.showDccSendModal).toBe(false);
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple modal state changes', () => {
      act(() => {
        useUIStore.getState().setShowSettings(true);
        useUIStore.getState().setShowChannelModal(true);
        useUIStore.getState().setShowWHOIS(true);
      });

      const state = useUIStore.getState();
      expect(state.showSettings).toBe(true);
      expect(state.showChannelModal).toBe(true);
      expect(state.showWHOIS).toBe(true);
    });

    it('should handle complete workflow', () => {
      // User opens settings
      act(() => {
        useUIStore.getState().setShowSettings(true);
      });
      expect(useUIStore.getState().showSettings).toBe(true);

      // User enables app lock
      act(() => {
        useUIStore.getState().setAppLockEnabled(true);
        useUIStore.getState().setAppLockUsePin(true);
      });
      expect(useUIStore.getState().appLockEnabled).toBe(true);

      // User closes settings
      act(() => {
        useUIStore.getState().setShowSettings(false);
      });
      expect(useUIStore.getState().showSettings).toBe(false);

      // App gets locked
      act(() => {
        useUIStore.getState().setAppLocked(true);
        useUIStore.getState().setAppUnlockModalVisible(true);
      });
      expect(useUIStore.getState().appLocked).toBe(true);
      expect(useUIStore.getState().appUnlockModalVisible).toBe(true);

      // User enters PIN
      act(() => {
        useUIStore.getState().setAppPinEntry('1234');
      });
      expect(useUIStore.getState().appPinEntry).toBe('1234');

      // Reset after unlock
      act(() => {
        useUIStore.getState().setAppPinEntry('');
        useUIStore.getState().setAppUnlockModalVisible(false);
        useUIStore.getState().setAppLocked(false);
      });
      expect(useUIStore.getState().appLocked).toBe(false);
    });

    it('should handle channel operations workflow', () => {
      // Open channel modal
      act(() => {
        useUIStore.getState().setChannelName('#general');
        useUIStore.getState().setShowChannelModal(true);
      });

      // Close modal and open settings
      act(() => {
        useUIStore.getState().setShowChannelModal(false);
        useUIStore.getState().setShowChannelSettings(true);
        useUIStore.getState().setChannelSettingsTarget('#general');
        useUIStore.getState().setChannelSettingsNetwork('freenode');
      });

      const state = useUIStore.getState();
      expect(state.showChannelModal).toBe(false);
      expect(state.showChannelSettings).toBe(true);
      expect(state.channelSettingsTarget).toBe('#general');
      expect(state.channelSettingsNetwork).toBe('freenode');
    });

    it('should maintain independent boolean states', () => {
      act(() => {
        useUIStore.getState().setHideJoinMessages(true);
        useUIStore.getState().setHidePartMessages(false);
        useUIStore.getState().setHideQuitMessages(true);
      });

      const state = useUIStore.getState();
      expect(state.hideJoinMessages).toBe(true);
      expect(state.hidePartMessages).toBe(false);
      expect(state.hideQuitMessages).toBe(true);
    });
  });
});
