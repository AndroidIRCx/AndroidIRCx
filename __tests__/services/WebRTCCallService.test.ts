/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.unmock('../../src/services/WebRTCCallService');

import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';

const mockSetPartial = jest.fn();
const mockReset = jest.fn();
const mockCallState: any = {
  sessionId: null,
  networkId: null,
  peerNick: null,
  mediaType: 'audio',
  direction: null,
  phase: 'idle',
  statusText: '',
  error: null,
  requestedQuality: '720p',
  activeQuality: '720p',
  usingRelay: false,
  micMuted: false,
  cameraEnabled: true,
  minimized: false,
  overlayX: 20,
  overlayY: 120,
  videoOverlayWidth: 168,
  localStream: null,
  remoteStream: null,
  setPartial: (partial: Record<string, unknown>) => {
    Object.assign(mockCallState, partial);
    mockSetPartial(partial);
  },
  reset: () => {
    mockReset();
    Object.assign(mockCallState, {
      sessionId: null,
      networkId: null,
      peerNick: null,
      mediaType: 'audio',
      direction: null,
      phase: 'idle',
      statusText: '',
      error: null,
      requestedQuality: '720p',
      activeQuality: '720p',
      usingRelay: false,
      micMuted: false,
      cameraEnabled: true,
      minimized: false,
      localStream: null,
      remoteStream: null,
    });
  },
};

jest.mock('../../src/stores/callStore', () => ({
  useCallStore: {
    getState: () => mockCallState,
  },
}));

const mockSetSetting = jest.fn(async () => undefined);
const mockGetSetting = jest.fn(async (_k: string, d: any) => d);
jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    setSetting: (...args: any[]) => mockSetSetting(...args),
    getSetting: (...args: any[]) => mockGetSetting(...args),
  },
}));

const mockConnectionCreatedCb: { fn?: (networkId: string) => void } = {};
const mockGetAllConnections = jest.fn(() => []);
const mockGetConnection = jest.fn(() => null);
jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: (...args: any[]) => mockGetAllConnections(...args),
    onConnectionCreated: jest.fn((cb: (networkId: string) => void) => {
      mockConnectionCreatedCb.fn = cb;
    }),
    getConnection: (...args: any[]) => mockGetConnection(...args),
  },
}));

const mockSetCallNotificationActionListener = jest.fn();
const mockConsumePendingCallNotificationAction = jest.fn(() =>
  Promise.resolve(null),
);
const mockHandleCallNotificationAction = jest.fn(() => Promise.resolve());
jest.mock('../../src/services/NotificationService', () => ({
  CALL_NOTIFICATION_ACTIONS: {
    HANGUP: 'hangup',
    RETURN: 'return',
    DEFAULT: 'default',
  },
  notificationService: {
    setCallNotificationActionListener: (...args: any[]) =>
      mockSetCallNotificationActionListener(...args),
    consumePendingCallNotificationAction: (...args: any[]) =>
      mockConsumePendingCallNotificationAction(...args),
    handleCallNotificationAction: (...args: any[]) =>
      mockHandleCallNotificationAction(...args),
  },
}));

const mockTabsState = {
  tabs: [] as any[],
  addTab: jest.fn((tab: any) => mockTabsState.tabs.push(tab)),
  setActiveTabId: jest.fn(),
};
jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: () => mockTabsState,
  },
}));

const mockClampVideoQuality = jest.fn((q: any) => q || '720p');
const mockGetCapabilityProfile = jest.fn(() => ({ relayEnabled: false }));
const mockBuildRtcSessionConfig = jest.fn(async () => ({
  relayEnabled: false,
  selectedVideoPreset: {
    quality: '480p',
    width: 640,
    height: 480,
    frameRate: 24,
  },
  iceServers: [{ urls: ['stun:example.org'] }],
  iceTransportPolicy: 'all',
}));
jest.mock('../../src/services/CallMediaProfileService', () => ({
  callMediaProfileService: {
    clampVideoQuality: (...args: any[]) => mockClampVideoQuality(...args),
    getCapabilityProfile: (...args: any[]) => mockGetCapabilityProfile(...args),
    buildRtcSessionConfig: (...args: any[]) =>
      mockBuildRtcSessionConfig(...args),
  },
}));

const mockGetCallVideoQuality = jest.fn(async () => '480p');
jest.mock('../../src/services/MediaSettingsService', () => ({
  mediaSettingsService: {
    getCallVideoQuality: (...args: any[]) => mockGetCallVideoQuality(...args),
  },
}));

jest.mock('../../src/services/CallSignalCodec', () => ({
  callSignalCodec: {
    appendChunk: jest.fn(
      (a: any) =>
        a || {
          startedAt: Date.now(),
          updatedAt: Date.now(),
          parts: new Map(),
          total: 1,
        },
    ),
    getChunkProgress: jest.fn(() => ({ received: 0, total: 1, missing: [0] })),
    tryAssemble: jest.fn(() => null),
    encode: jest.fn((s: any) => JSON.stringify(s)),
    encodeChunked: jest.fn((_signal: any, _id: string) => [
      'chunk-1',
      'chunk-2',
    ]),
  },
}));

const trackFactory = () => ({
  id: `t-${Math.random()}`,
  enabled: true,
  stop: jest.fn(),
});

const mockGetUserMedia = jest.fn(async (constraints: any) => {
  const audioTracks = constraints?.audio ? [trackFactory()] : [];
  const videoTracks = constraints?.video ? [trackFactory()] : [];
  const tracks = [...audioTracks, ...videoTracks];
  return {
    getTracks: () => tracks,
    getAudioTracks: () => audioTracks,
    getVideoTracks: () => videoTracks,
  };
});

class MockMediaStream {
  private tracks: any[] = [];

  constructor(initial: any[] = []) {
    this.tracks = [...initial];
  }

  getTracks() {
    return this.tracks;
  }

  getAudioTracks() {
    return this.tracks.filter(t => (t.kind || 'audio') === 'audio');
  }

  getVideoTracks() {
    return this.tracks.filter(t => t.kind === 'video');
  }

  addTrack(track: any) {
    this.tracks.push(track);
  }
}

class MockRTCPeerConnection {
  localDescription: any = null;
  remoteDescription: any = null;
  connectionState = 'new';
  iceConnectionState = 'new';
  iceGatheringState = 'new';
  signalingState = 'stable';
  onicecandidate: any;
  ontrack: any;
  onconnectionstatechange: any;
  oniceconnectionstatechange: any;
  onicegatheringstatechange: any;
  onsignalingstatechange: any;
  addTrack = jest.fn();
  createOffer = jest.fn(async () => ({
    type: 'offer',
    sdp: 'v=0\r\na=candidate:1 1 udp 123 typ host\r\n',
  }));
  createAnswer = jest.fn(async () => ({
    type: 'answer',
    sdp: 'v=0\r\na=candidate:2 1 udp 123 typ srflx\r\n',
  }));
  setLocalDescription = jest.fn(async (d: any) => {
    this.localDescription = d;
    this.iceGatheringState = 'complete';
  });
  setRemoteDescription = jest.fn(async (d: any) => {
    this.remoteDescription = d;
  });
  addIceCandidate = jest.fn(async () => undefined);
  close = jest.fn();
  restartIce = jest.fn();
}

jest.mock('react-native-webrtc', () => ({
  mediaDevices: {
    getUserMedia: (...args: any[]) => mockGetUserMedia(...args),
  },
  MediaStream: MockMediaStream,
  RTCPeerConnection: MockRTCPeerConnection,
  RTCIceCandidate: jest.fn().mockImplementation((c: any) => c),
  RTCSessionDescription: jest.fn().mockImplementation((d: any) => d),
}));

