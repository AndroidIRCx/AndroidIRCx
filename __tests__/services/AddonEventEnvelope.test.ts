/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  ADDON_EVENT_SCHEMA_VERSION,
  addonEventFromIrcMessage,
  createAddonEventEnvelope,
} from '../../src/services/scripting/AddonEventEnvelope';

describe('AddonEventEnvelope', () => {
  it('creates a versioned detached and deeply frozen envelope', () => {
    const payload = { nested: { value: 1 } };
    const event = createAddonEventEnvelope({
      id: 'event-1',
      type: 'irc.message',
      timestamp: 123,
      network: 'libera',
      channel: '#androidircx',
      sender: { nick: 'alice', ident: 'user', host: 'example.test' },
      payload,
      origin: { self: false },
    });
    payload.nested.value = 2;

    expect(event.schemaVersion).toBe(ADDON_EVENT_SCHEMA_VERSION);
    expect(event.payload).toEqual({ nested: { value: 1 } });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(Object.isFrozen((event.payload as any).nested)).toBe(true);
  });

  describe('what the user typed to services (security pass 2026-10-05)', () => {
    const echo = (target: string, text: string, from = 'Me') =>
      addonEventFromIrcMessage(
        {
          id: 'e',
          type: 'message',
          text,
          timestamp: 1,
          network: 'libera',
          target,
          channel: target,
          from,
        } as any,
        { selfNick: 'me' },
      );

    it('never hands an addon the password the user sent to NickServ', () => {
      const event = echo('NickServ', 'IDENTIFY hunter2');
      expect((event.payload as any).text).toBe('IDENTIFY [redacted]');
      expect(JSON.stringify(event)).not.toContain('hunter2');
    });

    it('leaves ordinary messages, and other people\u2019s, untouched', () => {
      expect((echo('#chat', 'IDENTIFY x').payload as any).text).toBe(
        'IDENTIFY x',
      );
      expect(
        (echo('NickServ', 'IDENTIFY x', 'Someone').payload as any).text,
      ).toBe('IDENTIFY x');
    });
  });

  it('normalizes IRC identity, references, parsed payload and origin', () => {
    const event = addonEventFromIrcMessage(
      {
        id: 'msg-1',
        type: 'message',
        text: 'hello',
        timestamp: 456,
        network: 'libera',
        channel: '#chat',
        from: 'Alice',
        username: 'ident',
        hostname: 'host.test',
        account: 'alice-account',
        msgid: 'irc-msgid',
        batchTag: 'batch-1',
        tags: { certfp: 'ABCD', secret: 'must-not-cross' },
        replyTo: 'prior-id',
        isPlayback: true,
      },
      { selfNick: 'alice', senderIsOp: true },
    );

    expect(event).toMatchObject({
      type: 'irc.message',
      network: 'libera',
      channel: '#chat',
      target: '#chat',
      sender: {
        nick: 'Alice',
        ident: 'ident',
        host: 'host.test',
        account: 'alice-account',
        certfp: 'ABCD',
      },
      rawReference: { messageId: 'irc-msgid', batchTag: 'batch-1' },
      payload: { text: 'hello', replyTo: 'prior-id', senderIsOp: true },
      origin: { self: true, server: false, playback: true },
    });
    expect(JSON.stringify(event)).not.toContain('must-not-cross');
  });

  it('marks scrollback as playback and accepts an explicit server origin', () => {
    const event = addonEventFromIrcMessage(
      {
        id: 'numeric-1',
        type: 'system',
        text: 'welcome',
        timestamp: 789,
        numeric: '001',
        isScrollback: true,
      },
      { serverOrigin: true },
    );
    expect(event.type).toBe('irc.numeric');
    expect(event.origin).toEqual({ self: false, server: true, playback: true });
    expect(event.payload).toEqual({ text: 'welcome', numeric: '001' });
    expect(event.rawReference).toBeUndefined();
  });

  it.each([
    [{ id: '', type: 'irc.message' }, 'id'],
    [{ id: 'x', type: 'IRC Message' }, 'type'],
    [{ id: 'x', type: 'irc.message', timestamp: -1 }, 'timestamp'],
    [{ id: 'x', type: 'irc.message', sender: { nick: '' } }, 'sender.nick'],
  ])('rejects malformed envelope metadata', (input, field) => {
    expect(() => createAddonEventEnvelope(input as any)).toThrow(field);
  });
});
