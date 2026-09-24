/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import {
  isPermittedImageUrl,
  MAX_MENU_DEPTH,
  MAX_MENU_ITEMS,
  normalizeAddonColour,
  secretFieldIds,
  validateFields,
  validateMenu,
  validatePanel,
} from '../../src/services/scripting/AddonUISchema';

const menu = (over: Record<string, unknown> = {}) => ({
  id: 'my.menu',
  target: 'nick',
  items: [{ id: 'item.one', label: 'Do the thing' }],
  ...over,
});

describe('AddonUISchema', () => {
  describe('menus', () => {
    it('accepts a well-formed menu', () => {
      const result = validateMenu(menu());
      expect(result.ok).toBe(true);
      expect(result.value?.items[0].label).toBe('Do the thing');
    });

    it('rejects a bad id, an unknown target and an empty item list', () => {
      expect(validateMenu(menu({ id: 'has spaces' })).ok).toBe(false);
      expect(validateMenu(menu({ target: 'nowhere' })).ok).toBe(false);
      expect(validateMenu(menu({ items: [] })).ok).toBe(false);
      expect(validateMenu(null).ok).toBe(false);
      expect(validateMenu(menu({ items: 'nope' })).ok).toBe(false);
    });

    it('rejects an icon the app does not ship', () => {
      // An addon cannot supply its own image for a menu row.
      const result = validateMenu(
        menu({ items: [{ id: 'a', label: 'A', icon: 'skull' }] }),
      );
      expect(result.ok).toBe(false);
      expect(result.errors.join()).toMatch(/icon/);
    });

    it('accepts nested submenus and refuses to nest too deep', () => {
      const nest = (depth: number): any =>
        depth === 0
          ? { id: 'leaf', label: 'Leaf' }
          : { id: `n${depth}`, label: 'N', submenu: [nest(depth - 1)] };

      expect(validateMenu(menu({ items: [nest(MAX_MENU_DEPTH - 1)] })).ok).toBe(
        true,
      );
      const tooDeep = validateMenu(menu({ items: [nest(MAX_MENU_DEPTH + 2)] }));
      expect(tooDeep.ok).toBe(false);
      expect(tooDeep.errors.join()).toMatch(/depth/);
    });

    it('bounds how many items a menu may hold', () => {
      const items = Array.from({ length: MAX_MENU_ITEMS + 1 }, (_v, index) => ({
        id: `i${index}`,
        label: 'X',
      }));
      expect(validateMenu(menu({ items })).ok).toBe(false);
    });

    it('drops optional flags that were not explicitly true', () => {
      const result = validateMenu(
        menu({ items: [{ id: 'a', label: 'A', checked: 'yes', disabled: 0 }] }),
      );
      expect(result.value?.items[0].checked).toBeUndefined();
      expect(result.value?.items[0].disabled).toBeUndefined();
    });
  });

  describe('panels', () => {
    it('accepts every node kind', () => {
      const result = validatePanel([
        { kind: 'text', text: 'Hello', tone: 'info' },
        { kind: 'list', items: [{ label: 'One', detail: 'detail' }] },
        { kind: 'table', columns: ['A', 'B'], rows: [['1', '2']] },
        { kind: 'keyValue', pairs: [{ key: 'k', value: 'v' }] },
        { kind: 'buttons', buttons: [{ id: 'go', label: 'Go' }] },
        { kind: 'progress', value: 0.5, label: 'Working' },
        {
          kind: 'image',
          url: 'https://example.com/a.png',
          alt: 'An example',
        },
      ]);
      expect(result.errors).toEqual([]);
      expect(result.ok).toBe(true);
    });

    it('fails closed on a node kind it does not know', () => {
      // An addon written for a newer app must be told its panel will not
      // render, rather than the user seeing a blank box.
      const result = validatePanel([{ kind: 'webview', url: 'x' }]);
      expect(result.ok).toBe(false);
      expect(result.errors.join()).toMatch(/not a known node/);
    });

    it('rejects an unknown tone', () => {
      expect(
        validatePanel([{ kind: 'text', text: 'x', tone: 'neon' }]).ok,
      ).toBe(false);
    });

    it('requires alt text on an image', () => {
      // A decorative image with no alt text is a hole in the page for anyone
      // using a screen reader.
      const result = validatePanel([
        { kind: 'image', url: 'https://example.com/a.png' },
      ]);
      expect(result.ok).toBe(false);
      expect(result.errors.join()).toMatch(/alt/);
    });

    it('pads a ragged table row rather than rejecting the table', () => {
      const result = validatePanel([
        { kind: 'table', columns: ['A', 'B', 'C'], rows: [['1']] },
      ]);
      expect(result.value?.[0]).toEqual({
        kind: 'table',
        columns: ['A', 'B', 'C'],
        rows: [['1', '', '']],
      });
    });

    it('clamps a progress value instead of failing the panel', () => {
      const result = validatePanel([{ kind: 'progress', value: 5 }]);
      expect(result.ok).toBe(true);
      expect(result.value?.[0]).toMatchObject({ value: 1 });
      expect(
        validatePanel([{ kind: 'progress', value: -2 }]).value?.[0],
      ).toMatchObject({ value: 0 });
    });

    it('rejects a panel that is not an array', () => {
      expect(validatePanel({ kind: 'text' }).ok).toBe(false);
    });
  });

  describe('isPermittedImageUrl', () => {
    it('allows only https', () => {
      expect(isPermittedImageUrl('https://example.com/a.png')).toBe(true);
      expect(isPermittedImageUrl('http://example.com/a.png')).toBe(false);
      expect(isPermittedImageUrl('file:///etc/passwd')).toBe(false);
      expect(isPermittedImageUrl('data:image/png;base64,AAA')).toBe(false);
      expect(isPermittedImageUrl('not a url')).toBe(false);
    });

    it.each([
      'https://localhost/a.png',
      'https://127.0.0.1/a.png',
      'https://10.0.0.5/a.png',
      'https://192.168.1.1/a.png',
      'https://172.16.0.1/a.png',
      'https://169.254.1.1/a.png',
      'https://printer.local/a.png',
    ])('refuses the private address %s', url => {
      // Otherwise a panel image is a way to probe the user's own network.
      expect(isPermittedImageUrl(url)).toBe(false);
    });
  });

  describe('fields', () => {
    it('accepts each field kind and reports the secrets', () => {
      const result = validateFields([
        { kind: 'text', id: 'name', label: 'Name' },
        { kind: 'secureText', id: 'token', label: 'API token' },
        { kind: 'number', id: 'count', label: 'Count', min: 0, max: 10 },
        { kind: 'toggle', id: 'on', label: 'Enabled' },
        {
          kind: 'select',
          id: 'mode',
          label: 'Mode',
          options: [{ value: 'a', label: 'A' }],
        },
        { kind: 'status', id: 'state', label: 'State', text: 'Idle' },
        { kind: 'action', id: 'run', label: 'Run' },
      ]);

      expect(result.ok).toBe(true);
      // So the caller can route these to the addon Keychain namespace and
      // never to ordinary storage.
      expect(secretFieldIds(result.value!)).toEqual(['token']);
    });

    it('rejects an unknown kind, a duplicate id and empty select options', () => {
      expect(
        validateFields([{ kind: 'colorPicker', id: 'c', label: 'C' }]).ok,
      ).toBe(false);
      const duplicate = validateFields([
        { kind: 'text', id: 'a', label: 'A' },
        { kind: 'text', id: 'a', label: 'B' },
      ]);
      expect(duplicate.ok).toBe(false);
      expect(duplicate.errors.join()).toMatch(/duplicated/);
      expect(
        validateFields([{ kind: 'select', id: 's', label: 'S', options: [] }])
          .ok,
      ).toBe(false);
    });
  });

  describe('text that lies about itself (M3.4)', () => {
    // U+202E flips what follows; a label reading "Disable" renders as
    // "elbasiD" or worse, which is a way to get a tap the user did not mean.
    const RTL_OVERRIDE = '\u202e';
    const ZERO_WIDTH = '\u200b';
    const BOM = '\ufeff';

    it('strips a bidi override from a panel text node', () => {
      const result = validatePanel([
        { kind: 'text', text: `Safe${RTL_OVERRIDE}elbasiD` },
      ]);
      expect(result.ok).toBe(true);
      expect((result.value?.[0] as any).text).toBe('SafeelbasiD');
      expect((result.value?.[0] as any).text).not.toContain(RTL_OVERRIDE);
    });

    it('strips zero-width and byte-order marks', () => {
      const result = validatePanel([
        { kind: 'text', text: `a${ZERO_WIDTH}b${BOM}c` },
      ]);
      expect((result.value?.[0] as any).text).toBe('abc');
    });

    it('strips them from a menu label too', () => {
      const result = validateMenu({
        id: 'm',
        target: 'nick',
        items: [{ id: 'a', label: `Kick${RTL_OVERRIDE} them` }],
      });
      expect(result.value?.items[0].label).not.toContain(RTL_OVERRIDE);
    });

    it('strips them from list, table and key/value content', () => {
      const list = validatePanel([
        {
          kind: 'list',
          items: [{ label: `a${RTL_OVERRIDE}b`, detail: `c${ZERO_WIDTH}d` }],
        },
      ]);
      expect(JSON.stringify(list.value)).not.toContain(RTL_OVERRIDE);
      expect(JSON.stringify(list.value)).not.toContain(ZERO_WIDTH);

      const table = validatePanel([
        {
          kind: 'table',
          columns: [`Nick${RTL_OVERRIDE}`],
          rows: [[`fred${ZERO_WIDTH}`]],
        },
      ]);
      expect(JSON.stringify(table.value)).not.toContain(RTL_OVERRIDE);
      expect(JSON.stringify(table.value)).not.toContain(ZERO_WIDTH);

      const pairs = validatePanel([
        { kind: 'keyValue', pairs: [{ key: `k${BOM}`, value: `v${BOM}` }] },
      ]);
      expect(JSON.stringify(pairs.value)).not.toContain(BOM);
    });

    it('leaves ordinary text, including real right-to-left script, alone', () => {
      // Stripping the overrides must not break languages that read that way.
      const result = validatePanel([
        { kind: 'text', text: 'Здраво — مرحبا — 你好' },
      ]);
      expect((result.value?.[0] as any).text).toBe('Здраво — مرحبا — 你好');
    });
  });

  describe('normalizeAddonColour', () => {
    it('refuses anything that is not a six-digit hex colour', () => {
      expect(normalizeAddonColour('red', '#000000')).toBeUndefined();
      expect(normalizeAddonColour('#fff', '#000000')).toBeUndefined();
      expect(normalizeAddonColour(123, '#000000')).toBeUndefined();
    });

    it('lifts an unreadable colour off the background', () => {
      // An addon must not be able to print dark grey on black.
      const fixed = normalizeAddonColour('#111111', '#000000');
      expect(fixed).toBeDefined();
      expect(fixed).not.toBe('#111111');
    });

    it('leaves a colour that is already readable alone', () => {
      expect(normalizeAddonColour('#ffffff', '#000000')).toBe('#ffffff');
    });
  });
});
