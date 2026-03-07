/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleMSG,
  handleME,
  handleNOTICE,
  handleAMSG,
  handleAME,
  handleANOTICE,
  messageCommands,
} from '../../../../src/services/irc/sendCommands/MessageCommands';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('MessageCommands', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      sendRaw: jest.fn(),
      addMessage: jest.fn(),
      emit: jest.fn(),
      getCurrentNick: jest.fn().mockReturnValue('MyNick'),
      getNetworkName: jest.fn().mockReturnValue('TestNet'),
      encodeCTCP: jest.fn((cmd: string, text: string) => `\x01${cmd} ${text}\x01`),
    };
  });

  describe('messageCommands map', () => {
    it('registers MSG', () => {
      expect(messageCommands.has('MSG')).toBe(true);
    });

    it('maps QUERY to same handler as MSG', () => {
      expect(messageCommands.get('QUERY')).toBe(messageCommands.get('MSG'));
    });

    it('maps ACTION to same handler as ME', () => {
      expect(messageCommands.get('ACTION')).toBe(messageCommands.get('ME'));
    });

    it('registers NOTICE, AMSG, AME, ANOTICE', () => {
      ['NOTICE', 'AMSG', 'AME', 'ANOTICE'].forEach(cmd => {
        expect(messageCommands.has(cmd)).toBe(true);
      });
    });
  });

  describe('handleMSG', () => {
    it('sends PRIVMSG raw and adds sent message', () => {
      handleMSG(ctx, ['#channel', 'Hello', 'world'], '#other');
      expect(ctx.sendRaw).toHaveBeenCalledWith('PRIVMSG #channel :Hello world');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message',
          channel: '#channel',
          from: 'MyNick',
          text: 'Hello world',
          status: 'sent',
        })
      );
    });

    it('adds error when insufficient args', () => {
      handleMSG(ctx, ['#channel'], '#other');
      expect(ctx.sendRaw).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });

    it('adds error when no args', () => {
      handleMSG(ctx, [], '#other');
      expect(ctx.sendRaw).not.toHaveBeenCalled();
    });
  });

  describe('handleME', () => {
    it('sends ACTION CTCP and adds sent message', () => {
      handleME(ctx, ['is', 'dancing'], '#channel');
      expect(ctx.sendRaw).toHaveBeenCalledWith('PRIVMSG #channel :\x01ACTION is dancing\x01');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'message',
          channel: '#channel',
          from: 'MyNick',
        })
      );
    });

    it('does nothing when no args', () => {
      handleME(ctx, [], '#channel');
      expect(ctx.sendRaw).not.toHaveBeenCalled();
      expect(ctx.addMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleNOTICE', () => {
    it('sends NOTICE and adds sent message', () => {
      handleNOTICE(ctx, ['#channel', 'Server', 'going', 'down'], '#other');
      expect(ctx.sendRaw).toHaveBeenCalledWith('NOTICE #channel :Server going down');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notice',
          channel: '#channel',
          from: 'MyNick',
          text: 'Server going down',
          status: 'sent',
        })
      );
    });

    it('adds error when insufficient args', () => {
      handleNOTICE(ctx, ['#channel'], '#other');
      expect(ctx.sendRaw).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });

    it('adds error when no args', () => {
      handleNOTICE(ctx, [], '#other');
      expect(ctx.sendRaw).not.toHaveBeenCalled();
    });
  });

  describe('handleAMSG', () => {
    it('emits amsg event and adds notice', () => {
      handleAMSG(ctx, ['Hello', 'everyone'], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith('amsg', 'Hello everyone', 'TestNet');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' })
      );
    });

    it('adds error when no args', () => {
      handleAMSG(ctx, [], '#channel');
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });

  describe('handleAME', () => {
    it('emits ame event and adds notice', () => {
      handleAME(ctx, ['waves', 'hello'], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith('ame', 'waves hello', 'TestNet');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' })
      );
    });

    it('adds error when no args', () => {
      handleAME(ctx, [], '#channel');
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });

  describe('handleANOTICE', () => {
    it('emits anotice event and adds notice', () => {
      handleANOTICE(ctx, ['Server', 'restart', 'soon'], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith('anotice', 'Server restart soon', 'TestNet');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' })
      );
    });

    it('adds error when no args', () => {
      handleANOTICE(ctx, [], '#channel');
      expect(ctx.emit).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });
});
