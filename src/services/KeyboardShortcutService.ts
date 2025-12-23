// KeyboardShortcutService.ts
// This service provides a simple way to register keyboard shortcuts for the app.
// It uses the 'react-native-keyevent' library on Android to capture hardware keyboard events.
// For iOS, hardware keyboard events are not supported out of the box, so shortcuts will be limited to Android.

import { NativeEventEmitter, NativeModules } from 'react-native';

// Ensure the native module exists (react-native-keyevent)
const { KeyEventModule } = NativeModules;
const keyEventEmitter = KeyEventModule ? new NativeEventEmitter(KeyEventModule) : null;

type ShortcutCallback = () => void;

type ShortcutMap = {
  [key: string]: ShortcutCallback[];
};

export class KeyboardShortcutService {
  private shortcuts: ShortcutMap = {};

  constructor() {
    if (keyEventEmitter) {
      // Listen for key down events
      keyEventEmitter.addListener('onKeyDown', this.handleKeyDown);
    }
  }

  /**
   * Register a shortcut.
   * @param keyCombination A string representation of the key combo, e.g. 'Ctrl+Tab'.
   * @param callback Function to invoke when the shortcut is pressed.
   */
  registerShortcut(keyCombination: string, callback: ShortcutCallback) {
    const normalized = this.normalizeKeyCombination(keyCombination);
    if (!this.shortcuts[normalized]) {
      this.shortcuts[normalized] = [];
    }
    this.shortcuts[normalized].push(callback);
  }

  /**
   * Unregister a previously registered shortcut.
   */
  unregisterShortcut(keyCombination: string, callback?: ShortcutCallback) {
    const normalized = this.normalizeKeyCombination(keyCombination);
    if (!this.shortcuts[normalized]) return;
    if (callback) {
      this.shortcuts[normalized] = this.shortcuts[normalized].filter(cb => cb !== callback);
    } else {
      delete this.shortcuts[normalized];
    }
  }

  /**
   * Normalize a key combination string to a consistent format.
   */
  private normalizeKeyCombination(keyCombination: string): string {
    return keyCombination
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace('control', 'ctrl')
      .replace('command', 'cmd');
  }

  /**
   * Handle raw key down events from the native module.
   */
  private handleKeyDown = (event: any) => {
    // The event object from react-native-keyevent contains:
    //   keyCode: number, pressedKey: string, action: number, repeatCount: number
    // We will build a simple combination string.
    const { pressedKey, keyCode } = event;
    // Detect modifier keys via keyCode values (Ctrl=113, Alt=57, Shift=59 on Android)
    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    const combo = [...modifiers, pressedKey?.toLowerCase()].filter(Boolean).join('+');
    const callbacks = this.shortcuts[combo];
    if (callbacks && callbacks.length > 0) {
      callbacks.forEach(cb => cb());
    }
  };

  /**
   * Clean up listeners when the service is no longer needed.
   */
  destroy() {
    if (keyEventEmitter) {
      keyEventEmitter.removeAllListeners('onKeyDown');
    }
    this.shortcuts = {};
  }
}

// Export a singleton for easy use throughout the app.
export const keyboardShortcutService = new KeyboardShortcutService();
