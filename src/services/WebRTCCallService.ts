/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PermissionsAndroid, Platform } from 'react-native';
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import { connectionManager } from './ConnectionManager';
import { useCallStore } from '../stores/callStore';
import { callMediaProfileService } from './CallMediaProfileService';
import { mediaSettingsService } from './MediaSettingsService';
import { callSignalCodec, type WebRTCCallChunkBuffer } from './CallSignalCodec';
import type { CallVideoQuality } from '../types/callMedia';
import type { CallMediaType, WebRTCCallSignal } from '../types/webrtcCall';

type IrcLike = {
  getCurrentNick?: () => string;
  sendRaw: (command: string) => void;
  on: (event: string, listener: (...args: any[]) => void) => () => void;
  onConnectionChange?: (listener: (connected: boolean) => void) => () => void;
};

class WebRTCCallService {
  private initialized = false;
  private connectionUnsubscribes = new Map<string, Array<() => void>>();
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidate[] = [];
  private signalChunkBuffers = new Map<string, WebRTCCallChunkBuffer>();

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    connectionManager.getAllConnections().forEach((connection) => {
      this.attachConnection(connection.networkId, connection.ircService);
    });
    connectionManager.onConnectionCreated((networkId) => {
      const connection = connectionManager.getConnection(networkId);
      if (connection) {
        this.attachConnection(networkId, connection.ircService);
      }
    });
  }

  async startOutgoingCall(networkId: string, peerNick: string, mediaType: CallMediaType): Promise<void> {
    const quality = callMediaProfileService.clampVideoQuality(
      mediaType === 'video'
        ? ((await mediaSettingsService.getCallVideoQuality()) as CallVideoQuality)
        : '720p'
    );
    const sessionId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    await this.resetSession();
    useCallStore.getState().setPartial({
      sessionId,
      networkId,
      peerNick,
      mediaType,
      direction: 'outgoing',
      phase: 'outgoing',
      statusText: mediaType === 'video' ? 'Calling with video...' : 'Calling with audio...',
      error: null,
      requestedQuality: quality,
      activeQuality: quality,
      usingRelay: false,
      micMuted: false,
      cameraEnabled: true,
    });

    await this.sendSignal(networkId, peerNick, {
      type: 'invite',
      sessionId,
      mediaType,
      quality,
    });
  }

  async acceptIncomingCall(): Promise<void> {
    const state = useCallStore.getState();
    if (!state.sessionId || !state.peerNick || !state.networkId) {
      return;
    }

    useCallStore.getState().setPartial({
      phase: 'connecting',
      statusText: 'Accepting call...',
      error: null,
    });

    await this.sendSignal(state.networkId, state.peerNick, {
      type: 'accept',
      sessionId: state.sessionId,
      mediaType: state.mediaType,
      quality: state.requestedQuality,
    });
  }

  async declineIncomingCall(): Promise<void> {
    const state = useCallStore.getState();
    if (state.networkId && state.peerNick && state.sessionId) {
      await this.sendSignal(state.networkId, state.peerNick, {
        type: 'reject',
        sessionId: state.sessionId,
        mediaType: state.mediaType,
        reason: 'Declined',
      });
    }
    await this.resetSession();
  }

  async hangUp(): Promise<void> {
    const state = useCallStore.getState();
    if (state.networkId && state.peerNick && state.sessionId) {
      await this.sendSignal(state.networkId, state.peerNick, {
        type: 'hangup',
        sessionId: state.sessionId,
        mediaType: state.mediaType,
      }).catch(() => undefined);
    }
    await this.endCall('Call ended.');
  }

  async toggleMute(): Promise<void> {
    const nextMuted = !useCallStore.getState().micMuted;
    this.localStream?.getAudioTracks().forEach(track => {
      track.enabled = !nextMuted;
    });
    useCallStore.getState().setPartial({ micMuted: nextMuted });
  }

  async toggleCamera(): Promise<void> {
    const nextEnabled = !useCallStore.getState().cameraEnabled;
    this.localStream?.getVideoTracks().forEach(track => {
      track.enabled = nextEnabled;
    });
    useCallStore.getState().setPartial({ cameraEnabled: nextEnabled });
  }

  private attachConnection(networkId: string, ircService: IrcLike): void {
    if (this.connectionUnsubscribes.has(networkId)) {
      return;
    }

    const unsubscribes: Array<() => void> = [];
    unsubscribes.push(
      ircService.on('webrtc-signal', (payload: WebRTCCallSignal, meta: { fromNick: string; network: string }) => {
        this.handleSignal(meta.network || networkId, meta.fromNick, payload).catch((error) => {
          console.error('[WebRTCCall] Failed to handle signal:', error);
          this.failCall(error instanceof Error ? error.message : 'Failed to handle call signal.');
        });
      })
    );
    unsubscribes.push(
      ircService.on('webrtc-signal-chunk', (chunk: any, meta: { fromNick: string; network: string }) => {
        this.handleSignalChunk(meta.network || networkId, meta.fromNick, chunk);
      })
    );

    if (ircService.onConnectionChange) {
      unsubscribes.push(
        ircService.onConnectionChange((connected) => {
          const state = useCallStore.getState();
          if (!connected && state.networkId === networkId && state.phase !== 'idle') {
            this.failCall('IRC connection dropped during call setup.');
          }
        })
      );
    }

    this.connectionUnsubscribes.set(networkId, unsubscribes);
  }

  private handleSignalChunk(networkId: string, fromNick: string, chunk: any): void {
    const key = `${networkId}:${fromNick}:${chunk.id}`;
    const buffer = callSignalCodec.appendChunk(this.signalChunkBuffers.get(key), chunk);
    this.signalChunkBuffers.set(key, buffer);
    const assembled = callSignalCodec.tryAssemble(buffer);
    if (!assembled) {
      return;
    }
    this.signalChunkBuffers.delete(key);
    this.handleSignal(networkId, fromNick, assembled).catch((error) => {
      console.error('[WebRTCCall] Failed to handle chunked signal:', error);
      this.failCall(error instanceof Error ? error.message : 'Failed to handle call signal.');
    });
  }

  private async handleSignal(networkId: string, fromNick: string, payload: WebRTCCallSignal): Promise<void> {
    const state = useCallStore.getState();

    switch (payload.type) {
      case 'invite':
        if (state.phase !== 'idle' && state.sessionId !== payload.sessionId) {
          await this.sendSignal(networkId, fromNick, {
            type: 'reject',
            sessionId: payload.sessionId,
            mediaType: payload.mediaType,
            reason: 'Busy',
          });
          return;
        }

        await this.resetSession();
        useCallStore.getState().setPartial({
          sessionId: payload.sessionId,
          networkId,
          peerNick: fromNick,
          mediaType: payload.mediaType,
          direction: 'incoming',
          phase: 'incoming',
          statusText: payload.mediaType === 'video' ? 'Incoming video call...' : 'Incoming audio call...',
          requestedQuality: callMediaProfileService.clampVideoQuality(payload.quality),
          activeQuality: callMediaProfileService.clampVideoQuality(payload.quality),
          error: null,
        });
        return;
      case 'accept':
        if (state.sessionId !== payload.sessionId || state.direction !== 'outgoing') {
          return;
        }
        useCallStore.getState().setPartial({
          phase: 'connecting',
          statusText: 'Peer accepted. Starting secure media...',
        });
        await this.createPeerConnection(networkId, payload.mediaType, state.requestedQuality);
        await this.createAndSendOffer(networkId, fromNick, payload);
        return;
      case 'reject':
        if (state.sessionId !== payload.sessionId) {
          return;
        }
        await this.endCall(payload.reason || 'Call was rejected.');
        return;
      case 'offer':
        if (state.sessionId !== payload.sessionId || !payload.sdp) {
          return;
        }
        await this.createPeerConnection(networkId, payload.mediaType, state.requestedQuality);
        await this.peerConnection?.setRemoteDescription(
          new RTCSessionDescription({ type: 'offer', sdp: payload.sdp })
        );
        await this.flushPendingCandidates();
        const answer = await this.peerConnection?.createAnswer();
        if (!answer?.sdp) {
          throw new Error('Failed to create WebRTC answer.');
        }
        await this.peerConnection?.setLocalDescription(answer);
        await this.sendSignal(networkId, fromNick, {
          type: 'answer',
          sessionId: payload.sessionId,
          mediaType: payload.mediaType,
          sdp: answer.sdp,
          quality: state.requestedQuality,
        });
        useCallStore.getState().setPartial({
          phase: 'connecting',
          statusText: 'Sending answer...',
        });
        return;
      case 'answer':
        if (state.sessionId !== payload.sessionId || !payload.sdp) {
          return;
        }
        await this.peerConnection?.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: payload.sdp })
        );
        await this.flushPendingCandidates();
        useCallStore.getState().setPartial({
          phase: 'connecting',
          statusText: 'Negotiation finished. Waiting for media...',
        });
        return;
      case 'candidate':
        if (state.sessionId !== payload.sessionId || !payload.candidate) {
          return;
        }
        const candidate = new RTCIceCandidate(payload.candidate);
        if (!this.peerConnection?.remoteDescription) {
          this.pendingCandidates.push(candidate);
          return;
        }
        await this.peerConnection?.addIceCandidate(candidate);
        return;
      case 'hangup':
        if (state.sessionId !== payload.sessionId) {
          return;
        }
        await this.endCall('Peer ended the call.');
        return;
      default:
        return;
    }
  }

  private async createAndSendOffer(networkId: string, peerNick: string, payload: WebRTCCallSignal): Promise<void> {
    const offer = await this.peerConnection?.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: payload.mediaType === 'video',
    });
    if (!offer?.sdp) {
      throw new Error('Failed to create WebRTC offer.');
    }
    await this.peerConnection?.setLocalDescription(offer);
    await this.sendSignal(networkId, peerNick, {
      type: 'offer',
      sessionId: payload.sessionId,
      mediaType: payload.mediaType,
      sdp: offer.sdp,
      quality: useCallStore.getState().requestedQuality,
    });
  }

  private async createPeerConnection(
    networkId: string,
    mediaType: CallMediaType,
    requestedQuality: CallVideoQuality
  ): Promise<void> {
    if (this.peerConnection) {
      return;
    }

    const state = useCallStore.getState();
    const connection = connectionManager.getConnection(networkId);
    const currentNick = connection?.ircService.getCurrentNick?.() || 'device';
    const rtcConfig = await callMediaProfileService.buildRtcSessionConfig({
      quality: requestedQuality,
      callId: state.sessionId || `call-${Date.now()}`,
      deviceId: `${networkId}-${currentNick}`,
    });

    await this.ensureMediaPermissions(mediaType);
    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: mediaType === 'video'
        ? {
            width: rtcConfig.selectedVideoPreset.width,
            height: rtcConfig.selectedVideoPreset.height,
            frameRate: rtcConfig.selectedVideoPreset.frameRate,
            facingMode: 'user',
          }
        : false,
    });

    this.remoteStream = new MediaStream();
    this.peerConnection = new RTCPeerConnection({
      iceServers: rtcConfig.iceServers,
      iceTransportPolicy: rtcConfig.iceTransportPolicy,
    });
    const peerConnectionAny = this.peerConnection as any;

    this.localStream.getTracks().forEach(track => {
      this.peerConnection?.addTrack(track, this.localStream as MediaStream);
    });

    peerConnectionAny.onicecandidate = (event: any) => {
      if (!event.candidate) {
        return;
      }
      const snapshot = useCallStore.getState();
      if (!snapshot.networkId || !snapshot.peerNick || !snapshot.sessionId) {
        return;
      }
      this.sendSignal(snapshot.networkId, snapshot.peerNick, {
        type: 'candidate',
        sessionId: snapshot.sessionId,
        mediaType: snapshot.mediaType,
        candidate: {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        },
      }).catch((error) => {
        console.error('[WebRTCCall] Failed to send ICE candidate:', error);
      });
    };

    peerConnectionAny.ontrack = (event: any) => {
      event.streams.forEach((stream: MediaStream) => {
        stream.getTracks().forEach((track: any) => {
          if (!this.remoteStream?.getTracks().some(existing => existing.id === track.id)) {
            this.remoteStream?.addTrack(track);
          }
        });
      });
      useCallStore.getState().setPartial({
        remoteStream: this.remoteStream,
      });
    };

    peerConnectionAny.onconnectionstatechange = () => {
      const connectionState = this.peerConnection?.connectionState;
      if (connectionState === 'connected') {
        useCallStore.getState().setPartial({
          phase: 'connected',
          statusText: rtcConfig.relayEnabled ? 'Connected via secure relay.' : 'Connected directly.',
          usingRelay: rtcConfig.relayEnabled,
        });
      } else if (connectionState === 'failed') {
        this.failCall('WebRTC connection failed.');
      }
    };

    peerConnectionAny.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        useCallStore.getState().setPartial({
          phase: 'connected',
          statusText: rtcConfig.relayEnabled ? 'Media connected with relay support.' : 'Media connected directly.',
        });
      } else if (iceState === 'failed') {
        this.failCall(
          rtcConfig.relayEnabled
            ? 'ICE negotiation failed even with relay.'
            : 'ICE negotiation failed. TURN relay is available only for Privacy Relay subscribers.'
        );
      }
    };

    useCallStore.getState().setPartial({
      localStream: this.localStream,
      remoteStream: this.remoteStream,
      usingRelay: rtcConfig.relayEnabled,
      activeQuality: rtcConfig.selectedVideoPreset.quality,
      statusText: rtcConfig.relayEnabled ? 'Preparing secure relay call...' : 'Preparing direct call...',
    });
  }

  private async flushPendingCandidates(): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      return;
    }
    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const candidate of candidates) {
      await this.peerConnection.addIceCandidate(candidate);
    }
  }

  private async sendSignal(networkId: string, peerNick: string, signal: WebRTCCallSignal): Promise<void> {
    const connection = connectionManager.getConnection(networkId);
    const ircService = connection?.ircService;
    if (!ircService) {
      throw new Error(`No IRC connection found for ${networkId}.`);
    }

    const encoded = callSignalCodec.encode(signal);
    if (encoded.length <= 380) {
      ircService.sendRaw(`PRIVMSG ${peerNick} :${encoded}`);
      return;
    }

    const transferId = `${signal.sessionId}-${signal.type}-${Date.now()}`;
    const chunks = callSignalCodec.encodeChunked(signal, transferId);
    for (const chunk of chunks) {
      ircService.sendRaw(`PRIVMSG ${peerNick} :${chunk}`);
    }
  }

  private async ensureMediaPermissions(mediaType: CallMediaType): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    const required = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    if (mediaType === 'video') {
      required.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    }

    const results = await PermissionsAndroid.requestMultiple(required);
    const denied = required.find(permission => results[permission] !== PermissionsAndroid.RESULTS.GRANTED);
    if (denied) {
      throw new Error('Camera or microphone permission was denied.');
    }
  }

  private async failCall(message: string): Promise<void> {
    useCallStore.getState().setPartial({
      phase: 'error',
      error: message,
      statusText: message,
    });
    await this.disposePeerResources();
  }

  private async endCall(message: string): Promise<void> {
    useCallStore.getState().setPartial({
      phase: 'ended',
      statusText: message,
      error: null,
    });
    await this.disposePeerResources();
    setTimeout(() => {
      if (useCallStore.getState().phase === 'ended') {
        useCallStore.getState().reset();
      }
    }, 1200);
  }

  private async resetSession(): Promise<void> {
    await this.disposePeerResources();
    this.pendingCandidates = [];
    useCallStore.getState().reset();
  }

  private async disposePeerResources(): Promise<void> {
    this.peerConnection?.close();
    this.peerConnection = null;
    this.localStream?.getTracks().forEach(track => track.stop());
    this.remoteStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.pendingCandidates = [];
  }
}

export const webRtcCallService = new WebRTCCallService();
