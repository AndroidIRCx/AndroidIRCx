/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for useSettingsNotifications hook
 */

// Undo global mock from jest.setup.ts
jest.unmock('../../src/hooks/useSettingsNotifications');

import { renderHook, act } from '@testing-library/react-hooks';
import { useSettingsNotifications } from '../../src/hooks/useSettingsNotifications';
import { Alert, Platform, PermissionsAndroid } from 'react-native';

const mockPrefs = {
  enabled: false,
  volume: 0.8,
  sound: true,
  vibrate: true,
};

jest.mock('../../src/services/NotificationService', () => ({
  notificationService: {
    getPreferences: jest.fn(() => ({ ...mockPrefs })),
    updatePreferences: jest.fn().mockResolvedValue(undefined),
    checkPermission: jest.fn().mockResolvedValue(false),
    requestPermission: jest.fn().mockResolvedValue(true),
    refreshPermissionStatus: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/BackgroundService', () => ({
  backgroundService: {
    isBackgroundConnectionEnabled: jest.fn(() => false),
    setBackgroundConnectionEnabled: jest.fn(),
    isBatteryOptimizationEnabled: jest.fn().mockResolvedValue(true),
    openBatteryOptimizationSettings: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string) => key,
}));

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'android' },
  PermissionsAndroid: {
    request: jest.fn().mockResolvedValue('granted'),
    PERMISSIONS: {
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
  },
}));

import { notificationService } from '../../src/services/NotificationService';
import { backgroundService } from '../../src/services/BackgroundService';

const flushPromises = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });

