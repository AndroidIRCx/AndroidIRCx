/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DARK_THEME } from '../../src/themes/DarkTheme';

describe('Themes - DarkTheme', () => {
  it('should export DARK_THEME constant', () => {
    expect(DARK_THEME).toBeDefined();
    expect(typeof DARK_THEME).toBe('object');
  });

  it('should have correct theme metadata', () => {
    expect(DARK_THEME.id).toBe('dark');
    expect(DARK_THEME.isCustom).toBe(false);
    expect(typeof DARK_THEME.name).toBe('string');
  });

  describe('Background colors', () => {
    it('should have background color', () => {
      expect(DARK_THEME.colors.background).toBe('#121212');
    });

    it('should have surface colors', () => {
      expect(DARK_THEME.colors.surface).toBe('#1E1E1E');
      expect(DARK_THEME.colors.surfaceVariant).toBe('#2C2C2C');
      expect(DARK_THEME.colors.surfaceAlt).toBe('#1A1A1A');
      expect(DARK_THEME.colors.cardBackground).toBe('#1E1E1E');
    });
  });

  describe('Text colors', () => {
    it('should have text colors', () => {
      expect(DARK_THEME.colors.text).toBe('#FFFFFF');
      expect(DARK_THEME.colors.textSecondary).toBe('#B0B0B0');
      expect(DARK_THEME.colors.textDisabled).toBe('#666666');
    });
  });

  describe('Primary colors', () => {
    it('should have primary color scheme', () => {
      expect(DARK_THEME.colors.primary).toBe('#2196F3');
      expect(DARK_THEME.colors.primaryDark).toBe('#1976D2');
      expect(DARK_THEME.colors.primaryLight).toBe('#64B5F6');
      expect(DARK_THEME.colors.onPrimary).toBe('#FFFFFF');
    });
  });

  describe('Semantic colors', () => {
    it('should have success color', () => {
      expect(DARK_THEME.colors.success).toBe('#4CAF50');
    });

    it('should have error color', () => {
      expect(DARK_THEME.colors.error).toBe('#B91C1C');
    });

    it('should have warning color', () => {
      expect(DARK_THEME.colors.warning).toBe('#DC2626');
    });

    it('should have info color', () => {
      expect(DARK_THEME.colors.info).toBe('#2196F3');
    });
  });

  describe('Message colors', () => {
    it('should have message background and text colors', () => {
      expect(DARK_THEME.colors.messageBackground).toBe('#1E1E1E');
      expect(DARK_THEME.colors.messageText).toBe('#E0E0E0');
      expect(DARK_THEME.colors.messageNick).toBe('#64B5F6');
      expect(DARK_THEME.colors.messageTimestamp).toBe('#757575');
    });

    it('should have system message colors', () => {
      expect(DARK_THEME.colors.systemMessage).toBe('#9E9E9E');
      expect(DARK_THEME.colors.noticeMessage).toBe('#FF9800');
      expect(DARK_THEME.colors.joinMessage).toBe('#4CAF50');
      expect(DARK_THEME.colors.partMessage).toBe('#F97316');
      expect(DARK_THEME.colors.quitMessage).toBe('#B91C1C');
      expect(DARK_THEME.colors.kickMessage).toBe('#B91C1C');
    });

    it('should have event message colors', () => {
      expect(DARK_THEME.colors.nickMessage).toBe('#1976D2');
      expect(DARK_THEME.colors.inviteMessage).toBe('#2196F3');
      expect(DARK_THEME.colors.monitorMessage).toBe('#1E3A8A');
      expect(DARK_THEME.colors.topicMessage).toBe('#9C27B0');
      expect(DARK_THEME.colors.modeMessage).toBe('#5DADE2');
      expect(DARK_THEME.colors.actionMessage).toBe('#9E9E9E');
      expect(DARK_THEME.colors.rawMessage).toBe('#B0B0B0');
      expect(DARK_THEME.colors.ctcpMessage).toBe('#4CAF50');
    });
  });

  describe('Border colors', () => {
    it('should have border colors', () => {
      expect(DARK_THEME.colors.border).toBe('#333333');
      expect(DARK_THEME.colors.borderLight).toBe('#2A2A2A');
      expect(DARK_THEME.colors.divider).toBe('#2A2A2A');
    });
  });

  describe('Input colors', () => {
    it('should have input colors', () => {
      expect(DARK_THEME.colors.inputBackground).toBe('#2C2C2C');
      expect(DARK_THEME.colors.inputText).toBe('#FFFFFF');
      expect(DARK_THEME.colors.inputBorder).toBe('#333333');
      expect(DARK_THEME.colors.inputPlaceholder).toBe('#757575');
    });
  });

  describe('Button colors', () => {
    it('should have button colors', () => {
      expect(DARK_THEME.colors.buttonPrimary).toBe('#2196F3');
      expect(DARK_THEME.colors.buttonPrimaryText).toBe('#FFFFFF');
      expect(DARK_THEME.colors.buttonSecondary).toBe('#424242');
      expect(DARK_THEME.colors.buttonSecondaryText).toBe('#FFFFFF');
      expect(DARK_THEME.colors.buttonDisabled).toBe('#2C2C2C');
      expect(DARK_THEME.colors.buttonDisabledText).toBe('#666666');
      expect(DARK_THEME.colors.buttonText).toBe('#FFFFFF');
    });
  });

  describe('Tab colors', () => {
    it('should have tab colors', () => {
      expect(DARK_THEME.colors.tabActive).toBe('#2196F3');
      expect(DARK_THEME.colors.tabInactive).toBe('#1E1E1E');
      expect(DARK_THEME.colors.tabActiveText).toBe('#FFFFFF');
      expect(DARK_THEME.colors.tabInactiveText).toBe('#B0B0B0');
      expect(DARK_THEME.colors.tabBorder).toBe('#333333');
    });
  });

  describe('Modal colors', () => {
    it('should have modal colors', () => {
      expect(DARK_THEME.colors.modalOverlay).toBe('rgba(0, 0, 0, 0.7)');
      expect(DARK_THEME.colors.modalBackground).toBe('#1E1E1E');
      expect(DARK_THEME.colors.modalText).toBe('#FFFFFF');
    });
  });

  describe('User list colors', () => {
    it('should have user list background colors', () => {
      expect(DARK_THEME.colors.userListBackground).toBe('#1A1A1A');
      expect(DARK_THEME.colors.userListText).toBe('#E0E0E0');
      expect(DARK_THEME.colors.userListBorder).toBe('#2A2A2A');
    });

    it('should have user role colors', () => {
      expect(DARK_THEME.colors.userOwner).toBe('#9C27B0');
      expect(DARK_THEME.colors.userAdmin).toBe('#F44336');
      expect(DARK_THEME.colors.userOp).toBe('#FF9800');
      expect(DARK_THEME.colors.userHalfop).toBe('#2196F3');
      expect(DARK_THEME.colors.userVoice).toBe('#4CAF50');
      expect(DARK_THEME.colors.userNormal).toBe('#E0E0E0');
    });
  });

  describe('Highlight colors', () => {
    it('should have highlight colors', () => {
      expect(DARK_THEME.colors.highlightBackground).toBe(
        'rgba(33, 150, 243, 0.2)',
      );
      expect(DARK_THEME.colors.highlightText).toBe('#FFEB3B');
      expect(DARK_THEME.colors.selectionBackground).toBe(
        'rgba(33, 150, 243, 0.12)',
      );
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
        expect(DARK_THEME.colors).toHaveProperty(color);
        expect(
          typeof DARK_THEME.colors[color as keyof typeof DARK_THEME.colors],
        ).toBe('string');
      });
    });

    it('should have valid hex or rgba color formats', () => {
      const hexOrRgbaPattern = /^(#[0-9A-Fa-f]{6}|rgba?\([^)]+\))$/;

      Object.values(DARK_THEME.colors).forEach(color => {
        // All colors should be strings
        expect(typeof color).toBe('string');
        // Should match hex or rgba format
        expect(color).toMatch(hexOrRgbaPattern);
      });
    });
  });
});
