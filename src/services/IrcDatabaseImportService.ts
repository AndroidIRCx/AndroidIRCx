/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IRCNetworkConfig, IRCServerConfig, settingsService } from './SettingsService';

const IRC_DATABASE_PRESETS_URL = 'https://irc.dbase.in.rs/api/irc/server-presets';
const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const LAST_IMPORT_SETTING_KEY = 'ircDbLastImportAt';

interface IrcDatabaseApiServer {
  hostname?: unknown;
  port?: unknown;
  use_ssl?: unknown;
}

interface IrcDatabaseApiNetwork {
  network_name?: unknown;
  server_list?: unknown;
}

interface IrcDatabaseApiResponse {
  meta?: {
    pagination?: {
      has_more_pages?: unknown;
      next_page_url?: unknown;
    };
  };
  data?: unknown;
}

export interface IrcDatabaseImportSummary {
  totalApiNetworks: number;
  importedNetworks: number;
  importedServers: number;
  mergedNetworks: number;
  mergedServers: number;
  skippedExistingNetworks: number;
  skippedInvalidNetworks: number;
  skippedInvalidServers: number;
  failedPersistNetworks: number;
}

const DEFAULT_IDENTITY = {
  nick: 'AndroidIRCX',
  altNick: 'AndroidIRCX_',
  realname: 'AndroidIRCX User',
  ident: 'androidircx',
};

const normalizeName = (value: string): string => value.trim().toLowerCase();

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'network';

const sanitizeServerIdPart = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'server';

const buildServerKey = (server: Pick<IRCServerConfig, 'hostname' | 'port' | 'ssl'>): string =>
  `${server.hostname.trim().toLowerCase()}|${server.port}|${server.ssl ? '1' : '0'}`;

const isValidHostname = (value: string): boolean => {
  const host = value.trim();
  if (!host || host.length > 253) return false;
  if (/\s/.test(host)) return false;
  return true;
};

const toPort = (value: unknown): number | null => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : NaN;
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > 65535) return null;
  return parsed;
};

class IrcDatabaseImportService {
  async importFromIrcDatabase(
    fetchImpl: typeof fetch = fetch,
    options?: { timeoutMs?: number }
  ): Promise<IrcDatabaseImportSummary> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    const apiNetworks = await this.fetchAllNetworkRecords(fetchImpl, timeoutMs);

    const existingNetworks = await settingsService.loadNetworks();
    const existingNames = new Set(existingNetworks.map(n => normalizeName(n.name)));
    const existingIds = new Set(existingNetworks.map(n => normalizeName(n.id)));
    const usedIds = new Set(existingNetworks.map(n => normalizeName(n.id)));
    const existingByName = new Map(existingNetworks.map(n => [normalizeName(n.name), n]));
    const existingById = new Map(existingNetworks.map(n => [normalizeName(n.id), n]));

    const summary: IrcDatabaseImportSummary = {
      totalApiNetworks: apiNetworks.length,
      importedNetworks: 0,
      importedServers: 0,
      mergedNetworks: 0,
      mergedServers: 0,
      skippedExistingNetworks: 0,
      skippedInvalidNetworks: 0,
      skippedInvalidServers: 0,
      failedPersistNetworks: 0,
    };

    for (const networkRecord of apiNetworks) {
      const mapped = this.mapNetworkRecord(networkRecord, usedIds);
      summary.skippedInvalidServers += mapped.skippedInvalidServers;

      if (!mapped.network) {
        summary.skippedInvalidNetworks += 1;
        continue;
      }

      const networkNameKey = normalizeName(mapped.network.name);
      const networkIdKey = normalizeName(mapped.network.id);

      const alreadyExists = existingNames.has(networkNameKey) || existingIds.has(networkIdKey);
      if (alreadyExists) {
        const existing = existingByName.get(networkNameKey) || existingById.get(networkIdKey);
        if (!existing) {
          summary.skippedExistingNetworks += 1;
          continue;
        }

        const mergeResult = this.mergeMissingServers(existing, mapped.network.servers);
        if (mergeResult.missingServers.length === 0) {
          summary.skippedExistingNetworks += 1;
          continue;
        }

        try {
          const updatedServers = [...(existing.servers || []), ...mergeResult.missingServers];
          await settingsService.updateNetwork(existing.id, {
            servers: updatedServers,
            defaultServerId: existing.defaultServerId || updatedServers[0]?.id,
          });
          const updatedExisting = {
            ...existing,
            servers: updatedServers,
            defaultServerId: existing.defaultServerId || updatedServers[0]?.id,
          };
          existingByName.set(networkNameKey, updatedExisting);
          existingById.set(normalizeName(existing.id), updatedExisting);
          summary.mergedNetworks += 1;
          summary.mergedServers += mergeResult.missingServers.length;
        } catch {
          summary.failedPersistNetworks += 1;
        }
        continue;
      }

      try {
        await settingsService.addNetwork(mapped.network);
        summary.importedNetworks += 1;
        summary.importedServers += mapped.network.servers.length;
        existingNames.add(networkNameKey);
        existingIds.add(networkIdKey);
        existingByName.set(networkNameKey, mapped.network);
        existingById.set(networkIdKey, mapped.network);
      } catch {
        summary.failedPersistNetworks += 1;
      }
    }

    try {
      await settingsService.setSetting(LAST_IMPORT_SETTING_KEY, new Date().toISOString());
    } catch {
      // Timestamp write failure should not fail import itself.
    }

