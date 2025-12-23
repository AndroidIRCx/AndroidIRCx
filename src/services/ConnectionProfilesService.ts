import AsyncStorage from '@react-native-async-storage/async-storage';
import { IRCNetworkConfig, IRCServerConfig } from './SettingsService';

export interface ConnectionProfile {
  id: string;
  name: string;
  description?: string;
  network: IRCNetworkConfig;
  isTemplate: boolean;
  templateCategory?: string; // e.g., 'gaming', 'tech', 'general'
  createdAt: number;
  lastUsed?: number;
  useCount: number;
}

export interface ProfileTemplate {
  name: string;
  description: string;
  category: string;
  network: Omit<IRCNetworkConfig, 'id'>;
}

class ConnectionProfilesService {
  private profiles: ConnectionProfile[] = [];
  private listeners: Array<(profiles: ConnectionProfile[]) => void> = [];
  private readonly STORAGE_KEY = '@AndroidIRCX:connectionProfiles';

  // Built-in templates
  private readonly TEMPLATES: ProfileTemplate[] = [
    {
      name: 'Freenode',
      description: 'Freenode IRC network',
      category: 'general',
      network: {
        name: 'Freenode',
        nick: 'YourNick',
        realname: 'Your Name',
        servers: [
          {
            id: 'freenode-1',
            hostname: 'chat.freenode.net',
            port: 6697,
            ssl: true,
            rejectUnauthorized: false,
          },
        ],
      },
    },
    {
      name: 'Libera Chat',
      description: 'Libera Chat IRC network',
      category: 'general',
      network: {
        name: 'Libera Chat',
        nick: 'YourNick',
        realname: 'Your Name',
        servers: [
          {
            id: 'libera-1',
            hostname: 'irc.libera.chat',
            port: 6697,
            ssl: true,
            rejectUnauthorized: false,
          },
        ],
      },
    },
    {
      name: 'Rizon',
      description: 'Rizon IRC network',
      category: 'gaming',
      network: {
        name: 'Rizon',
        nick: 'YourNick',
        realname: 'Your Name',
        servers: [
          {
            id: 'rizon-1',
            hostname: 'irc.rizon.net',
            port: 6697,
            ssl: true,
            rejectUnauthorized: false,
          },
        ],
      },
    },
    {
      name: 'QuakeNet',
      description: 'QuakeNet IRC network',
      category: 'gaming',
      network: {
        name: 'QuakeNet',
        nick: 'YourNick',
        realname: 'Your Name',
        servers: [
          {
            id: 'quakenet-1',
            hostname: 'irc.quakenet.org',
            port: 6667,
            ssl: false,
          },
        ],
      },
    },
    {
      name: 'OFTC',
      description: 'OFTC IRC network',
      category: 'tech',
      network: {
        name: 'OFTC',
        nick: 'YourNick',
        realname: 'Your Name',
        servers: [
          {
            id: 'oftc-1',
            hostname: 'irc.oftc.net',
            port: 6697,
            ssl: true,
            rejectUnauthorized: false,
          },
        ],
      },
    },
  ];

  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.profiles = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load connection profiles:', error);
      this.profiles = [];
    }
  }

  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.profiles));
    } catch (error) {
      console.error('Failed to save connection profiles:', error);
    }
  }

  /**
   * Create a profile from a network configuration
   */
  async createProfile(
    name: string,
    network: IRCNetworkConfig,
    description?: string,
    isTemplate: boolean = false,
    templateCategory?: string
  ): Promise<ConnectionProfile> {
    const profile: ConnectionProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      network: { ...network },
      isTemplate,
      templateCategory,
      createdAt: Date.now(),
      useCount: 0,
    };

    this.profiles.push(profile);
    await this.save();
    this.notifyListeners();
    return profile;
  }

  /**
   * Create a profile from a template
   */
  async createFromTemplate(template: ProfileTemplate, name?: string): Promise<ConnectionProfile> {
    const network: IRCNetworkConfig = {
      ...template.network,
      id: `network_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    return this.createProfile(
      name || template.name,
      network,
      template.description,
      false,
      template.category
    );
  }

  /**
   * Update a profile
   */
  async updateProfile(profileId: string, updates: Partial<ConnectionProfile>): Promise<boolean> {
    const index = this.profiles.findIndex(p => p.id === profileId);
    if (index === -1) {
      return false;
    }

    this.profiles[index] = {
      ...this.profiles[index],
      ...updates,
    };

    await this.save();
    this.notifyListeners();
    return true;
  }

  /**
   * Delete a profile
   */
  async deleteProfile(profileId: string): Promise<boolean> {
    const index = this.profiles.findIndex(p => p.id === profileId);
    if (index === -1) {
      return false;
    }

    this.profiles.splice(index, 1);
    await this.save();
    this.notifyListeners();
    return true;
  }

  /**
   * Get all profiles
   */
  getProfiles(): ConnectionProfile[] {
    return [...this.profiles];
  }

  /**
   * Get a profile by ID
   */
  getProfile(profileId: string): ConnectionProfile | undefined {
    return this.profiles.find(p => p.id === profileId);
  }

  /**
   * Get profiles by category
   */
  getProfilesByCategory(category: string): ConnectionProfile[] {
    return this.profiles.filter(p => p.templateCategory === category);
  }

  /**
   * Get user-created profiles (non-templates)
   */
  getUserProfiles(): ConnectionProfile[] {
    return this.profiles.filter(p => !p.isTemplate);
  }

  /**
   * Get templates
   */
  getTemplates(): ProfileTemplate[] {
    return [...this.TEMPLATES];
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): ProfileTemplate[] {
    return this.TEMPLATES.filter(t => t.category === category);
  }

  /**
   * Mark profile as used (increment use count and update last used)
   */
  async markProfileUsed(profileId: string): Promise<void> {
    const profile = this.profiles.find(p => p.id === profileId);
    if (profile) {
      profile.useCount = (profile.useCount || 0) + 1;
      profile.lastUsed = Date.now();
      await this.save();
      this.notifyListeners();
    }
  }

  /**
   * Get most used profiles
   */
  getMostUsedProfiles(limit: number = 5): ConnectionProfile[] {
    return [...this.profiles]
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      .slice(0, limit);
  }

  /**
   * Get recently used profiles
   */
  getRecentlyUsedProfiles(limit: number = 5): ConnectionProfile[] {
    return [...this.profiles]
      .filter(p => p.lastUsed)
      .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
      .slice(0, limit);
  }

  /**
   * Listen for profile changes
   */
  onProfilesChange(callback: (profiles: ConnectionProfile[]) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.profiles));
  }
}

export const connectionProfilesService = new ConnectionProfilesService();

