// Получение локальной даты в формате YYYY-MM-DD (не зависит от UTC)
export const getLocalDateString = (dateObj = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Получение даты со сдвигом в днях от сегодня
export const getOffsetDateString = (daysOffset) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return getLocalDateString(d);
};

// Получение текущего месяца в формате YYYY-MM
export const getCurrentMonthPrefix = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Корректная дата внутри выбранного месяца
export const getTargetDateForMonth = (selectedMonth, preferredDay = null) => {
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

// Автонормализатор дат при импорте CSV и банковских выписок РФ (Сбер, Т-Банк, ВТБ, Альфа)
// Поддерживает: YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YY, YYYY/MM/DD (+ время)
export const normalizeImportedDate = (rawStr) => {
  const fallback = getLocalDateString();
  if (!rawStr) return fallback;
  const clean = String(rawStr).trim().split(/[\sT]+/)[0];
  if (!clean) return fallback;

  // 1. Уже ISO: YYYY-MM-DD или YYYY.MM.DD или YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Math.min(12, Math.max(1, Number(isoMatch[2])));
    const maxD = new Date(y, m, 0).getDate();
    const d = Math.min(maxD, Math.max(1, Number(isoMatch[3])));
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 2. Формат РФ: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY или DD.MM.YY
  const ruMatch = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (ruMatch) {
    let y = Number(ruMatch[3]);
    if (y < 100) y += 2000;
    const m = Math.min(12, Math.max(1, Number(ruMatch[2])));
    const maxD = new Date(y, m, 0).getDate();
    const d = Math.min(maxD, Math.max(1, Number(ruMatch[1])));
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return fallback;
};

// Парсинг сумм из банковских выписок ("-1 450,50 ₽", "+25 000,00")
export const parseImportedAmount = (rawVal) => {
  if (typeof rawVal === 'number') return Math.abs(rawVal);
  if (!rawVal) return 0;
  const cleaned = String(rawVal)
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? Math.round(Math.abs(num)) : 0;
};

// Компактное форматирование суммы для узких ячеек календаря (360px)
export const formatCompactCellAmount = (val) => {
  const num = Math.abs(Number(val) || 0);
  if (num === 0) return '';
  if (num < 1000) return String(Math.round(num));
  if (num < 10000) {
    const k = (num / 1000).toFixed(1).replace(/\.0$/, '');
    return `${k}k`;
  }
  return `${Math.round(num / 1000)}k`;
};

export const MONTH_NAMES_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

export const MONTH_NAMES_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
];

export const formatMonthTitle = (ym) => {
  if (!ym || ym === 'all') return 'За всё время';
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MONTH_NAMES_NOMINATIVE[m - 1]} ${y}`;
};

export const formatDateGroupHeader = (dateStr) => {
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
