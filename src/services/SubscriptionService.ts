/**
 * ZNC Subscription Service
 *
 * Manages ZNC subscription accounts including:
 * - Multiple ZNC accounts per user
 * - Purchase registration
 * - Restore purchases
 * - Account status refresh
 * - Network assignment
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './Logger';
import { settingsService } from './SettingsService';
import { secureStorageService } from './SecureStorageService';
import {
  ZncAccount,
  ZncAccountMetadata,
  ZncRegisterRequest,
  ZncRegisterResponse,
  ZncRestoreResponse,
  ZncListResponse,
  ZncServerConfig,
  ZncProvisioningStatus,
  ZNC_STORAGE_KEYS,
  ZNC_PRODUCT_ID,
  DEFAULT_ZNC_SERVER,
  generateZncServerId,
  isZncAccountActive,
} from '../types/znc';

const API_BASE_URL = 'https://androidircx.com/api';
const ZNC_PASSWORD_PREFIX = '@AndroidIRCX:zncPassword:';
const ZNC_TOKEN_PREFIX = '@AndroidIRCX:zncPurchaseToken:';

type ZncAccountsListener = (accounts: ZncAccount[]) => void;

class SubscriptionService {
  private accounts: ZncAccount[] = [];
  private listeners: Set<ZncAccountsListener> = new Set();
  private initialized: boolean = false;

  private getPasswordKey(accountId: string): string {
    return `${ZNC_PASSWORD_PREFIX}${accountId}`;
  }

  private getTokenKey(accountId: string): string {
    return `${ZNC_TOKEN_PREFIX}${accountId}`;
  }

  private async isPasswordLockEnabled(): Promise<boolean> {
    const [biometricLock, pinLock] = await Promise.all([
      settingsService.getSetting('biometricPasswordLock', false),
      settingsService.getSetting('pinPasswordLock', false),
    ]);
    return Boolean(biometricLock || pinLock);
  }

  private async prepareAccountsForStorage(
    accounts: ZncAccount[],
    lockEnabled: boolean
  ): Promise<ZncAccount[]> {
    const persisted: ZncAccount[] = [];

    for (const account of accounts) {
      const next: ZncAccount = { ...account };
      const passwordKey = this.getPasswordKey(account.id);
      const tokenKey = this.getTokenKey(account.id);

      if (lockEnabled) {
        if (account.zncPassword) {
          await secureStorageService.setSecret(passwordKey, account.zncPassword);
          next.zncPassword = null;
        }
        if (account.purchaseToken) {
          await secureStorageService.setSecret(tokenKey, account.purchaseToken);
          next.purchaseToken = '';
        }
      } else {
        await secureStorageService.removeSecret(passwordKey);
        await secureStorageService.removeSecret(tokenKey);
      }

      persisted.push(next);
    }

    return persisted;
  }

  private async hydrateAccountsFromSecureStorage(accounts: ZncAccount[]): Promise<ZncAccount[]> {
    const hydrated: ZncAccount[] = [];
    for (const account of accounts) {
      const passwordKey = this.getPasswordKey(account.id);
      const tokenKey = this.getTokenKey(account.id);
      const [storedPassword, storedToken] = await Promise.all([
        secureStorageService.getSecret(passwordKey),
        secureStorageService.getSecret(tokenKey),
      ]);
      hydrated.push({
        ...account,
        zncPassword: account.zncPassword || storedPassword,
        purchaseToken: account.purchaseToken || storedToken || '',
      });
    }
    return hydrated;
  }

  /**
   * Initialize the service and load accounts from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadAccounts();
      const lockEnabled = await this.isPasswordLockEnabled();
      if (lockEnabled) {
        const persisted = await this.prepareAccountsForStorage(this.accounts, true);
        await AsyncStorage.setItem(ZNC_STORAGE_KEYS.ACCOUNTS, JSON.stringify(persisted));
        await this.savePurchaseTokens();
      } else {
        this.accounts = await this.hydrateAccountsFromSecureStorage(this.accounts);
        await this.saveAccounts();
      }
      this.initialized = true;
      logger.info('znc', 'SubscriptionService initialized');
    } catch (error) {
      logger.error('znc', `Failed to initialize SubscriptionService: ${error}`);
    }
  }

  /**
   * Load accounts from AsyncStorage
   */
  private async loadAccounts(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(ZNC_STORAGE_KEYS.ACCOUNTS);
      if (raw) {
        this.accounts = JSON.parse(raw);
        logger.info('znc', `Loaded ${this.accounts.length} ZNC accounts`);
      } else {
        logger.info('znc', 'No ZNC accounts found in storage');
        this.accounts = [];
      }
    } catch (error) {
      logger.error('znc', `Failed to load ZNC accounts: ${error}`);
      logger.error('znc', `Storage key: ${ZNC_STORAGE_KEYS.ACCOUNTS}`);
      // Try to parse to see if there's malformed data
      try {
        const raw = await AsyncStorage.getItem(ZNC_STORAGE_KEYS.ACCOUNTS);
        if (raw) {
          logger.warn('znc', `Raw storage length: ${raw.length}`);
        }
      } catch (innerError) {
        logger.error('znc', `Failed to read raw storage content: ${innerError}`);
      }
      this.accounts = [];
    }
  }

  /**
   * Save accounts to AsyncStorage
   */
  private async saveAccounts(): Promise<void> {
    try {
      const lockEnabled = await this.isPasswordLockEnabled();
      const persisted = await this.prepareAccountsForStorage(this.accounts, lockEnabled);
      await AsyncStorage.setItem(ZNC_STORAGE_KEYS.ACCOUNTS, JSON.stringify(persisted));
      logger.info('znc', `Saved ${this.accounts.length} ZNC accounts`);
    } catch (error) {
      logger.error('znc', `Failed to save ZNC accounts: ${error}`);
    }
  }

  /**
   * Save purchase tokens for restore functionality
   */
  private async savePurchaseTokens(): Promise<void> {
    try {
      const lockEnabled = await this.isPasswordLockEnabled();
      if (lockEnabled) {
        const tokenIndex = this.accounts.map(a => ({ accountId: a.id }));
        await Promise.all(
          this.accounts.map(a => (
            a.purchaseToken
              ? secureStorageService.setSecret(this.getTokenKey(a.id), a.purchaseToken)
              : Promise.resolve()
          ))
        );
        await AsyncStorage.setItem(ZNC_STORAGE_KEYS.TOKENS, JSON.stringify(tokenIndex));
      } else {
        const tokens = this.accounts.map(a => ({
          token: a.purchaseToken,
          accountId: a.id,
        }));
        await AsyncStorage.setItem(ZNC_STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
      }
    } catch (error) {
      logger.error('znc', `Failed to save purchase tokens: ${error}`);
    }
  }

  /**
   * Get all purchase tokens for restore
   */
  async getPurchaseTokens(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(ZNC_STORAGE_KEYS.TOKENS);
      if (raw) {
        const tokens = JSON.parse(raw);
        const lockEnabled = await this.isPasswordLockEnabled();
        if (lockEnabled) {
          const ids = tokens.map((t: { accountId?: string }) => t.accountId).filter(Boolean) as string[];
          const stored = await Promise.all(
            ids.map(id => secureStorageService.getSecret(this.getTokenKey(id)))
          );
          const parsedTokens = stored.filter(Boolean) as string[];
          logger.info('znc', `Retrieved ${parsedTokens.length} tokens from secure storage for restore`);
          return parsedTokens;
        }
        const parsedTokens = tokens.map((t: { token: string }) => t.token);
        logger.info('znc', `Retrieved ${parsedTokens.length} tokens from storage for restore`);
        return parsedTokens;
      }
    } catch (error) {
      logger.error('znc', `Failed to get purchase tokens from storage: ${error}`);
    }

    // Fallback to tokens from accounts
    const lockEnabled = await this.isPasswordLockEnabled();
    if (lockEnabled) {
      const stored = await Promise.all(
        this.accounts.map(a => secureStorageService.getSecret(this.getTokenKey(a.id)))
      );
      const accountTokens = stored.filter(Boolean) as string[];
      logger.info('znc', `Using ${accountTokens.length} tokens from secure storage for restore`);
      return accountTokens;
    }
    const accountTokens = this.accounts.map(a => a.purchaseToken).filter(token => token !== null && token !== '');
    logger.info('znc', `Using ${accountTokens.length} tokens from accounts for restore`);
    return accountTokens;
  }

  /**
   * Notify all listeners of account changes
   */
  private notifyListeners(): void {
    const accountsCopy = [...this.accounts];
    this.listeners.forEach(listener => {
      try {
        listener(accountsCopy);
      } catch (error) {
        logger.error('znc', `Listener error: ${error}`);
      }
    });
  }

  /**
   * Add a listener for account changes
   */
  addListener(listener: ZncAccountsListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener([...this.accounts]);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get all ZNC accounts
   */
  getAccounts(): ZncAccount[] {
    return [...this.accounts];
  }

  /**
   * Get account metadata (without sensitive data)
   */
  getAccountsMetadata(networkNames?: Map<string, string>): ZncAccountMetadata[] {
    return this.accounts.map(account => ({
      id: account.id,
      zncUsername: account.zncUsername,
      status: account.status,
      provisioningStatus: account.provisioningStatus,
      expiresAt: account.expiresAt,
      assignedNetworkId: account.assignedNetworkId,
      assignedNetworkName: account.assignedNetworkId && networkNames
        ? networkNames.get(account.assignedNetworkId) || null
        : null,
      createdAt: account.createdAt,
    }));
  }

  /**
   * Get a specific account by ID
   */
  getAccount(accountId: string): ZncAccount | undefined {
    return this.accounts.find(a => a.id === accountId);
  }

  async getAccountPassword(accountId: string): Promise<string | null> {
    const lockEnabled = await this.isPasswordLockEnabled();
    const account = this.getAccount(accountId);
    if (!lockEnabled && account?.zncPassword) {
      return account.zncPassword;
    }
    const stored = await secureStorageService.getSecret(this.getPasswordKey(accountId));
    return stored || account?.zncPassword || null;
  }

  /**
   * Get account by ZNC username
   */
  getAccountByUsername(username: string): ZncAccount | undefined {
    return this.accounts.find(a => a.zncUsername.toLowerCase() === username.toLowerCase());
  }

  /**
   * Get active accounts count
   */
  getActiveAccountsCount(): number {
    return this.accounts.filter(isZncAccountActive).length;
  }

  /**
   * Check if user has any active ZNC subscription
   */
  hasActiveSubscription(): boolean {
    return this.accounts.some(isZncAccountActive);
  }

  /**
   * Register a new ZNC subscription
   */
  async registerZncSubscription(request: ZncRegisterRequest): Promise<ZncAccount> {
    logger.info('znc', `Registering ZNC subscription for ${request.zncUsername}`);

    const response = await this.apiCall<ZncRegisterResponse>(
      '/subscriptions/register',
      'POST',
      {
        purchase_token: request.purchaseToken,
        subscription_id: request.subscriptionId,
        znc_username: request.zncUsername,
      }
    );

    if (response.error) {
      throw new Error(response.error);
    }

    // Debug logging for ZNC password handling
    logger.info('znc', `Registration response - id: ${response.id}, username: ${response.znc_username}, status: ${response.status}, znc_status: ${response.znc_status}`);
    logger.info('znc', `Password field - type: ${typeof response.znc_password}, hasValue: ${response.znc_password !== null && response.znc_password !== undefined}, isEmpty: ${response.znc_password === ''}, length: ${response.znc_password?.length ?? 'N/A'}`);

    // Check if account already exists (update it)
    const existingIndex = this.accounts.findIndex(a => a.id === response.id);
    const now = new Date().toISOString();

    // Determine provisioning status:
    // - Use server-provided status if available
    // - If password is provided, infer that provisioning is ready (even if znc_status is missing)
    // - Otherwise default to 'provisioning'
    const hasPassword = response.znc_password !== null && response.znc_password !== undefined && response.znc_password !== '';
    const inferredProvisioningStatus = response.znc_status || (hasPassword ? 'ready' : 'provisioning');

    const account: ZncAccount = {
      id: response.id || `local-${Date.now()}`,
      zncUsername: response.znc_username || request.zncUsername,
      // Store password as-is, only convert undefined to null (preserve empty string if that's what server sent)
      zncPassword: response.znc_password !== undefined ? response.znc_password : null,
      status: response.status || 'pending',
      provisioningStatus: inferredProvisioningStatus as ZncProvisioningStatus,
      expiresAt: response.expires_at || null,
      purchaseToken: request.purchaseToken,
      subscriptionId: request.subscriptionId,
      assignedNetworkId: null,
      assignedServerId: null,
      createdAt: existingIndex >= 0 ? this.accounts[existingIndex].createdAt : now,
      lastRefreshedAt: now,
    };

    if (existingIndex >= 0) {
      // Preserve network assignment if updating
      account.assignedNetworkId = this.accounts[existingIndex].assignedNetworkId;
      account.assignedServerId = this.accounts[existingIndex].assignedServerId;
      this.accounts[existingIndex] = account;
    } else {
      this.accounts.push(account);
    }

    await this.saveAccounts();
    await this.savePurchaseTokens();
    this.notifyListeners();

    logger.info('znc', `ZNC account registered: ${account.id}`);
    return account;
  }

  /**
   * Refresh status of a specific account
   */
  async refreshAccountStatus(accountId: string): Promise<ZncAccount | null> {
    const account = this.accounts.find(a => a.id === accountId);
    if (!account) {
      logger.error('znc', `Account not found: ${accountId}`);
      return null;
    }

    try {
      // Since the /subscriptions/status endpoint doesn't exist on the backend,
      // we'll simulate a refresh by checking if the account is still valid
      // based on its expiration date and current status
      const now = new Date();
      if (account.expiresAt) {
        const expiryDate = new Date(account.expiresAt);
        if (now > expiryDate) {
          account.status = 'expired';
        } else if (account.status === 'expired') {
          // If it was expired but now it's not past expiry, reset to active
          account.status = 'active';
        }
      }

      // Update the last refreshed timestamp
      account.lastRefreshedAt = new Date().toISOString();

      await this.saveAccounts();
      this.notifyListeners();

      logger.info('znc', `Account status refreshed locally: ${accountId}`);
      return account;
    } catch (error) {
      logger.error('znc', `Failed to refresh account status: ${error}`);
      throw error;
    }
  }

  /**
   * Refresh status of all accounts
   */
  async refreshAllAccounts(): Promise<void> {
    logger.info('znc', 'Refreshing all ZNC accounts');

    for (const account of this.accounts) {
      try {
        // Update account status based on expiration date
        const now = new Date();
        if (account.expiresAt) {
          const expiryDate = new Date(account.expiresAt);
          if (now > expiryDate) {
            account.status = 'expired';
          } else if (account.status === 'expired') {
            // If it was expired but now it's not past expiry, reset to active
            account.status = 'active';
          }
        }

        // Update the last refreshed timestamp
        account.lastRefreshedAt = new Date().toISOString();
      } catch (error) {
        logger.error('znc', `Failed to refresh account ${account.id}: ${error}`);
      }
    }

    // Save all accounts after updating
    await this.saveAccounts();
    this.notifyListeners();
  }

  /**
   * Restore purchases from Google Play
   * @param purchaseTokens Array of purchase tokens from Google Play
   */
  async restorePurchases(purchaseTokens: string[]): Promise<{ restored: number; failed: number }> {
    logger.info('znc', `Restoring purchases with ${purchaseTokens.length} tokens`);

    let restored = 0;
    let failed = 0;
    let shouldTryIndividual = false;

    try {
      // Try batch restore first
      const response = await this.apiCall<ZncRestoreResponse>(
        '/subscriptions/restore',
        'POST',
        { purchase_tokens: purchaseTokens }
      );

      logger.info('znc', `Batch restore response: accounts=${response.accounts?.length || 0}`);

      if (response.accounts && response.accounts.length > 0) {
        for (const accountData of response.accounts) {
          try {
            const existingIndex = this.accounts.findIndex(a => a.id === accountData.id);
            const now = new Date().toISOString();
            const token = purchaseTokens.find((_, i) => i < response.accounts.length) || '';

            // Infer provisioning status from password presence
            const hasPassword = accountData.znc_password !== null && accountData.znc_password !== undefined && accountData.znc_password !== '';
            const inferredStatus = accountData.znc_status || (hasPassword ? 'ready' : 'provisioning');

            const account: ZncAccount = {
              id: accountData.id || `restored-${Date.now()}-${restored}`,
              zncUsername: accountData.znc_username || '',
              zncPassword: accountData.znc_password !== undefined ? accountData.znc_password : null,
              status: accountData.status || 'active',
              provisioningStatus: inferredStatus as ZncProvisioningStatus,
              expiresAt: accountData.expires_at || null,
              purchaseToken: token,
              subscriptionId: ZNC_PRODUCT_ID,
              assignedNetworkId: existingIndex >= 0 ? this.accounts[existingIndex].assignedNetworkId : null,
              assignedServerId: existingIndex >= 0 ? this.accounts[existingIndex].assignedServerId : null,
              createdAt: existingIndex >= 0 ? this.accounts[existingIndex].createdAt : now,
              lastRefreshedAt: now,
            };

            if (existingIndex >= 0) {
              this.accounts[existingIndex] = account;
            } else {
              this.accounts.push(account);
            }

            restored++;
          } catch (error) {
            logger.error('znc', `Failed to process restored account: ${error}`);
            failed++;
          }
        }

        await this.saveAccounts();
        await this.savePurchaseTokens();
        this.notifyListeners();
      } else {
        // Batch returned no accounts, try individual method
        logger.info('znc', 'Batch restore returned no accounts, trying individual method');
        shouldTryIndividual = true;
      }
    } catch (error) {
      logger.error('znc', `Batch restore failed, trying individual: ${error}`);
      shouldTryIndividual = true;
    }

    // Try individual token restore if batch failed or returned no results
    if (shouldTryIndividual) {

      // Fallback: try each token individually
      for (const token of purchaseTokens) {
        try {
          const response = await this.apiCall<ZncRegisterResponse>(
            '/subscriptions/status',
            'POST',
            {
              purchase_token: token,
              subscription_id: ZNC_PRODUCT_ID,
            }
          );

          if (response.id && response.znc_username) {
            const existingIndex = this.accounts.findIndex(a => a.purchaseToken === token);
            const now = new Date().toISOString();

            // Infer provisioning status from password presence
            const hasPassword = response.znc_password !== null && response.znc_password !== undefined && response.znc_password !== '';
            const inferredStatus = response.znc_status || (hasPassword ? 'ready' : 'provisioning');

            const account: ZncAccount = {
              id: response.id,
              zncUsername: response.znc_username,
              zncPassword: response.znc_password !== undefined ? response.znc_password : null,
              status: response.status || 'active',
              provisioningStatus: inferredStatus as ZncProvisioningStatus,
              expiresAt: response.expires_at || null,
              purchaseToken: token,
              subscriptionId: ZNC_PRODUCT_ID,
              assignedNetworkId: existingIndex >= 0 ? this.accounts[existingIndex].assignedNetworkId : null,
              assignedServerId: existingIndex >= 0 ? this.accounts[existingIndex].assignedServerId : null,
              createdAt: existingIndex >= 0 ? this.accounts[existingIndex].createdAt : now,
              lastRefreshedAt: now,
            };

            if (existingIndex >= 0) {
              this.accounts[existingIndex] = account;
            } else {
              this.accounts.push(account);
            }

            restored++;
          }
        } catch (tokenError) {
          logger.error('znc', `Failed to restore token: ${tokenError}`);
          failed++;
        }
      }

      if (restored > 0) {
        await this.saveAccounts();
        await this.savePurchaseTokens();
        this.notifyListeners();
      }
    }

    logger.info('znc', `Restore complete: ${restored} restored, ${failed} failed`);
    return { restored, failed };
  }

  /**
   * Assign a ZNC account to a network
   */
  async assignToNetwork(accountId: string, networkId: string, serverId: string): Promise<void> {
    const account = this.accounts.find(a => a.id === accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    account.assignedNetworkId = networkId;
    account.assignedServerId = serverId;

    await this.saveAccounts();
    this.notifyListeners();

    logger.info('znc', `Account ${accountId} assigned to network ${networkId}`);
  }

  /**
   * Unassign a ZNC account from its network
   */
  async unassignFromNetwork(accountId: string): Promise<void> {
    const account = this.accounts.find(a => a.id === accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    account.assignedNetworkId = null;
    account.assignedServerId = null;

    await this.saveAccounts();
    this.notifyListeners();

    logger.info('znc', `Account ${accountId} unassigned from network`);
  }

  /**
   * Check if a username is available on the ZNC server
   * @param username The username to check
   * @returns true if available, false if taken
   */
  async checkUsernameAvailability(username: string): Promise<boolean> {
    try {
      const response = await this.apiCall<{ available: boolean }>(
        `/subscriptions/check-username?username=${encodeURIComponent(username)}`,
        'GET'
      );
      return response.available;
    } catch (error) {
      logger.error('znc', `Failed to check username availability: ${error}`);
      // On error, assume available and let registration handle it
      return true;
    }
  }

  /**
   * Generate ZNC server configuration for adding to a network
   */
  generateServerConfig(account: ZncAccount, passwordOverride?: string | null): ZncServerConfig {
    // ZNC requires password in format "username:password"
    const rawPassword = passwordOverride ?? account.zncPassword;
    const zncPassword = rawPassword
      ? `${account.zncUsername}:${rawPassword}`
      : '';

    return {
      id: generateZncServerId(account.id),
      hostname: DEFAULT_ZNC_SERVER.hostname,
      port: DEFAULT_ZNC_SERVER.port,
      displayName: `ZNC (${account.zncUsername})`,
      ssl: DEFAULT_ZNC_SERVER.ssl,
      rejectUnauthorized: DEFAULT_ZNC_SERVER.rejectUnauthorized,
      username: account.zncUsername,
      password: zncPassword,
      connectionType: 'znc',
      zncAccountId: account.id,
    };
  }

  /**
   * Delete a local account record (does not cancel subscription)
   */
  async deleteLocalAccount(accountId: string): Promise<void> {
    const index = this.accounts.findIndex(a => a.id === accountId);
    if (index >= 0) {
      this.accounts.splice(index, 1);
      await this.saveAccounts();
      await this.savePurchaseTokens();
      await secureStorageService.removeSecret(this.getPasswordKey(accountId));
      await secureStorageService.removeSecret(this.getTokenKey(accountId));
      this.notifyListeners();
      logger.info('znc', `Local account deleted: ${accountId}`);
    }
  }

  /**
   * Clear all local data (for logout/reset)
   */
  async clearAllData(): Promise<void> {
    this.accounts = [];
    await AsyncStorage.multiRemove([ZNC_STORAGE_KEYS.ACCOUNTS, ZNC_STORAGE_KEYS.TOKENS]);
    this.notifyListeners();
    logger.info('znc', 'All ZNC data cleared');
  }

  /**
   * Make an API call
   */
  private async apiCall<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    logger.info('znc', `Making API call to ${url}`);

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
      logger.debug('znc', `API call body keys: ${Object.keys(body).join(', ')}`);
    }

    try {
      const response = await fetch(url, options);
      logger.info('znc', `API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => `Request failed with status ${response.status}`);
        let errorMessage = errorText;
        try {
          // Try to parse as JSON to get structured error
          const errorJson = JSON.parse(errorText);
          errorMessage = typeof errorJson?.error === 'string' ? errorJson.error : errorText;
        } catch (parseError) {
          // If not JSON, use the raw text
          logger.warn('znc', `Non-JSON error response: ${errorText}`);
        }
        logger.error('znc', `API call failed: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const data = await response.json().catch(err => {
        logger.error('znc', `Failed to parse JSON response: ${err}`);
        return {};
      });

      const responseKeys = data && typeof data === 'object' ? Object.keys(data as object) : [];
      logger.debug('znc', `API response keys: ${responseKeys.join(', ')}`);
      return data as T;
    } catch (error) {
      logger.error('znc', `Network error in API call: ${error}`);
      throw error;
    }
  }
}

export const subscriptionService = new SubscriptionService();

// Re-export types for convenience
export type {
  ZncAccount,
  ZncAccountMetadata,
  ZncRegisterRequest,
  ZncRegisterResponse,
  ZncServerConfig,
} from '../types/znc';

export {
  ZNC_PRODUCT_ID,
  ZNC_BASE_PLAN_ID,
  DEFAULT_ZNC_SERVER,
  isZncAccountActive,
  isZncAccountReady,
  hasZncCredentials,
  formatZncExpiry,
  generateZncServerId,
} from '../types/znc';
