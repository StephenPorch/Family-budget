const assert = require('assert');

console.log('--- Запуск модульных тестов Семейный Бюджет v0.6.0 ---');

// Тестовый набор операций за 2 месяца (сентябрь и октябрь 2026)
const sampleTxs = [
  // Сентябрь
  { id: 's1', amount: 120000, type: 'income', account: 'shared', author: 'husband', date: '2026-09-10' },
  { id: 's2', amount: 30000, type: 'expense', account: 'shared', author: 'wife', date: '2026-09-15', category: 'Продукты' },
  { id: 's3', amount: 15000, type: 'expense', account: 'shared', author: 'husband', date: '2026-09-20', category: 'Накопления', goalId: 'g1' },
  { id: 's4', amount: 20000, type: 'income', account: 'personal', author: 'husband', date: '2026-09-22' },
  { id: 's5', amount: 5000, type: 'expense', account: 'personal', author: 'husband', date: '2026-09-25' },

  // Октябрь
  { id: 'o1', amount: 100000, type: 'income', account: 'shared', author: 'wife', date: '2026-10-05' },
  { id: 'o2', amount: 40000, type: 'expense', account: 'shared', author: 'husband', date: '2026-10-10', category: 'Продукты' },
  { id: 'o3', amount: 20000, type: 'expense', account: 'shared', author: 'husband', date: '2026-10-12', category: 'Долги и кредиты', debtId: 'd1' },
  { id: 'o4', amount: 10000, type: 'expense', account: 'personal', author: 'husband', date: '2026-10-15' },

  // Ноябрь (будущая операция, не должна влиять на баланс октября)
  { id: 'n1', amount: 50000, type: 'income', account: 'shared', author: 'husband', date: '2026-11-01' },
];

const isSavingsOrDebtTx = (tx) => {
  if (tx.goalId || tx.debtId) return true;
  const cat = (tx.category || '').toLowerCase();
  return cat === 'накопления' || cat === 'долги и кредиты' || cat === 'долги' || cat === 'кредиты';
};

// 1. ТЕСТ КУМУЛЯТИВНОГО ПЕРЕХОДЯЩЕГО ОСТАТКА И ИЗОЛЯЦИИ
console.log('Тест 1: Кумулятивный остаток и месячный поток...');
const calcCumulativeAndPeriod = (txs, selectedMonth) => {
  const endOfMonth = selectedMonth + '-31';

  let cumSharedIncome = 0;
  let cumSharedExpense = 0;
  let cumHusbandPersonal = 0;

  let monthSharedIncome = 0;
  let monthSharedExpense = 0;
  let monthConsumerExpense = 0;
  let monthSavedAndDebtPaid = 0;
  const categoryTotals = {};

  txs.forEach(t => {
    const val = Number(t.amount) || 0;
    const isSavingOrDebt = isSavingsOrDebtTx(t);

    // Кумулятивный остаток (все транзакции <= конца выбранного месяца)
    if (t.date <= endOfMonth) {
      if (t.account === 'shared') {
        if (t.type === 'income') cumSharedIncome += val;
        else cumSharedExpense += val;
      } else if (t.author === 'husband') {
        if (t.type === 'income') cumHusbandPersonal += val;
        else cumHusbandPersonal -= val;
      }
    }

    // Месячный поток (строго внутри выбранного месяца)
    if (t.date.startsWith(selectedMonth)) {
      if (t.account === 'shared') {
        if (t.type === 'income') {
          monthSharedIncome += val;
        } else {
          monthSharedExpense += val;
          if (isSavingOrDebt) {
            monthSavedAndDebtPaid += val;
          } else {
            monthConsumerExpense += val;
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + val;
          }
        }
      }
    }
  });

  return {
    cumSharedBalance: cumSharedIncome - cumSharedExpense,
    cumHusbandBalance: cumHusbandPersonal,
    monthSharedIncome,
    monthSharedExpense,
    monthConsumerExpense,
    monthSavedAndDebtPaid,
    categoryTotals,
  };
};

const octStats = calcCumulativeAndPeriod(sampleTxs, '2026-10');

// В сентябре сальдо общего котла: +120000 - 30000 - 15000 = +75000
// В октябре сальдо общего котла: +100000 - 40000 - 20000 = +40000
// Итого кумулятивный баланс на конец октября = 75000 + 40000 = 115000 (ноябрьские +50000 не включаются!)
assert.strictEqual(octStats.cumSharedBalance, 115000, 'Кумулятивный баланс общего котла на конец октября должен быть 115 000 ₽');
assert.strictEqual(octStats.monthSharedIncome, 100000, 'Доход за октябрь должен быть ровно 100 000 ₽');
assert.strictEqual(octStats.monthSharedExpense, 60000, 'Расход за октябрь должен быть ровно 60 000 ₽');

