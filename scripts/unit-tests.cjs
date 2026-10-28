const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function runTests() {
  const dateUtilsUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'utils', 'dateUtils.js')).href;
  const financeCoreUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'utils', 'financeCore.js')).href;
  const csvUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'utils', 'csv.js')).href;

  const {
    normalizeImportedDate,
    parseImportedAmount,
    formatCompactCellAmount,
  } = await import(dateUtilsUrl);

  const {
    calculateSafeDailyBudget,
    isTransactionLockedType,
    mergeTransactions,
    calculateDebtPayoff,
    calculateHistoricalForecast,
    calculatePartnerComparison,
  } = await import(financeCoreUrl);

  const { parseCsvText } = await import(csvUrl);

  console.log('🧪 Running Family Budget v0.7.7 Core Unit Tests (Direct ES Module Imports)...');

  // Test 1: Safe Daily Budget & Cash Gap Exposure (v0.7.0 Fix)
  {
    const normal = calculateSafeDailyBudget({
      activeBalance: 50000,
      unpaidMandatoryTotal: 15000,
      unpaidRecommendedTotal: 5000,
      deductMandatory: true,
      deductRecommended: false,
      daysLeft: 10,
      isPastMonth: false,
    });
    assert.strictEqual(normal.safeBalance, 35000);
    assert.strictEqual(normal.dailyAvailable, 3500);
    assert.strictEqual(normal.hasCashGap, false);
    assert.strictEqual(normal.cashGapAmount, 0);

    const deficit = calculateSafeDailyBudget({
      activeBalance: 8000,
      unpaidMandatoryTotal: 16000,
      unpaidRecommendedTotal: 0,
      deductMandatory: true,
      deductRecommended: false,
      daysLeft: 10,
      isPastMonth: false,
    });
    assert.strictEqual(deficit.rawSafeBalance, -8000);
    assert.strictEqual(deficit.hasCashGap, true);
    assert.strictEqual(deficit.cashGapAmount, 8000);
    assert.strictEqual(deficit.dailyAvailable, 0);
    console.log('  ✅ Test 1 PASSED: Safe daily budget & negative cash gap exposure');
  }

  // Test 2: Recurring Payment Edit Type Lock (v0.7.0 Fix)
  {
    assert.strictEqual(isTransactionLockedType({ id: 1, type: 'expense' }), false);
    assert.strictEqual(isTransactionLockedType({ id: 2, type: 'expense', goalId: 10 }), true);
    assert.strictEqual(isTransactionLockedType({ id: 3, type: 'expense', debtId: 20 }), true);
    assert.strictEqual(isTransactionLockedType({ id: 4, type: 'expense', recurringId: 30 }), true);
    console.log('  ✅ Test 2 PASSED: Recurring payment transaction type lock (goalId | debtId | recurringId)');
  }

  // Test 3: Russian Bank Date & Currency Normalization (v0.7.0 Fix)
  {
    assert.strictEqual(normalizeImportedDate('26.10.2026'), '2026-10-26');
    assert.strictEqual(normalizeImportedDate('05.09.2026 14:32:10'), '2026-09-05');
    assert.strictEqual(normalizeImportedDate('15/08/2026'), '2026-08-15');
    assert.strictEqual(normalizeImportedDate('2026-10-01T12:00:00Z'), '2026-10-01');
    assert.strictEqual(normalizeImportedDate('07.11.26'), '2026-11-07');

    assert.strictEqual(parseImportedAmount('-1 450,50 ₽'), 1451);
    assert.strictEqual(parseImportedAmount('25 600,00 руб.'), 25600);
    console.log('  ✅ Test 3 PASSED: Russian bank statement date & currency normalization');
  }

  // Test 4: Safe CSV/JSON Merge Deduplication vs Replace (v0.7.0 Fix)
  {
    const existing = [
      { id: 101, date: '2026-10-20', type: 'expense', amount: 1850, title: 'ВкусВилл', account: 'family' },
      { id: 102, date: '2026-10-18', type: 'expense', amount: 850, title: 'Домашний интернет', account: 'family' },
    ];
    const incoming = [
      // Duplicate by signature (different ID, same date/type/amount/title/account)
      { id: 999, date: '2026-10-20', type: 'expense', amount: 1850, title: 'вкусвилл', account: 'family' },
      // Brand new item
      { id: 103, date: '2026-10-22', type: 'expense', amount: 640, title: 'Аптека', account: 'personal' },
    ];
    const merged = mergeTransactions(existing, incoming);
    assert.strictEqual(merged.addedCount, 1);
    assert.strictEqual(merged.skippedCount, 1);
    assert.strictEqual(merged.merged.length, 3);
    console.log('  ✅ Test 4 PASSED: Non-destructive CSV/JSON Merge with duplicate filtering');
  }

  // Test 5: Historical Forecast & Debt Payoff
  {
    const sampleTxs = [
      { id: 1, type: 'expense', amount: 12000, date: '2026-08-10', categoryId: 'Продукты' },
      { id: 2, type: 'expense', amount: 15000, date: '2026-09-12', categoryId: 'Продукты' },
      { id: 3, type: 'expense', amount: 8000, date: '2026-10-05', categoryId: 'Продукты' },
    ];
    const forecast = calculateHistoricalForecast(sampleTxs, [], '2026-10');
    const groceries = forecast.categories.find((c) => c.categoryId === 'Продукты');
    assert.ok(groceries);
    assert.strictEqual(groceries.avgMonthly, 13500);
    assert.strictEqual(groceries.currentSpent, 8000);
    assert.strictEqual(groceries.predictedRemaining, 5500);

    const payoff = calculateDebtPayoff({ totalAmount: 100000, paidAmount: 40000, monthlyPayment: 15000 });
    assert.strictEqual(payoff.remaining, 60000);
    assert.strictEqual(payoff.monthsLeft, 4);

    assert.strictEqual(formatCompactCellAmount(850), '850');
    assert.strictEqual(formatCompactCellAmount(3450), '3.5k');
    assert.strictEqual(formatCompactCellAmount(25600), '26k');
    console.log('  ✅ Test 5 PASSED: Historical forecast, debt payoff & compact mobile calendar formatting');
  }

  // Test 6: RFC 4180 CSV Parser
  {
    const rows = parseCsvText('ID,Дата,Название,Сумма\n1,26.10.2026,"Кафе ""Уют""",1250');
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[1][1], '26.10.2026');
    assert.strictEqual(rows[1][2], 'Кафе "Уют"');
    console.log('  ✅ Test 6 PASSED: RFC 4180 CSV parser');
  }

  // Test 7: Flexible Debts & Partner Comparison (Personal-First)
  {
    // Flexible casual loan (no rigid monthly payment)
    const flexDebt = calculateDebtPayoff({
      initialAmount: 60000,
      remainingAmount: 45000,
      monthlyPayment: 0,
      isRegular: false,
    });
    assert.strictEqual(flexDebt.isRegular, false);
    assert.strictEqual(flexDebt.remaining, 45000);
    assert.strictEqual(flexDebt.monthsLeft, null);

    // Regular bank credit
    const bankLoan = calculateDebtPayoff({
      initialAmount: 100000,
      remainingAmount: 40000,
      monthlyPayment: 10000,
      isRegular: true,
    });
    assert.strictEqual(bankLoan.isRegular, true);
    assert.strictEqual(bankLoan.monthsLeft, 4);

    // Partner comparison calculation
    const testProfiles = {
      husband: { name: 'Женя', emoji: '🧑🏻‍💻' },
      wife: { name: 'Ксюша', emoji: '👩🏻‍🎨' },
    };
    const testTxs = [
      { date: '2026-10-05', type: 'income', amount: 150000, author: 'husband', account: 'personal' },
      { date: '2026-10-06', type: 'expense', amount: 30000, author: 'husband', account: 'personal' },
      { date: '2026-10-07', type: 'expense', amount: 40000, author: 'husband', account: 'shared' },
      { date: '2026-10-08', type: 'income', amount: 120000, author: 'wife', account: 'personal' },
      { date: '2026-10-09', type: 'expense', amount: 25000, author: 'wife', account: 'personal' },
      { date: '2026-10-10', type: 'expense', amount: 35000, author: 'wife', account: 'shared' },
    ];
    const comparison = calculatePartnerComparison(testTxs, testProfiles, '2026-10');
    assert.strictEqual(comparison.partner1.name, 'Женя');
    assert.strictEqual(comparison.partner1.income, 150000);
    assert.strictEqual(comparison.partner1.personalExpense, 30000);
    assert.strictEqual(comparison.partner1.sharedContribution, 40000);
    assert.strictEqual(comparison.partner1.net, 80000);
    assert.strictEqual(comparison.partner1.savingsRate, 53);

    assert.strictEqual(comparison.partner2.name, 'Ксюша');
    assert.strictEqual(comparison.partner2.income, 120000);
    assert.strictEqual(comparison.partner2.personalExpense, 25000);
    assert.strictEqual(comparison.partner2.sharedContribution, 35000);
    assert.strictEqual(comparison.partner2.net, 60000);
    assert.strictEqual(comparison.partner2.savingsRate, 50);

    console.log('  ✅ Test 7 PASSED: Flexible debt payoff & partner comparative balance analytics');
  }

  console.log('🎉 All 7 test suites in unit-tests.cjs PASSED!');
}

runTests().catch((err) => {
  console.error('❌ Unit test failure:', err);
  process.exit(1);
});
