const path = require('path');
const { spawnSync } = require('child_process');
const { loadEnvFile } = require('./loadEnv');

const envFromFile = loadEnvFile();
const env = { ...process.env, ...envFromFile };

if (!env.TRANSIFEX_TOKEN || !env.TRANSIFEX_SECRET) {
  console.warn('Transifex Native token/secret missing; skipping pull.');
  process.exit(0);
}

const cliPath = path.resolve(__dirname, '../../node_modules/@transifex/cli/bin/run');
const outDir = path.resolve(__dirname, '../../src/i18n/translations');

const args = ['pull', '--pretty', '-f', outDir];
const result = spawnSync(process.execPath, [cliPath, ...args], { stdio: 'inherit', env });
if (result.error) {
  console.error(result.error.message);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
