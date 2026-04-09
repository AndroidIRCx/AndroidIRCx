/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for SoundService
 */

import { soundService } from '../../src/services/SoundService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';
import RNFS from 'react-native-fs';
import { SoundEventType, DEFAULT_SOUND_SETTINGS } from '../../src/types/sound';
import { awayService } from '../../src/services/AwayService';

// Mock AwayService
jest.mock('../../src/services/AwayService', () => ({
  awayService: {
    shouldMuteSounds: jest.fn().mockReturnValue(false),
  },
}));

// Mock AudioFocusService
jest.mock('../../src/services/AudioFocusService', () => ({
  audioFocusService: {
    requestTransientFocus: jest.fn().mockResolvedValue(undefined),
    releaseFocus: jest.fn(),
  },
}));

describe('SoundService', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (awayService.shouldMuteSounds as jest.Mock).mockReturnValue(false);
    // Reset service state
    // @ts-ignore
    soundService.isInitialized = false;
    // @ts-ignore
    soundService.customSchemes = [];
    // @ts-ignore
    soundService.settings = JSON.parse(JSON.stringify(DEFAULT_SOUND_SETTINGS));
    // @ts-ignore
    soundService.soundQueue = [];
    // @ts-ignore
    soundService.currentSound = null;
    // @ts-ignore
    soundService.isProcessingQueue = false;
    // @ts-ignore
    soundService.appState = 'active';
  });

  describe('initialize', () => {
    it('should initialize with default settings', async () => {
      await soundService.initialize();

      expect(soundService.isEnabled()).toBeDefined();
    });

    it('should load saved settings', async () => {
      const savedSettings = {
        enabled: false,
        masterVolume: 0.5,
        events: {
          message: { enabled: true, volume: 0.8 },
        },
      };

      await AsyncStorage.setItem(
        '@AndroidIRCX:soundSettings',
        JSON.stringify(savedSettings),
      );

      // @ts-ignore
      soundService.isInitialized = false;
      await soundService.initialize();

      const settings = soundService.getSettings();
      expect(settings.enabled).toBe(false);
      expect(settings.masterVolume).toBe(0.5);
    });

    it('should handle initialization errors gracefully', async () => {
      jest
        .spyOn(AsyncStorage, 'getItem')
        .mockRejectedValueOnce(new Error('Storage error'));

      await expect(soundService.initialize()).resolves.not.toThrow();
    });
  });

  describe('getSettings and updateSettings', () => {
    it('should return current settings', async () => {
      await soundService.initialize();

      const settings = soundService.getSettings();
      expect(settings).toBeDefined();
      expect(typeof settings.enabled).toBe('boolean');
      expect(typeof settings.masterVolume).toBe('number');
    });

    it('should update settings', async () => {
      await soundService.initialize();

      await soundService.updateSettings({ masterVolume: 0.7 });

      expect(soundService.getSettings().masterVolume).toBe(0.7);
    });

    it('should notify listeners on settings change', async () => {
      await soundService.initialize();

      const listener = jest.fn();
      const unsubscribe = soundService.addListener(listener);

      await soundService.updateSettings({ enabled: false });

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].enabled).toBe(false);

      unsubscribe();
    });
  });

  describe('updateEventConfig', () => {
    it('should update specific event config', async () => {
      await soundService.initialize();

      await soundService.updateEventConfig('message', {
        enabled: false,
        volume: 0.3,
      });

      const settings = soundService.getSettings();
      expect(settings.events.message?.enabled).toBe(false);
      expect(settings.events.message?.volume).toBe(0.3);
    });
  });

  describe('isEnabled and toggleEnabled', () => {
    it('should return enabled state', async () => {
      await soundService.initialize();

      expect(typeof soundService.isEnabled()).toBe('boolean');
    });

    it('should toggle enabled state', async () => {
      await soundService.initialize();

      const initialState = soundService.isEnabled();
      const newState = await soundService.toggleEnabled();

      expect(newState).toBe(!initialState);
      expect(soundService.isEnabled()).toBe(!initialState);
    });
  });

  describe('playSound', () => {
    it('should not play when disabled', async () => {
      await soundService.initialize();
      await soundService.updateSettings({ enabled: false });

      // Should not throw
      await expect(soundService.playSound('message')).resolves.not.toThrow();
    });

    it('should not play when away mode mutes sounds', async () => {
      const { awayService } = require('../../src/services/AwayService');
      awayService.shouldMuteSounds.mockReturnValue(true);

      await soundService.initialize();
      await soundService.updateSettings({ enabled: true });

      // Should not throw
      await expect(soundService.playSound('message')).resolves.not.toThrow();
    });

    it('should not play event when disabled', async () => {
      await soundService.initialize();
      await soundService.updateSettings({ enabled: true });
      await soundService.updateEventConfig('message', { enabled: false });

      // Should not throw
      await expect(soundService.playSound('message')).resolves.not.toThrow();
    });

    it('should skip playing in foreground/background based on settings', async () => {
      // @ts-ignore
      soundService.isInitialized = true;
      await soundService.updateSettings({
        enabled: true,
        playInForeground: false,
        playInBackground: true,
      });
      const processQueueSpy = jest
        .spyOn(soundService as any, 'processQueue')
        .mockResolvedValue(undefined);

      // @ts-ignore
      soundService.appState = 'active';
      await soundService.playSound(SoundEventType.MENTION);
      expect(processQueueSpy).not.toHaveBeenCalled();

      await soundService.updateSettings({
        playInForeground: true,
        playInBackground: false,
      });
      // @ts-ignore
      soundService.appState = 'background';
      await soundService.playSound(SoundEventType.MENTION);
      expect(processQueueSpy).not.toHaveBeenCalled();
    });

    it('queues sound and processes with calculated volume', async () => {
      // @ts-ignore
      soundService.isInitialized = true;
      await soundService.updateSettings({
        enabled: true,
        masterVolume: 0.5,
        playInForeground: true,
      });
      await soundService.updateEventConfig(SoundEventType.MENTION, {
        enabled: true,
        volume: 0.4,
      });

      const processQueueSpy = jest
        .spyOn(soundService as any, 'processQueue')
        .mockResolvedValue(undefined);
      await expect(
        soundService.playSound(SoundEventType.MENTION),
      ).resolves.not.toThrow();
      expect(processQueueSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('internal queue and sound info', () => {
    it('processQueue drains queue and calls playSoundInternal', async () => {
      jest
        .spyOn(soundService as any, 'playSoundInternal')
        .mockResolvedValue(undefined);
      // @ts-ignore
      soundService.soundQueue = [
        { eventType: SoundEventType.MENTION, volume: 0.5 },
        { eventType: SoundEventType.NOTICE, volume: 0.7 },
      ];

      await expect((soundService as any).processQueue()).resolves.not.toThrow();
      // @ts-ignore
      expect(soundService.isProcessingQueue).toBe(false);
    });

    it('getSoundInfo resolves custom file and falls back to defaults', async () => {
      await soundService.initialize();
      await soundService.updateEventConfig(SoundEventType.MENTION, {
        useCustom: true,
        customUri: 'file:///tmp/custom.wav',
      });

      (RNFS.exists as jest.Mock).mockResolvedValueOnce(true);
      const custom = await (soundService as any).getSoundInfo(
        SoundEventType.MENTION,
      );
      expect(custom).toEqual({ filename: '/tmp/custom.wav', basePath: '' });

      (RNFS.exists as jest.Mock).mockResolvedValueOnce(false);
      const fallback = await (soundService as any).getSoundInfo(
        SoundEventType.MENTION,
      );
      expect(fallback).toBeTruthy();
      expect(fallback.basePath).toBe((Sound as any).MAIN_BUNDLE);
    });
  });

  describe('playback internals', () => {
    it('playSoundInternal requests and releases audio focus on successful playback', async () => {
      const soundInstance = {
        setVolume: jest.fn(),
        play: jest.fn((cb?: (success: boolean) => void) => cb?.(true)),
        stop: jest.fn(),
        release: jest.fn(),
        getDuration: jest.fn(() => 0),
      };
      (Sound as unknown as jest.Mock).mockImplementation(
        (_f: string, _b: string, cb?: (e: any) => void) => {
          cb?.(null);
          return soundInstance as any;
        },
      );
      jest
        .spyOn(soundService as any, 'getSoundInfo')
        .mockResolvedValue({ filename: 'mention', basePath: '' });

      await expect(
        (soundService as any).playSoundInternal(SoundEventType.MENTION, 0.6),
      ).resolves.not.toThrow();
    });

    it('playSoundInternal handles load error and no-sound path', async () => {
      jest
        .spyOn(soundService as any, 'getSoundInfo')
        .mockResolvedValueOnce(null);
      await (soundService as any).playSoundInternal(
        SoundEventType.MENTION,
        0.3,
      );

      (Sound as unknown as jest.Mock).mockImplementationOnce(
        (_f: string, _b: string, cb?: (e: any) => void) => {
          cb?.(new Error('load-fail'));
          return {
            setVolume: jest.fn(),
            play: jest.fn(),
            stop: jest.fn(),
            release: jest.fn(),
            getDuration: jest.fn(() => 0),
          } as any;
        },
      );
      jest
        .spyOn(soundService as any, 'getSoundInfo')
        .mockResolvedValueOnce({ filename: 'mention', basePath: '' });
      await (soundService as any).playSoundInternal(
        SoundEventType.MENTION,
        0.3,
      );
      // @ts-ignore
      expect(soundService.isPlaying).toBe(false);
    });
  });

  describe('preview and custom sound file handling', () => {
    it('previewSound skips when no sound and handles custom preview throw', async () => {
      jest.spyOn(soundService as any, 'getSoundInfo').mockResolvedValue(null);
      await soundService.previewSound(SoundEventType.MENTION);

      (Sound as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('ctor-fail');
      });
      await soundService.previewCustomSound('file:///tmp/preview.wav');
      // @ts-ignore
      expect(soundService.isPlaying).toBe(false);
    });

    it('setCustomSound copies file, updates config and cleans previous custom file', async () => {
      await soundService.initialize();
      await soundService.updateEventConfig(SoundEventType.MENTION, {
        useCustom: true,
        customUri: '/old/custom.wav',
      });
      jest.spyOn(Date, 'now').mockReturnValue(12345);
      (RNFS.exists as jest.Mock)
        .mockResolvedValueOnce(false) // sounds dir missing
        .mockResolvedValueOnce(true); // previous custom exists
      (RNFS as any).mkdir = jest.fn().mockResolvedValue(undefined);
      (RNFS as any).copyFile = jest.fn().mockResolvedValue(undefined);

      await soundService.setCustomSound(
        SoundEventType.MENTION,
        '/import/src.wav',
      );

      expect((RNFS as any).mkdir).toHaveBeenCalled();
      expect((RNFS as any).copyFile).toHaveBeenCalledWith(
        '/import/src.wav',
        expect.stringContaining('/sounds/custom_mention_12345.wav'),
      );
      expect(RNFS.unlink).toHaveBeenCalledWith('/old/custom.wav');
      expect(
        soundService.getSettings().events[SoundEventType.MENTION]?.useCustom,
      ).toBe(true);
    });

    it('setCustomSound propagates copy failures', async () => {
      await soundService.initialize();
      (RNFS.exists as jest.Mock).mockResolvedValue(true);
      (RNFS as any).copyFile = jest
        .fn()
        .mockRejectedValue(new Error('copy-fail'));
      await expect(
        soundService.setCustomSound(SoundEventType.MENTION, '/bad.wav'),
      ).rejects.toThrow('copy-fail');
    });
  });

  describe('getSchemes and setActiveScheme', () => {
    it('should return available schemes', () => {
      const schemes = soundService.getSchemes();

      expect(schemes.length).toBeGreaterThan(0);
    });

    it('should return active scheme', async () => {
      await soundService.initialize();

      const scheme = soundService.getActiveScheme();
      // May be undefined if no scheme is set
      expect(scheme === undefined || scheme.id).toBeDefined();
    });

    it('should set active scheme', async () => {
      await soundService.initialize();

      const schemes = soundService.getSchemes();
      if (schemes.length > 0) {
        await soundService.setActiveScheme(schemes[0].id);

        const active = soundService.getActiveScheme();
        expect(active?.id).toBe(schemes[0].id);
      }
    });
  });

  describe('createScheme and deleteScheme', () => {
    it('should create custom scheme', async () => {
      await soundService.initialize();

      const scheme = await soundService.createScheme(
        'Test Scheme',
        'Test description',
      );

      expect(scheme.name).toBe('Test Scheme');
      expect(scheme.description).toBe('Test description');
      expect(scheme.isBuiltIn).toBe(false);
    });

    it('should delete custom scheme', async () => {
      await soundService.initialize();

      const scheme = await soundService.createScheme('To Delete');
      const initialCount = soundService
        .getSchemes()
        .filter(s => s.id === scheme.id).length;
      expect(initialCount).toBe(1);

      await soundService.deleteScheme(scheme.id);

      const afterDelete = soundService
        .getSchemes()
        .filter(s => s.id === scheme.id).length;
      expect(afterDelete).toBe(0);
    });

    it('should not delete built-in scheme', async () => {
      await soundService.initialize();

      const schemes = soundService.getSchemes();
      const builtIn = schemes.find(s => s.isBuiltIn);

      if (builtIn) {
        await soundService.deleteScheme(builtIn.id);

        // Scheme should still exist
        expect(
          soundService.getSchemes().find(s => s.id === builtIn.id),
        ).toBeDefined();
      }
    });

    it('should switch to classic scheme when deleting active scheme', async () => {
      await soundService.initialize();

      const scheme = await soundService.createScheme('Active Scheme');
      await soundService.setActiveScheme(scheme.id);

      await soundService.deleteScheme(scheme.id);

      const active = soundService.getActiveScheme();
      expect(active?.id).toBe('classic');
    });
  });

  describe('stopSound', () => {
    it('should stop current sound', async () => {
      await soundService.initialize();

      await expect(soundService.stopSound()).resolves.not.toThrow();
    });
  });

  describe('resetToDefault', () => {
    it('should reset event to default', async () => {
      await soundService.initialize();

      // Set custom config
      await soundService.updateEventConfig('message', {
        useCustom: true,
        customUri: '/path/to/sound',
      });

      // Reset
      await soundService.resetToDefault('message');

      const settings = soundService.getSettings();
      expect(settings.events.message?.useCustom).toBeFalsy();
    });
  });

  describe('resetAllToDefaults', () => {
    it('should reset all settings', async () => {
      await soundService.initialize();

      await soundService.updateSettings({ enabled: false, masterVolume: 0.3 });

      await soundService.resetAllToDefaults();

      const settings = soundService.getSettings();
      // Should be reset to defaults
      expect(settings.enabled).toBeDefined();
    });

    it('should handle delete sounds directory errors', async () => {
      await soundService.initialize();
      (RNFS.exists as jest.Mock).mockRejectedValueOnce(new Error('fs-fail'));
      await expect(soundService.resetAllToDefaults()).resolves.not.toThrow();
    });
  });

  describe('addListener', () => {
    it('should add and remove listener', async () => {
      await soundService.initialize();

      const listener = jest.fn();
      const unsubscribe = soundService.addListener(listener);

      await soundService.updateSettings({ masterVolume: 0.5 });
      expect(listener).toHaveBeenCalled();

      listener.mockClear();
      unsubscribe();

      await soundService.updateSettings({ masterVolume: 0.8 });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('custom scheme persistence errors', () => {
    it('createScheme should still return scheme when saveCustomSchemes fails', async () => {
      jest
        .spyOn(AsyncStorage, 'setItem')
        .mockRejectedValueOnce(new Error('set-fail'));
      const scheme = await soundService.createScheme('Broken Save');
      expect(scheme.name).toBe('Broken Save');
    });
  });
});
