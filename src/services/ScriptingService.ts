/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { IRCMessage } from './IRCService';
import { connectionManager } from './ConnectionManager';
import { logger } from './Logger';
import { adRewardService } from './AdRewardService';
import { tx } from '../i18n/transifex';
import { useTabStore } from '../stores/tabStore';
import { highlightService } from './HighlightService';
import { channelNotesService } from './ChannelNotesService';
import { messageHistoryService } from './MessageHistoryService';
import { themeService } from './ThemeService';
import { connectionQualityService } from './ConnectionQualityService';
import { settingsService } from './SettingsService';

import { APP_VERSION } from '../config/appVersion';

type HookResult = void | string | { command?: string; cancel?: boolean };

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export interface ScriptConfig {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
  description?: string;
  config?: Record<string, any>;
  builtIn?: boolean;
}

interface CompiledScript extends ScriptConfig {
  hooks?: Partial<ScriptHooks>;
}

interface ScriptHooks {
  onConnect?: (networkId: string) => void;
  onDisconnect?: (networkId: string, reason?: string) => void;
  onMessage?: (message: IRCMessage) => void;
  onNotice?: (message: IRCMessage) => void;
  onJoin?: (channel: string, nick: string, message: IRCMessage) => void;
  onPart?: (channel: string, nick: string, reason: string, message: IRCMessage) => void;
  onQuit?: (nick: string, reason: string, message: IRCMessage) => void;
  onNickChange?: (oldNick: string, newNick: string, message: IRCMessage) => void;
  onKick?: (channel: string, kickedNick: string, kickerNick: string, reason: string, message: IRCMessage) => void;
  onMode?: (channel: string, setterNick: string, mode: string, target?: string, message: IRCMessage) => void;
  onTopic?: (channel: string, topic: string, setterNick: string, message: IRCMessage) => void;
  onInvite?: (channel: string, inviterNick: string, message: IRCMessage) => void;
  onCTCP?: (type: string, from: string, text: string, message: IRCMessage) => void;
  onRaw?: (line: string, direction: 'in' | 'out', message?: IRCMessage) => HookResult;
  onCommand?: (text: string, ctx: { channel?: string; networkId?: string }) => HookResult;
  onTimer?: (name: string) => void;
}

const STORAGE_KEY = '@AndroidIRCX:scripts';
const STORAGE_LOG_KEY = '@AndroidIRCX:scriptLog';
const STORAGE_SETTINGS_KEY = '@AndroidIRCX:scriptSettings';
const DEFAULT_LOG_LIMIT = 200;

export interface ScriptLogEntry {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  scriptId?: string;
}

interface ScriptSettings {
  loggingEnabled: boolean;
}

class ScriptingService {
  private scripts: CompiledScript[] = [];
  private initialized = false;
  private log: ScriptLogEntry[] = [];
  private logLimit = DEFAULT_LOG_LIMIT;
  private settings: ScriptSettings = { loggingEnabled: false };
  private repository: ScriptConfig[] = [];
  private timers: Map<string, NodeJS.Timeout> = new Map();

  async initialize() {
    if (this.initialized) return;
    await this.load();
    await this.loadSettings();
    await this.loadLog();
    await adRewardService.initialize();
    this.repository = this.getBuiltInScripts();
    await this.ensureBuiltInsInstalled();
    this.updateUsageTracking(); // Ensure usage timer starts if scripts were previously enabled
    this.initialized = true;
  }

