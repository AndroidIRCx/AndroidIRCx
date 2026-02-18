/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCService, IRCConnectionConfig } from './IRCService';
import { ChannelManagementService } from './ChannelManagementService';
import { UserManagementService } from './UserManagementService';
import { NotifyService } from './NotifyService';
import { ChannelListService } from './ChannelListService';
import { AutoRejoinService } from './AutoRejoinService';
import { AutoVoiceService } from './AutoVoiceService';
import { ConnectionQualityService } from './ConnectionQualityService';
import { BouncerService } from './BouncerService';
import { STSService } from './STSService';
import { CommandService } from './CommandService';
import { IRCNetworkConfig } from './SettingsService';
import { identityProfilesService } from './IdentityProfilesService';
import { autoReconnectService } from './AutoReconnectService';
import { ircForegroundService } from './IRCForegroundService';
import { tx } from '../i18n/transifex';
import { serviceDetectionService } from './ServiceDetectionService';
import { serviceCommandProvider } from './ServiceCommandProvider';
import { AutoAuthService, createAutoAuthService } from './AutoAuthService';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export interface ConnectionContext {
  networkId: string;
  ircService: IRCService;
  channelManagementService: ChannelManagementService;
  userManagementService: UserManagementService;
  notifyService: NotifyService;
  channelListService: ChannelListService;
  autoRejoinService: AutoRejoinService;
  autoVoiceService: AutoVoiceService;
  connectionQualityService: ConnectionQualityService;
  bouncerService: BouncerService;
  stsService: STSService;
  commandService: CommandService;
  autoAuthService: AutoAuthService;
  cleanupFunctions: Array<() => void>;
  serviceDetectionCleanup?: () => void;
  autoAuthCleanup?: () => void;
}

class ConnectionManager {
  private connections: Map<string, ConnectionContext> = new Map();
  private activeConnectionId: string | null = null;
  private connectionCreatedCallbacks: Array<(networkId: string) => void> = [];

  constructor() {
    //
  }