// Личный баланс мужа: сентябрь (+20000 - 5000 = 15000), октябрь (-10000) => кумулятивный остаток 5000 ₽
assert.strictEqual(octStats.cumHusbandBalance, 5000, 'Личный баланс мужа на конец октября должен быть 5 000 ₽');
console.log('✅ Тест 1 пройден: кумулятивный переходящий остаток работает корректно!');

// 2. ТЕСТ ИЗОЛЯЦИИ НАКОПЛЕНИЙ И ДОЛГОВ
console.log('Тест 2: Изоляция накоплений и долгов от потребительских трат...');
// Потребительские расходы в октябре: только «Продукты» на 40 000 ₽.
// Платёж по кредиту 20 000 ₽ изолирован в monthSavedAndDebtPaid и не попадает в categoryTotals!
assert.strictEqual(octStats.monthConsumerExpense, 40000, 'Потребительские траты октября должны быть 40 000 ₽');
assert.strictEqual(octStats.monthSavedAndDebtPaid, 20000, 'Отложено и погашено в октябре должно быть 20 000 ₽');
assert.deepStrictEqual(octStats.categoryTotals, { 'Продукты': 40000 }, 'Пирог трат не должен содержать долгов и копилок');
console.log('✅ Тест 2 пройден: накопления и долги изолированы от потребительской корзины!');

// 3. ТЕСТ БЕЗОПАСНОГО ДНЕВНОГО ЛИМИТА С РЕЗЕРВОМ НА ПЛАТЕЖИ
console.log('Тест 3: Формула безопасного лимита в день с резервом на счета...');
const calcDailyLimit = (balance, unpaidMandatory, daysLeft) => {
  const safeBalance = Math.max(0, balance - unpaidMandatory);
  return Math.max(0, Math.round(safeBalance / daysLeft));
};

// Баланс 115 000 ₽, неоплаченных обязательных платежей на 15 000 ₽, осталось 10 дней
const limitWithReserve = calcDailyLimit(115000, 15000, 10);
// (115 000 - 15 000) / 10 = 10 000 ₽ в день
assert.strictEqual(limitWithReserve, 10000, 'Дневной лимит с резервом должен быть 10 000 ₽/день');

// Когда платёж оплачен, резерв становится 0 ₽, лимит повышается до 11 500 ₽
const limitWithoutReserve = calcDailyLimit(115000, 0, 10);
assert.strictEqual(limitWithoutReserve, 11500, 'После оплаты счетов дневной лимит разблокируется до 11 500 ₽/день');
console.log('✅ Тест 3 пройден: безопасный дневной лимит с резервом проверен!');

// 4. ТЕСТ МЕХАНИКИ ОБРАТНОЙ КОПИЛКИ И ПРОГНОЗА ЗАКРЫТИЯ ДОЛГА
console.log('Тест 4: Механика обратной копилки и прогноз закрытия кредита...');
const testDebt = {
  id: 'd1',
  title: 'Автокредит',
  initialAmount: 600000,
  remainingAmount: 240000,
  monthlyPayment: 20000,
};

const calcDebtProgress = (debt) => {
  const paid = debt.initialAmount - debt.remainingAmount;
  const pct = Math.round((paid / debt.initialAmount) * 100);
  const monthsLeft = Math.ceil(debt.remainingAmount / debt.monthlyPayment);
  return { paid, pct, monthsLeft };
};

const debtStats1 = calcDebtProgress(testDebt);
assert.strictEqual(debtStats1.paid, 360000, 'Выплачено должно быть 360 000 ₽');
assert.strictEqual(debtStats1.pct, 60, 'Прогресс закрытия кредита должен быть 60%');
assert.strictEqual(debtStats1.monthsLeft, 12, 'До закрытия должно оставаться 12 месяцев');

// Вносим платёж 20 000 ₽
testDebt.remainingAmount -= 20000;
const debtStats2 = calcDebtProgress(testDebt);
assert.strictEqual(debtStats2.paid, 380000, 'После платежа выплачено должно быть 380 000 ₽');
assert.strictEqual(debtStats2.pct, 63, 'Прогресс должен вырасти до 63%');
assert.strictEqual(debtStats2.monthsLeft, 11, 'Осталось 11 месяцев');

// Откат платежа по Undo
testDebt.remainingAmount += 20000;
const debtStats3 = calcDebtProgress(testDebt);
assert.strictEqual(testDebt.remainingAmount, 240000, 'При отмене остаток кредита восстанавливается');
assert.strictEqual(debtStats3.paid, 360000, 'После отмены выплаченная сумма возвращается к 360 000 ₽');
console.log('✅ Тест 4 пройден: обратная копилка и прогноз закрытия долга работают безошибочно!');

console.log('\n🎉 ВСЕ ТЕСТЫ v0.6.0 УСПЕШНО ПРОЙДЕНЫ (EXIT CODE 0)!');
