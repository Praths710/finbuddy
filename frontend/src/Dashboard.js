import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'react-bootstrap';
import {
  FiChevronLeft, FiChevronRight, FiLogOut, FiPlus, FiSearch, FiEdit2, FiTrash2, FiArrowDownLeft,
  FiArrowUpRight, FiCreditCard, FiPercent, FiPieChart, FiList, FiSettings, FiGrid, FiCalendar, FiInbox,
  FiUser, FiTag, FiEye, FiEyeOff, FiDownload, FiTarget, FiTrendingUp, FiAlertTriangle, FiSliders,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { API_BASE } from './config';
import { useAuth } from './AuthContext';
import AIChat from './components/AIChat';
import { Brand, Toasts, useToasts, useCountUp, Spinner } from './components/ui';
import {
  money, compactMoney, monthStats, healthScore, currentMonthKey, shiftMonth, monthLabel, monthKey,
  isIncomeTx, isIncomeCategory, colorFor, greeting, initials, loanActiveIn, apiError,
} from './finance';
import './Dashboard.css';

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Dates go to the API as naive local noon so they never slip a day across time zones.
const toApiDate = (yyyyMmDd) => `${yyyyMmDd}T12:00:00`;
const fromApiDate = (iso) => new Date(`${iso.slice(0, 10)}T00:00:00`);
const fmtDay = (iso, opts = { day: 'numeric', month: 'short' }) => fromApiDate(iso).toLocaleDateString('en-IN', opts);

/* =====================================================================
   Dashboard
   ===================================================================== */
function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [toasts, toast] = useToasts();

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loans, setLoans] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [income, setIncome] = useState({ active: 0, passive: 0 });
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(currentMonthKey());
  const [tab, setTab] = useState('overview');
  const [aiOpen, setAiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [txModal, setTxModal] = useState(null); // null | {} (new) | tx (edit)
  const [loanModal, setLoanModal] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, body, onYes }
  const [budgetModal, setBudgetModal] = useState(null);
  const [goalModal, setGoalModal] = useState(null);
  const [contribModal, setContribModal] = useState(null);
  const [privacy, setPrivacy] = useState(() => {
    try { return localStorage.getItem('fb-privacy') === '1'; } catch { return false; }
  });

  // Privacy mode blurs every amount on screen (handy in public).
  useEffect(() => {
    document.body.classList.toggle('privacy-on', privacy);
    try { localStorage.setItem('fb-privacy', privacy ? '1' : '0'); } catch { /* storage unavailable */ }
    return () => document.body.classList.remove('privacy-on');
  }, [privacy]);

  const loadTransactions = useCallback(
    () => axios.get(`${API_BASE}/transactions/?limit=5000`).then((r) => setTransactions(r.data)), []);
  const loadLoans = useCallback(
    () => axios.get(`${API_BASE}/loans/?limit=500`).then((r) => setLoans(r.data)), []);
  const loadCategories = useCallback(
    () => axios.get(`${API_BASE}/categories/?limit=500`).then((r) => setCategories(r.data)), []);
  const loadBudgets = useCallback(
    () => axios.get(`${API_BASE}/budgets/`).then((r) => setBudgets(r.data)), []);
  const loadGoals = useCallback(
    () => axios.get(`${API_BASE}/goals/`).then((r) => setGoals(r.data)), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadTransactions(),
      loadLoans(),
      loadCategories(),
      loadBudgets(),
      loadGoals(),
      axios.get(`${API_BASE}/user/income`).then((r) => {
        if (alive) setIncome({ active: r.data.active_income || 0, passive: r.data.passive_income || 0 });
      }),
    ])
      .catch((err) => toast(apiError(err, "Couldn't load your data."), 'error'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [loadTransactions, loadLoans, loadCategories, loadBudgets, loadGoals, toast]);

  const baseIncome = (income.active || 0) + (income.passive || 0);
  const stats = useMemo(
    () => monthStats({ transactions, loans, baseIncome, key: month }),
    [transactions, loans, baseIncome, month]);
  const prevStats = useMemo(
    () => monthStats({ transactions, loans, baseIncome, key: shiftMonth(month, -1) }),
    [transactions, loans, baseIncome, month]);
  const health = healthScore(stats);
  const budgetUsage = useMemo(() => budgets.map((b) => {
    const spent = stats.txs.filter((t) => t.category_id === b.category_id && !isIncomeTx(t)).reduce((a, t) => a + t.amount, 0);
    return { ...b, spent, pct: b.amount > 0 ? (spent / b.amount) * 100 : 0 };
  }).sort((a, b) => b.pct - a.pct), [budgets, stats]);
  const overBudget = budgetUsage.filter((b) => b.pct > 100).length;
  const isCurrent = month === currentMonthKey();

  const handleLogout = () => { logout(); navigate('/login'); };

  const askDelete = (title, body, url, reload, done) =>
    setConfirm({
      title, body,
      onYes: () => axios.delete(url).then(reload).then(() => toast(done))
        .catch((err) => toast(apiError(err), 'error')),
    });

  return (
    <>
      {/* ---------------- Nav ---------------- */}
      <nav className="fb-nav">
        <div className="fb-nav-inner">
          <Brand to="/dashboard" />
          <div className="ms-auto d-flex align-items-center gap-2">
            <button className="fb-icon-btn" onClick={() => setPrivacy((p) => !p)}
              aria-label={privacy ? 'Show amounts' : 'Hide amounts'} title={privacy ? 'Show amounts' : 'Hide amounts (privacy mode)'}>
              {privacy ? <FiEyeOff /> : <FiEye />}
            </button>
            <button className="ai-trigger" onClick={() => setAiOpen(true)}>
              <HiSparkles className="spark" /> <span className="txt">Ask FinBuddy AI</span>
            </button>
            <div className="position-relative">
              <button className="fb-avatar" onClick={() => setMenuOpen((o) => !o)} aria-label="Account menu">
                {initials(user)}
              </button>
              {menuOpen && (
                <>
                  <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1025 }} onClick={() => setMenuOpen(false)} />
                  <div className="fb-menu">
                    <div className="fb-menu-head">
                      <div className="fw-semibold">{user?.full_name || 'Your account'}</div>
                      <div className="small muted fb-ellipsis">{user?.email}</div>
                    </div>
                    <button onClick={() => { setTab('settings'); setMenuOpen(false); }}><FiSettings /> Settings</button>
                    <button onClick={handleLogout}><FiLogOut /> Sign out</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="dash">
        {/* ---------------- Header ---------------- */}
        <div className="dash-head fb-fade-in">
          <div>
            <div className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <h1 className="serif dash-hello">
              {greeting()}, <em className="grad-text">{(user?.full_name || '').split(' ')[0] || 'there'}</em>
            </h1>
          </div>
          <div className="month-switch">
            <button className="fb-icon-btn" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month"><FiChevronLeft /></button>
            <span className="label">{monthLabel(month)}</span>
            <button className="fb-icon-btn" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={isCurrent}
              style={{ opacity: isCurrent ? 0.3 : 1 }} aria-label="Next month"><FiChevronRight /></button>
          </div>
        </div>

        {loading ? <DashboardSkeleton /> : (
          <>
            {/* ---------------- Hero ---------------- */}
            <div className="hero-grid">
              <NetCard stats={stats} prev={prevStats} month={month} baseIncome={baseIncome} isCurrent={isCurrent} onSetIncome={() => setTab('settings')} />
              <div className="fb-card fb-fade-in d2 text-center">
                <div className="fb-card-title justify-content-center">Financial health</div>
                <ScoreRing score={health.score} />
                <div className="fw-semibold">{health.rating}</div>
                <div className="small muted mt-1">
                  {stats.income > 0
                    ? `Saving ${Math.round(stats.savingsRate * 100)}% of income this month`
                    : 'Add your monthly income in Settings'}
                </div>
              </div>
            </div>

            {/* ---------------- Stats ---------------- */}
            <div className="stat-grid">
              <Stat className="d1" icon={<FiArrowDownLeft />} tint="#74d6a8" label="Income" value={money(stats.income)}
                sub={stats.extraIncome > 0 ? `incl. ${money(stats.extraIncome)} extra` : 'Salary + passive'} />
              <Stat className="d2" icon={<FiArrowUpRight />} tint="#f19a8f" label="Spending" value={money(stats.spending)}
                sub={`${stats.txs.filter((t) => !isIncomeTx(t)).length} transactions`} />
              <Stat className="d3" icon={<FiCreditCard />} tint="#f2c14e" label="EMIs" value={money(stats.emi)}
                sub={`${loans.filter((l) => loanActiveIn(l, month)).length} active`} />
              <Stat className="d4" icon={<FiPercent />} tint="#e8cf8f" label="Savings rate"
                value={stats.income > 0 ? `${Math.round(stats.savingsRate * 100)}%` : '—'}
                sub={stats.income > 0 ? `${money(stats.net)} kept` : 'Set income to track'} />
            </div>

            {/* ---------------- Tabs ---------------- */}
            <div className="tabs-bar">
              <div className="fb-seg" role="tablist">
                {[
                  ['overview', 'Overview', <FiGrid key="i" />],
                  ['transactions', 'Transactions', <FiList key="i" />],
                  ['budgets', 'Budgets', <FiSliders key="i" />],
                  ['goals', 'Goals', <FiTarget key="i" />],
                  ['loans', 'Loans & EMIs', <FiCalendar key="i" />],
                  ['settings', 'Settings', <FiSettings key="i" />],
                ].map(([key, label, icon]) => (
                  <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                    {icon}{label}
                    {key === 'budgets' && overBudget > 0 && <span className="tab-badge">{overBudget}</span>}
                  </button>
                ))}
              </div>
              {(tab === 'overview' || tab === 'transactions') && (
                <button className="fb-btn" onClick={() => setTxModal({})}><FiPlus /> Add transaction</button>
              )}
              {tab === 'loans' && (
                <button className="fb-btn" onClick={() => setLoanModal({})}><FiPlus /> Add loan / EMI</button>
              )}
              {tab === 'budgets' && (
                <button className="fb-btn" onClick={() => setBudgetModal({})}><FiPlus /> Set a budget</button>
              )}
              {tab === 'goals' && (
                <button className="fb-btn" onClick={() => setGoalModal({})}><FiPlus /> New goal</button>
              )}
            </div>

            {tab === 'overview' && (
              <Overview transactions={transactions} loans={loans} baseIncome={baseIncome} month={month} stats={stats}
                budgetUsage={budgetUsage} goals={goals} onOpenTab={setTab}
                onEdit={setTxModal} onViewAll={() => setTab('transactions')} onAdd={() => setTxModal({})} />
            )}
            {tab === 'transactions' && (
              <Transactions transactions={transactions} categories={categories} month={month}
                onEdit={setTxModal}
                onDelete={(tx) => askDelete('Delete transaction?', `“${tx.description}” for ${money(tx.amount)} will be removed.`,
                  `${API_BASE}/transactions/${tx.id}`, loadTransactions, 'Transaction deleted')} />
            )}
            {tab === 'budgets' && (
              <Budgets usage={budgetUsage} month={month} onEdit={setBudgetModal} onAdd={() => setBudgetModal({})}
                onDelete={(b) => askDelete('Remove budget?', `The ${b.category?.name || ''} limit will be removed.`,
                  `${API_BASE}/budgets/${b.id}`, loadBudgets, 'Budget removed')} />
            )}
            {tab === 'goals' && (
              <Goals goals={goals} onAdd={() => setGoalModal({})} onEdit={setGoalModal} onContribute={setContribModal}
                onDelete={(g) => askDelete('Delete goal?', `“${g.name}” and its progress will be removed.`,
                  `${API_BASE}/goals/${g.id}`, loadGoals, 'Goal deleted')} />
            )}
            {tab === 'loans' && (
              <Loans loans={loans} month={month} onEdit={setLoanModal} onAdd={() => setLoanModal({})}
                onDelete={(loan) => askDelete('Delete loan?', `“${loan.name}” will be removed from your EMIs.`,
                  `${API_BASE}/loans/${loan.id}`, loadLoans, 'Loan deleted')} />
            )}
            {tab === 'settings' && (
              <Settings user={user} income={income} setIncome={setIncome} categories={categories}
                reloadCategories={loadCategories} toast={toast} onLogout={handleLogout} />
            )}
          </>
        )}
      </div>

      {txModal && (
        <TransactionModal tx={txModal} categories={categories} onClose={() => setTxModal(null)}
          onSaved={(msg) => { setTxModal(null); loadTransactions(); toast(msg); }} toast={toast} />
      )}
      {loanModal && (
        <LoanModal loan={loanModal} onClose={() => setLoanModal(null)}
          onSaved={(msg) => { setLoanModal(null); loadLoans(); toast(msg); }} toast={toast} />
      )}
      {budgetModal && (
        <BudgetModal budget={budgetModal} categories={categories} existing={budgets} onClose={() => setBudgetModal(null)}
          onSaved={(msg) => { setBudgetModal(null); loadBudgets(); toast(msg); }} toast={toast} />
      )}
      {goalModal && (
        <GoalModal goal={goalModal} onClose={() => setGoalModal(null)}
          onSaved={(msg) => { setGoalModal(null); loadGoals(); toast(msg); }} toast={toast} />
      )}
      {contribModal && (
        <ContributeModal goal={contribModal} onClose={() => setContribModal(null)}
          onSaved={(msg) => { setContribModal(null); loadGoals(); toast(msg); }} toast={toast} />
      )}
      <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />
      <AIChat open={aiOpen} onClose={() => setAiOpen(false)} user={user} health={healthScore(monthStats({ transactions, loans, baseIncome, key: currentMonthKey() }))} />
      <Toasts toasts={toasts} />
    </>
  );
}

