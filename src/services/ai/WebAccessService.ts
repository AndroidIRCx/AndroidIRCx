/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../Logger';
import { AIToolCall } from './types';

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
 */

const STORAGE_HOSTS_KEY = '@AndroidIRCX:aiAllowedHosts';

/** Allowed out of the box: the app's own repository and wiki. */
export const DEFAULT_ALLOWED_HOSTS = [
  'github.com',
  'raw.githubusercontent.com',
];

/** Fetched pages are truncated to this, so one page cannot eat the prompt. */
export const MAX_PAGE_CHARS = 40000;
const FETCH_TIMEOUT_MS = 15000;

export interface WebFetchResult {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
}

class WebAccessService {
  private hosts: string[] = [...DEFAULT_ALLOWED_HOSTS];
  private loaded = false;
  /** Tool call ids the user approved for a single run. */
  private oneOff = new Set<string>();

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_HOSTS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const saved = parsed.filter(
          (host: unknown): host is string =>
            typeof host === 'string' && host.length > 0,
        );
        // The defaults are re-added rather than assumed present, so a list
        // saved by an older build still documents the app's own wiki.
        this.hosts = Array.from(new Set([...DEFAULT_ALLOWED_HOSTS, ...saved]));
      }
    } catch (error) {
      logger.warn('ai', `Failed to load allowed hosts: ${String(error)}`);
    }
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_HOSTS_KEY, JSON.stringify(this.hosts));
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

  async allowHost(host: string): Promise<void> {
    await this.load();
    const clean = this.normalizeHost(host);
    if (!clean || this.hosts.includes(clean)) return;
    this.hosts.push(clean);
    await this.persist();
  }

  async forgetHost(host: string): Promise<void> {
    await this.load();
    const clean = this.normalizeHost(host);
    this.hosts = this.hosts.filter(entry => entry !== clean);
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
    const clean = this.normalizeHost(host);
    if (!clean) return true;
    if (
      clean === 'localhost' ||
      clean.endsWith('.localhost') ||
      clean.endsWith('.local') ||
      clean.endsWith('.internal')
    ) {
      return true;
    }
    // IPv6 loopback and the unique-local / link-local ranges.
    if (clean === '::1' || /^\[?(f[cd][0-9a-f]{2}|fe80):/i.test(clean)) {
      return true;
    }
    const v4 = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!v4) return false;
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 0 || a === 10) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  /** The host a fetch call is aimed at, or null when the URL is unusable. */
  hostOf(url: string): string | null {
    try {
      const parsed = new URL(String(url));
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.hostname;
    } catch {
      return null;
    }
  }

  /** True when this call is a fetch whose host the user has not allowed. */
  callNeedsPermission(call: AIToolCall): boolean {
    if (call?.name !== 'fetch_page') return false;
    if (this.oneOff.has(call.id)) return false;
    const host = this.hostOf(String(call.input?.url ?? ''));
    // A malformed or private URL is refused by the tool itself with a reason,
    // which is more useful than asking the user about something impossible.
    if (!host || this.isPrivateAddress(host)) return false;
    return !this.isAllowed(host);
  }

  /** Approve one call without adding its host to the list. */
  permitOnce(call: AIToolCall): void {
    if (call?.name === 'fetch_page') this.oneOff.add(call.id);
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
    const host = this.hostOf(url);
    if (!host) {
      throw new Error('Only http and https URLs can be fetched.');
    }
    if (this.isPrivateAddress(host)) {
      throw new Error(
        'That address is on a private network, which this tool never reaches.',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { accept: 'text/html,text/plain,text/markdown' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`The site answered ${response.status}.`);
      }
      const body = await response.text();
      const { title, text } = this.toText(body);
      const truncated = text.length > MAX_PAGE_CHARS;
      return {
        url,
        title,
        text: truncated ? text.substring(0, MAX_PAGE_CHARS) : text,
        truncated,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Strip markup down to readable text; good enough for documentation. */
  private toText(body: string): { title: string; text: string } {
    const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? this.decode(titleMatch[1]).trim() : '';
    const text = this.decode(
      body
        // Script and style bodies are not content and are mostly noise.
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    )
      .replace(/[ \t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { title, text };
  }

  private decode(value: string): string {
    return value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  /** Test hook. */
  resetForTests(): void {
    this.hosts = [...DEFAULT_ALLOWED_HOSTS];
    this.loaded = false;
    this.oneOff.clear();
  }
}

export const webAccessService = new WebAccessService();
