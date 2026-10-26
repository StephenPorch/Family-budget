import React from 'react';
import { BarChart3, Clock } from 'lucide-react';

export const ChartsSection = React.memo(function ChartsSection({
  chartView,
  setChartView,
  selectedMonth,
  burnDownData,
  rule503020Data,
  dynamics6MonthsData,
  daysInMonth,
}) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-stone-700" />
            <span>Финансовый радар и аналитика</span>
          </h2>
          <p className="text-xs text-stone-500">
            Потребительский темп без искажения копилками, баланс 50/30/20 и история за 6 мес.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-2xl border border-stone-200/70 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartView('burndown')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              chartView === 'burndown' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Темп по дням
          </button>
          <button
            type="button"
            onClick={() => setChartView('rule503020')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              chartView === 'rule503020' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            3 корзины (50/30/20)
          </button>
          <button
            type="button"
            onClick={() => setChartView('dynamics')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              chartView === 'dynamics' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Динамика 6 мес
          </button>
        </div>
      </div>

      {/* ГРАФИК 1: Burn-down темпа трат */}
      {chartView === 'burndown' && (
        selectedMonth === 'all' ? (
          <div className="py-12 text-center text-xs text-stone-500">
            <Clock className="w-6 h-6 mx-auto mb-2 text-stone-500" />
            <p className="font-semibold text-stone-700">Темп по дням строится для выбранного месяца</p>
            <p className="mt-1">Выберите конкретный месяц в шапке для анализа дневной траектории трат</p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-medium flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 text-stone-600">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-stone-500 inline-block"></span>
                  План расходов ({burnDownData.baseBudget.toLocaleString('ru-RU')} ₽)
                </span>
                <span className="flex items-center gap-1 text-stone-900 font-semibold">
                  <span className="w-3 h-1 bg-stone-900 inline-block rounded-full"></span>
                  Потребительский факт ({burnDownData.actualUpToCurrent.toLocaleString('ru-RU')} ₽)
                </span>
              </div>

              <div className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 ${
                burnDownData.isUnderBudget
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}>
                {burnDownData.isUnderBudget ? (
                  <>
                    <span>🟢</span>
                    <span>В графике (запас {burnDownData.diff.toLocaleString('ru-RU')} ₽)</span>
                  </>
                ) : (
                  <>
                    <span>🟠</span>
                    <span>Опережение плана на {Math.abs(burnDownData.diff).toLocaleString('ru-RU')} ₽</span>
                  </>
                )}
              </div>
            </div>

            <div className="w-full bg-stone-50/60 p-3 rounded-2xl border border-stone-100 overflow-hidden">
              <svg viewBox="0 0 500 200" className="w-full h-44 select-none">
                <line x1="40" y1="25" x2="460" y2="25" stroke="#e7e5e4" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="100" x2="460" y2="100" stroke="#e7e5e4" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="175" x2="460" y2="175" stroke="#d6d3d1" strokeWidth="1" />

                <polyline
                  fill="none"
                  stroke="#78716c"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                  points={burnDownData.planPointsStr}
                />

                <polyline
                  fill="none"
                  stroke="#1c1917"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={burnDownData.actualPointsStr}
                />

                {burnDownData.actualPoints.slice(1).map(p => (
                  <circle
                    key={p.day}
                    cx={burnDownData.getX(p.day)}
                    cy={burnDownData.getY(p.value)}
                    r={p.day === burnDownData.currentDay ? "4" : "2.5"}
                    fill={p.day === burnDownData.currentDay ? "#f59e0b" : "#1c1917"}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                ))}

                <text x="40" y="193" fontSize="10" fill="#57534e">1 дн.</text>
                <text x="250" y="193" fontSize="10" fill="#57534e" textAnchor="middle">15 дн.</text>
                <text x="460" y="193" fontSize="10" fill="#57534e" textAnchor="end">{daysInMonth} дн.</text>
              </svg>
            </div>
          </div>
        )
      )}

      {/* ГРАФИК 2: Светофор 50/30/20 */}
      {chartView === 'rule503020' && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-stone-800 flex items-center gap-1">
                  <span>🏠</span> Базовые нужды
                </span>
                <span className="text-[11px] font-bold text-stone-600">Цель: 50%</span>
              </div>
              <div className="text-base font-bold text-stone-900">
                {rule503020Data.base.toLocaleString('ru-RU')} ₽
                <span className="text-xs font-normal text-stone-600 ml-1">({rule503020Data.basePct}%)</span>
              </div>
              <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    rule503020Data.basePct <= 55 ? 'bg-emerald-600' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, rule503020Data.basePct)}%` }}
                />
              </div>
              <div className="text-[10px] text-stone-600 mt-1">Дом, ЖКУ, связь, еда, дети, авто, здоровье</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-stone-800 flex items-center gap-1">
                  <span>☕</span> Хотелки и досуг
                </span>
                <span className="text-[11px] font-bold text-stone-600">Цель: 30%</span>
              </div>
              <div className="text-base font-bold text-stone-900">
                {rule503020Data.wants.toLocaleString('ru-RU')} ₽
                <span className="text-xs font-normal text-stone-600 ml-1">({rule503020Data.wantsPct}%)</span>
              </div>
              <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    rule503020Data.wantsPct <= 35 ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, rule503020Data.wantsPct)}%` }}
                />
              </div>
              <div className="text-[10px] text-stone-600 mt-1">Кафе, рестораны, кино, шопинг</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-stone-800 flex items-center gap-1">
                  <span>🎯</span> Сбережения и долги
                </span>
                <span className="text-[11px] font-bold text-stone-600">Цель: 20%</span>
              </div>
              <div className="text-base font-bold text-stone-900">
                {rule503020Data.future.toLocaleString('ru-RU')} ₽
                <span className="text-xs font-normal text-stone-600 ml-1">({rule503020Data.futurePct}%)</span>
              </div>
              <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    rule503020Data.futurePct >= 18 ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, rule503020Data.futurePct)}%` }}
                />
              </div>
              <div className="text-[10px] text-stone-600 mt-1">Копилки и выплата кредитов</div>
            </div>
          </div>
        </div>
      )}

      {/* ГРАФИК 3: Динамика за 6 месяцев */}
      {chartView === 'dynamics' && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-800 font-semibold">
                <span className="w-2.5 h-2.5 bg-emerald-600 inline-block rounded-sm"></span> Доходы
              </span>
              <span className="flex items-center gap-1 text-stone-900 font-semibold">
                <span className="w-2.5 h-2.5 bg-stone-900 inline-block rounded-sm"></span> Расходы
              </span>
              <span className="flex items-center gap-1 text-violet-700 font-semibold">
                <span className="w-2.5 h-2.5 bg-violet-600 inline-block rounded-sm"></span> Сбережения и долги
              </span>
            </div>
            <span className="text-[11px] text-stone-600 hidden sm:inline">Норма сбережений над столбцами</span>
          </div>

          <div className="w-full bg-stone-50/60 p-3 rounded-2xl border border-stone-100 overflow-x-auto">
            <svg viewBox="0 0 500 180" className="w-full min-w-[420px] h-40 select-none">
              <line x1="20" y1="150" x2="480" y2="150" stroke="#d6d3d1" strokeWidth="1" />
              {dynamics6MonthsData.list.map((m, idx) => {
                const startX = 35 + idx * 75;
                const barW = 16;
                const maxH = 110;

                const incH = (m.inc / dynamics6MonthsData.maxVal) * maxH;
                const expH = (m.exp / dynamics6MonthsData.maxVal) * maxH;
                const savH = (m.sav / dynamics6MonthsData.maxVal) * maxH;

                return (
                  <g key={m.ym}>
                    {m.inc > 0 && (
                      <rect
                        x={startX}
                        y={150 - Math.max(3, incH)}
                        width={barW}
                        height={Math.max(3, incH)}
                        rx="3"
                        fill="#10b981"
                      />
                    )}
                    {m.exp > 0 && (
                      <rect
                        x={startX + barW + 2}
                        y={150 - Math.max(3, expH)}
                        width={barW}
                        height={Math.max(3, expH)}
                        rx="3"
                        fill="#1c1917"
                      />
                    )}
                    {m.sav > 0 && (
                      <rect
                        x={startX + (barW + 2) * 2}
                        y={150 - Math.max(3, savH)}
                        width={barW}
                        height={Math.max(3, savH)}
                        rx="3"
                        fill="#8b5cf6"
                      />
                    )}
                    {m.inc > 0 && (
                      <text
                        x={startX + barW * 1.5 + 2}
                        y={Math.min(150 - Math.max(incH, expH, savH) - 6, 135)}
                        fontSize="9"
                        fontWeight="bold"
                        fill="#6d28d9"
                        textAnchor="middle"
                      >
                        {m.savingsRate}%
                      </text>
                    )}
                    <text
                      x={startX + barW * 1.5 + 2}
                      y="166"
                      fontSize="11"
                      fontWeight={m.ym === selectedMonth ? "bold" : "normal"}
                      fill={m.ym === selectedMonth ? "#1c1917" : "#57534e"}
                      textAnchor="middle"
                    >
                      {m.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});
