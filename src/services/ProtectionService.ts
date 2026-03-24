/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import RNFS from 'react-native-fs';
import type { IRCMessage } from './IRCService';
import { settingsService } from './SettingsService';

type SpamMode = 'when_open' | 'always';

type FloodBucket = {
  timestamps: number[];
};

type ProtectionDecision = {
  block: boolean;
  kind: 'spam' | 'flood' | 'ctcp' | 'dcc' | 'dos' | 'tsunami' | 'net_flood';
  reason: string;
};

type ProtectionContext = {
  isActiveTab?: boolean;
  isQueryOpen?: boolean;
  isChannel?: boolean;
  isCtcp?: boolean;
};

type ProtectionSettings = {
  spamPmMode: SpamMode;
  spamPmKeywords: string[];
  spamChannelEnabled: boolean;
  spamNoSpamOnQuits: boolean;
  spamLoggingEnabled: boolean;
  protCtcpFlood: boolean;
  protTextFlood: boolean;
  protDccFlood: boolean;
  protQueryFlood: boolean;
  protDosAttacks: boolean;
  protAntiDeopEnabled: boolean;
  protAntiDeopUseChanserv: boolean;
  protExcludeTokens: string;
  protEnforceSilence: boolean;
  protBlockTsunamis: boolean;
  protTextFloodNet: boolean;
  protIrcopAction: 'none' | 'ban' | 'kill' | 'kline' | 'gline';
  protIrcopReason: string;
  protIrcopDuration: string;
};

const LOG_FILE = `${RNFS.DocumentDirectoryPath}/SPAM.log`;

