import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiSearch, FiDownload, FiPlus, FiX, FiEdit2, FiTrash2, FiInbox } from 'react-icons/fi';
import { API_BASE } from '../config';
import { useFinance } from '../data/FinanceContext';
import { money, monthKey, monthLabel, isIncomeTx, isIncomeCategory, colorFor } from '../finance';
import { TxRow, Empty, fmtDay } from '../components/money';
import { MonthSwitch, PageHead } from '../components/page';

function Spending() {
  const f = useFinance();
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat') ? Number(params.get('cat')) : null;
  const setCat = (id) => setParams(id == null ? {} : { cat: String(id) });
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('month');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return f.transactions
      .filter((t) => scope === 'all' || monthKey(t.date) === f.month)
      .filter((t) => cat == null || (t.category_id || 0) === cat)
      .filter((t) => !needle || t.description.toLowerCase().includes(needle) || (t.category?.name || '').toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [f.transactions, f.month, q, cat, scope]);

  const groups = useMemo(() => {
    const g = [];
    list.forEach((t) => {
      const day = t.date.slice(0, 10);
      if (!g.length || g[g.length - 1].day !== day) g.push({ day, items: [], total: 0 });
      g[g.length - 1].items.push(t);
      if (!isIncomeTx(t)) g[g.length - 1].total += t.amount;
    });
    return g;
  }, [list]);

  // Category panel: this month's spend per expense category, with its budget.
  const cats = useMemo(() => {
    const spent = {};
    f.stats.txs.filter((t) => !isIncomeTx(t)).forEach((t) => { spent[t.category_id || 0] = (spent[t.category_id || 0] || 0) + t.amount; });
    return f.categories.filter((c) => !isIncomeCategory(c.name)).map((c) => ({
      ...c, spent: spent[c.id] || 0, budget: f.budgets.find((b) => b.category_id === c.id),
    })).concat(spent[0] ? [{ id: 0, name: 'Uncategorized', spent: spent[0] }] : [])
      .filter((c) => c.spent > 0 || c.budget)
      .sort((a, b) => b.spent - a.spent);
  }, [f.stats, f.categories, f.budgets]);
  const unbudgeted = f.categories.filter((c) => !isIncomeCategory(c.name) && !f.budgets.some((b) => b.category_id === c.id));

  const budgetTotal = f.budgets.reduce((a, b) => a + b.amount, 0);
  const budgetSpent = f.budgetUsage.reduce((a, b) => a + b.spent, 0);

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Date', 'Description', 'Category', 'Type', 'Amount (INR)']].concat(
      list.map((t) => [t.date.slice(0, 10), t.description, t.category?.name || 'Uncategorized', isIncomeTx(t) ? 'Income' : 'Expense', t.amount]));
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finbuddy-${scope === 'all' ? 'all-time' : f.month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const del = (tx) => f.askDelete('Delete transaction?', `“${tx.description}” for ${money(tx.amount)} will be removed.`,
    `${API_BASE}/transactions/${tx.id}`, f.reloadTransactions, 'Transaction deleted');
  const activeCat = cat == null ? null : cats.find((c) => c.id === cat) || f.categories.find((c) => c.id === cat);

  return (
    <div className="dash">
      <PageHead eyebrow="Spending" title={<>Where your <em className="grad-text">money</em> went</>}>
        <MonthSwitch />
      </PageHead>

      <div className="summary-strip fb-fade-in">
        <div><span>Spent</span><b className="num">{money(f.stats.spending)}</b></div>
        <div><span>EMIs</span><b className="num">{money(f.stats.emi)}</b></div>
        <div><span>Received</span><b className="num pos">{money(f.stats.extraIncome)}</b></div>
        {budgetTotal > 0 && <div><span>Budget left</span><b className={`num ${budgetSpent > budgetTotal ? 'neg' : ''}`}>{money(budgetTotal - budgetSpent)}</b></div>}
      </div>

      <div className="spend-grid">
        {/* Transactions */}
        <div className="fb-card fb-fade-in d1">
          <div className="toolbar">
            <div className="search">
              <FiSearch />
              <input className="fb-input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="fb-seg">
              <button className={scope === 'month' ? 'active' : ''} onClick={() => setScope('month')}>{monthLabel(f.month, { month: 'short' })}</button>
              <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>All time</button>
            </div>
            <button className="fb-icon-btn" onClick={exportCsv} disabled={!list.length} title="Export as CSV (opens in Excel)" aria-label="Export CSV"><FiDownload /></button>
          </div>
          {activeCat && (
            <div className="mb-2">
              <button className="quick-chip on" onClick={() => setCat(null)}>{activeCat.name} <FiX /></button>
            </div>
          )}
          {groups.length === 0 ? (
            <Empty icon={<FiInbox />} title={q || cat != null ? 'Nothing matches' : 'No transactions yet'}
              text={q || cat != null ? 'Try clearing the search or category.' : 'Tap + to add what you spent.'}
              action={!q && cat == null && <button className="fb-btn fb-btn-sm mt-3" onClick={() => f.openQuickAdd('spent')}><FiPlus /> Add expense</button>} />
          ) : groups.map((g) => (
            <div key={g.day}>
              <div className="day-head d-flex justify-content-between">
                <span>{fmtDay(g.day, { weekday: 'short', day: 'numeric', month: 'short', year: scope === 'all' ? 'numeric' : undefined })}</span>
                {g.total > 0 && <span className="num">{money(g.total)}</span>}
              </div>
              {g.items.map((tx) => <TxRow key={tx.id} tx={tx} onEdit={f.editTransaction} onDelete={del} />)}
            </div>
          ))}
        </div>

        {/* Categories & budgets */}
        <div className="fb-card fb-fade-in d2 align-self-start spend-cats">
          <div className="fb-card-title"><span>Categories & budgets</span></div>
          {cats.length === 0 && <div className="small muted mb-3">Your categories show up here once you start spending.</div>}
          {cats.map((c) => {
            const pct = c.budget ? (c.spent / c.budget.amount) * 100 : 0;
            const over = c.budget && pct > 100;
            return (
              <div key={c.id} className={`cat-row ${cat === c.id ? 'on' : ''}`} role="button" tabIndex={0}
                onClick={() => setCat(cat === c.id ? null : c.id)} onKeyDown={(e) => e.key === 'Enter' && setCat(cat === c.id ? null : c.id)}>
                <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                  <span className="d-flex align-items-center gap-2 fw-semibold fb-ellipsis"><span className="sw" style={{ background: colorFor(c.name) }} />{c.name}</span>
                  <span className="small text-nowrap">
                    <b className={`num ${over ? 'neg' : ''}`}>{money(c.spent)}</b>
                    {c.budget && <span className="faint"> / <span className="num">{money(c.budget.amount)}</span></span>}
                  </span>
                </div>
                {c.budget ? (
                  <>
                    <div className={`fb-progress ${over ? 'over' : pct >= 80 ? 'near' : ''}`} style={{ height: 6 }}><div style={{ width: `${Math.min(100, pct)}%` }} /></div>
                    <div className="d-flex justify-content-between align-items-center mt-1">
                      <span className={`small ${over ? 'neg' : 'faint'}`}>{over ? `${money(c.spent - c.budget.amount)} over` : `${money(c.budget.amount - c.spent)} left`}</span>
                      <span className="cat-actions">
                        <button className="fb-icon-btn" aria-label="Edit budget" onClick={(e) => { e.stopPropagation(); f.editBudget(c.budget); }}><FiEdit2 size={13} /></button>
                        <button className="fb-icon-btn danger" aria-label="Remove budget" onClick={(e) => {
                          e.stopPropagation();
                          f.askDelete('Remove budget?', `The ${c.name} limit will be removed.`, `${API_BASE}/budgets/${c.budget.id}`, f.reloadBudgets, 'Budget removed');
                        }}><FiTrash2 size={13} /></button>
                      </span>
                    </div>
                  </>
                ) : c.id !== 0 && (
                  <button className="cat-set" onClick={(e) => { e.stopPropagation(); f.editBudget({ category_id: c.id }); }}>+ Set a monthly limit</button>
                )}
              </div>
            );
          })}
          {unbudgeted.length > 0 && (
            <button className="fb-btn fb-btn-ghost fb-btn-sm w-100 mt-3" onClick={() => f.editBudget({})}><FiPlus /> Add a budget</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Spending;
