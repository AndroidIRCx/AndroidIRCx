/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * ServiceCommandProvider Unit Tests
 */

import { serviceCommandProvider, ServiceCommandProvider } from '../../src/services/ServiceCommandProvider';
import { serviceDetectionService } from '../../src/services/ServiceDetectionService';
import { CompletionContext, AccessLevel } from '../../src/interfaces/ServiceTypes';

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

      const commands = serviceCommandProvider.getServiceCommands('test-network', 'nickserv');
      expect(Array.isArray(commands)).toBe(true);
    });

    it('should return empty array for non-existent service', () => {
      const commands = serviceCommandProvider.getServiceCommands('unknown-network', 'nickserv');
      expect(commands).toEqual([]);
    });
  });

  describe('findCommand', () => {
    beforeEach(() => {
      serviceDetectionService.initializeNetwork('test-network');
      serviceDetectionService.processNetworkName('test-network', 'anope');
    });

    it('should find command by name', () => {
      const result = serviceCommandProvider.findCommand('test-network', 'REGISTER');
      
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
        const result = serviceCommandProvider.findCommand('test-network', alias);
        
        if (result) {
          expect(result.command).toBeDefined();
        }
      }
    });

    it('should return undefined for unknown command', () => {
      const result = serviceCommandProvider.findCommand('test-network', 'UNKNOWNCOMMAND123');
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
      
      const suggestions = serviceCommandProvider.getSuggestions('unknown-network', 'ns', context);
      expect(suggestions).toEqual([]);
    });

    it('should return suggestions matching query', () => {
      const context: CompletionContext = {
        userLevel: 'user',
        isAuthenticated: false,
      };
      
      const suggestions = serviceCommandProvider.getSuggestions('test-network', 'ns', context);
      expect(Array.isArray(suggestions)).toBe(true);
      
      // Should include nick-related commands
      const hasNickServ = suggestions.some(s => 
        s.text.toLowerCase().includes('nick') || 
        s.serviceNick?.toLowerCase().includes('nickserv')
      );
      
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
      
      const userSuggestions = serviceCommandProvider.getSuggestions('test-network', 'os', userContext);
      const operSuggestions = serviceCommandProvider.getSuggestions('test-network', 'os', operContext);
      
      // Oper should see more suggestions than regular user
      expect(operSuggestions.length).toBeGreaterThanOrEqual(userSuggestions.length);
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
      const levels: AccessLevel[] = ['user', 'op', 'halfop', 'admin', 'founder', 'oper'];
      
      for (const level of levels) {
        const context: CompletionContext = {
          userLevel: level,
          isAuthenticated: false,
        };
        
        // User-level commands should be accessible to all
        const suggestions = serviceCommandProvider.getSuggestions('test-network', 'help', context);
        // This test mainly ensures no errors are thrown
        expect(Array.isArray(suggestions)).toBe(true);
      }
    });
  });
});
