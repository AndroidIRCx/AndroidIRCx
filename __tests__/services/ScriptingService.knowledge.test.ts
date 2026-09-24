/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import { scriptingService } from '../../src/services/ScriptingService';
import { addonIALService } from '../../src/services/scripting/AddonIALService';
import { addonChannelKnowledge } from '../../src/services/scripting/AddonChannelKnowledge';
import { addonServerKnowledge } from '../../src/services/scripting/AddonServerKnowledge';
import { API_ENTRIES } from '../../src/config/scriptVocabulary';

const NET = 'net1';

/**
 * The L3 knowledge services are only worth anything if a script can actually
 * reach them. `onRaw` was documented, autocompleted and called from nowhere
 * for months; these tests exist so that cannot happen again.
 */
describe('ScriptingService knowledge API', () => {
  const api = () =>
    (scriptingService as any).makeApi({
      id: 'knowledge-test',
      name: 'Knowledge',
      code: '',
      enabled: true,
    });

  beforeEach(() => {
    addonIALService.resetForTests();
    addonChannelKnowledge.resetForTests();
    addonServerKnowledge.resetForTests();
    jest
      .spyOn(scriptingService as any, 'validateNetworkId')
      .mockImplementation((id: unknown) => (id as string) ?? NET);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('api.users', () => {
    beforeEach(() => {
      addonIALService.syncChannel(NET, '#a', [
        { nick: 'fred', modes: ['o'], ident: 'f', host: 'a.example.com' },
        { nick: 'barney', ident: 'b', host: 'b.example.com' },
      ]);
      addonIALService.observe(NET, 'fred', { account: 'fredacct' }, 'whois');
    });

    it('reads one user, with provenance', () => {
      const record = api().users.get('fred', NET);
      expect(record.host).toBe('a.example.com');
      expect(record.account).toBe('fredacct');
      expect(record.provenance.account.source).toBe('whois');
    });

    it('returns null rather than throwing for an unknown or invalid nick', () => {
      expect(api().users.get('nobody', NET)).toBeNull();
      expect(api().users.get('', NET)).toBeNull();
    });

    it('finds by mask and filters', () => {
      expect(api().users.find('*!*@a.example.com')).toHaveLength(1);
      expect(api().users.find('*', { account: 'fredacct' })).toHaveLength(1);
      expect(api().users.find('*', { channel: '#a' })).toHaveLength(2);
      expect(api().users.find(123 as any)).toEqual([]);
    });

    it('lists a channel and shared channels', () => {
      expect(
        api()
          .users.onChannel('#a', NET)
          .map((r: any) => r.nick)
          .sort(),
      ).toEqual(['barney', 'fred']);
      expect(api().users.sharedChannels('fred', NET)).toEqual(['#a']);
    });

    it('exposes mask matching so a script need not write its own', () => {
      const user = { nick: 'fred', ident: 'f', host: 'a.example.com' };
      expect(api().users.matchesMask(user, '*!*@a.example.com')).toBe(true);
      expect(api().users.matchesMask(user, '*!*@other')).toBe(false);
      expect(api().users.matchesMask(null as any, '*')).toBe(false);
    });
  });

  describe('api.channelState', () => {
    it('reads topic metadata and modes', () => {
      addonChannelKnowledge.setTopic(NET, '#a', {
        text: 'Hi',
        setBy: 'fred',
        setAt: 42,
      });
      addonChannelKnowledge.setModes(NET, '#a', ['n', 'l'], { l: '50' });

      const record = api().channelState.get('#a', NET);
      expect(record.topic).toEqual({ text: 'Hi', setBy: 'fred', setAt: 42 });
      expect(record.modeParams).toEqual({ l: '50' });
    });

    it('reports an unfetched list as unknown, not as empty', () => {
      // A script that treats the two the same will unban nobody and believe
      // it succeeded.
      expect(api().channelState.getList('#a', 'ban', NET).status).toBe(
        'unknown',
      );

      addonChannelKnowledge.beginList(NET, '#a', 'ban');
      addonChannelKnowledge.endList(NET, '#a', 'ban');
      expect(api().channelState.getList('#a', 'ban', NET).status).toBe(
        'cached',
      );
    });

    it('refuses an unknown list kind instead of guessing', () => {
      const result = api().channelState.getList('#a', 'nonsense' as any, NET);
      expect(result.entries).toEqual([]);
      expect(result.status).toBe('unknown');
    });
  });

  describe('api.server', () => {
    beforeEach(() => {
      addonServerKnowledge.setISupport(NET, {
        PREFIX: '(ov)@+',
        CHANTYPES: '#',
        NETWORK: 'ExampleNet',
        FUTURETOKEN: 'value',
      });
      addonServerKnowledge.setCapabilities(NET, ['sasl']);
    });

    it('exposes parsed and raw server knowledge', () => {
      expect(api().server.get(NET).networkName).toBe('ExampleNet');
      expect(api().server.hasCapability('sasl', NET)).toBe(true);
      expect(api().server.hasCapability('echo-message', NET)).toBe(false);
    });

    it('reaches a token this app does not parse', () => {
      // So a script on a new network needs no app release.
      expect(api().server.token('FUTURETOKEN', NET)).toBe('value');
      expect(api().server.token('MISSING', NET)).toBeNull();
    });

    it('identifies a channel by CHANTYPES rather than guessing at #', () => {
      expect(api().server.isChannel('#a', NET)).toBe(true);
      expect(api().server.isChannel('&a', NET)).toBe(false);
      expect(api().server.isChannel(5 as any, NET)).toBe(false);
    });
  });

  it('documents every new member in the vocabulary', () => {
    // The editor's autocomplete, the in-app help and the AI generator all read
    // this list; a member missing from it is a member nobody discovers.
    const documented = new Set(API_ENTRIES.map(entry => entry.name));
    for (const name of [
      'users.get',
      'users.find',
      'users.onChannel',
      'users.sharedChannels',
      'users.matchesMask',
      'channelState.get',
      'channelState.getList',
      'server.get',
      'server.token',
      'server.hasCapability',
      'server.isChannel',
    ])
      expect(documented).toContain(name);
  });
});
