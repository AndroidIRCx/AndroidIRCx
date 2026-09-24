/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  foldNick,
  matchesHostmask,
  matchesWildcard,
  parseMask,
} from '../../src/services/scripting/AddonUserMask';

describe('AddonUserMask', () => {
  describe('parseMask', () => {
    it('splits a full mask', () => {
      expect(parseMask('nick!ident@host.example')).toEqual({
        nick: 'nick',
        ident: 'ident',
        host: 'host.example',
      });
    });

    it('treats a bare word as a nick pattern', () => {
      expect(parseMask('fred')).toEqual({
        nick: 'fred',
        ident: '*',
        host: '*',
      });
    });

    it('treats a leading @ form as ident@host', () => {
      expect(parseMask('ident@host')).toEqual({
        nick: '*',
        ident: 'ident',
        host: 'host',
      });
    });

    it('fills missing components with a wildcard', () => {
      expect(parseMask('nick!')).toEqual({
        nick: 'nick',
        ident: '*',
        host: '*',
      });
      expect(parseMask('!@')).toEqual({ nick: '*', ident: '*', host: '*' });
      expect(parseMask('')).toEqual({ nick: '*', ident: '*', host: '*' });
    });

    it('keeps the host when it contains an @', () => {
      // Splitting on the first @ only, so a host is never truncated.
      expect(parseMask('n!i@a@b').host).toBe('a@b');
    });
  });

  describe('matchesWildcard', () => {
    it('handles * and ? and is case-insensitive', () => {
      expect(matchesWildcard('anything', '*')).toBe(true);
      expect(matchesWildcard('fred', 'fr*')).toBe(true);
      expect(matchesWildcard('fred', 'f?ed')).toBe(true);
      expect(matchesWildcard('fred', 'f?d')).toBe(false);
      expect(matchesWildcard('FRED', 'fred')).toBe(true);
    });

    it('does not let regex metacharacters in a mask act as regex', () => {
      expect(matchesWildcard('a.c', 'a.c')).toBe(true);
      expect(matchesWildcard('abc', 'a.c')).toBe(false);
      expect(matchesWildcard('a+b', 'a+b')).toBe(true);
    });
  });

  describe('matchesHostmask', () => {
    const user = { nick: 'fred', ident: 'fred', host: 'host.example.com' };

    it('matches the usual ban shapes', () => {
      expect(matchesHostmask(user, '*!*@host.example.com')).toBe(true);
      expect(matchesHostmask(user, '*!*@*.example.com')).toBe(true);
      expect(matchesHostmask(user, 'fred!*@*')).toBe(true);
      expect(matchesHostmask(user, '*!*@*')).toBe(true);
    });

    it('does not match a different user', () => {
      expect(matchesHostmask(user, '*!*@other.example.com')).toBe(false);
      expect(matchesHostmask(user, 'barney!*@*')).toBe(false);
    });

    it('refuses to match a component it has no value for', () => {
      // Claiming a match on data we do not have would make a ban look like it
      // covers someone it does not.
      expect(matchesHostmask({ nick: 'fred' }, '*!*@host.example.com')).toBe(
        false,
      );
      expect(matchesHostmask({ nick: 'fred' }, 'fred!*@*')).toBe(true);
    });
  });

  describe('foldNick', () => {
    it('folds case', () => {
      expect(foldNick('FRED')).toBe('fred');
    });

    it('folds the rfc1459 bracket characters by default', () => {
      expect(foldNick('a[b]c\\d~e')).toBe('a{b}c|d^e');
    });

    it('leaves ~ alone under rfc1459-strict and brackets alone under ascii', () => {
      expect(foldNick('a~b', 'rfc1459-strict')).toBe('a~b');
      expect(foldNick('a[b]', 'ascii')).toBe('a[b]');
    });
  });
});
