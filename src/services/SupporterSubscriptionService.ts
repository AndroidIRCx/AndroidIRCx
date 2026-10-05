/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNIap from 'react-native-iap';
import type { Purchase } from 'react-native-iap';
import { logger } from './Logger';
import { iapConnectionService } from './IapConnectionService';
import { inAppPurchaseService } from './InAppPurchaseService';
import {
  createPlayIntegrityRequestSecurity,
  withPlayIntegrityBody,
  withPlayIntegrityHeaders,
} from './PlayIntegrityRequestSecurity';
import {
  DEFAULT_SUPPORTER_EMOJI,
  SUPPORTER_PRODUCT_ID,
  SupporterListEntry,
  SupporterProfile,
  SupporterSubscriptionState,
  SupporterTier,
  tierForBasePlan,
} from '../types/supporter';

/**
 * The Monthly Supporter subscription.
 *
 * Who is a supporter is Google's answer, not ours: the app asks the store at
 * start-up (when it has seen a subscription before) and whenever the support
 * screen opens. An active subscription grants what Supporter Pro grants, and
 * lapses on its own when the subscription does.
 *
 * The public list lives on the backend, which re-checks the purchase token
 * with Google on every write, so a profile can only exist for a subscription
 * that was actually paid for.
 */

const STATE_KEY = '@AndroidIRCX:supporterSubscription';
const EMOJI_KEY = '@AndroidIRCX:supporterEmoji';
const API_BASE_URL = 'https://www.androidircx.com/api';
const REQUEST_TIMEOUT_MS = 15000;

type Listener = (state: SupporterSubscriptionState) => void;

const EMPTY_STATE: SupporterSubscriptionState = {
  active: false,
  tier: null,
  purchaseToken: null,
  checkedAt: null,
};

/** A short run of emoji building blocks, and nothing that reads as text. */
export function isSingleEmoji(value: string): boolean {
  const text = value.trim();
  if (!text || Array.from(text).length > 10) return false;
  // Letters, digits other than a keycap base, whitespace and punctuation are
  // text, not an emoji.
  if (/[\sA-Za-z]/.test(text)) return false;
  if (/[0-9#*](?!️?⃣)/.test(text)) return false;
  return Array.from(text).some(char => {
    const code = char.codePointAt(0) ?? 0;
    return (
      code === 0x20e3 ||
      (code >= 0x2190 && code <= 0x2bff) ||
      (code >= 0x1f000 && code <= 0x1faff)
    );
  });
}

export class SupporterApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message);
  }
}

class SupporterSubscriptionService {
  private state: SupporterSubscriptionState = { ...EMPTY_STATE };
  private emoji: string = DEFAULT_SUPPORTER_EMOJI;
  private loaded = false;
  private listeners = new Set<Listener>();

