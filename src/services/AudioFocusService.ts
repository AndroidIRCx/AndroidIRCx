/**
 * AudioFocusService - Manages audio focus for notification sounds
 * Uses native AudioFocusModule on Android to prevent interrupting music/radio
 */

import { NativeModules, Platform } from 'react-native';

const { AudioFocusModule } = NativeModules;

class AudioFocusService {
  private isAvailable: boolean = false;

  constructor() {
    this.isAvailable = Platform.OS === 'android' && !!AudioFocusModule;
  }

  /**
   * Request transient audio focus with ducking
   * Other apps (music, radio) will be ducked (lowered) but not stopped
   * @returns true if focus was granted
   */
  async requestTransientFocus(): Promise<boolean> {
    if (!this.isAvailable) {
      return true; // Always succeed on iOS or if module not available
    }
    try {
      return await AudioFocusModule.requestTransientFocus();
    } catch (error) {
      console.warn('[AudioFocusService] Failed to request focus:', error);
      return true; // Allow playback even if focus request fails
    }
  }

  /**
   * Release audio focus immediately
   * This allows other apps (music, radio) to resume normal volume
   */
  releaseFocus(): void {
    if (!this.isAvailable) {
      return;
    }
    try {
      AudioFocusModule.releaseFocus();
    } catch (error) {
      console.warn('[AudioFocusService] Failed to release focus:', error);
    }
  }
}

export const audioFocusService = new AudioFocusService();
