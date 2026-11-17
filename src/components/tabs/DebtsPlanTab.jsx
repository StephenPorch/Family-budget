import React from 'react';
import {
  ShieldCheck, BarChart3, CreditCard, Bell, Plus,
  CheckCircle2, Users, Edit3, Trash2, TrendingUp, Sparkles, Check, X
} from 'lucide-react';
import { getCurrentMonthPrefix, MONTH_NAMES_NOMINATIVE } from '../../utils/dateUtils.js';
import { getCategoryMeta, getRecurringReminderStatus, calculateDebtPayoff } from '../../utils/financeCore.js';

export const DebtsPlanTab = React.memo(function DebtsPlanTab({
  stats,
  pendingBillsCount,
  expenseForecastData,
  recurringPayments,
  debts,
  selectedMonth,
  customCategories,
  safeProfiles,
  setEditingRecurringId,
  setNewRecTitle,
  setNewRecAmount,
  setNewRecCategory,
  setNewRecDueDate,
  setNewRecAccount,
  setNewRecMandatory,
  setIsNewRecurringModalOpen,
  openPayRecurringModal,
  openEditRecurringModal,
  handleDeleteRecurring,
  handleApplyAutoForecastLimits,
  editingPlanCategory,
  setEditingPlanCategory,
  editingPlanValue,
  setEditingPlanValue,
  handleSaveCategoryLimit,
  setEditingDebtId,
  setNewDebtTitle,
  setNewDebtInitial,
  setNewDebtRemaining,
  setNewDebtPayment,
  setIsNewDebtModalOpen,
  openEditDebtModal,
  handleDeleteDebt,
  openPayDebtModal,
}) {
  return (
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
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
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
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-emerald-700 shrink-0" />
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
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-rose-600 shrink-0" />
          </div>
        </div>
      </div>

      {/* РАЗДЕЛ 1: СПИСОК ПОСТОЯННЫХ ОБЯЗАТЕЛЬНЫХ РАСХОДОВ */}
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
                  <div key={rec.id} className="py-3 px-2 sm:px-3 hover:bg-stone-50/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition border border-transparent hover:border-stone-200/60">
                    {/* Верхняя строка на мобильных / Левая колонка на десктопе */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 w-full sm:flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 mt-0.5 sm:mt-0 ${
                        isPaid ? 'bg-emerald-50 text-emerald-700' : st.code === 'overdue' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <span>{catMeta.icon}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-stone-900 flex items-center gap-2 flex-wrap">
                          <span className="truncate">{rec.title}</span>
                          <span className={`h-5 px-2 rounded-md text-[11px] font-medium border inline-flex items-center shrink-0 ${st.badgeClass}`}>
                            {st.label}
                          </span>
                          {rec.isMandatory === false && (
                            <span className="h-5 px-1.5 rounded-md bg-stone-100 text-stone-600 text-[11px] font-medium inline-flex items-center shrink-0">
                              Необязательный
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-stone-600">{rec.category}</span>
                          <span className="text-stone-300">•</span>
                          <span className="inline-flex items-center gap-1">
                            {(rec.account || 'shared') === 'shared'
                              ? <>
                                  <Users className="w-3 h-3 text-stone-400 shrink-0" />
                                  <span>Общий котел</span>
                                </>
                              : rec.author === 'wife'
                              ? <span>{safeProfiles.wife?.emoji || '👩🏼'} {safeProfiles.wife?.name || 'Партнер 2'}</span>
                              : <span>{safeProfiles.husband?.emoji || '🧔🏻‍♂️'} {safeProfiles.husband?.name || 'Партнер 1'}</span>}
                          </span>
                          <span className="text-stone-300">•</span>
                          <span className="tabular-nums">До {rec.dueDate}-го числа</span>
                        </div>
                      </div>
                    </div>

                    {/* Нижняя строка на мобильных (с разделителем) / Правая колонка на десктопе */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 ml-0 sm:ml-auto">
                      <div className="text-left sm:text-right tabular-nums shrink-0">
                        <div className="text-sm sm:text-base font-bold text-stone-900 leading-tight">
                          {Number(rec.amount).toLocaleString('ru-RU')} ₽
                        </div>
                        <div className="text-[11px] text-stone-500">
                          план в мес.
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPaid ? (
                          <span className="w-[100px] sm:w-[104px] h-8 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 inline-flex items-center justify-center shrink-0">
                            ✓ Оплачено
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openPayRecurringModal(rec)}
                            className="w-[100px] sm:w-[104px] h-8 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition shadow-sm inline-flex items-center justify-center shrink-0"
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
              const payoff = calculateDebtPayoff(debt);
              const { total: init, paid, remaining: rem, progressPct: percent, monthsLeft, isRegular, monthly } = payoff;

              const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
              const isPaidThisMonth = (debt.paidMonths || []).includes(targetYm);

              let forecastText = 'Полностью закрыт! 🎉';
              if (rem > 0) {
                if (!isRegular || monthly <= 0) {
                  forecastText = 'По мере возможности';
                } else if (monthsLeft && monthsLeft > 0) {
                  const now = new Date();
                  const offsetMonths = Math.max(0, monthsLeft - (isPaidThisMonth ? 0 : 1));
                  const closeDate = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
                  forecastText = `${monthsLeft} пл. (${MONTH_NAMES_NOMINATIVE[closeDate.getMonth()]} ${closeDate.getFullYear()})`;
                }
              }

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
                            {!isRegular
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
                      <span className={`text-xs font-medium ${isPaidThisMonth ? 'text-emerald-700' : (!isRegular ? 'text-stone-500' : 'text-amber-800')}`}>
                        {isPaidThisMonth ? '✓ Платёж за месяц внесен' : (!isRegular ? 'Свободный график' : 'Платёж за месяц ожидает')}
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
  );
});
