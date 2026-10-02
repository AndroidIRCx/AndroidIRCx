/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Reading Google Play subscription offers, whatever shape they arrive in.
 *
 * react-native-iap has renamed this list twice: `subscriptionOfferDetails`
 * became `subscriptionOfferDetailsAndroid`, and version 16 replaced both with
 * the cross-platform `subscriptionOffers`, whose Android fields carry an
 * `Android` suffix (`basePlanIdAndroid`, `offerTokenAndroid`,
 * `pricingPhasesAndroid`). Every screen that read only an old name found no
 * offers and kept its Subscribe button disabled, so a tap did nothing.
 *
 * One reader, so the next rename is fixed in one place.
 */

export interface SubscriptionOfferInfo {
  /** The base plan this offer belongs to, e.g. `monthly`. */
  basePlanId: string | null;
  /** What `requestPurchase` needs on Android. */
  offerToken: string | null;
  /** First pricing phase, already formatted for the user's currency. */
  formattedPrice: string | null;
}

const firstFormattedPrice = (phases: any): string | null => {
  const price = phases?.pricingPhaseList?.[0]?.formattedPrice;
  return typeof price === 'string' && price ? price : null;
};

const toInfo = (offer: any): SubscriptionOfferInfo => ({
  basePlanId: offer?.basePlanIdAndroid || offer?.basePlanId || null,
  offerToken: offer?.offerTokenAndroid || offer?.offerToken || null,
  formattedPrice:
    firstFormattedPrice(offer?.pricingPhasesAndroid) ||
    firstFormattedPrice(offer?.pricingPhases) ||
    (typeof offer?.displayPrice === 'string' && offer.displayPrice
      ? offer.displayPrice
      : null),
});

/** Every offer on a subscription product, current shape first. */
export function getSubscriptionOffers(
  product: unknown,
): SubscriptionOfferInfo[] {
  if (!product || typeof product !== 'object') return [];
  const source = product as Record<string, unknown>;
  const candidates = [
    source.subscriptionOffers,
    source.subscriptionOfferDetailsAndroid,
    source.subscriptionOfferDetails,
  ];
  const list = candidates.find(
    (entry): entry is unknown[] => Array.isArray(entry) && entry.length > 0,
  );
  return list ? list.filter(Boolean).map(toInfo) : [];
}

/**
 * The offer for one base plan.
 *
 * Several offers can share a base plan (an intro price next to the plain
 * one); the plain base-plan offer is listed by Play, and taken, first.
 * `fallbackToFirst` takes any offer when the plan is missing, for products
 * that only ever had one.
 */
export function findSubscriptionOffer(
  product: unknown,
  basePlanId: string,
  options: { fallbackToFirst?: boolean } = {},
): SubscriptionOfferInfo | null {
  const offers = getSubscriptionOffers(product);
  return (
    offers.find(offer => offer.basePlanId === basePlanId) ||
    (options.fallbackToFirst ? (offers[0] ?? null) : null)
  );
}
