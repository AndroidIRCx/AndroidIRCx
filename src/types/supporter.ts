/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** The Monthly Supporter subscription, as set up in Play Console. */
export const SUPPORTER_PRODUCT_ID = 'androidircx_monthly_supporter';

export const SUPPORTER_BASE_PLAN_IDS = {
  monthly: 'androidircx-monthly-supporter',
  big: 'androidircx-big-monthly-supporter',
} as const;

export type SupporterTier = keyof typeof SUPPORTER_BASE_PLAN_IDS;

export const DEFAULT_SUPPORTER_EMOJI = '❤️';

/** What the app remembers about the user's own subscription. */
export interface SupporterSubscriptionState {
  active: boolean;
  tier: SupporterTier | null;
  purchaseToken: string | null;
  /** When the store last confirmed it, epoch ms. */
  checkedAt: number | null;
}

/** The user's entry on the public list, as the backend stores it. */
export interface SupporterProfile {
  displayName: string | null;
  emoji: string | null;
  message: string | null;
  isPublic: boolean;
  hidden: boolean;
}

/** One line of the public list. A null name is shown as "Anonymous". */
export interface SupporterListEntry {
  name: string | null;
  emoji: string | null;
  tier: SupporterTier;
  message: string | null;
  since: string | null;
}

export const tierForBasePlan = (
  basePlanId: string | null | undefined,
): SupporterTier | null => {
  if (basePlanId === SUPPORTER_BASE_PLAN_IDS.big) return 'big';
  if (basePlanId === SUPPORTER_BASE_PLAN_IDS.monthly) return 'monthly';
  return null;
};
