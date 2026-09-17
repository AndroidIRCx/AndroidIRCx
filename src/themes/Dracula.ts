/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeMinimalFormats } from './formats';
import { darken, lighten, mix, withAlpha } from './palette';

const t = (k: string) => tx.t(k);

export const DRACULA_THEME: Theme = {
  id: 'dracula',
  name: t('Dracula'),
  isCustom: false,
  colors: {
    background: '#282A36',
    surface: '#44475A',
    surfaceVariant: lighten('#44475A', 0.08),
    surfaceAlt: darken('#282A36', 0.25),
    cardBackground: lighten('#282A36', 0.05),

    text: '#F8F8F2',
    textSecondary: '#6272A4',
    textDisabled: darken('#6272A4', 0.25),

    primary: '#BD93F9',
    primaryDark: darken('#BD93F9', 0.2),
    primaryLight: lighten('#BD93F9', 0.15),
    onPrimary: '#282A36',

    secondary: '#FFB86C',
    onSecondary: '#282A36',

    accent: '#BD93F9',
    onAccent: '#282A36',

    success: '#50FA7B',
    error: '#FF5555',
    warning: '#F1FA8C', // yellow — distinct from error/quit red
    info: '#8BE9FD',

    border: mix('#282A36', '#44475A', 0.6),
    borderLight: darken('#44475A', 0.2),
    divider: darken('#44475A', 0.2),

    messageBackground: '#44475A',
    messageText: '#F8F8F2',
    messageNick: '#BD93F9',
    messageTimestamp: '#6272A4',

    systemMessage: '#6272A4',
    noticeMessage: '#F1FA8C',
    joinMessage: '#50FA7B',
    partMessage: '#FFB86C',
    quitMessage: '#FF5555',
    kickMessage: '#FF5555',
    nickMessage: '#BD93F9',
    inviteMessage: '#8BE9FD',
    monitorMessage: '#8BE9FD',
    topicMessage: '#BD93F9',
    modeMessage: '#8BE9FD',
    actionMessage: '#FF79C6',
    rawMessage: '#6272A4',
    ctcpMessage: '#8BE9FD',

    inputBackground: lighten('#44475A', 0.08),
    inputText: '#F8F8F2',
    inputBorder: darken('#44475A', 0.15),
    inputPlaceholder: '#6272A4',

    buttonPrimary: '#BD93F9',
    buttonPrimaryText: '#282A36',
    buttonSecondary: '#44475A',
    buttonSecondaryText: '#F8F8F2',
    buttonDisabled: darken('#44475A', 0.15),
    buttonDisabledText: darken('#6272A4', 0.25),
    buttonText: '#F8F8F2',

    tabActive: '#BD93F9',
    tabInactive: '#44475A',
    tabActiveText: '#F8F8F2',
    tabInactiveText: '#6272A4',
    tabBorder: darken('#44475A', 0.15),

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#44475A',
    modalText: '#F8F8F2',

    userListBackground: darken('#282A36', 0.25),
    userListText: '#F8F8F2',
    userListBorder: darken('#44475A', 0.2),
    userOwner: '#BD93F9', // ~ owner (purple)
    userAdmin: '#FF5555', // & admin (red)
    userOp: '#FFB86C', // @ op (orange)
    userHalfop: '#8BE9FD', // % halfop (cyan)
    userVoice: '#50FA7B', // + voice (green)
    userNormal: '#F8F8F2',
    highlightBackground: withAlpha('#BD93F9', 0.2),
    highlightText: '#F1FA8C', // Yellow text for mentions
    selectionBackground: withAlpha('#BD93F9', 0.12),
  },
  messageFormats: makeMinimalFormats({
    timestamp: '#6272A4',
    punctuation: '#6272A4',
    nick: '#BD93F9',
    action: '#FF79C6',
    notice: '#F1FA8C',
    join: '#50FA7B',
    part: '#FFB86C',
    quit: '#FF5555',
    kick: '#FF5555',
    nickChange: '#BD93F9',
    event: '#6272A4',
    muted: '#6272A4',
  }),
};