/* =====================================================================
   Hero pieces
   ===================================================================== */
function NetCard({ stats, prev, month, baseIncome, isCurrent, onSetIncome }) {
  const net = useCountUp(stats.net);
  const pct = stats.income > 0 ? (stats.spent / stats.income) * 100 : 0;
  const delta = stats.spent - prev.spent;
  // Month-end forecast: extrapolate day-to-day spending; EMIs are already fixed.
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = stats.spending / now.getDate() * daysInMonth + stats.emi;
  const showForecast = isCurrent && stats.spending > 0 && now.getDate() < daysInMonth;
  const overPace = stats.income > 0 && projected > stats.income;
  return (
    <div className="fb-card fb-card-hero fb-fade-in d1">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div className="eyebrow">Net · {monthLabel(month, { month: 'long' })}</div>
        {prev.spent > 0 && (
          <span className={`fb-chip ${delta > 0 ? '' : 'violet'}`}>
            {delta > 0 ? <FiArrowUpRight className="neg" /> : <FiArrowDownLeft className="pos" />}
            {money(Math.abs(delta))} {delta > 0 ? 'more' : 'less'} spent than last month
          </span>
        )}
      </div>
      <div className={`serif hero-net num ${stats.net < 0 ? 'neg' : 'grad-text'}`}>{money(net)}</div>
      {baseIncome > 0 || stats.income > 0 ? (
        <>
          <div className="d-flex justify-content-between small muted mb-2 mt-3">
            <span>{money(stats.spent)} spent of {money(stats.income)}</span>
            <span className="num">{pct.toFixed(0)}%</span>
          </div>
          <div className={`fb-progress ${pct > 100 ? 'over' : ''}`}><div style={{ width: `${Math.min(100, pct)}%` }} /></div>
          {showForecast && (
            <div className={`forecast ${overPace ? 'warn' : ''}`}>
              <FiTrendingUp />
              <span>At this pace you'll spend <b className="num">{money(projected)}</b> by month end
                {stats.income > 0 && <> — {overPace ? 'over' : 'leaving'} <b className="num">{money(Math.abs(stats.income - projected))}</b>{overPace ? ' beyond income' : ''}</>}.
              </span>
            </div>
          )}
        </>
      ) : (
        <button className="fb-chip violet mt-3" onClick={onSetIncome}><FiPlus /> Add your monthly income to see your net</button>
      )}
      <div className="hero-meta">
        <div><div className="k">Income</div><div className="v num pos">{money(stats.income)}</div></div>
        <div><div className="k">Spending</div><div className="v num">{money(stats.spending)}</div></div>
        <div><div className="k">EMIs</div><div className="v num">{money(stats.emi)}</div></div>
      </div>
    </div>
  );
}

