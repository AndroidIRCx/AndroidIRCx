/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRC Incoming Command Handlers Unit Test Suite
 *
 * Direct unit tests for all extracted command handler modules:
 * - StandardCommandHandlers (FAIL, WARN, NOTE, PONG, INVITE)
 * - NickCommandHandlers (NICK)
 * - KickCommandHandlers (KICK)
 * - KillCommandHandlers (KILL)
 * - TopicModeCommandHandlers (TOPIC, MODE)
 * - NoticeCommandHandlers (NOTICE)
 * - ReadMarkerCommandHandlers (MARKREAD, REDACT)
 * - BatchCommandHandlers (BATCH)
 * - PrivmsgCommandHandlers (PRIVMSG)
 */

import { handleFAIL, handleWARN, handleNOTE, handlePONG, handleINVITE } from '../src/services/irc/commands/StandardCommandHandlers';
import { handleNICK } from '../src/services/irc/commands/NickCommandHandlers';
import { handleKICK } from '../src/services/irc/commands/KickCommandHandlers';
import { handleKILL } from '../src/services/irc/commands/KillCommandHandlers';
import { handleTOPIC, handleMODE } from '../src/services/irc/commands/TopicModeCommandHandlers';
import { handleMARKREAD, handleREDACT } from '../src/services/irc/commands/ReadMarkerCommandHandlers';
import { handleBATCH } from '../src/services/irc/commands/BatchCommandHandlers';
import { handleNOTICE } from '../src/services/irc/commands/NoticeCommandHandlers';
import { handlePRIVMSG } from '../src/services/irc/commands/PrivmsgCommandHandlers';
import { handleACCOUNT, handleAWAY, handleCHGHOST, handleTAGMSG } from '../src/services/irc/commands/UserStateCommandHandlers';

// ========================================
// HELPER: Create a mock CommandHandlerContext
// ========================================
function createMockCtx(overrides?: Record<string, any>) {
  const messages: any[] = [];
  const rawMessages: any[] = [];
  const emitted: { event: string; args: any[] }[] = [];

  const ctx: any = {
    addMessage: jest.fn((msg: any) => messages.push(msg)),
    addRawMessage: jest.fn((text: string, category: string, timestamp?: number) =>
      rawMessages.push({ text, category, timestamp }),
    ),
    emit: jest.fn((event: string, ...args: any[]) => emitted.push({ event, args })),
    extractNick: jest.fn((prefix: string) => prefix.split('!')[0]),
    parseCTCP: jest.fn(() => ({ isCTCP: false })),
    logRaw: jest.fn(),
    decodeIfBase64Like: jest.fn((v: string) => v),
    getNetworkName: jest.fn(() => 'TestNet'),
    getCurrentNick: jest.fn(() => 'tester'),
    setCurrentNick: jest.fn(),
    getUserManagementService: jest.fn(() => ({
      isUserIgnored: jest.fn(() => false),
      findMatchingBlacklistEntry: jest.fn(() => null),
    })),
    getProtectionTabContext: jest.fn(() => ({ isActiveTab: false, isQueryOpen: false })),
    handleProtectionBlock: jest.fn(),
    extractMaskFromNotice: jest.fn(() => null),
    runBlacklistAction: jest.fn(),
    handleServerError: jest.fn(),
    handleBatchStart: jest.fn(),
    handleBatchEnd: jest.fn(),
    handleCAPCommand: jest.fn(),
    getChannelTopicInfo: jest.fn(() => ({})),
    setChannelTopicInfo: jest.fn(),
    maybeEmitChannelIntro: jest.fn(),
    handleChannelModeChange: jest.fn(),
    updateSelfUserModes: jest.fn(),
    getChannelUsers: jest.fn(() => new Map()),
    updateChannelUserList: jest.fn(),
    getAllChannelUsers: jest.fn(() => new Map()),
    hasUser: jest.fn(() => false),
    setUser: jest.fn(),
    getUser: jest.fn(),
    ensureChannelUsersMap: jest.fn(() => new Map()),
    sendRaw: jest.fn(),
    handleCTCPRequest: jest.fn(),
    isUserIgnored: jest.fn(() => false),
    isUserProtected: jest.fn(() => false),
    evaluateProtectionDecision: jest.fn(() => null),
    handleMultilineMessage: jest.fn((_f: string, _t: string, text: string) => text),
    getEncryptedDMService: jest.fn(() => ({})),
    getChannelEncryptionService: jest.fn(() => ({})),
    handleKillDisconnect: jest.fn(),
    ...overrides,
  };

  return { ctx, messages, rawMessages, emitted };
}

