/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { AddonCapability, AddonManifest } from './AddonManifest';

/**
 * A check an author runs before packaging: does this addon declare what it
 * actually uses?
 *
 * **This is a lint, not a security boundary.** It reads source text, so a
 * determined author can hide a call from it — `api['send' + 'Message']` defeats
 * any regex. That is fine, because nothing here decides what an addon may do:
 * the runtime permission checks do, and they see the real call. What this
 * catches is the common, honest mistake — using something and forgetting to
 * declare it, which at runtime shows up as a denial the author did not expect.
 *
 * Dynamic indexing into `api` is reported precisely because the check cannot
 * see through it, so the author knows the answer is incomplete rather than
 * believing it is clean.
 */

/** Which capability each `api` member needs. */
export const CAPABILITY_SIGNALS: Readonly<Record<string, AddonCapability>> =
  Object.freeze({
    // Reading IRC
    users: 'irc.read',
    channelState: 'irc.read',
    server: 'irc.read',
    getChannelUsers: 'irc.read',
    getChannels: 'irc.read',
    getSharedChannels: 'irc.read',
    getChannelInfo: 'irc.read',
    getUserActivity: 'irc.read',
    isAnyAway: 'irc.read',

    // Sending
    sendMessage: 'irc.send',
    sendNotice: 'irc.send',
    sendAction: 'irc.send',
    sendCommand: 'irc.send',
    react: 'irc.send',

    // Moderation
    kick: 'irc.moderate',
    ban: 'irc.moderate',
    setMode: 'irc.moderate',
    setTopic: 'irc.moderate',

    // History, tabs, theme
    getMessages: 'history.read',
    searchHistory: 'history.read',
    getTabs: 'tabs.read',
    openTab: 'tabs.write',
    closeTab: 'tabs.write',
    setActiveTab: 'tabs.write',
    getTheme: 'theme.read',
    setTheme: 'theme.write',

    // Storage and secrets
    store: 'storage',
    getStorage: 'storage',
    setStorage: 'storage',
    listStorage: 'storage',
    clearStorage: 'storage',
    files: 'storage',
    secrets: 'secrets',

    // Outside the app
    http: 'network',
    fetchPage: 'network',
    notify: 'notifications',
    copyToClipboard: 'clipboard.write',
    ai: 'ai',
  });

/** Hooks that need a capability to be delivered at all. */
export const HOOK_SIGNALS: Readonly<Record<string, AddonCapability>> =
  Object.freeze({
    onRaw: 'irc.raw.observe',
    onRawOut: 'irc.raw.modify',
    onMessage: 'irc.read',
    onNotice: 'irc.read',
    onJoin: 'irc.read',
    onPart: 'irc.read',
    onQuit: 'irc.read',
    onKick: 'irc.read',
    onMode: 'irc.read',
    onTopic: 'irc.read',
    onNumeric: 'irc.read',
  });

export type FindingSeverity = 'error' | 'warning' | 'info';

export interface ConformanceFinding {
  severity: FindingSeverity;
  code:
    | 'undeclared-capability'
    | 'unused-capability'
    | 'dynamic-api-access'
    | 'undeclared-asset'
    | 'group-permission-unused'
    | 'risky-default';
  message: string;
  capability?: AddonCapability;
}

export interface ConformanceReport {
  ok: boolean;
  findings: ConformanceFinding[];
  /** Capabilities the source appears to need. */
  detected: AddonCapability[];
}

const MEMBER = /\bapi\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
const DYNAMIC = /\bapi\s*\[/;
const HOOK = /\b(on[A-Z][A-Za-z0-9_$]*)\s*[:(]/g;
const ASSET = /api\s*\.\s*assets?\s*\.\s*\w+\s*\(\s*['"`]([^'"`]+)['"`]/g;

/** Every `api` member the source mentions. */
export function detectApiUsage(source: string): {
  members: string[];
  hooks: string[];
  dynamic: boolean;
} {
  const text = typeof source === 'string' ? source : '';
  const members = new Set<string>();
  const hooks = new Set<string>();

  for (const match of text.matchAll(MEMBER)) members.add(match[1]);
  for (const match of text.matchAll(HOOK)) hooks.add(match[1]);

  return {
    members: [...members].sort(),
    hooks: [...hooks].sort(),
    dynamic: DYNAMIC.test(text),
  };
}

export function checkConformance(
  manifest: AddonManifest,
  sources: readonly string[],
): ConformanceReport {
  const findings: ConformanceFinding[] = [];
  const declared = new Set<AddonCapability>(manifest.permissions ?? []);
  const detected = new Set<AddonCapability>();
  let anyDynamic = false;

  for (const source of sources) {
    const usage = detectApiUsage(source);
    if (usage.dynamic) anyDynamic = true;

    for (const member of usage.members) {
      const capability = CAPABILITY_SIGNALS[member];
      if (capability) detected.add(capability);
    }
    for (const hook of usage.hooks) {
      const capability = HOOK_SIGNALS[hook];
      if (capability) detected.add(capability);
    }

    for (const match of source.matchAll(ASSET)) {
      if (!(manifest.assets ?? []).includes(match[1]))
        findings.push({
          severity: 'error',
          code: 'undeclared-asset',
          message: `The code reads "${match[1]}" but the manifest does not declare it as an asset.`,
        });
    }
  }

  // Missing a declaration is an error: at runtime it is a denial the author
  // did not expect, usually in front of a user.
  for (const capability of detected)
    if (!declared.has(capability))
      findings.push({
        severity: 'error',
        code: 'undeclared-capability',
        capability,
        message: `The code uses ${capability} but the manifest does not request it.`,
      });

  // Declaring more than you use is only a warning: it still works, but every
  // extra line in the install dialog makes the ones that matter easier to skip.
  const groupPermissions = new Set(
    (manifest.groups ?? []).flatMap(group => group.permissions),
  );
  for (const capability of declared)
    if (!detected.has(capability) && !groupPermissions.has(capability))
      findings.push({
        severity: 'warning',
        code: 'unused-capability',
        capability,
        message: `The manifest requests ${capability} but nothing appears to use it.`,
      });

  for (const group of manifest.groups ?? [])
    if (group.enabledByDefault === true && group.permissions.length > 0)
      findings.push({
        severity: 'warning',
        code: 'risky-default',
        message: `Group "${group.id}" asks to start enabled but needs permissions, so it will start disabled instead.`,
      });

  if (anyDynamic)
    findings.push({
      severity: 'info',
      code: 'dynamic-api-access',
      message:
        'The code indexes into api dynamically, so this check cannot see every call it makes.',
    });

  return {
    ok: !findings.some(finding => finding.severity === 'error'),
    findings,
    detected: [...detected].sort(),
  };
}

/** A short report an author can read in a terminal or a dialog. */
export function formatConformanceReport(report: ConformanceReport): string {
  if (report.findings.length === 0)
    return 'No problems found. Declared capabilities match what the code uses.';

  const order: FindingSeverity[] = ['error', 'warning', 'info'];
  return report.findings
    .slice()
    .sort(
      (left, right) =>
        order.indexOf(left.severity) - order.indexOf(right.severity),
    )
    .map(finding => `${finding.severity.toUpperCase()}: ${finding.message}`)
    .join('\n');
}
