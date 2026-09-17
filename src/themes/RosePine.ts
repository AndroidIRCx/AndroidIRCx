/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeMinimalFormats } from './formats';
import { darken, lighten, mix, withAlpha } from './palette';

const t = (k: string) => tx.t(k);

// Rosé Pine palette (https://rosepinetheme.com) — main (dark) variant.
const BASE = '#191724';
const SURFACE = '#1F1D2E';
const OVERLAY = '#26233A';
const TEXT = '#E0DEF4';
const MUTED = '#6E6A86';
const SUBTLE = '#908CAA';
const LOVE = '#EB6F92';
const GOLD = '#F6C177';
const ROSE = '#EBBCBA';
const PINE = '#31748F';
const FOAM = '#9CCFD8';
const IRIS = '#C4A7E7';

export const ROSE_PINE_THEME: Theme = {
  id: 'rose-pine',
  name: t('Rosé Pine'),
  isCustom: false,
  colors: {
    background: BASE,
    surface: SURFACE,
    surfaceVariant: OVERLAY,
    surfaceAlt: darken(BASE, 0.25),
    cardBackground: lighten(BASE, 0.05),

    text: TEXT,
    textSecondary: SUBTLE,
    textDisabled: darken(SUBTLE, 0.25),

    primary: FOAM,
    primaryDark: darken(FOAM, 0.2),
    primaryLight: lighten(FOAM, 0.15),
    onPrimary: BASE,

    secondary: GOLD,
    onSecondary: BASE,

    accent: FOAM,
    onAccent: BASE,

    success: PINE,
    error: LOVE,
    warning: GOLD, // gold — distinct from error/quit red
    info: FOAM,

    border: mix(BASE, OVERLAY, 0.6),
    borderLight: darken(OVERLAY, 0.2),
    divider: darken(OVERLAY, 0.2),

    messageBackground: SURFACE,
    messageText: TEXT,
    messageNick: FOAM,
    messageTimestamp: MUTED,

    systemMessage: MUTED,
    noticeMessage: GOLD,
    joinMessage: PINE,
    partMessage: ROSE,
    quitMessage: LOVE,
    kickMessage: LOVE,
    nickMessage: FOAM,
    inviteMessage: FOAM,
    monitorMessage: FOAM,
    topicMessage: IRIS,
    modeMessage: FOAM,
    actionMessage: IRIS,
    rawMessage: MUTED,
    ctcpMessage: FOAM,

    inputBackground: lighten(SURFACE, 0.08),
    inputText: TEXT,
    inputBorder: darken(OVERLAY, 0.15),
    inputPlaceholder: MUTED,

    buttonPrimary: FOAM,
    buttonPrimaryText: BASE,
    buttonSecondary: OVERLAY,
    buttonSecondaryText: TEXT,
    buttonDisabled: darken(OVERLAY, 0.15),
    buttonDisabledText: darken(SUBTLE, 0.25),
    buttonText: TEXT,

    tabActive: FOAM,
    tabInactive: SURFACE,
    tabActiveText: TEXT,
    tabInactiveText: SUBTLE,
    tabBorder: darken(OVERLAY, 0.15),

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: SURFACE,
    modalText: TEXT,

    userListBackground: darken(BASE, 0.25),
    userListText: TEXT,
    userListBorder: darken(OVERLAY, 0.2),
    userOwner: IRIS, // ~ owner (iris)
    userAdmin: LOVE, // & admin (love)
    userOp: GOLD, // @ op (gold)
    userHalfop: FOAM, // % halfop (foam)
    userVoice: PINE, // + voice (pine)
    userNormal: TEXT,
    highlightBackground: withAlpha(FOAM, 0.2),
    highlightText: GOLD, // Gold text for mentions
    selectionBackground: withAlpha(FOAM, 0.12),
  },
  messageFormats: makeMinimalFormats({
    timestamp: '#6E6A86',
    punctuation: '#6E6A86',
    nick: '#9CCFD8',
    action: '#C4A7E7',
    notice: '#F6C177',
    join: '#31748F',
    part: '#EBBCBA',
    quit: '#EB6F92',
    kick: '#EB6F92',
    nickChange: '#9CCFD8',
    event: '#6E6A86',
    muted: '#6E6A86',
  }),
};
