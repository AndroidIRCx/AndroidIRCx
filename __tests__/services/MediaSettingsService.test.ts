/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaSettingsService } from '../../src/services/MediaSettingsService';

describe('MediaSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage as any).__reset?.();
    (mediaSettingsService as any).loaded = false;
    (mediaSettingsService as any).listeners = [];
  });

  it('loads default settings when storage is empty', async () => {
    const settings = await mediaSettingsService.loadSettings();

    expect(settings.enabled).toBe(true);
    expect(settings.showEncryptionIndicator).toBe(true);
    expect(settings.autoDownload).toBe(true);
  });

  it('loads and merges stored settings', async () => {
    await AsyncStorage.setItem(
      '@MediaSettings',
      JSON.stringify({ enabled: false, mediaQuality: 'low' })
    );

    const settings = await mediaSettingsService.loadSettings();

    expect(settings.enabled).toBe(false);
    expect(settings.mediaQuality).toBe('low');
    expect(settings.videoQuality).toBe('1080p');
  });

  it('saves settings and notifies listeners', async () => {
    const listener = jest.fn();
    mediaSettingsService.onSettingsChanged(listener);

    await mediaSettingsService.saveSettings({ autoDownload: false, wifiOnly: true });
    const saved = await AsyncStorage.getItem('@MediaSettings');

    expect(saved).toContain('"autoDownload":false');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ autoDownload: false, wifiOnly: true })
    );
  });

  it('returns media-enabled state via lazy load', async () => {
    await AsyncStorage.setItem('@MediaSettings', JSON.stringify({ enabled: false }));
    (mediaSettingsService as any).loaded = false;

    const enabled = await mediaSettingsService.isMediaEnabled();

    expect(enabled).toBe(false);
  });

  it('imports valid settings json', async () => {
    const result = await mediaSettingsService.importSettings(
      JSON.stringify({
        enabled: false,
        showEncryptionIndicator: false,
        autoDownload: false,
        wifiOnly: true,
        cacheSize: 12345,
        mediaQuality: 'high',
        videoQuality: '720p',
        voiceMaxDuration: 60,
      })
    );

    expect(result.success).toBe(true);
    expect(await mediaSettingsService.getVideoQuality()).toBe('720p');
  });

  it('rejects invalid import payload', async () => {
    const result = await mediaSettingsService.importSettings(
      JSON.stringify({ enabled: 'nope' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid settings format');
  });

  it('handles malformed import json', async () => {
    const result = await mediaSettingsService.importSettings('{broken');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('resets settings to defaults', async () => {
    await mediaSettingsService.saveSettings({ enabled: false, mediaQuality: 'low' });
    await mediaSettingsService.resetToDefaults();

    const settings = await mediaSettingsService.getSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.mediaQuality).toBe('original');
  });

  it('supports unsubscribe from change listener', async () => {
    const listener = jest.fn();
    const unsubscribe = mediaSettingsService.onSettingsChanged(listener);
    unsubscribe();

    await mediaSettingsService.saveSettings({ wifiOnly: true });

    expect(listener).not.toHaveBeenCalled();
  });

  it('formats cache size labels', () => {
    expect(mediaSettingsService.getCacheSizeLabel(512)).toBe('512 bytes');
    expect(mediaSettingsService.getCacheSizeLabel(2048)).toBe('2 KB');
    expect(mediaSettingsService.getCacheSizeLabel(10 * 1024 * 1024)).toBe('10 MB');
    expect(mediaSettingsService.getCacheSizeLabel(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
  });

  it('returns expected cache size presets', () => {
    const presets = mediaSettingsService.getCacheSizePresets();
    expect(presets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '50 MB' }),
        expect.objectContaining({ label: '250 MB' }),
        expect.objectContaining({ label: '1 GB' }),
      ])
    );
  });

  it('covers wrapper getters/setters and export', async () => {
    await mediaSettingsService.setMediaEnabled(false);
    await mediaSettingsService.setShowEncryptionIndicator(false);
    await mediaSettingsService.setAutoDownload(false);
    await mediaSettingsService.setWiFiOnly(true);
    await mediaSettingsService.setMaxCacheSize(1024);
    await mediaSettingsService.setMediaQuality('medium');
    await mediaSettingsService.setVideoQuality('480p');
    await mediaSettingsService.setVoiceMaxDuration(45);

    expect(await mediaSettingsService.isMediaEnabled()).toBe(false);
    expect(await mediaSettingsService.shouldShowEncryptionIndicator()).toBe(false);
    expect(await mediaSettingsService.getAutoDownload()).toBe(false);
    expect(await mediaSettingsService.getWiFiOnly()).toBe(true);
    expect(await mediaSettingsService.getMaxCacheSize()).toBe(1024);
    expect(await mediaSettingsService.getMediaQuality()).toBe('medium');
    expect(await mediaSettingsService.getVideoQuality()).toBe('480p');
    expect(await mediaSettingsService.getVoiceMaxDuration()).toBe(45);

    const exported = await mediaSettingsService.exportSettings();
    expect(exported).toContain('"mediaQuality": "medium"');
  });
});
