/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * IRC Service Command Provider
 * Provides access to service commands from JSON configurations
 */

import {
  ServiceCommand,
  ServiceConfig,
  ServiceDefinition,
  CommandParameter,
  AccessLevel,
  CompletionContext,
  IRCServiceType,
  IRCdType,
  DetectionResult,
} from '../interfaces/ServiceTypes';
import { serviceDetectionService } from './ServiceDetectionService';
import { allConfigs, getConfig } from '../config/services';

/** Command search result */
export interface CommandSearchResult {
  /** The command definition */
  command: ServiceCommand;
  /** Service that provides this command */
  service: ServiceDefinition;
  /** Service name (e.g., 'nickserv', 'chanserv') */
  serviceName: string;
  /** Service nick (e.g., 'NickServ') */
  serviceNick: string;
}

/** Command execution result */
export interface CommandExecutionResult {
  /** Whether command was executed */
  success: boolean;
  /** Command that was executed (or attempted) */
  command: string;
  /** Full message sent to server */
  fullMessage?: string;
  /** Error message if failed */
  error?: string;
  /** Whether confirmation was requested */
  needsConfirmation?: boolean;
}

/** Command suggestion */
export interface CommandSuggestion {
  /** Suggested text */
  text: string;
  /** Display label */
  label: string;
  /** Description */
  description: string;
  /** Command category */
  category: string;
  /** Priority (higher = shown first) */
  priority: number;
  /** Whether this is an alias */
  isAlias: boolean;
  /** Full command data */
  command?: ServiceCommand;
  /** Service nick */
  serviceNick?: string;
}

/**
 * Service Command Provider
 * Manages access to service commands and provides command completion
 */
export class ServiceCommandProvider {
  private commandCache: Map<string, Map<string, CommandSearchResult>> = new Map();
  private aliasCache: Map<string, Map<string, string>> = new Map(); // networkId -> alias -> full command

  /**
   * Get all commands for a network
   */
  public getCommands(networkId: string): CommandSearchResult[] {
    const config = serviceDetectionService.getServiceConfig(networkId);
    if (!config) return [];

    return this.buildCommandList(networkId, config);
  }

  /**
   * Get commands for a specific service
   */
  public getServiceCommands(networkId: string, serviceName: string): ServiceCommand[] {
    const config = serviceDetectionService.getServiceConfig(networkId);
    if (!config?.services) return [];

    const service = config.services[serviceName as keyof typeof config.services];
    if (!service?.enabled) return [];

    return service.commands || [];
  }

  /**
   * Find a command by name or alias
   */
  public findCommand(networkId: string, query: string): CommandSearchResult | undefined {
    const cache = this.getCommandCache(networkId);
    const lowerQuery = query.toLowerCase();

    // Direct lookup
    if (cache.has(lowerQuery)) {
      return cache.get(lowerQuery);
    }

    // Check aliases
    const aliasCache = this.getAliasCache(networkId);
    if (aliasCache.has(lowerQuery)) {
      const fullCommand = aliasCache.get(lowerQuery)!;
      return cache.get(fullCommand.toLowerCase());
    }

    // Fuzzy search
    for (const [key, result] of cache) {
      if (key.includes(lowerQuery) || lowerQuery.includes(key)) {
        return result;
      }
    }

    return undefined;
  }

  /**
   * Get command suggestions for auto-completion
   */
  public getSuggestions(
    networkId: string,
    query: string,
    context: CompletionContext
  ): CommandSuggestion[] {
    const config = serviceDetectionService.getServiceConfig(networkId);
    if (!config) return [];

    const suggestions: CommandSuggestion[] = [];
    const lowerQuery = query.toLowerCase();

    // Build suggestions from all services
    for (const [serviceName, service] of Object.entries(config.services)) {
      if (!service?.enabled) continue;

      for (const command of service.commands || []) {
        // Check if user has permission for this command
        if (!this.hasPermission(command.minLevel, context.userLevel)) {
          continue;
        }

        // Check if command is available in current context
        if (command.completion?.context && command.completion.context.length > 0) {
          const currentContext = context.currentChannel ? 'channel' : 'global';
          if (!command.completion.context.includes(currentContext as any)) {
            continue;
          }
        }

        // Check if command matches query
        const commandName = command.name.toLowerCase();
        const matchesQuery = commandName.startsWith(lowerQuery) || 
                            lowerQuery.includes(commandName);

        if (!matchesQuery && lowerQuery.length > 0) {
          continue;
        }

        // Add main command suggestion
        suggestions.push({
          text: `/${command.name}`,
          label: `${service.nick} ${command.name}`,
          description: command.description,
          category: serviceName,
          priority: command.completion?.priority || 50,
          isAlias: false,
          command,
          serviceNick: service.nick,
        });

        // Add safe alias suggestion if available
        if (command.completion?.suggestAlias) {
          const alias = command.completion.suggestAlias;
          suggestions.push({
            text: `/${alias}`,
            label: `/${alias}`,
            description: `${command.description} (alias for ${service.nick} ${command.name})`,
            category: serviceName,
            priority: (command.completion?.priority || 50) + 10,
            isAlias: true,
            command,
            serviceNick: service.nick,
          });
        }
      }
    }

    // Sort by priority (descending)
    suggestions.sort((a, b) => b.priority - a.priority);

    return suggestions;
  }

