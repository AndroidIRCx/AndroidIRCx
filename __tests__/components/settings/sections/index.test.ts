/**
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

jest.mock(
  '../../../../src/components/settings/sections/PremiumSection',
  () => ({ PremiumSection: 'PremiumSection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/ScriptingAdsSection',
  () => ({ ScriptingAdsSection: 'ScriptingAdsSection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/SecurityQuickConnectSection',
  () => ({ SecurityQuickConnectSection: 'SecurityQuickConnectSection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/PrivacyLegalSection',
  () => ({ PrivacyLegalSection: 'PrivacyLegalSection' }),
);
jest.mock('../../../../src/components/settings/sections/AboutSection', () => ({
  AboutSection: 'AboutSection',
}));
jest.mock(
  '../../../../src/components/settings/sections/AppearanceSection',
  () => ({ AppearanceSection: 'AppearanceSection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/DisplayUISection',
  () => ({ DisplayUISection: 'DisplayUISection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/MessageHistorySection',
  () => ({ MessageHistorySection: 'MessageHistorySection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/NotificationsSection',
  () => ({ NotificationsSection: 'NotificationsSection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/ConnectionNetworkSection',
  () => ({ ConnectionNetworkSection: 'ConnectionNetworkSection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/BackgroundBatterySection',
  () => ({ BackgroundBatterySection: 'BackgroundBatterySection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/AdvancedSection',
  () => ({ AdvancedSection: 'AdvancedSection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/HighlightingSection',
  () => ({ HighlightingSection: 'HighlightingSection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/SecuritySection',
  () => ({ SecuritySection: 'SecuritySection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/UsersServicesSection',
  () => ({ UsersServicesSection: 'UsersServicesSection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/CommandsSection',
  () => ({ CommandsSection: 'CommandsSection' }),
);
jest.mock('../../../../src/components/settings/sections/MediaSection', () => ({
  MediaSection: 'MediaSection',
}));
jest.mock('../../../../src/components/settings/sections/HelpSection', () => ({
  HelpSection: 'HelpSection',
}));
jest.mock('../../../../src/components/settings/sections/AwaySection', () => ({
  AwaySection: 'AwaySection',
}));
jest.mock(
  '../../../../src/components/settings/sections/ProtectionSection',
  () => ({ ProtectionSection: 'ProtectionSection' }),
);
jest.mock(
  '../../../../src/components/settings/sections/WritingSection',
  () => ({ WritingSection: 'WritingSection' }),
);

import * as sectionsExports from '../../../../src/components/settings/sections';

describe('components/settings/sections index exports', () => {
  it('exports all expected sections', () => {
    expect(sectionsExports.PremiumSection).toBe('PremiumSection');
    expect(sectionsExports.ScriptingAdsSection).toBe('ScriptingAdsSection');
    expect(sectionsExports.SecurityQuickConnectSection).toBe(
      'SecurityQuickConnectSection',
    );
    expect(sectionsExports.PrivacyLegalSection).toBe('PrivacyLegalSection');
    expect(sectionsExports.AboutSection).toBe('AboutSection');
    expect(sectionsExports.AppearanceSection).toBe('AppearanceSection');
    expect(sectionsExports.DisplayUISection).toBe('DisplayUISection');
    expect(sectionsExports.MessageHistorySection).toBe('MessageHistorySection');
    expect(sectionsExports.NotificationsSection).toBe('NotificationsSection');
    expect(sectionsExports.ConnectionNetworkSection).toBe(
      'ConnectionNetworkSection',
    );
    expect(sectionsExports.BackgroundBatterySection).toBe(
      'BackgroundBatterySection',
    );
    expect(sectionsExports.AdvancedSection).toBe('AdvancedSection');
    expect(sectionsExports.HighlightingSection).toBe('HighlightingSection');
    expect(sectionsExports.SecuritySection).toBe('SecuritySection');
    expect(sectionsExports.UsersServicesSection).toBe('UsersServicesSection');
    expect(sectionsExports.CommandsSection).toBe('CommandsSection');
    expect(sectionsExports.MediaSection).toBe('MediaSection');
    expect(sectionsExports.HelpSection).toBe('HelpSection');
    expect(sectionsExports.AwaySection).toBe('AwaySection');
    expect(sectionsExports.ProtectionSection).toBe('ProtectionSection');
    expect(sectionsExports.WritingSection).toBe('WritingSection');
  });
});
