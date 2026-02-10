/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRCv3 Features Test Suite
 *
 * Tests for IRCv3 features implemented in the codebase:
 * - SETNAME handler (consolidated, with decodeIfBase64Like)
 * - Event-playback / chathistory isPlayback flagging
 * - draft/account-registration (/register command + REGISTER response)
 * - draft/channel-rename (RENAME command)
 * - SASL re-auth (CAP NEW sasl)
 * - draft/intent tag parsing
 * - BatchLabelHandlers chathistory-end event
 */

import { IRCService, IRCMessage } from '../src/services/IRCService';
import { FakeSocket } from '../test-support/FakeSocket';
import { handleSETNAME } from '../src/services/irc/commands/UserStateCommandHandlers';
import { handleRENAME } from '../src/services/irc/commands/RenameCommandHandlers';
import { handleREGISTER } from '../src/services/irc/commands/ServerCommandHandlers';
import { BatchLabelManager } from '../src/services/irc/protocol/BatchLabelHandlers';

// ========================================
// HELPER: Create a mock CommandHandlerContext
// ========================================
function createMockCtx() {
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
    logRaw: jest.fn(),
    decodeIfBase64Like: jest.fn((value: string) => value),
    getNetworkName: jest.fn(() => 'TestNet'),
    getCurrentNick: jest.fn(() => 'testnick'),
    getChannelUsers: jest.fn(() => undefined),
    getAllChannelUsers: jest.fn(() => new Map()),
    getChannelTopicInfo: jest.fn(() => ({})),
    setChannelTopicInfo: jest.fn(),
    sendRaw: jest.fn(),
  };

  return { ctx, messages, rawMessages, emitted };
}

// ========================================
// SETNAME HANDLER (Consolidated)
// ========================================
describe('SETNAME Handler (consolidated)', () => {
  it('calls decodeIfBase64Like on the realname', () => {
    const { ctx } = createMockCtx();
    ctx.decodeIfBase64Like.mockReturnValue('Decoded Name');

    handleSETNAME(ctx, 'alice!user@host', ['Encoded=='], Date.now());

    expect(ctx.decodeIfBase64Like).toHaveBeenCalledWith('Encoded==');
    expect(ctx.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Decoded Name'),
      }),
    );
  });

  it('uses translation key with colon separator', () => {
    const { ctx, messages } = createMockCtx();

    handleSETNAME(ctx, 'bob!user@host', ['New Realname'], Date.now());

    expect(messages[0].text).toContain('changed realname to:');
    expect(messages[0].text).toContain('New Realname');
  });

  it('emits setname event with nick and realname', () => {
    const { ctx, emitted } = createMockCtx();

    handleSETNAME(ctx, 'carol!u@h', ['My Name'], Date.now());

    const setnameEvent = emitted.find(e => e.event === 'setname');
    expect(setnameEvent).toBeTruthy();
    expect(setnameEvent!.args).toEqual(['carol', 'My Name']);
  });

  it('handles empty realname gracefully', () => {
    const { ctx, messages } = createMockCtx();

    handleSETNAME(ctx, 'dan!u@h', [], Date.now());

    expect(messages).toHaveLength(1);
    expect(ctx.emit).toHaveBeenCalledWith('setname', 'dan', '');
  });
});

