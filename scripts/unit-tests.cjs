const assert = require('assert');

// 1. Verify Category resolution
const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'food', name: 'Продукты', icon: '🛒', color: 'bg-emerald-50 text-emerald-700' },
  { id: 'cafe', name: 'Кафе и еда вне дома', icon: '☕', color: 'bg-amber-50 text-amber-700' },
  { id: 'home', name: 'Дом и ЖКУ', icon: '🏠', color: 'bg-blue-50 text-blue-700' },
  { id: 'transport', name: 'Транспорт и авто', icon: '🚗', color: 'bg-purple-50 text-purple-700' },
  { id: 'leisure', name: 'Развлечения и кино', icon: '🎬', color: 'bg-pink-50 text-pink-700' },
  { id: 'health', name: 'Здоровье и спорт', icon: '🌿', color: 'bg-teal-50 text-teal-700' },
  { id: 'shopping', name: 'Шопинг и вещи', icon: '🛍️', color: 'bg-indigo-50 text-indigo-700' },
  { id: 'savings', name: 'Накопления', icon: '🎯', color: 'bg-violet-50 text-violet-700' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { id: 'salary', name: 'Зарплата', icon: '💰', color: 'bg-emerald-50 text-emerald-700' },
  { id: 'freelance', name: 'Подработка', icon: '💻', color: 'bg-blue-50 text-blue-700' },
  { id: 'investments', name: 'Инвестиции', icon: '📈', color: 'bg-amber-50 text-amber-700' },
  { id: 'gifts', name: 'Подарки', icon: '🎁', color: 'bg-pink-50 text-pink-700' },
  { id: 'other_income', name: 'Другое', icon: '💵', color: 'bg-stone-100 text-stone-700' },
];

const CATEGORY_ALIASES = {
  'работа': { id: 'freelance', name: 'Подработка', icon: '💻', color: 'bg-blue-50 text-blue-700' },
  'дом': { id: 'home', name: 'Дом и ЖКУ', icon: '🏠', color: 'bg-blue-50 text-blue-700' },
  'кафе': { id: 'cafe', name: 'Кафе и еда вне дома', icon: '☕', color: 'bg-amber-50 text-amber-700' },
  'транспорт': { id: 'transport', name: 'Транспорт и авто', icon: '🚗', color: 'bg-purple-50 text-purple-700' },
  'развлечения': { id: 'leisure', name: 'Развлечения и кино', icon: '🎬', color: 'bg-pink-50 text-pink-700' },
  'здоровье': { id: 'health', name: 'Здоровье и спорт', icon: '🌿', color: 'bg-teal-50 text-teal-700' },
  'шопинг': { id: 'shopping', name: 'Шопинг и вещи', icon: '🛍️', color: 'bg-indigo-50 text-indigo-700' },
};

const getCategoryMeta = (categoryName, type, customCategories = []) => {
  const normName = (categoryName || '').trim().toLowerCase();
  const all = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES, ...customCategories];
  const found = all.find(c => c.name.toLowerCase() === normName);
  if (found) return found;

  if (CATEGORY_ALIASES[normName]) {
    return CATEGORY_ALIASES[normName];
  }

  if (type === 'income') {
    return { id: 'custom_inc', name: categoryName || 'Доход', icon: '💵', color: 'bg-emerald-50 text-emerald-700' };
  }
  return { id: 'custom_exp', name: categoryName || 'Расход', icon: '📦', color: 'bg-stone-100 text-stone-700' };
};

// Test 1: Category resolution
console.log('Testing category resolution...');
assert.strictEqual(getCategoryMeta('Кафе', 'expense').icon, '☕', 'Alias "Кафе" should map to ☕');
assert.strictEqual(getCategoryMeta('Работа', 'income').icon, '💻', 'Alias "Работа" should map to 💻');
assert.strictEqual(getCategoryMeta('Дом', 'expense').icon, '🏠', 'Alias "Дом" should map to 🏠');
assert.strictEqual(getCategoryMeta('Неизвестный доход', 'income').icon, '💵', 'Unknown income should map to 💵');
assert.strictEqual(getCategoryMeta('Неизвестный расход', 'expense').icon, '📦', 'Unknown expense should map to 📦');
assert.strictEqual(getCategoryMeta('Зарплата', 'income').icon, '💰', 'Зарплата should map to 💰');
console.log('✅ Category resolution tests passed.');

// Test 2: Local date string YYYY-MM-DD
console.log('Testing local date helper...');
const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const localDate = getLocalDateString();
assert.match(localDate, /^\d{4}-\d{2}-\d{2}$/, 'Local date must match YYYY-MM-DD format');
console.log('✅ Local date tests passed: ' + localDate);

// Test 3: Safe storage parser
console.log('Testing safe storage parser...');
const safeParse = (str, fallback) => {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
};
assert.deepStrictEqual(safeParse(null, [1]), [1]);
assert.deepStrictEqual(safeParse('{invalid json}', [2]), [2]);
assert.deepStrictEqual(safeParse('[3, 4]', [2]), [3, 4]);
console.log('✅ Safe storage parser tests passed.');

// Test 4: Goal contribution & rollback
console.log('Testing goal contribution accounting...');
let goals = [{ id: 'g1', title: 'Отпуск', target: 100000, current: 80000 }];
let transactions = [];

// Contribute 30000 (exceeds target)
const contribute = 30000;
goals = goals.map(g => g.id === 'g1' ? { ...g, current: g.current + contribute } : g);
assert.strictEqual(goals[0].current, 110000, 'Current should be 110000 (no arbitrary capping to target)');
const tx = { id: 'tx1', amount: contribute, goalId: 'g1', type: 'expense' };
transactions.push(tx);

// Delete transaction
transactions = transactions.filter(t => t.id !== 'tx1');
if (tx.goalId) {
  goals = goals.map(g => g.id === tx.goalId ? { ...g, current: Math.max(0, g.current - tx.amount) } : g);
}
assert.strictEqual(goals[0].current, 80000, 'Current should roll back to exactly 80000');
console.log('✅ Goal contribution & rollback tests passed.');

// Test 5: Goal progress percentage edge cases
console.log('Testing goal percentage edge cases...');
const calcPercent = (g) => g.target > 0 ? Math.min(100, Math.max(0, Math.round((g.current / g.target) * 100))) : 0;
assert.strictEqual(calcPercent({ current: 50, target: 100 }), 50);
assert.strictEqual(calcPercent({ current: 150, target: 100 }), 100);
assert.strictEqual(calcPercent({ current: -10, target: 100 }), 0);
assert.strictEqual(calcPercent({ current: 50, target: 0 }), 0, 'Target 0 should not produce NaN');
assert.strictEqual(calcPercent({ current: 50, target: -10 }), 0, 'Target < 0 should not produce negative percentage');
console.log('✅ Goal percentage tests passed.');

console.log('ALL UNIT TESTS PASSED SUCCESSFULLY! 🚀');
