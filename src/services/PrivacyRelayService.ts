/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './Logger';
import {
  DEFAULT_PRIVACY_RELAY_TURN_SERVER,
  PRIVACY_RELAY_PRODUCT_ID,
  PRIVACY_RELAY_STORAGE_KEY,
  PrivacyRelayAccessState,
  PrivacyRelayTurnCredentials,
  PrivacyRelaySubscription,
  isPrivacyRelayActive,
} from '../types/privacyRelay';

type PrivacyRelayListener = (
  subscription: PrivacyRelaySubscription | null,
) => void;

const API_BASE_URL = 'https://androidircx.com/api';
const DEVICE_ID_STORAGE_KEY = '@AndroidIRCX:privacyRelayDeviceId';
const API_TIMEOUT_MS = 15000;

interface ActivatePrivacyRelayInput {
  purchaseToken: string;
  basePlanId?: string | null;
  expiresAt?: string | null;
  status?: PrivacyRelaySubscription['status'];
}

class PrivacyRelayService {
  private subscription: PrivacyRelaySubscription | null = null;
  private initialized = false;
  private listeners: Set<PrivacyRelayListener> = new Set();

  private async getOrCreateDeviceId(): Promise<string> {
    const existing = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const deviceId = `relay-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    return deviceId;
  }

  private async apiCall<T>(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('[PrivacyRelay] API request start:', endpoint, body);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const response = (await Promise.race([
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
        new Promise<Response>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                `Privacy Relay backend request timed out after ${API_TIMEOUT_MS}ms.`,
              ),
            );
          }, API_TIMEOUT_MS);
        }),
      ])) as Response;

      console.log(
        '[PrivacyRelay] API response status:',
        endpoint,
        response.status,
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let message =
          errorText || `Request failed with status ${response.status}`;

        try {
          const parsed = JSON.parse(errorText);
          if (typeof parsed?.error === 'string') {
            message = parsed.error;
          }
        } catch {
          // Keep the raw text if the backend did not return structured JSON.
        }

        throw new Error(message);
      }

      const data = (await response.json()) as T;
      console.log('[PrivacyRelay] API response ok:', endpoint, data);
      return data;
    } catch (error: any) {
      console.log(
        '[PrivacyRelay] API request failed:',
        endpoint,
        error?.message || String(error),
      );
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.load();
    this.initialized = true;
  }

  private async load(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(PRIVACY_RELAY_STORAGE_KEY);
      this.subscription = raw ? JSON.parse(raw) : null;
    } catch (error) {
      logger.error(
        'privacy-relay',
        `Failed to load subscription: ${String(error)}`,
      );
      this.subscription = null;
    }
  }

  private async save(): Promise<void> {
    try {
      if (this.subscription) {
        await AsyncStorage.setItem(
          PRIVACY_RELAY_STORAGE_KEY,
          JSON.stringify(this.subscription),
        );
      } else {
        await AsyncStorage.removeItem(PRIVACY_RELAY_STORAGE_KEY);
      }
    } catch (error) {
      logger.error(
        'privacy-relay',
        `Failed to save subscription: ${String(error)}`,
      );
    }
  }

  private notify(): void {
    const snapshot = this.getSubscription();
    this.listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (error) {
        logger.error('privacy-relay', `Listener error: ${String(error)}`);
      }
    });
  }

  addListener(listener: PrivacyRelayListener): () => void {
    this.listeners.add(listener);
    listener(this.getSubscription());
    return () => this.listeners.delete(listener);
  }

  getSubscription(): PrivacyRelaySubscription | null {
    return this.subscription ? { ...this.subscription } : null;
  }

  hasActiveSubscription(): boolean {
    return isPrivacyRelayActive(this.subscription);
  }

  getRelayAccessState(): PrivacyRelayAccessState {
    return {
      hasSubscription: this.hasActiveSubscription(),
      requiresBackendCredentials: true,
      relayServer: DEFAULT_PRIVACY_RELAY_TURN_SERVER,
      subscription: this.getSubscription(),
    };
  }

  async activateSubscription(
    input: ActivatePrivacyRelayInput,
  ): Promise<PrivacyRelaySubscription> {
    const now = new Date().toISOString();
    this.subscription = {
      productId: PRIVACY_RELAY_PRODUCT_ID,
      basePlanId: input.basePlanId ?? null,
      purchaseToken: input.purchaseToken,
      status: input.status ?? 'active',
      expiresAt: input.expiresAt ?? null,
      activatedAt: this.subscription?.activatedAt || now,
      lastValidatedAt: now,
    };

    await this.save();
    this.notify();
    logger.info(
      'privacy-relay',
      `Activated Privacy Relay base plan: ${this.subscription.basePlanId || 'unknown'}`,
    );
    return this.getSubscription() as PrivacyRelaySubscription;
  }

  async deactivateSubscription(
    status: PrivacyRelaySubscription['status'] = 'inactive',
  ): Promise<void> {
    if (!this.subscription) {
      return;
    }

    this.subscription = {
      ...this.subscription,
      status,
      lastValidatedAt: new Date().toISOString(),
    };
    await this.save();
    this.notify();
  }

  async clearSubscription(): Promise<void> {
    this.subscription = null;
    await this.save();
    this.notify();
  }

  async restoreFromPurchaseTokens(
    purchases: Array<{
      purchaseToken?: string | null;
      basePlanId?: string | null;
    }>,
  ): Promise<number> {
    const match = purchases.find(p => Boolean(p.purchaseToken));
    if (!match?.purchaseToken) {
      return 0;
    }

    await this.activateSubscription({
      purchaseToken: match.purchaseToken,
      basePlanId: match.basePlanId ?? null,
      status: 'active',
    });
    return 1;
  }

  async registerPurchaseWithBackend(
    purchaseToken: string,
    fallbackBasePlanId?: string | null,
  ): Promise<PrivacyRelaySubscription> {
    console.log('[PrivacyRelay] Registering purchase with backend');
    const response = await this.apiCall<{
      active?: boolean;
      status?: PrivacyRelaySubscription['status'];
      base_plan_id?: string | null;
      expires_at?: string | null;
      subscription?: {
        status?: PrivacyRelaySubscription['status'];
        base_plan_id?: string | null;
        expires_at?: string | null;
      };
    }>('/webrtc/privacy-relay/register-purchase', {
      purchase_token: purchaseToken,
    });

    const nested = response.subscription || {};
    const status =
      nested.status ||
      response.status ||
      (response.active === false ? 'inactive' : 'active');

    console.log('[PrivacyRelay] Backend registration parsed:', {
      status,
      basePlanId:
        nested.base_plan_id ??
        response.base_plan_id ??
        fallbackBasePlanId ??
        null,
      expiresAt: nested.expires_at ?? response.expires_at ?? null,
    });

    return await this.activateSubscription({
      purchaseToken,
      basePlanId:
        nested.base_plan_id ??
        response.base_plan_id ??
        fallbackBasePlanId ??
        null,
      expiresAt: nested.expires_at ?? response.expires_at ?? null,
      status,
    });
  }

  async fetchTurnCredentials(
    purchaseToken: string,
    options?: { deviceId?: string; callId?: string },
  ): Promise<PrivacyRelayTurnCredentials> {
    const deviceId = options?.deviceId || (await this.getOrCreateDeviceId());
    const callId = options?.callId || `relay-call-${Date.now()}`;
    console.log('[PrivacyRelay] Fetching TURN credentials', {
      deviceId,
      callId,
    });
    const response = await this.apiCall<{
      ice_servers?: Array<{
        urls?: string[] | string;
        username?: string;
        credential?: string;
      }>;
      ttl?: number;
      relay?: boolean;
    }>('/webrtc/turn-credentials', {
      purchase_token: purchaseToken,
      device_id: deviceId,
      call_id: callId,
    });

    const parsedIceServers = (response.ice_servers || [])
      .map(server => {
        const urls = Array.isArray(server.urls)
          ? server.urls
          : server.urls
            ? [server.urls]
            : [];

        return {
          urls,
          username: server.username,
          credential: server.credential,
        };
      })
      .filter(
        (
          server,
        ): server is { urls: string[]; username: string; credential: string } =>
          server.urls.length > 0 &&
          Boolean(server.username) &&
          Boolean(server.credential),
      );

    if (parsedIceServers.length === 0) {
      throw new Error(
        'Privacy Relay backend did not return valid TURN credentials.',
      );
    }

    const primaryIceServer = parsedIceServers[0];

    console.log('[PrivacyRelay] TURN credentials received', {
      urls: parsedIceServers.flatMap(server => server.urls),
      username: primaryIceServer.username,
      ttl: response.ttl ?? 0,
      relay: response.relay !== false,
    });

    await this.activateSubscription({
      purchaseToken,
      basePlanId: this.subscription?.basePlanId ?? null,
      expiresAt: this.subscription?.expiresAt ?? null,
      status: 'active',
    });

    return {
      iceServers: parsedIceServers,
      ttl: response.ttl ?? 0,
      relay: response.relay !== false,
      username: primaryIceServer.username,
      credential: primaryIceServer.credential,
      deviceId,
      callId,
      fetchedAt: new Date().toISOString(),
    };
  }
}

export const privacyRelayService = new PrivacyRelayService();

export {
  DEFAULT_PRIVACY_RELAY_TURN_SERVER,
  PRIVACY_RELAY_PRODUCT_ID,
  PRIVACY_RELAY_BASE_PLAN_IDS,
  isPrivacyRelayActive,
} from '../types/privacyRelay';
