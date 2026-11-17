import React from 'react';
import { Target, CreditCard, ShieldCheck, ArrowRightLeft, Trash2 } from 'lucide-react';
import { getCategoryMeta, getWalletKeyFromTx } from '../utils/financeCore.js';

export const TransactionRow = React.memo(function TransactionRow({
  tx,
  customCategories,
  safeProfiles,
  onEdit,
  onDelete,
}) {
  const catObj = getCategoryMeta(tx.category, tx.type, customCategories);
  const isTransfer = tx.type === 'transfer';
  const isExpense = tx.type === 'expense';
  const isShared = (tx.account || 'shared') === 'shared';

  const getShortWalletLabel = (wKey) => {
    if (wKey === 'husband') return `${safeProfiles.husband?.emoji || '🧔🏻‍♂️'} ${safeProfiles.husband?.name || 'Партнер 1'}`;
    if (wKey === 'wife') return `${safeProfiles.wife?.emoji || '👩🏼'} ${safeProfiles.wife?.name || 'Партнер 2'}`;
    return 'Общий котел';
  };

  return (
    <div
      onClick={() => onEdit(tx)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(tx);
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
              <span className="h-5 px-1.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200/60 text-[11px] font-medium inline-flex items-center shrink-0 gap-1">
                <Target className="w-3 h-3 text-violet-600 shrink-0" />
                <span>Копилка</span>
              </span>
            )}
            {tx.debtId && (
              <span className="h-5 px-1.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200/60 text-[11px] font-medium inline-flex items-center shrink-0 gap-1">
                <CreditCard className="w-3 h-3 text-rose-600 shrink-0" />
                <span>Долг</span>
              </span>
            )}
            {tx.recurringId && (
              <span className="h-5 px-1.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200/60 text-[11px] font-medium inline-flex items-center shrink-0 gap-1">
                <ShieldCheck className="w-3 h-3 text-blue-600 shrink-0" />
                <span>Постоянный</span>
              </span>
            )}
            {isTransfer && (
              <span className="h-5 px-1.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[11px] font-medium inline-flex items-center shrink-0 gap-1">
                <ArrowRightLeft className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>Перевод</span>
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
          onClick={(e) => onDelete(tx.id, e)}
          aria-label={`Удалить операцию ${tx.title}`}
          className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition shrink-0"
          title="Удалить"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
