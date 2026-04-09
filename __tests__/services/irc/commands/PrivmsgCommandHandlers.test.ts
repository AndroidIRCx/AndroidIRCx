/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for PrivmsgCommandHandlers
 */

import {
  handlePRIVMSG,
  privmsgCommandHandlers,
} from '../../../../src/services/irc/commands/PrivmsgCommandHandlers';

describe('PrivmsgCommandHandlers', () => {
  let ctx: any;
  let addMessageMock: jest.Mock;
  let isUserIgnoredMock: jest.Mock;
  let isUserProtectedMock: jest.Mock;
  let evaluateProtectionDecisionMock: jest.Mock;
  let consoleWarnSpy: jest.SpyInstance;

  const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

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
      getProtectionTabContext: jest
        .fn()
        .mockReturnValue({ isActiveTab: true, isQueryOpen: false }),
      handleProtectionBlock: jest.fn(),
      handleCTCPRequest: jest.fn(),
      handleMultilineMessage: jest.fn().mockReturnValue('Hello world'),
      getEncryptedDMService: jest.fn().mockReturnValue({
        handleIncomingBundleForNetwork: jest.fn(),
        handleKeyOfferForNetwork: jest.fn(),
        handleKeyAcceptanceForNetwork: jest
          .fn()
          .mockResolvedValue({ status: 'stored' }),
        exportBundle: jest.fn().mockResolvedValue({}),
        decryptForNetwork: jest.fn().mockResolvedValue('decrypted'),
      }),
      getChannelEncryptionService: jest.fn().mockReturnValue({
        decryptMessage: jest.fn().mockResolvedValue('decrypted'),
        importChannelKey: jest.fn().mockResolvedValue({ channel: '#test' }),
      }),
      sendRaw: jest.fn(),
      emit: jest.fn(),
    };

    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
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

      handlePRIVMSG(
        ctx,
        'Friend!user@host.com',
        ['#channel', 'Hello'],
        Date.now(),
      );

      expect(isUserProtectedMock).toHaveBeenCalledWith(
        'Friend',
        'user',
        'host.com',
        'TestNetwork',
      );
      expect(isUserIgnoredMock).not.toHaveBeenCalled(); // Should skip ignore check
      expect(addMessageMock).toHaveBeenCalled(); // Message should be added
    });

    it('should ignore non-protected users on ignore list', () => {
      isUserIgnoredMock.mockReturnValue(true);
      isUserProtectedMock.mockReturnValue(false);

      handlePRIVMSG(
        ctx,
        'Spammer!user@host.com',
        ['#channel', 'Spam message'],
        Date.now(),
      );

      expect(isUserIgnoredMock).toHaveBeenCalledWith(
        'Spammer',
        'user',
        'host.com',
        'TestNetwork',
      );
      expect(addMessageMock).not.toHaveBeenCalled(); // Message should NOT be added
    });

    it('should skip protection checks for protected users', () => {
      isUserProtectedMock.mockReturnValue(true);

      handlePRIVMSG(
        ctx,
        'Admin!user@host.com',
        ['#channel', 'Admin message'],
        Date.now(),
      );

      expect(isUserProtectedMock).toHaveBeenCalledWith(
        'Admin',
        'user',
        'host.com',
        'TestNetwork',
      );
      expect(evaluateProtectionDecisionMock).not.toHaveBeenCalled(); // Should skip protection
      expect(addMessageMock).toHaveBeenCalled();
    });

    it('should run protection checks for non-protected users', () => {
      isUserProtectedMock.mockReturnValue(false);
      isUserIgnoredMock.mockReturnValue(false);

      handlePRIVMSG(
        ctx,
        'RegularUser!user@host.com',
        ['#channel', 'Normal message'],
        Date.now(),
      );

      expect(evaluateProtectionDecisionMock).toHaveBeenCalled();
    });

    it('should block message when protection check returns a decision', () => {
      isUserProtectedMock.mockReturnValue(false);
      isUserIgnoredMock.mockReturnValue(false);
      evaluateProtectionDecisionMock.mockReturnValue({ kind: 'spam' });

      handlePRIVMSG(
        ctx,
        'Spammer!user@host.com',
        ['#channel', 'Spam'],
        Date.now(),
      );

      expect(ctx.handleProtectionBlock).toHaveBeenCalledWith(
        'spam',
        'Spammer',
        'user',
        'host.com',
        '#channel',
      );
      expect(addMessageMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'message' }),
      );
    });
  });

  describe('Message handling', () => {
    it('should add channel message to chat', () => {
      ctx.handleMultilineMessage.mockReturnValue('Hello everyone');

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['#channel', 'Hello everyone'],
        Date.now(),
      );

      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message',
          channel: '#channel',
          from: 'User',
          text: 'Hello everyone',
        }),
        undefined,
      );
    });

    it('should add private message to chat', () => {
      ctx.handleMultilineMessage.mockReturnValue('Private hello');

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', 'Private hello'],
        Date.now(),
      );

      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message',
          channel: 'User',
          from: 'User',
          text: 'Private hello',
        }),
        undefined,
      );
    });

    it('should suppress self-to-self echo in queries', () => {
      ctx.getCurrentNick.mockReturnValue('MyNick');

      handlePRIVMSG(
        ctx,
        'MyNick!user@host.com',
        ['MyNick', 'Self message'],
        Date.now(),
      );

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
      ctx.parseCTCP.mockReturnValue({
        isCTCP: true,
        command: 'ACTION',
        args: 'does something',
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['#channel', '\x01ACTION does something\x01'],
        Date.now(),
      );

      expect(ctx.handleCTCPRequest).not.toHaveBeenCalled();
      expect(addMessageMock).toHaveBeenCalled();
    });

    it('should route non-ACTION CTCP requests', () => {
      ctx.parseCTCP.mockReturnValue({
        isCTCP: true,
        command: 'VERSION',
        args: '',
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['#channel', '\x01VERSION\x01'],
        Date.now(),
      );

      expect(ctx.handleCTCPRequest).toHaveBeenCalledWith(
        'User',
        '#channel',
        'VERSION',
        '',
      );
      expect(addMessageMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'message' }),
      );
    });
  });

  describe('Encryption protocol handling', () => {
    it('should handle !enc-key messages', () => {
      const handleBundleMock = jest.fn();
      ctx.getEncryptedDMService.mockReturnValue({
        handleIncomingBundleForNetwork: handleBundleMock,
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!enc-key {"key":"value"}'],
        Date.now(),
      );

      expect(handleBundleMock).toHaveBeenCalled();
      expect(addMessageMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'message' }),
      );
    });

    it('should handle !enc-offer messages', () => {
      const handleOfferMock = jest.fn();
      ctx.getEncryptedDMService.mockReturnValue({
        handleKeyOfferForNetwork: handleOfferMock,
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!enc-offer {"key":"value"}'],
        Date.now(),
      );

      expect(handleOfferMock).toHaveBeenCalledWith(
        'TestNetwork',
        'User',
        '{"key":"value"}',
      );
    });

    it('should handle !enc-accept stored and pending statuses', async () => {
      const acceptMock = jest
        .fn()
        .mockResolvedValueOnce({ status: 'stored' })
        .mockResolvedValueOnce({ status: 'pending' });
      ctx.getEncryptedDMService.mockReturnValue({
        handleKeyAcceptanceForNetwork: acceptMock,
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!enc-accept {"key":"value"}'],
        Date.now(),
      );
      await flushPromises();
      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notice',
          text: expect.stringContaining('accepted your encryption key'),
        }),
      );

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!enc-accept {"key":"other"}'],
        Date.now(),
      );
      await flushPromises();
      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notice',
          text: expect.stringContaining('different encryption key'),
        }),
      );
    });

    it('should warn when !enc-accept processing fails', async () => {
      ctx.getEncryptedDMService.mockReturnValue({
        handleKeyAcceptanceForNetwork: jest
          .fn()
          .mockRejectedValue(new Error('accept failed')),
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!enc-accept {"key":"value"}'],
        Date.now(),
      );
      await flushPromises();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'EncryptedDMService: failed to handle acceptance',
        expect.any(Error),
      );
    });

    it('should handle !enc-reject messages', () => {
      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!enc-reject'],
        Date.now(),
      );

      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notice',
          text: expect.stringContaining('rejected your encryption key offer'),
        }),
      );
    });

    it('should handle !enc-req success and failure', async () => {
      const exportBundleMock = jest
        .fn()
        .mockResolvedValueOnce({ pub: 'bundle' })
        .mockRejectedValueOnce(new Error('export failed'));
      ctx.getEncryptedDMService.mockReturnValue({
        exportBundle: exportBundleMock,
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!enc-req'],
        Date.now(),
      );
      await flushPromises();
      expect(ctx.sendRaw).toHaveBeenCalledWith(
        expect.stringContaining('PRIVMSG User :!enc-offer '),
      );

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!enc-req'],
        Date.now(),
      );
      await flushPromises();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'EncryptedDMService: failed to respond to enc-req',
        expect.any(Error),
      );
    });

    it('should handle !enc-msg messages', async () => {
      const decryptMock = jest.fn().mockResolvedValue('secret message');
      ctx.getEncryptedDMService.mockReturnValue({
        decryptForNetwork: decryptMock,
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!enc-msg {"data":"encrypted"}'],
        Date.now(),
      );

      // Wait for promise resolution
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(decryptMock).toHaveBeenCalled();
    });

    it('should handle invalid and undecryptable !enc-msg payloads', async () => {
      const decryptMock = jest
        .fn()
        .mockRejectedValue(new Error('cannot decrypt'));
      ctx.getEncryptedDMService.mockReturnValue({
        decryptForNetwork: decryptMock,
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!enc-msg {bad-json'],
        Date.now(),
      );
      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text: 'Invalid encrypted payload',
        }),
      );

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!enc-msg {"data":"encrypted"}'],
        Date.now(),
      );
      await flushPromises();
      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text: expect.stringContaining('could not be decrypted'),
        }),
      );
    });

    it('should handle !chanenc-msg messages', async () => {
      const decryptMock = jest.fn().mockResolvedValue('channel secret');
      ctx.getChannelEncryptionService.mockReturnValue({
        decryptMessage: decryptMock,
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['#channel', '!chanenc-msg {"data":"encrypted"}'],
        Date.now(),
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(decryptMock).toHaveBeenCalled();
    });

    it('should handle invalid, ignored-DM and failed !chanenc-msg payloads', async () => {
      const decryptMock = jest
        .fn()
        .mockRejectedValueOnce(new Error('no channel key'))
        .mockRejectedValueOnce(new Error('broken'));
      ctx.getChannelEncryptionService.mockReturnValue({
        decryptMessage: decryptMock,
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['#channel', '!chanenc-msg {bad-json'],
        Date.now(),
      );
      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text: '🔒 Invalid channel encryption payload',
        }),
      );

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!chanenc-msg {"data":"encrypted"}'],
        Date.now(),
      );
      expect(decryptMock).not.toHaveBeenCalled();

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['#channel', '!chanenc-msg {"data":"encrypted"}'],
        Date.now(),
      );
      await flushPromises();
      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message',
          text: expect.stringContaining('Missing channel key'),
        }),
      );

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['#channel', '!chanenc-msg {"data":"encrypted"}'],
        Date.now(),
      );
      await flushPromises();
      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message',
          text: expect.stringContaining('Decryption failed'),
        }),
      );
    });

    it('should import channel keys and surface import failures', async () => {
      const importChannelKeyMock = jest
        .fn()
        .mockResolvedValueOnce({ channel: '#secret' })
        .mockRejectedValueOnce('bad key');
      ctx.getChannelEncryptionService.mockReturnValue({
        importChannelKey: importChannelKeyMock,
      });

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!chanenc-key abc123'],
        Date.now(),
      );
      await flushPromises();
      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notice',
          text: expect.stringContaining('#secret'),
        }),
      );

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['MyNick', '!chanenc-key broken'],
        Date.now(),
      );
      await flushPromises();
      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text: expect.stringContaining('Failed to import channel key'),
        }),
      );
    });
  });

  describe('WebRTC protocol handling', () => {
    it('should emit parsed webrtc payloads and swallow invalid ones', () => {
      const ts = Date.now();

      handlePRIVMSG(
        ctx,
        'Peer!user@host.com',
        ['MyNick', '!webrtc {"sdp":"offer"}'],
        ts,
      );
      expect(ctx.emit).toHaveBeenCalledWith(
        'webrtc-signal',
        { sdp: 'offer' },
        expect.objectContaining({
          fromNick: 'Peer',
          network: 'TestNetwork',
          timestamp: ts,
        }),
      );

      handlePRIVMSG(
        ctx,
        'Peer!user@host.com',
        ['MyNick', '!webrtc {bad-json'],
        ts,
      );
      expect(addMessageMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message',
          text: expect.stringContaining('webrtc'),
        }),
      );
    });

    it('should emit parsed webrtc chunks and ignore self echoes', () => {
      ctx.getCurrentNick.mockReturnValue('MyNick');

      handlePRIVMSG(
        ctx,
        'Peer!user@host.com',
        ['MyNick', '!webrtc-chunk {"part":1}'],
        Date.now(),
      );
      expect(ctx.emit).toHaveBeenCalledWith(
        'webrtc-signal-chunk',
        { part: 1 },
        expect.any(Object),
      );

      ctx.emit.mockClear();
      handlePRIVMSG(
        ctx,
        'MyNick!user@host.com',
        ['OtherNick', '!webrtc {"sdp":"loop"}'],
        Date.now(),
      );
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(addMessageMock).not.toHaveBeenCalled();
    });
  });

  describe('ZNC timestamp stripping', () => {
    it('should strip leading ZNC timestamps', () => {
      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['#channel', '[12:34:56] Hello world'],
        Date.now(),
      );

      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Hello world' }),
        undefined,
      );
    });

    it('should strip trailing ZNC timestamps', () => {
      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['#channel', 'Hello world [12:34:56]'],
        Date.now(),
      );

      expect(addMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Hello world' }),
        undefined,
      );
    });

    it('should skip addMessage when multiline assembly is incomplete and forward meta tags', () => {
      const ts = Date.now();
      ctx.handleMultilineMessage.mockReturnValueOnce(null);

      handlePRIVMSG(
        ctx,
        'User!user@host.com',
        ['+channel', '[12:34:56] message body [23:45:56]'],
        ts,
        {
          multilineConcatTag: 'draft-1',
          accountTag: 'account',
          msgidTag: 'msg-1',
          channelContextTag: 'ctx',
          replyTag: 'reply-1',
          reactTag: { smile: ['User'] },
          typingTag: 'active',
          batchTag: 'batch-1',
        },
      );

      expect(ctx.handleMultilineMessage).toHaveBeenCalledWith(
        'User',
        '+channel',
        'message body',
        'draft-1',
        expect.objectContaining({
          timestamp: ts,
          account: 'account',
          msgid: 'msg-1',
          channelContext: 'ctx',
          replyTo: 'reply-1',
        }),
      );
      expect(addMessageMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'message' }),
        'batch-1',
      );
    });
  });
});
