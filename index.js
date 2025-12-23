/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { Buffer } from 'buffer';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Ensure Buffer is available globally for proxy/DCC code paths (Hermes doesn't polyfill it by default)
if (!global.Buffer) {
  global.Buffer = Buffer;
}

// Register Notifee background handler at the entry point so it is available for headless events
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification } = detail || {};
  if (!notification) {
    return;
  }

  switch (type) {
    case EventType.DISMISSED:
      console.log('NotificationService: User dismissed notification in background', notification);
      break;
    case EventType.PRESS:
      console.log('NotificationService: User pressed notification in background', notification);
      // Handle opening the app to a specific screen if needed
      break;
  }
});

AppRegistry.registerComponent(appName, () => App);