// ========================================
// STANDARD COMMAND HANDLERS
// ========================================
describe('StandardCommandHandlers', () => {
  describe('FAIL', () => {
    it('creates error message with command, code, and description', () => {
      const { ctx, messages, emitted } = createMockCtx();
      handleFAIL(ctx, 'server', ['REGISTER', 'ACCOUNT_EXISTS', 'Account already exists'], Date.now());

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('error');
      expect(messages[0].text).toContain('REGISTER');
      expect(messages[0].text).toContain('ACCOUNT_EXISTS');
      expect(messages[0].text).toContain('Account already exists');
      expect(emitted).toContainEqual({ event: 'fail', args: expect.any(Array) });
    });

    it('handles context params between code and description', () => {
      const { ctx, messages } = createMockCtx();
      handleFAIL(ctx, 'server', ['CHATHISTORY', 'INVALID_TARGET', '#chan', 'Invalid target'], Date.now());

      expect(messages[0].text).toContain('#chan');
      expect(messages[0].text).toContain('Invalid target');
    });

    it('handles minimal params', () => {
      const { ctx, messages } = createMockCtx();
      handleFAIL(ctx, 'server', ['CMD', 'ERR'], Date.now());

      expect(messages[0].type).toBe('error');
    });
  });

  describe('WARN', () => {
    it('creates raw server message', () => {
      const { ctx, messages, emitted } = createMockCtx();
      handleWARN(ctx, 'server', ['CONNECT', 'SLOW_CONN', 'Connection is slow'], Date.now());

      expect(messages[0].type).toBe('raw');
      expect(messages[0].rawCategory).toBe('server');
      expect(messages[0].text).toContain('SLOW_CONN');
      expect(emitted).toContainEqual({ event: 'warn', args: expect.any(Array) });
    });
  });

  describe('NOTE', () => {
    it('creates raw server message', () => {
      const { ctx, messages, emitted } = createMockCtx();
      handleNOTE(ctx, 'server', ['REGISTER', 'INFO', 'You can register later'], Date.now());

      expect(messages[0].type).toBe('raw');
      expect(messages[0].text).toContain('INFO');
      expect(emitted).toContainEqual({ event: 'note', args: expect.any(Array) });
    });
  });

  describe('PONG', () => {
    it('emits pong event with timestamp', () => {
      const { ctx, emitted } = createMockCtx();
      const ts = Date.now().toString();
      handlePONG(ctx, 'server', ['server', ts], Date.now());

      const pong = emitted.find(e => e.event === 'pong');
      expect(pong).toBeTruthy();
      expect(pong!.args[0]).toBe(parseInt(ts, 10));
    });

    it('ignores non-numeric token', () => {
      const { ctx, emitted } = createMockCtx();
      handlePONG(ctx, 'server', ['server', 'not-a-number'], Date.now());

      expect(emitted.find(e => e.event === 'pong')).toBeUndefined();
    });

    it('ignores single param', () => {
      const { ctx, emitted } = createMockCtx();
      handlePONG(ctx, 'server', ['server'], Date.now());

      expect(emitted.find(e => e.event === 'pong')).toBeUndefined();
    });
  });

  describe('INVITE', () => {
    it('creates invite message with inviter and channel', () => {
      const { ctx, messages } = createMockCtx();
      handleINVITE(ctx, 'alice!user@host', ['tester', '#secret'], Date.now());

      expect(messages[0].type).toBe('invite');
      expect(messages[0].from).toBe('alice');
      expect(messages[0].channel).toBe('#secret');
      expect(messages[0].text).toContain('alice');
      expect(messages[0].text).toContain('#secret');
      expect(messages[0].username).toBe('user');
      expect(messages[0].hostname).toBe('host');
    });
  });
});

