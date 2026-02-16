/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  statusCommands,
  handleAWAY,
  handleBACK,
  handleRECONNECT,
  handleDISCONNECT,
  handleSERVER,
} from '../../../../src/services/irc/sendCommands/StatusCommands';
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

describe('StatusCommands', () => {
  const createMockContext = (): Partial<SendMessageHandlerContext> => ({
    sendRaw: jest.fn(),
    sendCommand: jest.fn(),
    addMessage: jest.fn(),
    getCurrentNick: jest.fn().mockReturnValue('TestUser'),
    getNetworkName: jest.fn().mockReturnValue('freenode'),
    emit: jest.fn(),
    parseServerCommand: jest.fn().mockReturnValue({}),
  });

  let ctx: SendMessageHandlerContext;

  beforeEach(() => {
    ctx = createMockContext() as SendMessageHandlerContext;
    jest.clearAllMocks();
  });

  describe('statusCommands Map', () => {
    it('should have all handlers registered', () => {
      expect(statusCommands.has('AWAY')).toBe(true);
      expect(statusCommands.has('BACK')).toBe(true);
      expect(statusCommands.has('RECONNECT')).toBe(true);
      expect(statusCommands.has('DISCONNECT')).toBe(true);
      expect(statusCommands.has('SERVER')).toBe(true);
    });
  });

  describe('handleAWAY', () => {
    it('should send AWAY with message', () => {
      handleAWAY(ctx, ['Gone', 'fishing'], '');

      expect(ctx.sendRaw).toHaveBeenCalledWith('AWAY :Gone fishing');
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'notice' }));
    });

    it('should send AWAY without message to remove away status', () => {
      handleAWAY(ctx, [], '');

      expect(ctx.sendRaw).toHaveBeenCalledWith('AWAY');
      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'notice' }));
    });
  });

  describe('handleBACK', () => {
    it('should send AWAY to remove away status', () => {
      handleBACK(ctx, [], '');

      expect(ctx.sendRaw).toHaveBeenCalledWith('AWAY');
    });
  });

  describe('handleRECONNECT', () => {
    it('should emit reconnect event', () => {
      handleRECONNECT(ctx, [], '');

      expect(ctx.emit).toHaveBeenCalledWith('reconnect', 'freenode');
    });
  });

  describe('handleDISCONNECT', () => {
    it('should emit intentional-quit event', async () => {
      await handleDISCONNECT(ctx, ['Bye'], '');

      expect(ctx.emit).toHaveBeenCalledWith('intentional-quit', 'freenode');
    });

    it('should send QUIT with user-provided message', async () => {
      await handleDISCONNECT(ctx, ['Bye', 'everyone'], '');

      expect(ctx.sendRaw).toHaveBeenCalledWith('QUIT :Bye everyone');
      expect(settingsService.getSetting).not.toHaveBeenCalled();
    });

    it('should read quit message from settings when no args provided', async () => {
      (settingsService.getSetting as jest.Mock).mockResolvedValueOnce('My custom quit');

      await handleDISCONNECT(ctx, [], '');

      expect(settingsService.getSetting).toHaveBeenCalledWith('quitMessage', expect.any(String));
      expect(ctx.sendRaw).toHaveBeenCalledWith('QUIT :My custom quit');
    });

    it('should use default quit message when settings returns default', async () => {
      await handleDISCONNECT(ctx, [], '');

      expect(ctx.sendRaw).toHaveBeenCalledWith(expect.stringContaining('QUIT :'));
    });
  });

  describe('handleSERVER', () => {
    it('should parse and emit server command', () => {
      handleSERVER(ctx, ['irc.example.com', '6667'], '');

      expect(ctx.parseServerCommand).toHaveBeenCalledWith(['irc.example.com', '6667']);
      expect(ctx.emit).toHaveBeenCalledWith('server-command', expect.anything());
    });

    it('should show error on invalid syntax', () => {
      (ctx.parseServerCommand as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid syntax');
      });

      handleSERVER(ctx, ['bad'], '');

      expect(ctx.addMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
  });
});
