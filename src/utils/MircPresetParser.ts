/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface MircPresetEntry {
  id: string;
  raw: string;
  enabled?: boolean;
}

const LINE_SPLIT = /\r\n|\n|\r/;

const CP1252_MAP: Record<number, number> = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
  0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
  0x9E: 0x017E, 0x9F: 0x0178,
};

const isValidUtf8 = (bytes: Uint8Array): boolean => {
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i];
    if (byte1 <= 0x7F) {
      i += 1;
      continue;
    }
    if ((byte1 & 0xE0) === 0xC0) {
      if (i + 1 >= bytes.length) return false;
      const byte2 = bytes[i + 1];
      if ((byte2 & 0xC0) !== 0x80) return false;
      i += 2;
      continue;
    }
    if ((byte1 & 0xF0) === 0xE0) {
      if (i + 2 >= bytes.length) return false;
      const byte2 = bytes[i + 1];
      const byte3 = bytes[i + 2];
      if ((byte2 & 0xC0) !== 0x80 || (byte3 & 0xC0) !== 0x80) return false;
      i += 3;
      continue;
    }
    if ((byte1 & 0xF8) === 0xF0) {
      if (i + 3 >= bytes.length) return false;
      const byte2 = bytes[i + 1];
      const byte3 = bytes[i + 2];
      const byte4 = bytes[i + 3];
      if (
        (byte2 & 0xC0) !== 0x80 ||
        (byte3 & 0xC0) !== 0x80 ||
        (byte4 & 0xC0) !== 0x80
      ) {
        return false;
      }
      i += 4;
      continue;
    }
    return false;
  }
  return true;
};

const decodeCp1252 = (bytes: Uint8Array): string => {
  let output = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte >= 0x80 && byte <= 0x9F) {
      const mapped = CP1252_MAP[byte];
      output += String.fromCharCode(mapped || byte);
    } else {
      output += String.fromCharCode(byte);
    }
  }
  return output;
};

export function decodeMircPresetBase64(base64: string): string {
  const sanitized = base64.replace(/\s+/g, '');
  const buffer = Buffer.from(sanitized, 'base64');
  const bytes = new Uint8Array(buffer);
  if (isValidUtf8(bytes)) {
    return buffer.toString('utf8');
  }
  return decodeCp1252(bytes);
}

export function splitPresetLines(raw: string): string[] {
  return raw
    .split(LINE_SPLIT)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function parseGenericPresets(raw: string): MircPresetEntry[] {
  return splitPresetLines(raw).map((line, index) => ({
    id: `preset-${index + 1}`,
    raw: line,
  }));
}

export function parseNickCompletionPresets(raw: string): MircPresetEntry[] {
  return splitPresetLines(raw).map((line, index) => {
    const match = line.match(/(\s+|\x08)(on|off)$/i);
    if (match) {
      const enabled = match[2].toLowerCase() === 'on';
      const separator = match[1];
      const rawValue = separator === '\x08'
        ? line.slice(0, match.index + 1)
        : line.slice(0, match.index).trim();
      return {
        id: `nick-${index + 1}`,
        raw: rawValue,
        enabled,
      };
    }
    return {
      id: `nick-${index + 1}`,
      raw: line,
    };
  });
}

export function parseIrcapDecorationEti(raw: string): string[] {
  const lines = raw.split(LINE_SPLIT).filter((line) => line.length > 0);
  const results: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const fields = line.split('\x08');
    if (fields.length < 9) continue;
    const prefix = fields[fields.length - 3] ?? '';
    const suffix = fields[fields.length - 2] ?? '';
    const style = `${prefix}\x08${suffix}`.replace(/\x00/g, '');
    if (!style.trim() && !style.includes('\x08')) continue;
    if (seen.has(style)) continue;
    seen.add(style);
    results.push(style);
  }

  return results;
}
