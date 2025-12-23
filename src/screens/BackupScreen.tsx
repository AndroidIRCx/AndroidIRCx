import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { dataBackupService } from '../services/DataBackupService';
import Clipboard from '@react-native-clipboard/clipboard';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { useT } from '../i18n/transifex';

interface BackupScreenProps {
  visible: boolean;
  onClose: () => void;
}

interface BackupOption {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  keyPattern: string | RegExp | ((key: string) => boolean);
}

export const BackupScreen: React.FC<BackupScreenProps> = ({ visible, onClose }) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const tags = 'screen:backup,file:BackupScreen.tsx,feature:backup';

  const [backupOptions, setBackupOptions] = useState<BackupOption[]>([
    {
      id: 'networks',
      name: t('Networks & Servers', { _tags: tags }),
      description: t('IRC network configurations and server settings', { _tags: tags }),
      enabled: true,
      keyPattern: (key) => key.includes('@AndroidIRCX:networks') || key.includes('NETWORKS'),
    },
    {
      id: 'settings',
      name: t('App Settings', { _tags: tags }),
      description: t('General app preferences and configurations', { _tags: tags }),
      enabled: true,
      keyPattern: (key) => key.includes('@AndroidIRCX:settings:') || key === 'SETTINGS',
    },
    {
      id: 'encryption',
      name: t('Encryption Keys', { _tags: tags }),
      description: t('Channel encryption keys and DM bundles', { _tags: tags }),
      enabled: true,
      keyPattern: (key) => key.startsWith('chanenc:') || key.startsWith('encdm:') || key.startsWith('encstg:'),
    },
    {
      id: 'profiles',
      name: t('Identity & Connection Profiles', { _tags: tags }),
      description: t('User identity profiles and connection templates', { _tags: tags }),
      enabled: true,
      keyPattern: (key) => key.includes('identityProfiles') || key.includes('connectionProfiles'),
    },
    {
      id: 'favorites',
      name: t('Channel Favorites', { _tags: tags }),
      description: t('Favorite channels and auto-join settings', { _tags: tags }),
      enabled: true,
      keyPattern: (key) => key.includes('channelFavorites'),
    },
    {
      id: 'notes',
      name: t('Channel Notes & Bookmarks', { _tags: tags }),
      description: t('Channel notes, bookmarks, and user aliases', { _tags: tags }),
      enabled: true,
      keyPattern: (key) => key.includes('channelNotes') || key.includes('channelBookmarks') || key.includes('userAlias'),
    },
    {
      id: 'highlights',
      name: t('Highlights & Notifications', { _tags: tags }),
      description: t('Highlight words and notification preferences', { _tags: tags }),
      enabled: true,
      keyPattern: (key) => key.includes('HIGHLIGHT') || key.includes('notification'),
    },
    {
      id: 'tabs',
      name: t('Open Tabs', { _tags: tags }),
      description: t('Currently open channel and query tabs', { _tags: tags }),
      enabled: false,
      keyPattern: (key) => key.startsWith('TABS_'),
    },
    {
      id: 'messages',
      name: t('Message History', { _tags: tags }),
      description: t('Saved message history for all tabs', { _tags: tags }),
      enabled: false,
      keyPattern: (key) => key.startsWith('MESSAGES_'),
    },
    {
      id: 'logs',
      name: t('Activity Logs', { _tags: tags }),
      description: t('Channel activity logs and join/part history', { _tags: tags }),
      enabled: false,
      keyPattern: (key) => key.includes('log') && !key.includes('login'),
    },
  ]);

  const [backupData, setBackupData] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [storageStats, setStorageStats] = useState({ keyCount: 0, totalBytes: 0 });

  useEffect(() => {
    if (visible) {
      loadStorageStats();
    }
  }, [visible]);

  const loadStorageStats = async () => {
    const stats = await dataBackupService.getStorageStats();
    setStorageStats(stats);
  };

  const toggleOption = (id: string) => {
    setBackupOptions((prev) =>
      prev.map((opt) => (opt.id === id ? { ...opt, enabled: !opt.enabled } : opt))
    );
  };

  const selectPreset = (preset: 'all' | 'settings' | 'minimal' | 'none') => {
    setBackupOptions((prev) =>
      prev.map((opt) => {
        switch (preset) {
          case 'all':
            return { ...opt, enabled: true };
          case 'settings':
            return {
              ...opt,
              enabled: !['messages', 'logs', 'tabs'].includes(opt.id),
            };
          case 'minimal':
            return {
              ...opt,
              enabled: ['networks', 'settings', 'encryption'].includes(opt.id),
            };
          case 'none':
            return { ...opt, enabled: false };
          default:
            return opt;
        }
      })
    );
  };

  const generateBackup = async () => {
    try {
      const allKeys = await dataBackupService.getAllKeys();
      const enabledOptions = backupOptions.filter((opt) => opt.enabled);

      if (enabledOptions.length === 0) {
        Alert.alert(
          t('No Options Selected', { _tags: tags }),
          t('Please select at least one backup option', { _tags: tags })
        );
        return;
      }

      // Filter keys based on enabled options
      const selectedKeys = allKeys.filter((key) =>
        enabledOptions.some((opt) => {
          if (typeof opt.keyPattern === 'function') {
            return opt.keyPattern(key);
          } else if (opt.keyPattern instanceof RegExp) {
            return opt.keyPattern.test(key);
          } else {
            return key.includes(opt.keyPattern);
          }
        })
      );

      const data = await dataBackupService.exportKeys(selectedKeys);
      setBackupData(data);
      setShowPreviewModal(true);

      const enabledNames = enabledOptions.map((opt) => opt.name).join(', ');
      Alert.alert(
        t('Backup Ready', { _tags: tags }),
        t('Generated backup with {count} items:\n{names}', {
          count: selectedKeys.length,
          names: enabledNames,
          _tags: tags,
        })
      );
    } catch (error) {
      Alert.alert(
        t('Error', { _tags: tags }),
        error instanceof Error ? error.message : t('Failed to generate backup', { _tags: tags })
      );
    }
  };

  const handleCopyToClipboard = () => {
    try {
      Clipboard.setString(backupData);
      Alert.alert(
        t('Success', { _tags: tags }),
        t('Backup data copied to clipboard', { _tags: tags })
      );
    } catch (error) {
      Alert.alert(
        t('Error', { _tags: tags }),
        error instanceof Error ? error.message : t('Failed to copy to clipboard', { _tags: tags })
      );
    }
  };

  const handleSaveToFile = async () => {
    try {
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
      const filename = `androidircx_backup_${timestamp}.json`;

      let savePath: string;
      if (Platform.OS === 'android') {
        const externalDir = RNFS.ExternalDirectoryPath;
        savePath = externalDir ? `${externalDir}/${filename}` : `${RNFS.DocumentDirectoryPath}/${filename}`;
      } else {
        savePath = `${RNFS.DocumentDirectoryPath}/${filename}`;
      }

      await RNFS.writeFile(savePath, backupData, 'utf8');
      Alert.alert(
        t('Success', { _tags: tags }),
        t('Backup saved to:\n{path}', { path: savePath, _tags: tags }),
        [{ text: t('OK', { _tags: tags }) }]
      );
    } catch (error) {
      Alert.alert(
        t('Error', { _tags: tags }),
        error instanceof Error ? error.message : t('Failed to save backup file', { _tags: tags })
      );
    }
  };

  const handleRestore = async () => {
    try {
      if (!backupData.trim()) {
        Alert.alert(
          t('Error', { _tags: tags }),
          t('Please paste backup data first', { _tags: tags })
        );
        return;
      }

      Alert.alert(
        t('Confirm Restore', { _tags: tags }),
        t('This will overwrite existing data. Are you sure?', { _tags: tags }),
        [
          { text: t('Cancel', { _tags: tags }), style: 'cancel' },
          {
            text: t('Restore', { _tags: tags }),
            style: 'destructive',
            onPress: async () => {
              try {
                await dataBackupService.importAll(backupData);
                Alert.alert(
                  t('Success', { _tags: tags }),
                  t('Backup restored. Restart app to ensure all data reloads.', { _tags: tags })
                );
                setShowPreviewModal(false);
                loadStorageStats();
              } catch (error) {
                Alert.alert(
                  t('Error', { _tags: tags }),
                  error instanceof Error ? error.message : t('Invalid backup data', { _tags: tags })
                );
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        t('Error', { _tags: tags }),
        error instanceof Error ? error.message : t('Failed to restore backup', { _tags: tags })
      );
    }
  };

  if (!visible) return null;

  const enabledCount = backupOptions.filter((opt) => opt.enabled).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('Backup & Restore', { _tags: tags })}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Storage Stats */}
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>{t('Storage Statistics', { _tags: tags })}</Text>
            <Text style={styles.statsText}>
              {t('{count} items ~{size} KB', {
                count: storageStats.keyCount,
                size: (storageStats.totalBytes / 1024).toFixed(1),
                _tags: tags,
              })}
            </Text>
          </View>

          {/* Quick Presets */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('Quick Presets', { _tags: tags })}</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity style={styles.presetButton} onPress={() => selectPreset('all')}>
                <Text style={styles.presetButtonText}>{t('All Data', { _tags: tags })}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetButton} onPress={() => selectPreset('settings')}>
                <Text style={styles.presetButtonText}>{t('Settings Only', { _tags: tags })}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetButton} onPress={() => selectPreset('minimal')}>
                <Text style={styles.presetButtonText}>{t('Minimal', { _tags: tags })}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetButton} onPress={() => selectPreset('none')}>
                <Text style={styles.presetButtonText}>{t('Clear All', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Backup Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('Select Data to Backup ({count} selected)', { count: enabledCount, _tags: tags })}
            </Text>
            {backupOptions.map((option) => (
              <View key={option.id} style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionName}>{option.name}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <Switch value={option.enabled} onValueChange={() => toggleOption(option.id)} />
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.primaryButton} onPress={generateBackup}>
              <Text style={styles.primaryButtonText}>{t('Generate Backup', { _tags: tags })}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setBackupData('');
                setShowPreviewModal(true);
              }}>
              <Text style={styles.secondaryButtonText}>{t('Restore from Backup', { _tags: tags })}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Preview/Restore Modal */}
        <Modal
          visible={showPreviewModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPreviewModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {backupData
                    ? t('Backup Data', { _tags: tags })
                    : t('Restore from Backup', { _tags: tags })}
                </Text>
                <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
                  <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent}>
                <Text style={styles.modalDescription}>
                  {backupData
                    ? t('Copy this JSON to save your backup, or save it to a file.', { _tags: tags })
                    : t('Paste your backup JSON here to restore your data.', { _tags: tags })}
                </Text>
                <TextInput
                  style={styles.backupInput}
                  multiline
                  value={backupData}
                  onChangeText={setBackupData}
                  placeholder={t('Backup JSON appears here...', { _tags: tags })}
                  placeholderTextColor={colors.textSecondary}
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
                  <Text style={styles.footerButtonText}>{t('Cancel', { _tags: tags })}</Text>
                </TouchableOpacity>
                {backupData && (
                  <>
                    <TouchableOpacity onPress={handleCopyToClipboard}>
                      <Text style={[styles.footerButtonText, styles.primaryText]}>
                        {t('Copy to Clipboard', { _tags: tags })}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSaveToFile}>
                      <Text style={[styles.footerButtonText, styles.primaryText]}>
                        {t('Save to File', { _tags: tags })}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity onPress={handleRestore}>
                  <Text style={styles.footerButtonText}>{t('Restore', { _tags: tags })}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '500',
    },
    content: {
      flex: 1,
    },
    statsCard: {
      margin: 16,
      padding: 16,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    statsText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    section: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    presetRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    presetButton: {
      flex: 1,
      minWidth: 70,
      padding: 10,
      backgroundColor: colors.surface,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    presetButtonText: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '500',
    },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionInfo: {
      flex: 1,
      marginRight: 12,
    },
    optionName: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    optionDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 12,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      width: '100%',
      maxHeight: '80%',
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    modalContent: {
      flex: 1,
      padding: 16,
    },
    modalDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    backupInput: {
      minHeight: 200,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 12,
      fontFamily: 'monospace',
      color: colors.text,
      backgroundColor: colors.background,
      textAlignVertical: 'top',
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 16,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexWrap: 'wrap',
    },
    footerButtonText: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    primaryText: {
      color: colors.primary,
    },
  });
