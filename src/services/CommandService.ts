/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { IRCService } from './IRCService';
import { certificateManager } from './CertificateManagerService';
import { FingerprintFormat } from '../types/certificate';

export interface CommandAlias {
  alias: string;
  command: string;
  description?: string;
}

export interface CustomCommand {
  name: string;
  command: string;
  description?: string;
  parameters?: string[]; // Parameter placeholders like {nick}, {channel}, etc.
}

export interface CommandHistoryEntry {
  id: string;
  command: string;
  timestamp: number;
  channel?: string;
}

export class CommandService {
  private ircService: IRCService | null = null;
  private aliases: Map<string, CommandAlias> = new Map();
  private customCommands: Map<string, CustomCommand> = new Map();
  private commandHistory: CommandHistoryEntry[] = [];
  private readonly MAX_HISTORY = 100;
  private readonly ALIASES_STORAGE_KEY = '@AndroidIRCX:commandAliases';
  private readonly CUSTOM_COMMANDS_STORAGE_KEY = '@AndroidIRCX:customCommands';
  private readonly HISTORY_STORAGE_KEY = '@AndroidIRCX:commandHistory';
  private currentNetworkCert?: string;
  private onLocalMessage?: (message: string) => void;

  constructor() {
    // IRCService will be set later
  }

  setIRCService(ircService: IRCService): void {
    this.ircService = ircService;
  }

  /**
   * Set the current network's certificate (PEM format)
   * Should be called when switching networks or updating certificate
   */
  setCurrentNetworkCert(certPem?: string): void {
    this.currentNetworkCert = certPem;
  }

  /**
   * Set handler for displaying local messages to user
   * These are informational messages that should appear in the UI but not be sent to IRC
   */
  setLocalMessageHandler(handler: (message: string) => void): void {
    this.onLocalMessage = handler;
  }

  /**
   * Initialize command service
   */
  async initialize(): Promise<void> {
    // Load aliases
    try {
      const aliasesData = await AsyncStorage.getItem(this.ALIASES_STORAGE_KEY);
      if (aliasesData) {
        const aliases = JSON.parse(aliasesData);
        this.aliases = new Map(aliases.map((a: CommandAlias) => [a.alias.toLowerCase(), a]));
      }
    } catch (error) {
      console.error('Failed to load command aliases:', error);
    }

    // Load custom commands
    try {
      const commandsData = await AsyncStorage.getItem(this.CUSTOM_COMMANDS_STORAGE_KEY);
      if (commandsData) {
        const commands = JSON.parse(commandsData);
        this.customCommands = new Map(commands.map((c: CustomCommand) => [c.name.toLowerCase(), c]));
      }
    } catch (error) {
      console.error('Failed to load custom commands:', error);
    }

    // Load command history
    try {
      const historyData = await AsyncStorage.getItem(this.HISTORY_STORAGE_KEY);
      if (historyData) {
        const parsed: CommandHistoryEntry[] = JSON.parse(historyData);
        this.commandHistory = this.normalizeHistory(parsed);
        // Persist normalized history if any entries were updated
        if (parsed.some(entry => !entry.id)) {
          await this.saveHistory();
        }
      }
    } catch (error) {
      console.error('Failed to load command history:', error);
    }

    // Initialize default aliases
    this.initializeDefaultAliases();
  }

