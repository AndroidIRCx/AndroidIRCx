/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { Buffer } from 'buffer';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import consoleManager from './src/utils/consoleManager';
import {
  CALL_NOTIFICATION_ACTIONS,
  notificationService,
} from './src/services/NotificationService';

// Ensure Buffer is available globally for proxy/DCC code paths (Hermes doesn't polyfill it by default)
if (!global.Buffer) {
  global.Buffer = Buffer;
}

// Ensure fetch is available globally (React Native should provide it, but ensure it's not false)
// Some bundlers or environments might set fetch to false, so we ensure it's available
if (
  typeof global !== 'undefined' &&
  (!global.fetch || global.fetch === false)
) {
  // React Native should provide fetch, but if it's missing or false, we'll use a fallback
  // In most cases, React Native provides fetch natively, so this is just a safety check
  if (typeof fetch !== 'undefined' && typeof fetch === 'function') {
    global.fetch = fetch;
  }
}

// Initialize console manager for dev builds
if (__DEV__) {
  consoleManager.initialize();
}

// Register Notifee background handler at the entry point so it is available for headless events
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification } = detail || {};
  if (!notification) {
    return;
  }

  switch (type) {
    case EventType.DISMISSED:
      console.log(
        'NotificationService: User dismissed notification in background',
        notification,
      );
      break;
    case EventType.PRESS:
      console.log(
        'NotificationService: User pressed notification in background',
        notification,
      );
      await notificationService.handleCallNotificationAction(
        CALL_NOTIFICATION_ACTIONS.DEFAULT,
      );
      break;
    case EventType.ACTION_PRESS:
      console.log(
        'NotificationService: User pressed notification action in background',
        detail.pressAction,
      );
      await notificationService.handleCallNotificationAction(
        detail.pressAction?.id || CALL_NOTIFICATION_ACTIONS.DEFAULT,
      );
      break;
  }
});

AppRegistry.registerComponent(appName, () => App);
