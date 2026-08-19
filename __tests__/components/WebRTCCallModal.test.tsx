import React from 'react';
import { Modal, PanResponder } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { WebRTCCallModal } from '../../src/components/WebRTCCallModal';

const mockUseCallStore = jest.fn();
const mockShowNotif = jest.fn();
const mockCancelNotif = jest.fn();
const mockGetSetting = jest.fn();
const mockOnSettingChange = jest.fn();

const mockDeclineIncomingCall = jest.fn();
const mockAcceptIncomingCall = jest.fn();
const mockToggleMute = jest.fn();
const mockToggleCamera = jest.fn();
const mockHangUp = jest.fn();
const mockMinimizeCall = jest.fn();
const mockRestoreCall = jest.fn();
const mockUpdateOverlayPosition = jest.fn();
const mockSnapOverlayToEdge = jest.fn();
const mockUpdateVideoOverlayWidth = jest.fn();

jest.mock('../../src/stores/callStore', () => ({
  useCallStore: () => mockUseCallStore(),
}));

jest.mock('../../src/services/WebRTCCallService', () => ({
  webRtcCallService: {
    declineIncomingCall: (...args: unknown[]) =>
      mockDeclineIncomingCall(...args),
    acceptIncomingCall: (...args: unknown[]) => mockAcceptIncomingCall(...args),
    toggleMute: (...args: unknown[]) => mockToggleMute(...args),
    toggleCamera: (...args: unknown[]) => mockToggleCamera(...args),
    hangUp: (...args: unknown[]) => mockHangUp(...args),
    minimizeCall: (...args: unknown[]) => mockMinimizeCall(...args),
    restoreCall: (...args: unknown[]) => mockRestoreCall(...args),
    updateOverlayPosition: (...args: unknown[]) =>
      mockUpdateOverlayPosition(...args),
    snapOverlayToEdge: (...args: unknown[]) => mockSnapOverlayToEdge(...args),
    updateVideoOverlayWidth: (...args: unknown[]) =>
      mockUpdateVideoOverlayWidth(...args),
  },
}));

jest.mock('../../src/services/NotificationService', () => ({
  notificationService: {
    showOngoingCallNotification: (...args: unknown[]) => mockShowNotif(...args),
    cancelOngoingCallNotification: (...args: unknown[]) =>
      mockCancelNotif(...args),
  },
}));

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: (...args: unknown[]) => mockGetSetting(...args),
    onSettingChange: (...args: unknown[]) => mockOnSettingChange(...args),
  },
}));

jest.mock('react-native-webrtc', () => ({
  RTCView: () => null,
}));

const baseStore = {
  phase: 'idle',
  mediaType: 'audio',
  peerNick: null,
  networkId: null,
  statusText: '',
  localStream: null,
  remoteStream: null,
  direction: 'outgoing',
  micMuted: false,
  cameraEnabled: true,
  usingRelay: false,
  minimized: false,
  overlayX: 16,
  overlayY: 16,
  videoOverlayWidth: 180,
};

const mockStream = { toURL: () => 'mock-stream-url' };

// Captured onSettingChange callbacks keyed by setting name.
const settingCallbacks: Record<string, (value: unknown) => void> = {};
// Captured PanResponder.create config objects (move + resize responders).
let capturedPanConfigs: any[] = [];