  async load() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.scripts = [];
        return;
      }
      const parsed: ScriptConfig[] = JSON.parse(raw);
      this.scripts = parsed.map(s => this.compile(s)).filter(Boolean) as CompiledScript[];
    } catch (error) {
      logger.error('scripting', t('Failed to load scripts: {error}', { error: String(error) }));
    }
  }

  async save() {
    const plain: ScriptConfig[] = this.scripts.map(({ hooks, ...rest }) => rest);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plain));
  }

  private async loadSettings() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_SETTINGS_KEY);
      if (raw) {
        this.settings = { ...this.settings, ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
  }

  private async saveSettings() {
    await AsyncStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(this.settings));
  }

  async setLoggingEnabled(enabled: boolean) {
    this.settings.loggingEnabled = enabled;
    await this.saveSettings();
  }

  isLoggingEnabled() {
    return this.settings.loggingEnabled;
  }

  private async loadLog() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_LOG_KEY);
      if (raw) {
        this.log = JSON.parse(raw);
      }
    } catch {
      this.log = [];
    }
  }

  private async persistLog() {
    await AsyncStorage.setItem(STORAGE_LOG_KEY, JSON.stringify(this.log.slice(-this.logLimit)));
  }

  private addLog(entry: Omit<ScriptLogEntry, 'id' | 'ts'>) {
    if (!this.settings.loggingEnabled) return;
    const full: ScriptLogEntry = { ...entry, id: `log-${Date.now()}-${Math.random()}`, ts: Date.now() };
    this.log.push(full);
    if (this.log.length > this.logLimit) {
      this.log = this.log.slice(-this.logLimit);
    }
    this.persistLog();
  }

  getLogs(): ScriptLogEntry[] {
    return [...this.log];
  }

  async clearLogs() {
    this.log = [];
    await this.persistLog();
  }

  lint(code: string): { ok: boolean; message: string } {
    try {
      // Syntax check only; do not execute hooks
      // eslint-disable-next-line no-new-func
      new Function('api', `
        "use strict";
        const exports = {};
        const module = { exports };
        ${code}
        return module.exports || exports;
      `);
      return { ok: true, message: t('No syntax errors detected.') };
    } catch (error: any) {
      return { ok: false, message: String(error?.message || error) };
    }
  }

  list(): ScriptConfig[] {
    return this.scripts.map(({ hooks, ...rest }) => rest);
  }

  listRepository(): ScriptConfig[] {
    return [...this.repository];
  }

  async add(script: ScriptConfig) {
    this.scripts = this.scripts.filter(s => s.id !== script.id);
    const withDefault = { enabled: false, ...script };
    this.scripts.push(this.compile(withDefault as ScriptConfig));
    await this.save();
  }

  async remove(id: string) {
    // Clear all timers for this script
    this.timers.forEach((timer, timerId) => {
      if (timerId.startsWith(id + ':')) {
        clearTimeout(timer);
        this.timers.delete(timerId);
      }
    });
    this.scripts = this.scripts.filter(s => s.id !== id);
    await this.save();
  }

  async setEnabled(id: string, enabled: boolean) {
    // Check if user has available time when enabling a script
    if (enabled && !adRewardService.hasAvailableTime()) {
      const msg = t(
        'Cannot enable script: No scripting time available. Please watch an ad to gain 1 hour of scripting time.'
      );
      logger.warn('scripting', msg);
      this.addLog({ level: 'warn', message: msg, scriptId: id });
      throw new Error(msg);
    }

    // Update the enabled state and recompile the script to ensure hooks are set up
    this.scripts = this.scripts.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, enabled };
      // Recompile the script when enabling to set up hooks
      // (hooks are not set when script is compiled while disabled)
      return enabled ? this.compile(updated) : { ...updated, hooks: undefined };
    });
    await this.save();

    // Start/stop usage tracking based on enabled scripts
    this.updateUsageTracking();
  }

  async installBuiltIns(scripts: ScriptConfig[]) {
    // Replace any existing built-ins with fresh versions
    const builtInIds = new Set(scripts.map(s => s.id));
    const existingBuiltIns = this.scripts.filter(s => s.builtIn && builtInIds.has(s.id));
    this.scripts = this.scripts.filter(s => !(s.builtIn && builtInIds.has(s.id)));
    scripts.forEach(s => {
      const existing = existingBuiltIns.find(prev => prev.id === s.id);
      const merged: ScriptConfig = {
        ...s,
        enabled: existing?.enabled ?? s.enabled,
        config: existing?.config ?? s.config,
      };
      this.scripts.push(this.compile(merged));
    });
    await this.save();
  }

  private async ensureBuiltInsInstalled() {
    const builtIns = this.getBuiltInScripts();
    await this.installBuiltIns(builtIns);
  }

  getBuiltInScripts(): ScriptConfig[] {
    return [
      {
        id: 'builtin-autoop',
        name: t('Auto-Op'),
        enabled: false,
        description: t('Ops everyone who joins the channel.'),
        builtIn: true,
        code: `
          module.exports = {
            onJoin: (channel, nick, msg) => {
              if (nick === msg?.from && msg?.from === api?.userNick) return;
              if (channel && nick && api?.sendCommand) {
                api.sendCommand('MODE ' + channel + ' +o ' + nick, msg?.network);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-welcome',
        name: t('Welcome Message'),
        enabled: false,
        description: t('Greets users when they join.'),
        builtIn: true,
        code: `
          module.exports = {
            onJoin: (channel, nick, msg) => {
              if (!channel || !nick) return;
              if (nick === api?.userNick) return; // skip your own join
              api.sendMessage(channel, 'Welcome, ' + nick + '!', msg?.network);
            }
          };
        `,
      },
      {
        id: 'builtin-logger',
        name: t('Channel Logger'),
        enabled: false,
        description: t('Logs messages to scripting log buffer.'),
        builtIn: true,
        code: `
          module.exports = {
            onMessage: (msg) => {
              if (msg?.channel && msg?.from && msg?.text) {
                api.log('[' + msg.channel + '] <' + msg.from + '> ' + msg.text);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-alias',
        name: t('Custom Command Alias'),
        enabled: false,
        description: t('Adds /hello alias as example.'),
        builtIn: true,
        code: `
          module.exports = {
            onCommand: (text) => {
              if (text.startsWith('/hello')) {
                return '/say Hello there!';
              }
              return text;
            }
          };
        `,
      },
      {
        id: 'builtin-autovoice',
        name: t('Auto-Voice'),
        enabled: false,
        description: t('Automatically voices users when they join.'),
        builtIn: true,
        code: `
          module.exports = {
            onJoin: (channel, nick, msg) => {
              if (!channel || !nick) return;
              if (nick === api?.userNick) return;
              api.sendCommand('MODE ' + channel + ' +v ' + nick, msg?.network);
            }
          };
        `,
      },
      {
        id: 'builtin-kick-protection',
        name: t('Kick Protection'),
        enabled: false,
        description: t('Rejoins channel if kicked.'),
        builtIn: true,
        code: `
          module.exports = {
            onKick: (channel, kickedNick, kickerNick, reason) => {
              if (kickedNick === api?.userNick && channel) {
                api.log('Kicked from ' + channel + ' by ' + kickerNick + ': ' + reason);
                api.sendCommand('JOIN ' + channel);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-ctcp-responder',
        name: t('CTCP Responder'),
        enabled: false,
        description: t('Responds to CTCP VERSION and TIME requests.'),
        builtIn: true,
        code: `
          module.exports = {
            onCTCP: (type, from, text) => {
              if (type === 'VERSION') {
                api.sendCTCP(from, 'VERSION', 'AndroidIRCX ' + api.appVersion + ' (Scripting)');
              } else if (type === 'TIME') {
                api.sendCTCP(from, 'TIME', new Date().toISOString());
              } else if (type === 'PING') {
                api.sendCTCP(from, 'PING', text);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-channel-guard',
        name: t('Channel Guard'),
        enabled: false,
        description: t('Protects channel from bad words (example).'),
        builtIn: true,
        code: `
          module.exports = {
            onMessage: (msg) => {
              if (!msg?.channel || !msg?.text || !msg?.from) return;
              const badWords = ['spam', 'advertisement'];
              const lowerText = msg.text.toLowerCase();
              for (const word of badWords) {
                if (lowerText.includes(word)) {
                  api.log('Bad word detected from ' + msg.from + ' in ' + msg.channel);
                  // Could kick/ban here: api.sendCommand('KICK ' + msg.channel + ' ' + msg.from + ' :No spam');
                  break;
                }
              }
            }
          };
        `,
      },
      {
        id: 'builtin-auto-rejoin',
        name: t('Auto-Rejoin on Part'),
        enabled: false,
        description: t('Automatically rejoins channel if you part.'),
        builtIn: true,
        code: `
          module.exports = {
            onPart: (channel, nick, reason) => {
              if (nick === api?.userNick && channel) {
                api.log('Rejoining ' + channel + ' after part');
                setTimeout(() => {
                  api.sendCommand('JOIN ' + channel);
                }, 2000);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-topic-logger',
        name: t('Topic Logger'),
        enabled: false,
        description: t('Logs topic changes to script log.'),
        builtIn: true,
        code: `
          module.exports = {
            onTopic: (channel, topic, setterNick) => {
              api.log('Topic changed in ' + channel + ' by ' + setterNick + ': ' + topic);
            }
          };
        `,
      },
      {
        id: 'builtin-invite-handler',
        name: t('Invite Handler'),
        enabled: false,
        description: t('Auto-joins channels when invited.'),
        builtIn: true,
        code: `
          module.exports = {
            onInvite: (channel, inviterNick) => {
              api.log('Invited to ' + channel + ' by ' + inviterNick);
              api.sendCommand('JOIN ' + channel);
            }
          };
        `,
      },
      {
        id: 'builtin-mode-logger',
        name: t('Mode Logger'),
        enabled: false,
        description: t('Logs mode changes to script log.'),
        builtIn: true,
        code: `
          module.exports = {
            onMode: (channel, setterNick, mode, target) => {
              const targetStr = target ? ' ' + target : '';
              api.log('Mode ' + mode + ' set in ' + channel + ' by ' + setterNick + targetStr);
            }
          };
        `,
      },
      {
        id: 'builtin-timer-example',
        name: t('Timer Example'),
        enabled: false,
        description: t('Example of using timers - sends periodic message.'),
        builtIn: true,
        code: `
          module.exports = {
            onConnect: (networkId) => {
              // Set a timer that runs every 60 seconds
              api.setTimer('periodic', 60000, true);
            },
            onTimer: (name) => {
              if (name === 'periodic') {
                const channels = api.getChannels();
                if (channels.length > 0) {
                  api.log('Timer fired: ' + channels.length + ' channels joined');
                }
              }
            },
            onDisconnect: (networkId) => {
              api.clearTimer('periodic');
            }
          };
        `,
      },
      {
        id: 'builtin-user-counter',
        name: t('User Counter'),
        enabled: false,
        description: t('Counts users in channels and logs on join/part.'),
        builtIn: true,
        code: `
          module.exports = {
            onJoin: (channel, nick, msg) => {
              if (!channel) return;
              const users = api.getChannelUsers(channel, msg?.network);
              api.log(channel + ' now has ' + users.length + ' users');
            },
            onPart: (channel, nick, reason, msg) => {
              if (!channel) return;
              const users = api.getChannelUsers(channel, msg?.network);
              api.log(channel + ' now has ' + users.length + ' users');
            }
          };
        `,
      },
      {
        id: 'builtin-highlight-tracker',
        name: t('Highlight Tracker'),
        enabled: false,
        description: t('Tracks when your highlight words are mentioned and logs them.'),
        builtIn: true,
        code: `
          module.exports = {
            onMessage: (msg) => {
              if (!msg?.text || !msg?.channel || !msg?.from) return;
              if (msg.from === api.userNick) return;
              if (api.isHighlighted(msg.text)) {
                api.log('*** HIGHLIGHT in ' + msg.channel + ' by ' + msg.from + ': ' + msg.text);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-user-notes-manager',
        name: t('User Notes Manager'),
        enabled: false,
        description: t('Automatically saves notes about users based on their messages.'),
        builtIn: true,
        code: `
          module.exports = {
            onMessage: async (msg) => {
              if (!msg?.from || !msg?.text) return;
              if (msg.from === api.userNick) return;
              const note = await api.getUserNote(msg.from);
              if (!note) {
                // First time seeing this user, create a note
                await api.setUserNote(msg.from, 'First seen: ' + new Date().toLocaleString());
              }
            }
          };
        `,
      },
      {
        id: 'builtin-channel-info-tracker',
        name: t('Channel Info Tracker'),
        enabled: false,
        description: t('Tracks and logs channel information changes.'),
        builtIn: true,
        code: `
          module.exports = {
            onMode: (channel, setterNick, mode, target) => {
              const info = api.getChannelInfo(channel);
              if (info) {
                api.log('Channel ' + channel + ' info updated. Modes: ' + JSON.stringify(info.modes));
              }
            },
            onTopic: (channel, topic, setterNick) => {
              const info = api.getChannelInfo(channel);
              if (info) {
                api.log('Channel ' + channel + ' topic: ' + topic);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-smart-welcome',
        name: t('Smart Welcome'),
        enabled: false,
        description: t('Welcomes users with personalized messages based on user notes.'),
        builtIn: true,
        code: `
          module.exports = {
            onJoin: async (channel, nick, msg) => {
              if (!channel || !nick) return;
              if (nick === api.userNick) return;
              const note = await api.getUserNote(nick, msg?.network);
              if (note) {
                api.sendMessage(channel, 'Welcome back, ' + nick + '! (' + note + ')', msg?.network);
              } else {
                api.sendMessage(channel, 'Welcome, ' + nick + '!', msg?.network);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-message-history-search',
        name: t('Message History Search'),
        enabled: false,
        description: t('Searches message history when you mention /search in a channel.'),
        builtIn: true,
        code: `
          module.exports = {
            onCommand: async (text, ctx) => {
              if (text.startsWith('/search ')) {
                const query = text.substring(8).trim();
                if (query && ctx.channel) {
                  const results = await api.searchHistory({
                    channel: ctx.channel,
                    text: query,
                    limit: 10
                  });
                  api.log('Found ' + results.length + ' messages matching "' + query + '"');
                  results.forEach(msg => {
                    api.log('[' + new Date(msg.timestamp).toLocaleString() + '] <' + msg.from + '> ' + msg.text);
                  });
                  return { cancel: true }; // Cancel the command
                }
              }
              return text;
            }
          };
        `,
      },
      {
        id: 'builtin-channel-bookmark-manager',
        name: t('Channel Bookmark Manager'),
        enabled: false,
        description: t('Automatically bookmarks channels you frequently visit.'),
        builtIn: true,
        code: `
          module.exports = {
            onJoin: async (channel, nick) => {
              if (!channel || nick !== api.userNick) return;
              const visitCount = await api.getStorage('visitCount_' + channel) || 0;
              await api.setStorage('visitCount_' + channel, visitCount + 1);
              if (visitCount >= 5 && !(await api.isChannelBookmarked(channel))) {
                // Auto-bookmark after 5 visits
                api.log('Auto-bookmarking ' + channel + ' after ' + (visitCount + 1) + ' visits');
              }
            }
          };
        `,
      },
      {
        id: 'builtin-connection-monitor',
        name: t('Connection Monitor'),
        enabled: false,
        description: t('Monitors connection quality and logs statistics.'),
        builtIn: true,
        code: `
          module.exports = {
            onConnect: (networkId) => {
              api.setTimer('monitor', 30000, true); // Every 30 seconds
            },
            onTimer: (name) => {
              if (name === 'monitor') {
                const stats = api.getConnectionStats();
                if (stats) {
                  api.log('Connection stats: ' + JSON.stringify(stats));
                }
              }
            },
            onDisconnect: (networkId) => {
              api.clearTimer('monitor');
            }
          };
        `,
      },
      {
        id: 'builtin-auto-highlight-add',
        name: t('Auto Highlight Add'),
        enabled: false,
        description: t('Automatically adds your nick to highlight words when mentioned.'),
        builtIn: true,
        code: `
          module.exports = {
            onConnect: async (networkId) => {
              const nick = api.userNick;
              if (nick) {
                const words = api.getHighlightWords();
                if (!words.includes(nick)) {
                  await api.addHighlightWord(nick);
                  api.log('Added ' + nick + ' to highlight words');
                }
              }
            }
          };
        `,
      },
      {
        id: 'builtin-user-alias-resolver',
        name: t('User Alias Resolver'),
        enabled: false,
        description: t('Resolves user aliases and shows real nicks in logs.'),
        builtIn: true,
        code: `
          module.exports = {
            onMessage: async (msg) => {
              if (!msg?.from) return;
              const alias = await api.getUserAlias(msg.from);
              if (alias) {
                api.log('Message from ' + msg.from + ' (alias: ' + alias + ')');
              }
            }
          };
        `,
      },
      {
        id: 'builtin-channel-notes-reminder',
        name: t('Channel Notes Reminder'),
        enabled: false,
        description: t('Shows channel notes when you join a channel.'),
        builtIn: true,
        code: `
          module.exports = {
            onJoin: async (channel, nick, msg) => {
              if (!channel || nick !== api.userNick) return;
              const note = await api.getChannelNote(channel, msg?.network);
              if (note) {
                api.log('Channel note for ' + channel + ': ' + note);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-tab-manager',
        name: t('Tab Manager'),
        enabled: false,
        description: t('Logs tab activity and manages tab switching.'),
        builtIn: true,
        code: `
          module.exports = {
            onMessage: (msg) => {
              if (!msg?.channel) return;
              const tabs = api.getTabs();
              const activeTab = api.getActiveTab();
              api.log('Active tab: ' + (activeTab?.name || 'none') + ', Total tabs: ' + tabs.length);
            }
          };
        `,
      },
      {
        id: 'builtin-ignore-list-manager',
        name: t('Ignore List Manager'),
        enabled: false,
        description: t('Logs when ignored users try to message you.'),
        builtIn: true,
        code: `
          module.exports = {
            onMessage: (msg) => {
              if (!msg?.from) return;
              if (api.isIgnored(msg.from)) {
                api.log('Ignored user ' + msg.from + ' tried to message: ' + (msg.text || ''));
              }
            }
          };
        `,
      },
      {
        id: 'builtin-whois-tracker',
        name: t('WHOIS Tracker'),
        enabled: false,
        description: t('Tracks WHOIS information for users and logs it.'),
        builtIn: true,
        code: `
          module.exports = {
            onJoin: async (channel, nick, msg) => {
              if (!nick || nick === api.userNick) return;
              const userInfo = await api.getUserInfo(nick, msg?.network);
              if (userInfo) {
                api.log('User ' + nick + ' info: ' + JSON.stringify(userInfo));
              }
            }
          };
        `,
      },
      {
        id: 'builtin-message-stats',
        name: t('Message Statistics'),
        enabled: false,
        description: t('Tracks message statistics and shows them periodically.'),
        builtIn: true,
        code: `
          module.exports = {
            onConnect: (networkId) => {
              api.setTimer('stats', 300000, true); // Every 5 minutes
            },
            onTimer: async (name) => {
              if (name === 'stats') {
                const stats = await api.getHistoryStats();
                if (stats) {
                  api.log('Message stats: ' + JSON.stringify(stats));
                }
              }
            },
            onDisconnect: (networkId) => {
              api.clearTimer('stats');
            }
          };
        `,
      },
      {
        id: 'builtin-theme-aware-logger',
        name: t('Theme-Aware Logger'),
        enabled: false,
        description: t('Logs theme information and adapts behavior based on theme.'),
        builtIn: true,
        code: `
          module.exports = {
            onConnect: (networkId) => {
              const theme = api.getTheme();
              if (theme) {
                api.log('Current theme: ' + theme.name + ' (dark: ' + theme.isDark + ')');
              }
            }
          };
        `,
      },
      {
        id: 'builtin-channel-user-tracker',
        name: t('Channel User Tracker'),
        enabled: false,
        description: t('Tracks user activity in channels and logs user counts.'),
        builtIn: true,
        code: `
          module.exports = {
            onJoin: (channel, nick, msg) => {
              if (!channel) return;
              const users = api.getChannelUsers(channel, msg?.network);
              const opCount = users.filter(u => u.startsWith('@')).length;
              const voiceCount = users.filter(u => u.startsWith('+')).length;
              api.log(channel + ': ' + users.length + ' users (' + opCount + ' ops, ' + voiceCount + ' voiced)');
            }
          };
        `,
      },
      {
        id: 'builtin-smart-ctcp-handler',
        name: t('Smart CTCP Handler'),
        enabled: false,
        description: t('Enhanced CTCP handler with logging and custom responses.'),
        builtIn: true,
        code: `
          module.exports = {
            onCTCP: (type, from, text) => {
              api.log('CTCP ' + type + ' from ' + from);
              if (type === 'VERSION') {
                const theme = api.getTheme();
                api.sendCTCP(from, 'VERSION', 'AndroidIRCX ' + api.appVersion + ' (Theme: ' + (theme?.name || 'default') + ')');
              } else if (type === 'TIME') {
                api.sendCTCP(from, 'TIME', new Date().toISOString());
              } else if (type === 'PING') {
                api.sendCTCP(from, 'PING', text);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-channel-mode-protector',
        name: t('Channel Mode Protector'),
        enabled: false,
        description: t('Monitors channel mode changes and logs important ones.'),
        builtIn: true,
        code: `
          module.exports = {
            onMode: (channel, setterNick, mode, target) => {
              if (!channel) return;
              const info = api.getChannelInfo(channel);
              if (info && info.modes) {
                // Log important mode changes
                if (mode.includes('+k') || mode.includes('-k')) {
                  api.log('Channel key changed in ' + channel + ' by ' + setterNick);
                }
                if (mode.includes('+l') || mode.includes('-l')) {
                  api.log('Channel limit changed in ' + channel + ' by ' + setterNick);
                }
              }
            }
          };
        `,
      },
      {
        id: 'builtin-multi-network-monitor',
        name: t('Multi-Network Monitor'),
        enabled: false,
        description: t('Monitors all connected networks and logs their status.'),
        builtIn: true,
        code: `
          module.exports = {
            onConnect: (networkId) => {
              api.setTimer('networkCheck', 60000, true); // Every minute
            },
            onTimer: (name) => {
              if (name === 'networkCheck') {
                const networks = api.getAllNetworks();
                api.log('Connected networks: ' + networks.length);
                networks.forEach(net => {
                  api.log('  - ' + net.networkId + ': ' + (net.isConnected ? 'connected' : 'disconnected'));
                });
              }
            },
            onDisconnect: (networkId) => {
              api.clearTimer('networkCheck');
            }
          };
        `,
      },
      {
        id: 'builtin-storage-example',
        name: t('Storage Example'),
        enabled: false,
        description: t('Demonstrates using script storage to persist data.'),
        builtIn: true,
        code: `
          module.exports = {
            onConnect: async (networkId) => {
              const lastConnect = await api.getStorage('lastConnect');
              if (lastConnect) {
                api.log('Last connected: ' + new Date(lastConnect).toLocaleString());
              }
              await api.setStorage('lastConnect', api.now());
            },
            onMessage: async (msg) => {
              if (!msg?.from) return;
              const msgCount = await api.getStorage('messageCount') || 0;
              await api.setStorage('messageCount', msgCount + 1);
              if ((msgCount + 1) % 100 === 0) {
                api.log('Processed ' + (msgCount + 1) + ' messages');
              }
            }
          };
        `,
      },
      {
        id: 'builtin-notice-handler',
        name: t('Notice Handler'),
        enabled: false,
        description: t('Handles NOTICE messages and logs important ones.'),
        builtIn: true,
        code: `
          module.exports = {
            onNotice: (msg) => {
              if (!msg?.from || !msg?.text) return;
              api.log('NOTICE from ' + msg.from + ': ' + msg.text);
              // Check if it's a server notice
              if (msg.from.includes('.')) {
                api.log('Server notice detected');
              }
            }
          };
        `,
      },
      {
        id: 'builtin-nick-change-tracker',
        name: t('Nick Change Tracker'),
        enabled: false,
        description: t('Tracks nick changes and updates user notes.'),
        builtIn: true,
        code: `
          module.exports = {
            onNickChange: async (oldNick, newNick) => {
              api.log('Nick change: ' + oldNick + ' -> ' + newNick);
              // Copy notes from old nick to new nick
              const oldNote = await api.getUserNote(oldNick);
              if (oldNote) {
                await api.setUserNote(newNick, oldNote + ' (was ' + oldNick + ')');
              }
            }
          };
        `,
      },
      {
        id: 'builtin-quit-tracker',
        name: t('Quit Tracker'),
        enabled: false,
        description: t('Tracks when users quit and logs their reasons.'),
        builtIn: true,
        code: `
          module.exports = {
            onQuit: (nick, reason) => {
              api.log('User ' + nick + ' quit: ' + reason);
              // Check if user was in any of your channels
              const channels = api.getChannels();
              channels.forEach(channel => {
                const users = api.getChannelUsers(channel);
                if (users.includes(nick)) {
                  api.log('  Was in channel: ' + channel);
                }
              });
            }
          };
        `,
      },
      {
        id: 'builtin-kick-logger',
        name: t('Kick Logger'),
        enabled: false,
        description: t('Logs all kick events with details.'),
        builtIn: true,
        code: `
          module.exports = {
            onKick: (channel, kickedNick, kickerNick, reason) => {
              api.log('KICK: ' + kickerNick + ' kicked ' + kickedNick + ' from ' + channel + ' (' + reason + ')');
              if (kickedNick === api.userNick) {
                api.log('*** You were kicked from ' + channel);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-invite-logger',
        name: t('Invite Logger'),
        enabled: false,
        description: t('Logs all channel invites with user info.'),
        builtIn: true,
        code: `
          module.exports = {
            onInvite: async (channel, inviterNick) => {
              api.log('Invited to ' + channel + ' by ' + inviterNick);
              const userInfo = await api.getUserInfo(inviterNick);
              if (userInfo) {
                api.log('  Inviter info: ' + JSON.stringify(userInfo));
              }
            }
          };
        `,
      },
    ];
  }

  private compile(script: ScriptConfig): CompiledScript {
    const safeScript: CompiledScript = { ...script };
    if (!script.enabled) return safeScript;
    try {
      const api = this.makeApi(script);
      const factory = new Function('api', `
        "use strict";
        const exports = {};
        const module = { exports };
        ${script.code}
        return module.exports || exports;
      `);
      const hooks = factory(api) as Partial<ScriptHooks>;
      safeScript.hooks = hooks;
    } catch (error) {
      const msg = t('Script {name} failed to compile: {error}', {
        name: script.name,
        error: String(error),
      });
      logger.error('scripting', msg);
      this.addLog({ level: 'error', message: msg, scriptId: script.id });
    }
    return safeScript;
  }

  // Security: Validate and sanitize inputs
  private sanitizeChannel(channel: string): string | null {
    if (!channel || typeof channel !== 'string') return null;
    const trimmed = channel.trim();
    // Basic validation - must start with #, &, +, ! or be a valid nick
    if (trimmed.length === 0 || trimmed.length > 200) return null;
    return trimmed;
  }

  private sanitizeNick(nick: string): string | null {
    if (!nick || typeof nick !== 'string') return null;
    const trimmed = nick.trim();
    if (trimmed.length === 0 || trimmed.length > 50) return null;
    // Basic IRC nick validation
    if (!/^[a-zA-Z_\[\]\\`^{}|][a-zA-Z0-9_\[\]\\`^{}|-]*$/.test(trimmed)) return null;
    return trimmed;
  }

  private validateNetworkId(networkId?: string): string | null {
    const net = networkId || connectionManager.getActiveNetworkId();
    if (!net) return null;
    const conn = connectionManager.getConnection(net);
    return conn ? net : null;
  }

  private makeApi(script: ScriptConfig) {
    return {
      // Logging
      log: (msg: string) => {
        if (typeof msg !== 'string') return;
        logger.info('script', msg);
        this.addLog({ level: 'info', message: String(msg).substring(0, 500), scriptId: script.id });
      },
      warn: (msg: string) => {
        if (typeof msg !== 'string') return;
        logger.warn('script', msg);
        this.addLog({ level: 'warn', message: String(msg).substring(0, 500), scriptId: script.id });
      },
      error: (msg: string) => {
        if (typeof msg !== 'string') return;
        logger.error('script', msg);
        this.addLog({ level: 'error', message: String(msg).substring(0, 500), scriptId: script.id });
      },

      // User info - use getter to get current nick at execution time
      get userNick() {
        return connectionManager.getActiveConnection()?.ircService.getCurrentNick() || '';
      },

      // App version (from app.json) for CTCP VERSION etc.
      get appVersion() {
        return APP_VERSION;
      },

      // Config
      getConfig: () => script.config || {},

      // Messaging
      sendMessage: (channel: string, text: string, networkId?: string) => {
        const chan = this.sanitizeChannel(channel);
        if (!chan || typeof text !== 'string' || text.length > 500) return;
        const net = this.validateNetworkId(networkId);
        if (!net) return;
        const conn = connectionManager.getConnection(net);
        conn?.ircService.sendMessage(chan, text.substring(0, 500));
      },
      sendCommand: (command: string, networkId?: string) => {
        if (typeof command !== 'string' || command.length > 500) return;
        const net = this.validateNetworkId(networkId);
        if (!net) return;
        const conn = connectionManager.getConnection(net);
        conn?.ircService.sendCommand(command.substring(0, 500));
      },
      sendNotice: (target: string, text: string, networkId?: string) => {
        const tgt = this.sanitizeChannel(target) || this.sanitizeNick(target);
        if (!tgt || typeof text !== 'string' || text.length > 500) return;
        const net = this.validateNetworkId(networkId);
        if (!net) return;
        const conn = connectionManager.getConnection(net);
        conn?.ircService.sendCommand(`NOTICE ${tgt} :${text.substring(0, 500)}`);
      },
      sendCTCP: (target: string, type: string, params?: string, networkId?: string) => {
        const tgt = this.sanitizeNick(target);
        if (!tgt || typeof type !== 'string') return;
        const net = this.validateNetworkId(networkId);
        if (!net) return;
        const conn = connectionManager.getConnection(net);
        const ctcp = params ? `\x01${type} ${params}\x01` : `\x01${type}\x01`;
        conn?.ircService.sendMessage(tgt, ctcp);
      },

      // Channel operations
      getChannelUsers: (channel: string, networkId?: string): string[] => {
        const chan = this.sanitizeChannel(channel);
        if (!chan) return [];
        const net = this.validateNetworkId(networkId);
        if (!net) return [];
        const conn = connectionManager.getConnection(net);
        const users = conn?.ircService.getChannelUsers(chan) || [];
        return users.map(u => u.nick);
      },
      getChannels: (networkId?: string): string[] => {
        const net = this.validateNetworkId(networkId);
        if (!net) return [];
        const conn = connectionManager.getConnection(net);
        return conn?.ircService.getChannels() || [];
      },
      getChannelInfo: (channel: string, networkId?: string) => {
        const chan = this.sanitizeChannel(channel);
        if (!chan) return null;
        const net = this.validateNetworkId(networkId);
        if (!net) return null;
        const conn = connectionManager.getConnection(net);
        return conn?.channelManagementService.getChannelInfo(chan) || null;
      },

      // Tab management
      getTabs: () => {
        return useTabStore.getState().tabs.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
          networkId: t.networkId,
          hasActivity: t.hasActivity,
        }));
      },
      getActiveTab: () => {
        const tab = useTabStore.getState().getActiveTab();
        return tab ? {
          id: tab.id,
          name: tab.name,
          type: tab.type,
          networkId: tab.networkId,
        } : null;
      },
      switchToTab: (tabId: string) => {
        if (typeof tabId !== 'string') return;
        const tab = useTabStore.getState().getTabById(tabId);
        if (tab) {
          useTabStore.getState().setActiveTabId(tabId);
        }
      },

      // User management
      getUserInfo: async (nick: string, networkId?: string) => {
        const n = this.sanitizeNick(nick);
        if (!n) return null;
        const net = this.validateNetworkId(networkId);
        if (!net) return null;
        const conn = connectionManager.getConnection(net);
        if (!conn) return null;
        try {
          return await conn.userManagementService.getWHOISInfo(n, net) || null;
        } catch {
          return null;
        }
      },
      getUserNote: async (nick: string, networkId?: string) => {
        const n = this.sanitizeNick(nick);
        if (!n) return null;
        const net = this.validateNetworkId(networkId);
        if (!net) return null;
        const conn = connectionManager.getConnection(net);
        if (!conn) return null;
        try {
          return await conn.userManagementService.getUserNote(n, net) || null;
        } catch {
          return null;
        }
      },
      setUserNote: async (nick: string, note: string, networkId?: string) => {
        const n = this.sanitizeNick(nick);
        if (!n || typeof note !== 'string' || note.length > 1000) return;
        const net = this.validateNetworkId(networkId);
        if (!net) return;
        const conn = connectionManager.getConnection(net);
        if (!conn) return;
        try {
          await conn.userManagementService.setUserNote(n, note.substring(0, 1000), net);
        } catch (e) {
          this.addLog({ level: 'error', message: `Failed to set user note: ${e}`, scriptId: script.id });
        }
      },
      getUserAlias: async (nick: string, networkId?: string) => {
        const n = this.sanitizeNick(nick);
        if (!n) return null;
        const net = this.validateNetworkId(networkId);
        if (!net) return null;
        const conn = connectionManager.getConnection(net);
        if (!conn) return null;
        try {
          return await conn.userManagementService.getUserAlias(n, net) || null;
        } catch {
          return null;
        }
      },
      setUserAlias: async (nick: string, alias: string, networkId?: string) => {
        const n = this.sanitizeNick(nick);
        if (!n || typeof alias !== 'string' || alias.length > 50) return;
        const net = this.validateNetworkId(networkId);
        if (!net) return;
        const conn = connectionManager.getConnection(net);
        if (!conn) return;
        try {
          await conn.userManagementService.setUserAlias(n, alias.substring(0, 50), net);
        } catch (e) {
          this.addLog({ level: 'error', message: `Failed to set user alias: ${e}`, scriptId: script.id });
        }
      },
      isIgnored: (nick: string, networkId?: string) => {
        const n = this.sanitizeNick(nick);
        if (!n) return false;
        const net = this.validateNetworkId(networkId);
        if (!net) return false;
        const conn = connectionManager.getConnection(net);
        if (!conn) return false;
        try {
          return conn.userManagementService.isIgnored(n, net);
        } catch {
          return false;
        }
      },

      // Channel notes
      getChannelNote: async (channel: string, networkId?: string) => {
        const chan = this.sanitizeChannel(channel);
        if (!chan) return null;
        const net = this.validateNetworkId(networkId);
        if (!net) return null;
        try {
          return await channelNotesService.getNote(net, chan) || null;
        } catch {
          return null;
        }
      },
      setChannelNote: async (channel: string, note: string, networkId?: string) => {
        const chan = this.sanitizeChannel(channel);
        if (!chan || typeof note !== 'string' || note.length > 2000) return;
        const net = this.validateNetworkId(networkId);
        if (!net) return;
        try {
          await channelNotesService.setNote(net, chan, note.substring(0, 2000));
        } catch (e) {
          this.addLog({ level: 'error', message: `Failed to set channel note: ${e}`, scriptId: script.id });
        }
      },
      isChannelBookmarked: async (channel: string, networkId?: string) => {
        const chan = this.sanitizeChannel(channel);
        if (!chan) return false;
        const net = this.validateNetworkId(networkId);
        if (!net) return false;
        try {
          return await channelNotesService.isBookmarked(net, chan);
        } catch {
          return false;
        }
      },

      // Highlight words
      getHighlightWords: () => {
        return highlightService.getHighlightWords();
      },
      addHighlightWord: async (word: string) => {
        if (typeof word !== 'string' || word.length > 100) return;
        try {
          await highlightService.addHighlightWord(word.substring(0, 100));
        } catch (e) {
          this.addLog({ level: 'error', message: `Failed to add highlight word: ${e}`, scriptId: script.id });
        }
      },
      removeHighlightWord: async (word: string) => {
        if (typeof word !== 'string') return;
        try {
          await highlightService.removeHighlightWord(word);
        } catch (e) {
          this.addLog({ level: 'error', message: `Failed to remove highlight word: ${e}`, scriptId: script.id });
        }
      },
      isHighlighted: (text: string) => {
        if (typeof text !== 'string') return false;
        return highlightService.isHighlighted(text);
      },

      // Message history
      searchHistory: async (filter: {
        network?: string;
        channel?: string;
        from?: string;
        text?: string;
        startDate?: number;
        endDate?: number;
        limit?: number;
      }) => {
        if (!filter || typeof filter !== 'object') return [];
        const limit = Math.min(Math.max(1, filter.limit || 100), 1000); // Max 1000 results
        try {
          const results = await messageHistoryService.searchMessages({
            network: filter.network,
            channel: filter.channel,
            from: filter.from,
            text: filter.text,
            startDate: filter.startDate,
            endDate: filter.endDate,
          });
          return results.slice(0, limit);
        } catch {
          return [];
        }
      },
      getHistoryStats: async (networkId?: string) => {
        const net = this.validateNetworkId(networkId);
        if (!net) return null;
        try {
          return await messageHistoryService.getStatistics(net) || null;
        } catch {
          return null;
        }
      },

      // Settings (read-only for security)
      getSetting: async (key: string) => {
        if (typeof key !== 'string') return null;
        // Only allow safe settings to be read
        const safeKeys = ['nick', 'username', 'realname', 'partMessage', 'quitMessage'];
        if (!safeKeys.includes(key)) return null;
        try {
          return await settingsService.getSetting(key);
        } catch {
          return null;
        }
      },

      // Theme
      getTheme: () => {
        try {
          const theme = themeService.getCurrentTheme();
          return {
            name: theme.name,
            isDark: theme.isDark,
          };
        } catch {
          return null;
        }
      },

      // Connection stats
      getConnectionStats: (networkId?: string) => {
        const net = this.validateNetworkId(networkId);
        if (!net) return null;
        try {
          return connectionQualityService.getStatistics() || null;
        } catch {
          return null;
        }
      },

      // Timers
      setTimer: (name: string, delay: number, repeat: boolean = false) => {
        if (typeof name !== 'string' || typeof delay !== 'number' || delay < 0 || delay > 3600000) return;
        const timerId = `${script.id}:${name}`;
        if (this.timers.has(timerId)) {
          clearTimeout(this.timers.get(timerId)!);
        }
        const timer = setTimeout(() => {
          this.runHook('onTimer', (h) => {
            const scriptHook = this.scripts.find(s => s.id === script.id)?.hooks;
            scriptHook?.onTimer?.(name);
          });
          if (repeat) {
            this.timers.set(timerId, setTimeout(() => {
              this.makeApi(script).setTimer(name, delay, repeat);
            }, delay));
          } else {
            this.timers.delete(timerId);
          }
        }, Math.min(delay, 3600000)); // Max 1 hour
        this.timers.set(timerId, timer);
      },
      clearTimer: (name: string) => {
        if (typeof name !== 'string') return;
        const timerId = `${script.id}:${name}`;
        const timer = this.timers.get(timerId);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(timerId);
        }
      },

      // Network operations
      getNetworkId: () => connectionManager.getActiveNetworkId(),
      getAllNetworks: () => {
        return connectionManager.getAllConnections().map(c => ({
          networkId: c.networkId,
          isConnected: c.isConnected,
        }));
      },
      isConnected: (networkId?: string): boolean => {
        const net = this.validateNetworkId(networkId);
        if (!net) return false;
        const conn = connectionManager.getConnection(net);
        return conn?.ircService.isConnected || false;
      },

      // Storage helpers (script-specific)
      getStorage: async (key: string) => {
        if (typeof key !== 'string' || key.length > 100) return null;
        try {
          const storageKey = `@AndroidIRCX:script:${script.id}:${key}`;
          const value = await AsyncStorage.getItem(storageKey);
          return value ? JSON.parse(value) : null;
        } catch {
          return null;
        }
      },
      setStorage: async (key: string, value: any) => {
        if (typeof key !== 'string' || key.length > 100) return;
        try {
          const storageKey = `@AndroidIRCX:script:${script.id}:${key}`;
          await AsyncStorage.setItem(storageKey, JSON.stringify(value));
        } catch (e) {
          this.addLog({ level: 'error', message: `Failed to set storage: ${e}`, scriptId: script.id });
        }
      },
      removeStorage: async (key: string) => {
        if (typeof key !== 'string' || key.length > 100) return;
        try {
          const storageKey = `@AndroidIRCX:script:${script.id}:${key}`;
          await AsyncStorage.removeItem(storageKey);
        } catch (e) {
          this.addLog({ level: 'error', message: `Failed to remove storage: ${e}`, scriptId: script.id });
        }
      },

      // Utility functions
      now: () => Date.now(),
      sleep: (ms: number) => {
        return new Promise(resolve => setTimeout(resolve, Math.min(Math.max(0, ms), 10000)));
      },
    };
  }

  handleConnect(networkId: string) {
    this.runHook('onConnect', (h) => h.onConnect?.(networkId));
  }

  handleMessage(message: IRCMessage) {
    // Handle regular messages
    if (message.type === 'message') {
      this.runHook('onMessage', (h) => h.onMessage?.(message));
    } else if (message.type === 'notice') {
      this.runHook('onNotice', (h) => h.onNotice?.(message));
    } else if (message.type === 'join' && message.channel && message.from) {
      this.runHook('onJoin', (h) => h.onJoin?.(message.channel!, message.from!, message));
    } else if (message.type === 'part' && message.channel && message.from) {
      const reason = message.text || '';
      this.runHook('onPart', (h) => h.onPart?.(message.channel!, message.from!, reason, message));
    } else if (message.type === 'quit' && message.from) {
      const reason = message.text || '';
      this.runHook('onQuit', (h) => h.onQuit?.(message.from!, reason, message));
    } else if (message.type === 'nick' && message.from && message.text) {
      const oldNick = message.from;
      const newNick = message.text.replace(/^:/, '').trim();
      this.runHook('onNickChange', (h) => h.onNickChange?.(oldNick, newNick, message));
    } else if (message.type === 'mode' && message.channel && message.from) {
      // Parse mode change: +o nick or -v nick, etc.
      const modeText = message.text || '';
      const parts = modeText.split(' ');
      const mode = parts[0] || '';
      const target = parts[1] || undefined;
      this.runHook('onMode', (h) => h.onMode?.(message.channel!, message.from!, mode, target, message));
    } else if (message.type === 'topic' && message.channel) {
      const topic = message.text || '';
      const setterNick = message.from || '';
      this.runHook('onTopic', (h) => h.onTopic?.(message.channel!, topic, setterNick, message));
    } else if (message.type === 'invite' && message.channel && message.from) {
      this.runHook('onInvite', (h) => h.onInvite?.(message.channel!, message.from!, message));
    }
    
    // Handle CTCP in message text
    if (message.text && message.text.startsWith('\x01') && message.text.endsWith('\x01')) {
      const ctcpContent = message.text.slice(1, -1);
      const spaceIndex = ctcpContent.indexOf(' ');
      const ctcpType = spaceIndex > 0 ? ctcpContent.substring(0, spaceIndex).toUpperCase() : ctcpContent.toUpperCase();
      const ctcpText = spaceIndex > 0 ? ctcpContent.substring(spaceIndex + 1) : '';
      this.runHook('onCTCP', (h) => h.onCTCP?.(ctcpType, message.from || '', ctcpText, message));
    }
  }
  
  handleDisconnect(networkId: string, reason?: string) {
    this.runHook('onDisconnect', (h) => h.onDisconnect?.(networkId, reason));
    // Clear all timers for this network
    this.timers.forEach((timer, timerId) => {
      if (timerId.startsWith(networkId + ':')) {
        clearTimeout(timer);
        this.timers.delete(timerId);
      }
    });
  }
  
  handleRaw(line: string, direction: 'in' | 'out', message?: IRCMessage): string | null {
    let current = line;
    this.runHook('onRaw', (h) => {
      const result = h.onRaw?.(current, direction, message);
      if (typeof result === 'string') {
        current = result;
      } else if (result && typeof result === 'object') {
        if (result.cancel) {
          current = '';
        } else if (result.command) {
          current = result.command;
        }
      }
    });
    return current || null;
  }

  processOutgoingCommand(text: string, ctx: { channel?: string; networkId?: string }): string | null {
    let current = text;
    this.runHook('onCommand', (h) => {
      const result = h.onCommand?.(current, ctx);
      if (typeof result === 'string') {
        current = result;
      } else if (result && typeof result === 'object') {
        if (result.cancel) {
          current = '';
        } else if (result.command) {
          current = result.command;
        }
      }
    });
    return current || null;
  }

  private updateUsageTracking() {
    const hasEnabledScripts = this.scripts.some(s => s.enabled);

    if (hasEnabledScripts && adRewardService.hasAvailableTime()) {
      if (!adRewardService.isTracking()) {
        adRewardService.startUsageTracking();
      }
    } else {
      if (adRewardService.isTracking()) {
        adRewardService.stopUsageTracking();
      }
      // Disable all scripts if time runs out
      if (!adRewardService.hasAvailableTime() && hasEnabledScripts) {
        this.scripts = this.scripts.map(s => ({ ...s, enabled: false }));
        this.save();
        const msg = t('All scripts disabled: Scripting time expired. Watch an ad to continue.');
        logger.warn('scripting', msg);
        this.addLog({ level: 'warn', message: msg });
      }
    }
  }

  private runHook(hook: keyof ScriptHooks, runner: (hooks: ScriptHooks) => void) {
    // Check if user has available time before running hooks
    if (!adRewardService.hasAvailableTime()) {
      this.updateUsageTracking(); // This will disable all scripts
      return;
    }

    this.scripts.forEach(script => {
      if (!script.enabled || !script.hooks) return;
      try {
        runner(script.hooks);
      } catch (error) {
        const msg = t('Error in script {name} hook {hook}: {error}', {
          name: script.name,
          hook,
          error: String(error),
        });
        logger.error('scripting', msg);
        this.addLog({ level: 'error', message: msg, scriptId: script.id });
      }
    });
  }

  testHook(scriptId: string, hook: keyof ScriptHooks) {
    const script = this.scripts.find(s => s.id === scriptId && s.hooks);
    if (!script || !script.hooks) return;
    const sampleMsg: IRCMessage = {
      id: 'sample',
      type: 'message',
      channel: '#test',
      from: 'tester',
      text: 'hello world',
      timestamp: Date.now(),
    };
    try {
      switch (hook) {
        case 'onConnect':
          script.hooks.onConnect?.('sampleNet');
          break;
        case 'onDisconnect':
          script.hooks.onDisconnect?.('sampleNet', 'Test disconnect');
          break;
        case 'onMessage':
          script.hooks.onMessage?.(sampleMsg);
          break;
        case 'onNotice':
          script.hooks.onNotice?.({ ...sampleMsg, type: 'notice' });
          break;
        case 'onJoin':
          script.hooks.onJoin?.('#test', 'tester', sampleMsg);
          break;
        case 'onPart':
          script.hooks.onPart?.('#test', 'tester', 'Leaving', sampleMsg);
          break;
        case 'onQuit':
          script.hooks.onQuit?.('tester', 'Goodbye', sampleMsg);
          break;
        case 'onNickChange':
          script.hooks.onNickChange?.('tester', 'tester2', sampleMsg);
          break;
        case 'onKick':
          script.hooks.onKick?.('#test', 'victim', 'kicker', 'Reason', sampleMsg);
          break;
        case 'onMode':
          script.hooks.onMode?.('#test', 'op', '+o', 'user', sampleMsg);
          break;
        case 'onTopic':
          script.hooks.onTopic?.('#test', 'New topic', 'setter', sampleMsg);
          break;
        case 'onInvite':
          script.hooks.onInvite?.('#test', 'inviter', sampleMsg);
          break;
        case 'onCTCP':
          script.hooks.onCTCP?.('VERSION', 'tester', '', sampleMsg);
          break;
        case 'onRaw':
          script.hooks.onRaw?.('PRIVMSG #test :hello', 'in', sampleMsg);
          break;
        case 'onCommand':
          script.hooks.onCommand?.('/echo hi', { channel: '#test', networkId: 'sampleNet' });
          break;
        case 'onTimer':
          script.hooks.onTimer?.('testTimer');
          break;
        default:
          break;
      }
      this.addLog({
        level: 'info',
        message: t('Test hook {hook} executed', { hook }),
        scriptId: script.id,
      });
    } catch (error) {
      const msg = t('Test hook {hook} failed for {name}: {error}', {
        hook,
        name: script.name,
        error: String(error),
      });
      this.addLog({ level: 'error', message: msg, scriptId: script.id });
      logger.error('scripting', msg);
    }
  }
}

export const scriptingService = new ScriptingService();
