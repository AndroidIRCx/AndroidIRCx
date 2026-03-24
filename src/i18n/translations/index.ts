/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import enJson from './en.json';
import frJson from './fr.json';
import deJson from './de.json';
import itJson from './it.json';
import ptJson from './pt.json';
import roJson from './ro.json';
import ruJson from './ru.json';
import srJson from './sr.json';
import esJson from './es.json';
import idJson from './id.json';

export const bundledTranslations: Record<string, Record<string, unknown>> = {
  en: enJson,
  fr: frJson,
  de: deJson,
  it: itJson,
  pt: ptJson,
  ro: roJson,
  ru: ruJson,
  sr: srJson,
  es: esJson,
  id: idJson,
};
