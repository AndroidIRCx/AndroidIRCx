/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { act } from '@testing-library/react-native';
import { useCallStore } from '../../src/stores/callStore';

describe('callStore', () => {
  beforeEach(() => {
    act(() => {
      useCallStore.getState().reset();
    });
  });

  it('has expected initial state', () => {
    const state = useCallStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.networkId).toBeNull();
    expect(state.peerNick).toBeNull();
    expect(state.mediaType).toBe('audio');
    expect(state.phase).toBe('idle');
    expect(state.statusText).toBe('');
    expect(state.error).toBeNull();
    expect(state.usingRelay).toBe(false);
    expect(state.requestedQuality).toBe('720p');
    expect(state.activeQuality).toBe('720p');
    expect(state.localStream).toBeNull();
    expect(state.remoteStream).toBeNull();
    expect(state.micMuted).toBe(false);
    expect(state.speakerEnabled).toBe(true);
    expect(state.cameraEnabled).toBe(true);
    expect(state.minimized).toBe(false);
    expect(state.overlayX).toBe(20);
    expect(state.overlayY).toBe(120);
    expect(state.videoOverlayWidth).toBe(168);
  });

  it('setPartial merges updates without dropping existing state', () => {
    act(() => {
      useCallStore.getState().setPartial({
        sessionId: 's1',
        networkId: 'net1',
        peerNick: 'alice',
        mediaType: 'video',
        phase: 'connected',
        statusText: 'In call',
        micMuted: true,
        minimized: true,
        overlayX: 40,
      });
    });

    const state = useCallStore.getState();
    expect(state.sessionId).toBe('s1');
    expect(state.networkId).toBe('net1');
    expect(state.peerNick).toBe('alice');
    expect(state.mediaType).toBe('video');
    expect(state.phase).toBe('connected');
    expect(state.statusText).toBe('In call');
    expect(state.micMuted).toBe(true);
    expect(state.minimized).toBe(true);
    expect(state.overlayX).toBe(40);
    expect(state.overlayY).toBe(120);
    expect(state.videoOverlayWidth).toBe(168);
  });

  it('reset restores defaults after mutations', () => {
    act(() => {
      useCallStore.getState().setPartial({
        sessionId: 's2',
        error: 'boom',
        usingRelay: true,
        requestedQuality: '480p',
        activeQuality: '480p',
        speakerEnabled: false,
        cameraEnabled: false,
      });
    });

    expect(useCallStore.getState().sessionId).toBe('s2');
    expect(useCallStore.getState().error).toBe('boom');
    expect(useCallStore.getState().usingRelay).toBe(true);

    act(() => {
      useCallStore.getState().reset();
    });

    const state = useCallStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.error).toBeNull();
    expect(state.usingRelay).toBe(false);
    expect(state.requestedQuality).toBe('720p');
    expect(state.activeQuality).toBe('720p');
    expect(state.speakerEnabled).toBe(true);
    expect(state.cameraEnabled).toBe(true);
  });
});
