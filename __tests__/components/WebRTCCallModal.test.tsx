import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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
    declineIncomingCall: (...args: unknown[]) => mockDeclineIncomingCall(...args),
    acceptIncomingCall: (...args: unknown[]) => mockAcceptIncomingCall(...args),
    toggleMute: (...args: unknown[]) => mockToggleMute(...args),
    toggleCamera: (...args: unknown[]) => mockToggleCamera(...args),
    hangUp: (...args: unknown[]) => mockHangUp(...args),
    minimizeCall: (...args: unknown[]) => mockMinimizeCall(...args),
    restoreCall: (...args: unknown[]) => mockRestoreCall(...args),
    updateOverlayPosition: (...args: unknown[]) => mockUpdateOverlayPosition(...args),
    snapOverlayToEdge: (...args: unknown[]) => mockSnapOverlayToEdge(...args),
    updateVideoOverlayWidth: (...args: unknown[]) => mockUpdateVideoOverlayWidth(...args),
  },
}));

jest.mock('../../src/services/NotificationService', () => ({
  notificationService: {
    showOngoingCallNotification: (...args: unknown[]) => mockShowNotif(...args),
    cancelOngoingCallNotification: (...args: unknown[]) => mockCancelNotif(...args),
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

describe('WebRTCCallModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockImplementation((key: string, def: any) => Promise.resolve(def));
    mockOnSettingChange.mockImplementation(() => () => {});
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

  it('renders nothing when call is idle', () => {
    const { queryByText } = render(<WebRTCCallModal />);
    expect(queryByText('Audio Call')).toBeNull();
    expect(queryByText('Video Call')).toBeNull();
  });

  it('renders incoming call controls and handles accept/decline', () => {
    mockUseCallStore.mockReturnValue({
      ...mockUseCallStore(),
      phase: 'incoming',
      peerNick: 'alice',
      mediaType: 'audio',
      minimized: false,
      statusText: 'Incoming call',
    });

    const { UNSAFE_getAllByType } = render(<WebRTCCallModal />);
    const buttons = UNSAFE_getAllByType(require('react-native').TouchableOpacity);

    fireEvent.press(buttons[0]);
    fireEvent.press(buttons[1]);

    expect(mockDeclineIncomingCall).toHaveBeenCalled();
    expect(mockAcceptIncomingCall).toHaveBeenCalled();
  });

  it('renders minimized audio overlay actions', () => {
    mockUseCallStore.mockReturnValue({
      ...mockUseCallStore(),
      phase: 'connected',
      peerNick: 'bob',
      mediaType: 'audio',
      minimized: true,
      statusText: 'Call in progress',
    });

    const { getByText } = render(<WebRTCCallModal />);

    fireEvent.press(getByText('bob'));
    expect(mockRestoreCall).toHaveBeenCalled();
  });

  it('renders scoped badge when only-active-query mode hides global overlay', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'callMinimizedOnlyOnActiveQuery') return Promise.resolve(true);
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

    const { getByText } = render(
      <WebRTCCallModal activeTab={{ type: 'query', name: 'other', networkId: 'net-1' }} />
    );

    await waitFor(() => {
      expect(getByText('CALL')).toBeTruthy();
    });

    fireEvent.press(getByText('CALL'));
    expect(mockRestoreCall).toHaveBeenCalled();
  });
});
