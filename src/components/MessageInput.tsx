/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { commandService } from '../services/CommandService';
import { layoutService } from '../services/LayoutService';
import { connectionManager } from '../services/ConnectionManager';
import { awayService } from '../services/AwayService';
import { mediaSettingsService } from '../services/MediaSettingsService';
import { mediaEncryptionService } from '../services/MediaEncryptionService';
import { settingsService } from '../services/SettingsService';
import { useTabStore } from '../stores/tabStore';
import { MediaUploadModal } from './MediaUploadModal';
import { MediaPreviewModal } from './MediaPreviewModal';
import { MediaPickResult } from '../services/MediaPickerService';
import { IRC_FORMAT_CODES, stripIRCFormatting } from '../utils/IRCFormatter';
import { repairMojibake } from '../utils/EncodingUtils';
import { ColorPalettePicker } from './ColorPalettePicker';
import { useServiceCommands } from '../hooks/useServiceCommands';

type MessageInputSuggestion = {
  text: string;
  description?: string;
  source: 'command' | 'alias' | 'history' | 'nick' | 'channel' | 'service';
};

type PendingNickReplacement = {
  start: number;
  end: number;
  display: string;
  styled: string;
};

const MIR_CONTROL = {
  bold: String.fromCharCode(IRC_FORMAT_CODES.BOLD),
  italic: String.fromCharCode(IRC_FORMAT_CODES.ITALIC),
  underline: String.fromCharCode(IRC_FORMAT_CODES.UNDERLINE),
  reverse: String.fromCharCode(IRC_FORMAT_CODES.REVERSE),
  reset: String.fromCharCode(IRC_FORMAT_CODES.RESET),
  color: String.fromCharCode(IRC_FORMAT_CODES.COLOR),
  strikethrough: String.fromCharCode(IRC_FORMAT_CODES.STRIKETHROUGH),
};


interface MessageInputProps {
  placeholder?: string;
  onSubmit: (message: string) => void;
  disabled?: boolean;
  prefilledMessage?: string;
  onPrefillUsed?: () => void;
  bottomInset?: number;
  tabType?: 'channel' | 'query' | 'server' | 'notice' | 'dcc';
  tabName?: string;
  network?: string;
  tabId?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  placeholder,
  onSubmit,
  disabled = false,
  prefilledMessage,
  onPrefillUsed,
  bottomInset = 0,
  tabType = 'server',
  tabName,
  network,
  tabId,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const layoutConfig = layoutService.getConfig();
  const totalBottomInset = bottomInset + layoutConfig.navigationBarOffset;
  const styles = createStyles(colors, totalBottomInset);
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState<MessageInputSuggestion[]>([]);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const selectionRef = useRef(selection);
  const suppressNextSelectionChangeRef = useRef(false);

