/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * NotifyService
 * 
 * Manages the notify list for tracking user online/offline status.
 * Uses MONITOR (IRCv3), WATCH (legacy), or ISON (fallback) depending on server support.
 */

import { IRCService } from './IRCService';
import { userManagementService, UserListEntry } from './UserManagementService';
import { soundService } from './SoundService';
import { SoundEventType } from '../types/sound';
import { notificationService } from './NotificationService';
import { tx } from '../i18n/transifex';
import EventEmitter from 'eventemitter3';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export type NotifyProtocol = 'monitor' | 'watch' | 'ison' | null;

export interface NotifyStatus {
  online: boolean;
  lastSeen?: number;
  host?: string; // host@user format when online
}

export class NotifyService extends EventEmitter {
  private ircService: IRCService | null = null;
  private protocol: NotifyProtocol = null;
  private isonInterval: NodeJS.Timeout | null = null;
  private readonly ISON_INTERVAL_MS = 30000; // 30 seconds for ISON polling
  private notifyStatus: Map<string, NotifyStatus> = new Map(); // nick -> status
  private serverSupportsMonitor: boolean = false;
  private serverSupportsWatch: boolean = false;
  private isConnected: boolean = false;
  private currentNetwork: string = '';

  constructor() {
    super();
  }

  setIRCService(ircService: IRCService): void {
    this.ircService = ircService;
    this.setupIRCListeners();
  }

  /**
   * Initialize the service (called after connection is established)
   */
  initialize(): void {
    console.log('NotifyService: Initialized');
  }

  /**
   * Set current network
   */
  setNetwork(network: string): void {
    this.currentNetwork = network;
  }

  private setupIRCListeners(): void {
    if (!this.ircService) return;

    // Listen for connection events
    this.ircService.on('connected', () => {
      this.isConnected = true;
      this.currentNetwork = this.ircService?.getNetworkName() || '';
      this.onConnect();
    });

    this.ircService.on('disconnected', () => {
      this.isConnected = false;
      this.clearISONInterval();
    });

    // Listen for CAP acknowledgments to detect MONITOR support
    this.ircService.on('cap_ack', (caps: string[]) => {
      if (caps.includes('monitor')) {
        this.serverSupportsMonitor = true;
        // If we previously subscribed with ISON/WATCH, resubscribe with MONITOR
        if (this.protocol !== 'monitor' && this.isConnected) {
          this.protocol = 'monitor';
          this.subscribeToNotifyList();
        }
      }
    });

    // Listen for numeric replies
    this.ircService.on('numeric', (numeric: number, prefix: string, params: string[], timestamp: number) => {
      this.handleNumeric(numeric, params, timestamp);
    });
  }

  private handleNumeric(numeric: number, params: string[], timestamp: number): void {
    // Debug: log monitor-related numerics
    if ([600, 601, 604, 605, 730, 731].includes(numeric)) {
      console.log(`NotifyService: Received numeric ${numeric}, params:`, params);
    }
    
    switch (numeric) {
      // WATCH numerics
      case 600: // RPL_LOGON
      case 604: // RPL_NOWON
        {
          const nick = params[1];
          const user = params[2];
          const host = params[3];
          if (nick) {
            this.setUserOnline(nick, `${user}@${host}`, timestamp);
          }
        }
        break;

      case 601: // RPL_LOGOFF
      case 605: // RPL_NOWOFF
        {
          const nick = params[1];
          if (nick) {
            this.setUserOffline(nick, timestamp);
          }
        }
        break;

      // MONITOR numerics
      case 730: // RPL_MONONLINE
        {
          const nicksParam = params.slice(1).join(' ').replace(/^:/, '');
          const nicks = nicksParam.split(',').map(n => n.trim()).filter(Boolean);
          for (const nickEntry of nicks) {
            // Format can be "nick" or "nick!user@host"
            const [nick, hostPart] = nickEntry.split('!');
            const host = hostPart?.split('@')[1];
            if (nick) {
              this.setUserOnline(nick, host, timestamp);
            }
          }
        }
        break;

      case 731: // RPL_MONOFFLINE
        {
          const nicksParam = params.slice(1).join(' ').replace(/^:/, '');
          const nicks = nicksParam.split(',').map(n => n.trim()).filter(Boolean);
          for (const nick of nicks) {
            this.setUserOffline(nick, timestamp);
          }
        }
        break;

      case 733: // RPL_ENDOFMONLIST
        // Monitor list completed
        break;

      case 734: // ERR_MONLISTFULL
        {
          const limit = params[1];
          console.warn(`NotifyService: Monitor list full (limit: ${limit})`);
          this.emit('listFull', { limit: parseInt(limit, 10) || 0 });
        }
        break;

      // ISON response (303 RPL_ISON)
      case 303:
        {
          const onlineNicks = params.slice(1).join(' ').replace(/^:/, '').split(' ').filter(Boolean);
          // Update status for all queried nicks
          const notifyEntries = this.getNotifyList();
          const onlineSet = new Set(onlineNicks.map(n => n.toLowerCase()));
          
          for (const entry of notifyEntries) {
            const nick = entry.mask.split('!')[0]; // Get nick from mask
            const isOnline = onlineSet.has(nick.toLowerCase());
            const currentStatus = this.notifyStatus.get(nick);
            
            if (isOnline && !currentStatus?.online) {
              this.setUserOnline(nick, undefined, timestamp);
            } else if (!isOnline && currentStatus?.online) {
              this.setUserOffline(nick, timestamp);
            }
          }
        }
        break;
    }
  }

