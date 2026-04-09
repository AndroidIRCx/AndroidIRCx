/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/transifex';
import {
  SettingItem as SettingItemType,
  SettingIcon,
} from '../../../types/settings';
import {
  commandService,
  CommandAlias,
  CommandHistoryEntry,
  CustomCommand,
} from '../../../services/CommandService';

interface CommandsSectionProps {
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    surface: string;
    border: string;
    background: string;
  };
  styles: {
    settingItem: any;
    settingContent: any;
    settingTitleRow: any;
    settingTitle: any;
    settingDescription: any;
    disabledItem: any;
    disabledText: any;
    chevron: any;
    input?: any;
    disabledInput?: any;
    submenuOverlay?: any;
    submenuContainer?: any;
    submenuHeader?: any;
    submenuTitle?: any;
    submenuItem?: any;
    submenuItemContent?: any;
    submenuItemText?: any;
    submenuItemDescription?: any;
    submenuInput?: any;
    closeButtonText?: any;
  };
  settingIcons: Record<string, SettingIcon | undefined>;
}

export const CommandsSection: React.FC<CommandsSectionProps> = ({
  colors,
  styles,
  settingIcons,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:CommandsSection.tsx,feature:settings';

  const [commandAliases, setCommandAliases] = useState<CommandAlias[]>([]);
  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>(
    [],
  );
  const [newAliasName, setNewAliasName] = useState('');
  const [newAliasCommand, setNewAliasCommand] = useState('');
  const [newCmdName, setNewCmdName] = useState('');
  const [newCmdCommand, setNewCmdCommand] = useState('');

  // Submenu state for CommandsSection items
  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);
  const [submenuRefreshKey, setSubmenuRefreshKey] = useState(0);

  // Load initial state
  useEffect(() => {
    const loadData = () => {
      setCommandAliases(commandService.getAliases());
      setCustomCommands(commandService.getCustomCommands());
      setCommandHistory(commandService.getHistory(20)); // Last 20 commands
    };
    loadData();

    // Refresh when submenu closes (in case data changed)
    if (showSubmenu === null) {
      loadData();
    }
  }, [showSubmenu]);

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'commands-history',
        title: t('Command History', { _tags: tags }),
        description: `${commandHistory.length} commands in history`,
        type: 'submenu',
        searchKeywords: [
          'command',
          'history',
          'past',
          'previous',
          'log',
          'recent',
          'old',
        ],
        submenuItems: [
          ...commandHistory.map(entry => ({
            id: `history-${entry.id}`,
            title: entry.command,
            description: `${new Date(entry.timestamp).toLocaleString()}${entry.channel ? ` · ${entry.channel}` : ''}`,
            type: 'button' as const,
            onPress: () => {
              Alert.alert(
                'Delete Entry',
                `Remove this command?\n\n${entry.command}`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await commandService.deleteHistoryEntry(entry.id);
                      setCommandHistory(commandService.getHistory(20));
                      setSubmenuRefreshKey(prev => prev + 1);
                    },
                  },
                ],
              );
            },
          })),
          {
            id: 'history-clear',
            title: t('Clear All History', { _tags: tags }),
            description: t('Delete every command entry', { _tags: tags }),
            type: 'button' as const,
            onPress: () => {
              Alert.alert(
                t('Clear Command History', { _tags: tags }),
                t('Are you sure you want to delete all command history?', {
                  _tags: tags,
                }),
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete All',
                    style: 'destructive',
                    onPress: async () => {
                      await commandService.clearHistory();
                      setCommandHistory([]);
                      setSubmenuRefreshKey(prev => prev + 1);
                    },
                  },
                ],
              );
            },
          },
        ],
      },
      {
        id: 'commands-aliases',
        title: t('Command Aliases', { _tags: tags }),
        description: `${commandAliases.length} aliases configured`,
        type: 'submenu',
        searchKeywords: [
          'command',
          'aliases',
          'shortcut',
          'macro',
          'abbreviation',
          'quick',
        ],
        submenuItems: [
          {
            id: 'alias-name-input',
            title: t('Alias Name (without /)', { _tags: tags }),
            type: 'input',
            value: newAliasName,
            placeholder: t('e.g. j', { _tags: tags }),
            onValueChange: (value: string | boolean) => {
              setNewAliasName(value as string);
              setSubmenuRefreshKey(prev => prev + 1);
            },
          },
          {
            id: 'alias-command-input',
            title: t('Alias Command', { _tags: tags }),
            description: t('Example: /join {channel}', { _tags: tags }),
            type: 'input',
            value: newAliasCommand,
            placeholder: t('e.g. /join {channel}', { _tags: tags }),
            onValueChange: (value: string | boolean) => {
              setNewAliasCommand(value as string);
              setSubmenuRefreshKey(prev => prev + 1);
            },
          },
          {
            id: 'alias-add',
            title: t('Add Alias', { _tags: tags }),
            description: t('Create or update alias', { _tags: tags }),
            type: 'button',
            onPress: async () => {
              const aliasName = newAliasName.trim().replace(/^\//, '');
              const aliasCmd = newAliasCommand.trim();
              if (!aliasName || !aliasCmd) {
                Alert.alert(
                  t('Error', { _tags: tags }),
                  t('Alias name and command are required', { _tags: tags }),
                );
                return;
              }
              await commandService.addAlias({
                alias: aliasName,
                command: aliasCmd,
                description: '',
              });
              setCommandAliases(commandService.getAliases());
              setNewAliasName('');
              setNewAliasCommand('');
              setSubmenuRefreshKey(prev => prev + 1);
            },
          },
          ...commandAliases.map(alias => ({
            id: `alias-${alias.alias}`,
            title: `/${alias.alias}`,
            description: `${alias.command} - ${alias.description || 'No description'}`,
            type: 'button' as const,
            onPress: () => {
              Alert.alert(
                `Alias: /${alias.alias}`,
                `Command: ${alias.command}\nDescription: ${alias.description || 'No description'}`,
                [
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await commandService.removeAlias(alias.alias);
                      setCommandAliases(commandService.getAliases());
                      setSubmenuRefreshKey(prev => prev + 1);
                    },
                  },
                  { text: 'OK' },
                ],
              );
            },
          })),
        ],
      },
      {
        id: 'commands-custom',
        title: t('Custom Commands', { _tags: tags }),
        description: `${customCommands.length} custom commands`,
        type: 'submenu',
        searchKeywords: [
          'custom',
          'command',
          'template',
          'placeholder',
          'parameter',
          'variable',
        ],
        submenuItems: [
          {
            id: 'custom-name-input',
            title: t('Command Name (without /)', { _tags: tags }),
            type: 'input',
            value: newCmdName,
            placeholder: t('e.g. greet', { _tags: tags }),
            onValueChange: (value: string | boolean) => {
              setNewCmdName(value as string);
              setSubmenuRefreshKey(prev => prev + 1);
            },
          },
          {
            id: 'custom-command-input',
            title: t('Command Template', { _tags: tags }),
            description: t('Use {param1}, {channel}, {nick} placeholders', {
              _tags: tags,
            }),
            type: 'input',
            value: newCmdCommand,
            placeholder: t('e.g. /msg {channel} Hello {param1}', {
              _tags: tags,
            }),
            onValueChange: (value: string | boolean) => {
              setNewCmdCommand(value as string);
              setSubmenuRefreshKey(prev => prev + 1);
            },
          },
          {
            id: 'cmd-add',
            title: t('Add Custom Command', { _tags: tags }),
            description: t('Save template with placeholders', { _tags: tags }),
            type: 'button',
            onPress: async () => {
              const cmdName = newCmdName.trim().replace(/^\//, '');
              const cmdString = newCmdCommand.trim();
              if (!cmdName || !cmdString) {
                Alert.alert(
                  t('Error', { _tags: tags }),
                  t('Command name and template are required', { _tags: tags }),
                );
                return;
              }
              const paramMatches = cmdString.match(/\{(\w+)\}/g);
              const parameters = paramMatches
                ? [...new Set(paramMatches.map(m => m.slice(1, -1)))]
                : [];
              await commandService.addCustomCommand({
                name: cmdName,
                command: cmdString,
                description: '',
                parameters: parameters.length > 0 ? parameters : undefined,
              });
              setCustomCommands(commandService.getCustomCommands());
              setNewCmdName('');
              setNewCmdCommand('');
              setSubmenuRefreshKey(prev => prev + 1);
            },
          },
          ...customCommands.map(cmd => ({
            id: `cmd-${cmd.name}`,
            title: `/${cmd.name}`,
            description: `${cmd.command} - ${cmd.description || 'No description'}`,
            type: 'button' as const,
            onPress: () => {
              Alert.alert(
                `Custom Command: /${cmd.name}`,
                `Command: ${cmd.command}\nDescription: ${cmd.description || 'No description'}\nParameters: ${cmd.parameters?.join(', ') || 'None'}`,
                [
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await commandService.removeCustomCommand(cmd.name);
                      setCustomCommands(commandService.getCustomCommands());
                      setSubmenuRefreshKey(prev => prev + 1);
                    },
                  },
                  { text: 'OK' },
                ],
              );
            },
          })),
        ],
      },
    ];

    return items;
  }, [
    commandHistory,
    commandAliases,
    customCommands,
    newAliasName,
    newAliasCommand,
    newCmdName,
    newCmdCommand,
    t,
    tags,
  ]);

  return (
    <>
      {sectionData.map(item => {
        const itemIcon =
          (typeof item.icon === 'object' ? item.icon : undefined) ||
          settingIcons[item.id];
        return (
          <SettingItem
            key={item.id}
            item={item}
            icon={itemIcon}
            colors={colors}
            styles={styles}
            onPress={itemId => {
              if (item.type === 'submenu') {
                setShowSubmenu(itemId);
              }
            }}
          />
        );
      })}

      {/* Submenu Modal */}
      <Modal
        visible={showSubmenu !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubmenu(null)}
      >
        <View style={styles.submenuOverlay}>
          <View style={styles.submenuContainer}>
            <View style={styles.submenuHeader}>
              <Text style={styles.submenuTitle}>
                {sectionData.find(item => item.id === showSubmenu)?.title ||
                  t('Options', { _tags: tags })}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSubmenu(null);
                }}
              >
                <Text style={styles.closeButtonText}>
                  {t('Close', { _tags: tags })}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView key={`submenu-${showSubmenu}-${submenuRefreshKey}`}>
              {sectionData
                .find(item => item.id === showSubmenu)
                ?.submenuItems?.map(subItem => {
                  if (subItem.type === 'switch') {
                    return (
                      <View key={subItem.id} style={styles.submenuItem}>
                        <View style={styles.submenuItemContent}>
                          <Text style={styles.submenuItemText}>
                            {subItem.title}
                          </Text>
                          {subItem.description && (
                            <Text style={styles.submenuItemDescription}>
                              {subItem.description}
                            </Text>
                          )}
                        </View>
                        <Switch
                          key={`${subItem.id}-${submenuRefreshKey}`}
                          value={subItem.value as boolean}
                          onValueChange={async value => {
                            try {
                              await subItem.onValueChange?.(value);
                              setSubmenuRefreshKey(prev => prev + 1);
                            } catch (error) {
                              console.error('Error updating setting:', error);
                            }
                          }}
                          disabled={subItem.disabled}
                        />
                      </View>
                    );
                  }
                  if (subItem.type === 'input') {
                    return (
                      <View key={subItem.id} style={styles.submenuItem}>
                        <View style={styles.submenuItemContent}>
                          <Text style={styles.submenuItemText}>
                            {subItem.title}
                          </Text>
                          {subItem.description && (
                            <Text style={styles.submenuItemDescription}>
                              {subItem.description}
                            </Text>
                          )}
                          <TextInput
                            key={`${subItem.id}-${submenuRefreshKey}`}
                            style={[
                              styles.submenuInput,
                              subItem.disabled && styles.disabledInput,
                              {
                                backgroundColor: colors.surface,
                                color: colors.text,
                                borderColor: colors.border,
                              },
                            ]}
                            value={subItem.value as string}
                            onChangeText={async text => {
                              try {
                                await subItem.onValueChange?.(text);
                                setSubmenuRefreshKey(prev => prev + 1);
                              } catch (error) {
                                console.error('Error updating setting:', error);
                              }
                            }}
                            placeholder={subItem.placeholder}
                            placeholderTextColor={colors.textSecondary}
                            keyboardType={subItem.keyboardType || 'default'}
                            secureTextEntry={subItem.secureTextEntry}
                            editable={!subItem.disabled}
                          />
                        </View>
                      </View>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={subItem.id}
                      style={styles.submenuItem}
                      onPress={() => {
                        subItem.onPress?.();
                        if (
                          subItem.type !== 'switch' &&
                          subItem.type !== 'input'
                        ) {
                          setShowSubmenu(null);
                          // Refresh data after action
                          setCommandAliases(commandService.getAliases());
                          setCustomCommands(commandService.getCustomCommands());
                          setCommandHistory(commandService.getHistory(20));
                          setSubmenuRefreshKey(prev => prev + 1);
                        }
                      }}
                      disabled={subItem.disabled}
                    >
                      <View style={styles.submenuItemContent}>
                        <Text
                          style={[
                            styles.submenuItemText,
                            subItem.disabled && styles.disabledText,
                          ]}
                        >
                          {subItem.title}
                        </Text>
                        {subItem.description && (
                          <Text
                            style={[
                              styles.submenuItemDescription,
                              subItem.disabled && styles.disabledText,
                            ]}
                          >
                            {subItem.description}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};
