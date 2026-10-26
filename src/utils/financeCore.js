import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, CATEGORY_ALIASES } from './storage.js';
import { getCurrentMonthPrefix } from './dateUtils.js';

export const getCategoryMeta = (categoryName, type, customCategories = []) => {
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
export const isSavingsOrDebtTx = (tx) => {
  if (!tx) return false;
  if (tx.goalId || tx.debtId) return true;
  const cat = (tx.category || '').toLowerCase();
  return cat === 'накопления' || cat === 'долги и кредиты' || cat === 'долги' || cat === 'кредиты';
};

// Проверка: заблокирована ли смена типа/категории (для копилок, долгов И регулярных платежей)
export const isTransactionTypeLocked = (tx) => {
  return Boolean(tx?.goalId || tx?.debtId || tx?.recurringId);
};

export const isTransactionLockedType = isTransactionTypeLocked;

// Чистая функция расчета безопасного дневного лимита и кассового разрыва (v0.7.0)
export const calculateSafeDailyBudget = ({
  activeBalance = 0,
  unpaidMandatoryTotal = 0,
  unpaidRecommendedTotal = 0,
  deductMandatory = true,
  deductRecommended = false,
  daysLeft = 1,
  isPastMonth = false,
}) => {
  const reserveToDeduct =
    (deductMandatory ? unpaidMandatoryTotal : 0) +
    (deductRecommended ? unpaidRecommendedTotal : 0);
  const rawSafeBalance = activeBalance - reserveToDeduct;
  const hasCashGap = rawSafeBalance < 0;
  const cashGapAmount = hasCashGap ? Math.abs(rawSafeBalance) : 0;
  const safeBalance = Math.max(0, rawSafeBalance);
  const safeDays = Math.max(1, Number(daysLeft) || 1);
  const dailyAvailable = isPastMonth ? safeBalance : Math.max(0, Math.round(safeBalance / safeDays));

  return {
    reserveToDeduct,
    rawSafeBalance,
    hasCashGap,
    cashGapAmount,
    safeBalance,
    dailyAvailable,
  };
};

// Безопасное слияние (Merge) транзакций с фильтрацией дубликатов по ID и сигнатуре (v0.7.0)
export const mergeTransactions = (existingTxs = [], incomingTxs = []) => {
  const existingIds = new Set(existingTxs.map((t) => String(t.id)));
  const existingSignatures = new Set(
    existingTxs.map(
      (t) =>
        `${t.date}|${t.type}|${Math.round(Number(t.amount) || 0)}|${(t.title || '').trim().toLowerCase()}|${t.account || 'family'}`
    )
  );

  const uniqueNew = [];
  let skippedCount = 0;

  for (const tx of incomingTxs) {
    const sig = `${tx.date}|${tx.type}|${Math.round(Number(tx.amount) || 0)}|${(tx.title || '').trim().toLowerCase()}|${tx.account || 'family'}`;
    if (existingIds.has(String(tx.id)) || existingSignatures.has(sig)) {
      skippedCount++;
      continue;
    }
    existingIds.add(String(tx.id));
    existingSignatures.add(sig);
    uniqueNew.push(tx);
  }

  return {
    merged: [...uniqueNew, ...existingTxs],
    addedCount: uniqueNew.length,
    skippedCount,
  };
};

// Расчет остатка и срока закрытия долга/кредита
export const calculateDebtPayoff = (debt) => {
  const total = Math.max(0, Number(debt?.totalAmount) || 0);
  const paid = Math.max(0, Number(debt?.paidAmount) || 0);
  const remaining = Math.max(0, total - paid);
  const monthly = Math.max(0, Number(debt?.monthlyPayment) || 0);
  const progressPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 100;
  const monthsLeft = remaining === 0 ? 0 : monthly > 0 ? Math.ceil(remaining / monthly) : null;
  return { remaining, progressPct, monthsLeft };
};

// Расчет прогноза переменных трат на основе предыдущих месяцев
export const calculateHistoricalForecast = (transactions = [], recurringPayments = [], targetYm = getCurrentMonthPrefix()) => {
  const recCategorySet = new Set(
    recurringPayments.filter((r) => r.isMandatory).map((r) => (r.categoryId || r.category || '').toLowerCase())
  );

  const pastMonthsSet = new Set();
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const ym = (tx.date || '').slice(0, 7);
    if (ym && ym < targetYm) pastMonthsSet.add(ym);
  }
  const pastMonthsCount = Math.max(1, pastMonthsSet.size);

  const byCat = {};
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const cat = tx.categoryId || tx.category || 'Прочее';
    if (recCategorySet.has(cat.toLowerCase())) continue;
    if (!byCat[cat]) byCat[cat] = { pastTotal: 0, currentSpent: 0 };
    const ym = (tx.date || '').slice(0, 7);
    if (ym === targetYm) {
      byCat[cat].currentSpent += Number(tx.amount) || 0;
    } else if (ym < targetYm) {
      byCat[cat].pastTotal += Number(tx.amount) || 0;
    }
  }

  const categories = Object.entries(byCat).map(([categoryId, stats]) => {
    const avgMonthly = Math.round(stats.pastTotal / pastMonthsCount);
    const currentSpent = Math.round(stats.currentSpent);
    const predictedRemaining = Math.max(0, avgMonthly - currentSpent);
    return {
      categoryId,
      avgMonthly,
      currentSpent,
      predictedRemaining,
    };
  });

  const totalPredictedRemaining = categories.reduce((acc, c) => acc + c.predictedRemaining, 0);
  return { categories, totalPredictedRemaining, pastMonthsCount };
};

// Определение статуса напоминалки для регулярного платежа
export const getRecurringReminderStatus = (rec, targetYm) => {
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
