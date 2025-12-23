import { IRCService, IRCConnectionConfig } from './IRCService';
import { ChannelManagementService } from './ChannelManagementService';
import { UserManagementService } from './UserManagementService';
import { ChannelListService } from './ChannelListService';
import { AutoRejoinService } from './AutoRejoinService';
import { AutoVoiceService } from './AutoVoiceService';
import { ConnectionQualityService } from './ConnectionQualityService';
import { BouncerService } from './BouncerService';
import { STSService } from './STSService';
import { CommandService } from './CommandService';
import { IRCNetworkConfig } from './SettingsService';
import { identityProfilesService } from './IdentityProfilesService';

export interface ConnectionContext {
  networkId: string;
  ircService: IRCService;
  channelManagementService: ChannelManagementService;
  userManagementService: UserManagementService;
  channelListService: ChannelListService;
  autoRejoinService: AutoRejoinService;
  autoVoiceService: AutoVoiceService;
  connectionQualityService: ConnectionQualityService;
  bouncerService: BouncerService;
  stsService: STSService;
  commandService: CommandService;
  cleanupFunctions: Array<() => void>;
}

class ConnectionManager {
  private connections: Map<string, ConnectionContext> = new Map();
  private activeConnectionId: string | null = null;

  constructor() {
    //
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
    ircService.addRawMessage(`*** Creating new connection for ${finalId}`, 'connection');
    ircService.setNetworkId(finalId);
    const channelManagementService = new ChannelManagementService(ircService);
    const userManagementService = new UserManagementService();
    userManagementService.setIRCService(ircService);
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
        '*** Warning: TLS certificate verification is disabled for this server. Enable "Reject unauthorized certificates" unless you trust this self-signed/expired cert.',
        'connection'
      );
    }

    // Ensure NickServ IDENTIFY runs for every connection, not just the active one
    const nickservPassword = networkConfig.nickservPassword?.trim();
    if (nickservPassword) {
      const motdEndCleanup = ircService.on('motdEnd', () => {
        try {
          ircService.sendRaw(`PRIVMSG NickServ :IDENTIFY ${nickservPassword}`);
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
            ircService.addRawMessage(`*** Executed ${commands.length} on-connect command(s) from identity profile`, 'connection');
          }
        } catch (error) {
          console.error(`ConnectionManager: Failed to run identity on-connect commands for ${networkConfig.identityProfileId}:`, error);
        }
      });
      if (motdCommandsCleanup && typeof motdCommandsCleanup === 'function') {
        cleanupFunctions.push(motdCommandsCleanup);
      }
    }

    const context: ConnectionContext = {
      networkId: finalId,
      ircService,
      channelManagementService,
      userManagementService,
      channelListService,
      autoRejoinService,
      autoVoiceService,
      connectionQualityService,
      bouncerService,
      stsService,
      commandService,
      cleanupFunctions,
    };

    // Initialize services
    console.log(`ConnectionManager: Initializing services for ${finalId}`);
    ircService.addRawMessage(`*** Initializing services for ${finalId}`, 'connection');
    userManagementService.initialize();
    channelManagementService.initialize();
    autoRejoinService.initialize();
    autoVoiceService.initialize();
    connectionQualityService.initialize();
    bouncerService.initialize();
    commandService.initialize();

    this.connections.set(finalId, context);
    this.setActiveConnection(finalId);

    console.log(`ConnectionManager: Connecting to IRC server for ${finalId}`);
    ircService.addRawMessage(`*** Connecting to IRC server for ${finalId}`, 'connection');
    await ircService.connect(connectionConfig);
    return finalId;
  }

  public disconnect(networkId: string, message?: string): void {
    const connection = this.connections.get(networkId);
    if (connection) {
      console.log(`ConnectionManager: Cleaning up resources for ${networkId}`);

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

      // Disconnect IRC service
      connection.ircService.disconnect(message);

      // Remove from connections map
      this.connections.delete(networkId);

      // Update active connection if needed
      if (this.activeConnectionId === networkId) {
        this.activeConnectionId = this.connections.keys().next().value || null;
      }
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
}

export const connectionManager = new ConnectionManager();