  /**
   * Initialize default command aliases
   */
  private initializeDefaultAliases(): void {
    const defaultAliases: CommandAlias[] = [
      { alias: 'j', command: '/join', description: 'Join channel' },
      { alias: 'p', command: '/part', description: 'Part channel' },
      { alias: 'q', command: '/quit', description: 'Quit IRC' },
      { alias: 'w', command: '/whois', description: 'WHOIS user' },
      { alias: 'n', command: '/nick', description: 'Change nickname' },
      { alias: 'm', command: '/msg', description: 'Send private message' },
      // Encrypted DM helpers
      { alias: 'ekh', command: '/enc help', description: 'DM encryption help' },
      { alias: 'eks', command: '/sharekey', description: 'Share DM key' },
      { alias: 'ekr', command: '/requestkey', description: 'Request DM key' },
      { alias: 'ekm', command: '/encmsg', description: 'Send encrypted DM' },
      // Encrypted channel helpers
      { alias: 'ckh', command: '/chankey help', description: 'Channel key help' },
      { alias: 'ckg', command: '/chankey generate', description: 'Generate channel key' },
      { alias: 'cks', command: '/chankey share', description: 'Share channel key' },
      { alias: 'ckr', command: '/chankey request', description: 'Request channel key' },
      { alias: 'ckd', command: '/chankey remove', description: 'Delete channel key' },
      { alias: 'cke', command: '/chankey send', description: 'Send encrypted channel message' },
      // ZNC quality-of-life
      { alias: 'zncver', command: '/znc version', description: 'ZNC: show version' },
      { alias: 'zncm', command: '/znc listmods', description: 'ZNC: list loaded modules' },
      { alias: 'zncma', command: '/znc listavailmods', description: 'ZNC: list available modules' },
      { alias: 'zncnet', command: '/znc listnetworks', description: 'ZNC: list networks' },
      { alias: 'zncch', command: '/znc listchans', description: 'ZNC: list channels' },
      { alias: 'zncsrv', command: '/znc listservers', description: 'ZNC: list servers' },
      { alias: 'zncplay', command: '/znc playbuffer {channel}', description: 'ZNC: play buffer for channel/query', },
      { alias: 'zncclear', command: '/znc clearbuffer {channel}', description: 'ZNC: clear buffer for channel/query', },
      { alias: 'zncrehash', command: '/znc rehash', description: 'ZNC: reload config/modules' },
      { alias: 'zncsave', command: '/znc saveconfig', description: 'ZNC: save current config' },
      { alias: 'zncjump', command: '/znc jump', description: 'ZNC: jump to next server' },
      { alias: 'zncconn', command: '/znc connect', description: 'ZNC: reconnect upstream' },
      // IRCop / services helpers (Atheme, UnrealIRCd defaults)
      { alias: 'oper', command: '/oper {nick} {password}', description: 'IRCop: OPER in' },
      { alias: 'kill', command: '/quote KILL {nick} :{reason}', description: 'IRCop: kill user' },
      { alias: 'gline', command: '/quote GLINE {mask} :{reason}', description: 'IRCop: gline user' },
      { alias: 'shun', command: '/quote SHUN {mask} :{reason}', description: 'IRCop: shun user' },
      { alias: 'rehash', command: '/quote REHASH', description: 'IRCop: rehash server' },
      { alias: 'locops', command: '/quote LOCOPS {message}', description: 'IRCop: LOCOPS message' },
      { alias: 'wallops', command: '/quote WALLOPS {message}', description: 'IRCop: WALLOPS message' },
      { alias: 'jupe', command: '/quote JUPE {server} :{reason}', description: 'IRCop: jupe a server' },
      { alias: 'samode', command: '/quote SAMODE {target} {modes}', description: 'IRCop: force mode' },
      { alias: 'sapart', command: '/quote SAPART {nick} {channel}', description: 'IRCop: force part' },
      { alias: 'sajoin', command: '/quote SAJOIN {nick} {channel}', description: 'IRCop: force join' },
      { alias: 'squit', command: '/quote SQUIT {server} :{reason}', description: 'IRCop: disconnect server' },
      // Atheme services quickies
      { alias: 'nsid', command: '/msg NickServ IDENTIFY {password}', description: 'NickServ identify' },
      { alias: 'nsreg', command: '/msg NickServ REGISTER {password} {email}', description: 'NickServ register' },
      { alias: 'nsghost', command: '/msg NickServ GHOST {nick} {password}', description: 'NickServ ghost' },
      { alias: 'nsrecover', command: '/msg NickServ RECOVER {nick} {password}', description: 'NickServ recover' },
      { alias: 'csop', command: '/msg ChanServ OP {channel} {nick}', description: 'ChanServ op user' },
      { alias: 'csdeop', command: '/msg ChanServ DEOP {channel} {nick}', description: 'ChanServ deop user' },
      { alias: 'cvoice', command: '/msg ChanServ VOICE {channel} {nick}', description: 'ChanServ voice user' },
      { alias: 'csdevoice', command: '/msg ChanServ DEVOICE {channel} {nick}', description: 'ChanServ devoice user' },
      { alias: 'csregister', command: '/msg ChanServ REGISTER {channel} {password}', description: 'ChanServ register channel' },
      { alias: 'cspass', command: '/msg ChanServ SET {channel} PASSWORD {password}', description: 'ChanServ set password' },
    ];

    defaultAliases.forEach(alias => {
      if (!this.aliases.has(alias.alias.toLowerCase())) {
        this.aliases.set(alias.alias.toLowerCase(), alias);
      }
    });
  }

