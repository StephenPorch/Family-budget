import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Edit3, X, Lock, Calendar, Pin, Check } from 'lucide-react';
import { getLocalDateString, getOffsetDateString } from '../../utils/dateUtils.js';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../../utils/storage.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useBackdropDismiss } from '../../hooks/useBackdropDismiss.js';

export const TransactionModal = React.memo(function TransactionModal({
  isOpen,
  onClose,
  initialTx,
  presetConfig,
  currentUser,
  userProfiles,
  isLockedType,
  customCategories,
  onCreateCustomCategory,
  onDeleteCustomCategory,
  onSaveTransaction,
  onDeleteTransaction,
}) {
  const modalRef = useRef(null);
  useFocusTrap(isOpen, modalRef);
  const backdropDismiss = useBackdropDismiss(onClose);

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
      {...backdropDismiss}
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[94vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
              <Edit3 className="w-4 h-4" />
            </span>
            <span id="add-modal-title" className="font-semibold text-stone-900 text-sm">
              {initialTx ? 'Редактирование операции' : 'Запись расхода / дохода'}
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

        <form onSubmit={(e) => submitForm(e, false)} className="pt-4 space-y-4">
          {/* Переключатель Расход / Доход — фиксированная высота h-10 */}
          <div className="grid grid-cols-2 gap-1 bg-stone-100 p-1 rounded-xl h-10">
            <button
              type="button"
              disabled={isLockedType}
              onClick={() => handleTypeSwitch('expense')}
              className={`h-8 text-xs font-semibold rounded-lg transition flex items-center justify-center ${
                txType === 'expense' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              } ${isLockedType ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              Расход (−)
            </button>
            <button
              type="button"
              disabled={isLockedType}
              onClick={() => handleTypeSwitch('income')}
              className={`h-8 text-xs font-semibold rounded-lg transition flex items-center justify-center ${
                txType === 'income' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              } ${isLockedType ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              Доход (+)
            </button>
          </div>

          {isLockedType && (
            <div className="flex items-center gap-2 text-xs text-amber-900 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Тип и категория заблокированы, так как операция связана с копилкой, кредитом или регулярным счетом</span>
            </div>
          )}

          {/* Блок ввода суммы + быстрые чипы фиксированной высоты h-8 */}
          <div className="space-y-2">
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
                className="w-full h-14 text-2xl sm:text-3xl font-bold pl-4 pr-12 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-stone-400 pointer-events-none">
                ₽
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {[100, 300, 500, 1000, 3000].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String((Number(amount) || 0) + v))}
                  className="h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs font-semibold text-stone-700 transition flex items-center justify-center tabular-nums"
                >
                  +{v}
                </button>
              ))}
              <button
                type="button"
                disabled={!amount}
                onClick={() => setAmount('')}
                className={`h-8 rounded-lg text-xs font-semibold transition flex items-center justify-center ${
                  amount
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                    : 'bg-stone-50 text-stone-300 cursor-not-allowed'
                }`}
              >
                Сброс
              </button>
            </div>
          </div>

          {/* Блок даты и пакетного режима — все элементы выровнены по сетке h-9 */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Дата операции:</span>
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: 'Сегодня', val: getLocalDateString() },
                  { label: 'Вчера', val: getOffsetDateString(-1) },
                  { label: 'Позавчера', val: getOffsetDateString(-2) },
                ].map(btn => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => setTxDate(btn.val)}
                    className={`h-7 px-2 rounded-lg text-xs font-medium transition flex items-center justify-center ${
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
                className="flex-1 h-9 text-xs font-semibold px-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 tabular-nums"
              />
              {!initialTx && (
                <button
                  type="button"
                  onClick={() => setIsBatchReceiptMode(!isBatchReceiptMode)}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold border transition inline-flex items-center gap-1.5 shrink-0 ${
                    isBatchReceiptMode
                      ? 'bg-amber-100 border-amber-300 text-amber-950'
                      : 'bg-white border-stone-200 text-stone-700 hover:text-stone-900'
                  }`}
                  title="Не закрывать окно после записи и сохранять выбранную дату для ввода нескольких чеков подряд"
                >
                  <Pin className="w-3.5 h-3.5 shrink-0" />
                  <span>Пачка чеков</span>
                </button>
              )}
            </div>
          </div>

          {/* Источник / получатель средств — фиксированная высота h-10 */}
          <div>
            <label className="text-xs font-medium text-stone-600 block mb-1.5">
              Источник / получатель средств:
            </label>
            <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl h-10">
              <button
                type="button"
                onClick={() => {
                  setSelectedAccount('shared');
                  setTxAuthor(currentUser);
                }}
                className={`h-8 px-1 text-xs font-semibold rounded-lg transition truncate flex items-center justify-center ${
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
                className={`h-8 px-1 text-xs font-semibold rounded-lg transition truncate flex items-center justify-center gap-1 ${
                  selectedAccount === 'personal' && txAuthor === 'husband'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title={`Личный счет: ${userProfiles?.husband?.name || 'Партнер 1'}`}
              >
                <span>{userProfiles?.husband?.emoji || '🧔🏻‍♂️'}</span>
                <span className="truncate">{userProfiles?.husband?.name || 'Партнер 1'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedAccount('personal');
                  setTxAuthor('wife');
                }}
                className={`h-8 px-1 text-xs font-semibold rounded-lg transition truncate flex items-center justify-center gap-1 ${
                  selectedAccount === 'personal' && txAuthor === 'wife'
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title={`Личный счет: ${userProfiles?.wife?.name || 'Партнер 2'}`}
              >
                <span>{userProfiles?.wife?.emoji || '👩🏼'}</span>
                <span className="truncate">{userProfiles?.wife?.name || 'Партнер 2'}</span>
              </button>
            </div>
          </div>

          {/* Категории — все кнопки фиксированной высоты h-10 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
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
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl mb-3 space-y-2 animate-fade-in">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="🏷️"
                    value={newCatIcon}
                    onChange={(e) => setNewCatIcon(e.target.value)}
                    aria-label="Эмодзи категории"
                    className="w-10 h-9 text-center text-base bg-white border border-stone-200 rounded-lg focus:outline-none shrink-0"
                  />
                  <input
                    type="text"
                    placeholder="Название категории..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    aria-label="Название новой категории"
                    className="flex-1 h-9 text-xs px-3 bg-white border border-stone-200 rounded-lg focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    aria-label="Сохранить категорию"
                    className="w-9 h-9 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-800 transition flex items-center justify-center shrink-0"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
                {txType === 'expense' && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-stone-600">Корзина 50/30/20:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewCatBucket('base')}
                        className={`h-7 px-2.5 rounded-lg text-xs font-medium ${
                          newCatBucket === 'base' ? 'bg-stone-900 text-white' : 'bg-white text-stone-700 border border-stone-200'
                        }`}
                      >
                        🏠 База (50%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCatBucket('wants')}
                        className={`h-7 px-2.5 rounded-lg text-xs font-medium ${
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
                    className={`w-full h-10 px-2.5 rounded-xl flex items-center gap-2 text-left border transition ${
                      selectedCategory === c.name
                        ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                        : 'border-stone-200/80 bg-stone-50 text-stone-700 hover:bg-stone-100'
                    } ${isLockedType ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-sm shrink-0">{c.icon}</span>
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

          {/* Комментарий — фиксированная высота h-10 */}
          <div>
            <input
              type="text"
              placeholder="Комментарий по чеку (необязательно, например: ВкусВилл)"
              value={txTitle}
              onChange={(e) => setTxTitle(e.target.value)}
              aria-label="Комментарий к операции"
              className="w-full h-10 text-xs px-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
            />
          </div>

          {/* Кнопки действия — фиксированная высота h-11 */}
          <div className="flex items-center gap-2 pt-1">
            {initialTx ? (
              <>
                <button
                  type="button"
                  onClick={(e) => onDeleteTransaction(initialTx.id, e)}
                  className="h-11 px-4 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-semibold text-xs transition inline-flex items-center justify-center"
                >
                  Удалить
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 bg-stone-900 text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition shadow-sm inline-flex items-center justify-center"
                >
                  Сохранить изменения
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => submitForm(e, true)}
                  className="h-11 px-3.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl font-semibold text-xs transition shrink-0 inline-flex items-center justify-center"
                  title="Сохранить этот чек и сразу ввести следующий за эту же дату"
                >
                  + Ещё чек
                </button>
                <button
                  type="submit"
                  className="flex-1 h-11 bg-stone-900 text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition active:scale-[0.99] shadow-sm inline-flex items-center justify-center tabular-nums"
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
