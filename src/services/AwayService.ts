/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { connectionManager } from './ConnectionManager';
import { IRCMessage, IRCService } from './IRCService';
import { settingsService } from './SettingsService';
import { tx } from '../i18n/transifex';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

type AwayState = {
  isAway: boolean;
  reason: string;
  lastActivityAt: number;
  autoAwayTimer?: NodeJS.Timeout;
  announceTimer?: NodeJS.Timeout;
  lastAutoAnswerByNick: Map<string, number>;
  originalNick?: string;
  pendingAwayNick?: string;
  suppressNextClear?: boolean;
};

class AwayService {
  private states: Map<string, AwayState> = new Map();
  private initialized = false;
  private connectionCleanup: Map<string, Array<() => void>> = new Map();
  private settingsCleanup: Array<() => void> = [];
  private disableSoundsWhenAway = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Attach to existing connections
    connectionManager.getAllConnections().forEach(conn => this.attachToConnection(conn.networkId, conn.ircService));

    // Attach to new connections
    const unsubscribe = connectionManager.onConnectionCreated((networkId) => {
      const conn = connectionManager.getConnection(networkId);
      if (conn) {
        this.attachToConnection(networkId, conn.ircService);
      }
    });
    this.settingsCleanup.push(unsubscribe);

    // Refresh timers when auto-away settings change
    const autoAwayEnabledUnsub = settingsService.onSettingChange('autoAwayEnabled', () => {
      this.refreshAutoAwayTimers();
    });
    const autoAwayMinutesUnsub = settingsService.onSettingChange('autoAwayMinutes', () => {
      this.refreshAutoAwayTimers();
    });
    const awayDisableSoundsUnsub = settingsService.onSettingChange('awayDisableSounds', (value) => {
      this.disableSoundsWhenAway = Boolean(value);
    });
    this.settingsCleanup.push(autoAwayEnabledUnsub, autoAwayMinutesUnsub, awayDisableSoundsUnsub);

