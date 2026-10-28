import React from 'react';
import { BarChart3, Clock } from 'lucide-react';

export const ChartsSection = React.memo(function ChartsSection({
  chartView,
  setChartView,
  selectedMonth,
  burnDownData,
  rule503020Data,
  dynamics6MonthsData,
  partnerComparisonData,
  userProfiles,
  daysInMonth,
  safeLimitConfig,
}) {
  const paydaysInChart = React.useMemo(() => {
    if (safeLimitConfig?.mode !== 'paydays' || !Array.isArray(safeLimitConfig?.paydays)) return [];
    return Array.from(
      new Set(
        safeLimitConfig.paydays
          .map(Number)
          .filter(d => d >= 1 && d <= 31)
          .map(d => Math.min(d, daysInMonth || 30))
      )
    ).sort((a, b) => a - b);
  }, [safeLimitConfig, daysInMonth]);

  return (
    <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between">
      {/* Единая шапка карточки аналитики */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
        <div>
          <h2 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
              <BarChart3 className="w-3.5 h-3.5" />
            </span>
            <span>Финансовый радар и аналитика</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Потребительский темп без искажения копилками и переводами, баланс 50/30/20, динамика и вклад партнеров.
          </p>
        </div>

        {/* Сегментированный контрол фиксированной высоты h-9 */}
        <div className="grid grid-cols-2 sm:flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200/70 h-auto sm:h-9 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setChartView('burndown')}
            className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center whitespace-nowrap ${
              chartView === 'burndown' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Темп по дням
          </button>
          <button
            type="button"
            onClick={() => setChartView('rule503020')}
            className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center whitespace-nowrap ${
              chartView === 'rule503020' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            50/30/20
          </button>
          <button
            type="button"
            onClick={() => setChartView('dynamics')}
            className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center whitespace-nowrap ${
              chartView === 'dynamics' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Динамика
          </button>
          <button
            type="button"
            onClick={() => setChartView('partners')}
            className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center whitespace-nowrap gap-1 ${
              chartView === 'partners' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>👥</span>
            <span>Партнеры</span>
          </button>
        </div>
      </div>

      {/* Рабочая область фиксированной высоты min-h-[232px] — исключает прыжки дашборда при смене вкладок */}
      <div className="pt-4 min-h-[232px] flex flex-col justify-between">
        {/* ГРАФИК 1: Burn-down темпа трат */}
        {chartView === 'burndown' && (
          selectedMonth === 'all' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-xs text-stone-500 bg-stone-50/60 rounded-xl border border-stone-100 p-6">
              <Clock className="w-6 h-6 mb-2 text-stone-500" />
              <p className="font-semibold text-stone-700">Темп по дням строится для выбранного месяца</p>
              <p className="mt-1">Выберите конкретный месяц в шапке для анализа дневной траектории трат</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between text-xs font-medium flex-wrap gap-2 min-h-[28px]">
                <div className="flex items-center gap-4 flex-wrap tabular-nums">
                  <span className="flex items-center gap-1.5 text-stone-600">
                    <span className="w-3.5 h-0.5 border-t-2 border-dashed border-stone-500 inline-block"></span>
                    <span>План расходов: <strong className="text-stone-800">{burnDownData.baseBudget.toLocaleString('ru-RU')} ₽</strong></span>
                  </span>
                  <span className="flex items-center gap-1.5 text-stone-900 font-semibold">
                    <span className="w-3.5 h-1 bg-stone-900 inline-block rounded-full"></span>
                    <span>Потребительский факт: {burnDownData.actualUpToCurrent.toLocaleString('ru-RU')} ₽</span>
                  </span>
                  {paydaysInChart.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-800 font-medium">
                      <span className="w-2.5 h-0.5 border-t-2 border-dashed border-amber-500 inline-block"></span>
                      <span>Дни ЗП: {paydaysInChart.join(' и ')}-е</span>
                    </span>
                  )}
                </div>

                <div className={`h-7 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 tabular-nums ${
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

              <div className="w-full bg-stone-50/70 p-3 rounded-xl border border-stone-200/60 overflow-hidden">
                <svg viewBox="0 0 500 185" className="w-full h-[164px] select-none">
                  <line x1="40" y1="22" x2="460" y2="22" stroke="#e7e5e4" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="40" y1="92" x2="460" y2="92" stroke="#e7e5e4" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="40" y1="162" x2="460" y2="162" stroke="#d6d3d1" strokeWidth="1" />

                  {/* Вертикальные отметки дней выплат ЗП / аванса */}
                  {paydaysInChart.map(dayNum => {
                    const px = burnDownData.getX(dayNum);
                    return (
                      <g key={`payday_${dayNum}`}>
                        <line
                          x1={px}
                          y1="20"
                          x2={px}
                          y2="162"
                          stroke="#f59e0b"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                          opacity="0.75"
                        />
                        <text
                          x={px}
                          y="16"
                          fontSize="9"
                          fontWeight="600"
                          fill="#b45309"
                          textAnchor="middle"
                        >
                          ЗП {dayNum}
                        </text>
                      </g>
                    );
                  })}

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

                  <text x="40" y="179" fontSize="10" fill="#57534e">1 дн.</text>
                  <text x="250" y="179" fontSize="10" fill="#57534e" textAnchor="middle">15 дн.</text>
                  <text x="460" y="179" fontSize="10" fill="#57534e" textAnchor="end">{daysInMonth} дн.</text>
                </svg>
              </div>
            </div>
          )
        )}

        {/* ГРАФИК 2: Светофор 50/30/20 */}
        {chartView === 'rule503020' && (
          <div className="flex-1 flex flex-col justify-between space-y-3">
            <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-700">Фактическая пропорция распределения дохода</span>
                <span className="text-stone-500 tabular-nums">
                  Эталон: <strong className="text-stone-800">50%</strong> база • <strong className="text-stone-800">30%</strong> досуг • <strong className="text-stone-800">20%</strong> резерв
                </span>
              </div>
              <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden flex gap-0.5">
                <div
                  className="bg-emerald-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(4, rule503020Data.basePct))}%` }}
                  title={`Базовые нужды: ${rule503020Data.basePct}%`}
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(4, rule503020Data.wantsPct))}%` }}
                  title={`Хотелки и досуг: ${rule503020Data.wantsPct}%`}
                />
                <div
                  className="bg-violet-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(4, rule503020Data.futurePct))}%` }}
                  title={`Сбережения и долги: ${rule503020Data.futurePct}%`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <span>🏠</span> Базовые нужды
                  </span>
                  <span className="h-5 px-2 rounded-md bg-white border border-stone-200/80 text-[11px] font-semibold text-stone-600 inline-flex items-center tabular-nums">
                    Цель: 50%
                  </span>
                </div>
                <div className="my-2">
                  <div className="text-lg font-bold text-stone-900 tabular-nums leading-tight">
                    {rule503020Data.base.toLocaleString('ru-RU')} ₽
                    <span className="text-xs font-medium text-stone-500 ml-1.5">({rule503020Data.basePct}%)</span>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        rule503020Data.basePct <= 55 ? 'bg-emerald-600' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, rule503020Data.basePct)}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-stone-500 truncate">Дом, ЖКУ, связь, еда, дети, здоровье</div>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <span>☕</span> Хотелки и досуг
                  </span>
                  <span className="h-5 px-2 rounded-md bg-white border border-stone-200/80 text-[11px] font-semibold text-stone-600 inline-flex items-center tabular-nums">
                    Цель: 30%
                  </span>
                </div>
                <div className="my-2">
                  <div className="text-lg font-bold text-stone-900 tabular-nums leading-tight">
                    {rule503020Data.wants.toLocaleString('ru-RU')} ₽
                    <span className="text-xs font-medium text-stone-500 ml-1.5">({rule503020Data.wantsPct}%)</span>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        rule503020Data.wantsPct <= 35 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, rule503020Data.wantsPct)}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-stone-500 truncate">Кафе, рестораны, кино, шопинг</div>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <span>🎯</span> Сбережения и долги
                  </span>
                  <span className="h-5 px-2 rounded-md bg-white border border-stone-200/80 text-[11px] font-semibold text-stone-600 inline-flex items-center tabular-nums">
                    Цель: 20%
                  </span>
                </div>
                <div className="my-2">
                  <div className="text-lg font-bold text-stone-900 tabular-nums leading-tight">
                    {rule503020Data.future.toLocaleString('ru-RU')} ₽
                    <span className="text-xs font-medium text-stone-500 ml-1.5">({rule503020Data.futurePct}%)</span>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        rule503020Data.futurePct >= 18 ? 'bg-violet-600' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, rule503020Data.futurePct)}%` }}
                    />
                  </div>
                </div>
                <div className="text-[11px] text-stone-500 truncate">Копилки и выплата кредитов</div>
              </div>
            </div>
          </div>
        )}

        {/* ГРАФИК 3: Динамика за 6 месяцев */}
        {chartView === 'dynamics' && (
          <div className="flex-1 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs font-medium min-h-[28px] flex-wrap gap-2">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                  <span className="w-2.5 h-2.5 bg-emerald-600 inline-block rounded-sm"></span> Доходы
                </span>
                <span className="flex items-center gap-1.5 text-stone-900 font-semibold">
                  <span className="w-2.5 h-2.5 bg-stone-900 inline-block rounded-sm"></span> Расходы
                </span>
                <span className="flex items-center gap-1.5 text-violet-700 font-semibold">
                  <span className="w-2.5 h-2.5 bg-violet-600 inline-block rounded-sm"></span> Сбережения и долги
                </span>
              </div>
              <span className="text-xs text-stone-500 hidden sm:inline">Норма сбережений (%) указана над столбцами</span>
            </div>

            <div className="w-full bg-stone-50/70 p-3 rounded-xl border border-stone-200/60 overflow-x-auto">
              <svg viewBox="0 0 500 185" className="w-full min-w-[420px] h-[164px] select-none">
                <line x1="20" y1="155" x2="480" y2="155" stroke="#d6d3d1" strokeWidth="1" />
                {dynamics6MonthsData.list.map((m, idx) => {
                  const startX = 35 + idx * 75;
                  const barW = 16;
                  const maxH = 115;

                  const incH = (m.inc / dynamics6MonthsData.maxVal) * maxH;
                  const expH = (m.exp / dynamics6MonthsData.maxVal) * maxH;
                  const savH = (m.sav / dynamics6MonthsData.maxVal) * maxH;

                  return (
                    <g key={m.ym}>
                      {m.inc > 0 && (
                        <rect
                          x={startX}
                          y={155 - Math.max(3, incH)}
                          width={barW}
                          height={Math.max(3, incH)}
                          rx="3"
                          fill="#10b981"
                        />
                      )}
                      {m.exp > 0 && (
                        <rect
                          x={startX + barW + 2}
                          y={155 - Math.max(3, expH)}
                          width={barW}
                          height={Math.max(3, expH)}
                          rx="3"
                          fill="#1c1917"
                        />
                      )}
                      {m.sav > 0 && (
                        <rect
                          x={startX + (barW + 2) * 2}
                          y={155 - Math.max(3, savH)}
                          width={barW}
                          height={Math.max(3, savH)}
                          rx="3"
                          fill="#8b5cf6"
                        />
                      )}
                      {m.inc > 0 && (
                        <text
                          x={startX + barW * 1.5 + 2}
                          y={Math.min(155 - Math.max(incH, expH, savH) - 6, 140)}
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
                        y="172"
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

        {/* ГРАФИК 4: Сравнительный баланс и вклад партнеров */}
        {chartView === 'partners' && (
          <div className="flex-1 flex flex-col justify-between space-y-3 animate-fade-in">
            {partnerComparisonData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-xl border border-stone-200/80 bg-stone-50/70 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{partnerComparisonData.partner1.emoji}</span>
                        <div>
                          <span className="text-xs font-bold text-stone-900 block leading-tight">
                            {partnerComparisonData.partner1.name}
                          </span>
                          <span className="text-[10px] text-stone-500">Личный профиль</span>
                        </div>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="text-[10px] text-stone-500 block">Свободное сальдо</span>
                        <span className={`text-xs font-bold ${partnerComparisonData.partner1.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {partnerComparisonData.partner1.net >= 0 ? '+' : ''}{partnerComparisonData.partner1.net.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs tabular-nums">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 text-[11px]">Заработано:</span>
                        <span className="font-semibold text-emerald-700">+{partnerComparisonData.partner1.income.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 text-[11px]">Личные расходы:</span>
                        <span className="font-semibold text-stone-800">−{partnerComparisonData.partner1.personalExpense.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 text-[11px]">Вклад в семейный бюджет:</span>
                        <span className="font-semibold text-violet-700">−{partnerComparisonData.partner1.sharedContribution.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      <div className="pt-1.5 border-t border-stone-200/60 flex items-center justify-between">
                        <span className="text-stone-500 text-[11px]">Норма сбережений:</span>
                        <span className="font-bold text-stone-900">{partnerComparisonData.partner1.savingsRate}% от дохода</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-stone-200/80 bg-stone-50/70 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{partnerComparisonData.partner2.emoji}</span>
                        <div>
                          <span className="text-xs font-bold text-stone-900 block leading-tight">
                            {partnerComparisonData.partner2.name}
                          </span>
                          <span className="text-[10px] text-stone-500">Личный профиль</span>
                        </div>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="text-[10px] text-stone-500 block">Свободное сальдо</span>
                        <span className={`text-xs font-bold ${partnerComparisonData.partner2.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {partnerComparisonData.partner2.net >= 0 ? '+' : ''}{partnerComparisonData.partner2.net.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs tabular-nums">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 text-[11px]">Заработано:</span>
                        <span className="font-semibold text-emerald-700">+{partnerComparisonData.partner2.income.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 text-[11px]">Личные расходы:</span>
                        <span className="font-semibold text-stone-800">−{partnerComparisonData.partner2.personalExpense.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 text-[11px]">Вклад в семейный бюджет:</span>
                        <span className="font-semibold text-violet-700">−{partnerComparisonData.partner2.sharedContribution.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      <div className="pt-1.5 border-t border-stone-200/60 flex items-center justify-between">
                        <span className="text-stone-500 text-[11px]">Норма сбережений:</span>
                        <span className="font-bold text-stone-900">{partnerComparisonData.partner2.savingsRate}% от дохода</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-stone-100/80 rounded-xl text-stone-600 text-[11px] flex items-center justify-between">
                  <span>Общие семейные расходы за период: <b>{partnerComparisonData.sharedPool.totalExpense.toLocaleString('ru-RU')} ₽</b></span>
                  <span className="text-stone-500">Учитываются прямые траты и переводы в резерв</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-stone-500 text-center py-8">Нет данных для сравнения</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
