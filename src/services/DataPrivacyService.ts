/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Platform } from 'react-native';
import { settingsService } from './SettingsService';
import { messageHistoryService } from './MessageHistoryService';
import { identityProfilesService } from './IdentityProfilesService';
import { consentService } from './ConsentService';
import { logger } from './Logger';

export interface ExportedData {
  exportDate: string;
  version: string;
  userData: {
    settings: any;
    networks: any[];
    identityProfiles: any[];
    messageHistory: any[];
    consentStatus: string;
  };
}

export interface DataDeletionResult {
  success: boolean;
  deletedItems: {
    messageHistory: boolean;
    settings: boolean;
    networks: boolean;
    identityProfiles: boolean;
    consent: boolean;
    cache: boolean;
  };
  errors: string[];
}

class DataPrivacyService {
  /**
   * Export all user data to a JSON file
   */
  async exportUserData(): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      logger.info('privacy', 'Starting user data export...');

      // Collect all user data
      const exportData: ExportedData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        userData: {
          settings: await this.getSettingsData(),
          networks: await this.getNetworksData(),
          identityProfiles: await this.getIdentityProfilesData(),
          messageHistory: await this.getMessageHistoryData(),
          consentStatus: consentService.getConsentStatusText(),
        },
      };

      // Create JSON string
      const jsonData = JSON.stringify(exportData, null, 2);

      // Save to file
      const fileName = `AndroidIRCX_Export_${new Date().getTime()}.json`;
      const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      await RNFS.writeFile(filePath, jsonData, 'utf8');

      logger.info('privacy', `Data exported to: ${filePath}`);

      return { success: true, filePath };
    } catch (error) {
      logger.error('privacy', `Failed to export data: ${String(error)}`);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Share exported data file
   */
  async shareExportedData(filePath: string): Promise<boolean> {
    try {
      const fileUrl = Platform.OS === 'android' ? `file://${filePath}` : filePath;

      await Share.open({
        url: fileUrl,
        type: 'application/json',
        subject: 'AndroidIRCX - My Data Export',
        message: 'My exported data from AndroidIRCX',
      });

      return true;
    } catch (error) {
      // User cancelled share - not an error
      if ((error as any).message?.includes('User did not share')) {
        return false;
      }
      logger.error('privacy', `Failed to share data: ${String(error)}`);
      return false;
    }
  }

  /**
   * Delete all user data (GDPR Right to Erasure)
   */
  async deleteAllUserData(): Promise<DataDeletionResult> {
    const result: DataDeletionResult = {
      success: true,
      deletedItems: {
        messageHistory: false,
        settings: false,
        networks: false,
        identityProfiles: false,
        consent: false,
        cache: false,
      },
      errors: [],
    };

    try {
      logger.info('privacy', '========================================');
      logger.info('privacy', 'Starting complete data deletion (GDPR/CCPA Right to Erasure)');
      logger.info('privacy', '========================================');

      // 1. Delete message history
      try {
        logger.info('privacy', '[1/6] Deleting message history...');
        // Get all networks and delete their message history
        const networks = await settingsService.loadNetworks();
        logger.info('privacy', `Deleting messages for ${networks.length} networks`);

        for (const network of networks) {
          await messageHistoryService.deleteNetworkMessages(network.id);
        }

        result.deletedItems.messageHistory = true;
        logger.info('privacy', '✓ Message history deleted successfully');
      } catch (error) {
        const errorMsg = `Message history: ${String(error)}`;
        logger.error('privacy', `✗ ${errorMsg}`);
        console.error('[DataPrivacy] Message history deletion failed:', error);
        result.errors.push(errorMsg);
        result.success = false;
      }

      // 2. Delete all networks
      try {
        logger.info('privacy', '[2/6] Deleting all networks...');
        const networks = await settingsService.loadNetworks();
        logger.info('privacy', `Found ${networks.length} networks to delete`);
        for (const network of networks) {
          logger.info('privacy', `Deleting network: ${network.id}`);
          await settingsService.deleteNetwork(network.id);
        }
        result.deletedItems.networks = true;
        logger.info('privacy', `✓ All ${networks.length} networks deleted successfully`);
      } catch (error) {
        const errorMsg = `Networks: ${String(error)}`;
        logger.error('privacy', `✗ ${errorMsg}`);
        console.error('[DataPrivacy] Network deletion failed:', error);
        result.errors.push(errorMsg);
        result.success = false;
      }

      // 3. Delete identity profiles
      try {
        logger.info('privacy', '[3/6] Deleting identity profiles...');
        const profiles = await identityProfilesService.list();
        logger.info('privacy', `Found ${profiles.length} profiles to delete`);
        for (const profile of profiles) {
          logger.info('privacy', `Deleting profile: ${profile.id}`);
          await identityProfilesService.remove(profile.id);
        }
        result.deletedItems.identityProfiles = true;
        logger.info('privacy', `✓ All ${profiles.length} identity profiles deleted successfully`);
      } catch (error) {
        const errorMsg = `Identity profiles: ${String(error)}`;
        logger.error('privacy', `✗ ${errorMsg}`);
        console.error('[DataPrivacy] Identity profile deletion failed:', error);
        result.errors.push(errorMsg);
        result.success = false;
      }

      // 4. Reset consent
      try {
        logger.info('privacy', '[4/6] Resetting consent preferences...');
        await consentService.resetConsent();
        result.deletedItems.consent = true;
        logger.info('privacy', '✓ Consent preferences reset successfully');
      } catch (error) {
        const errorMsg = `Consent: ${String(error)}`;
        logger.error('privacy', `✗ ${errorMsg}`);
        console.error('[DataPrivacy] Consent reset failed:', error);
        result.errors.push(errorMsg);
        result.success = false;
      }

      // 5. Clear all AsyncStorage (settings, preferences, etc.)
      try {
        logger.info('privacy', '[5/6] Clearing AsyncStorage...');
        const keys = await AsyncStorage.getAllKeys();
        logger.info('privacy', `Found ${keys.length} storage keys`);

        // Keep ONLY essential keys needed for app to function
        const essentialKeys = ['FIRST_RUN_COMPLETED'];
        const keysToDelete = keys.filter(key =>
          !essentialKeys.some(essential => key === essential)
        );

        logger.info('privacy', `Deleting ${keysToDelete.length} keys (keeping ${keys.length - keysToDelete.length} essential keys)`);
        await AsyncStorage.removeMany(keysToDelete);
        result.deletedItems.settings = true;
        logger.info('privacy', '✓ AsyncStorage cleared successfully');
      } catch (error) {
        const errorMsg = `Settings: ${String(error)}`;
        logger.error('privacy', `✗ ${errorMsg}`);
        console.error('[DataPrivacy] AsyncStorage clearing failed:', error);
        result.errors.push(errorMsg);
        result.success = false;
      }

      // 6. Clear cache directory
      try {
        logger.info('privacy', '[6/6] Clearing cache directory...');
        const cacheDir = RNFS.CachesDirectoryPath;
        logger.info('privacy', `Cache directory: ${cacheDir}`);

        const exists = await RNFS.exists(cacheDir);
        if (exists) {
          const files = await RNFS.readDir(cacheDir);
          logger.info('privacy', `Found ${files.length} cached files`);

          let deletedCount = 0;
          let failedCount = 0;

          for (const file of files) {
            try {
              await RNFS.unlink(file.path);
              deletedCount++;
            } catch (fileError) {
              logger.error('privacy', `Failed to delete ${file.name}: ${String(fileError)}`);
              failedCount++;
            }
          }

          logger.info('privacy', `Deleted ${deletedCount} files, ${failedCount} failed`);
          result.deletedItems.cache = true;
          logger.info('privacy', '✓ Cache cleared');
        } else {
          logger.info('privacy', 'Cache directory does not exist');
          result.deletedItems.cache = true;
        }
      } catch (error) {
        const errorMsg = `Cache: ${String(error)}`;
        logger.error('privacy', `✗ ${errorMsg}`);
        console.error('[DataPrivacy] Cache clearing failed:', error);
        result.errors.push(errorMsg);
        result.success = false;
      }

      logger.info('privacy', '========================================');
      logger.info('privacy', `Data deletion completed. Overall success: ${result.success}`);
      logger.info('privacy', `Deleted: ${JSON.stringify(result.deletedItems)}`);
      if (result.errors.length > 0) {
        logger.error('privacy', `Errors encountered: ${JSON.stringify(result.errors)}`);
        console.error('[DataPrivacy] Deletion errors:', result.errors);
      }
      logger.info('privacy', '========================================');

      return result;
    } catch (error) {
      const errorMsg = `General error: ${String(error)}`;
      logger.error('privacy', `CRITICAL: Data deletion failed with general error: ${errorMsg}`);
      console.error('[DataPrivacy] CRITICAL deletion failure:', error);
      result.success = false;
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Opt-out of crash reporting (GDPR/CCPA)
   */
  async setCrashlyticsOptOut(optOut: boolean): Promise<void> {
    try {
      const crashlyticsInstance = getCrashlytics();
      await setCrashlyticsCollectionEnabled(crashlyticsInstance, !optOut);
      await AsyncStorage.setItem('@AndroidIRCX:crashlytics_opt_out', String(optOut));
      logger.info('privacy', `Crashlytics collection ${optOut ? 'disabled' : 'enabled'}`);
    } catch (error) {
      logger.error('privacy', `Failed to set crashlytics opt-out: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Check if user has opted out of crashlytics
   */
  async getCrashlyticsOptOut(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem('@AndroidIRCX:crashlytics_opt_out');
      return value === 'true';
      } catch {
        return false;
      }
  }

  /**
   * Get summary of data collected
   */
  async getDataCollectionSummary(): Promise<{
    messagesCount: number;
    networksCount: number;
    identityProfilesCount: number;
    storageSize: string;
    crashlyticsEnabled: boolean;
    consentStatus: string;
  }> {
    try {
      const networks = await settingsService.loadNetworks();
      const profiles = await identityProfilesService.list();
      const crashlyticsOptOut = await this.getCrashlyticsOptOut();

      // Get approximate message count
      let messagesCount = 0;
      try {
        // This is an approximation - would need to count all messages
        messagesCount = 0; // messageHistoryService doesn't expose count method
      } catch {
        messagesCount = 0;
      }

      // Get storage size
      let storageSize = '0 KB';
      try {
        const keys = await AsyncStorage.getAllKeys();
        let totalSize = 0;
        for (const key of keys) {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            totalSize += value.length;
          }
        }
        storageSize = `${(totalSize / 1024).toFixed(2)} KB`;
      } catch {
        storageSize = 'Unknown';
      }

      return {
        messagesCount,
        networksCount: networks.length,
        identityProfilesCount: profiles.length,
        storageSize,
        crashlyticsEnabled: !crashlyticsOptOut,
        consentStatus: consentService.getConsentStatusText(),
      };
    } catch (error) {
      logger.error('privacy', `Failed to get data summary: ${String(error)}`);
      throw error;
    }
  }

  // Private helper methods

  private async getSettingsData(): Promise<any> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const settings: any = {};

      for (const key of keys) {
        if (key.startsWith('@AndroidIRCX:')) {
          const value = await AsyncStorage.getItem(key);
          try {
            settings[key] = value ? JSON.parse(value) : value;
          } catch {
            settings[key] = value;
          }
        }
      }

      return settings;
    } catch (error) {
      logger.error('privacy', `Failed to get settings: ${String(error)}`);
      return {};
    }
  }

  private async getNetworksData(): Promise<any[]> {
    try {
      return await settingsService.loadNetworks();
    } catch (error) {
      logger.error('privacy', `Failed to get networks: ${String(error)}`);
      return [];
    }
  }

  private async getIdentityProfilesData(): Promise<any[]> {
    try {
      return await identityProfilesService.list();
    } catch (error) {
      logger.error('privacy', `Failed to get identity profiles: ${String(error)}`);
      return [];
    }
  }

  private async getMessageHistoryData(): Promise<any[]> {
    try {
      // Get messages for all networks and channels
      const networks = await settingsService.loadNetworks();
      const allMessages: any[] = [];

      for (const network of networks) {
        const channels = ['server']; // Start with server channel

        // Get messages for each channel
        for (const channel of channels) {
          try {
            const messages = await messageHistoryService.searchMessages({
              network: network.id,
              channel,
            });
            allMessages.push({
              network: network.id,
              channel,
              messages,
            });
          } catch {
            // Skip channels that don't have messages
          }
        }
      }

      return allMessages;
    } catch (error) {
      logger.error('privacy', `Failed to get message history: ${String(error)}`);
      return [];
    }
  }
}

export const dataPrivacyService = new DataPrivacyService();
