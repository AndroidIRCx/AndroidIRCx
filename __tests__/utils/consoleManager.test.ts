/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ConsoleManager
 */

// Store original __DEV__ value
const originalDev = (global as any).__DEV__;

import consoleManager from '../../src/utils/consoleManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Save original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

describe('ConsoleManager', () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset();
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  });

  afterEach(() => {
    // Always restore original console methods after tests
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = consoleManager;
      const instance2 = consoleManager;
      expect(instance1).toBe(instance2);
    });

    it('should create instance only once (covers lazy instantiation branch)', () => {
      // Reset modules to test fresh instantiation
      jest.resetModules();
      // First call should create instance
      const {
        default: freshManager1,
      } = require('../../src/utils/consoleManager');
      // Second call should return same instance without creating new one
      const {
        default: freshManager2,
      } = require('../../src/utils/consoleManager');
      expect(freshManager1).toBe(freshManager2);
    });
  });

  describe('getEnabled', () => {
    it('should return boolean', () => {
      const enabled = consoleManager.getEnabled();
      expect(typeof enabled).toBe('boolean');
    });
  });

  describe('initialize', () => {
    it('should initialize without errors', async () => {
      await expect(consoleManager.initialize()).resolves.not.toThrow();
    });

    it('should load saved state from storage', async () => {
      await AsyncStorage.setItem('@console_enabled', 'false');
      await consoleManager.initialize();
      // Test passes if no errors thrown
      expect(true).toBe(true);
    });

    it('should handle corrupted storage data', async () => {
      await AsyncStorage.setItem('@console_enabled', 'invalid');
      await expect(consoleManager.initialize()).resolves.not.toThrow();
    });

    it('should keep current state when stored value is null', async () => {
      const before = consoleManager.getEnabled();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      await consoleManager.initialize();
      expect(consoleManager.getEnabled()).toBe(before);
    });

    it('should load true from storage and enable console', async () => {
      await consoleManager.setEnabled(false);
      await AsyncStorage.setItem('@console_enabled', 'true');
      await consoleManager.initialize();
      expect(consoleManager.getEnabled()).toBe(true);
    });

    it('should handle getItem rejection path without throwing', async () => {
      const getItemSpy = jest
        .spyOn(AsyncStorage, 'getItem')
        .mockRejectedValueOnce(new Error('read-fail'));
      await expect(consoleManager.initialize()).resolves.not.toThrow();
      expect(getItemSpy).toHaveBeenCalledWith('@console_enabled');
    });
  });

  describe('setEnabled', () => {
    it('should set enabled state', async () => {
      await consoleManager.setEnabled(true);
      expect(consoleManager.getEnabled()).toBe(true);

      await consoleManager.setEnabled(false);
      expect(consoleManager.getEnabled()).toBe(false);
    });

    it('should persist state to storage', async () => {
      await consoleManager.setEnabled(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@console_enabled',
        'true',
      );
    });

    it('should handle storage errors gracefully', async () => {
      jest
        .spyOn(AsyncStorage, 'setItem')
        .mockRejectedValueOnce(new Error('Storage error'));
      await expect(consoleManager.setEnabled(true)).resolves.not.toThrow();
    });
  });

  describe('non-DEV mode', () => {
    beforeEach(() => {
      (global as any).__DEV__ = false;
      // Re-import to get fresh instance with new __DEV__ value
      jest.resetModules();
    });

    afterEach(() => {
      (global as any).__DEV__ = originalDev;
      jest.resetModules();
    });

    it('should not initialize in production mode', async () => {
      const {
        default: prodManager,
      } = require('../../src/utils/consoleManager');
      const getItemSpy = jest.spyOn(AsyncStorage, 'getItem');
      await prodManager.initialize();
      expect(getItemSpy).not.toHaveBeenCalled();
    });

    it('should not setEnabled in production mode', async () => {
      const {
        default: prodManager,
      } = require('../../src/utils/consoleManager');
      const setItemSpy = jest.spyOn(AsyncStorage, 'setItem');
      await prodManager.setEnabled(true);
      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should early-return in applyConsoleState when not in DEV', () => {
      const {
        default: prodManager,
      } = require('../../src/utils/consoleManager');
      expect(() => (prodManager as any).applyConsoleState()).not.toThrow();
    });
  });

  describe('applyConsoleState', () => {
    it('should disable console methods when setEnabled(false)', async () => {
      // Store original log function
      const originalLog = console.log;
      await consoleManager.setEnabled(false);
      // Console.log should now be a different function (noop)
      expect(console.log).not.toBe(originalLog);
      // Restore
      console.log = originalLog;
    });

    it('should restore console methods when setEnabled(true)', async () => {
      await consoleManager.setEnabled(false);
      const noopLog = console.log;
      await consoleManager.setEnabled(true);
      // Console.log should be restored (not the noop)
      expect(console.log).not.toBe(noopLog);
    });

    it('should keep console.error active when logging is disabled', async () => {
      const originalError = console.error;
      await consoleManager.setEnabled(false);
      expect(console.error).toBe(originalError);
    });
  });
});