  // Media upload state
  const [showMediaUploadModal, setShowMediaUploadModal] = useState(false);
  const [showMediaPreviewModal, setShowMediaPreviewModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaPickResult | null>(null);
  const [showAttachmentButton, setShowAttachmentButton] = useState(false);
  const [showColorPickerButton, setShowColorPickerButton] = useState(true);
  const [showColorPickerModal, setShowColorPickerModal] = useState(false);

  // Send button state
  const [showSendButton, setShowSendButton] = useState(true);
  const [nickCompleteEnabled, setNickCompleteEnabled] = useState(false);
  const [nickCompleteSeparator1, setNickCompleteSeparator1] = useState('');
  const [nickCompleteSeparator2, setNickCompleteSeparator2] = useState('');
  const [nickCompleteStyleId, setNickCompleteStyleId] = useState('');
  const [pendingNickReplacements, setPendingNickReplacements] = useState<PendingNickReplacement[]>([]);

  // Typing indicator state
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const lastActivityRef = useRef(0);

  // Enter key behavior state
  const [enterKeyBehavior, setEnterKeyBehavior] = useState<'send' | 'newline'>('newline');

  // Load send button setting and subscribe to changes
  useEffect(() => {
    const loadSendButtonSetting = async () => {
      const enabled = await settingsService.getSetting('showSendButton', true);
      setShowSendButton(enabled);
      const showColors = await settingsService.getSetting('showColorPickerButton', true);
      setShowColorPickerButton(showColors);
      const enterBehavior = await settingsService.getSetting('enterKeyBehavior', 'newline');
      setEnterKeyBehavior(enterBehavior);
      const nickEnabled = await settingsService.getSetting('nickCompleteEnabled', false);
      const sep1 = await settingsService.getSetting('nickCompleteSeparator1', '');
      const sep2 = await settingsService.getSetting('nickCompleteSeparator2', '');
      const styleId = await settingsService.getSetting('nickCompleteStyleId', '');
      setNickCompleteEnabled(nickEnabled);
      setNickCompleteSeparator1(sep1);
      setNickCompleteSeparator2(sep2);
      setNickCompleteStyleId(styleId);
    };
    loadSendButtonSetting();

    // Subscribe to setting changes
    const unsubscribe = settingsService.onSettingChange<boolean>('showSendButton', (value) => {
      setShowSendButton(value);
    });
    const unsubscribeColors = settingsService.onSettingChange<boolean>('showColorPickerButton', (value) => {
      setShowColorPickerButton(Boolean(value));
    });
    const unsubscribeEnterBehavior = settingsService.onSettingChange<'send' | 'newline'>('enterKeyBehavior', (value) => {
      setEnterKeyBehavior(value);
    });
    const unsubscribeNickEnabled = settingsService.onSettingChange<boolean>('nickCompleteEnabled', (value) => {
      setNickCompleteEnabled(Boolean(value));
    });
    const unsubscribeSep1 = settingsService.onSettingChange<string>('nickCompleteSeparator1', (value) => {
      setNickCompleteSeparator1(String(value ?? ''));
    });
    const unsubscribeSep2 = settingsService.onSettingChange<string>('nickCompleteSeparator2', (value) => {
      setNickCompleteSeparator2(String(value ?? ''));
    });
    const unsubscribeStyle = settingsService.onSettingChange<string>('nickCompleteStyleId', (value) => {
      setNickCompleteStyleId(String(value ?? ''));
    });

    return () => {
      unsubscribe();
      unsubscribeColors();
      unsubscribeEnterBehavior();
      unsubscribeNickEnabled();
      unsubscribeSep1();
      unsubscribeSep2();
      unsubscribeStyle();
    };
  }, []);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const setSelectionSafely = useCallback((next: { start: number; end: number }) => {
    suppressNextSelectionChangeRef.current = true;
    setSelection(next);
  }, []);

  const sanitizeStyleString = useCallback((style: string) => {
    const normalized = repairMojibake(style);
    const allowedControls = new Set([0x02, 0x03, 0x0F, 0x16, 0x1D, 0x1F, 0x1E, 0x08]);
    return Array.from(normalized).filter((char) => {
      const code = char.charCodeAt(0);
      if (code >= 32 && code !== 127) return true;
      return allowedControls.has(code);
    }).join('');
  }, []);

  const normalizeNickStyle = useCallback((style: string) => (
    sanitizeStyleString(style)
      .replace(/(\x08)(on|off)$/i, '$1')
      .replace(/\s+(on|off)$/i, '')
  ), [sanitizeStyleString]);

  const replaceBackspacePlaceholder = useCallback((template: string, value: string) => {
    const idx = template.indexOf('\x08');
    if (idx === -1) return template;
    const before = template.slice(0, idx);
    const after = template.slice(idx + 1).replace(/\x08/g, '');
    return `${before}${value}${after}`;
  }, []);

  const buildNickCompletionParts = useCallback((nick: string) => {
    if (!nickCompleteEnabled) {
      return { display: nick, styled: nick };
    }

    if (nickCompleteStyleId) {
      const normalizedStyle = normalizeNickStyle(nickCompleteStyleId);
      if (/<nick>/i.test(normalizedStyle)) {
        const styled = normalizedStyle.replace(/<nick>/gi, nick);
        // Show plain nick while typing; apply styled version only on submit.
        return { display: nick, styled };
      }
      if (normalizedStyle.includes('\x08')) {
        const styled = replaceBackspacePlaceholder(normalizedStyle, nick);
        // Show plain nick while typing; apply styled version only on submit.
        return { display: nick, styled };
      }
    }

    const sep1 = nickCompleteSeparator1 || '';
    const sep2 = nickCompleteSeparator2 || '';
    const combined = `${sep1}${nick}${sep2}`;
    const base = combined.trim().length > 0 ? combined : nick;
    // Show plain nick while typing; apply separators/styling only on submit.
    return { display: nick, styled: base };
  }, [
    nickCompleteEnabled,
    nickCompleteSeparator1,
    nickCompleteSeparator2,
    nickCompleteStyleId,
    normalizeNickStyle,
    replaceBackspacePlaceholder,
  ]);


  // Check if attachment button should be shown
  useEffect(() => {
    const checkAttachmentButton = async () => {
      // If no network, hide button
      if (!network) {
        console.log('[MessageInput] No network, hiding attachment button');
        setShowAttachmentButton(false);
        return;
      }

      // Construct tabId if not provided (fallback)
      let effectiveTabId = tabId;
      if (!effectiveTabId && tabType && tabName) {
        if (tabType === 'channel') {
          effectiveTabId = `channel::${network}::${tabName}`;
        } else if (tabType === 'query') {
          effectiveTabId = `query::${network}::${tabName}`;
        } else {
          // Server/notice tabs don't support media
          console.log('[MessageInput] Server/notice tab, hiding attachment button');
          setShowAttachmentButton(false);
          return;
        }
      }

      if (!effectiveTabId) {
        console.log('[MessageInput] No tabId available, hiding attachment button');
        setShowAttachmentButton(false);
        return;
      }

      console.log('[MessageInput] Checking attachment button visibility:', { network, tabId, effectiveTabId, tabType, tabName });

      // Check if media feature is enabled
      const mediaEnabled = await mediaSettingsService.isMediaEnabled();
      console.log('[MessageInput] Media enabled:', mediaEnabled);
      if (!mediaEnabled) {
        setShowAttachmentButton(false);
        return;
      }

      // Check if tab has E2E encryption
      const hasEncryption = await mediaEncryptionService.hasEncryptionKey(network, effectiveTabId);
      console.log('[MessageInput] Has encryption:', hasEncryption);
      setShowAttachmentButton(hasEncryption);
    };

    checkAttachmentButton();
  }, [network, tabId, tabType, tabName]);

  const sendTypingIndicator = (status: 'active' | 'paused' | 'done') => {
    if (!tabName || tabType === 'server' || disabled) return;

    const activeNetworkId = connectionManager.getActiveNetworkId();
    if (!activeNetworkId) return;

    const connection = connectionManager.getConnection(activeNetworkId);
    if (!connection?.ircService) return;

    // Only send typing indicator if server supports it (has typing capability)
    connection.ircService.sendTypingIndicator(tabName, status);
  };

  const applyPendingNickReplacements = useCallback((value: string) => {
    if (pendingNickReplacements.length === 0) return value;
    let next = value;
    pendingNickReplacements.forEach((replacement) => {
      let start = replacement.start;
      if (start < 0 || start + replacement.display.length > next.length ||
        next.slice(start, start + replacement.display.length) !== replacement.display) {
        start = next.indexOf(replacement.display);
      }
      if (start === -1) {
        return;
      }
      const end = start + replacement.display.length;
      next = `${next.slice(0, start)}${replacement.styled}${next.slice(end)}`;
    });
    return next;
  }, [pendingNickReplacements]);

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      const activeNetworkId = network || connectionManager.getActiveNetworkId();
      awayService.recordActivity(activeNetworkId || undefined);
      // Send typing=done before submitting
      if (isTypingRef.current) {
        sendTypingIndicator('done');
        isTypingRef.current = false;
      }

      const trimmedMessage = message.trim();
      const withNickStyles = trimmedMessage.startsWith('/') ? message : applyPendingNickReplacements(message);
      onSubmit(withNickStyles.trim());
      setMessage('');
      setSuggestions([]);
      setPendingNickReplacements([]);

      // Clear any pending typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleKeyPress = (e: any) => {
    // Intercept Enter key press when behavior is 'send'
    if (enterKeyBehavior === 'send' && e.nativeEvent.key === 'Enter') {
      // On iOS, we can prevent default to stop newline
      if (Platform.OS === 'ios') {
        e.preventDefault();
        handleSubmit();
      }
      // On Android, when multiline={true}, Enter always creates newline
      // We can't prevent it, but onSubmitEditing will be called if blurOnSubmit={true}
    }
  };

