/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { IRCService } from './IRCService';
import { settingsService } from './SettingsService';
import { tx } from '../i18n/transifex';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export interface RateLimitConfig {
  enabled: boolean;
  messagesPerSecond: number; // Max messages per second
  burstLimit: number; // Max messages in a burst
  burstWindow: number; // Burst window in milliseconds
}

export interface FloodProtectionConfig {
  enabled: boolean;
  maxMessagesPerWindow: number; // Max messages in a time window
  windowSize: number; // Window size in milliseconds
  penaltyDelay: number; // Delay penalty in milliseconds when limit exceeded
}

export interface LagMonitoringConfig {
  enabled: boolean;
  pingInterval: number; // Interval between pings in milliseconds (default: 30000 = 30s)
  timeoutThreshold: number; // Timeout threshold in milliseconds (default: 10000 = 10s)
  warningThreshold: number; // Warning threshold in milliseconds (default: 1000 = 1s)
}

export interface ConnectionStatistics {
  bytesSent: number;
  bytesReceived: number;
  messagesSent: number;
  messagesReceived: number;
  commandsSent: number;
  commandsReceived: number;
  connectionStartTime: number;
  lastActivityTime: number;
  pingTimes: number[]; // Array of recent ping times
  averagePing: number;
  minPing: number;
  maxPing: number;
  currentLag: number; // Current lag in milliseconds
  lagStatus: 'good' | 'warning' | 'timeout'; // Lag status
}

export class ConnectionQualityService {
  private ircService: IRCService | null = null;
  private rateLimitConfig: RateLimitConfig = {
    enabled: true,
    messagesPerSecond: 4,
    burstLimit: 15,
    burstWindow: 3000,
  };

  private floodProtectionConfig: FloodProtectionConfig = {
    enabled: true,
    maxMessagesPerWindow: 10,
    windowSize: 10000,
    penaltyDelay: 2000,
  };

  private lagMonitoringConfig: LagMonitoringConfig = {
    enabled: true,
    pingInterval: 30000,
    timeoutThreshold: 10000,
    warningThreshold: 1000,
  };

  private messageQueue: Array<{ message: string; timestamp: number; resolve: () => void; reject: (error: Error) => void }> = [];
  private messageHistory: Array<{ timestamp: number }> = [];
  private burstHistory: Array<{ timestamp: number }> = [];
  private isProcessingQueue: boolean = false;
  private pingTimer: NodeJS.Timeout | null = null;
  private lastPingTime: number = 0;
  private pendingPings: Map<number, number> = new Map(); // pingId -> timestamp
  private pingIdCounter: number = 0;
  private statistics: ConnectionStatistics = {
    bytesSent: 0,
    bytesReceived: 0,
    messagesSent: 0,
    messagesReceived: 0,
    commandsSent: 0,
    commandsReceived: 0,
    connectionStartTime: 0,
    lastActivityTime: 0,
    pingTimes: [],
    averagePing: 0,
    minPing: 0,
    maxPing: 0,
    currentLag: 0,
    lagStatus: 'good',
  };

  private statisticsListeners: Array<(stats: ConnectionStatistics) => void> = [];
  private lagListeners: Array<(lag: number, status: 'good' | 'warning' | 'timeout') => void> = [];
  private lagCheckMethod: 'ctcp' | 'server' = 'server';

  private readonly STATS_STORAGE_KEY = '@AndroidIRCX:connectionQualityConfig';

  constructor() {
    // IRCService will be set later
  }

  setIRCService(ircService: IRCService): void {
    this.ircService = ircService;
  }

  /**
   * Initialize connection quality service
   */
  async initialize(): Promise<void> {
    // Load saved configuration
    try {
      const stored = await AsyncStorage.getItem(this.STATS_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.rateLimit) this.rateLimitConfig = { ...this.rateLimitConfig, ...data.rateLimit };
        if (data.floodProtection) this.floodProtectionConfig = { ...this.floodProtectionConfig, ...data.floodProtection };
        if (data.lagMonitoring) this.lagMonitoringConfig = { ...this.lagMonitoringConfig, ...data.lagMonitoring };
      }
      this.lagCheckMethod = await settingsService.getSetting('lagCheckMethod', 'server');
      settingsService.onSettingChange('lagCheckMethod', (value: 'ctcp' | 'server') => {
        this.lagCheckMethod = value;
      });
    } catch (error) {
      console.error('Failed to load connection quality config:', error);
    }

    // Listen for connection changes
    this.ircService?.onConnectionChange((connected) => {
      if (connected) {
        this.onConnected();
      } else {
        this.onDisconnected();
      }
    });

    // Listen for incoming messages to track statistics
    this.ircService?.onMessage((message) => {
      this.trackMessageReceived(message.text);
    });

