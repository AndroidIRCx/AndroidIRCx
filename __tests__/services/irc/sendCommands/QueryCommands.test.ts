/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleWHOIS,
  handleWHOWAS,
  handleWHO,
  queryCommands,
} from '../../../../src/services/irc/sendCommands/QueryCommands';

const mockSetWhoisNick = jest.fn();
const mockSetShowWHOIS = jest.fn();
const mockGetState = jest.fn().mockReturnValue({
  whoisDisplayMode: 'inline',
  setWhoisNick: mockSetWhoisNick,
  setShowWHOIS: mockSetShowWHOIS,
});

jest.mock('../../../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: () => mockGetState(),
  },
}));

describe('QueryCommands', () => {
  let ctx: any;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      sendCommand: jest.fn(),
      addMessage: jest.fn(),
      emit: jest.fn(),
      getWhoisUseDoubleNick: jest.fn().mockReturnValue(false),
    };
    mockGetState.mockReturnValue({
      whoisDisplayMode: 'inline',
      setWhoisNick: mockSetWhoisNick,
      setShowWHOIS: mockSetShowWHOIS,
    });
  });

  describe('queryCommands map', () => {
    it('registers WHOIS', () => {
      expect(queryCommands.has('WHOIS')).toBe(true);
    });

    it('registers WHOWAS', () => {
      expect(queryCommands.has('WHOWAS')).toBe(true);
    });

    it('registers WHO', () => {
      expect(queryCommands.has('WHO')).toBe(true);
    });
  });

  describe('handleWHOIS', () => {
    it('sends WHOIS with single nick', () => {
      handleWHOIS(ctx, ['somenick'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('WHOIS somenick');
    });

    it('sends double WHOIS when getWhoisUseDoubleNick returns true and single nick', () => {
      ctx.getWhoisUseDoubleNick = jest.fn().mockReturnValue(true);
      handleWHOIS(ctx, ['somenick'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('WHOIS somenick somenick');
    });

    it('does not double nick when multiple nicks provided', () => {
      ctx.getWhoisUseDoubleNick = jest.fn().mockReturnValue(true);
      handleWHOIS(ctx, ['nick1', 'nick2'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('WHOIS nick1 nick2');
    });

    it('opens modal when whoisDisplayMode is modal', () => {
      mockGetState.mockReturnValue({
        whoisDisplayMode: 'modal',
        setWhoisNick: mockSetWhoisNick,
        setShowWHOIS: mockSetShowWHOIS,
      });
      handleWHOIS(ctx, ['somenick'], '#channel');
      expect(mockSetWhoisNick).toHaveBeenCalledWith('somenick');
      expect(mockSetShowWHOIS).toHaveBeenCalledWith(true);
    });

    it('does not open modal when whoisDisplayMode is inline', () => {
      handleWHOIS(ctx, ['somenick'], '#channel');
      expect(mockSetShowWHOIS).not.toHaveBeenCalled();
    });

    it('does nothing when no args', () => {
      handleWHOIS(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
    });
  });

  describe('handleWHOWAS', () => {
    it('emits set-whowas-target event', () => {
      handleWHOWAS(ctx, ['oldnick'], '#channel');
      expect(ctx.emit).toHaveBeenCalledWith(
        'set-whowas-target',
        'oldnick',
        expect.any(Number),
      );
    });

    it('sends WHOWAS with nick', () => {
      handleWHOWAS(ctx, ['oldnick'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('WHOWAS oldnick');
    });

    it('sends WHOWAS with colon for nicks containing brackets', () => {
      handleWHOWAS(ctx, ['nick[away]'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('WHOWAS :nick[away]');
    });

    it('sends WHOWAS with multiple args joined', () => {
      handleWHOWAS(ctx, ['nick1', '5'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('WHOWAS nick1 5');
    });

    it('does nothing when no args', () => {
      handleWHOWAS(ctx, [], '#channel');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleWHO', () => {
    it('sends WHO without mask', () => {
      handleWHO(ctx, [], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('WHO');
    });

    it('sends WHO with mask', () => {
      handleWHO(ctx, ['*.freenode.net'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('WHO *.freenode.net');
    });

    it('sends WHO with multiple args', () => {
      handleWHO(ctx, ['#general', '%nuhars,1'], '#channel');
      expect(ctx.sendCommand).toHaveBeenCalledWith('WHO #general %nuhars,1');
    });
  });
});