// ========================================
// NICK COMMAND HANDLER
// ========================================
describe('NickCommandHandlers', () => {
  it('updates currentNick when own nick changes', () => {
    const { ctx } = createMockCtx();
    ctx.getCurrentNick.mockReturnValue('oldnick');

    handleNICK(ctx, 'oldnick!user@host', ['newnick'], Date.now());

    expect(ctx.setCurrentNick).toHaveBeenCalledWith('newnick');
  });

  it('does not update currentNick for other users', () => {
    const { ctx } = createMockCtx();
    handleNICK(ctx, 'alice!user@host', ['alice2'], Date.now());

    expect(ctx.setCurrentNick).not.toHaveBeenCalled();
  });

  it('renames user in channel user maps', () => {
    const { ctx, messages } = createMockCtx();
    const usersMap = new Map([['alice', { nick: 'alice', modes: ['o'] }]]);
    const allChannels = new Map([['#test', usersMap]]);
    ctx.getAllChannelUsers.mockReturnValue(allChannels);

    handleNICK(ctx, 'alice!user@host', ['alice2'], Date.now());

    expect(usersMap.has('alice')).toBe(false);
    expect(usersMap.has('alice2')).toBe(true);
    expect(usersMap.get('alice2')!.nick).toBe('alice2');
    expect(ctx.updateChannelUserList).toHaveBeenCalledWith('#test');
    expect(messages[0].type).toBe('nick');
    expect(messages[0].channel).toBe('#test');
  });

  it('adds nick message per affected channel', () => {
    const { ctx, messages } = createMockCtx();
    const users1 = new Map([['bob', { nick: 'bob', modes: [] }]]);
    const users2 = new Map([['bob', { nick: 'bob', modes: [] }]]);
    const allChannels = new Map([['#chan1', users1], ['#chan2', users2]]);
    ctx.getAllChannelUsers.mockReturnValue(allChannels);

    handleNICK(ctx, 'bob!user@host', ['bobby'], Date.now());

    expect(messages).toHaveLength(2);
    expect(messages[0].channel).toBe('#chan1');
    expect(messages[1].channel).toBe('#chan2');
  });

  it('adds single message when user is in no channels', () => {
    const { ctx, messages } = createMockCtx();
    ctx.getAllChannelUsers.mockReturnValue(new Map());

    handleNICK(ctx, 'ghost!user@host', ['ghost2'], Date.now());

    expect(messages).toHaveLength(1);
    expect(messages[0].channel).toBeUndefined();
  });
});

// ========================================
// KICK COMMAND HANDLER
// ========================================
describe('KickCommandHandlers', () => {
  it('emits kick event when self is kicked', () => {
    const { ctx, emitted } = createMockCtx();
    handleKICK(ctx, 'op!user@host', ['#chan', 'tester', 'Bad behavior'], Date.now());

    expect(emitted).toContainEqual({ event: 'kick', args: ['#chan'] });
  });

  it('does not emit kick event for other users', () => {
    const { ctx, emitted } = createMockCtx();
    handleKICK(ctx, 'op!user@host', ['#chan', 'alice', 'reason'], Date.now());

    expect(emitted.find(e => e.event === 'kick')).toBeUndefined();
  });

  it('removes kicked user from channel users map', () => {
    const usersMap = new Map([['alice', { nick: 'alice' }]]);
    const { ctx } = createMockCtx({ getChannelUsers: jest.fn(() => usersMap) });

    handleKICK(ctx, 'op!user@host', ['#chan', 'alice', 'bye'], Date.now());

    expect(usersMap.has('alice')).toBe(false);
    expect(ctx.updateChannelUserList).toHaveBeenCalledWith('#chan');
  });

  it('creates kick message with reason', () => {
    const { ctx, messages } = createMockCtx();
    handleKICK(ctx, 'op!user@host', ['#chan', 'alice', 'Spamming'], Date.now());

    expect(messages[0].type).toBe('kick');
    expect(messages[0].channel).toBe('#chan');
    expect(messages[0].text).toContain('alice');
    expect(messages[0].text).toContain('Spamming');
    expect(messages[0].target).toBe('alice');
  });

  it('creates kick message without reason', () => {
    const { ctx, messages } = createMockCtx();
    handleKICK(ctx, 'op!user@host', ['#chan', 'alice'], Date.now());

    expect(messages[0].type).toBe('kick');
    expect(messages[0].reason).toBeUndefined();
  });
});

