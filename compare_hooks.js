const fs = require('fs');

// Read hook files
const hookFiles = fs.readdirSync('src/hooks').filter(f => f.endsWith('.ts'));
const hookNames = hookFiles.map(f => f.replace('.ts', ''));

// Read test files
const testFiles = fs
  .readdirSync('__tests__/hooks')
  .filter(f => f.endsWith('.test.ts'));
const testNames = testFiles.map(f => f.replace('.test.ts', ''));

console.log('=== HOOKS WITHOUT TESTS ===');
const missingTests = hookNames.filter(hook => !testNames.includes(hook));
missingTests.forEach(hook => console.log(`${hook}.ts`));

console.log('\n=== HOOKS WITH TESTS ===');
const existingTests = hookNames.filter(hook => testNames.includes(hook));
existingTests.forEach(hook => console.log(`${hook}.ts`));

console.log(`\nSummary:`);
console.log(`Total hooks: ${hookNames.length}`);
console.log(`Hooks with tests: ${testNames.length}`);
console.log(`Hooks without tests: ${missingTests.length}`);
