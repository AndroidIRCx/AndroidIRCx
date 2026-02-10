/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useT } from '../../i18n/transifex';

interface HelpScreenBaseProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const HelpScreenBase: React.FC<HelpScreenBaseProps> = ({
  visible,
  onClose,
  title,
  children,
}) => {
  const { colors } = useTheme();
  const t = useT();

  const styles = StyleSheet.create({
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
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    sectionSubtitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    paragraph: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginBottom: 8,
    },
    bulletPoint: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginLeft: 16,
      marginBottom: 4,
    },
    codeBlock: {
      backgroundColor: colors.messageBackground,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    codeText: {
      fontSize: 13,
      fontFamily: 'monospace',
      color: colors.text,
    },
    infoBox: {
      backgroundColor: colors.primary + '15',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    warningBox: {
      backgroundColor: '#ff9800' + '15',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      borderLeftWidth: 3,
      borderLeftColor: '#ff9800',
    },
    successBox: {
      backgroundColor: '#4caf50' + '15',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      borderLeftWidth: 3,
      borderLeftColor: '#4caf50',
    },
    boxText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close help screen">
            <Text style={styles.closeButton}>{t('Close')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={true}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
};

// Reusable components for help content
export const HelpSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
  });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
};

export const HelpSubsection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    sectionSubtitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
  });

  return (
    <View>
      <Text style={styles.sectionSubtitle}>{title}</Text>
      {children}
    </View>
  );
};

export const HelpParagraph: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    paragraph: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginBottom: 8,
    },
  });

  return <Text style={styles.paragraph}>{children}</Text>;
};

export const HelpBullet: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    bulletPoint: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      marginLeft: 16,
      marginBottom: 4,
    },
  });

  return <Text style={styles.bulletPoint}>• {children}</Text>;
};

export const HelpCode: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    codeBlock: {
      backgroundColor: colors.messageBackground,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    codeText: {
      fontSize: 13,
      fontFamily: 'monospace',
      color: colors.text,
    },
  });

  return (
    <View style={styles.codeBlock}>
      <Text style={styles.codeText}>{children}</Text>
    </View>
  );
};

export const HelpInfoBox: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    infoBox: {
      backgroundColor: colors.primary + '15',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    boxText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
  });

  return (
    <View style={styles.infoBox}>
      <Text style={styles.boxText}>{children}</Text>
    </View>
  );
};

export const HelpWarningBox: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    warningBox: {
      backgroundColor: '#ff9800' + '15',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      borderLeftWidth: 3,
      borderLeftColor: '#ff9800',
    },
    boxText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
  });

  return (
    <View style={styles.warningBox}>
      <Text style={styles.boxText}>{children}</Text>
    </View>
  );
};

export const HelpSuccessBox: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    successBox: {
      backgroundColor: '#4caf50' + '15',
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      borderLeftWidth: 3,
      borderLeftColor: '#4caf50',
    },
    boxText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
  });

  return (
    <View style={styles.successBox}>
      <Text style={styles.boxText}>{children}</Text>
    </View>
  );
};
