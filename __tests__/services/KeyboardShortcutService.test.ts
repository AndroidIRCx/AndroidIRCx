/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for KeyboardShortcutService - 100% coverage target
 */

// Mock react-native
const mockAddListener = jest.fn();
const mockRemoveAllListeners = jest.fn();

jest.mock('react-native', () => ({
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: mockAddListener,
    removeAllListeners: mockRemoveAllListeners,
  })),
  NativeModules: {
    KeyEventModule: {},
  },
}));

// Import after mocks
const {
  KeyboardShortcutService,
} = require('../../src/services/KeyboardShortcutService');

describe('KeyboardShortcutService', () => {
  let service: any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (service) {
      service.destroy();
    }
  });

  describe('constructor', () => {
    it('should register key event listener when KeyEventModule exists', () => {
      const RN = require('react-native');
      RN.NativeModules.KeyEventModule = {};

      service = new KeyboardShortcutService();

      expect(mockAddListener).toHaveBeenCalledWith(
        'onKeyDown',
        expect.any(Function),
      );
    });

    it('should handle missing KeyEventModule gracefully', () => {
      const RN = require('react-native');
      RN.NativeModules.KeyEventModule = null;

      // Should not throw
      expect(() => new KeyboardShortcutService()).not.toThrow();
    });
  });

  describe('registerShortcut', () => {
    beforeEach(() => {
      const RN = require('react-native');
      RN.NativeModules.KeyEventModule = {};
      service = new KeyboardShortcutService();
    });

    it('should register a simple shortcut', () => {
      const callback = jest.fn();
      service.registerShortcut('ctrl+t', callback);

      // Trigger the shortcut
      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({ pressedKey: 't', ctrlKey: true });

      expect(callback).toHaveBeenCalled();
    });

    it('should register multiple callbacks for same shortcut', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      service.registerShortcut('ctrl+tab', callback1);
      service.registerShortcut('ctrl+tab', callback2);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({ pressedKey: 'tab', ctrlKey: true });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should normalize key combination (lowercase)', () => {
      const callback = jest.fn();
      service.registerShortcut('CTRL+T', callback);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({ pressedKey: 't', ctrlKey: true });

      expect(callback).toHaveBeenCalled();
    });

    it('should normalize key combination (remove spaces)', () => {
      const callback = jest.fn();
      service.registerShortcut('ctrl + t', callback);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({ pressedKey: 't', ctrlKey: true });

      expect(callback).toHaveBeenCalled();
    });

    it('should normalize "control" to "ctrl"', () => {
      const callback = jest.fn();
      service.registerShortcut('control+t', callback);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({ pressedKey: 't', ctrlKey: true });

      expect(callback).toHaveBeenCalled();
    });

    it('should normalize "command" to "cmd"', () => {
      const callback = jest.fn();
      service.registerShortcut('command+t', callback);

      // command normalizes to cmd, but the native event would have metaKey (not mocked here)
      // We just verify it registers without error
      expect(() =>
        service.registerShortcut('command+t', callback),
      ).not.toThrow();
    });
  });

  describe('unregisterShortcut', () => {
    beforeEach(() => {
      const RN = require('react-native');
      RN.NativeModules.KeyEventModule = {};
      service = new KeyboardShortcutService();
    });

    it('should unregister specific callback', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      service.registerShortcut('ctrl+t', callback1);
      service.registerShortcut('ctrl+t', callback2);
      service.unregisterShortcut('ctrl+t', callback1);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({ pressedKey: 't', ctrlKey: true });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should unregister all callbacks for shortcut when no callback specified', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      service.registerShortcut('ctrl+t', callback1);
      service.registerShortcut('ctrl+t', callback2);
      service.unregisterShortcut('ctrl+t');

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({ pressedKey: 't', ctrlKey: true });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should handle unregistering non-existent shortcut gracefully', () => {
      expect(() => service.unregisterShortcut('nonexistent')).not.toThrow();
    });

    it('should handle unregistering from empty shortcut list', () => {
      const callback = jest.fn();
      service.registerShortcut('ctrl+t', callback);
      service.unregisterShortcut('ctrl+t', callback);
      service.unregisterShortcut('ctrl+t', callback); // Try again

      // Should not throw
      expect(() =>
        service.unregisterShortcut('ctrl+t', callback),
      ).not.toThrow();
    });
  });

  describe('handleKeyDown', () => {
    beforeEach(() => {
      const RN = require('react-native');
      RN.NativeModules.KeyEventModule = {};
      service = new KeyboardShortcutService();
    });

    it('should handle Ctrl+key combination', () => {
      const callback = jest.fn();
      service.registerShortcut('ctrl+a', callback);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({
        pressedKey: 'a',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should handle Alt+key combination', () => {
      const callback = jest.fn();
      service.registerShortcut('alt+f4', callback);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({
        pressedKey: 'f4',
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should handle Shift+key combination', () => {
      const callback = jest.fn();
      service.registerShortcut('shift+tab', callback);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({
        pressedKey: 'tab',
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should handle multi-modifier combination (Ctrl+Alt+key)', () => {
      const callback = jest.fn();
      service.registerShortcut('ctrl+alt+t', callback);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({
        pressedKey: 't',
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should handle key without modifiers', () => {
      const callback = jest.fn();
      service.registerShortcut('f1', callback);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({
        pressedKey: 'f1',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should handle lowercase pressedKey', () => {
      const callback = jest.fn();
      service.registerShortcut('ctrl+a', callback);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({ pressedKey: 'A', ctrlKey: true });

      expect(callback).toHaveBeenCalled();
    });

    it('should not call callbacks for unregistered shortcut', () => {
      const callback = jest.fn();
      service.registerShortcut('ctrl+a', callback);

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({ pressedKey: 'b', ctrlKey: true }); // Different key

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle missing pressedKey gracefully', () => {
      const callback = jest.fn();
      service.registerShortcut('ctrl', callback); // Only modifier

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      // Should not throw
      expect(() =>
        handleKeyDown({ pressedKey: null, ctrlKey: true }),
      ).not.toThrow();
    });

    it('should handle multiple callbacks', () => {
      const callbacks = [jest.fn(), jest.fn(), jest.fn()];
      callbacks.forEach((cb: any) => service.registerShortcut('ctrl+s', cb));

      const handleKeyDown = mockAddListener.mock.calls[0][1];
      handleKeyDown({ pressedKey: 's', ctrlKey: true });

      callbacks.forEach((cb: any) => expect(cb).toHaveBeenCalled());
    });
  });

  describe('destroy', () => {
    it('should remove all listeners and clear shortcuts', () => {
      const RN = require('react-native');
      RN.NativeModules.KeyEventModule = {};
      service = new KeyboardShortcutService();

      const callback = jest.fn();
      service.registerShortcut('ctrl+q', callback);

      service.destroy();

      expect(mockRemoveAllListeners).toHaveBeenCalledWith('onKeyDown');
    });

    it('should handle destroy when KeyEventModule is null', () => {
      const RN = require('react-native');
      RN.NativeModules.KeyEventModule = null;
      service = new KeyboardShortcutService();

      // Should not throw
      expect(() => service.destroy()).not.toThrow();
    });
  });
});