  // Media upload handlers
  const handleAttachmentPress = () => {
    setShowMediaUploadModal(true);
  };

  const handleMediaSelected = (result: MediaPickResult) => {
    setSelectedMedia(result);
    setShowMediaUploadModal(false);
    setShowMediaPreviewModal(true);
  };

  const handleMediaSendComplete = (ircTag: string, caption?: string) => {
    // Construct message: IRC tag + optional caption
    const mediaMessage = caption ? `${ircTag} ${caption}` : ircTag;

    // Send through normal onSubmit
    onSubmit(mediaMessage);

    // Reset state
    setSelectedMedia(null);
    setShowMediaPreviewModal(false);
  };

  const handleMediaPreviewClose = () => {
    setSelectedMedia(null);
    setShowMediaPreviewModal(false);
  };

  const applyControlCode = useCallback((openCode: string, closeCode?: string) => {
    const { start, end } = selectionRef.current;
    const before = message.slice(0, start);
    const selected = message.slice(start, end);
    const after = message.slice(end);
    if (start !== end) {
      const closing = closeCode ?? openCode;
      const nextValue = `${before}${openCode}${selected}${closing}${after}`;
      const nextCursor = before.length + openCode.length + selected.length + closing.length;
      setMessage(nextValue);
      setSelectionSafely({ start: nextCursor, end: nextCursor });
      return;
    }
    const nextValue = `${before}${openCode}${after}`;
    const nextCursor = start + openCode.length;
    setMessage(nextValue);
    setSelectionSafely({ start: nextCursor, end: nextCursor });
  }, [message, setSelectionSafely]);

