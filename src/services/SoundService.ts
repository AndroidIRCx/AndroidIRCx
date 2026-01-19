/**
 * SoundService - Manages notification sound playback
 *
 * Uses react-native-sound for audio playback.
 * Supports built-in sounds from assets and custom sounds from device.
 */

import Sound from 'react-native-sound';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  SoundEventType,
  SoundSettings,
  SoundScheme,
  DEFAULT_SOUNDS,
  DEFAULT_SOUND_SETTINGS,
  BUILT_IN_SCHEMES,
} from '../types/sound';

const STORAGE_KEY = '@AndroidIRCX:soundSettings';
const CUSTOM_SCHEMES_KEY = '@AndroidIRCX:customSoundSchemes';

type SettingsListener = (settings: SoundSettings) => void;

// Enable playback in silence mode
Sound.setCategory('Playback');

class SoundService {
  private currentSound: Sound | null = null;
  private settings: SoundSettings = DEFAULT_SOUND_SETTINGS;
  private customSchemes: SoundScheme[] = [];
  private listeners: SettingsListener[] = [];
  private isInitialized = false;
  private isPlaying = false;
  private appState: AppStateStatus = 'active';
  private soundQueue: Array<{ eventType: SoundEventType; volume: number }> = [];
  private isProcessingQueue = false;

  constructor() {
    // Listen for app state changes
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    this.appState = nextAppState;
  };

