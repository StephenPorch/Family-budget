import {
  getLocalDateString,
  getCurrentMonthPrefix,
  normalizeImportedDate,
  parseImportedAmount,
  formatMonthTitle,
} from './dateUtils.js';
import { APP_VERSION } from './storage.js';
import { buildXlsxBytes } from './xlsx.js';
import { toCsvLine, parseCsvText } from './csv.js';
import {
  getRecurringReminderStatus,
  getWalletKeyFromTx,
  calculateDebtPayoff,
  mergeTransactions,
} from './financeCore.js';

const getProfileDisplayName = (safeProfiles, key) => {
  if (key === 'wife') return safeProfiles?.wife?.name || 'Партнер 2';
  return safeProfiles?.husband?.name || 'Партнер 1';
};

const getWalletDisplayLabel = (safeProfiles, wKey) => {
  if (wKey === 'husband') return getProfileDisplayName(safeProfiles, 'husband');
  if (wKey === 'wife') return getProfileDisplayName(safeProfiles, 'wife');
  return 'Общий котел';
};

const mergeUniqueByIdOrKey = (existingList, incomingList, getKey) => {
  const map = new Map();
  const keySet = new Set();
  existingList.forEach(item => {
    map.set(item.id, item);
    if (getKey) keySet.add(getKey(item));
  });
  incomingList.forEach(item => {
    const k = getKey ? getKey(item) : null;
    if (!map.has(item.id) && (!k || !keySet.has(k))) {
      map.set(item.id, item);
      if (k) keySet.add(k);
    }
  });
  return Array.from(map.values());
};

export const buildBudgetXlsxSheets = ({
  selectedMonth,
  stats,
  pendingBillsCount,
  transactions,
  expenseForecastData,
  recurringPayments,
  goals,
  debts,
  safeProfiles,
}) => {
  const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
  const p1Name = getProfileDisplayName(safeProfiles, 'husband');
  const p2Name = getProfileDisplayName(safeProfiles, 'wife');

  const summaryRows = [
    ['Показатель', 'Значение (₽ / %)', 'Период / Комментарий'],
    ['Версия приложения', `v${APP_VERSION}`, `Дата выгрузки: ${getLocalDateString()}`],
    ['Выбранный период', formatMonthTitle(selectedMonth), targetYm],
    ['Кумулятивный баланс: Общий котел', stats.shared.balance, `Доходы мес: +${stats.shared.monthIncome} / Расходы мес: -${stats.shared.monthExpense}`],
    [`Кумулятивный баланс: Личный (${p1Name})`, stats.husbandPersonal.balance, `Доходы мес: +${stats.husbandPersonal.monthIncome} / Расходы мес: -${stats.husbandPersonal.monthExpense}`],
    [`Кумулятивный баланс: Личный (${p2Name})`, stats.wifePersonal.balance, `Доходы мес: +${stats.wifePersonal.monthIncome} / Расходы мес: -${stats.wifePersonal.monthExpense}`],
    ['Потребительские расходы (Общий котел)', stats.shared.consumerExpense, 'Без учета копилок и кредитов'],
    ['Отложено в копилки и погашено долгов', stats.shared.savedAndDebtPaid, 'Из общего котла за выбранный период'],
    ['Резерв на неоплаченные обязательные счета', stats.unpaidMandatoryThisMonth, `Ожидает оплаты счетов: ${pendingBillsCount}`],
    ['Безопасный дневной лимит (активный счет)', stats.dailyAvailable, stats.hasCashGap ? `Кассовый разрыв: -${stats.cashGapAmount} ₽` : `На ${stats.daysLeft} дн.`],
    ['Всего накоплено в копилках', stats.totalSavings, `Цель: ${stats.totalTargetSavings}`],
    ['Общий остаток по кредитам и долгам', stats.totalDebtRemaining, `Начальная сумма: ${stats.totalDebtInitial}`],
  ];

  const txRows = [
    ['ID', 'Дата', 'Месяц', 'Тип', 'Категория', 'Название_Комментарий', 'Сумма_₽', 'Счет', 'Автор', 'Маршрут_Перевода', 'ID_Копилки', 'ID_Долга', 'ID_Регулярного'],
    ...[...transactions]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(t => {
        const isOpening = Boolean(t.isOpeningBalance);
        const isTransfer = t.type === 'transfer';
        const fromW = isTransfer ? getWalletKeyFromTx(t) : null;
        const toW = isTransfer
          ? ((t.transferTo === 'shared' || t.transferTo === 'husband' || t.transferTo === 'wife')
              ? t.transferTo
              : (fromW === 'shared' ? 'husband' : 'shared'))
          : null;
        const routeLabel = isTransfer
          ? `${getWalletDisplayLabel(safeProfiles, fromW)} → ${getWalletDisplayLabel(safeProfiles, toW)}`
          : '';
        const typeLabel = isOpening
          ? 'Начальный остаток'
          : isTransfer
          ? 'Перевод'
          : (t.type === 'income' ? 'Доход' : 'Расход');
        const accountLabel = isTransfer
          ? 'Между счетами'
          : ((t.account || 'shared') === 'shared' ? 'Общий котел' : 'Личный');

        return [
          t.id || '',
          t.date || '',
          (t.date || '').slice(0, 7),
          typeLabel,
          t.category || '',
          t.title || '',
          isOpening && t.type === 'expense' ? -(Number(t.amount) || 0) : (Number(t.amount) || 0),
          accountLabel,
          t.author === 'wife' ? p2Name : p1Name,
          routeLabel,
          t.goalId || '',
          t.debtId || '',
          t.recurringId || '',
        ];
      }),
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
    ]),
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
        r.author === 'wife' ? p2Name : p1Name,
        r.isMandatory !== false ? 'Да' : 'Нет',
        st.label,
        (r.paidMonths || []).join(', '),
      ];
    }),
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
      const payoff = calculateDebtPayoff(d);
      return [
        'Кредит/Долг',
        d.id,
        d.title,
        payoff.remaining,
        payoff.total,
        payoff.monthly,
        d.isRegular === false ? '' : (Number(d.paymentDay) || 12),
        payoff.progressPct,
        (d.paidMonths || []).join(', '),
      ];
    }),
  ];

  return [
    { name: '1_Сводка', rows: summaryRows },
    { name: '2_Операции', rows: txRows },
    { name: '3_План_и_Прогноз', rows: planRows },
    { name: '4_Постоянные_счета', rows: recRows },
    { name: '5_Копилки_и_Долги', rows: goalsDebtsRows },
  ];
};

