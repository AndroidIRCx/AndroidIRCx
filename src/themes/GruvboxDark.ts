/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeIrcapBarsFormats } from './formats';
import { withAlpha } from './palette';

const t = (key: string) => tx.t(key);

// Gruvbox dark accent shared by surfaces, tabs, buttons and selection washes.
const GRUVBOX_BLUE = '#83A598';

export const GRUVBOX_DARK_THEME: Theme = {
  id: 'gruvbox-dark',
  name: t('Gruvbox Dark'),
  isCustom: false,
  colors: {
    background: '#282828',
    surface: '#3C3836',
    surfaceVariant: '#504945',
    surfaceAlt: '#32302F',
    cardBackground: '#3C3836',

    text: '#EBDBB2',
    textSecondary: '#A89984',
    textDisabled: '#665C54',

    primary: GRUVBOX_BLUE,
    primaryDark: '#458588',
    primaryLight: '#8EC07C',
    onPrimary: '#282828',

    secondary: '#FE8019',
    onSecondary: '#282828',

    accent: '#8EC07C',
    onAccent: '#282828',

    success: '#B8BB26',
    error: '#FB4934',
    warning: '#FABD2F', // yellow — distinct from error/quit red
    info: '#8EC07C',

    border: '#504945',
    borderLight: '#3C3836',
    divider: '#3C3836',

    messageBackground: '#282828',
    messageText: '#EBDBB2',
    messageNick: GRUVBOX_BLUE,
    messageTimestamp: '#928374',

    systemMessage: '#928374',
    noticeMessage: '#FABD2F',
    joinMessage: '#B8BB26',
    partMessage: '#FE8019',
    quitMessage: '#FB4934',
    kickMessage: '#FB4934',
    nickMessage: GRUVBOX_BLUE,
    inviteMessage: '#8EC07C',
    monitorMessage: '#8EC07C',
    topicMessage: '#D3869B',
    modeMessage: '#8EC07C',
    actionMessage: '#D3869B',
    rawMessage: '#A89984',
    ctcpMessage: '#8EC07C',

    inputBackground: '#504945',
    inputText: '#EBDBB2',
    inputBorder: '#504945',
    inputPlaceholder: '#928374',

    buttonPrimary: GRUVBOX_BLUE,
    buttonPrimaryText: '#282828',
    buttonSecondary: '#504945',
    buttonSecondaryText: '#EBDBB2',
    buttonDisabled: '#3C3836',
    buttonDisabledText: '#665C54',
    buttonText: '#EBDBB2',

    tabActive: GRUVBOX_BLUE,
    tabInactive: '#3C3836',
    tabActiveText: '#282828',
    tabInactiveText: '#A89984',
    tabBorder: '#504945',

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#3C3836',
    modalText: '#EBDBB2',

    userListBackground: '#32302F',
    userListText: '#EBDBB2',
    userListBorder: '#3C3836',
    userOwner: '#D3869B', // ~ owner (purple)
    userAdmin: '#FB4934', // & admin (red)
    userOp: '#FE8019', // @ op (orange)
    userHalfop: GRUVBOX_BLUE, // % halfop (blue)
    userVoice: '#B8BB26', // + voice (green)
    userNormal: '#EBDBB2',
    highlightBackground: withAlpha(GRUVBOX_BLUE, 0.2),
    highlightText: '#FABD2F', // Yellow text for mentions
    selectionBackground: withAlpha(GRUVBOX_BLUE, 0.12),
  },
  messageFormats: makeIrcapBarsFormats({
    timestamp: '#928374',
    punctuation: '#928374',
    nick: GRUVBOX_BLUE,
    action: '#D3869B',
    notice: '#FABD2F',
    join: '#B8BB26',
    part: '#FE8019',
    quit: '#FB4934',
    kick: '#FB4934',
    nickChange: GRUVBOX_BLUE,
    event: '#928374',
    muted: '#928374',
  }),
};
