/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  BackHandler,
  Platform,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { dataBackupService } from '../services/DataBackupService';
import Clipboard from '@react-native-clipboard/clipboard';
import RNFS from 'react-native-fs';
import {
  pick,
  isErrorWithCode,
  errorCodes,
  types,
} from '@react-native-documents/picker';
import { useT } from '../i18n/transifex';
import { connectionManager } from '../services/ConnectionManager';
import { messageHistoryBatching } from '../services/MessageHistoryBatching';

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

const isNetworkKey = (key: string) =>
  key.includes('@AndroidIRCX:networks') || key.includes('NETWORKS');
const isSettingsKey = (key: string, isExplicitMatch: boolean) =>
  key.includes('@AndroidIRCX:settings:') ||
  key === 'SETTINGS' ||
  key === 'FIRST_RUN_COMPLETED' ||
  isExplicitMatch;
const isEncryptionKey = (key: string) =>
  key.startsWith('chanenc:') ||
  key.startsWith('encdm:') ||
  key.startsWith('encstg:');
const isProfileKey = (key: string) =>
  key.includes('identityProfiles') || key.includes('connectionProfiles');
const isFavoritesKey = (key: string) => key.includes('channelFavorites');
const isNotesKey = (key: string) =>
  key.includes('channelNotes') ||
  key.includes('channelBookmarks') ||
  key.includes('userAlias');
const isHighlightsKey = (key: string) =>
  key.includes('HIGHLIGHT') || key.includes('notification');
const isTabsKey = (key: string) => key.startsWith('TABS_');
const isMessagesKey = (key: string) =>
  key.startsWith('MESSAGES_') || key.startsWith('@AndroidIRCX:history:');
const isLogsKey = (key: string) => {
  const lowerKey = key.toLowerCase();
  return (
    key === 'channelLogs' ||
    key.startsWith('channelLogs:') ||
    (lowerKey.includes('log') && !lowerKey.includes('login'))
  );
};

// Security warning text for sensitive data
const SENSITIVE_DATA_WARNING =
  'This backup may contain sensitive data such as server passwords, authentication tokens, and encryption keys. This data will be stored in plain text unless you choose to encrypt the backup.';

// Rendering massive JSON inside TextInput can crash low-memory devices.
const MAX_INLINE_BACKUP_PREVIEW_CHARS = 250000;

interface GeneratedBackupMeta {
  sizeBytes: number;
  keyCount?: number;
  encrypted: boolean;
}

