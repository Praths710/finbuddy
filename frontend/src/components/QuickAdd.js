import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Modal } from 'react-bootstrap';
import { FiArrowUpRight, FiArrowDownLeft, FiTrendingUp, FiTarget, FiCalendar, FiCheck } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { API_BASE } from '../config';
import { useFinance } from '../data/FinanceContext';
import { money, isIncomeCategory, colorFor, apiError } from '../finance';
import { NumInput, Spinner } from './ui';
import { todayLocal, toApiDate } from './money';

const KINDS = [
  ['spent', 'Spent', <FiArrowUpRight key="i" />],
  ['received', 'Received', <FiArrowDownLeft key="i" />],
  ['invested', 'Invested', <FiTrendingUp key="i" />],
  ['goal', 'To a goal', <FiTarget key="i" />],
];

const yesterdayLocal = () => {
  const d = new Date(Date.now() - 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// One sheet for every kind of entry. Opened by the "+" button from anywhere.
function QuickAdd({ state, onClose }) {
  const open = Boolean(state);
  const [kind, setKind] = useState('spent');
  useEffect(() => { if (state) setKind(state.kind || 'spent'); }, [state]);

  return (
    <Modal show={open} onHide={onClose} centered className="quick-sheet">
      <Modal.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="serif" style={{ fontSize: 28 }}>Quick add</div>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="fb-seg quick-kinds w-100 mb-3">
          {KINDS.map(([k, label, icon]) => (
            <button key={k} type="button" className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{icon}<span>{label}</span></button>
          ))}
        </div>
        {open && (kind === 'spent' || kind === 'received') && <MoneyEntry key={kind} kind={kind} onClose={onClose} />}
        {open && kind === 'invested' && <InvestEntry onClose={onClose} />}
        {open && kind === 'goal' && <GoalEntry onClose={onClose} />}
      </Modal.Body>
    </Modal>
  );
}

function MoneyEntry({ kind, onClose }) {
  const { categories, transactions, reloadTransactions, toast } = useFinance();
  const income = kind === 'received';
  const pool = useMemo(() => categories.filter((c) => isIncomeCategory(c.name) === income), [categories, income]);

  // Most-used categories first, so the right chip is usually already in view.
  const ranked = useMemo(() => {
    const uses = {};
    transactions.forEach((t) => { if (t.category_id) uses[t.category_id] = (uses[t.category_id] || 0) + 1; });
    return [...pool].sort((a, b) => (uses[b.id] || 0) - (uses[a.id] || 0));
  }, [pool, transactions]);

  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [categoryId, setCategoryId] = useState(income && ranked[0] ? ranked[0].id : null);
  const [auto, setAuto] = useState(false);
  const [date, setDate] = useState(todayLocal());
  const [pickDate, setPickDate] = useState(false);
  const [another, setAnother] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const touched = useRef(false);
  const amountRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => { setTimeout(() => amountRef.current?.focus(), 150); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pick = (id, isAuto) => { setCategoryId(id); setAuto(isAuto); };

  const onDesc = (v) => {
    setDesc(v);
    clearTimeout(timer.current);
    if (touched.current || v.trim().length < 3) return;
    // 1) learn from the user's own history  2) fall back to the server's keyword matcher
    const needle = v.trim().toLowerCase();
    const past = transactions.find((t) => t.category_id && t.description.toLowerCase().startsWith(needle)
      && pool.some((c) => c.id === t.category_id));
    if (past) { pick(past.category_id, true); return; }
    timer.current = setTimeout(() => {
      axios.get(`${API_BASE}/suggest-category/?description=${encodeURIComponent(v)}`)
        .then((r) => {
          const id = r.data.suggested_category_id;
          if (id && !touched.current && pool.some((c) => c.id === id)) pick(id, true);
        })
        .catch(() => {});
    }, 300);
  };

  const submit = (e) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!(value > 0)) { toast('Enter an amount', 'error'); amountRef.current?.focus(); return; }
    setSaving(true);
    const label = desc.trim() || (ranked.find((c) => c.id === categoryId)?.name ?? (income ? 'Income' : 'Expense'));
    axios.post(`${API_BASE}/transactions/`, { amount: value, description: label, category_id: categoryId, date: toApiDate(date) })
      .then(() => {
        reloadTransactions();
        toast(`${income ? 'Received' : 'Spent'} ${money(value)} · ${label}`);
        if (another) {
          setAmount(''); setDesc(''); touched.current = false;
          if (!income) pick(null, false);
          setSaving(false);
          amountRef.current?.focus();
        } else {
          onClose();
        }
      })
      .catch((err) => { toast(apiError(err), 'error'); setSaving(false); });
  };

  const chips = showAll ? ranked : ranked.slice(0, 7);
  const selectedHidden = categoryId && !chips.some((c) => c.id === categoryId);

  return (
    <form onSubmit={submit}>
      <div className="fb-input-wrap amount-wrap mb-3">
        <span className="prefix">₹</span>
        <NumInput ref={amountRef} className="fb-input amount-input num quick-amount" placeholder="0" value={amount}
          onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
      </div>
      <input className="fb-input mb-3" value={desc} onChange={(e) => onDesc(e.target.value)} maxLength={200}
        placeholder={income ? 'From? e.g. Salary, Freelance, Refund' : 'On what? e.g. Swiggy, Uber, Rent'} aria-label="Description" />

      <div className="quick-label">
        Category {auto && categoryId && <span className="quick-auto"><HiSparkles /> picked for you</span>}
      </div>
      <div className="quick-chips mb-3">
        {[...(selectedHidden ? ranked.filter((c) => c.id === categoryId) : []), ...chips].map((c) => (
          <button type="button" key={c.id} className={`quick-chip ${categoryId === c.id ? 'on' : ''}`}
            style={{ '--c': colorFor(c.name) }}
            onClick={() => { touched.current = true; pick(categoryId === c.id ? null : c.id, false); }}>
            <span className="dot" />{c.name}
          </button>
        ))}
        {ranked.length > 7 && (
          <button type="button" className="quick-chip more" onClick={() => setShowAll((s) => !s)}>{showAll ? 'Less' : `+${ranked.length - 7} more`}</button>
        )}
      </div>

      <div className="quick-label">When</div>
      <div className="quick-chips mb-4">
        <button type="button" className={`quick-chip ${date === todayLocal() && !pickDate ? 'on' : ''}`} onClick={() => { setDate(todayLocal()); setPickDate(false); }}>Today</button>
        <button type="button" className={`quick-chip ${date === yesterdayLocal() && !pickDate ? 'on' : ''}`} onClick={() => { setDate(yesterdayLocal()); setPickDate(false); }}>Yesterday</button>
        {pickDate ? (
          <input className="fb-input quick-date" type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} autoFocus />
        ) : (
          <button type="button" className="quick-chip" onClick={() => setPickDate(true)}><FiCalendar /> Other day</button>
        )}
      </div>

      <div className="d-flex align-items-center gap-3">
        <button type="button" className={`quick-toggle ${another ? 'on' : ''}`} onClick={() => setAnother((a) => !a)} aria-pressed={another}>
          <span className="box">{another && <FiCheck />}</span> Add another after this
        </button>
        <button type="submit" className="fb-btn fb-btn-lg ms-auto" disabled={saving}>
          {saving ? <Spinner /> : <>Save {parseFloat(amount) > 0 && <span className="num">{money(parseFloat(amount))}</span>}</>}
        </button>
      </div>
    </form>
  );
}

