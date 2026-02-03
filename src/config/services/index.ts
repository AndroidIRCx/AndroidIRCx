/**
 * IRC Services Configuration Index
 * Central export point for all service and IRCd configurations
 */

// Service configurations
export { default as anopeConfig } from './anope.json';
export { default as athemeConfig } from './atheme.json';
export { default as dalnetConfig } from './dalnet.json';
export { default as undernetConfig } from './undernet.json';
export { default as quakenetConfig } from './quakenet.json';

// IRCd configurations
export { default as unrealircdConfig } from './unrealircd.json';
export { default as inspircdConfig } from './inspircd.json';
export { default as charybdisConfig } from './charybdis.json';
export { default as hybridConfig } from './hybrid.json';
export { default as ngircdConfig } from './ngircd.json';

import { ServiceConfig } from '../../interfaces/ServiceTypes';

// Type assertions for JSON imports
const typedAnopeConfig = require('./anope.json') as ServiceConfig;
const typedAthemeConfig = require('./atheme.json') as ServiceConfig;
const typedDalnetConfig = require('./dalnet.json') as ServiceConfig;
const typedUndernetConfig = require('./undernet.json') as ServiceConfig;
const typedQuakenetConfig = require('./quakenet.json') as ServiceConfig;

const typedUnrealircdConfig = require('./unrealircd.json') as ServiceConfig;
const typedInspircdConfig = require('./inspircd.json') as ServiceConfig;
const typedCharybdisConfig = require('./charybdis.json') as ServiceConfig;
const typedHybridConfig = require('./hybrid.json') as ServiceConfig;
const typedNgircdConfig = require('./ngircd.json') as ServiceConfig;

/**
 * Map of all service configurations by type
 */
export const serviceConfigs: Record<string, ServiceConfig> = {
  anope: typedAnopeConfig,
  atheme: typedAthemeConfig,
  dalnet: typedDalnetConfig,
  undernet: typedUndernetConfig,
  quakenet: typedQuakenetConfig,
};

/**
 * Map of all IRCd configurations by type
 */
export const ircdConfigs: Record<string, ServiceConfig> = {
  unrealircd: typedUnrealircdConfig,
  inspircd: typedInspircdConfig,
  charybdis: typedCharybdisConfig,
  hybrid: typedHybridConfig,
  ngircd: typedNgircdConfig,
};

/**
 * All configurations combined
 */
export const allConfigs: Record<string, ServiceConfig> = {
  ...serviceConfigs,
  ...ircdConfigs,
};

/**
 * Get configuration by service/IRCd type
 */
export function getConfig(type: string): ServiceConfig | undefined {
  return allConfigs[type.toLowerCase()];
}

/**
 * Get all service nicknames from configurations
 */
export function getAllServiceNicks(): string[] {
  const nicks: string[] = [];
  
  Object.values(serviceConfigs).forEach(config => {
    if (config.services) {
      Object.values(config.services).forEach(service => {
        if (service.nick) {
          nicks.push(service.nick.toLowerCase());
        }
        if (service.aliases) {
          nicks.push(...service.aliases.map(a => a.toLowerCase()));
        }
      });
    }
  });
  
  return [...new Set(nicks)];
}

/**
 * Check if a nickname is a known service
 */
export function isServiceNick(nick: string): boolean {
  return getAllServiceNicks().includes(nick.toLowerCase());
}

/**
 * Get service type by nickname
 */
export function getServiceTypeByNick(nick: string): string | undefined {
  const lowerNick = nick.toLowerCase();
  
  for (const [type, config] of Object.entries(serviceConfigs)) {
    if (config.services) {
      for (const service of Object.values(config.services)) {
        const serviceNicks = [
          service.nick?.toLowerCase(),
          ...(service.aliases?.map(a => a.toLowerCase()) || []),
        ].filter(Boolean);
        
        if (serviceNicks.includes(lowerNick)) {
          return type;
        }
      }
    }
  }
  
  return undefined;
}
