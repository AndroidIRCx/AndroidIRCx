/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  handle315,
  handle324,
  handle331,
  handle332,
  handle333,
  handle352,
  handle353,
  handle366,
  statefulChannelHandlers,
} from '../../../../src/services/irc/numerics/StatefulChannelNumerics';

jest.mock('../../../../src/i18n/transifex', () => ({
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

describe('StatefulChannelNumerics', () => {
  let ctx: any;
  let topicInfo: Record<string, any>;
  let namesBuffer: Map<string, Set<string>>;

  beforeEach(() => {
    topicInfo = {};
    namesBuffer = new Map();
    ctx = {
      addMessage: jest.fn(),
      addToNamesBuffer: jest.fn((channel: string, users: string[]) => {
        namesBuffer.set(channel, new Set(users));
      }),
      clearNamesBuffer: jest.fn((channel: string) => {
        namesBuffer.delete(channel);
      }),
      emitUserListChange: jest.fn(),
      getChannelTopicInfo: jest.fn((channel: string) => topicInfo[channel]),
      getNamesBuffer: jest.fn(() => namesBuffer),
      getSilentWhoCallback: jest.fn(() => undefined),
      hasCapability: jest.fn((cap: string) => cap === 'chathistory'),
      isSilentWhoNick: jest.fn(() => false),
      maybeEmitChannelIntro: jest.fn(),
      parseUserWithPrefixes: jest.fn((user: string) => {
        const nick = user.replace(/^[@+]/, '');
        return { nick, original: user };
      }),
      removeSilentWhoCallback: jest.fn(),
      removeSilentWhoNick: jest.fn(),
      requestChatHistory: jest.fn(),
      setChannelTopicInfo: jest.fn((channel: string, info: any) => {
        topicInfo[channel] = info;
      }),
      setChannelUsers: jest.fn(),
    };
  });

  it('registers stateful channel handlers', () => {
    expect(statefulChannelHandlers.get(315)).toBe(handle315);
    expect(statefulChannelHandlers.get(352)).toBe(handle352);
    expect(statefulChannelHandlers.get(366)).toBe(handle366);
  });

  it('suppresses silent WHO end numerics and clears silent state', () => {
    ctx.isSilentWhoNick.mockReturnValue(true);

    handle315(ctx, 'server', ['nick', 'Alice'], 600);

    expect(ctx.removeSilentWhoCallback).toHaveBeenCalledWith('alice');
    expect(ctx.removeSilentWhoNick).toHaveBeenCalledWith('alice');
    expect(ctx.addMessage).not.toHaveBeenCalled();
  });

  it('formats WHO end when query is not silent', () => {
    handle315(ctx, 'server', ['nick', '#chat'], 601);

    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'raw',
      text: '*** End of WHO list for #chat',
      timestamp: 601,
      isRaw: true,
      rawCategory: 'server',
    });
  });

  it('updates channel topic state across mode and topic numerics', () => {
    handle324(ctx, 'server', ['nick', '#chat', 'nt'], 602);
    handle331(ctx, 'server', ['nick', '#chat'], 603);
    handle332(ctx, 'server', ['nick', '#chat', ':General topic'], 604);
    handle333(ctx, 'server', ['nick', '#chat', 'alice', '12345'], 605);

    expect(topicInfo['#chat']).toEqual({
      modes: '+nt',
      topic: ':General topic',
      setBy: 'alice',
      setAt: 12345,
    });
    expect(ctx.maybeEmitChannelIntro).toHaveBeenCalledTimes(4);
  });

  it('handles WHO replies for silent lookups via callback', () => {
    const callback = jest.fn();
    ctx.isSilentWhoNick.mockReturnValue(true);
    ctx.getSilentWhoCallback.mockReturnValue(callback);

    handle352(ctx, 'server', ['nick', '#chat', 'user', 'host', 'irc.example.org', 'Alice', 'H', ':0 Real Name'], 606);

    expect(callback).toHaveBeenCalledWith('user', 'host');
    expect(ctx.addMessage).not.toHaveBeenCalled();
  });

  it('formats WHO replies with away and oper markers', () => {
    handle352(
      ctx,
      'server',
      ['nick', '#chat', 'user', 'host', 'irc.example.org', 'Alice', 'G*', ':0 Real Name'],
      607
    );

    expect(ctx.addMessage).toHaveBeenCalledWith({
      type: 'raw',
      text: '*** WHO #chat: Alice (user@host) [irc.example.org] (away) (IRCop) - Real',
      timestamp: 607,
      isRaw: true,
      rawCategory: 'server',
    });
  });

  it('buffers names and finalizes channel users with chat history request', () => {
    handle353(ctx, 'server', ['nick', '=', '#chat', ':@Alice +Bob Carol'], 608);
    handle366(ctx, 'server', ['nick', '#chat'], 609);

    expect(ctx.addToNamesBuffer).toHaveBeenCalledWith('#chat', ['@Alice', '+Bob', 'Carol']);
    expect(ctx.setChannelUsers).toHaveBeenCalledWith(
      '#chat',
      new Map([
        ['alice', { nick: 'Alice', original: '@Alice' }],
        ['bob', { nick: 'Bob', original: '+Bob' }],
        ['carol', { nick: 'Carol', original: 'Carol' }],
      ])
    );
    expect(ctx.clearNamesBuffer).toHaveBeenCalledWith('#chat');
    expect(ctx.emitUserListChange).toHaveBeenCalledWith('#chat', [
      { nick: 'Alice', original: '@Alice' },
      { nick: 'Bob', original: '+Bob' },
      { nick: 'Carol', original: 'Carol' },
    ]);
    expect(ctx.maybeEmitChannelIntro).toHaveBeenCalledWith('#chat', 609);
    expect(ctx.requestChatHistory).toHaveBeenCalledWith('#chat', 50);
  });
});
