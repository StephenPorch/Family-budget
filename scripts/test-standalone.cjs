const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'standalone.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const match = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!match) {
  console.error('ERROR: No <script type="text/babel"> block found in standalone.html');
  process.exit(1);
}

const esbuild = require('esbuild');
try {
  const result = esbuild.transformSync(match[1], { loader: 'jsx' });
  console.log('✅ esbuild JSX transform check PASSED! Transformed lines:', result.code.split('\n').length);
} catch (e) {
  console.error('❌ esbuild JSX transform check FAILED:', e);
  process.exit(1);
}
