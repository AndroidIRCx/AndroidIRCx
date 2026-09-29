/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import enJson from './en.json';
import csJson from './cs.json';
import plJson from './pl.json';
import trJson from './tr.json';
import nlJson from './nl.json';
import huJson from './hu.json';
import elJson from './el.json';
import skJson from './sk.json';
import svJson from './sv.json';
import daJson from './da.json';
import nbJson from './nb.json';
import fiJson from './fi.json';
import bgJson from './bg.json';
import nnJson from './nn.json';
import zhCNJson from './zh-CN.json';
import zhTWJson from './zh-TW.json';
import jaJson from './ja.json';
import koJson from './ko.json';
import hiJson from './hi.json';
import frJson from './fr.json';
import deJson from './de.json';
import itJson from './it.json';
import ptJson from './pt.json';
import roJson from './ro.json';
import ruJson from './ru.json';
import srJson from './sr.json';
import srCyrlJson from './sr@Cyrl.json';
import esJson from './es.json';
import idJson from './id.json';

export const bundledTranslations: Record<string, Record<string, unknown>> = {
  en: enJson,
  cs: csJson,
  pl: plJson,
  tr: trJson,
  nl: nlJson,
  hu: huJson,
  el: elJson,
  sk: skJson,
  sv: svJson,
  da: daJson,
  nb: nbJson,
  fi: fiJson,
  bg: bgJson,
  nn: nnJson,
  'zh-CN': zhCNJson,
  'zh-TW': zhTWJson,
  ja: jaJson,
  ko: koJson,
  hi: hiJson,
  fr: frJson,
  de: deJson,
  it: itJson,
  pt: ptJson,
  ro: roJson,
  ru: ruJson,
  sr: srJson,
  'sr@Cyrl': srCyrlJson,
  es: esJson,
  id: idJson,
};