// ========================================
// KILL COMMAND HANDLER
// ========================================
describe('KillCommandHandlers', () => {
  it('handles self kill with disconnect', () => {
    const { ctx, messages } = createMockCtx();
    handleKILL(ctx, 'oper!u@h', ['tester', 'You have been killed'], Date.now());

    expect(ctx.handleKillDisconnect).toHaveBeenCalledWith('You have been killed');
    const errMsg = messages.find((m: any) => m.type === 'error');
    expect(errMsg).toBeTruthy();
  });

  it('handles other user kill as raw message', () => {
    const { ctx, messages } = createMockCtx();
    handleKILL(ctx, 'oper!u@h', ['badguy', 'Abuse'], Date.now());

    expect(ctx.handleKillDisconnect).not.toHaveBeenCalled();
    expect(messages[0].type).toBe('raw');
    expect(messages[0].text).toContain('badguy');
  });

  it('is case-insensitive for own nick', () => {
    const { ctx } = createMockCtx();
    ctx.getCurrentNick.mockReturnValue('Tester');
    handleKILL(ctx, 'oper!u@h', ['tester', 'reason'], Date.now());

    expect(ctx.handleKillDisconnect).toHaveBeenCalled();
  });
});

// ========================================
// TOPIC AND MODE COMMAND HANDLERS
// ========================================
describe('TopicModeCommandHandlers', () => {
  describe('TOPIC', () => {
    it('stores topic info and emits topic event', () => {
      const { ctx, messages, emitted } = createMockCtx();
      handleTOPIC(ctx, 'admin!u@h', ['#chan', 'New topic!'], Date.now());

      expect(ctx.setChannelTopicInfo).toHaveBeenCalledWith('#chan', expect.objectContaining({
        topic: 'New topic!',
        setBy: 'admin',
      }));
      expect(ctx.maybeEmitChannelIntro).toHaveBeenCalledWith('#chan', expect.any(Number));
      expect(emitted).toContainEqual({ event: 'topic', args: ['#chan', 'New topic!', 'admin'] });
      expect(messages[0].type).toBe('topic');
      expect(messages[0].topic).toBe('New topic!');
    });

    it('handles empty topic (topic clear)', () => {
      const { ctx, messages } = createMockCtx();
      handleTOPIC(ctx, 'admin!u@h', ['#chan', ''], Date.now());

      expect(messages[0].topic).toBe('');
    });
  });

  describe('MODE', () => {
    it('handles channel mode change', () => {
      const { ctx, emitted } = createMockCtx();
      handleMODE(ctx, 'op!u@h', ['#chan', '+o', 'alice'], Date.now());

      expect(ctx.handleChannelModeChange).toHaveBeenCalledWith('#chan', ['+o', 'alice']);
      expect(emitted).toContainEqual({ event: 'channelMode', args: ['#chan', '+o', ['alice']] });
    });

    it('handles user mode change', () => {
      const { ctx } = createMockCtx();
      handleMODE(ctx, 'server', ['tester', '+i'], Date.now());

      expect(ctx.updateSelfUserModes).toHaveBeenCalledWith('+i');
    });

    it('does not call handleChannelModeChange for user modes', () => {
      const { ctx } = createMockCtx();
      handleMODE(ctx, 'server', ['tester', '+ix'], Date.now());

      expect(ctx.handleChannelModeChange).not.toHaveBeenCalled();
    });

    it('creates mode message', () => {
      const { ctx, messages } = createMockCtx();
      handleMODE(ctx, 'op!u@h', ['#chan', '+v', 'bob'], Date.now());

      expect(messages[0].type).toBe('mode');
      expect(messages[0].channel).toBe('#chan');
      expect(messages[0].command).toBe('MODE');
    });
  });
});

