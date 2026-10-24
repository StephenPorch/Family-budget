import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, ArrowUpRight, 
  ArrowDownLeft, RefreshCw, Calendar, Tag, User, Check, X, Shield, 
  Sparkles, ChevronRight, PieChart, Layers, Search, Trash2, Filter
} from 'lucide-react';

// Начальные демонстрационные данные
const INITIAL_TRANSACTIONS = [
  { id: '1', title: 'Супермаркет (ВкусВилл)', amount: 3450, type: 'expense', category: 'Продукты', account: 'shared', author: 'husband', date: '2026-10-23' },
  { id: '2', title: 'Кофейня и выпечка', amount: 820, type: 'expense', category: 'Кафе', account: 'shared', author: 'wife', date: '2026-10-23' },
  { id: '3', title: 'Аванс по дизайну', amount: 95000, type: 'income', category: 'Подработка', account: 'shared', author: 'husband', date: '2026-10-20' },
  { id: '4', title: 'Оплата коммуналки', amount: 6200, type: 'expense', category: 'Дом и ЖКУ', account: 'shared', author: 'wife', date: '2026-10-18' },
  { id: '5', title: 'Пополнение цели "Отпуск"', amount: 15000, type: 'expense', category: 'Накопления', account: 'shared', author: 'husband', date: '2026-10-15' },
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

const getCategoryMeta = (categoryName, type, customCategories = []) => {
  const all = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES, ...customCategories];
  const found = all.find(c => c.name.toLowerCase() === (categoryName || '').toLowerCase());
  if (found) return found;

  // Алиасы для старых записей
  if (categoryName === 'Работа') {
    return { id: 'freelance', name: 'Подработка', icon: '💻', color: 'bg-blue-50 text-blue-700' };
  }
  if (categoryName === 'Дом') {
    return DEFAULT_EXPENSE_CATEGORIES.find(c => c.id === 'home');
  }

  // Фоллбэки в зависимости от типа
  if (type === 'income') {
    return { id: 'custom_inc', name: categoryName || 'Доход', icon: '💵', color: 'bg-emerald-50 text-emerald-700' };
  }
  return { id: 'custom_exp', name: categoryName || 'Расход', icon: '📦', color: 'bg-stone-100 text-stone-700' };
};

