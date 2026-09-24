import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AddonInstallReviewScreen } from '../../src/screens/AddonInstallReviewScreen';
import { createAddonInstallReview } from '../../src/services/scripting/AddonInstallReview';
import type { AddonManifest } from '../../src/services/scripting/AddonManifest';

const manifest: AddonManifest = {
  id: 'rs.androidircx.tools',
  name: 'Tools',
  author: 'AndroidIRCX',
  version: '1.0.0',
  description: 'Useful tools.',
  license: 'GPL-3.0-or-later',
  apiVersion: 1,
  minAppVersion: '1.10.0',
  entry: 'main.js',
  permissions: ['irc.raw.modify'],
};

describe('AddonInstallReviewScreen', () => {
  it('shows blockers and cannot confirm a blocked addon', async () => {
    const onConfirm = jest.fn();
    const screen = await render(
      <AddonInstallReviewScreen
        visible
        review={createAddonInstallReview({
          manifest,
          signatureStatus: 'unsigned',
          developerMode: false,
        })}
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(
      screen.getByText('Unsigned addons require Developer Mode.'),
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Continue'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('discloses critical new session-only permission and confirms valid addon', async () => {
    const onConfirm = jest.fn();
    const screen = await render(
      <AddonInstallReviewScreen
        visible
        review={createAddonInstallReview({
          manifest,
          signatureStatus: 'valid-known-key',
          developerMode: false,
          previouslyDeclared: [],
        })}
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText('CRITICAL')).toBeTruthy();
    expect(screen.getByText('NEW PERMISSION')).toBeTruthy();
    expect(screen.getByText('Approval is session-only.')).toBeTruthy();
    fireEvent.press(screen.getByText('Continue'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
