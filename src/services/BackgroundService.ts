/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * BackgroundService
 * 
 * Manages background connection state and notifications for AndroidIRCX.
 * 
 * Features:
 * - Monitors app state (foreground/background)
 * - Keeps IRC connection alive when app is in background
 * - Sends notifications for messages received in background
 * - Handles battery optimization requests (Android)
 * 
 * Usage:
 * - Initialize with backgroundService.initialize() on app start
 * - Cleanup with backgroundService.cleanup() on app shutdown
 * - Configure notifications with updateNotificationConfig()
 * - Enable/disable background connection with setBackgroundConnectionEnabled()
 */

import { AppState, AppStateStatus } from 'react-native';
import { IRCService, IRCMessage, ircService } from './IRCService';
import { notificationService } from './NotificationService';
import { messageHistoryService } from './MessageHistoryService';
import { settingsService } from './SettingsService';
import { RequestDisableOptimization, BatteryOptEnabled, OpenOptimizationSettings } from "react-native-battery-optimization-check";
import { connectionManager } from './ConnectionManager';
import { tx } from '../i18n/transifex';

// Keep for backward compatibility, but use NotificationService internally
export interface BackgroundNotificationConfig {
  enabled: boolean;
  notifyOnMentions: boolean;
  notifyOnPrivateMessages: boolean;
  notifyOnAllMessages: boolean;
  doNotDisturb: boolean;
}

class BackgroundService {
  private appState: AppStateStatus = 'active';
  private appStateListener: any = null;
  private messageListenerCleanups: Map<string, () => void> = new Map();
  private notificationQueue: Map<string, IRCMessage[]> = new Map(); // channel -> messages
  private lastNotificationTime: Map<string, number> = new Map(); // channel -> timestamp
  private readonly NOTIFICATION_THROTTLE_MS = 5000; // Don't spam notifications
  private backgroundConnectionEnabled: boolean = true;
  private backgroundCheckTimer: ReturnType<typeof setInterval> | null = null;
  private backgroundConnectionListeners: Array<(enabled: boolean) => void> = [];
  private showRawCommandsEnabled: boolean = true;
  private showRawCommandsUnsub: (() => void) | null = null;

  /**
   * Initialize background service
   */
  async initialize(): Promise<void> {
    try {
      const showRaw = await settingsService.getSetting('showRawCommands', true);
      this.showRawCommandsEnabled = Boolean(showRaw);
      this.showRawCommandsUnsub = settingsService.onSettingChange('showRawCommands', (value: boolean) => {
        this.showRawCommandsEnabled = Boolean(value);
      });
      this.setupAppStateListener();
      console.log('BackgroundService: Initialized');
    } catch (error) {
      console.error('BackgroundService: Error setting up listeners:', error);
    }
  }

  /**
   * Cleanup background service
   */
  cleanup(): void {
    if (this.appStateListener) {
      // In React Native 0.65+, remove() is called on the subscription
      if (typeof this.appStateListener.remove === 'function') {
        this.appStateListener.remove();
      }
      this.appStateListener = null;
    }
    if (this.showRawCommandsUnsub) {
      this.showRawCommandsUnsub();
      this.showRawCommandsUnsub = null;
    }
    this.unregisterMessageListener();
    this.stopBackgroundPolling();
    this.notificationQueue.clear();
    this.lastNotificationTime.clear();
    console.log('BackgroundService: Cleaned up');
  }

