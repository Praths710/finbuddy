import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import { useAuth } from '../AuthContext';
import {
  monthStats, healthScore, currentMonthKey, shiftMonth, isIncomeTx, apiError,
} from '../finance';
import { Toasts, useToasts } from '../components/ui';
import {
  TransactionModal, LoanModal, BudgetModal, GoalModal, ContributeModal, ConfirmModal, Settings,
} from '../components/modals';
import { AddInvestmentModal } from '../components/invest';
import QuickAdd from '../components/QuickAdd';
import AIChat from '../components/AIChat';

const get = (path) => axios.get(`${API_BASE}${path}`).then((r) => r.data);

const FinanceContext = createContext(null);
export const useFinance = () => useContext(FinanceContext);

// Loads the user's money data once, keeps it fresh, and owns every sheet/modal so any
// screen (or the global "+" button) can open them without wiring its own state.
export function FinanceProvider({ children }) {
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
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioUpdated, setPortfolioUpdated] = useState(null);
  const [month, setMonth] = useState(currentMonthKey());

  // sheets
  const [quick, setQuick] = useState(null);          // { kind }
  const [txEdit, setTxEdit] = useState(null);
  const [loanEdit, setLoanEdit] = useState(null);
  const [goalEdit, setGoalEdit] = useState(null);
  const [contrib, setContrib] = useState(null);
  const [budgetEdit, setBudgetEdit] = useState(null);
  const [investOpen, setInvestOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const reloadTransactions = useCallback(() => get('/transactions/?limit=5000').then(setTransactions), []);
  const reloadLoans = useCallback(() => get('/loans/?limit=500').then(setLoans), []);
  const reloadCategories = useCallback(() => get('/categories/?limit=500').then(setCategories), []);
  const reloadBudgets = useCallback(() => get('/budgets/').then(setBudgets), []);
  const reloadGoals = useCallback(() => get('/goals/').then(setGoals), []);
  const reloadPortfolio = useCallback(() => get('/portfolio')
    .then((d) => { setPortfolio(d); setPortfolioUpdated(new Date()); })
    .catch(() => {}), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      reloadTransactions(), reloadLoans(), reloadCategories(), reloadBudgets(), reloadGoals(),
      get('/user/income').then((d) => alive && setIncome({ active: d.active_income || 0, passive: d.passive_income || 0 })),
    ])
      .catch((err) => toast(apiError(err, "Couldn't load your data."), 'error'))
      .finally(() => alive && setLoading(false));
    reloadPortfolio();
    const id = setInterval(() => { if (!document.hidden) reloadPortfolio(); }, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [reloadTransactions, reloadLoans, reloadCategories, reloadBudgets, reloadGoals, reloadPortfolio, toast]);

  const baseIncome = (income.active || 0) + (income.passive || 0);
  const stats = useMemo(() => monthStats({ transactions, loans, baseIncome, key: month }), [transactions, loans, baseIncome, month]);
  const prevStats = useMemo(() => monthStats({ transactions, loans, baseIncome, key: shiftMonth(month, -1) }), [transactions, loans, baseIncome, month]);
  const health = healthScore(stats);
  const budgetUsage = useMemo(() => budgets.map((b) => {
    const spent = stats.txs.filter((t) => t.category_id === b.category_id && !isIncomeTx(t)).reduce((a, t) => a + t.amount, 0);
    return { ...b, spent, pct: b.amount > 0 ? (spent / b.amount) * 100 : 0 };
  }).sort((a, b) => b.pct - a.pct), [budgets, stats]);

  const askDelete = useCallback((title, body, url, reload, done) => setConfirm({
    title, body,
    onYes: () => axios.delete(url).then(reload).then(() => toast(done)).catch((err) => toast(apiError(err), 'error')),
  }), [toast]);

  const signOut = useCallback(() => { logout(); navigate('/login'); }, [logout, navigate]);

  const value = {
    user, toast, loading,
    transactions, categories, loans, budgets, goals, income, setIncome, baseIncome,
    portfolio, portfolioUpdated,
    month, setMonth, stats, prevStats, health, budgetUsage,
    reloadTransactions, reloadLoans, reloadCategories, reloadBudgets, reloadGoals, reloadPortfolio,
    askDelete, askConfirm: setConfirm, signOut,
    openQuickAdd: (kind = 'spent') => setQuick({ kind }),
    editTransaction: setTxEdit,
    editLoan: (l = {}) => setLoanEdit(l),
    editGoal: (g = {}) => setGoalEdit(g),
    contributeGoal: setContrib,
    editBudget: (b = {}) => setBudgetEdit(b),
    openInvest: () => setInvestOpen(true),
    openSettings: () => setSettingsOpen(true),
    openAI: () => setAiOpen(true),
  };

  const saved = (close, reload) => (msg) => { close(null); reload(); toast(msg); };

  return (
    <FinanceContext.Provider value={value}>
      {children}

      <QuickAdd state={quick} onClose={() => setQuick(null)} />
      {txEdit && <TransactionModal tx={txEdit} categories={categories} onClose={() => setTxEdit(null)}
        onSaved={saved(setTxEdit, reloadTransactions)} toast={toast} />}
      {loanEdit && <LoanModal loan={loanEdit} onClose={() => setLoanEdit(null)} onSaved={saved(setLoanEdit, reloadLoans)} toast={toast} />}
      {goalEdit && <GoalModal goal={goalEdit} onClose={() => setGoalEdit(null)} onSaved={saved(setGoalEdit, reloadGoals)} toast={toast} />}
      {contrib && <ContributeModal goal={contrib} onClose={() => setContrib(null)} onSaved={saved(setContrib, reloadGoals)} toast={toast} />}
      {budgetEdit && <BudgetModal budget={budgetEdit} categories={categories} existing={budgets} onClose={() => setBudgetEdit(null)}
        onSaved={saved(setBudgetEdit, reloadBudgets)} toast={toast} />}
      {investOpen && <AddInvestmentModal onClose={() => setInvestOpen(false)} toast={toast}
        onDone={(msg) => { setInvestOpen(false); reloadPortfolio(); toast(msg); navigate('/invest'); }} />}

      <Modal show={settingsOpen} onHide={() => setSettingsOpen(false)} centered size="lg">
        <Modal.Header closeButton><Modal.Title>Settings</Modal.Title></Modal.Header>
        <Modal.Body>
          {settingsOpen && <Settings user={user} income={income} setIncome={setIncome} categories={categories}
            reloadCategories={reloadCategories} toast={toast} onLogout={signOut} />}
        </Modal.Body>
      </Modal>

      <AIChat open={aiOpen} onClose={() => setAiOpen(false)} user={user} health={healthScore(monthStats({ transactions, loans, baseIncome, key: currentMonthKey() }))} />
      <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />
      <Toasts toasts={toasts} />
    </FinanceContext.Provider>
  );
}
