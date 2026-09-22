/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ModalSafeArea } from '../components/ModalSafeArea';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/localization';
import { agentService, AgentTurn } from '../services/ai/AgentService';
import { aiService } from '../services/ai/AIService';
import { AIReadiness } from '../services/ai/types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface Bubble {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

let bubbleSeq = 0;
const nextId = () => `b${++bubbleSeq}`;

export const AIAgentScreen: React.FC<Props> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const t = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocker, setBlocker] = useState<AIReadiness | null>(null);
  const [pending, setPending] = useState<AgentTurn['pending']>(undefined);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  const [mcpTools, setMcpTools] = useState(0);

  useEffect(() => {
    if (!visible) return;
    aiService
      .diagnose()
      .then(readiness => setBlocker(readiness.ready ? null : readiness));
    // Connecting here rather than per message: a handshake per turn would
    // add a round trip to every question the user asks.
    agentService.connectMcp().then(setMcpTools);
  }, [visible]);

  const append = useCallback((role: Bubble['role'], text: string) => {
    if (!text) return;
    setBubbles(current => [...current, { id: nextId(), role, text }]);
  }, []);

  const applyTurn = useCallback(
    (turn: AgentTurn) => {
      if (turn.status === 'error') {
        append('system', turn.error || t('Something went wrong.'));
        setPending(undefined);
        return;
      }
      if (turn.text) append('assistant', turn.text);
      setPending(
        turn.status === 'needs_confirmation' ? turn.pending : undefined,
      );
    },
    [append, t],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    append('user', text);
    setBusy(true);
    try {
      applyTurn(await agentService.send(text));
    } finally {
      setBusy(false);
    }
  }, [input, busy, append, applyTurn]);

  /** Approve or decline everything the agent asked for in one go. */
  const resolveAll = useCallback(
    async (approved: boolean) => {
      if (!pending?.length) return;
      const approvals: Record<string, boolean> = {};
      for (const entry of pending) approvals[entry.call.id] = approved;
      setPending(undefined);
      append(
        'system',
        approved
          ? t('You approved the action.')
          : t('You declined the action.'),
      );
      setBusy(true);
      try {
        applyTurn(await agentService.resolvePending(approvals));
      } finally {
        setBusy(false);
      }
    },
    [pending, append, applyTurn, t],
  );

  const handleReset = useCallback(() => {
    agentService.reset();
    setBubbles([]);
    setPending(undefined);
  }, []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <ModalSafeArea style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerAction}>{t('Close')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Assistant')}</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.headerAction}>{t('New')}</Text>
          </TouchableOpacity>
        </View>

        {mcpTools > 0 && (
          <Text style={styles.subtleNote}>
            {t('{count} tools from MCP servers are available.', {
              count: mcpTools,
            })}
          </Text>
        )}

        {blocker && (
          <View style={styles.blocker}>
            <Text style={styles.blockerReason}>{blocker.reason}</Text>
            <Text style={styles.blockerWhere}>{blocker.where}</Text>
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {bubbles.length === 0 && (
            <Text style={styles.empty}>
              {t(
                'Ask about your session — which channels you are in, what you missed, who said what. It can also send messages, but it will ask you first.',
              )}
            </Text>
          )}
          {bubbles.map(bubble => (
            <View
              key={bubble.id}
              style={[
                styles.bubble,
                bubble.role === 'user' && styles.bubbleUser,
                bubble.role === 'system' && styles.bubbleSystem,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  bubble.role === 'system' && styles.bubbleSystemText,
                ]}
              >
                {bubble.text}
              </Text>
            </View>
          ))}
          {busy && (
            <ActivityIndicator style={styles.busy} color={colors.primary} />
          )}
        </ScrollView>

        {pending && pending.length > 0 && (
          <View style={styles.confirm}>
            <Text style={styles.confirmTitle}>
              {t('The assistant wants to do this:')}
            </Text>
            {pending.map(entry => (
              <Text key={entry.call.id} style={styles.confirmItem}>
                {entry.summary}
              </Text>
            ))}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmDeny}
                onPress={() => resolveAll(false)}
              >
                <Text style={styles.confirmDenyText}>{t('No')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmApprove}
                onPress={() => resolveAll(true)}
              >
                <Text style={styles.confirmApproveText}>{t('Do it')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('Ask something…')}
            placeholderTextColor={colors.textSecondary}
            multiline
            editable={!busy}
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            disabled={busy || !input.trim()}
          >
            <Text style={styles.sendText}>{t('Send')}</Text>
          </TouchableOpacity>
        </View>
      </ModalSafeArea>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
    headerAction: { color: colors.primary, fontSize: 15, fontWeight: '600' },
    blocker: {
      margin: 12,
      padding: 12,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warning,
      backgroundColor: colors.surface,
    },
    blockerReason: {
      color: colors.text,
      fontSize: 13.5,
      lineHeight: 19,
      marginBottom: 4,
    },
    blockerWhere: {
      color: colors.warning,
      fontSize: 12.5,
      fontWeight: '600',
      lineHeight: 18,
    },
    subtleNote: {
      color: colors.textSecondary,
      fontSize: 12,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    thread: { flex: 1 },
    threadContent: { padding: 16, paddingBottom: 8 },
    empty: {
      color: colors.textSecondary,
      fontSize: 13.5,
      lineHeight: 20,
      fontStyle: 'italic',
    },
    bubble: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      alignSelf: 'flex-start',
      maxWidth: '92%',
    },
    bubbleUser: {
      backgroundColor: colors.surfaceVariant,
      alignSelf: 'flex-end',
    },
    bubbleSystem: { backgroundColor: 'transparent', paddingVertical: 2 },
    bubbleText: { color: colors.text, fontSize: 14.5, lineHeight: 20 },
    bubbleSystemText: {
      color: colors.textSecondary,
      fontSize: 12.5,
      fontStyle: 'italic',
    },
    busy: { marginTop: 8, alignSelf: 'flex-start' },
    confirm: {
      margin: 12,
      padding: 14,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warning,
      backgroundColor: colors.surface,
    },
    confirmTitle: {
      color: colors.text,
      fontWeight: '600',
      marginBottom: 8,
    },
    confirmItem: {
      color: colors.textSecondary,
      fontFamily: 'monospace',
      fontSize: 12.5,
      lineHeight: 18,
      marginBottom: 6,
    },
    confirmActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 6,
    },
    confirmDeny: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    confirmDenyText: { color: colors.textSecondary, fontWeight: '600' },
    confirmApprove: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    confirmApproveText: { color: colors.onPrimary, fontWeight: '700' },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      padding: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surfaceVariant,
      color: colors.text,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      maxHeight: 120,
    },
    sendButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 18,
      paddingVertical: 11,
    },
    sendText: { color: colors.onPrimary, fontWeight: '700' },
  });
