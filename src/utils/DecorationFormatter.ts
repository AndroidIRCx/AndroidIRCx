/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type DecorationSettings = {
  enabled: boolean;
  useColors: boolean;
  bold: boolean;
  underline: boolean;
  textStyleId: string;
  colorStyleId: string;
  adornmentId: string;
};

const MIR_BOLD = '\x02';
const MIR_UNDERLINE = '\x1F';
const MIR_RESET = '\x0F';

const replaceBackspacePlaceholder = (template: string, text: string): string => {
  const idx = template.indexOf('\x08');
  if (idx === -1) return template;
  const before = template.slice(0, idx);
  const after = template.slice(idx + 1).replace(/\x08/g, '');
  return `${before}${text}${after}`;
};

const applyTemplate = (template: string, text: string): string => {
  if (!template) return text;
  const hasTextPlaceholder = /<text>/i.test(template);
  if (hasTextPlaceholder) {
    return template.replace(/<text>/gi, text);
  }
  if (template.includes('\b')) {
    return replaceBackspacePlaceholder(template, text);
  }
  return `${template} ${text}`.trim();
};

export const applyDecoration = (message: string, settings: DecorationSettings): string => {
  if (!settings.enabled || !message.trim()) return message;

  let output = message;
  if (settings.textStyleId) {
    output = applyTemplate(settings.textStyleId, output);
  }
  if (settings.useColors && settings.colorStyleId) {
    output = applyTemplate(settings.colorStyleId, output);
  }
  if (settings.adornmentId) {
    output = applyTemplate(settings.adornmentId, output);
  }

  const prefixCodes: string[] = [];
  if (settings.bold) prefixCodes.push(MIR_BOLD);
  if (settings.underline) prefixCodes.push(MIR_UNDERLINE);

  if (prefixCodes.length > 0) {
    output = `${prefixCodes.join('')}${output}${MIR_RESET}`;
  }

  return output;
};
