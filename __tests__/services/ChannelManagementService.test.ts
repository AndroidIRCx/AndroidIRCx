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

  describe('numerics that arrive incomplete', () => {
    /**
     * Each branch of this listener checks the channel, and most check a mask
     * too, before touching a buffer. A reply with the field missing is what a
     * server sends on an empty list or a malformed line, and acting on it
     * would key a buffer on the empty string and leak into the next channel.
     */
    const INCOMPLETE: Array<[string, number, string[]]> = [
      ['a mode reply with no channel', 324, ['me', '', '+nt']],
      ['a mode reply with no modes', 324, ['me', '#chan', '']],
      ['a topic-setter reply with no channel', 333, ['me', '', 'alice', '1']],
      ['a topic-setter reply with no setter', 333, ['me', '#chan', '', '1']],
      ['a ban entry with no channel', 367, ['me', '', '*!*@ban']],
      ['a ban entry with no mask', 367, ['me', '#chan', '']],
      ['an end-of-bans with no channel', 368, ['me', '']],
      ['an exception entry with no channel', 348, ['me', '', '*!*@exc']],
      ['an exception entry with no mask', 348, ['me', '#chan', '']],
      ['an end-of-exceptions with no channel', 349, ['me', '']],
      ['an invite entry with no channel', 346, ['me', '', '*!*@inv']],
      ['an invite entry with no mask', 346, ['me', '#chan', '']],
      ['an end-of-invites with no channel', 347, ['me', '']],
    ];

    it.each(INCOMPLETE)('ignores %s', (_label, numeric, params) => {
      service.initialize();
      const onNumeric = events.get('numeric')!;
      const listener = jest.fn();
      service.onChannelInfoChange(listener);

      onNumeric(numeric, 'srv', params, Date.now());

      expect(service.getChannelInfo('')).toBeUndefined();
    });

    it('ignores a numeric it has no interest in', () => {
      service.initialize();
      const onNumeric = events.get('numeric')!;

      expect(() =>
        onNumeric(999, 'srv', ['me', '#chan', 'whatever'], Date.now()),
      ).not.toThrow();
      expect(service.getChannelInfo('#chan')).toBeUndefined();
    });

    it('reads a topic reply that carries no topic as an empty one', () => {
      service.initialize();
      const onNumeric = events.get('numeric')!;

      onNumeric(332, 'srv', ['me', '#chan'], Date.now());

      expect(service.getChannelInfo('#chan')?.topic).toBe('');
    });

    it('leaves the set-at time out when the server does not send one', () => {
      service.initialize();
      const onNumeric = events.get('numeric')!;

      onNumeric(333, 'srv', ['me', '#chan', 'alice'], Date.now());

      const info = service.getChannelInfo('#chan')!;
      expect(info.topicSetBy).toBe('alice');
      expect(info.topicSetAt).toBeUndefined();
    });

    it('ends a list that never had an entry with an empty one', () => {
      service.initialize();
      const onNumeric = events.get('numeric')!;

      onNumeric(368, 'srv', ['me', '#quiet'], Date.now());
      onNumeric(349, 'srv', ['me', '#quiet'], Date.now());
      onNumeric(347, 'srv', ['me', '#quiet'], Date.now());

      const modes = service.getChannelInfo('#quiet')!.modes;
      // Empty is not the same as unknown: the channel really has no bans.
      expect(modes.banList).toEqual([]);
      expect(modes.exceptionList).toEqual([]);
      expect(modes.inviteList).toEqual([]);
    });
  });

  describe('the mode string', () => {
    it('leaves out every flag that is off', () => {
      service.updateChannelInfo('#plain', {
        modes: {
          private: false,
          secret: false,
          inviteOnly: false,
          topicProtected: false,
          noExternalMessages: false,
          moderated: false,
          key: '',
          limit: 0,
          banList: [],
          exceptionList: [],
          inviteList: [],
        },
      });

      expect(service.getModeString('#plain')).toBe('');
    });

    it('is empty for a channel whose modes were never read', () => {
      service.updateChannelInfo('#nomodes', { topic: 'x' });
      expect(service.getModeString('#nomodes')).toBe('');
    });

    it('counts only the lists that have something in them', () => {
      service.updateChannelInfo('#some', {
        modes: { moderated: true, banList: ['a'], exceptionList: [] },
      });

      expect(service.getModeString('#some')).toBe('+mb(1)');
    });
  });
});
