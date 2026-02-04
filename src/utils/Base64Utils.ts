/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Buffer } from 'buffer';

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

const isMostlyPrintable = (value: string): boolean => {
  if (!value) return false;
  let printable = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) {
      printable++;
    }
  }
  return printable / value.length >= 0.85;
};

export const decodeIfBase64Like = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length % 4 !== 0) {
    return value;
  }
  if (!BASE64_REGEX.test(trimmed)) {
    return value;
  }
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (!decoded || decoded.includes('\u0000')) {
      return value;
    }
    return isMostlyPrintable(decoded) ? decoded : value;
  } catch {
    return value;
  }
};
