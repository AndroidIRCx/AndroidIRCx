/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { IRCService } from './IRCService';

export interface ChannelListItem {
  name: string;
  userCount?: number;
  topic?: string;
}

export interface ChannelListFilter {
  minUsers?: number;
  maxUsers?: number;
  namePattern?: string;
  topicPattern?: string;
}

export class ChannelListService {
  private ircService: IRCService;
  private channelList: ChannelListItem[] = [];
  private isListing: boolean = false;
  private listListeners: Array<(channels: ChannelListItem[]) => void> = [];
  private listEndListeners: Array<() => void> = [];
  private cachedLists: Record<string, ChannelListItem[]> = {};
  private cacheLoaded: Promise<void>;

  constructor(ircService: IRCService) {
    this.ircService = ircService;
    this.cacheLoaded = this.loadCache();
    this.setupListeners();
  }

  private async loadCache() {
    try {
      const raw = await AsyncStorage.getItem('CHANNEL_LIST_CACHE');
      if (raw) {
        this.cachedLists = JSON.parse(raw);
      }
    } catch (e) {
      // ignore
    }
  }

  private async saveCache() {
    try {
      await AsyncStorage.setItem('CHANNEL_LIST_CACHE', JSON.stringify(this.cachedLists));
    } catch (e) {
      // ignore
    }
  }

  private getNetworkKey(): string {
    return this.ircService.getNetworkName();
  }

  private setupListeners(): void {
    // Listen for LIST numeric replies
    this.ircService.on('numeric', (numeric: number, prefix: string, params: string[]) => {
      this.handleListReply(numeric, params);
    });
  }

  /**
   * Request channel list from server
   */
  requestChannelList(filter?: string): void {
    if (this.isListing) {
      console.warn('ChannelListService: Already listing channels');
      return;
    }

    this.isListing = true;
    this.channelList = [];
    
    // Send LIST command with optional filter
    if (filter) {
      this.ircService.sendRaw(`LIST ${filter}`);
    } else {
      this.ircService.sendRaw('LIST');
    }
  }

  /**
   * Handle LIST numeric replies
   */
  handleListReply(numeric: number, params: string[]): void {
    switch (numeric) {
      case 321: // RPL_LISTSTART
        // Start of list
        this.channelList = [];
        break;
      
      case 322: // RPL_LIST
        // Channel entry: :server 322 nick channel userCount :topic
        if (params.length >= 3) {
          const channel = params[1];
          const userCount = parseInt(params[2], 10);
          const topic = params.slice(3).join(' ').replace(/^:/, '') || undefined;
          
          this.channelList.push({
            name: channel,
            userCount: isNaN(userCount) ? undefined : userCount,
            topic,
          });
        }
        break;
      
      case 323: // RPL_LISTEND
        // End of list
        this.isListing = false;
        this.notifyListListeners();
        this.notifyListEndListeners();
        // Cache the list per network for offline browsing
        this.cachedLists[this.getNetworkKey()] = [...this.channelList];
        this.saveCache();
        break;
    }
  }

  /**
   * Get current channel list
   */
  getChannelList(): ChannelListItem[] {
    return [...this.channelList];
  }

  /**
   * Get cached list for offline browsing
   */
  async getCachedList(network?: string): Promise<ChannelListItem[]> {
    await this.cacheLoaded;
    const key = network || this.getNetworkKey();
    return this.cachedLists[key] ? [...this.cachedLists[key]] : [];
  }

  /**
   * Filter channel list
   */
  filterChannelList(filter: ChannelListFilter): ChannelListItem[] {
    // Pre-compile regex patterns outside the loop for performance.
    // If the user enters an invalid regex, fall back to case-insensitive substring match.
    let namePattern: RegExp | null = null;
    let topicPattern: RegExp | null = null;
    const nameFallback = filter.namePattern?.toLowerCase() || null;
    const topicFallback = filter.topicPattern?.toLowerCase() || null;

    if (filter.namePattern) {
      try {
        namePattern = new RegExp(filter.namePattern, 'i');
      } catch (error) {
        console.warn('ChannelListService: Invalid name regex pattern:', error);
      }
    }
    if (filter.topicPattern) {
      try {
        topicPattern = new RegExp(filter.topicPattern, 'i');
      } catch (error) {
        console.warn('ChannelListService: Invalid topic regex pattern:', error);
      }
    }

    return this.channelList.filter(channel => {
      if (filter.minUsers !== undefined && (channel.userCount === undefined || channel.userCount < filter.minUsers)) {
        return false;
      }
      if (filter.maxUsers !== undefined && (channel.userCount === undefined || channel.userCount > filter.maxUsers)) {
        return false;
      }
      if (namePattern) {
        if (!namePattern.test(channel.name)) {
          return false;
        }
      } else if (nameFallback && !channel.name.toLowerCase().includes(nameFallback)) {
        return false;
      }

      if (topicPattern) {
        if (channel.topic && !topicPattern.test(channel.topic)) {
          return false;
        }
      } else if (topicFallback) {
        const topic = channel.topic?.toLowerCase() || '';
        if (!topic.includes(topicFallback)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Search channels by name or topic
   */
  searchChannels(query: string): ChannelListItem[] {
    if (!query.trim()) {
      return this.channelList;
    }

    const lowerQuery = query.toLowerCase();
    return this.channelList.filter(channel => {
      const nameMatch = channel.name.toLowerCase().includes(lowerQuery);
      const topicMatch = channel.topic?.toLowerCase().includes(lowerQuery);
      return nameMatch || topicMatch;
    });
  }

  /**
   * Sort channels
   */
  sortChannels(channels: ChannelListItem[], sortBy: 'name' | 'users' = 'users', ascending: boolean = false): ChannelListItem[] {
    const sorted = [...channels];

    sorted.sort((a, b) => {
      if (sortBy === 'users') {
        const aUsers = a.userCount ?? 0;
        const bUsers = b.userCount ?? 0;
        return ascending ? aUsers - bUsers : bUsers - aUsers;
      } else {
        // Use simple string comparison instead of localeCompare for better performance
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        if (aName < bName) return ascending ? -1 : 1;
        if (aName > bName) return ascending ? 1 : -1;
        return 0;
      }
    });

    return sorted;
  }

  /**
   * Listen for channel list updates
   */
  onChannelListUpdate(callback: (channels: ChannelListItem[]) => void): () => void {
    this.listListeners.push(callback);
    return () => {
      const index = this.listListeners.indexOf(callback);
      if (index > -1) {
        this.listListeners.splice(index, 1);
      }
    };
  }

  /**
   * Listen for list end
   */
  onListEnd(callback: () => void): () => void {
    this.listEndListeners.push(callback);
    return () => {
      const index = this.listEndListeners.indexOf(callback);
      if (index > -1) {
        this.listEndListeners.splice(index, 1);
      }
    };
  }

  private notifyListListeners(): void {
    this.listListeners.forEach(callback => callback(this.channelList));
  }

  private notifyListEndListeners(): void {
    this.listEndListeners.forEach(callback => callback());
  }

  /**
   * Clear channel list
   */
  clear(): void {
    this.channelList = [];
    this.isListing = false;
  }
}

// Singleton instance for backward compatibility
const { ircService } = require('./IRCService');
export const channelListService = new ChannelListService(ircService);

