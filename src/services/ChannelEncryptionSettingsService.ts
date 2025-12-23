import AsyncStorage from '@react-native-async-storage/async-storage';

type EncryptionSetting = {
  alwaysEncrypt: boolean;
  createdAt: number;
};

const SETTINGS_PREFIX = 'encstg:alwaysenc:';

class ChannelEncryptionSettingsService {
  private listeners: Array<(channel: string, network: string, value: boolean) => void> = [];

  private canonicalizeNetwork(network: string): string {
    const normalized = (network || '').trim();
    if (!normalized) return normalized;
    // Remove port suffix like " (6697)" or " (2)"
    return normalized.replace(/ \(\d+\)$/, '');
  }

  private getStorageKey(channel: string, network: string): string {
    const canonicalNetwork = this.canonicalizeNetwork(network);
    return `${SETTINGS_PREFIX}${canonicalNetwork.toLowerCase()}:${channel.toLowerCase()}`;
  }

  /**
   * Get the "always encrypt" setting for a channel
   */
  async getAlwaysEncrypt(channel: string, network: string): Promise<boolean> {
    try {
      const storageKey = this.getStorageKey(channel, network);
      const stored = await AsyncStorage.getItem(storageKey);
      if (!stored) return false;
      const parsed = JSON.parse(stored) as EncryptionSetting;
      return parsed.alwaysEncrypt || false;
    } catch (error) {
      console.error('[ChannelEncryptionSettingsService] Failed to get alwaysEncrypt:', error);
      return false;
    }
  }

  /**
   * Set the "always encrypt" setting for a channel
   */
  async setAlwaysEncrypt(channel: string, network: string, value: boolean): Promise<void> {
    try {
      const storageKey = this.getStorageKey(channel, network);
      const setting: EncryptionSetting = {
        alwaysEncrypt: value,
        createdAt: Date.now(),
      };
      await AsyncStorage.setItem(storageKey, JSON.stringify(setting));

      // Notify listeners
      this.listeners.forEach(listener => listener(channel, network, value));
    } catch (error) {
      console.error('[ChannelEncryptionSettingsService] Failed to set alwaysEncrypt:', error);
      throw error;
    }
  }

  /**
   * Remove the "always encrypt" setting for a channel
   */
  async removeAlwaysEncrypt(channel: string, network: string): Promise<void> {
    try {
      const storageKey = this.getStorageKey(channel, network);
      await AsyncStorage.removeItem(storageKey);

      // Notify listeners with false value
      this.listeners.forEach(listener => listener(channel, network, false));
    } catch (error) {
      console.error('[ChannelEncryptionSettingsService] Failed to remove alwaysEncrypt:', error);
      throw error;
    }
  }

  /**
   * Toggle the "always encrypt" setting for a channel
   */
  async toggleAlwaysEncrypt(channel: string, network: string): Promise<boolean> {
    const current = await this.getAlwaysEncrypt(channel, network);
    const newValue = !current;
    await this.setAlwaysEncrypt(channel, network, newValue);
    return newValue;
  }

  /**
   * Register a listener for changes to "always encrypt" settings
   * @returns A function to unsubscribe the listener
   */
  onAlwaysEncryptChange(callback: (channel: string, network: string, value: boolean) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Get all channels/networks with "always encrypt" enabled
   */
  async getAllAlwaysEncryptChannels(): Promise<Array<{ channel: string; network: string }>> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const settingKeys = allKeys.filter(key => key.startsWith(SETTINGS_PREFIX));
      const results: Array<{ channel: string; network: string }> = [];

      for (const key of settingKeys) {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored) as EncryptionSetting;
          if (parsed.alwaysEncrypt) {
            // Parse channel and network from key
            const keyPart = key.substring(SETTINGS_PREFIX.length);
            const parts = keyPart.split(':');
            if (parts.length === 2) {
              results.push({
                network: parts[0],
                channel: parts[1],
              });
            }
          }
        }
      }

      return results;
    } catch (error) {
      console.error('[ChannelEncryptionSettingsService] Failed to get all alwaysEncrypt channels:', error);
      return [];
    }
  }
}

export const channelEncryptionSettingsService = new ChannelEncryptionSettingsService();
export default channelEncryptionSettingsService;