class ProtectionService {
  private initialized = false;
  private settings: ProtectionSettings = {
    spamPmMode: 'when_open',
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
    protIrcopAction: 'none',
    protIrcopReason: 'Auto protection: spam/flood',
    protIrcopDuration: '1h',
  };
  private floodBuckets: Map<string, FloodBucket> = new Map();
  private netFloodBuckets: Map<string, FloodBucket> = new Map();

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.loadSettings();
    this.subscribeSettings();
  }

  private asBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private asString(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
  }

  private asStringArray(value: unknown, fallback: string[]): string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string')
      ? value
      : fallback;
  }

  private asSpamMode(value: unknown, fallback: SpamMode): SpamMode {
    return value === 'when_open' || value === 'always' ? value : fallback;
  }

  private asIrcopAction(
    value: unknown,
    fallback: ProtectionSettings['protIrcopAction']
  ): ProtectionSettings['protIrcopAction'] {
    return value === 'none' || value === 'ban' || value === 'kill' || value === 'kline' || value === 'gline'
      ? value
      : fallback;
  }

  private async loadSettings(): Promise<void> {
    this.settings.spamPmMode = this.asSpamMode(
      await settingsService.getSetting('spamPmMode', this.settings.spamPmMode),
      this.settings.spamPmMode
    );
    this.settings.spamPmKeywords = this.asStringArray(await settingsService.getSetting('spamPmKeywords', [
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
    ]), this.settings.spamPmKeywords);
    this.settings.spamChannelEnabled = this.asBoolean(await settingsService.getSetting('spamChannelEnabled', this.settings.spamChannelEnabled), this.settings.spamChannelEnabled);
    this.settings.spamNoSpamOnQuits = this.asBoolean(await settingsService.getSetting('spamNoSpamOnQuits', this.settings.spamNoSpamOnQuits), this.settings.spamNoSpamOnQuits);
    this.settings.spamLoggingEnabled = this.asBoolean(await settingsService.getSetting('spamLoggingEnabled', this.settings.spamLoggingEnabled), this.settings.spamLoggingEnabled);
    this.settings.protCtcpFlood = this.asBoolean(await settingsService.getSetting('protCtcpFlood', this.settings.protCtcpFlood), this.settings.protCtcpFlood);
    this.settings.protTextFlood = this.asBoolean(await settingsService.getSetting('protTextFlood', this.settings.protTextFlood), this.settings.protTextFlood);
    this.settings.protDccFlood = this.asBoolean(await settingsService.getSetting('protDccFlood', this.settings.protDccFlood), this.settings.protDccFlood);
    this.settings.protQueryFlood = this.asBoolean(await settingsService.getSetting('protQueryFlood', this.settings.protQueryFlood), this.settings.protQueryFlood);
    this.settings.protDosAttacks = this.asBoolean(await settingsService.getSetting('protDosAttacks', this.settings.protDosAttacks), this.settings.protDosAttacks);
    this.settings.protAntiDeopEnabled = this.asBoolean(await settingsService.getSetting('protAntiDeopEnabled', this.settings.protAntiDeopEnabled), this.settings.protAntiDeopEnabled);
    this.settings.protAntiDeopUseChanserv = this.asBoolean(await settingsService.getSetting('protAntiDeopUseChanserv', this.settings.protAntiDeopUseChanserv), this.settings.protAntiDeopUseChanserv);
    this.settings.protExcludeTokens = this.asString(await settingsService.getSetting('protExcludeTokens', this.settings.protExcludeTokens), this.settings.protExcludeTokens);
    this.settings.protEnforceSilence = this.asBoolean(await settingsService.getSetting('protEnforceSilence', this.settings.protEnforceSilence), this.settings.protEnforceSilence);
    this.settings.protBlockTsunamis = this.asBoolean(await settingsService.getSetting('protBlockTsunamis', this.settings.protBlockTsunamis), this.settings.protBlockTsunamis);
    this.settings.protTextFloodNet = this.asBoolean(await settingsService.getSetting('protTextFloodNet', this.settings.protTextFloodNet), this.settings.protTextFloodNet);
    this.settings.protIrcopAction = this.asIrcopAction(await settingsService.getSetting('protIrcopAction', this.settings.protIrcopAction), this.settings.protIrcopAction);
    this.settings.protIrcopReason = this.asString(await settingsService.getSetting('protIrcopReason', this.settings.protIrcopReason), this.settings.protIrcopReason);
    this.settings.protIrcopDuration = this.asString(await settingsService.getSetting('protIrcopDuration', this.settings.protIrcopDuration), this.settings.protIrcopDuration);
  }

  private subscribeSettings(): void {
    settingsService.onSettingChange('spamPmMode', value => (this.settings.spamPmMode = this.asSpamMode(value, this.settings.spamPmMode)));
    settingsService.onSettingChange('spamPmKeywords', value => (this.settings.spamPmKeywords = this.asStringArray(value, this.settings.spamPmKeywords)));
    settingsService.onSettingChange('spamChannelEnabled', value => (this.settings.spamChannelEnabled = this.asBoolean(value, this.settings.spamChannelEnabled)));
    settingsService.onSettingChange('spamNoSpamOnQuits', value => (this.settings.spamNoSpamOnQuits = this.asBoolean(value, this.settings.spamNoSpamOnQuits)));
    settingsService.onSettingChange('spamLoggingEnabled', value => (this.settings.spamLoggingEnabled = this.asBoolean(value, this.settings.spamLoggingEnabled)));
    settingsService.onSettingChange('protCtcpFlood', value => (this.settings.protCtcpFlood = this.asBoolean(value, this.settings.protCtcpFlood)));
    settingsService.onSettingChange('protTextFlood', value => (this.settings.protTextFlood = this.asBoolean(value, this.settings.protTextFlood)));
    settingsService.onSettingChange('protDccFlood', value => (this.settings.protDccFlood = this.asBoolean(value, this.settings.protDccFlood)));
    settingsService.onSettingChange('protQueryFlood', value => (this.settings.protQueryFlood = this.asBoolean(value, this.settings.protQueryFlood)));
    settingsService.onSettingChange('protDosAttacks', value => (this.settings.protDosAttacks = this.asBoolean(value, this.settings.protDosAttacks)));
    settingsService.onSettingChange('protAntiDeopEnabled', value => (this.settings.protAntiDeopEnabled = this.asBoolean(value, this.settings.protAntiDeopEnabled)));
    settingsService.onSettingChange('protAntiDeopUseChanserv', value => (this.settings.protAntiDeopUseChanserv = this.asBoolean(value, this.settings.protAntiDeopUseChanserv)));
    settingsService.onSettingChange('protExcludeTokens', value => (this.settings.protExcludeTokens = this.asString(value, this.settings.protExcludeTokens)));
    settingsService.onSettingChange('protEnforceSilence', value => (this.settings.protEnforceSilence = this.asBoolean(value, this.settings.protEnforceSilence)));
    settingsService.onSettingChange('protBlockTsunamis', value => (this.settings.protBlockTsunamis = this.asBoolean(value, this.settings.protBlockTsunamis)));
    settingsService.onSettingChange('protTextFloodNet', value => (this.settings.protTextFloodNet = this.asBoolean(value, this.settings.protTextFloodNet)));
    settingsService.onSettingChange('protIrcopAction', value => (this.settings.protIrcopAction = this.asIrcopAction(value, this.settings.protIrcopAction)));
    settingsService.onSettingChange('protIrcopReason', value => (this.settings.protIrcopReason = this.asString(value, this.settings.protIrcopReason)));
    settingsService.onSettingChange('protIrcopDuration', value => (this.settings.protIrcopDuration = this.asString(value, this.settings.protIrcopDuration)));
  }

  getActionConfig(): Pick<ProtectionSettings, 'protEnforceSilence' | 'protIrcopAction' | 'protIrcopReason' | 'protIrcopDuration'> {
    return {
      protEnforceSilence: this.settings.protEnforceSilence,
      protIrcopAction: this.settings.protIrcopAction,
      protIrcopReason: this.settings.protIrcopReason,
      protIrcopDuration: this.settings.protIrcopDuration,
    };
  }

  getAntiDeopConfig(): Pick<ProtectionSettings, 'protAntiDeopEnabled' | 'protAntiDeopUseChanserv'> {
    return {
      protAntiDeopEnabled: this.settings.protAntiDeopEnabled,
      protAntiDeopUseChanserv: this.settings.protAntiDeopUseChanserv,
    };
  }

  /**
   * Check if a user is protected (exempt from all protections).
   * This method can be passed a callback from UserManagementService.isUserProtected
   */
  private isUserProtectedCallback: ((nick: string, username?: string, hostname?: string, network?: string) => boolean) | null = null;

  /**
   * Set the callback for checking if a user is protected
   */
  setProtectedCheckCallback(
    callback: (nick: string, username?: string, hostname?: string, network?: string) => boolean
  ): void {
    this.isUserProtectedCallback = callback;
  }

  evaluateIncomingMessage(message: IRCMessage, ctx?: ProtectionContext): ProtectionDecision | null {
    // Skip protection checks for protected users
    if (this.isUserProtectedCallback && message.from) {
      if (this.isUserProtectedCallback(message.from, message.username, message.hostname, message.network)) {
        return null;
      }
    }
    
    const decision = this.computeDecision(message, ctx, true);
    if (decision) {
      this.logSpam(decision.kind, message);
    }
    return decision;
  }

  shouldBlockMessage(message: IRCMessage, opts?: { isActiveTab?: boolean; isQueryOpen?: boolean; isChannel?: boolean; isCtcp?: boolean }): boolean {
    // Skip protection checks for protected users
    if (this.isUserProtectedCallback && message.from) {
      if (this.isUserProtectedCallback(message.from, message.username, message.hostname, message.network)) {
        return false;
      }
    }
    return !!this.computeDecision(message, opts, false);
  }

  private computeDecision(
    message: IRCMessage,
    ctx?: ProtectionContext,
    trackFlood: boolean = false,
  ): ProtectionDecision | null {
    if (message.type === 'quit' && this.settings.spamNoSpamOnQuits) {
      return null;
    }
    if (!message.text) {
      return null;
    }

    const excludeTokens = this.parseExcludeTokens(this.settings.protExcludeTokens);
    if (excludeTokens.length > 0 && this.containsExcludedToken(message.text, excludeTokens)) {
      return null;
    }

    const isChannel = typeof ctx?.isChannel === 'boolean'
      ? ctx.isChannel
      : this.isChannelTarget(message.channel);
    const isPrivate = !isChannel;

    if (isPrivate) {
      const allowSpamCheck = this.settings.spamPmMode === 'always' || ctx?.isQueryOpen || ctx?.isActiveTab;
      if (allowSpamCheck) {
        if (this.matchesSpamKeywords(message.text)) {
          return { block: true, kind: 'spam', reason: 'spam_keywords' };
        }
      }
    } else if (this.settings.spamChannelEnabled) {
      if (this.matchesSpamKeywords(message.text)) {
        return { block: true, kind: 'spam', reason: 'spam_keywords' };
      }
    }

    if (this.settings.protBlockTsunamis && this.isTsunamiText(message.text)) {
      return { block: true, kind: 'tsunami', reason: 'tsunami' };
    }

    if (this.shouldBlockFlood(message, isChannel, ctx?.isCtcp, trackFlood)) {
      return { block: true, kind: 'flood', reason: 'rate_limit' };
    }

    if (this.settings.protTextFloodNet && trackFlood) {
      const netDecision = this.shouldBlockNetFlood(message, isChannel);
      if (netDecision) {
        return netDecision;
      }
    }

    return null;
  }

  private shouldBlockFlood(message: IRCMessage, isChannel: boolean, isCtcp?: boolean, trackFlood: boolean = true): boolean {
    const now = Date.now();
    const text = message.text || '';
    const from = message.from || 'unknown';
    const network = message.network || '';
    const key = `${network}:${from.toLowerCase()}:${isChannel ? message.channel : 'pm'}`;

    let bucket = this.floodBuckets.get(key) || { timestamps: [] };
    if (trackFlood) {
      bucket.timestamps.push(now);
      bucket.timestamps = bucket.timestamps.filter(ts => now - ts < 5000);
      this.floodBuckets.set(key, bucket);
    } else {
      bucket = { timestamps: bucket.timestamps.filter(ts => now - ts < 5000) };
    }

    if (this.settings.protTextFlood && bucket.timestamps.length > 5) {
      return true;
    }

    if (this.settings.protQueryFlood && !isChannel && bucket.timestamps.length > 4) {
      return true;
    }

    if (this.settings.protCtcpFlood && (isCtcp || text.includes('\x01')) && bucket.timestamps.length > 3) {
      return true;
    }

    if (this.settings.protDccFlood && text.toUpperCase().includes('DCC ') && bucket.timestamps.length > 2) {
      return true;
    }

    if (this.settings.protDosAttacks && text.length > 800) {
      return true;
    }

    return false;
  }

  private shouldBlockNetFlood(message: IRCMessage, isChannel: boolean): ProtectionDecision | null {
    if (!isChannel) return null;
    const now = Date.now();
    const network = message.network || '';
    const channel = message.channel || '';
    const key = `${network}:${channel.toLowerCase()}:net`;
    const bucket = this.netFloodBuckets.get(key) || { timestamps: [] };
    bucket.timestamps.push(now);
    bucket.timestamps = bucket.timestamps.filter(ts => now - ts < 5000);
    this.netFloodBuckets.set(key, bucket);

    if (bucket.timestamps.length > 18) {
      return { block: true, kind: 'net_flood', reason: 'net_rate_limit' };
    }

    return null;
  }

  private matchesSpamKeywords(text: string): boolean {
    if (!this.settings.spamPmKeywords.length) return false;
    const lowered = text.toLowerCase();
    return this.settings.spamPmKeywords.some((pattern) => {
      const regex = this.patternToRegex(pattern);
      return regex.test(lowered);
    });
  }

  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .toLowerCase()
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
  }

  private parseExcludeTokens(raw: string): string[] {
    return raw
      .split(/[,\s]+/)
      .map(token => token.trim().toLowerCase())
      .filter(Boolean);
  }

  private containsExcludedToken(text: string, tokens: string[]): boolean {
    const lower = text.toLowerCase();
    return tokens.some(token => lower.includes(token));
  }

  private isChannelTarget(target?: string): boolean {
    if (!target) return false;
    return target.startsWith('#') || target.startsWith('&') || target.startsWith('+') || target.startsWith('!');
  }

  private isTsunamiText(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 200) return false;
    const chars = trimmed.split('');
    const freq: Record<string, number> = {};
    chars.forEach((c) => { freq[c] = (freq[c] || 0) + 1; });
    const maxCount = Math.max(...Object.values(freq));
    const ratio = maxCount / chars.length;
    if (ratio > 0.65) return true;
    const words = trimmed.split(/\s+/);
    if (words.length > 20) {
      const unique = new Set(words.map(w => w.toLowerCase()));
      if (unique.size / words.length < 0.35) {
        return true;
      }
    }
    return false;
  }

  async getSpamLog(): Promise<string> {
    try {
      const exists = await RNFS.exists(LOG_FILE);
      if (!exists) return '';
      return await RNFS.readFile(LOG_FILE, 'utf8');
    } catch {
      return '';
    }
  }

  async clearSpamLog(): Promise<void> {
    try {
      const exists = await RNFS.exists(LOG_FILE);
      if (exists) {
        await RNFS.unlink(LOG_FILE);
      }
    } catch {
      // ignore
    }
  }

  private async logSpam(kind: string, message: IRCMessage): Promise<void> {
    if (!this.settings.spamLoggingEnabled) return;
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${kind.toUpperCase()} ${message.network || ''} ${message.from || ''} ${message.channel || ''} :: ${message.text}\n`;
    try {
      const exists = await RNFS.exists(LOG_FILE);
      if (!exists) {
        await RNFS.writeFile(LOG_FILE, entry, 'utf8');
        return;
      }
      await RNFS.appendFile(LOG_FILE, entry, 'utf8');
    } catch {
      // ignore
    }
  }
}

export const protectionService = new ProtectionService();