export const buildBudgetXlsxBytes = (params) => {
  return buildXlsxBytes(buildBudgetXlsxSheets(params));
};

export const buildStructuredCsvString = ({
  selectedMonth,
  activeWalletCard,
  stats,
  expenseForecastData,
  recurringPayments,
  debts,
  goals,
  customCategories,
  transactions,
}) => {
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
  lines.push(toCsvLine(['SUMMARY', 'sum_husband', getLocalDateString(), 'balance', 'Личный счет партнера 1', 'Переходящий остаток партнера 1', stats.husbandPersonal.balance, stats.husbandPersonal.monthIncome, stats.husbandPersonal.monthExpense, 'personal', 'husband', '']));
  lines.push(toCsvLine(['SUMMARY', 'sum_wife', getLocalDateString(), 'balance', 'Личный счет партнера 2', 'Переходящий остаток партнера 2', stats.wifePersonal.balance, stats.wifePersonal.monthIncome, stats.wifePersonal.monthExpense, 'personal', 'wife', '']));

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
      `${d.icon || '💳'};${d.color || 'from-rose-500 to-red-500'};${(d.paidMonths || []).join('|')};${d.isRegular === false ? 'flexible' : 'regular'}`,
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
        t.transferTo ? `to:${t.transferTo}` : '',
        t.fromWallet ? `from:${t.fromWallet}` : '',
        t.isOpeningBalance ? 'opening:1' : '',
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

export const buildJsonBackupPayload = ({
  transactions,
  goals,
  recurringPayments,
  debts,
  customCategories,
  plannedCategoryLimits,
  userProfiles,
  deviceOwner,
  safeLimitConfig,
}) => ({
  version: APP_VERSION,
  exportedAt: new Date().toISOString(),
  transactions,
  goals,
  recurringPayments,
  debts,
  customCategories,
  plannedCategoryLimits,
  userProfiles,
  deviceOwner,
  safeLimitConfig,
});

export const buildAiPromptReport = ({
  selectedMonth,
  stats,
  expenseForecastData,
  recurringPayments,
  debts,
  goals,
  periodTransactions,
  safeProfiles,
}) => {
  const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
  const p1Name = getProfileDisplayName(safeProfiles, 'husband');
  const p2Name = getProfileDisplayName(safeProfiles, 'wife');

  const lines = [
    `Проведи финансовый аудит нашего семейного бюджета за период ${formatMonthTitle(selectedMonth)} (${targetYm}).`,
    `Укажи узкие места, оцени соблюдение правила 50/30/20, проверь нагрузку постоянных платежей и предложи конкретные шаги по оптимизации трат на следующий месяц.`,
    ``,
    `=== 1. БАЛАНСЫ И ПОТОКИ ===`,
    `- Общий котел (кумулятивный остаток): ${stats.shared.balance.toLocaleString('ru-RU')} ₽ (за месяц Доходы: +${stats.shared.monthIncome.toLocaleString('ru-RU')} ₽, Расходы: -${stats.shared.monthExpense.toLocaleString('ru-RU')} ₽, из них потребительские: ${stats.shared.consumerExpense.toLocaleString('ru-RU')} ₽, отложено/кредиты: ${stats.shared.savedAndDebtPaid.toLocaleString('ru-RU')} ₽)`,
    `- Личный счет (${p1Name}): ${stats.husbandPersonal.balance.toLocaleString('ru-RU')} ₽ (+${stats.husbandPersonal.monthIncome.toLocaleString('ru-RU')} / -${stats.husbandPersonal.monthExpense.toLocaleString('ru-RU')} ₽)`,
    `- Личный счет (${p2Name}): ${stats.wifePersonal.balance.toLocaleString('ru-RU')} ₽ (+${stats.wifePersonal.monthIncome.toLocaleString('ru-RU')} / -${stats.wifePersonal.monthExpense.toLocaleString('ru-RU')} ₽)`,
    `- Резерв на неоплаченные обязательные счета месяца: ${stats.unpaidMandatoryThisMonth.toLocaleString('ru-RU')} ₽`,
    `- Безопасный дневной лимит: ${stats.hasCashGap ? `Кассовый разрыв -${stats.cashGapAmount.toLocaleString('ru-RU')} ₽` : `${stats.dailyAvailable.toLocaleString('ru-RU')} ₽/день (осталось дней: ${stats.daysLeft})`}`,
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
    ...periodTransactions.map(t => {
      const accStr = t.type === 'transfer'
        ? `${t.fromWallet || getWalletKeyFromTx(t)}->${t.transferTo || 'shared'}`
        : (t.account || 'shared');
      const authStr = t.author === 'wife' ? p2Name : p1Name;
      const typeStr = t.isOpeningBalance ? `opening(${t.type})` : t.type;
      return `${t.date};${typeStr};${t.category};${t.title};${t.amount};${accStr};${authStr}`;
    }),
  ];
  return lines.join('\n');
};

export const parseImportedBackupContent = ({
  content,
  fileName = '',
  isMerge = true,
  currentState = {},
}) => {
  const existingTxs = Array.isArray(currentState.transactions) ? currentState.transactions : [];
  const existingGoals = Array.isArray(currentState.goals) ? currentState.goals : [];
  const existingRecs = Array.isArray(currentState.recurringPayments) ? currentState.recurringPayments : [];
  const existingDebts = Array.isArray(currentState.debts) ? currentState.debts : [];
  const existingCats = Array.isArray(currentState.customCategories) ? currentState.customCategories : [];
  const existingLimits = currentState.plannedCategoryLimits || {};
  const existingProfiles = currentState.userProfiles || {};

  const trimmed = String(content || '');
  if (fileName.toLowerCase().endsWith('.json') || trimmed.trim().startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    const nextState = {};

    if (Array.isArray(parsed.transactions)) {
      const normTxs = parsed.transactions.map(t => ({ ...t, date: normalizeImportedDate(t.date) }));
      nextState.transactions = isMerge ? mergeTransactions(existingTxs, normTxs).merged : normTxs;
    }
    if (Array.isArray(parsed.goals)) {
      nextState.goals = isMerge ? mergeUniqueByIdOrKey(existingGoals, parsed.goals, g => g.title) : parsed.goals;
    }
    if (Array.isArray(parsed.recurringPayments)) {
      nextState.recurringPayments = isMerge ? mergeUniqueByIdOrKey(existingRecs, parsed.recurringPayments, r => r.title) : parsed.recurringPayments;
    }
    if (Array.isArray(parsed.debts)) {
      nextState.debts = isMerge ? mergeUniqueByIdOrKey(existingDebts, parsed.debts, d => d.title) : parsed.debts;
    }
    if (Array.isArray(parsed.customCategories)) {
      nextState.customCategories = isMerge ? mergeUniqueByIdOrKey(existingCats, parsed.customCategories, c => c.name) : parsed.customCategories;
    }
    if (parsed.plannedCategoryLimits && typeof parsed.plannedCategoryLimits === 'object') {
      nextState.plannedCategoryLimits = isMerge ? { ...existingLimits, ...parsed.plannedCategoryLimits } : parsed.plannedCategoryLimits;
    }
    if (parsed.userProfiles && typeof parsed.userProfiles === 'object') {
      nextState.userProfiles = isMerge ? { ...existingProfiles, ...parsed.userProfiles } : parsed.userProfiles;
    }
    if (parsed.deviceOwner && (parsed.deviceOwner === 'husband' || parsed.deviceOwner === 'wife')) {
      nextState.deviceOwner = parsed.deviceOwner;
    }
    if (parsed.safeLimitConfig && typeof parsed.safeLimitConfig === 'object') {
      nextState.safeLimitConfig = parsed.safeLimitConfig;
    }

    return {
      ok: true,
      nextState,
      message: isMerge
        ? `База дополнена из JSON (${(parsed.transactions || []).length} записей проверено)`
        : `Бэкап из JSON полностью восстановлен`,
    };
  }

  const rows = parseCsvText(trimmed);
  if (rows.length < 2) {
    return {
      ok: false,
      message: 'Файл пуст или не содержит строк данных',
    };
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
        const toLink = extraParts.find(x => x.startsWith('to:'))?.slice(3);
        const fromLink = extraParts.find(x => x.startsWith('from:'))?.slice(5);
        const isOpening = extraParts.includes('opening:1');
        const parsedType = (dirOrStatus === 'transfer' || dirOrStatus === 'Перевод')
          ? 'transfer'
          : (dirOrStatus === 'income' || dirOrStatus === 'Доход' ? 'income' : 'expense');
        nextTxs.push({
          id: id || `imp_tx_${Date.now()}_${idx}`,
          date: normalizeImportedDate(dateOrDay),
          type: parsedType,
          category: category || 'Продукты',
          title: title || category || 'Операция',
          amount: parseImportedAmount(amountCur),
          account: account === 'personal' || account === 'Личный' ? 'personal' : 'shared',
          author: author === 'wife' || author === 'Жена' ? 'wife' : 'husband',
          ...(goalLink ? { goalId: goalLink } : {}),
          ...(debtLink ? { debtId: debtLink } : {}),
          ...(recLink ? { recurringId: recLink } : {}),
          ...(toLink ? { transferTo: toLink } : {}),
          ...(fromLink ? { fromWallet: fromLink } : {}),
          ...(isOpening ? { isOpeningBalance: true } : {}),
        });
      } else if (recType === 'RECURRING') {
        nextRecs.push({
          id: id || `imp_rec_${idx}`,
          title: title || category || 'Платеж',
          amount: parseImportedAmount(amountCur),
          dueDate: Number(dateOrDay) || 15,
          category: category || 'Дом и ЖКУ',
          account: account === 'personal' ? 'personal' : 'shared',
          author: author === 'wife' ? 'wife' : 'husband',
          isMandatory: dirOrStatus !== 'optional',
          paidMonths: (extra || '').split('|').filter(Boolean),
        });
      } else if (recType === 'DEBT') {
        const [icon, color, paidStr, regFlag] = (extra || '').split(';');
        const isReg = regFlag !== 'flexible';
        nextDebts.push({
          id: id || `imp_debt_${idx}`,
          title: title || 'Кредит',
          remainingAmount: parseImportedAmount(amountCur),
          initialAmount: parseImportedAmount(targetInit) || parseImportedAmount(amountCur) || 100000,
          monthlyPayment: isReg ? (parseImportedAmount(payPlan) || 10000) : 0,
          paymentDay: Number(dateOrDay) || 12,
          account: account === 'personal' ? 'personal' : 'shared',
          author: author === 'wife' ? 'wife' : 'husband',
          isRegular: isReg,
          icon: icon || '💳',
          color: color || 'from-rose-500 to-red-500',
          paidMonths: (paidStr || '').split('|').filter(Boolean),
        });
      } else if (recType === 'GOAL') {
        const [icon, color] = (extra || '').split(';');
        nextGoals.push({
          id: id || `imp_goal_${idx}`,
          title: title || 'Цель',
          current: parseImportedAmount(amountCur),
          target: parseImportedAmount(targetInit) || 100000,
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

    const nextState = {};
    if (nextTxs.length > 0) {
      nextState.transactions = isMerge ? mergeTransactions(existingTxs, nextTxs).merged : nextTxs;
    }
    if (nextRecs.length > 0) {
      nextState.recurringPayments = isMerge ? mergeUniqueByIdOrKey(existingRecs, nextRecs, r => r.title) : nextRecs;
    }
    if (nextDebts.length > 0) {
      nextState.debts = isMerge ? mergeUniqueByIdOrKey(existingDebts, nextDebts, d => d.title) : nextDebts;
    }
    if (nextGoals.length > 0) {
      nextState.goals = isMerge ? mergeUniqueByIdOrKey(existingGoals, nextGoals, g => g.title) : nextGoals;
    }
    if (nextCats.length > 0) {
      nextState.customCategories = isMerge ? mergeUniqueByIdOrKey(existingCats, nextCats, c => c.name) : nextCats;
    }
    if (Object.keys(nextLimits).length > 0) {
      nextState.plannedCategoryLimits = isMerge ? { ...existingLimits, ...nextLimits } : nextLimits;
    }

    return {
      ok: true,
      nextState,
      message: isMerge
        ? `Данные из CSV объединены с базой (+${nextTxs.length} операций)`
        : `Полный бэкап из CSV восстановлен (${nextTxs.length} операций)`,
    };
  }

  // Импорт банковской выписки или произвольного CSV с автонормализацией дат DD.MM.YYYY
  const importedTxs = rows.slice(1).map((r, idx) => {
    const hasIdCol = r.length >= 7;
    const rawDate = hasIdCol ? r[1] : r[0];
    const rawType = hasIdCol ? r[3] : r[1];
    const rawCat = hasIdCol ? r[4] : r[2];
    const rawTitle = hasIdCol ? r[5] : r[3];
    const rawAmount = hasIdCol ? (r[6] || r[2]) : (r[4] || r[2]);
    const rawAcc = hasIdCol ? r[7] : r[5];
    const rawAuth = hasIdCol ? r[8] : r[6];

    const isInc = String(rawType || '').toLowerCase().includes('доход') ||
                  String(rawType || '').toLowerCase() === 'income' ||
                  String(rawAmount || '').trim().startsWith('+');

    return {
      id: (hasIdCol && r[0]) ? r[0] : `csv_tx_${Date.now()}_${idx}`,
      date: normalizeImportedDate(rawDate),
      type: isInc ? 'income' : 'expense',
      category: rawCat || 'Продукты',
      title: rawTitle || rawCat || 'Операция из CSV',
      amount: parseImportedAmount(rawAmount),
      account: String(rawAcc || '').toLowerCase().includes('личн') || rawAcc === 'personal' ? 'personal' : 'shared',
      author: String(rawAuth || '').toLowerCase().includes('жен') || rawAuth === 'wife' ? 'wife' : 'husband',
    };
  }).filter(t => t.amount > 0);

  if (importedTxs.length > 0) {
    const mergeRes = isMerge ? mergeTransactions(existingTxs, importedTxs) : null;
    return {
      ok: true,
      nextState: {
        transactions: isMerge ? mergeRes.merged : importedTxs,
      },
      message: isMerge
        ? `Добавлено ${mergeRes.addedCount} операций из CSV (дублей пропущено: ${mergeRes.skippedCount})`
        : `База заменена: загружено ${importedTxs.length} операций из CSV`,
    };
  }

  return {
    ok: false,
    message: 'Не найдено корректных строк с суммами для импорта',
  };
};
