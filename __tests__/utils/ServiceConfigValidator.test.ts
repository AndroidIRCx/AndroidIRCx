/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ServiceConfigValidator - 100% coverage target
 */

import {
  validateServiceConfig,
  validateCommand,
  isValidServiceConfig,
  findDuplicateCommands,
  getAllSuggestAliases,
  findAliasConflicts,
} from '../../src/utils/ServiceConfigValidator';

describe('ServiceConfigValidator', () => {
  const validConfig = {
    serviceType: 'anope',
    ircdType: 'unrealircd',
    services: {
      nickserv: {
        enabled: true,
        nick: 'NickServ',
        commands: [
          {
            name: 'REGISTER',
            service: 'NickServ',
            aliases: [],
            description: 'Register a nickname',
            usage: 'REGISTER <password> <email>',
            example: 'REGISTER mypass123 my@email.com',
            minLevel: 'user',
            requiresAuth: false,
            parameters: [
              {
                name: 'password',
                type: 'string',
                description: 'Password',
                required: true,
              },
            ],
          },
        ],
      },
    },
    ircd: {
      userModes: ['i', 'w', 'o'],
      channelModes: ['n', 't', 's'],
      commands: ['JOIN', 'PART', 'MODE'],
    },
  };

  describe('validateServiceConfig', () => {
    it('should validate a correct config', () => {
      const result = validateServiceConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null config', () => {
      const result = validateServiceConfig(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0].error).toBe('Configuration must be an object');
    });

    it('should reject undefined config', () => {
      const result = validateServiceConfig(undefined);
      expect(result.valid).toBe(false);
    });

    it('should reject string config', () => {
      const result = validateServiceConfig('invalid');
      expect(result.valid).toBe(false);
    });

    it('should reject number config', () => {
      const result = validateServiceConfig(123);
      expect(result.valid).toBe(false);
    });

    it('should reject array config', () => {
      const result = validateServiceConfig([]);
      expect(result.valid).toBe(false);
    });

    it('should report missing required fields', () => {
      const result = validateServiceConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const errorPaths = result.errors.map(e => e.path?.[0]);
      expect(errorPaths).toContain('serviceType');
      expect(errorPaths).toContain('ircdType');
      expect(errorPaths).toContain('services');
      expect(errorPaths).toContain('ircd');
    });

    it('should reject invalid serviceType', () => {
      const config = { ...validConfig, serviceType: 'invalid' };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toContain('serviceType');
    });

    it('should reject invalid ircdType', () => {
      const config = { ...validConfig, ircdType: 'invalid' };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toContain('ircdType');
    });

    it('should reject non-object services', () => {
      const config = { ...validConfig, services: 'invalid' };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toContain('services');
    });

    it('should reject null services', () => {
      const config = { ...validConfig, services: null };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should warn about unknown services', () => {
      const config = {
        ...validConfig,
        services: {
          ...validConfig.services,
          unknownservice: {
            enabled: true,
            nick: 'Unknown',
            commands: [],
          },
        },
      };
      const result = validateServiceConfig(config);
      expect(result.warnings).toContain('Unknown service: unknownservice');
    });

    it('should reject non-object ircd', () => {
      const config = { ...validConfig, ircd: 'invalid' };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toContain('ircd');
    });

    it('should reject null ircd', () => {
      const config = { ...validConfig, ircd: null };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject non-array userModes', () => {
      const config = {
        ...validConfig,
        ircd: { ...validConfig.ircd, userModes: 'invalid' },
      };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toContain('userModes');
    });

    it('should reject non-array channelModes', () => {
      const config = {
        ...validConfig,
        ircd: { ...validConfig.ircd, channelModes: 'invalid' },
      };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toContain('channelModes');
    });

    it('should reject non-array commands', () => {
      const config = {
        ...validConfig,
        ircd: { ...validConfig.ircd, commands: 'invalid' },
      };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toContain('commands');
    });

    it('should validate all valid service types', () => {
      const validTypes = [
        'anope',
        'atheme',
        'dalnet',
        'undernet',
        'quakenet',
        'generic',
      ];
      validTypes.forEach(type => {
        const config = { ...validConfig, serviceType: type };
        const result = validateServiceConfig(config);
        const serviceTypeError = result.errors.find(
          e => e.path?.[0] === 'serviceType',
        );
        expect(serviceTypeError).toBeUndefined();
      });
    });

    it('should validate all valid ircd types', () => {
      const validTypes = [
        'unrealircd',
        'inspircd',
        'charybdis',
        'solanum',
        'hybrid',
        'ngircd',
        'unknown',
      ];
      validTypes.forEach(type => {
        const config = { ...validConfig, ircdType: type };
        const result = validateServiceConfig(config);
        const ircdTypeError = result.errors.find(
          e => e.path?.[0] === 'ircdType',
        );
        expect(ircdTypeError).toBeUndefined();
      });
    });
  });

  describe('validateServiceDefinition', () => {
    it('should reject non-object service definition', () => {
      const config = {
        ...validConfig,
        services: { nickserv: 'invalid' },
      };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject missing enabled field', () => {
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            nick: 'NickServ',
            commands: [],
          },
        },
      };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
      const error = result.errors.find(e => e.path?.includes('enabled'));
      expect(error).toBeDefined();
    });

    it('should reject non-boolean enabled', () => {
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: 'yes',
            nick: 'NickServ',
            commands: [],
          },
        },
      };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject missing nick', () => {
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            commands: [],
          },
        },
      };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
      const error = result.errors.find(e => e.path?.includes('nick'));
      expect(error).toBeDefined();
    });

    it('should reject empty nick', () => {
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: '',
            commands: [],
          },
        },
      };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject non-array commands', () => {
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
            commands: 'invalid',
          },
        },
      };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject duplicate command names', () => {
      const baseCmd = {
        service: 'NickServ',
        aliases: [],
        usage: 'TEST',
        example: 'TEST',
        requiresAuth: false,
        parameters: [],
      };
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
            commands: [
              { ...baseCmd, name: 'REGISTER', description: 'Register' },
              { ...baseCmd, name: 'REGISTER', description: 'Duplicate' },
            ],
          },
        },
      };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.error?.includes('Duplicate command name')),
      ).toBe(true);
    });

    it('should reject duplicate suggestAlias', () => {
      const baseCmd = {
        service: 'NickServ',
        aliases: [],
        usage: 'TEST',
        example: 'TEST',
        requiresAuth: false,
        parameters: [],
      };
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
            commands: [
              {
                ...baseCmd,
                name: 'CMD1',
                description: 'Command 1',
                completion: { suggestAlias: 'alias1' },
              },
              {
                ...baseCmd,
                name: 'CMD2',
                description: 'Command 2',
                completion: { suggestAlias: 'alias1' },
              },
            ],
          },
        },
      };
      const result = validateServiceConfig(config);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.error?.includes('Duplicate suggestAlias')),
      ).toBe(true);
    });
  });

  describe('validateCommandInternal', () => {
    it('should reject invalid minLevel', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'invalid',
        requiresAuth: false,
        parameters: [],
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('minLevel');
    });

    it('should accept all valid minLevels', () => {
      const validLevels = ['user', 'op', 'halfop', 'admin', 'founder', 'oper'];
      validLevels.forEach(level => {
        const cmd = {
          name: 'TEST',
          service: 'Test',
          aliases: [],
          description: 'Test',
          usage: 'TEST',
          example: 'TEST',
          minLevel: level,
          requiresAuth: false,
          parameters: [],
        };
        const result = validateCommand(cmd);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject duplicate parameter names', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'Param 1',
            required: true,
          },
          {
            name: 'param1',
            type: 'number',
            description: 'Duplicate',
            required: true,
          },
        ],
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Duplicate parameter name');
    });

    it('should reject invalid parameter type', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [
          {
            name: 'param1',
            type: 'invalid',
            description: 'Param 1',
            required: true,
          },
        ],
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid parameter type');
    });

    it('should accept all valid parameter types', () => {
      const validTypes = [
        'string',
        'number',
        'channel',
        'nick',
        'duration',
        'enum',
        'boolean',
      ];
      validTypes.forEach(type => {
        const cmd = {
          name: 'TEST',
          service: 'Test',
          aliases: [],
          description: 'Test',
          usage: 'TEST',
          example: 'TEST',
          minLevel: 'user',
          requiresAuth: false,
          parameters: [
            { name: 'p', type, description: 'Param', required: true },
          ],
        };
        const result = validateCommand(cmd);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject non-array enumValues', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [
          {
            name: 'param1',
            type: 'enum',
            description: 'Param 1',
            required: true,
            enumValues: 'invalid',
          },
        ],
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('enumValues');
    });

    it('should accept valid enumValues', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [
          {
            name: 'param1',
            type: 'enum',
            description: 'Param 1',
            required: true,
            enumValues: ['a', 'b', 'c'],
          },
        ],
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid suggestAlias format (starts with number)', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [],
        completion: { suggestAlias: '1invalid' },
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('suggestAlias');
    });

    it('should reject invalid suggestAlias format (special chars)', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [],
        completion: { suggestAlias: 'invalid-alias' },
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(false);
    });

    it('should reject too short suggestAlias', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [],
        completion: { suggestAlias: 'a' },
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2-20');
    });

    it('should reject too long suggestAlias', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [],
        completion: { suggestAlias: 'a'.repeat(21) },
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(false);
    });

    it('should reject priority below 1', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [],
        completion: { suggestAlias: 'valid', priority: 0 },
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('priority');
    });

    it('should reject priority above 100', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [],
        completion: { suggestAlias: 'valid', priority: 101 },
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(false);
    });

    it('should accept valid priority', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [],
        completion: { suggestAlias: 'valid', priority: 50 },
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(true);
    });

    it('should accept valid suggestAlias', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user',
        requiresAuth: false,
        parameters: [],
        completion: { suggestAlias: 'valid' },
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateCommand', () => {
    it('should reject invalid command structure', () => {
      const result = validateCommand(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid command structure');
    });

    it('should reject non-object command', () => {
      const result = validateCommand('invalid');
      expect(result.valid).toBe(false);
    });

    it('should validate valid command', () => {
      const command = {
        name: 'TEST',
        service: 'Test',
        aliases: [],
        description: 'Test command',
        usage: 'TEST',
        example: 'TEST',
        minLevel: 'user' as const,
        requiresAuth: false,
        parameters: [],
      };
      const result = validateCommand(command);
      expect(result.valid).toBe(true);
    });
  });

  describe('isValidServiceConfig', () => {
    it('should return true for valid config', () => {
      expect(isValidServiceConfig(validConfig)).toBe(true);
    });

    it('should return false for invalid config', () => {
      expect(isValidServiceConfig(null)).toBe(false);
    });

    it('should return false for config with errors', () => {
      expect(isValidServiceConfig({})).toBe(false);
    });
  });

  describe('findDuplicateCommands', () => {
    it('should find duplicate commands across services', () => {
      const baseCmd = {
        description: 'Help',
        minLevel: 'user',
        aliases: [],
        usage: 'HELP',
        example: 'HELP',
        requiresAuth: false,
        parameters: [],
      };
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
            commands: [{ ...baseCmd, name: 'HELP' }],
          },
          chanserv: {
            enabled: true,
            nick: 'ChanServ',
            commands: [{ ...baseCmd, name: 'HELP' }],
          },
        },
      };
      const duplicates = findDuplicateCommands(config as any);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].command).toBe('HELP');
      expect(duplicates[0].services).toContain('nickserv');
      expect(duplicates[0].services).toContain('chanserv');
    });

    it('should return empty array when no duplicates', () => {
      const duplicates = findDuplicateCommands(validConfig as any);
      expect(duplicates).toHaveLength(0);
    });

    it('should handle service without commands', () => {
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
            commands: [
              {
                name: 'TEST',
                description: 'Test',
                minLevel: 'user',
                parameters: [],
              },
            ],
          },
          chanserv: {
            enabled: true,
            nick: 'ChanServ',
          },
        },
      };
      const duplicates = findDuplicateCommands(config as any);
      expect(duplicates).toHaveLength(0);
    });

    it('should handle null commands', () => {
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
            commands: null,
          },
        },
      };
      const duplicates = findDuplicateCommands(config as any);
      expect(duplicates).toHaveLength(0);
    });
  });

  describe('getAllSuggestAliases', () => {
    it('should collect all aliases', () => {
      const baseCmd = {
        description: 'Desc',
        minLevel: 'user',
        aliases: [],
        usage: 'CMD',
        example: 'CMD',
        requiresAuth: false,
        parameters: [],
      };
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
            commands: [
              {
                ...baseCmd,
                name: 'REGISTER',
                completion: { suggestAlias: 'register' },
              },
              {
                ...baseCmd,
                name: 'IDENTIFY',
                completion: { suggestAlias: 'identify' },
              },
            ],
          },
        },
      };
      const aliases = getAllSuggestAliases(config as any);
      expect(aliases.has('register')).toBe(true);
      expect(aliases.has('identify')).toBe(true);
      expect(aliases.get('register')).toEqual({
        service: 'nickserv',
        command: 'REGISTER',
      });
    });

    it('should return empty map when no aliases', () => {
      const aliases = getAllSuggestAliases(validConfig as any);
      expect(aliases.size).toBe(0);
    });

    it('should handle service without commands', () => {
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
          },
        },
      };
      const aliases = getAllSuggestAliases(config as any);
      expect(aliases.size).toBe(0);
    });
  });

  describe('findAliasConflicts', () => {
    it('should find conflicts with reserved words', () => {
      const baseCmd = {
        description: 'Join',
        minLevel: 'user',
        aliases: [],
        usage: 'JOIN',
        example: 'JOIN',
        requiresAuth: false,
        parameters: [],
      };
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
            commands: [
              {
                ...baseCmd,
                name: 'JOIN',
                completion: { suggestAlias: 'join' },
              },
            ],
          },
        },
      };
      const conflicts = findAliasConflicts(config as any, [
        'join',
        'part',
        'quit',
      ]);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].alias).toBe('join');
      expect(conflicts[0].command).toBe('JOIN');
      expect(conflicts[0].conflict).toBe('Reserved word');
    });

    it('should be case insensitive', () => {
      const baseCmd = {
        description: 'Test',
        minLevel: 'user',
        aliases: [],
        usage: 'TEST',
        example: 'TEST',
        requiresAuth: false,
        parameters: [],
      };
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
            commands: [
              {
                ...baseCmd,
                name: 'TEST',
                completion: { suggestAlias: 'JOIN' },
              },
            ],
          },
        },
      };
      const conflicts = findAliasConflicts(config as any, ['join']);
      expect(conflicts).toHaveLength(1);
    });

    it('should return empty array when no conflicts', () => {
      const baseCmd = {
        description: 'Test',
        minLevel: 'user',
        aliases: [],
        usage: 'TEST',
        example: 'TEST',
        requiresAuth: false,
        parameters: [],
      };
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
            commands: [
              {
                ...baseCmd,
                name: 'TEST',
                completion: { suggestAlias: 'custom' },
              },
            ],
          },
        },
      };
      const conflicts = findAliasConflicts(config as any, ['join', 'part']);
      expect(conflicts).toHaveLength(0);
    });

    it('should handle empty reserved words', () => {
      const config = {
        ...validConfig,
        services: {
          nickserv: {
            enabled: true,
            nick: 'NickServ',
            commands: [
              {
                name: 'TEST',
                description: 'Test',
                minLevel: 'user',
                parameters: [],
                completion: { suggestAlias: 'test' },
              },
            ],
          },
        },
      };
      const conflicts = findAliasConflicts(config as any, []);
      expect(conflicts).toHaveLength(0);
    });
  });
});
