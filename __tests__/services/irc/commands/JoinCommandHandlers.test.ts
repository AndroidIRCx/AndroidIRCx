/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for JoinCommandHandlers - Wave 3 coverage target
 */

import { joinCommandHandlers, handleJOIN } from '../../../../src/services/irc/commands/JoinCommandHandlers';
import type { CommandHandlerContext } from '../../../../src/services/irc/commandTypes';

describe('JoinCommandHandlers', () => {
  const createMockContext = (): Partial<CommandHandlerContext> => ({
    addMessage: jest.fn(),
    addRawMessage: jest.fn(),
    emit: jest.fn(),
    emitJoinedChannel: jest.fn(),
    logRaw: jest.fn(),
    getNetworkName: jest.fn().mockReturnValue('freenode'),
    getCurrentNick: jest.fn().mockReturnValue('TestUser'),
    sendRaw: jest.fn(),
    extractNick: jest.fn().mockImplementation((prefix: string) => prefix.split('!')[0]),
    runBlacklistCheckForJoin: jest.fn(),
    runAutoModeCheckForJoin: jest.fn(),
    ensureChannelUsersMap: jest.fn().mockReturnValue(new Map()),
    removeUser: jest.fn(),
    isIgnored: jest.fn().mockReturnValue(false),
    getUser: jest.fn(),
    setUser: jest.fn(),
    addUser: jest.fn(),
    updateChannelUserList: jest.fn(),
    isExtendedJoinEnabled: jest.fn().mockReturnValue(false),
    addPendingChannelIntro: jest.fn(),
  });

  let ctx: CommandHandlerContext;

  beforeEach(() => {
    ctx = createMockContext() as CommandHandlerContext;
  });

  describe('joinCommandHandlers Map', () => {
    it('should have JOIN handler registered', () => {
      expect(joinCommandHandlers.has('JOIN')).toBe(true);
    });
  });

  describe('handleJOIN', () => {
    it('should handle own join to channel', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('TestUser');
      ctx.extractNick = jest.fn().mockReturnValue('TestUser');
      ctx.getUser = jest.fn().mockReturnValue(undefined);
      
      handleJOIN(ctx, 'TestUser!~user@host.com', ['#general'], Date.now());

      expect(ctx.emitJoinedChannel).toHaveBeenCalledWith('#general');
      expect(ctx.addPendingChannelIntro).toHaveBeenCalledWith('#general');
      expect(ctx.ensureChannelUsersMap).toHaveBeenCalledWith('#general');
    });

    it('should handle other user joining channel', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('TestUser');
      ctx.extractNick = jest.fn().mockReturnValue('OtherUser');
      ctx.getUser = jest.fn().mockReturnValue(undefined);
      
      handleJOIN(ctx, 'OtherUser!~user@host.com', ['#general'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'join',
        from: 'OtherUser',
        channel: '#general',
      }));
    });

    it('should check blacklist on join when other user joins', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('TestUser');
      ctx.extractNick = jest.fn().mockReturnValue('BlackListedUser');
      ctx.getUser = jest.fn().mockReturnValue(undefined);
      
      handleJOIN(ctx, 'BlackListedUser!~user@host.com', ['#general'], Date.now());

      expect(ctx.runBlacklistCheckForJoin).toHaveBeenCalledWith(
        'BlackListedUser',
        '~user',
        'host.com',
        '#general'
      );
    });

    it('should run auto-mode check after blacklist check when other user joins', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('TestUser');
      ctx.extractNick = jest.fn().mockReturnValue('AutoOpUser');
      ctx.getUser = jest.fn().mockReturnValue(undefined);
      ctx.runAutoModeCheckForJoin = jest.fn();
      
      handleJOIN(ctx, 'AutoOpUser!~user@host.com', ['#general'], Date.now());

      expect(ctx.runAutoModeCheckForJoin).toHaveBeenCalledWith(
        'AutoOpUser',
        '~user',
        'host.com',
        '#general'
      );
    });

    it('should not run blacklist or auto-mode checks for self join', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('TestUser');
      ctx.extractNick = jest.fn().mockReturnValue('TestUser');
      ctx.getUser = jest.fn().mockReturnValue(undefined);
      ctx.runAutoModeCheckForJoin = jest.fn();
      
      handleJOIN(ctx, 'TestUser!~user@host.com', ['#general'], Date.now());

      expect(ctx.runBlacklistCheckForJoin).not.toHaveBeenCalled();
      expect(ctx.runAutoModeCheckForJoin).not.toHaveBeenCalled();
    });

    it('should handle join without extended join capability', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('TestUser');
      ctx.extractNick = jest.fn().mockReturnValue('SimpleUser');
      ctx.isExtendedJoinEnabled = jest.fn().mockReturnValue(false);
      ctx.getUser = jest.fn().mockReturnValue(undefined);
      
      // Even with account info, should ignore it when extended join is disabled
      handleJOIN(ctx, 'SimpleUser!~user@host.com', ['#general', 'account_name'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'join',
        text: 'SimpleUser joined #general',
      }));
      // Should not set account when extended join is disabled
      expect(ctx.setUser).toHaveBeenCalledWith('#general', 'SimpleUser', expect.objectContaining({
        account: undefined,
      }));
    });

    it('should handle extended join with account', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('TestUser');
      ctx.extractNick = jest.fn().mockReturnValue('RegisteredUser');
      ctx.isExtendedJoinEnabled = jest.fn().mockReturnValue(true);
      ctx.getUser = jest.fn().mockReturnValue(undefined);
      
      // Extended join format: JOIN #channel account :realname
      handleJOIN(ctx, 'RegisteredUser!~user@host.com', ['#general', 'registered_account', ':Real Name'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'join',
        from: 'RegisteredUser',
        channel: '#general',
        text: expect.stringContaining('registered_account'),
      }));
      expect(ctx.setUser).toHaveBeenCalledWith('#general', 'RegisteredUser', expect.objectContaining({
        nick: 'RegisteredUser',
        account: 'registered_account',
      }));
    });

    it('should handle extended join with * account (no account)', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('TestUser');
      ctx.extractNick = jest.fn().mockReturnValue('UnregisteredUser');
      ctx.isExtendedJoinEnabled = jest.fn().mockReturnValue(true);
      ctx.getUser = jest.fn().mockReturnValue(undefined);
      
      // * means no account
      handleJOIN(ctx, 'UnregisteredUser!~user@host.com', ['#general', '*', ':Real Name'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'join',
        from: 'UnregisteredUser',
        channel: '#general',
        text: expect.not.stringContaining('*'),
      }));
    });

    it('should update existing user account if already in channel', () => {
      const existingUser = { nick: 'ExistingUser', modes: [], account: undefined };
      ctx.getCurrentNick = jest.fn().mockReturnValue('TestUser');
      ctx.extractNick = jest.fn().mockReturnValue('ExistingUser');
      ctx.isExtendedJoinEnabled = jest.fn().mockReturnValue(true);
      ctx.getUser = jest.fn().mockReturnValue(existingUser);
      
      handleJOIN(ctx, 'ExistingUser!~user@host.com', ['#general', 'new_account', ':Real Name'], Date.now());

      expect(existingUser.account).toBe('new_account');
      expect(ctx.setUser).not.toHaveBeenCalled();
    });

    it('should extract username and hostname from prefix', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('TestUser');
      ctx.extractNick = jest.fn().mockReturnValue('JoiningUser');
      ctx.getUser = jest.fn().mockReturnValue(undefined);
      
      handleJOIN(ctx, 'JoiningUser!~username@hostname.com', ['#general'], Date.now());

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        username: '~username',
        hostname: 'hostname.com',
      }));
    });

    it('should update channel user list when new user joins', () => {
      ctx.getCurrentNick = jest.fn().mockReturnValue('TestUser');
      ctx.extractNick = jest.fn().mockReturnValue('NewUser');
      ctx.getUser = jest.fn().mockReturnValue(undefined);
      
      handleJOIN(ctx, 'NewUser!~user@host.com', ['#general'], Date.now());

      expect(ctx.updateChannelUserList).toHaveBeenCalledWith('#general');
    });
  });
});
