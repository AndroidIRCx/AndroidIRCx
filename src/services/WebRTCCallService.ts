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
import { settingsService } from './SettingsService';
import { callSignalCodec, type WebRTCCallChunkBuffer } from './CallSignalCodec';
import { CALL_NOTIFICATION_ACTIONS, notificationService } from './NotificationService';
import { useTabStore } from '../stores/tabStore';
import { queryTabId } from '../utils/tabUtils';
import type { CallVideoQuality } from '../types/callMedia';
import type { CallMediaType, WebRTCCallSignal } from '../types/webrtcCall';

type IrcLike = {
  getCurrentNick?: () => string;
  sendRaw: (command: string) => void;
  on: (event: string, listener: (...args: any[]) => void) => () => void;
  onConnectionChange?: (listener: (connected: boolean) => void) => () => void;
};

class WebRTCCallService {
  private static readonly SIGNAL_CHUNK_DELAY_MS = 350;
  private static readonly ICE_GATHER_TIMEOUT_MS = 4000;
  private static readonly OVERLAY_PREFS_KEY = '@AndroidIRCX:callOverlayPrefs';
  private initialized = false;
  private connectionUnsubscribes = new Map<string, Array<() => void>>();
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidate[] = [];
  private signalChunkBuffers = new Map<string, WebRTCCallChunkBuffer>();

  private static generateSecureIdSuffix(length: number): string {
    const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';

    try {
      const cryptoObj = (globalThis as any).crypto;
      if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
        const bytes = new Uint8Array(length);
        cryptoObj.getRandomValues(bytes);
        let result = '';
        for (let i = 0; i < bytes.length; i += 1) {
          // Map each byte to a base36 character.
          result += alphabet[bytes[i] % alphabet.length];
        }
        return result;
      }
    } catch {
      // Fall through to Math.random-based implementation below.
    }

