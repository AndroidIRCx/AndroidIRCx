import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { IRCMessage, RawMessageCategory } from '../services/IRCService';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { parseMessage, isVideoUrl, isAudioUrl, isDownloadableFileUrl } from '../utils/MessageParser';
import { LinkPreview } from './LinkPreview';
import { ImagePreview } from './ImagePreview';
import { MessageReactionsComponent } from './MessageReactions';
import { MediaMessageDisplay } from './MediaMessageDisplay';
import { connectionManager } from '../services/ConnectionManager';
import { layoutService } from '../services/LayoutService';
import { performanceService } from '../services/PerformanceService';
import { messageHistoryService } from '../services/MessageHistoryService';
import { highlightService } from '../services/HighlightService';
import { VideoPlayer } from './VideoPlayer';
import { AudioPlayer } from './AudioPlayer';
import { userManagementService } from '../services/UserManagementService';
import { dccChatService } from '../services/DCCChatService';
import { ircService } from '../services/IRCService';
import { formatIRCTextAsComponent } from '../utils/IRCFormatter';
import { MessageSearchBar, MessageSearchFilters } from './MessageSearchBar';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { settingsService } from '../services/SettingsService';

interface MessageAreaProps {
  messages: IRCMessage[];
  showRawCommands?: boolean;
  rawCategoryVisibility?: Record<RawMessageCategory, boolean>;
  hideJoinMessages?: boolean;
  hidePartMessages?: boolean;
  hideQuitMessages?: boolean;
  hideIrcServiceListenerMessages?: boolean;
  channel?: string;
  network?: string;
  tabId?: string; // Tab ID for media display (format: "channel::{network}::{channel}" or "query::{network}::{nick}")
  bottomInset?: number;
  searchVisible?: boolean;
  onSearchVisibleChange?: (visible: boolean) => void;
}

interface MessageItemProps {
  message: IRCMessage;
  timestampDisplay: 'always' | 'grouped' | 'never';
  timestampFormat: '12h' | '24h';
  colors: any;
  styles: any;
  currentNick: string;
  isGrouped: boolean;
  onNickLongPress?: (nick: string) => void;
  onPressMessage?: (message: IRCMessage) => void;
  onLongPressMessage?: (message: IRCMessage) => void;
  isSelected?: boolean;
  selectionMode?: boolean;
  showImages?: boolean;
  network?: string;
  channel?: string;
  tabId?: string;
  layoutWidth?: number;
}

