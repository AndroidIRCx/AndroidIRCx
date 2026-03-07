/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handleBAN,
  handleUNBAN,
  handleKICKBAN,
  handleINVITE,
  channelOpsCommands,
} from '../../../../src/services/irc/sendCommands/ChannelOpsCommands';

jest.mock('../../../../src/i18n/transifex', () => ({
  tx: { t: (key: string) => key },
}));

describe('ChannelOpsCommands', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      sendCommand: jest.fn(),
      addMessage: jest.fn(),
    };
  });

  describe('channelOpsCommands map', () => {
    it('registers BAN', () => {
      expect(channelOpsCommands.has('BAN')).toBe(true);
    });

    it('registers UNBAN', () => {
      expect(channelOpsCommands.has('UNBAN')).toBe(true);
    });

    it('registers KICKBAN', () => {
      expect(channelOpsCommands.has('KICKBAN')).toBe(true);
    });

    it('registers INVITE', () => {
      expect(channelOpsCommands.has('INVITE')).toBe(true);
    });
  });

  describe('handleBAN', () => {
    it('bans nick using current channel target', () => {
      handleBAN(ctx, ['badnick'], '#general');
      expect(ctx.sendCommand).toHaveBeenCalledWith('MODE #general +b badnick!*@*');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' })
      );
    });

    it('bans nick with explicit channel arg', () => {
      handleBAN(ctx, ['badnick', '#specific'], 'somenick');
      expect(ctx.sendCommand).toHaveBeenCalledWith('MODE #specific +b badnick!*@*');
    });

    it('adds error when in query with no channel', () => {
      handleBAN(ctx, ['badnick'], 'somenick');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });

    it('adds error when no args', () => {
      handleBAN(ctx, [], '#general');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });

    it('supports & channel prefix', () => {
      handleBAN(ctx, ['badnick'], '&local');
      expect(ctx.sendCommand).toHaveBeenCalledWith('MODE &local +b badnick!*@*');
    });
  });

  describe('handleUNBAN', () => {
    it('unbans mask from current channel', () => {
      handleUNBAN(ctx, ['badnick!*@*'], '#general');
      expect(ctx.sendCommand).toHaveBeenCalledWith('MODE #general -b badnick!*@*');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' })
      );
    });

    it('unbans mask from explicit channel', () => {
      handleUNBAN(ctx, ['badnick!*@*', '#specific'], 'somenick');
      expect(ctx.sendCommand).toHaveBeenCalledWith('MODE #specific -b badnick!*@*');
    });

    it('adds error when in query with no channel', () => {
      handleUNBAN(ctx, ['badnick!*@*'], 'somenick');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });

    it('adds error when no args', () => {
      handleUNBAN(ctx, [], '#general');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
    });
  });

  describe('handleKICKBAN', () => {
    it('kicks and bans from current channel without reason', () => {
      handleKICKBAN(ctx, ['badnick'], '#general');
      expect(ctx.sendCommand).toHaveBeenCalledWith('MODE #general +b badnick!*@*');
      expect(ctx.sendCommand).toHaveBeenCalledWith('KICK #general badnick');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' })
      );
    });

    it('kicks and bans from explicit channel', () => {
      handleKICKBAN(ctx, ['badnick', '#specific'], 'somenick');
      expect(ctx.sendCommand).toHaveBeenCalledWith('MODE #specific +b badnick!*@*');
      expect(ctx.sendCommand).toHaveBeenCalledWith('KICK #specific badnick');
    });

    it('kicks and bans with reason', () => {
      handleKICKBAN(ctx, ['badnick', '#general', 'Flooding'], '#general');
      expect(ctx.sendCommand).toHaveBeenCalledWith('MODE #general +b badnick!*@*');
      expect(ctx.sendCommand).toHaveBeenCalledWith('KICK #general badnick :Flooding');
    });

    it('adds error when no args', () => {
      handleKICKBAN(ctx, [], '#general');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });

    it('adds error when no valid channel', () => {
      handleKICKBAN(ctx, ['badnick'], 'somenick');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });

  describe('handleINVITE', () => {
    it('invites nick to current channel', () => {
      handleINVITE(ctx, ['friendnick'], '#general');
      expect(ctx.sendCommand).toHaveBeenCalledWith('INVITE friendnick #general');
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'notice' })
      );
    });

    it('invites nick to explicit channel', () => {
      handleINVITE(ctx, ['friendnick', '#specific'], 'somenick');
      expect(ctx.sendCommand).toHaveBeenCalledWith('INVITE friendnick #specific');
    });

    it('adds error when in query with no channel', () => {
      handleINVITE(ctx, ['friendnick'], 'somenick');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });

    it('adds error when no args', () => {
      handleINVITE(ctx, [], '#general');
      expect(ctx.sendCommand).not.toHaveBeenCalled();
      expect(ctx.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });
});
