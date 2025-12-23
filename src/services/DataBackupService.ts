import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BackupPayload {
  version: number;
  createdAt: string;
  data: Record<string, string | null>;
}

class DataBackupService {
  /**
   * Export all AsyncStorage data into a single JSON string.
   */
  async exportAll(): Promise<string> {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await AsyncStorage.multiGet(keys);
    const payload: BackupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: {},
    };
    entries.forEach(([key, value]) => {
      payload.data[key] = value;
    });
    return JSON.stringify(payload);
  }

  /**
   * Export only settings and configuration (excludes logs and message history).
   */
  async exportSettings(): Promise<string> {
    const keys = await AsyncStorage.getAllKeys();

    // Filter out logs and message history
    const filteredKeys = keys.filter(key => {
      // Exclude message history
      if (key.startsWith('MESSAGES_')) return false;

      // Exclude channel logs
      if (key === 'channelLogs' || key.startsWith('channelLogs:')) return false;

      // Exclude any other log-related keys
      if (key.includes('log') && !key.includes('login')) return false;

      // Include everything else (networks, settings, profiles, etc.)
      return true;
    });

    const entries = await AsyncStorage.multiGet(filteredKeys);
    const payload: BackupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: {},
    };
    entries.forEach(([key, value]) => {
      payload.data[key] = value;
    });
    return JSON.stringify(payload);
  }

  /**
   * Import data from a JSON string produced by exportAll.
   * Existing keys will be overwritten.
   */
  async importAll(json: string): Promise<void> {
    const parsed: BackupPayload = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !parsed.data) {
      throw new Error('Invalid backup format');
    }
    const pairs = Object.entries(parsed.data).map(([key, value]) => [key, value] as [string, string | null]);
    await AsyncStorage.multiSet(pairs);
  }

  /**
   * Quick storage stats (key count and approximate size).
   */
  async getStorageStats(): Promise<{ keyCount: number; totalBytes: number }> {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await AsyncStorage.multiGet(keys);
    const totalBytes = entries.reduce((sum, [, value]) => sum + (value ? value.length : 0), 0);
    return { keyCount: keys.length, totalBytes };
  }

  /**
   * Get all storage keys.
   */
  async getAllKeys(): Promise<string[]> {
    return await AsyncStorage.getAllKeys();
  }

  /**
   * Export only specific keys.
   */
  async exportKeys(keys: string[]): Promise<string> {
    const entries = await AsyncStorage.multiGet(keys);
    const payload: BackupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: {},
    };
    entries.forEach(([key, value]) => {
      payload.data[key] = value;
    });
    return JSON.stringify(payload);
  }
}

export const dataBackupService = new DataBackupService();