  /**
   * Initialize the service - load settings from storage
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load settings
      const storedSettings = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        this.settings = {
          ...DEFAULT_SOUND_SETTINGS,
          ...parsed,
          events: {
            ...DEFAULT_SOUND_SETTINGS.events,
            ...(parsed.events || {}),
          },
        };
      }

      // Load custom schemes
      const storedSchemes = await AsyncStorage.getItem(CUSTOM_SCHEMES_KEY);
      if (storedSchemes) {
        this.customSchemes = JSON.parse(storedSchemes);
      }

      this.isInitialized = true;
      console.log('[SoundService] Initialized with settings:', this.settings.enabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('[SoundService] Failed to initialize:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Add a listener for settings changes
   */
  addListener(callback: SettingsListener): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l(this.settings));
  }

  /**
   * Get current settings
   */
  getSettings(): SoundSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<SoundSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
    this.notifyListeners();
  }

  /**
   * Update a specific event config
   */
  async updateEventConfig(
    eventType: SoundEventType,
    config: Partial<SoundSettings['events'][SoundEventType]>
  ): Promise<void> {
    this.settings.events[eventType] = {
      ...this.settings.events[eventType],
      ...config,
    };
    await this.saveSettings();
    this.notifyListeners();
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('[SoundService] Failed to save settings:', error);
    }
  }

  /**
   * Get all available schemes (built-in + custom)
   */
  getSchemes(): SoundScheme[] {
    return [...BUILT_IN_SCHEMES, ...this.customSchemes];
  }

  /**
   * Get the currently active scheme
   */
  getActiveScheme(): SoundScheme | undefined {
    return this.getSchemes().find(s => s.id === this.settings.activeSchemeId);
  }

  /**
   * Set the active scheme
   */
  async setActiveScheme(schemeId: string): Promise<void> {
    const scheme = this.getSchemes().find(s => s.id === schemeId);
    if (scheme) {
      await this.updateSettings({ activeSchemeId: schemeId });
    }
  }

  /**
   * Play a sound for a specific event
   */
  async playSound(eventType: SoundEventType): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check if sounds are enabled globally
    if (!this.settings.enabled) {
      return;
    }

    // Check foreground/background settings
    const isBackground = this.appState !== 'active';
    if (isBackground && !this.settings.playInBackground) {
      return;
    }
    if (!isBackground && !this.settings.playInForeground) {
      return;
    }

    // Check if this specific event is enabled
    const eventConfig = this.settings.events[eventType] ?? DEFAULT_SOUND_SETTINGS.events[eventType];
    if (!eventConfig?.enabled) {
      return;
    }

    // Calculate volume
    const eventVolume = eventConfig.volume ?? 1.0;
    const finalVolume = this.settings.masterVolume * eventVolume;

    if (finalVolume <= 0) {
      return;
    }

    // Queue the sound
    this.soundQueue.push({ eventType, volume: finalVolume });
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.soundQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.soundQueue.length > 0) {
      const item = this.soundQueue.shift();
      if (item) {
        await this.playSoundInternal(item.eventType, item.volume);
      }
    }

    this.isProcessingQueue = false;
  }

  private async playSoundInternal(eventType: SoundEventType, volume: number): Promise<void> {
    try {
      // Stop any currently playing sound
      this.stopCurrentSound();

      // Get the sound file info
      const soundInfo = await this.getSoundInfo(eventType);
      if (!soundInfo) {
        console.warn(`[SoundService] No sound configured for event: ${eventType}`);
        return;
      }

      const { filename, basePath } = soundInfo;

      // Create and play sound
      this.isPlaying = true;
      this.currentSound = new Sound(filename, basePath, (error) => {
        if (error) {
          console.error(`[SoundService] Failed to load sound for ${eventType}:`, error);
          this.isPlaying = false;
          return;
        }

        // Set volume and play
        this.currentSound?.setVolume(volume);
        this.currentSound?.play((success) => {
          if (!success) {
            console.warn(`[SoundService] Playback failed for ${eventType}`);
          }
          this.releaseCurrentSound();
        });
      });

    } catch (error) {
      console.error(`[SoundService] Failed to play sound for ${eventType}:`, error);
      this.isPlaying = false;
    }
  }

  private normalizeFilePath(path: string): string {
    return path.startsWith('file://') ? path.replace('file://', '') : path;
  }

  private normalizeAssetName(filename: string): string {
    if (Platform.OS !== 'android') {
      return filename;
    }

    const baseName = filename.split('/').pop() ?? filename;
    const withoutExtension = baseName.replace(/\.[^/.]+$/, '');
    return withoutExtension.toLowerCase();
  }

  private stopCurrentSound(): void {
    if (this.currentSound) {
      this.currentSound.stop();
      this.currentSound.release();
      this.currentSound = null;
    }
    this.isPlaying = false;
  }

  private releaseCurrentSound(): void {
    if (this.currentSound) {
      this.currentSound.release();
      this.currentSound = null;
    }
    this.isPlaying = false;
  }

  /**
   * Get sound file info for react-native-sound
   * Returns filename and basePath
   */
  private async getSoundInfo(eventType: SoundEventType): Promise<{ filename: string; basePath: string } | null> {
    const eventConfig = this.settings.events[eventType];

    // Check for custom sound
    if (eventConfig?.useCustom && eventConfig.customUri) {
      const customPath = this.normalizeFilePath(eventConfig.customUri);
      // Verify the file exists
      try {
        const exists = await RNFS.exists(customPath);
        if (exists) {
          // For custom files, use the full path as filename and empty basePath
          return { filename: customPath, basePath: '' };
        }
        console.warn(`[SoundService] Custom sound file not found: ${customPath}`);
      } catch {
        console.warn(`[SoundService] Error checking custom sound file: ${customPath}`);
      }
    }

    // Get from active scheme
    const scheme = this.getActiveScheme();
    const schemeSound = scheme?.sounds[eventType];

    if (schemeSound) {
      // If it's a URI (custom scheme), return as-is
      if (schemeSound.startsWith('file://') || schemeSound.startsWith('/')) {
        return { filename: this.normalizeFilePath(schemeSound), basePath: '' };
      }
      // Otherwise, it's an asset filename - load from Android assets
      return { filename: this.normalizeAssetName(schemeSound), basePath: Sound.MAIN_BUNDLE };
    }

    // Fall back to default sounds
    const defaultSound = DEFAULT_SOUNDS[eventType];
    if (defaultSound) {
      return { filename: this.normalizeAssetName(defaultSound), basePath: Sound.MAIN_BUNDLE };
    }

    return null;
  }

  /**
   * Preview a sound (for settings UI)
   */
  async previewSound(eventType: SoundEventType): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.stopCurrentSound();

      const soundInfo = await this.getSoundInfo(eventType);
      if (!soundInfo) {
        console.warn(`[SoundService] No sound to preview for: ${eventType}`);
        return;
      }

      const { filename, basePath } = soundInfo;
      this.isPlaying = true;
      this.currentSound = new Sound(filename, basePath, (error) => {
        if (error) {
          console.error('[SoundService] Failed to load preview sound:', error);
          this.isPlaying = false;
          return;
        }
        this.currentSound?.setVolume(this.settings.masterVolume);
        this.currentSound?.play(() => {
          this.releaseCurrentSound();
        });
      });

    } catch (error) {
      console.error(`[SoundService] Failed to preview sound:`, error);
      this.isPlaying = false;
    }
  }

  /**
   * Preview a custom sound file by URI
   */
  async previewCustomSound(uri: string): Promise<void> {
    try {
      this.stopCurrentSound();

      const normalizedUri = this.normalizeFilePath(uri);
      this.isPlaying = true;
      this.currentSound = new Sound(normalizedUri, '', (error) => {
        if (error) {
          console.error('[SoundService] Failed to load custom preview sound:', error);
          this.isPlaying = false;
          return;
        }
        this.currentSound?.setVolume(this.settings.masterVolume);
        this.currentSound?.play(() => {
          this.releaseCurrentSound();
        });
      });

    } catch (error) {
      console.error(`[SoundService] Failed to preview custom sound:`, error);
      this.isPlaying = false;
    }
  }

  /**
   * Stop any currently playing sound
   */
  async stopSound(): Promise<void> {
    this.stopCurrentSound();
  }

  /**
   * Set a custom sound for an event
   */
  async setCustomSound(eventType: SoundEventType, uri: string): Promise<void> {
    // Copy the file to app's document directory for persistence
    const filename = `custom_${eventType}_${Date.now()}.wav`;
    const destPath = `${RNFS.DocumentDirectoryPath}/sounds/${filename}`;

    try {
      // Ensure sounds directory exists
      const soundsDir = `${RNFS.DocumentDirectoryPath}/sounds`;
      const dirExists = await RNFS.exists(soundsDir);
      if (!dirExists) {
        await RNFS.mkdir(soundsDir);
      }

      // Copy the file
      await RNFS.copyFile(uri, destPath);

      // Update settings
      await this.updateEventConfig(eventType, {
        useCustom: true,
        customUri: destPath,
      });

      console.log(`[SoundService] Custom sound set for ${eventType}: ${destPath}`);
    } catch (error) {
      console.error(`[SoundService] Failed to set custom sound:`, error);
      throw error;
    }
  }

  /**
   * Remove custom sound and reset to default
   */
  async resetToDefault(eventType: SoundEventType): Promise<void> {
    const eventConfig = this.settings.events[eventType];

    // Delete custom file if exists
    if (eventConfig?.customUri) {
      try {
        const exists = await RNFS.exists(eventConfig.customUri);
        if (exists) {
          await RNFS.unlink(eventConfig.customUri);
        }
      } catch (error) {
        console.warn(`[SoundService] Failed to delete custom sound file:`, error);
      }
    }

    // Reset config
    await this.updateEventConfig(eventType, {
      useCustom: false,
      customUri: undefined,
    });
  }

  /**
   * Reset all settings to defaults
   */
  async resetAllToDefaults(): Promise<void> {
    // Delete all custom sound files
    try {
      const soundsDir = `${RNFS.DocumentDirectoryPath}/sounds`;
      const dirExists = await RNFS.exists(soundsDir);
      if (dirExists) {
        await RNFS.unlink(soundsDir);
      }
    } catch (error) {
      console.warn(`[SoundService] Failed to delete custom sounds directory:`, error);
    }

    // Reset settings
    this.settings = { ...DEFAULT_SOUND_SETTINGS };
    await this.saveSettings();
    this.notifyListeners();
  }

  /**
   * Create a custom sound scheme
   */
  async createScheme(name: string, description?: string): Promise<SoundScheme> {
    const scheme: SoundScheme = {
      id: `custom_${Date.now()}`,
      name,
      description,
      isBuiltIn: false,
      sounds: { ...DEFAULT_SOUNDS },
    };

    this.customSchemes.push(scheme);
    await this.saveCustomSchemes();

    return scheme;
  }

  /**
   * Delete a custom scheme
   */
  async deleteScheme(schemeId: string): Promise<void> {
    const scheme = this.customSchemes.find(s => s.id === schemeId);
    if (!scheme || scheme.isBuiltIn) {
      return;
    }

    this.customSchemes = this.customSchemes.filter(s => s.id !== schemeId);
    await this.saveCustomSchemes();

    // If this was the active scheme, switch to classic
    if (this.settings.activeSchemeId === schemeId) {
      await this.setActiveScheme('classic');
    }
  }

  private async saveCustomSchemes(): Promise<void> {
    try {
      await AsyncStorage.setItem(CUSTOM_SCHEMES_KEY, JSON.stringify(this.customSchemes));
    } catch (error) {
      console.error('[SoundService] Failed to save custom schemes:', error);
    }
  }

  /**
   * Check if the service is enabled
   */
  isEnabled(): boolean {
    return this.settings.enabled;
  }

  /**
   * Toggle sound on/off
   */
  async toggleEnabled(): Promise<boolean> {
    const newValue = !this.settings.enabled;
    await this.updateSettings({ enabled: newValue });
    return newValue;
  }
}

// Singleton instance
export const soundService = new SoundService();
