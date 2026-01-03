import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { dataPrivacyService } from '../services/DataPrivacyService';
import { killSwitchService } from '../services/KillSwitchService';

interface DataPrivacyScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const DataPrivacyScreen: React.FC<DataPrivacyScreenProps> = ({
  visible,
  onClose,
}) => {
  const t = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [crashlyticsOptOut, setCrashlyticsOptOut] = useState(false);
  const [dataSummary, setDataSummary] = useState({
    messagesCount: 0,
    networksCount: 0,
    identityProfilesCount: 0,
    storageSize: '0 KB',
    crashlyticsEnabled: true,
    consentStatus: 'Unknown',
  });

  useEffect(() => {
    if (visible) {
      loadDataSummary();
      loadCrashlyticsPreference();
    }
  }, [visible]);

  const loadDataSummary = async () => {
    try {
      const summary = await dataPrivacyService.getDataCollectionSummary();
      setDataSummary(summary);
    } catch (error) {
      console.error('Failed to load data summary:', error);
    }
  };

  const loadCrashlyticsPreference = async () => {
    try {
      const optOut = await dataPrivacyService.getCrashlyticsOptOut();
      setCrashlyticsOptOut(optOut);
    } catch (error) {
      console.error('Failed to load crashlytics preference:', error);
    }
  };

  const handleExportData = async () => {
    Alert.alert(
      t('Export My Data'),
      t('This will create a JSON file with all your data (messages, settings, networks, etc.). You can then share this file via email, cloud storage, etc.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Export'),
          onPress: async () => {
            try {
              setLoading(true);

              const result = await dataPrivacyService.exportUserData();

              if (result.success && result.filePath) {
                // Ask if user wants to share the file
                Alert.alert(
                  t('Export Successful'),
                  t('Your data has been exported. Would you like to share it?'),
                  [
                    { text: t('Not Now'), style: 'cancel' },
                    {
                      text: t('Share'),
                      onPress: async () => {
                        const shared = await dataPrivacyService.shareExportedData(
                          result.filePath!
                        );
                        if (!shared) {
                          Alert.alert(
                            t('Export Complete'),
                            t('File saved to: {path}', { path: result.filePath })
                          );
                        }
                      },
                    },
                  ]
                );
              } else {
                Alert.alert(
                  t('Export Failed'),
                  t('Failed to export data: {error}', { error: result.error || 'Unknown error' })
                );
              }
            } catch (error) {
              Alert.alert(t('Error'), t('An error occurred while exporting data.'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      t('⚠️ Delete All My Data'),
      t('THIS CANNOT BE UNDONE!\n\nThis will permanently delete:\n• All messages\n• All settings\n• All networks\n• All identity profiles\n• Consent preferences\n• Cached data\n\nThe app will restart after deletion. Are you absolutely sure?'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('DELETE EVERYTHING'),
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              t('Final Confirmation'),
              t('Are you really sure? This will delete ALL your data permanently.'),
              [
                { text: t('Cancel'), style: 'cancel' },
                {
                  text: t('Yes, Delete Everything'),
                  style: 'destructive',
                  onPress: performDataDeletion,
                },
              ]
            );
          },
        },
      ]
    );
  };

  const performDataDeletion = async () => {
    try {
      setLoading(true);
      console.log('[DataPrivacyScreen] Starting data deletion...');

      const result = await dataPrivacyService.deleteAllUserData();

      console.log('[DataPrivacyScreen] Deletion result:', {
        success: result.success,
        deletedItems: result.deletedItems,
        errors: result.errors,
      });

      if (result.success) {
        // All data successfully deleted
        const deletedList = Object.entries(result.deletedItems)
          .filter(([_, deleted]) => deleted)
          .map(([item]) => `✓ ${item}`)
          .join('\n');

        console.log('[DataPrivacyScreen] All data deleted successfully');

        Alert.alert(
          t('Data Deleted'),
          t('All your data has been permanently deleted:\n\n{deletedList}\n\nThe app will restart and show the first-run setup again.', {
            deletedList,
          }),
          [
            {
              text: t('OK'),
              onPress: () => {
                console.log('[DataPrivacyScreen] Closing after successful deletion');
                onClose();
              },
            },
          ],
          { cancelable: false }
        );
      } else {
        // Partial deletion - some items failed
        const deletedList = Object.entries(result.deletedItems)
          .filter(([_, deleted]) => deleted)
          .map(([item]) => `✓ ${item}`)
          .join('\n');

        const failedList = Object.entries(result.deletedItems)
          .filter(([_, deleted]) => !deleted)
          .map(([item]) => `✗ ${item}`)
          .join('\n');

        const errorDetails = result.errors.join('\n');

        console.error('[DataPrivacyScreen] Partial deletion - some items failed');
        console.error('[DataPrivacyScreen] Errors:', result.errors);

        Alert.alert(
          t('Partial Deletion'),
          t('Some data could not be deleted.\n\nDeleted:\n{deletedList}\n\nFailed:\n{failedList}\n\nErrors:\n{errorDetails}\n\nPlease check logs for details.', {
            deletedList: deletedList || t('None'),
            failedList: failedList || t('None'),
            errorDetails,
          })
        );
      }
    } catch (error) {
      console.error('[DataPrivacyScreen] Critical error during deletion:', error);
      Alert.alert(
        t('Error'),
        t('Critical error during data deletion: {error}\n\nPlease check the console logs for details.', {
          error: String(error),
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCrashlytics = async (value: boolean) => {
    try {
      setLoading(true);
      await dataPrivacyService.setCrashlyticsOptOut(value);
      setCrashlyticsOptOut(value);

      Alert.alert(
        t('Setting Updated'),
        value
          ? t('Crash reporting has been disabled. New crashes will not be collected.')
          : t('Crash reporting has been enabled. This helps improve app stability.')
      );
    } catch (error) {
      Alert.alert(t('Error'), t('Failed to update crash reporting setting.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('My Data & Privacy')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Data Summary Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('DATA COLLECTED')}</Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('Networks')}:</Text>
                <Text style={styles.summaryValue}>{dataSummary.networksCount}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('Identity Profiles')}:</Text>
                <Text style={styles.summaryValue}>{dataSummary.identityProfilesCount}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('Storage Used')}:</Text>
                <Text style={styles.summaryValue}>{dataSummary.storageSize}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('Ad Consent')}:</Text>
                <Text style={styles.summaryValue}>{dataSummary.consentStatus}</Text>
              </View>
            </View>

            <Text style={styles.sectionNote}>
              {t('This shows data stored locally on your device. Third-party services (Google AdMob, Firebase) may have their own data retention policies.')}
            </Text>
          </View>

          {/* Privacy Controls Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('PRIVACY CONTROLS')}</Text>

            {/* Crashlytics Opt-Out */}
            <View style={styles.controlCard}>
              <View style={styles.controlHeader}>
                <View style={styles.controlTextContainer}>
                  <Text style={styles.controlTitle}>{t('Crash Reporting')}</Text>
                  <Text style={styles.controlDescription}>
                    {t('Send anonymous crash reports to help improve app stability')}
                  </Text>
                </View>
                <Switch
                  value={!crashlyticsOptOut}
                  onValueChange={(value) => handleToggleCrashlytics(!value)}
                  disabled={loading}
                />
              </View>
            </View>

            <Text style={styles.sectionNote}>
              {t('When disabled, crash reports will not be collected. This may make it harder to fix bugs you encounter.')}
            </Text>
          </View>

          {/* Data Actions Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('YOUR RIGHTS (GDPR/CCPA)')}</Text>

            {/* Export Data Button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleExportData}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="file-download" size={28} color="#fff" style={styles.actionButtonIcon} />
                  <View style={styles.actionButtonTextContainer}>
                    <Text style={styles.actionButtonText}>{t('Export My Data')}</Text>
                    <Text style={styles.actionButtonDescription}>
                      {t('Download all your data in JSON format')}
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            {/* Delete Data Button */}
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDanger]}
              onPress={handleDeleteAllData}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="trash-alt" size={28} color={colors.error || '#f44336'} solid style={styles.actionButtonIcon} />
                  <View style={styles.actionButtonTextContainer}>
                    <Text style={[styles.actionButtonText, styles.dangerText]}>
                      {t('Delete All My Data')}
                    </Text>
                    <Text style={[styles.actionButtonDescription, styles.dangerDescriptionText]}>
                      {t('Permanently erase all your data (cannot be undone)')}
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            {/* Kill Switch Button */}
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonKillSwitch]}
              onPress={() => killSwitchService.confirmAndActivate()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="skull" size={28} color="#fff" solid style={styles.actionButtonIcon} />
                  <View style={styles.actionButtonTextContainer}>
                    <Text style={styles.actionButtonText}>
                      {t('🚨 KILL SWITCH 🚨')}
                    </Text>
                    <Text style={styles.actionButtonDescription}>
                      {t('EMERGENCY: Delete EVERYTHING including certs, logs, secure storage. Keyboard shortcut: Ctrl+Shift+K')}
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('IMPORTANT INFORMATION')}</Text>

            <View style={styles.infoCard}>
              <View style={styles.infoTitleRow}>
                <Icon name="clipboard-list" size={16} color={colors.primary} solid style={styles.infoTitleIcon} />
                <Text style={styles.infoTitle}>{t('What gets exported?')}</Text>
              </View>
              <Text style={styles.infoText}>
                • {t('All messages (including DMs)')}{'\n'}
                • {t('Network configurations')}{'\n'}
                • {t('Identity profiles')}{'\n'}
                • {t('Settings and preferences')}{'\n'}
                • {t('Consent status')}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoTitleRow}>
                <Icon name="exclamation-triangle" size={16} color={colors.error || '#f44336'} solid style={styles.infoTitleIcon} />
                <Text style={styles.infoTitle}>{t('What gets deleted?')}</Text>
              </View>
              <Text style={styles.infoText}>
                • {t('All local data (messages, settings, etc.)')}{'\n'}
                • {t('Consent preferences (will be asked again)')}{'\n'}
                • {t('Cached files')}
              </Text>
              <Text style={[styles.infoText, { marginTop: 8, fontStyle: 'italic' }]}>
                {t('Note: Data already sent to Google (AdMob, Crashlytics) cannot be deleted via this app, but will be automatically deleted per their retention policies (14-90 days).')}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoTitleRow}>
                <Icon name="shield-alt" size={16} color={colors.primary} solid style={styles.infoTitleIcon} />
                <Text style={styles.infoTitle}>{t('Your Privacy Rights')}</Text>
              </View>
              <Text style={styles.infoText}>
                {t('Under GDPR and CCPA, you have the right to:')}
                {'\n'}• {t('Access your data (Export)')}{'\n'}
                • {t('Delete your data (Right to be forgotten)')}{'\n'}
                • {t('Opt-out of data collection')}{'\n'}
                • {t('Withdraw consent at any time')}{'\n'}
                • {t('Data portability (Export to another service)')}
              </Text>
            </View>
          </View>

          {/* Footer spacing */}
          <View style={{ height: 40 }} />
        </ScrollView>
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
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 12,
      letterSpacing: 0.5,
    },
    sectionNote: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
      fontStyle: 'italic',
      lineHeight: 18,
    },
    summaryCard: {
      backgroundColor: colors.cardBackground || colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    controlCard: {
      backgroundColor: colors.cardBackground || colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    controlHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    controlTextContainer: {
      flex: 1,
      marginRight: 12,
    },
    controlTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    controlDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    actionButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButtonDanger: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.error || '#f44336',
    },
    actionButtonKillSwitch: {
      backgroundColor: '#8B0000',
      borderWidth: 2,
      borderColor: '#FF0000',
    },
    actionButtonIcon: {
      marginRight: 16,
    },
    actionButtonTextContainer: {
      flex: 1,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    dangerText: {
      color: colors.error || '#f44336',
    },
    actionButtonDescription: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: 12,
    },
    dangerDescriptionText: {
      color: colors.textSecondary,
    },
    infoCard: {
      backgroundColor: colors.cardBackground || colors.surface,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    infoTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    infoTitleIcon: {
      marginRight: 8,
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
