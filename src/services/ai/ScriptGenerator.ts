/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { aiService } from './AIService';
import { scriptingService } from '../ScriptingService';
import {
  AI_ENTRIES,
  API_ENTRIES,
  HOOK_ENTRIES,
  VocabularyEntry,
} from '../../config/scriptVocabulary';
import { AIError } from './types';

/**
 * Turns a plain-language description into AndroidIRCX script code.
 *
 * Two rules this module exists to keep:
 *
 * 1. The API reference in the prompt is **generated** from the shared
 *    vocabulary lists, never hand-written. Adding an `api.*` method teaches
 *    the generator about it with no prompt maintenance, and the model is
 *    never told about a method that does not exist.
 * 2. Generation is a **user action in the editor**, never reachable from a
 *    running hook. A script that asked AI to write a script from channel text
 *    would be arbitrary code execution steered by whoever is in the channel.
 *    Nothing here is exposed on `api.*`.
 */

/** Caller id for the rate limiter — separate from any script's budget. */
const CALLER_ID = 'script-generator';

const MAX_DESCRIPTION_CHARS = 1000;
/**
 * How much existing code may be sent for an edit. Well under the service's
 * own prompt ceiling, so the system prompt and the description always fit
 * alongside it and the user gets this message rather than a generic one.
 */
const MAX_CODE_CHARS = 6000;

export interface GeneratedScript {
  code: string;
  /** Result of running the generated code through the normal lint check. */
  lint: { ok: boolean; message: string };
  /** True when this rewrote an existing script rather than writing a new one. */
  edited: boolean;
}

/**
 * One vocabulary line for the prompt. Signatures rather than bare names: a
 * model given only `setTimer` guesses its arguments, and the guess compiles.
 */
function describe(entry: VocabularyEntry): string {
  const awaited = entry.isAsync ? ' [async — await it]' : '';
  return `- ${entry.signature} — ${entry.summary}${awaited}`;
}

export function buildSystemPrompt(editing = false): string {
  const editingRules = editing
    ? [
        '',
        'You are EDITING a script the user already has, not writing a new one.',
        '- Apply only the change they asked for.',
        '- Keep everything else exactly as it is: their logic, their names,',
        '  their comments, their formatting. Do not tidy, rename or refactor.',
        '- Reply with the complete updated script, not a diff and not a fragment.',
      ]
    : [];
  return [
    'You write scripts for AndroidIRCX, an Android IRC client.',
    ...editingRules,
    '',
    'Output rules:',
    '- Reply with JavaScript only. No prose, no explanation, no markdown fences.',
    '- The script must assign its hooks to module.exports.',
    '- Use only the hooks and api methods listed below. Nothing else exists.',
    '- There is no DOM, no require, no fetch, no filesystem.',
    '- Keep it short and readable, and comment anything non-obvious.',
    '',
    'Shape:',
    'module.exports = {',
    '  onMessage: (msg) => { /* msg: { from, text, channel, network } */ },',
    '};',
    '',
    'Hooks:',
    ...HOOK_ENTRIES.map(describe),
    '',
    'api methods (prefix each with `api.`):',
    ...API_ENTRIES.map(describe),
    '',
    'api.ai methods (prefix with `api.ai.`; all resolve null on failure):',
    ...AI_ENTRIES.map(describe),
    '',
    'Notes that matter:',
    '- onRaw and onCommand must return synchronously; they cannot await.',
    '- Never pass an AI answer to api.sendCommand. Channel text reaches the',
    '  prompt, so an injected instruction could become a real /kick.',
    '- A script that replies inside onMessage must ignore its own output',
    '  (check msg.from against api.userNick) or it will loop and flood.',
  ].join('\n');
}

/**
 * Models often wrap code in ```fences``` despite being asked not to. Strip
 * them rather than failing: the user wants a script, not a lecture about
 * output format.
 */
export function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(
    /^```(?:javascript|js|ts)?\s*\n([\s\S]*?)\n?```$/i,
  );
  if (fenced) return fenced[1].trim();
  return trimmed;
}

class ScriptGenerator {
  /** True when a provider is configured, enabled and consented to. */
  async isAvailable(): Promise<boolean> {
    return aiService.isAvailable();
  }

  /**
   * Generate a script from `description`. Resolves with the code and its lint
   * result; the caller shows both and decides whether to keep it. Nothing is
   * saved or enabled here.
   *
   * When `existingCode` is given, this becomes an **edit**: the current script
   * is sent along and the model is told to return it with the requested change
   * applied. Without it the model can only invent a new script, which is how
   * "add a cooldown to this" used to silently replace the user's work.
   */
  async generate(
    description: string,
    existingCode?: string,
  ): Promise<GeneratedScript> {
    const prompt = (description || '').trim();
    if (!prompt) {
      throw new AIError(
        'invalid_request',
        'Describe what the script should do',
      );
    }

    const current = (existingCode || '').trim();
    const editing = current.length > 0;
    if (editing && current.length > MAX_CODE_CHARS) {
      throw new AIError(
        'prompt_too_long',
        `This script is too long to edit with AI (${current.length} characters, limit is ${MAX_CODE_CHARS}). Edit it by hand, or ask for a new script instead.`,
      );
    }

    const request = editing
      ? [
          'Here is the current script:',
          '',
          current,
          '',
          'Change to make:',
          prompt.substring(0, MAX_DESCRIPTION_CHARS),
        ].join('\n')
      : prompt.substring(0, MAX_DESCRIPTION_CHARS);

    const result = await aiService.ask(
      request,
      {
        system: buildSystemPrompt(editing),
        maxTokens: 2000,
        // No channel is named: this is the user's own description and their
        // own code, so it carries nobody else's words and the per-channel
        // gate does not apply.
      },
      CALLER_ID,
    );

    const code = stripCodeFences(result.text);
    if (!code) {
      throw new AIError('provider_error', 'The provider returned no code');
    }

    return { code, lint: scriptingService.lint(code), edited: editing };
  }
}

export const scriptGenerator = new ScriptGenerator();
