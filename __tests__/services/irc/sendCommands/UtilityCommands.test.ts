/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleECHO,
  handleCLEAR,
  handleCLOSE,
  handleHELP,
  handleRAW,
  handleDNS,
  handleTIMER,
  handleWINDOW,
  handleFILTER,
  handleCLONES,
  handleIGNORE,
  handleUNIGNORE,
  utilityCommands,
} from '../../../../src/services/irc/sendCommands/UtilityCommands';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('UtilityCommands', () => {
  let ctx: any;
  let mockIgnoreUser: jest.Mock;
  let mockUnignoreUser: jest.Mock;

  beforeEach(() => {
    mockIgnoreUser = jest.fn().mockResolvedValue(undefined);
    mockUnignoreUser = jest.fn().mockResolvedValue(undefined);

    ctx = {
      sendRaw: jest.fn(),
      addMessage: jest.fn(),
      emit: jest.fn(),
      getNetworkName: jest.fn().mockReturnValue('TestNet'),
      detectClones: jest.fn().mockResolvedValue(new Map()),
      getUserManagementService: jest.fn().mockReturnValue({
        ignoreUser: mockIgnoreUser,
        unignoreUser: mockUnignoreUser,
      }),
    };
  });

  describe('utilityCommands map', () => {
    it('registers all utility commands', () => {
      [
        'ECHO',
        'CLEAR',
        'CLOSE',
        'HELP',
        'RAW',
        'DNS',
        'TIMER',
        'WINDOW',
        'FILTER',
        'CLONES',
        'DETECTCLONES',
        'CLONESDETECT',
        'IGNORE',
        'UNIGNORE',
      ].forEach(cmd => {
        expect(utilityCommands.has(cmd)).toBe(true);
      });
    });

    it('maps DETECTCLONES to same handler as CLONES', () => {
      expect(utilityCommands.get('DETECTCLONES')).toBe(
        utilityCommands.get('CLONES'),
      );
    });

    it('maps CLONESDETECT to same handler as CLONES', () => {
      expect(utilityCommands.get('CLONESDETECT')).toBe(
        utilityCommands.get('CLONES'),
      );
    });
  });

  describe('handleECHO', () => {
    it('displays notice with message text', () => {
      handleECHO(ctx, ['Hello', 'world'], '#channel');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice', text: 'Hello world' }),
      );
    });

    it('adds error when no args', () => {
      handleECHO(ctx, [], '#channel');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleCLEAR', () => {
    it('emits clear-tab event', () => {
      handleCLEAR(ctx, [], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith('clear-tab', '#channel', 'TestNet');
    });

    it('adds notice message', () => {
      handleCLEAR(ctx, [], '#channel');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });
  });

  describe('handleCLOSE', () => {
    it('emits close-tab event', () => {
      handleCLOSE(ctx, [], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith('close-tab', '#channel', 'TestNet');
    });
  });

  describe('handleHELP', () => {
    it('emits help event and adds notice for specific command', () => {
      handleHELP(ctx, ['join'], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith('help', 'join');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('uses lowercase for command name', () => {
      handleHELP(ctx, ['JOIN'], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith('help', 'join');
    });

    it('adds multiple notice messages when no command specified', () => {
      handleHELP(ctx, [], '#channel');
      expect(ctx.addMessage).toHaveBeenCalledTimes(3);
      expect(ctx.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleRAW', () => {
    it('sends raw command', () => {
      handleRAW(ctx, ['PRIVMSG', '#channel', ':hello'], '#test');
      expect(ctx.sendRaw).toHaveBeenCalledWith('PRIVMSG #channel :hello');
    });

    it('adds error when no args', () => {
      handleRAW(ctx, [], '#channel');
      expect(ctx.sendRaw).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleDNS', () => {
    it('emits dns-lookup event and adds notice', () => {
      handleDNS(ctx, ['irc.freenode.net'], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith('dns-lookup', 'irc.freenode.net');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('adds error when no args', () => {
      handleDNS(ctx, [], '#channel');
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleTIMER', () => {
    it('emits timer event with valid args', () => {
      handleTIMER(
        ctx,
        ['mytimer', '5000', '1', 'PRIVMSG #test :hello'],
        '#channel',
      );
      expect(ctx.emit).toHaveBeenCalledWith(
        'timer',
        expect.objectContaining({
          name: 'mytimer',
          delay: 5000,
          repetitions: 1,
        }),
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('adds error when delay is zero', () => {
      handleTIMER(ctx, ['t', '0', '1', 'cmd'], '#channel');
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    it('adds error when delay is NaN', () => {
      handleTIMER(ctx, ['t', 'abc', '1', 'cmd'], '#channel');
      expect(ctx.emit).not.toHaveBeenCalled();
    });

    it('adds error when insufficient args', () => {
      handleTIMER(ctx, ['t', '5000', '1'], '#channel');
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    it('adds error when no args', () => {
      handleTIMER(ctx, [], '#channel');
      expect(ctx.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleWINDOW', () => {
    it('emits window-activate when -a flag used with name', () => {
      handleWINDOW(ctx, ['-a', '#channel'], '#other');
      expect(ctx.emit).toHaveBeenCalledWith('window-activate', '#channel');
    });

    it('adds error when -a used without name', () => {
      handleWINDOW(ctx, ['-a'], '#other');
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    it('emits window-open for regular window name', () => {
      handleWINDOW(ctx, ['#general'], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith('window-open', '#general');
    });

    it('adds error when no args', () => {
      handleWINDOW(ctx, [], '#channel');
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleFILTER', () => {
    it('emits filter event with text', () => {
      handleFILTER(ctx, ['spam'], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith(
        'filter',
        expect.objectContaining({ text: 'spam', global: false }),
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('sets global flag with -g option', () => {
      handleFILTER(ctx, ['-g', 'spam'], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith(
        'filter',
        expect.objectContaining({ text: 'spam', global: true }),
      );
    });

    it('adds error when -g is used without text', () => {
      handleFILTER(ctx, ['-g'], '#channel');
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    it('adds error when no args', () => {
      handleFILTER(ctx, [], '#channel');
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleCLONES', () => {
    it('calls detectClones on channel target', async () => {
      handleCLONES(ctx, [], '#channel');
      await Promise.resolve();
      expect(ctx.detectClones).toHaveBeenCalledWith('#channel');
    });

    it('uses provided channel arg over current target', async () => {
      handleCLONES(ctx, ['#other'], '#channel');
      await Promise.resolve();
      expect(ctx.detectClones).toHaveBeenCalledWith('#other');
    });

    it('adds notice when no clones found', async () => {
      ctx.detectClones = jest.fn().mockResolvedValue(new Map());
      handleCLONES(ctx, [], '#channel');
      await Promise.resolve();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('adds clones report when clones found', async () => {
      const clones = new Map([['shared.host', ['nick1', 'nick2']]]);
      ctx.detectClones = jest.fn().mockResolvedValue(clones);
      handleCLONES(ctx, [], '#channel');
      await new Promise(resolve => setTimeout(resolve, 10));
      // 1 header message + 1 message per clone host entry
      expect(ctx.addMessage).toHaveBeenCalledTimes(2);
    });

    it('adds error when not in channel and no channel arg', () => {
      handleCLONES(ctx, [], 'somenick');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
      expect(ctx.detectClones).not.toHaveBeenCalled();
    });

    it('adds error on detectClones failure', async () => {
      ctx.detectClones = jest
        .fn()
        .mockRejectedValue(new Error('network error'));
      handleCLONES(ctx, [], '#channel');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleIGNORE', () => {
    it('calls ignoreUser and adds notice on success', async () => {
      handleIGNORE(ctx, ['badnick'], '#channel');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockIgnoreUser).toHaveBeenCalledWith(
        'badnick',
        undefined,
        'TestNet',
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('passes reason when provided', async () => {
      handleIGNORE(ctx, ['badnick', 'Spammer'], '#channel');
      await Promise.resolve();
      expect(mockIgnoreUser).toHaveBeenCalledWith(
        'badnick',
        'Spammer',
        'TestNet',
      );
    });

    it('adds error message on failure', async () => {
      mockIgnoreUser.mockRejectedValue(new Error('Storage failed'));
      handleIGNORE(ctx, ['badnick'], '#channel');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    it('adds error when no args', () => {
      handleIGNORE(ctx, [], '#channel');
      expect(mockIgnoreUser).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleUNIGNORE', () => {
    it('calls unignoreUser and adds notice on success', async () => {
      handleUNIGNORE(ctx, ['badnick'], '#channel');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockUnignoreUser).toHaveBeenCalledWith('badnick', 'TestNet');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('adds error message on failure', async () => {
      mockUnignoreUser.mockRejectedValue(new Error('not found'));
      handleUNIGNORE(ctx, ['badnick'], '#channel');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    it('adds error when no args', () => {
      handleUNIGNORE(ctx, [], '#channel');
      expect(mockUnignoreUser).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });
});
