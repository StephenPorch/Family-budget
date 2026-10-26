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
    <div className="p-3 sm:p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Календарь разбора чеков — {formatMonthTitle(monthCalendarDays.targetYm)}</span>
          </h3>
          <p className="text-[11px] text-stone-600">
            Выберите любой день из прошлого, чтобы посмотреть операции или сразу внести пачку чеков за это число
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {selectedCalendarDate && (
            <>
              <button
                type="button"
                onClick={() => onAddReceiptsForDate(selectedCalendarDate)}
                className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Чеки за {selectedCalendarDate.slice(8, 10)}.{selectedCalendarDate.slice(5, 7)}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCalendarDate(null)}
                className="px-2.5 py-1.5 rounded-xl bg-stone-200 text-stone-700 text-xs font-medium hover:bg-stone-300 transition"
              >
                Все дни
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-stone-600 pb-1">
        <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {monthCalendarDays.cells.map(cell => {
          if (cell.empty) {
            return <div key={cell.key} className="min-h-[46px] sm:h-12 rounded-xl bg-transparent" />;
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
              className={`min-h-[46px] sm:h-12 rounded-xl border p-0.5 sm:p-1 flex flex-col items-center justify-between text-center transition overflow-hidden ${
                isSelected
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : isToday
                  ? 'bg-amber-50/80 border-amber-300 text-stone-900'
                  : cell.count > 0
                  ? 'bg-white border-stone-200 hover:border-stone-400 text-stone-800'
                  : 'bg-white/70 border-stone-200/60 hover:border-stone-300 text-stone-500'
              }`}
            >
              <span className="text-[11px] font-bold leading-none mt-0.5">{cell.day}</span>
              {cell.count > 0 ? (
                <span className={`text-[9px] font-semibold tracking-tighter leading-tight max-w-full px-0.5 ${
                  isSelected ? 'text-amber-300' : 'text-stone-700'
                }`}>
                  {compactSum}
                </span>
              ) : (
                <span className="text-[9px] text-stone-400">·</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
