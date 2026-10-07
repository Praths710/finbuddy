// Shared money helpers used across the dashboard and AI panel.

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (n) => inr.format(Number(n) || 0);
export const moneyExact = (n) => inrExact.format(Number(n) || 0);
export const compactMoney = (n) => {
  const v = Math.abs(Number(n) || 0);
  const sign = n < 0 ? '-' : '';
  if (v >= 1e7) return `${sign}₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${sign}₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${sign}₹${(v / 1e3).toFixed(1)}k`;
  return `${sign}₹${Math.round(v)}`;
};

export const isIncomeCategory = (name) => (name || '').toLowerCase().includes('income');
export const isIncomeTx = (tx) => isIncomeCategory(tx.category?.name);

// Months are "YYYY-MM" keys; API dates are ISO strings so slicing is enough.
export const monthKey = (date) => (typeof date === 'string' ? date.slice(0, 7) : date.toISOString().slice(0, 7));
export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const monthLabel = (key, opts = { month: 'long', year: 'numeric' }) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', opts);
};

export const loanActiveIn = (loan, key) =>
  monthKey(loan.start_date) <= key && (!loan.end_date || monthKey(loan.end_date) >= key);

export function monthStats({ transactions, loans, baseIncome, key }) {
  const txs = transactions.filter((t) => monthKey(t.date) === key);
  const extraIncome = txs.filter(isIncomeTx).reduce((a, t) => a + t.amount, 0);
  const spending = txs.filter((t) => !isIncomeTx(t)).reduce((a, t) => a + t.amount, 0);
  const emi = loans.filter((l) => loanActiveIn(l, key)).reduce((a, l) => a + l.amount, 0);
  const income = baseIncome + extraIncome;
  const spent = spending + emi;
  const net = income - spent;
  const savingsRate = income > 0 ? net / income : 0;
  return { txs, extraIncome, spending, emi, income, spent, net, savingsRate };
}

// Mirrors the backend's score in ai_service.summarize so both always agree.
export function healthScore({ income, emi, savingsRate }) {
  if (income <= 0) return { score: 50, rating: 'Add your income' };
  let score = 100;
  if (savingsRate < 0.2) score -= 15;
  if (savingsRate < 0.1) score -= 15;
  if (savingsRate < 0) score -= 20;
  if (emi / income > 0.4) score -= 20;
  score = Math.max(0, Math.min(100, score));
  const rating = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs attention';
  return { score, rating };
}

// Stable colour per category name.
export const PALETTE = ['#a78bfa', '#818cf8', '#f472b6', '#34d399', '#fbbf24', '#38bdf8', '#fb923c', '#e879f9', '#2dd4bf', '#f87171'];
export const colorFor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export const initials = (user) => {
  const src = (user?.full_name || user?.email || '?').trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (user?.full_name ? parts[1]?.[0] || '' : '')).toUpperCase();
};

export const apiError = (err, fallback = 'Something went wrong. Please try again.') => {
  const d = err?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg.replace(/^Value error, /, '');
  if (err?.code === 'ERR_NETWORK') return "Can't reach the server. It may be waking up — try again in a moment.";
  return fallback;
};
