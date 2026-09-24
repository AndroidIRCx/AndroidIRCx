/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import type { AddonCapability } from './AddonManifest';
import type { InstalledAddonPackage } from './AddonPackageStore';
import { addonPackageStore } from './AddonPackageStore';
import { addonPermissionService } from './AddonPermissionService';
import { addonRuntimeManager } from './AddonRuntimeManager';
import { addonSafetyService } from './AddonSafetyService';
import { addonAuditService } from './AddonAuditService';
import { addonDiagnostics } from './AddonDiagnostics';
import {
  fingerprintLine,
  isTransportCritical,
  rawCommandOf,
  sanitizeOutboundLine,
  type RawRejectReason,
} from './AddonRawPolicy';

/** One addon may not hold the wire open indefinitely on a single line. */
export const RAW_DEADLINE_MS = 250;
const MAX_MODIFIERS = 4;
const MAX_RECENT = 50;
const SAFE_HOOK = /^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/;

/** Disconnects within this window count towards a reconnect loop. */
export const RECONNECT_WINDOW_MS = 60_000;
export const RECONNECT_LOOP_LIMIT = 3;

export type RawDirection = 'in' | 'out';

export type RawOutcome =
  | 'unchanged'
  | 'modified'
  | 'dropped'
  | 'protected'
  | 'timed-out'
  | 'failed'
  | 'rejected'
  | 'truncated';

export interface RawDiagnosticEntry {
  timestamp: number;
  addonId: string;
  command: string;
  outcome: RawOutcome;
  /** Fingerprints, never the line. Absent for credential-bearing commands. */
  originalHash?: string;
  resultHash?: string;
  reason?: RawRejectReason;
}

export interface RawCounters {
  evaluated: number;
  modified: number;
  dropped: number;
  protectedLines: number;
  timedOut: number;
  failed: number;
  rejected: number;
  truncated: number;
}

export interface OutboundRawDecision {
  /** What to write, or null when nothing should be written. */
  line: string | null;
  outcome: RawOutcome;
  reason?: RawRejectReason;
}

interface RawSubscription {
  id: number;
  addonId: string;
  hook: string;
  direction: RawDirection;
}

interface PackageBoundary {
  initialize(): Promise<void>;
  get(addonId: string): InstalledAddonPackage | undefined;
}

interface PermissionBoundary {
  initialize(): Promise<void>;
  requireGrant(
    addonId: string,
    declared: readonly AddonCapability[],
    capability: string,
  ): asserts capability is AddonCapability;
}

interface RuntimeBoundary {
  invoke(
    addonId: string,
    request: { hook: string; payloadJson: string },
  ): Promise<{ resultJson?: string }>;
}

interface SafetyBoundary {
  disable(addonId: string): Promise<void>;
  recordFailure(addonId: string): Promise<boolean>;
}

interface AuditBoundary {
  initialize(): Promise<void>;
  record(entry: {
    addonId: string;
    capability: AddonCapability;
    action: string;
    target: 'irc-network';
    result: 'allowed' | 'denied' | 'failed';
  }): Promise<void>;
}

const emptyCounters = (): RawCounters => ({
  evaluated: 0,
  modified: 0,
  dropped: 0,
  protectedLines: 0,
  timedOut: 0,
  failed: 0,
  rejected: 0,
  truncated: 0,
});

/**
 * Expert-mode raw middleware — mIRC's raw-event reach, with the parts that
 * would hang a connection taken away.
 *
 * **Outgoing traffic can be rewritten; incoming traffic cannot.** Holding an
 * inbound line while an isolated runtime is asked what to do with it would
 * stall protocol processing, and the project's hard boundary is that IRC state
 * completes regardless of what an addon does. An inbound hook therefore sees
 * every line and its return value is ignored — recorded once per addon, so an
 * author who expected otherwise finds out instead of debugging silence, which
 * is exactly how `onRaw` managed to be dead for so long.
 */
export class AddonRawMiddleware {
  private subscriptions: RawSubscription[] = [];
  private sequence = 0;
  private suspended = false;
  private counters = new Map<string, RawCounters>();
  private recent: RawDiagnosticEntry[] = [];
  private inboundWarned = new Set<string>();
  private disconnects: number[] = [];

