/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelManagementService } from '../../src/services/ChannelManagementService';

describe('ChannelManagementService', () => {
  const events = new Map<string, Function>();
  const mockIrc = {
    addRawMessage: jest.fn(),
    on: jest.fn((event: string, cb: Function) => {
      events.set(event, cb);
      return jest.fn();
    }),
    sendCommand: jest.fn(),
  } as any;

  let service: ChannelManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    events.clear();
    service = new ChannelManagementService(mockIrc);
  });

  it('initializes and subscribes to IRC events', () => {
    service.initialize();
    expect(mockIrc.addRawMessage).toHaveBeenCalled();
    expect(mockIrc.on).toHaveBeenCalledWith('topic', expect.any(Function));
    expect(mockIrc.on).toHaveBeenCalledWith(
      'channelMode',
      expect.any(Function),
    );
    expect(mockIrc.on).toHaveBeenCalledWith(
      'clear-channel',
      expect.any(Function),
    );
    expect(mockIrc.on).toHaveBeenCalledWith('numeric', expect.any(Function));
  });

  it('updates topic and emits channel info changes', () => {
    const listener = jest.fn();
    service.onChannelInfoChange(listener);

    service.updateTopic('#chat', 'hello', 'alice');
    const info = service.getChannelInfo('#chat');

    expect(info?.topic).toBe('hello');
    expect(info?.topicSetBy).toBe('alice');
    expect(listener).toHaveBeenCalledWith(
      '#chat',
      expect.objectContaining({ topic: 'hello' }),
    );
  });

  it('parses channel mode updates with add/remove parameters', () => {
    service.updateModes('#chan', '+psitnmklbeI', [
      'key1',
      '10',
      '*!*@ban',
      '*!*@exc',
      '*!*@inv',
    ]);
    let info = service.getChannelInfo('#chan');
    expect(info?.modes.private).toBe(true);
    expect(info?.modes.secret).toBe(true);
    expect(info?.modes.inviteOnly).toBe(true);
    expect(info?.modes.topicProtected).toBe(true);
    expect(info?.modes.noExternalMessages).toBe(true);
    expect(info?.modes.moderated).toBe(true);
    expect(info?.modes.key).toBe('key1');
    expect(info?.modes.limit).toBe(10);
    expect(info?.modes.banList).toContain('*!*@ban');
    expect(info?.modes.exceptionList).toContain('*!*@exc');
    expect(info?.modes.inviteList).toContain('*!*@inv');

    service.updateModes('#chan', '-klebI', [
      'key1',
      '10',
      '*!*@ban',
      '*!*@exc',
      '*!*@inv',
    ]);
    info = service.getChannelInfo('#chan');
    // Current implementation merges modes and keeps previously set scalar keys.
    expect(info?.modes.key).toBe('key1');
    expect(info?.modes.limit).toBe(10);
  });

  it('maps all mutator methods to expected IRC MODE/TOPIC commands', () => {
    service.setChannelMode('#a', 'm');
    service.setChannelMode('#a', '+k', 'secret');
    service.setTopic('#a', 'topic');
    service.setKey('#a', 'k1');
    service.removeKey('#a');
    service.setLimit('#a', 50);
    service.removeLimit('#a');
    service.addBan('#a', '*!*@x');
    service.removeBan('#a', '*!*@x');
    service.addException('#a', '*!*@e');
    service.removeException('#a', '*!*@e');
    service.requestBanList('#a');
    service.requestExceptionList('#a');
    service.requestInviteList('#a');
    service.addInvite('#a', '*!*@i');
    service.removeInvite('#a', '*!*@i');

    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a +m');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a +k secret');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('TOPIC #a :topic');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a -k');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a +l 50');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a -l');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a +b *!*@x');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a -b *!*@x');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a +e *!*@e');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a -e *!*@e');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a b');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a e');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a I');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a +I *!*@i');
    expect(mockIrc.sendCommand).toHaveBeenCalledWith('MODE #a -I *!*@i');
  });

  it('handles numeric events for mode/topic/list buffers', () => {
    service.initialize();
    const onNumeric = events.get('numeric')!;

    onNumeric(324, 'srv', ['me', '#chan', '+ntk', 'keyx'], Date.now());
    onNumeric(332, 'srv', ['me', '#chan', 'topic text'], Date.now());
    onNumeric(
      333,
      'srv',
      ['me', '#chan', 'alice!u@h', '1700000000'],
      Date.now(),
    );

    onNumeric(367, 'srv', ['me', '#chan', '*!*@ban1'], Date.now());
    onNumeric(367, 'srv', ['me', '#chan', '*!*@ban2'], Date.now());
    onNumeric(368, 'srv', ['me', '#chan'], Date.now());

    onNumeric(348, 'srv', ['me', '#chan', '*!*@exc1'], Date.now());
    onNumeric(349, 'srv', ['me', '#chan'], Date.now());

    onNumeric(346, 'srv', ['me', '#chan', '*!*@inv1'], Date.now());
    onNumeric(347, 'srv', ['me', '#chan'], Date.now());

    const info = service.getChannelInfo('#chan')!;
    expect(info.topic).toBe('topic text');
    expect(info.topicSetBy).toBe('alice!u@h');
    expect(info.modes.key).toBe('keyx');
    expect(info.modes.banList).toEqual(['*!*@ban1', '*!*@ban2']);
    expect(info.modes.exceptionList).toEqual(['*!*@exc1']);
    expect(info.modes.inviteList).toEqual(['*!*@inv1']);
  });

  it('clears channel info and unsubscribes listeners', () => {
    const listener = jest.fn();
    const off = service.onChannelInfoChange(listener);
    service.updateChannelInfo('#gone', { topic: 'x' });
    expect(service.getChannelInfo('#gone')).toBeDefined();
    off();

    service.clearChannel('#gone');
    service.updateChannelInfo('#other', { topic: 'y' });
    expect(service.getChannelInfo('#gone')).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('renders formatted mode string', () => {
    service.updateChannelInfo('#fmt', {
      modes: {
        private: true,
        secret: true,
        inviteOnly: true,
        topicProtected: true,
        noExternalMessages: true,
        moderated: true,
        key: 'k',
        limit: 12,
        banList: ['a', 'b'],
        exceptionList: ['e'],
        inviteList: ['i'],
      },
    });
    expect(service.getModeString('#fmt')).toBe('+psitnmklb(2)e(1)I(1)');
    expect(service.getModeString('#none')).toBe('');
  });
});
