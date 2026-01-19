/**
 * Sound Types for Notification Sounds Feature
 */

/** Sound event types that can trigger sounds */
export enum SoundEventType {
  MENTION = 'mention',
  PRIVATE_MESSAGE = 'private_message',
  JOIN = 'join',
  KICK = 'kick',
  NOTICE = 'notice',
  CTCP = 'ctcp',
  DISCONNECT = 'disconnect',
  LOGIN = 'login',
  SEND = 'send',
  FAIL = 'fail',
  RING = 'ring',
  FLOOD = 'flood',
  OP = 'op',
  DEOP = 'deop',
}

/** Configuration for a single sound event */
export interface SoundEventConfig {
  enabled: boolean;
  useCustom: boolean;
  customUri?: string;
  volume?: number; // 0.0 - 1.0, multiplier on top of master volume
}

/** Sound scheme/theme definition */
export interface SoundScheme {
  id: string;
  name: string;
  description?: string;
  isBuiltIn: boolean;
  sounds: Partial<Record<SoundEventType, string>>; // event -> filename or URI
}

/** Built-in sound schemes */
export type BuiltInSchemeId = 'classic' | 'modern' | 'silent';

/** Complete sound settings */
export interface SoundSettings {
  masterVolume: number; // 0.0 - 1.0
  enabled: boolean; // Global enable/disable
  playInForeground: boolean; // Play sounds when app is in foreground
  playInBackground: boolean; // Play sounds when app is in background
  activeSchemeId: string; // Current scheme ID
  events: Record<SoundEventType, SoundEventConfig>;
}

/** Default sound mapping (filename in assets/sounds/) */
export const DEFAULT_SOUNDS: Record<SoundEventType, string> = {
  [SoundEventType.MENTION]: 'cuac.wav',
  [SoundEventType.PRIVATE_MESSAGE]: 'bip.wav',
  [SoundEventType.JOIN]: 'join.wav',
  [SoundEventType.KICK]: 'kick.wav',
  [SoundEventType.NOTICE]: 'notice.wav',
  [SoundEventType.CTCP]: 'ctcp.wav',
  [SoundEventType.DISCONNECT]: 'disconnected.wav',
  [SoundEventType.LOGIN]: 'login.wav',
  [SoundEventType.SEND]: 'send.wav',
  [SoundEventType.FAIL]: 'fail.wav',
  [SoundEventType.RING]: 'ring.wav',
  [SoundEventType.FLOOD]: 'flood.wav',
  [SoundEventType.OP]: 'op.wav',
  [SoundEventType.DEOP]: 'deop.wav',
};

/** Human-readable labels for sound events */
export const SOUND_EVENT_LABELS: Record<SoundEventType, string> = {
  [SoundEventType.MENTION]: 'Mention',
  [SoundEventType.PRIVATE_MESSAGE]: 'Private Message',
  [SoundEventType.JOIN]: 'User Join',
  [SoundEventType.KICK]: 'Kick',
  [SoundEventType.NOTICE]: 'Notice',
  [SoundEventType.CTCP]: 'CTCP Request',
  [SoundEventType.DISCONNECT]: 'Disconnected',
  [SoundEventType.LOGIN]: 'Connected',
  [SoundEventType.SEND]: 'Message Sent',
  [SoundEventType.FAIL]: 'Error',
  [SoundEventType.RING]: 'DCC/Ring',
  [SoundEventType.FLOOD]: 'Flood Protection',
  [SoundEventType.OP]: 'Got Op',
  [SoundEventType.DEOP]: 'Lost Op',
};

/** Event categories for grouping in settings UI */
export const SOUND_EVENT_CATEGORIES: Record<string, SoundEventType[]> = {
  'Messages': [
    SoundEventType.MENTION,
    SoundEventType.PRIVATE_MESSAGE,
    SoundEventType.NOTICE,
    SoundEventType.SEND,
  ],
  'Channel Events': [
    SoundEventType.JOIN,
    SoundEventType.KICK,
    SoundEventType.OP,
    SoundEventType.DEOP,
  ],
  'Connection': [
    SoundEventType.LOGIN,
    SoundEventType.DISCONNECT,
    SoundEventType.FAIL,
  ],
  'Other': [
    SoundEventType.CTCP,
    SoundEventType.RING,
    SoundEventType.FLOOD,
  ],
};

/** Built-in sound schemes */
export const BUILT_IN_SCHEMES: SoundScheme[] = [
  {
    id: 'classic',
    name: 'Classic IRC',
    description: 'Traditional IRC client sounds',
    isBuiltIn: true,
    sounds: { ...DEFAULT_SOUNDS },
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Subtle modern notification sounds',
    isBuiltIn: true,
    sounds: {
      [SoundEventType.MENTION]: 'bip.wav',
      [SoundEventType.PRIVATE_MESSAGE]: 'bip.wav',
      [SoundEventType.LOGIN]: 'login.wav',
      [SoundEventType.DISCONNECT]: 'disconnected.wav',
    },
  },
  {
    id: 'silent',
    name: 'Silent',
    description: 'No sounds',
    isBuiltIn: true,
    sounds: {},
  },
];

/** Default sound settings */
export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  masterVolume: 0.7,
  enabled: true,
  playInForeground: true,
  playInBackground: true,
  activeSchemeId: 'classic',
  events: Object.values(SoundEventType).reduce((acc, eventType) => {
    acc[eventType] = {
      enabled: eventType === SoundEventType.MENTION ||
               eventType === SoundEventType.PRIVATE_MESSAGE ||
               eventType === SoundEventType.DISCONNECT ||
               eventType === SoundEventType.LOGIN ||
               eventType === SoundEventType.RING,
      useCustom: false,
      volume: 1.0,
    };
    return acc;
  }, {} as Record<SoundEventType, SoundEventConfig>),
};
