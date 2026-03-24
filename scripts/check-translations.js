const fs = require('fs');

function usage() {
  console.error('Usage: node scripts/check-translations.js <file>');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  usage();
}

const text = fs.readFileSync(file, 'utf8');
const regex = /(?<![\\w$])t\(\s*(['"])([\s\S]*?)\1/g;
const keys = new Set();
let match;

while ((match = regex.exec(text)) !== null) {
  const literal = match[2];
  const sanitized = literal
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, '\\n');
  try {
    const value = JSON.parse(`"${sanitized}"`);
    keys.add(value);
  } catch {
    keys.add(literal);
  }
}

const translations = require('../src/i18n/translations/en.json');
const missing = [];

for (const key of keys) {
  if (!Object.prototype.hasOwnProperty.call(translations, key)) {
    missing.push(key);
  }
}

console.log(`${missing.length} missing keys in ${file}`);
missing.sort().forEach((key) => console.log(key));
