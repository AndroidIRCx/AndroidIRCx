/*
 * Single source of truth for app version (from app.json).
 * Used by AboutScreen, IRCService CTCP VERSION, ScriptingService, AdRewardService, etc.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const appConfig = require('../../app.json') as { version?: string };
export const APP_VERSION = appConfig?.version ?? '1.0.0';
