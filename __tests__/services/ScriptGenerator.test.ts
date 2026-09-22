/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock('../../src/services/ai/AIService', () => ({
  aiService: {
    ask: jest.fn(),
    isAvailable: jest.fn(),
  },
}));

jest.mock('../../src/services/ScriptingService', () => ({
  scriptingService: {
    lint: jest.fn(() => ({ ok: true, message: 'ok' })),
  },
}));

import {
  buildSystemPrompt,
  scriptGenerator,
  stripCodeFences,
} from '../../src/services/ai/ScriptGenerator';
import {
  AI_MEMBERS,
  API_MEMBERS,
  HOOK_LIST,
} from '../../src/config/scriptVocabulary';

const { aiService } = require('../../src/services/ai/AIService');
const { scriptingService } = require('../../src/services/ScriptingService');

const answer = (text: string) => ({ text, model: 'm', providerId: 'p1' });

describe('buildSystemPrompt', () => {
  it('lists every hook and api method from the shared vocabulary', () => {
    const prompt = buildSystemPrompt();

    // Generated, not hand-written: a method added to the vocabulary must
    // reach the model without anyone editing this prompt.
    for (const hook of HOOK_LIST) expect(prompt).toContain(hook);
    for (const member of API_MEMBERS) expect(prompt).toContain(member);
    for (const member of AI_MEMBERS) expect(prompt).toContain(member);
  });

  it('carries the three rules a generated script most often breaks', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('module.exports');
    expect(prompt).toMatch(/onRaw and onCommand must return synchronously/);
    expect(prompt).toMatch(/Never pass an AI answer to api\.sendCommand/);
    expect(prompt).toMatch(/ignore its own output/);
  });
});

describe('stripCodeFences', () => {
  it('unwraps a fenced block', () => {
    expect(stripCodeFences('```javascript\nmodule.exports = {};\n```')).toBe(
      'module.exports = {};',
    );
    expect(stripCodeFences('```\nmodule.exports = {};\n```')).toBe(
      'module.exports = {};',
    );
  });

  it('leaves bare code alone', () => {
    expect(stripCodeFences('  module.exports = {};  ')).toBe(
      'module.exports = {};',
    );
  });

  it('does not eat a fence that is part of the code', () => {
    const code = 'const md = "```";\nmodule.exports = {};';
    expect(stripCodeFences(code)).toBe(code);
  });
});

describe('ScriptGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scriptingService.lint.mockReturnValue({ ok: true, message: 'ok' });
  });

  it('generates code and reports the lint verdict', async () => {
    aiService.ask.mockResolvedValue(
      answer('```js\nmodule.exports = { onJoin: () => {} };\n```'),
    );

    const result = await scriptGenerator.generate('greet joiners');

    expect(result.code).toBe('module.exports = { onJoin: () => {} };');
    expect(result.lint.ok).toBe(true);
  });

  it('surfaces a lint failure instead of pretending the code is fine', async () => {
    aiService.ask.mockResolvedValue(answer('module.exports = {'));
    scriptingService.lint.mockReturnValue({ ok: false, message: 'Unexpected' });

    const result = await scriptGenerator.generate('something broken');

    expect(result.lint).toEqual({ ok: false, message: 'Unexpected' });
  });

  it('meters itself separately from any script', async () => {
    aiService.ask.mockResolvedValue(answer('module.exports = {};'));

    await scriptGenerator.generate('do a thing');

    const [, options, callerId] = aiService.ask.mock.calls[0];
    expect(callerId).toBe('script-generator');
    // No channel is named: this is the user's own description, so the
    // per-channel opt-in does not apply to it.
    expect(options.channel).toBeUndefined();
    expect(options.system).toContain('AndroidIRCX');
  });

  it('refuses an empty description without spending a call', async () => {
    await expect(scriptGenerator.generate('   ')).rejects.toMatchObject({
      code: 'invalid_request',
    });
    expect(aiService.ask).not.toHaveBeenCalled();
  });

  it('caps a very long description', async () => {
    aiService.ask.mockResolvedValue(answer('module.exports = {};'));

    await scriptGenerator.generate('x'.repeat(5000));

    expect(aiService.ask.mock.calls[0][0].length).toBe(1000);
  });

  it('errors when the provider returns nothing usable', async () => {
    aiService.ask.mockResolvedValue(answer('   '));

    await expect(scriptGenerator.generate('do a thing')).rejects.toMatchObject({
      code: 'provider_error',
    });
  });
});
