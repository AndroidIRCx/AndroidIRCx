import React, { useMemo, useState, useCallback } from 'react';
import { Alert, Modal, View, Text, TextInput, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useSettingsNotifications } from '../../../hooks/useSettingsNotifications';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { notificationService, NotificationPreferences } from '../../../services/NotificationService';
import { SoundSettingsScreen } from '../../../screens/SoundSettingsScreen';

interface NotificationsSectionProps {
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
    closeButtonText?: any;
    submenuItem?: any;
    submenuItemContent?: any;
    submenuItemText?: any;
    submenuItemDescription?: any;
    submenuInput?: any;
    identityDeleteText?: any;
    identityEmpty?: any;
  };
  settingIcons: Record<string, SettingIcon | undefined>;
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  colors,
  styles,
  settingIcons,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:NotificationsSection.tsx,feature:settings';
  
  const {
    notificationPrefs,
    updateNotificationPrefs,
  } = useSettingsNotifications();
  
  const [showChannelNotifModal, setShowChannelNotifModal] = useState(false);
  const [channelNotifList, setChannelNotifList] = useState<{ channel: string; prefs: NotificationPreferences }[]>([]);
  const [newChannelNotif, setNewChannelNotif] = useState('');
  const [showSoundSettings, setShowSoundSettings] = useState(false);

  const refreshChannelNotifList = useCallback(() => {
    setChannelNotifList(notificationService.listChannelPreferences());
  }, []);

  const handleNotificationChange = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    // If enabling notifications, check and request permission first
    if (key === 'enabled' && value) {
      const hasPermission = await notificationService.checkPermission();
      if (!hasPermission) {
        const granted = await notificationService.requestPermission();
        if (!granted) {
          Alert.alert(
            t('Permission Required', { _tags: tags }),
            t('Notification permission is required to receive notifications. Please enable it in system settings.', { _tags: tags })
          );
          return; // Don't enable notifications if permission denied
        }
      }
    }

    await updateNotificationPrefs({ [key]: value });
  }, [updateNotificationPrefs, t, tags]);

  const sectionData: SettingItemType[] = useMemo(() => {
    const items: SettingItemType[] = [
      {
        id: 'notifications-enabled',
        title: t('Enable Notifications', { _tags: tags }),
        description: t('Receive notifications for messages', { _tags: tags }),
        type: 'switch',
        value: notificationPrefs.enabled,
        searchKeywords: ['notifications', 'enable', 'alerts', 'push', 'messages'],
        onValueChange: (value: string | boolean) => handleNotificationChange('enabled', value as boolean),
      },
      {
        id: 'notifications-mentions',
        title: t('Notify on Mentions', { _tags: tags }),
        description: t('Get notified when someone mentions your nickname', { _tags: tags }),
        type: 'switch',
        value: notificationPrefs.notifyOnMentions,
        disabled: !notificationPrefs.enabled,
        searchKeywords: ['notify', 'mentions', 'nickname', 'highlight', 'ping'],
        onValueChange: (value: string | boolean) => handleNotificationChange('notifyOnMentions', value as boolean),
      },
      {
        id: 'notifications-private',
        title: t('Notify on Private Messages', { _tags: tags }),
        description: t('Get notified for private messages', { _tags: tags }),
        type: 'switch',
        value: notificationPrefs.notifyOnPrivateMessages,
        disabled: !notificationPrefs.enabled,
        searchKeywords: ['notify', 'private', 'messages', 'pm', 'query', 'direct'],
        onValueChange: (value: string | boolean) => handleNotificationChange('notifyOnPrivateMessages', value as boolean),
      },
      {
        id: 'notifications-all',
        title: t('Notify on All Messages', { _tags: tags }),
        description: t('Get notified for all channel messages', { _tags: tags }),
        type: 'switch',
        value: notificationPrefs.notifyOnAllMessages,
        disabled: !notificationPrefs.enabled,
        searchKeywords: ['notify', 'all', 'messages', 'channel', 'every'],
        onValueChange: (value: string | boolean) => handleNotificationChange('notifyOnAllMessages', value as boolean),
      },
      {
        id: 'notifications-dnd',
        title: t('Do Not Disturb', { _tags: tags }),
        description: t('Disable all notifications', { _tags: tags }),
        type: 'switch',
        value: notificationPrefs.doNotDisturb,
        searchKeywords: ['dnd', 'disturb', 'silent', 'mute', 'quiet', 'disable', 'notifications'],
        onValueChange: (value: string | boolean) => handleNotificationChange('doNotDisturb', value as boolean),
      },
      {
        id: 'notifications-per-channel',
        title: t('Per-Channel Settings', { _tags: tags }),
        description: t('Configure notifications for specific channels', { _tags: tags }),
        type: 'button',
        searchKeywords: ['channel', 'specific', 'configure', 'custom', 'notifications', 'override'],
        onPress: () => {
          setChannelNotifList(notificationService.listChannelPreferences());
          setShowChannelNotifModal(true);
        },
      },
      {
        id: 'notifications-sounds',
        title: t('Sound Settings', { _tags: tags }),
        description: t('Configure notification sounds and themes', { _tags: tags }),
        type: 'button',
        searchKeywords: ['sound', 'sounds', 'audio', 'notification', 'tone', 'alert', 'ring', 'volume', 'theme'],
        onPress: () => {
          setShowSoundSettings(true);
        },
      },
    ];

    return items;
  }, [notificationPrefs, t, tags, handleNotificationChange]);

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
      
      {/* Per-Channel Notifications Modal */}
      <Modal
        visible={showChannelNotifModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChannelNotifModal(false)}>
        <View style={styles.submenuOverlay}>
          <View style={[styles.submenuContainer, { maxHeight: '80%' }]}>
            <View style={styles.submenuHeader}>
              <Text style={styles.submenuTitle}>{t('Per-Channel Notifications', { _tags: tags })}</Text>
              <TouchableOpacity onPress={() => setShowChannelNotifModal(false)}>
                <Text style={styles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={styles.submenuItemDescription}>
                {t('Add a channel to override global notification settings.', { _tags: tags })}
              </Text>
              <TextInput
                style={[
                  styles.submenuInput,
                  { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                ]}
                placeholder={t('#channel', { _tags: tags })}
                placeholderTextColor={colors.textSecondary}
                value={newChannelNotif}
                onChangeText={setNewChannelNotif}
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <TouchableOpacity
                  onPress={async () => {
                    const chan = newChannelNotif.trim();
                    if (!chan) return;
                    await notificationService.updateChannelPreferences(chan, {
                      enabled: true,
                      notifyOnMentions: true,
                      notifyOnPrivateMessages: false,
                      notifyOnAllMessages: false,
                      doNotDisturb: false,
                    });
                    setNewChannelNotif('');
                    refreshChannelNotifList();
                  }}>
                  <Text style={styles.closeButtonText}>{t('Add', { _tags: tags })}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView>
              {channelNotifList.map(({ channel, prefs }) => (
                <View key={channel} style={styles.submenuItem}>
                  <View style={styles.submenuItemContent}>
                    <Text style={styles.submenuItemText}>{channel}</Text>
                    <Text style={styles.submenuItemDescription}>
                      {prefs.notifyOnAllMessages
                        ? t('All messages', { _tags: tags })
                        : t('Mentions only', { _tags: tags })}
                      {prefs.doNotDisturb ? t(' • DND', { _tags: tags }) : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.submenuItemDescription}>{t('All', { _tags: tags })}</Text>
                      <Switch
                        value={prefs.notifyOnAllMessages}
                        onValueChange={async (v) => {
                          await notificationService.updateChannelPreferences(channel, { notifyOnAllMessages: v });
                          refreshChannelNotifList();
                        }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.submenuItemDescription}>{t('Mentions', { _tags: tags })}</Text>
                      <Switch
                        value={prefs.notifyOnMentions}
                        onValueChange={async (v) => {
                          await notificationService.updateChannelPreferences(channel, { notifyOnMentions: v });
                          refreshChannelNotifList();
                        }}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={async () => {
                        await notificationService.removeChannelPreferences(channel);
                        refreshChannelNotifList();
                      }}>
                      <Text style={[styles.identityDeleteText, { marginTop: 4 }]}>{t('Delete', { _tags: tags })}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {channelNotifList.length === 0 && (
                <Text style={styles.identityEmpty}>{t('No channel overrides set.', { _tags: tags })}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sound Settings Screen */}
      <SoundSettingsScreen
        visible={showSoundSettings}
        onClose={() => setShowSoundSettings(false)}
      />
    </>
  );
};
