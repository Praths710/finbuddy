import React from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCreditCard, FiTarget, FiAlertTriangle } from 'react-icons/fi';
import { money, monthKey, isIncomeTx, colorFor, loanActiveIn } from '../finance';

export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Dates go to the API as naive local noon so they never slip a day across time zones.
export const toApiDate = (yyyyMmDd) => `${yyyyMmDd}T12:00:00`;
export const fromApiDate = (iso) => new Date(`${iso.slice(0, 10)}T00:00:00`);
export const fmtDay = (iso, opts = { day: 'numeric', month: 'short' }) => fromApiDate(iso).toLocaleDateString('en-IN', opts);

export function Empty({ icon, title, text, action }) {
  return (
    <div className="fb-empty">
      <div className="icon">{icon}</div>
      <div className="fw-semibold" style={{ color: 'var(--text)' }}>{title}</div>
      <div className="small mt-1">{text}</div>
      {action}
    </div>
  );
}

export function TxRow({ tx, onEdit, onDelete }) {
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


export function BudgetBar({ b, compact, onEdit, onDelete }) {
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

export function Goals({ goals, onAdd, onEdit, onContribute, onDelete }) {
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
                  <defs>
                    <linearGradient id="goalGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#f3dfa2" /><stop offset="100%" stopColor="#9c7a24" />
                    </linearGradient>
                  </defs>
                  <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                  <circle cx="42" cy="42" r={r} fill="none" stroke="url(#goalGrad)" strokeWidth="7" strokeLinecap="round"
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

export function monthsBetween(a, b) {
  const [y1, m1] = monthKey(a).split('-').map(Number);
  const [y2, m2] = monthKey(b).split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export function Loans({ loans, month, onEdit, onDelete, onAdd }) {
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


export function ChartTooltip({ active, payload, label }) {
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
