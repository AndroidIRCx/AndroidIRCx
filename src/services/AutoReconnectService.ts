import AsyncStorage from '@react-native-async-storage/async-storage';
import { ircService, IRCConnectionConfig, IRCService } from './IRCService';
import { channelFavoritesService } from './ChannelFavoritesService';
import { bouncerService } from './BouncerService';
import { connectionManager } from './ConnectionManager';
import { IRCNetworkConfig } from './SettingsService';

export interface AutoReconnectConfig {
  enabled: boolean;
  maxAttempts?: number; // Maximum reconnection attempts (0 = unlimited)
  initialDelay?: number; // Initial delay in milliseconds (default: 1000ms)
  maxDelay?: number; // Maximum delay in milliseconds (default: 60000ms)
  backoffMultiplier?: number; // Exponential backoff multiplier (default: 2)
  rejoinChannels?: boolean; // Automatically rejoin channels after reconnect
  smartReconnect?: boolean; // Use smart reconnection to avoid flood
  minReconnectInterval?: number; // Minimum time between reconnects (default: 5000ms)
}

export interface ConnectionState {
  network: string;
  config: IRCConnectionConfig;
  networkConfig?: IRCNetworkConfig; // Network config for reconnection via ConnectionManager
  channels: string[]; // Channels we were in before disconnect
  lastConnected?: number;
  lastDisconnected?: number;
  reconnectAttempts: number;
}

class AutoReconnectService {
  private config: Map<string, AutoReconnectConfig> = new Map(); // network -> config
  private connectionStates: Map<string, ConnectionState> = new Map(); // network -> state
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map(); // network -> timer
  private isReconnecting: Map<string, boolean> = new Map(); // network -> is reconnecting
  private lastReconnectTime: Map<string, number> = new Map(); // network -> last reconnect timestamp
  private readonly STORAGE_KEY = '@AndroidIRCX:connectionStates';
  private readonly CONFIG_STORAGE_KEY = '@AndroidIRCX:autoReconnectConfigs';
  private connectionListeners: Map<string, () => void> = new Map(); // network -> cleanup function
  private messageListeners: Map<string, () => void> = new Map(); // network -> cleanup function

  /**
   * Initialize auto-reconnect service
   */
  async initialize(): Promise<void> {
    // Load persisted connection states
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.connectionStates = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Failed to load connection states:', error);
    }

    // Load persisted auto-reconnect configs
    try {
      const storedConfigs = await AsyncStorage.getItem(this.CONFIG_STORAGE_KEY);
      if (storedConfigs) {
        const data = JSON.parse(storedConfigs);
        this.config = new Map(Object.entries(data));
        console.log(`AutoReconnectService: Loaded ${this.config.size} auto-reconnect configs from storage`);
      }
    } catch (error) {
      console.error('Failed to load auto-reconnect configs:', error);
    }

    // Listen for connection changes on singleton service (backward compatibility)
    ircService.onConnectionChange((connected) => {
      const network = ircService.getNetworkName();
      if (network && network !== 'Not connected') {
        if (connected) {
          this.handleConnected(network);
        } else {
          this.handleDisconnected(network);
        }
      }
    });

    // Listen for channel joins/parts on singleton service (backward compatibility)
    ircService.onMessage((message) => {
      const network = ircService.getNetworkName();
      if (network && network !== 'Not connected') {
        if (message.type === 'join' && message.channel && message.from === ircService.getCurrentNick()) {
          this.addChannelToState(network, message.channel);
        } else if (message.type === 'part' && message.channel && message.from === ircService.getCurrentNick()) {
          this.removeChannelFromState(network, message.channel);
        } else if (message.type === 'mode' && message.text.includes('KICK') && message.text.includes(ircService.getCurrentNick())) {
          // This is a basic way to detect a kick, might need refinement
          const parts = message.text.split(' ');
          if (parts.length >= 4 && parts[2] === ircService.getCurrentNick()) {
            const channel = parts[1];
            this.removeChannelFromState(network, channel);
          }
        }
      }
    });