    return summary;
  }

  private async fetchAllNetworkRecords(
    fetchImpl: typeof fetch,
    timeoutMs: number
  ): Promise<IrcDatabaseApiNetwork[]> {
    const collected: IrcDatabaseApiNetwork[] = [];
    let nextUrl: string | null = IRC_DATABASE_PRESETS_URL;
    let pageGuard = 0;

    while (nextUrl) {
      pageGuard += 1;
      if (pageGuard > 30) {
        throw new Error('IRC Database pagination limit reached');
      }

      const response = await this.fetchWithTimeout(fetchImpl, nextUrl, timeoutMs);
      if (!response.ok) {
        throw new Error(`IRC Database request failed (${response.status})`);
      }

      const json = (await response.json()) as IrcDatabaseApiResponse;
      const pageData = Array.isArray(json?.data) ? (json.data as IrcDatabaseApiNetwork[]) : null;
      if (!pageData) {
        throw new Error('Invalid IRC Database response format');
      }
      collected.push(...pageData);

      const hasMore = Boolean(json?.meta?.pagination?.has_more_pages);
      const nextPageUrlRaw = json?.meta?.pagination?.next_page_url;
      const nextPageUrl = typeof nextPageUrlRaw === 'string' ? nextPageUrlRaw.trim() : '';
      nextUrl = hasMore && nextPageUrl ? nextPageUrl : null;
    }

    return collected;
  }

  private async fetchWithTimeout(
    fetchImpl: typeof fetch,
    url: string,
    timeoutMs: number
  ): Promise<Response> {
    const abortController =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const timeoutPromise = new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => {
          if (abortController) {
            abortController.abort();
          }
          reject(new Error(`IRC Database request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      const fetchPromise = abortController
        ? fetchImpl(url, { signal: abortController.signal } as any)
        : fetchImpl(url);
      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(`IRC Database request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private mapNetworkRecord(
    record: IrcDatabaseApiNetwork,
    usedIds: Set<string>
  ): { network: IRCNetworkConfig | null; skippedInvalidServers: number } {
    const networkName = typeof record?.network_name === 'string' ? record.network_name.trim() : '';
    if (!networkName) {
      return { network: null, skippedInvalidServers: 0 };
    }

    const rawServers = Array.isArray(record?.server_list)
      ? (record.server_list as IrcDatabaseApiServer[])
      : [];
    if (rawServers.length === 0) {
      return { network: null, skippedInvalidServers: 0 };
    }

    const uniqueNetworkId = this.buildUniqueNetworkId(networkName, usedIds);
    const mappedServers: IRCServerConfig[] = [];
    const seenServerKeys = new Set<string>();
    let skippedInvalidServers = 0;

    for (const serverRecord of rawServers) {
      const mapped = this.mapServerRecord(serverRecord, uniqueNetworkId, seenServerKeys);
      if (!mapped) {
        skippedInvalidServers += 1;
        continue;
      }
      mappedServers.push(mapped);
    }

    if (mappedServers.length === 0) {
      return { network: null, skippedInvalidServers };
    }

    return {
      network: {
        id: uniqueNetworkId,
        name: networkName,
        nick: DEFAULT_IDENTITY.nick,
        altNick: DEFAULT_IDENTITY.altNick,
        realname: DEFAULT_IDENTITY.realname,
        ident: DEFAULT_IDENTITY.ident,
        servers: mappedServers,
        defaultServerId: mappedServers[0]?.id,
        autoJoinChannels: [],
      },
      skippedInvalidServers,
    };
  }

  private buildUniqueNetworkId(networkName: string, usedIds: Set<string>): string {
    const base = `ircdb-${slugify(networkName)}`;
    let candidate = base;
    let suffix = 2;
    while (usedIds.has(normalizeName(candidate))) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(normalizeName(candidate));
    return candidate;
  }

  private mapServerRecord(
    record: IrcDatabaseApiServer,
    networkId: string,
    seenServerKeys: Set<string>
  ): IRCServerConfig | null {
    const hostname = typeof record?.hostname === 'string' ? record.hostname.trim() : '';
    const port = toPort(record?.port);
    if (!isValidHostname(hostname) || port === null) {
      return null;
    }

    const ssl = Boolean(record?.use_ssl);
    const dedupeKey = `${hostname.toLowerCase()}|${port}|${ssl ? '1' : '0'}`;
    if (seenServerKeys.has(dedupeKey)) {
      return null;
    }
    seenServerKeys.add(dedupeKey);

    return {
      id: `${networkId}-${sanitizeServerIdPart(hostname)}-${port}${ssl ? '-ssl' : ''}`,
      hostname,
      port,
      ssl,
      rejectUnauthorized: true,
      name: hostname,
      favorite: false,
    };
  }

  private mergeMissingServers(
    existingNetwork: IRCNetworkConfig,
    candidateServers: IRCServerConfig[]
  ): { missingServers: IRCServerConfig[] } {
    const existingServerKeys = new Set((existingNetwork.servers || []).map(buildServerKey));
    const existingServerIds = new Set((existingNetwork.servers || []).map(s => s.id));
    const missingServers: IRCServerConfig[] = [];

    for (const server of candidateServers) {
      const key = buildServerKey(server);
      if (existingServerKeys.has(key)) {
        continue;
      }
      existingServerKeys.add(key);
      missingServers.push({
        ...server,
        id: this.buildUniqueServerId(existingNetwork.id, server, existingServerIds),
      });
    }

    return { missingServers };
  }

  private buildUniqueServerId(
    networkId: string,
    server: Pick<IRCServerConfig, 'hostname' | 'port' | 'ssl'>,
    existingServerIds: Set<string>
  ): string {
    const base = `${networkId}-${sanitizeServerIdPart(server.hostname)}-${server.port}${server.ssl ? '-ssl' : ''}`;
    let candidate = base;
    let suffix = 2;
    while (existingServerIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    existingServerIds.add(candidate);
    return candidate;
  }
}

export const ircDatabaseImportService = new IrcDatabaseImportService();
