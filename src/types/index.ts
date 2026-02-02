/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCMessage } from '../services/IRCService';

export interface ChannelTab {
  id: string;
  name: string;
  type: 'server' | 'channel' | 'query' | 'notice' | 'dcc';
  networkId: string;
  messages: IRCMessage[];
  dccSessionId?: string;
  hasActivity?: boolean;
  isEncrypted?: boolean;
  sendEncrypted?: boolean; // user toggle to send encrypted by default
  scrollbackLoaded?: boolean; // whether scrollback history has been loaded for this tab
}

export interface IRCNetwork {
  id: string;
  name: string;
  host: string;
  port: number;
  nick: string;
  username?: string;
  realname?: string;
  password?: string;
  tls: boolean;
  rejectUnauthorized?: boolean;
  sasl?: {
    account: string;
    password: string;
  };
}