// ========================================
// READ MARKER / REDACT HANDLERS
// ========================================
describe('ReadMarkerCommandHandlers', () => {
  describe('MARKREAD', () => {
    it('emits read-marker-received with target and timestamp', () => {
      const { ctx, emitted } = createMockCtx();
      handleMARKREAD(ctx, 'tester!u@h', ['#chan', 'timestamp=1700000000'], Date.now());

      const event = emitted.find(e => e.event === 'read-marker-received');
      expect(event).toBeTruthy();
      expect(event!.args).toEqual(['#chan', 'tester', 1700000000]);
    });

    it('uses Date.now() when no timestamp param', () => {
      const { ctx, emitted } = createMockCtx();
      handleMARKREAD(ctx, 'user!u@h', ['#chan', ''], Date.now());

      const event = emitted.find(e => e.event === 'read-marker-received');
      expect(event).toBeTruthy();
      expect(event!.args[2]).toBeGreaterThan(0);
    });
  });

  describe('REDACT', () => {
    it('emits message-redacted and adds display message', () => {
      const { ctx, messages, emitted } = createMockCtx();
      handleREDACT(ctx, 'admin!u@h', ['#chan', 'msgid-123'], Date.now());

      expect(messages[0].type).toBe('raw');
      expect(messages[0].text).toContain('admin');
      expect(messages[0].text).toContain('deleted');
      expect(messages[0].channel).toBe('#chan');

      const event = emitted.find(e => e.event === 'message-redacted');
      expect(event).toBeTruthy();
      expect(event!.args).toEqual(['#chan', 'msgid-123', 'admin']);
    });
  });
});

// ========================================
// BATCH COMMAND HANDLER
// ========================================
describe('BatchCommandHandlers', () => {
  it('calls handleBatchStart for + prefix', () => {
    const { ctx } = createMockCtx();
    handleBATCH(ctx, 'server', ['+ref1', 'chathistory', '#chan'], Date.now());

    expect(ctx.handleBatchStart).toHaveBeenCalledWith('ref1', 'chathistory', ['#chan'], expect.any(Number));
  });

  it('calls handleBatchEnd for - prefix', () => {
    const { ctx } = createMockCtx();
    handleBATCH(ctx, 'server', ['-ref1'], Date.now());

    expect(ctx.handleBatchEnd).toHaveBeenCalledWith('ref1', expect.any(Number));
  });

  it('does nothing for empty params', () => {
    const { ctx } = createMockCtx();
    handleBATCH(ctx, 'server', [], Date.now());

    expect(ctx.handleBatchStart).not.toHaveBeenCalled();
    expect(ctx.handleBatchEnd).not.toHaveBeenCalled();
  });

  it('passes batch type and extra params correctly', () => {
    const { ctx } = createMockCtx();
    handleBATCH(ctx, 'server', ['+ns', 'netsplit', 'irc1.net', 'irc2.net'], Date.now());

    expect(ctx.handleBatchStart).toHaveBeenCalledWith('ns', 'netsplit', ['irc1.net', 'irc2.net'], expect.any(Number));
  });
});

