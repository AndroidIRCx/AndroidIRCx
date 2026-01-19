import { SettingIcon } from '../types/settings';

/**
 * Icon mappings for settings items
 * Maps setting ID to icon configuration
 */
export const SETTINGS_ICONS: Record<string, SettingIcon> = {
  'display-theme': { name: 'palette', solid: true },
  'app-language': { name: 'globe', solid: false },
  'connection-global-proxy': { name: 'network-wired', solid: false },
  'connection-auto-reconnect': { name: 'sync-alt', solid: false },
  'connection-quality': { name: 'signal', solid: false },
  'notifications-enabled': { name: 'bell', solid: false },
  'notifications-per-channel': { name: 'bullhorn', solid: false },
  'notifications-sounds': { name: 'volume-up', solid: false },
  'security-app-lock': { name: 'lock', solid: true },
  'security-manage-keys': { name: 'key', solid: true },
  'history-backup': { name: 'save', solid: false },
  'history-export': { name: 'file-export', solid: false },
  'identity-profiles': { name: 'user', solid: false },
  'about-app': { name: 'info-circle', solid: false },
};

/**
 * Get icon for a setting by ID
 */
export const getSettingIcon = (settingId: string): SettingIcon | undefined => {
  return SETTINGS_ICONS[settingId];
};
