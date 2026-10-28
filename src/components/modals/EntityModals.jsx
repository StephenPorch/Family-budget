import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { GOAL_COLOR_PRESETS, QUICK_GOAL_ICONS, DEFAULT_EXPENSE_CATEGORIES } from '../../utils/storage.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useBackdropDismiss } from '../../hooks/useBackdropDismiss.js';
import { calculateHorizonDays } from '../../utils/financeCore.js';

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
  const backdropDismiss = useBackdropDismiss(onClose);
  if (!isOpen) return null;

  return (
    <div
      {...backdropDismiss}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span id="goal-modal-title" className="font-semibold text-stone-900 text-sm">Операция с копилкой</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl h-10 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setGoalActionMode('contribute')}
              className={`h-8 rounded-lg transition flex items-center justify-center ${
                goalActionMode === 'contribute' ? 'bg-white text-violet-700 shadow-sm' : 'text-stone-600'
              }`}
            >
              + Пополнить
            </button>
            <button
              type="button"
              onClick={() => setGoalActionMode('withdraw')}
              className={`h-8 rounded-lg transition flex items-center justify-center ${
                goalActionMode === 'withdraw' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-600'
              }`}
            >
              − Взять из копилки
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">Цель накопления</label>
            <select
              value={selectedGoalId || goals[0]?.id || ''}
              onChange={(e) => setSelectedGoalId(e.target.value)}
              aria-label="Выберите цель"
              className="w-full h-10 text-xs font-semibold px-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900"
            >
              {goals.map(g => (
                <option key={g.id} value={g.id}>
                  {g.icon} {g.title} ({Number(g.current).toLocaleString('ru-RU')} / {Number(g.target).toLocaleString('ru-RU')} ₽)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">
              {goalActionMode === 'withdraw' ? 'На какой счет вернуть средства?' : 'С какого счета списать?'}
            </label>
            <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl h-10 text-xs">
              <button
                type="button"
                onClick={() => setGoalSourceAccount('shared')}
                className={`h-8 rounded-lg font-medium transition flex items-center justify-center ${
                  goalSourceAccount === 'shared' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                }`}
              >
                👥 Общий котел
              </button>
              <button
                type="button"
                onClick={() => setGoalSourceAccount('personal')}
                className={`h-8 rounded-lg font-medium transition flex items-center justify-center ${
                  goalSourceAccount === 'personal' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                }`}
              >
                {currentUser === 'husband' ? '🧔🏻‍♂️ Личный (Муж)' : '👩🏼 Личный (Жена)'}
              </button>
            </div>
          </div>

          {/* Оба инпута в одной строке строго одинаковой высоты h-10 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">Сумма (₽)</label>
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
                className="w-full h-10 text-sm font-bold px-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">Дата операции</label>
              <input
                type="date"
                value={goalActionDate}
                onChange={(e) => setGoalActionDate(e.target.value)}
                className="w-full h-10 text-xs font-semibold px-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900 tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[1000, 3000, 5000, 10000].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setGoalAmount(String((Number(goalAmount) || 0) + v))}
                className="h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs font-semibold text-stone-700 whitespace-nowrap transition flex items-center justify-center tabular-nums"
              >
                +{v}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className={`w-full h-11 text-white rounded-xl font-semibold text-sm transition shadow-sm flex items-center justify-center ${
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
  const backdropDismiss = useBackdropDismiss(onClose);
  if (!isOpen) return null;

  return (
    <div
      {...backdropDismiss}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-goal-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span id="new-goal-modal-title" className="font-semibold text-stone-900 text-sm">
            {editingGoalId ? 'Редактирование цели' : 'Новая цель-копилка'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">Название цели</label>
            <input
              type="text"
              required
              placeholder="Например: Отпуск, Ремонт кухни"
              autoFocus
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              className="w-full h-10 text-xs font-medium px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">Целевая сумма (₽)</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="150000"
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
                className="w-full h-10 text-xs font-semibold px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">Уже накоплено (₽)</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={newGoalCurrent}
                onChange={(e) => setNewGoalCurrent(e.target.value)}
                className="w-full h-10 text-xs font-semibold px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">Иконка</label>
            <div className="grid grid-cols-7 gap-1.5">
              {QUICK_GOAL_ICONS.map(ic => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setNewGoalIcon(ic)}
                  className={`h-9 rounded-xl flex items-center justify-center text-sm border transition ${
                    newGoalIcon === ic ? 'border-stone-900 bg-stone-100 font-bold' : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">Цветовой градиент</label>
            <div className="grid grid-cols-5 gap-2">
              {GOAL_COLOR_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setNewGoalColor(preset.value)}
                  aria-label={`Выбрать цвет ${preset.label}`}
                  className={`h-8 rounded-xl bg-gradient-to-r ${preset.value} border-2 transition ${
                    newGoalColor === preset.value ? 'border-stone-900 scale-105' : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-11 bg-stone-900 text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition flex items-center justify-center"
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
  const backdropDismiss = useBackdropDismiss(onClose);
  if (!isOpen) return null;

  return (
    <div
      {...backdropDismiss}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-recurring-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span id="new-recurring-modal-title" className="font-semibold text-stone-900 text-sm">
            {editingRecurringId ? 'Редактирование постоянного расхода' : 'Новый постоянный расход'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">Название (например: Мобильная связь, Интернет)</label>
            <input
              type="text"
              required
              placeholder="Мобильная связь / Домашний интернет"
              autoFocus
              value={newRecTitle}
              onChange={(e) => setNewRecTitle(e.target.value)}
              className="w-full h-10 text-xs font-medium px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">Плановая сумма (₽)</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="1400"
                value={newRecAmount}
                onChange={(e) => setNewRecAmount(e.target.value)}
                className="w-full h-10 text-xs font-semibold px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">Число оплаты (1–31)</label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={newRecDueDate}
                onChange={(e) => setNewRecDueDate(e.target.value)}
                className="w-full h-10 text-xs font-semibold px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">Категория</label>
            <select
              value={newRecCategory}
              onChange={(e) => setNewRecCategory(e.target.value)}
              className="w-full h-10 text-xs font-semibold px-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900"
            >
              {[...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type !== 'income')].map(c => (
                <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">С какого счета оплачивается?</label>
            <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl h-10 text-xs">
              <button
                type="button"
                onClick={() => setNewRecAccount('shared')}
                className={`h-8 rounded-lg font-medium transition flex items-center justify-center ${
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
                className={`h-8 rounded-lg font-medium transition flex items-center justify-center ${
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
                className={`h-8 rounded-lg font-medium transition flex items-center justify-center ${
                  newRecAccount === 'personal' && newRecAuthor === 'wife' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                }`}
              >
                👩🏼 Жена
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-stone-700 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={newRecMandatory}
              onChange={(e) => setNewRecMandatory(e.target.checked)}
              className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 shrink-0"
            />
            <span>Обязательный платеж (резервировать сумму в дневном лимите)</span>
          </label>

          <button
            type="submit"
            className="w-full h-11 bg-stone-900 text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition flex items-center justify-center"
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
  const backdropDismiss = useBackdropDismiss(onClose);
  if (!isOpen || !selectedRecurringToPay) return null;

  return (
    <div
      {...backdropDismiss}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-rec-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span id="pay-rec-modal-title" className="font-semibold text-stone-900 text-sm truncate pr-2">
            Оплата: {selectedRecurringToPay.title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">
                Сумма по чеку (₽)
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                autoFocus
                value={recPayAmount}
                onChange={(e) => setRecPayAmount(e.target.value)}
                className="w-full h-10 text-sm font-bold px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">Дата оплаты</label>
              <input
                type="date"
                value={recPayDate}
                onChange={(e) => setRecPayDate(e.target.value)}
                className="w-full h-10 text-xs font-semibold px-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900 tabular-nums"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-11 bg-stone-900 text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition shadow-sm flex items-center justify-center"
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
  newDebtIsRegular,
  setNewDebtIsRegular,
  newDebtIcon,
  setNewDebtIcon,
  onSubmit,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  const backdropDismiss = useBackdropDismiss(onClose);
  if (!isOpen) return null;

  return (
    <div
      {...backdropDismiss}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-debt-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <span id="new-debt-modal-title" className="font-semibold text-stone-900 text-sm">
            {editingDebtId ? 'Редактирование обязательства' : 'Новый долг, кредит или рассрочка'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">Тип обязательства</label>
            <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl h-10 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setNewDebtIsRegular(true)}
                className={`h-8 rounded-lg transition flex items-center justify-center ${
                  newDebtIsRegular ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                📅 Фикс. платеж
              </button>
              <button
                type="button"
                onClick={() => setNewDebtIsRegular(false)}
                className={`h-8 rounded-lg transition flex items-center justify-center ${
                  !newDebtIsRegular ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                ⚡ По возможности
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">Название обязательства</label>
            <input
              type="text"
              required
              placeholder="Например: Долг другу, Рассрочка, Автокредит"
              autoFocus
              value={newDebtTitle}
              onChange={(e) => setNewDebtTitle(e.target.value)}
              className="w-full h-10 text-xs font-medium px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">Сумма долга (₽)</label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="100000"
                value={newDebtInitial}
                onChange={(e) => setNewDebtInitial(e.target.value)}
                className="w-full h-10 text-xs font-semibold px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-600 block mb-1.5">Остаток долга (₽)</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Если пусто = вся"
                value={newDebtRemaining}
                onChange={(e) => setNewDebtRemaining(e.target.value)}
                className="w-full h-10 text-xs font-semibold px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
              />
            </div>
          </div>

          {newDebtIsRegular ? (
            <div className="grid grid-cols-2 gap-2.5 animate-fade-in">
              <div>
                <label className="text-xs font-medium text-stone-600 block mb-1.5">Платёж в месяц (₽)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="15000"
                  value={newDebtPayment}
                  onChange={(e) => setNewDebtPayment(e.target.value)}
                  className="w-full h-10 text-xs font-semibold px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-600 block mb-1.5">День платежа (1–31)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={newDebtDay}
                  onChange={(e) => setNewDebtDay(e.target.value)}
                  className="w-full h-10 text-xs font-semibold px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-stone-100 rounded-xl border border-stone-200/60 text-xs text-stone-600 space-y-1">
              <span className="font-semibold text-stone-800 flex items-center gap-1">⚡ Гибкое погашение</span>
              <p className="text-[11px] leading-relaxed">
                Платежи вносятся по возможности на любую сумму. Долг уменьшает капитал, но не урезает ежедневный лимит.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">Иконка</label>
            <div className="grid grid-cols-7 gap-1.5">
              {['💳', '🚗', '📱', '🏠', '💍', '💻', '🎓'].map(ic => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setNewDebtIcon(ic)}
                  className={`h-9 rounded-xl flex items-center justify-center text-sm border transition ${
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
            className="w-full h-11 bg-stone-900 text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition flex items-center justify-center"
          >
            {editingDebtId ? 'Сохранить изменения' : 'Сохранить обязательство'}
          </button>
        </form>
      </div>
    </div>
  );
});

export const PayDebtModal = React.memo(function PayDebtModal({
  isOpen,
  onClose,
  activeDebt,
  userProfiles,
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
  const backdropDismiss = useBackdropDismiss(onClose);
  if (!isOpen) return null;

  const p1 = userProfiles?.husband || { name: 'Муж', emoji: '🧔🏻‍♂️' };
  const p2 = userProfiles?.wife || { name: 'Жена', emoji: '👩🏼' };
  const rem = Math.max(0, Number(activeDebt?.remainingAmount) || 0);

  return (
    <div
      {...backdropDismiss}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-debt-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <span id="pay-debt-modal-title" className="font-semibold text-stone-900 text-sm block">
              Погашение: {activeDebt?.title || 'Долг'}
            </span>
            <span className="text-xs text-stone-500">
              Остаток долга: <b className="text-stone-800 font-bold tabular-nums">{rem.toLocaleString('ru-RU')} ₽</b>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="pt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">С какого баланса списать?</label>
            <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl h-10 text-xs">
              <button
                type="button"
                onClick={() => setDebtSourceAccount('shared')}
                className={`h-8 rounded-lg font-medium transition flex items-center justify-center truncate px-1 ${
                  debtSourceAccount === 'shared' ? 'bg-white text-stone-900 shadow-sm font-bold' : 'text-stone-600'
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
                className={`h-8 rounded-lg font-medium transition flex items-center justify-center gap-1 truncate px-1 ${
                  debtSourceAccount === 'personal' && debtSourceAuthor === 'husband' ? 'bg-white text-stone-900 shadow-sm font-bold' : 'text-stone-600'
                }`}
              >
                <span>{p1.emoji}</span>
                <span className="truncate">{p1.name}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDebtSourceAccount('personal');
                  setDebtSourceAuthor('wife');
                }}
                className={`h-8 rounded-lg font-medium transition flex items-center justify-center gap-1 truncate px-1 ${
                  debtSourceAccount === 'personal' && debtSourceAuthor === 'wife' ? 'bg-white text-stone-900 shadow-sm font-bold' : 'text-stone-600'
                }`}
              >
                <span>{p2.emoji}</span>
                <span className="truncate">{p2.name}</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-stone-600">Сумма платежа (₽)</label>
              <span className="text-[11px] text-stone-500">любая сумма</span>
            </div>
            <input
              type="number"
              min="1"
              step="any"
              required
              autoFocus
              placeholder="Введите сумму"
              value={debtPayAmount}
              onChange={(e) => setDebtPayAmount(e.target.value)}
              className="w-full h-10 text-sm font-bold px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
            />
            {/* Быстрые кнопки сумм */}
            <div className="flex items-center gap-1.5 pt-2 flex-wrap">
              {[1000, 5000, 10000].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDebtPayAmount(String(v))}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition"
                >
                  +{v.toLocaleString('ru-RU')} ₽
                </button>
              ))}
              {rem > 0 && (
                <button
                  type="button"
                  onClick={() => setDebtPayAmount(String(rem))}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition"
                >
                  Весь остаток ({rem.toLocaleString('ru-RU')} ₽)
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">Дата платежа</label>
            <input
              type="date"
              value={debtPayDate}
              onChange={(e) => setDebtPayDate(e.target.value)}
              className="w-full h-10 text-xs font-semibold px-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none text-stone-900 tabular-nums"
            />
          </div>

          <button
            type="submit"
            className="w-full h-11 bg-rose-600 text-white rounded-xl font-semibold text-sm hover:bg-rose-700 transition shadow-sm flex items-center justify-center"
          >
            Подтвердить платёж
          </button>
        </form>
      </div>
    </div>
  );
});

