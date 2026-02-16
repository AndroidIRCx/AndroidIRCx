/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * UserManagementService
 * 
 * Manages user-related data including WHOIS information, ignore lists, user notes, and aliases.
 * Handles user mode tracking and provides methods to query and manage user information.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { IRCService } from './IRCService';
import { tx } from '../i18n/transifex';
import { decodeIfBase64Like } from '../utils/Base64Utils';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export interface WHOISInfo {
  nick: string;
  username?: string;
  hostname?: string;
  realname?: string;
  server?: string;
  serverInfo?: string;
  account?: string;
  away?: boolean;
  awayMessage?: string;
  idle?: number; // seconds
  signon?: number; // timestamp
  channels?: string[];
  network?: string;
  lastUpdated: number;
}

export interface WHOWASInfo {
  nick: string;
  username?: string;
  hostname?: string;
  realname?: string;
  server?: string;
  signoff?: number; // timestamp
  network?: string;
  lastUpdated: number;
}

export interface UserNote {
  nick: string;
  note: string;
  network?: string;
  updatedAt: number;
}

export interface UserAlias {
  nick: string;
  alias: string;
  network?: string;
  updatedAt: number;
}

export interface IgnoredUser {
  mask: string; // e.g., "nick!user@host" or just "nick"
  network?: string;
  addedAt: number;
  reason?: string;
}

export type BlacklistActionType =
  | 'ignore'
  | 'ban'
  | 'kick_ban'
  | 'kill'
  | 'os_kill'
  | 'akill'
  | 'gline'
  | 'shun'
  | 'custom';

export interface BlacklistEntry {
  mask: string; // e.g., "nick!user@host" or just "nick"
  action: BlacklistActionType;
  network?: string;
  addedAt: number;
  reason?: string;
  duration?: string; // for gline/akill/shun (e.g., "1d", "7d", "0" for permanent)
  commandTemplate?: string; // for custom action
}

export class UserManagementService {
  private ircService: IRCService | null = null;

  constructor() {
    // IRCService will be set later
  }

  setIRCService(ircService: IRCService): void {
    this.ircService = ircService;
    this.setupIRCListeners();
  }

  private setupIRCListeners(): void {
    if (!this.ircService) return;

    // Listen for WHOIS/WHOWAS numeric replies
    this.ircService.on('numeric', (numeric: number, prefix: string, params: string[], timestamp: number) => {
      this.handleNumericReply(numeric, prefix, params, timestamp);
    });
  }

  private handleNumericReply(numeric: number, prefix: string, params: string[], timestamp: number): void {
    const network = this.ircService?.getNetworkName() || this.currentNetwork;

    switch (numeric) {
      // WHOIS responses
      case 311: // RPL_WHOISUSER
        const whoisNick = params[1];
        const username = params[2];
        const hostname = params[3];
        const realname = decodeIfBase64Like(params[5] || '');
        this.updateWHOIS({ nick: whoisNick, username, hostname, realname }, network);
        break;

      case 312: // RPL_WHOISSERVER
        const serverNick = params[1];
        const server = params[2];
        const serverInfo = params[3];
        this.updateWHOIS({ nick: serverNick, server, serverInfo }, network);
        break;

      case 313: // RPL_WHOISOPERATOR
        const operNick = params[1];
        this.updateWHOIS({ nick: operNick, isOperator: true }, network);
        break;

      case 317: // RPL_WHOISIDLE
        const idleNick = params[1];
        const idle = parseInt(params[2], 10);
        const signon = parseInt(params[3], 10) * 1000; // Convert to milliseconds
        this.updateWHOIS({ nick: idleNick, idle, signon }, network);
        break;

      case 318: // RPL_ENDOFWHOIS
        const endNick = params[1];
        console.log(`UserManagementService: End of WHOIS for ${endNick}`);
        this.finalizeWHOIS(endNick, network);
        break;

      case 319: // RPL_WHOISCHANNELS
        const channelsNick = params[1];
        const channels = params[2]?.split(' ').filter(c => c) || [];
        this.updateWHOIS({ nick: channelsNick, channels }, network);
        break;

      case 330: // RPL_WHOISACCOUNT (on some networks)
        const accountNick = params[1];
        const account = params[2];
        this.updateWHOIS({ nick: accountNick, account }, network);
        break;

      case 301: // RPL_AWAY
        const awayNick = params[1];
        const awayMessage = params[2];
        this.updateWHOIS({ nick: awayNick, away: true, awayMessage }, network);
        break;

      // WHOWAS responses
      case 314: // RPL_WHOWASUSER
        const whowasNick = params[1];
        const whowasUser = params[2];
        const whowasHost = params[3];
        const whowasReal = decodeIfBase64Like(params[5] || '');
        this.updateWHOWAS({ nick: whowasNick, username: whowasUser, hostname: whowasHost, realname: whowasReal, lastSeen: Date.now() }, network);
        break;

      case 369: // RPL_ENDOFWHOWAS
        const endWhowasNick = params[1];
        this.finalizeWHOWAS(endWhowasNick, network);
        break;
    }
  }