    console.log('AutoReconnectService: Initialized and ready to monitor connections');
  }

  /**
   * Register listeners for a specific connection (called by ConnectionManager)
   */
  registerConnection(networkId: string, ircServiceInstance: IRCService): void {
    // Clean up existing listeners if any
    this.unregisterConnection(networkId);

    console.log(`AutoReconnectService: Registering listeners for ${networkId}`);

    // Listen for connection changes
    const connectionCleanup = ircServiceInstance.onConnectionChange((connected) => {
      console.log(`AutoReconnectService: Connection change for ${networkId}: ${connected ? 'connected' : 'disconnected'}`);
      if (connected) {
        this.handleConnected(networkId);
      } else {
        this.handleDisconnected(networkId);
      }
    });

    // Listen for channel joins/parts
    const messageCleanup = ircServiceInstance.onMessage((message) => {
      const currentNick = ircServiceInstance.getCurrentNick();
      if (message.type === 'join' && message.channel && message.from === currentNick) {
        this.addChannelToState(networkId, message.channel);
      } else if (message.type === 'part' && message.channel && message.from === currentNick) {
        this.removeChannelFromState(networkId, message.channel);
      } else if (message.type === 'mode' && message.text.includes('KICK') && message.text.includes(currentNick)) {
        const parts = message.text.split(' ');
        if (parts.length >= 4 && parts[2] === currentNick) {
          const channel = parts[1];
          this.removeChannelFromState(networkId, channel);
        }
      }
    });

    this.connectionListeners.set(networkId, connectionCleanup);
    this.messageListeners.set(networkId, messageCleanup);
  }

  /**
   * Unregister listeners for a specific connection (called when connection is closed)
   */
  unregisterConnection(networkId: string): void {
    const connectionCleanup = this.connectionListeners.get(networkId);
    if (connectionCleanup) {
      connectionCleanup();
      this.connectionListeners.delete(networkId);
    }

    const messageCleanup = this.messageListeners.get(networkId);
    if (messageCleanup) {
      messageCleanup();
      this.messageListeners.delete(networkId);
    }

    console.log(`AutoReconnectService: Unregistered listeners for ${networkId}`);
  }

  /**
   * Handle successful connection
   */
  private handleConnected(network: string): void {
    // Clear reconnection state
    const state = this.connectionStates.get(network);
    if (state) {
      state.lastConnected = Date.now();
      state.reconnectAttempts = 0;
      this.connectionStates.set(network, state);
      this.saveConnectionStates();
    }

    // Clear reconnect timer
    const timer = this.reconnectTimers.get(network);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(network);
    }

    this.isReconnecting.set(network, false);

    // Rejoin channels or request playback if configured
    const config = this.config.get(network);
    const bouncerInfo = bouncerService.getBouncerInfo();

    if (config?.rejoinChannels && state?.channels) {
      if (bouncerInfo.playbackSupported) {
        console.log('AutoReconnectService: Bouncer with playback detected, requesting playback.');
        // Let the bouncer handle rejoining and message history
        setTimeout(() => {
          bouncerService.requestPlayback();
        }, 1000); // Small delay to ensure server is ready
      } else {
        // No bouncer or playback support, rejoin manually
        console.log('AutoReconnectService: No bouncer detected, rejoining channels manually.');
        setTimeout(() => {
          this.rejoinChannels(network, state.channels);
        }, 2000); // Wait 2 seconds after connection to rejoin
      }
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnected(network: string): void {
    console.log(`AutoReconnectService: handleDisconnected called for ${network}`);

    // Check if already reconnecting - prevent duplicate reconnect attempts
    if (this.isReconnecting.get(network)) {
      console.log(`AutoReconnectService: Already reconnecting ${network}, ignoring duplicate disconnect event`);
      return;
    }

    const config = this.config.get(network);
    if (!config || !config.enabled) {
      console.log(`AutoReconnectService: Auto-reconnect not enabled for ${network} (config: ${!!config}, enabled: ${config?.enabled})`);
      return;
    }

    const state = this.connectionStates.get(network);
    if (!state) {
      console.log(`AutoReconnectService: No connection state found for ${network}, cannot reconnect`);
      return;
    }

    // Check if we should attempt reconnection
    if (config.maxAttempts && state.reconnectAttempts >= config.maxAttempts) {
      console.log(`AutoReconnectService: Max attempts reached for ${network}`);
      return;
    }

    // Set reconnecting flag immediately to prevent duplicate attempts
    this.isReconnecting.set(network, true);

    console.log(`AutoReconnectService: Starting reconnect process for ${network} (attempt ${state.reconnectAttempts + 1})`);

    state.lastDisconnected = Date.now();
    this.connectionStates.set(network, state);
    this.saveConnectionStates();

    // Check smart reconnect (avoid flood)
    if (config.smartReconnect) {
      const lastReconnect = this.lastReconnectTime.get(network) || 0;
      const minInterval = config.minReconnectInterval || 5000;
      const timeSinceLastReconnect = Date.now() - lastReconnect;

      if (timeSinceLastReconnect < minInterval) {
        const waitTime = minInterval - timeSinceLastReconnect;
        console.log(`AutoReconnectService: Smart reconnect - waiting ${waitTime}ms to avoid flood`);
        setTimeout(() => {
          this.attemptReconnect(network);
        }, waitTime);
        return;
      }
    }

    this.attemptReconnect(network);
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private attemptReconnect(network: string): void {
    const config = this.config.get(network);
    const state = this.connectionStates.get(network);

    if (!config || !state) {
      console.error(`AutoReconnectService: Cannot reconnect ${network}, missing config or state`);
      this.isReconnecting.set(network, false);
      return;
    }

    this.lastReconnectTime.set(network, Date.now());

    // Calculate delay with exponential backoff
    const initialDelay = config.initialDelay || 1000;
    const maxDelay = config.maxDelay || 60000;
    const multiplier = config.backoffMultiplier || 2;
    const attempts = state.reconnectAttempts || 0;

    const delay = Math.min(
      initialDelay * Math.pow(multiplier, attempts),
      maxDelay
    );

    console.log(`AutoReconnectService: Attempting to reconnect to ${network} in ${delay}ms (attempt ${attempts + 1})`);

    const timer = setTimeout(async () => {
      try {
        state.reconnectAttempts = (state.reconnectAttempts || 0) + 1;
        this.connectionStates.set(network, state);
        this.saveConnectionStates();

        // Attempt reconnection via ConnectionManager if networkConfig is available
        if (state.networkConfig) {
          console.log(`AutoReconnectService: Reconnecting via ConnectionManager for ${network}`);
          const reconnectedId = await connectionManager.connect(network, state.networkConfig, state.config);
          // Ensure this connection is set as active
          connectionManager.setActiveConnection(reconnectedId);
          console.log(`AutoReconnectService: Reconnected to ${network} with ID ${reconnectedId}`);
          // Flag will be cleared by handleConnected when connection succeeds
        } else {
          // Fallback to singleton ircService for backward compatibility
          console.log(`AutoReconnectService: Reconnecting via singleton ircService for ${network}`);
          await ircService.connect(state.config);
          // Flag will be cleared by handleConnected when connection succeeds
        }
      } catch (error) {
        console.error(`AutoReconnectService: Reconnection failed for ${network}:`, error);
        this.isReconnecting.set(network, false);

        // Check if we should try again
        if (!config.maxAttempts || state.reconnectAttempts < config.maxAttempts) {
          // Try again with increased delay (will set isReconnecting again)
          this.handleDisconnected(network);
        } else {
          console.log(`AutoReconnectService: Max reconnect attempts reached for ${network}, giving up`);
        }
      }
    }, delay);

    this.reconnectTimers.set(network, timer);
  }

  /**
   * Rejoin channels after reconnection
   */
  private async rejoinChannels(network: string, channels: string[]): Promise<void> {
    console.log(`AutoReconnectService: Rejoining ${channels.length} channels for ${network}`);

    // Get IRCService instance from ConnectionManager
    const connection = connectionManager.getConnection(network);
    if (!connection) {
      console.error(`AutoReconnectService: Connection not found for ${network}, cannot rejoin channels`);
      return;
    }

    const ircServiceInstance = connection.ircService;

    // Extract base network name for multi-connection scenarios
    // "DBase (1)" -> "DBase", "DBase (2)" -> "DBase", "DBase" -> "DBase"
    const baseNetworkName = network.replace(/\s+\(\d+\)$/, '');

    // Get favorites with auto-join enabled - use base network name to ensure correct favorites
    const favorites = channelFavoritesService.getAutoJoinChannels(baseNetworkName);
    const favoriteChannels = favorites.map(f => ({ name: f.name, key: f.key }));

    // Combine with tracked channels
    const allChannels = new Map<string, string | undefined>();
    channels.forEach(ch => allChannels.set(ch, undefined));
    favoriteChannels.forEach(f => allChannels.set(f.name, f.key));

    // Rejoin with delay between each to avoid flood
    let delay = 0;
    for (const [channel, key] of allChannels) {
      setTimeout(() => {
        ircServiceInstance.joinChannel(channel, key);
      }, delay);
      delay += 1000; // 1 second between each join
    }
  }

  /**
   * Save connection state for a network
   */
  async saveConnectionState(network: string, config: IRCConnectionConfig, channels: string[], networkConfig?: IRCNetworkConfig): Promise<void> {
    const state: ConnectionState = {
      network,
      config,
      networkConfig,
      channels,
      lastConnected: Date.now(),
      reconnectAttempts: 0,
    };

    this.connectionStates.set(network, state);
    await this.saveConnectionStates();
  }

  /**
   * Update channels in connection state
   */
  addChannelToState(network: string, channel: string): void {
    const state = this.connectionStates.get(network);
    if (state) {
      if (!state.channels.includes(channel)) {
        state.channels.push(channel);
        this.connectionStates.set(network, state);
        this.saveConnectionStates();
      }
    }
  }

  /**
   * Remove channel from connection state
   */
  removeChannelFromState(network: string, channel: string): void {
    const state = this.connectionStates.get(network);
    if (state) {
      state.channels = state.channels.filter(c => c !== channel);
      this.connectionStates.set(network, state);
      this.saveConnectionStates();
    }
  }

  /**
   * Get connection state for a network
   */
  getConnectionState(network: string): ConnectionState | undefined {
    return this.connectionStates.get(network);
  }

  /**
   * Clear connection state for a network
   */
  async clearConnectionState(network: string): Promise<void> {
    this.connectionStates.delete(network);
    await this.saveConnectionStates();
  }

  /**
   * Configure auto-reconnect for a network
   */
  async setConfig(network: string, config: AutoReconnectConfig): Promise<void> {
    this.config.set(network, config);
    await this.saveConfigs();
  }

  /**
   * Get auto-reconnect config for a network
   */
  getConfig(network: string): AutoReconnectConfig | undefined {
    return this.config.get(network);
  }

  /**
   * Enable/disable auto-reconnect for a network
   */
  async setEnabled(network: string, enabled: boolean): Promise<void> {
    const config = this.config.get(network) || this.getDefaultConfig();
    config.enabled = enabled;
    this.config.set(network, config);
    await this.saveConfigs();
  }

  /**
   * Check if auto-reconnect is enabled for a network
   */
  isEnabled(network: string): boolean {
    const config = this.config.get(network);
    return config?.enabled || false;
  }

  /**
   * Get default config
   */
  private getDefaultConfig(): AutoReconnectConfig {
    return {
      enabled: true,
      maxAttempts: 10,
      initialDelay: 1000,
      maxDelay: 60000,
      backoffMultiplier: 2,
      rejoinChannels: true,
      smartReconnect: true,
      minReconnectInterval: 5000,
    };
  }

  /**
   * Cancel reconnection for a network
   */
  cancelReconnect(network: string): void {
    const timer = this.reconnectTimers.get(network);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(network);
    }
    this.isReconnecting.set(network, false);
  }

  /**
   * Save connection states to storage
   */
  private async saveConnectionStates(): Promise<void> {
    try {
      const data = Object.fromEntries(this.connectionStates);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save connection states:', error);
    }
  }

  /**
   * Save auto-reconnect configs to storage
   */
  private async saveConfigs(): Promise<void> {
    try {
      const data = Object.fromEntries(this.config);
      await AsyncStorage.setItem(this.CONFIG_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save auto-reconnect configs:', error);
    }
  }
}

export const autoReconnectService = new AutoReconnectService();