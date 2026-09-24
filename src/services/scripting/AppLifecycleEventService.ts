/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

export type AddonAppState = 'active' | 'background' | 'inactive';

type Listener = (state: AddonAppState) => void;

/** Small dependency-free bridge from the React app lifecycle to scripting. */
class AppLifecycleEventService {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(state: AddonAppState): void {
    this.listeners.forEach(listener => listener(state));
  }
}

export const appLifecycleEventService = new AppLifecycleEventService();
