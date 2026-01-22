import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Video from 'react-native-video';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';

interface AudioPlayerProps {
  url: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ url }) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);

  return (
    <View style={styles.container}>
      {loading && !error && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {error ? (
        <Text style={styles.error}>{t('Audio error: {error}', { error })}</Text>
      ) : (
        <Video
          source={{ uri: url }}
          controls
          paused={paused}
          onLoad={() => setLoading(false)}
          onError={(e) => {
            setLoading(false);
            setError(e?.error?.errorString || t('Failed to load audio'));
          }}
          style={styles.audioDummy}
        />
      )}
      <TouchableOpacity style={styles.pauseButton} onPress={() => setPaused((p) => !p)}>
        <Text style={styles.pauseText}>{paused ? t('Play') : t('Pause')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    marginVertical: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 8,
    padding: 8,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
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
  pauseText: {
    color: colors.text,
    fontWeight: '600',
  },
});