  /**
   * Subscribe to connection-created events
   * @param callback - Callback function called when a new connection is created
   * @returns Cleanup function to remove listener
   */
  public onConnectionCreated(callback: (networkId: string) => void): () => void {
    this.connectionCreatedCallbacks.push(callback);
    return () => {
      const index = this.connectionCreatedCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionCreatedCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Emit connection-created event to all listeners
   */
  private emitConnectionCreated(networkId: string): void {
    this.connectionCreatedCallbacks.forEach(callback => {
      try {
        callback(networkId);
      } catch (error) {
        console.error('ConnectionManager: Error in connection-created callback:', error);
      }
    });
  }

  private updateForegroundConnectionSummary(): void {
    if (!ircForegroundService.isServiceRunning()) {
      return;
    }
    const activeConnections = Array.from(this.connections.values()).filter(
      ctx => ctx.ircService.getConnectionStatus()
    );
    const count = activeConnections.length;
    if (count === 0) {
      ircForegroundService.stop().catch(err => {
        console.error('ConnectionManager: Failed to stop foreground service:', err);
      });
      return;
    }
    const names = activeConnections.map(ctx => ctx.networkId).filter(Boolean);
    const uniqueNames = Array.from(new Set(names));
    let suffix = '';
    if (uniqueNames.length > 0) {
      const trimmed = uniqueNames.slice(0, 3);
      suffix = ` (${trimmed.join(', ')}${uniqueNames.length > 3 ? ` +${uniqueNames.length - 3}` : ''})`;
    }
    const title = t('IRC Connected');
    const text = count <= 1
      ? t('Connected to {networkName}', { networkName: uniqueNames[0] || t('IRC server') })
      : t('Connected to {count} servers{suffix}', { count, suffix });
    ircForegroundService.updateNotification(title, text).catch(err => {
      console.error('ConnectionManager: Failed to update foreground notification:', err);
    });
  }

  public async connect(networkId: string, networkConfig: IRCNetworkConfig, connectionConfig: IRCConnectionConfig): Promise<string> {
    let finalId = networkId;
    const existing = this.connections.get(finalId);
    if (existing) {
      const isActive = existing.ircService.getConnectionStatus();
      if (isActive) {
        let suffix = 1;
        while (this.connections.has(`${networkId} (${suffix})`)) {
          suffix++;
        }
        finalId = `${networkId} (${suffix})`;
        console.log(`ConnectionManager: Connection to ${networkId} already exists and is active, using id ${finalId}`);
      } else {
        console.log(`ConnectionManager: Reusing disconnected connection slot for ${networkId}`);
        this.disconnect(finalId);
      }
    }

    console.log(`ConnectionManager: Creating new connection for ${finalId}`);
    console.log('ConnectionManager: Checking service imports...');
    console.log('IRCService:', typeof IRCService, IRCService);
    console.log('ChannelManagementService:', typeof ChannelManagementService, ChannelManagementService);
    console.log('UserManagementService:', typeof UserManagementService, UserManagementService);
    console.log('ChannelListService:', typeof ChannelListService, ChannelListService);
    console.log('AutoRejoinService:', typeof AutoRejoinService, AutoRejoinService);
    console.log('AutoVoiceService:', typeof AutoVoiceService, AutoVoiceService);
    console.log('ConnectionQualityService:', typeof ConnectionQualityService, ConnectionQualityService);
    console.log('BouncerService:', typeof BouncerService, BouncerService);
    console.log('STSService:', typeof STSService, STSService);
    console.log('CommandService:', typeof CommandService, CommandService);

    const ircService = new IRCService();
    ircService.setNetworkId(finalId);  // Set networkId FIRST so all messages have correct network!
    ircService.addRawMessage(t('*** Creating new connection for {networkId}', { networkId: finalId }), 'connection');
    const channelManagementService = new ChannelManagementService(ircService);
    const userManagementService = new UserManagementService();
    userManagementService.setIRCService(ircService);
    ircService.setUserManagementService(userManagementService);
    const notifyService = new NotifyService();
    notifyService.setIRCService(ircService);
    ircService.setNotifyService(notifyService);
    const channelListService = new ChannelListService(ircService);
    const autoRejoinService = new AutoRejoinService(ircService);
    const autoVoiceService = new AutoVoiceService(ircService);
    const connectionQualityService = new ConnectionQualityService();
    connectionQualityService.setIRCService(ircService);
    const bouncerService = new BouncerService(ircService);
    const stsService = new STSService();
    const commandService = new CommandService();
    commandService.setIRCService(ircService);

    // Track cleanup functions for proper resource management
    const cleanupFunctions: Array<() => void> = [];

    // Warn if TLS verification is disabled on any configured server
    const insecureServers = networkConfig.servers.filter(s => s.rejectUnauthorized === false);
    if (insecureServers.length > 0) {
      ircService.addRawMessage(
        t(
          '*** Warning: TLS certificate verification is disabled for this server. Enable "Reject unauthorized certificates" unless you trust this self-signed/expired cert.'
        ),
        'connection'
      );
    }

    // Ensure NickServ IDENTIFY runs for every connection, not just the active one
    const nickservPassword = networkConfig.nickservPassword?.trim();
    if (nickservPassword) {
      const motdEndCleanup = ircService.on('motdEnd', () => {
        try {
          ircService.sendRaw(`PRIVMSG NickServ :IDENTIFY ${nickservPassword}`);
          ircService.addRawMessage(t('*** Sending NickServ IDENTIFY...'), 'auth');
        } catch (error) {
          console.error(`ConnectionManager: Failed to send NickServ IDENTIFY for ${finalId}:`, error);
        }
      });
      // Store cleanup function if one was returned
      if (motdEndCleanup && typeof motdEndCleanup === 'function') {
        cleanupFunctions.push(motdEndCleanup);
      }
    }

    // Identity profile on-connect commands (after MOTD)
    const identityProfileId = networkConfig.identityProfileId;
    if (identityProfileId) {
      const motdCommandsCleanup = ircService.on('motdEnd', async () => {
        try {
          const profile = await identityProfilesService.get(identityProfileId);
          if (!profile) return;

          // Run OPER from identity profile only if network config doesn't already supply it
          if (!networkConfig.operPassword && profile.operPassword) {
            const operUser =
              profile.operUser?.trim() ||
              ircService.getCurrentNick() ||
              profile.nick ||
              networkConfig.nick;
            ircService.sendRaw(`OPER ${operUser} ${profile.operPassword}`);
          }

          const commands = (profile.onConnectCommands || []).filter(cmd => !!cmd && cmd.trim().length > 0);
          if (commands.length > 0) {
            commands.forEach(cmd => ircService.sendRaw(cmd));
            ircService.addRawMessage(
              t('*** Executed {count} on-connect command(s) from identity profile', { count: commands.length }),
              'connection'
            );
          }
        } catch (error) {
          console.error(`ConnectionManager: Failed to run identity on-connect commands for ${finalId}:`, error);
        }
      });
      if (motdCommandsCleanup && typeof motdCommandsCleanup === 'function') {
        cleanupFunctions.push(motdCommandsCleanup);
      }
    }

    // Initialize AutoAuthService
    console.log(`ConnectionManager: Initializing auto-auth for ${finalId}`);
    const autoAuthService = createAutoAuthService({
      networkId: finalId,
      ircService,
      authConfig: {
        nickservPassword: networkConfig.nickservPassword,
        saslAccount: networkConfig.sasl?.account,
        saslPassword: networkConfig.sasl?.password,
        clientCert: connectionConfig.clientCert,
        saslForce: networkConfig.sasl?.force,
      },
      saslAvailable: false, // Will be updated when CAP negotiation completes
      saslAuthenticated: false,
    });

    const context: ConnectionContext = {
      networkId: finalId,
      ircService,
      channelManagementService,
      userManagementService,
      notifyService,
      channelListService,
      autoRejoinService,
      autoVoiceService,
      connectionQualityService,
      bouncerService,
      stsService,
      commandService,
      autoAuthService,
      cleanupFunctions,
    };

    // Initialize services
    console.log(`ConnectionManager: Initializing services for ${finalId}`);
    ircService.addRawMessage(t('*** Initializing services for {networkId}', { networkId: finalId }), 'connection');
    userManagementService.initialize();
    notifyService.initialize?.();
    channelManagementService.initialize();
    autoRejoinService.initialize();
    autoVoiceService.initialize();
    connectionQualityService.initialize();
    bouncerService.initialize();
    commandService.initialize();
    autoAuthService.initialize?.();

    // Initialize service detection
    console.log(`ConnectionManager: Initializing service detection for ${finalId}`);
    serviceDetectionService.initializeNetwork(finalId);
    
    // Subscribe to service detection events
    const detectionCleanup = serviceDetectionService.onDetection((networkId, result) => {
      if (networkId === finalId) {
        console.log(`ConnectionManager: Service detected for ${finalId}:`, result);
        ircService.addRawMessage(
          t('*** Detected services: {serviceType} (confidence: {confidence}%)', {
            serviceType: result.serviceType,
            confidence: Math.round(result.confidence * 100),
          }),
          'server'
        );
        
        // Trigger auto-authentication when services are detected
        if (!autoAuthService.isAuthenticated()) {
          autoAuthService.authenticate().then(authResult => {
            if (authResult.success) {
              console.log(`ConnectionManager: Auto-authenticated using ${authResult.method}`);
            } else if (authResult.error) {
              console.log(`ConnectionManager: Auto-auth not attempted: ${authResult.error}`);
            }
          }).catch(error => {
            console.error(`ConnectionManager: Auto-auth error:`, error);
          });
        }
      }
    });
    context.serviceDetectionCleanup = detectionCleanup;

    // Set up 005 ISUPPORT handling for service detection
    const isupportCleanup = ircService.on('rawMessage', (data: { prefix: string; command: string; params: string[] }) => {
      if (data.command === '005') {
        // RPL_ISUPPORT: Parse tokens for service detection
        const tokens = data.params.slice(1, -1); // Skip nick and trailing
        serviceDetectionService.processISupport(finalId, tokens);
        
        // Look for NETWORK token
        for (const token of tokens) {
          if (token.startsWith('NETWORK=')) {
            const networkName = token.slice(8);
            serviceDetectionService.processNetworkName(finalId, networkName);
          }
        }
      }
    });
    cleanupFunctions.push(isupportCleanup);

    // Handle welcome message (001) for network name detection
    const welcomeCleanup = ircService.on('welcome', (data: { networkName?: string }) => {
      if (data.networkName) {
        serviceDetectionService.processNetworkName(finalId, data.networkName);
      }
    });
    cleanupFunctions.push(welcomeCleanup);

    // Handle SASL authentication events
    const saslSuccessCleanup = ircService.on('sasl-success', () => {
      console.log(`ConnectionManager: SASL authentication successful for ${finalId}`);
      autoAuthService.updateSaslStatus(ircService.isSaslAvailable(), true);
    });
    cleanupFunctions.push(saslSuccessCleanup);

    const saslFailCleanup = ircService.on('sasl-fail', () => {
      console.log(`ConnectionManager: SASL authentication failed for ${finalId}`);
      // Trigger fallback authentication if SASL fails
      if (!autoAuthService.isAuthenticated()) {
        autoAuthService.authenticate().catch(error => {
          console.error(`ConnectionManager: Fallback auth error:`, error);
        });
      }
    });
    cleanupFunctions.push(saslFailCleanup);

    this.connections.set(finalId, context);
    this.setActiveConnection(finalId);

    // Register with AutoReconnectService for automatic reconnection
    console.log(`ConnectionManager: Registering ${finalId} with AutoReconnectService`);
    autoReconnectService.registerConnection(finalId, ircService);

    console.log(`ConnectionManager: Connecting to IRC server for ${finalId}`);
    ircService.addRawMessage(t('*** Connecting to IRC server for {networkId}', { networkId: finalId }), 'connection');
    await ircService.connect(connectionConfig);

    // Emit event to notify listeners that a new connection was created
    // This allows useConnectionLifecycle to re-attach event listeners to the new IRCService instance
    console.log(`ConnectionManager: Emitting connection-created event for ${finalId}`);
    this.emitConnectionCreated(finalId);
    this.updateForegroundConnectionSummary();

    return finalId;
  }

  public disconnect(networkId: string, message?: string): void {
    const connection = this.connections.get(networkId);
    if (connection) {
      console.log(`ConnectionManager: Cleaning up resources for ${networkId}`);

      // Unregister from AutoReconnectService
      console.log(`ConnectionManager: Unregistering ${networkId} from AutoReconnectService`);
      autoReconnectService.unregisterConnection(networkId);

      // Clean up services that have destroy methods
      try {
        if (connection.autoRejoinService && typeof connection.autoRejoinService.destroy === 'function') {
          connection.autoRejoinService.destroy();
        }
      } catch (error) {
        console.error(`ConnectionManager: Error destroying autoRejoinService for ${networkId}:`, error);
      }

      // Clean up all event listeners and resources
      try {
        connection.cleanupFunctions.forEach(cleanup => {
          try {
            cleanup();
          } catch (error) {
            console.error(`ConnectionManager: Error during cleanup for ${networkId}:`, error);
          }
        });
      } catch (error) {
        console.error(`ConnectionManager: Error running cleanup functions for ${networkId}:`, error);
      }

      // Clean up service detection
      if (connection.serviceDetectionCleanup) {
        try {
          connection.serviceDetectionCleanup();
        } catch (error) {
          console.error(`ConnectionManager: Error cleaning up service detection for ${networkId}:`, error);
        }
      }
      
      // Clean up auto-auth service
      if (connection.autoAuthService) {
        try {
          connection.autoAuthService.destroy();
        } catch (error) {
          console.error(`ConnectionManager: Error cleaning up auto-auth for ${networkId}:`, error);
        }
      }
      
      serviceDetectionService.cleanupNetwork(networkId);
      serviceCommandProvider.clearCache(networkId);

      // Disconnect IRC service
      connection.ircService.disconnect(message);

      // Remove from connections map
      this.connections.delete(networkId);

      // Update active connection if needed
      if (this.activeConnectionId === networkId) {
        this.activeConnectionId = this.connections.keys().next().value || null;
      }
      this.updateForegroundConnectionSummary();
    }
  }

  public getConnection(networkId: string): ConnectionContext | undefined {
    return this.connections.get(networkId);
  }

  public getActiveConnection(): ConnectionContext | undefined {
    if (!this.activeConnectionId) {
      return undefined;
    }
    return this.connections.get(this.activeConnectionId);
  }

  public setActiveConnection(networkId: string): void {
    if (this.connections.has(networkId)) {
      this.activeConnectionId = networkId;
    }
  }

  public getAllConnections(): ConnectionContext[] {
    return Array.from(this.connections.values());
  }

  public getActiveNetworkId(): string | null {
    return this.activeConnectionId;
  }

  public hasConnection(networkId: string): boolean {
    return this.connections.has(networkId);
  }

  public disconnectAll(message?: string): void {
    console.log('ConnectionManager: Disconnecting all connections');
    // Create array copy to avoid modifying collection while iterating
    const networkIds = Array.from(this.connections.keys());
    networkIds.forEach((networkId) => {
      this.disconnect(networkId, message);
    });
  }

  /**
   * Clear all connections and reset state (for kill switch)
   */
  public clearAll(): void {
    console.log('ConnectionManager: Clearing all connections');
    this.disconnectAll('Kill switch activated');
    this.connections.clear();
    this.activeConnectionId = null;
  }
}

export const connectionManager = new ConnectionManager();
