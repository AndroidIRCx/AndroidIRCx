/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */
/* eslint-disable no-bitwise -- Line fingerprinting uses FNV-1a, which is defined in bit operations. */

/**
 * Pure, synchronous rules for raw IRC traffic leaving the app.
 *
 * This module deliberately imports nothing. `IRCService` is allowed to import
 * it precisely because it is pure policy with no service dependencies, which
 * keeps that file's "imports no services" rule intact.
 */

/**
 * Commands whose meaning the connection itself depends on. An addon may never
 * rewrite a line into or out of this set: a malformed CAP, AUTHENTICATE or
 * PONG does not produce a visible error, it produces a connection that hangs
 * or silently drops its capabilities with no sign of why.
 *
 * PASS is included even though it is not a transport invariant, because it
 * carries the server password and must not be reshaped by a third party.
 */
export const TRANSPORT_CRITICAL_COMMANDS: ReadonlySet<string> = new Set([
  'PING',
  'PONG',
  'CAP',
  'AUTHENTICATE',
  'ERROR',
  'PASS',
]);

/** RFC 1459: 512 bytes on the wire including the trailing CRLF. */
export const MAX_LINE_BYTES = 510;

export type RawRejectReason =
  'empty' | 'control-characters' | 'line-break' | 'too-long';

export interface RawSanitizeResult {
  /** The line to put on the wire, or null when it must not be sent at all. */
  line: string | null;
  /** Set when the line was shortened to fit the protocol limit. */
  truncated: boolean;
  /** Set when the line was refused outright. */
  rejected?: RawRejectReason;
}

/**
 * The command word of a raw line, upper-cased, or '' when there is none.
 * Tolerates an IRCv3 tag prefix and a source prefix even though the client
 * does not normally send either, because an addon-supplied line might.
 */
export function rawCommandOf(line: string): string {
  let rest = line.trimStart();
  if (rest.startsWith('@'))
    rest = rest.slice(rest.indexOf(' ') + 1 || rest.length).trimStart();
  if (rest.startsWith(':'))
    rest = rest.slice(rest.indexOf(' ') + 1 || rest.length).trimStart();
  const end = rest.indexOf(' ');
  return (end === -1 ? rest : rest.slice(0, end)).toUpperCase();
}

/**
 * Whether this line is one an addon must never author or rewrite.
 * Checked on the addon's *output* as well as its input, so a replacement
 * cannot turn an innocent line into `CAP END`.
 */
export function isTransportCritical(line: string): boolean {
  return (
    TRANSPORT_CRITICAL_COMMANDS.has(rawCommandOf(line)) ||
    carriesCredentials(line)
  );
}

/** Nicks of the usual services, in the forms people message them by. */
const SERVICE_TARGET =
  /^(nickserv|ns|chanserv|cs|operserv|os|hostserv|hs|memoserv|ms|botserv|bs|authserv|q|x|nickserv@services\.[^ ]+|q@cserve\.quakenet\.org)$/i;
/** Service commands whose arguments are a password. */
const CREDENTIAL_WORDS =
  /^(identify|id|register|ghost|recover|release|regain|login|auth|authenticate|set\s+password|setpass|confirm)\b/i;
/** Raw service aliases servers accept: "NS IDENTIFY pw", "NICKSERV …". */
const SERVICE_ALIASES = new Set([
  'NS',
  'NICKSERV',
  'CS',
  'CHANSERV',
  'OS',
  'OPERSERV',
  'HS',
  'HOSTSERV',
  'AUTH',
  'LOGIN',
  'IDENTIFY',
]);

/**
 * Whether a raw line carries a password: OPER, a service alias with a
 * credential command, or a message to a service that identifies, registers
 * or recovers a nick.
 *
 * Security pass 2026-10-05: only PASS and AUTHENTICATE were held back from
 * raw modifiers, so an addon with `irc.raw.modify` was handed
 * `PRIVMSG NickServ :IDENTIFY hunter2` and `OPER admin secret`.
 */
