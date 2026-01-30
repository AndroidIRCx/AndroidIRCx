/**
 * Merges missing keys from en.json into sr.json without overwriting existing translations.
 * - Keys that exist in both en and sr are left unchanged (your translations).
 * - Keys that exist in en but not in sr are added with the English value as placeholder.
 * - Keys that exist only in sr are kept (nothing is removed).
 *
 * Run: node scripts/transifex/merge-missing-keys.js
 * Or: yarn tx:merge-sr
 *
 * Does not pull from Transifex – operates only on local en.json and sr.json.
 */

const fs = require('fs');
const path = require('path');

const translationsDir = path.resolve(__dirname, '../../src/i18n/translations');
const enPath = path.join(translationsDir, 'en.json');
const srPath = path.join(translationsDir, 'sr.json');

function main() {
  if (!fs.existsSync(enPath)) {
    console.error('en.json not found:', enPath);
    process.exit(1);
  }
  if (!fs.existsSync(srPath)) {
    console.error('sr.json not found:', srPath);
    process.exit(1);
  }

  const enRaw = fs.readFileSync(enPath, 'utf8');
  const srRaw = fs.readFileSync(srPath, 'utf8');
  const en = JSON.parse(enRaw);
  const sr = JSON.parse(srRaw);

  // Structure: each key -> { "string": "value" }
  const merged = {};
  let added = 0;

  // 1) All keys from en: if present in sr keep sr; otherwise add with empty string (you translate)
  for (const key of Object.keys(en)) {
    if (Object.prototype.hasOwnProperty.call(sr, key)) {
      merged[key] = sr[key];
    } else {
      merged[key] = { string: '' };
      added++;
    }
  }

  // 2) Keys that exist only in sr (keep them, do not remove)
  for (const key of Object.keys(sr)) {
    if (!Object.prototype.hasOwnProperty.call(merged, key)) {
      merged[key] = sr[key];
    }
  }

  fs.writeFileSync(srPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log('sr.json updated. Keys added:', added);
}

main();