  /**
   * Process a command string (handles aliases, custom commands, /quote)
   */
  async processCommand(input: string, channel?: string): Promise<string | null> {
    if (!input.startsWith('/')) {
      return input; // Not a command, return original message
    }

    const trimmed = input.trim();
    if (!trimmed) return null;

    // Add to history
    this.addToHistory(trimmed, channel);

    // Handle /quote command
    if (trimmed.toLowerCase().startsWith('/quote ')) {
      const rawCommand = trimmed.substring(7).trim();
      if (rawCommand) {
        this.ircService?.sendRaw(rawCommand);
        return null; // Handled, don't process further
      }
    }

    // Extract command and arguments
    const parts = trimmed.split(/\s+/);
    const commandName = parts[0].substring(1).toLowerCase(); // Remove leading /
    const args = parts.slice(1);

    // Handle built-in certificate commands
    if (commandName === 'certfp') {
      return this.handleCertFpCommand();
    }

    if (commandName === 'certadd') {
      return this.handleCertAddCommand(args);
    }
    if (commandName === 'hop') {
      const provided = args[0];
      const looksLikeChannel = (value?: string) =>
        !!value && (value.startsWith('#') || value.startsWith('&') || value.startsWith('+') || value.startsWith('!'));
      const targetChannel = looksLikeChannel(provided) ? provided : channel;
      const reasonArgs = looksLikeChannel(provided) ? args.slice(1) : args;

      if (!targetChannel) {
        this.onLocalMessage?.('*** Usage: /hop [channel] [reason]');
        return null;
      }

      const reason = reasonArgs.length > 0 ? ` :${reasonArgs.join(' ')}` : '';
      const joinDelayMs = 250;
      this.ircService?.sendRaw(`PART ${targetChannel}${reason}`);
      setTimeout(() => {
        this.ircService?.sendRaw(`JOIN ${targetChannel}`);
      }, joinDelayMs);
      return null;
    }
    if (commandName === 'ban') {
      return this.handleBanCommand(args, channel);
    }

    // Check for alias
    const alias = this.aliases.get(commandName);
    if (alias) {
      // Replace alias with actual command
      const aliasCommand = alias.command;
      if (aliasCommand.startsWith('/')) {
        const currentNick = this.ircService?.getCurrentNick();
        const resolved = this.resolveAliasTemplate(aliasCommand, args, channel, currentNick);
        const newInput = resolved.command + (resolved.remainingArgs.length > 0 ? ' ' + resolved.remainingArgs.join(' ') : '');
        if (newInput.trim().toLowerCase() === trimmed.toLowerCase()) {
          return trimmed;
        }
        return this.processCommand(newInput, channel); // Recursively process
      }
    }

    // Check for custom command
    const customCommand = this.customCommands.get(commandName);
    if (customCommand) {
      return this.executeCustomCommand(customCommand, args, channel);
    }

    // Return original command for standard IRC command handling
    return trimmed;
  }

  /**
   * Execute a custom command
   */
  private executeCustomCommand(command: CustomCommand, args: string[], channel?: string): string | null {
    let commandString = command.command;

    // Replace placeholders
    if (command.parameters) {
      command.parameters.forEach((param, index) => {
        const value = args[index] || '';
        const placeholder = `{${param}}`;
        commandString = commandString.replace(new RegExp(placeholder, 'g'), value);
      });
    }

    // Replace {channel} with current channel if available
    if (channel) {
      commandString = commandString.replace(/{channel}/g, channel);
    }

    // Replace {nick} with current nick
    const currentNick = this.ircService?.getCurrentNick();
    if (currentNick) {
      commandString = commandString.replace(/{nick}/g, currentNick);
    }

    // If the command starts with /quote, send as raw
    if (commandString.startsWith('/quote ')) {
      const rawCommand = commandString.substring(7).trim();
      if (rawCommand) {
        this.ircService?.sendRaw(rawCommand);
        return null;
      }
    }

    // Otherwise, return the command string for normal processing
    return commandString;
  }

