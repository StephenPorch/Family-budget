// Экранирование и парсинг CSV (RFC 4180, разделитель `;` или `,`)
export const toCsvLine = (fields, sep = ';') => {
  return fields.map(v => {
    const s = String(v ?? '');
    if (s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(sep);
};

export const parseCsvText = (text) => {
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
