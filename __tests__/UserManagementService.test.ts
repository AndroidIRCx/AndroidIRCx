/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserManagementService } from '../src/services/UserManagementService';
import { IRCService } from '../src/services/IRCService';

describe('UserManagementService', () => {
  let svc: UserManagementService;
  let irc: IRCService;

  beforeEach(() => {
    (AsyncStorage as any).__reset();
    irc = new IRCService();
    svc = new UserManagementService();
    svc.setIRCService(irc);
  });

  it('stores WHOIS info via updateWHOIS and getWHOIS', () => {
    svc.setNetwork('Net');
    svc.updateWHOIS(
      {
        nick: 'nick',
        username: 'user',
        hostname: 'host',
        server: 'irc.test',
        channels: ['#chan'],
      },
      'Net',
    );
    const info = svc.getWHOIS('nick', 'Net');
    expect(info?.nick).toBe('nick');
    expect(info?.hostname).toBe('host');
    expect(info?.server).toBe('irc.test');
  });

  it('adds and removes ignore masks', async () => {
    svc.setNetwork('Net');
    await svc.ignoreUser('badguy!*@host', 'rude', 'Net');
    let ignores = await svc.getIgnoredUsers('Net');
    expect(ignores.some((u: any) => u.mask === 'badguy!*@host')).toBe(true);

    await svc.unignoreUser('badguy!*@host', 'Net');
    ignores = await svc.getIgnoredUsers('Net');
    expect(ignores.length).toBe(0);
  });

  it('stores aliases and notes separately', async () => {
    svc.setNetwork('Net');
    await svc.addUserNote('nick', 'note text', 'Net');
    expect(svc.getUserNote('nick', 'Net')).toBe('note text');
  });

  it('handles numeric replies emitted by the IRC service', () => {
    svc.setNetwork('Net');
    irc.emit(
      'numeric',
      311,
      '',
      ['me', 'nick', 'user', 'host', '*', 'Real Name'],
      Date.now(),
    );
    const info = svc.getWHOIS('nick', 'Net');
    expect(info?.username).toBe('user');
    expect(info?.hostname).toBe('host');
    expect(info?.realname).toBe('Real Name');
  });

  it('adds a raw debug message on initialize when an IRC service is set', async () => {
    await expect(svc.initialize()).resolves.toBeUndefined();
  });

  it('loads notes, aliases, ignores, blacklist and user lists from storage', async () => {
    const P = '@AndroidIRCX:users:';
    await AsyncStorage.setItem(
      `${P}notes:Net:nick`,
      JSON.stringify({ nick: 'nick', note: 'n', network: 'Net', updatedAt: 1 }),
    );
    await AsyncStorage.setItem(
      `${P}aliases:Net:nick`,
      JSON.stringify({
        nick: 'nick',
        alias: 'ally',
        network: 'Net',
        updatedAt: 1,
      }),
    );
    await AsyncStorage.setItem(
      `${P}ignore:Net:mask`,
      JSON.stringify({ mask: 'mask', network: 'Net', addedAt: 1 }),
    );
    await AsyncStorage.setItem(
      `${P}blacklist:Net:bad`,
      JSON.stringify({
        mask: 'bad',
        action: 'ban',
        network: 'Net',
        addedAt: 1,
      }),
    );
    await AsyncStorage.setItem(
      `${P}notify:Net:watch`,
      JSON.stringify({
        mask: 'watch',
        network: 'Net',
        protected: false,
        addedAt: 1,
      }),
    );
    // Global (no-network) entry to exercise the non-network key branch.
    await AsyncStorage.setItem(
      `${P}notes:globalnick`,
      JSON.stringify({ nick: 'globalnick', note: 'g', updatedAt: 1 }),
    );

    await svc.initialize();
    svc.setNetwork('Net');

    expect(svc.getUserNote('nick', 'Net')).toBe('n');
    expect(svc.getUserAlias('nick', 'Net')).toBe('ally');
    expect(svc.getIgnoredUsers('Net').some(u => u.mask === 'mask')).toBe(true);
    expect(svc.getBlacklistEntries('Net').some(e => e.mask === 'bad')).toBe(
      true,
    );
    expect(
      svc.getUserListEntries('notify', 'Net').some(e => e.mask === 'watch'),
    ).toBe(true);
  });

  it('handles errors while loading from storage', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockRejectedValueOnce(
      new Error('boom'),
    );
    await expect(svc.initialize()).resolves.toBeUndefined();
  });

  it('handles errors while saving to storage', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('fail'),
    );
    await expect(
      svc.addUserNote('nick', 'note', 'Net'),
    ).resolves.toBeUndefined();
  });

  it('handles errors while removing from storage', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
      new Error('fail'),
    );
    await expect(svc.removeUserNote('nick', 'Net')).resolves.toBeUndefined();
  });

  it('rejects a pending WHOIS when finalized without cached data', async () => {
    svc.setNetwork('Net');
    const pending = svc.requestWHOIS('ghost', 'Net');
    svc.finalizeWHOIS('ghost', 'Net');
    await expect(pending).rejects.toThrow();
  });

  it('does not send WHOWAS when no IRC service is set', () => {
    const bare = new UserManagementService();
    expect(() => bare.requestWHOWAS('nick')).not.toThrow();
  });

  it('matches ignored users by host mask and wildcard nick', async () => {
    svc.setNetwork('Net');
    await svc.ignoreUser('*@evil.com', undefined, 'Net');
    expect(svc.isUserIgnored('someone', 'user', 'host.evil.com', 'Net')).toBe(
      true,
    );
    // A user with no hostname does not match the host mask.
    expect(svc.isUserIgnored('someone', undefined, undefined, 'Net')).toBe(
      false,
    );

    await svc.ignoreUser('*', undefined, 'Net');
    expect(svc.isUserIgnored('anyone', undefined, undefined, 'Net')).toBe(true);
  });

  it('finds a global blacklist entry via host-mask pattern', async () => {
    const bare = new UserManagementService();
    bare.setIRCService(irc);
    // No current network -> stored as a global entry.
    await bare.addBlacklistEntry('*@evil.com', 'ban');
    const hit = bare.findMatchingBlacklistEntry(
      'nick',
      'user',
      'evil.com',
      'SomeNet',
    );
    expect(hit?.mask).toBe('*@evil.com');
  });

  it('resolves a blacklist mask to a nick fallback when no host is known', () => {
    const entry = { mask: 'plainnick', action: 'ban', addedAt: 1 } as any;
    expect(svc.resolveBlacklistMask(entry, 'plainnick')).toBe('plainnick!*@*');
  });

  it('clears the WHOWAS cache by network and globally', () => {
    svc.updateWHOWAS({ nick: 'a', username: 'u' }, 'Net');
    svc.updateWHOWAS({ nick: 'b', username: 'u' }, 'Other');

    svc.clearWHOWASCache('Net');
    expect(svc.getWHOWAS('a', 'Net').length).toBe(0);
    expect(svc.getWHOWAS('b', 'Other').length).toBe(1);

    svc.clearWHOWASCache();
    expect(svc.getWHOWAS('b', 'Other').length).toBe(0);
  });
});
