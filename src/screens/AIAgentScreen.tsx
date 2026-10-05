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
  AgentActivity,
  agentService,
  AgentSessionSummary,
  AgentTurn,
  RetryMode,
} from '../services/ai/AgentService';
import { aiService } from '../services/ai/AIService';
import { MemorySaveResult } from '../services/ai/McpMemorySink';
import { webAccessService } from '../services/ai/WebAccessService';
import { AIReadiness } from '../services/ai/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  /**
   * Hide the screen without ending anything. When given, the header button
   * and the back gesture minimise instead of closing.
   */
  onMinimize?: () => void;
}

interface Bubble {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

let bubbleSeq = 0;
const nextId = () => `b${++bubbleSeq}`;

/** "search ×3, read_channel" — a repeated tool once, with how many times. */
export function summariseTools(labels: string[]): string {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return Array.from(counts)
    .map(([label, count]) => (count > 1 ? `${label} \u00d7${count}` : label))
    .join(', ');
}

export const AIAgentScreen: React.FC<Props> = ({
  visible,
  onClose,
  onMinimize,
}) => {
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
  /** Set when it failed for size, so the retry can make room first. */
  const [tooLong, setTooLong] = useState(false);
  const [activity, setActivity] = useState<AgentActivity>({ kind: 'idle' });
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  const [mcpTools, setMcpTools] = useState(0);
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [showSessions, setShowSessions] = useState(false);

  /** The session the bubbles on screen belong to. */
  const shownSessionId = useRef<string | null>(null);
  const bubbleCount = useRef(0);
  bubbleCount.current = bubbles.length;

  /** Rebuild the thread from the service, which is where it actually lives. */
  const showSession = useCallback(() => {
    shownSessionId.current = agentService.activeSessionId();
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
    setTooLong(false);
  }, []);

  // What the assistant is doing while the spinner turns: which tool, or that
  // it is summarising. Tools can take a long while, and a bare spinner looks
  // the same whether it is working or stuck.
  useEffect(() => {
    if (!visible) return;
    // Reopened mid-turn: show the work in progress, not a blank composer.
    setActivity(agentService.currentActivity());
    return agentService.onActivity(setActivity);
  }, [visible]);

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
    //
    // Coming back from minimised to the same conversation keeps the thread
    // as it was, notes and all, rather than rebuilding it from the history.
    agentService.load().then(() => {
      if (
        bubbleCount.current > 0 &&
        shownSessionId.current === agentService.activeSessionId()
      ) {
        return;
      }
      showSession();
    });
  }, [visible, showSession]);

  /**
   * Minimise, and say so: a screen that vanishes mid-answer looks like it
   * was cancelled. Nothing stops — the bubble brings it back.
   */
  const hide = useCallback(() => {
    if (!onMinimize) {
      onClose();
      return;
    }
    onMinimize();
    if (Platform.OS === 'android') {
      ToastAndroid.show(
        agentService.isBusy()
          ? t('The assistant keeps working. Tap its bubble to come back.')
          : t('Minimised. Tap the assistant bubble to come back.'),
        ToastAndroid.SHORT,
      );
    }
  }, [onMinimize, onClose, t]);

  const append = useCallback((role: Bubble['role'], text: string) => {
    if (!text) return;
    setBubbles(current => [...current, { id: nextId(), role, text }]);
  }, []);

  /** Say where a compaction's summary went, when it went anywhere. */
  const noteMemory = useCallback(
    (memory: MemorySaveResult[] | undefined) => {
      if (!memory?.length) return;
      // One line for every server that took it, one per server that did not,
      // so a failure is never lost among the successes.
      const saved = memory.filter(result => result.ok);
      if (saved.length) {
        append(
          'system',
          t('The summary was saved to {server}.', {
            server: saved.map(result => result.server).join(', '),
          }),
        );
      }
      for (const result of memory.filter(entry => !entry.ok)) {
        append(
          'system',
          t('Could not save the summary to {server}: {error}', {
            server: result.server,
            error: result.error ?? '',
          }),
        );
      }
    },
    [append, t],
  );

  const applyTurn = useCallback(
    (turn: AgentTurn) => {
      // Say when the older half of a long conversation was summarised away,
      // rather than letting it quietly stop remembering things.
      if (turn.compacted) {
        append('system', t('Earlier messages were summarised to make room.'));
      }
      if (turn.recovered === 'compact') {
        append(
          'system',
          t(
            'That was too much for the model, so the conversation was summarised and sent again.',
          ),
        );
      } else if (turn.recovered === 'question_only') {
        append(
          'system',
          t(
            'That was too much for the model even summarised, so only your question was sent.',
          ),
        );
      }
      noteMemory(turn.memory);
      if (turn.toolsUsed?.length) {
        append(
          'system',
          t('Used: {tools}', { tools: summariseTools(turn.toolsUsed) }),
        );
      }
      if (turn.status === 'error') {
        append('system', turn.error || t('Something went wrong.'));
        setPending(undefined);
        setCanRetry(true);
        setTooLong(!!turn.tooLong);
        return;
      }
      setCanRetry(false);
      setTooLong(false);
      if (turn.text) append('assistant', turn.text);
      setPending(
        turn.status === 'needs_confirmation' ? turn.pending : undefined,
      );
    },
    [append, noteMemory, t],
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

  const handleRetry = useCallback(
    async (mode?: RetryMode) => {
      if (busy) return;
      setCanRetry(false);
      setTooLong(false);
      setBusy(true);
      try {
        applyTurn(await agentService.retry(mode));
      } finally {
        setBusy(false);
      }
    },
    [busy, applyTurn],
  );

  /** Summarise the thread now, so the next question starts lighter. */
  const handleCompact = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const done = await agentService.compactNow();
      showSession();
      append(
        'system',
        done
          ? t('The conversation was summarised. Ask the next question.')
          : t('There is nothing to summarise yet.'),
      );
      if (done) noteMemory(agentService.lastMemorySave());
    } finally {
      setBusy(false);
    }
  }, [busy, showSession, append, noteMemory, t]);

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
    setTooLong(false);
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
          setTooLong(false);
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
      onRequestClose={hide}
    >
      <ModalSafeArea style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={hide}
              accessibilityRole="button"
              accessibilityHint={
                onMinimize
                  ? t(
                      'Hides the conversation. It keeps running and comes back from the bubble.',
                    )
                  : undefined
              }
            >
              <Text style={styles.headerAction}>
                {onMinimize ? t('Minimize') : t('Close')}
              </Text>
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

          <View style={styles.toolbar}>
            {mcpTools > 0 ? (
              <Text style={styles.toolbarNote}>
                {t('{count} tools from MCP servers are available.', {
                  count: mcpTools,
                })}
              </Text>
            ) : (
              <View style={styles.toolbarSpacer} />
            )}
            {bubbles.length > 1 && !busy && !pending?.length && (
              <TouchableOpacity onPress={handleCompact}>
                <Text style={styles.toolbarAction}>{t('Compact')}</Text>
              </TouchableOpacity>
            )}
          </View>

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
              <View style={styles.retryRow}>
                {tooLong ? (
                  <>
                    <TouchableOpacity
                      style={styles.retry}
                      onPress={() => handleRetry('compact')}
                    >
                      <Text style={styles.retryText}>
                        {t('Summarise and retry')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.retry}
                      onPress={() => handleRetry('question_only')}
                    >
                      <Text style={styles.retryText}>
                        {t('Ask just this question')}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.retry}
                    onPress={() => handleRetry()}
                  >
                    <Text style={styles.retryText}>{t('Try again')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {busy && (
              <View style={styles.busyRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.busyText}>
                  {activity.kind === 'tool'
                    ? t('Running {tool}\u2026', { tool: activity.label })
                    : activity.kind === 'compacting'
                      ? t('Summarising earlier messages\u2026')
                      : t('Thinking\u2026')}
                </Text>
              </View>
            )}
          </ScrollView>

          {pending && pending.length > 0 && (
            <View style={styles.confirm}>
              <Text style={styles.confirmTitle}>
                {t('The assistant wants to do this:')}
              </Text>
              <ScrollView
                style={styles.confirmList}
                nestedScrollEnabled
                testID="confirm-list"
              >
                {pending.map(entry => (
                  <Text
                    key={entry.call.id}
                    style={styles.confirmItem}
                    selectable
                  >
                    {entry.summary}
                  </Text>
                ))}
              </ScrollView>
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
    sessionMain: { flex: 1, marginEnd: 12 },
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
    retryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    busyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    busyText: { color: colors.textSecondary, fontSize: 13, flexShrink: 1 },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      gap: 12,
    },
    toolbarNote: { flex: 1, color: colors.textSecondary, fontSize: 12 },
    toolbarSpacer: { flex: 1 },
    toolbarAction: { color: colors.primary, fontSize: 13, fontWeight: '600' },
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
    confirmList: { maxHeight: 260 },
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
