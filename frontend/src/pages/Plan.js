import React from 'react';
import { FiPlus } from 'react-icons/fi';
import { API_BASE } from '../config';
import { useFinance } from '../data/FinanceContext';
import { money, loanActiveIn, currentMonthKey } from '../finance';
import { Goals, Loans, monthsBetween } from '../components/money';
import { PageHead, SectionTitle } from '../components/page';

// Everything forward-looking in one place: goals you're saving for and EMIs you're paying.
function Plan() {
  const f = useFinance();
  const now = new Date().toISOString();
  const key = currentMonthKey();
  const emi = f.loans.filter((l) => loanActiveIn(l, key)).reduce((a, l) => a + l.amount, 0);
  const sip = f.portfolio?.totals.monthly_sip || 0;
  const goalNeed = f.goals.reduce((a, g) => {
    if (!g.deadline || g.saved >= g.target) return a;
    return a + (g.target - g.saved) / Math.max(1, monthsBetween(now, g.deadline));
  }, 0);
  const total = emi + sip + goalNeed;
  const share = f.baseIncome > 0 ? (total / f.baseIncome) * 100 : null;

  return (
    <div className="dash">
      <PageHead eyebrow="Plan" title={<>What's <em className="grad-text">ahead</em></>} />

      <div className="fb-card fb-card-hero mb-4 fb-fade-in d1">
        <div className="eyebrow">Every month you've committed</div>
        <div className="serif hero-net num grad-text">{money(total)}</div>
        {share != null && <div className="small muted">That's <b className="num">{share.toFixed(0)}%</b> of your monthly income — the rest is yours to spend or save.</div>}
        <div className="hero-meta">
          <div><div className="k">EMIs</div><div className="v num">{money(emi)}</div></div>
          <div><div className="k">SIPs</div><div className="v num">{money(sip)}</div></div>
          <div><div className="k">Goals need</div><div className="v num">{money(goalNeed)}</div></div>
        </div>
      </div>

      <SectionTitle action={<button className="fb-btn fb-btn-sm" onClick={() => f.editGoal({})}><FiPlus /> New goal</button>}>Savings goals</SectionTitle>
      <Goals goals={f.goals} onAdd={() => f.editGoal({})} onEdit={f.editGoal} onContribute={f.contributeGoal}
        onDelete={(g) => f.askDelete('Delete goal?', `“${g.name}” and its progress will be removed.`, `${API_BASE}/goals/${g.id}`, f.reloadGoals, 'Goal deleted')} />

      <div className="mt-5" />
      <SectionTitle action={<button className="fb-btn fb-btn-sm" onClick={() => f.editLoan({})}><FiPlus /> Add EMI</button>}>Loans & EMIs</SectionTitle>
      <Loans loans={f.loans} month={key} onEdit={f.editLoan} onAdd={() => f.editLoan({})}
        onDelete={(l) => f.askDelete('Delete loan?', `“${l.name}” will be removed from your EMIs.`, `${API_BASE}/loans/${l.id}`, f.reloadLoans, 'Loan deleted')} />
    </div>
  );
}

export default Plan;
