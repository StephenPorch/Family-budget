import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, PiggyBank, Plus, ArrowUpRight, 
  ArrowDownLeft, RefreshCw, Calendar, Tag, User, Check, X, Shield, 
  Sparkles, ChevronRight, PieChart, Layers
} from 'lucide-react';

// Начальные демонстрационные данные
const INITIAL_TRANSACTIONS = [
  { id: '1', title: 'Супермаркет (ВкусВилл)', amount: 3450, type: 'expense', category: 'Продукты', account: 'shared', author: 'husband', date: '2026-10-23' },
  { id: '2', title: 'Кофейня и выпечка', amount: 820, type: 'expense', category: 'Кафе', account: 'shared', author: 'wife', date: '2026-10-23' },
  { id: '3', title: 'Аванс по дизайну', amount: 95000, type: 'income', category: 'Работа', account: 'shared', author: 'husband', date: '2026-10-20' },
  { id: '4', title: 'Оплата коммуналки', amount: 6200, type: 'expense', category: 'Дом', account: 'shared', author: 'wife', date: '2026-10-18' },
  { id: '5', title: 'Пополнение цели "Отпуск"', amount: 15000, type: 'expense', category: 'Накопления', account: 'shared', author: 'husband', date: '2026-10-15' },
];

const INITIAL_GOALS = [
  { id: 'g1', title: 'Отпуск в горах', target: 200000, current: 85000, color: 'from-amber-500 to-orange-500', icon: '🏔️' },
  { id: 'g2', title: 'Подушка безопасности', target: 450000, current: 310000, color: 'from-emerald-500 to-teal-500', icon: '🛡️' },
  { id: 'g3', title: 'Апгрейд рабочего места', target: 120000, current: 65000, color: 'from-blue-500 to-indigo-500', icon: '🖥️' },
];

