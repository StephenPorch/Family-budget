import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet, Plus, Calendar, User, X,
  Sparkles, ChevronRight, ChevronLeft, Search, Trash2,
  SlidersHorizontal, RotateCcw, Edit3, Check, LayoutGrid,
  ListOrdered, Target, ArrowUpRight, ShieldCheck,
  CheckCircle2, BarChart3, Clock, Lock, Download, Upload,
  FileSpreadsheet, Copy, Bell, Pin, TrendingUp
} from 'lucide-react';

// Получение локальной даты в формате YYYY-MM-DD (не зависит от UTC)
const getLocalDateString = (dateObj = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Получение даты со сдвигом в днях от сегодня
const getOffsetDateString = (daysOffset) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return getLocalDateString(d);
};

// Получение текущего месяца в формате YYYY-MM
const getCurrentMonthPrefix = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Корректная дата внутри выбранного месяца (исправляет баг записи в чужой месяц)
const getTargetDateForMonth = (selectedMonth, preferredDay = null) => {
  const currentYm = getCurrentMonthPrefix();
  const targetYm = !selectedMonth || selectedMonth === 'all' ? currentYm : selectedMonth;
  const [y, m] = targetYm.split('-').map(Number);
  const maxDays = new Date(y, m, 0).getDate();
  if (targetYm === currentYm && !preferredDay) {
    return getLocalDateString();
  }
  const dayToUse = preferredDay
    ? Math.min(maxDays, Math.max(1, Number(preferredDay) || 1))
    : (targetYm === currentYm ? new Date().getDate() : Math.min(15, maxDays));
  return `${targetYm}-${String(dayToUse).padStart(2, '0')}`;
};

const MONTH_NAMES_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const MONTH_NAMES_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
];

const formatMonthTitle = (ym) => {
  if (!ym || ym === 'all') return 'За всё время';
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MONTH_NAMES_NOMINATIVE[m - 1]} ${y}`;
};

const formatDateGroupHeader = (dateStr) => {
  const todayStr = getLocalDateString();
  const yesterdayStr = getOffsetDateString(-1);

  if (dateStr === todayStr) return `Сегодня (${dateStr.slice(8, 10)}.${dateStr.slice(5, 7)})`;
  if (dateStr === yesterdayStr) return `Вчера (${dateStr.slice(8, 10)}.${dateStr.slice(5, 7)})`;

  const parts = (dateStr || '').split('-').map(Number);
  if (parts.length !== 3 || !parts[0]) return dateStr;
  const [y, m, d] = parts;
  const currentYear = new Date().getFullYear();
  return `${d} ${MONTH_NAMES_GENITIVE[m - 1] || ''}${y !== currentYear ? ' ' + y : ''}`;
};

// Безопасная загрузка и сохранение в LocalStorage
const loadFromStorage = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (err) {
    console.error(`Failed to load ${key} from localStorage:`, err);
    return fallback;
  }
};

const saveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to save ${key} to localStorage:`, err);
  }
};

// ================= PURE-JS ГЕНЕРАТОР И ПАРСЕР XLSX + CSV =================
const makeCrc32Table = () => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
};
const CRC_TABLE = makeCrc32Table();

const crc32 = (bytes) => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xFF];
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
};