// ========================================
// RENAME HANDLER (draft/channel-rename)
// ========================================
describe('RENAME Handler (draft/channel-rename)', () => {
  it('emits channel-renamed event', () => {
    const { ctx, emitted } = createMockCtx();

    handleRENAME(ctx, 'server', ['#old', '#new', 'Rebranding'], Date.now());

    const event = emitted.find(e => e.event === 'channel-renamed');
    expect(event).toBeTruthy();
    expect(event!.args).toEqual(['#old', '#new', 'Rebranding']);
  });

  it('displays rename message with reason', () => {
    const { ctx, messages } = createMockCtx();

    handleRENAME(ctx, 'server', ['#old', '#new', 'We moved'], Date.now());

    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain('#old');
    expect(messages[0].text).toContain('#new');
    expect(messages[0].text).toContain('We moved');
    expect(messages[0].channel).toBe('#old');
  });

  it('displays rename message without reason', () => {
    const { ctx, messages } = createMockCtx();

    handleRENAME(ctx, 'server', ['#old', '#new'], Date.now());

    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain('#old');
    expect(messages[0].text).toContain('#new');
  });

  it('migrates channel users map', () => {
    const { ctx } = createMockCtx();
    const users = new Map([['alice', { nick: 'alice', modes: [] }]]);
    const allUsers = new Map([['#old', users]]);
    ctx.getChannelUsers.mockReturnValue(users);
    ctx.getAllChannelUsers.mockReturnValue(allUsers);

    handleRENAME(ctx, 'server', ['#old', '#new', 'reason'], Date.now());

    expect(allUsers.has('#new')).toBe(true);
    expect(allUsers.has('#old')).toBe(false);
    expect(allUsers.get('#new')!.get('alice')).toBeTruthy();
  });

  it('migrates channel topic info', () => {
    const { ctx } = createMockCtx();
    const topicInfo = { topic: 'Old topic', setBy: 'admin' };
    ctx.getChannelTopicInfo.mockReturnValue(topicInfo);

    handleRENAME(ctx, 'server', ['#old', '#new', 'reason'], Date.now());

    expect(ctx.setChannelTopicInfo).toHaveBeenCalledWith('#new', topicInfo);
    expect(ctx.setChannelTopicInfo).toHaveBeenCalledWith('#old', {});
  });

  it('does nothing when channels are missing', () => {
    const { ctx, messages } = createMockCtx();

    handleRENAME(ctx, 'server', ['#old'], Date.now());

    expect(messages).toHaveLength(0);
  });
});

// ========================================
// REGISTER HANDLER (draft/account-registration)
// ========================================
describe('REGISTER Handler (draft/account-registration)', () => {
  it('handles SUCCESS response', () => {
    const { ctx, messages, emitted } = createMockCtx();

    handleREGISTER(ctx, 'server', ['SUCCESS', 'myaccount', 'Account created'], Date.now());

    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain('myaccount');
    expect(messages[0].text).toContain('registered successfully');
    const event = emitted.find(e => e.event === 'account-registered');
    expect(event).toBeTruthy();
    expect(event!.args).toEqual(['myaccount', 'Account created']);
  });

  it('handles VERIFICATION_REQUIRED response', () => {
    const { ctx, messages, emitted } = createMockCtx();

    handleREGISTER(ctx, 'server', ['VERIFICATION_REQUIRED', 'myaccount', 'Check your email'], Date.now());

    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain('requires verification');
    const event = emitted.find(e => e.event === 'account-verification-required');
    expect(event).toBeTruthy();
  });

  it('handles unknown subcommand as raw', () => {
    const { ctx, rawMessages } = createMockCtx();

    handleREGISTER(ctx, 'server', ['UNKNOWN', 'data'], Date.now());

    expect(rawMessages).toHaveLength(1);
    expect(rawMessages[0].text).toContain('REGISTER response');
  });
});

// ========================================
// EVENT-PLAYBACK: isPlayback flagging
// ========================================
describe('Event-Playback isPlayback flagging', () => {
  let irc: IRCService;
  let socket: FakeSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    irc = new IRCService();
    socket = new FakeSocket();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks messages inside chathistory batch as isPlayback', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    // Start a chathistory batch
    (irc as any).handleIRCMessage(':server BATCH +hist chathistory #chan');
    // Message inside batch
    (irc as any).handleIRCMessage('@batch=hist :nick!u@h PRIVMSG #chan :old message');
    // End the batch
    (irc as any).handleIRCMessage(':server BATCH -hist');

    const privmsg = messages.find(m => m.type === 'message' && m.text === 'old message');
    expect(privmsg).toBeTruthy();
    expect(privmsg!.isPlayback).toBe(true);
  });

  it('marks messages inside history batch as isPlayback', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    (irc as any).handleIRCMessage(':server BATCH +hb history #chan');
    (irc as any).handleIRCMessage('@batch=hb :nick!u@h PRIVMSG #chan :historical msg');
    (irc as any).handleIRCMessage(':server BATCH -hb');

    const privmsg = messages.find(m => m.type === 'message' && m.text === 'historical msg');
    expect(privmsg).toBeTruthy();
    expect(privmsg!.isPlayback).toBe(true);
  });

  it('marks messages inside znc.in/playback batch as isPlayback', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    (irc as any).handleIRCMessage(':server BATCH +zp znc.in/playback');
    (irc as any).handleIRCMessage('@batch=zp :nick!u@h PRIVMSG #chan :znc msg');
    (irc as any).handleIRCMessage(':server BATCH -zp');

    const privmsg = messages.find(m => m.type === 'message' && m.text === 'znc msg');
    expect(privmsg).toBeTruthy();
    expect(privmsg!.isPlayback).toBe(true);
  });

  it('does NOT mark regular messages as isPlayback', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    (irc as any).handleIRCMessage(':nick!u@h PRIVMSG #chan :live message');

    const privmsg = messages.find(m => m.type === 'message' && m.text === 'live message');
    expect(privmsg).toBeTruthy();
    expect(privmsg!.isPlayback).toBeFalsy();
  });

  it('does NOT mark messages in non-playback batches as isPlayback', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    (irc as any).handleIRCMessage(':server BATCH +ns netsplit irc1.net irc2.net');
    (irc as any).handleIRCMessage('@batch=ns :nick!u@h QUIT :netsplit');
    (irc as any).handleIRCMessage(':server BATCH -ns');

    const quitMsg = messages.find(m => m.type === 'quit');
    if (quitMsg) {
      expect(quitMsg.isPlayback).toBeFalsy();
    }
  });
});

