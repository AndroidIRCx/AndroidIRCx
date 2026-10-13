/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useCallback, useRef, useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { IRCMessage } from '../services/IRCService';
import { performanceService } from '../services/PerformanceService';
import {
  noticeTabId,
  notificationsTabId,
  sortTabsGrouped,
} from '../utils/tabUtils';
import { soundService } from '../services/SoundService';
import { SoundEventType } from '../types/sound';
import { messageHistoryService } from '../services/MessageHistoryService';
import { bouncerService } from '../services/BouncerService';
import type { ChannelTab } from '../types';
import { debugLogger } from '../services/DebugLogger';

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
  messageBatchTimeoutRef: MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>;
  activeTabId: string | null;
  tabSortAlphabetical: boolean;
  setTabs: Dispatch<SetStateAction<ChannelTab[]>>;
}

type PendingAppend = { messages: IRCMessage[]; msgids: Set<string> };

/** Local echo is reconciled against lines this recent. */
const LOCAL_ECHO_WINDOW_MS = 8000;
/** How far back from the end a local-echo match is looked for. */
const LOCAL_ECHO_SCAN = 200;

const collectMsgids = (messages: IRCMessage[]): Set<string> => {
  const ids = new Set<string>();
  for (const m of messages) if (m.msgid) ids.add(m.msgid);
  return ids;
};

const isLocalEcho = (m: IRCMessage) =>
  m.status === 'sent' || m.status === 'pending';

const isEchoOf = (m: IRCMessage, message: IRCMessage) =>
  (isLocalEcho(m) || isLocalEcho(message)) &&
  !(m.msgid && message.msgid) &&
  Math.abs(m.timestamp - message.timestamp) < LOCAL_ECHO_WINDOW_MS &&
  m.type === message.type &&
  m.from?.toLowerCase() === message.from?.toLowerCase() &&
  m.text === message.text;

/**
 * Same rule as before, without scanning the whole tab per message: msgids are
 * looked up in a set, and the text/time match is only for local echo
 * reconciliation, which by definition concerns the last few seconds.
 */
