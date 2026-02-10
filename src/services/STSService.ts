/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * STS (Strict Transport Security) Service
 * Implements IRCv3 STS specification: https://ircv3.net/specs/extensions/sts
 * 
 * STS allows IRC servers to instruct clients to use TLS for future connections.
 * When a client receives an STS policy, it must:
 * 1. Immediately upgrade the current connection to TLS (if not already)
 * 2. Remember the policy and use TLS for all future connections to that host
 * 3. Use the specified port if provided
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STS_POLICIES_STORAGE_KEY = 'STS_POLICIES';

export interface STSPolicy {
  hostname: string;
  port: number | null; // null means use default port (6697)
  duration: number; // in seconds
  expiresAt: number; // timestamp
  preload?: boolean; // whether this is a preload policy
}

export interface STSConnectionResult {
  shouldUpgrade: boolean;
  reason?: string;
  tlsRequired: boolean;
  targetPort: number;
  targetHost: string;
}

export class STSService {
  private policies: Map<string, STSPolicy> = new Map();
  private loaded: boolean = false;

  constructor() {
    this.loadPolicies();
  }

  private async loadPolicies() {
    if (this.loaded) return;
    
    try {
      const stored = await AsyncStorage.getItem(STS_POLICIES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Prune expired policies on load
        const now = Date.now();
        const validPolicies = new Map<string, STSPolicy>();
        for (const [host, policy] of Object.entries(parsed)) {
          if ((policy as STSPolicy).expiresAt > now) {
            validPolicies.set(host, policy as STSPolicy);
          }
        }
        this.policies = validPolicies;
        this.savePolicies();
      }
      this.loaded = true;
    } catch (error) {
      console.error('Failed to load STS policies:', error);
    }
  }

  private async savePolicies() {
    try {
      const data = Object.fromEntries(this.policies);
      await AsyncStorage.setItem(STS_POLICIES_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save STS policies:', error);
    }
  }

  /**
   * Parse STS capability value
   * Format: duration=<seconds>,port=<port>,preload
   * Example: duration=31536000,port=6697
   */
  public parseCapValue(capValue: string): { [key: string]: string } | null {
    const result: { [key: string]: string } = {};
    
    const pairs = capValue.split(',');
    for (const pair of pairs) {
      const trimmed = pair.trim();
      if (trimmed.includes('=')) {
        const [key, value] = trimmed.split('=');
        result[key.trim()] = value.trim();
      } else if (trimmed === 'preload') {
        result['preload'] = 'true';
      }
    }
    
    // Validate required fields
    if (!result['duration']) {
      console.error('STS: Missing required "duration" field in cap value:', capValue);
      return null;
    }
    
    return result;
  }

  /**
   * Get policy for a hostname
   */
  public getPolicy(hostname: string): STSPolicy | undefined {
    this.ensureLoaded();
    const policy = this.policies.get(hostname.toLowerCase());
    if (policy && policy.expiresAt < Date.now()) {
      // Policy has expired
      this.policies.delete(hostname.toLowerCase());
      this.savePolicies();
      return undefined;
    }
    return policy;
  }

  /**
   * Check if STS policy requires TLS for a connection
   */
  public checkConnection(
    hostname: string, 
    port: number, 
    currentTls: boolean
  ): STSConnectionResult {
    this.ensureLoaded();
    
    const policy = this.getPolicy(hostname);
    const defaultTlsPort = 6697;
    
    if (!policy) {
      return {
        shouldUpgrade: false,
        tlsRequired: false,
        targetPort: port,
        targetHost: hostname,
      };
    }

    // If we have a policy, TLS is required
    if (!currentTls) {
      return {
        shouldUpgrade: true,
        reason: `STS policy requires TLS for ${hostname}`,
        tlsRequired: true,
        targetPort: policy.port || defaultTlsPort,
        targetHost: hostname,
      };
    }

    // Already using TLS, check if we need to change port
    const targetPort = policy.port || port;
    if (policy.port && policy.port !== port) {
      return {
        shouldUpgrade: true,
        reason: `STS policy requires port ${policy.port} for ${hostname}`,
        tlsRequired: true,
        targetPort,
        targetHost: hostname,
      };
    }

    return {
      shouldUpgrade: false,
      tlsRequired: true,
      targetPort,
      targetHost: hostname,
    };
  }

  /**
   * Save or update STS policy from CAP value
   */
  public savePolicy(hostname: string, capValue: string): boolean {
    this.ensureLoaded();
    
    const parsed = this.parseCapValue(capValue);
    if (!parsed) {
      console.error(`STS: Failed to parse policy for ${hostname}:`, capValue);
      return false;
    }

    const duration = parseInt(parsed['duration'], 10);
    const port = parsed['port'] ? parseInt(parsed['port'], 10) : null;

    if (isNaN(duration) || duration < 0) {
      console.error(`STS: Invalid duration in policy for ${hostname}:`, duration);
      return false;
    }

    if (duration === 0) {
      // Duration 0 means remove the policy
      this.policies.delete(hostname.toLowerCase());
      console.log(`STS: Removed policy for ${hostname} (duration=0)`);
      this.savePolicies();
      return true;
    }

    if (port !== null && (isNaN(port) || port <= 0 || port > 65535)) {
      console.error(`STS: Invalid port in policy for ${hostname}:`, port);
      return false;
    }

    const newPolicy: STSPolicy = {
      hostname: hostname.toLowerCase(),
      port,
      duration,
      expiresAt: Date.now() + duration * 1000,
      preload: parsed['preload'] === 'true',
    };

    this.policies.set(hostname.toLowerCase(), newPolicy);
    console.log(`STS: Saved policy for ${hostname}`, newPolicy);
    this.savePolicies();
    return true;
  }

  /**
   * Remove policy for a hostname
   */
  public removePolicy(hostname: string): boolean {
    this.ensureLoaded();
    const hadPolicy = this.policies.has(hostname.toLowerCase());
    if (hadPolicy) {
      this.policies.delete(hostname.toLowerCase());
      this.savePolicies();
      console.log(`STS: Removed policy for ${hostname}`);
    }
    return hadPolicy;
  }

  /**
   * Get all active policies
   */
  public getAllPolicies(): STSPolicy[] {
    this.ensureLoaded();
    const now = Date.now();
    const active: STSPolicy[] = [];
    
    for (const [host, policy] of this.policies) {
      if (policy.expiresAt > now) {
        active.push(policy);
      } else {
        // Clean up expired
        this.policies.delete(host);
      }
    }
    
    // Save if we cleaned up any
    if (active.length !== this.policies.size) {
      this.savePolicies();
    }
    
    return active;
  }

  /**
   * Clear all policies
   */
  public async clearAllPolicies(): Promise<void> {
    this.policies.clear();
    await this.savePolicies();
    console.log('STS: Cleared all policies');
  }

  private ensureLoaded() {
    if (!this.loaded) {
      this.loadPolicies();
    }
  }
}

export const stsService = new STSService();
