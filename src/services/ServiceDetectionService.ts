/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * IRC Service Detection Service
 * Detects IRC services (NickServ, ChanServ, etc.) and IRCd type from server responses
 */

import {
  IRCServiceType,
  IRCdType,
  DetectionResult,
  ServiceConfig,
  ServiceDefinition,
} from '../interfaces/ServiceTypes';
import { allConfigs, getConfig } from '../config/services';

/** Network name to service type mapping */
const NETWORK_SERVICE_MAP: Record<string, IRCServiceType> = {
  // DALnet networks
  'dalnet': 'dalnet',
  'dal.net': 'dalnet',
  'irc.dal.net': 'dalnet',
  
  // Undernet networks
  'undernet': 'undernet',
  'under.net': 'undernet',
  'irc.undernet.org': 'undernet',
  
  // QuakeNet networks
  'quakenet': 'quakenet',
  'quake.net': 'quakenet',
  'irc.quakenet.org': 'quakenet',
  
  // Anope-based networks (common defaults)
  'anope': 'anope',
  'irc.anope.org': 'anope',
};

/** Service nick to service type mapping */
const SERVICE_NICK_MAP: Record<string, IRCServiceType> = {
  // Undernet X
  'x': 'undernet',
  'x@channels.undernet.org': 'undernet',
  
  // QuakeNet Q
  'q': 'quakenet',
  'q@cservice.quakenet.org': 'quakenet',
  
  // DALnet
  'chanserv@services.dal.net': 'dalnet',
  'nickserv@services.dal.net': 'dalnet',
};

/** IRCd version patterns to IRCd type mapping */
const IRCD_VERSION_PATTERNS: Array<{ pattern: RegExp; type: IRCdType; confidence: number }> = [
  // UnrealIRCd
  { pattern: /unrealircd|unreal/i, type: 'unrealircd', confidence: 0.95 },
  { pattern: /ircd-.*unreal/i, type: 'unrealircd', confidence: 0.95 },
  
  // InspIRCd
  { pattern: /inspircd|insp-?ircd/i, type: 'inspircd', confidence: 0.95 },
  
  // Charybdis/Solanum
  { pattern: /charybdis/i, type: 'charybdis', confidence: 0.95 },
  { pattern: /solanum/i, type: 'charybdis', confidence: 0.95 }, // Solanum is fork of Charybdis
  { pattern: /ircd-.*solanum/i, type: 'charybdis', confidence: 0.95 },
  
  // ircd-hybrid
  { pattern: /ircd-hybrid|hybrid/i, type: 'hybrid', confidence: 0.90 },
  
  // ngIRCd
  { pattern: /ngircd/i, type: 'ngircd', confidence: 0.95 },
];

/** ISUPPORT token patterns for IRCd detection */
const IRCD_ISUPPORT_PATTERNS: Array<{ tokens: string[]; type: IRCdType; confidence: number }> = [
  // UnrealIRCd specific
  { tokens: ['NICKCHARS', 'NICKIP', 'ESVID'], type: 'unrealircd', confidence: 0.90 },
  { tokens: ['MAXLIST=b:100,e:100,I:100'], type: 'unrealircd', confidence: 0.70 },
  
  // InspIRCd specific
  { tokens: ['NICKMAXLEN'], type: 'inspircd', confidence: 0.80 },
  { tokens: ['MAXMODES=20'], type: 'inspircd', confidence: 0.60 },
  
  // Charybdis/Solanum specific
  { tokens: ['EUID'], type: 'charybdis', confidence: 0.85 },
  { tokens: ['MTAGS'], type: 'charybdis', confidence: 0.85 },
  
  // Hybrid specific
  { tokens: ['KNOCK', 'CALLERID=g'], type: 'hybrid', confidence: 0.70 },
  
  // ngIRCd specific (minimal tokens)
  { tokens: ['MAXCHANNELSPERUSER'], type: 'ngircd', confidence: 0.60 },
];

/** Detection state for a single connection */
interface DetectionState {
  networkName?: string;
  serverVersion?: string;
  isupportTokens: Map<string, string>;
  detectedServices: Map<string, string>; // nick -> service name
  detectionResult?: DetectionResult;
}

/**
 * Service Detection Service
 * Detects IRC services and IRCd types from server responses
 */
export class ServiceDetectionService {
  private states: Map<string, DetectionState> = new Map();
  private detectionCallbacks: Array<(networkId: string, result: DetectionResult) => void> = [];