  private onConnect(): void {
    // Reset protocol detection
    this.protocol = this.detectProtocol();
    console.log(`NotifyService: Connected, protocol=${this.protocol}, monitorSupport=${this.serverSupportsMonitor}`);
    
    // Subscribe to notify list
    this.subscribeToNotifyList();
  }

  private detectProtocol(): NotifyProtocol {
    // Check for MONITOR support (IRCv3)
    if (this.serverSupportsMonitor || this.ircService?.hasCapability?.('monitor')) {
      return 'monitor';
    }
    
    // Check for WATCH support (older servers)
    // WATCH is usually advertised in ISUPPORT
    if (this.serverSupportsWatch) {
      return 'watch';
    }
    
    // Fallback to ISON
    return 'ison';
  }

  private subscribeToNotifyList(): void {
    const entries = this.getNotifyList();
    if (entries.length === 0) return;

    const nicks = entries.map(e => e.mask.split('!')[0]).filter(Boolean);
    if (nicks.length === 0) return;

    switch (this.protocol) {
      case 'monitor':
        this.sendMonitorCommand(nicks);
        break;
      case 'watch':
        this.sendWatchCommand(nicks);
        break;
      case 'ison':
        this.startISONPolling(nicks);
        break;
    }
  }

  private sendMonitorCommand(nicks: string[]): void {
    if (!this.ircService || nicks.length === 0) return;
    
    console.log(`NotifyService: Sending MONITOR for ${nicks.length} nicks: ${nicks.join(',')}`);
    
    // MONITOR has a limit per command, split if needed
    const MONITOR_LIMIT = 20;
    for (let i = 0; i < nicks.length; i += MONITOR_LIMIT) {
      const batch = nicks.slice(i, i + MONITOR_LIMIT);
      this.ircService.sendRaw(`MONITOR + ${batch.join(',')}`);
    }
  }

  private sendWatchCommand(nicks: string[]): void {
    if (!this.ircService || nicks.length === 0) return;
    
    // WATCH uses +nick format
    for (const nick of nicks) {
      this.ircService.sendRaw(`WATCH +${nick}`);
    }
  }

