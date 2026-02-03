/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * IRC Services & IRCd Type Definitions
 * Auto-generated from IRC_SERVICES_MASTER_PLAN.md
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/** IRC Service Provider Types */
export type IRCServiceType = 
  | 'anope' 
  | 'atheme' 
  | 'dalnet' 
  | 'undernet' 
  | 'quakenet' 
  | 'generic';

/** IRC Daemon Types */
export type IRCdType = 
  | 'unrealircd' 
  | 'inspircd' 
  | 'charybdis' 
  | 'solanum'
  | 'hybrid' 
  | 'ngircd' 
  | 'unknown';

/** User Access Levels */
export type AccessLevel = 'user' | 'op' | 'halfop' | 'admin' | 'founder' | 'oper';

/** Command Context Types */
export type CommandContext = 'global' | 'channel' | 'query';

// ============================================================================
// COMMAND DEFINITIONS
// ============================================================================

/** Parameter types for service commands */
export type ParameterType = 
  | 'string' 
  | 'number' 
  | 'channel' 
  | 'nick' 
  | 'duration' 
  | 'enum' 
  | 'boolean';

/** Parameter completion configuration */
export interface ParameterCompletionConfig {
  /** Completion type */
  type: 'enum' | 'dynamic' | 'password' | 'email' | 'mask' | 'duration' | 'boolean';
  
  /** Fixed values for enum type */
  values?: string[];
  
  /** Dynamic data source */
  source?: 'channels' | 'nicks' | 'bans' | 'networks' | 'custom';
  
  /** Mask password input */
  mask?: boolean;
  
  /** Validate input */
  validate?: boolean;
  
  /** Minimum length for strings */
  minLength?: number;
  
  /** Maximum length */
  maxLength?: number;
  
  /** Regex pattern for validation */
  pattern?: string;
  
  /** Custom value getter */
  getValues?: () => Promise<string[]>;
}

/** Command parameter definition */
export interface CommandParameter {
  /** Parameter name */
  name: string;
  
  /** Parameter data type */
  type: ParameterType;
  
  /** Whether parameter is required */
  required: boolean;
  
  /** Parameter description */
  description: string;
  
  /** Description in Serbian */
  descriptionSr?: string;
  
  /** Enum values (for enum type) */
  enumValues?: string[];
  
  /** Completion configuration */
  completion?: ParameterCompletionConfig;
}

/** Command completion configuration */
export interface CommandCompletionConfig {
  /** Suggested alias for quick access (e.g., 'nsregister') */
  suggestAlias?: string;
  
  /** Priority in suggestions (1-100, higher = top) */
  priority?: number;
  
  /** Available contexts */
  context?: CommandContext[];
  
  /** Require confirmation before execute */
  confirmBeforeExecute?: boolean;
  
  /** Auto-execute without waiting for Enter */
  autoExecute?: boolean;
  
  /** Per-parameter completion configs */
  parameterCompletion?: {
    [paramName: string]: ParameterCompletionConfig;
  };
}

/** Service command definition */
export interface ServiceCommand {
  /** Command name (e.g., 'REGISTER') */
  name: string;
  
  /** Service name (e.g., 'NickServ', 'ChanServ') */
  service: string;
  
  /** Command aliases (shortcuts) - DEPRECATED: Use completion.suggestAlias */
  aliases: string[];
  
  /** Command description */
  description: string;
  
  /** Description in Serbian */
  descriptionSr?: string;
  
  /** Usage syntax */
  usage: string;
  
  /** Example usage */
  example: string;
  
  /** Minimum access level required */
  minLevel: AccessLevel;
  
  /** Whether authentication is required */
  requiresAuth: boolean;
  
  /** Command parameters */
  parameters: CommandParameter[];
  
  /** Completion configuration */
  completion?: CommandCompletionConfig;
}

// ============================================================================
// SERVICE CONFIGURATION
// ============================================================================

/** Service definition (NickServ, ChanServ, etc.) */
export interface ServiceDefinition {
  /** Whether service is enabled */
  enabled: boolean;
  
  /** Service nick (e.g., 'NickServ', 'X', 'Q') */
  nick: string;
  
  /** Service host (optional) */
  host?: string;
  
  /** Available commands */
  commands: ServiceCommand[];
}

/** IRCd user mode */
export interface UserMode {
  /** Mode character (e.g., 'i', 'o', 'x') */
  mode: string;
  
  /** Mode name */
  name: string;
  
  /** Mode description */
  description: string;
  
  /** Whether mode is oper-only */
  operOnly?: boolean;
}

/** IRCd channel mode */
export interface ChannelMode {
  /** Mode character */
  mode: string;
  
  /** Mode type */
  type: 'list' | 'param' | 'set' | 'prefix';
  
  /** Prefix character (for prefix types: ~, &, @, %, +) */
  prefix?: string;
  
  /** Mode name */
  name: string;
  
  /** Mode description */
  description: string;
  
