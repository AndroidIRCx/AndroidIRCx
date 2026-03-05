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

  it('notifies listeners immediately and supports unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = privacyRelayService.addListener(listener);

    expect(listener).toHaveBeenCalledWith(null);

    await privacyRelayService.activateSubscription({
      purchaseToken: 'listener-token',
      basePlanId: 'monthly',
    });
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ purchaseToken: 'listener-token' })
    );

    unsubscribe();
    await privacyRelayService.clearSubscription();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('registerPurchaseWithBackend prefers nested subscription fields and inactive status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        active: false,
        status: 'active',
        base_plan_id: 'monthly',
        subscription: {
          status: 'inactive',
          base_plan_id: 'yearly',
          expires_at: '2026-12-31T00:00:00.000Z',
        },
      }),
    });

    const subscription = await privacyRelayService.registerPurchaseWithBackend('nested-token', 'monthly');

    expect(subscription.status).toBe('inactive');
    expect(subscription.basePlanId).toBe('yearly');
    expect(subscription.expiresAt).toBe('2026-12-31T00:00:00.000Z');
  });

  it('fetchTurnCredentials accepts single-string urls and fills defaults', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ice_servers: [
          {
            urls: 'turn:turn.dbase.in.rs:3478?transport=udp',
            username: 'relay-user',
            credential: 'relay-pass',
          },
        ],
      }),
    });

    const credentials = await privacyRelayService.fetchTurnCredentials('relay-token', {
      deviceId: 'test-device',
      callId: 'test-call',
    });

    expect(credentials.ttl).toBe(0);
    expect(credentials.relay).toBe(true);
    expect(credentials.iceServers[0].urls).toEqual(['turn:turn.dbase.in.rs:3478?transport=udp']);
  });

  it('fetchTurnCredentials throws when backend returns no valid TURN entries', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ice_servers: [
          {
            urls: [],
            username: '',
            credential: '',
          },
        ],
      }),
    });

    await expect(
      privacyRelayService.fetchTurnCredentials('relay-token', {
        deviceId: 'test-device',
        callId: 'test-call',
      })
    ).rejects.toThrow('Privacy Relay backend did not return valid TURN credentials.');
  });
});
