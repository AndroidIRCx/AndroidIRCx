import { useCallback } from 'react';
import { ChannelTab } from '../services/IRCService';
import { encryptedDMService } from '../services/EncryptedDMService';
import { soundService } from '../services/SoundService';
import { SoundEventType } from '../types/sound';
import { queryTabId } from '../utils/tabUtils';
import { sortTabsGrouped } from '../utils/tabUtils';
import { useUIStore } from '../stores/uiStore';

interface UseUserListActionsProps {
  tabs: ChannelTab[];
  activeTab: ChannelTab;
  tabSortAlphabetical: boolean;
  setTabs: (updater: (prev: ChannelTab[]) => ChannelTab[]) => void;
  setActiveTabId: (id: string) => void;
}

/**
 * Hook to handle user list interactions (user press, WHOIS)
 */
export function useUserListActions({
  tabs,
  activeTab,
  tabSortAlphabetical,
  setTabs,
  setActiveTabId,
}: UseUserListActionsProps) {
  const handleUserPress = useCallback(async (user: { nick: string }) => {
    // Open query window or perform action
    const queryId = queryTabId(activeTab.networkId, user.nick);
    const queryTab = tabs.find(t => t.id === queryId && t.type === 'query');
    if (queryTab) {
      setActiveTabId(queryTab.id);
    } else {
      // Create new query tab
      const network = activeTab.networkId || '';
      const isEncrypted = await encryptedDMService.isEncryptedForNetwork(network, user.nick);
      const newQueryTab: ChannelTab = {
        id: queryId,
        name: user.nick,
        type: 'query',
        networkId: activeTab.networkId,
        messages: [],
        isEncrypted,
      };
      setTabs((prev) => sortTabsGrouped([...prev, newQueryTab], tabSortAlphabetical));
      soundService.playSound(SoundEventType.RING);
      setActiveTabId(newQueryTab.id);
    }
  }, [tabs, activeTab, tabSortAlphabetical, setTabs, setActiveTabId]);

  const handleWHOISPress = useCallback((nick: string) => {
    useUIStore.getState().setWhoisNick(nick);
    useUIStore.getState().setShowWHOIS(true);
  }, []);

  return {
    handleUserPress,
    handleWHOISPress,
  };
}
