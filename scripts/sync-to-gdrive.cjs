const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const versions = [
  'v0.7.1',
  'v0.7.5',
  'v0.7.6',
  'v0.7.7',
  'v0.7.7.1',
  'v0.7.8'
];

const basePath = 'c:/Users/zemichev/YandexDisk/side_projects';
const gdriveBase = 'G:/My Drive/Проекты';

function copyFolderRecursive(source, target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  const items = fs.readdirSync(source, { withFileTypes: true });
  for (const item of items) {
    if (item.name === '.git' || item.name === 'node_modules') continue;
    const srcPath = path.join(source, item.name);
    const dstPath = path.join(target, item.name);
    if (item.isDirectory()) {
      copyFolderRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

for (const ver of versions) {
  const localDir = path.join(basePath, 'family-budget-' + ver);
  const gdriveDir = path.join(gdriveBase, 'Семейный бюджет ' + ver);
  const zipName = `family-budget-${ver}.zip`;
  const localZip = path.join(localDir, zipName);

  if (!fs.existsSync(localDir)) {
    console.error(`Local folder not found: ${localDir}`);
    continue;
  }

  console.log(`\n=== Processing ${ver} ===`);
  
  // 1. Create ZIP archive in local directory if not present
  if (!fs.existsSync(localZip)) {
    console.log(`Creating ZIP: ${localZip}...`);
    // Use PowerShell Compress-Archive
    const psCmd = `powershell -NoProfile -Command "Get-ChildItem -Path '${localDir}' -Exclude '*.zip', '.git', 'node_modules' | Compress-Archive -DestinationPath '${localZip}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });
    console.log(`ZIP created: ${(fs.statSync(localZip).size / 1024).toFixed(1)} KB`);
  } else {
    console.log(`ZIP already exists: ${(fs.statSync(localZip).size / 1024).toFixed(1)} KB`);
  }

  // 2. Ensure Google Drive target directory exists
  if (!fs.existsSync(gdriveDir)) {
    fs.mkdirSync(gdriveDir, { recursive: true });
    console.log(`Created GDrive directory: ${gdriveDir}`);
  }

  // 3. Copy files to Google Drive
  console.log(`Copying files to Google Drive...`);
  copyFolderRecursive(localDir, gdriveDir);

  // 4. Verify standalone.html and zip in Google Drive
  const gdriveStandalone = path.join(gdriveDir, 'standalone.html');
  const gdriveZip = path.join(gdriveDir, zipName);

  const hasStandalone = fs.existsSync(gdriveStandalone);
  const hasZip = fs.existsSync(gdriveZip);
  const standaloneSize = hasStandalone ? (fs.statSync(gdriveStandalone).size / 1024).toFixed(1) : 0;
  const zipSize = hasZip ? (fs.statSync(gdriveZip).size / 1024).toFixed(1) : 0;

  console.log(`Verification for ${ver} on Google Drive:`);
  console.log(` - standalone.html: ${hasStandalone ? standaloneSize + ' KB' : 'MISSING'}`);
  console.log(` - ${zipName}: ${hasZip ? zipSize + ' KB' : 'MISSING'}`);
}

console.log('\n✅ All missing versions synchronized to Google Drive successfully!');
