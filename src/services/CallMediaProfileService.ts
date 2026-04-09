/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  DEFAULT_PRIVACY_RELAY_TURN_SERVER,
  privacyRelayService,
} from './PrivacyRelayService';
import {
  DEFAULT_FREE_CALL_STUN_SERVERS,
  type CallTurnServerSettings,
  mediaSettingsService,
} from './MediaSettingsService';
import type {
  CallMediaCapabilityProfile,
  CallRtcSessionConfig,
  CallVideoPreset,
  CallVideoQuality,
} from '../types/callMedia';

const VIDEO_PRESETS: Record<CallVideoQuality, CallVideoPreset> = {
  '480p': {
    quality: '480p',
    width: 640,
    height: 480,
    frameRate: 24,
    maxBitrate: 900_000,
  },
  '720p': {
    quality: '720p',
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 1_800_000,
  },
  '1080p': {
    quality: '1080p',
    width: 1920,
    height: 1080,
    frameRate: 30,
    maxBitrate: 3_200_000,
  },
  '1440p': {
    quality: '1440p',
    width: 2560,
    height: 1440,
    frameRate: 30,
    maxBitrate: 5_000_000,
  },
};

class CallMediaProfileService {
  private normalizeStunUrls(urls: string[]): string[] {
    return Array.from(new Set(urls.map(url => url.trim()).filter(Boolean)));
  }

  private normalizeTurnSettings(
    config: CallTurnServerSettings,
  ): CallTurnServerSettings {
    const urls = Array.from(
      new Set(
        config.urls
          .map(url => url.trim())
          .filter(url => url.startsWith('turn:') || url.startsWith('turns:')),
      ),
    );

    return {
      enabled: config.enabled,
      urls,
      username: config.username.trim(),
      credential: config.credential,
    };
  }

  private isCustomTurnUsable(config: CallTurnServerSettings): boolean {
    return (
      config.enabled &&
      config.urls.length > 0 &&
      config.username.length > 0 &&
      config.credential.length > 0
    );
  }

  getCapabilityProfile(): CallMediaCapabilityProfile {
    const relayState = privacyRelayService.getRelayAccessState();

    if (relayState.hasSubscription) {
      return {
        relayEnabled: true,
        shouldFetchTurnCredentials: true,
        allowedVideoQualities: ['480p', '720p', '1080p', '1440p'],
        defaultVideoQuality: '1080p',
        maxBitrate: VIDEO_PRESETS['1440p'].maxBitrate,
        notes: [
          'Privacy Relay subscription enables TURN fallback.',
          'HD and higher camera profiles are unlocked for video calls.',
        ],
      };
    }

    return {
      relayEnabled: false,
      shouldFetchTurnCredentials: false,
      allowedVideoQualities: ['480p', '720p'],
      defaultVideoQuality: '480p',
      maxBitrate: VIDEO_PRESETS['720p'].maxBitrate,
      notes: [
        'Free video calls use direct ICE with public STUN discovery.',
        'TURN relay and HD call profiles require Privacy Relay.',
      ],
    };
  }

  getAllowedVideoQualities(): CallVideoQuality[] {
    return this.getCapabilityProfile().allowedVideoQualities;
  }

  clampVideoQuality(
    requested: CallVideoQuality | null | undefined,
  ): CallVideoQuality {
    const profile = this.getCapabilityProfile();
    if (requested && profile.allowedVideoQualities.includes(requested)) {
      return requested;
    }
    return profile.defaultVideoQuality;
  }

  getVideoPreset(
    requested: CallVideoQuality | null | undefined,
  ): CallVideoPreset {
    return VIDEO_PRESETS[this.clampVideoQuality(requested)];
  }

  async buildRtcSessionConfig(options?: {
    purchaseToken?: string | null;
    quality?: CallVideoQuality | null;
    callId?: string;
    deviceId?: string;
  }): Promise<CallRtcSessionConfig> {
    const profile = this.getCapabilityProfile();
    const selectedVideoPreset = this.getVideoPreset(options?.quality);
    const [freeStunServers, rawCustomTurnSettings, forceRelayOnly] =
      await Promise.all([
        mediaSettingsService
          .getCallStunServers()
          .catch(() => [
            ...DEFAULT_FREE_CALL_STUN_SERVERS,
            ...DEFAULT_PRIVACY_RELAY_TURN_SERVER.stunUrls,
          ]),
        mediaSettingsService.getCallTurnServerConfig().catch(() => ({
          enabled: false,
          urls: [],
          username: '',
          credential: '',
        })),
        mediaSettingsService.getCallForceRelayOnly().catch(() => false),
      ]);
    const stunUrls = this.normalizeStunUrls([
      ...freeStunServers,
      ...DEFAULT_PRIVACY_RELAY_TURN_SERVER.stunUrls,
    ]);
    const customTurnSettings = this.normalizeTurnSettings(
      rawCustomTurnSettings,
    );

    if (this.isCustomTurnUsable(customTurnSettings)) {
      return {
        relayEnabled: true,
        shouldFetchTurnCredentials: false,
        iceTransportPolicy: forceRelayOnly ? 'relay' : 'all',
        iceServers: [
          {
            urls: customTurnSettings.urls,
            username: customTurnSettings.username,
            credential: customTurnSettings.credential,
          },
          {
            urls: stunUrls,
          },
        ],
        selectedVideoPreset,
      };
    }

    if (!profile.relayEnabled) {
      return {
        relayEnabled: false,
        shouldFetchTurnCredentials: false,
        iceTransportPolicy: 'all',
        iceServers: [
          {
            urls: stunUrls,
          },
        ],
        selectedVideoPreset,
      };
    }

    const purchaseToken =
      options?.purchaseToken ||
      privacyRelayService.getSubscription()?.purchaseToken ||
      null;

    if (!purchaseToken) {
      throw new Error(
        'Active Privacy Relay subscription is missing a purchase token.',
      );
    }

    const credentials = await privacyRelayService.fetchTurnCredentials(
      purchaseToken,
      {
        callId: options?.callId,
        deviceId: options?.deviceId,
      },
    );

    return {
      relayEnabled: true,
      shouldFetchTurnCredentials: true,
      iceTransportPolicy: forceRelayOnly ? 'relay' : 'all',
      iceServers: credentials.iceServers,
      selectedVideoPreset,
    };
  }
}

export const callMediaProfileService = new CallMediaProfileService();

export { VIDEO_PRESETS };
