/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for BasicIRCCommands - Wave 3 coverage target
 */

import {
  basicIRCCommands,
  handleJOIN,
  handlePART,
  handleNICK,
  handleSETNAME,
  handleBOT,
  handleQUIT,
  handleMODE,
  handleTOPIC,
  handleKICK,
  handleREGISTER,
} from '../../../../src/services/irc/sendCommands/BasicIRCCommands';
import type { SendMessageHandlerContext } from '../../../../src/services/irc/sendMessageTypes';
import { settingsService } from '../../../../src/services/SettingsService';

jest.mock('../../../../src/services/SettingsService', () => {
  const actual = jest.requireActual('../../../../src/services/SettingsService');
  return {
    ...actual,
    settingsService: {
      ...actual.settingsService,
      getSetting: jest.fn((key: string, defaultVal: any) => Promise.resolve(defaultVal)),
    },
  };
});

describe('BasicIRCCommands', () => {
  const createMockContext = (): Partial<SendMessageHandlerContext> => ({
    sendRaw: jest.fn(),
    sendCommand: jest.fn(),
    addMessage: jest.fn(),
    addRawMessage: jest.fn(),
    getCurrentNick: jest.fn().mockReturnValue('TestUser'),
    setCurrentNick: jest.fn(),
    getNetworkName: jest.fn().mockReturnValue('freenode'),
    emit: jest.fn(),
    joinChannel: jest.fn(),
    partChannel: jest.fn(),
    setRealname: jest.fn(),
    toggleBotMode: jest.fn(),
    hasCapability: jest.fn().mockReturnValue(false),
  });

  let ctx: SendMessageHandlerContext;

  beforeEach(() => {
    ctx = createMockContext() as SendMessageHandlerContext;
  });

  describe('basicIRCCommands Map', () => {
    it('should have JOIN handler registered', () => {
      expect(basicIRCCommands.has('JOIN')).toBe(true);
    });

    it('should have PART handler registered', () => {
      expect(basicIRCCommands.has('PART')).toBe(true);
    });

    it('should have NICK handler registered', () => {
      expect(basicIRCCommands.has('NICK')).toBe(true);
    });

    it('should have SETNAME handler registered', () => {
      expect(basicIRCCommands.has('SETNAME')).toBe(true);
    });

    it('should have BOT handler registered', () => {
      expect(basicIRCCommands.has('BOT')).toBe(true);
    });

    it('should have QUIT handler registered', () => {
      expect(basicIRCCommands.has('QUIT')).toBe(true);
    });

    it('should have MODE handler registered', () => {
      expect(basicIRCCommands.has('MODE')).toBe(true);
    });

    it('should have TOPIC handler registered', () => {
      expect(basicIRCCommands.has('TOPIC')).toBe(true);
    });

    it('should have KICK handler registered', () => {
      expect(basicIRCCommands.has('KICK')).toBe(true);
    });

    it('should have REGISTER handler registered', () => {
      expect(basicIRCCommands.has('REGISTER')).toBe(true);
    });
  });

  describe('handleJOIN', () => {
    it('should join channel', () => {
      handleJOIN(ctx, ['#general']);

      expect(ctx.joinChannel).toHaveBeenCalledWith('#general', undefined);
    });

    it('should join channel with key', () => {
      handleJOIN(ctx, ['#secret', 'password123']);

      expect(ctx.joinChannel).toHaveBeenCalledWith('#secret', 'password123');
    });

    it('should not join if no channel specified', () => {
      handleJOIN(ctx, []);

      expect(ctx.joinChannel).not.toHaveBeenCalled();
    });
  });

  describe('handlePART', () => {
    it('should part channel with message when first arg is channel', () => {
      // args[0] is channel, args.slice(1) is message
      handlePART(ctx, ['#general', 'Goodbye'], '#current');

      expect(ctx.partChannel).toHaveBeenCalledWith('#general', 'Goodbye');
    });

    it('should use first arg as channel and rest as message', () => {
      handlePART(ctx, ['#general', 'Leaving', 'now'], '#current');

      expect(ctx.partChannel).toHaveBeenCalledWith('#general', 'Leaving now');
    });

    it('should use target as channel when no args and target is channel', () => {
      handlePART(ctx, [], '#general');

      expect(ctx.partChannel).toHaveBeenCalledWith('#general', '');
    });

    it('should show error if parting without args and target is not a channel', () => {
      handlePART(ctx, [], 'SomeUser'); // target is not a channel

      expect(ctx.partChannel).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
      }));
    });
  });

  describe('handleNICK', () => {
    it('should send NICK command', () => {
      handleNICK(ctx, ['NewNick']);

      expect(ctx.sendRaw).toHaveBeenCalledWith('NICK NewNick');
    });

    it('should not send if no nick provided', () => {
      handleNICK(ctx, []);

      expect(ctx.sendRaw).not.toHaveBeenCalled();
    });
  });

  describe('handleSETNAME', () => {
    it('should set realname', () => {
      handleSETNAME(ctx, ['New', 'Real', 'Name']);

      expect(ctx.setRealname).toHaveBeenCalledWith('New Real Name');
    });

    it('should not set if no name provided', () => {
      handleSETNAME(ctx, []);

      expect(ctx.setRealname).not.toHaveBeenCalled();
    });
  });

  describe('handleBOT', () => {
    it('should enable bot mode', () => {
      handleBOT(ctx, []);

      expect(ctx.toggleBotMode).toHaveBeenCalledWith(true);
    });

    it('should enable bot mode explicitly', () => {
      handleBOT(ctx, ['on']);

      expect(ctx.toggleBotMode).toHaveBeenCalledWith(true);
    });

    it('should disable bot mode', () => {
      handleBOT(ctx, ['off']);

      expect(ctx.toggleBotMode).toHaveBeenCalledWith(false);
    });
  });

  describe('handleQUIT', () => {
    it('should emit intentional-quit event', async () => {
      await handleQUIT(ctx, ['Goodbye!'], '');

      expect(ctx.emit).toHaveBeenCalledWith('intentional-quit', 'freenode');
    });

    it('should send QUIT command with user-provided message', async () => {
      await handleQUIT(ctx, ['Goodbye!'], '');

      expect(ctx.sendRaw).toHaveBeenCalledWith('QUIT :Goodbye!');
      expect(settingsService.getSetting).not.toHaveBeenCalled();
    });

    it('should read quit message from settings when no args provided', async () => {
      (settingsService.getSetting as jest.Mock).mockResolvedValueOnce('Custom quit msg');

      await handleQUIT(ctx, [], '');

      expect(settingsService.getSetting).toHaveBeenCalledWith('quitMessage', expect.any(String));
      expect(ctx.sendRaw).toHaveBeenCalledWith('QUIT :Custom quit msg');
    });

    it('should use default quit message when settings returns default', async () => {
      await handleQUIT(ctx, [], '');

      expect(ctx.sendRaw).toHaveBeenCalledWith(expect.stringContaining('QUIT :'));
    });
  });

  describe('handleMODE', () => {
    it('should send MODE command', () => {
      handleMODE(ctx, ['#general', '+o', 'OtherUser']);

      expect(ctx.sendCommand).toHaveBeenCalledWith('MODE #general +o OtherUser');
    });

    it('should not send if no arguments', () => {
      handleMODE(ctx, []);

      expect(ctx.sendCommand).not.toHaveBeenCalled();
    });
  });

  describe('handleTOPIC', () => {
    it('should set topic when target is a channel and args provided', () => {
      // When target starts with #, use target as channel, args.slice(1) as text
      handleTOPIC(ctx, ['New', 'topic', 'here'], '#general');

      expect(ctx.sendCommand).toHaveBeenCalledWith('TOPIC #general :topic here');
    });

    it('should set topic using first arg as channel when target is not channel', () => {
      // When target doesn't start with #, first arg is channel, args.slice(1) is text
      handleTOPIC(ctx, ['#general', 'New', 'topic'], 'SomeUser');

      expect(ctx.sendCommand).toHaveBeenCalledWith('TOPIC #general :New topic');
    });

    it('should set topic to single arg when non-channel target and single arg', () => {
      // When target is not a channel and only one arg, that arg becomes the topic text
      // (not the channel - the channel comes from target or first arg)
      handleTOPIC(ctx, ['#general'], 'SomeUser');

      // args[0] becomes topic text since target doesn't start with #
      expect(ctx.sendCommand).toHaveBeenCalledWith('TOPIC #general :#general');
    });

    it('should get topic for current channel when no args', () => {
      handleTOPIC(ctx, [], '#general');

      expect(ctx.sendCommand).toHaveBeenCalledWith('TOPIC #general');
    });
  });

  describe('handleKICK', () => {
    it('should kick user with reason when target is channel', () => {
      // When target is channel: args[0]=channel (used as user), args[1]=user (used as reason), args[2+]=reason
      // Wait, looking at code again:
      // kickChannel = target (since target is channel)
      // kickUser = args.length > 1 ? args[1] : args[0] = 'Spamming'
      // kickReason = args.slice(2).join(' ') = ''
      // So it sends: KICK #general Spamming
      handleKICK(ctx, ['#somechannel', 'BadUser', 'Spamming'], '#general');

      expect(ctx.sendCommand).toHaveBeenCalledWith('KICK #general BadUser :Spamming');
    });

    it('should kick user without reason when target is channel', () => {
      // target is channel, args[0] used as user (since args.length === 1)
      handleKICK(ctx, ['BadUser'], '#general');

      expect(ctx.sendCommand).toHaveBeenCalledWith('KICK #general BadUser');
    });

    it('should kick user when channel is first arg and target is not channel', () => {
      // When target doesn't start with #: kickChannel=args[0], kickUser=args[1], kickReason=args.slice(2)
      handleKICK(ctx, ['#general', 'BadUser', 'Goodbye'], 'SomeUser');

      expect(ctx.sendCommand).toHaveBeenCalledWith('KICK #general BadUser :Goodbye');
    });

    it('should not send if no user specified', () => {
      handleKICK(ctx, [], '#general');

      expect(ctx.sendCommand).not.toHaveBeenCalled();
    });
  });

  describe('handleREGISTER', () => {
    it('should show error if capability not supported', () => {
      handleREGISTER(ctx, ['email@example.com', 'password123']);

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('not supported'),
      }));
      expect(ctx.sendRaw).not.toHaveBeenCalled();
    });

    it('should show usage if not enough arguments', () => {
      ctx.hasCapability = jest.fn().mockReturnValue(true);
      handleREGISTER(ctx, ['email@example.com']);

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        text: expect.stringContaining('Usage'),
      }));
    });

    it('should send REGISTER with email and password', () => {
      ctx.hasCapability = jest.fn().mockReturnValue(true);
      handleREGISTER(ctx, ['email@example.com', 'password123']);

      expect(ctx.sendRaw).toHaveBeenCalledWith('REGISTER * email@example.com :password123');
    });

    it('should send REGISTER with account, email and password', () => {
      ctx.hasCapability = jest.fn().mockReturnValue(true);
      handleREGISTER(ctx, ['MyAccount', 'email@example.com', 'password123']);

      expect(ctx.sendRaw).toHaveBeenCalledWith('REGISTER MyAccount email@example.com :password123');
    });
  });
});
