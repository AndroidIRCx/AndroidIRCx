/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  findSubscriptionOffer,
  getSubscriptionOffers,
} from '../../src/utils/subscriptionOffers';

/** The shape react-native-iap 16 returns on Android. */
const current = {
  id: 'sub',
  type: 'subs',
  subscriptionOffers: [
    {
      id: 'a',
      basePlanIdAndroid: 'monthly',
      offerTokenAndroid: 'monthly-token',
      displayPrice: '$1.99',
      pricingPhasesAndroid: {
        pricingPhaseList: [{ formattedPrice: '$2.49' }],
      },
    },
    {
      id: 'b',
      basePlanIdAndroid: 'big',
      offerTokenAndroid: 'big-token',
      displayPrice: '$5.99',
    },
  ],
};

describe('reading subscription offers', () => {
  it('reads the shape react-native-iap 16 sends', () => {
    expect(getSubscriptionOffers(current)).toEqual([
      {
        basePlanId: 'monthly',
        offerToken: 'monthly-token',
        formattedPrice: '$2.49',
      },
      { basePlanId: 'big', offerToken: 'big-token', formattedPrice: '$5.99' },
    ]);
  });

  it.each(['subscriptionOfferDetailsAndroid', 'subscriptionOfferDetails'])(
    'still understands the older %s',
    field => {
      const offers = getSubscriptionOffers({
        [field]: [
          {
            basePlanId: 'monthly',
            offerToken: 'old-token',
            pricingPhases: { pricingPhaseList: [{ formattedPrice: '$3' }] },
          },
        ],
      });

      expect(offers).toEqual([
        {
          basePlanId: 'monthly',
          offerToken: 'old-token',
          formattedPrice: '$3',
        },
      ]);
    },
  );

  it('prefers the current list when an empty old one is also present', () => {
    expect(
      getSubscriptionOffers({
        ...current,
        subscriptionOfferDetailsAndroid: [],
      }),
    ).toHaveLength(2);
  });

  it.each([null, undefined, 'x', 3, {}, { subscriptionOffers: 'nope' }])(
    'gives an empty list for %p',
    product => {
      expect(getSubscriptionOffers(product)).toEqual([]);
    },
  );

  it('leaves out holes and reports missing fields as null', () => {
    expect(getSubscriptionOffers({ subscriptionOffers: [null, {}] })).toEqual([
      { basePlanId: null, offerToken: null, formattedPrice: null },
    ]);
  });

  it('finds one base plan, and falls back only when asked', () => {
    expect(findSubscriptionOffer(current, 'big')?.offerToken).toBe('big-token');
    expect(findSubscriptionOffer(current, 'yearly')).toBeNull();
    expect(
      findSubscriptionOffer(current, 'yearly', { fallbackToFirst: true })
        ?.offerToken,
    ).toBe('monthly-token');
    expect(
      findSubscriptionOffer(null, 'yearly', { fallbackToFirst: true }),
    ).toBeNull();
  });
});
