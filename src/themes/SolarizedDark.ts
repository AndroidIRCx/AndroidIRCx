/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeIrcapBarsFormats } from './formats';
import { darken, lighten, mix, withAlpha } from './palette';

const t = (k: string) => tx.t(k);

/**
 * Solarized Dark — Ethan Schoonover's precision colour scheme, dark variant.
 * base03 background / base02 surface with the canonical accent ramp
 * (yellow, orange, red, magenta, violet, blue, cyan, green). The body text
 * uses base0 (#839496), which clears WCAG AA (4.75:1) on the base03 background.
 */
export const SOLARIZED_DARK_THEME: Theme = {
  id: 'solarized-dark',
  name: t('Solarized Dark'),
  isCustom: false,
  colors: {
    background: '#002B36', // base03
    surface: '#073642', // base02
    surfaceVariant: lighten('#073642', 0.08),
    surfaceAlt: mix('#002B36', '#073642', 0.4),
    cardBackground: '#073642',

    text: '#839496', // base0 (AA 4.75:1 on base03)
    textSecondary: '#586E75', // base01
    textDisabled: darken('#586E75', 0.18),

    primary: '#268BD2', // blue
    primaryDark: darken('#268BD2', 0.2),
    primaryLight: lighten('#268BD2', 0.15),
    onPrimary: '#FFFFFF',

    secondary: '#CB4B16', // orange
    onSecondary: '#FFFFFF',

    accent: '#859900', // green
    onAccent: '#FFFFFF',

    success: '#859900', // green
    error: '#DC322F', // red
    warning: '#B58900', // yellow — distinct from error/quit red
    info: '#2AA198', // cyan

    border: mix('#073642', '#586E75', 0.35),
    borderLight: '#073642',
    divider: '#073642',

    messageBackground: '#002B36', // base03 — matches main bg so base0 text clears AA
    messageText: '#93A1A1', // base1 (5.6:1 on base03)
    messageNick: '#268BD2', // blue
    messageTimestamp: '#586E75', // base01

    systemMessage: '#586E75', // base01
    noticeMessage: '#B58900', // yellow
    joinMessage: '#859900', // green
    partMessage: '#CB4B16', // orange
    quitMessage: '#DC322F', // red
    kickMessage: '#DC322F', // red
    nickMessage: '#268BD2', // blue
    inviteMessage: '#2AA198', // cyan
    monitorMessage: '#2AA198', // cyan
    topicMessage: '#6C71C4', // violet
    modeMessage: '#2AA198', // cyan
    actionMessage: '#D33682', // magenta
    rawMessage: '#586E75', // base01
    ctcpMessage: '#2AA198', // cyan

    inputBackground: lighten('#073642', 0.08),
    inputText: '#93A1A1', // base1
    inputBorder: mix('#073642', '#586E75', 0.35),
    inputPlaceholder: '#586E75', // base01

    buttonPrimary: '#268BD2',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#073642',
    buttonSecondaryText: '#93A1A1',
    buttonDisabled: lighten('#073642', 0.08),
    buttonDisabledText: darken('#586E75', 0.18),
    buttonText: '#93A1A1',

    tabActive: '#268BD2',
    tabInactive: '#073642',
    tabActiveText: '#93A1A1',
    tabInactiveText: '#586E75',
    tabBorder: mix('#073642', '#586E75', 0.35),

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#073642',
    modalText: '#93A1A1',

    userListBackground: mix('#002B36', '#073642', 0.4),
    userListText: '#93A1A1',
    userListBorder: '#073642',
    userOwner: '#6C71C4', // ~ owner (violet)
    userAdmin: '#DC322F', // & admin (red)
    userOp: '#CB4B16', // @ op (orange)
    userHalfop: '#268BD2', // % halfop (blue)
    userVoice: '#859900', // + voice (green)
    userNormal: '#93A1A1',
    highlightBackground: withAlpha('#268BD2', 0.2),
    highlightText: '#B58900', // yellow text for mentions
    selectionBackground: withAlpha('#268BD2', 0.12),
  },
  messageFormats: makeIrcapBarsFormats({
    timestamp: '#586E75',
    punctuation: '#586E75',
    nick: '#268BD2',
    action: '#D33682',
    notice: '#B58900',
    join: '#859900',
    part: '#CB4B16',
    quit: '#DC322F',
    kick: '#DC322F',
    nickChange: '#268BD2',
    event: '#586E75',
    muted: '#586E75',
  }),
};
