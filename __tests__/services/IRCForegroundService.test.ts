/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for IRCForegroundService - 100% coverage target
 */

// Define mocks before importing
const mockStartService = jest.fn().mockResolvedValue(true);
const mockStopService = jest.fn().mockResolvedValue(true);
const mockUpdateNotification = jest.fn().mockResolvedValue(true);

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: jest.fn((obj: any) => obj.ios || obj.default || ''),
  },
  NativeModules: {
    IRCForegroundService: {
      startService: (...args: any[]) => mockStartService(...args),
      stopService: (...args: any[]) => mockStopService(...args),
      updateNotification: (...args: any[]) => mockUpdateNotification(...args),
    },
  },
}));

// Mock i18n
jest.mock('../../src/i18n/transifex', () => ({
  tx: {
    t: jest.fn((key: string, params?: Record<string, unknown>) => {
      if (key === 'IRC Connected') return 'IRC Connected';
      if (key === 'Maintaining connection to {networkName}') {
        return `Maintaining connection to ${params?.networkName || 'Unknown'}`;
      }
      return key;
    }),
  },
}));

// Import after mocks
const { Platform } = require('react-native');
const {
  ircForegroundService,
} = require('../../src/services/IRCForegroundService');

describe('IRCForegroundService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    ircForegroundService.isRunning = false;
    // Reset platform to Android
    Platform.OS = 'android';
  });

  describe('start', () => {
    it('should start service on Android', async () => {
      await ircForegroundService.start(
        'Libera.Chat',
        'Test Title',
        'Test Text',
      );

      expect(mockStartService).toHaveBeenCalledWith(
        'Libera.Chat',
        'Test Title',
        'Test Text',
      );
      expect(ircForegroundService.isServiceRunning()).toBe(true);
    });

    it('should use default title and text when not provided', async () => {
      await ircForegroundService.start('Freenode');

      expect(mockStartService).toHaveBeenCalledWith(
        'Freenode',
        'IRC Connected',
        'Maintaining connection to Freenode',
      );
    });

    it('should not start on iOS', async () => {
      Platform.OS = 'ios';

      await ircForegroundService.start('Libera.Chat');

      expect(mockStartService).not.toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      await ircForegroundService.start('Libera.Chat');
      expect(ircForegroundService.isServiceRunning()).toBe(true);

      jest.clearAllMocks();
      await ircForegroundService.start('Libera.Chat');

      expect(mockStartService).not.toHaveBeenCalled();
    });

    it('should throw error if native module fails', async () => {
      mockStartService.mockRejectedValueOnce(new Error('Native module error'));

      await expect(ircForegroundService.start('Libera.Chat')).rejects.toThrow(
        'Native module error',
      );
      expect(ircForegroundService.isServiceRunning()).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop service on Android', async () => {
      await ircForegroundService.start('Libera.Chat');
      expect(ircForegroundService.isServiceRunning()).toBe(true);

      await ircForegroundService.stop();

      expect(mockStopService).toHaveBeenCalled();
      expect(ircForegroundService.isServiceRunning()).toBe(false);
    });

    it('should not stop on iOS', async () => {
      await ircForegroundService.start('Libera.Chat');
      Platform.OS = 'ios';

      await ircForegroundService.stop();

      // Service should still be considered running (can't stop on iOS)
      expect(mockStopService).not.toHaveBeenCalled();
    });

    it('should not stop if not running', async () => {
      await ircForegroundService.stop();

      expect(mockStopService).not.toHaveBeenCalled();
    });

    it('should throw error if native module fails', async () => {
      await ircForegroundService.start('Libera.Chat');
      mockStopService.mockRejectedValueOnce(new Error('Stop error'));

      await expect(ircForegroundService.stop()).rejects.toThrow('Stop error');
      // Service is still considered running because stop failed
      expect(ircForegroundService.isServiceRunning()).toBe(true);
    });
  });

  describe('updateNotification', () => {
    it('should update notification on Android', async () => {
      await ircForegroundService.start('Libera.Chat');
      await ircForegroundService.updateNotification('New Title', 'New Text');

      expect(mockUpdateNotification).toHaveBeenCalledWith(
        'New Title',
        'New Text',
      );
    });

    it('should not update on iOS', async () => {
      await ircForegroundService.start('Libera.Chat');
      Platform.OS = 'ios';

      await ircForegroundService.updateNotification('New Title', 'New Text');

      expect(mockUpdateNotification).not.toHaveBeenCalled();
    });

    it('should not update if service not running', async () => {
      await ircForegroundService.updateNotification('New Title', 'New Text');

      expect(mockUpdateNotification).not.toHaveBeenCalled();
    });

    it('should handle native module errors gracefully', async () => {
      await ircForegroundService.start('Libera.Chat');
      mockUpdateNotification.mockRejectedValueOnce(new Error('Update error'));

      // Should not throw
      await expect(
        ircForegroundService.updateNotification('Title', 'Text'),
      ).resolves.not.toThrow();
    });
  });

  describe('isServiceRunning', () => {
    it('should return false when not started', () => {
      expect(ircForegroundService.isServiceRunning()).toBe(false);
    });

    it('should return true when running', async () => {
      await ircForegroundService.start('Libera.Chat');
      expect(ircForegroundService.isServiceRunning()).toBe(true);
    });

    it('should return false after stopping', async () => {
      await ircForegroundService.start('Libera.Chat');
      await ircForegroundService.stop();
      expect(ircForegroundService.isServiceRunning()).toBe(false);
    });
  });
});
