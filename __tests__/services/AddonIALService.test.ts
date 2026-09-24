/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonIALService,
  MAX_FIND_RESULTS,
  ORPHAN_GRACE_MS,
  REFRESH_COOLDOWN_MS,
} from '../../src/services/scripting/AddonIALService';

const NET = 'net1';

describe('AddonIALService', () => {
  let ial: AddonIALService;

  beforeEach(() => {
    ial = new AddonIALService();
  });

  describe('merging facts', () => {
    it('keeps a stronger fact when a weaker source reports something else', () => {
      ial.observe(NET, 'fred', { host: 'real.example' }, 'whois');
      ial.observe(NET, 'fred', { host: 'guessed.example' }, 'names');

      // Otherwise the record degrades every time someone rejoins a channel.
      expect(ial.get(NET, 'fred')?.host).toBe('real.example');
      expect(ial.get(NET, 'fred')?.provenance.host.source).toBe('whois');
    });

    it('lets an equal or stronger source win, because it is more current', () => {
      ial.observe(NET, 'fred', { host: 'old.example' }, 'who');
      ial.observe(NET, 'fred', { host: 'newer.example' }, 'who');
      expect(ial.get(NET, 'fred')?.host).toBe('newer.example');

      ial.observe(NET, 'fred', { host: 'whois.example' }, 'whois');
      expect(ial.get(NET, 'fred')?.host).toBe('whois.example');
    });

    it('merges per field rather than per record', () => {
      ial.observe(NET, 'fred', { host: 'strong.example' }, 'whois');
      ial.observe(
        NET,
        'fred',
        { ident: 'fred', account: 'fredacct' },
        'message',
      );

      const record = ial.get(NET, 'fred');
      expect(record?.host).toBe('strong.example');
      expect(record?.ident).toBe('fred');
      expect(record?.account).toBe('fredacct');
    });

    it('treats a null account as a fact, not as absence', () => {
      ial.observe(NET, 'fred', { account: 'fredacct' }, 'whois');
      ial.observe(NET, 'fred', { account: null }, 'whois');
      // The server saying "logged out" is information worth keeping.
      expect(ial.get(NET, 'fred')?.account).toBeNull();
    });

    it('ignores undefined fields instead of erasing what is known', () => {
      ial.observe(NET, 'fred', { host: 'h.example' }, 'who');
      ial.observe(NET, 'fred', { ident: 'i' }, 'who');
      expect(ial.get(NET, 'fred')?.host).toBe('h.example');
    });

    it('tracks the latest spelling of a nick under one identity', () => {
      ial.observe(NET, 'fred', {}, 'message');
      ial.observe(NET, 'FRED', {}, 'message');
      expect(ial.size(NET)).toBe(1);
      // Looked up under any casing, and reports the spelling seen last.
      expect(ial.get(NET, 'fred')?.nick).toBe('FRED');
    });
  });

  describe('channel membership', () => {
    it('records members and their prefix modes from a snapshot', () => {
      ial.syncChannel(NET, '#a', [
        { nick: 'fred', modes: ['o'], ident: 'f', host: 'h' },
        { nick: 'barney' },
      ]);

      expect(
        ial
          .onChannel(NET, '#a')
          .map(r => r.nick)
          .sort(),
      ).toEqual(['barney', 'fred']);
      expect(ial.get(NET, 'fred')?.channelModes['#a']).toEqual(['o']);
    });

    it('removes a member missing from a later snapshot', () => {
      ial.syncChannel(NET, '#a', [{ nick: 'fred' }, { nick: 'barney' }]);
      ial.syncChannel(NET, '#a', [{ nick: 'fred' }]);

      expect(ial.onChannel(NET, '#a').map(r => r.nick)).toEqual(['fred']);
      expect(ial.sharedChannels(NET, 'barney')).toEqual([]);
    });

    it('only detaches the channel that was synced', () => {
      ial.join(NET, 'fred', '#a');
      ial.join(NET, 'fred', '#b');
      ial.syncChannel(NET, '#a', []);

      expect(ial.sharedChannels(NET, 'fred')).toEqual(['#b']);
    });

    it('tracks joins, parts and shared channels', () => {
      ial.join(NET, 'fred', '#a', { ident: 'f', host: 'h' });
      ial.join(NET, 'fred', '#b');
      expect(ial.sharedChannels(NET, 'fred')).toEqual(['#a', '#b']);

      ial.part(NET, 'fred', '#a');
      expect(ial.sharedChannels(NET, 'fred')).toEqual(['#b']);
    });

    it('records channel modes set later', () => {
      ial.join(NET, 'fred', '#a');
      ial.setChannelModes(NET, 'fred', '#a', ['o', 'v']);
      expect(ial.get(NET, 'fred')?.channelModes['#a']).toEqual(['o', 'v']);
    });
  });

  describe('nick changes', () => {
    it('carries the whole identity across a rename', () => {
      ial.observe(
        NET,
        'fred',
        { host: 'h.example', account: 'fredacct' },
        'whois',
      );
      ial.join(NET, 'fred', '#a');
      ial.rename(NET, 'fred', 'barney');

      expect(ial.get(NET, 'fred')).toBeUndefined();
      const record = ial.get(NET, 'barney');
      // A nick change does not change who someone is - which is exactly why
      // account and certfp are the facts worth trusting.
      expect(record?.host).toBe('h.example');
      expect(record?.account).toBe('fredacct');
      expect(record?.channels).toEqual(['#a']);
    });

    it('does nothing when the old nick is unknown', () => {
      ial.rename(NET, 'ghost', 'barney');
      expect(ial.get(NET, 'barney')).toBeUndefined();
    });
  });

  describe('expiry', () => {
    it('keeps a quitting user through the grace window, then drops them', () => {
      const now = Date.now();
      ial.join(NET, 'fred', '#a', {}, now);
      ial.quit(NET, 'fred', now);

      // A script reacting to the quit can still ask who it was.
      expect(ial.get(NET, 'fred')).toBeTruthy();
      expect(ial.prune(now + ORPHAN_GRACE_MS - 1)).toBe(0);
      expect(ial.prune(now + ORPHAN_GRACE_MS + 1)).toBe(1);
      expect(ial.get(NET, 'fred')).toBeUndefined();
    });

    it('does not expire a user still on a channel', () => {
      const now = Date.now();
      ial.join(NET, 'fred', '#a', {}, now);
      ial.join(NET, 'fred', '#b', {}, now);
      ial.part(NET, 'fred', '#a', now);

      expect(ial.prune(now + ORPHAN_GRACE_MS + 1)).toBe(0);
      expect(ial.get(NET, 'fred')).toBeTruthy();
    });

    it('revives an orphan who rejoins before the window closes', () => {
      const now = Date.now();
      ial.join(NET, 'fred', '#a', {}, now);
      ial.part(NET, 'fred', '#a', now);
      ial.join(NET, 'fred', '#a', {}, now + 1000);

      expect(ial.prune(now + ORPHAN_GRACE_MS + 1)).toBe(0);
      expect(ial.get(NET, 'fred')).toBeTruthy();
    });
  });

  describe('queries', () => {
    beforeEach(() => {
      ial.syncChannel(NET, '#a', [
        { nick: 'fred', ident: 'fred', host: 'a.example.com' },
        { nick: 'barney', ident: 'barney', host: 'b.example.com' },
      ]);
      ial.observe(NET, 'fred', { account: 'fredacct', away: true }, 'whois');
    });

    it('finds by mask', () => {
      expect(ial.find(NET, '*!*@a.example.com').map(r => r.nick)).toEqual([
        'fred',
      ]);
      expect(ial.find(NET, '*!*@*.example.com')).toHaveLength(2);
    });

    it('filters by account, channel and away', () => {
      expect(
        ial.find(NET, '*', { account: 'fredacct' }).map(r => r.nick),
      ).toEqual(['fred']);
      expect(ial.find(NET, '*', { away: true }).map(r => r.nick)).toEqual([
        'fred',
      ]);
      expect(ial.find(NET, '*', { channel: '#a' })).toHaveLength(2);
      expect(ial.find(NET, '*', { channel: '#nope' })).toHaveLength(0);
    });

    it('bounds the result count however large the request', () => {
      for (let index = 0; index < 20; index += 1)
        ial.observe(NET, `user${index}`, {}, 'names');

      expect(ial.find(NET, '*', { limit: 5 })).toHaveLength(5);
      expect(ial.find(NET, '*', { limit: 10_000 }).length).toBeLessThanOrEqual(
        MAX_FIND_RESULTS,
      );
      expect(ial.find(NET, '*', { limit: 0 })).toHaveLength(1);
    });

    it('returns copies, so a caller cannot edit the cache', () => {
      const record = ial.get(NET, 'fred');
      record!.host = 'tampered';
      record!.channels.push('#injected');
      expect(ial.get(NET, 'fred')?.host).toBe('a.example.com');
      expect(ial.sharedChannels(NET, 'fred')).toEqual(['#a']);
    });

    it('keeps networks separate', () => {
      expect(ial.get('other', 'fred')).toBeUndefined();
      ial.clearNetwork(NET);
      expect(ial.get(NET, 'fred')).toBeUndefined();
    });
  });

  describe('refresh throttle', () => {
    it('allows one refresh per nick per cooldown window', () => {
      const now = Date.now();
      expect(ial.shouldRefresh(NET, 'fred', now)).toBe(true);
      expect(ial.shouldRefresh(NET, 'fred', now + 1)).toBe(false);
      expect(
        ial.shouldRefresh(NET, 'fred', now + REFRESH_COOLDOWN_MS + 1),
      ).toBe(true);
    });

    it('throttles per nick, not globally', () => {
      const now = Date.now();
      expect(ial.shouldRefresh(NET, 'fred', now)).toBe(true);
      expect(ial.shouldRefresh(NET, 'barney', now)).toBe(true);
    });

    it('never sends anything itself', () => {
      // The whole service is cache-only; this test exists to pin that down.
      expect(Object.keys(ial)).not.toContain('sendRaw');
      expect(typeof (ial as any).sendRaw).toBe('undefined');
    });
  });

  describe('casemapping', () => {
    it('treats rfc1459 equivalent nicks as one user', () => {
      ial.observe(NET, 'fred[x]', { host: 'h' }, 'whois');
      expect(ial.get(NET, 'fred{x}')?.host).toBe('h');
    });

    it('respects an ascii casemapping from ISUPPORT', () => {
      ial.setCasemapping(NET, 'ascii');
      ial.observe(NET, 'fred[x]', { host: 'h' }, 'whois');
      expect(ial.get(NET, 'fred{x}')).toBeUndefined();
      expect(ial.get(NET, 'FRED[X]')?.host).toBe('h');
    });
  });
});
