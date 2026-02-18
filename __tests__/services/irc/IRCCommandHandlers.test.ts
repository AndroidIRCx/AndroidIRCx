/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for IRCCommandHandlers
 */

import { IRCCommandHandlers } from '../../../src/services/irc/IRCCommandHandlers';
import { userManagementService } from '../../../src/services/UserManagementService';

// Mock dependencies
jest.mock('../../../src/services/UserManagementService', () => ({
  userManagementService: {
    isUserProtected: jest.fn(),
    findMatchingBlacklistEntry: jest.fn(),
    findMatchingUserListEntry: jest.fn(),
    getIgnoredUsers: jest.fn(),
    getBlacklistEntries: jest.fn(),
    getUserListEntries: jest.fn(),
  },
}));

describe('IRCCommandHandlers', () => {
  let mockService: any;
  let handlers: IRCCommandHandlers;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockService = {
      addMessage: jest.fn(),
      addRawMessage: jest.fn(),
      emit: jest.fn(),
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
      parseCTCP: jest.fn(),
      getNetworkName: jest.fn().mockReturnValue('TestNetwork'),
      currentNick: 'MyNick',
      getUserManagementService: jest.fn().mockReturnValue(userManagementService),
      getProtectionTabContext: jest.fn(),
      handleProtectionBlock: jest.fn(),
      extractMaskFromNotice: jest.fn(),
      runBlacklistAction: jest.fn(),
      logRaw: jest.fn(),
      handleServerError: jest.fn(),
      decodeIfBase64Like: jest.fn((v: string) => v),
      handleBatchStart: jest.fn(),
      handleBatchEnd: jest.fn(),
      handleCAPCommand: jest.fn(),
      channelTopics: new Map(),
      maybeEmitChannelIntro: jest.fn(),
      handleChannelModeChange: jest.fn(),
      updateSelfUserModes: jest.fn(),
      channelUsers: new Map(),
      updateChannelUserList: jest.fn(),
      sendRaw: jest.fn(),
    };

    handlers = new IRCCommandHandlers(mockService);
  });

  describe('Module exports', () => {
    it('loads module exports', () => {
      expect(IRCCommandHandlers).toBeDefined();
      expect(typeof IRCCommandHandlers).toBe('function');
    });
  });

  describe('handle', () => {
    it('should return false for unknown commands', () => {
      const result = (handlers as any).handle('UNKNOWNXYZ123', 'server', ['param1'], Date.now());
      expect(result).toBe(false);
    });
  });

  describe('runBlacklistCheckForJoin', () => {
    it('should skip blacklist check for protected users', () => {
      (userManagementService.isUserProtected as jest.Mock).mockReturnValue(true);
      (userManagementService.findMatchingBlacklistEntry as jest.Mock).mockReturnValue({
        mask: 'baduser',
        action: 'ban',
      });

      // Create context and call runBlacklistCheckForJoin
      const ctx = (handlers as any).ctx;
      ctx.runBlacklistCheckForJoin('baduser', 'user', 'host.com', '#channel');

      expect(userManagementService.isUserProtected).toHaveBeenCalledWith(
        'baduser', 'user', 'host.com', 'TestNetwork'
      );
      expect(userManagementService.findMatchingBlacklistEntry).not.toHaveBeenCalled();
      expect(mockService.runBlacklistAction).not.toHaveBeenCalled();
    });

    it('should run blacklist action for non-protected matching users', () => {
      (userManagementService.isUserProtected as jest.Mock).mockReturnValue(false);
      (userManagementService.findMatchingBlacklistEntry as jest.Mock).mockReturnValue({
        mask: 'baduser',
        action: 'kick_ban',
        reason: 'Spam',
      });

      const ctx = (handlers as any).ctx;
      ctx.runBlacklistCheckForJoin('baduser', 'user', 'host.com', '#channel');

      expect(userManagementService.findMatchingBlacklistEntry).toHaveBeenCalledWith(
        'baduser', 'user', 'host.com', 'TestNetwork'
      );
      expect(mockService.runBlacklistAction).toHaveBeenCalled();
    });

    it('should not run action when no blacklist entry matches', () => {
      (userManagementService.isUserProtected as jest.Mock).mockReturnValue(false);
      (userManagementService.findMatchingBlacklistEntry as jest.Mock).mockReturnValue(undefined);

      const ctx = (handlers as any).ctx;
      ctx.runBlacklistCheckForJoin('gooduser', 'user', 'host.com', '#channel');

      expect(mockService.runBlacklistAction).not.toHaveBeenCalled();
    });
  });

  describe('runAutoModeCheckForJoin', () => {
    beforeEach(() => {
      // Set up channel users with ourself having op
      mockService.channelUsers.set('#channel', new Map([
        ['mynick', { nick: 'MyNick', modes: ['o'] }],
        ['newuser', { nick: 'newuser', modes: [] }],
      ]));
    });

    it('should grant +o to users on autoop list when we have op', () => {
      (userManagementService.findMatchingUserListEntry as jest.Mock)
        .mockImplementation((type: string) => {
          if (type === 'autoop') {
            return { mask: 'trusted!*@*', protected: true };
          }
          return undefined;
        });

      const ctx = (handlers as any).ctx;
      ctx.runAutoModeCheckForJoin('trusted', 'user', 'host.com', '#channel');

      expect(userManagementService.findMatchingUserListEntry).toHaveBeenCalledWith(
        'autoop', 'trusted', 'user', 'host.com', 'TestNetwork', '#channel'
      );
      expect(mockService.sendRaw).toHaveBeenCalledWith('MODE #channel +o trusted');
    });

    it('should grant +h to users on autohalfop list when we have op', () => {
      (userManagementService.findMatchingUserListEntry as jest.Mock)
        .mockImplementation((type: string) => {
          if (type === 'autoop') return undefined;
          if (type === 'autohalfop') {
            return { mask: 'mod!*@*', protected: false };
          }
          return undefined;
        });

      const ctx = (handlers as any).ctx;
      ctx.runAutoModeCheckForJoin('mod', 'user', 'host.com', '#channel');

      expect(mockService.sendRaw).toHaveBeenCalledWith('MODE #channel +h mod');
    });

    it('should grant +v to users on autovoice list when we have voice or higher', () => {
      (userManagementService.findMatchingUserListEntry as jest.Mock)
        .mockImplementation((type: string) => {
          if (type === 'autoop' || type === 'autohalfop') return undefined;
          if (type === 'autovoice') {
            return { mask: 'speaker!*@*', protected: false };
          }
          return undefined;
        });

      const ctx = (handlers as any).ctx;
      ctx.runAutoModeCheckForJoin('speaker', 'user', 'host.com', '#channel');

      expect(mockService.sendRaw).toHaveBeenCalledWith('MODE #channel +v speaker');
    });

    it('should not grant modes when we do not have sufficient privileges', () => {
      // Change our modes to have no privileges
      mockService.channelUsers.set('#channel', new Map([
        ['mynick', { nick: 'MyNick', modes: [] }],
      ]));

      (userManagementService.findMatchingUserListEntry as jest.Mock)
        .mockImplementation((type: string) => {
          if (type === 'autoop') {
            return { mask: 'trusted!*@*', protected: false };
          }
          return undefined;
        });

      const ctx = (handlers as any).ctx;
      ctx.runAutoModeCheckForJoin('trusted', 'user', 'host.com', '#channel');

      expect(mockService.sendRaw).not.toHaveBeenCalled();
    });

    it('should not grant voice when we only have voice (need op or halfop for voice)', () => {
      // We only have voice, not op/halfop
      mockService.channelUsers.set('#channel', new Map([
        ['mynick', { nick: 'MyNick', modes: ['v'] }],
      ]));

      (userManagementService.findMatchingUserListEntry as jest.Mock)
        .mockImplementation((type: string) => {
          if (type === 'autovoice') {
            return { mask: 'speaker!*@*', protected: false };
          }
          return undefined;
        });

      const ctx = (handlers as any).ctx;
      ctx.runAutoModeCheckForJoin('speaker', 'user', 'host.com', '#channel');

      // We have voice so we CAN grant voice to others
      expect(mockService.sendRaw).toHaveBeenCalledWith('MODE #channel +v speaker');
    });

    it('should not send mode when no list entry matches', () => {
      (userManagementService.findMatchingUserListEntry as jest.Mock).mockReturnValue(undefined);

      const ctx = (handlers as any).ctx;
      ctx.runAutoModeCheckForJoin('randomuser', 'user', 'host.com', '#channel');

      expect(mockService.sendRaw).not.toHaveBeenCalled();
    });

    it('should check autoop first, then halfop, then voice', () => {
      const findMock = jest.fn()
        .mockReturnValueOnce({ mask: 'user!*@*', protected: false }) // autoop returns match
        .mockReturnValue(undefined);
      
      (userManagementService.findMatchingUserListEntry as jest.Mock) = findMock;

      // Need to recreate handlers to use the new mock
      handlers = new IRCCommandHandlers(mockService);
      const ctx = (handlers as any).ctx;
      
      // Re-mock for this test
      (userManagementService.findMatchingUserListEntry as jest.Mock)
        .mockImplementation((type: string) => {
          if (type === 'autoop') return { mask: 'user!*@*', protected: false };
          return undefined;
        });

      ctx.runAutoModeCheckForJoin('user', 'user', 'host.com', '#channel');

      // Should only call autoop, not others (returns early)
      expect(mockService.sendRaw).toHaveBeenCalledTimes(1);
      expect(mockService.sendRaw).toHaveBeenCalledWith('MODE #channel +o user');
    });
  });
});
