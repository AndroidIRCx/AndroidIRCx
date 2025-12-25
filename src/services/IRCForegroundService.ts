import { NativeModules, Platform } from 'react-native';

interface IRCForegroundServiceInterface {
  startService(networkName: string, title: string, text: string): Promise<boolean>;
  stopService(): Promise<boolean>;
  updateNotification(title: string, text: string): Promise<boolean>;
}

const LINKING_ERROR =
  `The package 'IRCForegroundService' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const IRCForegroundServiceNative: IRCForegroundServiceInterface = NativeModules.IRCForegroundService
  ? NativeModules.IRCForegroundService
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

/**
 * Service to keep IRC connection alive in the background on Android
 */
class IRCForegroundService {
  private isRunning = false;

  /**
   * Start the foreground service with a notification
   * @param networkName Name of the IRC network (e.g., "Libera.Chat")
   * @param title Notification title
   * @param text Notification text
   */
  async start(networkName: string, title?: string, text?: string): Promise<void> {
    if (Platform.OS !== 'android') {
      console.log('IRCForegroundService: Foreground service only supported on Android');
      return;
    }

    if (this.isRunning) {
      console.log('IRCForegroundService: Service already running');
      return;
    }

    try {
      const notificationTitle = title || 'IRC Connected';
      const notificationText = text || `Maintaining connection to ${networkName}`;

      await IRCForegroundServiceNative.startService(networkName, notificationTitle, notificationText);
      this.isRunning = true;
      console.log('IRCForegroundService: Started successfully');
    } catch (error) {
      console.error('IRCForegroundService: Failed to start service:', error);
      throw error;
    }
  }

  /**
   * Stop the foreground service
   */
  async stop(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    if (!this.isRunning) {
      console.log('IRCForegroundService: Service not running');
      return;
    }

    try {
      await IRCForegroundServiceNative.stopService();
      this.isRunning = false;
      console.log('IRCForegroundService: Stopped successfully');
    } catch (error) {
      console.error('IRCForegroundService: Failed to stop service:', error);
      throw error;
    }
  }

  /**
   * Update the notification text (e.g., when changing channels or networks)
   * @param title New notification title
   * @param text New notification text
   */
  async updateNotification(title: string, text: string): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    if (!this.isRunning) {
      console.log('IRCForegroundService: Service not running, cannot update notification');
      return;
    }

    try {
      await IRCForegroundServiceNative.updateNotification(title, text);
      console.log('IRCForegroundService: Notification updated');
    } catch (error) {
      console.error('IRCForegroundService: Failed to update notification:', error);
    }
  }

  /**
   * Check if service is currently running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const ircForegroundService = new IRCForegroundService();
