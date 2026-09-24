/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonTrustRules,
  MAX_RULES_PER_ADDON,
} from '../../src/services/scripting/AddonTrustRules';

const NET = 'net1';
const ADDON = 'test.addon';

const user = {
  nick: 'fred',
  ident: 'fred',
  host: 'trusted.example.com',
  account: 'fredacct',
  certfp: 'AABBCC',
};

describe('AddonTrustRules', () => {
  let trust: AddonTrustRules;

  beforeEach(() => {
    trust = new AddonTrustRules();
  });

  const rule = (over: Partial<Parameters<AddonTrustRules['add']>[0]> = {}) =>
    trust.add({
      addonId: ADDON,
      networkId: NET,
      kind: 'account',
      value: 'fredacct',
      effect: 'allow',
      label: 'moderator',
      ...over,
    });

  describe('adding rules', () => {
    it('marks a nick-only rule weak and the others strong', () => {
      // Anyone can take a nick the moment its owner disconnects.
      expect(rule({ kind: 'nick', value: 'fred' }).weak).toBe(true);
      expect(rule({ kind: 'hostmask', value: '*!*@x' }).weak).toBe(false);
      expect(rule({ kind: 'account' }).weak).toBe(false);
      expect(rule({ kind: 'certfp', value: 'AABBCC' }).weak).toBe(false);
    });

    it('refuses an empty value, a bad label and an unknown kind', () => {
      expect(() => rule({ value: '   ' })).toThrow(/value/i);
      expect(() => rule({ label: 'not a label!' })).toThrow(/label/i);
      expect(() => rule({ kind: 'whatever' as any })).toThrow(/kind/i);
    });

    it('bounds how many rules one addon may hold', () => {
      for (let index = 0; index < MAX_RULES_PER_ADDON; index += 1)
        rule({ kind: 'nick', value: `n${index}` });
      expect(() => rule({ kind: 'nick', value: 'overflow' })).toThrow(/limit/i);
    });
  });

  describe('evaluate', () => {
    it('returns nothing when no rule matches', () => {
      rule({ kind: 'account', value: 'someone-else' });
      expect(trust.evaluate(ADDON, NET, user)).toBeUndefined();
    });

    it('matches on account, certfp, hostmask and nick', () => {
      expect(trust.evaluate(ADDON, NET, user)).toBeUndefined();
      rule({ kind: 'account', value: 'FREDACCT' });
      expect(trust.evaluate(ADDON, NET, user)?.label).toBe('moderator');

      trust.resetForTests();
      rule({ kind: 'certfp', value: 'aabbcc' });
      expect(trust.evaluate(ADDON, NET, user)?.effect).toBe('allow');

      trust.resetForTests();
      rule({ kind: 'hostmask', value: '*!*@trusted.example.com' });
      expect(trust.evaluate(ADDON, NET, user)?.effect).toBe('allow');

      trust.resetForTests();
      rule({ kind: 'nick', value: 'FRED' });
      expect(trust.evaluate(ADDON, NET, user)?.weak).toBe(true);
    });

    it('never matches an account rule against a logged-out user', () => {
      rule({ kind: 'account', value: 'fredacct' });
      // A null account is the server saying "logged out", which is a fact.
      expect(
        trust.evaluate(ADDON, NET, { ...user, account: null }),
      ).toBeUndefined();
      expect(
        trust.evaluate(ADDON, NET, { ...user, account: undefined }),
      ).toBeUndefined();
    });

    it('lets the strongest kind win, not the most recent rule', () => {
      rule({
        kind: 'certfp',
        value: 'AABBCC',
        effect: 'allow',
        label: 'owner',
      });
      rule({ kind: 'nick', value: 'fred', effect: 'deny', label: 'banned' });

      // A certfp rule must not be overridden by someone registering a nick.
      const decision = trust.evaluate(ADDON, NET, user);
      expect(decision?.effect).toBe('allow');
      expect(decision?.label).toBe('owner');
      expect(decision?.weak).toBe(false);
    });

    it('lets deny win a tie within one kind', () => {
      rule({ kind: 'account', value: 'fredacct', effect: 'allow', label: 'a' });
      rule({ kind: 'account', value: 'fredacct', effect: 'deny', label: 'd' });
      // Refusing on a tie is the safe way to be wrong.
      expect(trust.evaluate(ADDON, NET, user)?.effect).toBe('deny');
    });

    it('keeps one addon out of another addon rules, and one network out of another', () => {
      rule({ kind: 'account', value: 'fredacct' });
      expect(trust.evaluate('other.addon', NET, user)).toBeUndefined();
      expect(trust.evaluate(ADDON, 'other-net', user)).toBeUndefined();
    });

    it('returns a copy of the rule', () => {
      rule({ kind: 'account', value: 'fredacct' });
      const decision = trust.evaluate(ADDON, NET, user)!;
      decision.rule.effect = 'deny';
      expect(trust.evaluate(ADDON, NET, user)?.effect).toBe('allow');
    });
  });

  describe('managing rules', () => {
    it('lists, removes and clears per addon', () => {
      const first = rule({ kind: 'nick', value: 'a' });
      rule({ kind: 'nick', value: 'b' });
      trust.add({
        addonId: 'other.addon',
        networkId: NET,
        kind: 'nick',
        value: 'c',
        effect: 'allow',
        label: 'x',
      });

      expect(trust.list(ADDON)).toHaveLength(2);
      expect(trust.list(ADDON, 'other-net')).toHaveLength(0);

      expect(trust.remove(ADDON, first.id)).toBe(true);
      expect(trust.remove(ADDON, first.id)).toBe(false);
      // One addon must not be able to delete another addon's rule.
      expect(trust.remove(ADDON, trust.list('other.addon')[0].id)).toBe(false);

      trust.clear(ADDON);
      expect(trust.list(ADDON)).toHaveLength(0);
      expect(trust.list('other.addon')).toHaveLength(1);
    });
  });
});
