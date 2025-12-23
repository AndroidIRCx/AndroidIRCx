import { IRCMessage } from '../services/IRCService';

export interface ChannelTab {
  id: string;
  name: string;
  type: 'server' | 'channel' | 'query' | 'dcc';
  networkId: string;
  messages: IRCMessage[];
  dccSessionId?: string;
  hasActivity?: boolean;
  isEncrypted?: boolean;
  sendEncrypted?: boolean; // user toggle to send encrypted by default
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

