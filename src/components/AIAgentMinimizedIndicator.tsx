/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/localization';
import { AgentActivity, agentService } from '../services/ai/AgentService';
import { useUIStore } from '../stores/uiStore';

/**
 * The bubble a minimised assistant leaves behind.
 *
 * Minimising is not closing: the conversation, and any turn still running,
 * carry on. This is how the user sees that — what it is doing right now, or
 * that an answer is waiting — and how they get back to it in one tap, from
 * wherever they were.
 *
 * Rendered both in the main view and inside Settings, because Settings is a
 * modal window of its own and would otherwise cover the bubble just when the
 * user went there to ask something.
 */
export const AIAgentMinimizedIndicator: React.FC = () => {
  const { colors } = useTheme();
  const t = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const minimized = useUIStore(state => state.aiAgentMinimized);
  const open = useUIStore(state => state.showAIAgent);
  const [activity, setActivity] = useState<AgentActivity>(() =>
    agentService.currentActivity(),
  );
  /** A turn finished while minimised, so there is something new to read. */
  const [ready, setReady] = useState(false);
  const wasBusy = useRef(agentService.isBusy());

  useEffect(() => {
    if (!minimized) return;
    setActivity(agentService.currentActivity());
    wasBusy.current = agentService.isBusy();
    return agentService.onActivity(next => {
      setActivity(next);
      if (next.kind === 'idle' && wasBusy.current) setReady(true);
      wasBusy.current = next.kind !== 'idle';
    });
  }, [minimized]);

  useEffect(() => {
    if (open) setReady(false);
  }, [open]);

  if (!minimized || open) return null;

  const busy = activity.kind !== 'idle';
  const status =
    activity.kind === 'tool'
      ? t('Running {tool}…', { tool: activity.label })
      : activity.kind === 'compacting'
        ? t('Summarising earlier messages…')
        : activity.kind === 'thinking'
          ? t('Thinking…')
          : ready
            ? t('Answer ready — tap to read it')
            : t('Tap to return to the conversation');

  const reopen = () => {
    const store = useUIStore.getState();
    store.setAIAgentMinimized(false);
    store.setShowAIAgent(true);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={reopen}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${t('Assistant')}: ${status}`}
    >
      {busy ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <View style={[styles.dot, ready && styles.dotReady]} />
      )}
      <View style={styles.text}>
        <Text style={styles.title}>{t('Assistant')}</Text>
        <Text style={styles.status} numberOfLines={1}>
          {status}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => useUIStore.getState().setAIAgentMinimized(false)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('Hide the assistant bubble')}
      >
        <Text style={styles.dismiss}>{'×'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 100,
      start: 16,
      end: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
      elevation: 8,
      zIndex: 1000,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.onPrimary,
      opacity: 0.5,
    },
    dotReady: { opacity: 1 },
    text: { flex: 1 },
    title: { color: colors.onPrimary, fontSize: 14, fontWeight: '600' },
    status: { color: colors.onPrimary, fontSize: 12, marginTop: 2 },
    dismiss: {
      color: colors.onPrimary,
      fontSize: 22,
      lineHeight: 22,
      paddingHorizontal: 4,
    },
  });
