/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * NotificationService
 * 
 * Cross-platform notification service for AndroidIRCX.
 * Handles local notifications for mentions, private messages, and channel messages.
 * Uses react-native-notifications for cross-platform support.
 */

import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance, AndroidCategory, EventType } from '@notifee/react-native';
import { tx } from '../i18n/transifex';

export interface NotificationPreferences {
  enabled: boolean;
  notifyOnMentions: boolean;
  notifyOnPrivateMessages: boolean;
  notifyOnAllMessages: boolean;
  doNotDisturb: boolean;
  // Per-channel preferences (channel name -> preferences)
  channelPreferences: Map<string, NotificationPreferences>;
  // Per-network preferences (network name -> preferences)
  networkPreferences: Map<string, NotificationPreferences>;
}

interface NotificationData {
  id: string;
  title: string;
  body: string;
  channel: string;
  network?: string;
  timestamp: number;
}

class NotificationService {
  private notificationIdCounter: number = 0;
  private readonly STORAGE_KEY = '@AndroidIRCX:notificationPreferences';
  private preferences: NotificationPreferences = {
    enabled: true,
    notifyOnMentions: true,
    notifyOnPrivateMessages: true,
    notifyOnAllMessages: false,
    doNotDisturb: false,
    channelPreferences: new Map(),
    networkPreferences: new Map(),
  };

