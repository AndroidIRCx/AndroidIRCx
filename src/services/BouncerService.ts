/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { IRCService, type IRCMessage } from './IRCService';
import { tx } from '../i18n/transifex';

export interface BouncerConfig {
  enabled: boolean;
  type: 'znc' | 'bnc' | 'auto'; // Auto-detect
  handlePlayback: boolean; // Handle playback buffer messages
  playbackTimeout: number; // Timeout in ms to consider playback finished (default: 5000)
  markPlaybackMessages: boolean; // Mark playback messages differently
  skipOldPlayback: boolean; // Skip very old playback messages (older than X hours)
  playbackAgeLimit: number; // Max age of playback messages in hours (default: 24)
  loadScrollbackOnJoin: boolean; // Load previous messages from local history when joining channel
  scrollbackLines: number; // Number of scrollback lines to load (default: 50)
}

export interface BouncerInfo {
  type: 'znc' | 'bnc' | 'unknown';
  version?: string;
  capabilities: string[];
  playbackSupported: boolean;
  playbackActive: boolean;
}

export class BouncerService {
  private ircService: IRCService;
  private config: BouncerConfig = {
    enabled: true,
    type: 'auto',
    handlePlayback: true,
    playbackTimeout: 5000,
    markPlaybackMessages: true,
    skipOldPlayback: false,
    playbackAgeLimit: 24,
    loadScrollbackOnJoin: true,
    scrollbackLines: 50,
  };

  private bouncerInfo: BouncerInfo = {
    type: 'unknown',
    capabilities: [],
    playbackSupported: false,
    playbackActive: false,
  };

  private playbackStartTime: number = 0;
  private playbackTimer: NodeJS.Timeout | null = null;
  private lastPlaybackMessageTime: number = 0;
  private isInPlayback: boolean = false;
  private playbackMessages: IRCMessage[] = [];
  private playbackListeners: Array<(isPlayback: boolean) => void> = [];
  private readonly STORAGE_KEY = '@AndroidIRCX:bouncerConfig';

  constructor(ircService: IRCService) {
    this.ircService = ircService;
  }