  const handleInsertColor = (code: string) => {
    applyControlCode(code, MIR_CONTROL.color);
  };

  const handleResetFormatting = () => {
    applyControlCode(MIR_CONTROL.reset);
  };

  // Cleanup typing indicator on unmount
  useEffect(() => {
    return () => {
      if (isTypingRef.current) {
        sendTypingIndicator('done');
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Service commands integration
  const serviceCommands = useServiceCommands({
    networkId: network || connectionManager.getActiveNetworkId() || '',
    currentChannel: tabType === 'channel' ? tabName : undefined,
  });

  const scoreAliasForContext = (command: string): number => {
    // Simple heuristic: prefer channel aliases on channels, user aliases on queries, otherwise neutral
    const lower = command.toLowerCase();
    let score = 0;
    if (tabType === 'channel') {
      if (lower.includes('{channel}') || lower.includes('#')) score += 2;
    } else if (tabType === 'query') {
      if (lower.includes('{nick}') || lower.includes('/msg')) score += 2;
    } else {
      // server/notice
      if (!lower.includes('{channel}') && !lower.includes('{nick}')) score += 1;
    }
    return score;
  };

  const handleChangeText = (text: string) => {
    setMessage(text);
    if (pendingNickReplacements.length > 0) {
      setPendingNickReplacements(prev => prev.filter(item => text.includes(item.display)));
    }
    const now = Date.now();
    if (now - lastActivityRef.current > 3000) {
      lastActivityRef.current = now;
      const activeNetworkId = network || connectionManager.getActiveNetworkId();
      awayService.recordActivity(activeNetworkId || undefined);
    }

    // Handle typing indicators
    if (text.trim() && !disabled && tabName && tabType !== 'server') {
      // Send typing=active if not already typing
      if (!isTypingRef.current) {
        sendTypingIndicator('active');
        isTypingRef.current = true;
      }

      // Clear existing timeout and set new one for paused state
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          sendTypingIndicator('paused');
          isTypingRef.current = false;
        }
      }, 3000); // 3 seconds of inactivity = paused
    } else if (!text.trim() && isTypingRef.current) {
      // If text is cleared, send done
      sendTypingIndicator('done');
      isTypingRef.current = false;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }

    if (!text.trim()) {
      setPendingNickReplacements([]);
      setSuggestions([]);
      return;
    }
    const typed = text.startsWith('/') ? text : `/${text}`;
    const typedLower = typed.toLowerCase();

    // Built-in IRC commands
    const builtInCommands = [
      { cmd: 'join', desc: t('Join a channel') },
      { cmd: 'part', desc: t('Leave a channel') },
      { cmd: 'hop', desc: t('Rejoin current channel') },
      { cmd: 'quit', desc: t('Disconnect from server') },
      { cmd: 'nick', desc: t('Change nickname') },
      { cmd: 'msg', desc: t('Send private message') },
      { cmd: 'query', desc: t('Open private chat') },
      { cmd: 'whois', desc: t('User information') },
      { cmd: 'whowas', desc: t('Past user information') },
      { cmd: 'mode', desc: t('Change channel/user modes') },
      { cmd: 'topic', desc: t('View/set channel topic') },
      { cmd: 'kick', desc: t('Kick user from channel') },
      { cmd: 'me', desc: t('Send action message') },
      { cmd: 'action', desc: t('Send action message') },
      { cmd: 'setname', desc: t('Change real name') },
      { cmd: 'bot', desc: t('Toggle bot mode') },
      { cmd: 'away', desc: t('Set away message') },
      { cmd: 'back', desc: t('Remove away status') },
      { cmd: 'invite', desc: t('Invite user to channel') },
      { cmd: 'list', desc: t('List channels on server') },
      { cmd: 'names', desc: t('List users in channel') },
      { cmd: 'who', desc: t('Query user information') },
      { cmd: 'ban', desc: t('Ban user from channel') },
      { cmd: 'unban', desc: t('Unban user from channel') },
      { cmd: 'kickban', desc: t('Kick and ban user') },
      { cmd: 'notice', desc: t('Send notice message') },
      { cmd: 'ignore', desc: t('Ignore user messages') },
      { cmd: 'unignore', desc: t('Stop ignoring user') },
      { cmd: 'clear', desc: t('Clear current tab messages') },
      { cmd: 'close', desc: t('Close current tab') },
      { cmd: 'echo', desc: t('Display local message') },
      { cmd: 'amsg', desc: t('Send message to all channels') },
      { cmd: 'ame', desc: t('Send action to all channels') },
      { cmd: 'anotice', desc: t('Send notice to all channels') },
      { cmd: 'lusers', desc: t('Get user statistics') },
      { cmd: 'version', desc: t('Get server version') },
      { cmd: 'time', desc: t('Get server time') },
      { cmd: 'admin', desc: t('Get server admin info') },
      { cmd: 'links', desc: t('List server links') },
      { cmd: 'stats', desc: t('Get server statistics') },
      { cmd: 'ison', desc: t('Check if nicks are online') },
      { cmd: 'motd', desc: t('Get message of the day') },
      { cmd: 'ping', desc: t('Ping server') },
      { cmd: 'trace', desc: t('Trace route to server') },
      { cmd: 'squery', desc: t('Query IRC services') },
      { cmd: 'reconnect', desc: t('Reconnect to server') },
      { cmd: 'server', desc: t('Connect to server: /server [-m] [-e] [-t] <address> [port] [password] [-l method pass] [-i nick anick email name] [-jn #channel pass] [-sar]') },
      { cmd: 'disconnect', desc: t('Disconnect from server') },
      { cmd: 'anick', desc: t('Set alternate nickname') },
      { cmd: 'ajinvite', desc: t('Auto-join on invite toggle') },
      { cmd: 'beep', desc: t('Play beep sound') },
      { cmd: 'cnotice', desc: t('Channel notice') },
      { cmd: 'cprivmsg', desc: t('Channel privmsg') },
      { cmd: 'help', desc: t('Show help') },
      { cmd: 'raw', desc: t('Send raw IRC command') },
      { cmd: 'dns', desc: t('DNS lookup') },
      { cmd: 'timer', desc: t('Execute command after delay') },
      { cmd: 'window', desc: t('Window/tab management') },
      { cmd: 'filter', desc: t('Filter messages') },
      { cmd: 'wallops', desc: t('Send wallops message (IRCop)') },
      { cmd: 'locops', desc: t('Send local ops message (IRCop)') },
      { cmd: 'globops', desc: t('Send global ops message (IRCop)') },
      { cmd: 'adchat', desc: t('Admin chat (IRCop)') },
      { cmd: 'chat', desc: t('Chat with services') },
      { cmd: 'info', desc: t('Get server information') },
      { cmd: 'knock', desc: t('Request invite to channel') },
      { cmd: 'rules', desc: t('Get server rules') },
      { cmd: 'servlist', desc: t('List IRC services') },
      { cmd: 'userhost', desc: t('Get user host information') },
      { cmd: 'userip', desc: t('Get user IP address') },
      { cmd: 'users', desc: t('Get user list') },
      { cmd: 'watch', desc: t('Monitor users (legacy)') },
      { cmd: 'oper', desc: t('IRCop login') },
      { cmd: 'rehash', desc: t('IRCop rehash server') },
      { cmd: 'squit', desc: t('IRCop disconnect server') },
      { cmd: 'kill', desc: t('IRCop kill user') },
      { cmd: 'connect', desc: t('IRCop connect servers') },
      { cmd: 'die', desc: t('IRCop shutdown server') },
      { cmd: 'sharekey', desc: t('Share DM encryption key') },
      { cmd: 'requestkey', desc: t('Request DM encryption key') },
      { cmd: 'encmsg', desc: t('Send encrypted DM') },
      { cmd: 'enc', desc: t('DM encryption help') },
      { cmd: 'chankey', desc: t('Channel encryption commands') },
      { cmd: 'quote', desc: t('Send raw IRC command') },
      { cmd: 'ctcp', desc: t('CTCP request') },
      { cmd: 'dcc', desc: t('DCC commands') },
      { cmd: 'xdcc', desc: t('XDCC bot commands') },
    ];

    const commandMatches: MessageInputSuggestion[] = builtInCommands
      .filter(item => `/${item.cmd}`.toLowerCase().startsWith(typedLower))
      .map(item => ({
        text: `/${item.cmd}`,
        description: item.desc,
        source: 'command' as const,
      }))
      .slice(0, 6);

    // Aliases
    const aliasMatches: Array<MessageInputSuggestion & { score: number }> = commandService.getAliases()
      .map(alias => {
        const aliasText = `/${alias.alias}`;
        return {
          text: aliasText,
          description: alias.description,
          source: 'alias' as const,
          score: scoreAliasForContext(alias.command),
        };
      })
      .filter(item => item.text.toLowerCase().startsWith(typedLower))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.text.localeCompare(b.text);
      })
      .slice(0, 6);

