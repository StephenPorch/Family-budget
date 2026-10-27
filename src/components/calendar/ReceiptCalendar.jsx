import React from 'react';
import { Calendar, Plus } from 'lucide-react';
import { formatMonthTitle, getLocalDateString, formatCompactCellAmount } from '../../utils/dateUtils.js';

export const ReceiptCalendar = React.memo(function ReceiptCalendar({
  monthCalendarDays,
  selectedCalendarDate,
  setSelectedCalendarDate,
  onAddReceiptsForDate,
}) {
  return (
    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-200/60">
        <div>
          <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Календарь разбора чеков — {formatMonthTitle(monthCalendarDays.targetYm)}</span>
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Выберите день, чтобы отфильтровать список или внести пачку чеков за конкретную дату
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 min-h-[32px]">
          {selectedCalendarDate && (
            <>
              <button
                type="button"
                onClick={() => onAddReceiptsForDate(selectedCalendarDate)}
                className="h-8 px-3 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition inline-flex items-center gap-1 tabular-nums"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Чеки за {selectedCalendarDate.slice(8, 10)}.{selectedCalendarDate.slice(5, 7)}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCalendarDate(null)}
                className="h-8 px-3 rounded-xl bg-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-300 transition inline-flex items-center"
              >
                Все дни
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-stone-500">
        <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {monthCalendarDays.cells.map(cell => {
          if (cell.empty) {
            return <div key={cell.key} className="h-12 sm:h-14 rounded-xl bg-stone-100/50 border border-transparent" />;
          }
          const isSelected = selectedCalendarDate === cell.dateStr;
          const isToday = cell.dateStr === getLocalDateString();
          const compactSum = cell.expense > 0
            ? `−${formatCompactCellAmount(cell.expense)}`
            : `+${formatCompactCellAmount(cell.income)}`;

          return (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => setSelectedCalendarDate(isSelected ? null : cell.dateStr)}
              onDoubleClick={() => onAddReceiptsForDate(cell.dateStr)}
              title="Нажмите для фильтра по дню, двойной клик — добавить чек за этот день"
              className={`h-12 sm:h-14 rounded-xl border p-1 sm:px-2 sm:py-1.5 flex flex-col items-center justify-between text-center transition overflow-hidden tabular-nums ${
                isSelected
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : isToday
                  ? 'bg-amber-50/90 border-amber-300 text-stone-900'
                  : cell.count > 0
                  ? 'bg-white border-stone-200 hover:border-stone-400 text-stone-800'
                  : 'bg-white/70 border-stone-200/60 hover:border-stone-300 text-stone-500'
              }`}
            >
              <span className="text-xs font-bold leading-none">{cell.day}</span>
              {cell.count > 0 ? (
                <span className={`text-[10px] font-semibold tracking-tight leading-none max-w-full truncate ${
                  isSelected ? 'text-amber-300' : cell.expense > 0 ? 'text-stone-700' : 'text-emerald-700'
                }`}>
                  {compactSum}
                </span>
              ) : (
                <span className="text-[10px] text-stone-300 leading-none">—</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
