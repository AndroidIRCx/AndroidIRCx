import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Video from 'react-native-video';
import { useTheme } from '../hooks/useTheme';

interface AudioPlayerProps {
  url: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ url }) => {
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
        <Text style={styles.error}>Audio error: {error}</Text>
      ) : (
        <Video
          source={{ uri: url }}
          audioOnly
          controls
          paused={paused}
          onLoad={() => setLoading(false)}
          onError={(e) => {
            setLoading(false);
            setError(e?.error?.errorString || 'Failed to load audio');
          }}
          style={styles.audioDummy}
        />
      )}
      <TouchableOpacity style={styles.pauseButton} onPress={() => setPaused((p) => !p)}>
        <Text style={styles.pauseText}>{paused ? 'Play' : 'Pause'}</Text>
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
