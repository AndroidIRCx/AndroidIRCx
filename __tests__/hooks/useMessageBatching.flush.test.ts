/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * useMessageBatching flush: one append per tab per flush, msgid dedup across
 * history and the batch itself, local echo reconciliation, and the tab cap.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useMessageBatching } from '../../src/hooks/useMessageBatching';

const mockConfig = {
  enableMessageCleanup: true,
  cleanupThreshold: 1500,
  messageLimit: 1000,
};

jest.mock('../../src/services/PerformanceService', () => ({
  performanceService: { getConfig: () => mockConfig },
}));
jest.mock('../../src/services/SoundService', () => ({
  soundService: { playSound: jest.fn() },
}));
jest.mock('../../src/services/MessageHistoryService', () => ({
  messageHistoryService: {
    saveMessage: jest.fn().mockResolvedValue(undefined),
    loadMessages: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../../src/services/BouncerService', () => ({
  bouncerService: {
    getConfig: jest.fn().mockReturnValue({ loadScrollbackOnJoin: false }),
  },
}));

const TAB = 'channel::net::#c';
const ctx = {
  targetTabId: TAB,
  targetTabType: 'channel',
  messageNetwork: 'net',
  newTabIsEncrypted: false,
  hasValidNetwork: true,
};

let seq = 0;
const msg = (extra: Record<string, unknown> = {}) => ({
  id: `m${++seq}`,
  type: 'message',
  from: 'alice',
  channel: '#c',
  text: `line ${seq}`,
  timestamp: 1_000_000 + seq,
  ...extra,
});

const run = async (existing: any[], incoming: any[]) => {
  const tabs = [
    {
      id: TAB,
      name: '#c',
      type: 'channel',
      networkId: 'net',
      messages: existing,
    },
  ];
  let result: any[] = tabs;
  const setTabs = jest.fn((updater: any) => {
    result = updater(result);
  });
  const pendingMessagesRef = {
    current: incoming.map(message => ({ message, context: ctx })),
  };
  const { result: hook } = await renderHook(() =>
    useMessageBatching({
      pendingMessagesRef: pendingMessagesRef as any,
      messageBatchTimeoutRef: { current: null },
      activeTabId: 'other',
      tabSortAlphabetical: false,
      setTabs,
    }),
  );
  await act(async () => {
    hook.current.processBatchedMessages();
  });
  return { tabs, result, setTabs };
};

describe('useMessageBatching flush', () => {
  beforeEach(() => {
    mockConfig.enableMessageCleanup = true;
  });

  it('appends a whole burst to a tab in one go, in order', async () => {
    const burst = Array.from({ length: 500 }, () => msg());
    const { result } = await run([msg()], burst);
    expect(result[0].messages).toHaveLength(501);
    expect(result[0].messages.slice(1)).toEqual(burst);
    expect(result[0].hasActivity).toBe(true);
  });

  it('drops msgid duplicates against history and within the batch', async () => {
    const old = msg({ msgid: 'a' });
    const { result } = await run(
      [old],
      [msg({ msgid: 'a' }), msg({ msgid: 'b' }), msg({ msgid: 'b' })],
    );
    expect(result[0].messages.map((m: any) => m.msgid)).toEqual(['a', 'b']);
  });

  it('keeps repeated lines without msgid that are not local echo', async () => {
    const line = { text: 'same', timestamp: 5 };
    const { result } = await run([msg(line)], [msg(line), msg(line)]);
    expect(result[0].messages).toHaveLength(3);
  });

  it('reconciles the server echo of a line the user just sent', async () => {
    const sent = msg({ text: 'hi', status: 'sent', timestamp: 10_000 });
    const { result } = await run(
      [sent],
      [msg({ text: 'hi', timestamp: 12_000 })],
    );
    expect(result[0].messages).toEqual([sent]);
  });

  it('returns the same tabs array when everything was a duplicate', async () => {
    const { tabs, result } = await run(
      [msg({ msgid: 'x' })],
      [msg({ msgid: 'x' })],
    );
    expect(result).toBe(tabs);
  });

  it('caps the tab once it passes the threshold', async () => {
    const existing = Array.from({ length: 1490 }, () => msg());
    const incoming = Array.from({ length: 20 }, () => msg());
    const { result } = await run(existing, incoming);
    expect(result[0].messages).toHaveLength(1000);
    expect(result[0].messages[999]).toBe(incoming[19]);
  });

  it('keeps everything when the cap is switched off', async () => {
    mockConfig.enableMessageCleanup = false;
    const existing = Array.from({ length: 1490 }, () => msg());
    const { result } = await run(
      existing,
      [msg(), msg(), msg()].concat(Array.from({ length: 17 }, () => msg())),
    );
    expect(result[0].messages).toHaveLength(1510);
  });
});
