import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import type { MutableRefObject } from 'react';
import { tabService } from '../services/TabService';
import { useTabStore } from '../stores/tabStore';
import { useConnectionStore } from '../stores/connectionStore';
import { messageHistoryBatching } from '../services/MessageHistoryBatching';
import { notificationService } from '../services/NotificationService';
import type { ChannelTab } from '../types';

interface PendingAlertPayload {
  title: string;
  message?: string;
  buttons?: any;
}

interface UseAppStateEffectsParams {
  appStateRef: MutableRefObject<string>;
  pendingAlertRef: MutableRefObject<PendingAlertPayload | null>;
  activeConnectionId: string | null;
  primaryNetworkId: string | null;
  setTabs: (updater: ChannelTab[] | ((prev: ChannelTab[]) => ChannelTab[])) => void;
}

export const useAppStateEffects = (params: UseAppStateEffectsParams) => {
  const {
    appStateRef,
    pendingAlertRef,
    activeConnectionId,
    primaryNetworkId,
    setTabs,
  } = params;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      appStateRef.current = nextState;

      // Handle pending alerts
      if (nextState === 'active' && pendingAlertRef.current) {
        const { title, message, buttons } = pendingAlertRef.current;
        pendingAlertRef.current = null;
        Alert.alert(title, message, buttons);
      }

      // Flush message history when going to background to prevent data loss
      if (nextState === 'background' || nextState === 'inactive') {
        messageHistoryBatching.flushSync().catch(err => {
          console.error('Error flushing message history on background:', err);
        });
      }

      // Reload tabs from storage when app becomes active (in case state was lost)
      if (nextState === 'active') {
        // Refresh notification permission status when app returns to foreground
        // This ensures we sync with system settings if user changed permissions
        notificationService.refreshPermissionStatus().catch(err => {
          console.error('Error refreshing notification permission status:', err);
        });

        // Get fresh values from store to avoid stale closure issues
        // Use getState() to get the latest values instead of closure values
        const currentTabs = useTabStore.getState().tabs;
        // Get fresh network ID from store instead of closure
        const connectionState = useConnectionStore.getState();
        const freshActiveConnectionId = connectionState.activeConnectionId;
        const freshPrimaryNetworkId = connectionState.primaryNetworkId;
        const currentNetworkId = freshActiveConnectionId || freshPrimaryNetworkId || activeConnectionId || primaryNetworkId;

        // Only reload if we have a network and tabs seem to be missing
        // CRITICAL FIX: Don't reload tabs if they already exist - this would overwrite messages
        // The lazy loading hook will handle loading messages for tabs that need them
        if (currentNetworkId && currentTabs.length === 0) {
          try {
            console.log('?? App became active, reloading tabs from storage for network:', currentNetworkId);
            const loadedTabs = await tabService.getTabs(currentNetworkId);
            // Double-check tabs are still missing before updating (race condition protection)
            const finalTabs = useTabStore.getState().tabs;
            if (finalTabs.length === 0 && loadedTabs && loadedTabs.length > 0) {
              // Use loadTabsFromStorage instead of setTabs to preserve any existing messages
              useTabStore.getState().loadTabsFromStorage(currentNetworkId);
              console.log('? Reloaded', loadedTabs.length, 'tabs from storage');
            }
          } catch (error) {
            console.error('? Failed to reload tabs from storage:', error);
          }
        }
      }
    });
    return () => {
      subscription.remove();
    };
  }, [activeConnectionId, appStateRef, pendingAlertRef, primaryNetworkId, setTabs]);
};
