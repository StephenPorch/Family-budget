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
  const total = Math.max(0, Number(debt?.initialAmount ?? debt?.totalAmount) || 0);
  const rawRemaining = debt?.remainingAmount !== undefined ? Number(debt.remainingAmount) : (total - (Number(debt?.paidAmount) || 0));
  const remaining = Math.max(0, Math.min(total, Number.isFinite(rawRemaining) ? rawRemaining : total));
  const paid = Math.max(0, total - remaining);
  const isRegular = debt?.isRegular !== false;
  const monthly = isRegular ? Math.max(0, Number(debt?.monthlyPayment) || 0) : 0;
  const progressPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 100;
  const monthsLeft = remaining === 0 ? 0 : (isRegular && monthly > 0) ? Math.ceil(remaining / monthly) : null;
  return { total, paid, remaining, progressPct, monthsLeft, isRegular, monthly };
};

// Сравнительный баланс и эффективность двух партнеров за месяц
export const calculatePartnerComparison = (transactions = [], userProfiles = {}, targetYm = getCurrentMonthPrefix()) => {
  const p1 = userProfiles.husband || { name: 'Партнер 1', emoji: '🧔🏻‍♂️' };
  const p2 = userProfiles.wife || { name: 'Партнер 2', emoji: '👩🏼' };

  let p1Income = 0;
  let p1PersonalExpense = 0;
  let p1SharedContribution = 0;

  let p2Income = 0;
  let p2PersonalExpense = 0;
  let p2SharedContribution = 0;

  let sharedPoolExpense = 0;
  let sharedPoolIncome = 0;

  for (const tx of transactions) {
    const ym = (tx.date || '').slice(0, 7);
    if (targetYm && targetYm !== 'all' && ym !== targetYm) continue;

    const amt = Math.round(Number(tx.amount) || 0);
    const author = tx.author || 'husband';
    const acc = tx.account || 'shared';

    if (tx.type === 'income') {
      if (acc === 'personal') {
        if (author === 'wife') p2Income += amt;
        else p1Income += amt;
      } else {
        sharedPoolIncome += amt;
        if (author === 'wife') p2Income += amt;
        else p1Income += amt;
      }
    } else if (tx.type === 'expense') {
      if (acc === 'personal') {
        if (author === 'wife') p2PersonalExpense += amt;
        else p1PersonalExpense += amt;
      } else {
        sharedPoolExpense += amt;
        if (author === 'wife') p2SharedContribution += amt;
        else p1SharedContribution += amt;
      }
    }
  }

  const p1TotalOut = p1PersonalExpense + p1SharedContribution;
  const p2TotalOut = p2PersonalExpense + p2SharedContribution;

  const p1Net = p1Income - p1TotalOut;
  const p2Net = p2Income - p2TotalOut;

  const p1SavingsRate = p1Income > 0 ? Math.max(0, Math.round((p1Net / p1Income) * 100)) : 0;
  const p2SavingsRate = p2Income > 0 ? Math.max(0, Math.round((p2Net / p2Income) * 100)) : 0;

  return {
    targetYm,
    partner1: {
      id: 'husband',
      name: p1.name || 'Партнер 1',
      emoji: p1.emoji || '🧔🏻‍♂️',
      income: p1Income,
      personalExpense: p1PersonalExpense,
      sharedContribution: p1SharedContribution,
      totalOut: p1TotalOut,
      net: p1Net,
      savingsRate: p1SavingsRate,
    },
    partner2: {
      id: 'wife',
      name: p2.name || 'Партнер 2',
      emoji: p2.emoji || '👩🏼',
      income: p2Income,
      personalExpense: p2PersonalExpense,
      sharedContribution: p2SharedContribution,
      totalOut: p2TotalOut,
      net: p2Net,
      savingsRate: p2SavingsRate,
    },
    sharedPool: {
      totalIncome: sharedPoolIncome,
      totalExpense: sharedPoolExpense,
    },
  };
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
