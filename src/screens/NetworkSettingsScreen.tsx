/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  Switch,
} from 'react-native';
import {
  IRCNetworkConfig,
  IRCWebSocketSubprotocol,
  settingsService,
} from '../services/SettingsService';
import { useT } from '../i18n/transifex';
import { CertificateGeneratorModal } from '../components/modals/CertificateGeneratorModal';
import { CertificateSelectorModal } from '../components/modals/CertificateSelectorModal';
import { CertificateFingerprintModal } from '../components/modals/CertificateFingerprintModal';
import { certificateManager } from '../services/CertificateManagerService';
import type { CertificateInfo } from '../types/certificate';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

interface NetworkSettingsScreenProps {
  networkId?: string;
  onSave: (network: IRCNetworkConfig) => void | Promise<void>;
  onCancel: () => void;
  onShowIdentityProfiles?: () => void;
}

const isIRCWebSocketSubprotocol = (
  value: string,
): value is IRCWebSocketSubprotocol =>
  value === 'binary.ircv3.net' || value === 'text.ircv3.net';

const parseWebSocketSubprotocols = (
  value: string,
): IRCWebSocketSubprotocol[] | undefined => {
  const protocols = value
    .split(',')
    .map(protocol => protocol.trim())
    .filter(isIRCWebSocketSubprotocol)
    .slice(0, 2);
  return protocols.length > 0 ? protocols : undefined;
};

