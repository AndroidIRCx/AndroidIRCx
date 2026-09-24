/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * mIRC's `/signal`, between add-ons on one device.
 *
 * Delivery is local and needs no permission: a signal carries only what the
 * sending addon chose to put in it, so it grants no access the receiver did not
 * already have. What it does need is a stop: two add-ons answering each other
 * is an infinite loop that looks exactly like the app hanging, so depth and
 * rate are both bounded and a broken chain is dropped rather than followed.
 */

export const MAX_PAYLOAD_BYTES = 16 * 1024;
export const MAX_DEPTH = 5;
export const MAX_SIGNALS_PER_SECOND = 20;
export const MAX_HANDLERS_PER_ADDON = 20;

export type SignalScope = 'self' | 'addon' | 'broadcast';

export interface SignalEnvelope {
  name: string;
  /** Detached JSON; the sender cannot keep a reference into the receiver. */
  payload: unknown;
  /** Who sent it. Receivers should not trust this for anything privileged. */
  from: string;
  scope: SignalScope;
  depth: number;
  at: number;
}

export type SignalHandler = (signal: SignalEnvelope) => void;

export type SendFailure =
  | 'payload-too-large'
  | 'not-serializable'
  | 'depth-exceeded'
  | 'rate-limited'
  | 'bad-name';

export interface SendResult {
  delivered: number;
  failed?: SendFailure;
}

interface Registration {
  id: number;
  addonId: string;
  name: string;
  handler: SignalHandler;
}

const SAFE_NAME = /^[a-zA-Z0-9._:-]{1,80}$/;

export class AddonSignalBus {
  private registrations: Registration[] = [];
  private sequence = 0;
  private recentSends: number[] = [];
  /** Depth of the signal currently being delivered, per addon. */
  private depthByAddon = new Map<string, number>();

  on(addonId: string, name: string, handler: SignalHandler): () => void {
    if (!SAFE_NAME.test(name)) throw new Error('Signal name is invalid.');
    if (
      this.registrations.filter(entry => entry.addonId === addonId).length >=
      MAX_HANDLERS_PER_ADDON
    )
      throw new Error('Signal handler limit exceeded.');

    const registration: Registration = {
      id: ++this.sequence,
      addonId,
      name,
      handler,
    };
    this.registrations.push(registration);
    return () => {
      this.registrations = this.registrations.filter(
        entry => entry.id !== registration.id,
      );
    };
  }

  /**
   * Send a signal.
   *
   * `target` addresses one addon; without it the scope is `broadcast`, except
   * when the sender addresses itself. Handlers run synchronously and in
   * registration order, so a signal raised inside a handler is delivered before
   * the outer send returns — which is exactly why depth is counted.
   */
  send(
    fromAddonId: string,
    name: string,
    payload: unknown,
    target?: string,
    at: number = Date.now(),
  ): SendResult {
    if (!SAFE_NAME.test(name)) return { delivered: 0, failed: 'bad-name' };

    const depth = (this.depthByAddon.get(fromAddonId) ?? 0) + 1;
    if (depth > MAX_DEPTH) return { delivered: 0, failed: 'depth-exceeded' };

    this.recentSends = this.recentSends.filter(sent => at - sent < 1000);
    if (this.recentSends.length >= MAX_SIGNALS_PER_SECOND)
      return { delivered: 0, failed: 'rate-limited' };

    let detached: unknown;
    try {
      const json = JSON.stringify(payload ?? null);
      if (json === undefined)
        return { delivered: 0, failed: 'not-serializable' };
      if (json.length > MAX_PAYLOAD_BYTES)
        return { delivered: 0, failed: 'payload-too-large' };
      // Cloned through JSON so the sender keeps no reference into whatever the
      // receiver then does with it.
      detached = JSON.parse(json);
    } catch {
      return { delivered: 0, failed: 'not-serializable' };
    }

    this.recentSends.push(at);
    const scope: SignalScope =
      target === fromAddonId ? 'self' : target ? 'addon' : 'broadcast';

    const envelope: SignalEnvelope = {
      name,
      payload: detached,
      from: fromAddonId,
      scope,
      depth,
      at,
    };

    const recipients = this.registrations
      .filter(entry => entry.name === name)
      .filter(entry => (target ? entry.addonId === target : true))
      // A broadcast does not come back to its sender: an addon that handles
      // its own broadcast is the first half of every loop anyone writes.
      .filter(entry =>
        scope === 'broadcast' ? entry.addonId !== fromAddonId : true,
      )
      .sort((left, right) => left.id - right.id);

    let delivered = 0;
    for (const recipient of recipients) {
      const previous = this.depthByAddon.get(recipient.addonId) ?? 0;
      this.depthByAddon.set(recipient.addonId, depth);
      try {
        recipient.handler({ ...envelope, payload: clone(detached) });
        delivered += 1;
      } catch {
        // One addon throwing must not stop the others being told.
      } finally {
        if (previous === 0) this.depthByAddon.delete(recipient.addonId);
        else this.depthByAddon.set(recipient.addonId, previous);
      }
    }
    return { delivered };
  }

  clear(addonId: string): void {
    this.registrations = this.registrations.filter(
      entry => entry.addonId !== addonId,
    );
    this.depthByAddon.delete(addonId);
  }

  handlerCount(addonId?: string): number {
    return this.registrations.filter(
      entry => addonId === undefined || entry.addonId === addonId,
    ).length;
  }

  resetForTests(): void {
    this.registrations = [];
    this.sequence = 0;
    this.recentSends = [];
    this.depthByAddon.clear();
  }
}

function clone(value: unknown): unknown {
  return value === null || typeof value !== 'object'
    ? value
    : JSON.parse(JSON.stringify(value));
}

export const addonSignalBus = new AddonSignalBus();