  async initialize(): Promise<void> {
    await this.load();
    // Only someone who has subscribed before needs the store asked at start-up:
    // it is how a cancelled subscription stops granting anything.
    if (this.state.purchaseToken) {
      this.refreshFromStore().catch(error =>
        logger.warn('iap', `Supporter refresh failed: ${String(error)}`),
      );
    }
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await AsyncStorage.getItem(STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const purchaseToken =
          typeof parsed?.purchaseToken === 'string' && parsed.purchaseToken
            ? parsed.purchaseToken
            : null;
        this.state = {
          // Active only with a purchase token behind it: one without can never
          // be checked against Play, so it would grant everything forever
          // (security pass 2026-10-05 — a restored backup did exactly that).
          active: parsed?.active === true && !!purchaseToken,
          tier:
            parsed?.tier === 'big' || parsed?.tier === 'monthly'
              ? parsed.tier
              : null,
          purchaseToken,
          checkedAt:
            typeof parsed?.checkedAt === 'number' ? parsed.checkedAt : null,
        };
      }
      const emoji = await AsyncStorage.getItem(EMOJI_KEY);
      if (emoji && isSingleEmoji(emoji)) this.emoji = emoji;
    } catch (error) {
      logger.warn('iap', `Failed to load supporter state: ${String(error)}`);
    }
    this.publish();
  }

  getState(): SupporterSubscriptionState {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.state.active;
  }

  /** The badge shown in place of ❤️, while the subscription is active. */
  getEmoji(): string {
    return this.emoji;
  }

  async setEmoji(emoji: string): Promise<void> {
    await this.load();
    const next = emoji.trim();
    if (!isSingleEmoji(next)) throw new Error('Pick a single emoji.');
    this.emoji = next;
    try {
      await AsyncStorage.setItem(EMOJI_KEY, next);
    } catch (error) {
      logger.warn('iap', `Failed to save supporter emoji: ${String(error)}`);
    }
    this.publish();
  }

  addListener(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private publish(): void {
    inAppPurchaseService.setSubscriptionSupporter(this.state.active);
    const snapshot = this.getState();
    this.listeners.forEach(listener => listener(snapshot));
  }

  private async save(next: SupporterSubscriptionState): Promise<void> {
    this.state = next;
    try {
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify(next));
    } catch (error) {
      logger.warn('iap', `Failed to save supporter state: ${String(error)}`);
    }
    this.publish();
  }

  /** The supporter purchase among these, newest-looking first. */
  findSupporterPurchase(purchases: Purchase[]): Purchase | null {
    return (
      purchases.find(
        purchase =>
          purchase.productId === SUPPORTER_PRODUCT_ID &&
          !!purchase.purchaseToken &&
          (purchase as any).purchaseState !== 'pending',
      ) ?? null
    );
  }

  /**
   * Record a supporter purchase the store just delivered or still reports.
   * A pending one (cash, slow card) grants nothing until it completes.
   */
  async applyPurchase(purchase: Purchase): Promise<void> {
    await this.load();
    if (purchase.productId !== SUPPORTER_PRODUCT_ID) return;
    if ((purchase as any).purchaseState === 'pending') return;
    const tier =
      tierForBasePlan((purchase as any).currentPlanId) ??
      this.state.tier ??
      'monthly';
    await this.save({
      active: true,
      tier,
      purchaseToken: purchase.purchaseToken ?? this.state.purchaseToken,
      checkedAt: Date.now(),
    });
  }

  /**
   * Ask the store what this account holds right now.
   *
   * Play only reports subscriptions that are still active, so no supporter
   * purchase in the answer means the subscription has ended.
   */
  async refreshFromStore(): Promise<SupporterSubscriptionState> {
    await this.load();
    const lease = await iapConnectionService.acquire();
    try {
      const purchases = await RNIap.getAvailablePurchases();
      const purchase = this.findSupporterPurchase(purchases ?? []);
      if (purchase) {
        await this.applyPurchase(purchase);
      } else {
        await this.save({
          ...this.state,
          active: false,
          checkedAt: Date.now(),
        });
      }
    } finally {
      await lease.release();
    }
    return this.getState();
  }

  // --- backend ------------------------------------------------------------

  private async post<T>(path: string, body: Record<string, unknown>) {
    return this.request<T>(path, 'POST', body);
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ): Promise<T> {
    const security =
      method === 'POST'
        ? await createPlayIntegrityRequestSecurity(`supporters${path}`)
        : null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: withPlayIntegrityHeaders(
          { Accept: 'application/json', 'Content-Type': 'application/json' },
          security,
        ),
        body: body
          ? JSON.stringify(withPlayIntegrityBody(body, security))
          : undefined,
        signal: controller.signal,
      });
      const data: any = await response.json().catch(() => null);
      if (!response.ok) {
        throw new SupporterApiError(
          String(data?.message || `The server answered ${response.status}.`),
          response.status,
          typeof data?.error === 'string' ? data.error : null,
        );
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private toProfile(raw: any): SupporterProfile | null {
    if (!raw || typeof raw !== 'object') return null;
    return {
      displayName:
        typeof raw.display_name === 'string' ? raw.display_name : null,
      emoji: typeof raw.emoji === 'string' ? raw.emoji : null,
      message: typeof raw.message === 'string' ? raw.message : null,
      isPublic: raw.is_public === true,
      hidden: raw.hidden === true,
    };
  }

  private requireToken(): string {
    const token = this.state.purchaseToken;
    if (!token) throw new Error('No supporter subscription on this device.');
    return token;
  }

  /** The user's own profile, as the list shows it. */
  async fetchProfile(): Promise<{
    tier: SupporterTier | null;
    profile: SupporterProfile | null;
  }> {
    const data = await this.post<any>('/supporters/me', {
      purchase_token: this.requireToken(),
    });
    return {
      tier: data?.tier === 'big' || data?.tier === 'monthly' ? data.tier : null,
      profile: this.toProfile(data?.profile),
    };
  }

  async saveProfile(input: {
    displayName: string;
    message: string;
    isPublic: boolean;
  }): Promise<SupporterProfile | null> {
    const data = await this.post<any>('/supporters/profile', {
      purchase_token: this.requireToken(),
      display_name: input.displayName.trim() || null,
      emoji: this.emoji,
      message: input.message.trim() || null,
      is_public: input.isPublic,
    });
    return this.toProfile(data?.profile);
  }

  /** Everyone supporting the project right now, big supporters first. */
  async fetchSupporters(): Promise<SupporterListEntry[]> {
    const data = await this.request<any>('/supporters', 'GET');
    const list = Array.isArray(data?.supporters) ? data.supporters : [];
    return list
      .filter((entry: any) => entry && typeof entry === 'object')
      .map((entry: any): SupporterListEntry => ({
        name: typeof entry.name === 'string' && entry.name ? entry.name : null,
        emoji:
          typeof entry.emoji === 'string' && isSingleEmoji(entry.emoji)
            ? entry.emoji
            : null,
        tier: entry.tier === 'big' ? 'big' : 'monthly',
        message:
          typeof entry.message === 'string' && entry.message
            ? entry.message
            : null,
        since: typeof entry.since === 'string' ? entry.since : null,
      }));
  }

  /** Test hook. */
  resetForTests(): void {
    this.state = { ...EMPTY_STATE };
    this.emoji = DEFAULT_SUPPORTER_EMOJI;
    this.loaded = false;
    this.listeners.clear();
  }
}

export const supporterSubscriptionService = new SupporterSubscriptionService();