    // History
    const history = commandService.getHistory(30).map(entry => entry.command);
    const uniqueHistory = Array.from(new Set(history));
    const historyMatches: MessageInputSuggestion[] = uniqueHistory
      .filter(cmd => cmd.toLowerCase().startsWith(typedLower))
      .map(cmd => ({ text: cmd, source: 'history' as const }))
      .slice(0, 6);

    // Nick suggestions (channel users + recent query tabs)
    let nickMatches: MessageInputSuggestion[] = [];
    // Channel suggestions (open channel tabs for this network)
    let channelMatches: MessageInputSuggestion[] = [];
    const lastSpaceIndex = text.lastIndexOf(' ');
    const rawToken = lastSpaceIndex === -1 ? text : text.slice(lastSpaceIndex + 1);
    const token = rawToken.startsWith('@') ? rawToken.slice(1) : rawToken;
    const isCommandToken = rawToken.startsWith('/') && lastSpaceIndex === -1;
    if (!isCommandToken && token.length >= 2) {
      const networkId = network || connectionManager.getActiveNetworkId();
      const conn = networkId ? connectionManager.getConnection(networkId) : null;
      const nickSet = new Map<string, string>();
      if (conn?.ircService && tabType === 'channel' && tabName) {
        conn.ircService.getChannelUsers(tabName)
          .map((user: any) => user.nick)
          .filter(Boolean)
          .forEach((nick: string) => {
            const lower = nick.toLowerCase();
            if (!nickSet.has(lower)) nickSet.set(lower, nick);
          });
      }
      if (networkId) {
        const tabs = useTabStore.getState().getTabsByNetwork(networkId);
        tabs
          .filter(t => t.type === 'query')
          .map(t => t.name)
          .filter(Boolean)
          .forEach(nick => {
            const lower = nick.toLowerCase();
            if (!nickSet.has(lower)) nickSet.set(lower, nick);
          });
      }
      const tokenLower = token.toLowerCase();
      nickMatches = Array.from(nickSet.values())
        .filter(nick => nick.toLowerCase().startsWith(tokenLower))
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .slice(0, 6)
        .map(nick => ({ text: nick, source: 'nick' as const }));
    }

