import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet, PiggyBank, Plus, Calendar, User, X,
  Sparkles, ChevronRight, ChevronLeft, Search, Trash2,
  SlidersHorizontal, RotateCcw, Edit3, Check, LayoutGrid,
  ListOrdered, Target, ArrowUpRight
} from 'lucide-react';

// Получение локальной даты в формате YYYY-MM-DD (не зависит от UTC)
const getLocalDateString = (dateObj = new Date()) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Получение текущего месяца в формате YYYY-MM
const getCurrentMonthPrefix = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const MONTH_NAMES_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const formatMonthTitle = (ym) => {
  if (!ym || ym === 'all') return 'За всё время';
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MONTH_NAMES_NOMINATIVE[m - 1]} ${y}`;
};

const formatDateGroupHeader = (dateStr) => {
  const todayStr = getLocalDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  if (dateStr === todayStr) return 'Сегодня';
  if (dateStr === yesterdayStr) return 'Вчера';

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

// Начальные демонстрационные данные с примерами общих и личных операций
const INITIAL_TRANSACTIONS = [
  { id: '1', title: 'Супермаркет (ВкусВилл)', amount: 3450, type: 'expense', category: 'Продукты', account: 'shared', author: 'husband', date: '2026-10-23' },
  { id: '2', title: 'Кофейня и выпечка', amount: 820, type: 'expense', category: 'Кафе и еда вне дома', account: 'shared', author: 'wife', date: '2026-10-23' },
  { id: '3', title: 'Аванс по проекту (в общий бюджет)', amount: 95000, type: 'income', category: 'Зарплата', account: 'shared', author: 'husband', date: '2026-10-20' },
  { id: '4', title: 'Оплата коммуналки и интернета', amount: 6200, type: 'expense', category: 'Дом и ЖКУ', account: 'shared', author: 'wife', date: '2026-10-18' },
  { id: '5', title: 'В копилку: Отпуск в горах', amount: 15000, type: 'expense', category: 'Накопления', account: 'shared', author: 'husband', date: '2026-10-15', goalId: 'g1' },
  { id: '6', title: 'Фриланс (на личную карту)', amount: 28000, type: 'income', category: 'Подработка', account: 'personal', author: 'husband', date: '2026-10-19' },
  { id: '7', title: 'Игры в Steam и подписка', amount: 3200, type: 'expense', category: 'Развлечения и кино', account: 'personal', author: 'husband', date: '2026-10-22' },
  { id: '8', title: 'Премия и кешбэк (личный счет)', amount: 24000, type: 'income', category: 'Другое', account: 'personal', author: 'wife', date: '2026-10-17' },
  { id: '9', title: 'Косметика и уход', amount: 4100, type: 'expense', category: 'Шопинг и вещи', account: 'personal', author: 'wife', date: '2026-10-21' },
];

const INITIAL_GOALS = [
  { id: 'g1', title: 'Отпуск в горах', target: 200000, current: 85000, color: 'from-amber-500 to-orange-500', icon: '🏔️' },
  { id: 'g2', title: 'Подушка безопасности', target: 450000, current: 310000, color: 'from-emerald-500 to-teal-500', icon: '🛡️' },
  { id: 'g3', title: 'Апгрейд рабочего места', target: 120000, current: 65000, color: 'from-blue-500 to-indigo-500', icon: '🖥️' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'food', name: 'Продукты', icon: '🛒', color: 'bg-emerald-50 text-emerald-700' },
  { id: 'cafe', name: 'Кафе и еда вне дома', icon: '☕', color: 'bg-amber-50 text-amber-700' },
  { id: 'home', name: 'Дом и ЖКУ', icon: '🏠', color: 'bg-blue-50 text-blue-700' },
  { id: 'transport', name: 'Транспорт и авто', icon: '🚗', color: 'bg-purple-50 text-purple-700' },
  { id: 'leisure', name: 'Развлечения и кино', icon: '🎬', color: 'bg-pink-50 text-pink-700' },
  { id: 'health', name: 'Здоровье и спорт', icon: '🌿', color: 'bg-teal-50 text-teal-700' },
  { id: 'shopping', name: 'Шопинг и вещи', icon: '🛍️', color: 'bg-indigo-50 text-indigo-700' },
  { id: 'savings', name: 'Накопления', icon: '🎯', color: 'bg-violet-50 text-violet-700' },
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

const QUICK_GOAL_ICONS = ['🎯', '🏔️', '🛡️', '🖥️', '🚗', '🏖️', '🏡', '💍', '👶', '🎓'];

const CATEGORY_ALIASES = {
  'работа': { id: 'freelance', name: 'Подработка', icon: '💻', color: 'bg-blue-50 text-blue-700' },
  'дом': { id: 'home', name: 'Дом и ЖКУ', icon: '🏠', color: 'bg-blue-50 text-blue-700' },
  'кафе': { id: 'cafe', name: 'Кафе и еда вне дома', icon: '☕', color: 'bg-amber-50 text-amber-700' },
  'транспорт': { id: 'transport', name: 'Транспорт и авто', icon: '🚗', color: 'bg-purple-50 text-purple-700' },
  'развлечения': { id: 'leisure', name: 'Развлечения и кино', icon: '🎬', color: 'bg-pink-50 text-pink-700' },
  'здоровье': { id: 'health', name: 'Здоровье и спорт', icon: '🌿', color: 'bg-teal-50 text-teal-700' },
  'шопинг': { id: 'shopping', name: 'Шопинг и вещи', icon: '🛍️', color: 'bg-indigo-50 text-indigo-700' },
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
  return { id: 'custom_exp', name: categoryName || 'Расход', icon: '📦', color: 'bg-stone-100 text-stone-700' };
};

export default function FamilyBudgetApp() {
  const [currentUser, setCurrentUser] = useState('husband'); // 'husband' | 'wife'
  const [familyCode] = useState('family-home');
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'history' | 'goals'
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthPrefix); // 'YYYY-MM' | 'all'

  // Фокус кошелька в дашборде: 'shared' | 'husband' | 'wife'
  const [activeWalletCard, setActiveWalletCard] = useState('shared');

  const [transactions, setTransactions] = useState(() =>
    loadFromStorage('family_budget_txs', INITIAL_TRANSACTIONS)
  );
  const [goals, setGoals] = useState(() =>
    loadFromStorage('family_budget_goals', INITIAL_GOALS)
  );
  const [customCategories, setCustomCategories] = useState(() =>
    loadFromStorage('family_budget_custom_categories', [])
  );

  // Модальные окна
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);

  // Форма добавления / редактирования операции
  const [amount, setAmount] = useState('');
  const [txTitle, setTxTitle] = useState('');
  const [txType, setTxType] = useState('expense'); // 'expense' | 'income'
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0].name);
  const [selectedAccount, setSelectedAccount] = useState('shared'); // 'shared' | 'personal'
  const [txAuthor, setTxAuthor] = useState('husband');
  const [txDate, setTxDate] = useState(getLocalDateString);
  const [showDateInput, setShowDateInput] = useState(false);

  // Инлайн управление своими категориями
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🏷️');

  // Форма пополнения цели
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [goalAmount, setGoalAmount] = useState('');
  const [goalSourceAccount, setGoalSourceAccount] = useState('shared'); // 'shared' | 'personal'

  // Форма создания новой цели
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalCurrent, setNewGoalCurrent] = useState('0');
  const [newGoalIcon, setNewGoalIcon] = useState('🎯');
  const [newGoalColor, setNewGoalColor] = useState(GOAL_COLOR_PRESETS[0].value);

  // Поиск и компактная фильтрация
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterAuthor, setFilterAuthor] = useState('all'); // 'all' | 'husband' | 'wife'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'expense' | 'income'
  const [filterAccount, setFilterAccount] = useState('all'); // 'all' | 'shared' | 'personal'

  // Система мягких уведомлений и отмены удаления (Undo Toast вместо window.confirm)
  const [toast, setToast] = useState(null); // { message, onUndo }
  const toastTimerRef = useRef(null);

  const showToast = (message, onUndo = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, onUndo });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 5500);
  };

  // Сохранение в LocalStorage
  useEffect(() => {
    saveToStorage('family_budget_txs', transactions);
  }, [transactions]);

  useEffect(() => {
    saveToStorage('family_budget_goals', goals);
  }, [goals]);

  useEffect(() => {
    saveToStorage('family_budget_custom_categories', customCategories);
  }, [customCategories]);

  // Закрытие модальных окон по Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsAddModalOpen(false);
        setIsGoalModalOpen(false);
        setIsNewGoalModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Переключение месяца
  const stepMonth = (delta) => {
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

  // Открытие модалки создания новой операции
  const openNewTransactionModal = (presetAccount = null) => {
    setEditingTxId(null);
    setAmount('');
    setTxTitle('');
    setTxType('expense');
    setSelectedCategory(DEFAULT_EXPENSE_CATEGORIES[0].name);
    setSelectedAccount(presetAccount || (activeWalletCard === 'shared' ? 'shared' : 'personal'));
    setTxAuthor(activeWalletCard === 'wife' ? 'wife' : activeWalletCard === 'husband' ? 'husband' : currentUser);
    setTxDate(getLocalDateString());
    setShowDateInput(false);
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
    setShowDateInput(tx.date !== getLocalDateString());
    setIsAddingCustomCategory(false);
    setIsManagingCategories(false);
    setIsAddModalOpen(true);
  };

  const handleTypeChange = (newType) => {
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
    };
    setCustomCategories(prev => [...prev, newCat]);
    setSelectedCategory(trimmed);
    setNewCatName('');
    setIsAddingCustomCategory(false);
    showToast(`Категория «${trimmed}» добавлена`);
  };

  // Удаление пользовательской категории с возможностью Undo
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

  // Транзакции, отфильтрованные по выбранному месяцу
  const periodTransactions = useMemo(() => {
    const filtered = selectedMonth === 'all'
      ? transactions
      : transactions.filter(t => (t.date || '').startsWith(selectedMonth));

    // Сортируем по дате (убывание), а при равной дате — по порядку добавления
    return [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [transactions, selectedMonth]);

  // РАЗДЕЛЬНАЯ ФИНАНСОВАЯ МАТЕМАТИКА (Общий бюджет vs Личный баланс Мужа vs Личный баланс Жены)
  const stats = useMemo(() => {
    const shared = { income: 0, expense: 0, balance: 0, husbandSpent: 0, wifeSpent: 0, husbandIncome: 0, wifeIncome: 0 };
    const husbandPersonal = { income: 0, expense: 0, balance: 0 };
    const wifePersonal = { income: 0, expense: 0, balance: 0 };
    const categoryTotals = {};

    periodTransactions.forEach(t => {
      const val = Number(t.amount) || 0;
      const acc = t.account || 'shared';

      if (acc === 'shared') {
        if (t.type === 'income') {
          shared.income += val;
          if (t.author === 'husband') shared.husbandIncome += val;
          if (t.author === 'wife') shared.wifeIncome += val;
        } else {
          shared.expense += val;
          if (t.author === 'husband') shared.husbandSpent += val;
          if (t.author === 'wife') shared.wifeSpent += val;
        }
      } else {
        // Личный счет каждого партнера считается строго отдельно от семейного котла
        const targetWallet = t.author === 'wife' ? wifePersonal : husbandPersonal;
        if (t.type === 'income') {
          targetWallet.income += val;
        } else {
          targetWallet.expense += val;
        }
      }

      // Топ категорий расходов для выбранного кошелька
      const matchesWalletFilter =
        (activeWalletCard === 'shared' && acc === 'shared') ||
        (activeWalletCard === 'husband' && acc === 'personal' && t.author === 'husband') ||
        (activeWalletCard === 'wife' && acc === 'personal' && t.author === 'wife');

      if (t.type === 'expense' && matchesWalletFilter) {
        const catName = t.category || 'Прочее';
        categoryTotals[catName] = (categoryTotals[catName] || 0) + val;
      }
    });

    shared.balance = shared.income - shared.expense;
    husbandPersonal.balance = husbandPersonal.income - husbandPersonal.expense;
    wifePersonal.balance = wifePersonal.income - wifePersonal.expense;

    const totalSavings = goals.reduce((acc, g) => acc + (Number(g.current) || 0), 0);
    const totalTargetSavings = goals.reduce((acc, g) => acc + (Number(g.target) || 0), 0);

    // Расчет «Свободно на день» для активного кошелька
    const today = new Date();
    let daysLeft = 1;
    if (selectedMonth !== 'all') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      if (y === today.getFullYear() && m === today.getMonth() + 1) {
        daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
      } else {
        daysLeft = daysInMonth;
      }
    } else {
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
    }

    const activeBalance =
      activeWalletCard === 'husband'
        ? husbandPersonal.balance
        : activeWalletCard === 'wife'
        ? wifePersonal.balance
        : shared.balance;

    const dailyAvailable = Math.max(0, Math.round(activeBalance / daysLeft));

    // Сортированный список категорий для аналитики
    const totalSelectedExpense = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, sum]) => ({
        name,
        sum,
        percent: totalSelectedExpense > 0 ? Math.round((sum / totalSelectedExpense) * 100) : 0,
        meta: getCategoryMeta(name, 'expense', customCategories),
      }));

    return {
      shared,
      husbandPersonal,
      wifePersonal,
      totalSavings,
      totalTargetSavings,
      dailyAvailable,
      daysLeft,
      topCategories,
      totalSelectedExpense,
    };
  }, [periodTransactions, goals, selectedMonth, activeWalletCard, customCategories]);

  // Сохранение (добавление или редактирование) транзакции
  const handleSaveTransaction = (e) => {
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
                type: txType,
                category: selectedCategory,
                account: selectedAccount,
                author: txAuthor,
                date: finalDate,
              }
            : t
        )
      );
      // Если редактируемая транзакция была привязана к цели, корректируем цель
      if (oldTx && oldTx.goalId && oldTx.amount !== num) {
        const diff = num - (Number(oldTx.amount) || 0);
        setGoals(prev =>
          prev.map(g =>
            g.id === oldTx.goalId
              ? { ...g, current: Math.max(0, (Number(g.current) || 0) + diff) }
              : g
          )
        );
      }
      showToast(`Операция «${finalTitle}» обновлена`);
    } else {
      const newTx = {
        id: Date.now().toString(),
        title: finalTitle,
        amount: num,
        type: txType,
        category: selectedCategory,
        account: selectedAccount,
        author: txAuthor,
        date: finalDate,
      };
      setTransactions(prev => [newTx, ...prev]);
      showToast(`Записано: ${finalTitle} (${num.toLocaleString('ru-RU')} ₽)`);
    }

    // Если дата операции относится к другому месяцу, переключаем фильтр на него, чтобы пользователь сразу увидел запись
    const txMonth = finalDate.slice(0, 7);
    if (selectedMonth !== 'all' && txMonth !== selectedMonth) {
      setSelectedMonth(txMonth);
    }

    setAmount('');
    setTxTitle('');
    setEditingTxId(null);
    setIsAddModalOpen(false);
  };

  // Удаление транзакции с мягким Undo-тостом и откатом копилки
  const handleDeleteTransaction = (id, e) => {
    e?.stopPropagation();
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return;
    const tx = transactions[index];

    setTransactions(prev => prev.filter(t => t.id !== id));
    if (tx.goalId) {
      setGoals(prev =>
        prev.map(g =>
          g.id === tx.goalId
            ? { ...g, current: Math.max(0, (Number(g.current) || 0) - (Number(tx.amount) || 0)) }
            : g
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
        setGoals(prev =>
          prev.map(g =>
            g.id === tx.goalId
              ? { ...g, current: (Number(g.current) || 0) + (Number(tx.amount) || 0) }
              : g
          )
        );
      }
      setToast(null);
    });
  };

  // Пополнение цели с выбором источника (Общий бюджет или Личный баланс текущего партнера)
  const handleContributeGoal = (e) => {
    e?.preventDefault();
    const num = parseFloat(goalAmount);
    if (!num || num <= 0 || !selectedGoalId) return;

    const targetGoal = goals.find(g => g.id === selectedGoalId);
    if (!targetGoal) return;

    setGoals(prev =>
      prev.map(g =>
        g.id === selectedGoalId ? { ...g, current: (Number(g.current) || 0) + num } : g
      )
    );

    const newTx = {
      id: Date.now().toString(),
      title: `В копилку: ${targetGoal.title}`,
      amount: num,
      type: 'expense',
      category: 'Накопления',
      account: goalSourceAccount,
      author: currentUser,
      date: getLocalDateString(),
      goalId: targetGoal.id,
    };

    setTransactions(prev => [newTx, ...prev]);
    setGoalAmount('');
    setIsGoalModalOpen(false);
    showToast(`Копилка «${targetGoal.title}» пополнена на ${num.toLocaleString('ru-RU')} ₽`);
  };

  // Создание новой цели
  const handleCreateGoal = (e) => {
    e?.preventDefault();
    const targetNum = parseFloat(newGoalTarget);
    if (!newGoalTitle.trim() || !targetNum || targetNum <= 0) return;
    const currentNum = Math.max(0, parseFloat(newGoalCurrent) || 0);

    const newGoal = {
      id: 'g_' + Date.now(),
      title: newGoalTitle.trim(),
      target: targetNum,
      current: currentNum,
      color: newGoalColor,
      icon: newGoalIcon.trim() || '🎯',
    };

    setGoals(prev => [...prev, newGoal]);
    setNewGoalTitle('');
    setNewGoalTarget('');
    setNewGoalCurrent('0');
    setIsNewGoalModalOpen(false);
    showToast(`Цель «${newGoal.title}» создана`);
  };

  // Удаление цели с Undo
  const handleDeleteGoal = (e, goalId) => {
    e?.stopPropagation();
    const idx = goals.findIndex(item => item.id === goalId);
    if (idx === -1) return;
    const g = goals[idx];

    setGoals(prev => prev.filter(item => item.id !== goalId));
    if (selectedGoalId === goalId) setSelectedGoalId(null);

    showToast(`Цель «${g.title}» удалена`, () => {
      setGoals(prev => {
        const copy = [...prev];
        copy.splice(idx, 0, g);
        return copy;
      });
      setToast(null);
    });
  };

  // Фильтрация истории операций
  const filteredTransactions = useMemo(() => {
    return periodTransactions.filter(tx => {
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
  }, [periodTransactions, searchQuery, filterAuthor, filterType, filterAccount]);

  // Группировка транзакций по датам (Сегодня / Вчера / 20 октября) с дневным сальдо
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
    (filterAccount !== 'all' ? 1 : 0);

  const hasActiveFilters = searchQuery.trim() !== '' || activeFilterCount > 0;

  const clearFilters = () => {
    setSearchQuery('');
    setFilterAuthor('all');
    setFilterType('all');
    setFilterAccount('all');
  };

  // Переход из карточки кошелька к отфильтрованной истории
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

  // Карточка одной строки операции (чистая, без дублирования даты)
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
                  Копилка
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
            className="text-stone-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
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
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-stone-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Бренд + переключатель месяца */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-stone-900 text-white flex items-center justify-center font-bold shadow-sm text-sm shrink-0">
              💎
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-semibold tracking-tight text-stone-900 leading-tight">
                  Семейный Бюджет
                </h1>
                <span className="hidden lg:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
                  #{familyCode}
                </span>
              </div>
              {/* Селектор периода */}
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
                  onClick={() => setSelectedMonth(selectedMonth === 'all' ? getCurrentMonthPrefix() : 'all')}
                  className="text-xs font-medium text-stone-600 hover:text-stone-900 transition"
                  title="Нажмите, чтобы переключить: Месяц / За всё время"
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

          {/* Навигация по вкладкам (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 bg-stone-100 p-1 rounded-2xl border border-stone-200/60" aria-label="Разделы приложения">
            {[
              { id: 'dashboard', label: 'Обзор', icon: LayoutGrid },
              { id: 'history', label: 'Операции', icon: ListOrdered, badge: periodTransactions.length },
              { id: 'goals', label: 'Копилки', icon: Target, badge: goals.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-stone-100 text-stone-700' : 'text-stone-400'}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Правый блок: Переключатель активного профиля + Кнопка записи */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200/70">
              <button
                type="button"
                onClick={() => setCurrentUser('husband')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  currentUser === 'husband'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span>🧔🏻‍♂️</span>
                <span className="hidden sm:inline">Муж</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentUser('wife')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  currentUser === 'wife'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span>👩🏼</span>
                <span className="hidden sm:inline">Жена</span>
              </button>
            </div>

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
            {/* 3 РАЗДЕЛЬНЫХ БАЛАНСА + СВОБОДНО НА ДЕНЬ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* 1. Общий семейный бюджет */}
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
                  <div className="text-[11px] text-stone-500 mt-0.5">Совместный баланс</div>
                </div>
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1 text-[11px]">
                  <span className="text-emerald-700 font-medium truncate">+{stats.shared.income.toLocaleString('ru-RU')}</span>
                  <span className="text-rose-600 font-medium truncate">−{stats.shared.expense.toLocaleString('ru-RU')}</span>
                </div>
              </div>

              {/* 2. Личный баланс: Муж */}
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
                  <div className="text-[11px] text-stone-500 mt-0.5">Не трогает общий котел</div>
                </div>
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1 text-[11px]">
                  <span className="text-emerald-700 font-medium truncate">+{stats.husbandPersonal.income.toLocaleString('ru-RU')}</span>
                  <span className="text-rose-600 font-medium truncate">−{stats.husbandPersonal.expense.toLocaleString('ru-RU')}</span>
                </div>
              </div>

              {/* 3. Личный баланс: Жена */}
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
                  <div className="text-[11px] text-stone-500 mt-0.5">Не трогает общий котел</div>
                </div>
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1 text-[11px]">
                  <span className="text-emerald-700 font-medium truncate">+{stats.wifePersonal.income.toLocaleString('ru-RU')}</span>
                  <span className="text-rose-600 font-medium truncate">−{stats.wifePersonal.expense.toLocaleString('ru-RU')}</span>
                </div>
              </div>

              {/* 4. Свободно на день (динамически под выбранный кошелек) */}
              <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white p-4 sm:p-5 rounded-3xl shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between text-stone-300 text-xs font-medium">
                  <span className="uppercase tracking-wider font-semibold text-[10px] sm:text-xs truncate">
                    Лимит в день
                  </span>
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                </div>
                <div className="my-2.5">
                  <div className="text-lg sm:text-2xl font-bold tracking-tight text-amber-300 truncate">
                    {stats.dailyAvailable.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-[11px] text-stone-300 mt-0.5 truncate">
                    {activeWalletCard === 'shared'
                      ? `Общий • на ${stats.daysLeft} дн.`
                      : activeWalletCard === 'husband'
                      ? `Личный (Муж) • на ${stats.daysLeft} дн.`
                      : `Личный (Жена) • на ${stats.daysLeft} дн.`}
                  </div>
                </div>
                <div className="pt-2 border-t border-stone-700/60 text-[11px] text-stone-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                    <span>В копилках: {stats.totalSavings.toLocaleString('ru-RU')} ₽</span>
                  </span>
                </div>
              </div>
            </div>

            {/* СРЕДНИЙ РЯД: Структура трат выбранного кошелька + Вклад в общий бюджет */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Топ категорий расходов (3 колонки) */}
              <div className="lg:col-span-3 bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-stone-900">
                        Структура расходов ({activeWalletCard === 'shared' ? 'Общий котел 👥' : activeWalletCard === 'husband' ? 'Личный: Муж 🧔🏻‍♂️' : 'Личный: Жена 👩🏼'})
                      </h2>
                      <p className="text-xs text-stone-500">
                        Всего потрачено: <span className="font-semibold text-stone-800">{stats.totalSelectedExpense.toLocaleString('ru-RU')} ₽</span>
                      </p>
                    </div>
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

                  {stats.topCategories.length === 0 ? (
                    <div className="py-8 text-center text-xs text-stone-500">
                      Нет расходов по этому счету за выбранный период
                    </div>
                  ) : (
                    <div className="space-y-2.5 mt-2">
                      {stats.topCategories.slice(0, 4).map(item => (
                        <div key={item.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 font-medium text-stone-800 truncate">
                              <span>{item.meta.icon}</span>
                              <span className="truncate">{item.name}</span>
                            </span>
                            <span className="text-stone-600 font-semibold shrink-0">
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

              {/* Баланс участия в общем бюджете + Сводка копилок (2 колонки) */}
              <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-stone-900">Участие в общем котле</h2>
                    <User className="w-4 h-4 text-stone-500" />
                  </div>
                  <p className="text-xs text-stone-500 mb-3">
                    Кто сколько оплатил из общих семейных расходов
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-stone-700 font-medium">🧔🏻‍♂️ Муж оплатил</span>
                      <span className="font-semibold text-stone-900">{stats.shared.husbandSpent.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden flex">
                      <div
                        className="bg-stone-900 h-full transition-all duration-500"
                        style={{
                          width: `${stats.shared.expense ? Math.round((stats.shared.husbandSpent / stats.shared.expense) * 100) : 50}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-stone-700 font-medium">👩🏼 Жена оплатила</span>
                      <span className="font-semibold text-stone-900">{stats.shared.wifeSpent.toLocaleString('ru-RU')} ₽</span>
                    </div>
                  </div>
                </div>

                {/* Быстрый виджет копилок с переходом во вкладку */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                      <PiggyBank className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-stone-900 truncate">
                        Семейные копилки ({goals.length})
                      </div>
                      <div className="text-[11px] text-stone-500 truncate">
                        Накоплено {stats.totalSavings.toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('goals')}
                    className="px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold transition shrink-0"
                  >
                    Открыть
                  </button>
                </div>
              </div>
            </div>

            {/* ПОСЛЕДНИЕ ОПЕРАЦИИ (Превью 5 записей с переходом во вкладку «Операции») */}
            <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-stone-900">Последние операции</h2>
                  <p className="text-xs text-stone-500">Нажмите на любую запись, чтобы изменить ее</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-xs font-semibold text-stone-700 hover:text-stone-900 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 transition"
                >
                  <span>Все ({periodTransactions.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {periodTransactions.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="text-2xl mb-1.5">📭</div>
                  <div className="text-sm font-semibold text-stone-700">В этом периоде пока нет записей</div>
                  <button
                    type="button"
                    onClick={() => openNewTransactionModal()}
                    className="mt-3 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить первую запись</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {periodTransactions.slice(0, 5).map(tx => renderTransactionRow(tx))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= ВКЛАДКА 2: ОПЕРАЦИИ (ИСТОРИЯ И ФИЛЬТРЫ) ================= */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm p-4 sm:p-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-stone-900">История операций</h2>
                <p className="text-xs text-stone-500">
                  Период: <span className="font-medium text-stone-700">{formatMonthTitle(selectedMonth)}</span> • Нажмите на строку для редактирования
                </p>
              </div>

              {/* Быстрые пресеты кошельков в 1 клик */}
              <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-2xl border border-stone-200/60 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => { setFilterAccount('all'); setFilterAuthor('all'); }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium transition ${
                    filterAccount === 'all' && filterAuthor === 'all'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => { setFilterAccount('shared'); setFilterAuthor('all'); }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium transition ${
                    filterAccount === 'shared'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  👥 Общие
                </button>
                <button
                  type="button"
                  onClick={() => { setFilterAccount('personal'); setFilterAuthor('husband'); }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium transition ${
                    filterAccount === 'personal' && filterAuthor === 'husband'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  🧔🏻‍♂️ Личные
                </button>
                <button
                  type="button"
                  onClick={() => { setFilterAccount('personal'); setFilterAuthor('wife'); }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium transition ${
                    filterAccount === 'personal' && filterAuthor === 'wife'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  👩🏼 Личные
                </button>
              </div>
            </div>

            {/* Компактная строка поиска + кнопка раскрытия детальных фильтров */}
            <div className="space-y-3 mb-5 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Поиск по названию или категории..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Поиск по операциям"
                    className="w-full text-xs font-medium pl-10 pr-9 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 placeholder:text-stone-400 text-stone-900"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Очистить поиск"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`px-3.5 py-2.5 rounded-2xl text-xs font-semibold border transition flex items-center gap-1.5 shrink-0 ${
                    isFilterOpen || activeFilterCount > 0
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Фильтры</span>
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-stone-950 text-[10px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-3 py-2.5 rounded-2xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition shrink-0"
                  >
                    Сбросить
                  </button>
                )}
              </div>

              {/* Выдвижная панель расширенных фильтров (Progressive Disclosure) */}
              {isFilterOpen && (
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 flex flex-wrap items-center gap-3 text-xs animate-fade-in">
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500 font-medium">Тип:</span>
                    <div className="flex bg-white p-0.5 rounded-xl border border-stone-200">
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

                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500 font-medium">Кто:</span>
                    <div className="flex bg-white p-0.5 rounded-xl border border-stone-200">
                      {[
                        { id: 'all', label: 'Оба' },
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

                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500 font-medium">Счет:</span>
                    <div className="flex bg-white p-0.5 rounded-xl border border-stone-200">
                      {[
                        { id: 'all', label: 'Любой' },
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

              <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium">
                <span>
                  Найдено записей: <strong className="text-stone-800">{filteredTransactions.length}</strong> из {periodTransactions.length}
                </span>
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

            {/* Сгруппированный по дням список операций */}
            {groupedTransactions.length === 0 ? (
              <div className="py-12 text-center">
                <div className="text-3xl mb-2">🔍</div>
                <div className="text-sm font-semibold text-stone-700">Операций не найдено</div>
                <p className="text-xs text-stone-500 mt-1">Попробуйте изменить запрос или сбросить фильтры</p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-3 text-xs font-semibold text-stone-900 underline hover:no-underline"
                  >
                    Сбросить все фильтры
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {groupedTransactions.map(group => (
                  <div key={group.date}>
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-stone-50/90 rounded-xl text-xs font-semibold text-stone-600 mb-1">
                      <span>{group.label}</span>
                      <span className={group.net >= 0 ? 'text-emerald-700' : 'text-stone-700'}>
                        {group.net >= 0 ? '+' : '−'}{Math.abs(group.net).toLocaleString('ru-RU')} ₽
                      </span>
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

        {/* ================= ВКЛАДКА 3: СЕМЕЙНЫЕ КОПИЛКИ (ЦЕЛИ) ================= */}
        {activeTab === 'goals' && (
          <div className="space-y-5 animate-fade-in">
            <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-stone-900 flex items-center gap-2">
                  <span>🎯</span> Семейные копилки и цели
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Общий прогресс: <strong className="text-stone-800">{stats.totalSavings.toLocaleString('ru-RU')} ₽</strong> из {stats.totalTargetSavings.toLocaleString('ru-RU')} ₽ • Нажмите на карточку, чтобы пополнить
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewGoalModalOpen(true)}
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
                        setGoalSourceAccount('shared');
                        setIsGoalModalOpen(true);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedGoalId(goal.id);
                          setIsGoalModalOpen(true);
                        }
                      }}
                      className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm hover:shadow-md hover:border-stone-300 transition-all cursor-pointer relative overflow-hidden group text-left flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl group-hover:scale-110 transition-transform">{goal.icon}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-xl">
                              {percent}%
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteGoal(e, goal.id)}
                              aria-label={`Удалить цель ${goal.title}`}
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Удалить цель"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="font-semibold text-stone-900 mb-1 flex items-center justify-between gap-2">
                          <span className="truncate">{goal.title}</span>
                          <span className="text-xs font-semibold text-violet-600 shrink-0">
                            + Пополнить
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
      </main>

      {/* Мягкий Undo-тост (вместо блокирующего window.confirm) */}
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

      {/* Нижний навигационный бар для мобильных устройств (Обзор / + / Операции / Копилки) */}
      <nav
        aria-label="Мобильная навигация"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-3 py-1.5 flex items-center justify-around md:hidden"
      >
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[11px] font-medium transition ${
            activeTab === 'dashboard' ? 'text-stone-900 font-semibold' : 'text-stone-400'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span>Обзор</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[11px] font-medium transition ${
            activeTab === 'history' ? 'text-stone-900 font-semibold' : 'text-stone-400'
          }`}
        >
          <ListOrdered className="w-5 h-5" />
          <span>Операции</span>
        </button>

        <button
          type="button"
          onClick={() => openNewTransactionModal()}
          aria-label="Быстрая запись операции"
          className="w-11 h-11 bg-stone-900 text-white rounded-2xl shadow-md flex items-center justify-center active:scale-95 transition"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('goals')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[11px] font-medium transition ${
            activeTab === 'goals' ? 'text-stone-900 font-semibold' : 'text-stone-400'
          }`}
        >
          <Target className="w-5 h-5" />
          <span>Копилки</span>
        </button>
      </nav>

      {/* МОДАЛЬНОЕ ОКНО: ПРАВИЛО 3 СЕКУНД (Запись или редактирование операции) */}
      {isAddModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsAddModalOpen(false); }}
          className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-modal-title"
        >
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-stone-500" />
                <span id="add-modal-title" className="font-semibold text-stone-900 text-sm">
                  {editingTxId ? 'Редактирование операции' : 'Быстрая запись'}
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

            <form onSubmit={handleSaveTransaction} className="pt-4 space-y-4">
              {/* Переключатель: Расход / Доход */}
              <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`py-2 text-xs font-semibold rounded-xl transition ${
                    txType === 'expense' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  Расход (−)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`py-2 text-xs font-semibold rounded-xl transition ${
                    txType === 'income' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  Доход (+)
                </button>
              </div>

              {/* Крупное поле суммы + быстрые чипсы */}
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

              {/* Компактная строка пилюль: Чей кошелек (Общий / Личный) + Кто + Дата */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {/* Кошелек */}
                <button
                  type="button"
                  onClick={() => setSelectedAccount(selectedAccount === 'shared' ? 'personal' : 'shared')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                    selectedAccount === 'shared'
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-amber-50 text-amber-900 border-amber-300'
                  }`}
                >
                  <span>{selectedAccount === 'shared' ? '👥 Общий котел' : '👤 Личный баланс'}</span>
                </button>

                {/* Автор */}
                <button
                  type="button"
                  onClick={() => setTxAuthor(txAuthor === 'husband' ? 'wife' : 'husband')}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 transition flex items-center gap-1"
                >
                  <span>{txAuthor === 'husband' ? '🧔🏻‍♂️ Муж' : '👩🏼 Жена'}</span>
                </button>

                {/* Дата (по умолчанию свернута в кнопку «Сегодня») */}
                <button
                  type="button"
                  onClick={() => setShowDateInput(!showDateInput)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 transition flex items-center gap-1 ml-auto"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{txDate === getLocalDateString() ? 'Сегодня' : txDate}</span>
                </button>
              </div>

              {showDateInput && (
                <div className="animate-fade-in">
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    aria-label="Дата операции"
                    className="w-full text-xs font-medium px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
              )}

              {/* Сетка категорий 3 в ряд (читаемые подписи text-xs вместо мелких 10px) */}
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
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {activeCategories.map(c => (
                    <div key={c.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(c.name)}
                        className={`w-full px-2.5 py-2 rounded-2xl flex items-center gap-2 text-left border transition ${
                          selectedCategory === c.name
                            ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                            : 'border-stone-200/70 bg-stone-50 text-stone-700 hover:bg-stone-100'
                        }`}
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

              {/* Комментарий */}
              <div>
                <input
                  type="text"
                  placeholder="Комментарий (необязательно, например: ВкусВилл)"
                  value={txTitle}
                  onChange={(e) => setTxTitle(e.target.value)}
                  aria-label="Комментарий к операции"
                  className="w-full text-xs px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                {editingTxId && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteTransaction(editingTxId, e)}
                    className="px-4 py-3.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl font-semibold text-xs transition"
                  >
                    Удалить
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition active:scale-[0.99] shadow-md"
                >
                  {editingTxId ? 'Сохранить изменения' : 'Записать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: ПОПОЛНЕНИЕ КОПИЛКИ */}
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
              <span id="goal-modal-title" className="font-semibold text-stone-900 text-sm">Пополнение копилки</span>
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
                <label className="text-xs font-medium text-stone-500 block mb-1">С какого баланса списать?</label>
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

              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Сумма пополнения (₽)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="Например, 5000"
                  autoFocus
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                  aria-label="Сумма пополнения"
                  className="w-full text-2xl font-bold px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                />
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
                className="w-full py-3 bg-violet-600 text-white rounded-2xl font-semibold text-sm hover:bg-violet-700 transition shadow-sm"
              >
                Отложить в копилку
              </button>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: НОВАЯ ЦЕЛЬ */}
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
              <span id="new-goal-modal-title" className="font-semibold text-stone-900 text-sm">Новая цель-копилка</span>
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
                  placeholder="Например: Ремонт кухни, Автомобиль"
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
                Создать цель
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
