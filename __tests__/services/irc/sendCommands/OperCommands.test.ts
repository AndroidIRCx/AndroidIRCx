/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleOPER,
  handleREHASH,
  handleSQUIT,
  handleKILL,
  handleCONNECT,
  handleDIE,
  handleWALLOPS,
  handleLOCOPS,
  handleGLOBOPS,
  handleADCHAT,
  operCommands,
} from '../../../../src/services/irc/sendCommands/OperCommands';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('OperCommands', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      sendCommand: jest.fn(),
      addMessage: jest.fn(),
    };
  });

  describe('operCommands map', () => {
    it('registers all operator commands', () => {
      [
        'OPER',
        'REHASH',
        'SQUIT',
        'KILL',
        'CONNECT',
        'DIE',
        'WALLOPS',
        'LOCOPS',
        'GLOBOPS',
        'ADCHAT',
      ].forEach(cmd => {
        expect(operCommands.has(cmd)).toBe(true);
      });
    });
  });

  describe('handleOPER', () => {
    it('sends OPER command with nick and password', () => {
      handleOPER(ctx, ['myoper', 'secret123'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('OPER myoper secret123');
    });

    it('adds notice message after oper attempt', () => {
      handleOPER(ctx, ['myoper', 'secret123'], '#channel');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('adds error when insufficient args', () => {
      handleOPER(ctx, ['onlynick'], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    it('adds error when no args', () => {
      handleOPER(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleREHASH', () => {
    it('sends REHASH command', () => {
      handleREHASH(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('REHASH');
    });

    it('adds notice message', () => {
      handleREHASH(ctx, [], '#channel');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });
  });

  describe('handleSQUIT', () => {
    it('sends SQUIT with server only', () => {
      handleSQUIT(ctx, ['irc.server.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('SQUIT irc.server.net');
    });

    it('sends SQUIT with server and message', () => {
      handleSQUIT(ctx, ['irc.server.net', 'Maintenance', 'now'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith(
        'SQUIT irc.server.net :Maintenance now',
      );
    });

    it('adds notice after SQUIT', () => {
      handleSQUIT(ctx, ['irc.server.net'], '#channel');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('adds error when no args', () => {
      handleSQUIT(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleKILL', () => {
    it('sends KILL with nick and reason', () => {
      handleKILL(ctx, ['baduser', 'Spamming', 'channels'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith(
        'KILL baduser :Spamming channels',
      );
    });

    it('adds notice after KILL', () => {
      handleKILL(ctx, ['baduser', 'reason'], '#channel');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('adds error when missing reason', () => {
      handleKILL(ctx, ['baduser'], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    it('adds error when no args', () => {
      handleKILL(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
    });
  });

  describe('handleCONNECT', () => {
    it('sends CONNECT with server and port', () => {
      handleCONNECT(ctx, ['irc.other.net', '6667'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith(
        'CONNECT irc.other.net 6667',
      );
    });

    it('sends CONNECT with server, port and remote', () => {
      handleCONNECT(ctx, ['irc.other.net', '6667', 'irc.hub.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith(
        'CONNECT irc.other.net 6667 irc.hub.net',
      );
    });

    it('adds notice after CONNECT', () => {
      handleCONNECT(ctx, ['irc.other.net', '6667'], '#channel');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('adds error when insufficient args', () => {
      handleCONNECT(ctx, ['irc.other.net'], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    it('adds error when no args', () => {
      handleCONNECT(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
    });
  });

  describe('handleDIE', () => {
    it('sends DIE command', () => {
      handleDIE(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('DIE');
    });

    it('adds notice message', () => {
      handleDIE(ctx, [], '#channel');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });
  });

  describe('handleWALLOPS', () => {
    it('sends WALLOPS with message', () => {
      handleWALLOPS(ctx, ['Hello', 'all', 'operators'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith(
        'WALLOPS :Hello all operators',
      );
    });

    it('adds error when no message', () => {
      handleWALLOPS(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleLOCOPS', () => {
    it('sends LOCOPS with message', () => {
      handleLOCOPS(ctx, ['Local', 'ops', 'message'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('LOCOPS :Local ops message');
    });

    it('adds error when no message', () => {
      handleLOCOPS(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleGLOBOPS', () => {
    it('sends GLOBOPS with message', () => {
      handleGLOBOPS(ctx, ['Global', 'ops', 'message'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith(
        'GLOBOPS :Global ops message',
      );
    });

    it('adds error when no message', () => {
      handleGLOBOPS(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleADCHAT', () => {
    it('sends ADCHAT with message', () => {
      handleADCHAT(ctx, ['Admin', 'chat', 'message'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith(
        'ADCHAT :Admin chat message',
      );
    });

    it('adds error when no message', () => {
      handleADCHAT(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });
});
