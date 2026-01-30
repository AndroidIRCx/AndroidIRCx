/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { tx } from '../i18n/transifex';
import { getDefaultMessageFormats } from '../utils/MessageFormatDefaults';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceAlt: string;
  cardBackground: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textDisabled: string;
  
  // Primary colors
  primary: string;
  primaryDark: string;
  primaryLight: string;
  onPrimary: string;
  
  // Secondary colors
  secondary: string;
  onSecondary: string;
  
  // Accent colors
  accent: string;
  onAccent: string;
  
  // Status colors
  success: string;
  error: string;
  warning: string;
  info: string;
  
  // Border colors
  border: string;
  borderLight: string;
  divider: string;
  
  // Message colors
  messageBackground: string;
  messageText: string;
  messageNick: string;
  messageTimestamp: string;
  
  // System message colors
  systemMessage: string;
  noticeMessage: string;
  joinMessage: string;
  partMessage: string;
  quitMessage: string;
  kickMessage: string;
  nickMessage: string;
  inviteMessage: string;
  monitorMessage: string;
  topicMessage: string;
  modeMessage: string;
  actionMessage: string;
  rawMessage: string;
  ctcpMessage: string;
  
  // Input colors
  inputBackground: string;
  inputText: string;
  inputBorder: string;
  inputPlaceholder: string;
  
  // Button colors
  buttonPrimary: string;
  buttonPrimaryText: string;
  buttonSecondary: string;
  buttonSecondaryText: string;
  buttonDisabled: string;
  buttonDisabledText: string;
  buttonText: string;
  
  // Tab colors
  tabActive: string;
  tabInactive: string;
  tabActiveText: string;
  tabInactiveText: string;
  tabBorder: string;
  
  // Modal colors
  modalOverlay: string;
  modalBackground: string;
  modalText: string;
  
  // User list colors
  userListBackground: string;
  userListText: string;
  userListBorder: string;
  userOwner: string;    // ~ channel owner
  userAdmin: string;    // & channel admin
  userOp: string;       // @ channel operator
  userHalfop: string;   // % half-operator
  userVoice: string;    // + voiced user
  userNormal: string;
  highlightBackground: string;
  highlightText: string;      // Text color when mentioned/highlighted
  selectionBackground: string;
}

export type MessageFormatToken =
  | 'time'
  | 'nick'
  | 'oldnick'
  | 'newnick'
  | 'message'
  | 'channel'
  | 'network'
  | 'account'
  | 'username'
  | 'hostname'
  | 'hostmask'
  | 'target'
  | 'mode'
  | 'topic'
  | 'reason'
  | 'numeric'
  | 'command';

export interface MessageFormatStyle {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  reverse?: boolean;
}

export interface MessageFormatPart {
  type: 'text' | 'token';
  value: string;
  style?: MessageFormatStyle;
}

export interface ThemeMessageFormats {
  message: MessageFormatPart[];
  messageMention: MessageFormatPart[];
  action: MessageFormatPart[];
  actionMention: MessageFormatPart[];
  notice: MessageFormatPart[];
  event: MessageFormatPart[];
  join: MessageFormatPart[];
  part: MessageFormatPart[];
  quit: MessageFormatPart[];
  kick: MessageFormatPart[];
  nick: MessageFormatPart[];
  invite: MessageFormatPart[];
  monitor: MessageFormatPart[];
  mode: MessageFormatPart[];
  topic: MessageFormatPart[];
  raw: MessageFormatPart[];
  error: MessageFormatPart[];
  ctcp: MessageFormatPart[];
}

const cloneMessageFormats = (
  formats?: ThemeMessageFormats,
): ThemeMessageFormats | undefined => (formats ? JSON.parse(JSON.stringify(formats)) : undefined);

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  messageFormats?: ThemeMessageFormats;
  isCustom: boolean;
}

