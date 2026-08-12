/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Tests for AdvancedSection component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { AdvancedSection } from '../../../src/components/settings/sections/AdvancedSection';

const mockCapturedItems = new Map<string, any>();

jest.mock('../../../src/components/settings/SettingItem', () => {
  const ReactLocal = require('react');
  const { Text } = require('react-native');
  return {
    SettingItem: ({ item }: any) => {
      mockCapturedItems.set(item.id, item);
      return ReactLocal.createElement(Text, null, item.id);
    },
  };
});

const mockColors = {
  text: '#000000',
  textSecondary: '#666666',
  primary: '#007AFF',
  surface: '#FFFFFF',
  border: '#E0E0E0',
  background: '#F5F5F5',
};

const mockStyles = {
  settingItem: {},
  settingContent: {},
  settingTitleRow: {},
  settingTitle: {},
  settingDescription: {},
  disabledItem: {},
  disabledText: {},
  chevron: {},
  input: {},
  disabledInput: {},
};

describe('AdvancedSection', () => {
  beforeEach(() => {
    mockCapturedItems.clear();
  });

  it('renders null and produces no setting items (section is empty)', async () => {
    const { toJSON } = await render(
      <AdvancedSection
        colors={mockColors}
        styles={mockStyles as any}
        settingIcons={{}}
      />,
    );

    // The section has no items, so it renders nothing and no SettingItem
    // children are produced.
    expect(toJSON()).toBeNull();
    expect(mockCapturedItems.size).toBe(0);
  });

  it('renders null regardless of provided settingIcons', async () => {
    const { toJSON } = await render(
      <AdvancedSection
        colors={mockColors}
        styles={mockStyles as any}
        settingIcons={{ 'some-id': { name: 'star' } as any }}
      />,
    );

    expect(toJSON()).toBeNull();
    expect(mockCapturedItems.size).toBe(0);
  });
});
