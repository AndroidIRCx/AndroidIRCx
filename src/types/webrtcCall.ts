/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { MediaStream } from 'react-native-webrtc';
import type { CallVideoQuality } from './callMedia';

export type CallMediaType = 'audio' | 'video';
export type CallDirection = 'incoming' | 'outgoing';
export type CallPhase =
  | 'idle'
  | 'incoming'
  | 'outgoing'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'error';

export type WebRTCCallSignalType =
  | 'invite'
  | 'accept'
  | 'reject'
  | 'offer'
  | 'answer'
  | 'candidate'
  | 'hangup';

export interface WebRTCCallSignal {
  type: WebRTCCallSignalType;
  sessionId: string;
  mediaType: CallMediaType;
  quality?: CallVideoQuality;
  reason?: string;
  sdp?: string;
  candidate?: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
  };
}

export interface WebRTCCallContext {
  sessionId: string | null;
  networkId: string | null;
  peerNick: string | null;
  mediaType: CallMediaType;
  direction: CallDirection | null;
  phase: CallPhase;
  statusText: string;
  error: string | null;
  usingRelay: boolean;
  requestedQuality: CallVideoQuality;
  activeQuality: CallVideoQuality;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micMuted: boolean;
  speakerEnabled: boolean;
  cameraEnabled: boolean;
  minimized: boolean;
  overlayX: number;
  overlayY: number;
  videoOverlayWidth: number;
}