const CATEGORIES = [
  { id: 'food', name: 'Продукты', icon: '🛒', color: 'bg-emerald-50 text-emerald-700' },
  { id: 'cafe', name: 'Кафе и еда вне дома', icon: '☕', color: 'bg-amber-50 text-amber-700' },
  { id: 'home', name: 'Дом и ЖКУ', icon: '🏠', color: 'bg-blue-50 text-blue-700' },
  { id: 'transport', name: 'Транспорт и авто', icon: '🚗', color: 'bg-purple-50 text-purple-700' },
  { id: 'leisure', name: 'Развлечения и кино', icon: '🎬', color: 'bg-pink-50 text-pink-700' },
  { id: 'health', name: 'Здоровье и спорт', icon: '🌿', color: 'bg-teal-50 text-teal-700' },
  { id: 'shopping', name: 'Шопинг и вещи', icon: '🛍️', color: 'bg-indigo-50 text-indigo-700' },
  { id: 'savings', name: 'Накопления', icon: '🎯', color: 'bg-violet-50 text-violet-700' },
];

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

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'history' | 'goals'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  // Форма добавления операции
  const [amount, setAmount] = useState('');
  const [txTitle, setTxTitle] = useState('');
  const [txType, setTxType] = useState('expense'); // 'expense' | 'income'
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].name);
  const [selectedAccount, setSelectedAccount] = useState('shared'); // 'shared' | 'personal'

  // Форма пополнения цели
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [goalAmount, setGoalAmount] = useState('');

  // Сохранение в LocalStorage для работы без бэкенда
  useEffect(() => {
    localStorage.setItem('family_budget_txs', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('family_budget_goals', JSON.stringify(goals));
  }, [goals]);

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

    // Расчет «Свободно на день» до конца месяца (предположим 30 дней)
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);
    const dailyAvailable = Math.max(0, Math.round(balance / daysLeft));

    return { income, expense, balance, totalSavings, husbandSpent, wifeSpent, dailyAvailable, daysLeft };
  }, [transactions, goals]);

  // Добавление новой транзакции (Правило 3 секунд)
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
      date: new Date().toISOString().split('T')[0]
    };

    setTransactions([newTx, ...transactions]);
    setAmount('');
    setTxTitle('');
    setIsAddModalOpen(false);
  };

  // Пополнение цели
  const handleContributeGoal = (e) => {
    e?.preventDefault();
    const num = parseFloat(goalAmount);
    if (!num || num <= 0 || !selectedGoalId) return;

    setGoals(goals.map(g => {
      if (g.id === selectedGoalId) {
        return { ...g, current: Math.min(g.target, (Number(g.current) || 0) + num) };
      }
      return g;
    }));

    // Создаем операцию расхода в копилку
    const targetGoal = goals.find(g => g.id === selectedGoalId);
    const newTx = {
      id: Date.now().toString(),
      title: `В копилку: ${targetGoal?.title || 'Цель'}`,
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
              <p className="text-xs text-stone-400 font-mono">Синхронизация: #{familyCode}</p>
            </div>
          </div>

          {/* Переключатель: Муж / Жена */}
          <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-2xl border border-stone-200">
            <button
              onClick={() => setCurrentUser('husband')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                currentUser === 'husband' 
                  ? 'bg-white text-stone-900 shadow-sm' 
                  : 'text-stone-500 hover:text-stone-800'
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
                  : 'text-stone-500 hover:text-stone-800'
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
        {/* Bento Grid: Ключевые показатели */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Общий баланс */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
              <span>ОБЩИЙ ОСТАТОК</span>
              <Wallet className="w-4 h-4 text-stone-500" />
            </div>
            <div className="my-3">
              <div className="text-3xl font-bold tracking-tight text-stone-900">
                {stats.balance.toLocaleString('ru-RU')} ₽
              </div>
              <div className="text-xs text-stone-400 mt-1">Доходы за вычетом трат</div>
            </div>
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
              <span className="text-emerald-600 font-medium">+{stats.income.toLocaleString('ru-RU')} ₽</span>
              <span className="text-rose-500 font-medium">-{stats.expense.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>

          {/* Свободно на день */}
          <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white p-5 rounded-3xl shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
              <span>СВОБОДНО НА ДЕНЬ</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="my-3">
              <div className="text-3xl font-bold tracking-tight text-amber-300">
                {stats.dailyAvailable.toLocaleString('ru-RU')} ₽
              </div>
              <div className="text-xs text-stone-400 mt-1">Комфортный лимит (осталось {stats.daysLeft} дн.)</div>
            </div>
            <div className="pt-3 border-t border-stone-700/60 text-xs text-stone-300 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Бюджет в безопасности
            </div>
          </div>

          {/* Копилки и цели */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
              <span>В НАКОПЛЕНИЯХ</span>
              <PiggyBank className="w-4 h-4 text-violet-500" />
            </div>
            <div className="my-3">
              <div className="text-3xl font-bold tracking-tight text-violet-600">
                {stats.totalSavings.toLocaleString('ru-RU')} ₽
              </div>
              <div className="text-xs text-stone-400 mt-1">По всем 3 активным целям</div>
            </div>
            <button 
              onClick={() => { setSelectedGoalId(goals[0]?.id); setIsGoalModalOpen(true); }}
              className="text-xs font-medium text-stone-700 hover:text-stone-900 flex items-center gap-1 pt-3 border-t border-stone-100"
            >
              <span>Пополнить копилку</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Доли расходов двоих */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-stone-400 text-xs font-medium">
              <span>РАСПРЕДЕЛЕНИЕ ТРАТ</span>
              <User className="w-4 h-4 text-stone-500" />
            </div>
            <div className="space-y-2 my-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-stone-600">🧔🏻‍♂️ Муж</span>
                <span className="font-semibold text-stone-900">{stats.husbandSpent.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-stone-800 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.expense ? (stats.husbandSpent / stats.expense) * 100 : 50}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="flex items-center gap-1.5 text-stone-600">👩🏼 Жена</span>
                <span className="font-semibold text-stone-900">{stats.wifeSpent.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
            <div className="text-[11px] text-stone-400 pt-2 border-t border-stone-100">
              Баланс совместных расходов
            </div>
          </div>
        </div>

        {/* Секция целей и копилок */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-stone-900 flex items-center gap-2">
              <span>🎯</span> Семейные копилки
            </h2>
            <button 
              onClick={() => { setSelectedGoalId(goals[0]?.id); setIsGoalModalOpen(true); }}
              className="text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-xl transition"
            >
              + Внести в цель
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {goals.map(goal => {
              const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
              return (
                <div key={goal.id} className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{goal.icon}</span>
                    <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-lg">
                      {percent}%
                    </span>
                  </div>
                  <div className="font-medium text-stone-900 mb-1">{goal.title}</div>
                  <div className="text-xs text-stone-400 mb-4">
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
        <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-stone-900">История расходов и доходов</h2>
              <p className="text-xs text-stone-400">Общие и персональные траты в реальном времени</p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="hidden sm:flex items-center gap-2 bg-stone-900 text-white hover:bg-stone-800 text-xs font-medium px-4 py-2.5 rounded-2xl transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Быстрая запись</span>
            </button>
          </div>

          <div className="divide-y divide-stone-100">
            {transactions.map(tx => {
              const catObj = CATEGORIES.find(c => c.name === tx.category) || CATEGORIES[0];
              const isExpense = tx.type === 'expense';
              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between hover:bg-stone-50/50 rounded-2xl px-2 transition">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg ${catObj.color}`}>
                      {catObj.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-stone-900 flex items-center gap-2">
                        <span>{tx.title}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 font-normal">
                          {tx.author === 'husband' ? '🧔🏻‍♂️ Муж' : '👩🏼 Жена'}
                        </span>
                      </div>
                      <div className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                        <span>{tx.category}</span>
                        <span>•</span>
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span>{tx.account === 'shared' ? 'Общий' : 'Личный'}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold tracking-tight ${isExpense ? 'text-stone-900' : 'text-emerald-600'}`}>
                    {isExpense ? '-' : '+'}{Number(tx.amount).toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Плавающая кнопка быстрого добавления (для мобилок) */}
      <div className="fixed bottom-6 right-6 z-40 sm:hidden">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-14 h-14 bg-stone-900 text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Модальное окно: Правило 3 секунд (Добавление расхода/дохода) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">{currentUser === 'husband' ? '🧔🏻‍♂️' : '👩🏼'}</span>
                <span className="font-semibold text-stone-900 text-sm">Новая запись</span>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="pt-4 space-y-4">
              {/* Переключатель: Расход / Доход */}
              <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setTxType('expense')}
                  className={`py-2 text-xs font-semibold rounded-xl transition ${
                    txType === 'expense' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                  }`}
                >
                  Расход (-)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('income')}
                  className={`py-2 text-xs font-semibold rounded-xl transition ${
                    txType === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500'
                  }`}
                >
                  Доход (+)
                </button>
              </div>

              {/* Поле суммы с крупным шрифтом */}
              <div>
                <label className="text-xs font-medium text-stone-400 block mb-1">Сумма (₽)</label>
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

              {/* Быстрые фишки сумм (+100, +500, +1000) */}
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

              {/* Выбор категории */}
              <div>
                <label className="text-xs font-medium text-stone-400 block mb-2">Категория</label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategory(c.name)}
                      className={`p-2.5 rounded-2xl flex flex-col items-center gap-1 text-center border transition ${
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
                <input
                  type="text"
                  placeholder="Комментарий (необязательно)"
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
                Записать
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно: Пополнение цели */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="font-semibold text-stone-900 text-sm">Пополнение копилки</span>
              <button onClick={() => setIsGoalModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleContributeGoal} className="pt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-stone-400 block mb-1">Выберите цель</label>
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
                <label className="text-xs font-medium text-stone-400 block mb-1">Сумма пополнения (₽)</label>
                <input
                  type="number"
                  placeholder="Например, 5000"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                  className="w-full text-xl font-bold px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
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
    </div>
  );
}
