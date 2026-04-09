/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for NotifeeService - 100% coverage target
 */

import notifee from '@notifee/react-native';
import NotifeeService from '../../src/services/NotifeeService';

// Mock i18n
jest.mock('../../src/i18n/transifex', () => ({
  tx: {
    t: jest.fn((key: string) => {
      const translations: Record<string, string> = {
        'Default Channel': 'Default Channel',
      };
      return translations[key] || key;
    }),
  },
}));

describe('NotifeeService', () => {
  const mockRequestPermission = notifee.requestPermission as jest.Mock;
  const mockCreateChannel = notifee.createChannel as jest.Mock;
  const mockDisplayNotification = notifee.displayNotification as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('displayNotification', () => {
    it('should display notification with title and body', async () => {
      await NotifeeService.displayNotification('Test Title', 'Test Body');

      expect(mockRequestPermission).toHaveBeenCalled();
      expect(mockCreateChannel).toHaveBeenCalledWith({
        id: 'default',
        name: 'Default Channel',
      });
      expect(mockDisplayNotification).toHaveBeenCalledWith({
        title: 'Test Title',
        body: 'Test Body',
        android: {
          channelId: 'channel',
          smallIcon: 'ic_launcher',
        },
      });
    });

    it('should handle empty title and body', async () => {
      await NotifeeService.displayNotification('', '');

      expect(mockDisplayNotification).toHaveBeenCalledWith({
        title: '',
        body: '',
        android: {
          channelId: 'channel',
          smallIcon: 'ic_launcher',
        },
      });
    });

    it('should handle long title and body', async () => {
      const longTitle = 'A'.repeat(100);
      const longBody = 'B'.repeat(500);

      await NotifeeService.displayNotification(longTitle, longBody);

      expect(mockDisplayNotification).toHaveBeenCalledWith({
        title: longTitle,
        body: longBody,
        android: {
          channelId: 'channel',
          smallIcon: 'ic_launcher',
        },
      });
    });

    it('should handle special characters in title and body', async () => {
      await NotifeeService.displayNotification('Title <>&"\'', 'Body \n\t');

      expect(mockDisplayNotification).toHaveBeenCalledWith({
        title: 'Title <>&"\'',
        body: 'Body \n\t',
        android: {
          channelId: 'channel',
          smallIcon: 'ic_launcher',
        },
      });
    });
  });
});
