/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { DARK_THEME } from './DarkTheme';
import { IRCAP_THEME } from './IRcapTheme';
import { makeIrcapBarsFormats } from './formats';

const t = (key: string) => tx.t(key);

/**
 * Dark counterpart to the IRcap theme: the signature IRcap "[time] nick ¦ msg"
 * bar layout and teal/blue accents, on a dark surface. Reuses the stock dark
 * palette for structure and IRcap's recommended layout settings.
 */
export const IRCAP_DARK_THEME: Theme = {
  id: 'ircap-dark',
  name: t('IRcap Dark'),
  isCustom: false,
  colors: {
    ...DARK_THEME.colors,
    // IRcap teal/blue identity, tuned for a dark background
    primary: '#14B8A6',
    primaryDark: '#0F766E',
    primaryLight: '#5EEAD4',
    onPrimary: '#04211E',
    accent: '#38BDF8',
    onAccent: '#04211E',
    info: '#38BDF8',
    messageNick: '#2DD4BF',
    tabActive: '#0F766E',
    tabActiveText: '#E6FFFB',
    buttonPrimary: '#14B8A6',
    buttonPrimaryText: '#04211E',
    highlightBackground: 'rgba(20, 184, 166, 0.2)',
    highlightText: '#5EEAD4',
    selectionBackground: 'rgba(20, 184, 166, 0.12)',
  },
  messageFormats: makeIrcapBarsFormats({
    timestamp: '#7C8894',
    punctuation: '#38BDF8',
    nick: '#2DD4BF',
    action: '#C4B5FD',
    notice: '#FCD34D',
    join: '#34D399',
    part: '#FBBF24',
    quit: '#F87171',
    kick: '#F87171',
    nickChange: '#2DD4BF',
    event: '#94A3B8',
    muted: '#7C8894',
  }),
  recommendedSettings: IRCAP_THEME.recommendedSettings,
};