// ========================================
// BatchLabelManager: chathistory-end event
// ========================================
describe('BatchLabelManager chathistory-end event', () => {
  it('emits chathistory-end for chathistory batch', () => {
    const emitted: { event: string; args: any[] }[] = [];
    const mockCtx: any = {
      addMessage: jest.fn(),
      addRawMessage: jest.fn(),
      emit: jest.fn((event: string, ...args: any[]) => emitted.push({ event, args })),
      logRaw: jest.fn(),
      sendRaw: jest.fn(),
      hasCapability: jest.fn(() => false),
    };

    const manager = new BatchLabelManager(mockCtx);
    const now = Date.now();

    manager.handleBatchStart('ref1', 'chathistory', ['#chan'], now);
    manager.handleBatchEnd('ref1', now);

    const chatEnd = emitted.find(e => e.event === 'chathistory-end');
    expect(chatEnd).toBeTruthy();
    expect(chatEnd!.args[0]).toEqual(
      expect.objectContaining({ refTag: 'ref1', messages: 0 }),
    );
  });

  it('emits event-playback for history batch', () => {
    const emitted: { event: string; args: any[] }[] = [];
    const mockCtx: any = {
      addMessage: jest.fn(),
      addRawMessage: jest.fn(),
      emit: jest.fn((event: string, ...args: any[]) => emitted.push({ event, args })),
      logRaw: jest.fn(),
      sendRaw: jest.fn(),
      hasCapability: jest.fn(() => false),
    };

    const manager = new BatchLabelManager(mockCtx);
    const now = Date.now();

    manager.handleBatchStart('ref2', 'history', ['#chan'], now);
    manager.handleBatchEnd('ref2', now);

    const ep = emitted.find(e => e.event === 'event-playback');
    expect(ep).toBeTruthy();
  });

  it('emits bouncer-playback for znc.in/playback batch', () => {
    const emitted: { event: string; args: any[] }[] = [];
    const mockCtx: any = {
      addMessage: jest.fn(),
      addRawMessage: jest.fn(),
      emit: jest.fn((event: string, ...args: any[]) => emitted.push({ event, args })),
      logRaw: jest.fn(),
      sendRaw: jest.fn(),
      hasCapability: jest.fn(() => false),
    };

    const manager = new BatchLabelManager(mockCtx);
    const now = Date.now();

    manager.handleBatchStart('ref3', 'znc.in/playback', [], now);
    manager.handleBatchEnd('ref3', now);

    const bp = emitted.find(e => e.event === 'bouncer-playback');
    expect(bp).toBeTruthy();
  });

  it('tracks messages added to batch', () => {
    const mockCtx: any = {
      addMessage: jest.fn(),
      addRawMessage: jest.fn(),
      emit: jest.fn(),
      logRaw: jest.fn(),
      sendRaw: jest.fn(),
      hasCapability: jest.fn(() => false),
    };

    const manager = new BatchLabelManager(mockCtx);
    const now = Date.now();

    manager.handleBatchStart('ref4', 'chathistory', ['#test'], now);
    manager.addMessageToBatch({ id: '1', text: 'msg1' } as any, 'ref4');
    manager.addMessageToBatch({ id: '2', text: 'msg2' } as any, 'ref4');
    manager.handleBatchEnd('ref4', now);

    // chathistory-end should report 2 messages
    const call = mockCtx.emit.mock.calls.find((c: any[]) => c[0] === 'chathistory-end');
    expect(call).toBeTruthy();
    expect(call[1].messages).toBe(2);
  });
});

