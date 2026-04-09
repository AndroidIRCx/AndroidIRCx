/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { Alert, Modal, Switch } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MediaSection } from '../../../src/components/settings/sections/MediaSection';

jest.mock('../../../src/i18n/transifex', () => ({
  useT: jest.fn().mockReturnValue((k: string, params?: any) => {
    if (k === 'Current cache: {size} / Max: {max}') {
      return `Current cache: ${params?.size} / Max: ${params?.max}`;
    }
    if (k === 'Current: {quality}') {
      return `Current: ${params?.quality}`;
    }
    if (k === 'Current: {duration} seconds') {
      return `Current: ${params?.duration} seconds`;
    }
    return k;
  }),
}));

jest.mock('../../../src/services/MediaSettingsService', () => ({
  mediaSettingsService: {
    isMediaEnabled: jest.fn(),
    shouldShowEncryptionIndicator: jest.fn(),
    getAutoDownload: jest.fn(),
    getWiFiOnly: jest.fn(),
    getMaxCacheSize: jest.fn(),
    getMediaQuality: jest.fn(),
    getVideoQuality: jest.fn(),
    getCallVideoQuality: jest.fn(),
    getCallStunServers: jest.fn(),
    getCallTurnServerConfig: jest.fn(),
    getCallForceRelayOnly: jest.fn(),
    getCallNicklistCallActionsEnabled: jest.fn(),
    getVoiceMaxDuration: jest.fn(),
    setMediaEnabled: jest.fn(),
    setShowEncryptionIndicator: jest.fn(),
    setAutoDownload: jest.fn(),
    setWiFiOnly: jest.fn(),
    setMaxCacheSize: jest.fn(),
    setMediaQuality: jest.fn(),
    setVideoQuality: jest.fn(),
    setCallVideoQuality: jest.fn(),
    setCallStunServers: jest.fn(),
    setCallTurnServerConfig: jest.fn(),
    setCallForceRelayOnly: jest.fn(),
    setCallNicklistCallActionsEnabled: jest.fn(),
    setVoiceMaxDuration: jest.fn(),
  },
}));

jest.mock('../../../src/services/CallMediaProfileService', () => ({
  callMediaProfileService: {
    getCapabilityProfile: jest.fn(),
  },
}));

jest.mock('../../../src/services/SettingsService', () => ({
  settingsService: {
    getSetting: jest.fn(),
    setSetting: jest.fn(),
  },
}));

jest.mock('../../../src/services/MediaCacheService', () => ({
  mediaCacheService: {
    getCacheSize: jest.fn(),
    clearCache: jest.fn(),
  },
}));

jest.mock('../../../src/components/settings/SettingItem', () => ({
  SettingItem: ({ item, onPress }: any) => (
    <>
      {(() => {
        const { Switch, TouchableOpacity, Text } = require('react-native');
        return item.type === 'switch' ? (
          <>
            <Text>{item.title}</Text>
            {item.description ? <Text>{item.description}</Text> : null}
            <Switch
              value={!!item.value}
              onValueChange={(v: boolean) => item.onValueChange?.(v)}
            />
          </>
        ) : (
          <TouchableOpacity
            onPress={() => (item.onPress ? item.onPress() : onPress?.(item.id))}
          >
            <Text>{item.title}</Text>
            {item.description ? <Text>{item.description}</Text> : null}
          </TouchableOpacity>
        );
      })()}
    </>
  ),
}));

import { mediaSettingsService } from '../../../src/services/MediaSettingsService';
import { mediaCacheService } from '../../../src/services/MediaCacheService';
import { callMediaProfileService } from '../../../src/services/CallMediaProfileService';
import { settingsService } from '../../../src/services/SettingsService';

const mockSettings = mediaSettingsService as unknown as Record<
  string,
  jest.Mock
>;
const mockCache = mediaCacheService as unknown as Record<string, jest.Mock>;
const mockCallMediaProfile = callMediaProfileService as unknown as Record<
  string,
  jest.Mock
>;
const mockAppSettings = settingsService as unknown as Record<string, jest.Mock>;

