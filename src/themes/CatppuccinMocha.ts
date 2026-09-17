/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Catppuccin Mocha — a soothing dark theme built on the official Catppuccin
 * Mocha palette. Structure mirrors the stock Dark theme; the Material blue
 * accent is swapped for Catppuccin's blue (#89B4FA) and the message palette is
 * driven by the calm "minimal" message-format preset.
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeMinimalFormats } from './formats';
import { darken, lighten, withAlpha } from './palette';

const t = (key: string) => tx.t(key);

// Catppuccin Mocha accent used across primary/interactive surfaces.
const BLUE = '#89B4FA';

export const CATPPUCCIN_MOCHA_THEME: Theme = {
  id: 'catppuccin-mocha',
  name: t('Catppuccin Mocha'),
  isCustom: false,
  colors: {
    // Backgrounds — base / surface0 / surface1 / mantle
    background: '#1E1E2E', // base
    surface: '#313244', // surface0
    surfaceVariant: '#45475A', // surface1
    surfaceAlt: '#181825', // mantle (darker)
    cardBackground: '#313244', // surface0

    // Text — text / subtext0 / overlay0
    text: '#CDD6F4',
    textSecondary: '#A6ADC8', // subtext0
    textDisabled: '#6C7086', // overlay0

    // Primary — Catppuccin blue
    primary: BLUE,
    primaryDark: darken(BLUE, 0.15),
    primaryLight: lighten(BLUE, 0.15),
    onPrimary: '#1E1E2E', // dark base reads cleanly on the light accent

    // Secondary — peach
    secondary: '#FAB387',
    onSecondary: '#1E1E2E',

    // Accent — green
    accent: '#A6E3A1',
    onAccent: '#1E1E2E',

    // Status
    success: '#A6E3A1', // green
    error: '#F38BA8', // red
    warning: '#FAB387', // peach
    info: '#89DCEB', // sky

    // Borders
    border: '#45475A', // surface1
    borderLight: '#313244', // surface0
    divider: '#313244',

    // Messages
    messageBackground: '#313244', // surface0
    messageText: '#CDD6F4',
    messageNick: BLUE,
    messageTimestamp: '#6C7086', // overlay0

    // System / event messages
    systemMessage: '#6C7086', // overlay0
    noticeMessage: '#F9E2AF', // yellow
    joinMessage: '#A6E3A1', // green
    partMessage: '#FAB387', // peach
    quitMessage: '#F38BA8', // red
    kickMessage: '#F38BA8', // red
    nickMessage: BLUE, // blue
    inviteMessage: '#89DCEB', // sky
    monitorMessage: '#89DCEB', // sky
    topicMessage: '#CBA6F7', // mauve
    modeMessage: '#94E2D5', // teal
    actionMessage: '#CBA6F7', // mauve
    rawMessage: '#A6ADC8', // subtext0
    ctcpMessage: '#94E2D5', // teal

    // Inputs
    inputBackground: '#313244', // surface0
    inputText: '#CDD6F4',
    inputBorder: '#45475A', // surface1
    inputPlaceholder: '#6C7086', // overlay0

    // Buttons
    buttonPrimary: BLUE,
    buttonPrimaryText: '#1E1E2E',
    buttonSecondary: '#45475A', // surface1
    buttonSecondaryText: '#CDD6F4',
    buttonDisabled: '#313244', // surface0
    buttonDisabledText: '#6C7086', // overlay0
    buttonText: '#CDD6F4',

    // Tabs
    tabActive: BLUE,
    tabInactive: '#313244', // surface0
    tabActiveText: '#1E1E2E',
    tabInactiveText: '#A6ADC8', // subtext0
    tabBorder: '#45475A', // surface1

    // Modals
    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#313244', // surface0
    modalText: '#CDD6F4',

    // User list
    userListBackground: '#181825', // mantle
    userListText: '#CDD6F4',
    userListBorder: '#313244', // surface0
    userOwner: '#CBA6F7', // ~ owner (mauve)
    userAdmin: '#F38BA8', // & admin (red)
    userOp: '#FAB387', // @ op (peach)
    userHalfop: '#89DCEB', // % halfop (sky)
    userVoice: '#A6E3A1', // + voice (green)
    userNormal: '#CDD6F4',
    highlightBackground: withAlpha(BLUE, 0.2),
    highlightText: '#F9E2AF', // yellow text for mentions
    selectionBackground: withAlpha(BLUE, 0.12),
  },
  messageFormats: makeMinimalFormats({
    timestamp: '#6C7086',
    punctuation: '#6C7086',
    nick: '#89B4FA',
    action: '#CBA6F7',
    notice: '#F9E2AF',
    join: '#A6E3A1',
    part: '#FAB387',
    quit: '#F38BA8',
    kick: '#F38BA8',
    nickChange: '#89B4FA',
    event: '#6C7086',
    muted: '#6C7086',
  }),
};
