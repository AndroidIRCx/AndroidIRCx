/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for settings utility functions
 */

import {
  getSectionIcon,
  matches,
  filterSettings,
  orderSections,
  validateSetting,
  formatSettingDescription,
  buildGlobalProxyConfig,
  toggleSectionExpansion,
  getSettingIcon,
  GlobalProxyInputs,
} from '../../src/utils/settingsHelpers';
import { SettingsSection, SettingItem } from '../../src/types/settings';

describe('settingsHelpers', () => {
  describe('getSectionIcon', () => {
    it('should return correct icon for known sections', () => {
      expect(getSectionIcon('appearance')).toEqual({ name: 'palette', solid: true });
      expect(getSectionIcon('notifications')).toEqual({ name: 'bell', solid: true });
      expect(getSectionIcon('security')).toEqual({ name: 'shield-alt', solid: true });
      expect(getSectionIcon('about')).toEqual({ name: 'info-circle', solid: true });
    });

    it('should return null for unknown sections', () => {
      expect(getSectionIcon('unknown-section')).toBeNull();
    });

    it('should return null for premium section (by design)', () => {
      expect(getSectionIcon('premium')).toBeNull();
    });

    it('should handle all defined sections', () => {
      const sections = [
        'appearance',
        'display-ui',
        'notifications',
        'messages-history',
        'connection-network',
        'security',
        'users-services',
        'commands',
        'highlighting',
        'background-battery',
        'performance',
        'privacy-legal',
        'about',
        'znc-subscription',
      ];

      sections.forEach(section => {
        const icon = getSectionIcon(section);
        // Icon can be null (like premium) or have name property
        if (icon !== null) {
          expect(icon).toHaveProperty('name');
        }
      });
    });
  });

  describe('matches', () => {
    it('should match case-insensitively', () => {
      expect(matches('Hello World', 'hello')).toBe(true);
      expect(matches('Hello World', 'WORLD')).toBe(true);
      expect(matches('Hello World', 'HELLO WORLD')).toBe(true);
    });

    it('should match partial strings', () => {
      expect(matches('Hello World', 'ello')).toBe(true);
      expect(matches('Hello World', 'orld')).toBe(true);
    });

    it('should return false for no match', () => {
      expect(matches('Hello World', 'xyz')).toBe(false);
      expect(matches('Hello World', 'test')).toBe(false);
    });

    it('should handle undefined and empty strings', () => {
      expect(matches(undefined, 'test')).toBe(false);
      expect(matches('', 'test')).toBe(false);
      expect(matches('test', '')).toBe(true); // Empty string matches everything
    });
  });

  describe('filterSettings', () => {
    const mockSections: SettingsSection[] = [
      {
        title: 'Appearance',
        data: [
          {
            id: 'theme',
            title: 'Theme',
            description: 'Choose your theme',
            type: 'button',
          },
          {
            id: 'font-size',
            title: 'Font Size',
            description: 'Adjust font size',
            type: 'submenu',
            submenuItems: [
              {
                id: 'small',
                title: 'Small',
                description: 'Small font',
                type: 'button',
              },
            ],
          },
        ],
      },
      {
        title: 'Notifications',
        data: [
          {
            id: 'notifications-enabled',
            title: 'Enable Notifications',
            description: 'Turn on notifications',
            type: 'switch',
            value: true,
          },
        ],
      },
    ];

    it('should return all sections when search term is empty', () => {
      const result = filterSettings(mockSections, '');
      expect(result).toEqual(mockSections);
    });

    it('should filter sections by title', () => {
      const result = filterSettings(mockSections, 'appearance');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Appearance');
    });

    it('should filter sections by item title', () => {
      const result = filterSettings(mockSections, 'theme');
      expect(result).toHaveLength(1);
      expect(result[0].data).toHaveLength(1);
      expect(result[0].data[0].id).toBe('theme');
    });

    it('should filter sections by item description', () => {
      const result = filterSettings(mockSections, 'choose');
      expect(result).toHaveLength(1);
      expect(result[0].data).toHaveLength(1);
    });

    it('should filter sections by submenu items', () => {
      const result = filterSettings(mockSections, 'small');
      expect(result).toHaveLength(1);
      expect(result[0].data).toHaveLength(1);
      expect(result[0].data[0].id).toBe('font-size');
    });

    it('should return empty array when no matches', () => {
      const result = filterSettings(mockSections, 'xyz123');
      expect(result).toHaveLength(0);
    });

    it('should handle case-insensitive search', () => {
      const result = filterSettings(mockSections, 'THEME');
      expect(result).toHaveLength(1);
    });
  });

  describe('orderSections', () => {
    const mockSections: SettingsSection[] = [
      { id: 'about', title: 'About', data: [] },
      { id: 'appearance', title: 'Appearance', data: [] },
      { id: 'security', title: 'Security', data: [] },
      { id: 'premium', title: 'Premium', data: [] },
      { id: 'performance', title: 'Performance', data: [] },
    ];

    it('should order sections correctly for premium users (premium at bottom)', () => {
      // With isSupporter=true, Premium should be at the bottom
      const result = orderSections(mockSections, true, false);
      const lastIndex = result.findIndex(s => s.id === 'premium');
      expect(lastIndex).toBe(result.length - 1);
    });

    it('should order sections correctly for non-premium users (premium at top)', () => {
      // With isSupporter=false, Premium should be at the top
      const result = orderSections(mockSections, false, false);
      const premiumIndex = result.findIndex(s => s.id === 'premium');
      expect(premiumIndex).toBe(0);
    });

    it('should include Premium section for supporters', () => {
      const result = orderSections(mockSections, true, false);
      const premiumSection = result.find(s => s.id === 'premium');
      expect(premiumSection).toBeDefined();
    });

    it('should include Premium section for users with no ads', () => {
      const result = orderSections(mockSections, false, true);
      const premiumSection = result.find(s => s.id === 'premium');
      expect(premiumSection).toBeDefined();
    });

    it('should maintain order for sections not in predefined order', () => {
      const customSections: SettingsSection[] = [
        { id: 'custom-1', title: 'Custom Section 1', data: [] },
        { id: 'custom-2', title: 'Custom Section 2', data: [] },
      ];
      const result = orderSections(customSections);
      expect(result[0].id).toBe('custom-1');
      expect(result[1].id).toBe('custom-2');
    });
  });

  describe('validateSetting', () => {
    it('should validate string type', () => {
      expect(validateSetting('hello', 'string')).toBe(true);
      expect(validateSetting(123, 'string')).toBe(false);
      expect(validateSetting(true, 'string')).toBe(false);
    });

    it('should validate number type', () => {
      expect(validateSetting(123, 'number')).toBe(true);
      expect(validateSetting(0, 'number')).toBe(true);
      expect(validateSetting('123', 'number')).toBe(false);
      expect(validateSetting(NaN, 'number')).toBe(false);
    });

    it('should validate boolean type', () => {
      expect(validateSetting(true, 'boolean')).toBe(true);
      expect(validateSetting(false, 'boolean')).toBe(true);
      expect(validateSetting(1, 'boolean')).toBe(false);
      expect(validateSetting('true', 'boolean')).toBe(false);
    });

    it('should validate array type', () => {
      expect(validateSetting([], 'array')).toBe(true);
      expect(validateSetting([1, 2, 3], 'array')).toBe(true);
      expect(validateSetting('[]', 'array')).toBe(false);
      expect(validateSetting({}, 'array')).toBe(false);
    });
  });

  describe('formatSettingDescription', () => {
    it('should replace placeholders with values', () => {
      const template = 'You have {count} messages in {channel}';
      const values = { count: 5, channel: '#general' };
      const result = formatSettingDescription(template, values);
      expect(result).toBe('You have 5 messages in #general');
    });

    it('should handle multiple occurrences of same placeholder', () => {
      const template = '{name} says hello to {name}';
      const values = { name: 'Alice' };
      const result = formatSettingDescription(template, values);
      expect(result).toBe('Alice says hello to Alice');
    });

    it('should handle missing placeholders', () => {
      const template = 'Hello {name}';
      const values = { other: 'value' };
      const result = formatSettingDescription(template, values);
      expect(result).toBe('Hello {name}');
    });

    it('should handle empty template', () => {
      const result = formatSettingDescription('', {});
      expect(result).toBe('');
    });
  });

  describe('buildGlobalProxyConfig', () => {
    const mockInputs: GlobalProxyInputs = {
      enabled: true,
      type: 'socks5',
      host: 'proxy.example.com',
      port: '1080',
      username: 'user',
      password: 'pass',
    };

    it('should build config from inputs', () => {
      const result = buildGlobalProxyConfig(mockInputs);
      expect(result).toEqual({
        enabled: true,
        type: 'socks5',
        host: 'proxy.example.com',
        port: 1080,
        username: 'user',
        password: 'pass',
      });
    });

    it('should apply overrides', () => {
      const result = buildGlobalProxyConfig(mockInputs, { enabled: false, port: '8080' });
      expect(result.enabled).toBe(false);
      expect(result.port).toBe(8080);
    });

    it('should trim host, username, and password', () => {
      const inputs: GlobalProxyInputs = {
        ...mockInputs,
        host: '  proxy.example.com  ',
        username: '  user  ',
        password: '  pass  ',
      };
      const result = buildGlobalProxyConfig(inputs);
      expect(result.host).toBe('proxy.example.com');
      expect(result.username).toBe('user');
      expect(result.password).toBe('pass');
    });

    it('should convert port string to number', () => {
      const result = buildGlobalProxyConfig(mockInputs);
      expect(typeof result.port).toBe('number');
      expect(result.port).toBe(1080);
    });

    it('should handle invalid port', () => {
      const inputs: GlobalProxyInputs = { ...mockInputs, port: 'invalid' };
      const result = buildGlobalProxyConfig(inputs);
      expect(result.port).toBeUndefined();
    });

    it('should handle empty strings as undefined', () => {
      const inputs: GlobalProxyInputs = {
        ...mockInputs,
        host: '',
        username: '',
        password: '',
      };
      const result = buildGlobalProxyConfig(inputs);
      expect(result.host).toBeUndefined();
      expect(result.username).toBeUndefined();
      expect(result.password).toBeUndefined();
    });

    it('should default to socks5 type', () => {
      const inputs: GlobalProxyInputs = { ...mockInputs, type: '' };
      const result = buildGlobalProxyConfig(inputs);
      expect(result.type).toBe('socks5');
    });
  });

  describe('toggleSectionExpansion', () => {
    it('should add section to expanded set', () => {
      const expanded = new Set<string>(['Appearance']);
      const result = toggleSectionExpansion('Security', expanded);
      expect(result.has('Security')).toBe(true);
      expect(result.has('Appearance')).toBe(true);
    });

    it('should remove section from expanded set', () => {
      const expanded = new Set<string>(['Appearance', 'Security']);
      const result = toggleSectionExpansion('Security', expanded);
      expect(result.has('Security')).toBe(false);
      expect(result.has('Appearance')).toBe(true);
    });

    it('should handle empty expanded set', () => {
      const expanded = new Set<string>();
      const result = toggleSectionExpansion('Security', expanded);
      expect(result.has('Security')).toBe(true);
    });
  });

  describe('getSettingIcon', () => {
    const mockIconMap = {
      'setting-1': { name: 'icon1', solid: true },
      'setting-2': { name: 'icon2', solid: false },
    };

    it('should return icon from item if present', () => {
      const item: SettingItem = {
        id: 'test',
        title: 'Test',
        type: 'button',
        icon: { name: 'custom-icon', solid: true },
      };
      const result = getSettingIcon(item, mockIconMap);
      expect(result).toEqual({ name: 'custom-icon', solid: true });
    });

    it('should return icon from map if item has no icon', () => {
      const item: SettingItem = {
        id: 'setting-1',
        title: 'Test',
        type: 'button',
      };
      const result = getSettingIcon(item, mockIconMap);
      expect(result).toEqual({ name: 'icon1', solid: true });
    });

    it('should return default icon if no match', () => {
      const item: SettingItem = {
        id: 'unknown',
        title: 'Test',
        type: 'button',
      };
      const defaultIcon = { name: 'default', solid: false };
      const result = getSettingIcon(item, mockIconMap, defaultIcon);
      expect(result).toEqual(defaultIcon);
    });

    it('should return undefined if no icon found and no default', () => {
      const item: SettingItem = {
        id: 'unknown',
        title: 'Test',
        type: 'button',
      };
      const result = getSettingIcon(item, mockIconMap);
      expect(result).toBeUndefined();
    });
  });
});
