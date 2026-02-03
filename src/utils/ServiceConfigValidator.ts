/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Service Configuration Validator
 * Validates JSON service configurations against schema
 */

import type {
  ServiceConfig,
  ServiceCommand,
  CommandParameter,
  ConfigValidationResult,
  ValidationResult,
  IRCServiceType,
  IRCdType,
} from '../interfaces/ServiceTypes';
import {
  isIRCServiceType,
  isIRCdType,
  isServiceCommand,
} from '../interfaces/ServiceTypes';

/**
 * Validates a complete service configuration
 * @param config Configuration object to validate
 * @returns Validation result with errors and warnings
 */
export function validateServiceConfig(config: unknown): ConfigValidationResult {
  const errors: ValidationResult[] = [];
  const warnings: string[] = [];

  // Basic type check
  if (typeof config !== 'object' || config === null) {
    return {
      valid: false,
      errors: [{ valid: false, error: 'Configuration must be an object' }],
      warnings: [],
    };
  }

  const c = config as Record<string, unknown>;

  // Validate required fields
  const requiredFields = ['serviceType', 'ircdType', 'services', 'ircd'];
  for (const field of requiredFields) {
    if (!(field in c)) {
      errors.push({
        valid: false,
        error: `Missing required field: ${field}`,
        path: [field],
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Validate serviceType
  if (!isIRCServiceType(c.serviceType as string)) {
    errors.push({
      valid: false,
      error: `Invalid serviceType: ${c.serviceType}`,
      path: ['serviceType'],
    });
  }

  // Validate ircdType
  if (!isIRCdType(c.ircdType as string)) {
    errors.push({
      valid: false,
      error: `Invalid ircdType: ${c.ircdType}`,
      path: ['ircdType'],
    });
  }

  // Validate services object
  if (typeof c.services !== 'object' || c.services === null) {
    errors.push({
      valid: false,
      error: 'services must be an object',
      path: ['services'],
    });
  } else {
    const services = c.services as Record<string, unknown>;
    const validServices = ['nickserv', 'chanserv', 'hostserv', 'operserv', 'botserv', 'memoserv', 'groupserv', 'x', 'q'];
    
    for (const [key, value] of Object.entries(services)) {
      if (!validServices.includes(key)) {
        warnings.push(`Unknown service: ${key}`);
      } else {
        const serviceValidation = validateServiceDefinition(value, ['services', key]);
        errors.push(...serviceValidation.errors);
        warnings.push(...serviceValidation.warnings);
      }
    }
  }

  // Validate ircd object
  if (typeof c.ircd !== 'object' || c.ircd === null) {
    errors.push({
      valid: false,
      error: 'ircd must be an object',
      path: ['ircd'],
    });
  } else {
    const ircd = c.ircd as Record<string, unknown>;
    
    // Validate userModes
    if (!Array.isArray(ircd.userModes)) {
      errors.push({
        valid: false,
        error: 'ircd.userModes must be an array',
        path: ['ircd', 'userModes'],
      });
    }

    // Validate channelModes
    if (!Array.isArray(ircd.channelModes)) {
      errors.push({
        valid: false,
        error: 'ircd.channelModes must be an array',
        path: ['ircd', 'channelModes'],
      });
    }

    // Validate commands
    if (!Array.isArray(ircd.commands)) {
      errors.push({
        valid: false,
        error: 'ircd.commands must be an array',
        path: ['ircd', 'commands'],
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a service definition
 * @param def Service definition object
 * @param path Current path for error reporting
 * @returns Validation result
 */
function validateServiceDefinition(
  def: unknown,
  path: string[]
): { errors: ValidationResult[]; warnings: string[] } {
  const errors: ValidationResult[] = [];
  const warnings: string[] = [];

  if (typeof def !== 'object' || def === null) {
    return {
      errors: [{ valid: false, error: 'Service definition must be an object', path }],
      warnings: [],
    };
  }

  const d = def as Record<string, unknown>;

  // Validate required fields
  if (typeof d.enabled !== 'boolean') {
    errors.push({ valid: false, error: 'enabled must be a boolean', path: [...path, 'enabled'] });
  }

  if (typeof d.nick !== 'string' || d.nick.length === 0) {
    errors.push({ valid: false, error: 'nick must be a non-empty string', path: [...path, 'nick'] });
  }

  if (!Array.isArray(d.commands)) {
    errors.push({ valid: false, error: 'commands must be an array', path: [...path, 'commands'] });
    return { errors, warnings };
  }

  // Validate commands
  const commandNames = new Set<string>();
  const suggestAliases = new Set<string>();

  for (let i = 0; i < d.commands.length; i++) {
    const cmd = d.commands[i];
    const cmdPath = [...path, 'commands', i.toString()];
    
    if (!isServiceCommand(cmd)) {
      errors.push({ valid: false, error: 'Invalid command structure', path: cmdPath });
      continue;
    }

    // Check for duplicate command names
    if (commandNames.has(cmd.name)) {
      errors.push({ valid: false, error: `Duplicate command name: ${cmd.name}`, path: cmdPath });
    } else {
      commandNames.add(cmd.name);
    }

    // Validate command
    const cmdValidation = validateCommand(cmd, cmdPath);
    errors.push(...cmdValidation.errors);

    // Check for duplicate suggestAlias
    if (cmd.completion?.suggestAlias) {
      if (suggestAliases.has(cmd.completion.suggestAlias)) {
        errors.push({
          valid: false,
          error: `Duplicate suggestAlias: ${cmd.completion.suggestAlias}`,
          path: [...cmdPath, 'completion', 'suggestAlias'],
        });
      } else {
        suggestAliases.add(cmd.completion.suggestAlias);
      }
    }
  }

  return { errors, warnings };
}

/**
 * Validates a single command
 * @param cmd Command object
 * @param path Current path for error reporting
 * @returns Validation result
 */
function validateCommand(cmd: ServiceCommand, path: string[]): { errors: ValidationResult[] } {
  const errors: ValidationResult[] = [];

  // Validate minLevel
  const validLevels = ['user', 'op', 'halfop', 'admin', 'founder', 'oper'];
  if (!validLevels.includes(cmd.minLevel)) {
    errors.push({
      valid: false,
      error: `Invalid minLevel: ${cmd.minLevel}`,
      path: [...path, 'minLevel'],
    });
  }

  // Validate parameters
  const paramNames = new Set<string>();
  for (let i = 0; i < cmd.parameters.length; i++) {
    const param = cmd.parameters[i];
    const paramPath = [...path, 'parameters', i.toString()];

    // Check for duplicate parameter names
    if (paramNames.has(param.name)) {
      errors.push({
        valid: false,
        error: `Duplicate parameter name: ${param.name}`,
        path: paramPath,
      });
    } else {
      paramNames.add(param.name);
    }

    // Validate parameter type
    const validTypes = ['string', 'number', 'channel', 'nick', 'duration', 'enum', 'boolean'];
    if (!validTypes.includes(param.type)) {
      errors.push({
        valid: false,
        error: `Invalid parameter type: ${param.type}`,
        path: [...paramPath, 'type'],
      });
    }

    // Validate enumValues for enum type
    if (param.type === 'enum' && param.enumValues && !Array.isArray(param.enumValues)) {
      errors.push({
        valid: false,
        error: 'enumValues must be an array',
        path: [...paramPath, 'enumValues'],
      });
    }
  }

  // Validate completion config
  if (cmd.completion?.suggestAlias) {
    const alias = cmd.completion.suggestAlias;
    
    // Check format
    if (!/^[a-z][a-z0-9]*$/.test(alias)) {
      errors.push({
        valid: false,
        error: `Invalid suggestAlias format: ${alias}. Must start with letter and contain only alphanumeric characters.`,
        path: [...path, 'completion', 'suggestAlias'],
      });
    }

    // Check length
    if (alias.length < 2 || alias.length > 20) {
      errors.push({
        valid: false,
        error: `suggestAlias must be 2-20 characters: ${alias}`,
        path: [...path, 'completion', 'suggestAlias'],
      });
    }

    // Check priority range
    if (cmd.completion.priority !== undefined) {
      if (cmd.completion.priority < 1 || cmd.completion.priority > 100) {
        errors.push({
          valid: false,
          error: `priority must be 1-100: ${cmd.completion.priority}`,
          path: [...path, 'completion', 'priority'],
        });
      }
    }
  }

  return { errors };
}

/**
 * Validates a single command (public API)
 * @param command Command object to validate
 * @returns Validation result
 */
export function validateCommand(command: unknown): ValidationResult {
  if (!isServiceCommand(command)) {
    return { valid: false, error: 'Invalid command structure' };
  }

  const result = validateCommand(command, []);
  if (result.errors.length === 0) {
    return { valid: true };
  }

  return result.errors[0];
}

/**
 * Type guard for service config validation
 * @param config Object to check
 * @returns Whether config is valid ServiceConfig
 */
export function isValidServiceConfig(config: unknown): config is ServiceConfig {
  const result = validateServiceConfig(config);
  return result.valid;
}

/**
 * Checks if there are any duplicate commands across services
 * @param config Service configuration
 * @returns Array of duplicate findings
 */
export function findDuplicateCommands(config: ServiceConfig): Array<{
  command: string;
  services: string[];
}> {
  const commandMap = new Map<string, string[]>();
  const duplicates: Array<{ command: string; services: string[] }> = [];

  for (const [serviceName, service] of Object.entries(config.services)) {
    if (!service?.commands) continue;

    for (const cmd of service.commands) {
      const existing = commandMap.get(cmd.name) || [];
      existing.push(serviceName);
      commandMap.set(cmd.name, existing);
    }
  }

  for (const [command, services] of commandMap.entries()) {
    if (services.length > 1) {
      duplicates.push({ command, services });
    }
  }

  return duplicates;
}

/**
 * Gets all suggest aliases from a configuration
 * @param config Service configuration
 * @returns Map of alias to command info
 */
export function getAllSuggestAliases(config: ServiceConfig): Map<
  string,
  { service: string; command: string }
> {
  const aliases = new Map<string, { service: string; command: string }>();

  for (const [serviceName, service] of Object.entries(config.services)) {
    if (!service?.commands) continue;

    for (const cmd of service.commands) {
      if (cmd.completion?.suggestAlias) {
        aliases.set(cmd.completion.suggestAlias, {
          service: serviceName,
          command: cmd.name,
        });
      }
    }
  }

  return aliases;
}

/**
 * Finds conflicts between suggest aliases and reserved words
 * @param config Service configuration
 * @param reservedWords Array of reserved words to check against
 * @returns Array of conflicts
 */
export function findAliasConflicts(
  config: ServiceConfig,
  reservedWords: string[]
): Array<{ alias: string; command: string; conflict: string }> {
  const aliases = getAllSuggestAliases(config);
  const conflicts: Array<{ alias: string; command: string; conflict: string }> = [];
  const reservedSet = new Set(reservedWords.map(w => w.toLowerCase()));

  for (const [alias, info] of aliases.entries()) {
    if (reservedSet.has(alias.toLowerCase())) {
      conflicts.push({
        alias,
        command: info.command,
        conflict: 'Reserved word',
      });
    }
  }

  return conflicts;
}
