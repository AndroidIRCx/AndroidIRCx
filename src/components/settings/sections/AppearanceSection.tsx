/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Alert, Modal, View, Text, TouchableOpacity, ScrollView, TextInput, Platform } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useSettingsAppearance } from '../../../hooks/useSettingsAppearance';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { themeService, Theme, ThemeRecommendedSettings } from '../../../services/ThemeService';
import { layoutService, FontSize } from '../../../services/LayoutService';
import { settingsService } from '../../../services/SettingsService';
import { applyTransifexLocale } from '../../../i18n/transifex';
import { SUPPORTED_LOCALES } from '../../../i18n/config';
import { pick, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';

interface AppearanceSectionProps {
  colors: {
    text: string;
    textSecondary: string;
    textDisabled: string;
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
  const [userListSizeInput, setUserListSizeInput] = useState('150');
  const [userListSizeError, setUserListSizeError] = useState('');
  const [userListNickFontInput, setUserListNickFontInput] = useState('13');
  const [userListNickFontError, setUserListNickFontError] = useState('');
  const [nicklistTongueEnabled, setNicklistTongueEnabled] = useState(true);
  const [nicklistTongueSizeInput, setNicklistTongueSizeInput] = useState('56');
  const [nicklistTongueSizeError, setNicklistTongueSizeError] = useState('');

  useEffect(() => {
    if (!layoutConfig) return;
    setUserListSizeInput(String(layoutConfig.userListSizePx ?? 150));
    setUserListSizeError('');
    setUserListNickFontInput(String(layoutConfig.userListNickFontSizePx ?? 13));
    setUserListNickFontError('');
  }, [layoutConfig?.userListSizePx, layoutConfig?.userListNickFontSizePx]);

  useEffect(() => {
    let mounted = true;
    const loadTongueSettings = async () => {
      const enabled = await settingsService.getSetting('nicklistTongueEnabled', true);
      const sizePx = await settingsService.getSetting('nicklistTongueSizePx', 56);
      if (mounted) {
        setNicklistTongueEnabled(Boolean(enabled));
        setNicklistTongueSizeInput(String(sizePx ?? 56));
        setNicklistTongueSizeError('');
      }
    };
    loadTongueSettings();
    const unsubEnabled = settingsService.onSettingChange<boolean>('nicklistTongueEnabled', (value) => {
      setNicklistTongueEnabled(Boolean(value));
    });
    const unsubSize = settingsService.onSettingChange<number>('nicklistTongueSizePx', (value) => {
      if (!mounted) return;
      setNicklistTongueSizeInput(String(value ?? 56));
      setNicklistTongueSizeError('');
    });
    return () => {
      mounted = false;
      unsubEnabled();
      unsubSize();
    };
  }, []);

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

  // Apply theme recommended settings
  const applyThemeSettings = async (settings: ThemeRecommendedSettings): Promise<void> => {
    const normalizedBannerPosition = (() => {
      const pos = settings.bannerPosition;
      if (!pos) return undefined;
      switch (pos) {
        case 'above_header':
          return 'tabs_above';
        case 'below_header':
          return 'tabs_below';
        case 'bottom':
          return 'input_below';
        case 'input_above':
        case 'input_below':
        case 'tabs_above':
        case 'tabs_below':
          return pos;
        default:
          return undefined;
      }
    })();

    // Apply layout settings
    if (settings.userListSize !== undefined) {
      await layoutService.setUserListSizePx(settings.userListSize);
    }
    if (settings.userListNickFontSize !== undefined) {
      await layoutService.setConfig({ userListNickFontSizePx: settings.userListNickFontSize });
    }
    if (settings.nickListTongueSize !== undefined) {
      await settingsService.setSetting('nicklistTongueSizePx', settings.nickListTongueSize);
    }
    if (settings.fontSize !== undefined) {
      const fontSizeMapping: Record<string, FontSize> = {
        'small': 'small',
        'medium': 'medium',
        'large': 'large',
        'xlarge': 'custom',
      };
      await layoutService.setFontSize(fontSizeMapping[settings.fontSize] || 'medium');
    }
    if (settings.messageSpacing !== undefined) {
      await layoutService.setConfig({ messageSpacing: settings.messageSpacing });
    }
    if (settings.messagePadding !== undefined) {
      await layoutService.setConfig({ messagePadding: settings.messagePadding });
    }
    if (settings.navigationBarOffset !== undefined) {
      await layoutService.setConfig({ navigationBarOffset: settings.navigationBarOffset });
    }
    if (settings.tabPosition !== undefined) {
      await layoutService.setTabPosition(settings.tabPosition);
    }

    // Display & UI settings
    if (settings.noticeRouting !== undefined) {
      await settingsService.setSetting('noticeRouting', settings.noticeRouting);
    }
    if (settings.showTimestamps !== undefined) {
      await settingsService.setSetting('showTimestamps', settings.showTimestamps);
    }
    if (settings.groupMessages !== undefined) {
      await layoutService.setConfig({ messageGroupingEnabled: settings.groupMessages });
    }
    if (settings.messageTextAlignment !== undefined) {
      await layoutService.setConfig({ messageTextAlign: settings.messageTextAlignment });
    }
    if (settings.messageTextDirection !== undefined) {
      await layoutService.setConfig({ messageTextDirection: settings.messageTextDirection });
    }
    if (settings.timestampDisplay !== undefined) {
      // Map 'hover' to 'grouped' for compatibility
      const displayValue = settings.timestampDisplay === 'hover' ? 'grouped' : settings.timestampDisplay;
      await layoutService.setConfig({ timestampDisplay: displayValue });
    }
    if (settings.timestampFormat !== undefined) {
      await layoutService.setConfig({ timestampFormat: settings.timestampFormat });
    }
    if (normalizedBannerPosition !== undefined) {
      await settingsService.setSetting('bannerPosition', normalizedBannerPosition);
    }
    if (settings.keyboardBehavior !== undefined) {
      await settingsService.setSetting('keyboardBehavior', settings.keyboardBehavior);
    }
  };

  // Handle theme selection with optional settings
  const handleThemeSelect = async (theme: Theme) => {
    // If theme has recommended settings, ask user
    if (theme.recommendedSettings && Object.keys(theme.recommendedSettings).length > 0) {
      Alert.alert(
        t('Apply Theme Settings?', { _tags: tags }),
        t('The "{name}" theme has recommended settings for the best experience. Apply them?', { name: theme.name, _tags: tags }),
        [
          {
            text: t('Theme Only', { _tags: tags }),
            onPress: async () => {
              await themeService.setTheme(theme.id);
              refreshThemes();
            },
          },
          {
            text: t('Apply All', { _tags: tags }),
            style: 'default',
            onPress: async () => {
              await themeService.setTheme(theme.id);
              await applyThemeSettings(theme.recommendedSettings!);
              refreshThemes();
              Alert.alert(
                t('Settings Applied', { _tags: tags }),
                t('Theme and recommended settings have been applied.', { _tags: tags })
              );
            },
          },
        ]
      );
    } else {
      // No recommended settings, just apply theme
      await themeService.setTheme(theme.id);
      refreshThemes();
    }
  };

  // Export current theme to JSON file
  const handleExportTheme = async () => {
    try {
      const jsonData = themeService.exportCurrentTheme();
      if (!jsonData) {
        Alert.alert(t('Error', { _tags: tags }), t('Failed to export theme', { _tags: tags }));
        return;
      }

      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const themeName = currentTheme.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const filename = `theme_${themeName}_${timestamp}.json`;

      let savePath: string;
      if (Platform.OS === 'android') {
        const downloadDir = RNFS.DownloadDirectoryPath;
        savePath = `${downloadDir}/${filename}`;
      } else {
        savePath = `${RNFS.DocumentDirectoryPath}/${filename}`;
      }

      await RNFS.writeFile(savePath, jsonData, 'utf8');
      Alert.alert(
        t('Theme Exported', { _tags: tags }),
        t('Theme saved to:\n{path}', { path: savePath, _tags: tags }),
        [{ text: t('OK', { _tags: tags }) }]
      );
    } catch (error) {
      console.error('Failed to export theme:', error);
      Alert.alert(
        t('Error', { _tags: tags }),
        error instanceof Error ? error.message : t('Failed to export theme', { _tags: tags })
      );
    }
  };

  // Import theme from JSON file
  const handleImportTheme = async () => {
    try {
      const [result] = await pick({
        type: ['application/json'],
        copyTo: 'cachesDirectory',
      });

      if (!result || !result.uri) {
        return;
      }

      // Read file content
      let filePath = result.uri;
      const resultAny = result as any;
      if (Platform.OS === 'android' && filePath.startsWith('content://')) {
        // Use the copied file path on Android
        filePath = resultAny.fileCopyUri || result.uri;
      }

      // Normalize file path
      if (filePath.startsWith('file://')) {
        filePath = filePath.replace('file://', '');
      }

      const jsonContent = await RNFS.readFile(filePath, 'utf8');
      const importResult = await themeService.importTheme(jsonContent);

      if (importResult.success && importResult.theme) {
        Alert.alert(
          t('Theme Imported', { _tags: tags }),
          t('Successfully imported theme "{name}". Would you like to use it now?', {
            name: importResult.theme.name,
            _tags: tags,
          }),
          [
            { text: t('Later', { _tags: tags }), style: 'cancel' },
            {
              text: t('Use Now', { _tags: tags }),
              onPress: async () => {
                if (importResult.theme) {
                  await handleThemeSelect(importResult.theme);
                }
              },
            },
          ]
        );
        refreshThemes();
      } else {
        Alert.alert(
          t('Import Failed', { _tags: tags }),
          importResult.error || t('Failed to import theme', { _tags: tags })
        );
      }

      // Clean up cached file
      try {
        if (resultAny.fileCopyUri) {
          await RNFS.unlink(resultAny.fileCopyUri.replace('file://', ''));
        }
      } catch {
        // Ignore cleanup errors
      }
    } catch (error: any) {
      if (!(isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED)) {
        console.error('Failed to import theme:', error);
        Alert.alert(
          t('Error', { _tags: tags }),
          error instanceof Error ? error.message : t('Failed to import theme', { _tags: tags })
        );
      }
    }
  };

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
              await handleThemeSelect(theme);
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
          {
            id: 'theme-export',
            title: t('Export Current Theme', { _tags: tags }),
            description: t('Save theme to JSON file for sharing', { _tags: tags }),
            type: 'button' as const,
            onPress: handleExportTheme,
          },
          {
            id: 'theme-import',
            title: t('Import Theme', { _tags: tags }),
            description: t('Load theme from JSON file', { _tags: tags }),
            type: 'button' as const,
            onPress: handleImportTheme,
          },
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
        id: 'layout-userlist-size',
        title: t('User List Size', { _tags: tags }),
        description: `Size: ${layoutConfig?.userListSizePx ?? 150}px`,
        type: 'input',
        value: userListSizeInput,
        error: userListSizeError,
        keyboardType: 'numeric',
        searchKeywords: ['userlist', 'nicklist', 'size', 'width', 'height', 'panel', 'users'],
        onValueChange: async (value: string | boolean) => {
          const text = String(value);
          setUserListSizeInput(text);
          const trimmed = text.trim();
          if (!trimmed) {
            setUserListSizeError('');
            return;
          }
          const size = parseInt(trimmed, 10);
          if (isNaN(size)) {
            setUserListSizeError(t('Enter a valid number', { _tags: tags }));
            return;
          }
          if (size <= 0) {
            setUserListSizeError(t('Value must be greater than 0', { _tags: tags }));
            return;
          }
          setUserListSizeError('');
          await layoutService.setUserListSizePx(size);
          updateLayoutConfig({});
        },
      },
      {
        id: 'layout-userlist-nick-font-size',
        title: t('User List Nick Font Size', { _tags: tags }),
        description: `Font: ${layoutConfig?.userListNickFontSizePx ?? 13}px`,
        type: 'input',
        value: userListNickFontInput,
        error: userListNickFontError,
        keyboardType: 'numeric',
        searchKeywords: ['userlist', 'nicklist', 'font', 'size', 'nick', 'users', 'text'],
        onValueChange: async (value: string | boolean) => {
          const text = String(value);
          setUserListNickFontInput(text);
          const trimmed = text.trim();
          if (!trimmed) {
            setUserListNickFontError('');
            return;
          }
          const size = parseInt(trimmed, 10);
          if (isNaN(size)) {
            setUserListNickFontError(t('Enter a valid number', { _tags: tags }));
            return;
          }
          if (size <= 0) {
            setUserListNickFontError(t('Value must be greater than 0', { _tags: tags }));
            return;
          }
          setUserListNickFontError('');
          await layoutService.setUserListNickFontSizePx(size);
          updateLayoutConfig({});
        },
      },
      {
        id: 'layout-userlist-reset-defaults',
        title: t('Reset User List Defaults', { _tags: tags }),
        description: t('Reset user list size and nick font size to defaults', { _tags: tags }),
        type: 'button',
        searchKeywords: ['userlist', 'nicklist', 'reset', 'default', 'size', 'font', 'users'],
        onPress: async () => {
          await layoutService.setUserListSizePx(150);
          await layoutService.setUserListNickFontSizePx(13);
          setUserListSizeInput('150');
          setUserListSizeError('');
          setUserListNickFontInput('13');
          setUserListNickFontError('');
          updateLayoutConfig({});
        },
      },
      {
        id: 'layout-nicklist-tongue-enabled',
        title: t('Nicklist Tongue Button', { _tags: tags }),
        description: t('Show a small center handle to open/close the user list', { _tags: tags }),
        type: 'switch',
        value: nicklistTongueEnabled,
        searchKeywords: ['nicklist', 'userlist', 'handle', 'tongue', 'button', 'slide', 'gesture'],
        onValueChange: async (value: boolean | string) => {
          const enabled = Boolean(value);
          setNicklistTongueEnabled(enabled);
          await settingsService.setSetting('nicklistTongueEnabled', enabled);
        },
      },
      {
        id: 'layout-nicklist-tongue-size',
        title: t('Nicklist Tongue Size', { _tags: tags }),
        description: `Size: ${nicklistTongueSizeInput || '56'}px`,
        type: 'input',
        value: nicklistTongueSizeInput,
        error: nicklistTongueSizeError,
        keyboardType: 'numeric',
        searchKeywords: ['nicklist', 'userlist', 'handle', 'tongue', 'size', 'button'],
        onValueChange: async (value: string | boolean) => {
          const text = String(value);
          setNicklistTongueSizeInput(text);
          const trimmed = text.trim();
          if (!trimmed) {
            setNicklistTongueSizeError('');
            return;
          }
          const size = parseInt(trimmed, 10);
          if (isNaN(size)) {
            setNicklistTongueSizeError(t('Enter a valid number', { _tags: tags }));
            return;
          }
          if (size <= 0) {
            setNicklistTongueSizeError(t('Value must be greater than 0', { _tags: tags }));
            return;
          }
          setNicklistTongueSizeError('');
          await settingsService.setSetting('nicklistTongueSizePx', size);
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
  }, [currentTheme, availableThemes, layoutConfig, appLanguage, languageLabels, t, tags, refreshThemes, setAppLanguageFromHook, updateLayoutConfig, onShowThemeEditor, showHeaderSearchButton, showMessageAreaSearchButton, handleExportTheme, handleImportTheme, handleThemeSelect]);

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
