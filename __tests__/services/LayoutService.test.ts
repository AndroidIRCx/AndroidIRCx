/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for LayoutService
 */

import { layoutService, LayoutConfig } from '../../src/services/LayoutService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('LayoutService', () => {
  beforeEach(() => {
    (AsyncStorage as any).__reset();
    // Reset service state to defaults
    (layoutService as any).initialized = false;
    (layoutService as any).initPromise = null;
    (layoutService as any).config = {
      tabPosition: 'top',
      userListPosition: 'right',
      viewMode: 'comfortable',
      fontSize: 'medium',
      messageSpacing: 4,
      messagePadding: 8,
      timestampDisplay: 'always',
      timestampFormat: '24h',
      showNickColors: true,
      compactMode: false,
      navigationBarOffset: 0,
    };
    (layoutService as any).listeners = [];
  });

  describe('initialize', () => {
    it('should initialize with defaults when no saved config', async () => {
      await layoutService.initialize();

      const config = layoutService.getConfig();
      expect(config.tabPosition).toBe('top');
      expect(config.viewMode).toBe('comfortable');
    });

    it('should load saved configuration', async () => {
      const savedConfig: Partial<LayoutConfig> = {
        tabPosition: 'bottom',
        viewMode: 'compact',
        fontSize: 'large',
      };

      await AsyncStorage.setItem('@AndroidIRCX:layoutConfig', JSON.stringify(savedConfig));
      await layoutService.initialize();

      const config = layoutService.getConfig();
      expect(config.tabPosition).toBe('bottom');
      expect(config.viewMode).toBe('compact');
      expect(config.fontSize).toBe('large');
    });

    it('should handle corrupted storage data', async () => {
      await AsyncStorage.setItem('@AndroidIRCX:layoutConfig', 'invalid json');
      await expect(layoutService.initialize()).resolves.not.toThrow();
    });

    it('should migrate old compactMode to viewMode', async () => {
      const oldConfig = {
        compactMode: true,
      };

      await AsyncStorage.setItem('@AndroidIRCX:layoutConfig', JSON.stringify(oldConfig));
      await layoutService.initialize();

      const config = layoutService.getConfig();
      expect(config.viewMode).toBe('compact');
    });

    it('should migrate old showTimestamps to timestampDisplay', async () => {
      const oldConfig = {
        showTimestamps: false,
      };

      await AsyncStorage.setItem('@AndroidIRCX:layoutConfig', JSON.stringify(oldConfig));
      await layoutService.initialize();

      const config = layoutService.getConfig();
      expect(config.timestampDisplay).toBe('never');
    });

    it('should set default userListPosition if missing', async () => {
      const oldConfig = {
        tabPosition: 'bottom',
      };

      await AsyncStorage.setItem('@AndroidIRCX:layoutConfig', JSON.stringify(oldConfig));
      await layoutService.initialize();

      const config = layoutService.getConfig();
      expect(config.userListPosition).toBe('right');
    });
  });

  describe('getConfig', () => {
    it('should return copy of config', () => {
      const config1 = layoutService.getConfig();
      const config2 = layoutService.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should return complete config object', () => {
      const config = layoutService.getConfig();

      expect(config).toHaveProperty('tabPosition');
      expect(config).toHaveProperty('userListPosition');
      expect(config).toHaveProperty('viewMode');
      expect(config).toHaveProperty('fontSize');
      expect(config).toHaveProperty('messageSpacing');
      expect(config).toHaveProperty('messagePadding');
      expect(config).toHaveProperty('timestampDisplay');
      expect(config).toHaveProperty('timestampFormat');
      expect(config).toHaveProperty('showNickColors');
    });
  });

  describe('setConfig', () => {
    it('should update configuration', async () => {
      await layoutService.setConfig({ tabPosition: 'bottom' });

      expect(layoutService.getTabPosition()).toBe('bottom');
    });

    it('should persist to storage', async () => {
      await layoutService.setConfig({ tabPosition: 'bottom' });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@AndroidIRCX:layoutConfig',
        expect.any(String)
      );
    });

    it('should notify listeners', async () => {
      const listener = jest.fn();
      layoutService.onConfigChange(listener);

      await layoutService.setConfig({ tabPosition: 'bottom' });

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].tabPosition).toBe('bottom');
    });

    it('should merge with existing config', async () => {
      await layoutService.setConfig({ tabPosition: 'bottom' });
      await layoutService.setConfig({ viewMode: 'compact' });

      const config = layoutService.getConfig();
      expect(config.tabPosition).toBe('bottom');
      expect(config.viewMode).toBe('compact');
    });
  });

  describe('tab position', () => {
    it('should get tab position', () => {
      expect(layoutService.getTabPosition()).toBe('top');
    });

    it('should set tab position', async () => {
      await layoutService.setTabPosition('bottom');
      expect(layoutService.getTabPosition()).toBe('bottom');
    });

    it('should support all tab positions', async () => {
      const positions: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right'];

      for (const position of positions) {
        await layoutService.setTabPosition(position);
        expect(layoutService.getTabPosition()).toBe(position);
      }
    });
  });

  describe('user list position', () => {
    it('should get user list position', () => {
      expect(layoutService.getUserListPosition()).toBe('right');
    });

    it('should set user list position', async () => {
      await layoutService.setUserListPosition('left');
      expect(layoutService.getUserListPosition()).toBe('left');
    });

    it('should support all user list positions', async () => {
      const positions: Array<'left' | 'right' | 'top' | 'bottom'> = ['left', 'right', 'top', 'bottom'];

      for (const position of positions) {
        await layoutService.setUserListPosition(position);
        expect(layoutService.getUserListPosition()).toBe(position);
      }
    });
  });

  describe('view mode', () => {
    it('should get view mode', () => {
      expect(layoutService.getViewMode()).toBe('comfortable');
    });

    it('should set view mode', async () => {
      await layoutService.setViewMode('compact');
      expect(layoutService.getViewMode()).toBe('compact');
    });

    it('should update spacing and padding for compact mode', async () => {
      await layoutService.setViewMode('compact');

      expect(layoutService.getMessageSpacing()).toBe(2);
      expect(layoutService.getMessagePadding()).toBe(4);
    });

    it('should update spacing and padding for comfortable mode', async () => {
      await layoutService.setViewMode('comfortable');

      expect(layoutService.getMessageSpacing()).toBe(4);
      expect(layoutService.getMessagePadding()).toBe(8);
    });

    it('should update spacing and padding for spacious mode', async () => {
      await layoutService.setViewMode('spacious');

      expect(layoutService.getMessageSpacing()).toBe(8);
      expect(layoutService.getMessagePadding()).toBe(12);
    });
  });

  describe('font size', () => {
    it('should get font size', () => {
      expect(layoutService.getFontSize()).toBe('medium');
    });

    it('should set font size', async () => {
      await layoutService.setFontSize('large');
      expect(layoutService.getFontSize()).toBe('large');
    });

    it('should get font size in pixels', () => {
      const sizeMap = {
        small: 12,
        medium: 14,
        large: 16,
        custom: 18,
      };

      for (const [size, pixels] of Object.entries(sizeMap)) {
        (layoutService as any).config.fontSize = size;
        expect(layoutService.getFontSizePixels()).toBe(pixels);
      }
    });

    it('should support all font sizes', async () => {
      const sizes: Array<'small' | 'medium' | 'large' | 'custom'> = ['small', 'medium', 'large', 'custom'];

      for (const size of sizes) {
        await layoutService.setFontSize(size);
        expect(layoutService.getFontSize()).toBe(size);
      }
    });
  });

  describe('message spacing', () => {
    it('should get message spacing', () => {
      expect(layoutService.getMessageSpacing()).toBe(4);
    });

    it('should set message spacing', async () => {
      await layoutService.setMessageSpacing(10);
      expect(layoutService.getMessageSpacing()).toBe(10);
    });

    it('should clamp spacing to 0-20 range', async () => {
      await layoutService.setMessageSpacing(-5);
      expect(layoutService.getMessageSpacing()).toBe(0);

      await layoutService.setMessageSpacing(25);
      expect(layoutService.getMessageSpacing()).toBe(20);
    });
  });

  describe('message padding', () => {
    it('should get message padding', () => {
      expect(layoutService.getMessagePadding()).toBe(8);
    });

    it('should set message padding', async () => {
      await layoutService.setMessagePadding(12);
      expect(layoutService.getMessagePadding()).toBe(12);
    });

    it('should clamp padding to 0-20 range', async () => {
      await layoutService.setMessagePadding(-5);
      expect(layoutService.getMessagePadding()).toBe(0);

      await layoutService.setMessagePadding(30);
      expect(layoutService.getMessagePadding()).toBe(20);
    });
  });

  describe('timestamp display', () => {
    it('should get timestamp display', () => {
      expect(layoutService.getTimestampDisplay()).toBe('always');
    });

    it('should set timestamp display', async () => {
      await layoutService.setTimestampDisplay('grouped');
      expect(layoutService.getTimestampDisplay()).toBe('grouped');
    });

    it('should support all timestamp display options', async () => {
      const options: Array<'always' | 'grouped' | 'never'> = ['always', 'grouped', 'never'];

      for (const option of options) {
        await layoutService.setTimestampDisplay(option);
        expect(layoutService.getTimestampDisplay()).toBe(option);
      }
    });
  });

  describe('timestamp format', () => {
    it('should get timestamp format', () => {
      expect(layoutService.getTimestampFormat()).toBe('24h');
    });

    it('should set timestamp format', async () => {
      await layoutService.setTimestampFormat('12h');
      expect(layoutService.getTimestampFormat()).toBe('12h');
    });

    it('should support both 12h and 24h formats', async () => {
      await layoutService.setTimestampFormat('12h');
      expect(layoutService.getTimestampFormat()).toBe('12h');

      await layoutService.setTimestampFormat('24h');
      expect(layoutService.getTimestampFormat()).toBe('24h');
    });
  });

  describe('nick colors', () => {
    it('should get show nick colors', () => {
      expect(layoutService.getShowNickColors()).toBe(true);
    });

    it('should set show nick colors', async () => {
      await layoutService.setShowNickColors(false);
      expect(layoutService.getShowNickColors()).toBe(false);
    });

    it('should toggle nick colors', async () => {
      await layoutService.setShowNickColors(false);
      expect(layoutService.getShowNickColors()).toBe(false);

      await layoutService.setShowNickColors(true);
      expect(layoutService.getShowNickColors()).toBe(true);
    });
  });

  describe('navigation bar offset', () => {
    it('should get navigation bar offset', () => {
      expect(layoutService.getNavigationBarOffset()).toBe(0);
    });

    it('should set navigation bar offset', async () => {
      await layoutService.setNavigationBarOffset(50);
      expect(layoutService.getNavigationBarOffset()).toBe(50);
    });

    it('should clamp offset to 0-100 range', async () => {
      await layoutService.setNavigationBarOffset(-10);
      expect(layoutService.getNavigationBarOffset()).toBe(0);

      await layoutService.setNavigationBarOffset(150);
      expect(layoutService.getNavigationBarOffset()).toBe(100);
    });
  });

  describe('onConfigChange', () => {
    it('should call listener on config change', async () => {
      const listener = jest.fn();
      layoutService.onConfigChange(listener);

      await layoutService.setConfig({ tabPosition: 'bottom' });

      expect(listener).toHaveBeenCalled();
    });

    it('should call multiple listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      layoutService.onConfigChange(listener1);
      layoutService.onConfigChange(listener2);

      await layoutService.setConfig({ tabPosition: 'bottom' });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should unsubscribe listener', async () => {
      const listener = jest.fn();
      const unsubscribe = layoutService.onConfigChange(listener);

      await layoutService.setConfig({ tabPosition: 'bottom' });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      await layoutService.setConfig({ tabPosition: 'top' });
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should handle listener errors gracefully', async () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();

      layoutService.onConfigChange(errorListener);
      layoutService.onConfigChange(goodListener);

      await expect(layoutService.setConfig({ tabPosition: 'bottom' })).resolves.not.toThrow();

      expect(errorListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple rapid config changes', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(layoutService.setConfig({ messageSpacing: i }));
      }

      await Promise.all(promises);

      // Final value should be set
      expect(layoutService.getMessageSpacing()).toBeGreaterThanOrEqual(0);
      expect(layoutService.getMessageSpacing()).toBeLessThan(10);
    });

    it('should handle storage errors gracefully', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      await expect(layoutService.setConfig({ tabPosition: 'bottom' })).resolves.not.toThrow();
    });

    it('should preserve unrelated config when updating', async () => {
      await layoutService.setConfig({
        tabPosition: 'bottom',
        viewMode: 'compact',
        fontSize: 'large',
      });

      await layoutService.setConfig({ tabPosition: 'top' });

      const config = layoutService.getConfig();
      expect(config.tabPosition).toBe('top');
      expect(config.viewMode).toBe('compact'); // Preserved
      expect(config.fontSize).toBe('large'); // Preserved
    });
  });
});
