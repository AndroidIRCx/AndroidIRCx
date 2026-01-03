import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import { notificationService, NotificationPreferences } from '../services/NotificationService';
import { backgroundService } from '../services/BackgroundService';
import { useT } from '../i18n/transifex';

export interface UseSettingsNotificationsReturn {
  // Notification preferences
  notificationPrefs: NotificationPreferences;
  
  // Background service
  backgroundEnabled: boolean;
  batteryOptEnabledStatus: boolean;
  
  // Actions
  updateNotificationPrefs: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  setBackgroundEnabled: (value: boolean) => Promise<void>;
  handleBatteryOptimization: () => Promise<void>;
  refreshNotificationPrefs: () => void;
}

export const useSettingsNotifications = (): UseSettingsNotificationsReturn => {
  const t = useT();
  const tags = 'screen:settings,file:useSettingsNotifications.ts,feature:settings';
  
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    notificationService.getPreferences()
  );
  const [backgroundEnabled, setBackgroundEnabledState] = useState(
    backgroundService.isBackgroundConnectionEnabled()
  );
  const [batteryOptEnabledStatus, setBatteryOptEnabledStatus] = useState(false);

  // Load battery optimization status
  useEffect(() => {
    const checkBatteryOptimization = async () => {
      if (Platform.OS === 'android') {
        try {
          const isOptimized = await backgroundService.isBatteryOptimizationEnabled();
          setBatteryOptEnabledStatus(isOptimized);
        } catch (error) {
          console.error('Failed to check battery optimization:', error);
        }
      }
    };
    checkBatteryOptimization();
  }, []);

  const refreshNotificationPrefs = useCallback(() => {
    setNotificationPrefs(notificationService.getPreferences());
  }, []);

  const updateNotificationPrefs = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    const currentPrefs = notificationService.getPreferences();
    const newPrefs = { ...currentPrefs, ...prefs };
    
    // If enabling notifications, request permission
    if (newPrefs.enabled && !currentPrefs.enabled && Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          // Permission was denied - disable notifications and show alert
          await notificationService.updatePreferences({ enabled: false });
          setNotificationPrefs({ ...currentPrefs, enabled: false });
          Alert.alert(
            t('Permission Required', { _tags: tags }),
            t('Notification permission is required to receive notifications. Please enable it in system settings.', { _tags: tags })
          );
          return;
        }
      } catch (error) {
        console.error('Failed to request notification permission:', error);
      }
    }
    
    await notificationService.updatePreferences(newPrefs);
    setNotificationPrefs(newPrefs);
  }, [t, tags]);

  const setBackgroundEnabled = useCallback(async (value: boolean) => {
    setBackgroundEnabledState(value);
    backgroundService.setBackgroundConnectionEnabled(value);
  }, []);

  const handleBatteryOptimization = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        await backgroundService.openBatteryOptimizationSettings();
        // Re-check status after a delay to allow user to return from settings
        setTimeout(async () => {
          try {
            const isOptimized = await backgroundService.isBatteryOptimizationEnabled();
            setBatteryOptEnabledStatus(isOptimized);
          } catch (error) {
            console.error('Failed to re-check battery optimization:', error);
          }
        }, 1000);
      } catch (error) {
        console.error('Failed to open battery optimization settings:', error);
        Alert.alert(
          t('Error', { _tags: tags }),
          t('Failed to open battery optimization settings. Please enable it manually in system settings.', { _tags: tags })
        );
      }
    }
  }, [t, tags]);

  return {
    notificationPrefs,
    backgroundEnabled,
    batteryOptEnabledStatus,
    updateNotificationPrefs,
    setBackgroundEnabled,
    handleBatteryOptimization,
    refreshNotificationPrefs,
  };
};
