import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Modal } from 'react-bootstrap';
import { FiPlus, FiTrash2, FiArrowDownLeft, FiArrowUpRight, FiTag, FiUser, FiLogOut } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { API_BASE } from '../config';
import { Spinner, NumInput } from './ui';
import { money, isIncomeTx, isIncomeCategory, colorFor, initials, apiError } from '../finance';
import { todayLocal, toApiDate } from './money';

export function TransactionModal({ tx, categories, onClose, onSaved, toast }) {
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
            <NumInput className="fb-input amount-input num" placeholder="0"
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

export function LoanModal({ loan, onClose, onSaved, toast }) {
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
            <NumInput id="la" className="fb-input num" placeholder="0"
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

export function BudgetModal({ budget, categories, existing, onClose, onSaved, toast }) {
  const editing = Boolean(budget.id);
  const taken = new Set(existing.map((b) => b.category_id));
  const options = categories.filter((c) => !isIncomeCategory(c.name) && (editing ? c.id === budget.category_id : !taken.has(c.id)));
  const [categoryId, setCategoryId] = useState(String(budget.category_id || options[0]?.id || ''));
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
            <NumInput id="ba" className="fb-input amount-input num" placeholder="0"
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

export function GoalModal({ goal, onClose, onSaved, toast }) {
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
                <NumInput id="gt" className="fb-input num" placeholder="0"
                  value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required /></div>
            </div>
            <div className="col-6">
              <label className="fb-label" htmlFor="gs">Already saved</label>
              <div className="fb-input-wrap"><span className="prefix">₹</span>
                <NumInput id="gs" className="fb-input num" placeholder="0"
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

export function ContributeModal({ goal, onClose, onSaved, toast }) {
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
            <NumInput className="fb-input amount-input num" placeholder="0"
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

export function ConfirmModal({ confirm, onClose }) {
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


export function Settings({ user, income, setIncome, categories, reloadCategories, toast, onLogout }) {
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
          <NumInput id="ai" className="fb-input num" placeholder="0"
            value={active} onChange={(e) => setActive(e.target.value)} /></div>
        <label className="fb-label" htmlFor="pi">Passive income <span className="faint">(rent, dividends, interest)</span></label>
        <div className="fb-input-wrap mb-3"><span className="prefix">₹</span>
          <NumInput id="pi" className="fb-input num" placeholder="0"
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

