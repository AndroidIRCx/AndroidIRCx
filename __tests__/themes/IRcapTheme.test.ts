/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCAP_THEME } from '../../src/themes/IRcapTheme';

describe('Themes - IRcapTheme', () => {
  it('should export IRCAP_THEME constant', () => {
    expect(IRCAP_THEME).toBeDefined();
    expect(typeof IRCAP_THEME).toBe('object');
  });

  it('should have correct theme metadata', () => {
    expect(IRCAP_THEME.id).toBe('ircap');
    expect(IRCAP_THEME.isCustom).toBe(false);
    expect(typeof IRCAP_THEME.name).toBe('string');
  });

  describe('Background colors', () => {
    it('should have IRcap-style background colors', () => {
      expect(IRCAP_THEME.colors.background).toBe('#E6E6E6');
      expect(IRCAP_THEME.colors.surface).toBe('#6B6B6B');
      expect(IRCAP_THEME.colors.surfaceVariant).toBe('#8A8A8A');
      expect(IRCAP_THEME.colors.surfaceAlt).toBe('#FFFFFF');
      expect(IRCAP_THEME.colors.cardBackground).toBe('#FFFFFF');
    });
  });

  describe('Text colors', () => {
    it('should have IRcap text colors', () => {
      expect(IRCAP_THEME.colors.text).toBe('#1A1A1A');
      expect(IRCAP_THEME.colors.textSecondary).toBe('#000000');
      expect(IRCAP_THEME.colors.textDisabled).toBe('#9E9E9E');
    });
  });

  describe('Primary colors', () => {
    it('should have primary color scheme', () => {
      expect(IRCAP_THEME.colors.primary).toBe('#000000');
      expect(IRCAP_THEME.colors.primaryDark).toBe('#0F766E');
      expect(IRCAP_THEME.colors.primaryLight).toBe('#64B5F6');
      expect(IRCAP_THEME.colors.onPrimary).toBe('#FFFFFF');
    });
  });

  describe('Semantic colors', () => {
    it('should have success color', () => {
      expect(IRCAP_THEME.colors.success).toBe('#16A34A');
    });

    it('should have error color', () => {
      expect(IRCAP_THEME.colors.error).toBe('#B91C1C');
    });

    it('should have warning color', () => {
      expect(IRCAP_THEME.colors.warning).toBe('#DC2626');
    });

    it('should have info color', () => {
      expect(IRCAP_THEME.colors.info).toBe('#1A1A1A');
    });
  });

  describe('Message colors', () => {
    it('should have message background and text colors', () => {
      expect(IRCAP_THEME.colors.messageBackground).toBe('#B0B0B0');
      expect(IRCAP_THEME.colors.messageText).toBe('#212121');
      expect(IRCAP_THEME.colors.messageNick).toBe('#0F766E');
      expect(IRCAP_THEME.colors.messageTimestamp).toBe('#000000');
    });

    it('should have system message colors', () => {
      expect(IRCAP_THEME.colors.systemMessage).toBe('#4A4A4A');
      expect(IRCAP_THEME.colors.noticeMessage).toBe('#212121');
      expect(IRCAP_THEME.colors.joinMessage).toBe('#A855F7');
      expect(IRCAP_THEME.colors.partMessage).toBe('#F97316');
      expect(IRCAP_THEME.colors.quitMessage).toBe('#B91C1C');
      expect(IRCAP_THEME.colors.kickMessage).toBe('#B91C1C');
    });

    it('should have event message colors', () => {
      expect(IRCAP_THEME.colors.nickMessage).toBe('#1976D2');
      expect(IRCAP_THEME.colors.inviteMessage).toBe('#212121');
      expect(IRCAP_THEME.colors.monitorMessage).toBe('#1E3A8A');
      expect(IRCAP_THEME.colors.topicMessage).toBe('#212121');
      expect(IRCAP_THEME.colors.modeMessage).toBe('#5C5C5C');
      expect(IRCAP_THEME.colors.actionMessage).toBe('#7C3AED');
      expect(IRCAP_THEME.colors.rawMessage).toBe('#212121');
      expect(IRCAP_THEME.colors.ctcpMessage).toBe('#212121');
    });
  });

  describe('Border colors', () => {
    it('should have border colors', () => {
      expect(IRCAP_THEME.colors.border).toBe('#E0E0E0');
      expect(IRCAP_THEME.colors.borderLight).toBe('#F5F5F5');
      expect(IRCAP_THEME.colors.divider).toBe('#E0E0E0');
    });
  });

  describe('User list colors', () => {
    it('should have user list background colors', () => {
      expect(IRCAP_THEME.colors.userListBackground).toBe('#FAFAFA');
      expect(IRCAP_THEME.colors.userListText).toBe('#212121');
      expect(IRCAP_THEME.colors.userListBorder).toBe('#E0E0E0');
    });

    it('should have uniform user role colors (IRcap style)', () => {
      // IRcap uses same color for all operator levels
      expect(IRCAP_THEME.colors.userOwner).toBe('#B91C1C');
      expect(IRCAP_THEME.colors.userAdmin).toBe('#B91C1C');
      expect(IRCAP_THEME.colors.userOp).toBe('#B91C1C');
      expect(IRCAP_THEME.colors.userHalfop).toBe('#B91C1C');
      expect(IRCAP_THEME.colors.userVoice).toBe('#212121');
      expect(IRCAP_THEME.colors.userNormal).toBe('#212121');
    });
  });

  describe('Message formats', () => {
    it('should have message formats defined', () => {
      expect(IRCAP_THEME.messageFormats).toBeDefined();
    });

    it('should have message format', () => {
      expect(IRCAP_THEME.messageFormats?.message).toBeDefined();
      expect(Array.isArray(IRCAP_THEME.messageFormats?.message)).toBe(true);
    });

    it('should have messageMention format', () => {
      expect(IRCAP_THEME.messageFormats?.messageMention).toBeDefined();
    });

    it('should have action format', () => {
      expect(IRCAP_THEME.messageFormats?.action).toBeDefined();
    });

    it('should have actionMention format', () => {
      expect(IRCAP_THEME.messageFormats?.actionMention).toBeDefined();
    });

    it('should have notice format', () => {
      expect(IRCAP_THEME.messageFormats?.notice).toBeDefined();
    });

    it('should have event format', () => {
      expect(IRCAP_THEME.messageFormats?.event).toBeDefined();
    });

    it('should have join format', () => {
      expect(IRCAP_THEME.messageFormats?.join).toBeDefined();
    });

    it('should have part format', () => {
      expect(IRCAP_THEME.messageFormats?.part).toBeDefined();
    });

    it('should have quit format', () => {
      expect(IRCAP_THEME.messageFormats?.quit).toBeDefined();
    });

    it('should have kick format', () => {
      expect(IRCAP_THEME.messageFormats?.kick).toBeDefined();
    });

    it('should have nick format', () => {
      expect(IRCAP_THEME.messageFormats?.nick).toBeDefined();
    });

    it('should have invite format', () => {
      expect(IRCAP_THEME.messageFormats?.invite).toBeDefined();
    });

    it('should have monitor format', () => {
      expect(IRCAP_THEME.messageFormats?.monitor).toBeDefined();
    });

    it('should have mode format', () => {
      expect(IRCAP_THEME.messageFormats?.mode).toBeDefined();
    });

    it('should have topic format', () => {
      expect(IRCAP_THEME.messageFormats?.topic).toBeDefined();
    });

    it('should have raw format', () => {
      expect(IRCAP_THEME.messageFormats?.raw).toBeDefined();
    });

    it('should have error format', () => {
      expect(IRCAP_THEME.messageFormats?.error).toBeDefined();
    });

    it('should have ctcp format', () => {
      expect(IRCAP_THEME.messageFormats?.ctcp).toBeDefined();
    });

    it('should have format parts with type and value', () => {
      const format = IRCAP_THEME.messageFormats?.message;
      expect(format).toBeDefined();

      if (format && format.length > 0) {
        format.forEach(part => {
          expect(part).toHaveProperty('type');
          expect(part).toHaveProperty('value');
          expect(['text', 'token']).toContain(part.type);
        });
      }
    });

    it('should have format parts with optional style property', () => {
      const format = IRCAP_THEME.messageFormats?.message;

      if (format && format.length > 0) {
        const partsWithStyle = format.filter(part => part.style !== undefined);
        // IRcap theme has styled parts
        expect(partsWithStyle.length).toBeGreaterThan(0);

        partsWithStyle.forEach(part => {
          expect(typeof part.style).toBe('object');
        });
      }
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
        expect(IRCAP_THEME.colors).toHaveProperty(color);
        expect(
          typeof IRCAP_THEME.colors[color as keyof typeof IRCAP_THEME.colors],
        ).toBe('string');
      });
    });

    it('should have valid hex or rgba color formats', () => {
      const hexOrRgbaPattern = /^(#[0-9A-Fa-f]{6}|rgba?\([^)]+\))$/;

      Object.values(IRCAP_THEME.colors).forEach(color => {
        expect(typeof color).toBe('string');
        expect(color).toMatch(hexOrRgbaPattern);
      });
    });
  });
});
