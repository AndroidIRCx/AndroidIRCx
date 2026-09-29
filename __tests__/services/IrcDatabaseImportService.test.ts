/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('../../src/services/SettingsService', () => ({
  settingsService: {
    loadNetworks: jest.fn(),
    addNetwork: jest.fn(),
    updateNetwork: jest.fn(),
    getSetting: jest.fn(),
    setSetting: jest.fn(),
  },
}));

import { ircDatabaseImportService } from '../../src/services/IrcDatabaseImportService';
import { settingsService } from '../../src/services/SettingsService';

describe('IrcDatabaseImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (settingsService.loadNetworks as jest.Mock).mockResolvedValue([
      {
        id: 'DBase',
        name: 'DBase',
        nick: 'AndroidIRCX',
        realname: 'AndroidIRCX User',
        servers: [
          { id: 'dbase-1', hostname: 'irc.dbase.in.rs', port: 6697, ssl: true },
        ],
      },
      {
        id: 'libera-custom',
        name: 'Libera',
        nick: 'me',
        realname: 'me',
        servers: [
          {
            id: 'libera-1',
            hostname: 'irc.libera.chat',
            port: 6697,
            ssl: true,
          },
        ],
      },
    ]);
    (settingsService.addNetwork as jest.Mock).mockResolvedValue(undefined);
    (settingsService.updateNetwork as jest.Mock).mockResolvedValue(undefined);
    (settingsService.getSetting as jest.Mock).mockResolvedValue(false);
    (settingsService.setSetting as jest.Mock).mockResolvedValue(undefined);
  });

  it('imports valid networks and keeps existing duplicate server entries unchanged', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            network_name: 'Libera',
            server_list: [
              { hostname: 'irc.libera.chat', port: 6697, use_ssl: true },
            ],
          },
          {
            network_name: 'Rizon',
            server_list: [
              { hostname: 'irc.rizon.net', port: 6697, use_ssl: true },
              { hostname: 'irc.rizon.net', port: 6697, use_ssl: true }, // duplicate
            ],
          },
        ],
      }),
    });

    const summary = await ircDatabaseImportService.importFromIrcDatabase(
      fetchMock as any,
    );

    expect(summary.importedNetworks).toBe(1);
    expect(summary.importedServers).toBe(1);
    expect(summary.skippedExistingNetworks).toBe(1);
    expect(summary.mergedNetworks).toBe(0);
    expect(summary.skippedInvalidServers).toBe(1);
    expect(settingsService.addNetwork).toHaveBeenCalledTimes(1);
    expect(settingsService.updateNetwork).not.toHaveBeenCalled();
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'ircDbLastImportAt',
      expect.any(String),
    );
    expect(settingsService.addNetwork).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Rizon',
        id: expect.stringContaining('ircdb-rizon'),
      }),
    );
    expect(settingsService.addNetwork).toHaveBeenCalledWith(
      expect.not.objectContaining({
        defaultServerId: expect.anything(),
      }),
    );
  });

  it('skips invalid networks and invalid servers', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            network_name: '',
            server_list: [
              { hostname: 'irc.valid.net', port: 6667, use_ssl: false },
            ],
          },
          {
            network_name: 'BadServersNet',
            server_list: [
              { hostname: ' ', port: 6667, use_ssl: false },
              { hostname: 'irc.bad.net', port: 99999, use_ssl: true },
            ],
          },
        ],
      }),
    });

    const summary = await ircDatabaseImportService.importFromIrcDatabase(
      fetchMock as any,
    );

    expect(summary.importedNetworks).toBe(0);
    expect(summary.skippedInvalidNetworks).toBe(2);
    expect(summary.skippedInvalidServers).toBe(2);
    expect(settingsService.addNetwork).not.toHaveBeenCalled();
  });

  it('throws on HTTP failure and invalid payload format', async () => {
    const httpFailFetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 });
    await expect(
      ircDatabaseImportService.importFromIrcDatabase(httpFailFetch as any),
    ).rejects.toThrow('IRC Database request failed (500)');

    const invalidPayloadFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: true }),
    });
    await expect(
      ircDatabaseImportService.importFromIrcDatabase(
        invalidPayloadFetch as any,
      ),
    ).rejects.toThrow('Invalid IRC Database response format');
  });

  it('continues import when persisting one network fails and returns partial summary', async () => {
    (settingsService.loadNetworks as jest.Mock).mockResolvedValueOnce([]);
    (settingsService.addNetwork as jest.Mock)
      .mockRejectedValueOnce(new Error('db write fail'))
      .mockResolvedValueOnce(undefined);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            network_name: 'NetOne',
            server_list: [
              { hostname: 'irc.netone.org', port: 6667, use_ssl: false },
            ],
          },
          {
            network_name: 'NetTwo',
            server_list: [
              { hostname: 'irc.nettwo.org', port: 6697, use_ssl: true },
            ],
          },
        ],
      }),
    });

    const summary = await ircDatabaseImportService.importFromIrcDatabase(
      fetchMock as any,
    );
    expect(summary.failedPersistNetworks).toBe(1);
    expect(summary.importedNetworks).toBe(1);
    expect(settingsService.addNetwork).toHaveBeenCalledTimes(2);
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'ircDbLastImportAt',
      expect.any(String),
    );
  });

  it('merges missing servers into existing network', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            network_name: 'Libera',
            server_list: [
              { hostname: 'irc.libera.chat', port: 6697, use_ssl: true },
              { hostname: 'irc.eu.libera.chat', port: 6697, use_ssl: true },
            ],
          },
        ],
      }),
    });

    const summary = await ircDatabaseImportService.importFromIrcDatabase(
      fetchMock as any,
    );

    expect(summary.importedNetworks).toBe(0);
    expect(summary.mergedNetworks).toBe(1);
    expect(summary.mergedServers).toBe(1);
    expect(settingsService.addNetwork).not.toHaveBeenCalled();
    expect(settingsService.updateNetwork).toHaveBeenCalledWith(
      'libera-custom',
      expect.objectContaining({
        servers: expect.arrayContaining([
          expect.objectContaining({ hostname: 'irc.libera.chat', port: 6697 }),
          expect.objectContaining({
            hostname: 'irc.eu.libera.chat',
            port: 6697,
          }),
        ]),
      }),
    );
  });

  it('does not auto-assign a default server when importing or merging API networks', async () => {
    (settingsService.loadNetworks as jest.Mock).mockResolvedValueOnce([
      {
        id: 'libera-custom',
        name: 'Libera',
        nick: 'me',
        realname: 'me',
        servers: [
          {
            id: 'libera-1',
            hostname: 'irc.libera.chat',
            port: 6697,
            ssl: true,
          },
        ],
      },
    ]);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            network_name: 'Libera',
            server_list: [
              { hostname: 'irc.libera.chat', port: 6697, use_ssl: true },
              { hostname: 'irc.eu.libera.chat', port: 6697, use_ssl: true },
            ],
          },
          {
            network_name: 'Rizon',
            server_list: [
              { hostname: 'irc.rizon.net', port: 6697, use_ssl: true },
            ],
          },
        ],
      }),
    });

    await ircDatabaseImportService.importFromIrcDatabase(fetchMock as any);

    expect(settingsService.updateNetwork).toHaveBeenCalledWith(
      'libera-custom',
      expect.objectContaining({
        defaultServerId: undefined,
      }),
    );
    expect(settingsService.addNetwork).toHaveBeenCalledWith(
      expect.not.objectContaining({
        defaultServerId: expect.anything(),
      }),
    );
  });

  it('loads paginated API results across pages', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          meta: {
            pagination: {
              has_more_pages: true,
              next_page_url: 'https://example.test/page=2',
            },
          },
          data: [
            {
              network_name: 'NetOne',
              server_list: [
                { hostname: 'irc.netone.org', port: 6667, use_ssl: false },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          meta: { pagination: { has_more_pages: false, next_page_url: null } },
          data: [
            {
              network_name: 'NetTwo',
              server_list: [
                { hostname: 'irc.nettwo.org', port: 6697, use_ssl: true },
              ],
            },
          ],
        }),
      });

    (settingsService.loadNetworks as jest.Mock).mockResolvedValueOnce([]);
    const summary = await ircDatabaseImportService.importFromIrcDatabase(
      fetchMock as any,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(summary.totalApiNetworks).toBe(2);
    expect(summary.importedNetworks).toBe(2);
    expect(settingsService.addNetwork).toHaveBeenCalledTimes(2);
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'ircDbLastImportAt',
      expect.any(String),
    );
  });

  it('throws timeout error when request takes too long', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn(() => new Promise(() => undefined));

    const promise = ircDatabaseImportService.importFromIrcDatabase(
      fetchMock as any,
      { timeoutMs: 5 },
    );
    jest.advanceTimersByTime(10);

    await expect(promise).rejects.toThrow(
      'IRC Database request timed out after 5ms',
    );
    expect(settingsService.setSetting).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('does not fail import when timestamp persistence fails', async () => {
    (settingsService.loadNetworks as jest.Mock).mockResolvedValueOnce([]);
    (settingsService.setSetting as jest.Mock).mockRejectedValueOnce(
      new Error('cache down'),
    );
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            network_name: 'TimestampNet',
            server_list: [
              { hostname: 'irc.timestamp.net', port: 6667, use_ssl: false },
            ],
          },
        ],
      }),
    });

    const summary = await ircDatabaseImportService.importFromIrcDatabase(
      fetchMock as any,
    );
    expect(summary.importedNetworks).toBe(1);
    expect(settingsService.addNetwork).toHaveBeenCalledTimes(1);
  });

  it('imports default IRC Database networks once and records completion', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            network_name: 'Chatzona',
            server_list: [
              { hostname: 'irc.chatzona.org', port: 6667, use_ssl: false },
            ],
          },
        ],
      }),
    });

    const summary =
      await ircDatabaseImportService.importDefaultNetworksIfNeeded(
        fetchMock as any,
      );

    expect(summary?.importedNetworks).toBe(1);
    expect(settingsService.getSetting).toHaveBeenCalledWith(
      'ircDbDefaultAutoImportCompleted',
      false,
    );
    expect(settingsService.setSetting).toHaveBeenCalledWith(
      'ircDbDefaultAutoImportCompleted',
      true,
    );
  });

  it('skips default IRC Database import after it was completed', async () => {
    (settingsService.getSetting as jest.Mock).mockResolvedValueOnce(true);
    const fetchMock = jest.fn();

    const summary =
      await ircDatabaseImportService.importDefaultNetworksIfNeeded(
        fetchMock as any,
      );

    expect(summary).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads catalog preview metadata including average users and last scanned time', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        meta: {
          description:
            'Approved and active IRC networks with predefined server entries for clients.',
          sorted_by: 'average_users_desc',
          generated_at: '2026-03-12T23:42:01+01:00',
          pagination: { has_more_pages: false, next_page_url: null, total: 1 },
        },
        data: [
          {
            network_name: 'Libera',
            average_users: 32805,
            server_list: [
              {
                hostname: 'irc.libera.chat',
                port: 6697,
                use_ssl: true,
                last_scanned_at: '2026-03-12T00:34:32+01:00',
              },
            ],
          },
        ],
      }),
    });

    const catalog = await ircDatabaseImportService.loadCatalog(
      fetchMock as any,
    );

    expect(catalog.meta.description).toContain(
      'Approved and active IRC networks',
    );
    expect(catalog.meta.sortedBy).toBe('average_users_desc');
    expect(catalog.meta.generatedAt).toBe('2026-03-12T23:42:01+01:00');
    expect(catalog.networks).toEqual([
      expect.objectContaining({
        name: 'Libera',
        averageUsers: 32805,
        serverCount: 1,
        lastScannedAt: '2026-03-12T00:34:32+01:00',
      }),
    ]);
  });

  /**
   * The catalog comes off a public API nobody here controls. A record with a
   * missing name, a port as a string, a hostname with a space in it or an
   * average-user count that is not a number are all things that arrive in
   * practice, and each one has to be dropped or coerced rather than imported
   * as a broken network the user then cannot connect to.
   */
  describe('a catalog that is not as clean as the example', () => {
    const catalogWith = (networks: unknown[]) => ({
      ok: true,
      json: async () => ({
        meta: {
          description: 'Approved and active IRC networks',
          sorted_by: 'average_users_desc',
          generated_at: '2026-03-12T23:42:01+01:00',
          pagination: { has_more_pages: false, next_page_url: null, total: 1 },
        },
        data: networks,
      }),
    });

    const load = async (networks: unknown[]) => {
      const fetchMock = jest.fn().mockResolvedValue(catalogWith(networks));
      return ircDatabaseImportService.loadCatalog(fetchMock as any);
    };

    it.each([
      ['no name at all', {}],
      ['a name that is not a string', { network_name: 42 }],
      ['an empty name', { network_name: '' }],
      ['a name of only spaces', { network_name: '   ' }],
    ])('drops a record with %s', async (_label, record) => {
      const catalog = await load([record]);
      expect(catalog.networks).toEqual([]);
    });

    it('keeps a record with no servers, and counts none', async () => {
      const catalog = await load([{ network_name: 'Bare' }]);

      expect(catalog.networks).toHaveLength(1);
      expect(catalog.networks[0].serverCount).toBe(0);
      expect(catalog.networks[0].lastScannedAt).toBeNull();
    });

    it('ignores a server list that is not a list', async () => {
      const catalog = await load([
        { network_name: 'Odd', server_list: 'not a list' },
      ]);

      expect(catalog.networks[0].serverCount).toBe(0);
    });

    it('reads an average-user count sent as a string, and refuses nonsense', async () => {
      const catalog = await load([
        { network_name: 'AsString', average_users: '1234' },
        { network_name: 'AsNonsense', average_users: 'many' },
        { network_name: 'AsNothing' },
      ]);

      const byName = Object.fromEntries(
        catalog.networks.map(n => [n.name, n.averageUsers]),
      );
      expect(byName.AsString).toBe(1234);
      expect(byName.AsNonsense).toBeNull();
      expect(byName.AsNothing).toBeNull();
    });

    it('takes the newest scan time and ignores the blanks', async () => {
      const catalog = await load([
        {
          network_name: 'Timed',
          server_list: [
            { hostname: 'a.example', last_scanned_at: '2026-01-01T00:00:00Z' },
            { hostname: 'b.example', last_scanned_at: '   ' },
            { hostname: 'c.example', last_scanned_at: 42 },
            { hostname: 'd.example', last_scanned_at: '2026-06-01T00:00:00Z' },
          ],
        },
      ]);

      expect(catalog.networks[0].lastScannedAt).toBe('2026-06-01T00:00:00Z');
    });

    it('gives a network whose name has no usable characters a workable id', async () => {
      const catalog = await load([
        { network_name: '!!!' },
        { network_name: '#' },
      ]);

      // The id goes into storage keys, so it cannot come out empty.
      for (const network of catalog.networks) {
        expect(network.id).toMatch(/^catalog-[a-z0-9-]+-\d+$/);
        expect(network.id).not.toContain('--');
      }
    });

    it('builds a readable id from a name full of punctuation', async () => {
      const catalog = await load([{ network_name: '  Libera .Chat!  ' }]);

      expect(catalog.networks[0].name).toBe('Libera .Chat!');
      expect(catalog.networks[0].id).toBe('catalog-libera-chat-0');
    });
  });
});
