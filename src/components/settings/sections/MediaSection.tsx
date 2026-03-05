/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * MediaSection - Settings for encrypted media sharing
 * 
 * Features:
 * - Master toggle to enable/disable media sharing
 * - Encryption indicator toggle
 * - Auto-download preferences
 * - Cache management
 * - Quality settings
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Alert, View, Text, TouchableOpacity, Switch, Modal, ScrollView, TextInput, StyleSheet } from 'react-native';
import { SettingItem } from '../SettingItem';
import { useT } from '../../../i18n/transifex';
import { SettingItem as SettingItemType, SettingIcon } from '../../../types/settings';
import { mediaSettingsService } from '../../../services/MediaSettingsService';
import { mediaCacheService } from '../../../services/MediaCacheService';
import { callMediaProfileService } from '../../../services/CallMediaProfileService';
import { settingsService } from '../../../services/SettingsService';

interface MediaSectionProps {
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

export const MediaSection: React.FC<MediaSectionProps> = ({
  colors,
  styles,
  settingIcons,
}) => {
  const t = useT();
  const tags = 'screen:settings,file:MediaSection.tsx,feature:settings';
  
  const [mediaEnabled, setMediaEnabled] = useState(true);
  const [showEncryptionIndicator, setShowEncryptionIndicator] = useState(true);
  const [autoDownload, setAutoDownload] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [maxCacheSize, setMaxCacheSize] = useState(250 * 1024 * 1024); // 250MB default
  const [mediaQuality, setMediaQuality] = useState<'original' | 'high' | 'medium' | 'low'>('original');
  const [videoQuality, setVideoQuality] = useState<'4k' | '1080p' | '720p' | '480p'>('1080p');
  const [callVideoQuality, setCallVideoQuality] = useState<'1440p' | '1080p' | '720p' | '480p'>('480p');
  const [callStunServers, setCallStunServers] = useState<string[]>([]);
  const [callStunDraft, setCallStunDraft] = useState('');
  const [callStunDraftError, setCallStunDraftError] = useState('');
  const [callTurnEnabled, setCallTurnEnabled] = useState(false);
  const [callTurnServers, setCallTurnServers] = useState<string[]>([]);
  const [callTurnDraft, setCallTurnDraft] = useState('');
  const [callTurnDraftError, setCallTurnDraftError] = useState('');
  const [callTurnUsername, setCallTurnUsername] = useState('');
  const [callTurnCredential, setCallTurnCredential] = useState('');
  const [callForceRelayOnly, setCallForceRelayOnly] = useState(false);
  const [callNicklistCallActionsEnabled, setCallNicklistCallActionsEnabled] = useState(false);
  const [voiceMaxDuration, setVoiceMaxDuration] = useState(180); // 3 minutes default
  const [cacheSize, setCacheSize] = useState(0);
  const [showSubmenu, setShowSubmenu] = useState<string | null>(null);
  const [relayEnabled, setRelayEnabled] = useState(false);
  const [showCallNotification, setShowCallNotification] = useState(true);
  const [callOverlayOnlyOnActiveQuery, setCallOverlayOnlyOnActiveQuery] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load initial state
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const enabled = await mediaSettingsService.isMediaEnabled();
        setMediaEnabled(enabled);
        
        const showIndicator = await mediaSettingsService.shouldShowEncryptionIndicator();
        setShowEncryptionIndicator(showIndicator);
        
        const autoDownloadSetting = await mediaSettingsService.getAutoDownload();
        setAutoDownload(autoDownloadSetting);
        
        const wifiOnlySetting = await mediaSettingsService.getWiFiOnly();
        setWifiOnly(wifiOnlySetting);
        
        const cacheSizeSetting = await mediaSettingsService.getMaxCacheSize();
        setMaxCacheSize(cacheSizeSetting);
        
        const quality = await mediaSettingsService.getMediaQuality();
        setMediaQuality(quality);
        
        const videoQual = await mediaSettingsService.getVideoQuality();
        setVideoQuality(videoQual);

        const callQuality = await mediaSettingsService.getCallVideoQuality();
        const capabilityProfile = callMediaProfileService.getCapabilityProfile();
        setRelayEnabled(capabilityProfile.relayEnabled);
        const safeCallQuality = capabilityProfile.allowedVideoQualities.includes(callQuality as any)
          ? callQuality
          : capabilityProfile.defaultVideoQuality;
        setCallVideoQuality(safeCallQuality);
        if (safeCallQuality !== callQuality) {
          await mediaSettingsService.setCallVideoQuality(safeCallQuality);
        }

        const stunServers = await mediaSettingsService.getCallStunServers();
        setCallStunServers(stunServers);

        const turnConfig = await mediaSettingsService.getCallTurnServerConfig();
        setCallTurnEnabled(turnConfig.enabled);
        setCallTurnServers(turnConfig.urls);
        setCallTurnUsername(turnConfig.username);
        setCallTurnCredential(turnConfig.credential);

        const forceRelayOnly = await mediaSettingsService.getCallForceRelayOnly();
        setCallForceRelayOnly(forceRelayOnly);

        const nicklistCallActionsEnabled = await mediaSettingsService.getCallNicklistCallActionsEnabled();
        setCallNicklistCallActionsEnabled(nicklistCallActionsEnabled);
        
        const voiceDuration = await mediaSettingsService.getVoiceMaxDuration();
        setVoiceMaxDuration(voiceDuration);

        const showCallNotif = await settingsService.getSetting('showCallNotification', true);
        setShowCallNotification(Boolean(showCallNotif));

        const scopedOverlay = await settingsService.getSetting('callMinimizedOnlyOnActiveQuery', false);
        setCallOverlayOnlyOnActiveQuery(Boolean(scopedOverlay));
        
        // Load cache size
        const size = await mediaCacheService.getCacheSize();
        setCacheSize(size);
      } finally {
        setSettingsLoaded(true);
      }
    };
    
    loadSettings();
  }, []);

  const handleClearCache = async () => {
    Alert.alert(
      t('Clear Media Cache', { _tags: tags }),
      t('Are you sure you want to clear all cached media? This will free up storage space but media will need to be downloaded again.', { _tags: tags }),
      [
        { text: t('Cancel', { _tags: tags }), style: 'cancel' },
        {
          text: t('Clear', { _tags: tags }),
          style: 'destructive',
          onPress: async () => {
            try {
              await mediaCacheService.clearCache();
              const size = await mediaCacheService.getCacheSize();
              setCacheSize(size);
              Alert.alert(
                t('Cache Cleared', { _tags: tags }),
                t('Media cache has been cleared successfully.', { _tags: tags })
              );
            } catch (error) {
              Alert.alert(
                t('Error', { _tags: tags }),
                t('Failed to clear cache: {error}', { 
                  error: error instanceof Error ? error.message : String(error),
                  _tags: tags 
                })
              );
            }
          },
        },
      ]
    );
  };

  const formatCacheSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatMaxCacheSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${mb.toFixed(0)} MB`;
  };

  const isValidStunUrl = (value: string): boolean => value.startsWith('stun:');
  const isValidTurnUrl = (value: string): boolean => value.startsWith('turn:') || value.startsWith('turns:');

  const addUniqueServer = (servers: string[], value: string): string[] => {
    const normalized = value.trim();
    if (!normalized || servers.includes(normalized)) {
      return servers;
    }
    return [...servers, normalized];
  };

  const removeServerAt = (servers: string[], index: number): string[] => {
    if (index < 0 || index >= servers.length) {
      return servers;
    }
    return servers.filter((_, serverIndex) => serverIndex !== index);
  };

  const moveServer = (servers: string[], fromIndex: number, toIndex: number): string[] => {
    if (
      fromIndex < 0 ||
      fromIndex >= servers.length ||
      toIndex < 0 ||
      toIndex >= servers.length ||
      fromIndex === toIndex
    ) {
      return servers;
    }
    const next = [...servers];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
  };

  const sectionData: SettingItemType[] = useMemo(() => {
    const mediaQualityLabel = {
      original: t('Original', { _tags: tags }),
      high: t('High', { _tags: tags }),
      medium: t('Medium', { _tags: tags }),
      low: t('Low', { _tags: tags }),
    }[mediaQuality] || mediaQuality;

    const videoQualityLabel = {
      '4k': '4K',
      '1080p': '1080p',
      '720p': '720p',
      '480p': '480p',
    }[videoQuality] || videoQuality;

    const callVideoQualityLabel = {
      '1440p': '1440p',
      '1080p': '1080p',
      '720p': '720p',
      '480p': '480p',
    }[callVideoQuality] || callVideoQuality;

    const capabilityProfile = callMediaProfileService.getCapabilityProfile();
    const hasTurnCredentials = callTurnUsername.trim().length > 0 && callTurnCredential.length > 0;
    const callQualityItems = capabilityProfile.allowedVideoQualities.map((quality) => ({
      id: `call-video-${quality}`,
      title: quality,
      type: 'button' as const,
      onPress: () => setCallVideoQuality(quality),
    }));

    const items: SettingItemType[] = [
      {
        id: 'media-enabled',
        title: t('Enable Encrypted Media Sharing', { _tags: tags }),
        description: mediaEnabled
          ? t('Media sharing is enabled. Attachment button (📎) appears on encrypted conversations.', { _tags: tags })
          : t('Media sharing is disabled. Attachment button will not appear.', { _tags: tags }),
        type: 'switch',
        value: mediaEnabled,
        searchKeywords: ['media', 'sharing', 'encrypted', 'attachment', 'enable', 'disable', 'photo', 'video', 'image', 'file'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setMediaEnabled(boolValue);
          await mediaSettingsService.setMediaEnabled(boolValue);
        },
      },
      {
        id: 'media-info',
        title: t('About Media Sharing', { _tags: tags }),
        description: t('Media sharing works only in encrypted conversations (DMs with key exchange or encrypted channels). All media is automatically encrypted using existing E2E keys.', { _tags: tags }),
        type: 'button' as const,
        disabled: true,
        searchKeywords: ['media', 'info', 'about', 'sharing', 'encrypted', 'e2e', 'help', 'information'],
        onPress: () => {}, // No-op for info button
      },
      {
        id: 'media-encryption-indicator',
        title: t('Show Encryption Indicator', { _tags: tags }),
        description: t('Display 🔒 icon on media thumbnails to indicate encryption', { _tags: tags }),
        type: 'switch',
        value: showEncryptionIndicator,
        disabled: !mediaEnabled,
        searchKeywords: ['encryption', 'indicator', 'icon', 'lock', 'media', 'thumbnail', 'show', 'display'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setShowEncryptionIndicator(boolValue);
          await mediaSettingsService.setShowEncryptionIndicator(boolValue);
        },
      },
      {
        id: 'media-auto-download',
        title: t('Auto-Download Media', { _tags: tags }),
        description: t('Automatically download media when received', { _tags: tags }),
        type: 'switch',
        value: autoDownload,
        disabled: !mediaEnabled,
        searchKeywords: ['auto', 'download', 'automatic', 'media', 'received', 'save'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setAutoDownload(boolValue);
          await mediaSettingsService.setAutoDownload(boolValue);
        },
      },
      {
        id: 'media-wifi-only',
        title: t('WiFi Only Downloads', { _tags: tags }),
        description: t('Only download media when connected to WiFi', { _tags: tags }),
        type: 'switch',
        value: wifiOnly,
        disabled: !mediaEnabled || !autoDownload,
        searchKeywords: ['wifi', 'only', 'download', 'data', 'cellular', 'mobile', 'network'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setWifiOnly(boolValue);
          await mediaSettingsService.setWiFiOnly(boolValue);
        },
      },
      {
        id: 'media-cache-size',
        title: t('Maximum Cache Size', { _tags: tags }),
        description: t('Current cache: {size} / Max: {max}', {
          size: formatCacheSize(cacheSize),
          max: formatMaxCacheSize(maxCacheSize),
          _tags: tags
        }),
        type: 'submenu',
        disabled: !mediaEnabled,
        searchKeywords: ['cache', 'size', 'storage', 'limit', 'maximum', 'space', 'mb', 'gb'],
        submenuItems: [
          { id: 'cache-50mb', title: '50 MB', type: 'button' as const, onPress: () => setMaxCacheSize(50 * 1024 * 1024) },
          { id: 'cache-100mb', title: '100 MB', type: 'button' as const, onPress: () => setMaxCacheSize(100 * 1024 * 1024) },
          { id: 'cache-250mb', title: '250 MB', type: 'button' as const, onPress: () => setMaxCacheSize(250 * 1024 * 1024) },
          { id: 'cache-500mb', title: '500 MB', type: 'button' as const, onPress: () => setMaxCacheSize(500 * 1024 * 1024) },
          { id: 'cache-1gb', title: '1 GB', type: 'button' as const, onPress: () => setMaxCacheSize(1024 * 1024 * 1024) },
        ],
      },
      {
        id: 'media-quality',
        title: t('Media Quality', { _tags: tags }),
        description: t('Current: {quality}', { quality: mediaQualityLabel, _tags: tags }),
        type: 'submenu',
        disabled: !mediaEnabled,
        searchKeywords: ['quality', 'resolution', 'compression', 'media', 'image', 'photo', 'original', 'high', 'medium', 'low'],
        submenuItems: [
          { id: 'quality-original', title: t('Original', { _tags: tags }), type: 'button' as const, onPress: () => setMediaQuality('original') },
          { id: 'quality-high', title: t('High', { _tags: tags }), type: 'button' as const, onPress: () => setMediaQuality('high') },
          { id: 'quality-medium', title: t('Medium', { _tags: tags }), type: 'button' as const, onPress: () => setMediaQuality('medium') },
          { id: 'quality-low', title: t('Low', { _tags: tags }), type: 'button' as const, onPress: () => setMediaQuality('low') },
        ],
      },
      {
        id: 'call-video-quality',
        title: t('Live Call Video Quality', { _tags: tags }),
        description: relayEnabled
          ? t('Current: {quality} • Privacy Relay unlocks HD and TURN fallback', {
              quality: callVideoQualityLabel,
              _tags: tags,
            })
          : t('Current: {quality} • Free calls stay direct, default to 480p, and can be raised to 720p', {
              quality: callVideoQualityLabel,
              _tags: tags,
            }),
        type: 'submenu',
        disabled: !mediaEnabled,
        searchKeywords: ['webrtc', 'call', 'video', 'quality', 'relay', 'turn', '720p', '1080p', '1440p', 'hd'],
        submenuItems: callQualityItems,
      },
      {
        id: 'call-stun-servers',
        title: t('Free Call STUN Servers', { _tags: tags }),
        description: relayEnabled
          ? t('Current fallback list: {count} STUN endpoints. Premium calls still use TURN when needed.', {
              count: callStunServers.length,
              _tags: tags,
            })
          : t('Current fallback list: {count} STUN endpoints for direct free calls. Ordered list is used for fallback.', {
              count: callStunServers.length,
              _tags: tags,
            }),
        type: 'submenu',
        disabled: !mediaEnabled,
        searchKeywords: ['stun', 'ice', 'webrtc', 'call', 'server', 'nat', 'p2p', 'direct'],
      },
      {
        id: 'call-turn-servers',
        title: t('External TURN Server', { _tags: tags }),
        description: callTurnEnabled
          ? t('Enabled: {count} TURN URL(s), credentials {credentialsState}.', {
              count: callTurnServers.length,
              credentialsState: hasTurnCredentials ? t('set', { _tags: tags }) : t('missing', { _tags: tags }),
              _tags: tags,
            })
          : t('Disabled. Configure your own TURN relay if you already have one.', { _tags: tags }),
        type: 'submenu',
        disabled: !mediaEnabled,
        searchKeywords: ['turn', 'relay', 'webrtc', 'ice', 'external', 'custom', 'username', 'credential', 'stun'],
      },
      {
        id: 'call-force-relay-only',
        title: t('Force TURN Relay Only', { _tags: tags }),
        description: t('If enabled, WebRTC uses relay candidates only when relay is available (Privacy Relay or external TURN).', { _tags: tags }),
        type: 'switch',
        value: callForceRelayOnly,
        disabled: !mediaEnabled,
        searchKeywords: ['turn', 'relay', 'ice', 'policy', 'webrtc', 'force', 'only'],
        onValueChange: (value: boolean | string) => {
          setCallForceRelayOnly(Boolean(value));
        },
      },
      {
        id: 'call-actions-in-nicklist',
        title: t('Show Audio/Video Call In Nick Menu', { _tags: tags }),
        description: callNicklistCallActionsEnabled
          ? t('Audio and Video Call actions are visible in user context menu.', { _tags: tags })
          : t('Audio and Video Call actions are hidden in user context menu.', { _tags: tags }),
        type: 'switch',
        value: callNicklistCallActionsEnabled,
        disabled: !mediaEnabled,
        searchKeywords: ['nicklist', 'nick', 'menu', 'audio', 'video', 'call', 'webrtc', 'context'],
        onValueChange: (value: boolean | string) => {
          setCallNicklistCallActionsEnabled(Boolean(value));
        },
      },
      {
        id: 'call-notification',
        title: t('Show Ongoing Call Notification', { _tags: tags }),
        description: t('Keeps an Android notification visible during active audio and video calls so you can jump back quickly.', { _tags: tags }),
        type: 'switch',
        value: showCallNotification,
        disabled: !mediaEnabled,
        searchKeywords: ['call', 'notification', 'ongoing', 'webrtc', 'audio', 'video', 'status bar'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setShowCallNotification(boolValue);
          await settingsService.setSetting('showCallNotification', boolValue);
        },
      },
      {
        id: 'call-overlay-scope',
        title: t('Show Minimized Call Only In Active Query', { _tags: tags }),
        description: callOverlayOnlyOnActiveQuery
          ? t('Minimized call overlay appears only when you are on the matching query tab. This is optional and off by default.', { _tags: tags })
          : t('Default behavior: minimized call overlay stays visible everywhere in the app.', { _tags: tags }),
        type: 'switch',
        value: callOverlayOnlyOnActiveQuery,
        disabled: !mediaEnabled,
        searchKeywords: ['call', 'overlay', 'query', 'minimized', 'pip', 'scope', 'chat', 'webrtc'],
        onValueChange: async (value: boolean | string) => {
          const boolValue = value as boolean;
          setCallOverlayOnlyOnActiveQuery(boolValue);
          await settingsService.setSetting('callMinimizedOnlyOnActiveQuery', boolValue);
        },
      },
      {
        id: 'video-quality',
        title: t('Video Recording Quality', { _tags: tags }),
        description: t('Current: {quality}', { quality: videoQualityLabel, _tags: tags }),
        type: 'submenu',
        disabled: !mediaEnabled,
        searchKeywords: ['video', 'quality', 'recording', 'resolution', '4k', '1080p', '720p', '480p', 'hd'],
        submenuItems: [
          { id: 'video-4k', title: '4K', type: 'button' as const, onPress: () => setVideoQuality('4k') },
          { id: 'video-1080p', title: '1080p', type: 'button' as const, onPress: () => setVideoQuality('1080p') },
          { id: 'video-720p', title: '720p', type: 'button' as const, onPress: () => setVideoQuality('720p') },
          { id: 'video-480p', title: '480p', type: 'button' as const, onPress: () => setVideoQuality('480p') },
        ],
      },
      {
        id: 'voice-max-duration',
        title: t('Max Voice Message Duration', { _tags: tags }),
        description: t('Current: {duration} seconds', { duration: voiceMaxDuration, _tags: tags }),
        type: 'submenu',
        disabled: !mediaEnabled,
        searchKeywords: ['voice', 'audio', 'recording', 'duration', 'length', 'maximum', 'time', 'limit', 'seconds', 'minutes'],
        submenuItems: [
          { id: 'voice-60s', title: t('1 minute', { _tags: tags }), type: 'button' as const, onPress: () => setVoiceMaxDuration(60) },
          { id: 'voice-180s', title: t('3 minutes', { _tags: tags }), type: 'button' as const, onPress: () => setVoiceMaxDuration(180) },
          { id: 'voice-300s', title: t('5 minutes', { _tags: tags }), type: 'button' as const, onPress: () => setVoiceMaxDuration(300) },
        ],
      },
      {
        id: 'media-clear-cache',
        title: t('Clear Media Cache', { _tags: tags }),
        description: t('Free up storage by clearing cached media files', { _tags: tags }),
        type: 'button',
        disabled: !mediaEnabled || cacheSize === 0,
        searchKeywords: ['clear', 'cache', 'delete', 'storage', 'space', 'free', 'media', 'files'],
        onPress: handleClearCache,
      },
    ];

    return items;
  }, [
    mediaEnabled,
    showEncryptionIndicator,
    autoDownload,
    wifiOnly,
    maxCacheSize,
    mediaQuality,
    videoQuality,
    callVideoQuality,
    callStunServers,
    callTurnEnabled,
    callTurnServers,
    callTurnUsername,
    callTurnCredential,
    callForceRelayOnly,
    callNicklistCallActionsEnabled,
    voiceMaxDuration,
    cacheSize,
    relayEnabled,
    showCallNotification,
    callOverlayOnlyOnActiveQuery,
    t,
    tags,
  ]);

  // Save settings when they change
  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    const saveSettings = async () => {
      await mediaSettingsService.setMaxCacheSize(maxCacheSize);
      await mediaSettingsService.setMediaQuality(mediaQuality);
      await mediaSettingsService.setVideoQuality(videoQuality);
      await mediaSettingsService.setCallVideoQuality(callVideoQuality);
      await mediaSettingsService.setCallStunServers(callStunServers);
      await mediaSettingsService.setCallTurnServerConfig({
        enabled: callTurnEnabled,
        urls: callTurnServers,
        username: callTurnUsername.trim(),
        credential: callTurnCredential,
      });
      await mediaSettingsService.setCallForceRelayOnly(callForceRelayOnly);
      await mediaSettingsService.setCallNicklistCallActionsEnabled(callNicklistCallActionsEnabled);
      await mediaSettingsService.setVoiceMaxDuration(voiceMaxDuration);
    };
    saveSettings();
  }, [
    maxCacheSize,
    mediaQuality,
    videoQuality,
    callVideoQuality,
    callStunServers,
    callTurnEnabled,
    callTurnServers,
    callTurnUsername,
    callTurnCredential,
    callForceRelayOnly,
    callNicklistCallActionsEnabled,
    voiceMaxDuration,
    settingsLoaded,
  ]);

  const modalStyles = useMemo(() => createModalStyles(colors), [colors]);
  const activeSubmenu = sectionData.find(item => item.id === showSubmenu);
  const renderServerRows = (servers: string[], type: 'stun' | 'turn') => {
    if (servers.length === 0) {
      return (
        <View style={modalStyles.emptyStateBox}>
          <Text style={modalStyles.submenuItemDescription}>
            {type === 'stun'
              ? t('No STUN servers added yet.', { _tags: tags })
              : t('No TURN servers added yet.', { _tags: tags })}
          </Text>
        </View>
      );
    }

    return servers.map((server, index) => (
      <View key={`${type}-${server}-${index}`} style={modalStyles.serverRow}>
        <View style={modalStyles.serverIndexBadge}>
          <Text style={modalStyles.serverIndexText}>{index + 1}</Text>
        </View>
        <Text style={modalStyles.serverRowText}>{server}</Text>
        <View style={modalStyles.serverRowActions}>
          <TouchableOpacity
            accessibilityLabel={`${type}-server-up-${index}`}
            onPress={() => {
              const next = moveServer(servers, index, index - 1);
              type === 'stun' ? setCallStunServers(next) : setCallTurnServers(next);
            }}
            disabled={index === 0}
            style={[modalStyles.serverActionButton, index === 0 && modalStyles.serverActionButtonDisabled]}>
            <Text style={modalStyles.serverActionText}>Up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={`${type}-server-down-${index}`}
            onPress={() => {
              const next = moveServer(servers, index, index + 1);
              type === 'stun' ? setCallStunServers(next) : setCallTurnServers(next);
            }}
            disabled={index === servers.length - 1}
            style={[
              modalStyles.serverActionButton,
              index === servers.length - 1 && modalStyles.serverActionButtonDisabled,
            ]}>
            <Text style={modalStyles.serverActionText}>Down</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={`${type}-server-remove-${index}`}
            onPress={() => {
              const next = removeServerAt(servers, index);
              type === 'stun' ? setCallStunServers(next) : setCallTurnServers(next);
            }}
            style={modalStyles.serverActionButtonDanger}>
            <Text style={modalStyles.serverActionTextDanger}>{t('Remove', { _tags: tags })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    ));
  };

  const isStunSubmenu = activeSubmenu?.id === 'call-stun-servers';
  const isTurnSubmenu = activeSubmenu?.id === 'call-turn-servers';

  return (
    <View>
      {sectionData.map((item) => (
        <SettingItem
          key={item.id}
          item={item}
          colors={colors}
          styles={styles}
          settingIcons={settingIcons}
          onPress={(itemId) => {
            if (item.type === 'submenu') {
              setShowSubmenu(itemId);
            }
          }}
        />
      ))}
      <Modal
        visible={showSubmenu !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubmenu(null)}>
        <View style={modalStyles.submenuOverlay}>
          <View style={modalStyles.submenuContainer}>
            <View style={modalStyles.submenuHeader}>
              <Text style={modalStyles.submenuTitle}>
                {activeSubmenu?.title || t('Options', { _tags: tags })}
              </Text>
              <TouchableOpacity onPress={() => setShowSubmenu(null)}>
                <Text style={modalStyles.closeButtonText}>{t('Close', { _tags: tags })}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {isStunSubmenu && (
                <View style={modalStyles.submenuItem}>
                  <View style={modalStyles.submenuItemContent}>
                    <Text style={modalStyles.submenuItemText}>{t('STUN Servers', { _tags: tags })}</Text>
                    <Text style={modalStyles.submenuItemDescription}>
                      {t('Add multiple STUN URLs. Order is used as fallback priority.', { _tags: tags })}
                    </Text>
                    {renderServerRows(callStunServers, 'stun')}
                    <View style={modalStyles.serverInputRow}>
                      <TextInput
                        style={[
                          modalStyles.submenuInput,
                          modalStyles.serverInput,
                          { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                        ]}
                        value={callStunDraft}
                        onChangeText={(text) => {
                          setCallStunDraft(text);
                          if (callStunDraftError) {
                            setCallStunDraftError('');
                          }
                        }}
                        placeholder="stun:stun.l.google.com:19302"
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={modalStyles.addServerButton}
                        onPress={() => {
                          const nextValue = callStunDraft.trim();
                          if (!isValidStunUrl(nextValue)) {
                            setCallStunDraftError(t('STUN must start with stun:', { _tags: tags }));
                            return;
                          }
                          setCallStunServers(current => addUniqueServer(current, nextValue));
                          setCallStunDraft('');
                          setCallStunDraftError('');
                        }}>
                        <Text style={modalStyles.addServerButtonText}>{t('Add', { _tags: tags })}</Text>
                      </TouchableOpacity>
                    </View>
                    {Boolean(callStunDraftError) && (
                      <Text style={modalStyles.serverInputErrorText}>{callStunDraftError}</Text>
                    )}
                  </View>
                </View>
              )}
              {isTurnSubmenu && (
                <>
                  <View style={modalStyles.submenuItem}>
                    <View style={modalStyles.submenuItemContent}>
                      <Text style={modalStyles.submenuItemText}>{t('Enable External TURN', { _tags: tags })}</Text>
                      <Text style={modalStyles.submenuItemDescription}>
                        {t('Use your own TURN server for call relay fallback.', { _tags: tags })}
                      </Text>
                    </View>
                    <Switch
                      value={callTurnEnabled}
                      onValueChange={(value) => setCallTurnEnabled(Boolean(value))}
                    />
                  </View>
                  <View style={modalStyles.submenuItem}>
                    <View style={modalStyles.submenuItemContent}>
                      <Text style={modalStyles.submenuItemText}>{t('TURN Servers', { _tags: tags })}</Text>
                      <Text style={modalStyles.submenuItemDescription}>
                        {t('Add multiple TURN URLs. Order is used as fallback priority.', { _tags: tags })}
                      </Text>
                      {renderServerRows(callTurnServers, 'turn')}
                      <View style={modalStyles.serverInputRow}>
                        <TextInput
                          style={[
                            modalStyles.submenuInput,
                            modalStyles.serverInput,
                            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                          ]}
                          value={callTurnDraft}
                          onChangeText={(text) => {
                            setCallTurnDraft(text);
                            if (callTurnDraftError) {
                              setCallTurnDraftError('');
                            }
                          }}
                          placeholder="turn:turn.example.com:3478?transport=udp"
                          placeholderTextColor={colors.textSecondary}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TouchableOpacity
                          style={modalStyles.addServerButton}
                          onPress={() => {
                            const nextValue = callTurnDraft.trim();
                            if (!isValidTurnUrl(nextValue)) {
                              setCallTurnDraftError(t('TURN must start with turn: or turns:', { _tags: tags }));
                              return;
                            }
                            setCallTurnServers(current => addUniqueServer(current, nextValue));
                            setCallTurnDraft('');
                            setCallTurnDraftError('');
                          }}>
                          <Text style={modalStyles.addServerButtonText}>{t('Add', { _tags: tags })}</Text>
                        </TouchableOpacity>
                      </View>
                      {Boolean(callTurnDraftError) && (
                        <Text style={modalStyles.serverInputErrorText}>{callTurnDraftError}</Text>
                      )}
                    </View>
                  </View>
                  <View style={modalStyles.submenuItem}>
                    <View style={modalStyles.submenuItemContent}>
                      <Text style={modalStyles.submenuItemText}>{t('TURN Username', { _tags: tags })}</Text>
                      <TextInput
                        style={[
                          modalStyles.submenuInput,
                          { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                        ]}
                        value={callTurnUsername}
                        onChangeText={setCallTurnUsername}
                        placeholder="username"
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                  <View style={modalStyles.submenuItem}>
                    <View style={modalStyles.submenuItemContent}>
                      <Text style={modalStyles.submenuItemText}>{t('TURN Credential', { _tags: tags })}</Text>
                      <TextInput
                        style={[
                          modalStyles.submenuInput,
                          { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                        ]}
                        value={callTurnCredential}
                        onChangeText={setCallTurnCredential}
                        placeholder="credential"
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                </>
              )}
              {!isStunSubmenu && !isTurnSubmenu && activeSubmenu?.submenuItems?.map((subItem) => {
                if (subItem.type === 'switch') {
                  return (
                    <View key={subItem.id} style={modalStyles.submenuItem}>
                      <View style={modalStyles.submenuItemContent}>
                        <Text style={modalStyles.submenuItemText}>{subItem.title}</Text>
                        {subItem.description && (
                          <Text style={modalStyles.submenuItemDescription}>{subItem.description}</Text>
                        )}
                      </View>
                      <Switch
                        value={subItem.value as boolean}
                        onValueChange={(value) => subItem.onValueChange?.(value)}
                        disabled={subItem.disabled}
                      />
                    </View>
                  );
                }
                if (subItem.type === 'input') {
                  return (
                    <View key={subItem.id} style={modalStyles.submenuItem}>
                      <View style={modalStyles.submenuItemContent}>
                        <Text style={modalStyles.submenuItemText}>{subItem.title}</Text>
                        {subItem.description && (
                          <Text style={modalStyles.submenuItemDescription}>{subItem.description}</Text>
                        )}
                        <TextInput
                          style={[
                            modalStyles.submenuInput,
                            subItem.disabled && modalStyles.disabledInput,
                            { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
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
                    </View>
                  );
                }
                return (
                  <TouchableOpacity
                    key={subItem.id}
                    style={modalStyles.submenuItem}
                    onPress={() => {
                      subItem.onPress?.();
                      if (subItem.type !== 'switch' && subItem.type !== 'input') {
                        setShowSubmenu(null);
                      }
                    }}
                    disabled={subItem.disabled}>
                    <View style={modalStyles.submenuItemContent}>
                      <Text style={[modalStyles.submenuItemText, subItem.disabled && modalStyles.disabledText]}>
                        {subItem.title}
                      </Text>
                      {subItem.description && (
                        <Text style={[modalStyles.submenuItemDescription, subItem.disabled && modalStyles.disabledText]}>
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
    </View>
  );
};

const createModalStyles = (colors: any) => StyleSheet.create({
  submenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submenuContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submenuHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  submenuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  closeButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  submenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  submenuItemContent: {
    flexDirection: 'column',
  },
  submenuItemText: {
    fontSize: 14,
    color: colors.text,
  },
  submenuItemDescription: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  submenuInput: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  disabledText: {
    color: colors.textSecondary,
    opacity: 0.6,
  },
  disabledInput: {
    opacity: 0.6,
  },
  emptyStateBox: {
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 6,
    borderColor: colors.border,
  },
  serverRow: {
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  serverIndexBadge: {
    alignSelf: 'flex-start',
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  serverIndexText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  serverRowText: {
    marginTop: 6,
    color: colors.text,
    fontSize: 13,
  },
  serverRowActions: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  serverActionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  serverActionButtonDisabled: {
    opacity: 0.45,
  },
  serverActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  serverActionButtonDanger: {
    borderWidth: 1,
    borderColor: '#bf3f3f',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  serverActionTextDanger: {
    color: '#bf3f3f',
    fontSize: 12,
    fontWeight: '600',
  },
  serverInputRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverInput: {
    flex: 1,
    marginTop: 0,
  },
  addServerButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginLeft: 8,
  },
  addServerButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  serverInputErrorText: {
    marginTop: 6,
    color: '#bf3f3f',
    fontSize: 12,
  },
});
