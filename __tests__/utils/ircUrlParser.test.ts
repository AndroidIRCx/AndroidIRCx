/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ircUrlParser - 100% coverage target
 */

import {
  isIRCUrl,
  parseIRCUrl,
  findMatchingNetwork,
  createTempNetworkFromUrl,
  getUrlDisplayName,
  ParsedIRCUrl,
} from '../../src/utils/ircUrlParser';

// Mock SettingsService
const mockLoadNetworks = jest.fn();

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: () => mockLoadNetworks(),
  },
}));

// Mock IdentityProfilesService
jest.mock('../../src/services/IdentityProfilesService', () => ({
  identityProfilesService: {
    getActiveProfile: jest.fn(),
  },
}));

describe('ircUrlParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isIRCUrl', () => {
    it('should return true for irc:// URLs', () => {
      expect(isIRCUrl('irc://irc.example.com')).toBe(true);
    });

    it('should return true for ircs:// URLs', () => {
      expect(isIRCUrl('ircs://irc.example.com')).toBe(true);
    });

    it('should return false for non-IRC URLs', () => {
      expect(isIRCUrl('http://example.com')).toBe(false);
      expect(isIRCUrl('https://example.com')).toBe(false);
      expect(isIRCUrl('ftp://example.com')).toBe(false);
    });

    it('should return false for empty or invalid input', () => {
      expect(isIRCUrl('')).toBe(false);
      expect(isIRCUrl(null as any)).toBe(false);
      expect(isIRCUrl(undefined as any)).toBe(false);
      expect(isIRCUrl(123 as any)).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(isIRCUrl('  irc://irc.example.com  ')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isIRCUrl('IRC://irc.example.com')).toBe(true);
      expect(isIRCUrl('IRCS://irc.example.com')).toBe(true);
    });
  });

  describe('parseIRCUrl', () => {
    it('should parse basic irc:// URL', () => {
      const result = parseIRCUrl('irc://irc.example.com');
      expect(result.isValid).toBe(true);
      expect(result.protocol).toBe('irc');
      expect(result.server).toBe('irc.example.com');
      expect(result.port).toBe(6667);
      expect(result.ssl).toBe(false);
    });

    it('should parse ircs:// URL with SSL', () => {
      const result = parseIRCUrl('ircs://irc.example.com');
      expect(result.isValid).toBe(true);
      expect(result.protocol).toBe('ircs');
      expect(result.ssl).toBe(true);
      expect(result.port).toBe(6697);
    });

    it('should parse URL with custom port', () => {
      const result = parseIRCUrl('irc://irc.example.com:6668');
      expect(result.port).toBe(6668);
    });

    it('should parse URL with SSL and custom port', () => {
      const result = parseIRCUrl('ircs://irc.example.com:7000');
      expect(result.port).toBe(7000);
      expect(result.ssl).toBe(true);
    });

    it('should parse URL with channel', () => {
      const result = parseIRCUrl('irc://irc.example.com/#general');
      expect(result.channel).toBe('#general');
    });

    it('should parse URL with channel (without leading #)', () => {
      const result = parseIRCUrl('irc://irc.example.com/general');
      expect(result.channel).toBe('#general');
    });

    it('should parse URL with channel and key', () => {
      const result = parseIRCUrl('irc://irc.example.com/#general,secretkey');
      expect(result.channel).toBe('#general');
      expect(result.channelKey).toBe('secretkey');
    });

    it('should parse URL with nick', () => {
      const result = parseIRCUrl('irc://mynick@irc.example.com');
      expect(result.nick).toBe('mynick');
    });

    it('should parse URL with nick and password', () => {
      const result = parseIRCUrl('irc://mynick:mypass@irc.example.com');
      expect(result.nick).toBe('mynick');
      expect(result.password).toBe('mypass');
    });

    it('should parse URL with query params', () => {
      const result = parseIRCUrl(
        'irc://irc.example.com/#general?nick=MyNick&altNick=MyAlt&realname=MyReal&ident=myident',
      );
      expect(result.nick).toBe('MyNick');
      expect(result.altNick).toBe('MyAlt');
      expect(result.realname).toBe('MyReal');
      expect(result.ident).toBe('myident');
    });

    it('should parse URL with alt_nick query param', () => {
      const result = parseIRCUrl('irc://irc.example.com/?alt_nick=MyAlt');
      expect(result.altNick).toBe('MyAlt');
    });

    it('should parse URL with real_name query param', () => {
      const result = parseIRCUrl('irc://irc.example.com/?real_name=MyReal');
      expect(result.realname).toBe('MyReal');
    });

    it('should give precedence to query param nick over URL nick', () => {
      const result = parseIRCUrl(
        'irc://urlnick@irc.example.com/?nick=QueryNick',
      );
      expect(result.nick).toBe('QueryNick');
    });

    it('should parse IPv6 address', () => {
      const result = parseIRCUrl('irc://[::1]:6667');
      expect(result.server).toBe('::1');
      expect(result.port).toBe(6667);
    });

    it('should parse IPv6 address with channel', () => {
      const result = parseIRCUrl('irc://[2001:db8::1]/#general');
      expect(result.server).toBe('2001:db8::1');
      expect(result.channel).toBe('#general');
    });

    it('should return error for invalid port after IPv6', () => {
      const result = parseIRCUrl('irc://[::1]:abc');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid port');
    });

    it('should handle URL encoded characters in channel', () => {
      const result = parseIRCUrl('irc://irc.example.com/%23general');
      expect(result.channel).toBe('#general');
    });

    it('should handle URL encoded characters in nick', () => {
      const result = parseIRCUrl('irc://My%20Nick@irc.example.com');
      expect(result.nick).toBe('My Nick');
    });

    it('should return error for empty URL', () => {
      const result = parseIRCUrl('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should return error for null URL', () => {
      const result = parseIRCUrl(null as any);
      expect(result.isValid).toBe(false);
    });

    it('should return error for non-IRC URL', () => {
      const result = parseIRCUrl('http://example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid IRC URL');
    });

    it('should return error for missing server', () => {
      const result = parseIRCUrl('irc://');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Server hostname');
    });

    it('should return error for invalid IPv6 (missing closing bracket)', () => {
      const result = parseIRCUrl('irc://[::1:6667');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('IPv6');
    });

    it('should return error for invalid port (non-numeric)', () => {
      const result = parseIRCUrl('irc://irc.example.com:abc');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid port');
    });

    it('should return error for invalid port (too low)', () => {
      const result = parseIRCUrl('irc://irc.example.com:0');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid port');
    });

    it('should return error for invalid port (too high)', () => {
      const result = parseIRCUrl('irc://irc.example.com:70000');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid port');
    });

    it('should handle whitespace in URL', () => {
      const result = parseIRCUrl('  irc://irc.example.com  ');
      expect(result.isValid).toBe(true);
      expect(result.server).toBe('irc.example.com');
    });
  });

  describe('findMatchingNetwork', () => {
    it('should return null for invalid URL', async () => {
      const result = await findMatchingNetwork({
        isValid: false,
      } as ParsedIRCUrl);
      expect(result).toBeNull();
    });

    it('should return null when no networks exist', async () => {
      mockLoadNetworks.mockResolvedValue([]);
      const parsedUrl = parseIRCUrl('irc://irc.example.com');
      const result = await findMatchingNetwork(parsedUrl);
      expect(result).toBeNull();
    });

    it('should find exact match (hostname + port)', async () => {
      mockLoadNetworks.mockResolvedValue([
        {
          name: 'TestNet',
          servers: [{ hostname: 'irc.example.com', port: 6667 }],
        },
      ]);
      const parsedUrl = parseIRCUrl('irc://irc.example.com:6667');
      const result = await findMatchingNetwork(parsedUrl);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('TestNet');
    });

    it('should find hostname match (ignore port)', async () => {
      mockLoadNetworks.mockResolvedValue([
        {
          name: 'TestNet',
          servers: [{ hostname: 'irc.example.com', port: 6667 }],
        },
      ]);
      const parsedUrl = parseIRCUrl('irc://irc.example.com:6668');
      const result = await findMatchingNetwork(parsedUrl);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('TestNet');
    });

    it('should find network name match', async () => {
      mockLoadNetworks.mockResolvedValue([
        {
          name: 'irc.example.com',
          servers: [{ hostname: 'other.example.com', port: 6667 }],
        },
      ]);
      const parsedUrl = parseIRCUrl('irc://irc.example.com');
      const result = await findMatchingNetwork(parsedUrl);
      expect(result).not.toBeNull();
    });

    it('should be case insensitive for hostname match', async () => {
      mockLoadNetworks.mockResolvedValue([
        {
          name: 'TestNet',
          servers: [{ hostname: 'IRC.EXAMPLE.COM', port: 6667 }],
        },
      ]);
      const parsedUrl = parseIRCUrl('irc://irc.example.com');
      const result = await findMatchingNetwork(parsedUrl);
      expect(result).not.toBeNull();
    });

    it('should skip networks with no servers', async () => {
      mockLoadNetworks.mockResolvedValue([
        {
          name: 'EmptyNet',
          servers: [],
        },
        {
          name: 'TestNet',
          servers: [{ hostname: 'irc.example.com', port: 6667 }],
        },
      ]);
      const parsedUrl = parseIRCUrl('irc://irc.example.com');
      const result = await findMatchingNetwork(parsedUrl);
      expect(result?.name).toBe('TestNet');
    });

    it('should skip networks with no servers during hostname match', async () => {
      mockLoadNetworks.mockResolvedValue([
        {
          name: 'ExactNet',
          servers: [{ hostname: 'other.example.com', port: 6667 }],
        },
        {
          name: 'EmptyNet',
          servers: [],
        },
        {
          name: 'HostNet',
          servers: [{ hostname: 'irc.example.com', port: 6668 }],
        },
      ]);
      const parsedUrl = parseIRCUrl('irc://irc.example.com:6669');
      const result = await findMatchingNetwork(parsedUrl);
      expect(result?.name).toBe('HostNet');
    });

    it('should return null when no match found', async () => {
      mockLoadNetworks.mockResolvedValue([
        {
          name: 'OtherNet',
          servers: [{ hostname: 'other.example.com', port: 6667 }],
        },
      ]);
      const parsedUrl = parseIRCUrl('irc://irc.example.com');
      const result = await findMatchingNetwork(parsedUrl);
      expect(result).toBeNull();
    });
  });

  describe('createTempNetworkFromUrl', () => {
    it('should create network config from URL', () => {
      const parsedUrl = parseIRCUrl('irc://irc.example.com:6668/#general');
      const defaultProfile = {
        id: 'default',
        nick: 'DefaultNick',
        altNick: 'DefaultAlt',
        realname: 'Default Real',
        ident: 'defaultident',
      };

      const result = createTempNetworkFromUrl(parsedUrl, defaultProfile as any);

      expect(result.name).toBe('irc.example.com');
      expect(result.servers[0].hostname).toBe('irc.example.com');
      expect(result.servers[0].port).toBe(6668);
      expect(result.autoJoinChannels).toContain('#general');
    });

    it('should use URL nick over default profile', () => {
      const parsedUrl = parseIRCUrl('irc://UrlNick@irc.example.com');
      const defaultProfile = {
        id: 'default',
        nick: 'DefaultNick',
        altNick: 'DefaultAlt',
        realname: 'Default Real',
        ident: 'defaultident',
      };

      const result = createTempNetworkFromUrl(parsedUrl, defaultProfile as any);

      expect(result.nick).toBe('UrlNick');
    });

    it('should use default profile when URL has no nick', () => {
      const parsedUrl = parseIRCUrl('irc://irc.example.com');
      const defaultProfile = {
        id: 'default',
        nick: 'DefaultNick',
        altNick: 'DefaultAlt',
        realname: 'Default Real',
        ident: 'defaultident',
      };

      const result = createTempNetworkFromUrl(parsedUrl, defaultProfile as any);

      expect(result.nick).toBe('DefaultNick');
    });

    it('should use fallback defaults when nothing provided', () => {
      const parsedUrl = parseIRCUrl('irc://irc.example.com');
      const defaultProfile = {
        id: 'default',
        nick: '',
        altNick: '',
        realname: '',
        ident: '',
      };

      const result = createTempNetworkFromUrl(parsedUrl, defaultProfile as any);

      expect(result.nick).toBe('AndroidIRCX');
      expect(result.altNick).toBe('AndroidIRCX_');
    });

    it('should set SSL based on protocol', () => {
      const parsedUrl = parseIRCUrl('ircs://irc.example.com');
      const defaultProfile = {
        id: 'default',
        nick: 'Nick',
        altNick: 'Alt',
        realname: 'Real',
        ident: 'ident',
      };

      const result = createTempNetworkFromUrl(parsedUrl, defaultProfile as any);

      expect(result.servers[0].ssl).toBe(true);
    });

    it('should include server password if provided', () => {
      const parsedUrl = parseIRCUrl('irc://nick:pass@irc.example.com');
      const defaultProfile = {
        id: 'default',
        nick: 'Nick',
        altNick: 'Alt',
        realname: 'Real',
        ident: 'ident',
      };

      const result = createTempNetworkFromUrl(parsedUrl, defaultProfile as any);

      expect(result.servers[0].password).toBe('pass');
    });
  });

  describe('getUrlDisplayName', () => {
    it('should return server name for valid URL', () => {
      const parsedUrl = parseIRCUrl('irc://irc.example.com');
      expect(getUrlDisplayName(parsedUrl)).toBe('irc.example.com');
    });

    it('should include non-default port', () => {
      const parsedUrl = parseIRCUrl('irc://irc.example.com:6668');
      expect(getUrlDisplayName(parsedUrl)).toBe('irc.example.com:6668');
    });

    it('should not include default IRC port', () => {
      const parsedUrl = parseIRCUrl('irc://irc.example.com:6667');
      expect(getUrlDisplayName(parsedUrl)).toBe('irc.example.com');
    });

    it('should not include default IRCS port', () => {
      const parsedUrl = parseIRCUrl('ircs://irc.example.com:6697');
      expect(getUrlDisplayName(parsedUrl)).toBe('irc.example.com');
    });

    it('should include channel', () => {
      const parsedUrl = parseIRCUrl('irc://irc.example.com/#general');
      expect(getUrlDisplayName(parsedUrl)).toBe('irc.example.com / #general');
    });

    it('should return invalid URL message for invalid URL', () => {
      const parsedUrl = parseIRCUrl('not-an-irc-url');
      expect(getUrlDisplayName(parsedUrl)).toBe('invalid URL');
    });
  });
});
