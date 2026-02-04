/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Service Command Help Panel
 * Displays available IRC service commands with search and quick access
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useT } from '../i18n/transifex';
import { ServiceCommand } from '../interfaces/ServiceTypes';
import { serviceCommandProvider } from '../services/ServiceCommandProvider';

interface ServiceCommandPanelProps {
  visible: boolean;
  onClose: () => void;
  networkId: string;
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    surface: string;
    border: string;
    background: string;
  };
  onExecuteCommand?: (command: string, serviceNick: string) => void;
}

interface GroupedCommands {
  [serviceName: string]: ServiceCommand[];
}

export const ServiceCommandPanel: React.FC<ServiceCommandPanelProps> = ({
  visible,
  onClose,
  networkId,
  colors,
  onExecuteCommand,
}) => {
  const t = useT();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null);

  const commands = useMemo(() => {
    return serviceCommandProvider.getCommands(networkId);
  }, [networkId]);

  const groupedCommands = useMemo(() => {
    const grouped: GroupedCommands = {};
    commands.forEach(({ command, serviceName }) => {
      if (!grouped[serviceName]) {
        grouped[serviceName] = [];
      }
      grouped[serviceName].push(command);
    });
    return grouped;
  }, [commands]);

  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedCommands;
    }

    const query = searchQuery.toLowerCase();
    const filtered: GroupedCommands = {};

    Object.entries(groupedCommands).forEach(([serviceName, cmds]) => {
      const matching = cmds.filter(
        cmd =>
          cmd.name.toLowerCase().includes(query) ||
          cmd.description.toLowerCase().includes(query) ||
          cmd.service.toLowerCase().includes(query) ||
          cmd.completion?.suggestAlias?.toLowerCase().includes(query)
      );
      if (matching.length > 0) {
        filtered[serviceName] = matching;
      }
    });

    return filtered;
  }, [groupedCommands, searchQuery]);

  const serviceNames = useMemo(() => {
    return Object.keys(filteredCommands).sort();
  }, [filteredCommands]);

  const handleExecute = useCallback(
    (command: ServiceCommand, serviceNick: string) => {
      if (onExecuteCommand) {
        onExecuteCommand(command.name, serviceNick);
      }
      onClose();
    },
    [onExecuteCommand, onClose]
  );

  const toggleCommandExpand = useCallback((commandId: string) => {
    setExpandedCommand(prev => (prev === commandId ? null : commandId));
  }, []);

  const renderCommand = (
    command: ServiceCommand,
    serviceNick: string,
    serviceName: string
  ) => {
    const commandId = `${serviceName}-${command.name}`;
    const isExpanded = expandedCommand === commandId;
    const hasAlias = command.completion?.suggestAlias;

    return (
      <TouchableOpacity
        key={commandId}
        style={[
          styles.commandItem,
          { borderBottomColor: colors.border },
          isExpanded && { backgroundColor: colors.background },
        ]}
        onPress={() => toggleCommandExpand(commandId)}>
        <View style={styles.commandHeader}>
          <View style={styles.commandTitleRow}>
            <Text style={[styles.commandName, { color: colors.primary }]}>
              {command.name}
            </Text>
            {hasAlias && (
              <View
                style={[
                  styles.aliasBadge,
                  { backgroundColor: colors.background },
                ]}>
                <Text
                  style={[styles.aliasText, { color: colors.textSecondary }]}>
                  /{hasAlias}
                </Text>
              </View>
            )}
          </View>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textSecondary}
          />
        </View>

        <Text
          style={[styles.commandDescription, { color: colors.textSecondary }]}>
          {command.description}
        </Text>

        {isExpanded && (
          <View style={styles.commandDetails}>
            <View style={styles.detailRow}>
              <Icon
                name="format-list-bulleted"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={[styles.detailText, { color: colors.text }]}>
                <Text style={{ fontWeight: '600' }}>{t('Usage')}:</Text>{' '}
                {command.usage}
              </Text>
            </View>

            {command.example && (
              <View style={styles.detailRow}>
                <Icon
                  name="lightbulb-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={[styles.detailText, { color: colors.text }]}>
                  <Text style={{ fontWeight: '600' }}>{t('Example')}:</Text>{' '}
                  {command.example}
                </Text>
              </View>
            )}

            {command.parameters.length > 0 && (
              <View style={styles.detailRow}>
                <Icon
                  name="code-tags"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={[styles.detailText, { color: colors.text }]}>
                  <Text style={{ fontWeight: '600' }}>{t('Parameters')}:</Text>{' '}
                  {command.parameters
                    .map(p => `${p.name}${p.required ? '' : '?'}`)
                    .join(', ')}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.executeButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={() => handleExecute(command, serviceNick)}>
              <Icon name="send" size={16} color="#FFFFFF" />
              <Text style={styles.executeButtonText}>
                {t('Execute')} {serviceNick} {command.name}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('IRC Service Commands')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View
            style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
            <Icon name="magnify" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('Search commands...')}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Service Filter */}
          {serviceNames.length > 1 && !searchQuery && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[
                styles.filterContainer,
                { borderBottomColor: colors.border },
              ]}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.background },
                  selectedService === null && {
                    backgroundColor: colors.primary,
                  },
                ]}
                onPress={() => setSelectedService(null)}>
                <Text
                  style={[
                    styles.filterText,
                    { color: selectedService === null ? '#FFF' : colors.text },
                  ]}>
                  {t('All')}
                </Text>
              </TouchableOpacity>
              {serviceNames.map(name => (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.background },
                    selectedService === name && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                  onPress={() => setSelectedService(name)}>
                  <Text
                    style={[
                      styles.filterText,
                      {
                        color:
                          selectedService === name ? '#FFF' : colors.text,
                      },
                    ]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Commands List */}
          <ScrollView style={styles.commandsList}>
            {serviceNames.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon
                  name="server-off"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchQuery
                    ? t('No commands found')
                    : t('No service commands available')}
                </Text>
              </View>
            ) : (
              serviceNames
                .filter(name => !selectedService || name === selectedService)
                .map(serviceName => {
                  const serviceCommands = filteredCommands[serviceName];
                  const serviceNick = serviceCommands[0]?.service || serviceName;

                  return (
                    <View
                      key={serviceName}
                      style={[
                        styles.serviceSection,
                        { borderBottomColor: colors.border },
                      ]}>
                      <View
                        style={[
                          styles.serviceHeader,
                          { backgroundColor: colors.background },
                        ]}>
                        <Icon
                          name="server"
                          size={18}
                          color={colors.primary}
                        />
                        <Text
                          style={[
                            styles.serviceName,
                            { color: colors.text },
                          ]}>
                          {serviceNick}
                        </Text>
                        <Text
                          style={[
                            styles.commandCount,
                            { color: colors.textSecondary },
                          ]}>
                          {serviceCommands.length} {t('commands')}
                        </Text>
                      </View>
                      {serviceCommands.map(cmd =>
                        renderCommand(cmd, serviceNick, serviceName)
                      )}
                    </View>
                  );
                })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  filterContainer: {
    maxHeight: 60,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  commandsList: {
    maxHeight: 500,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  serviceSection: {
    borderBottomWidth: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  commandCount: {
    fontSize: 13,
  },
  commandItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  commandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commandName: {
    fontSize: 15,
    fontWeight: '600',
  },
  aliasBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aliasText: {
    fontSize: 12,
  },
  commandDescription: {
    fontSize: 13,
    marginTop: 4,
  },
  commandDetails: {
    marginTop: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
    flexWrap: 'wrap',
  },
  executeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  executeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
