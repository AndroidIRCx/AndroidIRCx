/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { identityProfilesService } from './IdentityProfilesService';
import { secureStorageService } from './SecureStorageService';
import { storageCache } from './StorageCache';
import { tx } from '../i18n/transifex';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export interface IRCServerConfig {
  id: string;
  hostname: string;
  port: number;
  ssl: boolean;
  rejectUnauthorized?: boolean;
  password?: string;
  name?: string; // Display name for the server
  favorite?: boolean;
}

export type ProxyType = 'socks5' | 'http' | 'tor';

export interface ProxyConfig {
  enabled?: boolean;
  type: ProxyType;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export interface IRCNetworkConfig {
  id: string;
  name: string;
  nick: string;
  altNick?: string;
  realname: string;
  ident?: string; // Username/ident
  servers: IRCServerConfig[];
  defaultServerId?: string;
  autoJoinChannels?: string[];
  proxy?: ProxyConfig;
  sasl?: {
    account: string;
    password: string;
  };
  nickservPassword?: string;
  operUser?: string;
  operPassword?: string;
  identityProfileId?: string;
  connectionType?: 'irc' | 'znc' | 'bnc';
  clientCert?: string;
  clientKey?: string;
  connectOnStartup?: boolean;
}

const STORAGE_KEY = '@AndroidIRCX:networks';
const STORAGE_KEY_SETTINGS = '@AndroidIRCX:settings';
const STORAGE_KEY_DBASE_REMOVED = '@AndroidIRCX:dbaseRemoved';
const DEFAULT_SERVER_ID = 'dbase-default';
export const DEFAULT_SERVER: IRCServerConfig = {
  id: DEFAULT_SERVER_ID,
  hostname: 'irc.dbase.in.rs',
  port: 6697,
  ssl: true,
  rejectUnauthorized: true,
  name: 'irc.dbase.in.rs',
};
const DEFAULT_IDENTITY = {
  nick: 'AndroidIRCX',
  altNick: 'AndroidIRCX_',
  realname: 'AndroidIRCX User',
  ident: 'androidircx',
};

export const DEFAULT_PART_MESSAGE = t('AndroidIRCX - Download from https://androidircx.com');
export const DEFAULT_QUIT_MESSAGE = t('Goodbye from AndroidIRCX - download it from https://androidircx.com');

// Defaults for upcoming settings (Away/Protection/Writing/DCC/Topic styles).
// Keep ASCII only; values are placeholders until UI/services consume them.
export const NEW_FEATURE_DEFAULTS = {
  awayEnabled: false,
  awayNickPattern: '<me>^away',
  awayNotifyMentions: false,
  awayDeopOnChannels: false,
  awayAnnounceEnabled: false,
  awayAutoAnswerEnabled: false,
  awayAutoAnswerMessage: 'Away',
  awayDisableSounds: false,
  awayMultiServer: false,
  awayAutoAnswerMessages: [] as string[],
  awayPresets: [] as string[],
  awaySelectedPreset: '',
  awayDefaultReason: '',
  awayAnnounceEveryMin: 5,
  awayAnnounceOnlyOn: '',
  awayAnnounceExcludeOn: '',
  awayTextAway: 'away',
  awayTextReturn: 'back',
  autoAwayEnabled: false,
  autoAwayMinutes: 0,
  autoAwayReason: '',
  minimizeToTray: false,

  spamPmMode: 'when_open' as 'when_open' | 'always',
  spamPmKeywords: [
    '*entra*#*',
    '*www.*',
    '*http*',
    '*https*',
    '*join*#*',
    '*auto-msg*',
    '*inviter*',
    '*invite*',
    '*merhaba*',
    '*/*$*d*e*c*o*d*e*',
    '*w?w?w*',
    '*estoy*#*',
    '*discord.gg*',
    '*t.me*',
    '*telegram*',
    '*whatsapp*',
    '*bit.ly*',
    '*tinyurl*',
    '*goo.gl*',
    '*t.co*',
    '*click*here*',
  ],
  spamChannelEnabled: false,
  spamNoSpamOnQuits: false,
  spamLoggingEnabled: false,

  protCtcpFlood: false,
  protTextFlood: false,
  protDccFlood: false,
  protQueryFlood: false,
  protDosAttacks: false,
  protAntiDeopEnabled: false,
  protAntiDeopUseChanserv: false,
  protExcludeTokens: '',
  protEnforceSilence: false,
  protBlockTsunamis: false,
  protTextFloodNet: false,
  protIrcopAction: 'none' as 'none' | 'ban' | 'kill' | 'kline' | 'gline',
  protIrcopReason: 'Auto protection: spam/flood',
  protIrcopDuration: '1h',

  decorEnabled: false,
  decorUseColors: true,
  decorBold: false,
  decorUnderline: false,
  decorTextStyleId: '',
  decorColorStyleId: '',
  decorAdornmentId: '',
  decorStyles: [] as string[],
  decorStylesFileName: 'IRcapEstilos',

  nickCompleteEnabled: false,
  nickCompleteSeparator1: '',
  nickCompleteSeparator2: '',
  nickCompleteStyleId: '',
  nickCompleteStyles: [] as string[],

  topicStyleId: '',
  topicStyles: [] as string[],

  dccAutoGetMode: 'accept' as 'accept' | 'reject' | 'dont_send',
  dccAcceptExts: [
    '*.mid',
    '*.wav',
    '*.mp3',
    '*.vqf',
    '*.mpeg',
    '*.avi',
    '*.asf',
    '*.jpg',
    '*.gif',
    '*.wma',
    '*.png',
    '*.zip',
    '*.rar',
    '*.ogg',
  ],
  dccRejectExts: [
    'script.ini',
    '*.exe',
    '*.com',
    '*.bat',
    '*.vbs',
    '*.pif',
    '*.shs',
    '*.scr',
    '*.vbe',
    '*.hta',
  ],
  dccDontSendExts: [
    '*.ini',
    '*.cfg',
    '*.pwl',
    '*.cap',
    '*.ca8',
    '*.bat',
    '*.apk',
    '*.aab',
    '*.dex',
    '*.odex',
    '*.vdex',
    '*.keystore',
    '*.jks',
    '*.p12',
    '*.p8',
    '*.mobileprovision',
    '*.ipa',
    '*.app',
    '*.mobileconfig',
    '*.key',
    '*.pem',
    '*.cer',
    '*.der',
    '*.crt',
    '*.pfx',
  ],
  dccAutoChatFrom: 1,
  dccAutoGetFrom: 4,
  dccServeViewerAuto: false,
  dccCloseQueriesOnChat: false,
  dccRequestOnFail: false,
  dccAllowByIp: false,
  dccPassive: false,
  dccReplyQueueCommands: false,
  dccSendMaxKbps: 0,
  dccCancelAboveKbps: 0,
  dccDownloadFolder: '',

  // Ban settings
  defaultBanType: 2,           // 0-9, default: 2 (*!*@host)
  predefinedKickReasons: [
    'Spamming',
    'Flooding',
    'Abusive behavior',
    'Advertising',
    'Off-topic',
    'Trolling',
    'Harassment',
  ],
  showBanMaskPreview: true,    // Show preview in modal
  rememberLastBanType: false,  // Remember last used type
  confirmBeforeKickBan: true,  // Always show modal (default: true)

  // Channel list scroll tab switching
  channelListScrollSwitchTabs: false,
  channelListScrollSwitchTabsInverse: false,
};

class SettingsService {
  private networks: IRCNetworkConfig[] = [];
  private listeners: Map<string, ((value: any) => void)[]> = new Map();

