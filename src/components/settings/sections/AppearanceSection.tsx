import React, { useMemo, useState, useEffect } from 'react';
import { Alert, Modal, View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useSettingsAppearance } from '../../../hooks/useSettingsAppearance';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { themeService, Theme } from '../../../services/ThemeService';
import { layoutService } from '../../../services/LayoutService';
import { settingsService } from '../../../services/SettingsService';
import { applyTransifexLocale } from '../../../i18n/transifex';
import { SUPPORTED_LOCALES } from '../../../i18n/config';

interface AppearanceSectionProps {
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
  onShowThemeEditor: (theme?: Theme) => void;
  languageLabels: Record<string, string>;
}

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  colors,
  styles,
  settingIcons,
  onShowThemeEditor,
  languageLabels,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:AppearanceSection.tsx,feature:settings';
  const {
    currentTheme,
    availableThemes,
    layoutConfig,
    appLanguage,
    refreshThemes,
    setAppLanguage: setAppLanguageFromHook,
    updateLayoutConfig,
  } = useSettingsAppearance();
  
  const [showHeaderSearchButton, setShowHeaderSearchButton] = useState(true);
  const [showMessageAreaSearchButton, setShowMessageAreaSearchButton] = useState(true);
  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const enabled = await settingsService.getSetting('showHeaderSearchButton', true);
      setShowHeaderSearchButton(enabled);
      const messageAreaEnabled = await settingsService.getSetting('showMessageAreaSearchButton', false);
      setShowMessageAreaSearchButton(messageAreaEnabled);
    };
    loadSettings();

    const unsubscribe = settingsService.onSettingChange<boolean>('showHeaderSearchButton', (value) => {
      setShowHeaderSearchButton(Boolean(value));
    });
    const unsubscribeMessageArea = settingsService.onSettingChange<boolean>('showMessageAreaSearchButton', (value) => {
      setShowMessageAreaSearchButton(Boolean(value));
    });

    return () => {
      unsubscribe && unsubscribe();
      unsubscribeMessageArea && unsubscribeMessageArea();
    };
  }, []);

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'display-theme',
        title: t('Theme', { _tags: tags }),
        description: currentTheme.name,
        type: 'submenu',
        searchKeywords: ['theme', 'color', 'dark', 'light', 'custom', 'appearance', 'style'],
        submenuItems: [
          ...availableThemes.map(theme => ({
            id: `theme-${theme.id}`,
            title: theme.name,
            description: theme.isCustom
              ? t('Custom theme', { _tags: tags })
              : theme.id === 'dark'
                ? t('Dark mode (default)', { _tags: tags })
                : t('Light mode', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await themeService.setTheme(theme.id);
              refreshThemes();
            },
          })),
          {
            id: 'theme-new',
            title: t('+ Create New Theme', { _tags: tags }),
            type: 'button' as const,
            onPress: () => {
              onShowThemeEditor(undefined);
            },
          },
          ...availableThemes.filter(t => t.isCustom).map(theme => ({
            id: `theme-edit-${theme.id}`,
            title: t('Edit {name}', { name: theme.name, _tags: tags }),
            type: 'button' as const,
            onPress: () => {
              onShowThemeEditor(theme);
            },
          })),
          ...availableThemes.filter(t => t.isCustom).map(theme => ({
            id: `theme-delete-${theme.id}`,
            title: t('Delete {name}', { name: theme.name, _tags: tags }),
            type: 'button' as const,
            onPress: () => {
              Alert.alert(
                t('Delete Theme', { _tags: tags }),
                t('Are you sure you want to delete "{name}"?', { name: theme.name, _tags: tags }),
                [
                  { text: t('Cancel', { _tags: tags }), style: 'cancel' },
                  {
                    text: t('Delete', { _tags: tags }),
                    style: 'destructive',
                    onPress: async () => {
                      await themeService.deleteCustomTheme(theme.id);
                      refreshThemes();
                    },
                  },
                ]
              );
            },
          })),
        ],
      },
      {
        id: 'app-language',
        title: t('Language', { _tags: tags }),
        description:
          appLanguage === 'system'
            ? t('System Default', { _tags: tags })
            : languageLabels[appLanguage] || appLanguage,
        type: 'submenu',
        searchKeywords: ['language', 'locale', 'translation', 'i18n', 'internationalization'],
        submenuItems: [
          {
            id: 'language-system',
            title: t('System Default', { _tags: tags }),
            description: t('Use device language', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await setAppLanguageFromHook('system');
              await applyTransifexLocale('system');
            },
          },
          ...SUPPORTED_LOCALES.map(locale => ({
            id: `language-${locale}`,
            title: languageLabels[locale] || locale,
            description: locale,
            type: 'button' as const,
            onPress: async () => {
              await setAppLanguageFromHook(locale);
              await applyTransifexLocale(locale);
            },
          })),
        ],
      },
      {
        id: 'layout-tab-position',
        title: t('Tab Position', { _tags: tags }),
        description: t('Tabs at {position}', { position: layoutConfig?.tabPosition || 'top', _tags: tags }),
        type: 'submenu',
        searchKeywords: ['tab', 'position', 'layout', 'top', 'bottom', 'left', 'right', 'location'],
        submenuItems: [
          {
            id: 'layout-tab-position-top',
            title: t('Top', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setTabPosition('top');
              updateLayoutConfig({});
            },
          },
          {
            id: 'layout-tab-position-bottom',
            title: t('Bottom', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setTabPosition('bottom');
              updateLayoutConfig({});
            },
          },
          {
            id: 'layout-tab-position-left',
            title: t('Left', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setTabPosition('left');
              updateLayoutConfig({});
            },
          },
          {
            id: 'layout-tab-position-right',
            title: t('Right', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setTabPosition('right');
              updateLayoutConfig({});
            },
          },
        ],
      },
      {
        id: 'layout-userlist-position',
        title: t('User List Position', { _tags: tags }),
        description: t('User list at {position}', { position: layoutConfig?.userListPosition || 'right', _tags: tags }),
        type: 'button',
        searchKeywords: ['userlist', 'nicklist', 'position', 'layout', 'left', 'right', 'top', 'bottom', 'users'],
        onPress: () => {
          Alert.alert(
            t('User List Position', { _tags: tags }),
            t('Select user list position:', { _tags: tags }),
            [
              { text: t('Cancel', { _tags: tags }), style: 'cancel' },
              {
                text: t('Left', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setUserListPosition('left');
                  updateLayoutConfig({});
                },
              },
              {
                text: t('Right', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setUserListPosition('right');
                  updateLayoutConfig({});
                },
              },
              {
                text: t('Top', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setUserListPosition('top');
                  updateLayoutConfig({});
                },
              },
              {
                text: t('Bottom', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setUserListPosition('bottom');
                  updateLayoutConfig({});
                },
              },
            ]
          );
        },
      },
      {
        id: 'layout-view-mode',
        title: t('View Mode', { _tags: tags }),
        description: t('Current: {mode}', { mode: layoutConfig?.viewMode || 'comfortable', _tags: tags }),
        type: 'button',
        searchKeywords: ['view', 'mode', 'compact', 'comfortable', 'spacious', 'density', 'display'],
        onPress: () => {
          Alert.alert(
            t('View Mode', { _tags: tags }),
            t('Select view mode:', { _tags: tags }),
            [
              { text: t('Cancel', { _tags: tags }), style: 'cancel' },
              {
                text: t('Compact', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setViewMode('compact');
                  updateLayoutConfig({});
                },
              },
              {
                text: t('Comfortable', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setViewMode('comfortable');
                  updateLayoutConfig({});
                },
              },
              {
                text: t('Spacious', { _tags: tags }),
                onPress: async () => {
                  await layoutService.setViewMode('spacious');
                  updateLayoutConfig({});
                },
              },
            ]
          );
        },
      },
      {
        id: 'layout-font-size',
        title: t('Font Size', { _tags: tags }),
        description: t('Current: {size} ({px}px)', {
          size: layoutConfig?.fontSize || 'medium',
          px: (layoutConfig?.fontSizeValues || { small: 12, medium: 14, large: 16, custom: 18 })[
            layoutConfig?.fontSize || 'medium'
          ],
          _tags: tags,
        }),
        type: 'submenu',
        searchKeywords: ['font', 'size', 'text', 'small', 'medium', 'large', 'custom'],
        submenuItems: [
          {
            id: 'font-size-small',
            title: t('Use Small', { _tags: tags }),
            description: `${layoutConfig?.fontSizeValues?.small ?? 12}px`,
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setFontSize('small');
              updateLayoutConfig({});
            },
          },
          {
            id: 'font-size-medium',
            title: t('Use Medium', { _tags: tags }),
            description: `${layoutConfig?.fontSizeValues?.medium ?? 14}px`,
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setFontSize('medium');
              updateLayoutConfig({});
            },
          },
          {
            id: 'font-size-large',
            title: t('Use Large', { _tags: tags }),
            description: `${layoutConfig?.fontSizeValues?.large ?? 16}px`,
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setFontSize('large');
              updateLayoutConfig({});
            },
          },
          {
            id: 'font-size-custom',
            title: t('Use Specified', { _tags: tags }),
            description: `${layoutConfig?.fontSizeValues?.custom ?? 18}px`,
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setFontSize('custom');
              updateLayoutConfig({});
            },
          },
          {
            id: 'font-size-value-small',
            title: t('Small Size (px)', { _tags: tags }),
            type: 'input' as const,
            value: (layoutConfig?.fontSizeValues?.small ?? 12).toString(),
            keyboardType: 'numeric',
            onValueChange: async (value: string | boolean) => {
              const nextValue = parseInt(value as string, 10);
              if (!isNaN(nextValue)) {
                await layoutService.setFontSizeValue('small', nextValue);
                updateLayoutConfig({});
              }
            },
          },
          {
            id: 'font-size-value-medium',
            title: t('Medium Size (px)', { _tags: tags }),
            type: 'input' as const,
            value: (layoutConfig?.fontSizeValues?.medium ?? 14).toString(),
            keyboardType: 'numeric',
            onValueChange: async (value: string | boolean) => {
              const nextValue = parseInt(value as string, 10);
              if (!isNaN(nextValue)) {
                await layoutService.setFontSizeValue('medium', nextValue);
                updateLayoutConfig({});
              }
            },
          },
          {
            id: 'font-size-value-large',
            title: t('Large Size (px)', { _tags: tags }),
            type: 'input' as const,
            value: (layoutConfig?.fontSizeValues?.large ?? 16).toString(),
            keyboardType: 'numeric',
            onValueChange: async (value: string | boolean) => {
              const nextValue = parseInt(value as string, 10);
              if (!isNaN(nextValue)) {
                await layoutService.setFontSizeValue('large', nextValue);
                updateLayoutConfig({});
              }
            },
          },
          {
            id: 'font-size-value-custom',
            title: t('Specified Size (px)', { _tags: tags }),
            type: 'input' as const,
            value: (layoutConfig?.fontSizeValues?.custom ?? 18).toString(),
            keyboardType: 'numeric',
            onValueChange: async (value: string | boolean) => {
              const nextValue = parseInt(value as string, 10);
              if (!isNaN(nextValue)) {
                await layoutService.setFontSizeValue('custom', nextValue);
                updateLayoutConfig({});
              }
            },
          },
        ],
      },
      {
        id: 'header-search-button',
        title: t('Show Header Search', { _tags: tags }),
        description: showHeaderSearchButton
          ? t('Search icon visible in the header', { _tags: tags })
          : t('Search icon hidden from the header', { _tags: tags }),
        type: 'switch',
        value: showHeaderSearchButton,
        searchKeywords: ['search', 'header', 'icon', 'appearance', 'ui'],
        onValueChange: async (value: boolean | string) => {
          const enabled = value as boolean;
          setShowHeaderSearchButton(enabled);
          await settingsService.setSetting('showHeaderSearchButton', enabled);
        },
      },
      {
        id: 'message-area-search-button',
        title: t('Show Message Search Button', { _tags: tags }),
        description: showMessageAreaSearchButton
          ? t('Floating search button visible in message view', { _tags: tags })
          : t('Floating search button hidden', { _tags: tags }),
        type: 'switch',
        value: showMessageAreaSearchButton,
        searchKeywords: ['search', 'message', 'button', 'floating', 'icon', 'appearance', 'ui'],
        onValueChange: async (value: boolean | string) => {
          const enabled = value as boolean;
          setShowMessageAreaSearchButton(enabled);
          await settingsService.setSetting('showMessageAreaSearchButton', enabled);
        },
      },
      {
        id: 'layout-message-spacing',
        title: t('Message Spacing', { _tags: tags }),
        description: `Spacing: ${layoutConfig?.messageSpacing || 4}px`,
        type: 'input',
        value: layoutConfig?.messageSpacing?.toString() || '4',
        keyboardType: 'numeric',
        searchKeywords: ['message', 'spacing', 'padding', 'gap', 'distance', 'vertical'],
        onValueChange: async (value: string | boolean) => {
          const spacing = parseInt(value as string, 10);
          if (!isNaN(spacing) && spacing >= 0 && spacing <= 20) {
            await layoutService.setMessageSpacing(spacing);
            updateLayoutConfig({});
          }
        },
      },
      {
        id: 'layout-message-padding',
        title: t('Message Padding', { _tags: tags }),
        description: `Padding: ${layoutConfig?.messagePadding || 8}px`,
        type: 'input',
        value: layoutConfig?.messagePadding?.toString() || '8',
        keyboardType: 'numeric',
        searchKeywords: ['message', 'padding', 'spacing', 'margin', 'border', 'horizontal'],
        onValueChange: async (value: string | boolean) => {
          const padding = parseInt(value as string, 10);
          if (!isNaN(padding) && padding >= 0 && padding <= 20) {
            await layoutService.setMessagePadding(padding);
            updateLayoutConfig({});
          }
        },
      },
      {
        id: 'layout-navigation-bar-offset',
        title: t('Navigation Bar Offset (Android)', { _tags: tags }),
        description: `Adjust for 3-button navigation: ${layoutConfig?.navigationBarOffset || 0}px`,
        type: 'input',
        value: layoutConfig?.navigationBarOffset?.toString() || '0',
        keyboardType: 'numeric',
        searchKeywords: ['navigation', 'bar', 'offset', 'android', 'bottom', 'button', '3-button'],
        onValueChange: async (value: string | boolean) => {
          const offset = parseInt(value as string, 10);
          if (!isNaN(offset) && offset >= 0 && offset <= 100) {
            await layoutService.setNavigationBarOffset(offset);
            updateLayoutConfig({});
          }
        },
      },
    ];

    return items;
  }, [currentTheme, availableThemes, layoutConfig, appLanguage, languageLabels, t, tags, refreshThemes, setAppLanguageFromHook, updateLayoutConfig, onShowThemeEditor, showHeaderSearchButton, showMessageAreaSearchButton]);

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
                if (subItem.type === 'input') {
                  return (
                    <View
                      key={subItem.id}
                      style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <Text style={{ color: colors.text, fontSize: 16 }}>{subItem.title}</Text>
                      <TextInput
                        style={[
                          styles.input,
                          { marginTop: 8, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                          subItem.disabled && styles.disabledInput,
                        ]}
                        value={subItem.value as string}
                        onChangeText={(text) => subItem.onValueChange?.(text)}
                        placeholder={subItem.placeholder}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType={subItem.keyboardType || 'default'}
                        secureTextEntry={subItem.secureTextEntry}
                        editable={!subItem.disabled}
                      />
                    </View>
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
