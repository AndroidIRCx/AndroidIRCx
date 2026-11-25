/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
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
import { utf8ByteLength } from '../src/utils/ircMessageSplit';
import { FakeSocket } from '../test-support/FakeSocket';

/** What the server relays to everyone else for one of our lines. */
const relayed = (line: string, mask: string) =>
  `:${mask} ${line.replace(/^@\S+ /, '')}`;

describe('IRCService long messages', () => {
  let irc: IRCService;
  let socket: FakeSocket;
  let messages: IRCMessage[];

  const lines = () =>
    socket.writes.map(w => w.replace(/\r\n$/, '')).filter(w => w.length > 0);

  beforeEach(() => {
    jest.useFakeTimers();
    irc = new IRCService();
    socket = new FakeSocket();
    (irc as any).socket = socket;
    (irc as any).isConnected = true;
    (irc as any).currentNick = 'tester';
    messages = [];
    irc.onMessage(m => messages.push(m));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const cyrillic = Array(120).fill('ђурђевак').join(' '); // ~2 KB

  it('splits a long Cyrillic message into lines the server relays whole', () => {
    (irc as any).handleIRCMessage(':tester!~tester@some.host.example JOIN #c');
    socket.writes.length = 0;

    irc.sendMessage('#c', cyrillic);
    jest.runAllTimers();

    const sent = lines().filter(l => l.startsWith('PRIVMSG #c :'));
    expect(sent.length).toBeGreaterThan(3);
    sent.forEach(line =>
      expect(
        utf8ByteLength(relayed(line, 'tester!~tester@some.host.example')),
      ).toBeLessThanOrEqual(510),
    );
    expect(sent.map(l => l.slice('PRIVMSG #c :'.length)).join('')).toBe(
      cyrillic,
    );
  });

  it('echoes every piece locally so the server echo can be matched', () => {
    irc.sendMessage('#c', cyrillic);
    const echoed = messages.filter(m => m.type === 'message');
    const sentCount = (): number =>
      lines().filter(l => l.startsWith('PRIVMSG #c :')).length;
    jest.runAllTimers();
    expect(echoed.length).toBe(sentCount());
    expect(echoed.map(m => m.text).join('')).toBe(cyrillic);
  });

  it('says so when a raw line had to be shortened', () => {
    const truncated = jest.fn();
    irc.on('raw-truncated', truncated);
    irc.sendRaw(`PRIVMSG #c :${'a'.repeat(600)}`);
    expect(truncated).toHaveBeenCalled();
    expect(
      messages.some(m =>
        m.text.includes('A line was too long for the server and was shortened'),
      ),
    ).toBe(true);
    irc.sendRaw('PRIVMSG #c :short');
    expect(truncated).toHaveBeenCalledTimes(1);
  });

  it('sends a short message as one unchanged line', () => {
    irc.sendMessage('#c', 'hello there');
    expect(lines()).toEqual(['PRIVMSG #c :hello there']);
  });

  it('assumes a long host until it knows ours, and uses ours once known', () => {
    const before = irc.getTextByteBudget('PRIVMSG', '#c');
    (irc as any).handleIRCMessage(':tester!~t@h JOIN #c');
    const after = irc.getTextByteBudget('PRIVMSG', '#c');
    expect(after).toBeGreaterThan(before);
    // multiline.md: also keep a 10-byte safety buffer.
    expect(after).toBe(
      510 -
        utf8ByteLength(':tester!~t@h ') -
        utf8ByteLength('PRIVMSG #c :') -
        10,
    );
  });

  it('uses the ISUPPORT LINELEN the server advertises', () => {
    const normal = irc.getTextByteBudget('PRIVMSG', '#c');
    (irc as any).isupportValues.set('LINELEN', '2048');
    expect(irc.getLineByteLimit()).toBe(2046);
    expect(irc.getTextByteBudget('PRIVMSG', '#c')).toBe(normal + 1536);
    // A line that long is sent whole, not cut at 510.
    irc.sendRaw(`PRIVMSG #c :${'a'.repeat(1500)}`);
    expect(lines()[0]).toHaveLength('PRIVMSG #c :'.length + 1500);
    // Never below the RFC limit, and junk is ignored.
    (irc as any).isupportValues.set('LINELEN', '100');
    expect(irc.getLineByteLimit()).toBe(510);
    (irc as any).isupportValues.set('LINELEN', 'x');
    expect(irc.getLineByteLimit()).toBe(510);
  });

  it('respects USERLEN while the user part is a guess', () => {
    (irc as any).config = { nick: 'tester', username: 'averyverylongident' };
    (irc as any).isupportValues.set('USERLEN', '5');
    const shortUser = irc.getTextByteBudget('PRIVMSG', '#c');
    (irc as any).isupportValues.set('USERLEN', 'bogus');
    const defaultUser = irc.getTextByteBudget('PRIVMSG', '#c');
    expect(shortUser - defaultUser).toBe(5);
  });

  it('never gives a budget below the minimum', () => {
    (irc as any).currentNick = 'n'.repeat(500);
    expect(irc.getTextByteBudget('PRIVMSG', '#c')).toBe(100);
  });

  it('learns our mask from 001, 396 and CHGHOST, and ignores other users', () => {
    const handle = (line: string) => (irc as any).handleIRCMessage(line);
    handle(':srv 001 tester :Welcome to the net tester!~u1@h1');
    expect([(irc as any).selfUser, (irc as any).selfHost]).toEqual([
      '~u1',
      'h1',
    ]);
    handle(':srv 396 tester cloak/x :is now your displayed host');
    expect((irc as any).selfHost).toBe('cloak/x');
    handle(':srv 396 tester id@cloak/y :is now your displayed host');
    expect([(irc as any).selfUser, (irc as any).selfHost]).toEqual([
      'id',
      'cloak/y',
    ]);
    handle(':tester!id@cloak/y CHGHOST newid new.host');
    expect([(irc as any).selfUser, (irc as any).selfHost]).toEqual([
      'newid',
      'new.host',
    ]);
    handle(':bob!b@bobhost PRIVMSG #c :hi');
    handle(':bob!b@bobhost CHGHOST x y');
    handle(':srv 001 tester :Welcome bob!b@elsewhere');
    expect((irc as any).selfHost).toBe('new.host');
  });

  it('forgets our mask on a new connection attempt', () => {
    (irc as any).handleIRCMessage(':tester!~t@h JOIN #c');
    (irc as any).selfUser = 'x';
    irc.connect({ host: 'irc.example', port: 6667, nick: 'tester' } as any);
    expect((irc as any).selfUser).toBeNull();
    expect((irc as any).selfHost).toBeNull();
    irc.disconnect();
  });

  it('sends the first lines at once and the rest paced, in order', () => {
    irc.sendMessage('#c', cyrillic);
    const total = messages.filter(m => m.type === 'message').length;
    expect(lines().length).toBe(4);
    irc.sendMessage('#c', 'after');
    jest.advanceTimersByTime(700);
    expect(lines().length).toBe(5);
    jest.runAllTimers();
    const sent = lines();
    expect(sent.length).toBe(total + 1);
    expect(sent[sent.length - 1]).toBe('PRIVMSG #c :after');
  });

  it('drops paced lines when the connection goes away', () => {
    irc.sendMessage('#c', cyrillic);
    const atOnce = lines().length;
    (irc as any).isConnected = false;
    jest.runAllTimers();
    expect(lines().length).toBe(atOnce);
    expect((irc as any).pacedLines).toEqual([]);
  });

  it('clears paced lines on disconnect', () => {
    irc.sendMessage('#c', cyrillic);
    irc.disconnect();
    expect((irc as any).pacedLines).toEqual([]);
    expect((irc as any).pacedTimer).toBeNull();
  });

  it('puts reply and context on the first piece and typing on the last', () => {
    (irc as any).capEnabledSet.add('message-tags');
    irc.sendMessageWithTags('#c', cyrillic, {
      replyTo: 'm1',
      channelContext: '#ctx',
      typing: 'done',
    });
    jest.runAllTimers();
    const sent = lines();
    expect(sent[0]).toMatch(/^@\S*\+reply=m1/);
    expect(sent[0]).toContain('+draft/channel-context=#ctx');
    expect(sent[0]).not.toContain('+typing');
    expect(sent[sent.length - 1]).toMatch(/^@\+typing=done PRIVMSG/);
    sent.slice(1, -1).forEach(line => expect(line.startsWith('@')).toBe(false));
    const echoed = messages.filter(m => m.type === 'message');
    expect(echoed[0].replyTo).toBe('m1');
    expect(echoed[1].replyTo).toBeUndefined();
    expect(echoed[echoed.length - 1].typing).toBe('done');
  });

  it('keeps a tagged short message on one line with all its tags', () => {
    (irc as any).capEnabledSet.add('message-tags');
    irc.sendMessageWithTags('#c', 'short', { replyTo: 'm1', typing: 'done' });
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('+reply=m1');
    expect(lines()[0]).toContain('+typing=done');
  });

  it('splits long lines of a multi-line paste too', () => {
    irc.sendMessage('#c', `short\n${cyrillic}`);
    jest.runAllTimers();
    const sent = lines();
    expect(sent[0]).toBe('PRIVMSG #c :short');
    expect(sent.length).toBeGreaterThan(3);
  });

  describe('encrypted messages', () => {
    // Shaped like the real payload: a 32-byte key id, a 24-byte nonce and a
    // ciphertext that is the text plus a 16-byte tag, all base64.
    const fakeEncrypt = (keyId: string) => async (piece: string) => ({
      v: 1,
      from: keyId,
      nonce: Buffer.alloc(24, 1).toString('base64'),
      cipher: Buffer.concat([
        Buffer.from(piece, 'utf8'),
        Buffer.alloc(16, 2),
      ]).toString('base64'),
    });
    const decrypt = (line: string) => {
      const json = JSON.parse(line.slice(line.indexOf('{')));
      const bytes = Buffer.from(json.cipher, 'base64');
      return bytes.subarray(0, bytes.length - 16).toString('utf8');
    };

    it('splits before encrypting so every line fits and decrypts alone', async () => {
      const pieces = await irc.sendEncryptedText(
        'bob',
        cyrillic,
        '!enc-msg',
        fakeEncrypt(Buffer.alloc(32, 3).toString('base64')),
      );
      jest.runAllTimers();
      const sent = lines();
      expect(sent.length).toBe(pieces.length);
      expect(sent.length).toBeGreaterThan(5);
      sent.forEach(line => {
        expect(line.startsWith('PRIVMSG bob :!enc-msg {')).toBe(true);
        expect(
          utf8ByteLength(relayed(line, `tester!~tester@${'h'.repeat(63)}`)),
        ).toBeLessThanOrEqual(510);
      });
      expect(sent.map(decrypt)).toEqual(pieces);
      expect(pieces.join('')).toBe(cyrillic);
      // Every piece says which message it belongs to, so it can be joined.
      const parts = sent.map(
        line => JSON.parse(line.slice(line.indexOf('{'))).part,
      );
      expect(new Set(parts.map(part => part.id)).size).toBe(1);
      expect(parts.map(part => part.i)).toEqual(sent.map((_, i) => i));
      parts.forEach(part => expect(part.n).toBe(sent.length));
    });

    it('sends no part on a message that fits in one line', async () => {
      await irc.sendEncryptedText('bob', 'short', '!enc-msg', fakeEncrypt('k'));
      expect(JSON.parse(lines()[0].slice(lines()[0].indexOf('{'))).part).toBe(
        undefined,
      );
    });

    it('plans again with room for part when the estimate was too small', async () => {
      // Fits by the estimate, but the real payload is bigger, so it is split
      // after all and must then carry part within the line limit.
      const text = 'x'.repeat(250);
      const pieces = await irc.sendEncryptedText(
        'bob',
        text,
        '!enc-msg',
        fakeEncrypt('K'.repeat(120)),
      );
      jest.runAllTimers();
      expect(pieces.length).toBeGreaterThan(1);
      lines().forEach(line => {
        expect(JSON.parse(line.slice(line.indexOf('{'))).part).toBeDefined();
        expect(
          utf8ByteLength(relayed(line, `tester!~tester@${'h'.repeat(63)}`)),
        ).toBeLessThanOrEqual(510);
      });
      expect(pieces.join('')).toBe(text);
    });

    it('splits a piece again when its line still comes out too long', async () => {
      // A much bigger payload than the estimate expects.
      const encrypt = jest.fn(fakeEncrypt('K'.repeat(240)));
      const pieces = await irc.sendEncryptedText(
        '#c',
        cyrillic,
        '!chanenc-msg',
        encrypt,
      );
      jest.runAllTimers();
      expect(encrypt.mock.calls.length).toBeGreaterThan(pieces.length);
      lines().forEach(line =>
        expect(
          utf8ByteLength(relayed(line, `tester!~tester@${'h'.repeat(63)}`)),
        ).toBeLessThanOrEqual(510),
      );
      expect(pieces.join('')).toBe(cyrillic);
    });

    it('sends a short encrypted message as one line', async () => {
      const pieces = await irc.sendEncryptedText(
        'bob',
        'hi',
        '!enc-msg',
        fakeEncrypt('k'),
      );
      expect(pieces).toEqual(['hi']);
      expect(lines()).toHaveLength(1);
      expect(decrypt(lines()[0])).toBe('hi');
    });
  });

  it('splits /me into actions that each carry the wrapper', () => {
    irc.sendMessage('#c', `/me ${cyrillic}`);
    jest.runAllTimers();
    const sent = lines();
    expect(sent.length).toBeGreaterThan(3);
    sent.forEach(line => {
      expect(line.startsWith('PRIVMSG #c :\x01ACTION ')).toBe(true);
      expect(line.endsWith('\x01')).toBe(true);
      expect(
        utf8ByteLength(relayed(line, `tester!~tester@${'h'.repeat(63)}`)),
      ).toBeLessThanOrEqual(510);
    });
  });
});