  constructor(
    private readonly packages: PackageBoundary = addonPackageStore,
    private readonly permissions: PermissionBoundary = addonPermissionService,
    private readonly runtimes: RuntimeBoundary = addonRuntimeManager,
    private readonly safety: SafetyBoundary = addonSafetyService,
    private readonly audit: AuditBoundary = addonAuditService,
    private readonly deadlineMs: number = RAW_DEADLINE_MS,
  ) {}

  /**
   * Both directions require `irc.raw.modify`, which cannot be granted
   * permanently — the capability registry forbids it — so expert mode is
   * re-confirmed each session rather than agreed to once and forgotten.
   */
  async register(
    addonId: string,
    hook: string,
    direction: RawDirection,
  ): Promise<() => void> {
    if (!SAFE_HOOK.test(hook)) throw new Error('Addon raw hook is invalid.');
    await Promise.all([
      this.packages.initialize(),
      this.permissions.initialize(),
      this.audit.initialize(),
    ]);
    const installed = this.packages.get(addonId);
    if (!installed) throw new Error('Addon package is not installed.');
    this.permissions.requireGrant(
      addonId,
      installed.manifest.permissions,
      'irc.raw.modify',
    );
    if (
      this.subscriptions.filter(entry => entry.direction === 'out').length >=
        MAX_MODIFIERS &&
      direction === 'out'
    )
      throw new Error('Addon raw modifier limit exceeded.');

    const subscription: RawSubscription = {
      id: ++this.sequence,
      addonId,
      hook,
      direction,
    };
    this.subscriptions.push(subscription);
    return () => {
      this.subscriptions = this.subscriptions.filter(
        candidate => candidate.id !== subscription.id,
      );
    };
  }

  /**
   * Lets a caller keep the ordinary synchronous send path when nothing is
   * registered, so installing the middleware costs an await only for users who
   * actually enabled an expert-mode addon.
   */
  hasOutgoingModifiers(): boolean {
    return (
      !this.suspended &&
      this.subscriptions.some(entry => entry.direction === 'out')
    );
  }

  /** "Reconnect without raw add-ons" and Safe Mode both land here. */
  suspend(): void {
    this.suspended = true;
  }

  resume(): void {
    this.suspended = false;
    this.disconnects = [];
  }

  isSuspended(): boolean {
    return this.suspended;
  }

  async filterOutgoing(line: string): Promise<OutboundRawDecision> {
    const command = rawCommandOf(line);
    if (!this.hasOutgoingModifiers()) return this.finish(line, command);

    if (isTransportCritical(line)) {
      // Not an error and not worth a per-line audit entry storm: expert mode
      // simply does not reach these, and the counter says how often it tried.
      this.note('', command, 'protected');
      return this.finish(line, command);
    }

    let current = line;
    let truncated = false;
    for (const subscription of this.outgoing()) {
      const installed = this.packages.get(subscription.addonId);
      if (!installed) continue;
      try {
        this.permissions.requireGrant(
          subscription.addonId,
          installed.manifest.permissions,
          'irc.raw.modify',
        );
      } catch {
        continue;
      }

      const before = current;
      let resultJson: string | undefined;
      try {
        resultJson = await this.withDeadline(
          this.runtimes.invoke(subscription.addonId, {
            hook: subscription.hook,
            payloadJson: JSON.stringify({
              line: before,
              direction: 'out',
              command: rawCommandOf(before),
            }),
          }),
        );
      } catch (error) {
        const timedOut = (error as Error)?.message === 'raw-deadline';
        this.note(
          subscription.addonId,
          command,
          timedOut ? 'timed-out' : 'failed',
          before,
        );
        await this.recordFailure(subscription.addonId, timedOut);
        continue; // The original line continues unchanged.
      }

      const proposed = parseRawResult(resultJson);
      if (proposed === undefined) continue;

      if (proposed === null) {
        this.note(subscription.addonId, command, 'dropped', before);
        await this.recordOutcome(subscription.addonId, 'raw.out.dropped');
        return { line: null, outcome: 'dropped' };
      }

      // Re-checked on the *output*: an addon must not be able to manufacture a
      // CAP or AUTHENTICATE line out of an ordinary one.
      if (isTransportCritical(proposed)) {
        this.note(subscription.addonId, command, 'protected', before);
        await this.recordOutcome(subscription.addonId, 'raw.out.protected');
        continue;
      }

      const checked = sanitizeOutboundLine(proposed);
      if (checked.line === null) {
        this.note(
          subscription.addonId,
          command,
          'rejected',
          before,
          undefined,
          checked.rejected,
        );
        await this.recordOutcome(subscription.addonId, 'raw.out.rejected');
        continue; // Falls back to the line the app meant to send.
      }

      current = checked.line;
      // Truncation is counted against the addon that produced the over-long
      // line, not lost behind the "modified" count: the author needs to see
      // that the wire did not carry what they wrote.
      if (checked.truncated) truncated = true;
      this.note(
        subscription.addonId,
        command,
        checked.truncated ? 'truncated' : 'modified',
        before,
        current,
      );
      await this.recordOutcome(
        subscription.addonId,
        checked.truncated ? 'raw.out.truncated' : 'raw.out.modified',
      );
    }

    return this.finish(current, command, truncated);
  }