function ScoreRing({ score }) {
  const shown = useCountUp(score);
  const r = 56, c = 2 * Math.PI * r;
  return (
    <div className="score-ring">
      <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3dfa2" /><stop offset="100%" stopColor="#9c7a24" />
          </linearGradient>
        </defs>
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        <circle cx="66" cy="66" r={r} fill="none" stroke="url(#ringGrad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} />
      </svg>
      <div className="val"><div><b className="num">{Math.round(shown)}</b><span className="small faint">/ 100</span></div></div>
    </div>
  );
}

function Stat({ icon, tint, label, value, sub, className = '' }) {
  return (
    <div className={`fb-card stat lift fb-fade-in ${className}`}>
      <div className="icon" style={{ background: `${tint}1f`, color: tint }}>{icon}</div>
      <div className="small muted">{label}</div>
      <div className="v num">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="hero-grid">
        <div className="fb-skeleton" style={{ height: 250 }} />
        <div className="fb-skeleton" style={{ height: 250 }} />
      </div>
      <div className="stat-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="fb-skeleton" style={{ height: 140 }} />)}</div>
      <div className="fb-skeleton" style={{ height: 320 }} />
    </>
  );
}

/* =====================================================================
   Overview tab
   ===================================================================== */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="fb-tooltip">
      <div className="fw-semibold mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="d-flex gap-3 justify-content-between">
          <span className="muted">{p.name}</span><span className="num">{money(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Overview({ transactions, loans, baseIncome, month, stats, budgetUsage, goals, onOpenTab, onEdit, onViewAll, onAdd }) {
  const flow = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const key = shiftMonth(month, i - 5);
    const s = monthStats({ transactions, loans, baseIncome, key });
    return { name: monthLabel(key, { month: 'short' }), Income: Math.round(s.income), Spent: Math.round(s.spent) };
  }), [transactions, loans, baseIncome, month]);

  const byCat = useMemo(() => {
    const m = {};
    stats.txs.filter((t) => !isIncomeTx(t)).forEach((t) => {
      const n = t.category?.name || 'Uncategorized';
      m[n] = (m[n] || 0) + t.amount;
    });
    if (stats.emi > 0) m['Loans & EMIs'] = stats.emi;
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [stats]);

  const recent = [...stats.txs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div className="overview-grid fb-fade-in">
      <div className="fb-card">
        <div className="fb-card-title"><span>Cash flow · last 6 months</span>
          <span className="d-flex gap-3 small">
            <span className="d-flex align-items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#e8cf8f' }} />Income</span>
            <span className="d-flex align-items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#bdb6a8' }} />Spent</span>
          </span>
        </div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flow} barGap={4} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f3dfa2" /><stop offset="100%" stopColor="#8a6a1f" /></linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#efe9dc" /><stop offset="100%" stopColor="#6b665c" /></linearGradient>
              </defs>
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={compactMoney} width={56} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="Income" fill="url(#gIn)" radius={[6, 6, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Spent" fill="url(#gOut)" radius={[6, 6, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="fb-card">
        <div className="fb-card-title"><span>Where it went</span><FiPieChart /></div>
        {byCat.length === 0 ? (
          <Empty icon={<FiPieChart />} title="No spending yet" text="Your category breakdown will appear here." />
        ) : (
          <>
            <div style={{ height: 170, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={58} outerRadius={80} paddingAngle={2} stroke="none">
                    {byCat.map((d) => <Cell key={d.name} fill={colorFor(d.name)} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="fb-tooltip"><span className="muted">{payload[0].name}</span> <b className="num ms-2">{money(payload[0].value)}</b></div>
                  ) : null} />
                </PieChart>
              </ResponsiveContainer>
              <div className="position-absolute top-50 start-50 translate-middle text-center" style={{ pointerEvents: 'none' }}>
                <div className="small faint">Total</div>
                <div className="fw-semibold num">{compactMoney(stats.spent)}</div>
              </div>
            </div>
            <div className="mt-2">
              {byCat.slice(0, 5).map((d) => (
                <div key={d.name} className="legend-row">
                  <span className="sw" style={{ background: colorFor(d.name) }} />
                  <span className="fb-ellipsis" style={{ width: 110 }}>{d.name}</span>
                  <span className="bar"><div style={{ width: `${(d.value / byCat[0].value) * 100}%`, background: colorFor(d.name) }} /></span>
                  <span className="num" style={{ minWidth: 74, textAlign: 'right' }}>{money(d.value)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="fb-card">
        <div className="fb-card-title"><span>Budgets</span>
          <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={() => onOpenTab('budgets')}>{budgetUsage.length ? 'Manage' : 'Set up'}</button>
        </div>
        {budgetUsage.length === 0 ? (
          <div className="small muted">Set monthly limits per category and FinBuddy will warn you before you overspend.</div>
        ) : budgetUsage.slice(0, 4).map((b) => <BudgetBar key={b.id} b={b} compact />)}
      </div>

      <div className="fb-card">
        <div className="fb-card-title"><span>Savings goals</span>
          <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={() => onOpenTab('goals')}>{goals.length ? 'View all' : 'Create'}</button>
        </div>
        {goals.length === 0 ? (
          <div className="small muted">Saving for a trip, a bike or an emergency fund? Create a goal and track every rupee.</div>
        ) : goals.slice(0, 3).map((g) => {
          const p = Math.min(100, (g.saved / g.target) * 100);
          return (
            <div key={g.id} className="mb-3">
              <div className="d-flex justify-content-between small mb-1">
                <span className="fw-semibold">{g.name}</span>
                <span className="muted"><span className="num">{money(g.saved)}</span> / <span className="num">{money(g.target)}</span></span>
              </div>
              <div className="fb-progress"><div style={{ width: `${p}%` }} /></div>
            </div>
          );
        })}
      </div>

      <div className="fb-card" style={{ gridColumn: '1 / -1' }}>
        <div className="fb-card-title"><span>Recent activity</span>
          {recent.length > 0 && <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={onViewAll}>View all</button>}
        </div>
        {recent.length === 0 ? (
          <Empty icon={<FiInbox />} title={`Nothing in ${monthLabel(month, { month: 'long' })} yet`}
            text="Add your first transaction to start tracking."
            action={<button className="fb-btn fb-btn-sm mt-3" onClick={onAdd}><FiPlus /> Add transaction</button>} />
        ) : recent.map((tx) => <TxRow key={tx.id} tx={tx} onEdit={onEdit} />)}
      </div>
    </div>
  );
}

function Empty({ icon, title, text, action }) {
  return (
    <div className="fb-empty">
      <div className="icon">{icon}</div>
      <div className="fw-semibold" style={{ color: 'var(--text)' }}>{title}</div>
      <div className="small mt-1">{text}</div>
      {action}
    </div>
  );
}

function TxRow({ tx, onEdit, onDelete }) {
  const name = tx.category?.name || 'Uncategorized';
  const income = isIncomeTx(tx);
  const color = colorFor(name);
  return (
    <div className="fb-row">
      <div className="fb-dot" style={{ background: `${color}1f`, color }}>{name[0]}</div>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="fw-medium fb-ellipsis">{tx.description}</div>
        <div className="small faint">{name} · {fmtDay(tx.date)}</div>
      </div>
      <div className={`num fw-semibold ${income ? 'pos' : ''}`}>{income ? '+' : '−'}{money(tx.amount)}</div>
      <div className="actions">
        {onEdit && <button className="fb-icon-btn" onClick={() => onEdit(tx)} aria-label="Edit"><FiEdit2 size={15} /></button>}
        {onDelete && <button className="fb-icon-btn danger" onClick={() => onDelete(tx)} aria-label="Delete"><FiTrash2 size={15} /></button>}
      </div>
    </div>
  );
}

/* =====================================================================
   Transactions tab
   ===================================================================== */
function Transactions({ transactions, categories, month, onEdit, onDelete }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [scope, setScope] = useState('month');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return transactions
      .filter((t) => scope === 'all' || monthKey(t.date) === month)
      .filter((t) => !cat || String(t.category_id || '') === cat)
      .filter((t) => !needle || t.description.toLowerCase().includes(needle) || (t.category?.name || '').toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, q, cat, scope, month]);

  const groups = useMemo(() => {
    const g = [];
    list.forEach((t) => {
      const day = t.date.slice(0, 10);
      if (!g.length || g[g.length - 1].day !== day) g.push({ day, items: [] });
      g[g.length - 1].items.push(t);
    });
    return g;
  }, [list]);

  const totalOut = list.filter((t) => !isIncomeTx(t)).reduce((a, t) => a + t.amount, 0);
  const totalIn = list.filter(isIncomeTx).reduce((a, t) => a + t.amount, 0);

  // Downloads exactly what's on screen (current filters) as a spreadsheet-friendly CSV.
  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Date', 'Description', 'Category', 'Type', 'Amount (INR)']].concat(
      list.map((t) => [t.date.slice(0, 10), t.description, t.category?.name || 'Uncategorized',
        isIncomeTx(t) ? 'Income' : 'Expense', t.amount]));
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finbuddy-${scope === 'all' ? 'all-time' : month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fb-card fb-fade-in">
      <div className="toolbar">
        <div className="search">
          <FiSearch />
          <input className="fb-input" placeholder="Search transactions" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="form-select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <div className="fb-seg">
          <button className={scope === 'month' ? 'active' : ''} onClick={() => setScope('month')}>{monthLabel(month, { month: 'short', year: 'numeric' })}</button>
          <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>All time</button>
        </div>
        <button className="fb-btn fb-btn-ghost" onClick={exportCsv} disabled={!list.length} title="Download as CSV (opens in Excel)">
          <FiDownload /> Export
        </button>
      </div>
      <div className="d-flex gap-3 small muted px-2 mb-1">
        <span>{list.length} transactions</span>
        <span>Out <b className="num" style={{ color: 'var(--text)' }}>{money(totalOut)}</b></span>
        <span>In <b className="num pos">{money(totalIn)}</b></span>
      </div>
      {groups.length === 0 ? (
        <Empty icon={<FiSearch />} title="No transactions found" text={q || cat ? 'Try a different search or filter.' : 'Add one with the button above.'} />
      ) : groups.map((g) => (
        <div key={g.day}>
          <div className="day-head">{fmtDay(g.day, { weekday: 'short', day: 'numeric', month: 'short', year: scope === 'all' ? 'numeric' : undefined })}</div>
          {g.items.map((tx) => <TxRow key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      ))}
    </div>
  );
}

/* =====================================================================
   Loans tab
   ===================================================================== */
function BudgetBar({ b, compact, onEdit, onDelete }) {
  const over = b.pct > 100;
  const near = !over && b.pct >= 80;
  const color = colorFor(b.category?.name);
  return (
    <div className={compact ? 'mb-3' : 'budget-row'}>
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <span className="d-flex align-items-center gap-2 fw-semibold" style={{ minWidth: 0 }}>
          {!compact && <span className="fb-dot" style={{ background: `${color}1f`, color, width: 34, height: 34 }}>{(b.category?.name || '?')[0]}</span>}
          <span className="fb-ellipsis">{b.category?.name || 'Category'}</span>
          {over && <span className="fb-chip danger"><FiAlertTriangle /> Over</span>}
          {near && <span className="fb-chip warn">{Math.round(b.pct)}%</span>}
        </span>
        <span className="small muted text-nowrap">
          <span className={`num ${over ? 'neg' : ''}`} style={{ color: over ? undefined : 'var(--text)' }}>{money(b.spent)}</span> of <span className="num">{money(b.amount)}</span>
        </span>
        {!compact && (
          <span className="d-flex">
            <button className="fb-icon-btn" onClick={() => onEdit(b)} aria-label="Edit budget"><FiEdit2 size={15} /></button>
            <button className="fb-icon-btn danger" onClick={() => onDelete(b)} aria-label="Remove budget"><FiTrash2 size={15} /></button>
          </span>
        )}
      </div>
      <div className={`fb-progress ${over ? 'over' : near ? 'near' : ''}`}><div style={{ width: `${Math.min(100, b.pct)}%` }} /></div>
      {!compact && (
        <div className="small faint mt-2">
          {over ? `${money(b.spent - b.amount)} over the limit` : `${money(b.amount - b.spent)} left this month`}
        </div>
      )}
    </div>
  );
}

function Budgets({ usage, month, onEdit, onDelete, onAdd }) {
  if (usage.length === 0) {
    return (
      <div className="fb-card fb-fade-in">
        <Empty icon={<FiSliders />} title="No budgets yet" text="Give each category a monthly limit — food, shopping, fun — and stay ahead of overspending."
          action={<button className="fb-btn fb-btn-sm mt-3" onClick={onAdd}><FiPlus /> Set a budget</button>} />
      </div>
    );
  }
  const limit = usage.reduce((a, b) => a + b.amount, 0);
  const spent = usage.reduce((a, b) => a + Math.min(b.spent, b.amount * 10), 0);
  return (
    <div className="fb-fade-in">
      <div className="fb-card fb-card-hero mb-3">
        <div className="d-flex justify-content-between align-items-end flex-wrap gap-3">
          <div>
            <div className="eyebrow">Budgeted · {monthLabel(month, { month: 'long' })}</div>
            <div className="serif num" style={{ fontSize: 44, lineHeight: 1.1, marginTop: 6 }}>{money(spent)} <span className="muted" style={{ fontSize: 22 }}>/ {money(limit)}</span></div>
          </div>
          <div className="small muted">{usage.filter((b) => b.pct > 100).length} over · {usage.filter((b) => b.pct <= 100).length} on track</div>
        </div>
        <div className={`fb-progress mt-3 ${spent > limit ? 'over' : ''}`}><div style={{ width: `${Math.min(100, (spent / limit) * 100)}%` }} /></div>
      </div>
      <div className="budget-grid">
        {usage.map((b) => <div key={b.id} className="fb-card lift"><BudgetBar b={b} onEdit={onEdit} onDelete={onDelete} /></div>)}
      </div>
    </div>
  );
}

function Goals({ goals, onAdd, onEdit, onContribute, onDelete }) {
  if (goals.length === 0) {
    return (
      <div className="fb-card fb-fade-in">
        <Empty icon={<FiTarget />} title="No savings goals yet" text="A new phone, a Goa trip, an emergency fund — set a target and watch it fill up."
          action={<button className="fb-btn fb-btn-sm mt-3" onClick={onAdd}><FiPlus /> New goal</button>} />
      </div>
    );
  }
  const today = new Date();
  return (
    <div className="loan-grid fb-fade-in">
      {goals.map((g) => {
        const p = Math.min(100, (g.saved / g.target) * 100);
        const left = Math.max(0, g.target - g.saved);
        const monthsLeft = g.deadline ? Math.max(1, monthsBetween(today.toISOString(), g.deadline)) : null;
        const done = left <= 0;
        const r = 34, c = 2 * Math.PI * r;
        return (
          <div key={g.id} className={`fb-card lift ${done ? 'fb-card-hero' : ''}`}>
            <div className="d-flex gap-3 align-items-center">
              <div className="goal-ring">
                <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
                  <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                  <circle cx="42" cy="42" r={r} fill="none" stroke="url(#ringGrad)" strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform="rotate(-90 42 42)" />
                </svg>
                <span className="num">{Math.round(p)}%</span>
              </div>
              <div style={{ minWidth: 0 }} className="flex-grow-1">
                <div className="fw-semibold fb-ellipsis" style={{ fontSize: 16 }}>{g.name}</div>
                <div className="serif num" style={{ fontSize: 28, lineHeight: 1.15 }}>{money(g.saved)}</div>
                <div className="small faint">of <span className="num">{money(g.target)}</span></div>
              </div>
            </div>
            <div className="small muted mt-3">
              {done ? '🎉 Goal reached — beautifully done.'
                : monthsLeft ? <>Save <b className="num" style={{ color: 'var(--text)' }}>{money(left / monthsLeft)}</b>/month to hit it by {fmtDay(g.deadline, { month: 'short', year: 'numeric' })}</>
                  : <><span className="num">{money(left)}</span> to go</>}
            </div>
            <div className="d-flex justify-content-between align-items-center mt-3">
              <button className="fb-btn fb-btn-sm" onClick={() => onContribute(g)}><FiPlus /> Add money</button>
              <span className="d-flex">
                <button className="fb-icon-btn" onClick={() => onEdit(g)} aria-label="Edit goal"><FiEdit2 size={15} /></button>
                <button className="fb-icon-btn danger" onClick={() => onDelete(g)} aria-label="Delete goal"><FiTrash2 size={15} /></button>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function monthsBetween(a, b) {
  const [y1, m1] = monthKey(a).split('-').map(Number);
  const [y2, m2] = monthKey(b).split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

function Loans({ loans, month, onEdit, onDelete, onAdd }) {
  if (loans.length === 0) {
    return (
      <div className="fb-card fb-fade-in">
        <Empty icon={<FiCreditCard />} title="No loans or EMIs" text="Track home, car, education loans or any monthly EMI."
          action={<button className="fb-btn fb-btn-sm mt-3" onClick={onAdd}><FiPlus /> Add loan / EMI</button>} />
      </div>
    );
  }
  const now = new Date().toISOString();
  return (
    <div className="loan-grid fb-fade-in">
      {loans.map((loan) => {
        const active = loanActiveIn(loan, month);
        const total = loan.end_date ? Math.max(1, monthsBetween(loan.start_date, loan.end_date) + 1) : null;
        const done = total ? Math.min(total, Math.max(0, monthsBetween(loan.start_date, now) + 1)) : null;
        return (
          <div key={loan.id} className="fb-card lift">
            <div className="d-flex justify-content-between align-items-start gap-2">
              <div style={{ minWidth: 0 }}>
                <div className="fw-semibold fb-ellipsis" style={{ fontSize: 16 }}>{loan.name}</div>
                <div className="small faint">{loan.description || 'Monthly EMI'}</div>
              </div>
              <span className={`fb-chip ${active ? 'violet' : ''}`}>{active ? 'Active' : 'Not active'}</span>
            </div>
            <div className="serif num mt-3" style={{ fontSize: 38, lineHeight: 1 }}>{money(loan.amount)}<span className="faint" style={{ fontFamily: 'var(--font)', fontSize: 14 }}> / month</span></div>
            {total ? (
              <>
                <div className="d-flex justify-content-between small muted mt-3 mb-2">
                  <span>{done} of {total} months</span><span>{Math.max(0, total - done)} left</span>
                </div>
                <div className="fb-progress"><div style={{ width: `${(done / total) * 100}%` }} /></div>
              </>
            ) : <div className="small muted mt-3">No end date set</div>}
            <div className="d-flex justify-content-between align-items-center mt-3">
              <span className="small faint">{fmtDay(loan.start_date, { month: 'short', year: 'numeric' })} → {loan.end_date ? fmtDay(loan.end_date, { month: 'short', year: 'numeric' }) : 'ongoing'}</span>
              <span className="d-flex">
                <button className="fb-icon-btn" onClick={() => onEdit(loan)} aria-label="Edit"><FiEdit2 size={15} /></button>
                <button className="fb-icon-btn danger" onClick={() => onDelete(loan)} aria-label="Delete"><FiTrash2 size={15} /></button>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =====================================================================
   Settings tab
   ===================================================================== */
function Settings({ user, income, setIncome, categories, reloadCategories, toast, onLogout }) {
  const [active, setActive] = useState(income.active ? String(income.active) : '');
  const [passive, setPassive] = useState(income.passive ? String(income.passive) : '');
  const [saving, setSaving] = useState(false);
  const [catName, setCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const saveIncome = (e) => {
    e.preventDefault();
    const a = parseFloat(active) || 0, p = parseFloat(passive) || 0;
    setSaving(true);
    axios.put(`${API_BASE}/user/income?active=${a}&passive=${p}`)
      .then(() => { setIncome({ active: a, passive: p }); toast('Income saved'); })
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setSaving(false));
  };

  const addCategory = (e) => {
    e.preventDefault();
    const name = catName.trim();
    if (!name) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast('That category already exists', 'error');
      return;
    }
    setAddingCat(true);
    axios.post(`${API_BASE}/categories/`, { name })
      .then(() => reloadCategories())
      .then(() => { setCatName(''); toast('Category added'); })
      .catch((err) => toast(apiError(err), 'error'))
      .finally(() => setAddingCat(false));
  };

  return (
    <div className="settings-grid fb-fade-in">
      <form className="fb-card" onSubmit={saveIncome}>
        <div className="fb-card-title"><span>Monthly income</span><FiArrowDownLeft /></div>
        <label className="fb-label" htmlFor="ai">Salary / active income</label>
        <div className="fb-input-wrap mb-3"><span className="prefix">₹</span>
          <input id="ai" className="fb-input num" type="number" min="0" step="any" inputMode="decimal" placeholder="0"
            value={active} onChange={(e) => setActive(e.target.value)} /></div>
        <label className="fb-label" htmlFor="pi">Passive income <span className="faint">(rent, dividends, interest)</span></label>
        <div className="fb-input-wrap mb-3"><span className="prefix">₹</span>
          <input id="pi" className="fb-input num" type="number" min="0" step="any" inputMode="decimal" placeholder="0"
            value={passive} onChange={(e) => setPassive(e.target.value)} /></div>
        <div className="d-flex justify-content-between align-items-center gap-3">
          <span className="small faint">Counted every month. One-off income? Add it as a transaction.</span>
          <button className="fb-btn" type="submit" disabled={saving}>{saving ? <Spinner /> : 'Save'}</button>
        </div>
      </form>

      <div className="fb-card">
        <div className="fb-card-title"><span>Categories</span><FiTag /></div>
        <form className="d-flex gap-2 mb-3" onSubmit={addCategory}>
          <input className="fb-input" placeholder="New category, e.g. Groceries" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <button className="fb-btn" type="submit" disabled={addingCat || !catName.trim()} aria-label="Add category">{addingCat ? <Spinner /> : <FiPlus />}</button>
        </form>
        <div className="d-flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="fb-chip" title={c.user_id ? 'Your category' : 'Built-in'}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: colorFor(c.name) }} />
              {c.name}
            </span>
          ))}
        </div>
      </div>

      <div className="fb-card" style={{ gridColumn: '1 / -1' }}>
        <div className="fb-card-title"><span>Account</span><FiUser /></div>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <div className="fb-avatar" style={{ width: 48, height: 48, fontSize: 16, cursor: 'default' }}>{initials(user)}</div>
          <div className="flex-grow-1">
            <div className="fw-semibold">{user?.full_name || '—'}</div>
            <div className="small muted">{user?.email}</div>
          </div>
          <button className="fb-btn fb-btn-ghost" onClick={onLogout}><FiLogOut /> Sign out</button>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   Modals
   ===================================================================== */
function TransactionModal({ tx, categories, onClose, onSaved, toast }) {
  const editing = Boolean(tx.id);
  const incomeCats = categories.filter((c) => isIncomeCategory(c.name));
  const expenseCats = categories.filter((c) => !isIncomeCategory(c.name));
  const [type, setType] = useState(editing && isIncomeTx(tx) ? 'income' : 'expense');
  const [form, setForm] = useState({
    amount: editing ? String(tx.amount) : '',
    description: tx.description || '',
    category_id: tx.category_id ? String(tx.category_id) : '',
    date: editing ? tx.date.slice(0, 10) : todayLocal(),
  });
  const [suggested, setSuggested] = useState(null);
  const [saving, setSaving] = useState(false);
  const catTouched = useRef(editing);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const switchType = (t) => {
    setType(t);
    setSuggested(null);
    const pool = t === 'income' ? incomeCats : expenseCats;
    if (!pool.some((c) => String(c.id) === form.category_id)) {
      setForm((f) => ({ ...f, category_id: t === 'income' && incomeCats[0] ? String(incomeCats[0].id) : '' }));
    }
  };

  const onDescription = (value) => {
    setForm((f) => ({ ...f, description: value }));
    clearTimeout(timer.current);
    if (catTouched.current || value.trim().length < 3) return;
    timer.current = setTimeout(() => {
      axios.get(`${API_BASE}/suggest-category/?description=${encodeURIComponent(value)}`)
        .then((res) => {
          const id = res.data.suggested_category_id;
          if (!id || catTouched.current) return;
          const isInc = isIncomeCategory(res.data.suggested_category_name);
          setType(isInc ? 'income' : 'expense');
          setForm((f) => ({ ...f, category_id: String(id) }));
          setSuggested(res.data.suggested_category_name);
        })
        .catch(() => {});
    }, 350);
  };

  const submit = (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!(amount > 0)) { toast('Enter an amount greater than zero', 'error'); return; }
    const payload = {
      amount,
      description: form.description.trim(),
      category_id: form.category_id ? Number(form.category_id) : null,
      date: toApiDate(form.date),
    };
    setSaving(true);
    const req = editing
      ? axios.put(`${API_BASE}/transactions/${tx.id}`, payload)
      : axios.post(`${API_BASE}/transactions/`, payload);
    req.then(() => onSaved(editing ? 'Transaction updated' : 'Transaction added'))
      .catch((err) => { toast(apiError(err), 'error'); setSaving(false); });
  };

  const pool = type === 'income' ? incomeCats : expenseCats;

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>{editing ? 'Edit transaction' : 'New transaction'}</Modal.Title></Modal.Header>
      <form onSubmit={submit}>
        <Modal.Body>
          <div className="fb-seg income type-toggle mb-3">
            <button type="button" className={`is-expense ${type === 'expense' ? 'active' : ''}`} onClick={() => switchType('expense')}><FiArrowUpRight /> Expense</button>
            <button type="button" className={`is-income ${type === 'income' ? 'active' : ''}`} onClick={() => switchType('income')}><FiArrowDownLeft /> Income</button>
          </div>
          <div className="fb-input-wrap amount-wrap mb-3">
            <span className="prefix">₹</span>
            <input className="fb-input amount-input num" type="number" min="0" step="any" inputMode="decimal" placeholder="0"
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required autoFocus aria-label="Amount" />
          </div>
          <label className="fb-label" htmlFor="desc">Description</label>
          <input id="desc" className="fb-input mb-3" placeholder={type === 'income' ? 'e.g. Freelance project' : 'e.g. Swiggy dinner'}
            value={form.description} onChange={(e) => onDescription(e.target.value)} required maxLength={200} />
          <div className="row g-3">
            <div className="col-sm-6">
              <label className="fb-label" htmlFor="cat">Category</label>
              <select id="cat" className="form-select" value={form.category_id}
                onChange={(e) => { catTouched.current = true; setSuggested(null); setForm({ ...form, category_id: e.target.value }); }}>
                <option value="">Uncategorized</option>
                {pool.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
              {suggested && <div className="small mt-2" style={{ color: 'var(--violet-soft)' }}><HiSparkles /> Auto-picked “{suggested}”</div>}
            </div>
            <div className="col-sm-6">
              <label className="fb-label" htmlFor="date">Date</label>
              <input id="date" className="fb-input" type="date" value={form.date} max={todayLocal()}
                onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="fb-btn fb-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="fb-btn" disabled={saving}>{saving ? <Spinner /> : editing ? 'Save changes' : 'Add transaction'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

function LoanModal({ loan, onClose, onSaved, toast }) {
  const editing = Boolean(loan.id);
  const [form, setForm] = useState({
    name: loan.name || '',
    amount: editing ? String(loan.amount) : '',
    start_date: editing ? loan.start_date.slice(0, 10) : todayLocal(),
    end_date: loan.end_date ? loan.end_date.slice(0, 10) : '',
    description: loan.description || '',
  });
  const [saving, setSaving] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!(amount > 0)) { toast('Enter a monthly amount greater than zero', 'error'); return; }
    if (form.end_date && form.end_date < form.start_date) { toast('End date must be after the start date', 'error'); return; }
    const payload = {
      name: form.name.trim(),
      amount,
      start_date: toApiDate(form.start_date),
      end_date: form.end_date ? toApiDate(form.end_date) : null,
      description: form.description.trim() || null,
    };
    setSaving(true);
    const req = editing ? axios.put(`${API_BASE}/loans/${loan.id}`, payload) : axios.post(`${API_BASE}/loans/`, payload);
    req.then(() => onSaved(editing ? 'Loan updated' : 'Loan added'))
      .catch((err) => { toast(apiError(err), 'error'); setSaving(false); });
  };

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>{editing ? 'Edit loan' : 'New loan / EMI'}</Modal.Title></Modal.Header>
      <form onSubmit={submit}>
        <Modal.Body>
          <label className="fb-label" htmlFor="ln">Name</label>
          <input id="ln" className="fb-input mb-3" placeholder="e.g. Car loan — HDFC" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus maxLength={120} />
          <label className="fb-label" htmlFor="la">Monthly EMI</label>
          <div className="fb-input-wrap mb-3"><span className="prefix">₹</span>
            <input id="la" className="fb-input num" type="number" min="0" step="any" inputMode="decimal" placeholder="0"
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="fb-label" htmlFor="ls">Starts</label>
              <input id="ls" className="fb-input" type="date" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
            </div>
            <div className="col-6">
              <label className="fb-label" htmlFor="le">Ends <span className="faint">(optional)</span></label>
              <input id="le" className="fb-input" type="date" value={form.end_date} min={form.start_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <label className="fb-label" htmlFor="ld">Note <span className="faint">(optional)</span></label>
          <input id="ld" className="fb-input" placeholder="e.g. 8.5% p.a., 60 months" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={200} />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="fb-btn fb-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="fb-btn" disabled={saving}>{saving ? <Spinner /> : editing ? 'Save changes' : 'Add loan'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

function BudgetModal({ budget, categories, existing, onClose, onSaved, toast }) {
  const editing = Boolean(budget.id);
  const taken = new Set(existing.map((b) => b.category_id));
  const options = categories.filter((c) => !isIncomeCategory(c.name) && (editing ? c.id === budget.category_id : !taken.has(c.id)));
  const [categoryId, setCategoryId] = useState(editing ? String(budget.category_id) : String(options[0]?.id || ''));
  const [amount, setAmount] = useState(editing ? String(budget.amount) : '');
  const [saving, setSaving] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!categoryId) { toast('Every category already has a budget', 'error'); return; }
    if (!(value > 0)) { toast('Enter a monthly limit greater than zero', 'error'); return; }
    setSaving(true);
    axios.put(`${API_BASE}/budgets/`, { category_id: Number(categoryId), amount: value })
      .then(() => onSaved(editing ? 'Budget updated' : 'Budget set'))
      .catch((err) => { toast(apiError(err), 'error'); setSaving(false); });
  };

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>{editing ? 'Edit budget' : 'Set a budget'}</Modal.Title></Modal.Header>
      <form onSubmit={submit}>
        <Modal.Body>
          <label className="fb-label" htmlFor="bc">Category</label>
          <select id="bc" className="form-select mb-3" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={editing}>
            {options.length === 0 && <option value="">All categories have budgets</option>}
            {options.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          <label className="fb-label" htmlFor="ba">Monthly limit</label>
          <div className="fb-input-wrap amount-wrap">
            <span className="prefix">₹</span>
            <input id="ba" className="fb-input amount-input num" type="number" min="0" step="any" inputMode="decimal" placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
          </div>
          <div className="small faint mt-2">You'll see a warning at 80% and an alert once you go over.</div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="fb-btn fb-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="fb-btn" disabled={saving}>{saving ? <Spinner /> : editing ? 'Save changes' : 'Set budget'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

function GoalModal({ goal, onClose, onSaved, toast }) {
  const editing = Boolean(goal.id);
  const [form, setForm] = useState({
    name: goal.name || '',
    target: editing ? String(goal.target) : '',
    saved: editing ? String(goal.saved || 0) : '',
    deadline: goal.deadline ? goal.deadline.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const target = parseFloat(form.target);
    if (!(target > 0)) { toast('Enter a target greater than zero', 'error'); return; }
    const payload = {
      name: form.name.trim(),
      target,
      saved: Math.max(0, parseFloat(form.saved) || 0),
      deadline: form.deadline ? toApiDate(form.deadline) : null,
    };
    setSaving(true);
    const req = editing ? axios.put(`${API_BASE}/goals/${goal.id}`, payload) : axios.post(`${API_BASE}/goals/`, payload);
    req.then(() => onSaved(editing ? 'Goal updated' : 'Goal created'))
      .catch((err) => { toast(apiError(err), 'error'); setSaving(false); });
  };

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>{editing ? 'Edit goal' : 'New savings goal'}</Modal.Title></Modal.Header>
      <form onSubmit={submit}>
        <Modal.Body>
          <label className="fb-label" htmlFor="gn">What are you saving for?</label>
          <input id="gn" className="fb-input mb-3" placeholder="e.g. Emergency fund" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus maxLength={120} />
          <div className="row g-3 mb-3">
            <div className="col-6">
              <label className="fb-label" htmlFor="gt">Target</label>
              <div className="fb-input-wrap"><span className="prefix">₹</span>
                <input id="gt" className="fb-input num" type="number" min="0" step="any" inputMode="decimal" placeholder="0"
                  value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required /></div>
            </div>
            <div className="col-6">
              <label className="fb-label" htmlFor="gs">Already saved</label>
              <div className="fb-input-wrap"><span className="prefix">₹</span>
                <input id="gs" className="fb-input num" type="number" min="0" step="any" inputMode="decimal" placeholder="0"
                  value={form.saved} onChange={(e) => setForm({ ...form, saved: e.target.value })} /></div>
            </div>
          </div>
          <label className="fb-label" htmlFor="gd">Target date <span className="faint">(optional)</span></label>
          <input id="gd" className="fb-input" type="date" min={todayLocal()} value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="fb-btn fb-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="fb-btn" disabled={saving}>{saving ? <Spinner /> : editing ? 'Save changes' : 'Create goal'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

function ContributeModal({ goal, onClose, onSaved, toast }) {
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const left = Math.max(0, goal.target - (goal.saved || 0));

  const submit = (e) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!(value > 0)) { toast('Enter an amount greater than zero', 'error'); return; }
    setSaving(true);
    axios.post(`${API_BASE}/goals/${goal.id}/contribute`, { amount: mode === 'add' ? value : -value })
      .then((r) => onSaved(r.data.saved >= r.data.target ? `🎉 “${goal.name}” reached!` : mode === 'add' ? `Added ${money(value)} to ${goal.name}` : `Withdrew ${money(value)}`))
      .catch((err) => { toast(apiError(err), 'error'); setSaving(false); });
  };

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title>{goal.name}</Modal.Title></Modal.Header>
      <form onSubmit={submit}>
        <Modal.Body>
          <div className="fb-seg income type-toggle mb-3">
            <button type="button" className={`is-income ${mode === 'add' ? 'active' : ''}`} onClick={() => setMode('add')}><FiArrowDownLeft /> Add money</button>
            <button type="button" className={`is-expense ${mode === 'withdraw' ? 'active' : ''}`} onClick={() => setMode('withdraw')}><FiArrowUpRight /> Withdraw</button>
          </div>
          <div className="fb-input-wrap amount-wrap">
            <span className="prefix">₹</span>
            <input className="fb-input amount-input num" type="number" min="0" step="any" inputMode="decimal" placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus aria-label="Amount" />
          </div>
          {mode === 'add' && left > 0 && (
            <div className="d-flex gap-2 flex-wrap mt-3">
              {[500, 1000, 5000].filter((v) => v < left).map((v) => (
                <button key={v} type="button" className="fb-chip" onClick={() => setAmount(String(v))}>+{money(v)}</button>
              ))}
              <button type="button" className="fb-chip violet" onClick={() => setAmount(String(left))}>Finish it · {money(left)}</button>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="fb-btn fb-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="fb-btn" disabled={saving}>{saving ? <Spinner /> : mode === 'add' ? 'Add to goal' : 'Withdraw'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

function ConfirmModal({ confirm, onClose }) {
  const [busy, setBusy] = useState(false);
  if (!confirm) return null;
  const yes = () => {
    setBusy(true);
    Promise.resolve(confirm.onYes()).finally(() => { setBusy(false); onClose(); });
  };
  return (
    <Modal show onHide={onClose} centered size="sm">
      <Modal.Body className="text-center pt-4">
        <div className="fb-empty p-0">
          <div className="icon" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--neg)' }}><FiTrash2 /></div>
        </div>
        <div className="serif" style={{ fontSize: 26 }}>{confirm.title}</div>
        <div className="small muted mt-1 mb-4">{confirm.body}</div>
        <div className="d-flex gap-2">
          <button className="fb-btn fb-btn-ghost flex-grow-1" onClick={onClose}>Cancel</button>
          <button className="fb-btn flex-grow-1" style={{ background: 'linear-gradient(135deg,#f19a8f,#c2463a)', boxShadow: 'none', color: '#fff' }}
            onClick={yes} disabled={busy}>{busy ? <Spinner /> : 'Delete'}</button>
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default Dashboard;
