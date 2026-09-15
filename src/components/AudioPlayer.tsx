/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/localization';

interface AudioPlayerProps {
  url: string;
  label?: string;
}

const normalizeAudioUri = (value: string): string => value?.trim?.() || '';

const isSupportedAudioUri = (uri: string): boolean =>
  /^(https?:\/\/|file:\/\/|content:\/\/)/i.test(uri);

const getPlaybackError = (event: any, fallback: string): string => {
  const error =
    event?.error?.errorString ||
    event?.nativeEvent?.error ||
    event?.error?.localizedDescription;

  return typeof error === 'string' && error ? error : fallback;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ url, label }) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const safeUrl = useMemo(() => normalizeAudioUri(url), [url]);
  const sourceError = useMemo(() => {
    if (!safeUrl) {
      return t('Invalid audio source');
    }
    if (!isSupportedAudioUri(safeUrl)) {
      return t('Unsupported audio source');
    }
    return null;
  }, [safeUrl, t]);
  const [playerMounted, setPlayerMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    setPlayerMounted(false);
    setLoading(false);
    setPlaybackError(null);
    setPaused(true);
  }, [safeUrl]);

  const error = sourceError || playbackError;

  const handleTogglePlayback = () => {
    if (sourceError) {
      return;
    }

    if (!playerMounted || playbackError) {
      setPlaybackError(null);
      setPlayerMounted(true);
      setLoading(true);
      setPaused(false);
      return;
    }

    setPaused(current => !current);
  };

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      {playerMounted && loading && !error && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {error ? (
        <Text style={styles.error}>{t('Audio error: {error}', { error })}</Text>
      ) : playerMounted ? (
        <Video
          source={{ uri: safeUrl }}
          controls
          paused={paused}
          onLoad={() => setLoading(false)}
          onError={e => {
            setLoading(false);
            setPaused(true);
            setPlaybackError(getPlaybackError(e, t('Failed to load audio')));
          }}
          style={styles.audioDummy}
        />
      ) : null}
      <TouchableOpacity
        style={[styles.pauseButton, sourceError && styles.pauseButtonDisabled]}
        onPress={handleTogglePlayback}
        disabled={Boolean(sourceError)}
      >
        <Text style={styles.pauseText}>
          {sourceError
            ? t('Unavailable')
            : playbackError
              ? t('Retry')
              : paused
                ? t('Play')
                : t('Pause')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      marginVertical: 8,
      backgroundColor: colors.surfaceVariant,
      borderRadius: 8,
      padding: 8,
    },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    loading: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 28,
    },
    error: {
      color: colors.error,
      padding: 4,
    },
    audioDummy: {
      height: 0,
      width: 0,
      opacity: 0,
    },
    pauseButton: {
      paddingVertical: 8,
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 6,
    },
    pauseButtonDisabled: {
      opacity: 0.6,
    },
    pauseText: {
      color: colors.text,
      fontWeight: '600',
    },
  });
