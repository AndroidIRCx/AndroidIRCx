/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  CallVideoQuality,
  CallVideoPreset,
  CallMediaCapabilityProfile,
  CallRtcSessionConfig,
} from '../../src/types/callMedia';

describe('types/callMedia', () => {
  it('supports the expected video quality union', () => {
    const qualities: CallVideoQuality[] = ['480p', '720p', '1080p', '1440p'];
    expect(qualities).toEqual(['480p', '720p', '1080p', '1440p']);
  });

  it('supports call media preset and session config shapes', () => {
    const preset: CallVideoPreset = {
      quality: '720p',
      width: 1280,
      height: 720,
      frameRate: 30,
      maxBitrate: 2500000,
    };
    const profile: CallMediaCapabilityProfile = {
      relayEnabled: true,
      shouldFetchTurnCredentials: true,
      allowedVideoQualities: ['480p', '720p'],
      defaultVideoQuality: '720p',
      maxBitrate: 2500000,
      notes: ['balanced'],
    };
    const config: CallRtcSessionConfig = {
      relayEnabled: true,
      shouldFetchTurnCredentials: true,
      iceTransportPolicy: 'relay',
      iceServers: [
        { urls: ['turn:example.org'], username: 'u', credential: 'p' },
      ],
      selectedVideoPreset: preset,
    };

    expect(profile.allowedVideoQualities).toContain('720p');
    expect(config.selectedVideoPreset).toBe(preset);
  });
});
