/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as settingsExports from '../../../src/components/settings';
import { SettingItem } from '../../../src/components/settings/SettingItem';
import { SettingSwitch } from '../../../src/components/settings/SettingSwitch';
import { SettingButton } from '../../../src/components/settings/SettingButton';
import { SettingInput } from '../../../src/components/settings/SettingInput';
import { SettingSubmenu } from '../../../src/components/settings/SettingSubmenu';
import { SettingsSectionHeader } from '../../../src/components/settings/SettingsSectionHeader';

describe('components/settings index exports', () => {
  it('exports all expected setting components', () => {
    expect(settingsExports.SettingItem).toBe(SettingItem);
    expect(settingsExports.SettingSwitch).toBe(SettingSwitch);
    expect(settingsExports.SettingButton).toBe(SettingButton);
    expect(settingsExports.SettingInput).toBe(SettingInput);
    expect(settingsExports.SettingSubmenu).toBe(SettingSubmenu);
    expect(settingsExports.SettingsSectionHeader).toBe(SettingsSectionHeader);
  });
});
