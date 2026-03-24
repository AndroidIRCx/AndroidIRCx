/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SETTINGS_ICONS, getSettingIcon } from '../../src/config/settingsIcons';

describe('Config - settingsIcons', () => {
  describe('SETTINGS_ICONS', () => {
    it('should export SETTINGS_ICONS constant', () => {
      expect(SETTINGS_ICONS).toBeDefined();
      expect(typeof SETTINGS_ICONS).toBe('object');
    });

    it('should have display-theme icon', () => {
      expect(SETTINGS_ICONS['display-theme']).toEqual({
        name: 'palette',
        solid: true,
      });
    });

    it('should have app-language icon', () => {
      expect(SETTINGS_ICONS['app-language']).toEqual({
        name: 'globe',
        solid: false,
      });
    });

    describe('Appearance icons', () => {
      it('should have layout icons', () => {
        expect(SETTINGS_ICONS['layout-tab-position']).toBeDefined();
        expect(SETTINGS_ICONS['layout-userlist-position']).toBeDefined();
        expect(SETTINGS_ICONS['layout-userlist-size']).toBeDefined();
        expect(SETTINGS_ICONS['layout-view-mode']).toBeDefined();
        expect(SETTINGS_ICONS['layout-font-size']).toBeDefined();
      });

      it('should have correct layout-tab-position icon', () => {
        expect(SETTINGS_ICONS['layout-tab-position']).toEqual({
          name: 'columns',
          solid: false,
        });
      });
    });

    describe('Display & UI icons', () => {
      it('should have display icons', () => {
        expect(SETTINGS_ICONS['display-tab-sort']).toBeDefined();
        expect(SETTINGS_ICONS['display-raw']).toBeDefined();
        expect(SETTINGS_ICONS['display-timestamps']).toBeDefined();
        expect(SETTINGS_ICONS['display-encryption-icons']).toBeDefined();
        expect(SETTINGS_ICONS['display-typing-indicators']).toBeDefined();
      });

      it('should have correct display-raw icon', () => {
        expect(SETTINGS_ICONS['display-raw']).toEqual({
          name: 'terminal',
          solid: false,
        });
      });
    });

    describe('Connection & Network icons', () => {
      it('should have connection icons', () => {
        expect(SETTINGS_ICONS['connection-global-proxy']).toBeDefined();
        expect(SETTINGS_ICONS['connection-auto-reconnect']).toBeDefined();
        expect(SETTINGS_ICONS['connection-quality']).toBeDefined();
        expect(SETTINGS_ICONS['connection-dcc']).toBeDefined();
        expect(SETTINGS_ICONS['identity-profiles']).toBeDefined();
      });

      it('should have correct connection-global-proxy icon', () => {
        expect(SETTINGS_ICONS['connection-global-proxy']).toEqual({
          name: 'network-wired',
          solid: false,
        });
      });

      it('should have quick-connect-network icon', () => {
        expect(SETTINGS_ICONS['quick-connect-network']).toEqual({
          name: 'bolt',
          solid: false,
        });
      });
    });

    describe('Notifications icons', () => {
      it('should have notification icons', () => {
        expect(SETTINGS_ICONS['notifications-enabled']).toBeDefined();
        expect(SETTINGS_ICONS['notifications-mentions']).toBeDefined();
        expect(SETTINGS_ICONS['notifications-private']).toBeDefined();
        expect(SETTINGS_ICONS['notifications-sounds']).toBeDefined();
      });

      it('should have correct notifications-enabled icon', () => {
        expect(SETTINGS_ICONS['notifications-enabled']).toEqual({
          name: 'bell',
          solid: false,
        });
      });
    });

    describe('Security icons', () => {
      it('should have security icons', () => {
        expect(SETTINGS_ICONS['security-app-lock']).toBeDefined();
        expect(SETTINGS_ICONS['security-manage-keys']).toBeDefined();
        expect(SETTINGS_ICONS['security-app-lock-biometric']).toBeDefined();
        expect(SETTINGS_ICONS['security-app-lock-pin']).toBeDefined();
      });

      it('should have correct security-app-lock icon (solid)', () => {
        expect(SETTINGS_ICONS['security-app-lock']).toEqual({
          name: 'lock',
          solid: true,
        });
      });

      it('should have correct security-app-lock-biometric icon', () => {
        expect(SETTINGS_ICONS['security-app-lock-biometric']).toEqual({
          name: 'fingerprint',
          solid: false,
        });
      });
    });

    describe('Media icons', () => {
      it('should have media icons', () => {
        expect(SETTINGS_ICONS['media-enabled']).toBeDefined();
        expect(SETTINGS_ICONS['media-auto-download']).toBeDefined();
        expect(SETTINGS_ICONS['media-wifi-only']).toBeDefined();
        expect(SETTINGS_ICONS['media-cache-size']).toBeDefined();
        expect(SETTINGS_ICONS['video-quality']).toBeDefined();
      });

      it('should have correct media-enabled icon', () => {
        expect(SETTINGS_ICONS['media-enabled']).toEqual({
          name: 'photo-video',
          solid: false,
        });
      });
    });

    describe('Background & Battery icons', () => {
      it('should have background icons', () => {
        expect(SETTINGS_ICONS['background-keep-alive']).toBeDefined();
        expect(SETTINGS_ICONS['background-battery-status']).toBeDefined();
      });

      it('should have correct background-keep-alive icon', () => {
        expect(SETTINGS_ICONS['background-keep-alive']).toEqual({
          name: 'heartbeat',
          solid: false,
        });
      });
    });

    describe('Messages & History icons', () => {
      it('should have message icons', () => {
        expect(SETTINGS_ICONS['messages-part']).toBeDefined();
        expect(SETTINGS_ICONS['messages-quit']).toBeDefined();
        expect(SETTINGS_ICONS['messages-hide-join']).toBeDefined();
        expect(SETTINGS_ICONS['history-backup']).toBeDefined();
        expect(SETTINGS_ICONS['history-export']).toBeDefined();
      });

      it('should have correct history-backup icon', () => {
        expect(SETTINGS_ICONS['history-backup']).toEqual({
          name: 'save',
          solid: false,
        });
      });
    });

    describe('Premium icons', () => {
      it('should have premium-upgrade icon (solid)', () => {
        expect(SETTINGS_ICONS['premium-upgrade']).toEqual({
          name: 'gem',
          solid: true,
        });
      });
    });

    describe('About icons', () => {
      it('should have about icons', () => {
        expect(SETTINGS_ICONS['about-app']).toBeDefined();
        expect(SETTINGS_ICONS.credits).toBeDefined();
      });

      it('should have correct about-app icon', () => {
        expect(SETTINGS_ICONS['about-app']).toEqual({
          name: 'info-circle',
          solid: false,
        });
      });
    });

    it('should have kill-switch icons', () => {
      expect(SETTINGS_ICONS['kill-switch-header']).toBeDefined();
      expect(SETTINGS_ICONS['kill-switch-lockscreen']).toBeDefined();
      expect(SETTINGS_ICONS['kill-switch-warnings']).toBeDefined();
    });

    it('should have all icons with name and solid properties', () => {
      Object.entries(SETTINGS_ICONS).forEach(([_key, icon]) => {
        expect(icon).toHaveProperty('name');
        expect(icon).toHaveProperty('solid');
        expect(typeof icon.name).toBe('string');
        expect(typeof icon.solid).toBe('boolean');
      });
    });
  });

  describe('getSettingIcon', () => {
    it('should be exported as a function', () => {
      expect(typeof getSettingIcon).toBe('function');
    });

    it('should return icon for existing setting ID', () => {
      const icon = getSettingIcon('display-theme');

      expect(icon).toEqual({
        name: 'palette',
        solid: true,
      });
    });

    it('should return undefined for non-existing setting ID', () => {
      const icon = getSettingIcon('non-existing-id');

      expect(icon).toBeUndefined();
    });

    it('should return correct icon for security-manage-keys', () => {
      const icon = getSettingIcon('security-manage-keys');

      expect(icon).toEqual({
        name: 'key',
        solid: true,
      });
    });

    it('should return correct icon for notifications-mentions', () => {
      const icon = getSettingIcon('notifications-mentions');

      expect(icon).toEqual({
        name: 'at',
        solid: false,
      });
    });

    it('should handle empty string', () => {
      const icon = getSettingIcon('');

      expect(icon).toBeUndefined();
    });
  });
});