  private buildDefaultServer(): IRCServerConfig {
    return { ...DEFAULT_SERVER, favorite: true };
  }

  private buildDefaultNetwork(identityProfileId?: string): IRCNetworkConfig {
    const defaultServer = this.buildDefaultServer();
    const androidircxServer: IRCServerConfig = {
      id: 'androidircx-default',
      hostname: 'irc.androidircx.com',
      port: 6697,
      ssl: true,
      rejectUnauthorized: true,
      name: 'irc.androidircx.com',
      favorite: true,
    };
    return {
      id: 'DBase',
      name: 'DBase',
      nick: DEFAULT_IDENTITY.nick,
      altNick: DEFAULT_IDENTITY.altNick,
      realname: DEFAULT_IDENTITY.realname,
      ident: DEFAULT_IDENTITY.ident,
      servers: [defaultServer, androidircxServer],
      defaultServerId: defaultServer.id,
      identityProfileId,
      autoJoinChannels: ['#AndroidIRCX', '#DBase'],
    };
  }

  private async ensureDefaults(networks: IRCNetworkConfig[]): Promise<{ networks: IRCNetworkConfig[]; updated: boolean }> {
    let updated = false;
    const hasDBase = networks.some(n => n.name === 'DBase');
    const dbaseRemovedByUser = (await storageCache.getItem<boolean>(STORAGE_KEY_DBASE_REMOVED, { ttl: 0 })) === true;
    let result = networks.map(n => ({ ...n }));
    if (!hasDBase && !dbaseRemovedByUser) {
      result = [...result, this.buildDefaultNetwork()];
      updated = true;
    }

    result = result.map(net => {
      const isDBaseNetwork = net.name === 'DBase' || net.id === 'DBase';

      // For DBase network, ensure default servers exist; for user networks, keep their servers as-is
      let servers = net.servers || [];

      if (isDBaseNetwork) {
        // For DBase network, ensure both default servers are present
        if (servers.length === 0) {
          servers = [this.buildDefaultServer()];
        }

        const hasDbServer = servers.some(s => s.hostname === 'irc.dbase.in.rs');
        const hasAndroidircxServer = servers.some(s => s.hostname === 'irc.androidircx.com');

        if (!hasDbServer) {
          servers = [...servers, this.buildDefaultServer()];
          updated = true;
        }
        if (!hasAndroidircxServer) {
          const androidircxServer: IRCServerConfig = {
            id: 'androidircx-default',
            hostname: 'irc.androidircx.com',
            port: 6697,
            ssl: true,
            rejectUnauthorized: true,
            name: 'irc.androidircx.com',
            favorite: true,
          };
          servers = [...servers, androidircxServer];
          updated = true;
        }
      }

      const patched: IRCNetworkConfig = {
        ...net,
        servers: servers.map(s => ({
          ...s,
          // Default to rejecting unauthorized certs unless user explicitly disabled
          rejectUnauthorized: s.rejectUnauthorized !== false,
        })),
        defaultServerId: net.defaultServerId,
        identityProfileId: net.identityProfileId,
        nick: net.nick || DEFAULT_IDENTITY.nick,
        altNick: net.altNick || DEFAULT_IDENTITY.altNick,
        realname: net.realname || DEFAULT_IDENTITY.realname,
        ident: net.ident || DEFAULT_IDENTITY.ident,
      };
      if (
        patched.defaultServerId !== net.defaultServerId ||
        servers.length !== (net.servers?.length || 0) ||
        patched.nick !== net.nick ||
        patched.altNick !== net.altNick ||
        patched.realname !== net.realname ||
        patched.ident !== net.ident
      ) {
        updated = true;
      }
      return patched;
    });

    return { networks: result, updated };
  }

