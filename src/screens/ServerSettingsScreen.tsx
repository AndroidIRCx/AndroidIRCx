/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { IRCServerConfig, settingsService } from '../services/SettingsService';
import { useT } from '../i18n/transifex';
import { useTheme } from '../hooks/useTheme';

interface ServerSettingsScreenProps {
  networkId: string;
  serverId?: string;
  onSave: (server: IRCServerConfig) => void | Promise<void>;
  onCancel: () => void;
}

export const ServerSettingsScreen: React.FC<ServerSettingsScreenProps> = ({
  networkId,
  serverId,
  onSave,
  onCancel,
}) => {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const themeColors = colors as typeof colors & {
    textMuted?: string;
    surfaceVariant?: string;
  };
  const mutedTextColor =
    themeColors.textMuted || colors.textSecondary || colors.text;
  const inactiveSwitchThumb =
    themeColors.surfaceVariant ||
    colors.border ||
    colors.surface ||
    colors.background;
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState('6697');
  const [ssl, setSsl] = useState(true);
  const [rejectUnauthorized, setRejectUnauthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [isDefaultServer, setIsDefaultServer] = useState(false);
  const [wasDefaultServer, setWasDefaultServer] = useState(false);
  const [saving, setSaving] = useState(false);
  const translate = useCallback((key: string) => tRef.current(key), []);

  const loadServer = useCallback(async () => {
    if (!serverId || !networkId) return;
    setLoading(true);
    setError(null);
    try {
      const network = await settingsService.getNetwork(networkId);
      const server = network?.servers.find(s => s.id === serverId);
      if (server) {
        setName(server.name || '');
        setHostname(server.hostname);
        setPort(server.port.toString());
        setSsl(server.ssl);
        setRejectUnauthorized(server.rejectUnauthorized !== false);
        setPassword(server.password || '');
        setFavorite(Boolean(server.favorite));
        const isDefault = network?.defaultServerId === serverId;
        setIsDefaultServer(isDefault);
        setWasDefaultServer(isDefault);
      } else {
        setError(translate('Server not found'));
      }
    } catch (err) {
      setError(translate('Failed to load server'));
      console.error('Error loading server:', err);
    } finally {
      setLoading(false);
    }
  }, [networkId, serverId, translate]);

  useEffect(() => {
    if (serverId && networkId) {
      loadServer();
    } else {
      // Default values for new server
      setPort('6697');
      setSsl(true);
      setRejectUnauthorized(false);
    }
  }, [serverId, networkId, loadServer]);

  const handleSave = async () => {
    if (saving) return;
    if (!hostname.trim()) {
      Alert.alert(translate('Error'), translate('Please enter a hostname'));
      return;
    }

    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Alert.alert(
        translate('Error'),
        translate('Please enter a valid port number (1-65535)'),
      );
      return;
    }

    const server: IRCServerConfig = {
      id: serverId || `server-${Date.now()}`,
      name: name.trim() || hostname.trim(),
      hostname: hostname.trim(),
      port: portNum,
      ssl: ssl,
      password: password.trim() || undefined,
      favorite,
      rejectUnauthorized: rejectUnauthorized !== false,
    };

    // Update default server if needed
    if (isDefaultServer) {
      await settingsService.setDefaultServerForNetwork(networkId, server.id);
    } else if (wasDefaultServer) {
      // User unchecked the default server toggle - clear it
      await settingsService.clearDefaultServerForNetwork(networkId, server.id);
    }

    try {
      setSaving(true);
      await Promise.resolve(onSave(server));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={true} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onCancel}
            style={styles.cancelButton}
            disabled={saving}
          >
            <Text style={styles.cancelText}>{t('Cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('Server Settings')}</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.saveButton}
            disabled={saving}
          >
            {saving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator
                  size="small"
                  color={
                    colors.buttonPrimaryText || colors.onAccent || colors.text
                  }
                />
                <Text style={[styles.saveText, { marginLeft: 6 }]}>
                  {t('Saving...')}
                </Text>
              </View>
            ) : (
              <Text style={styles.saveText}>{t('Save')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={colors.buttonPrimary || colors.primary}
            />
            <Text style={styles.loadingText}>{t('Loading...')}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadServer} style={styles.retryButton}>
              <Text style={styles.retryText}>{t('Retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Connection')}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Display Name (Optional)')}</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('Server display name')}
                  placeholderTextColor={mutedTextColor}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Hostname *')}</Text>
                <TextInput
                  style={styles.input}
                  value={hostname}
                  onChangeText={setHostname}
                  placeholder={t('irc.example.com')}
                  placeholderTextColor={mutedTextColor}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Port *')}</Text>
                <TextInput
                  style={styles.input}
                  value={port}
                  onChangeText={setPort}
                  placeholder={t('6697')}
                  placeholderTextColor={mutedTextColor}
                  keyboardType="numeric"
                />
                <Text style={styles.hint}>
                  {t('Standard ports: 6667 (plain), 6697 (SSL/TLS)')}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Security')}</Text>

              <View style={styles.switchGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{t('Use SSL/TLS')}</Text>
                  <Switch
                    value={ssl}
                    onValueChange={setSsl}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={ssl ? colors.success : inactiveSwitchThumb}
                  />
                </View>
                <Text style={styles.hint}>
                  {t(
                    'Enable for secure connections (recommended for port 6697)',
                  )}
                </Text>
              </View>

              {ssl && (
                <View style={styles.switchGroup}>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>
                      {t('Reject Unauthorized Certificates')}
                    </Text>
                    <Switch
                      value={rejectUnauthorized}
                      onValueChange={setRejectUnauthorized}
                      trackColor={{
                        false: colors.border,
                        true: colors.success,
                      }}
                      thumbColor={
                        rejectUnauthorized
                          ? colors.success
                          : inactiveSwitchThumb
                      }
                    />
                  </View>
                  <Text style={styles.hint}>
                    {t(
                      'Leave on (recommended). Turn off only for self-signed/expired certs.',
                    )}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Authentication')}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {t('Server Password (Optional)')}
                </Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('Server connection password')}
                  placeholderTextColor={mutedTextColor}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Text style={styles.hint}>
                  {t('Some servers require a password to connect')}
                </Text>
              </View>

              <View style={styles.switchGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{t('Favorite Server')}</Text>
                  <Switch
                    value={favorite}
                    onValueChange={setFavorite}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={favorite ? colors.success : inactiveSwitchThumb}
                  />
                </View>
                <Text style={styles.hint}>
                  {t(
                    'Mark this server as the preferred choice for this network.',
                  )}
                </Text>
              </View>

              <View style={styles.switchGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{t('Default Server')}</Text>
                  <Switch
                    value={isDefaultServer}
                    onValueChange={setIsDefaultServer}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={
                      isDefaultServer ? colors.success : inactiveSwitchThumb
                    }
                  />
                </View>
                <Text style={styles.hint}>
                  {t(
                    'Set as default server for "Tap to connect" header. This server will be used when tapping the network name in the header.',
                  )}
                </Text>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.buttonPrimary || colors.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cancelButton: {
      padding: 8,
    },
    cancelText: {
      color: colors.buttonPrimaryText || colors.onAccent || colors.text,
      fontSize: 16,
    },
    title: {
      color: colors.buttonPrimaryText || colors.onAccent || colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    saveButton: {
      padding: 8,
    },
    saveText: {
      color: colors.buttonPrimaryText || colors.onAccent || colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    hint: {
      fontSize: 12,
      color:
        (colors as typeof colors & { textMuted?: string }).textMuted ||
        colors.textSecondary ||
        colors.text,
      marginTop: 4,
    },
    switchGroup: {
      marginBottom: 16,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    switchLabel: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.background,
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
      marginBottom: 16,
      textAlign: 'center',
    },
    retryButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: colors.buttonPrimary || colors.primary,
      borderRadius: 4,
    },
    retryText: {
      color: colors.buttonPrimaryText || colors.onAccent || colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
  });
