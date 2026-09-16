/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * "Matrix" — a built-in DARK theme: phosphor green on black. Every role,
 * message type and UI accent stays green-tinted, echoing the digital-rain
 * terminal look. Structure mirrors DARK_THEME (all colour keys present); the
 * message layout adopts the classic mIRC preset with a green palette.
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeClassicMircFormats } from './formats';
import { darken, lighten, withAlpha } from './palette';

const t = (key: string) => tx.t(key);

// Phosphor green used for the primary/accent role across the whole theme.
const PHOSPHOR = '#00FF41';

export const MATRIX_THEME: Theme = {
  id: 'matrix',
  name: t('Matrix'),
  isCustom: false,
  colors: {
    background: '#0B0F0B',
    surface: '#001100',
    surfaceVariant: '#002200',
    surfaceAlt: '#050805',
    cardBackground: '#001100',

    text: '#00FF41',
    textSecondary: '#00A32B',
    textDisabled: '#1F7A1F',

    primary: PHOSPHOR,
    primaryDark: darken(PHOSPHOR, 0.3),
    primaryLight: lighten(PHOSPHOR, 0.3),
    onPrimary: '#0B0F0B',

    secondary: '#00E676',
    onSecondary: '#0B0F0B',

    accent: PHOSPHOR,
    onAccent: '#0B0F0B',

    success: '#00C853',
    error: '#FF1744', // red is acceptable for errors even in a green theme
    warning: '#FFEA00',
    info: '#00E676',

    border: '#0A3A0A',
    borderLight: '#002200',
    divider: '#002200',

    messageBackground: '#001100',
    messageText: '#00FF41',
    messageNick: '#39FF14',
    messageTimestamp: '#1F7A1F',

    systemMessage: '#00A32B',
    noticeMessage: '#B9F6CA',
    joinMessage: '#00C853',
    partMessage: '#64DD17',
    quitMessage: '#33691E',
    kickMessage: '#33691E',
    nickMessage: '#39FF14',
    inviteMessage: '#00E676',
    monitorMessage: '#00E676',
    topicMessage: '#76FF03',
    modeMessage: '#00E676',
    actionMessage: '#76FF03',
    rawMessage: '#00A32B',
    ctcpMessage: '#00E676',

    inputBackground: '#002200',
    inputText: '#00FF41',
    inputBorder: '#0A3A0A',
    inputPlaceholder: '#1F7A1F',

    buttonPrimary: PHOSPHOR,
    buttonPrimaryText: '#0B0F0B',
    buttonSecondary: '#002200',
    buttonSecondaryText: '#00FF41',
    buttonDisabled: '#002200',
    buttonDisabledText: '#1F7A1F',
    buttonText: '#00FF41',

    tabActive: PHOSPHOR,
    tabInactive: '#001100',
    tabActiveText: '#00FF41',
    tabInactiveText: '#00A32B',
    tabBorder: '#0A3A0A',

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#001100',
    modalText: '#00FF41',

    userListBackground: '#050805',
    userListText: '#00FF41',
    userListBorder: '#002200',
    userOwner: '#CCFF90', // ~ owner (brightest green)
    userAdmin: '#FF1744', // & admin (red)
    userOp: '#76FF03', // @ op (light green)
    userHalfop: '#00E676', // % halfop (green)
    userVoice: '#00A32B', // + voice (dim green)
    userNormal: '#00FF41',
    highlightBackground: withAlpha(PHOSPHOR, 0.15),
    highlightText: '#CCFF90',
    selectionBackground: withAlpha(PHOSPHOR, 0.12),
  },
  messageFormats: makeClassicMircFormats({
    timestamp: '#1F7A1F',
    punctuation: '#00A32B',
    nick: '#39FF14',
    action: '#76FF03',
    notice: '#B9F6CA',
    join: '#00C853',
    part: '#64DD17',
    quit: '#33691E',
    kick: '#33691E',
    nickChange: '#39FF14',
    event: '#00A32B',
    muted: '#1F7A1F',
  }),
};