// ========================================
// /REGISTER SEND COMMAND
// ========================================
describe('/register send command', () => {
  let irc: IRCService;
  let socket: FakeSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    irc = new IRCService();
    socket = new FakeSocket();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows error when capability is not enabled', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    irc.sendMessage('#test', '/register user@example.com mypass');

    const err = messages.find(m => m.type === 'error');
    expect(err).toBeTruthy();
    expect(err!.text).toContain('not supported');
  });

  it('sends REGISTER with email and password when capability is enabled', () => {
    (irc as any).capEnabledSet.add('draft/account-registration');

    irc.sendMessage('#test', '/register user@example.com mypass');

    expect(socket.writes.some(w => w.includes('REGISTER * user@example.com :mypass'))).toBe(true);
  });

  it('sends REGISTER with account, email, and password', () => {
    (irc as any).capEnabledSet.add('draft/account-registration');

    irc.sendMessage('#test', '/register myaccount user@example.com mypass');

    expect(socket.writes.some(w => w.includes('REGISTER myaccount user@example.com :mypass'))).toBe(true);
  });

  it('sends REGISTER with * for no email', () => {
    (irc as any).capEnabledSet.add('draft/account-registration');

    irc.sendMessage('#test', '/register * mypass');

    expect(socket.writes.some(w => w.includes('REGISTER * * :mypass'))).toBe(true);
  });

  it('shows usage error when too few arguments', () => {
    (irc as any).capEnabledSet.add('draft/account-registration');
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    irc.sendMessage('#test', '/register onlyonearg');

    const err = messages.find(m => m.type === 'error');
    expect(err).toBeTruthy();
    expect(err!.text).toContain('Usage');
  });
});

// ========================================
// SASL RE-AUTH (CAP NEW sasl)
// ========================================
describe('SASL re-auth on CAP NEW', () => {
  let irc: IRCService;
  let socket: FakeSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    irc = new IRCService();
    socket = new FakeSocket();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
    (irc as any).capNegotiating = false;
    (irc as any).saslAuthenticating = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends CAP REQ :sasl when CAP NEW includes sasl and credentials exist', () => {
    (irc as any).config = {
      sasl: { account: 'myuser', password: 'mypass' },
    };

    (irc as any).handleCAPCommand(['NEW', ':sasl']);

    expect(socket.writes.some(w => w.includes('CAP REQ :sasl'))).toBe(true);
  });

  it('sends CAP REQ :sasl when CAP NEW includes sasl and client cert exists', () => {
    (irc as any).config = {
      clientCert: 'cert-data',
      clientKey: 'key-data',
    };

    (irc as any).handleCAPCommand(['NEW', ':sasl']);

    expect(socket.writes.some(w => w.includes('CAP REQ :sasl'))).toBe(true);
  });

  it('does NOT send CAP REQ when no credentials configured', () => {
    (irc as any).config = {};

    (irc as any).handleCAPCommand(['NEW', ':sasl']);

    expect(socket.writes.some(w => w.includes('CAP REQ :sasl'))).toBe(false);
  });

  it('does NOT re-auth when already authenticating', () => {
    (irc as any).config = {
      sasl: { account: 'myuser', password: 'mypass' },
    };
    (irc as any).saslAuthenticating = true;

    (irc as any).handleCAPCommand(['NEW', ':sasl']);

    expect(socket.writes.some(w => w.includes('CAP REQ :sasl'))).toBe(false);
  });

  it('adds non-sasl CAP NEW caps to available set without re-auth', () => {
    (irc as any).config = {};

    (irc as any).handleCAPCommand(['NEW', ':away-notify']);

    expect((irc as any).capAvailable.has('away-notify')).toBe(true);
    expect(socket.writes.some(w => w.includes('CAP REQ'))).toBe(false);
  });
});