const createZipBytes = (files) => {
  const encoder = new TextEncoder();
  const entries = files.map(f => {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = typeof f.content === 'string' ? encoder.encode(f.content) : f.content;
    const crc = crc32(dataBytes);
    return { nameBytes, dataBytes, crc, offset: 0 };
  });

  let offset = 0;
  const localChunks = [];
  for (const e of entries) {
    e.offset = offset;
    const header = new Uint8Array(30 + e.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0x554a, true);
    view.setUint32(14, e.crc, true);
    view.setUint32(18, e.dataBytes.length, true);
    view.setUint32(22, e.dataBytes.length, true);
    view.setUint16(26, e.nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(e.nameBytes, 30);
    localChunks.push(header, e.dataBytes);
    offset += header.length + e.dataBytes.length;
  }

  const centralStart = offset;
  const centralChunks = [];
  for (const e of entries) {
    const cHeader = new Uint8Array(46 + e.nameBytes.length);
    const view = new DataView(cHeader.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0x554a, true);
    view.setUint32(16, e.crc, true);
    view.setUint32(20, e.dataBytes.length, true);
    view.setUint32(24, e.dataBytes.length, true);
    view.setUint16(28, e.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, e.offset, true);
    cHeader.set(e.nameBytes, 46);
    centralChunks.push(cHeader);
    offset += cHeader.length;
  }

  const centralSize = offset - centralStart;
  const eocd = new Uint8Array(22);
  const eView = new DataView(eocd.buffer);
  eView.setUint32(0, 0x06054b50, true);
  eView.setUint16(4, 0, true);
  eView.setUint16(6, 0, true);
  eView.setUint16(8, entries.length, true);
  eView.setUint16(10, entries.length, true);
  eView.setUint32(12, centralSize, true);
  eView.setUint32(16, centralStart, true);
  eView.setUint16(20, 0, true);

  const out = new Uint8Array(offset + 22);
  let pos = 0;
  for (const chunk of [...localChunks, ...centralChunks, eocd]) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
};

const xmlEscape = (str) => String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const colLetter = (idx) => {
  let s = '';
  let n = idx + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const buildXlsxBytes = (sheets) => {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n  ')}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('\n    ')}
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n  ')}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1C1917"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const files = [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    { name: 'xl/styles.xml', content: stylesXml },
  ];

  sheets.forEach((s, idx) => {
    const rowsXml = s.rows.map((row, rIdx) => {
      const cellsXml = row.map((val, cIdx) => {
        const ref = `${colLetter(cIdx)}${rIdx + 1}`;
        const styleAttr = rIdx === 0 ? ' s="1"' : '';
        if (typeof val === 'number' && Number.isFinite(val)) {
          return `<c r="${ref}"${styleAttr}><v>${val}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${xmlEscape(val ?? '')}</t></is></c>`;
      }).join('');
      return `<row r="${rIdx + 1}">${cellsXml}</row>`;
    }).join('\n    ');

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="14" width="20" customWidth="1"/>
  </cols>
  <sheetData>
    ${rowsXml}
  </sheetData>
</worksheet>`;
    files.push({ name: `xl/worksheets/sheet${idx + 1}.xml`, content: sheetXml });
  });

  return createZipBytes(files);
};

// Экранирование и парсинг CSV (RFC 4180, разделитель `;` или `,`)
const toCsvLine = (fields, sep = ';') => {
  return fields.map(v => {
    const s = String(v ?? '');
    if (s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(sep);
};

const parseCsvText = (text) => {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];
  const firstLine = clean.split(/\r?\n/)[0] || '';
  const sep = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ',';
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        row.push(cur);
        cur = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && clean[i + 1] === '\n') i++;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  row.push(cur);
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
};

// Начальные демонстрационные данные с операциями за август, сентябрь и октябрь 2026
const INITIAL_TRANSACTIONS = [
  // Август 2026 (для глубокого анализа средних расходов по прошлым месяцам)
  { id: 'aug1', title: 'Зарплата (август)', amount: 130000, type: 'income', category: 'Зарплата', account: 'shared', author: 'husband', date: '2026-08-10' },
  { id: 'aug2', title: 'Супермаркеты и фермерская лавка', amount: 23500, type: 'expense', category: 'Продукты', account: 'shared', author: 'husband', date: '2026-08-15' },
  { id: 'aug3', title: 'ЖКУ, свет и вода', amount: 5800, type: 'expense', category: 'Дом и ЖКУ', account: 'shared', author: 'wife', date: '2026-08-18' },
  { id: 'aug4', title: 'Кафе и ужины', amount: 4200, type: 'expense', category: 'Кафе и еда вне дома', account: 'shared', author: 'wife', date: '2026-08-22' },
  { id: 'aug5', title: 'Бензин и ТО', amount: 4800, type: 'expense', category: 'Транспорт и авто', account: 'shared', author: 'husband', date: '2026-08-24' },

  // Сентябрь 2026
  { id: 'sep1', title: 'Зарплата (сентябрь)', amount: 135000, type: 'income', category: 'Зарплата', account: 'shared', author: 'husband', date: '2026-09-10' },
  { id: 'sep2', title: 'Супермаркет (ВкусВилл)', amount: 21500, type: 'expense', category: 'Продукты', account: 'shared', author: 'husband', date: '2026-09-14' },
  { id: 'sep3', title: 'ЖКУ и интернет', amount: 5900, type: 'expense', category: 'Дом и ЖКУ', account: 'shared', author: 'wife', date: '2026-09-18' },
  { id: 'sep4', title: 'Кофейни и рестораны', amount: 3800, type: 'expense', category: 'Кафе и еда вне дома', account: 'shared', author: 'wife', date: '2026-09-21' },
  { id: 'sep5', title: 'В копилку: Отпуск в горах', amount: 20000, type: 'expense', category: 'Накопления', account: 'shared', author: 'husband', date: '2026-09-25', goalId: 'g1' },
  { id: 'sep6', title: 'Платёж по автокредиту', amount: 20000, type: 'expense', category: 'Долги и кредиты', account: 'shared', author: 'husband', date: '2026-09-12', debtId: 'debt_1' },
  { id: 'sep7', title: 'Фриланс мужа', amount: 35000, type: 'income', category: 'Подработка', account: 'personal', author: 'husband', date: '2026-09-20' },
  { id: 'sep8', title: 'Премия жены', amount: 30000, type: 'income', category: 'Другое', account: 'personal', author: 'wife', date: '2026-09-22' },
  { id: 'sep9', title: 'Заправка и парковка', amount: 5200, type: 'expense', category: 'Транспорт и авто', account: 'shared', author: 'husband', date: '2026-09-26' },

  // Октябрь 2026
  { id: '1', title: 'Супермаркет (ВкусВилл)', amount: 25700, type: 'expense', category: 'Продукты', account: 'shared', author: 'husband', date: '2026-10-23' },
  { id: '2', title: 'Кофейня и выпечка', amount: 2200, type: 'expense', category: 'Кафе и еда вне дома', account: 'shared', author: 'wife', date: '2026-10-23' },
  { id: '3', title: 'Аванс по проекту (в общий бюджет)', amount: 120000, type: 'income', category: 'Зарплата', account: 'shared', author: 'husband', date: '2026-10-20' },
  { id: '4', title: 'Оплата ЖКУ и капремонт', amount: 6200, type: 'expense', category: 'Дом и ЖКУ', account: 'shared', author: 'wife', date: '2026-10-18', recurringId: 'rec_2' },
  { id: '5', title: 'В копилку: Отпуск в горах', amount: 15000, type: 'expense', category: 'Накопления', account: 'shared', author: 'husband', date: '2026-10-15', goalId: 'g1' },
  { id: '6', title: 'Фриланс (на личную карту)', amount: 28000, type: 'income', category: 'Подработка', account: 'personal', author: 'husband', date: '2026-10-19' },
  { id: '7', title: 'Игры в Steam и гаджеты', amount: 3200, type: 'expense', category: 'Развлечения и кино', account: 'personal', author: 'husband', date: '2026-10-22' },
  { id: '8', title: 'Премия и кешбэк (личный счет)', amount: 24000, type: 'income', category: 'Другое', account: 'personal', author: 'wife', date: '2026-10-17' },
  { id: '9', title: 'Косметика и уход', amount: 4100, type: 'expense', category: 'Шопинг и вещи', account: 'personal', author: 'wife', date: '2026-10-21' },
  { id: '10', title: 'Платёж по автокредиту', amount: 20000, type: 'expense', category: 'Долги и кредиты', account: 'shared', author: 'husband', date: '2026-10-12', debtId: 'debt_1' },
];

const INITIAL_GOALS = [
  { id: 'g1', title: 'Отпуск в горах', target: 200000, current: 85000, color: 'from-amber-500 to-orange-500', icon: '🏔️' },
  { id: 'g2', title: 'Подушка безопасности', target: 450000, current: 310000, color: 'from-emerald-500 to-teal-500', icon: '🛡️' },
  { id: 'g3', title: 'Апгрейд рабочего места', target: 120000, current: 65000, color: 'from-blue-500 to-indigo-500', icon: '🖥️' },
];

const INITIAL_RECURRING = [
  { id: 'rec_1', title: 'Аренда / Ипотека', amount: 45000, category: 'Дом и ЖКУ', account: 'shared', author: 'husband', dueDate: 5, isMandatory: true, paidMonths: ['2026-10'] },
  { id: 'rec_2', title: 'ЖКУ и капремонт', amount: 6200, category: 'Дом и ЖКУ', account: 'shared', author: 'wife', dueDate: 15, isMandatory: true, paidMonths: ['2026-10'] },
  { id: 'rec_3', title: 'Домашний интернет и ТВ', amount: 950, category: 'Связь и интернет', account: 'shared', author: 'husband', dueDate: 25, isMandatory: true, paidMonths: [] },
  { id: 'rec_5', title: 'Мобильная связь (2 номера)', amount: 1400, category: 'Связь и интернет', account: 'shared', author: 'wife', dueDate: 27, isMandatory: true, paidMonths: [] },
  { id: 'rec_4', title: 'Детский сад / Секции', amount: 12000, category: 'Дети и секции', account: 'shared', author: 'wife', dueDate: 28, isMandatory: true, paidMonths: [] },
];

const INITIAL_DEBTS = [
  { id: 'debt_1', title: 'Автокредит', initialAmount: 600000, remainingAmount: 240000, monthlyPayment: 20000, paymentDay: 12, account: 'shared', author: 'husband', paidMonths: ['2026-10'], icon: '🚗', color: 'from-amber-500 to-rose-500' },
  { id: 'debt_2', title: 'Рассрочка на технику', initialAmount: 90000, remainingAmount: 30000, monthlyPayment: 15000, paymentDay: 26, account: 'shared', author: 'husband', paidMonths: [], icon: '📱', color: 'from-blue-500 to-indigo-500' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'food', name: 'Продукты', icon: '🛒', color: 'bg-emerald-50 text-emerald-700', bucket: 'base' },
  { id: 'home', name: 'Дом и ЖКУ', icon: '🏠', color: 'bg-blue-50 text-blue-700', bucket: 'base' },
  { id: 'telecom', name: 'Связь и интернет', icon: '📡', color: 'bg-cyan-50 text-cyan-700', bucket: 'base' },
  { id: 'transport', name: 'Транспорт и авто', icon: '🚗', color: 'bg-purple-50 text-purple-700', bucket: 'base' },
  { id: 'kids', name: 'Дети и секции', icon: '🧸', color: 'bg-orange-50 text-orange-700', bucket: 'base' },
  { id: 'health', name: 'Здоровье и спорт', icon: '🌿', color: 'bg-teal-50 text-teal-700', bucket: 'base' },
  { id: 'cafe', name: 'Кафе и еда вне дома', icon: '☕', color: 'bg-amber-50 text-amber-700', bucket: 'wants' },
  { id: 'leisure', name: 'Развлечения и кино', icon: '🎬', color: 'bg-pink-50 text-pink-700', bucket: 'wants' },
  { id: 'shopping', name: 'Шопинг и вещи', icon: '🛍️', color: 'bg-indigo-50 text-indigo-700', bucket: 'wants' },
  { id: 'savings', name: 'Накопления', icon: '🎯', color: 'bg-violet-50 text-violet-700', bucket: 'future' },
  { id: 'debts', name: 'Долги и кредиты', icon: '💳', color: 'bg-rose-50 text-rose-700', bucket: 'future' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { id: 'salary', name: 'Зарплата', icon: '💰', color: 'bg-emerald-50 text-emerald-700' },
  { id: 'freelance', name: 'Подработка', icon: '💻', color: 'bg-blue-50 text-blue-700' },
  { id: 'investments', name: 'Инвестиции', icon: '📈', color: 'bg-amber-50 text-amber-700' },
  { id: 'gifts', name: 'Подарки', icon: '🎁', color: 'bg-pink-50 text-pink-700' },
  { id: 'other_income', name: 'Другое', icon: '💵', color: 'bg-stone-100 text-stone-700' },
];

const GOAL_COLOR_PRESETS = [
  { label: 'Янтарь', value: 'from-amber-500 to-orange-500' },
  { label: 'Изумруд', value: 'from-emerald-500 to-teal-500' },
  { label: 'Синий', value: 'from-blue-500 to-indigo-500' },
  { label: 'Фиолетовый', value: 'from-purple-500 to-pink-500' },
  { label: 'Рубин', value: 'from-rose-500 to-red-500' },
];

const QUICK_GOAL_ICONS = ['🎯', '🏔️', '🛡️', '🖥️', '🚗', '🏖️', '🏡', '💍', '👶', '🎓', '📱'];

const CATEGORY_ALIASES = {
  'работа': { id: 'freelance', name: 'Подработка', icon: '💻', color: 'bg-blue-50 text-blue-700' },
  'дом': { id: 'home', name: 'Дом и ЖКУ', icon: '🏠', color: 'bg-blue-50 text-blue-700', bucket: 'base' },
  'кафе': { id: 'cafe', name: 'Кафе и еда вне дома', icon: '☕', color: 'bg-amber-50 text-amber-700', bucket: 'wants' },
  'транспорт': { id: 'transport', name: 'Транспорт и авто', icon: '🚗', color: 'bg-purple-50 text-purple-700', bucket: 'base' },
  'развлечения': { id: 'leisure', name: 'Развлечения и кино', icon: '🎬', color: 'bg-pink-50 text-pink-700', bucket: 'wants' },
  'здоровье': { id: 'health', name: 'Здоровье и спорт', icon: '🌿', color: 'bg-teal-50 text-teal-700', bucket: 'base' },
  'шопинг': { id: 'shopping', name: 'Шопинг и вещи', icon: '🛍️', color: 'bg-indigo-50 text-indigo-700', bucket: 'wants' },
  'долги': { id: 'debts', name: 'Долги и кредиты', icon: '💳', color: 'bg-rose-50 text-rose-700', bucket: 'future' },
  'связь': { id: 'telecom', name: 'Связь и интернет', icon: '📡', color: 'bg-cyan-50 text-cyan-700', bucket: 'base' },
};

const getCategoryMeta = (categoryName, type, customCategories = []) => {
  const normName = (categoryName || '').trim().toLowerCase();
  const all = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES, ...customCategories];
  const found = all.find(c => c.name.toLowerCase() === normName);
  if (found) return found;

  if (CATEGORY_ALIASES[normName]) {
    return CATEGORY_ALIASES[normName];
  }

  if (type === 'income') {
    return { id: 'custom_inc', name: categoryName || 'Доход', icon: '💵', color: 'bg-emerald-50 text-emerald-700' };
  }
  const isBaseWord = normName.includes('продукт') || normName.includes('дом') || normName.includes('жку') || normName.includes('связ') || normName.includes('интернет') || normName.includes('транспорт') || normName.includes('здоров') || normName.includes('дет') || normName.includes('аптек');
  return { id: 'custom_exp', name: categoryName || 'Расход', icon: '📦', color: 'bg-stone-100 text-stone-700', bucket: isBaseWord ? 'base' : 'wants' };
};

// Проверка: является ли операция накоплением или платежом по долгу
const isSavingsOrDebtTx = (tx) => {
  if (!tx) return false;
  if (tx.goalId || tx.debtId) return true;
  const cat = (tx.category || '').toLowerCase();
  return cat === 'накопления' || cat === 'долги и кредиты' || cat === 'долги' || cat === 'кредиты';
};

// Определение статуса напоминалки для регулярного платежа
const getRecurringReminderStatus = (rec, targetYm) => {
  const isPaid = (rec.paidMonths || []).includes(targetYm);
  if (isPaid) {
    return { code: 'paid', label: '✓ Оплачено', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', daysDiff: 999 };
  }
  const currentYm = getCurrentMonthPrefix();
  const due = Number(rec.dueDate) || 1;
  if (targetYm < currentYm) {
    return { code: 'overdue', label: `Пропущен (${due}-е число)`, badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold', daysDiff: -30 };
  }
  if (targetYm > currentYm) {
    return { code: 'planned', label: `По плану до ${due}-го`, badgeClass: 'bg-stone-100 text-stone-600 border-stone-200', daysDiff: 30 };
  }
  const todayDay = new Date().getDate();
  const diff = due - todayDay;
  if (diff < 0) {
    return { code: 'overdue', label: `Просрочен на ${Math.abs(diff)} дн. (до ${due}-го)`, badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold', daysDiff: diff };
  }
  if (diff === 0) {
    return { code: 'today', label: `Оплата сегодня (${due}-е число)!`, badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold', daysDiff: 0 };
  }
  if (diff <= 5) {
    return { code: 'soon', label: `Скоро: через ${diff} дн. (до ${due}-го)`, badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold', daysDiff: diff };
  }
  return { code: 'upcoming', label: `До ${due}-го числа (через ${diff} дн.)`, badgeClass: 'bg-stone-100 text-stone-600 border-stone-200', daysDiff: diff };
};

export default function FamilyBudgetApp() {
  const [currentUser, setCurrentUser] = useState('husband'); // 'husband' | 'wife'
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'history' | 'goals' | 'debts'
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthPrefix); // 'YYYY-MM' | 'all'

  // Фокус кошелька в дашборде: 'shared' | 'husband' | 'wife'
  const [activeWalletCard, setActiveWalletCard] = useState('shared');

  // Вид аналитических графиков на вкладке «Обзор»: 'burndown' | 'rule503020' | 'dynamics'
  const [chartView, setChartView] = useState('burndown');

  // Хранилища состояния
  const [transactions, setTransactions] = useState(() =>
    loadFromStorage('family_budget_txs', INITIAL_TRANSACTIONS)
  );
  const [goals, setGoals] = useState(() =>
    loadFromStorage('family_budget_goals', INITIAL_GOALS)
  );
  const [recurringPayments, setRecurringPayments] = useState(() =>
    loadFromStorage('family_budget_recurring', INITIAL_RECURRING)
  );
  const [debts, setDebts] = useState(() =>
    loadFromStorage('family_budget_debts', INITIAL_DEBTS)
  );
  const [customCategories, setCustomCategories] = useState(() =>
    loadFromStorage('family_budget_custom_categories', [])
  );
  // Пользовательские плановые лимиты по категориям на месяц: { [categoryName]: number }
  const [plannedCategoryLimits, setPlannedCategoryLimits] = useState(() =>
    loadFromStorage('family_budget_planned_limits', {})
  );

  // Модальные окна
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [isNewRecurringModalOpen, setIsNewRecurringModalOpen] = useState(false);
  const [editingRecurringId, setEditingRecurringId] = useState(null);
  const [isPayRecurringModalOpen, setIsPayRecurringModalOpen] = useState(false);
  const [isNewDebtModalOpen, setIsNewDebtModalOpen] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState(null);
  const [isPayDebtModalOpen, setIsPayDebtModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Форма добавления / редактирования операции + Режим пачки чеков
  const [amount, setAmount] = useState('');
  const [txTitle, setTxTitle] = useState('');
  const [txType, setTxType] = useState('expense'); // 'expense' | 'income'
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0].name);
  const [selectedAccount, setSelectedAccount] = useState('shared'); // 'shared' | 'personal'
  const [txAuthor, setTxAuthor] = useState('husband');
  const [txDate, setTxDate] = useState(getLocalDateString);
  const [isBatchReceiptMode, setIsBatchReceiptMode] = useState(false);

  // Календарь чеков во вкладке «Операции»
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  // Инлайн управление своими категориями
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🏷️');
  const [newCatBucket, setNewCatBucket] = useState('base');

  // Форма пополнения / вывода из копилки
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [goalActionMode, setGoalActionMode] = useState('contribute');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalSourceAccount, setGoalSourceAccount] = useState('shared');
  const [goalActionDate, setGoalActionDate] = useState(getLocalDateString);

  // Форма создания / редактирования цели
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalCurrent, setNewGoalCurrent] = useState('0');
  const [newGoalIcon, setNewGoalIcon] = useState('🎯');
  const [newGoalColor, setNewGoalColor] = useState(GOAL_COLOR_PRESETS[0].value);

  // Форма создания / редактирования постоянного платежа
  const [newRecTitle, setNewRecTitle] = useState('');
  const [newRecAmount, setNewRecAmount] = useState('');
  const [newRecCategory, setNewRecCategory] = useState('Дом и ЖКУ');
  const [newRecDueDate, setNewRecDueDate] = useState('15');
  const [newRecAccount, setNewRecAccount] = useState('shared');
  const [newRecAuthor, setNewRecAuthor] = useState('husband');
  const [newRecMandatory, setNewRecMandatory] = useState(true);

  // Модалка подтверждения оплаты постоянного платежа
  const [selectedRecurringToPay, setSelectedRecurringToPay] = useState(null);
  const [recPayAmount, setRecPayAmount] = useState('');
  const [recPayDate, setRecPayDate] = useState(getLocalDateString);

  // Форма создания / редактирования кредита/долга
  const [newDebtTitle, setNewDebtTitle] = useState('');
  const [newDebtInitial, setNewDebtInitial] = useState('');
  const [newDebtRemaining, setNewDebtRemaining] = useState('');
  const [newDebtPayment, setNewDebtPayment] = useState('');
  const [newDebtDay, setNewDebtDay] = useState('12');
  const [newDebtAccount, setNewDebtAccount] = useState('shared');
  const [newDebtAuthor, setNewDebtAuthor] = useState('husband');
  const [newDebtIcon, setNewDebtIcon] = useState('💳');
  const [newDebtColor, setNewDebtColor] = useState(GOAL_COLOR_PRESETS[4].value);

  // Форма внесения платежа по долгу
  const [selectedDebtId, setSelectedDebtId] = useState(null);
  const [debtPayAmount, setDebtPayAmount] = useState('');
  const [debtSourceAccount, setDebtSourceAccount] = useState('shared');
  const [debtSourceAuthor, setDebtSourceAuthor] = useState('husband');
  const [debtPayDate, setDebtPayDate] = useState(getLocalDateString);

  // Редактирование планового лимита категории
  const [editingPlanCategory, setEditingPlanCategory] = useState(null);
  const [editingPlanValue, setEditingPlanValue] = useState('');

  // Поиск и компактная фильтрация
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAuthor, setFilterAuthor] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');

  // Система мягких уведомлений и отмены удаления (Undo Toast)
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const showToast = (message, onUndo = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, onUndo });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 6000);
  };

  // Сохранение в LocalStorage
  useEffect(() => {
    saveToStorage('family_budget_txs', transactions);
  }, [transactions]);

  useEffect(() => {
    saveToStorage('family_budget_goals', goals);
  }, [goals]);

  useEffect(() => {
    saveToStorage('family_budget_recurring', recurringPayments);
  }, [recurringPayments]);

  useEffect(() => {
    saveToStorage('family_budget_debts', debts);
  }, [debts]);

  useEffect(() => {
    saveToStorage('family_budget_custom_categories', customCategories);
  }, [customCategories]);

  useEffect(() => {
    saveToStorage('family_budget_planned_limits', plannedCategoryLimits);
  }, [plannedCategoryLimits]);

  // Закрытие модальных окон по Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsAddModalOpen(false);
        setIsGoalModalOpen(false);
        setIsNewGoalModalOpen(false);
        setIsNewRecurringModalOpen(false);
        setIsPayRecurringModalOpen(false);
        setIsNewDebtModalOpen(false);
        setIsPayDebtModalOpen(false);
        setIsExportModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Переключение месяца
  const stepMonth = (delta) => {
    setSelectedCalendarDate(null);
    if (selectedMonth === 'all') {
      setSelectedMonth(getCurrentMonthPrefix());
      return;
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const nextYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextYm);
  };

  // Список категорий для активного типа
  const activeCategories = useMemo(() => {
    if (txType === 'income') {
      return [...DEFAULT_INCOME_CATEGORIES, ...customCategories.filter(c => c.type === 'income')];
    }
    return [...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type !== 'income')];
  }, [txType, customCategories]);

  // Дата окончания выбранного месяца для расчета кумулятивного остатка
  const endOfSelectedMonth = useMemo(() => {
    if (!selectedMonth || selectedMonth === 'all') return '9999-12-31';
    const [y, m] = selectedMonth.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    return `${selectedMonth}-${String(days).padStart(2, '0')}`;
  }, [selectedMonth]);

  // Транзакции, отфильтрованные строго по выбранному месяцу
  const periodTransactions = useMemo(() => {
    const filtered = selectedMonth === 'all'
      ? transactions
      : transactions.filter(t => (t.date || '').startsWith(selectedMonth));

    return [...filtered].sort((a, b) => {
      const cmp = (b.date || '').localeCompare(a.date || '');
      if (cmp !== 0) return cmp;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [transactions, selectedMonth]);

  // Транзакции прошлого месяца для расчета авто-маркеров динамики трат
  const previousMonthTransactions = useMemo(() => {
    if (!selectedMonth || selectedMonth === 'all') return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    return transactions.filter(t => (t.date || '').startsWith(prevYm));
  }, [transactions, selectedMonth]);

  // Неоплаченные обязательные платежи и кредиты по кошелькам в выбранном месяце
  const mandatoryReservesByWallet = useMemo(() => {
    const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
    const reserves = { shared: 0, husband: 0, wife: 0, total: 0 };

    recurringPayments.forEach(r => {
      if (!r.isMandatory) return;
      if ((r.paidMonths || []).includes(targetYm)) return;
      const val = Number(r.amount) || 0;
      if ((r.account || 'shared') === 'shared') {
        reserves.shared += val;
      } else if (r.author === 'wife') {
        reserves.wife += val;
      } else {
        reserves.husband += val;
      }
      reserves.total += val;
    });

    debts.forEach(d => {
      if ((Number(d.remainingAmount) || 0) <= 0) return;
      if ((d.paidMonths || []).includes(targetYm)) return;
      const val = Math.min(Number(d.remainingAmount) || 0, Number(d.monthlyPayment) || 0);
      if ((d.account || 'shared') === 'shared') {
        reserves.shared += val;
      } else if (d.author === 'wife') {
        reserves.wife += val;
      } else {
        reserves.husband += val;
      }
      reserves.total += val;
    });

    return reserves;
  }, [recurringPayments, debts, selectedMonth]);

  const unpaidMandatoryThisMonth = mandatoryReservesByWallet.total;

  // Количество ожидающих оплаты счетов и список горящих напоминаний
  const reminderSummary = useMemo(() => {
    const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
    const unpaidRecList = recurringPayments
      .filter(r => !(r.paidMonths || []).includes(targetYm))
      .map(r => ({ ...r, status: getRecurringReminderStatus(r, targetYm) }))
      .sort((a, b) => a.status.daysDiff - b.status.daysDiff);

    const unpaidDebtList = debts
      .filter(d => (Number(d.remainingAmount) || 0) > 0 && !(d.paidMonths || []).includes(targetYm));

    const urgentRecs = unpaidRecList.filter(r => r.status.code === 'overdue' || r.status.code === 'today' || r.status.code === 'soon');

    return {
      pendingCount: unpaidRecList.filter(r => r.isMandatory).length + unpaidDebtList.length,
      unpaidRecList,
      unpaidDebtList,
      urgentRecs,
    };
  }, [recurringPayments, debts, selectedMonth]);

  const pendingBillsCount = reminderSummary.pendingCount;

  // ================= АНАЛИЗ ПРОШЛЫХ МЕСЯЦЕВ И ПРОГНОЗ РАСХОДОВ =================
  const expenseForecastData = useMemo(() => {
    const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;

    const pastMonthsSet = new Set();
    const historyByCatAndMonth = {};

    transactions.forEach(t => {
      if (t.type !== 'expense' || isSavingsOrDebtTx(t)) return;
      const ym = (t.date || '').slice(0, 7);
      if (!ym || ym >= targetYm) return;

      const acc = t.account || 'shared';
      const matchesWallet =
        (activeWalletCard === 'shared' && acc === 'shared') ||
        (activeWalletCard === 'husband' && acc === 'personal' && t.author === 'husband') ||
        (activeWalletCard === 'wife' && acc === 'personal' && t.author === 'wife');
      if (!matchesWallet) return;

      pastMonthsSet.add(ym);
      const cat = t.category || 'Прочее';
      if (!historyByCatAndMonth[cat]) historyByCatAndMonth[cat] = {};
      historyByCatAndMonth[cat][ym] = (historyByCatAndMonth[cat][ym] || 0) + (Number(t.amount) || 0);
    });

    const pastMonthsList = Array.from(pastMonthsSet).sort();
    const numPastMonths = Math.max(1, pastMonthsList.length);
    const prevYm = (() => {
      const [y, m] = targetYm.split('-').map(Number);
      const pd = new Date(y, m - 2, 1);
      return `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
    })();

    const currentActualByCat = {};
    periodTransactions.forEach(t => {
      if (t.type !== 'expense' || isSavingsOrDebtTx(t)) return;
      const acc = t.account || 'shared';
      const matchesWallet =
        (activeWalletCard === 'shared' && acc === 'shared') ||
        (activeWalletCard === 'husband' && acc === 'personal' && t.author === 'husband') ||
        (activeWalletCard === 'wife' && acc === 'personal' && t.author === 'wife');
      if (!matchesWallet) return;
      const cat = t.category || 'Прочее';
      currentActualByCat[cat] = (currentActualByCat[cat] || 0) + (Number(t.amount) || 0);
    });

    const recurringByCat = {};
    recurringPayments.forEach(r => {
      const acc = r.account || 'shared';
      const matchesWallet =
        (activeWalletCard === 'shared' && acc === 'shared') ||
        (activeWalletCard === 'husband' && acc === 'personal' && r.author === 'husband') ||
        (activeWalletCard === 'wife' && acc === 'personal' && r.author === 'wife');
      if (!matchesWallet) return;
      const cat = r.category || 'Дом и ЖКУ';
      recurringByCat[cat] = (recurringByCat[cat] || 0) + (Number(r.amount) || 0);
    });

    const allCatNames = new Set([
      ...DEFAULT_EXPENSE_CATEGORIES.filter(c => c.id !== 'savings' && c.id !== 'debts').map(c => c.name),
      ...customCategories.filter(c => c.type !== 'income').map(c => c.name),
      ...Object.keys(historyByCatAndMonth),
      ...Object.keys(currentActualByCat),
      ...Object.keys(recurringByCat),
    ]);

    const rows = [];
    let totalAutoForecast = 0;
    let totalPlannedBudget = 0;
    let totalCurrentActual = 0;

    allCatNames.forEach(catName => {
      const monthMap = historyByCatAndMonth[catName] || {};
      const totalHist = Object.values(monthMap).reduce((a, b) => a + b, 0);
      const avgHistorical = pastMonthsList.length > 0 ? Math.round(totalHist / numPastMonths) : 0;
      const prevMonthSum = monthMap[prevYm] || 0;
      const recSum = recurringByCat[catName] || 0;
      const currentActual = currentActualByCat[catName] || 0;

      const autoSuggested = Math.max(avgHistorical, recSum);
      const userCustomLimit = plannedCategoryLimits[catName];
      const effectivePlan = userCustomLimit !== undefined && userCustomLimit !== null
        ? Number(userCustomLimit)
        : autoSuggested;

      if (effectivePlan === 0 && currentActual === 0 && avgHistorical === 0 && recSum === 0) return;

      const meta = getCategoryMeta(catName, 'expense', customCategories);
      const remainingPlan = Math.max(0, effectivePlan - currentActual);
      const isOverPlan = effectivePlan > 0 && currentActual > effectivePlan;
      const pctUsed = effectivePlan > 0 ? Math.round((currentActual / effectivePlan) * 100) : (currentActual > 0 ? 100 : 0);

      totalAutoForecast += autoSuggested;
      totalPlannedBudget += effectivePlan;
      totalCurrentActual += currentActual;

      rows.push({
        category: catName,
        meta,
        avgHistorical,
        prevMonthSum,
        recSum,
        autoSuggested,
        userCustomLimit,
        effectivePlan,
        currentActual,
        remainingPlan,
        isOverPlan,
        pctUsed,
      });
    });

    rows.sort((a, b) => Math.max(b.effectivePlan, b.currentActual) - Math.max(a.effectivePlan, a.currentActual));

    return {
      rows,
      pastMonthsCount: pastMonthsList.length,
      totalAutoForecast,
      totalPlannedBudget,
      totalCurrentActual,
    };
  }, [transactions, periodTransactions, recurringPayments, customCategories, plannedCategoryLimits, selectedMonth, activeWalletCard]);

  // ================= ФИНАНСОВОЕ МАТЕМАТИЧЕСКОЕ ЯДРО v0.6.5 =================
  const stats = useMemo(() => {
    const shared = {
      income: 0,
      expense: 0,
      balance: 0,
      monthIncome: 0,
      monthExpense: 0,
      husbandIncome: 0,
      wifeIncome: 0,
      husbandConsumerSpent: 0,
      wifeConsumerSpent: 0,
      consumerExpense: 0,
      savedAndDebtPaid: 0,
    };

    const husbandPersonal = {
      income: 0,
      expense: 0,
      balance: 0,
      monthIncome: 0,
      monthExpense: 0,
      savedAndDebtPaid: 0,
    };

    const wifePersonal = {
      income: 0,
      expense: 0,
      balance: 0,
      monthIncome: 0,
      monthExpense: 0,
      savedAndDebtPaid: 0,
    };

    const categoryTotals = {};
    const prevCategoryTotals = {};

    transactions.forEach(t => {
      const txDateStr = t.date || '';
      if (txDateStr > endOfSelectedMonth) return;

      const val = Number(t.amount) || 0;
      const acc = t.account || 'shared';

      if (acc === 'shared') {
        if (t.type === 'income') shared.income += val;
        else shared.expense += val;
      } else {
        const target = t.author === 'wife' ? wifePersonal : husbandPersonal;
        if (t.type === 'income') target.income += val;
        else target.expense += val;
      }
    });

    shared.balance = shared.income - shared.expense;
    husbandPersonal.balance = husbandPersonal.income - husbandPersonal.expense;
    wifePersonal.balance = wifePersonal.income - wifePersonal.expense;

    periodTransactions.forEach(t => {
      const val = Number(t.amount) || 0;
      const acc = t.account || 'shared';
      const isSavingOrDebt = isSavingsOrDebtTx(t);

      if (acc === 'shared') {
        if (t.type === 'income') {
          shared.monthIncome += val;
          if (t.author === 'husband') shared.husbandIncome += val;
          if (t.author === 'wife') shared.wifeIncome += val;
        } else {
          shared.monthExpense += val;
          if (isSavingOrDebt) {
            shared.savedAndDebtPaid += val;
          } else {
            shared.consumerExpense += val;
            if (t.author === 'husband') shared.husbandConsumerSpent += val;
            if (t.author === 'wife') shared.wifeConsumerSpent += val;
          }
        }
      } else {
        const target = t.author === 'wife' ? wifePersonal : husbandPersonal;
        if (t.type === 'income') {
          target.monthIncome += val;
        } else {
          target.monthExpense += val;
          if (isSavingOrDebt) {
            target.savedAndDebtPaid += val;
          }
        }
      }

      const matchesWalletFilter =
        (activeWalletCard === 'shared' && acc === 'shared') ||
        (activeWalletCard === 'husband' && acc === 'personal' && t.author === 'husband') ||
        (activeWalletCard === 'wife' && acc === 'personal' && t.author === 'wife');

      if (t.type === 'expense' && matchesWalletFilter && !isSavingOrDebt) {
        const catName = t.category || 'Прочее';
        categoryTotals[catName] = (categoryTotals[catName] || 0) + val;
      }
    });

    previousMonthTransactions.forEach(t => {
      const val = Number(t.amount) || 0;
      const acc = t.account || 'shared';
      const isSavingOrDebt = isSavingsOrDebtTx(t);

      const matchesWalletFilter =
        (activeWalletCard === 'shared' && acc === 'shared') ||
        (activeWalletCard === 'husband' && acc === 'personal' && t.author === 'husband') ||
        (activeWalletCard === 'wife' && acc === 'personal' && t.author === 'wife');

      if (t.type === 'expense' && matchesWalletFilter && !isSavingOrDebt) {
        const catName = t.category || 'Прочее';
        prevCategoryTotals[catName] = (prevCategoryTotals[catName] || 0) + val;
      }
    });

    const totalSavings = goals.reduce((acc, g) => acc + (Number(g.current) || 0), 0);
    const totalTargetSavings = goals.reduce((acc, g) => acc + (Number(g.target) || 0), 0);
    const totalDebtRemaining = debts.reduce((acc, d) => acc + (Number(d.remainingAmount) || 0), 0);
    const totalDebtInitial = debts.reduce((acc, d) => acc + (Number(d.initialAmount) || 0), 0);

    const today = new Date();
    const currentYm = getCurrentMonthPrefix();
    const isPastMonth = selectedMonth !== 'all' && selectedMonth < currentYm;
    let daysLeft = 1;
    let daysInMonth = 30;

    if (selectedMonth !== 'all') {
      const [y, m] = selectedMonth.split('-').map(Number);
      daysInMonth = new Date(y, m, 0).getDate();
      if (selectedMonth === currentYm) {
        daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
      } else if (isPastMonth) {
        daysLeft = 1;
      } else {
        daysLeft = daysInMonth;
      }
    } else {
      const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      daysLeft = Math.max(1, dim - today.getDate() + 1);
      daysInMonth = dim;
    }

    const activeBalance =
      activeWalletCard === 'husband'
        ? husbandPersonal.balance
        : activeWalletCard === 'wife'
        ? wifePersonal.balance
        : shared.balance;

    const activeSavedAndDebtPaid =
      activeWalletCard === 'husband'
        ? husbandPersonal.savedAndDebtPaid
        : activeWalletCard === 'wife'
        ? wifePersonal.savedAndDebtPaid
        : shared.savedAndDebtPaid;

    const reserveToDeduct = isPastMonth
      ? 0
      : activeWalletCard === 'husband'
      ? mandatoryReservesByWallet.husband
      : activeWalletCard === 'wife'
      ? mandatoryReservesByWallet.wife
      : mandatoryReservesByWallet.shared;

    const safeBalance = Math.max(0, activeBalance - reserveToDeduct);
    const dailyAvailable = isPastMonth ? safeBalance : Math.max(0, Math.round(safeBalance / daysLeft));

    const totalSelectedExpense = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    const hasAnyPrevMonthData = previousMonthTransactions.length > 0;
    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, sum]) => {
        const prevSum = prevCategoryTotals[name] || 0;
        const diff = hasAnyPrevMonthData ? sum - prevSum : 0;
        return {
          name,
          sum,
          percent: totalSelectedExpense > 0 ? Math.round((sum / totalSelectedExpense) * 100) : 0,
          meta: getCategoryMeta(name, 'expense', customCategories),
          prevSum,
          diff,
          isNewInMonth: hasAnyPrevMonthData && prevSum === 0 && sum > 0,
        };
      });

    let prevMonthShortName = 'прошл. мес.';
    if (selectedMonth && selectedMonth !== 'all') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      prevMonthShortName = MONTH_NAMES_SHORT[prevDate.getMonth()];
    }

    return {
      shared,
      husbandPersonal,
      wifePersonal,
      totalSavings,
      totalTargetSavings,
      totalDebtRemaining,
      totalDebtInitial,
      dailyAvailable,
      safeBalance,
      reserveToDeduct,
      activeSavedAndDebtPaid,
      daysLeft,
      daysInMonth,
      isPastMonth,
      topCategories,
      totalSelectedExpense,
      unpaidMandatoryThisMonth,
      prevMonthShortName,
    };
  }, [transactions, periodTransactions, previousMonthTransactions, goals, debts, selectedMonth, endOfSelectedMonth, activeWalletCard, customCategories, mandatoryReservesByWallet, unpaidMandatoryThisMonth]);

  // Открытие модалки создания новой операции
  const openNewTransactionModal = (presetAccount = null, presetAuthor = null, presetDate = null) => {
    setEditingTxId(null);
    setAmount('');
    setTxTitle('');
    setTxType('expense');
    setSelectedCategory(DEFAULT_EXPENSE_CATEGORIES[0].name);

    if (presetAccount) {
      setSelectedAccount(presetAccount);
      setTxAuthor(presetAuthor || currentUser);
    } else if (activeWalletCard === 'shared') {
      setSelectedAccount('shared');
      setTxAuthor(currentUser);
    } else if (activeWalletCard === 'husband') {
      setSelectedAccount('personal');
      setTxAuthor('husband');
    } else {
      setSelectedAccount('personal');
      setTxAuthor('wife');
    }

    const defaultDate = presetDate || selectedCalendarDate || getTargetDateForMonth(selectedMonth);
    setTxDate(defaultDate);
    setIsAddingCustomCategory(false);
    setIsManagingCategories(false);
    setIsAddModalOpen(true);
  };

  // Открытие модалки редактирования существующей операции
  const openEditTransactionModal = (tx) => {
    setEditingTxId(tx.id);
    setAmount(String(tx.amount));
    setTxTitle(tx.title === tx.category ? '' : tx.title);
    setTxType(tx.type);
    setSelectedCategory(tx.category);
    setSelectedAccount(tx.account || 'shared');
    setTxAuthor(tx.author || currentUser);
    setTxDate(tx.date || getLocalDateString());
    setIsAddingCustomCategory(false);
    setIsManagingCategories(false);
    setIsAddModalOpen(true);
  };

  const isEditingLockedType = useMemo(() => {
    if (!editingTxId) return false;
    const tx = transactions.find(t => t.id === editingTxId);
    return Boolean(tx?.goalId || tx?.debtId);
  }, [editingTxId, transactions]);

  const handleTypeChange = (newType) => {
    if (isEditingLockedType) return;
    setTxType(newType);
    setIsAddingCustomCategory(false);
    if (newType === 'income') {
      const isAlreadyIncome = [...DEFAULT_INCOME_CATEGORIES, ...customCategories.filter(c => c.type === 'income')].some(c => c.name === selectedCategory);
      if (!isAlreadyIncome) setSelectedCategory(DEFAULT_INCOME_CATEGORIES[0].name);
    } else {
      const isAlreadyExpense = [...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type !== 'income')].some(c => c.name === selectedCategory);
      if (!isAlreadyExpense) setSelectedCategory(DEFAULT_EXPENSE_CATEGORIES[0].name);
    }
  };

  // Создание пользовательской категории
  const handleCreateCustomCategory = (e) => {
    e?.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;

    const exists = activeCategories.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setSelectedCategory(trimmed);
      setNewCatName('');
      setIsAddingCustomCategory(false);
      return;
    }

    const newCat = {
      id: 'cat_' + Date.now(),
      name: trimmed,
      icon: newCatIcon.trim() || (txType === 'income' ? '💵' : '🏷️'),
      color: txType === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-700',
      type: txType,
      bucket: txType === 'income' ? 'income' : newCatBucket,
    };
    setCustomCategories(prev => [...prev, newCat]);
    setSelectedCategory(trimmed);
    setNewCatName('');
    setIsAddingCustomCategory(false);
    showToast(`Категория «${trimmed}» добавлена`);
  };

  const handleDeleteCustomCategory = (e, catId) => {
    e?.stopPropagation();
    const cat = customCategories.find(c => c.id === catId);
    if (!cat) return;

    setCustomCategories(prev => prev.filter(c => c.id !== catId));
    if (selectedCategory === cat.name) {
      setSelectedCategory(txType === 'income' ? DEFAULT_INCOME_CATEGORIES[0].name : DEFAULT_EXPENSE_CATEGORIES[0].name);
    }

    showToast(`Категория «${cat.name}» удалена`, () => {
      setCustomCategories(prev => [...prev, cat]);
      setSelectedCategory(cat.name);
      setToast(null);
    });
  };

  // Сохранение (добавление или редактирование) транзакции с поддержкой режима «Пачка чеков»
  const handleSaveTransaction = (e, keepOpenOverride = false) => {
    e?.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) return;

    const finalDate = txDate || getLocalDateString();
    const finalTitle = txTitle.trim() || selectedCategory;

    if (editingTxId) {
      const oldTx = transactions.find(t => t.id === editingTxId);
      setTransactions(prev =>
        prev.map(t =>
          t.id === editingTxId
            ? {
                ...t,
                title: finalTitle,
                amount: num,
                type: isEditingLockedType ? t.type : txType,
                category: isEditingLockedType ? t.category : selectedCategory,
                account: selectedAccount,
                author: txAuthor,
                date: finalDate,
              }
            : t
        )
      );

      if (oldTx && oldTx.goalId && oldTx.amount !== num) {
        const diff = num - (Number(oldTx.amount) || 0);
        const signedDiff = oldTx.type === 'income' ? -diff : diff;
        setGoals(prev =>
          prev.map(g =>
            g.id === oldTx.goalId
              ? { ...g, current: Math.max(0, (Number(g.current) || 0) + signedDiff) }
              : g
          )
        );
      }

      if (oldTx && oldTx.debtId && oldTx.amount !== num) {
        const diff = num - (Number(oldTx.amount) || 0);
        setDebts(prev =>
          prev.map(d =>
            d.id === oldTx.debtId
              ? { ...d, remainingAmount: Math.max(0, (Number(d.remainingAmount) || 0) - diff) }
              : d
          )
        );
      }

      if (oldTx && (oldTx.debtId || oldTx.recurringId)) {
        const oldYm = (oldTx.date || '').slice(0, 7);
        const newYm = finalDate.slice(0, 7);
        if (oldYm !== newYm) {
          if (oldTx.debtId) {
            const hasOtherInOld = transactions.some(
              t => t.id !== editingTxId && t.debtId === oldTx.debtId && (t.date || '').startsWith(oldYm)
            );
            setDebts(prev =>
              prev.map(d =>
                d.id === oldTx.debtId
                  ? {
                      ...d,
                      paidMonths: Array.from(new Set([
                        ...(hasOtherInOld ? (d.paidMonths || []) : (d.paidMonths || []).filter(m => m !== oldYm)),
                        newYm
                      ])),
                    }
                  : d
              )
            );
          }
          if (oldTx.recurringId) {
            const hasOtherInOld = transactions.some(
              t => t.id !== editingTxId && t.recurringId === oldTx.recurringId && (t.date || '').startsWith(oldYm)
            );
            setRecurringPayments(prev =>
              prev.map(r =>
                r.id === oldTx.recurringId
                  ? {
                      ...r,
                      paidMonths: Array.from(new Set([
                        ...(hasOtherInOld ? (r.paidMonths || []) : (r.paidMonths || []).filter(m => m !== oldYm)),
                        newYm
                      ])),
                    }
                  : r
              )
            );
          }
        }
      }

      showToast(`Операция «${finalTitle}» обновлена`);
      setAmount('');
      setTxTitle('');
      setEditingTxId(null);
      setIsAddModalOpen(false);
    } else {
      const newTx = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        title: finalTitle,
        amount: num,
        type: txType,
        category: selectedCategory,
        account: selectedAccount,
        author: txAuthor,
        date: finalDate,
      };
      setTransactions(prev => [newTx, ...prev]);

      const shouldStayOpen = Boolean(keepOpenOverride || isBatchReceiptMode);
      showToast(
        shouldStayOpen
          ? `Чек за ${finalDate} записан (${num.toLocaleString('ru-RU')} ₽) — вводите следующий!`
          : `Записано за ${finalDate}: ${finalTitle} (${num.toLocaleString('ru-RU')} ₽)`
      );

      setAmount('');
      setTxTitle('');
      if (!shouldStayOpen) {
        setEditingTxId(null);
        setIsAddModalOpen(false);
      }
    }

    const txMonth = finalDate.slice(0, 7);
    if (selectedMonth !== 'all' && txMonth !== selectedMonth) {
      setSelectedMonth(txMonth);
    }
  };

  // Удаление транзакции с мягким Undo-тостом и откатом копилки / долга
  const handleDeleteTransaction = (id, e) => {
    e?.stopPropagation();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return;
    const tx = transactions[index];

    setTransactions(prev => prev.filter(t => t.id !== id));

    if (tx.goalId) {
      const delta = tx.type === 'income' ? (Number(tx.amount) || 0) : -(Number(tx.amount) || 0);
      setGoals(prev =>
        prev.map(g =>
          g.id === tx.goalId
            ? { ...g, current: Math.max(0, (Number(g.current) || 0) + delta) }
            : g
        )
      );
    }

    if (tx.debtId) {
      const txMonth = (tx.date || '').slice(0, 7);
      const hasOtherThisMonth = transactions.some(
        t => t.id !== id && t.debtId === tx.debtId && (t.date || '').startsWith(txMonth)
      );
      setDebts(prev =>
        prev.map(d =>
          d.id === tx.debtId
            ? {
                ...d,
                remainingAmount: (Number(d.remainingAmount) || 0) + (Number(tx.amount) || 0),
                paidMonths: hasOtherThisMonth
                  ? (d.paidMonths || [])
                  : (d.paidMonths || []).filter(m => m !== txMonth),
              }
            : d
        )
      );
    }

    if (tx.recurringId) {
      const txMonth = (tx.date || '').slice(0, 7);
      const hasOtherThisMonth = transactions.some(
        t => t.id !== id && t.recurringId === tx.recurringId && (t.date || '').startsWith(txMonth)
      );
      setRecurringPayments(prev =>
        prev.map(r =>
          r.id === tx.recurringId
            ? {
                ...r,
                paidMonths: hasOtherThisMonth
                  ? (r.paidMonths || [])
                  : (r.paidMonths || []).filter(m => m !== txMonth),
              }
            : r
        )
      );
    }

    if (editingTxId === id) {
      setIsAddModalOpen(false);
      setEditingTxId(null);
    }

    showToast(`Удалено: «${tx.title}» (${Number(tx.amount).toLocaleString('ru-RU')} ₽)`, () => {
      setTransactions(prev => {
        const copy = [...prev];
        copy.splice(index, 0, tx);
        return copy;
      });

      if (tx.goalId) {
        const restoreDelta = tx.type === 'income' ? -(Number(tx.amount) || 0) : (Number(tx.amount) || 0);
        setGoals(prev =>
          prev.map(g =>
            g.id === tx.goalId
              ? { ...g, current: Math.max(0, (Number(g.current) || 0) + restoreDelta) }
              : g
          )
        );
      }

      if (tx.debtId) {
        const txMonth = (tx.date || '').slice(0, 7);
        setDebts(prev =>
          prev.map(d =>
            d.id === tx.debtId
              ? {
                  ...d,
                  remainingAmount: Math.max(0, (Number(d.remainingAmount) || 0) - (Number(tx.amount) || 0)),
                  paidMonths: Array.from(new Set([...(d.paidMonths || []), txMonth])),
                }
              : d
          )
        );
      }

      if (tx.recurringId) {
        const txMonth = (tx.date || '').slice(0, 7);
        setRecurringPayments(prev =>
          prev.map(r =>
            r.id === tx.recurringId
              ? { ...r, paidMonths: Array.from(new Set([...(r.paidMonths || []), txMonth])) }
              : r
          )
        );
      }

      setToast(null);
    });
  };

  // Пополнение или вывод средств из копилки
  const handleContributeGoal = (e) => {
    e?.preventDefault();
    const num = parseFloat(goalAmount);
    if (!num || num <= 0 || !selectedGoalId) return;

    const targetGoal = goals.find(g => g.id === selectedGoalId);
    if (!targetGoal) return;

    const isWithdraw = goalActionMode === 'withdraw';
    const finalDate = goalActionDate || getTargetDateForMonth(selectedMonth);

    setGoals(prev =>
      prev.map(g =>
        g.id === selectedGoalId
          ? {
              ...g,
              current: isWithdraw
                ? Math.max(0, (Number(g.current) || 0) - num)
                : (Number(g.current) || 0) + num,
            }
          : g
      )
    );

    const newTx = {
      id: 'goal_tx_' + Date.now(),
      title: isWithdraw ? `Из копилки: ${targetGoal.title}` : `В копилку: ${targetGoal.title}`,
      amount: num,
      type: isWithdraw ? 'income' : 'expense',
      category: 'Накопления',
      account: goalSourceAccount,
      author: currentUser,
      date: finalDate,
      goalId: targetGoal.id,
    };

    setTransactions(prev => [newTx, ...prev]);
    setGoalAmount('');
    setIsGoalModalOpen(false);
    showToast(
      isWithdraw
        ? `Выведено ${num.toLocaleString('ru-RU')} ₽ из копилки «${targetGoal.title}»`
        : `Копилка «${targetGoal.title}» пополнена на ${num.toLocaleString('ru-RU')} ₽`
    );
  };

  const openEditGoalModal = (e, goal) => {
    e?.stopPropagation();
    setEditingGoalId(goal.id);
    setNewGoalTitle(goal.title);
    setNewGoalTarget(String(goal.target));
    setNewGoalCurrent(String(goal.current));
    setNewGoalIcon(goal.icon || '🎯');
    setNewGoalColor(goal.color || GOAL_COLOR_PRESETS[0].value);
    setIsNewGoalModalOpen(true);
  };

  const handleCreateGoal = (e) => {
    e?.preventDefault();
    const targetNum = parseFloat(newGoalTarget);
    if (!newGoalTitle.trim() || !targetNum || targetNum <= 0) return;
    const currentNum = Math.max(0, parseFloat(newGoalCurrent) || 0);

    if (editingGoalId) {
      setGoals(prev =>
        prev.map(g =>
          g.id === editingGoalId
            ? {
                ...g,
                title: newGoalTitle.trim(),
                target: targetNum,
                current: currentNum,
                color: newGoalColor,
                icon: newGoalIcon.trim() || '🎯',
              }
            : g
        )
      );
      showToast(`Цель «${newGoalTitle.trim()}» обновлена`);
    } else {
      const newGoal = {
        id: 'g_' + Date.now(),
        title: newGoalTitle.trim(),
        target: targetNum,
        current: currentNum,
        color: newGoalColor,
        icon: newGoalIcon.trim() || '🎯',
      };
      setGoals(prev => [...prev, newGoal]);
      showToast(`Цель «${newGoal.title}» создана`);
    }

    setEditingGoalId(null);
    setNewGoalTitle('');
    setNewGoalTarget('');
    setNewGoalCurrent('0');
    setIsNewGoalModalOpen(false);
  };

  const handleDeleteGoal = (e, goalId) => {
    e?.stopPropagation();
    const idx = goals.findIndex(item => item.id === goalId);
    if (idx === -1) return;
    const g = goals[idx];
    const affectedTxIds = transactions.filter(t => t.goalId === goalId).map(t => t.id);

    setGoals(prev => prev.filter(item => item.id !== goalId));
    setTransactions(prev => prev.map(t => (t.goalId === goalId ? { ...t, goalId: undefined } : t)));
    if (selectedGoalId === goalId) setSelectedGoalId(null);

    showToast(`Цель «${g.title}» удалена`, () => {
      setGoals(prev => {
        const copy = [...prev];
        copy.splice(idx, 0, g);
        return copy;
      });
      setTransactions(prev =>
        prev.map(t => (affectedTxIds.includes(t.id) ? { ...t, goalId: goalId } : t))
      );
      setToast(null);
    });
  };

  const openPayRecurringModal = (rec) => {
    setSelectedRecurringToPay(rec);
    setRecPayAmount(String(rec.amount || ''));
    setRecPayDate(getTargetDateForMonth(selectedMonth, rec.dueDate));
    setIsPayRecurringModalOpen(true);
  };

  const handleConfirmPayRecurring = (e) => {
    e?.preventDefault();
    if (!selectedRecurringToPay) return;
    const rec = selectedRecurringToPay;
    const num = parseFloat(recPayAmount);
    if (!num || num <= 0) return;

    const finalDate = recPayDate || getTargetDateForMonth(selectedMonth, rec.dueDate);
    const targetYm = finalDate.slice(0, 7);

    const newTx = {
      id: 'rec_tx_' + Date.now(),
      title: `Оплата: ${rec.title}`,
      amount: num,
      type: 'expense',
      category: rec.category || 'Дом и ЖКУ',
      account: rec.account || 'shared',
      author: (rec.account || 'shared') === 'personal' ? (rec.author || currentUser) : currentUser,
      date: finalDate,
      recurringId: rec.id,
    };

    setRecurringPayments(prev =>
      prev.map(r =>
        r.id === rec.id
          ? { ...r, paidMonths: Array.from(new Set([...(r.paidMonths || []), targetYm])) }
          : r
      )
    );

    setTransactions(prev => [newTx, ...prev]);
    setIsPayRecurringModalOpen(false);
    setSelectedRecurringToPay(null);

    showToast(`Платеж «${rec.title}» оплачен (${num.toLocaleString('ru-RU')} ₽ за ${finalDate})`, () => {
      setTransactions(prev => {
        const remaining = prev.filter(t => t.id !== newTx.id);
        const hasOther = remaining.some(t => t.recurringId === rec.id && (t.date || '').startsWith(targetYm));
        setRecurringPayments(rPrev =>
          rPrev.map(r =>
            r.id === rec.id
              ? {
                  ...r,
                  paidMonths: hasOther
                    ? (r.paidMonths || [])
                    : (r.paidMonths || []).filter(m => m !== targetYm),
                }
              : r
          )
        );
        return remaining;
      });
      setToast(null);
    });
  };

  const openEditRecurringModal = (e, rec) => {
    e?.stopPropagation();
    setEditingRecurringId(rec.id);
    setNewRecTitle(rec.title);
    setNewRecAmount(String(rec.amount));
    setNewRecCategory(rec.category || 'Дом и ЖКУ');
    setNewRecDueDate(String(rec.dueDate || 15));
    setNewRecAccount(rec.account || 'shared');
    setNewRecAuthor(rec.author || 'husband');
    setNewRecMandatory(rec.isMandatory !== false);
    setIsNewRecurringModalOpen(true);
  };

  const handleCreateRecurring = (e) => {
    e?.preventDefault();
    const num = parseFloat(newRecAmount);
    if (!newRecTitle.trim() || !num || num <= 0) return;
    const due = Math.min(31, Math.max(1, parseInt(newRecDueDate, 10) || 1));

    if (editingRecurringId) {
      setRecurringPayments(prev =>
        prev.map(r =>
          r.id === editingRecurringId
            ? {
                ...r,
                title: newRecTitle.trim(),
                amount: num,
                category: newRecCategory,
                account: newRecAccount,
                author: newRecAuthor,
                dueDate: due,
                isMandatory: newRecMandatory,
              }
            : r
        )
      );
      showToast(`Постоянный расход «${newRecTitle.trim()}» обновлен`);
    } else {
      const newRec = {
        id: 'rec_' + Date.now(),
        title: newRecTitle.trim(),
        amount: num,
        category: newRecCategory,
        account: newRecAccount,
        author: newRecAuthor,
        dueDate: due,
        isMandatory: newRecMandatory,
        paidMonths: [],
      };
      setRecurringPayments(prev => [...prev, newRec]);
      showToast(`Постоянный расход «${newRec.title}» добавлен`);
    }

    setEditingRecurringId(null);
    setNewRecTitle('');
    setNewRecAmount('');
    setIsNewRecurringModalOpen(false);
  };

  const handleDeleteRecurring = (e, recId) => {
    e?.stopPropagation();
    const idx = recurringPayments.findIndex(r => r.id === recId);
    if (idx === -1) return;
    const rec = recurringPayments[idx];
    const affectedTxIds = transactions.filter(t => t.recurringId === recId).map(t => t.id);

    setRecurringPayments(prev => prev.filter(r => r.id !== recId));
    setTransactions(prev => prev.map(t => (t.recurringId === recId ? { ...t, recurringId: undefined } : t)));

    showToast(`Платеж «${rec.title}» удален`, () => {
      setRecurringPayments(prev => {
        const copy = [...prev];
        copy.splice(idx, 0, rec);
        return copy;
      });
      setTransactions(prev =>
        prev.map(t => (affectedTxIds.includes(t.id) ? { ...t, recurringId: recId } : t))
      );
      setToast(null);
    });
  };

  const handlePayDebtSubmit = (e) => {
    e?.preventDefault();
    const num = parseFloat(debtPayAmount);
    if (!num || num <= 0 || !selectedDebtId) return;

    const debt = debts.find(d => d.id === selectedDebtId);
    if (!debt) return;

    const finalDate = debtPayDate || getTargetDateForMonth(selectedMonth, debt.paymentDay);
    const targetYm = finalDate.slice(0, 7);

    const newTx = {
      id: 'debt_tx_' + Date.now(),
      title: `Платёж по кредиту: ${debt.title}`,
      amount: num,
      type: 'expense',
      category: 'Долги и кредиты',
      account: debtSourceAccount,
      author: debtSourceAccount === 'personal' ? debtSourceAuthor : currentUser,
      date: finalDate,
      debtId: debt.id,
    };

    setDebts(prev =>
      prev.map(d =>
        d.id === debt.id
          ? {
              ...d,
              remainingAmount: Math.max(0, (Number(d.remainingAmount) || 0) - num),
              paidMonths: Array.from(new Set([...(d.paidMonths || []), targetYm])),
            }
          : d
      )
    );

    setTransactions(prev => [newTx, ...prev]);
    setDebtPayAmount('');
    setIsPayDebtModalOpen(false);

    showToast(`Внесен платёж ${num.toLocaleString('ru-RU')} ₽ по долгу «${debt.title}»`, () => {
      setTransactions(prev => {
        const remaining = prev.filter(t => t.id !== newTx.id);
        const hasOther = remaining.some(t => t.debtId === debt.id && (t.date || '').startsWith(targetYm));
        setDebts(dPrev =>
          dPrev.map(d =>
            d.id === debt.id
              ? {
                  ...d,
                  remainingAmount: (Number(d.remainingAmount) || 0) + num,
                  paidMonths: hasOther
                    ? (d.paidMonths || [])
                    : (d.paidMonths || []).filter(m => m !== targetYm),
                }
              : d
          )
        );
        return remaining;
      });
      setToast(null);
    });
  };

  const openPayDebtModal = (debt) => {
    setSelectedDebtId(debt.id);
    setDebtPayAmount(String(debt.monthlyPayment || ''));
    setDebtSourceAccount(debt.account || 'shared');
    setDebtSourceAuthor(debt.author || currentUser);
    setDebtPayDate(getTargetDateForMonth(selectedMonth, debt.paymentDay));
    setIsPayDebtModalOpen(true);
  };

  const openEditDebtModal = (e, debt) => {
    e?.stopPropagation();
    setEditingDebtId(debt.id);
    setNewDebtTitle(debt.title);
    setNewDebtInitial(String(debt.initialAmount));
    setNewDebtRemaining(String(debt.remainingAmount));
    setNewDebtPayment(String(debt.monthlyPayment));
    setNewDebtDay(String(debt.paymentDay || 12));
    setNewDebtAccount(debt.account || 'shared');
    setNewDebtAuthor(debt.author || 'husband');
    setNewDebtIcon(debt.icon || '💳');
    setNewDebtColor(debt.color || GOAL_COLOR_PRESETS[4].value);
    setIsNewDebtModalOpen(true);
  };

  const handleCreateDebt = (e) => {
    e?.preventDefault();
    const initNum = parseFloat(newDebtInitial);
    if (!newDebtTitle.trim() || !initNum || initNum <= 0) return;
    const rawRem = newDebtRemaining !== '' ? parseFloat(newDebtRemaining) : initNum;
    const remNum = Math.min(initNum, Math.max(0, Number.isFinite(rawRem) ? rawRem : initNum));
    const payNum = parseFloat(newDebtPayment) || Math.round(initNum / 12);
    const payDay = Math.min(31, Math.max(1, parseInt(newDebtDay, 10) || 10));

    if (editingDebtId) {
      setDebts(prev =>
        prev.map(d =>
          d.id === editingDebtId
            ? {
                ...d,
                title: newDebtTitle.trim(),
                initialAmount: initNum,
                remainingAmount: remNum,
                monthlyPayment: payNum,
                paymentDay: payDay,
                account: newDebtAccount,
                author: newDebtAuthor,
                icon: newDebtIcon.trim() || '💳',
                color: newDebtColor,
              }
            : d
        )
      );
      showToast(`Кредит «${newDebtTitle.trim()}» обновлен`);
    } else {
      const newDebt = {
        id: 'debt_' + Date.now(),
        title: newDebtTitle.trim(),
        initialAmount: initNum,
        remainingAmount: remNum,
        monthlyPayment: payNum,
        paymentDay: payDay,
        account: newDebtAccount,
        author: newDebtAuthor,
        paidMonths: [],
        icon: newDebtIcon.trim() || '💳',
        color: newDebtColor,
      };
      setDebts(prev => [...prev, newDebt]);
      showToast(`Кредит «${newDebt.title}» добавлен`);
    }

    setEditingDebtId(null);
    setNewDebtTitle('');
    setNewDebtInitial('');
    setNewDebtRemaining('');
    setNewDebtPayment('');
    setIsNewDebtModalOpen(false);
  };

  const handleDeleteDebt = (e, debtId) => {
    e?.stopPropagation();
    const idx = debts.findIndex(d => d.id === debtId);
    if (idx === -1) return;
    const debt = debts[idx];
    const affectedTxIds = transactions.filter(t => t.debtId === debtId).map(t => t.id);

    setDebts(prev => prev.filter(d => d.id !== debtId));
    setTransactions(prev => prev.map(t => (t.debtId === debtId ? { ...t, debtId: undefined } : t)));
    if (selectedDebtId === debtId) setSelectedDebtId(null);

    showToast(`Кредит «${debt.title}» удален`, () => {
      setDebts(prev => {
        const copy = [...prev];
        copy.splice(idx, 0, debt);
        return copy;
      });
      setTransactions(prev =>
        prev.map(t => (affectedTxIds.includes(t.id) ? { ...t, debtId: debtId } : t))
      );
      setToast(null);
    });
  };

  const handleApplyAutoForecastLimits = () => {
    const nextLimits = { ...plannedCategoryLimits };
    expenseForecastData.rows.forEach(r => {
      if (r.autoSuggested > 0) {
        nextLimits[r.category] = r.autoSuggested;
      }
    });
    setPlannedCategoryLimits(nextLimits);
    showToast('Плановые лимиты заполнены на основе анализа прошлых месяцев');
  };

  const handleSaveCategoryLimit = (categoryName) => {
    const val = parseFloat(editingPlanValue);
    setPlannedCategoryLimits(prev => {
      const next = { ...prev };
      if (!Number.isFinite(val) || val <= 0) {
        delete next[categoryName];
      } else {
        next[categoryName] = Math.round(val);
      }
      return next;
    });
    setEditingPlanCategory(null);
    setEditingPlanValue('');
    showToast(`План для «${categoryName}» сохранен`);
  };

  // ================= ЭКСПОРТ И ИМПОРТ (XLSX / CSV / JSON / AI) =================
  const handleDownloadXlsx = () => {
    const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;

    const summaryRows = [
      ['Показатель', 'Значение (₽ / %)', 'Период / Комментарий'],
      ['Версия приложения', 'v0.6.5', `Дата выгрузки: ${getLocalDateString()}`],
      ['Выбранный период', formatMonthTitle(selectedMonth), targetYm],
      ['Кумулятивный баланс: Общий котел', stats.shared.balance, `Доходы мес: +${stats.shared.monthIncome} / Расходы мес: -${stats.shared.monthExpense}`],
      ['Кумулятивный баланс: Личный (Муж)', stats.husbandPersonal.balance, `Доходы мес: +${stats.husbandPersonal.monthIncome} / Расходы мес: -${stats.husbandPersonal.monthExpense}`],
      ['Кумулятивный баланс: Личный (Жена)', stats.wifePersonal.balance, `Доходы мес: +${stats.wifePersonal.monthIncome} / Расходы мес: -${stats.wifePersonal.monthExpense}`],
      ['Потребительские расходы (Общий котел)', stats.shared.consumerExpense, 'Без учета копилок и кредитов'],
      ['Отложено в копилки и погашено долгов', stats.shared.savedAndDebtPaid, 'Из общего котла за выбранный период'],
      ['Резерв на неоплаченные обязательные счета', stats.unpaidMandatoryThisMonth, `Ожидает оплаты счетов: ${pendingBillsCount}`],
      ['Безопасный дневной лимит (активный счет)', stats.dailyAvailable, `На ${stats.daysLeft} дн.`],
      ['Всего накоплено в копилках', stats.totalSavings, `Цель: ${stats.totalTargetSavings}`],
      ['Общий остаток по кредитам и долгам', stats.totalDebtRemaining, `Начальная сумма: ${stats.totalDebtInitial}`],
    ];

    const txRows = [
      ['ID', 'Дата', 'Месяц', 'Тип', 'Категория', 'Название_Комментарий', 'Сумма_₽', 'Счет', 'Автор', 'ID_Копилки', 'ID_Долга', 'ID_Регулярного'],
      ...[...transactions]
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map(t => [
          t.id || '',
          t.date || '',
          (t.date || '').slice(0, 7),
          t.type === 'income' ? 'Доход' : 'Расход',
          t.category || '',
          t.title || '',
          Number(t.amount) || 0,
          (t.account || 'shared') === 'shared' ? 'Общий котел' : 'Личный',
          t.author === 'wife' ? 'Жена' : 'Муж',
          t.goalId || '',
          t.debtId || '',
          t.recurringId || '',
        ])
    ];

    const planRows = [
      ['Категория', 'Корзина_50_30_20', 'Прошлый_месяц_₽', 'Среднее_прошлых_мес_₽', 'Постоянные_счета_₽', 'Авто_прогноз_₽', 'План_на_месяц_₽', 'Факт_месяца_₽', 'Остаток_плана_₽', 'Использовано_%', 'Статус'],
      ...expenseForecastData.rows.map(r => [
        r.category,
        r.meta.bucket === 'base' ? 'База (50%)' : 'Хотелки (30%)',
        r.prevMonthSum,
        r.avgHistorical,
        r.recSum,
        r.autoSuggested,
        r.effectivePlan,
        r.currentActual,
        r.remainingPlan,
        r.pctUsed,
        r.isOverPlan ? 'Превышение плана' : 'В рамках плана',
      ])
    ];

    const recRows = [
      ['ID', 'Название_платежа', 'Сумма_₽', 'День_оплаты', 'Категория', 'Счет', 'Автор', 'Обязательный', 'Статус_в_месяце', 'Оплаченные_месяцы'],
      ...recurringPayments.map(r => {
        const st = getRecurringReminderStatus(r, targetYm);
        return [
          r.id,
          r.title,
          Number(r.amount) || 0,
          Number(r.dueDate) || 1,
          r.category || '',
          (r.account || 'shared') === 'shared' ? 'Общий котел' : 'Личный',
          r.author === 'wife' ? 'Жена' : 'Муж',
          r.isMandatory !== false ? 'Да' : 'Нет',
          st.label,
          (r.paidMonths || []).join(', '),
        ];
      })
    ];

    const goalsDebtsRows = [
      ['Тип_Записи', 'ID', 'Название', 'Текущее_или_Остаток_₽', 'Цель_или_Начальный_долг_₽', 'Ежемесячный_платеж_₽', 'День_платежа', 'Прогресс_%', 'Оплаченные_месяцы'],
      ...goals.map(g => [
        'Копилка',
        g.id,
        g.title,
        Number(g.current) || 0,
        Number(g.target) || 0,
        0,
        '',
        g.target > 0 ? Math.round(((Number(g.current) || 0) / Number(g.target)) * 100) : 0,
        '',
      ]),
      ...debts.map(d => {
        const init = Number(d.initialAmount) || 1;
        const rem = Number(d.remainingAmount) || 0;
        const pct = Math.round((Math.max(0, init - rem) / init) * 100);
        return [
          'Кредит/Долг',
          d.id,
          d.title,
          rem,
          init,
          Number(d.monthlyPayment) || 0,
          Number(d.paymentDay) || 12,
          pct,
          (d.paidMonths || []).join(', '),
        ];
      })
    ];

    const xlsxBytes = buildXlsxBytes([
      { name: '1_Сводка', rows: summaryRows },
      { name: '2_Операции', rows: txRows },
      { name: '3_План_и_Прогноз', rows: planRows },
      { name: '4_Постоянные_счета', rows: recRows },
      { name: '5_Копилки_и_Долги', rows: goalsDebtsRows },
    ]);

    const blob = new Blob([xlsxBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-budget-v0.6.5-${getLocalDateString()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Выгружен многостраничный Excel (.xlsx) с 5 листами аналитики и операций');
  };

  const buildStructuredCsvString = () => {
    const header = [
      'Тип_Записи',
      'ID',
      'Дата_или_День',
      'Направление_или_Статус',
      'Категория',
      'Название_Комментарий',
      'Сумма_или_Текущее_₽',
      'Цель_или_Начальное_₽',
      'Платеж_или_План_₽',
      'Счет',
      'Автор',
      'Доп_Данные',
    ];
    const lines = [toCsvLine(header)];

    lines.push(toCsvLine(['SUMMARY', 'sum_shared', getLocalDateString(), 'balance', 'Общий котел', 'Переходящий остаток общего котла', stats.shared.balance, stats.shared.monthIncome, stats.shared.monthExpense, 'shared', 'both', `Безопасный лимит: ${stats.dailyAvailable} ₽/дн.`]));
    lines.push(toCsvLine(['SUMMARY', 'sum_husband', getLocalDateString(), 'balance', 'Личный счет мужа', 'Переходящий остаток мужа', stats.husbandPersonal.balance, stats.husbandPersonal.monthIncome, stats.husbandPersonal.monthExpense, 'personal', 'husband', '']));
    lines.push(toCsvLine(['SUMMARY', 'sum_wife', getLocalDateString(), 'balance', 'Личный счет жены', 'Переходящий остаток жены', stats.wifePersonal.balance, stats.wifePersonal.monthIncome, stats.wifePersonal.monthExpense, 'personal', 'wife', '']));

    expenseForecastData.rows.forEach(r => {
      lines.push(toCsvLine([
        'CATEGORY_PLAN',
        `plan_${r.category}`,
        selectedMonth,
        r.meta.bucket || 'base',
        r.category,
        `Прогноз из прошлых мес: ${r.autoSuggested} ₽ (ср. ${r.avgHistorical} ₽)`,
        r.currentActual,
        r.autoSuggested,
        r.effectivePlan,
        activeWalletCard,
        'both',
        r.userCustomLimit !== undefined ? `USER_LIMIT:${r.userCustomLimit}` : 'AUTO',
      ]));
    });

    recurringPayments.forEach(r => {
      lines.push(toCsvLine([
        'RECURRING',
        r.id,
        r.dueDate,
        r.isMandatory !== false ? 'mandatory' : 'optional',
        r.category || 'Дом и ЖКУ',
        r.title,
        r.amount,
        '',
        r.amount,
        r.account || 'shared',
        r.author || 'husband',
        (r.paidMonths || []).join('|'),
      ]));
    });

    debts.forEach(d => {
      lines.push(toCsvLine([
        'DEBT',
        d.id,
        d.paymentDay || 12,
        'active',
        'Долги и кредиты',
        d.title,
        d.remainingAmount,
        d.initialAmount,
        d.monthlyPayment,
        d.account || 'shared',
        d.author || 'husband',
        `${d.icon || '💳'};${d.color || 'from-rose-500 to-red-500'};${(d.paidMonths || []).join('|')}`,
      ]));
    });

    goals.forEach(g => {
      lines.push(toCsvLine([
        'GOAL',
        g.id,
        '',
        'active',
        'Накопления',
        g.title,
        g.current,
        g.target,
        '',
        'shared',
        'both',
        `${g.icon || '🎯'};${g.color || 'from-amber-500 to-orange-500'}`,
      ]));
    });

    customCategories.forEach(c => {
      lines.push(toCsvLine([
        'CUSTOM_CATEGORY',
        c.id,
        '',
        c.type || 'expense',
        c.name,
        c.name,
        0,
        0,
        0,
        'shared',
        'both',
        `${c.icon || '🏷️'};${c.color || 'bg-stone-100 text-stone-700'};${c.bucket || 'base'}`,
      ]));
    });

    [...transactions]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .forEach(t => {
        const links = [
          t.goalId ? `goal:${t.goalId}` : '',
          t.debtId ? `debt:${t.debtId}` : '',
          t.recurringId ? `rec:${t.recurringId}` : '',
        ].filter(Boolean).join('|');

        lines.push(toCsvLine([
          'TRANSACTION',
          t.id,
          t.date,
          t.type,
          t.category,
          t.title,
          t.amount,
          '',
          '',
          t.account || 'shared',
          t.author || 'husband',
          links,
        ]));
      });

    return '\uFEFF' + lines.join('\r\n');
  };

  const handleDownloadCsv = () => {
    const csvContent = buildStructuredCsvString();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-budget-v0.6.5-backup-${getLocalDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Выгружен универсальный CSV (открывается в Excel и подходит для полного восстановления бэкапа)');
  };

  const handleDownloadJson = () => {
    const payload = {
      version: '0.6.5',
      exportedAt: new Date().toISOString(),
      transactions,
      goals,
      recurringPayments,
      debts,
      customCategories,
      plannedCategoryLimits,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-budget-v0.6.5-backup-${getLocalDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Полный JSON-бэкап сохранен');
  };

  const buildAiPromptReport = () => {
    const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
    const lines = [
      `Проведи финансовый аудит нашего семейного бюджета за период ${formatMonthTitle(selectedMonth)} (${targetYm}).`,
      `Укажи узкие места, оцени соблюдение правила 50/30/20, проверь нагрузку постоянных платежей и предложи конкретные шаги по оптимизации трат на следующий месяц.`,
      ``,
      `=== 1. БАЛАНСЫ И ПОТОКИ ===`,
      `- Общий котел (кумулятивный остаток): ${stats.shared.balance.toLocaleString('ru-RU')} ₽ (за месяц Доходы: +${stats.shared.monthIncome.toLocaleString('ru-RU')} ₽, Расходы: -${stats.shared.monthExpense.toLocaleString('ru-RU')} ₽, из них потребительские: ${stats.shared.consumerExpense.toLocaleString('ru-RU')} ₽, отложено/кредиты: ${stats.shared.savedAndDebtPaid.toLocaleString('ru-RU')} ₽)`,
      `- Личный счет мужа: ${stats.husbandPersonal.balance.toLocaleString('ru-RU')} ₽ (+${stats.husbandPersonal.monthIncome.toLocaleString('ru-RU')} / -${stats.husbandPersonal.monthExpense.toLocaleString('ru-RU')} ₽)`,
      `- Личный счет жены: ${stats.wifePersonal.balance.toLocaleString('ru-RU')} ₽ (+${stats.wifePersonal.monthIncome.toLocaleString('ru-RU')} / -${stats.wifePersonal.monthExpense.toLocaleString('ru-RU')} ₽)`,
      `- Резерв на неоплаченные обязательные счета месяца: ${stats.unpaidMandatoryThisMonth.toLocaleString('ru-RU')} ₽`,
      `- Безопасный дневной лимит: ${stats.dailyAvailable.toLocaleString('ru-RU')} ₽/день (осталось дней: ${stats.daysLeft})`,
      ``,
      `=== 2. ПЛАН / ПРОГНОЗ ПО КАТЕГОРИЯМ (ИЗ АНАЛИЗА ПРОШЛЫХ МЕСЯЦЕВ) ===`,
      ...expenseForecastData.rows.map(r =>
        `- ${r.category} [${r.meta.bucket === 'base' ? 'База' : 'Хотелки'}]: Факт = ${r.currentActual} ₽ | План/Прогноз = ${r.effectivePlan} ₽ (Среднее за прошлые мес: ${r.avgHistorical} ₽, Прошлый мес: ${r.prevMonthSum} ₽)`
      ),
      ``,
      `=== 3. ПОСТОЯННЫЕ ОБЯЗАТЕЛЬНЫЕ ПЛАТЕЖИ ===`,
      ...recurringPayments.map(r => {
        const st = getRecurringReminderStatus(r, targetYm);
        return `- ${r.title}: ${r.amount} ₽ (до ${r.dueDate}-го числа, ${r.category}) — ${st.label}`;
      }),
      ``,
      `=== 4. ДОЛГИ И КОПИЛКИ ===`,
      ...debts.map(d => `- Кредит «${d.title}»: остаток ${d.remainingAmount} ₽ из ${d.initialAmount} ₽ (платеж ${d.monthlyPayment} ₽ до ${d.paymentDay}-го)`),
      ...goals.map(g => `- Копилка «${g.title}»: накоплено ${g.current} ₽ из ${g.target} ₽`),
      ``,
      `=== 5. ОПЕРАЦИИ ВЫБРАННОГО ПЕРИОДА (${periodTransactions.length} шт.) ===`,
      `Дата;Тип;Категория;Название;Сумма_₽;Счет;Автор`,
      ...periodTransactions.map(t => `${t.date};${t.type};${t.category};${t.title};${t.amount};${t.account || 'shared'};${t.author || 'husband'}`),
    ];
    return lines.join('\n');
  };

  const handleCopyAiReport = () => {
    const text = buildAiPromptReport();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('Структурированный отчет + промпт для нейронки скопированы в буфер обмена!');
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Импорт бэкапа из файла (.csv или .json)
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const prevSnapshot = {
      transactions,
      goals,
      recurringPayments,
      debts,
      customCategories,
      plannedCategoryLimits,
    };

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = String(evt.target?.result || '');
        if (file.name.toLowerCase().endsWith('.json') || content.trim().startsWith('{')) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.transactions)) setTransactions(parsed.transactions);
          if (Array.isArray(parsed.goals)) setGoals(parsed.goals);
          if (Array.isArray(parsed.recurringPayments)) setRecurringPayments(parsed.recurringPayments);
          if (Array.isArray(parsed.debts)) setDebts(parsed.debts);
          if (Array.isArray(parsed.customCategories)) setCustomCategories(parsed.customCategories);
          if (parsed.plannedCategoryLimits && typeof parsed.plannedCategoryLimits === 'object') {
            setPlannedCategoryLimits(parsed.plannedCategoryLimits);
          }
          setIsExportModalOpen(false);
          showToast(`Бэкап из JSON восстановлен (${(parsed.transactions || []).length} операций)`, () => {
            setTransactions(prevSnapshot.transactions);
            setGoals(prevSnapshot.goals);
            setRecurringPayments(prevSnapshot.recurringPayments);
            setDebts(prevSnapshot.debts);
            setCustomCategories(prevSnapshot.customCategories);
            setPlannedCategoryLimits(prevSnapshot.plannedCategoryLimits);
            setToast(null);
          });
          return;
        }

        const rows = parseCsvText(content);
        if (rows.length < 2) {
          showToast('Файл пуст или не содержит строк данных');
          return;
        }

        const header = rows[0].map(h => h.trim());
        const isStructuredBackup = header[0] === 'Тип_Записи';

        if (isStructuredBackup) {
          const nextTxs = [];
          const nextRecs = [];
          const nextDebts = [];
          const nextGoals = [];
          const nextCats = [];
          const nextLimits = {};

          rows.slice(1).forEach((r, idx) => {
            const [recType, id, dateOrDay, dirOrStatus, category, title, amountCur, targetInit, payPlan, account, author, extra] = r;
            if (recType === 'TRANSACTION') {
              const extraParts = (extra || '').split('|');
              const goalLink = extraParts.find(x => x.startsWith('goal:'))?.slice(5);
              const debtLink = extraParts.find(x => x.startsWith('debt:'))?.slice(5);
              const recLink = extraParts.find(x => x.startsWith('rec:'))?.slice(4);
              nextTxs.push({
                id: id || `imp_tx_${idx}`,
                date: dateOrDay || getLocalDateString(),
                type: dirOrStatus === 'income' || dirOrStatus === 'Доход' ? 'income' : 'expense',
                category: category || 'Продукты',
                title: title || category || 'Операция',
                amount: Number(amountCur) || 0,
                account: account === 'personal' || account === 'Личный' ? 'personal' : 'shared',
                author: author === 'wife' || author === 'Жена' ? 'wife' : 'husband',
                ...(goalLink ? { goalId: goalLink } : {}),
                ...(debtLink ? { debtId: debtLink } : {}),
                ...(recLink ? { recurringId: recLink } : {}),
              });
            } else if (recType === 'RECURRING') {
              nextRecs.push({
                id: id || `imp_rec_${idx}`,
                title: title || category || 'Платеж',
                amount: Number(amountCur) || 0,
                dueDate: Number(dateOrDay) || 15,
                category: category || 'Дом и ЖКУ',
                account: account === 'personal' ? 'personal' : 'shared',
                author: author === 'wife' ? 'wife' : 'husband',
                isMandatory: dirOrStatus !== 'optional',
                paidMonths: (extra || '').split('|').filter(Boolean),
              });
            } else if (recType === 'DEBT') {
              const [icon, color, paidStr] = (extra || '').split(';');
              nextDebts.push({
                id: id || `imp_debt_${idx}`,
                title: title || 'Кредит',
                remainingAmount: Number(amountCur) || 0,
                initialAmount: Number(targetInit) || Number(amountCur) || 100000,
                monthlyPayment: Number(payPlan) || 10000,
                paymentDay: Number(dateOrDay) || 12,
                account: account === 'personal' ? 'personal' : 'shared',
                author: author === 'wife' ? 'wife' : 'husband',
                icon: icon || '💳',
                color: color || 'from-rose-500 to-red-500',
                paidMonths: (paidStr || '').split('|').filter(Boolean),
              });
            } else if (recType === 'GOAL') {
              const [icon, color] = (extra || '').split(';');
              nextGoals.push({
                id: id || `imp_goal_${idx}`,
                title: title || 'Цель',
                current: Number(amountCur) || 0,
                target: Number(targetInit) || 100000,
                icon: icon || '🎯',
                color: color || 'from-amber-500 to-orange-500',
              });
            } else if (recType === 'CUSTOM_CATEGORY') {
              const [icon, color, bucket] = (extra || '').split(';');
              nextCats.push({
                id: id || `imp_cat_${idx}`,
                name: category || title,
                type: dirOrStatus === 'income' ? 'income' : 'expense',
                icon: icon || '🏷️',
                color: color || 'bg-stone-100 text-stone-700',
                bucket: bucket || 'base',
              });
            } else if (recType === 'CATEGORY_PLAN') {
              if ((extra || '').startsWith('USER_LIMIT:')) {
                const lim = Number(extra.split(':')[1]);
                if (lim > 0 && category) nextLimits[category] = lim;
              }
            }
          });

          if (nextTxs.length > 0) setTransactions(nextTxs);
          if (nextRecs.length > 0) setRecurringPayments(nextRecs);
          if (nextDebts.length > 0) setDebts(nextDebts);
          if (nextGoals.length > 0) setGoals(nextGoals);
          if (nextCats.length > 0) setCustomCategories(nextCats);
          if (Object.keys(nextLimits).length > 0) setPlannedCategoryLimits(nextLimits);

          setIsExportModalOpen(false);
          showToast(`Полный бэкап из CSV загружен (${nextTxs.length} операций, ${nextRecs.length} счетов)`, () => {
            setTransactions(prevSnapshot.transactions);
            setGoals(prevSnapshot.goals);
            setRecurringPayments(prevSnapshot.recurringPayments);
            setDebts(prevSnapshot.debts);
            setCustomCategories(prevSnapshot.customCategories);
            setPlannedCategoryLimits(prevSnapshot.plannedCategoryLimits);
            setToast(null);
          });
        } else {
          const importedTxs = rows.slice(1).map((r, idx) => ({
            id: r[0] || `csv_tx_${Date.now()}_${idx}`,
            date: r[1] || getLocalDateString(),
            type: (r[3] || '').toLowerCase().includes('доход') || r[3] === 'income' ? 'income' : 'expense',
            category: r[4] || 'Продукты',
            title: r[5] || r[4] || 'Операция',
            amount: Number(r[6] || r[2]) || 0,
            account: (r[7] || '').toLowerCase().includes('личн') || r[7] === 'personal' ? 'personal' : 'shared',
            author: (r[8] || '').toLowerCase().includes('жен') || r[8] === 'wife' ? 'wife' : 'husband',
          })).filter(t => t.amount > 0);

          if (importedTxs.length > 0) {
            setTransactions(importedTxs);
            setIsExportModalOpen(false);
            showToast(`Импортировано ${importedTxs.length} операций из CSV`, () => {
              setTransactions(prevSnapshot.transactions);
              setToast(null);
            });
          }
        }
      } catch (err) {
        console.error('Import failed:', err);
        showToast('Не удалось прочитать файл бэкапа. Проверьте формат CSV или JSON.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleClearAllData = () => {
    const prevSnapshot = {
      transactions,
      goals,
      recurringPayments,
      debts,
      customCategories,
      plannedCategoryLimits,
    };
    setTransactions([]);
    setGoals([]);
    setRecurringPayments([]);
    setDebts([]);
    setCustomCategories([]);
    setPlannedCategoryLimits({});
    setIsExportModalOpen(false);
    showToast('Все демо-данные очищены — можно начинать с чистого листа!', () => {
      setTransactions(prevSnapshot.transactions);
      setGoals(prevSnapshot.goals);
      setRecurringPayments(prevSnapshot.recurringPayments);
      setDebts(prevSnapshot.debts);
      setCustomCategories(prevSnapshot.customCategories);
      setPlannedCategoryLimits(prevSnapshot.plannedCategoryLimits);
      setToast(null);
    });
  };

  const handleRestoreDemoData = () => {
    setTransactions(INITIAL_TRANSACTIONS);
    setGoals(INITIAL_GOALS);
    setRecurringPayments(INITIAL_RECURRING);
    setDebts(INITIAL_DEBTS);
    setCustomCategories([]);
    setPlannedCategoryLimits({});
    setIsExportModalOpen(false);
    showToast('Демонстрационные данные v0.6.5 восстановлены');
  };

  // Фильтрация истории операций
  const filteredTransactions = useMemo(() => {
    return periodTransactions.filter(tx => {
      if (selectedCalendarDate && tx.date !== selectedCalendarDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (tx.title || '').toLowerCase().includes(q);
        const matchCategory = (tx.category || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCategory) return false;
      }
      if (filterAuthor !== 'all' && tx.author !== filterAuthor) return false;
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterAccount !== 'all' && (tx.account || 'shared') !== filterAccount) return false;
      return true;
    });
  }, [periodTransactions, selectedCalendarDate, searchQuery, filterAuthor, filterType, filterAccount]);

  // Сводка по дням месяца для интерактивного календаря чеков
  const monthCalendarDays = useMemo(() => {
    const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
    const [y, m] = targetYm.split('-').map(Number);
    const daysCount = new Date(y, m, 0).getDate();
    const firstDayWeek = (new Date(y, m - 1, 1).getDay() + 6) % 7;

    const byDate = {};
    transactions.forEach(t => {
      if (!(t.date || '').startsWith(targetYm)) return;
      if (!byDate[t.date]) byDate[t.date] = { count: 0, expense: 0, income: 0 };
      byDate[t.date].count += 1;
      if (t.type === 'income') byDate[t.date].income += Number(t.amount) || 0;
      else byDate[t.date].expense += Number(t.amount) || 0;
    });

    const cells = [];
    for (let i = 0; i < firstDayWeek; i++) {
      cells.push({ empty: true, key: `emp_${i}` });
    }
    for (let d = 1; d <= daysCount; d++) {
      const dateStr = `${targetYm}-${String(d).padStart(2, '0')}`;
      const info = byDate[dateStr] || { count: 0, expense: 0, income: 0 };
      cells.push({
        empty: false,
        day: d,
        dateStr,
        ...info,
      });
    }
    return { targetYm, cells };
  }, [transactions, selectedMonth]);

  // Группировка транзакций по датам с дневным сальдо
  const groupedTransactions = useMemo(() => {
    const groups = [];
    const map = new Map();

    filteredTransactions.forEach(tx => {
      const d = tx.date || 'Без даты';
      if (!map.has(d)) {
        const groupObj = { date: d, label: formatDateGroupHeader(d), items: [], net: 0 };
        map.set(d, groupObj);
        groups.push(groupObj);
      }
      const g = map.get(d);
      g.items.push(tx);
      const val = Number(tx.amount) || 0;
      g.net += tx.type === 'income' ? val : -val;
    });

    return groups;
  }, [filteredTransactions]);

  const activeFilterCount =
    (filterAuthor !== 'all' ? 1 : 0) +
    (filterType !== 'all' ? 1 : 0) +
    (filterAccount !== 'all' ? 1 : 0) +
    (selectedCalendarDate ? 1 : 0);

  const hasActiveFilters = searchQuery.trim() !== '' || activeFilterCount > 0;

  const clearFilters = () => {
    setSearchQuery('');
    setFilterAuthor('all');
    setFilterType('all');
    setFilterAccount('all');
    setSelectedCalendarDate(null);
  };

  const openWalletHistory = (walletKey) => {
    setActiveWalletCard(walletKey);
    if (walletKey === 'shared') {
      setFilterAccount('shared');
      setFilterAuthor('all');
    } else if (walletKey === 'husband') {
      setFilterAccount('personal');
      setFilterAuthor('husband');
    } else if (walletKey === 'wife') {
      setFilterAccount('personal');
      setFilterAuthor('wife');
    }
  };

  // ================= ДАННЫЕ ДЛЯ SVG-ГРАФИКОВ (ИСПРАВЛЕНЫ В v0.6.5) =================
  const burnDownData = useMemo(() => {
    const days = stats.daysInMonth;
    const today = new Date();
    const isCurrentMonth = selectedMonth === getCurrentMonthPrefix();
    const currentDay = isCurrentMonth ? today.getDate() : days;

    const activeMonthIncome =
      activeWalletCard === 'husband'
        ? stats.husbandPersonal.monthIncome
        : activeWalletCard === 'wife'
        ? stats.wifePersonal.monthIncome
        : stats.shared.monthIncome;

    const baseBudget = expenseForecastData.totalPlannedBudget > 0
      ? expenseForecastData.totalPlannedBudget
      : (activeMonthIncome > 0 ? activeMonthIncome : 100000);

    const dailyExpenses = new Array(days + 1).fill(0);
    periodTransactions.forEach(t => {
      if (t.type !== 'expense' || isSavingsOrDebtTx(t)) return;
      const acc = t.account || 'shared';
      const matches =
        (activeWalletCard === 'shared' && acc === 'shared') ||
        (activeWalletCard === 'husband' && acc === 'personal' && t.author === 'husband') ||
        (activeWalletCard === 'wife' && acc === 'personal' && t.author === 'wife');

      if (!matches) return;
      const dayNum = parseInt((t.date || '').slice(8, 10), 10);
      if (dayNum >= 1 && dayNum <= days) {
        dailyExpenses[dayNum] += Number(t.amount) || 0;
      }
    });

    let cumActual = 0;
    const actualPoints = [{ day: 0, value: 0 }];
    for (let d = 1; d <= currentDay; d++) {
      cumActual += dailyExpenses[d];
      actualPoints.push({ day: d, value: cumActual });
    }

    const planPerDay = baseBudget / days;
    const plannedUpToCurrent = Math.round(planPerDay * currentDay);
    const actualUpToCurrent = cumActual;
    const diff = plannedUpToCurrent - actualUpToCurrent;
    const isUnderBudget = diff >= 0;

    const padX = 40;
    const padY = 25;
    const w = 500 - padX * 2;
    const h = 200 - padY * 2;
    const maxVal = Math.max(baseBudget * 1.1, cumActual * 1.1, 10000);

    const safeDays = Math.max(1, days);
    const getX = (d) => padX + (d / safeDays) * w;
    const getY = (val) => padY + h - (val / maxVal) * h;

    const planPointsStr = `${getX(0)},${getY(0)} ${getX(days)},${getY(baseBudget)}`;
    const actualPointsStr = actualPoints.map(p => `${getX(p.day)},${getY(p.value)}`).join(' ');

    return {
      baseBudget,
      currentDay,
      plannedUpToCurrent,
      actualUpToCurrent,
      diff,
      isUnderBudget,
      planPointsStr,
      actualPointsStr,
      actualPoints,
      getX,
      getY,
      maxVal,
    };
  }, [periodTransactions, stats, expenseForecastData, selectedMonth, activeWalletCard]);

  // 2. Светофор 50/30/20
  const rule503020Data = useMemo(() => {
    let base = 0;
    let wants = 0;
    let future = 0;

    periodTransactions.forEach(t => {
      if (t.type !== 'expense') return;
      const acc = t.account || 'shared';
      const matches =
        (activeWalletCard === 'shared' && acc === 'shared') ||
        (activeWalletCard === 'husband' && acc === 'personal' && t.author === 'husband') ||
        (activeWalletCard === 'wife' && acc === 'personal' && t.author === 'wife');

      if (!matches) return;
      const val = Number(t.amount) || 0;

      if (isSavingsOrDebtTx(t)) {
        future += val;
        return;
      }

      const meta = getCategoryMeta(t.category, 'expense', customCategories);
      if (meta.bucket === 'base') {
        base += val;
      } else {
        wants += val;
      }
    });

    const total = base + wants + future;
    const basePct = total > 0 ? Math.round((base / total) * 100) : 0;
    const wantsPct = total > 0 ? Math.round((wants / total) * 100) : 0;
    const futurePct = total > 0 ? Math.max(0, 100 - basePct - wantsPct) : 0;

    return {
      base,
      wants,
      future,
      total,
      basePct,
      wantsPct,
      futurePct,
    };
  }, [periodTransactions, activeWalletCard, customCategories]);

  // 3. Динамика за 6 месяцев за один проход O(N)
  const dynamics6MonthsData = useMemo(() => {
    const ymSource = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
    const [baseY, baseM] = ymSource.split('-').map(Number);

    const monthKeys = [];
    const buckets = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseY, baseM - 1 - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = MONTH_NAMES_SHORT[d.getMonth()];
      monthKeys.push(ym);
      buckets[ym] = { ym, label, inc: 0, exp: 0, sav: 0, savingsRate: 0 };
    }

    transactions.forEach(t => {
      const ym = (t.date || '').slice(0, 7);
      const bucket = buckets[ym];
      if (!bucket) return;

      const acc = t.account || 'shared';
      const matches =
        (activeWalletCard === 'shared' && acc === 'shared') ||
        (activeWalletCard === 'husband' && acc === 'personal' && t.author === 'husband') ||
        (activeWalletCard === 'wife' && acc === 'personal' && t.author === 'wife');
      if (!matches) return;

      const val = Number(t.amount) || 0;
      if (t.type === 'income') {
        bucket.inc += val;
      } else if (isSavingsOrDebtTx(t)) {
        bucket.sav += val;
      } else {
        bucket.exp += val;
      }
    });

    const list = monthKeys.map(ym => {
      const b = buckets[ym];
      b.savingsRate = b.inc > 0 ? Math.round((b.sav / b.inc) * 100) : 0;
      return b;
    });

    const maxVal = Math.max(...list.map(item => Math.max(item.inc, item.exp + item.sav)), 50000);
    return { list, maxVal };
  }, [transactions, selectedMonth, activeWalletCard]);

  // Карточка одной строки операции
  const renderTransactionRow = (tx) => {
    const catObj = getCategoryMeta(tx.category, tx.type, customCategories);
    const isExpense = tx.type === 'expense';
    const isShared = (tx.account || 'shared') === 'shared';

    return (
      <div
        key={tx.id}
        onClick={() => openEditTransactionModal(tx)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEditTransactionModal(tx);
          }
        }}
        className="py-3 px-2.5 flex items-center justify-between hover:bg-stone-50 rounded-2xl transition cursor-pointer group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center text-base ${catObj.color}`}>
            {catObj.icon}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-stone-900 truncate flex items-center gap-1.5">
              <span className="truncate">{tx.title}</span>
              {tx.goalId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 font-medium shrink-0">
                  🎯 Копилка
                </span>
              )}
              {tx.debtId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 font-medium shrink-0">
                  💳 Долг
                </span>
              )}
              {tx.recurringId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium shrink-0">
                  🛡️ Постоянный
                </span>
              )}
            </div>
            <div className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="truncate">{catObj.name}</span>
              <span className="text-stone-300">•</span>
              <span className="inline-flex items-center gap-1 text-stone-600">
                <span>{tx.author === 'husband' ? '🧔🏻‍♂️' : '👩🏼'}</span>
                <span>{isShared ? 'Общий' : 'Личный'}</span>
              </span>
              <span className="text-stone-300">•</span>
              <span className="text-stone-400 font-mono text-[11px]">{tx.date}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          <div className={`text-sm font-semibold tracking-tight text-right ${isExpense ? 'text-stone-900' : 'text-emerald-700'}`}>
            {isExpense ? '−' : '+'}{Number(tx.amount).toLocaleString('ru-RU')} ₽
          </div>
          <button
            type="button"
            onClick={(e) => handleDeleteTransaction(tx.id, e)}
            aria-label={`Удалить операцию ${tx.title}`}
            className="text-stone-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-28 md:pb-12">
      {/* Верхний бар управления */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Бренд + селектор периода */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 rounded-2xl bg-stone-900 text-white flex items-center justify-center font-bold shadow-sm text-sm shrink-0">
              💎
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-semibold tracking-tight text-stone-900 leading-tight">
                  Семейный Бюджет
                </h1>
                <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                  v0.6.5
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <button
                  type="button"
                  onClick={() => stepMonth(-1)}
                  aria-label="Предыдущий месяц"
                  className="p-0.5 text-stone-400 hover:text-stone-800 rounded transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCalendarDate(null);
                    setSelectedMonth(selectedMonth === 'all' ? getCurrentMonthPrefix() : 'all');
                  }}
                  className="text-xs font-medium text-stone-600 hover:text-stone-900 transition"
                  title="Нажмите для переключения: Месяц / За всё время"
                >
                  {formatMonthTitle(selectedMonth)}
                </button>
                <button
                  type="button"
                  onClick={() => stepMonth(1)}
                  aria-label="Следующий месяц"
                  className="p-0.5 text-stone-400 hover:text-stone-800 rounded transition"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Навигация по 4 вкладкам (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 bg-stone-100 p-1 rounded-2xl border border-stone-200/60" aria-label="Разделы приложения">
            {[
              { id: 'dashboard', label: 'Обзор', icon: LayoutGrid },
              { id: 'history', label: 'Операции и чеки', icon: ListOrdered, badge: periodTransactions.length },
              { id: 'debts', label: 'Платежи и план', icon: ShieldCheck, badge: pendingBillsCount > 0 ? pendingBillsCount : null, alert: pendingBillsCount > 0 },
              { id: 'goals', label: 'Копилки', icon: Target, badge: goals.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== null && tab.badge !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      tab.alert
                        ? 'bg-amber-100 text-amber-800 font-bold'
                        : isActive
                        ? 'bg-stone-100 text-stone-700'
                        : 'text-stone-400'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Правый блок: Переключатель профиля + Бэкап/XLSX + Кнопка быстрой записи */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200/70">
              <button
                type="button"
                onClick={() => setCurrentUser('husband')}
                className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium transition-all ${
                  currentUser === 'husband'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span>🧔🏻‍♂️</span>
                <span className="hidden lg:inline">Муж</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentUser('wife')}
                className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium transition-all ${
                  currentUser === 'wife'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span>👩🏼</span>
                <span className="hidden lg:inline">Жена</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              aria-label="Экспорт в Excel, CSV и резервная копия"
              className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-2xl transition border border-stone-200/80"
              title="Экспорт в XLSX / CSV / AI и резервная копия"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="hidden sm:inline">Бэкап / XLSX</span>
            </button>

            <button
              type="button"
              onClick={() => openNewTransactionModal()}
              className="hidden sm:flex items-center gap-1.5 bg-stone-900 text-white hover:bg-stone-800 text-xs font-semibold px-3.5 py-2 rounded-2xl transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Записать</span>
            </button>
          </div>
        </div>
      </header>

      {/* Основной контент по вкладкам */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {/* ================= ВКЛАДКА 1: ОБЗОР (ДАШБОРД) ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            {/* УМНАЯ НАПОМИНАЛКА О ГОРЯЩИХ И ПРОСРОЧЕННЫХ ОБЯЗАТЕЛЬНЫХ ПЛАТЕЖАХ */}
            {reminderSummary.urgentRecs.length > 0 && (
              <div className="bg-amber-50/90 border border-amber-200/90 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-950 flex items-center gap-2 flex-wrap">
                      <span>Напоминалка по постоянным расходам ({reminderSummary.urgentRecs.length})</span>
                    </div>
                    <div className="text-xs text-amber-900 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                      {reminderSummary.urgentRecs.slice(0, 3).map(r => (
                        <span key={r.id} className="inline-flex items-center gap-1">
                          <strong>{r.title}</strong>: {Number(r.amount).toLocaleString('ru-RU')} ₽ ({r.status.label})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {reminderSummary.urgentRecs.length === 1 && (
                    <button
                      type="button"
                      onClick={() => openPayRecurringModal(reminderSummary.urgentRecs[0])}
                      className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition"
                    >
                      Оплатить сейчас
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('debts')}
                    className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-950 text-xs font-semibold hover:bg-amber-100 transition"
                  >
                    К списку платежей →
                  </button>
                </div>
              </div>
            )}

            {/* 3 КУМУЛЯТИВНЫХ ОСТАТКА + БЕЗОПАСНЫЙ ЛИМИТ В ДЕНЬ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* 1. Общий котел */}
              <div
                onClick={() => setActiveWalletCard('shared')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveWalletCard('shared'); }}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
                  activeWalletCard === 'shared'
                    ? 'bg-white border-stone-900 ring-2 ring-stone-900/10 shadow-md'
                    : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between text-stone-600 text-xs font-medium">
                  <span className="uppercase tracking-wider font-semibold text-[10px] sm:text-xs flex items-center gap-1">
                    <span>👥</span> Общий котел
                  </span>
                  <Wallet className="w-4 h-4 text-stone-500 shrink-0" />
                </div>
                <div className="my-2.5">
                  <div className="text-lg sm:text-2xl font-bold tracking-tight text-stone-900 truncate">
                    {stats.shared.balance.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">Переходящий остаток</div>
                </div>
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1 text-[11px]">
                  <span className="text-emerald-700 font-medium truncate">+{stats.shared.monthIncome.toLocaleString('ru-RU')}</span>
                  <span className="text-rose-600 font-medium truncate">−{stats.shared.monthExpense.toLocaleString('ru-RU')}</span>
                </div>
              </div>

              {/* 2. Личный: Муж */}
              <div
                onClick={() => setActiveWalletCard('husband')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveWalletCard('husband'); }}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
                  activeWalletCard === 'husband'
                    ? 'bg-white border-stone-900 ring-2 ring-stone-900/10 shadow-md'
                    : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between text-stone-600 text-xs font-medium">
                  <span className="uppercase tracking-wider font-semibold text-[10px] sm:text-xs flex items-center gap-1">
                    <span>🧔🏻‍♂️</span> Муж (Личный)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium">Свой</span>
                </div>
                <div className="my-2.5">
                  <div className="text-lg sm:text-2xl font-bold tracking-tight text-stone-900 truncate">
                    {stats.husbandPersonal.balance.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">Переходящий остаток</div>
                </div>
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1 text-[11px]">
                  <span className="text-emerald-700 font-medium truncate">+{stats.husbandPersonal.monthIncome.toLocaleString('ru-RU')}</span>
                  <span className="text-rose-600 font-medium truncate">−{stats.husbandPersonal.monthExpense.toLocaleString('ru-RU')}</span>
                </div>
              </div>

              {/* 3. Личный: Жена */}
              <div
                onClick={() => setActiveWalletCard('wife')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveWalletCard('wife'); }}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
                  activeWalletCard === 'wife'
                    ? 'bg-white border-stone-900 ring-2 ring-stone-900/10 shadow-md'
                    : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between text-stone-600 text-xs font-medium">
                  <span className="uppercase tracking-wider font-semibold text-[10px] sm:text-xs flex items-center gap-1">
                    <span>👩🏼</span> Жена (Личный)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium">Свой</span>
                </div>
                <div className="my-2.5">
                  <div className="text-lg sm:text-2xl font-bold tracking-tight text-stone-900 truncate">
                    {stats.wifePersonal.balance.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">Переходящий остаток</div>
                </div>
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1 text-[11px]">
                  <span className="text-emerald-700 font-medium truncate">+{stats.wifePersonal.monthIncome.toLocaleString('ru-RU')}</span>
                  <span className="text-rose-600 font-medium truncate">−{stats.wifePersonal.monthExpense.toLocaleString('ru-RU')}</span>
                </div>
              </div>

              {/* 4. Безопасный лимит в день с резервом на платежи */}
              <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white p-4 sm:p-5 rounded-3xl shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-stone-300 text-xs font-medium">
                  <span className="uppercase tracking-wider font-semibold text-[10px] sm:text-xs truncate">
                    {stats.isPastMonth ? 'Итог месяца' : 'Безопасный лимит'}
                  </span>
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                </div>
                <div className="my-2.5">
                  <div className="text-lg sm:text-2xl font-bold tracking-tight text-amber-300 truncate">
                    {stats.dailyAvailable.toLocaleString('ru-RU')} {stats.isPastMonth ? '₽' : '₽/день'}
                  </div>
                  <div className="text-[11px] text-stone-300 mt-0.5 truncate">
                    {stats.isPastMonth
                      ? 'Период завершен'
                      : activeWalletCard === 'shared'
                      ? `Общий • на ${stats.daysLeft} дн.`
                      : activeWalletCard === 'husband'
                      ? `Личный (Муж) • на ${stats.daysLeft} дн.`
                      : `Личный (Жена) • на ${stats.daysLeft} дн.`}
                  </div>
                  {!stats.isPastMonth && (
                    stats.reserveToDeduct > 0 ? (
                      <div className="text-[10px] text-amber-300 font-medium mt-1 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 shrink-0" />
                        <span>Резерв счетов: {stats.reserveToDeduct.toLocaleString('ru-RU')} ₽</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>Обязательные счета закрыты</span>
                      </div>
                    )
                  )}
                </div>
                <div className="pt-2 border-t border-stone-700/60 text-[11px] text-stone-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                    <span>Отложено/кредиты: {stats.activeSavedAndDebtPaid.toLocaleString('ru-RU')} ₽</span>
                  </span>
                </div>
              </div>
            </div>

            {/* БЛОК ЧИСТЫХ SVG-ГРАФИКОВ (Темп по дням / 50-30-20 / Динамика 6 мес) */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-stone-700" />
                    <span>Финансовый радар и аналитика</span>
                  </h2>
                  <p className="text-xs text-stone-500">
                    Потребительский темп без искажения копилками, баланс 50/30/20 и история за 6 мес.
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-2xl border border-stone-200/70 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setChartView('burndown')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      chartView === 'burndown' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Темп по дням
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('rule503020')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      chartView === 'rule503020' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    3 корзины (50/30/20)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('dynamics')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      chartView === 'dynamics' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Динамика 6 мес
                  </button>
                </div>
              </div>

              {/* ГРАФИК 1: Burn-down темпа трат */}
              {chartView === 'burndown' && (
                selectedMonth === 'all' ? (
                  <div className="py-12 text-center text-xs text-stone-500">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-stone-400" />
                    <p className="font-semibold text-stone-700">Темп по дням строится для выбранного месяца</p>
                    <p className="mt-1">Выберите конкретный месяц в шапке для анализа дневной траектории трат</p>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs font-medium flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1 text-stone-500">
                          <span className="w-3 h-0.5 border-t-2 border-dashed border-stone-400 inline-block"></span>
                          План расходов ({burnDownData.baseBudget.toLocaleString('ru-RU')} ₽)
                        </span>
                        <span className="flex items-center gap-1 text-stone-900 font-semibold">
                          <span className="w-3 h-1 bg-stone-900 inline-block rounded-full"></span>
                          Потребительский факт ({burnDownData.actualUpToCurrent.toLocaleString('ru-RU')} ₽)
                        </span>
                      </div>

                      <div className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 ${
                        burnDownData.isUnderBudget
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}>
                        {burnDownData.isUnderBudget ? (
                          <>
                            <span>🟢</span>
                            <span>В графике (запас {burnDownData.diff.toLocaleString('ru-RU')} ₽)</span>
                          </>
                        ) : (
                          <>
                            <span>🟠</span>
                            <span>Опережение плана на {Math.abs(burnDownData.diff).toLocaleString('ru-RU')} ₽</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="w-full bg-stone-50/60 p-3 rounded-2xl border border-stone-100 overflow-hidden">
                      <svg viewBox="0 0 500 200" className="w-full h-44 select-none">
                        <line x1="40" y1="25" x2="460" y2="25" stroke="#e7e5e4" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="40" y1="100" x2="460" y2="100" stroke="#e7e5e4" strokeWidth="1" strokeDasharray="3 3" />
                        <line x1="40" y1="175" x2="460" y2="175" stroke="#d6d3d1" strokeWidth="1" />

                        <polyline
                          fill="none"
                          stroke="#a8a29e"
                          strokeWidth="2"
                          strokeDasharray="5 5"
                          points={burnDownData.planPointsStr}
                        />

                        <polyline
                          fill="none"
                          stroke="#1c1917"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={burnDownData.actualPointsStr}
                        />

                        {burnDownData.actualPoints.slice(1).map(p => (
                          <circle
                            key={p.day}
                            cx={burnDownData.getX(p.day)}
                            cy={burnDownData.getY(p.value)}
                            r={p.day === burnDownData.currentDay ? "4" : "2.5"}
                            fill={p.day === burnDownData.currentDay ? "#f59e0b" : "#1c1917"}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        ))}

                        <text x="40" y="193" fontSize="10" fill="#78716c">1 дн.</text>
                        <text x="250" y="193" fontSize="10" fill="#78716c" textAnchor="middle">15 дн.</text>
                        <text x="460" y="193" fontSize="10" fill="#78716c" textAnchor="end">{stats.daysInMonth} дн.</text>
                      </svg>
                    </div>
                  </div>
                )
              )}

              {/* ГРАФИК 2: Светофор 50/30/20 */}
              {chartView === 'rule503020' && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-stone-800 flex items-center gap-1">
                          <span>🏠</span> Базовые нужды
                        </span>
                        <span className="text-[11px] font-bold text-stone-500">Цель: 50%</span>
                      </div>
                      <div className="text-base font-bold text-stone-900">
                        {rule503020Data.base.toLocaleString('ru-RU')} ₽
                        <span className="text-xs font-normal text-stone-500 ml-1">({rule503020Data.basePct}%)</span>
                      </div>
                      <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            rule503020Data.basePct <= 55 ? 'bg-emerald-600' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, rule503020Data.basePct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-stone-500 mt-1">Дом, ЖКУ, связь, еда, дети, авто, здоровье</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-stone-800 flex items-center gap-1">
                          <span>☕</span> Хотелки и досуг
                        </span>
                        <span className="text-[11px] font-bold text-stone-500">Цель: 30%</span>
                      </div>
                      <div className="text-base font-bold text-stone-900">
                        {rule503020Data.wants.toLocaleString('ru-RU')} ₽
                        <span className="text-xs font-normal text-stone-500 ml-1">({rule503020Data.wantsPct}%)</span>
                      </div>
                      <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            rule503020Data.wantsPct <= 35 ? 'bg-emerald-600' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, rule503020Data.wantsPct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-stone-500 mt-1">Кафе, рестораны, кино, шопинг</div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-stone-800 flex items-center gap-1">
                          <span>🎯</span> Сбережения и долги
                        </span>
                        <span className="text-[11px] font-bold text-stone-500">Цель: 20%</span>
                      </div>
                      <div className="text-base font-bold text-stone-900">
                        {rule503020Data.future.toLocaleString('ru-RU')} ₽
                        <span className="text-xs font-normal text-stone-500 ml-1">({rule503020Data.futurePct}%)</span>
                      </div>
                      <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            rule503020Data.futurePct >= 18 ? 'bg-emerald-600' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, rule503020Data.futurePct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-stone-500 mt-1">Копилки и выплата кредитов</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ГРАФИК 3: Динамика за 6 месяцев */}
              {chartView === 'dynamics' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-emerald-800 font-semibold">
                        <span className="w-2.5 h-2.5 bg-emerald-600 inline-block rounded-sm"></span> Доходы
                      </span>
                      <span className="flex items-center gap-1 text-stone-900 font-semibold">
                        <span className="w-2.5 h-2.5 bg-stone-900 inline-block rounded-sm"></span> Расходы
                      </span>
                      <span className="flex items-center gap-1 text-violet-700 font-semibold">
                        <span className="w-2.5 h-2.5 bg-violet-600 inline-block rounded-sm"></span> Сбережения и долги
                      </span>
                    </div>
                    <span className="text-[11px] text-stone-500 hidden sm:inline">Норма сбережений над столбцами</span>
                  </div>

                  <div className="w-full bg-stone-50/60 p-3 rounded-2xl border border-stone-100 overflow-x-auto">
                    <svg viewBox="0 0 500 180" className="w-full min-w-[420px] h-40 select-none">
                      <line x1="20" y1="150" x2="480" y2="150" stroke="#d6d3d1" strokeWidth="1" />
                      {dynamics6MonthsData.list.map((m, idx) => {
                        const startX = 35 + idx * 75;
                        const barW = 16;
                        const maxH = 110;

                        const incH = (m.inc / dynamics6MonthsData.maxVal) * maxH;
                        const expH = (m.exp / dynamics6MonthsData.maxVal) * maxH;
                        const savH = (m.sav / dynamics6MonthsData.maxVal) * maxH;

                        return (
                          <g key={m.ym}>
                            {m.inc > 0 && (
                              <rect
                                x={startX}
                                y={150 - Math.max(3, incH)}
                                width={barW}
                                height={Math.max(3, incH)}
                                rx="3"
                                fill="#10b981"
                              />
                            )}
                            {m.exp > 0 && (
                              <rect
                                x={startX + barW + 2}
                                y={150 - Math.max(3, expH)}
                                width={barW}
                                height={Math.max(3, expH)}
                                rx="3"
                                fill="#1c1917"
                              />
                            )}
                            {m.sav > 0 && (
                              <rect
                                x={startX + (barW + 2) * 2}
                                y={150 - Math.max(3, savH)}
                                width={barW}
                                height={Math.max(3, savH)}
                                rx="3"
                                fill="#8b5cf6"
                              />
                            )}
                            {m.inc > 0 && (
                              <text
                                x={startX + barW * 1.5 + 2}
                                y={Math.min(150 - Math.max(incH, expH, savH) - 6, 135)}
                                fontSize="9"
                                fontWeight="bold"
                                fill="#6d28d9"
                                textAnchor="middle"
                              >
                                {m.savingsRate}%
                              </text>
                            )}
                            <text
                              x={startX + barW * 1.5 + 2}
                              y="166"
                              fontSize="11"
                              fontWeight={m.ym === selectedMonth ? "bold" : "normal"}
                              fill={m.ym === selectedMonth ? "#1c1917" : "#78716c"}
                              textAnchor="middle"
                            >
                              {m.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* СРЕДНИЙ РЯД: Структура трат + Участие в общем котле */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-stone-900">
                        Структура расходов ({activeWalletCard === 'shared' ? 'Общий котел 👥' : activeWalletCard === 'husband' ? 'Личный: Муж 🧔🏻‍♂️' : 'Личный: Жена 👩🏼'})
                      </h2>
                      <p className="text-xs text-stone-500">
                        Потребительские траты: <span className="font-semibold text-stone-800">{stats.totalSelectedExpense.toLocaleString('ru-RU')} ₽</span>
                        {expenseForecastData.totalPlannedBudget > 0 && (
                          <span className="ml-1.5 text-stone-400">
                            (прогноз/план месяца: {expenseForecastData.totalPlannedBudget.toLocaleString('ru-RU')} ₽)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveTab('debts')}
                        className="text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl transition"
                      >
                        План/Прогноз
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openWalletHistory(activeWalletCard);
                          setActiveTab('history');
                        }}
                        className="text-xs font-medium text-stone-600 hover:text-stone-900 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 transition"
                      >
                        <span>Детали</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {stats.topCategories.length === 0 ? (
                    <div className="py-8 text-center text-xs text-stone-500">
                      Нет потребительских расходов по этому счету за выбранный период
                    </div>
                  ) : (
                    <div className="space-y-3 mt-2">
                      {stats.topCategories.slice(0, 6).map(item => (
                        <div key={item.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 font-medium text-stone-800 truncate">
                              <span>{item.meta.icon}</span>
                              <span className="truncate">{item.name}</span>
                              {item.isNewInMonth ? (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800">
                                  Новая в мес.
                                </span>
                              ) : item.diff !== 0 ? (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                  item.diff > 0
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                  {item.diff > 0 ? `+${item.diff.toLocaleString('ru-RU')} ₽ к ${stats.prevMonthShortName} 🔺` : `−${Math.abs(item.diff).toLocaleString('ru-RU')} ₽ к ${stats.prevMonthShortName} 🟢`}
                                </span>
                              ) : null}
                            </span>
                            <span className="text-stone-600 font-semibold shrink-0 ml-2">
                              {item.sum.toLocaleString('ru-RU')} ₽ <span className="text-stone-400 font-normal">({item.percent}%)</span>
                            </span>
                          </div>
                          <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-stone-800 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(4, item.percent)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Участие в общем котле: ДВЕ ПРОЗРАЧНЫЕ ШКАЛЫ */}
              <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-stone-900">Участие в общем котле</h2>
                    <User className="w-4 h-4 text-stone-500" />
                  </div>
                  <p className="text-xs text-stone-500 mb-4">
                    Две прозрачные шкалы вклада в семейный бюджет
                  </p>

                  <div className="space-y-4">
                    {(() => {
                      const totalInc = stats.shared.monthIncome;
                      const hIncPct = totalInc > 0 ? Math.round((stats.shared.husbandIncome / totalInc) * 100) : 0;
                      const wIncPct = totalInc > 0 ? 100 - hIncPct : 0;
                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-stone-700 flex items-center gap-1">
                              <span>💰</span> Вклад в доходы котла
                            </span>
                            <span className="text-stone-500 text-[11px]">
                              Всего: {totalInc.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                          <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden flex">
                            <div
                              className="bg-emerald-600 h-full transition-all duration-500"
                              style={{ width: `${hIncPct}%` }}
                            />
                            <div
                              className="bg-teal-400 h-full transition-all duration-500"
                              style={{ width: `${wIncPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-stone-600">
                            <span>🧔🏻‍♂️ Муж: {stats.shared.husbandIncome.toLocaleString('ru-RU')} ₽{totalInc > 0 ? ` (${hIncPct}%)` : ''}</span>
                            <span>👩🏼 Жена: {stats.shared.wifeIncome.toLocaleString('ru-RU')} ₽{totalInc > 0 ? ` (${wIncPct}%)` : ''}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {(() => {
                      const totalExp = stats.shared.consumerExpense;
                      const hExpPct = totalExp > 0 ? Math.round((stats.shared.husbandConsumerSpent / totalExp) * 100) : 0;
                      const wExpPct = totalExp > 0 ? 100 - hExpPct : 0;
                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-stone-700 flex items-center gap-1">
                              <span>🛒</span> Оплата общих покупок
                            </span>
                            <span className="text-stone-500 text-[11px]">
                              Всего: {totalExp.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                          <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden flex">
                            <div
                              className="bg-stone-900 h-full transition-all duration-500"
                              style={{ width: `${hExpPct}%` }}
                            />
                            <div
                              className="bg-stone-400 h-full transition-all duration-500"
                              style={{ width: `${wExpPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-stone-600">
                            <span>🧔🏻‍♂️ Муж: {stats.shared.husbandConsumerSpent.toLocaleString('ru-RU')} ₽{totalExp > 0 ? ` (${hExpPct}%)` : ''}</span>
                            <span>👩🏼 Жена: {stats.shared.wifeConsumerSpent.toLocaleString('ru-RU')} ₽{totalExp > 0 ? ` (${wExpPct}%)` : ''}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-stone-600 flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                    <span>Отложено и погашено из котла:</span>
                  </span>
                  <span className="font-bold text-violet-700">
                    {stats.shared.savedAndDebtPaid.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
            </div>

            {/* ПОСЛЕДНИЕ ОПЕРАЦИИ */}
            <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-stone-900">Последние операции</h2>
                  <p className="text-xs text-stone-500">Нажмите на запись для редактирования или внесите пачку чеков за прошлую дату</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBatchReceiptMode(true);
                      openNewTransactionModal();
                    }}
                    className="text-xs font-semibold text-stone-800 hover:text-stone-950 px-3 py-1.5 rounded-xl bg-amber-100/80 hover:bg-amber-200/80 transition flex items-center gap-1"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Внести чеки за дату</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="text-xs font-medium text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 transition"
                  >
                    Все ({periodTransactions.length})
                  </button>
                </div>
              </div>

              {periodTransactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  В этом месяце операций пока нет
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {periodTransactions.slice(0, 6).map(tx => renderTransactionRow(tx))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= ВКЛАДКА 2: ОПЕРАЦИИ И КАЛЕНДАРЬ ЧЕКОВ ================= */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Поиск по названию или категории..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Поиск по операциям"
                    className="w-full text-xs font-medium pl-9 pr-8 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Сбросить поиск"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                  className={`px-3 py-2.5 rounded-2xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                    isCalendarExpanded || selectedCalendarDate
                      ? 'bg-amber-100 text-amber-950 border-amber-300'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{selectedCalendarDate ? `День: ${selectedCalendarDate.slice(8, 10)}.${selectedCalendarDate.slice(5, 7)}` : 'Календарь чеков'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  aria-expanded={isFilterOpen}
                  aria-label="Открыть фильтры операций"
                  className={`px-3 py-2.5 rounded-2xl border text-xs font-medium flex items-center gap-1.5 transition ${
                    hasActiveFilters
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Фильтры</span>
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-stone-950 font-bold text-[10px] flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* ИНТЕРАКТИВНЫЙ КАЛЕНДАРЬ ЧЕКОВ ПО ДНЯМ МЕСЯЦА */}
              {isCalendarExpanded && (
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>Календарь разбора чеков — {formatMonthTitle(monthCalendarDays.targetYm)}</span>
                      </h3>
                      <p className="text-[11px] text-stone-500">
                        Выберите любой день из прошлого, чтобы посмотреть операции или сразу внести пачку чеков за это число
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {selectedCalendarDate && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setIsBatchReceiptMode(true);
                              openNewTransactionModal(null, null, selectedCalendarDate);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Чеки за {selectedCalendarDate.slice(8, 10)}.{selectedCalendarDate.slice(5, 7)}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCalendarDate(null)}
                            className="px-2.5 py-1.5 rounded-xl bg-stone-200 text-stone-700 text-xs font-medium hover:bg-stone-300 transition"
                          >
                            Все дни
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-stone-400 pb-1">
                    <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {monthCalendarDays.cells.map(cell => {
                      if (cell.empty) {
                        return <div key={cell.key} className="h-12 rounded-xl bg-transparent" />;
                      }
                      const isSelected = selectedCalendarDate === cell.dateStr;
                      const isToday = cell.dateStr === getLocalDateString();
                      return (
                        <button
                          key={cell.dateStr}
                          type="button"
                          onClick={() => setSelectedCalendarDate(isSelected ? null : cell.dateStr)}
                          onDoubleClick={() => {
                            setIsBatchReceiptMode(true);
                            openNewTransactionModal(null, null, cell.dateStr);
                          }}
                          title="Нажмите для фильтра по дню, двойной клик — добавить чек за этот день"
                          className={`h-12 rounded-xl border p-1 flex flex-col items-center justify-between text-center transition ${
                            isSelected
                              ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                              : isToday
                              ? 'bg-amber-50/80 border-amber-300 text-stone-900'
                              : cell.count > 0
                              ? 'bg-white border-stone-200 hover:border-stone-400 text-stone-800'
                              : 'bg-white/60 border-stone-100 hover:border-stone-300 text-stone-400'
                          }`}
                        >
                          <span className="text-[11px] font-bold leading-none">{cell.day}</span>
                          {cell.count > 0 ? (
                            <span className={`text-[9px] font-medium truncate max-w-full leading-tight ${
                              isSelected ? 'text-amber-300' : 'text-stone-600'
                            }`}>
                              {cell.expense > 0 ? `−${Math.round(cell.expense / 1000)}k` : `+${Math.round(cell.income / 1000)}k`}
                            </span>
                          ) : (
                            <span className="text-[9px] opacity-40">·</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Выпадающая панель фильтров */}
              {isFilterOpen && (
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3 animate-fade-in text-xs">
                  <div>
                    <label className="text-[11px] font-medium text-stone-500 block mb-1">Кто записал:</label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { id: 'all', label: 'Все' },
                        { id: 'husband', label: '🧔🏻‍♂️ Муж' },
                        { id: 'wife', label: '👩🏼 Жена' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFilterAuthor(opt.id)}
                          className={`px-2.5 py-1 rounded-lg font-medium transition ${
                            filterAuthor === opt.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-stone-500 block mb-1">Тип операции:</label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { id: 'all', label: 'Все' },
                        { id: 'expense', label: 'Расходы (−)' },
                        { id: 'income', label: 'Доходы (+)' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFilterType(opt.id)}
                          className={`px-2.5 py-1 rounded-lg font-medium transition ${
                            filterType === opt.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-stone-500 block mb-1">Счет:</label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { id: 'all', label: 'Все счета' },
                        { id: 'shared', label: '👥 Общий' },
                        { id: 'personal', label: '👤 Личный' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFilterAccount(opt.id)}
                          className={`px-2.5 py-1 rounded-lg font-medium transition ${
                            filterAccount === opt.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium flex-wrap gap-2">
                <span>
                  Найдено: <strong className="text-stone-800">{filteredTransactions.length}</strong> из {periodTransactions.length}
                  {selectedCalendarDate && (
                    <span className="ml-2 text-amber-800 font-semibold">
                      • Фильтр по дате: {selectedCalendarDate}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBatchReceiptMode(true);
                      openNewTransactionModal(null, null, selectedCalendarDate || getTargetDateForMonth(selectedMonth));
                    }}
                    className="text-stone-800 font-semibold hover:text-stone-950 underline"
                  >
                    + Внести пачку чеков за дату
                  </button>
                  {selectedMonth !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedMonth('all')}
                      className="text-stone-600 hover:text-stone-900 underline"
                    >
                      Показать за всё время
                    </button>
                  )}
                </div>
              </div>
            </div>

            {groupedTransactions.length === 0 ? (
              <div className="py-12 text-center bg-white rounded-3xl border border-stone-200/80 p-8 shadow-sm">
                <div className="text-3xl mb-2">🧾</div>
                <div className="text-sm font-semibold text-stone-700">
                  {selectedCalendarDate ? `За ${selectedCalendarDate} операций пока нет` : 'Операций не найдено'}
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  {selectedCalendarDate
                    ? 'Вы можете сразу добавить один или несколько чеков за этот день'
                    : 'Попробуйте изменить запрос или сбросить фильтры'}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  {selectedCalendarDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsBatchReceiptMode(true);
                        openNewTransactionModal(null, null, selectedCalendarDate);
                      }}
                      className="px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition"
                    >
                      + Добавить чеки за {selectedCalendarDate}
                    </button>
                  )}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="px-4 py-2 rounded-xl bg-stone-100 text-stone-800 text-xs font-semibold hover:bg-stone-200 transition"
                    >
                      Сбросить фильтры
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedTransactions.map(group => (
                  <div key={group.date} className="bg-white rounded-3xl border border-stone-200/80 p-3 sm:p-4 shadow-sm">
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-stone-50 rounded-xl text-xs font-semibold text-stone-600 mb-2 gap-2">
                      <span className="truncate">{group.label}</span>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openNewTransactionModal(null, null, group.date)}
                          className="text-[11px] font-semibold text-stone-600 hover:text-stone-950 bg-white px-2 py-0.5 rounded-lg border border-stone-200/80 hover:border-stone-400 transition"
                          title={`Добавить ещё чек за ${group.date}`}
                        >
                          + Чек сюда
                        </button>
                        <span className={group.net >= 0 ? 'text-emerald-700' : 'text-stone-700'}>
                          {group.net >= 0 ? '+' : '−'}{Math.abs(group.net).toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-stone-100">
                      {group.items.map(tx => renderTransactionRow(tx))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= ВКЛАДКА 3: СЕМЕЙНЫЕ КОПИЛКИ ================= */}
        {activeTab === 'goals' && (
          <div className="space-y-5 animate-fade-in">
            <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-stone-900 flex items-center gap-2">
                  <span>🎯</span> Семейные копилки и цели
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Общий прогресс: <strong className="text-stone-800">{stats.totalSavings.toLocaleString('ru-RU')} ₽</strong> из {stats.totalTargetSavings.toLocaleString('ru-RU')} ₽ • Нажмите на карточку для пополнения или вывода
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingGoalId(null);
                  setNewGoalTitle('');
                  setNewGoalTarget('');
                  setNewGoalCurrent('0');
                  setIsNewGoalModalOpen(true);
                }}
                className="text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white px-4 py-2.5 rounded-2xl transition flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Новая цель</span>
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="bg-white rounded-3xl border border-stone-200/80 p-10 text-center shadow-sm">
                <div className="text-3xl mb-2">🎯</div>
                <div className="text-sm font-semibold text-stone-800">Нет активных целей-копилок</div>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Создайте цель накопления на отпуск, подушку безопасности или крупную покупку
                </p>
                <button
                  type="button"
                  onClick={() => setIsNewGoalModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Создать первую цель</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {goals.map(goal => {
                  const percent = goal.target > 0 ? Math.min(100, Math.max(0, Math.round((goal.current / goal.target) * 100))) : 0;
                  const remaining = Math.max(0, (Number(goal.target) || 0) - (Number(goal.current) || 0));
                  return (
                    <div
                      key={goal.id}
                      onClick={() => {
                        setSelectedGoalId(goal.id);
                        setGoalActionMode('contribute');
                        setGoalSourceAccount('shared');
                        setGoalActionDate(getTargetDateForMonth(selectedMonth));
                        setIsGoalModalOpen(true);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedGoalId(goal.id);
                          setGoalActionMode('contribute');
                          setIsGoalModalOpen(true);
                        }
                      }}
                      className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm hover:shadow-md hover:border-stone-300 transition-all cursor-pointer relative overflow-hidden group text-left flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl group-hover:scale-110 transition-transform">{goal.icon}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-xl">
                              {percent}%
                            </span>
                            <button
                              type="button"
                              onClick={(e) => openEditGoalModal(e, goal)}
                              aria-label={`Редактировать цель ${goal.title}`}
                              className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                              title="Изменить цель"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteGoal(e, goal.id)}
                              aria-label={`Удалить цель ${goal.title}`}
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                              title="Удалить цель"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="font-semibold text-stone-900 mb-1 flex items-center justify-between gap-2">
                          <span className="truncate">{goal.title}</span>
                          <span className="text-xs font-semibold text-violet-600 shrink-0">
                            ± Операция
                          </span>
                        </div>

                        <div className="text-xs text-stone-500 mb-3 font-medium">
                          {Number(goal.current).toLocaleString('ru-RU')} ₽ из {Number(goal.target).toLocaleString('ru-RU')} ₽
                        </div>
                      </div>

                      <div>
                        <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${goal.color} transition-all duration-500`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-stone-400 flex items-center justify-between">
                          <span>{remaining > 0 ? `Осталось: ${remaining.toLocaleString('ru-RU')} ₽` : 'Цель достигнута! 🎉'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= ВКЛАДКА 4: ПЛАТЕЖИ, НАПОМИНАЛКА И ПЛАНИРОВЩИК ================= */}
        {activeTab === 'debts' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-stone-500 block mb-0.5">Неоплаченные обязательные счета</span>
                  <div className="text-xl sm:text-2xl font-bold text-stone-900">
                    {stats.unpaidMandatoryThisMonth.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    {pendingBillsCount > 0
                      ? `Ожидают оплаты: ${pendingBillsCount} шт.`
                      : '✓ Все обязательные счета оплачены'}
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl shrink-0">
                  🛡️
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-stone-500 block mb-0.5">Планируемые расходы месяца</span>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-800">
                    {expenseForecastData.totalPlannedBudget.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    Факт сейчас: {expenseForecastData.totalCurrentActual.toLocaleString('ru-RU')} ₽ (из анализа {expenseForecastData.pastMonthsCount} прошл. мес.)
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl shrink-0">
                  📊
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-stone-500 block mb-0.5">Остаток по долгам и кредитам</span>
                  <div className="text-xl sm:text-2xl font-bold text-rose-600">
                    {stats.totalDebtRemaining.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-[11px] text-stone-500 mt-1">
                    Погашено {Math.max(0, stats.totalDebtInitial - stats.totalDebtRemaining).toLocaleString('ru-RU')} ₽ из {stats.totalDebtInitial.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center text-xl shrink-0">
                  💳
                </div>
              </div>
            </div>

            {/* РАЗДЕЛ 1: СПИСОК ПОСТОЯННЫХ ОБЯЗАТЕЛЬНЫХ РАСХОДОВ */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-stone-900 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-600" />
                    <span>Постоянные обязательные расходы и напоминалка</span>
                  </h2>
                  <p className="text-xs text-stone-500">
                    Мобильная связь, интернет, ЖКУ, аренда, секции — контролируйте сроки оплаты и резерв бюджета на месяц
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecurringId(null);
                    setNewRecTitle('');
                    setNewRecAmount('');
                    setNewRecCategory('Связь и интернет');
                    setNewRecDueDate('20');
                    setNewRecAccount('shared');
                    setNewRecMandatory(true);
                    setIsNewRecurringModalOpen(true);
                  }}
                  className="text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white px-3.5 py-2 rounded-2xl transition flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить постоянный расход</span>
                </button>
              </div>

              {recurringPayments.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  Список постоянных расходов пуст. Добавьте связь, интернет или ЖКУ для автоматических напоминаний.
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {[...recurringPayments]
                    .sort((a, b) => (Number(a.dueDate) || 1) - (Number(b.dueDate) || 1))
                    .map(rec => {
                      const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
                      const st = getRecurringReminderStatus(rec, targetYm);
                      const isPaid = st.code === 'paid';
                      const catMeta = getCategoryMeta(rec.category, 'expense', customCategories);
                      return (
                        <div key={rec.id} className="py-3.5 flex items-center justify-between gap-3 group flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base shrink-0 ${
                              isPaid ? 'bg-emerald-50 text-emerald-700' : st.code === 'overdue' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <span>{catMeta.icon}</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-stone-900 truncate flex items-center gap-2 flex-wrap">
                                <span>{rec.title}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-lg border ${st.badgeClass}`}>
                                  {st.label}
                                </span>
                                {rec.isMandatory === false && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-500">
                                    Необязательный
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>{rec.category}</span>
                                <span>•</span>
                                <span>
                                  {(rec.account || 'shared') === 'shared'
                                    ? '👥 Общий котел'
                                    : rec.author === 'wife'
                                    ? '👩🏼 Карта жены'
                                    : '🧔🏻‍♂️ Карта мужа'}
                                </span>
                                <span>•</span>
                                <span>Срок: до {rec.dueDate}-го числа</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-auto">
                            <div className="text-right mr-1">
                              <div className="text-sm font-bold text-stone-900">
                                {Number(rec.amount).toLocaleString('ru-RU')} ₽
                              </div>
                              <div className="text-[10px] text-stone-400">
                                план в месяц
                              </div>
                            </div>

                            {isPaid ? (
                              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                                ✓ Оплачено
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openPayRecurringModal(rec)}
                                className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition shadow-sm"
                              >
                                Оплатить
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => openEditRecurringModal(e, rec)}
                              aria-label={`Изменить платеж ${rec.title}`}
                              className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                              title="Редактировать"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteRecurring(e, rec.id)}
                              aria-label={`Удалить платеж ${rec.title}`}
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* РАЗДЕЛ 2: ПЛАНИРУЕМЫЕ И ПРЕДПОЛОЖИТЕЛЬНЫЕ РАСХОДЫ НА ОСНОВЕ ПРОШЛЫХ МЕСЯЦЕВ */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-stone-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-700" />
                    <span>Планируемые и предположительные расходы (по анализу прошлых месяцев)</span>
                  </h2>
                  <p className="text-xs text-stone-500">
                    Автоматический расчет ожидаемых трат по категориям на базе прошлых месяцев ({expenseForecastData.pastMonthsCount} мес. в базе) + постоянных счетов. Нажмите на карандаш, чтобы задать свой лимит.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAutoForecastLimits}
                  className="text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 px-3.5 py-2 rounded-2xl transition flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Заполнить план из прошлых месяцев</span>
                </button>
              </div>

              {expenseForecastData.rows.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  Пока недостаточно данных для прогноза по этому кошельку
                </div>
              ) : (
                <div className="space-y-3">
                  {expenseForecastData.rows.map(row => {
                    const isEditingThis = editingPlanCategory === row.category;
                    return (
                      <div key={row.category} className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/70 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${row.meta.color}`}>
                              {row.meta.icon}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-stone-900 flex items-center gap-2 flex-wrap">
                                <span>{row.category}</span>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-600">
                                  Среднее за прошл. мес: {row.avgHistorical.toLocaleString('ru-RU')} ₽
                                </span>
                                {row.recSum > 0 && (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                                    Постоянные счета: {row.recSum.toLocaleString('ru-RU')} ₽
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-stone-500 mt-0.5">
                                {row.isOverPlan
                                  ? `⚠️ Превышение планового бюджета на ${(row.currentActual - row.effectivePlan).toLocaleString('ru-RU')} ₽`
                                  : `Свободно по плану категории: ${row.remainingPlan.toLocaleString('ru-RU')} ₽`}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="500"
                                  value={editingPlanValue}
                                  onChange={(e) => setEditingPlanValue(e.target.value)}
                                  placeholder={String(row.autoSuggested)}
                                  className="w-24 text-xs font-bold px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveCategoryLimit(row.category)}
                                  className="p-1.5 bg-stone-900 text-white rounded-xl hover:bg-stone-800"
                                  title="Сохранить план"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingPlanCategory(null)}
                                  className="p-1.5 bg-stone-200 text-stone-700 rounded-xl hover:bg-stone-300"
                                  title="Отмена"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="text-right flex items-center gap-2">
                                <div>
                                  <div className="text-xs font-bold text-stone-900">
                                    Факт: {row.currentActual.toLocaleString('ru-RU')} ₽{' '}
                                    <span className="text-stone-400 font-normal">/ План: {row.effectivePlan.toLocaleString('ru-RU')} ₽</span>
                                  </div>
                                  <div className="text-[10px] text-stone-500">
                                    {row.userCustomLimit !== undefined ? 'Ручной план' : 'Авто-прогноз из прошлых мес.'} ({row.pctUsed}%)
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPlanCategory(row.category);
                                    setEditingPlanValue(String(row.effectivePlan));
                                  }}
                                  className="p-1.5 text-stone-500 hover:text-stone-900 bg-white border border-stone-200 rounded-xl hover:border-stone-400 transition"
                                  title="Изменить плановый бюджет категории"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              row.isOverPlan ? 'bg-rose-500' : row.pctUsed >= 85 ? 'bg-amber-500' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(100, row.pctUsed)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* РАЗДЕЛ 3: ДОЛГИ И КРЕДИТЫ (Обратные копилки) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-stone-900 flex items-center gap-2">
                    <span>💳</span>
                    <span>Долги и кредиты (Обратные копилки)</span>
                  </h2>
                  <p className="text-xs text-stone-500">
                    Прогресс выплаты, ежемесячные платежи и точный прогноз даты полного закрытия
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDebtId(null);
                    setNewDebtTitle('');
                    setNewDebtInitial('');
                    setNewDebtRemaining('');
                    setNewDebtPayment('');
                    setIsNewDebtModalOpen(true);
                  }}
                  className="text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white px-3.5 py-2 rounded-2xl transition flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить кредит</span>
                </button>
              </div>

              {debts.length === 0 ? (
                <div className="bg-white rounded-3xl border border-stone-200/80 p-8 text-center shadow-sm">
                  <div className="text-3xl mb-2">🎉</div>
                  <div className="text-sm font-semibold text-stone-800">Долгов и кредитов нет</div>
                  <p className="text-xs text-stone-500 mt-1">
                    При необходимости вы можете добавить рассрочку, ипотеку или кредит
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {debts.map(debt => {
                    const init = Math.max(1, Number(debt.initialAmount) || 1);
                    const rem = Math.max(0, Number(debt.remainingAmount) || 0);
                    const paid = Math.max(0, init - rem);
                    const percent = Math.min(100, Math.max(0, Math.round((paid / init) * 100)));
                    const monthly = Math.max(1, Number(debt.monthlyPayment) || 1);
                    const monthsLeft = rem > 0 ? Math.ceil(rem / monthly) : 0;

                    const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
                    const isPaidThisMonth = (debt.paidMonths || []).includes(targetYm);

                    const now = new Date();
                    const offsetMonths = Math.max(0, monthsLeft - (isPaidThisMonth ? 0 : 1));
                    const closeDate = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
                    const forecastText = monthsLeft > 0
                      ? `${monthsLeft} пл. (${MONTH_NAMES_NOMINATIVE[closeDate.getMonth()]} ${closeDate.getFullYear()})`
                      : 'Полностью закрыт! 🎉';

                    return (
                      <div
                        key={debt.id}
                        className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm hover:border-stone-300 transition flex flex-col justify-between space-y-4 relative group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl">{debt.icon}</span>
                              <div>
                                <h3 className="font-semibold text-stone-900 text-sm leading-tight">{debt.title}</h3>
                                <span className="text-[11px] text-stone-500">
                                  Платеж: {monthly.toLocaleString('ru-RU')} ₽ до {debt.paymentDay}-го числа
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-xl">
                                {percent}% закрыто
                              </span>
                              <button
                                type="button"
                                onClick={(e) => openEditDebtModal(e, debt)}
                                aria-label={`Изменить кредит ${debt.title}`}
                                className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                                title="Редактировать"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteDebt(e, debt.id)}
                                aria-label={`Удалить кредит ${debt.title}`}
                                className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                                title="Удалить"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-stone-500">Остаток долга:</span>
                              <span className="font-bold text-rose-600 text-sm">
                                {rem.toLocaleString('ru-RU')} ₽
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-stone-400">
                              <span>Выплачено: {paid.toLocaleString('ru-RU')} ₽</span>
                              <span>Из: {init.toLocaleString('ru-RU')} ₽</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden mb-2">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${debt.color} transition-all duration-500`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-stone-500 mb-3">
                            <span>Прогноз закрытия:</span>
                            <span className="font-semibold text-stone-800">{forecastText}</span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
                            <span className={`text-[11px] font-medium ${isPaidThisMonth ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {isPaidThisMonth ? '✓ Платёж за месяц внесен' : 'Платёж за месяц ожидает'}
                            </span>
                            <button
                              type="button"
                              onClick={() => openPayDebtModal(debt)}
                              className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition shadow-sm"
                            >
                              Внести платёж
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Мягкий Undo-тост */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-medium animate-fade-in max-w-[92vw]">
          <span className="truncate">{toast.message}</span>
          {toast.onUndo && (
            <button
              type="button"
              onClick={toast.onUndo}
              className="px-2.5 py-1 rounded-xl bg-amber-400 text-stone-950 font-bold hover:bg-amber-300 transition flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Вернуть</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Закрыть уведомление"
            className="text-stone-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Нижний навигационный бар для мобильных */}
      <nav
        aria-label="Мобильная навигация"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-2 py-1 flex items-center justify-around md:hidden"
      >
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-medium transition ${
            activeTab === 'dashboard' ? 'text-stone-900 font-semibold' : 'text-stone-400'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Обзор</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-medium transition ${
            activeTab === 'history' ? 'text-stone-900 font-semibold' : 'text-stone-400'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Чеки</span>
        </button>

        <button
          type="button"
          onClick={() => openNewTransactionModal()}
          aria-label="Быстрая запись операции"
          className="w-10 h-10 bg-stone-900 text-white rounded-2xl shadow-md flex items-center justify-center active:scale-95 transition mx-1 shrink-0"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('debts')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-medium transition relative ${
            activeTab === 'debts' ? 'text-stone-900 font-semibold' : 'text-stone-400'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>План/Счета</span>
          {pendingBillsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1 right-2" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('goals')}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-medium transition ${
            activeTab === 'goals' ? 'text-stone-900 font-semibold' : 'text-stone-400'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Копилки</span>
        </button>
      </nav>

      {/* МОДАЛЬНОЕ ОКНО: ЗАПИСЬ ИЛИ РЕДАКТИРОВАНИЕ ОПЕРАЦИИ (+ ПАЧКА ЧЕКОВ ЗА ДАТУ) */}
      {isAddModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsAddModalOpen(false); }}
          className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-modal-title"
        >
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[94vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-stone-500" />
                <span id="add-modal-title" className="font-semibold text-stone-900 text-sm">
                  {editingTxId ? 'Редактирование операции' : 'Запись расхода / дохода'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Закрыть модальное окно"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSaveTransaction(e, false)} className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-2xl relative">
                <button
                  type="button"
                  disabled={isEditingLockedType}
                  onClick={() => handleTypeChange('expense')}
                  className={`py-2 text-xs font-semibold rounded-xl transition ${
                    txType === 'expense' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                  } ${isEditingLockedType ? 'cursor-not-allowed opacity-80' : ''}`}
                >
                  Расход (−)
                </button>
                <button
                  type="button"
                  disabled={isEditingLockedType}
                  onClick={() => handleTypeChange('income')}
                  className={`py-2 text-xs font-semibold rounded-xl transition ${
                    txType === 'income' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-600'
                  } ${isEditingLockedType ? 'cursor-not-allowed opacity-80' : ''}`}
                >
                  Доход (+)
                </button>
              </div>

              {isEditingLockedType && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Тип и категория заблокированы, так как операция привязана к цели или кредиту</span>
                </div>
              )}

              <div>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0.01"
                    required
                    placeholder="0"
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-label="Сумма операции в рублях"
                    className="w-full text-3xl font-bold pl-4 pr-12 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-stone-400 pointer-events-none">
                    ₽
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-0.5">
                  {[100, 300, 500, 1000, 3000].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAmount(String((Number(amount) || 0) + v))}
                      className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-medium text-stone-700 whitespace-nowrap transition"
                    >
                      +{v}
                    </button>
                  ))}
                  {amount && (
                    <button
                      type="button"
                      onClick={() => setAmount('')}
                      className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-medium text-rose-600 whitespace-nowrap transition ml-auto"
                    >
                      Сброс
                    </button>
                  )}
                </div>
              </div>

              {/* ДАТА ЧЕКА ИЗ КАЛЕНДАРЯ + РЕЖИМ ПАЧКИ ЧЕКОВ */}
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Дата чека / операции:</span>
                  </label>
                  <div className="flex items-center gap-1">
                    {[
                      { label: 'Сегодня', val: getLocalDateString() },
                      { label: 'Вчера', val: getOffsetDateString(-1) },
                      { label: 'Позавчера', val: getOffsetDateString(-2) },
                    ].map(btn => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => setTxDate(btn.val)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                          txDate === btn.val
                            ? 'bg-stone-900 text-white'
                            : 'bg-white border border-stone-200 text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    aria-label="Дата операции"
                    className="flex-1 text-xs font-semibold px-3 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                  {!editingTxId && (
                    <button
                      type="button"
                      onClick={() => setIsBatchReceiptMode(!isBatchReceiptMode)}
                      className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition flex items-center gap-1 shrink-0 ${
                        isBatchReceiptMode
                          ? 'bg-amber-100 border-amber-300 text-amber-950'
                          : 'bg-white border-stone-200 text-stone-600 hover:text-stone-900'
                      }`}
                      title="Не закрывать окно после записи и сохранять выбранную дату для ввода нескольких чеков подряд"
                    >
                      <Pin className="w-3 h-3" />
                      <span>Пачка чеков</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-stone-500 block mb-1">
                  Источник / получатель средств:
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccount('shared');
                      setTxAuthor(currentUser);
                    }}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl transition truncate text-center ${
                      selectedAccount === 'shared'
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    👥 Общий котел
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccount('personal');
                      setTxAuthor('husband');
                    }}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl transition truncate text-center ${
                      selectedAccount === 'personal' && txAuthor === 'husband'
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    🧔🏻‍♂️ Карта мужа
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAccount('personal');
                      setTxAuthor('wife');
                    }}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl transition truncate text-center ${
                      selectedAccount === 'personal' && txAuthor === 'wife'
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    👩🏼 Карта жены
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-stone-500">
                    Категория
                  </label>
                  <div className="flex items-center gap-2">
                    {customCategories.some(c => (txType === 'income' ? c.type === 'income' : c.type !== 'income')) && (
                      <button
                        type="button"
                        onClick={() => setIsManagingCategories(!isManagingCategories)}
                        className="text-xs font-medium text-stone-500 hover:text-stone-800"
                      >
                        {isManagingCategories ? 'Готово' : 'Изм.'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomCategory(!isAddingCustomCategory)}
                      className="text-xs font-semibold text-stone-700 hover:text-stone-900"
                    >
                      {isAddingCustomCategory ? 'Отмена' : '+ Своя'}
                    </button>
                  </div>
                </div>

                {isAddingCustomCategory && (
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl mb-3 space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="🏷️"
                        value={newCatIcon}
                        onChange={(e) => setNewCatIcon(e.target.value)}
                        aria-label="Эмодзи категории"
                        className="w-12 text-center text-base p-2 bg-white border border-stone-200 rounded-xl focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Название категории..."
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        aria-label="Название новой категории"
                        className="flex-1 text-xs p-2.5 bg-white border border-stone-200 rounded-xl focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCreateCustomCategory}
                        aria-label="Сохранить категорию"
                        className="px-3 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                    {txType === 'expense' && (
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-stone-500">Корзина 50/30/20:</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setNewCatBucket('base')}
                            className={`px-2 py-1 rounded-lg font-medium ${
                              newCatBucket === 'base' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'
                            }`}
                          >
                            🏠 База (50%)
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewCatBucket('wants')}
                            className={`px-2 py-1 rounded-lg font-medium ${
                              newCatBucket === 'wants' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'
                            }`}
                          >
                            ☕ Хотелки (30%)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {activeCategories.map(c => (
                    <div key={c.id} className="relative">
                      <button
                        type="button"
                        disabled={isEditingLockedType}
                        onClick={() => setSelectedCategory(c.name)}
                        className={`w-full px-2.5 py-2 rounded-2xl flex items-center gap-2 text-left border transition ${
                          selectedCategory === c.name
                            ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                            : 'border-stone-200/70 bg-stone-50 text-stone-700 hover:bg-stone-100'
                        } ${isEditingLockedType ? 'opacity-75 cursor-not-allowed' : ''}`}
                      >
                        <span className="text-base shrink-0">{c.icon}</span>
                        <span className="text-xs font-medium truncate">{c.name}</span>
                      </button>
                      {isManagingCategories && c.id.startsWith('cat_') && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomCategory(e, c.id)}
                          aria-label={`Удалить категорию ${c.name}`}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Комментарий по чеку (необязательно, например: ВкусВилл)"
                  value={txTitle}
                  onChange={(e) => setTxTitle(e.target.value)}
                  aria-label="Комментарий к операции"
                  className="w-full text-xs px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                {editingTxId ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTransaction(editingTxId, e)}
                      className="px-4 py-3.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl font-semibold text-xs transition"
                    >
                      Удалить
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3.5 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition shadow-md"
                    >
                      Сохранить изменения
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={(e) => handleSaveTransaction(e, true)}
                      className="px-3.5 py-3.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-2xl font-semibold text-xs transition shrink-0"
                      title="Сохранить этот чек и сразу ввести следующий за эту же дату"
                    >
                      + Ещё чек
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3.5 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition active:scale-[0.99] shadow-md"
                    >
                      {isBatchReceiptMode ? `Записать за ${txDate.slice(8, 10)}.${txDate.slice(5, 7)}` : 'Записать'}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: ПОПОЛНЕНИЕ ИЛИ ВЫВОД ИЗ КОПИЛКИ */}
      {isGoalModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsGoalModalOpen(false); }}
          className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="goal-modal-title"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span id="goal-modal-title" className="font-semibold text-stone-900 text-sm">Операция с копилкой</span>
              <button
                type="button"
                onClick={() => setIsGoalModalOpen(false)}
                aria-label="Закрыть модальное окно"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleContributeGoal} className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setGoalActionMode('contribute')}
                  className={`py-2 rounded-lg transition ${
                    goalActionMode === 'contribute' ? 'bg-white text-violet-700 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  + Пополнить
                </button>
                <button
                  type="button"
                  onClick={() => setGoalActionMode('withdraw')}
                  className={`py-2 rounded-lg transition ${
                    goalActionMode === 'withdraw' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  − Взять из копилки
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Цель накопления</label>
                <select
                  value={selectedGoalId || goals[0]?.id || ''}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  aria-label="Выберите цель"
                  className="w-full text-xs font-semibold px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900"
                >
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.icon} {g.title} ({Number(g.current).toLocaleString('ru-RU')} / {Number(g.target).toLocaleString('ru-RU')} ₽)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">
                  {goalActionMode === 'withdraw' ? 'На какой счет вернуть средства?' : 'С какого счета списать?'}
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setGoalSourceAccount('shared')}
                    className={`py-1.5 rounded-lg font-medium transition ${
                      goalSourceAccount === 'shared' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                    }`}
                  >
                    👥 Общий котел
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoalSourceAccount('personal')}
                    className={`py-1.5 rounded-lg font-medium transition ${
                      goalSourceAccount === 'personal' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                    }`}
                  >
                    {currentUser === 'husband' ? '🧔🏻‍♂️ Личный (Муж)' : '👩🏼 Личный (Жена)'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Сумма (₽)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="5000"
                    autoFocus
                    value={goalAmount}
                    onChange={(e) => setGoalAmount(e.target.value)}
                    aria-label="Сумма"
                    className="w-full text-lg font-bold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Дата операции</label>
                  <input
                    type="date"
                    value={goalActionDate}
                    onChange={(e) => setGoalActionDate(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[1000, 3000, 5000, 10000].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setGoalAmount(String((Number(goalAmount) || 0) + v))}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-medium text-stone-700 whitespace-nowrap transition"
                  >
                    +{v} ₽
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className={`w-full py-3 text-white rounded-2xl font-semibold text-sm transition shadow-sm ${
                  goalActionMode === 'withdraw' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-violet-600 hover:bg-violet-700'
                }`}
              >
                {goalActionMode === 'withdraw' ? 'Вывести из копилки на счет' : 'Отложить в копилку'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: НОВАЯ ИЛИ РЕДАКТИРУЕМАЯ ЦЕЛЬ-КОПИЛКА */}
      {isNewGoalModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsNewGoalModalOpen(false); }}
          className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-goal-modal-title"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span id="new-goal-modal-title" className="font-semibold text-stone-900 text-sm">
                {editingGoalId ? 'Редактирование цели' : 'Новая цель-копилка'}
              </span>
              <button
                type="button"
                onClick={() => setIsNewGoalModalOpen(false)}
                aria-label="Закрыть модальное окно"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="pt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Название цели</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Отпуск, Ремонт кухни"
                  autoFocus
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Целевая сумма (₽)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="150000"
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Уже накоплено (₽)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={newGoalCurrent}
                    onChange={(e) => setNewGoalCurrent(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Иконка</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {QUICK_GOAL_ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewGoalIcon(ic)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm border transition ${
                        newGoalIcon === ic ? 'border-stone-900 bg-stone-100 font-bold' : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Цветовой градиент</label>
                <div className="grid grid-cols-5 gap-2">
                  {GOAL_COLOR_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setNewGoalColor(preset.value)}
                      aria-label={`Выбрать цвет ${preset.label}`}
                      className={`h-7 rounded-xl bg-gradient-to-r ${preset.value} border-2 transition ${
                        newGoalColor === preset.value ? 'border-stone-900 scale-105' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition"
              >
                {editingGoalId ? 'Сохранить изменения' : 'Создать цель'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: НОВЫЙ ИЛИ РЕДАКТИРУЕМЫЙ ПОСТОЯННЫЙ РАСХОД */}
      {isNewRecurringModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsNewRecurringModalOpen(false); }}
          className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-recurring-modal-title"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span id="new-recurring-modal-title" className="font-semibold text-stone-900 text-sm">
                {editingRecurringId ? 'Редактирование постоянного расхода' : 'Новый постоянный расход'}
              </span>
              <button
                type="button"
                onClick={() => setIsNewRecurringModalOpen(false)}
                aria-label="Закрыть модальное окно"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecurring} className="pt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Название (например: Мобильная связь, Интернет)</label>
                <input
                  type="text"
                  required
                  placeholder="Мобильная связь / Домашний интернет"
                  autoFocus
                  value={newRecTitle}
                  onChange={(e) => setNewRecTitle(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Плановая сумма (₽)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="1400"
                    value={newRecAmount}
                    onChange={(e) => setNewRecAmount(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Число напоминания (1–31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={newRecDueDate}
                    onChange={(e) => setNewRecDueDate(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Категория</label>
                <select
                  value={newRecCategory}
                  onChange={(e) => setNewRecCategory(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900"
                >
                  {[...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type !== 'income')].map(c => (
                    <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">С какого счета оплачивается?</label>
                <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setNewRecAccount('shared')}
                    className={`py-1.5 rounded-lg font-medium transition ${
                      newRecAccount === 'shared' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                    }`}
                  >
                    👥 Общий
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewRecAccount('personal');
                      setNewRecAuthor('husband');
                    }}
                    className={`py-1.5 rounded-lg font-medium transition ${
                      newRecAccount === 'personal' && newRecAuthor === 'husband' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                    }`}
                  >
                    🧔🏻‍♂️ Муж
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewRecAccount('personal');
                      setNewRecAuthor('wife');
                    }}
                    className={`py-1.5 rounded-lg font-medium transition ${
                      newRecAccount === 'personal' && newRecAuthor === 'wife' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                    }`}
                  >
                    👩🏼 Жена
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={newRecMandatory}
                  onChange={(e) => setNewRecMandatory(e.target.checked)}
                  className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                />
                <span>Обязательный платеж (резервировать сумму в дневном лимите)</span>
              </label>

              <button
                type="submit"
                className="w-full py-3 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition"
              >
                {editingRecurringId ? 'Сохранить изменения' : 'Добавить в постоянные расходы'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: ПОДТВЕРЖДЕНИЕ ОПЛАТЫ ПОСТОЯННОГО ПЛАТЕЖА */}
      {isPayRecurringModalOpen && selectedRecurringToPay && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsPayRecurringModalOpen(false); }}
          className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-rec-modal-title"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span id="pay-rec-modal-title" className="font-semibold text-stone-900 text-sm">
                Оплата: {selectedRecurringToPay.title}
              </span>
              <button
                type="button"
                onClick={() => setIsPayRecurringModalOpen(false)}
                aria-label="Закрыть модальное окно"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayRecurring} className="pt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">
                  Фактическая сумма по чеку (₽)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  autoFocus
                  value={recPayAmount}
                  onChange={(e) => setRecPayAmount(e.target.value)}
                  className="w-full text-2xl font-bold px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Дата оплаты</label>
                <input
                  type="date"
                  value={recPayDate}
                  onChange={(e) => setRecPayDate(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition shadow-sm"
              >
                Подтвердить оплату и снять резерв
              </button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: НОВЫЙ ИЛИ РЕДАКТИРУЕМЫЙ КРЕДИТ / ДОЛГ */}
      {isNewDebtModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsNewDebtModalOpen(false); }}
          className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-debt-modal-title"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span id="new-debt-modal-title" className="font-semibold text-stone-900 text-sm">
                {editingDebtId ? 'Редактирование кредита' : 'Новый кредит или рассрочка'}
              </span>
              <button
                type="button"
                onClick={() => setIsNewDebtModalOpen(false)}
                aria-label="Закрыть модальное окно"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDebt} className="pt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Название обязательства</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Ипотека, Рассрочка на ноутбук"
                  autoFocus
                  value={newDebtTitle}
                  onChange={(e) => setNewDebtTitle(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Начальная сумма (₽)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="300000"
                    value={newDebtInitial}
                    onChange={(e) => setNewDebtInitial(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Остаток долга (₽)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Если пусто = нач."
                    value={newDebtRemaining}
                    onChange={(e) => setNewDebtRemaining(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Платёж в месяц (₽)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="15000"
                    value={newDebtPayment}
                    onChange={(e) => setNewDebtPayment(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">День платежа</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={newDebtDay}
                    onChange={(e) => setNewDebtDay(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Иконка</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['💳', '🚗', '📱', '🏠', '💍', '💻', '🎓'].map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewDebtIcon(ic)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm border transition ${
                        newDebtIcon === ic ? 'border-stone-900 bg-stone-100 font-bold' : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition"
              >
                {editingDebtId ? 'Сохранить изменения' : 'Сохранить кредит'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: ВНЕСТИ ПЛАТЁЖ ПО КРЕДИТУ */}
      {isPayDebtModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsPayDebtModalOpen(false); }}
          className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-debt-modal-title"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span id="pay-debt-modal-title" className="font-semibold text-stone-900 text-sm">Внесение платежа по долгу</span>
              <button
                type="button"
                onClick={() => setIsPayDebtModalOpen(false)}
                aria-label="Закрыть модальное окно"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePayDebtSubmit} className="pt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">С какого баланса списать?</label>
                <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setDebtSourceAccount('shared')}
                    className={`py-1.5 rounded-lg font-medium transition ${
                      debtSourceAccount === 'shared' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                    }`}
                  >
                    👥 Общий
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDebtSourceAccount('personal');
                      setDebtSourceAuthor('husband');
                    }}
                    className={`py-1.5 rounded-lg font-medium transition ${
                      debtSourceAccount === 'personal' && debtSourceAuthor === 'husband' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                    }`}
                  >
                    🧔🏻‍♂️ Муж
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDebtSourceAccount('personal');
                      setDebtSourceAuthor('wife');
                    }}
                    className={`py-1.5 rounded-lg font-medium transition ${
                      debtSourceAccount === 'personal' && debtSourceAuthor === 'wife' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                    }`}
                  >
                    👩🏼 Жена
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Сумма платежа (₽)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    autoFocus
                    value={debtPayAmount}
                    onChange={(e) => setDebtPayAmount(e.target.value)}
                    className="w-full text-lg font-bold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Дата платежа</label>
                  <input
                    type="date"
                    value={debtPayDate}
                    onChange={(e) => setDebtPayDate(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-rose-600 text-white rounded-2xl font-semibold text-sm hover:bg-rose-700 transition shadow-sm"
              >
                Подтвердить платёж
              </button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: ЭКСПОРТ В XLSX / CSV / AI И УПРАВЛЕНИЕ БЭКАПОМ */}
      {isExportModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsExportModalOpen(false); }}
          className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-modal-title"
        >
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                <span id="export-modal-title" className="font-semibold text-stone-900 text-sm">
                  Экспорт в XLSX / CSV, анализ для ИИ и резервная копия
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                aria-label="Закрыть модальное окно"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Выгрузка в таблицы и для нейронки */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                1. Выгрузка для личного анализа, Excel и нейросетей
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadXlsx}
                  className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-left transition flex items-start gap-3"
                >
                  <Download className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-stone-900">Скачать Excel (.xlsx)</div>
                    <div className="text-[11px] text-stone-600 mt-0.5">
                      5 листов: Сводка, Операции, План/Прогноз, Постоянные счета, Долги и Копилки
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-left transition flex items-start gap-3"
                >
                  <FileSpreadsheet className="w-5 h-5 text-stone-800 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-stone-900">Универсальный CSV (.csv)</div>
                    <div className="text-[11px] text-stone-600 mt-0.5">
                      Понятная таблица для Excel и ИИ + 100% полный бэкап для обратной загрузки
                    </div>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyAiReport}
                  className="p-3.5 rounded-2xl border border-violet-200 bg-violet-50/70 hover:bg-violet-100/80 text-left transition flex items-start gap-3"
                >
                  <Copy className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-stone-900">Скопировать отчёт для ИИ</div>
                    <div className="text-[11px] text-stone-600 mt-0.5">
                      Готовый промпт + сводка и таблица операций для вставки в чат нейросети
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-left transition flex items-start gap-3"
                >
                  <Download className="w-5 h-5 text-stone-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-stone-900">Технический бэкап (.json)</div>
                    <div className="text-[11px] text-stone-600 mt-0.5">
                      Слепок всех коллекций LocalStorage для переноса между устройствами
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Восстановление из файла */}
            <div className="space-y-2.5 pt-2 border-t border-stone-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                2. Восстановление из бэкапа (.csv или .json)
              </h3>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-stone-300 hover:border-stone-900 bg-stone-50 hover:bg-stone-100 text-xs font-semibold text-stone-800 transition flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Загрузить файл бэкапа (.csv или .json) с устройства</span>
              </button>
            </div>

            {/* 3. Управление демо-данными */}
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                3. Старт с чистого листа / Демо-режим
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleClearAllData}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Очистить демо-данные (с нуля)</span>
                </button>
                <button
                  type="button"
                  onClick={handleRestoreDemoData}
                  className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition"
                >
                  Вернуть демо-пример
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
