/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.unmock('../../src/services/WebRTCCallService');

const mockSetPartial = jest.fn();
const mockCallState = {
  sessionId: null,
  networkId: null,
  peerNick: null,
  mediaType: 'audio',
  phase: 'idle',
  micMuted: false,
  cameraEnabled: true,
  overlayX: 20,
  overlayY: 120,
  videoOverlayWidth: 168,
  setPartial: (...args: any[]) => mockSetPartial(...args),
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

jest.mock('../../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: jest.fn(() => []),
    onConnectionCreated: jest.fn(),
    getConnection: jest.fn(() => null),
  },
}));

jest.mock('../../src/services/NotificationService', () => ({
  CALL_NOTIFICATION_ACTIONS: {
    HANGUP: 'hangup',
    RETURN: 'return',
    DEFAULT: 'default',
  },
  notificationService: {
    setCallNotificationActionListener: jest.fn(),
    consumePendingCallNotificationAction: jest.fn(() => Promise.resolve(null)),
    handleCallNotificationAction: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../src/stores/tabStore', () => ({
  useTabStore: {
    getState: () => ({ tabs: [], addTab: jest.fn(), setActiveTabId: jest.fn() }),
  },
}));

jest.mock('../../src/services/CallMediaProfileService', () => ({
  callMediaProfileService: {
    clampVideoQuality: jest.fn((q: any) => q),
    getCapabilityProfile: jest.fn(() => ({ relayEnabled: false })),
  },
}));

jest.mock('../../src/services/MediaSettingsService', () => ({
  mediaSettingsService: {
    getCallVideoQuality: jest.fn(async () => '480p'),
  },
}));

jest.mock('../../src/services/CallSignalCodec', () => ({
  callSignalCodec: {
    appendChunk: jest.fn((a: any) => a || { startedAt: Date.now() }),
    getChunkProgress: jest.fn(() => ({ received: 0, total: 1, missing: [0] })),
    tryAssemble: jest.fn(() => null),
  },
}));

import { webRtcCallService } from '../../src/services/WebRTCCallService';

describe('WebRTCCallService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCallState.phase = 'idle';
    mockCallState.overlayX = 20;
  });

  it('initialize is idempotent', () => {
    webRtcCallService.initialize();
    webRtcCallService.initialize();

    const { notificationService } = require('../../src/services/NotificationService');
    expect(notificationService.setCallNotificationActionListener).toHaveBeenCalledTimes(1);
  });

  it('minimize/restore only affect non-idle phase', () => {
    mockCallState.phase = 'idle';
    webRtcCallService.minimizeCall();
    webRtcCallService.restoreCall();
    expect(mockSetPartial).not.toHaveBeenCalledWith(expect.objectContaining({ minimized: true }));

    mockCallState.phase = 'active';
    webRtcCallService.minimizeCall();
    webRtcCallService.restoreCall();
    expect(mockSetPartial).toHaveBeenCalledWith({ minimized: true });
    expect(mockSetPartial).toHaveBeenCalledWith({ minimized: false });
  });

  it('updates overlay state with bounds and persists prefs', () => {
    webRtcCallService.updateOverlayPosition(1.3, 6.7);
    expect(mockSetPartial).toHaveBeenCalledWith({ overlayX: 8, overlayY: 8 });
    expect(mockSetSetting).toHaveBeenCalled();

    mockCallState.overlayX = 30;
    webRtcCallService.snapOverlayToEdge(400, 120, 20);
    expect(mockSetPartial).toHaveBeenCalledWith({ overlayX: 12, overlayY: 20 });

    mockCallState.overlayX = 350;
    webRtcCallService.snapOverlayToEdge(400, 120, 2);
    expect(mockSetPartial).toHaveBeenCalledWith({ overlayX: 268, overlayY: 8 });
  });

  it('clamps overlay width', () => {
    webRtcCallService.updateVideoOverlayWidth(90);
    expect(mockSetPartial).toHaveBeenCalledWith({ videoOverlayWidth: 132 });

    webRtcCallService.updateVideoOverlayWidth(400);
    expect(mockSetPartial).toHaveBeenCalledWith({ videoOverlayWidth: 260 });
  });
});
