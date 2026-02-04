/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Auto Authentication Service
 * Manages automatic authentication with IRC services (NickServ, Q, X, etc.)
 * Integrates with SASL and provides fallback to service-specific auth methods
 */

import { IRCService } from './IRCService';
import { serviceDetectionService } from './ServiceDetectionService';
import {
  IRCServiceType,
  DetectionResult,
  ServiceCommand,
} from '../interfaces/ServiceTypes';
import { tx } from '../i18n/transifex';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

/** Authentication method types */
export type AuthMethod = 'sasl_external' | 'sasl_plain' | 'nickserv' | 'quakenet' | 'undernet' | 'none';

/** Authentication credentials */
export interface AuthCredentials {
  /** Account name (for SASL) or nick */
  account?: string;
  /** Password */
  password: string;
  /** Certificate fingerprint (for SASL EXTERNAL) */
  certFingerprint?: string;
}

/** Authentication result */
export interface AuthResult {
  /** Whether authentication was successful */
  success: boolean;
  /** Method used for authentication */
  method: AuthMethod;
  /** Error message if failed */
  error?: string;
  /** Service that authenticated (e.g., 'NickServ', 'Q') */
  service?: string;
}

/** Authentication configuration for a network */
export interface AuthConfig {
  /** Preferred authentication method */
  preferredMethod?: AuthMethod;
  /** NickServ password (legacy) */
  nickservPassword?: string;
  /** SASL account */
  saslAccount?: string;
  /** SASL password */
  saslPassword?: string;
  /** Client certificate for SASL EXTERNAL */
  clientCert?: string;
  /** Whether to force SASL even if not advertised */
  saslForce?: boolean;
}

/** AutoAuthService options */
export interface AutoAuthOptions {
  /** Network ID */
  networkId: string;
  /** IRC Service instance */
  ircService: IRCService;
  /** Authentication configuration */
  authConfig: AuthConfig;
  /** Whether SASL is available on this connection */
  saslAvailable: boolean;
  /** Whether already authenticated via SASL */
  saslAuthenticated: boolean;
}

/**
 * Auto Authentication Service
 * 
 * Handles automatic authentication with IRC services using the best available method:
 * 1. SASL EXTERNAL (certificate-based) - most secure
 * 2. SASL PLAIN (account/password) - secure over TLS
 * 3. NickServ IDENTIFY - fallback when SASL unavailable
 * 4. Network-specific methods (Q, X) - for QuakeNet/Undernet
 */
export class AutoAuthService {
  private ircService: IRCService;
  private networkId: string;
  private authConfig: AuthConfig;
  private saslAvailable: boolean;
  private saslAuthenticated: boolean;
  private detectionResult?: DetectionResult;
  private authAttempted: boolean = false;
  private authCompleted: boolean = false;

  constructor(options: AutoAuthOptions) {
    this.networkId = options.networkId;
    this.ircService = options.ircService;
    this.authConfig = options.authConfig;
    this.saslAvailable = options.saslAvailable;
    this.saslAuthenticated = options.saslAuthenticated;

    // Subscribe to service detection
    this.setupDetectionListener();
  }

  /**
   * Set up listener for service detection events
   */
  private setupDetectionListener(): void {
    // Check if we already have detection
    this.detectionResult = serviceDetectionService.getDetectionResult(this.networkId);
    
    // Subscribe to future detection events
    serviceDetectionService.onDetection((networkId, result) => {
      if (networkId === this.networkId) {
        this.detectionResult = result;
        // Try authentication if not yet attempted and we have credentials
        if (!this.authAttempted && this.shouldAuthenticate()) {
          this.authenticate();
        }
      }
    });
  }

  /**
   * Determine if authentication should be attempted
   */
  private shouldAuthenticate(): boolean {
    // Don't re-authenticate if already done
    if (this.authCompleted) return false;
    
    // Don't authenticate if already authenticated via SASL
    if (this.saslAuthenticated) return false;

    // Check if we have any credentials
    const hasCredentials = !!(
      this.authConfig.saslAccount ||
      this.authConfig.nickservPassword ||
      this.authConfig.clientCert
    );

    return hasCredentials;
  }

  /**
   * Attempt automatic authentication
   */
  public async authenticate(): Promise<AuthResult> {
    if (this.authAttempted) {
      return {
        success: false,
        method: 'none',
        error: 'Authentication already attempted',
      };
    }

    this.authAttempted = true;

    // Determine the best authentication method
    const method = this.determineBestMethod();

    switch (method) {
      case 'sasl_external':
        // SASL EXTERNAL is handled during connection, mark as completed
        if (this.saslAuthenticated) {
          this.authCompleted = true;
          return {
            success: true,
            method: 'sasl_external',
          };
        }
        // If not authenticated but cert is available, we can't do much now
        // (SASL happens during connection)
        break;

      case 'sasl_plain':
        // SASL PLAIN is also handled during connection
        if (this.saslAuthenticated) {
          this.authCompleted = true;
          return {
            success: true,
            method: 'sasl_plain',
          };
        }
        break;

      case 'nickserv':
        return this.authenticateWithNickServ();

      case 'quakenet':
        return this.authenticateWithQuakeNet();

      case 'undernet':
        return this.authenticateWithUndernet();

      case 'none':
      default:
        return {
          success: false,
          method: 'none',
          error: 'No suitable authentication method available',
        };
    }

    return {
      success: false,
      method: 'none',
      error: 'Authentication method not available',
    };
  }

