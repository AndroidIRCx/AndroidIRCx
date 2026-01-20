import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { ircService } from '../services/IRCService';
import { connectionManager } from '../services/ConnectionManager';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { encryptedDMService } from '../services/EncryptedDMService';
import { settingsService } from '../services/SettingsService';
import Clipboard from '@react-native-clipboard/clipboard';

interface QueryEncryptionMenuProps {
  visible: boolean;
  onClose: () => void;
  nick: string;
  network?: string;
}

export const QueryEncryptionMenu: React.FC<QueryEncryptionMenuProps> = ({
  visible,
  onClose,
  nick,
  network,
}) => {
  const { colors } = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const [actionMessage, setActionMessage] = useState('');
  const [allowQrVerification, setAllowQrVerification] = useState(true);
  const [allowFileExchange, setAllowFileExchange] = useState(true);
  const [allowNfcExchange, setAllowNfcExchange] = useState(true);
  const [showKeyQr, setShowKeyQr] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrType, setQrType] = useState<'bundle' | 'fingerprint'>('bundle');
  const [showKeyScan, setShowKeyScan] = useState(false);
  const [scanError, setScanError] = useState('');
  const device = useCameraDevice('back');
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const scanHandledRef = useRef(false);
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (!showKeyScan || scanHandledRef.current) return;
      const code = codes[0]?.value || codes[0]?.rawValue;
      if (!code) return;
      scanHandledRef.current = true;
      setShowKeyScan(false);
      setScanError('');
      handleExternalPayload(code);
    },
  });

  const activeIrc = (network ? connectionManager.getConnection(network)?.ircService : null) || ircService;

  // Always use network-aware storage. Get network from IRC service if not provided as prop.
  const getNetworkForStorage = useCallback((): string => {
    const result = network || activeIrc.getNetworkName() || 'default';
    console.log('[QueryEncryptionMenu] getNetworkForStorage - network prop:', network, 'activeIrc.getNetworkName():', activeIrc.getNetworkName(), 'result:', result);
    return result;
  }, [network, activeIrc]);

  useEffect(() => {
    if (!actionMessage) return;
    const timer = setTimeout(() => setActionMessage(''), 1500);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const qr = await settingsService.getSetting('securityAllowQrVerification', true);
      const file = await settingsService.getSetting('securityAllowFileExchange', true);
      const nfc = await settingsService.getSetting('securityAllowNfcExchange', true);
      if (mounted) {
        setAllowQrVerification(qr);
        setAllowFileExchange(file);
        setAllowNfcExchange(nfc);
      }
    };
    load();
    const unsubQr = settingsService.onSettingChange('securityAllowQrVerification', (v) => setAllowQrVerification(Boolean(v)));
    const unsubFile = settingsService.onSettingChange('securityAllowFileExchange', (v) => setAllowFileExchange(Boolean(v)));
    const unsubNfc = settingsService.onSettingChange('securityAllowNfcExchange', (v) => setAllowNfcExchange(Boolean(v)));
    return () => {
      mounted = false;
      unsubQr();
      unsubFile();
      unsubNfc();
    };
  }, []);

  const handleExternalPayload = useCallback(async (raw: string) => {
    try {
      const payload = encryptedDMService.parseExternalPayload(raw);
      if (payload.nick && payload.nick.toLowerCase() !== nick.toLowerCase()) {
        Alert.alert(
          t('Mismatched Nick'),
          t('This payload is for {payloadNick}, but you selected {nick}.', {
            payloadNick: payload.nick,
            nick,
          }),
          [{ text: t('OK'), style: 'cancel' }]
        );
        return;
      }

      if (payload.type === 'encdm-fingerprint') {
        const storageNetwork = getNetworkForStorage();
        const currentFp = await encryptedDMService.getBundleFingerprintForNetwork(storageNetwork, nick);
        if (!currentFp) {
          Alert.alert(
            t('No Key'),
            t('No DM key stored for {nick}.', { nick })
          );
          return;
        }
        const currentDisplay = encryptedDMService.formatFingerprintForDisplay(currentFp);
        const incomingDisplay = encryptedDMService.formatFingerprintForDisplay(payload.fingerprint);
        const matches = currentFp === payload.fingerprint;
        Alert.alert(
          t('Fingerprint Check'),
          t('Stored: {stored}\nScanned: {scanned}\n\n{result}', {
            stored: currentDisplay,
            scanned: incomingDisplay,
            result: matches ? t('Match ✅') : t('Mismatch ⚠️'),
          }),
          matches
            ? [
                {
                  text: t('Mark Verified'),
                  onPress: async () => {
                    await encryptedDMService.setVerifiedForNetwork(storageNetwork, nick, true);
                    setActionMessage(t('Key verified for {nick}', { nick }));
                  },
                },
                { text: t('Close'), style: 'cancel' },
              ]
            : [{ text: t('Close'), style: 'cancel' }]
        );
        return;
      }

      encryptedDMService.verifyBundle(payload.bundle);
      const storageNetwork = getNetworkForStorage();
      const existingFp = await encryptedDMService.getBundleFingerprintForNetwork(storageNetwork, nick);
      const newDisplay = encryptedDMService.formatFingerprintForDisplay(payload.fingerprint);
      const oldDisplay = existingFp
        ? encryptedDMService.formatFingerprintForDisplay(existingFp)
        : t('None');
      const isChange = Boolean(existingFp && existingFp !== payload.fingerprint);
      Alert.alert(
        isChange ? t('Replace DM Key') : t('Import DM Key'),
        isChange
          ? t('Existing: {old}\nNew: {new}\n\nOnly replace if verified out-of-band.', {
              old: oldDisplay,
              new: newDisplay,
            })
          : t('Fingerprint: {fp}\n\nAccept this key for {nick}?', {
              fp: newDisplay,
              nick,
            }),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: isChange ? t('Replace') : t('Accept'),
            onPress: async () => {
              // Always use network-aware storage
              await encryptedDMService.acceptExternalBundleForNetwork(storageNetwork, nick, payload.bundle, isChange);
              setActionMessage(
                isChange
                  ? t('Key replaced for {nick}', { nick })
                  : t('Key imported for {nick}', { nick })
              );

              // Prompt to share key back for bidirectional encryption (offline only)
              setTimeout(() => {
                Alert.alert(
                  t('Share Your Key?'),
                  t(
                    "You imported {nick}'s key offline. For encrypted chat to work both ways, {nick} also needs your key.\n\n💡 Show your QR code for them to scan (no server messages)",
                    { nick }
                  ),
                  [
                    { text: t('Later'), style: 'cancel' },
                    {
                      text: t('Show QR Code'),
                      onPress: async () => {
                        try {
                          const selfNick = activeIrc.getCurrentNick();
                          const sharePayload = await encryptedDMService.exportBundlePayload(selfNick);
                          setQrPayload(sharePayload);
                          setQrType('bundle');
                          setShowKeyQr(true);
                        } catch (e) {
                          setActionMessage(t('Failed to generate QR'));
                        }
                      },
                    },
                  ]
                );
              }, 500);
            },
          },
        ]
      );
    } catch (e) {
      setActionMessage(t('Invalid key payload'));
    }
  }, [activeIrc, getNetworkForStorage, nick, t]);

  const handleAction = async (action: string) => {
    switch (action) {
      case 'enc_share':
        try {
          const bundle = await encryptedDMService.exportBundle();
          activeIrc.sendRaw(`PRIVMSG ${nick} :!enc-offer ${JSON.stringify(bundle)}`);
          setActionMessage(t('Enc key offer sent to {nick}', { nick }));
        } catch (e) {
          setActionMessage(t('Failed to share key'));
        }
        break;
      case 'enc_request':
        activeIrc.sendRaw(`PRIVMSG ${nick} :!enc-req`);
        setActionMessage(t('Requested key from {nick}', { nick }));
        encryptedDMService
          .awaitBundleForNick(nick, 36000)
          .then(() => setActionMessage(t('Key saved for {nick}', { nick })))
          .catch(() => setActionMessage(t('Key not received (timeout)')));
        break;
      case 'enc_qr_show_fingerprint':
        try {
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportFingerprintPayload(selfNick);
          setQrPayload(payload);
          setQrType('fingerprint');
          setShowKeyQr(true);
        } catch (e) {
          setActionMessage(t('Failed to generate QR'));
        }
        break;
      case 'enc_qr_show_bundle':
        try {
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportBundlePayload(selfNick);
          setQrPayload(payload);
          setQrType('bundle');
          setShowKeyQr(true);
        } catch (e) {
          setActionMessage(t('Failed to generate QR'));
        }
        break;
      case 'enc_qr_scan':
        try {
          const permission = hasCameraPermission || (await requestCameraPermission()) === 'authorized';
          if (!permission) {
            setActionMessage(t('Camera permission denied'));
            break;
          }
          scanHandledRef.current = false;
          setShowKeyScan(true);
          setScanError('');
        } catch (e) {
          setActionMessage(t('Failed to open camera'));
        }
        break;
      case 'enc_share_file':
        try {
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportBundlePayload(selfNick);
          const filename = `androidircx-key-${selfNick}.json`;
          const path = `${RNFS.CachesDirectoryPath}/${filename}`;
          try {
            await RNFS.writeFile(path, payload, 'utf8');
            await Share.open({ url: `file://${path}`, type: 'application/json' });
            setActionMessage(t('Key file shared'));
          } finally {
            try {
              if (await RNFS.exists(path)) {
                await RNFS.unlink(path);
              }
            } catch {
              // Ignore cleanup errors
            }
          }
        } catch (e) {
          setActionMessage(t('Failed to share key file'));
        }
        break;
      case 'enc_import_file':
        try {
          const result = await pick({
            type: [types.allFiles],
            mode: 'import',
          });
          if (result.length === 0) return;
          const picker = result[0];
          const uri = picker.fileCopyUri || picker.uri;
          const path = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
          const shouldCleanupCopy = Boolean(picker.fileCopyUri);
          try {
            const contents = await RNFS.readFile(path, 'utf8');
            await handleExternalPayload(contents);
          } finally {
            if (shouldCleanupCopy) {
              try {
                await RNFS.unlink(path);
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        } catch (e: any) {
          if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
            // User cancelled, ignore
          } else {
            setActionMessage(t('Failed to import key file'));
          }
        }
        break;
      case 'enc_share_nfc':
        try {
          const supported = await NfcManager.isSupported();
          if (!supported) {
            setActionMessage(t('NFC not supported'));
            break;
          }
          const selfNick = activeIrc.getCurrentNick();
          const payload = await encryptedDMService.exportBundlePayload(selfNick);
          await NfcManager.start();
          await NfcManager.requestTechnology(NfcTech.Ndef);
          const bytes = Ndef.encodeMessage([Ndef.textRecord(payload)]);
          if (bytes) {
            await NfcManager.writeNdefMessage(bytes);
          }
          setActionMessage(t('NFC key ready, tap devices'));
        } catch (e) {
          setActionMessage(t('Failed to share via NFC'));
        } finally {
          try { await NfcManager.cancelTechnologyRequest(); } catch {}
        }
        break;
      case 'enc_receive_nfc':
        try {
          const supported = await NfcManager.isSupported();
          if (!supported) {
            setActionMessage(t('NFC not supported'));
            break;
          }
          await NfcManager.start();
          await NfcManager.requestTechnology(NfcTech.Ndef);
          const tag = await NfcManager.getTag();
          const ndefMessage = tag?.ndefMessage?.[0];
          const payload = ndefMessage ? Ndef.text.decodePayload(ndefMessage.payload) : null;
          if (!payload) {
            setActionMessage(t('No NFC payload'));
            break;
          }
          await handleExternalPayload(payload);
        } catch (e) {
          setActionMessage(t('Failed to read NFC'));
        } finally {
          try { await NfcManager.cancelTechnologyRequest(); } catch {}
        }
        break;
      case 'enc_verify':
        try {
          const status = network
            ? await encryptedDMService.getVerificationStatusForNetwork(network, nick)
            : await encryptedDMService.getVerificationStatus(nick);
          if (!status.fingerprint) {
            setActionMessage(t('No DM key for {nick}', { nick }));
            break;
          }
          const selfFp = encryptedDMService.formatFingerprintForDisplay(await encryptedDMService.getSelfFingerprint());
          const peerFp = encryptedDMService.formatFingerprintForDisplay(status.fingerprint);
          const verifiedLabel = status.verified ? t('Verified') : t('Mark Verified');
          Alert.alert(
            t('Verify DM Key'),
            t('Compare fingerprints out-of-band:\n\nYou: {self}\n{nick}: {peer}', {
              self: selfFp,
              nick,
              peer: peerFp,
            }),
            [
              {
                text: verifiedLabel,
                onPress: async () => {
                  if (!status.verified) {
                    const storageNetwork = getNetworkForStorage();
                    await encryptedDMService.setVerifiedForNetwork(storageNetwork, nick, true);
                    setActionMessage(t('Key marked verified for {nick}', { nick }));
                  }
                },
              },
              {
                text: t('Copy Fingerprints'),
                onPress: () => {
                  Clipboard.setString(`You: ${selfFp}\n${nick}: ${peerFp}`);
                  setActionMessage(t('Fingerprints copied'));
                },
              },
              { text: t('Close'), style: 'cancel' },
            ]
          );
        } catch (e) {
          setActionMessage(t('Failed to load fingerprints'));
        }
        break;
      default:
        break;
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onClose}>
          <View style={styles.menu}>
            <ScrollView
              style={styles.menuScroll}
              contentContainerStyle={styles.menuContent}
              showsVerticalScrollIndicator>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>{t('E2E Encryption - {nick}', { nick })}</Text>
              </View>
              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleAction('enc_share')}>
                <Text style={styles.menuText}>{t('Share DM Key')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleAction('enc_request')}>
                <Text style={styles.menuText}>{t('Request DM Key (36s)')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleAction('enc_verify')}>
                <Text style={styles.menuText}>{t('Verify DM Key')}</Text>
              </TouchableOpacity>

              {allowQrVerification && (
                <>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAction('enc_qr_show_bundle')}>
                    <Text style={styles.menuText}>{t('Share Key Bundle QR')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAction('enc_qr_show_fingerprint')}>
                    <Text style={styles.menuText}>{t('Show Fingerprint QR (Verify)')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAction('enc_qr_scan')}>
                    <Text style={styles.menuText}>{t('Scan QR Code')}</Text>
                  </TouchableOpacity>
                </>
              )}

              {allowFileExchange && (
                <>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAction('enc_share_file')}>
                    <Text style={styles.menuText}>{t('Share Key File')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAction('enc_import_file')}>
                    <Text style={styles.menuText}>{t('Import Key File')}</Text>
                  </TouchableOpacity>
                </>
              )}

              {allowNfcExchange && (
                <>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAction('enc_share_nfc')}>
                    <Text style={styles.menuText}>{t('Share via NFC')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleAction('enc_receive_nfc')}>
                    <Text style={styles.menuText}>{t('Receive via NFC')}</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.menuDivider} />
              {actionMessage ? (
                <View style={styles.feedbackContainer}>
                  <Text style={styles.feedbackText}>{actionMessage}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={onClose}>
                <Text style={[styles.menuText, styles.menuCancel]}>
                  {t('Close')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showKeyQr}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKeyQr(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowKeyQr(false)}>
          <View style={styles.qrModal}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>
                {qrType === 'bundle' ? t('Share Key Bundle') : t('Fingerprint QR')}
              </Text>
              <Text style={styles.qrModalSubtitle}>
                {qrType === 'bundle'
                  ? t('Scan to import encryption key')
                  : t('Scan to verify out-of-band')}
              </Text>
            </View>
            <View style={styles.qrCodeContainer}>
              {qrPayload ? (
                <QRCode
                  value={qrPayload}
                  size={260}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                  ecl="H"
                />
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.qrModalButton}
              onPress={() => {
                if (qrPayload) Clipboard.setString(qrPayload);
                setActionMessage(t('QR payload copied'));
              }}>
              <Text style={styles.qrModalButtonText}>{t('Copy Payload')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showKeyScan}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKeyScan(false)}>
        <View style={styles.scanContainer}>
          {device && hasCameraPermission ? (
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={showKeyScan}
              codeScanner={codeScanner}
            />
          ) : (
            <View style={styles.scanFallback}>
              <Text style={styles.menuText}>
                {scanError || t('Camera unavailable')}
              </Text>
            </View>
          )}
          <View style={styles.scanOverlay}>
            <Text style={styles.scanText}>{t('Scan a fingerprint QR')}</Text>
            <TouchableOpacity
              style={styles.scanClose}
              onPress={() => setShowKeyScan(false)}>
              <Text style={styles.menuText}>{t('Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (colors: any = {}) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: colors.surface || '#FFFFFF',
    borderRadius: 8,
    minWidth: 280,
    maxWidth: 360,
    width: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  menuScroll: {
    maxHeight: '85%',
  },
  menuContent: {
    paddingBottom: 8,
  },
  menuHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#212121',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border || '#E0E0E0',
  },
  menuItem: {
    padding: 16,
  },
  menuText: {
    fontSize: 14,
    color: colors.text,
  },
  menuCancel: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  feedbackContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  feedbackText: {
    fontSize: 12,
    color: '#616161',
    textAlign: 'center',
  },
  qrModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 300,
    maxWidth: 360,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  qrModalHeader: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 6,
    textAlign: 'center',
  },
  qrModalSubtitle: {
    fontSize: 13,
    color: '#757575',
    textAlign: 'center',
  },
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  qrModalButton: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  qrModalButtonText: {
    fontSize: 15,
    color: '#2196F3',
    textAlign: 'center',
    fontWeight: '500',
  },
  scanContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scanOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
  },
  scanText: {
    color: '#fff',
    fontWeight: '600',
  },
  scanClose: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
  },
  scanFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