export const BackupScreen: React.FC<BackupScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const tags = 'screen:backup,file:BackupScreen.tsx,feature:backup';

  const [backupOptions, setBackupOptions] = useState<BackupOption[]>([
    {
      id: 'networks',
      name: t('Networks & Servers', { _tags: tags }),
      description: t('IRC network configurations and server settings', {
        _tags: tags,
      }),
      enabled: true,
      keyPattern: key =>
        key.includes('@AndroidIRCX:networks') || key.includes('NETWORKS'),
    },
    {
      id: 'settings',
      name: t('App Settings', { _tags: tags }),
      description: t('General app preferences and configurations', {
        _tags: tags,
      }),
      enabled: true,
      keyPattern: key => {
        const explicitMatch = ![
          isNetworkKey,
          isEncryptionKey,
          isProfileKey,
          isFavoritesKey,
          isNotesKey,
          isHighlightsKey,
          isTabsKey,
          isMessagesKey,
          isLogsKey,
        ].some(match => match(key));
        return isSettingsKey(key, explicitMatch);
      },
    },
    {
      id: 'encryption',
      name: t('Encryption Keys', { _tags: tags }),
      description: t('Channel encryption keys and DM bundles', { _tags: tags }),
      enabled: true,
      keyPattern: isEncryptionKey,
    },
    {
      id: 'profiles',
      name: t('Identity & Connection Profiles', { _tags: tags }),
      description: t('User identity profiles and connection templates', {
        _tags: tags,
      }),
      enabled: true,
      keyPattern: isProfileKey,
    },
    {
      id: 'favorites',
      name: t('Channel Favorites', { _tags: tags }),
      description: t('Favorite channels and auto-join settings', {
        _tags: tags,
      }),
      enabled: true,
      keyPattern: isFavoritesKey,
    },
    {
      id: 'notes',
      name: t('Channel Notes & Bookmarks', { _tags: tags }),
      description: t('Channel notes, bookmarks, and user aliases', {
        _tags: tags,
      }),
      enabled: true,
      keyPattern: isNotesKey,
    },
    {
      id: 'highlights',
      name: t('Highlights & Notifications', { _tags: tags }),
      description: t('Highlight words and notification preferences', {
        _tags: tags,
      }),
      enabled: true,
      keyPattern: isHighlightsKey,
    },
    {
      id: 'tabs',
      name: t('Open Tabs', { _tags: tags }),
      description: t('Currently open channel and query tabs', { _tags: tags }),
      enabled: false,
      keyPattern: isTabsKey,
    },
    {
      id: 'messages',
      name: t('Message History', { _tags: tags }),
      description: t('Saved message history for all tabs', { _tags: tags }),
      enabled: false,
      keyPattern: isMessagesKey,
    },
    {
      id: 'logs',
      name: t('Activity Logs', { _tags: tags }),
      description: t('Channel activity logs and join/part history', {
        _tags: tags,
      }),
      enabled: false,
      keyPattern: isLogsKey,
    },
  ]);

  const [backupData, setBackupData] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [storageStats, setStorageStats] = useState({
    keyCount: 0,
    totalBytes: 0,
  });
  const [showEncryptionPrompt, setShowEncryptionPrompt] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [pendingBackupData, setPendingBackupData] = useState('');
  const [pendingSelectedKeys, setPendingSelectedKeys] = useState<string[]>([]);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [showDecryptPrompt, setShowDecryptPrompt] = useState(false);
  const [backupOperation, setBackupOperation] = useState<
    'idle' | 'generate' | 'save' | 'load' | 'restore' | 'decrypt'
  >('idle');
  const [loadedBackupMeta, setLoadedBackupMeta] = useState<{
    fileName: string;
    sizeBytes: number;
    keyCount?: number;
  } | null>(null);
  const loadedBackupPayloadRef = useRef('');
  const [generatedBackupMeta, setGeneratedBackupMeta] =
    useState<GeneratedBackupMeta | null>(null);
  const generatedBackupPayloadRef = useRef('');
  const [showRestartModal, setShowRestartModal] = useState(false);

  const backupBusy = backupOperation !== 'idle';
  const backupOperationLabel =
    backupOperation === 'generate'
      ? t('Generating backup...', { _tags: tags })
      : backupOperation === 'save'
        ? t('Saving backup file...', { _tags: tags })
        : backupOperation === 'load'
          ? t('Loading backup file...', { _tags: tags })
          : backupOperation === 'restore'
            ? t('Restoring backup...', { _tags: tags })
            : backupOperation === 'decrypt'
              ? t('Decrypting backup...', { _tags: tags })
              : '';
  const backupBusyRowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  };
  const backupBusyLabelStyle = { marginLeft: 8 };
  const encryptionPromptStyle = { marginTop: 12, fontWeight: '600' as const };
  const restoreNoticeStyle = { marginTop: 10 };

  useEffect(() => {
    if (visible) {
      loadStorageStats();
    }
  }, [visible]);

  const loadStorageStats = async () => {
    const stats = await dataBackupService.getStorageStats();
    setStorageStats(stats);
  };

  const clearGeneratedBackup = () => {
    setGeneratedBackupMeta(null);
    generatedBackupPayloadRef.current = '';
  };

  const ensureValidBackupPayload = (
    payload: unknown,
    fallbackMessage: string,
  ): string => {
    if (typeof payload !== 'string' || !payload.trim()) {
      throw new Error(fallbackMessage);
    }
    return payload;
  };

  const setGeneratedBackupOutput = (
    payload: string,
    options: { keyCount?: number; encrypted: boolean },
  ) => {
    const normalizedPayload = ensureValidBackupPayload(
      payload,
      t('Backup generation returned empty data', { _tags: tags }),
    );

    setLoadedBackupMeta(null);
    loadedBackupPayloadRef.current = '';

    if (normalizedPayload.length > MAX_INLINE_BACKUP_PREVIEW_CHARS) {
      generatedBackupPayloadRef.current = normalizedPayload;
      setGeneratedBackupMeta({
        sizeBytes: normalizedPayload.length,
        keyCount: options.keyCount,
        encrypted: options.encrypted,
      });
      setBackupData('');
      return;
    }

    clearGeneratedBackup();
    setBackupData(normalizedPayload);
  };

  const getRestorePayload = (): string => {
    if (loadedBackupMeta) {
      return loadedBackupPayloadRef.current;
    }
    if (generatedBackupMeta) {
      return generatedBackupPayloadRef.current;
    }
    return backupData;
  };

  const getExportPayload = (): string =>
    generatedBackupMeta ? generatedBackupPayloadRef.current : backupData;

  const toggleOption = (id: string) => {
    setBackupOptions(prev =>
      prev.map(opt =>
        opt.id === id ? { ...opt, enabled: !opt.enabled } : opt,
      ),
    );
  };

  const selectPreset = (preset: 'all' | 'settings' | 'minimal' | 'none') => {
    setBackupOptions(prev =>
      prev.map(opt => {
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
      }),
    );
  };

  const generateBackup = async () => {
    if (backupBusy) return;
    setBackupOperation('generate');
    try {
      const allKeys = await dataBackupService.getAllKeys();
      const enabledOptions = backupOptions.filter(opt => opt.enabled);

      if (enabledOptions.length === 0) {
        Alert.alert(
          t('No Options Selected', { _tags: tags }),
          t('Please select at least one backup option', { _tags: tags }),
        );
        return;
      }

      const includeAll = enabledOptions.length === backupOptions.length;
      let data: string;
      let selectedKeys: string[] = [];
      if (includeAll) {
        data = ensureValidBackupPayload(
          await dataBackupService.exportAll(),
          t('Failed to generate backup', { _tags: tags }),
        );
        selectedKeys = allKeys;
      } else {
        // Filter keys based on enabled options
        selectedKeys = allKeys.filter(key =>
          enabledOptions.some(opt => {
            if (typeof opt.keyPattern === 'function') {
              return opt.keyPattern(key);
            } else if (opt.keyPattern instanceof RegExp) {
              return opt.keyPattern.test(key);
            } else {
              return key.includes(opt.keyPattern);
            }
          }),
        );
        data = ensureValidBackupPayload(
          await dataBackupService.exportKeys(selectedKeys),
          t('Failed to generate backup', { _tags: tags }),
        );
      }

      // Check if backup contains sensitive data
      const { hasSensitive } =
        dataBackupService.checkForSensitiveData(selectedKeys);

      if (hasSensitive) {
        // Store pending data and show encryption prompt
        setPendingBackupData(data);
        setPendingSelectedKeys(selectedKeys);
        setShowEncryptionPrompt(true);
      } else {
        // No sensitive data, proceed without encryption prompt
        setGeneratedBackupOutput(data, {
          keyCount: selectedKeys.length,
          encrypted: false,
        });
        setShowPreviewModal(true);

        const enabledNames = enabledOptions.map(opt => opt.name).join(', ');
        Alert.alert(
          t('Backup Ready', { _tags: tags }),
          t('Generated backup with {count} items:\n{names}', {
            count: selectedKeys.length,
            names: enabledNames,
            _tags: tags,
          }),
        );
      }
    } catch (error) {
      Alert.alert(
        t('Error', { _tags: tags }),
        getErrorMessage(error, t('Failed to generate backup', { _tags: tags })),
      );
    } finally {
      setBackupOperation('idle');
    }
  };

  const handleEncryptionChoice = async (encrypt: boolean) => {
    if (backupBusy) return;
    setBackupOperation('generate');
    setShowEncryptionPrompt(false);

    if (encrypt && encryptionPassword.trim().length > 0) {
      try {
        const encryptedData = ensureValidBackupPayload(
          await dataBackupService.encryptBackup(
            pendingBackupData,
            encryptionPassword,
          ),
          t('Failed to encrypt backup', { _tags: tags }),
        );
        setGeneratedBackupOutput(encryptedData, {
          keyCount: pendingSelectedKeys.length,
          encrypted: true,
        });
        Alert.alert(
          t('Backup Encrypted', { _tags: tags }),
          t(
            'Your backup has been encrypted. Keep your password safe - you will need it to restore this backup.',
            { _tags: tags },
          ),
        );
      } catch (error) {
        Alert.alert(
          t('Encryption Failed', { _tags: tags }),
          getErrorMessage(
            error,
            t('Failed to encrypt backup', { _tags: tags }),
          ),
        );
        setBackupOperation('idle');
        return;
      }
    } else {
      setGeneratedBackupOutput(pendingBackupData, {
        keyCount: pendingSelectedKeys.length,
        encrypted: false,
      });
    }

    setEncryptionPassword('');
    setPendingBackupData('');
    setShowPreviewModal(true);

    Alert.alert(
      t('Backup Ready', { _tags: tags }),
      t('Generated backup with {count} items.', {
        count: pendingSelectedKeys.length,
        _tags: tags,
      }),
    );
    setPendingSelectedKeys([]);
    setBackupOperation('idle');
  };

  const handleCopyToClipboard = () => {
    try {
      const payload = ensureValidBackupPayload(
        getExportPayload(),
        t('No backup data available to copy', { _tags: tags }),
      );
      Clipboard.setString(payload);
      Alert.alert(
        t('Success', { _tags: tags }),
        t('Backup data copied to clipboard', { _tags: tags }),
      );
    } catch (error) {
      Alert.alert(
        t('Error', { _tags: tags }),
        error instanceof Error
          ? error.message
          : t('Failed to copy to clipboard', { _tags: tags }),
      );
    }
  };

  const handleSaveToFile = async () => {
    if (backupBusy) return;
    let payloadToSave = '';
    try {
      payloadToSave = ensureValidBackupPayload(
        getExportPayload(),
        t('No backup data available to save', { _tags: tags }),
      );
    } catch (error) {
      Alert.alert(
        t('Error', { _tags: tags }),
        getErrorMessage(
          error,
          t('No backup data available to save', { _tags: tags }),
        ),
      );
      return;
    }
    setBackupOperation('save');
    try {
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
      const filename = `androidircx_backup_${timestamp}.json`;

      let savePath: string;
      if (Platform.OS === 'android') {
        const externalDir = RNFS.ExternalDirectoryPath;
        savePath = externalDir
          ? `${externalDir}/${filename}`
          : `${RNFS.DocumentDirectoryPath}/${filename}`;
      } else {
        savePath = `${RNFS.DocumentDirectoryPath}/${filename}`;
      }

      await RNFS.writeFile(savePath, payloadToSave, 'utf8');
      Alert.alert(
        t('Success', { _tags: tags }),
        t('Backup saved to:\n{path}', { path: savePath, _tags: tags }),
        [{ text: t('OK', { _tags: tags }) }],
      );
    } catch (error) {
      Alert.alert(
        t('Error', { _tags: tags }),
        error instanceof Error
          ? error.message
          : t('Failed to save backup file', { _tags: tags }),
      );
    } finally {
      setBackupOperation('idle');
    }
  };

  const normalizeFileUri = (uri: string) =>
    uri.startsWith('file://') ? uri.slice(7) : uri;
  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message?.trim()) {
      return error.message;
    }
    if (error && typeof error === 'object') {
      const maybeMessage = (
        error as { message?: unknown; description?: unknown }
      ).message;
      if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
        return maybeMessage;
      }
      const maybeDescription = (error as { description?: unknown }).description;
      if (typeof maybeDescription === 'string' && maybeDescription.trim()) {
        return maybeDescription;
      }
    }
    return fallback;
  };

  const cleanupPickedCopy = async (uri?: string | null) => {
    if (!uri || !uri.startsWith('file://')) {
      return;
    }
    try {
      await RNFS.unlink(normalizeFileUri(uri));
    } catch {
      // Ignore cleanup errors for picker copies.
    }
  };

  const handleLoadFromFile = async () => {
    if (backupBusy) return;
    setBackupOperation('load');
    let pickerCopyUri: string | undefined;
    try {
      const [result] = await pick({
        type: [types.plainText, 'application/json', 'text/json'],
        // @ts-ignore - copyTo exists in picker runtime versions we support
        copyTo: 'cachesDirectory',
      });

      pickerCopyUri = (result as any)?.fileCopyUri;
      let fileUri = pickerCopyUri ?? result?.uri;
      if (!fileUri) {
        Alert.alert(
          t('Error', { _tags: tags }),
          t('No file selected', { _tags: tags }),
        );
        return;
      }

      if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
        fileUri = pickerCopyUri ?? fileUri;
      }

      const content = await RNFS.readFile(normalizeFileUri(fileUri), 'utf8');
      if (!content.trim()) {
        Alert.alert(
          t('Error', { _tags: tags }),
          t('Selected file is empty', { _tags: tags }),
        );
        return;
      }

      try {
        JSON.parse(content);
      } catch {
        Alert.alert(
          t('Error', { _tags: tags }),
          t('Selected file is not a valid JSON backup', { _tags: tags }),
        );
        return;
      }

      let keyCount: number | undefined;
      try {
        const parsed = JSON.parse(content);
        keyCount =
          parsed?.data && typeof parsed.data === 'object'
            ? Object.keys(parsed.data).length
            : undefined;
      } catch {
        // already validated above
      }

      clearGeneratedBackup();
      setBackupData('');
      loadedBackupPayloadRef.current = content;
      setLoadedBackupMeta({
        fileName: result?.name || t('selected backup file', { _tags: tags }),
        sizeBytes: content.length,
        keyCount,
      });
      Alert.alert(
        t('Backup Loaded', { _tags: tags }),
        t(
          'Backup file loaded successfully. Please wait during restore and do not close the app.',
          { _tags: tags },
        ),
      );
    } catch (error: any) {
      if (
        isErrorWithCode(error) &&
        error.code === errorCodes.OPERATION_CANCELED
      ) {
        return;
      }

      Alert.alert(
        t('Error', { _tags: tags }),
        getErrorMessage(
          error,
          t('Failed to load backup file', { _tags: tags }),
        ),
      );
    } finally {
      await cleanupPickedCopy(pickerCopyUri);
      setBackupOperation('idle');
    }
  };

  const handleRestore = async () => {
    try {
      const payload = getRestorePayload();
      if (!payload.trim()) {
        Alert.alert(
          t('Error', { _tags: tags }),
          t('Please paste backup data or load a backup file first', {
            _tags: tags,
          }),
        );
        return;
      }

      // Check if backup is encrypted
      if (dataBackupService.isEncryptedBackup(payload)) {
        setShowDecryptPrompt(true);
        return;
      }

      performRestore(payload);
    } catch (error) {
      Alert.alert(
        t('Error', { _tags: tags }),
        getErrorMessage(error, t('Failed to restore backup', { _tags: tags })),
      );
    }
  };

  const handleDecryptAndRestore = async () => {
    if (backupBusy) return;
    if (!decryptPassword.trim()) {
      Alert.alert(
        t('Error', { _tags: tags }),
        t('Please enter the password', { _tags: tags }),
      );
      return;
    }

    setBackupOperation('decrypt');
    try {
      const decryptedData = ensureValidBackupPayload(
        await dataBackupService.decryptBackup(
          getRestorePayload(),
          decryptPassword,
        ),
        t('Failed to decrypt backup', { _tags: tags }),
      );
      setShowDecryptPrompt(false);
      setDecryptPassword('');
      performRestore(decryptedData);
    } catch (error) {
      Alert.alert(
        t('Decryption Failed', { _tags: tags }),
        getErrorMessage(
          error,
          t(
            'Wrong password or corrupted data. Please check your password and try again.',
            { _tags: tags },
          ),
        ),
      );
      setBackupOperation('idle');
    }
  };

  const performRestore = (dataToRestore: string) => {
    Alert.alert(
      t('Confirm Restore', { _tags: tags }),
      t('This will overwrite existing data. Are you sure?', { _tags: tags }),
      [
        {
          text: t('Cancel', { _tags: tags }),
          style: 'cancel',
          onPress: () => setBackupOperation('idle'),
        },
        {
          text: t('Restore', { _tags: tags }),
          style: 'destructive',
          onPress: async () => {
            try {
              setBackupOperation('restore');
              await dataBackupService.importAll(dataToRestore);
              setShowRestartModal(true);
              setShowPreviewModal(false);
              setLoadedBackupMeta(null);
              loadedBackupPayloadRef.current = '';
              loadStorageStats();
            } catch (error) {
              Alert.alert(
                t('Error', { _tags: tags }),
                getErrorMessage(
                  error,
                  t('Invalid backup data', { _tags: tags }),
                ),
              );
            } finally {
              setBackupOperation('idle');
            }
          },
        },
      ],
    );
  };

  const handleExitToRestart = async () => {
    try {
      await messageHistoryBatching.flushSync().catch(() => {});
      connectionManager.disconnectAll(
        t('Restarting after backup restore', { _tags: tags }),
      );
    } catch {
      // no-op
    }

    if (Platform.OS === 'android') {
      BackHandler.exitApp();
      return;
    }

    Alert.alert(
      t('Restart Required', { _tags: tags }),
      t('Please close and reopen the app manually to complete restore.', {
        _tags: tags,
      }),
    );
  };

  if (!visible) return null;

  const enabledCount = backupOptions.filter(opt => opt.enabled).length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {t('Backup & Restore', { _tags: tags })}
          </Text>
          <TouchableOpacity
            disabled={backupBusy}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>
              {t('Close', { _tags: tags })}
            </Text>
          </TouchableOpacity>
        </View>
        {backupBusy && (
          <View style={backupBusyRowStyle}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.statsText, backupBusyLabelStyle]}>
              {backupOperationLabel}
            </Text>
          </View>
        )}

        <ScrollView style={styles.content}>
          {/* Storage Stats */}
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>
              {t('Storage Statistics', { _tags: tags })}
            </Text>
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
            <Text style={styles.sectionTitle}>
              {t('Quick Presets', { _tags: tags })}
            </Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => selectPreset('all')}
              >
                <Text style={styles.presetButtonText}>
                  {t('All Data', { _tags: tags })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => selectPreset('settings')}
              >
                <Text style={styles.presetButtonText}>
                  {t('Settings Only', { _tags: tags })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => selectPreset('minimal')}
              >
                <Text style={styles.presetButtonText}>
                  {t('Minimal', { _tags: tags })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => selectPreset('none')}
              >
                <Text style={styles.presetButtonText}>
                  {t('Clear All', { _tags: tags })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Backup Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('Select Data to Backup ({count} selected)', {
                count: enabledCount,
                _tags: tags,
              })}
            </Text>
            {backupOptions.map(option => (
              <View key={option.id} style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionName}>{option.name}</Text>
                  <Text style={styles.optionDescription}>
                    {option.description}
                  </Text>
                </View>
                <Switch
                  disabled={backupBusy}
                  value={option.enabled}
                  onValueChange={() => toggleOption(option.id)}
                />
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.primaryButton}
              disabled={backupBusy}
              onPress={generateBackup}
            >
              <Text style={styles.primaryButtonText}>
                {t('Generate Backup', { _tags: tags })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              disabled={backupBusy}
              onPress={() => {
                setLoadedBackupMeta(null);
                loadedBackupPayloadRef.current = '';
                clearGeneratedBackup();
                setBackupData('');
                setShowPreviewModal(true);
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {t('Restore from Backup', { _tags: tags })}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Encryption Prompt Modal */}
        <Modal
          visible={showEncryptionPrompt}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEncryptionPrompt(false)}
        >
          <View style={styles.encryptionModalOverlay}>
            <View style={styles.encryptionModalContent}>
              <Text style={styles.encryptionModalTitle}>
                {t('Sensitive Data Detected', { _tags: tags })}
              </Text>
              <Text style={styles.encryptionModalText}>
                {t(SENSITIVE_DATA_WARNING, { _tags: tags })}
              </Text>
              <Text style={[styles.encryptionModalText, encryptionPromptStyle]}>
                {t('Do you want to encrypt this backup?', { _tags: tags })}
              </Text>
              <TextInput
                style={styles.encryptionInput}
                placeholder={t('Enter encryption password (optional)', {
                  _tags: tags,
                })}
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={encryptionPassword}
                onChangeText={setEncryptionPassword}
              />
              <View style={styles.encryptionButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.encryptionButton,
                    styles.encryptionButtonSecondary,
                  ]}
                  onPress={() => handleEncryptionChoice(false)}
                >
                  <Text style={styles.encryptionButtonTextSecondary}>
                    {t('Export Unencrypted', { _tags: tags })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.encryptionButton,
                    !encryptionPassword.trim() &&
                      styles.encryptionButtonDisabled,
                  ]}
                  onPress={() => handleEncryptionChoice(true)}
                  disabled={!encryptionPassword.trim()}
                >
                  <Text style={styles.encryptionButtonText}>
                    {t('Encrypt & Export', { _tags: tags })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Decrypt Prompt Modal */}
        <Modal
          visible={showDecryptPrompt}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowDecryptPrompt(false);
            setDecryptPassword('');
            setBackupOperation('idle');
          }}
        >
          <View style={styles.encryptionModalOverlay}>
            <View style={styles.encryptionModalContent}>
              <Text style={styles.encryptionModalTitle}>
                {t('Encrypted Backup', { _tags: tags })}
              </Text>
              <Text style={styles.encryptionModalText}>
                {t(
                  'This backup is encrypted. Please enter the password to decrypt and restore it.',
                  { _tags: tags },
                )}
              </Text>
              <TextInput
                style={styles.encryptionInput}
                placeholder={t('Enter decryption password', { _tags: tags })}
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={decryptPassword}
                onChangeText={setDecryptPassword}
              />
              <View style={styles.encryptionButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.encryptionButton,
                    styles.encryptionButtonSecondary,
                  ]}
                  onPress={() => {
                    setShowDecryptPrompt(false);
                    setDecryptPassword('');
                    setBackupOperation('idle');
                  }}
                >
                  <Text style={styles.encryptionButtonTextSecondary}>
                    {t('Cancel', { _tags: tags })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.encryptionButton,
                    !decryptPassword.trim() && styles.encryptionButtonDisabled,
                  ]}
                  onPress={handleDecryptAndRestore}
                  disabled={!decryptPassword.trim()}
                >
                  <Text style={styles.encryptionButtonText}>
                    {t('Decrypt & Restore', { _tags: tags })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Preview/Restore Modal */}
        <Modal
          visible={showPreviewModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowPreviewModal(false)}
        >
          <View style={styles.modalFullScreenContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {backupData || generatedBackupMeta
                  ? t('Backup Data', { _tags: tags })
                  : t('Restore from Backup', { _tags: tags })}
              </Text>
              <TouchableOpacity
                onPress={() => setShowPreviewModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>
                  {t('Close', { _tags: tags })}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={styles.modalContentContainer}
            >
              <Text style={styles.modalDescription}>
                {loadedBackupMeta
                  ? t(
                      'Loaded from file. JSON preview is hidden for large backups. You can restore now.',
                      { _tags: tags },
                    )
                  : generatedBackupMeta
                    ? t(
                        'Generated backup is large, so inline JSON preview is hidden to keep the app stable. You can still copy, save, or restore it.',
                        { _tags: tags },
                      )
                    : backupData
                      ? t(
                          'Copy this JSON to save your backup, or save it to a file.',
                          { _tags: tags },
                        )
                      : t('Paste your backup JSON here to restore your data.', {
                          _tags: tags,
                        })}
              </Text>
              {loadedBackupMeta ? (
                <View style={styles.loadedFileCard}>
                  <Text style={styles.loadedFileTitle}>
                    {t('Loaded Backup File', { _tags: tags })}
                  </Text>
                  <Text style={styles.loadedFileText}>
                    {t('File: {name}', {
                      name: loadedBackupMeta.fileName,
                      _tags: tags,
                    })}
                  </Text>
                  <Text style={styles.loadedFileText}>
                    {t('Size: {size} MB', {
                      size: (loadedBackupMeta.sizeBytes / 1024 / 1024).toFixed(
                        2,
                      ),
                      _tags: tags,
                    })}
                  </Text>
                  {loadedBackupMeta.keyCount !== undefined && (
                    <Text style={styles.loadedFileText}>
                      {t('Items: {count}', {
                        count: loadedBackupMeta.keyCount,
                        _tags: tags,
                      })}
                    </Text>
                  )}
                  <Text style={[styles.loadedFileText, restoreNoticeStyle]}>
                    {t('Please wait while restoring. Do not close the app.', {
                      _tags: tags,
                    })}
                  </Text>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setLoadedBackupMeta(null);
                      loadedBackupPayloadRef.current = '';
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {t('Switch to Manual JSON Paste', { _tags: tags })}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : generatedBackupMeta ? (
                <View style={styles.loadedFileCard}>
                  <Text style={styles.loadedFileTitle}>
                    {t('Generated Backup', { _tags: tags })}
                  </Text>
                  <Text style={styles.loadedFileText}>
                    {t('Size: {size} MB', {
                      size: (
                        generatedBackupMeta.sizeBytes /
                        1024 /
                        1024
                      ).toFixed(2),
                      _tags: tags,
                    })}
                  </Text>
                  {generatedBackupMeta.keyCount !== undefined && (
                    <Text style={styles.loadedFileText}>
                      {t('Items: {count}', {
                        count: generatedBackupMeta.keyCount,
                        _tags: tags,
                      })}
                    </Text>
                  )}
                  <Text style={styles.loadedFileText}>
                    {generatedBackupMeta.encrypted
                      ? t('Encrypted: Yes', { _tags: tags })
                      : t('Encrypted: No', { _tags: tags })}
                  </Text>
                  <Text style={[styles.loadedFileText, restoreNoticeStyle]}>
                    {t('Please wait while restoring. Do not close the app.', {
                      _tags: tags,
                    })}
                  </Text>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      clearGeneratedBackup();
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {t('Switch to Manual JSON Paste', { _tags: tags })}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TextInput
                  style={styles.backupInput}
                  multiline
                  value={backupData}
                  onChangeText={text => {
                    if (loadedBackupMeta) {
                      setLoadedBackupMeta(null);
                      loadedBackupPayloadRef.current = '';
                    }
                    if (generatedBackupMeta) {
                      clearGeneratedBackup();
                    }
                    setBackupData(text);
                  }}
                  placeholder={t('Backup JSON appears here...', {
                    _tags: tags,
                  })}
                  placeholderTextColor={colors.textSecondary}
                />
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.footerButton}
                onPress={() => setShowPreviewModal(false)}
              >
                <Text style={styles.footerButtonText}>
                  {t('Cancel', { _tags: tags })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerButton}
                onPress={handleLoadFromFile}
              >
                <Text style={[styles.footerButtonText, styles.primaryText]}>
                  {t('Load from File', { _tags: tags })}
                </Text>
              </TouchableOpacity>
              {!loadedBackupMeta && !!getExportPayload().trim() && (
                <>
                  <TouchableOpacity
                    style={styles.footerButton}
                    onPress={handleCopyToClipboard}
                  >
                    <Text style={[styles.footerButtonText, styles.primaryText]}>
                      {t('Copy to Clipboard', { _tags: tags })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.footerButton}
                    onPress={handleSaveToFile}
                  >
                    <Text style={[styles.footerButtonText, styles.primaryText]}>
                      {t('Save to File', { _tags: tags })}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                style={[styles.footerButton, styles.restoreButton]}
                onPress={handleRestore}
              >
                <Text
                  style={[styles.footerButtonText, styles.restoreButtonText]}
                >
                  {t('Restore', { _tags: tags })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showRestartModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRestartModal(false)}
        >
          <View style={styles.encryptionModalOverlay}>
            <View style={styles.encryptionModalContent}>
              <Text style={styles.encryptionModalTitle}>
                {t('Restore Complete', { _tags: tags })}
              </Text>
              <Text style={styles.encryptionModalText}>
                {t(
                  'Backup restored successfully. Please restart the app to reload all restored data.',
                  { _tags: tags },
                )}
              </Text>
              <View style={styles.encryptionButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.encryptionButton,
                    styles.encryptionButtonSecondary,
                  ]}
                  onPress={() => setShowRestartModal(false)}
                >
                  <Text style={styles.encryptionButtonTextSecondary}>
                    {t('OK', { _tags: tags })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.encryptionButton}
                  onPress={handleExitToRestart}
                >
                  <Text style={styles.encryptionButtonText}>
                    {t('Exit to Restart App', { _tags: tags })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {backupBusy && (
          <View style={styles.blockingLoaderOverlay}>
            <View style={styles.blockingLoaderCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.blockingLoaderTitle}>
                {backupOperationLabel}
              </Text>
              <Text style={styles.blockingLoaderText}>
                {t(
                  'Please wait... Do not close the app while this operation is in progress.',
                  { _tags: tags },
                )}
              </Text>
            </View>
          </View>
        )}
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
      color: colors.onPrimary,
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
    modalFullScreenContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      paddingTop: Platform.OS === 'android' ? 16 : 50,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    modalContent: {
      flex: 1,
    },
    modalContentContainer: {
      padding: 16,
      paddingBottom: 20,
    },
    modalDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 22,
    },
    backupInput: {
      flex: 1,
      minHeight: 400,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 16,
      fontSize: 13,
      fontFamily: 'monospace',
      color: colors.text,
      backgroundColor: colors.surface,
      textAlignVertical: 'top',
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      paddingBottom: Platform.OS === 'android' ? 16 : 30,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      flexWrap: 'wrap',
    },
    footerButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    footerButtonText: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    restoreButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    restoreButtonText: {
      color: colors.onPrimary,
      fontWeight: '600',
    },
    primaryText: {
      color: colors.primary,
    },
    encryptionModalOverlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    encryptionModalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
    },
    encryptionModalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    encryptionModalText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    encryptionInput: {
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
    },
    encryptionButtonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 20,
    },
    encryptionButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    encryptionButtonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    encryptionButtonDisabled: {
      opacity: 0.5,
    },
    encryptionButtonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    encryptionButtonTextSecondary: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    loadedFileCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 6,
    },
    loadedFileTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    loadedFileText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    blockingLoaderOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.modalOverlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    blockingLoaderCard: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      alignItems: 'center',
    },
    blockingLoaderTitle: {
      marginTop: 12,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    blockingLoaderText: {
      marginTop: 8,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
