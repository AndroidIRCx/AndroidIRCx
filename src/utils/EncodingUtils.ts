/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Buffer } from 'buffer';

export const repairMojibake = (value: string): string => {
  if (!value || !/[ÃÂ]/.test(value)) {
    return value;
  }
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8');
    if (!repaired || repaired.includes('�')) {
      return value;
    }
    return repaired;
  } catch {
    return value;
  }
};
