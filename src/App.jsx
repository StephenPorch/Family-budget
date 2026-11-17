import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Wallet, Plus, User, X,
  ChevronRight, ChevronLeft, RotateCcw, LayoutGrid,
  ListOrdered, Target, ShieldCheck, FileSpreadsheet, RefreshCw
} from 'lucide-react';

import {
  getLocalDateString,
  getCurrentMonthPrefix,
  getTargetDateForMonth,
  MONTH_NAMES_SHORT,
  formatMonthTitle,
  formatDateGroupHeader,
} from './utils/dateUtils.js';

import {
  APP_VERSION,
  hasStoredKey,
  loadFromStorage,
  saveToStorage,
  INITIAL_TRANSACTIONS,
  INITIAL_GOALS,
  INITIAL_RECURRING,
  INITIAL_DEBTS,
  INITIAL_USER_PROFILES,
  EMPTY_USER_PROFILES,
  DEFAULT_EXPENSE_CATEGORIES,
  GOAL_COLOR_PRESETS,
  DEFAULT_SAFE_LIMIT_CONFIG,
} from './utils/storage.js';

import {
  getCategoryMeta,
  isSavingsOrDebtTx,
  isTransactionTypeLocked,
  getRecurringReminderStatus,
  calculatePartnerComparison,
  calculateHorizonDays,
  getWalletKeyFromTx,
  calculateWalletBalancesWithTransfers,
  calculateSafeDailyBudget,
} from './utils/financeCore.js';

import {
  buildBudgetXlsxBytes,
  buildStructuredCsvString,
  buildJsonBackupPayload,
  buildAiPromptReport,
  parseImportedBackupContent,
} from './utils/exportImport.js';

