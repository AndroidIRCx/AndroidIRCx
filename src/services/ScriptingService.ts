import AsyncStorage from '@react-native-async-storage/async-storage';
import { IRCMessage } from './IRCService';
import { connectionManager } from './ConnectionManager';
import { logger } from './Logger';
import { adRewardService } from './AdRewardService';

type HookResult = void | string | { command?: string; cancel?: boolean };

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
  onMessage?: (message: IRCMessage) => void;
  onJoin?: (channel: string, nick: string, message: IRCMessage) => void;
  onCommand?: (text: string, ctx: { channel?: string; networkId?: string }) => HookResult;
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
      logger.error('scripting', `Failed to load scripts: ${String(error)}`);
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
      return { ok: true, message: 'No syntax errors detected.' };
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
    this.scripts = this.scripts.filter(s => s.id !== id);
    await this.save();
  }

  async setEnabled(id: string, enabled: boolean) {
    // Check if user has available time when enabling a script
    if (enabled && !adRewardService.hasAvailableTime()) {
      const msg = 'Cannot enable script: No scripting time available. Please watch an ad to gain 1 hour of scripting time.';
      logger.warn('scripting', msg);
      this.addLog({ level: 'warn', message: msg, scriptId: id });
      throw new Error(msg);
    }

    this.scripts = this.scripts.map(s => s.id === id ? { ...s, enabled } : s);
    await this.save();

    // Start/stop usage tracking based on enabled scripts
    this.updateUsageTracking();
  }

  async installBuiltIns(scripts: ScriptConfig[]) {
    // Replace any existing built-ins with fresh versions
    const builtInIds = new Set(scripts.map(s => s.id));
    this.scripts = this.scripts.filter(s => !(s.builtIn && builtInIds.has(s.id)));
    scripts.forEach(s => this.scripts.push(this.compile(s)));
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
        name: 'Auto-Op',
        enabled: false,
        description: 'Ops everyone who joins the channel.',
        builtIn: true,
        code: `
          module.exports = {
            onJoin: (channel, nick, msg) => {
              if (nick === msg?.from && msg?.from === api?.userNick) return;
              if (channel && nick && api?.sendCommand) {
                api.sendCommand('MODE ' + channel + ' +o ' + nick);
              }
            }
          };
        `,
      },
      {
        id: 'builtin-welcome',
        name: 'Welcome Message',
        enabled: false,
        description: 'Greets users when they join.',
        builtIn: true,
        code: `
          module.exports = {
            onJoin: (channel, nick) => {
              if (!channel || !nick) return;
              if (nick === api?.userNick) return; // skip your own join
              api.sendMessage(channel, 'Welcome, ' + nick + '!');
            }
          };
        `,
      },
      {
        id: 'builtin-logger',
        name: 'Channel Logger',
        enabled: false,
        description: 'Logs messages to scripting log buffer.',
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
        name: 'Custom Command Alias',
        enabled: false,
        description: 'Adds /hello alias as example.',
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
      const msg = `Script ${script.name} failed to compile: ${String(error)}`;
      logger.error('scripting', msg);
      this.addLog({ level: 'error', message: msg, scriptId: script.id });
    }
    return safeScript;
  }

  private makeApi(script: ScriptConfig) {
    return {
      log: (msg: string) => logger.info('script', msg),
      userNick: connectionManager.getActiveConnection()?.ircService.getCurrentNick(),
      getConfig: () => script.config || {},
      sendMessage: (channel: string, text: string, networkId?: string) => {
        const net = networkId || connectionManager.getActiveNetworkId();
        if (!net) return;
        const conn = connectionManager.getConnection(net);
        conn?.ircService.sendMessage(channel, text);
      },
      sendCommand: (command: string, networkId?: string) => {
        const net = networkId || connectionManager.getActiveNetworkId();
        if (!net) return;
        const conn = connectionManager.getConnection(net);
        conn?.ircService.sendCommand(command);
      },
    };
  }

  handleConnect(networkId: string) {
    this.runHook('onConnect', (h) => h.onConnect?.(networkId));
  }

  handleMessage(message: IRCMessage) {
    this.runHook('onMessage', (h) => h.onMessage?.(message));
    if (message.type === 'join' && message.channel && message.from) {
      this.runHook('onJoin', (h) => h.onJoin?.(message.channel!, message.from!, message));
    }
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
        const msg = 'All scripts disabled: Scripting time expired. Watch an ad to continue.';
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
        const msg = `Error in script ${script.name} hook ${hook}: ${String(error)}`;
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
        case 'onMessage':
          script.hooks.onMessage?.(sampleMsg);
          break;
        case 'onJoin':
          script.hooks.onJoin?.('#test', 'tester', sampleMsg);
          break;
        case 'onCommand':
          script.hooks.onCommand?.('/echo hi', { channel: '#test', networkId: 'sampleNet' });
          break;
        default:
          break;
      }
      this.addLog({ level: 'info', message: `Test hook ${hook} executed`, scriptId: script.id });
    } catch (error) {
      const msg = `Test hook ${hook} failed for ${script.name}: ${String(error)}`;
      this.addLog({ level: 'error', message: msg, scriptId: script.id });
      logger.error('scripting', msg);
    }
  }
}

export const scriptingService = new ScriptingService();