describe('useSettingsNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return initial notification preferences', () => {
    const { result } = renderHook(() => useSettingsNotifications());

    expect(result.current.notificationPrefs).toEqual(mockPrefs);
  });

  it('should return initial background state', () => {
    const { result } = renderHook(() => useSettingsNotifications());

    expect(result.current.backgroundEnabled).toBe(false);
    expect(result.current.batteryOptEnabledStatus).toBe(false);
  });

  it('should check battery optimization on mount (Android)', async () => {
    renderHook(() => useSettingsNotifications());

    await flushPromises();

    expect(backgroundService.isBatteryOptimizationEnabled).toHaveBeenCalled();
  });

  it('should set battery optimization status', async () => {
    const { result } = renderHook(() => useSettingsNotifications());

    await flushPromises();

    expect(result.current.batteryOptEnabledStatus).toBe(true);
  });

  it('should skip battery check on iOS', async () => {
    (Platform as any).OS = 'ios';

    renderHook(() => useSettingsNotifications());

    // Give time for async to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(
      backgroundService.isBatteryOptimizationEnabled,
    ).not.toHaveBeenCalled();
  });

  it('should handle initial battery optimization check errors', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (
      backgroundService.isBatteryOptimizationEnabled as jest.Mock
    ).mockRejectedValueOnce(new Error('battery-check-failed'));

    renderHook(() => useSettingsNotifications());
    await flushPromises();

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to check battery optimization:',
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it('should update notification preferences', async () => {
    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.updateNotificationPrefs({ volume: 1.0 });
    });

    expect(notificationService.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ volume: 1.0 }),
    );
  });

  it('should request permission when enabling notifications on Android', async () => {
    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.updateNotificationPrefs({ enabled: true });
    });

    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      'android.permission.POST_NOTIFICATIONS',
    );
  });

  it('should enable notifications when Android permission granted', async () => {
    (PermissionsAndroid.request as jest.Mock).mockResolvedValue('granted');

    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.updateNotificationPrefs({ enabled: true });
    });

    expect(notificationService.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('should show alert when Android permission denied', async () => {
    (PermissionsAndroid.request as jest.Mock).mockResolvedValue('denied');
    (notificationService.checkPermission as jest.Mock).mockResolvedValue(false);

    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.updateNotificationPrefs({ enabled: true });
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Permission Required',
      expect.stringContaining('Notification permission is required'),
    );
    expect(notificationService.updatePreferences).toHaveBeenCalledWith({
      enabled: false,
    });
  });

  it('should proceed if permission check succeeds after Android denial', async () => {
    (PermissionsAndroid.request as jest.Mock).mockResolvedValue('denied');
    (notificationService.checkPermission as jest.Mock)
      .mockResolvedValueOnce(false) // First call - initial check
      .mockResolvedValueOnce(true); // Second call - after denial re-check

    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.updateNotificationPrefs({ enabled: true });
    });

    expect(notificationService.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('should use notifee request on iOS', async () => {
    (Platform as any).OS = 'ios';
    (notificationService.requestPermission as jest.Mock).mockResolvedValue(
      true,
    );

    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.updateNotificationPrefs({ enabled: true });
    });

    expect(notificationService.requestPermission).toHaveBeenCalled();
    expect(notificationService.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('should show alert when iOS permission denied', async () => {
    (Platform as any).OS = 'ios';
    (notificationService.requestPermission as jest.Mock).mockResolvedValue(
      false,
    );
    (notificationService.checkPermission as jest.Mock).mockResolvedValue(false);

    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.updateNotificationPrefs({ enabled: true });
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Permission Required',
      expect.stringContaining('Notification permission is required'),
    );
  });

  it('should skip permission check when already has permission', async () => {
    (notificationService.checkPermission as jest.Mock).mockResolvedValue(true);

    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.updateNotificationPrefs({ enabled: true });
    });

    // Should not request Android permission since already granted
    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    expect(notificationService.updatePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('should set background enabled', async () => {
    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.setBackgroundEnabled(true);
    });

    expect(
      backgroundService.setBackgroundConnectionEnabled,
    ).toHaveBeenCalledWith(true);
    expect(result.current.backgroundEnabled).toBe(true);
  });

  it('should handle battery optimization settings', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.handleBatteryOptimization();
    });

    expect(
      backgroundService.openBatteryOptimizationSettings,
    ).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should re-check battery optimization status after opening settings', async () => {
    jest.useFakeTimers();
    (
      backgroundService.isBatteryOptimizationEnabled as jest.Mock
    ).mockResolvedValue(false);
    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.handleBatteryOptimization();
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(backgroundService.isBatteryOptimizationEnabled).toHaveBeenCalled();
    expect(result.current.batteryOptEnabledStatus).toBe(false);
    jest.useRealTimers();
  });

  it('should handle battery optimization re-check errors after timeout', async () => {
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (
      backgroundService.isBatteryOptimizationEnabled as jest.Mock
    ).mockResolvedValueOnce(true);
    (
      backgroundService.isBatteryOptimizationEnabled as jest.Mock
    ).mockRejectedValueOnce(new Error('recheck-failed'));

    const { result } = renderHook(() => useSettingsNotifications());
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.handleBatteryOptimization();
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to re-check battery optimization:',
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  it('should show alert when battery optimization settings fail', async () => {
    (
      backgroundService.openBatteryOptimizationSettings as jest.Mock
    ).mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.handleBatteryOptimization();
    });

    expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String));
  });

  it('should skip battery optimization on iOS', async () => {
    (Platform as any).OS = 'ios';

    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.handleBatteryOptimization();
    });

    expect(
      backgroundService.openBatteryOptimizationSettings,
    ).not.toHaveBeenCalled();
  });

  it('should refresh notification preferences', async () => {
    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.refreshNotificationPrefs();
    });

    expect(notificationService.refreshPermissionStatus).toHaveBeenCalled();
    expect(notificationService.getPreferences).toHaveBeenCalled();
  });

  it('should handle permission request error gracefully on Android', async () => {
    (PermissionsAndroid.request as jest.Mock).mockRejectedValue(
      new Error('Permission error'),
    );
    (notificationService.checkPermission as jest.Mock).mockResolvedValue(false);

    const { result } = renderHook(() => useSettingsNotifications());

    await act(async () => {
      await result.current.updateNotificationPrefs({ enabled: true });
    });

    // Should disable notifications on error
    expect(notificationService.updatePreferences).toHaveBeenCalledWith({
      enabled: false,
    });
  });
});
