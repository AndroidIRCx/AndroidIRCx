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

    expect(queueSpy).toHaveBeenCalledWith('Not connected', '#chan', 'hello');

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
});
