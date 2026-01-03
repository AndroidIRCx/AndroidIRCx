import React, { useMemo, useState, useEffect } from 'react';
import { Alert, Modal, View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useSettingsAppearance } from '../../../hooks/useSettingsAppearance';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { layoutService } from '../../../services/LayoutService';
import { settingsService } from '../../../services/SettingsService';
import { RawMessageCategory, RAW_MESSAGE_CATEGORIES, getDefaultRawCategoryVisibility } from '../../../services/IRCService';

interface DisplayUISectionProps {
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
  showRawCommands: boolean;
  onShowRawCommandsChange?: (value: boolean) => void;
  rawCategoryVisibility?: Record<RawMessageCategory, boolean>;
  onRawCategoryVisibilityChange?: (value: Record<RawMessageCategory, boolean>) => void;
  showEncryptionIndicators?: boolean;
  onShowEncryptionIndicatorsChange?: (value: boolean) => void;
}

export const DisplayUISection: React.FC<DisplayUISectionProps> = ({
  colors,
  styles,
  settingIcons,
  showRawCommands: propShowRawCommands,
  onShowRawCommandsChange,
  rawCategoryVisibility: propRawCategoryVisibility,
  onRawCategoryVisibilityChange,
  showEncryptionIndicators: propShowEncryptionIndicators,
  onShowEncryptionIndicatorsChange,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:DisplayUISection.tsx,feature:settings';
  const { layoutConfig, updateLayoutConfig } = useSettingsAppearance();
  
  const [tabSortAlphabetical, setTabSortAlphabetical] = useState(true);
  const [localShowRawCommands, setLocalShowRawCommands] = useState(propShowRawCommands);
  const [localRawCategoryVisibility, setLocalRawCategoryVisibility] = useState<Record<RawMessageCategory, boolean>>(
    propRawCategoryVisibility || getDefaultRawCategoryVisibility()
  );
  const [noticeTarget, setNoticeTarget] = useState<'active' | 'server' | 'notice' | 'private'>('server');
  const [showEncryptionIndicatorsSetting, setShowEncryptionIndicatorsSetting] = useState(propShowEncryptionIndicators ?? true);
  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);

  // Load initial state
  useEffect(() => {
    const loadSettings = async () => {
      const sortTabs = await settingsService.getSetting('tabSortAlphabetical', true);
      setTabSortAlphabetical(sortTabs);
      
      const notice = await settingsService.getSetting('noticeTarget', 'server');
      setNoticeTarget(notice);
      
      const showEncryption = await settingsService.getSetting('showEncryptionIndicators', true);
      setShowEncryptionIndicatorsSetting(showEncryption);
    };
    loadSettings();
  }, []);

  // Sync props with local state
  useEffect(() => {
    setLocalShowRawCommands(propShowRawCommands);
  }, [propShowRawCommands]);

  useEffect(() => {
    if (propRawCategoryVisibility) {
      setLocalRawCategoryVisibility(propRawCategoryVisibility);
    }
  }, [propRawCategoryVisibility]);

  useEffect(() => {
    setShowEncryptionIndicatorsSetting(propShowEncryptionIndicators ?? true);
  }, [propShowEncryptionIndicators]);

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'display-tab-sort',
        title: t('Sort Tabs Alphabetically', { _tags: tags }),
        description: tabSortAlphabetical ? 'Sorting tabs A→Z per network' : 'Keep tabs in join/open order',
        type: 'switch',
        value: tabSortAlphabetical,
        onValueChange: async (value: boolean | string) => {
          setTabSortAlphabetical(value as boolean);
          await settingsService.setSetting('tabSortAlphabetical', value);
        },
      },
      {
        id: 'display-raw',
        title: t('Show Raw Commands', { _tags: tags }),
        description: t('Display raw IRC protocol messages', { _tags: tags }),
        type: 'switch',
        value: localShowRawCommands,
        onValueChange: (value: boolean | string) => {
          const boolValue = value as boolean;
          setLocalShowRawCommands(boolValue);
          if (boolValue) {
            const normalized = {
              ...getDefaultRawCategoryVisibility(),
              ...localRawCategoryVisibility,
            };
            setLocalRawCategoryVisibility(normalized);
            onRawCategoryVisibilityChange?.(normalized);
          }
          onShowRawCommandsChange?.(boolValue);
        },
      },
      {
        id: 'display-raw-categories',
        title: t('Raw Categories', { _tags: tags }),
        description: t('Choose which raw messages are shown', { _tags: tags }),
        type: 'submenu',
        disabled: !localShowRawCommands,
        submenuItems: RAW_MESSAGE_CATEGORIES.map((category) => ({
          id: `raw-category-${category.id}`,
          title: category.title,
          description: category.description,
          type: 'switch' as const,
          value: localRawCategoryVisibility[category.id] !== false,
          onValueChange: (value: boolean | string) => {
            const boolValue = value as boolean;
            setLocalRawCategoryVisibility((prev) => {
              const updated = { ...prev, [category.id]: boolValue };
              onRawCategoryVisibilityChange?.(updated);
              return updated;
            });
          },
        })),
      },
      {
        id: 'display-notices',
        title: t('Notice Routing', { _tags: tags }),
        description: (() => {
          switch (noticeTarget) {
            case 'active':
              return t('Show notices in the active tab', { _tags: tags });
            case 'notice':
              return t('Show notices in a Notices tab', { _tags: tags });
            case 'private':
              return t('Show notices in a private/query tab', { _tags: tags });
            default:
              return t('Show notices in the server tab', { _tags: tags });
          }
        })(),
        type: 'submenu',
        submenuItems: [
          {
            id: 'notice-active',
            title: t('Active window', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              setNoticeTarget('active');
              await settingsService.setSetting('noticeTarget', 'active');
            },
          },
          {
            id: 'notice-server',
            title: t('Server tab', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              setNoticeTarget('server');
              await settingsService.setSetting('noticeTarget', 'server');
            },
          },
          {
            id: 'notice-tab',
            title: t('Notices tab', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              setNoticeTarget('notice');
              await settingsService.setSetting('noticeTarget', 'notice');
            },
          },
          {
            id: 'notice-private',
            title: t('Private/query tab', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              setNoticeTarget('private');
              await settingsService.setSetting('noticeTarget', 'private');
            },
          },
        ],
      },
      {
        id: 'display-timestamps',
        title: t('Show Timestamps', { _tags: tags }),
        description: t('Display message timestamps', { _tags: tags }),
        type: 'switch',
        value: true,
        onValueChange: () => Alert.alert(
          t('Info', { _tags: tags }),
          t('Timestamp display setting coming soon', { _tags: tags })
        ),
      },
      {
        id: 'layout-timestamp-display',
        title: t('Timestamp Display', { _tags: tags }),
        description: t('Show timestamps: {mode}', { mode: layoutConfig?.timestampDisplay || 'grouped', _tags: tags }),
        type: 'button',
        onPress: () => {
          Alert.alert(
            t('Timestamp Display', { _tags: tags }),
            t('Select when to show timestamps:', { _tags: tags }),
            [
              { text: t('Cancel', { _tags: tags }), style: 'cancel' },
              {
                text: t('Always', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setTimestampDisplay('always');
                  updateLayoutConfig({});
                },
              },
              {
                text: t('Only for first message in a group', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setTimestampDisplay('grouped');
                  updateLayoutConfig({});
                },
              },
              {
                text: t('Never', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setTimestampDisplay('never');
                  updateLayoutConfig({});
                },
              },
            ]
          );
        },
      },
      {
        id: 'layout-timestamp-format',
        title: t('Timestamp Format', { _tags: tags }),
        description: t('Format: {format}', { format: layoutConfig?.timestampFormat || '12h', _tags: tags }),
        type: 'button',
        disabled: layoutConfig?.timestampDisplay === 'never',
        onPress: () => {
          Alert.alert(
            t('Timestamp Format', { _tags: tags }),
            t('Select format:', { _tags: tags }),
            [
              { text: t('Cancel', { _tags: tags }), style: 'cancel' },
              {
                text: t('12-hour (AM/PM)', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setTimestampFormat('12h');
                  updateLayoutConfig({});
                },
              },
              {
                text: t('24-hour', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setTimestampFormat('24h');
                  updateLayoutConfig({});
                },
              },
            ]
          );
        },
      },
      {
        id: 'display-encryption-icons',
        title: t('Show Encryption Indicators', { _tags: tags }),
        description: showEncryptionIndicatorsSetting
          ? t('Lock icons visible on tabs/messages', { _tags: tags })
          : t('Hide lock icons', { _tags: tags }),
        type: 'switch',
        value: showEncryptionIndicatorsSetting,
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setShowEncryptionIndicatorsSetting(boolValue);
          await settingsService.setSetting('showEncryptionIndicators', boolValue);
          onShowEncryptionIndicatorsChange && onShowEncryptionIndicatorsChange(boolValue);
        },
      },
    ];

    return items;
  }, [
    tabSortAlphabetical,
    localShowRawCommands,
    localRawCategoryVisibility,
    noticeTarget,
    showEncryptionIndicatorsSetting,
    layoutConfig,
    t,
    tags,
    updateLayoutConfig,
    onShowRawCommandsChange,
    onRawCategoryVisibilityChange,
    onShowEncryptionIndicatorsChange,
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
                    <View key={subItem.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ color: colors.text, fontSize: 15 }}>{subItem.title}</Text>
                        {subItem.description && (
                          <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2, lineHeight: 14 }} numberOfLines={2}>
                            {subItem.description}
                          </Text>
                        )}
                      </View>
                      <Switch
                        value={subItem.value as boolean}
                        onValueChange={(value) => {
                          subItem.onValueChange?.(value);
                        }}
                        disabled={subItem.disabled}
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
                      style={{ paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: subItem.disabled ? 0.5 : 1 }}>
                      <Text style={{ color: subItem.disabled ? colors.textDisabled : colors.text, fontSize: 15 }}>{subItem.title}</Text>
                      {subItem.description && (
                        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2, lineHeight: 14 }} numberOfLines={2}>
                          {subItem.description}
                        </Text>
                      )}
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