  /**
   * Check if notification permission is granted
   * Uses both PermissionsAndroid (for Android) and notifee for cross-platform support
   */
  async checkPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // For Android 13+ (API 33+), check POST_NOTIFICATIONS permission directly
        if (Platform.Version >= 33) {
          try {
            const hasPermission = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            console.log('NotificationService: Android permission check (POST_NOTIFICATIONS):', hasPermission);
            if (hasPermission) {
              return true;
            }
          } catch (error) {
            console.warn('NotificationService: Error checking Android permission:', error);
          }
        }
        // For older Android versions or as fallback, check notifee settings
        // Also check notifee for Android 13+ as additional verification
        try {
          const settings = await notifee.getNotificationSettings();
          const notifeeGranted = settings.authorizationStatus === 1; // AuthorizationStatus.AUTHORIZED = 1
          console.log('NotificationService: Notifee permission check:', notifeeGranted);
          return notifeeGranted;
        } catch (error) {
          console.warn('NotificationService: Error checking notifee permission:', error);
        }
        // If both checks fail, return false
        return false;
      } else {
        // iOS - use notifee
        const settings = await notifee.getNotificationSettings();
        return settings.authorizationStatus === 1; // AuthorizationStatus.AUTHORIZED = 1
      }
    } catch (error) {
      console.error('NotificationService: Error checking permission:', error);
      return false;
    }
  }

  /**
   * Refresh permission status and update preferences if needed
   * Call this when app returns to foreground to sync with system settings
   */
  async refreshPermissionStatus(): Promise<void> {
    try {
      const hasPermission = await this.checkPermission();
      // If permission is granted but notifications are disabled, don't auto-enable
      // User must manually enable them. But if permission was revoked, disable notifications.
      if (this.preferences.enabled && !hasPermission) {
        console.warn('NotificationService: Permission revoked, disabling notifications.');
        this.preferences.enabled = false;
        await this.savePreferences();
      }
      // If permission is granted, notifications can be enabled (but don't auto-enable)
      // This allows user to enable notifications even if they were previously disabled
    } catch (error) {
      console.error('NotificationService: Error refreshing permission status:', error);
    }
  }

  /**
   * Request notification permission
   * Uses both PermissionsAndroid (for Android) and notifee for cross-platform support
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // For Android 13+ (API 33+), request POST_NOTIFICATIONS permission directly
        if (Platform.Version >= 33) {
          try {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
            console.log('NotificationService: Android permission request (POST_NOTIFICATIONS):', isGranted);
            if (isGranted) {
              return true;
            }
          } catch (error) {
            console.warn('NotificationService: Error requesting Android permission:', error);
          }
        }
        // Also try notifee requestPermission as fallback or for older Android versions
        try {
          const settings = await notifee.requestPermission();
          const notifeeGranted = settings.authorizationStatus === 1; // AuthorizationStatus.AUTHORIZED = 1
          console.log('NotificationService: Notifee permission request:', notifeeGranted);
          return notifeeGranted;
        } catch (error) {
          console.warn('NotificationService: Error requesting notifee permission:', error);
        }
        return false;
      } else {
        // iOS - use notifee
        const settings = await notifee.requestPermission();
        const granted = settings.authorizationStatus === 1; // AuthorizationStatus.AUTHORIZED = 1
        console.log('NotificationService: Permission request result:', granted ? 'granted' : 'denied');
        return granted;
      }
    } catch (error) {
      console.error('NotificationService: Error requesting permission:', error);
      return false;
    }
  }

  /**
   * Initialize notification service
   */
  async initialize(): Promise<void> {
    await this.loadPreferences();
    const t = (key: string, params?: Record<string, unknown>) => {
      const translator = (tx as any)?.t;
      return typeof translator === 'function' ? translator(key, params) : key;
    };
    
    // Initialize Notifee
    try {
      // Set up foreground event listener
      notifee.onForegroundEvent(({ type, detail }) => {
        switch (type) {
          case EventType.DISMISSED:
            console.log('NotificationService: User dismissed notification', detail.notification);
            break;
          case EventType.PRESS:
            console.log('NotificationService: User pressed notification', detail.notification);
            break;
        }
      });

      // Create a default channel for Android
      // This is required for Android 8.0 (Oreo) and above
      const channelId = await notifee.createChannel({
        id: 'default',
        name: t('Default Channel'),
        importance: AndroidImportance.DEFAULT,
      });
      console.log('NotificationService: Default Android channel created:', channelId);

      // If notifications are enabled, check permission
      // If permission is not granted, automatically disable notifications
      // This prevents silent failures where notifications are enabled but permission is denied
      // However, if permission is granted, keep notifications enabled even if they were previously disabled
      const hasPermission = await this.checkPermission();
      if (this.preferences.enabled && !hasPermission) {
        console.warn('NotificationService: Notifications enabled but permission not granted. Disabling notifications.');
        this.preferences.enabled = false;
        await this.savePreferences();
      } else if (!this.preferences.enabled && hasPermission) {
        // Permission is granted but notifications are disabled - this is fine, user can enable them manually
        // Don't auto-enable, just log that permission is available
        console.log('NotificationService: Permission granted, notifications can be enabled by user.');
      }

      console.log('NotificationService: Initialized with Notifee');
    } catch (error) {
      console.error('NotificationService: Error initializing notifications:', error);
      // Continue without notifications if initialization fails
    }
  }

  /**
   * Load notification preferences from storage
   */
  async loadPreferences(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        // Restore Maps from arrays
        if (parsed.channelPreferences) {
          this.preferences.channelPreferences = new Map(
            Object.entries(parsed.channelPreferences)
          );
        }
        if (parsed.networkPreferences) {
          this.preferences.networkPreferences = new Map(
            Object.entries(parsed.networkPreferences)
          );
        }
        // Copy other preferences
        this.preferences = {
          ...this.preferences,
          ...parsed,
          channelPreferences: this.preferences.channelPreferences,
          networkPreferences: this.preferences.networkPreferences,
        };
      }
    } catch (error) {
      console.error('NotificationService: Error loading preferences:', error);
    }
  }

  /**
   * Save notification preferences to storage
   */
  async savePreferences(): Promise<void> {
    try {
      // Convert Maps to objects for JSON serialization
      const data = {
        ...this.preferences,
        channelPreferences: Object.fromEntries(this.preferences.channelPreferences),
        networkPreferences: Object.fromEntries(this.preferences.networkPreferences),
      };
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('NotificationService: Error saving preferences:', error);
    }
  }

  /**
   * Get notification preferences
   */
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Update global notification preferences
   */
  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    // If enabling notifications, verify permission is still granted before updating
    if (prefs.enabled === true && !this.preferences.enabled) {
      console.log('NotificationService: Enabling notifications, verifying permission...');
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        console.warn('NotificationService: Cannot enable notifications - permission not granted');
        throw new Error('Notification permission not granted');
      }
      console.log('NotificationService: Permission verified, enabling notifications');
    }
    
    this.preferences = { ...this.preferences, ...prefs };
    await this.savePreferences();
  }

  /**
   * Get preferences for a specific channel
   */
  getChannelPreferences(channel: string): NotificationPreferences {
    const channelPrefs = this.preferences.channelPreferences.get(channel);
    if (channelPrefs) {
      return { ...this.preferences, ...channelPrefs };
    }
    return { ...this.preferences };
  }

  /**
   * Update preferences for a specific channel
   */
  async updateChannelPreferences(
    channel: string,
    prefs: Partial<NotificationPreferences>
  ): Promise<void> {
    const current = this.preferences.channelPreferences.get(channel) || { ...this.preferences };
    this.preferences.channelPreferences.set(channel, { ...current, ...prefs });
    await this.savePreferences();
  }

  /**
   * Remove per-channel preferences (fallback to global)
   */
  async removeChannelPreferences(channel: string): Promise<void> {
    this.preferences.channelPreferences.delete(channel);
    await this.savePreferences();
  }

  /**
   * List all per-channel preferences
   */
  listChannelPreferences(): Array<{ channel: string; prefs: NotificationPreferences }> {
    return Array.from(this.preferences.channelPreferences.entries()).map(([channel, prefs]) => ({
      channel,
      prefs: { ...this.preferences, ...prefs },
    }));
  }

  /**
   * Get preferences for a specific network
   */
  getNetworkPreferences(network: string): NotificationPreferences {
    const networkPrefs = this.preferences.networkPreferences.get(network);
    if (networkPrefs) {
      return { ...this.preferences, ...networkPrefs };
    }
    return { ...this.preferences };
  }

  /**
   * Update preferences for a specific network
   */
  async updateNetworkPreferences(
    network: string,
    prefs: Partial<NotificationPreferences>
  ): Promise<void> {
    const current = this.preferences.networkPreferences.get(network) || { ...this.preferences };
    this.preferences.networkPreferences.set(network, { ...current, ...prefs });
    await this.savePreferences();
  }

  /**
   * Show a local notification using react-native-notifications
   */
  async showNotification(
    title: string,
    body: string,
    channel: string,
    network?: string
  ): Promise<void> {
    // Check if permission is granted before showing notification
    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      console.warn('NotificationService: Notification permission not granted, skipping notification');
      return;
    }

    const notificationId = `irc_notification_${++this.notificationIdCounter}_${Date.now()}`;

    try {
      // Define Android channel ID (default to 'default')
      const androidChannelId = 'default';

      await notifee.displayNotification({
        id: notificationId,
        title,
        body,
        data: {
          channel,
          network: network || '',
          timestamp: Date.now(),
        },
        android: {
          channelId: androidChannelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          // Customize sound and vibration if needed
          // sound: 'default', // Requires sound file in res/raw
          // vibrate: true,
        },
        ios: {
          sound: 'default',
          badge: 1,
        }
      });
      
      console.log(`NotificationService: Notification sent - ${title}: ${body}`);
    } catch (error) {
      console.error('NotificationService: Error showing notification:', error);
      // Fallback to console log if notification fails
      console.log(`[Notification] ${title}: ${body}`);
    }
  }

  /**
   * Show notification for a message
   */
  async showMessageNotification(
    message: { from?: string; text: string; channel?: string },
    currentNick: string,
    network?: string
  ): Promise<void> {
    const t = (key: string, params?: Record<string, unknown>) => {
      const translator = (tx as any)?.t;
      return typeof translator === 'function' ? translator(key, params) : key;
    };
    const channel = message.channel || t('Unknown');
    const isChannel = channel.startsWith('#') || 
                     channel.startsWith('&') || 
                     channel.startsWith('+') || 
                     channel.startsWith('!');

    let title: string;
    let body: string;

    if (!isChannel) {
      // Private message
      title = t('Message from {name}', { name: message.from || t('Unknown') });
      body = message.text || '';
    } else {
      // Channel message
      title = `${channel}`;
      body = t('{from}: {text}', { from: message.from || t('Unknown'), text: message.text || '' });
    }

    await this.showNotification(title, body, channel, network);
  }

  /**
   * Cancel a notification
   */
  cancelNotification(notificationId: string): void {
    try {
      notifee.cancelNotification(notificationId);
      console.log('NotificationService: Cancelled notification', notificationId);
    } catch (error) {
      console.error('NotificationService: Error cancelling notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  cancelAllNotifications(): void {
    try {
      notifee.cancelAllNotifications();
      console.log('NotificationService: Cancelled all notifications');
    } catch (error) {
      console.error('NotificationService: Error cancelling all notifications:', error);
    }
  }

  /**
   * Set application badge count (iOS)
   */
  setBadgeCount(count: number): void {
    try {
      notifee.setBadgeCount(count);
    } catch (error) {
      console.error('NotificationService: Error setting badge count:', error);
    }
  }

  /**
   * Remove all badges (iOS)
   */
  removeAllBadges(): void {
    try {
      notifee.setBadgeCount(0);
    } catch (error) {
      console.error('NotificationService: Error removing badges:', error);
    }
  }

  /**
   * Check if notifications should be shown for a message
   */
  shouldNotify(
    message: { from?: string; text: string; channel?: string; type?: string },
    currentNick: string,
    network?: string
  ): boolean {
    // Get preferences (check channel/network specific first)
    let prefs: NotificationPreferences;
    if (network) {
      prefs = this.getNetworkPreferences(network);
    } else {
      prefs = { ...this.preferences };
    }

    if (message.channel) {
      const channelPrefs = this.getChannelPreferences(message.channel);
      // Merge channel preferences (channel overrides network/global)
      prefs = { ...prefs, ...channelPrefs };
    }

    // Check if notifications are enabled
    if (!prefs.enabled || prefs.doNotDisturb) {
      return false;
    }

    // Skip raw messages and system messages
    if (message.type === 'raw' || !message.channel) {
      return false;
    }

    const channel = message.channel || 'unknown';
    const isChannel = channel.startsWith('#') || 
                     channel.startsWith('&') || 
                     channel.startsWith('+') || 
                     channel.startsWith('!');

    // Check private messages
    if (!isChannel) {
      return prefs.notifyOnPrivateMessages;
    }

    // Check channel messages
    if (prefs.notifyOnAllMessages) {
      return true;
    }

    if (prefs.notifyOnMentions) {
      // Check if message mentions current nick (escape special regex chars)
      try {
        const escapedNick = currentNick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const mentionPattern = new RegExp(`@?${escapedNick}\\b`, 'i');
        return mentionPattern.test(message.text);
      } catch (error) {
        // Fallback to simple includes if regex fails
        return message.text.toLowerCase().includes(currentNick.toLowerCase());
      }
    }

    return false;
  }
}

export const notificationService = new NotificationService();