  /**
   * Initialize bouncer service
   */
  async initialize(): Promise<void> {
    // Load saved configuration
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.config = { ...this.config, ...data };
      }
    } catch (error) {
      console.error('Failed to load bouncer config:', error);
    }

    // Listen for connection changes
    this.ircService.onConnectionChange((connected) => {
      if (connected) {
        this.onConnected();
      } else {
        this.onDisconnected();
      }
    });

    // Listen for messages to detect playback
    this.ircService.onMessage((message) => {
      if (this.shouldHandlePlayback()) {
        this.handleMessage(message);
      }
    });

    // Listen for capabilities
    this.ircService.on('capabilities', (capabilities: string[]) => {
        this.updateCapabilities(capabilities);
    });
  }

  /**
   * Handle connection established
   */
  private onConnected(): void {
    this.resetPlaybackState();
    this.detectBouncer();
  }

  /**
   * Handle disconnection
   */
  private onDisconnected(): void {
    this.resetPlaybackState();
    this.bouncerInfo = {
      type: 'unknown',
      capabilities: [],
      playbackSupported: false,
      playbackActive: false,
    };
  }

  /**
   * Detect bouncer type from server version or capabilities
   */
  private detectBouncer(): void {
    // This will be called after CAP negotiation
    // We'll detect from server version or CAP capabilities
    setTimeout(() => {
      // Check if ZNC capabilities are available
      const hasZNCPlayback = this.bouncerInfo.capabilities.includes('znc.in/playback');
      const hasZNC = this.bouncerInfo.capabilities.some(cap => cap.startsWith('znc.in/'));
      const hasGenericBnc = this.bouncerInfo.capabilities.some(cap => cap.toLowerCase().includes('bouncer') || cap.toLowerCase().includes('playback'));

      if (this.config.type === 'auto') {
        if (hasZNCPlayback || hasZNC) {
          this.bouncerInfo.type = 'znc';
          this.bouncerInfo.playbackSupported = hasZNCPlayback;
        } else if (hasGenericBnc) {
          // Generic bouncer hint (fallback)
          this.bouncerInfo.type = 'bnc';
          this.bouncerInfo.playbackSupported = hasZNCPlayback;
        } else {
          // No signal -> leave as unknown to avoid false positives
          this.bouncerInfo.type = 'unknown';
          this.bouncerInfo.playbackSupported = false;
        }
      } else {
        this.bouncerInfo.type = this.config.type;
      }

      if (this.bouncerInfo.type !== 'unknown') {
        console.log('BouncerService: Detected bouncer type:', this.bouncerInfo.type);
        const t = (key: string, params?: Record<string, unknown>) => {
          const translator = (tx as any)?.t;
          return typeof translator === 'function' ? translator(key, params) : key;
        };
        const hint = this.bouncerInfo.type === 'znc'
          ? t('Quick aliases: /zncver, /zncm, /zncplay #chan, /zncclear #chan')
          : undefined;
        this.ircService.addRawMessage(
          t('*** Detected bouncer type: {type}{hint}', {
            type: this.bouncerInfo.type,
            hint: hint ? ` (${hint})` : '',
          }),
          'connection'
        );
      }
    }, 2000); // Wait a bit for CAP negotiation
  }

  /**
   * Update bouncer capabilities
   */
  updateCapabilities(capabilities: string[]): void {
    this.bouncerInfo.capabilities = capabilities;
    const hasZNCPlayback = capabilities.includes('znc.in/playback');
    this.bouncerInfo.playbackSupported = hasZNCPlayback;

    if (this.config.type === 'auto') {
      const hasZNC = capabilities.some(cap => cap.startsWith('znc.in/'));
      const hasGenericBnc = capabilities.some(cap => cap.toLowerCase().includes('bouncer') || cap.toLowerCase().includes('playback'));
      if (hasZNCPlayback || hasZNC) {
        this.bouncerInfo.type = 'znc';
      } else if (hasGenericBnc) {
        this.bouncerInfo.type = 'bnc';
      } else {
        this.bouncerInfo.type = 'unknown';
      }
    }
  }

  /**
   * Handle incoming message to detect playback
   */
  private handleMessage(message: IRCMessage): void {
    if (!this.shouldHandlePlayback()) return;
    // Check if message has server-time tag (indicates it's from playback)
    const isPlaybackMessage = this.isPlaybackMessage(message);

    if (isPlaybackMessage) {
      if (!this.isInPlayback) {
        // Start of playback
        this.startPlayback();
      }

      this.lastPlaybackMessageTime = Date.now();
      this.playbackMessages.push(message);

      // Check if message is too old
      if (this.config.skipOldPlayback && message.timestamp) {
        const messageAge = Date.now() - message.timestamp;
        const maxAge = this.config.playbackAgeLimit * 60 * 60 * 1000; // Convert hours to ms
        if (messageAge > maxAge) {
          // Skip very old messages
          return;
        }
      }

      // Mark message as playback if configured
      if (this.config.markPlaybackMessages) {
        (message as any).isPlayback = true;
        (message as any).playbackIndicator = '[Playback]';
      }

      // Reset playback timer
      this.resetPlaybackTimer();
    }
  }

  /**
   * Check if message is from playback buffer
   */
  private isPlaybackMessage(message: IRCMessage): boolean {
    // Playback messages typically have:
    // 1. Server-time tag that's in the past
    // 2. Sent shortly after connection
    // 3. From channels you were in before disconnect

    if (!message.timestamp) return false;

    const messageAge = Date.now() - message.timestamp;
    const connectionAge = Date.now() - this.playbackStartTime;

    // If message is older than connection and we're in playback window
    if (messageAge > connectionAge && connectionAge < this.config.playbackTimeout * 2) {
      return true;
    }

    // Also check if we're actively in playback mode
    return this.isInPlayback;
  }

  /**
   * Start playback mode
   */
  private startPlayback(): void {
    if (this.isInPlayback) return;

    this.isInPlayback = true;
    this.bouncerInfo.playbackActive = true;
    this.playbackStartTime = Date.now();
    this.lastPlaybackMessageTime = Date.now();
    this.playbackMessages = [];

    console.log('BouncerService: Playback started');

    // Notify listeners
    this.notifyPlaybackListeners(true);

    // Set timer to end playback
    this.resetPlaybackTimer();
  }

  /**
   * End playback mode
   */
  private endPlayback(): void {
    if (!this.isInPlayback) return;

    this.isInPlayback = false;
    this.bouncerInfo.playbackActive = false;

    console.log(`BouncerService: Playback ended (${this.playbackMessages.length} messages)`);

    // Notify listeners
    this.notifyPlaybackListeners(false);

    // Clear playback messages
    this.playbackMessages = [];
  }

  /**
   * Reset playback timer
   */
  private resetPlaybackTimer(): void {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
    }

    this.playbackTimer = setTimeout(() => {
      this.endPlayback();
    }, this.config.playbackTimeout);
  }

  /**
   * Reset playback state
   */
  private resetPlaybackState(): void {
    this.isInPlayback = false;
    this.bouncerInfo.playbackActive = false;
    this.playbackStartTime = Date.now();
    this.lastPlaybackMessageTime = 0;
    this.playbackMessages = [];

    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  /**
   * Request playback buffer from ZNC
   */
  requestPlayback(channel?: string): void {
    if (!this.shouldHandlePlayback()) {
      console.warn('BouncerService: Playback not supported');
      return;
    }

    if (channel) {
      this.ircService.sendRaw(`PRIVMSG *playback :play ${channel}`);
    } else {
      this.ircService.sendRaw(`PRIVMSG *playback :play *`);
    }
  }

  /**
   * Clear playback buffer in ZNC
   */
  clearPlayback(channel?: string): void {
    if (!this.shouldHandlePlayback()) {
      console.warn('BouncerService: Playback not supported');
      return;
    }

    if (channel) {
      this.ircService.sendRaw(`PRIVMSG *playback :clear ${channel}`);
    } else {
      this.ircService.sendRaw(`PRIVMSG *playback :clear *`);
    }
  }

  /**
   * Get bouncer information
   */
  getBouncerInfo(): BouncerInfo {
    return { ...this.bouncerInfo };
  }

  /**
   * Check if currently in playback mode
   */
  isInPlaybackMode(): boolean {
    return this.isInPlayback;
  }

  /**
   * Get playback statistics
   */
  getPlaybackStats(): { messageCount: number; duration: number } {
    return {
      messageCount: this.playbackMessages.length,
      duration: this.isInPlayback ? Date.now() - this.playbackStartTime : 0,
    };
  }

  /**
   * Get bouncer config
   */
  getConfig(): BouncerConfig {
    return { ...this.config };
  }

  /**
   * Set bouncer config
   */
  async setConfig(config: Partial<BouncerConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.saveConfig();
  }

  /**
   * Listen for playback state changes
   */
  onPlaybackChange(callback: (isPlayback: boolean) => void): () => void {
    this.playbackListeners.push(callback);
    return () => {
      this.playbackListeners = this.playbackListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify playback listeners
   */
  private notifyPlaybackListeners(isPlayback: boolean): void {
    this.playbackListeners.forEach(callback => {
      try {
        callback(isPlayback);
      } catch (error) {
        console.error('Error in playback listener:', error);
      }
    });
  }

  /**
   * Save configuration
   */
  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save bouncer config:', error);
    }
  }

  private shouldHandlePlayback(): boolean {
    return (
      this.config.enabled &&
      this.config.handlePlayback &&
      this.bouncerInfo.type === 'znc' &&
      this.bouncerInfo.playbackSupported
    );
  }
}

const { ircService } = require('./IRCService');
export const bouncerService = new BouncerService(ircService);
