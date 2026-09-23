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
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Clipboard from '@react-native-clipboard/clipboard';
import { ModalSafeArea } from '../components/ModalSafeArea';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/localization';
import {
  agentService,
  AgentSessionSummary,
  AgentTurn,
} from '../services/ai/AgentService';
import { aiService } from '../services/ai/AIService';
import { webAccessService } from '../services/ai/WebAccessService';
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
  /** Set when the last turn failed, so the question can be sent again. */
  const [canRetry, setCanRetry] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  const [mcpTools, setMcpTools] = useState(0);
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [showSessions, setShowSessions] = useState(false);

  /** Rebuild the thread from the service, which is where it actually lives. */
  const showSession = useCallback(() => {
    setBubbles(
      agentService
        .history()
        .filter(message => !!message.content?.trim())
        .map(message => ({
          id: nextId(),
          role: message.role === 'assistant' ? 'assistant' : 'user',
          text: message.content,
        })),
    );
    setSessions(agentService.listSessions());
    setPending(undefined);
    setCanRetry(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    aiService
      .diagnose()
      .then(readiness => setBlocker(readiness.ready ? null : readiness));
    // Connecting here rather than per message: a handshake per turn would
    // add a round trip to every question the user asks.
    agentService.connectMcp().then(setMcpTools);
    // The bubbles are view state and die with the modal, but the conversation
    // is not - it lives in the service. Closing this screen used to look like
    // losing the thread even though the model still had every word of it.
    agentService.load().then(showSession);
  }, [visible, showSession]);

  const append = useCallback((role: Bubble['role'], text: string) => {
    if (!text) return;
    setBubbles(current => [...current, { id: nextId(), role, text }]);
  }, []);

  const applyTurn = useCallback(
    (turn: AgentTurn) => {
      if (turn.status === 'error') {
        append('system', turn.error || t('Something went wrong.'));
        setPending(undefined);
        setCanRetry(true);
        return;
      }
      setCanRetry(false);
      // Say when the older half of a long conversation was summarised away,
      // rather than letting it quietly stop remembering things.
      if (turn.compacted) {
        append('system', t('Earlier messages were summarised to make room.'));
      }
      if (turn.text) append('assistant', turn.text);
      setPending(
        turn.status === 'needs_confirmation' ? turn.pending : undefined,
      );
    },
    [append, t],
  );

  const copy = useCallback(
    (text: string) => {
      Clipboard.setString(text);
      if (Platform.OS === 'android') {
        ToastAndroid.show(t('Copied'), ToastAndroid.SHORT);
      }
    },
    [t],
  );

  const handleRetry = useCallback(async () => {
    if (busy) return;
    setCanRetry(false);
    setBusy(true);
    try {
      applyTurn(await agentService.retry());
    } finally {
      setBusy(false);
    }
  }, [busy, applyTurn]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    append('user', text);
    setCanRetry(false);
    setBusy(true);
    try {
      applyTurn(await agentService.send(text));
    } finally {
      setBusy(false);
    }
  }, [input, busy, append, applyTurn]);

  /**
   * Hosts this confirmation is asking about, so the card can offer to
   * remember them rather than asking again for the same site.
   */
  const pendingHosts = useMemo(() => {
    const hosts = new Set<string>();
    for (const entry of pending ?? []) {
      if (entry.call.name !== 'fetch_page') continue;
      const host = webAccessService.hostOf(String(entry.call.input?.url ?? ''));
      if (host && !webAccessService.isAllowed(host)) hosts.add(host);
    }
    return Array.from(hosts);
  }, [pending]);

  /** Approve or decline everything the agent asked for in one go. */
  const resolveAll = useCallback(
    async (approved: boolean, remember = false) => {
      if (!pending?.length) return;
      const approvals: Record<string, boolean> = {};
      for (const entry of pending) approvals[entry.call.id] = approved;
      const hosts = remember ? pendingHosts : [];
      setPending(undefined);
      append(
        'system',
        approved
          ? remember
            ? t('Allowed, and {host} is remembered.', {
                host: hosts.join(', '),
              })
            : t('You approved the action.')
          : t('You declined the action.'),
      );
      setBusy(true);
      try {
        applyTurn(await agentService.resolvePending(approvals, hosts));
      } finally {
        setBusy(false);
      }
    },
    [pending, pendingHosts, append, applyTurn, t],
  );

  const handleNew = useCallback(async () => {
    await agentService.newSession();
    setBubbles([]);
    setPending(undefined);
    setCanRetry(false);
    setSessions(agentService.listSessions());
    setShowSessions(false);
  }, []);

  const handleSwitch = useCallback(
    async (id: string) => {
      await agentService.switchTo(id);
      showSession();
      setShowSessions(false);
    },
    [showSession],
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await agentService.deleteSession(id);
      showSession();
    },
    [showSession],
  );

  /**
   * Deliberately here rather than in AI settings, for two reasons: this is
   * where the conversations are, and importing AgentService into the settings
   * screen would drag the whole IRC stack in behind it.
   */
  const handleDeleteAll = useCallback(() => {
    Alert.alert(t('Delete every conversation?'), t('This cannot be undone.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          await agentService.clearAllSessions();
          setBubbles([]);
          setPending(undefined);
          setCanRetry(false);
          setSessions(agentService.listSessions());
          setShowSessions(false);
        },
      },
    ]);
  }, [t]);

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
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.headerAction}>{t('Close')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowSessions(true)}
              style={styles.headerCentre}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>
                {sessions.find(session => session.active)?.title ||
                  t('Assistant')}
              </Text>
              <Text style={styles.headerSub}>
                {t('{count} conversations', { count: sessions.length })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNew}>
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
              <TouchableOpacity
                key={bubble.id}
                activeOpacity={0.7}
                // Long-press copies, so an answer can be taken somewhere else
                // without selecting it by hand on a phone.
                onLongPress={() => copy(bubble.text)}
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
                  selectable
                >
                  {bubble.text}
                </Text>
                {bubble.role !== 'system' && (
                  <TouchableOpacity
                    style={styles.bubbleCopy}
                    onPress={() => copy(bubble.text)}
                  >
                    <Text style={styles.bubbleCopyText}>{t('Copy')}</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
            {canRetry && !busy && (
              <TouchableOpacity style={styles.retry} onPress={handleRetry}>
                <Text style={styles.retryText}>{t('Try again')}</Text>
              </TouchableOpacity>
            )}
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
              {pendingHosts.length > 0 && (
                <Text style={styles.confirmNote}>
                  {t(
                    'It wants to read {host}, which is not on your allowed list.',
                    { host: pendingHosts.join(', ') },
                  )}
                </Text>
              )}
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
                  <Text style={styles.confirmApproveText}>
                    {pendingHosts.length > 0 ? t('Allow once') : t('Do it')}
                  </Text>
                </TouchableOpacity>
              </View>
              {pendingHosts.length > 0 && (
                <TouchableOpacity
                  style={styles.confirmAlways}
                  onPress={() => resolveAll(true, true)}
                >
                  <Text style={styles.confirmAlwaysText}>
                    {t('Always allow this site')}
                  </Text>
                </TouchableOpacity>
              )}
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
        </KeyboardAvoidingView>

        <Modal
          visible={showSessions}
          animationType="slide"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setShowSessions(false)}
        >
          <ModalSafeArea style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShowSessions(false)}>
                <Text style={styles.headerAction}>{t('Back')}</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{t('Conversations')}</Text>
              <TouchableOpacity onPress={handleNew}>
                <Text style={styles.headerAction}>{t('New')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.sessionList}>
              <Text style={styles.subtleNote}>
                {t(
                  'One for drafting a script, one catching up on a channel \u2014 each keeps its own thread.',
                )}
              </Text>
              {sessions.length === 0 && (
                <Text style={styles.empty}>
                  {t('Nothing yet. Ask something and it lands here.')}
                </Text>
              )}
              {sessions.length > 1 && (
                <TouchableOpacity
                  style={styles.sessionClearAll}
                  onPress={handleDeleteAll}
                >
                  <Text style={styles.sessionDelete}>
                    {t('Delete all conversations')}
                  </Text>
                </TouchableOpacity>
              )}
              {sessions.map(session => (
                <View key={session.id} style={styles.sessionRow}>
                  <TouchableOpacity
                    style={styles.sessionMain}
                    onPress={() => handleSwitch(session.id)}
                  >
                    <Text
                      style={[
                        styles.sessionTitle,
                        session.active && styles.sessionTitleActive,
                      ]}
                      numberOfLines={1}
                    >
                      {session.title}
                    </Text>
                    <Text style={styles.sessionMeta}>
                      {t('{count} messages', { count: session.messageCount })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteSession(session.id)}
                  >
                    <Text style={styles.sessionDelete}>{t('Delete')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </ModalSafeArea>
        </Modal>
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
    headerCentre: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
    headerSub: { color: colors.textSecondary, fontSize: 11.5, marginTop: 1 },
    sessionList: { padding: 16, paddingBottom: 32 },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sessionMain: { flex: 1, marginRight: 12 },
    sessionTitle: { color: colors.text, fontSize: 15 },
    sessionTitleActive: { color: colors.primary, fontWeight: '700' },
    sessionMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    sessionDelete: { color: colors.error, fontSize: 13, fontWeight: '600' },
    sessionClearAll: { paddingVertical: 12, alignSelf: 'flex-start' },
    confirmNote: {
      color: colors.warning,
      fontSize: 12.5,
      lineHeight: 18,
      marginBottom: 8,
    },
    confirmAlways: {
      alignSelf: 'flex-end',
      marginTop: 8,
      paddingVertical: 6,
    },
    confirmAlwaysText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 13,
    },
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
    bubbleCopy: { alignSelf: 'flex-end', marginTop: 6, paddingVertical: 2 },
    bubbleCopyText: {
      color: colors.textSecondary,
      fontSize: 11.5,
      fontWeight: '600',
    },
    retry: {
      alignSelf: 'flex-start',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    retryText: { color: colors.primary, fontWeight: '700', fontSize: 13.5 },
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
