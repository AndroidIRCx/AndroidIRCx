/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * IRCv3 draft/multiline, checked against extensions/multiline.md.
 */

jest.mock('../src/services/IRCForegroundService', () => ({
  ircForegroundService: {
    isServiceRunning: jest.fn(() => false),
    start: jest.fn(() => Promise.resolve()),
    updateNotification: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../src/services/ConnectionManager', () => ({
  connectionManager: { getAllConnections: jest.fn(() => []) },
}));

import { IRCService, IRCMessage } from '../src/services/IRCService';
import { FakeSocket } from '../test-support/FakeSocket';

describe('IRCService draft/multiline', () => {
  let irc: IRCService;
  let socket: FakeSocket;
  let messages: IRCMessage[];

  const lines = () =>
    socket.writes.map(w => w.replace(/\r\n$/, '')).filter(w => w.length > 0);
  const chat = () => messages.filter(m => m.type === 'message');

  const enable = (value = 'max-bytes=4096,max-lines=24') => {
    (irc as any).capEnabledSet.add('draft/multiline');
    (irc as any).capEnabledSet.add('batch');
    (irc as any).capValues.set('draft/multiline', value);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    irc = new IRCService();
    socket = new FakeSocket();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
    (irc as any).handleIRCMessage(':tester!~t@h JOIN #c');
    socket.writes.length = 0;
    messages = [];
    irc.onMessage(m => messages.push(m));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('sending', () => {
    it('sends lines with breaks as one batch and shows one message', () => {
      enable();
      irc.sendMessage('#c', 'hello\n\nhow is everyone?');
      const sent = lines();
      const ref = sent[0].match(/^BATCH \+(\S+) draft\/multiline #c$/)?.[1];
      expect(ref).toBeTruthy();
      expect(sent.slice(1)).toEqual([
        `@batch=${ref} PRIVMSG #c :hello`,
        `@batch=${ref} PRIVMSG #c :`,
        `@batch=${ref} PRIVMSG #c :how is everyone?`,
        `BATCH -${ref}`,
      ]);
      expect(chat().map(m => m.text)).toEqual(['hello\n\nhow is everyone?']);
    });

    it('joins the pieces of a too-long line with multiline-concat', () => {
      enable();
      const long = Array(200).fill('word').join(' ');
      irc.sendMessage('#c', long);
      const body = lines().slice(1, -1);
      expect(body.length).toBeGreaterThan(1);
      expect(body[0].startsWith('@batch=')).toBe(true);
      expect(body[0]).not.toContain('multiline-concat');
      body
        .slice(1)
        .forEach(line =>
          expect(line).toMatch(/^@batch=\S+;draft\/multiline-concat PRIVMSG/),
        );
      // Rejoined the way a receiver joins them, it is the original text.
      expect(
        body.map(line => line.split(' :').slice(1).join(' :')).join(''),
      ).toBe(long);
      expect(chat()).toHaveLength(1);
    });

    it('puts client-only tags on the BATCH command only', () => {
      enable();
      (irc as any).capEnabledSet.add('message-tags');
      irc.sendMessageWithTags('#c', 'a\nb', { replyTo: 'm1', typing: 'done' });
      const sent = lines();
      expect(sent[0]).toMatch(/^@\+reply=m1;\+typing=done BATCH \+/);
      sent.slice(1, -1).forEach(line => {
        expect(line).not.toContain('+reply');
        expect(line).not.toContain('+typing');
      });
      expect(chat()[0].replyTo).toBe('m1');
    });

    it('falls back to plain lines without the caps or without max-bytes', () => {
      irc.sendMessage('#c', 'a\nb');
      expect(lines()).toEqual(['PRIVMSG #c :a', 'PRIVMSG #c :b']);
      socket.writes.length = 0;
      (irc as any).capEnabledSet.add('draft/multiline');
      (irc as any).capValues.set('draft/multiline', 'max-bytes=4096');
      irc.sendMessage('#c', 'a\nb');
      expect(lines()).toEqual(['PRIVMSG #c :a', 'PRIVMSG #c :b']);
      socket.writes.length = 0;
      enable('max-lines=5');
      irc.sendMessage('#c', 'a\nb');
      expect(lines()).toEqual(['PRIVMSG #c :a', 'PRIVMSG #c :b']);
    });

    it('falls back to plain lines when the batch would break max-bytes or max-lines', () => {
      enable('max-bytes=10');
      irc.sendMessage('#c', 'hello\nworld!');
      expect(lines()[0]).toBe('PRIVMSG #c :hello');
      socket.writes.length = 0;
      enable('max-bytes=4096,max-lines=2');
      irc.sendMessage('#c', 'a\nb\nc');
      expect(lines()).toEqual([
        'PRIVMSG #c :a',
        'PRIVMSG #c :b',
        'PRIVMSG #c :c',
      ]);
    });

    it('never sends a batch of blank lines only, nor a one-line batch', () => {
      enable();
      irc.sendMessage('#c', 'short');
      expect(lines()).toEqual(['PRIVMSG #c :short']);
      socket.writes.length = 0;
      irc.sendMultilineMessage('#c', '\n \n');
      expect(lines()).toEqual([]);
    });

    it('resends a refused batch as plain lines without showing it twice', () => {
      enable();
      irc.sendMessage('#c', 'one\ntwo');
      socket.writes.length = 0;
      (irc as any).handleIRCMessage(
        ':srv FAIL BATCH MULTILINE_MAX_BYTES 4096 :Multiline batch max-bytes exceeded',
      );
      expect(lines()).toEqual(['PRIVMSG #c :one', 'PRIVMSG #c :two']);
      expect(chat()).toHaveLength(1);
      // Only once, and not for an unrelated FAIL.
      socket.writes.length = 0;
      (irc as any).handleIRCMessage(':srv FAIL BATCH MULTILINE_INVALID :x');
      (irc as any).handleIRCMessage(':srv FAIL CHATHISTORY INVALID_TARGET :x');
      expect(lines()).toEqual([]);
    });

    it('does not resend a batch refused long after it was sent', () => {
      enable();
      irc.sendMessage('#c', 'one\ntwo');
      socket.writes.length = 0;
      jest.setSystemTime(Date.now() + 60000);
      (irc as any).handleIRCMessage(':srv FAIL BATCH MULTILINE_INVALID :x');
      expect(lines()).toEqual([]);
    });

    it('queues the batch behind lines that are still being paced', () => {
      enable();
      (irc as any).pacedLines = ['PRIVMSG #c :earlier'];
      irc.sendMessage('#c', 'x\ny');
      expect(lines()).toEqual([]);
      expect((irc as any).pacedLines[0]).toBe('PRIVMSG #c :earlier');
      expect((irc as any).pacedLines[1]).toMatch(/^BATCH \+/);
    });
  });

  describe('receiving', () => {
    const feed = (...wire: string[]) =>
      wire.forEach(line => (irc as any).handleIRCMessage(line));

    it('shows a multiline batch as one message with the batch tags', () => {
      feed(
        '@msgid=xxx;account=acc :n!u@h BATCH +123 draft/multiline #c',
        '@batch=123 :n!u@h PRIVMSG #c hello',
        '@batch=123 :n!u@h PRIVMSG #c :',
        '@batch=123 :n!u@h PRIVMSG #c :how is ',
        '@batch=123;draft/multiline-concat :n!u@h PRIVMSG #c :everyone?',
        'BATCH -123',
      );
      expect(chat()).toHaveLength(1);
      expect(chat()[0]).toEqual(
        expect.objectContaining({
          from: 'n',
          channel: '#c',
          text: 'hello\n\nhow is everyone?',
          msgid: 'xxx',
          account: 'acc',
        }),
      );
      // No "BATCH END" noise in the server tab.
      expect(messages.some(m => /BATCH/.test(m.text || ''))).toBe(false);
    });

    it('assembles a NOTICE batch and lines that repeat the batch msgid', () => {
      feed(
        '@msgid=m9 :n!u@h BATCH +b draft/multiline #c',
        '@batch=b;msgid=m9 :n!u@h NOTICE #c :first',
        '@batch=b;msgid=m9 :n!u@h NOTICE #c :second',
        'BATCH -b',
      );
      const notices = messages.filter(m => m.type === 'notice');
      expect(notices.map(m => m.text)).toEqual(['first\nsecond']);
    });

    it('drops an empty batch and leaves other batches alone', () => {
      feed(
        ':n!u@h BATCH +e draft/multiline #c',
        'BATCH -e',
        ':srv BATCH +n netsplit a b',
        '@batch=n :x!u@h QUIT :a b',
        'BATCH -n',
      );
      expect(chat()).toHaveLength(0);
      expect(messages.some(m => /Netsplit/.test(m.text || ''))).toBe(true);
    });

    it('keeps the outer batch of a multiline batch inside chat history', () => {
      feed(
        ':srv BATCH +h chathistory #c',
        '@batch=h;msgid=p1 :n!u@h BATCH +m draft/multiline #c',
        '@batch=m :n!u@h PRIVMSG #c :old',
        '@batch=m :n!u@h PRIVMSG #c :lines',
        'BATCH -m',
        'BATCH -h',
      );
      expect(chat()[0]).toEqual(
        expect.objectContaining({ text: 'old\nlines', msgid: 'p1' }),
      );
    });
  });
});
