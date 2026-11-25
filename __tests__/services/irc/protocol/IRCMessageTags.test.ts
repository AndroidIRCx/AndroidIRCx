/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  buildIRCv3ClientTagPrefix,
  escapeIRCv3TagValue,
  parseIRCv3MessageLine,
  parseIRCv3MessageTags,
  serializeIRCv3MessageTags,
  unescapeIRCv3TagValue,
} from '../../../../src/services/irc/protocol/IRCMessageTags';
import {
  selectCapabilitiesToRequest,
  splitCapabilityRequestBatches,
} from '../../../../src/services/irc/IRCv3CapabilityRegistry';

describe('IRCMessageTags', () => {
  it('escapes and unescapes IRCv3 tag values', () => {
    const value = 'a;b c\r\nd\\e';
    const escaped = escapeIRCv3TagValue(value);

    expect(escaped).toBe('a\\:b\\sc\\r\\nd\\\\e');
    expect(unescapeIRCv3TagValue(escaped)).toBe(value);
  });

  it('parses empty values, escaped values, and keeps the first duplicate', () => {
    const tags = parseIRCv3MessageTags(
      'time=2026-05-31T10\\:00\\:00.000Z;draft/x;time=duplicate;account=alice\\sbob',
    );

    expect(tags.get('time')).toBe('2026-05-31T10;00;00.000Z');
    expect(tags.get('draft/x')).toBe('');
    expect(tags.get('account')).toBe('alice bob');
  });

  it('serializes tag maps', () => {
    const tags = new Map([
      ['+draft/reply', 'mid 1'],
      ['draft/empty', ''],
    ]);

    expect(serializeIRCv3MessageTags(tags)).toBe(
      '@+draft/reply=mid\\s1;draft/empty',
    );
  });

  it('splits a full IRCv3 line into tags and message line', () => {
    const parsed = parseIRCv3MessageLine(
      '@msgid=abc;account=alice :a!u@h PRIVMSG #c :hello',
    );

    expect(parsed.tags.get('msgid')).toBe('abc');
    expect(parsed.messageLine).toBe(':a!u@h PRIVMSG #c :hello');
  });

  it('builds client tag prefixes with deny filtering', () => {
    const prefix = buildIRCv3ClientTagPrefix(
      {
        '+draft/reply': 'msgid-1',
        '+typing': 'active',
      },
      tag => tag !== '+typing',
    );

    expect(prefix).toBe('@+draft/reply=msgid-1 ');
  });
});

describe('IRCv3CapabilityRegistry', () => {
  it('selects requested capabilities and splits long CAP REQ batches', () => {
    const available = new Set([
      'server-time',
      'sasl',
      'message-tags',
      'draft/metadata-2',
      'no-implicit-names',
      'draft/extended-isupport',
      'draft/pre-away',
    ]);

    const selected = selectCapabilitiesToRequest(available, {
      sasl: { account: 'alice', password: 'secret' },
      preAway: 'offline',
    });

    expect(selected).toEqual(
      expect.arrayContaining([
        'server-time',
        'message-tags',
        'sasl',
        'draft/metadata-2',
        'no-implicit-names',
        'draft/extended-isupport',
        'draft/pre-away',
      ]),
    );
    expect(splitCapabilityRequestBatches(selected, 25).length).toBeGreaterThan(
      1,
    );
  });

  it('requests draft/multiline and batch when the server offers them', () => {
    const selected = selectCapabilitiesToRequest(
      new Set(['draft/multiline', 'batch', 'server-time']),
    );
    expect(selected).toEqual(
      expect.arrayContaining(['draft/multiline', 'batch', 'server-time']),
    );
  });

  it('does not request typing as a capability (it is a client tag)', () => {
    const selected = selectCapabilitiesToRequest(
      new Set(['typing', 'draft/typing', 'message-tags']),
    );
    expect(selected).toEqual(['message-tags']);
  });
});
