/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const mockConnectionManagerGetAllConnections = jest.fn(() => []);
jest.mock('../src/services/IRCForegroundService', () => ({
  ircForegroundService: {
    isServiceRunning: jest.fn(() => false),
    start: jest.fn(() => Promise.resolve()),
    updateNotification: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../src/services/ConnectionManager', () => ({
  connectionManager: {
    getAllConnections: (...args: any[]) =>
      mockConnectionManagerGetAllConnections(...args),
  },
}));

import { IRCService, IRCMessage } from '../src/services/IRCService';
import { DEFAULT_QUIT_MESSAGE } from '../src/services/SettingsService';
import { FakeSocket } from '../test-support/FakeSocket';
const {
  ircForegroundService: mockFgService,
} = require('../src/services/IRCForegroundService');

describe('IRCService command helpers', () => {
  let irc: IRCService;
  let socket: FakeSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    irc = new IRCService();
    socket = new FakeSocket();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends CTCP requests', () => {
    irc.sendCTCPRequest('bob', 'PING', '123');
    expect(
      socket.writes.find(w => w.includes('PRIVMSG bob :\u0001PING 123\u0001')),
    ).toBeTruthy();
  });

  it('sends monitor add/remove when capability is enabled', () => {
    (irc as any).capEnabledSet.add('monitor');

    irc.monitorNick('alice');
    irc.unmonitorNick('alice');

    expect(socket.writes.some(w => w.includes('MONITOR + alice'))).toBe(true);
    expect(socket.writes.some(w => w.includes('MONITOR - alice'))).toBe(true);
    expect(irc.isMonitoring('alice')).toBe(false);
  });

  it('sends extended MONITOR status, list, and clear commands', () => {
    (irc as any).capEnabledSet.add('monitor');

    irc.monitorNick('alice');
    irc.requestMonitorStatus();
    irc.listMonitorEntries();
    irc.clearMonitorList();

    expect(socket.writes.some(w => w.includes('MONITOR S'))).toBe(true);
    expect(socket.writes.some(w => w.includes('MONITOR L'))).toBe(true);
    expect(socket.writes.some(w => w.includes('MONITOR C'))).toBe(true);
    expect(irc.isMonitoring('alice')).toBe(false);
  });

  it('routes /me to CTCP ACTION and adds sent message', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    irc.sendMessage('#room', '/me waves');

    expect(
      socket.writes.some(w =>
        w.includes('PRIVMSG #room :\u0001ACTION waves\u0001'),
      ),
    ).toBe(true);
    const action = messages.find(m => m.type === 'message');
    expect(action?.text).toContain('ACTION waves');
    expect(action?.status).toBe('sent');
  });

  it('buffers messages and emits queue event when offline', () => {
    const offline = new IRCService();
    const queueSpy = jest.fn();
    offline.on('queue-message', queueSpy);

    offline.sendMessage('#chan', 'hello');

    expect(queueSpy).toHaveBeenCalledWith('', '#chan', 'hello');

    const received: IRCMessage[] = [];
    offline.onMessage(msg => received.push(msg));
    const pending = received.find(m => m.type === 'message');
    expect(pending?.text).toBe('hello');
    expect(pending?.status).toBe('pending');
  });

  it('uses default quit message when disconnecting without custom text', () => {
    irc.disconnect();
    expect(
      socket.writes.some(w => w.includes(`QUIT :${DEFAULT_QUIT_MESSAGE}`)),
    ).toBe(true);
  });

  it('flushes buffered messages once a listener is attached', () => {
    const idle = new IRCService();
    idle.addRawMessage('*** early');

    const received: IRCMessage[] = [];
    idle.onMessage(msg => received.push(msg));

    const backlog = received.find(m => m.text.includes('early'));
    expect(backlog?.type).toBe('raw');
  });

  it('replays buffered connection events when listener attaches late', () => {
    const late = new IRCService();
    (late as any).emitConnection(true);

    const status: boolean[] = [];
    late.onConnectionChange(conn => status.push(conn));

    expect(status).toEqual([true]);
  });

  it('updates foreground notification for single and multi-network scenarios', () => {
    const statuses: boolean[] = [];
    irc.onConnectionChange(v => statuses.push(v));

    // Single active network, service stopped -> start
    mockConnectionManagerGetAllConnections.mockReturnValue([
      { networkId: 'NetA', ircService: { getConnectionStatus: () => true } },
    ]);
    (mockFgService.isServiceRunning as jest.Mock).mockReturnValue(false);
    (irc as any).emitConnection(true);
    expect(mockFgService.start).toHaveBeenCalled();

    // Multiple active networks, service running -> update
    mockConnectionManagerGetAllConnections.mockReturnValue([
      { networkId: 'NetA', ircService: { getConnectionStatus: () => true } },
      { networkId: 'NetB', ircService: { getConnectionStatus: () => true } },
      { networkId: 'NetC', ircService: { getConnectionStatus: () => true } },
      { networkId: 'NetD', ircService: { getConnectionStatus: () => true } },
    ]);
    (mockFgService.isServiceRunning as jest.Mock).mockReturnValue(true);
    (irc as any).emitConnection(true);
    expect(mockFgService.updateNotification).toHaveBeenCalled();

    // No active connections on disconnect -> stop
    mockConnectionManagerGetAllConnections.mockReturnValue([]);
    (irc as any).emitConnection(false);
    expect(mockFgService.stop).toHaveBeenCalled();
    expect(statuses).toEqual([true, true, false]);
  });

  it('responds to incoming CTCP PING', () => {
    (irc as any).isConnected = true;
    (irc as any).handleIRCMessage(
      ':bob!user@host PRIVMSG tester :\x01PING 123\x01',
    );

    expect(
      socket.writes.some(w => w.includes('NOTICE bob :\u0001PING 123\u0001')),
    ).toBe(true);
  });

  it('sends plain messages when connected', () => {
    irc.sendMessage('#chan', 'hi there');

    expect(socket.writes.some(w => w.includes('PRIVMSG #chan :hi there'))).toBe(
      true,
    );
  });

  it('uses multiline sender when message contains newlines', () => {
    const multiSpy = jest.spyOn(irc, 'sendMultilineMessage');

    irc.sendMessage('#chan', 'line one\r\nline two');

    expect(multiSpy).toHaveBeenCalledWith('#chan', 'line one\nline two');
    // No BATCH is built, so no multiline tags go out without one.
    expect(socket.writes.some(w => w.includes('draft/multiline-concat'))).toBe(
      false,
    );
    expect(socket.writes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('PRIVMSG #chan :line one'),
        expect.stringContaining('PRIVMSG #chan :line two'),
      ]),
    );
    multiSpy.mockRestore();
  });

  it('uses multiline sender for tagged messages with newlines', () => {
    const multiSpy = jest.spyOn(irc, 'sendMultilineMessage');

    irc.sendMessageWithTags('#chan', 'alpha\nbeta', { replyTo: 'msgid123' });

    expect(multiSpy).toHaveBeenCalledWith('#chan', 'alpha\nbeta', {
      replyTo: 'msgid123',
    });
    expect(socket.writes.some(w => w.includes('draft/multiline-concat'))).toBe(
      false,
    );
    multiSpy.mockRestore();
  });

  it('supports /msg and reports usage errors', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    irc.sendMessage('#chan', '/msg bob hello');
    expect(socket.writes.some(w => w.includes('PRIVMSG bob :hello'))).toBe(
      true,
    );

    irc.sendMessage('#chan', '/msg onlynick');
    const err = messages.find(m => m.type === 'error');
    expect(err?.text).toContain('Usage: /MSG');
  });

  it('does nothing for monitor toggle when capability not enabled', () => {
    irc.monitorNick('ghost');
    irc.unmonitorNick('ghost');
    expect(socket.writes.length).toBe(0);
    expect(irc.isMonitoring('ghost')).toBe(false);
  });

  it('handles CAP NAK by clearing requested caps', () => {
    (irc as any).capNegotiating = true;
    (irc as any).capRequested.add('message-tags');

    (irc as any).handleCAPCommand(['NAK', 'message-tags']);
    expect((irc as any).capRequested.has('message-tags')).toBe(false);
    expect(socket.writes.some(w => w.startsWith('CAP END'))).toBe(true);
  });

  it('provides usage errors for encryption commands', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    irc.sendMessage('#chan', '/encmsg');
    irc.sendMessage('#chan', '/chankey');

    const errors = messages.filter(m => m.type === 'error');
    expect(errors.some(e => e.text.includes('Usage: /encmsg'))).toBe(true);
    expect(errors.some(e => e.text.includes('/chankey'))).toBe(true);
  });

  it('tracks channel users on JOIN/PART and clears on QUIT', () => {
    const events: IRCMessage[] = [];
    irc.onMessage(m => events.push(m));

    (irc as any).handleIRCMessage(':alice!user@host JOIN #room');
    expect((irc as any).channelUsers.get('#room').get('alice')).toBeTruthy();

    (irc as any).handleIRCMessage(':alice!user@host PART #room :bye');
    expect((irc as any).channelUsers.get('#room')?.has('alice')).toBe(false);
    const partMsg = events.find(m => m.type === 'part');
    expect(partMsg?.text).toContain('bye');

    // Re-add and then quit
    (irc as any).handleIRCMessage(':alice!user@host JOIN #room');
    (irc as any).handleIRCMessage(':alice!user@host QUIT :lost link');
    expect((irc as any).channelUsers.get('#room')?.has('alice')).toBe(false);
  });

  it('stores account info when extended-join is enabled', () => {
    (irc as any).extendedJoin = true;
    (irc as any).handleIRCMessage(':carol!user@host JOIN #chan account-name');

    const user = (irc as any).channelUsers.get('#chan').get('carol');
    expect(user?.account).toBe('account-name');
  });

  it('setRealname sends SETNAME when capability is enabled and shows error otherwise', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    (irc as any).capEnabledSet.add('setname');
    irc.setRealname('New Realname');
    expect(socket.writes.some(w => w.includes('SETNAME :New Realname'))).toBe(
      true,
    );

    (irc as any).capEnabledSet.delete('setname');
    irc.setRealname('Another Name');
    expect(
      messages.some(m => m.type === 'error' && m.text.includes('SETNAME')),
    ).toBe(true);
  });

  it('toggleBotMode sends MODE when supported and error when unsupported', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    (irc as any).capEnabledSet.add('bot');
    irc.toggleBotMode(true);
    irc.toggleBotMode(false);
    expect(socket.writes.some(w => w.includes('MODE tester +B'))).toBe(true);
    expect(socket.writes.some(w => w.includes('MODE tester -B'))).toBe(true);

    (irc as any).capEnabledSet.delete('bot');
    irc.toggleBotMode(true);
    expect(
      messages.some(m => m.type === 'error' && m.text.includes('BOT mode')),
    ).toBe(true);
  });

  it('requestChatHistory sends command when supported and emits error when unsupported', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    (irc as any).capEnabledSet.add('chathistory');
    irc.requestChatHistory('#room', 50, 'msgid-1');
    expect(
      socket.writes.some(w =>
        w.includes('CHATHISTORY LATEST #room msgid=msgid-1 50'),
      ),
    ).toBe(true);

    (irc as any).capEnabledSet.delete('chathistory');
    irc.requestChatHistory('#room');
    expect(
      messages.some(m => m.type === 'error' && m.text.includes('CHATHISTORY')),
    ).toBe(true);
  });

  it('requestChatHistory supports BEFORE, AFTER, AROUND, BETWEEN, and TARGETS', () => {
    (irc as any).capEnabledSet.add('draft/chathistory');

    irc.requestChatHistory('#room', {
      subcommand: 'BEFORE',
      refType: 'timestamp',
      ref: 123,
      limit: 25,
    });
    irc.requestChatHistory('#room', {
      subcommand: 'AFTER',
      refType: 'msgid',
      ref: 'msg-1',
      limit: 10,
    });
    irc.requestChatHistory('#room', {
      subcommand: 'AROUND',
      refType: '*',
      limit: 5,
    });
    irc.requestChatHistory('#room', {
      subcommand: 'BETWEEN',
      refType: 'timestamp',
      ref: 100,
      secondRefType: 'timestamp',
      secondRef: 200,
      limit: 50,
    });
    irc.requestChatHistory('*', {
      subcommand: 'TARGETS',
      refType: '*',
      limit: 20,
    });

    expect(
      socket.writes.some(w =>
        w.includes(
          'CHATHISTORY BEFORE #room timestamp=1970-01-01T00:00:00.123Z 25',
        ),
      ),
    ).toBe(true);
    expect(
      socket.writes.some(w =>
        w.includes('CHATHISTORY AFTER #room msgid=msg-1 10'),
      ),
    ).toBe(true);
    expect(
      socket.writes.some(w => w.includes('CHATHISTORY AROUND #room * 5')),
    ).toBe(true);
    expect(
      socket.writes.some(w =>
        w.includes(
          'CHATHISTORY BETWEEN #room timestamp=1970-01-01T00:00:00.100Z timestamp=1970-01-01T00:00:00.200Z 50',
        ),
      ),
    ).toBe(true);
    expect(
      socket.writes.some(w => w.includes('CHATHISTORY TARGETS * * 20')),
    ).toBe(true);
  });

  it('sends pre-away commands only when draft/pre-away is enabled', () => {
    irc.sendPreAway('busy');
    expect(socket.writes.length).toBe(0);

    (irc as any).capEnabledSet.add('draft/pre-away');
    irc.sendPreAway();
    irc.sendPreAway('');
    irc.sendPreAway('back later');

    expect(socket.writes.some(w => w.includes('AWAY *'))).toBe(true);
    expect(socket.writes.some(w => w.trim() === 'AWAY')).toBe(true);
    expect(socket.writes.some(w => w.includes('AWAY :back later'))).toBe(true);
  });

  it('sends metadata commands and stores metadata events', () => {
    const metadataSpy = jest.fn();
    const deletedSpy = jest.fn();
    const subscriptionsSpy = jest.fn();
    const syncLaterSpy = jest.fn();
    irc.on('metadata', metadataSpy);
    irc.on('metadata-deleted', deletedSpy);
    irc.on('metadata-subscriptions', subscriptionsSpy);
    irc.on('metadata-sync-later', syncLaterSpy);
    (irc as any).capEnabledSet.add('draft/metadata-2');

    irc.requestMetadata('#room', ['url']);
    irc.requestMetadata('#room');
    irc.setMetadata('#room', 'url', 'https://example.test');
    irc.setMetadata('#room', 'url');
    irc.clearMetadata('#room');
    irc.syncMetadata('#room');
    irc.subscribeMetadata(['url', ' bot ']);
    irc.unsubscribeMetadata(['bot']);
    irc.listMetadataSubscriptions();

    expect(socket.writes.some(w => w.includes('METADATA #room GET url'))).toBe(
      true,
    );
    expect(socket.writes.some(w => w.includes('METADATA #room LIST'))).toBe(
      true,
    );
    expect(
      socket.writes.some(w =>
        w.includes('METADATA #room SET url :https://example.test'),
      ),
    ).toBe(true);
    expect(socket.writes.some(w => w.includes('METADATA #room SET url'))).toBe(
      true,
    );
    expect(socket.writes.some(w => w.includes('METADATA #room CLEAR'))).toBe(
      true,
    );
    expect(socket.writes.some(w => w.includes('METADATA #room SYNC'))).toBe(
      true,
    );
    expect(socket.writes.some(w => w.includes('METADATA * SUB url bot'))).toBe(
      true,
    );
    expect(socket.writes.some(w => w.includes('METADATA * UNSUB bot'))).toBe(
      true,
    );
    expect(socket.writes.some(w => w.includes('METADATA * SUBS'))).toBe(true);

    (irc as any).handleIRCMessage(
      ':server METADATA #room url * :https://example.test',
    );
    expect(irc.getMetadata('#room').url.value).toBe('https://example.test');
    expect(metadataSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        target: '#room',
        key: 'url',
        value: 'https://example.test',
      }),
    );

    (irc as any).handleNumericReply(761, 'server', [
      'tester',
      '#room',
      'topic',
      '*',
      'Channel topic',
    ]);
    expect(irc.getMetadata('#room').topic.value).toBe('Channel topic');

    (irc as any).handleNumericReply(770, 'server', ['tester', 'url', 'bot']);
    expect(irc.getMetadataSubscriptions()).toEqual(['bot', 'url']);
    expect(subscriptionsSpy).toHaveBeenCalledWith(['url', 'bot']);

    (irc as any).handleNumericReply(771, 'server', ['tester', 'bot']);
    expect(irc.getMetadataSubscriptions()).toEqual(['url']);

    (irc as any).handleNumericReply(766, 'server', ['tester', '#room', 'url']);
    expect(irc.getMetadata('#room').url).toBeUndefined();
    expect(deletedSpy).toHaveBeenCalledWith('#room', 'url');

    (irc as any).handleNumericReply(774, 'server', ['tester', '#room', '60']);
    expect(syncLaterSpy).toHaveBeenCalledWith('#room', 60);
  });

  it('emits network icon when draft/ICON ISUPPORT token is seen', () => {
    const iconSpy = jest.fn();
    irc.on('network-icon', iconSpy);

    irc.processISupport(['draft/ICON=https://example.test/icon.png']);

    expect(irc.getNetworkIconUrl()).toBe('https://example.test/icon.png');
    expect(iconSpy).toHaveBeenCalledWith('https://example.test/icon.png');
  });

  it('sendReadMarker and redactMessage send capability commands and events', () => {
    const emitSpy = jest.spyOn(irc as any, 'emit');
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    (irc as any).capEnabledSet.add('draft/read-marker');
    irc.sendReadMarker('#room', 123);
    expect(
      socket.writes.some(w =>
        w.includes('MARKREAD #room timestamp=1970-01-01T00:00:00.123Z'),
      ),
    ).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith('read-marker-sent', '#room', 123);

    (irc as any).capEnabledSet.add('draft/message-redaction');
    irc.redactMessage('#room', 'm-1');
    expect(socket.writes.some(w => w.includes('REDACT #room m-1'))).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith(
      'message-redacted-sent',
      '#room',
      'm-1',
    );

    (irc as any).capEnabledSet.delete('draft/message-redaction');
    irc.redactMessage('#room', 'm-2');
    expect(
      messages.some(
        m => m.type === 'error' && m.text.includes('MESSAGE-REDACTION'),
      ),
    ).toBe(true);
  });

  it('sendMessageWithTags and sendReaction include tags and emit local status', () => {
    const messages: IRCMessage[] = [];
    const emitSpy = jest.spyOn(irc as any, 'emit');
    irc.onMessage(m => messages.push(m));
    (irc as any).capEnabledSet.add('message-tags');

    irc.sendMessageWithTags('#room', 'hello', {
      channelContext: '#context',
      replyTo: 'msgid-9',
      typing: 'active',
    });
    expect(
      socket.writes.some(w =>
        w.includes(
          '@+draft/channel-context=#context;+reply=msgid-9;+typing=active PRIVMSG #room :hello',
        ),
      ),
    ).toBe(true);
    expect(
      messages.some(
        m =>
          m.channelContext === '#context' &&
          m.replyTo === 'msgid-9' &&
          m.typing === 'active',
      ),
    ).toBe(true);

    // client-tags/react.md: the parent goes in +reply, the reaction alone in
    // +draft/react.
    expect(irc.sendReaction('#room', 'msgid-9', ':+1:')).toBe(true);
    expect(
      socket.writes.some(w =>
        w.includes('@+reply=msgid-9;+draft/react=:+1: TAGMSG #room'),
      ),
    ).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith(
      'reaction-sent',
      '#room',
      'msgid-9',
      ':+1:',
      false,
    );
    expect(irc.sendReaction('#room', 'msgid-9', ':+1:', true)).toBe(true);
    expect(
      socket.writes.some(w =>
        w.includes('@+reply=msgid-9;+draft/unreact=:+1: TAGMSG #room'),
      ),
    ).toBe(true);
  });

  it('sends no client tags or TAGMSG without message-tags', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));
    irc.sendMessageWithTags('#room', 'hello', {
      replyTo: 'm1',
      typing: 'done',
    });
    expect(socket.writes.some(w => w.includes('PRIVMSG #room :hello'))).toBe(
      true,
    );
    expect(socket.writes.some(w => w.startsWith('@'))).toBe(false);
    expect(messages.find(m => m.text === 'hello')?.replyTo).toBeUndefined();
    expect(irc.sendReaction('#room', 'm1', 'x')).toBe(false);
    expect(irc.hasTypingCapability()).toBe(false);
  });

  it('does not send a reaction value that is not a reaction', () => {
    (irc as any).capEnabledSet.add('message-tags');
    expect(irc.sendReaction('#room', 'm1', 'x'.repeat(40))).toBe(false);
    expect(irc.sendReaction('#room', 'm1', 'a\r\nQUIT')).toBe(false);
    expect(socket.writes.some(w => w.includes('TAGMSG'))).toBe(false);
  });

  it('respects CLIENTTAGDENY for reactions and typing', () => {
    (irc as any).capEnabledSet.add('message-tags');
    (irc as any).clientTagDeny.add('draft/react');
    expect(irc.sendReaction('#room', 'm1', 'x')).toBe(false);
    expect(irc.sendReaction('#room', 'm1', 'x', true)).toBe(true);
    (irc as any).clientTagDeny.add('typing');
    expect(irc.hasTypingCapability()).toBe(false);
    (irc as any).isConnected = false;
    expect(irc.sendReaction('#room', 'm1', 'x', true)).toBe(false);
  });

  it('sendMultilineMessage sends and echoes every non-empty line', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    // Even when the server offers draft/multiline, lines go out plain.
    (irc as any).capEnabledSet.add('draft/multiline');
    irc.sendMultilineMessage('#room', 'a\n\nb');
    expect(socket.writes.some(w => w.includes('multiline'))).toBe(false);
    expect(socket.writes.some(w => w.includes('PRIVMSG #room :a'))).toBe(true);
    expect(socket.writes.some(w => w.includes('PRIVMSG #room :b'))).toBe(true);
    expect(
      messages
        .filter(m => m.type === 'message' && m.channel === '#room')
        .map(m => m.text),
    ).toEqual(['a', 'b']);
  });

  it('sendMultilineMessage does nothing while disconnected', () => {
    (irc as any).isConnected = false;
    irc.sendMultilineMessage('#room', 'a\nb');
    expect(socket.writes.length).toBe(0);
  });

  it('wraps batch label manager helpers', () => {
    const mgr = {
      handleBatchStart: jest.fn(),
      handleBatchEnd: jest.fn(),
      addMessageToBatch: jest.fn(),
      sendRawWithLabel: jest.fn(() => 'lbl-1'),
      handleLabeledResponse: jest.fn(),
      cleanupLabels: jest.fn(),
      getActiveBatches: jest.fn(() => new Map()),
    };
    jest.spyOn(irc as any, 'getBatchLabelManager').mockReturnValue(mgr);

    (irc as any).handleBatchStart('ref1', 'chathistory', [], Date.now());
    (irc as any).handleBatchEnd('ref1', Date.now());
    (irc as any).addMessageToBatch({ id: '1' }, 'ref1');
    expect(irc.sendRawWithLabel('PRIVMSG #x :y')).toBe('lbl-1');
    (irc as any).handleLabeledResponse('lbl-1', { ok: true });
    (irc as any).cleanupLabels();

    expect(mgr.handleBatchStart).toHaveBeenCalled();
    expect(mgr.handleBatchEnd).toHaveBeenCalled();
    expect(mgr.addMessageToBatch).toHaveBeenCalled();
    expect(mgr.sendRawWithLabel).toHaveBeenCalledWith(
      'PRIVMSG #x :y',
      undefined,
    );
    expect(mgr.handleLabeledResponse).toHaveBeenCalledWith('lbl-1', {
      ok: true,
    });
    expect(mgr.cleanupLabels).toHaveBeenCalled();
  });

  it('addMessage marks playback for history batches', () => {
    const mgr = {
      getActiveBatches: jest.fn(
        () => new Map([['b1', { type: 'chathistory' }]]),
      ),
      addMessageToBatch: jest.fn(),
    };
    jest.spyOn(irc as any, 'getBatchLabelManager').mockReturnValue(mgr);

    const received: IRCMessage[] = [];
    irc.onMessage(m => received.push(m));
    irc.addMessage(
      {
        type: 'message',
        channel: '#r',
        from: 'alice',
        text: 'x',
        timestamp: Date.now(),
      },
      'b1',
    );

    const playbackMsg = received.find(
      m => m.channel === '#r' && m.text === 'x',
    );
    expect(playbackMsg?.isPlayback).toBe(true);
    expect(mgr.addMessageToBatch).toHaveBeenCalled();
  });

  it('covers network/getter/setter/capability helpers', () => {
    const userMgmt = { test: 1 } as any;
    const notify = { setIRCService: jest.fn() } as any;

    irc.setNetworkId('net-1');
    expect(irc.getNetworkName()).toBe('net-1');
    (irc as any).config = { host: 'irc.example' };
    irc.setNetworkId('');
    expect(irc.getNetworkName()).toBe('irc.example');

    irc.setWhoisUseDoubleNick(true);
    expect(irc.getWhoisUseDoubleNick()).toBe(true);

    irc.setUserManagementService(userMgmt);
    expect(irc.getUserManagementService()).toBe(userMgmt);

    irc.setNotifyService(notify);
    expect(notify.setIRCService).toHaveBeenCalledWith(irc);
    expect(irc.getNotifyService()).toBe(notify);

    expect(irc.getConnectionStatus()).toBe(true);
    (irc as any).capEnabledSet.add('message-tags');
    expect(irc.hasCapability('message-tags')).toBe(true);
    expect(irc.hasTypingCapability()).toBe(true);
    expect(irc.sendTypingIndicator('#room', 'active')).toBe(true);
    expect(
      socket.writes.some(w => w.includes('@+typing=active TAGMSG #room')),
    ).toBe(true);

    (irc as any).isConnected = false;
    expect(irc.sendTypingIndicator('#room', 'done')).toBe(false);
  });

  it('covers local address and SASL helper getters', () => {
    (irc as any).socket = { localAddress: '10.0.0.2' };
    expect(irc.getLocalAddress()).toBe('10.0.0.2');

    (irc as any).socket = { address: () => ({ address: '10.0.0.3' }) };
    expect(irc.getLocalAddress()).toBe('10.0.0.3');

    (irc as any).socket = {
      address: () => {
        throw new Error('boom');
      },
    };
    expect(irc.getLocalAddress()).toBeUndefined();

    (irc as any).capAvailable.add('sasl');
    expect(irc.isSaslAvailable()).toBe(true);

    (irc as any).saslAuthenticating = true;
    expect(irc.isSaslAuthenticating()).toBe(true);

    (irc as any).config = {
      clientCert: 'c',
      clientKey: 'k',
      sasl: { account: 'a', password: 'p' },
    };
    expect(irc.isSaslExternal()).toBe(true);

    (irc as any).config = { sasl: { account: 'alice', password: 'secret' } };
    expect(irc.isSaslPlain()).toBe(true);
    expect(irc.getSaslAccount()).toBe('alice');
  });

  it('covers parseServerCommand for management and connection modes', () => {
    const management = (irc as any).parseServerCommand([
      '-sar',
      'irc.example.net',
      '-d',
      'Desc',
      '-p',
      '6667',
      '-g',
      'groupA',
      '-w',
      'passA',
    ]);
    expect(management.management.sort).toBe(true);
    expect(management.management.add).toBe(true);
    expect(management.management.remove).toBe(true);
    expect(management.managementOptions.description).toBe('Desc');
    expect(management.managementOptions.port).toBe(6667);
    expect(management.managementOptions.group).toBe('groupA');
    expect(management.managementOptions.password).toBe('passA');
    expect(management.address).toBe('irc.example.net');

    const parsed = (irc as any).parseServerCommand([
      '-em',
      'irc.libera.chat',
      '+6697',
      'serverpass',
      '-l',
      'plain',
      'secret',
      '-lname',
      'loginUser',
      '-i',
      'nick1',
      'nick2',
      'mail@example.com',
      'Real Name',
      '-jn',
      '#chat',
      'key123',
      '-j',
      '#help',
    ]);
    expect(parsed.switches.ssl).toBe(true);
    expect(parsed.switches.newWindow).toBe(true);
    expect(parsed.address).toBe('irc.libera.chat');
    expect(parsed.port).toBe(6697);
    expect(parsed.password).toBe('serverpass');
    expect(parsed.login.method).toBe('plain');
    expect(parsed.login.password).toBe('secret');
    expect(parsed.login.username).toBe('loginUser');
    expect(parsed.identity.nick).toBe('nick1');
    expect(parsed.identity.altNick).toBe('nick2');
    expect(parsed.joinChannels).toEqual([
      { channel: '#chat', password: 'key123' },
      { channel: '#help', password: '' },
    ]);
  });

  it('covers channel/user helpers and silent WHO/MODE flows', async () => {
    (irc as any).channelUsers.set(
      '#room',
      new Map([
        ['alice', { nick: 'alice', modes: [] }],
        ['tester', { nick: 'tester', modes: ['o'] }],
      ]),
    );
    expect(irc.getChannels()).toEqual(['#room']);
    expect(irc.getChannelUsers('#room').map(u => u.nick)).toEqual([
      'alice',
      'tester',
    ]);

    const modeListener = jest.fn();
    const offUserList = irc.onUserListChange(modeListener);
    (irc as any).emitUserListChange('#room', [{ nick: 'x', modes: [] }]);
    expect(modeListener).toHaveBeenCalledWith('#room', [
      { nick: 'x', modes: [] },
    ]);
    offUserList();

    (irc as any).updateSelfUserModes('+io-o');
    expect(irc.getSelfUserModes()).toContain('i');

    (irc as any).handleChannelModeChange('#room', ['+ov', 'Alice', 'tester']);
    (irc as any).handleChannelModeChange('#room', ['-o', 'tester']);
    const users = (irc as any).channelUsers.get('#room');
    expect(users.get('alice').modes).toContain('o');

    const cb = jest.fn();
    irc.sendSilentWho('Alice', cb);
    irc.sendSilentMode('Alice');
    expect((irc as any).silentWhoNicks.has('alice')).toBe(true);
    expect((irc as any).silentModeNicks.has('alice')).toBe(true);

    (irc as any).socket = {
      write: jest.fn(() => {
        throw new Error('closed');
      }),
    };
    irc.sendSilentWho('Bob', cb);
    irc.sendSilentMode('Bob');
    expect((irc as any).silentWhoNicks.has('bob')).toBe(false);
    expect((irc as any).silentModeNicks.has('bob')).toBe(false);
  });

  it('covers detectClones batching and clone-detection status', async () => {
    jest.useRealTimers();
    (irc as any).cloneDetectionBatchSize = 1;
    (irc as any).cloneDetectionDelay = 1;
    (irc as any).cloneDetectionActive = true;
    expect(irc.isCloneDetectionActive()).toBe(true);

    (irc as any).channelUsers.set(
      '#clone',
      new Map([
        ['a', { nick: 'a', modes: [], host: 'h1' }],
        ['b', { nick: 'b', modes: [], host: 'h1' }],
        ['c', { nick: 'c', modes: [], host: 'h2' }],
      ]),
    );

    const clones = await irc.detectClones('#clone');
    expect(clones.get('h1')).toEqual(['a', 'b']);
    expect(clones.has('h2')).toBe(false);
    expect((await irc.detectClones('#missing')).size).toBe(0);
    jest.useFakeTimers();
  });

  it('covers join/request names and emitConnection foreground service branches', async () => {
    irc.joinChannel('general');
    irc.requestChannelUsers('#general');
    expect(socket.writes.some(w => w.includes('JOIN #general'))).toBe(true);
    expect(socket.writes.some(w => w.includes('NAMES #general'))).toBe(true);

    const connChanges: boolean[] = [];
    irc.onConnectionChange(v => connChanges.push(v));

    mockConnectionManagerGetAllConnections.mockReturnValue([
      { networkId: 'n1', ircService: { getConnectionStatus: () => true } },
      { networkId: 'n2', ircService: { getConnectionStatus: () => true } },
    ]);

    mockFgService.isServiceRunning.mockReturnValueOnce(false);
    await (irc as any).emitConnection(true);
    expect(mockFgService.start).toHaveBeenCalled();

    mockFgService.isServiceRunning.mockReturnValueOnce(true);
    await (irc as any).emitConnection(true);
    expect(mockFgService.updateNotification).toHaveBeenCalled();

    await (irc as any).emitConnection(false);
    expect(mockFgService.updateNotification).toHaveBeenCalled();

    mockConnectionManagerGetAllConnections.mockReturnValue([]);
    await (irc as any).emitConnection(false);
    expect(mockFgService.stop).toHaveBeenCalled();
    expect(connChanges.length).toBeGreaterThan(0);
  });
});
