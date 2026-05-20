/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as RNIap from 'react-native-iap';

type IapModule = Pick<typeof RNIap, 'initConnection' | 'endConnection'>;

export interface IapConnectionLease {
  release: () => Promise<void>;
}

export class IapConnectionService {
  private ownerCount = 0;
  private connected = false;
  private connecting: Promise<void> | null = null;
  private disconnecting: Promise<void> | null = null;

  constructor(private readonly iapModule: IapModule = RNIap) {}

  async acquire(): Promise<IapConnectionLease> {
    this.ownerCount += 1;

    try {
      await this.ensureConnected();
    } catch (error) {
      this.ownerCount = Math.max(0, this.ownerCount - 1);
      throw error;
    }

    let released = false;
    return {
      release: async () => {
        if (released) {
          return;
        }
        released = true;
        await this.release();
      },
    };
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.connecting) {
      await this.connecting;
      return;
    }

    this.connecting = (async () => {
      if (this.disconnecting) {
        await this.disconnecting;
      }

      const result = await this.iapModule.initConnection();
      if (result === false) {
        throw new Error('Failed to initialize IAP connection');
      }

      this.connected = true;
    })().finally(() => {
      this.connecting = null;
    });

    await this.connecting;
  }

  private async release(): Promise<void> {
    this.ownerCount = Math.max(0, this.ownerCount - 1);
    if (this.ownerCount > 0) {
      return;
    }

    if (this.connecting) {
      try {
        await this.connecting;
      } catch {
        return;
      }
    }

    if (this.ownerCount > 0 || !this.connected) {
      return;
    }

    if (this.disconnecting) {
      await this.disconnecting;
      return;
    }

    this.connected = false;
    this.disconnecting = (async () => {
      try {
        await this.iapModule.endConnection();
      } catch (error) {
        console.warn('Failed to end IAP connection:', error);
      }
    })().finally(() => {
      this.disconnecting = null;
    });

    await this.disconnecting;
  }
}

export const iapConnectionService = new IapConnectionService();
