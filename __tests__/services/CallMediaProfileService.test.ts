/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('../../src/services/PrivacyRelayService', () => ({
  DEFAULT_PRIVACY_RELAY_TURN_SERVER: {
    stunUrls: ['stun:turn.dbase.in.rs:3478'],
  },
  privacyRelayService: {
    getRelayAccessState: jest.fn(),
    getSubscription: jest.fn(),
    fetchTurnCredentials: jest.fn(),
  },
}));

jest.mock('../../src/services/MediaSettingsService', () => ({
  DEFAULT_FREE_CALL_STUN_SERVERS: [
    'stun:turn.dbase.in.rs:3478',
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
  ],
  mediaSettingsService: {
    getCallStunServers: jest.fn(),
    getCallTurnServerConfig: jest.fn(),
    getCallForceRelayOnly: jest.fn(),
  },
}));

import { callMediaProfileService } from '../../src/services/CallMediaProfileService';
import { privacyRelayService } from '../../src/services/PrivacyRelayService';
import { mediaSettingsService } from '../../src/services/MediaSettingsService';

const mockPrivacyRelayService = privacyRelayService as unknown as Record<string, jest.Mock>;
const mockMediaSettingsService = mediaSettingsService as unknown as Record<string, jest.Mock>;

describe('CallMediaProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrivacyRelayService.getRelayAccessState.mockReturnValue({
      hasSubscription: false,
      requiresBackendCredentials: true,
      relayServer: {
        host: 'turn.dbase.in.rs',
      },
      subscription: null,
    });
    mockPrivacyRelayService.getSubscription.mockReturnValue(null);
    mockMediaSettingsService.getCallStunServers.mockResolvedValue([
      'stun:turn.dbase.in.rs:3478',
      'stun:stun.l.google.com:19302',
    ]);
    mockMediaSettingsService.getCallTurnServerConfig.mockResolvedValue({
      enabled: false,
      urls: [],
      username: '',
      credential: '',
    });
    mockMediaSettingsService.getCallForceRelayOnly.mockResolvedValue(false);
  });

  it('limits free users to direct call profiles up to 720p', async () => {
    const profile = callMediaProfileService.getCapabilityProfile();
    const rtcConfig = await callMediaProfileService.buildRtcSessionConfig({
      quality: '1080p',
    });

    expect(profile.relayEnabled).toBe(false);
    expect(profile.allowedVideoQualities).toEqual(['480p', '720p']);
    expect(profile.defaultVideoQuality).toBe('480p');
    expect(rtcConfig.selectedVideoPreset.quality).toBe('480p');
    expect(rtcConfig.iceServers[0].urls).toEqual([
      'stun:turn.dbase.in.rs:3478',
      'stun:stun.l.google.com:19302',
    ]);
  });

  it('enables TURN-backed HD call profiles for relay subscribers', async () => {
    mockPrivacyRelayService.getRelayAccessState.mockReturnValue({
      hasSubscription: true,
      requiresBackendCredentials: true,
      relayServer: {
        host: 'turn.dbase.in.rs',
      },
      subscription: { purchaseToken: 'relay-token' },
    });
    mockPrivacyRelayService.getSubscription.mockReturnValue({
      purchaseToken: 'relay-token',
    });
    mockPrivacyRelayService.fetchTurnCredentials.mockResolvedValue({
      iceServers: [
        {
          urls: ['turn:turn.dbase.in.rs:3478?transport=udp'],
          username: 'u',
          credential: 'c',
        },
      ],
    });

    const profile = callMediaProfileService.getCapabilityProfile();
    const rtcConfig = await callMediaProfileService.buildRtcSessionConfig({
      quality: '1440p',
      callId: 'call-1',
      deviceId: 'device-1',
    });

    expect(profile.relayEnabled).toBe(true);
    expect(profile.allowedVideoQualities).toContain('1440p');
    expect(rtcConfig.selectedVideoPreset.quality).toBe('1440p');
    expect(mockPrivacyRelayService.fetchTurnCredentials).toHaveBeenCalledWith('relay-token', {
      callId: 'call-1',
      deviceId: 'device-1',
    });
  });

  it('uses custom TURN for non-subscribers when configured', async () => {
    mockMediaSettingsService.getCallTurnServerConfig.mockResolvedValue({
      enabled: true,
      urls: ['turn:turn.example.org:3478?transport=udp', 'turns:turn.example.org:5349?transport=tcp'],
      username: 'relay-user',
      credential: 'relay-pass',
    });

    const rtcConfig = await callMediaProfileService.buildRtcSessionConfig({
      quality: '720p',
    });

    expect(rtcConfig.relayEnabled).toBe(true);
    expect(rtcConfig.shouldFetchTurnCredentials).toBe(false);
    expect(rtcConfig.iceServers[0]).toEqual({
      urls: ['turn:turn.example.org:3478?transport=udp', 'turns:turn.example.org:5349?transport=tcp'],
      username: 'relay-user',
      credential: 'relay-pass',
    });
  });

  it('applies relay-only transport policy when enabled', async () => {
    mockMediaSettingsService.getCallTurnServerConfig.mockResolvedValue({
      enabled: true,
      urls: ['turn:turn.example.org:3478?transport=udp'],
      username: 'relay-user',
      credential: 'relay-pass',
    });
    mockMediaSettingsService.getCallForceRelayOnly.mockResolvedValue(true);

    const rtcConfig = await callMediaProfileService.buildRtcSessionConfig({
      quality: '720p',
    });

    expect(rtcConfig.iceTransportPolicy).toBe('relay');
  });
});
