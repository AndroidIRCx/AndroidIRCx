/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useUISettings hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useUISettings } from '../../src/hooks/useUISettings';

const mockStore = {
  setShowRawCommands: jest.fn(),
  setRawCategoryVisibility: jest.fn(),
  setHideJoinMessages: jest.fn(),
  setHidePartMessages: jest.fn(),
  setHideQuitMessages: jest.fn(),
  setHideIrcServiceListenerMessages: jest.fn(),
  setShowTypingIndicators: jest.fn(),
};

const settingChangeCallbacks: Record<string, (value: any) => void> = {};

jest.mock('../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: () => mockStore,
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn((key: string, defaultVal: any) => {
      const values: Record<string, any> = {
        showRawCommands: true,
        rawCategoryVisibility: { server: true, channel: false },
        hideJoinMessages: true,
        hidePartMessages: false,
        hideQuitMessages: true,
        hideIrcServiceListenerMessages: false,
        showTypingIndicators: true,
        autoSwitchPrivate: true,
        tabSortAlphabetical: false,
        showEncryptionIndicators: true,
        autoConnectFavoriteServer: true,
      };
      return Promise.resolve(values[key] ?? defaultVal);
    }),
    onSettingChange: jest.fn((key: string, cb: any) => {
      settingChangeCallbacks[key] = cb;
      return jest.fn(() => {
        delete settingChangeCallbacks[key];
      });
    }),
  },
}));

const mockDefaultVisibility = {
  server: true,
  channel: true,
  ctcp: true,
  numeric: true,
  error: true,
};

jest.mock('../../src/services/IRCService', () => ({
  getDefaultRawCategoryVisibility: jest.fn(() => mockDefaultVisibility),
  RawMessageCategory: {},
}));

jest.mock('../../src/services/ScriptingService', () => ({
  scriptingService: {
    initialize: jest.fn(),
  },
}));

import { settingsService } from '../../src/services/SettingsService';
import { scriptingService } from '../../src/services/ScriptingService';

const flushPromises = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });

