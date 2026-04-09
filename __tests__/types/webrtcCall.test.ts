/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type {
  CallMediaType,
  CallDirection,
  CallPhase,
  WebRTCCallSignalType,
  WebRTCCallSignal,
  WebRTCCallContext,
} from '../../src/types/webrtcCall';

describe('types/webrtcCall', () => {
  it('supports call lifecycle unions', () => {
    const mediaTypes: CallMediaType[] = ['audio', 'video'];
    const directions: CallDirection[] = ['incoming', 'outgoing'];
    const phases: CallPhase[] = [
      'idle',
      'incoming',
      'outgoing',
      'connecting',
      'connected',
      'ended',
      'error',
    ];
    const signalTypes: WebRTCCallSignalType[] = [
      'invite',
      'accept',
      'reject',
      'offer',
      'answer',
      'candidate',
      'hangup',
    ];

    expect(mediaTypes).toHaveLength(2);
    expect(directions).toContain('incoming');
    expect(phases).toContain('connected');
    expect(signalTypes).toContain('candidate');
  });

  it('supports signal and call context shapes', () => {
    const signal: WebRTCCallSignal = {
      type: 'candidate',
      sessionId: 'session-1',
      mediaType: 'video',
      quality: '1080p',
      candidate: {
        candidate: 'candidate:1',
        sdpMid: '0',
        sdpMLineIndex: 0,
      },
    };
    const context: WebRTCCallContext = {
      sessionId: 'session-1',
      networkId: 'network-1',
      peerNick: 'alice',
      mediaType: 'video',
      direction: 'outgoing',
      phase: 'connecting',
      statusText: 'Calling',
      error: null,
      usingRelay: true,
      requestedQuality: '1080p',
      activeQuality: '720p',
      localStream: null,
      remoteStream: null,
      micMuted: false,
      speakerEnabled: true,
      cameraEnabled: true,
      minimized: false,
      overlayX: 0,
      overlayY: 0,
      videoOverlayWidth: 220,
    };

    expect(signal.candidate?.candidate).toBe('candidate:1');
    expect(context.requestedQuality).toBe('1080p');
  });
});
