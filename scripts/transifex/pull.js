const fs = require('fs');
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

// Preserve the manually maintained Serbian translation file across pulls.
const srPath = path.join(outDir, 'sr.json');
const srBackupPath = path.join(outDir, 'sr.json.__manual_backup__');
const hasSr = fs.existsSync(srPath);
if (hasSr) {
  fs.copyFileSync(srPath, srBackupPath);
}

let result;
try {
  const args = ['pull', '--pretty', '-f', outDir];
  result = spawnSync(process.execPath, [cliPath, ...args], { stdio: 'inherit', env });
  if (result.error) {
    console.error(result.error.message);
  }
} finally {
  // Restore sr.json so Transifex never overwrites it.
  if (hasSr && fs.existsSync(srBackupPath)) {
    fs.copyFileSync(srBackupPath, srPath);
    fs.unlinkSync(srBackupPath);
  }
  // Merge missing keys from en.json into sr.json (without overwriting existing translations).
  const mergeScript = path.join(__dirname, 'merge-missing-keys.js');
  if (fs.existsSync(mergeScript)) {
    const mergeResult = spawnSync(process.execPath, [mergeScript], { stdio: 'inherit', cwd: path.resolve(__dirname, '../..') });
    if (mergeResult.status !== 0) {
      console.warn('merge-missing-keys.js failed (status %s)', mergeResult.status);
    }
  }
}

process.exit(result && typeof result.status === 'number' ? result.status : 1);