  /**
   * Build command execution string
   */
  public buildCommand(
    networkId: string,
    commandName: string,
    args: string[]
  ): CommandExecutionResult {
    const result = this.findCommand(networkId, commandName);

    if (!result) {
      return {
        success: false,
        command: commandName,
        error: `Unknown command: ${commandName}`,
      };
    }

    const { command, serviceNick } = result;

    // Validate required parameters
    const missingParams: string[] = [];
    for (let i = 0; i < command.parameters.length; i++) {
      const param = command.parameters[i];
      if (param.required && !args[i]) {
        missingParams.push(param.name);
      }
    }

    if (missingParams.length > 0) {
      return {
        success: false,
        command: commandName,
        error: `Missing required parameters: ${missingParams.join(', ')}`,
      };
    }

    // Check if confirmation is needed
    if (command.completion?.confirmBeforeExecute) {
      return {
        success: false,
        command: commandName,
        needsConfirmation: true,
        error: 'Confirmation required',
      };
    }

    // Build the message
    const argsString = args.join(' ');
    const fullMessage = `/${serviceNick} ${command.name} ${argsString}`.trim();

    return {
      success: true,
      command: commandName,
      fullMessage,
    };
  }

  /**
   * Parse user input to identify service command
   */
  public parseInput(input: string): {
    isServiceCommand: boolean;
    serviceNick?: string;
    command?: string;
    args: string[];
  } {
    // Remove leading slash if present
    const cleanInput = input.startsWith('/') ? input.slice(1) : input;
    const parts = cleanInput.trim().split(/\s+/);

    if (parts.length === 0) {
      return { isServiceCommand: false, args: [] };
    }

    const firstPart = parts[0].toLowerCase();

    // Check if it's a safe alias (e.g., 'nsregister', 'csop')
    const aliasMatch = this.matchSafeAlias(firstPart);
    if (aliasMatch) {
      return {
        isServiceCommand: true,
        serviceNick: aliasMatch.serviceNick,
        command: aliasMatch.commandName,
        args: parts.slice(1),
      };
    }

    // Check if it's a direct service command (e.g., 'NickServ', 'NS')
    if (this.isServiceNick(firstPart)) {
      return {
        isServiceCommand: true,
        serviceNick: parts[0],
        command: parts[1],
        args: parts.slice(2),
      };
    }

    return { isServiceCommand: false, args: parts };
  }

  /**
   * Get command help text
   */
  public getCommandHelp(networkId: string, commandName: string): string | undefined {
    const result = this.findCommand(networkId, commandName);
    if (!result) return undefined;

    const { command, serviceNick } = result;
    
    let help = `\x02${serviceNick} ${command.name}\x02 - ${command.description}\n`;
    help += `\x02Usage:\x02 ${command.usage}\n`;
    
    if (command.example) {
      help += `\x02Example:\x02 ${command.example}\n`;
    }

    if (command.parameters.length > 0) {
      help += '\x02Parameters:\x02\n';
      for (const param of command.parameters) {
        const req = param.required ? '(required)' : '(optional)';
        help += `  ${param.name}: ${param.description} ${req}\n`;
      }
    }

    if (command.completion?.suggestAlias) {
      help += `\x02Alias:\x02 /${command.completion.suggestAlias}\n`;
    }

    return help;
  }

  /**
   * Get all available safe aliases for a network
   */
  public getSafeAliases(networkId: string): Array<{ alias: string; command: string; description: string }> {
    const config = serviceDetectionService.getServiceConfig(networkId);
    if (!config) return [];

    const aliases: Array<{ alias: string; command: string; description: string }> = [];

    for (const service of Object.values(config.services)) {
      if (!service?.enabled) continue;

      for (const command of service.commands || []) {
        if (command.completion?.suggestAlias) {
          aliases.push({
            alias: command.completion.suggestAlias,
            command: `${service.nick} ${command.name}`,
            description: command.description,
          });
        }
      }
    }

    return aliases.sort((a, b) => a.alias.localeCompare(b.alias));
  }

  /**
   * Get IRCd-specific information (modes, commands)
   */
  public getIRCdInfo(networkId: string): {
    userModes: string[];
    channelModes: string[];
    operCommands: string[];
  } | undefined {
    const result = serviceDetectionService.getDetectionResult(networkId);
    if (!result) return undefined;

    const config = getConfig(result.ircdType);
    if (!config?.ircd) return undefined;

    return {
      userModes: config.ircd.userModes.map(m => `${m.mode}=${m.description}`),
      channelModes: config.ircd.channelModes.map(m => `${m.mode}=${m.description}`),
      operCommands: config.ircd.commands
        .filter(c => c.operOnly)
        .map(c => c.name),
    };
  }

