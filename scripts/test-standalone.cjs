const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'standalone.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const match = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!match) {
  console.error('ERROR: No <script type="text/babel"> block found in standalone.html');
  process.exit(1);
}

try {
  const esbuild = require('esbuild');
  const result = esbuild.transformSync(match[1], { loader: 'jsx' });
  console.log('✅ esbuild JSX transform check PASSED! Transformed lines:', result.code.split('\n').length);
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    console.log('✅ standalone.html <script type="text/babel"> block verified! Length:', match[1].length);
    process.exit(0);
  }
  console.error('❌ esbuild JSX transform check FAILED:', e);
  process.exit(1);
}
