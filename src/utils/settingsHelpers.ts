/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Utility functions for SettingsScreen and related components
 */

import { SettingItem, SettingsSection } from '../types/settings';

/**
 * Icon mapping for section headers
 */
export interface SectionIcon {
  name: string;
  solid?: boolean;
}

/**
 * Get icon information for a section by ID
 * Uses section ID (not translated title) for consistent icon mapping across languages
 */
export const getSectionIcon = (sectionId: string): SectionIcon | null => {
  const iconMap: Record<string, SectionIcon | null> = {
    'premium': null, // No icon for Premium as requested
    'appearance': { name: 'palette', solid: true },
    'znc-subscription': { name: 'server', solid: false },
    'display-ui': { name: 'desktop', solid: false },
    'messages-history': { name: 'history', solid: false },
    'media': { name: 'image', solid: false },
    'notifications': { name: 'bell', solid: true },
    'away': { name: 'clock', solid: false },
    'protection': { name: 'shield-alt', solid: false },
    'writing': { name: 'pen-fancy', solid: false },
    'highlighting': { name: 'highlighter', solid: false },
    'connection-network': { name: 'network-wired', solid: false },
    'security': { name: 'shield-alt', solid: true },
    'users-services': { name: 'users', solid: false },
    'commands': { name: 'terminal', solid: false },
    'performance': { name: 'tachometer-alt', solid: false },
    'background-battery': { name: 'battery-full', solid: false },
    'scripting-ads': { name: 'code', solid: false },
    'privacy-legal': { name: 'lock', solid: false },
    'development': { name: 'tools', solid: false },
    'about': { name: 'info-circle', solid: true },
    'help': { name: 'question-circle', solid: false },
  };

  return iconMap[sectionId] || null;
};

/**
 * Check if a string matches a search term (case-insensitive)
 */
export const matches = (text: string | undefined, term: string): boolean => {
  if (!text) return false;
  return text.toLowerCase().includes(term.toLowerCase());
};

/**
 * Filter settings sections based on search term
 */
export const filterSettings = (
  sections: SettingsSection[],
  searchTerm: string
): SettingsSection[] => {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return sections;

  return sections
    .map(section => {
      // If section title matches, include all items
      if (matches(section.title, term)) {
        return section;
      }

      // Otherwise filter items
      const data = section.data.filter(item => {
        const selfMatch = matches(item.title, term) || matches(item.description, term);
        const subMatch = item.submenuItems?.some(sub =>
          matches(sub.title, term) || matches(sub.description, term)
        );
        // Also check search keywords
        const keywordMatch = item.searchKeywords?.some(keyword =>
          matches(keyword, term)
        );
        return selfMatch || subMatch || keywordMatch;
      });
      return data.length > 0 ? { ...section, data } : null;
    })
    .filter((section): section is SettingsSection => section !== null);
};

/**
 * Order sections based on user status and preferences
 * Premium sections come first, then standard sections
 * Uses section ID (not translated title) for consistent ordering across languages
 */
export const orderSections = (
  sections: SettingsSection[],
  isSupporter: boolean = false,
  hasNoAds: boolean = false,
  hasScriptingPro: boolean = false
): SettingsSection[] => {
  // Check if user has any premium status
  const isPremiumUser = isSupporter || hasNoAds || hasScriptingPro;

  // Define section order by ID - Premium at top for non-paying, at bottom for paying
  const sectionOrderForPremium: string[] = [
    'premium',                    // Premium features first for non-paying users
    'znc-subscription',
    'appearance',
    'display-ui',
    'messages-history',
    'media',
    'notifications',
    'away',
    'protection',
    'writing',
    'highlighting',
    'connection-network',
    'security',
    'users-services',
    'commands',
    'performance',
    'background-battery',
    'scripting-ads',
    'privacy-legal',
    'development',
    'about',
    'help',
  ];

  const sectionOrderForRegular: string[] = [
    'appearance',
    'display-ui',
    'messages-history',
    'media',
    'notifications',
    'away',
    'protection',
    'writing',
    'highlighting',
    'connection-network',
    'security',
    'users-services',
    'commands',
    'performance',
    'background-battery',
    'scripting-ads',
    'privacy-legal',
    'development',
    'about',
    'help',
    'premium',                    // Premium at bottom for paying users
    'znc-subscription',
  ];

  // Choose order based on premium status
  const sectionOrder = isPremiumUser ? sectionOrderForRegular : sectionOrderForPremium;

  // Sort sections based on order using section ID
  const ordered = [...sections].sort((a, b) => {
    const aIndex = sectionOrder.indexOf(a.id);
    const bIndex = sectionOrder.indexOf(b.id);

    // If both are in order, use order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // If only one is in order, prioritize it
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    // If neither is in order, maintain original order
    return 0;
  });

  return ordered;
};

/**
 * Validate setting value based on type
 */
export const validateSetting = (
  value: any,
  type: 'string' | 'number' | 'boolean' | 'array'
): boolean => {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    default:
      return false;
  }
};

/**
 * Format setting description with dynamic values
 */
export const formatSettingDescription = (
  template: string,
  values: Record<string, string | number | boolean>
): string => {
  let formatted = template;
  Object.entries(values).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    // Avoid runtime regex errors when placeholder contains regex metacharacters.
    formatted = formatted.split(placeholder).join(String(value));
  });
  return formatted;
};

/**
 * Build global proxy configuration object
 */
export interface GlobalProxyConfig {
  enabled: boolean;
  type: 'socks5' | 'socks4' | 'http';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export interface GlobalProxyInputs {
  enabled: boolean;
  type: string;
  host: string;
  port: string;
  username: string;
  password: string;
}

export const buildGlobalProxyConfig = (
  inputs: GlobalProxyInputs,
  overrides?: Partial<GlobalProxyInputs>
): GlobalProxyConfig => {
  const enabled = overrides?.enabled ?? inputs.enabled;
  const type = ((overrides?.type ?? inputs.type) || 'socks5') as 'socks5' | 'socks4' | 'http';
  const host = (overrides?.host ?? inputs.host)?.trim() || undefined;
  const portStr = overrides?.port ?? inputs.port;
  const username = (overrides?.username ?? inputs.username)?.trim() || undefined;
  const password = (overrides?.password ?? inputs.password)?.trim() || undefined;

  const port = portStr ? parseInt(portStr, 10) : undefined;
  const validPort = port && !isNaN(port) && port > 0 && port <= 65535 ? port : undefined;

  return {
    enabled,
    type,
    host,
    port: validPort,
    username,
    password,
  };
};

/**
 * Toggle section expansion state
 */
export const toggleSectionExpansion = (
  sectionTitle: string,
  expandedSections: Set<string>
): Set<string> => {
  const newExpandedSections = new Set(expandedSections);
  if (newExpandedSections.has(sectionTitle)) {
    newExpandedSections.delete(sectionTitle);
  } else {
    newExpandedSections.add(sectionTitle);
  }
  return newExpandedSections;
};

/**
 * Get setting icon from item or fallback to default
 */
export const getSettingIcon = (
  item: SettingItem,
  iconMap: Record<string, any>,
  defaultIcon?: any
): any => {
  // If item has explicit icon, use it
  if (typeof item.icon === 'object' && item.icon) {
    return item.icon;
  }
  
  // Check icon map
  if (iconMap[item.id]) {
    return iconMap[item.id];
  }
  
  // Return default icon if provided
  return defaultIcon;
};
