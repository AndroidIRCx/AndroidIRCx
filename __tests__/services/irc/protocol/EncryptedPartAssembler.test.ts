/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  ENCRYPTED_PART_TIMEOUT_MS,
  EncryptedPartAssembler,
  MAX_ENCRYPTED_PARTS,
  newEncryptedPartId,
  readEncryptedPart,
} from '../../../../src/services/irc/protocol/EncryptedPartAssembler';

describe('readEncryptedPart', () => {
  it('accepts a well-formed part', () => {
    expect(readEncryptedPart({ part: { id: 'a1', i: 1, n: 3 } })).toEqual({
      id: 'a1',
      i: 1,
      n: 3,
    });
  });

  it.each([
    [null],
    [{}],
    [{ part: 'x' }],
    [{ part: { id: '', i: 0, n: 2 } }],
    [{ part: { id: 'x'.repeat(33), i: 0, n: 2 } }],
    [{ part: { id: 'a', i: 0, n: 1 } }],
    [{ part: { id: 'a', i: 0, n: MAX_ENCRYPTED_PARTS + 1 } }],
    [{ part: { id: 'a', i: 2, n: 2 } }],
    [{ part: { id: 'a', i: -1, n: 2 } }],
    [{ part: { id: 'a', i: 0.5, n: 2 } }],
    [{ part: { id: 7, i: 0, n: 2 } }],
  ])('refuses %j', payload => {
    expect(readEncryptedPart(payload)).toBeNull();
  });
});

describe('newEncryptedPartId', () => {
  it('makes short ids that differ', () => {
    const a = newEncryptedPartId();
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(8);
    expect(newEncryptedPartId()).not.toBe(a);
  });

  it('never returns an empty id', () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(newEncryptedPartId()).toBe('p');
    random.mockRestore();
  });
});

describe('EncryptedPartAssembler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('delivers the joined text once every piece is in, in any order', () => {
    const assembler = new EncryptedPartAssembler();
    const deliver = jest.fn();
    assembler.add('k', { id: 'm', i: 2, n: 3 }, 'c', deliver);
    assembler.add('k', { id: 'm', i: 0, n: 3 }, 'a ', deliver);
    expect(deliver).not.toHaveBeenCalled();
    // A repeated piece counts once.
    assembler.add('k', { id: 'm', i: 0, n: 3 }, 'a ', deliver);
    assembler.add('k', { id: 'm', i: 1, n: 3 }, 'b ', deliver);
    expect(deliver).toHaveBeenCalledWith('a b c');
    expect(assembler.size).toBe(0);
  });

  it('keeps messages of different senders and ids apart', () => {
    const assembler = new EncryptedPartAssembler();
    const one = jest.fn();
    const two = jest.fn();
    assembler.add('alice', { id: 'm', i: 0, n: 2 }, 'A0', one);
    assembler.add('bob', { id: 'm', i: 0, n: 2 }, 'B0', two);
    assembler.add('alice', { id: 'm', i: 1, n: 2 }, 'A1', one);
    expect(one).toHaveBeenCalledWith('A0A1');
    expect(two).not.toHaveBeenCalled();
    expect(assembler.size).toBe(1);
  });

  it('shows what arrived when the rest does not come in time', () => {
    const assembler = new EncryptedPartAssembler();
    const deliver = jest.fn();
    assembler.add('k', { id: 'm', i: 0, n: 3 }, 'first ', deliver);
    assembler.add('k', { id: 'm', i: 2, n: 3 }, 'third', deliver);
    jest.advanceTimersByTime(ENCRYPTED_PART_TIMEOUT_MS);
    expect(deliver).toHaveBeenCalledWith('first third');
    expect(assembler.size).toBe(0);
  });

  it('starts over when the same id comes with another piece count', () => {
    const assembler = new EncryptedPartAssembler();
    const deliver = jest.fn();
    assembler.add('k', { id: 'm', i: 0, n: 3 }, 'x', deliver);
    assembler.add('k', { id: 'm', i: 0, n: 2 }, 'y', deliver);
    assembler.add('k', { id: 'm', i: 1, n: 2 }, 'z', deliver);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith('yz');
    jest.advanceTimersByTime(ENCRYPTED_PART_TIMEOUT_MS);
    expect(deliver).toHaveBeenCalledTimes(1);
  });
});
