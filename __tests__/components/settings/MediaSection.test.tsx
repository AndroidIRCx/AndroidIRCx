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
    getVoiceMaxDuration: jest.fn(),
    setMediaEnabled: jest.fn(),
    setShowEncryptionIndicator: jest.fn(),
    setAutoDownload: jest.fn(),
    setWiFiOnly: jest.fn(),
    setMaxCacheSize: jest.fn(),
    setMediaQuality: jest.fn(),
    setVideoQuality: jest.fn(),
    setVoiceMaxDuration: jest.fn(),
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
            <Switch value={!!item.value} onValueChange={(v: boolean) => item.onValueChange?.(v)} />
          </>
        ) : (
          <TouchableOpacity onPress={() => (item.onPress ? item.onPress() : onPress?.(item.id))}>
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

const mockSettings = mediaSettingsService as unknown as Record<string, jest.Mock>;
const mockCache = mediaCacheService as unknown as Record<string, jest.Mock>;

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
    mockSettings.getVoiceMaxDuration.mockResolvedValue(180);
    mockCache.getCacheSize.mockResolvedValue(1024);
    mockCache.clearCache.mockResolvedValue({ clearedCount: 1, freedSpace: 1024 });
  });

  it('renders media setting entries', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
    );

    await waitFor(() => {
      expect(getByText('Enable Encrypted Media Sharing')).toBeTruthy();
      expect(getByText('Clear Media Cache')).toBeTruthy();
    });
  });

  it('toggles media enabled switch and persists', async () => {
    const { UNSAFE_getAllByType } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
    );

    await waitFor(() => {
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'valueChange', false);
      expect(mockSettings.setMediaEnabled).toHaveBeenCalledWith(false);
    });
  });

  it('opens cache submenu and closes it', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
    );

    fireEvent.press(getByText('Maximum Cache Size'));
    await waitFor(() => {
      expect(getByText('Close')).toBeTruthy();
    });
    fireEvent.press(getByText('Close'));
  });

  it('updates cache max size by submenu action', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
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
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
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
      expect(mockSettings.setMaxCacheSize).toHaveBeenCalledWith(250 * 1024 * 1024);
      expect(mockSettings.setMaxCacheSize).toHaveBeenCalledWith(1024 * 1024 * 1024);
    });
  });

  it('updates media quality from submenu', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
    );

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
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
    fireEvent.press(getByText('Video Recording Quality'));
    await waitFor(() => {
      fireEvent.press(getByText('720p'));
    });
    await waitFor(() => {
      expect(mockSettings.setVideoQuality).toHaveBeenCalledWith('720p');
    });
  });

  it('updates additional video quality presets', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
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

  it('updates max voice duration from submenu', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
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
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
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
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
    fireEvent.press(getByText('Clear Media Cache'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  it('executes clear-cache confirm action successfully', async () => {
    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
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
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
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
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
    );
    fireEvent.press(getByText('Clear Media Cache'));

    await waitFor(() => {
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = alertCall[2];
      const confirm = buttons.find((b: any) => b.style === 'destructive');
      confirm.onPress();
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to clear cache: {error}');
    });
  });

  it('formats cache labels for bytes and KB max', async () => {
    mockCache.getCacheSize.mockResolvedValueOnce(512);
    mockSettings.getMaxCacheSize.mockResolvedValueOnce(512 * 1024);

    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
    );

    await waitFor(() => {
      expect(getByText('Current cache: 512 B / Max: 512 KB')).toBeTruthy();
    });
  });

  it('formats cache labels for GB and disabled-media description branch', async () => {
    mockSettings.isMediaEnabled.mockResolvedValueOnce(false);
    mockCache.getCacheSize.mockResolvedValueOnce(2 * 1024 * 1024 * 1024);

    const { getByText } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
    );

    await waitFor(() => {
      expect(
        getByText('Media sharing is disabled. Attachment button will not appear.')
      ).toBeTruthy();
      expect(getByText('Current cache: 2.0 GB / Max: 250 MB')).toBeTruthy();
    });
  });

  it('closes submenu through modal requestClose callback', async () => {
    const { getByText, UNSAFE_getByType } = render(
      <MediaSection colors={colors} styles={styles as any} settingIcons={{}} />
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
