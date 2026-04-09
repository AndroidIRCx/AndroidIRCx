/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import notifee from '@notifee/react-native';
import { tx } from '../i18n/transifex';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

class NotifeeService {
  async displayNotification(title: string, body: string) {
    // Request permissions (required for iOS)
    await notifee.requestPermission();

    // Create a channel (required for Android)
    const channelId = await notifee.createChannel({
      id: 'default',
      name: t('Default Channel'),
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
