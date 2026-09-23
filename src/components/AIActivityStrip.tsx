/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/localization';
import { AIActivity } from '../stores/uiStore';

/**
 * What AI is doing in this tab, in the same place and shape as the typing
 * indicator — a thin strip between the messages and the composer.
 *
 * Deliberately not a row in the message list. This is the one spot in the app
 * that already means "something transient is happening in this conversation",
 * it cannot scroll away from the person waiting on it, and reusing it means
 * nothing new to learn.
 */

interface Props {
  activity: AIActivity;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Which layer a failure came from, in words.
 *
 * `AIError` has carried a typed code since the first version and nothing ever
 * rendered it, so "no network", "the provider refused" and "a limit here" all
 * reached the user as the same grey sentence — with no way to tell whether to
 * check their signal, their API key, or simply wait.
 */
const KIND_LABELS: Record<string, string> = {
  network: 'No connection',
  timeout: 'The provider timed out',
  auth_failed: 'The API key was rejected',
  rate_limited: 'Rate limited',
  quota_exceeded: 'Daily limit reached',
  provider_error: 'The provider refused',
  missing_key: 'No API key',
  consent_required: 'Not agreed yet',
  channel_not_allowed: 'AI is off for this channel',
  disabled: 'AI is switched off',
  no_provider: 'No provider set up',
  prompt_too_long: 'Too much to send',
};

export const AIActivityStrip: React.FC<Props> = ({
  activity,
  onRetry,
  onDismiss,
}) => {
  const { colors } = useTheme();
  const t = useT();
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [fade]);

  const working = activity.state === 'working';

  useEffect(() => {
    if (!working) return;
    // The same three dots as the typing indicator, breathing, so it reads as
    // "in progress" rather than "stuck".
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [working, pulse]);

  const kind = activity.kind ? KIND_LABELS[activity.kind] : undefined;

  return (
    <Animated.View
      testID="ai-activity-strip"
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: working ? colors.border : colors.warning,
          opacity: fade,
        },
      ]}
    >
      {working ? (
        <View style={styles.dots}>
          {[0, 1, 2].map(index => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: colors.primary, opacity: pulse },
              ]}
            />
          ))}
        </View>
      ) : (
        <Text style={[styles.mark, { color: colors.warning }]}>!</Text>
      )}

      <View style={styles.body}>
        {!working && kind && (
          <Text style={[styles.kind, { color: colors.warning }]}>{kind}</Text>
        )}
        <Text
          style={[
            styles.text,
            { color: colors.textSecondary },
            working && styles.working,
          ]}
          numberOfLines={2}
        >
          {activity.text}
        </Text>
      </View>

      {!working && (
        <>
          {!!activity.retry && (
            <TouchableOpacity onPress={onRetry} style={styles.action}>
              <Text style={[styles.actionText, { color: colors.primary }]}>
                {t('Retry')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onDismiss} style={styles.action}>
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>
              {t('Dismiss')}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  dots: { flexDirection: 'row', marginRight: 8, gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  mark: { marginRight: 10, fontSize: 14, fontWeight: '700' },
  body: { flex: 1 },
  kind: { fontSize: 11.5, fontWeight: '700' },
  text: { fontSize: 12 },
  working: { fontStyle: 'italic' },
  action: { paddingHorizontal: 8, paddingVertical: 4 },
  actionText: { fontSize: 12.5, fontWeight: '700' },
});