  /**
   * Inbound lines are shown to their hooks and nothing they return is applied.
   * See the class comment for why.
   */
  async observeIncoming(line: string): Promise<void> {
    const inbound = this.subscriptions.filter(
      entry => entry.direction === 'in',
    );
    if (inbound.length === 0 || this.suspended) return;
    const command = rawCommandOf(line);
    const payloadJson = JSON.stringify({ line, direction: 'in', command });

    for (const subscription of inbound) {
      const installed = this.packages.get(subscription.addonId);
      if (!installed) continue;
      try {
        this.permissions.requireGrant(
          subscription.addonId,
          installed.manifest.permissions,
          'irc.raw.modify',
        );
        const result = await this.withDeadline(
          this.runtimes.invoke(subscription.addonId, {
            hook: subscription.hook,
            payloadJson,
          }),
        );
        if (
          parseRawResult(result) !== undefined &&
          !this.inboundWarned.has(subscription.addonId)
        ) {
          this.inboundWarned.add(subscription.addonId);
          this.note(subscription.addonId, command, 'unchanged', line);
          await this.recordOutcome(
            subscription.addonId,
            'raw.in.result-ignored',
          );
        }
      } catch {
        this.note(subscription.addonId, command, 'failed');
      }
    }
  }

  /**
   * A raw-modifying addon that breaks registration produces a connect/drop
   * cycle rather than an error, so the loop itself is the signal. The most
   * recently registered modifier is the one disabled: it is the change the
   * user made last, and disabling all of them would punish the innocent.
   */
  async noteDisconnected(): Promise<string | undefined> {
    if (!this.hasOutgoingModifiers()) return undefined;
    const now = Date.now();
    this.disconnects = [
      ...this.disconnects.filter(at => now - at < RECONNECT_WINDOW_MS),
      now,
    ];
    if (this.disconnects.length < RECONNECT_LOOP_LIMIT) return undefined;

    const culprit = this.outgoing().at(-1);
    if (!culprit) return undefined;
    this.disconnects = [];
    this.suspend();
    this.clear(culprit.addonId);
    await this.safety.disable(culprit.addonId);
    await this.recordOutcome(culprit.addonId, 'raw.out.reconnect-loop');
    return culprit.addonId;
  }

  noteConnected(): void {
    this.disconnects = [];
  }

  getDiagnostics(addonId?: string): {
    counters: RawCounters;
    recent: RawDiagnosticEntry[];
  } {
    const counters = addonId
      ? { ...(this.counters.get(addonId) ?? emptyCounters()) }
      : [...this.counters.values()].reduce((total, entry) => {
          for (const key of Object.keys(total) as Array<keyof RawCounters>)
            total[key] += entry[key];
          return total;
        }, emptyCounters());
    return {
      counters,
      recent: this.recent
        .filter(entry => addonId === undefined || entry.addonId === addonId)
        .map(entry => ({ ...entry })),
    };
  }

  clear(addonId: string): void {
    this.subscriptions = this.subscriptions.filter(
      entry => entry.addonId !== addonId,
    );
    this.inboundWarned.delete(addonId);
  }

  resetForTests(): void {
    this.subscriptions = [];
    this.sequence = 0;
    this.suspended = false;
    this.counters.clear();
    this.recent = [];
    this.inboundWarned.clear();
    this.disconnects = [];
  }

