import { SettingIcon } from '../types/settings';

/**
 * Icon mappings for settings items
 * Maps setting ID to icon configuration
 */
export const SETTINGS_ICONS: Record<string, SettingIcon> = {
  // Appearance
  'display-theme': { name: 'palette', solid: true },
  'app-language': { name: 'globe', solid: false },
  'layout-tab-position': { name: 'columns', solid: false },
  'layout-userlist-position': { name: 'users', solid: false },
  'layout-view-mode': { name: 'th-large', solid: false },
  'layout-font-size': { name: 'font', solid: false },
  'header-search-button': { name: 'search', solid: false },
  'message-area-search-button': { name: 'search', solid: false },
  'layout-message-spacing': { name: 'text-height', solid: false },
  'layout-message-padding': { name: 'expand', solid: false },

  // Display & UI
  'display-tab-sort': { name: 'sort', solid: false },
  'display-raw': { name: 'terminal', solid: false },
  'display-raw-categories': { name: 'filter', solid: false },
  'display-notices': { name: 'comment-alt', solid: false },
  'display-timestamps': { name: 'clock', solid: false },
  'display-encryption-icons': { name: 'shield-alt', solid: false },
  'display-typing-indicators': { name: 'ellipsis-h', solid: false },
  'display-send-button': { name: 'paper-plane', solid: false },
  'display-banner-position': { name: 'arrows-alt-v', solid: false },
  'display-keyboard-avoiding': { name: 'keyboard', solid: false },

  // Connection & Network
  'connection-global-proxy': { name: 'network-wired', solid: false },
  'connection-auto-reconnect': { name: 'sync-alt', solid: false },
  'connection-quality': { name: 'signal', solid: false },
  'connection-dcc': { name: 'exchange-alt', solid: false },
  'connection-auto-connect-favorite': { name: 'star', solid: false },
  'setup-wizard': { name: 'magic', solid: false },
  'identity-profiles': { name: 'user', solid: false },
  'channel-favorites': { name: 'star', solid: true },
  'channel-auto-join-favorites': { name: 'sign-in-alt', solid: false },
  'channel-auto-rejoin': { name: 'redo', solid: false },
  'channel-auto-voice': { name: 'microphone', solid: false },

  // Notifications
  'notifications-enabled': { name: 'bell', solid: false },
  'notifications-mentions': { name: 'at', solid: false },
  'notifications-private': { name: 'envelope', solid: false },
  'notifications-all': { name: 'inbox', solid: false },
  'notifications-dnd': { name: 'moon', solid: false },
  'notifications-per-channel': { name: 'bullhorn', solid: false },
  'notifications-sounds': { name: 'volume-up', solid: false },

  // Background & Battery
  'background-keep-alive': { name: 'heartbeat', solid: false },
  'background-battery-status': { name: 'battery-half', solid: false },
  'background-battery-settings': { name: 'cog', solid: false },

  // Messages & History
  'messages-part': { name: 'sign-out-alt', solid: false },
  'messages-quit': { name: 'power-off', solid: false },
  'messages-hide-join': { name: 'eye-slash', solid: false },
  'messages-hide-part': { name: 'eye-slash', solid: false },
  'messages-hide-quit': { name: 'eye-slash', solid: false },
  'messages-hide-irc-listener': { name: 'eye-slash', solid: false },
  'messages-close-private-enabled': { name: 'times-circle', solid: false },
  'history-backup': { name: 'save', solid: false },
  'history-export': { name: 'file-export', solid: false },

  // Highlighting
  'highlight-add': { name: 'highlighter', solid: false },

  // Users & Services
  'irc-services-add': { name: 'plus-circle', solid: false },
  'user-ignore': { name: 'user-slash', solid: false },
  'user-notes': { name: 'sticky-note', solid: false },
  'user-aliases': { name: 'id-badge', solid: false },

  // Security
  'security-app-lock': { name: 'lock', solid: true },
  'security-manage-keys': { name: 'key', solid: true },
  'security-migrate-keys': { name: 'exchange-alt', solid: false },
  'security-qr': { name: 'qrcode', solid: false },
  'security-file': { name: 'file-import', solid: false },
  'security-nfc': { name: 'broadcast-tower', solid: false },
  'security-app-lock-biometric': { name: 'fingerprint', solid: false },
  'security-app-lock-pin': { name: 'th', solid: false },
  'security-app-lock-launch': { name: 'door-open', solid: false },
  'security-app-lock-background': { name: 'shield-alt', solid: false },
  'security-app-lock-now': { name: 'lock', solid: false },

  // Quick Connect & Kill Switch
  'quick-connect-network': { name: 'bolt', solid: false },
  'kill-switch-header': { name: 'exclamation-triangle', solid: false },
  'kill-switch-lockscreen': { name: 'mobile-alt', solid: false },
  'kill-switch-warnings': { name: 'exclamation-circle', solid: false },

  // Media
  'media-enabled': { name: 'photo-video', solid: false },
  'media-auto-download': { name: 'download', solid: false },
  'media-wifi-only': { name: 'wifi', solid: false },
  'media-cache-size': { name: 'hdd', solid: false },
  'media-quality': { name: 'sliders-h', solid: false },
  'video-quality': { name: 'video', solid: false },
  'voice-max-duration': { name: 'microphone-alt', solid: false },
  'media-clear-cache': { name: 'trash', solid: false },

  // Commands
  'commands-history': { name: 'history', solid: false },
  'commands-aliases': { name: 'terminal', solid: false },
  'commands-custom': { name: 'plus-circle', solid: false },

  // Scripting & Ads
  'advanced-scripts': { name: 'code', solid: false },
  'advanced-scripts-help': { name: 'question-circle', solid: false },
  'watch-ad-button': { name: 'play-circle', solid: false },
  'watch-ad-button-premium': { name: 'play-circle', solid: false },

  // Privacy & Legal
  'my-data-privacy': { name: 'user-shield', solid: false },
  'privacy-ads': { name: 'ad', solid: false },

  // Premium
  'premium-upgrade': { name: 'gem', solid: true },

  // About
  'about-app': { name: 'info-circle', solid: false },
  'credits': { name: 'hands-helping', solid: true },
};

/**
 * Get icon for a setting by ID
 */
export const getSettingIcon = (settingId: string): SettingIcon | undefined => {
  return SETTINGS_ICONS[settingId];
};
