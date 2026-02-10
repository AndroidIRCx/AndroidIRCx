/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * IRCv3.2 Batch and Labeled-Response protocol handler.
 * Manages activeBatches and pendingLabels state.
 */

import { tx } from '../../../i18n/transifex';
import type { IRCMessage } from '../../IRCService';

const t = (key: string, params?: Record<string, unknown>) => tx.t(key, params);

interface BatchState {
  type: string;
  params: string[];
  messages: IRCMessage[];
  startTime: number;
}

interface LabelState {
  command: string;
  timestamp: number;
  callback?: (response: any) => void;
}

export interface BatchLabelContext {
  addMessage: (message: any) => void;
  addRawMessage: (text: string, category: string) => void;
  emit: (event: string, ...args: any[]) => void;
  logRaw: (message: string) => void;
  sendRaw: (command: string) => void;
  hasCapability: (cap: string) => boolean;
}

export class BatchLabelManager {
  private activeBatches: Map<string, BatchState> = new Map();
  private pendingLabels: Map<string, LabelState> = new Map();
  private labelCounter: number = 0;
  private readonly LABEL_TIMEOUT = 30000;

  constructor(private ctx: BatchLabelContext) {}

  handleBatchStart(refTag: string, type: string, params: string[], timestamp: number): void {
    this.activeBatches.set(refTag, {
      type,
      params,
      messages: [],
      startTime: timestamp,
    });
  }

  handleBatchEnd(refTag: string, timestamp: number): void {
    const batch = this.activeBatches.get(refTag);
    if (!batch) return;
    this.processBatch(refTag, batch, timestamp);
    this.activeBatches.delete(refTag);
  }

  private processBatch(refTag: string, batch: BatchState, timestamp: number): void {
    const { type, params, messages } = batch;

    switch (type) {
      case 'netsplit': {
        const serverNames = params.join(' ');
        this.ctx.addMessage({
          type: 'raw',
          text: t('*** Netsplit detected: {servers} ({count} users quit)', {
            servers: serverNames,
            count: messages.length,
          }),
          timestamp,
          isRaw: true,
          rawCategory: 'server',
        });
        break;
      }
      case 'netjoin': {
        const serverNames = params.join(' ');
        this.ctx.addMessage({
          type: 'raw',
          text: t('*** Netjoin: {servers} ({count} users rejoined)', {
            servers: serverNames,
            count: messages.length,
          }),
          timestamp,
          isRaw: true,
          rawCategory: 'server',
        });
        break;
      }
      case 'chathistory':
        this.ctx.emit('chathistory-end', { refTag, messages: messages.length, params });
        break;
      case 'history':
        // IRCv3 event-playback batch type
        this.ctx.emit('event-playback', {
          refTag,
          messages: messages.length,
          params,
        });
        break;
      case 'znc.in/playback':
        // ZNC specific playback batch
        this.ctx.emit('bouncer-playback', {
          refTag,
          messages: messages.length,
          params,
        });
        break;
      case 'cap-notify':
        this.ctx.addRawMessage(
          t('*** Capability changes ({count} updates)', { count: messages.length }),
          'server'
        );
        break;
      default:
        this.ctx.addRawMessage(
          t('*** BATCH END: {type} ({ref}) - {count} messages', {
            type,
            ref: refTag,
            count: messages.length,
          }),
          'server'
        );
        break;
    }

    this.ctx.emit('batch-end', refTag, type, messages);
  }

  addMessageToBatch(message: IRCMessage, batchTag?: string): void {
    if (!batchTag) return;
    const batch = this.activeBatches.get(batchTag);
    if (batch) {
      batch.messages.push(message);
    }
  }

  private generateLabel(): string {
    this.labelCounter++;
    return `androidircx-${Date.now()}-${this.labelCounter}`;
  }

  sendRawWithLabel(command: string, callback?: (response: any) => void): string {
    if (!this.ctx.hasCapability('labeled-response')) {
      this.ctx.sendRaw(command);
      return '';
    }

    const label = this.generateLabel();
    this.pendingLabels.set(label, {
      command,
      timestamp: Date.now(),
      callback,
    });

    setTimeout(() => {
      if (this.pendingLabels.has(label)) {
        this.ctx.logRaw(`IRCService: Label timeout for ${label} (command: ${command})`);
        this.pendingLabels.delete(label);
        if (callback) {
          callback({ error: 'timeout', label, command });
        }
      }
    }, this.LABEL_TIMEOUT);

    this.ctx.sendRaw(`@label=${label} ${command}`);
    this.ctx.logRaw(`IRCService: Sent labeled command: ${command} (label: ${label})`);
    return label;
  }

  handleLabeledResponse(label: string, response: any): void {
    const pending = this.pendingLabels.get(label);
    if (!pending) {
      this.ctx.logRaw(`IRCService: Received response for unknown label: ${label}`);
      return;
    }

    this.ctx.logRaw(`IRCService: Matched labeled response: ${label} (command: ${pending.command})`);

    if (pending.callback) {
      pending.callback(response);
    }

    this.ctx.emit('labeled-response', label, pending.command, response);
    this.pendingLabels.delete(label);
  }

  cleanupLabels(): void {
    const count = this.pendingLabels.size;
    if (count > 0) {
      this.ctx.logRaw(`IRCService: Cleaning up ${count} pending labels`);
      this.pendingLabels.forEach((pending, label) => {
        if (pending.callback) {
          pending.callback({ error: 'disconnected', label, command: pending.command });
        }
      });
      this.pendingLabels.clear();
    }
  }

  /** Get active batches map (for backward compat) */
  getActiveBatches(): Map<string, BatchState> {
    return this.activeBatches;
  }
}
