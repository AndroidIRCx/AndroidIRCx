import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AddonPermissionManagerScreen } from '../../src/screens/AddonPermissionManagerScreen';
import { addonPermissionService } from '../../src/services/scripting/AddonPermissionService';
import { addonRawMiddleware } from '../../src/services/scripting/AddonRawMiddleware';
import { addonDiagnostics } from '../../src/services/scripting/AddonDiagnostics';
import type { AddonManifest } from '../../src/services/scripting/AddonManifest';

const manifest: AddonManifest = {
  id: 'rs.androidircx.manager-test',
  name: 'Manager Test',
  author: 'AndroidIRCX',
  version: '1.0.0',
  description: 'Test addon.',
  license: 'GPL-3.0-or-later',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'main.js',
  permissions: ['irc.read', 'irc.raw.modify'],
};

describe('AddonPermissionManagerScreen', () => {
  beforeEach(async () => {
    await addonPermissionService.initialize();
    await addonPermissionService.revokeAll(manifest.id);
    addonRawMiddleware.resetForTests();
    addonDiagnostics.resetForTests();
    jest.restoreAllMocks();
  });

  const props = () => ({
    visible: true,
    manifest,
    enabled: true,
    onClose: jest.fn(),
    onSetEnabled: jest.fn(),
    onUninstall: jest.fn(),
    onReviewSource: jest.fn(),
    onExportSource: jest.fn(),
    onExportDiagnostics: jest.fn(),
    onPreviewDisplay: jest.fn().mockResolvedValue({
      matched: 1,
      delivered: 1,
      failed: 0,
      hideDefaultRequestedBy: ['rs.androidircx.manager-test'],
      transformations: [
        {
          addonId: 'rs.androidircx.manager-test',
          result: {
            display: 'hide',
            replacement: 'Preview replacement',
            style: { role: 'notice' },
            routeTo: { kind: 'channel', target: '#preview' },
          },
        },
      ],
    }),
  });

  it('allows persistent grants only for persistable permissions and revokes immediately', async () => {
    const screen = await render(<AddonPermissionManagerScreen {...props()} />);
    await waitFor(() =>
      expect(screen.getAllByText('Allow this session')).toHaveLength(2),
    );
    expect(screen.getAllByText('Always allow')).toHaveLength(1);

    await fireEvent.press(screen.getByText('Always allow'));
    await waitFor(() => expect(screen.getByText('GRANTED')).toBeTruthy());
    await fireEvent.press(screen.getByText('Revoke'));
    await waitFor(() => expect(screen.queryByText('GRANTED')).toBeNull());
  });

  it('requires confirmation before uninstall and exposes source/disable controls', async () => {
    const callbacks = props();
    const alert = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) =>
        buttons?.find(button => button.text === 'Uninstall')?.onPress?.(),
      );
    const screen = await render(
      <AddonPermissionManagerScreen {...callbacks} />,
    );
    await fireEvent.press(screen.getByText('Review source'));
    await fireEvent.press(screen.getByText('Export source'));
    await fireEvent.press(screen.getByText('Export recovery log'));
    await fireEvent.press(screen.getByText('Disable addon'));
    await fireEvent.press(screen.getByText('Uninstall addon'));
    expect(callbacks.onReviewSource).toHaveBeenCalledTimes(1);
    expect(callbacks.onExportSource).toHaveBeenCalledTimes(1);
    expect(callbacks.onExportDiagnostics).toHaveBeenCalledTimes(1);
    expect(callbacks.onSetEnabled).toHaveBeenCalledWith(false);
    expect(alert).toHaveBeenCalledWith(
      'Uninstall addon?',
      expect.any(String),
      expect.any(Array),
    );
    expect(callbacks.onUninstall).toHaveBeenCalledTimes(1);
  });

  it('shows raw counters and toggles the raw recovery switch', async () => {
    const screen = await render(<AddonPermissionManagerScreen {...props()} />);

    expect(await screen.findByText('Raw traffic')).toBeTruthy();
    // The recovery button is the "reconnect without raw add-ons" escape hatch.
    await fireEvent.press(screen.getByText('Reconnect without raw add-ons'));
    expect(addonRawMiddleware.isSuspended()).toBe(true);

    await fireEvent.press(
      screen.getByText('Raw add-ons suspended - allow again'),
    );
    expect(addonRawMiddleware.isSuspended()).toBe(false);
  });

  it('hides the raw section for an addon that never asked for it', async () => {
    const screen = await render(
      <AddonPermissionManagerScreen
        {...props()}
        manifest={{ ...manifest, permissions: ['irc.read'] }}
      />,
    );
    await waitFor(() => expect(screen.getByText('Activity')).toBeTruthy());
    expect(screen.queryByText('Raw traffic')).toBeNull();
  });

  it('shows health counters and the last error', async () => {
    addonDiagnostics.count(manifest.id, 'events', 3);
    addonDiagnostics.count(manifest.id, 'ircSends', 2);
    addonDiagnostics.recordError(manifest.id, 'onMessage', new Error('boom'));

    const screen = await render(<AddonPermissionManagerScreen {...props()} />);

    expect(await screen.findByText('Health')).toBeTruthy();
    expect(screen.getByText(/3 events/)).toBeTruthy();
    expect(screen.getByText(/2 IRC sends/)).toBeTruthy();
    expect(screen.getByText('onMessage: boom')).toBeTruthy();
  });

  it('says plainly when an addon has recorded no errors', async () => {
    const screen = await render(<AddonPermissionManagerScreen {...props()} />);
    expect(await screen.findByText('No errors recorded')).toBeTruthy();
  });

  it('shows why recovery disabled an addon', async () => {
    const screen = await render(
      <AddonPermissionManagerScreen
        {...props()}
        enabled={false}
        disabledReason="repeated-failure"
      />,
    );
    expect(await screen.findByText('Recovery status')).toBeTruthy();
    expect(screen.getByText('Disabled because: repeated-failure')).toBeTruthy();
  });

  it('shows a targeted display preview without adding it to chat', async () => {
    const callbacks = props();
    const screen = await render(
      <AddonPermissionManagerScreen {...callbacks} />,
    );

    await fireEvent.press(screen.getByText('Preview message display'));

    await waitFor(() =>
      expect(callbacks.onPreviewDisplay).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByText('Display preview result')).toBeTruthy();
    expect(screen.getByText('Default line: hidden')).toBeTruthy();
    expect(screen.getByText('Preview replacement')).toBeTruthy();
    expect(
      screen.getByText('Replacement 1 · notice · channel:#preview'),
    ).toBeTruthy();
  });
});