// ========================================
// USER STATE COMMAND HANDLERS
// ========================================
describe('UserStateCommandHandlers', () => {
  describe('ACCOUNT', () => {
    it('shows login message', () => {
      const { ctx, messages, emitted } = createMockCtx();
      handleACCOUNT(ctx, 'alice!u@h', ['alice_acct'], Date.now());

      expect(messages[0].text).toContain('logged in');
      expect(messages[0].text).toContain('alice_acct');
      expect(emitted).toContainEqual({ event: 'account', args: ['alice', 'alice_acct'] });
    });

    it('shows logout message for * account', () => {
      const { ctx, messages } = createMockCtx();
      handleACCOUNT(ctx, 'alice!u@h', ['*'], Date.now());

      expect(messages[0].text).toContain('logged out');
    });
  });

  describe('AWAY', () => {
    it('shows away message', () => {
      const { ctx, messages } = createMockCtx();
      handleAWAY(ctx, 'alice!u@h', ['Gone fishing'], Date.now());

      expect(messages[0].text).toContain('away');
      expect(messages[0].text).toContain('Gone fishing');
    });

    it('shows no longer away when no message', () => {
      const { ctx, messages } = createMockCtx();
      handleAWAY(ctx, 'alice!u@h', [], Date.now());

      expect(messages[0].text).toContain('no longer away');
    });
  });

  describe('CHGHOST', () => {
    it('shows host change and emits event', () => {
      const { ctx, messages, emitted } = createMockCtx();
      handleCHGHOST(ctx, 'alice!u@h', ['newuser', 'new.host.com'], Date.now());

      expect(messages[0].text).toContain('changed host');
      expect(messages[0].text).toContain('new.host.com');
      expect(emitted).toContainEqual({ event: 'chghost', args: ['alice', 'new.host.com'] });
    });
  });

  describe('TAGMSG', () => {
    it('handles react tag', () => {
      const { ctx, emitted } = createMockCtx();
      handleTAGMSG(ctx, 'alice!u@h', ['#chan'], Date.now(), { reactTag: 'msgid123;👍' });

      const reaction = emitted.find(e => e.event === 'reaction-received');
      expect(reaction).toBeTruthy();
      expect(reaction!.args).toEqual(['#chan', 'msgid123', '👍', 'alice']);
    });

    it('handles typing tag', () => {
      const { ctx, emitted } = createMockCtx();
      handleTAGMSG(ctx, 'bob!u@h', ['#chan'], Date.now(), { typingTag: 'active' });

      const typing = emitted.find(e => e.event === 'typing-indicator');
      expect(typing).toBeTruthy();
      expect(typing!.args).toEqual(['#chan', 'bob', 'active']);
    });

    it('handles both react and typing', () => {
      const { ctx, emitted } = createMockCtx();
      handleTAGMSG(ctx, 'carol!u@h', ['#chan'], Date.now(), {
        reactTag: 'mid;🎉',
        typingTag: 'paused',
      });

      expect(emitted.find(e => e.event === 'reaction-received')).toBeTruthy();
      expect(emitted.find(e => e.event === 'typing-indicator')).toBeTruthy();
    });

    it('shows raw message when no tags', () => {
      const { ctx } = createMockCtx();
      handleTAGMSG(ctx, 'dan!u@h', ['#chan'], Date.now());

      expect(ctx.addRawMessage).toHaveBeenCalled();
    });
  });
});

