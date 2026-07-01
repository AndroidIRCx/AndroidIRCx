/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type IRCv3CapabilityStatus =
  'supported' | 'partial' | 'planned' | 'deferred' | 'deprecated';

export type IRCv3CapabilityRequestPolicy =
  'always' | 'with-sasl-config' | 'manual' | 'never';

export interface IRCv3CapabilityDefinition {
  name: string;
  status: IRCv3CapabilityStatus;
  requestPolicy: IRCv3CapabilityRequestPolicy;
  dependsOn?: string[];
  notes?: string;
}

export interface CapabilitySelectionConfig {
  sasl?: {
    account?: string;
    password?: string;
    force?: boolean;
  };
  clientCert?: string;
  clientKey?: string;
  preAway?: boolean | string;
}

export const IRCV3_CAPABILITY_DEFINITIONS: IRCv3CapabilityDefinition[] = [
  { name: 'server-time', status: 'supported', requestPolicy: 'always' },
  { name: 'account-notify', status: 'supported', requestPolicy: 'always' },
  { name: 'extended-join', status: 'supported', requestPolicy: 'always' },
  { name: 'userhost-in-names', status: 'supported', requestPolicy: 'always' },
  { name: 'away-notify', status: 'supported', requestPolicy: 'always' },
  { name: 'chghost', status: 'supported', requestPolicy: 'always' },
  { name: 'message-tags', status: 'partial', requestPolicy: 'always' },
  { name: 'typing', status: 'partial', requestPolicy: 'always' },
  { name: 'draft/typing', status: 'partial', requestPolicy: 'always' },
  { name: 'batch', status: 'supported', requestPolicy: 'always' },
  { name: 'labeled-response', status: 'supported', requestPolicy: 'always' },
  { name: 'echo-message', status: 'partial', requestPolicy: 'always' },
  { name: 'multi-prefix', status: 'supported', requestPolicy: 'always' },
  { name: 'invite-notify', status: 'partial', requestPolicy: 'always' },
  { name: 'monitor', status: 'supported', requestPolicy: 'always' },
  { name: 'extended-monitor', status: 'supported', requestPolicy: 'always' },
  { name: 'cap-notify', status: 'supported', requestPolicy: 'always' },
  { name: 'account-tag', status: 'supported', requestPolicy: 'always' },
  { name: 'setname', status: 'supported', requestPolicy: 'always' },
  { name: 'standard-replies', status: 'supported', requestPolicy: 'always' },
  { name: 'message-ids', status: 'supported', requestPolicy: 'always' },
  { name: 'bot', status: 'partial', requestPolicy: 'always' },
  { name: 'utf8only', status: 'partial', requestPolicy: 'always' },
  { name: 'chathistory', status: 'partial', requestPolicy: 'always' },
  { name: 'draft/chathistory', status: 'partial', requestPolicy: 'always' },
  {
    name: 'draft/chathistory-context',
    status: 'planned',
    requestPolicy: 'always',
  },
  { name: 'draft/multiline', status: 'supported', requestPolicy: 'always' },
  { name: 'draft/read-marker', status: 'supported', requestPolicy: 'always' },
  {
    name: 'draft/message-redaction',
    status: 'supported',
    requestPolicy: 'always',
    dependsOn: ['message-ids'],
  },
  { name: 'event-playback', status: 'partial', requestPolicy: 'always' },
  {
    name: 'draft/account-registration',
    status: 'supported',
    requestPolicy: 'always',
  },
  {
    name: 'draft/channel-rename',
    status: 'supported',
    requestPolicy: 'always',
  },
  {
    name: 'draft/metadata-2',
    status: 'partial',
    requestPolicy: 'always',
    dependsOn: ['batch', 'standard-replies'],
  },
  { name: 'no-implicit-names', status: 'supported', requestPolicy: 'always' },
  { name: 'draft/pre-away', status: 'partial', requestPolicy: 'manual' },
  {
    name: 'draft/extended-isupport',
    status: 'supported',
    requestPolicy: 'always',
    dependsOn: ['batch'],
  },
  { name: 'sts', status: 'supported', requestPolicy: 'always' },
  { name: 'sasl', status: 'supported', requestPolicy: 'with-sasl-config' },
  {
    name: 'tls',
    status: 'deprecated',
    requestPolicy: 'never',
    notes: 'Deprecated STARTTLS extension; implicit TLS plus STS is preferred.',
  },
];

export const IRCV3_CAPABILITY_REGISTRY = new Map(
  IRCV3_CAPABILITY_DEFINITIONS.map(definition => [definition.name, definition]),
);

export function getDefaultRequestedCapabilities(): string[] {
  return IRCV3_CAPABILITY_DEFINITIONS.filter(
    definition => definition.requestPolicy === 'always',
  ).map(definition => definition.name);
}

export function shouldRequestSasl(
  availableCaps: Set<string>,
  config?: CapabilitySelectionConfig | null,
): boolean {
  const hasSaslConfig = !!(config?.sasl?.account && config?.sasl?.password);
  const hasCert = !!(config?.clientCert && config?.clientKey);
  const forceSASL = config?.sasl?.force === true;
  return (hasSaslConfig || hasCert) && (availableCaps.has('sasl') || forceSASL);
}

export function selectCapabilitiesToRequest(
  availableCaps: Set<string>,
  config?: CapabilitySelectionConfig | null,
): string[] {
  const requested = getDefaultRequestedCapabilities().filter(cap =>
    availableCaps.has(cap),
  );

  if (shouldRequestSasl(availableCaps, config)) {
    requested.push('sasl');
  }
  if (config?.preAway && availableCaps.has('draft/pre-away')) {
    requested.push('draft/pre-away');
  }

  return Array.from(new Set(requested));
}

export function splitCapabilityRequestBatches(
  caps: string[],
  maxLineLength: number = 480,
): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];

  caps.forEach(cap => {
    const candidate = [...current, cap];
    const line = `CAP REQ :${candidate.join(' ')}`;
    if (current.length > 0 && line.length > maxLineLength) {
      batches.push(current);
      current = [cap];
    } else {
      current = candidate;
    }
  });

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}