describe('MediaSection', () => {
  const colors = {
    text: '#000',
    textSecondary: '#666',
    primary: '#0af',
    surface: '#fff',
    border: '#ddd',
    background: '#eee',
  };

  const styles = {
    settingItem: {},
    settingContent: {},
    settingTitleRow: {},
    settingTitle: {},
    settingDescription: {},
    disabledItem: {},
    disabledText: {},
    chevron: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockSettings.isMediaEnabled.mockResolvedValue(true);
    mockSettings.shouldShowEncryptionIndicator.mockResolvedValue(true);
    mockSettings.getAutoDownload.mockResolvedValue(true);
    mockSettings.getWiFiOnly.mockResolvedValue(false);
    mockSettings.getMaxCacheSize.mockResolvedValue(250 * 1024 * 1024);
    mockSettings.getMediaQuality.mockResolvedValue('original');
    mockSettings.getVideoQuality.mockResolvedValue('1080p');
    mockSettings.getCallVideoQuality.mockResolvedValue('480p');
    mockSettings.getCallStunServers.mockResolvedValue([
      'stun:turn.dbase.in.rs:3478',
      'stun:stun.l.google.com:19302',
    ]);
    mockSettings.getCallTurnServerConfig.mockResolvedValue({
      enabled: false,
      urls: [],
      username: '',
      credential: '',
    });
    mockSettings.getCallForceRelayOnly.mockResolvedValue(false);
    mockSettings.getCallNicklistCallActionsEnabled.mockResolvedValue(false);
    mockSettings.getVoiceMaxDuration.mockResolvedValue(180);
    mockCache.getCacheSize.mockResolvedValue(1024);
    mockCache.clearCache.mockResolvedValue({
      clearedCount: 1,
      freedSpace: 1024,
    });
    mockAppSettings.getSetting.mockResolvedValue(false);
    mockAppSettings.setSetting.mockResolvedValue(undefined);
    mockCallMediaProfile.getCapabilityProfile.mockReturnValue({
      relayEnabled: false,
      allowedVideoQualities: ['480p', '720p'],
      defaultVideoQuality: '480p',
    });
  });

  it('renders media setting entries', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    await waitFor(() => {
      expect(getByText('Enable Encrypted Media Sharing')).toBeTruthy();
      expect(getByText('Clear Media Cache')).toBeTruthy();
    });
  });

  it('toggles media enabled switch and persists', async () => {
    const { UNSAFE_getAllByType } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    await waitFor(() => {
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'valueChange', false);
      expect(mockSettings.setMediaEnabled).toHaveBeenCalledWith(false);
    });
  });

  it('opens cache submenu and closes it', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    fireEvent.press(getByText('Maximum Cache Size'));
    await waitFor(() => {
      expect(getByText('Close')).toBeTruthy();
    });
    fireEvent.press(getByText('Close'));
  });

  it('updates cache max size by submenu action', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    fireEvent.press(getByText('Maximum Cache Size'));
    await waitFor(() => {
      fireEvent.press(getByText('500 MB'));
    });

    await waitFor(() => {
      expect(mockSettings.setMaxCacheSize).toHaveBeenCalled();
    });
  });

  it('selects additional cache size presets', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );
    fireEvent.press(getByText('Maximum Cache Size'));
    await waitFor(() => {
      fireEvent.press(getByText('250 MB'));
    });
    fireEvent.press(getByText('Maximum Cache Size'));
    await waitFor(() => {
      fireEvent.press(getByText('1 GB'));
    });
    await waitFor(() => {
      expect(mockSettings.setMaxCacheSize).toHaveBeenCalledWith(
        250 * 1024 * 1024,
      );
      expect(mockSettings.setMaxCacheSize).toHaveBeenCalledWith(
        1024 * 1024 * 1024,
      );
    });
  });

  it('updates media quality from submenu', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    await waitFor(() => {
      expect(mockSettings.setMediaQuality).toHaveBeenCalledWith('original');
    });
    mockSettings.setMediaQuality.mockClear();

    fireEvent.press(getByText('Media Quality'));
    await waitFor(() => {
      fireEvent.press(getByText('Low'));
    });
    await waitFor(() => {
      expect(mockSettings.setMediaQuality).toHaveBeenCalledWith('low');
    });
  });

  it('updates video quality from submenu', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );
    await waitFor(() => {
      expect(mockSettings.setVideoQuality).toHaveBeenCalledWith('1080p');
    });
    mockSettings.setVideoQuality.mockClear();

    fireEvent.press(getByText('Video Recording Quality'));
    await waitFor(() => {
      fireEvent.press(getByText('720p'));
    });
    await waitFor(() => {
      expect(mockSettings.setVideoQuality).toHaveBeenCalledWith('720p');
    });
  });

  it('limits live call quality options for free users', async () => {
    const { getByText, queryByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    fireEvent.press(getByText('Live Call Video Quality'));
    await waitFor(() => {
      expect(getByText('720p')).toBeTruthy();
      expect(queryByText('1440p')).toBeNull();
    });
  });

  it('shows HD live call quality options for Privacy Relay subscribers', async () => {
    mockCallMediaProfile.getCapabilityProfile.mockReturnValue({
      relayEnabled: true,
      allowedVideoQualities: ['480p', '720p', '1080p', '1440p'],
      defaultVideoQuality: '1080p',
    });
    mockSettings.getCallVideoQuality.mockResolvedValue('1080p');

    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    await waitFor(() => {
      expect(mockSettings.setCallVideoQuality).toHaveBeenCalledWith('1080p');
    });
    mockSettings.setCallVideoQuality.mockClear();

    fireEvent.press(getByText('Live Call Video Quality'));
    await waitFor(() => {
      fireEvent.press(getByText('1440p'));
    });

    await waitFor(() => {
      expect(mockSettings.setCallVideoQuality).toHaveBeenCalledWith('1440p');
    });
  });

  it('updates additional video quality presets', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );
    fireEvent.press(getByText('Video Recording Quality'));
    await waitFor(() => {
      fireEvent.press(getByText('4K'));
    });
    fireEvent.press(getByText('Video Recording Quality'));
    await waitFor(() => {
      fireEvent.press(getByText('480p'));
    });
    await waitFor(() => {
      expect(mockSettings.setVideoQuality).toHaveBeenCalledWith('480p');
    });
  });

  it('updates free-call STUN servers from list editor', async () => {
    const { getByText, getByPlaceholderText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    fireEvent.press(getByText('Free Call STUN Servers'));
    await waitFor(() => {
      expect(getByText('stun:turn.dbase.in.rs:3478')).toBeTruthy();
    });

    fireEvent.changeText(
      getByPlaceholderText('stun:stun.l.google.com:19302'),
      'stun:new.example.org:3478',
    );
    fireEvent.press(getByText('Add'));

    await waitFor(() => {
      expect(mockSettings.setCallStunServers).toHaveBeenLastCalledWith([
        'stun:turn.dbase.in.rs:3478',
        'stun:stun.l.google.com:19302',
        'stun:new.example.org:3478',
      ]);
    });
  });

  it('shows validation for invalid STUN entries and does not add them', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    fireEvent.press(getByText('Free Call STUN Servers'));
    await waitFor(() => {
      expect(getByText('STUN Servers')).toBeTruthy();
    });

    fireEvent.changeText(
      getByPlaceholderText('stun:stun.l.google.com:19302'),
      'http://bad.example.org',
    );
    fireEvent.press(getByText('Add'));

    await waitFor(() => {
      expect(getByText('STUN must start with stun:')).toBeTruthy();
      expect(queryByText('http://bad.example.org')).toBeNull();
    });
  });

  it('does not add duplicate STUN server entries', async () => {
    const { getByText, getByPlaceholderText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    fireEvent.press(getByText('Free Call STUN Servers'));
    await waitFor(() => {
      expect(getByText('STUN Servers')).toBeTruthy();
    });

    fireEvent.changeText(
      getByPlaceholderText('stun:stun.l.google.com:19302'),
      'stun:turn.dbase.in.rs:3478',
    );
    fireEvent.press(getByText('Add'));

    await waitFor(() => {
      expect(mockSettings.setCallStunServers).toHaveBeenLastCalledWith([
        'stun:turn.dbase.in.rs:3478',
        'stun:stun.l.google.com:19302',
      ]);
    });
  });

  it('updates external TURN config from list editor inputs', async () => {
    mockSettings.getCallTurnServerConfig.mockResolvedValueOnce({
      enabled: true,
      urls: ['turn:relay.example.net:3478?transport=udp'],
      username: 'relay-user',
      credential: 'relay-pass',
    });

    const { getByText, getByPlaceholderText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    fireEvent.press(getByText('External TURN Server'));
    await waitFor(() => {
      expect(
        getByText('turn:relay.example.net:3478?transport=udp'),
      ).toBeTruthy();
    });

    fireEvent.changeText(
      getByPlaceholderText('turn:turn.example.com:3478?transport=udp'),
      'turns:relay.example.net:5349?transport=tcp',
    );
    fireEvent.press(getByText('Add'));
    fireEvent.changeText(getByPlaceholderText('username'), 'relay-user');
    fireEvent.changeText(getByPlaceholderText('credential'), 'relay-pass');

    await waitFor(() => {
      expect(mockSettings.setCallTurnServerConfig).toHaveBeenLastCalledWith({
        enabled: true,
        urls: [
          'turn:relay.example.net:3478?transport=udp',
          'turns:relay.example.net:5349?transport=tcp',
        ],
        username: 'relay-user',
        credential: 'relay-pass',
      });
    });
  });

  it('persists relay-only and nick-menu call action settings from loaded values', async () => {
    mockSettings.getCallForceRelayOnly.mockResolvedValueOnce(true);
    mockSettings.getCallNicklistCallActionsEnabled.mockResolvedValueOnce(true);

    render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    await waitFor(() => {
      expect(mockSettings.setCallForceRelayOnly).toHaveBeenCalledWith(true);
      expect(
        mockSettings.setCallNicklistCallActionsEnabled,
      ).toHaveBeenCalledWith(true);
    });
  });

  it('toggles ongoing call notification and persists app setting', async () => {
    mockAppSettings.getSetting
      .mockResolvedValueOnce(true) // showCallNotification
      .mockResolvedValueOnce(false); // callMinimizedOnlyOnActiveQuery

    const { UNSAFE_getAllByType } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    await waitFor(() => {
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[6], 'valueChange', false);
    });

    await waitFor(() => {
      expect(mockAppSettings.setSetting).toHaveBeenCalledWith(
        'showCallNotification',
        false,
      );
    });
  });

  it('toggles active-query minimized call overlay and persists app setting', async () => {
    mockAppSettings.getSetting
      .mockResolvedValueOnce(true) // showCallNotification
      .mockResolvedValueOnce(false); // callMinimizedOnlyOnActiveQuery

    const { UNSAFE_getAllByType } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    await waitFor(() => {
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[7], 'valueChange', true);
    });

    await waitFor(() => {
      expect(mockAppSettings.setSetting).toHaveBeenCalledWith(
        'callMinimizedOnlyOnActiveQuery',
        true,
      );
    });
  });

  it('reorders and removes STUN servers from list editor', async () => {
    const { getByText, getByLabelText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    fireEvent.press(getByText('Free Call STUN Servers'));

    await waitFor(() => {
      expect(getByText('stun:turn.dbase.in.rs:3478')).toBeTruthy();
      expect(getByText('stun:stun.l.google.com:19302')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('stun-server-down-0'));

    await waitFor(() => {
      expect(mockSettings.setCallStunServers).toHaveBeenLastCalledWith([
        'stun:stun.l.google.com:19302',
        'stun:turn.dbase.in.rs:3478',
      ]);
    });

    fireEvent.press(getByLabelText('stun-server-remove-1'));

    await waitFor(() => {
      expect(mockSettings.setCallStunServers).toHaveBeenLastCalledWith([
        'stun:stun.l.google.com:19302',
      ]);
    });
  });

  it('shows validation for invalid TURN entry and does not add it', async () => {
    const { getByText, getByPlaceholderText, queryByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    fireEvent.press(getByText('External TURN Server'));
    await waitFor(() => {
      expect(getByText('TURN Servers')).toBeTruthy();
    });

    fireEvent.changeText(
      getByPlaceholderText('turn:turn.example.com:3478?transport=udp'),
      'http://bad-turn.example.org',
    );
    fireEvent.press(getByText('Add'));

    await waitFor(() => {
      expect(getByText('TURN must start with turn: or turns:')).toBeTruthy();
      expect(queryByText('http://bad-turn.example.org')).toBeNull();
    });
  });

  it('does not add duplicate TURN server entries', async () => {
    mockSettings.getCallTurnServerConfig.mockResolvedValueOnce({
      enabled: true,
      urls: ['turn:relay.example.net:3478?transport=udp'],
      username: 'relay-user',
      credential: 'relay-pass',
    });

    const { getByText, getByPlaceholderText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    fireEvent.press(getByText('External TURN Server'));
    await waitFor(() => {
      expect(getByText('TURN Servers')).toBeTruthy();
    });

    fireEvent.changeText(
      getByPlaceholderText('turn:turn.example.com:3478?transport=udp'),
      'turn:relay.example.net:3478?transport=udp',
    );
    fireEvent.press(getByText('Add'));

    await waitFor(() => {
      expect(mockSettings.setCallTurnServerConfig).toHaveBeenLastCalledWith({
        enabled: true,
        urls: ['turn:relay.example.net:3478?transport=udp'],
        username: 'relay-user',
        credential: 'relay-pass',
      });
    });
  });

  it('updates max voice duration from submenu', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );
    await waitFor(() => {
      expect(mockSettings.setVoiceMaxDuration).toHaveBeenCalledWith(180);
    });
    mockSettings.setVoiceMaxDuration.mockClear();

    fireEvent.press(getByText('Max Voice Message Duration'));
    await waitFor(() => {
      fireEvent.press(getByText('1 minute'));
    });
    await waitFor(() => {
      expect(mockSettings.setVoiceMaxDuration).toHaveBeenCalledWith(60);
    });
  });

  it('updates additional voice duration presets', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );
    fireEvent.press(getByText('Max Voice Message Duration'));
    await waitFor(() => {
      fireEvent.press(getByText('3 minutes'));
    });
    fireEvent.press(getByText('Max Voice Message Duration'));
    await waitFor(() => {
      fireEvent.press(getByText('5 minutes'));
    });
    await waitFor(() => {
      expect(mockSettings.setVoiceMaxDuration).toHaveBeenCalledWith(300);
    });
  });

  it('triggers clear cache confirmation flow', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );
    fireEvent.press(getByText('Clear Media Cache'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  it('executes clear-cache confirm action successfully', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );
    fireEvent.press(getByText('Clear Media Cache'));

    await waitFor(() => {
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = alertCall[2];
      const confirm = buttons.find((b: any) => b.style === 'destructive');
      expect(confirm).toBeTruthy();
      confirm.onPress();
    });

    await waitFor(() => {
      expect(mockCache.clearCache).toHaveBeenCalled();
    });
  });

  it('toggles auto-download and wifi-only settings', async () => {
    const { UNSAFE_getAllByType } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    await waitFor(() => {
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[2], 'valueChange', false); // auto-download
      fireEvent(switches[3], 'valueChange', true); // wifi-only
      expect(mockSettings.setAutoDownload).toHaveBeenCalledWith(false);
      expect(mockSettings.setWiFiOnly).toHaveBeenCalledWith(true);
    });
  });

  it('handles clear-cache confirm error path', async () => {
    mockCache.clearCache.mockRejectedValueOnce(new Error('boom'));
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );
    fireEvent.press(getByText('Clear Media Cache'));

    await waitFor(() => {
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = alertCall[2];
      const confirm = buttons.find((b: any) => b.style === 'destructive');
      confirm.onPress();
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to clear cache: {error}',
      );
    });
  });

  it('formats cache labels for bytes and KB max', async () => {
    mockCache.getCacheSize.mockResolvedValueOnce(512);
    mockSettings.getMaxCacheSize.mockResolvedValueOnce(512 * 1024);

    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    await waitFor(() => {
      expect(getByText('Current cache: 512 B / Max: 512 KB')).toBeTruthy();
    });
  });

  it('formats cache labels for GB and disabled-media description branch', async () => {
    mockSettings.isMediaEnabled.mockResolvedValueOnce(false);
    mockCache.getCacheSize.mockResolvedValueOnce(2 * 1024 * 1024 * 1024);

    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    await waitFor(() => {
      expect(
        getByText(
          'Media sharing is disabled. Attachment button will not appear.',
        ),
      ).toBeTruthy();
      expect(getByText('Current cache: 2.0 GB / Max: 250 MB')).toBeTruthy();
    });
  });

  it('closes submenu through modal requestClose callback', async () => {
    const { getByText, UNSAFE_getByType } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />,
    );

    fireEvent.press(getByText('Maximum Cache Size'));
    await waitFor(() => {
      expect(getByText('Close')).toBeTruthy();
    });
    fireEvent(UNSAFE_getByType(Modal), 'requestClose');
    await waitFor(() => {
      expect(getByText('Maximum Cache Size')).toBeTruthy();
    });
  });
});
