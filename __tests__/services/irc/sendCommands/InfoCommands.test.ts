/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleLUSERS,
  handleVERSION,
  handleTIME,
  handleADMIN,
  handleLINKS,
  handleSTATS,
  handleMOTD,
  handlePING,
  handleTRACE,
  handleINFO,
  handleRULES,
  handleSERVLIST,
  handleISON,
  handleUSERHOST,
  handleUSERIP,
  handleUSERS,
  handleWATCH,
  handleKNOCK,
  handleSQUERY,
  handleLIST,
  handleNAMES,
  infoCommands,
} from '../../../../src/services/irc/sendCommands/InfoCommands';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('InfoCommands', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      sendCommand: jest.fn(),
      sendRaw: jest.fn(),
      addMessage: jest.fn(),
      getCurrentNick: jest.fn().mockReturnValue('MyNick'),
    };
  });

  describe('infoCommands map', () => {
    it('registers all info commands', () => {
      [
        'LUSERS',
        'VERSION',
        'TIME',
        'ADMIN',
        'LINKS',
        'STATS',
        'MOTD',
        'PING',
        'TRACE',
        'INFO',
        'RULES',
        'SERVLIST',
        'ISON',
        'USERHOST',
        'USERIP',
        'USERS',
        'WATCH',
        'KNOCK',
        'SQUERY',
        'LIST',
        'NAMES',
      ].forEach(cmd => {
        expect(infoCommands.has(cmd)).toBe(true);
      });
    });
  });

  describe('handleLUSERS', () => {
    it('sends LUSERS command', () => {
      handleLUSERS(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('LUSERS');
    });
  });

  describe('handleVERSION', () => {
    it('sends VERSION without target when no args', () => {
      handleVERSION(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('VERSION');
    });

    it('sends VERSION with target server', () => {
      handleVERSION(ctx, ['irc.server.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('VERSION irc.server.net');
    });
  });

  describe('handleTIME', () => {
    it('sends TIME without target', () => {
      handleTIME(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('TIME');
    });

    it('sends TIME with target', () => {
      handleTIME(ctx, ['irc.server.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('TIME irc.server.net');
    });
  });

  describe('handleADMIN', () => {
    it('sends ADMIN without target', () => {
      handleADMIN(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('ADMIN');
    });

    it('sends ADMIN with target', () => {
      handleADMIN(ctx, ['irc.server.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('ADMIN irc.server.net');
    });
  });

  describe('handleLINKS', () => {
    it('sends LINKS without mask', () => {
      handleLINKS(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('LINKS');
    });

    it('sends LINKS with mask', () => {
      handleLINKS(ctx, ['*.freenode.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('LINKS *.freenode.net');
    });
  });

  describe('handleSTATS', () => {
    it('sends STATS without query', () => {
      handleSTATS(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('STATS');
    });

    it('sends STATS with query only', () => {
      handleSTATS(ctx, ['u'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('STATS u');
    });

    it('sends STATS with query and server', () => {
      handleSTATS(ctx, ['u', 'irc.server.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('STATS u irc.server.net');
    });
  });

  describe('handleMOTD', () => {
    it('sends MOTD without target', () => {
      handleMOTD(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('MOTD');
    });

    it('sends MOTD with target', () => {
      handleMOTD(ctx, ['irc.server.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('MOTD irc.server.net');
    });
  });

  describe('handlePING', () => {
    it('sends PING without target', () => {
      handlePING(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('PING');
    });

    it('sends PING with target', () => {
      handlePING(ctx, ['irc.server.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('PING irc.server.net');
    });
  });

  describe('handleTRACE', () => {
    it('sends TRACE without target', () => {
      handleTRACE(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('TRACE');
    });

    it('sends TRACE with target', () => {
      handleTRACE(ctx, ['irc.server.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('TRACE irc.server.net');
    });
  });

  describe('handleINFO', () => {
    it('sends INFO without target', () => {
      handleINFO(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('INFO');
    });

    it('sends INFO with target', () => {
      handleINFO(ctx, ['irc.server.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('INFO irc.server.net');
    });
  });

  describe('handleRULES', () => {
    it('sends RULES without target', () => {
      handleRULES(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('RULES');
    });

    it('sends RULES with target', () => {
      handleRULES(ctx, ['irc.server.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('RULES irc.server.net');
    });
  });

  describe('handleSERVLIST', () => {
    it('sends SERVLIST without args', () => {
      handleSERVLIST(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('SERVLIST');
    });

    it('sends SERVLIST with mask', () => {
      handleSERVLIST(ctx, ['*.services'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('SERVLIST *.services');
    });

    it('sends SERVLIST with mask and type', () => {
      handleSERVLIST(ctx, ['*.services', '1'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('SERVLIST *.services 1');
    });
  });

  describe('handleISON', () => {
    it('sends ISON with nicks', () => {
      handleISON(ctx, ['nick1', 'nick2'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('ISON nick1 nick2');
    });

    it('adds error when no args', () => {
      handleISON(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleUSERHOST', () => {
    it('sends USERHOST with nicks', () => {
      handleUSERHOST(ctx, ['nick1', 'nick2'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('USERHOST nick1 nick2');
    });

    it('adds error when no args', () => {
      handleUSERHOST(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleUSERIP', () => {
    it('sends USERIP with nick', () => {
      handleUSERIP(ctx, ['somenick'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('USERIP somenick');
    });

    it('adds error when no args', () => {
      handleUSERIP(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleUSERS', () => {
    it('sends USERS without target', () => {
      handleUSERS(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('USERS');
    });

    it('sends USERS with target', () => {
      handleUSERS(ctx, ['irc.server.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('USERS irc.server.net');
    });
  });

  describe('handleWATCH', () => {
    it('sends WATCH with nick additions', () => {
      handleWATCH(ctx, ['+nick1', '-nick2'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('WATCH +nick1 -nick2');
    });

    it('adds error when no args', () => {
      handleWATCH(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleKNOCK', () => {
    it('sends KNOCK with channel only', () => {
      handleKNOCK(ctx, ['#secret'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('KNOCK #secret');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('sends KNOCK with channel and message', () => {
      handleKNOCK(ctx, ['#secret', 'Please', 'let', 'me', 'in'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith(
        'KNOCK #secret :Please let me in',
      );
    });

    it('adds error when no args', () => {
      handleKNOCK(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('handleSQUERY', () => {
    it('sends PRIVMSG to service and adds sent message', () => {
      handleSQUERY(ctx, ['NickServ', 'IDENTIFY', 'password'], '#channel');
      expect(ctx.sendRaw).toHaveBeenCalledWith(
        'PRIVMSG NickServ :IDENTIFY password',
      );
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice', channel: 'NickServ' }),
      );
    });

    it('adds error when insufficient args', () => {
      handleSQUERY(ctx, ['NickServ'], '#channel');
      expect(ctx.sendRaw).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    it('adds error when no args', () => {
      handleSQUERY(ctx, [], '#channel');
      expect(ctx.sendRaw).not.toHaveBeenCalled();
    });
  });

  describe('handleLIST', () => {
    it('sends LIST without args', () => {
      handleLIST(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('LIST');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' }),
      );
    });

    it('sends LIST with args', () => {
      handleLIST(ctx, ['>100'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('LIST >100');
    });
  });

  describe('handleNAMES', () => {
    it('sends NAMES with channel arg', () => {
      handleNAMES(ctx, ['#general'], '#other');
      expect(ctx.sendCommand).toHaveBeenCalledWith('NAMES #general');
    });

    it('uses current channel target when no args and in channel', () => {
      handleNAMES(ctx, [], '#current');
      expect(ctx.sendCommand).toHaveBeenCalledWith('NAMES #current');
    });

    it('adds error when no channel available', () => {
      handleNAMES(ctx, [], 'somenick');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' }),
      );
    });

    it('uses & channel prefix too', () => {
      handleNAMES(ctx, [], '&local');
      expect(ctx.sendCommand).toHaveBeenCalledWith('NAMES &local');
    });
  });
});