export function carriesCredentials(line: string): boolean {
  const command = rawCommandOf(line);
  if (command === 'OPER') return true;
  let rest = line.trimStart();
  if (rest.startsWith('@'))
    rest = rest.slice(rest.indexOf(' ') + 1 || rest.length).trimStart();
  if (rest.startsWith(':'))
    rest = rest.slice(rest.indexOf(' ') + 1 || rest.length).trimStart();
  const args = rest.slice(command.length).trimStart();
  if (SERVICE_ALIASES.has(command)) {
    return command === 'AUTH' || command === 'LOGIN' || command === 'IDENTIFY'
      ? true
      : CREDENTIAL_WORDS.test(args);
  }
  if (command !== 'PRIVMSG' && command !== 'NOTICE' && command !== 'SQUERY')
    return false;
  const space = args.indexOf(' ');
  const target = space === -1 ? args : args.slice(0, space);
  if (!SERVICE_TARGET.test(target)) return false;
  const text = (space === -1 ? '' : args.slice(space + 1))
    .replace(/^:/, '')
    .trimStart();
  return CREDENTIAL_WORDS.test(text);
}

/**
 * Text the user sent, with any password in it replaced, for handing to
 * addons that only asked to read. Covers what people type to services:
 * "IDENTIFY pw", "IDENTIFY account pw", "REGISTER pw email", "SET PASSWORD pw".
 */
export function redactCredentialText(text: string): string {
  const match = text.trimStart().match(CREDENTIAL_WORDS);
  return match ? `${match[0]} [redacted]` : text;
}

const UTF8 = typeof TextEncoder === 'function' ? new TextEncoder() : undefined;

/** Byte length of a line as it will actually be written to the socket. */
export function byteLengthOf(value: string): number {
  if (UTF8) return UTF8.encode(value).length;
  // Environments without TextEncoder still get a correct UTF-8 count.
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Trim to at most `maxBytes` of UTF-8 without splitting a code point, so a
 * truncated line is still valid text rather than a broken sequence.
 */
function truncateToBytes(value: string, maxBytes: number): string {
  let bytes = 0;
  let cut = 0;
  for (const character of value) {
    const size = byteLengthOf(character);
    if (bytes + size > maxBytes) break;
    bytes += size;
    cut += character.length;
  }
  return value.slice(0, cut);
}

/**
 * The single gate every outbound line passes, whoever wrote it.
 *
 * A carriage return or line feed is refused rather than stripped: it is the
 * one way to smuggle a second command into a line that looked like one, and
 * silently repairing it would hide a deliberate attempt. Over-length lines are
 * truncated instead of dropped, because the server would truncate them anyway
 * and losing the whole message is the worse outcome for the user.
 */
export function sanitizeOutboundLine(line: string): RawSanitizeResult {
  if (typeof line !== 'string' || line.trim().length === 0)
    return { line: null, truncated: false, rejected: 'empty' };
  if (/[\r\n]/.test(line))
    return { line: null, truncated: false, rejected: 'line-break' };
  // NUL terminates the line for the server's parser; everything below 0x20
  // other than the IRC formatting codes has no legitimate place in a command.
  if (/\0/.test(line))
    return { line: null, truncated: false, rejected: 'control-characters' };

  if (byteLengthOf(line) <= MAX_LINE_BYTES) return { line, truncated: false };

  const shortened = truncateToBytes(line, MAX_LINE_BYTES);
  if (shortened.trim().length === 0)
    return { line: null, truncated: false, rejected: 'too-long' };
  return { line: shortened, truncated: true };
}

/**
 * A stable, non-reversible fingerprint used to record that a line changed
 * without recording the line. FNV-1a: cheap, and this is a diagnostic aid, not
 * a security primitive.
 */
export function fingerprintLine(line: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < line.length; index += 1) {
    hash ^= line.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
