/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Every incoming command handler, driven down the paths a per-module test does
 * not normally reach.
 *
 * These run on whatever the server sent, and servers differ: a JOIN without the
 * extended-join fields, a KICK with no reason, a NOTICE from the server itself
 * with no prefix at all. Each handler reads its parameters with a fallback for
 * exactly that reason, and a handler that throws on one takes the whole read
 * loop down with it — the connection stops processing, silently, mid-stream.
 *
 * The sweeps below read the registries, so a command added later is covered the
 * moment it is registered.
 */

jest.mock('../../../../src/i18n/localization', () => ({
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

import type {
  CommandHandler,
  CommandHandlerRegistry,
} from '../../../../src/services/irc/commandTypes';
import { authenticateCommandHandlers } from '../../../../src/services/irc/commands/AuthenticateCommandHandlers';
import { batchCommandHandlers } from '../../../../src/services/irc/commands/BatchCommandHandlers';
import { capCommandHandlers } from '../../../../src/services/irc/commands/CapCommandHandlers';
import { joinCommandHandlers } from '../../../../src/services/irc/commands/JoinCommandHandlers';
import { kickCommandHandlers } from '../../../../src/services/irc/commands/KickCommandHandlers';
import { killCommandHandlers } from '../../../../src/services/irc/commands/KillCommandHandlers';
import { nickCommandHandlers } from '../../../../src/services/irc/commands/NickCommandHandlers';
import { noticeCommandHandlers } from '../../../../src/services/irc/commands/NoticeCommandHandlers';
import { partCommandHandlers } from '../../../../src/services/irc/commands/PartCommandHandlers';
import { privmsgCommandHandlers } from '../../../../src/services/irc/commands/PrivmsgCommandHandlers';
import { quitCommandHandlers } from '../../../../src/services/irc/commands/QuitCommandHandlers';
import { readMarkerCommandHandlers } from '../../../../src/services/irc/commands/ReadMarkerCommandHandlers';
import { renameCommandHandlers } from '../../../../src/services/irc/commands/RenameCommandHandlers';
import { serverCommandHandlers } from '../../../../src/services/irc/commands/ServerCommandHandlers';
import { standardCommandHandlers } from '../../../../src/services/irc/commands/StandardCommandHandlers';
import { topicModeCommandHandlers } from '../../../../src/services/irc/commands/TopicModeCommandHandlers';
import { userStateCommandHandlers } from '../../../../src/services/irc/commands/UserStateCommandHandlers';

const REGISTRIES: Array<[string, CommandHandlerRegistry]> = [
  ['authenticate', authenticateCommandHandlers],
  ['batch', batchCommandHandlers],
  ['cap', capCommandHandlers],
  ['join', joinCommandHandlers],
  ['kick', kickCommandHandlers],
  ['kill', killCommandHandlers],
  ['nick', nickCommandHandlers],
  ['notice', noticeCommandHandlers],
  ['part', partCommandHandlers],
  ['privmsg', privmsgCommandHandlers],
  ['quit', quitCommandHandlers],
  ['readMarker', readMarkerCommandHandlers],
  ['rename', renameCommandHandlers],
  ['server', serverCommandHandlers],
  ['standard', standardCommandHandlers],
  ['topicMode', topicModeCommandHandlers],
  ['userState', userStateCommandHandlers],
];

const ALL: Array<[string, string, CommandHandler]> = REGISTRIES.flatMap(
  ([module, registry]) =>
    [...registry.entries()].map(
      ([command, handler]) =>
        [module, command, handler] as [string, string, CommandHandler],
    ),
);

/** A context where everything answers, so a handler runs to its end. */
const fullContext = () => {
  const channelUsers = new Map<string, any>([
    ['alice', { nick: 'alice', modes: [] }],
  ]);
  return {
    addMessage: jest.fn(),
    addPendingChannelIntro: jest.fn(),
    addRawMessage: jest.fn(),
    decodeIfBase: jest.fn((value: string) => value),
    decodeIfBase64Like: jest.fn((value: string) => value),
    emit: jest.fn(),
    emitJoinedChannel: jest.fn(),
    emitPart: jest.fn(),
    ensureChannelUsersMap: jest.fn(() => channelUsers),
    evaluateProtectionDecision: jest.fn(() => ({ blocked: false })),
    extractMaskFromNotice: jest.fn(() => '*!*@host.example'),
    extractNick: jest.fn((prefix: string) => (prefix || '').split('!')[0]),
    getAllChannelUsers: jest.fn(() => new Map([['#chat', channelUsers]])),
    getChannelEncryptionService: jest.fn(() => undefined),
    getChannelTopicInfo: jest.fn(() => ({ topic: 'a topic' })),
    getChannelUsers: jest.fn(() => channelUsers),
    getCurrentNick: jest.fn(() => 'CurrentNick'),
    getEncryptedDMService: jest.fn(() => undefined),
    getNetworkName: jest.fn(() => 'TestNet'),
    getProtectionTabContext: jest.fn(() => ({})),
    getSaslMechanism: jest.fn(() => 'PLAIN'),
    getSaslState: jest.fn(() => ({ authenticating: false })),
    getUser: jest.fn(() => ({ nick: 'alice', modes: [] })),
    getUserManagementService: jest.fn(() => ({
      findMatchingBlacklistEntry: jest.fn(() => undefined),
      findMatchingUserListEntry: jest.fn(() => undefined),
      isUserIgnored: jest.fn(() => false),
      updateWHOIS: jest.fn(),
    })),
    handleBatchEnd: jest.fn(),
    handleBatchStart: jest.fn(),
    handleCAPCommand: jest.fn(),
    handleChannelModeChange: jest.fn(),
    handleCTCPRequest: jest.fn(),
    handleKillDisconnect: jest.fn(),
    handleMultilineMessage: jest.fn(),
    handleProtectionBlock: jest.fn(),
    handleScramServerFinal: jest.fn(),
    handleScramServerFirst: jest.fn(),
    handleServerError: jest.fn(),
    isExtendedJoinEnabled: jest.fn(() => false),
    isNoImplicitNamesEnabled: jest.fn(() => false),
    isUserIgnored: jest.fn(() => false),
    isUserProtected: jest.fn(() => false),
    logRaw: jest.fn(),
    maybeEmitChannelIntro: jest.fn(),
    parseCTCP: jest.fn(() => ({ isCTCP: false })),
    runAutoModeCheckForJoin: jest.fn(),
    runBlacklistAction: jest.fn(),
    runBlacklistCheckForJoin: jest.fn(() => false),
    sendRaw: jest.fn(),
    sendSASLCredentials: jest.fn(),
    setChannelTopicInfo: jest.fn(),
    setCurrentNick: jest.fn(),
    setSaslAuthenticating: jest.fn(),
    setUser: jest.fn(),
    updateChannelUserList: jest.fn(),
    updateSelfUserModes: jest.fn(),
  };
};

const run = (
  handler: CommandHandler,
  ctx: any,
  prefix: string,
  params: string[],
) => handler(ctx, prefix, params, 1_700_000_000_000, {});

beforeEach(() => jest.clearAllMocks());

describe('every incoming command', () => {
  it('is registered by exactly one module', () => {
    const claims = new Map<string, string[]>();
    for (const [module, command] of ALL) {
      claims.set(command, [...(claims.get(command) ?? []), module]);
    }

    // Two modules claiming one command means whichever the dispatcher merges
    // last wins, silently, and the other handler never runs.
    const duplicated = [...claims.entries()].filter(
      ([, modules]) => modules.length > 1,
    );
    expect(duplicated).toEqual([]);
    expect(ALL.length).toBeGreaterThan(15);
  });

  it.each(ALL)(
    '%s %s survives a line with no parameters',
    (_module, _command, handler) => {
      const ctx = fullContext();

      expect(() => run(handler, ctx, 'alice!ali@host', [])).not.toThrow();

      // A missing value must not reach the user as the word "undefined".
      for (const call of ctx.addMessage.mock.calls) {
        if (typeof call[0]?.text === 'string') {
          expect(call[0].text).not.toMatch(/undefined|\[object Object\]/);
        }
      }
    },
  );

  it.each(ALL)(
    '%s %s survives a line with no prefix, as the server sends',
    (_module, _command, handler) => {
      const ctx = fullContext();

      // A message straight from the server carries no nick!user@host.
      expect(() => run(handler, ctx, '', ['#chat', 'text'])).not.toThrow();
    },
  );

  it.each(ALL)(
    '%s %s survives a channel it knows nothing about',
    (_module, _command, handler) => {
      const ctx = fullContext();
      ctx.getChannelUsers = jest.fn(() => undefined) as any;
      ctx.getAllChannelUsers = jest.fn(() => new Map()) as any;
      ctx.getUser = jest.fn(() => undefined) as any;
      ctx.getChannelTopicInfo = jest.fn(() => undefined) as any;

      expect(() =>
        run(handler, ctx, 'alice!ali@host', ['#unknown', 'text']),
      ).not.toThrow();
    },
  );

  it.each(ALL)(
    '%s %s survives a full line with several trailing words',
    (_module, _command, handler) => {
      const ctx = fullContext();

      expect(() =>
        run(handler, ctx, 'alice!ali@host', [
          '#chat',
          'CurrentNick',
          'a longer trailing text with spaces',
        ]),
      ).not.toThrow();
    },
  );

  it.each(ALL)(
    '%s %s survives a line addressed to us',
    (_module, _command, handler) => {
      const ctx = fullContext();

      // Several handlers branch on "is this about me?", and the self branch is
      // the one that changes local state.
      expect(() =>
        run(handler, ctx, 'CurrentNick!ali@host', ['CurrentNick', 'text']),
      ).not.toThrow();
    },
  );
});