    // Listen for PING/PONG to measure lag
    this.setupPingMonitoring();
  }

  /**
   * Handle connection established
   */
  private onConnected(): void {
    this.resetStatistics();
    this.statistics.connectionStartTime = Date.now();
    this.statistics.lastActivityTime = Date.now();

    // Start lag monitoring
    if (this.lagMonitoringConfig.enabled) {
      this.startLagMonitoring();
    }
  }

  /**
   * Handle disconnection
   */
  private onDisconnected(): void {
    this.stopLagMonitoring();
    this.clearMessageQueue();
  }

  /**
   * Reset statistics
   */
  private resetStatistics(): void {
    this.statistics = {
      bytesSent: 0,
      bytesReceived: 0,
      messagesSent: 0,
      messagesReceived: 0,
      commandsSent: 0,
      commandsReceived: 0,
      connectionStartTime: Date.now(),
      lastActivityTime: Date.now(),
      pingTimes: [],
      averagePing: 0,
      minPing: 0,
      maxPing: 0,
      currentLag: 0,
      lagStatus: 'good',
    };
    this.messageHistory = [];
    this.burstHistory = [];
    this.pendingPings.clear();
  }

  /**
   * Send message with rate limiting and flood protection
   */
  async sendMessage(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check rate limiting
      if (this.rateLimitConfig.enabled && !this.checkRateLimit()) {
        reject(new Error(t('Rate limit exceeded. Please slow down.')));
        return;
      }

      // Check flood protection
      if (this.floodProtectionConfig.enabled && !this.checkFloodProtection()) {
        // Add penalty delay
        setTimeout(() => {
          this.sendMessage(message).then(resolve).catch(reject);
        }, this.floodProtectionConfig.penaltyDelay);
        return;
      }

      // Track message
      this.trackMessageSent(message);

      // Send message directly (bypassing sendRaw to avoid recursion)
      try {
        const socket = (this.ircService as any)?.socket;
        const isConnected = (this.ircService as any)?.isConnected;
        if (socket && isConnected) {
          socket.write(message + '\r\n');
          resolve();
        } else {
          reject(new Error(t('Not connected')));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): boolean {
    if (!this.rateLimitConfig.enabled) return true;

    const now = Date.now();
    const oneSecondAgo = now - 1000;

    // Remove old messages from history
    this.messageHistory = this.messageHistory.filter(m => m.timestamp > oneSecondAgo);

    // Check messages per second
    if (this.messageHistory.length >= this.rateLimitConfig.messagesPerSecond) {
      return false;
    }

    // Check burst limit
    const burstWindowStart = now - this.rateLimitConfig.burstWindow;
    this.burstHistory = this.burstHistory.filter(m => m.timestamp > burstWindowStart);

    if (this.burstHistory.length >= this.rateLimitConfig.burstLimit) {
      return false;
    }

    return true;
  }

  /**
   * Check flood protection
   */
  private checkFloodProtection(): boolean {
    if (!this.floodProtectionConfig.enabled) return true;

    const now = Date.now();
    const windowStart = now - this.floodProtectionConfig.windowSize;

    // Count messages in window
    const messagesInWindow = this.messageHistory.filter(m => m.timestamp > windowStart).length;

    return messagesInWindow < this.floodProtectionConfig.maxMessagesPerWindow;
  }

  /**
   * Track message sent
   */
  private trackMessageSent(message: string): void {
    const now = Date.now();
    this.messageHistory.push({ timestamp: now });
    this.burstHistory.push({ timestamp: now });

    // Update statistics
    this.statistics.messagesSent++;
    this.statistics.bytesSent += message.length + 2; // +2 for \r\n
    this.statistics.commandsSent++;
    this.statistics.lastActivityTime = now;

    this.notifyStatisticsListeners();
  }

  /**
   * Track message received
   */
  private trackMessageReceived(message: string): void {
    this.statistics.messagesReceived++;
    this.statistics.bytesReceived += message.length + 2; // +2 for \r\n
    this.statistics.commandsReceived++;
    this.statistics.lastActivityTime = Date.now();

    this.notifyStatisticsListeners();
  }

  /**
   * Setup ping monitoring
   */
  private setupPingMonitoring(): void {
    // Override sendRaw to intercept PING/PONG
    // We'll monitor PING/PONG in IRCService instead
  }

  /**
   * Start lag monitoring
   */
  private startLagMonitoring(): void {
    this.stopLagMonitoring();

    if (!this.lagMonitoringConfig.enabled) return;

    // Send initial ping
    this.sendPing();

    // Set up periodic pings
    this.pingTimer = setInterval(() => {
      this.sendPing();
    }, this.lagMonitoringConfig.pingInterval);
  }

  /**
   * Stop lag monitoring
   */
  private stopLagMonitoring(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Send ping to measure lag
   */
  private sendPing(): void {
    if (!this.ircService?.getConnectionStatus()) return;

    const timestamp = Date.now();
    this.lastPingTime = timestamp;

    if (this.lagCheckMethod === 'ctcp') {
      // Send CTCP PING
      this.ircService?.sendCTCPRequest(this.ircService.getCurrentNick(), 'PING', timestamp.toString());
    } else {
      // Send server PING
      this.ircService?.sendRaw(`PING :${timestamp}`);
    }
  }

  /**
   * Handle PONG response
   */
  handlePongResponse(timestamp: number): void {
    const now = Date.now();
    const lag = now - timestamp;

    // Update ping statistics
    this.statistics.pingTimes.push(lag);
    if (this.statistics.pingTimes.length > 20) {
      this.statistics.pingTimes.shift(); // Keep only last 20 pings
    }

    // Calculate statistics
    if (this.statistics.pingTimes.length > 0) {
      const sum = this.statistics.pingTimes.reduce((a, b) => a + b, 0);
      this.statistics.averagePing = sum / this.statistics.pingTimes.length;
      this.statistics.minPing = Math.min(...this.statistics.pingTimes);
      this.statistics.maxPing = Math.max(...this.statistics.pingTimes);
    }

    this.statistics.currentLag = lag;

    // Determine lag status
    if (lag >= this.lagMonitoringConfig.timeoutThreshold) {
      this.statistics.lagStatus = 'timeout';
    } else if (lag >= this.lagMonitoringConfig.warningThreshold) {
      this.statistics.lagStatus = 'warning';
    } else {
      this.statistics.lagStatus = 'good';
    }

    this.notifyStatisticsListeners();
    this.notifyLagListeners(lag, this.statistics.lagStatus);
  }

  /**
   * Clear message queue
   */
  private clearMessageQueue(): void {
    this.messageQueue.forEach(item => {
      item.reject(new Error(t('Connection closed')));
    });
    this.messageQueue = [];
  }

  /**
   * Get current statistics
   */
  getStatistics(): ConnectionStatistics {
    const uptime = Date.now() - this.statistics.connectionStartTime;
    return {
      ...this.statistics,
      connectionStartTime: this.statistics.connectionStartTime,
    };
  }

  /**
   * Get rate limit config
   */
  getRateLimitConfig(): RateLimitConfig {
    return { ...this.rateLimitConfig };
  }

  /**
   * Set rate limit config
   */
  async setRateLimitConfig(config: Partial<RateLimitConfig>): Promise<void> {
    this.rateLimitConfig = { ...this.rateLimitConfig, ...config };
    await this.saveConfig();
  }

  /**
   * Get flood protection config
   */
  getFloodProtectionConfig(): FloodProtectionConfig {
    return { ...this.floodProtectionConfig };
  }

  /**
   * Set flood protection config
   */
  async setFloodProtectionConfig(config: Partial<FloodProtectionConfig>): Promise<void> {
    this.floodProtectionConfig = { ...this.floodProtectionConfig, ...config };
    await this.saveConfig();
  }

  /**
   * Get lag monitoring config
   */
  getLagMonitoringConfig(): LagMonitoringConfig {
    return { ...this.lagMonitoringConfig };
  }

  /**
   * Set lag monitoring config
   */
  async setLagMonitoringConfig(config: Partial<LagMonitoringConfig>): Promise<void> {
    this.lagMonitoringConfig = { ...this.lagMonitoringConfig, ...config };
    await this.saveConfig();

    // Restart monitoring if enabled
    if (this.lagMonitoringConfig.enabled && (this.ircService as any)?.isConnected) {
      this.startLagMonitoring();
    } else {
      this.stopLagMonitoring();
    }
  }

  /**
   * Listen for statistics updates
   */
  onStatisticsUpdate(callback: (stats: ConnectionStatistics) => void): () => void {
    this.statisticsListeners.push(callback);
    return () => {
      this.statisticsListeners = this.statisticsListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Listen for lag updates
   */
  onLagUpdate(callback: (lag: number, status: 'good' | 'warning' | 'timeout') => void): () => void {
    this.lagListeners.push(callback);
    return () => {
      this.lagListeners = this.lagListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify statistics listeners
   */
  private notifyStatisticsListeners(): void {
    const stats = this.getStatistics();
    this.statisticsListeners.forEach(callback => {
      try {
        callback(stats);
      } catch (error) {
        console.error('Error in statistics listener:', error);
      }
    });
  }

  /**
   * Notify lag listeners
   */
  private notifyLagListeners(lag: number, status: 'good' | 'warning' | 'timeout'): void {
    this.lagListeners.forEach(callback => {
      try {
        callback(lag, status);
      } catch (error) {
        console.error('Error in lag listener:', error);
      }
    });
  }

  /**
   * Save configuration
   */
  private async saveConfig(): Promise<void> {
    try {
      const data = {
        rateLimit: this.rateLimitConfig,
        floodProtection: this.floodProtectionConfig,
        lagMonitoring: this.lagMonitoringConfig,
      };
      await AsyncStorage.setItem(this.STATS_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save connection quality config:', error);
    }
  }
}

export const connectionQualityService = new ConnectionQualityService();
