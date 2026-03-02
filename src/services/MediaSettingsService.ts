/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * MediaSettingsService - Manage media-related user preferences
 *
 * Settings:
 * - Media feature enabled/disabled (master toggle)
 * - Show encryption indicator (🔒 icon)
 * - Auto-download media
 * - WiFi-only download
 * - Cache size limit
 * - Media quality preferences
 * - Video recording quality
 * - Voice message max duration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const SETTINGS_KEY = '@MediaSettings';

// Default settings
const DEFAULT_SETTINGS: MediaSettings = {
  enabled: true,                     // Media feature enabled
  showEncryptionIndicator: true,     // Show 🔒 icon on media
  autoDownload: true,                // Auto-download media
  wifiOnly: false,                   // Download only on WiFi
  cacheSize: 250 * 1024 * 1024,      // 250MB cache limit
  mediaQuality: 'original',          // original, high, medium, low
  videoQuality: '1080p',             // 4k, 1080p, 720p, 480p
  callVideoQuality: '720p',          // 1440p, 1080p, 720p, 480p
  voiceMaxDuration: 180,             // 180 seconds (3 minutes)
};

export interface MediaSettings {
  enabled: boolean;                  // Master toggle for entire media feature
  showEncryptionIndicator: boolean;  // Show/hide 🔒 icon on media
  autoDownload: boolean;             // Auto-download media when received
  wifiOnly: boolean;                 // Only auto-download on WiFi
  cacheSize: number;                 // Cache size limit in bytes
  mediaQuality: 'original' | 'high' | 'medium' | 'low'; // Media upload quality
  videoQuality: '4k' | '1080p' | '720p' | '480p';       // Video recording quality
  callVideoQuality: '1440p' | '1080p' | '720p' | '480p'; // Live call video quality
  voiceMaxDuration: number;          // Max voice message duration (seconds)
}

/**
 * MediaSettingsService - Load/save media preferences
 */
