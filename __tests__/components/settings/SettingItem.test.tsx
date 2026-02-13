/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { SettingItem } from '../../../src/components/settings/SettingItem';

jest.mock('../../../src/components/settings/SettingSwitch', () => ({
  SettingSwitch: ({ item }: any) => {
    const { Text } = require('react-native');
    return <Text>{`Switch:${item.id}`}</Text>;
  },
}));

jest.mock('../../../src/components/settings/SettingButton', () => ({
  SettingButton: ({ item }: any) => {
    const { Text } = require('react-native');
    return <Text>{`Button:${item.id}`}</Text>;
  },
}));

jest.mock('../../../src/components/settings/SettingInput', () => ({
  SettingInput: ({ item }: any) => {
    const { Text } = require('react-native');
    return <Text>{`Input:${item.id}`}</Text>;
  },
}));

jest.mock('../../../src/components/settings/SettingSubmenu', () => ({
  SettingSubmenu: ({ item }: any) => {
    const { Text } = require('react-native');
    return <Text>{`Submenu:${item.id}`}</Text>;
  },
}));

describe('SettingItem', () => {
  const colors = {
    text: '#000',
    textSecondary: '#666',
    primary: '#0af',
    surface: '#fff',
    border: '#ddd',
    background: '#eee',
  };

  const styles = {
    settingItem: {},
    settingContent: {},
    settingTitleRow: {},
    settingTitle: {},
    settingDescription: {},
    disabledItem: {},
    disabledText: {},
    chevron: {},
  };

  it('renders switch variant', () => {
    const { getByText } = render(
      <SettingItem item={{ id: 's1', type: 'switch', title: 'x', value: true }} colors={colors} styles={styles as any} />
    );
    expect(getByText('Switch:s1')).toBeTruthy();
  });

  it('renders button variant', () => {
    const { getByText } = render(
      <SettingItem item={{ id: 'b1', type: 'button', title: 'x' }} colors={colors} styles={styles as any} />
    );
    expect(getByText('Button:b1')).toBeTruthy();
  });

  it('renders input variant', () => {
    const { getByText } = render(
      <SettingItem item={{ id: 'i1', type: 'input', title: 'x', value: '' }} colors={colors} styles={styles as any} />
    );
    expect(getByText('Input:i1')).toBeTruthy();
  });

  it('renders submenu variant', () => {
    const { getByText } = render(
      <SettingItem item={{ id: 'm1', type: 'submenu', title: 'x' }} colors={colors} styles={styles as any} />
    );
    expect(getByText('Submenu:m1')).toBeTruthy();
  });

  it('renders custom variant via renderCustom callback', () => {
    const { getByText } = render(
      <SettingItem
        item={{ id: 'c1', type: 'custom', title: 'x' } as any}
        colors={colors}
        styles={styles as any}
        renderCustom={(item) => {
          const { Text } = require('react-native');
          return <Text>{`Custom:${item.id}`}</Text>;
        }}
      />
    );
    expect(getByText('Custom:c1')).toBeTruthy();
  });
});