const DARK_THEME: Theme = {
  id: 'dark',
  name: t('Dark'),
  isCustom: false,
  colors: {
    background: '#121212',
    surface: '#1E1E1E',
    surfaceVariant: '#2C2C2C',
    surfaceAlt: '#1A1A1A',
    cardBackground: '#1E1E1E',
    
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textDisabled: '#666666',
    
    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#64B5F6',
    onPrimary: '#FFFFFF',
    
    secondary: '#FF9800',
    onSecondary: '#FFFFFF',
    
    accent: '#4CAF50',
    onAccent: '#FFFFFF',
    
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    
    border: '#333333',
    borderLight: '#2A2A2A',
    divider: '#2A2A2A',
    
    messageBackground: '#1E1E1E',
    messageText: '#E0E0E0',
    messageNick: '#64B5F6',
    messageTimestamp: '#757575',
    
    systemMessage: '#9E9E9E',
    noticeMessage: '#FF9800',
    joinMessage: '#4CAF50',
    partMessage: '#FF9800',
    quitMessage: '#F44336',
    kickMessage: '#F44336',
    nickMessage: '#64B5F6',
    inviteMessage: '#2196F3',
    monitorMessage: '#2196F3',
    topicMessage: '#9C27B0',
    modeMessage: '#5DADE2',
    actionMessage: '#9E9E9E',
    rawMessage: '#B0B0B0',
    ctcpMessage: '#4CAF50',
    
    inputBackground: '#2C2C2C',
    inputText: '#FFFFFF',
    inputBorder: '#333333',
    inputPlaceholder: '#757575',
    
    buttonPrimary: '#2196F3',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#424242',
    buttonSecondaryText: '#FFFFFF',
    buttonDisabled: '#2C2C2C',
    buttonDisabledText: '#666666',
    buttonText: '#FFFFFF',
    
    tabActive: '#2196F3',
    tabInactive: '#2C2C2C',
    tabActiveText: '#FFFFFF',
    tabInactiveText: '#B0B0B0',
    tabBorder: '#333333',
    
    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: '#1E1E1E',
    modalText: '#FFFFFF',
    
    userListBackground: '#1A1A1A',
    userListText: '#E0E0E0',
    userListBorder: '#2A2A2A',
    userOwner: '#9C27B0',     // ~ purple
    userAdmin: '#F44336',     // & red
    userOp: '#FF9800',        // @ orange
    userHalfop: '#2196F3',    // % blue
    userVoice: '#4CAF50',     // + green
    userNormal: '#E0E0E0',
    highlightBackground: 'rgba(33, 150, 243, 0.2)',
    highlightText: '#FFEB3B',       // Yellow text for mentions
    selectionBackground: 'rgba(33, 150, 243, 0.12)',
  },
};

const LIGHT_THEME: Theme = {
  id: 'light',
  name: t('Light'),
  isCustom: false,
  colors: {
    background: '#FFFFFF',
    surface: '#FAFAFA',
    surfaceVariant: '#F5F5F5',
    surfaceAlt: '#FFFFFF',
    cardBackground: '#FFFFFF',
    
    text: '#212121',
    textSecondary: '#757575',
    textDisabled: '#9E9E9E',
    
    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#64B5F6',
    onPrimary: '#FFFFFF',
    
    secondary: '#FF9800',
    onSecondary: '#FFFFFF',
    
    accent: '#4CAF50',
    onAccent: '#FFFFFF',
    
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    info: '#2196F3',
    
    border: '#E0E0E0',
    borderLight: '#F5F5F5',
    divider: '#E0E0E0',
    
    messageBackground: '#FFFFFF',
    messageText: '#212121',
    messageNick: '#1976D2',
    messageTimestamp: '#9E9E9E',
    
    systemMessage: '#757575',
    noticeMessage: '#FF9800',
    joinMessage: '#4CAF50',
    partMessage: '#FF9800',
    quitMessage: '#F44336',
    kickMessage: '#F44336',
    nickMessage: '#1976D2',
    inviteMessage: '#2196F3',
    monitorMessage: '#2196F3',
    topicMessage: '#9C27B0',
    modeMessage: '#5DADE2',
    actionMessage: '#9E9E9E',
    rawMessage: '#757575',
    ctcpMessage: '#388E3C',
    
    inputBackground: '#F5F5F5',
    inputText: '#212121',
    inputBorder: '#E0E0E0',
    inputPlaceholder: '#9E9E9E',
    
    buttonPrimary: '#2196F3',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#E0E0E0',
    buttonSecondaryText: '#212121',
    buttonDisabled: '#F5F5F5',
    buttonDisabledText: '#9E9E9E',
    buttonText: '#FFFFFF',
    
    tabActive: '#2196F3',
    tabInactive: '#F5F5F5',
    tabActiveText: '#FFFFFF',
    tabInactiveText: '#757575',
    tabBorder: '#E0E0E0',
    
    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#FFFFFF',
    modalText: '#212121',
    
    userListBackground: '#FAFAFA',
    userListText: '#212121',
    userListBorder: '#E0E0E0',
    userOwner: '#7B1FA2',     // ~ purple (darker for light theme)
    userAdmin: '#D32F2F',     // & red (darker for light theme)
    userOp: '#F57C00',        // @ orange (darker for light theme)
    userHalfop: '#1976D2',    // % blue (darker for light theme)
    userVoice: '#388E3C',     // + green (darker for light theme)
    userNormal: '#212121',
    highlightBackground: 'rgba(33, 150, 243, 0.1)',
    highlightText: '#FF6F00',       // Orange text for mentions (darker for light theme)
    selectionBackground: 'rgba(33, 150, 243, 0.12)',
  },
};