export const NetworkSettingsScreen: React.FC<NetworkSettingsScreenProps> = ({
  networkId,
  onSave,
  onCancel,
  onShowIdentityProfiles,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [nick, setNick] = useState('');
  const [altNick, setAltNick] = useState('');
  const [realname, setRealname] = useState('');
  const [ident, setIdent] = useState('');
  const [autoJoinChannels, setAutoJoinChannels] = useState('');
  const [saslAccount, setSaslAccount] = useState('');
  const [saslPassword, setSaslPassword] = useState('');
  const [saslMechanism, setSaslMechanism] = useState<
    'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-256-PLUS' | 'EXTERNAL'
  >('PLAIN');
  const [clientCert, setClientCert] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyType, setProxyType] = useState('tor');
  const [proxyHost, setProxyHost] = useState('127.0.0.1');
  const [proxyPort, setProxyPort] = useState('9050');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [webSocketEnabled, setWebSocketEnabled] = useState(false);
  const [webSocketUrl, setWebSocketUrl] = useState('');
  const [webSocketSubprotocols, setWebSocketSubprotocols] = useState(
    'binary.ircv3.net, text.ircv3.net',
  );
  const [webircEnabled, setWebircEnabled] = useState(false);
  const [webircPassword, setWebircPassword] = useState('');
  const [webircGateway, setWebircGateway] = useState('');
  const [webircHostname, setWebircHostname] = useState('');
  const [webircIp, setWebircIp] = useState('');
  const [webircOptions, setWebircOptions] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Certificate modal states
  const [showCertGenerator, setShowCertGenerator] = useState(false);
  const [showCertSelector, setShowCertSelector] = useState(false);
  const [showCertFingerprint, setShowCertFingerprint] = useState(false);
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  // Memoized certificate fingerprint - returns null for invalid PEM
  const certFingerprint = useMemo(() => {
    if (!clientCert.trim()) return null;
    return certificateManager.extractFingerprintFromPem(clientCert);
  }, [clientCert]);

  const loadNetwork = useCallback(async () => {
    if (!networkId) return;
    setLoading(true);
    setError(null);
    try {
      const network = await settingsService.getNetwork(networkId);
      if (network) {
        setName(network.name);
        setNick(network.nick);
        setAltNick(network.altNick || '');
        setRealname(network.realname);
        setIdent(network.ident || '');
        setAutoJoinChannels(network.autoJoinChannels?.join(', ') || '');
        setSaslAccount(network.sasl?.account || '');
        setSaslPassword(network.sasl?.password || '');
        setSaslMechanism(network.sasl?.mechanism || 'PLAIN');
        setClientCert(network.clientCert || '');
        setClientKey(network.clientKey || '');
        setProxyEnabled(
          network.proxy ? network.proxy.enabled !== false : false,
        );
        setProxyType(network.proxy?.type || 'tor');
        setProxyHost(
          network.proxy?.host ||
            (network.proxy?.type === 'tor' ? '127.0.0.1' : ''),
        );
        setProxyPort(
          network.proxy?.port
            ? String(network.proxy.port)
            : network.proxy?.type === 'tor'
              ? '9050'
              : '',
        );
        setProxyUsername(network.proxy?.username || '');
        setProxyPassword(network.proxy?.password || '');
        setWebSocketEnabled(network.transport === 'websocket');
        setWebSocketUrl(network.webSocketUrl || '');
        setWebSocketSubprotocols(
          network.webSocketSubprotocols?.join(', ') ||
            'binary.ircv3.net, text.ircv3.net',
        );
        setWebircEnabled(Boolean(network.webirc?.enabled));
        setWebircPassword(network.webirc?.password || '');
        setWebircGateway(network.webirc?.gateway || '');
        setWebircHostname(network.webirc?.hostname || '');
        setWebircIp(network.webirc?.ip || '');
        setWebircOptions(network.webirc?.options?.join(', ') || '');
      } else {
        setError(t('Network not found'));
      }
    } catch (err) {
      setError(t('Failed to load network'));
      console.error('Error loading network:', err);
    } finally {
      setLoading(false);
    }
  }, [networkId, t]);

  useEffect(() => {
    if (networkId) {
      loadNetwork();
    } else {
      // New network - set defaults
      setNick('AndroidIRCX');
      setAltNick('AndroidIRCX_');
      setRealname('AndroidIRCX User');
      setIdent('androidircx');
      setProxyEnabled(false);
      setProxyType('tor');
      setProxyHost('127.0.0.1');
      setProxyPort('9050');
      setProxyUsername('');
      setProxyPassword('');
      setWebSocketEnabled(false);
      setWebSocketUrl('');
      setWebSocketSubprotocols('binary.ircv3.net, text.ircv3.net');
      setWebircEnabled(false);
      setWebircPassword('');
      setWebircGateway('');
      setWebircHostname('');
      setWebircIp('');
      setWebircOptions('');
    }
  }, [networkId, loadNetwork]);

  // Certificate handlers
  const handleCertificateGenerated = (cert: CertificateInfo) => {
    setClientCert(cert.pemCert);
    setClientKey(cert.pemKey);
    setShowCertGenerator(false);
    Alert.alert(
      t('Success'),
      t(
        "Certificate generated and applied! Don't forget to add the fingerprint to NickServ.",
      ),
    );
  };

  const handleCertificateSelected = (cert: CertificateInfo) => {
    setClientCert(cert.pemCert);
    setClientKey(cert.pemKey);
    setShowCertSelector(false);
    Alert.alert(
      t('Success'),
      t('Certificate applied to network configuration'),
    );
  };

  const handleViewFingerprint = () => {
    if (!clientCert.trim()) {
      Alert.alert(t('Error'), t('No certificate configured'));
      return;
    }
    if (!certFingerprint) {
      Alert.alert(
        t('Error'),
        t(
          'Invalid certificate format. Please configure a valid PEM certificate.',
        ),
      );
      return;
    }
    setShowCertFingerprint(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim() || !nick.trim() || !realname.trim()) {
      Alert.alert(
        t('Error'),
        t('Please fill in all required fields (Name, Nick, Realname)'),
      );
      return;
    }
    if (
      webircEnabled &&
      (!webircPassword.trim() ||
        !webircGateway.trim() ||
        !webircHostname.trim() ||
        !webircIp.trim())
    ) {
      Alert.alert(
        t('Error'),
        t(
          'WEBIRC requires password, gateway, hostname, and IP before it can be enabled.',
        ),
      );
      return;
    }

    const existingNetwork = networkId
      ? await settingsService.getNetwork(networkId)
      : null;
    const computedProxyHost =
      proxyHost.trim() || (proxyType === 'tor' ? '127.0.0.1' : '');
    const computedProxyPort =
      proxyPort.trim() || (proxyType === 'tor' ? '9050' : '');
    const network: IRCNetworkConfig = {
      id: networkId || `network-${Date.now()}`,
      name: name.trim(),
      nick: nick.trim(),
      altNick: altNick.trim() || undefined,
      realname: realname.trim(),
      ident: ident.trim() || undefined,
      servers: existingNetwork?.servers || [],
      autoJoinChannels: autoJoinChannels
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0),
      proxy:
        proxyEnabled && computedProxyHost && computedProxyPort
          ? {
              enabled: true,
              type: (proxyType || 'tor') as any,
              host: computedProxyHost,
              port: parseInt(computedProxyPort, 10),
              username: proxyUsername.trim() || undefined,
              password: proxyPassword.trim() || undefined,
            }
          : undefined,
      sasl:
        saslAccount && saslPassword
          ? {
              account: saslAccount.trim(),
              password: saslPassword.trim(),
              mechanism: saslMechanism,
            }
          : undefined,
      clientCert: clientCert.trim() || undefined,
      clientKey: clientKey.trim() || undefined,
      transport: webSocketEnabled ? 'websocket' : 'tcp',
      webSocketUrl:
        webSocketEnabled && webSocketUrl.trim()
          ? webSocketUrl.trim()
          : undefined,
      webSocketSubprotocols: webSocketEnabled
        ? parseWebSocketSubprotocols(webSocketSubprotocols)
        : undefined,
      webirc: webircEnabled
        ? {
            enabled: true,
            password: webircPassword.trim(),
            gateway: webircGateway.trim(),
            hostname: webircHostname.trim(),
            ip: webircIp.trim(),
            options: webircOptions
              .split(',')
              .map(option => option.trim())
              .filter(Boolean),
          }
        : undefined,
      connectOnStartup: false,
    };

    try {
      setSaving(true);
      await Promise.resolve(onSave(network));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={true} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onCancel}
            style={styles.cancelButton}
            disabled={saving}
          >
            <Text style={styles.cancelText}>{t('Cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('Network Settings')}</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.saveButton}
            disabled={saving}
          >
            {saving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.onPrimary} />
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
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{t('Loading...')}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadNetwork} style={styles.retryButton}>
              <Text style={styles.retryText}>{t('Retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            {/* Identity Profiles Button */}
            {onShowIdentityProfiles && (
              <TouchableOpacity
                style={styles.identityProfilesButton}
                onPress={onShowIdentityProfiles}
              >
                <Text style={styles.identityProfilesButtonText}>
                  {t('Manage Identity Profiles')}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Basic Information')}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Network Name *')}</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('e.g., dbase.in.rs')}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Nickname *')}</Text>
                <TextInput
                  style={styles.input}
                  value={nick}
                  onChangeText={setNick}
                  placeholder={t('Your IRC nickname')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Alternative Nickname')}</Text>
                <TextInput
                  style={styles.input}
                  value={altNick}
                  onChangeText={setAltNick}
                  placeholder={t('Fallback if primary nick is taken')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Real Name *')}</Text>
                <TextInput
                  style={styles.input}
                  value={realname}
                  onChangeText={setRealname}
                  placeholder={t('Your real name or description')}
                  placeholderTextColor={colors.inputPlaceholder}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Ident / Username')}</Text>
                <TextInput
                  style={styles.input}
                  value={ident}
                  onChangeText={setIdent}
                  placeholder={t('Username for ident (optional)')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('Auto-Join Channels')}</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {t('Channels (comma-separated)')}
                </Text>
                <TextInput
                  style={styles.input}
                  value={autoJoinChannels}
                  onChangeText={setAutoJoinChannels}
                  placeholder={t('#channel1, #channel2')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('SASL Authentication (Optional)')}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('SASL Mechanism')}</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={saslMechanism}
                    onValueChange={value => setSaslMechanism(value)}
                    style={[styles.picker, { color: colors.text }]}
                  >
                    <Picker.Item
                      label={t('PLAIN - Simple username/password')}
                      value="PLAIN"
                    />
                    <Picker.Item
                      label={t('SCRAM-SHA-256 - Secure challenge-response')}
                      value="SCRAM-SHA-256"
                    />
                    <Picker.Item
                      label={t(
                        'SCRAM-SHA-256-PLUS - Channel binding (coming soon)',
                      )}
                      value="SCRAM-SHA-256-PLUS"
                    />
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('SASL Account')}</Text>
                <TextInput
                  style={styles.input}
                  value={saslAccount}
                  onChangeText={setSaslAccount}
                  placeholder={t('SASL account name')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('SASL Password')}</Text>
                <TextInput
                  style={styles.input}
                  value={saslPassword}
                  onChangeText={setSaslPassword}
                  placeholder={t('SASL password')}
                  placeholderTextColor={colors.inputPlaceholder}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              {saslMechanism === 'SCRAM-SHA-256' && (
                <Text style={styles.helpText}>
                  {t(
                    'SCRAM-SHA-256 provides better security by using challenge-response authentication. Your password is never sent over the network.',
                  )}
                </Text>
              )}
              {saslMechanism === 'SCRAM-SHA-256-PLUS' && (
                <Text style={styles.helpText}>
                  {t(
                    'SCRAM-SHA-256-PLUS with channel binding will be available in a future update. For now, SCRAM-SHA-256 is recommended.',
                  )}
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('Proxy (Optional, per network)')}
              </Text>
              <View style={styles.switchRow}>
                <Text style={styles.label}>
                  {t('Enable proxy (Tor/SOCKS5/HTTP)')}
                </Text>
                <Switch
                  value={proxyEnabled}
                  onValueChange={setProxyEnabled}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={
                    proxyEnabled ? colors.onAccent : colors.surfaceVariant
                  }
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {t('Type (socks5, http, tor)')}
                </Text>
                <TextInput
                  style={[styles.input, !proxyEnabled && styles.inputDisabled]}
                  value={proxyType}
                  editable={proxyEnabled}
                  onChangeText={setProxyType}
                  placeholder={t('tor')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Host')}</Text>
                <TextInput
                  style={[styles.input, !proxyEnabled && styles.inputDisabled]}
                  value={proxyHost}
                  editable={proxyEnabled}
                  onChangeText={setProxyHost}
                  placeholder={t('127.0.0.1 (Tor default)')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Port')}</Text>
                <TextInput
                  style={[styles.input, !proxyEnabled && styles.inputDisabled]}
                  value={proxyPort}
                  editable={proxyEnabled}
                  onChangeText={setProxyPort}
                  placeholder={t('9050 for Tor, 1080 for SOCKS5')}
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Username')}</Text>
                <TextInput
                  style={[styles.input, !proxyEnabled && styles.inputDisabled]}
                  value={proxyUsername}
                  editable={proxyEnabled}
                  onChangeText={setProxyUsername}
                  placeholder={t('optional')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('Password')}</Text>
                <TextInput
                  style={[styles.input, !proxyEnabled && styles.inputDisabled]}
                  value={proxyPassword}
                  editable={proxyEnabled}
                  onChangeText={setProxyPassword}
                  placeholder={t('optional')}
                  placeholderTextColor={colors.inputPlaceholder}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('IRCv3 Transport and Gateway')}
              </Text>
              <View style={styles.switchRow}>
                <Text style={styles.label}>{t('Use IRCv3 WebSocket')}</Text>
                <Switch
                  value={webSocketEnabled}
                  onValueChange={setWebSocketEnabled}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={
                    webSocketEnabled ? colors.onAccent : colors.surfaceVariant
                  }
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('WebSocket URL')}</Text>
                <TextInput
                  style={[
                    styles.input,
                    !webSocketEnabled && styles.inputDisabled,
                  ]}
                  value={webSocketUrl}
                  editable={webSocketEnabled}
                  onChangeText={setWebSocketUrl}
                  placeholder={t('wss://irc.example.net:6697/')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('WebSocket Subprotocols')}</Text>
                <TextInput
                  style={[
                    styles.input,
                    !webSocketEnabled && styles.inputDisabled,
                  ]}
                  value={webSocketSubprotocols}
                  editable={webSocketEnabled}
                  onChangeText={setWebSocketSubprotocols}
                  placeholder={t('binary.ircv3.net, text.ircv3.net')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>
              <Text style={styles.helpText}>
                {t(
                  'Leave URL blank to use ws/wss with the network host and port.',
                )}
              </Text>

              <View style={styles.switchRow}>
                <Text style={styles.label}>{t('Enable WEBIRC')}</Text>
                <Switch
                  value={webircEnabled}
                  onValueChange={setWebircEnabled}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={
                    webircEnabled ? colors.onAccent : colors.surfaceVariant
                  }
                />
              </View>
              <Text style={styles.helpText}>
                {t(
                  'WEBIRC is only for trusted gateway/browser-style deployments where the IRC server has configured this password.',
                )}
              </Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('WEBIRC Password')}</Text>
                <TextInput
                  style={[styles.input, !webircEnabled && styles.inputDisabled]}
                  value={webircPassword}
                  editable={webircEnabled}
                  onChangeText={setWebircPassword}
                  placeholder={t('shared WEBIRC password')}
                  placeholderTextColor={colors.inputPlaceholder}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('WEBIRC Gateway')}</Text>
                <TextInput
                  style={[styles.input, !webircEnabled && styles.inputDisabled]}
                  value={webircGateway}
                  editable={webircEnabled}
                  onChangeText={setWebircGateway}
                  placeholder={t('AndroidIRCX')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('WEBIRC Hostname')}</Text>
                <TextInput
                  style={[styles.input, !webircEnabled && styles.inputDisabled]}
                  value={webircHostname}
                  editable={webircEnabled}
                  onChangeText={setWebircHostname}
                  placeholder={t('client.example.net')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('WEBIRC IP')}</Text>
                <TextInput
                  style={[styles.input, !webircEnabled && styles.inputDisabled]}
                  value={webircIp}
                  editable={webircEnabled}
                  onChangeText={setWebircIp}
                  placeholder={t('203.0.113.10')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('WEBIRC Options')}</Text>
                <TextInput
                  style={[styles.input, !webircEnabled && styles.inputDisabled]}
                  value={webircOptions}
                  editable={webircEnabled}
                  onChangeText={setWebircOptions}
                  placeholder={t('secure, tls')}
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('SASL EXTERNAL (Client Certificate)')}
              </Text>

              {/* Certificate Management Buttons */}
              <View style={styles.certButtonsRow}>
                <TouchableOpacity
                  style={styles.certButton}
                  onPress={() => setShowCertGenerator(true)}
                >
                  <Text style={styles.certButtonText}>
                    ➕ {t('Generate New')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.certButton}
                  onPress={() => setShowCertSelector(true)}
                >
                  <Text style={styles.certButtonText}>
                    📁 {t('Select Existing')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* View Fingerprint Button (only if cert is set) */}
              {clientCert.trim() && (
                <TouchableOpacity
                  style={[styles.certButton, styles.fingerprintButton]}
                  onPress={handleViewFingerprint}
                >
                  <Text style={styles.certButtonText}>
                    🔑 {t('View Fingerprint')}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('or enter manually')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {t('Client Certificate (PEM)')}
                </Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={clientCert}
                  onChangeText={setClientCert}
                  placeholder={t('-----BEGIN CERTIFICATE-----...')}
                  placeholderTextColor={colors.inputPlaceholder}
                  multiline
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {t('Client Private Key (PEM)')}
                </Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={clientKey}
                  onChangeText={setClientKey}
                  placeholder={t('-----BEGIN PRIVATE KEY-----...')}
                  placeholderTextColor={colors.inputPlaceholder}
                  multiline
                  autoCapitalize="none"
                />
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Certificate Modals */}
      <CertificateGeneratorModal
        visible={showCertGenerator}
        onClose={() => setShowCertGenerator(false)}
        onCertificateGenerated={handleCertificateGenerated}
        defaultCommonName={`${nick}@${name}`}
      />

      <CertificateSelectorModal
        visible={showCertSelector}
        onClose={() => setShowCertSelector(false)}
        onSelect={handleCertificateSelected}
        defaultCommonName={`${nick}@${name}`}
      />

      {certFingerprint && (
        <CertificateFingerprintModal
          visible={showCertFingerprint}
          onClose={() => setShowCertFingerprint(false)}
          fingerprint={certFingerprint}
        />
      )}
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
      backgroundColor: colors.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.primaryDark,
    },
    identityProfilesButton: {
      backgroundColor: colors.surfaceVariant,
      borderRadius: 8,
      padding: 14,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
    },
    identityProfilesButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButton: {
      padding: 8,
    },
    cancelText: {
      color: colors.onPrimary,
      fontSize: 16,
    },
    title: {
      color: colors.onPrimary,
      fontSize: 18,
      fontWeight: '600',
    },
    saveButton: {
      padding: 8,
    },
    saveText: {
      color: colors.onPrimary,
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
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 4,
      padding: 12,
      fontSize: 14,
      color: colors.inputText,
      backgroundColor: colors.inputBackground,
    },
    inputDisabled: {
      opacity: 0.5,
      backgroundColor: colors.buttonDisabled,
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 4,
      backgroundColor: colors.inputBackground,
    },
    picker: {
      height: 50,
    },
    helpText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 8,
    },
    multilineInput: {
      height: 120,
      textAlignVertical: 'top',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
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
      backgroundColor: colors.buttonPrimary,
      borderRadius: 4,
    },
    retryText: {
      color: colors.buttonPrimaryText,
      fontSize: 14,
      fontWeight: '600',
    },
    certButtonsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    certButton: {
      flex: 1,
      backgroundColor: colors.buttonPrimary,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    certButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.buttonPrimaryText,
    },
    fingerprintButton: {
      backgroundColor: colors.accent,
      marginBottom: 12,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginHorizontal: 12,
    },
  });
