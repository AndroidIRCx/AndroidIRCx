/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { act, render } from '@testing-library/react-native';
import { TypingIndicator } from '../../src/components/TypingIndicator';

// Mock useTheme
jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#1a1a1a',
      border: '#333333',
      primary: '#0066cc',
      textSecondary: '#888888',
    },
  }),
}));

// Mock useT
jest.mock('../../src/i18n/transifex', () => ({
  useT: () => (key: string, params?: any) => {
    if (params) {
      return key
        .replace('{user}', params.user || '')
        .replace('{userA}', params.userA || '')
        .replace('{userB}', params.userB || '')
        .replace('{userC}', params.userC || '')
        .replace('{count}', params.count || '');
    }
    return key;
  },
}));

describe('TypingIndicator', () => {
  const createTypingMap = (
    entries: Array<
      [string, { status: 'active' | 'paused' | 'done'; timestamp: number }]
    >,
  ) => {
    return new Map(entries);
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('should return null when no typing users', () => {
    const typingUsers = createTypingMap([]);
    const { UNSAFE_root } = render(
      <TypingIndicator typingUsers={typingUsers} />,
    );
    expect(UNSAFE_root.children).toHaveLength(0);
  });

  it('should return null when all users are done typing', () => {
    const typingUsers = createTypingMap([
      ['user1', { status: 'done', timestamp: Date.now() }],
    ]);
    const { UNSAFE_root } = render(
      <TypingIndicator typingUsers={typingUsers} />,
    );
    expect(UNSAFE_root.children).toHaveLength(0);
  });

  it('should return null when all users are paused', () => {
    const typingUsers = createTypingMap([
      ['user1', { status: 'paused', timestamp: Date.now() }],
    ]);
    const { UNSAFE_root } = render(
      <TypingIndicator typingUsers={typingUsers} />,
    );
    expect(UNSAFE_root.children).toHaveLength(0);
  });

  it('should render for single typing user', () => {
    const typingUsers = createTypingMap([
      ['John', { status: 'active', timestamp: Date.now() }],
    ]);
    const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);
    expect(getByText('John is typing...')).toBeTruthy();
  });

  it('should render for two typing users', () => {
    const typingUsers = createTypingMap([
      ['John', { status: 'active', timestamp: Date.now() }],
      ['Jane', { status: 'active', timestamp: Date.now() }],
    ]);
    const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);
    expect(getByText('John and Jane are typing...')).toBeTruthy();
  });

  it('should render for three typing users', () => {
    const typingUsers = createTypingMap([
      ['John', { status: 'active', timestamp: Date.now() }],
      ['Jane', { status: 'active', timestamp: Date.now() }],
      ['Bob', { status: 'active', timestamp: Date.now() }],
    ]);
    const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);
    expect(getByText('John, Jane, and Bob are typing...')).toBeTruthy();
  });

  it('should render for four or more typing users', () => {
    const typingUsers = createTypingMap([
      ['John', { status: 'active', timestamp: Date.now() }],
      ['Jane', { status: 'active', timestamp: Date.now() }],
      ['Bob', { status: 'active', timestamp: Date.now() }],
      ['Alice', { status: 'active', timestamp: Date.now() }],
    ]);
    const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);
    expect(getByText('John, Jane, and 2 others are typing...')).toBeTruthy();
  });

  it('should render five typing users with correct count', () => {
    const typingUsers = createTypingMap([
      ['User1', { status: 'active', timestamp: Date.now() }],
      ['User2', { status: 'active', timestamp: Date.now() }],
      ['User3', { status: 'active', timestamp: Date.now() }],
      ['User4', { status: 'active', timestamp: Date.now() }],
      ['User5', { status: 'active', timestamp: Date.now() }],
    ]);
    const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);
    expect(getByText('User1, User2, and 3 others are typing...')).toBeTruthy();
  });

  it('should only show active typers ignoring paused ones', () => {
    const typingUsers = createTypingMap([
      ['John', { status: 'active', timestamp: Date.now() }],
      ['Jane', { status: 'paused', timestamp: Date.now() }],
      ['Bob', { status: 'done', timestamp: Date.now() }],
    ]);
    const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);
    expect(getByText('John is typing...')).toBeTruthy();
  });

  it('should render container View elements', () => {
    const typingUsers = createTypingMap([
      ['John', { status: 'active', timestamp: Date.now() }],
    ]);
    const { UNSAFE_getAllByType } = render(
      <TypingIndicator typingUsers={typingUsers} />,
    );
    const views = UNSAFE_getAllByType('View');
    expect(views.length).toBeGreaterThanOrEqual(1);
  });

  it('should render dots for typing indicator', () => {
    const typingUsers = createTypingMap([
      ['John', { status: 'active', timestamp: Date.now() }],
    ]);
    const { UNSAFE_getAllByType } = render(
      <TypingIndicator typingUsers={typingUsers} />,
    );
    // Get all View components (dots container + dots)
    const views = UNSAFE_getAllByType('View');
    expect(views.length).toBeGreaterThanOrEqual(4);
  });

  it('should apply correct styling to container', () => {
    const typingUsers = createTypingMap([
      ['John', { status: 'active', timestamp: Date.now() }],
    ]);
    const { UNSAFE_getAllByType } = render(
      <TypingIndicator typingUsers={typingUsers} />,
    );
    const views = UNSAFE_getAllByType('View');
    // The outermost view should have style applied
    expect(views[0].props.style).toBeDefined();
  });
});