    // Channel completion: for tokens like "#And" (use open channel tabs on current network)
    // This enables typing e.g. "/csop #And" and selecting "#AndroidIRCx".
    if (!isCommandToken && rawToken.length >= 2 && (rawToken.startsWith('#') || rawToken.startsWith('&'))) {
      const networkId = network || connectionManager.getActiveNetworkId();
      if (networkId) {
        const tabs = useTabStore.getState().getTabsByNetwork(networkId);
        const chanSet = new Map<string, string>();
        tabs
          .filter(t => t.type === 'channel')
          .map(t => t.name)
          .filter(Boolean)
          .forEach(name => {
            const lower = name.toLowerCase();
            if (!chanSet.has(lower)) chanSet.set(lower, name);
          });
        const rawLower = rawToken.toLowerCase();
        channelMatches = Array.from(chanSet.values())
          .filter(ch => ch.toLowerCase().startsWith(rawLower))
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
          .slice(0, 6)
          .map(ch => ({ text: ch, source: 'channel' as const }));
      }
    }

    // Service command suggestions (from detected IRC services)
    let serviceMatches: MessageInputSuggestion[] = [];
    if (text.startsWith('/') && serviceCommands.isDetected) {
      const query = text.slice(1).toLowerCase();
      // Only suggest service commands for specific prefixes
      if (query.startsWith('ns') || query.startsWith('cs') || query.startsWith('hs') || 
          query.startsWith('os') || query.startsWith('ms') || query.startsWith('bs') ||
          query.startsWith('msg ') || query.startsWith('/msg ')) {
        const serviceSuggestions = serviceCommands.getSuggestions(query);
        serviceMatches = serviceSuggestions.map(s => ({
          text: s.isAlias ? s.text : `/msg ${s.serviceNick} ${s.text}`,
          description: s.description,
          source: 'service' as const,
        })).slice(0, 4);
      }
    }

    // Merge: commands first, then aliases, then service commands, then history, then channel, then nick - dedupe by text
    const merged: MessageInputSuggestion[] = [];
    [...commandMatches, ...aliasMatches, ...serviceMatches, ...historyMatches, ...channelMatches, ...nickMatches].forEach(item => {
      if (!merged.some(m => m.text.toLowerCase() === item.text.toLowerCase())) {
        merged.push({ text: item.text, description: (item as any).description, source: item.source });
      }
    });

