import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'react-bootstrap';
import {
  FiChevronLeft, FiChevronRight, FiLogOut, FiPlus, FiSearch, FiEdit2, FiTrash2, FiArrowDownLeft,
  FiArrowUpRight, FiCreditCard, FiPercent, FiPieChart, FiList, FiSettings, FiGrid, FiCalendar, FiInbox,
  FiUser, FiTag,
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
  const [income, setIncome] = useState({ active: 0, passive: 0 });
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(currentMonthKey());
  const [tab, setTab] = useState('overview');
  const [aiOpen, setAiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [txModal, setTxModal] = useState(null); // null | {} (new) | tx (edit)
  const [loanModal, setLoanModal] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, body, onYes }

  const loadTransactions = useCallback(
    () => axios.get(`${API_BASE}/transactions/?limit=5000`).then((r) => setTransactions(r.data)), []);
  const loadLoans = useCallback(
    () => axios.get(`${API_BASE}/loans/?limit=500`).then((r) => setLoans(r.data)), []);
  const loadCategories = useCallback(
    () => axios.get(`${API_BASE}/categories/?limit=500`).then((r) => setCategories(r.data)), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadTransactions(),
      loadLoans(),
      loadCategories(),
      axios.get(`${API_BASE}/user/income`).then((r) => {
        if (alive) setIncome({ active: r.data.active_income || 0, passive: r.data.passive_income || 0 });
      }),
    ])
      .catch((err) => toast(apiError(err, "Couldn't load your data."), 'error'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [loadTransactions, loadLoans, loadCategories, toast]);

  const baseIncome = (income.active || 0) + (income.passive || 0);
  const stats = useMemo(
    () => monthStats({ transactions, loans, baseIncome, key: month }),
    [transactions, loans, baseIncome, month]);
  const prevStats = useMemo(
    () => monthStats({ transactions, loans, baseIncome, key: shiftMonth(month, -1) }),
    [transactions, loans, baseIncome, month]);
  const health = healthScore(stats);
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
              <NetCard stats={stats} prev={prevStats} month={month} baseIncome={baseIncome} onSetIncome={() => setTab('settings')} />
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
              <Stat className="d1" icon={<FiArrowDownLeft />} tint="#34d399" label="Income" value={money(stats.income)}
                sub={stats.extraIncome > 0 ? `incl. ${money(stats.extraIncome)} extra` : 'Salary + passive'} />
              <Stat className="d2" icon={<FiArrowUpRight />} tint="#fb7185" label="Spending" value={money(stats.spending)}
                sub={`${stats.txs.filter((t) => !isIncomeTx(t)).length} transactions`} />
              <Stat className="d3" icon={<FiCreditCard />} tint="#fbbf24" label="EMIs" value={money(stats.emi)}
                sub={`${loans.filter((l) => loanActiveIn(l, month)).length} active`} />
              <Stat className="d4" icon={<FiPercent />} tint="#a78bfa" label="Savings rate"
                value={stats.income > 0 ? `${Math.round(stats.savingsRate * 100)}%` : '—'}
                sub={stats.income > 0 ? `${money(stats.net)} kept` : 'Set income to track'} />
            </div>

            {/* ---------------- Tabs ---------------- */}
            <div className="tabs-bar">
              <div className="fb-seg" role="tablist">
                {[
                  ['overview', 'Overview', <FiGrid key="i" />],
                  ['transactions', 'Transactions', <FiList key="i" />],
                  ['loans', 'Loans & EMIs', <FiCalendar key="i" />],
                  ['settings', 'Settings', <FiSettings key="i" />],
                ].map(([key, label, icon]) => (
                  <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                    {icon}{label}
                  </button>
                ))}
              </div>
              {(tab === 'overview' || tab === 'transactions') && (
                <button className="fb-btn" onClick={() => setTxModal({})}><FiPlus /> Add transaction</button>
              )}
              {tab === 'loans' && (
                <button className="fb-btn" onClick={() => setLoanModal({})}><FiPlus /> Add loan / EMI</button>
              )}
            </div>

            {tab === 'overview' && (
              <Overview transactions={transactions} loans={loans} baseIncome={baseIncome} month={month} stats={stats}
                onEdit={setTxModal} onViewAll={() => setTab('transactions')} onAdd={() => setTxModal({})} />
            )}
            {tab === 'transactions' && (
              <Transactions transactions={transactions} categories={categories} month={month}
                onEdit={setTxModal}
                onDelete={(tx) => askDelete('Delete transaction?', `“${tx.description}” for ${money(tx.amount)} will be removed.`,
                  `${API_BASE}/transactions/${tx.id}`, loadTransactions, 'Transaction deleted')} />
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
      <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />
      <AIChat open={aiOpen} onClose={() => setAiOpen(false)} user={user} health={healthScore(monthStats({ transactions, loans, baseIncome, key: currentMonthKey() }))} />
      <Toasts toasts={toasts} />
    </>
  );
}

/* =====================================================================
   Hero pieces
   ===================================================================== */
function NetCard({ stats, prev, month, baseIncome, onSetIncome }) {
  const net = useCountUp(stats.net);
  const pct = stats.income > 0 ? (stats.spent / stats.income) * 100 : 0;
  const delta = stats.spent - prev.spent;
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
      <div className={`serif hero-net num ${stats.net < 0 ? 'neg' : ''}`}>{money(net)}</div>
      {baseIncome > 0 || stats.income > 0 ? (
        <>
          <div className="d-flex justify-content-between small muted mb-2 mt-3">
            <span>{money(stats.spent)} spent of {money(stats.income)}</span>
            <span className="num">{pct.toFixed(0)}%</span>
          </div>
          <div className={`fb-progress ${pct > 100 ? 'over' : ''}`}><div style={{ width: `${Math.min(100, pct)}%` }} /></div>
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
            <stop offset="0%" stopColor="#c4b5fd" /><stop offset="100%" stopColor="#6366f1" />
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
    <div className={`fb-card stat fb-fade-in ${className}`}>
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

function Overview({ transactions, loans, baseIncome, month, stats, onEdit, onViewAll, onAdd }) {
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
            <span className="d-flex align-items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#a78bfa' }} />Income</span>
            <span className="d-flex align-items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#f472b6' }} />Spent</span>
          </span>
        </div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flow} barGap={4} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c4b5fd" /><stop offset="100%" stopColor="#7c3aed" /></linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f9a8d4" /><stop offset="100%" stopColor="#db2777" /></linearGradient>
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
          <div key={loan.id} className="fb-card">
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
          <button className="fb-btn flex-grow-1" style={{ background: 'linear-gradient(135deg,#fb7185,#e11d48)', boxShadow: 'none' }}
            onClick={yes} disabled={busy}>{busy ? <Spinner /> : 'Delete'}</button>
        </div>
      </Modal.Body>
    </Modal>
  );
}

export default Dashboard;