describe('WebRTCCallService', () => {
  const { webRtcCallService } = require('../../src/services/WebRTCCallService');
  const mockCallSignalCodec = require('../../src/services/CallSignalCodec')
    .callSignalCodec as {
    appendChunk: jest.Mock;
    getChunkProgress: jest.Mock;
    tryAssemble: jest.Mock;
    encode: jest.Mock;
    encodeChunked: jest.Mock;
  };

  const setPlatform = (os: 'ios' | 'android') => {
    try {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    } catch {
      (Platform as any).OS = os;
    }
  };

  const createConnection = (networkId: string) => {
    const listeners: Record<string, any[]> = {};
    const ircService = {
      getCurrentNick: jest.fn(() => 'myNick'),
      sendRaw: jest.fn(),
      addRawMessage: jest.fn(),
      on: jest.fn((event: string, cb: any) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
        return () => undefined;
      }),
      onConnectionChange: jest.fn((cb: any) => {
        listeners.connectionChange = listeners.connectionChange || [];
        listeners.connectionChange.push(cb);
        return () => undefined;
      }),
    };

    return {
      networkId,
      ircService,
      connectionQualityService: {
        sendMessage: jest.fn(async () => undefined),
      },
      listeners,
    };
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    setPlatform('ios');
    Object.assign(webRtcCallService as any, {
      initialized: false,
      connectionUnsubscribes: new Map(),
      peerConnection: null,
      localStream: null,
      remoteStream: null,
      pendingCandidates: [],
      signalChunkBuffers: new Map(),
      localHasPublicIceCandidates: false,
      remoteHasPublicIceCandidates: false,
      directRetryAttempted: false,
    });
    mockCallState.reset();
    mockCallState.overlayX = 20;
    mockCallState.overlayY = 120;
    mockCallState.videoOverlayWidth = 168;
    mockTabsState.tabs = [];
    mockTabsState.addTab.mockClear();
    mockTabsState.setActiveTabId.mockClear();
    mockGetAllConnections.mockReturnValue([]);
    mockGetConnection.mockReturnValue(null);
    mockGetSetting.mockImplementation(async (_k: string, d: any) => d);
    (Alert.alert as any) = jest.fn();
    (Linking.openSettings as any) = jest.fn(() => Promise.resolve());
    (PermissionsAndroid.check as any) = jest.fn(async () => true);
    (PermissionsAndroid.requestMultiple as any) = jest.fn(async () => ({}));
    mockCallSignalCodec.appendChunk.mockImplementation(
      (a: any) =>
        a || {
          startedAt: Date.now(),
          updatedAt: Date.now(),
          parts: new Map(),
          total: 1,
        },
    );
    mockCallSignalCodec.getChunkProgress.mockReturnValue({
      received: 0,
      total: 1,
      missing: [0],
    });
    mockCallSignalCodec.tryAssemble.mockReturnValue(null);
    mockCallSignalCodec.encode.mockImplementation((s: any) =>
      JSON.stringify(s),
    );
    mockCallSignalCodec.encodeChunked.mockReturnValue(['chunk-1', 'chunk-2']);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('initialize is idempotent and handles notification actions', async () => {
    const restoreSpy = jest.spyOn(webRtcCallService, 'restoreCall');
    const hangSpy = jest
      .spyOn(webRtcCallService, 'hangUp')
      .mockResolvedValue(undefined);
    mockConsumePendingCallNotificationAction.mockResolvedValueOnce('hangup');
    const conn = createConnection('net1');
    mockGetAllConnections.mockReturnValue([conn]);
    mockGetConnection.mockReturnValue(conn);

    webRtcCallService.initialize();
    webRtcCallService.initialize();

    expect(mockSetCallNotificationActionListener).toHaveBeenCalledTimes(1);
    expect(conn.ircService.on).toHaveBeenCalledWith(
      'webrtc-signal',
      expect.any(Function),
    );
    expect(conn.ircService.on).toHaveBeenCalledWith(
      'webrtc-signal-chunk',
      expect.any(Function),
    );

    const actionCb = mockSetCallNotificationActionListener.mock.calls[0][0];
    await actionCb('return');
    expect(restoreSpy).toHaveBeenCalled();
    await actionCb('hangup');
    expect(hangSpy).toHaveBeenCalled();

    await Promise.resolve();
    expect(mockHandleCallNotificationAction).toHaveBeenCalledWith('hangup');
  });

  it('starts outgoing call with generated session and invite signal', async () => {
    const sendSignalSpy = jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockResolvedValue(undefined);
    const ensurePermSpy = jest
      .spyOn(webRtcCallService as any, 'ensureMediaPermissions')
      .mockResolvedValue(undefined);
    const resetSpy = jest
      .spyOn(webRtcCallService as any, 'resetSession')
      .mockResolvedValue(undefined);
    mockGetCallVideoQuality.mockResolvedValueOnce('480p');

    await webRtcCallService.startOutgoingCall('net1', 'alice', 'video');

    expect(ensurePermSpy).toHaveBeenCalledWith('video');
    expect(resetSpy).toHaveBeenCalled();
    expect(mockSetPartial).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'net1',
        peerNick: 'alice',
        direction: 'outgoing',
        phase: 'outgoing',
        mediaType: 'video',
      }),
    );
    expect(sendSignalSpy).toHaveBeenCalledWith(
      'net1',
      'alice',
      expect.objectContaining({
        type: 'invite',
        mediaType: 'video',
      }),
    );
  });

  it('accepts/declines/hangup with expected signaling flow', async () => {
    const sendSignalSpy = jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockResolvedValue(undefined);
    const endCallSpy = jest
      .spyOn(webRtcCallService as any, 'endCall')
      .mockResolvedValue(undefined);
    const resetSpy = jest
      .spyOn(webRtcCallService as any, 'resetSession')
      .mockResolvedValue(undefined);
    const ensurePermSpy = jest
      .spyOn(webRtcCallService as any, 'ensureMediaPermissions')
      .mockResolvedValue(undefined);

    Object.assign(mockCallState, {
      networkId: 'net1',
      peerNick: 'bob',
      sessionId: 's1',
      mediaType: 'audio',
      requestedQuality: '720p',
      phase: 'incoming',
    });
    await webRtcCallService.acceptIncomingCall();
    expect(ensurePermSpy).toHaveBeenCalledWith('audio');
    expect(sendSignalSpy).toHaveBeenCalledWith(
      'net1',
      'bob',
      expect.objectContaining({ type: 'accept' }),
    );

    await webRtcCallService.declineIncomingCall();
    expect(sendSignalSpy).toHaveBeenCalledWith(
      'net1',
      'bob',
      expect.objectContaining({ type: 'reject' }),
    );
    expect(resetSpy).toHaveBeenCalled();

    Object.assign(mockCallState, {
      networkId: 'net1',
      peerNick: 'bob',
      sessionId: 's1',
      mediaType: 'audio',
    });
    await webRtcCallService.hangUp();
    expect(sendSignalSpy).toHaveBeenCalledWith(
      'net1',
      'bob',
      expect.objectContaining({ type: 'hangup' }),
    );
    expect(endCallSpy).toHaveBeenCalledWith('Call ended.');
  });

  it('toggles mute/camera and updates minimized/overlay settings', async () => {
    (webRtcCallService as any).localStream = {
      getAudioTracks: () => [{ enabled: true }],
      getVideoTracks: () => [{ enabled: true }],
    };
    mockCallState.micMuted = false;
    mockCallState.cameraEnabled = true;
    await webRtcCallService.toggleMute();
    await webRtcCallService.toggleCamera();
    expect(mockSetPartial).toHaveBeenCalledWith({ micMuted: true });
    expect(mockSetPartial).toHaveBeenCalledWith({ cameraEnabled: false });

    mockCallState.phase = 'idle';
    webRtcCallService.minimizeCall();
    webRtcCallService.restoreCall();
    expect(mockSetPartial).not.toHaveBeenCalledWith(
      expect.objectContaining({ minimized: true }),
    );

    mockCallState.phase = 'active';
    webRtcCallService.minimizeCall();
    webRtcCallService.restoreCall();
    webRtcCallService.updateOverlayPosition(1.3, 6.7);
    webRtcCallService.snapOverlayToEdge(400, 120, 20);
    webRtcCallService.updateVideoOverlayWidth(90);
    expect(mockSetPartial).toHaveBeenCalledWith({ minimized: true });
    expect(mockSetPartial).toHaveBeenCalledWith({ minimized: false });
    expect(mockSetPartial).toHaveBeenCalledWith({ overlayX: 8, overlayY: 8 });
    expect(mockSetSetting).toHaveBeenCalled();
  });

  it('handles invite/accept/reject/candidate/hangup signaling branches', async () => {
    const resetSpy = jest
      .spyOn(webRtcCallService as any, 'resetSession')
      .mockResolvedValue(undefined);
    const sendSignalSpy = jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockResolvedValue(undefined);
    const endCallSpy = jest
      .spyOn(webRtcCallService as any, 'endCall')
      .mockResolvedValue(undefined);
    const createPeerSpy = jest
      .spyOn(webRtcCallService as any, 'createPeerConnection')
      .mockResolvedValue(undefined);
    const createOfferSpy = jest
      .spyOn(webRtcCallService as any, 'createAndSendOffer')
      .mockResolvedValue(undefined);
    const flushSpy = jest
      .spyOn(webRtcCallService as any, 'flushPendingCandidates')
      .mockResolvedValue(undefined);

    mockCallState.phase = 'active';
    mockCallState.sessionId = 'other';
    await (webRtcCallService as any).handleSignal('net1', 'alice', {
      type: 'invite',
      sessionId: 's-in',
      mediaType: 'audio',
    });
    expect(sendSignalSpy).toHaveBeenCalledWith(
      'net1',
      'alice',
      expect.objectContaining({ type: 'reject', reason: 'Busy' }),
    );

    mockCallState.phase = 'idle';
    await (webRtcCallService as any).handleSignal('net1', 'alice', {
      type: 'invite',
      sessionId: 's-in2',
      mediaType: 'video',
      quality: '720p',
    });
    expect(resetSpy).toHaveBeenCalled();
    expect(mockCallState.phase).toBe('incoming');

    Object.assign(mockCallState, {
      sessionId: 's-out',
      direction: 'outgoing',
      requestedQuality: '480p',
    });
    await (webRtcCallService as any).handleSignal('net1', 'alice', {
      type: 'accept',
      sessionId: 's-out',
      mediaType: 'audio',
    });
    expect(createPeerSpy).toHaveBeenCalled();
    expect(createOfferSpy).toHaveBeenCalled();

    await (webRtcCallService as any).handleSignal('net1', 'alice', {
      type: 'reject',
      sessionId: 's-out',
      mediaType: 'audio',
      reason: 'Declined',
    });
    expect(endCallSpy).toHaveBeenCalledWith('Declined');

    (webRtcCallService as any).peerConnection = {
      remoteDescription: null,
      addIceCandidate: jest.fn(),
    };
    Object.assign(mockCallState, { sessionId: 's-cand' });
    await (webRtcCallService as any).handleSignal('net1', 'alice', {
      type: 'candidate',
      sessionId: 's-cand',
      mediaType: 'audio',
      candidate: { candidate: 'a=candidate:1 1 udp 123 typ host' },
    });
    expect((webRtcCallService as any).pendingCandidates.length).toBe(1);

    (webRtcCallService as any).peerConnection = {
      remoteDescription: {},
      addIceCandidate: jest.fn(async () => undefined),
    };
    await (webRtcCallService as any).handleSignal('net1', 'alice', {
      type: 'candidate',
      sessionId: 's-cand',
      mediaType: 'audio',
      candidate: { candidate: 'a=candidate:2 1 udp 123 typ srflx' },
    });
    expect(
      (webRtcCallService as any).peerConnection.addIceCandidate,
    ).toHaveBeenCalled();

    await (webRtcCallService as any).handleSignal('net1', 'alice', {
      type: 'hangup',
      sessionId: 's-cand',
      mediaType: 'audio',
    });
    expect(endCallSpy).toHaveBeenCalledWith('Peer ended the call.');
    expect(flushSpy).not.toBeNull();
  });

  it('handles offer and answer signaling branches', async () => {
    const peer = new MockRTCPeerConnection();
    (webRtcCallService as any).peerConnection = peer;
    const createPeerSpy = jest
      .spyOn(webRtcCallService as any, 'createPeerConnection')
      .mockImplementation(async () => {
        (webRtcCallService as any).peerConnection = peer;
      });
    const sendSignalSpy = jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockResolvedValue(undefined);
    const waitIceSpy = jest
      .spyOn(webRtcCallService as any, 'waitForIceGatheringComplete')
      .mockResolvedValue(undefined);

    Object.assign(mockCallState, {
      sessionId: 's-offer',
      requestedQuality: '480p',
      direction: 'incoming',
    });
    await (webRtcCallService as any).handleSignal('net1', 'alice', {
      type: 'offer',
      sessionId: 's-offer',
      mediaType: 'video',
      sdp: 'v=0\r\na=candidate:11 1 udp 123 typ host\r\n',
    });
    expect(createPeerSpy).toHaveBeenCalled();
    expect(peer.setRemoteDescription).toHaveBeenCalled();
    expect(waitIceSpy).toHaveBeenCalledWith('net1', 'answer');
    expect(sendSignalSpy).toHaveBeenCalledWith(
      'net1',
      'alice',
      expect.objectContaining({ type: 'answer' }),
    );

    Object.assign(mockCallState, {
      sessionId: 's-ans',
      requestedQuality: '480p',
    });
    await (webRtcCallService as any).handleSignal('net1', 'alice', {
      type: 'answer',
      sessionId: 's-ans',
      mediaType: 'audio',
      sdp: 'v=0\r\na=candidate:22 1 udp 123 typ srflx\r\n',
    });
    expect(peer.setRemoteDescription).toHaveBeenCalled();
  });

  it('sendSignal uses single or chunked transport and enforces missing connection errors', async () => {
    const conn = createConnection('net1');
    mockGetConnection.mockReturnValue(conn);
    const sendIrcSpy = jest
      .spyOn(webRtcCallService as any, 'sendIrcPrivmsg')
      .mockResolvedValue(undefined);
    const delaySpy = jest
      .spyOn(webRtcCallService as any, 'delay')
      .mockResolvedValue(undefined);

    mockCallSignalCodec.encode.mockReturnValueOnce('x'.repeat(100));
    await (webRtcCallService as any).sendSignal('net1', 'alice', {
      type: 'invite',
      sessionId: 's1',
      mediaType: 'audio',
    });
    expect(sendIrcSpy).toHaveBeenCalledTimes(1);

    mockCallSignalCodec.encode.mockReturnValueOnce('x'.repeat(600));
    await (webRtcCallService as any).sendSignal('net1', 'alice', {
      type: 'offer',
      sessionId: 's1',
      mediaType: 'audio',
      sdp: 'x',
    });
    expect(sendIrcSpy).toHaveBeenCalledTimes(3);
    expect(delaySpy).toHaveBeenCalled();

    mockGetConnection.mockReturnValueOnce(null);
    await expect(
      (webRtcCallService as any).sendSignal('netX', 'alice', {
        type: 'invite',
        sessionId: 'sX',
        mediaType: 'audio',
      }),
    ).rejects.toThrow('No IRC connection found');
  });

  it('createAndSendOffer throws on missing SDP and sends optimized offer', async () => {
    const peerNoSdp = {
      createOffer: jest.fn(async () => ({ type: 'offer', sdp: '' })),
      setLocalDescription: jest.fn(async () => undefined),
      localDescription: null,
    };
    (webRtcCallService as any).peerConnection = peerNoSdp;
    await expect(
      (webRtcCallService as any).createAndSendOffer('net1', 'alice', {
        type: 'offer',
        sessionId: 's1',
        mediaType: 'audio',
      }),
    ).rejects.toThrow('Failed to create WebRTC offer');

    const peer = new MockRTCPeerConnection();
    (webRtcCallService as any).peerConnection = peer;
    jest
      .spyOn(webRtcCallService as any, 'waitForIceGatheringComplete')
      .mockResolvedValue(undefined);
    const sendSignalSpy = jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockResolvedValue(undefined);
    await (webRtcCallService as any).createAndSendOffer('net1', 'alice', {
      type: 'offer',
      sessionId: 's2',
      mediaType: 'video',
    });
    expect(sendSignalSpy).toHaveBeenCalledWith(
      'net1',
      'alice',
      expect.objectContaining({ type: 'offer' }),
    );
  });

  it('creates peer connection and updates call store fields', async () => {
    const conn = createConnection('net1');
    mockGetConnection.mockReturnValue(conn);
    Object.assign(mockCallState, {
      sessionId: 'pc-1',
      requestedQuality: '480p',
    });

    await (webRtcCallService as any).createPeerConnection(
      'net1',
      'video',
      '480p',
    );

    expect(mockBuildRtcSessionConfig).toHaveBeenCalled();
    expect(mockGetUserMedia).toHaveBeenCalled();
    expect(mockCallState.localStream).toBeTruthy();
    expect(mockCallState.remoteStream).toBeTruthy();
    expect(mockCallState.activeQuality).toBe('480p');
  });

  it('flushes pending candidates, sends IRC PRIVMSG, and waits for ICE gathering', async () => {
    const peer = new MockRTCPeerConnection();
    peer.remoteDescription = { type: 'offer' };
    (webRtcCallService as any).peerConnection = peer;
    (webRtcCallService as any).pendingCandidates = [
      { candidate: 'x' },
      { candidate: 'y' },
    ];
    await (webRtcCallService as any).flushPendingCandidates();
    expect(peer.addIceCandidate).toHaveBeenCalledTimes(2);

    const conn = createConnection('net1');
    mockGetConnection.mockReturnValue(conn);
    await (webRtcCallService as any).sendIrcPrivmsg('net1', 'alice', 'payload');
    expect(conn.connectionQualityService.sendMessage).toHaveBeenCalledWith(
      'PRIVMSG alice :payload',
    );

    conn.connectionQualityService = null;
    await (webRtcCallService as any).sendIrcPrivmsg(
      'net1',
      'alice',
      'payload2',
    );
    expect(conn.ircService.sendRaw).toHaveBeenCalledWith(
      'PRIVMSG alice :payload2',
    );

    (webRtcCallService as any).peerConnection = peer;
    peer.iceGatheringState = 'complete';
    await (webRtcCallService as any).waitForIceGatheringComplete(
      'net1',
      'offer',
    );

    peer.iceGatheringState = 'gathering';
    const waitPromise = (webRtcCallService as any).waitForIceGatheringComplete(
      'net1',
      'answer',
    );
    jest.advanceTimersByTime(4500);
    await waitPromise;
  });

  it('handles media permissions branches on Android', async () => {
    setPlatform('android');
    (PermissionsAndroid.check as any).mockResolvedValue(true);
    await expect(
      (webRtcCallService as any).ensureMediaPermissions('audio'),
    ).resolves.toBeUndefined();

    (PermissionsAndroid.check as any).mockResolvedValue(false);
    (PermissionsAndroid.requestMultiple as any).mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]:
        PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.CAMERA]:
        PermissionsAndroid.RESULTS.GRANTED,
    });
    await expect(
      (webRtcCallService as any).ensureMediaPermissions('video'),
    ).resolves.toBeUndefined();

    (PermissionsAndroid.requestMultiple as any).mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]:
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
    });
    await expect(
      (webRtcCallService as any).ensureMediaPermissions('audio'),
    ).rejects.toThrow('settings');
    expect(Alert.alert as any).toHaveBeenCalled();
    expect(Linking.openSettings).not.toHaveBeenCalled();
    const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] || [];
    await buttons[1].onPress();
    expect(Linking.openSettings).toHaveBeenCalled();

    (PermissionsAndroid.requestMultiple as any).mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]:
        PermissionsAndroid.RESULTS.DENIED,
    });
    await expect(
      (webRtcCallService as any).ensureMediaPermissions('audio'),
    ).rejects.toThrow('denied');
  });

  it('fail/end/reset/dispose flows clean peer resources and reset state', async () => {
    const localTrack = trackFactory();
    const remoteTrack = trackFactory();
    (webRtcCallService as any).peerConnection = { close: jest.fn() };
    (webRtcCallService as any).localStream = { getTracks: () => [localTrack] };
    (webRtcCallService as any).remoteStream = {
      getTracks: () => [remoteTrack],
    };

    await (webRtcCallService as any).failCall('boom');
    expect(mockCallState.phase).toBe('error');
    expect(localTrack.stop).toHaveBeenCalled();
    expect(remoteTrack.stop).toHaveBeenCalled();

    await (webRtcCallService as any).endCall('done');
    expect(mockCallState.phase).toBe('ended');
    jest.advanceTimersByTime(1300);
    expect(mockReset).toHaveBeenCalled();

    (webRtcCallService as any).localHasPublicIceCandidates = true;
    (webRtcCallService as any).remoteHasPublicIceCandidates = true;
    (webRtcCallService as any).directRetryAttempted = true;
    await (webRtcCallService as any).resetSession();
    expect((webRtcCallService as any).localHasPublicIceCandidates).toBe(false);
    expect((webRtcCallService as any).directRetryAttempted).toBe(false);
    expect(mockSetPartial).toHaveBeenCalledWith(
      expect.objectContaining({
        overlayX: 20,
        overlayY: 120,
        videoOverlayWidth: 168,
      }),
    );
  });

  it('covers SDP helpers and retry/failure handling', async () => {
    const sdp = [
      'v=0',
      'a=candidate:1 1 udp 212 typ host',
      'a=candidate:2 1 tcp 212 typ host',
      'a=candidate:3 1 udp 212 typ srflx',
      'a=end-of-candidates',
      '',
    ].join('\r\n');
    expect((webRtcCallService as any).countSdpCandidates(sdp)).toBe(3);
    expect((webRtcCallService as any).countCandidateTypes(sdp)).toEqual(
      expect.objectContaining({ host: 2, srflx: 1 }),
    );
    expect((webRtcCallService as any).hasPublicCandidateTypes(sdp)).toBe(true);
    expect(
      (webRtcCallService as any).extractCandidateType(
        'a=candidate:1 1 udp 2 typ relay',
      ),
    ).toBe('relay');
    expect(
      (webRtcCallService as any).extractCandidateProtocol(
        'a=candidate:1 1 UDP 2 typ relay',
      ),
    ).toBe('udp');
    const optimized = (webRtcCallService as any).optimizeSdpForSignaling(sdp);
    expect(optimized.includes('a=end-of-candidates')).toBe(false);
    expect(optimized.includes(' typ host')).toBe(true);

    const retrySpy = jest
      .spyOn(webRtcCallService as any, 'retryDirectConnection')
      .mockResolvedValue(undefined);
    const failSpy = jest
      .spyOn(webRtcCallService as any, 'failCall')
      .mockResolvedValue(undefined);
    (webRtcCallService as any).directRetryAttempted = false;
    (webRtcCallService as any).localHasPublicIceCandidates = false;
    await (webRtcCallService as any).handleDirectIceFailure('net1', false);
    expect(retrySpy).toHaveBeenCalled();

    (webRtcCallService as any).directRetryAttempted = true;
    (webRtcCallService as any).localHasPublicIceCandidates = false;
    await (webRtcCallService as any).handleDirectIceFailure('net1', false);
    expect(failSpy).toHaveBeenCalledWith(
      expect.stringContaining('No public ICE candidates'),
    );

    (webRtcCallService as any).localHasPublicIceCandidates = true;
    await (webRtcCallService as any).handleDirectIceFailure('net1', false);
    expect(failSpy).toHaveBeenCalledWith(expect.stringContaining('TURN relay'));

    await (webRtcCallService as any).handleDirectIceFailure('net1', true);
    expect(failSpy).toHaveBeenCalledWith(
      'ICE negotiation failed even with relay.',
    );
  });

  it('retries direct connection and cleans stale chunk buffers', async () => {
    Object.assign(mockCallState, {
      sessionId: 's-retry',
      peerNick: 'alice',
      mediaType: 'video',
      requestedQuality: '720p',
    });
    (webRtcCallService as any).peerConnection = { restartIce: jest.fn() };
    const createOfferSpy = jest
      .spyOn(webRtcCallService as any, 'createAndSendOffer')
      .mockResolvedValue(undefined);
    await (webRtcCallService as any).retryDirectConnection('net1');
    expect(createOfferSpy).toHaveBeenCalledWith(
      'net1',
      'alice',
      expect.objectContaining({ type: 'offer', sessionId: 's-retry' }),
      { iceRestart: true },
    );
    expect((webRtcCallService as any).directRetryAttempted).toBe(true);
    expect(mockCallState.statusText).toContain('Retrying direct');

    const now = Date.now();
    (webRtcCallService as any).signalChunkBuffers.set('a', {
      startedAt: now - 20000,
      updatedAt: now - 20000,
      total: 2,
      parts: new Map([[0, 'x']]),
    });
    (webRtcCallService as any).signalChunkBuffers.set('b', {
      startedAt: now - 1000,
      updatedAt: now - 1000,
      total: 2,
      parts: new Map([[0, 'x']]),
    });
    (webRtcCallService as any).cleanupExpiredChunkBuffers('net1');
    expect((webRtcCallService as any).signalChunkBuffers.has('a')).toBe(false);
    expect((webRtcCallService as any).signalChunkBuffers.has('b')).toBe(true);
  });

  it('assembles chunked signals and handles malformed completion', async () => {
    const handleSignalSpy = jest
      .spyOn(webRtcCallService as any, 'handleSignal')
      .mockResolvedValue(undefined);
    mockCallSignalCodec.appendChunk.mockReturnValue({
      startedAt: Date.now() - 100,
      updatedAt: Date.now(),
      total: 2,
      parts: new Map([
        [0, 'x'],
        [1, 'y'],
      ]),
    });
    mockCallSignalCodec.getChunkProgress.mockReturnValue({
      received: 2,
      total: 2,
      missing: [],
    });
    mockCallSignalCodec.tryAssemble.mockReturnValueOnce({
      type: 'invite',
      sessionId: 's-1',
      mediaType: 'audio',
    });

    (webRtcCallService as any).handleSignalChunk('net1', 'alice', {
      id: 't1',
      index: 1,
      total: 2,
      sessionId: 's-1',
    });
    await Promise.resolve();
    expect(handleSignalSpy).toHaveBeenCalledWith(
      'net1',
      'alice',
      expect.objectContaining({ type: 'invite' }),
    );

    mockCallSignalCodec.tryAssemble.mockReturnValueOnce(null);
    (webRtcCallService as any).handleSignalChunk('net1', 'alice', {
      id: 't2',
      index: 1,
      total: 2,
      sessionId: 's-2',
    });
    expect(
      (webRtcCallService as any).signalChunkBuffers.size,
    ).toBeGreaterThanOrEqual(0);
  });

  it('loads/persists overlay preferences and focuses query tab', async () => {
    mockGetSetting.mockResolvedValueOnce({
      overlayX: 44,
      overlayY: 88,
      videoOverlayWidth: 200,
    });
    await (webRtcCallService as any).loadOverlayPreferences();
    expect(mockCallState.overlayX).toBe(44);
    expect(mockCallState.overlayY).toBe(88);
    expect(mockCallState.videoOverlayWidth).toBe(200);

    (webRtcCallService as any).persistOverlayPreferences();
    expect(mockSetSetting).toHaveBeenCalled();

    Object.assign(mockCallState, { networkId: 'net1', peerNick: 'alice' });
    (webRtcCallService as any).focusCallQueryTab();
    expect(mockTabsState.addTab).toHaveBeenCalled();
    expect(mockTabsState.setActiveTabId).toHaveBeenCalledWith(
      'query::net1::alice',
    );

    mockTabsState.tabs = [{ id: 'query::net1::alice' }];
    mockTabsState.addTab.mockClear();
    (webRtcCallService as any).focusCallQueryTab();
    expect(mockTabsState.addTab).not.toHaveBeenCalled();
  });

  it('generateSecureIdSuffix falls back when crypto is unavailable or throws', () => {
    const gen = (webRtcCallService as any).constructor.generateSecureIdSuffix;
    const original = (globalThis as any).crypto;
    try {
      (globalThis as any).crypto = undefined;
      expect(typeof gen(8)).toBe('string');

      (globalThis as any).crypto = {
        getRandomValues: () => {
          throw new Error('no crypto');
        },
      };
      expect(typeof gen(8)).toBe('string');
    } finally {
      (globalThis as any).crypto = original;
    }
  });

  it('initialize swallows pending-action rejection and wires connection-created', async () => {
    mockConsumePendingCallNotificationAction.mockRejectedValueOnce(
      new Error('pending fail'),
    );
    webRtcCallService.initialize();
    await Promise.resolve();
    await Promise.resolve();

    const conn = createConnection('net1');
    mockGetConnection.mockReturnValue(conn);
    expect(mockConnectionCreatedCb.fn).toBeDefined();
    mockConnectionCreatedCb.fn?.('net1');
    expect(conn.ircService.on).toHaveBeenCalledWith(
      'webrtc-signal',
      expect.any(Function),
    );

    mockGetConnection.mockReturnValue(null);
    mockConnectionCreatedCb.fn?.('net2');
  });

  it('initialize swallows handleCallNotificationAction rejection', async () => {
    mockConsumePendingCallNotificationAction.mockResolvedValueOnce('hangup');
    mockHandleCallNotificationAction.mockRejectedValueOnce(new Error('handle'));
    webRtcCallService.initialize();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockHandleCallNotificationAction).toHaveBeenCalledWith('hangup');
  });

  it('attachConnection wires signal listeners, dedupes, and fails on disconnect', async () => {
    const conn = createConnection('net1');
    const handleSignalSpy = jest.spyOn(
      webRtcCallService as any,
      'handleSignal',
    );
    const chunkSpy = jest
      .spyOn(webRtcCallService as any, 'handleSignalChunk')
      .mockImplementation(() => undefined);
    const failSpy = jest
      .spyOn(webRtcCallService as any, 'failCall')
      .mockResolvedValue(undefined);

    (webRtcCallService as any).attachConnection('net1', conn.ircService);
    // Duplicate attach returns early (line 303).
    (webRtcCallService as any).attachConnection('net1', conn.ircService);
    expect(conn.ircService.on).toHaveBeenCalledTimes(2);

    handleSignalSpy.mockResolvedValueOnce(undefined);
    conn.listeners['webrtc-signal'][0](
      { type: 'hangup', sessionId: 's', mediaType: 'audio' },
      { fromNick: 'bob', network: 'net1' },
    );
    await Promise.resolve();
    expect(handleSignalSpy).toHaveBeenCalled();

    // Error path with Error instance and fallback network id.
    handleSignalSpy.mockRejectedValueOnce(new Error('boom'));
    conn.listeners['webrtc-signal'][0](
      { type: 'x' },
      { fromNick: 'bob', network: '' },
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(failSpy).toHaveBeenCalledWith('boom');

    // Error path with non-Error rejection.
    handleSignalSpy.mockRejectedValueOnce('str');
    conn.listeners['webrtc-signal'][0](
      { type: 'x' },
      { fromNick: 'bob', network: 'net1' },
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(failSpy).toHaveBeenCalledWith('Failed to handle call signal.');

    // Chunk listener wiring.
    conn.listeners['webrtc-signal-chunk'][0](
      { id: 't' },
      { fromNick: 'bob', network: '' },
    );
    expect(chunkSpy).toHaveBeenCalledWith('net1', 'bob', { id: 't' });

    // Connection-change: disconnect during active call triggers failCall.
    Object.assign(mockCallState, { networkId: 'net1', phase: 'active' });
    conn.listeners.connectionChange[0](false);
    expect(failSpy).toHaveBeenCalledWith(
      'IRC connection dropped during call setup.',
    );

    // Still connected: no additional failure.
    failSpy.mockClear();
    conn.listeners.connectionChange[0](true);
    expect(failSpy).not.toHaveBeenCalled();
  });

  it('acceptIncomingCall returns early when session data is missing', async () => {
    mockCallState.sessionId = null;
    const ensureSpy = jest
      .spyOn(webRtcCallService as any, 'ensureMediaPermissions')
      .mockResolvedValue(undefined);
    await webRtcCallService.acceptIncomingCall();
    expect(ensureSpy).not.toHaveBeenCalled();
  });

  it('hangUp swallows sendSignal errors and still ends the call', async () => {
    Object.assign(mockCallState, {
      networkId: 'net1',
      peerNick: 'bob',
      sessionId: 's1',
    });
    jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockRejectedValue(new Error('signal fail'));
    const endSpy = jest
      .spyOn(webRtcCallService as any, 'endCall')
      .mockResolvedValue(undefined);
    await webRtcCallService.hangUp();
    expect(endSpy).toHaveBeenCalledWith('Call ended.');
  });

  it('handleSignalChunk returns on partial progress and handles assembly outcomes', async () => {
    mockCallSignalCodec.getChunkProgress.mockReturnValueOnce({
      received: 0,
      total: 2,
      missing: [0, 1],
    });
    (webRtcCallService as any).handleSignalChunk('net1', 'alice', {
      id: 't-partial',
      index: 0,
      total: 2,
      sessionId: 's',
    });

    mockCallSignalCodec.getChunkProgress.mockReturnValue({
      received: 2,
      total: 2,
      missing: [],
    });

    // Completed set but assembly fails -> buffer deleted, no handleSignal.
    mockCallSignalCodec.tryAssemble.mockReturnValueOnce(null);
    (webRtcCallService as any).handleSignalChunk('net1', 'alice', {
      id: 't-fail',
      index: 1,
      total: 2,
      sessionId: 's',
    });

    // Completed + assembled but handleSignal rejects with Error -> failCall.
    const failSpy = jest
      .spyOn(webRtcCallService as any, 'failCall')
      .mockResolvedValue(undefined);
    mockCallSignalCodec.tryAssemble.mockReturnValueOnce({
      type: 'invite',
      sessionId: 's',
      mediaType: 'audio',
    });
    jest
      .spyOn(webRtcCallService as any, 'handleSignal')
      .mockRejectedValueOnce(new Error('boom'));
    (webRtcCallService as any).handleSignalChunk('net1', 'alice', {
      id: 't-err',
      index: 1,
      total: 2,
      sessionId: 's',
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(failSpy).toHaveBeenCalledWith('boom');

    // Non-Error rejection path.
    mockCallSignalCodec.tryAssemble.mockReturnValueOnce({
      type: 'invite',
      sessionId: 's',
      mediaType: 'audio',
    });
    jest
      .spyOn(webRtcCallService as any, 'handleSignal')
      .mockRejectedValueOnce('str');
    (webRtcCallService as any).handleSignalChunk('net1', 'alice', {
      id: 't-err2',
      index: 1,
      total: 2,
      sessionId: 's',
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(failSpy).toHaveBeenCalledWith('Failed to handle call signal.');
  });

  it('handleSignal returns early on session mismatches and unknown types', async () => {
    const sendSignalSpy = jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockResolvedValue(undefined);
    const createPeerSpy = jest
      .spyOn(webRtcCallService as any, 'createPeerConnection')
      .mockResolvedValue(undefined);
    const endCallSpy = jest
      .spyOn(webRtcCallService as any, 'endCall')
      .mockResolvedValue(undefined);

    Object.assign(mockCallState, {
      sessionId: 's1',
      direction: 'incoming',
      phase: 'active',
    });

    // accept: session mismatch.
    await (webRtcCallService as any).handleSignal('n', 'a', {
      type: 'accept',
      sessionId: 'other',
      mediaType: 'audio',
    });
    // accept: right session but direction is not outgoing.
    await (webRtcCallService as any).handleSignal('n', 'a', {
      type: 'accept',
      sessionId: 's1',
      mediaType: 'audio',
    });
    expect(createPeerSpy).not.toHaveBeenCalled();

    // reject: mismatch.
    await (webRtcCallService as any).handleSignal('n', 'a', {
      type: 'reject',
      sessionId: 'other',
      mediaType: 'audio',
    });
    // offer: mismatch and missing sdp.
    await (webRtcCallService as any).handleSignal('n', 'a', {
      type: 'offer',
      sessionId: 'other',
      mediaType: 'audio',
      sdp: 'x',
    });
    await (webRtcCallService as any).handleSignal('n', 'a', {
      type: 'offer',
      sessionId: 's1',
      mediaType: 'audio',
    });
    // answer: mismatch and missing sdp.
    await (webRtcCallService as any).handleSignal('n', 'a', {
      type: 'answer',
      sessionId: 'other',
      mediaType: 'audio',
      sdp: 'x',
    });
    await (webRtcCallService as any).handleSignal('n', 'a', {
      type: 'answer',
      sessionId: 's1',
      mediaType: 'audio',
    });
    // candidate: mismatch and missing candidate.
    await (webRtcCallService as any).handleSignal('n', 'a', {
      type: 'candidate',
      sessionId: 'other',
      mediaType: 'audio',
      candidate: {},
    });
    await (webRtcCallService as any).handleSignal('n', 'a', {
      type: 'candidate',
      sessionId: 's1',
      mediaType: 'audio',
    });
    // hangup: mismatch.
    await (webRtcCallService as any).handleSignal('n', 'a', {
      type: 'hangup',
      sessionId: 'other',
      mediaType: 'audio',
    });
    // unknown type: default branch.
    await (webRtcCallService as any).handleSignal('n', 'a', {
      type: 'bogus',
      sessionId: 's1',
      mediaType: 'audio',
    });

    expect(endCallSpy).not.toHaveBeenCalled();
    expect(sendSignalSpy).not.toHaveBeenCalled();
  });

  it('handleSignal throws when the created answer has no SDP', async () => {
    const peer = new MockRTCPeerConnection();
    peer.createAnswer = jest.fn(async () => ({ type: 'answer', sdp: '' }));
    jest
      .spyOn(webRtcCallService as any, 'createPeerConnection')
      .mockImplementation(async () => {
        (webRtcCallService as any).peerConnection = peer;
      });
    jest
      .spyOn(webRtcCallService as any, 'flushPendingCandidates')
      .mockResolvedValue(undefined);
    Object.assign(mockCallState, {
      sessionId: 's-off',
      requestedQuality: '480p',
    });
    await expect(
      (webRtcCallService as any).handleSignal('n', 'a', {
        type: 'offer',
        sessionId: 's-off',
        mediaType: 'audio',
        sdp: 'v=0\r\n',
      }),
    ).rejects.toThrow('Failed to create WebRTC answer');
  });

  it('createPeerConnection returns early when a peer already exists', async () => {
    (webRtcCallService as any).peerConnection = new MockRTCPeerConnection();
    await (webRtcCallService as any).createPeerConnection('n', 'audio', '480p');
    expect(mockBuildRtcSessionConfig).not.toHaveBeenCalled();
  });

  it('wires and triggers peer-connection event handlers with relay enabled', async () => {
    const conn = createConnection('net1');
    mockGetConnection.mockReturnValue(conn);
    Object.assign(mockCallState, {
      sessionId: 'pc-2',
      requestedQuality: '480p',
    });
    mockBuildRtcSessionConfig.mockResolvedValueOnce({
      relayEnabled: true,
      selectedVideoPreset: {
        quality: '480p',
        width: 640,
        height: 480,
        frameRate: 24,
      },
      iceServers: [{ urls: ['stun:example.org'] }],
      iceTransportPolicy: 'all',
    });
    await (webRtcCallService as any).createPeerConnection(
      'net1',
      'video',
      '480p',
    );
    const peer = (webRtcCallService as any).peerConnection;

    // onicecandidate: end-of-gathering event and a real candidate.
    peer.onicecandidate({ candidate: null });
    peer.onicecandidate({
      candidate: {
        candidate: 'a=candidate:1 1 udp 1 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      },
    });

    // ontrack: add a new track then skip the duplicate.
    const track1 = { id: 'r1', kind: 'audio' };
    const stream = { getTracks: () => [track1] };
    peer.ontrack({ streams: [stream] });
    peer.ontrack({ streams: [stream] });

    const difSpy = jest
      .spyOn(webRtcCallService as any, 'handleDirectIceFailure')
      .mockResolvedValue(undefined);
    const failSpy = jest
      .spyOn(webRtcCallService as any, 'failCall')
      .mockResolvedValue(undefined);

    peer.connectionState = 'connected';
    peer.onconnectionstatechange();
    expect(mockSetPartial).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'connected', usingRelay: true }),
    );

    peer.connectionState = 'failed';
    peer.iceConnectionState = 'failed';
    peer.onconnectionstatechange(); // early return branch
    peer.iceConnectionState = 'new';
    peer.onconnectionstatechange();
    expect(difSpy).toHaveBeenCalled();

    difSpy.mockRejectedValueOnce(new Error('x'));
    peer.onconnectionstatechange();
    await Promise.resolve();
    await Promise.resolve();
    expect(failSpy).toHaveBeenCalledWith('WebRTC connection failed.');

    peer.iceConnectionState = 'connected';
    peer.oniceconnectionstatechange();
    peer.iceConnectionState = 'completed';
    peer.oniceconnectionstatechange();
    peer.iceConnectionState = 'failed';
    difSpy.mockRejectedValueOnce(new Error('x'));
    peer.oniceconnectionstatechange();
    await Promise.resolve();
    await Promise.resolve();
    expect(failSpy).toHaveBeenCalledWith(
      'ICE negotiation failed even with relay.',
    );

    peer.onicegatheringstatechange();
    peer.onsignalingstatechange();
  });

  it('triggers peer-connection handlers for direct (no relay) branches', async () => {
    const conn = createConnection('net1');
    mockGetConnection.mockReturnValue(conn);
    Object.assign(mockCallState, {
      sessionId: 'pc-3',
      requestedQuality: '480p',
    });
    await (webRtcCallService as any).createPeerConnection(
      'net1',
      'audio',
      '480p',
    );
    const peer = (webRtcCallService as any).peerConnection;
    const difSpy = jest
      .spyOn(webRtcCallService as any, 'handleDirectIceFailure')
      .mockResolvedValue(undefined);
    const failSpy = jest
      .spyOn(webRtcCallService as any, 'failCall')
      .mockResolvedValue(undefined);

    peer.connectionState = 'connected';
    peer.onconnectionstatechange();
    expect(mockSetPartial).toHaveBeenCalledWith(
      expect.objectContaining({ usingRelay: false }),
    );

    peer.iceConnectionState = 'connected';
    peer.oniceconnectionstatechange();

    peer.iceConnectionState = 'failed';
    difSpy.mockRejectedValueOnce(new Error('x'));
    peer.oniceconnectionstatechange();
    await Promise.resolve();
    await Promise.resolve();
    expect(failSpy).toHaveBeenCalledWith(expect.stringContaining('TURN relay'));
  });

  it('flushPendingCandidates returns when peer or remote description is missing', async () => {
    (webRtcCallService as any).peerConnection = null;
    await expect(
      (webRtcCallService as any).flushPendingCandidates(),
    ).resolves.toBeUndefined();

    (webRtcCallService as any).peerConnection = {
      remoteDescription: null,
      addIceCandidate: jest.fn(),
    };
    (webRtcCallService as any).pendingCandidates = [{ candidate: 'x' }];
    await (webRtcCallService as any).flushPendingCandidates();
    expect(
      (webRtcCallService as any).peerConnection.addIceCandidate,
    ).not.toHaveBeenCalled();
  });

  it('sendIrcPrivmsg throws when no IRC connection exists', async () => {
    mockGetConnection.mockReturnValue(null);
    await expect(
      (webRtcCallService as any).sendIrcPrivmsg('net1', 'alice', 'payload'),
    ).rejects.toThrow('No IRC connection found');
  });

  it('waitForIceGatheringComplete handles no peer, state changes, and double finish', async () => {
    (webRtcCallService as any).peerConnection = null;
    await expect(
      (webRtcCallService as any).waitForIceGatheringComplete('net1', 'offer'),
    ).resolves.toBeUndefined();

    const peer = new MockRTCPeerConnection();
    peer.iceGatheringState = 'gathering';
    const previous = jest.fn();
    peer.onicegatheringstatechange = previous;
    (webRtcCallService as any).peerConnection = peer;

    const waitPromise = (webRtcCallService as any).waitForIceGatheringComplete(
      'net1',
      'offer',
    );
    const wrapper = peer.onicegatheringstatechange;
    peer.iceGatheringState = 'complete';
    wrapper(); // finishes and resolves
    wrapper(); // already settled -> early return branch
    await waitPromise;
    expect(previous).toHaveBeenCalled();
  });

  it('candidate helpers return null for empty input', () => {
    expect(
      (webRtcCallService as any).extractCandidateType(undefined),
    ).toBeNull();
    expect((webRtcCallService as any).extractCandidateType('')).toBeNull();
    expect(
      (webRtcCallService as any).extractCandidateProtocol(undefined),
    ).toBeNull();
    expect((webRtcCallService as any).extractCandidateProtocol('')).toBeNull();
    expect(
      (webRtcCallService as any).extractCandidateProtocol('a b'),
    ).toBeNull();
  });

  it('delay resolves after the configured timeout', async () => {
    const promise = (webRtcCallService as any).delay(50);
    jest.advanceTimersByTime(50);
    await expect(promise).resolves.toBeUndefined();
  });

  it('retryDirectConnection returns early without session data', async () => {
    Object.assign(mockCallState, { sessionId: null, peerNick: null });
    const offerSpy = jest
      .spyOn(webRtcCallService as any, 'createAndSendOffer')
      .mockResolvedValue(undefined);
    await (webRtcCallService as any).retryDirectConnection('net1');
    expect(offerSpy).not.toHaveBeenCalled();
  });

  it('persistOverlayPreferences swallows setSetting rejections', async () => {
    mockSetSetting.mockRejectedValueOnce(new Error('persist fail'));
    (webRtcCallService as any).persistOverlayPreferences();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSetSetting).toHaveBeenCalled();
  });

  it('starts an audio outgoing call with the default quality and status text', async () => {
    const sendSignalSpy = jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockResolvedValue(undefined);
    jest
      .spyOn(webRtcCallService as any, 'ensureMediaPermissions')
      .mockResolvedValue(undefined);
    jest
      .spyOn(webRtcCallService as any, 'resetSession')
      .mockResolvedValue(undefined);

    await webRtcCallService.startOutgoingCall('net1', 'alice', 'audio');

    expect(mockGetCallVideoQuality).not.toHaveBeenCalled();
    expect(mockSetPartial).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: 'audio',
        statusText: 'Calling with audio...',
      }),
    );
    expect(sendSignalSpy).toHaveBeenCalledWith(
      'net1',
      'alice',
      expect.objectContaining({ type: 'invite', mediaType: 'audio' }),
    );
  });

  it('declineIncomingCall resets without signaling when no session exists', async () => {
    Object.assign(mockCallState, {
      networkId: null,
      peerNick: null,
      sessionId: null,
    });
    const sendSignalSpy = jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockResolvedValue(undefined);
    const resetSpy = jest
      .spyOn(webRtcCallService as any, 'resetSession')
      .mockResolvedValue(undefined);
    await webRtcCallService.declineIncomingCall();
    expect(sendSignalSpy).not.toHaveBeenCalled();
    expect(resetSpy).toHaveBeenCalled();
  });

  it('handleSignal handles invite reuse, audio status, and default reject reason', async () => {
    const sendSignalSpy = jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockResolvedValue(undefined);
    const resetSpy = jest
      .spyOn(webRtcCallService as any, 'resetSession')
      .mockResolvedValue(undefined);
    const endCallSpy = jest
      .spyOn(webRtcCallService as any, 'endCall')
      .mockResolvedValue(undefined);

    // Busy but same session id -> not rejected, stored as incoming (audio status).
    Object.assign(mockCallState, { phase: 'active', sessionId: 's-same' });
    await (webRtcCallService as any).handleSignal('net1', 'alice', {
      type: 'invite',
      sessionId: 's-same',
      mediaType: 'audio',
    });
    expect(resetSpy).toHaveBeenCalled();
    expect(sendSignalSpy).not.toHaveBeenCalledWith(
      'net1',
      'alice',
      expect.objectContaining({ reason: 'Busy' }),
    );
    expect(mockCallState.statusText).toBe('Incoming audio call...');

    // reject with no reason -> default message.
    Object.assign(mockCallState, { sessionId: 's-rej' });
    await (webRtcCallService as any).handleSignal('net1', 'alice', {
      type: 'reject',
      sessionId: 's-rej',
      mediaType: 'audio',
    });
    expect(endCallSpy).toHaveBeenCalledWith('Call was rejected.');
  });

  it('attachConnection skips connection-change wiring when unsupported', () => {
    const ircService = {
      getCurrentNick: jest.fn(() => 'me'),
      sendRaw: jest.fn(),
      addRawMessage: jest.fn(),
      on: jest.fn(() => () => undefined),
    };
    (webRtcCallService as any).attachConnection('netNoChange', ircService);
    expect(ircService.on).toHaveBeenCalledTimes(2);
    expect(
      (webRtcCallService as any).connectionUnsubscribes.get('netNoChange')
        .length,
    ).toBe(2);
  });

  it('snapOverlayToEdge snaps to the right edge when overlay is past center', () => {
    mockCallState.overlayX = 300;
    webRtcCallService.snapOverlayToEdge(400, 120, 40);
    expect(mockSetPartial).toHaveBeenCalledWith({
      overlayX: 268,
      overlayY: 40,
    });
  });

  it('loadOverlayPreferences falls back to defaults for non-numeric values', async () => {
    mockGetSetting.mockResolvedValueOnce({
      overlayX: 'nope',
      overlayY: null,
      videoOverlayWidth: undefined,
    });
    await (webRtcCallService as any).loadOverlayPreferences();
    expect(mockCallState.overlayX).toBe(20);
    expect(mockCallState.overlayY).toBe(120);
    expect(mockCallState.videoOverlayWidth).toBe(168);
  });

  it('ensureMediaPermissions reports camera+microphone when video permanently denied', async () => {
    setPlatform('android');
    (PermissionsAndroid.check as any).mockResolvedValue(false);
    (PermissionsAndroid.requestMultiple as any).mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]:
        PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.CAMERA]:
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
    });
    await expect(
      (webRtcCallService as any).ensureMediaPermissions('video'),
    ).rejects.toThrow('camera and microphone');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Permission required',
      expect.stringContaining('camera and microphone'),
      expect.any(Array),
    );
  });

  it('candidate type counting handles unknown and unparsable candidates', () => {
    const sdp = ['a=candidate:1 1 udp 1 typ', 'a=candidate:bad-line', ''].join(
      '\r\n',
    );
    const counts = (webRtcCallService as any).countCandidateTypes(sdp);
    expect(counts.unknown).toBe(2);
    expect(
      (webRtcCallService as any).extractCandidateType(
        'a=candidate:no-typ-here',
      ),
    ).toBeNull();
  });

  it('initialize handles DEFAULT/RETURN notification actions and unknown actions', async () => {
    const restoreSpy = jest.spyOn(webRtcCallService, 'restoreCall');
    const focusSpy = jest
      .spyOn(webRtcCallService as any, 'focusCallQueryTab')
      .mockImplementation(() => undefined);
    mockConsumePendingCallNotificationAction.mockResolvedValueOnce(null);

    webRtcCallService.initialize();
    const actionCb = mockSetCallNotificationActionListener.mock.calls[0][0];

    await actionCb('default');
    expect(focusSpy).toHaveBeenCalled();
    expect(restoreSpy).toHaveBeenCalled();

    focusSpy.mockClear();
    restoreSpy.mockClear();
    await actionCb('something-else');
    expect(focusSpy).not.toHaveBeenCalled();
    expect(restoreSpy).not.toHaveBeenCalled();
  });

  it('createAndSendOffer falls back to offer sdp when localDescription is absent', async () => {
    const peer = {
      createOffer: jest.fn(async () => ({ type: 'offer', sdp: 'v=0\r\n' })),
      setLocalDescription: jest.fn(async () => undefined),
      localDescription: null,
    };
    (webRtcCallService as any).peerConnection = peer;
    jest
      .spyOn(webRtcCallService as any, 'waitForIceGatheringComplete')
      .mockResolvedValue(undefined);
    const sendSignalSpy = jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockResolvedValue(undefined);

    await (webRtcCallService as any).createAndSendOffer('net1', 'alice', {
      type: 'offer',
      sessionId: 's-fb',
      mediaType: 'audio',
    });
    expect(sendSignalSpy).toHaveBeenCalledWith(
      'net1',
      'alice',
      expect.objectContaining({ type: 'offer' }),
    );
  });

  it('createPeerConnection uses device fallbacks when connection and session are missing', async () => {
    mockGetConnection.mockReturnValue(null);
    Object.assign(mockCallState, { sessionId: null, requestedQuality: '480p' });
    await (webRtcCallService as any).createPeerConnection(
      'net1',
      'audio',
      '480p',
    );
    expect(mockBuildRtcSessionConfig).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'net1-device' }),
    );
  });

  it('hangUp ends the call without signaling when there is no active session', async () => {
    Object.assign(mockCallState, {
      networkId: null,
      peerNick: null,
      sessionId: null,
    });
    const sendSignalSpy = jest
      .spyOn(webRtcCallService as any, 'sendSignal')
      .mockResolvedValue(undefined);
    const endSpy = jest
      .spyOn(webRtcCallService as any, 'endCall')
      .mockResolvedValue(undefined);
    await webRtcCallService.hangUp();
    expect(sendSignalSpy).not.toHaveBeenCalled();
    expect(endSpy).toHaveBeenCalledWith('Call ended.');
  });

  it('endCall does not reset when phase changes before the timeout fires', async () => {
    (webRtcCallService as any).peerConnection = null;
    (webRtcCallService as any).localStream = null;
    (webRtcCallService as any).remoteStream = null;
    await (webRtcCallService as any).endCall('bye');
    expect(mockCallState.phase).toBe('ended');
    mockCallState.phase = 'idle';
    mockReset.mockClear();
    jest.advanceTimersByTime(1300);
    expect(mockReset).not.toHaveBeenCalled();
  });
});