  async loadNetworks(): Promise<IRCNetworkConfig[]> {
    try {
      // Use StorageCache for in-memory caching and faster access
      const loaded = await storageCache.getItem<IRCNetworkConfig[]>(STORAGE_KEY, {
        ttl: 5 * 60 * 1000, // Cache for 5 minutes
      });
      if (loaded) {
        const ensured = await this.ensureDefaults(loaded);
        const withSecrets = await this.applySecrets(ensured.networks);
        this.networks = withSecrets;
        if (ensured.updated || this.networks.length !== loaded.length) {
          await this.saveNetworks(this.networks);
        }
        return this.networks;
      }
      const ensured = await this.ensureDefaults([]);
      const withSecrets = await this.applySecrets(ensured.networks);
      this.networks = withSecrets;
      await this.saveNetworks(this.networks);
      return this.networks;
    } catch (error) {
      console.error('Error loading networks:', error);
      const ensured = await this.ensureDefaults([]);
      const withSecrets = await this.applySecrets(ensured.networks);
      return withSecrets;
    }
  }

  /**
   * Re-initialize the service by clearing the cache and reloading from storage.
   * This is useful after restoring from backup.
   */
  async reloadNetworks(): Promise<void> {
    // Clear in-memory cache only; do not delete persisted networks.
    storageCache.invalidate(STORAGE_KEY);
    this.networks = [];
    await this.loadNetworks();
  }

