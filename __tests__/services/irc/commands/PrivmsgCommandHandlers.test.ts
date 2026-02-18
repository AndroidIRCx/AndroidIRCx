/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for PrivmsgCommandHandlers
 */

import { handlePRIVMSG, privmsgCommandHandlers } from '../../../../src/services/irc/commands/PrivmsgCommandHandlers';

describe('PrivmsgCommandHandlers', () => {
  let ctx: any;
  let addMessageMock: jest.Mock;
  let isUserIgnoredMock: jest.Mock;
  let isUserProtectedMock: jest.Mock;
  let evaluateProtectionDecisionMock: jest.Mock;

  beforeEach(() => {
    addMessageMock = jest.fn();
    isUserIgnoredMock = jest.fn().mockReturnValue(false);
    isUserProtectedMock = jest.fn().mockReturnValue(false);
    evaluateProtectionDecisionMock = jest.fn().mockReturnValue(null);

    ctx = {
      addMessage: addMessageMock,
      extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
      parseCTCP: jest.fn().mockReturnValue({ isCTCP: false }),
      getNetworkName: jest.fn().mockReturnValue('TestNetwork'),
      getCurrentNick: jest.fn().mockReturnValue('MyNick'),
      isUserIgnored: isUserIgnoredMock,
      isUserProtected: isUserProtectedMock,
      evaluateProtectionDecision: evaluateProtectionDecisionMock,
      getProtectionTabContext: jest.fn().mockReturnValue({ isActiveTab: true, isQueryOpen: false }),
      handleProtectionBlock: jest.fn(),
      handleCTCPRequest: jest.fn(),
      handleMultilineMessage: jest.fn().mockReturnValue('Hello world'),
      getEncryptedDMService: jest.fn().mockReturnValue({
        handleIncomingBundleForNetwork: jest.fn(),
        handleKeyOfferForNetwork: jest.fn(),
        handleKeyAcceptanceForNetwork: jest.fn().mockResolvedValue({ status: 'stored' }),
        exportBundle: jest.fn().mockResolvedValue({}),
        decryptForNetwork: jest.fn().mockResolvedValue('decrypted'),
      }),
      getChannelEncryptionService: jest.fn().mockReturnValue({
        decryptMessage: jest.fn().mockResolvedValue('decrypted'),
        importChannelKey: jest.fn().mockResolvedValue({ channel: '#test' }),
      }),
      sendRaw: jest.fn(),
    };
  });

  describe('Module exports', () => {
    it('exports handlePRIVMSG handler', () => {
      expect(handlePRIVMSG).toBeDefined();
      expect(typeof handlePRIVMSG).toBe('function');
    });

    it('exports privmsgCommandHandlers map', () => {
      expect(privmsgCommandHandlers).toBeDefined();
      expect(privmsgCommandHandlers.has('PRIVMSG')).toBe(true);
    });
  });

  describe('Protected user handling', () => {
    it('should not ignore protected users even if they are on ignore list', () => {
      isUserIgnoredMock.mockReturnValue(true); // User is on ignore list
      isUserProtectedMock.mockReturnValue(true); // But is protected

      handlePRIVMSG(ctx, 'Friend!user@host.com', ['#channel', 'Hello'], Date.now());

      expect(isUserProtectedMock).toHaveBeenCalledWith('Friend', 'user', 'host.com', 'TestNetwork');
      expect(isUserIgnoredMock).not.toHaveBeenCalled(); // Should skip ignore check
      expect(addMessageMock).toHaveBeenCalled(); // Message should be added
    });

    it('should ignore non-protected users on ignore list', () => {
      isUserIgnoredMock.mockReturnValue(true);
      isUserProtectedMock.mockReturnValue(false);

      handlePRIVMSG(ctx, 'Spammer!user@host.com', ['#channel', 'Spam message'], Date.now());

      expect(isUserIgnoredMock).toHaveBeenCalledWith('Spammer', 'user', 'host.com', 'TestNetwork');
      expect(addMessageMock).not.toHaveBeenCalled(); // Message should NOT be added
    });

    it('should skip protection checks for protected users', () => {
      isUserProtectedMock.mockReturnValue(true);

      handlePRIVMSG(ctx, 'Admin!user@host.com', ['#channel', 'Admin message'], Date.now());

      expect(isUserProtectedMock).toHaveBeenCalledWith('Admin', 'user', 'host.com', 'TestNetwork');
      expect(evaluateProtectionDecisionMock).not.toHaveBeenCalled(); // Should skip protection
      expect(addMessageMock).toHaveBeenCalled();
    });

    it('should run protection checks for non-protected users', () => {
      isUserProtectedMock.mockReturnValue(false);
      isUserIgnoredMock.mockReturnValue(false);

      handlePRIVMSG(ctx, 'RegularUser!user@host.com', ['#channel', 'Normal message'], Date.now());

      expect(evaluateProtectionDecisionMock).toHaveBeenCalled();
    });

    it('should block message when protection check returns a decision', () => {
      isUserProtectedMock.mockReturnValue(false);
      isUserIgnoredMock.mockReturnValue(false);
      evaluateProtectionDecisionMock.mockReturnValue({ kind: 'spam' });

      handlePRIVMSG(ctx, 'Spammer!user@host.com', ['#channel', 'Spam'], Date.now());

      expect(ctx.handleProtectionBlock).toHaveBeenCalledWith('spam', 'Spammer', 'user', 'host.com', '#channel');
      expect(addMessageMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'message' }));
    });
  });

  describe('Message handling', () => {
    it('should add channel message to chat', () => {
      ctx.handleMultilineMessage.mockReturnValue('Hello everyone');
      
      handlePRIVMSG(ctx, 'User!user@host.com', ['#channel', 'Hello everyone'], Date.now());

      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'message',
        channel: '#channel',
        from: 'User',
        text: 'Hello everyone',
      }), undefined);
    });

    it('should add private message to chat', () => {
      ctx.handleMultilineMessage.mockReturnValue('Private hello');
      
      handlePRIVMSG(ctx, 'User!user@host.com', ['MyNick', 'Private hello'], Date.now());

      expect(addMessageMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'message',
        channel: 'User',
        from: 'User',
        text: 'Private hello',
      }), undefined);
    });

    it('should suppress self-to-self echo in queries', () => {
      ctx.getCurrentNick.mockReturnValue('MyNick');
      
      handlePRIVMSG(ctx, 'MyNick!user@host.com', ['MyNick', 'Self message'], Date.now());

      expect(addMessageMock).not.toHaveBeenCalled();
    });

    it('should skip invalid targets', () => {
      handlePRIVMSG(ctx, 'User!user@host.com', ['*', 'Message'], Date.now());

      expect(addMessageMock).not.toHaveBeenCalled();
    });

    it('should skip empty targets', () => {
      handlePRIVMSG(ctx, 'User!user@host.com', ['   ', 'Message'], Date.now());

      expect(addMessageMock).not.toHaveBeenCalled();
    });
  });

  describe('CTCP handling', () => {
    it('should handle ACTION as regular message', () => {
      ctx.parseCTCP.mockReturnValue({ isCTCP: true, command: 'ACTION', args: 'does something' });

      handlePRIVMSG(ctx, 'User!user@host.com', ['#channel', '\x01ACTION does something\x01'], Date.now());

      expect(ctx.handleCTCPRequest).not.toHaveBeenCalled();
      expect(addMessageMock).toHaveBeenCalled();
    });

    it('should route non-ACTION CTCP requests', () => {
      ctx.parseCTCP.mockReturnValue({ isCTCP: true, command: 'VERSION', args: '' });

      handlePRIVMSG(ctx, 'User!user@host.com', ['#channel', '\x01VERSION\x01'], Date.now());

      expect(ctx.handleCTCPRequest).toHaveBeenCalledWith('User', '#channel', 'VERSION', '');
      expect(addMessageMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'message' }));
    });
  });

  describe('Encryption protocol handling', () => {
    it('should handle !enc-key messages', () => {
      const handleBundleMock = jest.fn();
      ctx.getEncryptedDMService.mockReturnValue({
        handleIncomingBundleForNetwork: handleBundleMock,
      });

      handlePRIVMSG(ctx, 'User!user@host.com', ['MyNick', '!enc-key {"key":"value"}'], Date.now());

      expect(handleBundleMock).toHaveBeenCalled();
      expect(addMessageMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'message' }));
    });

    it('should handle !enc-msg messages', async () => {
      const decryptMock = jest.fn().mockResolvedValue('secret message');
      ctx.getEncryptedDMService.mockReturnValue({
        decryptForNetwork: decryptMock,
      });

      handlePRIVMSG(ctx, 'User!user@host.com', ['MyNick', '!enc-msg {"data":"encrypted"}'], Date.now());

      // Wait for promise resolution
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(decryptMock).toHaveBeenCalled();
    });

    it('should handle !chanenc-msg messages', async () => {
      const decryptMock = jest.fn().mockResolvedValue('channel secret');
      ctx.getChannelEncryptionService.mockReturnValue({
        decryptMessage: decryptMock,
      });

      handlePRIVMSG(ctx, 'User!user@host.com', ['#channel', '!chanenc-msg {"data":"encrypted"}'], Date.now());

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(decryptMock).toHaveBeenCalled();
    });
  });

  describe('ZNC timestamp stripping', () => {
    it('should strip leading ZNC timestamps', () => {
      handlePRIVMSG(ctx, 'User!user@host.com', ['#channel', '[12:34:56] Hello world'], Date.now());

      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Hello world' }),
        undefined
      );
    });

    it('should strip trailing ZNC timestamps', () => {
      handlePRIVMSG(ctx, 'User!user@host.com', ['#channel', 'Hello world [12:34:56]'], Date.now());

      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Hello world' }),
        undefined
      );
    });
  });
});
