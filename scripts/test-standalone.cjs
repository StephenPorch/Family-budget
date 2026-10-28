const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.join(__dirname, '..', 'standalone.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const match = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!match) {
  console.error('ERROR: No <script type="text/babel"> block found in standalone.html');
  process.exit(1);
}

const code = match[1];
const requiredDefinitions = [
  'const useFocusTrap =',
  'const useBackdropDismiss =',
  'class ErrorBoundary extends',
  'const calculateHorizonDays =',
  'const calculateWalletBalancesWithTransfers =',
  'const ArrowRightLeft = createSvgIcon',
  'function FamilyBudgetApp()',
];

for (const req of requiredDefinitions) {
  assert.ok(code.includes(req), `Missing required definition in standalone.html: ${req}`);
}

try {
  const esbuild = require('esbuild');
  const result = esbuild.transformSync(code, { loader: 'jsx' });
  console.log('✅ esbuild JSX transform & module integrity check PASSED! Lines:', result.code.split('\n').length);
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    console.log('✅ standalone.html <script type="text/babel"> block & all required module definitions verified! Length:', code.length);
    process.exit(0);
  }
  console.error('❌ esbuild JSX transform check FAILED:', e);
  process.exit(1);
}