  private readonly STORAGE_PREFIX = '@AndroidIRCX:users:';
  private readonly WHOIS_PREFIX = 'whois:';
  private readonly WHOWAS_PREFIX = 'whowas:';
  private readonly NOTES_PREFIX = 'notes:';
  private readonly ALIASES_PREFIX = 'aliases:';
  private readonly IGNORE_PREFIX = 'ignore:';
  private readonly BLACKLIST_PREFIX = 'blacklist:';
  
  private whoisCache: Map<string, WHOISInfo> = new Map(); // network:nick -> info
  private whowasCache: Map<string, WHOWASInfo[]> = new Map(); // network:nick -> info[]
  private userNotes: Map<string, UserNote> = new Map(); // network:nick -> note
  private userAliases: Map<string, UserAlias> = new Map(); // network:nick -> alias
  private ignoredUsers: Map<string, IgnoredUser> = new Map(); // network:mask -> ignored
  private blacklistedUsers: Map<string, BlacklistEntry> = new Map(); // network:mask -> entry
  
  private whoisListeners: ((info: WHOISInfo) => void)[] = [];
  private whowasListeners: ((info: WHOWASInfo) => void)[] = [];
  // private currentWhoisNick: string | null = null; // No longer needed
  // private currentWhowasNick: string | null = null; // No longer needed
  private currentNetwork: string = '';
  private pendingWhoisResolvers: Map<string, (value: WHOISInfo | PromiseLike<WHOISInfo>) => void> = new Map(); // key -> resolve function
  private whoisRequestQueue: Map<string, { nick: string; network: string; resolve: (value: WHOISInfo | PromiseLike<WHOISInfo>) => void; reject: (reason?: any) => void; timeout: NodeJS.Timeout }> = new Map();
  private WHOIS_TIMEOUT = 20000; // 20 seconds

  /**
   * Initialize user management service
   */
  async initialize(): Promise<void> {
    await this.loadFromStorage();
    console.log('UserManagementService: Initialized');
    if (this.ircService) {
      this.ircService.addRawMessage(t('*** UserManagementService initialized'), 'debug');
    }
  }

