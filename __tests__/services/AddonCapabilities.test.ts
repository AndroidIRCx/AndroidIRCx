import { ADDON_CAPABILITY_DEFINITIONS } from '../../src/services/scripting/AddonCapabilities';
import { ADDON_CAPABILITIES } from '../../src/services/scripting/AddonManifest';

describe('AddonCapabilities', () => {
  it('has one complete user-facing definition for every capability', () => {
    expect(Object.keys(ADDON_CAPABILITY_DEFINITIONS).sort()).toEqual(
      [...ADDON_CAPABILITIES].sort(),
    );
    Object.values(ADDON_CAPABILITY_DEFINITIONS).forEach(definition => {
      expect(definition.title.length).toBeGreaterThan(0);
      expect(definition.disclosure.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high', 'critical']).toContain(definition.risk);
    });
  });

  it('does not permit permanent grants for the most dangerous ambient access', () => {
    expect(
      ADDON_CAPABILITY_DEFINITIONS['irc.raw.modify'].persistentGrantAllowed,
    ).toBe(false);
    expect(
      ADDON_CAPABILITY_DEFINITIONS['network.private'].persistentGrantAllowed,
    ).toBe(false);
  });
});
