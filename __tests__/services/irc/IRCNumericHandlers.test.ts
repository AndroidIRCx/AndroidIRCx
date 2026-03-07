/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCNumericHandlers } from '../../../src/services/irc/IRCNumericHandlers';

describe('IRCNumericHandlers', () => {
  const buildService = () => ({
    registered: false,
    currentNick: 'alice',
    isServerOper: false,
    addMessage: jest.fn(),
    addRawMessage: jest.fn(),
    emit: jest.fn(),
    sendCommand: jest.fn(),
    sendRaw: jest.fn(),
    logRaw: jest.fn(),
    getNetworkName: jest.fn().mockReturnValue('Net'),
    hasCapability: jest.fn().mockReturnValue(true),
    channelUsers: new Map([
      ['#chan', new Map([['alice', { nick: 'alice' }]])],
    ]),
    emitUserListChange: jest.fn(),
    parseUserWithPrefixes: jest.fn().mockReturnValue({ nick: 'bob' }),
    requestChatHistory: jest.fn(),
    maybeEmitChannelIntro: jest.fn(),
    channelTopics: new Map([['#chan', { topic: 'hello' }]]),
    whoisTarget: null,
    whoisData: new Map(),
    lastWhowasTarget: null,
    lastWhowasAt: 0,
    silentModeNicks: new Set(['silent']),
    silentWhoNicks: new Set(['who']),
    silentWhoCallbacks: new Map([['who', jest.fn()]]),
    channelListBuffer: [],
    linksBuffer: [],
    statsBuffer: [],
    banListBuffer: new Map(),
    inviteListBuffer: new Map(),
    exceptListBuffer: new Map(),
    namesBuffer: new Map(),
    saslMechanism: null,
    saslState: 'idle',
    monitoredNicks: new Set(['watch']),
    saslAuthenticating: false,
    endCAPNegotiation: jest.fn(),
    altNick: 'alice_',
    nickChangeAttempts: 1,
    disconnect: jest.fn(),
    config: { a: 1 },
    getUserManagementService: jest.fn().mockReturnValue({ ok: true }),
    updateSelfUserModes: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bridges context methods and handles known/unknown numerics', () => {
    const service = buildService();
    const handlers = new IRCNumericHandlers(service as any);
    const ctx = (handlers as any).ctx;

    const adHocHandler = jest.fn();
    (handlers as any).handlers.set(4242, adHocHandler);
    expect(handlers.hasHandler(4242)).toBe(true);
    expect(handlers.handle(4242, 'srv', ['p1'], 123)).toBe(true);
    expect(handlers.handle(7777, 'srv', [], 0)).toBe(false);
    expect(adHocHandler).toHaveBeenCalled();

    expect(ctx.getCurrentNick()).toBe('alice');
    expect(ctx.getNetworkName()).toBe('Net');
    expect(ctx.isServerOper()).toBe(false);

    ctx.setRegistered(true);
    ctx.setCurrentNick('carol');
    ctx.setServerOper(true);
    ctx.updateSelfUserModes('+i');
    expect(service.registered).toBe(true);
    expect(service.currentNick).toBe('carol');
    expect(service.isServerOper).toBe(true);
    expect(service.updateSelfUserModes).toHaveBeenCalledWith('+i');

    ctx.addMessage({ text: 'x' });
    ctx.addRawMessage('raw', 'sys');
    ctx.emit('event', 1, 2);
    ctx.sendCommand('WHO');
    ctx.sendRaw('PING');
    ctx.logRaw('line');
    expect(service.addMessage).toHaveBeenCalled();
    expect(service.addRawMessage).toHaveBeenCalled();
    expect(service.emit).toHaveBeenCalledWith('event', 1, 2);
    expect(service.sendCommand).toHaveBeenCalledWith('WHO');
    expect(service.sendRaw).toHaveBeenCalledWith('PING');
    expect(service.logRaw).toHaveBeenCalledWith('line');

    expect(ctx.getChannelUsers('#chan')).toBeDefined();
    ctx.setChannelUsers('#new', new Map([['n', {}]]));
    ctx.emitUserListChange('#new', []);
    ctx.parseUserWithPrefixes('@bob');
    ctx.requestChatHistory('#chan', 10, 'before');
    expect(ctx.getChannelTopicInfo('#chan')).toEqual({ topic: 'hello' });
    expect(ctx.getChannelTopicInfo('#missing')).toEqual({});
    ctx.setChannelTopicInfo('#x', { topic: 'x' });
    ctx.maybeEmitChannelIntro('#x', 5);
    ctx.removeUserFromChannel('#chan', 'alice');
    expect(service.channelUsers.get('#chan')?.has('alice')).toBe(false);

    expect(ctx.getWhoisTarget()).toBeNull();
    ctx.setWhoisTarget('nick');
    expect(ctx.getWhoisData()).toBe(service.whoisData);
    expect(ctx.getWhoisTarget()).toBe('nick');
    expect(ctx.getWhowasTarget()).toBeNull();
    ctx.setWhowasTarget('old');
    ctx.setWhowasAt(42);
    expect(ctx.getWhowasTarget()).toBe('old');
    expect(ctx.getWhowasAt()).toBe(42);

    expect(ctx.isSilentModeNick('silent')).toBe(true);
    expect(ctx.isSilentWhoNick('who')).toBe(true);
    expect(ctx.getSilentWhoCallback('who')).toBeDefined();
    ctx.removeSilentModeNick('silent');
    ctx.removeSilentWhoNick('who');
    ctx.removeSilentWhoCallback('who');
    expect(service.silentModeNicks.has('silent')).toBe(false);
    expect(service.silentWhoNicks.has('who')).toBe(false);
    expect(service.silentWhoCallbacks.has('who')).toBe(false);

    ctx.addToChannelListBuffer({ c: 1 });
    expect(ctx.getChannelListBuffer()).toHaveLength(1);
    ctx.clearChannelListBuffer();
    expect(ctx.getChannelListBuffer()).toHaveLength(0);

    ctx.addToLinksBuffer({ l: 1 });
    expect(ctx.getLinksBuffer()).toHaveLength(1);
    ctx.clearLinksBuffer();
    expect(ctx.getLinksBuffer()).toHaveLength(0);

    ctx.addToStatsBuffer('line1');
    expect(ctx.getStatsBuffer()).toEqual(['line1']);
    ctx.clearStatsBuffer();
    expect(ctx.getStatsBuffer()).toEqual([]);

    ctx.addToBanListBuffer('#chan', { mask: '*' });
    expect(ctx.getBanListBuffer().get('#chan')).toHaveLength(1);
    ctx.clearBanListBuffer('#chan');
    expect(ctx.getBanListBuffer().has('#chan')).toBe(false);

    ctx.addToInviteListBuffer('#chan', { nick: 'a' });
    ctx.addToExceptListBuffer('#chan', { mask: 'b' });
    expect(ctx.getInviteListBuffer().get('#chan')).toHaveLength(1);
    expect(ctx.getExceptListBuffer().get('#chan')).toHaveLength(1);
    ctx.clearInviteListBuffer('#chan');
    ctx.clearExceptListBuffer('#chan');
    expect(ctx.getInviteListBuffer().has('#chan')).toBe(false);
    expect(ctx.getExceptListBuffer().has('#chan')).toBe(false);

    ctx.addToNamesBuffer('#chan', ['@a', '+b']);
    expect(ctx.getNamesBuffer().get('#chan')?.size).toBe(2);
    ctx.clearNamesBuffer('#chan');
    expect(ctx.getNamesBuffer().has('#chan')).toBe(false);

    expect(ctx.getSaslMechanism()).toBeNull();
    ctx.setSaslMechanism('PLAIN');
    expect(ctx.getSaslMechanism()).toBe('PLAIN');
    expect(ctx.getSaslState()).toBe('idle');
    ctx.setSaslState('done');
    expect(ctx.getSaslState()).toBe('done');

    expect(ctx.getMonitoredNicks().has('watch')).toBe(true);
    expect(ctx.getSaslAuthenticating()).toBe(false);
    ctx.setSaslAuthenticating(true);
    ctx.endCAPNegotiation();
    expect(service.saslAuthenticating).toBe(true);
    expect(service.endCAPNegotiation).toHaveBeenCalled();

    expect(ctx.getAltNick()).toBe('alice_');
    expect(ctx.getNickChangeAttempts()).toBe(1);
    ctx.incrementNickChangeAttempts();
    expect(ctx.getNickChangeAttempts()).toBe(2);
    ctx.setCurrentNick('dave');
    expect(service.currentNick).toBe('dave');

    expect(ctx.getUserManagementService()).toEqual({ ok: true });
    ctx.disconnect('bye');
    expect(service.disconnect).toHaveBeenCalledWith('bye');
    expect(ctx.hasCapability('draft/chathistory')).toBe(true);
    expect(ctx.getConfig()).toEqual({ a: 1 });
  });
});
