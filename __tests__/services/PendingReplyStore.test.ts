/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  getAndClearPendingReply,
  getPendingReply,
  setPendingReply,
  subscribePendingReply,
} from '../../src/services/PendingReplyStore';

describe('PendingReplyStore', () => {
  afterEach(() => setPendingReply(null));

  it('tells listeners when the reply is set, used or cleared', () => {
    const seen: any[] = [];
    const unsubscribe = subscribePendingReply(reply => seen.push(reply));
    const reply = { msgid: 'm1', target: '#c', nick: 'alice' };
    setPendingReply(reply);
    expect(getPendingReply()).toBe(reply);
    expect(getAndClearPendingReply()).toBe(reply);
    expect(getPendingReply()).toBeNull();
    // Nothing pending: nothing to announce.
    expect(getAndClearPendingReply()).toBeNull();
    unsubscribe();
    setPendingReply(reply);
    expect(seen).toEqual([reply, null]);
  });
});
