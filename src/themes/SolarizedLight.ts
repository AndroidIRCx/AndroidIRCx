/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/localization';
import { Theme } from '../services/ThemeService';
import { makeIrcapBarsFormats } from './formats';
import { withAlpha } from './palette';

const t = (key: string) => tx.t(key);

// Solarized accent used for primary/nick/selection tints.
const SOLARIZED_BLUE = '#268BD2';

export const SOLARIZED_LIGHT_THEME: Theme = {
  id: 'solarized-light',
  name: t('Solarized Light'),
  isCustom: false,
  colors: {
    background: '#FDF6E3', // base3
    surface: '#EEE8D5', // base2
    surfaceVariant: '#EEE8D5', // base2
    surfaceAlt: '#FDF6E3', // base3
    cardBackground: '#FDF6E3', // base3

    text: '#586E75', // base01 (AA >=4.5 on base3)
    textSecondary: '#657B83', // base00
    textDisabled: '#93A1A1', // base1

    primary: '#268BD2', // blue
    primaryDark: '#1E6FA8',
    primaryLight: '#5AAEE0',
    onPrimary: '#FDF6E3',

    secondary: '#CB4B16', // orange
    onSecondary: '#FDF6E3',

    accent: '#859900', // green
    onAccent: '#FDF6E3',

    success: '#859900', // green
    error: '#DC322F', // red
    warning: '#B58900', // yellow
    info: '#268BD2', // blue

    border: '#93A1A1', // base1
    borderLight: '#EEE8D5', // base2
    divider: '#93A1A1', // base1

    messageBackground: '#FDF6E3',
    messageText: '#586E75', // base01
    messageNick: '#268BD2', // blue
    messageTimestamp: '#93A1A1', // base1

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

    inputBackground: '#EEE8D5', // base2
    inputText: '#586E75', // base01
    inputBorder: '#93A1A1', // base1
    inputPlaceholder: '#93A1A1', // base1

    buttonPrimary: '#268BD2',
    buttonPrimaryText: '#FDF6E3',
    buttonSecondary: '#EEE8D5',
    buttonSecondaryText: '#586E75',
    buttonDisabled: '#EEE8D5',
    buttonDisabledText: '#93A1A1',
    buttonText: '#FDF6E3',

    tabActive: '#268BD2',
    tabInactive: '#EEE8D5',
    tabActiveText: '#FDF6E3',
    tabInactiveText: '#586E75',
    tabBorder: '#93A1A1',

    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#FDF6E3',
    modalText: '#586E75',

    userListBackground: '#EEE8D5', // base2
    userListText: '#586E75', // base01
    userListBorder: '#93A1A1', // base1
    userOwner: '#6C71C4', // ~ owner (violet)
    userAdmin: '#DC322F', // & admin (red)
    userOp: '#CB4B16', // @ op (orange)
    userHalfop: '#268BD2', // % halfop (blue)
    userVoice: '#859900', // + voice (green)
    userNormal: '#586E75', // base01
    highlightBackground: withAlpha(SOLARIZED_BLUE, 0.1),
    highlightText: '#CB4B16', // orange text for mentions
    selectionBackground: withAlpha(SOLARIZED_BLUE, 0.12),
  },
  messageFormats: makeIrcapBarsFormats({
    timestamp: '#93A1A1',
    punctuation: '#268BD2',
    nick: '#268BD2',
    action: '#D33682',
    notice: '#B58900',
    join: '#859900',
    part: '#CB4B16',
    quit: '#DC322F',
    kick: '#DC322F',
    nickChange: '#268BD2',
    event: '#586E75',
    muted: '#93A1A1',
  }),
};
