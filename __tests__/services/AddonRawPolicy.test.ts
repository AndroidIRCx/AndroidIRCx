/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  byteLengthOf,
  fingerprintLine,
  isTransportCritical,
  MAX_LINE_BYTES,
  rawCommandOf,
  sanitizeOutboundLine,
} from '../../src/services/scripting/AddonRawPolicy';

describe('AddonRawPolicy', () => {
  describe('rawCommandOf', () => {
    it('reads the command from a plain line', () => {
      expect(rawCommandOf('privmsg #chan :hi')).toBe('PRIVMSG');
      expect(rawCommandOf('  JOIN #chan')).toBe('JOIN');
      expect(rawCommandOf('QUIT')).toBe('QUIT');
      expect(rawCommandOf('')).toBe('');
    });

    it('sees past an IRCv3 tag prefix and a source prefix', () => {
      expect(rawCommandOf('@label=1 CAP END')).toBe('CAP');
      expect(rawCommandOf(':server.example PING :x')).toBe('PING');
      expect(rawCommandOf('@a=b :nick!u@h PRIVMSG #c :hi')).toBe('PRIVMSG');
    });
  });

  describe('isTransportCritical', () => {
    it.each([
      'PING :x',
      'PONG :x',
      'CAP END',
      'AUTHENTICATE PLAIN',
      'ERROR :x',
      'PASS secret',
    ])('protects %s', line => expect(isTransportCritical(line)).toBe(true));

    it('leaves ordinary traffic alone', () => {
      expect(isTransportCritical('PRIVMSG #chan :hi')).toBe(false);
      expect(isTransportCritical('JOIN #chan')).toBe(false);
    });

    it('still protects a line disguised behind a prefix', () => {
      // An addon returning this must not be able to reach CAP by hiding it.
      expect(isTransportCritical('@x=1 cap end')).toBe(true);
    });
  });

  describe('sanitizeOutboundLine', () => {
    it('passes an ordinary line through unchanged', () => {
      expect(sanitizeOutboundLine('PRIVMSG #chan :hello')).toEqual({
        line: 'PRIVMSG #chan :hello',
        truncated: false,
      });
    });

    it.each([
      ['a carriage return', 'PRIVMSG #a :hi\rQUIT', 'line-break'],
      ['a line feed', 'PRIVMSG #a :hi\nJOIN #evil', 'line-break'],
      ['a NUL', 'PRIVMSG #a :hi\0there', 'control-characters'],
    ])('refuses %s rather than repairing it', (_label, line, reason) => {
      // Stripping would hide a deliberate attempt to smuggle a second command.
      expect(sanitizeOutboundLine(line)).toEqual({
        line: null,
        truncated: false,
        rejected: reason,
      });
    });

    it('refuses an empty or blank line', () => {
      expect(sanitizeOutboundLine('').rejected).toBe('empty');
      expect(sanitizeOutboundLine('   ').rejected).toBe('empty');
      expect(sanitizeOutboundLine(undefined as any).rejected).toBe('empty');
    });

    it('truncates rather than drops when the line is too long', () => {
      const long = `PRIVMSG #chan :${'a'.repeat(600)}`;
      const result = sanitizeOutboundLine(long);
      expect(result.truncated).toBe(true);
      expect(byteLengthOf(result.line as string)).toBeLessThanOrEqual(
        MAX_LINE_BYTES,
      );
      expect(result.line).toMatch(/^PRIVMSG #chan :a+$/);
    });

    it('never splits a multi-byte character when truncating', () => {
      const result = sanitizeOutboundLine(`PRIVMSG #c :${'😀'.repeat(200)}`);
      expect(result.truncated).toBe(true);
      // A split surrogate pair would show as a replacement character.
      expect(result.line).not.toMatch(/�/);
      expect([...(result.line as string)].every(c => c !== '\uD83D')).toBe(
        true,
      );
      expect(byteLengthOf(result.line as string)).toBeLessThanOrEqual(
        MAX_LINE_BYTES,
      );
    });

    it('measures the limit in bytes, not characters', () => {
      // 300 two-byte characters is 600 bytes even though it is 300 chars.
      const result = sanitizeOutboundLine(`PRIVMSG #c :${'ž'.repeat(300)}`);
      expect(result.truncated).toBe(true);
    });
  });

  describe('fingerprintLine', () => {
    it('is stable and distinguishes different lines', () => {
      expect(fingerprintLine('PRIVMSG #a :hi')).toBe(
        fingerprintLine('PRIVMSG #a :hi'),
      );
      expect(fingerprintLine('PRIVMSG #a :hi')).not.toBe(
        fingerprintLine('PRIVMSG #a :ho'),
      );
      expect(fingerprintLine('x')).toMatch(/^[0-9a-f]{8}$/);
    });
  });
});
