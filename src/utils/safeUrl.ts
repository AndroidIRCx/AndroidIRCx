/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * A strict http(s) URL parser for every place that decides whether a URL is
 * allowed before fetching it.
 *
 * Why not `new URL()`: on a device that is React Native's own `URL`, whose
 * `hostname` is a regex — `/^https?:\/\/(?:[^@]+@)?([^:/?#]+)/` — and the
 * `[^@]+@` part happily runs across `/`, `?` and `#`. So
 * `https://evil.example/?d=SECRET&x=@github.com` reads as **github.com** to
 * the app while the request itself goes to evil.example. Every allowlist and
 * private-address check built on it could be walked around with one `@`, and
 * Jest never noticed because Node's `URL` is the standard one.
 *
 * This parser does not try to accept everything a browser would. It accepts
 * the URLs people and models actually use and refuses the rest outright:
 * userinfo (`user@host`), backslashes, whitespace and control characters,
 * non-ASCII hosts (use the punycode form), and anything without a host. What
 * it returns is the URL rebuilt from the parts it checked, and that rebuilt
 * `href` is what callers must fetch — never the raw string.
 */

/* eslint-disable no-bitwise, no-control-regex -- address arithmetic, and refusing control bytes, are the point of this file. */

export interface SafeUrl {
  protocol: 'http:' | 'https:';
  /** Lower-case, no trailing dot; IPv6 without brackets. */
  hostname: string;
  /** Empty when the URL gave none. */
  port: string;
  /** Path, query and fragment, starting with `/` (at least `/`). */
  rest: string;
  /** The URL rebuilt from the checked parts. Fetch this. */
  href: string;
}

const FORBIDDEN = /[\s\x00-\x1f\x7f\\]/;
const URL_SHAPE = /^(https?):\/\/([^/?#]*)([/?#][^]*)?$/i;
const HOST_NAME = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

export function parseHttpUrl(raw: unknown): SafeUrl | null {
  const input = typeof raw === 'string' ? raw.trim() : '';
  if (!input || input.length > 8192 || FORBIDDEN.test(input)) return null;
  const match = input.match(URL_SHAPE);
  if (!match) return null;
  const protocol = `${match[1].toLowerCase()}:` as SafeUrl['protocol'];
  const authority = match[2];
  // No userinfo, ever: it is how a URL says one host and means another.
  if (!authority || authority.includes('@')) return null;

  let hostname: string;
  let port = '';
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']');
    if (close < 0) return null;
    hostname = authority.substring(1, close).toLowerCase();
    const after = authority.substring(close + 1);
    if (after) {
      if (!/^:\d{1,5}$/.test(after)) return null;
      port = after.substring(1);
    }
    if (!/^[0-9a-f:.]+$/.test(hostname) || !hostname.includes(':')) {
      return null;
    }
  } else {
    const colon = authority.lastIndexOf(':');
    if (colon >= 0) {
      port = authority.substring(colon + 1);
      if (!/^\d{1,5}$/.test(port)) return null;
      hostname = authority.substring(0, colon);
    } else {
      hostname = authority;
    }
    hostname = hostname.toLowerCase().replace(/\.$/, '');
    if (!hostname || !HOST_NAME.test(hostname)) return null;
  }
  if (port && (Number(port) < 1 || Number(port) > 65535)) return null;

  const rest = match[3]
    ? match[3].startsWith('/')
      ? match[3]
      : `/${match[3]}`
    : '/';
  const host = hostname.includes(':') ? `[${hostname}]` : hostname;
  return {
    protocol,
    hostname,
    port,
    rest,
    href: `${protocol}//${host}${port ? `:${port}` : ''}${rest}`,
  };
}

/**
 * The IPv4 address a host name stands for when it is written as a number in
 * any of the forms resolvers accept — dotted, decimal, hex or octal, one to
 * four parts — or null when it is a name. `2130706433`, `0x7f000001` and
 * `0177.0.0.1` are all 127.0.0.1 to the network stack.
 */
export function ipv4FromHost(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length < 1 || parts.length > 4) return null;
  const values: number[] = [];
  for (const part of parts) {
    let value: number;
    if (/^0x[0-9a-f]*$/i.test(part)) value = parseInt(part.slice(2) || '0', 16);
    else if (/^0[0-7]+$/.test(part)) value = parseInt(part, 8);
    else if (/^0\d/.test(part))
      return null; // 09: not octal, not an address
    else if (/^\d+$/.test(part)) value = Number(part);
    else return null;
    if (!Number.isFinite(value)) return null;
    values.push(value);
  }
  // inet_aton: the last part fills every byte the earlier ones left.
  const last = values[values.length - 1];
  const head = values.slice(0, -1);
  if (head.some(value => value > 255)) return null;
  const room = 4 - head.length;
  if (last >= 2 ** (8 * room)) return null;
  const bytes = [...head];
  for (let i = room - 1; i >= 0; i--)
    bytes.push(Math.floor(last / 2 ** (8 * i)) % 256);
  return bytes;
}

function privateIpv4([a, b]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT, Tailscale
  if (a === 169 && b === 254) return true; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

/** The 16 bytes of an IPv6 address, or null when it is not one. */
function ipv6Bytes(host: string): number[] | null {
  let text = host;
  let tail: number[] = [];
  const v4 = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const bytes = ipv4FromHost(v4[2]);
    if (!bytes || v4[2].split('.').length !== 4) return null;
    tail = bytes;
    text = `${v4[1]}0:0`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const group = (side: string) => (side ? side.split(':') : []);
  const left = group(halves[0]);
  const right = halves.length === 2 ? group(halves[1]) : [];
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 ? missing !== 0 : missing < 0) return null;
  const words = [...left, ...Array(Math.max(missing, 0)).fill('0'), ...right];
  if (words.length !== 8) return null;
  const bytes: number[] = [];
  for (const word of words) {
    if (!/^[0-9a-f]{1,4}$/i.test(word)) return null;
    const value = parseInt(word, 16);
    bytes.push(value >> 8, value & 255);
  }
  if (tail.length) bytes.splice(12, 4, ...tail);
  return bytes;
}

/**
 * True for any host this app must never fetch on someone else's say-so:
 * loopback, private, link-local, CGNAT and reserved ranges in every spelling,
 * and the names that mean "this machine" or "this network".
 *
 * Names are checked as names: DNS can still point a public-looking name at a
 * private address. Closing that needs the resolved address at connect time,
 * which JavaScript on React Native cannot see.
 */
export function isPrivateHost(rawHost: string): boolean {
  const host = String(rawHost || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home.arpa')
  ) {
    return true;
  }
  if (host.includes(':')) {
    const bytes = ipv6Bytes(host);
    if (!bytes) return true; // Unreadable as an address: refuse, don't guess.
    if (bytes.every(byte => byte === 0)) return true; // ::
    if (bytes.slice(0, 15).every(byte => byte === 0) && bytes[15] === 1) {
      return true; // ::1
    }
    const mapped =
      bytes.slice(0, 10).every(byte => byte === 0) &&
      bytes[10] === 255 &&
      bytes[11] === 255;
    if (mapped) return privateIpv4(bytes.slice(12));
    if ((bytes[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique local
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // fe80::/10
    if (bytes[0] === 0xff) return true; // multicast
    return false;
  }
  const v4 = ipv4FromHost(host);
  return v4 ? privateIpv4(v4) : false;
}
