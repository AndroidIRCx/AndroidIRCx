/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { dccChatService } from '../services/DCCChatService';
import { useTabStore } from '../stores/tabStore';
import { useConnectionStore } from '../stores/connectionStore';
import type { ChannelTab } from '../types';
import { sortTabsGrouped } from '../utils/tabUtils';

interface UseDccSessionSyncParams {
  isMountedRef: MutableRefObject<boolean>;
  tabSortAlphabetical: boolean;
}

export const useDccSessionSync = (params: UseDccSessionSyncParams) => {
  const { isMountedRef, tabSortAlphabetical } = params;

  useEffect(() => {
    const unsubSession = dccChatService.onSessionUpdate(session => {
      if (session.status === 'connected') {
        const tabId = `dcc::${session.networkId}::${session.peerNick}`;

        if (!isMountedRef.current) return;

        const tabStore = useTabStore.getState();
        const currentTabs = tabStore.tabs;
        const existing = currentTabs.find(t => t.id === tabId);

        if (existing) {
          tabStore.setTabs(
            currentTabs.map(t =>
              t.id === tabId
                ? { ...t, messages: session.messages, dccSessionId: session.id }
                : t,
            ),
          );
        } else {
          const newTab: ChannelTab = {
            id: tabId,
            name: `DCC: ${session.peerNick}`,
            type: 'dcc',
            networkId: session.networkId,
            messages: session.messages,
            dccSessionId: session.id,
          };
          tabStore.setTabs(
            sortTabsGrouped([...currentTabs, newTab], tabSortAlphabetical),
          );
        }

        tabStore.setActiveTabId(tabId);
        useConnectionStore.getState().setNetworkName(session.networkId);
      } else if (session.status === 'closed' || session.status === 'failed') {
        // Keep tab for history; could remove if desired
      }
    });

    const unsubMsg = dccChatService.onMessage((sessionId, message, session) => {
      const tabId = `dcc::${session.networkId}::${session.peerNick}`;

      if (!isMountedRef.current) return;

      const tabStore = useTabStore.getState();
      tabStore.setTabs(
        tabStore.tabs.map(t =>
          t.id === tabId ? { ...t, messages: [...t.messages, message] } : t,
        ),
      );
    });

    return () => {
      unsubSession();
      unsubMsg();
    };
  }, [isMountedRef, tabSortAlphabetical]);
};
