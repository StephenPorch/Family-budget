const assert = require('assert');

console.log('Testing v0.5.0 separate wallet accounting (Shared vs Personal Husband vs Personal Wife)...');

const sampleTxs = [
  { id: '1', amount: 100000, type: 'income', account: 'shared', author: 'husband', date: '2026-10-20' },
  { id: '2', amount: 10000, type: 'expense', account: 'shared', author: 'wife', date: '2026-10-21' },
  { id: '3', amount: 30000, type: 'income', account: 'personal', author: 'husband', date: '2026-10-22' },
  { id: '4', amount: 5000, type: 'expense', account: 'personal', author: 'husband', date: '2026-10-23' },
  { id: '5', amount: 20000, type: 'income', account: 'personal', author: 'wife', date: '2026-10-22' },
  { id: '6', amount: 4000, type: 'expense', account: 'personal', author: 'wife', date: '2026-10-23' },
];

const calcWallets = (txs) => {
  const shared = { income: 0, expense: 0, balance: 0 };
  const husbandPersonal = { income: 0, expense: 0, balance: 0 };
  const wifePersonal = { income: 0, expense: 0, balance: 0 };

  txs.forEach(t => {
    const val = Number(t.amount) || 0;
    if (t.account === 'shared') {
      if (t.type === 'income') shared.income += val;
      else shared.expense += val;
    } else {
      const target = t.author === 'wife' ? wifePersonal : husbandPersonal;
      if (t.type === 'income') target.income += val;
      else target.expense += val;
    }
  });

  shared.balance = shared.income - shared.expense;
  husbandPersonal.balance = husbandPersonal.income - husbandPersonal.expense;
  wifePersonal.balance = wifePersonal.income - wifePersonal.expense;
  return { shared, husbandPersonal, wifePersonal };
};

const res = calcWallets(sampleTxs);
assert.strictEqual(res.shared.balance, 90000, 'Shared balance must be 90000 (untouched by personal txs)');
assert.strictEqual(res.husbandPersonal.balance, 25000, 'Husband personal balance must be 25000');
assert.strictEqual(res.wifePersonal.balance, 16000, 'Wife personal balance must be 16000');
console.log('✅ Separate wallet balances verified!');
