import React, { useState, useEffect } from 'react';
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
import { IRCNetworkConfig, settingsService } from '../services/SettingsService';

interface NetworkSettingsScreenProps {
  networkId?: string;
  onSave: (network: IRCNetworkConfig) => void;
  onCancel: () => void;
}

export const NetworkSettingsScreen: React.FC<NetworkSettingsScreenProps> = ({
  networkId,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [nick, setNick] = useState('');
  const [altNick, setAltNick] = useState('');
  const [realname, setRealname] = useState('');
  const [ident, setIdent] = useState('');
  const [autoJoinChannels, setAutoJoinChannels] = useState('');
  const [saslAccount, setSaslAccount] = useState('');
  const [saslPassword, setSaslPassword] = useState('');
  const [clientCert, setClientCert] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyType, setProxyType] = useState('tor');
  const [proxyHost, setProxyHost] = useState('127.0.0.1');
  const [proxyPort, setProxyPort] = useState('9050');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    }
  }, [networkId]);

  const loadNetwork = async () => {
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
        setClientCert(network.clientCert || '');
        setClientKey(network.clientKey || '');
        setProxyEnabled(network.proxy ? network.proxy.enabled !== false : false);
        setProxyType(network.proxy?.type || 'tor');
        setProxyHost(network.proxy?.host || (network.proxy?.type === 'tor' ? '127.0.0.1' : ''));
        setProxyPort(
          network.proxy?.port
            ? String(network.proxy.port)
            : network.proxy?.type === 'tor'
              ? '9050'
              : ''
        );
        setProxyUsername(network.proxy?.username || '');
        setProxyPassword(network.proxy?.password || '');
      } else {
        setError('Network not found');
      }
    } catch (err) {
      setError('Failed to load network');
      console.error('Error loading network:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !nick.trim() || !realname.trim()) {
      Alert.alert('Error', 'Please fill in all required fields (Name, Nick, Realname)');
      return;
    }

    const existingNetwork = networkId ? await settingsService.getNetwork(networkId) : null;
    const computedProxyHost = proxyHost.trim() || (proxyType === 'tor' ? '127.0.0.1' : '');
    const computedProxyPort = proxyPort.trim() || (proxyType === 'tor' ? '9050' : '');
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
      proxy: proxyEnabled && computedProxyHost && computedProxyPort ? {
        enabled: true,
        type: (proxyType || 'tor') as any,
        host: computedProxyHost,
        port: parseInt(computedProxyPort, 10),
        username: proxyUsername.trim() || undefined,
        password: proxyPassword.trim() || undefined,
      } : undefined,
      sasl: saslAccount && saslPassword
        ? { account: saslAccount.trim(), password: saslPassword.trim() }
        : undefined,
      clientCert: clientCert.trim() || undefined,
      clientKey: clientKey.trim() || undefined,
      connectOnStartup: false,
    };

    onSave(network);
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Network Settings</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadNetwork} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Network Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., dbase.in.rs"
              placeholderTextColor="#9E9E9E"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nickname *</Text>
            <TextInput
              style={styles.input}
              value={nick}
              onChangeText={setNick}
              placeholder="Your IRC nickname"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Alternative Nickname</Text>
            <TextInput
              style={styles.input}
              value={altNick}
              onChangeText={setAltNick}
              placeholder="Fallback if primary nick is taken"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Real Name *</Text>
            <TextInput
              style={styles.input}
              value={realname}
              onChangeText={setRealname}
              placeholder="Your real name or description"
              placeholderTextColor="#9E9E9E"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ident / Username</Text>
            <TextInput
              style={styles.input}
              value={ident}
              onChangeText={setIdent}
              placeholder="Username for ident (optional)"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auto-Join Channels</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Channels (comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={autoJoinChannels}
              onChangeText={setAutoJoinChannels}
              placeholder="#channel1, #channel2"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SASL PLAIN (Optional)</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>SASL Account</Text>
            <TextInput
              style={styles.input}
              value={saslAccount}
              onChangeText={setSaslAccount}
              placeholder="SASL account name"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>SASL Password</Text>
            <TextInput
              style={styles.input}
              value={saslPassword}
              onChangeText={setSaslPassword}
              placeholder="SASL password"
              placeholderTextColor="#9E9E9E"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proxy (Optional, per network)</Text>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Enable proxy (Tor/SOCKS5/HTTP)</Text>
            <Switch value={proxyEnabled} onValueChange={setProxyEnabled} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Type (socks5, http, tor)</Text>
            <TextInput
              style={[styles.input, !proxyEnabled && styles.inputDisabled]}
              value={proxyType}
              editable={proxyEnabled}
              onChangeText={setProxyType}
              placeholder="tor"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Host</Text>
            <TextInput
              style={[styles.input, !proxyEnabled && styles.inputDisabled]}
              value={proxyHost}
              editable={proxyEnabled}
              onChangeText={setProxyHost}
              placeholder="127.0.0.1 (Tor default)"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Port</Text>
            <TextInput
              style={[styles.input, !proxyEnabled && styles.inputDisabled]}
              value={proxyPort}
              editable={proxyEnabled}
              onChangeText={setProxyPort}
              placeholder="9050 for Tor, 1080 for SOCKS5"
              placeholderTextColor="#9E9E9E"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={[styles.input, !proxyEnabled && styles.inputDisabled]}
              value={proxyUsername}
              editable={proxyEnabled}
              onChangeText={setProxyUsername}
              placeholder="optional"
              placeholderTextColor="#9E9E9E"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, !proxyEnabled && styles.inputDisabled]}
              value={proxyPassword}
              editable={proxyEnabled}
              onChangeText={setProxyPassword}
              placeholder="optional"
              placeholderTextColor="#9E9E9E"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SASL EXTERNAL (Client Certificate)</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Client Certificate (PEM)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={clientCert}
              onChangeText={setClientCert}
              placeholder="-----BEGIN CERTIFICATE-----..."
              placeholderTextColor="#9E9E9E"
              multiline
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Client Private Key (PEM)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={clientKey}
              onChangeText={setClientKey}
              placeholder="-----BEGIN PRIVATE KEY-----..."
              placeholderTextColor="#9E9E9E"
              multiline
              autoCapitalize="none"
            />
          </View>
        </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderBottomWidth: 1,
    borderBottomColor: '#1976D2',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    padding: 8,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#757575',
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
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    color: '#212121',
    backgroundColor: '#FAFAFA',
  },
  inputDisabled: {
    opacity: 0.5,
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
    color: '#757575',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

