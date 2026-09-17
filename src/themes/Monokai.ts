/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeIrcapBarsFormats } from './formats';
import { withAlpha } from './palette';

const t = (key: string) => tx.t(key);

/** Monokai signature accent — the classic cyan used for nicks and primaries. */
const CYAN = '#66D9EF';

export const MONOKAI_THEME: Theme = {
  id: 'monokai',
  name: t('Monokai'),
  isCustom: false,
  colors: {
    background: '#272822',
    surface: '#3E3D32',
    surfaceVariant: '#49483E',
    surfaceAlt: '#32332B',
    cardBackground: '#3E3D32',

    text: '#F8F8F2',
    textSecondary: '#75715E',
    textDisabled: '#56534A',

    primary: CYAN,
    primaryDark: '#45B4CC',
    primaryLight: '#8CE6F5',
    onPrimary: '#272822',

    secondary: '#FD971F',
    onSecondary: '#272822',

    accent: '#A6E22E',
    onAccent: '#272822',

    success: '#A6E22E',
    error: '#F92672',
    warning: '#FD971F',
    info: CYAN,

    border: '#49483E',
    borderLight: '#3E3D32',
    divider: '#3E3D32',

    messageBackground: '#3E3D32',
    messageText: '#F8F8F2',
    messageNick: CYAN,
    messageTimestamp: '#75715E',

    systemMessage: '#75715E',
    noticeMessage: '#E6DB74',
    joinMessage: '#A6E22E',
    partMessage: '#FD971F',
    quitMessage: '#F92672',
    kickMessage: '#F92672',
    nickMessage: CYAN,
    inviteMessage: CYAN,
    monitorMessage: CYAN,
    topicMessage: '#AE81FF',
    modeMessage: CYAN,
    actionMessage: '#F92672',
    rawMessage: '#75715E',
    ctcpMessage: CYAN,

    inputBackground: '#49483E',
    inputText: '#F8F8F2',
    inputBorder: '#5A594D',
    inputPlaceholder: '#75715E',

    buttonPrimary: CYAN,
    buttonPrimaryText: '#272822',
    buttonSecondary: '#49483E',
    buttonSecondaryText: '#F8F8F2',
    buttonDisabled: '#3E3D32',
    buttonDisabledText: '#75715E',
    buttonText: '#F8F8F2',

    tabActive: CYAN,
    tabInactive: '#3E3D32',
    tabActiveText: '#272822',
    tabInactiveText: '#75715E',
    tabBorder: '#49483E',

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#3E3D32',
    modalText: '#F8F8F2',

    userListBackground: '#32332B',
    userListText: '#F8F8F2',
    userListBorder: '#3E3D32',
    userOwner: '#AE81FF', // ~ owner (purple)
    userAdmin: '#F92672', // & admin (pink)
    userOp: '#FD971F', // @ op (orange)
    userHalfop: CYAN, // % halfop (cyan)
    userVoice: '#A6E22E', // + voice (green)
    userNormal: '#F8F8F2',
    highlightBackground: withAlpha(CYAN, 0.2),
    highlightText: '#E6DB74', // Yellow text for mentions
    selectionBackground: withAlpha(CYAN, 0.12),
  },
  messageFormats: makeIrcapBarsFormats({
    timestamp: '#75715E',
    punctuation: '#75715E',
    nick: CYAN,
    action: '#F92672',
    notice: '#E6DB74',
    join: '#A6E22E',
    part: '#FD971F',
    quit: '#F92672',
    kick: '#F92672',
    nickChange: CYAN,
    event: '#75715E',
    muted: '#75715E',
  }),
};
