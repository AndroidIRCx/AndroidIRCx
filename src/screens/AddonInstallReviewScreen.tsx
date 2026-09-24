/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ModalSafeArea } from '../components/ModalSafeArea';
import { useTheme } from '../hooks/useTheme';
import type { AddonInstallReview } from '../services/scripting/AddonInstallReview';

interface Props {
  visible: boolean;
  review: AddonInstallReview;
  onClose: () => void;
  onConfirm: () => void;
}

export const AddonInstallReviewScreen: React.FC<Props> = ({
  visible,
  review,
  onClose,
  onConfirm,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Review addon</Text>
          <TouchableOpacity accessibilityRole="button" onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.name}>{review.manifest.name}</Text>
          <Text style={styles.meta}>
            {review.manifest.id} · {review.manifest.version}
          </Text>
          <Text style={styles.meta}>By {review.manifest.author}</Text>
          <Text style={styles.description}>{review.manifest.description}</Text>

          <View style={styles.signatureBox}>
            <Text style={styles.label}>Signature</Text>
            <Text style={styles.value}>{review.signatureStatus}</Text>
          </View>

          {review.blockers.map(blocker => (
            <View key={blocker} style={styles.blocker}>
              <Text style={styles.blockerText}>{blocker}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Requested permissions</Text>
          {review.permissions.length === 0 ? (
            <Text style={styles.meta}>This addon requests no permissions.</Text>
          ) : (
            review.permissions.map(permission => (
              <View key={permission.capability} style={styles.permission}>
                <View style={styles.permissionHeader}>
                  <Text style={styles.permissionTitle}>{permission.title}</Text>
                  <Text style={styles.risk}>
                    {permission.risk.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.capability}>{permission.capability}</Text>
                <Text style={styles.description}>{permission.disclosure}</Text>
                {permission.isNew ? (
                  <Text style={styles.newPermission}>NEW PERMISSION</Text>
                ) : null}
                {!permission.persistentGrantAllowed ? (
                  <Text style={styles.sessionOnly}>
                    Approval is session-only.
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: !review.canInstall }}
            disabled={!review.canInstall}
            style={[
              styles.installButton,
              !review.canInstall && styles.disabledButton,
            ]}
            onPress={onConfirm}
          >
            <Text style={styles.installText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ModalSafeArea>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
    close: { color: colors.primary, fontSize: 16 },
    content: { padding: 16, gap: 10 },
    name: { color: colors.text, fontSize: 22, fontWeight: '700' },
    meta: { color: colors.textSecondary },
    description: { color: colors.text, lineHeight: 20 },
    signatureBox: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: { color: colors.textSecondary, fontSize: 12 },
    value: { color: colors.text, fontWeight: '600' },
    blocker: {
      padding: 12,
      borderRadius: 8,
      borderLeftWidth: 4,
      borderLeftColor: colors.error,
      backgroundColor: colors.surface,
    },
    blockerText: { color: colors.error, fontWeight: '600' },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      marginTop: 8,
    },
    permission: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    permissionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    permissionTitle: { color: colors.text, fontWeight: '600', flex: 1 },
    risk: { color: colors.warning, fontSize: 11, fontWeight: '700' },
    capability: {
      color: colors.textSecondary,
      fontFamily: 'monospace',
      fontSize: 12,
    },
    newPermission: { color: colors.warning, fontSize: 12, fontWeight: '700' },
    sessionOnly: { color: colors.warning, fontSize: 12 },
    actions: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    cancelButton: {
      flex: 1,
      alignItems: 'center',
      padding: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: { color: colors.text },
    installButton: {
      flex: 1,
      alignItems: 'center',
      padding: 14,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    disabledButton: { opacity: 0.4 },
    installText: { color: '#fff', fontWeight: '700' },
  });
