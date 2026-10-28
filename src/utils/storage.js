// Безопасная загрузка и сохранение в LocalStorage
export const loadFromStorage = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved || saved === 'undefined' || saved === 'null') return fallback;
    const parsed = JSON.parse(saved);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch (err) {
    console.error(`Failed to load ${key} from localStorage:`, err);
    return fallback;
  }
};

export const saveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to save ${key} to localStorage:`, err);
  }
};

// Начальные демонстрационные данные с операциями за август, сентябрь и октябрь 2026
export const INITIAL_TRANSACTIONS = [
  // Август 2026
  { id: 'aug1', title: 'Зарплата (август)', amount: 130000, type: 'income', category: 'Зарплата', account: 'shared', author: 'husband', date: '2026-08-10' },
  { id: 'aug2', title: 'Супермаркеты и фермерская лавка', amount: 23500, type: 'expense', category: 'Продукты', account: 'shared', author: 'husband', date: '2026-08-15' },
  { id: 'aug3', title: 'ЖКУ, свет и вода', amount: 5800, type: 'expense', category: 'Дом и ЖКУ', account: 'shared', author: 'wife', date: '2026-08-18' },
  { id: 'aug4', title: 'Кафе и ужины', amount: 4200, type: 'expense', category: 'Кафе и еда вне дома', account: 'shared', author: 'wife', date: '2026-08-22' },
  { id: 'aug5', title: 'Бензин и ТО', amount: 4800, type: 'expense', category: 'Транспорт и авто', account: 'shared', author: 'husband', date: '2026-08-24' },

  // Сентябрь 2026
  { id: 'sep1', title: 'Зарплата (сентябрь)', amount: 135000, type: 'income', category: 'Зарплата', account: 'shared', author: 'husband', date: '2026-09-10' },
  { id: 'sep2', title: 'Супермаркет (ВкусВилл)', amount: 21500, type: 'expense', category: 'Продукты', account: 'shared', author: 'husband', date: '2026-09-14' },
  { id: 'sep3', title: 'ЖКУ и интернет', amount: 5900, type: 'expense', category: 'Дом и ЖКУ', account: 'shared', author: 'wife', date: '2026-09-18' },
  { id: 'sep4', title: 'Кофейни и рестораны', amount: 3800, type: 'expense', category: 'Кафе и еда вне дома', account: 'shared', author: 'wife', date: '2026-09-21' },
  { id: 'sep5', title: 'В копилку: Отпуск в горах', amount: 20000, type: 'expense', category: 'Накопления', account: 'shared', author: 'husband', date: '2026-09-25', goalId: 'g1' },
  { id: 'sep6', title: 'Платёж по автокредиту', amount: 20000, type: 'expense', category: 'Долги и кредиты', account: 'shared', author: 'husband', date: '2026-09-12', debtId: 'debt_1' },
  { id: 'sep7', title: 'Фриланс мужа', amount: 35000, type: 'income', category: 'Подработка', account: 'personal', author: 'husband', date: '2026-09-20' },
  { id: 'sep8', title: 'Премия жены', amount: 30000, type: 'income', category: 'Другое', account: 'personal', author: 'wife', date: '2026-09-22' },
  { id: 'sep9', title: 'Заправка и парковка', amount: 5200, type: 'expense', category: 'Транспорт и авто', account: 'shared', author: 'husband', date: '2026-09-26' },

  // Октябрь 2026
  { id: '1', title: 'Супермаркет (ВкусВилл)', amount: 25700, type: 'expense', category: 'Продукты', account: 'shared', author: 'husband', date: '2026-10-23' },
  { id: '2', title: 'Кофейня и выпечка', amount: 2200, type: 'expense', category: 'Кафе и еда вне дома', account: 'shared', author: 'wife', date: '2026-10-23' },
  { id: '3', title: 'Аванс по проекту (в общий бюджет)', amount: 120000, type: 'income', category: 'Зарплата', account: 'shared', author: 'husband', date: '2026-10-20' },
  { id: '4', title: 'Оплата ЖКУ и капремонт', amount: 6200, type: 'expense', category: 'Дом и ЖКУ', account: 'shared', author: 'wife', date: '2026-10-18', recurringId: 'rec_2' },
  { id: '5', title: 'В копилку: Отпуск в горах', amount: 15000, type: 'expense', category: 'Накопления', account: 'shared', author: 'husband', date: '2026-10-15', goalId: 'g1' },
  { id: '6', title: 'Фриланс (на личную карту)', amount: 28000, type: 'income', category: 'Подработка', account: 'personal', author: 'husband', date: '2026-10-19' },
  { id: '7', title: 'Игры в Steam и гаджеты', amount: 3200, type: 'expense', category: 'Развлечения и кино', account: 'personal', author: 'husband', date: '2026-10-22' },
  { id: '8', title: 'Премия и кешбэк (личный счет)', amount: 24000, type: 'income', category: 'Другое', account: 'personal', author: 'wife', date: '2026-10-17' },
  { id: '9', title: 'Косметика и уход', amount: 4100, type: 'expense', category: 'Шопинг и вещи', account: 'personal', author: 'wife', date: '2026-10-21' },
  { id: '10', title: 'Платёж по автокредиту', amount: 20000, type: 'expense', category: 'Долги и кредиты', account: 'shared', author: 'husband', date: '2026-10-12', debtId: 'debt_1' },
];

export const INITIAL_GOALS = [
  { id: 'g1', title: 'Отпуск в горах', target: 200000, current: 85000, color: 'from-amber-500 to-orange-500', icon: '🏔️' },
  { id: 'g2', title: 'Подушка безопасности', target: 450000, current: 310000, color: 'from-emerald-500 to-teal-500', icon: '🛡️' },
  { id: 'g3', title: 'Апгрейд рабочего места', target: 120000, current: 65000, color: 'from-blue-500 to-indigo-500', icon: '🖥️' },
];

export const INITIAL_RECURRING = [
  { id: 'rec_1', title: 'Аренда / Ипотека', amount: 45000, category: 'Дом и ЖКУ', account: 'shared', author: 'husband', dueDate: 5, isMandatory: true, paidMonths: ['2026-10'] },
  { id: 'rec_2', title: 'ЖКУ и капремонт', amount: 6200, category: 'Дом и ЖКУ', account: 'shared', author: 'wife', dueDate: 15, isMandatory: true, paidMonths: ['2026-10'] },
  { id: 'rec_3', title: 'Домашний интернет и ТВ', amount: 950, category: 'Связь и интернет', account: 'shared', author: 'husband', dueDate: 25, isMandatory: true, paidMonths: [] },
  { id: 'rec_5', title: 'Мобильная связь (2 номера)', amount: 1400, category: 'Связь и интернет', account: 'shared', author: 'wife', dueDate: 27, isMandatory: true, paidMonths: [] },
  { id: 'rec_4', title: 'Детский сад / Секции', amount: 12000, category: 'Дети и секции', account: 'shared', author: 'wife', dueDate: 28, isMandatory: true, paidMonths: [] },
];

export const INITIAL_USER_PROFILES = {
  husband: { id: 'husband', name: 'Женя', emoji: '🧔🏻‍♂️', color: 'blue' },
  wife: { id: 'wife', name: 'Ксюша', emoji: '👩🏼', color: 'rose' },
};

export const QUICK_USER_AVATARS = [
  '🧔🏻‍♂️', '👩🏼', '🧑🏻‍💻', '👩🏻‍🎨', '🦁', '🦊', '🐱', '🚀', '⚡', '💎', '🎯', '☕', '🎮', '🌸', '☀️', '🌿'
];

export const INITIAL_DEBTS = [
  { id: 'debt_1', title: 'Автокредит', initialAmount: 600000, remainingAmount: 240000, monthlyPayment: 20000, paymentDay: 12, isRegular: true, account: 'shared', author: 'husband', paidMonths: ['2026-10'], icon: '🚗', color: 'from-amber-500 to-rose-500' },
  { id: 'debt_2', title: 'Рассрочка на технику', initialAmount: 90000, remainingAmount: 30000, monthlyPayment: 0, paymentDay: null, isRegular: false, account: 'shared', author: 'husband', paidMonths: [], icon: '📱', color: 'from-blue-500 to-indigo-500' },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'food', name: 'Продукты', icon: '🛒', color: 'bg-emerald-50 text-emerald-700', bucket: 'base' },
  { id: 'home', name: 'Дом и ЖКУ', icon: '🏠', color: 'bg-blue-50 text-blue-700', bucket: 'base' },
  { id: 'telecom', name: 'Связь и интернет', icon: '📡', color: 'bg-cyan-50 text-cyan-700', bucket: 'base' },
  { id: 'transport', name: 'Транспорт и авто', icon: '🚗', color: 'bg-purple-50 text-purple-700', bucket: 'base' },
  { id: 'kids', name: 'Дети и секции', icon: '🧸', color: 'bg-orange-50 text-orange-700', bucket: 'base' },
  { id: 'health', name: 'Здоровье и спорт', icon: '🌿', color: 'bg-teal-50 text-teal-700', bucket: 'base' },
  { id: 'cafe', name: 'Кафе и еда вне дома', icon: '☕', color: 'bg-amber-50 text-amber-700', bucket: 'wants' },
  { id: 'leisure', name: 'Развлечения и кино', icon: '🎬', color: 'bg-pink-50 text-pink-700', bucket: 'wants' },
  { id: 'shopping', name: 'Шопинг и вещи', icon: '🛍️', color: 'bg-indigo-50 text-indigo-700', bucket: 'wants' },
  { id: 'savings', name: 'Накопления', icon: '🎯', color: 'bg-violet-50 text-violet-700', bucket: 'future' },
  { id: 'debts', name: 'Долги и кредиты', icon: '💳', color: 'bg-rose-50 text-rose-700', bucket: 'future' },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { id: 'salary', name: 'Зарплата', icon: '💰', color: 'bg-emerald-50 text-emerald-700' },
  { id: 'freelance', name: 'Подработка', icon: '💻', color: 'bg-blue-50 text-blue-700' },
  { id: 'investments', name: 'Инвестиции', icon: '📈', color: 'bg-amber-50 text-amber-700' },
  { id: 'gifts', name: 'Подарки', icon: '🎁', color: 'bg-pink-50 text-pink-700' },
  { id: 'other_income', name: 'Другое', icon: '💵', color: 'bg-stone-100 text-stone-700' },
];

export const GOAL_COLOR_PRESETS = [
  { label: 'Янтарь', value: 'from-amber-500 to-orange-500' },
  { label: 'Изумруд', value: 'from-emerald-500 to-teal-500' },
  { label: 'Синий', value: 'from-blue-500 to-indigo-500' },
  { label: 'Фиолетовый', value: 'from-purple-500 to-pink-500' },
  { label: 'Рубин', value: 'from-rose-500 to-red-500' },
];

export const QUICK_GOAL_ICONS = ['🎯', '🏔️', '🛡️', '🖥️', '🚗', '🏖️', '🏡', '💍', '👶', '🎓', '📱'];

export const CATEGORY_ALIASES = {
  'работа': { id: 'freelance', name: 'Подработка', icon: '💻', color: 'bg-blue-50 text-blue-700' },
  'дом': { id: 'home', name: 'Дом и ЖКУ', icon: '🏠', color: 'bg-blue-50 text-blue-700', bucket: 'base' },
  'кафе': { id: 'cafe', name: 'Кафе и еда вне дома', icon: '☕', color: 'bg-amber-50 text-amber-700', bucket: 'wants' },
  'транспорт': { id: 'transport', name: 'Транспорт и авто', icon: '🚗', color: 'bg-purple-50 text-purple-700', bucket: 'base' },
  'развлечения': { id: 'leisure', name: 'Развлечения и кино', icon: '🎬', color: 'bg-pink-50 text-pink-700', bucket: 'wants' },
  'здоровье': { id: 'health', name: 'Здоровье и спорт', icon: '🌿', color: 'bg-teal-50 text-teal-700', bucket: 'base' },
  'шопинг': { id: 'shopping', name: 'Шопинг и вещи', icon: '🛍️', color: 'bg-indigo-50 text-indigo-700', bucket: 'wants' },
  'долги': { id: 'debts', name: 'Долги и кредиты', icon: '💳', color: 'bg-rose-50 text-rose-700', bucket: 'future' },
  'связь': { id: 'telecom', name: 'Связь и интернет', icon: '📡', color: 'bg-cyan-50 text-cyan-700', bucket: 'base' },
};
