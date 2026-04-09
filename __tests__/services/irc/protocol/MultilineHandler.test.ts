/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MultilineHandler } from '../../../../src/services/irc/protocol/MultilineHandler';

describe('MultilineHandler', () => {
  const tags = { timestamp: 1234567890 };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns plain text immediately when concat tag is absent', () => {
    const handler = new MultilineHandler();

    expect(
      handler.handleMultilineMessage(
        'alice',
        '#chan',
        'hello',
        undefined,
        tags,
      ),
    ).toBe('hello');
  });

  it('buffers intermediate parts and joins them when the last part arrives', () => {
    const handler = new MultilineHandler();

    expect(
      handler.handleMultilineMessage('alice', '#chan', 'line 1', 'next', tags),
    ).toBeNull();
    expect(
      handler.handleMultilineMessage('alice', '#chan', 'line 2', 'next', tags),
    ).toBeNull();
    expect(
      handler.handleMultilineMessage('alice', '#chan', 'line 3', '', tags),
    ).toBe('line 1\nline 2\nline 3');
  });

  it('keeps sender and target buffers isolated', () => {
    const handler = new MultilineHandler();

    expect(
      handler.handleMultilineMessage('alice', '#chan', 'alice 1', 'next', tags),
    ).toBeNull();
    expect(
      handler.handleMultilineMessage('bob', '#chan', 'bob 1', 'next', tags),
    ).toBeNull();

    expect(
      handler.handleMultilineMessage('alice', '#chan', 'alice 2', '', tags),
    ).toBe('alice 1\nalice 2');
    expect(
      handler.handleMultilineMessage('bob', '#chan', 'bob 2', '', tags),
    ).toBe('bob 1\nbob 2');
  });

  it('drops expired buffers before handling a new message', () => {
    const handler = new MultilineHandler();
    const nowSpy = jest.spyOn(Date, 'now');

    nowSpy.mockReturnValueOnce(1000);
    expect(
      handler.handleMultilineMessage('alice', '#chan', 'stale 1', 'next', tags),
    ).toBeNull();

    nowSpy.mockReturnValueOnce(7001);
    expect(
      handler.handleMultilineMessage('bob', '#chan', 'fresh 1', 'next', tags),
    ).toBeNull();

    nowSpy.mockReturnValueOnce(7002);
    expect(
      handler.handleMultilineMessage('alice', '#chan', 'fresh 2', '', tags),
    ).toBe('fresh 2');
  });

  it('clears the buffer after completion so the next multiline starts fresh', () => {
    const handler = new MultilineHandler();

    expect(
      handler.handleMultilineMessage('alice', '#chan', 'first', 'next', tags),
    ).toBeNull();
    expect(
      handler.handleMultilineMessage('alice', '#chan', 'done', '', tags),
    ).toBe('first\ndone');

    expect(
      handler.handleMultilineMessage('alice', '#chan', 'new message', '', tags),
    ).toBe('new message');
  });
});
