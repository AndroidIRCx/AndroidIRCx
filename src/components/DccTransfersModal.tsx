import React from 'react';
import { Modal, TouchableOpacity, View, Text, Alert } from 'react-native';
import Share from 'react-native-share';

export interface DccTransfer {
  id: string;
  direction: 'incoming' | 'outgoing';
  status: 'pending' | 'downloading' | 'sending' | 'failed' | 'cancelled' | 'completed';
  offer: {
    filename: string;
  };
  size?: number;
  bytesReceived: number;
  filePath?: string;
}

// Helper to determine MIME type from filename
const getMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    // Archives
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
    // Video
    mp4: 'video/mp4',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
    mov: 'video/quicktime',
    // Code/Text
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    ts: 'text/typescript',
    // Other
    apk: 'application/vnd.android.package-archive',
    exe: 'application/x-msdownload',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

interface DccTransfersModalProps {
  visible: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  transfers: DccTransfer[];
  onAccept: (transferId: string, filePath: string) => Promise<void>;
  onCancel: (transferId: string) => void;
  styles: any;
}

export const DccTransfersModal: React.FC<DccTransfersModalProps> = ({
  visible,
  onClose,
  onMinimize,
  transfers,
  onAccept,
  onCancel,
  styles,
}) => {
  // Count active transfers (downloading or sending)
  const activeTransfers = transfers.filter(t => t.status === 'downloading' || t.status === 'sending');
  const hasActiveTransfers = activeTransfers.length > 0;
  const handleOpenFile = async (transfer: DccTransfer) => {
    if (!transfer.filePath) {
      Alert.alert('Error', 'File path not available');
      return;
    }

    try {
      const mimeType = getMimeType(transfer.offer.filename);
      // Ensure path starts with / and construct proper file:// URI
      const normalizedPath = transfer.filePath.startsWith('/')
        ? transfer.filePath
        : `/${transfer.filePath}`;

      // Verify file exists before trying to open
      const RNFS = require('react-native-fs');
      const exists = await RNFS.exists(transfer.filePath);
      if (!exists) {
        Alert.alert('Error', 'File no longer exists at the saved location');
        return;
      }

      await Share.open({
        url: `file://${normalizedPath}`,
        type: mimeType,
        title: `Open ${transfer.offer.filename}`,
        showAppsToView: true,
      });
    } catch (error: any) {
      // Share dialog was cancelled or failed
      if (error.message !== 'User did not share') {
        console.error('[DccTransfersModal] Error opening file:', error);
        // Provide more helpful error message
        if (error.message?.includes('null object reference') || error.message?.includes('Uri')) {
          Alert.alert(
            'Error',
            'Could not open file. The file may need to be moved to an accessible location or the app may need to be restarted.',
          );
        } else {
          Alert.alert('Error', `Could not open file: ${error.message}`);
        }
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
        <View style={[styles.modalContent, { maxHeight: '80%' }]} onStartShouldSetResponder={() => true}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.modalTitle}>DCC Transfers</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {hasActiveTransfers && onMinimize && (
                <TouchableOpacity
                  onPress={onMinimize}
                  style={{ padding: 8, backgroundColor: '#2196F3', borderRadius: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Minimize</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                style={{ padding: 8 }}>
                <Text style={[styles.optionText, { fontSize: 16 }]}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          {transfers.length === 0 ? (
            <Text style={styles.optionText}>No transfers</Text>
          ) : (
            transfers.map(t => {
              const percent = t.size ? Math.min(100, Math.floor((t.bytesReceived / t.size) * 100)) : undefined;
              return (
                <View key={t.id} style={{ marginBottom: 12 }}>
                  <Text style={styles.optionText}>{t.offer.filename} ({t.direction})</Text>
                  <Text style={styles.optionText}>Status: {t.status} {percent !== undefined ? `- ${percent}%` : ''}</Text>
                  {t.status === 'completed' && t.filePath && (
                    <Text style={[styles.optionText, { fontSize: 11, opacity: 0.7 }]} numberOfLines={1}>
                      {t.filePath}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {t.status === 'pending' && t.direction === 'incoming' && (
                      <TouchableOpacity
                        onPress={async () => {
                          const RNFS = require('react-native-fs');
                          const path = `${RNFS.DocumentDirectoryPath}/${t.offer.filename}`;
                          await onAccept(t.id, path);
                        }}>
                        <Text style={styles.optionText}>Accept</Text>
                      </TouchableOpacity>
                    )}
                    {(t.status === 'failed' || t.status === 'cancelled') && t.filePath && (
                      <TouchableOpacity
                        onPress={async () => {
                          const path = t.filePath || `${require('react-native-fs').DocumentDirectoryPath}/${t.offer.filename}`;
                          await onAccept(t.id, path);
                        }}>
                        <Text style={styles.optionText}>Resume</Text>
                      </TouchableOpacity>
                    )}
                    {(t.status === 'downloading' || t.status === 'pending' || t.status === 'sending') && (
                      <TouchableOpacity onPress={() => onCancel(t.id)}>
                        <Text style={[styles.optionText, styles.destructiveOption]}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                    {t.status === 'completed' && t.direction === 'incoming' && t.filePath && (
                      <TouchableOpacity
                        onPress={() => handleOpenFile(t)}
                        style={{ backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 }}>
                        <Text style={[styles.optionText, { color: '#fff', fontWeight: '600' }]}>Open File</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
