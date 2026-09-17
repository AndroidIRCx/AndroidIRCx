/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Catppuccin Latte — a warm light theme built on the official Catppuccin Latte
 * palette. Structure mirrors the stock Light theme; the Material blue accent is
 * swapped for Catppuccin's blue (#1E66F5) and the message palette is driven by
 * the calm "minimal" message-format preset. Body text (#4C4F69) on the base
 * background (#EFF1F5) clears WCAG AA comfortably (~9:1).
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeMinimalFormats } from './formats';
import { darken, lighten, withAlpha } from './palette';

const t = (key: string) => tx.t(key);

// Catppuccin Latte accent used across primary/interactive surfaces.
const BLUE = '#1E66F5';

export const CATPPUCCIN_LATTE_THEME: Theme = {
  id: 'catppuccin-latte',
  name: t('Catppuccin Latte'),
  isCustom: false,
  colors: {
    // Backgrounds — base / surface0 / surface1 / mantle
    background: '#EFF1F5', // base
    surface: '#CCD0DA', // surface0
    surfaceVariant: '#BCC0CC', // surface1
    surfaceAlt: '#E6E9EF', // mantle
    cardBackground: '#EFF1F5', // base

    // Text — text / subtext0 / overlay0
    text: '#4C4F69', // text
    textSecondary: '#6C6F85', // subtext0
    textDisabled: '#8C8FA1', // overlay0

    // Primary — Catppuccin blue
    primary: BLUE,
    primaryDark: darken(BLUE, 0.15),
    primaryLight: lighten(BLUE, 0.15),
    onPrimary: '#FFFFFF',

    // Secondary — peach
    secondary: '#FE640B',
    onSecondary: '#FFFFFF',

    // Accent — green
    accent: '#40A02B',
    onAccent: '#FFFFFF',

    // Status
    success: '#40A02B', // green
    error: '#D20F39', // red
    warning: '#FE640B', // peach
    info: '#04A5E5', // sky

    // Borders
    border: '#BCC0CC', // surface1
    borderLight: '#CCD0DA', // surface0
    divider: '#BCC0CC', // surface1

    // Messages
    messageBackground: '#EFF1F5', // base
    messageText: '#4C4F69',
    messageNick: BLUE,
    messageTimestamp: '#8C8FA1', // overlay0

    // System / event messages
    systemMessage: '#6C6F85', // subtext0
    noticeMessage: '#DF8E1D', // yellow
    joinMessage: '#40A02B', // green
    partMessage: '#FE640B', // peach
    quitMessage: '#D20F39', // red
    kickMessage: '#D20F39', // red
    nickMessage: BLUE, // blue
    inviteMessage: '#04A5E5', // sky
    monitorMessage: '#04A5E5', // sky
    topicMessage: '#8839EF', // mauve
    modeMessage: '#179299', // teal
    actionMessage: '#8839EF', // mauve
    rawMessage: '#6C6F85', // subtext0
    ctcpMessage: '#179299', // teal

    // Inputs
    inputBackground: '#CCD0DA', // surface0
    inputText: '#4C4F69',
    inputBorder: '#BCC0CC', // surface1
    inputPlaceholder: '#8C8FA1', // overlay0

    // Buttons
    buttonPrimary: BLUE,
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#CCD0DA', // surface0
    buttonSecondaryText: '#4C4F69',
    buttonDisabled: '#E6E9EF', // mantle
    buttonDisabledText: '#8C8FA1', // overlay0
    buttonText: '#FFFFFF',

    // Tabs
    tabActive: BLUE,
    tabInactive: '#CCD0DA', // surface0
    tabActiveText: '#FFFFFF',
    tabInactiveText: '#6C6F85', // subtext0
    tabBorder: '#BCC0CC', // surface1

    // Modals
    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#EFF1F5', // base
    modalText: '#4C4F69',

    // User list
    userListBackground: '#E6E9EF', // mantle
    userListText: '#4C4F69',
    userListBorder: '#CCD0DA', // surface0
    userOwner: '#8839EF', // ~ owner (mauve)
    userAdmin: '#D20F39', // & admin (red)
    userOp: '#FE640B', // @ op (peach)
    userHalfop: '#04A5E5', // % halfop (sky)
    userVoice: '#40A02B', // + voice (green)
    userNormal: '#4C4F69',
    highlightBackground: withAlpha(BLUE, 0.1),
    highlightText: '#DF8E1D', // yellow text for mentions
    selectionBackground: withAlpha(BLUE, 0.12),
  },
  messageFormats: makeMinimalFormats({
    timestamp: '#8C8FA1',
    punctuation: '#8C8FA1',
    nick: '#1E66F5',
    action: '#8839EF',
    notice: '#DF8E1D',
    join: '#40A02B',
    part: '#FE640B',
    quit: '#D20F39',
    kick: '#D20F39',
    nickChange: '#1E66F5',
    event: '#6C6F85',
    muted: '#8C8FA1',
  }),
};
