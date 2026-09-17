/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeMinimalFormats } from './formats';
import { withAlpha } from './palette';

const t = (key: string) => tx.t(key);

export const NORD_THEME: Theme = {
  id: 'nord',
  name: t('Nord'),
  isCustom: false,
  colors: {
    background: '#2E3440',
    surface: '#3B4252',
    surfaceVariant: '#434C5E',
    surfaceAlt: '#2E3440',
    cardBackground: '#3B4252',

    text: '#D8DEE9',
    textSecondary: '#616E88',
    textDisabled: '#4C566A',

    primary: '#88C0D0',
    primaryDark: '#5E81AC',
    primaryLight: '#8FBCBB',
    onPrimary: '#2E3440',

    secondary: '#D08770',
    onSecondary: '#2E3440',

    accent: '#A3BE8C',
    onAccent: '#2E3440',

    success: '#A3BE8C',
    error: '#BF616A',
    warning: '#EBCB8B', // aurora yellow — distinct from error/quit red
    info: '#88C0D0',

    border: '#434C5E',
    borderLight: '#3B4252',
    divider: '#3B4252',

    messageBackground: '#3B4252',
    messageText: '#D8DEE9',
    messageNick: '#88C0D0',
    messageTimestamp: '#4C566A',

    systemMessage: '#616E88',
    noticeMessage: '#EBCB8B',
    joinMessage: '#A3BE8C',
    partMessage: '#D08770',
    quitMessage: '#BF616A',
    kickMessage: '#BF616A',
    nickMessage: '#88C0D0',
    inviteMessage: '#81A1C1',
    monitorMessage: '#81A1C1',
    topicMessage: '#81A1C1',
    modeMessage: '#8FBCBB',
    actionMessage: '#B48EAD',
    rawMessage: '#616E88',
    ctcpMessage: '#8FBCBB',

    inputBackground: '#434C5E',
    inputText: '#D8DEE9',
    inputBorder: '#434C5E',
    inputPlaceholder: '#616E88',

    buttonPrimary: '#88C0D0',
    buttonPrimaryText: '#2E3440',
    buttonSecondary: '#434C5E',
    buttonSecondaryText: '#D8DEE9',
    buttonDisabled: '#3B4252',
    buttonDisabledText: '#4C566A',
    buttonText: '#D8DEE9',

    tabActive: '#88C0D0',
    tabInactive: '#3B4252',
    tabActiveText: '#ECEFF4',
    tabInactiveText: '#616E88',
    tabBorder: '#434C5E',

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#3B4252',
    modalText: '#D8DEE9',

    userListBackground: '#2E3440',
    userListText: '#D8DEE9',
    userListBorder: '#3B4252',
    userOwner: '#B48EAD', // ~ owner (purple)
    userAdmin: '#BF616A', // & admin (red)
    userOp: '#D08770', // @ op (orange)
    userHalfop: '#81A1C1', // % halfop (blue)
    userVoice: '#A3BE8C', // + voice (green)
    userNormal: '#D8DEE9',
    highlightBackground: withAlpha('#88C0D0', 0.2),
    highlightText: '#EBCB8B',
    selectionBackground: withAlpha('#88C0D0', 0.12),
  },
  messageFormats: makeMinimalFormats({
    timestamp: '#4C566A',
    punctuation: '#616E88',
    nick: '#88C0D0',
    action: '#B48EAD',
    notice: '#EBCB8B',
    join: '#A3BE8C',
    part: '#D08770',
    quit: '#BF616A',
    kick: '#BF616A',
    nickChange: '#88C0D0',
    event: '#616E88',
    muted: '#616E88',
  }),
};
