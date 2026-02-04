/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
*/

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../hooks/useTheme';
import { useT } from '../i18n/transifex';
import { APP_VERSION } from '../config/appVersion';

interface AboutScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const socialLinks = [
    { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/androidircx/', icon: 'instagram', brand: true },
    { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/androidircx', icon: 'facebook', brand: true },
    { id: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@androidircx', icon: 'tiktok', brand: true },
    { id: 'x', label: 'X', url: 'https://x.com/AndroidIRCx', icon: 'twitter', brand: true },
    { id: 'reddit', label: 'Reddit', url: 'https://www.reddit.com/r/AndroidIRCx/', icon: 'reddit-alien', brand: true },
    { id: 'telegram', label: 'Telegram', url: 'https://t.me/androidircx', icon: 'telegram', brand: true },
    { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/androidircx', icon: 'linkedin', brand: true },
    { id: 'mastodon', label: 'Mastodon', url: 'https://mastodon.social/@androidircx', icon: 'mastodon', brand: true },
    { id: 'devto', label: 'Dev.to', url: 'https://dev.to/androidircx', icon: 'dev', brand: true },
    { id: 'coderlegion', label: 'CoderLegion', url: 'https://coderlegion.com/user/AndroidIRCx', icon: 'code', solid: true },
  ];

  const handleOpenURL = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('About')}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>{t('Close')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/favicon600.png')}
            style={styles.logo}
            resizeMode="contain"
          />

        </View>
        <View style={styles.section}>
          <Text style={styles.appName}>AndroidIRCX</Text>
          <Text style={styles.version}>{t('Version {version}', { version: APP_VERSION })}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>{t('Made by')}</Text>
          <TouchableOpacity onPress={() => handleOpenURL('https://majstorov.info/en/about')}>
            <Text style={[styles.value, styles.link]}>Velimir Majstorov</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>{t('Network')}</Text>
          <Text style={styles.value}>irc.DBase.in.rs - IRC Database Network</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>{t('IRC Database')}</Text>
          <TouchableOpacity onPress={() => handleOpenURL('https://irc.dbase.in.rs')}>
            <Text style={[styles.value, styles.link]}>https://irc.dbase.in.rs</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>{t('IRC Nick')}</Text>
          <Text style={styles.value}>munZe</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>{t('Contact')}</Text>
          <TouchableOpacity onPress={() => handleOpenURL('mailto:contact@androidircx.com')}>
            <Text style={[styles.value, styles.link]}>contact@androidircx.com</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('AndroidIRCX Website')}</Text>
          <TouchableOpacity onPress={() => handleOpenURL('https://androidircx.com')}>
            <Text style={[styles.value, styles.link]}>https://androidircx.com</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('AndroidIRCX Github')}</Text>
          <TouchableOpacity onPress={() => handleOpenURL('https://github.com/AndroidIRCx/AndroidIRCx')}>
            <Text style={[styles.value, styles.link]}>https://github.com/AndroidIRCx/AndroidIRCx</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>{t('Socials')}</Text>
          <View style={styles.socialList}>
            {socialLinks.map((link) => (
              <TouchableOpacity
                key={link.id}
                style={styles.socialItem}
                onPress={() => handleOpenURL(link.url)}>
                <Icon
                  name={link.icon}
                  size={18}
                  color={colors.buttonPrimary || colors.primary || colors.text}
                  brand={link.brand}
                  solid={link.solid}
                  style={styles.socialIcon}
                />
                <Text style={[styles.value, styles.link]}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E0E0E0',
    backgroundColor: colors.surface || '#F5F5F5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text || '#212121',
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeButtonText: {
    color: colors.buttonPrimary || '#2196F3',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 150,
  },
  section: {
    width: '100%',
    marginBottom: 24,
    alignItems: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text || '#212121',
    marginBottom: 8,
  },
  version: {
    fontSize: 16,
    color: colors.textSecondary || '#757575',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary || '#757575',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
    color: colors.text || '#212121',
    textAlign: 'center',
  },
  link: {
    color: colors.buttonPrimary || '#2196F3',
    textDecorationLine: 'underline',
  },
  socialList: {
    width: '100%',
    alignItems: 'center',
  },
  socialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  socialIcon: {
    marginRight: 10,
  },
});

