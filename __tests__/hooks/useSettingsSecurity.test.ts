/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useSettingsSecurity hook
 */

// Undo global mock from jest.setup.ts
jest.unmock('../../src/hooks/useSettingsSecurity');

import { renderHook, act } from '@testing-library/react-hooks';
import { useSettingsSecurity } from '../../src/hooks/useSettingsSecurity';

const settingChangeCallbacks: Record<string, (value: any) => void> = {};

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn((key: string, defaultVal: any) => {
      const values: Record<string, any> = {
        killSwitchEnabledOnHeader: true,
        killSwitchEnabledOnLockScreen: false,
        killSwitchShowWarnings: true,
        killSwitchCustomName: 'Panic',
        killSwitchCustomIcon: 'shield',
        killSwitchCustomColor: '#ff0000',
        quickConnectNetworkId: 'net-1',
      };
      return Promise.resolve(values[key] ?? defaultVal);
    }),
    setSetting: jest.fn().mockResolvedValue(undefined),
    onSettingChange: jest.fn((key: string, cb: any) => {
      settingChangeCallbacks[key] = cb;
      return jest.fn(() => { delete settingChangeCallbacks[key]; });
    }),
  },
}));

import { settingsService } from '../../src/services/SettingsService';

const flushPromises = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

describe('useSettingsSecurity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(settingChangeCallbacks).forEach(k => delete settingChangeCallbacks[k]);
  });

  it('should load settings from service', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    expect(result.current.killSwitchEnabledOnHeader).toBe(true);
    expect(result.current.killSwitchEnabledOnLockScreen).toBe(false);
    expect(result.current.killSwitchShowWarnings).toBe(true);
    expect(result.current.killSwitchCustomName).toBe('Panic');
    expect(result.current.killSwitchCustomIcon).toBe('shield');
    expect(result.current.killSwitchCustomColor).toBe('#ff0000');
    expect(result.current.quickConnectNetworkId).toBe('net-1');
  });

  it('should subscribe to 6 setting changes', async () => {
    renderHook(() => useSettingsSecurity());

    await flushPromises();

    expect(settingsService.onSettingChange).toHaveBeenCalledTimes(6);
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('killSwitchCustomName', expect.any(Function));
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('killSwitchCustomIcon', expect.any(Function));
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('killSwitchCustomColor', expect.any(Function));
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('killSwitchEnabledOnHeader', expect.any(Function));
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('killSwitchEnabledOnLockScreen', expect.any(Function));
    expect(settingsService.onSettingChange).toHaveBeenCalledWith('killSwitchShowWarnings', expect.any(Function));
  });

  it('should update state when setting change listener fires', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    act(() => {
      if (settingChangeCallbacks['killSwitchCustomName']) {
        settingChangeCallbacks['killSwitchCustomName']('NewName');
      }
    });

    expect(result.current.killSwitchCustomName).toBe('NewName');
  });

  it('should update icon via setting change listener', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    act(() => {
      if (settingChangeCallbacks['killSwitchCustomIcon']) {
        settingChangeCallbacks['killSwitchCustomIcon']('lock');
      }
    });

    expect(result.current.killSwitchCustomIcon).toBe('lock');
  });

  it('should update header/lock-screen/warnings via setting change listeners', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    act(() => {
      settingChangeCallbacks['killSwitchEnabledOnHeader']?.(false);
      settingChangeCallbacks['killSwitchEnabledOnLockScreen']?.(true);
      settingChangeCallbacks['killSwitchShowWarnings']?.(false);
    });

    expect(result.current.killSwitchEnabledOnHeader).toBe(false);
    expect(result.current.killSwitchEnabledOnLockScreen).toBe(true);
    expect(result.current.killSwitchShowWarnings).toBe(false);
  });

  it('should update custom color via setting change listener', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    act(() => {
      settingChangeCallbacks['killSwitchCustomColor']?.('#123456');
    });

    expect(result.current.killSwitchCustomColor).toBe('#123456');
  });

  it('should set kill switch on header', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    await act(async () => {
      await result.current.setKillSwitchEnabledOnHeader(false);
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith('killSwitchEnabledOnHeader', false);
    expect(result.current.killSwitchEnabledOnHeader).toBe(false);
  });

  it('should set kill switch on lock screen', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    await act(async () => {
      await result.current.setKillSwitchEnabledOnLockScreen(true);
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith('killSwitchEnabledOnLockScreen', true);
    expect(result.current.killSwitchEnabledOnLockScreen).toBe(true);
  });

  it('should set kill switch show warnings', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    await act(async () => {
      await result.current.setKillSwitchShowWarnings(false);
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith('killSwitchShowWarnings', false);
    expect(result.current.killSwitchShowWarnings).toBe(false);
  });

  it('should set custom name', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    await act(async () => {
      await result.current.setKillSwitchCustomName('Emergency');
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith('killSwitchCustomName', 'Emergency');
    expect(result.current.killSwitchCustomName).toBe('Emergency');
  });

  it('should set custom icon', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    await act(async () => {
      await result.current.setKillSwitchCustomIcon('warning');
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith('killSwitchCustomIcon', 'warning');
    expect(result.current.killSwitchCustomIcon).toBe('warning');
  });

  it('should set custom color', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    await act(async () => {
      await result.current.setKillSwitchCustomColor('#00ff00');
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith('killSwitchCustomColor', '#00ff00');
    expect(result.current.killSwitchCustomColor).toBe('#00ff00');
  });

  it('should set quick connect network id', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    await act(async () => {
      await result.current.setQuickConnectNetworkId('net-2');
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith('quickConnectNetworkId', 'net-2');
    expect(result.current.quickConnectNetworkId).toBe('net-2');
  });

  it('should set quick connect network id to null', async () => {
    const { result } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    await act(async () => {
      await result.current.setQuickConnectNetworkId(null);
    });

    expect(settingsService.setSetting).toHaveBeenCalledWith('quickConnectNetworkId', null);
    expect(result.current.quickConnectNetworkId).toBeNull();
  });

  it('should clean up subscriptions on unmount', async () => {
    const { unmount } = renderHook(() => useSettingsSecurity());

    await flushPromises();

    unmount();

    const calls = (settingsService.onSettingChange as jest.Mock).mock.results;
    calls.forEach((result: any) => {
      expect(result.value).toHaveBeenCalled();
    });
  });
});