function InvestEntry({ onClose }) {
  const { openInvest } = useFinance();
  return (
    <div className="text-center py-3">
      <div className="fb-empty p-0 mb-3"><div className="icon"><FiTrendingUp /></div></div>
      <div className="fw-semibold mb-1">Stocks, ETFs, mutual funds & crypto</div>
      <div className="small muted mb-4">Search any investment, enter what you put in, and FinBuddy tracks its live value. SIPs fill themselves in every month.</div>
      <button className="fb-btn fb-btn-lg" onClick={() => { onClose(); openInvest(); }}>Find an investment</button>
    </div>
  );
}

function GoalEntry({ onClose }) {
  const { goals, reloadGoals, toast } = useFinance();
  const [goalId, setGoalId] = useState(goals[0]?.id || null);
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const creating = goals.length === 0;

  const submit = (e) => {
    e.preventDefault();
    const value = parseFloat(amount) || 0;
    setSaving(true);
    const req = creating
      ? axios.post(`${API_BASE}/goals/`, { name: name.trim(), target: parseFloat(target), saved: value })
      : axios.post(`${API_BASE}/goals/${goalId}/contribute`, { amount: value });
    req.then((r) => {
      reloadGoals();
      toast(creating ? `Goal “${name.trim()}” created` : r.data.saved >= r.data.target ? `🎉 “${r.data.name}” reached!` : `Saved ${money(value)} towards ${r.data.name}`);
      onClose();
    }).catch((err) => { toast(apiError(err), 'error'); setSaving(false); });
  };

  return (
    <form onSubmit={submit}>
      {creating ? (
        <>
          <div className="small muted mb-3">No goals yet — create your first one.</div>
          <input className="fb-input mb-3" placeholder="Saving for? e.g. Goa trip" value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={120} />
          <div className="quick-label">Target</div>
          <div className="fb-input-wrap mb-3"><span className="prefix">₹</span>
            <NumInput className="fb-input num" placeholder="0" value={target} onChange={(e) => setTarget(e.target.value)} required /></div>
          <div className="quick-label">Already saved <span className="faint">(optional)</span></div>
          <div className="fb-input-wrap mb-4"><span className="prefix">₹</span>
            <NumInput className="fb-input num" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </>
      ) : (
        <>
          <div className="fb-input-wrap amount-wrap mb-3">
            <span className="prefix">₹</span>
            <NumInput className="fb-input amount-input num quick-amount" placeholder="0" value={amount}
              onChange={(e) => setAmount(e.target.value)} autoFocus required aria-label="Amount" />
          </div>
          <div className="quick-label">Towards</div>
          <div className="quick-chips mb-4">
            {goals.map((g) => (
              <button type="button" key={g.id} className={`quick-chip ${goalId === g.id ? 'on' : ''}`} onClick={() => setGoalId(g.id)}>
                {g.name} <span className="faint num">{Math.round((g.saved / g.target) * 100)}%</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="d-flex justify-content-end">
        <button type="submit" className="fb-btn fb-btn-lg" disabled={saving}>{saving ? <Spinner /> : creating ? 'Create goal' : 'Save to goal'}</button>
      </div>
    </form>
  );
}

export default QuickAdd;
