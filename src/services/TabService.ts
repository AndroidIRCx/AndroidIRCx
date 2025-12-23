import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChannelTab } from '../types';

const TABS_STORAGE_KEY_PREFIX = 'TABS_';

class TabService {
  public async getTabs(network: string): Promise<ChannelTab[]> {
    // Never load or create tabs for "Not connected" network
    if (network === 'Not connected') {
      console.log('⚠️ Prevented loading tabs for "Not connected" network');
      return [];
    }

    try {
      const key = `${TABS_STORAGE_KEY_PREFIX}${network}`;
      const storedTabs = await AsyncStorage.getItem(key);
      if (storedTabs) {
        // Ensure messages are not loaded, only tab structure
        const tabs: ChannelTab[] = JSON.parse(storedTabs);
        // Filter out any "Not connected" tabs
        return tabs
          .filter(tab => tab.name !== 'Not connected' && tab.networkId !== 'Not connected')
          .map(tab => ({
            ...tab,
            networkId: tab.networkId || network,
            id: tab.id.includes('::') ? tab.id : (tab.type === 'server' ? `server::${network}` : tab.id),
            messages: [],
          }));
      }
    } catch (error) {
      console.error('Failed to load tabs from storage:', error);
    }
    // Return default server tab if nothing is stored
    const serverId = `server::${network}`;
    return [{ id: serverId, name: network, type: 'server', networkId: network, messages: [] }];
  }

  public async saveTabs(network: string, tabs: ChannelTab[]): Promise<void> {
    // Never save tabs for "Not connected" network
    if (network === 'Not connected') {
      console.log('⚠️ Prevented saving tabs for "Not connected" network');
      return;
    }

    try {
      const key = `${TABS_STORAGE_KEY_PREFIX}${network}`;
      // Do not save messages, only the tab structure
      // Filter out any "Not connected" tabs before saving
      const tabsToSave = tabs
        .filter(tab => tab.name !== 'Not connected' && tab.networkId !== 'Not connected')
        .map(({ messages, ...rest }) => rest);
      await AsyncStorage.setItem(key, JSON.stringify(tabsToSave));
    } catch (error) {
      console.error('Failed to save tabs to storage:', error);
    }
  }

  public async removeTab(network: string, tabId: string): Promise<void> {
    try {
      const currentTabs = await this.getTabs(network);
      const updatedTabs = currentTabs.filter(tab => tab.id !== tabId);
      await this.saveTabs(network, updatedTabs);
    } catch (error) {
      console.error('Failed to remove tab from storage:', error);
    }
  }
}

export const tabService = new TabService();
