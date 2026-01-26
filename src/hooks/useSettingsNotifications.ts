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

  const refreshNotificationPrefs = useCallback(async () => {
    // Refresh permission status first to sync with system settings
    await notificationService.refreshPermissionStatus();
    setNotificationPrefs(notificationService.getPreferences());
  }, []);

  const updateNotificationPrefs = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    const currentPrefs = notificationService.getPreferences();
    const newPrefs = { ...currentPrefs, ...prefs };
    
    // If enabling notifications, check permission first
    if (newPrefs.enabled && !currentPrefs.enabled) {
      // First check if permission is already granted
      const hasPermission = await notificationService.checkPermission();
      if (hasPermission) {
        // Permission is granted, proceed with enabling notifications
        await notificationService.updatePreferences(newPrefs);
        setNotificationPrefs(newPrefs);
        return;
      }
      
      // Permission not granted, try to request it
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            // Check again with notifee in case permission was granted in system settings
            const hasPermissionAfterRequest = await notificationService.checkPermission();
            if (!hasPermissionAfterRequest) {
              // Permission was denied - disable notifications and show alert
              await notificationService.updatePreferences({ enabled: false });
              setNotificationPrefs({ ...currentPrefs, enabled: false });
              Alert.alert(
                t('Permission Required', { _tags: tags }),
                t('Notification permission is required to receive notifications. Please enable it in system settings.', { _tags: tags })
              );
              return;
            }
            // Permission was granted after second check, proceed
          }
        } catch (error) {
          console.error('Failed to request notification permission:', error);
          // Check permission one more time with notifee
          const hasPermissionAfterError = await notificationService.checkPermission();
          if (!hasPermissionAfterError) {
            await notificationService.updatePreferences({ enabled: false });
            setNotificationPrefs({ ...currentPrefs, enabled: false });
            return;
          }
          // Permission was granted, proceed
        }
      } else {
        // iOS - use notifee requestPermission
        const granted = await notificationService.requestPermission();
        if (!granted) {
          // Check again in case permission was granted in system settings
          const hasPermissionAfterRequest = await notificationService.checkPermission();
          if (!hasPermissionAfterRequest) {
            await notificationService.updatePreferences({ enabled: false });
            setNotificationPrefs({ ...currentPrefs, enabled: false });
            Alert.alert(
              t('Permission Required', { _tags: tags }),
              t('Notification permission is required to receive notifications. Please enable it in system settings.', { _tags: tags })
            );
            return;
          }
        }
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
