/**
 * ZNC Subscription Types
 *
 * Type definitions for ZNC multi-account subscription system.
 */

/**
 * Status of a ZNC subscription
 */
export type ZncSubscriptionStatus = 'pending' | 'active' | 'expired' | 'grace' | 'cancelled';

/**
 * ZNC account provisioning status
 */
export type ZncProvisioningStatus = 'provisioning' | 'ready' | 'error' | 'suspended';

/**
 * A single ZNC account
 */
export interface ZncAccount {
  /** Unique account ID (from backend) */
  id: string;

  /** ZNC username */
  zncUsername: string;

  /** ZNC password (received after provisioning) */
  zncPassword: string | null;

  /** Subscription status */
  status: ZncSubscriptionStatus;

  /** ZNC server provisioning status */
  provisioningStatus: ZncProvisioningStatus;

  /** Subscription expiration date (ISO string) */
  expiresAt: string | null;

  /** Google Play purchase token */
  purchaseToken: string;

  /** Google Play subscription ID */
  subscriptionId: string;

  /** Network ID where this ZNC is currently configured (null if not assigned) */
  assignedNetworkId: string | null;

  /** Server ID within the network (for quick lookup) */
  assignedServerId: string | null;

  /** When this account was created (ISO string) */
  createdAt: string;

  /** Last time status was refreshed (ISO string) */
  lastRefreshedAt: string | null;
}

/**
 * ZNC account metadata for display (without sensitive data)
 */
export interface ZncAccountMetadata {
  id: string;
  zncUsername: string;
  status: ZncSubscriptionStatus;
  provisioningStatus: ZncProvisioningStatus;
  expiresAt: string | null;
  assignedNetworkId: string | null;
  assignedNetworkName: string | null;
  createdAt: string;
}

/**
 * Request to register a new ZNC subscription
 */
export interface ZncRegisterRequest {
  purchaseToken: string;
  subscriptionId: string;
  zncUsername: string;
}

/**
 * Response from ZNC registration API
 */
export interface ZncRegisterResponse {
  /** Account ID */
  id: string;
  /** Subscription status */
  status: ZncSubscriptionStatus;
  /** Expiration date (ISO string) */
  expires_at: string | null;
  /** ZNC username (may be modified by server) */
  znc_username: string | null;
  /** ZNC password */
  znc_password: string | null;
  /** ZNC provisioning status */
  znc_status: ZncProvisioningStatus | null;
  /** Error message if any */
  error?: string;
}

/**
 * Request to restore purchases
 */
export interface ZncRestoreRequest {
  /** Array of purchase tokens from Google Play */
  purchaseTokens: string[];
}

/**
 * Response from restore purchases API
 */
export interface ZncRestoreResponse {
  /** List of restored accounts */
  accounts: ZncRegisterResponse[];
  /** Number of accounts restored */
  restored_count: number;
  /** Error message if any */
  error?: string;
}

/**
 * Request to get all user's ZNC accounts
 */
export interface ZncListRequest {
  /** Purchase tokens to verify ownership */
  purchaseTokens: string[];
}

/**
 * Response from list accounts API
 */
export interface ZncListResponse {
  accounts: ZncRegisterResponse[];
  error?: string;
}

/**
 * ZNC server configuration (to be added to a network)
 */
export interface ZncServerConfig {
  /** Server ID (generated) */
  id: string;
  /** ZNC server hostname */
  hostname: string;
  /** ZNC server port */
  port: number;
  /** Display name for the server */
  displayName: string;
  /** Use SSL/TLS */
  ssl: boolean;
  /** Reject unauthorized certificates */
  rejectUnauthorized: boolean;
  /** ZNC username */
  username: string;
  /** ZNC password */
  password: string;
  /** Mark as ZNC connection type */
  connectionType: 'znc';
  /** Reference to the ZNC account ID */
  zncAccountId: string;
}

/**
 * Default ZNC server settings
 */
export const DEFAULT_ZNC_SERVER: Omit<ZncServerConfig, 'id' | 'username' | 'password' | 'zncAccountId' | 'displayName'> = {
  hostname: 'irc.androidircx.com',
  port: 16786,
  ssl: true,
  rejectUnauthorized: false,
  connectionType: 'znc',
};

/**
 * Storage keys for ZNC data
 */
export const ZNC_STORAGE_KEYS = {
  /** All ZNC accounts */
  ACCOUNTS: '@AndroidIRCX:zncAccounts',
  /** Purchase tokens index */
  TOKENS: '@AndroidIRCX:zncPurchaseTokens',
} as const;

/**
 * Google Play subscription product ID for ZNC
 */
export const ZNC_PRODUCT_ID = 'znc';

/**
 * Google Play base plan ID for ZNC
 */
export const ZNC_BASE_PLAN_ID = 'znc-user';

/**
 * Check if a ZNC account is active (can be used)
 */
export function isZncAccountActive(account: ZncAccount): boolean {
  return account.status === 'active' || account.status === 'grace';
}

/**
 * Check if a ZNC account is ready to use (provisioned)
 */
export function isZncAccountReady(account: ZncAccount): boolean {
  return isZncAccountActive(account) && account.provisioningStatus === 'ready';
}

/**
 * Check if a ZNC account has valid credentials
 */
export function hasZncCredentials(account: ZncAccount): boolean {
  return !!account.zncUsername && !!account.zncPassword;
}

/**
 * Format ZNC expiration date for display
 */
export function formatZncExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'Unknown';

  try {
    const date = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'Expired';
    } else if (diffDays === 0) {
      return 'Expires today';
    } else if (diffDays === 1) {
      return 'Expires tomorrow';
    } else if (diffDays <= 7) {
      return `Expires in ${diffDays} days`;
    } else {
      return date.toLocaleDateString();
    }
  } catch {
    return 'Invalid date';
  }
}

/**
 * Generate a unique server ID for ZNC
 */
export function generateZncServerId(accountId: string): string {
  return `znc-${accountId}`;
}
