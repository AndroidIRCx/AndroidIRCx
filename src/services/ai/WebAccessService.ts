/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../Logger';
import { AIToolCall } from './types';
import { isPrivateHost, parseHttpUrl } from '../../utils/safeUrl';

/**
 * Which sites the assistant may read, and nothing else.
 *
 * Letting a model choose its own URLs is not something to hand the network to
 * unconditionally, so every fetch is checked here first:
 *
 * - This project's own documentation is allowed from the start. A question
 *   about how the app works should be answerable without a permission dance.
 * - Any other host stops the turn and asks the user, who can allow it once or
 *   add it to the list.
 * - Private addresses are refused outright, allowed or not. Otherwise a model
 *   could be talked into probing the user's own network — a scan they never
 *   asked for and would never see.
 *
 * The list is per **host**, not per URL: a person deciding about
 * "github.com" is making a decision they can actually reason about, where one
 * about a path is not.
 *
 * Only the user changes it — by adding a site here, by answering "always
 * allow" when the assistant asks, or by removing one. The assistant has no
 * tool that touches the list, so it can never reach past what shipped plus
 * what the user chose.
 */

const STORAGE_HOSTS_KEY = '@AndroidIRCX:aiAllowedHosts';
/** Built-in hosts the user removed, so they stay removed after an update. */
const STORAGE_REMOVED_DEFAULTS_KEY = '@AndroidIRCX:aiRemovedDefaultHosts';

/**
 * Allowed out of the box: the app's own repository and wiki, and the
 * project's public, read-only MemPalace knowledge base.
 */
export const DEFAULT_ALLOWED_HOSTS = [
  'github.com',
  'raw.githubusercontent.com',
  'mempalace-mcp.dbase.in.rs',
];

/** A bare host name: letters, digits, hyphens and dots, at least one dot. */
const HOST_PATTERN =
  /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

/** Fetched pages are truncated to this, so one page cannot eat the prompt. */
export const MAX_PAGE_CHARS = 40000;
const FETCH_TIMEOUT_MS = 15000;

export interface WebFetchResult {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
}

/** The named entities worth knowing for plain-text extraction. */
const HTML_ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
});

/**
 * Whether a numeric entity is safe to turn into a character.
 *
 * Surrogates and out-of-range values throw from `fromCodePoint`, and the C0
 * controls have no business in extracted text: a decoded `&#0;` or `&#13;`
 * only makes the result harder to read.
 */
function isPrintable(code: number): boolean {
  return (
    Number.isInteger(code) &&
    code >= 0x20 &&
    code <= 0x10ffff &&
    !(code >= 0xd800 && code <= 0xdfff) &&
    code !== 0x7f
  );
}