import { DashboardTab } from './components/tabs/DashboardTab.jsx';
import { HistoryTab } from './components/tabs/HistoryTab.jsx';
import { GoalsTab } from './components/tabs/GoalsTab.jsx';
import { DebtsPlanTab } from './components/tabs/DebtsPlanTab.jsx';
import { TransactionModal } from './components/modals/TransactionModal.jsx';
import { OnboardingModal } from './components/modals/OnboardingModal.jsx';
import { ExportBackupModal } from './components/modals/ExportBackupModal.jsx';
import { FamilySyncModal } from './components/modals/FamilySyncModal.jsx';
import {
  ensureCollectionTimestamps,
  touchItemTimestamp,
  pruneOldTombstones,
  recordDeletionTombstone,
  removeDeletionTombstone,
  mergeSyncPayload,
  decodePairingPayload,
} from './utils/deltaSync.js';
import {
  isValidGasWebhookUrl,
  testGasWebhookConnection,
  syncWithGasWebhook,
} from './utils/gasSyncTransport.js';
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
  // Флаг прохождения стартовой настройки (чистый первый запуск без подмены демо-чеками)
  const [isOnboarded, setIsOnboarded] = useState(() => {
    const saved = loadFromStorage('family_budget_onboarded', null);
    if (saved !== null) return Boolean(saved);
    return (
      hasStoredKey('family_budget_txs') ||
      hasStoredKey('family_budget_goals') ||
      hasStoredKey('family_budget_debts') ||
      hasStoredKey('family_budget_recurring')
    );
  });
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

  // Профили пользователей и владелец устройства (Personal-First)
  const [userProfiles, setUserProfiles] = useState(() => {
    const loaded = loadFromStorage('family_budget_profiles', EMPTY_USER_PROFILES);
    if (loaded && typeof loaded === 'object' && loaded.husband && loaded.wife) {
      return loaded;
    }
    return EMPTY_USER_PROFILES;
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
    return EMPTY_USER_PROFILES;
  }, [userProfiles]);

  // Вид аналитических графиков на вкладке «Обзор»: 'burndown' | 'rule503020' | 'dynamics' | 'partners'
  const [chartView, setChartView] = useState('burndown');

  // Хранилища состояния (на чистом первом запуске — пустая база, демо загружается по явному выбору)
  const [transactions, setTransactions] = useState(() =>
    ensureCollectionTimestamps(loadFromStorage('family_budget_txs', []))
  );
  const [goals, setGoals] = useState(() =>
    ensureCollectionTimestamps(loadFromStorage('family_budget_goals', []))
  );
  const [recurringPayments, setRecurringPayments] = useState(() =>
    ensureCollectionTimestamps(loadFromStorage('family_budget_recurring', []))
  );
  const [debts, setDebts] = useState(() =>
    ensureCollectionTimestamps(loadFromStorage('family_budget_debts', []))
  );
  const [customCategories, setCustomCategories] = useState(() =>
    ensureCollectionTimestamps(loadFromStorage('family_budget_custom_categories', []))
  );
  const [plannedCategoryLimits, setPlannedCategoryLimits] = useState(() =>
    loadFromStorage('family_budget_planned_limits', {})
  );

  // Состояние семейной синхронизации (FB-10)
  const [syncConfig, setSyncConfig] = useState(() =>
    loadFromStorage('family_budget_sync_config', { webhookUrl: '', syncSecret: '' })
  );
  const [lastSyncAt, setLastSyncAt] = useState(() =>
    loadFromStorage('family_budget_last_sync_at', null)
  );
  const [lastMutationAt, setLastMutationAt] = useState(() =>
    loadFromStorage('family_budget_last_mutation_at', null)
  );
  const [syncTombstones, setSyncTombstones] = useState(() =>
    pruneOldTombstones(loadFromStorage('family_budget_sync_tombstones', []))
  );
  const [settingsSyncMeta, setSettingsSyncMeta] = useState(() =>
    loadFromStorage('family_budget_settings_sync_meta', { plannedCategoryLimits: {} })
  );
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [pendingIncomingPair, setPendingIncomingPair] = useState(null);
  const [pendingIncomingDeltaToken, setPendingIncomingDeltaToken] = useState('');

  const isSyncConfigured = useMemo(
    () => isValidGasWebhookUrl(syncConfig?.webhookUrl) && String(syncConfig?.syncSecret || '').trim().length >= 4,
    [syncConfig]
  );

  const hasUnsyncedChanges = useMemo(() => {
    if (!lastMutationAt) return false;
    if (!lastSyncAt) return true;
    const mutMs = Date.parse(lastMutationAt);
    const syncMs = Date.parse(lastSyncAt);
    if (!Number.isFinite(mutMs) || !Number.isFinite(syncMs)) return true;
    return mutMs > syncMs;
  }, [lastMutationAt, lastSyncAt]);

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
  const storageWarnedRef = useRef(false);

  const showToast = useCallback((message, onUndo = null, actionLabel = 'Вернуть') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, onUndo, actionLabel });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 6000);
  }, []);

  const handleStorageQuotaError = useCallback(() => {
    if (storageWarnedRef.current) return;
    storageWarnedRef.current = true;
    showToast('⚠️ Память браузера переполнена или недоступна. Сохраните JSON-бэкап!');
  }, [showToast]);

  // Сохранение в LocalStorage с защитой от переполнения квоты
  useEffect(() => {
    saveToStorage('family_budget_onboarded', isOnboarded, handleStorageQuotaError);
  }, [isOnboarded, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_txs', transactions, handleStorageQuotaError);
  }, [transactions, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_goals', goals, handleStorageQuotaError);
  }, [goals, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_recurring', recurringPayments, handleStorageQuotaError);
  }, [recurringPayments, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_debts', debts, handleStorageQuotaError);
  }, [debts, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_profiles', userProfiles, handleStorageQuotaError);
  }, [userProfiles, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_device_owner', deviceOwner, handleStorageQuotaError);
  }, [deviceOwner, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_limit_config', safeLimitConfig, handleStorageQuotaError);
  }, [safeLimitConfig, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_custom_categories', customCategories, handleStorageQuotaError);
  }, [customCategories, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_planned_limits', plannedCategoryLimits, handleStorageQuotaError);
  }, [plannedCategoryLimits, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_sync_config', syncConfig, handleStorageQuotaError);
  }, [syncConfig, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_last_sync_at', lastSyncAt, handleStorageQuotaError);
  }, [lastSyncAt, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_last_mutation_at', lastMutationAt, handleStorageQuotaError);
  }, [lastMutationAt, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_sync_tombstones', syncTombstones, handleStorageQuotaError);
  }, [syncTombstones, handleStorageQuotaError]);

  useEffect(() => {
    saveToStorage('family_budget_settings_sync_meta', settingsSyncMeta, handleStorageQuotaError);
  }, [settingsSyncMeta, handleStorageQuotaError]);

  // Перехват входящей ссылки подключения (?pair=...) или P2P-дельты (?sync=...) при открытии URL
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location?.search) return;
    const params = new URLSearchParams(window.location.search);
    const pairRaw = params.get('pair');
    const syncRaw = params.get('sync');
    if (!pairRaw && !syncRaw) return;

    if (pairRaw) {
      try {
        const pair = decodePairingPayload(pairRaw);
        setPendingIncomingPair(pair);
        setIsSyncModalOpen(true);
      } catch (err) {
        showToast(err?.message || 'Не удалось прочитать ссылку подключения');
      }
    }
    if (syncRaw) {
      setPendingIncomingDeltaToken(syncRaw);
      setIsSyncModalOpen(true);
    }

    params.delete('pair');
    params.delete('sync');
    const qs = params.toString();
    const cleanUrl = `${window.location.pathname}${qs ? '?' + qs : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }, [showToast]);

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
        setIsOnboardingModalOpen(false);
        setIsSyncModalOpen(false);
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

  const partnerComparisonData = useMemo(() => {
    return calculatePartnerComparison(transactions, safeProfiles, selectedMonth);
  }, [transactions, safeProfiles, selectedMonth]);

  // ================= АНАЛИЗ ПРОШЛЫХ МЕСЯЦЕВ И ПРОГНОЗ РАСХОДОВ =================
  const expenseForecastData = useMemo(() => {
    const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;

    const pastMonthsSet = new Set();
    const historyByCatAndMonth = {};

    transactions.forEach(t => {
      if (t.type !== 'expense' || isSavingsOrDebtTx(t) || t.isOpeningBalance) return;
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
      if (t.type !== 'expense' || isSavingsOrDebtTx(t) || t.isOpeningBalance) return;
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

  // ================= ФИНАНСОВОЕ МАТЕМАТИЧЕСКОЕ ЯДРО (через financeCore.js) =================
  const stats = useMemo(() => {
    const walletBalances = calculateWalletBalancesWithTransfers(transactions, endOfSelectedMonth);

    const shared = {
      income: walletBalances.shared.income + walletBalances.shared.transferIn,
      expense: walletBalances.shared.expense + walletBalances.shared.transferOut,
      balance: walletBalances.shared.balance,
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
      income: walletBalances.husband.income + walletBalances.husband.transferIn,
      expense: walletBalances.husband.expense + walletBalances.husband.transferOut,
      balance: walletBalances.husband.balance,
      monthIncome: 0,
      monthExpense: 0,
      savedAndDebtPaid: 0,
    };

    const wifePersonal = {
      income: walletBalances.wife.income + walletBalances.wife.transferIn,
      expense: walletBalances.wife.expense + walletBalances.wife.transferOut,
      balance: walletBalances.wife.balance,
      monthIncome: 0,
      monthExpense: 0,
      savedAndDebtPaid: 0,
    };

    const categoryTotals = {};
    const prevCategoryTotals = {};

    periodTransactions.forEach(t => {
      if (t.isOpeningBalance) return;
      const val = Number(t.amount) || 0;
      if (t.type === 'transfer') {
        const fromW = getWalletKeyFromTx(t);
        const toW = (t.transferTo === 'shared' || t.transferTo === 'husband' || t.transferTo === 'wife')
          ? t.transferTo
          : (fromW === 'shared' ? 'husband' : 'shared');
        if (fromW !== toW) {
          if (toW === 'shared') {
            shared.monthIncome += val;
            if (fromW === 'husband') shared.husbandIncome += val;
            if (fromW === 'wife') shared.wifeIncome += val;
          } else if (toW === 'husband') {
            husbandPersonal.monthIncome += val;
          } else if (toW === 'wife') {
            wifePersonal.monthIncome += val;
          }

          if (fromW === 'shared') {
            shared.monthExpense += val;
          } else if (fromW === 'husband') {
            husbandPersonal.monthExpense += val;
          } else if (fromW === 'wife') {
            wifePersonal.monthExpense += val;
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
      if (t.isOpeningBalance) return;
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
    const todayStr = getLocalDateString(today);
    const hasSalaryToday = transactions.some(t => {
      if (t.date !== todayStr || t.isOpeningBalance) return false;
      if (t.type === 'income') {
        const wKey = getWalletKeyFromTx(t);
        return wKey === activeWalletCard || activeWalletCard === 'shared';
      }
      if (t.type === 'transfer') {
        return t.transferTo === activeWalletCard;
      }
      return false;
    });

    const currentYm = getCurrentMonthPrefix();
    const isPastMonth = selectedMonth !== 'all' && selectedMonth < currentYm;
    let daysLeft = 1;
    let daysInMonth = 30;
    let daysHorizonLabel = 'до конца месяца';

    if (selectedMonth !== 'all') {
      const [y, m] = selectedMonth.split('-').map(Number);
      daysInMonth = new Date(y, m, 0).getDate();
      if (selectedMonth === currentYm) {
        const horizon = calculateHorizonDays(safeLimitConfig, today, { waitForSalaryOnPayday: true, hasSalaryToday });
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
      const horizon = calculateHorizonDays(safeLimitConfig, today, { waitForSalaryOnPayday: true, hasSalaryToday });
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

    const safeBudgetResult = calculateSafeDailyBudget({
      activeBalance,
      unpaidMandatoryTotal: reserveToDeduct,
      unpaidRecommendedTotal: 0,
      deductMandatory: !isPastMonth,
      deductRecommended: false,
      daysLeft,
      isPastMonth,
    });

    const {
      rawSafeBalance,
      hasCashGap,
      cashGapAmount,
      safeBalance,
      dailyAvailable,
    } = safeBudgetResult;

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

  const isEditingLockedType = useMemo(() => {
    return isTransactionTypeLocked(editingTransactionObj);
  }, [editingTransactionObj]);

  // Хелперы и обработчики синхронизации (FB-10)
  const markMutated = useCallback((iso = new Date().toISOString()) => {
    setLastMutationAt(iso);
    return iso;
  }, []);

  const localSyncState = useMemo(() => ({
    transactions,
    goals,
    recurringPayments,
    debts,
    customCategories,
    syncTombstones,
    userProfiles: safeProfiles,
    safeLimitConfig,
    plannedCategoryLimits,
    settingsSyncMeta,
  }), [
    transactions,
    goals,
    recurringPayments,
    debts,
    customCategories,
    syncTombstones,
    safeProfiles,
    safeLimitConfig,
    plannedCategoryLimits,
    settingsSyncMeta,
  ]);

  const applyMergedSyncState = useCallback((nextState) => {
    if (!nextState) return;
    setTransactions(nextState.transactions || []);
    setGoals(nextState.goals || []);
    setRecurringPayments(nextState.recurringPayments || []);
    setDebts(nextState.debts || []);
    setCustomCategories(nextState.customCategories || []);
    setSyncTombstones(nextState.syncTombstones || []);
    if (nextState.userProfiles) setUserProfiles(nextState.userProfiles);
    if (nextState.safeLimitConfig) setSafeLimitConfig(nextState.safeLimitConfig);
    if (nextState.plannedCategoryLimits) setPlannedCategoryLimits(nextState.plannedCategoryLimits);
    if (nextState.settingsSyncMeta) setSettingsSyncMeta(nextState.settingsSyncMeta);
    if (!isOnboarded && (
      (nextState.transactions && nextState.transactions.length > 0) ||
      (nextState.goals && nextState.goals.length > 0) ||
      (nextState.recurringPayments && nextState.recurringPayments.length > 0) ||
      (nextState.debts && nextState.debts.length > 0)
    )) {
      setIsOnboarded(true);
    }
  }, [isOnboarded]);

  const handleRunCloudSync = useCallback(async (overrideConfig = null) => {
    const activeCfg = overrideConfig && overrideConfig.webhookUrl ? overrideConfig : syncConfig;
    if (!isValidGasWebhookUrl(activeCfg?.webhookUrl) || String(activeCfg?.syncSecret || '').trim().length < 4) {
      setIsSyncModalOpen(true);
      return;
    }

    setIsSyncing(true);
    setSyncError('');
    try {
      // Перекрытие 2 минуты страхует от мелкого расхождения часов устройств при ручной синхронизации
      const sinceCursor = lastSyncAt
        ? new Date(Math.max(0, Date.parse(lastSyncAt) - 120000)).toISOString()
        : null;
      const res = await syncWithGasWebhook({
        webhookUrl: activeCfg.webhookUrl,
        syncSecret: activeCfg.syncSecret,
        localState: localSyncState,
        lastSyncAt: sinceCursor,
      });

      let changedCount = 0;
      if (res?.delta) {
        const merged = mergeSyncPayload(localSyncState, res.delta);
        applyMergedSyncState(merged.nextState);
        changedCount = merged.stats.totalChanged || 0;
      }

      setLastSyncAt(res?.serverTime || new Date().toISOString());
      setLastMutationAt(null);
      showToast(
        changedCount > 0
          ? `Синхронизация завершена: обновлено записей — ${changedCount}`
          : 'Синхронизация завершена: все данные актуальны'
      );
    } catch (err) {
      const msg = err?.message || 'Ошибка синхронизации с Google Таблицей';
      setSyncError(msg);
      showToast(`⚠️ ${msg}`);
    } finally {
      setIsSyncing(false);
    }
  }, [syncConfig, lastSyncAt, localSyncState, applyMergedSyncState, showToast]);

  const handleTestCloudConnection = useCallback(async (cfg) => {
    return testGasWebhookConnection(cfg);
  }, []);

  const handleApplyDecodedDelta = useCallback((remoteDelta) => {
    const merged = mergeSyncPayload(localSyncState, remoteDelta);
    applyMergedSyncState(merged.nextState);
    const s = merged.stats;
    showToast(
      s.totalChanged > 0
        ? `Применено: +${s.added} нов., ${s.updated} обнов., ${s.deleted} удал.`
        : 'Данные уже совпадают (изменений нет)'
    );
  }, [localSyncState, applyMergedSyncState, showToast]);

  // Создание пользовательской категории
  const handleCreateCustomCategory = useCallback(({ name, icon, type, bucket }) => {
    const nowIso = markMutated();
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
          updatedAt: nowIso,
        },
      ];
    });
    showToast(`Категория «${name}» добавлена`);
  }, [markMutated, showToast]);

  const handleDeleteCustomCategory = useCallback((e, catId) => {
    e?.stopPropagation();
    const cat = customCategories.find(c => c.id === catId);
    if (!cat) return;

    const nowIso = markMutated();
    setCustomCategories(prev => prev.filter(c => c.id !== catId));
    setSyncTombstones(prev => recordDeletionTombstone(prev, 'customCategories', catId, nowIso));
    showToast(`Категория «${cat.name}» удалена`, () => {
      const undoIso = markMutated();
      setCustomCategories(prev => [...prev, touchItemTimestamp(cat, undoIso)]);
      setSyncTombstones(prev => removeDeletionTombstone(prev, 'customCategories', catId));
      setToast(null);
    });
  }, [customCategories, markMutated, showToast]);

  // Сохранение (добавление или редактирование) транзакции
  const handleSaveTransaction = useCallback((payload) => {
    const { id, amount: num, title: finalTitle, type: txType, category: selectedCategory, account: selectedAccount, author: txAuthor, fromWallet, transferTo, isOpeningBalance, date: finalDate, stayOpen } = payload;
    const nowIso = markMutated();

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
                ...(txType === 'transfer'
                  ? { fromWallet: fromWallet || (selectedAccount === 'shared' ? 'shared' : txAuthor), transferTo: transferTo || 'shared', isOpeningBalance: undefined }
                  : { fromWallet: undefined, transferTo: undefined, isOpeningBalance: locked ? t.isOpeningBalance : (isOpeningBalance ? true : undefined) }),
                date: finalDate,
                updatedAt: nowIso,
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
              ? { ...g, current: Math.max(0, (Number(g.current) || 0) + signedDiff), updatedAt: nowIso }
              : g
          )
        );
      }

      if (oldTx && oldTx.debtId && oldTx.amount !== num) {
        const diff = num - (Number(oldTx.amount) || 0);
        setDebts(prev =>
          prev.map(d =>
            d.id === oldTx.debtId
              ? { ...d, remainingAmount: Math.max(0, (Number(d.remainingAmount) || 0) - diff), updatedAt: nowIso }
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
                      updatedAt: nowIso,
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
                      updatedAt: nowIso,
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
        ...(txType !== 'transfer' && isOpeningBalance ? { isOpeningBalance: true } : {}),
        date: finalDate,
        updatedAt: nowIso,
      };
      setTransactions(prev => [newTx, ...prev]);
      if (!isOnboarded) setIsOnboarded(true);

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
  }, [transactions, selectedMonth, isOnboarded, markMutated, showToast]);

  // Удаление транзакции с мягким Undo-тостом и откатом копилки / долга
  const handleDeleteTransaction = useCallback((id, e) => {
    e?.stopPropagation();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return;
    const tx = transactions[index];
    const nowIso = markMutated();

    setTransactions(prev => prev.filter(t => t.id !== id));
    setSyncTombstones(prev => recordDeletionTombstone(prev, 'transactions', id, nowIso));

    if (tx.goalId) {
      const delta = tx.type === 'income' ? (Number(tx.amount) || 0) : -(Number(tx.amount) || 0);
      setGoals(prev =>
        prev.map(g =>
          g.id === tx.goalId
            ? { ...g, current: Math.max(0, (Number(g.current) || 0) + delta), updatedAt: nowIso }
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
                updatedAt: nowIso,
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
                updatedAt: nowIso,
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
      const undoIso = markMutated();
      setTransactions(prev => {
        const copy = [...prev];
        copy.splice(index, 0, touchItemTimestamp(tx, undoIso));
        return copy;
      });
      setSyncTombstones(prev => removeDeletionTombstone(prev, 'transactions', id));

      if (tx.goalId) {
        const restoreDelta = tx.type === 'income' ? -(Number(tx.amount) || 0) : (Number(tx.amount) || 0);
        setGoals(prev =>
          prev.map(g =>
            g.id === tx.goalId
              ? { ...g, current: Math.max(0, (Number(g.current) || 0) + restoreDelta), updatedAt: undoIso }
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
                  updatedAt: undoIso,
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
              ? { ...r, paidMonths: Array.from(new Set([...(r.paidMonths || []), txMonth])), updatedAt: undoIso }
              : r
          )
        );
      }

      setToast(null);
    });
  }, [transactions, editingTxId, markMutated, showToast]);

  // Пополнение или вывод средств из копилки
  const handleContributeGoal = (e) => {
    e?.preventDefault();
    const num = parseFloat(goalAmount);
    if (!num || num <= 0 || !selectedGoalId) return;

    const targetGoal = goals.find(g => g.id === selectedGoalId);
    if (!targetGoal) return;

    const nowIso = markMutated();
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
              updatedAt: nowIso,
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
      updatedAt: nowIso,
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

  const openEditGoalModal = useCallback((e, goal) => {
    e?.stopPropagation();
    setEditingGoalId(goal.id);
    setNewGoalTitle(goal.title);
    setNewGoalTarget(String(goal.target));
    setNewGoalCurrent(String(goal.current));
    setNewGoalIcon(goal.icon || '🎯');
    setNewGoalColor(goal.color || GOAL_COLOR_PRESETS[0].value);
    setIsNewGoalModalOpen(true);
  }, []);

  const handleCreateGoal = (e) => {
    e?.preventDefault();
    const targetNum = parseFloat(newGoalTarget);
    if (!newGoalTitle.trim() || !targetNum || targetNum <= 0) return;
    const currentNum = Math.max(0, parseFloat(newGoalCurrent) || 0);
    const nowIso = markMutated();

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
                updatedAt: nowIso,
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
        updatedAt: nowIso,
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

  const handleDeleteGoal = useCallback((e, goalId) => {
    e?.stopPropagation();
    const idx = goals.findIndex(item => item.id === goalId);
    if (idx === -1) return;
    const g = goals[idx];
    const affectedTxIds = transactions.filter(t => t.goalId === goalId).map(t => t.id);
    const nowIso = markMutated();

    setGoals(prev => prev.filter(item => item.id !== goalId));
    setSyncTombstones(prev => recordDeletionTombstone(prev, 'goals', goalId, nowIso));
    setTransactions(prev => prev.map(t => (t.goalId === goalId ? { ...t, goalId: undefined, updatedAt: nowIso } : t)));
    if (selectedGoalId === goalId) setSelectedGoalId(null);

    showToast(`Цель «${g.title}» удалена`, () => {
      const undoIso = markMutated();
      setGoals(prev => {
        const copy = [...prev];
        copy.splice(idx, 0, touchItemTimestamp(g, undoIso));
        return copy;
      });
      setSyncTombstones(prev => removeDeletionTombstone(prev, 'goals', goalId));
      setTransactions(prev =>
        prev.map(t => (affectedTxIds.includes(t.id) ? { ...t, goalId: goalId, updatedAt: undoIso } : t))
      );
      setToast(null);
    });
  }, [goals, transactions, selectedGoalId, markMutated, showToast]);

  const openPayRecurringModal = useCallback((rec) => {
    setSelectedRecurringToPay(rec);
    setRecPayAmount(String(rec.amount || ''));
    setRecPayDate(getTargetDateForMonth(selectedMonth, rec.dueDate));
    setIsPayRecurringModalOpen(true);
  }, [selectedMonth]);

  const handleConfirmPayRecurring = (e) => {
    e?.preventDefault();
    if (!selectedRecurringToPay) return;
    const rec = selectedRecurringToPay;
    const num = parseFloat(recPayAmount);
    if (!num || num <= 0) return;

    const nowIso = markMutated();
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
      updatedAt: nowIso,
    };

    setRecurringPayments(prev =>
      prev.map(r =>
        r.id === rec.id
          ? { ...r, paidMonths: Array.from(new Set([...(r.paidMonths || []), targetYm])), updatedAt: nowIso }
          : r
      )
    );

    setTransactions(prev => [newTx, ...prev]);
    setIsPayRecurringModalOpen(false);
    setSelectedRecurringToPay(null);

    showToast(`Платеж «${rec.title}» оплачен (${num.toLocaleString('ru-RU')} ₽ за ${finalDate})`, () => {
      const undoIso = markMutated();
      setSyncTombstones(tPrev => recordDeletionTombstone(tPrev, 'transactions', newTx.id, undoIso));
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
                  updatedAt: undoIso,
                }
              : r
          )
        );
        return remaining;
      });
      setToast(null);
    });
  };

  const openEditRecurringModal = useCallback((e, rec) => {
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
  }, []);

  const handleCreateRecurring = (e) => {
    e?.preventDefault();
    const num = parseFloat(newRecAmount);
    if (!newRecTitle.trim() || !num || num <= 0) return;
    const due = Math.min(31, Math.max(1, parseInt(newRecDueDate, 10) || 1));
    const nowIso = markMutated();

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
                updatedAt: nowIso,
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
        updatedAt: nowIso,
      };
      setRecurringPayments(prev => [...prev, newRec]);
      showToast(`Постоянный расход «${newRec.title}» добавлен`);
    }

    setEditingRecurringId(null);
    setNewRecTitle('');
    setNewRecAmount('');
    setIsNewRecurringModalOpen(false);
  };

  const handleDeleteRecurring = useCallback((e, recId) => {
    e?.stopPropagation();
    const idx = recurringPayments.findIndex(r => r.id === recId);
    if (idx === -1) return;
    const rec = recurringPayments[idx];
    const affectedTxIds = transactions.filter(t => t.recurringId === recId).map(t => t.id);
    const nowIso = markMutated();

    setRecurringPayments(prev => prev.filter(r => r.id !== recId));
    setSyncTombstones(prev => recordDeletionTombstone(prev, 'recurringPayments', recId, nowIso));
    setTransactions(prev => prev.map(t => (t.recurringId === recId ? { ...t, recurringId: undefined, updatedAt: nowIso } : t)));

    showToast(`Платеж «${rec.title}» удален`, () => {
      const undoIso = markMutated();
      setRecurringPayments(prev => {
        const copy = [...prev];
        copy.splice(idx, 0, touchItemTimestamp(rec, undoIso));
        return copy;
      });
      setSyncTombstones(prev => removeDeletionTombstone(prev, 'recurringPayments', recId));
      setTransactions(prev =>
        prev.map(t => (affectedTxIds.includes(t.id) ? { ...t, recurringId: recId, updatedAt: undoIso } : t))
      );
      setToast(null);
    });
  }, [recurringPayments, transactions, markMutated, showToast]);

  const handlePayDebtSubmit = (e) => {
    e?.preventDefault();
    const num = parseFloat(debtPayAmount);
    if (!num || num <= 0 || !selectedDebtId) return;

    const debt = debts.find(d => d.id === selectedDebtId);
    if (!debt) return;

    const nowIso = markMutated();
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
      updatedAt: nowIso,
    };

    setDebts(prev =>
      prev.map(d =>
        d.id === debt.id
          ? {
              ...d,
              remainingAmount: Math.max(0, (Number(d.remainingAmount) || 0) - num),
              paidMonths: Array.from(new Set([...(d.paidMonths || []), targetYm])),
              updatedAt: nowIso,
            }
          : d
      )
    );

    setTransactions(prev => [newTx, ...prev]);
    setDebtPayAmount('');
    setIsPayDebtModalOpen(false);

    showToast(`Внесен платёж ${num.toLocaleString('ru-RU')} ₽ по долгу «${debt.title}»`, () => {
      const undoIso = markMutated();
      setSyncTombstones(tPrev => recordDeletionTombstone(tPrev, 'transactions', newTx.id, undoIso));
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
                  updatedAt: undoIso,
                }
              : d
          )
        );
        return remaining;
      });
      setToast(null);
    });
  };

  const openPayDebtModal = useCallback((debt) => {
    setSelectedDebtId(debt.id);
    const defAmt = (Number(debt.monthlyPayment) > 0) ? debt.monthlyPayment : Math.min(5000, Number(debt.remainingAmount) || 0);
    setDebtPayAmount(String(defAmt || ''));
    setDebtSourceAccount(debt.account || 'shared');
    setDebtSourceAuthor(debt.author || currentUser);
    setDebtPayDate(getTargetDateForMonth(selectedMonth, debt.paymentDay));
    setIsPayDebtModalOpen(true);
  }, [currentUser, selectedMonth]);

  const openEditDebtModal = useCallback((e, debt) => {
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
  }, []);

  const handleCreateDebt = (e) => {
    e?.preventDefault();
    const initNum = parseFloat(newDebtInitial);
    if (!newDebtTitle.trim() || !initNum || initNum <= 0) return;
    const rawRem = newDebtRemaining !== '' ? parseFloat(newDebtRemaining) : initNum;
    const remNum = Math.min(initNum, Math.max(0, Number.isFinite(rawRem) ? rawRem : initNum));
    const isReg = Boolean(newDebtIsRegular);
    const payNum = isReg ? (parseFloat(newDebtPayment) || Math.round(initNum / 12)) : 0;
    const payDay = Math.min(31, Math.max(1, parseInt(newDebtDay, 10) || 10));
    const nowIso = markMutated();

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
                updatedAt: nowIso,
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
        updatedAt: nowIso,
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

  const handleDeleteDebt = useCallback((e, debtId) => {
    e?.stopPropagation();
    const idx = debts.findIndex(d => d.id === debtId);
    if (idx === -1) return;
    const debt = debts[idx];
    const affectedTxIds = transactions.filter(t => t.debtId === debtId).map(t => t.id);
    const nowIso = markMutated();

    setDebts(prev => prev.filter(d => d.id !== debtId));
    setSyncTombstones(prev => recordDeletionTombstone(prev, 'debts', debtId, nowIso));
    setTransactions(prev => prev.map(t => (t.debtId === debtId ? { ...t, debtId: undefined, updatedAt: nowIso } : t)));
    if (selectedDebtId === debtId) setSelectedDebtId(null);

    showToast(`Кредит «${debt.title}» удален`, () => {
      const undoIso = markMutated();
      setDebts(prev => {
        const copy = [...prev];
        copy.splice(idx, 0, touchItemTimestamp(debt, undoIso));
        return copy;
      });
      setSyncTombstones(prev => removeDeletionTombstone(prev, 'debts', debtId));
      setTransactions(prev =>
        prev.map(t => (affectedTxIds.includes(t.id) ? { ...t, debtId: debtId, updatedAt: undoIso } : t))
      );
      setToast(null);
    });
  }, [debts, transactions, selectedDebtId, markMutated, showToast]);

  const handleApplyAutoForecastLimits = useCallback(() => {
    const nowIso = markMutated();
    const nextLimits = { ...plannedCategoryLimits };
    const updatedCats = [];
    expenseForecastData.rows.forEach(r => {
      if (r.autoSuggested > 0) {
        nextLimits[r.category] = r.autoSuggested;
        updatedCats.push(r.category);
      }
    });
    setPlannedCategoryLimits(nextLimits);
    if (updatedCats.length > 0) {
      setSettingsSyncMeta(prev => {
        const nextLimitsMeta = { ...(prev?.plannedCategoryLimits || {}) };
        updatedCats.forEach(cat => {
          nextLimitsMeta[cat] = { updatedAt: nowIso, deleted: false };
        });
        return { ...prev, plannedCategoryLimits: nextLimitsMeta };
      });
    }
    showToast('Плановые лимиты заполнены на основе анализа прошлых месяцев');
  }, [plannedCategoryLimits, expenseForecastData, markMutated, showToast]);

  const handleSaveCategoryLimit = useCallback((categoryName) => {
    const val = parseFloat(editingPlanValue);
    const isDeleted = !Number.isFinite(val) || val <= 0;
    const nowIso = markMutated();
    setPlannedCategoryLimits(prev => {
      const next = { ...prev };
      if (isDeleted) {
        delete next[categoryName];
      } else {
        next[categoryName] = Math.round(val);
      }
      return next;
    });
    setSettingsSyncMeta(prev => ({
      ...prev,
      plannedCategoryLimits: {
        ...(prev?.plannedCategoryLimits || {}),
        [categoryName]: { updatedAt: nowIso, deleted: isDeleted },
      },
    }));
    setEditingPlanCategory(null);
    setEditingPlanValue('');
    showToast(`План для «${categoryName}» сохранен`);
  }, [editingPlanValue, markMutated, showToast]);

  // ================= ЭКСПОРТ И ИМПОРТ (делегировано в exportImport.js) =================
  const handleDownloadXlsx = () => {
    const xlsxBytes = buildBudgetXlsxBytes({
      selectedMonth,
      stats,
      pendingBillsCount,
      transactions,
      expenseForecastData,
      recurringPayments,
      goals,
      debts,
      safeProfiles,
    });

    const blob = new Blob([xlsxBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-budget-v${APP_VERSION}-${getLocalDateString()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Выгружен многостраничный Excel (.xlsx) с 5 листами аналитики и операций');
  };

  const handleDownloadCsv = () => {
    const csvContent = buildStructuredCsvString({
      selectedMonth,
      activeWalletCard,
      stats,
      expenseForecastData,
      recurringPayments,
      debts,
      goals,
      customCategories,
      transactions,
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-budget-v${APP_VERSION}-backup-${getLocalDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Выгружен универсальный CSV (открывается в Excel и подходит для полного восстановления бэкапа)');
  };

  const handleDownloadJson = () => {
    const payload = buildJsonBackupPayload({
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
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-budget-v${APP_VERSION}-backup-${getLocalDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Полный JSON-бэкап сохранен');
  };

  const handleCopyAiReport = () => {
    const text = buildAiPromptReport({
      selectedMonth,
      stats,
      expenseForecastData,
      recurringPayments,
      debts,
      goals,
      periodTransactions,
      safeProfiles,
    });
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
      userProfiles,
      deviceOwner,
      safeLimitConfig,
      syncTombstones,
      settingsSyncMeta,
    };

    const isMerge = importMode === 'merge';
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = String(evt.target?.result || '');
        const result = parseImportedBackupContent({
          content,
          fileName: file.name,
          isMerge,
          currentState: prevSnapshot,
        });

        if (!result.ok) {
          showToast(result.message);
          return;
        }

        const ns = result.nextState || {};
        const nowIso = markMutated();
        const stampImported = (nextList, prevList) => {
          const prevIds = new Set((prevList || []).map(item => String(item.id)));
          return ensureCollectionTimestamps(nextList).map(item =>
            (!isMerge || !prevIds.has(String(item.id))) ? touchItemTimestamp(item, nowIso) : item
          );
        };

        if (ns.transactions) setTransactions(stampImported(ns.transactions, prevSnapshot.transactions));
        if (ns.goals) setGoals(stampImported(ns.goals, prevSnapshot.goals));
        if (ns.recurringPayments) setRecurringPayments(stampImported(ns.recurringPayments, prevSnapshot.recurringPayments));
        if (ns.debts) setDebts(stampImported(ns.debts, prevSnapshot.debts));
        if (ns.customCategories) setCustomCategories(stampImported(ns.customCategories, prevSnapshot.customCategories));
        if (ns.plannedCategoryLimits) setPlannedCategoryLimits(ns.plannedCategoryLimits);
        if (ns.userProfiles) setUserProfiles(ns.userProfiles);
        if (ns.deviceOwner) setDeviceOwner(ns.deviceOwner);
        if (ns.safeLimitConfig) setSafeLimitConfig(ns.safeLimitConfig);

        // Обновляем метаданные синхронизации настроек и снимаем tombstones для импортированных ID
        let nextTombstones = Array.isArray(prevSnapshot.syncTombstones) ? [...prevSnapshot.syncTombstones] : [];
        if (!isMerge) {
          nextTombstones = [];
        } else {
          const importedPairs = [
            ['transactions', ns.transactions],
            ['goals', ns.goals],
            ['recurringPayments', ns.recurringPayments],
            ['debts', ns.debts],
            ['customCategories', ns.customCategories],
          ];
          importedPairs.forEach(([entityType, list]) => {
            if (!Array.isArray(list)) return;
            list.forEach(item => {
              if (item?.id !== undefined && item?.id !== null) {
                nextTombstones = removeDeletionTombstone(nextTombstones, entityType, item.id);
              }
            });
          });
        }
        setSyncTombstones(nextTombstones);

        setSettingsSyncMeta(prev => {
          const nextLimitsMeta = { ...(prev?.plannedCategoryLimits || {}) };
          if (ns.plannedCategoryLimits) {
            Object.keys(ns.plannedCategoryLimits).forEach(cat => {
              nextLimitsMeta[cat] = { updatedAt: nowIso, deleted: false };
            });
          }
          return {
            ...prev,
            ...(ns.userProfiles ? { userProfiles: nowIso } : {}),
            ...(ns.safeLimitConfig ? { safeLimitConfig: nowIso } : {}),
            plannedCategoryLimits: nextLimitsMeta,
          };
        });

        setIsExportModalOpen(false);
        setIsOnboarded(true);
        showToast(result.message, () => {
          markMutated();
          setTransactions(prevSnapshot.transactions);
          setGoals(prevSnapshot.goals);
          setRecurringPayments(prevSnapshot.recurringPayments);
          setDebts(prevSnapshot.debts);
          setCustomCategories(prevSnapshot.customCategories);
          setPlannedCategoryLimits(prevSnapshot.plannedCategoryLimits);
          setUserProfiles(prevSnapshot.userProfiles);
          setDeviceOwner(prevSnapshot.deviceOwner);
          setSafeLimitConfig(prevSnapshot.safeLimitConfig);
          setSyncTombstones(prevSnapshot.syncTombstones);
          setSettingsSyncMeta(prevSnapshot.settingsSyncMeta);
          setToast(null);
        });
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
      syncTombstones,
      settingsSyncMeta,
    };
    setTransactions([]);
    setGoals([]);
    setRecurringPayments([]);
    setDebts([]);
    setCustomCategories([]);
    setPlannedCategoryLimits({});
    setSyncTombstones([]);
    setSettingsSyncMeta({ plannedCategoryLimits: {} });
    setLastMutationAt(null);
    setIsExportModalOpen(false);
    setIsOnboarded(true);
    showToast('Все демо-данные очищены — можно начинать с чистого листа!', () => {
      markMutated();
      setTransactions(prevSnapshot.transactions);
      setGoals(prevSnapshot.goals);
      setRecurringPayments(prevSnapshot.recurringPayments);
      setDebts(prevSnapshot.debts);
      setCustomCategories(prevSnapshot.customCategories);
      setPlannedCategoryLimits(prevSnapshot.plannedCategoryLimits);
      setSyncTombstones(prevSnapshot.syncTombstones);
      setSettingsSyncMeta(prevSnapshot.settingsSyncMeta);
      setToast(null);
    });
  };

  const handleRestoreDemoData = () => {
    const nowIso = markMutated();
    setTransactions(INITIAL_TRANSACTIONS.map(item => touchItemTimestamp(item, nowIso)));
    setGoals(INITIAL_GOALS.map(item => touchItemTimestamp(item, nowIso)));
    setRecurringPayments(INITIAL_RECURRING.map(item => touchItemTimestamp(item, nowIso)));
    setDebts(INITIAL_DEBTS.map(item => touchItemTimestamp(item, nowIso)));
    setUserProfiles(INITIAL_USER_PROFILES);
    setCustomCategories([]);
    setPlannedCategoryLimits({});
    setSyncTombstones([]);
    setSettingsSyncMeta({ userProfiles: nowIso, plannedCategoryLimits: {} });
    setIsExportModalOpen(false);
    setIsOnboarded(true);
    showToast(`Демонстрационные данные v${APP_VERSION} восстановлены`);
  };

  const handleCompleteOnboarding = useCallback(({ userProfiles: nextProfiles, deviceOwner: nextOwner, paydays, startDate, balances }) => {
    const nowIso = markMutated();
    setUserProfiles(nextProfiles);
    setDeviceOwner(nextOwner);
    setCurrentUser(nextOwner);
    setActiveWalletCard(nextOwner);
    setSafeLimitConfig(prev => ({
      ...prev,
      mode: 'paydays',
      paydays,
    }));
    setSettingsSyncMeta(prev => ({
      ...prev,
      userProfiles: nowIso,
      safeLimitConfig: nowIso,
    }));

    const ts = Date.now();
    const openingTxs = [];
    const entries = [
      { key: 'husband', val: Number(balances?.husband) || 0, account: 'personal', author: 'husband' },
      { key: 'wife', val: Number(balances?.wife) || 0, account: 'personal', author: 'wife' },
      { key: 'shared', val: Number(balances?.shared) || 0, account: 'shared', author: nextOwner },
    ];
    entries.forEach((entry, idx) => {
      if (Math.abs(entry.val) > 0) {
        openingTxs.push({
          id: `opening_${entry.key}_${ts}_${idx}`,
          title: 'Начальный остаток счета',
          amount: Math.round(Math.abs(entry.val)),
          type: entry.val >= 0 ? 'income' : 'expense',
          category: 'Начальный остаток',
          account: entry.account,
          author: entry.author,
          isOpeningBalance: true,
          date: startDate || getLocalDateString(),
          updatedAt: nowIso,
        });
      }
    });

    if (openingTxs.length > 0) {
      setTransactions(prev => [...openingTxs, ...prev]);
    }

    setIsOnboarded(true);
    setIsOnboardingModalOpen(false);
    showToast('Семейный бюджет настроен!');
  }, [markMutated, showToast]);

  // Фильтрация истории операций (поиск по названию, категории и сумме)
  const filteredTransactions = useMemo(() => {
    return periodTransactions.filter(tx => {
      if (selectedCalendarDate && tx.date !== selectedCalendarDate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (tx.title || '').toLowerCase().includes(q);
        const matchCategory = (tx.category || '').toLowerCase().includes(q);
        const matchAmount = String(tx.amount ?? '').toLowerCase().includes(q);
        if (!matchTitle && !matchCategory && !matchAmount) return false;
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
      if (t.type === 'transfer' || t.isOpeningBalance) return;
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
      if (tx.type !== 'transfer' && !tx.isOpeningBalance) {
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

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterAuthor('all');
    setFilterType('all');
    setFilterAccount('all');
    setSelectedCalendarDate(null);
  }, []);

  const openWalletHistory = useCallback((walletKey) => {
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
  }, []);

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
      if (t.type !== 'expense' || isSavingsOrDebtTx(t) || t.isOpeningBalance) return;
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
      if (t.type !== 'expense' || t.isOpeningBalance) return;
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

      if (t.type === 'transfer' || t.isOpeningBalance) return;
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

  const myWalletKey = deviceOwner === 'wife' ? 'wife' : 'husband';
  const partnerWalletKey = deviceOwner === 'wife' ? 'husband' : 'wife';
  const myProfile = safeProfiles[myWalletKey] || { name: 'Я', emoji: '👤' };
  const partnerProfile = safeProfiles[partnerWalletKey] || { name: 'Партнер', emoji: '👥' };
  const myWalletStats = myWalletKey === 'wife' ? stats.wifePersonal : stats.husbandPersonal;
  const partnerWalletStats = partnerWalletKey === 'wife' ? stats.wifePersonal : stats.husbandPersonal;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-28 lg:pb-12">
      {/* Верхний бар управления — с поддержкой safe area iOS */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Левый блок: Бренд + фиксированный капсульный селектор периода */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold shadow-sm shrink-0" title="Семейный Бюджет">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0" />
            </div>
            <div className="hidden sm:block lg:hidden 2xl:block min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold tracking-tight text-stone-900 truncate">
                  Семейный Бюджет
                </h1>
                <span className="h-5 px-1.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200/80 text-[11px] font-mono font-medium inline-flex items-center shrink-0">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 leading-none mt-0.5 truncate">
                Совместный учет и планирование
              </p>
            </div>

            {/* Капсула выбора месяца с адаптивной шириной текста */}
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

          {/* Навигация по 4 вкладкам (Desktop) */}
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
              onClick={() => setIsSyncModalOpen(true)}
              aria-label="Синхронизация супругов"
              className={`hidden sm:flex relative h-10 w-10 2xl:w-auto 2xl:px-3 rounded-xl text-xs font-semibold transition border items-center justify-center 2xl:gap-1.5 shrink-0 ${
                hasUnsyncedChanges
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-200/80'
              }`}
              title={
                isSyncConfigured
                  ? (hasUnsyncedChanges ? 'Есть несинхронизированные изменения — откройте окно синка' : 'Синхронизация супругов (настроена)')
                  : 'Синхронизация супругов (Google Таблица / Ссылка)'
              }
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin text-stone-900' : (hasUnsyncedChanges ? 'text-amber-700' : 'text-stone-700')}`} />
              <span className="hidden 2xl:inline">
                {isSyncing ? 'Синк...' : 'Синк'}
              </span>
              {hasUnsyncedChanges && !isSyncing && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
              )}
            </button>

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
        {activeTab === 'dashboard' && (
          <DashboardTab
            isOnboarded={isOnboarded}
            onOpenOnboarding={() => setIsOnboardingModalOpen(true)}
            onLoadDemoData={handleRestoreDemoData}
            onDismissOnboarding={() => setIsOnboarded(true)}
            isSyncConfigured={isSyncConfigured}
            hasUnsyncedChanges={hasUnsyncedChanges}
            lastSyncAt={lastSyncAt}
            isSyncing={isSyncing}
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
            onQuickSync={() => handleRunCloudSync()}
            reminderSummary={reminderSummary}
            openPayRecurringModal={openPayRecurringModal}
            setActiveTab={setActiveTab}
            myWalletKey={myWalletKey}
            partnerWalletKey={partnerWalletKey}
            myProfile={myProfile}
            partnerProfile={partnerProfile}
            myWalletStats={myWalletStats}
            partnerWalletStats={partnerWalletStats}
            activeWalletCard={activeWalletCard}
            setActiveWalletCard={setActiveWalletCard}
            stats={stats}
            setIsLimitModalOpen={setIsLimitModalOpen}
            chartView={chartView}
            setChartView={setChartView}
            selectedMonth={selectedMonth}
            burnDownData={burnDownData}
            rule503020Data={rule503020Data}
            dynamics6MonthsData={dynamics6MonthsData}
            partnerComparisonData={partnerComparisonData}
            safeProfiles={safeProfiles}
            safeLimitConfig={safeLimitConfig}
            expenseForecastData={expenseForecastData}
            openWalletHistory={openWalletHistory}
            recurringPayments={recurringPayments}
            openNewTransactionModal={openNewTransactionModal}
            periodTransactions={periodTransactions}
            customCategories={customCategories}
            openEditTransactionModal={openEditTransactionModal}
            handleDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isCalendarExpanded={isCalendarExpanded}
            setIsCalendarExpanded={setIsCalendarExpanded}
            selectedCalendarDate={selectedCalendarDate}
            setSelectedCalendarDate={setSelectedCalendarDate}
            isFilterOpen={isFilterOpen}
            setIsFilterOpen={setIsFilterOpen}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            monthCalendarDays={monthCalendarDays}
            openNewTransactionModal={openNewTransactionModal}
            filterAuthor={filterAuthor}
            setFilterAuthor={setFilterAuthor}
            filterType={filterType}
            setFilterType={setFilterType}
            filterAccount={filterAccount}
            setFilterAccount={setFilterAccount}
            safeProfiles={safeProfiles}
            filteredTransactions={filteredTransactions}
            periodTransactions={periodTransactions}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            groupedTransactions={groupedTransactions}
            clearFilters={clearFilters}
            customCategories={customCategories}
            openEditTransactionModal={openEditTransactionModal}
            handleDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {activeTab === 'goals' && (
          <GoalsTab
            goals={goals}
            stats={stats}
            selectedMonth={selectedMonth}
            setEditingGoalId={setEditingGoalId}
            setNewGoalTitle={setNewGoalTitle}
            setNewGoalTarget={setNewGoalTarget}
            setNewGoalCurrent={setNewGoalCurrent}
            setIsNewGoalModalOpen={setIsNewGoalModalOpen}
            setSelectedGoalId={setSelectedGoalId}
            setGoalActionMode={setGoalActionMode}
            setGoalSourceAccount={setGoalSourceAccount}
            setGoalActionDate={setGoalActionDate}
            setIsGoalModalOpen={setIsGoalModalOpen}
            openEditGoalModal={openEditGoalModal}
            handleDeleteGoal={handleDeleteGoal}
          />
        )}

        {activeTab === 'debts' && (
          <DebtsPlanTab
            stats={stats}
            pendingBillsCount={pendingBillsCount}
            expenseForecastData={expenseForecastData}
            recurringPayments={recurringPayments}
            debts={debts}
            selectedMonth={selectedMonth}
            customCategories={customCategories}
            safeProfiles={safeProfiles}
            setEditingRecurringId={setEditingRecurringId}
            setNewRecTitle={setNewRecTitle}
            setNewRecAmount={setNewRecAmount}
            setNewRecCategory={setNewRecCategory}
            setNewRecDueDate={setNewRecDueDate}
            setNewRecAccount={setNewRecAccount}
            setNewRecMandatory={setNewRecMandatory}
            setIsNewRecurringModalOpen={setIsNewRecurringModalOpen}
            openPayRecurringModal={openPayRecurringModal}
            openEditRecurringModal={openEditRecurringModal}
            handleDeleteRecurring={handleDeleteRecurring}
            handleApplyAutoForecastLimits={handleApplyAutoForecastLimits}
            editingPlanCategory={editingPlanCategory}
            setEditingPlanCategory={setEditingPlanCategory}
            editingPlanValue={editingPlanValue}
            setEditingPlanValue={setEditingPlanValue}
            handleSaveCategoryLimit={handleSaveCategoryLimit}
            setEditingDebtId={setEditingDebtId}
            setNewDebtTitle={setNewDebtTitle}
            setNewDebtInitial={setNewDebtInitial}
            setNewDebtRemaining={setNewDebtRemaining}
            setNewDebtPayment={setNewDebtPayment}
            setIsNewDebtModalOpen={setIsNewDebtModalOpen}
            openEditDebtModal={openEditDebtModal}
            handleDeleteDebt={handleDeleteDebt}
            openPayDebtModal={openPayDebtModal}
          />
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

      {/* Нижний навигационный бар для мобильных — 5-колоночная сетка с поддержкой safe area iOS */}
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
        userProfiles={safeProfiles}
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
        userProfiles={safeProfiles}
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
        userProfiles={safeProfiles}
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
        onSaveProfiles={(newProfiles) => {
          const nowIso = markMutated();
          setUserProfiles(newProfiles);
          setSettingsSyncMeta(prev => ({ ...prev, userProfiles: nowIso }));
        }}
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
          const nowIso = markMutated();
          setSafeLimitConfig(newConfig);
          setSettingsSyncMeta(prev => ({ ...prev, safeLimitConfig: nowIso }));
          saveToStorage('family_budget_limit_config', newConfig, handleStorageQuotaError);
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
        onOpenSyncModal={() => {
          setIsExportModalOpen(false);
          setIsSyncModalOpen(true);
        }}
      />

      <OnboardingModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        userProfiles={safeProfiles}
        deviceOwner={deviceOwner}
        safeLimitConfig={safeLimitConfig}
        onComplete={handleCompleteOnboarding}
      />

      <FamilySyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncConfig={syncConfig}
        onSaveSyncConfig={setSyncConfig}
        lastSyncAt={lastSyncAt}
        hasUnsyncedChanges={hasUnsyncedChanges}
        isSyncing={isSyncing}
        syncError={syncError}
        onSyncNow={handleRunCloudSync}
        onTestConnection={handleTestCloudConnection}
        localState={localSyncState}
        pendingIncomingPair={pendingIncomingPair}
        onClearPendingPair={() => setPendingIncomingPair(null)}
        pendingIncomingDeltaToken={pendingIncomingDeltaToken}
        onClearPendingDeltaToken={() => setPendingIncomingDeltaToken('')}
        onApplyDecodedDelta={handleApplyDecodedDelta}
        showToast={showToast}
      />
    </div>
  );
}
