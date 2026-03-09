/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const en = require('./en.json') as Record<string, string>;
const fr = require('./fr.json') as Record<string, string>;
const de = require('./de.json') as Record<string, string>;
const it = require('./it.json') as Record<string, string>;
const pt = require('./pt.json') as Record<string, string>;
const ro = require('./ro.json') as Record<string, string>;
const ru = require('./ru.json') as Record<string, string>;
const sr = require('./sr.json') as Record<string, string>;
const es = require('./es.json') as Record<string, string>;
const id = require('./id.json') as Record<string, string>;

export const bundledTranslations: Record<string, Record<string, string>> = {
  en,
  fr,
  de,
  it,
  pt,
  ro,
  ru,
  sr,
  es,
  id,
};