  async saveNetworks(networks: IRCNetworkConfig[]): Promise<void> {
    try {
      const sanitized = await this.persistAndSanitizeNetworks(networks);
      this.networks = sanitized;
      // Use StorageCache for automatic write batching (2s debounce)
      await storageCache.setItem(STORAGE_KEY, sanitized);
    } catch (error) {
      console.error('Error saving networks:', error);
      throw error;
    }
  }

  async addNetwork(network: IRCNetworkConfig): Promise<void> {
    const networks = await this.loadNetworks();
    networks.push(network);
    await this.saveNetworks(networks);
    if (network.id === 'DBase' || network.name === 'DBase') {
      await storageCache.setItem(STORAGE_KEY_DBASE_REMOVED, false);
    }
  }

  async updateNetwork(networkId: string, updates: Partial<IRCNetworkConfig>): Promise<void> {
    const networks = await this.loadNetworks();
    const index = networks.findIndex(n => n.id === networkId);
    if (index !== -1) {
      networks[index] = { ...networks[index], ...updates };
      await this.saveNetworks(networks);
    }
  }

  async deleteNetwork(networkId: string): Promise<void> {
    const networks = await this.loadNetworks();
    const deleted = networks.find(n => n.id === networkId);
    const filtered = networks.filter(n => n.id !== networkId);
    await this.saveNetworks(filtered);
    if (deleted && (deleted.id === 'DBase' || deleted.name === 'DBase')) {
      await storageCache.setItem(STORAGE_KEY_DBASE_REMOVED, true);
    }
  }

  async getNetwork(networkId: string): Promise<IRCNetworkConfig | null> {
    const networks = await this.loadNetworks();
    return networks.find(n => n.id === networkId) || null;
  }

  async getAllNetworks(): Promise<IRCNetworkConfig[]> {
    try {
      const networks = await this.loadNetworks();
      return networks;
    } catch (error) {
      console.error('Failed to get all networks:', error);
      return [];
    }
  }

  async getAllIdentityProfiles(): Promise<Array<{id: string, name: string}>> {
    try {
      const profiles = await identityProfilesService.list();
      return profiles.map(p => ({ id: p.id, name: p.name || p.nick }));
    } catch (error) {
      console.error('Failed to get identity profiles:', error);
      return [];
    }
  }

  async updateNetworkProfile(networkId: string, connectionType?: 'irc' | 'znc' | 'bnc', identityProfileId?: string | null): Promise<void> {
    try {
      const network = await this.getNetwork(networkId);
      if (network) {
        if (connectionType !== undefined) {
          network.connectionType = connectionType;
        }
        if (identityProfileId !== undefined) {
          network.identityProfileId = identityProfileId || undefined;
        }
        await this.updateNetwork(networkId, network);
      }
    } catch (error) {
      console.error('Failed to update network profile:', error);
      throw error;
    }
  }

  async addServerToNetwork(networkId: string, server: IRCServerConfig): Promise<void> {
    const networks = await this.loadNetworks();
    const network = networks.find(n => n.id === networkId);
    if (network) {
      const newServer = { ...server };
      network.servers.push(newServer);
      if (newServer.favorite) {
        network.servers = network.servers.map(s => ({
          ...s,
          favorite: s.id === newServer.id,
        }));
      }
      // Don't auto-set defaultServerId - let user explicitly mark server as default
      await this.saveNetworks(networks);
    }
  }

