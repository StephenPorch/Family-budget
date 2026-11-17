import React from 'react';
import {
  Bell, Users, SlidersHorizontal, AlertCircle, TrendingUp,
  ShieldCheck, CheckCircle2, Target, ArrowUpRight, User, Calendar, Sparkles
} from 'lucide-react';
import { getCurrentMonthPrefix } from '../../utils/dateUtils.js';
import { ChartsSection } from '../analytics/ChartsSection.jsx';
import { TransactionRow } from '../TransactionRow.jsx';

export const DashboardTab = React.memo(function DashboardTab({
  isOnboarded,
  onOpenOnboarding,
  onLoadDemoData,
  onDismissOnboarding,
  reminderSummary,
  openPayRecurringModal,
  setActiveTab,
  myWalletKey,
  partnerWalletKey,
  myProfile,
  partnerProfile,
  myWalletStats,
  partnerWalletStats,
  activeWalletCard,
  setActiveWalletCard,
  stats,
  setIsLimitModalOpen,
  chartView,
  setChartView,
  selectedMonth,
  burnDownData,
  rule503020Data,
  dynamics6MonthsData,
  partnerComparisonData,
  safeProfiles,
  safeLimitConfig,
  expenseForecastData,
  openWalletHistory,
  recurringPayments,
  openNewTransactionModal,
  periodTransactions,
  customCategories,
  openEditTransactionModal,
  handleDeleteTransaction,
}) {
  const p1Name = safeProfiles.husband?.name || 'Партнер 1';
  const p1Emoji = safeProfiles.husband?.emoji || '🧔🏻‍♂️';
  const p2Name = safeProfiles.wife?.name || 'Партнер 2';
  const p2Emoji = safeProfiles.wife?.emoji || '👩🏼';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ПАНЕЛЬ БЫСТРОГО СТАРТА ПРИ ЧИСТОМ ПЕРВОМ ЗАПУСКЕ */}
      {!isOnboarded && (
        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-stone-900">
                Чистый старт: настройте бюджет за 30 секунд
              </div>
              <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                Укажите имена партнеров, чей это телефон и текущие остатки на счетах — они зададут верный баланс без искажения доходов месяца.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition inline-flex items-center"
            >
              Настроить счета и остатки
            </button>
            <button
              type="button"
              onClick={onLoadDemoData}
              className="h-9 px-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition inline-flex items-center"
            >
              Загрузить демо-пример
            </button>
            <button
              type="button"
              onClick={onDismissOnboarding}
              className="h-9 px-3 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 text-xs font-medium transition inline-flex items-center"
            >
              Скрыть
            </button>
          </div>
        </div>
      )}

      {/* УМНАЯ НАПОМИНАЛКА О ГОРЯЩИХ И ПРОСРОЧЕННЫХ ОБЯЗАТЕЛЬНЫХ ПЛАТЕЖАХ */}
      {reminderSummary.urgentRecs.length > 0 && (
        <div className="bg-amber-50/95 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-950">
                Напоминалка по постоянным расходам ({reminderSummary.urgentRecs.length})
              </div>
              <div className="text-xs text-amber-900 mt-0.5 flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
                {reminderSummary.urgentRecs.slice(0, 3).map(r => (
                  <span key={r.id} className="inline-flex items-center gap-1">
                    <strong>{r.title}</strong>: {Number(r.amount).toLocaleString('ru-RU')} ₽ ({r.status.label})
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {reminderSummary.urgentRecs.length === 1 && (
              <button
                type="button"
                onClick={() => openPayRecurringModal(reminderSummary.urgentRecs[0])}
                className="h-9 px-3.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition inline-flex items-center"
              >
                Оплатить сейчас
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('debts')}
              className="h-9 px-3.5 rounded-xl bg-white border border-amber-300 text-amber-950 text-xs font-semibold hover:bg-amber-100 transition inline-flex items-center"
            >
              К списку платежей →
            </button>
          </div>
        </div>
      )}

      {/* 4 KPI-КАРТОЧКИ (Personal-First: Мой счет -> Партнер -> Семейный резерв -> Безопасный лимит) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
        {/* 1. Мой личный счет (владелец устройства) */}
        <div
          onClick={() => setActiveWalletCard(myWalletKey)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveWalletCard(myWalletKey); }}
          className={`h-[160px] p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
            activeWalletCard === myWalletKey
              ? 'bg-white border-stone-900 ring-2 ring-stone-900/10 shadow-md'
              : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-sm'
          }`}
        >
          <div className="h-6 flex items-center justify-between gap-1 text-stone-600">
            <span className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 truncate">
              <span>{myProfile.emoji}</span>
              <span className="truncate">{myProfile.name}</span>
            </span>
            <span className="h-5 px-2 rounded-md bg-stone-900 text-white text-[10px] font-semibold inline-flex items-center shrink-0">
              Мой счет
            </span>
          </div>

          <div className="my-auto">
            <div className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums leading-none truncate ${
              myWalletStats.balance < 0 ? 'text-rose-600' : 'text-stone-900'
            }`}>
              {myWalletStats.balance.toLocaleString('ru-RU')}
              <span className="text-xs font-normal text-stone-400 ml-1">₽</span>
            </div>
            <div className={`text-xs mt-1.5 truncate ${
              myWalletStats.balance < 0 ? 'text-rose-600 font-semibold' : 'text-stone-500'
            }`}>
              {myWalletStats.balance < 0 ? '⚠️ Дефицит счета' : 'Переходящий остаток'}
            </div>
          </div>

          <div className="h-7 pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs tabular-nums">
            <span className="text-emerald-700 font-semibold truncate">+{myWalletStats.monthIncome.toLocaleString('ru-RU')}</span>
            <span className="text-rose-600 font-semibold truncate">−{myWalletStats.monthExpense.toLocaleString('ru-RU')}</span>
          </div>
        </div>

        {/* 2. Личный счет партнера */}
        <div
          onClick={() => setActiveWalletCard(partnerWalletKey)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveWalletCard(partnerWalletKey); }}
          className={`h-[160px] p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
            activeWalletCard === partnerWalletKey
              ? 'bg-white border-stone-900 ring-2 ring-stone-900/10 shadow-md'
              : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-sm'
          }`}
        >
          <div className="h-6 flex items-center justify-between gap-1 text-stone-600">
            <span className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 truncate">
              <span>{partnerProfile.emoji}</span>
              <span className="truncate">{partnerProfile.name}</span>
            </span>
            <span className="h-5 px-2 rounded-md bg-stone-100 text-stone-600 text-[10px] font-semibold inline-flex items-center shrink-0">
              Партнер
            </span>
          </div>

          <div className="my-auto">
            <div className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums leading-none truncate ${
              partnerWalletStats.balance < 0 ? 'text-rose-600' : 'text-stone-900'
            }`}>
              {partnerWalletStats.balance.toLocaleString('ru-RU')}
              <span className="text-xs font-normal text-stone-400 ml-1">₽</span>
            </div>
            <div className={`text-xs mt-1.5 truncate ${
              partnerWalletStats.balance < 0 ? 'text-rose-600 font-semibold' : 'text-stone-500'
            }`}>
              {partnerWalletStats.balance < 0 ? '⚠️ Дефицит счета' : 'Переходящий остаток'}
            </div>
          </div>

          <div className="h-7 pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs tabular-nums">
            <span className="text-emerald-700 font-semibold truncate">+{partnerWalletStats.monthIncome.toLocaleString('ru-RU')}</span>
            <span className="text-rose-600 font-semibold truncate">−{partnerWalletStats.monthExpense.toLocaleString('ru-RU')}</span>
          </div>
        </div>

        {/* 3. Семейный резерв (Общий котел как подушка/копилка) */}
        <div
          onClick={() => setActiveWalletCard('shared')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveWalletCard('shared'); }}
          className={`h-[160px] p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left ${
            activeWalletCard === 'shared'
              ? 'bg-white border-stone-900 ring-2 ring-stone-900/10 shadow-md'
              : 'bg-white border-stone-200/80 hover:border-stone-300 shadow-sm'
          }`}
        >
          <div className="h-6 flex items-center justify-between gap-1 text-stone-600">
            <span className="text-xs font-semibold text-stone-600 flex items-center gap-1.5 truncate">
              <Users className="w-3.5 h-3.5 text-stone-600 shrink-0" />
              <span className="truncate">Семейный резерв</span>
            </span>
            <span className="h-5 px-2 rounded-md bg-stone-100 text-stone-600 text-[10px] font-semibold inline-flex items-center shrink-0">
              Копилка
            </span>
          </div>

          <div className="my-auto">
            <div className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums leading-none truncate ${
              stats.shared.balance < 0 ? 'text-rose-600' : 'text-stone-900'
            }`}>
              {stats.shared.balance.toLocaleString('ru-RU')}
              <span className="text-xs font-normal text-stone-400 ml-1">₽</span>
            </div>
            <div className={`text-xs mt-1.5 truncate ${
              stats.shared.balance < 0 ? 'text-rose-600 font-semibold' : 'text-stone-500'
            }`}>
              {stats.shared.balance < 0 ? '⚠️ Дефицит счета' : 'Подушка / Котел'}
            </div>
          </div>

          <div className="h-7 pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs tabular-nums">
            <span className="text-emerald-700 font-semibold truncate">+{stats.shared.monthIncome.toLocaleString('ru-RU')}</span>
            <span className="text-rose-600 font-semibold truncate">−{stats.shared.monthExpense.toLocaleString('ru-RU')}</span>
          </div>
        </div>

        {/* 4. Безопасный лимит в день / Индикатор кассового разрыва (Доминирующий якорь) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsLimitModalOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsLimitModalOpen(true); }}
          className={`h-[160px] text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col justify-between cursor-pointer group transition-all hover:scale-[1.01] ${
            stats.hasCashGap
              ? 'bg-gradient-to-br from-rose-900 to-stone-900 hover:from-rose-800'
              : 'bg-gradient-to-br from-stone-900 to-stone-800 hover:from-stone-800'
          }`}
          title="Нажмите для настройки горизонта лимита и дней выплат ЗП"
        >
          <div className="h-6 flex items-center justify-between gap-1 text-stone-200">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold text-stone-200 truncate">
                {stats.hasCashGap ? 'Кассовый разрыв' : stats.isPastMonth ? 'Итог месяца' : 'Безопасный лимит'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLimitModalOpen(true);
                }}
                aria-label="Настроить горизонт лимита и дни зарплаты"
                className="w-5 h-5 rounded-md hover:bg-white/10 text-stone-400 group-hover:text-amber-300 flex items-center justify-center transition"
              >
                <SlidersHorizontal className="w-3 h-3" />
              </button>
            </div>
            {stats.hasCashGap ? (
              <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
            ) : (
              <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
            )}
          </div>

          <div className="my-auto">
            {stats.hasCashGap ? (
              <>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-300 tabular-nums leading-none truncate">
                  −{stats.cashGapAmount.toLocaleString('ru-RU')}
                  <span className="text-xs font-normal text-rose-300/80 ml-1">₽</span>
                </div>
                <div className="text-xs text-rose-200 mt-1.5 truncate">
                  Не хватает на обязательные счета
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-300 tabular-nums leading-none truncate">
                  {stats.dailyAvailable.toLocaleString('ru-RU')}
                  <span className="text-xs sm:text-sm font-semibold text-amber-300/80 ml-1">{stats.isPastMonth ? '₽' : '₽/день'}</span>
                </div>
                <div className="text-xs text-stone-300 mt-1.5 truncate tabular-nums">
                  {stats.isPastMonth
                    ? 'Период завершен'
                    : activeWalletCard === 'shared'
                    ? `Общий • на ${stats.daysLeft} дн. (${stats.daysHorizonLabel})`
                    : activeWalletCard === myWalletKey
                    ? `${myProfile.name} (Мой) • на ${stats.daysLeft} дн. (${stats.daysHorizonLabel})`
                    : `${partnerProfile.name} • на ${stats.daysLeft} дн. (${stats.daysHorizonLabel})`}
                </div>
              </>
            )}
          </div>

          <div className="h-7 pt-2 border-t border-stone-700/70 text-xs text-stone-300 flex items-center justify-between gap-2 tabular-nums">
            {!stats.isPastMonth && stats.reserveToDeduct > 0 ? (
              <span className="text-amber-300 font-medium flex items-center gap-1 truncate" title="Резерв на неоплаченные обязательные счета">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Резерв: {stats.reserveToDeduct.toLocaleString('ru-RU')} ₽</span>
              </span>
            ) : (
              <span className="text-emerald-400 font-medium flex items-center gap-1 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Счета закрыты</span>
              </span>
            )}
            <span className="text-stone-300 font-semibold shrink-0 flex items-center gap-1" title="Отложено в копилки и погашено кредитов">
              <Target className="w-3.5 h-3.5 text-stone-300 shrink-0" />
              <span>{stats.activeSavedAndDebtPaid.toLocaleString('ru-RU')} ₽</span>
            </span>
          </div>
        </div>
      </div>

      {/* МЕМОИЗИРОВАННЫЙ БЛОК SVG-ГРАФИКОВ (фиксированная высота 232px) */}
      <ChartsSection
        chartView={chartView}
        setChartView={setChartView}
        selectedMonth={selectedMonth}
        burnDownData={burnDownData}
        rule503020Data={rule503020Data}
        dynamics6MonthsData={dynamics6MonthsData}
        partnerComparisonData={partnerComparisonData}
        userProfiles={safeProfiles}
        daysInMonth={stats.daysInMonth}
        safeLimitConfig={safeLimitConfig}
      />

      {/* СРЕДНИЙ РЯД (12-колоночная сетка с выравниванием карточек по высоте items-stretch) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Левая карточка (7 колонок): Структура расходов */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 mb-3.5 border-b border-stone-100">
              <div>
                <h2 className="text-sm font-semibold text-stone-900">
                  Структура расходов ({activeWalletCard === 'shared' ? 'Семейный резерв' : activeWalletCard === myWalletKey ? `${myProfile.name} ${myProfile.emoji}` : `${partnerProfile.name} ${partnerProfile.emoji}`})
                </h2>
                <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
                  Потребительские траты: <strong className="text-stone-800">{stats.totalSelectedExpense.toLocaleString('ru-RU')} ₽</strong>
                </p>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('debts')}
                  className="h-8 px-3 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition inline-flex items-center"
                >
                  План/Прогноз
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openWalletHistory(activeWalletCard);
                    setActiveTab('history');
                  }}
                  className="h-8 px-3 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition inline-flex items-center gap-1"
                >
                  <span>Детали</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {stats.topCategories.length === 0 ? (
              <div className="py-12 text-center text-xs text-stone-500 bg-stone-50/60 rounded-xl border border-stone-100">
                Нет потребительских расходов по этому счету за выбранный период
              </div>
            ) : (
              <div className="space-y-2.5">
                {stats.topCategories.slice(0, 5).map(item => (
                  <div key={item.name} className="p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 font-semibold text-stone-800 min-w-0">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 ${item.meta.color}`}>
                          {item.meta.icon}
                        </span>
                        <span className="truncate">{item.name}</span>
                        {item.isNewInMonth ? (
                          <span className="h-5 px-1.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-semibold inline-flex items-center shrink-0">
                            Новая
                          </span>
                        ) : item.diff !== 0 ? (
                          <span className={`h-5 px-1.5 rounded-md text-[10px] font-semibold inline-flex items-center shrink-0 tabular-nums ${
                            item.diff > 0
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {item.diff > 0 ? `+${item.diff.toLocaleString('ru-RU')} ₽` : `−${Math.abs(item.diff).toLocaleString('ru-RU')} ₽`}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-stone-900 font-bold shrink-0 tabular-nums">
                        {item.sum.toLocaleString('ru-RU')} ₽ <span className="text-stone-500 font-normal">({item.percent}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-stone-200/80 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-stone-900 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, item.percent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Единый нижний подвал левой карточки */}
          <div className="pt-3 mt-4 border-t border-stone-100 flex items-center justify-between text-xs tabular-nums">
            <span className="text-stone-600 font-medium">Плановый ориентир месяца:</span>
            <span className="font-bold text-stone-900">
              {expenseForecastData.totalPlannedBudget.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        {/* Правая карточка (5 колонок): Участие в общем котле и дисциплина счетов */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-stone-100">
              <div>
                <h2 className="text-sm font-semibold text-stone-900">Участие в общем котле</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Баланс вклада супругов и обязательных счетов
                </p>
              </div>
              <span className="w-8 h-8 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </span>
            </div>

            <div className="space-y-3">
              {/* Блок 1: Вклад в доходы котла */}
              {(() => {
                const totalInc = stats.shared.monthIncome;
                const hIncPct = totalInc > 0 ? Math.round((stats.shared.husbandIncome / totalInc) * 100) : 50;
                const wIncPct = totalInc > 0 ? 100 - hIncPct : 50;
                return (
                  <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-2 tabular-nums">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                        <span>💰</span> Вклад в доходы котла
                      </span>
                      <span className="font-bold text-stone-900">
                        {totalInc.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-600 h-full transition-all duration-500"
                        style={{ width: `${hIncPct}%` }}
                      />
                      <div
                        className="bg-teal-400 h-full transition-all duration-500"
                        style={{ width: `${wIncPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-stone-600">
                      <span className="truncate">{p1Emoji} {p1Name}: {stats.shared.husbandIncome.toLocaleString('ru-RU')} ₽ ({totalInc > 0 ? hIncPct : 0}%)</span>
                      <span className="truncate text-right">{p2Emoji} {p2Name}: {stats.shared.wifeIncome.toLocaleString('ru-RU')} ₽ ({totalInc > 0 ? wIncPct : 0}%)</span>
                    </div>
                  </div>
                );
              })()}

              {/* Блок 2: Оплата общих покупок */}
              {(() => {
                const totalExp = stats.shared.consumerExpense;
                const hExpPct = totalExp > 0 ? Math.round((stats.shared.husbandConsumerSpent / totalExp) * 100) : 50;
                const wExpPct = totalExp > 0 ? 100 - hExpPct : 50;
                return (
                  <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-2 tabular-nums">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                        <span>🛒</span> Оплата общих покупок
                      </span>
                      <span className="font-bold text-stone-900">
                        {totalExp.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden flex">
                      <div
                        className="bg-stone-900 h-full transition-all duration-500"
                        style={{ width: `${hExpPct}%` }}
                      />
                      <div
                        className="bg-stone-400 h-full transition-all duration-500"
                        style={{ width: `${wExpPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-stone-600">
                      <span className="truncate">{p1Emoji} {p1Name}: {stats.shared.husbandConsumerSpent.toLocaleString('ru-RU')} ₽ ({totalExp > 0 ? hExpPct : 0}%)</span>
                      <span className="truncate text-right">{p2Emoji} {p2Name}: {stats.shared.wifeConsumerSpent.toLocaleString('ru-RU')} ₽ ({totalExp > 0 ? wExpPct : 0}%)</span>
                    </div>
                  </div>
                );
              })()}

              {/* Блок 3: Исполнение обязательных счетов месяца */}
              {(() => {
                const targetYm = selectedMonth === 'all' ? getCurrentMonthPrefix() : selectedMonth;
                const mandatoryList = recurringPayments.filter(r => r.isMandatory !== false);
                const totalBills = mandatoryList.length;
                const paidBills = mandatoryList.filter(r => (r.paidMonths || []).includes(targetYm)).length;
                const billsPct = totalBills > 0 ? Math.round((paidBills / totalBills) * 100) : 100;
                return (
                  <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-2 tabular-nums">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                        <span>🛡️</span> Обязательные счета месяца
                      </span>
                      <span className="font-bold text-stone-900">
                        {paidBills} из {totalBills} оплачено
                      </span>
                    </div>
                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          billsPct === 100 ? 'bg-emerald-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${billsPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-stone-600">
                      <span>Осталось к оплате: {stats.unpaidMandatoryThisMonth.toLocaleString('ru-RU')} ₽</span>
                      <span>{billsPct}% выполнено</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Единый нижний подвал правой карточки */}
          <div className="pt-3 mt-4 border-t border-stone-100 flex items-center justify-between text-xs tabular-nums">
            <span className="text-stone-600 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-violet-600"></span>
              <span>Отложено и погашено из котла:</span>
            </span>
            <span className="font-bold text-violet-700">
              {stats.shared.savedAndDebtPaid.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>
      </div>

      {/* ПОСЛЕДНИЕ ОПЕРАЦИИ */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 mb-2 border-b border-stone-100">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Последние операции</h2>
            <p className="text-xs text-stone-500 mt-0.5">Нажмите на запись для редактирования или внесите пачку чеков за прошлую дату</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => openNewTransactionModal(null, null, null, true)}
              className="h-9 px-3 rounded-xl bg-amber-100/90 hover:bg-amber-200/80 text-stone-900 text-xs font-semibold transition inline-flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Внести чеки за дату</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="h-9 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 text-xs font-semibold transition inline-flex items-center tabular-nums"
            >
              Все ({periodTransactions.length})
            </button>
          </div>
        </div>

        {periodTransactions.length === 0 ? (
          <div className="py-10 text-center text-xs text-stone-500">
            В этом месяце операций пока нет
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {periodTransactions.slice(0, 6).map(tx => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                customCategories={customCategories}
                safeProfiles={safeProfiles}
                onEdit={openEditTransactionModal}
                onDelete={handleDeleteTransaction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
