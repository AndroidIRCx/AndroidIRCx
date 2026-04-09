/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Config from 'react-native-config';

export const TRANSIFEX_NATIVE_TOKEN = Config.TRANSIFEX_NATIVE_TOKEN ?? '';
export const TRANSIFEX_CDS_HOST =
  Config.TRANSIFEX_CDS_HOST ?? 'https://cds.svc.transifex.net';

export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = [
  'en',
  'fr',
  'de',
  'it',
  'pt',
  'ro',
  'ru',
  'sr',
  'es',
  'id',
];
