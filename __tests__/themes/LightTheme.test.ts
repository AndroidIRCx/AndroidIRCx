/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LIGHT_THEME } from '../../src/themes/LightTheme';

describe('Themes - LightTheme', () => {
  it('should export LIGHT_THEME constant', () => {
    expect(LIGHT_THEME).toBeDefined();
    expect(typeof LIGHT_THEME).toBe('object');
  });

  it('should have correct theme metadata', () => {
    expect(LIGHT_THEME.id).toBe('light');
    expect(LIGHT_THEME.isCustom).toBe(false);
    expect(typeof LIGHT_THEME.name).toBe('string');
  });

  describe('Background colors', () => {
    it('should have light background colors', () => {
      expect(LIGHT_THEME.colors.background).toBe('#FFFFFF');
      expect(LIGHT_THEME.colors.surface).toBe('#FAFAFA');
      expect(LIGHT_THEME.colors.surfaceVariant).toBe('#F5F5F5');
      expect(LIGHT_THEME.colors.surfaceAlt).toBe('#FFFFFF');
      expect(LIGHT_THEME.colors.cardBackground).toBe('#FFFFFF');
    });
  });

  describe('Text colors', () => {
    it('should have dark text colors for light theme', () => {
      expect(LIGHT_THEME.colors.text).toBe('#212121');
      expect(LIGHT_THEME.colors.textSecondary).toBe('#757575');
      expect(LIGHT_THEME.colors.textDisabled).toBe('#9E9E9E');
    });
  });

  describe('Primary colors', () => {
    it('should have primary color scheme', () => {
      expect(LIGHT_THEME.colors.primary).toBe('#2196F3');
      expect(LIGHT_THEME.colors.primaryDark).toBe('#1976D2');
      expect(LIGHT_THEME.colors.primaryLight).toBe('#64B5F6');
      expect(LIGHT_THEME.colors.onPrimary).toBe('#FFFFFF');
    });
  });

  describe('Semantic colors', () => {
    it('should have success color', () => {
      expect(LIGHT_THEME.colors.success).toBe('#4CAF50');
    });

    it('should have error color', () => {
      expect(LIGHT_THEME.colors.error).toBe('#F44336');
    });

    it('should have warning color', () => {
      expect(LIGHT_THEME.colors.warning).toBe('#FF9800');
    });

    it('should have info color', () => {
      expect(LIGHT_THEME.colors.info).toBe('#2196F3');
    });
  });

  describe('Message colors', () => {
    it('should have message background and text colors', () => {
      expect(LIGHT_THEME.colors.messageBackground).toBe('#FFFFFF');
      expect(LIGHT_THEME.colors.messageText).toBe('#212121');
      expect(LIGHT_THEME.colors.messageNick).toBe('#1976D2');
      expect(LIGHT_THEME.colors.messageTimestamp).toBe('#9E9E9E');
    });

    it('should have system message colors', () => {
      expect(LIGHT_THEME.colors.systemMessage).toBe('#757575');
      expect(LIGHT_THEME.colors.noticeMessage).toBe('#FF9800');
      expect(LIGHT_THEME.colors.joinMessage).toBe('#4CAF50');
      expect(LIGHT_THEME.colors.partMessage).toBe('#FF9800');
      expect(LIGHT_THEME.colors.quitMessage).toBe('#F44336');
      expect(LIGHT_THEME.colors.kickMessage).toBe('#F44336');
    });

    it('should have event message colors', () => {
      expect(LIGHT_THEME.colors.nickMessage).toBe('#1976D2');
      expect(LIGHT_THEME.colors.inviteMessage).toBe('#2196F3');
      expect(LIGHT_THEME.colors.monitorMessage).toBe('#2196F3');
      expect(LIGHT_THEME.colors.topicMessage).toBe('#9C27B0');
      expect(LIGHT_THEME.colors.modeMessage).toBe('#5DADE2');
      expect(LIGHT_THEME.colors.actionMessage).toBe('#9E9E9E');
      expect(LIGHT_THEME.colors.rawMessage).toBe('#757575');
      expect(LIGHT_THEME.colors.ctcpMessage).toBe('#388E3C');
    });
  });

  describe('Border colors', () => {
    it('should have light border colors', () => {
      expect(LIGHT_THEME.colors.border).toBe('#E0E0E0');
      expect(LIGHT_THEME.colors.borderLight).toBe('#F5F5F5');
      expect(LIGHT_THEME.colors.divider).toBe('#E0E0E0');
    });
  });

  describe('Input colors', () => {
    it('should have light input colors', () => {
      expect(LIGHT_THEME.colors.inputBackground).toBe('#F5F5F5');
      expect(LIGHT_THEME.colors.inputText).toBe('#212121');
      expect(LIGHT_THEME.colors.inputBorder).toBe('#E0E0E0');
      expect(LIGHT_THEME.colors.inputPlaceholder).toBe('#9E9E9E');
    });
  });

  describe('Button colors', () => {
    it('should have button colors', () => {
      expect(LIGHT_THEME.colors.buttonPrimary).toBe('#2196F3');
      expect(LIGHT_THEME.colors.buttonPrimaryText).toBe('#FFFFFF');
      expect(LIGHT_THEME.colors.buttonSecondary).toBe('#E0E0E0');
      expect(LIGHT_THEME.colors.buttonSecondaryText).toBe('#212121');
      expect(LIGHT_THEME.colors.buttonDisabled).toBe('#F5F5F5');
      expect(LIGHT_THEME.colors.buttonDisabledText).toBe('#9E9E9E');
      expect(LIGHT_THEME.colors.buttonText).toBe('#FFFFFF');
    });
  });

  describe('Tab colors', () => {
    it('should have tab colors', () => {
      expect(LIGHT_THEME.colors.tabActive).toBe('#2196F3');
      expect(LIGHT_THEME.colors.tabInactive).toBe('#F5F5F5');
      expect(LIGHT_THEME.colors.tabActiveText).toBe('#FFFFFF');
      expect(LIGHT_THEME.colors.tabInactiveText).toBe('#757575');
      expect(LIGHT_THEME.colors.tabBorder).toBe('#E0E0E0');
    });
  });

  describe('Modal colors', () => {
    it('should have modal colors', () => {
      expect(LIGHT_THEME.colors.modalOverlay).toBe('rgba(0, 0, 0, 0.5)');
      expect(LIGHT_THEME.colors.modalBackground).toBe('#FFFFFF');
      expect(LIGHT_THEME.colors.modalText).toBe('#212121');
    });
  });

  describe('User list colors', () => {
    it('should have user list background colors', () => {
      expect(LIGHT_THEME.colors.userListBackground).toBe('#FAFAFA');
      expect(LIGHT_THEME.colors.userListText).toBe('#212121');
      expect(LIGHT_THEME.colors.userListBorder).toBe('#E0E0E0');
    });

    it('should have darker user role colors for light theme', () => {
      expect(LIGHT_THEME.colors.userOwner).toBe('#7B1FA2');
      expect(LIGHT_THEME.colors.userAdmin).toBe('#D32F2F');
      expect(LIGHT_THEME.colors.userOp).toBe('#F57C00');
      expect(LIGHT_THEME.colors.userHalfop).toBe('#1976D2');
      expect(LIGHT_THEME.colors.userVoice).toBe('#388E3C');
      expect(LIGHT_THEME.colors.userNormal).toBe('#212121');
    });
  });

  describe('Highlight colors', () => {
    it('should have highlight colors', () => {
      expect(LIGHT_THEME.colors.highlightBackground).toBe(
        'rgba(33, 150, 243, 0.1)',
      );
      expect(LIGHT_THEME.colors.highlightText).toBe('#FF6F00');
      expect(LIGHT_THEME.colors.selectionBackground).toBe(
        'rgba(33, 150, 243, 0.12)',
      );
    });
  });

  describe('Contrast with DarkTheme', () => {
    it('should have opposite background colors compared to dark theme', () => {
      const { DARK_THEME } = require('../../src/themes/DarkTheme');

      // Light theme should have white-ish background, dark theme dark-ish
      expect(LIGHT_THEME.colors.background).toBe('#FFFFFF');
      expect(DARK_THEME.colors.background).toBe('#121212');
    });

    it('should have opposite text colors compared to dark theme', () => {
      const { DARK_THEME } = require('../../src/themes/DarkTheme');

      // Light theme should have dark text, dark theme light text
      expect(LIGHT_THEME.colors.text).toBe('#212121');
      expect(DARK_THEME.colors.text).toBe('#FFFFFF');
    });
  });

  describe('Color validation', () => {
    it('should have all required color properties', () => {
      const requiredColors = [
        'background',
        'surface',
        'text',
        'primary',
        'success',
        'error',
        'border',
        'messageBackground',
        'messageText',
        'inputBackground',
        'buttonPrimary',
        'tabActive',
        'modalBackground',
        'userListBackground',
      ];

      requiredColors.forEach(color => {
        expect(LIGHT_THEME.colors).toHaveProperty(color);
        expect(
          typeof LIGHT_THEME.colors[color as keyof typeof LIGHT_THEME.colors],
        ).toBe('string');
      });
    });

    it('should have valid hex or rgba color formats', () => {
      const hexOrRgbaPattern = /^(#[0-9A-Fa-f]{6}|rgba?\([^)]+\))$/;

      Object.values(LIGHT_THEME.colors).forEach(color => {
        expect(typeof color).toBe('string');
        expect(color).toMatch(hexOrRgbaPattern);
      });
    });
  });
});