    // Fallback: preserve previous behavior if crypto is not available.
    return Math.random().toString(36).slice(2, 2 + length);
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.loadOverlayPreferences().catch(() => undefined);
    notificationService.setCallNotificationActionListener(async (action) => {
      if (action === CALL_NOTIFICATION_ACTIONS.HANGUP) {
        await this.hangUp();
        return;
      }
      if (action === CALL_NOTIFICATION_ACTIONS.RETURN || action === CALL_NOTIFICATION_ACTIONS.DEFAULT) {
        this.focusCallQueryTab();
        this.restoreCall();
      }
    });
    notificationService.consumePendingCallNotificationAction().then((action) => {
      if (action) {
        notificationService.handleCallNotificationAction(action).catch(() => undefined);
      }
    }).catch(() => undefined);
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
    //const sessionId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const sessionId = `call-${Date.now()}-${WebRTCCallService.generateSecureIdSuffix(8)}`;
    const overlayPrefs = this.getOverlayPrefsSnapshot();

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
      minimized: false,
      overlayX: overlayPrefs.overlayX,
      overlayY: overlayPrefs.overlayY,
      videoOverlayWidth: overlayPrefs.videoOverlayWidth,
    });

    this.log(networkId, 'Starting outgoing call', {
      peerNick,
      mediaType,
      quality,
      sessionId,
      relayEligible: callMediaProfileService.getCapabilityProfile().relayEnabled,
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
      minimized: false,
    });
    this.log(state.networkId, 'Accepting incoming call', {
      peerNick: state.peerNick,
      mediaType: state.mediaType,
      requestedQuality: state.requestedQuality,
      sessionId: state.sessionId,
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
      this.log(state.networkId, 'Declining incoming call', {
        peerNick: state.peerNick,
        sessionId: state.sessionId,
      });
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
      this.log(state.networkId, 'Sending hangup', {
        peerNick: state.peerNick,
        sessionId: state.sessionId,
      });
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

  minimizeCall(): void {
    if (useCallStore.getState().phase === 'idle') {
      return;
    }
    useCallStore.getState().setPartial({ minimized: true });
  }

  restoreCall(): void {
    if (useCallStore.getState().phase === 'idle') {
      return;
    }
    useCallStore.getState().setPartial({ minimized: false });
  }

  updateOverlayPosition(x: number, y: number): void {
    useCallStore.getState().setPartial({
      overlayX: Math.max(8, Math.round(x)),
      overlayY: Math.max(8, Math.round(y)),
    });
    this.persistOverlayPreferences();
  }

  snapOverlayToEdge(viewportWidth: number, overlayWidth: number, y: number): void {
    const left = 12;
    const right = Math.max(left, viewportWidth - overlayWidth - 12);
    const currentX = useCallStore.getState().overlayX;
    const snappedX = currentX + (overlayWidth / 2) < viewportWidth / 2 ? left : right;
    useCallStore.getState().setPartial({
      overlayX: snappedX,
      overlayY: Math.max(8, Math.round(y)),
    });
    this.persistOverlayPreferences();
  }

  updateVideoOverlayWidth(width: number): void {
    useCallStore.getState().setPartial({
      videoOverlayWidth: Math.max(132, Math.min(260, Math.round(width))),
    });
    this.persistOverlayPreferences();
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
    this.log(networkId, 'Received signaling chunk', {
      fromNick,
      transferId: chunk?.id,
      index: chunk?.index,
      total: chunk?.total,
      sessionId: chunk?.sessionId,
    });
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
    this.log(networkId, 'Received signaling message', {
      fromNick,
      type: payload.type,
      sessionId: payload.sessionId,
      mediaType: payload.mediaType,
      hasSdp: Boolean(payload.sdp),
      hasCandidate: Boolean(payload.candidate),
    });

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
        const overlayPrefs = this.getOverlayPrefsSnapshot();
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
          minimized: false,
          overlayX: overlayPrefs.overlayX,
          overlayY: overlayPrefs.overlayY,
          videoOverlayWidth: overlayPrefs.videoOverlayWidth,
        });
        this.log(networkId, 'Incoming call invitation stored', {
          fromNick,
          sessionId: payload.sessionId,
          mediaType: payload.mediaType,
          quality: payload.quality,
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
        this.log(networkId, 'Peer accepted call', {
          fromNick,
          sessionId: payload.sessionId,
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
        this.log(networkId, 'Remote offer applied', {
          fromNick,
          sessionId: payload.sessionId,
          sdpLength: payload.sdp.length,
          candidateCount: this.countSdpCandidates(payload.sdp),
        });
        await this.flushPendingCandidates();
        const answer = await this.peerConnection?.createAnswer();
        if (!answer?.sdp) {
          throw new Error('Failed to create WebRTC answer.');
        }
        await this.peerConnection?.setLocalDescription(answer);
        await this.waitForIceGatheringComplete(networkId, 'answer');
        const answerSdp = this.peerConnection?.localDescription?.sdp || answer.sdp;
        await this.sendSignal(networkId, fromNick, {
          type: 'answer',
          sessionId: payload.sessionId,
          mediaType: payload.mediaType,
          sdp: answerSdp,
          quality: state.requestedQuality,
        });
        useCallStore.getState().setPartial({
          phase: 'connecting',
          statusText: 'Sending answer...',
        });
        this.log(networkId, 'Local answer created', {
          sessionId: payload.sessionId,
          sdpLength: answerSdp.length,
          candidateCount: this.countSdpCandidates(answerSdp),
        });
        return;
      case 'answer':
        if (state.sessionId !== payload.sessionId || !payload.sdp) {
          return;
        }
        await this.peerConnection?.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: payload.sdp })
        );
        this.log(networkId, 'Remote answer applied', {
          fromNick,
          sessionId: payload.sessionId,
          sdpLength: payload.sdp.length,
          candidateCount: this.countSdpCandidates(payload.sdp),
        });
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
          this.log(networkId, 'Queueing remote ICE candidate until remote description is ready', {
            sessionId: payload.sessionId,
          });
          this.pendingCandidates.push(candidate);
          return;
        }
        this.log(networkId, 'Applying remote ICE candidate', {
          sessionId: payload.sessionId,
        });
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
    await this.waitForIceGatheringComplete(networkId, 'offer');
    const offerSdp = this.peerConnection?.localDescription?.sdp || offer.sdp;
    await this.sendSignal(networkId, peerNick, {
      type: 'offer',
      sessionId: payload.sessionId,
      mediaType: payload.mediaType,
      sdp: offerSdp,
      quality: useCallStore.getState().requestedQuality,
    });
    this.log(networkId, 'Local offer created', {
      peerNick,
      sessionId: payload.sessionId,
      sdpLength: offerSdp.length,
      candidateCount: this.countSdpCandidates(offerSdp),
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
    this.log(networkId, 'Creating peer connection', {
      mediaType,
      requestedQuality,
      selectedQuality: rtcConfig.selectedVideoPreset.quality,
      relayEnabled: rtcConfig.relayEnabled,
      iceServerCount: rtcConfig.iceServers.length,
      iceTransportPolicy: rtcConfig.iceTransportPolicy,
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
    this.log(networkId, 'Local media acquired', {
      audioTracks: this.localStream.getAudioTracks().length,
      videoTracks: this.localStream.getVideoTracks().length,
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
        this.log(networkId, 'ICE candidate gathering event completed');
        return;
      }
      this.log(networkId, 'Local ICE candidate gathered', {
        candidateType: this.extractCandidateType(event.candidate?.candidate),
        sdpMid: event.candidate?.sdpMid,
        sdpMLineIndex: event.candidate?.sdpMLineIndex,
      });
    };

    peerConnectionAny.ontrack = (event: any) => {
      this.log(networkId, 'Remote track received', {
        streamCount: event.streams?.length || 0,
      });
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
      this.log(networkId, 'Peer connection state changed', { connectionState });
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
      this.log(networkId, 'ICE connection state changed', { iceState });
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

    peerConnectionAny.onicegatheringstatechange = () => {
      this.log(networkId, 'ICE gathering state changed', {
        iceGatheringState: this.peerConnection?.iceGatheringState,
      });
    };

    peerConnectionAny.onsignalingstatechange = () => {
      this.log(networkId, 'Signaling state changed', {
        signalingState: this.peerConnection?.signalingState,
      });
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
    if (!connection?.ircService) {
      throw new Error(`No IRC connection found for ${networkId}.`);
    }

    const encoded = callSignalCodec.encode(signal);
    if (encoded.length <= 380) {
      this.log(networkId, 'Sending signaling message', {
        peerNick,
        type: signal.type,
        sessionId: signal.sessionId,
        mode: 'single',
        bytes: encoded.length,
      });
      await this.sendIrcPrivmsg(networkId, peerNick, encoded);
      return;
    }

    const transferId = `${signal.sessionId}-${signal.type}-${Date.now()}`;
    const chunks = callSignalCodec.encodeChunked(signal, transferId);
    this.log(networkId, 'Sending chunked signaling message', {
      peerNick,
      type: signal.type,
      sessionId: signal.sessionId,
      chunks: chunks.length,
      bytes: encoded.length,
      transferId,
    });
    for (const chunk of chunks) {
      await this.sendIrcPrivmsg(networkId, peerNick, chunk);
      await this.delay(WebRTCCallService.SIGNAL_CHUNK_DELAY_MS);
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
    const networkId = useCallStore.getState().networkId;
    this.log(networkId, 'Call failed', { message });
    useCallStore.getState().setPartial({
      phase: 'error',
      error: message,
      statusText: message,
    });
    await this.disposePeerResources();
  }

  private async endCall(message: string): Promise<void> {
    const networkId = useCallStore.getState().networkId;
    this.log(networkId, 'Ending call', { message });
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
    const networkId = useCallStore.getState().networkId;
    const overlayPrefs = this.getOverlayPrefsSnapshot();
    this.log(networkId, 'Resetting call session');
    await this.disposePeerResources();
    this.pendingCandidates = [];
    useCallStore.getState().reset();
    useCallStore.getState().setPartial(overlayPrefs);
  }

  private async disposePeerResources(): Promise<void> {
    const networkId = useCallStore.getState().networkId;
    this.log(networkId, 'Disposing peer resources', {
      hadPeerConnection: Boolean(this.peerConnection),
      localTracks: this.localStream?.getTracks().length || 0,
      remoteTracks: this.remoteStream?.getTracks().length || 0,
    });
    this.peerConnection?.close();
    this.peerConnection = null;
    this.localStream?.getTracks().forEach(track => track.stop());
    this.remoteStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.pendingCandidates = [];
  }

  private async sendIrcPrivmsg(networkId: string, peerNick: string, payload: string): Promise<void> {
    const connection = connectionManager.getConnection(networkId);
    if (!connection?.ircService) {
      throw new Error(`No IRC connection found for ${networkId}.`);
    }

    const command = `PRIVMSG ${peerNick} :${payload}`;
    if (connection.connectionQualityService) {
      await connection.connectionQualityService.sendMessage(command);
      return;
    }

    connection.ircService.sendRaw(command);
  }

  private async waitForIceGatheringComplete(networkId: string, phase: 'offer' | 'answer'): Promise<void> {
    if (!this.peerConnection) {
      return;
    }

    if (this.peerConnection.iceGatheringState === 'complete') {
      this.log(networkId, `ICE gathering already complete for ${phase}`);
      return;
    }

    this.log(networkId, `Waiting for ICE gathering before sending ${phase}`, {
      timeoutMs: WebRTCCallService.ICE_GATHER_TIMEOUT_MS,
    });

    await new Promise<void>((resolve) => {
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const peerConnectionAny = this.peerConnection as any;
      const previousHandler = peerConnectionAny.onicegatheringstatechange;

      const finish = (reason: string) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        peerConnectionAny.onicegatheringstatechange = previousHandler;
        this.log(networkId, `ICE gathering wait finished for ${phase}`, {
          reason,
          iceGatheringState: this.peerConnection?.iceGatheringState,
          candidateCount: this.countSdpCandidates(this.peerConnection?.localDescription?.sdp),
        });
        resolve();
      };

      peerConnectionAny.onicegatheringstatechange = () => {
        previousHandler?.();
        if (this.peerConnection?.iceGatheringState === 'complete') {
          finish('complete');
        }
      };

      timeoutId = setTimeout(() => finish('timeout'), WebRTCCallService.ICE_GATHER_TIMEOUT_MS);
    });
  }

  private countSdpCandidates(sdp?: string | null): number {
    if (!sdp) {
      return 0;
    }
    return sdp.split(/\r?\n/).filter(line => line.startsWith('a=candidate:')).length;
  }

  private extractCandidateType(candidate?: string | null): string | null {
    if (!candidate) {
      return null;
    }
    const match = candidate.match(/\styp\s([a-z]+)/i);
    return match?.[1] || null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getOverlayPrefsSnapshot(): {
    overlayX: number;
    overlayY: number;
    videoOverlayWidth: number;
  } {
    const state = useCallStore.getState();
    return {
      overlayX: state.overlayX,
      overlayY: state.overlayY,
      videoOverlayWidth: state.videoOverlayWidth,
    };
  }

  private async loadOverlayPreferences(): Promise<void> {
    const stored = await settingsService.getSetting<{
      overlayX?: number;
      overlayY?: number;
      videoOverlayWidth?: number;
    } | null>(WebRTCCallService.OVERLAY_PREFS_KEY, null);

    if (!stored) {
      return;
    }

    useCallStore.getState().setPartial({
      overlayX: typeof stored.overlayX === 'number' ? stored.overlayX : 20,
      overlayY: typeof stored.overlayY === 'number' ? stored.overlayY : 120,
      videoOverlayWidth: typeof stored.videoOverlayWidth === 'number' ? stored.videoOverlayWidth : 168,
    });
  }

  private persistOverlayPreferences(): void {
    const prefs = this.getOverlayPrefsSnapshot();
    settingsService.setSetting(WebRTCCallService.OVERLAY_PREFS_KEY, prefs).catch(() => undefined);
  }

  private focusCallQueryTab(): void {
    const { networkId, peerNick } = useCallStore.getState();
    if (!networkId || !peerNick) {
      return;
    }

    const tabStore = useTabStore.getState();
    const tabId = queryTabId(networkId, peerNick);
    const existing = tabStore.tabs.find(tab => tab.id === tabId);

    if (!existing) {
      tabStore.addTab({
        id: tabId,
        name: peerNick,
        type: 'query',
        networkId,
        messages: [],
      });
    }

    tabStore.setActiveTabId(tabId);
  }

  private log(networkId: string | null | undefined, message: string, details?: Record<string, unknown>): void {
    const prefix = '[WebRTCCall]';
    if (details) {
      console.log(prefix, message, details);
    } else {
      console.log(prefix, message);
    }

    if (!networkId) {
      return;
    }

    try {
      const connection = connectionManager.getConnection(networkId);
      connection?.ircService?.addRawMessage(
        details
          ? `${prefix} ${message} ${JSON.stringify(details)}`
          : `${prefix} ${message}`,
        'debug'
      );
    } catch {
      // Ignore debug logging failures.
    }
  }
}

export const webRtcCallService = new WebRTCCallService();
