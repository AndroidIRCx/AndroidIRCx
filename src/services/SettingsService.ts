import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PROFILE_ID, identityProfilesService } from './IdentityProfilesService';
import { secureStorageService } from './SecureStorageService';

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

export const DEFAULT_PART_MESSAGE = 'AndroidIRCX - Download from https://androidircx.com';
export const DEFAULT_QUIT_MESSAGE = 'Goodbye from AndroidIRCX - download it from https://androidircx.com';

class SettingsService {
  private networks: IRCNetworkConfig[] = [];
  private listeners: Map<string, ((value: any) => void)[]> = new Map();

  private buildDefaultServer(): IRCServerConfig {
    return { ...DEFAULT_SERVER, favorite: true };
  }

  private buildDefaultNetwork(identityProfileId: string = DEFAULT_PROFILE_ID): IRCNetworkConfig {
    const defaultServer = this.buildDefaultServer();
    return {
      id: 'DBase',
      name: 'DBase',
      nick: DEFAULT_IDENTITY.nick,
      altNick: DEFAULT_IDENTITY.altNick,
      realname: DEFAULT_IDENTITY.realname,
      ident: DEFAULT_IDENTITY.ident,
      servers: [defaultServer],
      defaultServerId: defaultServer.id,
      identityProfileId,
    };
  }

  private async ensureDefaults(networks: IRCNetworkConfig[]): Promise<{ networks: IRCNetworkConfig[]; updated: boolean }> {
    const defaultProfile = await identityProfilesService.getDefaultProfile();
    let updated = false;
    const hasDBase = networks.some(n => n.name === 'DBase');
    let result = networks.map(n => ({ ...n }));
    if (!hasDBase) {
      result = [...result, this.buildDefaultNetwork(defaultProfile.id)];
      updated = true;
    }

    result = result.map(net => {
      const servers = net.servers && net.servers.length > 0 ? net.servers : [this.buildDefaultServer()];
      const patched: IRCNetworkConfig = {
        ...net,
        servers: servers.map(s => ({
          ...s,
          // Default to rejecting unauthorized certs unless user explicitly disabled
          rejectUnauthorized: s.rejectUnauthorized !== false,
        })),
        defaultServerId: net.defaultServerId || servers[0]?.id || DEFAULT_SERVER_ID,
        identityProfileId: net.identityProfileId || defaultProfile.id,
        nick: net.nick || defaultProfile.nick,
        altNick: net.altNick || defaultProfile.altNick,
        realname: net.realname || defaultProfile.realname || DEFAULT_IDENTITY.realname,
        ident: net.ident || defaultProfile.ident || DEFAULT_IDENTITY.ident,
      };
      if (
        patched.identityProfileId !== net.identityProfileId ||
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
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const loaded = JSON.parse(data);
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

  async saveNetworks(networks: IRCNetworkConfig[]): Promise<void> {
    try {
      const sanitized = await this.persistAndSanitizeNetworks(networks);
      this.networks = sanitized;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (error) {
      console.error('Error saving networks:', error);
      throw error;
    }
  }

  async addNetwork(network: IRCNetworkConfig): Promise<void> {
    const networks = await this.loadNetworks();
    networks.push(network);
    await this.saveNetworks(networks);
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
    const filtered = networks.filter(n => n.id !== networkId);
    await this.saveNetworks(filtered);
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

  async updateNetworkProfile(networkId: string, connectionType?: 'irc' | 'znc' | 'bnc', identityProfileId?: string): Promise<void> {
    try {
      const network = await this.getNetwork(networkId);
      if (network) {
        if (connectionType !== undefined) {
          network.connectionType = connectionType;
        }
        if (identityProfileId !== undefined) {
          network.identityProfileId = identityProfileId;
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
      if (!network.defaultServerId) {
        network.defaultServerId = newServer.id;
      }
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
      await this.persistServerSecret(networkId, { id: serverId } as any, true);
      await this.saveNetworks(networks);
    }
  }

  async createDefaultNetwork(): Promise<IRCNetworkConfig> {
    const networks = await this.loadNetworks();
    const existing = networks.find(n => n.name === 'DBase');
    if (existing) return existing;

    const defaultProfile = await identityProfilesService.getDefaultProfile();
    const defaultNetwork = this.buildDefaultNetwork(defaultProfile.id);
    networks.push(defaultNetwork);
    await this.saveNetworks(networks);
    return defaultNetwork;
  }

  // Generic settings methods
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY_SETTINGS}:${key}`);
      if (data !== null) {
        return JSON.parse(data) as T;
      }
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
    }
    return defaultValue;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(`${STORAGE_KEY_SETTINGS}:${key}`, JSON.stringify(value));
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
}

export const settingsService = new SettingsService();
