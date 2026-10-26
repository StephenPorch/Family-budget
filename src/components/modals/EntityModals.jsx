import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { GOAL_COLOR_PRESETS, QUICK_GOAL_ICONS, DEFAULT_EXPENSE_CATEGORIES } from '../../utils/storage.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

export const GoalActionModal = React.memo(function GoalActionModal({
  isOpen,
  onClose,
  goals,
  selectedGoalId,
  setSelectedGoalId,
  goalActionMode,
  setGoalActionMode,
  goalSourceAccount,
  setGoalSourceAccount,
  goalAmount,
  setGoalAmount,
  goalActionDate,
  setGoalActionDate,
  currentUser,
  onSubmit,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span id="goal-modal-title" className="font-semibold text-stone-900 text-sm">Операция с копилкой</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="text-stone-500 hover:text-stone-800 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setGoalActionMode('contribute')}
              className={`py-2 rounded-lg transition ${
                goalActionMode === 'contribute' ? 'bg-white text-violet-700 shadow-sm' : 'text-stone-600'
              }`}
            >
              + Пополнить
            </button>
            <button
              type="button"
              onClick={() => setGoalActionMode('withdraw')}
              className={`py-2 rounded-lg transition ${
                goalActionMode === 'withdraw' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-600'
              }`}
            >
              − Взять из копилки
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">Цель накопления</label>
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
            <label className="text-xs font-medium text-stone-600 block mb-1">
              {goalActionMode === 'withdraw' ? 'На какой счет вернуть средства?' : 'С какого счета списать?'}
            </label>
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Сумма (₽)</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="5000"
                autoFocus
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                aria-label="Сумма"
                className="w-full text-lg font-bold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Дата операции</label>
              <input
                type="date"
                value={goalActionDate}
                onChange={(e) => setGoalActionDate(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900"
              />
            </div>
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
            className={`w-full py-3 text-white rounded-2xl font-semibold text-sm transition shadow-sm ${
              goalActionMode === 'withdraw' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-violet-600 hover:bg-violet-700'
            }`}
          >
            {goalActionMode === 'withdraw' ? 'Вывести из копилки на счет' : 'Отложить в копилку'}
          </button>
        </form>
      </div>
    </div>
  );
});

export const GoalFormModal = React.memo(function GoalFormModal({
  isOpen,
  onClose,
  editingGoalId,
  newGoalTitle,
  setNewGoalTitle,
  newGoalTarget,
  setNewGoalTarget,
  newGoalCurrent,
  setNewGoalCurrent,
  newGoalIcon,
  setNewGoalIcon,
  newGoalColor,
  setNewGoalColor,
  onSubmit,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-goal-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span id="new-goal-modal-title" className="font-semibold text-stone-900 text-sm">
            {editingGoalId ? 'Редактирование цели' : 'Новая цель-копилка'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="text-stone-500 hover:text-stone-800 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">Название цели</label>
            <input
              type="text"
              required
              placeholder="Например: Отпуск, Ремонт кухни"
              autoFocus
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Целевая сумма (₽)</label>
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
              <label className="text-xs font-medium text-stone-600 block mb-1">Уже накоплено (₽)</label>
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
            <label className="text-xs font-medium text-stone-600 block mb-1">Иконка</label>
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
            <label className="text-xs font-medium text-stone-600 block mb-1">Цветовой градиент</label>
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
            {editingGoalId ? 'Сохранить изменения' : 'Создать цель'}
          </button>
        </form>
      </div>
    </div>
  );
});

export const RecurringFormModal = React.memo(function RecurringFormModal({
  isOpen,
  onClose,
  editingRecurringId,
  newRecTitle,
  setNewRecTitle,
  newRecAmount,
  setNewRecAmount,
  newRecDueDate,
  setNewRecDueDate,
  newRecCategory,
  setNewRecCategory,
  newRecAccount,
  setNewRecAccount,
  newRecAuthor,
  setNewRecAuthor,
  newRecMandatory,
  setNewRecMandatory,
  customCategories,
  onSubmit,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-recurring-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span id="new-recurring-modal-title" className="font-semibold text-stone-900 text-sm">
            {editingRecurringId ? 'Редактирование постоянного расхода' : 'Новый постоянный расход'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="text-stone-500 hover:text-stone-800 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">Название (например: Мобильная связь, Интернет)</label>
            <input
              type="text"
              required
              placeholder="Мобильная связь / Домашний интернет"
              autoFocus
              value={newRecTitle}
              onChange={(e) => setNewRecTitle(e.target.value)}
              className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Плановая сумма (₽)</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="1400"
                value={newRecAmount}
                onChange={(e) => setNewRecAmount(e.target.value)}
                className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Число напоминания (1–31)</label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={newRecDueDate}
                onChange={(e) => setNewRecDueDate(e.target.value)}
                className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">Категория</label>
            <select
              value={newRecCategory}
              onChange={(e) => setNewRecCategory(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900"
            >
              {[...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type !== 'income')].map(c => (
                <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">С какого счета оплачивается?</label>
            <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setNewRecAccount('shared')}
                className={`py-1.5 rounded-lg font-medium transition ${
                  newRecAccount === 'shared' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                }`}
              >
                👥 Общий
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewRecAccount('personal');
                  setNewRecAuthor('husband');
                }}
                className={`py-1.5 rounded-lg font-medium transition ${
                  newRecAccount === 'personal' && newRecAuthor === 'husband' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                }`}
              >
                🧔🏻‍♂️ Муж
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewRecAccount('personal');
                  setNewRecAuthor('wife');
                }}
                className={`py-1.5 rounded-lg font-medium transition ${
                  newRecAccount === 'personal' && newRecAuthor === 'wife' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                }`}
              >
                👩🏼 Жена
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={newRecMandatory}
              onChange={(e) => setNewRecMandatory(e.target.checked)}
              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
            />
            <span>Обязательный платеж (резервировать сумму в дневном лимите)</span>
          </label>

          <button
            type="submit"
            className="w-full py-3 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition"
          >
            {editingRecurringId ? 'Сохранить изменения' : 'Добавить в постоянные расходы'}
          </button>
        </form>
      </div>
    </div>
  );
});

export const PayRecurringModal = React.memo(function PayRecurringModal({
  isOpen,
  onClose,
  selectedRecurringToPay,
  recPayAmount,
  setRecPayAmount,
  recPayDate,
  setRecPayDate,
  onSubmit,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  if (!isOpen || !selectedRecurringToPay) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-rec-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span id="pay-rec-modal-title" className="font-semibold text-stone-900 text-sm">
            Оплата: {selectedRecurringToPay.title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="text-stone-500 hover:text-stone-800 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">
              Фактическая сумма по чеку (₽)
            </label>
            <input
              type="number"
              min="1"
              step="any"
              required
              autoFocus
              value={recPayAmount}
              onChange={(e) => setRecPayAmount(e.target.value)}
              className="w-full text-2xl font-bold px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">Дата оплаты</label>
            <input
              type="date"
              value={recPayDate}
              onChange={(e) => setRecPayDate(e.target.value)}
              className="w-full text-xs font-semibold px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition shadow-sm"
          >
            Подтвердить оплату и снять резерв
          </button>
        </form>
      </div>
    </div>
  );
});

export const DebtFormModal = React.memo(function DebtFormModal({
  isOpen,
  onClose,
  editingDebtId,
  newDebtTitle,
  setNewDebtTitle,
  newDebtInitial,
  setNewDebtInitial,
  newDebtRemaining,
  setNewDebtRemaining,
  newDebtPayment,
  setNewDebtPayment,
  newDebtDay,
  setNewDebtDay,
  newDebtIcon,
  setNewDebtIcon,
  onSubmit,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-debt-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span id="new-debt-modal-title" className="font-semibold text-stone-900 text-sm">
            {editingDebtId ? 'Редактирование кредита' : 'Новый кредит или рассрочка'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="text-stone-500 hover:text-stone-800 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">Название обязательства</label>
            <input
              type="text"
              required
              placeholder="Например: Ипотека, Рассрочка на ноутбук"
              autoFocus
              value={newDebtTitle}
              onChange={(e) => setNewDebtTitle(e.target.value)}
              className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Начальная сумма (₽)</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="300000"
                value={newDebtInitial}
                onChange={(e) => setNewDebtInitial(e.target.value)}
                className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Остаток долга (₽)</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Если пусто = нач."
                value={newDebtRemaining}
                onChange={(e) => setNewDebtRemaining(e.target.value)}
                className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Платёж в месяц (₽)</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="15000"
                value={newDebtPayment}
                onChange={(e) => setNewDebtPayment(e.target.value)}
                className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">День платежа</label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={newDebtDay}
                onChange={(e) => setNewDebtDay(e.target.value)}
                className="w-full text-xs font-medium px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">Иконка</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['💳', '🚗', '📱', '🏠', '💍', '💻', '🎓'].map(ic => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setNewDebtIcon(ic)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm border transition ${
                    newDebtIcon === ic ? 'border-stone-900 bg-stone-100 font-bold' : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition"
          >
            {editingDebtId ? 'Сохранить изменения' : 'Сохранить кредит'}
          </button>
        </form>
      </div>
    </div>
  );
});

export const PayDebtModal = React.memo(function PayDebtModal({
  isOpen,
  onClose,
  debtSourceAccount,
  setDebtSourceAccount,
  debtSourceAuthor,
  setDebtSourceAuthor,
  debtPayAmount,
  setDebtPayAmount,
  debtPayDate,
  setDebtPayDate,
  onSubmit,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-debt-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span id="pay-debt-modal-title" className="font-semibold text-stone-900 text-sm">Внесение платежа по долгу</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="text-stone-500 hover:text-stone-800 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1">С какого баланса списать?</label>
            <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setDebtSourceAccount('shared')}
                className={`py-1.5 rounded-lg font-medium transition ${
                  debtSourceAccount === 'shared' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                }`}
              >
                👥 Общий
              </button>
              <button
                type="button"
                onClick={() => {
                  setDebtSourceAccount('personal');
                  setDebtSourceAuthor('husband');
                }}
                className={`py-1.5 rounded-lg font-medium transition ${
                  debtSourceAccount === 'personal' && debtSourceAuthor === 'husband' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                }`}
              >
                🧔🏻‍♂️ Муж
              </button>
              <button
                type="button"
                onClick={() => {
                  setDebtSourceAccount('personal');
                  setDebtSourceAuthor('wife');
                }}
                className={`py-1.5 rounded-lg font-medium transition ${
                  debtSourceAccount === 'personal' && debtSourceAuthor === 'wife' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                }`}
              >
                👩🏼 Жена
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Сумма платежа (₽)</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                autoFocus
                value={debtPayAmount}
                onChange={(e) => setDebtPayAmount(e.target.value)}
                className="w-full text-lg font-bold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1">Дата платежа</label>
              <input
                type="date"
                value={debtPayDate}
                onChange={(e) => setDebtPayDate(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-rose-600 text-white rounded-2xl font-semibold text-sm hover:bg-rose-700 transition shadow-sm"
          >
            Подтвердить платёж
          </button>
        </form>
      </div>
    </div>
  );
});