const IRCAP_THEME: Theme = {
  id: 'ircap',
  name: 'IRcap',
  isCustom: false,
  colors: {
    background: '#E6E6E6',
    surface: '#6B6B6B',
    surfaceVariant: '#8A8A8A',
    surfaceAlt: '#FFFFFF',
    cardBackground: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#000000',
    textDisabled: '#9E9E9E',
    primary: '#000000',
    primaryDark: '#0F766E',
    primaryLight: '#64B5F6',
    onPrimary: '#FFFFFF',
    secondary: '#FF9800',
    onSecondary: '#FFFFFF',
    accent: '#4CAF50',
    onAccent: '#FFFFFF',
    success: '#16A34A',
    error: '#B91C1C',
    warning: '#DC2626',
    info: '#1A1A1A',
    border: '#E0E0E0',
    borderLight: '#F5F5F5',
    divider: '#E0E0E0',
    messageBackground: '#B0B0B0',
    messageText: '#212121',
    messageNick: '#0F766E',
    messageTimestamp: '#000000',
    systemMessage: '#4A4A4A',
    noticeMessage: '#212121',
    joinMessage: '#A855F7',
    partMessage: '#F97316',
    quitMessage: '#B91C1C',
    kickMessage: '#B91C1C',
    nickMessage: '#1976D2',
    inviteMessage: '#212121',
    monitorMessage: '#1E3A8A',
    topicMessage: '#212121',
    modeMessage: '#5C5C5C',
    actionMessage: '#7C3AED',
    rawMessage: '#212121',
    ctcpMessage: '#212121',
    inputBackground: '#F5F5F5',
    inputText: '#212121',
    inputBorder: '#E0E0E0',
    inputPlaceholder: '#9E9E9E',
    buttonPrimary: '#2196F3',
    buttonPrimaryText: '#FFFFFF',
    buttonSecondary: '#E0E0E0',
    buttonSecondaryText: '#212121',
    buttonDisabled: '#F5F5F5',
    buttonDisabledText: '#9E9E9E',
    buttonText: '#FFFFFF',
    tabActive: '#2D2D2D',
    tabInactive: '#F5F5F5',
    tabActiveText: '#FFFFFF',
    tabInactiveText: '#757575',
    tabBorder: '#E0E0E0',
    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: '#FFFFFF',
    modalText: '#212121',
    userListBackground: '#FAFAFA',
    userListText: '#212121',
    userListBorder: '#E0E0E0',
    userOwner: '#B91C1C',
    userAdmin: '#B91C1C',
    userOp: '#B91C1C',
    userHalfop: '#B91C1C',
    userVoice: '#212121',
    userNormal: '#212121',
    highlightBackground: 'rgba(33, 150, 243, 0.1)',
    highlightText: '#000000',
    selectionBackground: 'rgba(33, 150, 243, 0.12)',
  },
  messageFormats: {
    message: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'token', value: 'nick', style: { color: '#000074' } },
      { type: 'text', value: ' ¦', style: { color: '#0063b5' } },
      { type: 'text', value: ' ' },
      { type: 'token', value: 'message' },
    ],
    messageMention: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'token', value: 'nick', style: { color: '#000074', bold: true } },
      { type: 'text', value: ' ¦', style: { color: '#0063b5' } },
      { type: 'text', value: ' ' },
      { type: 'token', value: 'message' },
    ],
    action: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: ']', style: { color: '#0063b5' } },
      { type: 'text', value: ' * ', style: { color: '#740074' } },
      { type: 'token', value: 'nick', style: { color: '#740074' } },
      { type: 'text', value: ' ¦', style: { color: '#740074' } },
      { type: 'text', value: ' ' },
      { type: 'token', value: 'message', style: { color: '#740074' } },
    ],
    actionMention: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: ']', style: { color: '#0063b5' } },
      { type: 'text', value: ' * ', style: { color: '#740074', bold: false } },
      { type: 'token', value: 'nick', style: { color: '#740074', bold: true } },
      { type: 'text', value: ' ¦', style: { color: '#740074', bold: false } },
      { type: 'text', value: ' ' },
      { type: 'token', value: 'message', style: { color: '#740074', bold: false } },
    ],
    notice: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: ']', style: { color: '#0063b5' } },
      { type: 'text', value: ' -', style: { bold: false, color: '#000000' } },
      { type: 'text', value: '(', style: { bold: true, color: '#000000' } },
      { type: 'token', value: 'nick', style: { color: '#000000' } },
      { type: 'text', value: ')', style: { bold: true, color: '#000000' } },
      { type: 'text', value: '-', style: { color: '#000000' } },
      { type: 'text', value: ' - ', style: { color: '#000000' } },
      { type: 'token', value: 'message', style: { color: '#000000' } },
    ],
    event: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: ']', style: { color: '#0063b5' } },
      { type: 'text', value: ' => ', style: { color: '#0063b5' } },
      { type: 'text', value: '¦ ', style: { color: '#0063b5' } },
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'message' },
      { type: 'text', value: ']', style: { color: '#0063b5' } },
    ],
    join: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'text', value: '->', style: { color: '#0063b5' } },
      { type: 'text', value: ' ¦ ', style: { color: '#0063b5' } },
      { type: 'token', value: 'nick', style: { color: '#5C5C5C', bold: true } },
      { type: 'text', value: ' [', style: { color: '#0063b5' } },
      { type: 'token', value: 'username', style: { color: '#5C5C5C' } },
      { type: 'text', value: '@', style: { color: '#0063b5' } },
      { type: 'token', value: 'hostname', style: { color: '#5C5C5C' } },
      { type: 'text', value: ']', style: { color: '#0063b5' } },
      { type: 'text', value: ' entra', style: { color: '#5C5C5C' } },
    ],
    part: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'text', value: '<-', style: { color: '#740074' } },
      { type: 'text', value: ' ¦ ', style: { color: '#0063b5' } },
      { type: 'token', value: 'nick', style: { color: '#5C5C5C' } },
      { type: 'text', value: ' [', style: { color: '#740074' } },
      { type: 'token', value: 'username', style: { color: '#5C5C5C' } },
      { type: 'text', value: '@', style: { color: '#740074' } },
      { type: 'token', value: 'hostname', style: { color: '#5C5C5C' } },
      { type: 'text', value: ']', style: { color: '#740074' } },
      { type: 'text', value: ' sale', style: { color: '#5C5C5C' } },
    ],
    quit: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'text', value: '<-', style: { color: '#7F0000' } },
      { type: 'text', value: ' ¦ ', style: { color: '#0063b5' } },
      { type: 'token', value: 'nick', style: { color: '#5C5C5C' } },
      { type: 'text', value: ' [', style: { color: '#7F0000' } },
      { type: 'token', value: 'username', style: { color: '#5C5C5C' } },
      { type: 'text', value: '@', style: { color: '#7F0000' } },
      { type: 'token', value: 'hostname', style: { color: '#5C5C5C' } },
      { type: 'text', value: ']', style: { color: '#7F0000' } },
      { type: 'text', value: ' cierra', style: { color: '#5C5C5C' } },
    ],
    kick: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'text', value: '<-', style: { color: '#7F0000' } },
      { type: 'text', value: ' ¦ ', style: { color: '#0063b5' } },
      { type: 'token', value: 'nick', style: { color: '#5C5C5C', bold: true } },
      { type: 'text', value: ' expulsa ', style: { color: '#5C5C5C' } },
      { type: 'token', value: 'target', style: { color: '#000074' } },
      { type: 'text', value: ' ' },
      { type: 'token', value: 'reason', style: { color: '#5C5C5C' } },
    ],
    nick: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'text', value: '=>', style: { color: '#0063b5' } },
      { type: 'text', value: ' ¦ ', style: { color: '#0063b5' } },
      { type: 'token', value: 'oldnick', style: { color: '#5C5C5C', bold: true } },
      { type: 'text', value: ' es ahora ', style: { color: '#5C5C5C' } },
      { type: 'token', value: 'newnick', style: { color: '#0063b5' } },
    ],
    invite: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'text', value: '-', style: { color: '#0063b5' } },
      { type: 'token', value: 'nick', style: { color: '#5C5C5C' } },
      { type: 'text', value: '(', style: { color: '#0063b5' } },
      { type: 'token', value: 'username', style: { color: '#5C5C5C' } },
      { type: 'text', value: '@', style: { color: '#0063b5' } },
      { type: 'token', value: 'hostname', style: { color: '#5C5C5C' } },
      { type: 'text', value: ')', style: { color: '#0063b5' } },
      { type: 'text', value: '- ', style: { color: '#0063b5' } },
      { type: 'text', value: 'te invita a ', style: { color: '#5C5C5C' } },
      { type: 'token', value: 'channel', style: { bold: true } },
    ],
    monitor: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'text', value: '=> ', style: { color: '#0063b5' } },
      { type: 'token', value: 'nick', style: { color: '#0063b5' } },
      { type: 'text', value: ' entró al chat', style: { color: '#000074' } },
    ],
    mode: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'text', value: '=>', style: { color: '#0063b5' } },
      { type: 'text', value: ' ¦ ', style: { color: '#0063b5' } },
      { type: 'token', value: 'nick', style: { color: '#5C5C5C' } },
      { type: 'text', value: ' pone modo', style: { color: '#5C5C5C' } },
      { type: 'text', value: ' [', style: { color: '#0063b5' } },
      { type: 'token', value: 'mode', style: { color: '#5C5C5C' } },
      { type: 'text', value: ' ' },
      { type: 'token', value: 'account', style: { color: '#5C5C5C' } },
      { type: 'text', value: ' ' },
      { type: 'text', value: ']', style: { color: '#0063b5' } },
    ],
    topic: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'text', value: '=>', style: { color: '#0063b5' } },
      { type: 'text', value: ' ¦ ', style: { color: '#0063b5' } },
      { type: 'token', value: 'nick', style: { color: '#5C5C5C' } },
      { type: 'text', value: ' pone topic:', style: { color: '#5C5C5C' } },
      { type: 'token', value: 'message' },
    ],
    raw: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'text', value: '*** ' },
      { type: 'text', value: 'RAW ' },
      { type: 'token', value: 'numeric' },
      { type: 'text', value: ':' },
      { type: 'text', value: '* ' },
      { type: 'token', value: 'message' },
    ],
    error: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#7F7F7F' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'token', value: 'message' },
    ],
    ctcp: [
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'time', style: { color: '#000000' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'text', value: '--> ', style: { color: '#0063b5' } },
      { type: 'text', value: 'CTCP ', style: { color: '#000074' } },
      { type: 'text', value: '[', style: { color: '#0063b5' } },
      { type: 'token', value: 'nick', style: { color: '#0063b5' } },
      { type: 'text', value: '] ', style: { color: '#0063b5' } },
      { type: 'token', value: 'message' },
    ],
  },
};