class WebAccessService {
  private hosts: string[] = [...DEFAULT_ALLOWED_HOSTS];
  private removedDefaults: string[] = [];
  private loaded = false;
  /**
   * URLs the user approved for one fetch each, by their checked `href`.
   *
   * Keyed by URL, not by tool call id, and spent on use: Gemini numbers its
   * call ids by position (`fetch_page_0`, `fetch_page_1`…), so a permit kept
   * by id let every later first-in-a-reply fetch, to any site, through
   * without asking.
   */
  private permits = new Set<string>();

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      this.removedDefaults = this.readList(
        await AsyncStorage.getItem(STORAGE_REMOVED_DEFAULTS_KEY),
      ).filter(host => DEFAULT_ALLOWED_HOSTS.includes(host));
      const saved = this.readList(
        await AsyncStorage.getItem(STORAGE_HOSTS_KEY),
      );
      // The defaults are re-added rather than assumed present, so a list saved
      // by an older build still gets a host shipped after it. One the user
      // removed stays removed: that was their decision, not an old list.
      this.hosts = Array.from(
        new Set([...DEFAULT_ALLOWED_HOSTS, ...saved]),
      ).filter(host => !this.removedDefaults.includes(host));
    } catch (error) {
      logger.warn('ai', `Failed to load allowed hosts: ${String(error)}`);
    }
  }

  /**
   * A stored list, keeping only real host names. The list comes back from
   * backups too, and an entry that is not a plain host — `[`, a wildcard, an
   * address — has no business widening what may be fetched.
   */
  private readList(raw: string | null): string[] {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((host: unknown): host is string => typeof host === 'string')
      .map(host => this.normalizeHost(host))
      .filter(host => HOST_PATTERN.test(host));
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_HOSTS_KEY, JSON.stringify(this.hosts));
      await AsyncStorage.setItem(
        STORAGE_REMOVED_DEFAULTS_KEY,
        JSON.stringify(this.removedDefaults),
      );
    } catch (error) {
      logger.warn('ai', `Failed to save allowed hosts: ${String(error)}`);
    }
  }

  listHosts(): string[] {
    return [...this.hosts].sort();
  }

  isDefaultHost(host: string): boolean {
    return DEFAULT_ALLOWED_HOSTS.includes(this.normalizeHost(host));
  }

  private normalizeHost(host: string): string {
    return String(host || '')
      .trim()
      .toLowerCase()
      .replace(/^www\./, '');
  }

  /**
   * The host a person typed into the "add a site" box, or null when it is not
   * one. A full URL is accepted and reduced to its host, because that is what
   * people paste.
   */
  parseHostInput(input: string): string | null {
    const raw = String(input || '').trim();
    if (!raw) return null;
    const host = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
      ? this.hostOf(raw)
      : raw.split(/[/?#:]/)[0];
    const clean = this.normalizeHost(host || '');
    return HOST_PATTERN.test(clean) ? clean : null;
  }

  async allowHost(host: string): Promise<void> {
    await this.load();
    const clean = this.normalizeHost(host);
    // Only a plain ASCII host name: never an address, and never a Unicode
    // lookalike of a real site that the card showed as if it were one.
    if (!HOST_PATTERN.test(clean)) return;
    // Adding a built-in host back undoes having removed it.
    this.removedDefaults = this.removedDefaults.filter(
      entry => entry !== clean,
    );
    if (!this.hosts.includes(clean)) this.hosts.push(clean);
    await this.persist();
  }

  async forgetHost(host: string): Promise<void> {
    await this.load();
    const clean = this.normalizeHost(host);
    this.hosts = this.hosts.filter(entry => entry !== clean);
    if (
      DEFAULT_ALLOWED_HOSTS.includes(clean) &&
      !this.removedDefaults.includes(clean)
    ) {
      this.removedDefaults.push(clean);
    }
    await this.persist();
  }

  /**
   * True when this host is already allowed. Subdomains of an allowed host
   * count: allowing "example.com" allows "docs.example.com", which is what
   * someone ticking a box for a site means.
   */
  isAllowed(host: string): boolean {
    const clean = this.normalizeHost(host);
    if (!clean) return false;
    return this.hosts.some(
      allowed => clean === allowed || clean.endsWith(`.${allowed}`),
    );
  }

  /**
   * An address nothing should be able to reach through this tool, whether or
   * not its host is on the list.
   */
  isPrivateAddress(host: string): boolean {
    return isPrivateHost(host);
  }

  /**
   * The host a fetch call is aimed at, or null when the URL is unusable.
   *
   * Never `new URL()`: on a device that is React Native's regex URL, which
   * reads `https://evil.example/?x=@github.com` as github.com. See safeUrl.
   */
  hostOf(url: string): string | null {
    return parseHttpUrl(url)?.hostname ?? null;
  }

  /** True when this call is a fetch whose host the user has not allowed. */
  callNeedsPermission(call: AIToolCall): boolean {
    if (call?.name !== 'fetch_page') return false;
    const parsed = parseHttpUrl(call.input?.url);
    // A malformed or private URL is refused by the tool itself with a reason,
    // which is more useful than asking the user about something impossible.
    if (!parsed || this.isPrivateAddress(parsed.hostname)) return false;
    if (this.permits.has(parsed.href)) return false;
    return !this.isAllowed(parsed.hostname);
  }

  /** Approve this one fetch, of this one URL, without adding its host. */
  permitOnce(call: AIToolCall): void {
    if (call?.name !== 'fetch_page') return;
    const parsed = parseHttpUrl(call.input?.url);
    if (parsed) this.permits.add(parsed.href);
  }

  /** Drop approvals nobody used, so one never outlives its turn. */
  clearPermits(): void {
    this.permits.clear();
  }

  /**
   * Fetch one page and return it as text.
   *
   * Deliberately not a crawler: one URL per call, no links followed. What
   * comes back is data the model may read, never instructions it may obey —
   * the system prompt says so, and so does the text this wraps it in.
   */
  async fetchPage(url: string): Promise<WebFetchResult> {
    await this.load();
    const parsed = parseHttpUrl(url);
    if (!parsed) {
      throw new Error(
        'Only plain http and https URLs can be fetched (no user@host, no spaces).',
      );
    }
    const host = parsed.hostname;
    if (this.isPrivateAddress(host)) {
      throw new Error(
        'That address is on a private network, which this tool never reaches.',
      );
    }
    // Enforced here, for every caller — the assistant, scripts, addons and
    // the MCP server — rather than trusted to each of them. A caller with
    // nobody to ask (a remote agent, an addon) is held to the list.
    if (!this.isAllowed(host) && !this.permits.delete(parsed.href)) {
      throw new Error(`${host} is not on your allowed list.`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      // The rebuilt URL, never the raw string: what was checked is what goes.
      const response = await fetch(parsed.href, {
        method: 'GET',
        headers: { accept: 'text/html,text/plain,text/markdown' },
        signal: controller.signal,
      });

      // A redirect is a second request the caller never asked for, and the
      // checks above only saw the first URL. Without this, an allowed site
      // answering `302 -> http://192.168.1.1/` fetches the user's router and
      // hands the body to the model: the refusal looked like a refusal and was
      // not one. Checked after the fact rather than by refusing to follow,
      // because `redirect: 'manual'` is not reliably honoured on React Native
      // - what matters is that the body never reaches the caller.
      const finalUrl =
        typeof response.url === 'string' && response.url
          ? response.url
          : parsed.href;
      if (finalUrl !== parsed.href && finalUrl !== url) {
        const finalHost = this.hostOf(finalUrl);
        if (!finalHost)
          throw new Error(
            'That site redirected somewhere this tool cannot follow.',
          );
        if (this.isPrivateAddress(finalHost))
          throw new Error(
            'That site redirected to a private network address, which this tool never reaches.',
          );
        // The same host as the one approved once is that same approval.
        if (!this.isAllowed(finalHost) && finalHost !== host)
          throw new Error(
            `That site redirected to ${finalHost}, which is not on your allowed list.`,
          );
      }

      if (!response.ok) {
        throw new Error(`The site answered ${response.status}.`);
      }
      const body = await response.text();
      const { title, text } = this.toText(body);
      const truncated = text.length > MAX_PAGE_CHARS;
      return {
        // The URL that actually answered, so a caller quoting its source
        // quotes where the text came from rather than where it asked.
        url: finalUrl,
        title,
        text: truncated ? text.substring(0, MAX_PAGE_CHARS) : text,
        truncated,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Strip markup down to readable text; good enough for documentation.
   *
   * Two things here are deliberate rather than incidental, both flagged by
   * static analysis on an earlier version:
   *
   * 1. The `script` and `style` end tags allow whitespace. `</script >` is a
   *    valid end tag, and a pattern demanding exactly `</script>` misses it,
   *    which leaves the script body in the text handed to a model. An
   *    unterminated `<script` swallows the rest of the document for the same
   *    reason - which is what a browser does with it too.
   * 2. Entities are decoded **after** the tags are gone, in a single pass, so
   *    no replacement can feed the next one. See `decode`.
   */
  private toText(body: string): { title: string; text: string } {
    const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title\s*>/i);
    const title = titleMatch ? this.decode(titleMatch[1]).trim() : '';
    const text = this.decode(
      body
        // Script and style bodies are not content and are mostly noise.
        .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?(?:<\/style\s*>|$)/gi, ' ')
        .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
        .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, ' '),
    )
      .replace(/[ \t\u00a0]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { title, text };
  }

  /**
   * Decode HTML entities in **one pass**.
   *
   * Chained replaces are the bug, not the order of them: replacing `&amp;`
   * first turns `&amp;lt;` into `&lt;`, which the next replace turns into a
   * real `<`. A page that merely *displays* `&lt;script&gt;` then arrives as
   * markup, after the tag stripping that was supposed to remove markup. Doing
   * it once means no replacement's output is another's input, whatever order
   * the table happens to be in.
   */
  private decode(value: string): string {
    return value.replace(
      /&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi,
      (whole, body: string) => {
        const token = body.toLowerCase();
        if (token.startsWith('#x')) {
          const code = Number.parseInt(token.slice(2), 16);
          return isPrintable(code) ? String.fromCodePoint(code) : whole;
        }
        if (token.startsWith('#')) {
          const code = Number.parseInt(token.slice(1), 10);
          return isPrintable(code) ? String.fromCodePoint(code) : whole;
        }
        // An entity not in the table is left exactly as written: turning one
        // we do not know into a guess is how text stops meaning what the page
        // actually said.
        return HTML_ENTITIES[token] ?? whole;
      },
    );
  }

  /** Test hook. */
  resetForTests(): void {
    this.hosts = [...DEFAULT_ALLOWED_HOSTS];
    this.removedDefaults = [];
    this.loaded = false;
    this.permits.clear();
  }
}

export const webAccessService = new WebAccessService();
