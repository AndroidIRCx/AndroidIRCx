/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  PanResponder,
  TextStyle,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import Clipboard from '@react-native-clipboard/clipboard';
import { IRCMessage, RawMessageCategory, ChannelUser } from '../services/IRCService';
import { ChannelTab } from '../types';
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
import { userManagementService, BlacklistActionType } from '../services/UserManagementService';
import { dccChatService } from '../services/DCCChatService';
import { ircService } from '../services/IRCService';
import { encryptedDMService } from '../services/EncryptedDMService';
import { channelEncryptionService } from '../services/ChannelEncryptionService';
import { formatIRCTextAsComponent, formatIRCTextWithLinks } from '../utils/IRCFormatter';
import { MessageSearchBar, MessageSearchFilters } from './MessageSearchBar';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { NickContextMenu } from './NickContextMenu';
import { settingsService } from '../services/SettingsService';
import { MessageFormatPart, MessageFormatStyle, ThemeMessageFormats } from '../services/ThemeService';
import { getDefaultMessageFormats } from '../utils/MessageFormatDefaults';
import { useTabStore } from '../stores/tabStore';
import { queryTabId, sortTabsGrouped } from '../utils/tabUtils';
import { soundService } from '../services/SoundService';
import { SoundEventType } from '../types/sound';
import { useUIStore } from '../stores/uiStore';
import { banService } from '../services/BanService';
import KickBanModal from './KickBanModal';

interface MessageAreaProps {
  messages: IRCMessage[];
  channelUsers?: ChannelUser[];
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
  channelUsers?: ChannelUser[];
  timestampDisplay: 'always' | 'grouped' | 'never';
  timestampFormat: '12h' | '24h';
  colors: any;
  styles: any;
  currentNick: string;
  isGrouped: boolean;
  onNickLongPress?: (nick: string) => void;
  onNickPress?: (nick: string) => void;
  onChannelPress?: (channel: string) => void;
  onPressMessage?: (message: IRCMessage) => void;
  onLongPressMessage?: (message: IRCMessage) => void;
  isSelected?: boolean;
  selectionMode?: boolean;
  showImages?: boolean;
  network?: string;
  channel?: string;
  tabId?: string;
  layoutWidth?: number;
  messageFormats?: ThemeMessageFormats;
}

const applyMessageFormatStyle = (
  baseStyle: TextStyle,
  formatStyle?: MessageFormatStyle,
): TextStyle => {
  if (!formatStyle) {
    return baseStyle;
  }

  const textStyle: TextStyle = { ...baseStyle };

  if (formatStyle.bold) {
    textStyle.fontWeight = 'bold';
  }
  if (formatStyle.italic) {
    textStyle.fontStyle = 'italic';
  }
  if (formatStyle.underline) {
    textStyle.textDecorationLine = textStyle.textDecorationLine
      ? `${textStyle.textDecorationLine} underline`
      : 'underline';
  }
  if (formatStyle.strikethrough) {
    textStyle.textDecorationLine = textStyle.textDecorationLine
      ? `${textStyle.textDecorationLine} line-through`
      : 'line-through';
  }
  if (formatStyle.color) {
    textStyle.color = formatStyle.color;
  }
  if (formatStyle.backgroundColor) {
    textStyle.backgroundColor = formatStyle.backgroundColor;
  }
  if (formatStyle.reverse) {
    const prevColor = textStyle.color;
    textStyle.color = textStyle.backgroundColor;
    textStyle.backgroundColor = prevColor;
  }

  return textStyle;
};

