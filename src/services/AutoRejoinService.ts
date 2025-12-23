import { IRCService } from './IRCService';

interface AutoRejoinConfig {
  enabled: boolean;
  delay?: number; // Delay in milliseconds before rejoining
  maxAttempts?: number; // Maximum rejoin attempts per channel
}

export class AutoRejoinService {
  private ircService: IRCService;
  private config: Map<string, AutoRejoinConfig> = new Map(); // network -> config
  private rejoinAttempts: Map<string, number> = new Map(); // channel -> attempts
  private kickedChannels: Set<string> = new Set(); // Channels we were kicked from
  private manuallyLeftChannels: Set<string> = new Set(); // Channels we deliberately left
  private cleanupFunctions: Array<() => void> = [];
  private rejoinTimers: Map<string, NodeJS.Timeout> = new Map(); // channel -> timer

  constructor(ircService: IRCService) {
    this.ircService = ircService;
  }

  /**
   * Initialize auto-rejoin service
   */
  initialize(): void {
    const kickCleanup = this.ircService.on('kick', (channel: string) => this.handleKick(channel));
    const joinCleanup = this.ircService.on('joinedChannel', (channel: string) => this.handleJoin(channel));
    const partCleanup = this.ircService.on('part', (channel: string, nick: string) => this.handlePart(channel, nick));

    // Store cleanup functions
    if (kickCleanup && typeof kickCleanup === 'function') {
      this.cleanupFunctions.push(kickCleanup);
    }
    if (joinCleanup && typeof joinCleanup === 'function') {
      this.cleanupFunctions.push(joinCleanup);
    }
    if (partCleanup && typeof partCleanup === 'function') {
      this.cleanupFunctions.push(partCleanup);
    }
  }

  /**
   * Cleanup resources and remove event listeners
   */
  destroy(): void {
    // Clear all pending timers
    this.rejoinTimers.forEach((timer, channel) => {
      clearTimeout(timer);
    });
    this.rejoinTimers.clear();

    // Remove all event listeners
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('AutoRejoinService: Error during cleanup:', error);
      }
    });
    this.cleanupFunctions = [];

    // Clear state
    this.kickedChannels.clear();
    this.rejoinAttempts.clear();
    this.manuallyLeftChannels.clear();
  }

  /**
   * Handle KICK message (called from IRCService)
   */
  handleKick(channel: string): void {
    // If we deliberately left, skip auto rejoin
    if (this.manuallyLeftChannels.has(channel)) {
      this.kickedChannels.delete(channel);
      this.rejoinAttempts.delete(channel);
      return;
    }

    const network = this.ircService.getNetworkName();
    const config = this.config.get(network);

    if (!config || !config.enabled) {
      return;
    }

    this.kickedChannels.add(channel);
    const attempts = this.rejoinAttempts.get(channel) || 0;
    const maxAttempts = config.maxAttempts || 3;

    if (attempts >= maxAttempts) {
      console.log(`AutoRejoinService: Max attempts reached for ${channel}`);
      return;
    }

    const delay = config.delay || 2000; // Default 2 seconds

    // Clear any existing timer for this channel
    const existingTimer = this.rejoinTimers.get(channel);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer and store reference
    const timer = setTimeout(() => {
      if (this.kickedChannels.has(channel)) {
        console.log(`AutoRejoinService: Attempting to rejoin ${channel}`);
        this.ircService.joinChannel(channel);
        this.rejoinAttempts.set(channel, attempts + 1);
      }
      // Remove timer reference after it fires
      this.rejoinTimers.delete(channel);
    }, delay);

    this.rejoinTimers.set(channel, timer);
  }

  /**
   * Handle successful join (clear kick state)
   */
  handleJoin(channel: string): void {
    // Clear any pending rejoin timer
    const timer = this.rejoinTimers.get(channel);
    if (timer) {
      clearTimeout(timer);
      this.rejoinTimers.delete(channel);
    }

    this.kickedChannels.delete(channel);
    this.rejoinAttempts.delete(channel);
    this.manuallyLeftChannels.delete(channel);
  }

  /**
   * Handle PART messages for our own nick to avoid rejoining after manual leave
   */
  private handlePart(channel: string, nick: string): void {
    const currentNick = this.ircService.getCurrentNick();
    if (nick && nick === currentNick) {
      this.manuallyLeftChannels.add(channel);
      this.kickedChannels.delete(channel);
      this.rejoinAttempts.delete(channel);
    }
  }

  /**
   * Configure auto-rejoin for a network
   */
  setConfig(network: string, config: AutoRejoinConfig): void {
    this.config.set(network, config);
  }

  /**
   * Get auto-rejoin config for a network
   */
  getConfig(network: string): AutoRejoinConfig | undefined {
    return this.config.get(network);
  }

  /**
   * Enable/disable auto-rejoin for a network
   */
  setEnabled(network: string, enabled: boolean): void {
    const config = this.config.get(network) || { enabled: false };
    config.enabled = enabled;
    this.config.set(network, config);
  }

  /**
   * Check if auto-rejoin is enabled for a network
   */
  isEnabled(network: string): boolean {
    const config = this.config.get(network);
    return config?.enabled || false;
  }
}

const { ircService } = require('./IRCService');
export const autoRejoinService = new AutoRejoinService(ircService);