const isDuplicateMessage = (
  message: IRCMessage,
  existing: IRCMessage[],
  pending: PendingAppend,
): boolean => {
  if (message.msgid && pending.msgids.has(message.msgid)) return true;
  for (let i = pending.messages.length - 1; i >= 0; i--) {
    if (isEchoOf(pending.messages[i], message)) return true;
  }
  const stop = Math.max(0, existing.length - LOCAL_ECHO_SCAN);
  for (let i = existing.length - 1; i >= stop; i--) {
    if (isEchoOf(existing[i], message)) return true;
  }
  return false;
};

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
          tabInfo.channelName,
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
            const existingTimestamps = new Set(
              tab.messages.map(m => m.timestamp),
            );
            const uniqueScrollback = markedScrollback.filter(
              m => !existingTimestamps.has(m.timestamp),
            );

            if (uniqueScrollback.length === 0) {
              return prevTabs;
            }

            // Add separator message between scrollback and new messages
            const separatorMessage: IRCMessage = {
              id: `scrollback-separator-${Date.now()}`,
              type: 'system',
              text: `─── Scrollback (${uniqueScrollback.length} messages) ───`,
              timestamp:
                uniqueScrollback[uniqueScrollback.length - 1]?.timestamp ||
                Date.now(),
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

            debugLogger.debug(
              'messageBatching',
              `Loaded ${uniqueScrollback.length} scrollback messages`,
              tabInfo.channelName,
            );
            return newTabs;
          });
        }
      } catch (error) {
        console.error(
          `Failed to load scrollback for ${tabInfo.channelName}:`,
          error,
        );
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
    debugLogger.debug(
      'messageBatching',
      'processBatchedMessages called',
      batch.length,
    );
    if (batch.length === 0) return;

    // Clear the queue
    pendingMessagesRef.current = [];
    messageBatchTimeoutRef.current = null;

    debugLogger.debug('messageBatching', 'Processing batch', batch.length);

    // Track newly created tabs for scrollback loading
    const newlyCreatedTabs: NewTabInfo[] = [];
    const messagesToPersist: Array<{ message: IRCMessage; network: string }> =
      [];

    const shouldPersistMessage = (
      message: IRCMessage,
      hasValidNetwork: boolean,
    ): boolean => {
      if (!hasValidNetwork) return false;
      if (message.isScrollback || message.isPlayback) return false;
      if (message.isRaw || message.type === 'raw') return false;
      return true;
    };

    // Process all messages in a single setTabs call
    setTabs(prevTabs => {
      debugLogger.debug(
        'messageBatching',
        'setTabs called with current tabs',
        prevTabs.length,
      );
      let newTabs = prevTabs;
      let tabsModified = false;
      // Messages bound for existing tabs are collected here and appended once
      // per tab after the loop: copying a tab's whole array for every message
      // made a flush O(batch x history), which froze bouncer replays.
      const appendsByTabId = new Map<string, PendingAppend>();

      for (const { message, context } of batch) {
        if (!context) {
          debugLogger.warn(
            'messageBatching',
            'Skipping message without context',
            message,
          );
          continue;
        }

        const {
          targetTabId,
          targetTabType,
          messageNetwork,
          newTabIsEncrypted,
          hasValidNetwork,
        } = context;

        if (hasValidNetwork) {
          // Ensure notices tab if needed
          if (
            targetTabId === noticeTabId(messageNetwork) &&
            !newTabs.some(t => t.id === targetTabId)
          ) {
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
          if (
            targetTabId === notificationsTabId(messageNetwork) &&
            !newTabs.some(t => t.id === targetTabId)
          ) {
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
                t.name.toLowerCase() === normalizedName,
            );
          } else if (targetTabType === 'query') {
            tabIndex = newTabs.findIndex(
              t =>
                t.type === 'query' &&
                t.networkId === messageNetwork &&
                t.name.toLowerCase() === normalizedName,
            );
          }
        }

        if (tabIndex === -1) {
          // Create new tab
          if (hasValidNetwork) {
            if (targetTabType === 'server') {
              continue;
            }
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
          const tab = newTabs[tabIndex];
          let pending = appendsByTabId.get(tab.id);
          if (!pending) {
            pending = { messages: [], msgids: collectMsgids(tab.messages) };
            appendsByTabId.set(tab.id, pending);
          }

          if (isDuplicateMessage(message, tab.messages, pending)) {
            debugLogger.debug(
              'messageBatching',
              'Skipping duplicate message',
              message.text?.substring(0, 50),
            );
            continue;
          }

          pending.messages.push(message);
          if (message.msgid) pending.msgids.add(message.msgid);
          if (shouldPersistMessage(message, hasValidNetwork)) {
            messagesToPersist.push({ message, network: messageNetwork });
          }
        }
      }

      const hasAppends = Array.from(appendsByTabId.values()).some(
        pending => pending.messages.length > 0,
      );
      if (hasAppends) {
        const perfConfig = performanceService.getConfig();
        if (!tabsModified) newTabs = [...newTabs];
        newTabs = newTabs.map(tab => {
          const pending = appendsByTabId.get(tab.id);
          if (!pending || pending.messages.length === 0) return tab;
          const merged = tab.messages.concat(pending.messages);
          return {
            ...tab,
            messages:
              perfConfig.enableMessageCleanup &&
              merged.length > perfConfig.cleanupThreshold
                ? merged.slice(-perfConfig.messageLimit)
                : merged,
            hasActivity: tab.id !== activeTabId ? true : tab.hasActivity,
          };
        });
        tabsModified = true;
      }

      if (!tabsModified) {
        debugLogger.debug(
          'messageBatching',
          'No tabs modified, returning previous tabs',
        );
        return prevTabs;
      }
      const result =
        newTabs.length === prevTabs.length
          ? newTabs
          : sortTabsGrouped(newTabs, tabSortAlphabetical);
      if (__DEV__) {
        //console.log('✅ Batch processed, returning', result.length, 'tabs');
      }
      return result;
    });

    if (messagesToPersist.length > 0) {
      messagesToPersist.forEach(({ message, network }) => {
        messageHistoryService.saveMessage(message, network).catch(err => {
          console.error(
            'useMessageBatching: Failed to save message history:',
            err,
          );
        });
      });
    }

    // Queue newly created tabs for scrollback loading
    if (newlyCreatedTabs.length > 0) {
      newTabsNeedingScrollbackRef.current.push(...newlyCreatedTabs);
      // Trigger scrollback loading
      setTimeout(() => loadScrollbackForNewTabs(), 50);
    }
  }, [
    activeTabId,
    loadScrollbackForNewTabs,
    messageBatchTimeoutRef,
    pendingMessagesRef,
    setTabs,
    tabSortAlphabetical,
  ]);

  return { processBatchedMessages };
};
