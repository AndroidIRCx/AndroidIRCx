/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Alert, Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { settingsService } from '../../../services/SettingsService';
import { userManagementService, UserNote, UserAlias } from '../../../services/UserManagementService';

interface UsersServicesSectionProps {
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
  };
  settingIcons: Record<string, SettingIcon | undefined>;
  currentNetwork?: string;
  onShowBlacklist?: () => void;
  onShowUserLists?: () => void;
}

export const UsersServicesSection: React.FC<UsersServicesSectionProps> = ({
  colors,
  styles,
  settingIcons,
  currentNetwork,
  onShowBlacklist,
  onShowUserLists,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:UsersServicesSection.tsx,feature:settings';
  
  const [ircServices, setIrcServices] = useState<string[]>([]);
  const [newIrcService, setNewIrcService] = useState('');
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [userAliases, setUserAliases] = useState<UserAlias[]>([]);
  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);

  // Load initial state
  useEffect(() => {
    const loadSettings = async () => {
      const services = await settingsService.getSetting('ircServices', ['nickserv', 'chanserv', 'memoserv', 'operserv', 'hostserv', 'botserv']);
      setIrcServices(services);
      setUserNotes(userManagementService.getUserNotes(currentNetwork));
      setUserAliases(userManagementService.getUserAliases(currentNetwork));
    };
    loadSettings();
  }, [currentNetwork]);

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'irc-services-add',
        title: t('Add Service Nickname', { _tags: tags }),
        description: t('Prevent sending "close query" messages to these nicks.', { _tags: tags }),
        type: 'input',
        value: newIrcService,
        placeholder: t('Enter a service name (e.g., Q)', { _tags: tags }),
        searchKeywords: ['irc', 'services', 'nickserv', 'chanserv', 'memoserv', 'bot', 'service', 'nickname'],
        onValueChange: (value: string | boolean) => setNewIrcService(value as string),
        onPress: async () => {
          if (newIrcService.trim()) {
            const updatedServices = [...ircServices, newIrcService.trim()];
            setIrcServices(updatedServices);
            await settingsService.setSetting('ircServices', updatedServices);
            setNewIrcService('');
          }
        },
      },
      ...ircServices.map(service => ({
        id: `irc-service-${service}`,
        title: service,
        type: 'button' as const,
        onPress: () => {
          Alert.alert(
            'Remove Service',
            `Are you sure you want to remove "${service}"?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                  const updatedServices = ircServices.filter(s => s !== service);
                  setIrcServices(updatedServices);
                  await settingsService.setSetting('ircServices', updatedServices);
                },
              },
            ],
          );
        },
      })),
      {
        id: 'user-blacklist',
        title: t('Blacklist', { _tags: tags }),
        description: t('Auto-run actions for matched masks', { _tags: tags }),
        type: 'button',
        searchKeywords: ['blacklist', 'ban', 'kick', 'kill', 'gline', 'akill', 'shun', 'mask'],
        onPress: () => {
          if (onShowBlacklist) {
            onShowBlacklist();
          } else {
            Alert.alert(
              t('Info', { _tags: tags }),
              t('Blacklist feature coming soon', { _tags: tags })
            );
          }
        },
      },
      {
        id: 'user-lists',
        title: t('User Lists', { _tags: tags }),
        description: t('Manage notify, autoop, autovoice and protected lists', { _tags: tags }),
        type: 'button',
        searchKeywords: ['user', 'lists', 'notify', 'autoop', 'autovoice', 'protected', 'autohalfop', 'watch', 'monitor'],
        onPress: () => {
          if (onShowUserLists) {
            onShowUserLists();
          }
        },
      },
      {
        id: 'user-notes',
        title: t('User Notes', { _tags: tags }),
        description: userNotes.length > 0 ? `${userNotes.length} note${userNotes.length !== 1 ? 's' : ''}` : 'No notes yet',
        type: 'submenu',
        searchKeywords: ['user', 'notes', 'memo', 'annotation', 'comment', 'remember'],
        submenuItems: userNotes.length === 0
          ? [
              {
                id: 'user-notes-empty',
                title: t('No notes saved', { _tags: tags }),
                type: 'button' as const,
                disabled: true,
              },
            ]
          : userNotes.map(note => ({
              id: `user-note-${note.network || 'global'}-${note.nick}`,
              title: `${note.nick} (${note.network || 'global'})`,
              description: note.note,
              type: 'button' as const,
              onPress: () => {
                Alert.alert(
                  'User Note',
                  `${note.nick} @ ${note.network || 'global'}\n\n${note.note}`,
                  [
                    { text: 'Close', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        await userManagementService.removeUserNote(note.nick, note.network || undefined);
                        setUserNotes(userManagementService.getUserNotes(currentNetwork));
                      },
                    },
                  ]
                );
              },
            })),
      },
      {
        id: 'user-aliases',
        title: t('User Aliases', { _tags: tags }),
        description: userAliases.length > 0 ? `${userAliases.length} alias${userAliases.length !== 1 ? 'es' : ''}` : 'No aliases yet',
        type: 'submenu',
        searchKeywords: ['user', 'aliases', 'nickname', 'shortcut', 'mapping', 'alternative'],
        submenuItems: userAliases.length === 0
          ? [
              {
                id: 'user-aliases-empty',
                title: t('No aliases saved', { _tags: tags }),
                type: 'button' as const,
                disabled: true,
              },
            ]
          : userAliases.map(alias => ({
              id: `user-alias-${alias.network || 'global'}-${alias.nick}`,
              title: `${alias.alias} → ${alias.nick}`,
              description: alias.network ? `Network: ${alias.network}` : 'Global',
              type: 'button' as const,
              onPress: () => {
                Alert.alert(
                  'User Alias',
                  `${alias.alias} → ${alias.nick}\nNetwork: ${alias.network || 'global'}`,
                  [
                    { text: 'Close', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        await userManagementService.removeUserAlias(alias.nick, alias.network || undefined);
                        setUserAliases(userManagementService.getUserAliases(currentNetwork));
                      },
                    },
                  ]
                );
              },
            })),
      },
    ];

    return items;
  }, [
    ircServices,
    newIrcService,
    userNotes,
    userAliases,
    currentNetwork,
    onShowBlacklist,
    onShowUserLists,
    t,
    tags,
  ]);

  const handleSubmenuPress = (itemId: string) => {
    const item = sectionData.find(i => i.id === itemId);
    if (item?.type === 'submenu') {
      setShowSubmenu(itemId);
    }
  };

  const currentSubmenuItem = showSubmenu ? sectionData.find(item => item.id === showSubmenu) : null;

  return (
    <>
      {sectionData.map((item) => {
        const itemIcon = (typeof item.icon === 'object' ? item.icon : undefined) || settingIcons[item.id];
        return (
          <SettingItem
            key={item.id}
            item={item}
            icon={itemIcon}
            colors={colors}
            styles={styles}
            onPress={handleSubmenuPress}
          />
        );
      })}
      
      {/* Submenu Modal */}
      <Modal
        visible={showSubmenu !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubmenu(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{currentSubmenuItem?.title || t('Options', { _tags: tags })}</Text>
              <TouchableOpacity onPress={() => setShowSubmenu(null)}>
                <Text style={{ color: colors.primary, fontSize: 16 }}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {currentSubmenuItem?.submenuItems?.map((subItem) => {
                if (subItem.type === 'switch') {
                  return (
                    <View key={subItem.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 16 }}>{subItem.title}</Text>
                        {subItem.description && <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>{subItem.description}</Text>}
                      </View>
                      <SettingItem
                        item={subItem}
                        colors={colors}
                        styles={styles}
                      />
                    </View>
                  );
                }
                if (subItem.type === 'button') {
                  return (
                    <TouchableOpacity
                      key={subItem.id}
                      onPress={() => {
                        subItem.onPress?.();
                        setShowSubmenu(null);
                      }}
                      disabled={subItem.disabled}
                      style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: subItem.disabled ? 0.5 : 1 }}>
                      <Text style={{ color: subItem.disabled ? colors.textDisabled : colors.text, fontSize: 16 }}>{subItem.title}</Text>
                      {subItem.description && <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>{subItem.description}</Text>}
                    </TouchableOpacity>
                  );
                }
                return null;
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};
