/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorageService } from './SecureStorageService';
import { tx } from '../i18n/transifex';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

export interface IdentityProfile {
  id: string;
  name: string;
  nick: string;
  altNick?: string;
  realname?: string;
  ident?: string;
  saslAccount?: string;
  saslPassword?: string;
  saslMechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-256-PLUS';
  nickservPassword?: string;
  operUser?: string;
  operPassword?: string;
  onConnectCommands?: string[];
}

const STORAGE_KEY = '@AndroidIRCX:identityProfiles';
export const DEFAULT_PROFILE_ID = 'androidircx-default-profile';
export const DEFAULT_PROFILE: IdentityProfile = {
  id: DEFAULT_PROFILE_ID,
  name: 'AndroidIRCX',
  nick: 'AndroidIRCX',
  altNick: 'AndroidIRCX_',
  realname: 'AndroidIRCX User',
  ident: 'androidircx',
};

class IdentityProfilesService {
  private profiles: IdentityProfile[] = [];
  private initialized = false;

  private async ensureLoaded() {
    if (this.initialized) return;
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        this.profiles = JSON.parse(data);
        let migratedSecrets = false;
        for (let i = 0; i < this.profiles.length; i++) {
          const profile = this.profiles[i];
          const hadSecret = Boolean(profile.saslPassword || profile.nickservPassword || profile.operPassword);
          if (hadSecret) {
            await this.persistSecrets(profile);
            this.profiles[i] = {
              ...profile,
              saslPassword: undefined,
              nickservPassword: undefined,
              operPassword: undefined,
            };
            migratedSecrets = true;
          }
        }
        if (migratedSecrets) {
          await this.persist();
        }
        await this.applySecrets();
      }
    } catch (e) {
      this.profiles = [DEFAULT_PROFILE];
      await this.persist();
    } finally {
      this.initialized = true;
    }
  }

  private async persist() {
    const sanitized = this.profiles.map(p => ({
      ...p,
      saslPassword: undefined,
      nickservPassword: undefined,
      operPassword: undefined,
    }));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  }

  private async persistSecrets(profile: IdentityProfile): Promise<void> {
    const key = (suffix: string) => `identity:${profile.id}:${suffix}`;
    if (profile.saslPassword !== undefined) {
      await secureStorageService.setSecret(key('saslPassword'), profile.saslPassword);
    }
    if (profile.nickservPassword !== undefined) {
      await secureStorageService.setSecret(key('nickservPassword'), profile.nickservPassword);
    }
    if (profile.operPassword !== undefined) {
      await secureStorageService.setSecret(key('operPassword'), profile.operPassword);
    }
  }

  private async applySecrets(): Promise<void> {
    for (let i = 0; i < this.profiles.length; i++) {
      const profile = this.profiles[i];
      const key = (suffix: string) => `identity:${profile.id}:${suffix}`;
      const [saslPassword, nickservPassword, operPassword] = await Promise.all([
        secureStorageService.getSecret(key('saslPassword')),
        secureStorageService.getSecret(key('nickservPassword')),
        secureStorageService.getSecret(key('operPassword')),
      ]);
      this.profiles[i] = {
        ...profile,
        saslPassword: saslPassword || undefined,
        nickservPassword: nickservPassword || undefined,
        operPassword: operPassword || undefined,
      };
    }
  }

  async list(): Promise<IdentityProfile[]> {
    await this.ensureLoaded();
    return [...this.profiles];
  }

  async get(id: string): Promise<IdentityProfile | undefined> {
    await this.ensureLoaded();
    return this.profiles.find(p => p.id === id);
  }

  async getDefaultProfile(): Promise<IdentityProfile> {
    await this.ensureLoaded();
    const existing = this.profiles.find(p => p.id === DEFAULT_PROFILE_ID);
    if (existing) return existing;
    // Fallback to first available profile
    if (this.profiles.length > 0) {
      return this.profiles[0];
    }
    // Last resort for empty storage (in-memory fallback only)
    return DEFAULT_PROFILE;
  }

  async add(profile: Omit<IdentityProfile, 'id'>): Promise<IdentityProfile> {
    await this.ensureLoaded();
    const newProfile: IdentityProfile = { ...profile, id: `id-${Date.now()}-${Math.random()}` };
    this.profiles.push(newProfile);
    await this.persist();
    await this.persistSecrets(newProfile);
    return newProfile;
  }

  async update(id: string, updates: Partial<Omit<IdentityProfile, 'id'>>): Promise<void> {
    await this.ensureLoaded();
    const index = this.profiles.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(t('Profile with id {id} not found', { id }));
    }
    this.profiles[index] = { ...this.profiles[index], ...updates };
    await this.persist();
    await this.persistSecrets(this.profiles[index]);
  }

  async remove(id: string): Promise<void> {
    await this.ensureLoaded();
    const profile = this.profiles.find(p => p.id === id);
    this.profiles = this.profiles.filter(p => p.id !== id);
    await this.persist();
    if (profile) {
      await this.clearSecrets(profile);
    }
  }

  private async clearSecrets(profile: IdentityProfile): Promise<void> {
    const key = (suffix: string) => `identity:${profile.id}:${suffix}`;
    await Promise.all([
      secureStorageService.removeSecret(key('saslPassword')),
      secureStorageService.removeSecret(key('nickservPassword')),
      secureStorageService.removeSecret(key('operPassword')),
    ]);
  }

  /**
   * Re-initialize the service by clearing the cache and reloading from storage.
   * This is useful after restoring from backup.
   */
  async reload(): Promise<void> {
    this.initialized = false;
    this.profiles = [];
    await this.ensureLoaded();
  }
}

export const identityProfilesService = new IdentityProfilesService();
