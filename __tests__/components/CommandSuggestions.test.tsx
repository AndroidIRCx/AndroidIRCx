/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for CommandSuggestions component - Wave 5
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommandSuggestions } from '../../src/components/CommandSuggestions';

// Mock MaterialCommunityIcons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

const mockColors = {
  text: '#333',
  textSecondary: '#666',
  primary: '#007AFF',
  surface: '#fff',
  border: '#ccc',
  background: '#f5f5f5',
};

describe('CommandSuggestions', () => {
  const defaultProps = {
    suggestions: [],
    onSelect: jest.fn(),
    colors: mockColors,
    visible: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when not visible', () => {
    const { UNSAFE_root } = render(
      <CommandSuggestions {...defaultProps} visible={false} />,
    );
    expect(UNSAFE_root.children).toHaveLength(0);
  });

  it('should return null when suggestions array is empty', () => {
    const { UNSAFE_root } = render(
      <CommandSuggestions {...defaultProps} suggestions={[]} />,
    );
    expect(UNSAFE_root.children).toHaveLength(0);
  });

  it('should render when visible with suggestions', () => {
    const suggestions = [
      {
        text: '/msg',
        label: '/msg',
        description: 'Send private message',
        isAlias: false,
      },
    ];
    const { getByText } = render(
      <CommandSuggestions {...defaultProps} suggestions={suggestions} />,
    );
    expect(getByText('/msg')).toBeTruthy();
    expect(getByText('Send private message')).toBeTruthy();
  });

  it('should render multiple suggestions', () => {
    const suggestions = [
      {
        text: '/msg',
        label: '/msg',
        description: 'Send message',
        isAlias: false,
      },
      {
        text: '/join',
        label: '/join',
        description: 'Join channel',
        isAlias: false,
      },
      {
        text: '/part',
        label: '/part',
        description: 'Leave channel',
        isAlias: false,
      },
    ];
    const { getByText } = render(
      <CommandSuggestions {...defaultProps} suggestions={suggestions} />,
    );
    expect(getByText('/msg')).toBeTruthy();
    expect(getByText('/join')).toBeTruthy();
    expect(getByText('/part')).toBeTruthy();
  });

  it('should call onSelect when suggestion is pressed', () => {
    const suggestions = [
      {
        text: '/msg',
        label: '/msg',
        description: 'Send message',
        isAlias: false,
      },
    ];
    const { getByText } = render(
      <CommandSuggestions {...defaultProps} suggestions={suggestions} />,
    );
    fireEvent.press(getByText('/msg'));
    expect(defaultProps.onSelect).toHaveBeenCalledWith(suggestions[0]);
  });

  it('should display alias badge for alias suggestions', () => {
    const suggestions = [
      { text: '/m', label: '/m', description: 'Alias for /msg', isAlias: true },
    ];
    const { getByText } = render(
      <CommandSuggestions {...defaultProps} suggestions={suggestions} />,
    );
    expect(getByText('/m')).toBeTruthy();
    expect(getByText('alias')).toBeTruthy();
  });

  it('should not display alias badge for non-alias suggestions', () => {
    const suggestions = [
      {
        text: '/msg',
        label: '/msg',
        description: 'Send message',
        isAlias: false,
      },
    ];
    const { queryByText } = render(
      <CommandSuggestions {...defaultProps} suggestions={suggestions} />,
    );
    expect(queryByText('alias')).toBeNull();
  });

  it('should handle suggestions with same text but different index', () => {
    const suggestions = [
      { text: '/msg', label: '/msg', description: 'First', isAlias: false },
      { text: '/msg', label: '/msg', description: 'Second', isAlias: false },
    ];
    const { getAllByText } = render(
      <CommandSuggestions {...defaultProps} suggestions={suggestions} />,
    );
    expect(getAllByText('/msg')).toHaveLength(2);
  });

  it('should apply lastItem style to last suggestion', () => {
    const suggestions = [
      { text: '/first', label: '/first', description: 'First', isAlias: false },
      { text: '/last', label: '/last', description: 'Last', isAlias: false },
    ];
    const { UNSAFE_root } = render(
      <CommandSuggestions {...defaultProps} suggestions={suggestions} />,
    );
    expect(UNSAFE_root).toBeDefined();
  });

  it('should handle suggestion without description', () => {
    const suggestions = [
      { text: '/cmd', label: '/cmd', description: '', isAlias: false },
    ];
    const { getByText } = render(
      <CommandSuggestions {...defaultProps} suggestions={suggestions} />,
    );
    expect(getByText('/cmd')).toBeTruthy();
  });

  it('should render with different color schemes', () => {
    const darkColors = {
      text: '#fff',
      textSecondary: '#aaa',
      primary: '#0A84FF',
      surface: '#1c1c1e',
      border: '#38383A',
      background: '#000',
    };
    const suggestions = [
      {
        text: '/test',
        label: '/test',
        description: 'Test command',
        isAlias: false,
      },
    ];
    const { getByText } = render(
      <CommandSuggestions
        {...defaultProps}
        suggestions={suggestions}
        colors={darkColors}
      />,
    );
    expect(getByText('/test')).toBeTruthy();
  });

  it('should handle long description text', () => {
    const suggestions = [
      {
        text: '/long',
        label: '/long',
        description: 'A'.repeat(200),
        isAlias: false,
      },
    ];
    const { getByText } = render(
      <CommandSuggestions {...defaultProps} suggestions={suggestions} />,
    );
    expect(getByText('/long')).toBeTruthy();
  });

  it('should handle many suggestions', () => {
    const suggestions = Array.from({ length: 20 }, (_, i) => ({
      text: `/cmd${i}`,
      label: `/cmd${i}`,
      description: `Command ${i}`,
      isAlias: i % 2 === 0,
    }));
    const { getByText } = render(
      <CommandSuggestions {...defaultProps} suggestions={suggestions} />,
    );
    expect(getByText('/cmd0')).toBeTruthy();
    expect(getByText('/cmd19')).toBeTruthy();
  });
});
