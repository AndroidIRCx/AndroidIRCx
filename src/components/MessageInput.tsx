import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { commandService } from '../services/CommandService';
import { layoutService } from '../services/LayoutService';
import { connectionManager } from '../services/ConnectionManager';
import { mediaSettingsService } from '../services/MediaSettingsService';
import { mediaEncryptionService } from '../services/MediaEncryptionService';
import { settingsService } from '../services/SettingsService';
import { useTabStore } from '../stores/tabStore';
import { MediaUploadModal } from './MediaUploadModal';
import { MediaPreviewModal } from './MediaPreviewModal';
import { MediaPickResult } from '../services/MediaPickerService';

type MessageInputSuggestion = {
  text: string;
  description?: string;
  source: 'command' | 'alias' | 'history' | 'nick';
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

  // Media upload state
  const [showMediaUploadModal, setShowMediaUploadModal] = useState(false);
  const [showMediaPreviewModal, setShowMediaPreviewModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaPickResult | null>(null);
  const [showAttachmentButton, setShowAttachmentButton] = useState(false);

  // Send button state
  const [showSendButton, setShowSendButton] = useState(true);

  // Typing indicator state
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Load send button setting and subscribe to changes
  useEffect(() => {
    const loadSendButtonSetting = async () => {
      const enabled = await settingsService.getSetting('showSendButton', true);
      setShowSendButton(enabled);
    };
    loadSendButtonSetting();

    // Subscribe to setting changes
    const unsubscribe = settingsService.onSettingChange<boolean>('showSendButton', (value) => {
      setShowSendButton(value);
    });

    return () => {
      unsubscribe();
    };
  }, []);

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

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      // Send typing=done before submitting
      if (isTypingRef.current) {
        sendTypingIndicator('done');
        isTypingRef.current = false;
      }

      onSubmit(message.trim());
      setMessage('');
      setSuggestions([]);

      // Clear any pending typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
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

    // Merge: commands first, then aliases, then history, then nick matches - dedupe by text
    const merged: MessageInputSuggestion[] = [];
    [...commandMatches, ...aliasMatches, ...historyMatches, ...nickMatches].forEach(item => {
      if (!merged.some(m => m.text.toLowerCase() === item.text.toLowerCase())) {
        merged.push({ text: item.text, description: (item as any).description, source: item.source });
      }
    });

    setSuggestions(merged.slice(0, 8));
  };

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
        {/* Attachment button (conditional) */}
        {showAttachmentButton && (
          <TouchableOpacity
            style={styles.attachmentButton}
            onPress={handleAttachmentPress}
            disabled={disabled}
            accessibilityLabel={t('Attach media')}>
            <Text style={styles.attachmentIcon}>📎</Text>
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.input}
          value={message}
          onChangeText={handleChangeText}
          placeholder={placeholder || t('Enter a message')}
          placeholderTextColor={colors.inputPlaceholder}
          onSubmitEditing={handleSubmit}
          editable={!disabled}
          multiline={false}
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
                if (suggestion.source === 'nick') {
                  const lastSpaceIndex = message.lastIndexOf(' ');
                  const before = lastSpaceIndex === -1 ? '' : message.slice(0, lastSpaceIndex + 1);
                  const rawToken = lastSpaceIndex === -1 ? message : message.slice(lastSpaceIndex + 1);
                  const prefix = rawToken.startsWith('@') ? '@' : '';
                  setMessage(`${before}${prefix}${suggestion.text} `);
                } else {
                  setMessage(suggestion.text + (suggestion.text.endsWith(' ') ? '' : ' '));
                }
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
  attachmentButton: {
    marginRight: 8,
    padding: 4,
  },
  attachmentIcon: {
    fontSize: 20,
    opacity: 0.7,
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
});