  /**
   * Load data from storage
   */
  private async loadFromStorage(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter(key => key.startsWith(this.STORAGE_PREFIX));
      
      for (const key of userKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          
          if (key.includes(this.NOTES_PREFIX)) {
            const note: UserNote = parsed;
            this.userNotes.set(note.network ? `${note.network}:${note.nick}` : note.nick, note);
          } else if (key.includes(this.ALIASES_PREFIX)) {
            const alias: UserAlias = parsed;
            this.userAliases.set(alias.network ? `${alias.network}:${alias.nick}` : alias.nick, alias);
          } else if (key.includes(this.IGNORE_PREFIX)) {
            const ignored: IgnoredUser = parsed;
            this.ignoredUsers.set(ignored.network ? `${ignored.network}:${ignored.mask}` : ignored.mask, ignored);
          } else if (key.includes(this.BLACKLIST_PREFIX)) {
            const entry: BlacklistEntry = parsed;
            this.blacklistedUsers.set(entry.network ? `${entry.network}:${entry.mask}` : entry.mask, entry);
          }
        }
      }
    } catch (error) {
      console.error('UserManagementService: Error loading from storage:', error);
    }
  }

  /**
   * Save to storage
   */
  private async saveToStorage(key: string, data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('UserManagementService: Error saving to storage:', error);
    }
  }

  /**
   * Remove from storage
   */
  private async removeFromStorage(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('UserManagementService: Error removing from storage:', error);
    }
  }

  /**
   * Set current network
   */
  setNetwork(network: string): void {
    this.currentNetwork = network;
  }

  /**
   * Request WHOIS information
   */
  async requestWHOIS(nick: string, network?: string): Promise<WHOISInfo> {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${nick}` : nick;

    // Clear any stale WHOIS info first to ensure fresh data
    this.whoisCache.delete(key);

    return new Promise((resolve, reject) => {
      // If a request is already pending for this nick/network, return its promise
      if (this.whoisRequestQueue.has(key)) {
        this.whoisRequestQueue.get(key)?.reject(
          new Error(t('New WHOIS request for same nick, cancelling previous.'))
        );
        this.whoisRequestQueue.delete(key);
      }

      const timeout = setTimeout(() => {
        this.whoisRequestQueue.delete(key);
        reject(new Error(t('WHOIS request for {nick} timed out.', { nick })));
        // Also remove the WHOIS info from cache if it's still incomplete
        const info = this.whoisCache.get(key);
        if (info && !info.realname) { // Simple check for incomplete data
          this.whoisCache.delete(key);
        }
      }, this.WHOIS_TIMEOUT);

      this.whoisRequestQueue.set(key, { nick, network: net, resolve, reject, timeout });
      
      // Send the WHOIS command through IRCService
      this.ircService?.sendCommand(`WHOIS ${nick}`);
    });
  }

  /**
   * Finalize WHOIS information (called by IRCService when RPL_ENDOFWHOIS is received)
   */
  finalizeWHOIS(nick: string, network?: string): void {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${nick}` : nick;
    const pending = this.whoisRequestQueue.get(key);

    if (pending) {
      clearTimeout(pending.timeout);
      this.whoisRequestQueue.delete(key);
      const finalInfo = this.whoisCache.get(key);
      if (finalInfo) {
        pending.resolve(finalInfo);
      } else {
        pending.reject(new Error(t('WHOIS data for {nick} not found after completion signal.', { nick })));
      }
    }
  }

  /**
   * Request WHOWAS information
   */
  requestWHOWAS(nick: string, network?: string, count?: number): void {
    const net = network || this.currentNetwork;
    if (!this.ircService) {
      console.warn('UserManagementService: Cannot send WHOWAS - no IRC service available');
      return;
    }
    // this.currentWhowasNick = nick; // No longer needed
    const command = count ? `WHOWAS ${nick} ${count}` : `WHOWAS ${nick}`;
    this.ircService.sendCommand(command);
  }

  /**
   * Update WHOIS information (called by IRCService when receiving WHOIS replies)
   */
  updateWHOIS(info: Partial<WHOISInfo>, network?: string): void {
    const net = network || this.currentNetwork;
    const nick = info.nick || '';
    if (!nick) return;

    const key = net ? `${net}:${nick}` : nick;
    const existing = this.whoisCache.get(key) || {
      nick,
      network: net,
      lastUpdated: Date.now(),
    };

    const updated: WHOISInfo = {
      ...existing,
      ...info,
      nick,
      network: net,
      lastUpdated: Date.now(),
    };

    this.whoisCache.set(key, updated);
    this.emitWHOISUpdate(updated);
  }

  /**
   * Update WHOWAS information
   */
  updateWHOWAS(info: Partial<WHOWASInfo>, network?: string): void {
    const net = network || this.currentNetwork;
    const nick = info.nick || '';
    if (!nick) return;

    const key = net ? `${net}:${nick}` : nick;
    const existing = this.whowasCache.get(key) || [];
    
    const newInfo: WHOWASInfo = {
      ...info,
      nick,
      network: net,
      lastUpdated: Date.now(),
    } as WHOWASInfo;

    // Add to history (keep last 10)
    existing.unshift(newInfo);
    if (existing.length > 10) {
      existing.pop();
    }
    
    this.whowasCache.set(key, existing);
    this.emitWHOWASUpdate(newInfo);
  }

  /**
   * Finalize WHOWAS information (called when RPL_ENDOFWHOWAS is received)
   */
  finalizeWHOWAS(nick: string, network?: string): void {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${nick}` : nick;
    const whowasData = this.whowasCache.get(key);

    console.log(`UserManagementService: WHOWAS completed for ${nick}${whowasData ? ` (${whowasData.length} entries)` : ' (no data)'}`);
    // WHOWAS doesn't use promises like WHOIS, so no queue to resolve
    // Data is already in cache and listeners have been notified via updateWHOWAS
  }

  /**
   * Get WHOIS information
   */
  getWHOIS(nick: string, network?: string): WHOISInfo | undefined {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${nick}` : nick;
    return this.whoisCache.get(key);
  }

  /**
   * Get WHOWAS information
   */
  getWHOWAS(nick: string, network?: string): WHOWASInfo[] {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${nick}` : nick;
    return this.whowasCache.get(key) || [];
  }

  /**
   * Add user note
   */
  async addUserNote(nick: string, note: string, network?: string): Promise<void> {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${nick}` : nick;
    
    const userNote: UserNote = {
      nick,
      note,
      network: net,
      updatedAt: Date.now(),
    };
    
    this.userNotes.set(key, userNote);
    const storageKey = `${this.STORAGE_PREFIX}${this.NOTES_PREFIX}${key}`;
    await this.saveToStorage(storageKey, userNote);
  }

  /**
   * Get user note
   */
  getUserNote(nick: string, network?: string): string | undefined {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${nick}` : nick;
    return this.userNotes.get(key)?.note;
  }

  /**
   * Remove user note
   */
  async removeUserNote(nick: string, network?: string): Promise<void> {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${nick}` : nick;
    this.userNotes.delete(key);
    const storageKey = `${this.STORAGE_PREFIX}${this.NOTES_PREFIX}${key}`;
    await this.removeFromStorage(storageKey);
  }

  /**
   * List user notes (optionally filtered by network)
   */
  getUserNotes(network?: string): UserNote[] {
    const entries = Array.from(this.userNotes.values());
    if (!network) return entries;
    return entries.filter(note => note.network === network);
  }

  /**
   * Add user alias
   */
  async addUserAlias(nick: string, alias: string, network?: string): Promise<void> {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${nick}` : nick;
    
    const userAlias: UserAlias = {
      nick,
      alias,
      network: net,
      updatedAt: Date.now(),
    };
    
    this.userAliases.set(key, userAlias);
    const storageKey = `${this.STORAGE_PREFIX}${this.ALIASES_PREFIX}${key}`;
    await this.saveToStorage(storageKey, userAlias);
  }

  /**
   * Get user alias
   */
  getUserAlias(nick: string, network?: string): string | undefined {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${nick}` : nick;
    return this.userAliases.get(key)?.alias;
  }

  /**
   * Get nick from alias
   */
  getNickFromAlias(alias: string, network?: string): string | undefined {
    const net = network || this.currentNetwork;
    for (const [key, userAlias] of this.userAliases.entries()) {
      if (userAlias.alias === alias && (!net || userAlias.network === net)) {
        return userAlias.nick;
      }
    }
    return undefined;
  }

  /**
   * Remove user alias
   */
  async removeUserAlias(nick: string, network?: string): Promise<void> {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${nick}` : nick;
    this.userAliases.delete(key);
    const storageKey = `${this.STORAGE_PREFIX}${this.ALIASES_PREFIX}${key}`;
    await this.removeFromStorage(storageKey);
  }

  /**
   * List user aliases (optionally filtered by network)
   */
  getUserAliases(network?: string): UserAlias[] {
    const entries = Array.from(this.userAliases.values());
    if (!network) return entries;
    return entries.filter(alias => alias.network === network);
  }

  /**
   * Ignore user
   */
  async ignoreUser(mask: string, reason?: string, network?: string): Promise<void> {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${mask}` : mask;
    
    const ignored: IgnoredUser = {
      mask,
      network: net,
      addedAt: Date.now(),
      reason,
    };
    
    this.ignoredUsers.set(key, ignored);
    const storageKey = `${this.STORAGE_PREFIX}${this.IGNORE_PREFIX}${key}`;
    await this.saveToStorage(storageKey, ignored);
  }

  /**
   * Unignore user
   */
  async unignoreUser(mask: string, network?: string): Promise<void> {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${mask}` : mask;
    this.ignoredUsers.delete(key);
    const storageKey = `${this.STORAGE_PREFIX}${this.IGNORE_PREFIX}${key}`;
    await this.removeFromStorage(storageKey);
  }

  /**
   * Check if user is ignored
   */
  isUserIgnored(nick: string, username?: string, hostname?: string, network?: string): boolean {
    const net = network || this.currentNetwork;
    
    // Check exact nick match
    if (this.ignoredUsers.has(net ? `${net}:${nick}` : nick)) {
      return true;
    }
    
    // Check mask patterns
    for (const [key, ignored] of this.ignoredUsers.entries()) {
      if (net && !key.startsWith(`${net}:`)) continue;
      if (!net && key.includes(':')) continue; // Skip network-specific if no network
      
      const mask = ignored.mask;
      
      // Simple pattern matching
      if (mask.includes('!') && mask.includes('@')) {
        // Full mask: nick!user@host
        const [maskNick, maskUserHost] = mask.split('!');
        const [maskUser, maskHost] = maskUserHost.split('@');
        
        if (maskNick === '*' || maskNick === nick) {
          if (maskUser === '*' || (username && maskUser === username)) {
            if (maskHost === '*' || (hostname && hostname.includes(maskHost))) {
              return true;
            }
          }
        }
      } else if (mask.includes('@')) {
        // Host mask: *!*@host
        const [maskUser, maskHost] = mask.split('@');
        if (maskHost === '*' || (hostname && hostname.includes(maskHost))) {
          return true;
        }
      } else {
        // Nick only
        if (mask === nick || mask === '*') {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get all ignored users
   */
  getIgnoredUsers(network?: string | null): IgnoredUser[] {
    const net = network === null ? undefined : (network || this.currentNetwork);
    const ignored: IgnoredUser[] = [];

    for (const [key, user] of this.ignoredUsers.entries()) {
      if (!net || user.network === net) {
        ignored.push(user);
      }
    }

    return ignored;
  }

  /**
   * Add user to blacklist
   */
  async addBlacklistEntry(
    mask: string,
    action: BlacklistActionType,
    reason?: string,
    network?: string,
    commandTemplate?: string,
    duration?: string
  ): Promise<void> {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${mask}` : mask;

    const entry: BlacklistEntry = {
      mask,
      action,
      network: net,
      addedAt: Date.now(),
      reason,
      duration,
      commandTemplate,
    };

    this.blacklistedUsers.set(key, entry);
    const storageKey = `${this.STORAGE_PREFIX}${this.BLACKLIST_PREFIX}${key}`;
    await this.saveToStorage(storageKey, entry);
  }

  /**
   * Remove user from blacklist
   */
  async removeBlacklistEntry(mask: string, network?: string): Promise<void> {
    const net = network || this.currentNetwork;
    const key = net ? `${net}:${mask}` : mask;
    this.blacklistedUsers.delete(key);
    const storageKey = `${this.STORAGE_PREFIX}${this.BLACKLIST_PREFIX}${key}`;
    await this.removeFromStorage(storageKey);
  }

  /**
   * Get all blacklist entries
   */
  getBlacklistEntries(network?: string): BlacklistEntry[] {
    const net = network || this.currentNetwork;
    const entries: BlacklistEntry[] = [];

    for (const entry of this.blacklistedUsers.values()) {
      if (!net || entry.network === net) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Find a matching blacklist entry (network-specific preferred over global)
   */
  findMatchingBlacklistEntry(
    nick: string,
    username?: string,
    hostname?: string,
    network?: string
  ): BlacklistEntry | undefined {
    const net = network || this.currentNetwork;
    const entries = Array.from(this.blacklistedUsers.values());
    const pickLatest = (candidates: BlacklistEntry[]) => {
      if (!candidates.length) return undefined;
      return candidates.slice().sort((a, b) => b.addedAt - a.addedAt)[0];
    };
    const networkMatches = entries.filter(entry => entry.network && entry.network === net);
    const globalMatches = entries.filter(entry => !entry.network);

    const networkHit = pickLatest(
      networkMatches.filter(entry => this.matchesMaskPattern(nick, username, hostname, entry.mask))
    );
    if (networkHit) return networkHit;

    return pickLatest(
      globalMatches.filter(entry => this.matchesMaskPattern(nick, username, hostname, entry.mask))
    );
  }

  /**
   * Resolve a usable mask for server commands
   */
  resolveBlacklistMask(
    entry: BlacklistEntry,
    nick: string,
    username?: string,
    hostname?: string
  ): string {
    const trimmed = entry.mask.trim();
    if (trimmed.includes('!') || trimmed.includes('@')) {
      return trimmed;
    }
    if (hostname) {
      return `*!*@${hostname}`;
    }
    return `${nick}!*@*`;
  }

  private matchesMaskPattern(
    nick: string,
    username: string | undefined,
    hostname: string | undefined,
    mask: string
  ): boolean {
    const trimmed = mask.trim();
    if (!trimmed) return false;
    const matchPart = (value: string | undefined, pattern: string | undefined): boolean => {
      const normalizedPattern = (pattern || '').trim();
      if (!normalizedPattern || normalizedPattern === '*') return true;
      if (!value) return false;
      return this.matchesWildcard(value, normalizedPattern);
    };

    if (trimmed.includes('!') && trimmed.includes('@')) {
      const [maskNick, maskUserHost] = trimmed.split('!');
      const [maskUser, maskHost] = (maskUserHost || '').split('@');
      return (
        matchPart(nick, maskNick) &&
        matchPart(username, maskUser) &&
        matchPart(hostname, maskHost)
      );
    }
    if (trimmed.includes('@')) {
      const [, maskHost] = trimmed.split('@');
      return matchPart(hostname, maskHost);
    }
    return matchPart(nick, trimmed);
  }

  private matchesWildcard(value: string, pattern: string): boolean {
    if (pattern === '*') return true;
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped.replace(/\\\*/g, '.*')}$`, 'i');
    return regex.test(value);
  }

  /**
   * Listen for WHOIS updates
   */
  onWHOISUpdate(callback: (info: WHOISInfo) => void): () => void {
    this.whoisListeners.push(callback);
    return () => {
      this.whoisListeners = this.whoisListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Listen for WHOWAS updates
   */
  onWHOWASUpdate(callback: (info: WHOWASInfo) => void): () => void {
    this.whowasListeners.push(callback);
    return () => {
      this.whowasListeners = this.whowasListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Emit WHOIS update
   */
  private emitWHOISUpdate(info: WHOISInfo): void {
    this.whoisListeners.forEach(cb => cb(info));
  }

  /**
   * Emit WHOWAS update
   */
  private emitWHOWASUpdate(info: WHOWASInfo): void {
    this.whowasListeners.forEach(cb => cb(info));
  }

  /**
   * Clear WHOIS cache
   */
  clearWHOISCache(network?: string): void {
    if (network) {
      const keys = Array.from(this.whoisCache.keys()).filter(k => k.startsWith(`${network}:`));
      keys.forEach(k => this.whoisCache.delete(k));
    } else {
      this.whoisCache.clear();
    }
  }

  /**
   * Clear WHOWAS cache
   */
  clearWHOWASCache(network?: string): void {
    if (network) {
      const keys = Array.from(this.whowasCache.keys()).filter(k => k.startsWith(`${network}:`));
      keys.forEach(k => this.whowasCache.delete(k));
    } else {
      this.whowasCache.clear();
    }
  }
}

export const userManagementService = new UserManagementService();