// Memoized message item component for performance
const MessageItem = React.memo<MessageItemProps>(({
  message,
  channelUsers,
  timestampDisplay,
  timestampFormat,
  colors,
  styles,
  currentNick,
  isGrouped,
  onNickLongPress,
  onNickPress,
  onChannelPress,
  onPressMessage,
  onLongPressMessage,
  isSelected = false,
  selectionMode = false,
  showImages = true,
  network,
  channel,
  tabId,
  layoutWidth,
  messageFormats,
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
        return colors.noticeMessage || colors.warning;
      case 'join':
        return colors.joinMessage;
      case 'part':
        return colors.partMessage;
      case 'quit':
        return colors.quitMessage;
      case 'kick':
        return colors.kickMessage || colors.error;
      case 'nick':
        return colors.nickMessage || colors.info;
      case 'invite':
        return colors.inviteMessage;
      case 'monitor':
        return colors.monitorMessage;
      case 'topic':
        return colors.topicMessage;
      case 'mode':
        return colors.modeMessage || '#5DADE2'; // Light blue color for mode messages
      case 'raw':
        return colors.rawMessage || colors.textSecondary;
      case 'ctcp':
        return colors.ctcpMessage || colors.info;
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

  const actionMessageColor = isHighlighted ? colors.highlightText : colors.actionMessage;

  const shouldShowTimestamp =
    timestampDisplay === 'always' ||
    (timestampDisplay === 'grouped' && !isGrouped);

  const normalizedMessageFormats = useMemo(
    () => (messageFormats ? { ...getDefaultMessageFormats(), ...messageFormats } : null),
    [messageFormats],
  );

  const formatParts = useMemo(() => {
    if (!normalizedMessageFormats) {
      return null;
    }

    if (message.type === 'message') {
      if (actionText !== null) {
        return isHighlighted ? normalizedMessageFormats.actionMention : normalizedMessageFormats.action;
      }
      return isHighlighted ? normalizedMessageFormats.messageMention : normalizedMessageFormats.message;
    }

    if (message.type === 'notice') {
      return normalizedMessageFormats.notice;
    }

    if (message.type === 'join') {
      return normalizedMessageFormats.join;
    }
    if (message.type === 'part') {
      return normalizedMessageFormats.part;
    }
    if (message.type === 'quit') {
      return normalizedMessageFormats.quit;
    }
    if (message.type === 'kick') {
      return normalizedMessageFormats.kick;
    }
    if (message.type === 'nick') {
      return normalizedMessageFormats.nick;
    }
    if (message.type === 'invite') {
      return normalizedMessageFormats.invite;
    }
    if (message.type === 'monitor') {
      return normalizedMessageFormats.monitor;
    }
    if (message.type === 'mode') {
      return normalizedMessageFormats.mode;
    }
    if (message.type === 'topic') {
      return normalizedMessageFormats.topic;
    }
    if (message.type === 'raw') {
      return normalizedMessageFormats.raw;
    }
    if (message.type === 'error') {
      return normalizedMessageFormats.error;
    }
    if (message.type === 'ctcp') {
      return normalizedMessageFormats.ctcp;
    }
    if (['join', 'part', 'quit', 'invite', 'monitor', 'mode', 'topic'].includes(message.type)) {
      return normalizedMessageFormats.event;
    }

    return null;
  }, [normalizedMessageFormats, message.type, isHighlighted, actionText]);

  const baseLineColor =
    message.type === 'message'
      ? actionText !== null
        ? actionMessageColor
        : isHighlighted
          ? colors.highlightText
          : colors.messageText
      : getMessageColor(message.type);

  const baseLineStyle = StyleSheet.flatten([styles.messageText, { color: baseLineColor }]);
  const inlineBaseStyle: TextStyle = {
    ...baseLineStyle,
    flex: undefined,
    flexGrow: undefined,
    flexShrink: undefined,
  };

  const nickMap = useMemo(() => {
    const map = new Map<string, string>();
    (channelUsers || []).forEach(user => {
      if (!user?.nick) return;
      map.set(user.nick.toLowerCase(), user.nick);
    });
    return map;
  }, [channelUsers]);

  const containsIrcFormatting = useCallback((text: string | undefined | null): boolean => {
    if (!text) return false;
    return /[\x02\x03\x0F\x16\x1D\x1E\x1F]/.test(text);
  }, []);

  const renderTextWithNickActions = useCallback((
    text: string,
    baseStyle: TextStyle,
    keyPrefix: string,
  ) => {
    if (!text) {
      return <Text key={`${keyPrefix}-empty`} style={baseStyle} />;
    }
    // If the message uses IRC formatting codes, fall back to the existing formatter.
    if (containsIrcFormatting(text)) {
      return React.cloneElement(formatIRCTextAsComponent(text, baseStyle), {
        key: `${keyPrefix}-formatted`,
      });
    }

    const tokens = text.match(/\S+|\s+/g) || [];
    return (
      <Text key={`${keyPrefix}-text`} style={baseStyle}>
        {tokens.map((token, index) => {
          // Preserve whitespace as-is.
          if (/^\s+$/.test(token)) {
            return (
              <Text key={`${keyPrefix}-ws-${index}`} style={baseStyle}>
                {token}
              </Text>
            );
          }

          // Check for channel names (e.g., #channel, &channel)
          // Channel pattern: starts with # or &, followed by valid channel characters
          const channelMatch = token.match(/^([^#&]*)([#&][^\s,\x07\x00\r\n:]+)(.*)$/);
          if (channelMatch && onChannelPress) {
            const [, leadingCh, channelName, trailingCh] = channelMatch;
            const joinChannel = () => {
              onChannelPress(channelName);
            };
            return (
              <Text key={`${keyPrefix}-channel-${index}`} style={baseStyle}>
                {leadingCh}
                <Text style={[styles.nick, { color: colors.primary }]} onPress={joinChannel}>
                  {channelName}
                </Text>
                {trailingCh}
              </Text>
            );
          }

          // Extract a potential nick while preserving surrounding punctuation.
          const match = token.match(/^([^A-Za-z0-9_`^\\\-\[\]{}|]*)(@?[A-Za-z0-9_`^\\\-\[\]{}|]+)([^A-Za-z0-9_`^\\\-\[\]{}|]*)$/);
          if (!match) {
            return (
              <Text key={`${keyPrefix}-plain-${index}`} style={baseStyle}>
                {token}
              </Text>
            );
          }

          const [, leading, core, trailing] = match;
          const coreNick = core.startsWith('@') ? core.slice(1) : core;
          const resolved = nickMap.get(coreNick.toLowerCase());
          if (!resolved) {
            return (
              <Text key={`${keyPrefix}-plain-${index}`} style={baseStyle}>
                {token}
              </Text>
            );
          }

          const openMenu = () => {
            if (onNickLongPress) {
              onNickLongPress(resolved);
            }
          };

          return (
            <Text key={`${keyPrefix}-nick-${index}`} style={baseStyle}>
              {leading}
              <Text style={styles.nick} onPress={openMenu} onLongPress={openMenu}>
                {core}
              </Text>
              {trailing}
            </Text>
          );
        })}
      </Text>
    );
  }, [containsIrcFormatting, nickMap, onNickLongPress, onChannelPress, styles.nick, colors.primary]);

  const renderFormattedParts = useCallback(
    (parts: MessageFormatPart[]) => {
      const hostmask = message.username && message.hostname
        ? `${message.from || ''}!${message.username}@${message.hostname}`
        : '';
      const tokenValues: Record<string, string> = {
        time: shouldShowTimestamp ? formatTimestamp(message.timestamp) : '',
        nick: !isGrouped ? message.from || '' : '',
        oldnick: message.oldNick || '',
        newnick: message.newNick || '',
        message: actionText !== null ? actionText : message.text,
        channel: message.channel || channel || '',
        network: message.network || network || '',
        account: message.account || '',
        username: message.username || '',
        hostname: message.hostname || '',
        hostmask,
        target: message.target || message.channel || channel || '',
        mode: message.mode || '',
        topic: message.topic || '',
        reason: message.reason || '',
        numeric: message.numeric || '',
        command: message.command || '',
      };

      return parts.map((part, index) => {
        if (part.type === 'text') {
          if (!part.value) {
            return null;
          }
          return (
            <Text key={`part-${index}`} style={applyMessageFormatStyle(inlineBaseStyle, part.style)}>
              {part.value}
            </Text>
          );
        }

        if (part.value === 'message') {
          if (!tokenValues.message) {
            return null;
          }
          return React.cloneElement(
            formatIRCTextAsComponent(tokenValues.message, applyMessageFormatStyle(inlineBaseStyle, part.style)),
            { key: `part-${index}` },
          );
        }

        const tokenValue = tokenValues[part.value] || '';
        if (!tokenValue) {
          return null;
        }

        if (part.value === 'nick') {
          return (
            <Text
              key={`part-${index}`}
              style={applyMessageFormatStyle(inlineBaseStyle, part.style)}
              onPress={() => onNickLongPress && message.from && onNickLongPress(message.from)}
              onLongPress={() => onNickLongPress && message.from && onNickLongPress(message.from)}
            >
              {tokenValue}
            </Text>
          );
        }

        return (
          <Text key={`part-${index}`} style={applyMessageFormatStyle(inlineBaseStyle, part.style)}>
            {tokenValue}
          </Text>
        );
      });
    },
    [
      actionText,
      inlineBaseStyle,
      channel,
      formatTimestamp,
      isGrouped,
      message.account,
      message.channel,
      message.command,
      message.hostname,
      message.mode,
      message.network,
      message.numeric,
      message.reason,
      message.text,
      message.timestamp,
      message.from,
      message.target,
      message.topic,
      message.username,
      network,
      onNickLongPress,
      shouldShowTimestamp,
    ],
  );

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
        {!formatParts && shouldShowTimestamp && (
          <Text style={styles.timestamp}>
            {formatTimestamp(message.timestamp)}
          </Text>
        )}
        {message.type === 'raw' ? (
          message.whoisData?.channels ? (
            // Render WHOIS channels with clickable links
            <Text style={StyleSheet.flatten([styles.messageText, { color: getMessageColor(message.type) }])}>
              <Text>*** {message.whoisData.nick} is on channels: </Text>
              {message.whoisData.channels.map((channel, index) => {
                const cleanChannel = channel.replace(/^[~&@%+]/, '');
                const prefix = channel.match(/^[~&@%+]/)?.[0] || '';
                return (
                  <React.Fragment key={channel}>
                    {index > 0 && <Text>, </Text>}
                    {prefix && <Text>{prefix}</Text>}
                    {onChannelPress ? (
                      <Text
                        style={{ color: colors.primary, textDecorationLine: 'underline' }}
                        onPress={() => onChannelPress(cleanChannel)}
                      >
                        {cleanChannel}
                      </Text>
                    ) : (
                      <Text>{cleanChannel}</Text>
                    )}
                  </React.Fragment>
                );
              })}
            </Text>
          ) : message.whoisData?.nick ? (
            // Render other WHOIS messages with clickable nick
            <Text style={StyleSheet.flatten([styles.messageText, { color: getMessageColor(message.type) }])}>
              {(() => {
                const parts = message.text.split(message.whoisData.nick);
                return (
                  <>
                    {parts[0]}
                    {onNickPress ? (
                      <Text
                        style={{ color: colors.primary, textDecorationLine: 'underline' }}
                        onPress={() => onNickPress(message.whoisData!.nick!)}
                      >
                        {message.whoisData.nick}
                      </Text>
                    ) : (
                      message.whoisData.nick
                    )}
                    {parts.slice(1).join(message.whoisData.nick)}
                  </>
                );
              })()}
            </Text>
          ) : (
            formatIRCTextAsComponent(
              message.text.startsWith(`:${currentNick}!`)
                ? message.text.substring(message.text.indexOf(' ') + 1) // Remove the entire :nick!user@host part
                : message.text,
              StyleSheet.flatten([styles.messageText, { color: getMessageColor(message.type) }])
            )
          )
        ) : message.type === 'message' ? (
          <>
            {formatParts ? (
              <View style={[styles.messageWrapper, layoutWidth ? { maxWidth: layoutWidth } : null]}>
                <View style={[
                  styles.messageContent,
                  message.text?.includes('\n') ? { flexDirection: 'column' } : null
                ]}>
                  <Text style={styles.messageText}>
                    {renderFormattedParts(formatParts)}
                  </Text>
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
            ) : actionText !== null ? (
              // ACTION (/me) message
              <View style={[styles.messageWrapper, layoutWidth ? { maxWidth: layoutWidth } : null]}>
                <View style={[
                  styles.messageContent,
                  message.text?.includes('\n') ? { flexDirection: 'column' } : null
                ]}>
                  {!isGrouped && (
                    <Text style={[styles.messageText, { fontStyle: 'italic', color: actionMessageColor }]}>
                      * <Text style={styles.nick} onPress={() => onNickLongPress && message.from && onNickLongPress(message.from)} onLongPress={() => onNickLongPress && message.from && onNickLongPress(message.from)}>{message.from}</Text>{' '}
                    </Text>
                  )}
                  {renderTextWithNickActions(
                    message.text,
                    StyleSheet.flatten([styles.messageText, { fontStyle: 'italic', color: actionMessageColor }]),
                    `action-${message.id}`,
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
                <View style={[
                  styles.messageContent,
                  message.text?.includes('\n') ? { flexDirection: 'column' } : null
                ]}>
                  {!isGrouped && (
                    <Text
                      style={styles.nick}
                      onPress={() => onNickLongPress && message.from && onNickLongPress(message.from)}
                      onLongPress={() => onNickLongPress && message.from && onNickLongPress(message.from)}
                    >
                      {message.from}
                    </Text>
                  )}
                  {renderTextWithNickActions(
                    message.text,
                    isHighlighted
                      ? StyleSheet.flatten([styles.messageText, { color: colors.highlightText }])
                      : styles.messageText,
                    `msg-${message.id}`,
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
          ) : formatParts ? (
          <View style={styles.messageContent}>
            <Text style={styles.messageText}>
              {renderFormattedParts(formatParts)}
            </Text>
          </View>
          ) : (
          <View style={styles.messageContent}>
            {message.type === 'notice' && message.from ? (
              <View style={styles.messageWrapper}>
                <Text
                  style={[styles.nick, { color: getMessageColor(message.type) }]}
                  onPress={() => onNickLongPress && message.from && onNickLongPress(message.from)}
                  onLongPress={() => onNickLongPress && message.from && onNickLongPress(message.from)}
                >
                  {message.from}
                </Text>
                {renderTextWithNickActions(
                  message.text,
                  StyleSheet.flatten([styles.messageText, { color: getMessageColor(message.type) }]),
                  `notice-${message.id}`,
                )}
              </View>
            ) : message.type === 'topic' ? (
              // Topic messages with clickable links (no preview)
              formatIRCTextWithLinks(
                message.text,
                StyleSheet.flatten([styles.messageText, { color: getMessageColor(message.type) }]),
                colors.primary
              )
            ) : (
              renderTextWithNickActions(
                message.type === 'join' || message.type === 'part' || message.type === 'quit'
                  ? `*** ${message.text}`
                  : message.text,
                StyleSheet.flatten([styles.messageText, { color: getMessageColor(message.type) }]),
                `sys-${message.id}`,
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
    prevProps.layoutWidth === nextProps.layoutWidth &&
    prevProps.channelUsers === nextProps.channelUsers
  );
});

MessageItem.displayName = 'MessageItem';

export const MessageArea: React.FC<MessageAreaProps> = ({
  messages,
  channelUsers,
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
  const { theme, colors } = useTheme();
  const layoutConfig = layoutService.getConfig();
  const totalBottomInset = bottomInset + layoutConfig.navigationBarOffset;
  const styles = createStyles(colors, layoutConfig, totalBottomInset);
  const flatListRef = useRef<FlatList>(null);
  const [contextNick, setContextNick] = useState<string | null>(null);
  const [contextUser, setContextUser] = useState<ChannelUser | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showKickBanModal, setShowKickBanModal] = useState(false);
  const [kickBanTarget, setKickBanTarget] = useState<{ nick: string; user?: string; host?: string } | null>(null);
  const [kickBanMode, setKickBanMode] = useState<'kick' | 'ban' | 'kickban'>('kickban');
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [showBlacklistActionPicker, setShowBlacklistActionPicker] = useState(false);
  const [blacklistAction, setBlacklistAction] = useState<BlacklistActionType>('ban');
  const [blacklistMaskChoice, setBlacklistMaskChoice] = useState<string>('nick');
  const [blacklistReason, setBlacklistReason] = useState('');
  const [blacklistCustomCommand, setBlacklistCustomCommand] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showKeyQr, setShowKeyQr] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrType, setQrType] = useState<'bundle' | 'fingerprint'>('bundle');
  const [showKeyScan, setShowKeyScan] = useState(false);
  const [scanError, setScanError] = useState('');
  const [allowQrVerification, setAllowQrVerification] = useState(true);
  const [allowFileExchange, setAllowFileExchange] = useState(true);
  const [allowNfcExchange, setAllowNfcExchange] = useState(true);
  const [tabSortAlphabetical, setTabSortAlphabetical] = useState(true);
  const [isServerOper, setIsServerOper] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [copyStatus, setCopyStatus] = useState('');
  const selectionMode = selectedMessageIds.size > 0;
  const [showMessageAreaSearchButton, setShowMessageAreaSearchButton] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const device = useCameraDevice('back');
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const scanHandledRef = useRef(false);
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (!showKeyScan || scanHandledRef.current) return;
      const code = codes[0]?.value || codes[0]?.rawValue;
      if (!code) return;
      scanHandledRef.current = true;
      setShowKeyScan(false);
      setScanError('');
      handleExternalPayload(code);
    },
  });
  const selectionBarPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const selectionBarPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
      onPanResponderGrant: () => {
        selectionBarPan.setOffset({
          x: selectionBarPan.x.__getValue(),
          y: selectionBarPan.y.__getValue(),
        });
        selectionBarPan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: selectionBarPan.x, dy: selectionBarPan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => selectionBarPan.flattenOffset(),
      onPanResponderTerminate: () => selectionBarPan.flattenOffset(),
    })
  ).current;

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
    if (!selectionMode) {
      selectionBarPan.setValue({ x: 0, y: 0 });
      selectionBarPan.setOffset({ x: 0, y: 0 });
    }
  }, [selectionMode, selectionBarPan]);

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

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const qr = await settingsService.getSetting('securityAllowQrVerification', true);
      const file = await settingsService.getSetting('securityAllowFileExchange', true);
      const nfc = await settingsService.getSetting('securityAllowNfcExchange', true);
      if (mounted) {
        setAllowQrVerification(qr);
        setAllowFileExchange(file);
        setAllowNfcExchange(nfc);
      }
    };
    load();
    const unsubQr = settingsService.onSettingChange('securityAllowQrVerification', (v) => setAllowQrVerification(Boolean(v)));
    const unsubFile = settingsService.onSettingChange('securityAllowFileExchange', (v) => setAllowFileExchange(Boolean(v)));
    const unsubNfc = settingsService.onSettingChange('securityAllowNfcExchange', (v) => setAllowNfcExchange(Boolean(v)));
    return () => {
      mounted = false;
      unsubQr();
      unsubFile();
      unsubNfc();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadSort = async () => {
      const sort = await settingsService.getSetting('tabSortAlphabetical', true);
      if (mounted) setTabSortAlphabetical(Boolean(sort));
    };
    loadSort();
    const unsub = settingsService.onSettingChange('tabSortAlphabetical', (value) => {
      setTabSortAlphabetical(Boolean(value));
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    const oper = typeof activeIrc?.isServerOper === 'function' ? activeIrc.isServerOper() : false;
    setIsServerOper(oper);
  }, [activeIrc]);

  const connection = network ? connectionManager.getConnection(network) : null;
  const currentNick = connection?.ircService.getCurrentNick() || '';
  const tabs = useTabStore(state => state.tabs);
  const setTabs = useTabStore(state => state.setTabs);
  const setActiveTabId = useTabStore(state => state.setActiveTabId);
  const getTabById = useTabStore(state => state.getTabById);
  const activeTab = tabId ? getTabById(tabId) : undefined;
  const resolveContextUser = useCallback((nick: string | null) => {
    if (!nick || !channel) return null;
    if (channelUsers && channelUsers.length > 0) {
      return channelUsers.find(user => user.nick.toLowerCase() === nick.toLowerCase()) || null;
    }
    const activeIrc: any = connection?.ircService || ircService;
    if (typeof activeIrc.getChannelUsers !== 'function') return null;
    const users = activeIrc.getChannelUsers(channel) as ChannelUser[];
    return users.find(user => user.nick.toLowerCase() === nick.toLowerCase()) || null;
  }, [channel, channelUsers, connection]);

  const blacklistActionOptions: Array<{ id: BlacklistActionType; label: string }> = useMemo(() => ([
    { id: 'ignore', label: t('Ignore (local)') },
    { id: 'ban', label: t('Ban') },
    { id: 'kick_ban', label: t('Kick + Ban') },
    { id: 'kill', label: t('Kill') },
    { id: 'os_kill', label: t('OperServ Kill') },
    { id: 'akill', label: t('AKILL') },
    { id: 'gline', label: t('GLINE') },
    { id: 'shun', label: t('SHUN') },
    { id: 'custom', label: t('Custom Command') },
  ]), [t]);

  const getBlacklistMaskOptions = useCallback((user: ChannelUser | null, nick: string | null) => {
    const safeNick = nick || '';
    const options: Array<{ id: string; label: string; mask: string }> = [
      { id: 'nick', label: t('Nick only'), mask: safeNick },
      { id: 'nick_user_any', label: t('Nick!user@*'), mask: `${safeNick}!*@*` },
    ];
    if (user?.host) {
      options.push({ id: 'host', label: t('*!*@host'), mask: `*!*@${user.host}` });
      options.push({ id: 'nick_host', label: t('Nick!*@host'), mask: `${safeNick}!*@${user.host}` });
    }
    return options;
  }, [t]);

  const getBlacklistTemplate = useCallback(async (action: BlacklistActionType, net?: string) => {
    if (!['akill', 'gline', 'shun'].includes(action)) {
      return '';
    }
    const stored = await settingsService.getSetting('blacklistTemplates', {});
    const base = {
      akill: 'PRIVMSG OperServ :AKILL ADD {usermask} {reason}',
      gline: 'GLINE {hostmask} :{reason}',
      shun: 'SHUN {hostmask} :{reason}',
    };
    const global = stored?.global || {};
    const local = net && stored?.[net] ? stored[net] : {};
    return (local?.[action] || global?.[action] || base[action] || '') as string;
  }, []);

  const activeIrc = connection?.ircService || ircService;

  const getNetworkForStorage = useCallback((): string => {
    return network || activeIrc.getNetworkName() || 'default';
  }, [network, activeIrc]);

  const handleExternalPayload = useCallback(async (raw: string) => {
    if (!contextNick) {
      Alert.alert(t('Error'), t('Select a user first'));
      return;
    }
    try {
      const payload = encryptedDMService.parseExternalPayload(raw);
      const targetNick = contextNick;
      if (payload.nick && payload.nick.toLowerCase() !== targetNick.toLowerCase()) {
        Alert.alert(
          t('Mismatched Nick'),
          t('This payload is for {payloadNick}, but you selected {targetNick}.')
            .replace('{payloadNick}', payload.nick)
            .replace('{targetNick}', targetNick),
          [{ text: t('OK'), style: 'cancel' }]
        );
        return;
      }

      if (payload.type === 'encdm-fingerprint') {
        const storageNetwork = getNetworkForStorage();
        const currentFp = await encryptedDMService.getBundleFingerprintForNetwork(storageNetwork, targetNick);
        if (!currentFp) {
          Alert.alert(t('No Key'), t('No DM key stored for {nick}.').replace('{nick}', targetNick));
          return;
        }
        const currentDisplay = encryptedDMService.formatFingerprintForDisplay(currentFp);
        const incomingDisplay = encryptedDMService.formatFingerprintForDisplay(payload.fingerprint);
        const matches = currentFp === payload.fingerprint;
        Alert.alert(
          t('Fingerprint Check'),
          t('Stored: {stored}\nScanned: {scanned}\n\n{result}')
            .replace('{stored}', currentDisplay)
            .replace('{scanned}', incomingDisplay)
            .replace('{result}', matches ? t('Match ✅') : t('Mismatch ⚠️')),
          matches
            ? [
                {
                  text: t('Mark Verified'),
                  onPress: async () => {
                    await encryptedDMService.setVerifiedForNetwork(storageNetwork, targetNick, true);
                  },
                },
                { text: t('Close'), style: 'cancel' },
              ]
            : [{ text: t('Close'), style: 'cancel' }]
        );
        return;
      }

      encryptedDMService.verifyBundle(payload.bundle);
      const storageNetwork = getNetworkForStorage();
      const existingFp = await encryptedDMService.getBundleFingerprintForNetwork(storageNetwork, targetNick);
      const newDisplay = encryptedDMService.formatFingerprintForDisplay(payload.fingerprint);
      const oldDisplay = existingFp
        ? encryptedDMService.formatFingerprintForDisplay(existingFp)
        : t('None');
      const isChange = Boolean(existingFp && existingFp !== payload.fingerprint);
      Alert.alert(
        isChange ? t('Replace DM Key') : t('Import DM Key'),
        isChange
          ? t('Existing: {old}\nNew: {new}\n\nOnly replace if verified out-of-band.')
              .replace('{old}', oldDisplay)
              .replace('{new}', newDisplay)
          : t('Fingerprint: {fp}\n\nAccept this key for {nick}?')
              .replace('{fp}', newDisplay)
              .replace('{nick}', targetNick),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: isChange ? t('Replace') : t('Accept'),
            onPress: async () => {
              await encryptedDMService.acceptExternalBundleForNetwork(storageNetwork, targetNick, payload.bundle, isChange);
              setTimeout(() => {
                Alert.alert(
                  t('Share Your Key?'),
                  t('You imported {nick}\'s key offline. For encrypted chat to work both ways, {nick} also needs your key.\n\n💡 Show your QR code for them to scan (no server messages)')
                    .replace(/{nick}/g, targetNick),
                  [
                    { text: t('Later'), style: 'cancel' },
                    {
                      text: t('Show QR Code'),
                      onPress: async () => {
                        try {
                          const selfNick = activeIrc.getCurrentNick();
                          const sharePayload = await encryptedDMService.exportBundlePayload(selfNick);
                          setQrPayload(sharePayload);
                          setQrType('bundle');
                          setShowKeyQr(true);
                        } catch {
                          Alert.alert(t('Error'), t('Failed to generate QR'));
                        }
                      },
                    },
                  ]
                );
              }, 500);
            },
          },
        ]
      );
    } catch {
      Alert.alert(t('Error'), t('Invalid key payload'));
    }
  }, [activeIrc, contextNick, getNetworkForStorage, t]);
  const handleNickAction = useCallback(async (action: string) => {
    if (!contextNick) return;
    const selectedUser = resolveContextUser(contextNick);
    const currentNetwork = network || activeTab?.networkId || activeIrc.getNetworkName();
    switch (action) {
      case 'whois':
        activeIrc.sendCommand(`WHOIS ${contextNick}`);
        break;
      case 'query': {
        if (!currentNetwork) break;
        const queryId = queryTabId(currentNetwork, contextNick);
        const existingTab = tabs.find(t => t.id === queryId && t.type === 'query');
        if (existingTab) {
          setActiveTabId(existingTab.id);
        } else {
          const isEncrypted = await encryptedDMService.isEncryptedForNetwork(currentNetwork, contextNick);
          const newQueryTab: ChannelTab = {
            id: queryId,
            name: contextNick,
            type: 'query',
            networkId: currentNetwork,
            messages: [],
            isEncrypted,
          };
          setTabs(sortTabsGrouped([...tabs, newQueryTab], tabSortAlphabetical));
          soundService.playSound(SoundEventType.RING);
          setActiveTabId(newQueryTab.id);
        }
        break;
      }
      case 'copy':
        Clipboard.setString(contextNick);
        break;
      case 'enc_share':
        try {
          const bundle = await encryptedDMService.exportBundle();
          activeIrc.sendRaw(`PRIVMSG ${contextNick} :!enc-offer ${JSON.stringify(bundle)}`);
        } catch {
          Alert.alert(t('Error'), t('Failed to share key'));
        }
        break;
      case 'enc_request':
        activeIrc.sendRaw(`PRIVMSG ${contextNick} :!enc-req`);
        encryptedDMService.awaitBundleForNick(contextNick, 36000).catch(() => {});
        break;
      case 'enc_qr_show_fingerprint':
        try {
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportFingerprintPayload(selfNick);
          setQrPayload(payload);
          setQrType('fingerprint');
          setShowKeyQr(true);
        } catch {
          Alert.alert(t('Error'), t('Failed to generate QR'));
        }
        break;
      case 'enc_qr_show_bundle':
        try {
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportBundlePayload(selfNick);
          setQrPayload(payload);
          setQrType('bundle');
          setShowKeyQr(true);
        } catch {
          Alert.alert(t('Error'), t('Failed to generate QR'));
        }
        break;
      case 'enc_qr_scan':
        try {
          const permission = hasCameraPermission || (await requestCameraPermission()) === 'authorized';
          if (!permission) {
            Alert.alert(t('Error'), t('Camera permission denied'));
            break;
          }
          scanHandledRef.current = false;
          setShowKeyScan(true);
          setScanError('');
        } catch {
          Alert.alert(t('Error'), t('Failed to open camera'));
        }
        break;
      case 'enc_share_file':
        try {
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportBundlePayload(selfNick);
          const filename = `androidircx-key-${selfNick}.json`;
          const path = `${RNFS.CachesDirectoryPath}/${filename}`;
          try {
            await RNFS.writeFile(path, payload, 'utf8');
            await Share.open({ url: `file://${path}`, type: 'application/json' });
          } finally {
            try {
              if (await RNFS.exists(path)) {
                await RNFS.unlink(path);
              }
            } catch {
              // Ignore cleanup errors
            }
          }
        } catch {
          Alert.alert(t('Error'), t('Failed to share key file'));
        }
        break;
      case 'enc_import_file':
        try {
          const result = await pick({
            type: [types.allFiles],
            mode: 'import',
          });
          if (result.length === 0) return;
          const picker = result[0];
          const uri = picker.fileCopyUri || picker.uri;
          const path = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
          const shouldCleanupCopy = Boolean(picker.fileCopyUri);
          try {
            const contents = await RNFS.readFile(path, 'utf8');
            await handleExternalPayload(contents);
          } finally {
            if (shouldCleanupCopy) {
              try {
                await RNFS.unlink(path);
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        } catch (e: any) {
          if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
            // ignore
          } else {
            Alert.alert(t('Error'), t('Failed to import key file'));
          }
        }
        break;
      case 'enc_share_nfc':
        try {
          const supported = await NfcManager.isSupported();
          if (!supported) {
            Alert.alert(t('Error'), t('NFC not supported'));
            break;
          }
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportBundlePayload(selfNick);
          await NfcManager.start();
          await NfcManager.requestTechnology(NfcTech.Ndef);
          const bytes = Ndef.encodeMessage([Ndef.textRecord(payload)]);
          if (bytes) {
            await NfcManager.writeNdefMessage(bytes);
          }
        } catch {
          Alert.alert(t('Error'), t('Failed to share via NFC'));
        } finally {
          try { await NfcManager.cancelTechnologyRequest(); } catch {}
        }
        break;
      case 'enc_receive_nfc':
        try {
          const supported = await NfcManager.isSupported();
          if (!supported) {
            Alert.alert(t('Error'), t('NFC not supported'));
            break;
          }
          await NfcManager.start();
          await NfcManager.requestTechnology(NfcTech.Ndef);
          const tag = await NfcManager.getTag();
          const ndefMessage = tag?.ndefMessage?.[0];
          const payload = ndefMessage ? Ndef.text.decodePayload(ndefMessage.payload) : null;
          if (!payload) {
            Alert.alert(t('Error'), t('No NFC payload'));
            break;
          }
          await handleExternalPayload(payload);
        } catch {
          Alert.alert(t('Error'), t('Failed to read NFC'));
        } finally {
          try { await NfcManager.cancelTechnologyRequest(); } catch {}
        }
        break;
      case 'enc_verify':
        try {
          const status = network
            ? await encryptedDMService.getVerificationStatusForNetwork(network, contextNick)
            : await encryptedDMService.getVerificationStatus(contextNick);
          if (!status.fingerprint) {
            Alert.alert(t('Verify DM Key'), t('No DM key for {nick}').replace('{nick}', contextNick));
            break;
          }
          const selfFp = encryptedDMService.formatFingerprintForDisplay(await encryptedDMService.getSelfFingerprint());
          const peerFp = encryptedDMService.formatFingerprintForDisplay(status.fingerprint);
          const verifiedLabel = status.verified ? t('Verified') : t('Mark Verified');
          Alert.alert(
            t('Verify DM Key'),
            t('Compare fingerprints out-of-band:\n\nYou: {self}\n{nick}: {peer}')
              .replace('{self}', selfFp)
              .replace('{nick}', contextNick)
              .replace('{peer}', peerFp),
            [
              {
                text: verifiedLabel,
                onPress: async () => {
                  if (!status.verified) {
                    const storageNetwork = getNetworkForStorage();
                    await encryptedDMService.setVerifiedForNetwork(storageNetwork, contextNick, true);
                  }
                },
              },
              {
                text: t('Copy Fingerprints'),
                onPress: () => {
                  Clipboard.setString(`You: ${selfFp}\n${contextNick}: ${peerFp}`);
                },
              },
              { text: t('Close'), style: 'cancel' },
            ]
          );
        } catch {
          Alert.alert(t('Error'), t('Failed to load fingerprints'));
        }
        break;
      case 'chan_share':
        try {
          if (!channel) break;
          const keyData = await channelEncryptionService.exportChannelKey(channel, currentNetwork || activeIrc.getNetworkName());
          activeIrc.sendRaw(`PRIVMSG ${contextNick} :!chanenc-key ${keyData}`);
        } catch (e: any) {
          Alert.alert(t('Error'), e?.message || t('Failed to share channel key'));
        }
        break;
      case 'chan_request':
        try {
          if (!channel) break;
          const requester = activeIrc.getCurrentNick();
          activeIrc.sendRaw(
            `PRIVMSG ${contextNick} :Please share the channel key for ${channel} with /chankey share ${requester}`
          );
        } catch (e: any) {
          Alert.alert(t('Error'), e?.message || t('Failed to request channel key'));
        }
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
        dccChatService.initiateChat(activeIrc, contextNick, currentNetwork || activeIrc.getNetworkName());
        break;
      case 'dcc_send':
        if (currentNetwork) {
          useUIStore.getState().setDccSendTarget({ nick: contextNick, networkId: currentNetwork });
          useUIStore.getState().setShowDccSendModal(true);
        }
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
      case 'add_note': {
        const existingNote = userManagementService.getUserNote(contextNick, network);
        setNoteText(existingNote || '');
        setShowNoteModal(true);
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
      case 'blacklist': {
        setBlacklistAction('ban');
        setBlacklistReason('');
        setBlacklistCustomCommand('');
        setBlacklistMaskChoice(selectedUser?.host ? 'host' : 'nick');
        setShowBlacklistModal(true);
        break;
      }
      case 'kill': {
        const targetNick = contextNick;
        Alert.prompt(
          t('KILL {nick}').replace('{nick}', targetNick),
          t('Enter reason'),
          [
            { text: t('Cancel'), style: 'cancel' },
            {
              text: t('Send'),
              onPress: (reason?: string) => {
                const trimmed = (reason || '').trim();
                if (!trimmed) {
                  Alert.alert(t('Error'), t('Reason is required'));
                  return;
                }
                activeIrc.sendCommand(`KILL ${targetNick} :${trimmed}`);
              },
            },
          ],
          'plain-text'
        );
        break;
      }
      case 'give_voice':
        if (channel) activeIrc.sendCommand(`MODE ${channel} +v ${contextNick}`);
        break;
      case 'take_voice':
        if (channel) activeIrc.sendCommand(`MODE ${channel} -v ${contextNick}`);
        break;
      case 'give_halfop':
        if (channel) activeIrc.sendCommand(`MODE ${channel} +h ${contextNick}`);
        break;
      case 'take_halfop':
        if (channel) activeIrc.sendCommand(`MODE ${channel} -h ${contextNick}`);
        break;
      case 'give_op':
        if (channel) activeIrc.sendCommand(`MODE ${channel} +o ${contextNick}`);
        break;
      case 'take_op':
        if (channel) activeIrc.sendCommand(`MODE ${channel} -o ${contextNick}`);
        break;
      case 'kick':
        if (channel) activeIrc.sendCommand(`KICK ${channel} ${contextNick}`);
        break;
      case 'kick_message':
        if (channel) activeIrc.sendCommand(`KICK ${channel} ${contextNick} :Kicked`);
        break;
      case 'ban': {
        if (!channel) break;
        const mask = selectedUser?.host ? `*!*@${selectedUser.host}` : `${contextNick}!*@*`;
        activeIrc.sendCommand(`MODE ${channel} +b ${mask}`);
        break;
      }
      case 'kick_ban': {
        if (!channel) break;
        const mask = selectedUser?.host ? `*!*@${selectedUser.host}` : `${contextNick}!*@*`;
        activeIrc.sendCommand(`MODE ${channel} +b ${mask}`);
        activeIrc.sendCommand(`KICK ${channel} ${contextNick}`);
        break;
      }
      case 'kick_ban_message': {
        if (!channel) break;
        const mask = selectedUser?.host ? `*!*@${selectedUser.host}` : `${contextNick}!*@*`;
        activeIrc.sendCommand(`MODE ${channel} +b ${mask}`);
        activeIrc.sendCommand(`KICK ${channel} ${contextNick} :Kicked`);
        break;
      }
      case 'kick_with_options':
      case 'ban_with_options':
      case 'kick_ban_with_options': {
        // Set up the kickban target and show the modal
        if (channel && contextNick) {
          setKickBanTarget({
            nick: contextNick,
            user: selectedUser?.username,
            host: selectedUser?.host,
          });
          setKickBanMode(
            action === 'kick_with_options' ? 'kick' :
            action === 'ban_with_options' ? 'ban' : 'kickban'
          );
          setShowKickBanModal(true);
        }
        break;
      }
      default:
        break;
    }
    setShowContextMenu(false);
  }, [
    activeIrc,
    activeTab,
    channel,
    contextNick,
    getNetworkForStorage,
    handleExternalPayload,
    hasCameraPermission,
    network,
    requestCameraPermission,
    resolveContextUser,
    setActiveTabId,
    setTabs,
    tabSortAlphabetical,
    tabs,
    t,
  ]);

  const handleKickBanConfirm = useCallback((options) => {
    if (!channel || !kickBanTarget) return;

    const banMask = banService.generateBanMask(
      kickBanTarget.nick,
      kickBanTarget.user || '',
      kickBanTarget.host || '',
      options.banType
    );

    if (options.ban) {
      activeIrc.sendRaw(`MODE ${channel} +b ${banMask}`);
    }

    if (options.kick) {
      activeIrc.sendRaw(`KICK ${channel} ${kickBanTarget.nick} :${options.reason || 'Goodbye'}`);
    }

    if (options.unbanAfterSeconds) {
      setTimeout(() => {
        activeIrc.sendRaw(`MODE ${channel} -b ${banMask}`);
      }, options.unbanAfterSeconds * 1000);
    }

    setShowKickBanModal(false);
  }, [activeIrc, channel, kickBanTarget]);

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
    if (__DEV__ && messages.length > 0) {
//       console.log(`📺 MessageArea: Tab ${tabId} has ${messages.length} messages, types:`,
//         messages.slice(-5).map(m => ({ type: m.type, isRaw: m.isRaw, batchTag: m.batchTag, text: m.text?.substring(0, 30) }))
//       );
    }
    const filtered = messages.filter((msg) => {
      if (msg.isRaw && !showRawCommands) {
        //console.log(`📺 MessageArea: Filtering out raw message (showRawCommands: ${showRawCommands})`);
        return false;
      }
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

//     if (__DEV__) {
//       console.log(`📺 MessageArea: After visibility filter: ${visibilityFiltered.length} messages`);
//     }

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

    const groupingEnabled = layoutState.messageGroupingEnabled !== false;

    // Group consecutive messages
    return limitedMessages.map((message, index) => {
      if (!groupingEnabled) {
        return { ...message, isGrouped: false };
      }
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

//     if (__DEV__) {
//       console.log(`📺 MessageArea: Final displayMessages: ${grouped.length} messages for tab ${tabId}`);
//     }
    
    return grouped;
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
    layoutState.messageGroupingEnabled,
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
        channelUsers={channelUsers}
        timestampDisplay={layoutState.timestampDisplay}
        timestampFormat={layoutState.timestampFormat}
        colors={colors}
        styles={styles}
        currentNick={currentNick}
        isGrouped={item.isGrouped || false}
        onNickLongPress={(nick) => {
          setContextNick(nick);
          setContextUser(resolveContextUser(nick));
          const selfNick = activeIrc.getCurrentNick?.();
          if (selfNick) {
            activeIrc.sendCommand?.(`MODE ${selfNick}`);
            setTimeout(() => {
              const oper = typeof activeIrc?.isServerOper === 'function' ? activeIrc.isServerOper() : false;
              setIsServerOper(oper);
            }, 300);
          }
          setShowContextMenu(true);
        }}
        onChannelPress={(channelName) => {
          activeIrc.sendRaw?.(`JOIN ${channelName}`);
        }}
        onNickPress={(nick) => {
          // Open query with the nick
          if (!network) return;
          const queryId = `query:${network}:${nick.toLowerCase()}`;
          const tabStore = useTabStore.getState();
          const currentTabs = tabStore.tabs;
          const existingTab = currentTabs.find(t => t.id === queryId && t.type === 'query');
          if (existingTab) {
            tabStore.setActiveTabId(existingTab.id);
          } else {
            const newQueryTab: ChannelTab = {
              id: queryId,
              name: nick,
              type: 'query',
              networkId: network,
              messages: [],
            };
            tabStore.setTabs(sortTabsGrouped([...currentTabs, newQueryTab], tabSortAlphabetical));
            tabStore.setActiveTabId(newQueryTab.id);
          }
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
        messageFormats={theme.messageFormats}
      />
    );
  }, [
    layoutState.timestampDisplay,
    layoutState.timestampFormat,
    colors,
    styles,
    currentNick,
    resolveContextUser,
    handleMessageLongPress,
    handleMessagePress,
    selectedMessageIds,
    selectionMode,
    perfConfig.imageLazyLoad,
    network,
    channel,
    tabId,
    containerWidth,
    theme.messageFormats,
    activeIrc,
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

  const blacklistModals = (
    <>
      <Modal
        visible={showNoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNoteModal(false)}>
        <View style={styles.blacklistOverlay}>
          <View style={styles.noteModal}>
            <Text style={styles.blacklistTitle}>{t('User Note')}</Text>
            <TextInput
              style={[styles.noteInput, styles.blacklistInputMultiline]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder={t('Enter note about this user')}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.blacklistButtons}>
              <TouchableOpacity
                style={[styles.blacklistButton, styles.blacklistButtonCancel]}
                onPress={() => setShowNoteModal(false)}>
                <Text style={styles.blacklistButtonText}>{t('Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.blacklistButton, styles.blacklistButtonPrimary]}
                onPress={async () => {
                  if (!contextNick) return;
                  if (noteText.trim()) {
                    await userManagementService.addUserNote(contextNick, noteText.trim(), network);
                  } else {
                    await userManagementService.removeUserNote(contextNick, network);
                  }
                  setShowNoteModal(false);
                }}>
                <Text style={[styles.blacklistButtonText, styles.blacklistButtonTextPrimary]}>
                  {t('Save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showBlacklistModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBlacklistModal(false)}>
        <View style={styles.blacklistOverlay}>
          <View style={styles.blacklistModal}>
            <Text style={styles.blacklistTitle}>{t('Add to Blacklist')}</Text>
            {contextNick ? (
              <>
                <Text style={styles.blacklistLabel}>{t('Mask')}</Text>
                {getBlacklistMaskOptions(contextUser, contextNick).map(option => (
                  <TouchableOpacity
                    key={option.id}
                    style={styles.blacklistOption}
                    onPress={() => setBlacklistMaskChoice(option.id)}>
                    <Text style={[
                      styles.blacklistOptionText,
                      blacklistMaskChoice === option.id && styles.blacklistOptionTextSelected,
                    ]}>
                      {option.label} {option.mask}
                    </Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.blacklistLabel}>{t('Action')}</Text>
                <TouchableOpacity
                  style={styles.blacklistPicker}
                  onPress={() => setShowBlacklistActionPicker(true)}>
                  <Text style={styles.blacklistPickerText}>
                    {blacklistActionOptions.find(opt => opt.id === blacklistAction)?.label || blacklistAction}
                  </Text>
                </TouchableOpacity>
                {blacklistAction === 'custom' && (
                  <TextInput
                    style={styles.blacklistInput}
                    value={blacklistCustomCommand}
                    onChangeText={setBlacklistCustomCommand}
                    placeholder={t('Command template (use {mask}, {usermask}, {hostmask}, {nick})')}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
                <TextInput
                  style={[styles.blacklistInput, styles.blacklistInputMultiline]}
                  value={blacklistReason}
                  onChangeText={setBlacklistReason}
                  placeholder={t('Reason (optional)')}
                  multiline
                />
                <View style={styles.blacklistButtons}>
                  <TouchableOpacity
                    style={[styles.blacklistButton, styles.blacklistButtonCancel]}
                    onPress={() => setShowBlacklistModal(false)}>
                    <Text style={styles.blacklistButtonText}>{t('Cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.blacklistButton, styles.blacklistButtonPrimary]}
                    onPress={async () => {
                      if (!contextNick) {
                        setShowBlacklistModal(false);
                        return;
                      }
                      const maskOptions = getBlacklistMaskOptions(contextUser, contextNick);
                      const choice = maskOptions.find(opt => opt.id === blacklistMaskChoice) || maskOptions[0];
                      const templateCommand = blacklistAction === 'custom'
                        ? blacklistCustomCommand.trim()
                        : await getBlacklistTemplate(blacklistAction, network);
                      await userManagementService.addBlacklistEntry(
                        choice.mask,
                        blacklistAction,
                        blacklistReason.trim() || undefined,
                        network,
                        templateCommand || undefined
                      );
                      setShowBlacklistModal(false);
                    }}>
                    <Text style={[styles.blacklistButtonText, styles.blacklistButtonTextPrimary]}>
                      {t('Add')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        visible={showBlacklistActionPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBlacklistActionPicker(false)}>
        <View style={styles.blacklistOverlay}>
          <View style={styles.blacklistModal}>
            <Text style={styles.blacklistTitle}>{t('Select Action')}</Text>
            <ScrollView style={styles.blacklistPickerScroll}>
              {blacklistActionOptions.map(option => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.blacklistOption}
                  onPress={() => {
                    setBlacklistAction(option.id);
                    if (option.id !== 'custom') {
                      setBlacklistCustomCommand('');
                    }
                    setShowBlacklistActionPicker(false);
                  }}>
                  <Text style={[
                    styles.blacklistOptionText,
                    blacklistAction === option.id && styles.blacklistOptionTextSelected,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.blacklistButton, styles.blacklistButtonPrimary]}
              onPress={() => setShowBlacklistActionPicker(false)}>
              <Text style={[styles.blacklistButtonText, styles.blacklistButtonTextPrimary]}>
                {t('Close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showKeyQr}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKeyQr(false)}>
        <TouchableOpacity
          style={styles.blacklistOverlay}
          activeOpacity={1}
          onPress={() => setShowKeyQr(false)}>
          <View style={styles.qrModal}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>
                {qrType === 'bundle' ? t('Share Key Bundle') : t('Fingerprint QR')}
              </Text>
              <Text style={styles.qrModalSubtitle}>
                {qrType === 'bundle'
                  ? t('Scan this QR to import your key')
                  : t('Scan to verify fingerprint')}
              </Text>
            </View>
            <View style={styles.qrCodeContainer}>
              {qrPayload ? (
                <QRCode value={qrPayload} size={220} />
              ) : (
                <Text style={styles.blacklistOptionText}>{t('No QR payload')}</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.qrModalButton}
              onPress={() => {
                if (qrPayload) {
                  Clipboard.setString(qrPayload);
                  Alert.alert(t('Copied'), t('QR payload copied'));
                }
              }}>
              <Text style={styles.qrModalButtonText}>{t('Copy QR Payload')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={showKeyScan}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKeyScan(false)}>
        <TouchableOpacity
          style={styles.blacklistOverlay}
          activeOpacity={1}
          onPress={() => setShowKeyScan(false)}>
          <View style={styles.scanContainer}>
            <View style={styles.scanHeader}>
              <Text style={styles.scanTitle}>{t('Scan Key')}</Text>
              <Text style={styles.scanText}>{t('Scan a fingerprint QR')}</Text>
              {scanError ? <Text style={styles.scanError}>{scanError}</Text> : null}
            </View>
            {device ? (
              <Camera
                style={{ flex: 1 }}
                device={device}
                isActive={showKeyScan}
                codeScanner={codeScanner}
              />
            ) : (
              <View style={styles.scanFallback}>
                <Text style={styles.scanText}>{t('Camera not available')}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );

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
          colors={colors}
          network={network}
          channel={channel}
          activeNick={currentNick}
          connection={connection}
          allowQrVerification={allowQrVerification}
          allowFileExchange={allowFileExchange}
          allowNfcExchange={allowNfcExchange}
          isServerOper={isServerOper}
          ignoreActionId="ignore_toggle"
        />
        {blacklistModals}
        {selectionMode && (
          <Animated.View
            style={[styles.selectionBar, { transform: selectionBarPan.getTranslateTransform() }]}
            {...selectionBarPanResponder.panHandlers}
          >
            <Text style={styles.selectionText}>{t('{count} selected').replace('{count}', selectedMessageIds.size.toString())}</Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity style={styles.selectionButton} onPress={handleCopySelected}>
                <Text style={styles.selectionButtonText}>{t('Copy')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.selectionButton, styles.selectionCancelButton]} onPress={clearSelection}>
                <Text style={[styles.selectionButtonText, styles.selectionCancelText]}>{t('Cancel')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
        colors={colors}
        network={network}
        channel={channel}
        activeNick={currentNick}
        connection={connection}
        allowQrVerification={allowQrVerification}
        allowFileExchange={allowFileExchange}
        allowNfcExchange={allowNfcExchange}
        isServerOper={isServerOper}
        ignoreActionId="ignore_toggle"
      />
      <KickBanModal
        visible={showKickBanModal}
        onClose={() => setShowKickBanModal(false)}
        onConfirm={handleKickBanConfirm}
        nick={kickBanTarget?.nick || ''}
        userHost={kickBanTarget?.user && kickBanTarget?.host ? `${kickBanTarget.user}@${kickBanTarget.host}` : undefined}
        mode={kickBanMode}
        colors={{
          background: colors.surface,
          text: colors.text,
          accent: colors.primary,
          border: colors.border,
          inputBackground: colors.messageBackground,
        }}
      />
      {blacklistModals}
      {selectionMode && (
        <Animated.View
          style={[styles.selectionBar, { transform: selectionBarPan.getTranslateTransform() }]}
          {...selectionBarPanResponder.panHandlers}
        >
          <Text style={styles.selectionText}>{t('{count} selected').replace('{count}', selectedMessageIds.size.toString())}</Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity style={styles.selectionButton} onPress={handleCopySelected}>
              <Text style={styles.selectionButtonText}>{t('Copy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.selectionButton, styles.selectionCancelButton]} onPress={clearSelection}>
              <Text style={[styles.selectionButtonText, styles.selectionCancelText]}>{t('Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      {copyStatus ? (
        <View style={styles.selectionToast}>
          <Text style={styles.selectionToastText}>{copyStatus}</Text>
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (colors: any, layoutConfig: any, bottomInset: number = 0) => {
  // Calculate the appropriate bottom position for the selection bar
  // MessageInput height is approximately 50-60px + bottom inset
  const messageInputHeight = 60;
  const selectionBarBottom = messageInputHeight + bottomInset + 12;
  const selectionToastBottom = selectionBarBottom + 68; // 68px above the selection bar
  const messageFontSize = layoutService.getFontSizePixels();
  const messageLineHeight = Math.ceil(messageFontSize * 1.45);
  const timestampFontSize = Math.max(10, messageFontSize - 2);
  const timestampLineHeight = Math.ceil(timestampFontSize * 1.35);
  const groupedMessageOverlap = messageLineHeight >= 18 ? 0 : -4;

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
    fontSize: messageFontSize,
    lineHeight: messageLineHeight,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: layoutConfig.messageSpacing || 4,
    flexWrap: 'wrap',
    paddingVertical: (layoutConfig.messagePadding || 8) / 2,
    paddingHorizontal: layoutConfig.messagePadding || 8,
  },
  groupedMessageContainer: {
    marginTop: groupedMessageOverlap,
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
    fontSize: timestampFontSize,
    lineHeight: timestampLineHeight,
    marginRight: 8,
    minWidth: 50,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
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
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  nick: {
    color: colors.messageNick,
    fontSize: messageFontSize,
    lineHeight: messageLineHeight,
    fontWeight: '600',
    marginRight: 8,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  messageText: {
    color: colors.messageText,
    fontSize: messageFontSize,
    lineHeight: messageLineHeight,
    flex: 1,
    flexShrink: 1,
    textAlign: layoutConfig.messageTextAlign || 'left',
    writingDirection: layoutConfig.messageTextDirection || 'auto',
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
  contextHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contextHeaderText: {
    flex: 1,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  contextCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  contextCopyText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  contextScroll: {
    maxHeight: 360,
  },
  contextScrollContent: {
    paddingTop: 8,
  },
  contextItem: {
    paddingVertical: 10,
  },
  contextText: {
    color: colors.text,
    fontSize: 14,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  contextWarning: {
    color: colors.warning || colors.text,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  contextDanger: {
    color: colors.error || colors.text,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  contextGroupHeader: {
    marginTop: 6,
    marginBottom: 4,
  },
  contextGroupTitle: {
    fontSize: 12,
    color: colors.textSecondary || colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  contextDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  contextSubGroup: {
    paddingLeft: 10,
  },
  contextSubHeader: {
    marginTop: 8,
    marginBottom: 4,
  },
  contextSubTitle: {
    fontSize: 11,
    color: colors.textSecondary || colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  contextFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 8,
  },
  contextCancel: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  contextCancelText: {
    color: colors.primary,
    fontWeight: '600',
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  blacklistOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blacklistModal: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: colors.surface || colors.messageBackground,
    borderRadius: 12,
    padding: 16,
  },
  noteModal: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: colors.surface || colors.messageBackground,
    borderRadius: 12,
    padding: 16,
  },
  blacklistTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  blacklistLabel: {
    fontSize: 12,
    color: colors.textSecondary || colors.text,
    marginTop: 8,
    marginBottom: 6,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  blacklistOption: {
    paddingVertical: 8,
  },
  blacklistOptionText: {
    color: colors.text,
    fontSize: 14,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  blacklistOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  blacklistPicker: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceVariant || colors.messageBackground,
  },
  blacklistPickerText: {
    color: colors.text,
    fontSize: 14,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  blacklistInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    marginTop: 8,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    marginTop: 8,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  blacklistInputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  blacklistButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  blacklistButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  blacklistButtonCancel: {
    marginRight: 8,
    backgroundColor: colors.surfaceVariant || colors.messageBackground,
  },
  blacklistButtonPrimary: {
    backgroundColor: colors.primary,
  },
  blacklistButtonText: {
    color: colors.text,
    fontWeight: '600',
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  blacklistButtonTextPrimary: {
    color: colors.onPrimary || '#fff',
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  blacklistPickerScroll: {
    maxHeight: 220,
  },
  qrModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 300,
    maxWidth: 360,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  qrModalHeader: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 6,
    textAlign: 'center',
  },
  qrModalSubtitle: {
    fontSize: 13,
    color: '#757575',
    textAlign: 'center',
  },
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  qrModalButton: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  qrModalButtonText: {
    fontSize: 15,
    color: '#2196F3',
    textAlign: 'center',
    fontWeight: '500',
  },
  scanContainer: {
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    width: '90%',
    maxWidth: 360,
    aspectRatio: 3 / 4,
  },
  scanHeader: {
    padding: 14,
    backgroundColor: '#111',
  },
  scanTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  scanText: {
    color: '#fff',
    textAlign: 'center',
    paddingVertical: 10,
  },
  scanError: {
    color: '#FF5252',
    textAlign: 'center',
    paddingVertical: 6,
  },
  scanFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    writingDirection: layoutConfig.messageTextDirection || 'auto',
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
    writingDirection: layoutConfig.messageTextDirection || 'auto',
  },
  selectionCancelButton: {
    backgroundColor: colors.surfaceAlt || colors.messageBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border || '#ccc',
  },
  selectionCancelText: {
    color: colors.text,
    writingDirection: layoutConfig.messageTextDirection || 'auto',
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
    writingDirection: layoutConfig.messageTextDirection || 'auto',
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
