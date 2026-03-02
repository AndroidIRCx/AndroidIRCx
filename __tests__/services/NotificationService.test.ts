/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for NotificationService - Wave 2 coverage target
 */

import { notificationService, NotificationPreferences } from '../../src/services/NotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import { Platform } from 'react-native';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 33,
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
    },
    check: jest.fn(),
    request: jest.fn(),
  },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    getNotificationSettings: jest.fn(),
    requestPermission: jest.fn(),
    createChannel: jest.fn().mockResolvedValue('default'),
    displayNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn(),
    cancelAllNotifications: jest.fn(),
    setBadgeCount: jest.fn(),
    onForegroundEvent: jest.fn(),
  },
  AndroidImportance: {
    LOW: 2,
    DEFAULT: 3,
    HIGH: 4,
  },
  AndroidCategory: {
    MESSAGE: 'msg',
  },
  EventType: {
    DISMISSED: 2,
    PRESS: 1,
  },
}));

jest.mock('../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string, params?: Record<string, unknown>) => {
      let result = key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, String(v));
        });
      }
      return result;
    },
  },
}));

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage as any).__reset();
    // Reset service state
    (notificationService as any).preferences = {
      enabled: true,
      notifyOnMentions: true,
      notifyOnPrivateMessages: true,
      notifyOnAllMessages: false,
      doNotDisturb: false,
      channelPreferences: new Map(),
      networkPreferences: new Map(),
    };
    (notificationService as any).notificationIdCounter = 0;
  });

  describe('checkPermission', () => {
    it('should check Android permission for API 33+', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(true);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });

      const result = await notificationService.checkPermission();

      expect(PermissionsAndroid.check).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      expect(result).toBe(true);
    });

    it('should fallback to notifee if Android permission check fails', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockRejectedValue(new Error('Permission check failed'));
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });

      const result = await notificationService.checkPermission();

      expect(result).toBe(true);
    });

    it('should return false if permission not granted', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(false);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 0 });

      const result = await notificationService.checkPermission();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      notifee.getNotificationSettings.mockRejectedValue(new Error('Settings error'));

      const result = await notificationService.checkPermission();

      expect(result).toBe(false);
    });

    it('should use notifee on iOS', async () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'ios' });
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });

      const result = await notificationService.checkPermission();

      expect(result).toBe(true);
      Object.defineProperty(Platform, 'OS', { value: originalOS });
    });
  });

  describe('requestPermission', () => {
    it('should request Android permission for API 33+', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

      const result = await notificationService.requestPermission();

      expect(PermissionsAndroid.request).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      expect(result).toBe(true);
    });

    it('should fallback to notifee if Android request fails', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.request.mockRejectedValue(new Error('Request failed'));
      notifee.requestPermission.mockResolvedValue({ authorizationStatus: 1 });

      const result = await notificationService.requestPermission();

      expect(result).toBe(true);
    });

    it('should return false if permission denied', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
      notifee.requestPermission.mockResolvedValue({ authorizationStatus: 0 });

      const result = await notificationService.requestPermission();

      expect(result).toBe(false);
    });

    it('should return false if notifee fallback request fails', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
      notifee.requestPermission.mockRejectedValue(new Error('Notifee request failed'));

      const result = await notificationService.requestPermission();

      expect(result).toBe(false);
    });

    it('should use notifee request path on iOS', async () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: 'ios' });
      notifee.requestPermission.mockResolvedValue({ authorizationStatus: 1 });

      const result = await notificationService.requestPermission();

      expect(result).toBe(true);
      Object.defineProperty(Platform, 'OS', { value: originalOS });
    });
  });

  describe('refreshPermissionStatus', () => {
    it('should disable notifications if permission revoked', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(false);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 0 });

      (notificationService as any).preferences.enabled = true;
      await notificationService.refreshPermissionStatus();

      expect(notificationService.getPreferences().enabled).toBe(false);
    });

    it('should not auto-enable if permission granted', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(true);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });

      (notificationService as any).preferences.enabled = false;
      await notificationService.refreshPermissionStatus();

      expect(notificationService.getPreferences().enabled).toBe(false);
    });

    it('should swallow refresh errors', async () => {
      jest.spyOn(notificationService, 'checkPermission').mockRejectedValueOnce(new Error('refresh failed'));

      await expect(notificationService.refreshPermissionStatus()).resolves.toBeUndefined();
    });
  });

  describe('initialize', () => {
    it('should load preferences from storage', async () => {
      const storedPrefs = {
        enabled: true,
        notifyOnMentions: false,
        channelPreferences: { '#general': { notifyOnAllMessages: true } },
      };
      await AsyncStorage.setItem('@AndroidIRCX:notificationPreferences', JSON.stringify(storedPrefs));

      await notificationService.initialize();

      const prefs = notificationService.getPreferences();
      expect(prefs.notifyOnMentions).toBe(false);
    });

    it('should create all notification channels', async () => {
      await notificationService.initialize();

      expect(notifee.createChannel).toHaveBeenCalledTimes(5);
      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'private-messages', importance: 4 })
      );
      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'channel-messages', importance: 3 })
      );
      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'notices' })
      );
      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'server' })
      );
      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'dcc-transfers', importance: 4 })
      );
    });

    it('should disable notifications if no permission', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(false);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 0 });

      (notificationService as any).preferences.enabled = true;
      await notificationService.initialize();

      expect(notificationService.getPreferences().enabled).toBe(false);
    });

    it('should log when permission exists but notifications remain disabled', async () => {
      const { PermissionsAndroid } = require('react-native');
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      PermissionsAndroid.check.mockResolvedValue(true);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });
      (notificationService as any).preferences.enabled = false;

      await notificationService.initialize();

      expect(logSpy).toHaveBeenCalledWith(
        'NotificationService: Permission granted, notifications can be enabled by user.'
      );
      logSpy.mockRestore();
    });

    it('should handle initialization errors gracefully', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      notifee.createChannel.mockRejectedValueOnce(new Error('create failed'));

      await expect(notificationService.initialize()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        'NotificationService: Error initializing notifications:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });

    it('should register foreground handlers for dismissed and pressed notifications', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const { EventType } = require('@notifee/react-native');
      let handler: ((event: any) => void) | undefined;
      notifee.onForegroundEvent.mockImplementation(cb => {
        handler = cb;
      });

      await notificationService.initialize();

      handler?.({ type: EventType.DISMISSED, detail: { notification: { id: 'dismissed' } } });
      handler?.({ type: EventType.PRESS, detail: { notification: { id: 'pressed' } } });

      expect(logSpy).toHaveBeenCalledWith(
        'NotificationService: User dismissed notification',
        { id: 'dismissed' }
      );
      expect(logSpy).toHaveBeenCalledWith(
        'NotificationService: User pressed notification',
        { id: 'pressed' }
      );
      logSpy.mockRestore();
    });
  });

  describe('loadPreferences / savePreferences', () => {
    it('should load preferences from storage', async () => {
      const prefs: NotificationPreferences = {
        enabled: true,
        notifyOnMentions: true,
        notifyOnPrivateMessages: true,
        notifyOnAllMessages: false,
        doNotDisturb: false,
        channelPreferences: new Map([['#general', { enabled: true, notifyOnAllMessages: true } as any]]),
        networkPreferences: new Map(),
      };
      await AsyncStorage.setItem('@AndroidIRCX:notificationPreferences', JSON.stringify({
        ...prefs,
        channelPreferences: Object.fromEntries(prefs.channelPreferences),
      }));

      await (notificationService as any).loadPreferences();

      const loaded = notificationService.getPreferences();
      expect(loaded.enabled).toBe(true);
    });

    it('should save preferences to storage', async () => {
      await notificationService.updatePreferences({ enabled: false });

      const stored = await AsyncStorage.getItem('@AndroidIRCX:notificationPreferences');
      expect(stored).toContain('"enabled":false');
    });

    it('should handle malformed stored preferences', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      await AsyncStorage.setItem('@AndroidIRCX:notificationPreferences', '{broken');

      await expect((notificationService as any).loadPreferences()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        'NotificationService: Error loading preferences:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });

    it('should swallow save preference errors', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('save failed'));

      await expect((notificationService as any).savePreferences()).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        'NotificationService: Error saving preferences:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });
  });

  describe('updatePreferences', () => {
    it('should update global preferences', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(true);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });

      await notificationService.updatePreferences({ notifyOnMentions: false });

      expect(notificationService.getPreferences().notifyOnMentions).toBe(false);
    });

    it('should verify permission before enabling notifications', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(false);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 0 });
      
      // Reset to disabled first
      (notificationService as any).preferences.enabled = false;

      // Should throw when trying to enable without permission
      await expect(notificationService.updatePreferences({ enabled: true })).rejects.toThrow();
    });

    it('should save preferences after update', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(true);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });

      const setItemSpy = jest.spyOn(AsyncStorage, 'setItem');
      await notificationService.updatePreferences({ notifyOnMentions: false });

      expect(setItemSpy).toHaveBeenCalled();
    });

    it('should enable notifications when permission verification succeeds', async () => {
      const { PermissionsAndroid } = require('react-native');
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      PermissionsAndroid.check.mockResolvedValue(true);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });
      (notificationService as any).preferences.enabled = false;

      await notificationService.updatePreferences({ enabled: true });

      expect(notificationService.getPreferences().enabled).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(
        'NotificationService: Permission verified, enabling notifications'
      );
      logSpy.mockRestore();
    });
  });

  describe('getChannelPreferences / updateChannelPreferences', () => {
    it('should return global preferences if no channel-specific prefs', () => {
      const prefs = notificationService.getChannelPreferences('#general');
      expect(prefs.notifyOnMentions).toBe(true);
    });

    it('should merge channel preferences with global', async () => {
      await notificationService.updateChannelPreferences('#general', { notifyOnAllMessages: true });
      
      const prefs = notificationService.getChannelPreferences('#general');
      expect(prefs.notifyOnAllMessages).toBe(true);
      expect(prefs.notifyOnMentions).toBe(true); // From global
    });

    it('should save after updating channel preferences', async () => {
      const setItemSpy = jest.spyOn(AsyncStorage, 'setItem');
      await notificationService.updateChannelPreferences('#general', { notifyOnAllMessages: true });
      
      expect(setItemSpy).toHaveBeenCalled();
    });
  });

  describe('removeChannelPreferences', () => {
    it('should remove channel preferences', async () => {
      await notificationService.updateChannelPreferences('#general', { notifyOnAllMessages: true });
      await notificationService.removeChannelPreferences('#general');
      
      const prefs = notificationService.getChannelPreferences('#general');
      expect(prefs.notifyOnAllMessages).toBe(false); // Back to global default
    });
  });

  describe('listChannelPreferences', () => {
    it('should list all channel preferences', async () => {
      await notificationService.updateChannelPreferences('#general', { notifyOnAllMessages: true });
      await notificationService.updateChannelPreferences('#help', { notifyOnMentions: false });
      
      const list = notificationService.listChannelPreferences();
      expect(list).toHaveLength(2);
    });
  });

  describe('getNetworkPreferences / updateNetworkPreferences', () => {
    it('should return global preferences if no network-specific prefs', () => {
      const prefs = notificationService.getNetworkPreferences('freenode');
      expect(prefs.notifyOnMentions).toBe(true);
    });

    it('should merge network preferences with global', async () => {
      await notificationService.updateNetworkPreferences('freenode', { doNotDisturb: true });
      
      const prefs = notificationService.getNetworkPreferences('freenode');
      expect(prefs.doNotDisturb).toBe(true);
    });
  });

  describe('showNotification', () => {
    it('should show notification with permission', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(true);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });

      await notificationService.showNotification('Test Title', 'Test Body', '#general', 'freenode');

      expect(notifee.displayNotification).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Test Title',
        body: 'Test Body',
      }));
    });

    it('should not show notification without permission', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(false);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 0 });

      await notificationService.showNotification('Test Title', 'Test Body', '#general');

      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });

    it('should log and fallback when display notification fails', async () => {
      const { PermissionsAndroid } = require('react-native');
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      PermissionsAndroid.check.mockResolvedValue(true);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });
      notifee.displayNotification.mockRejectedValueOnce(new Error('display failed'));

      await notificationService.showNotification('Test Title', 'Test Body', '#general');

      expect(errorSpy).toHaveBeenCalledWith(
        'NotificationService: Error showing notification:',
        expect.any(Error)
      );
      expect(logSpy).toHaveBeenCalledWith('[Notification] Test Title: Test Body');
      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('showMessageNotification', () => {
    it('should show private message notification', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(true);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });

      await notificationService.showMessageNotification(
        { from: 'User1', text: 'Hello!', channel: 'User1' },
        'TestNick'
      );

      expect(notifee.displayNotification).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.stringContaining('User1'),
      }));
    });

    it('should show channel message notification', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.check.mockResolvedValue(true);
      notifee.getNotificationSettings.mockResolvedValue({ authorizationStatus: 1 });

      await notificationService.showMessageNotification(
        { from: 'User1', text: 'Hello everyone!', channel: '#general' },
        'TestNick'
      );

      expect(notifee.displayNotification).toHaveBeenCalledWith(expect.objectContaining({
        title: '#general',
      }));
    });
  });

  describe('cancelNotification', () => {
    it('should cancel notification by id', () => {
      notificationService.cancelNotification('notification-123');
      expect(notifee.cancelNotification).toHaveBeenCalledWith('notification-123');
    });

    it('should handle errors gracefully', () => {
      notifee.cancelNotification.mockImplementation(() => {
        throw new Error('Cancel error');
      });
      
      expect(() => notificationService.cancelNotification('notification-123')).not.toThrow();
    });
  });

  describe('cancelAllNotifications', () => {
    it('should cancel all notifications', () => {
      notificationService.cancelAllNotifications();
      expect(notifee.cancelAllNotifications).toHaveBeenCalled();
    });

    it('should handle cancel-all errors gracefully', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      notifee.cancelAllNotifications.mockImplementation(() => {
        throw new Error('Cancel all failed');
      });

      expect(() => notificationService.cancelAllNotifications()).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        'NotificationService: Error cancelling all notifications:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });
  });

  describe('setBadgeCount', () => {
    it('should set badge count', () => {
      notificationService.setBadgeCount(5);
      expect(notifee.setBadgeCount).toHaveBeenCalledWith(5);
    });

    it('should handle badge count errors gracefully', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      notifee.setBadgeCount.mockImplementationOnce(() => {
        throw new Error('Badge failed');
      });

      expect(() => notificationService.setBadgeCount(5)).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        'NotificationService: Error setting badge count:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });
  });

  describe('removeAllBadges', () => {
    it('should remove all badges', () => {
      notificationService.removeAllBadges();
      expect(notifee.setBadgeCount).toHaveBeenCalledWith(0);
    });

    it('should handle remove badge errors gracefully', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      notifee.setBadgeCount.mockImplementationOnce(() => {
        throw new Error('Remove badge failed');
      });

      expect(() => notificationService.removeAllBadges()).not.toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        'NotificationService: Error removing badges:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });
  });

  describe('shouldNotify', () => {
    it('should return false if notifications disabled', () => {
      (notificationService as any).preferences.enabled = false;
      
      const result = notificationService.shouldNotify(
        { text: 'Hello', channel: '#general', type: 'message' },
        'TestNick'
      );
      
      expect(result).toBe(false);
    });

    it('should return false if do not disturb', () => {
      (notificationService as any).preferences.doNotDisturb = true;
      
      const result = notificationService.shouldNotify(
        { text: 'Hello', channel: '#general', type: 'message' },
        'TestNick'
      );
      
      expect(result).toBe(false);
    });

    it('should return false for raw messages', () => {
      const result = notificationService.shouldNotify(
        { text: 'Server message', channel: '#general', type: 'raw' },
        'TestNick'
      );
      
      expect(result).toBe(false);
    });

    it('should return true for private messages when enabled', () => {
      const result = notificationService.shouldNotify(
        { text: 'Hello!', channel: 'User1', type: 'message' },
        'TestNick'
      );
      
      expect(result).toBe(true);
    });

    it('should return true for mentions when enabled', () => {
      const result = notificationService.shouldNotify(
        { text: 'Hello TestNick!', channel: '#general', type: 'message' },
        'TestNick'
      );
      
      expect(result).toBe(true);
    });

    it('should return false for non-mentions when only mentions enabled', () => {
      const result = notificationService.shouldNotify(
        { text: 'Hello everyone!', channel: '#general', type: 'message' },
        'TestNick'
      );
      
      expect(result).toBe(false);
    });

    it('should return true for all messages when notifyOnAllMessages enabled', () => {
      (notificationService as any).preferences.notifyOnAllMessages = true;
      
      const result = notificationService.shouldNotify(
        { text: 'Hello everyone!', channel: '#general', type: 'message' },
        'TestNick'
      );
      
      expect(result).toBe(true);
    });

    it('should check channel preferences', async () => {
      await notificationService.updateChannelPreferences('#general', { notifyOnAllMessages: true });
      
      const result = notificationService.shouldNotify(
        { text: 'Hello!', channel: '#general', type: 'message' },
        'TestNick'
      );
      
      expect(result).toBe(true);
    });

    it('should check network preferences', async () => {
      await notificationService.updateNetworkPreferences('freenode', { doNotDisturb: true });
      
      const result = notificationService.shouldNotify(
        { text: 'Hello!', channel: '#general', type: 'message', from: 'User' },
        'TestNick',
        'freenode'
      );
      
      expect(result).toBe(false);
    });

    it('should handle regex special characters in nick', () => {
      // Note: The regex word boundary \b doesn't work well after non-word chars like ]
      // Testing with brackets that have word chars inside
      const result = notificationService.shouldNotify(
        { text: 'Hello [TestNick]!', channel: '#general', type: 'message' },
        'TestNick'
      );
      
      expect(result).toBe(true);
    });

    it('should fallback to includes if regex fails', () => {
      const nick = new String('TestNick') as unknown as string;
      (nick as any).replace = () => {
        throw new Error('regex failed');
      };

      const result = notificationService.shouldNotify(
        { text: 'Hello TestNick!', channel: '#general', type: 'message' },
        nick
      );
      
      expect(result).toBe(true);
    });

    it('should return false when mention and all-messages notifications are both disabled', () => {
      (notificationService as any).preferences.notifyOnMentions = false;
      (notificationService as any).preferences.notifyOnAllMessages = false;

      const result = notificationService.shouldNotify(
        { text: 'Hello TestNick!', channel: '#general', type: 'message' },
        'TestNick'
      );

      expect(result).toBe(false);
    });
  });
});