  private outgoing(): RawSubscription[] {
    return this.subscriptions
      .filter(entry => entry.direction === 'out')
      .sort((left, right) => left.id - right.id);
  }

  private finish(
    line: string,
    command: string,
    alreadyTruncated = false,
  ): OutboundRawDecision {
    const checked = sanitizeOutboundLine(line);
    if (checked.line === null) {
      this.note(
        '',
        command,
        'rejected',
        undefined,
        undefined,
        checked.rejected,
      );
      return { line: null, outcome: 'rejected', reason: checked.rejected };
    }
    if (checked.truncated) {
      this.note('', command, 'truncated');
      return { line: checked.line, outcome: 'truncated' };
    }
    return {
      line: checked.line,
      outcome: alreadyTruncated ? 'truncated' : 'unchanged',
    };
  }

  private async withDeadline(
    work: Promise<{ resultJson?: string }>,
  ): Promise<string | undefined> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        work,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('raw-deadline')),
            this.deadlineMs,
          );
        }),
      ]);
      return result.resultJson;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async recordFailure(
    addonId: string,
    timedOut: boolean,
  ): Promise<void> {
    addonDiagnostics.count(addonId, timedOut ? 'timeouts' : 'errors');
    await this.recordOutcome(
      addonId,
      timedOut ? 'raw.out.timeout' : 'raw.out.failed',
      'failed',
    );
    try {
      await this.safety.recordFailure(addonId);
    } catch {
      // Recovery bookkeeping must never stop the original line being sent.
    }
  }

  private async recordOutcome(
    addonId: string,
    action: string,
    result: 'allowed' | 'denied' | 'failed' = 'allowed',
  ): Promise<void> {
    try {
      await this.audit.record({
        addonId,
        capability: 'irc.raw.modify',
        action,
        target: 'irc-network',
        result,
      });
    } catch {
      // Auditing is never allowed to interrupt IRC traffic.
    }
  }

  private note(
    addonId: string,
    command: string,
    outcome: RawOutcome,
    original?: string,
    result?: string,
    reason?: RawRejectReason,
  ): void {
    if (addonId) {
      const counters = this.counters.get(addonId) ?? emptyCounters();
      bump(counters, outcome);
      this.counters.set(addonId, counters);
    } else {
      const counters = this.counters.get('') ?? emptyCounters();
      bump(counters, outcome);
      this.counters.set('', counters);
    }

    // Fingerprints prove a line changed without keeping the line, and a
    // credential-bearing command gets neither: a digest of a password is still
    // something worth attacking, and nothing here needs it.
    const credentialBearing = command === 'PASS' || command === 'AUTHENTICATE';
    this.recent.push({
      timestamp: Date.now(),
      addonId,
      command,
      outcome,
      originalHash:
        original && !credentialBearing ? fingerprintLine(original) : undefined,
      resultHash:
        result && !credentialBearing ? fingerprintLine(result) : undefined,
      reason,
    });
    this.recent = this.recent.slice(-MAX_RECENT);
  }
}

function bump(counters: RawCounters, outcome: RawOutcome): void {
  counters.evaluated += 1;
  if (outcome === 'modified') counters.modified += 1;
  else if (outcome === 'dropped') counters.dropped += 1;
  else if (outcome === 'protected') counters.protectedLines += 1;
  else if (outcome === 'timed-out') counters.timedOut += 1;
  else if (outcome === 'failed') counters.failed += 1;
  else if (outcome === 'rejected') counters.rejected += 1;
  else if (outcome === 'truncated') counters.truncated += 1;
}

/**
 * `undefined` means "the addon said nothing, keep the line", `null` means
 * "drop it", a string is a replacement. Anything else is treated as silence,
 * because a malformed result must not be able to clear the wire.
 */
function parseRawResult(
  resultJson: string | undefined,
): string | null | undefined {
  if (typeof resultJson !== 'string' || resultJson.length === 0)
    return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultJson);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return undefined;
  const value = parsed as { line?: unknown; drop?: unknown };
  if (value.drop === true) return null;
  return typeof value.line === 'string' ? value.line : undefined;
}

export const addonRawMiddleware = new AddonRawMiddleware();
