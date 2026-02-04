/**
 * BanService - Handles ban mask generation and kick/ban operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BanMaskType {
  id: number;
  pattern: string;
  description: string;
  example: string;
}

export const BAN_MASK_TYPES: BanMaskType[] = [
  { id: 0, pattern: '*!user@host', description: 'Ban by user@host', example: '*!john@192.168.1.1' },
  { id: 1, pattern: '*!*user@host', description: 'Ban by *user@host', example: '*!*john@192.168.1.1' },
  { id: 2, pattern: '*!*@host', description: 'Ban by host only', example: '*!*@192.168.1.1' },
  { id: 3, pattern: '*!*user@*.host', description: 'Ban by *user@*.domain', example: '*!*john@*.example.com' },
  { id: 4, pattern: '*!*@*.host', description: 'Ban by *.domain only', example: '*!*@*.example.com' },
  { id: 5, pattern: 'nick!user@host', description: 'Ban exact nick!user@host', example: 'John!john@192.168.1.1' },
  { id: 6, pattern: 'nick!*user@host', description: 'Ban nick with *user@host', example: 'John!*john@192.168.1.1' },
  { id: 7, pattern: 'nick!*@host', description: 'Ban nick with any user@host', example: 'John!*@192.168.1.1' },
  { id: 8, pattern: 'nick!*user@*.host', description: 'Ban nick with *user@*.domain', example: 'John!*john@*.example.com' },
  { id: 9, pattern: 'nick!*@*.host', description: 'Ban nick with *.domain', example: 'John!*@*.example.com' },
  { id: 10, pattern: 'nick!*@*', description: 'Ban by nick only (any ident@host)', example: 'John!*@*' },
  { id: 11, pattern: '*!ident@*', description: 'Ban by ident only (any nick@host)', example: '*!john@*' },
];

export interface KickBanOptions {
  channel: string;
  nick: string;
  user?: string;      // ident/username
  host?: string;      // hostname/IP
  banType: number;    // 0-9
  reason?: string;
  kick: boolean;
  unbanAfterSeconds?: number;  // -uN switch
  listType?: 'b' | 'e' | 'I' | 'q';  // ban/except/invite/quiet
}

export interface PredefinedReason {
  id: string;
  text: string;
  isDefault?: boolean;
}

const STORAGE_KEY = '@AndroidIRCX:banReasons';
const DEFAULT_REASONS: PredefinedReason[] = [
  { id: 'spam', text: 'Spamming', isDefault: true },
  { id: 'flood', text: 'Flooding', isDefault: true },
  { id: 'abuse', text: 'Abusive behavior', isDefault: true },
  { id: 'advertising', text: 'Advertising', isDefault: true },
  { id: 'offtopic', text: 'Off-topic', isDefault: true },
  { id: 'troll', text: 'Trolling', isDefault: true },
  { id: 'bot', text: 'Unauthorized bot', isDefault: true },
  { id: 'impersonation', text: 'Impersonation', isDefault: true },
  { id: 'harassment', text: 'Harassment', isDefault: true },
  { id: 'language', text: 'Inappropriate language', isDefault: true },
];

class BanService {
  private predefinedReasons: PredefinedReason[] = [...DEFAULT_REASONS];
  private defaultBanType: number = 2;  // *!*@host
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Generate ban mask from user info
   */
  generateBanMask(nick: string, user: string, host: string, banType: number): string {
    // Handle IP addresses - replace last octet with *
    const processedHost = this.processHost(host, banType);
    const processedUser = user.startsWith('~') ? user.slice(1) : user;

    switch (banType) {
      case 0: return `*!${processedUser}@${host}`;
      case 1: return `*!*${processedUser}@${host}`;
      case 2: return `*!*@${host}`;
      case 3: return `*!*${processedUser}@${processedHost}`;
      case 4: return `*!*@${processedHost}`;
      case 5: return `${nick}!${processedUser}@${host}`;
      case 6: return `${nick}!*${processedUser}@${host}`;
      case 7: return `${nick}!*@${host}`;
      case 8: return `${nick}!*${processedUser}@${processedHost}`;
      case 9: return `${nick}!*@${processedHost}`;
      case 10: return `${nick}!*@*`;  // Ban by nick only
      case 11: return `*!${processedUser}@*`;  // Ban by ident only
      default: return `*!*@${host}`;
    }
  }

  /**
   * Process host for wildcard domain matching (types 3,4,8,9)
   */
  private processHost(host: string, banType: number): string {
    if (![3, 4, 8, 9].includes(banType)) return host;

    // Check if IP address
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      // Replace last octet with *
      return host.replace(/\.\d+$/, '.*');
    }

    // Domain - add *. prefix
    const parts = host.split('.');
    if (parts.length >= 2) {
      return '*.' + parts.slice(-2).join('.');
    }
    return '*.' + host;
  }

  /**
   * Initialize BanService and load saved reasons from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.predefinedReasons = parsed;
          }
        }
      } catch (error) {
        console.error('Failed to load ban reasons from storage:', error);
        // Keep defaults on error
      } finally {
        this.initialized = true;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Save reasons to AsyncStorage
   */
  private async saveReasons(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.predefinedReasons));
    } catch (error) {
      console.error('Failed to save ban reasons to storage:', error);
    }
  }

  getPredefinedReasons(): PredefinedReason[] {
    return [...this.predefinedReasons];
  }

  async setPredefinedReasons(reasons: PredefinedReason[]): Promise<void> {
    this.predefinedReasons = [...reasons];
    await this.saveReasons();
  }

  async addPredefinedReason(reason: PredefinedReason): Promise<void> {
    this.predefinedReasons.push(reason);
    await this.saveReasons();
  }

  async removePredefinedReason(id: string): Promise<void> {
    this.predefinedReasons = this.predefinedReasons.filter(r => r.id !== id);
    await this.saveReasons();
  }

  /**
   * Reset reasons to defaults
   */
  async resetToDefaultReasons(): Promise<void> {
    this.predefinedReasons = [...DEFAULT_REASONS];
    await this.saveReasons();
  }

  getDefaultBanType(): number {
    return this.defaultBanType;
  }

  setDefaultBanType(type: number): void {
    if (type >= 0 && type <= 11) {
      this.defaultBanType = type;
    }
  }

  getBanMaskTypes(): BanMaskType[] {
    return BAN_MASK_TYPES;
  }
}

export const banService = new BanService();