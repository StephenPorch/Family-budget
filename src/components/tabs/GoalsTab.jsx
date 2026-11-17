import React from 'react';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import { getTargetDateForMonth } from '../../utils/dateUtils.js';

export const GoalsTab = React.memo(function GoalsTab({
  goals,
  stats,
  selectedMonth,
  setEditingGoalId,
  setNewGoalTitle,
  setNewGoalTarget,
  setNewGoalCurrent,
  setIsNewGoalModalOpen,
  setSelectedGoalId,
  setGoalActionMode,
  setGoalSourceAccount,
  setGoalActionDate,
  setIsGoalModalOpen,
  openEditGoalModal,
  handleDeleteGoal,
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-stone-900 flex items-center gap-2">
            <span>🎯</span> Семейные копилки и цели
          </h2>
          <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
            Общий прогресс: <strong className="text-stone-800">{stats.totalSavings.toLocaleString('ru-RU')} ₽</strong> из {stats.totalTargetSavings.toLocaleString('ru-RU')} ₽ • Нажмите на карточку для пополнения или вывода
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingGoalId(null);
            setNewGoalTitle('');
            setNewGoalTarget('');
            setNewGoalCurrent('0');
            setIsNewGoalModalOpen(true);
          }}
          className="h-10 px-4 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition inline-flex items-center gap-1.5 shadow-sm self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Новая цель</span>
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-10 text-center shadow-sm">
          <div className="text-3xl mb-2">🎯</div>
          <div className="text-sm font-semibold text-stone-800">Нет активных целей-копилок</div>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Создайте цель накопления на отпуск, подушку безопасности или крупную покупку
          </p>
          <button
            type="button"
            onClick={() => setIsNewGoalModalOpen(true)}
            className="mt-4 h-9 px-4 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Создать первую цель</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {goals.map(goal => {
            const percent = goal.target > 0 ? Math.min(100, Math.max(0, Math.round((goal.current / goal.target) * 100))) : 0;
            const remaining = Math.max(0, (Number(goal.target) || 0) - (Number(goal.current) || 0));
            return (
              <div
                key={goal.id}
                onClick={() => {
                  setSelectedGoalId(goal.id);
                  setGoalActionMode('contribute');
                  setGoalSourceAccount('shared');
                  setGoalActionDate(getTargetDateForMonth(selectedMonth));
                  setIsGoalModalOpen(true);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedGoalId(goal.id);
                    setGoalActionMode('contribute');
                    setIsGoalModalOpen(true);
                  }
                }}
                className="min-h-[196px] bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm hover:shadow-md hover:border-stone-300 transition-all cursor-pointer relative overflow-hidden group text-left flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-center text-xl shrink-0">
                      {goal.icon}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="h-7 px-2.5 rounded-lg bg-stone-100 text-stone-800 text-xs font-bold inline-flex items-center tabular-nums">
                        {percent}%
                      </span>
                      <button
                        type="button"
                        onClick={(e) => openEditGoalModal(e, goal)}
                        aria-label={`Редактировать цель ${goal.title}`}
                        className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition"
                        title="Изменить цель"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteGoal(e, goal.id)}
                        aria-label={`Удалить цель ${goal.title}`}
                        className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Удалить цель"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="font-semibold text-stone-900 text-sm mb-1 flex items-center justify-between gap-2">
                    <span className="truncate">{goal.title}</span>
                    <span className="text-xs font-semibold text-violet-700 shrink-0">
                      ± Операция
                    </span>
                  </div>

                  <div className="text-xs text-stone-600 font-medium tabular-nums">
                    {Number(goal.current).toLocaleString('ru-RU')} ₽ из {Number(goal.target).toLocaleString('ru-RU')} ₽
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-stone-100">
                  <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${goal.color} transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="text-xs text-stone-500 flex items-center justify-between tabular-nums">
                    <span>{remaining > 0 ? `Осталось: ${remaining.toLocaleString('ru-RU')} ₽` : 'Цель достигнута! 🎉'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