  private resolveAliasTemplate(
    template: string,
    args: string[],
    channel?: string,
    currentNick?: string
  ): { command: string; remainingArgs: string[] } {
    const placeholders = Array.from(template.matchAll(/\{([^}]+)\}/g));
    let argIndex = 0;
    let placeholderIndex = 0;

    const command = template.replace(/\{([^}]+)\}/g, (_match, key: string) => {
      const isLast = placeholderIndex === placeholders.length - 1;
      placeholderIndex++;
      const lower = key.toLowerCase();

      if (lower === 'channel') {
        if (channel) {
          return channel;
        }
        if (args[argIndex]) {
          return args[argIndex++];
        }
        return '';
      }

      if (lower === 'nick') {
        if (args[argIndex]) {
          return args[argIndex++];
        }
        return currentNick || '';
      }

      if (lower.startsWith('param')) {
        const index = parseInt(lower.slice(5), 10);
        if (!Number.isNaN(index) && index > 0) {
          return args[index - 1] || '';
        }
      }

      if (args.length > argIndex) {
        if (isLast) {
          const rest = args.slice(argIndex).join(' ');
          argIndex = args.length;
          return rest;
        }
        return args[argIndex++];
      }

      return '';
    });

    return { command, remainingArgs: args.slice(argIndex) };
  }

  /**
   * Add command to history
   */
  private addToHistory(command: string, channel?: string): void {
    const entry: CommandHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      command,
      timestamp: Date.now(),
      channel,
    };

    this.commandHistory.unshift(entry);
    if (this.commandHistory.length > this.MAX_HISTORY) {
      this.commandHistory = this.commandHistory.slice(0, this.MAX_HISTORY);
    }

    this.saveHistory();
  }

  /**
   * Get command history
   */
  getHistory(limit?: number): CommandHistoryEntry[] {
    if (this.commandHistory.some(entry => !entry.id)) {
      this.commandHistory = this.normalizeHistory(this.commandHistory);
      void this.saveHistory();
    }
    if (limit) {
      return this.commandHistory.slice(0, limit);
    }
    return [...this.commandHistory];
  }

  /**
   * Delete a specific history entry by id
   */
  async deleteHistoryEntry(id: string): Promise<void> {
    this.commandHistory = this.commandHistory.filter(entry => entry.id !== id);
    await this.saveHistory();
  }

  /**
   * Clear command history
   */
  async clearHistory(): Promise<void> {
    this.commandHistory = [];
    await AsyncStorage.removeItem(this.HISTORY_STORAGE_KEY);
  }

  /**
   * Add command alias
   */
  async addAlias(alias: CommandAlias): Promise<void> {
    this.aliases.set(alias.alias.toLowerCase(), alias);
    await this.saveAliases();
  }

  /**
   * Remove command alias
   */
  async removeAlias(aliasName: string): Promise<void> {
    this.aliases.delete(aliasName.toLowerCase());
    await this.saveAliases();
  }

  /**
   * Get all aliases
   */
  getAliases(): CommandAlias[] {
    return Array.from(this.aliases.values());
  }

  /**
   * Get alias by name
   */
  getAlias(aliasName: string): CommandAlias | undefined {
    return this.aliases.get(aliasName.toLowerCase());
  }

  /**
   * Add custom command
   */
  async addCustomCommand(command: CustomCommand): Promise<void> {
    this.customCommands.set(command.name.toLowerCase(), command);
    await this.saveCustomCommands();
  }

  /**
   * Remove custom command
   */
  async removeCustomCommand(commandName: string): Promise<void> {
    this.customCommands.delete(commandName.toLowerCase());
    await this.saveCustomCommands();
  }

  /**
   * Get all custom commands
   */
  getCustomCommands(): CustomCommand[] {
    return Array.from(this.customCommands.values());
  }

  /**
   * Get custom command by name
   */
  getCustomCommand(commandName: string): CustomCommand | undefined {
    return this.customCommands.get(commandName.toLowerCase());
  }

  /**
   * Save aliases to storage
   */
  private async saveAliases(): Promise<void> {
    try {
      const aliases = Array.from(this.aliases.values());
      await AsyncStorage.setItem(this.ALIASES_STORAGE_KEY, JSON.stringify(aliases));
    } catch (error) {
      console.error('Failed to save command aliases:', error);
    }
  }

  /**
   * Save custom commands to storage
   */
  private async saveCustomCommands(): Promise<void> {
    try {
      const commands = Array.from(this.customCommands.values());
      await AsyncStorage.setItem(this.CUSTOM_COMMANDS_STORAGE_KEY, JSON.stringify(commands));
    } catch (error) {
      console.error('Failed to save custom commands:', error);
    }
  }

  /**
   * Save history to storage
   */
  private async saveHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.HISTORY_STORAGE_KEY, JSON.stringify(this.commandHistory));
    } catch (error) {
      console.error('Failed to save command history:', error);
    }
  }

  /**
   * Handle /certfp command - Display certificate fingerprint
   */
  private handleCertFpCommand(): string | null {
    if (!this.currentNetworkCert) {
      this.onLocalMessage?.(
        '*** Error: No certificate configured for this network.\n' +
        '*** Configure one in Network Settings (SASL EXTERNAL section).'
      );
      return null;
    }

    try {
      const fingerprint = certificateManager.extractFingerprintFromPem(this.currentNetworkCert);
      const formatted = certificateManager.formatFingerprint(
        fingerprint,
        FingerprintFormat.COLON_SEPARATED_UPPER
      );

      const message =
        '*** Certificate Fingerprint (SHA-256):\n' +
        `*** ${formatted}\n` +
        '***\n' +
        '*** To add to NickServ:\n' +
        `*** /msg NickServ CERT ADD ${formatted}\n` +
        '***\n' +
        '*** Or use: /certadd [service] (default: NickServ)';

      this.onLocalMessage?.(message);
    } catch (error) {
      console.error('Failed to extract fingerprint:', error);
      this.onLocalMessage?.(
        '*** Error: Failed to extract certificate fingerprint.\n' +
        '*** The certificate may be invalid or corrupted.'
      );
    }

    return null;
  }

  /**
   * Handle /certadd command - Send fingerprint to IRC service
   * @param args - [service] optional, defaults to NickServ
   */
  private handleCertAddCommand(args: string[]): string | null {
    if (!this.currentNetworkCert) {
      this.onLocalMessage?.(
        '*** Error: No certificate configured for this network.\n' +
        '*** Configure one in Network Settings (SASL EXTERNAL section).'
      );
      return null;
    }

    const service = args[0] || 'NickServ';

    try {
      const fingerprint = certificateManager.extractFingerprintFromPem(this.currentNetworkCert);
      const formatted = certificateManager.formatFingerprint(
        fingerprint,
        FingerprintFormat.COLON_SEPARATED_UPPER
      );
      const command = `PRIVMSG ${service} :CERT ADD ${formatted}`;

      this.ircService?.sendRaw(command);
      this.onLocalMessage?.(`*** Certificate fingerprint sent to ${service}`);
    } catch (error) {
      console.error('Failed to send fingerprint:', error);
      this.onLocalMessage?.(
        '*** Error: Failed to send certificate fingerprint.\n' +
        '*** The certificate may be invalid or corrupted.'
      );
    }

    return null;
  }

  /**
   * Ensure every history entry has an id (for older persisted data)
   */
  private normalizeHistory(entries: CommandHistoryEntry[]): CommandHistoryEntry[] {
    return entries.map((entry, index) => ({
      id: entry.id || `${entry.timestamp || Date.now()}-${index}`,
      command: entry.command,
      timestamp: entry.timestamp || Date.now(),
      channel: entry.channel,
    }));
  }

  /**
   * Handle /ban command with support for all switches and options
   */
  private handleBanCommand(args: string[], channel?: string): string | null {
    if (!channel) {
      this.onLocalMessage?.('*** Error: No channel specified. Usage: /ban [-kruNbeIq] [#channel] <nickname|address> [type] [kick message]');
      return null;
    }

    // Parse command arguments
    const { switches, targetChannel, target, banType, message } = this.parseBanCommand(args, channel);

    // Validate channel
    if (!targetChannel) {
      this.onLocalMessage?.('*** Error: No channel specified. Usage: /ban [-kruNbeIq] [#channel] <nickname|address> [type] [kick message]');
      return null;
    }

    // Determine ban mask
    let banMask = target;
    // If target doesn't look like a mask, try to resolve it to a user's hostmask
    if (!target.includes('!') && !target.includes('@') && !target.includes('*')) {
      // In a real implementation, we would look up the user's hostmask
      // For now, we'll use a generic mask
      banMask = `*!*@${target}`;
    }

    // Apply ban
    if (switches.b) {
      this.ircService?.sendRaw(`MODE ${targetChannel} +b ${banMask}`);
    }

    // Apply except
    if (switches.e) {
      this.ircService?.sendRaw(`MODE ${targetChannel} +e ${banMask}`);
    }

    // Apply invite
    if (switches.I) {
      this.ircService?.sendRaw(`MODE ${targetChannel} +I ${banMask}`);
    }

    // Apply quiet (if supported)
    if (switches.q) {
      this.ircService?.sendRaw(`MODE ${targetChannel} +q ${banMask}`);
    }

    // Kick user
    if (switches.k) {
      const kickMessage = message || 'Banned';
      this.ircService?.sendRaw(`KICK ${targetChannel} ${target} :${kickMessage}`);
    }

    // Schedule unban
    if (switches.u && switches.u > 0) {
      setTimeout(() => {
        this.ircService?.sendRaw(`MODE ${targetChannel} -b ${banMask}`);
      }, switches.u * 1000);
    }

    return null;
  }

  /**
   * Parse /ban command arguments
   */
  private parseBanCommand(args: string[], defaultChannel: string): {
    switches: { k: boolean; r: boolean; u: number; b: boolean; e: boolean; I: boolean; q: boolean };
    targetChannel: string | null;
    target: string;
    banType: number;
    message: string;
  } {
    const switches: { k: boolean; r: boolean; u: number; b: boolean; e: boolean; I: boolean; q: boolean } = {
      k: false, // kick
      r: false, // reason (not a real switch, but for internal use)
      u: 0,     // unban after N seconds
      b: true,  // ban
      e: false, // except
      I: false, // invite
      q: false, // quiet
    };

    let channel: string | null = defaultChannel;
    let target: string = '';
    let banType: number = 2; // Default to *!*@host
    let message: string = '';

    let i = 0;
    // Parse switches first (starting with -)
    while (i < args.length && args[i].startsWith('-')) {
      const switchStr = args[i].substring(1);
      for (const char of switchStr) {
        switch (char.toLowerCase()) {
          case 'k':
            switches.k = true;
            break;
          case 'r':
            switches.r = true;
            break;
          case 'u':
            // Look for the number after 'u'
            // This is a simplified implementation - in reality, you'd need to parse the number
            switches.u = 300; // Default to 5 minutes if no number specified
            break;
          case 'b':
            switches.b = true;
            break;
          case 'e':
            switches.e = true;
            break;
          case 'i':
            switches.I = true;
            break;
          case 'q':
            switches.q = true;
            break;
        }
      }
      i++;
    }

    // Next argument might be channel if it starts with #
    if (i < args.length && args[i].startsWith('#')) {
      channel = args[i];
      i++;
    }

    // Next argument is the target
    if (i < args.length) {
      target = args[i];
      i++;
    }

    // Next argument might be ban type (number 0-9)
    if (i < args.length) {
      const num = parseInt(args[i], 10);
      if (!isNaN(num) && num >= 0 && num <= 9) {
        banType = num;
        i++;
      }
    }

    // Remaining arguments form the message
    if (i < args.length) {
      message = args.slice(i).join(' ');
    }

    return { switches, targetChannel: channel, target, banType, message };
  }
}

export const commandService = new CommandService();
