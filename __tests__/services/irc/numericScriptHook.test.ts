/*
 * Copyright (c) 2025-2026 Velimir Majstorov
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
  getNumericScriptHook,
  setNumericScriptHook,
} from '../../../src/services/irc/numericScriptHook';

describe('numericScriptHook', () => {
  afterEach(() => setNumericScriptHook(null));

  it('starts unset and returns what was registered', () => {
    expect(getNumericScriptHook()).toBeNull();
    const hook = jest.fn(() => true);
    setNumericScriptHook(hook);
    expect(getNumericScriptHook()).toBe(hook);
    setNumericScriptHook(null);
    expect(getNumericScriptHook()).toBeNull();
  });

  it('is registered by ScriptingService and forwards to handleNumeric', () => {
    jest.isolateModules(() => {
      const {
        scriptingService,
      } = require('../../../src/services/ScriptingService');
      const hookModule = require('../../../src/services/irc/numericScriptHook');
      const spy = jest
        .spyOn(scriptingService, 'handleNumeric')
        .mockReturnValue(false);
      const message: any = { id: 'n', type: 'raw', text: 'x', timestamp: 1 };
      expect(hookModule.getNumericScriptHook()(401, ['me'], 'x', message)).toBe(
        false,
      );
      expect(spy).toHaveBeenCalledWith(401, ['me'], 'x', message);
    });
  });
});
