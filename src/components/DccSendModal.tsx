import React, { useState } from 'react';
import { Modal, TouchableOpacity, View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { pick, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';

interface DccSendModalProps {
  visible: boolean;
  onClose: () => void;
  targetNick: string;
  filePath: string;
  onChangeFilePath: (path: string) => void;
  onSend: () => Promise<void>;
  styles: any;
}

export const DccSendModal: React.FC<DccSendModalProps> = ({
  visible,
  onClose,
  targetNick,
  filePath,
  onChangeFilePath,
  onSend,
  styles,
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [isPicking, setIsPicking] = useState(false);

  const handleBrowse = async () => {
    if (isPicking) return;
    setIsPicking(true);

    try {
      const [result] = await pick({
        copyTo: 'documentDirectory',
      });

      if (result?.uri) {
        console.log('[DccSendModal] Pick result:', JSON.stringify(result, null, 2));

        let localFilePath: string;
        const pickerFileName = result.name || `file_${Date.now()}`;

        // Check if we have a fileCopyUri (from copyTo: 'documentDirectory')
        if (result.fileCopyUri) {
          // Use the copied file path
          const uri = result.fileCopyUri;
          localFilePath = uri.startsWith('file://') ? uri.substring(7) : uri;
          console.log('[DccSendModal] Using fileCopyUri:', localFilePath);
        } else if (result.uri.startsWith('content://')) {
          // Content URI - need to manually copy the file
          console.log('[DccSendModal] Content URI detected, copying file manually');
          localFilePath = `${RNFS.DocumentDirectoryPath}/${pickerFileName}`;

          try {
            // Try copyFile first
            await RNFS.copyFile(result.uri, localFilePath);
            console.log('[DccSendModal] File copied via copyFile');
          } catch (copyError) {
            console.warn('[DccSendModal] copyFile failed, trying readFile/writeFile:', copyError);
            try {
              // Alternative: read as base64 and write
              const content = await RNFS.readFile(result.uri, 'base64');
              await RNFS.writeFile(localFilePath, content, 'base64');
              console.log('[DccSendModal] File copied via readFile/writeFile');
            } catch (rwError) {
              console.error('[DccSendModal] Failed to copy content URI:', rwError);
              Alert.alert('Error', 'Could not access the selected file. Please try a different file.');
              return;
            }
          }
        } else {
          // Regular file:// URI
          const uri = result.uri;
          localFilePath = uri.startsWith('file://') ? uri.substring(7) : uri;
          console.log('[DccSendModal] Using file URI:', localFilePath);
        }

        // URL decode the path (handles %20 and other encoded characters)
        try {
          localFilePath = decodeURIComponent(localFilePath);
        } catch (e) {
          console.warn('[DccSendModal] Failed to decode URI:', e);
        }

        console.log('[DccSendModal] Final path:', localFilePath);

        // Verify file exists before accepting it
        try {
          const exists = await RNFS.exists(localFilePath);
          if (!exists) {
            console.error('[DccSendModal] File does not exist:', localFilePath);
            Alert.alert('Error', 'Could not access the selected file. Please try again.');
            return;
          }

          // Also verify we can read the file stats
          const stat = await RNFS.stat(localFilePath);
          console.log('[DccSendModal] File verified - size:', stat.size);
        } catch (verifyError: any) {
          console.error('[DccSendModal] Error verifying file:', verifyError);
          Alert.alert('Error', 'Could not verify file access: ' + (verifyError?.message || 'Unknown error'));
          return;
        }

        onChangeFilePath(localFilePath);
        setFileName(pickerFileName);
      }
    } catch (error: any) {
      // User cancelled - this is normal, don't show error
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        // User cancelled, do nothing
        return;
      }
      // Only show alert for actual errors
      console.error('[DccSendModal] Error picking file:', error);
      Alert.alert('Error', 'Failed to select file: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsPicking(false);
    }
  };

  const handleSend = async () => {
    if (!filePath) {
      Alert.alert('No file selected', 'Please select a file to send');
      return;
    }
    await onSend();
  };

  // Clean up copied file when modal is closed without sending
  const cleanupCopiedFile = async (path: string) => {
    try {
      // Only delete if the file is in app's directories (cache or documents)
      const isInAppDir = path && (
        path.includes(RNFS.CachesDirectoryPath) ||
        path.includes(RNFS.DocumentDirectoryPath) ||
        path.includes('/cache/') ||
        path.includes('/Cache/') ||
        path.includes('/files/')
      );

      if (isInAppDir) {
        const exists = await RNFS.exists(path);
        if (exists) {
          await RNFS.unlink(path);
          console.log('[DccSendModal] Cleaned up copied file:', path);
        }
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn('[DccSendModal] Failed to clean up copied file:', error);
    }
  };

  const handleClose = () => {
    // Clean up copied file if modal is closed without sending
    if (filePath) {
      cleanupCopiedFile(filePath);
    }
    setFileName('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}>
      <TouchableOpacity style={styles.modalOverlay} onPress={handleClose} activeOpacity={1}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Send File to {targetNick}</Text>

          {/* File picker section */}
          <View style={localStyles.filePickerContainer}>
            <TouchableOpacity
              style={[localStyles.browseButton, isPicking && localStyles.browseButtonDisabled]}
              onPress={handleBrowse}
              disabled={isPicking}>
              <Text style={localStyles.browseButtonText}>
                {isPicking ? 'Selecting...' : 'Browse Files'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Selected file display */}
          {fileName ? (
            <View style={localStyles.selectedFileContainer}>
              <Text style={localStyles.selectedFileLabel}>Selected:</Text>
              <Text style={localStyles.selectedFileName} numberOfLines={2}>
                {fileName}
              </Text>
            </View>
          ) : (
            <Text style={localStyles.noFileText}>No file selected</Text>
          )}

          {/* Hidden text input for manual path entry (advanced users) */}
          <TextInput
            style={[styles.modalInput, localStyles.hiddenInput]}
            placeholder="Or enter file path manually"
            value={filePath}
            onChangeText={(text) => {
              onChangeFilePath(text);
              setFileName(text.split('/').pop() || '');
            }}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={handleClose}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonJoin, !filePath && localStyles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!filePath}>
              <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const localStyles = StyleSheet.create({
  filePickerContainer: {
    marginBottom: 12,
  },
  browseButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  browseButtonDisabled: {
    backgroundColor: '#999',
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedFileContainer: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  selectedFileLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  selectedFileName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  noFileText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  hiddenInput: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.7,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
