/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type CallVideoQuality = '480p' | '720p' | '1080p' | '1440p';

export interface CallVideoPreset {
  quality: CallVideoQuality;
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
}

export interface CallMediaCapabilityProfile {
  relayEnabled: boolean;
  shouldFetchTurnCredentials: boolean;
  allowedVideoQualities: CallVideoQuality[];
  defaultVideoQuality: CallVideoQuality;
  maxBitrate: number;
  notes: string[];
}

export interface CallRtcSessionConfig {
  relayEnabled: boolean;
  shouldFetchTurnCredentials: boolean;
  iceTransportPolicy: 'all' | 'relay';
  iceServers: Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }>;
  selectedVideoPreset: CallVideoPreset;
}