describe('WebRTCCallModal', () => {
  let panResponderSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const key of Object.keys(settingCallbacks)) {
      delete settingCallbacks[key];
    }
    capturedPanConfigs = [];
    panResponderSpy = jest
      .spyOn(PanResponder, 'create')
      .mockImplementation((config: any) => {
        capturedPanConfigs.push(config);
        return { panHandlers: {} } as any;
      });

    mockGetSetting.mockImplementation((key: string, def: any) =>
      Promise.resolve(def),
    );
    mockOnSettingChange.mockImplementation(
      (key: string, cb: (value: unknown) => void) => {
        settingCallbacks[key] = cb;
        return () => {};
      },
    );
    mockShowNotif.mockResolvedValue(undefined);
    mockCancelNotif.mockResolvedValue(undefined);

    mockUseCallStore.mockReturnValue({
      phase: 'idle',
      mediaType: 'audio',
      peerNick: null,
      networkId: null,
      statusText: '',
      localStream: null,
      remoteStream: null,
      direction: 'outgoing',
      micMuted: false,
      cameraEnabled: true,
      usingRelay: false,
      minimized: false,
      overlayX: 16,
      overlayY: 16,
      videoOverlayWidth: 180,
    });
  });

  afterEach(() => {
    panResponderSpy.mockRestore();
  });

  it('renders nothing when call is idle', async () => {
    const { queryByText } = await render(<WebRTCCallModal />);
    expect(queryByText('Audio Call')).toBeNull();
    expect(queryByText('Video Call')).toBeNull();
  });

  it('renders incoming call controls and handles accept/decline', async () => {
    mockUseCallStore.mockReturnValue({
      ...mockUseCallStore(),
      phase: 'incoming',
      peerNick: 'alice',
      mediaType: 'audio',
      minimized: false,
      statusText: 'Incoming call',
    });

    const { UNSAFE_getAllByType } = await render(<WebRTCCallModal />);
    const buttons = UNSAFE_getAllByType(
      require('react-native').TouchableOpacity,
    );

    await fireEvent.press(buttons[0]);
    await fireEvent.press(buttons[1]);

    expect(mockDeclineIncomingCall).toHaveBeenCalled();
    expect(mockAcceptIncomingCall).toHaveBeenCalled();
  });

  it('renders minimized audio overlay actions', async () => {
    mockUseCallStore.mockReturnValue({
      ...mockUseCallStore(),
      phase: 'connected',
      peerNick: 'bob',
      mediaType: 'audio',
      minimized: true,
      statusText: 'Call in progress',
    });

    const { getByText } = await render(<WebRTCCallModal />);

    await fireEvent.press(getByText('bob'));
    expect(mockRestoreCall).toHaveBeenCalled();
  });

  it('renders scoped badge when only-active-query mode hides global overlay', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'callMinimizedOnlyOnActiveQuery')
        return Promise.resolve(true);
      if (key === 'showCallNotification') return Promise.resolve(true);
      return Promise.resolve(false);
    });

    mockUseCallStore.mockReturnValue({
      ...mockUseCallStore(),
      phase: 'connected',
      peerNick: 'carol',
      networkId: 'net-1',
      mediaType: 'video',
      minimized: true,
      statusText: 'Connected',
    });

    const { getByText } = await render(
      <WebRTCCallModal
        activeTab={{ type: 'query', name: 'other', networkId: 'net-1' }}
      />,
    );

    await waitFor(async () => {
      expect(getByText('CALL')).toBeTruthy();
    });

    await fireEvent.press(getByText('CALL'));
    expect(mockRestoreCall).toHaveBeenCalled();
  });

  it('renders the full-screen video call and handles all controls', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: 'dave',
      mediaType: 'video',
      minimized: false,
      statusText: 'Connected',
      usingRelay: true,
      remoteStream: mockStream,
      localStream: mockStream,
    });

    const { UNSAFE_getAllByType, getByText } = await render(
      <WebRTCCallModal />,
    );

    expect(getByText('Video Call')).toBeTruthy();
    expect(getByText('Relay ready')).toBeTruthy();

    const buttons = UNSAFE_getAllByType(
      require('react-native').TouchableOpacity,
    );
    // Order: minimize, mute, camera, hangup.
    await fireEvent.press(buttons[0]);
    await fireEvent.press(buttons[1]);
    await fireEvent.press(buttons[2]);
    await fireEvent.press(buttons[3]);

    expect(mockMinimizeCall).toHaveBeenCalled();
    expect(mockToggleMute).toHaveBeenCalled();
    expect(mockToggleCamera).toHaveBeenCalled();
    expect(mockHangUp).toHaveBeenCalled();

    // onRequestClose hangs up the call.
    const modal = UNSAFE_getAllByType(Modal)[0];
    modal.props.onRequestClose();
    expect(mockHangUp).toHaveBeenCalledTimes(2);
  });

  it('renders the audio call placeholder without a camera control', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: 'erin',
      mediaType: 'audio',
      minimized: false,
      statusText: '',
      direction: 'incoming',
    });

    const { getByText, queryByText } = await render(<WebRTCCallModal />);

    expect(getByText('Audio Call')).toBeTruthy();
    expect(getByText('Audio call in progress')).toBeTruthy();
    // subtitle falls back to the direction-based label
    expect(getByText(/Incoming call/)).toBeTruthy();
    expect(queryByText('Video Call')).toBeNull();
  });

  it('shows the waiting-for-video placeholder when remote video is absent', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: 'frank',
      mediaType: 'video',
      minimized: false,
      statusText: 'Connected',
      remoteStream: null,
    });

    const { getByText } = await render(<WebRTCCallModal />);
    expect(getByText('Waiting for remote video...')).toBeTruthy();
  });

  it('renders the minimized video overlay with a remote stream', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: 'gina',
      mediaType: 'video',
      minimized: true,
      statusText: 'Connected',
      remoteStream: mockStream,
    });

    const { UNSAFE_getAllByType } = await render(<WebRTCCallModal />);
    const buttons = UNSAFE_getAllByType(
      require('react-native').TouchableOpacity,
    );
    // expand, hangup, and the full-surface restore touchable.
    await fireEvent.press(buttons[0]);
    await fireEvent.press(buttons[1]);
    await fireEvent.press(buttons[2]);

    expect(mockRestoreCall).toHaveBeenCalled();
    expect(mockHangUp).toHaveBeenCalled();
  });

  it('renders the minimized video overlay placeholder without a remote stream', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connecting',
      peerNick: 'hank',
      mediaType: 'video',
      minimized: true,
      statusText: '',
      remoteStream: null,
    });

    const { getAllByText, getByText } = await render(<WebRTCCallModal />);
    // peerNick appears in both the label and the placeholder title.
    expect(getAllByText('hank').length).toBeGreaterThan(0);
    expect(getByText('Connecting...')).toBeTruthy();
  });

  it('handles every action on the minimized audio overlay', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: 'ivan',
      mediaType: 'audio',
      minimized: true,
      micMuted: true,
      statusText: 'Call in progress',
    });

    const { UNSAFE_getAllByType } = await render(<WebRTCCallModal />);
    const buttons = UNSAFE_getAllByType(
      require('react-native').TouchableOpacity,
    );
    // avatar, info, expand (restore), hangup.
    await fireEvent.press(buttons[0]);
    await fireEvent.press(buttons[1]);
    await fireEvent.press(buttons[2]);
    await fireEvent.press(buttons[3]);

    expect(mockRestoreCall).toHaveBeenCalledTimes(3);
    expect(mockHangUp).toHaveBeenCalledTimes(1);
  });

  it('reacts to live setting changes for scope and notification', async () => {
    await render(<WebRTCCallModal />);

    await waitFor(() => {
      expect(settingCallbacks.callMinimizedOnlyOnActiveQuery).toBeDefined();
    });

    await act(async () => {
      settingCallbacks.callMinimizedOnlyOnActiveQuery(true);
      settingCallbacks.showCallNotification(false);
    });

    // No throw and callbacks are wired; the state updates are internal.
    expect(mockOnSettingChange).toHaveBeenCalled();
  });

  it('swallows notification errors while a call is active and on cleanup', async () => {
    mockShowNotif.mockRejectedValue(new Error('show fail'));
    mockCancelNotif.mockRejectedValue(new Error('cancel fail'));
    mockGetSetting.mockImplementation((key: string, def: any) => {
      if (key === 'showCallNotification') return Promise.resolve(true);
      return Promise.resolve(def);
    });

    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: 'jane',
      mediaType: 'audio',
      minimized: false,
      statusText: 'Connected',
    });

    const { unmount } = await render(<WebRTCCallModal />);

    await waitFor(() => {
      expect(mockShowNotif).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(mockCancelNotif).toHaveBeenCalled();
    });
  });

  it('cancels the notification when it is disabled or the call is idle', async () => {
    mockCancelNotif.mockRejectedValue(new Error('cancel fail'));

    // Idle call: no peerNick and non-active phase triggers the cancel branch.
    await render(<WebRTCCallModal />);

    await waitFor(() => {
      expect(mockCancelNotif).toHaveBeenCalled();
    });
  });

  it('drives the move and resize PanResponders for the minimized overlay', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: 'kyle',
      mediaType: 'video',
      minimized: true,
      statusText: 'Connected',
      remoteStream: mockStream,
    });

    await render(<WebRTCCallModal />);

    const moveConfig = [...capturedPanConfigs]
      .reverse()
      .find(c => typeof c.onPanResponderRelease === 'function');
    const resizeConfig = [...capturedPanConfigs]
      .reverse()
      .find(c => typeof c.onPanResponderRelease !== 'function');

    expect(moveConfig).toBeDefined();
    expect(resizeConfig).toBeDefined();

    // Move responder lifecycle (exercise both dx and dy gesture thresholds).
    expect(moveConfig.onStartShouldSetPanResponder()).toBe(true);
    expect(moveConfig.onMoveShouldSetPanResponder({}, { dx: 10, dy: 0 })).toBe(
      true,
    );
    expect(moveConfig.onMoveShouldSetPanResponder({}, { dx: 0, dy: 10 })).toBe(
      true,
    );
    expect(moveConfig.onMoveShouldSetPanResponder({}, { dx: 1, dy: 1 })).toBe(
      false,
    );
    moveConfig.onPanResponderGrant();
    moveConfig.onPanResponderMove({}, { dx: 5, dy: 5 });
    moveConfig.onPanResponderRelease({}, { dx: 0, dy: 20 });

    expect(mockUpdateOverlayPosition).toHaveBeenCalled();
    expect(mockSnapOverlayToEdge).toHaveBeenCalled();

    // Resize responder lifecycle.
    expect(resizeConfig.onStartShouldSetPanResponder()).toBe(true);
    expect(resizeConfig.onMoveShouldSetPanResponder({}, { dx: 5 })).toBe(true);
    expect(resizeConfig.onMoveShouldSetPanResponder({}, { dx: 1 })).toBe(false);
    resizeConfig.onPanResponderGrant();
    resizeConfig.onPanResponderMove({}, { dx: 10 });

    expect(mockUpdateVideoOverlayWidth).toHaveBeenCalled();
  });

  it('does not enable the PanResponders when not minimized', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: 'liam',
      mediaType: 'video',
      minimized: false,
      statusText: 'Connected',
      remoteStream: mockStream,
    });

    await render(<WebRTCCallModal />);

    const moveConfig = [...capturedPanConfigs]
      .reverse()
      .find(c => typeof c.onPanResponderRelease === 'function');
    const resizeConfig = [...capturedPanConfigs]
      .reverse()
      .find(c => typeof c.onPanResponderRelease !== 'function');

    expect(moveConfig.onStartShouldSetPanResponder()).toBe(false);
    expect(moveConfig.onMoveShouldSetPanResponder({}, { dx: 10, dy: 10 })).toBe(
      false,
    );
    expect(resizeConfig.onStartShouldSetPanResponder()).toBe(false);
    expect(resizeConfig.onMoveShouldSetPanResponder({}, { dx: 10 })).toBe(
      false,
    );
  });

  it('renders an incoming video call and accepts it', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'incoming',
      peerNick: null,
      mediaType: 'video',
      minimized: false,
      statusText: '',
      direction: 'incoming',
    });

    const { getByText, UNSAFE_getAllByType } = await render(
      <WebRTCCallModal />,
    );

    // peerNick fallbacks in the title and placeholder.
    expect(getByText('Unknown peer')).toBeTruthy();
    expect(getByText('Direct WebRTC')).toBeTruthy();

    const buttons = UNSAFE_getAllByType(
      require('react-native').TouchableOpacity,
    );
    // decline, accept (no minimize button for incoming).
    await fireEvent.press(buttons[0]);
    await fireEvent.press(buttons[1]);

    expect(mockDeclineIncomingCall).toHaveBeenCalled();
    expect(mockAcceptIncomingCall).toHaveBeenCalled();
  });

  it('renders muted mic and disabled camera icons in the controls', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: 'mona',
      mediaType: 'video',
      minimized: false,
      micMuted: true,
      cameraEnabled: false,
      statusText: 'Connected',
    });

    const { getByText } = await render(<WebRTCCallModal />);
    expect(getByText('Video Call')).toBeTruthy();
  });

  it('renders the minimized video overlay with fallback labels', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: null,
      mediaType: 'video',
      minimized: true,
      statusText: null,
      remoteStream: null,
    });

    const { getAllByText, getByText } = await render(<WebRTCCallModal />);
    expect(getAllByText('Video Call').length).toBeGreaterThan(0);
    expect(getByText('Connecting...')).toBeTruthy();
  });

  it('renders the minimized audio overlay with fallback labels', async () => {
    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: null,
      mediaType: 'audio',
      minimized: true,
      statusText: null,
    });

    const { getByText } = await render(<WebRTCCallModal />);
    expect(getByText('Audio Call')).toBeTruthy();
    expect(getByText('Call in progress')).toBeTruthy();
  });

  it('renders the scoped badge for an audio call', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'callMinimizedOnlyOnActiveQuery')
        return Promise.resolve(true);
      if (key === 'showCallNotification') return Promise.resolve(true);
      return Promise.resolve(false);
    });

    mockUseCallStore.mockReturnValue({
      ...baseStore,
      phase: 'connected',
      peerNick: 'nora',
      networkId: 'net-2',
      mediaType: 'audio',
      minimized: true,
      statusText: 'Connected',
    });

    const { getByText } = await render(
      <WebRTCCallModal
        activeTab={{ type: 'query', name: 'someone', networkId: 'net-2' }}
      />,
    );

    await waitFor(() => {
      expect(getByText('CALL')).toBeTruthy();
    });
  });
});
