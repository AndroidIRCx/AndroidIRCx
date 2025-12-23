const path = require('path');
const { spawnSync } = require('child_process');
const { loadEnvFile } = require('./loadEnv');

const envFromFile = loadEnvFile();
const env = { ...process.env, ...envFromFile };

if (!env.TRANSIFEX_TOKEN || !env.TRANSIFEX_SECRET) {
  console.warn('Transifex Native token/secret missing; skipping push.');
  process.exit(0);
}

const cliPath = path.resolve(__dirname, '../../node_modules/@transifex/cli/bin/run');
const defaultPatterns = ['App.tsx', 'src'];
const patterns = env.TRANSIFEX_PUSH_PATTERN
  ? env.TRANSIFEX_PUSH_PATTERN.split(',').map((entry) => entry.trim()).filter(Boolean)
  : defaultPatterns;

let exitCode = 0;
for (const pattern of patterns) {
  const args = ['push', pattern, '--key-generator=source'];
  const result = spawnSync(process.execPath, [cliPath, ...args], { stdio: 'inherit', env });
  if (result.error) {
    console.error(result.error.message);
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    exitCode = result.status;
  }
}

process.exit(exitCode);
