/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonChannelKnowledge,
  LIST_REFRESH_COOLDOWN_MS,
} from '../../src/services/scripting/AddonChannelKnowledge';

const NET = 'net1';

describe('AddonChannelKnowledge', () => {
  let channels: AddonChannelKnowledge;

  beforeEach(() => {
    channels = new AddonChannelKnowledge();
  });

  describe('topic', () => {
    it('merges the two numerics that carry a topic', () => {
      // RPL_TOPIC and RPL_TOPICWHOTIME arrive separately; the second must not
      // erase the first.
      channels.setTopic(NET, '#a', { text: 'Hello' });
      channels.setTopic(NET, '#a', { setBy: 'fred', setAt: 1000 });

      expect(channels.get(NET, '#a')?.topic).toEqual({
        text: 'Hello',
        setBy: 'fred',
        setAt: 1000,
      });
    });

    it('allows a topic to be cleared explicitly', () => {
      channels.setTopic(NET, '#a', { text: 'Hello' });
      channels.setTopic(NET, '#a', { text: '' });
      expect(channels.get(NET, '#a')?.topic.text).toBe('');
    });
  });

  describe('modes', () => {
    it('stores modes and their parameters', () => {
      channels.setModes(NET, '#a', ['i', 'n', 'l'], { l: '50' });
      const record = channels.get(NET, '#a');
      expect(record?.modes).toEqual(['i', 'n', 'l']);
      expect(record?.modeParams).toEqual({ l: '50' });
    });

    it('does not keep duplicate mode letters', () => {
      channels.setModes(NET, '#a', ['n', 'n', 't']);
      expect(channels.get(NET, '#a')?.modes).toEqual(['n', 't']);
    });
  });

  describe('mask lists', () => {
    it('starts unknown, which is not the same as empty', () => {
      const list = channels.getList(NET, '#a', 'ban');
      expect(list.status).toBe('unknown');
      expect(list.entries).toEqual([]);
    });

    it('collects entries with their metadata and marks the list cached', () => {
      channels.beginList(NET, '#a', 'ban');
      channels.addListEntry(NET, '#a', 'ban', {
        mask: '*!*@bad.example',
        setBy: 'fred',
        setAt: 1234,
      });
      channels.addListEntry(NET, '#a', 'ban', { mask: '*!*@worse.example' });
      channels.endList(NET, '#a', 'ban', 5000);

      const list = channels.getList(NET, '#a', 'ban');
      expect(list.status).toBe('cached');
      expect(list.fetchedAt).toBe(5000);
      expect(list.entries).toEqual([
        { mask: '*!*@bad.example', setBy: 'fred', setAt: 1234 },
        { mask: '*!*@worse.example' },
      ]);
    });

    it('replaces the cache when a new query begins', () => {
      channels.beginList(NET, '#a', 'ban');
      channels.addListEntry(NET, '#a', 'ban', { mask: 'old' });
      channels.endList(NET, '#a', 'ban');
      channels.beginList(NET, '#a', 'ban');
      channels.addListEntry(NET, '#a', 'ban', { mask: 'new' });

      expect(channels.getList(NET, '#a', 'ban').entries).toEqual([
        { mask: 'new' },
      ]);
    });

    it('accepts an entry that arrives without a begin', () => {
      // Some servers replay a list after a mode change with no fresh query.
      channels.addListEntry(NET, '#a', 'ban', { mask: 'x' });
      expect(channels.getList(NET, '#a', 'ban').entries).toHaveLength(1);
    });

    it('ignores a duplicate mask and an entry with no mask', () => {
      channels.addListEntry(NET, '#a', 'ban', { mask: 'x' });
      channels.addListEntry(NET, '#a', 'ban', { mask: 'x' });
      channels.addListEntry(NET, '#a', 'ban', { mask: '' });
      expect(channels.getList(NET, '#a', 'ban').entries).toHaveLength(1);
    });

    it('removes a single entry when a mode is unset', () => {
      channels.addListEntry(NET, '#a', 'ban', { mask: 'x' });
      channels.addListEntry(NET, '#a', 'ban', { mask: 'y' });
      channels.removeListEntry(NET, '#a', 'ban', 'x');
      expect(channels.getList(NET, '#a', 'ban').entries).toEqual([
        { mask: 'y' },
      ]);
    });

    it('keeps the four list kinds apart', () => {
      channels.addListEntry(NET, '#a', 'ban', { mask: 'b' });
      channels.addListEntry(NET, '#a', 'quiet', { mask: 'q' });
      expect(channels.getList(NET, '#a', 'ban').entries).toEqual([
        { mask: 'b' },
      ]);
      expect(channels.getList(NET, '#a', 'except').entries).toEqual([]);
      expect(channels.getList(NET, '#a', 'quiet').entries).toEqual([
        { mask: 'q' },
      ]);
    });
  });

  describe('refresh cooldown', () => {
    it('allows one query per list per window', () => {
      const now = Date.now();
      expect(channels.shouldRefreshList(NET, '#a', 'ban', now)).toBe(true);
      expect(channels.shouldRefreshList(NET, '#a', 'ban', now + 1)).toBe(false);
      expect(
        channels.shouldRefreshList(
          NET,
          '#a',
          'ban',
          now + LIST_REFRESH_COOLDOWN_MS + 1,
        ),
      ).toBe(true);
    });

    it('budgets each list, channel and network separately', () => {
      const now = Date.now();
      expect(channels.shouldRefreshList(NET, '#a', 'ban', now)).toBe(true);
      expect(channels.shouldRefreshList(NET, '#a', 'except', now)).toBe(true);
      expect(channels.shouldRefreshList(NET, '#b', 'ban', now)).toBe(true);
      expect(channels.shouldRefreshList('other', '#a', 'ban', now)).toBe(true);
    });
  });

  it('is case-insensitive about channel names', () => {
    channels.setTopic(NET, '#Announcements', { text: 'Hi' });
    expect(channels.get(NET, '#announcements')?.topic.text).toBe('Hi');
    expect(channels.get(NET, '#ANNOUNCEMENTS')?.name).toBe('#Announcements');
  });

  it('returns copies, so a caller cannot edit the cache', () => {
    channels.addListEntry(NET, '#a', 'ban', { mask: 'x' });
    const record = channels.get(NET, '#a')!;
    record.modes.push('z');
    record.lists.ban.entries.push({ mask: 'injected' });
    channels.getList(NET, '#a', 'ban').entries.push({ mask: 'injected2' });

    expect(channels.get(NET, '#a')?.modes).toEqual([]);
    expect(channels.getList(NET, '#a', 'ban').entries).toEqual([{ mask: 'x' }]);
  });

  it('forgets a channel and a whole network', () => {
    channels.setTopic(NET, '#a', { text: 'Hi' });
    channels.setTopic(NET, '#b', { text: 'Hi' });
    channels.forgetChannel(NET, '#a');
    expect(channels.get(NET, '#a')).toBeUndefined();
    expect(channels.channels(NET)).toEqual(['#b']);

    channels.clearNetwork(NET);
    expect(channels.channels(NET)).toEqual([]);
  });
});
