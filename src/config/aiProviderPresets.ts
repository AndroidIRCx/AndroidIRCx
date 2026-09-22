/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { AIProviderKind } from '../services/ai/types';

/**
 * Ready-made provider settings, so adding a provider is one tap plus a key.
 *
 * Most of these speak the OpenAI chat-completions format, which is why one
 * adapter covers them; Claude and Gemini have their own adapters and need no
 * base URL at all.
 *
 * A preset only fills the fields in — everything stays editable, and "Test
 * connection" validates the result immediately, so a stale URL here shows up
 * as a failed test rather than as a mystery.
 */
export interface AIProviderPreset {
  id: string;
  label: string;
  kind: AIProviderKind;
  /** Omitted for kinds whose adapter knows its own endpoint. */
  baseUrl?: string;
  /** Where the user creates the key. */
  keyUrl?: string;
  /** Shown under the preset; keep it to one short line. */
  note: string;
  /** Usable without paying — drives the "free" marker in the picker. */
  free?: boolean;
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Has a genuinely free tier — the cheapest way to try this.',
    free: true,
  },
  {
    id: 'ollama',
    label: 'Ollama (this network)',
    kind: 'local',
    baseUrl: 'http://127.0.0.1:11434/v1',
    note: 'A model on your own machine. No key, no bill, nothing leaves your network.',
    free: true,
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (this network)',
    kind: 'local',
    baseUrl: 'http://127.0.0.1:1234/v1',
    note: 'Same idea as Ollama. Change the address if it runs on your PC.',
    free: true,
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    note: 'Very fast, with a free tier.',
    free: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys',
    note: 'One key for many models, including some free ones.',
    free: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: 'Cheap, OpenAI-compatible.',
  },
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    kind: 'anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    note: 'Needs a developer key — a Claude Pro or Max subscription will not work.',
  },
  {
    id: 'openai',
    label: 'ChatGPT (OpenAI)',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    note: 'Needs a developer key — a ChatGPT Plus subscription will not work.',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    kind: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    keyUrl: 'https://console.x.ai',
    note: 'OpenAI-compatible.',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    kind: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    keyUrl: 'https://console.mistral.ai/api-keys',
    note: 'OpenAI-compatible.',
  },
  {
    id: 'custom',
    label: 'Something else',
    kind: 'openai-compatible',
    note: 'Any server that speaks the OpenAI chat-completions format.',
  },
];

/** Presets whose kind has a registered adapter, free ones first. */
export function presetsFor(supportedKinds: AIProviderKind[]) {
  return AI_PROVIDER_PRESETS.filter(preset =>
    supportedKinds.includes(preset.kind),
  );
}