// Memoized message item component for performance
const MessageItem = React.memo<MessageItemProps>(({
  message,
  timestampDisplay,
  timestampFormat,
  colors,
  styles,
  currentNick,
  isGrouped,
  onNickLongPress,
  onPressMessage,
  onLongPressMessage,
  isSelected = false,
  selectionMode = false,
  showImages = true,
  network,
  channel,
  tabId,
  layoutWidth,
}) => {
  const formatTimestamp = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    if (timestampFormat === '24h') {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } else {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }, [timestampFormat]);

  const getMessageColor = useCallback((type: IRCMessage['type']): string => {
    switch (type) {
      case 'error':
        return colors.error;
      case 'notice':
        return colors.warning;
      case 'join':
        return colors.joinMessage;
      case 'part':
        return colors.partMessage;
      case 'quit':
        return colors.quitMessage;
      case 'invite':
        return colors.inviteMessage;
      case 'monitor':
        return colors.monitorMessage;
      case 'topic':
        return colors.topicMessage;
      case 'mode':
        return colors.modeMessage || '#5DADE2'; // Light blue color for mode messages
      case 'raw':
        return colors.textSecondary;
      default:
        return colors.messageText;
    }
  }, [colors]);

  const isActionMessage = useCallback((text: string): boolean => {
    if (!text || text.length < 2) return false;
    return text.charCodeAt(0) === 0x01 && 
           text.startsWith('ACTION ', 1) && 
           text.charCodeAt(text.length - 1) === 0x01;
  }, []);

  const extractActionText = useCallback((text: string): string | null => {
    if (!isActionMessage(text)) return null;
    return text.slice(8, -1);
  }, [isActionMessage]);

  const renderMessageParts = useCallback((text: string, isAction: boolean = false) => {
    const parts = parseMessage(text);
    const imageUrls: string[] = [];
    const videoUrls: string[] = [];
    const audioUrls: string[] = [];
    const linkUrls: string[] = [];
    const fileUrls: string[] = [];
    const mediaIds: string[] = [];

    parts.forEach(part => {
      if (part.type === 'media' && part.mediaId) {
        mediaIds.push(part.mediaId);
      } else if (part.type === 'image' && part.url) {
        imageUrls.push(part.url);
      } else if (part.type === 'url' && part.url) {
        if (isVideoUrl(part.url)) {
          videoUrls.push(part.url);
        } else if (isAudioUrl(part.url)) {
          audioUrls.push(part.url);
        } else if (isDownloadableFileUrl(part.url)) {
          fileUrls.push(part.url);
        } else {
          linkUrls.push(part.url);
        }
      }
    });

    return {
      textParts: parts.filter(part =>
        part.type === 'text' ||
        (part.type === 'url' &&
          !imageUrls.includes(part.url || '') &&
          !videoUrls.includes(part.url || '') &&
          !audioUrls.includes(part.url || '') &&
          !fileUrls.includes(part.url || ''))
      ),
      imageUrls,
      videoUrls,
      audioUrls,
      fileUrls,
      mediaIds,
      linkUrls: linkUrls.filter(url =>
        !imageUrls.includes(url) &&
        !videoUrls.includes(url) &&
        !audioUrls.includes(url) &&
        !fileUrls.includes(url)
      ),
      isAction,
    };
  }, []);

  const actionText = useMemo(() => extractActionText(message.text), [message.text, extractActionText]);
  const parsed = useMemo(() => renderMessageParts(message.text, actionText !== null), [message.text, actionText, renderMessageParts]);

  const isHighlighted = useMemo(() => {
    if (message.type !== 'message') {
      return false;
    }
    // Check for custom highlight words
    if (highlightService.isHighlighted(message.text)) {
      return true;
    }
    // Check if the current user's nick is mentioned as a whole word
    if (currentNick) {
      const regex = new RegExp(`\\b${currentNick}\\b`, 'i');
      return regex.test(message.text);
    }
    return false;
  }, [message.text, message.type, currentNick]);

  const shouldShowTimestamp =
    timestampDisplay === 'always' ||
    (timestampDisplay === 'grouped' && !isGrouped);

  return (
    <TouchableOpacity
      activeOpacity={selectionMode ? 0.8 : 1}
      onLongPress={() => onLongPressMessage && onLongPressMessage(message)}
      onPress={() => onPressMessage && onPressMessage(message)}
      delayLongPress={180}
    >
      <View style={[
        styles.messageContainer,
        isGrouped && styles.groupedMessageContainer,
        isHighlighted && styles.highlightedMessage,
        message.status === 'pending' && styles.pendingMessage,
        isSelected && styles.selectedMessage,
      ]}>
        {shouldShowTimestamp && (
          <Text style={styles.timestamp}>
            {formatTimestamp(message.timestamp)}
          </Text>
        )}
        {message.type === 'raw' ? (
          formatIRCTextAsComponent(
            message.text.startsWith(`:${currentNick}!`)
              ? message.text.substring(message.text.indexOf(' ') + 1) // Remove the entire :nick!user@host part
              : message.text,
            StyleSheet.flatten([styles.messageText, { color: getMessageColor(message.type) }])
          )
        ) : message.type === 'message' ? (
          <>
            {actionText !== null ? (
              // ACTION (/me) message
              <View style={[styles.messageWrapper, layoutWidth ? { maxWidth: layoutWidth } : null]}>
                <View style={styles.messageContent}>
                  {!isGrouped && (
                    <Text style={[styles.messageText, { fontStyle: 'italic', color: colors.actionMessage }]}>
                      * <Text style={styles.nick} onLongPress={() => onNickLongPress && message.from && onNickLongPress(message.from)}>{message.from}</Text>{' '}
                    </Text>
                  )}
                  {formatIRCTextAsComponent(
                    message.text,
                    StyleSheet.flatten([styles.messageText, { fontStyle: 'italic', color: colors.actionMessage }])
                  )}
                </View>
                {showImages && parsed.mediaIds.map((mediaId, index) => {
                  // Use the MessageArea's tabId as the primary source for media decryption
                  // This ensures that media in a specific channel/query uses the correct encryption key
                  const mediaTabId = tabId;

                  return mediaTabId && network ? (
                    <MediaMessageDisplay
                      key={`media-${message.id}-${index}`}
                      mediaId={mediaId}
                      network={network}
                      tabId={mediaTabId}
                    />
                  ) : (
                    // If tabId is not available, we can't decrypt the media, so show an error or skip
                    <Text key={`media-${message.id}-${index}`} style={{color: 'red'}}>
                      [Encrypted media - unable to decrypt: no tab context]
                    </Text>
                  );
                })}
                {showImages && parsed.imageUrls.map((url, index) => (
                  <ImagePreview key={`img-${message.id}-${index}`} url={url} thumbnail />
                ))}
                {showImages && parsed.videoUrls.map((url, index) => (
                  url ? <VideoPlayer key={`video-${message.id}-${index}`} url={url} /> : null
                ))}
                {showImages && parsed.audioUrls.map((url, index) => (
                  url ? <AudioPlayer key={`audio-${message.id}-${index}`} url={url} /> : null
                ))}
                {showImages && parsed.fileUrls.map((url, index) => (
                  url ? <LinkPreview key={`file-${message.id}-${index}`} url={url} showDownloadButton /> : null
                ))}
                {showImages && parsed.linkUrls.map((url, index) => (
                  url ? <LinkPreview key={`link-${message.id}-${index}`} url={url} showDownloadButton={false} /> : null
                ))}
                <MessageReactionsComponent
                  messageId={message.id}
                  currentUserNick={currentNick}
                />
              </View>
            ) : (
              // Regular message
              <View style={[styles.messageWrapper, layoutWidth ? { maxWidth: layoutWidth } : null]}>
                <View style={styles.messageContent}>
                  {!isGrouped && (
                    <Text
                      style={styles.nick}
                      onLongPress={() => onNickLongPress && message.from && onNickLongPress(message.from)}
                    >
                      {message.from}
                    </Text>
                  )}
                  {formatIRCTextAsComponent(
                    message.text,
                    styles.messageText,
                  )}
                </View>
                {showImages && parsed.mediaIds.map((mediaId, index) => {
                  // Use the MessageArea's tabId as the primary source for media decryption
                  // This ensures that media in a specific channel/query uses the correct encryption key
                  const mediaTabId = tabId;

                  return mediaTabId && network ? (
                    <MediaMessageDisplay
                      key={`media-${message.id}-${index}`}
                      mediaId={mediaId}
                      network={network}
                      tabId={mediaTabId}
                    />
                  ) : (
                    // If tabId is not available, we can't decrypt the media, so show an error or skip
                    <Text key={`media-${message.id}-${index}`} style={{color: 'red'}}>
                      [Encrypted media - unable to decrypt: no tab context]
                    </Text>
                  );
                })}
                {showImages && parsed.imageUrls.map((url, index) => (
                  <ImagePreview key={`img-${message.id}-${index}`} url={url} thumbnail />
                ))}
                {showImages && parsed.videoUrls.map((url, index) => (
                  url ? <VideoPlayer key={`video-${message.id}-${index}`} url={url} /> : null
                ))}
                {showImages && parsed.audioUrls.map((url, index) => (
                  url ? <AudioPlayer key={`audio-${message.id}-${index}`} url={url} /> : null
                ))}
                {showImages && parsed.fileUrls.map((url, index) => (
                  url ? <LinkPreview key={`file-${message.id}-${index}`} url={url} showDownloadButton /> : null
                ))}
                {showImages && parsed.linkUrls.map((url, index) => (
                  url ? <LinkPreview key={`link-${message.id}-${index}`} url={url} showDownloadButton={false} /> : null
                ))}
                <MessageReactionsComponent
                  messageId={message.id}
                  currentUserNick={currentNick}
                />
              </View>
            )}
          </>
        ) : (
          <View style={styles.messageContent}>
            {message.type === 'notice' && message.from ? (
              <View style={styles.messageWrapper}>
                <Text
                  style={[styles.nick, { color: getMessageColor(message.type) }]}
                  onLongPress={() => onNickLongPress && message.from && onNickLongPress(message.from)}
                >
                  {message.from}
                </Text>
                {formatIRCTextAsComponent(
                  message.text,
                  StyleSheet.flatten([styles.messageText, { color: getMessageColor(message.type) }])
                )}
              </View>
            ) : (
              formatIRCTextAsComponent(
                message.type === 'join' || message.type === 'part' || message.type === 'quit'
                  ? `*** ${message.text}`
                  : message.text,
                StyleSheet.flatten([styles.messageText, { color: getMessageColor(message.type) }])
              )
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.text === nextProps.message.text &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.isGrouped === nextProps.isGrouped &&
    prevProps.timestampDisplay === nextProps.timestampDisplay &&
    prevProps.timestampFormat === nextProps.timestampFormat &&
    prevProps.currentNick === nextProps.currentNick &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.selectionMode === nextProps.selectionMode &&
    prevProps.showImages === nextProps.showImages &&
    prevProps.network === nextProps.network &&
    prevProps.channel === nextProps.channel &&
    prevProps.layoutWidth === nextProps.layoutWidth
  );
});

MessageItem.displayName = 'MessageItem';

export const MessageArea: React.FC<MessageAreaProps> = ({
  messages,
  showRawCommands = true,
  rawCategoryVisibility,
  hideJoinMessages = false,
  hidePartMessages = false,
  hideQuitMessages = false,
  hideIrcServiceListenerMessages = true,
  channel,
  network,
  tabId,
  bottomInset = 0,
  searchVisible: searchVisibleProp,
  onSearchVisibleChange,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const layoutConfig = layoutService.getConfig();
  const totalBottomInset = bottomInset + layoutConfig.navigationBarOffset;
  const styles = createStyles(colors, layoutConfig, totalBottomInset);
  const flatListRef = useRef<FlatList>(null);
  const [contextNick, setContextNick] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [copyStatus, setCopyStatus] = useState('');
  const selectionMode = selectedMessageIds.size > 0;
  const [showMessageAreaSearchButton, setShowMessageAreaSearchButton] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Search state (controlled or uncontrolled)
  const [internalSearchVisible, setInternalSearchVisible] = useState(false);
  const searchVisible = searchVisibleProp !== undefined ? searchVisibleProp : internalSearchVisible;
  const [searchFilters, setSearchFilters] = useState<MessageSearchFilters>({
    searchTerm: '',
    messageTypes: {
      message: true,
      notice: true,
      system: true,
      join: false,
      part: false,
      quit: false,
    },
  });

  const handleSearchVisibleChange = (visible: boolean) => {
    if (onSearchVisibleChange) {
      onSearchVisibleChange(visible);
    } else {
      setInternalSearchVisible(visible);
    }
  };

  const handleContainerLayout = useCallback((event: any) => {
    const nextWidth = Math.round(event?.nativeEvent?.layout?.width || 0);
    if (nextWidth > 0 && nextWidth !== containerWidth) {
      setContainerWidth(nextWidth);
    }
  }, [containerWidth]);

  useEffect(() => {
    const loadSetting = async () => {
      const enabled = await settingsService.getSetting('showMessageAreaSearchButton', false);
      setShowMessageAreaSearchButton(enabled);
    };
    loadSetting();

    const unsubscribe = settingsService.onSettingChange<boolean>('showMessageAreaSearchButton', (value) => {
      setShowMessageAreaSearchButton(Boolean(value));
    });

    return () => {
      unsubscribe && unsubscribe();
    };
  }, []);

  const connection = network ? connectionManager.getConnection(network) : null;
  const currentNick = connection?.ircService.getCurrentNick() || '';
  const handleNickAction = useCallback((action: string) => {
    if (!contextNick) return;
    const activeIrc: any = connection?.ircService || ircService;
    switch (action) {
      case 'whois':
        activeIrc.sendCommand(`WHOIS ${contextNick}`);
        break;
      case 'ctcp_ping':
        activeIrc.sendCTCPRequest(contextNick, 'PING', Date.now().toString());
        break;
      case 'ctcp_version':
        activeIrc.sendCTCPRequest(contextNick, 'VERSION');
        break;
      case 'ctcp_time':
        activeIrc.sendCTCPRequest(contextNick, 'TIME');
        break;
      case 'dcc_chat':
        dccChatService.initiateChat(activeIrc, contextNick, network || activeIrc.getNetworkName());
        break;
      case 'ignore_toggle': {
        const isIgnored = userManagementService.isUserIgnored(contextNick, undefined, undefined, network);
        if (isIgnored) {
          userManagementService.unignoreUser(contextNick, network);
        } else {
          userManagementService.ignoreUser(contextNick, undefined, network);
        }
        break;
      }
      case 'monitor_toggle': {
        if (typeof activeIrc.isMonitoring === 'function') {
          if (activeIrc.isMonitoring(contextNick)) {
            activeIrc.unmonitorNick(contextNick);
          } else {
            activeIrc.monitorNick(contextNick);
          }
        }
        break;
      }
      default:
        break;
    }
    setShowContextMenu(false);
  }, [contextNick, connection, network]);

  // Listen for performance config changes
  const [perfConfig, setPerfConfig] = useState(performanceService.getConfig());
  useEffect(() => {
    const unsubscribe = performanceService.onConfigChange((config) => {
      setPerfConfig(config);
    });
    return unsubscribe;
  }, []);

  // Listen for layout changes
  const [layoutState, setLayoutState] = useState(layoutConfig);
  useEffect(() => {
    const unsubscribe = layoutService.onConfigChange((config) => {
      setLayoutState(config);
    });
    return unsubscribe;
  }, []);

  // Listen for highlight word changes to trigger re-render
  const [highlightWords, setHighlightWords] = useState(highlightService.getHighlightWords());
  useEffect(() => {
    const unsubscribe = highlightService.onHighlightWordsChange(() => {
      setHighlightWords(highlightService.getHighlightWords());
    });
    return unsubscribe;
  }, []);

  // Message selection helpers for copy/paste
  const toggleMessageSelection = useCallback((message: IRCMessage) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(message.id)) {
        next.delete(message.id);
      } else {
        next.add(message.id);
      }
      return next;
    });
  }, []);

  const handleMessageLongPress = useCallback((message: IRCMessage) => {
    toggleMessageSelection(message);
  }, [toggleMessageSelection]);

  const handleMessagePress = useCallback((message: IRCMessage) => {
    if (!selectionMode) return;
    toggleMessageSelection(message);
  }, [selectionMode, toggleMessageSelection]);

  const clearSelection = useCallback(() => {
    setSelectedMessageIds(new Set());
  }, []);

  // Filter and group messages
  const displayMessages = useMemo(() => {
    const filtered = messages.filter((msg) => {
      if (msg.isRaw && !showRawCommands) return false;
      if (msg.isRaw && showRawCommands && rawCategoryVisibility) {
        const categoryKey = (msg.rawCategory || 'debug') as RawMessageCategory;
        if (rawCategoryVisibility[categoryKey] === false) {
          return false;
        }
      }
      return true;
    });
    const visibilityFiltered = filtered.filter(msg => {
      if (msg.type === 'join' && hideJoinMessages) return false;
      if (msg.type === 'part' && hidePartMessages) return false;
      if (msg.type === 'quit' && hideQuitMessages) return false;
      if (
        hideIrcServiceListenerMessages &&
        msg.isRaw &&
        msg.text.includes('Message listener registered')
      ) {
        return false;
      }
      return true;
    });

    // Apply search filtering
    const searchFiltered = visibilityFiltered.filter(msg => {
      // If search is not active, show all messages
      if (!searchVisible || !searchFilters.searchTerm.trim()) {
        return true;
      }

      // Filter by message type
      const typeMatch =
        (msg.type === 'message' && searchFilters.messageTypes.message) ||
        (msg.type === 'notice' && searchFilters.messageTypes.notice) ||
        (msg.type === 'join' && searchFilters.messageTypes.join) ||
        (msg.type === 'part' && searchFilters.messageTypes.part) ||
        (msg.type === 'quit' && searchFilters.messageTypes.quit) ||
        (['system', 'error', 'topic', 'mode', 'invite', 'monitor', 'raw'].includes(msg.type) && searchFilters.messageTypes.system);

      if (!typeMatch) return false;

      // Filter by search term (search in text, from nick, and channel)
      const searchTerm = searchFilters.searchTerm.toLowerCase();
      const textMatch = msg.text.toLowerCase().includes(searchTerm);
      const nickMatch = msg.from?.toLowerCase().includes(searchTerm);
      const channelMatch = msg.channel?.toLowerCase().includes(searchTerm);

      return textMatch || nickMatch || channelMatch;
    });

    // Apply message limit if enabled
    const limitedMessages = (perfConfig.enableMessageCleanup && searchFiltered.length > perfConfig.messageLimit)
      ? searchFiltered.slice(-perfConfig.messageLimit)
      : searchFiltered;

    // Group consecutive messages
    return limitedMessages.map((message, index) => {
      if (index === 0) return { ...message, isGrouped: false };

      const prevMessage = limitedMessages[index - 1];
      const timeDiff = message.timestamp - prevMessage.timestamp;
      const fiveMinutes = 5 * 60 * 1000;

      const isGrouped =
        message.type === 'message' &&
        prevMessage.type === 'message' &&
        !message.text.startsWith('\x01ACTION') && // Don't group /me actions
        !prevMessage.text.startsWith('\x01ACTION') &&
        message.from === prevMessage.from &&
        timeDiff < fiveMinutes;

      return { ...message, isGrouped };
    });
    
  }, [
    messages,
    showRawCommands,
    rawCategoryVisibility,
    perfConfig.enableMessageCleanup,
    perfConfig.messageLimit,
    hideJoinMessages,
    hidePartMessages,
    hideQuitMessages,
    hideIrcServiceListenerMessages,
    searchVisible,
    searchFilters,
  ]);

  // Track if we're at the bottom for auto-scroll
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [loadedMessageCount, setLoadedMessageCount] = useState(
    perfConfig.enableVirtualization 
      ? Math.min(perfConfig.maxVisibleMessages, displayMessages.length)
      : displayMessages.length
  );

  useEffect(() => {
    if (!perfConfig.enableVirtualization) {
      if (loadedMessageCount !== displayMessages.length) {
        setLoadedMessageCount(displayMessages.length);
      }
      return;
    }

    const minVisible = Math.min(perfConfig.maxVisibleMessages, displayMessages.length);
    if (loadedMessageCount < minVisible) {
      setLoadedMessageCount(minVisible);
      return;
    }
    if (loadedMessageCount > displayMessages.length) {
      setLoadedMessageCount(displayMessages.length);
    }
  }, [
    perfConfig.enableVirtualization,
    perfConfig.maxVisibleMessages,
    displayMessages.length,
    loadedMessageCount,
  ]);

  // Visible messages for virtualization
  const visibleMessages = useMemo(() => {
    if (!perfConfig.enableVirtualization) {
      return displayMessages;
    }
    // Show recent messages (from the end)
    return displayMessages.slice(-loadedMessageCount);
  }, [displayMessages, loadedMessageCount, perfConfig.enableVirtualization]);

  // Reverse messages for FlatList (newest at bottom)
  const reversedMessages = useMemo(() => {
    return [...visibleMessages].reverse();
  }, [visibleMessages]);

  // Auto-scroll to bottom when new messages arrive and we're at bottom
  useEffect(() => {
    if (isAtBottom && displayMessages.length > 0) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        } catch (error) {
          // Silently catch scroll errors to prevent crashes
          console.warn('Failed to scroll to offset:', error);
        }
      }, 100);
    }
  }, [displayMessages.length, isAtBottom]);

  // Handle scroll events
  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    const offsetFromBottom = contentOffset?.y ?? 0;
    setIsAtBottom(offsetFromBottom <= 100); // Consider "at bottom" if within 100px from new messages
  }, []);

  // Handle end reached (top of list) - load more old messages
  const handleEndReached = useCallback(() => {
    if (perfConfig.enableLazyLoading && loadedMessageCount < displayMessages.length) {
      const newCount = Math.min(
        loadedMessageCount + perfConfig.messageLoadChunk,
        displayMessages.length
      );
      setLoadedMessageCount(newCount);
      
      // Optionally load from history
      if (channel && network && newCount >= displayMessages.length) {
        // Load older messages from history
        messageHistoryService.loadMessages(network, channel).then(historyMessages => {
          // This would need to be integrated with the message state in App.tsx
          // For now, we just track that we've loaded all available messages
        }).catch(err => {
          console.error('Failed to load message history:', err);
        });
      }
    }
  }, [perfConfig.enableLazyLoading, loadedMessageCount, displayMessages.length, channel, network]);

  const handleCopySelected = useCallback(() => {
    if (!selectedMessageIds.size) return;
    const selected = displayMessages.filter(msg => selectedMessageIds.has(msg.id));
    if (!selected.length) return;

    const formatTimestamp = (timestamp: number): string => {
      const date = new Date(timestamp);
      if (layoutState.timestampFormat === '24h') {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const sorted = [...selected].sort((a, b) => a.timestamp - b.timestamp);
    const lines = sorted.map((msg) => {
      const ts = formatTimestamp(msg.timestamp);
      const prefix = msg.from ? `<${msg.from}> ` : '';
      const text = msg.type === 'message' ? msg.text : `*** ${msg.text}`;
      return `[${ts}] ${prefix}${text}`;
    });

    Clipboard.setString(lines.join('\n'));
    const message = sorted.length === 1
      ? t('Copied {count} message').replace('{count}', sorted.length.toString())
      : t('Copied {count} messages').replace('{count}', sorted.length.toString());
    setCopyStatus(message);
    setTimeout(() => setCopyStatus(''), 1500);
  }, [selectedMessageIds, displayMessages, layoutState.timestampFormat]);

  // Render message item
  const renderItem = useCallback(({ item }: { item: IRCMessage }) => {
    return (
      <MessageItem
        message={item}
        timestampDisplay={layoutState.timestampDisplay}
        timestampFormat={layoutState.timestampFormat}
        colors={colors}
        styles={styles}
        currentNick={currentNick}
        isGrouped={item.isGrouped || false}
        onNickLongPress={(nick) => {
          setContextNick(nick);
          setShowContextMenu(true);
        }}
        onLongPressMessage={handleMessageLongPress}
        onPressMessage={handleMessagePress}
        isSelected={selectedMessageIds.has(item.id)}
        selectionMode={selectionMode}
        showImages={perfConfig.imageLazyLoad !== false}
        network={network}
        channel={channel}
        tabId={tabId}
        layoutWidth={containerWidth}
      />
    );
  }, [
    layoutState.timestampDisplay,
    layoutState.timestampFormat,
    colors,
    styles,
    currentNick,
    handleMessageLongPress,
    handleMessagePress,
    selectedMessageIds,
    selectionMode,
    perfConfig.imageLazyLoad,
    network,
    channel,
    tabId,
    containerWidth,
  ]);

  // Get item key
  const getItemKey = useCallback((item: IRCMessage) => item.id, []);

  // Get item layout (for optimization)
  // NOTE: Disabled because fixed height estimation causes message overlap
  // when messages have variable heights (long text, images, links, etc.)
  // FlatList will automatically measure heights at the cost of some performance
  // const getItemLayout = useCallback((data: any, index: number) => {
  //   const estimatedHeight = 50;
  //   return {
  //     length: estimatedHeight,
  //     offset: estimatedHeight * index,
  //     index,
  //   };
  // }, []);

  // Search result count
  const searchResultCount = useMemo(() => {
    if (!searchVisible || !searchFilters.searchTerm.trim()) return undefined;
    return displayMessages.length;
  }, [searchVisible, searchFilters.searchTerm, displayMessages.length]);

  if (displayMessages.length === 0) {
    return (
      <View style={styles.wrapper} onLayout={handleContainerLayout}>
        <MessageSearchBar
          visible={searchVisible}
          onClose={() => handleSearchVisibleChange(false)}
          onSearch={(filters) => setSearchFilters(filters)}
          resultCount={searchResultCount}
        />
        <View style={styles.container}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('No messages yet')}</Text>
          </View>
        </View>
        {!searchVisible && showMessageAreaSearchButton && (
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => handleSearchVisibleChange(true)}
            activeOpacity={0.7}>
            <Icon name="search" size={20} color={colors.buttonPrimaryText || '#fff'} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (perfConfig.enableVirtualization) {
    return (
      <View style={styles.wrapper} onLayout={handleContainerLayout}>
        {/* Message Search Bar */}
        <MessageSearchBar
          visible={searchVisible}
          onClose={() => handleSearchVisibleChange(false)}
          onSearch={(filters) => setSearchFilters(filters)}
          resultCount={searchResultCount}
        />
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          renderItem={renderItem}
          keyExtractor={getItemKey}
          extraData={containerWidth}
          inverted // Show newest at bottom
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          initialNumToRender={perfConfig.maxVisibleMessages}
          maxToRenderPerBatch={perfConfig.messageLoadChunk}
          windowSize={10}
          removeClippedSubviews={false}
          maintainVisibleContentPosition={{ autoscrollToTopThreshold: 50, minIndexForVisible: 1 }}
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
        />
        {/* Search Button (Floating) */}
        {!searchVisible && !selectionMode && showMessageAreaSearchButton && (
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => handleSearchVisibleChange(true)}
            activeOpacity={0.7}>
            <Icon name="search" size={20} color={colors.buttonPrimaryText || '#fff'} />
          </TouchableOpacity>
        )}
        <NickContextMenu
          visible={showContextMenu}
          nick={contextNick}
          onClose={() => setShowContextMenu(false)}
          onAction={(action) => handleNickAction(action)}
          styles={styles}
          colors={colors}
          network={network}
          channel={channel}
          activeNick={currentNick}
          connection={connection}
        />
        {selectionMode && (
          <View style={styles.selectionBar}>
            <Text style={styles.selectionText}>{t('{count} selected').replace('{count}', selectedMessageIds.size.toString())}</Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity style={styles.selectionButton} onPress={handleCopySelected}>
                <Text style={styles.selectionButtonText}>{t('Copy')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.selectionButton, styles.selectionCancelButton]} onPress={clearSelection}>
                <Text style={[styles.selectionButtonText, styles.selectionCancelText]}>{t('Cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {copyStatus ? (
          <View style={styles.selectionToast}>
            <Text style={styles.selectionToastText}>{copyStatus}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // Fallback to ScrollView for small message lists
    return (
      <View style={styles.wrapper} onLayout={handleContainerLayout}>
        {/* Message Search Bar */}
        <MessageSearchBar
          visible={searchVisible}
          onClose={() => handleSearchVisibleChange(false)}
          onSearch={(filters) => setSearchFilters(filters)}
          resultCount={searchResultCount}
        />
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          renderItem={renderItem}
          keyExtractor={getItemKey}
          extraData={containerWidth}
          inverted
          onScroll={handleScroll}
          scrollEventThrottle={16}
          maintainVisibleContentPosition={{ autoscrollToTopThreshold: 50, minIndexForVisible: 1 }}
          removeClippedSubviews={false}
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
        />
      {/* Search Button (Floating) */}
      {!searchVisible && !selectionMode && showMessageAreaSearchButton && (
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => handleSearchVisibleChange(true)}
          activeOpacity={0.7}>
          <Icon name="search" size={20} color={colors.buttonPrimaryText || '#fff'} />
        </TouchableOpacity>
      )}
      <NickContextMenu
        visible={showContextMenu}
        nick={contextNick}
        onClose={() => setShowContextMenu(false)}
        onAction={(action) => handleNickAction(action)}
        styles={styles}
        colors={colors}
        network={network}
        channel={channel}
        activeNick={currentNick}
        connection={connection}
      />
      {selectionMode && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>{t('{count} selected').replace('{count}', selectedMessageIds.size.toString())}</Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity style={styles.selectionButton} onPress={handleCopySelected}>
              <Text style={styles.selectionButtonText}>{t('Copy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.selectionButton, styles.selectionCancelButton]} onPress={clearSelection}>
              <Text style={[styles.selectionButtonText, styles.selectionCancelText]}>{t('Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {copyStatus ? (
        <View style={styles.selectionToast}>
          <Text style={styles.selectionToastText}>{copyStatus}</Text>
        </View>
      ) : null}
    </View>
  );
};

interface NickContextMenuProps {
  visible: boolean;
  nick: string | null;
  onClose: () => void;
  onAction: (action: string) => void;
  styles: any;
  colors: any;
  network?: string;
  connection: any;
}

const NickContextMenu: React.FC<NickContextMenuProps> = ({
  visible,
  nick,
  onClose,
  onAction,
  styles,
  colors,
  network,
  connection,
}) => {
  const t = useT();
  const activeIrc: any = connection?.ircService || ircService;
  const isMonitoring = nick && typeof activeIrc?.isMonitoring === 'function' ? activeIrc.isMonitoring(nick) : false;
  const canMonitor = Boolean(activeIrc?.capEnabledSet && activeIrc.capEnabledSet.has && activeIrc.capEnabledSet.has('monitor'));
  const isIgnored = nick ? userManagementService.isUserIgnored(nick, undefined, undefined, network) : false;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableOpacity style={styles.contextOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.contextBox}>
          <Text style={styles.contextTitle}>{nick}</Text>
          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('whois')}>
            <Text style={styles.contextText}>{t('WHOIS')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_ping')}>
            <Text style={styles.contextText}>{t('CTCP PING')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_version')}>
            <Text style={styles.contextText}>{t('CTCP VERSION')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_time')}>
            <Text style={styles.contextText}>{t('CTCP TIME')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('dcc_chat')}>
            <Text style={styles.contextText}>{t('Start DCC Chat')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ignore_toggle')}>
            <Text style={styles.contextText}>{isIgnored ? t('Unignore User') : t('Ignore User')}</Text>
          </TouchableOpacity>
          {canMonitor && (
            <TouchableOpacity style={styles.contextItem} onPress={() => onAction('monitor_toggle')}>
              <Text style={styles.contextText}>{isMonitoring ? t('Unmonitor Nick') : t('Monitor Nick')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.contextCancel} onPress={onClose}>
            <Text style={styles.contextCancelText}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (colors: any, layoutConfig: any, bottomInset: number = 0) => {
  // Calculate the appropriate bottom position for the selection bar
  // MessageInput height is approximately 50-60px + bottom inset
  const messageInputHeight = 60;
  const selectionBarBottom = messageInputHeight + bottomInset + 12;
  const selectionToastBottom = selectionBarBottom + 68; // 68px above the selection bar

  return StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
  },
  container: {
    flex: 1,
    backgroundColor: colors.messageBackground,
  },
  contentContainer: {
    padding: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: layoutService.getFontSizePixels(),
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: layoutConfig.messageSpacing || 4,
    flexWrap: 'wrap',
    paddingVertical: (layoutConfig.messagePadding || 8) / 2,
    paddingHorizontal: layoutConfig.messagePadding || 8,
  },
  groupedMessageContainer: {
    marginTop: -4,
    paddingTop: 0,
    marginBottom: 4,
  },
  highlightedMessage: {
    backgroundColor: colors.highlightBackground,
    borderRadius: 4,
  },
  selectedMessage: {
    backgroundColor: colors.selectionBackground || 'rgba(33, 150, 243, 0.12)',
    borderRadius: 6,
  },
  pendingMessage: {
    opacity: 0.6,
  },
  timestamp: {
    color: colors.messageTimestamp,
    fontSize: Math.max(10, layoutService.getFontSizePixels() - 2),
    marginRight: 8,
    minWidth: 50,
  },
  messageWrapper: {
    flex: 1,
  },
  messageContent: {
    flexDirection: 'row',
    flex: 1,
    flexWrap: 'wrap',
  },
  linkText: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  nick: {
    color: colors.messageNick,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  messageText: {
    color: colors.messageText,
    fontSize: layoutService.getFontSizePixels(),
    flex: 1,
  },
  contextOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextBox: {
    width: '80%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  contextItem: {
    paddingVertical: 10,
  },
  contextText: {
    color: colors.text,
    fontSize: 14,
  },
  contextCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  contextCancelText: {
    color: colors.primary,
    fontWeight: '600',
  },
  selectionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: selectionBarBottom,
    backgroundColor: colors.surface || colors.messageBackground,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border || '#ddd',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  selectionText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  selectionButtonText: {
    color: colors.buttonPrimaryText || '#fff',
    fontWeight: '600',
  },
  selectionCancelButton: {
    backgroundColor: colors.surfaceAlt || colors.messageBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border || '#ccc',
  },
  selectionCancelText: {
    color: colors.text,
  },
  selectionToast: {
    position: 'absolute',
    bottom: selectionToastBottom,
    left: 24,
    right: 24,
    backgroundColor: colors.surface || 'rgba(0,0,0,0.75)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  selectionToastText: {
    color: colors.text,
    fontWeight: '600',
  },
  searchButton: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
};
