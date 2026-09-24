/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { AddonUserRecord } from './AddonIALService';
import { matchesHostmask } from './AddonUserMask';

/**
 * Who an addon trusts, and how strongly that trust is founded.
 *
 * mIRC uses opaque numeric access levels: level 100 means whatever the script
 * author decided it means, and two scripts on the same machine disagree. Rules
 * here carry a **label** the author chose plus an explicit allow/deny, so what
 * a rule is for survives being read by somebody else six months later.
 */

/** Weakest identification first — this ordering decides which rule wins. */
export type TrustMatchKind = 'nick' | 'hostmask' | 'account' | 'certfp';

const KIND_STRENGTH: Readonly<Record<TrustMatchKind, number>> = Object.freeze({
  nick: 1,
  hostmask: 2,
  account: 3,
  certfp: 4,
});

/**
 * A nick proves nothing: anyone can take it the moment its owner disconnects,
 * and on a network without services they can take it while the owner is still
 * connected. Rules built on one are marked weak and every consumer is expected
 * to say so.
 */
export const WEAK_KINDS: ReadonlySet<TrustMatchKind> = new Set(['nick']);

export interface TrustRule {
  id: string;
  addonId: string;
  networkId: string;
  kind: TrustMatchKind;
  /** The nick, mask, account name or certificate fingerprint to match. */
  value: string;
  /** Whether matching this rule grants or refuses. */
  effect: 'allow' | 'deny';
  /** The author's own word for what this rule is for, e.g. `moderator`. */
  label: string;
  weak: boolean;
  createdAt: number;
}

export interface TrustDecision {
  effect: 'allow' | 'deny';
  label: string;
  rule: TrustRule;
  weak: boolean;
}

export const MAX_RULES_PER_ADDON = 200;
const SAFE_LABEL = /^[a-zA-Z0-9._:-]{1,40}$/;

export class AddonTrustRules {
  private rules: TrustRule[] = [];
  private sequence = 0;

  add(input: {
    addonId: string;
    networkId: string;
    kind: TrustMatchKind;
    value: string;
    effect: 'allow' | 'deny';
    label: string;
  }): TrustRule {
    if (!input.value?.trim()) throw new Error('Trust rule needs a value.');
    if (!SAFE_LABEL.test(input.label))
      throw new Error('Trust rule label is invalid.');
    if (!KIND_STRENGTH[input.kind])
      throw new Error('Trust rule kind is invalid.');
    if (
      this.rules.filter(rule => rule.addonId === input.addonId).length >=
      MAX_RULES_PER_ADDON
    )
      throw new Error('Trust rule limit exceeded.');

    const rule: TrustRule = {
      id: `trust-${++this.sequence}`,
      addonId: input.addonId,
      networkId: input.networkId,
      kind: input.kind,
      value: input.value.trim(),
      effect: input.effect,
      label: input.label,
      weak: WEAK_KINDS.has(input.kind),
      createdAt: Date.now(),
    };
    this.rules.push(rule);
    return { ...rule };
  }

  remove(addonId: string, ruleId: string): boolean {
    const before = this.rules.length;
    this.rules = this.rules.filter(
      rule => !(rule.addonId === addonId && rule.id === ruleId),
    );
    return this.rules.length < before;
  }

  list(addonId: string, networkId?: string): TrustRule[] {
    return this.rules
      .filter(
        rule =>
          rule.addonId === addonId &&
          (networkId === undefined || rule.networkId === networkId),
      )
      .map(rule => ({ ...rule }));
  }

  clear(addonId: string): void {
    this.rules = this.rules.filter(rule => rule.addonId !== addonId);
  }

  /**
   * The decision for one user, by one addon.
   *
   * The strongest *kind* of identification wins, not the most recently added
   * rule: a certfp rule must not be overridden by someone registering a nick.
   * Within one kind a deny wins, because refusing on a tie is the safe way to
   * be wrong.
   *
   * **This returns a decision. It performs nothing.** Acting on it still needs
   * `irc.moderate`, checked where the action happens — a trusted rule says who
   * the user is, never what the addon is allowed to do to them.
   */
  evaluate(
    addonId: string,
    networkId: string,
    user: Pick<
      AddonUserRecord,
      'nick' | 'ident' | 'host' | 'account' | 'certfp'
    >,
  ): TrustDecision | undefined {
    let best: TrustRule | undefined;
    for (const rule of this.rules) {
      if (rule.addonId !== addonId || rule.networkId !== networkId) continue;
      if (!this.matches(rule, user)) continue;
      if (!best) {
        best = rule;
        continue;
      }
      const strength = KIND_STRENGTH[rule.kind] - KIND_STRENGTH[best.kind];
      if (strength > 0) best = rule;
      else if (
        strength === 0 &&
        rule.effect === 'deny' &&
        best.effect === 'allow'
      )
        best = rule;
    }
    return best
      ? {
          effect: best.effect,
          label: best.label,
          rule: { ...best },
          weak: best.weak,
        }
      : undefined;
  }

  resetForTests(): void {
    this.rules = [];
    this.sequence = 0;
  }

  private matches(
    rule: TrustRule,
    user: Pick<
      AddonUserRecord,
      'nick' | 'ident' | 'host' | 'account' | 'certfp'
    >,
  ): boolean {
    switch (rule.kind) {
      case 'certfp':
        // Exact and case-insensitive: fingerprints are hex, and servers
        // disagree about which case they send.
        return (
          !!user.certfp &&
          user.certfp.toLowerCase() === rule.value.toLowerCase()
        );
      case 'account':
        // A null account means the server said "logged out", which must never
        // match an account rule.
        return (
          typeof user.account === 'string' &&
          user.account.toLowerCase() === rule.value.toLowerCase()
        );
      case 'hostmask':
        return matchesHostmask(user, rule.value);
      case 'nick':
        return (
          !!user.nick && user.nick.toLowerCase() === rule.value.toLowerCase()
        );
      default:
        return false;
    }
  }
}

export const addonTrustRules = new AddonTrustRules();