class ThemeService {
  private currentTheme: Theme = DARK_THEME;
  private customThemes: Theme[] = [];
  private listeners: Array<(theme: Theme) => void> = [];
  private readonly STORAGE_KEY = '@AndroidIRCX:currentTheme';
  private readonly CUSTOM_THEMES_KEY = '@AndroidIRCX:customThemes';

  private getBaseThemeForColors(colors?: Partial<ThemeColors>): Theme {
    if (!colors?.background) {
      return DARK_THEME;
    }
    const bg = colors.background.trim();
    if (!bg.startsWith('#')) {
      return DARK_THEME;
    }
    const hex = bg.length === 4
      ? `#${bg[1]}${bg[1]}${bg[2]}${bg[2]}${bg[3]}${bg[3]}`
      : bg.length === 7
        ? bg
        : '';
    if (!hex) {
      return DARK_THEME;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? LIGHT_THEME : DARK_THEME;
  }

  private normalizeThemeColors(colors?: Partial<ThemeColors>): ThemeColors {
    const base = this.getBaseThemeForColors(colors);
    return {
      ...base.colors,
      ...(colors || {}),
    };
  }

  private normalizeMessageFormats(formats?: ThemeMessageFormats): ThemeMessageFormats | undefined {
    if (!formats) {
      return undefined;
    }
    const defaults = getDefaultMessageFormats();
    return {
      ...defaults,
      ...formats,
    };
  }

  private normalizeTheme(theme: Theme): Theme {
    return {
      ...theme,
      colors: this.normalizeThemeColors(theme.colors),
      messageFormats: this.normalizeMessageFormats(theme.messageFormats),
    };
  }

  async initialize(): Promise<void> {
    try {
      // Load current theme
      const savedThemeId = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (savedThemeId) {
        if (savedThemeId === 'dark' || savedThemeId === 'light' || savedThemeId === 'ircap') {
          if (savedThemeId === 'dark') {
            this.currentTheme = DARK_THEME;
          } else if (savedThemeId === 'light') {
            this.currentTheme = LIGHT_THEME;
          } else {
            this.currentTheme = IRCAP_THEME;
          }
        } else {
          // Try to load custom theme
          await this.loadCustomThemes();
          const customTheme = this.customThemes.find(t => t.id === savedThemeId);
          if (customTheme) {
            this.currentTheme = customTheme;
          }
        }
      }

      // Load custom themes
      await this.loadCustomThemes();

      // Normalize current theme if it's custom
      if (this.currentTheme.isCustom) {
        this.currentTheme = this.normalizeTheme(this.currentTheme);
      } else {
        this.currentTheme = this.normalizeTheme(this.currentTheme);
      }
    } catch (error) {
      console.error('Failed to initialize ThemeService:', error);
    }
  }

  private async loadCustomThemes(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.CUSTOM_THEMES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Theme[];
        this.customThemes = parsed.map(theme => this.normalizeTheme(theme));
      }
    } catch (error) {
      console.error('Failed to load custom themes:', error);
      this.customThemes = [];
    }
  }

  private async saveCustomThemes(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CUSTOM_THEMES_KEY, JSON.stringify(this.customThemes));
    } catch (error) {
      console.error('Failed to save custom themes:', error);
    }
  }

  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  getColors(): ThemeColors {
    return this.normalizeThemeColors(this.currentTheme.colors);
  }

  async setTheme(themeId: string): Promise<void> {
    if (themeId === 'dark') {
      this.currentTheme = this.normalizeTheme(DARK_THEME);
    } else if (themeId === 'light') {
      this.currentTheme = this.normalizeTheme(LIGHT_THEME);
    } else if (themeId === 'ircap') {
      this.currentTheme = this.normalizeTheme(IRCAP_THEME);
    } else {
      const customTheme = this.customThemes.find(t => t.id === themeId);
      if (customTheme) {
        this.currentTheme = this.normalizeTheme(customTheme);
      } else {
        console.warn(`Theme ${themeId} not found, using dark theme`);
        this.currentTheme = this.normalizeTheme(DARK_THEME);
      }
    }

    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, themeId);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }

    this.notifyListeners();
  }

  getAvailableThemes(): Theme[] {
    return [DARK_THEME, LIGHT_THEME, IRCAP_THEME, ...this.customThemes];
  }

  getBuiltInThemes(): Theme[] {
    return [DARK_THEME, LIGHT_THEME, IRCAP_THEME];
  }

  getCustomThemes(): Theme[] {
    return this.customThemes;
  }

  async createCustomTheme(name: string, baseThemeId: string = 'dark'): Promise<Theme> {
    const baseTheme = baseThemeId === 'dark' ? DARK_THEME : LIGHT_THEME;
    const newTheme: Theme = {
      id: `custom_${Date.now()}`,
      name,
      isCustom: true,
      colors: { ...baseTheme.colors },
      messageFormats: cloneMessageFormats(baseTheme.messageFormats),
    };

    this.customThemes.push(newTheme);
    await this.saveCustomThemes();
    this.notifyListeners();

    return newTheme;
  }

  async updateCustomTheme(themeId: string, updates: Partial<Theme>): Promise<boolean> {
    const themeIndex = this.customThemes.findIndex(t => t.id === themeId);
    if (themeIndex === -1) {
      return false;
    }

    if (updates.name) {
      this.customThemes[themeIndex].name = updates.name;
    }

    if (updates.colors) {
      this.customThemes[themeIndex].colors = {
        ...this.customThemes[themeIndex].colors,
        ...updates.colors,
      };
      this.customThemes[themeIndex].colors = this.normalizeThemeColors(this.customThemes[themeIndex].colors);
    }
    if (updates.messageFormats) {
      this.customThemes[themeIndex].messageFormats = this.normalizeMessageFormats(cloneMessageFormats(updates.messageFormats));
    }

    await this.saveCustomThemes();

    // If this is the current theme, update it
    if (this.currentTheme.id === themeId) {
      this.currentTheme = this.normalizeTheme(this.customThemes[themeIndex]);
    }

    this.notifyListeners();
    return true;
  }

  async deleteCustomTheme(themeId: string): Promise<boolean> {
    const themeIndex = this.customThemes.findIndex(t => t.id === themeId);
    if (themeIndex === -1) {
      return false;
    }

    // If this is the current theme, switch to dark
    if (this.currentTheme.id === themeId) {
      await this.setTheme('dark');
    }

    this.customThemes.splice(themeIndex, 1);
    await this.saveCustomThemes();
    this.notifyListeners();

    return true;
  }

  onThemeChange(callback: (theme: Theme) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.currentTheme));
  }

  // Helper method to get a color by key
  getColor(key: keyof ThemeColors): string {
    return this.currentTheme.colors[key];
  }

  /**
   * Export a theme to JSON string for sharing
   */
  exportTheme(themeId: string): string | null {
    let theme: Theme | undefined;

    if (themeId === 'dark') {
      theme = DARK_THEME;
    } else if (themeId === 'light') {
      theme = LIGHT_THEME;
    } else if (themeId === 'ircap') {
      theme = IRCAP_THEME;
    } else {
      theme = this.customThemes.find(t => t.id === themeId);
    }

    if (!theme) {
      return null;
    }

    const normalizedTheme = this.normalizeTheme(theme);

    // Create export object with metadata
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      theme: {
        name: normalizedTheme.name,
        colors: normalizedTheme.colors,
        messageFormats: normalizedTheme.messageFormats,
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import a theme from JSON string
   */
  async importTheme(jsonString: string): Promise<{ success: boolean; theme?: Theme; error?: string }> {
    try {
      const data = JSON.parse(jsonString);

      // Validate the import data structure
      if (!data.theme || !data.theme.name || !data.theme.colors) {
        return { success: false, error: t('Invalid theme file format') };
      }

      // Validate that colors object has required keys
      const requiredKeys: (keyof ThemeColors)[] = [
        'background', 'surface', 'text', 'primary', 'messageText',
      ];

      for (const key of requiredKeys) {
        if (!data.theme.colors[key]) {
          return { success: false, error: t('Theme is missing required color: {key}', { key }) };
        }
      }

      // Create new custom theme with imported colors
      // Merge with dark theme defaults to fill any missing colors
      const baseTheme = this.getBaseThemeForColors(data.theme.colors);
      const newTheme: Theme = {
        id: `imported_${Date.now()}`,
        name: data.theme.name,
        isCustom: true,
        colors: {
          ...baseTheme.colors, // Default values
          ...data.theme.colors, // Imported values override defaults
        },
        messageFormats: this.normalizeMessageFormats(cloneMessageFormats(data.theme.messageFormats)),
      };

      // Check if a theme with the same name exists
      const existingIndex = this.customThemes.findIndex(
        t => t.name.toLowerCase() === newTheme.name.toLowerCase()
      );

      if (existingIndex !== -1) {
        // Append a number to make name unique
        newTheme.name = `${data.theme.name} (${Date.now() % 1000})`;
      }

      this.customThemes.push(newTheme);
      await this.saveCustomThemes();
      this.notifyListeners();

      return { success: true, theme: newTheme };
    } catch (error) {
      console.error('Failed to import theme:', error);
      return {
        success: false,
        error: error instanceof SyntaxError
          ? t('Invalid JSON format')
          : t('Failed to import theme'),
      };
    }
  }

  /**
   * Get current theme for export
   */
  exportCurrentTheme(): string {
    return this.exportTheme(this.currentTheme.id) || '';
  }
}

export const themeService = new ThemeService();