class MediaSettingsService {
  private settings: MediaSettings = DEFAULT_SETTINGS;
  private loaded: boolean = false;
  private listeners: Array<(settings: MediaSettings) => void> = [];

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<MediaSettings> {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } else {
        this.settings = { ...DEFAULT_SETTINGS };
      }
      this.loaded = true;
      console.log('[MediaSettingsService] Settings loaded:', this.settings);
      return this.settings;
    } catch (error) {
      console.error('[MediaSettingsService] Load error:', error);
      this.settings = { ...DEFAULT_SETTINGS };
      return this.settings;
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings(settings: Partial<MediaSettings>): Promise<void> {
    try {
      // Merge with current settings
      this.settings = { ...this.settings, ...settings };

      // Save to storage
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));

      console.log('[MediaSettingsService] Settings saved:', settings);

      // Notify listeners
      this.notifyListeners();
    } catch (error) {
      console.error('[MediaSettingsService] Save error:', error);
    }
  }

  /**
   * Get all settings (synchronous, loads if needed)
   */
  async getSettings(): Promise<MediaSettings> {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return this.settings;
  }

  /**
   * Check if media feature is enabled (master toggle)
   * This is the PRIMARY check - if false, entire media feature is disabled
   */
  async isMediaEnabled(): Promise<boolean> {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return this.settings.enabled;
  }

  /**
   * Enable/disable media feature
   */
  async setMediaEnabled(enabled: boolean): Promise<void> {
    await this.saveSettings({ enabled });
  }

  /**
   * Check if encryption indicator should be shown (🔒 icon)
   */
  async shouldShowEncryptionIndicator(): Promise<boolean> {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return this.settings.showEncryptionIndicator;
  }

  /**
   * Set encryption indicator visibility
   */
  async setShowEncryptionIndicator(show: boolean): Promise<void> {
    await this.saveSettings({ showEncryptionIndicator: show });
  }

  /**
   * Check if auto-download is enabled
   */
  async getAutoDownload(): Promise<boolean> {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return this.settings.autoDownload;
  }

  /**
   * Set auto-download preference
   */
  async setAutoDownload(enabled: boolean): Promise<void> {
    await this.saveSettings({ autoDownload: enabled });
  }

  /**
   * Check if WiFi-only mode is enabled
   */
  async getWiFiOnly(): Promise<boolean> {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return this.settings.wifiOnly;
  }

  /**
   * Set WiFi-only mode
   */
  async setWiFiOnly(enabled: boolean): Promise<void> {
    await this.saveSettings({ wifiOnly: enabled });
  }

  /**
   * Get cache size limit in bytes
   */
  async getMaxCacheSize(): Promise<number> {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return this.settings.cacheSize;
  }

  /**
   * Set cache size limit
   */
  async setMaxCacheSize(sizeInBytes: number): Promise<void> {
    await this.saveSettings({ cacheSize: sizeInBytes });
  }

  /**
   * Get media quality preference
   */
  async getMediaQuality(): Promise<'original' | 'high' | 'medium' | 'low'> {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return this.settings.mediaQuality;
  }

  /**
   * Set media quality preference
   */
  async setMediaQuality(quality: 'original' | 'high' | 'medium' | 'low'): Promise<void> {
    await this.saveSettings({ mediaQuality: quality });
  }

  /**
   * Get video recording quality
   */
  async getVideoQuality(): Promise<'4k' | '1080p' | '720p' | '480p'> {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return this.settings.videoQuality;
  }

  /**
   * Set video recording quality
   */
  async setVideoQuality(quality: '4k' | '1080p' | '720p' | '480p'): Promise<void> {
    await this.saveSettings({ videoQuality: quality });
  }

  /**
   * Get live call video quality
   */
  async getCallVideoQuality(): Promise<'1440p' | '1080p' | '720p' | '480p'> {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return this.settings.callVideoQuality;
  }

  /**
   * Set live call video quality
   */
  async setCallVideoQuality(quality: '1440p' | '1080p' | '720p' | '480p'): Promise<void> {
    await this.saveSettings({ callVideoQuality: quality });
  }

  /**
   * Get max voice message duration (seconds)
   */
  async getVoiceMaxDuration(): Promise<number> {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return this.settings.voiceMaxDuration;
  }

  /**
   * Set max voice message duration
   */
  async setVoiceMaxDuration(seconds: number): Promise<void> {
    await this.saveSettings({ voiceMaxDuration: seconds });
  }

  /**
   * Reset all settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    await this.saveSettings(DEFAULT_SETTINGS);
  }

  /**
   * Export settings (for backup)
   */
  async exportSettings(): Promise<string> {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings (from backup)
   */
  async importSettings(settingsJson: string): Promise<{ success: boolean; error?: string }> {
    try {
      const imported = JSON.parse(settingsJson) as MediaSettings;

      // Validate imported settings
      if (typeof imported.enabled !== 'boolean') {
        return { success: false, error: 'Invalid settings format' };
      }

      await this.saveSettings(imported);
      return { success: true };
    } catch (error: any) {
      console.error('[MediaSettingsService] Import error:', error);
      return {
        success: false,
        error: error.message || 'Failed to import settings',
      };
    }
  }

  /**
   * Subscribe to settings changes
   */
  onSettingsChanged(callback: (settings: MediaSettings) => void): () => void {
    this.listeners.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of settings change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.settings);
      } catch (error) {
        console.error('[MediaSettingsService] Listener error:', error);
      }
    });
  }

  /**
   * Get human-readable cache size
   */
  getCacheSizeLabel(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    } else {
      return `${bytes} bytes`;
    }
  }

  /**
   * Get common cache size presets
   */
  getCacheSizePresets(): Array<{ label: string; value: number }> {
    return [
      { label: '50 MB', value: 50 * 1024 * 1024 },
      { label: '100 MB', value: 100 * 1024 * 1024 },
      { label: '250 MB', value: 250 * 1024 * 1024 },
      { label: '500 MB', value: 500 * 1024 * 1024 },
      { label: '1 GB', value: 1024 * 1024 * 1024 },
    ];
  }
}

// Export singleton instance
export const mediaSettingsService = new MediaSettingsService();