    setSuggestions(merged.slice(0, 8));
  };

  const showToolbar = showAttachmentButton || showColorPickerButton;
  const useToolbarScroll = showAttachmentButton && showColorPickerButton;

  // Support external prefill (e.g., quick actions)
  React.useEffect(() => {
    if (prefilledMessage) {
      setMessage(prefilledMessage);
      setSuggestions([]);
      if (onPrefillUsed) onPrefillUsed();
    }
  }, [prefilledMessage, onPrefillUsed]);

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        {showToolbar && (
          <View style={styles.toolbarContainer}>
            {useToolbarScroll ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.toolbarContent}
              >
                {showAttachmentButton && (
                  <TouchableOpacity
                    style={styles.attachmentButton}
                    onPress={handleAttachmentPress}
                    disabled={disabled}
                    accessibilityLabel={t('Attach media')}>
                    <Text style={styles.attachmentIcon}>📎</Text>
                  </TouchableOpacity>
                )}
                {showColorPickerButton && (
                  <TouchableOpacity
                    style={styles.colorButton}
                    onPress={() => setShowColorPickerModal(true)}
                    disabled={disabled}
                    accessibilityLabel={t('Open color picker')}>
                    <Icon name="palette" size={16} color={colors.textSecondary} solid />
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : (
              <>
                {showAttachmentButton && (
                  <TouchableOpacity
                    style={styles.attachmentButton}
                    onPress={handleAttachmentPress}
                    disabled={disabled}
                    accessibilityLabel={t('Attach media')}>
                    <Text style={styles.attachmentIcon}>📎</Text>
                  </TouchableOpacity>
                )}
                {showColorPickerButton && (
                  <TouchableOpacity
                    style={styles.colorButton}
                    onPress={() => setShowColorPickerModal(true)}
                    disabled={disabled}
                    accessibilityLabel={t('Open color picker')}>
                    <Icon name="palette" size={16} color={colors.textSecondary} solid />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        <TextInput
          style={styles.input}
          value={message}
          onChangeText={handleChangeText}
          placeholder={placeholder || t('Enter a message')}
          placeholderTextColor={colors.inputPlaceholder}
          onSubmitEditing={enterKeyBehavior === 'send' ? handleSubmit : undefined}
          onKeyPress={handleKeyPress}
          onSelectionChange={(event) => {
            if (suppressNextSelectionChangeRef.current) {
              suppressNextSelectionChangeRef.current = false;
              return;
            }
            setSelection(event.nativeEvent.selection);
          }}
          selection={selection}
          editable={!disabled}
          multiline={true}
          blurOnSubmit={enterKeyBehavior === 'send'}
          returnKeyType={enterKeyBehavior === 'send' ? 'send' : 'default'}
          textAlignVertical="top"
        />

        {/* Send button (conditional) */}
        {showSendButton && (
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSubmit}
            disabled={disabled || !message.trim()}
            accessibilityLabel={t('Send message')}>
            <Icon
              name="arrow-up"
              size={18}
              color={message.trim() && !disabled ? colors.primary : colors.textSecondary}
              solid
            />
          </TouchableOpacity>
        )}
      </View>
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {suggestions.map(suggestion => (
            <TouchableOpacity
              key={suggestion.text}
              onPress={() => {
                let nextMessage = '';
                if (suggestion.source === 'nick') {
                  const lastSpaceIndex = message.lastIndexOf(' ');
                  const before = lastSpaceIndex === -1 ? '' : message.slice(0, lastSpaceIndex + 1);
                  const rawToken = lastSpaceIndex === -1 ? message : message.slice(lastSpaceIndex + 1);
                  const prefix = rawToken.startsWith('@') ? '@' : '';
                  const { display, styled } = buildNickCompletionParts(suggestion.text);
                  const displayWithPrefix = `${prefix}${display}`;
                  const styledWithPrefix = `${prefix}${styled}`;
                  const displayToken = displayWithPrefix.endsWith(' ')
                    ? displayWithPrefix
                    : `${displayWithPrefix} `;
                  nextMessage = `${before}${displayToken}`;
                  if (styledWithPrefix !== displayWithPrefix) {
                    const insertStart = before.length;
                    const insertEnd = insertStart + displayWithPrefix.length;
                    const delta = displayToken.length - rawToken.length;
                    setPendingNickReplacements(prev => {
                      const next = prev
                        .filter(item => item.end <= insertStart || item.start >= insertStart + rawToken.length)
                        .map(item => (
                          item.start >= insertStart + rawToken.length
                            ? { ...item, start: item.start + delta, end: item.end + delta }
                            : item
                        ));
                      return [...next, {
                        start: insertStart,
                        end: insertEnd,
                        display: displayWithPrefix,
                        styled: styledWithPrefix,
                      }];
                    });
                  }
                } else if (suggestion.source === 'channel') {
                  const lastSpaceIndex = message.lastIndexOf(' ');
                  const before = lastSpaceIndex === -1 ? '' : message.slice(0, lastSpaceIndex + 1);
                  // Replace only the current token (e.g. "#And") and keep the rest
                  nextMessage = `${before}${suggestion.text} `;
                } else {
                  nextMessage = suggestion.text + (suggestion.text.endsWith(' ') ? '' : ' ');
                }
                setMessage(nextMessage);
                const cursorPos = nextMessage.length;
                setSelectionSafely({ start: cursorPos, end: cursorPos });
                setSuggestions([]);
              }}
              style={styles.suggestionRow}
            >
              <Text style={[styles.suggestionText, { color: colors.text }]}>
                {suggestion.text}
                {suggestion.description ? ` — ${suggestion.description}` : ''}
                {!suggestion.description && suggestion.source === 'alias' ? ` — ${t('alias')}` : ''}
                {!suggestion.description && suggestion.source === 'history' ? ` — ${t('recent')}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal
        visible={showColorPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowColorPickerModal(false)}
      >
        <View style={styles.colorModalOverlay}>
          <View style={styles.colorModalCard}>
            <View style={styles.colorModalHeader}>
              <Text style={styles.colorModalTitle}>{t('mIRC Formatting')}</Text>
              <TouchableOpacity onPress={() => setShowColorPickerModal(false)}>
                <Text style={styles.colorModalClose}>{t('Close')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.formatActionsRow}>
              <TouchableOpacity
                style={styles.formatAction}
                onPress={() => applyControlCode(MIR_CONTROL.bold)}
              >
                <Text style={[styles.formatActionText, styles.formatBold]}>B</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatAction}
                onPress={() => applyControlCode(MIR_CONTROL.italic)}
              >
                <Text style={[styles.formatActionText, styles.formatItalic]}>I</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatAction}
                onPress={() => applyControlCode(MIR_CONTROL.underline)}
              >
                <Text style={[styles.formatActionText, styles.formatUnderline]}>U</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatAction}
                onPress={() => applyControlCode(MIR_CONTROL.strikethrough)}
              >
                <Text style={[styles.formatActionText, styles.formatStrike]}>S</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatAction}
                onPress={() => applyControlCode(MIR_CONTROL.reverse)}
              >
                <Text style={styles.formatActionText}>R</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.formatAction}
                onPress={handleResetFormatting}
              >
                <Text style={styles.formatActionText}>0</Text>
              </TouchableOpacity>
            </View>
            <ColorPalettePicker
              colors={colors}
              onInsert={handleInsertColor}
              autoInsertOnBg
              insertLabel={t('Insert colors')}
              clearLabel={t('Clear selection')}
            />
          </View>
        </View>
      </Modal>

      {/* Media upload modals */}
      <MediaUploadModal
        visible={showMediaUploadModal}
        onClose={() => setShowMediaUploadModal(false)}
        onMediaSelected={handleMediaSelected}
      />

      {network && tabId && (
        <MediaPreviewModal
          visible={showMediaPreviewModal}
          onClose={handleMediaPreviewClose}
          mediaResult={selectedMedia}
          network={network}
          tabId={tabId}
          onSendComplete={handleMediaSendComplete}
        />
      )}
    </View>
  );
};

const createStyles = (colors: any, bottomInset: number = 0) => StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Math.max(8, bottomInset),
    ...Platform.select({
      android: {
        elevation: 4,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
      },
    }),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toolbarContainer: {
    marginRight: 8,
  },
  toolbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentButton: {
    marginRight: 8,
    padding: 4,
  },
  attachmentIcon: {
    fontSize: 20,
    opacity: 0.7,
  },
  colorButton: {
    marginRight: 4,
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    marginLeft: 8,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    width: 32,
    height: 32,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.inputText,
    paddingVertical: 4,
    minHeight: 20,
    maxHeight: 120,
  },
  suggestionsContainer: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  suggestionText: {
    fontSize: 13,
  },
  colorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorModalCard: {
    width: '92%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  colorModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  colorModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  colorModalClose: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  formatActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  formatAction: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formatActionText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  formatBold: {
    fontWeight: '800',
  },
  formatItalic: {
    fontStyle: 'italic',
  },
  formatUnderline: {
    textDecorationLine: 'underline',
  },
  formatStrike: {
    textDecorationLine: 'line-through',
  },
});
