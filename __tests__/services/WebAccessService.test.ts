/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('../../src/services/Logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_ALLOWED_HOSTS,
  webAccessService,
} from '../../src/services/ai/WebAccessService';

const call = (url: string, id = 'c1') => ({
  id,
  name: 'fetch_page',
  input: { url },
});

describe('WebAccessService', () => {
  beforeEach(async () => {
    (AsyncStorage as any).__reset?.();
    jest.clearAllMocks();
    webAccessService.resetForTests();
    await webAccessService.load();
  });

  describe('the allowlist', () => {
    it("ships with this project's own documentation allowed", () => {
      // A question about how the app works should be answerable without a
      // permission dance.
      for (const host of DEFAULT_ALLOWED_HOSTS) {
        expect(webAccessService.isAllowed(host)).toBe(true);
      }
      expect(
        webAccessService.callNeedsPermission(
          call('https://github.com/AndroidIRCx/AndroidIRCx/wiki'),
        ),
      ).toBe(false);
    });

    it('asks before reading anywhere else', () => {
      expect(
        webAccessService.callNeedsPermission(call('https://example.com/x')),
      ).toBe(true);
    });

    it('stops asking once a host is allowed', async () => {
      await webAccessService.allowHost('example.com');

      expect(
        webAccessService.callNeedsPermission(call('https://example.com/x')),
      ).toBe(false);
      // Allowing a site means its subdomains too: that is what someone
      // ticking a box for a site means.
      expect(
        webAccessService.callNeedsPermission(call('https://docs.example.com')),
      ).toBe(false);
      // But not a host that merely ends with the same letters.
      expect(
        webAccessService.callNeedsPermission(call('https://notexample.com')),
      ).toBe(true);
    });

    it('lets one call through without remembering the host', () => {
      const once = call('https://example.com/x', 'once');
      webAccessService.permitOnce(once);

      expect(webAccessService.callNeedsPermission(once)).toBe(false);
      // A different call to the same host still asks.
      expect(
        webAccessService.callNeedsPermission(
          call('https://example.com/y', 'other'),
        ),
      ).toBe(true);
      expect(webAccessService.listHosts()).not.toContain('example.com');
    });

    it('forgets a host on request, and keeps the built-in ones', async () => {
      await webAccessService.allowHost('example.com');
      await webAccessService.forgetHost('example.com');

      expect(webAccessService.isAllowed('example.com')).toBe(false);
      expect(webAccessService.isAllowed('github.com')).toBe(true);
    });

    it('re-adds the built-in hosts over a list saved by an older build', async () => {
      await (AsyncStorage as any).setItem(
        '@AndroidIRCX:aiAllowedHosts',
        JSON.stringify(['example.com']),
      );
      webAccessService.resetForTests();
      await webAccessService.load();

      expect(webAccessService.isAllowed('example.com')).toBe(true);
      expect(webAccessService.isAllowed('github.com')).toBe(true);
    });
  });

  describe('addresses it will not touch', () => {
    it.each([
      'http://localhost:8080/x',
      'http://127.0.0.1/x',
      'http://10.0.0.5/x',
      'http://192.168.1.10/x',
      'http://172.20.1.1/x',
      'http://169.254.169.254/latest/meta-data',
      'http://printer.local/x',
    ])('refuses %s', async url => {
      // A model talked into reading these would be scanning the user's own
      // network, which they never asked for and would never see.
      await expect(webAccessService.fetchPage(url)).rejects.toThrow(
        /private network/i,
      );
    });

    it('never asks the user about a private address', () => {
      // Asking would imply it is a choice. It is not.
      expect(
        webAccessService.callNeedsPermission(call('http://192.168.1.10/x')),
      ).toBe(false);
    });

    it('refuses a scheme that is not http or https', async () => {
      await expect(
        webAccessService.fetchPage('file:///etc/passwd'),
      ).rejects.toThrow(/http and https/i);
      expect(webAccessService.hostOf('file:///etc/passwd')).toBeNull();
    });
  });

  describe('reading a page', () => {
    const respond = (body: string, ok = true, status = 200) =>
      Promise.resolve({ ok, status, text: async () => body });

    it('returns the text, without the markup', async () => {
      (global as any).fetch = jest.fn(() =>
        respond(
          '<html><head><title>MCP</title><style>a{}</style></head>' +
            '<body><script>ignored()</script><p>First</p><p>Second</p></body></html>',
        ),
      );

      const page = await webAccessService.fetchPage('https://github.com/x');

      expect(page.title).toBe('MCP');
      expect(page.text).toContain('First');
      expect(page.text).toContain('Second');
      // Script and style bodies are not content.
      expect(page.text).not.toContain('ignored');
      expect(page.text).not.toContain('<p>');
    });

    it('reports what the site said when it refuses', async () => {
      (global as any).fetch = jest.fn(() => respond('nope', false, 404));

      await expect(
        webAccessService.fetchPage('https://github.com/missing'),
      ).rejects.toThrow('404');
    });
  });

  describe('redirects (M3.4)', () => {
    /** A response that says it ended up somewhere other than it was asked. */
    const redirectedTo = (finalUrl: string, body = '<p>secret</p>') =>
      Promise.resolve({
        ok: true,
        status: 200,
        url: finalUrl,
        text: async () => body,
      });

    it('refuses a redirect into a private network and returns no body', async () => {
      // The checks only ever saw the first URL, so an allowed site answering
      // `302 -> http://192.168.1.1/` fetched the user's router and handed the
      // body to the model. The refusal looked like a refusal and was not one.
      (global as any).fetch = jest.fn(() =>
        redirectedTo('http://192.168.1.1/admin'),
      );

      await expect(
        webAccessService.fetchPage('https://github.com/x'),
      ).rejects.toThrow(/private network/i);
    });

    it.each([
      'http://127.0.0.1:8080/',
      'http://localhost/',
      'http://10.0.0.1/',
      'http://169.254.169.254/latest/meta-data/',
    ])('refuses a redirect to %s', async finalUrl => {
      (global as any).fetch = jest.fn(() => redirectedTo(finalUrl));
      await expect(
        webAccessService.fetchPage('https://github.com/x'),
      ).rejects.toThrow(/private network/i);
    });

    it('refuses a redirect off the allowed list', async () => {
      (global as any).fetch = jest.fn(() =>
        redirectedTo('https://evil.example/collect'),
      );

      await expect(
        webAccessService.fetchPage('https://github.com/x'),
      ).rejects.toThrow(/not on your allowed list/i);
    });

    it('refuses a redirect to a scheme it cannot check', async () => {
      (global as any).fetch = jest.fn(() => redirectedTo('file:///etc/passwd'));
      await expect(
        webAccessService.fetchPage('https://github.com/x'),
      ).rejects.toThrow(/cannot follow/i);
    });

    it('allows a redirect that stays on an allowed host, and reports where the text came from', async () => {
      (global as any).fetch = jest.fn(() =>
        redirectedTo('https://github.com/x/final', '<p>Fine</p>'),
      );

      const page = await webAccessService.fetchPage('https://github.com/x');
      expect(page.text).toContain('Fine');
      // Quoting the source should quote where the text came from, not where
      // the caller asked.
      expect(page.url).toBe('https://github.com/x/final');
    });

    it('is unbothered when the response reports no url at all', async () => {
      (global as any).fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: async () => '<p>x</p>',
        }),
      );
      await expect(
        webAccessService.fetchPage('https://github.com/x'),
      ).resolves.toMatchObject({ url: 'https://github.com/x' });
    });
  });
});
