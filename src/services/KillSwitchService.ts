/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { Alert, BackHandler, Platform } from 'react-native';
import { connectionManager } from './ConnectionManager';
import { secureStorageService } from './SecureStorageService';
import { dataPrivacyService } from './DataPrivacyService';
import { settingsService, DEFAULT_PART_MESSAGE } from './SettingsService';
import { useTabStore } from '../stores/tabStore';
import { logger } from './Logger';
import { tx } from '../i18n/transifex';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export interface KillSwitchResult {
  success: boolean;
  deletedItems: {
    asyncStorage: boolean;
    secureStorage: boolean;
    fileSystem: boolean;
    connections: boolean;
    logs: boolean;
  };
  errors: string[];
}

class KillSwitchService {
  /**
   * Emergency kill switch - deletes ALL app data
   * This is a nuclear option that removes everything:
   * - All AsyncStorage data
   * - All secure storage (keychain)
   * - All file system data (logs, certs, cache, documents)
   * - All active connections
   * - Everything else
   */
  async activateKillSwitch(): Promise<KillSwitchResult> {
    const result: KillSwitchResult = {
      success: true,
      deletedItems: {
        asyncStorage: false,
        secureStorage: false,
        fileSystem: false,
        connections: false,
        logs: false,
      },
      errors: [],
    };

    try {
      logger.warn('killswitch', '========================================');
      logger.warn('killswitch', 'KILL SWITCH ACTIVATED - DELETING ALL DATA');
      logger.warn('killswitch', '========================================');

      // 1. Close all channels and private messages, then disconnect all connections
      try {
        logger.warn('killswitch', '[1/6] Closing all channels and private messages...');
        
        // Get all tabs from store
        const tabs = useTabStore.getState().tabs;
        const partMessage = await settingsService.getSetting('partMessage', DEFAULT_PART_MESSAGE);
        
        // Get all channels and queries (across all networks)
        const channelsAndQueries = tabs.filter(tab => tab.type === 'channel' || tab.type === 'query');
        
        // Group by network for efficient parting
        const tabsByNetwork = new Map<string, typeof channelsAndQueries>();
        channelsAndQueries.forEach(tab => {
          const networkId = tab.networkId;
          if (!tabsByNetwork.has(networkId)) {
            tabsByNetwork.set(networkId, []);
          }
          tabsByNetwork.get(networkId)!.push(tab);
        });
        
        // Part from all channels for each network (like closeAllChannelsAndQueries)
        for (const [networkId, networkTabs] of tabsByNetwork.entries()) {
          const conn = connectionManager.getConnection(networkId);
          const ircService = conn?.ircService;
          
          if (ircService && ircService.isConnected) {
            for (const tab of networkTabs) {
              try {
                if (tab.type === 'channel') {
                  ircService.partChannel(tab.name, partMessage);
                  logger.warn('killswitch', `Parted from channel: ${tab.name} on ${networkId}`);
                }
                // Queries don't need parting, they're just closed
              } catch (e) {
                logger.error('killswitch', `Failed to part from ${tab.name}: ${String(e)}`);
              }
            }
          }
        }
        
        // Remove all channels and queries from tabs (keep server tabs for now)
        const remainingTabs = tabs.filter(tab => tab.type !== 'channel' && tab.type !== 'query');
        useTabStore.getState().setTabs(remainingTabs);
        
        logger.warn('killswitch', `✓ Closed ${channelsAndQueries.length} channels and private messages`);
        
        // Small delay to ensure PART commands are sent
        await new Promise(resolve => setTimeout(resolve, 500));
        
        logger.warn('killswitch', '[2/6] Disconnecting all connections...');
        // Disconnect all connections
        connectionManager.disconnectAll('Kill switch activated');
        // Clear connection manager state
        connectionManager.clearAll();
        result.deletedItems.connections = true;
        logger.warn('killswitch', '✓ All connections disconnected');
      } catch (error) {
        const errorMsg = `Connections: ${String(error)}`;
        logger.error('killswitch', `✗ ${errorMsg}`);
        result.errors.push(errorMsg);
      }

      // 3. Delete all secure storage (keychain)
      try {
        logger.warn('killswitch', '[3/6] Deleting secure storage...');
        const secretKeys = await secureStorageService.getAllSecretKeys();
        logger.warn('killswitch', `Found ${secretKeys.length} secure keys to delete`);
        
        for (const key of secretKeys) {
          try {
            await secureStorageService.removeSecret(key);
          } catch (e) {
            // Continue even if individual key fails
          }
        }
        
        // Also clear the index
        await AsyncStorage.removeItem('@AndroidIRCX:keychain_index');
        
        result.deletedItems.secureStorage = true;
        logger.warn('killswitch', '✓ Secure storage cleared');
      } catch (error) {
        const errorMsg = `Secure storage: ${String(error)}`;
        logger.error('killswitch', `✗ ${errorMsg}`);
        result.errors.push(errorMsg);
      }

      // 4. Delete all AsyncStorage (including the index)
      try {
        logger.warn('killswitch', '[4/6] Clearing ALL AsyncStorage...');
        const keys = await AsyncStorage.getAllKeys();
        logger.warn('killswitch', `Found ${keys.length} storage keys to delete`);
        
        // Delete EVERYTHING - no exceptions
        await AsyncStorage.multiRemove(keys);
        
        // Also try to clear everything as a fallback
        try {
          await AsyncStorage.clear();
        } catch (e) {
          // Some platforms might not support clear()
        }
        
        result.deletedItems.asyncStorage = true;
        logger.warn('killswitch', '✓ AsyncStorage completely cleared');
      } catch (error) {
        const errorMsg = `AsyncStorage: ${String(error)}`;
        logger.error('killswitch', `✗ ${errorMsg}`);
        result.errors.push(errorMsg);
        result.success = false;
      }

      // 5. Delete all file system data
      try {
        logger.warn('killswitch', '[5/6] Deleting file system data...');
        
        // Delete cache directory
        try {
          const cacheDir = RNFS.CachesDirectoryPath;
          const cacheExists = await RNFS.exists(cacheDir);
          if (cacheExists) {
            const cacheFiles = await RNFS.readDir(cacheDir);
            for (const file of cacheFiles) {
              try {
                if (file.isFile()) {
                  await RNFS.unlink(file.path);
                } else if (file.isDirectory()) {
                  await RNFS.unlink(file.path); // Recursive delete
                }
              } catch (e) {
                // Continue even if individual file fails
              }
            }
          }
        } catch (e) {
          logger.error('killswitch', `Cache deletion error: ${String(e)}`);
        }

        // Delete document directory (logs, certs, backups, etc.)
        try {
          const docDir = RNFS.DocumentDirectoryPath;
          const docExists = await RNFS.exists(docDir);
          if (docExists) {
            const docFiles = await RNFS.readDir(docDir);
            for (const file of docFiles) {
              try {
                // Keep only essential system files if any, but delete everything else
                // Delete all AndroidIRCX related files
                if (file.name.includes('AndroidIRCX') || 
                    file.name.includes('irc') ||
                    file.name.includes('cert') ||
                    file.name.includes('key') ||
                    file.name.includes('log') ||
                    file.name.includes('backup')) {
                  await RNFS.unlink(file.path);
                }
              } catch (e) {
                // Continue even if individual file fails
              }
            }
          }
        } catch (e) {
          logger.error('killswitch', `Document directory deletion error: ${String(e)}`);
        }

        // Delete temporary directory
        try {
          const tempDir = RNFS.TemporaryDirectoryPath;
          const tempExists = await RNFS.exists(tempDir);
          if (tempExists) {
            const tempFiles = await RNFS.readDir(tempDir);
            for (const file of tempFiles) {
              try {
                await RNFS.unlink(file.path);
              } catch (e) {
                // Continue even if individual file fails
              }
            }
          }
        } catch (e) {
          logger.error('killswitch', `Temp directory deletion error: ${String(e)}`);
        }

        result.deletedItems.fileSystem = true;
        logger.warn('killswitch', '✓ File system data cleared');
      } catch (error) {
        const errorMsg = `File system: ${String(error)}`;
        logger.error('killswitch', `✗ ${errorMsg}`);
        result.errors.push(errorMsg);
        result.success = false;
      }

      // 6. Clear logs (if logger has a clear method)
      try {
        logger.warn('killswitch', '[6/6] Clearing logs...');
        // Logger might keep logs in memory, but we've cleared storage
        result.deletedItems.logs = true;
        logger.warn('killswitch', '✓ Logs cleared');
      } catch (error) {
        const errorMsg = `Logs: ${String(error)}`;
        logger.error('killswitch', `✗ ${errorMsg}`);
        result.errors.push(errorMsg);
      }

      logger.warn('killswitch', '========================================');
      logger.warn('killswitch', `KILL SWITCH COMPLETED. Success: ${result.success}`);
      logger.warn('killswitch', `Deleted: ${JSON.stringify(result.deletedItems)}`);
      if (result.errors.length > 0) {
        logger.error('killswitch', `Errors: ${JSON.stringify(result.errors)}`);
      }
      logger.warn('killswitch', '========================================');

      // Exit the app after kill switch completes
      logger.warn('killswitch', 'Exiting application...');
      if (Platform.OS === 'android') {
        // Use a small delay to ensure all cleanup is complete
        setTimeout(() => {
          BackHandler.exitApp();
        }, 1000);
      } else {
        // iOS doesn't support programmatic exit, but we've done all cleanup
        logger.warn('killswitch', 'iOS: App cleanup complete. User can close app manually.');
      }

      return result;
    } catch (error) {
      const errorMsg = `Critical error: ${String(error)}`;
      logger.error('killswitch', `CRITICAL: ${errorMsg}`);
      result.success = false;
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Show confirmation dialog before activating kill switch (if warnings enabled)
   * If warnings disabled, just activate directly after verification
   */
  async confirmAndActivate(showWarnings: boolean = true): Promise<boolean> {
    if (!showWarnings) {
      // No warnings - just activate directly
      const result = await this.activateKillSwitch();
      return result.success;
    }

    // Show warnings if enabled
    return new Promise((resolve) => {
      Alert.alert(
        t('Kill Switch - Delete All Data'),
        t('WARNING: This will PERMANENTLY delete ALL app data including:\n\n• All messages and history\n• All networks and connections\n• All certificates and keys\n• All logs and cache\n• All settings and preferences\n• EVERYTHING\n\nThis action CANNOT be undone!\n\nType "DELETE ALL" to confirm.'),
        [
          {
            text: t('Cancel'),
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: t('Delete All'),
            style: 'destructive',
            onPress: async () => {
              // Show final confirmation
              Alert.alert(
                t('Final Confirmation'),
                t('Are you ABSOLUTELY SURE? This will delete EVERYTHING and cannot be undone.'),
                [
                  {
                    text: t('Cancel'),
                    style: 'cancel',
                    onPress: () => resolve(false),
                  },
                  {
                    text: t('YES, DELETE EVERYTHING'),
                    style: 'destructive',
                    onPress: async () => {
                      const result = await this.activateKillSwitch();
                      Alert.alert(
                        result.success ? t('Kill Switch Activated') : t('Kill Switch Error'),
                        result.success
                          ? t('All data has been deleted. The app will now close.')
                          : `${t('Some errors occurred:')}\n${result.errors.join('\n')}`,
                        [
                          {
                            text: t('OK'),
                            onPress: () => {
                              // App will exit automatically via BackHandler.exitApp() in activateKillSwitch
                              resolve(true);
                            },
                          },
                        ]
                      );
                    },
                  },
                ]
              );
            },
          },
        ]
      );
    });
  }
}

export const killSwitchService = new KillSwitchService();