export const ProfileEditModal = React.memo(function ProfileEditModal({
  isOpen,
  onClose,
  userProfiles,
  onSaveProfiles,
  deviceOwner,
  onSaveDeviceOwner,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  const backdropDismiss = useBackdropDismiss(onClose);

  const [p1Name, setP1Name] = useState(userProfiles?.husband?.name || 'Партнер 1');
  const [p1Emoji, setP1Emoji] = useState(userProfiles?.husband?.emoji || '🧔🏻‍♂️');
  const [p2Name, setP2Name] = useState(userProfiles?.wife?.name || 'Партнер 2');
  const [p2Emoji, setP2Emoji] = useState(userProfiles?.wife?.emoji || '👩🏼');
  const [selectedOwner, setSelectedOwner] = useState(deviceOwner || 'husband');

  useEffect(() => {
    if (isOpen) {
      setP1Name(userProfiles?.husband?.name || 'Партнер 1');
      setP1Emoji(userProfiles?.husband?.emoji || '🧔🏻‍♂️');
      setP2Name(userProfiles?.wife?.name || 'Партнер 2');
      setP2Emoji(userProfiles?.wife?.emoji || '👩🏼');
      setSelectedOwner(deviceOwner || 'husband');
    }
  }, [isOpen, userProfiles, deviceOwner]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveProfiles({
      husband: { id: 'husband', name: p1Name.trim() || 'Партнер 1', emoji: p1Emoji, color: 'blue' },
      wife: { id: 'wife', name: p2Name.trim() || 'Партнер 2', emoji: p2Emoji, color: 'rose' },
    });
    onSaveDeviceOwner(selectedOwner);
    onClose();
  };

  const AVATARS = ['🧔🏻‍♂️', '👩🏼', '🧑🏻‍💻', '👩🏻‍🎨', '🦁', '🦊', '🐱', '🚀', '⚡', '💎', '🎯', '☕', '🎮', '🌸', '☀️', '🌿'];

  return (
    <div
      {...backdropDismiss}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center text-base">
              👤
            </span>
            <span id="profile-modal-title" className="font-semibold text-stone-900 text-sm">
              Настройка профилей и владельца
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Партнер 1 */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">Профиль 1</span>
              <span className="text-lg">{p1Emoji}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-stone-500 block mb-1">Имя</label>
                <input
                  type="text"
                  required
                  value={p1Name}
                  onChange={(e) => setP1Name(e.target.value)}
                  className="w-full h-9 text-xs font-semibold px-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-stone-500 block mb-1">Эмодзи</label>
                <input
                  type="text"
                  value={p1Emoji}
                  onChange={(e) => setP1Emoji(e.target.value)}
                  className="w-full h-9 text-center text-sm font-semibold bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap pt-1">
              {AVATARS.slice(0, 8).map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setP1Emoji(av)}
                  className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center border transition ${
                    p1Emoji === av ? 'border-stone-900 bg-stone-200 font-bold' : 'border-stone-200 bg-white hover:bg-stone-100'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Партнер 2 */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900">Профиль 2</span>
              <span className="text-lg">{p2Emoji}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-stone-500 block mb-1">Имя</label>
                <input
                  type="text"
                  required
                  value={p2Name}
                  onChange={(e) => setP2Name(e.target.value)}
                  className="w-full h-9 text-xs font-semibold px-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-stone-500 block mb-1">Эмодзи</label>
                <input
                  type="text"
                  value={p2Emoji}
                  onChange={(e) => setP2Emoji(e.target.value)}
                  className="w-full h-9 text-center text-sm font-semibold bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap pt-1">
              {AVATARS.slice(8).map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setP2Emoji(av)}
                  className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center border transition ${
                    p2Emoji === av ? 'border-stone-900 bg-stone-200 font-bold' : 'border-stone-200 bg-white hover:bg-stone-100'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Кто держит этот телефон / устройство прямо сейчас */}
          <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/70 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-800 text-xs font-bold">📱 Владелец этого устройства:</span>
            </div>
            <p className="text-[11px] text-amber-900/80 leading-relaxed">
              Приложение запомнит, чей это телефон, и будет открывать ваш личный кошелек первым по умолчанию.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedOwner('husband')}
                className={`h-9 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 border ${
                  selectedOwner === 'husband'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                    : 'bg-white text-stone-700 border-amber-200/80 hover:bg-amber-100/50'
                }`}
              >
                <span>{p1Emoji}</span>
                <span className="truncate">{p1Name || 'Партнер 1'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedOwner('wife')}
                className={`h-9 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 border ${
                  selectedOwner === 'wife'
                    ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                    : 'bg-white text-stone-700 border-amber-200/80 hover:bg-amber-100/50'
                }`}
              >
                <span>{p2Emoji}</span>
                <span className="truncate">{p2Name || 'Партнер 2'}</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-11 bg-stone-900 text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition flex items-center justify-center"
          >
            Сохранить настройки
          </button>
        </form>
      </div>
    </div>
  );
});

export const SafeLimitConfigModal = React.memo(function SafeLimitConfigModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  currentSafeBalance = 0,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  const backdropDismiss = useBackdropDismiss(onClose);

  const [mode, setMode] = useState(config?.mode || 'paydays');
  const [day1, setDay1] = useState(config?.paydays?.[0] ?? 10);
  const [day2, setDay2] = useState(config?.paydays?.[1] ?? 25);
  const [fixedDays, setFixedDays] = useState(config?.fixedDays || 14);

  useEffect(() => {
    if (isOpen) {
      setMode(config?.mode || 'paydays');
      setDay1(config?.paydays?.[0] ?? 10);
      setDay2(config?.paydays?.[1] ?? 25);
      setFixedDays(config?.fixedDays || 14);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const paydaysArray = [];
  if (day1 && Number(day1) >= 1 && Number(day1) <= 31) paydaysArray.push(Number(day1));
  if (day2 && Number(day2) >= 1 && Number(day2) <= 31 && Number(day2) !== Number(day1)) paydaysArray.push(Number(day2));
  if (paydaysArray.length === 0) paydaysArray.push(10, 25);

  const draftConfig = {
    mode,
    paydays: paydaysArray,
    fixedDays: Math.max(1, Math.min(365, Number(fixedDays) || 14)),
  };

  const horizon = calculateHorizonDays(draftConfig, new Date());
  const dailyPreview = Math.max(0, Math.round(currentSafeBalance / horizon.days));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveConfig(draftConfig);
    onClose();
  };

  const applyPaydayPreset = (d1, d2) => {
    setDay1(d1);
    setDay2(d2);
  };

  return (
    <div
      {...backdropDismiss}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safe-limit-modal-title"
    >
      <div ref={modalRef} className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-base">
              ⚡
            </span>
            <div>
              <span id="safe-limit-modal-title" className="font-semibold text-stone-900 text-sm block">
                Горизонт безопасного лимита
              </span>
              <span className="text-[11px] text-stone-500">
                На какой срок делить свободные деньги
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="w-8 h-8 flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Режимы горизонта */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200/80">
            <button
              type="button"
              onClick={() => setMode('paydays')}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition ${
                mode === 'paydays' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              📅 До ЗП / аванса
            </button>
            <button
              type="button"
              onClick={() => setMode('month')}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition ${
                mode === 'month' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              🗓️ Конец месяца
            </button>
            <button
              type="button"
              onClick={() => setMode('days')}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition ${
                mode === 'days' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              ⏳ Срок в днях
            </button>
            <button
              type="button"
              onClick={() => setMode('end_of_year')}
              className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition ${
                mode === 'end_of_year' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              🎯 До конца года
            </button>
          </div>

          {/* Параметры режима: Дни зарплаты */}
          {mode === 'paydays' && (
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-3">
              <div className="text-xs font-bold text-stone-900">
                Числа месяца для выплат (получка / аванс):
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Укажите, в какие числа приходят деньги. Приложение автоматически рассчитает дни до ближайшего пополнения.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-stone-600 block mb-1">
                    1-я выплата (число)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={day1}
                    onChange={(e) => setDay1(e.target.value)}
                    className="w-full h-9 text-xs font-semibold px-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-stone-600 block mb-1">
                    2-я выплата (число)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={day2}
                    onChange={(e) => setDay2(e.target.value)}
                    placeholder="Необязательно"
                    className="w-full h-9 text-xs font-semibold px-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
                  />
                </div>
              </div>

              {/* Пресеты */}
              <div className="flex gap-1.5 flex-wrap pt-1">
                {[
                  { label: '10 и 25', d1: 10, d2: 25 },
                  { label: '5 и 20', d1: 5, d2: 20 },
                  { label: '1 и 15', d1: 1, d2: 15 },
                  { label: 'Только 10-е', d1: 10, d2: '' },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPaydayPreset(p.d1, p.d2)}
                    className="px-2 py-1 rounded-md text-[11px] font-medium bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Параметры режима: Срок в днях */}
          {mode === 'days' && (
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-3">
              <label className="text-xs font-bold text-stone-900 block">
                Количество дней для распределения:
              </label>
              <input
                type="number"
                min="1"
                max="365"
                required
                value={fixedDays}
                onChange={(e) => setFixedDays(e.target.value)}
                className="w-full h-9 text-xs font-semibold px-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
              <div className="flex gap-1.5 flex-wrap">
                {[7, 14, 30, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFixedDays(d)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                      Number(fixedDays) === d
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white border-stone-200 hover:bg-stone-100 text-stone-700'
                    }`}
                  >
                    {d} дней
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Режим: До конца месяца */}
          {mode === 'month' && (
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] text-stone-600 leading-relaxed">
              Классический режим: свободные средства делятся на дни, оставшиеся до последнего числа текущего календарного месяца.
            </div>
          )}

          {/* Режим: До конца года */}
          {mode === 'end_of_year' && (
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] text-stone-600 leading-relaxed">
              Годовой горизонт: расчет дневного лимита до 31 декабря текущего года. Подходит для оценки долгосрочного темпа жизни.
            </div>
          )}

          {/* Блок живого предпросмотра */}
          <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200/80 space-y-1.5">
            <div className="text-[11px] font-bold text-amber-900 flex items-center justify-between">
              <span>Итоговый горизонт:</span>
              <span className="text-amber-800 text-xs">{horizon.days} дн. ({horizon.label})</span>
            </div>
            <div className="text-[11px] text-amber-800/90 flex items-center justify-between">
              <span>Дневной лимит при остатке:</span>
              <span className="font-bold text-amber-950 text-sm tabular-nums">
                {dailyPreview.toLocaleString('ru-RU')} ₽/день
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-11 bg-stone-900 text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition flex items-center justify-center shadow-sm"
          >
            Сохранить горизонт
          </button>
        </form>
      </div>
    </div>
  );
});
