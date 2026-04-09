/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for AudioFocusService - 100% coverage target
 */

import { NativeModules, Platform } from 'react-native';

describe('AudioFocusService', () => {
  const mockRequestTransientFocus = jest.fn().mockResolvedValue(true);
  const mockReleaseFocus = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Setup NativeModules mock
    (NativeModules as any).AudioFocusModule = {
      requestTransientFocus: mockRequestTransientFocus,
      releaseFocus: mockReleaseFocus,
    };

    // Spy on console.warn
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('requestTransientFocus', () => {
    it('should request focus on Android when module available', async () => {
      Platform.OS = 'android';
      const {
        audioFocusService,
      } = require('../../src/services/AudioFocusService');

      const result = await audioFocusService.requestTransientFocus();

      expect(mockRequestTransientFocus).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return true on iOS without calling native module', async () => {
      Platform.OS = 'ios';
      const {
        audioFocusService,
      } = require('../../src/services/AudioFocusService');

      const result = await audioFocusService.requestTransientFocus();

      expect(mockRequestTransientFocus).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return true when AudioFocusModule not available', async () => {
      Platform.OS = 'android';
      (NativeModules as any).AudioFocusModule = null;

      const {
        audioFocusService,
      } = require('../../src/services/AudioFocusService');

      const result = await audioFocusService.requestTransientFocus();

      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      Platform.OS = 'android';
      (NativeModules as any).AudioFocusModule = {
        requestTransientFocus: jest
          .fn()
          .mockRejectedValue(new Error('Focus denied')),
        releaseFocus: mockReleaseFocus,
      };

      const {
        audioFocusService,
      } = require('../../src/services/AudioFocusService');

      const result = await audioFocusService.requestTransientFocus();

      expect(console.warn).toHaveBeenCalledWith(
        '[AudioFocusService] Failed to request focus:',
        expect.any(Error),
      );
      expect(result).toBe(true);
    });
  });

  describe('releaseFocus', () => {
    it('should release focus on Android when module available', () => {
      Platform.OS = 'android';
      const {
        audioFocusService,
      } = require('../../src/services/AudioFocusService');

      audioFocusService.releaseFocus();

      expect(mockReleaseFocus).toHaveBeenCalled();
    });

    it('should do nothing on iOS', () => {
      Platform.OS = 'ios';
      const {
        audioFocusService,
      } = require('../../src/services/AudioFocusService');

      audioFocusService.releaseFocus();

      expect(mockReleaseFocus).not.toHaveBeenCalled();
    });

    it('should do nothing when AudioFocusModule not available', () => {
      Platform.OS = 'android';
      (NativeModules as any).AudioFocusModule = null;

      const {
        audioFocusService,
      } = require('../../src/services/AudioFocusService');

      audioFocusService.releaseFocus();

      expect(mockReleaseFocus).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', () => {
      Platform.OS = 'android';
      (NativeModules as any).AudioFocusModule = {
        requestTransientFocus: mockRequestTransientFocus,
        releaseFocus: jest.fn().mockImplementation(() => {
          throw new Error('Release failed');
        }),
      };

      const {
        audioFocusService,
      } = require('../../src/services/AudioFocusService');

      audioFocusService.releaseFocus();

      expect(console.warn).toHaveBeenCalledWith(
        '[AudioFocusService] Failed to release focus:',
        expect.any(Error),
      );
    });
  });
});