// ========================================
// NOTICE COMMAND HANDLER
// ========================================
describe('NoticeCommandHandlers', () => {
  it('creates notice message with sender info', () => {
    const { ctx, messages } = createMockCtx();
    handleNOTICE(ctx, 'server!s@host', ['tester', 'Welcome!'], Date.now());

    expect(messages[0].type).toBe('notice');
    expect(messages[0].from).toBe('server');
    expect(messages[0].text).toBe('Welcome!');
    expect(messages[0].command).toBe('NOTICE');
  });

  it('skips notice from ignored user', () => {
    const { ctx, messages } = createMockCtx();
    ctx.getUserManagementService.mockReturnValue({
      isUserIgnored: jest.fn(() => true),
      findMatchingBlacklistEntry: jest.fn(() => null),
    });

    handleNOTICE(ctx, 'spammer!user@host', ['tester', 'spam'], Date.now());

    expect(messages).toHaveLength(0);
  });

  it('handles CTCP PING reply in notice', () => {
    const { ctx, messages } = createMockCtx();
    const ts = Date.now() - 100;
    ctx.parseCTCP.mockReturnValue({ isCTCP: true, command: 'PING', args: ts.toString() });

    handleNOTICE(ctx, 'bob!u@h', ['tester', `\x01PING ${ts}\x01`], Date.now());

    expect(messages[0].text).toContain('PING reply');
  });

  it('handles CTCP VERSION reply in notice', () => {
    const { ctx, messages } = createMockCtx();
    ctx.parseCTCP.mockReturnValue({ isCTCP: true, command: 'VERSION', args: 'mIRC v7.69' });

    handleNOTICE(ctx, 'bob!u@h', ['tester', '\x01VERSION mIRC v7.69\x01'], Date.now());

    expect(messages[0].text).toContain('VERSION');
    expect(messages[0].text).toContain('mIRC v7.69');
  });

  it('passes meta tags to message', () => {
    const { ctx, messages } = createMockCtx();
    handleNOTICE(ctx, 'bob!u@h', ['#chan', 'hello'], Date.now(), {
      accountTag: 'bob_acct',
      msgidTag: 'msg123',
      batchTag: 'batch1',
    });

    expect(messages[0].account).toBe('bob_acct');
    expect(messages[0].msgid).toBe('msg123');
  });

  it('processes server notices without prefix user part', () => {
    const { ctx, messages } = createMockCtx();
    handleNOTICE(ctx, 'irc.server.com', ['*', 'Looking up your hostname'], Date.now());

    expect(messages[0].type).toBe('notice');
    expect(messages[0].from).toBe('irc.server.com');
  });
});

