import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Edit3, X, Lock, Calendar, Pin, Check } from 'lucide-react';
import { getLocalDateString, getOffsetDateString } from '../../utils/dateUtils.js';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../../utils/storage.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

export const TransactionModal = React.memo(function TransactionModal({
  isOpen,
  onClose,
  initialTx,
  presetConfig,
  currentUser,
  isLockedType,
  customCategories,
  onCreateCustomCategory,
  onDeleteCustomCategory,
  onSaveTransaction,
  onDeleteTransaction,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);

  const [amount, setAmount] = useState('');
  const [txTitle, setTxTitle] = useState('');
  const [txType, setTxType] = useState('expense');
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_EXPENSE_CATEGORIES[0].name);
  const [selectedAccount, setSelectedAccount] = useState('shared');
  const [txAuthor, setTxAuthor] = useState('husband');
  const [txDate, setTxDate] = useState(getLocalDateString);
  const [isBatchReceiptMode, setIsBatchReceiptMode] = useState(false);

  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🏷️');
  const [newCatBucket, setNewCatBucket] = useState('base');

  useEffect(() => {
    if (!isOpen) return;
    if (initialTx) {
      setAmount(String(initialTx.amount));
      setTxTitle(initialTx.title === initialTx.category ? '' : initialTx.title);
      setTxType(initialTx.type);
      setSelectedCategory(initialTx.category);
      setSelectedAccount(initialTx.account || 'shared');
      setTxAuthor(initialTx.author || currentUser);
      setTxDate(initialTx.date || getLocalDateString());
    } else {
      setAmount('');
      setTxTitle('');
      setTxType('expense');
      setSelectedCategory(DEFAULT_EXPENSE_CATEGORIES[0].name);
      setSelectedAccount(presetConfig?.account || 'shared');
      setTxAuthor(presetConfig?.author || currentUser);
      setTxDate(presetConfig?.date || getLocalDateString());
      setIsBatchReceiptMode(Boolean(presetConfig?.batchMode));
    }
    setIsAddingCustomCategory(false);
    setIsManagingCategories(false);
  }, [isOpen, initialTx, presetConfig, currentUser]);

  const activeCategories = useMemo(() => {
    if (txType === 'income') {
      return [...DEFAULT_INCOME_CATEGORIES, ...customCategories.filter(c => c.type === 'income')];
    }
    return [...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type !== 'income')];
  }, [txType, customCategories]);

  if (!isOpen) return null;

  const handleTypeSwitch = (newType) => {
    if (isLockedType) return;
    setTxType(newType);
    setIsAddingCustomCategory(false);
    if (newType === 'income') {
      const exists = [...DEFAULT_INCOME_CATEGORIES, ...customCategories.filter(c => c.type === 'income')].some(c => c.name === selectedCategory);
      if (!exists) setSelectedCategory(DEFAULT_INCOME_CATEGORIES[0].name);
    } else {
      const exists = [...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.filter(c => c.type !== 'income')].some(c => c.name === selectedCategory);
      if (!exists) setSelectedCategory(DEFAULT_EXPENSE_CATEGORIES[0].name);
    }
  };

  const handleAddCategory = (e) => {
    e?.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    onCreateCustomCategory({
      name: trimmed,
      icon: newCatIcon.trim() || (txType === 'income' ? '💵' : '🏷️'),
      type: txType,
      bucket: txType === 'income' ? 'income' : newCatBucket,
    });
    setSelectedCategory(trimmed);
    setNewCatName('');
    setIsAddingCustomCategory(false);
  };

  const submitForm = (e, keepOpenOverride = false) => {
    e?.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) return;

    const stayOpen = !initialTx && Boolean(keepOpenOverride || isBatchReceiptMode);
    onSaveTransaction({
      id: initialTx?.id || null,
      amount: num,
      title: txTitle.trim() || selectedCategory,
      type: txType,
      category: selectedCategory,
      account: selectedAccount,
      author: txAuthor,
      date: txDate || getLocalDateString(),
      stayOpen,
    });

    if (stayOpen) {
      setAmount('');
      setTxTitle('');
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[94vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-stone-600" />
            <span id="add-modal-title" className="font-semibold text-stone-900 text-sm">
              {initialTx ? 'Редактирование операции' : 'Запись расхода / дохода'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть модальное окно"
            className="text-stone-500 hover:text-stone-800 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => submitForm(e, false)} className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-1.5 bg-stone-100 p-1 rounded-2xl relative">
            <button
              type="button"
              disabled={isLockedType}
              onClick={() => handleTypeSwitch('expense')}
              className={`py-2 text-xs font-semibold rounded-xl transition ${
                txType === 'expense' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
              } ${isLockedType ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              Расход (−)
            </button>
            <button
              type="button"
              disabled={isLockedType}
              onClick={() => handleTypeSwitch('income')}
              className={`py-2 text-xs font-semibold rounded-xl transition ${
                txType === 'income' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-600'
              } ${isLockedType ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              Доход (+)
            </button>
          </div>

          {isLockedType && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Тип и категория заблокированы, так как операция связана с копилкой, кредитом или регулярным счетом</span>
            </div>
          )}

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
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-stone-500 pointer-events-none">
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
                  className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-medium text-rose-700 whitespace-nowrap transition ml-auto"
                >
                  Сброс
                </button>
              )}
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Дата чека / операции:</span>
              </label>
              <div className="flex items-center gap-1">
                {[
                  { label: 'Сегодня', val: getLocalDateString() },
                  { label: 'Вчера', val: getOffsetDateString(-1) },
                  { label: 'Позавчера', val: getOffsetDateString(-2) },
                ].map(btn => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => setTxDate(btn.val)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                      txDate === btn.val
                        ? 'bg-stone-900 text-white'
                        : 'bg-white border border-stone-200 text-stone-700 hover:text-stone-900'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                aria-label="Дата операции"
                className="flex-1 text-xs font-semibold px-3 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
              />
              {!initialTx && (
                <button
                  type="button"
                  onClick={() => setIsBatchReceiptMode(!isBatchReceiptMode)}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition flex items-center gap-1 shrink-0 ${
                    isBatchReceiptMode
                      ? 'bg-amber-100 border-amber-300 text-amber-950'
                      : 'bg-white border-stone-200 text-stone-700 hover:text-stone-900'
                  }`}
                  title="Не закрывать окно после записи и сохранять выбранную дату для ввода нескольких чеков подряд"
                >
                  <Pin className="w-3 h-3" />
                  <span>Пачка чеков</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-stone-600 block mb-1">
              Источник / получатель средств:
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setSelectedAccount('shared');
                  setTxAuthor(currentUser);
                }}
                className={`py-2 px-1 text-xs font-semibold rounded-xl transition truncate text-center ${
                  selectedAccount === 'shared'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                👥 Общий котел
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedAccount('personal');
                  setTxAuthor('husband');
                }}
                className={`py-2 px-1 text-xs font-semibold rounded-xl transition truncate text-center ${
                  selectedAccount === 'personal' && txAuthor === 'husband'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                🧔🏻‍♂️ Карта мужа
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedAccount('personal');
                  setTxAuthor('wife');
                }}
                className={`py-2 px-1 text-xs font-semibold rounded-xl transition truncate text-center ${
                  selectedAccount === 'personal' && txAuthor === 'wife'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                👩🏼 Карта жены
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-stone-600">
                Категория
              </label>
              <div className="flex items-center gap-2">
                {customCategories.some(c => (txType === 'income' ? c.type === 'income' : c.type !== 'income')) && (
                  <button
                    type="button"
                    onClick={() => setIsManagingCategories(!isManagingCategories)}
                    className="text-xs font-medium text-stone-600 hover:text-stone-900"
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
                    onClick={handleAddCategory}
                    aria-label="Сохранить категорию"
                    className="px-3 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
                {txType === 'expense' && (
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-stone-600">Корзина 50/30/20:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setNewCatBucket('base')}
                        className={`px-2 py-1 rounded-lg font-medium ${
                          newCatBucket === 'base' ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 border border-stone-200'
                        }`}
                      >
                        🏠 База (50%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCatBucket('wants')}
                        className={`px-2 py-1 rounded-lg font-medium ${
                          newCatBucket === 'wants' ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 border border-stone-200'
                        }`}
                      >
                        ☕ Хотелки (30%)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {activeCategories.map(c => (
                <div key={c.id} className="relative">
                  <button
                    type="button"
                    disabled={isLockedType}
                    onClick={() => setSelectedCategory(c.name)}
                    className={`w-full px-2.5 py-2 rounded-2xl flex items-center gap-2 text-left border transition ${
                      selectedCategory === c.name
                        ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                        : 'border-stone-200/70 bg-stone-50 text-stone-700 hover:bg-stone-100'
                    } ${isLockedType ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-base shrink-0">{c.icon}</span>
                    <span className="text-xs font-medium truncate">{c.name}</span>
                  </button>
                  {isManagingCategories && c.id.startsWith('cat_') && (
                    <button
                      type="button"
                      onClick={(e) => onDeleteCustomCategory(e, c.id)}
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

          <div>
            <input
              type="text"
              placeholder="Комментарий по чеку (необязательно, например: ВкусВилл)"
              value={txTitle}
              onChange={(e) => setTxTitle(e.target.value)}
              aria-label="Комментарий к операции"
              className="w-full text-xs px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            {initialTx ? (
              <>
                <button
                  type="button"
                  onClick={(e) => onDeleteTransaction(initialTx.id, e)}
                  className="px-4 py-3.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-2xl font-semibold text-xs transition"
                >
                  Удалить
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition shadow-md"
                >
                  Сохранить изменения
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => submitForm(e, true)}
                  className="px-3.5 py-3.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-2xl font-semibold text-xs transition shrink-0"
                  title="Сохранить этот чек и сразу ввести следующий за эту же дату"
                >
                  + Ещё чек
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-stone-900 text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition active:scale-[0.99] shadow-md"
                >
                  {isBatchReceiptMode ? `Записать за ${txDate.slice(8, 10)}.${txDate.slice(5, 7)}` : 'Записать'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
});