  /**
   * Clear caches for a network
   */
  public clearCache(networkId: string): void {
    this.commandCache.delete(networkId);
    this.aliasCache.delete(networkId);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getCommandCache(networkId: string): Map<string, CommandSearchResult> {
    if (!this.commandCache.has(networkId)) {
      const config = serviceDetectionService.getServiceConfig(networkId);
      if (config) {
        this.buildCommandCache(networkId, config);
      }
    }
    return this.commandCache.get(networkId) || new Map();
  }

  private getAliasCache(networkId: string): Map<string, string> {
    if (!this.aliasCache.has(networkId)) {
      const config = serviceDetectionService.getServiceConfig(networkId);
      if (config) {
        this.buildAliasCache(networkId, config);
      }
    }
    return this.aliasCache.get(networkId) || new Map();
  }

  private buildCommandCache(networkId: string, config: ServiceConfig): void {
    const cache = new Map<string, CommandSearchResult>();

    for (const [serviceName, service] of Object.entries(config.services)) {
      if (!service?.enabled) continue;

      for (const command of service.commands || []) {
        const key = command.name.toLowerCase();
        cache.set(key, {
          command,
          service,
          serviceName,
          serviceNick: service.nick,
        });

        // Also index by full command name with service
        cache.set(`${service.nick.toLowerCase()}_${key}`, {
          command,
          service,
          serviceName,
          serviceNick: service.nick,
        });
      }
    }

    this.commandCache.set(networkId, cache);
  }

  private buildAliasCache(networkId: string, config: ServiceConfig): void {
    const cache = new Map<string, string>();

    for (const service of Object.values(config.services)) {
      if (!service?.enabled) continue;

      for (const command of service.commands || []) {
        if (command.completion?.suggestAlias) {
          cache.set(
            command.completion.suggestAlias.toLowerCase(),
            command.name.toLowerCase()
          );
        }
      }
    }

    this.aliasCache.set(networkId, cache);
  }

  private buildCommandList(networkId: string, config: ServiceConfig): CommandSearchResult[] {
    const results: CommandSearchResult[] = [];

    for (const [serviceName, service] of Object.entries(config.services)) {
      if (!service?.enabled) continue;

      for (const command of service.commands || []) {
        results.push({
          command,
          service,
          serviceName,
          serviceNick: service.nick,
        });
      }
    }

    return results;
  }

  private hasPermission(required: AccessLevel, userLevel: AccessLevel): boolean {
    const levels: AccessLevel[] = ['user', 'op', 'halfop', 'admin', 'founder', 'oper'];
    const requiredIdx = levels.indexOf(required);
    const userIdx = levels.indexOf(userLevel);
    return userIdx >= requiredIdx;
  }

  private isServiceNick(nick: string): boolean {
    const lowerNick = nick.toLowerCase();
    const serviceNicks = [
      'nickserv', 'chanserv', 'hostserv', 'operserv',
      'botserv', 'memoserv', 'groupserv', 'x', 'q',
      'ns', 'cs', 'hs', 'os', 'bs', 'ms', 'gs',
    ];
    return serviceNicks.includes(lowerNick);
  }

  private matchSafeAlias(alias: string): { serviceNick: string; commandName: string } | undefined {
    const lowerAlias = alias.toLowerCase();

    // NickServ aliases
    if (lowerAlias.startsWith('ns')) {
      const cmd = lowerAlias.slice(2);
      return { serviceNick: 'NickServ', commandName: cmd.toUpperCase() };
    }

    // ChanServ aliases
    if (lowerAlias.startsWith('cs')) {
      const cmd = lowerAlias.slice(2);
      return { serviceNick: 'ChanServ', commandName: cmd.toUpperCase() };
    }

    // HostServ aliases
    if (lowerAlias.startsWith('hs')) {
      const cmd = lowerAlias.slice(2);
      return { serviceNick: 'HostServ', commandName: cmd.toUpperCase() };
    }

    // OperServ aliases
    if (lowerAlias.startsWith('os')) {
      const cmd = lowerAlias.slice(2);
      return { serviceNick: 'OperServ', commandName: cmd.toUpperCase() };
    }

    // BotServ aliases
    if (lowerAlias.startsWith('bs')) {
      const cmd = lowerAlias.slice(2);
      return { serviceNick: 'BotServ', commandName: cmd.toUpperCase() };
    }

    // MemoServ aliases
    if (lowerAlias.startsWith('ms')) {
      const cmd = lowerAlias.slice(2);
      return { serviceNick: 'MemoServ', commandName: cmd.toUpperCase() };
    }

    return undefined;
  }
}

// Singleton instance
export const serviceCommandProvider = new ServiceCommandProvider();
