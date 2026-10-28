const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.resolve(__dirname, '..');
const targets = [
  'c:/Users/zemichev/YandexDisk/side_projects/family-budget-v0.8.0',
  'G:/My Drive/Проекты/Семейный бюджет v0.8.0'
];

const filesToCopy = [
  'package.json',
  'package-lock.json',
  'README.md',
  'index.html',
  'standalone.html',
  'vite.config.js',
  'tailwind.config.js',
  'postcss.config.js',
  '.gitignore'
];

const dirsToCopy = [
  'src',
  'scripts',
  'public'
];

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  const items = fs.readdirSync(source, { withFileTypes: true });
  for (const item of items) {
    const srcPath = path.join(source, item.name);
    const dstPath = path.join(target, item.name);
    if (item.isDirectory()) {
      copyFolderRecursiveSync(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

targets.forEach(tgt => {
  if (!fs.existsSync(tgt)) fs.mkdirSync(tgt, { recursive: true });
  filesToCopy.forEach(f => {
    const s = path.join(srcDir, f);
    if (fs.existsSync(s)) {
      fs.copyFileSync(s, path.join(tgt, f));
    }
  });
  dirsToCopy.forEach(d => {
    const s = path.join(srcDir, d);
    if (fs.existsSync(s)) {
      copyFolderRecursiveSync(s, path.join(tgt, d));
    }
  });
  console.log('Synced files to:', tgt);
});

// Update family-budget-v0.8.0.zip in local target folder and copy to Google Drive
const localTarget = targets[0];
const gdriveTarget = targets[1];
const localZipPath = path.join(localTarget, 'family-budget-v0.8.0.zip');
const gdriveZipPath = path.join(gdriveTarget, 'family-budget-v0.8.0.zip');

if (fs.existsSync(localZipPath)) {
  try { fs.unlinkSync(localZipPath); } catch (e) {}
}

const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${localTarget}\\*' -DestinationPath '${localZipPath}' -Force"`;
execSync(psCmd, { stdio: 'inherit' });
console.log('Rebuilt local zip archive:', localZipPath);

fs.copyFileSync(localZipPath, gdriveZipPath);
console.log('Copied clean zip to Google Drive:', gdriveZipPath);

// Verification check
const f1 = fs.readFileSync(path.join(srcDir, 'src', 'App.jsx'), 'utf8');
const f2 = fs.readFileSync(path.join(localTarget, 'src', 'App.jsx'), 'utf8');
const f3 = fs.readFileSync(path.join(gdriveTarget, 'src', 'App.jsx'), 'utf8');
console.log('Verification:');
console.log('- Local copy matches src:', f1 === f2);
console.log('- Google Drive copy matches src:', f1 === f3);
console.log('- Local zip size:', fs.statSync(localZipPath).size, 'bytes');
console.log('- Google Drive zip size:', fs.statSync(gdriveZipPath).size, 'bytes');
