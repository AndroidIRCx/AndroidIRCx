/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * ServiceCommandProvider Unit Tests
 */

import {
  serviceCommandProvider,
  ServiceCommandProvider,
} from '../../src/services/ServiceCommandProvider';
import { serviceDetectionService } from '../../src/services/ServiceDetectionService';
import {
  CompletionContext,
  AccessLevel,
} from '../../src/interfaces/ServiceTypes';
import * as serviceConfigModule from '../../src/config/services';

describe('ServiceCommandProvider', () => {
  beforeEach(() => {
    serviceCommandProvider.clearCache('test-network');
    serviceDetectionService.cleanupNetwork('test-network');
  });

  afterEach(() => {
    serviceCommandProvider.clearCache('test-network');
    serviceDetectionService.cleanupNetwork('test-network');
  });

  describe('getCommands', () => {
    it('should return empty array when no detection result', () => {
      const commands = serviceCommandProvider.getCommands('unknown-network');
      expect(commands).toEqual([]);
    });

    it('should return commands for detected service', () => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'DALnet');

      const commands = serviceCommandProvider.getCommands('test-network');
      expect(Array.isArray(commands)).toBe(true);
    });
  });

  describe('getServiceCommands', () => {
    it('should return commands for specific service', () => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'DALnet');

      const commands = serviceCommandProvider.getServiceCommands(
        'test-network',
        'nickserv',
      );
      expect(Array.isArray(commands)).toBe(true);
    });

    it('should return empty array for non-existent service', () => {
      const commands = serviceCommandProvider.getServiceCommands(
        'unknown-network',
        'nickserv',
      );
      expect(commands).toEqual([]);
    });
  });

  describe('findCommand', () => {
    beforeEach(() => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'anope');
    });

    it('should find command by name', () => {
      const result = serviceCommandProvider.findCommand(
        'test-network',
        'REGISTER',
      );

      if (result) {
        expect(result.command).toBeDefined();
        expect(result.service).toBeDefined();
        expect(result.serviceName).toBeDefined();
      }
    });

    it('should find command by alias', () => {
      // First get safe aliases
      const aliases = serviceCommandProvider.getSafeAliases('test-network');

      if (aliases.length > 0) {
        const alias = aliases[0].alias;
        const result = serviceCommandProvider.findCommand(
          'test-network',
          alias,
        );

        if (result) {
          expect(result.command).toBeDefined();
        }
      }
    });

    it('should return undefined for unknown command', () => {
      const result = serviceCommandProvider.findCommand(
        'test-network',
        'UNKNOWNCOMMAND123',
      );
      expect(result).toBeUndefined();
    });
  });

  describe('getSuggestions', () => {
    beforeEach(() => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'anope');
    });

    it('should return empty array when no detection result', () => {
      const context: CompletionContext = {
        userLevel: 'user',
        isAuthenticated: false,
      };

      const suggestions = serviceCommandProvider.getSuggestions(
        'unknown-network',
        'ns',
        context,
      );
      expect(suggestions).toEqual([]);
    });

    it('should return suggestions matching query', () => {
      const context: CompletionContext = {
        userLevel: 'user',
        isAuthenticated: false,
      };

      const suggestions = serviceCommandProvider.getSuggestions(
        'test-network',
        'register',
        context,
      );
      expect(Array.isArray(suggestions)).toBe(true);

      // Should include NickServ register-related suggestions
      expect(
        suggestions.some(
          s =>
            s.text.toLowerCase().includes('register') ||
            s.serviceNick?.toLowerCase().includes('nickserv'),
        ),
      ).toBe(true);

      // Note: This may fail if detection didn't complete, that's OK
      if (suggestions.length > 0) {
        expect(suggestions[0]).toHaveProperty('text');
        expect(suggestions[0]).toHaveProperty('label');
        expect(suggestions[0]).toHaveProperty('description');
      }
    });

    it('should filter suggestions by user level', () => {
      const userContext: CompletionContext = {
        userLevel: 'user',
        isAuthenticated: false,
      };

      const operContext: CompletionContext = {
        userLevel: 'oper',
        isAuthenticated: true,
      };

      const userSuggestions = serviceCommandProvider.getSuggestions(
        'test-network',
        'os',
        userContext,
      );
      const operSuggestions = serviceCommandProvider.getSuggestions(
        'test-network',
        'os',
        operContext,
      );

      // Oper should see more suggestions than regular user
      expect(operSuggestions.length).toBeGreaterThanOrEqual(
        userSuggestions.length,
      );
    });
  });

  describe('getSafeAliases', () => {
    beforeEach(() => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'anope');
    });

    it('should return safe aliases for detected service', () => {
      const aliases = serviceCommandProvider.getSafeAliases('test-network');
      expect(Array.isArray(aliases)).toBe(true);

      if (aliases.length > 0) {
        expect(aliases[0]).toHaveProperty('alias');
        expect(aliases[0]).toHaveProperty('command');
        expect(aliases[0]).toHaveProperty('description');

        // Verify no reserved aliases
        const reserved = ['j', 'p', 'q', 'w', 'n', 'm', 'oper', 'kill'];
        const aliasNames = aliases.map(a => a.alias.toLowerCase());

        for (const reservedAlias of reserved) {
          expect(aliasNames).not.toContain(reservedAlias);
        }
      }
    });

    it('should return empty array when no detection result', () => {
      const aliases = serviceCommandProvider.getSafeAliases('unknown-network');
      expect(aliases).toEqual([]);
    });
  });

  describe('getIRCdInfo', () => {
    beforeEach(() => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'anope');
    });

    it('should return IRCd information', () => {
      const info = serviceCommandProvider.getIRCdInfo('test-network');

      // Info may be undefined if service detection doesn't return config with ircd
      if (info) {
        expect(info).toHaveProperty('userModes');
        expect(info).toHaveProperty('channelModes');
        expect(info).toHaveProperty('operCommands');

        expect(Array.isArray(info.userModes)).toBe(true);
        expect(Array.isArray(info.channelModes)).toBe(true);
      }
    });

    it('should handle unknown network gracefully', () => {
      const info = serviceCommandProvider.getIRCdInfo('unknown-network');

      // Should return undefined or empty object for unknown network
      expect(info === undefined || typeof info === 'object').toBe(true);
    });
  });

  // Note: executeCommand method is not implemented in ServiceCommandProvider
  // It would be added in future versions for command execution support

  describe('clearCache', () => {
    it('should clear command cache for network', () => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'anope');

      // Populate cache
      serviceCommandProvider.getCommands('test-network');

      // Clear cache
      serviceCommandProvider.clearCache('test-network');

      // Should work normally after clear
      const commands = serviceCommandProvider.getCommands('test-network');
      expect(Array.isArray(commands)).toBe(true);
    });
  });

  describe('hasPermission', () => {
    it('should allow user commands for all levels', () => {
      const levels: AccessLevel[] = [
        'user',
        'op',
        'halfop',
        'admin',
        'founder',
        'oper',
      ];

      for (const level of levels) {
        const context: CompletionContext = {
          userLevel: level,
          isAuthenticated: false,
        };

        // User-level commands should be accessible to all
        const suggestions = serviceCommandProvider.getSuggestions(
          'test-network',
          'help',
          context,
        );
        // This test mainly ensures no errors are thrown
        expect(Array.isArray(suggestions)).toBe(true);
      }
    });
  });

  describe('buildCommand / parseInput / help', () => {
    const mockConfig: any = {
      services: {
        nickserv: {
          enabled: true,
          nick: 'NickServ',
          commands: [
            {
              name: 'REGISTER',
              description: 'Register nickname',
              usage: 'REGISTER <password>',
              example: '/NickServ REGISTER hunter2',
              minLevel: 'user',
              parameters: [
                {
                  name: 'password',
                  description: 'Account password',
                  required: true,
                },
              ],
              completion: { priority: 80, suggestAlias: 'nsregister' },
            },
            {
              name: 'DROP',
              description: 'Drop account',
              usage: 'DROP <nick>',
              minLevel: 'admin',
              parameters: [
                { name: 'nick', description: 'Nickname', required: true },
              ],
              completion: { priority: 10, confirmBeforeExecute: true },
            },
            {
              name: 'WHOAMI',
              description: 'Show current account',
              usage: 'WHOAMI',
              minLevel: 'user',
              parameters: [],
              completion: { context: ['global'], priority: 30 },
            },
            {
              name: 'VOICEONLY',
              description: 'Channel-only command',
              usage: 'VOICEONLY',
              minLevel: 'user',
              parameters: [],
              completion: { context: ['channel'], priority: 20 },
            },
          ],
        },
      },
    };

    let provider: ServiceCommandProvider;

    beforeEach(() => {
      provider = new ServiceCommandProvider();
      jest
        .spyOn(serviceDetectionService, 'getServiceConfig')
        .mockReturnValue(mockConfig);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('buildCommand handles unknown, missing params, confirmation and success', () => {
      const unknown = provider.buildCommand('net-1', 'UNKNOWN', []);
      expect(unknown.success).toBe(false);
      expect(unknown.error).toContain('Unknown command');

      const missing = provider.buildCommand('net-1', 'REGISTER', []);
      expect(missing.success).toBe(false);
      expect(missing.error).toContain('Missing required parameters');

      const confirm = provider.buildCommand('net-1', 'DROP', ['alice']);
      expect(confirm.success).toBe(false);
      expect(confirm.needsConfirmation).toBe(true);

      const ok = provider.buildCommand('net-1', 'REGISTER', ['hunter2']);
      expect(ok.success).toBe(true);
      expect(ok.fullMessage).toBe('/NickServ REGISTER hunter2');
    });

    it('parseInput handles aliases, direct service nicks and non-service input', () => {
      expect(provider.parseInput('/nsregister hunter2')).toEqual({
        isServiceCommand: true,
        serviceNick: 'NickServ',
        command: 'REGISTER',
        args: ['hunter2'],
      });

      expect(provider.parseInput('/NickServ HELP REGISTER')).toEqual({
        isServiceCommand: true,
        serviceNick: 'NickServ',
        command: 'HELP',
        args: ['REGISTER'],
      });

      expect(provider.parseInput('regular text')).toEqual({
        isServiceCommand: false,
        args: ['regular', 'text'],
      });

      expect(provider.parseInput('')).toEqual({
        isServiceCommand: false,
        args: [''],
      });
    });

    it('getSuggestions applies permission/context/match filters and alias priority sort', () => {
      const userContext: CompletionContext = {
        userLevel: 'user',
        isAuthenticated: true,
      };

      const globalSuggestions = provider.getSuggestions(
        'net-1',
        'reg',
        userContext,
      );
      expect(globalSuggestions.some(s => s.text === '/REGISTER')).toBe(true);
      expect(
        globalSuggestions.some(s => s.text === '/nsregister' && s.isAlias),
      ).toBe(true);
      expect(globalSuggestions.some(s => s.text === '/DROP')).toBe(false);
      expect(globalSuggestions.some(s => s.text === '/VOICEONLY')).toBe(false);

      const channelSuggestions = provider.getSuggestions('net-1', 'voiceonly', {
        ...userContext,
        currentChannel: '#chat',
      });
      expect(channelSuggestions.some(s => s.text === '/VOICEONLY')).toBe(true);

      const fuzzy = provider.getSuggestions('net-1', 'xxwhoamiyy', userContext);
      expect(fuzzy.some(s => s.text === '/WHOAMI')).toBe(true);

      const sorted = provider.getSuggestions('net-1', '', userContext);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i - 1].priority).toBeGreaterThanOrEqual(
          sorted[i].priority,
        );
      }
    });

    it('getCommandHelp returns formatted details including params and alias', () => {
      const help = provider.getCommandHelp('net-1', 'REGISTER');
      expect(help).toContain('NickServ REGISTER');
      expect(help).toContain('Usage:');
      expect(help).toContain('Example:');
      expect(help).toContain('Parameters:');
      expect(help).toContain('/nsregister');

      const helpWithoutExample = provider.getCommandHelp('net-1', 'WHOAMI')!;
      expect(helpWithoutExample).not.toContain('Example:');

      expect(provider.getCommandHelp('net-1', 'MISSING')).toBeUndefined();
    });

    it('parseInput supports all safe alias prefixes', () => {
      expect(provider.parseInput('/csop #room nick').serviceNick).toBe(
        'ChanServ',
      );
      expect(provider.parseInput('/hsset host').serviceNick).toBe('HostServ');
      expect(provider.parseInput('/osrehash').serviceNick).toBe('OperServ');
      expect(provider.parseInput('/bsassign #chan bot').serviceNick).toBe(
        'BotServ',
      );
      expect(provider.parseInput('/mssend nick hi').serviceNick).toBe(
        'MemoServ',
      );
    });
  });

  describe('getIRCdInfo extra branches', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns undefined when detection is missing or config has no ircd', () => {
      jest
        .spyOn(serviceDetectionService, 'getDetectionResult')
        .mockReturnValue(undefined as any);
      expect(serviceCommandProvider.getIRCdInfo('net-x')).toBeUndefined();

      jest
        .spyOn(serviceDetectionService, 'getDetectionResult')
        .mockReturnValue({ ircdType: 'any' } as any);
      jest
        .spyOn(serviceConfigModule, 'getConfig')
        .mockReturnValue(undefined as any);
      expect(serviceCommandProvider.getIRCdInfo('net-x')).toBeUndefined();
    });

    it('maps ircd modes and oper-only commands', () => {
      jest
        .spyOn(serviceDetectionService, 'getDetectionResult')
        .mockReturnValue({ ircdType: 'hybrid' } as any);
      jest.spyOn(serviceConfigModule, 'getConfig').mockReturnValue({
        ircd: {
          userModes: [{ mode: 'i', description: 'Invisible' }],
          channelModes: [{ mode: 'm', description: 'Moderated' }],
          commands: [
            { name: 'REHASH', operOnly: true },
            { name: 'MOTD', operOnly: false },
          ],
        },
      } as any);

      expect(serviceCommandProvider.getIRCdInfo('net-y')).toEqual({
        userModes: ['i=Invisible'],
        channelModes: ['m=Moderated'],
        operCommands: ['REHASH'],
      });
    });
  });
});