  /**
   * Setup app state listener to monitor foreground/background transitions
   */
  private setupAppStateListener(): void {
    // Get initial state
    this.appState = AppState.currentState;

    // Listen for state changes
    // Note: In React Native 0.65+, addEventListener returns a subscription object
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const wasBackground = this.appState.match(/inactive|background/);
      const isBackground = nextAppState.match(/inactive|background/);
      const wasActive = this.appState === 'active';
      const isActive = nextAppState === 'active';

      if (wasBackground && isActive) {
        // App came to foreground
        this.handleAppForeground();
      } else if (wasActive && isBackground) {
        // App went to background
        this.handleAppBackground();
      }

      this.appState = nextAppState;
      console.log(`BackgroundService: App state changed to ${nextAppState}`);
    });

    // Store subscription for cleanup
    this.appStateListener = subscription;
  }

  /**
   * Setup message listener to handle notifications
   * Now supports multi-server by listening to all active connections
   */
  /**
   * Check if app is in background
   */
  isAppInBackground(): boolean {
    return this.appState.match(/inactive|background/) !== null;
  }

  /**
   * Handle app going to background
   */
  private handleAppBackground(): void {
    console.log('BackgroundService: App went to background, keeping connection alive');
    // Connection is already maintained by the socket
    // Ensure every active connection has a listener so notifications fire for all networks
    this.syncMessageListeners();
    this.startBackgroundPolling();
  }

  /**
   * Handle app coming to foreground
   */
  private handleAppForeground(): void {
    console.log('BackgroundService: App came to foreground');
    // Clear notification queue when app comes to foreground
    this.notificationQueue.clear();
    this.lastNotificationTime.clear();
    this.unregisterMessageListener();
    this.stopBackgroundPolling();
  }

  private getServicesToMonitor(): { id: string; service: IRCService }[] {
    const connections = connectionManager.getAllConnections();
    if (connections.length === 0) {
      return [{ id: 'singleton', service: ircService }];
    }
    return connections.map((ctx) => ({
      id: ctx.networkId,
      service: ctx.ircService,
    }));
  }

  /**
   * Ensure each active connection has a background message listener so every server can fire notifications.
   */
  private syncMessageListeners(): void {
    const services = this.getServicesToMonitor();
    const seenIds = new Set<string>();
    services.forEach(({ id, service }) => {
      seenIds.add(id);
      if (this.messageListenerCleanups.has(id)) {
        return;
      }
      const cleanup = service.onMessage(async (message: IRCMessage) => {
        if (!this.isAppInBackground()) return;
        const networkName = message.network || service.getNetworkName();
        const isRawMessage = message.type === 'raw' || message.isRaw;
        if (!isRawMessage || this.showRawCommandsEnabled) {
          messageHistoryService.saveMessage(message, networkName).catch(err => {
            console.error('BackgroundService: Failed to save message history in background:', err);
          });
        }
        if (this.shouldNotify(message, service)) {
          await this.handleBackgroundMessage(message, service);
        }
      });
      this.messageListenerCleanups.set(id, cleanup);
    });

    for (const id of Array.from(this.messageListenerCleanups.keys())) {
      if (!seenIds.has(id)) {
        const cleanup = this.messageListenerCleanups.get(id);
        cleanup?.();
        this.messageListenerCleanups.delete(id);
      }
    }
  }

  private unregisterMessageListener(): void {
    this.messageListenerCleanups.forEach((cleanup) => cleanup());
    this.messageListenerCleanups.clear();
  }

  private startBackgroundPolling(): void {
    if (this.backgroundCheckTimer) {
      return;
    }
    this.backgroundCheckTimer = setInterval(() => {
      if (!this.isAppInBackground()) return;
      this.syncMessageListeners();
    }, 2000);
  }

  private stopBackgroundPolling(): void {
    if (this.backgroundCheckTimer) {
      clearInterval(this.backgroundCheckTimer);
      this.backgroundCheckTimer = null;
    }
  }

  /**
   * Determine if a message should trigger a notification
   */
  private shouldNotify(message: IRCMessage, service: IRCService): boolean {
    // Use NotificationService to check if we should notify
    return notificationService.shouldNotify(
      {
        from: message.from,
        text: message.text,
        channel: message.channel,
        type: message.type,
      },
      service.getCurrentNick(),
      service.getNetworkName()
    );
  }

  private getNotificationChannelKey(message: IRCMessage, service: IRCService): string {
    const channelName = message.channel || 'unknown';
    const networkName = message.network || service.getNetworkName();
    return `${networkName}:${channelName}`;
  }

  /**
   * Handle message received while app is in background
   */
  private async handleBackgroundMessage(message: IRCMessage, service: IRCService): Promise<void> {
    const channelKey = this.getNotificationChannelKey(message, service);
    const now = Date.now();
    const lastTime = this.lastNotificationTime.get(channelKey) || 0;

    // Throttle notifications to avoid spam
    if (now - lastTime < this.NOTIFICATION_THROTTLE_MS) {
      // Queue message for batch notification
      if (!this.notificationQueue.has(channelKey)) {
        this.notificationQueue.set(channelKey, []);
      }
      this.notificationQueue.get(channelKey)!.push(message);
      return;
    }

    // Send notification
    await this.sendNotification(message, service);
    this.lastNotificationTime.set(channelKey, now);
  }

  /**
   * Send notification for a message
   */
  private async sendNotification(message: IRCMessage, service: IRCService): Promise<void> {
    // Use NotificationService to show the notification
    await notificationService.showMessageNotification(
      {
        from: message.from,
        text: message.text,
        channel: message.channel,
        type: message.type,
      },
      service.getCurrentNick(),
      service.getNetworkName()
    );
  }

  /**
   * Process queued notifications (called periodically or when app comes to foreground)
   */
  async processNotificationQueue(): Promise<void> {
    const t = (key: string, params?: Record<string, unknown>) => {
      const translator = (tx as any)?.t;
      return typeof translator === 'function' ? translator(key, params) : key;
    };
    for (const [channelKey, messages] of this.notificationQueue.entries()) {
      if (messages.length === 0) continue;
      const count = messages.length;
      const lastMessage = messages[messages.length - 1];
      const channelName = lastMessage.channel || t('Unknown');
      const networkName = lastMessage.network || 'unknown';
      const title = t('{channel} ({count} new message{suffix})', {
        channel: channelName,
        count,
        suffix: count > 1 ? 's' : '',
      });
      const body = lastMessage.text || '';

      await notificationService.showNotification(title, body, channelName, networkName, lastMessage.type);
      this.lastNotificationTime.set(channelKey, Date.now());
    }

    this.notificationQueue.clear();
  }

  /**
   * Update notification configuration (delegates to NotificationService)
   */
  async updateNotificationConfig(config: Partial<BackgroundNotificationConfig>): Promise<void> {
    await notificationService.updatePreferences(config);
    console.log('BackgroundService: Notification config updated', config);
  }

  /**
   * Get current notification configuration (delegates to NotificationService)
   */
  getNotificationConfig(): BackgroundNotificationConfig {
    const prefs = notificationService.getPreferences();
    return {
      enabled: prefs.enabled,
      notifyOnMentions: prefs.notifyOnMentions,
      notifyOnPrivateMessages: prefs.notifyOnPrivateMessages,
      notifyOnAllMessages: prefs.notifyOnAllMessages,
      doNotDisturb: prefs.doNotDisturb,
    };
  }

  /**
   * Update channel-specific notification preferences
   */
  async updateChannelNotificationConfig(
    channel: string,
    config: Partial<BackgroundNotificationConfig>
  ): Promise<void> {
    await notificationService.updateChannelPreferences(channel, config);
  }

  /**
   * Update network-specific notification preferences
   */
  async updateNetworkNotificationConfig(
    network: string,
    config: Partial<BackgroundNotificationConfig>
  ): Promise<void> {
    await notificationService.updateNetworkPreferences(network, config);
  }

  /**
   * Check if connection should be kept alive in background
   */
  shouldKeepAlive(): boolean {
    const activeConnection = connectionManager.getActiveConnection();
    if (activeConnection) {
      return this.backgroundConnectionEnabled && activeConnection.ircService.getConnectionStatus();
    }
    // Fallback to singleton mode
    const { ircService } = require('./IRCService');
    return this.backgroundConnectionEnabled && ircService.getConnectionStatus();
  }

  /**
   * Enable or disable background connection
   */
  setBackgroundConnectionEnabled(enabled: boolean): void {
    this.backgroundConnectionEnabled = enabled;
    this.backgroundConnectionListeners.forEach(listener => {
      try {
        listener(enabled);
      } catch (error) {
        console.error('BackgroundService: Error in background connection listener:', error);
      }
    });
    console.log(`BackgroundService: Background connection ${enabled ? 'enabled' : 'disabled'}`);
  }

  onBackgroundConnectionChange(callback: (enabled: boolean) => void): () => void {
    this.backgroundConnectionListeners.push(callback);
    return () => {
      const index = this.backgroundConnectionListeners.indexOf(callback);
      if (index > -1) {
        this.backgroundConnectionListeners.splice(index, 1);
      }
    };
  }

  /**
   * Check if background connection is enabled
   */
  isBackgroundConnectionEnabled(): boolean {
    return this.backgroundConnectionEnabled;
  }

  /**
   * Opens the battery optimization settings screen (Android).
   * This allows the user to manually enable or disable battery optimization for the app.
   */
  async openBatteryOptimizationSettings(): Promise<void> {
    console.log('BackgroundService: Attempting to open battery optimization settings...');
    try {
      OpenOptimizationSettings();
      console.log('BackgroundService: Call to OpenOptimizationSettings() completed.');
    } catch (error) {
      console.error('BackgroundService: Error opening battery optimization settings:', error);
    }
  }

  /**
   * Check if battery optimization is enabled (Android)
   */
  async isBatteryOptimizationEnabled(): Promise<boolean> {
    console.log('BackgroundService: Checking battery optimization status');
    try {
      return await BatteryOptEnabled();
    } catch (error) {
      console.error('BackgroundService: Error checking battery optimization status:', error);
      return false;
    }
  }
}

export const backgroundService = new BackgroundService();

