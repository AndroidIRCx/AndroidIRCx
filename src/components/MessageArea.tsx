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
import { parseMessage, isVideoUrl, isAudioUrl, isDownloadableFileUrl } from '../utils/MessageParser';
import { LinkPreview } from './LinkPreview';
import { ImagePreview } from './ImagePreview';
import { MessageReactionsComponent } from './MessageReactions';
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
  bottomInset?: number;
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

    parts.forEach(part => {
      if (part.type === 'image' && part.url) {
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
              <View style={styles.messageWrapper}>
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
                {parsed.imageUrls.map((url, index) => (
                  <ImagePreview key={`img-${message.id}-${index}`} url={url} thumbnail />
                ))}
                {parsed.videoUrls.map((url, index) => (
                  url ? <VideoPlayer key={`video-${message.id}-${index}`} url={url} /> : null
                ))}
                {parsed.audioUrls.map((url, index) => (
                  url ? <AudioPlayer key={`audio-${message.id}-${index}`} url={url} /> : null
                ))}
                {parsed.fileUrls.map((url, index) => (
                  url ? <LinkPreview key={`file-${message.id}-${index}`} url={url} showDownloadButton /> : null
                ))}
                {parsed.linkUrls.map((url, index) => (
                  url ? <LinkPreview key={`link-${message.id}-${index}`} url={url} showDownloadButton={false} /> : null
                ))}
                <MessageReactionsComponent
                  messageId={message.id}
                  currentUserNick={currentNick}
                />
              </View>
            ) : (
              // Regular message
              <View style={styles.messageWrapper}>
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
                {parsed.imageUrls.map((url, index) => (
                  <ImagePreview key={`img-${message.id}-${index}`} url={url} thumbnail />
                ))}
                {parsed.videoUrls.map((url, index) => (
                  url ? <VideoPlayer key={`video-${message.id}-${index}`} url={url} /> : null
                ))}
                {parsed.audioUrls.map((url, index) => (
                  url ? <AudioPlayer key={`audio-${message.id}-${index}`} url={url} /> : null
                ))}
                {parsed.fileUrls.map((url, index) => (
                  url ? <LinkPreview key={`file-${message.id}-${index}`} url={url} showDownloadButton /> : null
                ))}
                {parsed.linkUrls.map((url, index) => (
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
            {formatIRCTextAsComponent(
              message.type === 'join' || message.type === 'part' || message.type === 'quit'
                ? `*** ${message.text}`
                : message.text,
              StyleSheet.flatten([styles.messageText, { color: getMessageColor(message.type) }])
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
    prevProps.selectionMode === nextProps.selectionMode
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
  bottomInset = 0,
}) => {
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

  const perfConfig = performanceService.getConfig();
  
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

    // Apply message limit if enabled
    const limitedMessages = (perfConfig.enableMessageCleanup && visibilityFiltered.length > perfConfig.messageLimit)
      ? visibilityFiltered.slice(-perfConfig.messageLimit)
      : visibilityFiltered;

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
  ]);

  // Track if we're at the bottom for auto-scroll
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [loadedMessageCount, setLoadedMessageCount] = useState(
    perfConfig.enableVirtualization 
      ? Math.min(perfConfig.maxVisibleMessages, displayMessages.length)
      : displayMessages.length
  );

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
    setCopyStatus(`Copied ${sorted.length} message${sorted.length !== 1 ? 's' : ''}`);
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
      />
    );
  }, [layoutState.timestampDisplay, layoutState.timestampFormat, colors, styles, currentNick, handleMessageLongPress, handleMessagePress, selectedMessageIds, selectionMode]);

  // Get item key
  const getItemKey = useCallback((item: IRCMessage) => item.id, []);

  // Get item layout (for optimization)
  const getItemLayout = useCallback((data: any, index: number) => {
    // Estimate item height (can be improved with actual measurement)
    const estimatedHeight = 50;
    return {
      length: estimatedHeight,
      offset: estimatedHeight * index,
      index,
    };
  }, []);

  if (displayMessages.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No messages yet</Text>
        </View>
      </View>
    );
  }

  if (perfConfig.enableVirtualization) {
    return (
      <View style={styles.wrapper}>
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          renderItem={renderItem}
          keyExtractor={getItemKey}
          inverted // Show newest at bottom
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          getItemLayout={getItemLayout}
          initialNumToRender={perfConfig.maxVisibleMessages}
          maxToRenderPerBatch={perfConfig.messageLoadChunk}
          windowSize={10}
          removeClippedSubviews={true}
          maintainVisibleContentPosition={{ autoscrollToTopThreshold: 50, minIndexForVisible: 1 }}
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
        />
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
            <Text style={styles.selectionText}>{selectedMessageIds.size} selected</Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity style={styles.selectionButton} onPress={handleCopySelected}>
                <Text style={styles.selectionButtonText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.selectionButton, styles.selectionCancelButton]} onPress={clearSelection}>
                <Text style={[styles.selectionButtonText, styles.selectionCancelText]}>Cancel</Text>
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
      <View style={styles.wrapper}>
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          renderItem={renderItem}
          keyExtractor={getItemKey}
          inverted
          onScroll={handleScroll}
          scrollEventThrottle={16}
          maintainVisibleContentPosition={{ autoscrollToTopThreshold: 50, minIndexForVisible: 1 }}
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
        />
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
          <Text style={styles.selectionText}>{selectedMessageIds.size} selected</Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity style={styles.selectionButton} onPress={handleCopySelected}>
              <Text style={styles.selectionButtonText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.selectionButton, styles.selectionCancelButton]} onPress={clearSelection}>
              <Text style={[styles.selectionButtonText, styles.selectionCancelText]}>Cancel</Text>
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
            <Text style={styles.contextText}>WHOIS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_ping')}>
            <Text style={styles.contextText}>CTCP PING</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_version')}>
            <Text style={styles.contextText}>CTCP VERSION</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ctcp_time')}>
            <Text style={styles.contextText}>CTCP TIME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('dcc_chat')}>
            <Text style={styles.contextText}>Start DCC Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contextItem} onPress={() => onAction('ignore_toggle')}>
            <Text style={styles.contextText}>{isIgnored ? 'Unignore User' : 'Ignore User'}</Text>
          </TouchableOpacity>
          {canMonitor && (
            <TouchableOpacity style={styles.contextItem} onPress={() => onAction('monitor_toggle')}>
              <Text style={styles.contextText}>{isMonitoring ? 'Unmonitor Nick' : 'Monitor Nick'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.contextCancel} onPress={onClose}>
            <Text style={styles.contextCancelText}>Close</Text>
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
    fontSize: layoutConfig.fontSize === 'small' ? 10 : layoutConfig.fontSize === 'large' ? 14 : layoutConfig.fontSize === 'xlarge' ? 16 : 12,
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
    color: colors.buttonText || '#fff',
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
});
};
