import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Wallet, Plus, Calendar, User, X,
  Sparkles, ChevronRight, ChevronLeft, Search, Trash2,
  SlidersHorizontal, RotateCcw, Edit3, Check, LayoutGrid,
  ListOrdered, Target, ArrowUpRight, ShieldCheck,
  CheckCircle2, FileSpreadsheet, Bell, TrendingUp, AlertCircle, ArrowRightLeft
} from 'lucide-react';

import {
  getLocalDateString,
  getCurrentMonthPrefix,
  getTargetDateForMonth,
  normalizeImportedDate,
  parseImportedAmount,
  MONTH_NAMES_NOMINATIVE,
  MONTH_NAMES_SHORT,
  formatMonthTitle,
  formatDateGroupHeader,
} from './utils/dateUtils.js';

import {
  loadFromStorage,
  saveToStorage,
  INITIAL_TRANSACTIONS,
  INITIAL_GOALS,
  INITIAL_RECURRING,
  INITIAL_DEBTS,
  INITIAL_USER_PROFILES,
  DEFAULT_EXPENSE_CATEGORIES,
  GOAL_COLOR_PRESETS,
  DEFAULT_SAFE_LIMIT_CONFIG,
} from './utils/storage.js';

import { buildXlsxBytes } from './utils/xlsx.js';
import { toCsvLine, parseCsvText } from './utils/csv.js';
import {
  getCategoryMeta,
  isSavingsOrDebtTx,
  isTransactionTypeLocked,
  getRecurringReminderStatus,
  calculatePartnerComparison,
  calculateHorizonDays,
  getWalletKeyFromTx,
} from './utils/financeCore.js';

import { ChartsSection } from './components/analytics/ChartsSection.jsx';
import { ReceiptCalendar } from './components/calendar/ReceiptCalendar.jsx';
import { TransactionModal } from './components/modals/TransactionModal.jsx';
import { ExportBackupModal } from './components/modals/ExportBackupModal.jsx';
import {
  GoalActionModal,
  GoalFormModal,
  RecurringFormModal,
  PayRecurringModal,
  DebtFormModal,
  PayDebtModal,
  ProfileEditModal,
  SafeLimitConfigModal,
} from './components/modals/EntityModals.jsx';

