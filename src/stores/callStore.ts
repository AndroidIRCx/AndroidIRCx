/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { create } from 'zustand';
import type { MediaStream } from 'react-native-webrtc';
import type {
  CallDirection,
  CallMediaType,
  CallPhase,
} from '../types/webrtcCall';
import type { CallVideoQuality } from '../types/callMedia';

interface CallStoreState {
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
  setPartial: (updates: Partial<CallStoreState>) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  networkId: null,
  peerNick: null,
  mediaType: 'audio' as CallMediaType,
  direction: null,
  phase: 'idle' as CallPhase,
  statusText: '',
  error: null,
  usingRelay: false,
  requestedQuality: '720p' as CallVideoQuality,
  activeQuality: '720p' as CallVideoQuality,
  localStream: null,
  remoteStream: null,
  micMuted: false,
  speakerEnabled: true,
  cameraEnabled: true,
  minimized: false,
  overlayX: 20,
  overlayY: 120,
  videoOverlayWidth: 168,
};

export const useCallStore = create<CallStoreState>(set => ({
  ...initialState,
  setPartial: updates => set(state => ({ ...state, ...updates })),
  reset: () => set(initialState),
}));
