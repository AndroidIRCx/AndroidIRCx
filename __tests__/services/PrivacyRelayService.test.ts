/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { privacyRelayService } from '../../src/services/PrivacyRelayService';

describe('PrivacyRelayService', () => {
  beforeEach(async () => {
    (AsyncStorage as any).__reset();
    await privacyRelayService.clearSubscription();
    global.fetch = jest.fn();
  });

  it('activates and restores local relay access state', async () => {
    await privacyRelayService.activateSubscription({
      purchaseToken: 'relay-token',
      basePlanId: 'monthly',
    });

    expect(privacyRelayService.hasActiveSubscription()).toBe(true);
    expect(privacyRelayService.getSubscription()?.basePlanId).toBe('monthly');
    expect(privacyRelayService.getRelayAccessState().relayServer.host).toBe('turn.dbase.in.rs');
  });

  it('restores from purchase token list', async () => {
    const restored = await privacyRelayService.restoreFromPurchaseTokens([
      { purchaseToken: 'restored-token', basePlanId: 'yearly' },
    ]);

    expect(restored).toBe(1);
    expect(privacyRelayService.getSubscription()?.purchaseToken).toBe('restored-token');
    expect(privacyRelayService.getSubscription()?.basePlanId).toBe('yearly');
  });

  it('registers purchase with backend and fetches TURN credentials', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          active: true,
          base_plan_id: 'yearly',
          expires_at: '2026-03-02T19:26:34.884Z',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ice_servers: [
            {
              urls: ['turn:turn.dbase.in.rs:3478?transport=udp'],
              username: '1772481583:test-device-1',
              credential: 'relay-secret',
            },
          ],
          ttl: 3600,
          relay: true,
        }),
      });

    const subscription = await privacyRelayService.registerPurchaseWithBackend('relay-token', 'yearly');
    const credentials = await privacyRelayService.fetchTurnCredentials('relay-token', {
      deviceId: 'test-device-1',
      callId: 'test-call-1',
    });

    expect(subscription.basePlanId).toBe('yearly');
    expect(credentials.username).toBe('1772481583:test-device-1');
    expect(credentials.iceServers[0].urls).toContain('turn:turn.dbase.in.rs:3478?transport=udp');
  });
});
