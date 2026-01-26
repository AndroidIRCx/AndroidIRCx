import { MessageFormatPart, ThemeMessageFormats } from '../services/ThemeService';

export const DEFAULT_MESSAGE_FORMATS: ThemeMessageFormats = {
  message: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'nick' },
    { type: 'text', value: ': ' },
    { type: 'token', value: 'message' },
  ],
  messageMention: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'nick' },
    { type: 'text', value: ': ' },
    { type: 'token', value: 'message' },
  ],
  action: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] * ' },
    { type: 'token', value: 'nick' },
    { type: 'text', value: ' ' },
    { type: 'token', value: 'message' },
  ],
  actionMention: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] * ' },
    { type: 'token', value: 'nick' },
    { type: 'text', value: ' ' },
    { type: 'token', value: 'message' },
  ],
  notice: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] -' },
    { type: 'token', value: 'nick' },
    { type: 'text', value: '- ' },
    { type: 'token', value: 'message' },
  ],
  event: [
    { type: 'text', value: '[' },
    { type: 'token', value: 'time' },
    { type: 'text', value: '] ' },
    { type: 'token', value: 'message' },
  ],
};

export const AVAILABLE_MESSAGE_FORMAT_TOKENS: MessageFormatPart[] = [
  { type: 'token', value: 'time' },
  { type: 'token', value: 'nick' },
  { type: 'token', value: 'message' },
  { type: 'token', value: 'channel' },
  { type: 'token', value: 'network' },
  { type: 'token', value: 'account' },
  { type: 'token', value: 'username' },
  { type: 'token', value: 'hostname' },
  { type: 'token', value: 'hostmask' },
  { type: 'token', value: 'target' },
  { type: 'token', value: 'mode' },
  { type: 'token', value: 'topic' },
  { type: 'token', value: 'reason' },
  { type: 'token', value: 'numeric' },
  { type: 'token', value: 'command' },
];

export const getDefaultMessageFormats = (): ThemeMessageFormats =>
  JSON.parse(JSON.stringify(DEFAULT_MESSAGE_FORMATS));
