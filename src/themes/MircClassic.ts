/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * "mIRC Classic" — a nostalgic LIGHT theme that recreates the timeless mIRC
 * look: navy nicks on a white canvas with the classic 16-colour code semantics
 * (magenta actions, orange notices, green joins, maroon parts/quits, teal CTCP).
 */

import { tx } from '../i18n/localization';
import { Theme } from '../services/ThemeService';
import { makeClassicMircFormats } from './formats';
import { withAlpha } from './palette';

const t = (key: string) => tx.t(key);

// Classic mIRC 16-colour accents, tuned for a white background.
const NAVY = '#00007F';

export const MIRC_CLASSIC_THEME: Theme = {
  id: 'mirc-classic',
  name: t('mIRC Classic'),
  isCustom: false,
  colors: {
    background: '#F5F5F5',
    surface: '#F4F4F4',
    surfaceVariant: '#ECECEC',
    surfaceAlt: '#F5F5F5',
    cardBackground: '#F5F5F5',

    text: '#000000',
    textSecondary: '#5C5C5C',
    textDisabled: '#9E9E9E',

    primary: NAVY,
    primaryDark: '#000066',
    primaryLight: '#3F3FA5',
    onPrimary: '#F5F5F5',

    secondary: '#FF7F00',
    onSecondary: '#F5F5F5',

    accent: NAVY,
    onAccent: '#F5F5F5',

    success: '#009300',
    error: '#7F0000',
    warning: '#FF7F00',
    info: '#0000FF',

    border: '#D4D4D4',
    borderLight: '#ECECEC',
    divider: '#D4D4D4',

    messageBackground: '#F5F5F5',
    messageText: '#000000',
    messageNick: NAVY,
    messageTimestamp: '#7F7F7F',

    systemMessage: '#5C5C5C',
    noticeMessage: '#FF7F00', // orange
    joinMessage: '#009300', // green
    partMessage: '#7F0000', // maroon
    quitMessage: '#7F0000', // maroon
    kickMessage: '#7F0000', // maroon
    nickMessage: NAVY,
    inviteMessage: '#0000FF',
    monitorMessage: '#0000FF',
    topicMessage: '#7F007F', // magenta
    modeMessage: NAVY,
    actionMessage: '#7F007F', // magenta
    rawMessage: '#5C5C5C',
    ctcpMessage: '#009393', // teal

    inputBackground: '#ECECEC',
    inputText: '#000000',
    inputBorder: '#D4D4D4',
    inputPlaceholder: '#9E9E9E',

    buttonPrimary: NAVY,
    buttonPrimaryText: '#F5F5F5',
    buttonSecondary: '#ECECEC',
    buttonSecondaryText: '#000000',
    buttonDisabled: '#F4F4F4',
    buttonDisabledText: '#9E9E9E',
    buttonText: '#F5F5F5',

    tabActive: NAVY,
    tabInactive: '#ECECEC',
    tabActiveText: '#F5F5F5',
    tabInactiveText: '#5C5C5C',
    tabBorder: '#D4D4D4',

    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#F5F5F5',
    modalText: '#000000',

    userListBackground: '#F4F4F4',
    userListText: '#000000',
    userListBorder: '#D4D4D4',
    userOwner: '#7F007F', // ~ owner (purple)
    userAdmin: '#7F0000', // & admin (red)
    userOp: '#FC7F00', // @ op (orange)
    userHalfop: NAVY, // % halfop (blue)
    userVoice: '#009300', // + voice (green)
    userNormal: '#000000',
    highlightBackground: withAlpha(NAVY, 0.1),
    highlightText: '#FF0000',
    selectionBackground: withAlpha(NAVY, 0.12),
  },
  messageFormats: makeClassicMircFormats({
    timestamp: '#7F7F7F',
    punctuation: NAVY,
    nick: NAVY,
    action: '#7F007F',
    notice: '#FF7F00',
    join: '#009300',
    part: '#7F0000',
    quit: '#7F0000',
    kick: '#7F0000',
    nickChange: NAVY,
    event: '#5C5C5C',
    muted: '#7F7F7F',
  }),
};