    settingsService.getSetting('awayDisableSounds', false).then((value) => {
      this.disableSoundsWhenAway = Boolean(value);
    });
  }

  private ensureState(networkId: string): AwayState {
    const existing = this.states.get(networkId);
    if (existing) return existing;
    const state: AwayState = {
      isAway: false,
      reason: '',
      lastActivityAt: Date.now(),
      lastAutoAnswerByNick: new Map(),
    };
    this.states.set(networkId, state);
    return state;
  }

  private attachToConnection(networkId: string, ircService: IRCService): void {
    if (this.connectionCleanup.has(networkId)) {
      return;
    }
    const state = this.ensureState(networkId);
    const cleanup: Array<() => void> = [];

    cleanup.push(ircService.onMessage((message) => this.handleIncomingMessage(networkId, ircService, message)));
    cleanup.push(ircService.on('send-raw', (raw: string) => this.handleOutgoingRaw(networkId, ircService, raw)));
    cleanup.push(ircService.on('numeric', async (numeric: string, _prefix: string, params: string[]) => {
      if (numeric === '305') {
        // RPL_UNAWAY
        state.isAway = false;
        state.reason = '';
        this.stopAnnounceTimer(networkId);
        await this.restoreNickIfNeeded(networkId, ircService);
      }
      if (numeric === '306') {
        // RPL_NOWAWAY
        const reason = params.slice(1).join(' ').replace(/^:/, '').trim();
        state.isAway = true;
        state.reason = reason || state.reason;
        this.startAnnounceTimer(networkId, ircService);
      }
    }));
    cleanup.push(ircService.onConnectionChange((connected) => {
      if (!connected) {
        this.clearTimers(networkId);
        state.isAway = false;
        state.reason = '';
        state.originalNick = undefined;
        state.pendingAwayNick = undefined;
      } else {
        this.scheduleAutoAway(networkId, ircService);
      }
    }));

    this.connectionCleanup.set(networkId, cleanup);
    this.scheduleAutoAway(networkId, ircService);
  }

  private clearTimers(networkId: string): void {
    const state = this.ensureState(networkId);
    if (state.autoAwayTimer) {
      clearTimeout(state.autoAwayTimer);
      state.autoAwayTimer = undefined;
    }
    if (state.announceTimer) {
      clearInterval(state.announceTimer);
      state.announceTimer = undefined;
    }
  }

  private refreshAutoAwayTimers(): void {
    connectionManager.getAllConnections().forEach(conn => {
      this.scheduleAutoAway(conn.networkId, conn.ircService);
    });
  }

  private async scheduleAutoAway(networkId: string, ircService: IRCService): Promise<void> {
    const state = this.ensureState(networkId);
    if (state.autoAwayTimer) {
      clearTimeout(state.autoAwayTimer);
      state.autoAwayTimer = undefined;
    }

    const autoAwayEnabled = await settingsService.getSetting('autoAwayEnabled', false);
    const autoAwayMinutes = await settingsService.getSetting('autoAwayMinutes', 0);
    if (!autoAwayEnabled || autoAwayMinutes <= 0) {
      return;
    }

    const delayMs = autoAwayMinutes * 60 * 1000;
    const now = Date.now();
    const elapsed = now - state.lastActivityAt;
    const remaining = Math.max(delayMs - elapsed, 0);

    state.autoAwayTimer = setTimeout(async () => {
      const reason = await this.getAutoAwayReason();
      await this.setAway(reason, { networkId });
    }, remaining);
  }

  private async handleOutgoingRaw(networkId: string, ircService: IRCService, raw: string): Promise<void> {
    const state = this.ensureState(networkId);
    if (state.suppressNextClear && raw.trim().toUpperCase().startsWith('NOTICE ')) {
      state.suppressNextClear = false;
      return;
    }
    state.lastActivityAt = Date.now();
    await this.scheduleAutoAway(networkId, ircService);

    const upper = raw.trim().toUpperCase();
    if (upper.startsWith('AWAY')) {
      if (upper === 'AWAY') {
        state.isAway = false;
        state.reason = '';
        await this.restoreNickIfNeeded(networkId, ircService);
        this.stopAnnounceTimer(networkId);
      } else {
        state.isAway = true;
        state.reason = raw.split(':').slice(1).join(':').trim();
        await this.applyAwayNick(networkId, ircService);
        this.startAnnounceTimer(networkId, ircService);
      }
      return;
    }

    if (state.isAway) {
      await this.clearAway({ networkId });
    }
  }

  private isChannelTarget(target?: string): boolean {
    if (!target) return false;
    return target.startsWith('#') || target.startsWith('&') || target.startsWith('+') || target.startsWith('!');
  }

  private async handleIncomingMessage(networkId: string, ircService: IRCService, message: IRCMessage): Promise<void> {
    const state = this.ensureState(networkId);
    if (!state.isAway) return;

    if (message.type !== 'message' || !message.from || !message.text) {
      return;
    }

    const awayAutoAnswerEnabled = await settingsService.getSetting('awayAutoAnswerEnabled', false);
    if (!awayAutoAnswerEnabled) {
      return;
    }

    const awayNotifyMentions = await settingsService.getSetting('awayNotifyMentions', false);
    const channel = message.channel || '';
    const isChannel = this.isChannelTarget(channel);
    const currentNick = ircService.getCurrentNick();
    const fromNick = message.from;
    if (!fromNick || fromNick === currentNick) {
      return;
    }

    if (isChannel) {
      const mentionTargets = [currentNick, state.originalNick].filter(Boolean) as string[];
      const mentionsAny = mentionTargets.some(target => this.messageMentionsNick(message.text, target));
      if (!awayNotifyMentions || !mentionsAny) {
        return;
      }
    }

    if (!isChannel && channel && this.isChannelTarget(channel)) {
      return;
    }

    const now = Date.now();
    const lastSent = state.lastAutoAnswerByNick.get(fromNick.toLowerCase()) || 0;
    if (now - lastSent < 60 * 1000) {
      return;
    }

    const autoAnswerMessage = await this.getAutoAnswerMessage();
    const reason = state.reason || (await settingsService.getSetting('awayDefaultReason', ''));
    const reply = reason ? `${autoAnswerMessage} - ${reason}` : autoAnswerMessage;
    state.suppressNextClear = true;
    ircService.sendRaw(`NOTICE ${fromNick} :${reply}`);
    state.lastAutoAnswerByNick.set(fromNick.toLowerCase(), now);
  }

  private messageMentionsNick(text: string, nick: string): boolean {
    if (!nick) return false;
    const escaped = nick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    return re.test(text);
  }

  private async getAutoAnswerMessage(): Promise<string> {
    const direct = await settingsService.getSetting('awayAutoAnswerMessage', 'Away');
    if (direct && direct.trim()) {
      return direct.trim();
    }
    const presets = await settingsService.getSetting('awayAutoAnswerMessages', [] as string[]);
    if (presets.length > 0) {
      return presets[0];
    }
    return t('Away');
  }

  private async getAutoAwayReason(): Promise<string> {
    const autoReason = await settingsService.getSetting('autoAwayReason', '');
    if (autoReason && autoReason.trim()) return autoReason.trim();
    const selectedPreset = await settingsService.getSetting('awaySelectedPreset', '');
    if (selectedPreset && selectedPreset.trim()) return selectedPreset.trim();
    const fallback = await settingsService.getSetting('awayDefaultReason', '');
    if (fallback && fallback.trim()) return fallback.trim();
    const awayText = await settingsService.getSetting('awayTextAway', 'away');
    return awayText || t('Away');
  }

  private async applyAwayNick(networkId: string, ircService: IRCService): Promise<void> {
    const pattern = await settingsService.getSetting('awayNickPattern', '<me>^away');
    if (!pattern || !pattern.includes('<me>')) {
      return;
    }
    const currentNick = ircService.getCurrentNick();
    if (!currentNick) return;
    const awayText = await settingsService.getSetting('awayTextAway', 'away');
    const nextNick = pattern
      .replace(/<me>/gi, currentNick)
      .replace(/\^away/gi, awayText)
      .replace(/\^/g, ' ')
      .trim();
    if (nextNick && nextNick !== currentNick) {
      const state = this.ensureState(networkId);
      if (!state.originalNick) {
        state.originalNick = currentNick;
      }
      state.pendingAwayNick = nextNick;
      ircService.sendRaw(`NICK ${nextNick}`);
    }
  }

  private async restoreNickIfNeeded(networkId: string, ircService: IRCService): Promise<void> {
    const state = this.ensureState(networkId);
    if (state.originalNick) {
      const currentNick = ircService.getCurrentNick();
      if (state.pendingAwayNick || state.originalNick !== currentNick) {
        ircService.sendRaw(`NICK ${state.originalNick}`);
      }
    }
    state.originalNick = undefined;
    state.pendingAwayNick = undefined;
  }

  private startAnnounceTimer(networkId: string, ircService: IRCService): void {
    const state = this.ensureState(networkId);
    this.stopAnnounceTimer(networkId);

    settingsService.getSetting('awayAnnounceEnabled', false).then((enabled) => {
      if (!enabled) {
        return;
      }
      this.announceAway(networkId, ircService);
      settingsService.getSetting('awayAnnounceEveryMin', 5).then((min) => {
        const every = Math.max(Number(min) || 0, 0);
        if (every <= 0) return;
        state.announceTimer = setInterval(() => {
          this.announceAway(networkId, ircService);
        }, every * 60 * 1000);
      });
    });
  }

  private stopAnnounceTimer(networkId: string): void {
    const state = this.ensureState(networkId);
    if (state.announceTimer) {
      clearInterval(state.announceTimer);
      state.announceTimer = undefined;
    }
  }

  private async announceAway(networkId: string, ircService: IRCService): Promise<void> {
    const awayAnnounceEnabled = await settingsService.getSetting('awayAnnounceEnabled', false);
    if (!awayAnnounceEnabled) return;

    const channels = ircService.getChannels();
    if (channels.length === 0) return;

    const onlyOn = await settingsService.getSetting('awayAnnounceOnlyOn', '');
    const excludeOn = await settingsService.getSetting('awayAnnounceExcludeOn', '');
    const allowed = this.parseChannelList(onlyOn);
    const excluded = this.parseChannelList(excludeOn);
    const filtered = channels.filter((channel) => {
      const lower = channel.toLowerCase();
      if (allowed.length > 0 && !allowed.includes(lower)) {
        return false;
      }
      if (excluded.includes(lower)) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) return;

    const textAway = await settingsService.getSetting('awayTextAway', 'away');
    const state = this.ensureState(networkId);
    const reason = state.reason || (await settingsService.getSetting('awayDefaultReason', ''));
    const message = reason ? `${textAway}: ${reason}` : textAway;

    filtered.forEach((channel) => {
      ircService.sendRaw(`PRIVMSG ${channel} :${message}`);
    });
  }

  private parseChannelList(value: string): string[] {
    if (!value) return [];
    return value
      .split(',')
      .map(v => v.trim().toLowerCase())
      .filter(Boolean);
  }

  async setAway(reason?: string, opts?: { networkId?: string }): Promise<void> {
    const multiServer = await settingsService.getSetting('awayMultiServer', false);
    const targetNetwork = opts?.networkId;
    const targetConnections = multiServer
      ? connectionManager.getAllConnections()
      : targetNetwork
        ? [connectionManager.getConnection(targetNetwork)].filter(Boolean)
        : [connectionManager.getActiveConnection()].filter(Boolean);

    if (targetConnections.length === 0) return;

    for (const conn of targetConnections) {
      const state = this.ensureState(conn!.networkId);
      const awayReason = (reason || '').trim();
      const resolvedReason = awayReason || (await settingsService.getSetting('awayDefaultReason', ''));
      const payload = resolvedReason ? `AWAY :${resolvedReason}` : 'AWAY';
      conn!.ircService.sendRaw(payload);
      state.isAway = true;
      state.reason = resolvedReason;
      await this.applyAwayNick(conn!.networkId, conn!.ircService);
      await this.deopOnChannels(conn!.ircService);
      this.startAnnounceTimer(conn!.networkId, conn!.ircService);
    }
  }

  async clearAway(opts?: { networkId?: string }): Promise<void> {
    const multiServer = await settingsService.getSetting('awayMultiServer', false);
    const targetNetwork = opts?.networkId;
    const targetConnections = multiServer
      ? connectionManager.getAllConnections()
      : targetNetwork
        ? [connectionManager.getConnection(targetNetwork)].filter(Boolean)
        : [connectionManager.getActiveConnection()].filter(Boolean);

    for (const conn of targetConnections) {
      conn!.ircService.sendRaw('AWAY');
      const state = this.ensureState(conn!.networkId);
      state.isAway = false;
      state.reason = '';
      await this.restoreNickIfNeeded(conn!.networkId, conn!.ircService);
      this.stopAnnounceTimer(conn!.networkId);
    }
  }

  private async deopOnChannels(ircService: IRCService): Promise<void> {
    const awayDeopOnChannels = await settingsService.getSetting('awayDeopOnChannels', false);
    if (!awayDeopOnChannels) return;
    const nick = ircService.getCurrentNick();
    const channels = ircService.getChannels();
    channels.forEach((channel) => {
      ircService.sendRaw(`MODE ${channel} -o ${nick}`);
    });
  }

  recordActivity(networkId?: string): void {
    const now = Date.now();
    if (networkId) {
      const state = this.ensureState(networkId);
      state.lastActivityAt = now;
      const conn = connectionManager.getConnection(networkId);
      if (conn) {
        this.scheduleAutoAway(networkId, conn.ircService);
      }
      return;
    }
    connectionManager.getAllConnections().forEach(conn => {
      const state = this.ensureState(conn.networkId);
      state.lastActivityAt = now;
      this.scheduleAutoAway(conn.networkId, conn.ircService);
    });
  }

  isAnyAway(): boolean {
    for (const state of this.states.values()) {
      if (state.isAway) return true;
    }
    return false;
  }

  shouldMuteSounds(): boolean {
    return this.disableSoundsWhenAway && this.isAnyAway();
  }
}

export const awayService = new AwayService();
