const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const standalonePath = path.join(__dirname, '..', 'standalone.html');
const canvasBundlePath = process.env.CANVAS_OUT_PATH || path.join(__dirname, '..', '..', 'artifacts', 'file_generation', 'ttl=63d', 'output', 'FamilyBudgetApp_v0.6.5.jsx');

// Topological order of modules
const moduleFiles = [
  'utils/dateUtils.js',
  'utils/storage.js',
  'utils/xlsx.js',
  'utils/csv.js',
  'utils/financeCore.js',
  'hooks/useFocusTrap.js',
  'components/analytics/ChartsSection.jsx',
  'components/calendar/ReceiptCalendar.jsx',
  'components/modals/ExportBackupModal.jsx',
  'components/modals/TransactionModal.jsx',
  'components/modals/EntityModals.jsx',
  'App.jsx',
];

function stripImportsAndExports(code, isAppFile = false) {
  let cleaned = code
    // Remove multi-line and single-line import statements
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*/g, '')
    // Replace named exports with plain declarations
    .replace(/export\s+const\s+/g, 'const ')
    .replace(/export\s+function\s+/g, 'function ');

  if (!isAppFile) {
    cleaned = cleaned.replace(/export\s+default\s+/g, '');
  }
  return cleaned.trim();
}

const processedModulesForCanvas = [];
const processedModulesForStandalone = [];

for (const relPath of moduleFiles) {
  const fullPath = path.join(srcDir, relPath);
  const rawCode = fs.readFileSync(fullPath, 'utf8');
  const isApp = relPath === 'App.jsx';
  const banner = `// ============================================================================\n// MODULE: src/${relPath}\n// ============================================================================`;

  const canvasPart = `${banner}\n${stripImportsAndExports(rawCode, isApp)}`;
  const standalonePart = `${banner}\n${stripImportsAndExports(rawCode, false).replace('export default function FamilyBudgetApp()', 'function FamilyBudgetApp()')}`;

  processedModulesForCanvas.push(canvasPart);
  processedModulesForStandalone.push(standalonePart);
}

// 1. Write single-file Canvas React bundle (with lucide-react imports & React.memo preserved)
const canvasHeader = `import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Wallet, Plus, Calendar, User, X,
  Sparkles, ChevronRight, ChevronLeft, Search, Trash2,
  SlidersHorizontal, RotateCcw, Edit3, Check, LayoutGrid,
  ListOrdered, Target, ArrowUpRight, ShieldCheck,
  CheckCircle2, TrendingUp, BarChart3, Clock, Lock,
  Download, Upload, FileSpreadsheet, Copy, Bell, Pin,
  AlertTriangle, AlertCircle
} from 'lucide-react';
`;

const finalCanvasCode = `${canvasHeader}\n${processedModulesForCanvas.join('\n\n')}\n`;

if (fs.existsSync(path.dirname(canvasBundlePath))) {
  fs.writeFileSync(canvasBundlePath, finalCanvasCode, 'utf8');
  console.log('Canvas bundle updated successfully:', canvasBundlePath, 'Length:', finalCanvasCode.length);
}

// 2. Write standalone.html (single-file offline bundle with inline SVG icons)
const standaloneHeader = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Семейный Бюджет v0.7.5 (Автономная версия)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  </style>
</head>
<body class="bg-stone-50 min-h-screen">
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useMemo, useRef, useCallback } = React;

    const createSvgIcon = (svgPath) => (props) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className || "w-4 h-4"} {...props}>
        {svgPath}
      </svg>
    );

    const Wallet = createSvgIcon(<><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></>);
    const Plus = createSvgIcon(<><path d="M5 12h14"/><path d="M12 5v14"/></>);
    const Calendar = createSvgIcon(<><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></>);
    const User = createSvgIcon(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>);
    const X = createSvgIcon(<><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>);
    const Sparkles = createSvgIcon(<><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></>);
    const ChevronRight = createSvgIcon(<><path d="m9 18 6-6-6-6"/></>);
    const ChevronLeft = createSvgIcon(<><path d="m15 18-6-6 6-6"/></>);
    const Search = createSvgIcon(<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>);
    const Trash2 = createSvgIcon(<><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></>);
    const SlidersHorizontal = createSvgIcon(<><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></>);
    const RotateCcw = createSvgIcon(<><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></>);
    const Edit3 = createSvgIcon(<><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></>);
    const Check = createSvgIcon(<><path d="M20 6 9 17l-5-5"/></>);
    const LayoutGrid = createSvgIcon(<><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></>);
    const ListOrdered = createSvgIcon(<><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></>);
    const Target = createSvgIcon(<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>);
    const ArrowUpRight = createSvgIcon(<><path d="M7 7h10v10"/><path d="M7 17 17 7"/></>);
    const ShieldCheck = createSvgIcon(<><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></>);
    const CheckCircle2 = createSvgIcon(<><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>);
    const TrendingUp = createSvgIcon(<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>);
    const BarChart3 = createSvgIcon(<><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></>);
    const Clock = createSvgIcon(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>);
    const Lock = createSvgIcon(<><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>);
    const Download = createSvgIcon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></>);
    const Upload = createSvgIcon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></>);
    const FileSpreadsheet = createSvgIcon(<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></>);
    const Copy = createSvgIcon(<><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></>);
    const Bell = createSvgIcon(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>);
    const Pin = createSvgIcon(<><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></>);
    const AlertTriangle = createSvgIcon(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>);
    const AlertCircle = createSvgIcon(<><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></>);
`;

const standaloneFooter = `
    ReactDOM.createRoot(document.getElementById('root')).render(<FamilyBudgetApp />);
  </script>
</body>
</html>
`;

const bundledStandaloneBody = processedModulesForStandalone
  .join('\n\n')
  .split('\n')
  .map((line) => (line ? '    ' + line : ''))
  .join('\n');

const finalStandalone = `${standaloneHeader}\n${bundledStandaloneBody}\n${standaloneFooter}`;
fs.writeFileSync(standalonePath, finalStandalone, 'utf8');
console.log('standalone.html v0.7.5 generated successfully! Length:', finalStandalone.length);
