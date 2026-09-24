/* Copyright (c) 2025-2026 Velimir Majstorov; SPDX-License-Identifier: GPL-3.0-or-later */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AddonPanelView } from '../../src/components/AddonPanelView';
import type { AddonPanelNode } from '../../src/services/scripting/AddonUISchema';

describe('AddonPanelView', () => {
  it('renders every node kind from data alone', async () => {
    const nodes: AddonPanelNode[] = [
      { kind: 'text', text: 'Hello there' },
      { kind: 'list', items: [{ label: 'Entry', detail: 'Detail' }] },
      {
        kind: 'table',
        columns: ['Nick', 'Host'],
        rows: [['fred', 'h.example']],
      },
      { kind: 'keyValue', pairs: [{ key: 'Users', value: '42' }] },
      { kind: 'buttons', buttons: [{ id: 'go', label: 'Refresh' }] },
      { kind: 'progress', value: 0.5, label: 'Scanning' },
      { kind: 'image', url: 'https://example.com/a.png', alt: 'A picture' },
    ];

    const screen = await render(<AddonPanelView nodes={nodes} />);

    expect(screen.getByText('Hello there')).toBeTruthy();
    expect(screen.getByText('Entry')).toBeTruthy();
    expect(screen.getByText('Detail')).toBeTruthy();
    expect(screen.getByText('Nick')).toBeTruthy();
    expect(screen.getByText('h.example')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
    expect(screen.getByText('Refresh')).toBeTruthy();
    expect(screen.getByText('Scanning')).toBeTruthy();
    expect(screen.getByLabelText('A picture')).toBeTruthy();
  });

  it('routes a button press back by id only', async () => {
    const onButtonPress = jest.fn();
    const screen = await render(
      <AddonPanelView
        nodes={[{ kind: 'buttons', buttons: [{ id: 'go', label: 'Go' }] }]}
        onButtonPress={onButtonPress}
      />,
    );

    await fireEvent.press(screen.getByText('Go'));
    // The addon never supplies a callback; it gets told which id was pressed.
    expect(onButtonPress).toHaveBeenCalledWith('go');
  });

  it('does not fire a press for a disabled button', async () => {
    const onButtonPress = jest.fn();
    const screen = await render(
      <AddonPanelView
        nodes={[
          {
            kind: 'buttons',
            buttons: [{ id: 'go', label: 'Go', disabled: true }],
          },
        ]}
        onButtonPress={onButtonPress}
      />,
    );

    await fireEvent.press(screen.getByText('Go'));
    expect(onButtonPress).not.toHaveBeenCalled();
  });

  it('gives progress an accessible value', async () => {
    const screen = await render(
      <AddonPanelView nodes={[{ kind: 'progress', value: 0.25 }]} />,
    );
    const bar = screen.UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(bar.props.accessibilityValue).toEqual({ now: 25, min: 0, max: 100 });
  });

  it('renders nothing rather than crashing on a node kind it does not know', async () => {
    // Validation rejects these long before here; this is the last line.
    const screen = await render(
      <AddonPanelView nodes={[{ kind: 'webview' } as any]} />,
    );
    expect(screen.toJSON()).toBeTruthy();
  });

  it('renders an empty panel without complaint', async () => {
    const screen = await render(<AddonPanelView nodes={[]} />);
    expect(screen.toJSON()).toBeTruthy();
  });
});
