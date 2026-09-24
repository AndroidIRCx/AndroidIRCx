/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The file shapes mIRC scripts actually use — line lists, INI files, CSV and
 * JSON — parsed here once instead of badly in every addon.
 *
 * Pure, and every parser is total: it returns a value for any input rather than
 * throwing. An addon reading a file a user edited by hand will meet malformed
 * data eventually, and a parser that throws turns that into a crashed addon
 * instead of a missing line.
 */

export const MAX_LINES = 10_000;
export const MAX_CSV_COLUMNS = 50;
export const MAX_INI_SECTIONS = 200;

// ──────────────────────────────────────────────────────────────── lines ──

/** Split into lines, tolerating CRLF and a trailing newline. */
export function parseLines(text: string): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const lines = text.split(/\r\n|\r|\n/);
  // A file ending in a newline has one empty element at the end that nobody
  // means; a blank line in the middle is real data and stays.
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.slice(0, MAX_LINES);
}

export function formatLines(lines: readonly string[]): string {
  return lines.length === 0 ? '' : `${lines.slice(0, MAX_LINES).join('\n')}\n`;
}

// ────────────────────────────────────────────────────────────────── JSON ──

export interface JsonResult<T = unknown> {
  ok: boolean;
  value?: T;
  error?: string;
}

/** `JSON.parse` that reports instead of throwing. */
export function parseJson<T = unknown>(text: string): JsonResult<T> {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message ?? error) };
  }
}

// ─────────────────────────────────────────────────────────────────── CSV ──

/**
 * RFC 4180 CSV: quoted fields may contain commas, newlines and doubled quotes.
 *
 * Splitting on commas is the obvious approach and is wrong for any file that
 * has ever been through a spreadsheet, which is most of them.
 */
export function parseCsv(text: string): string[][] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }

    if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // Swallowed; the \n that follows ends the row.
    } else if (char === '\n') {
      row.push(field);
      field = '';
      rows.push(row.slice(0, MAX_CSV_COLUMNS));
      row = [];
      if (rows.length >= MAX_LINES) return rows;
    } else field += char;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row.slice(0, MAX_CSV_COLUMNS));
  }
  return rows;
}

export function formatCsv(rows: readonly (readonly string[])[]): string {
  return rows
    .slice(0, MAX_LINES)
    .map(row =>
      row
        .slice(0, MAX_CSV_COLUMNS)
        .map(field => {
          const value = String(field ?? '');
          // Quoted only when it has to be, so a plain file stays readable.
          return /[",\r\n]/.test(value)
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        })
        .join(','),
    )
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────── INI ──

export type IniData = Record<string, Record<string, string>>;

/**
 * mIRC's INI files. Keys before any `[section]` go into the empty-string
 * section, which is what `$readini` does with them.
 */
export function parseIni(text: string): IniData {
  const data: IniData = { '': {} };
  let section = '';

  for (const line of parseLines(text)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith(';') || trimmed.startsWith('#'))
      continue;

    const header = /^\[(.*)\]$/.exec(trimmed);
    if (header) {
      section = header[1].trim();
      if (Object.keys(data).length <= MAX_INI_SECTIONS) data[section] ??= {};
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!key) continue;
    // Only the first `=` splits, so a value may contain one.
    (data[section] ??= {})[key] = trimmed.slice(separator + 1).trim();
  }

  if (Object.keys(data['']).length === 0) delete data[''];
  return data;
}

export function formatIni(data: IniData): string {
  const lines: string[] = [];
  const unsectioned = data[''];
  if (unsectioned)
    for (const [key, value] of Object.entries(unsectioned))
      lines.push(`${key}=${value}`);

  for (const [section, entries] of Object.entries(data)) {
    if (section === '') continue;
    if (lines.length > 0) lines.push('');
    lines.push(`[${section}]`);
    for (const [key, value] of Object.entries(entries))
      lines.push(`${key}=${value}`);
  }
  return formatLines(lines);
}

// ───────────────────────────────────────────────────────────── archives ──

export const MAX_ARCHIVE_ENTRIES = 500;
export const MAX_ARCHIVE_UNPACKED_BYTES = 16 * 1024 * 1024;
/** Beyond this ratio an archive is a decompression bomb, not a backup. */
export const MAX_COMPRESSION_RATIO = 100;

export interface ArchiveEntrySummary {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
}

export type ArchiveRejection =
  | 'too-many-entries'
  | 'unpacked-too-large'
  | 'compression-bomb'
  | 'unsafe-entry-name';

/**
 * Whether an archive is safe to extract, judged before anything is written.
 *
 * The ratio check is what stops a decompression bomb: a few kilobytes that
 * expand to gigabytes fills the device before any per-file limit notices.
 * Entry names are checked with the same path policy the workspace uses, so
 * zip-slip cannot be prevented here and forgotten there.
 */
export function checkArchive(
  entries: readonly ArchiveEntrySummary[],
  isSafeName: (name: string) => boolean,
): { ok: boolean; reason?: ArchiveRejection; entry?: string } {
  if (entries.length > MAX_ARCHIVE_ENTRIES)
    return { ok: false, reason: 'too-many-entries' };

  let compressed = 0;
  let uncompressed = 0;
  for (const entry of entries) {
    if (!isSafeName(entry.name))
      return { ok: false, reason: 'unsafe-entry-name', entry: entry.name };
    compressed += Math.max(0, entry.compressedSize);
    uncompressed += Math.max(0, entry.uncompressedSize);
  }

  if (uncompressed > MAX_ARCHIVE_UNPACKED_BYTES)
    return { ok: false, reason: 'unpacked-too-large' };
  if (compressed > 0 && uncompressed / compressed > MAX_COMPRESSION_RATIO)
    return { ok: false, reason: 'compression-bomb' };
  return { ok: true };
}
