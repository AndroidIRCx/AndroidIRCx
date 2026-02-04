/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * IRC Service Type Selector
 * Allows users to manually select or override auto-detected IRC services
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useT } from '../i18n/transifex';
import { IRCServiceType } from '../interfaces/ServiceTypes';

interface ServiceSelectorProps {
  value: IRCServiceType | 'auto';
  onChange: (value: IRCServiceType | 'auto') => void;
  detectedType?: IRCServiceType | null;
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    surface: string;
    border: string;
    background: string;
  };
  disabled?: boolean;
}

interface ServiceOption {
  value: IRCServiceType | 'auto';
  label: string;
  description: string;
  icon: string;
}

const SERVICE_OPTIONS: ServiceOption[] = [
  {
    value: 'auto',
    label: 'Auto-detect',
    description: 'Automatically detect from server',
    icon: 'radar',
  },
  {
    value: 'anope',
    label: 'Anope',
    description: 'NickServ, ChanServ, HostServ, OperServ, BotServ, MemoServ',
    icon: 'server',
  },
  {
    value: 'atheme',
    label: 'Atheme',
    description: 'NickServ, ChanServ, HostServ, OperServ, GroupServ',
    icon: 'server',
  },
  {
    value: 'dalnet',
    label: 'DALnet',
    description: 'ChanServ, NickServ with xOP system',
    icon: 'server',
  },
  {
    value: 'undernet',
    label: 'Undernet X',
    description: 'X service with level-based access',
    icon: 'alpha-x-circle',
  },
  {
    value: 'quakenet',
    label: 'QuakeNet Q',
    description: 'Q service with CHANLEV flags',
    icon: 'alpha-q-circle',
  },
  {
    value: 'generic',
    label: 'Generic',
    description: 'Basic service support',
    icon: 'server-network',
  },
];

export const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  value,
  onChange,
  detectedType,
  colors,
  disabled = false,
}) => {
  const t = useT();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value);

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  const handleSelect = useCallback((newValue: IRCServiceType | 'auto') => {
    setSelectedValue(newValue);
    onChange(newValue);
    setModalVisible(false);
  }, [onChange]);

  const currentOption = SERVICE_OPTIONS.find(opt => opt.value === selectedValue);

  const getDisplayLabel = () => {
    if (selectedValue === 'auto' && detectedType) {
      return `${t('Auto')} (${detectedType})`;
    }
    return currentOption?.label || t('Auto-detect');
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.container,
          { borderBottomColor: colors.border },
          disabled && styles.disabled,
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}>
        <View style={styles.iconContainer}>
          <Icon
            name="server"
            size={22}
            color={disabled ? colors.textSecondary : colors.primary}
          />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('IRC Service Type')}
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {getDisplayLabel()}
          </Text>
        </View>
        {!disabled && (
          <Icon name="chevron-right" size={24} color={colors.textSecondary} />
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View
          style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.surface },
            ]}>
            {/* Header */}
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: colors.border },
              ]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('Select IRC Service')}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.closeButton, { color: colors.primary }]}>
                  {t('Close')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Options */}
            <ScrollView style={styles.optionsList}>
              {SERVICE_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    { borderBottomColor: colors.border },
                    selectedValue === option.value && {
                      backgroundColor: colors.background,
                    },
                  ]}
                  onPress={() => handleSelect(option.value)}>
                  <Icon
                    name={option.icon}
                    size={24}
                    color={
                      selectedValue === option.value
                        ? colors.primary
                        : colors.textSecondary
                    }
                    style={styles.optionIcon}
                  />
                  <View style={styles.optionContent}>
                    <Text
                      style={[
                        styles.optionTitle,
                        { color: colors.text },
                        selectedValue === option.value && {
                          fontWeight: '600',
                        },
                      ]}>
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.optionDescription,
                        { color: colors.textSecondary },
                      ]}>
                      {option.description}
                    </Text>
                  </View>
                  {selectedValue === option.value && (
                    <Icon name="check" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Detected Banner */}
            {detectedType && (
              <View
                style={[
                  styles.detectedBanner,
                  { backgroundColor: colors.background },
                ]}>
                <Icon name="radar" size={16} color={colors.primary} />
                <Text
                  style={[
                    styles.detectedText,
                    { color: colors.textSecondary },
                  ]}>
                  {t('Detected: {service}', { service: detectedType })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 16,
  },
  optionsList: {
    maxHeight: 400,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  optionIcon: {
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
  },
  optionDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  detectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  detectedText: {
    fontSize: 14,
  },
});