  /** Parameter placeholder (for param types) */
  parameter?: string;
}

/** IRCd command */
export interface IRCdCommand {
  /** Command name */
  name: string;
  
  /** Command description */
  description: string;
  
  /** Usage syntax */
  usage: string;
  
  /** Whether command is oper-only */
  operOnly: boolean;
}

/** Extended ban definition */
export interface ExtendedBan {
  /** Ban prefix (e.g., '~q:', '~n:', '~c:', '~r:') */
  prefix: string;
  
  /** Ban type name */
  type: string;
  
  /** Description */
  description: string;
  
  /** Example usage */
  example: string;
}

/** IRCd definition */
export interface IRCdDefinition {
  /** User modes */
  userModes: UserMode[];
  
  /** Channel modes */
  channelModes: ChannelMode[];
  
  /** Server commands */
  commands: IRCdCommand[];
  
  /** Extended bans (optional) */
  extendedBans?: ExtendedBan[];
}

/** Services collection */
export interface ServicesCollection {
  nickserv?: ServiceDefinition;
  chanserv?: ServiceDefinition;
  hostserv?: ServiceDefinition;
  operserv?: ServiceDefinition;
  botserv?: ServiceDefinition;
  memoserv?: ServiceDefinition;
  groupserv?: ServiceDefinition;
  /** Undernet X service */
  x?: ServiceDefinition;
  /** QuakeNet Q service */
  q?: ServiceDefinition;
}

/** Complete service configuration */
export interface ServiceConfig {
  /** Service type identifier */
  serviceType: IRCServiceType;
  
  /** IRCd type */
  ircdType: IRCdType;
  
  /** Config version */
  version?: string;
  
  /** Service definitions */
  services: ServicesCollection;
  
  /** IRCd definition */
  ircd: IRCdDefinition;
}

// ============================================================================
// DETECTION RESULTS
// ============================================================================

/** Service detection result */
export interface DetectionResult {
  /** Detected service type */
  serviceType: IRCServiceType;
  
  /** Detected IRCd type */
  ircdType: IRCdType;
  
  /** Confidence level (0-1) */
  confidence: number;
  
  /** Detection method used */
  method: 'isupport' | 'version' | 'services' | 'network' | 'heuristic';
  
  /** Raw data that led to detection */
  rawData?: Record<string, unknown>;
}

// ============================================================================
// COMPLETION SYSTEM
// ============================================================================

/** Completion context */
export interface CompletionContext {
  /** Current channel */
  currentChannel?: string;
  
  /** Current network */
  currentNetwork?: string;
  
  /** Available channels */
  availableChannels: string[];
  
  /** Available nicks */
  availableNicks: string[];
  
  /** User access level */
  userLevel: AccessLevel;
  
  /** Whether user is authenticated */
  isAuthenticated: boolean;
}

/** Dynamic completion provider */
export interface DynamicCompletionProvider {
  /** Provider type */
  type: 'channels' | 'nicks' | 'networks' | 'services' | 'custom';
  
  /** Trigger character (e.g., '#', '@', '/') */
  trigger: string;
  
  /** Get suggestions */
  getSuggestions: (query: string, context: CompletionContext) => Promise<string[]>;
}

/** Command completion configuration */
export interface CommandCompletionSystem {
  /** Trigger characters */
  triggers: string[];
  
  /** Available commands */
  commands: ServiceCommand[];
  
  /** Command aliases */
  aliases: Map<string, string>;
  
  /** Dynamic providers */
  dynamicProviders: DynamicCompletionProvider[];
}

// ============================================================================
// VALIDATION
// ============================================================================

/** Validation result */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Error message if invalid */
  error?: string;
  
  /** Field path that failed validation */
  path?: string[];
}

/** Service config validation result */
export interface ConfigValidationResult {
  /** Whether config is valid */
  valid: boolean;
  
  /** List of validation errors */
  errors: ValidationResult[];
  
  /** Warnings (non-critical issues) */
  warnings: string[];
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/** Type guard for ServiceCommand */
export function isServiceCommand(obj: unknown): obj is ServiceCommand {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    'service' in obj &&
    'description' in obj &&
    'usage' in obj &&
    'parameters' in obj
  );
}

/** Type guard for ServiceConfig */
export function isServiceConfig(obj: unknown): obj is ServiceConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'serviceType' in obj &&
    'ircdType' in obj &&
    'services' in obj &&
    'ircd' in obj
  );
}

/** Type guard for IRCServiceType */
export function isIRCServiceType(type: string): type is IRCServiceType {
  return ['anope', 'atheme', 'dalnet', 'undernet', 'quakenet', 'generic'].includes(type);
}

/** Type guard for IRCdType */
export function isIRCdType(type: string): type is IRCdType {
  return ['unrealircd', 'inspircd', 'charybdis', 'solanum', 'hybrid', 'ngircd', 'unknown'].includes(type);
}
