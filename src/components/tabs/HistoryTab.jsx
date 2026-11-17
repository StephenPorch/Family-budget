import React from 'react';
import { Search, X, Calendar, SlidersHorizontal } from 'lucide-react';
import { getTargetDateForMonth } from '../../utils/dateUtils.js';
import { ReceiptCalendar } from '../calendar/ReceiptCalendar.jsx';
import { TransactionRow } from '../TransactionRow.jsx';

export const HistoryTab = React.memo(function HistoryTab({
  searchQuery,
  setSearchQuery,
  isCalendarExpanded,
  setIsCalendarExpanded,
  selectedCalendarDate,
  setSelectedCalendarDate,
  isFilterOpen,
  setIsFilterOpen,
  hasActiveFilters,
  activeFilterCount,
  monthCalendarDays,
  openNewTransactionModal,
  filterAuthor,
  setFilterAuthor,
  filterType,
  setFilterType,
  filterAccount,
  setFilterAccount,
  safeProfiles,
  filteredTransactions,
  periodTransactions,
  selectedMonth,
  setSelectedMonth,
  groupedTransactions,
  clearFilters,
  customCategories,
  openEditTransactionModal,
  handleDeleteTransaction,
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-4 space-y-3">
        {/* Панель поиска и кнопок строго единой высоты h-10 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Поиск по названию, категории или сумме..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Поиск по операциям"
              className="w-full h-10 text-xs font-medium pl-9 pr-8 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Сбросить поиск"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-500 hover:text-stone-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
            className={`h-10 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition shrink-0 tabular-nums ${
              isCalendarExpanded || selectedCalendarDate
                ? 'bg-amber-100 text-amber-950 border-amber-300'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{selectedCalendarDate ? `День: ${selectedCalendarDate.slice(8, 10)}.${selectedCalendarDate.slice(5, 7)}` : 'Календарь чеков'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            aria-expanded={isFilterOpen}
            aria-label="Открыть фильтры операций"
            className={`h-10 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition shrink-0 ${
              hasActiveFilters
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Фильтры</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-md bg-amber-400 text-stone-950 font-bold text-[10px] inline-flex items-center justify-center tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ИНТЕРАКТИВНЫЙ КАЛЕНДАРЬ ЧЕКОВ ПО ДНЯМ МЕСЯЦА */}
        {isCalendarExpanded && (
          <ReceiptCalendar
            monthCalendarDays={monthCalendarDays}
            selectedCalendarDate={selectedCalendarDate}
            setSelectedCalendarDate={setSelectedCalendarDate}
            onAddReceiptsForDate={(dateStr) => openNewTransactionModal(null, null, dateStr, true)}
          />
        )}

        {/* Выпадающая панель фильтров (3 колонки на десктопе) */}
        {isFilterOpen && (
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in text-xs">
            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1.5">Кто записал:</label>
              <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-stone-200/80">
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'husband', label: `${safeProfiles.husband?.emoji || '🧔🏻‍♂️'} ${safeProfiles.husband?.name || 'Партнер 1'}` },
                  { id: 'wife', label: `${safeProfiles.wife?.emoji || '👩🏼'} ${safeProfiles.wife?.name || 'Партнер 2'}` },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilterAuthor(opt.id)}
                    className={`h-7 px-2 rounded-md font-medium transition flex items-center justify-center truncate ${
                      filterAuthor === opt.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1.5">Тип операции:</label>
              <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-lg border border-stone-200/80">
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'expense', label: 'Расходы' },
                  { id: 'income', label: 'Доходы' },
                  { id: 'transfer', label: '⇄ Переводы' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilterType(opt.id)}
                    className={`h-7 px-2 rounded-md font-medium transition flex items-center justify-center truncate ${
                      filterType === opt.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1.5">Счет:</label>
              <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-stone-200/80">
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'shared', label: '👥 Общий' },
                  { id: 'personal', label: '👤 Личный' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilterAccount(opt.id)}
                    className={`h-7 px-2 rounded-md font-medium transition flex items-center justify-center truncate ${
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

        <div className="flex items-center justify-between text-xs text-stone-600 font-medium flex-wrap gap-2 pt-1">
          <span className="tabular-nums">
            Найдено: <strong className="text-stone-900">{filteredTransactions.length}</strong> из {periodTransactions.length}
            {selectedCalendarDate && (
              <span className="ml-2 text-amber-800 font-semibold">
                • Фильтр по дате: {selectedCalendarDate}
              </span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openNewTransactionModal(null, null, selectedCalendarDate || getTargetDateForMonth(selectedMonth), true)}
              className="text-stone-800 font-semibold hover:text-stone-950 underline"
            >
              + Внести пачку чеков за дату
            </button>
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
      </div>

      {groupedTransactions.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-stone-200/80 p-8 shadow-sm">
          <div className="text-3xl mb-2">🧾</div>
          <div className="text-sm font-semibold text-stone-800">
            {selectedCalendarDate ? `За ${selectedCalendarDate} операций пока нет` : 'Операций не найдено'}
          </div>
          <p className="text-xs text-stone-500 mt-1">
            {selectedCalendarDate
              ? 'Вы можете сразу добавить один или несколько чеков за этот день'
              : 'Попробуйте изменить запрос или сбросить фильтры'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {selectedCalendarDate && (
              <button
                type="button"
                onClick={() => openNewTransactionModal(null, null, selectedCalendarDate, true)}
                className="h-9 px-4 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition inline-flex items-center"
              >
                + Добавить чеки за {selectedCalendarDate}
              </button>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 px-4 rounded-xl bg-stone-100 text-stone-800 text-xs font-semibold hover:bg-stone-200 transition inline-flex items-center"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedTransactions.map(group => (
            <div key={group.date} className="bg-white rounded-2xl border border-stone-200/80 p-3 sm:p-4 shadow-sm">
              <div className="h-9 flex items-center justify-between px-3 bg-stone-50 rounded-xl text-xs font-semibold text-stone-700 mb-2 gap-2">
                <span className="truncate">{group.label}</span>
                <div className="flex items-center gap-3 shrink-0 tabular-nums">
                  <button
                    type="button"
                    onClick={() => openNewTransactionModal(null, null, group.date, false)}
                    className="h-6 px-2.5 text-[11px] font-semibold text-stone-700 hover:text-stone-950 bg-white rounded-lg border border-stone-200/80 hover:border-stone-400 transition inline-flex items-center"
                    title={`Добавить ещё чек за ${group.date}`}
                  >
                    + Чек сюда
                  </button>
                  <span className={`min-w-[84px] text-right font-bold ${group.net >= 0 ? 'text-emerald-700' : 'text-stone-800'}`}>
                    {group.net >= 0 ? '+' : '−'}{Math.abs(group.net).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
              <div className="divide-y divide-stone-100">
                {group.items.map(tx => (
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