  /**
   * Determine the best available authentication method
   */
  public determineBestMethod(): AuthMethod {
    // If already authenticated via SASL, no need to do anything
    if (this.saslAuthenticated) {
      if (this.authConfig.clientCert) return 'sasl_external';
      if (this.authConfig.saslAccount) return 'sasl_plain';
    }

    // Check for certificate-based auth (SASL EXTERNAL)
    if (this.authConfig.clientCert && this.saslAvailable) {
      return 'sasl_external';
    }

    // Check for SASL PLAIN
    if (this.authConfig.saslAccount && this.authConfig.saslPassword && this.saslAvailable) {
      return 'sasl_plain';
    }

    // Check for network-specific methods
    const serviceType = this.detectionResult?.serviceType;

    if (serviceType === 'quakenet' && this.authConfig.nickservPassword) {
      return 'quakenet';
    }

    if (serviceType === 'undernet' && this.authConfig.nickservPassword) {
      return 'undernet';
    }

    // Fallback to NickServ IDENTIFY
    if (this.authConfig.nickservPassword) {
      return 'nickserv';
    }

    return 'none';
  }

  /**
   * Authenticate with NickServ (generic services)
   */
  private async authenticateWithNickServ(): Promise<AuthResult> {
    const password = this.authConfig.nickservPassword;
    if (!password) {
      return {
        success: false,
        method: 'nickserv',
        error: 'No password configured',
      };
    }

    // Get the service nick from detection or use default
    const serviceNick = this.getServiceNick('nickserv') || 'NickServ';

    try {
      this.ircService.sendRaw(`PRIVMSG ${serviceNick} :IDENTIFY ${password}`);
      this.ircService.addRawMessage(
        t('*** Sending identify to {service}...', { service: serviceNick }),
        'auth'
      );
      this.authCompleted = true;

      return {
        success: true,
        method: 'nickserv',
        service: serviceNick,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        method: 'nickserv',
        error: errorMsg,
      };
    }
  }

  /**
   * Authenticate with QuakeNet Q service
   */
  private async authenticateWithQuakeNet(): Promise<AuthResult> {
    const password = this.authConfig.nickservPassword;
    if (!password) {
      return {
        success: false,
        method: 'quakenet',
        error: 'No password configured',
      };
    }

    try {
      // Q auth format: /msg Q@CServe.quakenet.org AUTH <user> <pass>
      // Or just: /msg Q auth <pass> if username matches
      this.ircService.sendRaw(`PRIVMSG Q@CServe.quakenet.org :AUTH ${password}`);
      this.ircService.addRawMessage(
        t('*** Authenticating with QuakeNet Q...'),
        'auth'
      );
      this.authCompleted = true;

      return {
        success: true,
        method: 'quakenet',
        service: 'Q',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        method: 'quakenet',
        error: errorMsg,
      };
    }
  }

  /**
   * Authenticate with Undernet X service
   */
  private async authenticateWithUndernet(): Promise<AuthResult> {
    const password = this.authConfig.nickservPassword;
    if (!password) {
      return {
        success: false,
        method: 'undernet',
        error: 'No password configured',
      };
    }

    try {
      // X auth format: /msg X@channels.undernet.org login <user> <pass>
      this.ircService.sendRaw(`PRIVMSG X@channels.undernet.org :LOGIN ${password}`);
      this.ircService.addRawMessage(
        t('*** Authenticating with Undernet X...'),
        'auth'
      );
      this.authCompleted = true;

      return {
        success: true,
        method: 'undernet',
        service: 'X',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        method: 'undernet',
        error: errorMsg,
      };
    }
  }

  /**
   * Get service nick from detection or config
   */
  private getServiceNick(serviceName: string): string | undefined {
    const config = serviceDetectionService.getServiceConfig(this.networkId);
    if (!config?.services) return undefined;

    const service = config.services[serviceName as keyof typeof config.services];
    if (service?.enabled) {
      return service.nick;
    }

    return undefined;
  }

  /**
   * Check if authentication has been completed
   */
  public isAuthenticated(): boolean {
    return this.authCompleted || this.saslAuthenticated;
  }

  /**
   * Get authentication status
   */
  public getStatus(): {
    attempted: boolean;
    completed: boolean;
    method?: AuthMethod;
  } {
    return {
      attempted: this.authAttempted,
      completed: this.authCompleted || this.saslAuthenticated,
      method: this.determineBestMethod(),
    };
  }

  /**
   * Update SASL availability status
   */
  public updateSaslStatus(available: boolean, authenticated: boolean): void {
    this.saslAvailable = available;
    this.saslAuthenticated = authenticated;
    
    // If SASL just authenticated us, mark as completed
    if (authenticated && !this.authCompleted) {
      this.authCompleted = true;
    }
  }

  /**
   * Reset authentication state (for reconnection)
   */
  public reset(): void {
    this.authAttempted = false;
    this.authCompleted = false;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    // Nothing to clean up currently
  }
}

/**
 * Create AutoAuthService for a connection
 */
export function createAutoAuthService(options: AutoAuthOptions): AutoAuthService {
  return new AutoAuthService(options);
}
