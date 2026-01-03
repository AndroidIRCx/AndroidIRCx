import React, { useMemo, useState, useEffect } from 'react';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { settingsService, DEFAULT_PART_MESSAGE, DEFAULT_QUIT_MESSAGE } from '../../../services/SettingsService';

interface MessageHistorySectionProps {
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
}

export const MessageHistorySection: React.FC<MessageHistorySectionProps> = ({
  colors,
  styles,
  settingIcons,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:MessageHistorySection.tsx,feature:settings';
  
  const [partMessage, setPartMessage] = useState(DEFAULT_PART_MESSAGE);
  const [quitMessage, setQuitMessage] = useState(DEFAULT_QUIT_MESSAGE);
  const [hideJoinMessages, setHideJoinMessages] = useState(false);
  const [hidePartMessages, setHidePartMessages] = useState(false);
  const [hideQuitMessages, setHideQuitMessages] = useState(false);
  const [hideIrcServiceListenerMessages, setHideIrcServiceListenerMessages] = useState(true);
  const [closePrivateMessage, setClosePrivateMessage] = useState(false);
  const [closePrivateMessageText, setClosePrivateMessageText] = useState('Closing window');

  // Load initial state
  useEffect(() => {
    const loadSettings = async () => {
      const part = await settingsService.getSetting('partMessage', DEFAULT_PART_MESSAGE);
      setPartMessage(part);
      
      const quit = await settingsService.getSetting('quitMessage', DEFAULT_QUIT_MESSAGE);
      setQuitMessage(quit);
      
      const hideJoin = await settingsService.getSetting('hideJoinMessages', false);
      setHideJoinMessages(hideJoin);
      
      const hidePart = await settingsService.getSetting('hidePartMessages', false);
      setHidePartMessages(hidePart);
      
      const hideQuit = await settingsService.getSetting('hideQuitMessages', false);
      setHideQuitMessages(hideQuit);
      
      const hideIrcListener = await settingsService.getSetting('hideIrcServiceListenerMessages', true);
      setHideIrcServiceListenerMessages(hideIrcListener);
      
      const closePrivate = await settingsService.getSetting('closePrivateMessage', false);
      setClosePrivateMessage(closePrivate);
      
      const closePrivateText = await settingsService.getSetting('closePrivateMessageText', 'Closing window');
      setClosePrivateMessageText(closePrivateText);
    };
    loadSettings();
  }, []);

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'messages-part',
        title: t('Part Message', { _tags: tags }),
        description: t('Message to send when leaving a channel.', { _tags: tags }),
        type: 'input',
        value: partMessage,
        placeholder: DEFAULT_PART_MESSAGE,
        onValueChange: async (value: string | boolean) => {
          const strValue = value as string;
          setPartMessage(strValue);
          await settingsService.setSetting('partMessage', strValue);
        },
      },
      {
        id: 'messages-quit',
        title: t('Quit Message', { _tags: tags }),
        description: t('Message to send when disconnecting.', { _tags: tags }),
        type: 'input',
        value: quitMessage,
        placeholder: DEFAULT_QUIT_MESSAGE,
        onValueChange: async (value: string | boolean) => {
          const strValue = value as string;
          setQuitMessage(strValue);
          await settingsService.setSetting('quitMessage', strValue);
        },
      },
      {
        id: 'messages-hide-join',
        title: t('Hide Join Messages', { _tags: tags }),
        description: t('Do not show join events in channels.', { _tags: tags }),
        type: 'switch',
        value: hideJoinMessages,
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setHideJoinMessages(boolValue);
          await settingsService.setSetting('hideJoinMessages', boolValue);
        },
      },
      {
        id: 'messages-hide-part',
        title: t('Hide Part Messages', { _tags: tags }),
        description: t('Do not show part/leave events in channels.', { _tags: tags }),
        type: 'switch',
        value: hidePartMessages,
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setHidePartMessages(boolValue);
          await settingsService.setSetting('hidePartMessages', boolValue);
        },
      },
      {
        id: 'messages-hide-quit',
        title: t('Hide Quit Messages', { _tags: tags }),
        description: t('Do not show quit events in channels.', { _tags: tags }),
        type: 'switch',
        value: hideQuitMessages,
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setHideQuitMessages(boolValue);
          await settingsService.setSetting('hideQuitMessages', boolValue);
        },
      },
      {
        id: 'messages-hide-irc-listener',
        title: t('Hide IRCService Listener Messages', { _tags: tags }),
        description: t('Suppress "*** IRCService: Message listener registered..." raw logs.', { _tags: tags }),
        type: 'switch',
        value: hideIrcServiceListenerMessages,
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setHideIrcServiceListenerMessages(boolValue);
          await settingsService.setSetting('hideIrcServiceListenerMessages', boolValue);
        },
      },
      {
        id: 'messages-close-private-enabled',
        title: t('Send Message on Query Close', { _tags: tags }),
        description: t('Send a message when you close a private message window.', { _tags: tags }),
        type: 'switch',
        value: closePrivateMessage,
        onValueChange: async (value: string | boolean) => {
          const boolValue = value as boolean;
          setClosePrivateMessage(boolValue);
          await settingsService.setSetting('closePrivateMessage', boolValue);
        },
      },
      {
        id: 'messages-close-private-text',
        title: t('Query Close Message', { _tags: tags }),
        description: t('The message to send.', { _tags: tags }),
        type: 'input',
        value: closePrivateMessageText,
        placeholder: t('Enter message...', { _tags: tags }),
        disabled: !closePrivateMessage,
        onValueChange: async (value: string | boolean) => {
          const strValue = value as string;
          setClosePrivateMessageText(strValue);
          await settingsService.setSetting('closePrivateMessageText', strValue);
        },
      },
    ];

    return items;
  }, [
    partMessage,
    quitMessage,
    hideJoinMessages,
    hidePartMessages,
    hideQuitMessages,
    hideIrcServiceListenerMessages,
    closePrivateMessage,
    closePrivateMessageText,
    t,
    tags,
  ]);

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
          />
        );
      })}
    </>
  );
};
