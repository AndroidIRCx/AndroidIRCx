/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  DEFAULT_MESSAGE_FORMATS,
  AVAILABLE_MESSAGE_FORMAT_TOKENS,
  getDefaultMessageFormats,
} from '../../src/utils/MessageFormatDefaults';

describe('MessageFormatDefaults', () => {
  describe('DEFAULT_MESSAGE_FORMATS', () => {
    it('should export DEFAULT_MESSAGE_FORMATS constant', () => {
      expect(DEFAULT_MESSAGE_FORMATS).toBeDefined();
      expect(typeof DEFAULT_MESSAGE_FORMATS).toBe('object');
    });

    it('should have all required message format types', () => {
      const expectedTypes = [
        'message',
        'messageMention',
        'action',
        'actionMention',
        'notice',
        'event',
        'join',
        'part',
        'quit',
        'kick',
        'nick',
        'invite',
        'monitor',
        'mode',
        'topic',
        'raw',
        'error',
        'ctcp',
      ];

      expectedTypes.forEach(type => {
        expect(DEFAULT_MESSAGE_FORMATS).toHaveProperty(type);
        expect(
          Array.isArray(
            DEFAULT_MESSAGE_FORMATS[
              type as keyof typeof DEFAULT_MESSAGE_FORMATS
            ],
          ),
        ).toBe(true);
      });
    });

    it('should have correct format for regular message', () => {
      const messageFormat = DEFAULT_MESSAGE_FORMATS.message;

      expect(messageFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'nick' },
        { type: 'text', value: ': ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for action (/me)', () => {
      const actionFormat = DEFAULT_MESSAGE_FORMATS.action;

      expect(actionFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] * ' },
        { type: 'token', value: 'nick' },
        { type: 'text', value: ' ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for notice', () => {
      const noticeFormat = DEFAULT_MESSAGE_FORMATS.notice;

      expect(noticeFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] -' },
        { type: 'token', value: 'nick' },
        { type: 'text', value: '- ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for join event', () => {
      const joinFormat = DEFAULT_MESSAGE_FORMATS.join;

      expect(joinFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for nick change', () => {
      const nickFormat = DEFAULT_MESSAGE_FORMATS.nick;

      expect(nickFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'oldnick' },
        { type: 'text', value: ' -> ' },
        { type: 'token', value: 'newnick' },
      ]);
    });

    it('should have correct format for kick event', () => {
      const kickFormat = DEFAULT_MESSAGE_FORMATS.kick;

      expect(kickFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for quit event', () => {
      const quitFormat = DEFAULT_MESSAGE_FORMATS.quit;

      expect(quitFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for mode change', () => {
      const modeFormat = DEFAULT_MESSAGE_FORMATS.mode;

      expect(modeFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for topic change', () => {
      const topicFormat = DEFAULT_MESSAGE_FORMATS.topic;

      expect(topicFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for raw messages', () => {
      const rawFormat = DEFAULT_MESSAGE_FORMATS.raw;

      expect(rawFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for error messages', () => {
      const errorFormat = DEFAULT_MESSAGE_FORMATS.error;

      expect(errorFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for ctcp messages', () => {
      const ctcpFormat = DEFAULT_MESSAGE_FORMATS.ctcp;

      expect(ctcpFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for part event', () => {
      const partFormat = DEFAULT_MESSAGE_FORMATS.part;

      expect(partFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for event messages', () => {
      const eventFormat = DEFAULT_MESSAGE_FORMATS.event;

      expect(eventFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for invite messages', () => {
      const inviteFormat = DEFAULT_MESSAGE_FORMATS.invite;

      expect(inviteFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have correct format for monitor messages', () => {
      const monitorFormat = DEFAULT_MESSAGE_FORMATS.monitor;

      expect(monitorFormat).toEqual([
        { type: 'text', value: '[' },
        { type: 'token', value: 'time' },
        { type: 'text', value: '] ' },
        { type: 'token', value: 'message' },
      ]);
    });

    it('should have messageMention format identical to message', () => {
      expect(DEFAULT_MESSAGE_FORMATS.messageMention).toEqual(
        DEFAULT_MESSAGE_FORMATS.message,
      );
    });

    it('should have actionMention format identical to action', () => {
      expect(DEFAULT_MESSAGE_FORMATS.actionMention).toEqual(
        DEFAULT_MESSAGE_FORMATS.action,
      );
    });

    it('should have exactly 18 format types', () => {
      const formatKeys = Object.keys(DEFAULT_MESSAGE_FORMATS);
      expect(formatKeys).toHaveLength(18);
    });
  });

  describe('AVAILABLE_MESSAGE_FORMAT_TOKENS', () => {
    it('should export AVAILABLE_MESSAGE_FORMAT_TOKENS constant', () => {
      expect(AVAILABLE_MESSAGE_FORMAT_TOKENS).toBeDefined();
      expect(Array.isArray(AVAILABLE_MESSAGE_FORMAT_TOKENS)).toBe(true);
    });

    it('should contain all expected tokens', () => {
      const expectedTokens = [
        'time',
        'nick',
        'oldnick',
        'newnick',
        'message',
        'channel',
        'network',
        'account',
        'username',
        'hostname',
        'hostmask',
        'target',
        'mode',
        'topic',
        'reason',
        'numeric',
        'command',
      ];

      const tokenValues = AVAILABLE_MESSAGE_FORMAT_TOKENS.map(t => t.value);

      expectedTokens.forEach(token => {
        expect(tokenValues).toContain(token);
      });
    });

    it('should have all tokens with type "token"', () => {
      AVAILABLE_MESSAGE_FORMAT_TOKENS.forEach(token => {
        expect(token.type).toBe('token');
      });
    });

    it('should have exactly 17 available tokens', () => {
      expect(AVAILABLE_MESSAGE_FORMAT_TOKENS).toHaveLength(17);
    });

    it('should contain time token as first element', () => {
      expect(AVAILABLE_MESSAGE_FORMAT_TOKENS[0]).toEqual({
        type: 'token',
        value: 'time',
      });
    });

    it('should contain nick token as second element', () => {
      expect(AVAILABLE_MESSAGE_FORMAT_TOKENS[1]).toEqual({
        type: 'token',
        value: 'nick',
      });
    });

    it('should contain message token', () => {
      const messageToken = AVAILABLE_MESSAGE_FORMAT_TOKENS.find(
        t => t.value === 'message',
      );
      expect(messageToken).toEqual({
        type: 'token',
        value: 'message',
      });
    });

    it('should contain channel token', () => {
      const channelToken = AVAILABLE_MESSAGE_FORMAT_TOKENS.find(
        t => t.value === 'channel',
      );
      expect(channelToken).toEqual({
        type: 'token',
        value: 'channel',
      });
    });

    it('should contain reason token', () => {
      const reasonToken = AVAILABLE_MESSAGE_FORMAT_TOKENS.find(
        t => t.value === 'reason',
      );
      expect(reasonToken).toEqual({
        type: 'token',
        value: 'reason',
      });
    });
  });

  describe('getDefaultMessageFormats', () => {
    it('should be exported as a function', () => {
      expect(typeof getDefaultMessageFormats).toBe('function');
    });

    it('should return a copy of DEFAULT_MESSAGE_FORMATS', () => {
      const formats = getDefaultMessageFormats();

      expect(formats).toEqual(DEFAULT_MESSAGE_FORMATS);
      expect(formats).not.toBe(DEFAULT_MESSAGE_FORMATS);
    });

    it('should return a deep copy (modifications do not affect original)', () => {
      const formats = getDefaultMessageFormats();

      // Modify the returned object
      formats.message[0].value = 'MODIFIED';

      // Original should be unchanged
      expect(DEFAULT_MESSAGE_FORMATS.message[0].value).toBe('[');
    });

    it('should return object with all format types', () => {
      const formats = getDefaultMessageFormats();

      expect(formats).toHaveProperty('message');
      expect(formats).toHaveProperty('action');
      expect(formats).toHaveProperty('notice');
      expect(formats).toHaveProperty('join');
      expect(formats).toHaveProperty('nick');
    });

    it('should return new copy on each call', () => {
      const formats1 = getDefaultMessageFormats();
      const formats2 = getDefaultMessageFormats();

      expect(formats1).toEqual(formats2);
      expect(formats1).not.toBe(formats2);
    });

    it('should return independent copies', () => {
      const formats1 = getDefaultMessageFormats();
      const formats2 = getDefaultMessageFormats();

      // Modify first copy
      formats1.message.push({ type: 'text', value: 'EXTRA' });

      // Second copy should be unchanged
      expect(formats2.message).toHaveLength(6);
      expect(formats1.message).toHaveLength(7);
    });
  });
});
