import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowRight, FiTrendingUp, FiTrendingDown, FiAlertTriangle, FiRepeat, FiTarget, FiPlus, FiEdit3,
  FiCalendar, FiCheck, FiSliders, FiInbox,
} from 'react-icons/fi';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { API_BASE } from '../config';
import { useFinance } from '../data/FinanceContext';
import {
  money, compactMoney, monthStats, shiftMonth, monthLabel, monthKey, currentMonthKey, isIncomeTx, isIncomeCategory,
  colorFor, greeting, apiError,
} from '../finance';
import { useCountUp, NumInput, Spinner } from '../components/ui';
import { ChartTooltip, TxRow, Empty, fmtDay } from '../components/money';
import { MonthSwitch, PageHead, SectionTitle } from '../components/page';

const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`;
const tone = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted');

function Home() {
  const f = useFinance();
  const first = (f.user?.full_name || '').split(' ')[0];
  const [setupHidden, setSetupHidden] = useState(() => {
    try { return localStorage.getItem('fb-setup-done') === '1'; } catch { return false; }
  });
  const needsSetup = !setupHidden && f.transactions.length === 0 && (f.baseIncome === 0 || f.budgets.length === 0);
  const hideSetup = () => {
    setSetupHidden(true);
    try { localStorage.setItem('fb-setup-done', '1'); } catch { /* ignore */ }
  };

  return (
    <div className="dash">
      <PageHead
        eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={<>{greeting()}{first && <>, <em className="grad-text">{first}</em></>}</>}>
        <MonthSwitch />
      </PageHead>

      {f.loading ? <HomeSkeleton /> : (
        <>
          {needsSetup && <Setup onDone={hideSetup} />}
          <div className="hero-grid">
            <MonthCard />
            <InvestCard />
          </div>
          <ForYou />
          <div className="overview-grid mt-4">
            <WhereItGoes />
            <CashFlow />
          </div>
          <Recent />
        </>
      )}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <>
      <div className="hero-grid"><div className="fb-skeleton" style={{ height: 240 }} /><div className="fb-skeleton" style={{ height: 240 }} /></div>
      <div className="fb-skeleton" style={{ height: 120 }} />
    </>
  );
}

/* ---------------------------------------------------------------- hero */
function MonthCard() {
  const { stats, prevStats, month, health, openSettings, openQuickAdd } = useFinance();
  const isCurrent = month === currentMonthKey();
  const left = stats.income - stats.spent;
  const shown = useCountUp(stats.income > 0 ? left : stats.spent);
  const pct = stats.income > 0 ? (stats.spent / stats.income) * 100 : 0;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = stats.spending / now.getDate() * daysInMonth + stats.emi;
  const perDay = isCurrent && left > 0 ? left / (daysInMonth - now.getDate() + 1) : null;
  const delta = stats.spent - prevStats.spent;

  return (
    <div className="fb-card fb-card-hero fb-fade-in d1">
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div className="eyebrow">{stats.income > 0 ? `Left to spend · ${monthLabel(month, { month: 'long' })}` : `Spent · ${monthLabel(month, { month: 'long' })}`}</div>
        {stats.income > 0 && <span className="fb-chip violet" title="Financial health score">Health {health.score}</span>}
      </div>
      <div className={`serif hero-net num ${stats.income > 0 && left < 0 ? 'neg' : 'grad-text'}`}>{money(shown)}</div>

      {stats.income > 0 ? (
        <>
          <div className="d-flex justify-content-between small muted mb-2 mt-2">
            <span><span className="num">{money(stats.spent)}</span> spent of <span className="num">{money(stats.income)}</span></span>
            <span className="num">{pct.toFixed(0)}%</span>
          </div>
          <div className={`fb-progress ${pct > 100 ? 'over' : pct > 85 ? 'near' : ''}`}><div style={{ width: `${Math.min(100, pct)}%` }} /></div>
          <div className="home-hints">
            {perDay != null && <span>≈ <b className="num">{money(perDay)}</b>/day for the rest of the month</span>}
            {isCurrent && stats.spending > 0 && now.getDate() < daysInMonth && (
              <span className={projected > stats.income ? 'neg' : ''}>On pace for <b className="num">{money(projected)}</b> by month end</span>
            )}
            {prevStats.spent > 0 && <span>{delta > 0 ? '▲' : '▼'} <b className="num">{money(Math.abs(delta))}</b> vs last month</span>}
          </div>
        </>
      ) : (
        <button className="fb-chip violet mt-3" onClick={openSettings}><FiPlus /> Add your monthly income to see what's left</button>
      )}

      <div className="d-flex gap-2 mt-4 flex-wrap">
        <button className="fb-btn" onClick={() => openQuickAdd('spent')}><FiPlus /> Add expense</button>
        <button className="fb-btn fb-btn-ghost" onClick={() => openQuickAdd('received')}>Add income</button>
      </div>
    </div>
  );
}

function InvestCard() {
  const { portfolio, openInvest } = useFinance();
  const navigate = useNavigate();
  const t = portfolio?.totals;
  const owned = portfolio?.holdings.filter((h) => h.units > 0) || [];
  const value = useCountUp(t?.value || 0);

  if (!portfolio) {
    return (
      <div className="fb-card fb-fade-in d2">
        <div className="eyebrow mb-3">Investments</div>
        <div className="fb-skeleton mb-2" style={{ height: 48, width: '70%' }} />
        <div className="fb-skeleton" style={{ height: 18, width: '45%' }} />
        <div className="small faint mt-3">Fetching live prices…</div>
      </div>
    );
  }
  if (owned.length === 0) {
    return (
      <div className="fb-card fb-fade-in d2 d-flex flex-column">
        <div className="eyebrow mb-2">Investments</div>
        <div className="serif" style={{ fontSize: 30, lineHeight: 1.15 }}>Track your stocks, SIPs & crypto</div>
        <div className="small muted mt-2">Live prices, real returns and XIRR — all in one place.</div>
        <button className="fb-btn mt-auto align-self-start" style={{ marginTop: 20 }} onClick={openInvest}><FiTrendingUp /> Add an investment</button>
      </div>
    );
  }
  const prev = t.value - t.day_change;
  const pnlPct = t.invested > 0 ? (t.pnl / t.invested) * 100 : 0;
  return (
    <button className="fb-card lift fb-fade-in d2 home-invest" onClick={() => navigate('/invest')}>
      <div className="d-flex justify-content-between align-items-center">
        <span className="eyebrow">Investments · live</span>
        <FiArrowRight className="faint" />
      </div>
      <div className="serif num" style={{ fontSize: 44, lineHeight: 1.1, margin: '10px 0 6px' }}>{money(value)}</div>
      <div className={`small fw-semibold ${tone(t.day_change)}`}>
        {t.day_change >= 0 ? <FiTrendingUp /> : <FiTrendingDown />} <span className="num">{signed(t.day_change)}</span>
        <span className="num"> ({prev > 0 ? ((t.day_change / prev) * 100).toFixed(2) : '0.00'}%)</span> <span className="muted fw-normal">today</span>
      </div>
      <div className="hero-meta">
        <div><div className="k">Invested</div><div className="v num">{money(t.invested)}</div></div>
        <div><div className="k">Returns</div><div className={`v num ${tone(t.pnl)}`}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%</div></div>
        {t.monthly_sip > 0 && <div><div className="k">SIPs</div><div className="v num">{money(t.monthly_sip)}/mo</div></div>}
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------- nudges */
function ForYou() {
  const f = useFinance();
  const navigate = useNavigate();
  const isCurrent = f.month === currentMonthKey();
  const today = new Date();

  const items = (() => {
    const out = [];
    if (f.baseIncome === 0) {
      out.push({ icon: <FiEdit3 />, tone: 'gold', text: 'Add your monthly income so FinBuddy can show what’s left to spend.', cta: 'Add income', go: f.openSettings });
    }
    f.budgetUsage.filter((b) => b.pct > 100).forEach((b) => out.push({
      icon: <FiAlertTriangle />, tone: 'neg',
      text: <>You're <b className="num">{money(b.spent - b.amount)}</b> over your <b>{b.category?.name}</b> budget.</>,
      cta: 'Review', go: () => navigate(`/spending?cat=${b.category_id}`),
    }));
    if (isCurrent) {
      f.budgetUsage.filter((b) => b.pct >= 80 && b.pct <= 100).forEach((b) => out.push({
        icon: <FiSliders />, tone: 'warn',
        text: <>Only <b className="num">{money(b.amount - b.spent)}</b> left in <b>{b.category?.name}</b> this month.</>,
        cta: 'See', go: () => navigate(`/spending?cat=${b.category_id}`),
      }));
    }
    if (f.budgets.length === 0 && f.baseIncome > 0 && f.transactions.length > 0) {
      out.push({ icon: <FiSliders />, tone: 'gold', text: 'Set limits on your biggest categories to stay ahead of overspending.', cta: 'Set budgets', go: () => navigate('/spending') });
    }
    (f.portfolio?.holdings || []).forEach((h) => h.sips.filter((s) => s.active).forEach((s) => {
      const next = new Date(today.getFullYear(), today.getMonth() + (today.getDate() > s.day ? 1 : 0), s.day);
      const days = Math.round((next - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5);
      if (days <= 5) {
        out.push({
          icon: <FiRepeat />, tone: 'gold',
          text: <>SIP of <b className="num">{money(s.amount)}</b> in <b>{h.name.split(' - ')[0]}</b> {days === 0 ? 'is due today' : `on ${next.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}.</>,
          cta: 'Open', go: () => navigate('/invest'),
        });
      }
    }));
    f.goals.forEach((g) => {
      if (!g.deadline || g.saved >= g.target) return;
      const months = Math.max(1, (new Date(g.deadline).getFullYear() - today.getFullYear()) * 12 + new Date(g.deadline).getMonth() - today.getMonth());
      out.push({
        icon: <FiTarget />, tone: 'gold',
        text: <>Put aside <b className="num">{money((g.target - g.saved) / months)}</b>/month to reach <b>{g.name}</b> on time.</>,
        cta: 'Add money', go: () => f.contributeGoal(g),
      });
    });
    f.loans.forEach((l) => {
      if (!l.end_date) return;
      if (monthKey(l.end_date) === currentMonthKey()) {
        out.push({ icon: <FiCheck />, tone: 'pos', text: <><b>{l.name}</b> finishes this month — that frees up <b className="num">{money(l.amount)}</b>/month.</>, cta: 'Plan it', go: () => navigate('/plan') });
      }
    });
    if (isCurrent && f.transactions.length > 0 && !f.transactions.some((t) => t.date.slice(0, 10) === today.toISOString().slice(0, 10)) && today.getHours() >= 18) {
      out.push({ icon: <FiCalendar />, tone: 'gold', text: 'Nothing logged today. Spent anything?', cta: 'Quick add', go: () => f.openQuickAdd('spent') });
    }
    return out.slice(0, 4);
  })();

  if (items.length === 0) return null;
  return (
    <div className="mt-4 fb-fade-in d3">
      <SectionTitle>For you</SectionTitle>
      <div className="nudges">
        {items.map((n, i) => (
          <div key={i} className={`nudge ${n.tone}`}>
            <span className="ico">{n.icon}</span>
            <span className="flex-grow-1">{n.text}</span>
            <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={n.go}>{n.cta}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- spending + flow */
function WhereItGoes() {
  const { stats, budgets, categories, editBudget } = useFinance();
  const navigate = useNavigate();
  const rows = useMemo(() => {
    const byCat = {};
    stats.txs.filter((t) => !isIncomeTx(t)).forEach((t) => {
      const id = t.category_id || 0;
      byCat[id] = (byCat[id] || 0) + t.amount;
    });
    budgets.forEach((b) => { if (!(b.category_id in byCat)) byCat[b.category_id] = 0; });
    return Object.entries(byCat).map(([id, spent]) => {
      const cid = Number(id);
      const cat = categories.find((c) => c.id === cid);
      return { id: cid, name: cat?.name || 'Uncategorized', spent, budget: budgets.find((b) => b.category_id === cid) };
    }).sort((a, b) => b.spent - a.spent);
  }, [stats, budgets, categories]);
  const max = Math.max(1, ...rows.map((r) => r.budget ? Math.max(r.budget.amount, r.spent) : r.spent));

  return (
    <div className="fb-card">
      <div className="fb-card-title"><span>Where it's going</span>
        <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={() => navigate('/spending')}>All spending</button>
      </div>
      {rows.length === 0 ? (
        <Empty icon={<FiInbox />} title="No spending yet" text="Add an expense and it shows up here, grouped by category." />
      ) : rows.slice(0, 6).map((r) => {
        const over = r.budget && r.spent > r.budget.amount;
        const color = colorFor(r.name);
        return (
          <div key={r.id} className="cat-row" role="button" tabIndex={0}
            onClick={() => navigate(`/spending?cat=${r.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/spending?cat=${r.id}`)}>
            <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
              <span className="d-flex align-items-center gap-2 fw-semibold fb-ellipsis"><span className="sw" style={{ background: color }} />{r.name}</span>
              <span className="small text-nowrap">
                <b className={`num ${over ? 'neg' : ''}`}>{money(r.spent)}</b>
                {r.budget ? <span className="faint"> / <span className="num">{money(r.budget.amount)}</span></span>
                  : r.id !== 0 && !isIncomeCategory(r.name) && (
                    <button className="cat-set" onClick={(e) => { e.stopPropagation(); editBudget({ category_id: r.id }); }}>Set limit</button>
                  )}
              </span>
            </div>
            <div className="cat-bar">
              <div style={{ width: `${(r.spent / max) * 100}%`, background: over ? 'var(--neg)' : color }} />
              {r.budget && <span className="cap" style={{ left: `${(r.budget.amount / max) * 100}%` }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CashFlow() {
  const { transactions, loans, baseIncome, month } = useFinance();
  const flow = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const key = shiftMonth(month, i - 5);
    const s = monthStats({ transactions, loans, baseIncome, key });
    return { name: monthLabel(key, { month: 'short' }), Income: Math.round(s.income), Spent: Math.round(s.spent) };
  }), [transactions, loans, baseIncome, month]);
  return (
    <div className="fb-card">
      <div className="fb-card-title"><span>Cash flow · 6 months</span>
        <span className="d-flex gap-3 small">
          <span className="d-flex align-items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#e8cf8f' }} />In</span>
          <span className="d-flex align-items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#bdb6a8' }} />Out</span>
        </span>
      </div>
      <div style={{ height: 250 }}>
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
  );
}

/* ---------------------------------------------------------------- activity */
function Recent() {
  const { transactions, portfolio, editTransaction, openQuickAdd } = useFinance();
  const navigate = useNavigate();
  const items = useMemo(() => {
    const tx = transactions.map((t) => ({ kind: 'tx', date: t.date, t }));
    const lots = (portfolio?.holdings || []).flatMap((h) => h.lots.map((l) => ({ kind: 'lot', date: l.date, l, h })));
    return [...tx, ...lots].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [transactions, portfolio]);

  return (
    <div className="mt-4">
      <SectionTitle action={transactions.length > 0 && <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={() => navigate('/spending')}>See all</button>}>
        Recent activity
      </SectionTitle>
      <div className="fb-card">
        {items.length === 0 ? (
          <Empty icon={<FiInbox />} title="Nothing yet" text="Everything you add — spending, income, investments — shows up here."
            action={<button className="fb-btn fb-btn-sm mt-3" onClick={() => openQuickAdd('spent')}><FiPlus /> Add your first expense</button>} />
        ) : items.map((it) => it.kind === 'tx' ? (
          <div key={`t${it.t.id}`} className="clickable" onClick={() => editTransaction(it.t)} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && editTransaction(it.t)}>
            <TxRow tx={it.t} />
          </div>
        ) : (
          <div key={`l${it.l.id}`} className="fb-row clickable" onClick={() => navigate('/invest')} role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/invest')}>
            <div className="fb-dot" style={{ background: 'rgba(232,207,143,0.12)', color: 'var(--gold)' }}><FiTrendingUp /></div>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <div className="fw-medium fb-ellipsis">{it.l.sip ? 'SIP' : it.l.side === 'buy' ? 'Bought' : 'Sold'} · {it.h.name.split(' - ')[0]}</div>
              <div className="small faint">Investment · {fmtDay(it.l.date)}</div>
            </div>
            <div className={`num fw-semibold ${it.l.side === 'sell' ? 'pos' : ''}`}>{it.l.side === 'sell' ? '+' : ''}{money(it.l.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- first-run setup */
const SUGGESTED = [['Food & Drink', 0.12], ['Shopping', 0.08], ['Transport', 0.06], ['Entertainment', 0.04], ['Bills & Utilities', 0.08]];

function Setup({ onDone }) {
  const f = useFinance();
  const step = f.baseIncome === 0 ? 1 : f.budgets.length === 0 ? 2 : 3;
  const [salary, setSalary] = useState('');
  const [passive, setPassive] = useState('');
  const [busy, setBusy] = useState(false);
  const round = (n) => Math.max(500, Math.round(n / 500) * 500);
  const [picked, setPicked] = useState({});
  const suggestions = SUGGESTED.map(([name, share]) => {
    const cat = f.categories.find((c) => c.name === name);
    return cat && { cat, amount: round(f.baseIncome * share) };
  }).filter(Boolean);
  const isOn = (id) => picked[id] !== false;

  const saveIncome = (e) => {
    e.preventDefault();
    const a = parseFloat(salary) || 0, p = parseFloat(passive) || 0;
    if (a + p <= 0) { f.toast('Enter your monthly income', 'error'); return; }
    setBusy(true);
    axios.put(`${API_BASE}/user/income?active=${a}&passive=${p}`)
      .then(() => { f.setIncome({ active: a, passive: p }); f.toast('Income saved'); })
      .catch((err) => f.toast(apiError(err), 'error'))
      .finally(() => setBusy(false));
  };

  const saveBudgets = () => {
    const chosen = suggestions.filter((s) => isOn(s.cat.id));
    setBusy(true);
    Promise.all(chosen.map((s) => axios.put(`${API_BASE}/budgets/`, { category_id: s.cat.id, amount: s.amount })))
      .then(() => f.reloadBudgets())
      .then(() => f.toast(chosen.length ? `${chosen.length} budgets set` : 'Skipped budgets'))
      .catch((err) => f.toast(apiError(err), 'error'))
      .finally(() => setBusy(false));
    if (!chosen.length) onDone();
  };

  return (
    <div className="fb-card fb-card-hero setup mb-4 fb-fade-in">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="eyebrow">Get set up · step {Math.min(step, 3)} of 3</div>
          <div className="serif" style={{ fontSize: 30, lineHeight: 1.15, marginTop: 6 }}>
            {step === 1 ? 'What comes in each month?' : step === 2 ? 'Want some smart budgets?' : 'You’re all set.'}
          </div>
        </div>
        <button className="fb-btn fb-btn-ghost fb-btn-sm" onClick={onDone}>Skip</button>
      </div>
      <div className="setup-steps mb-3">{[1, 2, 3].map((s) => <span key={s} className={s <= step ? 'on' : ''} />)}</div>

      {step === 1 && (
        <form onSubmit={saveIncome} className="row g-3 align-items-end">
          <div className="col-sm-5">
            <label className="fb-label">Salary / main income</label>
            <div className="fb-input-wrap"><span className="prefix">₹</span>
              <NumInput className="fb-input num" placeholder="e.g. 75,000" value={salary} onChange={(e) => setSalary(e.target.value)} autoFocus /></div>
          </div>
          <div className="col-sm-4">
            <label className="fb-label">Other monthly income <span className="faint">(optional)</span></label>
            <div className="fb-input-wrap"><span className="prefix">₹</span>
              <NumInput className="fb-input num" placeholder="Rent, interest…" value={passive} onChange={(e) => setPassive(e.target.value)} /></div>
          </div>
          <div className="col-sm-3"><button className="fb-btn w-100" disabled={busy}>{busy ? <Spinner /> : <>Continue <FiArrowRight /></>}</button></div>
        </form>
      )}

      {step === 2 && (
        <>
          <div className="small muted mb-3">Based on your income of <b className="num">{money(f.baseIncome)}</b>. Tap to include or skip — you can change these any time.</div>
          <div className="quick-chips mb-3">
            {suggestions.map((s) => (
              <button key={s.cat.id} type="button" className={`quick-chip ${isOn(s.cat.id) ? 'on' : ''}`}
                onClick={() => setPicked((p) => ({ ...p, [s.cat.id]: !isOn(s.cat.id) }))}>
                {s.cat.name} · <span className="num">{money(s.amount)}</span>
              </button>
            ))}
          </div>
          <button className="fb-btn" onClick={saveBudgets} disabled={busy}>{busy ? <Spinner /> : <>Set these budgets <FiArrowRight /></>}</button>
        </>
      )}

      {step === 3 && (
        <>
          <div className="small muted mb-3">Log what you spend with the <b>+</b> button (or press <b>N</b>). Add investments to see everything in one place.</div>
          <div className="d-flex gap-2 flex-wrap">
            <button className="fb-btn" onClick={() => { f.openQuickAdd('spent'); onDone(); }}><FiPlus /> Add first expense</button>
            <button className="fb-btn fb-btn-ghost" onClick={() => { f.openInvest(); onDone(); }}><FiTrendingUp /> Add an investment</button>
          </div>
        </>
      )}
    </div>
  );
}

export default Home;