export default function FamilyBudgetApp() {
  // Профили пользователей и владелец устройства (Personal-First)
  const [userProfiles, setUserProfiles] = useState(() => {
    const loaded = loadFromStorage('family_budget_profiles', INITIAL_USER_PROFILES);
    if (loaded && typeof loaded === 'object' && loaded.husband && loaded.wife) {
      return loaded;
    }
    return INITIAL_USER_PROFILES;
  });
  const [deviceOwner, setDeviceOwner] = useState(() => {
    const loaded = loadFromStorage('family_budget_device_owner', 'husband');
    return (loaded === 'wife' || loaded === 'husband') ? loaded : 'husband';
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const loaded = loadFromStorage('family_budget_device_owner', 'husband');
    return (loaded === 'wife' || loaded === 'husband') ? loaded : 'husband';
  });
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'history' | 'goals' | 'debts'
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthPrefix); // 'YYYY-MM' | 'all'

  // Фокус кошелька в дашборде: по умолчанию личный счет владельца устройства
  const [activeWalletCard, setActiveWalletCard] = useState(() => {
    const loaded = loadFromStorage('family_budget_device_owner', 'husband');
    return (loaded === 'wife' || loaded === 'husband') ? loaded : 'husband';
  });

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [safeLimitConfig, setSafeLimitConfig] = useState(() =>
    loadFromStorage('family_budget_limit_config', DEFAULT_SAFE_LIMIT_CONFIG)
  );

  // Гарантированно безопасные профили (защита от null/undefined)
  const safeProfiles = useMemo(() => {
    if (userProfiles && typeof userProfiles === 'object' && userProfiles.husband && userProfiles.wife) {
      return userProfiles;
    }
    return INITIAL_USER_PROFILES;
  }, [userProfiles]);

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
  const [plannedCategoryLimits, setPlannedCategoryLimits] = useState(() =>
    loadFromStorage('family_budget_planned_limits', {})
  );

  // Модальные окна
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [txPresetConfig, setTxPresetConfig] = useState(null);

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
  const [importMode, setImportMode] = useState('merge'); // 'merge' | 'replace'

  // Календарь чеков во вкладке «Операции»
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

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
  const [newDebtIsRegular, setNewDebtIsRegular] = useState(true);

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
  const [toast, setToast] = useState(null); // { message, onUndo, actionLabel }
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, onUndo = null, actionLabel = 'Вернуть') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, onUndo, actionLabel });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 6000);
  }, []);

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
    saveToStorage('family_budget_profiles', userProfiles);
  }, [userProfiles]);

  useEffect(() => {
    saveToStorage('family_budget_device_owner', deviceOwner);
  }, [deviceOwner]);

  useEffect(() => {
    saveToStorage('family_budget_limit_config', safeLimitConfig);
  }, [safeLimitConfig]);

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
        setIsProfileModalOpen(false);
        setIsLimitModalOpen(false);
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
      if (d.isRegular === false) return;
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
      .filter(d => d.isRegular !== false && (Number(d.remainingAmount) || 0) > 0 && !(d.paidMonths || []).includes(targetYm));

    const urgentRecs = unpaidRecList.filter(r => r.status.code === 'overdue' || r.status.code === 'today' || r.status.code === 'soon');

    return {
      pendingCount: unpaidRecList.filter(r => r.isMandatory).length + unpaidDebtList.length,
      unpaidRecList,
      unpaidDebtList,
      urgentRecs,
    };
  }, [recurringPayments, debts, selectedMonth]);

  const pendingBillsCount = reminderSummary.pendingCount;

  // Сравнительный баланс партнеров за выбранный месяц
  const partnerComparisonData = useMemo(() => {
    return calculatePartnerComparison(transactions, safeProfiles, selectedMonth);
  }, [transactions, safeProfiles, selectedMonth]);

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

  // ================= ФИНАНСОВОЕ МАТЕМАТИЧЕСКОЕ ЯДРО v0.7.0 =================
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
      if (t.type === 'transfer') {
        const fromW = getWalletKeyFromTx(t);
        const toW = (t.transferTo === 'shared' || t.transferTo === 'husband' || t.transferTo === 'wife')
          ? t.transferTo
          : (fromW === 'shared' ? 'husband' : 'shared');
        if (fromW !== toW) {
          if (fromW === 'shared') shared.expense += val;
          else if (fromW === 'wife') wifePersonal.expense += val;
          else husbandPersonal.expense += val;

          if (toW === 'shared') shared.income += val;
          else if (toW === 'wife') wifePersonal.income += val;
          else husbandPersonal.income += val;
        }
        return;
      }

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
      if (t.type === 'transfer') {
        const fromW = getWalletKeyFromTx(t);
        const toW = t.transferTo || 'shared';
        if (fromW !== toW) {
          if (toW === 'shared') {
            shared.monthIncome += val;
            if (fromW === 'husband') shared.husbandIncome += val;
            if (fromW === 'wife') shared.wifeIncome += val;
          }
          if (fromW === 'shared') {
            shared.monthExpense += val;
          }
        }
        return;
      }
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
    let daysHorizonLabel = 'до конца месяца';

    if (selectedMonth !== 'all') {
      const [y, m] = selectedMonth.split('-').map(Number);
      daysInMonth = new Date(y, m, 0).getDate();
      if (selectedMonth === currentYm) {
        const horizon = calculateHorizonDays(safeLimitConfig, today);
        daysLeft = horizon.days;
        daysHorizonLabel = horizon.label;
      } else if (isPastMonth) {
        daysLeft = 1;
        daysHorizonLabel = 'период завершен';
      } else {
        daysLeft = daysInMonth;
        daysHorizonLabel = `на ${daysInMonth} дн. месяца`;
      }
    } else {
      const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      daysInMonth = dim;
      const horizon = calculateHorizonDays(safeLimitConfig, today);
      daysLeft = horizon.days;
      daysHorizonLabel = horizon.label;
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

    // Честный расчет кассового разрыва / дефицита (исправлен дефект скрытия отрицательного баланса)
    const rawSafeBalance = activeBalance - reserveToDeduct;
    const hasCashGap = rawSafeBalance < 0;
    const cashGapAmount = hasCashGap ? Math.abs(rawSafeBalance) : 0;
    const safeBalance = Math.max(0, rawSafeBalance);
    const dailyAvailable = isPastMonth
      ? rawSafeBalance
      : hasCashGap
      ? 0
      : Math.max(0, Math.round(safeBalance / daysLeft));

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
      rawSafeBalance,
      hasCashGap,
      cashGapAmount,
      safeBalance,
      reserveToDeduct,
      activeSavedAndDebtPaid,
      daysLeft,
      daysInMonth,
      daysHorizonLabel,
      isPastMonth,
      topCategories,
      totalSelectedExpense,
      unpaidMandatoryThisMonth,
      prevMonthShortName,
    };
  }, [transactions, periodTransactions, previousMonthTransactions, goals, debts, selectedMonth, endOfSelectedMonth, activeWalletCard, customCategories, mandatoryReservesByWallet, unpaidMandatoryThisMonth, safeLimitConfig]);

  // Открытие модалки создания новой операции
  const openNewTransactionModal = useCallback((presetAccount = null, presetAuthor = null, presetDate = null, batchMode = false) => {
    setEditingTxId(null);
    let acc = 'shared';
    let auth = currentUser;
    if (presetAccount) {
      acc = presetAccount;
      auth = presetAuthor || currentUser;
    } else if (activeWalletCard === 'husband') {
      acc = 'personal';
      auth = 'husband';
    } else if (activeWalletCard === 'wife') {
      acc = 'personal';
      auth = 'wife';
    }
    const defaultDate = presetDate || selectedCalendarDate || getTargetDateForMonth(selectedMonth);
    setTxPresetConfig({ account: acc, author: auth, date: defaultDate, batchMode });
    setIsAddModalOpen(true);
  }, [currentUser, activeWalletCard, selectedCalendarDate, selectedMonth]);

  // Открытие модалки редактирования существующей операции
  const openEditTransactionModal = useCallback((tx) => {
    setEditingTxId(tx.id);
    setIsAddModalOpen(true);
  }, []);

  const editingTransactionObj = useMemo(() => {
    if (!editingTxId) return null;
    return transactions.find(t => t.id === editingTxId) || null;
  }, [editingTxId, transactions]);

  // Проверка блокировки типа/категории (включает goalId, debtId И recurringId — исправлен дефект аудита)
  const isEditingLockedType = useMemo(() => {
    return isTransactionTypeLocked(editingTransactionObj);
  }, [editingTransactionObj]);

  // Создание пользовательской категории
  const handleCreateCustomCategory = useCallback(({ name, icon, type, bucket }) => {
    setCustomCategories(prev => {
      if (prev.some(c => c.name.toLowerCase() === name.toLowerCase())) return prev;
      return [
        ...prev,
        {
          id: 'cat_' + Date.now(),
          name,
          icon,
          color: type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-700',
          type,
          bucket,
        },
      ];
    });
    showToast(`Категория «${name}» добавлена`);
  }, [showToast]);

  const handleDeleteCustomCategory = useCallback((e, catId) => {
    e?.stopPropagation();
    const cat = customCategories.find(c => c.id === catId);
    if (!cat) return;

    setCustomCategories(prev => prev.filter(c => c.id !== catId));
    showToast(`Категория «${cat.name}» удалена`, () => {
      setCustomCategories(prev => [...prev, cat]);
      setToast(null);
    });
  }, [customCategories, showToast]);

  // Сохранение (добавление или редактирование) транзакции без принудительного сброса выбранного месяца
  const handleSaveTransaction = useCallback((payload) => {
    const { id, amount: num, title: finalTitle, type: txType, category: selectedCategory, account: selectedAccount, author: txAuthor, fromWallet, transferTo, date: finalDate, stayOpen } = payload;

    if (id) {
      const oldTx = transactions.find(t => t.id === id);
      const locked = isTransactionTypeLocked(oldTx);
      setTransactions(prev =>
        prev.map(t =>
          t.id === id
            ? {
                ...t,
                title: finalTitle,
                amount: num,
                type: locked ? t.type : txType,
                category: locked ? t.category : selectedCategory,
                account: selectedAccount,
                author: txAuthor,
                ...(txType === 'transfer' ? { fromWallet: fromWallet || (selectedAccount === 'shared' ? 'shared' : txAuthor), transferTo: transferTo || 'shared' } : { fromWallet: undefined, transferTo: undefined }),
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
              t => t.id !== id && t.debtId === oldTx.debtId && (t.date || '').startsWith(oldYm)
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
              t => t.id !== id && t.recurringId === oldTx.recurringId && (t.date || '').startsWith(oldYm)
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
        ...(txType === 'transfer' ? { fromWallet: fromWallet || (selectedAccount === 'shared' ? 'shared' : txAuthor), transferTo: transferTo || 'shared' } : {}),
        date: finalDate,
      };
      setTransactions(prev => [newTx, ...prev]);

      const txMonth = finalDate.slice(0, 7);
      const isDifferentMonth = selectedMonth !== 'all' && txMonth !== selectedMonth;

      if (stayOpen) {
        showToast(`Чек за ${finalDate} записан (${num.toLocaleString('ru-RU')} ₽) — вводите следующий!`);
      } else {
        setEditingTxId(null);
        setIsAddModalOpen(false);
        if (isDifferentMonth) {
          showToast(
            `Чек за ${finalDate} (${num.toLocaleString('ru-RU')} ₽) добавлен в ${formatMonthTitle(txMonth)}`,
            () => {
              setSelectedMonth(txMonth);
              setToast(null);
            },
            `Открыть ${formatMonthTitle(txMonth)}`
          );
        } else {
          showToast(`Записано за ${finalDate}: ${finalTitle} (${num.toLocaleString('ru-RU')} ₽)`);
        }
      }
    }
  }, [transactions, selectedMonth, showToast]);

  // Удаление транзакции с мягким Undo-тостом и откатом копилки / долга
  const handleDeleteTransaction = useCallback((id, e) => {
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
  }, [transactions, editingTxId, showToast]);

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
    const defAmt = (Number(debt.monthlyPayment) > 0) ? debt.monthlyPayment : Math.min(5000, Number(debt.remainingAmount) || 0);
    setDebtPayAmount(String(defAmt || ''));
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
    setNewDebtPayment(String(debt.monthlyPayment || 0));
    setNewDebtDay(String(debt.paymentDay || 12));
    setNewDebtAccount(debt.account || 'shared');
    setNewDebtAuthor(debt.author || 'husband');
    setNewDebtIcon(debt.icon || '💳');
    setNewDebtColor(debt.color || GOAL_COLOR_PRESETS[4].value);
    setNewDebtIsRegular(debt.isRegular !== false);
    setIsNewDebtModalOpen(true);
  };

  const handleCreateDebt = (e) => {
    e?.preventDefault();
    const initNum = parseFloat(newDebtInitial);
    if (!newDebtTitle.trim() || !initNum || initNum <= 0) return;
    const rawRem = newDebtRemaining !== '' ? parseFloat(newDebtRemaining) : initNum;
    const remNum = Math.min(initNum, Math.max(0, Number.isFinite(rawRem) ? rawRem : initNum));
    const isReg = Boolean(newDebtIsRegular);
    const payNum = isReg ? (parseFloat(newDebtPayment) || Math.round(initNum / 12)) : 0;
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
                isRegular: isReg,
                account: newDebtAccount,
                author: newDebtAuthor,
                icon: newDebtIcon.trim() || '💳',
                color: newDebtColor,
              }
            : d
        )
      );
      showToast(`Обязательство «${newDebtTitle.trim()}» обновлено`);
    } else {
      const newDebt = {
        id: 'debt_' + Date.now(),
        title: newDebtTitle.trim(),
        initialAmount: initNum,
        remainingAmount: remNum,
        monthlyPayment: payNum,
        paymentDay: payDay,
        isRegular: isReg,
        account: newDebtAccount,
        author: newDebtAuthor,
        paidMonths: [],
        icon: newDebtIcon.trim() || '💳',
        color: newDebtColor,
      };
      setDebts(prev => [...prev, newDebt]);
      showToast(`Обязательство «${newDebt.title}» добавлено`);
    }

    setEditingDebtId(null);
    setNewDebtTitle('');
    setNewDebtInitial('');
    setNewDebtRemaining('');
    setNewDebtPayment('');
    setNewDebtIsRegular(true);
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
      ['Версия приложения', 'v0.8.0', `Дата выгрузки: ${getLocalDateString()}`],
      ['Выбранный период', formatMonthTitle(selectedMonth), targetYm],
      ['Кумулятивный баланс: Общий котел', stats.shared.balance, `Доходы мес: +${stats.shared.monthIncome} / Расходы мес: -${stats.shared.monthExpense}`],
      ['Кумулятивный баланс: Личный (Муж)', stats.husbandPersonal.balance, `Доходы мес: +${stats.husbandPersonal.monthIncome} / Расходы мес: -${stats.husbandPersonal.monthExpense}`],
      ['Кумулятивный баланс: Личный (Жена)', stats.wifePersonal.balance, `Доходы мес: +${stats.wifePersonal.monthIncome} / Расходы мес: -${stats.wifePersonal.monthExpense}`],
      ['Потребительские расходы (Общий котел)', stats.shared.consumerExpense, 'Без учета копилок и кредитов'],
      ['Отложено в копилки и погашено долгов', stats.shared.savedAndDebtPaid, 'Из общего котла за выбранный период'],
      ['Резерв на неоплаченные обязательные счета', stats.unpaidMandatoryThisMonth, `Ожидает оплаты счетов: ${pendingBillsCount}`],
      ['Безопасный дневной лимит (активный счет)', stats.dailyAvailable, stats.hasCashGap ? `Кассовый разрыв: -${stats.cashGapAmount} ₽` : `На ${stats.daysLeft} дн.`],
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
    a.download = `family-budget-v0.8.0-${getLocalDateString()}.xlsx`;
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
    a.download = `family-budget-v0.8.0-backup-${getLocalDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Выгружен универсальный CSV (открывается в Excel и подходит для полного восстановления бэкапа)');
  };

  const handleDownloadJson = () => {
    const payload = {
      version: '0.8.0',
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
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-budget-v0.8.0-backup-${getLocalDateString()}.json`;
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

  // Дедупликация и слияние массивов при режиме importMode === 'merge'
  const mergeUniqueByIdOrSignature = (existingList, incomingList, getSig) => {
    const map = new Map();
    const sigSet = new Set();
    existingList.forEach(item => {
      map.set(item.id, item);
      if (getSig) sigSet.add(getSig(item));
    });
    incomingList.forEach(item => {
      const sig = getSig ? getSig(item) : null;
      if (!map.has(item.id) && (!sig || !sigSet.has(sig))) {
        map.set(item.id, item);
        if (sig) sigSet.add(sig);
      }
    });
    return Array.from(map.values());
  };

  // Импорт бэкапа или банковской выписки (.csv / .json) с поддержкой Merge/Replace и дат DD.MM.YYYY
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

    const isMerge = importMode === 'merge';
    const txSig = (t) => `${t.date}|${t.type}|${t.amount}|${(t.title || '').toLowerCase()}|${t.account || 'shared'}`;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = String(evt.target?.result || '');
        if (file.name.toLowerCase().endsWith('.json') || content.trim().startsWith('{')) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed.transactions)) {
            const normTxs = parsed.transactions.map(t => ({ ...t, date: normalizeImportedDate(t.date) }));
            setTransactions(prev => isMerge ? mergeUniqueByIdOrSignature(prev, normTxs, txSig) : normTxs);
          }
          if (Array.isArray(parsed.goals)) {
            setGoals(prev => isMerge ? mergeUniqueByIdOrSignature(prev, parsed.goals, g => g.title) : parsed.goals);
          }
          if (Array.isArray(parsed.recurringPayments)) {
            setRecurringPayments(prev => isMerge ? mergeUniqueByIdOrSignature(prev, parsed.recurringPayments, r => r.title) : parsed.recurringPayments);
          }
          if (Array.isArray(parsed.debts)) {
            setDebts(prev => isMerge ? mergeUniqueByIdOrSignature(prev, parsed.debts, d => d.title) : parsed.debts);
          }
          if (Array.isArray(parsed.customCategories)) {
            setCustomCategories(prev => isMerge ? mergeUniqueByIdOrSignature(prev, parsed.customCategories, c => c.name) : parsed.customCategories);
          }
          if (parsed.plannedCategoryLimits && typeof parsed.plannedCategoryLimits === 'object') {
            setPlannedCategoryLimits(prev => isMerge ? { ...prev, ...parsed.plannedCategoryLimits } : parsed.plannedCategoryLimits);
          }
          if (parsed.userProfiles && typeof parsed.userProfiles === 'object') {
            setUserProfiles(prev => isMerge ? { ...prev, ...parsed.userProfiles } : parsed.userProfiles);
          }
          if (parsed.deviceOwner && (parsed.deviceOwner === 'husband' || parsed.deviceOwner === 'wife')) {
            setDeviceOwner(parsed.deviceOwner);
          }
          if (parsed.safeLimitConfig && typeof parsed.safeLimitConfig === 'object') {
            setSafeLimitConfig(parsed.safeLimitConfig);
          }
          setIsExportModalOpen(false);
          showToast(
            isMerge
              ? `База дополнена из JSON (${(parsed.transactions || []).length} записей проверено)`
              : `Бэкап из JSON полностью восстановлен`,
            () => {
              setTransactions(prevSnapshot.transactions);
              setGoals(prevSnapshot.goals);
              setRecurringPayments(prevSnapshot.recurringPayments);
              setDebts(prevSnapshot.debts);
              setCustomCategories(prevSnapshot.customCategories);
              setPlannedCategoryLimits(prevSnapshot.plannedCategoryLimits);
              setToast(null);
            }
          );
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
              const toLink = extraParts.find(x => x.startsWith('to:'))?.slice(3);
              const fromLink = extraParts.find(x => x.startsWith('from:'))?.slice(5);
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

          if (nextTxs.length > 0) {
            setTransactions(prev => isMerge ? mergeUniqueByIdOrSignature(prev, nextTxs, txSig) : nextTxs);
          }
          if (nextRecs.length > 0) {
            setRecurringPayments(prev => isMerge ? mergeUniqueByIdOrSignature(prev, nextRecs, r => r.title) : nextRecs);
          }
          if (nextDebts.length > 0) {
            setDebts(prev => isMerge ? mergeUniqueByIdOrSignature(prev, nextDebts, d => d.title) : nextDebts);
          }
          if (nextGoals.length > 0) {
            setGoals(prev => isMerge ? mergeUniqueByIdOrSignature(prev, nextGoals, g => g.title) : nextGoals);
          }
          if (nextCats.length > 0) {
            setCustomCategories(prev => isMerge ? mergeUniqueByIdOrSignature(prev, nextCats, c => c.name) : nextCats);
          }
          if (Object.keys(nextLimits).length > 0) {
            setPlannedCategoryLimits(prev => isMerge ? { ...prev, ...nextLimits } : nextLimits);
          }

          setIsExportModalOpen(false);
          showToast(
            isMerge
              ? `Данные из CSV объединены с базой (+${nextTxs.length} операций)`
              : `Полный бэкап из CSV восстановлен (${nextTxs.length} операций)`,
            () => {
              setTransactions(prevSnapshot.transactions);
              setGoals(prevSnapshot.goals);
              setRecurringPayments(prevSnapshot.recurringPayments);
              setDebts(prevSnapshot.debts);
              setCustomCategories(prevSnapshot.customCategories);
              setPlannedCategoryLimits(prevSnapshot.plannedCategoryLimits);
              setToast(null);
            }
          );
        } else {
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
            setTransactions(prev => isMerge ? mergeUniqueByIdOrSignature(prev, importedTxs, txSig) : importedTxs);
            setIsExportModalOpen(false);
            showToast(
              isMerge
                ? `Добавлено ${importedTxs.length} операций из CSV к текущей истории`
                : `База заменена: загружено ${importedTxs.length} операций из CSV`,
              () => {
                setTransactions(prevSnapshot.transactions);
                setToast(null);
              }
            );
          } else {
            showToast('Не найдено корректных строк с суммами для импорта');
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
    showToast('Демонстрационные данные v0.8.0 восстановлены');
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
      if (t.type === 'transfer') return;
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
      if (tx.type !== 'transfer') {
        g.net += tx.type === 'income' ? val : -val;
      }
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

  // ================= ДАННЫЕ ДЛЯ SVG-ГРАФИКОВ =================
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

      if (t.type === 'transfer') return;
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


  // Карточка одной строки операции (выровнена по модульной сетке 4px/8px и tabular-nums)
  const renderTransactionRow = (tx) => {
    const catObj = getCategoryMeta(tx.category, tx.type, customCategories);
    const isTransfer = tx.type === 'transfer';
    const isExpense = tx.type === 'expense';
    const isShared = (tx.account || 'shared') === 'shared';
    const getShortWalletLabel = (wKey) => {
      if (wKey === 'husband') return `${safeProfiles.husband?.emoji || '🧔🏻‍♂️'} ${safeProfiles.husband?.name || 'Партнер 1'}`;
      if (wKey === 'wife') return `${safeProfiles.wife?.emoji || '👩🏼'} ${safeProfiles.wife?.name || 'Партнер 2'}`;
      return '👥 Общий котел';
    };

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
        className="min-h-[60px] py-2.5 px-3 flex items-center justify-between gap-3 hover:bg-stone-50 rounded-xl transition cursor-pointer group"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-base ${catObj.color}`}>
            {catObj.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-stone-900 flex items-center gap-1.5 min-w-0">
              <span className="truncate">{tx.title}</span>
              {tx.goalId && (
                <span className="h-5 px-1.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-semibold inline-flex items-center shrink-0">
                  🎯 Копилка
                </span>
              )}
              {tx.debtId && (
                <span className="h-5 px-1.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-semibold inline-flex items-center shrink-0">
                  💳 Долг
                </span>
              )}
              {tx.recurringId && (
                <span className="h-5 px-1.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold inline-flex items-center shrink-0">
                  🛡️ Постоянный
                </span>
              )}
              {isTransfer && (
                <span className="h-5 px-1.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-semibold inline-flex items-center shrink-0">
                  ⇄ Перевод
                </span>
              )}
            </div>
            <div className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5 truncate">
              <span className="truncate font-medium text-stone-600">{catObj.name}</span>
              <span className="text-stone-300">•</span>
              {isTransfer ? (
                <span className="inline-flex items-center gap-1 text-indigo-700 font-medium shrink-0">
                  <span>{getShortWalletLabel(getWalletKeyFromTx(tx))}</span>
                  <span>→</span>
                  <span>{getShortWalletLabel(tx.transferTo || 'shared')}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-stone-600 shrink-0">
                  <span>{tx.author === 'husband' ? (safeProfiles.husband?.emoji || '🧔🏻‍♂️') : (safeProfiles.wife?.emoji || '👩🏼')}</span>
                  <span>{isShared ? 'Общий котел' : (tx.author === 'husband' ? (safeProfiles.husband?.name || 'Личный') : (safeProfiles.wife?.name || 'Личный'))}</span>
                </span>
              )}
              <span className="text-stone-300">•</span>
              <span className="text-stone-500 font-mono text-[11px] tabular-nums shrink-0">{tx.date}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className={`min-w-[96px] text-sm font-semibold tracking-tight text-right tabular-nums ${isTransfer ? 'text-indigo-700' : isExpense ? 'text-stone-900' : 'text-emerald-700'}`}>
            {isTransfer ? '⇄ ' : isExpense ? '−' : '+'}{Number(tx.amount).toLocaleString('ru-RU')} ₽
          </div>
          <button
            type="button"
            onClick={(e) => handleDeleteTransaction(tx.id, e)}
            aria-label={`Удалить операцию ${tx.title}`}
            className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition shrink-0"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const myWalletKey = deviceOwner === 'wife' ? 'wife' : 'husband';
  const partnerWalletKey = deviceOwner === 'wife' ? 'husband' : 'wife';
  const myProfile = safeProfiles[myWalletKey] || { name: 'Я', emoji: '👤' };
  const partnerProfile = safeProfiles[partnerWalletKey] || { name: 'Партнер', emoji: '👥' };
  const myWalletStats = myWalletKey === 'wife' ? stats.wifePersonal : stats.husbandPersonal;
  const partnerWalletStats = partnerWalletKey === 'wife' ? stats.wifePersonal : stats.husbandPersonal;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-28 lg:pb-12">
      {/* Верхний бар управления — все контролы выровнены по единой высоте h-10 (40px) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 h-16 flex items-center justify-between gap-1 sm:gap-3">
          {/* Левый блок: Бренд + фиксированный капсульный селектор периода */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold shadow-sm text-xs sm:text-base shrink-0">
              💎
            </div>
            <div className="hidden sm:block lg:hidden 2xl:block min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold tracking-tight text-stone-900 truncate">
                  Семейный Бюджет
                </h1>
                <span className="h-5 px-1.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-semibold inline-flex items-center shrink-0">
                  v0.8.0
                </span>
              </div>
              <p className="text-[11px] text-stone-500 leading-none mt-0.5 truncate">
                Совместный учет и планирование
              </p>
            </div>

            {/* Капсула выбора месяца с адаптивной шириной текста — исключает сдвиги шапки */}
            <div className="h-9 sm:h-10 px-0.5 sm:px-1 bg-stone-100 border border-stone-200/80 rounded-xl flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => stepMonth(-1)}
                aria-label="Предыдущий месяц"
                className="w-6 sm:w-7 h-7 sm:h-8 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white rounded-lg transition"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCalendarDate(null);
                  setSelectedMonth(selectedMonth === 'all' ? getCurrentMonthPrefix() : 'all');
                }}
                className="min-w-[76px] sm:min-w-[116px] h-7 sm:h-8 px-1 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold text-stone-800 hover:bg-white transition text-center whitespace-nowrap tabular-nums"
                title="Нажмите для переключения: Месяц / За всё время"
              >
                {formatMonthTitle(selectedMonth)}
              </button>
              <button
                type="button"
                onClick={() => stepMonth(1)}
                aria-label="Следующий месяц"
                className="w-6 sm:w-7 h-7 sm:h-8 flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-white rounded-lg transition"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* Навигация по 4 вкладкам (Desktop) — фиксированная высота h-10 */}
          <nav className="hidden lg:flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200/70 h-10 shrink-0" aria-label="Разделы приложения">
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
                  className={`h-8 px-2.5 xl:px-3 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.badge !== null && tab.badge !== undefined && (
                    <span className={`min-w-[20px] h-5 px-1.5 rounded-md text-[10px] inline-flex items-center justify-center tabular-nums ${
                      tab.alert
                        ? 'bg-amber-100 text-amber-900 font-bold'
                        : isActive
                        ? 'bg-stone-100 text-stone-700 font-semibold'
                        : 'bg-stone-200/70 text-stone-600'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Правый блок: переключатель профилей и действия */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="flex items-center gap-0.5 sm:gap-1 bg-stone-100 p-0.5 sm:p-1 rounded-xl border border-stone-200/70 h-9 sm:h-10">
              <button
                type="button"
                onClick={() => {
                  setCurrentUser('husband');
                  setActiveWalletCard('husband');
                }}
                className={`h-7 sm:h-8 px-1.5 sm:px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 sm:gap-1.5 ${
                  currentUser === 'husband'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title={`Активный пользователь: ${safeProfiles.husband?.name || 'Партнер 1'}`}
              >
                <span>{safeProfiles.husband?.emoji || '🧔🏻‍♂️'}</span>
                <span className="hidden sm:inline max-w-[85px] truncate">{safeProfiles.husband?.name || 'Партнер 1'}</span>
                {deviceOwner === 'husband' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" title="Владелец этого устройства" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentUser('wife');
                  setActiveWalletCard('wife');
                }}
                className={`h-7 sm:h-8 px-1.5 sm:px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 sm:gap-1.5 ${
                  currentUser === 'wife'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title={`Активный пользователь: ${safeProfiles.wife?.name || 'Партнер 2'}`}
              >
                <span>{safeProfiles.wife?.emoji || '👩🏼'}</span>
                <span className="hidden sm:inline max-w-[85px] truncate">{safeProfiles.wife?.name || 'Партнер 2'}</span>
                {deviceOwner === 'wife' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="Владелец этого устройства" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                aria-label="Настроить профили и владельца телефона"
                className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-200/70 rounded-lg transition"
                title="Настроить имена, эмодзи и телефон"
              >
                <User className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              aria-label="Экспорт в Excel, CSV и резервная копия"
              className="h-9 w-9 sm:h-10 sm:w-auto px-0 sm:px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition border border-stone-200/80 flex items-center justify-center sm:gap-1.5 shrink-0"
              title="Экспорт в XLSX / CSV / AI и резервная копия"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="hidden sm:inline lg:hidden 2xl:inline">Бэкап / XLSX</span>
            </button>

            <button
              type="button"
              onClick={() => openNewTransactionModal()}
              aria-label="Записать операцию"
              title="Записать новую операцию"
              className="hidden sm:flex w-10 h-10 rounded-xl bg-stone-900 text-white hover:bg-stone-800 transition shadow-sm items-center justify-center shrink-0"
            >
              <Plus className="w-5 h-5 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* Основной контент по вкладкам */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {/* ================= ВКЛАДКА 1: ОБЗОР (ДАШБОРД) ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5 animate-fade-in">
            {/* УМНАЯ НАПОМИНАЛКА О ГОРЯЩИХ И ПРОСРОЧЕННЫХ ОБЯЗАТЕЛЬНЫХ ПЛАТЕЖАХ */}
            {reminderSummary.urgentRecs.length > 0 && (
              <div className="bg-amber-50/95 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-amber-950">
                      Напоминалка по постоянным расходам ({reminderSummary.urgentRecs.length})
                    </div>
                    <div className="text-xs text-amber-900 mt-0.5 flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
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
                      className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition inline-flex items-center"
                    >
                      Оплатить сейчас
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('debts')}
                    className="h-9 px-3.5 rounded-xl bg-white border border-amber-300 text-amber-950 text-xs font-semibold hover:bg-amber-100 transition inline-flex items-center"
                  >
                    К списку платежей →
                  </button>
                </div>
              </div>
            )}

            {/* 4 KPI-КАРТОЧКИ (Personal-First: Мой счет -> Партнер -> Семейный резерв -> Безопасный лимит) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
              {/* 1. Мой личный счет (владелец устройства) */}
              <div
                onClick={() => setActiveWalletCard(myWalletKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveWalletCard(myWalletKey); }}
                className={`h-[160px] p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
                  activeWalletCard === myWalletKey
                    ? 'bg-white border-stone-900 ring-2 ring-stone-900/10 shadow-md'
                    : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-sm'
                }`}
              >
                <div className="h-6 flex items-center justify-between gap-1 text-stone-600">
                  <span className="uppercase tracking-wider font-semibold text-xs flex items-center gap-1.5 truncate">
                    <span>{myProfile.emoji}</span>
                    <span className="truncate">{myProfile.name}</span>
                  </span>
                  <span className="h-5 px-2 rounded-md bg-stone-900 text-white text-[10px] font-semibold inline-flex items-center shrink-0">
                    Мой счет
                  </span>
                </div>

                <div className="my-auto">
                  <div className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums leading-none truncate ${
                    myWalletStats.balance < 0 ? 'text-rose-600' : 'text-stone-900'
                  }`}>
                    {myWalletStats.balance.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className={`text-xs mt-1.5 truncate ${
                    myWalletStats.balance < 0 ? 'text-rose-600 font-semibold' : 'text-stone-500'
                  }`}>
                    {myWalletStats.balance < 0 ? '⚠️ Дефицит счета' : 'Переходящий остаток'}
                  </div>
                </div>

                <div className="h-7 pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs tabular-nums">
                  <span className="text-emerald-700 font-semibold truncate">+{myWalletStats.monthIncome.toLocaleString('ru-RU')}</span>
                  <span className="text-rose-600 font-semibold truncate">−{myWalletStats.monthExpense.toLocaleString('ru-RU')}</span>
                </div>
              </div>

              {/* 2. Личный счет партнера */}
              <div
                onClick={() => setActiveWalletCard(partnerWalletKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveWalletCard(partnerWalletKey); }}
                className={`h-[160px] p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
                  activeWalletCard === partnerWalletKey
                    ? 'bg-white border-stone-900 ring-2 ring-stone-900/10 shadow-md'
                    : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-sm'
                }`}
              >
                <div className="h-6 flex items-center justify-between gap-1 text-stone-600">
                  <span className="uppercase tracking-wider font-semibold text-xs flex items-center gap-1.5 truncate">
                    <span>{partnerProfile.emoji}</span>
                    <span className="truncate">{partnerProfile.name}</span>
                  </span>
                  <span className="h-5 px-2 rounded-md bg-stone-100 text-stone-600 text-[10px] font-semibold inline-flex items-center shrink-0">
                    Партнер
                  </span>
                </div>

                <div className="my-auto">
                  <div className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums leading-none truncate ${
                    partnerWalletStats.balance < 0 ? 'text-rose-600' : 'text-stone-900'
                  }`}>
                    {partnerWalletStats.balance.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className={`text-xs mt-1.5 truncate ${
                    partnerWalletStats.balance < 0 ? 'text-rose-600 font-semibold' : 'text-stone-500'
                  }`}>
                    {partnerWalletStats.balance < 0 ? '⚠️ Дефицит счета' : 'Переходящий остаток'}
                  </div>
                </div>

                <div className="h-7 pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs tabular-nums">
                  <span className="text-emerald-700 font-semibold truncate">+{partnerWalletStats.monthIncome.toLocaleString('ru-RU')}</span>
                  <span className="text-rose-600 font-semibold truncate">−{partnerWalletStats.monthExpense.toLocaleString('ru-RU')}</span>
                </div>
              </div>

              {/* 3. Семейный резерв (Общий котел как подушка/копилка) */}
              <div
                onClick={() => setActiveWalletCard('shared')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveWalletCard('shared'); }}
                className={`h-[160px] p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
                  activeWalletCard === 'shared'
                    ? 'bg-white border-stone-900 ring-2 ring-stone-900/10 shadow-md'
                    : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-sm'
                }`}
              >
                <div className="h-6 flex items-center justify-between gap-1 text-stone-600">
                  <span className="uppercase tracking-wider font-semibold text-xs flex items-center gap-1.5 truncate">
                    <span>👥</span>
                    <span className="truncate">Семейный резерв</span>
                  </span>
                  <span className="h-5 px-2 rounded-md bg-stone-100 text-stone-600 text-[10px] font-semibold inline-flex items-center shrink-0">
                    Копилка
                  </span>
                </div>

                <div className="my-auto">
                  <div className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums leading-none truncate ${
                    stats.shared.balance < 0 ? 'text-rose-600' : 'text-stone-900'
                  }`}>
                    {stats.shared.balance.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className={`text-xs mt-1.5 truncate ${
                    stats.shared.balance < 0 ? 'text-rose-600 font-semibold' : 'text-stone-500'
                  }`}>
                    {stats.shared.balance < 0 ? '⚠️ Дефицит счета' : 'Подушка / Котел'}
                  </div>
                </div>

                <div className="h-7 pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs tabular-nums">
                  <span className="text-emerald-700 font-semibold truncate">+{stats.shared.monthIncome.toLocaleString('ru-RU')}</span>
                  <span className="text-rose-600 font-semibold truncate">−{stats.shared.monthExpense.toLocaleString('ru-RU')}</span>
                </div>
              </div>

              {/* 4. Безопасный лимит в день / Индикатор кассового разрыва */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsLimitModalOpen(true)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsLimitModalOpen(true); }}
                className={`h-[160px] text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col justify-between cursor-pointer group transition-all hover:scale-[1.01] ${
                  stats.hasCashGap
                    ? 'bg-gradient-to-br from-rose-900 to-stone-900 hover:from-rose-800'
                    : 'bg-gradient-to-br from-stone-900 to-stone-800 hover:from-stone-800'
                }`}
                title="Нажмите для настройки горизонта лимита и дней выплат ЗП"
              >
                <div className="h-6 flex items-center justify-between gap-1 text-stone-200">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="uppercase tracking-wider font-semibold text-xs truncate">
                      {stats.hasCashGap ? 'Кассовый разрыв' : stats.isPastMonth ? 'Итог месяца' : 'Безопасный лимит'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLimitModalOpen(true);
                      }}
                      aria-label="Настроить горизонт лимита и дни зарплаты"
                      className="w-5 h-5 rounded-md hover:bg-white/10 text-stone-400 group-hover:text-amber-300 flex items-center justify-center transition"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                    </button>
                  </div>
                  {stats.hasCashGap ? (
                    <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                </div>

                <div className="my-auto">
                  {stats.hasCashGap ? (
                    <>
                      <div className="text-xl sm:text-2xl font-bold tracking-tight text-rose-300 tabular-nums leading-none truncate">
                        −{stats.cashGapAmount.toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="text-xs text-rose-200 mt-1.5 truncate">
                        Не хватает на обязательные счета
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xl sm:text-2xl font-bold tracking-tight text-amber-300 tabular-nums leading-none truncate">
                        {stats.dailyAvailable.toLocaleString('ru-RU')} {stats.isPastMonth ? '₽' : '₽/день'}
                      </div>
                      <div className="text-xs text-stone-300 mt-1.5 truncate tabular-nums">
                        {stats.isPastMonth
                          ? 'Период завершен'
                          : activeWalletCard === 'shared'
                          ? `Общий • на ${stats.daysLeft} дн. (${stats.daysHorizonLabel})`
                          : activeWalletCard === myWalletKey
                          ? `${myProfile.name} (Мой) • на ${stats.daysLeft} дн. (${stats.daysHorizonLabel})`
                          : `${partnerProfile.name} • на ${stats.daysLeft} дн. (${stats.daysHorizonLabel})`}
                      </div>
                    </>
                  )}
                </div>

                <div className="h-7 pt-2 border-t border-stone-700/70 text-xs text-stone-300 flex items-center justify-between gap-2 tabular-nums">
                  {!stats.isPastMonth && stats.reserveToDeduct > 0 ? (
                    <span className="text-amber-300 font-medium flex items-center gap-1 truncate" title="Резерв на неоплаченные обязательные счета">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Резерв: {stats.reserveToDeduct.toLocaleString('ru-RU')} ₽</span>
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-medium flex items-center gap-1 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Счета закрыты</span>
                    </span>
                  )}
                  <span className="text-stone-300 font-semibold shrink-0" title="Отложено в копилки и погашено кредитов">
                    🎯 {stats.activeSavedAndDebtPaid.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
            </div>

            {/* МЕМОИЗИРОВАННЫЙ БЛОК SVG-ГРАФИКОВ (фиксированная высота 232px) */}
            <ChartsSection
              chartView={chartView}
              setChartView={setChartView}
              selectedMonth={selectedMonth}
              burnDownData={burnDownData}
              rule503020Data={rule503020Data}
              dynamics6MonthsData={dynamics6MonthsData}
              partnerComparisonData={partnerComparisonData}
              userProfiles={safeProfiles}
              daysInMonth={stats.daysInMonth}
              safeLimitConfig={safeLimitConfig}
            />

            {/* СРЕДНИЙ РЯД (12-колоночная сетка с выравниванием карточек по высоте items-stretch) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* Левая карточка (7 колонок): Структура расходов */}
              <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 mb-3.5 border-b border-stone-100">
                    <div>
                      <h2 className="text-sm font-semibold text-stone-900">
                        Структура расходов ({activeWalletCard === 'shared' ? 'Семейный резерв 👥' : activeWalletCard === myWalletKey ? `${myProfile.name} ${myProfile.emoji}` : `${partnerProfile.name} ${partnerProfile.emoji}`})
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
                        Потребительские траты: <strong className="text-stone-800">{stats.totalSelectedExpense.toLocaleString('ru-RU')} ₽</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('debts')}
                        className="h-8 px-3 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition inline-flex items-center"
                      >
                        План/Прогноз
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openWalletHistory(activeWalletCard);
                          setActiveTab('history');
                        }}
                        className="h-8 px-3 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition inline-flex items-center gap-1"
                      >
                        <span>Детали</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {stats.topCategories.length === 0 ? (
                    <div className="py-12 text-center text-xs text-stone-500 bg-stone-50/60 rounded-xl border border-stone-100">
                      Нет потребительских расходов по этому счету за выбранный период
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {stats.topCategories.slice(0, 5).map(item => (
                        <div key={item.name} className="p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex items-center gap-2 font-semibold text-stone-800 min-w-0">
                              <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 ${item.meta.color}`}>
                                {item.meta.icon}
                              </span>
                              <span className="truncate">{item.name}</span>
                              {item.isNewInMonth ? (
                                <span className="h-5 px-1.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-semibold inline-flex items-center shrink-0">
                                  Новая
                                </span>
                              ) : item.diff !== 0 ? (
                                <span className={`h-5 px-1.5 rounded-md text-[10px] font-semibold inline-flex items-center shrink-0 tabular-nums ${
                                  item.diff > 0
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                  {item.diff > 0 ? `+${item.diff.toLocaleString('ru-RU')} ₽` : `−${Math.abs(item.diff).toLocaleString('ru-RU')} ₽`}
                                </span>
                              ) : null}
                            </span>
                            <span className="text-stone-900 font-bold shrink-0 tabular-nums">
                              {item.sum.toLocaleString('ru-RU')} ₽ <span className="text-stone-500 font-normal">({item.percent}%)</span>
                            </span>
                          </div>
                          <div className="w-full bg-stone-200/80 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-stone-900 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(4, item.percent)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Единый нижний подвал левой карточки */}
                <div className="pt-3 mt-4 border-t border-stone-100 flex items-center justify-between text-xs tabular-nums">
                  <span className="text-stone-600 font-medium">Плановый ориентир месяца:</span>
                  <span className="font-bold text-stone-900">
                    {expenseForecastData.totalPlannedBudget.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>

              {/* Правая карточка (5 колонок): Участие в общем котле и дисциплина счетов */}
              <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-stone-100">
                    <div>
                      <h2 className="text-sm font-semibold text-stone-900">Участие в общем котле</h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Баланс вклада супругов и обязательных счетов
                      </p>
                    </div>
                    <span className="w-8 h-8 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Блок 1: Вклад в доходы котла */}
                    {(() => {
                      const totalInc = stats.shared.monthIncome;
                      const hIncPct = totalInc > 0 ? Math.round((stats.shared.husbandIncome / totalInc) * 100) : 50;
                      const wIncPct = totalInc > 0 ? 100 - hIncPct : 50;
                      return (
                        <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-2 tabular-nums">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                              <span>💰</span> Вклад в доходы котла
                            </span>
                            <span className="font-bold text-stone-900">
                              {totalInc.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                          <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden flex">
                            <div
                              className="bg-emerald-600 h-full transition-all duration-500"
                              style={{ width: `${hIncPct}%` }}
                            />
                            <div
                              className="bg-teal-400 h-full transition-all duration-500"
                              style={{ width: `${wIncPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-stone-600">
                            <span>🧔🏻‍♂️ Муж: {stats.shared.husbandIncome.toLocaleString('ru-RU')} ₽ ({totalInc > 0 ? hIncPct : 0}%)</span>
                            <span>👩🏼 Жена: {stats.shared.wifeIncome.toLocaleString('ru-RU')} ₽ ({totalInc > 0 ? wIncPct : 0}%)</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Блок 2: Оплата общих покупок */}
                    {(() => {
                      const totalExp = stats.shared.consumerExpense;
                      const hExpPct = totalExp > 0 ? Math.round((stats.shared.husbandConsumerSpent / totalExp) * 100) : 50;
                      const wExpPct = totalExp > 0 ? 100 - hExpPct : 50;
                      return (
                        <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-2 tabular-nums">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                              <span>🛒</span> Оплата общих покупок
                            </span>
                            <span className="font-bold text-stone-900">
                              {totalExp.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>
                          <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden flex">
                            <div
                              className="bg-stone-900 h-full transition-all duration-500"
                              style={{ width: `${hExpPct}%` }}
                            />
                            <div
                              className="bg-stone-400 h-full transition-all duration-500"
                              style={{ width: `${wExpPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-stone-600">
                            <span>🧔🏻‍♂️ Муж: {stats.shared.husbandConsumerSpent.toLocaleString('ru-RU')} ₽ ({totalExp > 0 ? hExpPct : 0}%)</span>
                            <span>👩🏼 Жена: {stats.shared.wifeConsumerSpent.toLocaleString('ru-RU')} ₽ ({totalExp > 0 ? wExpPct : 0}%)</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Блок 3: Исполнение обязательных счетов месяца (уравновешивает высоту правой карточки) */}
                    {(() => {
                      const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
                      const mandatoryList = recurringPayments.filter(r => r.isMandatory !== false);
                      const totalBills = mandatoryList.length;
                      const paidBills = mandatoryList.filter(r => (r.paidMonths || []).includes(targetYm)).length;
                      const billsPct = totalBills > 0 ? Math.round((paidBills / totalBills) * 100) : 100;
                      return (
                        <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-2 tabular-nums">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                              <span>🛡️</span> Обязательные счета месяца
                            </span>
                            <span className="font-bold text-stone-900">
                              {paidBills} из {totalBills} оплачено
                            </span>
                          </div>
                          <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                billsPct === 100 ? 'bg-emerald-600' : 'bg-amber-500'
                              }`}
                              style={{ width: `${billsPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-stone-600">
                            <span>Осталось к оплате: {stats.unpaidMandatoryThisMonth.toLocaleString('ru-RU')} ₽</span>
                            <span>{billsPct}% выполнено</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Единый нижний подвал правой карточки */}
                <div className="pt-3 mt-4 border-t border-stone-100 flex items-center justify-between text-xs tabular-nums">
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
            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 mb-2 border-b border-stone-100">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900">Последние операции</h2>
                  <p className="text-xs text-stone-500 mt-0.5">Нажмите на запись для редактирования или внесите пачку чеков за прошлую дату</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => openNewTransactionModal(null, null, null, true)}
                    className="h-9 px-3 rounded-xl bg-amber-100/90 hover:bg-amber-200/80 text-stone-900 text-xs font-semibold transition inline-flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Внести чеки за дату</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="h-9 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 text-xs font-semibold transition inline-flex items-center tabular-nums"
                  >
                    Все ({periodTransactions.length})
                  </button>
                </div>
              </div>

              {periodTransactions.length === 0 ? (
                <div className="py-10 text-center text-xs text-stone-500">
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
            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-4 space-y-3">
              {/* Панель поиска и кнопок строго единой высоты h-10 */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Поиск по названию или категории..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Поиск по операциям"
                    className="w-full h-10 text-xs font-medium pl-9 pr-8 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Сбросить поиск"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-500 hover:text-stone-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                  className={`h-10 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition shrink-0 tabular-nums ${
                    isCalendarExpanded || selectedCalendarDate
                      ? 'bg-amber-100 text-amber-950 border-amber-300'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>{selectedCalendarDate ? `День: ${selectedCalendarDate.slice(8, 10)}.${selectedCalendarDate.slice(5, 7)}` : 'Календарь чеков'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  aria-expanded={isFilterOpen}
                  aria-label="Открыть фильтры операций"
                  className={`h-10 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition shrink-0 ${
                    hasActiveFilters
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Фильтры</span>
                  {activeFilterCount > 0 && (
                    <span className="w-5 h-5 rounded-md bg-amber-400 text-stone-950 font-bold text-[10px] inline-flex items-center justify-center tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* ИНТЕРАКТИВНЫЙ КАЛЕНДАРЬ ЧЕКОВ ПО ДНЯМ МЕСЯЦА */}
              {isCalendarExpanded && (
                <ReceiptCalendar
                  monthCalendarDays={monthCalendarDays}
                  selectedCalendarDate={selectedCalendarDate}
                  setSelectedCalendarDate={setSelectedCalendarDate}
                  onAddReceiptsForDate={(dateStr) => openNewTransactionModal(null, null, dateStr, true)}
                />
              )}

              {/* Выпадающая панель фильтров (3 колонки на десктопе) */}
              {isFilterOpen && (
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in text-xs">
                  <div>
                    <label className="text-xs font-semibold text-stone-600 block mb-1.5">Кто записал:</label>
                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-stone-200/80">
                      {[
                        { id: 'all', label: 'Все' },
                        { id: 'husband', label: `${safeProfiles.husband?.emoji || '🧔🏻‍♂️'} ${safeProfiles.husband?.name || 'Партнер 1'}` },
                        { id: 'wife', label: `${safeProfiles.wife?.emoji || '👩🏼'} ${safeProfiles.wife?.name || 'Партнер 2'}` },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFilterAuthor(opt.id)}
                          className={`h-7 px-2 rounded-md font-medium transition flex items-center justify-center truncate ${
                            filterAuthor === opt.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-600 block mb-1.5">Тип операции:</label>
                    <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-lg border border-stone-200/80">
                      {[
                        { id: 'all', label: 'Все' },
                        { id: 'expense', label: 'Расходы' },
                        { id: 'income', label: 'Доходы' },
                        { id: 'transfer', label: '⇄ Переводы' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFilterType(opt.id)}
                          className={`h-7 px-2 rounded-md font-medium transition flex items-center justify-center truncate ${
                            filterType === opt.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-600 block mb-1.5">Счет:</label>
                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-stone-200/80">
                      {[
                        { id: 'all', label: 'Все' },
                        { id: 'shared', label: '👥 Общий' },
                        { id: 'personal', label: '👤 Личный' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFilterAccount(opt.id)}
                          className={`h-7 px-2 rounded-md font-medium transition flex items-center justify-center truncate ${
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

              <div className="flex items-center justify-between text-xs text-stone-600 font-medium flex-wrap gap-2 pt-1">
                <span className="tabular-nums">
                  Найдено: <strong className="text-stone-900">{filteredTransactions.length}</strong> из {periodTransactions.length}
                  {selectedCalendarDate && (
                    <span className="ml-2 text-amber-800 font-semibold">
                      • Фильтр по дате: {selectedCalendarDate}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openNewTransactionModal(null, null, selectedCalendarDate || getTargetDateForMonth(selectedMonth), true)}
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
              <div className="py-12 text-center bg-white rounded-2xl border border-stone-200/80 p-8 shadow-sm">
                <div className="text-3xl mb-2">🧾</div>
                <div className="text-sm font-semibold text-stone-800">
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
                      onClick={() => openNewTransactionModal(null, null, selectedCalendarDate, true)}
                      className="h-9 px-4 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition inline-flex items-center"
                    >
                      + Добавить чеки за {selectedCalendarDate}
                    </button>
                  )}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="h-9 px-4 rounded-xl bg-stone-100 text-stone-800 text-xs font-semibold hover:bg-stone-200 transition inline-flex items-center"
                    >
                      Сбросить фильтры
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedTransactions.map(group => (
                  <div key={group.date} className="bg-white rounded-2xl border border-stone-200/80 p-3 sm:p-4 shadow-sm">
                    <div className="h-9 flex items-center justify-between px-3 bg-stone-50 rounded-xl text-xs font-semibold text-stone-700 mb-2 gap-2">
                      <span className="truncate">{group.label}</span>
                      <div className="flex items-center gap-3 shrink-0 tabular-nums">
                        <button
                          type="button"
                          onClick={() => openNewTransactionModal(null, null, group.date, false)}
                          className="h-6 px-2.5 text-[11px] font-semibold text-stone-700 hover:text-stone-950 bg-white rounded-lg border border-stone-200/80 hover:border-stone-400 transition inline-flex items-center"
                          title={`Добавить ещё чек за ${group.date}`}
                        >
                          + Чек сюда
                        </button>
                        <span className={`min-w-[84px] text-right font-bold ${group.net >= 0 ? 'text-emerald-700' : 'text-stone-800'}`}>
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
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-stone-900 flex items-center gap-2">
                  <span>🎯</span> Семейные копилки и цели
                </h2>
                <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
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
                className="h-10 px-4 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5 shadow-sm self-start sm:self-auto shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Новая цель</span>
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200/80 p-10 text-center shadow-sm">
                <div className="text-3xl mb-2">🎯</div>
                <div className="text-sm font-semibold text-stone-800">Нет активных целей-копилок</div>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Создайте цель накопления на отпуск, подушку безопасности или крупную покупку
                </p>
                <button
                  type="button"
                  onClick={() => setIsNewGoalModalOpen(true)}
                  className="mt-4 h-9 px-4 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Создать первую цель</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
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
                      className="min-h-[196px] bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm hover:shadow-md hover:border-stone-300 transition-all cursor-pointer relative overflow-hidden group text-left flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-center text-xl shrink-0">
                            {goal.icon}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="h-7 px-2.5 rounded-lg bg-stone-100 text-stone-800 text-xs font-bold inline-flex items-center tabular-nums">
                              {percent}%
                            </span>
                            <button
                              type="button"
                              onClick={(e) => openEditGoalModal(e, goal)}
                              aria-label={`Редактировать цель ${goal.title}`}
                              className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition"
                              title="Изменить цель"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteGoal(e, goal.id)}
                              aria-label={`Удалить цель ${goal.title}`}
                              className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Удалить цель"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="font-semibold text-stone-900 text-sm mb-1 flex items-center justify-between gap-2">
                          <span className="truncate">{goal.title}</span>
                          <span className="text-xs font-semibold text-violet-700 shrink-0">
                            ± Операция
                          </span>
                        </div>

                        <div className="text-xs text-stone-600 font-medium tabular-nums">
                          {Number(goal.current).toLocaleString('ru-RU')} ₽ из {Number(goal.target).toLocaleString('ru-RU')} ₽
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-stone-100">
                        <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${goal.color} transition-all duration-500`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="text-xs text-stone-500 flex items-center justify-between tabular-nums">
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
          <div className="space-y-5 animate-fade-in">
            {/* 3 карточки сводки фиксированной высоты h-[120px] */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
              <div className="h-[120px] bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-stone-500 block truncate">Неоплаченные обязательные счета</span>
                  <div className="text-xl sm:text-2xl font-bold text-stone-900 tabular-nums mt-1 truncate">
                    {stats.unpaidMandatoryThisMonth.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-xs text-stone-600 mt-1 truncate">
                    {pendingBillsCount > 0
                      ? `Ожидают оплаты: ${pendingBillsCount} шт.`
                      : '✓ Все обязательные счета оплачены'}
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl shrink-0">
                  🛡️
                </div>
              </div>

              <div className="h-[120px] bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-stone-500 block truncate">Планируемые расходы месяца</span>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-800 tabular-nums mt-1 truncate">
                    {expenseForecastData.totalPlannedBudget.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-xs text-stone-600 mt-1 truncate tabular-nums">
                    Факт: {expenseForecastData.totalCurrentActual.toLocaleString('ru-RU')} ₽ ({expenseForecastData.pastMonthsCount} мес. базы)
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl shrink-0">
                  📊
                </div>
              </div>

              <div className="h-[120px] bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-stone-500 block truncate">Остаток по долгам и кредитам</span>
                  <div className="text-xl sm:text-2xl font-bold text-rose-600 tabular-nums mt-1 truncate">
                    {stats.totalDebtRemaining.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-xs text-stone-600 mt-1 truncate tabular-nums">
                    Погашено {Math.max(0, stats.totalDebtInitial - stats.totalDebtRemaining).toLocaleString('ru-RU')} ₽ из {stats.totalDebtInitial.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center text-xl shrink-0">
                  💳
                </div>
              </div>
            </div>

            {/* РАЗДЕЛ 1: СПИСОК ПОСТОЯННЫХ ОБЯЗАТЕЛЬНЫХ РАСХОДОВ (выровненные колонки сумм и кнопок) */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-stone-100">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Постоянные обязательные расходы и напоминалка</span>
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
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
                  className="h-9 px-3.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5 self-start sm:self-auto shadow-sm shrink-0"
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
                        <div key={rec.id} className="py-3 px-2 hover:bg-stone-50/80 rounded-xl flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap transition">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 ${
                              isPaid ? 'bg-emerald-50 text-emerald-700' : st.code === 'overdue' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <span>{catMeta.icon}</span>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-stone-900 flex items-center gap-2 flex-wrap">
                                <span className="truncate">{rec.title}</span>
                                <span className={`h-5 px-2 rounded-md text-[10px] border inline-flex items-center shrink-0 ${st.badgeClass}`}>
                                  {st.label}
                                </span>
                                {rec.isMandatory === false && (
                                  <span className="h-5 px-1.5 rounded-md bg-stone-100 text-stone-600 text-[10px] inline-flex items-center shrink-0">
                                    Необязательный
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-stone-600">{rec.category}</span>
                                <span className="text-stone-300">•</span>
                                <span>
                                  {(rec.account || 'shared') === 'shared'
                                    ? '👥 Общий котел'
                                    : rec.author === 'wife'
                                    ? '👩🏼 Карта жены'
                                    : '🧔🏻‍♂️ Карта мужа'}
                                </span>
                                <span className="text-stone-300">•</span>
                                <span className="tabular-nums">До {rec.dueDate}-го числа</span>
                              </div>
                            </div>
                          </div>

                          {/* Жестко выровненные колонки: сумма (w-24) + статус/действие (w-[104px] h-8) + кнопки (w-8 h-8) */}
                          <div className="flex items-center gap-2 shrink-0 ml-auto">
                            <div className="w-24 text-right tabular-nums">
                              <div className="text-sm font-bold text-stone-900 leading-tight">
                                {Number(rec.amount).toLocaleString('ru-RU')} ₽
                              </div>
                              <div className="text-[10px] text-stone-500">
                                план в мес.
                              </div>
                            </div>

                            {isPaid ? (
                              <span className="w-[104px] h-8 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 inline-flex items-center justify-center shrink-0">
                                ✓ Оплачено
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openPayRecurringModal(rec)}
                                className="w-[104px] h-8 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition shadow-sm inline-flex items-center justify-center shrink-0"
                              >
                                Оплатить
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => openEditRecurringModal(e, rec)}
                              aria-label={`Изменить платеж ${rec.title}`}
                              className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition shrink-0"
                              title="Редактировать"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteRecurring(e, rec.id)}
                              aria-label={`Удалить платеж ${rec.title}`}
                              className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
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

            {/* РАЗДЕЛ 2: ПЛАНИРУЕМЫЕ И ПРЕДПОЛОЖИТЕЛЬНЫЕ РАСХОДЫ */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-stone-100">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Планируемые и предположительные расходы (по анализу прошлых месяцев)</span>
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Автоматический расчет ожидаемых трат по категориям на базе прошлых месяцев ({expenseForecastData.pastMonthsCount} мес. в базе) + постоянных счетов.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyAutoForecastLimits}
                  className="h-9 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Заполнить план из прошлых месяцев</span>
                </button>
              </div>

              {expenseForecastData.rows.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  Пока недостаточно данных для прогноза по этому кошельку
                </div>
              ) : (
                <div className="space-y-2.5">
                  {expenseForecastData.rows.map(row => {
                    const isEditingThis = editingPlanCategory === row.category;
                    return (
                      <div key={row.category} className="p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/70 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ${row.meta.color}`}>
                              {row.meta.icon}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5 flex-wrap">
                                <span>{row.category}</span>
                                <span className="h-5 px-2 rounded-md bg-white border border-stone-200 text-[10px] font-medium text-stone-600 inline-flex items-center tabular-nums">
                                  Среднее: {row.avgHistorical.toLocaleString('ru-RU')} ₽
                                </span>
                                {row.recSum > 0 && (
                                  <span className="h-5 px-2 rounded-md bg-blue-50 text-blue-700 text-[10px] font-medium inline-flex items-center tabular-nums">
                                    Постоянные счета: {row.recSum.toLocaleString('ru-RU')} ₽
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-stone-500 mt-0.5 tabular-nums">
                                {row.isOverPlan
                                  ? `⚠️ Превышение планового бюджета на ${(row.currentActual - row.effectivePlan).toLocaleString('ru-RU')} ₽`
                                  : `Свободно по плану категории: ${row.remainingPlan.toLocaleString('ru-RU')} ₽`}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {isEditingThis ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="500"
                                  value={editingPlanValue}
                                  onChange={(e) => setEditingPlanValue(e.target.value)}
                                  placeholder={String(row.autoSuggested)}
                                  className="w-28 h-8 text-xs font-bold px-2.5 bg-white border border-stone-300 rounded-lg focus:outline-none tabular-nums"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveCategoryLimit(row.category)}
                                  className="w-8 h-8 bg-stone-900 text-white rounded-lg hover:bg-stone-800 flex items-center justify-center"
                                  title="Сохранить план"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingPlanCategory(null)}
                                  className="w-8 h-8 bg-stone-200 text-stone-700 rounded-lg hover:bg-stone-300 flex items-center justify-center"
                                  title="Отмена"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="text-right flex items-center gap-2.5 tabular-nums">
                                <div>
                                  <div className="text-xs font-bold text-stone-900">
                                    Факт: {row.currentActual.toLocaleString('ru-RU')} ₽{' '}
                                    <span className="text-stone-500 font-normal">/ План: {row.effectivePlan.toLocaleString('ru-RU')} ₽</span>
                                  </div>
                                  <div className="text-[10px] text-stone-500">
                                    {row.userCustomLimit !== undefined ? 'Ручной план' : 'Авто-прогноз'} ({row.pctUsed}%)
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPlanCategory(row.category);
                                    setEditingPlanValue(String(row.effectivePlan));
                                  }}
                                  className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-900 bg-white border border-stone-200 rounded-lg hover:border-stone-400 transition"
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
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-stone-100">
                <div>
                  <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                    <span>💳</span>
                    <span>Долги и кредиты (Обратные копилки)</span>
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
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
                  className="h-9 px-3.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5 self-start sm:self-auto shadow-sm shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить кредит</span>
                </button>
              </div>

              {debts.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-3xl mb-2">🎉</div>
                  <div className="text-sm font-semibold text-stone-800">Долгов и кредитов нет</div>
                  <p className="text-xs text-stone-500 mt-1">
                    При необходимости вы можете добавить рассрочку, ипотеку или кредит
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
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
                    const forecastText = debt.isRegular === false && monthly <= 0
                      ? 'По мере возможности'
                      : monthsLeft > 0
                      ? `${monthsLeft} пл. (${MONTH_NAMES_NOMINATIVE[closeDate.getMonth()]} ${closeDate.getFullYear()})`
                      : 'Полностью закрыт! 🎉';

                    return (
                      <div
                        key={debt.id}
                        className="min-h-[212px] bg-stone-50/60 p-4 rounded-xl border border-stone-200/80 hover:border-stone-300 transition flex flex-col justify-between space-y-3 relative group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-10 h-10 rounded-xl bg-white border border-stone-200/70 flex items-center justify-center text-xl shrink-0">
                                {debt.icon}
                              </span>
                              <div className="min-w-0">
                                <h3 className="font-semibold text-stone-900 text-sm leading-tight truncate">{debt.title}</h3>
                                <span className="text-xs text-stone-500 tabular-nums">
                                  {debt.isRegular === false
                                    ? 'Гибкий долг / свободное погашение'
                                    : `Платёж: ${monthly.toLocaleString('ru-RU')} ₽ до ${debt.paymentDay}-го числа`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span className="h-7 px-2.5 rounded-lg bg-white border border-stone-200/80 text-xs font-bold text-stone-700 inline-flex items-center tabular-nums">
                                {percent}%
                              </span>
                              <button
                                type="button"
                                onClick={(e) => openEditDebtModal(e, debt)}
                                aria-label={`Изменить кредит ${debt.title}`}
                                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-white rounded-lg transition"
                                title="Редактировать"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteDebt(e, debt.id)}
                                aria-label={`Удалить кредит ${debt.title}`}
                                className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Удалить"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1 tabular-nums">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-stone-600">Остаток долга:</span>
                              <span className="font-bold text-rose-600 text-sm">
                                {rem.toLocaleString('ru-RU')} ₽
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-stone-500">
                              <span>Выплачено: {paid.toLocaleString('ru-RU')} ₽</span>
                              <span>Из: {init.toLocaleString('ru-RU')} ₽</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mb-2">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${debt.color} transition-all duration-500`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs text-stone-600 mb-3 tabular-nums">
                            <span>Прогноз закрытия:</span>
                            <span className="font-semibold text-stone-800">{forecastText}</span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-stone-200/70">
                            <span className={`text-xs font-medium ${isPaidThisMonth ? 'text-emerald-700' : (debt.isRegular === false ? 'text-stone-500' : 'text-amber-800')}`}>
                              {isPaidThisMonth ? '✓ Платёж за месяц внесен' : (debt.isRegular === false ? 'Свободный график' : 'Платёж за месяц ожидает')}
                            </span>
                            <button
                              type="button"
                              onClick={() => openPayDebtModal(debt)}
                              className="h-8 px-3.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition shadow-sm inline-flex items-center"
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
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-medium animate-fade-in max-w-[92vw]">
          <span className="truncate">{toast.message}</span>
          {toast.onUndo && (
            toast.actionLabel && toast.actionLabel !== 'Вернуть' ? (
              <button
                type="button"
                onClick={toast.onUndo}
                className="h-7 px-2.5 rounded-lg bg-amber-400 text-stone-950 font-bold hover:bg-amber-300 transition inline-flex items-center gap-1 shrink-0"
              >
                <span>{toast.actionLabel}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={toast.onUndo}
                className="h-7 px-2.5 rounded-lg bg-amber-400 text-stone-950 font-bold hover:bg-amber-300 transition inline-flex items-center gap-1 shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Вернуть</span>
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Закрыть уведомление"
            className="text-stone-300 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Нижний навигационный бар для мобильных — жесткая 5-колоночная сетка grid-cols-5 с поддержкой safe area iOS */}
      <nav
        aria-label="Мобильная навигация"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-2 h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] grid grid-cols-5 items-center lg:hidden"
      >
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] whitespace-nowrap transition ${
            activeTab === 'dashboard' ? 'text-stone-900 font-bold' : 'text-stone-600 font-medium'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Обзор</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] whitespace-nowrap transition ${
            activeTab === 'history' ? 'text-stone-900 font-bold' : 'text-stone-600 font-medium'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Чеки</span>
        </button>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => openNewTransactionModal()}
            aria-label="Быстрая запись операции"
            className="w-11 h-11 bg-stone-900 text-white rounded-xl shadow-md flex items-center justify-center active:scale-95 transition shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('debts')}
          className={`h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] whitespace-nowrap transition relative ${
            activeTab === 'debts' ? 'text-stone-900 font-bold' : 'text-stone-600 font-medium'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Счета</span>
          {pendingBillsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('goals')}
          className={`h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] whitespace-nowrap transition ${
            activeTab === 'goals' ? 'text-stone-900 font-bold' : 'text-stone-600 font-medium'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Копилки</span>
        </button>
      </nav>

      {/* ИЗОЛИРОВАННЫЕ МОДАЛЬНЫЕ ОКНА С FOCUS TRAP (WCAG 2.1.2) */}
      <TransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialTx={editingTransactionObj}
        presetConfig={txPresetConfig}
        currentUser={currentUser}
        isLockedType={isEditingLockedType}
        customCategories={customCategories}
        onCreateCustomCategory={handleCreateCustomCategory}
        onDeleteCustomCategory={handleDeleteCustomCategory}
        onSaveTransaction={handleSaveTransaction}
        onDeleteTransaction={handleDeleteTransaction}
      />

      <GoalActionModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        goals={goals}
        selectedGoalId={selectedGoalId}
        setSelectedGoalId={setSelectedGoalId}
        goalActionMode={goalActionMode}
        setGoalActionMode={setGoalActionMode}
        goalSourceAccount={goalSourceAccount}
        setGoalSourceAccount={setGoalSourceAccount}
        goalAmount={goalAmount}
        setGoalAmount={setGoalAmount}
        goalActionDate={goalActionDate}
        setGoalActionDate={setGoalActionDate}
        currentUser={currentUser}
        onSubmit={handleContributeGoal}
      />

      <GoalFormModal
        isOpen={isNewGoalModalOpen}
        onClose={() => setIsNewGoalModalOpen(false)}
        editingGoalId={editingGoalId}
        newGoalTitle={newGoalTitle}
        setNewGoalTitle={setNewGoalTitle}
        newGoalTarget={newGoalTarget}
        setNewGoalTarget={setNewGoalTarget}
        newGoalCurrent={newGoalCurrent}
        setNewGoalCurrent={setNewGoalCurrent}
        newGoalIcon={newGoalIcon}
        setNewGoalIcon={setNewGoalIcon}
        newGoalColor={newGoalColor}
        setNewGoalColor={setNewGoalColor}
        onSubmit={handleCreateGoal}
      />

      <RecurringFormModal
        isOpen={isNewRecurringModalOpen}
        onClose={() => setIsNewRecurringModalOpen(false)}
        editingRecurringId={editingRecurringId}
        newRecTitle={newRecTitle}
        setNewRecTitle={setNewRecTitle}
        newRecAmount={newRecAmount}
        setNewRecAmount={setNewRecAmount}
        newRecDueDate={newRecDueDate}
        setNewRecDueDate={setNewRecDueDate}
        newRecCategory={newRecCategory}
        setNewRecCategory={setNewRecCategory}
        newRecAccount={newRecAccount}
        setNewRecAccount={setNewRecAccount}
        newRecAuthor={newRecAuthor}
        setNewRecAuthor={setNewRecAuthor}
        newRecMandatory={newRecMandatory}
        setNewRecMandatory={setNewRecMandatory}
        customCategories={customCategories}
        onSubmit={handleCreateRecurring}
      />

      <PayRecurringModal
        isOpen={isPayRecurringModalOpen}
        onClose={() => setIsPayRecurringModalOpen(false)}
        selectedRecurringToPay={selectedRecurringToPay}
        recPayAmount={recPayAmount}
        setRecPayAmount={setRecPayAmount}
        recPayDate={recPayDate}
        setRecPayDate={setRecPayDate}
        onSubmit={handleConfirmPayRecurring}
      />

      <DebtFormModal
        isOpen={isNewDebtModalOpen}
        onClose={() => setIsNewDebtModalOpen(false)}
        editingDebtId={editingDebtId}
        newDebtTitle={newDebtTitle}
        setNewDebtTitle={setNewDebtTitle}
        newDebtInitial={newDebtInitial}
        setNewDebtInitial={setNewDebtInitial}
        newDebtRemaining={newDebtRemaining}
        setNewDebtRemaining={setNewDebtRemaining}
        newDebtPayment={newDebtPayment}
        setNewDebtPayment={setNewDebtPayment}
        newDebtDay={newDebtDay}
        setNewDebtDay={setNewDebtDay}
        newDebtIcon={newDebtIcon}
        setNewDebtIcon={setNewDebtIcon}
        newDebtIsRegular={newDebtIsRegular}
        setNewDebtIsRegular={setNewDebtIsRegular}
        onSubmit={handleCreateDebt}
      />

      <PayDebtModal
        isOpen={isPayDebtModalOpen}
        onClose={() => setIsPayDebtModalOpen(false)}
        activeDebt={debts.find(d => d.id === selectedDebtId)}
        debtSourceAccount={debtSourceAccount}
        setDebtSourceAccount={setDebtSourceAccount}
        debtSourceAuthor={debtSourceAuthor}
        setDebtSourceAuthor={setDebtSourceAuthor}
        debtPayAmount={debtPayAmount}
        setDebtPayAmount={setDebtPayAmount}
        debtPayDate={debtPayDate}
        setDebtPayDate={setDebtPayDate}
        userProfiles={safeProfiles}
        onSubmit={handlePayDebtSubmit}
      />

      <ProfileEditModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userProfiles={safeProfiles}
        onSaveProfiles={setUserProfiles}
        deviceOwner={deviceOwner}
        onSaveDeviceOwner={(owner) => {
          setDeviceOwner(owner);
          setCurrentUser(owner);
          setActiveWalletCard(owner);
        }}
      />

      <SafeLimitConfigModal
        isOpen={isLimitModalOpen}
        onClose={() => setIsLimitModalOpen(false)}
        config={safeLimitConfig}
        onSaveConfig={(newConfig) => {
          setSafeLimitConfig(newConfig);
          saveToStorage('family_budget_limit_config', newConfig);
          showToast('Горизонт безопасного лимита обновлен');
        }}
        currentSafeBalance={stats.safeBalance}
      />

      <ExportBackupModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        importMode={importMode}
        setImportMode={setImportMode}
        onDownloadXlsx={handleDownloadXlsx}
        onDownloadCsv={handleDownloadCsv}
        onCopyAiReport={handleCopyAiReport}
        onDownloadJson={handleDownloadJson}
        onImportFile={handleImportFile}
        onClearAllData={handleClearAllData}
        onRestoreDemoData={handleRestoreDemoData}
      />
    </div>
  );
}
