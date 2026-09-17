/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useSoundSettings Hook - React hook for sound settings management
 */

import { useState, useEffect, useCallback } from 'react';
import { soundService } from '../services/SoundService';
import {
  SoundSettings,
  SoundEventType,
  SoundScheme,
  SoundEventConfig,
  CustomSound,
} from '../types/sound';

export interface UseSoundSettingsReturn {
  settings: SoundSettings;
  schemes: SoundScheme[];
  activeScheme: SoundScheme | undefined;
  isLoading: boolean;

  // Global settings
  setEnabled: (enabled: boolean) => Promise<void>;
  setMasterVolume: (volume: number) => Promise<void>;
  setPlayInForeground: (enabled: boolean) => Promise<void>;
  setPlayInBackground: (enabled: boolean) => Promise<void>;

  // Scheme management
  setActiveScheme: (schemeId: string) => Promise<void>;
  createScheme: (name: string, description?: string) => Promise<SoundScheme>;
  deleteScheme: (schemeId: string) => Promise<void>;

  // Event settings
  setEventEnabled: (
    eventType: SoundEventType,
    enabled: boolean,
  ) => Promise<void>;
  setEventVolume: (eventType: SoundEventType, volume: number) => Promise<void>;
  setCustomSound: (eventType: SoundEventType, uri: string) => Promise<void>;
  resetEventToDefault: (eventType: SoundEventType) => Promise<void>;
  getEventConfig: (eventType: SoundEventType) => SoundEventConfig;

  // Named custom sounds
  customSounds: CustomSound[];
  addCustomSound: (name: string, uri: string) => Promise<CustomSound>;
  renameCustomSound: (id: string, name: string) => Promise<void>;
  removeCustomSound: (id: string) => Promise<void>;

  // Playback
  previewSound: (eventType: SoundEventType) => Promise<void>;
  previewCustomSound: (uri: string) => Promise<void>;
  stopSound: () => Promise<void>;

  // Reset
  resetAllToDefaults: () => Promise<void>;
}

export function useSoundSettings(): UseSoundSettingsReturn {
  const [settings, setSettings] = useState<SoundSettings>(
    soundService.getSettings(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize service and subscribe to changes
    const init = async () => {
      await soundService.initialize();
      setSettings(soundService.getSettings());
      setIsLoading(false);
    };

    init();

    const unsubscribe = soundService.addListener(newSettings => {
      setSettings(newSettings);
    });

    return unsubscribe;
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    await soundService.updateSettings({ enabled });
  }, []);

  const setMasterVolume = useCallback(async (volume: number) => {
    await soundService.updateSettings({
      masterVolume: Math.max(0, Math.min(1, volume)),
    });
  }, []);

  const setPlayInForeground = useCallback(async (enabled: boolean) => {
    await soundService.updateSettings({ playInForeground: enabled });
  }, []);

  const setPlayInBackground = useCallback(async (enabled: boolean) => {
    await soundService.updateSettings({ playInBackground: enabled });
  }, []);

  const setActiveScheme = useCallback(async (schemeId: string) => {
    await soundService.setActiveScheme(schemeId);
  }, []);

  const createScheme = useCallback(
    async (name: string, description?: string) => {
      return await soundService.createScheme(name, description);
    },
    [],
  );

  const deleteScheme = useCallback(async (schemeId: string) => {
    await soundService.deleteScheme(schemeId);
  }, []);

  const setEventEnabled = useCallback(
    async (eventType: SoundEventType, enabled: boolean) => {
      await soundService.updateEventConfig(eventType, { enabled });
    },
    [],
  );

  const setEventVolume = useCallback(
    async (eventType: SoundEventType, volume: number) => {
      await soundService.updateEventConfig(eventType, {
        volume: Math.max(0, Math.min(1, volume)),
      });
    },
    [],
  );

  const setCustomSound = useCallback(
    async (eventType: SoundEventType, uri: string) => {
      await soundService.setCustomSound(eventType, uri);
    },
    [],
  );

  const resetEventToDefault = useCallback(async (eventType: SoundEventType) => {
    await soundService.resetToDefault(eventType);
  }, []);

  const getEventConfig = useCallback(
    (eventType: SoundEventType): SoundEventConfig => {
      return (
        settings.events[eventType] || {
          enabled: false,
          useCustom: false,
          volume: 1.0,
        }
      );
    },
    [settings.events],
  );

  const addCustomSound = useCallback(async (name: string, uri: string) => {
    return await soundService.addCustomSound(name, uri);
  }, []);

  const renameCustomSound = useCallback(async (id: string, name: string) => {
    await soundService.renameCustomSound(id, name);
  }, []);

  const removeCustomSound = useCallback(async (id: string) => {
    await soundService.removeCustomSound(id);
  }, []);

  const previewSound = useCallback(async (eventType: SoundEventType) => {
    await soundService.previewSound(eventType);
  }, []);

  const previewCustomSound = useCallback(async (uri: string) => {
    await soundService.previewCustomSound(uri);
  }, []);

  const stopSound = useCallback(async () => {
    await soundService.stopSound();
  }, []);

  const resetAllToDefaults = useCallback(async () => {
    await soundService.resetAllToDefaults();
  }, []);

  return {
    settings,
    schemes: soundService.getSchemes(),
    activeScheme: soundService.getActiveScheme(),
    isLoading,

    setEnabled,
    setMasterVolume,
    setPlayInForeground,
    setPlayInBackground,

    setActiveScheme,
    createScheme,
    deleteScheme,

    setEventEnabled,
    setEventVolume,
    setCustomSound,
    resetEventToDefault,
    getEventConfig,

    customSounds: settings.customSounds ?? [],
    addCustomSound,
    renameCustomSound,
    removeCustomSound,

    previewSound,
    previewCustomSound,
    stopSound,

    resetAllToDefaults,
  };
}
