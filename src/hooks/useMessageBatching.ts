import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { IRCMessage } from '../services/IRCService';
import { performanceService } from '../services/PerformanceService';
import { serverTabId, noticeTabId, makeServerTab, sortTabsGrouped } from '../utils/tabUtils';
import { soundService } from '../services/SoundService';
import { SoundEventType } from '../types/sound';
import type { ChannelTab } from '../types';

interface MessageBatchItem {
  message: IRCMessage;
  context: any;
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
            newTabs.push({
              id: targetTabId,
              name: targetTabType === 'server' ? messageNetwork : (message.channel || message.from || targetTabId),
              type: targetTabType,
              networkId: messageNetwork,
              messages: [message],
              isEncrypted: newTabIsEncrypted,
              sendEncrypted: false,
            });
            if (targetTabType === 'query') {
              soundService.playSound(SoundEventType.RING);
            }
            tabsModified = true;
          }
        } else {
          // Update existing tab
          if (!tabsModified) newTabs = [...newTabs];
          const tab = newTabs[tabIndex];
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
        console.log('✅ Batch processed, returning', result.length, 'tabs');
      }
      return result;
    });
  }, [activeTabId, messageBatchTimeoutRef, pendingMessagesRef, setTabs, tabSortAlphabetical]);

  return { processBatchedMessages };
};
