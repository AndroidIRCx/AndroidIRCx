/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * "Amber CRT" — a vintage amber-terminal dark theme. Amber-on-near-black,
 * every accent kept in the amber family to evoke an old monochrome monitor.
 * The one deliberate exception is `error`, a red-orange that still reads as a
 * warm CRT phosphor while staying distinct from the amber body text.
 */

import { tx } from '../i18n/localization';
import type { Theme } from '../services/ThemeService';
import { makeClassicMircFormats } from './formats';
import { darken, lighten, withAlpha } from './palette';

const t = (key: string) => tx.t(key);

/** The signature amber phosphor used for text, primary and accent. */
const AMBER = '#FFB000';

export const AMBER_CRT_THEME: Theme = {
  id: 'amber-crt',
  name: t('Amber CRT'),
  isCustom: false,
  colors: {
    background: '#140D00',
    surface: '#1F1500',
    surfaceVariant: '#2A1D00',
    surfaceAlt: '#0D0900',
    cardBackground: '#1F1500',

    text: AMBER,
    textSecondary: '#CC8400',
    textDisabled: '#8A5E00',

    primary: AMBER,
    primaryDark: darken(AMBER, 0.3),
    primaryLight: lighten(AMBER, 0.25),
    onPrimary: '#140D00',

    secondary: '#FF9500',
    onSecondary: '#140D00',

    accent: AMBER,
    onAccent: '#140D00',

    success: '#FFD166',
    error: '#FF4500', // red-orange — warm but distinct from amber text
    warning: '#FFEA00',
    info: '#FFC966',

    border: darken(AMBER, 0.65),
    borderLight: darken(AMBER, 0.75),
    divider: darken(AMBER, 0.75),

    messageBackground: '#1F1500',
    messageText: AMBER,
    messageNick: '#FFCF40',
    messageTimestamp: '#8A5E00',

    systemMessage: '#CC8400',
    noticeMessage: '#FFE08A',
    joinMessage: '#FFD166',
    partMessage: '#E09000',
    quitMessage: '#B36B00',
    kickMessage: '#B36B00',
    nickMessage: '#FFCF40',
    inviteMessage: '#FFC966',
    monitorMessage: '#FFC966',
    topicMessage: '#FF9500',
    modeMessage: '#FFC966',
    actionMessage: '#FF9500',
    rawMessage: '#CC8400',
    ctcpMessage: '#FFC966',

    inputBackground: '#2A1D00',
    inputText: AMBER,
    inputBorder: darken(AMBER, 0.65),
    inputPlaceholder: '#8A5E00',

    buttonPrimary: AMBER,
    buttonPrimaryText: '#140D00',
    buttonSecondary: '#2A1D00',
    buttonSecondaryText: AMBER,
    buttonDisabled: '#2A1D00',
    buttonDisabledText: '#8A5E00',
    buttonText: '#140D00',

    tabActive: AMBER,
    tabInactive: '#1F1500',
    tabActiveText: '#140D00',
    tabInactiveText: '#CC8400',
    tabBorder: darken(AMBER, 0.65),

    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#1F1500',
    modalText: AMBER,

    userListBackground: '#0D0900',
    userListText: AMBER,
    userListBorder: darken(AMBER, 0.75),
    userOwner: '#FFE8B0', // ~ owner (brightest amber)
    userAdmin: '#FF4500', // & admin (red-orange)
    userOp: '#FF9500', // @ op (deep amber)
    userHalfop: '#FFCF40', // % halfop (light amber)
    userVoice: '#CC8400', // + voice (dim amber)
    userNormal: AMBER,
    highlightBackground: withAlpha(AMBER, 0.15),
    highlightText: '#FFE8B0',
    selectionBackground: withAlpha(AMBER, 0.12),
  },
  messageFormats: makeClassicMircFormats({
    timestamp: '#8A5E00',
    punctuation: '#CC8400',
    nick: '#FFCF40',
    action: '#FF9500',
    notice: '#FFE08A',
    join: '#FFD166',
    part: '#E09000',
    quit: '#B36B00',
    kick: '#B36B00',
    nickChange: '#FFCF40',
    event: '#CC8400',
    muted: '#8A5E00',
  }),
};