describe('useUISettings', () => {
  const mockSetAutoSwitchPrivate = jest.fn();
  const mockSetTabSortAlphabetical = jest.fn();
  const mockSetShowEncryptionIndicators = jest.fn();
  const mockSetAutoConnectFavoriteServer = jest.fn();

  const defaultProps = {
    setAutoSwitchPrivate: mockSetAutoSwitchPrivate,
    setTabSortAlphabetical: mockSetTabSortAlphabetical,
    setShowEncryptionIndicators: mockSetShowEncryptionIndicators,
    setAutoConnectFavoriteServer: mockSetAutoConnectFavoriteServer,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(settingChangeCallbacks).forEach(
      k => delete settingChangeCallbacks[k],
    );
  });

  it('should load raw command settings on mount', async () => {
    renderHook(() => useUISettings(defaultProps));

    await flushPromises();

    expect(settingsService.getSetting).toHaveBeenCalledWith(
      'showRawCommands',
      true,
    );
    expect(mockStore.setShowRawCommands).toHaveBeenCalledWith(true);
  });

  it('should normalize and set raw category visibility', async () => {
    renderHook(() => useUISettings(defaultProps));

    await flushPromises();

    expect(mockStore.setRawCategoryVisibility).toHaveBeenCalledWith(
      expect.objectContaining({
        server: true,
        channel: false, // From saved value
        ctcp: true, // From defaults
      }),
    );
  });

  it('should initialize scripting service', async () => {
    renderHook(() => useUISettings(defaultProps));

    await flushPromises();

    expect(scriptingService.initialize).toHaveBeenCalled();
  });

  it('should load message visibility settings', async () => {
    renderHook(() => useUISettings(defaultProps));

    await flushPromises();

    expect(mockStore.setHideJoinMessages).toHaveBeenCalledWith(true);
    expect(mockStore.setHidePartMessages).toHaveBeenCalledWith(false);
    expect(mockStore.setHideQuitMessages).toHaveBeenCalledWith(true);
    expect(mockStore.setHideIrcServiceListenerMessages).toHaveBeenCalledWith(
      false,
    );
    expect(mockStore.setShowTypingIndicators).toHaveBeenCalledWith(true);
  });

  it('should load UI settings into callback props', async () => {
    renderHook(() => useUISettings(defaultProps));

    await flushPromises();

    expect(mockSetAutoSwitchPrivate).toHaveBeenCalledWith(true);
    expect(mockSetTabSortAlphabetical).toHaveBeenCalledWith(false);
    expect(mockSetShowEncryptionIndicators).toHaveBeenCalledWith(true);
    expect(mockSetAutoConnectFavoriteServer).toHaveBeenCalledWith(true);
  });

  it('should subscribe to setting changes', () => {
    renderHook(() => useUISettings(defaultProps));

    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'hideJoinMessages',
      expect.any(Function),
    );
    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'hidePartMessages',
      expect.any(Function),
    );
    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'hideQuitMessages',
      expect.any(Function),
    );
    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'hideIrcServiceListenerMessages',
      expect.any(Function),
    );
    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'showTypingIndicators',
      expect.any(Function),
    );
    expect(settingsService.onSettingChange).toHaveBeenCalledWith(
      'autoConnectFavoriteServer',
      expect.any(Function),
    );
  });

  it('should update hideJoinMessages via setting change listener', () => {
    renderHook(() => useUISettings(defaultProps));

    if (settingChangeCallbacks.hideJoinMessages) {
      settingChangeCallbacks.hideJoinMessages(true);
    }

    expect(mockStore.setHideJoinMessages).toHaveBeenCalledWith(true);
  });

  it('should update hidePartMessages via setting change listener', () => {
    renderHook(() => useUISettings(defaultProps));

    if (settingChangeCallbacks.hidePartMessages) {
      settingChangeCallbacks.hidePartMessages(true);
    }

    expect(mockStore.setHidePartMessages).toHaveBeenCalledWith(true);
  });

  it('should update hideQuitMessages via setting change listener', () => {
    renderHook(() => useUISettings(defaultProps));

    if (settingChangeCallbacks.hideQuitMessages) {
      settingChangeCallbacks.hideQuitMessages(false);
    }

    expect(mockStore.setHideQuitMessages).toHaveBeenCalledWith(false);
  });

  it('should update hideIrcServiceListenerMessages via listener', () => {
    renderHook(() => useUISettings(defaultProps));

    if (settingChangeCallbacks.hideIrcServiceListenerMessages) {
      settingChangeCallbacks.hideIrcServiceListenerMessages(true);
    }

    expect(mockStore.setHideIrcServiceListenerMessages).toHaveBeenCalledWith(
      true,
    );
  });

  it('should update showTypingIndicators via listener', () => {
    renderHook(() => useUISettings(defaultProps));

    if (settingChangeCallbacks.showTypingIndicators) {
      settingChangeCallbacks.showTypingIndicators(false);
    }

    expect(mockStore.setShowTypingIndicators).toHaveBeenCalledWith(false);
  });

  it('should update autoConnectFavoriteServer via listener', () => {
    renderHook(() => useUISettings(defaultProps));

    if (settingChangeCallbacks.autoConnectFavoriteServer) {
      settingChangeCallbacks.autoConnectFavoriteServer(true);
    }

    expect(mockSetAutoConnectFavoriteServer).toHaveBeenCalledWith(true);
  });

  it('should clean up subscriptions on unmount', () => {
    const { unmount } = renderHook(() => useUISettings(defaultProps));

    unmount();

    const calls = (settingsService.onSettingChange as jest.Mock).mock.results;
    calls.forEach((result: any) => {
      if (result.value && typeof result.value === 'function') {
        expect(result.value).toHaveBeenCalled();
      }
    });
  });

  it('should handle defaults when saved category visibility is undefined', async () => {
    (settingsService.getSetting as jest.Mock).mockImplementation(
      (key: string, defaultVal: any) => {
        if (key === 'rawCategoryVisibility') return Promise.resolve(undefined);
        return Promise.resolve(defaultVal);
      },
    );

    renderHook(() => useUISettings(defaultProps));

    await flushPromises();

    // Should use all defaults
    expect(mockStore.setRawCategoryVisibility).toHaveBeenCalledWith(
      mockDefaultVisibility,
    );
  });
});