// ========================================
// PRIVMSG COMMAND HANDLER
// ========================================
describe('PrivmsgCommandHandlers', () => {
  it('creates channel message', () => {
    const { ctx, messages } = createMockCtx();
    handlePRIVMSG(ctx, 'alice!user@host', ['#chan', 'Hello world'], Date.now());

    expect(messages[0].type).toBe('message');
    expect(messages[0].channel).toBe('#chan');
    expect(messages[0].from).toBe('alice');
    expect(messages[0].text).toBe('Hello world');
    expect(messages[0].command).toBe('PRIVMSG');
  });

  it('creates DM message with sender as channel', () => {
    const { ctx, messages } = createMockCtx();
    handlePRIVMSG(ctx, 'alice!user@host', ['tester', 'Hi there'], Date.now());

    expect(messages[0].channel).toBe('alice');
  });

  it('routes self-sent DM to target nick', () => {
    const { ctx, messages } = createMockCtx();
    handlePRIVMSG(ctx, 'tester!user@host', ['alice', 'echo msg'], Date.now());

    expect(messages[0].channel).toBe('alice');
  });

  it('suppresses self-to-self echo in query', () => {
    const { ctx, messages } = createMockCtx();
    handlePRIVMSG(ctx, 'tester!user@host', ['tester', 'self msg'], Date.now());

    expect(messages).toHaveLength(0);
  });

  it('skips messages from ignored users', () => {
    const { ctx, messages } = createMockCtx({
      isUserIgnored: jest.fn(() => true),
    });
    handlePRIVMSG(ctx, 'spammer!spam@host', ['#chan', 'spam'], Date.now());

    expect(messages).toHaveLength(0);
  });

  it('routes CTCP requests', () => {
    const { ctx, messages } = createMockCtx();
    ctx.parseCTCP.mockReturnValue({ isCTCP: true, command: 'VERSION' });

    handlePRIVMSG(ctx, 'bob!u@h', ['tester', '\x01VERSION\x01'], Date.now());

    expect(ctx.handleCTCPRequest).toHaveBeenCalledWith('bob', 'tester', 'VERSION', undefined);
    expect(messages).toHaveLength(0);
  });

  it('displays CTCP ACTION as message instead of routing to CTCP handler', () => {
    const { ctx, messages } = createMockCtx();
    ctx.parseCTCP.mockReturnValue({ isCTCP: true, command: 'ACTION', args: 'does a dance' });

    handlePRIVMSG(ctx, 'bob!u@h', ['#chan', '\x01ACTION does a dance\x01'], Date.now());

    // ACTION should NOT call handleCTCPRequest - it should display as a message
    expect(ctx.handleCTCPRequest).not.toHaveBeenCalled();
    // ACTION should be added as a message
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('message');
    expect(messages[0].from).toBe('bob');
    expect(messages[0].channel).toBe('#chan');
    expect(messages[0].text).toBe('\x01ACTION does a dance\x01');
  });

  it('displays CTCP ACTION in query window', () => {
    const { ctx, messages } = createMockCtx();
    ctx.parseCTCP.mockReturnValue({ isCTCP: true, command: 'ACTION', args: 'waves hello' });

    handlePRIVMSG(ctx, 'alice!u@h', ['tester', '\x01ACTION waves hello\x01'], Date.now());

    // ACTION should NOT call handleCTCPRequest
    expect(ctx.handleCTCPRequest).not.toHaveBeenCalled();
    // ACTION should be added as a message in query window (channel = sender)
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('message');
    expect(messages[0].from).toBe('alice');
    expect(messages[0].channel).toBe('alice'); // query window uses sender's nick
  });

  it('ignores empty/invalid targets', () => {
    const { ctx, messages } = createMockCtx();
    handlePRIVMSG(ctx, 'alice!u@h', ['*', 'test'], Date.now());
    expect(messages).toHaveLength(0);

    handlePRIVMSG(ctx, 'alice!u@h', ['', 'test'], Date.now());
    expect(messages).toHaveLength(0);
  });

  it('strips ZNC playback timestamps', () => {
    const { ctx, messages } = createMockCtx();
    handlePRIVMSG(ctx, 'alice!u@h', ['#chan', '[12:34:56] Hello from ZNC'], Date.now());

    expect(messages[0].text).toBe('Hello from ZNC');
  });

  it('passes meta tags through', () => {
    const { ctx, messages } = createMockCtx();
    handlePRIVMSG(ctx, 'alice!u@h', ['#chan', 'test'], Date.now(), {
      accountTag: 'alice_acct',
      msgidTag: 'mid-1',
      channelContextTag: '#other',
      replyTag: 'ref-mid',
      reactTag: 'mid;👍',
    });

    expect(messages[0].account).toBe('alice_acct');
    expect(messages[0].msgid).toBe('mid-1');
    expect(messages[0].channelContext).toBe('#other');
    expect(messages[0].replyTo).toBe('ref-mid');
    expect(messages[0].reactions).toBe('mid;👍');
  });

  it('includes username and hostname from prefix', () => {
    const { ctx, messages } = createMockCtx();
    handlePRIVMSG(ctx, 'alice!auser@some.host.com', ['#chan', 'msg'], Date.now());

    expect(messages[0].username).toBe('auser');
    expect(messages[0].hostname).toBe('some.host.com');
  });

  it('handles encryption protocol messages (enc-reject)', () => {
    const { ctx, messages } = createMockCtx();
    handlePRIVMSG(ctx, 'bob!u@h', ['tester', '!enc-reject'], Date.now());

    // enc-reject is handled by encryption protocol - should show notice
    expect(messages[0].type).toBe('notice');
    expect(messages[0].text).toContain('rejected');
  });

  it('blocks messages based on protection decision', () => {
    const { ctx, messages } = createMockCtx({
      evaluateProtectionDecision: jest.fn(() => ({ kind: 'flood' })),
    });
    handlePRIVMSG(ctx, 'flood!u@h', ['#chan', 'spam spam'], Date.now());

    expect(ctx.handleProtectionBlock).toHaveBeenCalledWith('flood', 'flood', 'u', 'h', '#chan');
    expect(messages).toHaveLength(0);
  });
});
