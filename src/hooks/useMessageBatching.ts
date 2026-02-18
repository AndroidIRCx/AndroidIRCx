/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback, useRef, useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { IRCMessage } from '../services/IRCService';
import { performanceService } from '../services/PerformanceService';
import { serverTabId, noticeTabId, notificationsTabId, makeServerTab, sortTabsGrouped } from '../utils/tabUtils';
import { soundService } from '../services/SoundService';
import { SoundEventType } from '../types/sound';
import { messageHistoryService } from '../services/MessageHistoryService';
import { bouncerService } from '../services/BouncerService';
import type { ChannelTab } from '../types';

interface MessageBatchItem {
  message: IRCMessage;
  context: any;
}

interface NewTabInfo {
  tabId: string;
  networkId: string;
  channelName: string;
  type: 'channel' | 'query';
}

interface UseMessageBatchingParams {
  pendingMessagesRef: MutableRefObject<MessageBatchItem[]>;
  messageBatchTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  activeTabId: string | null;
  tabSortAlphabetical: boolean;
  setTabs: Dispatch<SetStateAction<ChannelTab[]>>;
}

export const useMessageBatching = (params: UseMessageBatchingParams) => {
  const {
    pendingMessagesRef,
    messageBatchTimeoutRef,
    activeTabId,
    tabSortAlphabetical,
    setTabs,
  } = params;

  // Track newly created tabs that need scrollback loading
  const newTabsNeedingScrollbackRef = useRef<NewTabInfo[]>([]);
  const scrollbackLoadingRef = useRef<Set<string>>(new Set());

  // Load scrollback for newly created tabs
  const loadScrollbackForNewTabs = useCallback(async () => {
    const tabsToProcess = [...newTabsNeedingScrollbackRef.current];
    newTabsNeedingScrollbackRef.current = [];

    if (tabsToProcess.length === 0) return;

    const bouncerConfig = bouncerService.getConfig();
    if (!bouncerConfig.loadScrollbackOnJoin) {
      return;
    }

    const scrollbackLines = bouncerConfig.scrollbackLines || 50;

    for (const tabInfo of tabsToProcess) {
      // Skip if already loading
      if (scrollbackLoadingRef.current.has(tabInfo.tabId)) {
        continue;
      }
      scrollbackLoadingRef.current.add(tabInfo.tabId);

      try {
        // Load history from storage
        const history = await messageHistoryService.loadMessages(
          tabInfo.networkId,
          tabInfo.channelName
        );

        if (history.length === 0) {
          scrollbackLoadingRef.current.delete(tabInfo.tabId);
          continue;
        }

        // Get the last X messages as scrollback
        const scrollback = history.slice(-scrollbackLines);

        if (scrollback.length > 0) {
          // Mark scrollback messages
          const markedScrollback = scrollback.map(msg => ({
            ...msg,
            isScrollback: true,
          }));

          // Prepend scrollback to existing messages
          setTabs(prevTabs => {
            const tabIndex = prevTabs.findIndex(t => t.id === tabInfo.tabId);
            if (tabIndex === -1) {
              return prevTabs;
            }

            const tab = prevTabs[tabIndex];
            // Filter out any messages from scrollback that are already in tab
            // (based on timestamp to avoid duplicates)
            const existingTimestamps = new Set(tab.messages.map(m => m.timestamp));
            const uniqueScrollback = markedScrollback.filter(
              m => !existingTimestamps.has(m.timestamp)
            );

            if (uniqueScrollback.length === 0) {
              return prevTabs;
            }

            // Add separator message between scrollback and new messages
            const separatorMessage: IRCMessage = {
              id: `scrollback-separator-${Date.now()}`,
              type: 'system',
              text: `─── Scrollback (${uniqueScrollback.length} messages) ───`,
              timestamp: uniqueScrollback[uniqueScrollback.length - 1]?.timestamp || Date.now(),
              channel: tabInfo.channelName,
              isScrollback: true,
            };

            const newMessages = [
              ...uniqueScrollback,
              separatorMessage,
              ...tab.messages,
            ];

            const newTabs = [...prevTabs];
            newTabs[tabIndex] = {
              ...tab,
              messages: newMessages,
              scrollbackLoaded: true,
            };

            console.log(`📜 Loaded ${uniqueScrollback.length} scrollback messages for ${tabInfo.channelName}`);
            return newTabs;
          });
        }
      } catch (error) {
        console.error(`Failed to load scrollback for ${tabInfo.channelName}:`, error);
      } finally {
        scrollbackLoadingRef.current.delete(tabInfo.tabId);
      }
    }
  }, [setTabs]);

  // Process scrollback queue after batch processing
  useEffect(() => {
    if (newTabsNeedingScrollbackRef.current.length > 0) {
      // Small delay to let the UI update first
      const timer = setTimeout(() => {
        loadScrollbackForNewTabs();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loadScrollbackForNewTabs]);

  const processBatchedMessages = useCallback(() => {
    const batch = pendingMessagesRef.current;
    if (__DEV__) {
      console.log('🔄 processBatchedMessages called, batch size:', batch.length);
    }
    if (batch.length === 0) return;

    // Clear the queue
    pendingMessagesRef.current = [];
    messageBatchTimeoutRef.current = null;

    if (__DEV__) {
      console.log('🔄 Processing batch of', batch.length, 'messages');
    }

    // Track newly created tabs for scrollback loading
    const newlyCreatedTabs: NewTabInfo[] = [];
    const messagesToPersist: Array<{ message: IRCMessage; network: string }> = [];

    const shouldPersistMessage = (message: IRCMessage, hasValidNetwork: boolean): boolean => {
      if (!hasValidNetwork) return false;
      if (message.isScrollback || message.isPlayback) return false;
      if (message.isRaw || message.type === 'raw') return false;
      return true;
    };

    // Process all messages in a single setTabs call
    setTabs(prevTabs => {
      if (__DEV__) {
        console.log('📝 setTabs called, current tabs:', prevTabs.length);
      }
      let newTabs = prevTabs;
      let tabsModified = false;

      for (const { message, context } of batch) {
        if (!context) {
          if (__DEV__) {
            console.warn('useMessageBatching: Skipping message without context', message);
          }
          continue;
        }

        const {
          targetTabId,
          targetTabType,
          messageNetwork,
          newTabIsEncrypted,
          hasValidNetwork,
        } = context;

        // Ensure server tab exists
        if (hasValidNetwork) {
          const serverId = serverTabId(messageNetwork);
          if (!newTabs.some(t => t.id === serverId)) {
            if (!tabsModified) newTabs = [...newTabs];
            newTabs.push(makeServerTab(messageNetwork));
            tabsModified = true;
          }

          // Ensure notices tab if needed
          if (targetTabId === noticeTabId(messageNetwork) && !newTabs.some(t => t.id === targetTabId)) {
            if (!tabsModified) newTabs = [...newTabs];
            newTabs.push({
              id: targetTabId,
              name: 'Notices',
              type: 'channel',
              networkId: messageNetwork,
              messages: [],
            });
            tabsModified = true;
          }
          
          // Ensure notifications tab if needed
          if (targetTabId === notificationsTabId(messageNetwork) && !newTabs.some(t => t.id === targetTabId)) {
            if (!tabsModified) newTabs = [...newTabs];
            newTabs.push({
              id: targetTabId,
              name: 'Notifications',
              type: 'channel',
              networkId: messageNetwork,
              messages: [],
            });
            tabsModified = true;
          }
        }

        let tabIndex = newTabs.findIndex(t => t.id === targetTabId);
        if (tabIndex === -1 && messageNetwork && message?.channel) {
          const normalizedName = message.channel.toLowerCase();
          if (targetTabType === 'channel') {
            tabIndex = newTabs.findIndex(
              t =>
                t.type === 'channel' &&
                t.networkId === messageNetwork &&
                t.name.toLowerCase() === normalizedName
            );
          } else if (targetTabType === 'query') {
            tabIndex = newTabs.findIndex(
              t =>
                t.type === 'query' &&
                t.networkId === messageNetwork &&
                t.name.toLowerCase() === normalizedName
            );
          }
        }

        if (tabIndex === -1) {
          // Create new tab
          if (hasValidNetwork) {
            if (!tabsModified) newTabs = [...newTabs];
            const channelName = message.channel || message.from || targetTabId;
            //console.log(`📨 useMessageBatching: Creating new tab ${targetTabId} with message (batchTag: ${message.batchTag || 'none'})`);
            newTabs.push({
              id: targetTabId,
              name: targetTabType === 'server' ? messageNetwork : channelName,
              type: targetTabType,
              networkId: messageNetwork,
              messages: [message],
              isEncrypted: newTabIsEncrypted,
              sendEncrypted: false,
            });
            if (targetTabType === 'query') {
              soundService.playSound(SoundEventType.RING);
            }
            // Track for scrollback loading (only for channel and query tabs)
            if (targetTabType === 'channel' || targetTabType === 'query') {
              newlyCreatedTabs.push({
                tabId: targetTabId,
                networkId: messageNetwork,
                channelName,
                type: targetTabType,
              });
            }
            if (shouldPersistMessage(message, hasValidNetwork)) {
              messagesToPersist.push({ message, network: messageNetwork });
            }
            tabsModified = true;
          }
        } else {
          // Update existing tab
          if (!tabsModified) newTabs = [...newTabs];
          const tab = newTabs[tabIndex];
          
          // Check for duplicate messages (local echo vs server echo)
          // Compare by msgid (IRCv3), or by timestamp + from + text combination
          const isDuplicate = tab.messages.some(m => {
            // If both have msgid (IRCv3 message IDs), compare by that
            if (m.msgid && message.msgid) {
              return m.msgid === message.msgid;
            }
            // Otherwise compare by timestamp + from + text
            // Allow small timestamp difference (up to 5 seconds) for network latency
            const timeDiff = Math.abs(m.timestamp - message.timestamp);
            return timeDiff < 5000 && 
                   m.from?.toLowerCase() === message.from?.toLowerCase() && 
                   m.text === message.text;
          });
          
          if (isDuplicate) {
            if (__DEV__) {
              console.log('📨 useMessageBatching: Skipping duplicate message', message.text?.substring(0, 50));
            }
            continue;
          }
          
          //console.log(`📨 useMessageBatching: Adding message to existing tab ${tab.id} (current: ${tab.messages.length}, batchTag: ${message.batchTag || 'none'}, isPlayback: ${message.isPlayback || false})`);
          const newMessages = [...tab.messages, message];
          const perfConfig = performanceService.getConfig();
          const messagesFinal =
            perfConfig.enableMessageCleanup && newMessages.length > perfConfig.cleanupThreshold
              ? newMessages.slice(-perfConfig.messageLimit)
              : newMessages;

          newTabs[tabIndex] = {
            ...tab,
            messages: messagesFinal,
            hasActivity: tab.id !== activeTabId ? true : tab.hasActivity,
          };
          if (shouldPersistMessage(message, hasValidNetwork)) {
            messagesToPersist.push({ message, network: messageNetwork });
          }
          //console.log(`📨 useMessageBatching: Tab ${tab.id} now has ${messagesFinal.length} messages`);
          tabsModified = true;
        }
      }

      if (!tabsModified) {
        if (__DEV__) {
          console.log('⚠️ No tabs modified, returning prevTabs');
        }
        return prevTabs;
      }
      const result = newTabs.length === prevTabs.length ? newTabs : sortTabsGrouped(newTabs, tabSortAlphabetical);
      if (__DEV__) {
        //console.log('✅ Batch processed, returning', result.length, 'tabs');
      }
      return result;
    });

    if (messagesToPersist.length > 0) {
      messagesToPersist.forEach(({ message, network }) => {
        messageHistoryService.saveMessage(message, network).catch(err => {
          console.error('useMessageBatching: Failed to save message history:', err);
        });
      });
    }

    // Queue newly created tabs for scrollback loading
    if (newlyCreatedTabs.length > 0) {
      newTabsNeedingScrollbackRef.current.push(...newlyCreatedTabs);
      // Trigger scrollback loading
      setTimeout(() => loadScrollbackForNewTabs(), 50);
    }
  }, [activeTabId, loadScrollbackForNewTabs, messageBatchTimeoutRef, pendingMessagesRef, setTabs, tabSortAlphabetical]);

  return { processBatchedMessages };
};
