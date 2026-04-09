/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for ChannelCommands - Wave 3 coverage target
 */

import {
  channelCommands,
  handleCNOTICE,
  handleCPRIVMSG,
  handleCHAT,
  handleANICK,
  handleAJINVITE,
  handleBEEP,
} from '../../../../src/services/irc/sendCommands/ChannelCommands';
import type { SendMessageHandlerContext } from '../../../../src/services/irc/sendMessageTypes';

describe('ChannelCommands', () => {
  const createMockContext = (): Partial<SendMessageHandlerContext> => ({
    addMessage: jest.fn(),
    sendRaw: jest.fn(),
    getCurrentNick: jest.fn().mockReturnValue('TestUser'),
    getNetworkName: jest.fn().mockReturnValue('freenode'),
    getCurrentChannel: jest.fn().mockReturnValue('#general'),
    emit: jest.fn(),
  });

  let ctx: SendMessageHandlerContext;

  beforeEach(() => {
    ctx = createMockContext() as SendMessageHandlerContext;
  });

  describe('channelCommands Map', () => {
    it('should have CNOTICE handler registered', () => {
      expect(channelCommands.has('CNOTICE')).toBe(true);
    });

    it('should have CPRIVMSG handler registered', () => {
      expect(channelCommands.has('CPRIVMSG')).toBe(true);
    });

    it('should have CHAT handler registered', () => {
      expect(channelCommands.has('CHAT')).toBe(true);
    });

    it('should have ANICK handler registered', () => {
      expect(channelCommands.has('ANICK')).toBe(true);
    });

    it('should have AJINVITE handler registered', () => {
      expect(channelCommands.has('AJINVITE')).toBe(true);
    });

    it('should have BEEP handler registered', () => {
      expect(channelCommands.has('BEEP')).toBe(true);
    });
  });

  describe('handleCNOTICE', () => {
    it('should send CNOTICE command', () => {
      handleCNOTICE(ctx, ['OtherUser', '#general', 'Hello there']);

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        'CNOTICE OtherUser #general :Hello there',
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notice',
          channel: '#general',
        }),
      );
    });

    it('should show usage if not enough arguments', () => {
      handleCNOTICE(ctx, ['OtherUser']);

      expect(ctx.sendRaw).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text: expect.stringContaining('Usage'),
        }),
      );
    });
  });

  describe('handleCPRIVMSG', () => {
    it('should send CPRIVMSG command', () => {
      handleCPRIVMSG(ctx, ['OtherUser', '#general', 'Secret message']);

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        'CPRIVMSG OtherUser #general :Secret message',
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message',
          channel: '#general',
        }),
      );
    });

    it('should show usage if not enough arguments', () => {
      handleCPRIVMSG(ctx, ['OtherUser']);

      expect(ctx.sendRaw).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
        }),
      );
    });
  });

  describe('handleCHAT', () => {
    it('should send PRIVMSG to service', () => {
      handleCHAT(ctx, ['NickServ', 'IDENTIFY mypassword']);

      expect(ctx.sendRaw).toHaveBeenCalledWith(
        'PRIVMSG NickServ :IDENTIFY mypassword',
      );
    });

    it('should show usage if not enough arguments', () => {
      handleCHAT(ctx, ['NickServ']);

      expect(ctx.sendRaw).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
        }),
      );
    });
  });

  describe('handleANICK', () => {
    it('should set alternate nickname', () => {
      handleANICK(ctx, ['MyAltNick']);

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notice',
          text: expect.stringContaining('Alternate nickname'),
        }),
      );
    });

    it('should show usage if no nickname provided', () => {
      handleANICK(ctx, []);

      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text: expect.stringContaining('Usage'),
        }),
      );
    });
  });

  describe('handleAJINVITE', () => {
    it('should toggle auto-join on invite on', () => {
      handleAJINVITE(ctx, ['on']);

      expect(ctx.emit).toHaveBeenCalledWith(
        'ajinvite-toggle',
        expect.objectContaining({
          state: 'on',
        }),
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('ON'),
        }),
      );
    });

    it('should toggle auto-join on invite off', () => {
      handleAJINVITE(ctx, ['off']);

      expect(ctx.emit).toHaveBeenCalledWith(
        'ajinvite-toggle',
        expect.objectContaining({
          state: 'off',
        }),
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('OFF'),
        }),
      );
    });

    it('should toggle auto-join when no state provided', () => {
      handleAJINVITE(ctx, []);

      expect(ctx.emit).toHaveBeenCalledWith(
        'ajinvite-toggle',
        expect.objectContaining({
          state: 'toggle',
        }),
      );
    });
  });

  describe('handleBEEP', () => {
    it('should emit beep event', () => {
      handleBEEP(ctx, []);

      expect(ctx.emit).toHaveBeenCalledWith(
        'beep',
        expect.objectContaining({
          count: 1,
          delay: 0,
        }),
      );
    });

    it('should emit beep with count', () => {
      handleBEEP(ctx, ['3']);

      expect(ctx.emit).toHaveBeenCalledWith(
        'beep',
        expect.objectContaining({
          count: 3,
          delay: 0,
        }),
      );
    });

    it('should emit beep with count and delay', () => {
      handleBEEP(ctx, ['5', '1000']);

      expect(ctx.emit).toHaveBeenCalledWith(
        'beep',
        expect.objectContaining({
          count: 5,
          delay: 1000,
        }),
      );
    });

    it('should handle invalid numbers gracefully', () => {
      handleBEEP(ctx, ['invalid', 'alsoInvalid']);

      expect(ctx.emit).toHaveBeenCalledWith(
        'beep',
        expect.objectContaining({
          count: 1, // NaN defaults to 1
          delay: 0,
        }),
      );
    });
  });
});
