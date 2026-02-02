/**
 * BanService - Handles ban mask generation and kick/ban operations
 */

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

class BanService {
  private predefinedReasons: PredefinedReason[] = [
    { id: 'spam', text: 'Spamming' },
    { id: 'flood', text: 'Flooding' },
    { id: 'abuse', text: 'Abusive behavior' },
    { id: 'advertising', text: 'Advertising' },
    { id: 'offtopic', text: 'Off-topic' },
    { id: 'troll', text: 'Trolling' },
    { id: 'bot', text: 'Unauthorized bot' },
    { id: 'impersonation', text: 'Impersonation' },
    { id: 'harassment', text: 'Harassment' },
    { id: 'language', text: 'Inappropriate language' },
  ];

  private defaultBanType: number = 2;  // *!*@host

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

  getPredefinedReasons(): PredefinedReason[] {
    return [...this.predefinedReasons];
  }

  setPredefinedReasons(reasons: PredefinedReason[]): void {
    this.predefinedReasons = reasons;
  }

  addPredefinedReason(reason: PredefinedReason): void {
    this.predefinedReasons.push(reason);
  }

  removePredefinedReason(id: string): void {
    this.predefinedReasons = this.predefinedReasons.filter(r => r.id !== id);
  }

  getDefaultBanType(): number {
    return this.defaultBanType;
  }

  setDefaultBanType(type: number): void {
    if (type >= 0 && type <= 9) {
      this.defaultBanType = type;
    }
  }

  getBanMaskTypes(): BanMaskType[] {
    return BAN_MASK_TYPES;
  }
}

export const banService = new BanService();