  /**
   * Subscribe to detection events
   */
  public onDetection(callback: (networkId: string, result: DetectionResult) => void): () => void {
    this.detectionCallbacks.push(callback);
    return () => {
      const index = this.detectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.detectionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Initialize detection for a network
   */
  public initializeNetwork(networkId: string): void {
    this.states.set(networkId, {
      isupportTokens: new Map(),
      detectedServices: new Map(),
    });
  }

  /**
   * Clean up detection state for a network
   */
  public cleanupNetwork(networkId: string): void {
    this.states.delete(networkId);
  }

  /**
   * Process 005 ISUPPORT tokens
   */
  public processISupport(networkId: string, tokens: string[]): void {
    const state = this.states.get(networkId);
    if (!state) {
      this.initializeNetwork(networkId);
      return this.processISupport(networkId, tokens);
    }

    // Parse tokens
    for (const token of tokens) {
      if (token.includes('=')) {
        const [key, value] = token.split('=', 2);
        state.isupportTokens.set(key.toUpperCase(), value);
        
        // Check for service nicks in tokens
        this.detectServicesFromToken(state, key.toUpperCase(), value);
      } else {
        state.isupportTokens.set(token.toUpperCase(), 'true');
      }
    }

    // Try to detect from accumulated data
    this.attemptDetection(networkId);
  }

  /**
   * Process NETWORK name from ISUPPORT or 001 welcome
   */
  public processNetworkName(networkId: string, networkName: string): void {
    const state = this.states.get(networkId);
    if (!state) {
      this.initializeNetwork(networkId);
      return this.processNetworkName(networkId, networkName);
    }

    state.networkName = networkName;
    this.attemptDetection(networkId);
  }

  /**
   * Process server VERSION response
   */
  public processVersion(networkId: string, version: string): void {
    const state = this.states.get(networkId);
    if (!state) {
      this.initializeNetwork(networkId);
      return this.processVersion(networkId, version);
    }

    state.serverVersion = version;
    this.attemptDetection(networkId);
  }

  /**
   * Process a service PRIVMSG/NOTICE to detect service nicks
   */
  public processServiceMessage(networkId: string, nick: string, message: string): void {
    const state = this.states.get(networkId);
    if (!state) {
      this.initializeNetwork(networkId);
      return this.processServiceMessage(networkId, nick, message);
    }

    const lowerNick = nick.toLowerCase();
    
    // Check against known service nicks
    if (this.isServiceNick(lowerNick)) {
      const serviceName = this.identifyServiceFromMessage(lowerNick, message);
      if (serviceName) {
        state.detectedServices.set(lowerNick, serviceName);
        this.attemptDetection(networkId);
      }
    }
  }

  /**
   * Get detection result for a network
   */
  public getDetectionResult(networkId: string): DetectionResult | undefined {
    return this.states.get(networkId)?.detectionResult;
  }

  /**
   * Get the appropriate service config for a network
   */
  public getServiceConfig(networkId: string): ServiceConfig | undefined {
    const result = this.getDetectionResult(networkId);
    if (!result) return undefined;
    
    return getConfig(result.serviceType) || getConfig(result.ircdType);
  }

  /**
   * Check if a nick is a known service
   */
  public isServiceNick(nick: string): boolean {
    const lowerNick = nick.toLowerCase();
    
    // Check all configs for service nicks
    for (const config of Object.values(allConfigs)) {
      if (config.services) {
        for (const service of Object.values(config.services)) {
          if (service.nick && service.nick.toLowerCase() === lowerNick) {
            return true;
          }
          if (service.aliases?.some((a: string) => a.toLowerCase() === lowerNick)) {
            return true;
          }
        }
      }
    }
    
    // Check known special service nicks
    if (SERVICE_NICK_MAP[lowerNick]) return true;
    if (['nickserv', 'chanserv', 'hostserv', 'operserv', 'botserv', 'memoserv', 'x', 'q'].includes(lowerNick)) {
      return true;
    }
    
    return false;
  }

  /**
   * Get service definition by nick for a network
   */
  public getServiceByNick(networkId: string, nick: string): ServiceDefinition | undefined {
    const config = this.getServiceConfig(networkId);
    if (!config?.services) return undefined;
    
    const lowerNick = nick.toLowerCase();
    
    for (const [name, service] of Object.entries(config.services)) {
      if (service.nick.toLowerCase() === lowerNick) {
        return service;
      }
      if (service.aliases?.some((a: string) => a.toLowerCase() === lowerNick)) {
        return service;
      }
    }
    
    return undefined;
  }

  /**
   * Get all available commands for a network
   */
  public getAllCommands(networkId: string) {
    const config = this.getServiceConfig(networkId);
    if (!config?.services) return [];
    
    const commands: Array<{ service: string; command: string; description: string }> = [];
    
    for (const [serviceName, service] of Object.entries(config.services)) {
      if (service.enabled && service.commands) {
        for (const cmd of service.commands) {
          commands.push({
            service: service.nick,
            command: cmd.name,
            description: cmd.description,
          });
        }
      }
    }
    
    return commands;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private detectServicesFromToken(state: DetectionState, key: string, value: string): void {
    // Check for service-specific tokens
    switch (key) {
      case 'NICKSERV':
        state.detectedServices.set(value.toLowerCase(), 'nickserv');
        break;
      case 'CHANSERV':
        state.detectedServices.set(value.toLowerCase(), 'chanserv');
        break;
      case 'HOSTSERV':
        state.detectedServices.set(value.toLowerCase(), 'hostserv');
        break;
      case 'OPERSERV':
        state.detectedServices.set(value.toLowerCase(), 'operserv');
        break;
      case 'BOTSERV':
        state.detectedServices.set(value.toLowerCase(), 'botserv');
        break;
      case 'MEMOSERV':
        state.detectedServices.set(value.toLowerCase(), 'memoserv');
        break;
      case 'GROUPSERV':
        state.detectedServices.set(value.toLowerCase(), 'groupserv');
        break;
    }
  }

  private identifyServiceFromMessage(nick: string, message: string): string | undefined {
    const lowerMsg = message.toLowerCase();
    const lowerNick = nick.toLowerCase();
    
    // Check nick first
    if (lowerNick.includes('nickserv') || nick === 'NS') return 'nickserv';
    if (lowerNick.includes('chanserv') || nick === 'CS') return 'chanserv';
    if (lowerNick.includes('hostserv') || nick === 'HS') return 'hostserv';
    if (lowerNick.includes('operserv') || nick === 'OS') return 'operserv';
    if (lowerNick.includes('botserv') || nick === 'BS') return 'botserv';
    if (lowerNick.includes('memoserv') || nick === 'MS') return 'memoserv';
    if (lowerNick === 'x') return 'x';
    if (lowerNick === 'q') return 'q';
    
    // Check message content for service identification
    if (lowerMsg.includes('nickname') && lowerMsg.includes('register')) return 'nickserv';
    if (lowerMsg.includes('channel') && lowerMsg.includes('register')) return 'chanserv';
    if (lowerMsg.includes('vhost') || lowerMsg.includes('virtual host')) return 'hostserv';
    if (lowerMsg.includes('memo') || lowerMsg.includes('message')) return 'memoserv';
    
    return undefined;
  }

  private attemptDetection(networkId: string): void {
    const state = this.states.get(networkId);
    if (!state) return;

    // Don't re-detect if already detected with high confidence
    if (state.detectionResult && state.detectionResult.confidence > 0.8) {
      return;
    }

    const result = this.performDetection(state);
    if (result.confidence > 0.5) {
      state.detectionResult = result;
      this.emitDetection(networkId, result);
    }
  }

  private performDetection(state: DetectionState): DetectionResult {
    const results: Array<{ serviceType: IRCServiceType; ircdType: IRCdType; confidence: number; method: DetectionResult['method'] }> = [];

    // 1. Try network name matching
    if (state.networkName) {
      const networkResult = this.detectFromNetworkName(state.networkName);
      if (networkResult) {
        results.push({ ...networkResult, method: 'network' });
      }
    }

    // 2. Try ISUPPORT tokens
    const isupportResult = this.detectFromISupport(state.isupportTokens);
    if (isupportResult) {
      results.push({ ...isupportResult, method: 'isupport' });
    }

    // 3. Try version string
    if (state.serverVersion) {
      const versionResult = this.detectFromVersion(state.serverVersion);
      if (versionResult) {
        results.push({ ...versionResult, method: 'version' });
      }
    }

    // 4. Try detected services
    if (state.detectedServices.size > 0) {
      const servicesResult = this.detectFromServices(state.detectedServices);
      if (servicesResult) {
        results.push({ ...servicesResult, method: 'services' });
      }
    }

    // Select best result
    if (results.length === 0) {
      return {
        serviceType: 'generic',
        ircdType: 'unknown',
        confidence: 0,
        method: 'heuristic',
      };
    }

    // Sort by confidence and pick best
    results.sort((a, b) => b.confidence - a.confidence);
    const best = results[0];

    return {
      serviceType: best.serviceType,
      ircdType: best.ircdType,
      confidence: best.confidence,
      method: best.method,
      rawData: {
        networkName: state.networkName,
        serverVersion: state.serverVersion,
        isupportTokens: Object.fromEntries(state.isupportTokens),
        detectedServices: Object.fromEntries(state.detectedServices),
      },
    };
  }

  private detectFromNetworkName(networkName: string): { serviceType: IRCServiceType; ircdType: IRCdType; confidence: number } | null {
    const lowerName = networkName.toLowerCase();

    // Direct network name mapping
    for (const [pattern, serviceType] of Object.entries(NETWORK_SERVICE_MAP)) {
      if (lowerName.includes(pattern)) {
        return {
          serviceType,
          ircdType: this.inferIRCdFromService(serviceType),
          confidence: 0.85,
        };
      }
    }

    // Pattern-based detection
    if (lowerName.includes('undernet') || lowerName.includes('under')) {
      return { serviceType: 'undernet', ircdType: 'charybdis', confidence: 0.85 };
    }
    if (lowerName.includes('quakenet') || lowerName.includes('quake')) {
      return { serviceType: 'quakenet', ircdType: 'unknown', confidence: 0.85 };
    }
    if (lowerName.includes('dalnet') || lowerName.includes('dal')) {
      return { serviceType: 'dalnet', ircdType: 'unknown', confidence: 0.85 };
    }

    return null;
  }

  private detectFromISupport(tokens: Map<string, string>): { serviceType: IRCServiceType; ircdType: IRCdType; confidence: number } | null {
    let ircdType: IRCdType = 'unknown';
    let serviceType: IRCServiceType = 'generic';
    let confidence = 0;
    let detectedIRCd = false;
    let detectedService = false;

    // Check for service nicks in tokens
    const nickserv = tokens.get('NICKSERV');
    const chanserv = tokens.get('CHANSERV');
    const hostserv = tokens.get('HOSTSERV');

    if (nickserv || chanserv) {
      // Has services, try to identify which type
      if (tokens.has('NICKSERV') && tokens.has('CHANSERV') && !tokens.has('X')) {
        // Likely Anope/Atheme style
        serviceType = 'anope';
        confidence += 0.3;
        detectedService = true;
      }
    }

    // Check IRCd-specific tokens
    for (const { tokens: requiredTokens, type, confidence: tokenConfidence } of IRCD_ISUPPORT_PATTERNS) {
      const hasAllTokens = requiredTokens.every(t => {
        const [key, val] = t.split('=');
        if (val) {
          return tokens.get(key) === val;
        }
        return tokens.has(key);
      });

      if (hasAllTokens) {
        ircdType = type;
        confidence = Math.max(confidence, tokenConfidence);
        detectedIRCd = true;
        break;
      }
    }

    // Check for specific network indicators
    const network = tokens.get('NETWORK');
    if (network) {
      const networkResult = this.detectFromNetworkName(network);
      if (networkResult) {
        serviceType = networkResult.serviceType;
        confidence = Math.max(confidence, networkResult.confidence);
        detectedService = true;
      }
    }

    if (!detectedIRCd && !detectedService) {
      return null;
    }

    return { serviceType, ircdType, confidence };
  }

  private detectFromVersion(version: string): { serviceType: IRCServiceType; ircdType: IRCdType; confidence: number } | null {
    for (const { pattern, type, confidence } of IRCD_VERSION_PATTERNS) {
      if (pattern.test(version)) {
        return {
          serviceType: 'generic',
          ircdType: type,
          confidence,
        };
      }
    }

    return null;
  }

  private detectFromServices(services: Map<string, string>): { serviceType: IRCServiceType; ircdType: IRCdType; confidence: number } | null {
    const serviceNicks = Array.from(services.keys());
    
    // Check for Undernet X
    if (serviceNicks.includes('x') || serviceNicks.some(n => n.includes('x@'))) {
      return { serviceType: 'undernet', ircdType: 'charybdis', confidence: 0.90 };
    }
    
    // Check for QuakeNet Q
    if (serviceNicks.includes('q') || serviceNicks.some(n => n.includes('q@'))) {
      return { serviceType: 'quakenet', ircdType: 'unknown', confidence: 0.90 };
    }
    
    // Check for DALnet (ChanServ/NickServ with specific patterns)
    const hasChanServ = serviceNicks.some(n => n.includes('chanserv'));
    const hasNickServ = serviceNicks.some(n => n.includes('nickserv'));
    
    if (hasChanServ && hasNickServ) {
      // Could be Anope, Atheme, or DALnet
      // DALnet usually has specific behavior
      return { serviceType: 'anope', ircdType: 'unrealircd', confidence: 0.60 };
    }

    return null;
  }

  private inferIRCdFromService(serviceType: IRCServiceType): IRCdType {
    switch (serviceType) {
      case 'undernet':
        return 'charybdis';
      case 'dalnet':
        return 'hybrid';
      case 'quakenet':
        return 'unknown';
      case 'anope':
      case 'atheme':
        return 'unrealircd'; // Most common pairing
      default:
        return 'unknown';
    }
  }

  private emitDetection(networkId: string, result: DetectionResult): void {
    this.detectionCallbacks.forEach(callback => {
      try {
        callback(networkId, result);
      } catch (error) {
        console.error('ServiceDetectionService: Error in detection callback:', error);
      }
    });
  }
}

// Singleton instance
export const serviceDetectionService = new ServiceDetectionService();
