/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCService, IRCMessage } from '../src/services/IRCService';
import { DEFAULT_QUIT_MESSAGE } from '../src/services/SettingsService';
import { FakeSocket } from '../test-support/FakeSocket';

describe('IRCService command helpers', () => {
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

  it('sends CTCP requests', () => {
    irc.sendCTCPRequest('bob', 'PING', '123');
    expect(socket.writes.find(w => w.includes('PRIVMSG bob :\u0001PING 123\u0001'))).toBeTruthy();
  });

  it('sends monitor add/remove when capability is enabled', () => {
    (irc as any).capEnabledSet.add('monitor');

    irc.monitorNick('alice');
    irc.unmonitorNick('alice');

    expect(socket.writes.some(w => w.includes('MONITOR + alice'))).toBe(true);
    expect(socket.writes.some(w => w.includes('MONITOR - alice'))).toBe(true);
    expect(irc.isMonitoring('alice')).toBe(false);
  });

  it('routes /me to CTCP ACTION and adds sent message', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(msg => messages.push(msg));

    irc.sendMessage('#room', '/me waves');

    expect(socket.writes.some(w => w.includes('PRIVMSG #room :\u0001ACTION waves\u0001'))).toBe(true);
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
    expect(socket.writes.some(w => w.includes(`QUIT :${DEFAULT_QUIT_MESSAGE}`))).toBe(true);
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

  it('responds to incoming CTCP PING', () => {
    (irc as any).isConnected = true;
    (irc as any).handleIRCMessage(':bob!user@host PRIVMSG tester :\x01PING 123\x01');

    expect(socket.writes.some(w => w.includes('NOTICE bob :\u0001PING 123\u0001'))).toBe(true);
  });

  it('sends plain messages when connected', () => {
    irc.sendMessage('#chan', 'hi there');

    expect(socket.writes.some(w => w.includes('PRIVMSG #chan :hi there'))).toBe(true);
  });

  it('uses multiline sender when message contains newlines', () => {
    const multiSpy = jest.spyOn(irc, 'sendMultilineMessage');
    (irc as any).capEnabledSet.add('draft/multiline');

    irc.sendMessage('#chan', 'line one\r\nline two');

    expect(multiSpy).toHaveBeenCalledWith('#chan', 'line one\nline two');
    expect(socket.writes.some(w => w.includes('draft/multiline-concat'))).toBe(true);
    multiSpy.mockRestore();
  });

  it('uses multiline sender for tagged messages with newlines', () => {
    const multiSpy = jest.spyOn(irc, 'sendMultilineMessage');
    (irc as any).capEnabledSet.add('draft/multiline');

    irc.sendMessageWithTags('#chan', 'alpha\nbeta', { replyTo: 'msgid123' });

    expect(multiSpy).toHaveBeenCalledWith('#chan', 'alpha\nbeta');
    expect(socket.writes.some(w => w.includes('draft/multiline-concat'))).toBe(true);
    multiSpy.mockRestore();
  });

  it('supports /msg and reports usage errors', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    irc.sendMessage('#chan', '/msg bob hello');
    expect(socket.writes.some(w => w.includes('PRIVMSG bob :hello'))).toBe(true);

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

  it('assembles multiline messages when final concat tag is empty', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    (irc as any).handleIRCMessage('@draft/multiline-concat=concat :alice!u@h PRIVMSG #chan :line 1');
    (irc as any).handleIRCMessage('@draft/multiline-concat= :alice!u@h PRIVMSG #chan :line 2');

    const assembled = messages.find(m => m.type === 'message' && m.from === 'alice');
    expect(assembled?.text).toBe('line 1\nline 2');
  });

  it('does not deduplicate multiline chunks that share the same msgid', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    (irc as any).handleIRCMessage('@msgid=mid-42;draft/multiline-concat=concat :alice!u@h PRIVMSG #chan :part A');
    (irc as any).handleIRCMessage('@msgid=mid-42;draft/multiline-concat= :alice!u@h PRIVMSG #chan :part B');

    const assembled = messages.find(m => m.type === 'message' && m.from === 'alice');
    expect(assembled?.text).toBe('part A\npart B');
  });

  it('setRealname sends SETNAME when capability is enabled and shows error otherwise', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    (irc as any).capEnabledSet.add('setname');
    irc.setRealname('New Realname');
    expect(socket.writes.some(w => w.includes('SETNAME :New Realname'))).toBe(true);

    (irc as any).capEnabledSet.delete('setname');
    irc.setRealname('Another Name');
    expect(messages.some(m => m.type === 'error' && m.text.includes('SETNAME'))).toBe(true);
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
    expect(messages.some(m => m.type === 'error' && m.text.includes('BOT mode'))).toBe(true);
  });

  it('requestChatHistory sends command when supported and emits error when unsupported', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    (irc as any).capEnabledSet.add('chathistory');
    irc.requestChatHistory('#room', 50, 'msgid-1');
    expect(socket.writes.some(w => w.includes('CHATHISTORY LATEST #room msgid-1 50'))).toBe(true);

    (irc as any).capEnabledSet.delete('chathistory');
    irc.requestChatHistory('#room');
    expect(messages.some(m => m.type === 'error' && m.text.includes('CHATHISTORY'))).toBe(true);
  });

  it('sendReadMarker and redactMessage send capability commands and events', () => {
    const emitSpy = jest.spyOn(irc as any, 'emit');
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    (irc as any).capEnabledSet.add('draft/read-marker');
    irc.sendReadMarker('#room', 123);
    expect(socket.writes.some(w => w.includes('MARKREAD #room timestamp=123'))).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith('read-marker-sent', '#room', 123);

    (irc as any).capEnabledSet.add('draft/message-redaction');
    irc.redactMessage('#room', 'm-1');
    expect(socket.writes.some(w => w.includes('REDACT #room m-1'))).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith('message-redacted-sent', '#room', 'm-1');

    (irc as any).capEnabledSet.delete('draft/message-redaction');
    irc.redactMessage('#room', 'm-2');
    expect(messages.some(m => m.type === 'error' && m.text.includes('MESSAGE-REDACTION'))).toBe(true);
  });

  it('sendMessageWithTags and sendReaction include tags and emit local status', () => {
    const messages: IRCMessage[] = [];
    const emitSpy = jest.spyOn(irc as any, 'emit');
    irc.onMessage(m => messages.push(m));

    irc.sendMessageWithTags('#room', 'hello', {
      channelContext: '#context',
      replyTo: 'msgid-9',
      typing: 'active',
    });
    expect(
      socket.writes.some(w =>
        w.includes('@+draft/channel-context=#context;+draft/reply=msgid-9;+typing=active PRIVMSG #room :hello')
      )
    ).toBe(true);
    expect(messages.some(m => m.channelContext === '#context' && m.replyTo === 'msgid-9' && m.typing === 'active')).toBe(true);

    irc.sendReaction('#room', 'msgid-9', ':+1:');
    expect(socket.writes.some(w => w.includes('@+draft/react=msgid-9;:+1: TAGMSG #room'))).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith('reaction-sent', '#room', 'msgid-9', ':+1:');
  });

  it('sendMultilineMessage handles capability and fallback modes', () => {
    const messages: IRCMessage[] = [];
    irc.onMessage(m => messages.push(m));

    (irc as any).capEnabledSet.add('draft/multiline');
    irc.sendMultilineMessage('#room', 'line1\nline2');
    expect(socket.writes.some(w => w.includes('@draft/multiline-concat=concat PRIVMSG #room :line1'))).toBe(true);
    expect(socket.writes.some(w => w.includes('@draft/multiline-concat= PRIVMSG #room :line2'))).toBe(true);

    (irc as any).capEnabledSet.delete('draft/multiline');
    irc.sendMultilineMessage('#room', 'a\n\nb');
    expect(socket.writes.some(w => w.includes('PRIVMSG #room :a'))).toBe(true);
    expect(socket.writes.some(w => w.includes('PRIVMSG #room :b'))).toBe(true);
    expect(messages.filter(m => m.type === 'message' && m.channel === '#room').length).toBeGreaterThanOrEqual(2);
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
    expect(mgr.sendRawWithLabel).toHaveBeenCalledWith('PRIVMSG #x :y', undefined);
    expect(mgr.handleLabeledResponse).toHaveBeenCalledWith('lbl-1', { ok: true });
    expect(mgr.cleanupLabels).toHaveBeenCalled();
  });

  it('addMessage marks playback for history batches', () => {
    const mgr = {
      getActiveBatches: jest.fn(() => new Map([['b1', { type: 'chathistory' }]])),
      addMessageToBatch: jest.fn(),
    };
    jest.spyOn(irc as any, 'getBatchLabelManager').mockReturnValue(mgr);

    const received: IRCMessage[] = [];
    irc.onMessage(m => received.push(m));
    irc.addMessage({ type: 'message', channel: '#r', from: 'alice', text: 'x', timestamp: Date.now() }, 'b1');

    const playbackMsg = received.find(m => m.channel === '#r' && m.text === 'x');
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
    (irc as any).capEnabledSet.add('typing');
    expect(irc.hasCapability('typing')).toBe(true);
    expect(irc.hasTypingCapability()).toBe(true);
    expect(irc.sendTypingIndicator('#room', 'active')).toBe(true);
    expect(socket.writes.some(w => w.includes('@+typing=active TAGMSG #room'))).toBe(true);

    (irc as any).isConnected = false;
    expect(irc.sendTypingIndicator('#room', 'done')).toBe(false);
  });

  it('covers local address and SASL helper getters', () => {
    (irc as any).socket = { localAddress: '10.0.0.2' };
    expect(irc.getLocalAddress()).toBe('10.0.0.2');

    (irc as any).socket = { address: () => ({ address: '10.0.0.3' }) };
    expect(irc.getLocalAddress()).toBe('10.0.0.3');

    (irc as any).socket = { address: () => { throw new Error('boom'); } };
    expect(irc.getLocalAddress()).toBeUndefined();

    (irc as any).capAvailable.add('sasl');
    expect(irc.isSaslAvailable()).toBe(true);

    (irc as any).saslAuthenticating = true;
    expect(irc.isSaslAuthenticating()).toBe(true);

    (irc as any).config = { clientCert: 'c', clientKey: 'k', sasl: { account: 'a', password: 'p' } };
    expect(irc.isSaslExternal()).toBe(true);

    (irc as any).config = { sasl: { account: 'alice', password: 'secret' } };
    expect(irc.isSaslPlain()).toBe(true);
    expect(irc.getSaslAccount()).toBe('alice');
  });
});
