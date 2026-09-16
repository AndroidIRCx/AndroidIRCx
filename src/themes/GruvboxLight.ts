/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeIrcapBarsFormats } from './formats';
import { darken, lighten, withAlpha } from './palette';

const t = (key: string) => tx.t(key);

// Gruvbox light palette (https://github.com/morhetz/gruvbox) — light variant.
const BG0 = '#FBF1C7'; // background
const BG1 = '#EBDBB2'; // surface
const BG2 = '#D5C4A1'; // borders / dividers
const FG = '#3C3836'; // text (~10:1 on BG0)
const GRAY = '#7C6F64'; // textSecondary
const GRAY2 = '#928374'; // timestamp / disabled
const BLUE = '#076678'; // primary / nick / accent
const GREEN = '#79740E';
const RED = '#9D0006';
const YELLOW = '#B57614';
const PURPLE = '#8F3F71';
const AQUA = '#427B58';
const ORANGE = '#AF3A03';

export const GRUVBOX_LIGHT_THEME: Theme = {
  id: 'gruvbox-light',
  name: t('Gruvbox Light'),
  isCustom: false,
  colors: {
    background: BG0,
    surface: BG1,
    surfaceVariant: BG2,
    surfaceAlt: BG0,
    cardBackground: BG0,

    text: FG,
    textSecondary: GRAY,
    textDisabled: GRAY2,

    primary: BLUE,
    primaryDark: darken(BLUE, 0.2),
    primaryLight: lighten(BLUE, 0.2),
    onPrimary: BG0,

    secondary: ORANGE,
    onSecondary: BG0,

    accent: GREEN,
    onAccent: BG0,

    success: GREEN,
    error: RED,
    warning: YELLOW,
    info: BLUE,

    border: BG2,
    borderLight: BG1,
    divider: BG2,

    messageBackground: BG0,
    messageText: FG,
    messageNick: BLUE,
    messageTimestamp: GRAY2,

    systemMessage: AQUA,
    noticeMessage: YELLOW,
    joinMessage: GREEN,
    partMessage: ORANGE,
    quitMessage: RED,
    kickMessage: RED,
    nickMessage: BLUE,
    inviteMessage: AQUA,
    monitorMessage: AQUA,
    topicMessage: PURPLE,
    modeMessage: AQUA,
    actionMessage: PURPLE,
    rawMessage: GRAY,
    ctcpMessage: AQUA,

    inputBackground: BG1,
    inputText: FG,
    inputBorder: BG2,
    inputPlaceholder: GRAY2,

    buttonPrimary: BLUE,
    buttonPrimaryText: BG0,
    buttonSecondary: BG2,
    buttonSecondaryText: FG,
    buttonDisabled: BG1,
    buttonDisabledText: GRAY2,
    buttonText: BG0,

    tabActive: BLUE,
    tabInactive: BG1,
    tabActiveText: BG0,
    tabInactiveText: GRAY,
    tabBorder: BG2,

    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: BG0,
    modalText: FG,

    userListBackground: BG1,
    userListText: FG,
    userListBorder: BG2,
    userOwner: PURPLE, // ~ owner (purple)
    userAdmin: RED, // & admin (red)
    userOp: ORANGE, // @ op (orange)
    userHalfop: BLUE, // % halfop (blue)
    userVoice: GREEN, // + voice (green)
    userNormal: FG,
    highlightBackground: withAlpha(BLUE, 0.1),
    highlightText: ORANGE, // Orange text for mentions
    selectionBackground: withAlpha(BLUE, 0.12),
  },
  messageFormats: makeIrcapBarsFormats({
    timestamp: '#928374',
    punctuation: '#076678',
    nick: '#076678',
    action: '#8F3F71',
    notice: '#B57614',
    join: '#79740E',
    part: '#AF3A03',
    quit: '#9D0006',
    kick: '#9D0006',
    nickChange: '#076678',
    event: '#7C6F64',
    muted: '#928374',
  }),
};
