
import notifee from '@notifee/react-native';

class NotifeeService {
  async displayNotification(title: string, body: string) {
    // Request permissions (required for iOS)
    await notifee.requestPermission();

    // Create a channel (required for Android)
    const channelId = await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
    });

    // Display a notification
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId,
        // add a small icon
        smallIcon: 'ic_launcher',
      },
    });
  }
}

export default new NotifeeService();