  private startISONPolling(nicks: string[]): void {
    if (!this.ircService || nicks.length === 0) return;
    
    // Clear existing interval
    this.clearISONInterval();
    
    // Send initial ISON
    this.sendISONCommand(nicks);
    
    // Start polling
    this.isonInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendISONCommand(nicks);
      }
    }, this.ISON_INTERVAL_MS);
  }

  private sendISONCommand(nicks: string[]): void {
    if (!this.ircService || nicks.length === 0) return;
    
    // ISON limit is typically around 15 nicks
    const ISON_LIMIT = 15;
    for (let i = 0; i < nicks.length; i += ISON_LIMIT) {
      const batch = nicks.slice(i, i + ISON_LIMIT);
      this.ircService.sendRaw(`ISON ${batch.join(' ')}`);
    }
  }

  private clearISONInterval(): void {
    if (this.isonInterval) {
      clearInterval(this.isonInterval);
      this.isonInterval = null;
    }
  }

  private getNotifyList(): UserListEntry[] {
    return userManagementService.getUserListEntries('notify', this.currentNetwork);
  }

  private setUserOnline(nick: string, host?: string, timestamp?: number): void {
    const existing = this.notifyStatus.get(nick);
    const wasOffline = !existing?.online;
    
    this.notifyStatus.set(nick, {
      online: true,
      host,
      lastSeen: timestamp || Date.now(),
    });

    if (wasOffline) {
      this.emit('online', { nick, host, timestamp });
      this.showNotifyMessage(nick, true);
    }
  }

  private setUserOffline(nick: string, timestamp?: number): void {
    const existing = this.notifyStatus.get(nick);
    const wasOnline = existing?.online;
    
    this.notifyStatus.set(nick, {
      online: false,
      lastSeen: timestamp || Date.now(),
    });

    if (wasOnline) {
      this.emit('offline', { nick, timestamp });
      this.showNotifyMessage(nick, false);
    }
  }

  private showNotifyMessage(nick: string, online: boolean): void {
    if (!this.ircService) return;
    
    const message = online
      ? t('*** {nick} is now online', { nick })
      : t('*** {nick} is now offline', { nick });
    
    // Send as system type so it's always visible
    this.ircService.addMessage({
      type: 'system',
      text: message,
      timestamp: Date.now(),
      channel: 'notifications', // Special channel for notifications tab
    });
    
    // Play sound for online notification
    if (online) {
      soundService.playSound(SoundEventType.NOTIFY);
      
      // Show toast notification
      notificationService.showLocalNotification(
        t('Notify'),
        t('{nick} is now online', { nick }),
        { type: 'notify', nick, network: this.currentNetwork }
      );
    }
  }

  // Public API

  /**
   * Add a nick to the notify list
   */
  async addNotify(nick: string, network?: string): Promise<void> {
    const net = network || this.currentNetwork;
    await userManagementService.addUserListEntry('notify', nick, { network: net });
    
    if (this.isConnected && this.protocol) {
      switch (this.protocol) {
        case 'monitor':
          this.ircService?.sendRaw(`MONITOR + ${nick}`);
          break;
        case 'watch':
          this.ircService?.sendRaw(`WATCH +${nick}`);
          break;
        case 'ison':
          // ISON will pick it up on next poll
          this.sendISONCommand([nick]);
          break;
      }
    }
  }

  /**
   * Remove a nick from the notify list
   */
  async removeNotify(nick: string, network?: string): Promise<void> {
    const net = network || this.currentNetwork;
    await userManagementService.removeUserListEntry('notify', nick, net);
    
    if (this.isConnected && this.protocol) {
      switch (this.protocol) {
        case 'monitor':
          this.ircService?.sendRaw(`MONITOR - ${nick}`);
          break;
        case 'watch':
          this.ircService?.sendRaw(`WATCH -${nick}`);
          break;
        case 'ison':
          // ISON will pick it up on next poll
          break;
      }
    }
    
    this.notifyStatus.delete(nick);
  }

  /**
   * Get notify list entries
   */
  getNotifyEntries(network?: string): UserListEntry[] {
    return userManagementService.getUserListEntries('notify', network || this.currentNetwork);
  }

  /**
   * Get online status for a nick
   */
  getStatus(nick: string): NotifyStatus | undefined {
    return this.notifyStatus.get(nick);
  }

  /**
   * Get all notify statuses
   */
  getAllStatuses(): Map<string, NotifyStatus> {
    return new Map(this.notifyStatus);
  }

  /**
   * Clear all notify entries for current network
   */
  async clearAll(network?: string): Promise<void> {
    const net = network || this.currentNetwork;
    const entries = this.getNotifyEntries(net);
    
    if (this.isConnected && this.protocol) {
      const nicks = entries.map(e => e.mask.split('!')[0]).filter(Boolean);
      
      switch (this.protocol) {
        case 'monitor':
          this.ircService?.sendRaw(`MONITOR - ${nicks.join(',')}`);
          break;
        case 'watch':
          for (const nick of nicks) {
            this.ircService?.sendRaw(`WATCH -${nick}`);
          }
          break;
        case 'ison':
          break;
      }
    }
    
    for (const entry of entries) {
      await userManagementService.removeUserListEntry('notify', entry.mask, net);
    }
    
    this.notifyStatus.clear();
  }

  /**
   * Get current protocol being used
   */
  getProtocol(): NotifyProtocol {
    return this.protocol;
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy(): void {
    this.clearISONInterval();
    this.removeAllListeners();
  }
}

export const notifyService = new NotifyService();
