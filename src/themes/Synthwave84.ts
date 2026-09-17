/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeMinimalFormats } from './formats';
import { darken, lighten, mix, withAlpha } from './palette';

const t = (k: string) => tx.t(k);

export const SYNTHWAVE_84_THEME: Theme = {
  id: 'synthwave-84',
  name: t("Synthwave '84"),
  isCustom: false,
  colors: {
    background: '#262335',
    surface: '#2A2139',
    surfaceVariant: '#34294F',
    surfaceAlt: '#1E1A2B',
    cardBackground: '#2A2139',

    text: '#E4E6F2',
    textSecondary: '#848BBD',
    textDisabled: '#495495',

    primary: '#36F9F6',
    primaryDark: darken('#36F9F6', 0.2),
    primaryLight: lighten('#36F9F6', 0.15),
    onPrimary: '#262335',

    secondary: '#FF8B39',
    onSecondary: '#262335',

    accent: '#36F9F6',
    onAccent: '#262335',

    success: '#72F1B8',
    error: '#FE4450',
    warning: '#FF8B39', // orange — distinct from error/quit red
    info: '#36F9F6',

    border: mix('#262335', '#34294F', 0.6),
    borderLight: darken('#34294F', 0.2),
    divider: darken('#34294F', 0.2),

    messageBackground: '#2A2139',
    messageText: '#E4E6F2',
    messageNick: '#36F9F6',
    messageTimestamp: '#495495',

    systemMessage: '#848BBD',
    noticeMessage: '#FEDE5D',
    joinMessage: '#72F1B8',
    partMessage: '#FF8B39',
    quitMessage: '#FE4450',
    kickMessage: '#FE4450',
    nickMessage: '#36F9F6',
    inviteMessage: '#36F9F6',
    monitorMessage: '#36F9F6',
    topicMessage: '#B381C5',
    modeMessage: '#36F9F6',
    actionMessage: '#FF7EDB',
    rawMessage: '#848BBD',
    ctcpMessage: '#36F9F6',

    inputBackground: '#34294F',
    inputText: '#E4E6F2',
    inputBorder: darken('#34294F', 0.15),
    inputPlaceholder: '#495495',

    buttonPrimary: '#36F9F6',
    buttonPrimaryText: '#262335',
    buttonSecondary: '#34294F',
    buttonSecondaryText: '#E4E6F2',
    buttonDisabled: darken('#34294F', 0.15),
    buttonDisabledText: '#495495',
    buttonText: '#E4E6F2',

    tabActive: '#36F9F6',
    tabInactive: '#2A2139',
    tabActiveText: '#E4E6F2',
    tabInactiveText: '#848BBD',
    tabBorder: darken('#34294F', 0.15),

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#2A2139',
    modalText: '#E4E6F2',

    userListBackground: '#1E1A2B',
    userListText: '#E4E6F2',
    userListBorder: darken('#34294F', 0.2),
    userOwner: '#B381C5', // ~ owner (purple)
    userAdmin: '#FE4450', // & admin (red)
    userOp: '#FF8B39', // @ op (orange)
    userHalfop: '#36F9F6', // % halfop (cyan)
    userVoice: '#72F1B8', // + voice (green)
    userNormal: '#E4E6F2',
    highlightBackground: withAlpha('#36F9F6', 0.2),
    highlightText: '#FEDE5D', // Yellow text for mentions
    selectionBackground: withAlpha('#36F9F6', 0.12),
  },
  messageFormats: makeMinimalFormats({
    timestamp: '#495495',
    punctuation: '#848BBD',
    nick: '#36F9F6',
    action: '#FF7EDB',
    notice: '#FEDE5D',
    join: '#72F1B8',
    part: '#FF8B39',
    quit: '#FE4450',
    kick: '#FE4450',
    nickChange: '#36F9F6',
    event: '#848BBD',
    muted: '#495495',
  }),
};