  async updateServerInNetwork(
    networkId: string,
    serverId: string,
    updates: Partial<IRCServerConfig>
  ): Promise<void> {
    const networks = await this.loadNetworks();
    const network = networks.find(n => n.id === networkId);
    if (network) {
      const server = network.servers.find(s => s.id === serverId);
      if (server) {
        Object.assign(server, updates);
        await this.persistServerSecret(networkId, server);
        if (updates.favorite) {
          network.servers = network.servers.map(s => ({
            ...s,
            favorite: s.id === serverId,
          }));
        } else if (updates.favorite === false && server.favorite) {
          server.favorite = false;
        }
        await this.saveNetworks(networks);
      }
    }
  }

  async deleteServerFromNetwork(networkId: string, serverId: string): Promise<void> {
    const networks = await this.loadNetworks();
    const network = networks.find(n => n.id === networkId);
    if (network) {
      network.servers = network.servers.filter(s => s.id !== serverId);
      // Clear defaultServerId if the deleted server was the default
      if (network.defaultServerId === serverId) {
        network.defaultServerId = network.servers[0]?.id || undefined;
      }
      await this.persistServerSecret(networkId, { id: serverId } as any, true);
      await this.saveNetworks(networks);
    }
  }

  async setDefaultServerForNetwork(networkId: string, serverId: string): Promise<void> {
    const networks = await this.loadNetworks();
    const network = networks.find(n => n.id === networkId);
    if (network) {
      const server = network.servers.find(s => s.id === serverId);
      if (server) {
        network.defaultServerId = serverId;
        await this.saveNetworks(networks);
      }
    }
  }

  async clearDefaultServerForNetwork(networkId: string, serverId: string): Promise<void> {
    const networks = await this.loadNetworks();
    const network = networks.find(n => n.id === networkId);
    if (network && network.defaultServerId === serverId) {
      network.defaultServerId = undefined;
      await this.saveNetworks(networks);
    }
  }

  async createDefaultNetwork(): Promise<IRCNetworkConfig> {
    const networks = await this.loadNetworks();
    const existing = networks.find(n => n.name === 'DBase');
    if (existing) return existing;

    const defaultNetwork = this.buildDefaultNetwork();
    networks.push(defaultNetwork);
    await this.saveNetworks(networks);
    await storageCache.setItem(STORAGE_KEY_DBASE_REMOVED, false);
    return defaultNetwork;
  }

