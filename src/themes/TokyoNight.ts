/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeMinimalFormats } from './formats';
import { darken, lighten, mix, withAlpha } from './palette';

const t = (k: string) => tx.t(k);

export const TOKYO_NIGHT_THEME: Theme = {
  id: 'tokyo-night',
  name: t('Tokyo Night'),
  isCustom: false,
  colors: {
    background: '#1A1B26',
    surface: '#24283B',
    surfaceVariant: '#2F3549',
    surfaceAlt: darken('#1A1B26', 0.25),
    cardBackground: lighten('#1A1B26', 0.05),

    text: '#C0CAF5',
    textSecondary: '#565F89',
    textDisabled: darken('#565F89', 0.25),

    primary: '#7AA2F7',
    primaryDark: darken('#7AA2F7', 0.2),
    primaryLight: lighten('#7AA2F7', 0.15),
    onPrimary: '#1A1B26',

    secondary: '#FF9E64',
    onSecondary: '#1A1B26',

    accent: '#7AA2F7',
    onAccent: '#1A1B26',

    success: '#9ECE6A',
    error: '#F7768E',
    warning: '#E0AF68', // yellow — distinct from error/quit red
    info: '#7DCFFF',

    border: mix('#1A1B26', '#24283B', 0.6),
    borderLight: darken('#2F3549', 0.15),
    divider: darken('#2F3549', 0.15),

    messageBackground: '#24283B',
    messageText: '#C0CAF5',
    messageNick: '#7AA2F7',
    messageTimestamp: '#565F89',

    systemMessage: '#565F89',
    noticeMessage: '#E0AF68',
    joinMessage: '#9ECE6A',
    partMessage: '#FF9E64',
    quitMessage: '#F7768E',
    kickMessage: '#F7768E',
    nickMessage: '#7AA2F7',
    inviteMessage: '#7DCFFF',
    monitorMessage: '#7DCFFF',
    topicMessage: '#BB9AF7',
    modeMessage: '#7DCFFF',
    actionMessage: '#BB9AF7',
    rawMessage: '#565F89',
    ctcpMessage: '#7DCFFF',

    inputBackground: '#2F3549',
    inputText: '#C0CAF5',
    inputBorder: darken('#2F3549', 0.15),
    inputPlaceholder: '#565F89',

    buttonPrimary: '#7AA2F7',
    buttonPrimaryText: '#1A1B26',
    buttonSecondary: '#2F3549',
    buttonSecondaryText: '#C0CAF5',
    buttonDisabled: darken('#2F3549', 0.15),
    buttonDisabledText: darken('#565F89', 0.25),
    buttonText: '#C0CAF5',

    tabActive: '#7AA2F7',
    tabInactive: '#24283B',
    tabActiveText: '#1A1B26',
    tabInactiveText: '#565F89',
    tabBorder: darken('#2F3549', 0.15),

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#24283B',
    modalText: '#C0CAF5',

    userListBackground: darken('#1A1B26', 0.2),
    userListText: '#C0CAF5',
    userListBorder: darken('#2F3549', 0.15),
    userOwner: '#BB9AF7', // ~ owner (purple)
    userAdmin: '#F7768E', // & admin (red)
    userOp: '#FF9E64', // @ op (orange)
    userHalfop: '#7DCFFF', // % halfop (cyan)
    userVoice: '#9ECE6A', // + voice (green)
    userNormal: '#C0CAF5',
    highlightBackground: withAlpha('#7AA2F7', 0.2),
    highlightText: '#E0AF68', // Yellow text for mentions
    selectionBackground: withAlpha('#7AA2F7', 0.12),
  },
  messageFormats: makeMinimalFormats({
    timestamp: '#565F89',
    punctuation: '#565F89',
    nick: '#7AA2F7',
    action: '#BB9AF7',
    notice: '#E0AF68',
    join: '#9ECE6A',
    part: '#FF9E64',
    quit: '#F7768E',
    kick: '#F7768E',
    nickChange: '#7AA2F7',
    event: '#565F89',
    muted: '#565F89',
  }),
};
