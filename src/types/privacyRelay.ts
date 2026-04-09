/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Privacy Relay subscription and TURN config types.
 */

export type PrivacyRelaySubscriptionStatus =
  | 'inactive'
  | 'active'
  | 'expired'
  | 'grace'
  | 'cancelled';

export interface PrivacyRelaySubscription {
  productId: string;
  basePlanId: string | null;
  purchaseToken: string;
  status: PrivacyRelaySubscriptionStatus;
  expiresAt: string | null;
  activatedAt: string;
  lastValidatedAt: string | null;
}

export interface PrivacyRelayTurnServer {
  host: string;
  udpPort: number;
  tlsPort: number;
  realm: string;
  usernameAuthMode: 'ephemeral-api';
  credentialEndpoint: string;
  stunUrls: string[];
  turnUrls: string[];
}

export interface PrivacyRelayAccessState {
  hasSubscription: boolean;
  requiresBackendCredentials: boolean;
  relayServer: PrivacyRelayTurnServer;
  subscription: PrivacyRelaySubscription | null;
}

export interface PrivacyRelayIceServer {
  urls: string[];
  username: string;
  credential: string;
}

export interface PrivacyRelayTurnCredentials {
  iceServers: PrivacyRelayIceServer[];
  ttl: number;
  relay: boolean;
  username: string;
  credential: string;
  deviceId: string;
  callId: string;
  fetchedAt: string;
}

export const PRIVACY_RELAY_PRODUCT_ID = 'privacy_relay';

export const PRIVACY_RELAY_BASE_PLAN_IDS = {
  monthly: 'monthly',
  yearly: 'yearly',
} as const;

export const PRIVACY_RELAY_STORAGE_KEY =
  '@AndroidIRCX:privacyRelaySubscription';

export const DEFAULT_PRIVACY_RELAY_TURN_SERVER: PrivacyRelayTurnServer = {
  host: 'turn.dbase.in.rs',
  udpPort: 3478,
  tlsPort: 5349,
  realm: 'turn.dbase.in.rs',
  usernameAuthMode: 'ephemeral-api',
  credentialEndpoint: 'https://androidircx.com/api/webrtc/turn-credentials',
  stunUrls: ['stun:turn.dbase.in.rs:3478'],
  turnUrls: [
    'turn:turn.dbase.in.rs:3478?transport=udp',
    'turn:turn.dbase.in.rs:3478?transport=tcp',
    'turns:turn.dbase.in.rs:5349?transport=tcp',
  ],
};

export function isPrivacyRelayActive(
  subscription: PrivacyRelaySubscription | null | undefined,
): boolean {
  if (!subscription) {
    return false;
  }

  return subscription.status === 'active' || subscription.status === 'grace';
}