export default function FamilyBudgetApp() {
  const [currentUser, setCurrentUser] = useState('husband'); // 'husband' | 'wife'
  const [familyCode, setFamilyCode] = useState('family-home');

  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('family_budget_txs');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [goals, setGoals] = useState(() => {
    const saved = localStorage.getItem('family_budget_goals');
    return saved ? JSON.parse(saved) : INITIAL_GOALS;
  });

  const [customCategories, setCustomCategories] = useState(() => {
    const saved = localStorage.getItem('family_budget_custom_categories');
    return saved ? JSON.parse(saved) : [];
  });

  // Модальные окна
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);

  // Форма добавления операции
  const [amount, setAmount] = useState('');
  const [txTitle, setTxTitle] = useState('');
  const [txType, setTxType] = useState('expense'); // 'expense' | 'income'
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0].name);
  const [selectedAccount, setSelectedAccount] = useState('shared'); // 'shared' | 'personal'
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Инлайн добавление категории
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🏷️');

  // Форма пополнения цели
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [goalAmount, setGoalAmount] = useState('');

  // Форма создания новой цели
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalCurrent, setNewGoalCurrent] = useState('0');
  const [newGoalIcon, setNewGoalIcon] = useState('🎯');
  const [newGoalColor, setNewGoalColor] = useState(GOAL_COLOR_PRESETS[0].value);

  // Поиск и фильтры в истории
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('all'); // 'all' | 'husband' | 'wife'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'expense' | 'income'
  const [filterAccount, setFilterAccount] = useState('all'); // 'all' | 'shared' | 'personal'

  // Синхронизация с LocalStorage
  useEffect(() => {
    localStorage.setItem('family_budget_txs', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('family_budget_goals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem('family_budget_custom_categories', JSON.stringify(customCategories));
  }, [customCategories]);

  // Список категорий для активного типа транзакции (расход или доход)
  const activeCategories = useMemo(() => {
    if (txType === 'income') {
      return [...DEFAULT_INCOME_CATEGORIES, ...customCategories.filter(c => c.type === 'income')];
    }
    return [...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type === 'expense')];
  }, [txType, customCategories]);

  // Переключение типа транзакции с обновлением категории по умолчанию
  const handleTypeChange = (newType) => {
    setTxType(newType);
    setIsAddingCustomCategory(false);
    if (newType === 'income') {
      const isAlreadyIncome = [...DEFAULT_INCOME_CATEGORIES, ...customCategories.filter(c => c.type === 'income')].some(c => c.name === selectedCategory);
      if (!isAlreadyIncome) {
        setSelectedCategory(DEFAULT_INCOME_CATEGORIES[0].name);
      }
    } else {
      const isAlreadyExpense = [...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type === 'expense')].some(c => c.name === selectedCategory);
      if (!isAlreadyExpense) {
        setSelectedCategory(DEFAULT_EXPENSE_CATEGORIES[0].name);
      }
    }
  };

  // Создание пользовательской категории
  const handleCreateCustomCategory = (e) => {
    e?.preventDefault();
    if (!newCatName.trim()) return;
    const trimmed = newCatName.trim();
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
  };

  // Финансовая аналитика
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let husbandSpent = 0;
    let wifeSpent = 0;

    transactions.forEach(t => {
      const val = Number(t.amount) || 0;
      if (t.type === 'income') {
        income += val;
      } else {
        expense += val;
        if (t.author === 'husband') husbandSpent += val;
        if (t.author === 'wife') wifeSpent += val;
      }
    });

    const totalSavings = goals.reduce((acc, g) => acc + (Number(g.current) || 0), 0);
    const balance = income - expense;

    // Расчет «Свободно на день» до конца месяца
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
    const dailyAvailable = Math.max(0, Math.round(balance / daysLeft));

    return { income, expense, balance, totalSavings, husbandSpent, wifeSpent, dailyAvailable, daysLeft };
  }, [transactions, goals]);

  // Добавление новой транзакции
  const handleAddTransaction = (e) => {
    e?.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) return;

    const newTx = {
      id: Date.now().toString(),
      title: txTitle.trim() || selectedCategory,
      amount: num,
      type: txType,
      category: selectedCategory,
      account: selectedAccount,
      author: currentUser,
      date: txDate || new Date().toISOString().split('T')[0]
    };

    setTransactions([newTx, ...transactions]);
    setAmount('');
    setTxTitle('');
    setTxDate(new Date().toISOString().split('T')[0]);
    setIsAddModalOpen(false);
  };

  // Удаление транзакции
  const handleDeleteTransaction = (id) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    const confirmed = window.confirm(`Удалить операцию «${tx.title}» на ${Number(tx.amount).toLocaleString('ru-RU')} ₽?`);
    if (confirmed) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  // Пополнение цели
  const handleContributeGoal = (e) => {
    e?.preventDefault();
    const num = parseFloat(goalAmount);
    if (!num || num <= 0 || !selectedGoalId) return;

    const targetGoal = goals.find(g => g.id === selectedGoalId);
    if (!targetGoal) return;

    setGoals(goals.map(g => {
      if (g.id === selectedGoalId) {
        return { ...g, current: Math.min(g.target, (Number(g.current) || 0) + num) };
      }
      return g;
    }));

    // Создаем операцию расхода в копилку
    const newTx = {
      id: Date.now().toString(),
      title: `В копилку: ${targetGoal.title}`,
      amount: num,
      type: 'expense',
      category: 'Накопления',
      account: 'shared',
      author: currentUser,
      date: new Date().toISOString().split('T')[0]
    };

    setTransactions([newTx, ...transactions]);
    setGoalAmount('');
    setIsGoalModalOpen(false);
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
  };

  // Фильтрация истории операций
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (tx.title || '').toLowerCase().includes(q);
        const matchCategory = (tx.category || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCategory) return false;
      }
      if (filterAuthor !== 'all' && tx.author !== filterAuthor) {
        return false;
      }
      if (filterType !== 'all' && tx.type !== filterType) {
        return false;
      }
      if (filterAccount !== 'all' && tx.account !== filterAccount) {
        return false;
      }
      return true;
    });
  }, [transactions, searchQuery, filterAuthor, filterType, filterAccount]);

  const hasActiveFilters = searchQuery.trim() !== '' || filterAuthor !== 'all' || filterType !== 'all' || filterAccount !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterAuthor('all');
    setFilterType('all');
    setFilterAccount('all');
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-24 md:pb-8">
      {/* Верхний бар управления */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-stone-900 text-white flex items-center justify-center font-bold shadow-md shadow-stone-200">
              💎
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-stone-900 leading-tight">Семейный Бюджет</h1>
              <p className="text-xs text-stone-500 font-mono">Синхронизация: #{familyCode}</p>
            </div>
          </div>

          {/* Переключатель: Муж / Жена */}
          <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-2xl border border-stone-200">
            <button
              onClick={() => setCurrentUser('husband')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                currentUser === 'husband' 
                  ? 'bg-white text-stone-900 shadow-sm' 
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>🧔🏻‍♂️</span>
              <span className="hidden sm:inline">Муж</span>
            </button>
            <button
              onClick={() => setCurrentUser('wife')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                currentUser === 'wife' 
                  ? 'bg-white text-stone-900 shadow-sm' 
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>👩🏼</span>
              <span className="hidden sm:inline">Жена</span>
            </button>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Bento Grid: Ключевые показатели (2x2 на мобильных, 4 в ряд на desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* Общий баланс */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-600 text-xs font-medium">
              <span className="uppercase tracking-wider font-semibold text-[10px] sm:text-xs">Общий остаток</span>
              <Wallet className="w-4 h-4 text-stone-600" />
            </div>
            <div className="my-2 sm:my-3">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-stone-900">
                {stats.balance.toLocaleString('ru-RU')} ₽
              </div>
              <div className="text-[11px] sm:text-xs text-stone-500 mt-1">Доходы минус траты</div>
            </div>
            <div className="pt-2 sm:pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] sm:text-xs">
              <span className="text-emerald-700 font-medium">+{stats.income.toLocaleString('ru-RU')} ₽</span>
              <span className="text-rose-600 font-medium">-{stats.expense.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>

          {/* Свободно на день */}
          <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white p-4 sm:p-5 rounded-3xl shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-300 text-xs font-medium">
              <span className="uppercase tracking-wider font-semibold text-[10px] sm:text-xs">Свободно на день</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="my-2 sm:my-3">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-amber-300">
                {stats.dailyAvailable.toLocaleString('ru-RU')} ₽
              </div>
              <div className="text-[11px] sm:text-xs text-stone-300 mt-1">На {stats.daysLeft} дн. месяца</div>
            </div>
            <div className="pt-2 sm:pt-3 border-t border-stone-700/60 text-[11px] sm:text-xs text-stone-300 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Безопасный лимит</span>
            </div>
          </div>

          {/* Копилки и цели */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-600 text-xs font-medium">
              <span className="uppercase tracking-wider font-semibold text-[10px] sm:text-xs">В накоплениях</span>
              <PiggyBank className="w-4 h-4 text-violet-600" />
            </div>
            <div className="my-2 sm:my-3">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-violet-700">
                {stats.totalSavings.toLocaleString('ru-RU')} ₽
              </div>
              <div className="text-[11px] sm:text-xs text-stone-500 mt-1">По {goals.length} {goals.length === 1 ? 'цели' : 'целям'}</div>
            </div>
            <button 
              onClick={() => { setSelectedGoalId(goals[0]?.id); setIsGoalModalOpen(true); }}
              className="text-[11px] sm:text-xs font-medium text-stone-700 hover:text-stone-900 flex items-center gap-1 pt-2 sm:pt-3 border-t border-stone-100"
            >
              <span>Пополнить</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Доли расходов двоих */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-600 text-xs font-medium">
              <span className="uppercase tracking-wider font-semibold text-[10px] sm:text-xs">Распределение</span>
              <User className="w-4 h-4 text-stone-600" />
            </div>
            <div className="space-y-1.5 my-2">
              <div className="flex items-center justify-between text-[11px] sm:text-xs">
                <span className="flex items-center gap-1 text-stone-700">🧔🏻‍♂️ Муж</span>
                <span className="font-semibold text-stone-900">{stats.husbandSpent.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-stone-800 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.expense ? (stats.husbandSpent / stats.expense) * 100 : 50}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[11px] sm:text-xs pt-0.5">
                <span className="flex items-center gap-1 text-stone-700">👩🏼 Жена</span>
                <span className="font-semibold text-stone-900">{stats.wifeSpent.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
            <div className="text-[10px] sm:text-[11px] text-stone-500 pt-2 border-t border-stone-100 truncate">
              Баланс совместных трат
            </div>
          </div>
        </div>

        {/* Секция целей и копилок */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-stone-900 flex items-center gap-2">
              <span>🎯</span> Семейные копилки
            </h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsNewGoalModalOpen(true)}
                className="text-xs font-medium bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Новая цель</span>
              </button>
              {goals.length > 0 && (
                <button 
                  onClick={() => { setSelectedGoalId(goals[0]?.id); setIsGoalModalOpen(true); }}
                  className="text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-xl transition"
                >
                  Пополнить копилку
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {goals.map(goal => {
              const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
              return (
                <div 
                  key={goal.id} 
                  onClick={() => { setSelectedGoalId(goal.id); setIsGoalModalOpen(true); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedGoalId(goal.id);
                      setIsGoalModalOpen(true);
                    }
                  }}
                  className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm hover:shadow-md hover:border-stone-300 transition-all cursor-pointer relative overflow-hidden group text-left"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl group-hover:scale-110 transition-transform">{goal.icon}</span>
                    <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2 py-1 rounded-lg">
                      {percent}%
                    </span>
                  </div>
                  <div className="font-semibold text-stone-900 mb-1 flex items-center justify-between">
                    <span>{goal.title}</span>
                    <span className="text-xs font-normal text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      + Пополнить
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 mb-4 font-medium">
                    {goal.current.toLocaleString('ru-RU')} ₽ из {goal.target.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r ${goal.color} transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Секция последних операций */}
        <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-stone-900">История расходов и доходов</h2>
              <p className="text-xs text-stone-500 mt-0.5">Общие и персональные траты в реальном времени</p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="hidden sm:flex items-center gap-2 bg-stone-900 text-white hover:bg-stone-800 text-xs font-medium px-4 py-2.5 rounded-2xl transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Быстрая запись</span>
            </button>
          </div>

          {/* Панель поиска и фильтров */}
          <div className="space-y-3 mb-5 pb-4 border-b border-stone-100">
            {/* Поисковая строка */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Поиск по названию или категории..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-medium pl-10 pr-9 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900 placeholder:text-stone-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Очистить поиск"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Фильтры: Автор, Тип операции, Счет */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              {/* Автор */}
              <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200/60">
                <button
                  onClick={() => setFilterAuthor('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    filterAuthor === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Все
                </button>
                <button
                  onClick={() => setFilterAuthor('husband')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    filterAuthor === 'husband' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  🧔🏻‍♂️ Муж
                </button>
                <button
                  onClick={() => setFilterAuthor('wife')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    filterAuthor === 'wife' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  👩🏼 Жена
                </button>
              </div>

              {/* Тип операции */}
              <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200/60">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    filterType === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Все типы
                </button>
                <button
                  onClick={() => setFilterType('expense')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    filterType === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Расходы (-)
                </button>
                <button
                  onClick={() => setFilterType('income')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    filterType === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Доходы (+)
                </button>
              </div>

              {/* Счет */}
              <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200/60">
                <button
                  onClick={() => setFilterAccount('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    filterAccount === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Все счета
                </button>
                <button
                  onClick={() => setFilterAccount('shared')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    filterAccount === 'shared' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Общие
                </button>
                <button
                  onClick={() => setFilterAccount('personal')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    filterAccount === 'personal' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Личные
                </button>
              </div>

              {/* Сброс фильтров */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition ml-auto"
                >
                  Сбросить
                </button>
              )}
            </div>

            {/* Сводка фильтрации */}
            <div className="text-[11px] text-stone-500 font-medium">
              Показано операций: <span className="text-stone-800 font-semibold">{filteredTransactions.length}</span> из {transactions.length}
            </div>
          </div>

          {/* Список операций */}
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-sm font-semibold text-stone-700">Ничего не найдено</div>
              <p className="text-xs text-stone-500 mt-1">Попробуйте изменить параметры поиска или фильтры</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs font-medium text-stone-900 underline hover:no-underline"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {filteredTransactions.map(tx => {
                const catObj = getCategoryMeta(tx.category, tx.type, customCategories);
                const isExpense = tx.type === 'expense';
                return (
                  <div key={tx.id} className="py-3.5 flex items-center justify-between hover:bg-stone-50/70 rounded-2xl px-2 transition group">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-lg ${catObj.color}`}>
                        {catObj.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-stone-900 flex items-center gap-2 flex-wrap">
                          <span className="truncate">{tx.title}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-normal">
                            {tx.author === 'husband' ? '🧔🏻‍♂️ Муж' : '👩🏼 Жена'}
                          </span>
                        </div>
                        <div className="text-xs text-stone-500 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="font-medium text-stone-600">{catObj.name}</span>
                          <span>•</span>
                          <span>{tx.date}</span>
                          <span>•</span>
                          <span className="px-1.5 py-0.2 rounded bg-stone-100 text-[10px] text-stone-600">
                            {tx.account === 'shared' ? 'Общий' : 'Личный'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <div className={`text-sm font-semibold tracking-tight text-right ${isExpense ? 'text-stone-900' : 'text-emerald-700'}`}>
                        {isExpense ? '-' : '+'}{Number(tx.amount).toLocaleString('ru-RU')} ₽
                      </div>
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        aria-label="Удалить операцию"
                        className="text-stone-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition opacity-80 group-hover:opacity-100"
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
      </main>

      {/* Плавающая кнопка быстрого добавления (для мобилок) */}
      <div className="fixed bottom-6 right-6 z-40 sm:hidden">
        <button
          onClick={() => setIsAddModalOpen(true)}
          aria-label="Быстрая запись расхода или дохода"
          className="w-14 h-14 bg-stone-900 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Модальное окно: Правило 3 секунд (Добавление расхода/дохода) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">{currentUser === 'husband' ? '🧔🏻‍♂️' : '👩🏼'}</span>
                <span className="font-semibold text-stone-900 text-sm">Новая запись</span>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                aria-label="Закрыть модальное окно"
                className="text-stone-500 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="pt-4 space-y-4">
              {/* Переключатель: Расход / Доход */}
              <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`py-2 text-xs font-semibold rounded-xl transition ${
                    txType === 'expense' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  Расход (-)
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

              {/* Поле суммы с крупным шрифтом */}
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Сумма (₽)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-3xl font-bold px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              {/* Быстрые фишки сумм (+100, +300, +500, +1000, +3000) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[100, 300, 500, 1000, 3000].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(String((Number(amount) || 0) + v))}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-medium text-stone-700 whitespace-nowrap transition"
                  >
                    +{v} ₽
                  </button>
                ))}
              </div>

              {/* Переключатель счета и дата операции */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Счет</label>
                  <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSelectedAccount('shared')}
                      className={`py-1.5 text-xs font-medium rounded-lg transition ${
                        selectedAccount === 'shared' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                      }`}
                    >
                      Общий 👥
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAccount('personal')}
                      className={`py-1.5 text-xs font-medium rounded-lg transition ${
                        selectedAccount === 'personal' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                      }`}
                    >
                      Личный 👤
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Дата операции</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
              </div>

              {/* Выбор категории */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-stone-500">
                    Категория ({txType === 'income' ? 'Доходы' : 'Расходы'})
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomCategory(!isAddingCustomCategory)}
                    className="text-xs font-medium text-stone-700 hover:text-stone-900 flex items-center gap-1"
                  >
                    <span>{isAddingCustomCategory ? 'Отмена' : '+ Своя категория'}</span>
                  </button>
                </div>

                {/* Инлайн форма добавления своей категории */}
                {isAddingCustomCategory && (
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl mb-3 space-y-2 animate-fade-in">
                    <div className="text-xs font-semibold text-stone-800">Новая категория {txType === 'income' ? 'дохода' : 'расхода'}:</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Эмодзи"
                        value={newCatIcon}
                        onChange={(e) => setNewCatIcon(e.target.value)}
                        className="w-16 text-center text-base p-2 bg-white border border-stone-200 rounded-xl focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Название категории"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="flex-1 text-xs p-2.5 bg-white border border-stone-200 rounded-xl focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateCustomCategory}
                      className="w-full py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition"
                    >
                      Сохранить категорию
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2">
                  {activeCategories.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategory(c.name)}
                      className={`p-2 rounded-2xl flex flex-col items-center gap-1 text-center border transition ${
                        selectedCategory === c.name 
                          ? 'border-stone-900 bg-stone-900 text-white' 
                          : 'border-stone-100 bg-stone-50 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <span className="text-lg">{c.icon}</span>
                      <span className="text-[10px] leading-tight font-medium truncate w-full">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Комментарий (опционально) */}
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Комментарий (необязательно)</label>
                <input
                  type="text"
                  placeholder="Например: Супермаркет, Заправка, Премия..."
                  value={txTitle}
                  onChange={(e) => setTxTitle(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              {/* Кнопка записи */}
              <button
                type="submit"
                className="w-full py-3.5 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition active:scale-[0.99] shadow-lg shadow-stone-300"
              >
                Записать операцию
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно: Пополнение цели */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="font-semibold text-stone-900 text-sm">Пополнение копилки</span>
              <button 
                onClick={() => setIsGoalModalOpen(false)} 
                aria-label="Закрыть модальное окно"
                className="text-stone-500 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleContributeGoal} className="pt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Выберите цель</label>
                <select
                  value={selectedGoalId || ''}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="w-full text-sm font-medium px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                >
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>{g.icon} {g.title} ({g.current.toLocaleString()} / {g.target.toLocaleString()} ₽)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Сумма пополнения (₽)</label>
                <input
                  type="number"
                  placeholder="Например, 5000"
                  autoFocus
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                  className="w-full text-xl font-bold px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              {/* Быстрые фишки сумм */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
                className="w-full py-3 bg-violet-600 text-white rounded-2xl font-semibold text-sm hover:bg-violet-700 transition"
              >
                Внести в накопления
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно: Создание новой цели-копилки */}
      {isNewGoalModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="font-semibold text-stone-900 text-sm">Новая цель-копилка</span>
              <button 
                onClick={() => setIsNewGoalModalOpen(false)} 
                aria-label="Закрыть модальное окно"
                className="text-stone-500 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="pt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Название цели</label>
                <input
                  type="text"
                  placeholder="Например: Ремонт кухни, Автомобиль"
                  autoFocus
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Целевая сумма (₽)</label>
                  <input
                    type="number"
                    placeholder="150000"
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">Уже накоплено (₽)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newGoalCurrent}
                    onChange={(e) => setNewGoalCurrent(e.target.value)}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
              </div>

              {/* Выбор иконки цели */}
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Иконка цели</label>
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

              {/* Выбор градиента */}
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Цветовой стиль</label>
                <div className="grid grid-cols-5 gap-2">
                  {GOAL_COLOR_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setNewGoalColor(preset.value)}
                      className={`h-7 rounded-xl bg-gradient-to-r ${preset.value} border-2 transition ${
                        newGoalColor === preset.value ? 'border-stone-900 scale-105' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      title={preset.label}
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
