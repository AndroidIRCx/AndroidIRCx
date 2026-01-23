import React, { useState, useEffect } from 'react';
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

interface ServerSettingsScreenProps {
  networkId: string;
  serverId?: string;
  onSave: (server: IRCServerConfig) => void;
  onCancel: () => void;
}

export const ServerSettingsScreen: React.FC<ServerSettingsScreenProps> = ({
  networkId,
  serverId,
  onSave,
  onCancel,
}) => {
  const t = useT();
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

  useEffect(() => {
    if (serverId && networkId) {
      loadServer();
    } else {
      // Default values for new server
      setPort('6697');
      setSsl(true);
      setRejectUnauthorized(false);
    }
  }, [serverId, networkId]);

  const loadServer = async () => {
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
        const isDefault = network.defaultServerId === serverId;
        setIsDefaultServer(isDefault);
        setWasDefaultServer(isDefault);
      } else {
        setError(t('Server not found'));
      }
    } catch (err) {
      setError(t('Failed to load server'));
      console.error('Error loading server:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hostname.trim()) {
      Alert.alert(t('Error'), t('Please enter a hostname'));
      return;
    }

    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Alert.alert(t('Error'), t('Please enter a valid port number (1-65535)'));
      return;
    }

    const server: IRCServerConfig = {
      id: serverId || `server-${Date.now()}`,
      name: name.trim() || hostname.trim(),
      hostname: hostname.trim(),
      port: portNum,
      ssl: ssl,
      rejectUnauthorized: rejectUnauthorized,
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

    onSave(server);
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>{t('Cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('Server Settings')}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveText}>{t('Save')}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
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
              placeholderTextColor="#9E9E9E"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('Hostname *')}</Text>
            <TextInput
              style={styles.input}
              value={hostname}
              onChangeText={setHostname}
              placeholder={t('irc.example.com')}
              placeholderTextColor="#9E9E9E"
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
              placeholderTextColor="#9E9E9E"
              keyboardType="numeric"
            />
            <Text style={styles.hint}>{t('Standard ports: 6667 (plain), 6697 (SSL/TLS)')}</Text>
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
                trackColor={{ false: '#E0E0E0', true: '#81C784' }}
                thumbColor={ssl ? '#4CAF50' : '#F5F5F5'}
              />
            </View>
            <Text style={styles.hint}>
              {t('Enable for secure connections (recommended for port 6697)')}
            </Text>
          </View>

          {ssl && (
            <View style={styles.switchGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('Reject Unauthorized Certificates')}</Text>
                <Switch
                  value={rejectUnauthorized}
                  onValueChange={setRejectUnauthorized}
                  trackColor={{ false: '#E0E0E0', true: '#81C784' }}
                  thumbColor={rejectUnauthorized ? '#4CAF50' : '#F5F5F5'}
                />
              </View>
              <Text style={styles.hint}>
                {t('Leave on (recommended). Turn off only for self-signed/expired certs.')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('Authentication')}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('Server Password (Optional)')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('Server connection password')}
              placeholderTextColor="#9E9E9E"
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
                trackColor={{ false: '#E0E0E0', true: '#81C784' }}
                thumbColor={favorite ? '#4CAF50' : '#F5F5F5'}
              />
            </View>
            <Text style={styles.hint}>
              {t('Mark this server as the preferred choice for this network.')}
            </Text>
          </View>

          <View style={styles.switchGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('Default Server')}</Text>
              <Switch
                value={isDefaultServer}
                onValueChange={setIsDefaultServer}
                trackColor={{ false: '#E0E0E0', true: '#81C784' }}
                thumbColor={isDefaultServer ? '#4CAF50' : '#F5F5F5'}
              />
            </View>
            <Text style={styles.hint}>
              {t('Set as default server for "Tap to connect" header. This server will be used when tapping the network name in the header.')}
            </Text>
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
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    color: '#212121',
    backgroundColor: '#FAFAFA',
  },
  hint: {
    fontSize: 12,
    color: '#9E9E9E',
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
    color: '#212121',
    flex: 1,
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