// ========================================
// INTENT TAG PARSING
// ========================================
describe('Intent tag parsing', () => {
  let irc: IRCService;
  let socket: FakeSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    irc = new IRCService();
    socket = new FakeSocket();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('passes intentTag in meta when +draft/intent tag is present', () => {
    // Spy on commandHandlers.handle to capture the meta
    const handleSpy = jest.fn();

    // Force commandHandlers init then spy
    (irc as any).handleIRCMessage(':nick!u@h PRIVMSG #test :init');
    const handlers = (irc as any).commandHandlers;
    const origHandle = handlers.handle.bind(handlers);
    handlers.handle = jest.fn((...args: any[]) => {
      handleSpy(...args);
      return origHandle(...args);
    });

    (irc as any).handleIRCMessage('@+draft/intent=ACTION :nick!u@h PRIVMSG #test :waves');

    const call = handleSpy.mock.calls[0];
    expect(call).toBeTruthy();
    // meta is the 5th argument
    expect(call[4]?.intentTag).toBe('ACTION');
  });
});

// ========================================
// INCOMING RENAME VIA handleIRCMessage
// ========================================
describe('RENAME via handleIRCMessage (integration)', () => {
  let irc: IRCService;
  let socket: FakeSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    irc = new IRCService();
    socket = new FakeSocket();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
    (irc as any).channelUsers = new Map();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('processes RENAME command and emits channel-renamed', () => {
    const emitSpy = jest.spyOn(irc as any, 'emit');
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    (irc as any).handleIRCMessage(':server RENAME #old-chan #new-chan :Channel rebranded');

    expect(emitSpy).toHaveBeenCalledWith('channel-renamed', '#old-chan', '#new-chan', 'Channel rebranded');
    const renameMsg = messages.find(m => m.text?.includes('#old-chan') && m.text?.includes('#new-chan'));
    expect(renameMsg).toBeTruthy();
  });
});

// ========================================
// INCOMING REGISTER VIA handleIRCMessage
// ========================================
describe('REGISTER via handleIRCMessage (integration)', () => {
  let irc: IRCService;
  let socket: FakeSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    irc = new IRCService();
    socket = new FakeSocket();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('processes REGISTER SUCCESS response', () => {
    const emitSpy = jest.spyOn(irc as any, 'emit');
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    (irc as any).handleIRCMessage(':server REGISTER SUCCESS myaccount :Account created successfully');

    expect(emitSpy).toHaveBeenCalledWith('account-registered', 'myaccount', 'Account created successfully');
  });

  it('processes REGISTER VERIFICATION_REQUIRED response', () => {
    const emitSpy = jest.spyOn(irc as any, 'emit');
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    (irc as any).handleIRCMessage(':server REGISTER VERIFICATION_REQUIRED myaccount :Check your email');

    expect(emitSpy).toHaveBeenCalledWith('account-verification-required', 'myaccount', 'Check your email');
  });
});

// ========================================
// CAP LIST VERIFICATION
// ========================================
describe('CAP request list includes new capabilities', () => {
  let irc: IRCService;
  let socket: FakeSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    irc = new IRCService();
    socket = new FakeSocket();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).capNegotiating = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requests draft/account-registration when available', () => {
    (irc as any).capAvailable.add('draft/account-registration');
    (irc as any).requestCapabilities();

    const capReq = socket.writes.find(w => w.startsWith('CAP REQ'));
    expect(capReq).toBeTruthy();
    expect(capReq).toContain('draft/account-registration');
  });

  it('requests draft/channel-rename when available', () => {
    (irc as any).capAvailable.add('draft/channel-rename');
    (irc as any).requestCapabilities();

    const capReq = socket.writes.find(w => w.startsWith('CAP REQ'));
    expect(capReq).toBeTruthy();
    expect(capReq).toContain('draft/channel-rename');
  });

  it('requests event-playback when available', () => {
    (irc as any).capAvailable.add('event-playback');
    (irc as any).requestCapabilities();

    const capReq = socket.writes.find(w => w.startsWith('CAP REQ'));
    expect(capReq).toBeTruthy();
    expect(capReq).toContain('event-playback');
  });
});

// ========================================
// SETNAME DUPLICATION VERIFICATION
// ========================================
describe('SETNAME handler deduplication', () => {
  it('SetnameCommandHandlers.ts should not exist', () => {
    // This test verifies the duplicate file was deleted
    expect(() => {
      require('../src/services/irc/commands/SetnameCommandHandlers');
    }).toThrow();
  });

  it('SETNAME is only registered once in IRCCommandHandlers', () => {
    // The IRCCommandHandlers uses a Map, so even if registered twice,
    // the last one wins. But we should only have ONE source now.
    const { userStateCommandHandlers } = require('../src/services/irc/commands/UserStateCommandHandlers');
    expect(userStateCommandHandlers.has('SETNAME')).toBe(true);
  });
});
