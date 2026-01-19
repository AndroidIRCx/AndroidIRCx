import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ChannelUser } from '../services/IRCService';
import { settingsService, DEFAULT_PART_MESSAGE } from '../services/SettingsService';
import { connectionManager } from '../services/ConnectionManager';
import { tabService } from '../services/TabService';
import { useTabStore } from '../stores/tabStore';
import { useUIStore } from '../stores/uiStore';
import { sortTabsGrouped } from '../utils/tabUtils';
import type { ChannelTab } from '../types';

interface UseTabActionsParams {
  activeTabId: string | null;
  channelName: string;
  tabSortAlphabetical: boolean;
  tabsRef: MutableRefObject<ChannelTab[]>;
  getActiveIRCService: () => any;
  setActiveTabId: (id: string) => void;
  setNetworkName: (name: string) => void;
  setActiveConnectionId: (id: string | null) => void;
  setTabs: Dispatch<SetStateAction<ChannelTab[]>>;
  setChannelUsers: Dispatch<SetStateAction<Map<string, ChannelUser[]>>>;
}

export const useTabActions = (params: UseTabActionsParams) => {
  const {
    activeTabId,
    channelName,
    tabSortAlphabetical,
    tabsRef,
    getActiveIRCService,
    setActiveTabId,
    setNetworkName,
    setActiveConnectionId,
    setTabs,
    setChannelUsers,
  } = params;

  const handleTabPress = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    // Use direct store access to avoid infinite loop
    const currentTabs = useTabStore.getState().tabs;
    const tab = currentTabs.find(t => t.id === tabId);
    if (tab) {
      setNetworkName(tab.networkId);
      setActiveConnectionId(tab.networkId);
      connectionManager.setActiveConnection(tab.networkId);
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, hasActivity: false } : t));
    }
    // Fetch users for the channel if it's a channel tab
    if (tab && (tab.type === 'channel' || tab.type === 'dcc')) {
      const conn = connectionManager.getConnection(tab.networkId);
      const activeIRCService = conn?.ircService || getActiveIRCService();
      const users = activeIRCService.getChannelUsers(tab.name);
      if (users.length > 0) {
        setChannelUsers((prev) => {
          const newMap = new Map(prev);
          newMap.set(tab.name, users);
          return newMap;
        });
      } else {
        // Request user list if not available
        activeIRCService.requestChannelUsers(tab.name);
      }
    }
  }, [getActiveIRCService, setActiveConnectionId, setActiveTabId, setChannelUsers, setNetworkName, setTabs]);

  const handleJoinChannel = useCallback((channel?: string, key?: string) => {
    const channelToJoin = channel || channelName.trim();
    if (channelToJoin) {
      const activeIRCService = getActiveIRCService();
      activeIRCService.joinChannel(channelToJoin, key);
      useUIStore.getState().setChannelName('');
      useUIStore.getState().setShowChannelModal(false);
    }
  }, [channelName, getActiveIRCService]);

  const closeAllChannelsAndQueries = useCallback(async (networkId: string) => {
    const currentTabs = tabsRef.current;
    const toClose = currentTabs.filter(
      tab => tab.networkId === networkId && (tab.type === 'channel' || tab.type === 'query')
    );
    if (toClose.length === 0) return;

    const partMessage = await settingsService.getSetting('partMessage', DEFAULT_PART_MESSAGE);
    const conn = connectionManager.getConnection(networkId);
    const svc = conn?.ircService;
    toClose.forEach(tab => {
      if (tab.type === 'channel') {
        svc?.partChannel(tab.name, partMessage);
      }
    });

    const remaining = currentTabs.filter(
      tab => !(tab.networkId === networkId && (tab.type === 'channel' || tab.type === 'query'))
    );
    setTabs(sortTabsGrouped(remaining, tabSortAlphabetical));
    await tabService.saveTabs(networkId, remaining.filter(tab => tab.networkId === networkId));

    if (toClose.some(tab => tab.id === activeTabId)) {
      const serverTab = remaining.find(tab => tab.networkId === networkId && tab.type === 'server');
      if (serverTab) {
        setActiveTabId(serverTab.id);
        setNetworkName(serverTab.networkId);
      }
    }
  }, [activeTabId, setActiveTabId, setNetworkName, setTabs, tabSortAlphabetical, tabsRef]);

  return {
    handleTabPress,
    handleJoinChannel,
    closeAllChannelsAndQueries,
  };
};
