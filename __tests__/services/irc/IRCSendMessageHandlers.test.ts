/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCSendMessageHandlers } from '../../../src/services/irc/IRCSendMessageHandlers';

jest.mock('../../../src/i18n/transifex', () => ({
  tx: {
    t: (key: string, params?: Record<string, unknown>) => {
      let result = key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          result = result.replace(`{${name}}`, String(value));
        }
      }
      return result;
    },
  },
}));

jest.mock('../../../src/stores/uiStore', () => ({
  useUIStore: {
    getState: jest.fn(() => ({
      setShowWHOIS: jest.fn(),
      setWhoisNick: jest.fn(),
      whoisDisplayMode: 'active',
    })),
  },
}));

describe('IRCSendMessageHandlers', () => {
  let service: any;
  let handlers: IRCSendMessageHandlers;

  beforeEach(() => {
    service = {
      addMessage: jest.fn(),
      capEnabledSet: new Set<string>(),
      currentNick: 'MyNick',
      detectClones: jest.fn(),
      emit: jest.fn(),
      encodeCTCP: jest.fn((command: string, args?: string) => `\u0001${command}${args ? ` ${args}` : ''}\u0001`),
      getNetworkName: jest.fn(() => 'TestNet'),
      getUserManagementService: jest.fn(() => ({})),
      getWhoisUseDoubleNick: jest.fn(() => true),
      joinChannel: jest.fn(),
      lastWhowasAt: 0,
      lastWhowasTarget: null,
      parseServerCommand: jest.fn(),
      partChannel: jest.fn(),
      sendCommand: jest.fn(),
      sendRaw: jest.fn(),
      setRealname: jest.fn(),
      toggleBotMode: jest.fn(),
    };

    handlers = new IRCSendMessageHandlers(service);
  });

  it('dispatches registered commands case-insensitively', () => {
    const result = handlers.handle('join', ['#chat', 'secret'], '');

    expect(result).toBe(true);
    expect(service.joinChannel).toHaveBeenCalledWith('#chat', 'secret');
  });

  it('returns false for unknown commands', () => {
    expect(handlers.handle('UNKNOWNXYZ', ['arg'], '#chat')).toBe(false);
  });

  it('intercepts WHOWAS state updates instead of emitting them', () => {
    jest.spyOn(Date, 'now').mockReturnValue(123456);

    const result = handlers.handle('WHOWAS', ['Nick[away]'], '#chat');

    expect(result).toBe(true);
    expect(service.lastWhowasTarget).toBe('Nick[away]');
    expect(service.lastWhowasAt).toBe(123456);
    expect(service.emit).not.toHaveBeenCalledWith('set-whowas-target', expect.anything(), expect.anything());
    expect(service.sendCommand).toHaveBeenCalledWith('WHOWAS :Nick[away]');
  });

  it('forwards normal events from handlers to the service emitter', () => {
    const result = handlers.handle('AMSG', ['hello', 'all'], '#chat');

    expect(result).toBe(true);
    expect(service.emit).toHaveBeenCalledWith('amsg', 'hello all', 'TestNet');
    expect(service.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'notice', text: '*** Sending message to all channels...' })
    );
  });

  it('uses double-nick WHOIS when configured', () => {
    const result = handlers.handle('WHOIS', ['Alice'], '#chat');

    expect(result).toBe(true);
    expect(service.sendCommand).toHaveBeenCalledWith('WHOIS Alice Alice');
  });
});
