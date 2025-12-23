const fs = require('fs');
const path = require('path');

const ENV_PATH = path.resolve(__dirname, '../../secrets/transifex.env');

const parseEnv = (contents) => {
  const env = {};
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key) {
      env[key] = value;
    }
  });
  return env;
};

const loadEnvFile = () => {
  if (!fs.existsSync(ENV_PATH)) {
    return {};
  }
  const contents = fs.readFileSync(ENV_PATH, 'utf8');
  return parseEnv(contents);
};

module.exports = { loadEnvFile };