  // Generic settings methods
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      // Use StorageCache for in-memory caching and faster access
      const data = await storageCache.getItem<T>(`${STORAGE_KEY_SETTINGS}:${key}`, {
        ttl: 10 * 60 * 1000, // Cache for 10 minutes
      });
      if (data !== null) {
        return data;
      }
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
    }
    return defaultValue;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    try {
      // Use StorageCache for automatic write batching (2s debounce)
      await storageCache.setItem(`${STORAGE_KEY_SETTINGS}:${key}`, value);
      this.notifyListeners(key, value);
    } catch (error) {
      console.error(`Error setting setting ${key}:`, error);
      throw error;
    }
  }

  onSettingChange<T>(key: string, callback: (value: T) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push(callback);

    return () => {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        this.listeners.set(key, keyListeners.filter(cb => cb !== callback));
      }
    };
  }

  private notifyListeners<T>(key: string, value: T): void {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(cb => {
        try {
          cb(value);
        } catch (error) {
          console.error(`Error in setting change listener for ${key}:`, error);
        }
      });
    }
  }

  private async persistAndSanitizeNetworks(networks: IRCNetworkConfig[]): Promise<IRCNetworkConfig[]> {
    const sanitized: IRCNetworkConfig[] = [];
    for (const net of networks) {
      await this.persistNetworkSecrets(net);
      sanitized.push(this.stripSecrets(net));
    }
    return sanitized;
  }

  private stripSecrets(network: IRCNetworkConfig): IRCNetworkConfig {
    return {
      ...network,
      nickservPassword: undefined,
      operPassword: undefined,
      sasl: network.sasl ? { account: network.sasl.account, password: undefined as any } : undefined,
      clientCert: undefined,
      clientKey: undefined,
      proxy: network.proxy ? { ...network.proxy, password: undefined } : undefined,
      servers: (network.servers || []).map(s => ({
        ...s,
        password: undefined,
      })),
    };
  }

  private async persistNetworkSecrets(network: IRCNetworkConfig): Promise<void> {
    const secretKey = (suffix: string) => `${network.id || network.name || 'network'}:${suffix}`;
    if (network.nickservPassword !== undefined) {
      await secureStorageService.setSecret(secretKey('nickservPassword'), network.nickservPassword);
    }
    if (network.operPassword !== undefined) {
      await secureStorageService.setSecret(secretKey('operPassword'), network.operPassword);
    }
    if (network.sasl?.password !== undefined) {
      await secureStorageService.setSecret(secretKey('saslPassword'), network.sasl.password);
    }
    if (network.clientCert !== undefined) {
      await secureStorageService.setSecret(secretKey('clientCert'), network.clientCert);
    }
    if (network.clientKey !== undefined) {
      await secureStorageService.setSecret(secretKey('clientKey'), network.clientKey);
    }
    if (network.proxy?.password !== undefined) {
      await secureStorageService.setSecret(secretKey('proxyPassword'), network.proxy.password);
    }
    for (const server of network.servers || []) {
      await this.persistServerSecret(network.id, server);
    }
  }

  private async persistServerSecret(networkId: string, server: IRCServerConfig, remove: boolean = false): Promise<void> {
    const key = `${networkId}:server:${server.id}`;
    if (remove) {
      await secureStorageService.removeSecret(key);
      return;
    }
    if (server.password !== undefined) {
      await secureStorageService.setSecret(key, server.password);
    }
  }

  private async applySecrets(networks: IRCNetworkConfig[]): Promise<IRCNetworkConfig[]> {
    const hydrated: IRCNetworkConfig[] = [];
    for (const net of networks) {
      const secretKey = (suffix: string) => `${net.id || net.name || 'network'}:${suffix}`;
      const [nickservPassword, operPassword, saslPassword, clientCert, clientKey, proxyPassword] = await Promise.all([
        secureStorageService.getSecret(secretKey('nickservPassword')),
        secureStorageService.getSecret(secretKey('operPassword')),
        secureStorageService.getSecret(secretKey('saslPassword')),
        secureStorageService.getSecret(secretKey('clientCert')),
        secureStorageService.getSecret(secretKey('clientKey')),
        secureStorageService.getSecret(secretKey('proxyPassword')),
      ]);
      const serversWithSecrets = await Promise.all(
        (net.servers || []).map(async (s) => {
          const pw = await secureStorageService.getSecret(`${net.id}:server:${s.id}`);
          return { ...s, password: pw || undefined };
        })
      );
      hydrated.push({
        ...net,
        nickservPassword: nickservPassword || undefined,
        operPassword: operPassword || undefined,
        sasl: net.sasl ? { ...net.sasl, password: saslPassword || undefined } : net.sasl,
        clientCert: clientCert || undefined,
        clientKey: clientKey || undefined,
        proxy: net.proxy ? { ...net.proxy, password: proxyPassword || undefined } : net.proxy,
        servers: serversWithSecrets,
      });
    }
    return hydrated;
  }

  // First run setup tracking
  async isFirstRun(): Promise<boolean> {
    try {
      // Use StorageCache for in-memory caching (this value never changes once set)
      const value = await storageCache.getItem<string>('FIRST_RUN_COMPLETED', {
        ttl: 60 * 60 * 1000, // Cache for 1 hour
      });
      return value !== 'true';
    } catch (error) {
      console.error('Error checking first run status:', error);
      return true; // Assume first run on error
    }
  }

  async setFirstRunCompleted(completed: boolean): Promise<void> {
    try {
      // Use StorageCache for automatic write batching (2s debounce)
      await storageCache.setItem('FIRST_RUN_COMPLETED', completed ? 'true' : 'false');
    } catch (error) {
      console.error('Error setting first run status:', error);
    }
  }
}

export const settingsService = new SettingsService();
