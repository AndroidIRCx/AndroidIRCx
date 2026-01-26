/**
 * ChannelManagementService
 * 
 * Manages channel state including modes, bans, exceptions, keys, limits, and topics.
 * Tracks channel information and provides methods to query and modify channel settings.
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCService } from './IRCService';

export interface ChannelMode {
  // User modes
  owner?: string[]; // q - channel owner
  admin?: string[]; // a - channel admin
  op?: string[]; // o - channel operator
  halfop?: string[]; // h - half operator
  voice?: string[]; // v - voiced user
  
  // Channel modes
  private?: boolean; // p - private channel
  secret?: boolean; // s - secret channel
  inviteOnly?: boolean; // i - invite only
  topicProtected?: boolean; // t - only ops can change topic
  noExternalMessages?: boolean; // n - no messages from outside
  moderated?: boolean; // m - moderated (only voiced/ops can speak)
  key?: string; // k - channel key/password
  limit?: number; // l - user limit
  banList?: string[]; // b - ban masks
  exceptionList?: string[]; // e - exception masks (override bans)
  inviteList?: string[]; // I - invite exception masks
}

export interface ChannelInfo {
  name: string;
  topic?: string;
  topicSetBy?: string;
  topicSetAt?: number;
  modes: ChannelMode;
  userCount?: number;
}

export class ChannelManagementService {
  private channelInfo: Map<string, ChannelInfo> = new Map(); // channel -> info
  private channelInfoListeners: ((channel: string, info: ChannelInfo) => void)[] = [];
  private ircService: IRCService;

  // Buffers for collecting list entries (ban, exception, invite)
  private banListBuffer: Map<string, string[]> = new Map();
  private exceptionListBuffer: Map<string, string[]> = new Map();
  private inviteListBuffer: Map<string, string[]> = new Map();

  constructor(ircService?: IRCService) {
    // Import the singleton only if no instance is provided
    const { ircService: singleton } = require('./IRCService');
    this.ircService = ircService || singleton;
  }

  /**
   * Initialize channel management service
   */
  initialize(): void {
    console.log('ChannelManagementService: Initialized');
    this.ircService.addRawMessage('*** ChannelManagementService initialized', 'debug');
    this.ircService.on('topic', (channel: string, topic: string, setBy: string) => this.updateTopic(channel, topic, setBy));
    this.ircService.on('channelMode', (channel: string, modeString: string, modeParams: string[]) => this.updateModes(channel, modeString, modeParams));
    this.ircService.on('clear-channel', (channel: string) => this.clearChannel(channel));
    this.ircService.on('numeric', (numeric: number, prefix: string, params: string[], timestamp: number) => {
        if (numeric === 324) { // RPL_CHANNELMODEIS - Response to MODE #channel query
            const channel = params[1] || '';
            const modeString = params[2] || '';
            const modeParams = params.slice(3);
            if (channel && modeString) {
                this.updateModes(channel, modeString, modeParams);
            }
        } else if (numeric === 332) { // RPL_TOPIC
            const topicChannel = params[1] || '';
            const topic = params[2] || '';
            this.updateTopic(topicChannel, topic);
        } else if (numeric === 333) { // RPL_TOPICWHOTIME
            const topicWhoChannel = params[1] || '';
            const topicSetter = params[2] || '';
            const topicTime = params[3] ? parseInt(params[3], 10) * 1000 : undefined;
            if (topicWhoChannel && topicSetter) {
                this.updateChannelInfo(topicWhoChannel, {
                    topicSetBy: topicSetter,
                    topicSetAt: topicTime,
                });
            }
        } else if (numeric === 346) { // RPL_INVITELIST - Invite list entry
            const channel = params[1] || '';
            const mask = params[2] || '';
            if (channel && mask) {
                if (!this.inviteListBuffer.has(channel)) {
                    this.inviteListBuffer.set(channel, []);
                }
                this.inviteListBuffer.get(channel)!.push(mask);
            }
        } else if (numeric === 347) { // RPL_ENDOFINVITELIST - End of invite list
            const channel = params[1] || '';
            if (channel) {
                const inviteList = this.inviteListBuffer.get(channel) || [];
                this.inviteListBuffer.delete(channel);
                this.updateChannelInfo(channel, {
                    modes: { inviteList },
                });
            }
        } else if (numeric === 348) { // RPL_EXCEPTLIST - Exception list entry
            const channel = params[1] || '';
            const mask = params[2] || '';
            if (channel && mask) {
                if (!this.exceptionListBuffer.has(channel)) {
                    this.exceptionListBuffer.set(channel, []);
                }
                this.exceptionListBuffer.get(channel)!.push(mask);
            }
        } else if (numeric === 349) { // RPL_ENDOFEXCEPTLIST - End of exception list
            const channel = params[1] || '';
            if (channel) {
                const exceptionList = this.exceptionListBuffer.get(channel) || [];
                this.exceptionListBuffer.delete(channel);
                this.updateChannelInfo(channel, {
                    modes: { exceptionList },
                });
            }
        } else if (numeric === 367) { // RPL_BANLIST - Ban list entry
            const channel = params[1] || '';
            const mask = params[2] || '';
            if (channel && mask) {
                if (!this.banListBuffer.has(channel)) {
                    this.banListBuffer.set(channel, []);
                }
                this.banListBuffer.get(channel)!.push(mask);
            }
        } else if (numeric === 368) { // RPL_ENDOFBANLIST - End of ban list
            const channel = params[1] || '';
            if (channel) {
                const banList = this.banListBuffer.get(channel) || [];
                this.banListBuffer.delete(channel);
                this.updateChannelInfo(channel, {
                    modes: { banList },
                });
            }
        }
    });
  }

  /**
   * Get channel information
   */
  getChannelInfo(channel: string): ChannelInfo | undefined {
    return this.channelInfo.get(channel);
  }

  /**
   * Update channel information
   */
  updateChannelInfo(channel: string, updates: Partial<ChannelInfo>): void {
    const current = this.channelInfo.get(channel) || {
      name: channel,
      modes: {},
    };
    
    const updated: ChannelInfo = {
      ...current,
      ...updates,
      modes: {
        ...current.modes,
        ...(updates.modes || {}),
      },
    };
    
    this.channelInfo.set(channel, updated);
    this.emitChannelInfoChange(channel, updated);
  }

  /**
   * Update channel topic
   */
  updateTopic(channel: string, topic: string, setBy?: string): void {
    this.updateChannelInfo(channel, {
      topic,
      topicSetBy: setBy,
      topicSetAt: Date.now(),
    });
  }

  /**
   * Update channel modes
   */
  updateModes(channel: string, modeString: string, params: string[]): void {
    const current = this.channelInfo.get(channel) || {
      name: channel,
      modes: {},
    };
    
    const modes = { ...current.modes };
    let paramIndex = 0;
    let adding = true;
    
    for (let i = 0; i < modeString.length; i++) {
      const char = modeString[i];
      
      if (char === '+') {
        adding = true;
        continue;
      } else if (char === '-') {
        adding = false;
        continue;
      }
      
      switch (char) {
        case 'p': // private
          modes.private = adding;
          break;
        case 's': // secret
          modes.secret = adding;
          break;
        case 'i': // invite only
          modes.inviteOnly = adding;
          break;
        case 't': // topic protected
          modes.topicProtected = adding;
          break;
        case 'n': // no external messages
          modes.noExternalMessages = adding;
          break;
        case 'm': // moderated
          modes.moderated = adding;
          break;
        case 'k': // key
          if (adding && paramIndex < params.length) {
            modes.key = params[paramIndex++];
          } else if (!adding) {
            delete modes.key;
          }
          break;
        case 'l': // limit
          if (adding && paramIndex < params.length) {
            modes.limit = parseInt(params[paramIndex++], 10);
          } else if (!adding) {
            delete modes.limit;
          }
          break;
        case 'b': // ban
          if (paramIndex < params.length) {
            const mask = params[paramIndex++];
            if (!modes.banList) {
              modes.banList = [];
            }
            if (adding) {
              if (!modes.banList.includes(mask)) {
                modes.banList.push(mask);
              }
            } else {
              modes.banList = modes.banList.filter(m => m !== mask);
            }
          }
          break;
        case 'e': // exception
          if (paramIndex < params.length) {
            const mask = params[paramIndex++];
            if (!modes.exceptionList) {
              modes.exceptionList = [];
            }
            if (adding) {
              if (!modes.exceptionList.includes(mask)) {
                modes.exceptionList.push(mask);
              }
            } else {
              modes.exceptionList = modes.exceptionList.filter(m => m !== mask);
            }
          }
          break;
        case 'I': // invite exception
          if (paramIndex < params.length) {
            const mask = params[paramIndex++];
            if (!modes.inviteList) {
              modes.inviteList = [];
            }
            if (adding) {
              if (!modes.inviteList.includes(mask)) {
                modes.inviteList.push(mask);
              }
            } else {
              modes.inviteList = modes.inviteList.filter(m => m !== mask);
            }
          }
          break;
      }
    }
    
    this.updateChannelInfo(channel, { modes });
  }

  /**
   * Set channel mode
   */
  setChannelMode(channel: string, mode: string, param?: string): void {
    const modeString = mode.startsWith('+') || mode.startsWith('-') ? mode : `+${mode}`;
    const command = param 
      ? `MODE ${channel} ${modeString} ${param}`
      : `MODE ${channel} ${modeString}`;
    ircService.sendCommand(command);
  }

  /**
   * Set channel topic
   */
  setTopic(channel: string, topic: string): void {
    ircService.sendCommand(`TOPIC ${channel} :${topic}`);
  }

  /**
   * Set channel key
   */
  setKey(channel: string, key: string): void {
    this.setChannelMode(channel, '+k', key);
  }

  /**
   * Remove channel key
   */
  removeKey(channel: string): void {
    this.setChannelMode(channel, '-k');
  }

  /**
   * Set channel limit
   */
  setLimit(channel: string, limit: number): void {
    this.setChannelMode(channel, '+l', limit.toString());
  }

  /**
   * Remove channel limit
   */
  removeLimit(channel: string): void {
    this.setChannelMode(channel, '-l');
  }

  /**
   * Add ban mask
   */
  addBan(channel: string, mask: string): void {
    this.setChannelMode(channel, '+b', mask);
  }

  /**
   * Remove ban mask
   */
  removeBan(channel: string, mask: string): void {
    this.setChannelMode(channel, '-b', mask);
  }

  /**
   * Add exception mask
   */
  addException(channel: string, mask: string): void {
    this.setChannelMode(channel, '+e', mask);
  }

  /**
   * Remove exception mask
   */
  removeException(channel: string, mask: string): void {
    this.setChannelMode(channel, '-e', mask);
  }

  /**
   * Request ban list from server
   */
  requestBanList(channel: string): void {
    ircService.sendCommand(`MODE ${channel} b`);
  }

  /**
   * Request exception list from server
   */
  requestExceptionList(channel: string): void {
    ircService.sendCommand(`MODE ${channel} e`);
  }

  /**
   * Request invite list from server
   */
  requestInviteList(channel: string): void {
    ircService.sendCommand(`MODE ${channel} I`);
  }

  /**
   * Add invite exception mask
   */
  addInvite(channel: string, mask: string): void {
    this.setChannelMode(channel, '+I', mask);
  }

  /**
   * Remove invite exception mask
   */
  removeInvite(channel: string, mask: string): void {
    this.setChannelMode(channel, '-I', mask);
  }

  /**
   * Clear channel info (when leaving channel)
   */
  clearChannel(channel: string): void {
    this.channelInfo.delete(channel);
  }

  /**
   * Listen for channel info changes
   */
  onChannelInfoChange(callback: (channel: string, info: ChannelInfo) => void): () => void {
    this.channelInfoListeners.push(callback);
    return () => {
      this.channelInfoListeners = this.channelInfoListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Emit channel info change
   */
  private emitChannelInfoChange(channel: string, info: ChannelInfo): void {
    this.channelInfoListeners.forEach(cb => cb(channel, info));
  }

  /**
   * Get formatted mode string for display
   */
  getModeString(channel: string): string {
    const info = this.channelInfo.get(channel);
    if (!info || !info.modes) return '';
    
    const modes: string[] = [];
    const m = info.modes;
    
    if (m.private) modes.push('p');
    if (m.secret) modes.push('s');
    if (m.inviteOnly) modes.push('i');
    if (m.topicProtected) modes.push('t');
    if (m.noExternalMessages) modes.push('n');
    if (m.moderated) modes.push('m');
    if (m.key) modes.push(`k`);
    if (m.limit) modes.push(`l`);
    if (m.banList && m.banList.length > 0) modes.push(`b(${m.banList.length})`);
    if (m.exceptionList && m.exceptionList.length > 0) modes.push(`e(${m.exceptionList.length})`);
    if (m.inviteList && m.inviteList.length > 0) modes.push(`I(${m.inviteList.length})`);
    
    return modes.length > 0 ? `+${modes.join('')}` : '';
  }
}

// Singleton instance for backward compatibility
const { ircService } = require('./IRCService');
export const channelManagementService = new ChannelManagementService(ircService);

