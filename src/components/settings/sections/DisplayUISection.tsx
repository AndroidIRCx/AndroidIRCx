/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useSettingsAppearance } from '../../../hooks/useSettingsAppearance';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { layoutService } from '../../../services/LayoutService';
import { NEW_FEATURE_DEFAULTS, settingsService } from '../../../services/SettingsService';
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
  showTypingIndicators?: boolean;
  onShowTypingIndicatorsChange?: (value: boolean) => void;
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
  showTypingIndicators: propShowTypingIndicators,
  onShowTypingIndicatorsChange,
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
  const [showTypingIndicatorsSetting, setShowTypingIndicatorsSetting] = useState(propShowTypingIndicators ?? true);
  const [showSendButton, setShowSendButton] = useState(true);
  const [showColorPickerButton, setShowColorPickerButton] = useState(true);
  const [enterKeyBehavior, setEnterKeyBehavior] = useState<'send' | 'newline'>('newline');
  const [keyboardAvoidingEnabled, setKeyboardAvoidingEnabled] = useState(true);
  const [keyboardBehaviorIOS, setKeyboardBehaviorIOS] = useState<'padding' | 'height' | 'position' | 'translate-with-padding'>('padding');
  const [keyboardBehaviorAndroid, setKeyboardBehaviorAndroid] = useState<'padding' | 'height' | 'position' | 'translate-with-padding'>('height');
  const [keyboardVerticalOffset, setKeyboardVerticalOffset] = useState('0');
  const [useAndroidBottomSafeArea, setUseAndroidBottomSafeArea] = useState(true);
  const [bannerPosition, setBannerPosition] = useState<'input_above' | 'input_below' | 'tabs_above' | 'tabs_below'>('input_above');
  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);
  const [channelListScrollSwitchTabs, setChannelListScrollSwitchTabs] = useState(false);
  const [channelListScrollSwitchTabsInverse, setChannelListScrollSwitchTabsInverse] = useState(false);
  const lastRawVisibilityRef = useRef<Record<RawMessageCategory, boolean> | null>(null);

  // Load initial state
  useEffect(() => {
    const loadSettings = async () => {
      const sortTabs = await settingsService.getSetting('tabSortAlphabetical', true);
      setTabSortAlphabetical(sortTabs);

      const notice = await settingsService.getSetting('noticeTarget', 'server');
      setNoticeTarget(notice);

      const showEncryption = await settingsService.getSetting('showEncryptionIndicators', true);
      setShowEncryptionIndicatorsSetting(showEncryption);

      const showTypingIndicators = await settingsService.getSetting('showTypingIndicators', true);
      setShowTypingIndicatorsSetting(showTypingIndicators);

      const sendButton = await settingsService.getSetting('showSendButton', true);
      setShowSendButton(sendButton);

      const colorPickerButton = await settingsService.getSetting('showColorPickerButton', true);
      setShowColorPickerButton(colorPickerButton);

      const enterBehavior = await settingsService.getSetting('enterKeyBehavior', 'newline');
      setEnterKeyBehavior(enterBehavior);

      const avoidingEnabled = await settingsService.getSetting('keyboardAvoidingEnabled', true);
      setKeyboardAvoidingEnabled(avoidingEnabled);

      const behaviorIOS = await settingsService.getSetting('keyboardBehaviorIOS', 'padding');
      setKeyboardBehaviorIOS(behaviorIOS);

      const behaviorAndroid = await settingsService.getSetting('keyboardBehaviorAndroid', 'height');
      setKeyboardBehaviorAndroid(behaviorAndroid);

      const offsetValue = await settingsService.getSetting('keyboardVerticalOffset', 0);
      setKeyboardVerticalOffset(String(offsetValue));

      const androidSafeArea = await settingsService.getSetting('useAndroidBottomSafeArea', true);
      setUseAndroidBottomSafeArea(androidSafeArea);

      const bannerPos = await settingsService.getSetting('bannerPosition', 'input_above');
      setBannerPosition(bannerPos);

      const scrollSwitch = await settingsService.getSetting(
        'channelListScrollSwitchTabs',
        NEW_FEATURE_DEFAULTS.channelListScrollSwitchTabs
      );
      setChannelListScrollSwitchTabs(scrollSwitch);

      const scrollSwitchInverse = await settingsService.getSetting(
        'channelListScrollSwitchTabsInverse',
        NEW_FEATURE_DEFAULTS.channelListScrollSwitchTabsInverse
      );
      setChannelListScrollSwitchTabsInverse(scrollSwitchInverse);
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

  useEffect(() => {
    setShowTypingIndicatorsSetting(propShowTypingIndicators ?? true);
  }, [propShowTypingIndicators]);

  useEffect(() => {
    if (!onRawCategoryVisibilityChange || !localShowRawCommands) return;
    const last = lastRawVisibilityRef.current;
    const isSame = last
      ? RAW_MESSAGE_CATEGORIES.every(category => last[category.id] === localRawCategoryVisibility[category.id])
      : false;
    if (isSame) return;
    lastRawVisibilityRef.current = localRawCategoryVisibility;
    onRawCategoryVisibilityChange(localRawCategoryVisibility);
  }, [localRawCategoryVisibility, localShowRawCommands, onRawCategoryVisibilityChange]);

  const sectionData: SettingItemType[] = useMemo(() => {
    const formatBehaviorLabel = (value: string) => {
      switch (value) {
        case 'padding':
          return t('Padding', { _tags: tags });
        case 'height':
          return t('Height', { _tags: tags });
        case 'position':
          return t('Position', { _tags: tags });
        case 'translate-with-padding':
          return t('Translate with padding', { _tags: tags });
        default:
          return value;
      }
    };

    const behaviorOptions = [
      { id: 'behavior-padding', label: t('Padding', { _tags: tags }), value: 'padding' },
      { id: 'behavior-height', label: t('Height', { _tags: tags }), value: 'height' },
      { id: 'behavior-position', label: t('Position', { _tags: tags }), value: 'position' },
      { id: 'behavior-translate-with-padding', label: t('Translate with padding', { _tags: tags }), value: 'translate-with-padding' },
    ];

    const items: SettingItemType[] = [
      {
        id: 'display-tab-sort',
        title: t('Sort Tabs Alphabetically', { _tags: tags }),
        description: tabSortAlphabetical ? 'Sorting tabs A→Z per network' : 'Keep tabs in join/open order',
        type: 'switch',
        value: tabSortAlphabetical,
        searchKeywords: ['sort', 'tabs', 'alphabetical', 'order', 'arrange', 'organize'],
        onValueChange: async (value: boolean | string) => {
          setTabSortAlphabetical(value as boolean);
          await settingsService.setSetting('tabSortAlphabetical', value);
        },
      },
      {
        id: 'display-channel-list-scroll-switch',
        title: t('Switch tabs on channel list scroll', { _tags: tags }),
        description: channelListScrollSwitchTabs
          ? t('Scroll up/down to change the active tab', { _tags: tags })
          : t('Scrolling the channel list will not change tabs', { _tags: tags }),
        type: 'switch',
        value: channelListScrollSwitchTabs,
        searchKeywords: ['scroll', 'tabs', 'channel list', 'switch', 'wheel', 'gesture'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = Boolean(value);
          setChannelListScrollSwitchTabs(boolValue);
          await settingsService.setSetting('channelListScrollSwitchTabs', boolValue);
        },
      },
      {
        id: 'display-channel-list-scroll-invert',
        title: t('Invert channel list scroll switching', { _tags: tags }),
        description: t('Reverse scroll direction for tab switching', { _tags: tags }),
        type: 'switch',
        value: channelListScrollSwitchTabsInverse,
        disabled: !channelListScrollSwitchTabs,
        searchKeywords: ['scroll', 'invert', 'reverse', 'tabs', 'channel list'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = Boolean(value);
          setChannelListScrollSwitchTabsInverse(boolValue);
          await settingsService.setSetting('channelListScrollSwitchTabsInverse', boolValue);
        },
      },
      {
        id: 'display-raw',
        title: t('Show Raw Commands', { _tags: tags }),
        description: t('Display raw IRC protocol messages', { _tags: tags }),
        type: 'switch',
        value: localShowRawCommands,
        searchKeywords: ['raw', 'commands', 'protocol', 'irc', 'messages', 'debug', 'technical'],
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
        searchKeywords: ['raw', 'categories', 'filter', 'messages', 'types'],
        submenuItems: RAW_MESSAGE_CATEGORIES.map((category) => ({
          id: `raw-category-${category.id}`,
          title: category.title,
          description: category.description,
          type: 'switch' as const,
          value: localRawCategoryVisibility[category.id] !== false,
          onValueChange: (value: boolean | string) => {
            const boolValue = value as boolean;
            setLocalRawCategoryVisibility((prev) => {
              return { ...prev, [category.id]: boolValue };
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
        searchKeywords: ['notice', 'routing', 'messages', 'server', 'tab', 'active'],
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
        value: layoutConfig?.timestampDisplay !== 'never',
        searchKeywords: ['timestamps', 'time', 'clock', 'display', 'show'],
        onValueChange: async (value: boolean | string) => {
          const showTimestamps = value as boolean;
          await layoutService.setTimestampDisplay(showTimestamps ? 'grouped' : 'never');
          updateLayoutConfig({});
        },
      },
      {
        id: 'display-message-grouping',
        title: t('Group Messages', { _tags: tags }),
        description: t('Group consecutive messages from the same user', { _tags: tags }),
        type: 'switch',
        value: layoutConfig?.messageGroupingEnabled !== false,
        searchKeywords: ['group', 'messages', 'combine', 'consecutive', 'spacing'],
        onValueChange: async (value: boolean | string) => {
          await layoutService.setMessageGroupingEnabled(Boolean(value));
          updateLayoutConfig({});
        },
      },
      {
        id: 'message-text-align',
        title: t('Message Text Alignment', { _tags: tags }),
        description: t('Alignment: {align}', { align: layoutConfig?.messageTextAlign || 'left', _tags: tags }),
        type: 'submenu',
        searchKeywords: ['message', 'text', 'align', 'left', 'right', 'center', 'justify'],
        submenuItems: [
          {
            id: 'align-left',
            title: t('Left', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setMessageTextAlign('left');
              updateLayoutConfig({});
            },
          },
          {
            id: 'align-center',
            title: t('Center', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setMessageTextAlign('center');
              updateLayoutConfig({});
            },
          },
          {
            id: 'align-right',
            title: t('Right', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setMessageTextAlign('right');
              updateLayoutConfig({});
            },
          },
          {
            id: 'align-justify',
            title: t('Justify', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setMessageTextAlign('justify');
              updateLayoutConfig({});
            },
          },
        ],
      },
      {
        id: 'message-text-direction',
        title: t('Message Text Direction', { _tags: tags }),
        description: t('Direction: {direction}', { direction: layoutConfig?.messageTextDirection || 'auto', _tags: tags }),
        type: 'submenu',
        searchKeywords: ['message', 'text', 'direction', 'rtl', 'ltr', 'hebrew', 'arabic'],
        submenuItems: [
          {
            id: 'direction-auto',
            title: t('Auto', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setMessageTextDirection('auto');
              updateLayoutConfig({});
            },
          },
          {
            id: 'direction-ltr',
            title: t('Left-to-right', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setMessageTextDirection('ltr');
              updateLayoutConfig({});
            },
          },
          {
            id: 'direction-rtl',
            title: t('Right-to-left', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setMessageTextDirection('rtl');
              updateLayoutConfig({});
            },
          },
        ],
      },
      {
        id: 'layout-timestamp-display',
        title: t('Timestamp Display', { _tags: tags }),
        description: t('Show timestamps: {mode}', { mode: layoutConfig?.timestampDisplay || 'grouped', _tags: tags }),
        type: 'submenu',
        searchKeywords: ['timestamp', 'display', 'mode', 'always', 'grouped', 'never', 'time'],
        submenuItems: [
          {
            id: 'timestamp-always',
            title: t('Always', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setTimestampDisplay('always');
              updateLayoutConfig({});
            },
          },
          {
            id: 'timestamp-grouped',
            title: t('Only for first message in a group', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setTimestampDisplay('grouped');
              updateLayoutConfig({});
            },
          },
          {
            id: 'timestamp-never',
            title: t('Never', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setTimestampDisplay('never');
              updateLayoutConfig({});
            },
          },
        ],
      },
      {
        id: 'layout-timestamp-format',
        title: t('Timestamp Format', { _tags: tags }),
        description: t('Format: {format}', { format: layoutConfig?.timestampFormat || '12h', _tags: tags }),
        type: 'submenu',
        disabled: layoutConfig?.timestampDisplay === 'never',
        searchKeywords: ['timestamp', 'format', '12h', '24h', 'time', 'clock', 'am', 'pm'],
        submenuItems: [
          {
            id: 'format-12h',
            title: t('12-hour (AM/PM)', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setTimestampFormat('12h');
              updateLayoutConfig({});
            },
          },
          {
            id: 'format-24h',
            title: t('24-hour', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              await layoutService.setTimestampFormat('24h');
              updateLayoutConfig({});
            },
          },
        ],
      },
      {
        id: 'display-encryption-icons',
        title: t('Show Encryption Indicators', { _tags: tags }),
        description: showEncryptionIndicatorsSetting
          ? t('Lock icons visible on tabs/messages', { _tags: tags })
          : t('Hide lock icons', { _tags: tags }),
        type: 'switch',
        value: showEncryptionIndicatorsSetting,
        searchKeywords: ['encryption', 'indicators', 'lock', 'icons', 'security', 'e2ee', 'encrypted'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setShowEncryptionIndicatorsSetting(boolValue);
          await settingsService.setSetting('showEncryptionIndicators', boolValue);
          onShowEncryptionIndicatorsChange && onShowEncryptionIndicatorsChange(boolValue);
        },
      },
      {
        id: 'display-typing-indicators',
        title: t('Show Typing Indicators', { _tags: tags }),
        description: showTypingIndicatorsSetting
          ? t('Display who is typing in the active tab', { _tags: tags })
          : t('Hide typing indicators', { _tags: tags }),
        type: 'switch',
        value: showTypingIndicatorsSetting,
        searchKeywords: ['typing', 'indicator', 'status', 'tagmsg', 'activity'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setShowTypingIndicatorsSetting(boolValue);
          await settingsService.setSetting('showTypingIndicators', boolValue);
          onShowTypingIndicatorsChange && onShowTypingIndicatorsChange(boolValue);
        },
      },
      {
        id: 'display-send-button',
        title: t('Show Send Button', { _tags: tags }),
        description: showSendButton
          ? t('Display send button next to message input', { _tags: tags })
          : t('Hide send button (use Enter key)', { _tags: tags }),
        type: 'switch',
        value: showSendButton,
        searchKeywords: ['send', 'button', 'message', 'input', 'enter', 'submit'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setShowSendButton(boolValue);
          await settingsService.setSetting('showSendButton', boolValue);
        },
      },
      {
        id: 'display-enter-key-behavior',
        title: t('Enter Key Behavior', { _tags: tags }),
        description: (() => {
          switch (enterKeyBehavior) {
            case 'send':
              return t('Enter key sends message', { _tags: tags });
            default:
              return t('Enter key creates new line', { _tags: tags });
          }
        })(),
        type: 'submenu',
        searchKeywords: ['enter', 'key', 'send', 'newline', 'multiline', 'input'],
        submenuItems: [
          {
            id: 'enter-send',
            title: t('Send message', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              setEnterKeyBehavior('send');
              await settingsService.setSetting('enterKeyBehavior', 'send');
            },
          },
          {
            id: 'enter-newline',
            title: t('New line', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              setEnterKeyBehavior('newline');
              await settingsService.setSetting('enterKeyBehavior', 'newline');
            },
          },
        ],
      },
      {
        id: 'display-color-picker-button',
        title: t('Show Color Picker Button', { _tags: tags }),
        description: showColorPickerButton
          ? t('Display mIRC color picker next to message input', { _tags: tags })
          : t('Hide mIRC color picker button', { _tags: tags }),
        type: 'switch',
        value: showColorPickerButton,
        searchKeywords: ['color', 'picker', 'mirc', 'formatting', 'input', 'button'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setShowColorPickerButton(boolValue);
          await settingsService.setSetting('showColorPickerButton', boolValue);
        },
      },
      {
        id: 'display-banner-position',
        title: t('Banner Position', { _tags: tags }),
        description: (() => {
          switch (bannerPosition) {
            case 'input_below':
              return t('Banner shown below message input', { _tags: tags });
            case 'tabs_above':
              return t('Banner shown above header', { _tags: tags });
            case 'tabs_below':
              return t('Banner shown below header', { _tags: tags });
            default:
              return t('Banner shown above message input', { _tags: tags });
          }
        })(),
        type: 'submenu',
        searchKeywords: ['banner', 'ads', 'ad', 'position', 'placement', 'layout'],
        submenuItems: [
          {
            id: 'banner-pos-input-above',
            title: t('Above message input', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              setBannerPosition('input_above');
              await settingsService.setSetting('bannerPosition', 'input_above');
            },
          },
          {
            id: 'banner-pos-input-below',
            title: t('Below message input', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              setBannerPosition('input_below');
              await settingsService.setSetting('bannerPosition', 'input_below');
            },
          },
          {
            id: 'banner-pos-tabs-above',
            title: t('Above header', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              setBannerPosition('tabs_above');
              await settingsService.setSetting('bannerPosition', 'tabs_above');
            },
          },
          {
            id: 'banner-pos-tabs-below',
            title: t('Below header', { _tags: tags }),
            type: 'button' as const,
            onPress: async () => {
              setBannerPosition('tabs_below');
              await settingsService.setSetting('bannerPosition', 'tabs_below');
            },
          },
        ],
      },
      {
        id: 'display-keyboard-avoiding',
        title: t('Keyboard Avoiding', { _tags: tags }),
        description: keyboardAvoidingEnabled
          ? t('Adjust layout when the keyboard opens', { _tags: tags })
          : t('Keep layout fixed when the keyboard opens', { _tags: tags }),
        type: 'switch',
        value: keyboardAvoidingEnabled,
        searchKeywords: ['keyboard', 'avoiding', 'input', 'overlap', 'layout'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setKeyboardAvoidingEnabled(boolValue);
          await settingsService.setSetting('keyboardAvoidingEnabled', boolValue);
        },
      },
      {
        id: 'display-keyboard-behavior-ios',
        title: t('Keyboard Behavior (iOS)', { _tags: tags }),
        description: t('Current: {mode}', { mode: formatBehaviorLabel(keyboardBehaviorIOS), _tags: tags }),
        type: 'submenu',
        disabled: !keyboardAvoidingEnabled,
        searchKeywords: ['keyboard', 'behavior', 'ios', 'padding', 'height', 'position'],
        submenuItems: behaviorOptions.map(option => ({
          id: `keyboard-behavior-ios-${option.value}`,
          title: option.label,
          type: 'button' as const,
          onPress: async () => {
            setKeyboardBehaviorIOS(option.value as 'padding' | 'height' | 'position' | 'translate-with-padding');
            await settingsService.setSetting('keyboardBehaviorIOS', option.value);
          },
        })),
      },
      {
        id: 'display-keyboard-behavior-android',
        title: t('Keyboard Behavior (Android)', { _tags: tags }),
        description: t('Current: {mode}', { mode: formatBehaviorLabel(keyboardBehaviorAndroid), _tags: tags }),
        type: 'submenu',
        disabled: !keyboardAvoidingEnabled,
        searchKeywords: ['keyboard', 'behavior', 'android', 'padding', 'height', 'position'],
        submenuItems: behaviorOptions.map(option => ({
          id: `keyboard-behavior-android-${option.value}`,
          title: option.label,
          type: 'button' as const,
          onPress: async () => {
            setKeyboardBehaviorAndroid(option.value as 'padding' | 'height' | 'position' | 'translate-with-padding');
            await settingsService.setSetting('keyboardBehaviorAndroid', option.value);
          },
        })),
      },
      {
        id: 'display-keyboard-offset',
        title: t('Keyboard Vertical Offset', { _tags: tags }),
        description: t('Additional padding in pixels for keyboard avoidance', { _tags: tags }),
        type: 'input',
        value: keyboardVerticalOffset,
        keyboardType: 'numeric',
        disabled: !keyboardAvoidingEnabled,
        searchKeywords: ['keyboard', 'offset', 'padding', 'avoid', 'height'],
        onValueChange: async (value: boolean | string) => {
          const raw = String(value);
          const sanitized = raw.replace(/[^0-9-]/g, '');
          setKeyboardVerticalOffset(sanitized);
          const numericValue = Number(sanitized);
          if (Number.isFinite(numericValue)) {
            await settingsService.setSetting('keyboardVerticalOffset', numericValue);
          }
        },
      },
      {
        id: 'display-android-bottom-safe-area',
        title: t('Android Bottom Safe Area', { _tags: tags }),
        description: useAndroidBottomSafeArea
          ? t('Keep spacing above the gesture bar', { _tags: tags })
          : t('Use full height on Android', { _tags: tags }),
        type: 'switch',
        value: useAndroidBottomSafeArea,
        searchKeywords: ['android', 'safe area', 'gesture', 'navigation', 'bottom', 'inset'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setUseAndroidBottomSafeArea(boolValue);
          await settingsService.setSetting('useAndroidBottomSafeArea', boolValue);
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
    showTypingIndicatorsSetting,
    showSendButton,
    keyboardAvoidingEnabled,
    keyboardBehaviorIOS,
    keyboardBehaviorAndroid,
    keyboardVerticalOffset,
    useAndroidBottomSafeArea,
    bannerPosition,
    channelListScrollSwitchTabs,
    channelListScrollSwitchTabsInverse,
    layoutConfig,
    t,
    tags,
    updateLayoutConfig,
    onShowRawCommandsChange,
    onRawCategoryVisibilityChange,
    onShowEncryptionIndicatorsChange,
    onShowTypingIndicatorsChange,
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
