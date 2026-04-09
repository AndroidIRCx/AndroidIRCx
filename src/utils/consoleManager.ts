/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CONSOLE_ENABLED_KEY = '@console_enabled';

class ConsoleManager {
  private static instance: ConsoleManager;
  private isEnabled: boolean = __DEV__;
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  private constructor() {
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };
  }

  public static getInstance(): ConsoleManager {
    if (!ConsoleManager.instance) {
      ConsoleManager.instance = new ConsoleManager();
    }
    return ConsoleManager.instance;
  }

  public async initialize(): Promise<void> {
    if (!__DEV__) {
      return;
    }

    try {
      const storedValue = await AsyncStorage.getItem(CONSOLE_ENABLED_KEY);
      if (storedValue !== null) {
        this.isEnabled = storedValue === 'true';
      }
      this.applyConsoleState();
    } catch (error) {
      this.originalConsole.error('Failed to load console state:', error);
    }
  }

  public async setEnabled(enabled: boolean): Promise<void> {
    if (!__DEV__) {
      return;
    }

    this.isEnabled = enabled;
    try {
      await AsyncStorage.setItem(CONSOLE_ENABLED_KEY, enabled.toString());
      this.applyConsoleState();
    } catch (error) {
      this.originalConsole.error('Failed to save console state:', error);
    }
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  private applyConsoleState(): void {
    if (!__DEV__) {
      return;
    }

    if (this.isEnabled) {
      console.log = this.originalConsole.log;
      console.warn = this.originalConsole.warn;
      console.error = this.originalConsole.error;
      console.info = this.originalConsole.info;
      console.debug = this.originalConsole.debug;
    } else {
      const noop = () => {};
      console.log = noop;
      console.warn = noop;
      console.info = noop;
      console.debug = noop;
      // Keep console.error enabled even when disabled for critical issues
    }
  }
}

export default ConsoleManager.getInstance();
